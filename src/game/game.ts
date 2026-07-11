import type { Location, NormalizedPoint } from "./locations";

const ROUND_DURATION_MS = 60_000;
const MAX_ROUNDS = 10;
const MAX_ROUND_SCORE = 5_000;
const FORGIVENESS_RADIUS = 0.015;
const SCORE_DECAY = 8;

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
): void {
  const runLocations = shuffle(availableLocations).slice(0, MAX_ROUNDS);
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

    app.innerHTML = `
      <main class="site-shell">
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
          <div class="game-final__rounds" aria-label="Round scores">
            ${roundScores.map((score, index) => `
              <div>
                <span>Round ${index + 1}</span>
                <strong class="score-value">${score.toLocaleString()}</strong>
              </div>
            `).join("")}
          </div>
          <div class="game-final__actions">
            <button class="start-button" type="button" data-play-again>Play again</button>
            <a class="tool-button" href="/">Back to home</a>
          </div>
        </section>
      </main>
    `;

    app.querySelector<HTMLButtonElement>("[data-play-again]")?.addEventListener("click", () => {
      renderGame(app, mapUrl, availableLocations);
    });
  };

  const beginRound = (): void => {
    stopTimer();
    guess = undefined;
    locked = false;
    deadline = Date.now() + ROUND_DURATION_MS;
    const location = runLocations[roundIndex];

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
              <span data-map-status>Click anywhere on the map</span>
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
                <span>Question</span>
                <span>Where is this?</span>
              </div>
              <div class="game-question-wrap">
                <img class="game-question" src="${location.imageUrl}" alt="Location question ${roundIndex + 1}" />
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

    if (!map || !guessPin || !answerPin || !answerLine || !answerLineClip || !answerLineSvg || !mapStatus || !timer || !totalScoreText || !lockButton || !nextButton || !result || !roundScore) {
      throw new Error("RooGuessr could not initialize the game round.");
    }

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

    const lockIn = (timedOut: boolean): void => {
      if (locked) return;
      locked = true;
      stopTimer();

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

    map.addEventListener("click", (event) => {
      if (locked) return;
      const bounds = map.getBoundingClientRect();
      guess = {
        x: clamp((event.clientX - bounds.left) / bounds.width),
        y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
      };
      showGuess();
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
