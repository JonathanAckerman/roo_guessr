import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const locationsDirectory = fileURLToPath(new URL("../src/locations/", import.meta.url));
const allowedDifficulties = new Set(["easy", "medium", "hard"]);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const failures = [];

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

function validatePoint(id, label, value) {
  if (!value || typeof value !== "object") {
    fail(id, `${label} must be an object with x and y coordinates`);
    return;
  }

  for (const axis of ["x", "y"]) {
    if (typeof value[axis] !== "number" || value[axis] < 0 || value[axis] > 1) {
      fail(id, `${label}.${axis} must be a number from 0 to 1`);
    }
  }
}

async function validateLocation(directoryName) {
  const directory = join(locationsDirectory.pathname, directoryName);
  const metadataPath = join(directory, "location.json");
  const imagePath = join(directory, "question.webp");

  let metadata;

  try {
    metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch (error) {
    fail(directoryName, `location.json is missing or invalid (${error.message})`);
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

  if (metadata.id !== directoryName) {
    fail(directoryName, "metadata id must exactly match the directory name");
  }

  if (typeof metadata.mapVersion !== "string" || metadata.mapVersion.trim() === "") {
    fail(directoryName, "mapVersion must be a non-empty string");
  }

  if (typeof metadata.credit !== "string" || metadata.credit.trim() === "") {
    fail(directoryName, "credit must be a non-empty string");
  }

  validatePoint(directoryName, "answer", metadata.answer);

  if (metadata.cropCenter !== undefined) {
    validatePoint(directoryName, "cropCenter", metadata.cropCenter);
  }

  if (!Array.isArray(metadata.difficulties) || metadata.difficulties.length === 0) {
    fail(directoryName, "difficulties must contain at least one mode");
  } else {
    const uniqueDifficulties = new Set(metadata.difficulties);

    if (uniqueDifficulties.size !== metadata.difficulties.length) {
      fail(directoryName, "difficulties cannot contain duplicates");
    }

    for (const difficulty of metadata.difficulties) {
      if (!allowedDifficulties.has(difficulty)) {
        fail(directoryName, `unknown difficulty '${difficulty}'`);
      }
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
