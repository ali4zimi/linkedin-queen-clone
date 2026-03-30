<script setup lang="ts">
import {
  MAX_GRID,
  MIN_GRID,
  generateBoard,
  loadDesignedPuzzles,
  palette,
  saveDesignedPuzzles,
  type DesignedPuzzle,
} from "~/composables/useQueens";

const size = ref(8);
const draftSize = ref(8);
const dialogPuzzleName = ref("");
const previewBoard = ref<number[][]>([]);
const savedPuzzles = ref<DesignedPuzzle[]>([]);
const saveError = ref("");
const isSaveDialogOpen = ref(false);

watch(dialogPuzzleName, () => {
  saveError.value = "";
});

function refreshSavedPuzzles(): void {
  savedPuzzles.value = loadDesignedPuzzles();
}

function generatePreview(): void {
  size.value = draftSize.value;
  previewBoard.value = generateBoard(size.value, size.value);
}

function getDefaultPuzzleName(puzzles: DesignedPuzzle[]): string {
  const existing = new Set(puzzles.map((puzzle) => puzzle.name.trim().toLowerCase()));
  let index = 1;

  while (existing.has(`puzzle ${index}`)) {
    index += 1;
  }

  return `Puzzle ${index}`;
}

function openSaveDialog(): void {
  if (!previewBoard.value.length) {
    generatePreview();
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

function savePuzzle(): void {
  if (!previewBoard.value.length) {
    generatePreview();
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
    board: previewBoard.value,
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
  previewBoard.value = puzzle.board;
}

function deletePuzzle(id: string): void {
  const nextPuzzles = loadDesignedPuzzles().filter((puzzle) => puzzle.id !== id);
  saveDesignedPuzzles(nextPuzzles);
  savedPuzzles.value = nextPuzzles;
}

function getCellColor(row: number, col: number): number {
  return previewBoard.value[row]?.[col] ?? -1;
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

onMounted(() => {
  generatePreview();
  refreshSavedPuzzles();
});
</script>

<template>
  <main class="page-shell">
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

        <div class="actions">
          <button class="btn btn-primary" type="button" @click="generatePreview">Generate</button>
        </div>
      </aside>

      <section class="board-wrap" aria-label="designer preview board">
        <div class="board" :style="{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }">
          <div v-for="(row, rowIndex) in previewBoard" :key="`designer-row-${rowIndex}`" class="row">
            <span
              v-for="(cellColor, colIndex) in row"
              :key="`designer-cell-${rowIndex}-${colIndex}`"
              :class="[
                'cell',
                { 'cell-thick-right': hasThickRightBorder(rowIndex, colIndex) },
                { 'cell-thick-bottom': hasThickBottomBorder(rowIndex, colIndex) },
              ]"
              :style="{ '--cell-color': palette[cellColor % palette.length] }"
            />
          </div>
        </div>

        <div class="designer-board-actions">
          <button class="btn" type="button" @click="openSaveDialog">Save</button>
        </div>
      </section>
    </section>

    <div v-if="isSaveDialogOpen" class="modal-backdrop" @click.self="closeSaveDialog">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="Save puzzle dialog">
        <h3>Save Puzzle</h3>

        <label class="field" for="save-puzzle-name">
          <span>Puzzle Name</span>
          <input id="save-puzzle-name" v-model="dialogPuzzleName" type="text" />
        </label>

        <div v-if="saveError" class="error-message">{{ saveError }}</div>

        <div class="actions">
          <button class="btn btn-primary" type="button" @click="savePuzzle">Save</button>
          <button class="btn" type="button" @click="closeSaveDialog">Cancel</button>
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
