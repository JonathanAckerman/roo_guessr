import { strToU8, zipSync } from "fflate";
import type { NormalizedPoint } from "./game/locations";

const QUESTION_WIDTH = 1400;
const QUESTION_HEIGHT = 1000;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: Number(point.x.toFixed(4)),
    y: Number(point.y.toFixed(4)),
  };
}

function formatAnswer(answer: NormalizedPoint): string {
  return `${answer.x.toFixed(4)}, ${answer.y.toFixed(4)}`;
}

async function convertToQuestionWebp(file: File): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = sourceUrl;

  try {
    await image.decode();

    const targetRatio = QUESTION_WIDTH / QUESTION_HEIGHT;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = QUESTION_WIDTH;
    canvas.height = QUESTION_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the question image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      QUESTION_WIDTH,
      QUESTION_HEIGHT,
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob || blob.type !== "image/webp") {
      throw new Error("This browser could not convert the image to WebP.");
    }

    return blob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderAnswerEditor(app: HTMLDivElement, mapUrl: string): void {
  let questionBlob: Blob | undefined;
  let questionUrl: string | undefined;
  let locationId: string | undefined;
  let answer: NormalizedPoint | undefined;
  let selectionVersion = 0;

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
          <p class="kicker">Location builder</p>
          <h1 id="editor-title">Build a location.</h1>
        </div>
        <p>
          Choose a screenshot, mark its location, and download a ready-to-commit
          RooGuessr folder. Coordinates use <strong>(0, 0)</strong> at the bottom-left.
        </p>
      </section>

      <section class="editor-toolbar" aria-label="Question selection">
        <label for="question-file">Source image</label>
        <input
          id="question-file"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          data-question-file
        />
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
            <span>Final question.webp</span>
            <span data-question-name>${QUESTION_WIDTH}×${QUESTION_HEIGHT}</span>
          </div>
          <div class="editor-question-wrap">
            <img class="editor-question" alt="Converted RooGuessr question" hidden />
            <p class="editor-empty" data-question-empty>Choose a PNG, JPG, or WebP image from your computer.</p>
          </div>
        </article>
      </section>

      <section class="editor-save-panel">
        <div>
          <p class="section-number">Generated location</p>
          <strong data-location-id>—</strong>
          <p><code>answer.txt</code>: <span data-answer-text>—</span></p>
          <p data-editor-status>Choose an image to begin.</p>
        </div>
        <div class="editor-actions">
          <button class="tool-button" type="button" data-copy-answer disabled>Copy answer</button>
          <button class="start-button" type="button" data-download-location disabled>Download location ZIP</button>
        </div>
      </section>

      <footer>
        <span>Extract the downloaded UUID folder into <code>src/locations/</code>.</span>
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
  const locationIdText = app.querySelector<HTMLElement>("[data-location-id]");
  const answerText = app.querySelector<HTMLElement>("[data-answer-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const copyButton = app.querySelector<HTMLButtonElement>("[data-copy-answer]");
  const downloadButton = app.querySelector<HTMLButtonElement>("[data-download-location]");

  if (!fileInput || !map || !pin || !questionImage || !questionEmpty || !questionName || !coordinateLabel || !locationIdText || !answerText || !status || !copyButton || !downloadButton) {
    throw new Error("RooGuessr location builder could not initialize.");
  }

  const updateActionState = (): void => {
    const ready = Boolean(questionBlob && locationId && answer);
    copyButton.disabled = !ready;
    downloadButton.disabled = !ready;
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
      answerText.textContent = formatAnswer(answer);
    }

    updateActionState();
  };

  const clearQuestion = (): void => {
    if (questionUrl) URL.revokeObjectURL(questionUrl);
    questionBlob = undefined;
    questionUrl = undefined;
    locationId = undefined;
    questionImage.removeAttribute("src");
    questionImage.hidden = true;
    questionEmpty.hidden = false;
    questionName.textContent = `${QUESTION_WIDTH}×${QUESTION_HEIGHT}`;
    locationIdText.textContent = "—";
    updatePin(undefined);
  };

  const prepareFile = async (file: File): Promise<void> => {
    const version = ++selectionVersion;
    clearQuestion();
    fileInput.disabled = true;
    status.textContent = "Converting to WebP…";

    try {
      const convertedBlob = await convertToQuestionWebp(file);
      if (version !== selectionVersion) return;

      questionBlob = convertedBlob;
      questionUrl = URL.createObjectURL(convertedBlob);
      locationId = crypto.randomUUID();
      questionImage.src = questionUrl;
      questionImage.hidden = false;
      questionEmpty.hidden = true;
      questionName.textContent = `${file.name} → ${QUESTION_WIDTH}×${QUESTION_HEIGHT} WebP`;
      locationIdText.textContent = locationId;
      status.textContent = "Image ready. Click the matching location on the map.";
      updateActionState();
    } catch (error) {
      fileInput.value = "";
      status.textContent = error instanceof Error ? error.message : "The image could not be prepared.";
    } finally {
      if (version === selectionVersion) fileInput.disabled = false;
    }
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      void prepareFile(file);
    } else {
      clearQuestion();
      status.textContent = "Choose an image to begin.";
    }
  });

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || !questionBlob) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    status.textContent = "Location ready. Download the ZIP when the pin is correct.";
  });

  copyButton.addEventListener("click", async () => {
    if (!answer) return;

    try {
      await navigator.clipboard.writeText(formatAnswer(answer));
      copyButton.textContent = "Copied!";
      status.textContent = "Copied the answer.txt coordinate.";
      window.setTimeout(() => {
        copyButton.textContent = "Copy answer";
      }, 1600);
    } catch {
      status.textContent = "Clipboard access failed. Select and copy the answer shown here.";
    }
  });

  downloadButton.addEventListener("click", async () => {
    if (!questionBlob || !locationId || !answer) return;
    downloadButton.disabled = true;
    status.textContent = "Building location ZIP…";

    try {
      const directory = `${locationId}/`;
      const archive = zipSync({
        [`${directory}question.webp`]: new Uint8Array(await questionBlob.arrayBuffer()),
        [`${directory}answer.txt`]: strToU8(`${formatAnswer(answer)}\r\n`),
      }, { level: 0 });
      const archiveBuffer = archive.slice().buffer as ArrayBuffer;
      downloadBlob(new Blob([archiveBuffer], { type: "application/zip" }), `${locationId}.zip`);
      status.textContent = `Downloaded ${locationId}.zip. Extract its folder into src/locations/.`;
    } catch {
      status.textContent = "The location ZIP could not be created.";
    } finally {
      updateActionState();
    }
  });

  window.addEventListener("pagehide", () => {
    selectionVersion += 1;
    if (questionUrl) URL.revokeObjectURL(questionUrl);
  }, { once: true });
}
