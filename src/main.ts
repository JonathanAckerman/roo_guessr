import "./styles.css";
import homeHeroUrl from "./assets/home-hero.png";
import mapUrl from "./assets/dota-map.webp";
import { renderAnswerEditor } from "./answer-editor";
import { renderGame } from "./game/game";
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

function render(): void {
  const maximumQuestionCount = locations.length;
  const defaultQuestionCount = Math.min(DEFAULT_QUESTION_COUNT, maximumQuestionCount);
  const canStart = maximumQuestionCount > 0;
  const questionCountControl = maximumQuestionCount > MIN_QUESTION_COUNT
    ? `
      <div class="question-count-control" data-question-count-control>
        <div class="question-count-control__heading">
          <label for="question-count">Questions</label>
          <output for="question-count" data-question-count-output>${questionCountLabel(defaultQuestionCount)}</output>
        </div>
        <input
          class="question-count-control__range"
          id="question-count"
          type="range"
          min="${MIN_QUESTION_COUNT}"
          max="${maximumQuestionCount}"
          value="${defaultQuestionCount}"
          step="1"
          aria-valuetext="${questionCountLabel(defaultQuestionCount)}"
          data-question-count
        />
        <div class="question-count-control__limits" aria-hidden="true">
          <span>${MIN_QUESTION_COUNT}</span>
          <span>${maximumQuestionCount}</span>
        </div>
      </div>
    `
    : `
      <div class="question-count-control question-count-control--fixed" data-question-count-control>
        <span>Questions</span>
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
          <span class="location-count">${locations.length} curated ${locations.length === 1 ? "location" : "locations"}</span>
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
            ${questionCountControl}
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
  let selectedQuestionCount = defaultQuestionCount;

  questionCountInput?.addEventListener("input", () => {
    selectedQuestionCount = Number(questionCountInput.value);
    const label = questionCountLabel(selectedQuestionCount);
    questionCountInput.setAttribute("aria-valuetext", label);
    if (questionCountOutput) questionCountOutput.textContent = label;
  });

  app.querySelector<HTMLButtonElement>("[data-start-game]")?.addEventListener("click", () => {
    renderGame(app, mapUrl, locations, selectedQuestionCount);
  });
}

if (new URLSearchParams(window.location.search).get("tool") === "answers") {
  renderAnswerEditor(app, mapUrl);
} else {
  render();
}
