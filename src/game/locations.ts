import type { Difficulty } from "./difficulty";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface LocationMetadata {
  id: string;
  mapVersion: string;
  answer: NormalizedPoint;
  cropCenter?: NormalizedPoint;
  difficulties: Difficulty[];
  credit: string;
}

export interface Location extends LocationMetadata {
  imageUrl: string;
}

const metadataModules = import.meta.glob<LocationMetadata>(
  "../locations/*/location.json",
  { eager: true, import: "default" },
);

const imageModules = import.meta.glob<string>("../locations/*/question.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const locations: Location[] = Object.entries(metadataModules)
  .map(([metadataPath, metadata]) => {
    const imagePath = metadataPath.replace(/location\.json$/, "question.webp");
    const imageUrl = imageModules[imagePath];

    if (!imageUrl) {
      throw new Error(`Missing question.webp for ${metadataPath}`);
    }

    return { ...metadata, imageUrl };
  })
  .sort((left, right) => left.id.localeCompare(right.id));
