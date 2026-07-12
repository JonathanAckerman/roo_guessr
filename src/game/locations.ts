export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface Location {
  id: string;
  answer: NormalizedPoint;
  questionImageUrl: string;
  answerImageUrl?: string;
}

const answerModules = import.meta.glob<string>("../locations/*/answer.txt", {
  eager: true,
  query: "?raw",
  import: "default",
});

const questionImageModules = import.meta.glob<string>("../locations/*/question.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const answerImageModules = import.meta.glob<string>("../locations/*/answer.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

function parseAnswer(path: string, text: string): NormalizedPoint {
  const values = text.trim().split(",").map((value) => Number(value.trim()));

  if (values.length !== 2 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`Invalid answer.txt for ${path}; expected normalized coordinates like 0.25, 0.70`);
  }

  return { x: values[0], y: values[1] };
}

export const locations: Location[] = Object.entries(answerModules)
  .map(([answerPath, answerText]) => {
    const directoryMatch = answerPath.match(/\/([^/]+)\/answer\.txt$/);
    const imagePath = answerPath.replace(/answer\.txt$/, "question.webp");
    const answerImagePath = answerPath.replace(/answer\.txt$/, "answer.webp");
    const questionImageUrl = questionImageModules[imagePath];

    if (!directoryMatch || !questionImageUrl) {
      throw new Error(`Invalid location directory or missing question.webp for ${answerPath}`);
    }

    return {
      id: directoryMatch[1],
      answer: parseAnswer(answerPath, answerText),
      questionImageUrl,
      answerImageUrl: answerImageModules[answerImagePath],
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));
