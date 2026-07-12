import { strToU8, zipSync } from "fflate";
import { marked } from "marked";
import readmeMarkdown from "../README.md?raw";
import type { NormalizedPoint } from "./game/locations";

const QUESTION_WIDTH = 1400;
const QUESTION_HEIGHT = 1000;
const CROP_PREVIEW_WIDTH = 700;
const CROP_PREVIEW_HEIGHT = 500;
const howToHtml = marked(readmeMarkdown, { async: false, gfm: true });

type ImageKind = "question" | "answer";

interface SourceImage {
  image: HTMLImageElement;
  url: string;
  name: string;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
}

interface CropState {
  source?: SourceImage;
  selectionVersion: number;
  dragging: boolean;
  grabX: number;
  grabY: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampBetween(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: Number(point.x.toFixed(4)),
    y: Number(point.y.toFixed(4)),
  };
}

function formatPin(pin: NormalizedPoint): string {
  return `${pin.x.toFixed(4)}, ${pin.y.toFixed(4)}`;
}

function imageKindLabel(kind: ImageKind): string {
  return kind === "question" ? "Question" : "Answer";
}

async function loadSourceImage(file: File): Promise<SourceImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("The selected file could not be read as an image.");
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < QUESTION_WIDTH || height < QUESTION_HEIGHT) {
    URL.revokeObjectURL(url);
    throw new Error(
      `This image is ${width}×${height}. It must be at least ${QUESTION_WIDTH}×${QUESTION_HEIGHT}.`,
    );
  }

  return {
    image,
    url,
    name: file.name,
    width,
    height,
    cropX: Math.floor((width - QUESTION_WIDTH) / 2),
    cropY: Math.floor((height - QUESTION_HEIGHT) / 2),
  };
}

async function cropToWebp(source: SourceImage, label: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = QUESTION_WIDTH;
  canvas.height = QUESTION_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`This browser could not prepare the ${label.toLowerCase()} image.`);

  context.drawImage(
    source.image,
    source.cropX,
    source.cropY,
    QUESTION_WIDTH,
    QUESTION_HEIGHT,
    0,
    0,
    QUESTION_WIDTH,
    QUESTION_HEIGHT,
  );

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob || blob.type !== "image/webp") {
    throw new Error(`This browser could not convert the ${label.toLowerCase()} crop to WebP.`);
  }

  return blob;
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
  const cropStates: Record<ImageKind, CropState> = {
    question: {
      selectionVersion: 0,
      dragging: false,
      grabX: QUESTION_WIDTH / 2,
      grabY: QUESTION_HEIGHT / 2,
    },
    answer: {
      selectionVersion: 0,
      dragging: false,
      grabX: QUESTION_WIDTH / 2,
      grabY: QUESTION_HEIGHT / 2,
    },
  };
  let locationId: string | undefined;
  let answer: NormalizedPoint | undefined;

  app.innerHTML = `
    <main class="site-shell editor-shell">
      <header class="site-header editor-header">
        <a class="wordmark" href="/" aria-label="RooGuessr home">
          <span class="wordmark__pin" aria-hidden="true"></span>
          <span>RooGuessr</span>
        </a>
        <button class="tool-button" type="button" data-how-to-open>How To</button>
      </header>

      <section class="editor-intro" aria-labelledby="editor-title">
        <p class="kicker hero__question" id="editor-title">Location builder</p>
        <p>
          Choose question and answer screenshots, select each ${QUESTION_WIDTH}×${QUESTION_HEIGHT} crop,
          mark the location, and download a ready-to-commit ZIP.
        </p>
      </section>

      <section class="editor-workspace">
        <article class="editor-card">
          <div class="editor-card__heading">
            <span>Place an answer pin</span>
            <span data-coordinate-label>No answer selected</span>
          </div>
          <div class="editor-map-wrap">
            <img class="editor-map" src="${mapUrl}" alt="RooGuessr map" draggable="false" />
            <div class="editor-pin" hidden aria-hidden="true"><span></span></div>
          </div>
        </article>

        <article class="editor-card editor-crop-card" data-crop-panel="question">
          <div class="editor-card__heading editor-crop-heading">
            <span>Question crop</span>
            <span data-crop-name="question">${QUESTION_WIDTH}×${QUESTION_HEIGHT}</span>
          </div>
          <div class="editor-source-control">
            <label for="question-file">Question image</label>
            <input
              id="question-file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              data-image-file="question"
            />
            <p class="editor-file-error" data-image-error="question" hidden></p>
          </div>
          <div class="editor-question-wrap">
            <canvas
              class="editor-crop-canvas"
              width="${CROP_PREVIEW_WIDTH}"
              height="${CROP_PREVIEW_HEIGHT}"
              role="img"
              aria-label="Question crop selector"
              data-crop-canvas="question"
              hidden
            ></canvas>
            <p class="editor-empty" data-crop-empty="question">Choose a question image to begin.</p>
          </div>
          <p class="editor-crop-note" data-crop-note="question" hidden></p>
        </article>

        <article class="editor-card editor-crop-card" data-crop-panel="answer">
          <div class="editor-card__heading editor-crop-heading">
            <span>Answer crop</span>
            <span data-crop-name="answer">${QUESTION_WIDTH}×${QUESTION_HEIGHT}</span>
          </div>
          <div class="editor-source-control">
            <label for="answer-file">Answer image</label>
            <input
              id="answer-file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              data-image-file="answer"
            />
            <p class="editor-file-error" data-image-error="answer" hidden></p>
          </div>
          <div class="editor-question-wrap">
            <canvas
              class="editor-crop-canvas"
              width="${CROP_PREVIEW_WIDTH}"
              height="${CROP_PREVIEW_HEIGHT}"
              role="img"
              aria-label="Answer crop selector"
              data-crop-canvas="answer"
              hidden
            ></canvas>
            <p class="editor-empty" data-crop-empty="answer">Choose an answer image to begin.</p>
          </div>
          <p class="editor-crop-note" data-crop-note="answer" hidden></p>
        </article>
      </section>

      <section class="editor-save-panel">
        <div>
          <p class="section-number">Generated location</p>
          <strong data-location-id>—</strong>
          <p><code>pin.txt</code>: <span data-pin-text>—</span></p>
          <p data-editor-status>Choose a question image and an answer image to begin.</p>
        </div>
        <div class="editor-actions">
          <button class="tool-button" type="button" data-reset-editor disabled>Reset</button>
          <button class="tool-button" type="button" data-copy-answer disabled>Copy pin</button>
          <button class="start-button" type="button" data-download-location disabled>Export ZIP</button>
        </div>
      </section>

      <footer class="editor-footer">
        <span>Extract the ZIP into <code>src/locations/&lt;zip-name&gt;/</code>.</span>
      </footer>
    </main>

    <dialog class="how-to-dialog" aria-labelledby="how-to-dialog-title" data-how-to-dialog>
      <div class="how-to-dialog__panel">
        <header class="how-to-dialog__header">
          <span class="kicker" id="how-to-dialog-title">How To</span>
          <button
            class="how-to-dialog__close"
            type="button"
            aria-label="Close how-to guide"
            data-how-to-close
          >&times;</button>
        </header>
        <article class="how-to-dialog__content">
          ${howToHtml}
        </article>
      </div>
    </dialog>
  `;

  const fileInputs: Record<ImageKind, HTMLInputElement | null> = {
    question: app.querySelector<HTMLInputElement>('[data-image-file="question"]'),
    answer: app.querySelector<HTMLInputElement>('[data-image-file="answer"]'),
  };
  const fileErrors: Record<ImageKind, HTMLElement | null> = {
    question: app.querySelector<HTMLElement>('[data-image-error="question"]'),
    answer: app.querySelector<HTMLElement>('[data-image-error="answer"]'),
  };
  const cropCanvases: Record<ImageKind, HTMLCanvasElement | null> = {
    question: app.querySelector<HTMLCanvasElement>('[data-crop-canvas="question"]'),
    answer: app.querySelector<HTMLCanvasElement>('[data-crop-canvas="answer"]'),
  };
  const cropNotes: Record<ImageKind, HTMLElement | null> = {
    question: app.querySelector<HTMLElement>('[data-crop-note="question"]'),
    answer: app.querySelector<HTMLElement>('[data-crop-note="answer"]'),
  };
  const cropEmpties: Record<ImageKind, HTMLElement | null> = {
    question: app.querySelector<HTMLElement>('[data-crop-empty="question"]'),
    answer: app.querySelector<HTMLElement>('[data-crop-empty="answer"]'),
  };
  const cropNames: Record<ImageKind, HTMLElement | null> = {
    question: app.querySelector<HTMLElement>('[data-crop-name="question"]'),
    answer: app.querySelector<HTMLElement>('[data-crop-name="answer"]'),
  };
  const map = app.querySelector<HTMLImageElement>(".editor-map");
  const pin = app.querySelector<HTMLDivElement>(".editor-pin");
  const coordinateLabel = app.querySelector<HTMLElement>("[data-coordinate-label]");
  const locationIdText = app.querySelector<HTMLElement>("[data-location-id]");
  const pinText = app.querySelector<HTMLElement>("[data-pin-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const resetButton = app.querySelector<HTMLButtonElement>("[data-reset-editor]");
  const copyButton = app.querySelector<HTMLButtonElement>("[data-copy-answer]");
  const downloadButton = app.querySelector<HTMLButtonElement>("[data-download-location]");
  const howToOpenButton = app.querySelector<HTMLButtonElement>("[data-how-to-open]");
  const howToDialog = app.querySelector<HTMLDialogElement>("[data-how-to-dialog]");
  const howToCloseButton = app.querySelector<HTMLButtonElement>("[data-how-to-close]");

  if (
    !fileInputs.question
    || !fileInputs.answer
    || !fileErrors.question
    || !fileErrors.answer
    || !cropCanvases.question
    || !cropCanvases.answer
    || !cropNotes.question
    || !cropNotes.answer
    || !cropEmpties.question
    || !cropEmpties.answer
    || !cropNames.question
    || !cropNames.answer
    || !map
    || !pin
    || !coordinateLabel
    || !locationIdText
    || !pinText
    || !status
    || !resetButton
    || !copyButton
    || !downloadButton
    || !howToOpenButton
    || !howToDialog
    || !howToCloseButton
  ) {
    throw new Error("RooGuessr location builder could not initialize.");
  }

  const imageInputs = fileInputs as Record<ImageKind, HTMLInputElement>;
  const imageErrors = fileErrors as Record<ImageKind, HTMLElement>;
  const imageCanvases = cropCanvases as Record<ImageKind, HTMLCanvasElement>;
  const imageCropNotes = cropNotes as Record<ImageKind, HTMLElement>;
  const imageCropEmpties = cropEmpties as Record<ImageKind, HTMLElement>;
  const imageCropNames = cropNames as Record<ImageKind, HTMLElement>;

  howToOpenButton.addEventListener("click", () => {
    howToDialog.showModal();
    document.documentElement.classList.add("how-to-open");
  });

  howToCloseButton.addEventListener("click", () => howToDialog.close());

  howToDialog.addEventListener("click", (event) => {
    if (event.target === howToDialog) howToDialog.close();
  });

  howToDialog.addEventListener("close", () => {
    document.documentElement.classList.remove("how-to-open");
  });

  const setStatus = (message: string, error = false): void => {
    status.textContent = message;
    status.classList.toggle("editor-status--error", error);
  };

  const setFileError = (kind: ImageKind, message?: string): void => {
    const error = imageErrors[kind];
    error.textContent = message ?? "";
    error.hidden = !message;
  };

  const updateActionState = (): void => {
    resetButton.disabled = !cropStates.question.source
      && !cropStates.answer.source
      && !locationId
      && !answer;
    copyButton.disabled = !answer;
    downloadButton.disabled = !(
      cropStates.question.source
      && cropStates.answer.source
      && locationId
      && answer
    );
  };

  const updatePin = (point: NormalizedPoint | undefined): void => {
    answer = point ? roundedPoint(point) : undefined;
    pin.hidden = !answer;

    if (!answer) {
      coordinateLabel.textContent = "No answer selected";
      pinText.textContent = "—";
    } else {
      pin.style.left = `${answer.x * 100}%`;
      pin.style.top = `${(1 - answer.y) * 100}%`;
      coordinateLabel.textContent = `X ${answer.x.toFixed(4)} · Y ${answer.y.toFixed(4)}`;
      pinText.textContent = formatPin(answer);
    }

    updateActionState();
  };

  const previewMetrics = (canvas: HTMLCanvasElement, source: SourceImage): {
    scale: number;
    imageX: number;
    imageY: number;
    imageWidth: number;
    imageHeight: number;
  } => {
    const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
    const imageWidth = source.width * scale;
    const imageHeight = source.height * scale;
    return {
      scale,
      imageX: (canvas.width - imageWidth) / 2,
      imageY: (canvas.height - imageHeight) / 2,
      imageWidth,
      imageHeight,
    };
  };

  const drawCropPreview = (kind: ImageKind): void => {
    const source = cropStates[kind].source;
    if (!source) return;
    const canvas = imageCanvases[kind];
    const context = canvas.getContext("2d");
    if (!context) return;
    const metrics = previewMetrics(canvas, source);
    const cropLeft = metrics.imageX + source.cropX * metrics.scale;
    const cropTop = metrics.imageY + source.cropY * metrics.scale;
    const cropWidth = QUESTION_WIDTH * metrics.scale;
    const cropHeight = QUESTION_HEIGHT * metrics.scale;

    context.fillStyle = "#050a08";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source.image, metrics.imageX, metrics.imageY, metrics.imageWidth, metrics.imageHeight);
    context.fillStyle = "rgba(0, 0, 0, 0.62)";
    context.fillRect(metrics.imageX, metrics.imageY, metrics.imageWidth, metrics.imageHeight);
    context.drawImage(
      source.image,
      source.cropX,
      source.cropY,
      QUESTION_WIDTH,
      QUESTION_HEIGHT,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
    );
    context.strokeStyle = "#ffe0c0";
    context.lineWidth = 3;
    context.strokeRect(cropLeft + 1.5, cropTop + 1.5, cropWidth - 3, cropHeight - 3);
  };

  const updateCropNote = (kind: ImageKind): void => {
    const source = cropStates[kind].source;
    if (!source) return;
    imageCropNotes[kind].textContent = source.width === QUESTION_WIDTH && source.height === QUESTION_HEIGHT
      ? "This image already matches the 1400×1000 crop."
      : `Drag the 1400×1000 box to choose the exported crop. Offset: ${source.cropX}px left, ${source.cropY}px top.`;
  };

  const setCrop = (kind: ImageKind, x: number, y: number): void => {
    const source = cropStates[kind].source;
    if (!source) return;
    source.cropX = Math.round(clampBetween(x, 0, source.width - QUESTION_WIDTH));
    source.cropY = Math.round(clampBetween(y, 0, source.height - QUESTION_HEIGHT));
    updateCropNote(kind);
    drawCropPreview(kind);
  };

  const renderCrop = (kind: ImageKind): void => {
    const source = cropStates[kind].source;
    const canvas = imageCanvases[kind];
    const note = imageCropNotes[kind];
    const empty = imageCropEmpties[kind];
    const name = imageCropNames[kind];

    canvas.hidden = !source;
    note.hidden = !source;
    empty.hidden = Boolean(source);

    if (!source) {
      name.textContent = `${QUESTION_WIDTH}×${QUESTION_HEIGHT}`;
      empty.textContent = `Choose ${kind === "question" ? "a" : "an"} ${kind} image to begin.`;
      return;
    }

    name.textContent = `${source.name} · ${source.width}×${source.height}`;
    updateCropNote(kind);
    drawCropPreview(kind);
  };

  const clearImage = (kind: ImageKind): void => {
    const state = cropStates[kind];
    if (state.source) URL.revokeObjectURL(state.source.url);
    state.source = undefined;
    state.dragging = false;
    if (!cropStates.question.source && !cropStates.answer.source) {
      locationId = undefined;
      locationIdText.textContent = "—";
      updatePin(undefined);
    }
    renderCrop(kind);
    updateActionState();
  };

  const resetEditor = (message: string): void => {
    for (const kind of ["question", "answer"] as const) {
      cropStates[kind].selectionVersion += 1;
      imageInputs[kind].disabled = false;
      imageInputs[kind].value = "";
      setFileError(kind);
      clearImage(kind);
    }
    copyButton.textContent = "Copy pin";
    setStatus(message);
  };

  const describeNextStep = (): void => {
    if (!cropStates.question.source && !cropStates.answer.source) {
      setStatus("Choose a question image and an answer image to begin.");
    } else if (!cropStates.question.source) {
      setStatus("Choose the question image.");
    } else if (!cropStates.answer.source) {
      setStatus("Choose the answer image.");
    } else if (!answer) {
      setStatus("Position both crops, then click the matching location on the map.");
    } else {
      setStatus("Location ready. Export the ZIP when both crops and the pin are correct.");
    }
  };

  const prepareFile = async (kind: ImageKind, file: File): Promise<void> => {
    const state = cropStates[kind];
    const input = imageInputs[kind];
    const version = ++state.selectionVersion;
    clearImage(kind);
    setFileError(kind);
    input.disabled = true;
    setStatus(`Reading ${kind} image…`);

    try {
      const loadedImage = await loadSourceImage(file);
      if (version !== state.selectionVersion) {
        URL.revokeObjectURL(loadedImage.url);
        return;
      }

      state.source = loadedImage;
      locationId ??= crypto.randomUUID();
      locationIdText.textContent = locationId;
      setCrop(kind, loadedImage.cropX, loadedImage.cropY);
      renderCrop(kind);
      describeNextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The image could not be prepared.";
      input.value = "";
      setFileError(kind, message);
      setStatus(`${imageKindLabel(kind)} image: ${message}`, true);
    } finally {
      if (version === state.selectionVersion) input.disabled = false;
      updateActionState();
    }
  };

  const sourcePointFromPointer = (
    kind: ImageKind,
    event: PointerEvent,
  ): { x: number; y: number } | undefined => {
    const source = cropStates[kind].source;
    if (!source) return;
    const canvas = imageCanvases[kind];
    const bounds = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const canvasY = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const metrics = previewMetrics(canvas, source);
    return {
      x: (canvasX - metrics.imageX) / metrics.scale,
      y: (canvasY - metrics.imageY) / metrics.scale,
    };
  };

  const updateCropFromPointer = (kind: ImageKind, event: PointerEvent): void => {
    const state = cropStates[kind];
    const point = sourcePointFromPointer(kind, event);
    if (point) setCrop(kind, point.x - state.grabX, point.y - state.grabY);
  };

  for (const kind of ["question", "answer"] as const) {
    const canvas = imageCanvases[kind];

    imageInputs[kind].addEventListener("change", () => {
      const file = imageInputs[kind].files?.[0];
      if (file) {
        void prepareFile(kind, file);
      } else {
        clearImage(kind);
        setFileError(kind);
        describeNextStep();
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      const state = cropStates[kind];
      const source = state.source;
      if (!source) return;
      const point = sourcePointFromPointer(kind, event);
      if (!point) return;
      const insideCrop = point.x >= source.cropX
        && point.x <= source.cropX + QUESTION_WIDTH
        && point.y >= source.cropY
        && point.y <= source.cropY + QUESTION_HEIGHT;
      state.grabX = insideCrop ? point.x - source.cropX : QUESTION_WIDTH / 2;
      state.grabY = insideCrop ? point.y - source.cropY : QUESTION_HEIGHT / 2;
      state.dragging = true;
      canvas.setPointerCapture(event.pointerId);
      updateCropFromPointer(kind, event);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (cropStates[kind].dragging) updateCropFromPointer(kind, event);
    });

    canvas.addEventListener("pointerup", (event) => {
      cropStates[kind].dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointercancel", () => {
      cropStates[kind].dragging = false;
    });
  }

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || (!cropStates.question.source && !cropStates.answer.source)) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    describeNextStep();
  });

  resetButton.addEventListener("click", () => {
    resetEditor("Editor reset. Choose a question image and an answer image to begin.");
  });

  copyButton.addEventListener("click", async () => {
    if (!answer) return;

    try {
      await navigator.clipboard.writeText(formatPin(answer));
      copyButton.textContent = "Copied!";
      setStatus("Copied the pin.txt coordinate.");
      window.setTimeout(() => {
        copyButton.textContent = "Copy pin";
      }, 1600);
    } catch {
      setStatus("Clipboard access failed. Select and copy the answer shown here.", true);
    }
  });

  downloadButton.addEventListener("click", async () => {
    const questionSource = cropStates.question.source;
    const answerSource = cropStates.answer.source;
    if (!questionSource || !answerSource || !locationId || !answer) return;
    const exportedLocationId = locationId;
    downloadButton.disabled = true;
    setStatus("Building location ZIP…");

    try {
      const [questionBlob, answerBlob] = await Promise.all([
        cropToWebp(questionSource, "Question"),
        cropToWebp(answerSource, "Answer"),
      ]);
      const archive = zipSync({
        "question.webp": new Uint8Array(await questionBlob.arrayBuffer()),
        "answer.webp": new Uint8Array(await answerBlob.arrayBuffer()),
        "pin.txt": strToU8(`${formatPin(answer)}\r\n`),
      }, { level: 0 });
      const archiveBuffer = archive.slice().buffer as ArrayBuffer;
      downloadBlob(new Blob([archiveBuffer], { type: "application/zip" }), `${exportedLocationId}.zip`);

      resetEditor(`Downloaded ${exportedLocationId}.zip. Choose new images to build another location.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The location ZIP could not be created.", true);
    } finally {
      updateActionState();
    }
  });

  window.addEventListener("pagehide", () => {
    for (const kind of ["question", "answer"] as const) {
      cropStates[kind].selectionVersion += 1;
      if (cropStates[kind].source) URL.revokeObjectURL(cropStates[kind].source.url);
    }
  }, { once: true });
}
