(() => {
  const STORAGE_KEY = "solvers-notebook-state-v1";
  const { generatePuzzle, computeCandidates, getHint, isBoardComplete, findConflicts, cloneGrid } = window.SudokuEngine;

  let state = null; // full game state, see newGame()
  let timerInterval = null;

  const boardEl = document.getElementById("board");
  const numpadEl = document.getElementById("mobileNumpad");
  const timerDisplay = document.getElementById("timerDisplay");
  const mistakesDisplay = document.getElementById("mistakesDisplay");
  const difficultyDisplay = document.getElementById("difficultyDisplay");
  const hintOutput = document.getElementById("hintOutput");
  const winOverlay = document.getElementById("winOverlay");

  function newGame(difficulty) {
    const { puzzle, solution } = generatePuzzle(difficulty);
    state = {
      difficulty,
      givens: cloneGrid(puzzle),
      grid: cloneGrid(puzzle),
      solution,
      notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set())),
      selected: null,
      notesMode: false,
      mistakes: 0,
      seconds: 0,
      history: [],
      hintCell: null,
      won: false,
    };
    difficultyDisplay.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
    hintOutput.classList.remove("show");
    winOverlay.classList.remove("show");
    closeSettings();
    startTimer();
    saveState();
    render();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (state.won) return;
      state.seconds++;
      timerDisplay.textContent = formatTime(state.seconds);
      if (state.seconds % 5 === 0) saveState();
    }, 1000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  // ---------------- Persistence ----------------
  function saveState() {
    const serializable = {
      difficulty: state.difficulty,
      givens: state.givens,
      grid: state.grid,
      solution: state.solution,
      notes: state.notes.map(row => row.map(set => [...set])),
      mistakes: state.mistakes,
      seconds: state.seconds,
      won: state.won,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)); } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state = {
        difficulty: data.difficulty,
        givens: data.givens,
        grid: data.grid,
        solution: data.solution,
        notes: data.notes.map(row => row.map(arr => new Set(arr))),
        selected: null,
        notesMode: false,
        mistakes: data.mistakes,
        seconds: data.seconds,
        history: [],
        hintCell: null,
        won: data.won,
      };
      difficultyDisplay.textContent = state.difficulty[0].toUpperCase() + state.difficulty.slice(1);
      timerDisplay.textContent = formatTime(state.seconds);
      mistakesDisplay.textContent = `${state.mistakes} ✕`;
      if (!state.won) startTimer();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------- Rendering ----------------
  function render() {
    boardEl.innerHTML = "";
    const conflicts = findConflicts(state.grid);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (r % 3 === 0) cell.classList.add("row-thick-top");
        if (r === 8) cell.classList.add("row-thick-bottom");

        const val = state.grid[r][c];
        const isGiven = state.givens[r][c] !== 0;
        if (isGiven) cell.classList.add("given");
        else if (val !== 0) cell.classList.add("user");

        if (conflicts.has(`${r},${c}`)) cell.classList.add("conflict");

        if (state.selected) {
          const [sr, sc] = state.selected;
          if (sr === r && sc === c) cell.classList.add("selected");
          else if (sr === r || sc === c || (Math.floor(sr / 3) === Math.floor(r / 3) && Math.floor(sc / 3) === Math.floor(c / 3))) {
            cell.classList.add("peer");
          }
          const selVal = state.grid[sr][sc];
          if (selVal !== 0 && selVal === val) cell.classList.add("same-value");
        }

        if (state.hintCell && state.hintCell[0] === r && state.hintCell[1] === c) {
          cell.classList.add("hint-target");
        }

        if (val !== 0) {
          const span = document.createElement("span");
          span.className = "value";
          span.textContent = val;
          cell.appendChild(span);
        } else if (state.notes[r][c].size > 0) {
          const notesGrid = document.createElement("div");
          notesGrid.className = "notes-grid";
          for (let n = 1; n <= 9; n++) {
            const span = document.createElement("span");
            span.textContent = state.notes[r][c].has(n) ? n : "";
            notesGrid.appendChild(span);
          }
          cell.appendChild(notesGrid);
        }

        cell.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(cell);
      }
    }
    renderNumpad();
    mistakesDisplay.textContent = `${state.mistakes} ✕`;
  }

  function renderNumpad() {
    numpadEl.innerHTML = "";
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (state.grid[r][c] !== 0) counts[state.grid[r][c]]++;

    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement("button");
      btn.className = "num-btn";
      btn.textContent = n;
      if (counts[n] >= 9) btn.classList.add("exhausted");
      btn.addEventListener("click", () => inputNumber(n));
      numpadEl.appendChild(btn);
    }
  }

  function selectCell(r, c) {
    state.selected = [r, c];
    hintOutput.classList.remove("show");
    render();
  }

  function pushHistory() {
    state.history.push({
      grid: cloneGrid(state.grid),
      notes: state.notes.map(row => row.map(s => new Set(s))),
      mistakes: state.mistakes,
    });
    if (state.history.length > 50) state.history.shift();
  }

  function inputNumber(n) {
    if (!state.selected || state.won) return;
    const [r, c] = state.selected;
    if (state.givens[r][c] !== 0) return;

    pushHistory();

    if (state.notesMode) {
      if (state.notes[r][c].has(n)) state.notes[r][c].delete(n);
      else state.notes[r][c].add(n);
    } else {
      state.grid[r][c] = n;
      state.notes[r][c].clear();
      if (state.solution[r][c] !== n) {
        state.mistakes++;
      }
      // clear this number from notes of peers for convenience
      clearNoteFromPeers(r, c, n);
    }
    saveState();
    render();
    checkWin();
  }

  function clearNoteFromPeers(r, c, n) {
    for (let i = 0; i < 9; i++) {
      state.notes[r][i].delete(n);
      state.notes[i][c].delete(n);
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        state.notes[br + dr][bc + dc].delete(n);
  }

  function eraseCell() {
    if (!state.selected) return;
    const [r, c] = state.selected;
    if (state.givens[r][c] !== 0) return;
    pushHistory();
    state.grid[r][c] = 0;
    state.notes[r][c].clear();
    saveState();
    render();
  }

  function undo() {
    const prev = state.history.pop();
    if (!prev) return;
    state.grid = prev.grid;
    state.notes = prev.notes;
    state.mistakes = prev.mistakes;
    saveState();
    render();
  }

  function checkWin() {
    if (isBoardComplete(state.grid) && findConflicts(state.grid).size === 0) {
      state.won = true;
      saveState();
      document.getElementById("winTime").textContent = formatTime(state.seconds);
      document.getElementById("winMistakes").textContent = `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}`;
      winOverlay.classList.add("show");
    }
  }

  function showHint(level) {
    const hint = getHint(state.grid, level);
    state.hintCell = hint.cell || null;
    let html = `<span class="hint-technique">${hint.technique}</span>${hint.explanation}`;
    if (level === "nudge" && hint.cell) {
      html += ` <button class="hint-reveal-link" id="hintRevealLink">Show the full move</button>`;
    }
    hintOutput.innerHTML = html;
    hintOutput.classList.add("show");
    render();
    const revealLink = document.getElementById("hintRevealLink");
    if (revealLink) revealLink.addEventListener("click", () => showHint("reveal"));
  }

  // ---------------- Wiring ----------------
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  function openSettings() { settingsBackdrop.classList.add("show"); }
  function closeSettings() { settingsBackdrop.classList.remove("show"); }
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  settingsBackdrop.addEventListener("click", (e) => {
    if (e.target === settingsBackdrop) closeSettings();
  });

  document.getElementById("newPuzzleBtn").addEventListener("click", () => {
    const active = document.querySelector(".chip.active");
    newGame(active ? active.dataset.diff : "medium");
  });
  document.getElementById("winNewBtn").addEventListener("click", () => {
    const active = document.querySelector(".chip.active");
    newGame(active ? active.dataset.diff : "medium");
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
  document.querySelector('.chip[data-diff="medium"]').classList.add("active");

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("eraseBtn").addEventListener("click", eraseCell);

  const notesBtn = document.getElementById("notesBtn");
  notesBtn.addEventListener("click", () => {
    state.notesMode = !state.notesMode;
    notesBtn.classList.toggle("on", state.notesMode);
  });

  document.getElementById("hintBtn").addEventListener("click", () => showHint("nudge"));

  document.getElementById("checkBtn").addEventListener("click", () => {
    render();
    const conflicts = findConflicts(state.grid);
    hintOutput.innerHTML = conflicts.size > 0
      ? `<span class="hint-technique">Check</span>Found ${conflicts.size} conflicting cell${conflicts.size === 1 ? "" : "s"} — highlighted in red.`
      : `<span class="hint-technique">Check</span>No conflicts so far. Keep going.`;
    hintOutput.classList.add("show");
  });

  // Physical keyboard support (useful with a Fold's larger screen / attached keyboard)
  document.addEventListener("keydown", (e) => {
    if (!state.selected) return;
    const [r, c] = state.selected;
    if (e.key >= "1" && e.key <= "9") inputNumber(parseInt(e.key, 10));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") eraseCell();
    else if (e.key === "ArrowUp") selectCell(Math.max(0, r - 1), c);
    else if (e.key === "ArrowDown") selectCell(Math.min(8, r + 1), c);
    else if (e.key === "ArrowLeft") selectCell(r, Math.max(0, c - 1));
    else if (e.key === "ArrowRight") selectCell(r, Math.min(8, c + 1));
  });

  // ---------------- Install prompt (PWA) ----------------
  let deferredInstallPrompt = null;
  const installBanner = document.getElementById("installBanner");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!localStorage.getItem("install-dismissed")) installBanner.classList.add("show");
  });
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBanner.classList.remove("show");
  });
  document.getElementById("dismissInstall").addEventListener("click", () => {
    installBanner.classList.remove("show");
    localStorage.setItem("install-dismissed", "1");
  });

  // ---------------- Service worker ----------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  // ---------------- Boot ----------------
  if (!loadState()) {
    newGame("medium");
  } else {
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.diff === state.difficulty));
    render();
  }
})();
