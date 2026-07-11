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

function render(): void {
  const canStart = locations.length > 0;

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
            <button class="start-button" type="button" data-start-game ${canStart ? "" : "disabled"}>
              Start Game
            </button>
          </div>
        </div>
      </section>
    </main>
  `;

  app.querySelector<HTMLButtonElement>("[data-start-game]")?.addEventListener("click", () => {
    renderGame(app, mapUrl, locations);
  });
}

if (new URLSearchParams(window.location.search).get("tool") === "answers") {
  renderAnswerEditor(app, mapUrl);
} else {
  render();
}
