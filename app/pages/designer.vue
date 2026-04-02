<script setup lang="ts">
import {
  MAX_GRID,
  MIN_GRID,
  type PuzzleDifficulty,
  generatePuzzleBoard,
  loadDesignedPuzzles,
  palette,
  saveDesignedPuzzles,
  type DesignedPuzzle,
} from "~/composables/useQueens";

const size = ref(8);
const draftSize = ref(8);
const draftDifficulty = ref<PuzzleDifficulty>("easy");
const dialogPuzzleName = ref("");
const previewBoard = ref<number[][]>([]);
const savedPuzzles = ref<DesignedPuzzle[]>([]);
const saveError = ref("");
const isSaveDialogOpen = ref(false);
const isGenerating = ref(false);
const generatorWorker = ref<Worker | null>(null);
const selectedColor = ref(0);
const isEraseMode = ref(false);
const isPaintDragging = ref(false);
const activePaintPointerId = ref<number | null>(null);
const drawError = ref("");

const cardinalNeighbors: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const paletteColors = computed(() => {
  return Array.from({ length: palette.length }, (_, index) => index);
});

const playableColors = computed(() => {
  return Array.from({ length: size.value }, (_, index) => index);
});

const unassignedCellCount = computed(() => {
  return previewBoard.value.reduce((total, row) => {
    return total + row.filter((cellColor) => cellColor < 0).length;
  }, 0);
});

const usedColorCount = computed(() => {
  const used = new Set<number>();

  for (const row of previewBoard.value) {
    for (const cellColor of row) {
      if (cellColor >= 0) {
        used.add(cellColor);
      }
    }
  }

  return used.size;
});

watch(dialogPuzzleName, () => {
  saveError.value = "";
});

function refreshSavedPuzzles(): void {
  savedPuzzles.value = loadDesignedPuzzles();
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function createEmptyBoard(boardSize: number): number[][] {
  return Array.from({ length: boardSize }, () => Array<number>(boardSize).fill(-1));
}

function cloneBoard(source: number[][]): number[][] {
  return source.map((row) => [...row]);
}

function getColorCells(boardState: number[][], color: number): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  for (let row = 0; row < boardState.length; row++) {
    for (let col = 0; col < boardState[row]!.length; col++) {
      if (boardState[row]![col] === color) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function isColorConnected(boardState: number[][], color: number): boolean {
  const cells = getColorCells(boardState, color);
  if (cells.length <= 1) {
    return true;
  }

  const start = cells[0]!;
  const target = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
  const visited = new Set<string>([`${start.row}:${start.col}`]);
  const queue: Array<{ row: number; col: number }> = [start];

  while (queue.length) {
    const current = queue.shift()!;

    for (const [dr, dc] of cardinalNeighbors) {
      const nextRow = current.row + dr;
      const nextCol = current.col + dc;
      const key = `${nextRow}:${nextCol}`;

      if (!target.has(key) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({ row: nextRow, col: nextCol });
    }
  }

  return visited.size === target.size;
}

function getUsedColors(boardState: number[][]): number[] {
  const used = new Set<number>();

  for (const row of boardState) {
    for (const cellColor of row) {
      if (cellColor >= 0) {
        used.add(cellColor);
      }
    }
  }

  return Array.from(used);
}

function hasValidColorRegions(boardState: number[][]): boolean {
  return getUsedColors(boardState).every((color) => isColorConnected(boardState, color));
}

function hasSolvableQueenPlacement(boardState: number[][]): boolean {
  const boardSize = boardState.length;
  if (!boardSize || boardState.some((row) => row.length !== boardSize)) {
    return false;
  }

  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  const usedColors = new Set<number>();
  const placedQueens: Array<readonly [number, number]> = [];

  function hasNeighborConflict(row: number, col: number): boolean {
    for (const [otherRow, otherCol] of placedQueens) {
      const rowGap = Math.abs(otherRow - row);
      const colGap = Math.abs(otherCol - col);

      if (rowGap <= 1 && colGap <= 1) {
        return true;
      }
    }

    return false;
  }

  function getCandidatesForRow(row: number): number[] {
    const columns: number[] = [];

    for (let col = 0; col < boardSize; col++) {
      const color = boardState[row]?.[col] ?? -1;

      if (color < 0 || usedCols.has(col) || usedColors.has(color)) {
        continue;
      }

      if (hasNeighborConflict(row, col)) {
        continue;
      }

      columns.push(col);
    }

    return columns;
  }

  function backtrack(): boolean {
    if (placedQueens.length === boardSize) {
      return true;
    }

    let bestRow = -1;
    let bestCandidates: number[] = [];

    for (let row = 0; row < boardSize; row++) {
      if (usedRows.has(row)) {
        continue;
      }

      const rowCandidates = getCandidatesForRow(row);
      if (!rowCandidates.length) {
        return false;
      }

      if (bestRow === -1 || rowCandidates.length < bestCandidates.length) {
        bestRow = row;
        bestCandidates = rowCandidates;
      }
    }

    if (bestRow === -1) {
      return false;
    }

    for (const col of bestCandidates) {
      const color = boardState[bestRow]?.[col] ?? -1;

      usedRows.add(bestRow);
      usedCols.add(col);
      usedColors.add(color);
      placedQueens.push([bestRow, col]);

      if (backtrack()) {
        return true;
      }

      placedQueens.pop();
      usedColors.delete(color);
      usedCols.delete(col);
      usedRows.delete(bestRow);
    }

    return false;
  }

  return backtrack();
}

function isValidCompletedPuzzle(boardState: number[][]): boolean {
  if (!hasValidColorRegions(boardState)) {
    return false;
  }

  if (getUnassignedPositions(boardState).length) {
    return false;
  }

  if (getUsedColors(boardState).length !== size.value) {
    return false;
  }

  return hasSolvableQueenPlacement(boardState);
}

function wouldPreserveColorRegions(
  boardState: number[][],
  row: number,
  col: number,
  nextColor: number,
): boolean {
  const currentColor = boardState[row]?.[col] ?? -1;
  if (currentColor === nextColor) {
    return true;
  }

  const nextBoard = cloneBoard(boardState);
  nextBoard[row]![col] = nextColor;

  const affectedColors = new Set<number>();
  if (currentColor >= 0) {
    affectedColors.add(currentColor);
  }
  if (nextColor >= 0) {
    affectedColors.add(nextColor);
  }

  for (const color of affectedColors) {
    if (!isColorConnected(nextBoard, color)) {
      return false;
    }
  }

  return true;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < size.value && col >= 0 && col < size.value;
}

function getMissingColors(boardState: number[][]): number[] {
  const used = new Set(getUsedColors(boardState));

  return playableColors.value.filter((color) => !used.has(color));
}

function isColorPlayable(color: number): boolean {
  return color < size.value;
}

function getUnassignedPositions(boardState: number[][]): Array<{ row: number; col: number }> {
  const positions: Array<{ row: number; col: number }> = [];

  for (let row = 0; row < boardState.length; row++) {
    for (let col = 0; col < boardState[row]!.length; col++) {
      if ((boardState[row]![col] ?? -1) < 0) {
        positions.push({ row, col });
      }
    }
  }

  return positions;
}

function createBlankBoard(): void {
  size.value = draftSize.value;
  previewBoard.value = createEmptyBoard(size.value);
  selectedColor.value = Math.min(selectedColor.value, Math.max(0, size.value - 1));
  isEraseMode.value = false;
}

async function waitForUiPaint(): Promise<void> {
  await nextTick();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function generateBoardInBackground(size: number, difficulty: PuzzleDifficulty): Promise<number[][]> {
  const worker = generatorWorker.value;
  if (!worker) {
    return generatePuzzleBoard(size, difficulty);
  }

  return await new Promise<number[][]>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<{ board?: number[][]; error?: string }>) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);

      if (event.data?.error) {
        reject(new Error(event.data.error));
        return;
      }

      if (!event.data?.board) {
        reject(new Error("Worker did not return a board"));
        return;
      }

      resolve(event.data.board);
    };

    const handleError = (event: ErrorEvent) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      reject(new Error(event.message || "Worker generation failed"));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ size, difficulty });
  });
}

async function generatePreview(): Promise<void> {
  if (isGenerating.value) {
    return;
  }

  isGenerating.value = true;
  await waitForUiPaint();

  size.value = draftSize.value;

  try {
    previewBoard.value = await generateBoardInBackground(size.value, draftDifficulty.value);
  } catch {
    // Fallback keeps generation functional if worker initialization fails.
    previewBoard.value = generatePuzzleBoard(size.value, draftDifficulty.value);
  } finally {
    isGenerating.value = false;
  }

  selectedColor.value = Math.min(selectedColor.value, Math.max(0, size.value - 1));
  isEraseMode.value = false;
}

function getDefaultPuzzleName(puzzles: DesignedPuzzle[]): string {
  const existing = new Set(puzzles.map((puzzle) => puzzle.name.trim().toLowerCase()));
  let index = 1;

  while (existing.has(`puzzle ${index}`)) {
    index += 1;
  }

  return `Puzzle ${index}`;
}

async function openSaveDialog(): Promise<void> {
  if (!previewBoard.value.length) {
    createBlankBoard();
  }

  const nextPuzzles = loadDesignedPuzzles();
  dialogPuzzleName.value = getDefaultPuzzleName(nextPuzzles);
  saveError.value = "";
  isSaveDialogOpen.value = true;
}

function closeSaveDialog(): void {
  isSaveDialogOpen.value = false;
  saveError.value = "";
}

async function savePuzzle(): Promise<void> {
  if (!previewBoard.value.length) {
    createBlankBoard();
  }

  if (!hasValidColorRegions(previewBoard.value)) {
    saveError.value = "Each color must stay in one connected region.";
    return;
  }

  if (unassignedCellCount.value > 0) {
    saveError.value = "Please fill all uncolored cells before saving.";
    return;
  }

  if (getUsedColors(previewBoard.value).length !== size.value) {
    saveError.value = "Each puzzle should use all available region colors at least once.";
    return;
  }

  if (!hasSolvableQueenPlacement(previewBoard.value)) {
    saveError.value = "This drawing does not produce a solvable puzzle.";
    return;
  }

  const nextPuzzles = loadDesignedPuzzles();
  const newPuzzleName = dialogPuzzleName.value.trim() || getDefaultPuzzleName(nextPuzzles);
  
  // Check for duplicate names
  const isDuplicate = nextPuzzles.some(
    (puzzle) => puzzle.name.toLowerCase() === newPuzzleName.toLowerCase()
  );
  
  if (isDuplicate) {
    saveError.value = `A puzzle named "${newPuzzleName}" already exists.`;
    return;
  }

  const newPuzzle: DesignedPuzzle = {
    id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: newPuzzleName,
    size: size.value,
    board: cloneBoard(previewBoard.value),
    createdAt: Date.now(),
  };

  nextPuzzles.unshift(newPuzzle);
  saveDesignedPuzzles(nextPuzzles);
  dialogPuzzleName.value = "";
  saveError.value = "";
  isSaveDialogOpen.value = false;
  savedPuzzles.value = nextPuzzles;
}

function loadPuzzleToPreview(puzzle: DesignedPuzzle): void {
  size.value = puzzle.size;
  draftSize.value = puzzle.size;
  previewBoard.value = cloneBoard(puzzle.board);
  selectedColor.value = Math.min(selectedColor.value, Math.max(0, size.value - 1));
  isEraseMode.value = false;
}

function deletePuzzle(id: string): void {
  const nextPuzzles = loadDesignedPuzzles().filter((puzzle) => puzzle.id !== id);
  saveDesignedPuzzles(nextPuzzles);
  savedPuzzles.value = nextPuzzles;
}

function getCellColor(row: number, col: number): number {
  return previewBoard.value[row]?.[col] ?? -1;
}

function selectColor(color: number): void {
  if (!isColorPlayable(color)) {
    return;
  }

  selectedColor.value = color;
  isEraseMode.value = false;
  drawError.value = "";
}

function setEraseMode(): void {
  isEraseMode.value = true;
  drawError.value = "";
}

function paintCell(row: number, col: number): void {
  if (!previewBoard.value.length || !inBounds(row, col)) {
    return;
  }

  const nextColor = isEraseMode.value ? -1 : selectedColor.value;
  if (previewBoard.value[row]?.[col] === nextColor) {
    return;
  }

  if (!wouldPreserveColorRegions(previewBoard.value, row, col, nextColor)) {
    drawError.value = "A color must stay in one connected region.";
    return;
  }

  const nextBoard = cloneBoard(previewBoard.value);
  nextBoard[row]![col] = nextColor;
  previewBoard.value = nextBoard;
  drawError.value = "";
}

function findCellFromPointer(event: PointerEvent): { row: number; col: number } | null {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target instanceof Element ? target.closest("[data-cell-row][data-cell-col]") : null;

  if (!(cell instanceof HTMLElement)) {
    return null;
  }

  const row = Number(cell.dataset.cellRow);
  const col = Number(cell.dataset.cellCol);
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return null;
  }

  return { row, col };
}

function handlePaintPointerMove(event: PointerEvent): void {
  if (!isPaintDragging.value) {
    return;
  }

  if (activePaintPointerId.value !== null && event.pointerId !== activePaintPointerId.value) {
    return;
  }

  const cell = findCellFromPointer(event);
  if (!cell) {
    return;
  }

  paintCell(cell.row, cell.col);
}

function handlePaintPointerEnd(event: PointerEvent): void {
  if (activePaintPointerId.value !== null && event.pointerId !== activePaintPointerId.value) {
    return;
  }

  stopPaintDrag();
}

function stopPaintDrag(): void {
  isPaintDragging.value = false;
  activePaintPointerId.value = null;

  window.removeEventListener("pointermove", handlePaintPointerMove);
  window.removeEventListener("pointerup", handlePaintPointerEnd);
  window.removeEventListener("pointercancel", handlePaintPointerEnd);
}

function startPaintDrag(row: number, col: number, event: PointerEvent): void {
  if (!previewBoard.value.length) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  // Always reset stale gesture state before starting a new drag.
  stopPaintDrag();

  isPaintDragging.value = true;
  activePaintPointerId.value = event.pointerId;
  paintCell(row, col);

  window.addEventListener("pointermove", handlePaintPointerMove);
  window.addEventListener("pointerup", handlePaintPointerEnd);
  window.addEventListener("pointercancel", handlePaintPointerEnd);

  event.preventDefault();
}

function fillRemainingCells(): void {
  if (!previewBoard.value.length || !unassignedCellCount.value) {
    return;
  }

  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nextBoard = cloneBoard(previewBoard.value);

    if (getUsedColors(nextBoard).length === 0) {
      const firstCell = {
        row: randomInt(size.value),
        col: randomInt(size.value),
      };

      nextBoard[firstCell.row]![firstCell.col] = selectedColor.value;
    }

    while (getUnassignedPositions(nextBoard).length) {
      const unassigned = getUnassignedPositions(nextBoard);
      const frontier = unassigned.filter((cell) => {
        return cardinalNeighbors.some(([dr, dc]) => {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          return inBounds(nr, nc) && (nextBoard[nr]![nc] ?? -1) >= 0;
        });
      });

      if (!frontier.length) {
        const cell = unassigned[randomInt(unassigned.length)]!;
          const remainingColors = playableColors.value.filter((color) => !getUsedColors(nextBoard).includes(color));
        const seedColor = remainingColors.length ? remainingColors[randomInt(remainingColors.length)]! : randomInt(size.value);
        nextBoard[cell.row]![cell.col] = seedColor;
        continue;
      }

      const missingColors = getMissingColors(nextBoard);
      if (missingColors.length) {
        const cell = frontier[randomInt(frontier.length)]!;
        nextBoard[cell.row]![cell.col] = missingColors[randomInt(missingColors.length)]!;
        continue;
      }

      const cell = frontier[randomInt(frontier.length)]!;
      const candidateColors = new Set<number>();

      for (const [dr, dc] of cardinalNeighbors) {
        const nr = cell.row + dr;
        const nc = cell.col + dc;

        if (!inBounds(nr, nc)) {
          continue;
        }

        const neighborColor = nextBoard[nr]![nc] ?? -1;
        if (neighborColor >= 0) {
          candidateColors.add(neighborColor);
        }
      }

      const candidates = Array.from(candidateColors);
      if (candidates.length) {
        nextBoard[cell.row]![cell.col] = candidates[randomInt(candidates.length)]!;
        continue;
      }

      nextBoard[cell.row]![cell.col] = randomInt(size.value);
    }

    if (isValidCompletedPuzzle(nextBoard)) {
      previewBoard.value = nextBoard;
      drawError.value = "";
      return;
    }
  }

  drawError.value = "This drawing could not be completed into a solvable puzzle.";
}

function hasThickRightBorder(row: number, col: number): boolean {
  const currentColor = getCellColor(row, col);
  const rightColor = getCellColor(row, col + 1);
  return rightColor !== -1 && currentColor !== rightColor;
}

function hasThickBottomBorder(row: number, col: number): boolean {
  const currentColor = getCellColor(row, col);
  const bottomColor = getCellColor(row + 1, col);
  return bottomColor !== -1 && currentColor !== bottomColor;
}

onMounted(async () => {
  if (import.meta.client) {
    generatorWorker.value = new Worker(new URL("../utils/designer-generator.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  createBlankBoard();
  refreshSavedPuzzles();
});

onBeforeUnmount(() => {
  stopPaintDrag();

  generatorWorker.value?.terminate();
  generatorWorker.value = null;
});
</script>

<template>
  <main class="page-shell">
    <header class="content-header">
      <NuxtLink class="btn-back" to="/" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"/></svg>
      </NuxtLink>
      <h2>Puzzle Designer</h2>
    </header>

    <section class="layout">
      <aside class="panel">
        <label class="field" for="designer-grid-size">
          <span>Grid Size</span>
          <input
            id="designer-grid-size"
            v-model.number="draftSize"
            :min="MIN_GRID"
            :max="MAX_GRID"
            type="range"
          />
          <strong>{{ draftSize }} x {{ draftSize }}</strong>
        </label>

        <label class="field" for="designer-difficulty">
          <span>Difficulty</span>
          <select id="designer-difficulty" v-model="draftDifficulty">
            <option value="easy">Easy (logical-only)</option>
            <option value="medium">Medium (some ambiguity)</option>
          </select>
        </label>

        <div class="field">
          <span>Draw Colors</span>
          <div class="designer-colors" role="listbox" aria-label="designer color picker">
            <button
              v-for="colorIndex in paletteColors"
              :key="`designer-color-${colorIndex}`"
              class="designer-color-swatch"
              type="button"
              role="option"
              :disabled="!isColorPlayable(colorIndex)"
              :aria-selected="!isEraseMode && selectedColor === colorIndex"
              :class="{
                'designer-color-swatch-active': !isEraseMode && selectedColor === colorIndex,
                'designer-color-swatch-disabled': !isColorPlayable(colorIndex),
              }"
              :style="{ '--swatch-color': palette[colorIndex % palette.length] }"
              @click="selectColor(colorIndex)"
            >
              <span class="sr-only">Choose color {{ colorIndex + 1 }}{{ isColorPlayable(colorIndex) ? '' : ' (disabled)' }}</span>
            </button>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" type="button" :class="{ 'btn-primary': isEraseMode }" @click="setEraseMode">Eraser</button>
          </div>
        </div>

        <p class="muted">Used colors: {{ usedColorCount }} / {{ size }} · Unfilled cells: {{ unassignedCellCount }}</p>

        <div class="actions">
          <button class="btn btn-primary" type="button" :disabled="isGenerating" @click="generatePreview">{{ isGenerating ? "Generating..." : "Auto Generate" }}</button>
          <button class="btn" type="button" :disabled="isGenerating" @click="createBlankBoard">New Blank</button>
          <button class="btn" type="button" :disabled="isGenerating || !unassignedCellCount" @click="fillRemainingCells">Fill Remaining</button>
        </div>

        <div v-if="drawError" class="error-message">{{ drawError }}</div>
      </aside>

      <section class="board-wrap" aria-label="designer preview board">
        <div class="board" :style="{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }">
          <div v-for="(row, rowIndex) in previewBoard" :key="`designer-row-${rowIndex}`" class="row">
            <span
              v-for="(cellColor, colIndex) in row"
              :key="`designer-cell-${rowIndex}-${colIndex}`"
              :data-cell-row="rowIndex"
              :data-cell-col="colIndex"
              :class="[
                'cell',
                { 'cell-unassigned': cellColor < 0 },
                { 'cell-thick-right': hasThickRightBorder(rowIndex, colIndex) },
                { 'cell-thick-bottom': hasThickBottomBorder(rowIndex, colIndex) },
              ]"
              :style="cellColor >= 0 ? { '--cell-color': palette[cellColor % palette.length] } : undefined"
              @pointerdown="startPaintDrag(rowIndex, colIndex, $event)"
            />
          </div>
        </div>

        <div class="designer-board-actions">
          <button class="btn" type="button" :disabled="isGenerating" @click="openSaveDialog">Save</button>
        </div>
      </section>
    </section>

    <div v-if="isGenerating" class="modal-backdrop modal-backdrop-top">
      <section class="modal-card generating-modal" role="status" aria-live="polite" aria-label="Generating puzzle">
        <h3>Generating</h3>
        <p>Please wait.</p>
      </section>
    </div>

    <div v-if="isSaveDialogOpen" class="modal-backdrop" @click.self="closeSaveDialog">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="Save puzzle dialog">
        <h3>Save Puzzle</h3>

        <label class="field" for="save-puzzle-name">
          <span>Puzzle Name</span>
          <input id="save-puzzle-name" v-model="dialogPuzzleName" type="text" />
        </label>

        <div v-if="saveError" class="error-message">{{ saveError }}</div>

        <div class="actions">
          <button class="btn btn-primary" type="button" :disabled="isGenerating" @click="savePuzzle">Save</button>
          <button class="btn" type="button" :disabled="isGenerating" @click="closeSaveDialog">Cancel</button>
        </div>
      </section>
    </div>

    <section class="saved-list">
      <h3>Saved Puzzles</h3>
      <p v-if="!savedPuzzles.length" class="muted">No saved puzzles yet.</p>
      <div v-else class="saved-grid">
        <article v-for="puzzle in savedPuzzles" :key="puzzle.id" class="saved-card">
          <div class="saved-card-main">
            <h4>{{ puzzle.name }}</h4>
            <p class="saved-card-details">{{ puzzle.size }} x {{ puzzle.size }}</p>
          </div>
          <div class="saved-card-actions">
            <button class="btn" type="button" @click="loadPuzzleToPreview(puzzle)">Preview</button>
            <button class="btn btn-icon btn-danger" type="button" aria-label="Delete puzzle" title="Delete puzzle" @click="deletePuzzle(puzzle.id)">
              <svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 0 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1zm1 2V5h4V5zm-2 2h8v12H8z" />
              </svg>
            </button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
