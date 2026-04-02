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
export type PuzzleDifficulty = "easy" | "medium";

export const MIN_GRID = 4;
export const MAX_GRID = 12;
export const PUZZLES_STORAGE_KEY = "queen-competition-puzzles";
const LEGACY_LEVELS_STORAGE_KEY = "queen-competition-levels";
const DEFAULT_PUZZLES_SEEDED_KEY = "queen-competition-default-puzzles-seeded";

export const palette = [
  "#ef4444",
  "#f46600",
  "#eab308",
  "#d7fba2",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
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

type PatternSeed = {
  weight: number;
  cells: ReadonlyArray<readonly [number, number]>;
};

const patternSeeds: ReadonlyArray<PatternSeed> = [
  // Single cell
  {
    weight: 6,
    cells: [[0, 0]],
  },
  // L shape
  {
    weight: 18,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  // Long L shape
  {
    weight: 16,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
    ],
  },
  // T shape
  {
    weight: 16,
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  },
  // H shape
  {
    weight: 10,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [0, 2],
    ],
  },
  // E shape (compact)
  {
    weight: 8,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
  },
  // Tetromino O
  {
    weight: 7,
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  // Tetromino S
  {
    weight: 7,
    cells: [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
  },
  // Tetromino Z
  {
    weight: 7,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  },
  // Tetromino J
  {
    weight: 9,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  // Tetromino I
  {
    weight: 5,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  },
];

function buildCornerAxisPattern(size: number): Array<readonly [number, number]> {
  const cells: Array<readonly [number, number]> = [];

  for (let col = 0; col < size; col++) {
    cells.push([0, col]);
  }

  for (let row = 1; row < size; row++) {
    cells.push([row, 0]);
  }

  return cells;
}

function pickWeightedPattern(): ReadonlyArray<readonly [number, number]> {
  const totalWeight = patternSeeds.reduce((sum, pattern) => sum + pattern.weight, 0);
  let roll = randomInt(totalWeight);

  for (const pattern of patternSeeds) {
    if (roll < pattern.weight) {
      return pattern.cells;
    }

    roll -= pattern.weight;
  }

  return patternSeeds[0]!.cells;
}

function pickPatternForSize(size: number): ReadonlyArray<readonly [number, number]> {
  // Rarely use the full row+column corner L shape to create strong early deductions.
  if (size >= 6 && randomInt(100) < 8) {
    return buildCornerAxisPattern(size);
  }

  return pickWeightedPattern();
}

function normalizePattern(cells: ReadonlyArray<readonly [number, number]>): Array<readonly [number, number]> {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells.map(([row, col]) => [row - minRow, col - minCol]);
}

function transformPattern(
  cells: ReadonlyArray<readonly [number, number]>,
  rotateQuarterTurns: number,
  mirror: boolean,
): Array<readonly [number, number]> {
  let next = cells.map(([row, col]) => [row, col] as const);

  if (mirror) {
    next = next.map(([row, col]) => [row, -col] as const);
  }

  for (let i = 0; i < rotateQuarterTurns; i++) {
    next = next.map(([row, col]) => [col, -row] as const);
  }

  return normalizePattern(next);
}

export function generateBoard(size: number, colors: number): number[][] {
  const colorTotal = Math.max(1, Math.min(colors, size));
  const nextBoard = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  const cellsByColor: Position[][] = Array.from({ length: colorTotal }, () => []);

  let unassigned = size * size;

  function assignCell(color: number, row: number, col: number): void {
    if (nextBoard[row]![col] !== -1) {
      return;
    }

    nextBoard[row]![col] = color;
    cellsByColor[color]!.push({ row, col });
    unassigned -= 1;
  }

  function findUnassignedCell(): Position {
    for (let attempt = 0; attempt < size * size; attempt++) {
      const row = randomInt(size);
      const col = randomInt(size);
      if (nextBoard[row]![col] === -1) {
        return { row, col };
      }
    }

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (nextBoard[row]![col] === -1) {
          return { row, col };
        }
      }
    }

    return { row: 0, col: 0 };
  }

  for (let color = 0; color < colorTotal; color++) {
    let placedPattern = false;
    const patternAttempts = 14;

    for (let attempt = 0; attempt < patternAttempts; attempt++) {
      const basePattern = pickPatternForSize(size);
      const transformed = transformPattern(basePattern, randomInt(4), randomInt(2) === 1);
      const maxRow = Math.max(...transformed.map(([row]) => row));
      const maxCol = Math.max(...transformed.map(([, col]) => col));

      if (maxRow >= size || maxCol >= size) {
        continue;
      }

      const anchorRow = randomInt(size - maxRow);
      const anchorCol = randomInt(size - maxCol);
      const translated = transformed.map(([row, col]) => [row + anchorRow, col + anchorCol] as const);

      const canPlace = translated.every(([row, col]) => inBounds(row, col, size) && nextBoard[row]![col] === -1);
      if (!canPlace) {
        continue;
      }

      for (const [row, col] of translated) {
        assignCell(color, row, col);
      }

      placedPattern = true;
      break;
    }

    if (!placedPattern) {
      const seed = findUnassignedCell();
      assignCell(color, seed.row, seed.col);
    }
  }

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

function hasNeighborConflict(
  row: number,
  col: number,
  placedQueens: ReadonlyArray<readonly [number, number]>,
): boolean {
  for (const [otherRow, otherCol] of placedQueens) {
    const rowGap = Math.abs(otherRow - row);
    const colGap = Math.abs(otherCol - col);

    if (rowGap <= 1 && colGap <= 1) {
      return true;
    }
  }

  return false;
}

function countPuzzleSolutions(board: number[][], maxCount: number): number {
  const size = board.length;
  if (!size || board.some((row) => row.length !== size)) {
    return 0;
  }

  let solutionCount = 0;
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  const usedColors = new Set<number>();
  const placedQueens: Array<readonly [number, number]> = [];

  function getCandidatesForRow(row: number): number[] {
    const cols: number[] = [];

    for (let col = 0; col < size; col++) {
      const color = board[row]?.[col] ?? -1;
      if (usedCols.has(col) || usedColors.has(color)) {
        continue;
      }

      if (hasNeighborConflict(row, col, placedQueens)) {
        continue;
      }

      cols.push(col);
    }

    return cols;
  }

  function backtrack(): void {
    if (solutionCount >= maxCount) {
      return;
    }

    if (placedQueens.length === size) {
      solutionCount += 1;
      return;
    }

    let bestRow = -1;
    let bestCandidates: number[] = [];

    for (let row = 0; row < size; row++) {
      if (usedRows.has(row)) {
        continue;
      }

      const rowCandidates = getCandidatesForRow(row);
      if (!rowCandidates.length) {
        return;
      }

      if (bestRow === -1 || rowCandidates.length < bestCandidates.length) {
        bestRow = row;
        bestCandidates = rowCandidates;
      }
    }

    if (bestRow === -1) {
      return;
    }

    for (const col of bestCandidates) {
      const color = board[bestRow]?.[col] ?? -1;

      usedRows.add(bestRow);
      usedCols.add(col);
      usedColors.add(color);
      placedQueens.push([bestRow, col]);

      backtrack();

      placedQueens.pop();
      usedColors.delete(color);
      usedCols.delete(col);
      usedRows.delete(bestRow);

      if (solutionCount >= maxCount) {
        return;
      }
    }
  }

  backtrack();
  return solutionCount;
}

function getCandidateCellsForState(
  board: number[][],
  usedRows: ReadonlySet<number>,
  usedCols: ReadonlySet<number>,
  usedColors: ReadonlySet<number>,
  placedQueens: ReadonlyArray<readonly [number, number]>,
): Array<{ row: number; col: number; color: number }> {
  const size = board.length;
  const cells: Array<{ row: number; col: number; color: number }> = [];

  for (let row = 0; row < size; row++) {
    if (usedRows.has(row)) {
      continue;
    }

    for (let col = 0; col < size; col++) {
      const color = board[row]?.[col] ?? -1;

      if (usedCols.has(col) || usedColors.has(color)) {
        continue;
      }

      if (hasNeighborConflict(row, col, placedQueens)) {
        continue;
      }

      cells.push({ row, col, color });
    }
  }

  return cells;
}

function evaluateLogicalSolvability(board: number[][]): { solved: boolean; placedCount: number } {
  const size = board.length;
  if (!size || board.some((row) => row.length !== size)) {
    return { solved: false, placedCount: 0 };
  }

  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  const usedColors = new Set<number>();
  const placedQueens: Array<readonly [number, number]> = [];

  while (placedQueens.length < size) {
    const candidates = getCandidateCellsForState(board, usedRows, usedCols, usedColors, placedQueens);
    if (!candidates.length) {
      break;
    }

    let forced: { row: number; col: number; color: number } | null = null;

    // Rule 1: a row has exactly one possible cell.
    for (let row = 0; row < size && !forced; row++) {
      if (usedRows.has(row)) {
        continue;
      }

      const rowOptions = candidates.filter((cell) => cell.row === row);
      if (rowOptions.length === 1) {
        forced = rowOptions[0]!;
      }
    }

    // Rule 2: a column has exactly one possible cell.
    for (let col = 0; col < size && !forced; col++) {
      if (usedCols.has(col)) {
        continue;
      }

      const colOptions = candidates.filter((cell) => cell.col === col);
      if (colOptions.length === 1) {
        forced = colOptions[0]!;
      }
    }

    // Rule 3: a color region has exactly one possible cell.
    for (let color = 0; color < size && !forced; color++) {
      if (usedColors.has(color)) {
        continue;
      }

      const colorOptions = candidates.filter((cell) => cell.color === color);
      if (colorOptions.length === 1) {
        forced = colorOptions[0]!;
      }
    }

    if (!forced) {
      break;
    }

    usedRows.add(forced.row);
    usedCols.add(forced.col);
    usedColors.add(forced.color);
    placedQueens.push([forced.row, forced.col]);
  }

  return {
    solved: placedQueens.length === size,
    placedCount: placedQueens.length,
  };
}

export function generatePuzzleBoard(size: number, difficulty: PuzzleDifficulty = "easy"): number[][] {
  const maxAttempts = difficulty === "easy" ? 220 : 140;
  const mediumThreshold = Math.max(1, Math.ceil(size * 0.7));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateBoard(size, size);
    if (countPuzzleSolutions(candidate, 2) !== 1) {
      continue;
    }

    const logical = evaluateLogicalSolvability(candidate);
    const passesDifficulty =
      difficulty === "easy" ? logical.solved : logical.solved || logical.placedCount >= mediumThreshold;

    if (passesDifficulty) {
      return candidate;
    }
  }

  return generateBoard(size, size);
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
      board: generatePuzzleBoard(6, "easy"),
      createdAt: baseTime,
    },
    {
      id: "default-classic-8",
      name: "Classic 8x8",
      size: 8,
      board: generatePuzzleBoard(8, "easy"),
      createdAt: baseTime + 1,
    },
    {
      id: "default-challenge-10",
      name: "Challenge 10x10",
      size: 10,
      board: generatePuzzleBoard(10, "medium"),
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
