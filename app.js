(() => {
  const STORAGE_KEY = "solvers-notebook-state-v3";
  const { generatePuzzle, computeCandidates, getHint, isBoardComplete, findConflicts, findVariantConflicts, cloneGrid } = window.SudokuEngine;

  function currentConflicts() {
    const classic = findConflicts(state.grid);
    const variant = findVariantConflicts(state.grid, { cages: state.cages, kropki: state.kropki });
    return new Set([...classic, ...variant]);
  }

  // Cell-shading palette for the "color" tool. Soft enough that given/user/
  // conflict text stays legible on top, but distinct from one another.
  const CELL_COLORS = [
    "#E15D50", // red
    "#E8922E", // orange
    "#E8C93A", // yellow
    "#7CBA4E", // green
    "#3FAF95", // teal
    "#4A8FCB", // blue
    "#7B6FC4", // indigo
    "#D162A4", // pink
    "#9C8F72", // stone
  ];

  let state = null; // full game state, see newGame()
  let timerInterval = null;

  const boardEl = document.getElementById("boardGrid");
  const numpadEl = document.getElementById("mobileNumpad");
  const timerDisplay = document.getElementById("timerDisplay");
  const difficultyDisplay = document.getElementById("difficultyDisplay");
  const hintOutput = document.getElementById("hintOutput");
  const winOverlay = document.getElementById("winOverlay");
  const hintBtn = document.getElementById("hintBtn");

  function emptyNotes() {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  }
  function emptyColors() {
    return Array.from({ length: 9 }, () => Array(9).fill(null));
  }
  function cloneNotes(notes) {
    return notes.map(row => row.map(s => new Set(s)));
  }
  function cloneColors(colors) {
    return colors.map(row => row.slice());
  }

  function newGame(difficulty) {
    const { puzzle, solution } = generatePuzzle(difficulty);
    state = {
      difficulty,
      puzzleId: null,
      title: null,
      givens: cloneGrid(puzzle),
      grid: cloneGrid(puzzle),
      solution,
      cages: [],
      kropki: [],
      cornerNotes: emptyNotes(),
      centerNotes: emptyNotes(),
      colors: emptyColors(),
      selected: [],
      inputMode: "digit", // "digit" | "corner" | "center" | "color"
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
    setInputMode("digit");
    startTimer();
    saveState();
    render();
    renderConstraintOverlays();
    updateHintAvailability();
  }

  // Loads a hand-authored variant puzzle from window.PuzzleLibrary instead
  // of generating a random classic one.
  function loadPuzzle(entry) {
    state = {
      difficulty: null,
      puzzleId: entry.id,
      title: entry.title,
      givens: cloneGrid(entry.givens),
      grid: cloneGrid(entry.givens),
      solution: entry.solution,
      cages: entry.cages || [],
      kropki: entry.kropki || [],
      cornerNotes: emptyNotes(),
      centerNotes: emptyNotes(),
      colors: emptyColors(),
      selected: [],
      inputMode: "digit",
      mistakes: 0,
      seconds: 0,
      history: [],
      hintCell: null,
      won: false,
    };
    difficultyDisplay.textContent = entry.title;
    hintOutput.classList.remove("show");
    winOverlay.classList.remove("show");
    closeSettings();
    setInputMode("digit");
    startTimer();
    saveState();
    render();
    renderConstraintOverlays();
    updateHintAvailability();
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
      puzzleId: state.puzzleId,
      title: state.title,
      givens: state.givens,
      grid: state.grid,
      solution: state.solution,
      cages: state.cages,
      kropki: state.kropki,
      cornerNotes: state.cornerNotes.map(row => row.map(set => [...set])),
      centerNotes: state.centerNotes.map(row => row.map(set => [...set])),
      colors: state.colors,
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
        puzzleId: data.puzzleId || null,
        title: data.title || null,
        givens: data.givens,
        grid: data.grid,
        solution: data.solution,
        cages: data.cages || [],
        kropki: data.kropki || [],
        cornerNotes: data.cornerNotes.map(row => row.map(arr => new Set(arr))),
        centerNotes: data.centerNotes.map(row => row.map(arr => new Set(arr))),
        colors: data.colors,
        selected: [],
        inputMode: "digit",
        mistakes: data.mistakes,
        seconds: data.seconds,
        history: [],
        hintCell: null,
        won: data.won,
      };
      difficultyDisplay.textContent = state.title || (state.difficulty[0].toUpperCase() + state.difficulty.slice(1));
      timerDisplay.textContent = formatTime(state.seconds);
      setInputMode("digit");
      if (!state.won) startTimer();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------- Rendering ----------------
  function render() {
    boardEl.innerHTML = "";
    const conflicts = currentConflicts();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        const val = state.grid[r][c];
        const isGiven = state.givens[r][c] !== 0;
        if (isGiven) cell.classList.add("given");
        else if (val !== 0) cell.classList.add("user");

        if (conflicts.has(`${r},${c}`)) cell.classList.add("conflict");

        const shade = state.colors[r][c];
        if (shade !== null && shade !== undefined) {
          cell.style.setProperty("--cell-shade", CELL_COLORS[shade]);
          // Same-colored neighbors read as one shape rather than a row of
          // separate tiles — hide the thin grid line between them (the
          // thicker 3x3 box-separator overlay is unaffected either way).
          if (c < 8 && state.colors[r][c + 1] === shade) cell.style.borderRightColor = "transparent";
          if (r < 8 && state.colors[r + 1][c] === shade) cell.style.borderBottomColor = "transparent";
        }

        if (state.selected.length > 0) {
          const isSelected = state.selected.some(([sr, sc]) => sr === r && sc === c);
          if (isSelected) {
            cell.classList.add("selected");
          } else if (state.selected.some(([sr, sc]) =>
            sr === r || sc === c || (Math.floor(sr / 3) === Math.floor(r / 3) && Math.floor(sc / 3) === Math.floor(c / 3))
          )) {
            cell.classList.add("peer");
          }
          const [lr, lc] = state.selected[state.selected.length - 1];
          const anchorVal = state.grid[lr][lc];
          if (!isSelected && anchorVal !== 0 && anchorVal === val) cell.classList.add("same-value");
        }

        if (state.hintCell && state.hintCell[0] === r && state.hintCell[1] === c) {
          cell.classList.add("hint-target");
        }

        if (val !== 0) {
          const span = document.createElement("span");
          span.className = "value";
          span.textContent = val;
          cell.appendChild(span);
        } else {
          if (state.cornerNotes[r][c].size > 0) {
            const notesGrid = document.createElement("div");
            notesGrid.className = "notes-grid";
            for (let n = 1; n <= 9; n++) {
              const span = document.createElement("span");
              span.textContent = state.cornerNotes[r][c].has(n) ? n : "";
              notesGrid.appendChild(span);
            }
            cell.appendChild(notesGrid);
          }
          if (state.centerNotes[r][c].size > 0) {
            const center = document.createElement("div");
            center.className = "center-notes";
            center.textContent = [...state.centerNotes[r][c]].sort((a, b) => a - b).join("");
            cell.appendChild(center);
          }
        }

        boardEl.appendChild(cell);
      }
    }
    renderNumpad();
  }

  function renderNumpad() {
    numpadEl.innerHTML = "";
    const isColorMode = state.inputMode === "color";

    const counts = Array(10).fill(0);
    if (!isColorMode) {
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (state.grid[r][c] !== 0) counts[state.grid[r][c]]++;
    }

    let selectedColor = null;
    if (state.selected.length > 0) {
      const colorsInSelection = state.selected.map(([r, c]) => state.colors[r][c]);
      if (colorsInSelection.every(v => v === colorsInSelection[0])) selectedColor = colorsInSelection[0];
    }

    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement("button");
      btn.className = "num-btn";
      if (isColorMode) {
        btn.classList.add("color-swatch");
        btn.style.background = CELL_COLORS[n - 1];
        if (selectedColor === n - 1) btn.classList.add("active-swatch");
      } else {
        btn.textContent = n;
        if (counts[n] >= 9) btn.classList.add("exhausted");
      }
      btn.addEventListener("click", () => inputNumber(n));
      numpadEl.appendChild(btn);
    }
  }

  // Killer cages and kropki dots are static for the life of a loaded
  // puzzle, so they're drawn once (as an SVG overlay) rather than being
  // rebuilt on every render() the way cell contents are.
  const constraintOverlayEl = document.getElementById("constraintOverlay");
  function renderConstraintOverlays() {
    constraintOverlayEl.innerHTML = "";
    const hasCages = state.cages && state.cages.length > 0;
    const hasKropki = state.kropki && state.kropki.length > 0;
    if (!hasCages && !hasKropki) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "constraint-svg");
    const INSET = 1.3;

    function addLine(x1, y1, x2, y2) {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("class", "cage-line");
      svg.appendChild(line);
    }

    if (hasCages) {
      const cageOf = new Map();
      state.cages.forEach((cage, idx) => {
        cage.cells.forEach(([r, c]) => cageOf.set(`${r},${c}`, idx));
      });
      state.cages.forEach((cage, idx) => {
        const sameCage = (r, c) => cageOf.get(`${r},${c}`) === idx;
        cage.cells.forEach(([r, c]) => {
          const x0 = c * 10, y0 = r * 10, x1 = x0 + 10, y1 = y0 + 10;
          if (r === 0 || !sameCage(r - 1, c)) addLine(x0 + INSET, y0 + INSET, x1 - INSET, y0 + INSET);
          if (r === 8 || !sameCage(r + 1, c)) addLine(x0 + INSET, y1 - INSET, x1 - INSET, y1 - INSET);
          if (c === 0 || !sameCage(r, c - 1)) addLine(x0 + INSET, y0 + INSET, x0 + INSET, y1 - INSET);
          if (c === 8 || !sameCage(r, c + 1)) addLine(x1 - INSET, y0 + INSET, x1 - INSET, y1 - INSET);
        });
        let [tr, tc] = cage.cells[0];
        for (const [r, c] of cage.cells) {
          if (r < tr || (r === tr && c < tc)) { tr = r; tc = c; }
        }
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", tc * 10 + INSET + 0.6);
        text.setAttribute("y", tr * 10 + INSET + 2.6);
        text.setAttribute("class", "cage-sum");
        text.textContent = cage.sum;
        svg.appendChild(text);
      });
    }

    if (hasKropki) {
      state.kropki.forEach(dot => {
        const [r1, c1] = dot.a, [r2, c2] = dot.b;
        const cx = r1 === r2 ? Math.max(c1, c2) * 10 : c1 * 10 + 5;
        const cy = r1 === r2 ? r1 * 10 + 5 : Math.max(r1, r2) * 10;
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", 1.3);
        circle.setAttribute("class", dot.kind === "white" ? "kropki-dot kropki-white" : "kropki-dot kropki-black");
        svg.appendChild(circle);
      });
    }

    constraintOverlayEl.appendChild(svg);
  }

  function selectCell(r, c) {
    state.selected = [[r, c]];
    hintOutput.classList.remove("show");
    render();
  }

  function extendSelection(r, c) {
    if (state.selected.some(([sr, sc]) => sr === r && sc === c)) return;
    state.selected.push([r, c]);
    render();
  }

  function pushHistory() {
    state.history.push({
      grid: cloneGrid(state.grid),
      cornerNotes: cloneNotes(state.cornerNotes),
      centerNotes: cloneNotes(state.centerNotes),
      colors: cloneColors(state.colors),
      mistakes: state.mistakes,
    });
    if (state.history.length > 50) state.history.shift();
  }

  function inputNumber(n) {
    if (state.selected.length === 0 || state.won) return;

    if (state.inputMode === "color") {
      pushHistory();
      const colorIndex = n - 1;
      // If every selected cell already has this color, toggle it off everywhere;
      // otherwise set it on every selected cell.
      const allHaveColor = state.selected.every(([r, c]) => state.colors[r][c] === colorIndex);
      state.selected.forEach(([r, c]) => {
        state.colors[r][c] = allHaveColor ? null : colorIndex;
      });
      saveState();
      render();
      return;
    }

    const editable = state.selected.filter(([r, c]) => state.givens[r][c] === 0);
    if (editable.length === 0) return;

    pushHistory();

    if (state.inputMode === "corner" || state.inputMode === "center") {
      const notes = state.inputMode === "corner" ? state.cornerNotes : state.centerNotes;
      // Same smart-toggle as color: fill in whichever cells are missing the
      // candidate, unless every editable cell already has it, then clear it.
      const allHaveNote = editable.every(([r, c]) => notes[r][c].has(n));
      editable.forEach(([r, c]) => {
        if (allHaveNote) notes[r][c].delete(n);
        else notes[r][c].add(n);
      });
    } else {
      editable.forEach(([r, c]) => {
        state.grid[r][c] = n;
        state.cornerNotes[r][c].clear();
        state.centerNotes[r][c].clear();
        if (state.solution[r][c] !== n) {
          state.mistakes++;
        }
        // clear this number from notes of peers for convenience
        clearNoteFromPeers(r, c, n);
      });
    }
    saveState();
    render();
    checkWin();
  }

  function clearNoteFromPeers(r, c, n) {
    for (let i = 0; i < 9; i++) {
      state.cornerNotes[r][i].delete(n);
      state.cornerNotes[i][c].delete(n);
      state.centerNotes[r][i].delete(n);
      state.centerNotes[i][c].delete(n);
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++) {
        state.cornerNotes[br + dr][bc + dc].delete(n);
        state.centerNotes[br + dr][bc + dc].delete(n);
      }
  }

  function eraseCell() {
    if (state.selected.length === 0) return;
    pushHistory();
    state.selected.forEach(([r, c]) => {
      if (state.givens[r][c] === 0) {
        state.grid[r][c] = 0;
        state.cornerNotes[r][c].clear();
        state.centerNotes[r][c].clear();
      }
      state.colors[r][c] = null;
    });
    saveState();
    render();
  }

  function undo() {
    const prev = state.history.pop();
    if (!prev) return;
    state.grid = prev.grid;
    state.cornerNotes = prev.cornerNotes;
    state.centerNotes = prev.centerNotes;
    state.colors = prev.colors;
    state.mistakes = prev.mistakes;
    saveState();
    render();
  }

  function checkWin() {
    if (isBoardComplete(state.grid) && currentConflicts().size === 0) {
      state.won = true;
      saveState();
      document.getElementById("winTime").textContent = formatTime(state.seconds);
      document.getElementById("winMistakes").textContent = `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}`;
      winOverlay.classList.add("show");
    }
  }

  function isVariantActive() {
    return (state.cages && state.cages.length > 0) || (state.kropki && state.kropki.length > 0);
  }

  function updateHintAvailability() {
    hintBtn.classList.toggle("disabled", isVariantActive());
  }

  function showHint(level) {
    if (isVariantActive()) {
      hintOutput.innerHTML = `<span class="hint-technique">Hint</span>Hints aren't available yet for variant puzzles — the classic solver doesn't know about cages or dots, so its suggestions could be wrong here.`;
      hintOutput.classList.add("show");
      return;
    }
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

  // ---------------- Input mode (digit / corner notes / center notes / color) ----------------
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
  function setInputMode(mode) {
    state.inputMode = mode;
    modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
    renderNumpad();
  }
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => setInputMode(btn.dataset.mode));
  });

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

  const puzzleLibraryEl = document.getElementById("puzzleLibrary");
  (window.PuzzleLibrary || []).forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "btn puzzle-entry";
    btn.innerHTML = `<span class="puzzle-entry-title">${entry.title}</span><span class="puzzle-entry-blurb">${entry.blurb || ""}</span>`;
    btn.addEventListener("click", () => loadPuzzle(entry));
    puzzleLibraryEl.appendChild(btn);
  });

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("eraseBtn").addEventListener("click", eraseCell);

  hintBtn.addEventListener("click", () => showHint("nudge"));

  document.getElementById("checkBtn").addEventListener("click", () => {
    render();
    const conflicts = currentConflicts();
    hintOutput.innerHTML = conflicts.size > 0
      ? `<span class="hint-technique">Check</span>Found ${conflicts.size} conflicting cell${conflicts.size === 1 ? "" : "s"} — highlighted in red.`
      : `<span class="hint-technique">Check</span>No conflicts so far. Keep going.`;
    hintOutput.classList.add("show");
  });

  // Physical keyboard support (useful with a Fold's larger screen / attached keyboard)
  document.addEventListener("keydown", (e) => {
    if (state.selected.length === 0) return;
    const [r, c] = state.selected[state.selected.length - 1];
    if (e.key >= "1" && e.key <= "9") inputNumber(parseInt(e.key, 10));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") eraseCell();
    else if (e.key === "ArrowUp") selectCell(Math.max(0, r - 1), c);
    else if (e.key === "ArrowDown") selectCell(Math.min(8, r + 1), c);
    else if (e.key === "ArrowLeft") selectCell(r, Math.max(0, c - 1));
    else if (e.key === "ArrowRight") selectCell(r, Math.min(8, c + 1));
  });

  // Drag-select: press on a cell to start, drag across others to add them to
  // the selection. Uses pointermove + elementFromPoint (rather than per-cell
  // pointerenter) so it keeps working even though render() replaces every
  // cell element on each extension of the selection.
  let isDragSelecting = false;
  boardEl.addEventListener("pointerdown", (e) => {
    const cellEl = e.target.closest(".cell");
    if (!cellEl) return;
    isDragSelecting = true;
    selectCell(parseInt(cellEl.dataset.r, 10), parseInt(cellEl.dataset.c, 10));
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (!isDragSelecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el && el.closest(".cell");
    if (!cellEl) return;
    extendSelection(parseInt(cellEl.dataset.r, 10), parseInt(cellEl.dataset.c, 10));
  });
  document.addEventListener("pointerup", () => { isDragSelecting = false; });
  document.addEventListener("pointercancel", () => { isDragSelecting = false; });

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
    renderConstraintOverlays();
    updateHintAvailability();
  }
})();
