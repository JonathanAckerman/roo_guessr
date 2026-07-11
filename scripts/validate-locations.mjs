import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const locationsDirectory = fileURLToPath(new URL("../src/locations/", import.meta.url));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const failures = [];

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

async function validateLocation(directoryName) {
  const directory = join(locationsDirectory, directoryName);
  const answerPath = join(directory, "answer.txt");
  const imagePath = join(directory, "question.webp");

  let answer;

  try {
    answer = await readFile(answerPath, "utf8");
  } catch (error) {
    fail(directoryName, `answer.txt is missing or unreadable (${error.message})`);
    return;
  }

  try {
    const imageStats = await stat(imagePath);
    if (imageStats.size === 0) {
      fail(directoryName, "question.webp is empty");
    }
  } catch {
    fail(directoryName, "question.webp is missing");
  }

  if (!idPattern.test(directoryName)) {
    fail(directoryName, "directory names must use lowercase kebab-case");
  }

  const values = answer.trim().split(",").map((value) => Number(value.trim()));
  if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    fail(directoryName, "answer.txt must contain normalized coordinates like 0.25, 0.70");
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
