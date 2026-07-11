import { copyFile, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const stagedQuestionsDirectory = resolve(workspaceRoot, "src/assets/questions");
const locationsDirectory = resolve(workspaceRoot, "src/locations");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface AnswerPoint {
  x: number;
  y: number;
}

interface SaveRequest {
  sourceKind: "staged" | "location";
  sourceName: string;
  id: string;
  answer: AnswerPoint;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseAnswer(text: string): AnswerPoint | undefined {
  const values = text.trim().split(",").map((value) => Number(value.trim()));

  if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    return undefined;
  }

  return { x: values[0], y: values[1] };
}

function validAnswer(value: unknown): value is AnswerPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<AnswerPoint>;
  return [point.x, point.y].every((axis) => typeof axis === "number" && Number.isFinite(axis) && axis >= 0 && axis <= 1);
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteCount = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteCount += buffer.length;
    if (byteCount > 32_768) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

function assertInside(parent: string, child: string): void {
  const parentPrefix = resolve(parent) + sep;
  if (!resolve(child).startsWith(parentPrefix)) {
    throw new Error("Refusing to access a path outside the RooGuessr workspace.");
  }
}

async function listQuestions(): Promise<unknown[]> {
  const questions: unknown[] = [];

  const stagedEntries = await readdir(stagedQuestionsDirectory, { withFileTypes: true });
  for (const entry of stagedEntries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".webp") continue;
    const id = basename(entry.name, extname(entry.name));
    questions.push({
      sourceKind: "staged",
      sourceName: entry.name,
      id,
      answer: null,
      label: `${id} (staged)`,
      imageUrl: `/__rooguessr/question-image?sourceKind=staged&sourceName=${encodeURIComponent(entry.name)}`,
    });
  }

  const locationEntries = await readdir(locationsDirectory, { withFileTypes: true });
  for (const entry of locationEntries) {
    if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
    const directory = resolve(locationsDirectory, entry.name);
    const questionPath = join(directory, "question.webp");
    if (!(await fileExists(questionPath))) continue;

    let answer: AnswerPoint | undefined;
    try {
      answer = parseAnswer(await readFile(join(directory, "answer.txt"), "utf8"));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }

    questions.push({
      sourceKind: "location",
      sourceName: entry.name,
      id: entry.name,
      answer: answer ?? null,
      label: entry.name,
      imageUrl: `/__rooguessr/question-image?sourceKind=location&sourceName=${encodeURIComponent(entry.name)}`,
    });
  }

  return questions.sort((left, right) => {
    const a = left as { sourceKind: string; label: string };
    const b = right as { sourceKind: string; label: string };
    if (a.sourceKind !== b.sourceKind) return a.sourceKind === "staged" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

async function imagePath(sourceKind: string | null, sourceName: string | null): Promise<string> {
  if (!sourceName) throw new Error("A question image was not selected.");

  if (sourceKind === "staged") {
    if (basename(sourceName) !== sourceName || extname(sourceName).toLowerCase() !== ".webp") {
      throw new Error("Invalid staged question name.");
    }
    const path = resolve(stagedQuestionsDirectory, sourceName);
    assertInside(stagedQuestionsDirectory, path);
    return path;
  }

  if (sourceKind === "location" && idPattern.test(sourceName)) {
    const path = resolve(locationsDirectory, sourceName, "question.webp");
    assertInside(locationsDirectory, path);
    return path;
  }

  throw new Error("Invalid question source.");
}

async function saveAnswer(payload: SaveRequest): Promise<{ directory: string }> {
  const id = payload.id.trim();
  if (!idPattern.test(id)) throw new Error("Location IDs must use lowercase kebab-case.");
  if (!validAnswer(payload.answer)) throw new Error("The answer must contain normalized X and Y coordinates.");

  const answerText = `${payload.answer.x.toFixed(4)}, ${payload.answer.y.toFixed(4)}\r\n`;

  if (payload.sourceKind === "staged") {
    const sourcePath = await imagePath("staged", payload.sourceName);
    const destination = resolve(locationsDirectory, id);
    assertInside(locationsDirectory, destination);

    if (await fileExists(destination)) {
      throw new Error(`A location named '${id}' already exists.`);
    }

    await mkdir(destination);
    try {
      await copyFile(sourcePath, join(destination, "question.webp"));
      await writeFile(join(destination, "answer.txt"), answerText, "utf8");
      await unlink(sourcePath);
    } catch (error) {
      await rm(destination, { recursive: true, force: true });
      throw error;
    }
  } else if (payload.sourceKind === "location") {
    if (!idPattern.test(payload.sourceName) || payload.sourceName !== id) {
      throw new Error("Existing locations cannot be renamed from the answer editor.");
    }
    const destination = resolve(locationsDirectory, id);
    assertInside(locationsDirectory, destination);
    if (!(await fileExists(join(destination, "question.webp")))) {
      throw new Error(`Location '${id}' does not contain question.webp.`);
    }
    await writeFile(join(destination, "answer.txt"), answerText, "utf8");
  } else {
    throw new Error("Invalid question source.");
  }

  return { directory: `src/locations/${id}/` };
}

export function locationAuthoringPlugin(): Plugin {
  return {
    name: "rooguessr-location-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");

        try {
          if (request.method === "GET" && url.pathname === "/__rooguessr/questions") {
            sendJson(response, 200, { questions: await listQuestions() });
            return;
          }

          if (request.method === "GET" && url.pathname === "/__rooguessr/question-image") {
            const path = await imagePath(url.searchParams.get("sourceKind"), url.searchParams.get("sourceName"));
            response.statusCode = 200;
            response.setHeader("Content-Type", "image/webp");
            response.setHeader("Cache-Control", "no-store");
            response.end(await readFile(path));
            return;
          }

          if (request.method === "POST" && url.pathname === "/__rooguessr/save-answer") {
            const body = await readRequestBody(request) as SaveRequest;
            sendJson(response, 200, await saveAnswer(body));
            return;
          }
        } catch (error) {
          sendJson(response, 400, { error: error instanceof Error ? error.message : "Unknown authoring error." });
          return;
        }

        next();
      });
    },
  };
}
