import "./styles.css";
import mapUrl from "./assets/dota-map.webp";
import { renderAnswerEditor } from "./answer-editor";
import { DIFFICULTIES, type Difficulty } from "./game/difficulty";
import { locations } from "./game/locations";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("RooGuessr could not find its app container.");
}

const app: HTMLDivElement = appElement;

let selectedDifficulty: Difficulty = "easy";

function difficultyButton(difficulty: Difficulty): string {
  const details = DIFFICULTIES[difficulty];
  const selected = difficulty === selectedDifficulty;

  return `
    <button
      class="difficulty-card${selected ? " difficulty-card--selected" : ""}"
      type="button"
      data-difficulty="${difficulty}"
      aria-pressed="${selected}"
    >
      <span class="difficulty-card__eyebrow">${Math.round(details.cropScale * 100)}% view</span>
      <strong>${details.label}</strong>
      <span>${details.description}</span>
    </button>
  `;
}

function render(): void {
  const canStart = locations.length > 0;

  app.innerHTML = `
    <main class="site-shell">
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="RooGuessr home">
          <span class="wordmark__pin" aria-hidden="true"></span>
          <span>RooGuessr</span>
        </a>
        <div class="site-header__actions">
          <span class="location-count">${locations.length} curated ${locations.length === 1 ? "location" : "locations"}</span>
          <a class="tool-button" href="?tool=answers">Edit answers</a>
        </div>
      </header>

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__copy">
          <p class="kicker">How well do you know the battlefield?</p>
          <h1 id="hero-title">A tiny piece of the map.<br />One precise guess.</h1>
          <p class="hero__intro">
            Study a close-up from the Dota map, drop your pin, and find out how
            close you really were.
          </p>
        </div>

        <div class="map-window" aria-hidden="true">
          <div class="map-window__grid"></div>
          <div class="map-window__river"></div>
          <div class="map-window__pin"><span></span></div>
          <div class="map-window__label">Your guess goes here</div>
        </div>
      </section>

      <section class="setup-panel" aria-labelledby="difficulty-title">
        <div class="setup-panel__heading">
          <div>
            <p class="section-number">01</p>
            <h2 id="difficulty-title">Choose your crop</h2>
          </div>
          <p>Every mode uses the same location—the harder modes simply show less of it.</p>
        </div>

        <div class="difficulty-grid">
          ${difficultyButton("easy")}
          ${difficultyButton("medium")}
          ${difficultyButton("hard")}
        </div>

        <div class="start-row">
          <button class="start-button" type="button" ${canStart ? "" : "disabled"}>
            ${canStart ? `Start ${DIFFICULTIES[selectedDifficulty].label} run` : "First locations coming soon"}
          </button>
          <p>${canStart ? "Ten locations. One final score." : "The project foundation is ready for its first map and location set."}</p>
        </div>
      </section>

      <footer>
        <span>Built in the open, one location at a time.</span>
        <span>RooGuessr</span>
      </footer>
    </main>
  `;

  app.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDifficulty = button.dataset.difficulty as Difficulty;
      render();
    });
  });
}

if (new URLSearchParams(window.location.search).get("tool") === "answers") {
  renderAnswerEditor(app, mapUrl);
} else {
  render();
}
