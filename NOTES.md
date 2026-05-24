# Redux – working notes

Working scratchpad for Redux development. Lightweight by design: where we are, what is deferred, what is open. The polished rationale lives in [PEDAGOGY.md](PEDAGOGY.md); the user-facing description lives in [README.md](README.md). This file is just for development hand-off and open questions.

## Where we are

Tabs 1 and 2 are complete and the app is ready for student use.

- **Tab 1 (Depth).** Classical-vs-quantum head-to-head with V₀ slider, finite bound-state count, wavefunction past the walls, ionisation threshold, and a "quantum bound state manifold" readout (n, E_n, parity, k, 1/κ, Born |c_n|² when *Show eigenstates* is on).
- **Tab 2 (Width).** Two quantum systems side-by-side in real units (nm, m_e, eV) with a particle preset menu (electron, light/heavy effective electron, muon, proton, deuteron, alpha), per-parameter link toggles between A and B (default: all on), smart energy linking (eigenstate tick clicks pair by *n*, slider drag pairs by eV), and a per-side Spectroscopy panel covering within-system transitions and A↔B same-*n* photon energies.
- **Tab 3 (Shape).** Designed; not yet implemented. See "Resolved decisions" below for the locked design.

Both tabs share: unified Play/Pause toggle, transport bar with Save (CSV / JSON with distinct schemas — `finite-well-particle-export/v1`, `finite-well-comparison-export/v1`), Load with cross-tab import flow, Settings modal, *Show theory* / *Show eigenstates* toggles, editable numeric values (click any number to type), collapsible Notes ("What you're looking at") and Spectroscopy sections (Tab 2 only).

Next session: backlog items in any order — populate `examples/` (folder + README), fix `CITATION.cff` URL to point at https://the-kennepohl-group.github.io/ParticleQuoVadisRedux/ once Pages deploy is confirmed, or begin Tab 3 implementation against the design locked in this branch.

## Repository layout

```
/                         (Redux repo root)
  index.html              Deployment wrapper (UMD React + Babel-standalone)
  src/
    ParticleQuoVadisRedux.js   single-component source (~5800 lines, JSX in .js)
  _reference/
    README.md             explains what this folder is for
    ParticleQuoVadis.js   first app's source, reference only — delete when no longer consulted
  PEDAGOGY.md             design rationale (single doc, merged from Redux + inherited from app 1)
  README.md               user-facing description
  CHANGELOG.md            release log
  CITATION.cff            citation metadata
  NOTES.md                this file
  examples/               saved simulation states (to be populated)
  LICENSE, LICENSE-docs   inherited unchanged
  .github/, .gitignore, .gitattributes   inherited unchanged
```

## Open questions / deferred decisions

- **Examples folder population.** README lists five suggested seeds — polyene-length comparison, effective-mass contrast, shallow vs deep well, near-threshold leakage, photoionisation. Need to capture these as JSON files in `examples/`. Naming: `fwell_pair_polyene_lengths.json`, `fwell_pair_effective_mass.json`, `fwell_pair_well_depth.json`, `fwell_single_near_threshold.json`, `fwell_single_photoionisation.json`.
- **Localization.** Settings modal has a language picker scaffold; only English strings exist. French would be the natural second locale given the UofC francophone constituency. Defer until requested.
- **Deploy URL.** `CITATION.cff` lists `https://pkennepohl.github.io/ParticleQuoVadisRedux/`. Confirm or update once GitHub Pages is configured.
- **PDF / image export.** Save currently exports CSV and JSON. A "snapshot PNG of current view" button has come up in conversation and is plausible but not in scope yet.

## Resolved decisions (for reference)

These were open in earlier versions of this file and have since been settled. Listed here in case the reasoning matters later.

- **Tab 3 (Shape) design.** Two quantum systems side by side, mirroring Tab 2's structure (A↔B, classical comparison dropped). Each side has a shape picker: finite-square, truncated-parabolic, softened-Coulomb. The electron remains "the particle" on every shape — vibrational framing was rejected because in a vibrational problem "the particle" becomes a reduced-mass coordinate, and the silent gear-shift on what the box and wavefunction represent costs more than the harmonic-vs-Morse punchline buys for chemistry juniors. Vibrations stay as an *applied connection* in the Notes. Unified parametrisation across shapes: L = FWHM at half the well depth (nm), V₀ = depth (eV, floor at 0 on every shape — Coulomb's natural -A→0 convention shifted to match), m\* in m_e. Truncated parabolic — V(x) = min(½m\*ω²x², V₀) — preserves Tab 1's threshold/ionisation story on every shape; pure HO ladder ℏω(n+½) survives as a deep-well asymptote. Softened Coulomb's a = L/(2√3) falls out of the FWHM convention by construction. Link toggles, smart energy linking, Spectroscopy panel, defaults (all-linked, both sides finite-square on first run) all port from Tab 2 unchanged. Adaptive Notes for shape-contrast text deferred to implementation. See `PEDAGOGY.md` *Tab 3 – shape over vibration* for the full rationale.
- **Real units in Tab 2.** Shipped: L in nm, m\* in m_e, V₀ in eV. Energy scale tied to E\* = ℏ²/(2m\*L²) with E\*_REF = 0.038100 eV at L=1 nm, m=m_e.
- **Particle-preset picker.** Shipped: clickable `m*/m_e` label opens a menu with electron, light electron (0.067 m_e, GaAs-like), heavy electron (0.5 m_e), muon, proton, deuteron, alpha.
- **Per-parameter linking between A and B.** Shipped: chain icon next to each of L, m\*, V₀, Γ, σ, and the energy slider. Default state is all-linked (same-vs-same on first run). Energy linking is smart — eigenstate tick clicks pair on quantum number *n*, slider drags pair on absolute eV.
- **Tab visual parity.** Shipped: Tab 1 was re-aligned to Tab 2's layout conventions after Tab 2 stabilised (trackHeight 140, params|slider grid, V₀ label on the right, full-width transport bar, transparent panel styling).
- **Notes phrasing.** Adaptive notes show integer percentages when ≥ 1 % and one decimal place when < 1 %. Sig-figs throttled elsewhere (energy histogram axis ticks regenerated by index, not by float accumulation, to avoid `0.1 + 0.1 + 0.1 ≠ 0.3` artefacts).
- **Defaults on first run.** Stopped (not running), *Show eigenstates* off, *Show theory* off, all link toggles on in Tab 2, |ψ|² visualisation mode, Notes and Spectroscopy collapsed.
- **Cross-tab import.** Loading a single-system file (`fwell_single_…`) in Tab 2 prompts the user to pick a destination side; loading a pair file (`fwell_pair_…`) in Tab 1 prompts for which side to import. Schema is detected from the JSON payload's `schema` field; unit conversion is via E\*_REF.
- **Photoelectron vs quantum dot as the lead Tab 1 chemistry analog.** Resolved: both are mentioned in the adaptive notes; the headline is ionisation, and notes connect it to UPS / XPS, work functions, and quantum-dot bandgaps depending on which regime the slider is in.

## Architectural conventions

- Single React component in `src/ParticleQuoVadisRedux.js`. All physics, UI, persistence, and export logic in one file.
- `.js` extension (not `.jsx`) because GitHub Pages serves `.js` with the correct JavaScript MIME type. Babel-standalone compiles JSX in the browser at load time.
- React loaded as UMD globals from `index.html`. No ES module imports inside the source file.
- Comments explain *why* (physics or pedagogy), not *what*.
- Colour palette and typography fixed (see PEDAGOGY.md final section).
- Export schema versioning: `finite-well-particle-export/v1` for Tab 1, `finite-well-comparison-export/v1` for Tab 2. Bump the version suffix on any breaking schema change.
- File naming for saved states: `fwell_single_…` (Tab 1) and `fwell_pair_…` (Tab 2). Generated filenames include a timestamp and a short tag derived from the parameters.

## Conventions for this development process

Lightweight versions of habits borrowed from a heavier process used on another of Pierre's projects:

- Major implementation chunks pause for confirmation before starting.
- End of a working session: a few-sentence hand-off at the top of this file ("Where we are") gets updated.
- Before declaring a chunk done, ask "anything else, any friction you saw" before moving on.
- No phase branches, no architectural locks, no test count contracts, no verification grep blocks. The app is small enough to hold in working memory; the heavier process would be cargo cult here.
