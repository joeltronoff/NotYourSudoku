(() => {
  const STORAGE_KEY = "solvers-notebook-state-v3";
  const { generatePuzzle, computeCandidates, getHint, isBoardComplete, findConflicts, findVariantConflicts, cloneGrid } = window.SudokuEngine;

  function currentConflicts() {
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
    recommended: {
      title: "Recommended",
      blurb: "A mixed tour of the library, ordered from easiest to hardest.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l2.6 5.5 6 .72-4.43 4.16 1.16 5.92L12 16.6l-5.33 2.9 1.16-5.92L3.4 9.42l6-.72z" fill="currentColor" fill-opacity="0.18"/></svg>',
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
    titlebarEl.hidden = false;
    layoutEl.hidden = false;
    if (state && !state.won) startTimer();
  }
  function showMenu() {
    variantMenuEl.hidden = true;
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
    variantMenuEl.hidden = false;
    renderVariantMenu(variantKey);
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

    const listEl = document.getElementById("menuVariantList");
    listEl.innerHTML = "";
    Object.keys(VARIANT_INFO).forEach(key => {
      if (key === "recommended") return;
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
    const listEl = document.getElementById("menuPuzzleList");
    listEl.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "menu-puzzle-empty";
      empty.textContent = variantMenuSort === "gas"
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
      const row = document.createElement("button");
      row.className = "menu-puzzle-row" + (solved ? " solved" : "");
      row.innerHTML = `
        <span class="menu-puzzle-check">${solved ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}</span>
        <span class="menu-puzzle-info">
          <span class="menu-puzzle-title-row">
            <span class="menu-puzzle-title">${entry.title}</span>
            ${renderStars(entry.stars)}
            ${combinedTag}
          </span>
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

        boardEl.appendChild(cell);
      }
    }
    renderDigits(conflicts, fogRevealed);
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
    renderDecorations();
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
        text.textContent = cage.sum == null ? "" : cage.sum;
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
    group.setAttribute("id", "decoGroup");
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
  function renderDecorationFog(fogRevealed) {
    const group = decoOverlayEl.querySelector("#decoGroup");
    if (!group) return;
    const svg = decoOverlayEl.querySelector("svg");
    const old = svg.querySelector("clipPath");
    if (old) old.remove();
    if (!fogRevealed) {
      group.removeAttribute("clip-path");
      return;
    }
    const clip = document.createElementNS(SVG_NS, "clipPath");
    clip.setAttribute("id", "decoFogClip");
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
    group.setAttribute("clip-path", "url(#decoFogClip)");
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
  let calcCells = 3;
  let calcSum = 15;

  function renderKillerCalc() {
    calcCellsValueEl.textContent = calcCells;
    calcSumValueEl.textContent = calcSum;
    const combos = computeKillerCombos(calcCells, calcSum);
    killerCalcCombosEl.innerHTML = "";
    if (combos.length === 0) {
      const p = document.createElement("p");
      p.className = "killer-calc-empty";
      p.textContent = "No combination of that many cells sums to that total.";
      killerCalcCombosEl.appendChild(p);
      return;
    }
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
    renderConstraintOverlays();
    renderRulesPanel();
    render();
    renderSandwichClues();
    renderLittleKillerClues();
    updateHintAvailability();
  }
  showMenu();
})();
