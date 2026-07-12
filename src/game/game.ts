import type { Location, NormalizedPoint } from "./locations";

const ROUND_DURATION_MS = 60_000;
const DEFAULT_ROUND_COUNT = 10;
const SCORES_PER_PAGE = 10;
const MAX_ROUND_SCORE = 5_000;
const FORGIVENESS_RADIUS = 0.015;
const SCORE_DECAY = 8;
const MAP_MAGNIFIER_ZOOM = 2.5;
const MAP_MAGNIFIER_GAP = 20;
const MAP_MAGNIFIER_HOLD_MS = 300;
const MAP_MAGNIFIER_TOUCH_HOLD_MS = 400;
const MAP_MAGNIFIER_DRAG_THRESHOLD = 5;

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
  if (distance <= FORGIVENESS_RADIUS) return MAX_ROUND_SCORE;

  const adjustedDistance = (distance - FORGIVENESS_RADIUS) / (1 - FORGIVENESS_RADIUS);
  const score = Math.round(MAX_ROUND_SCORE * Math.exp(-SCORE_DECAY * adjustedDistance));
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
  requestedRoundCount: number,
): void {
  if (availableLocations.length === 0) {
    throw new Error("RooGuessr cannot start a game without any locations.");
  }

  const fallbackRoundCount = Math.min(DEFAULT_ROUND_COUNT, availableLocations.length);
  const roundCount = Number.isFinite(requestedRoundCount)
    ? Math.min(availableLocations.length, Math.max(1, Math.floor(requestedRoundCount)))
    : fallbackRoundCount;
  const runLocations = shuffle(availableLocations).slice(0, roundCount);
  const roundScores: number[] = [];
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
    const scorePageCount = Math.max(1, Math.ceil(roundScores.length / SCORES_PER_PAGE));
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
      const pageScores = roundScores.slice(firstScoreIndex, firstScoreIndex + SCORES_PER_PAGE);
      const finalScoreIndex = firstScoreIndex + pageScores.length;

      scorePage.innerHTML = pageScores.map((score, index) => `
        <div>
          <span>Round ${firstScoreIndex + index + 1}</span>
          <strong class="score-value">${score.toLocaleString()}</strong>
        </div>
      `).join("");
      scorePage.setAttribute(
        "aria-label",
        `Round scores ${firstScoreIndex + 1} through ${finalScoreIndex} of ${roundScores.length}`,
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
      renderGame(app, mapUrl, availableLocations, runLocations.length);
    });
  };

  const beginRound = (): void => {
    stopTimer();
    guess = undefined;
    locked = false;
    deadline = Date.now() + ROUND_DURATION_MS;
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
            <div><span>Time</span><strong class="game-timer" data-game-timer>1:00</strong></div>
            <div><span>Total</span><strong class="score-value" data-total-score>${totalScore.toLocaleString()}</strong></div>
          </div>
        </header>

        <section class="game-board" aria-label="RooGuessr round ${roundIndex + 1}">
          <article class="game-card">
            <div class="game-card__heading">
              <span>Place your pin</span>
              <span data-map-status></span>
            </div>
            <div class="game-map-wrap" data-game-map>
              <img class="game-map" src="${mapUrl}" alt="Dota map" draggable="false" />
              <div class="game-map-magnifier-source" data-map-magnifier-source hidden aria-hidden="true"></div>
              <div class="game-map-magnifier" data-map-magnifier hidden aria-hidden="true">
                <img src="${mapUrl}" alt="" draggable="false" data-map-magnifier-image />
                <span class="game-map-magnifier__reticle"></span>
              </div>
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
      </main>
    `;

    const map = app.querySelector<HTMLElement>("[data-game-map]");
    const magnifier = app.querySelector<HTMLElement>("[data-map-magnifier]");
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
    const questionHeading = app.querySelector<HTMLElement>("[data-question-heading]");
    const questionPrompt = app.querySelector<HTMLElement>("[data-question-prompt]");
    const questionWrap = app.querySelector<HTMLElement>("[data-question-wrap]");
    const questionImage = app.querySelector<HTMLImageElement>("[data-question-image]");

    if (!map || !magnifier || !magnifierImage || !magnifierSource || !guessPin || !answerPin || !answerLine || !answerLineClip || !answerLineSvg || !mapStatus || !timer || !totalScoreText || !lockButton || !nextButton || !result || !roundScore || !questionHeading || !questionPrompt || !questionWrap || !questionImage) {
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

      magnifierSource.style.width = `${sourceWidth}px`;
      magnifierSource.style.height = `${sourceHeight}px`;
      magnifierSource.style.left = `${sourceX}px`;
      magnifierSource.style.top = `${sourceY}px`;

      let panelX = pointerX + MAP_MAGNIFIER_GAP;
      if (panelX + panelWidth > mapWidth) panelX = pointerX - panelWidth - MAP_MAGNIFIER_GAP;
      let panelY = pointerY - panelHeight - MAP_MAGNIFIER_GAP;
      if (panelY < 0) panelY = pointerY + MAP_MAGNIFIER_GAP;
      panelX = Math.max(0, Math.min(Math.max(0, mapWidth - panelWidth), panelX));
      panelY = Math.max(0, Math.min(Math.max(0, mapHeight - panelHeight), panelY));

      magnifier.style.left = `${panelX}px`;
      magnifier.style.top = `${panelY}px`;
      magnifierImage.style.width = `${mapWidth * MAP_MAGNIFIER_ZOOM}px`;
      magnifierImage.style.height = `${mapHeight * MAP_MAGNIFIER_ZOOM}px`;
      magnifierImage.style.left = `${(panelWidth / 2) - (sourceX * MAP_MAGNIFIER_ZOOM)}px`;
      magnifierImage.style.top = `${(panelHeight / 2) - (sourceY * MAP_MAGNIFIER_ZOOM)}px`;
    };

    const showMagnifier = (): void => {
      if (locked || magnifierPointerId === undefined || magnifierActive) return;
      if (magnifierHoldTimer !== undefined) window.clearTimeout(magnifierHoldTimer);
      magnifierHoldTimer = undefined;
      magnifierActive = true;
      magnifier.hidden = false;
      magnifierSource.hidden = false;
      updateMagnifier(pointerClientX, pointerClientY);
    };

    const lockIn = (timedOut: boolean): void => {
      if (locked) return;
      locked = true;
      stopTimer();
      hideMagnifier();

      const score = guess ? scoreGuess(guess, location.answer) : 0;
      totalScore += score;
      roundScores.push(score);
      totalScoreText.textContent = totalScore.toLocaleString();

      answerPin.style.cssText = pinPosition(location.answer);
      answerPin.hidden = false;
      map.classList.add("game-map-wrap--locked");
      lockButton.hidden = true;
      nextButton.hidden = false;
      result.hidden = false;
      roundScore.textContent = score.toLocaleString();
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
      if (locked || !event.isPrimary || event.button !== 0 || magnifierPointerId !== undefined) return;
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
