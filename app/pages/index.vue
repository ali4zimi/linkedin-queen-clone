<script setup lang="ts">
import {
  getQueenKeys,
  keyOf,
  loadDesignedPuzzles,
  palette,
  type CellMark,
  type DesignedPuzzle,
  validateQueens,
} from "~/composables/useQueens";

const gridSize = ref(0);
const board = ref<number[][]>([]);
const marks = ref<Record<string, CellMark>>({});
const history = ref<Record<string, CellMark>[]>([]);

const savedPuzzles = ref<DesignedPuzzle[]>([]);
const selectedPuzzleId = ref("");
const isGameStarted = ref(false);
const isInstructionOpen = ref(false);
const isSettingsOpen = ref(false);
const isSolvedDialogOpen = ref(false);
const hintMessage = ref("");
const showTimer = ref(true);
const autoCheck = ref(true);
const autoPlaceXs = ref(false);
const settingsMenuRef = ref<HTMLElement | null>(null);
const SETTINGS_STORAGE_KEY = "queen-competition-settings";
const isDragMarking = ref(false);
const hasDragHistoryEntry = ref(false);
const suppressNextClick = ref(false);
const dragStartCell = ref<{ row: number; col: number } | null>(null);
const dragStartPoint = ref<{ x: number; y: number } | null>(null);
const DRAG_START_DISTANCE = 6;

const startedAt = ref(Date.now());
const now = ref(Date.now());
let timerHandle: ReturnType<typeof setInterval> | null = null;

const selectedPuzzle = computed(() => {
  return savedPuzzles.value.find((puzzle) => puzzle.id === selectedPuzzleId.value) ?? null;
});

const queenKeys = computed(() => getQueenKeys(marks.value));
const validation = computed(() => {
  return validateQueens(board.value, queenKeys.value, gridSize.value);
});

const elapsedSeconds = computed(() => {
  return Math.floor((now.value - startedAt.value) / 1000);
});

const formattedTimer = computed(() => {
  const total = elapsedSeconds.value;
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
});

const canUndo = computed(() => history.value.length > 0);
const displayMarks = computed(() => applyAutoXs(marks.value));

function startTimerTicker(): void {
  if (timerHandle) {
    return;
  }

  timerHandle = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

function stopTimerTicker(): void {
  if (!timerHandle) {
    return;
  }

  clearInterval(timerHandle);
  timerHandle = null;
}

function pushHistory(): void {
  history.value.push({ ...marks.value });
}

function cycleMark(row: number, col: number): void {
  if (!isGameStarted.value) {
    return;
  }

  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }

  pushHistory();
  const key = keyOf(row, col);
  const nextMarks = { ...marks.value };
  const current = cellMark(row, col);
  const next = ((current + 1) % 3) as CellMark;

  if (next === 0) {
    delete nextMarks[key];
  } else {
    nextMarks[key] = next;
  }

  marks.value = nextMarks;
}

function placeCrossMark(row: number, col: number): void {
  if (!isGameStarted.value) {
    return;
  }

  const key = keyOf(row, col);
  const current = marks.value[key] ?? 0;

  // Keep existing queens intact during drag-to-mark.
  if (current === 2 || current === 1) {
    return;
  }

  if (!hasDragHistoryEntry.value) {
    pushHistory();
    hasDragHistoryEntry.value = true;
    suppressNextClick.value = true;
  }

  marks.value = {
    ...marks.value,
    [key]: 1,
  };
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

function handleDragPointerMove(event: PointerEvent): void {
  if (!isDragMarking.value) {
    return;
  }

  const startPoint = dragStartPoint.value;
  const startCell = dragStartCell.value;
  if (!startPoint || !startCell) {
    return;
  }

  const movedX = event.clientX - startPoint.x;
  const movedY = event.clientY - startPoint.y;
  const movedEnough = Math.hypot(movedX, movedY) >= DRAG_START_DISTANCE;

  if (!hasDragHistoryEntry.value && !movedEnough) {
    return;
  }

  if (!hasDragHistoryEntry.value) {
    placeCrossMark(startCell.row, startCell.col);
  }

  const cell = findCellFromPointer(event);
  if (!cell) {
    return;
  }

  placeCrossMark(cell.row, cell.col);
}

function stopDragMarking(): void {
  isDragMarking.value = false;
  hasDragHistoryEntry.value = false;
  dragStartCell.value = null;
  dragStartPoint.value = null;

  window.removeEventListener("pointermove", handleDragPointerMove);
  window.removeEventListener("pointerup", stopDragMarking);
  window.removeEventListener("pointercancel", stopDragMarking);
}

function startDragMarking(row: number, col: number, event: PointerEvent): void {
  if (!isGameStarted.value) {
    return;
  }

  // Reset any stale suppression from prior gestures.
  suppressNextClick.value = false;
  isDragMarking.value = true;
  hasDragHistoryEntry.value = false;
  dragStartCell.value = { row, col };
  dragStartPoint.value = { x: event.clientX, y: event.clientY };

  window.addEventListener("pointermove", handleDragPointerMove);
  window.addEventListener("pointerup", stopDragMarking);
  window.addEventListener("pointercancel", stopDragMarking);

  if (event.pointerType === "touch") {
    event.preventDefault();
  }
}

function cellMark(row: number, col: number): CellMark {
  return displayMarks.value[keyOf(row, col)] ?? 0;
}

function isQueen(row: number, col: number): boolean {
  return cellMark(row, col) === 2;
}

function isCross(row: number, col: number): boolean {
  return cellMark(row, col) === 1;
}

function isInvalidQueen(row: number, col: number): boolean {
  if (!autoCheck.value) {
    return false;
  }

  return validation.value.invalid.has(keyOf(row, col));
}

function getCellColor(row: number, col: number): number {
  return board.value[row]?.[col] ?? -1;
}

function hasQueenConflict(row: number, col: number, queens: Set<string>): boolean {
  const cellColor = getCellColor(row, col);

  for (const key of queens) {
    const parts = key.split(":");
    const queenRow = Number(parts[0]);
    const queenCol = Number(parts[1]);

    if (!Number.isFinite(queenRow) || !Number.isFinite(queenCol)) {
      continue;
    }

    const rowGap = Math.abs(queenRow - row);
    const colGap = Math.abs(queenCol - col);

    if (queenRow === row || queenCol === col) {
      return true;
    }

    if (rowGap <= 1 && colGap <= 1) {
      return true;
    }

    if (getCellColor(queenRow, queenCol) === cellColor) {
      return true;
    }
  }

  return false;
}

function applyAutoXs(sourceMarks: Record<string, CellMark>): Record<string, CellMark> {
  if (!autoPlaceXs.value) {
    return sourceMarks;
  }

  const nextMarks = { ...sourceMarks };
  const queens = getQueenKeys(sourceMarks);

  for (let row = 0; row < gridSize.value; row++) {
    for (let col = 0; col < gridSize.value; col++) {
      const key = keyOf(row, col);
      if (nextMarks[key] === 2) {
        continue;
      }

      if (hasQueenConflict(row, col, queens)) {
        nextMarks[key] = 1;
      }
    }
  }

  return nextMarks;
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

function clearMarks(): void {
  if (!Object.keys(marks.value).length) {
    return;
  }

  pushHistory();
  marks.value = {};
  isSolvedDialogOpen.value = false;
  hintMessage.value = "";
}

function undoLastMove(): void {
  const previous = history.value.pop();
  if (!previous) {
    return;
  }

  marks.value = previous;
}

function backToSelection(): void {
  stopTimerTicker();
  isGameStarted.value = false;
  selectedPuzzleId.value = "";
  board.value = [];
  marks.value = {};
  history.value = [];
  isSolvedDialogOpen.value = false;
  hintMessage.value = "";
}

function refreshSavedPuzzles(): void {
  stopTimerTicker();
  savedPuzzles.value = loadDesignedPuzzles();
  isGameStarted.value = false;
  selectedPuzzleId.value = "";
  board.value = [];
  marks.value = {};
  history.value = [];
  isSolvedDialogOpen.value = false;
  hintMessage.value = "";
}

function startGame(): void {
  const found = selectedPuzzle.value;
  if (!found) {
    return;
  }

  gridSize.value = found.size;
  board.value = found.board;
  marks.value = {};
  history.value = [];
  isGameStarted.value = true;
  isSolvedDialogOpen.value = false;
  hintMessage.value = "";
  
  // Start timer when game begins
  startedAt.value = Date.now();
  now.value = Date.now();
  stopTimerTicker();
  startTimerTicker();
}

function showHintComingSoon(): void {
  hintMessage.value = "Comming soon";
}

function handleWindowPointerDown(event: PointerEvent): void {
  if (!isSettingsOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!settingsMenuRef.value?.contains(target)) {
    isSettingsOpen.value = false;
  }
}

function loadSettingsFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as {
      showTimer?: boolean;
      autoCheck?: boolean;
      autoPlaceXs?: boolean;
    };

    if (typeof parsed.showTimer === "boolean") {
      showTimer.value = parsed.showTimer;
    }

    if (typeof parsed.autoCheck === "boolean") {
      autoCheck.value = parsed.autoCheck;
    }

    if (typeof parsed.autoPlaceXs === "boolean") {
      autoPlaceXs.value = parsed.autoPlaceXs;
    }
  } catch {
    // Ignore invalid stored settings.
  }
}

function saveSettingsToStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    showTimer: showTimer.value,
    autoCheck: autoCheck.value,
    autoPlaceXs: autoPlaceXs.value,
  };

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
}

watch([showTimer, autoCheck, autoPlaceXs], () => {
  saveSettingsToStorage();
});

watch(
  () => validation.value.hasWon,
  (hasWon) => {
    if (!isGameStarted.value) {
      isSolvedDialogOpen.value = false;
      return;
    }

    if (hasWon) {
      now.value = Date.now();
      stopTimerTicker();
    }

    isSolvedDialogOpen.value = hasWon;
  },
);

onMounted(() => {
  loadSettingsFromStorage();

  window.addEventListener("pointerdown", handleWindowPointerDown);
  refreshSavedPuzzles();
});

onBeforeUnmount(() => {
  stopDragMarking();

  stopTimerTicker();

  window.removeEventListener("pointerdown", handleWindowPointerDown);
});
</script>

<template>
  <main class="page-shell">
    <section v-if="!isGameStarted" class="layout">
      <aside class="panel">
        <h3>Select Puzzle</h3>

        <div class="saved-row">
          <select v-model="selectedPuzzleId">
            <option value="">Choose a saved puzzle...</option>
            <option v-for="puzzle in savedPuzzles" :key="puzzle.id" :value="puzzle.id">
              {{ puzzle.name }} ({{ puzzle.size }}x{{ puzzle.size }})
            </option>
          </select>
          <button class="btn btn-primary" type="button" @click="startGame" :disabled="!selectedPuzzleId">
            Start Game
          </button>
          <button class="btn" type="button" @click="refreshSavedPuzzles">Refresh</button>
        </div>

        <div class="empty-state">
          <p>Select a saved puzzle and click Start Game.</p>
          <p><NuxtLink to="/designer" class="link">Create a new puzzle in the Designer.</NuxtLink></p>
        </div>
      </aside>
    </section>

    <section v-else class="game-container">
      <nav class="game-navbar" aria-label="game navigation">
        <button class="btn-back" type="button" aria-label="Back" @click="backToSelection">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"/></svg>
        </button>

        <div ref="settingsMenuRef" class="settings-wrap">
          <button
            class="btn-settings"
            type="button"
            :aria-expanded="isSettingsOpen"
            aria-controls="game-settings-menu"
            @click="isSettingsOpen = !isSettingsOpen"
          >
            Settings
            <span class="settings-arrow" :class="{ 'settings-arrow-open': isSettingsOpen }">▾</span>
          </button>

          <div v-if="isSettingsOpen" id="game-settings-menu" class="settings-menu" role="menu">
            <button class="settings-toggle" type="button" role="menuitemcheckbox" :aria-checked="showTimer" @click="showTimer = !showTimer">
              <span>Show timer</span>
              <span class="toggle-state" :class="{ 'toggle-state-on': showTimer }">{{ showTimer ? "On" : "Off" }}</span>
            </button>

            <button class="settings-toggle" type="button" role="menuitemcheckbox" :aria-checked="autoCheck" @click="autoCheck = !autoCheck">
              <span>Auto-check</span>
              <span class="toggle-state" :class="{ 'toggle-state-on': autoCheck }">{{ autoCheck ? "On" : "Off" }}</span>
            </button>

            <button class="settings-toggle" type="button" role="menuitemcheckbox" :aria-checked="autoPlaceXs" @click="autoPlaceXs = !autoPlaceXs">
              <span>Auto-place X's</span>
              <span class="toggle-state" :class="{ 'toggle-state-on': autoPlaceXs }">{{ autoPlaceXs ? "On" : "Off" }}</span>
            </button>
          </div>
        </div>
      </nav>

      <header class="game-header">
        <span v-if="showTimer" class="timer-pill game-timer">{{ formattedTimer }}</span>
        <span v-else class="game-timer-placeholder" aria-hidden="true"></span>
        <span class="game-puzzle-name">{{ selectedPuzzle?.name || "Saved Puzzle" }}</span>
        <button class="btn btn-secondary btn-sm game-reset" type="button" @click="clearMarks">Reset</button>
      </header>

      <section class="board-wrap" aria-label="play board">
        <div class="board play-board" :style="{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }">
          <div v-for="(row, rowIndex) in board" :key="`play-row-${rowIndex}`" class="row">
            <div
              v-for="(cellColor, colIndex) in row"
              :key="`play-cell-${rowIndex}-${colIndex}`"
              :data-cell-row="rowIndex"
              :data-cell-col="colIndex"
              :class="[
                'cell',
                { 'cell-queen': isQueen(rowIndex, colIndex) },
                { 'cell-cross': isCross(rowIndex, colIndex) },
                { 'cell-invalid': isInvalidQueen(rowIndex, colIndex) },
                { 'cell-thick-right': hasThickRightBorder(rowIndex, colIndex) },
                { 'cell-thick-bottom': hasThickBottomBorder(rowIndex, colIndex) },
              ]"
              :style="{ '--cell-color': palette[cellColor % palette.length] }"
              @pointerdown="startDragMarking(rowIndex, colIndex, $event)"
              @click="cycleMark(rowIndex, colIndex)"
            >
              <span v-if="isCross(rowIndex, colIndex)" class="cross-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    d="m6 6l12 12m0-12L6 18"
                  />
                </svg>
              </span>
              <span v-else-if="isQueen(rowIndex, colIndex)" class="queen-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M24 6.25A3 3 0 1 0 19.74 9c-.47 1.38-1.53 3.79-3.24 3.79c-2.3 0-3-3.14-3.53-6.17a3 3 0 1 0-1.94 0c-.56 3.09-1.24 6.17-3.53 6.17c-1.71 0-2.77-2.41-3.24-3.79a3 3 0 1 0-2.13.15l1.63 9.8a1 1 0 0 0 1 .84h14.5a1 1 0 0 0 1-.84l1.63-9.8A3 3 0 0 0 24 6.25m-4.75 15H4.75a1 1 0 0 0 0 2h14.5a1 1 0 0 0 0-2"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div class="game-bottombar">
          <button class="btn" type="button" :disabled="!canUndo" @click="undoLastMove">Undo</button>
          <button class="btn" type="button" @click="showHintComingSoon">Hint</button>
        </div>
        <p v-if="hintMessage" class="hint-message">{{ hintMessage }}</p>

        <div class="instruction-card" role="note" aria-label="game instructions">
          <button
            class="instruction-toggle"
            type="button"
            :aria-expanded="isInstructionOpen"
            aria-controls="how-to-play-content"
            @click="isInstructionOpen = !isInstructionOpen"
          >
            <span class="instruction-title">How to Play</span>
            <span class="instruction-arrow" :class="{ 'instruction-arrow-open': isInstructionOpen }">▾</span>
          </button>

          <ol v-show="isInstructionOpen" id="how-to-play-content" class="instruction-list">
            <li>
              Place exactly one
              <strong class="instruction-mark" aria-label="queen mark">
                <span class="queen-icon instruction-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M24 6.25A3 3 0 1 0 19.74 9c-.47 1.38-1.53 3.79-3.24 3.79c-2.3 0-3-3.14-3.53-6.17a3 3 0 1 0-1.94 0c-.56 3.09-1.24 6.17-3.53 6.17c-1.71 0-2.77-2.41-3.24-3.79a3 3 0 1 0-2.13.15l1.63 9.8a1 1 0 0 0 1 .84h14.5a1 1 0 0 0 1-.84l1.63-9.8A3 3 0 0 0 24 6.25m-4.75 15H4.75a1 1 0 0 0 0 2h14.5a1 1 0 0 0 0-2"
                    />
                  </svg>
                </span>
              </strong>
              in every row, every column, and each color region.
            </li>
            <li>
              Tap once to mark
              <strong class="instruction-mark" aria-label="cross mark">
                <span class="cross-icon instruction-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" stroke-linecap="round" d="m6 6l12 12m0-12L6 18" />
                  </svg>
                </span>
              </strong>,
              tap twice to place
              <strong class="instruction-mark" aria-label="queen mark">
                <span class="queen-icon instruction-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M24 6.25A3 3 0 1 0 19.74 9c-.47 1.38-1.53 3.79-3.24 3.79c-2.3 0-3-3.14-3.53-6.17a3 3 0 1 0-1.94 0c-.56 3.09-1.24 6.17-3.53 6.17c-1.71 0-2.77-2.41-3.24-3.79a3 3 0 1 0-2.13.15l1.63 9.8a1 1 0 0 0 1 .84h14.5a1 1 0 0 0 1-.84l1.63-9.8A3 3 0 0 0 24 6.25m-4.75 15H4.75a1 1 0 0 0 0 2h14.5a1 1 0 0 0 0-2"
                    />
                  </svg>
                </span>
              </strong>,
              and use
              <strong class="instruction-mark" aria-label="cross mark">
                <span class="cross-icon instruction-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" stroke-linecap="round" d="m6 6l12 12m0-12L6 18" />
                  </svg>
                </span>
              </strong>
              to mark blocked cells.
            </li>
            <li>
              Two
              <strong class="instruction-mark" aria-label="queen mark">
                <span class="queen-icon instruction-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M24 6.25A3 3 0 1 0 19.74 9c-.47 1.38-1.53 3.79-3.24 3.79c-2.3 0-3-3.14-3.53-6.17a3 3 0 1 0-1.94 0c-.56 3.09-1.24 6.17-3.53 6.17c-1.71 0-2.77-2.41-3.24-3.79a3 3 0 1 0-2.13.15l1.63 9.8a1 1 0 0 0 1 .84h14.5a1 1 0 0 0 1-.84l1.63-9.8A3 3 0 0 0 24 6.25m-4.75 15H4.75a1 1 0 0 0 0 2h14.5a1 1 0 0 0 0-2"
                    />
                  </svg>
                </span>
              </strong>
              cannot touch, including diagonal neighbors.
            </li>
          </ol>
        </div>
      </section>
    </section>

    <div v-if="isSolvedDialogOpen" class="modal-backdrop" @click.self="isSolvedDialogOpen = false">
      <section class="modal-card solved-modal" role="dialog" aria-modal="true" aria-label="Puzzle solved dialog">
        <h3>Puzzle Solved!</h3>
        <p class="status status-win">Great job. You solved this puzzle.</p>
        <p class="status">Time: {{ formattedTimer }}</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" @click="isSolvedDialogOpen = false">Continue</button>
          <button class="btn" type="button" @click="backToSelection">Back to Puzzles</button>
        </div>
      </section>
    </div>
  </main>
</template>
