import type { NormalizedPoint } from "./game/locations";

interface EditableQuestion {
  sourceKind: "staged" | "location";
  sourceName: string;
  id: string;
  answer: NormalizedPoint | null;
  label: string;
  imageUrl: string;
}

interface QuestionListResponse {
  questions: EditableQuestion[];
}

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
  let questions: EditableQuestion[] = [];
  let selectedQuestion: EditableQuestion | undefined;
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
          <h1 id="editor-title">Edit the answer.</h1>
        </div>
        <p>
          Choose a question, then left-click the corresponding point on the map.
          Coordinates use <strong>(0, 0)</strong> at the bottom-left.
        </p>
      </section>

      <section class="editor-toolbar" aria-label="Question selection">
        <label for="question-search">Question image</label>
        <input
          id="question-search"
          type="search"
          list="question-options"
          data-question-search
          placeholder="Search new questions by name…"
          autocomplete="off"
          disabled
        />
        <datalist id="question-options" data-question-options></datalist>
        <label for="location-id">Location ID</label>
        <input id="location-id" data-location-id pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="radiant-secret-shop" disabled />
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
            <span>7:5 source image</span>
          </div>
          <div class="editor-question-wrap">
            <img class="editor-question" alt="Selected RooGuessr question" hidden />
            <p class="editor-empty" data-question-empty>Search for a new local question.</p>
          </div>
        </article>
      </section>

      <section class="editor-save-panel">
        <div>
          <p class="section-number">Answer file</p>
          <strong data-answer-text>—</strong>
          <p data-editor-status>This tool writes <code>answer.txt</code> when RooGuessr is running locally.</p>
        </div>
        <button class="start-button" type="button" data-save-answer disabled>Save answer</button>
      </section>

      <footer>
        <span>Staged captures become playable locations when saved.</span>
        <a class="editor-footer-link" href="/">Back to RooGuessr</a>
      </footer>
    </main>
  `;

  const searchInput = app.querySelector<HTMLInputElement>("[data-question-search]");
  const questionOptions = app.querySelector<HTMLDataListElement>("[data-question-options]");
  const idInput = app.querySelector<HTMLInputElement>("[data-location-id]");
  const map = app.querySelector<HTMLImageElement>(".editor-map");
  const pin = app.querySelector<HTMLDivElement>(".editor-pin");
  const questionImage = app.querySelector<HTMLImageElement>(".editor-question");
  const questionEmpty = app.querySelector<HTMLElement>("[data-question-empty]");
  const coordinateLabel = app.querySelector<HTMLElement>("[data-coordinate-label]");
  const answerText = app.querySelector<HTMLElement>("[data-answer-text]");
  const status = app.querySelector<HTMLElement>("[data-editor-status]");
  const saveButton = app.querySelector<HTMLButtonElement>("[data-save-answer]");

  if (!searchInput || !questionOptions || !idInput || !map || !pin || !questionImage || !questionEmpty || !coordinateLabel || !answerText || !status || !saveButton) {
    throw new Error("RooGuessr answer editor could not initialize.");
  }

  const updateSaveState = (): void => {
    const validId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(idInput.value);
    saveButton.disabled = !selectedQuestion || !answer || !validId;
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

    updateSaveState();
  };

  const selectQuestion = (question: EditableQuestion | undefined): void => {
    selectedQuestion = question;

    if (!question) {
      idInput.value = "";
      idInput.disabled = true;
      questionImage.hidden = true;
      questionEmpty.hidden = false;
      updatePin(undefined);
      return;
    }

    idInput.value = question.id;
    idInput.disabled = question.sourceKind === "location";
    questionImage.src = question.imageUrl;
    questionImage.hidden = false;
    questionEmpty.hidden = true;
    updatePin(question.answer ?? undefined);
    status.textContent = question.sourceKind === "staged"
      ? "Saving will create the location folder, move this image, and write answer.txt."
      : "This location is not yet on origin/main; saving will update its answer.txt file.";
  };

  const loadQuestions = async (preferredId?: string): Promise<void> => {
    try {
      const response = await fetch("/__rooguessr/questions", { cache: "no-store" });
      if (!response.ok) throw new Error("The local authoring service is unavailable.");
      const payload = await response.json() as QuestionListResponse;
      questions = payload.questions;

      questionOptions.replaceChildren(...questions.map((question) => {
        const option = document.createElement("option");
        option.value = question.label;
        return option;
      }));
      searchInput.disabled = questions.length === 0;

      const preferredQuestion = preferredId ? questions.find((question) => question.id === preferredId) : undefined;
      searchInput.value = preferredQuestion?.label ?? "";
      selectQuestion(preferredQuestion);

      if (questions.length === 0) {
        searchInput.placeholder = "No new local questions found";
        status.textContent = "Only captures and locations that do not exist on origin/main appear here.";
      } else {
        searchInput.placeholder = "Search new questions by name…";
        status.textContent = "Search by filename to choose a question that is not yet on origin/main.";
      }
    } catch {
      questionOptions.innerHTML = "";
      searchInput.value = "";
      searchInput.placeholder = "Run pnpm dev locally";
      searchInput.disabled = true;
      status.textContent = "Saving files is available only from the local development server. Run pnpm dev, then reopen this page.";
      selectQuestion(undefined);
    }
  };

  const selectMatchingQuestion = (): void => {
    const search = searchInput.value.trim().toLocaleLowerCase();
    const question = questions.find((candidate) => candidate.label.toLocaleLowerCase() === search);
    selectQuestion(question);
  };

  searchInput.addEventListener("input", selectMatchingQuestion);
  searchInput.addEventListener("change", selectMatchingQuestion);

  idInput.addEventListener("input", updateSaveState);

  map.addEventListener("click", (event) => {
    if (event.button !== 0 || !selectedQuestion) return;
    const bounds = map.getBoundingClientRect();
    updatePin({
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp(1 - (event.clientY - bounds.top) / bounds.height),
    });
    status.textContent = "Answer moved. Save when the pin is in the correct place.";
  });

  saveButton.addEventListener("click", async () => {
    if (!selectedQuestion || !answer) return;
    saveButton.disabled = true;
    status.textContent = "Saving…";

    try {
      const response = await fetch("/__rooguessr/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKind: selectedQuestion.sourceKind,
          sourceName: selectedQuestion.sourceName,
          id: idInput.value,
          answer,
        }),
      });
      const payload = await response.json() as { directory?: string; error?: string };
      if (!response.ok || !payload.directory) throw new Error(payload.error ?? "The answer could not be saved.");

      status.textContent = `Saved to ${payload.directory}answer.txt`;
      await loadQuestions(idInput.value);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The answer could not be saved.";
      updateSaveState();
    }
  });

  void loadQuestions();
}
