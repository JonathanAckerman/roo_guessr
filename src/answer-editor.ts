import { strToU8, zipSync } from "fflate";
import type { NormalizedPoint } from "./game/locations";

const QUESTION_WIDTH = 1400;
const QUESTION_HEIGHT = 1000;
const CROP_PREVIEW_WIDTH = 700;
const CROP_PREVIEW_HEIGHT = 500;

interface SourceImage {
  image: HTMLImageElement;
  url: string;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
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
    throw new Error(`Image is ${width}×${height}. Source images must be at least ${QUESTION_WIDTH}×${QUESTION_HEIGHT}.`);
  }

  return {
    image,
    url,
    width,
    height,
    cropX: Math.floor((width - QUESTION_WIDTH) / 2),
    cropY: Math.floor((height - QUESTION_HEIGHT) / 2),
  };
}

async function cropToQuestionWebp(source: SourceImage): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = QUESTION_WIDTH;
  canvas.height = QUESTION_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the question image.");

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
    throw new Error("This browser could not convert the crop to WebP.");
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
  let sourceImage: SourceImage | undefined;
  let locationId: string | undefined;
  let answer: NormalizedPoint | undefined;
  let selectionVersion = 0;
  let cropDragging = false;
  let cropGrabX = QUESTION_WIDTH / 2;
  let cropGrabY = QUESTION_HEIGHT / 2;

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
          Choose a screenshot, select its ${QUESTION_WIDTH}×${QUESTION_HEIGHT} crop, mark its location,
          and download a ready-to-commit ZIP. Coordinates use <strong>(0, 0)</strong> at the bottom-left.
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
            <span>Question crop</span>
            <span data-question-name>${QUESTION_WIDTH}×${QUESTION_HEIGHT}</span>
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
            <p class="editor-empty" data-question-empty>Choose a PNG, JPG, or WebP image from your computer.</p>
          </div>
          <p class="editor-crop-note" data-crop-note hidden>Drag the 1400×1000 box to choose the exported crop.</p>
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

      <footer class="editor-footer">
        <span>Extract the ZIP contents into <code>src/locations/&lt;zip-name&gt;/</code>.</span>
        <a class="editor-footer-link" href="/">Back to RooGuessr</a>
      </footer>
    </main>
  `;

  const fileInput = app.querySelector<HTMLInputElement>("[data-question-file]");
  const map = app.querySelector<HTMLImageElement>(".editor-map");
  const pin = app.querySelector<HTMLDivElement>(".editor-pin");
  const cropCanvas = app.querySelector<HTMLCanvasElement>("[data-crop-canvas]");
  const cropNote = app.querySelector<HTMLElement>("[data-crop-note]");
  const questionEmpty = app.querySelector<HTMLElement>("[data-question-empty]");
  const questionName = app.querySelector<HTMLElement>("[data-question-name]");
  const coordinateLabel = app.querySelector<HTMLElement>("[data-coordinate-label]");
  const locationIdText = app.querySelector<HTMLElement>("[data-location-id]");
  const answerText = app.querySelector<HTMLElement>("[data-answer-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const copyButton = app.querySelector<HTMLButtonElement>("[data-copy-answer]");
  const downloadButton = app.querySelector<HTMLButtonElement>("[data-download-location]");

  if (!fileInput || !map || !pin || !cropCanvas || !cropNote || !questionEmpty || !questionName || !coordinateLabel || !locationIdText || !answerText || !status || !copyButton || !downloadButton) {
    throw new Error("RooGuessr location builder could not initialize.");
  }

  const setStatus = (message: string, error = false): void => {
    status.textContent = message;
    status.classList.toggle("editor-status--error", error);
  };

  const updateActionState = (): void => {
    const ready = Boolean(sourceImage && locationId && answer);
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
    if (!sourceImage) return;
    const context = cropCanvas.getContext("2d");
    if (!context) return;
    const metrics = previewMetrics(sourceImage);
    const cropLeft = metrics.imageX + sourceImage.cropX * metrics.scale;
    const cropTop = metrics.imageY + sourceImage.cropY * metrics.scale;
    const cropWidth = QUESTION_WIDTH * metrics.scale;
    const cropHeight = QUESTION_HEIGHT * metrics.scale;

    context.fillStyle = "#050a08";
    context.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    context.drawImage(
      sourceImage.image,
      metrics.imageX,
      metrics.imageY,
      metrics.imageWidth,
      metrics.imageHeight,
    );
    context.fillStyle = "rgba(0, 0, 0, 0.62)";
    context.fillRect(metrics.imageX, metrics.imageY, metrics.imageWidth, metrics.imageHeight);
    context.drawImage(
      sourceImage.image,
      sourceImage.cropX,
      sourceImage.cropY,
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

  const setCrop = (x: number, y: number): void => {
    if (!sourceImage) return;
    sourceImage.cropX = Math.round(clampBetween(x, 0, sourceImage.width - QUESTION_WIDTH));
    sourceImage.cropY = Math.round(clampBetween(y, 0, sourceImage.height - QUESTION_HEIGHT));
    cropNote.textContent = sourceImage.width === QUESTION_WIDTH && sourceImage.height === QUESTION_HEIGHT
      ? "This image already matches the 1400×1000 crop."
      : `Drag the 1400×1000 box to choose the exported crop. Offset: ${sourceImage.cropX}px left, ${sourceImage.cropY}px top.`;
    drawCropPreview();
  };

  const clearQuestion = (): void => {
    if (sourceImage) URL.revokeObjectURL(sourceImage.url);
    sourceImage = undefined;
    locationId = undefined;
    cropDragging = false;
    cropCanvas.hidden = true;
    cropNote.hidden = true;
    questionEmpty.hidden = false;
    questionName.textContent = `${QUESTION_WIDTH}×${QUESTION_HEIGHT}`;
    locationIdText.textContent = "—";
    updatePin(undefined);
  };

  const prepareFile = async (file: File): Promise<void> => {
    const version = ++selectionVersion;
    clearQuestion();
    fileInput.disabled = true;
    setStatus("Reading image…");

    try {
      const loadedImage = await loadSourceImage(file);
      if (version !== selectionVersion) {
        URL.revokeObjectURL(loadedImage.url);
        return;
      }

      sourceImage = loadedImage;
      locationId = crypto.randomUUID();
      cropCanvas.hidden = false;
      cropNote.hidden = false;
      questionEmpty.hidden = true;
      questionName.textContent = `${file.name} · ${sourceImage.width}×${sourceImage.height}`;
      locationIdText.textContent = locationId;
      setCrop(sourceImage.cropX, sourceImage.cropY);
      setStatus(
        sourceImage.width === QUESTION_WIDTH && sourceImage.height === QUESTION_HEIGHT
          ? "Image is exactly 1400×1000. Click the matching location on the map."
          : "Position the 1400×1000 crop, then click the matching location on the map.",
      );
      updateActionState();
    } catch (error) {
      fileInput.value = "";
      setStatus(error instanceof Error ? error.message : "The image could not be prepared.", true);
    } finally {
      if (version === selectionVersion) fileInput.disabled = false;
    }
  };

  const sourcePointFromPointer = (event: PointerEvent): { x: number; y: number } | undefined => {
    if (!sourceImage) return;
    const bounds = cropCanvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) * cropCanvas.width / bounds.width;
    const canvasY = (event.clientY - bounds.top) * cropCanvas.height / bounds.height;
    const metrics = previewMetrics(sourceImage);
    return {
      x: (canvasX - metrics.imageX) / metrics.scale,
      y: (canvasY - metrics.imageY) / metrics.scale,
    };
  };

  const updateCropFromPointer = (event: PointerEvent): void => {
    const point = sourcePointFromPointer(event);
    if (point) setCrop(point.x - cropGrabX, point.y - cropGrabY);
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      void prepareFile(file);
    } else {
      clearQuestion();
      setStatus("Choose an image to begin.");
    }
  });

  cropCanvas.addEventListener("pointerdown", (event) => {
    if (!sourceImage) return;
    const point = sourcePointFromPointer(event);
    if (!point) return;
    const insideCrop = point.x >= sourceImage.cropX
      && point.x <= sourceImage.cropX + QUESTION_WIDTH
      && point.y >= sourceImage.cropY
      && point.y <= sourceImage.cropY + QUESTION_HEIGHT;
    cropGrabX = insideCrop ? point.x - sourceImage.cropX : QUESTION_WIDTH / 2;
    cropGrabY = insideCrop ? point.y - sourceImage.cropY : QUESTION_HEIGHT / 2;
    cropDragging = true;
    cropCanvas.setPointerCapture(event.pointerId);
    updateCropFromPointer(event);
  });

  cropCanvas.addEventListener("pointermove", (event) => {
    if (cropDragging) updateCropFromPointer(event);
  });

  cropCanvas.addEventListener("pointerup", (event) => {
    cropDragging = false;
    if (cropCanvas.hasPointerCapture(event.pointerId)) cropCanvas.releasePointerCapture(event.pointerId);
  });

  cropCanvas.addEventListener("pointercancel", () => {
    cropDragging = false;
  });

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || !sourceImage) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    setStatus("Location ready. Download the ZIP when the crop and pin are correct.");
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
    if (!sourceImage || !locationId || !answer) return;
    downloadButton.disabled = true;
    setStatus("Building location ZIP…");

    try {
      const questionBlob = await cropToQuestionWebp(sourceImage);
      const archive = zipSync({
        "question.webp": new Uint8Array(await questionBlob.arrayBuffer()),
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
    selectionVersion += 1;
    if (sourceImage) URL.revokeObjectURL(sourceImage.url);
  }, { once: true });
}
