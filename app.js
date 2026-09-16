(() => {
  const STORAGE_KEY = "solvers-notebook-state-v3";
  const { generatePuzzle, computeCandidates, getHint, isBoardComplete, findConflicts, findVariantConflicts, cloneGrid } = window.SudokuEngine;

  // ---------------- Settings ----------------
  // Every assist is a preference, and every one of them starts off except
  // the two that only remove bookkeeping (auto-clearing pencil marks and
  // same-digit highlighting) -- the point is to help you keep track of what
  // you worked out, never to work it out for you.
  const SETTINGS_KEY = "solvers-notebook-settings-v1";
  const DEFAULT_SETTINGS = {
    theme: "system",          // system | light | dark
    errorCheck: "full",       // full | classic | off
    hideTimer: false,
    highlightDigit: true,
    digitCounts: true,
    autoClearNotes: true,
    cageCalculator: true,
    showSeen: true,
  };
  let settings = { ...DEFAULT_SETTINGS };
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      settings = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (e) {
      settings = { ...DEFAULT_SETTINGS };
    }
    applyTheme();
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }
  function applyTheme() {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
    // Keep the browser chrome in step with the board.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = settings.theme === "dark"
        || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#1A1A18" : "#FAF9F6");
    }
  }

  // What the board highlights, which the player can dial down or switch
  // off. Win detection uses strictConflicts() instead, so a puzzle is never
  // called solved on a grid that breaks its own rules.
  // Set by the Check button so one explicit check still shows everything,
  // whatever the highlight setting says; cleared on the next move.
  let forceFullCheck = false;

  function currentConflicts() {
    if (forceFullCheck) return strictConflicts();
    if (settings.errorCheck === "off") return new Set();
    if (settings.errorCheck === "classic") return new Set(findConflicts(state.grid));
    return strictConflicts();
  }

  function strictConflicts() {
    const classic = findConflicts(state.grid);
    const variant = findVariantConflicts(state.grid, {
      cages: state.cages,
      kropki: state.kropki,
      kropkiNegative: state.kropkiNegative,
      lines: state.lines,
      arrows: state.arrows,
      antiKnight: state.antiKnight,
      antiKing: state.antiKing,
      nonConsecutive: state.nonConsecutive,
      disjointGroups: state.disjointGroups,
      extraRegions: state.extraRegions,
      quadruples: state.quadruples,
      sandwich: state.sandwich,
      xv: state.xv,
      littleKiller: state.littleKiller,
      diagonals: state.diagonals,
      oddEven: state.oddEven,
    });
    return new Set([...classic, ...variant]);
  }

  // ---------------- Fog of War ----------------
  // Only a cell the PLAYER has actually solved lights up its neighborhood --
  // a given, even once revealed, just sits there (it still helps you deduce
  // its neighbors, it just doesn't also spread the fog-clearing on its own).
  // Otherwise two givens sitting near each other would silently reveal one
  // another the instant either one is seen, with no solving involved at
  // all -- and givens are typically dense enough that this cascades across
  // almost the whole grid before the player does anything. The one
  // exception is the initial reveal seed itself: those cells' neighborhoods
  // light up once, unconditionally, as the puzzle's starting condition,
  // exactly like a torch already lit when you walk in. Computed fresh from
  // state.grid/state.solution every time rather than stored, so undo/erase
  // can never leave stale fog behind.
  function computeFogRevealed() {
    if (!state.fog) return null;
    const seed = state.fog.reveal || [];
    const radius = state.fog.radius || 1;
    // How far the starting seed itself lights up. Our own generated puzzles
    // light a full neighborhood around each seed cell; imported puzzles use
    // the setter's own "deep fog" convention (seedRadius 0), where a fog
    // light or a given lights only its own cell and the fog opens up solely
    // through cells the player solves.
    const seedRadius = state.fog.seedRadius == null ? radius : state.fog.seedRadius;
    const revealed = new Set(seed.map(([r, c]) => `${r},${c}`));
    function lightNeighbors(r, c, reach = radius) {
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
          revealed.add(`${nr},${nc}`);
        }
      }
    }
    if (seedRadius > 0) {
      for (const [r, c] of seed) {
        if (state.grid[r][c] !== 0 && state.grid[r][c] === state.solution[r][c]) lightNeighbors(r, c, seedRadius);
      }
    }

    // Trigger links: some puzzles don't clear the fog around a solved cell
    // at all. Instead, solving particular cells uncovers a region somewhere
    // else on the grid. A puzzle uses either this or the neighborhood rule
    // below, never both -- so when links are present they're the whole
    // mechanic.
    const links = state.fog.links || [];
    if (links.length > 0) {
      const isCorrect = (r, c) => state.grid[r][c] !== 0 && state.grid[r][c] === state.solution[r][c];
      let linkChanged = true;
      while (linkChanged) {
        linkChanged = false;
        for (const link of links) {
          if (!link.trigger.every(([r, c]) => isCorrect(r, c))) continue;
          for (const [r, c] of link.reveal) {
            const k = `${r},${c}`;
            if (!revealed.has(k)) { revealed.add(k); linkChanged = true; }
          }
        }
      }
      return revealed;
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const key = `${r},${c}`;
          if (!revealed.has(key)) continue;
          if (state.givens[r][c] !== 0) continue; // a given never re-propagates on its own
          if (state.grid[r][c] === 0 || state.grid[r][c] !== state.solution[r][c]) continue;
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
              const nk = `${nr},${nc}`;
              if (!revealed.has(nk)) { revealed.add(nk); changed = true; }
            }
          }
        }
      }
    }
    return revealed;
  }
  function isCellFogged(r, c) {
    const revealed = computeFogRevealed();
    return !!revealed && !revealed.has(`${r},${c}`);
  }

  // Every cell the selection "sees": one that can't repeat a digit with it.
  // That's the row, column and box, plus whatever extra rules this puzzle
  // carries — knight and king moves, both diagonals, cages, extra regions
  // and disjoint groups — so the highlight tells the truth for the puzzle
  // in front of you, not just for a classic grid.
  let seenCache = null;
  function seenBySelection() {
    const key = JSON.stringify(state.selected);
    if (seenCache && seenCache.key === key) return seenCache.set;
    const seen = new Set();
    const add = (r, c) => { if (r >= 0 && r < 9 && c >= 0 && c < 9) seen.add(`${r},${c}`); };
    for (const [sr, sc] of state.selected) {
      for (let i = 0; i < 9; i++) { add(sr, i); add(i, sc); }
      const br = Math.floor(sr / 3) * 3, bc = Math.floor(sc / 3) * 3;
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) add(br + dr, bc + dc);
      if (state.antiKnight) {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(sr + dr, sc + dc);
      }
      if (state.antiKing) {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) add(sr + dr, sc + dc);
      }
      if (state.diagonals) {
        if (state.diagonals !== "anti" && sr === sc) for (let i = 0; i < 9; i++) add(i, i);
        if (state.diagonals !== "main" && sr + sc === 8) for (let i = 0; i < 9; i++) add(i, 8 - i);
      }
      if (state.disjointGroups) {
        const pos = (sr % 3) * 3 + (sc % 3);
        for (let box = 0; box < 9; box++) {
          add(Math.floor(box / 3) * 3 + Math.floor(pos / 3), (box % 3) * 3 + (pos % 3));
        }
      }
      for (const cage of state.cages || []) {
        if (cage.cells.some(([cr, cc]) => cr === sr && cc === sc)) cage.cells.forEach(([cr, cc]) => add(cr, cc));
      }
      for (const region of state.extraRegions || []) {
        if (region.some(([cr, cc]) => cr === sr && cc === sc)) region.forEach(([cr, cc]) => add(cr, cc));
      }
      for (const line of state.lines || []) {
        // A renban's digits are all different, so its cells see each other.
        if (line.kind === "renban" && line.cells.some(([cr, cc]) => cr === sr && cc === sc)) {
          line.cells.forEach(([cr, cc]) => add(cr, cc));
        }
      }
    }
    seenCache = { key, set: seen };
    return seen;
  }

  // Cell-shading palette for the "color" tool. Soft enough that given/user/
  // conflict text stays legible on top, but distinct from one another.
  // Several colours on one cell are drawn as a pinwheel — equal wedges
  // around the centre — so each colour keeps a share of every part of the
  // cell instead of one being pushed into a corner.
  function shadeBackground(list) {
    if (list.length === 1) return CELL_COLORS[list[0]];
    const step = 360 / list.length;
    const stops = list.map((index, i) => `${CELL_COLORS[index]} ${i * step}deg ${(i + 1) * step}deg`);
    return `conic-gradient(from -45deg, ${stops.join(", ")})`;
  }

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
        favorites: Array.isArray(data.favorites) ? data.favorites : [],
        bestTimes: data.bestTimes || {},       // puzzle id -> seconds
        days: Array.isArray(data.days) ? data.days : [],  // YYYY-MM-DD solved on
      };
    } catch (e) {
      return { completed: [], classicSolved: 0, favorites: [], bestTimes: {}, days: [] };
    }
  }
  function saveProgress(progress) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function recordCompletion() {
    const progress = loadProgress();
    if (state.puzzleId) {
      if (!progress.completed.includes(state.puzzleId)) progress.completed.push(state.puzzleId);
      const best = progress.bestTimes[state.puzzleId];
      if (best == null || state.seconds < best) progress.bestTimes[state.puzzleId] = state.seconds;
    } else {
      progress.classicSolved += 1;
    }
    const today = localDayKey(new Date());
    if (!progress.days.includes(today)) progress.days.push(today);
    saveProgress(progress);
  }

  // Local calendar day, not UTC -- a puzzle solved at 11pm counts for today.
  function localDayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  // Longest run of consecutive days ending today or yesterday (so a streak
  // stays alive until the day after you last played).
  function streakFromDays(days) {
    const set = new Set(days);
    const day = new Date();
    if (!set.has(localDayKey(day))) {
      day.setDate(day.getDate() - 1);
      if (!set.has(localDayKey(day))) return 0;
    }
    let count = 0;
    while (set.has(localDayKey(day))) {
      count++;
      day.setDate(day.getDate() - 1);
    }
    return count;
  }

  function longestStreak(days) {
    const sorted = [...new Set(days)].sort();
    let best = 0, run = 0, prev = null;
    for (const key of sorted) {
      const d = new Date(`${key}T00:00:00`);
      if (prev && (d - prev) === 86400000) run++;
      else run = 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }

  function isFavorite(id) {
    return loadProgress().favorites.includes(id);
  }

  function toggleFavorite(id) {
    const progress = loadProgress();
    const i = progress.favorites.indexOf(id);
    if (i >= 0) progress.favorites.splice(i, 1);
    else progress.favorites.push(id);
    saveProgress(progress);
  }

  // ---------------- Variant menu metadata ----------------
  const VARIANT_INFO = {
    recommended: {
      title: "Recommended",
      blurb: "A mixed tour of the library, ordered from easiest to hardest.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l2.6 5.5 6 .72-4.43 4.16 1.16 5.92L12 16.6l-5.33 2.9 1.16-5.92L3.4 9.42l6-.72z" fill="currentColor" fill-opacity="0.18"/></svg>',
    },
    favorites: {
      title: "Favourites",
      blurb: "Puzzles you starred to come back to.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z"/></svg>',
    },
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
    diagonal: {
      title: "Diagonal",
      blurb: "The marked long diagonals also hold every digit 1–9, same as a row.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke-width="1.8"/></svg>',
    },
    oddeven: {
      title: "Odd/Even",
      blurb: "Shaded circles must hold an odd digit, shaded squares an even one.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4" fill="currentColor" stroke="none"/><rect x="14" y="8" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/></svg>',
    },
    fog: {
      title: "Fog of War",
      blurb: "The grid starts hidden. Correct digits burn off the fog around them, one patch at a time.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c1-3.5 3.6-6 7-6 2 0 3.3 1 4.5 2"/><path d="M9 18c1.3-2.4 3.4-4 6-4 3 0 5 2 6 4.5"/><circle cx="17" cy="8" r="2.4" fill="currentColor" stroke="none"/></svg>',
    },
    antiking: {
      title: "Anti-King",
      blurb: "No two cells touching diagonally may repeat a digit.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2" stroke-dasharray="2 2"/></svg>',
    },
    nonconsecutive: {
      title: "Non-Consecutive",
      blurb: "Cells sharing an edge can't hold consecutive digits.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="8" height="6" rx="1"/><rect x="13" y="9" width="8" height="6" rx="1"/><path d="M12 7v10" stroke-dasharray="2 2"/></svg>',
    },
    disjoint: {
      title: "Disjoint Groups",
      blurb: "Same position in every box: each digit once across all nine.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.5 3.5v17M14.5 3.5v17M3.5 9.5h17M3.5 14.5h17"/><circle cx="6.5" cy="6.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="17.5" cy="17.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
    },
    extraregions: {
      title: "Extra Regions",
      blurb: "Shaded regions hold every digit 1–9, just like a box.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M7 7h10v4H7zM7 13h5v4H7z" fill="currentColor" fill-opacity="0.25"/></svg>',
    },
    quadruple: {
      title: "Quadruples",
      blurb: "A circle on a corner lists digits that appear in those four cells.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M12 4v16" stroke-opacity="0.45"/><circle cx="12" cy="12" r="4.5" fill="var(--paper)"/></svg>',
    },
    // Hand-picked classic (rules-only) puzzles from the library, as opposed
    // to the generated ones dealt from the Classic card above.
    classic: {
      title: "Classic Collection",
      blurb: "Standard sudoku rules, set by hand — no variant constraints.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.5 3.5v17M14.5 3.5v17M3.5 9.5h17M3.5 14.5h17"/><circle cx="17.5" cy="17.5" r="3" fill="currentColor" stroke="var(--paper)" stroke-width="1.2"/></svg>',
    },
  };

  let state = null; // full game state, see newGame()
  let timerInterval = null;

  const boardEl = document.getElementById("boardGrid");
  const digitsEl = document.getElementById("boardDigits");
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

  // Leaving the board pauses the clock (that's what the pause button in the
  // tool row does); coming back to it starts the clock again.
  function showGame() {
    mainMenuEl.hidden = true;
    variantMenuEl.hidden = true;
    settingsScreenEl.hidden = true;
    statsScreenEl.hidden = true;
    titlebarEl.hidden = false;
    layoutEl.hidden = false;
    if (state && !state.won) startTimer();
  }
  function showMenu() {
    variantMenuEl.hidden = true;
    settingsScreenEl.hidden = true;
    statsScreenEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    mainMenuEl.hidden = false;
    clearInterval(timerInterval);
    if (state) saveState();
    renderMainMenu();
  }
  function showVariantMenu(variantKey) {
    mainMenuEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    settingsScreenEl.hidden = true;
    statsScreenEl.hidden = true;
    variantMenuEl.hidden = false;
    renderVariantMenu(variantKey);
  }

  const settingsScreenEl = document.getElementById("settingsScreen");
  const statsScreenEl = document.getElementById("statsScreen");

  function showSettings() {
    mainMenuEl.hidden = true;
    variantMenuEl.hidden = true;
    statsScreenEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    settingsScreenEl.hidden = false;
    renderSettings();
  }

  function showStats() {
    mainMenuEl.hidden = true;
    variantMenuEl.hidden = true;
    settingsScreenEl.hidden = true;
    titlebarEl.hidden = true;
    layoutEl.hidden = true;
    statsScreenEl.hidden = false;
    renderStats();
  }

  // ---------------- Settings screen ----------------
  const SETTING_TOGGLES = [
    ["setHideTimer", "hideTimer"],
    ["setHighlightDigit", "highlightDigit"],
    ["setDigitCounts", "digitCounts"],
    ["setAutoClear", "autoClearNotes"],
    ["setCageCalc", "cageCalculator"],
    ["setShowSeen", "showSeen"],
  ];

  function renderSettings() {
    document.querySelectorAll("#setTheme .chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.value === settings.theme);
    });
    document.querySelectorAll("#setErrorCheck .chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.value === settings.errorCheck);
    });
    SETTING_TOGGLES.forEach(([id, key]) => { document.getElementById(id).checked = !!settings[key]; });
  }

  function applySettingsToBoard() {
    timerDisplay.hidden = !!settings.hideTimer;
    if (state) {
      renderNumpad();
      render();
    }
  }

  document.querySelectorAll("#setTheme .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      settings.theme = chip.dataset.value;
      saveSettings();
      applyTheme();
      renderSettings();
    });
  });
  document.querySelectorAll("#setErrorCheck .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      settings.errorCheck = chip.dataset.value;
      saveSettings();
      renderSettings();
      applySettingsToBoard();
    });
  });
  SETTING_TOGGLES.forEach(([id, key]) => {
    document.getElementById(id).addEventListener("change", (e) => {
      settings[key] = e.target.checked;
      saveSettings();
      applySettingsToBoard();
    });
  });

  // ---------------- Statistics screen ----------------
  function renderStats() {
    const progress = loadProgress();
    const library = window.PuzzleLibrary || [];
    const solved = progress.completed.length;
    const times = Object.values(progress.bestTimes);
    const totalSeconds = times.reduce((a, b) => a + b, 0);
    const streak = streakFromDays(progress.days);

    document.getElementById("statsTagline").textContent =
      solved === 0 ? "Solve a puzzle and it shows up here." : `${solved} of ${library.length} puzzles solved.`;

    const cards = [
      [solved, "Puzzles solved"],
      [progress.classicSolved, "Generated classics"],
      [streak, streak === 1 ? "Day streak" : "Day streak"],
      [longestStreak(progress.days), "Best streak"],
      [times.length ? formatTime(Math.round(totalSeconds / times.length)) : "—", "Average time"],
      [times.length ? formatTime(Math.min(...times)) : "—", "Fastest solve"],
    ];

    // Per-category progress, with the best time in that category.
    const rows = Object.keys(VARIANT_INFO).filter(key => key !== "recommended").map(key => {
      const entries = entriesForVariant(key);
      if (entries.length === 0) return null;
      const done = entries.filter(e => progress.completed.includes(e.id));
      const best = done.map(e => progress.bestTimes[e.id]).filter(v => v != null);
      return {
        title: VARIANT_INFO[key].title,
        done: done.length,
        total: entries.length,
        best: best.length ? formatTime(Math.min(...best)) : "—",
      };
    }).filter(Boolean);

    document.getElementById("statsBody").innerHTML = `
      <div class="stats-grid">
        ${cards.map(([value, label]) => `
          <div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
        `).join("")}
      </div>
      <table class="stats-table">
        <thead><tr><th>Category</th><th class="num">Solved</th><th class="num">Best</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r.title}</td><td class="num">${r.done}/${r.total}</td><td class="num">${r.best}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

  // A puzzle can belong to more than one category (e.g. anti-knight +
  // kropki combined in one grid) via a `variants` array; single-variant
  // entries just keep using the older `variant` string field.
  function entryVariants(entry) {
    return entry.variants || [entry.variant];
  }

  // ---------------- Recommended ----------------
  // A tour through the whole library rather than one constraint: for each
  // difficulty from 1 star up, take a few puzzles, rotating through the
  // kinds of puzzle available at that level so consecutive picks aren't all
  // the same variant. The result is ordered easiest to hardest, and stays
  // the same between visits (ties break on id, not chance).
  const RECOMMENDED_PER_STAR = 6;
  function recommendedEntries() {
    const byStars = new Map();
    for (const entry of window.PuzzleLibrary || []) {
      const stars = Math.max(1, Math.min(10, entry.stars || 5));
      if (!byStars.has(stars)) byStars.set(stars, []);
      byStars.get(stars).push(entry);
    }

    const picked = [];
    for (let stars = 1; stars <= 10; stars++) {
      const pool = (byStars.get(stars) || []).slice().sort((a, b) => a.id.localeCompare(b.id));
      const groups = new Map();
      for (const entry of pool) {
        const key = entryVariants(entry).join("+");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      }
      const keys = [...groups.keys()].sort();
      let taken = 0, i = 0;
      while (taken < RECOMMENDED_PER_STAR && keys.length > 0) {
        const key = keys[i % keys.length];
        const list = groups.get(key);
        if (list.length === 0) {
          keys.splice(i % keys.length, 1);
          continue;
        }
        picked.push(list.shift());
        taken++;
        i++;
      }
    }
    return picked;
  }

  function entriesForVariant(key) {
    if (key === "recommended") return recommendedEntries();
    if (key === "favorites") {
      const favorites = loadProgress().favorites;
      return (window.PuzzleLibrary || []).filter(e => favorites.includes(e.id));
    }
    return (window.PuzzleLibrary || []).filter(e => entryVariants(e).includes(key));
  }

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
      entryVariants(entry).forEach(v => {
        (byVariant[v] = byVariant[v] || []).push(entry);
      });
    });

    const makeCard = (key, entries) => {
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
      return card;
    };

    const recommended = recommendedEntries();
    const recommendedEl = document.getElementById("menuRecommended");
    recommendedEl.innerHTML = "";
    recommendedEl.parentElement.hidden = recommended.length === 0;
    if (recommended.length > 0) recommendedEl.appendChild(makeCard("recommended", recommended));
    const favorites = entriesForVariant("favorites");
    if (favorites.length > 0) recommendedEl.appendChild(makeCard("favorites", favorites));

    const listEl = document.getElementById("menuVariantList");
    listEl.innerHTML = "";
    Object.keys(VARIANT_INFO).forEach(key => {
      if (key === "recommended" || key === "favorites") return;
      const entries = byVariant[key] || [];
      if (entries.length === 0) return;
      listEl.appendChild(makeCard(key, entries));
    });
  }

  const STAR_ICON = '<svg viewBox="0 0 24 24" width="9" height="9"><path d="M12 2.5l2.87 6.06 6.63.79-4.9 4.6 1.28 6.55L12 17.4l-5.88 3.1 1.28-6.55-4.9-4.6 6.63-.79z"/></svg>';
  function renderStars(count) {
    const n = Math.max(1, Math.min(10, count || 1));
    let out = '<span class="menu-puzzle-stars" title="' + n + '/10 difficulty" aria-label="' + n + ' out of 10 difficulty stars">';
    for (let i = 1; i <= 10; i++) {
      out += `<span class="star${i <= n ? " filled" : ""}">${STAR_ICON}</span>`;
    }
    return out + '</span>';
  }

  // With hundreds of imported puzzles per category, the list needs a sort.
  // "default" keeps library order (hand-authored first, then newest imports).
  let variantMenuKey = null;
  let variantMenuSort = "default";
  let variantMenuQuery = "";
  const menuSearchEl = document.getElementById("menuSearch");
  menuSearchEl.addEventListener("input", () => {
    variantMenuQuery = menuSearchEl.value.trim().toLowerCase();
    if (variantMenuKey) renderVariantMenu(variantMenuKey);
  });
  document.querySelectorAll("#menuSortRow .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      variantMenuSort = chip.dataset.sort;
      if (variantMenuKey) renderVariantMenu(variantMenuKey);
    });
  });

  function renderVariantMenu(key) {
    const info = VARIANT_INFO[key];
    if (variantMenuKey !== key) {
      variantMenuKey = key;
      variantMenuSort = "default";
      variantMenuQuery = "";
      menuSearchEl.value = "";
    }
    document.getElementById("variantMenuTitle").textContent = info.title;
    document.getElementById("variantMenuBlurb").textContent = info.blurb;
    document.querySelectorAll("#menuSortRow .chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.sort === variantMenuSort);
      // The recommended list's own order is a difficulty ramp, not date order.
      if (chip.dataset.sort === "default") chip.textContent = key === "recommended" ? "Mixed" : "Newest";
    });

    const progress = loadProgress();
    let entries = entriesForVariant(key);
    if (variantMenuSort === "easiest") entries = entries.slice().sort((a, b) => (a.stars || 0) - (b.stars || 0));
    else if (variantMenuSort === "hardest") entries = entries.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (variantMenuSort === "unsolved") entries = entries.filter(e => !progress.completed.includes(e.id));
    // Genuinely Approachable Sudoku puzzles, easiest first.
    else if (variantMenuSort === "gas") {
      entries = entries.filter(e => e.source && e.source.gas)
        .sort((a, b) => (a.stars || 0) - (b.stars || 0) || b.source.gas - a.source.gas);
    }
    if (variantMenuQuery) {
      entries = entries.filter(e => (
        `${e.title} ${e.blurb || ""}`.toLowerCase().includes(variantMenuQuery)
      ));
    }
    const listEl = document.getElementById("menuPuzzleList");
    listEl.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "menu-puzzle-empty";
      empty.textContent = variantMenuQuery
        ? `Nothing matches "${menuSearchEl.value.trim()}".`
        : variantMenuSort === "gas"
          ? "No GAS puzzles in this category yet."
          : "Nothing here — every puzzle in this category is solved.";
      listEl.appendChild(empty);
    }
    entries.forEach(entry => {
      const solved = progress.completed.includes(entry.id);
      const otherVariants = entryVariants(entry).filter(v => v !== key);
      const combinedTag = otherVariants.length > 0
        ? `<span class="menu-puzzle-combo">+ ${otherVariants.map(v => VARIANT_INFO[v] ? VARIANT_INFO[v].title : v).join(", ")}</span>`
        : "";
      const row = document.createElement("div");
      row.className = "menu-puzzle-row" + (solved ? " solved" : "");
      const best = progress.bestTimes[entry.id];
      const favorite = progress.favorites.includes(entry.id);
      row.innerHTML = `
        <span class="menu-puzzle-check">${solved ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}</span>
        <span class="menu-puzzle-info">
          <span class="menu-puzzle-title-row">
            <span class="menu-puzzle-title">${entry.title}</span>
            ${renderStars(entry.stars)}
            ${combinedTag}
          </span>
          <span class="menu-puzzle-blurb">${entry.blurb || ""}</span>
          ${best != null ? `<span class="menu-puzzle-best">Best ${formatTime(best)}</span>` : ""}
        </span>
        <button class="menu-puzzle-fav${favorite ? " on" : ""}" aria-label="${favorite ? "Remove from favourites" : "Add to favourites"}" aria-pressed="${favorite}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="${favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z"/></svg>
        </button>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.closest(".menu-puzzle-fav")) {
          toggleFavorite(entry.id);
          renderVariantMenu(key);
          return;
        }
        loadPuzzle(entry);
      });
      listEl.appendChild(row);
    });
  }

  function emptyNotes() {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  }
  // A cell can carry several highlight colours at once -- solvers use one
  // colour per hypothesis, and cells that belong to two of them need both.
  // Stored as a list of palette indexes; older saves held a single index
  // (or null), which normalizeColors lifts into the list form.
  function emptyColors() {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }

  function normalizeColors(colors) {
    if (!Array.isArray(colors)) return emptyColors();
    return colors.map(row => row.map(value => {
      if (Array.isArray(value)) return value.slice();
      return value === null || value === undefined ? [] : [value];
    }));
  }
  function cloneNotes(notes) {
    return notes.map(row => row.map(s => new Set(s)));
  }
  function cloneColors(colors) {
    return colors.map(row => row.map(list => list.slice()));
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
      kropkiNegative: false,
      lines: [],
      arrows: [],
      antiKnight: false,
      antiKing: false,
      nonConsecutive: false,
      disjointGroups: false,
      extraRegions: [],
      quadruples: [],
      sandwich: null,
      xv: [],
      littleKiller: [],
      diagonals: false,
      oddEven: [],
      fog: null,
      cornerNotes: emptyNotes(),
      centerNotes: emptyNotes(),
      colors: emptyColors(),
      selected: [],
      inputMode: "digit", // "digit" | "corner" | "center" | "color"
      mistakes: 0,
      seconds: 0,
      pen: [],
      history: [],
      future: [],
      hintCell: null,
      won: false,
    };
    difficultyDisplay.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
    hintOutput.classList.remove("show");
    winOverlay.classList.remove("show");
    resetHint();
    setInputMode("digit");
    startTimer();
    saveState();
    renderConstraintOverlays();
    renderRulesPanel();
    render();
    renderSandwichClues();
    renderLittleKillerClues();
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
      kropkiNegative: entry.kropkiNegative || false,
      lines: entry.lines || [],
      arrows: entry.arrows || [],
      antiKnight: entry.antiKnight || false,
      antiKing: entry.antiKing || false,
      nonConsecutive: entry.nonConsecutive || false,
      disjointGroups: entry.disjointGroups || false,
      extraRegions: entry.extraRegions || [],
      quadruples: entry.quadruples || [],
      sandwich: entry.sandwich || null,
      xv: entry.xv || [],
      littleKiller: entry.littleKiller || [],
      diagonals: entry.diagonals || false,
      oddEven: entry.oddEven || [],
      fog: entry.fog || null,
      cornerNotes: emptyNotes(),
      centerNotes: emptyNotes(),
      colors: emptyColors(),
      selected: [],
      inputMode: "digit",
      mistakes: 0,
      seconds: 0,
      pen: [],
      history: [],
      future: [],
      hintCell: null,
      won: false,
    };
    // Coming back to a puzzle you'd already started picks up your board,
    // notes, colours and clock rather than wiping them.
    const saved = savedGameFor(entry.id);
    if (saved) state = stateFromData(saved);

    difficultyDisplay.textContent = entry.title;
    hintOutput.classList.remove("show");
    winOverlay.classList.remove("show");
    resetHint();
    setInputMode("digit");
    timerDisplay.textContent = formatTime(state.seconds);
    startTimer();
    saveState();
    renderConstraintOverlays();
    renderRulesPanel();
    render();
    renderSandwichClues();
    renderLittleKillerClues();
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
      kropkiNegative: state.kropkiNegative,
      lines: state.lines,
      arrows: state.arrows,
      antiKnight: state.antiKnight,
      antiKing: state.antiKing,
      nonConsecutive: state.nonConsecutive,
      disjointGroups: state.disjointGroups,
      extraRegions: state.extraRegions,
      quadruples: state.quadruples,
      sandwich: state.sandwich,
      xv: state.xv,
      littleKiller: state.littleKiller,
      diagonals: state.diagonals,
      oddEven: state.oddEven,
      fog: state.fog,
      cornerNotes: state.cornerNotes.map(row => row.map(set => [...set])),
      centerNotes: state.centerNotes.map(row => row.map(set => [...set])),
      colors: state.colors,
      pen: state.pen,
      mistakes: state.mistakes,
      seconds: state.seconds,
      won: state.won,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)); } catch (e) {}
    if (state.puzzleId) saveGameFor(state.puzzleId, serializable);
  }

  // Several puzzles can be on the go at once: each library puzzle keeps its
  // own saved board, so leaving one to try another and coming back later
  // picks up where you left off. Only the most recent few are kept, since
  // localStorage is small and a finished puzzle doesn't need a board.
  const GAMES_KEY = "solvers-notebook-games-v1";
  const MAX_SAVED_GAMES = 20;
  function loadGames() {
    try { return JSON.parse(localStorage.getItem(GAMES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveGameFor(puzzleId, serializable) {
    const games = loadGames();
    if (serializable.won || !hasWork(serializable)) delete games[puzzleId];
    else games[puzzleId] = { ...serializable, savedAt: Date.now() };
    const ids = Object.keys(games).sort((a, b) => (games[b].savedAt || 0) - (games[a].savedAt || 0));
    for (const id of ids.slice(MAX_SAVED_GAMES)) delete games[id];
    try { localStorage.setItem(GAMES_KEY, JSON.stringify(games)); } catch (e) {}
  }
  // Has the player actually done anything on this board? An untouched
  // puzzle isn't worth a save slot, and resuming one would be a no-op.
  function hasWork(game) {
    return game.grid.some((row, r) => row.some((v, c) => v !== game.givens[r][c]))
      || game.cornerNotes.some(row => row.some(list => list.length > 0))
      || game.centerNotes.some(row => row.some(list => list.length > 0))
      || game.colors.some(row => row.some(v => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined)))
      || (game.pen || []).length > 0;
  }

  function savedGameFor(puzzleId) {
    const game = loadGames()[puzzleId];
    if (!game || game.won || !hasWork(game)) return null;
    return game;
  }

  function stateFromData(data) {
    return {
        difficulty: data.difficulty,
        puzzleId: data.puzzleId || null,
        title: data.title || null,
        givens: data.givens,
        grid: data.grid,
        solution: data.solution,
        cages: data.cages || [],
        kropki: data.kropki || [],
        kropkiNegative: data.kropkiNegative || false,
        lines: data.lines || [],
        arrows: data.arrows || [],
        antiKnight: data.antiKnight || false,
        antiKing: data.antiKing || false,
        nonConsecutive: data.nonConsecutive || false,
        disjointGroups: data.disjointGroups || false,
        extraRegions: data.extraRegions || [],
        quadruples: data.quadruples || [],
        sandwich: data.sandwich || null,
        xv: data.xv || [],
        littleKiller: data.littleKiller || [],
        diagonals: data.diagonals || false,
        oddEven: data.oddEven || [],
        fog: data.fog || null,
        cornerNotes: data.cornerNotes.map(row => row.map(arr => new Set(arr))),
        centerNotes: data.centerNotes.map(row => row.map(arr => new Set(arr))),
        colors: normalizeColors(data.colors),
        pen: data.pen || [],
        selected: [],
        inputMode: "digit",
        mistakes: data.mistakes,
        seconds: data.seconds,
      history: [],
      future: [],
      hintCell: null,
      won: data.won,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      state = stateFromData(JSON.parse(raw));
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
    const fogRevealed = computeFogRevealed();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Under fog, the puzzle's own information stays hidden — givens,
        // cages, lines, dots — but the cell is still yours to work in: you
        // can select it and write in it, and what you write stays visible
        // (that's how fog puzzles are meant to play; getting a cell right
        // is what burns the fog off). A conflict marker is withheld,
        // though, since it would leak what's hidden underneath.
        const fogged = !!fogRevealed && !fogRevealed.has(`${r},${c}`);
        if (fogged) cell.classList.add("fogged");

        const val = state.grid[r][c];
        const isGiven = state.givens[r][c] !== 0;
        if (!fogged) {
          if (isGiven) cell.classList.add("given");
          else if (val !== 0) cell.classList.add("user");
          if (conflicts.has(`${r},${c}`)) cell.classList.add("conflict");
        } else if (!isGiven && val !== 0) {
          cell.classList.add("user");
        }

        const shade = state.colors[r][c];
        if (shade && shade.length > 0) {
          cell.style.setProperty("--cell-shade", shadeBackground(shade));
          // Same-colored neighbors read as one shape rather than a row of
          // separate tiles — hide the thin grid line between them (the
          // thicker 3x3 box-separator overlay is unaffected either way).
          const sameShade = other => other && other.length === shade.length && other.every((v, i) => v === shade[i]);
          if (c < 8 && sameShade(state.colors[r][c + 1])) cell.style.borderRightColor = "transparent";
          if (r < 8 && sameShade(state.colors[r + 1][c])) cell.style.borderBottomColor = "transparent";
        }

        if (state.selected.length > 0) {
          const isSelected = state.selected.some(([sr, sc]) => sr === r && sc === c);
          if (isSelected) {
            cell.classList.add("selected");
          } else if (settings.showSeen && seenBySelection().has(`${r},${c}`)) {
            cell.classList.add("peer");
          }
          const [lr, lc] = state.selected[state.selected.length - 1];
          const anchorVal = state.grid[lr][lc];
          if (settings.highlightDigit && !isSelected && anchorVal !== 0 && anchorVal === val) {
            cell.classList.add("same-value");
          }
        }

        if (state.hintCell && state.hintCell[0] === r && state.hintCell[1] === c) {
          cell.classList.add("hint-target");
        }

        boardEl.appendChild(cell);
      }
    }
    renderDigits(conflicts, fogRevealed);
    renderPen();
    renderSelectionSum();
    renderDecorationFog(fogRevealed);
    renderNumpad();
  }

  // Digits and notes live in their own layer above the decoration overlay
  // (see renderDecorations), so a line or arrow passing through a cell is
  // drawn over the grid lines but still under the digit sitting on it.
  function renderDigits(conflicts, fogRevealed) {
    digitsEl.innerHTML = "";
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const box = document.createElement("div");
        box.className = "dcell";
        const fogged = !!fogRevealed && !fogRevealed.has(`${r},${c}`);
        // A fogged cell hides the puzzle's given digit, but never the
        // player's own entries or pencil marks.
        if (fogged && state.givens[r][c] !== 0) {
          digitsEl.appendChild(box);
          continue;
        }
        const val = state.grid[r][c];
        if (!fogged && state.givens[r][c] !== 0) box.classList.add("given");
        else if (val !== 0) box.classList.add("user");
        if (!fogged && conflicts.has(`${r},${c}`)) box.classList.add("conflict");

        if (val !== 0) {
          const span = document.createElement("span");
          span.className = "value";
          span.textContent = val;
          box.appendChild(span);
        } else {
          if (state.cornerNotes[r][c].size > 0) {
            const notesGrid = document.createElement("div");
            notesGrid.className = "notes-grid";
            for (let n = 1; n <= 9; n++) {
              const span = document.createElement("span");
              span.textContent = state.cornerNotes[r][c].has(n) ? n : "";
              notesGrid.appendChild(span);
            }
            box.appendChild(notesGrid);
          }
          if (state.centerNotes[r][c].size > 0) {
            const center = document.createElement("div");
            center.className = "center-notes";
            center.textContent = [...state.centerNotes[r][c]].sort((a, b) => a - b).join("");
            box.appendChild(center);
          }
        }
        digitsEl.appendChild(box);
      }
    }
  }

  // Total of the digits in the selected cells -- the arithmetic you'd
  // otherwise do in your head on a cage, an arrow or a sandwich.
  const selectionSumEl = document.getElementById("selectionSum");
  function renderSelectionSum() {
    const picked = state.selected || [];
    if (picked.length < 2) {
      selectionSumEl.hidden = true;
      return;
    }
    const values = picked.map(([r, c]) => state.grid[r][c]).filter(v => v !== 0);
    const total = values.reduce((a, b) => a + b, 0);
    selectionSumEl.hidden = false;
    selectionSumEl.innerHTML = values.length === picked.length
      ? `${picked.length} cells &middot; sum <strong>${total}</strong>`
      : `${picked.length} cells &middot; ${values.length} filled, sum so far <strong>${total}</strong>`;
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

    // A swatch is marked when every selected cell carries that colour.
    const shared = new Set();
    if (state.selected.length > 0) {
      for (let i = 0; i < CELL_COLORS.length; i++) {
        if (state.selected.every(([r, c]) => (state.colors[r][c] || []).includes(i))) shared.add(i);
      }
    }

    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement("button");
      btn.className = "num-btn";
      if (isColorMode) {
        btn.classList.add("color-swatch");
        btn.style.background = CELL_COLORS[n - 1];
        if (shared.has(n - 1)) btn.classList.add("active-swatch");
      } else {
        btn.textContent = n;
        if (counts[n] >= 9) btn.classList.add("exhausted");
        else if (settings.digitCounts) {
          const left = document.createElement("span");
          left.className = "num-left";
          left.textContent = 9 - counts[n];
          btn.appendChild(left);
        }
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
    renderDecorations();
    const hasCages = state.cages && state.cages.length > 0;
    const hasKropki = state.kropki && state.kropki.length > 0;
    const hasXV = state.xv && state.xv.length > 0;
    if (!hasCages && !hasKropki && !hasXV) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "constraint-svg");
    // Everything here is the puzzle's own clue art, so it all hangs off one
    // group that the fog can clip (see applyFogClip).
    const clueGroup = document.createElementNS(svgNS, "g");
    clueGroup.setAttribute("class", "fog-clip-group");
    svg.appendChild(clueGroup);
    const INSET = 0.7;

    function addLine(x1, y1, x2, y2) {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("class", "cage-line");
      clueGroup.appendChild(line);
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
        text.textContent = cage.sum == null ? "" : cage.sum;
        clueGroup.appendChild(text);
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
        clueGroup.appendChild(circle);
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
        clueGroup.appendChild(bg);
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("class", "xv-label");
        text.textContent = pair.kind;
        clueGroup.appendChild(text);
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
    renderOutsideCluesFog(computeFogRevealed());
  }

  // Little killer clues sit just outside whichever edge/corner their
  // diagonal starts from. Each clue stores the in-grid diagonal path
  // (cells, entry-to-exit) plus the direction of travel; the label's own
  // position is one half-cell further out, in the same direction reversed.
  const LK_ARROWS = { "1,1": "↘", "1,-1": "↙", "-1,1": "↗", "-1,-1": "↖" };
  const littleKillerOverlayEl = document.getElementById("littleKillerOverlay");
  const boardWrapEl = document.querySelector(".board-wrap");
  // Positions a clue a fixed small distance (0.32 of a cell) outside the
  // board's own 0%/100% edge, rather than centered in a virtual extra
  // cell -- keeps it close to the grid without needing a full cell's
  // worth of reserved space on every side.
  function outsidePercent(idx) {
    if (idx < 0) return ((idx + (1 - 0.32)) / 9) * 100;
    if (idx > 8) return ((idx + 0.32) / 9) * 100;
    return ((idx + 0.5) / 9) * 100;
  }
  function renderLittleKillerClues() {
    littleKillerOverlayEl.innerHTML = "";
    const hasClues = (state.littleKiller || []).length > 0;
    boardWrapEl.classList.toggle("has-little-killer", hasClues);
    for (const clue of state.littleKiller || []) {
      const [dr, dc] = clue.dir;
      const [entryRow, entryCol] = clue.cells[0];
      const clueRow = entryRow - dr;
      const clueCol = entryCol - dc;
      const el = document.createElement("div");
      el.className = "little-killer-clue";
      el.style.left = `${outsidePercent(clueCol)}%`;
      el.style.top = `${outsidePercent(clueRow)}%`;
      const arrow = document.createElement("span");
      arrow.className = "lk-arrow";
      arrow.textContent = LK_ARROWS[`${dr},${dc}`] || "";
      const sum = document.createElement("span");
      sum.textContent = clue.sum;
      el.appendChild(arrow);
      el.appendChild(sum);
      littleKillerOverlayEl.appendChild(el);
    }
    renderOutsideCluesFog(computeFogRevealed());
  }

  // Lines, arrows, diagonals and odd/even markers are drawn once, as a
  // single board-wide SVG, in the layer between the grid lines and the
  // digits (see .deco-overlay in styles.css). Drawing each line in one
  // piece rather than cell by cell is what keeps a long diagonal a single
  // clean stroke: per-cell fragments were re-clipped by every cell border
  // they crossed, so lines looked chopped at each grid line.
  const decoOverlayEl = document.getElementById("decoOverlay");
  const SVG_NS = "http://www.w3.org/2000/svg";

  function renderDecorations() {
    decoOverlayEl.innerHTML = "";
    const hasLines = (state.lines || []).length > 0;
    const hasArrows = (state.arrows || []).length > 0;
    const hasOddEven = (state.oddEven || []).length > 0;
    const hasQuads = (state.quadruples || []).length > 0;
    const hasRegions = (state.extraRegions || []).length > 0;
    if (!hasLines && !hasArrows && !hasOddEven && !hasQuads && !hasRegions && !state.diagonals) return;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "deco-svg");
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "fog-clip-group");
    svg.appendChild(group);

    const add = (tag, attrs, className) => {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.setAttribute("class", className);
      group.appendChild(el);
      return el;
    };
    const addText = (x, y, className, content) => {
      const el = add("text", { x, y }, className);
      el.textContent = content;
      return el;
    };
    const centerOf = ([r, c]) => [c * 10 + 5, r * 10 + 5];

    // Diagonals first: the wide band sits under any line crossing it.
    if (state.diagonals) {
      if (state.diagonals !== "anti") add("line", { x1: 0, y1: 0, x2: 90, y2: 90 }, "diagonal-line");
      if (state.diagonals !== "main") add("line", { x1: 90, y1: 0, x2: 0, y2: 90 }, "diagonal-line");
    }

    const THERMO_BULB_R = 3.4;
    const ARROW_CIRCLE_R = 4;
    const HEAD_LEN = 1.8, HEAD_WIDTH = 1.1;

    // Pulls the start of a path back to the edge of the bulb/circle it
    // leaves, so the stroke doesn't stick out the far side of it.
    function fromEdge(cells, radius) {
      const pts = cells.map(centerOf);
      const [sx, sy] = pts[0], [nx, ny] = pts[1];
      const dist = Math.hypot(nx - sx, ny - sy) || 1;
      pts[0] = [sx + ((nx - sx) / dist) * radius, sy + ((ny - sy) / dist) * radius];
      return pts;
    }

    // Extra regions sit furthest back: a soft tint behind everything else.
    (state.extraRegions || []).forEach((region, i) => {
      for (const [r, c] of region) {
        add("rect", { x: c * 10 + 0.4, y: r * 10 + 0.4, width: 9.2, height: 9.2 }, `extra-region extra-region-${i % 4}`);
      }
    });

    const BETWEEN_END_R = 3.2;
    (state.lines || []).forEach(line => {
      const cells = line.cells;
      if (cells.length < 2) return;
      let pts = cells.map(centerOf);
      if (line.kind === "thermo") pts = fromEdge(cells, THERMO_BULB_R);
      // A between line runs from the edge of one circle to the edge of the
      // other, so the ring around each end stays clean.
      if (line.kind === "between") {
        pts = fromEdge(cells, BETWEEN_END_R);
        pts = fromEdge([...cells].reverse(), BETWEEN_END_R).reverse();
        const forward = fromEdge(cells, BETWEEN_END_R);
        pts[0] = forward[0];
      }
      // Dutch whispers (difference 4) get their own color.
      const kindClass = line.kind === "whispers" && line.diff === 4 ? "line-whispers-dutch" : `line-${line.kind}`;
      add("polyline", { points: pts.map(p => p.join(",")).join(" ") }, `line-path ${kindClass}`);
      if (line.kind === "thermo") {
        const [bx, by] = centerOf(cells[0]);
        add("circle", { cx: bx, cy: by, r: THERMO_BULB_R }, "thermo-bulb");
      }
      if (line.kind === "between") {
        for (const end of [cells[0], cells[cells.length - 1]]) {
          const [x, y] = centerOf(end);
          add("circle", { cx: x, cy: y, r: BETWEEN_END_R }, "between-end");
        }
      }
    });

    // Quadruples: a small circle on the corner shared by four cells.
    (state.quadruples || []).forEach(quad => {
      const rows = quad.cells.map(([r]) => r), cols = quad.cells.map(([, c]) => c);
      const x = (Math.max(...cols)) * 10, y = (Math.max(...rows)) * 10;
      add("circle", { cx: x, cy: y, r: 2.8 }, "quad-circle");
      const digits = quad.values.slice().sort((a, b) => a - b);
      const rowsOfText = digits.length > 2 ? [digits.slice(0, 2), digits.slice(2)] : [digits];
      rowsOfText.forEach((group, i) => {
        addText(x, y + (rowsOfText.length === 1 ? 0 : i === 0 ? -1.05 : 1.05), "quad-label", group.join(""));
      });
    });

    (state.arrows || []).forEach(arrow => {
      const cells = [arrow.circle, ...arrow.cells];
      if (cells.length < 2) return;
      const pts = fromEdge(cells, ARROW_CIRCLE_R);
      add("polyline", { points: pts.map(p => p.join(",")).join(" ") }, "line-path arrow-line");
      const [ccx, ccy] = centerOf(arrow.circle);
      add("circle", { cx: ccx, cy: ccy, r: ARROW_CIRCLE_R }, "arrow-circle");

      // Arrowhead at the tip.
      const tip = pts[pts.length - 1], prev = pts[pts.length - 2];
      const alen = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
      const ux = (tip[0] - prev[0]) / alen, uy = (tip[1] - prev[1]) / alen;
      const backX = tip[0] - ux * HEAD_LEN, backY = tip[1] - uy * HEAD_LEN;
      const head = [
        [backX - uy * HEAD_WIDTH, backY + ux * HEAD_WIDTH],
        tip,
        [backX + uy * HEAD_WIDTH, backY - ux * HEAD_WIDTH],
      ];
      add("polyline", { points: head.map(p => p.join(",")).join(" ") }, "arrow-head");
    });

    // Odd/Even markers: a shaded circle or square behind the digit.
    (state.oddEven || []).forEach(clue => {
      const [cx, cy] = centerOf(clue.cell);
      if (clue.parity === "even") {
        add("rect", { x: cx - 3.3, y: cy - 3.3, width: 6.6, height: 6.6 }, "oddeven-even");
      } else {
        add("circle", { cx, cy, r: 3.3 }, "oddeven-odd");
      }
    });

    decoOverlayEl.appendChild(svg);
  }

  // Under fog, decorations are only visible on revealed cells -- clip the
  // whole overlay to those cells rather than redrawing it every move.
  // Clips one overlay to the cells currently out of the fog. Every layer
  // carrying the puzzle's own clues has to go through this: a cage, a dot
  // or an X sitting on a fogged cell is information the player hasn't
  // earned yet. (Pen marks are the player's own, so they stay visible.)
  function applyFogClip(container, fogRevealed, clipId) {
    const svg = container.querySelector("svg");
    if (!svg) return;
    const group = svg.querySelector(".fog-clip-group");
    if (!group) return;
    const old = svg.querySelector("clipPath");
    if (old) old.remove();
    if (!fogRevealed) {
      group.removeAttribute("clip-path");
      return;
    }
    const clip = document.createElementNS(SVG_NS, "clipPath");
    clip.setAttribute("id", clipId);
    for (const key of fogRevealed) {
      const [r, c] = key.split(",").map(Number);
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", c * 10);
      rect.setAttribute("y", r * 10);
      rect.setAttribute("width", 10);
      rect.setAttribute("height", 10);
      clip.appendChild(rect);
    }
    svg.insertBefore(clip, svg.firstChild);
    group.setAttribute("clip-path", `url(#${clipId})`);
  }

  function renderDecorationFog(fogRevealed) {
    applyFogClip(decoOverlayEl, fogRevealed, "decoFogClip");
    applyFogClip(constraintOverlayEl, fogRevealed, "cluesFogClip");
    renderOutsideCluesFog(fogRevealed);
  }

  // Sandwich and little-killer clues sit outside the grid but describe a
  // line of cells inside it; while any of those cells is still fogged the
  // clue would give away more than the player can see.
  function renderOutsideCluesFog(fogRevealed) {
    const visible = (cells) => !fogRevealed || cells.every(([r, c]) => fogRevealed.has(`${r},${c}`));
    sandwichRowCluesEl.querySelectorAll(".sandwich-clue").forEach((el, r) => {
      el.style.visibility = visible(Array.from({ length: 9 }, (_, c) => [r, c])) ? "" : "hidden";
    });
    sandwichColCluesEl.querySelectorAll(".sandwich-clue").forEach((el, c) => {
      el.style.visibility = visible(Array.from({ length: 9 }, (_, r) => [r, c])) ? "" : "hidden";
    });
    littleKillerOverlayEl.querySelectorAll(".little-killer-clue").forEach((el, i) => {
      const clue = (state.littleKiller || [])[i];
      el.style.visibility = clue && visible(clue.cells) ? "" : "hidden";
    });
  }

  // ---------------- Pen marks ----------------
  // Free annotation on its own layer: strokes snap to a half-cell lattice,
  // so they line up with cell centres, edges and corners -- which is how
  // you mark a region border, a pair, or a loop. Drawing over a segment
  // again rubs it out.
  const PEN_STEP = 5;   // half a cell in the board's 0..90 space
  const penOverlayEl = document.getElementById("penOverlay");

  function renderPen() {
    penOverlayEl.innerHTML = "";
    const marks = state.pen || [];
    if (marks.length === 0) return;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "pen-svg");
    for (const [x1, y1, x2, y2] of marks) {
      if (x1 === x2 && y1 === y2) {
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", x1);
        dot.setAttribute("cy", y1);
        dot.setAttribute("r", 1.1);
        dot.setAttribute("class", "pen-dot");
        svg.appendChild(dot);
        continue;
      }
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("class", "pen-line");
      svg.appendChild(line);
    }
    penOverlayEl.appendChild(svg);
  }

  // Board coordinates (0..90) for a pointer event, snapped to the lattice.
  function penNodeAt(event) {
    const rect = boardEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 90;
    const y = ((event.clientY - rect.top) / rect.height) * 90;
    const snap = v => Math.round(v / PEN_STEP) * PEN_STEP;
    return [Math.max(0, Math.min(90, snap(x))), Math.max(0, Math.min(90, snap(y)))];
  }

  const segmentKey = (a, b) => {
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
    return `${p[0]},${p[1]},${q[0]},${q[1]}`;
  };

  function togglePenSegment(a, b) {
    const key = segmentKey(a, b);
    const index = state.pen.findIndex(seg => segmentKey([seg[0], seg[1]], [seg[2], seg[3]]) === key);
    if (index >= 0) state.pen.splice(index, 1);
    else {
      const [p, q] = key.split(",").map(Number).reduce((acc, v, i) => {
        if (i < 2) acc[0].push(v); else acc[1].push(v);
        return acc;
      }, [[], []]);
      state.pen.push([p[0], p[1], q[0], q[1]]);
    }
  }

  function selectCell(r, c) {
    state.selected = [[r, c]];
    hintOutput.classList.remove("show");
    syncCageCalculator(r, c);
    render();
  }

  // Selecting a cell inside a killer cage opens the calculator already set
  // to that cage: its size, its total, and any digits it already holds
  // marked as required, so the list is only the combinations still open to
  // you. Leaving the cage closes it again -- but only if it opened itself;
  // a calculator you opened by hand stays where you put it.
  let calcOpenedByCage = false;
  function syncCageCalculator(r, c) {
    if (!settings.cageCalculator) return;
    let cage = (state.cages || []).find(cg => cg.cells.some(([cr, cc]) => cr === r && cc === c));

    // Under fog, a cage you can only partly see is information you haven't
    // earned yet -- its total and even its shape are still hidden. Only
    // offer the calculator once every cell of the cage is out of the fog.
    if (cage && state.fog) {
      const revealed = computeFogRevealed();
      if (revealed && cage.cells.some(([cr, cc]) => !revealed.has(`${cr},${cc}`))) cage = null;
    }

    if (!cage || cage.sum == null) {
      if (calcOpenedByCage) {
        calcOpenedByCage = false;
        killerCalcEl.hidden = true;
        killerCalcBtn.classList.remove("on");
        renderRulesPanel();
      }
      return;
    }

    calcCells = cage.cells.length;
    calcSum = cage.sum;
    calcInclude.clear();
    calcExclude.clear();
    for (const [cr, cc] of cage.cells) {
      const v = state.grid[cr][cc];
      if (v !== 0) calcInclude.add(v);
    }
    killerCalcEl.hidden = false;
    killerCalcBtn.classList.add("on");
    calcOpenedByCage = true;
    renderRulesPanel();
    renderKillerCalc();
  }

  function extendSelection(r, c) {
    if (state.selected.some(([sr, sc]) => sr === r && sc === c)) return;
    state.selected.push([r, c]);
    render();
  }

  function pushHistory() {
    state.future = [];   // a fresh move drops anything that was redoable
    state.history.push(snapshot());
    if (state.history.length > 50) state.history.shift();
  }

  function inputNumber(n) {
    resetHint();
    // Pen mode draws on the grid; the keypad has nothing to do there.
    if (state.inputMode === "pen") return;
    if (state.selected.length === 0 || state.won) return;

    if (state.inputMode === "color") {
      pushHistory();
      const colorIndex = n - 1;
      // If every selected cell already carries this colour, take it off them
      // all; otherwise add it, keeping whatever colours they already have.
      const allHaveColor = state.selected.every(([r, c]) => (state.colors[r][c] || []).includes(colorIndex));
      state.selected.forEach(([r, c]) => {
        const list = state.colors[r][c] || [];
        state.colors[r][c] = allHaveColor
          ? list.filter(v => v !== colorIndex)
          : (list.includes(colorIndex) ? list : [...list, colorIndex].sort((a, b) => a - b));
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
        if (settings.autoClearNotes) clearNoteFromPeers(r, c, n);
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
    resetHint();
    // In pen mode, erase clears the drawing rather than the cells.
    if (state.inputMode === "pen") {
      if (state.pen.length === 0) return;
      pushHistory();
      state.pen = [];
      saveState();
      render();
      return;
    }
    if (state.selected.length === 0) return;
    pushHistory();
    state.selected.forEach(([r, c]) => {
      if (state.givens[r][c] === 0) {
        state.grid[r][c] = 0;
        state.cornerNotes[r][c].clear();
        state.centerNotes[r][c].clear();
      }
      state.colors[r][c] = [];
    });
    saveState();
    render();
  }

  function snapshot() {
    return {
      grid: cloneGrid(state.grid),
      cornerNotes: cloneNotes(state.cornerNotes),
      centerNotes: cloneNotes(state.centerNotes),
      colors: cloneColors(state.colors),
      pen: state.pen.slice(),
      mistakes: state.mistakes,
    };
  }

  function restore(snap) {
    resetHint();
    state.grid = snap.grid;
    state.cornerNotes = snap.cornerNotes;
    state.centerNotes = snap.centerNotes;
    state.colors = snap.colors;
    state.pen = snap.pen || [];
    state.mistakes = snap.mistakes;
    forceFullCheck = false;
    saveState();
    render();
  }

  function undo() {
    const prev = state.history.pop();
    if (!prev) return;
    state.future.push(snapshot());
    restore(prev);
  }

  function redo() {
    const next = state.future.pop();
    if (!next) return;
    state.history.push(snapshot());
    restore(next);
  }

  // Back to the starting position, keeping the puzzle loaded. The current
  // board goes on the undo stack, so a mis-tap here isn't destructive.
  function restartPuzzle() {
    if (!state) return;
    pushHistory();
    state.grid = cloneGrid(state.givens);
    state.cornerNotes = emptyNotes();
    state.centerNotes = emptyNotes();
    state.colors = emptyColors();
    state.pen = [];
    state.mistakes = 0;
    state.seconds = 0;
    state.won = false;
    state.hintCell = null;
    state.selected = [];
    forceFullCheck = false;
    resetHint();
    timerDisplay.textContent = formatTime(0);
    winOverlay.classList.remove("show");
    hintOutput.classList.remove("show");
    startTimer();
    saveState();
    render();
  }

  function checkWin() {
    if (isBoardComplete(state.grid) && strictConflicts().size === 0) {
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
      || !!state.antiKing
      || !!state.nonConsecutive
      || !!state.disjointGroups
      || (state.extraRegions && state.extraRegions.length > 0)
      || (state.quadruples && state.quadruples.length > 0)
      || !!state.sandwich
      || (state.xv && state.xv.length > 0)
      || (state.littleKiller && state.littleKiller.length > 0)
      || !!state.diagonals
      || (state.oddEven && state.oddEven.length > 0)
      || !!state.fog;
  }

  // ---------------- Rules panel ----------------
  // Builds the specific rule list for whatever's actually active in the
  // loaded puzzle -- e.g. a puzzle with only thermometers doesn't mention
  // whispers or renban, and a plain classic puzzle shows nothing at all.
  function computeActiveRules() {
    const rules = [];
    if (state.cages && state.cages.length > 0) {
      rules.push("Digits in a dashed cage sum to the small number shown, with no digit repeated inside the cage.");
      if (state.cages.some(c => c.sum == null)) {
        rules.push("A cage with no number just can't repeat a digit.");
      }
    }
    if (state.kropki && state.kropki.length > 0) {
      if (state.kropki.some(d => d.kind === "white")) {
        rules.push("A white dot between two cells means they're consecutive digits.");
      }
      if (state.kropki.some(d => d.kind === "black")) {
        rules.push("A black dot between two cells means one digit is double the other.");
      }
    }
    if (state.kropkiNegative) {
      rules.push("Adjacent cells with no dot between them are confirmed not consecutive and not in a 2:1 ratio.");
    }
    if (state.lines && state.lines.length > 0) {
      if (state.lines.some(l => l.kind === "thermo")) {
        rules.push("Digits increase from the bulb (circle end) to the tip along each thermometer.");
      }
      if (state.lines.some(l => l.kind === "whispers" && (l.diff || 5) === 5)) {
        rules.push("Neighboring digits on a green line differ by 5 or more.");
      }
      if (state.lines.some(l => l.kind === "whispers" && l.diff === 4)) {
        rules.push("Neighboring digits on an orange line differ by 4 or more.");
      }
      if (state.lines.some(l => l.kind === "between")) {
        rules.push("Digits on a line between two circles lie strictly between the two circled digits.");
      }
      if (state.lines.some(l => l.kind === "regionsum")) {
        rules.push("On a blue line, the digits in each 3x3 box the line passes through sum to the same total.");
      }
      if (state.lines.some(l => l.kind === "entropic")) {
        rules.push("Any three cells in a row along a teal line hold one low digit (1-3), one middle (4-6), and one high (7-9).");
      }
      if (state.lines.some(l => l.kind === "modular")) {
        rules.push("Any three cells in a row along a brown line hold digits with three different remainders when divided by 3.");
      }
      if (state.lines.some(l => l.kind === "nabner")) {
        rules.push("Digits on a grey nabner line never repeat and are never consecutive with one another.");
      }
      if (state.lines.some(l => l.kind === "renban")) {
        rules.push("Digits on a purple line form a consecutive set, in any order, with no repeats.");
      }
      if (state.lines.some(l => l.kind === "palindrome")) {
        rules.push("Digits on a line read the same from either end.");
      }
    }
    if (state.arrows && state.arrows.length > 0) {
      rules.push("Digits along an arrow's shaft sum to the digit in its circle.");
    }
    if (state.antiKnight) {
      rules.push("Two cells a knight's-move apart can't hold the same digit.");
    }
    if (state.antiKing) {
      rules.push("Two cells that touch diagonally can't hold the same digit.");
    }
    if (state.nonConsecutive) {
      rules.push("Two cells sharing an edge can't hold consecutive digits.");
    }
    if (state.disjointGroups) {
      rules.push("Cells in the same position within their 3x3 box form a group that holds each digit once.");
    }
    if (state.extraRegions && state.extraRegions.length > 0) {
      rules.push("Each shaded region also contains every digit 1-9 once.");
    }
    if (state.quadruples && state.quadruples.length > 0) {
      rules.push("Digits in a small circle all appear in the four cells around it.");
    }
    if (state.sandwich) {
      rules.push("Clues outside the grid give the sum of the digits sandwiched between the 1 and the 9 in that row or column.");
    }
    if (state.xv && state.xv.length > 0) {
      rules.push("Cells joined by a small X sum to 10; joined by a V, they sum to 5.");
    }
    if (state.littleKiller && state.littleKiller.length > 0) {
      rules.push("Diagonal clues outside the grid give the sum of the digits along that diagonal, in the direction of the arrow.");
    }
    if (state.diagonals === true) {
      rules.push("Both long diagonals also contain every digit 1–9, same as a row.");
    } else if (state.diagonals) {
      rules.push("The marked diagonal also contains every digit 1–9, same as a row.");
    }
    if (state.oddEven && state.oddEven.length > 0) {
      rules.push("Shaded circles must hold an odd digit; shaded squares must hold an even digit.");
    }
    if (state.fog) {
      rules.push("The grid starts hidden under fog. Fill a cell correctly and the fog clears around it.");
    }
    return rules;
  }

  const rulesPanelEl = document.getElementById("rulesPanel");
  function renderRulesPanel() {
    const rules = computeActiveRules();
    // Imported puzzles link back to the video they were featured in.
    const entry = state.puzzleId && (window.PuzzleLibrary || []).find(e => e.id === state.puzzleId);
    const videoUrl = entry && entry.source && entry.source.video;
    const sourceLink = videoUrl && /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+$/.test(videoUrl)
      ? `<a class="rules-panel-source" href="${videoUrl}" target="_blank" rel="noopener">Watch the solve on Cracking the Cryptic</a>`
      : "";
    if (rules.length === 0 && !sourceLink) {
      rulesPanelEl.hidden = true;
      rulesPanelEl.innerHTML = "";
      return;
    }
    if (rules.length === 0) rules.push("Normal sudoku rules: every row, column, and box contains the digits 1–9.");
    rulesPanelEl.innerHTML = `<span class="rules-panel-title">Rules for this puzzle</span>` +
      `<ul>${rules.map(r => `<li>${r}</li>`).join("")}</ul>` + sourceLink;
    // Never show alongside the killer calculator -- they share one slot.
    rulesPanelEl.hidden = !killerCalcEl.hidden;
  }

  function updateHintAvailability() {
    hintBtn.classList.remove("disabled");
  }

  // ---------------- Hints ----------------
  // Hints reason with the same solver the importer used to verify these
  // puzzles, so they understand cages, thermometers, whispers and the rest
  // rather than only classic sudoku. They also come a layer at a time:
  // first what kind of step is available and where, then which digit, then
  // the cell itself -- so a nudge stays a nudge.
  const BOX_NAME = i => `box ${i + 1}`;
  function houseName(kind, index) {
    if (kind === "row") return `row ${index + 1}`;
    if (kind === "col") return `column ${index + 1}`;
    return BOX_NAME(index);
  }

  // Which of this puzzle's rules touch a given cell, named for the
  // explanation ("its cage and the thermometer already rule out ...").
  const LINE_NAMES = {
    thermo: "thermometer", whispers: "whispers line", renban: "renban line",
    palindrome: "palindrome", between: "between line", regionsum: "region sum line",
    entropic: "entropic line", modular: "modular line", nabner: "nabner line",
  };
  function rulesTouching(r, c) {
    const names = [];
    const here = ([cr, cc]) => cr === r && cc === c;
    if ((state.cages || []).some(cage => cage.cells.some(here))) names.push("its cage");
    for (const line of state.lines || []) {
      if (line.cells.some(here)) {
        const label = line.kind === "whispers" && line.diff === 4 ? "Dutch whispers line" : LINE_NAMES[line.kind];
        if (label && !names.includes(`the ${label}`)) names.push(`the ${label}`);
      }
    }
    if ((state.arrows || []).some(a => here(a.circle) || a.cells.some(here))) names.push("the arrow");
    if ((state.kropki || []).some(d => here(d.a) || here(d.b))) names.push("a kropki dot");
    if ((state.xv || []).some(x => here(x.a) || here(x.b))) names.push("an X/V pair");
    if ((state.quadruples || []).some(q => q.cells.some(here))) names.push("a quadruple");
    if ((state.extraRegions || []).some(region => region.some(here))) names.push("its extra region");
    if ((state.oddEven || []).some(o => here(o.cell))) names.push("its odd/even marker");
    if ((state.littleKiller || []).some(k => k.cells.some(here))) names.push("the diagonal clue");
    if (state.antiKnight) names.push("the knight's-move rule");
    if (state.antiKing) names.push("the king's-move rule");
    if (state.nonConsecutive) names.push("the non-consecutive rule");
    if (state.disjointGroups) names.push("the disjoint groups rule");
    if (state.diagonals && (r === c || r + c === 8)) names.push("the marked diagonal");
    return names;
  }

  // Runs the solver over the board as it stands and returns the easiest
  // next step, or an explanation of why there isn't one.
  function findHint() {
    const solver = window.VariantSolver;
    if (!solver) return { kind: "unavailable" };
    const entry = {
      givens: state.grid,
      cages: state.cages, kropki: state.kropki, kropkiNegative: state.kropkiNegative,
      lines: state.lines, arrows: state.arrows, antiKnight: state.antiKnight,
      antiKing: state.antiKing, nonConsecutive: state.nonConsecutive,
      disjointGroups: state.disjointGroups, extraRegions: state.extraRegions,
      quadruples: state.quadruples, sandwich: state.sandwich, xv: state.xv,
      littleKiller: state.littleKiller, diagonals: state.diagonals, oddEven: state.oddEven,
    };
    const model = solver.buildModel(entry);
    const cand = new Array(81);
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      cand[i] = state.grid[r][c] ? solver.bit(state.grid[r][c]) : model.parity[i];
    }
    if (!solver.propagate(model, cand)) return { kind: "contradiction" };

    // A cell with one candidate left.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.grid[r][c] !== 0) continue;
        const mask = cand[r * 9 + c];
        if (solver.popcount(mask) === 1) {
          return { kind: "single", cell: [r, c], value: solver.lowestDigit(mask) };
        }
      }
    }

    // A digit with only one home left in some house.
    const houses = [];
    for (let r = 0; r < 9; r++) houses.push({ kind: "row", index: r, cells: Array.from({ length: 9 }, (_, c) => [r, c]) });
    for (let c = 0; c < 9; c++) houses.push({ kind: "col", index: c, cells: Array.from({ length: 9 }, (_, r) => [r, c]) });
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cells.push([br + dr, bc + dc]);
      houses.push({ kind: "box", index: b, cells });
    }
    for (const house of houses) {
      for (let d = 1; d <= 9; d++) {
        if (house.cells.some(([r, c]) => state.grid[r][c] === d)) continue;
        const spots = house.cells.filter(([r, c]) => state.grid[r][c] === 0 && (cand[r * 9 + c] & solver.bit(d)));
        if (spots.length === 1) {
          return { kind: "hidden", cell: spots[0], value: d, house };
        }
      }
    }

    // Nothing that simple: point at the cell with the fewest options left.
    let best = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.grid[r][c] !== 0) continue;
        const count = solver.popcount(cand[r * 9 + c]);
        if (!best || count < best.count) best = { cell: [r, c], count, mask: cand[r * 9 + c] };
      }
    }
    if (!best) return { kind: "solved" };
    return { kind: "hard", cell: best.cell, count: best.count, value: state.solution ? state.solution[best.cell[0]][best.cell[1]] : null };
  }

  // Three levels: what and where, then which digit, then the cell itself.
  let hintStep = null;
  function resetHint() {
    hintStep = null;
    if (state) state.hintCell = null;
  }

  function showHint() {
    if (!hintStep) hintStep = { hint: findHint(), level: 1 };
    else hintStep.level = Math.min(3, hintStep.level + 1);

    const { hint, level } = hintStep;
    const [r, c] = hint.cell || [];
    let technique = "Hint";
    let text = "";
    let canGoDeeper = false;

    if (hint.kind === "unavailable") {
      text = "The hint engine didn't load — reload the page and try again.";
    } else if (hint.kind === "contradiction") {
      technique = "Stuck";
      text = "Something on the board breaks the rules, so there's no next step to find. Use Check to see which cells clash.";
    } else if (hint.kind === "solved") {
      technique = "Done";
      text = "Every cell is filled.";
    } else if (hint.kind === "single") {
      technique = "One digit left";
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const why = rulesTouching(r, c);
      if (level === 1) {
        text = `A cell in ${BOX_NAME(box)} has only one digit left${why.length ? `, once you account for ${why.slice(0, 2).join(" and ")}` : ""}.`;
        canGoDeeper = true;
      } else if (level === 2) {
        text = `The digit is ${hint.value}. It goes somewhere in ${BOX_NAME(box)}.`;
        canGoDeeper = true;
      } else {
        text = `Row ${r + 1}, column ${c + 1} can only be ${hint.value} — every other digit is ruled out by its row, column and box${why.length ? `, plus ${why.join(", ")}` : ""}.`;
        state.hintCell = [r, c];
      }
    } else if (hint.kind === "hidden") {
      technique = "Only one home";
      const where = houseName(hint.house.kind, hint.house.index);
      if (level === 1) {
        text = `In ${where}, one digit has only one cell left to go in.`;
        canGoDeeper = true;
      } else if (level === 2) {
        text = `Look for where ${hint.value} can go in ${where}.`;
        canGoDeeper = true;
      } else {
        text = `${hint.value} can only go in row ${r + 1}, column ${c + 1} of ${where} — every other cell there is ruled out.`;
        state.hintCell = [r, c];
      }
    } else if (hint.kind === "hard") {
      technique = "Harder step";
      if (level === 1) {
        text = `No cell is down to a single digit yet. The tightest cell has ${hint.count} options left.`;
        canGoDeeper = true;
      } else if (level === 2) {
        text = `Try row ${r + 1}, column ${c + 1} — it has the fewest options (${hint.count}).`;
        state.hintCell = [r, c];
        canGoDeeper = hint.value != null;
      } else {
        text = `Row ${r + 1}, column ${c + 1} is ${hint.value}. Working out why needs a technique this hint engine doesn't explain yet.`;
        state.hintCell = [r, c];
      }
    }

    hintOutput.innerHTML = `<span class="hint-technique">${technique}</span>${text}`
      + (canGoDeeper ? ` <button class="hint-reveal-link" id="hintRevealLink">Tell me more</button>` : "");
    hintOutput.classList.add("show");
    render();
    const link = document.getElementById("hintRevealLink");
    if (link) link.addEventListener("click", showHint);
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
  document.getElementById("settingsBackBtn").addEventListener("click", showMenu);
  document.getElementById("statsBackBtn").addEventListener("click", showMenu);
  document.getElementById("prefsBtn").addEventListener("click", showSettings);
  document.getElementById("statsBtn").addEventListener("click", showStats);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("restartBtn").addEventListener("click", () => {
    if (!state) return;
    const filled = state.grid.flat().filter(Boolean).length - state.givens.flat().filter(Boolean).length;
    if (filled > 0 && !window.confirm("Clear your digits and start this puzzle again?")) return;
    restartPuzzle();
  });
  menuContinueEl.addEventListener("click", showGame);

  document.querySelectorAll("#menuDifficultyRow .chip").forEach(chip => {
    chip.addEventListener("click", () => newGame(chip.dataset.diff));
  });

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("eraseBtn").addEventListener("click", eraseCell);

  hintBtn.addEventListener("click", () => showHint());

  document.getElementById("checkBtn").addEventListener("click", () => {
    forceFullCheck = true;
    render();
    const conflicts = currentConflicts();
    hintOutput.innerHTML = conflicts.size > 0
      ? `<span class="hint-technique">Check</span>Found ${conflicts.size} conflicting cell${conflicts.size === 1 ? "" : "s"} — highlighted in red.`
      : `<span class="hint-technique">Check</span>No conflicts so far. Keep going.`;
    hintOutput.classList.add("show");
  });

  // ---------------- Killer cage calculator ----------------
  // Every way to pick `cells` distinct digits 1-9 that sum to `sum` —
  // the standard killer-cage combination reference. Small enough search
  // space (at most 9 digits) that a plain backtracking search is instant.
  function computeKillerCombos(cells, sum) {
    const results = [];
    function backtrack(start, remaining, count, combo) {
      if (count === cells) {
        if (remaining === 0) results.push(combo.slice());
        return;
      }
      for (let d = start; d <= 9; d++) {
        if (d > remaining) break;
        combo.push(d);
        backtrack(d + 1, remaining - d, count + 1, combo);
        combo.pop();
      }
    }
    backtrack(1, sum, 0, []);
    return results;
  }
  function killerMinSum(cells) { return (cells * (cells + 1)) / 2; }
  function killerMaxSum(cells) { return (cells * (19 - cells)) / 2; }

  const killerCalcBtn = document.getElementById("killerCalcBtn");
  const killerCalcEl = document.getElementById("killerCalc");
  const calcCellsValueEl = document.getElementById("calcCellsValue");
  const calcSumValueEl = document.getElementById("calcSumValue");
  const killerCalcCombosEl = document.getElementById("killerCalcCombos");
  const calcDigitFilterEl = document.getElementById("calcDigitFilter");
  const calcFilterClearEl = document.getElementById("calcFilterClear");
  const calcFilterHintEl = document.getElementById("calcFilterHint");
  calcFilterClearEl.addEventListener("click", () => {
    calcInclude.clear();
    calcExclude.clear();
    renderKillerCalc();
  });
  let calcCells = 3;
  let calcSum = 15;

  // Digits the cage is known to contain / known not to contain. Both are
  // filters on the combination list, not extra sums: a digit you've ruled
  // out in the grid usually rules out half the combinations here too.
  const calcInclude = new Set();
  const calcExclude = new Set();

  function renderDigitFilter() {
    calcDigitFilterEl.innerHTML = "";
    for (let d = 1; d <= 9; d++) {
      const btn = document.createElement("button");
      btn.className = "calc-digit";
      btn.textContent = d;
      const required = calcInclude.has(d);
      const ruledOut = calcExclude.has(d);
      if (required) btn.classList.add("include");
      if (ruledOut) btn.classList.add("exclude");
      btn.setAttribute("aria-label",
        `${d}: ${required ? "required" : ruledOut ? "ruled out" : "not filtered"}`);
      btn.addEventListener("click", () => {
        // neutral -> required -> ruled out -> neutral
        if (required) { calcInclude.delete(d); calcExclude.add(d); }
        else if (ruledOut) { calcExclude.delete(d); }
        else { calcInclude.add(d); }
        renderKillerCalc();
      });
      calcDigitFilterEl.appendChild(btn);
    }
    calcFilterClearEl.hidden = calcInclude.size === 0 && calcExclude.size === 0;
  }

  function renderKillerCalc() {
    calcCellsValueEl.textContent = calcCells;
    calcSumValueEl.textContent = calcSum;
    renderDigitFilter();
    const all = computeKillerCombos(calcCells, calcSum);
    const combos = all.filter(combo => (
      [...calcInclude].every(d => combo.includes(d)) && [...calcExclude].every(d => !combo.includes(d))
    ));
    killerCalcCombosEl.innerHTML = "";
    if (combos.length === 0) {
      const p = document.createElement("p");
      p.className = "killer-calc-empty";
      p.textContent = all.length === 0
        ? "No combination of that many cells sums to that total."
        : "No combination left once those digits are required or ruled out.";
      killerCalcCombosEl.appendChild(p);
      return;
    }
    // Digits shared by every remaining combination are forced in the cage.
    const forced = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => combos.every(combo => combo.includes(d)));
    calcFilterHintEl.textContent = combos.length < all.length
      ? `${combos.length} of ${all.length} combinations left${forced.length ? ` — every one uses ${forced.join(", ")}` : ""}.`
      : "Tap a digit once to require it, twice to rule it out. Tap a combo to cross it out.";
    combos.forEach(combo => {
      const btn = document.createElement("button");
      btn.className = "combo-chip";
      btn.textContent = combo.join("  ");
      btn.addEventListener("click", () => btn.classList.toggle("crossed-out"));
      killerCalcCombosEl.appendChild(btn);
    });
  }

  function adjustCalcCells(delta) {
    calcCells = Math.max(2, Math.min(9, calcCells + delta));
    calcSum = Math.max(killerMinSum(calcCells), Math.min(killerMaxSum(calcCells), calcSum));
    renderKillerCalc();
  }
  function adjustCalcSum(delta) {
    calcSum = Math.max(killerMinSum(calcCells), Math.min(killerMaxSum(calcCells), calcSum + delta));
    renderKillerCalc();
  }

  document.getElementById("calcCellsMinus").addEventListener("click", () => adjustCalcCells(-1));
  document.getElementById("calcCellsPlus").addEventListener("click", () => adjustCalcCells(1));
  document.getElementById("calcSumMinus").addEventListener("click", () => adjustCalcSum(-1));
  document.getElementById("calcSumPlus").addEventListener("click", () => adjustCalcSum(1));

  killerCalcBtn.addEventListener("click", () => {
    const opening = killerCalcEl.hidden;
    calcOpenedByCage = false;
    killerCalcEl.hidden = !opening;
    killerCalcBtn.classList.toggle("on", opening);
    // The calculator and the rules panel share one slot — opening the
    // calculator hides the rules, closing it brings them back.
    renderRulesPanel();
    // Only (re)compute on first open — reopening the panel without
    // changing cells/sum should keep whatever's been crossed out.
    if (opening && !killerCalcCombosEl.children.length) renderKillerCalc();
  });

  // Physical keyboard support (useful with a Fold's larger screen / attached keyboard)
  document.addEventListener("keydown", (e) => {
    if (!state || layoutEl.hidden) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

    // Undo/redo, and the mode keys SudokuPad users already have in muscle
    // memory (Z/X/C/V), plus Shift+digit for a corner mark and Ctrl+digit
    // for a centre mark without leaving digit mode.
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const modeKey = { z: "digit", x: "corner", c: "center", v: "color", b: "pen" }[key];
      if (modeKey) { setInputMode(modeKey); return; }
    }

    if (state.selected.length === 0) return;
    const [r, c] = state.selected[state.selected.length - 1];
    if (e.key >= "1" && e.key <= "9") {
      const digit = parseInt(e.key, 10);
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const previous = state.inputMode;
        setInputMode(e.shiftKey ? "corner" : "center");
        inputNumber(digit);
        setInputMode(previous);
      } else {
        inputNumber(digit);
      }
      e.preventDefault();
      return;
    }
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
  // In pen mode the same drag draws instead of selecting: the stroke walks
  // the lattice, toggling each segment it crosses (so drawing back over a
  // line rubs it out), and one tap without moving leaves a dot.
  let penFrom = null;
  let penDrew = false;
  boardEl.addEventListener("pointerdown", (e) => {
    if (state.inputMode === "pen") {
      pushHistory();
      penFrom = penNodeAt(e);
      penDrew = false;
      boardEl.setPointerCapture && boardEl.setPointerCapture(e.pointerId);
      return;
    }
    const cellEl = e.target.closest(".cell");
    if (!cellEl) return;
    isDragSelecting = true;
    selectCell(parseInt(cellEl.dataset.r, 10), parseInt(cellEl.dataset.c, 10));
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (penFrom) {
      const to = penNodeAt(e);
      if (to[0] === penFrom[0] && to[1] === penFrom[1]) return;
      // Only join neighbouring lattice points, so a fast drag lays down a
      // run of short segments rather than one long diagonal jump.
      const steps = Math.max(Math.abs(to[0] - penFrom[0]), Math.abs(to[1] - penFrom[1])) / PEN_STEP;
      if (steps > 1) {
        const start = penFrom;
        const dx = (to[0] - start[0]) / steps, dy = (to[1] - start[1]) / steps;
        for (let i = 1; i <= steps; i++) {
          const next = [start[0] + dx * i, start[1] + dy * i];
          togglePenSegment(penFrom, next);
          penFrom = next;
        }
      } else {
        togglePenSegment(penFrom, to);
        penFrom = to;
      }
      penDrew = true;
      renderPen();
      saveState();
      return;
    }
    if (!isDragSelecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el && el.closest(".cell");
    if (!cellEl) return;
    extendSelection(parseInt(cellEl.dataset.r, 10), parseInt(cellEl.dataset.c, 10));
  });
  function endPenStroke() {
    if (penFrom && !penDrew) {
      togglePenSegment(penFrom, penFrom);   // a tap leaves (or lifts) a dot
      renderPen();
      saveState();
    }
    penFrom = null;
    penDrew = false;
  }
  document.addEventListener("pointerup", () => { isDragSelecting = false; endPenStroke(); });
  document.addEventListener("pointercancel", () => { isDragSelecting = false; endPenStroke(); });

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
  loadSettings();
  timerDisplay.hidden = !!settings.hideTimer;
  if (loadState()) {
    renderConstraintOverlays();
    renderRulesPanel();
    render();
    renderSandwichClues();
    renderLittleKillerClues();
    updateHintAvailability();
  }
  showMenu();
})();
