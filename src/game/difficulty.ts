export const DIFFICULTIES = {
  easy: {
    label: "Easy",
    cropScale: 1,
    description: "The full 7:5 scene",
  },
  medium: {
    label: "Medium",
    cropScale: 0.7,
    description: "A tighter crop with fewer landmarks",
  },
  hard: {
    label: "Hard",
    cropScale: 0.45,
    description: "A close crop for map specialists",
  },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
