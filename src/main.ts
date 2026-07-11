import "./styles.css";
import mapUrl from "./assets/dota-map.webp";
import { renderAnswerEditor } from "./answer-editor";
import { locations } from "./game/locations";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("RooGuessr could not find its app container.");
}

const app: HTMLDivElement = appElement;

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

      <section class="setup-panel" aria-labelledby="run-title">
        <div class="setup-panel__heading">
          <div>
            <p class="section-number">01</p>
            <h2 id="run-title">Ready to play?</h2>
          </div>
          <p>Every run draws up to ten locations from the community-curated pool.</p>
        </div>

        <div class="start-row">
          <button class="start-button" type="button" ${canStart ? "" : "disabled"}>
            ${canStart ? "Start run" : "First locations coming soon"}
          </button>
          <p>${canStart ? `${Math.min(10, locations.length)} locations. One final score.` : "The project foundation is ready for its first map and location set."}</p>
        </div>
      </section>

      <footer>
        <span>Built in the open, one location at a time.</span>
        <span>RooGuessr</span>
      </footer>
    </main>
  `;
}

if (new URLSearchParams(window.location.search).get("tool") === "answers") {
  renderAnswerEditor(app, mapUrl);
} else {
  render();
}
