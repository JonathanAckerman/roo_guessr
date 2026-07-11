import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const locationsDirectory = fileURLToPath(new URL("../src/locations/", import.meta.url));
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const requiredFiles = new Set(["answer.txt", "question.webp"]);
const failures = [];

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

async function validateLocation(directoryName) {
  const directory = join(locationsDirectory, directoryName);
  const answerPath = join(directory, "answer.txt");
  const imagePath = join(directory, "question.webp");

  if (!idPattern.test(directoryName)) {
    fail(directoryName, "directory names must be lowercase UUID v4 values");
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const entryNames = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    if (!entry.isFile() || !requiredFiles.has(entry.name)) {
      fail(directoryName, `unexpected ${entry.isDirectory() ? "directory" : "file"} '${entry.name}'`);
    }
  }

  for (const filename of requiredFiles) {
    if (!entryNames.has(filename)) {
      fail(directoryName, `${filename} is missing`);
    }
  }

  let answer;

  try {
    answer = await readFile(answerPath, "utf8");
  } catch (error) {
    if (entryNames.has("answer.txt")) {
      fail(directoryName, `answer.txt is unreadable (${error.message})`);
    }
  }

  try {
    const image = await readFile(imagePath);
    const isWebp = image.length >= 12
      && image.subarray(0, 4).toString("ascii") === "RIFF"
      && image.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isWebp) {
      fail(directoryName, "question.webp is empty or not a WebP image");
    }
  } catch {
    if (entryNames.has("question.webp")) fail(directoryName, "question.webp is unreadable");
  }

  if (answer !== undefined) {
    const values = answer.trim().split(",").map((value) => Number(value.trim()));
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      fail(directoryName, "answer.txt must contain normalized coordinates like 0.25, 0.70");
    }
  }
}

const entries = await readdir(locationsDirectory, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory());

await Promise.all(directories.map((entry) => validateLocation(entry.name)));

if (failures.length > 0) {
  console.error("Location validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Validated ${directories.length} RooGuessr location${directories.length === 1 ? "" : "s"}.`);
