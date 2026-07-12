import type { Location, NormalizedPoint } from "./locations";

const DEFAULT_ROUND_COUNT = 10;
const SCORES_PER_PAGE = 10;
const MAX_MAP_SCORE = 5_000;
const MAX_TIME_BONUS = 500;
const MAX_ROUND_SCORE = MAX_MAP_SCORE + MAX_TIME_BONUS;
const FORGIVENESS_RADIUS = 0.015;
const SCORE_DECAY = 8;
const MAP_MAGNIFIER_ZOOM = 2.5;
const MAP_MAGNIFIER_HOLD_MS = 300;
const MAP_MAGNIFIER_TOUCH_HOLD_MS = 400;
const MAP_MAGNIFIER_DRAG_THRESHOLD = 5;

export const MIN_ROUND_DURATION_SECONDS = 60;
export const MAX_ROUND_DURATION_SECONDS = 180;
export const DEFAULT_ROUND_DURATION_SECONDS = 120;
export const ROUND_DURATION_STEP_SECONDS = 30;

export interface GameSettings {
  roundCount: number;
  roundDurationSeconds: number;
}

interface RoundResult {
  mapScore: number;
  timeBonus: number;
  total: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function distanceBetween(left: NormalizedPoint, right: NormalizedPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y) / Math.SQRT2;
}

export function scoreGuess(guess: NormalizedPoint, answer: NormalizedPoint): number {
  const distance = distanceBetween(guess, answer);
  if (distance <= FORGIVENESS_RADIUS) return MAX_MAP_SCORE;

  const adjustedDistance = (distance - FORGIVENESS_RADIUS) / (1 - FORGIVENESS_RADIUS);
  const score = Math.round(MAX_MAP_SCORE * Math.exp(-SCORE_DECAY * adjustedDistance));
  return score < 1 ? 0 : score;
}

function pinPosition(point: NormalizedPoint): string {
  return `left: ${point.x * 100}%; top: ${(1 - point.y) * 100}%`;
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function renderGame(
  app: HTMLDivElement,
  mapUrl: string,
  availableLocations: readonly Location[],
  requestedSettings: GameSettings,
): void {
  if (availableLocations.length === 0) {
    throw new Error("RooGuessr cannot start a game without any locations.");
  }

  const fallbackRoundCount = Math.min(DEFAULT_ROUND_COUNT, availableLocations.length);
  const roundCount = Number.isFinite(requestedSettings.roundCount)
    ? Math.min(availableLocations.length, Math.max(1, Math.floor(requestedSettings.roundCount)))
    : fallbackRoundCount;
  const requestedDurationSeconds = Number.isFinite(requestedSettings.roundDurationSeconds)
    ? requestedSettings.roundDurationSeconds
    : DEFAULT_ROUND_DURATION_SECONDS;
  const clampedDurationSeconds = Math.max(
    MIN_ROUND_DURATION_SECONDS,
    Math.min(MAX_ROUND_DURATION_SECONDS, requestedDurationSeconds),
  );
  const roundDurationSeconds = MIN_ROUND_DURATION_SECONDS + (
    Math.round((clampedDurationSeconds - MIN_ROUND_DURATION_SECONDS) / ROUND_DURATION_STEP_SECONDS)
    * ROUND_DURATION_STEP_SECONDS
  );
  const roundDurationMs = roundDurationSeconds * 1000;
  const settings: GameSettings = { roundCount, roundDurationSeconds };
  const runLocations = shuffle(availableLocations).slice(0, roundCount);
  const roundResults: RoundResult[] = [];
  let roundIndex = 0;
  let totalScore = 0;
  let guess: NormalizedPoint | undefined;
  let locked = false;
  let deadline = 0;
  let timerId: number | undefined;

  const stopTimer = (): void => {
    if (timerId !== undefined) window.clearInterval(timerId);
    timerId = undefined;
  };

  const renderFinalScore = (): void => {
    stopTimer();
    const maximumScore = runLocations.length * MAX_ROUND_SCORE;
    const scorePageCount = Math.max(1, Math.ceil(roundResults.length / SCORES_PER_PAGE));
    let scorePageIndex = 0;

    app.innerHTML = `
      <main class="site-shell results-shell">
        <header class="site-header">
          <a class="wordmark" href="/" aria-label="RooGuessr home">
            <span class="wordmark__pin" aria-hidden="true"></span>
            <span>RooGuessr</span>
          </a>
          <span class="location-count">Run complete</span>
        </header>

        <section class="game-final" aria-labelledby="final-score-title">
          <p class="kicker">Final score</p>
          <h1 class="score-value" id="final-score-title">${totalScore.toLocaleString()}</h1>
          <p>out of ${maximumScore.toLocaleString()} points across ${runLocations.length} ${runLocations.length === 1 ? "location" : "locations"}.</p>
          <div class="game-final__rounds" data-score-page></div>
          <nav class="game-final__pagination" aria-label="Round score pages" data-score-pagination ${scorePageCount === 1 ? "hidden" : ""}>
            <button class="tool-button" type="button" aria-label="Previous round scores" data-score-page-previous>Previous</button>
            <span aria-live="polite" data-score-page-status></span>
            <button class="tool-button" type="button" aria-label="Next round scores" data-score-page-next>Next</button>
          </nav>
          <div class="game-final__actions">
            <button class="start-button" type="button" data-play-again>Play again</button>
            <a class="tool-button" href="/">Back to home</a>
          </div>
        </section>
      </main>
    `;

    const scorePage = app.querySelector<HTMLElement>("[data-score-page]");
    const previousScorePageButton = app.querySelector<HTMLButtonElement>("[data-score-page-previous]");
    const nextScorePageButton = app.querySelector<HTMLButtonElement>("[data-score-page-next]");
    const scorePageStatus = app.querySelector<HTMLElement>("[data-score-page-status]");

    if (!scorePage || !previousScorePageButton || !nextScorePageButton || !scorePageStatus) {
      throw new Error("RooGuessr could not initialize the final score breakdown.");
    }

    const renderScorePage = (): void => {
      const firstScoreIndex = scorePageIndex * SCORES_PER_PAGE;
      const pageResults = roundResults.slice(firstScoreIndex, firstScoreIndex + SCORES_PER_PAGE);
      const finalScoreIndex = firstScoreIndex + pageResults.length;

      scorePage.innerHTML = pageResults.map((roundResult, index) => `
        <div>
          <span>Round ${firstScoreIndex + index + 1}</span>
          <strong class="score-value">${roundResult.total.toLocaleString()}</strong>
          <small>${roundResult.mapScore.toLocaleString()} map · +${roundResult.timeBonus.toLocaleString()} time</small>
        </div>
      `).join("");
      scorePage.setAttribute(
        "aria-label",
        `Round scores ${firstScoreIndex + 1} through ${finalScoreIndex} of ${roundResults.length}`,
      );
      scorePageStatus.textContent = `Page ${scorePageIndex + 1} of ${scorePageCount}`;
      previousScorePageButton.disabled = scorePageIndex === 0;
      nextScorePageButton.disabled = scorePageIndex === scorePageCount - 1;
    };

    previousScorePageButton.addEventListener("click", () => {
      if (scorePageIndex === 0) return;
      scorePageIndex -= 1;
      renderScorePage();
    });

    nextScorePageButton.addEventListener("click", () => {
      if (scorePageIndex === scorePageCount - 1) return;
      scorePageIndex += 1;
      renderScorePage();
    });

    renderScorePage();

    app.querySelector<HTMLButtonElement>("[data-play-again]")?.addEventListener("click", () => {
      renderGame(app, mapUrl, availableLocations, settings);
    });
  };

  const beginRound = (): void => {
    stopTimer();
    guess = undefined;
    locked = false;
    deadline = Date.now() + roundDurationMs;
    const location = runLocations[roundIndex];
    const answerImagePreload = location.answerImageUrl ? new Image() : undefined;
    if (answerImagePreload && location.answerImageUrl) answerImagePreload.src = location.answerImageUrl;

    app.innerHTML = `
      <main class="game-shell">
        <header class="site-header game-header">
          <a class="wordmark" href="/" aria-label="RooGuessr home">
            <span class="wordmark__pin" aria-hidden="true"></span>
            <span>RooGuessr</span>
          </a>
          <div class="game-stats" aria-label="Game status">
            <div><span>Round</span><strong>${roundIndex + 1} / ${runLocations.length}</strong></div>
            <div><span>Time</span><strong class="game-timer" data-game-timer>${formatTime(roundDurationSeconds)}</strong></div>
            <div><span>Total</span><strong class="score-value" data-total-score>${totalScore.toLocaleString()}</strong></div>
          </div>
        </header>

        <section class="game-board" aria-label="RooGuessr round ${roundIndex + 1}">
          <article class="game-card">
            <div class="game-card__heading">
              <span>Place your pin</span>
              <span data-map-status>Hold left mouse to zoom</span>
            </div>
            <div class="game-map-wrap" data-game-map>
              <img class="game-map" src="${mapUrl}" alt="Dota map" draggable="false" />
              <svg class="game-answer-line" viewBox="0 0 100 100" preserveAspectRatio="none" hidden aria-hidden="true">
                <defs>
                  <clipPath id="answer-line-reveal" clipPathUnits="userSpaceOnUse">
                    <polygon data-answer-line-clip />
                  </clipPath>
                </defs>
                <line data-answer-line clip-path="url(#answer-line-reveal)" />
              </svg>
              <div class="game-map__pin game-map__pin--guess" data-guess-pin hidden aria-label="Your guess"><span></span></div>
              <div class="game-map__pin game-map__pin--answer" data-answer-pin hidden aria-label="Correct answer"><span></span></div>
            </div>
          </article>

          <div class="game-side">
            <article class="game-card">
              <div class="game-card__heading">
                <span data-question-heading>Question</span>
                <span data-question-prompt>Where is this?</span>
              </div>
              <div class="game-question-wrap" data-question-wrap>
                <img class="game-question" src="${location.questionImageUrl}" alt="Location question ${roundIndex + 1}" data-question-image />
              </div>
            </article>

            <section class="game-controls">
              <div class="game-result" data-game-result hidden>
                <p class="section-number">Round score</p>
                <strong class="score-value" data-round-score>0</strong>
                <p class="game-result__breakdown" data-round-score-breakdown></p>
              </div>
              <div class="game-controls__actions">
                <button class="start-button" type="button" data-lock-in disabled>Lock In</button>
                <button class="start-button" type="button" data-next-round hidden>
                  ${roundIndex + 1 === runLocations.length ? "Results" : "Next"}
                </button>
              </div>
            </section>
          </div>
        </section>

        <div class="game-map-magnifier-source" data-map-magnifier-source hidden aria-hidden="true"></div>
        <svg class="game-map-magnifier-connectors" data-map-magnifier-connectors hidden aria-hidden="true">
          <line data-map-magnifier-connector-top />
          <line data-map-magnifier-connector-bottom />
        </svg>
        <div class="game-map-magnifier" data-map-magnifier hidden aria-hidden="true">
          <img src="${mapUrl}" alt="" draggable="false" data-map-magnifier-image />
          <svg class="game-map-magnifier__answer-line" data-map-magnifier-answer-line hidden>
            <line data-map-magnifier-answer-line-segment />
          </svg>
          <div class="game-map__pin game-map__pin--guess game-map__pin--magnifier" data-map-magnifier-guess-pin hidden><span></span></div>
          <div class="game-map__pin game-map__pin--answer game-map__pin--magnifier" data-map-magnifier-answer-pin hidden><span></span></div>
          <span class="game-map-magnifier__reticle"></span>
        </div>
      </main>
    `;

    const map = app.querySelector<HTMLElement>("[data-game-map]");
    const magnifier = app.querySelector<HTMLElement>("[data-map-magnifier]");
    const magnifierConnectors = app.querySelector<SVGSVGElement>("[data-map-magnifier-connectors]");
    const magnifierConnectorTop = app.querySelector<SVGLineElement>("[data-map-magnifier-connector-top]");
    const magnifierConnectorBottom = app.querySelector<SVGLineElement>("[data-map-magnifier-connector-bottom]");
    const magnifierAnswerLine = app.querySelector<SVGSVGElement>("[data-map-magnifier-answer-line]");
    const magnifierAnswerLineSegment = app.querySelector<SVGLineElement>("[data-map-magnifier-answer-line-segment]");
    const magnifierGuessPin = app.querySelector<HTMLElement>("[data-map-magnifier-guess-pin]");
    const magnifierAnswerPin = app.querySelector<HTMLElement>("[data-map-magnifier-answer-pin]");
    const magnifierImage = app.querySelector<HTMLImageElement>("[data-map-magnifier-image]");
    const magnifierSource = app.querySelector<HTMLElement>("[data-map-magnifier-source]");
    const guessPin = app.querySelector<HTMLElement>("[data-guess-pin]");
    const answerPin = app.querySelector<HTMLElement>("[data-answer-pin]");
    const answerLine = app.querySelector<SVGLineElement>("[data-answer-line]");
    const answerLineClip = app.querySelector<SVGPolygonElement>("[data-answer-line-clip]");
    const answerLineSvg = app.querySelector<SVGSVGElement>(".game-answer-line");
    const mapStatus = app.querySelector<HTMLElement>("[data-map-status]");
    const timer = app.querySelector<HTMLElement>("[data-game-timer]");
    const totalScoreText = app.querySelector<HTMLElement>("[data-total-score]");
    const lockButton = app.querySelector<HTMLButtonElement>("[data-lock-in]");
    const nextButton = app.querySelector<HTMLButtonElement>("[data-next-round]");
    const result = app.querySelector<HTMLElement>("[data-game-result]");
    const roundScore = app.querySelector<HTMLElement>("[data-round-score]");
    const roundScoreBreakdown = app.querySelector<HTMLElement>("[data-round-score-breakdown]");
    const questionHeading = app.querySelector<HTMLElement>("[data-question-heading]");
    const questionPrompt = app.querySelector<HTMLElement>("[data-question-prompt]");
    const questionWrap = app.querySelector<HTMLElement>("[data-question-wrap]");
    const questionImage = app.querySelector<HTMLImageElement>("[data-question-image]");

    if (!map || !magnifier || !magnifierConnectors || !magnifierConnectorTop || !magnifierConnectorBottom || !magnifierAnswerLine || !magnifierAnswerLineSegment || !magnifierGuessPin || !magnifierAnswerPin || !magnifierImage || !magnifierSource || !guessPin || !answerPin || !answerLine || !answerLineClip || !answerLineSvg || !mapStatus || !timer || !totalScoreText || !lockButton || !nextButton || !result || !roundScore || !roundScoreBreakdown || !questionHeading || !questionPrompt || !questionWrap || !questionImage) {
      throw new Error("RooGuessr could not initialize the game round.");
    }

    let magnifierPointerId: number | undefined;
    let magnifierActive = false;
    let magnifierHoldTimer: number | undefined;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerClientX = 0;
    let pointerClientY = 0;

    const showGuess = (): void => {
      if (!guess) return;
      guessPin.style.cssText = pinPosition(guess);
      guessPin.classList.remove("game-map__pin--tipping");
      guessPin.hidden = false;
      void guessPin.offsetWidth;
      guessPin.classList.add("game-map__pin--tipping");
      lockButton.disabled = false;
      mapStatus.textContent = "";
    };

    const hideMagnifier = (): void => {
      if (magnifierHoldTimer !== undefined) window.clearTimeout(magnifierHoldTimer);
      magnifierHoldTimer = undefined;
      magnifierPointerId = undefined;
      magnifierActive = false;
      magnifier.hidden = true;
      magnifierConnectors.setAttribute("hidden", "");
      magnifierSource.hidden = true;
    };

    const updateMagnifier = (clientX: number, clientY: number): void => {
      const bounds = map.getBoundingClientRect();
      const mapWidth = bounds.width;
      const mapHeight = bounds.height;
      const pointerX = Math.max(0, Math.min(mapWidth, clientX - bounds.left));
      const pointerY = Math.max(0, Math.min(mapHeight, clientY - bounds.top));
      const panelWidth = magnifier.offsetWidth;
      const panelHeight = magnifier.offsetHeight;
      const sourceWidth = Math.min(mapWidth, panelWidth / MAP_MAGNIFIER_ZOOM);
      const sourceHeight = Math.min(mapHeight, panelHeight / MAP_MAGNIFIER_ZOOM);
      const sourceX = Math.max(sourceWidth / 2, Math.min(mapWidth - sourceWidth / 2, pointerX));
      const sourceY = Math.max(sourceHeight / 2, Math.min(mapHeight - sourceHeight / 2, pointerY));
      const horizontalOverlap = Math.min(16, sourceWidth * 0.18);
      const sourceLeft = bounds.left + sourceX - (sourceWidth / 2);
      const sourceTop = bounds.top + sourceY - (sourceHeight / 2);
      const panelX = bounds.left + sourceX + (sourceWidth / 2) - horizontalOverlap;
      const panelY = bounds.top + sourceY - (panelHeight / 2) - (sourceHeight * 0.18);

      magnifierSource.style.width = `${sourceWidth}px`;
      magnifierSource.style.height = `${sourceHeight}px`;
      magnifierSource.style.left = `${bounds.left + sourceX}px`;
      magnifierSource.style.top = `${bounds.top + sourceY}px`;

      magnifier.style.left = `${panelX}px`;
      magnifier.style.top = `${panelY}px`;
      magnifierImage.style.width = `${mapWidth * MAP_MAGNIFIER_ZOOM}px`;
      magnifierImage.style.height = `${mapHeight * MAP_MAGNIFIER_ZOOM}px`;
      magnifierImage.style.left = `${(panelWidth / 2) - (sourceX * MAP_MAGNIFIER_ZOOM)}px`;
      magnifierImage.style.top = `${(panelHeight / 2) - (sourceY * MAP_MAGNIFIER_ZOOM)}px`;

      const magnifiedPosition = (point: NormalizedPoint): { x: number; y: number } => ({
        x: (panelWidth / 2) + (((point.x * mapWidth) - sourceX) * MAP_MAGNIFIER_ZOOM),
        y: (panelHeight / 2) + ((((1 - point.y) * mapHeight) - sourceY) * MAP_MAGNIFIER_ZOOM),
      });
      const magnifiedGuess = guess ? magnifiedPosition(guess) : undefined;
      const magnifiedAnswer = magnifiedPosition(location.answer);

      magnifierGuessPin.hidden = !magnifiedGuess;
      if (magnifiedGuess) {
        magnifierGuessPin.style.left = `${magnifiedGuess.x}px`;
        magnifierGuessPin.style.top = `${magnifiedGuess.y}px`;
      }

      magnifierAnswerPin.hidden = !locked;
      if (locked) {
        magnifierAnswerPin.style.left = `${magnifiedAnswer.x}px`;
        magnifierAnswerPin.style.top = `${magnifiedAnswer.y}px`;
      }

      if (locked && magnifiedGuess) {
        magnifierAnswerLine.setAttribute("viewBox", `0 0 ${panelWidth} ${panelHeight}`);
        magnifierAnswerLineSegment.setAttribute("x1", String(magnifiedGuess.x));
        magnifierAnswerLineSegment.setAttribute("y1", String(magnifiedGuess.y));
        magnifierAnswerLineSegment.setAttribute("x2", String(magnifiedAnswer.x));
        magnifierAnswerLineSegment.setAttribute("y2", String(magnifiedAnswer.y));
        magnifierAnswerLine.removeAttribute("hidden");
      } else {
        magnifierAnswerLine.setAttribute("hidden", "");
      }

      magnifierConnectors.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
      magnifierConnectorTop.setAttribute("x1", String(sourceLeft));
      magnifierConnectorTop.setAttribute("y1", String(sourceTop));
      magnifierConnectorTop.setAttribute("x2", String(panelX));
      magnifierConnectorTop.setAttribute("y2", String(panelY));
      magnifierConnectorBottom.setAttribute("x1", String(sourceLeft));
      magnifierConnectorBottom.setAttribute("y1", String(sourceTop + sourceHeight));
      magnifierConnectorBottom.setAttribute("x2", String(panelX));
      magnifierConnectorBottom.setAttribute("y2", String(panelY + panelHeight));
    };

    const showMagnifier = (): void => {
      if (magnifierPointerId === undefined || magnifierActive) return;
      if (magnifierHoldTimer !== undefined) window.clearTimeout(magnifierHoldTimer);
      magnifierHoldTimer = undefined;
      magnifierActive = true;
      magnifier.hidden = false;
      magnifierConnectors.removeAttribute("hidden");
      magnifierSource.hidden = false;
      updateMagnifier(pointerClientX, pointerClientY);
    };

    const lockIn = (timedOut: boolean): void => {
      if (locked) return;
      locked = true;
      stopTimer();
      hideMagnifier();

      const remainingTimeMs = timedOut ? 0 : Math.max(0, Math.min(roundDurationMs, deadline - Date.now()));
      const mapScore = guess ? scoreGuess(guess, location.answer) : 0;
      const timeBonus = guess
        ? Math.round(
          MAX_TIME_BONUS
          * (remainingTimeMs / roundDurationMs)
          * (mapScore / MAX_MAP_SCORE),
        )
        : 0;
      const roundTotal = mapScore + timeBonus;
      totalScore += roundTotal;
      roundResults.push({ mapScore, timeBonus, total: roundTotal });
      totalScoreText.textContent = totalScore.toLocaleString();

      answerPin.style.cssText = pinPosition(location.answer);
      answerPin.hidden = false;
      map.classList.add("game-map-wrap--locked");
      lockButton.hidden = true;
      nextButton.hidden = false;
      result.hidden = false;
      roundScore.textContent = roundTotal.toLocaleString();
      roundScoreBreakdown.textContent = `${mapScore.toLocaleString()} map · +${timeBonus.toLocaleString()} time`;
      mapStatus.textContent = timedOut ? "Time expired" : "Answer revealed";

      if (answerImagePreload) {
        questionImage.src = answerImagePreload.src;
        questionImage.alt = `Answer context for location ${roundIndex + 1}`;
        questionImage.classList.add("game-question--answer");
        questionWrap.classList.add("game-question-wrap--answer");
        questionHeading.textContent = "Answer";
        questionPrompt.textContent = "Location context";
      }

      if (guess) {
        const guessX = guess.x * 100;
        const guessY = (1 - guess.y) * 100;
        const answerX = location.answer.x * 100;
        const answerY = (1 - location.answer.y) * 100;
        const answerVectorX = answerX - guessX;
        const answerVectorY = answerY - guessY;
        const answerVectorLength = Math.hypot(answerVectorX, answerVectorY);
        const clipHalfWidth = 3;
        const clipPerpendicularX = answerVectorLength > 0
          ? (-answerVectorY / answerVectorLength) * clipHalfWidth
          : 0;
        const clipPerpendicularY = answerVectorLength > 0
          ? (answerVectorX / answerVectorLength) * clipHalfWidth
          : 0;

        const setAnswerLineReveal = (progress: number): void => {
          const revealX = guessX + (answerVectorX * progress);
          const revealY = guessY + (answerVectorY * progress);
          answerLineClip.setAttribute("points", [
            `${guessX + clipPerpendicularX},${guessY + clipPerpendicularY}`,
            `${revealX + clipPerpendicularX},${revealY + clipPerpendicularY}`,
            `${revealX - clipPerpendicularX},${revealY - clipPerpendicularY}`,
            `${guessX - clipPerpendicularX},${guessY - clipPerpendicularY}`,
          ].join(" "));
        };

        answerLine.setAttribute("x1", String(guessX));
        answerLine.setAttribute("y1", String(guessY));
        answerLine.setAttribute("x2", String(answerX));
        answerLine.setAttribute("y2", String(answerY));
        setAnswerLineReveal(0);
        answerLineSvg.removeAttribute("hidden");

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setAnswerLineReveal(1);
        } else {
          const revealStart = performance.now() + 60;
          const revealAnswerLine = (timestamp: number): void => {
            const progress = Math.min(1, Math.max(0, (timestamp - revealStart) / 420));
            const easedProgress = 1 - ((1 - progress) ** 3);
            setAnswerLineReveal(easedProgress);

            if (progress < 1) window.requestAnimationFrame(revealAnswerLine);
          };

          window.requestAnimationFrame(revealAnswerLine);
        }

      }
    };

    const updateTimer = (): void => {
      if (locked) return;
      const millisecondsLeft = Math.max(0, deadline - Date.now());
      const secondsLeft = Math.ceil(millisecondsLeft / 1000);
      timer.textContent = formatTime(secondsLeft);
      timer.classList.toggle("game-timer--urgent", secondsLeft <= 10);
      if (millisecondsLeft <= 0) lockIn(true);
    };

    map.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || magnifierPointerId !== undefined) return;
      event.preventDefault();
      magnifierPointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      map.setPointerCapture(event.pointerId);
      const holdDelay = event.pointerType === "touch"
        ? MAP_MAGNIFIER_TOUCH_HOLD_MS
        : MAP_MAGNIFIER_HOLD_MS;
      magnifierHoldTimer = window.setTimeout(showMagnifier, holdDelay);
    });

    map.addEventListener("pointermove", (event) => {
      if (event.pointerId !== magnifierPointerId) return;
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      const dragDistance = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
      if (!magnifierActive && dragDistance >= MAP_MAGNIFIER_DRAG_THRESHOLD) showMagnifier();
      if (magnifierActive) updateMagnifier(event.clientX, event.clientY);
    });

    map.addEventListener("pointerup", (event) => {
      if (event.pointerId !== magnifierPointerId) return;
      const wasMagnifying = magnifierActive;
      const bounds = map.getBoundingClientRect();
      const clickPoint: NormalizedPoint = {
        x: clamp((event.clientX - bounds.left) / bounds.width),
        y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
      };
      hideMagnifier();
      if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
      if (locked || wasMagnifying) return;
      guess = clickPoint;
      showGuess();
    });

    map.addEventListener("pointercancel", (event) => {
      if (event.pointerId === magnifierPointerId) hideMagnifier();
    });

    map.addEventListener("lostpointercapture", (event) => {
      if (event.pointerId === magnifierPointerId) hideMagnifier();
    });

    lockButton.addEventListener("click", () => lockIn(false));
    nextButton.addEventListener("click", () => {
      hideMagnifier();
      if (roundIndex + 1 === runLocations.length) {
        renderFinalScore();
      } else {
        roundIndex += 1;
        beginRound();
      }
    });

    updateTimer();
    timerId = window.setInterval(updateTimer, 250);
  };

  window.addEventListener("pagehide", stopTimer, { once: true });
  beginRound();
}
