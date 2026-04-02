import { generatePuzzleBoard, type PuzzleDifficulty } from "../composables/useQueens";

type GenerateRequest = {
  size: number;
  difficulty: PuzzleDifficulty;
};

type GenerateResponse = {
  board?: number[][];
  error?: string;
};

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  try {
    const { size, difficulty } = event.data;
    const board = generatePuzzleBoard(size, difficulty);
    const response: GenerateResponse = { board };
    self.postMessage(response);
  } catch (error) {
    const response: GenerateResponse = {
      error: error instanceof Error ? error.message : "Generation failed",
    };
    self.postMessage(response);
  }
};
