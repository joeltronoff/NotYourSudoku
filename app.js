(() => {
  const STORAGE_KEY = "solvers-notebook-state-v3";
  const { generatePuzzle, computeCandidates, getHint, isBoardComplete, findConflicts, findVariantConflicts, cloneGrid } = window.SudokuEngine;

  function currentConflicts() {
    const classic = findConflicts(state.grid);
    const variant = findVariantConflicts(state.grid, {
      cages: state.cages,
      kropki: state.kropki,
      lines: state.lines,
      arrows: state.arrows,
      antiKnight: state.antiKnight,
      sandwich: state.sandwich,
      xv: state.xv,
    });
    return new Set([...classic, ...variant]);
  }

  function isKnightMove(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
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

  // ---------------- Progress tracking (persists across puzzles) ----------------
  const PROGRESS_KEY = "solvers-notebook-progress-v1";
  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return {
        completed: Array.isArray(data.completed) ? data.completed : [],
        classicSolved: data.classicSolved || 0,
      };
    } catch (e) {
      return { completed: [], classicSolved: 0 };
    }
  }
  function saveProgress(progress) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function recordCompletion() {
    const progress = loadProgress();
    if (state.puzzleId) {
      if (!progress.completed.includes(state.puzzleId)) progress.completed.push(state.puzzleId);
    } else {
      progress.classicSolved += 1;
    }
    saveProgress(progress);
  }

  // ---------------- Variant menu metadata ----------------
  const VARIANT_INFO = {
    killer: {
      title: "Killer Cages",
      blurb: "Dashed cages sum to a target, with no repeated digit inside.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 2.5"/></svg>',
    },
    kropki: {
      title: "Kropki Dots",
      blurb: "White dots mark consecutive neighbors, black dots mark a 2:1 ratio.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="12" x2="17" y2="12"/><circle cx="7" cy="12" r="3" fill="currentColor"/><circle cx="17" cy="12" r="3" fill="var(--paper)"/></svg>',
    },
    lines: {
      title: "Lines & Arrows",
      blurb: "Thermometers, whispers, renban lines, and sum-into-the-circle arrows.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3" fill="currentColor"/><path d="M8 16l9-9"/><path d="M13.5 7h3.5v3.5"/></svg>',
    },
    antiknight: {
      title: "Anti-Knight",
      blurb: "No two cells a knight's-move apart may repeat a digit.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="8" r="2" fill="currentColor" stroke="none"/><path d="M6 17L6 10L15 8" stroke-dasharray="2.5 2.5"/></svg>',
    },
    sandwich: {
      title: "Sandwich",
      blurb: "Clues give the sum of digits sandwiched between the 1 and the 9.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16"/><path d="M4 15h16"/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    },
    xv: {
      title: "XV",
      blurb: "An X between cells sums to 10, a V sums to 5.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l6 10M10 7l-6 10"/><path d="M14 7l3 8 3-8"/></svg>',
    },
  };

  let state = null; // full game state, see newGame()
  let timerInterval = null;

  const boardEl = document.getElementById("boardGrid");
  const numpadEl = document.getElementById("mobileNumpad");
  const timerDisplay = document.getElementById("timerDisplay");
  const difficultyDisplay = document.getElementById("difficultyDisplay");
  const hintOutput = document.getElementById("hintOutput");
  const winOverlay = document.getElementById("winOverlay");
  const hintBtn = document.getElementById("hintBtn");

  // ---------------- Main menu ----------------
  const titlebarEl = document.querySelector(".titlebar");
  const layoutEl = document.querySelector(".layout");
  const mainMenuEl = document.getElementById("mainMenu");
  const variantMenuEl = document.getElementById("variantMenu");
  const menuContinueEl = document.getElementById("menuContinue");

  function showGame() {
    mainMenuEl.hidden = true;
    variantMenuEl.hidden = true;
    titlebarEl.hidden = false;
    layoutEl.hidden = false;
  }
  function showMenu() {
    variantMenuEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    mainMenuEl.hidden = false;
    renderMainMenu();
  }
  function showVariantMenu(variantKey) {
    mainMenuEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    variantMenuEl.hidden = false;
    renderVariantMenu(variantKey);
  }

  function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

  function renderMainMenu() {
    const progress = loadProgress();

    const hasActive = !!state && !state.won;
    menuContinueEl.hidden = !hasActive;
    if (hasActive) {
      document.getElementById("menuContinueTitle").textContent =
        state.title || `${capitalize(state.difficulty)} classic`;
    }

    document.getElementById("classicSolvedCount").textContent =
      `${progress.classicSolved} solved`;

    const byVariant = {};
    (window.PuzzleLibrary || []).forEach(entry => {
      (byVariant[entry.variant] = byVariant[entry.variant] || []).push(entry);
    });

    const listEl = document.getElementById("menuVariantList");
    listEl.innerHTML = "";
    Object.keys(VARIANT_INFO).forEach(key => {
      const entries = byVariant[key] || [];
      if (entries.length === 0) return;
      const info = VARIANT_INFO[key];
      const solvedCount = entries.filter(e => progress.completed.includes(e.id)).length;
      const card = document.createElement("button");
      card.className = "menu-card menu-variant-card";
      card.innerHTML = `
        <div class="menu-card-icon">${info.icon}</div>
        <div class="menu-card-body">
          <div class="menu-card-title-row">
            <span class="menu-card-title">${info.title}</span>
            <span class="menu-card-count${solvedCount === entries.length ? " all-solved" : ""}">${solvedCount}/${entries.length} solved</span>
          </div>
          <p class="menu-card-blurb">${info.blurb}</p>
        </div>
      `;
      card.addEventListener("click", () => showVariantMenu(key));
      listEl.appendChild(card);
    });
  }

  function renderVariantMenu(key) {
    const info = VARIANT_INFO[key];
    document.getElementById("variantMenuTitle").textContent = info.title;
    document.getElementById("variantMenuBlurb").textContent = info.blurb;

    const progress = loadProgress();
    const entries = (window.PuzzleLibrary || []).filter(e => e.variant === key);
    const listEl = document.getElementById("menuPuzzleList");
    listEl.innerHTML = "";
    entries.forEach(entry => {
      const solved = progress.completed.includes(entry.id);
      const row = document.createElement("button");
      row.className = "menu-puzzle-row" + (solved ? " solved" : "");
      row.innerHTML = `
        <span class="menu-puzzle-check">${solved ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}</span>
        <span class="menu-puzzle-info">
          <span class="menu-puzzle-title">${entry.title}</span>
          <span class="menu-puzzle-blurb">${entry.blurb || ""}</span>
        </span>
      `;
      row.addEventListener("click", () => loadPuzzle(entry));
      listEl.appendChild(row);
    });
  }

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
      lines: [],
      arrows: [],
      antiKnight: false,
      sandwich: null,
      xv: [],
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
    setInputMode("digit");
    startTimer();
    saveState();
    render();
    renderConstraintOverlays();
    renderSandwichClues();
    updateHintAvailability();
    showGame();
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
      lines: entry.lines || [],
      arrows: entry.arrows || [],
      antiKnight: entry.antiKnight || false,
      sandwich: entry.sandwich || null,
      xv: entry.xv || [],
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
    setInputMode("digit");
    startTimer();
    saveState();
    render();
    renderConstraintOverlays();
    renderSandwichClues();
    updateHintAvailability();
    showGame();
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
      lines: state.lines,
      arrows: state.arrows,
      antiKnight: state.antiKnight,
      sandwich: state.sandwich,
      xv: state.xv,
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
        lines: data.lines || [],
        arrows: data.arrows || [],
        antiKnight: data.antiKnight || false,
        sandwich: data.sandwich || null,
        xv: data.xv || [],
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
            || (state.antiKnight && isKnightMove(sr, sc, r, c))
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

        // Appended before the digit/notes below so it paints underneath
        // them (see computeCellDecorations for why this has to be a
        // per-cell fragment rather than one global overlay).
        const decos = cellDecorations.get(`${r},${c}`);
        if (decos && decos.length > 0) {
          cell.appendChild(buildCellDecorationSvg(decos));
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
    computeCellDecorations();
    const hasCages = state.cages && state.cages.length > 0;
    const hasKropki = state.kropki && state.kropki.length > 0;
    const hasXV = state.xv && state.xv.length > 0;
    if (!hasCages && !hasKropki && !hasXV) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "constraint-svg");
    const INSET = 0.7;

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
      const LABEL_GAP_W = 3.4;
      const LABEL_GAP_H = 2.6;
      state.cages.forEach((cage, idx) => {
        const sameCage = (r, c) => cageOf.get(`${r},${c}`) === idx;
        let [tr, tc] = cage.cells[0];
        for (const [r, c] of cage.cells) {
          if (r < tr || (r === tr && c < tc)) { tr = r; tc = c; }
        }
        cage.cells.forEach(([r, c]) => {
          const x0 = c * 10, y0 = r * 10, x1 = x0 + 10, y1 = y0 + 10;
          const isLabelCell = r === tr && c === tc;
          // Leave a gap in the top/left edges of the label cell so the
          // dashed outline doesn't run straight through the sum digits.
          if (r === 0 || !sameCage(r - 1, c)) {
            const startX = isLabelCell ? Math.min(x0 + INSET + LABEL_GAP_W, x1 - INSET) : x0 + INSET;
            addLine(startX, y0 + INSET, x1 - INSET, y0 + INSET);
          }
          if (r === 8 || !sameCage(r + 1, c)) addLine(x0 + INSET, y1 - INSET, x1 - INSET, y1 - INSET);
          if (c === 0 || !sameCage(r, c - 1)) {
            const startY = isLabelCell ? Math.min(y0 + INSET + LABEL_GAP_H, y1 - INSET) : y0 + INSET;
            addLine(x0 + INSET, startY, x0 + INSET, y1 - INSET);
          }
          if (c === 8 || !sameCage(r, c + 1)) addLine(x1 - INSET, y0 + INSET, x1 - INSET, y1 - INSET);
        });
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", tc * 10 + INSET + 0.35);
        text.setAttribute("y", tr * 10 + INSET + 1.9);
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
        circle.setAttribute("r", 0.85);
        circle.setAttribute("class", dot.kind === "white" ? "kropki-dot kropki-white" : "kropki-dot kropki-black");
        svg.appendChild(circle);
      });
    }

    if (hasXV) {
      state.xv.forEach(pair => {
        const [r1, c1] = pair.a, [r2, c2] = pair.b;
        const cx = r1 === r2 ? Math.max(c1, c2) * 10 : c1 * 10 + 5;
        const cy = r1 === r2 ? r1 * 10 + 5 : Math.max(r1, r2) * 10;
        const bg = document.createElementNS(svgNS, "circle");
        bg.setAttribute("cx", cx);
        bg.setAttribute("cy", cy);
        bg.setAttribute("r", 1.6);
        bg.setAttribute("class", "xv-bg");
        svg.appendChild(bg);
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("class", "xv-label");
        text.textContent = pair.kind;
        svg.appendChild(text);
      });
    }

    constraintOverlayEl.appendChild(svg);
  }

  // Sandwich clues sit outside the board (row clues to the left, column
  // clues above), so they get their own thin grid wrapper rather than
  // living in the SVG overlay that sits on top of the board.
  const sandwichWrapEl = document.getElementById("sandwichWrap");
  const sandwichColCluesEl = document.getElementById("sandwichColClues");
  const sandwichRowCluesEl = document.getElementById("sandwichRowClues");
  function renderSandwichClues() {
    sandwichColCluesEl.innerHTML = "";
    sandwichRowCluesEl.innerHTML = "";
    const hasSandwich = !!state.sandwich;
    sandwichWrapEl.classList.toggle("has-clues", hasSandwich);
    if (!hasSandwich) return;
    const rows = state.sandwich.rows || [];
    const cols = state.sandwich.cols || [];
    for (let r = 0; r < 9; r++) {
      const cell = document.createElement("div");
      cell.className = "sandwich-clue";
      cell.textContent = rows[r] == null ? "" : rows[r];
      sandwichRowCluesEl.appendChild(cell);
    }
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "sandwich-clue";
      cell.textContent = cols[c] == null ? "" : cols[c];
      sandwichColCluesEl.appendChild(cell);
    }
  }

  // Lines/arrows are drawn per-cell (inside each cell's own DOM node,
  // ahead of its digit) rather than as one global overlay. A single
  // overlay sitting above #boardGrid paints above every cell's entire
  // box — background AND text together, since each .cell is a
  // container-query box and thus its own stacking context — so there is
  // no z-index that puts a global decoration behind text but above a
  // cell's background. Splitting each line at the midpoint between two
  // adjacent cell centers and giving each cell only its own half keeps
  // the drawing seamless while letting normal DOM order (decoration
  // fragment appended before the digit) put the digit on top, cell by
  // cell. cages/kropki don't have this problem (they sit near cell edges,
  // not over the digit) and stay in the global overlay above.
  let cellDecorations = new Map();
  function computeCellDecorations() {
    cellDecorations = new Map();
    function addDeco(r, c, deco) {
      const key = `${r},${c}`;
      if (!cellDecorations.has(key)) cellDecorations.set(key, []);
      cellDecorations.get(key).push(deco);
    }
    function localize(r, c, x, y) {
      return [x - c * 10, y - r * 10];
    }
    // Adds the two half-segments (one per cell) for the straight run
    // between cells[i-1] and cells[i], optionally starting the first
    // cell's half from a circle's edge instead of its center.
    function addHalfSegments(cells, centers, i, className, edgeR) {
      const [pr, pc] = cells[i - 1];
      const [r, c] = cells[i];
      const [px, py] = centers[i - 1];
      const [cx, cy] = centers[i];
      const midX = (cx + px) / 2, midY = (cy + py) / 2;
      let startX = px, startY = py;
      if (edgeR && i === 1) {
        const dx = cx - px, dy = cy - py;
        const dist = Math.hypot(dx, dy) || 1;
        startX = px + (dx / dist) * edgeR;
        startY = py + (dy / dist) * edgeR;
      }
      const [x1, y1] = localize(pr, pc, startX, startY);
      const [x2, y2] = localize(pr, pc, midX, midY);
      addDeco(pr, pc, { kind: "line", x1, y1, x2, y2, className });
      const [x3, y3] = localize(r, c, midX, midY);
      const [x4, y4] = localize(r, c, cx, cy);
      addDeco(r, c, { kind: "line", x1: x3, y1: y3, x2: x4, y2: y4, className });
    }

    const THERMO_BULB_R = 3.4;
    const ARROW_CIRCLE_R = 4;
    const HEAD_LEN = 1.8, HEAD_WIDTH = 1.1;

    (state.lines || []).forEach(line => {
      const cells = line.cells;
      const centers = cells.map(([r, c]) => [c * 10 + 5, r * 10 + 5]);
      const className = `line-path line-${line.kind}`;
      for (let i = 1; i < cells.length; i++) {
        addHalfSegments(cells, centers, i, className, line.kind === "thermo" ? THERMO_BULB_R : null);
      }
      if (line.kind === "thermo") {
        const [br, bc] = cells[0];
        const [bx, by] = localize(br, bc, ...centers[0]);
        addDeco(br, bc, { kind: "circle", cx: bx, cy: by, r: THERMO_BULB_R, className: "thermo-bulb" });
      }
    });

    (state.arrows || []).forEach(arrow => {
      const [cr, cc] = arrow.circle;
      const ccx = cc * 10 + 5, ccy = cr * 10 + 5;
      const cells = [[cr, cc], ...arrow.cells];
      const centers = [[ccx, ccy], ...arrow.cells.map(([r, c]) => [c * 10 + 5, r * 10 + 5])];
      for (let i = 1; i < cells.length; i++) {
        addHalfSegments(cells, centers, i, "line-path arrow-line", ARROW_CIRCLE_R);
      }
      const [lccx, lccy] = localize(cr, cc, ccx, ccy);
      addDeco(cr, cc, { kind: "circle", cx: lccx, cy: lccy, r: ARROW_CIRCLE_R, className: "arrow-circle" });

      // Arrowhead at the tip, local to the last cell only.
      const [lr, lc] = arrow.cells[arrow.cells.length - 1];
      const tipCenters = centers.slice(1);
      const [lx, ly] = tipCenters[tipCenters.length - 1];
      const [px, py] = tipCenters.length > 1 ? tipCenters[tipCenters.length - 2] : centers[0];
      const adx = lx - px, ady = ly - py;
      const alen = Math.hypot(adx, ady) || 1;
      const aux = adx / alen, auy = ady / alen;
      const perpX = -auy, perpY = aux;
      const backX = lx - aux * HEAD_LEN, backY = ly - auy * HEAD_LEN;
      const p1 = localize(lr, lc, backX + perpX * HEAD_WIDTH, backY + perpY * HEAD_WIDTH);
      const p2 = localize(lr, lc, lx, ly);
      const p3 = localize(lr, lc, backX - perpX * HEAD_WIDTH, backY - perpY * HEAD_WIDTH);
      addDeco(lr, lc, { kind: "polyline", points: [p1, p2, p3].map(p => p.join(",")).join(" "), className: "arrow-head" });
    });
  }

  function buildCellDecorationSvg(decos) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    svg.setAttribute("class", "cell-deco-svg");
    decos.forEach(d => {
      let el;
      if (d.kind === "line") {
        el = document.createElementNS(svgNS, "line");
        el.setAttribute("x1", d.x1);
        el.setAttribute("y1", d.y1);
        el.setAttribute("x2", d.x2);
        el.setAttribute("y2", d.y2);
      } else if (d.kind === "circle") {
        el = document.createElementNS(svgNS, "circle");
        el.setAttribute("cx", d.cx);
        el.setAttribute("cy", d.cy);
        el.setAttribute("r", d.r);
      } else {
        el = document.createElementNS(svgNS, "polyline");
        el.setAttribute("points", d.points);
      }
      el.setAttribute("class", d.className);
      svg.appendChild(el);
    });
    return svg;
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
      const alreadyWon = state.won;
      state.won = true;
      saveState();
      if (!alreadyWon) recordCompletion();
      document.getElementById("winTime").textContent = formatTime(state.seconds);
      document.getElementById("winMistakes").textContent = `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}`;
      winOverlay.classList.add("show");
    }
  }

  function isVariantActive() {
    return (state.cages && state.cages.length > 0)
      || (state.kropki && state.kropki.length > 0)
      || (state.lines && state.lines.length > 0)
      || (state.arrows && state.arrows.length > 0)
      || !!state.antiKnight
      || !!state.sandwich
      || (state.xv && state.xv.length > 0);
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
  document.getElementById("settingsBtn").addEventListener("click", showMenu);

  document.getElementById("winNewBtn").addEventListener("click", () => {
    winOverlay.classList.remove("show");
    showMenu();
  });

  document.getElementById("variantBackBtn").addEventListener("click", showMenu);
  menuContinueEl.addEventListener("click", showGame);

  document.querySelectorAll("#menuDifficultyRow .chip").forEach(chip => {
    chip.addEventListener("click", () => newGame(chip.dataset.diff));
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
    if (!state || layoutEl.hidden || state.selected.length === 0) return;
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
  // The menu is always the first thing shown; a saved in-progress game (if
  // any) is loaded into memory so "Continue" can drop straight back into it,
  // but the board itself only becomes visible once something is chosen.
  if (loadState()) {
    render();
    renderConstraintOverlays();
    renderSandwichClues();
    updateHintAvailability();
  }
  showMenu();
})();
