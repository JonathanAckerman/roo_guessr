import { strToU8, zipSync } from "fflate";
import type { NormalizedPoint } from "./game/locations";

const QUESTION_WIDTH = 1400;
const QUESTION_HEIGHT = 1000;
const CROP_PREVIEW_WIDTH = 700;
const CROP_PREVIEW_HEIGHT = 500;

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

function formatAnswer(answer: NormalizedPoint): string {
  return `${answer.x.toFixed(4)}, ${answer.y.toFixed(4)}`;
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
  let activeKind: ImageKind = "question";
  let locationId: string | undefined;
  let answer: NormalizedPoint | undefined;

  app.innerHTML = `
    <main class="site-shell editor-shell">
      <header class="site-header editor-header">
        <a class="wordmark" href="/" aria-label="RooGuessr home">
          <span class="wordmark__pin" aria-hidden="true"></span>
          <span>RooGuessr</span>
        </a>
      </header>

      <section class="editor-intro" aria-labelledby="editor-title">
        <p class="kicker hero__question" id="editor-title">Location builder</p>
        <p>
          Choose question and answer screenshots, select each ${QUESTION_WIDTH}×${QUESTION_HEIGHT} crop,
          mark the location, and download a ready-to-commit ZIP.
        </p>
      </section>

      <section class="editor-toolbar" aria-label="Location images">
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

        <article class="editor-card editor-crop-card">
          <div class="editor-card__heading editor-crop-heading">
            <div class="editor-crop-tabs" role="tablist" aria-label="Crop to edit">
              <button
                class="editor-crop-tab editor-crop-tab--active"
                type="button"
                role="tab"
                aria-selected="true"
                data-crop-tab="question"
              >Question crop</button>
              <button
                class="editor-crop-tab"
                type="button"
                role="tab"
                aria-selected="false"
                data-crop-tab="answer"
              >Answer crop</button>
            </div>
            <span data-crop-name>${QUESTION_WIDTH}×${QUESTION_HEIGHT}</span>
          </div>
          <div class="editor-question-wrap">
            <canvas
              class="editor-crop-canvas"
              width="${CROP_PREVIEW_WIDTH}"
              height="${CROP_PREVIEW_HEIGHT}"
              role="img"
              aria-label="Question crop selector"
              data-crop-canvas
              hidden
            ></canvas>
            <p class="editor-empty" data-crop-empty>Choose a question image to begin.</p>
          </div>
          <p class="editor-crop-note" data-crop-note hidden></p>
        </article>
      </section>

      <section class="editor-save-panel">
        <div>
          <p class="section-number">Generated location</p>
          <strong data-location-id>—</strong>
          <p><code>answer.txt</code>: <span data-answer-text>—</span></p>
          <p data-editor-status>Choose a question image and an answer image to begin.</p>
        </div>
        <div class="editor-actions">
          <button class="tool-button" type="button" data-copy-answer disabled>Copy answer</button>
          <button class="start-button" type="button" data-download-location disabled>Export ZIP</button>
        </div>
      </section>

      <footer class="editor-footer">
        <span>Extract the ZIP into <code>src/locations/&lt;zip-name&gt;/</code>.</span>
      </footer>
    </main>
  `;

  const fileInputs: Record<ImageKind, HTMLInputElement | null> = {
    question: app.querySelector<HTMLInputElement>('[data-image-file="question"]'),
    answer: app.querySelector<HTMLInputElement>('[data-image-file="answer"]'),
  };
  const fileErrors: Record<ImageKind, HTMLElement | null> = {
    question: app.querySelector<HTMLElement>('[data-image-error="question"]'),
    answer: app.querySelector<HTMLElement>('[data-image-error="answer"]'),
  };
  const cropTabs: Record<ImageKind, HTMLButtonElement | null> = {
    question: app.querySelector<HTMLButtonElement>('[data-crop-tab="question"]'),
    answer: app.querySelector<HTMLButtonElement>('[data-crop-tab="answer"]'),
  };
  const map = app.querySelector<HTMLImageElement>(".editor-map");
  const pin = app.querySelector<HTMLDivElement>(".editor-pin");
  const cropCanvas = app.querySelector<HTMLCanvasElement>("[data-crop-canvas]");
  const cropNote = app.querySelector<HTMLElement>("[data-crop-note]");
  const cropEmpty = app.querySelector<HTMLElement>("[data-crop-empty]");
  const cropName = app.querySelector<HTMLElement>("[data-crop-name]");
  const coordinateLabel = app.querySelector<HTMLElement>("[data-coordinate-label]");
  const locationIdText = app.querySelector<HTMLElement>("[data-location-id]");
  const answerText = app.querySelector<HTMLElement>("[data-answer-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const copyButton = app.querySelector<HTMLButtonElement>("[data-copy-answer]");
  const downloadButton = app.querySelector<HTMLButtonElement>("[data-download-location]");

  if (
    !fileInputs.question
    || !fileInputs.answer
    || !fileErrors.question
    || !fileErrors.answer
    || !cropTabs.question
    || !cropTabs.answer
    || !map
    || !pin
    || !cropCanvas
    || !cropNote
    || !cropEmpty
    || !cropName
    || !coordinateLabel
    || !locationIdText
    || !answerText
    || !status
    || !copyButton
    || !downloadButton
  ) {
    throw new Error("RooGuessr location builder could not initialize.");
  }

  const imageInputs = fileInputs as Record<ImageKind, HTMLInputElement>;
  const imageErrors = fileErrors as Record<ImageKind, HTMLElement>;
  const imageTabs = cropTabs as Record<ImageKind, HTMLButtonElement>;

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
      answerText.textContent = "—";
    } else {
      pin.style.left = `${answer.x * 100}%`;
      pin.style.top = `${(1 - answer.y) * 100}%`;
      coordinateLabel.textContent = `X ${answer.x.toFixed(4)} · Y ${answer.y.toFixed(4)}`;
      answerText.textContent = formatAnswer(answer);
    }

    updateActionState();
  };

  const previewMetrics = (source: SourceImage): {
    scale: number;
    imageX: number;
    imageY: number;
    imageWidth: number;
    imageHeight: number;
  } => {
    const scale = Math.min(cropCanvas.width / source.width, cropCanvas.height / source.height);
    const imageWidth = source.width * scale;
    const imageHeight = source.height * scale;
    return {
      scale,
      imageX: (cropCanvas.width - imageWidth) / 2,
      imageY: (cropCanvas.height - imageHeight) / 2,
      imageWidth,
      imageHeight,
    };
  };

  const drawCropPreview = (): void => {
    const source = cropStates[activeKind].source;
    if (!source) return;
    const context = cropCanvas.getContext("2d");
    if (!context) return;
    const metrics = previewMetrics(source);
    const cropLeft = metrics.imageX + source.cropX * metrics.scale;
    const cropTop = metrics.imageY + source.cropY * metrics.scale;
    const cropWidth = QUESTION_WIDTH * metrics.scale;
    const cropHeight = QUESTION_HEIGHT * metrics.scale;

    context.fillStyle = "#050a08";
    context.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
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

  const updateCropNote = (): void => {
    const source = cropStates[activeKind].source;
    if (!source) return;
    cropNote.textContent = source.width === QUESTION_WIDTH && source.height === QUESTION_HEIGHT
      ? "This image already matches the 1400×1000 crop."
      : `Drag the 1400×1000 box to choose the exported crop. Offset: ${source.cropX}px left, ${source.cropY}px top.`;
  };

  const setCrop = (kind: ImageKind, x: number, y: number): void => {
    const source = cropStates[kind].source;
    if (!source) return;
    source.cropX = Math.round(clampBetween(x, 0, source.width - QUESTION_WIDTH));
    source.cropY = Math.round(clampBetween(y, 0, source.height - QUESTION_HEIGHT));
    if (kind === activeKind) {
      updateCropNote();
      drawCropPreview();
    }
  };

  const renderActiveCrop = (): void => {
    const source = cropStates[activeKind].source;
    const label = imageKindLabel(activeKind);

    for (const kind of ["question", "answer"] as const) {
      const selected = kind === activeKind;
      imageTabs[kind].classList.toggle("editor-crop-tab--active", selected);
      imageTabs[kind].setAttribute("aria-selected", String(selected));
      imageTabs[kind].classList.toggle("editor-crop-tab--ready", Boolean(cropStates[kind].source));
    }

    cropCanvas.setAttribute("aria-label", `${label} crop selector`);
    cropCanvas.hidden = !source;
    cropNote.hidden = !source;
    cropEmpty.hidden = Boolean(source);

    if (!source) {
      cropName.textContent = `${QUESTION_WIDTH}×${QUESTION_HEIGHT}`;
      cropEmpty.textContent = `Choose an ${activeKind} image to begin.`;
      return;
    }

    cropName.textContent = `${source.name} · ${source.width}×${source.height}`;
    updateCropNote();
    drawCropPreview();
  };

  const setActiveKind = (kind: ImageKind): void => {
    activeKind = kind;
    cropStates.question.dragging = false;
    cropStates.answer.dragging = false;
    renderActiveCrop();
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
    renderActiveCrop();
    updateActionState();
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
    setActiveKind(kind);
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
      renderActiveCrop();
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

  const sourcePointFromPointer = (event: PointerEvent): { x: number; y: number } | undefined => {
    const source = cropStates[activeKind].source;
    if (!source) return;
    const bounds = cropCanvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) * cropCanvas.width / bounds.width;
    const canvasY = (event.clientY - bounds.top) * cropCanvas.height / bounds.height;
    const metrics = previewMetrics(source);
    return {
      x: (canvasX - metrics.imageX) / metrics.scale,
      y: (canvasY - metrics.imageY) / metrics.scale,
    };
  };

  const updateCropFromPointer = (event: PointerEvent): void => {
    const state = cropStates[activeKind];
    const point = sourcePointFromPointer(event);
    if (point) setCrop(activeKind, point.x - state.grabX, point.y - state.grabY);
  };

  for (const kind of ["question", "answer"] as const) {
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

    imageTabs[kind].addEventListener("click", () => setActiveKind(kind));
  }

  cropCanvas.addEventListener("pointerdown", (event) => {
    const state = cropStates[activeKind];
    const source = state.source;
    if (!source) return;
    const point = sourcePointFromPointer(event);
    if (!point) return;
    const insideCrop = point.x >= source.cropX
      && point.x <= source.cropX + QUESTION_WIDTH
      && point.y >= source.cropY
      && point.y <= source.cropY + QUESTION_HEIGHT;
    state.grabX = insideCrop ? point.x - source.cropX : QUESTION_WIDTH / 2;
    state.grabY = insideCrop ? point.y - source.cropY : QUESTION_HEIGHT / 2;
    state.dragging = true;
    cropCanvas.setPointerCapture(event.pointerId);
    updateCropFromPointer(event);
  });

  cropCanvas.addEventListener("pointermove", (event) => {
    if (cropStates[activeKind].dragging) updateCropFromPointer(event);
  });

  cropCanvas.addEventListener("pointerup", (event) => {
    cropStates[activeKind].dragging = false;
    if (cropCanvas.hasPointerCapture(event.pointerId)) cropCanvas.releasePointerCapture(event.pointerId);
  });

  cropCanvas.addEventListener("pointercancel", () => {
    cropStates[activeKind].dragging = false;
  });

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || (!cropStates.question.source && !cropStates.answer.source)) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    describeNextStep();
  });

  copyButton.addEventListener("click", async () => {
    if (!answer) return;

    try {
      await navigator.clipboard.writeText(formatAnswer(answer));
      copyButton.textContent = "Copied!";
      setStatus("Copied the answer.txt coordinate.");
      window.setTimeout(() => {
        copyButton.textContent = "Copy answer";
      }, 1600);
    } catch {
      setStatus("Clipboard access failed. Select and copy the answer shown here.", true);
    }
  });

  downloadButton.addEventListener("click", async () => {
    const questionSource = cropStates.question.source;
    const answerSource = cropStates.answer.source;
    if (!questionSource || !answerSource || !locationId || !answer) return;
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
        "answer.txt": strToU8(`${formatAnswer(answer)}\r\n`),
      }, { level: 0 });
      const archiveBuffer = archive.slice().buffer as ArrayBuffer;
      downloadBlob(new Blob([archiveBuffer], { type: "application/zip" }), `${locationId}.zip`);
      setStatus(`Downloaded ${locationId}.zip. Extract its contents into src/locations/${locationId}/.`);
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
