import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const locationsDirectory = fileURLToPath(new URL("../src/locations/", import.meta.url));
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const requiredFiles = new Set(["pin.txt", "question.webp"]);
const allowedFiles = new Set([...requiredFiles, "answer.webp"]);
// These locations predate answer images. Remove an ID once its answer.webp is authored.
const legacyLocationsWithoutAnswerImages = new Set([
  "05a0931f-abce-471b-b55e-a80329e86814",
  "1ecdbc67-ceb7-4377-ad0f-96c620a3d9dd",
  "245b0b72-39e4-4ce1-bf31-cb3a7704d1e6",
  "2c54327c-7e3e-4f48-a4d5-d679d0f34b77",
  "3db07fa2-c595-4738-b5e0-d1221e2265d1",
  "42eede18-645f-40ea-8171-778a9fd86835",
  "4eac35c7-ae58-4d92-8a88-318abdf6a522",
  "5c166f76-b608-44e8-a3bb-04f8dc44c867",
  "667b5bc8-f53a-4ce7-b2ec-502513514eb2",
  "712b09af-3e6c-4064-b9d0-05a24f6a326c",
  "a4fa6ca9-abb8-4136-a99f-bcdee674504e",
  "a52a159b-037d-47de-8af2-670bfeed3833",
  "a6ea568d-33ca-413f-8e02-4d1a78ca652f",
  "b0e78c56-0460-43b1-a1b8-306d34eb9a67",
  "b68673ac-3691-41b3-aa7a-2cefd51ddf66",
  "c3889d4d-acb8-4c97-a958-c17591fe229a",
  "dff2ed9b-88aa-4057-b3d9-1853ce7b40bb",
  "e23cf6ba-38ae-4b9d-a942-cb0089a6b709",
  "f0a75c45-b38e-4391-81f6-9c7cf1419a1f",
  "f3fa1086-cb4c-4a7d-92a7-b6998d3bcf12",
]);
const failures = [];

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

async function validateLocation(directoryName) {
  const directory = join(locationsDirectory, directoryName);
  const pinPath = join(directory, "pin.txt");

  if (!idPattern.test(directoryName)) {
    fail(directoryName, "directory names must be lowercase UUID v4 values");
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const entryNames = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    if (!entry.isFile() || !allowedFiles.has(entry.name)) {
      fail(directoryName, `unexpected ${entry.isDirectory() ? "directory" : "file"} '${entry.name}'`);
    }
  }

  for (const filename of requiredFiles) {
    if (!entryNames.has(filename)) {
      fail(directoryName, `${filename} is missing`);
    }
  }

  if (!entryNames.has("answer.webp") && !legacyLocationsWithoutAnswerImages.has(directoryName)) {
    fail(directoryName, "answer.webp is missing");
  }

  let pin;

  try {
    pin = await readFile(pinPath, "utf8");
  } catch (error) {
    if (entryNames.has("pin.txt")) {
      fail(directoryName, `pin.txt is unreadable (${error.message})`);
    }
  }

  const validateWebp = async (filename) => {
    const image = await readFile(join(directory, filename));
    const isWebp = image.length >= 12
      && image.subarray(0, 4).toString("ascii") === "RIFF"
      && image.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isWebp) {
      fail(directoryName, `${filename} is empty or not a WebP image`);
    }
  };

  try {
    await validateWebp("question.webp");
  } catch {
    if (entryNames.has("question.webp")) fail(directoryName, "question.webp is unreadable");
  }

  if (entryNames.has("answer.webp")) {
    try {
      await validateWebp("answer.webp");
    } catch {
      fail(directoryName, "answer.webp is unreadable");
    }
  }

  if (pin !== undefined) {
    const values = pin.trim().split(",").map((value) => Number(value.trim()));
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      fail(directoryName, "pin.txt must contain normalized coordinates like 0.25, 0.70");
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
