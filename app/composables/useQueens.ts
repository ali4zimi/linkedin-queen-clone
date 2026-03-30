export type Position = {
  row: number;
  col: number;
};

export type DesignedPuzzle = {
  id: string;
  name: string;
  size: number;
  board: number[][];
  createdAt: number;
};

export type CellMark = 0 | 1 | 2;

export const MIN_GRID = 4;
export const MAX_GRID = 16;
export const PUZZLES_STORAGE_KEY = "queen-competition-puzzles";
const LEGACY_LEVELS_STORAGE_KEY = "queen-competition-levels";
const DEFAULT_PUZZLES_SEEDED_KEY = "queen-competition-default-puzzles-seeded";

export const palette = [
  "#f87171",
  "#f59e0b",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
  "#38bdf8",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#94a3b8",
  "#34d399",
  "#22d3ee",
  "#818cf8",
  "#a3e635",
  "#fb923c",
  "#c084fc",
  "#14b8a6",
  "#e879f9",
  "#f43f5e",
  "#84cc16",
  "#06b6d4",
];

const cardinalNeighbors: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export function keyOf(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseKey(key: string): Position {
  const [row = 0, col = 0] = key.split(":").map(Number);
  return { row, col };
}

function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function generateBoard(size: number, colors: number): number[][] {
  const colorTotal = Math.max(1, Math.min(colors, size));
  const nextBoard = Array.from({ length: size }, () => Array<number>(size).fill(-1));

  const usedSeeds = new Set<string>();
  const cellsByColor: Position[][] = Array.from({ length: colorTotal }, () => []);

  for (let color = 0; color < colorTotal; color++) {
    let seed: Position = { row: 0, col: 0 };
    do {
      seed = { row: randomInt(size), col: randomInt(size) };
    } while (usedSeeds.has(keyOf(seed.row, seed.col)));

    usedSeeds.add(keyOf(seed.row, seed.col));
    nextBoard[seed.row]![seed.col] = color;
    cellsByColor[color]!.push(seed);
  }

  let unassigned = size * size - colorTotal;

  while (unassigned > 0) {
    const expandableColors: number[] = [];

    for (let color = 0; color < colorTotal; color++) {
      const hasExpandableCell = cellsByColor[color]!.some((cell) => {
        return cardinalNeighbors.some(([dr, dc]) => {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          return inBounds(nr, nc, size) && nextBoard[nr]![nc] === -1;
        });
      });

      if (hasExpandableCell) {
        expandableColors.push(color);
      }
    }

    if (!expandableColors.length) {
      break;
    }

    const color = expandableColors[randomInt(expandableColors.length)]!;
    const boundaryCells = cellsByColor[color]!.filter((cell) => {
      return cardinalNeighbors.some(([dr, dc]) => {
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        return inBounds(nr, nc, size) && nextBoard[nr]![nc] === -1;
      });
    });

    if (!boundaryCells.length) {
      continue;
    }

    const start = boundaryCells[randomInt(boundaryCells.length)]!;
    const candidates: Position[] = [];

    for (const [dr, dc] of cardinalNeighbors) {
      const nr = start.row + dr;
      const nc = start.col + dc;

      if (inBounds(nr, nc, size) && nextBoard[nr]![nc] === -1) {
        candidates.push({ row: nr, col: nc });
      }
    }

    if (!candidates.length) {
      continue;
    }

    const picked = candidates[randomInt(candidates.length)]!;
    nextBoard[picked.row]![picked.col] = color;
    cellsByColor[color]!.push(picked);
    unassigned -= 1;
  }

  if (unassigned > 0) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (nextBoard[row]![col] !== -1) {
          continue;
        }

        const neighborColors = new Set<number>();
        for (const [dr, dc] of cardinalNeighbors) {
          const nr = row + dr;
          const nc = col + dc;
          if (!inBounds(nr, nc, size)) {
            continue;
          }

          const neighborColor = nextBoard[nr]![nc]!;
          if (neighborColor !== -1) {
            neighborColors.add(neighborColor);
          }
        }

        const options = Array.from(neighborColors);
        const fallbackColor = options.length ? options[randomInt(options.length)]! : randomInt(colorTotal);
        nextBoard[row]![col] = fallbackColor;
      }
    }
  }

  return nextBoard;
}

export function getQueenKeys(marks: Record<string, CellMark>): Set<string> {
  const result = new Set<string>();
  for (const [key, value] of Object.entries(marks)) {
    if (value === 2) {
      result.add(key);
    }
  }
  return result;
}

export function validateQueens(
  board: number[][],
  queenKeys: Set<string>,
  requiredQueens: number,
): { invalid: Set<string>; hasWon: boolean } {
  const rowCount = new Map<number, number>();
  const colCount = new Map<number, number>();
  const colorUsage = new Map<number, number>();
  const invalid = new Set<string>();

  const queenPositions = Array.from(queenKeys).map(parseKey);

  for (const queen of queenPositions) {
    rowCount.set(queen.row, (rowCount.get(queen.row) ?? 0) + 1);
    colCount.set(queen.col, (colCount.get(queen.col) ?? 0) + 1);

    const color = board[queen.row]?.[queen.col] ?? -1;
    colorUsage.set(color, (colorUsage.get(color) ?? 0) + 1);
  }

  for (const queen of queenPositions) {
    const key = keyOf(queen.row, queen.col);
    const color = board[queen.row]?.[queen.col] ?? -1;

    if ((rowCount.get(queen.row) ?? 0) > 1) {
      invalid.add(key);
    }

    if ((colCount.get(queen.col) ?? 0) > 1) {
      invalid.add(key);
    }

    if ((colorUsage.get(color) ?? 0) > 1) {
      invalid.add(key);
    }
  }

  for (const [i, a] of queenPositions.entries()) {
    for (const b of queenPositions.slice(i + 1)) {
      const rowGap = Math.abs(a.row - b.row);
      const colGap = Math.abs(a.col - b.col);

      if (rowGap <= 1 && colGap <= 1) {
        invalid.add(keyOf(a.row, a.col));
        invalid.add(keyOf(b.row, b.col));
      }
    }
  }

  const hasOneQueenInEachColor = Array.from({ length: requiredQueens }, (_, color) => {
    return (colorUsage.get(color) ?? 0) === 1;
  }).every(Boolean);

  const hasWon = queenKeys.size === requiredQueens && invalid.size === 0 && hasOneQueenInEachColor;

  return {
    invalid,
    hasWon,
  };
}

function buildDefaultPuzzles(): DesignedPuzzle[] {
  const baseTime = Date.now();

  return [
    {
      id: "default-starter-6",
      name: "Starter 6x6",
      size: 6,
      board: generateBoard(6, 6),
      createdAt: baseTime,
    },
    {
      id: "default-classic-8",
      name: "Classic 8x8",
      size: 8,
      board: generateBoard(8, 8),
      createdAt: baseTime + 1,
    },
    {
      id: "default-challenge-10",
      name: "Challenge 10x10",
      size: 10,
      board: generateBoard(10, 10),
      createdAt: baseTime + 2,
    },
  ];
}

function seedDefaultPuzzlesOnce(): DesignedPuzzle[] {
  const defaults = buildDefaultPuzzles();
  window.localStorage.setItem(PUZZLES_STORAGE_KEY, JSON.stringify(defaults));
  window.localStorage.setItem(DEFAULT_PUZZLES_SEEDED_KEY, "1");
  return defaults;
}

export function loadDesignedPuzzles(): DesignedPuzzle[] {
  if (typeof window === "undefined") {
    return [];
  }

  const hasSeededDefaults = window.localStorage.getItem(DEFAULT_PUZZLES_SEEDED_KEY) === "1";

  const raw =
    window.localStorage.getItem(PUZZLES_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_LEVELS_STORAGE_KEY);
  if (!raw) {
    if (!hasSeededDefaults) {
      return seedDefaultPuzzlesOnce();
    }

    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      if (!hasSeededDefaults) {
        return seedDefaultPuzzlesOnce();
      }

      return [];
    }

    const puzzles = parsed.filter((item): item is DesignedPuzzle => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const maybe = item as Partial<DesignedPuzzle>;
      return (
        typeof maybe.id === "string" &&
        typeof maybe.name === "string" &&
        typeof maybe.size === "number" &&
        Array.isArray(maybe.board)
      );
    });

    // Migrate old storage key to new puzzle naming key.
    if (!window.localStorage.getItem(PUZZLES_STORAGE_KEY) && puzzles.length) {
      window.localStorage.setItem(PUZZLES_STORAGE_KEY, JSON.stringify(puzzles));
    }

    if (!puzzles.length && !hasSeededDefaults) {
      return seedDefaultPuzzlesOnce();
    }

    return puzzles;
  } catch {
    if (!hasSeededDefaults) {
      return seedDefaultPuzzlesOnce();
    }

    return [];
  }
}

export function saveDesignedPuzzles(puzzles: DesignedPuzzle[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PUZZLES_STORAGE_KEY, JSON.stringify(puzzles));
}
