import type { NormalizedPoint } from "./game/locations";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: Number(point.x.toFixed(4)),
    y: Number(point.y.toFixed(4)),
  };
}

export function renderAnswerEditor(app: HTMLDivElement, mapUrl: string): void {
  let questionUrl: string | undefined;
  let answer: NormalizedPoint | undefined;

  app.innerHTML = `
    <main class="editor-shell">
      <header class="site-header editor-header">
        <a class="wordmark" href="/" aria-label="RooGuessr home">
          <span class="wordmark__pin" aria-hidden="true"></span>
          <span>RooGuessr</span>
        </a>
        <a class="tool-button" href="/">Back to game</a>
      </header>

      <section class="editor-intro" aria-labelledby="editor-title">
        <div>
          <p class="kicker">Location authoring</p>
          <h1 id="editor-title">Mark the answer.</h1>
        </div>
        <p>
          Choose your question image, then left-click its location on the map.
          Coordinates use <strong>(0, 0)</strong> at the bottom-left.
        </p>
      </section>

      <section class="editor-toolbar" aria-label="Question selection">
        <label for="question-file">Question image</label>
        <input id="question-file" type="file" accept=".webp,image/webp" data-question-file />
      </section>

      <section class="editor-workspace">
        <article class="editor-card">
          <div class="editor-card__heading">
            <span>Map</span>
            <span data-coordinate-label>No answer selected</span>
          </div>
          <div class="editor-map-wrap">
            <img class="editor-map" src="${mapUrl}" alt="RooGuessr map" draggable="false" />
            <div class="editor-pin" hidden aria-hidden="true"><span></span></div>
          </div>
        </article>

        <article class="editor-card">
          <div class="editor-card__heading">
            <span>Question</span>
            <span data-question-name>7:5 WebP image</span>
          </div>
          <div class="editor-question-wrap">
            <img class="editor-question" alt="Selected RooGuessr question" hidden />
            <p class="editor-empty" data-question-empty>Choose a question image from your computer.</p>
          </div>
        </article>
      </section>

      <section class="editor-save-panel">
        <div>
          <p class="section-number">answer.txt</p>
          <strong data-answer-text>—</strong>
          <p data-editor-status>Choose an image and place its pin on the map.</p>
        </div>
        <button class="start-button" type="button" data-copy-answer disabled>Copy answer.txt value</button>
      </section>

      <footer>
        <span>Paste the copied line into the location's <code>answer.txt</code> file.</span>
        <a class="editor-footer-link" href="/">Back to RooGuessr</a>
      </footer>
    </main>
  `;

  const fileInput = app.querySelector<HTMLInputElement>("[data-question-file]");
  const map = app.querySelector<HTMLImageElement>(".editor-map");
  const pin = app.querySelector<HTMLDivElement>(".editor-pin");
  const questionImage = app.querySelector<HTMLImageElement>(".editor-question");
  const questionEmpty = app.querySelector<HTMLElement>("[data-question-empty]");
  const questionName = app.querySelector<HTMLElement>("[data-question-name]");
  const coordinateLabel = app.querySelector<HTMLElement>("[data-coordinate-label]");
  const answerText = app.querySelector<HTMLElement>("[data-answer-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const copyButton = app.querySelector<HTMLButtonElement>("[data-copy-answer]");

  if (!fileInput || !map || !pin || !questionImage || !questionEmpty || !questionName || !coordinateLabel || !answerText || !status || !copyButton) {
    throw new Error("RooGuessr answer editor could not initialize.");
  }

  const updateCopyState = (): void => {
    copyButton.disabled = !questionUrl || !answer;
  };

  const updatePin = (point: NormalizedPoint | undefined): void => {
    answer = point ? roundedPoint(point) : undefined;
    pin.hidden = !answer;

    if (!answer) {
      coordinateLabel.textContent = "No answer selected";
      answerText.textContent = "—";
    } else {
      pin.style.left = `${answer.x * 100}%`;
      pin.style.top = `${(1 - answer.y) * 100}%`;
      coordinateLabel.textContent = `X ${answer.x.toFixed(4)} · Y ${answer.y.toFixed(4)}`;
      answerText.textContent = `${answer.x.toFixed(4)}, ${answer.y.toFixed(4)}`;
    }

    updateCopyState();
  };

  const clearQuestionUrl = (): void => {
    if (questionUrl) URL.revokeObjectURL(questionUrl);
    questionUrl = undefined;
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    clearQuestionUrl();
    updatePin(undefined);

    if (!file) {
      questionImage.removeAttribute("src");
      questionImage.hidden = true;
      questionEmpty.hidden = false;
      questionName.textContent = "7:5 WebP image";
      status.textContent = "Choose an image and place its pin on the map.";
      return;
    }

    questionUrl = URL.createObjectURL(file);
    questionImage.src = questionUrl;
    questionImage.hidden = false;
    questionEmpty.hidden = true;
    questionName.textContent = file.name;
    status.textContent = "Now click the matching location on the map.";
    updateCopyState();
  });

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || !questionUrl) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    status.textContent = "Answer ready. Copy the value when the pin is correct.";
  });

  copyButton.addEventListener("click", async () => {
    if (!answer) return;
    const value = `${answer.x.toFixed(4)}, ${answer.y.toFixed(4)}`;

    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = "Copied!";
      status.textContent = "Copied. Paste this line into the location's answer.txt file.";
      window.setTimeout(() => {
        copyButton.textContent = "Copy answer.txt value";
      }, 1600);
    } catch {
      status.textContent = "Clipboard access failed. Select and copy the answer.txt value shown here.";
    }
  });

  window.addEventListener("pagehide", clearQuestionUrl, { once: true });
}
