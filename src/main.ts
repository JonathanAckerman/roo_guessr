import "./styles.css";
import homeHeroUrl from "./assets/home-hero.png";
import mapUrl from "./assets/dota-map.webp";
import { renderAnswerEditor } from "./answer-editor";
import {
  DEFAULT_ROUND_DURATION_SECONDS,
  MAX_ROUND_DURATION_SECONDS,
  MIN_ROUND_DURATION_SECONDS,
  renderGame,
  ROUND_DURATION_STEP_SECONDS,
} from "./game/game";
import { locations } from "./game/locations";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("RooGuessr could not find its app container.");
}

const app: HTMLDivElement = appElement;

const MIN_QUESTION_COUNT = 5;
const DEFAULT_QUESTION_COUNT = 10;

function questionCountLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

function durationLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function durationAriaLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}${remainingSeconds ? ` ${remainingSeconds} seconds` : ""}`;
}

function render(): void {
  const maximumQuestionCount = locations.length;
  const defaultQuestionCount = Math.min(DEFAULT_QUESTION_COUNT, maximumQuestionCount);
  const canStart = maximumQuestionCount > 0;
  const questionCountControl = maximumQuestionCount > MIN_QUESTION_COUNT
    ? `
      <div class="game-option-control" data-question-count-control>
        <div class="game-option-control__heading">
          <label for="question-count">Total questions</label>
          <output for="question-count" data-question-count-output>${questionCountLabel(defaultQuestionCount)}</output>
        </div>
        <input
          class="game-option-control__range"
          id="question-count"
          type="range"
          min="${MIN_QUESTION_COUNT}"
          max="${maximumQuestionCount}"
          value="${defaultQuestionCount}"
          step="1"
          aria-valuetext="${questionCountLabel(defaultQuestionCount)}"
          data-question-count
        />
        <div class="game-option-control__limits" aria-hidden="true">
          <span>${MIN_QUESTION_COUNT}</span>
          <span>${maximumQuestionCount}</span>
        </div>
      </div>
    `
    : `
      <div class="game-option-control game-option-control--fixed" data-question-count-control>
        <span>Total questions</span>
        <strong data-question-count-output>
          ${canStart ? `${questionCountLabel(maximumQuestionCount)} · all available` : "No locations available"}
        </strong>
      </div>
    `;

  app.innerHTML = `
    <main class="site-shell home-shell">
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="RooGuessr home">
          <span class="wordmark__pin" aria-hidden="true"></span>
          <span>RooGuessr</span>
        </a>
        <div class="site-header__actions">
          <span class="location-count">${locations.length} ${locations.length === 1 ? "location" : "locations"}</span>
          <a class="tool-button" href="?tool=answers">Add your own</a>
        </div>
      </header>

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__copy">
          <h1 class="kicker hero__question" id="hero-title">How well do you know the Dota map?</h1>
          <p class="hero__intro">
            Somewhere in the world of Roo lies a battlefield between two ancient fragments of the Mad Moon.
            A local peasant has collected a variety of nondescript photos of this land. I'm sure after
            thousands of hours you can find where they were taken.
          </p>
        </div>

        <div class="map-window">
          <img class="map-window__image" src="${homeHeroUrl}" alt="" aria-hidden="true" draggable="false" />
          <div class="map-window__actions">
            <div class="game-options">
              ${questionCountControl}
              <div class="game-option-control" data-round-duration-control>
                <div class="game-option-control__heading">
                  <label for="round-duration">Time per question</label>
                  <output for="round-duration" data-round-duration-output>${durationLabel(DEFAULT_ROUND_DURATION_SECONDS)}</output>
                </div>
                <input
                  class="game-option-control__range"
                  id="round-duration"
                  type="range"
                  min="${MIN_ROUND_DURATION_SECONDS}"
                  max="${MAX_ROUND_DURATION_SECONDS}"
                  value="${DEFAULT_ROUND_DURATION_SECONDS}"
                  step="${ROUND_DURATION_STEP_SECONDS}"
                  aria-valuetext="${durationAriaLabel(DEFAULT_ROUND_DURATION_SECONDS)}"
                  data-round-duration
                />
                <div class="game-option-control__limits" aria-hidden="true">
                  <span>${durationLabel(MIN_ROUND_DURATION_SECONDS)}</span>
                  <span>${durationLabel(MAX_ROUND_DURATION_SECONDS)}</span>
                </div>
              </div>
            </div>
            <button class="start-button" type="button" data-start-game ${canStart ? "" : "disabled"}>
              Start Game
            </button>
          </div>
        </div>
      </section>
    </main>
  `;

  const questionCountInput = app.querySelector<HTMLInputElement>("[data-question-count]");
  const questionCountOutput = app.querySelector<HTMLElement>("[data-question-count-output]");
  const roundDurationInput = app.querySelector<HTMLInputElement>("[data-round-duration]");
  const roundDurationOutput = app.querySelector<HTMLElement>("[data-round-duration-output]");
  let selectedQuestionCount = defaultQuestionCount;
  let selectedRoundDurationSeconds = DEFAULT_ROUND_DURATION_SECONDS;

  questionCountInput?.addEventListener("input", () => {
    selectedQuestionCount = Number(questionCountInput.value);
    const label = questionCountLabel(selectedQuestionCount);
    questionCountInput.setAttribute("aria-valuetext", label);
    if (questionCountOutput) questionCountOutput.textContent = label;
  });

  roundDurationInput?.addEventListener("input", () => {
    selectedRoundDurationSeconds = Number(roundDurationInput.value);
    const label = durationLabel(selectedRoundDurationSeconds);
    roundDurationInput.setAttribute("aria-valuetext", durationAriaLabel(selectedRoundDurationSeconds));
    if (roundDurationOutput) roundDurationOutput.textContent = label;
  });

  app.querySelector<HTMLButtonElement>("[data-start-game]")?.addEventListener("click", () => {
    renderGame(app, mapUrl, locations, {
      roundCount: selectedQuestionCount,
      roundDurationSeconds: selectedRoundDurationSeconds,
    });
  });
}

if (new URLSearchParams(window.location.search).get("tool") === "answers") {
  renderAnswerEditor(app, mapUrl);
} else {
  render();
}
