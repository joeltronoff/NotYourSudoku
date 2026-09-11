# Solver's Notebook — Sudoku

A logic-driven sudoku PWA, optimized for the Galaxy Z Fold's unfolded wide screen (and its cover screen too).

## What's in Phase 1
- Classic 9x9 sudoku with 4 difficulty levels (guaranteed unique solutions)
- Pencil marks / notes, undo, erase, conflict highlighting
- Timer + mistake tracker
- Two-tier hint system based on real logical solving techniques (naked singles, hidden singles, pointing pairs, naked pairs) — a "nudge" (points at the area) or a "reveal" (explains the deduction)
- Installable as a home-screen app, works offline, saves your game automatically

## Getting it onto your phone (free, ~5 minutes)

**Easiest option — GitHub Pages:**
1. Create a free GitHub account if you don't have one: github.com
2. Create a new repository (e.g. `sudoku-notebook`)
3. Upload all the files in this folder to that repository
4. In the repo, go to **Settings → Pages**, set source to the main branch
5. GitHub gives you a URL like `https://yourname.github.io/sudoku-notebook/`
6. Open that link on your Galaxy Z Fold in Chrome
7. Tap the menu (⋮) → **Add to Home screen** (or Chrome may prompt you automatically, since the in-app "Install" banner will also appear)

That's it — it now behaves like a normal installed app: its own icon, launches full-screen, works with the screen unfolded or folded, and works offline after the first load.

**Alternative:** Netlify or Vercel also work (drag-and-drop the folder on their free tier) if you'd rather not use GitHub.

## Next phases (when you're ready)
- Daily auto-import of puzzles from Cracking The Cryptic's video descriptions (via the free YouTube API + a scheduled script)
- Support for variant sudoku (killer cages, thermometers, arrows, German whispers, etc.) to match the show's puzzle style
