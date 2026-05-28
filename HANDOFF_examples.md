# Handoff — Build the EXAMPLES preset library

## Current repository state (read this first)

**Branch:** `tab3-shape-impl` (NOT `main`).

**Uncommitted changes** (from the session that just ended):
- `src/ParticleQuoVadisRedux.js` — the simulation source. Includes all the Tab 2/3 propagation, scatter-with-marginals layout, tooltips, Γ=0 → true delta fix, compact "n=k" → "k" labels on Tab 2/3, and the EH theory band fill-side fix.
- `NOTES.md` — internal dev-history log updated with this session's changes.
- `index.html` — minor cache-bust script.

**Untracked items:**
- `EXAMPLES.md` — the experiment catalogue this session will work from.
- `examples/` — three Tab 1 preset files already saved (default filename format `fwell_single_…`). These predate this session; rename or move aside as needed.
- `ParticleQuoVadisRedux/` — a subdirectory inside the project root. Investigate — looks like it may have been created by accident (nested clone or partial copy). Worth checking before doing anything destructive.
- `QuoVadisRedux.txt` — another stray file. Inspect.

**Recommended first step:** commit the source/NOTES/index changes on `tab3-shape-impl` before starting example work. The example session might iterate on EXAMPLES.md text, and you want the simulation source pinned to a known commit during that iteration.

```bash
# Step 1 — clean up untracked stray items first if they aren't needed.
#   Check what's in ParticleQuoVadisRedux/ and QuoVadisRedux.txt before deleting!

# Step 2 — commit the session's source changes on the existing branch.
cd /c/Users/pierre.kennepohl/Projects/ParticleQuoVadisRedux/
git add src/ParticleQuoVadisRedux.js NOTES.md index.html
git commit -m "Tab 2/3 propagation, scatter-with-marginals everywhere, tooltips, Γ=0 fix"

# Step 3 — for the examples work, create a dedicated branch.
git checkout -b examples-preset-library

# Then do the example walkthrough on this branch. When done:
git add EXAMPLES.md examples/
git commit -m "EXAMPLES.md walkthrough + preset JSON files"
# Open a PR or merge back into tab3-shape-impl when you're satisfied.
```

A separate `examples-preset-library` branch keeps the example assets cleanly separable from the implementation work. Merge them into the same final branch (or main) at the end.

---

## Context for the new thread

**Project:** *Particle, Quo Vadis. Redux* — a single-file React simulation at this repo root. Source is `src/ParticleQuoVadisRedux.js`. Open `index.html` in any modern browser, or use the preview launch config at `.claude/launch.json` (port 8765).

**Goal of the session:** Walk through the 16 experiments in `EXAMPLES.md`, configure each one in the app, verify the simulation behaves as the example describes, then save each as a JSON preset file in `examples/`. Build a preset library that students/instructors will load with one click.

**Simulation status:** Feature-complete on Tabs 1/2/3 with the scatter-with-marginals layout, tooltips, centred x-axis, pink ionised-bar coding, etc. No active bugs known. The Γ=0 case was just fixed to be a true delta-function preparation (relevant to several examples — see "Per-example checklist" below).

---

## What to do

For each of the 16 examples in `EXAMPLES.md`:

1. **Configure.** Set the parameters exactly as the `Setup` block says.
2. **Run.** Click Play. Let the simulation accumulate ~2 000 measurements (the counter is top-right of the transport bar). For ionisation-onset and σ/Γ examples, ~5 000 measurements give cleaner statistics.
3. **Verify.** Read the `Observe` block and confirm the histograms / summary panel / wavefunction view match the description. **Flag any disagreement** — it's either a misstatement in EXAMPLES.md or a remaining bug.
4. **Save JSON.** Click the Save button → JSON. Move the file into `examples/`. Rename to the new convention (see below).
5. **CSV question** — see below.
6. **Make a note** of any setup detail that wasn't obvious from the Setup block (which slider tick you clicked, what value an input had to be typed, etc.) so EXAMPLES.md can be refined.

---

## Pedagogical order to walk through

Build complexity progressively. Within each tab, start with the most visually striking contrast and end with the most subtle:

### Day 1 — Classical vs Quantum (Tab 1, six examples)

`1.1 → 1.3 → 1.2 → 1.5 → 1.4 → 1.6`

Rationale: position distribution (1.1) is the most visually obvious — flat vs peaked. Leakage (1.3) builds the chemistry punchline (forbidden-region amplitude). Correspondence (1.2) is the bridge to "quantum becomes classical at high n". Discrete energies (1.5) requires histogram reading — students need the previous three to anchor that intuition. Ionisation onset (1.4) is the photoionisation chemistry payoff. σ vs Γ (1.6) is the meta-lesson about preparation vs measurement — leave it last so students have seen all the surfaces it acts on.

### Day 2 — Two-quantum-system comparisons (Tab 2, six examples)

`2.1 → 2.5 → 2.4 → 2.2 → 2.6 → 2.3`

Rationale: size (2.1) is the famous quantum-dot story. Confinement-energy scaling (2.5) gives the quantitative 1/L². Photon transitions (2.4) is "this is how we'd measure it". Effective mass (2.2) opens the semiconductor regime. Muon (2.6) and proton (2.3) are extreme-mass cases that strengthen the m\* intuition.

### Day 3 — Shape comparisons (Tab 3, five examples)

`3.2 → 3.1 → 3.3 → 3.5 → 3.4`

Rationale: square vs Coulomb (3.2) is the most striking shape contrast. Harmonic vs Coulomb (3.1) — both are common in chemistry, the contrast carries the lesson. Square vs parabolic (3.3) — bond dissociation analogue, ties to actual molecular vibrations. Coulomb mass scaling (3.5) — connects back to muonic atoms. Rydberg sizes (3.4) — most abstract, save for last.

---

## Naming convention for JSON files

Use: `examples/<tab>_<n>_<slug>.json`

- `examples/depth_1.1_position_distribution.json`
- `examples/depth_1.6_sigma_vs_gamma.json`
- `examples/width_2.1_quantum_dot_size.json`
- `examples/shape_3.3_dissociation_analogue.json`

The tab prefix matches the tab and avoids ambiguity. The `1.1` matches the section number in EXAMPLES.md. The slug is what makes it human-grep-able.

The three existing `fwell_single_V…` files in `examples/` are pre-session saves — either rename them to fit (if they're useful) or delete (if you'll re-save fresh).

---

## Should you also save CSVs?

**Default to JSON only.** JSON contains the full parameter state plus histogram counts — it round-trips everything needed to recreate the experiment.

**Save CSV in addition to JSON for examples where students will analyse the histogram data offline.** Specifically:

- **1.4 (ionisation onset)** — CSV lets students plot the cross-V₀ tail manually.
- **1.6 (σ vs Γ)** — CSV shows the peak shape under each prep/readout combo, useful for fitting exercises.
- **2.4 (photon transitions)** — CSV lets students extract transition energies for a lab report.
- **3.1 (ladder contrast)** — CSV makes the n² vs (n+½) vs 1/n² fits a homework problem.

For the rest, JSON alone is sufficient.

---

## Per-example checklist — what should look right

A few examples that are most likely to surprise:

- **1.3 (leakage):** P_ion must be **exactly 0** on both sides (this is the new behaviour after the Γ=0 fix). If you see nonzero P_ion, that's a regression — the helpers `computeProbs`, `lorentzCDF`, `sampleLorentzAbove` should short-circuit when `gammaInternal <= GAMMA_INTERNAL_MIN`. P_out should be nonzero on the quantum side and exactly 0 classical.
- **1.4 (ionisation onset):** P_ion should be small but nonzero on quantum (the Lorentzian tail past V₀), exactly 0 classical. Order ~1–5 % depending on how close to V₀ the prep sits.
- **1.6 case 1 (Γ=0, σ=0):** P_ion = 0 on both, sharp peak at E_top.
- **1.6 case 3 (Γ>0, σ=0):** Classical histogram still sharp at the prep energy (not at any eigenvalue) — Γ doesn't broaden classical because classical sampling doesn't go through Born collapse. Quantum shows multi-peak structure at neighbouring eigenstates.
- **3.1 (harmonic vs Coulomb):** Tab 3 with V₀=10 eV, L=1 nm produces ~5–8 bound states on parabolic, ~8 on Coulomb. The eigenvalue table should show evenly-spaced energies for A (parabolic) and converging energies for B (Coulomb).

---

## Three setup gotchas

1. **Show eigenstates is OFF by default.** Most examples need it ON to snap-prep to an exact eigenstate. Click the checkbox next to the gear icon in the transport bar (per-tab persistence — set it on each tab independently).
2. **The energy slider has snap behaviour when Show eigenstates is on.** Clicking an eigenstate tick mark on the slider snaps to that exact eigenvalue. This is the easiest way to set "prep at E_n exactly" without typing a number.
3. **Γ shown as "0" used to leak ~4 % P_ion near V₀** — that's now fixed. If you see weird ionisation at Γ=0, double-check that the source is up to date (search for `GAMMA_INTERNAL_MIN` in `src/ParticleQuoVadisRedux.js` — should appear in three short-circuit `if` clauses inside `computeProbs`, `lorentzCDF`, `sampleLorentzAbove`).

---

## Workflow tips

- Use the Settings gear (transport bar) to set "Measurements per cycle" to ~2000 so each Play stops at a clean number — easier to compare across runs.
- For examples that need eigenstate-snap energy, turn Show eigenstates ON *before* clicking Play so the snap ticks are visible.
- Stop and reset between examples — leftover histograms from a previous run distort the next one.
- For Tab 2/3 examples that vary one parameter between A and B, unlink that parameter *first* (click the chain icon next to it), *then* change the value on the other side. Doing it the other way around will move both sides together.

---

## Files to consult during the session

- `EXAMPLES.md` — the experiment list with Setup / Observe / Chemistry blocks.
- `PEDAGOGY.md` — design rationale, why each tab exists.
- `README.md` — student-facing overview.
- `NOTES.md` — internal dev history; useful only if you need to understand why a particular UI choice was made.
- `src/ParticleQuoVadisRedux.js` — the source. Read-only for this session unless EXAMPLES.md needs to be corrected because the simulation actually behaves differently than described.

---

## Deliverables

By session end:

1. An `examples/` directory containing 16 JSON files (one per example), and CSVs for the 4 noted above.
2. Edits to `EXAMPLES.md` for any setup-detail clarifications discovered during the walkthrough.
3. A short report (in chat) listing any examples where the simulation didn't match the description — including whether you think it's an EXAMPLES.md fix or a code fix.
4. A clean commit on the `examples-preset-library` branch capturing the deliverables above.
