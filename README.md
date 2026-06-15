# Particle, Quo Vadis. Redux

An interactive simulation of a particle in a one-dimensional finite potential well. A teaching tool for chemistry students covering ionisation, bound versus continuum states, the diffuseness of bound electronic states, and how the bound spectrum responds to changes in box geometry and effective mass.

Sibling to [*Particle, Quo Vadis?*](https://github.com/pkennepohl/particle-quo-vadis), which covers the infinite-well case. The two apps are designed to be used together; Redux extends the first app's classical-vs-quantum comparison to a finite well and adds a side-by-side comparison of two systems with independently tunable geometry.

## What this teaches

Redux carries two intertwined chemistry stories.

**Ionisation (Tab 1).** Set the system energy below the well depth *V₀* and you have a bound electron in a molecular orbital; set it above *V₀* and the electron has been ejected — the photoelectron spectroscopy, work-function, and ionisation-potential regime. *V₀* stands in for the ionisation potential. Beyond that headline, several abstract ideas become tangible:

- **A finite number of bound states.** Deeper well, more bound orbitals — the same intuition as "more highly charged nucleus, more bound atomic orbitals before the ionisation threshold".
- **Wavefunction leakage past the wall.** The classically forbidden region is not classically forbidden in quantum mechanics. This is the precondition for tunneling and the reason molecular orbitals are not sharply confined.
- **Quantisation of bound-state energy** — sharp peaks at the numerical eigenvalues in the energy histogram, emerging from the Born rule.
- **Classical-vs-quantum threshold contrast.** Above *V₀*, the classical particle escapes; the quantum particle is reported as ionised. Both panels switch to an "ionised" indicator. The parallel escape preserves the comparison and stays truthful about continuum states.

**Geometry and inertia drive the energy ladder (Tab 2).** Two independently configured quantum wells (System A and System B) are simulated side by side. The student can vary L (well width, nm), m\* (effective mass, m_e), and V₀ (depth, eV) on each side. The chemistry story is the size and mass dependence of bound-state spacing — the textbook explanation for conjugated π-system absorption colours, cyanine dye chain-length shifts, and quantum-dot fluorescence tuning. By default, all six parameters are linked across A and B so the student starts from a same-vs-same baseline and unlocks the chains they want to compare.

See [PEDAGOGY.md](PEDAGOGY.md) for the design rationale, including the explicit reasoning for picking ionisation over tunneling as the central narrative in Tab 1 and "same prep, different physical system" as the framing for Tab 2.

## Two tabs, two stories

- **Tab 1 — Depth.** Classical vs quantum, fixed L and m. Adds a *V₀* slider, finite bound-state count, wavefunction visualisation past the walls, the ionisation threshold, and a live readout of the bound spectrum with parity, k, decay length 1/κ, and the current preparation's Born probability per state.
- **Tab 2 — Width.** Two quantum systems side-by-side in real units (nm, m_e, eV). Each side has its own L, m\* (with a particle preset picker — electron, light/heavy effective electron, muon, proton, deuteron, alpha), and V₀. Every parameter has a link toggle so it can be locked across A and B (geometry-only comparison) or unlocked (full-flexibility comparison). Shared preparation (energy slider, σ, Γ) feeds both systems. Includes a per-side Spectroscopy panel that reports within-system transition energies and the A→B same-*n* photon energy for inter-well comparisons.
- **Tab 3 — Shape.** Two quantum systems whose confining-potential *shape* differs — finite square, truncated parabolic, or softened Coulomb — at the same width and depth, so the wavefunctions and energy ladders diverge even though the box size matches. Same A↔B link toggles and Spectroscopy machinery as Tab 2.

## Try it

**Live:** <https://the-kennepohl-group.github.io/ParticleQuoVadisRedux/>

The simulation is a single HTML page. To run it locally, open [`index.html`](index.html) in any modern browser. No installation required.

## How to use it

Each tab has a transport bar at the top (Play / Pause / Stop, Save, Load, Settings, plus Show theory / Show eigenstates / Overlay simulations toggles), a parameters block paired with a vertical energy slider, and the simulation panels below.

- **Play / Pause** is a single toggle. **Stop** resets the accumulated measurement histograms but keeps the parameters.
- **Save** offers CSV or JSON; each tab uses a distinct schema (`finite-well-particle-export/v1` for Tab 1, `finite-well-comparison-export/v1` for Tab 2, `finite-well-shape-comparison-export/v1` for Tab 3). Filenames begin with `fwell_single_…` (Tab 1) or `fwell_pair_…` (Tabs 2–3) for at-a-glance disambiguation. Loading the "wrong" file type into a tab prompts a cross-import flow (pick which side / which destination). Saved files record the current view state (overlay on/off, normalize, ψ-mode, histogram bins), so reopening a preset restores how it looked.
- **Settings** holds the per-tab preferences: measurements per cycle, max bound states shown, histogram bins (display resolution), wavefunction time speed, random seed, language.
- **Show eigenstates** controls eigenstate ticks on the energy slider and energy histogram, plus the live Born-probability column in Tab 1's bound-state readout. **Show theory** overlays the analytic curves on the position and energy panels.
- **Overlay simulations** collapses the two side-by-side panels into one combined panel that superimposes both systems — both wells, both $|\psi|^2$, both measurement streams, and overlaid position/energy histograms — with a compact A/B comparison table. In Tab 1 it overlays the classical and quantum distributions; in Tabs 2–3 it compares System A vs B, with a *To scale / Normalize widths* control that switches between true relative well sizes (the quantum-dot-size comparison) and equal apparent widths (shape-only comparison).
- **Histogram bins** (Settings) re-bins the position and energy plots for display only — the simulation and every saved CSV/JSON always keep the full native resolution, so exported data can be re-binned freely afterwards.
- **Click any numeric value** to type a value directly; typed values clamp to each control's valid range.
- In **Tab 2**, the chain icon next to each parameter toggles whether that parameter is linked between System A and System B. The link defaults are all on (same well in both panels on first run); unlock individual parameters to compare them. Energy linking is smart: clicking the *n* = *k* tick on one side's slider while linked pairs both sides on their own *n* = *k* eigenstate (different absolute eV, same quantum number); dragging the slider pairs by eV.
- The **Notes** section under the simulation ("What you're looking at") and **Spectroscopy** section (Tab 2 only) are collapsible — click the chevron header to expand.

## How it's built

- **One React component** in [`src/ParticleQuoVadisRedux.js`](src/ParticleQuoVadisRedux.js). All physics, UI, and export logic live here.
- **No build step required.** The HTML loads React via UMD globals from a CDN, and Babel-standalone compiles the JSX in the browser at load time. Edit the JSX, refresh the page, see the result.
- **Dependencies** are React 18 and Babel-standalone, both loaded from CDNs (unpkg.com).

If you want to fork and modify:

1. Open [`src/ParticleQuoVadisRedux.js`](src/ParticleQuoVadisRedux.js) in your editor.
2. Make changes.
3. Open [`index.html`](index.html) in your browser to test.
4. No `npm install` needed.

## Hosting

The simplest deployment is GitHub Pages:

1. Fork or clone this repository.
2. Go to **Settings → Pages**.
3. Set **Source** to "Deploy from a branch" → `main` / `/ (root)`.
4. After a minute, your students can use the simulation at `https://<your-username>.github.io/<repo-name>/`.

Any other static host (Netlify, Vercel, Cloudflare Pages, your university's web space) works the same way. The simulation is a single HTML file plus its source — nothing dynamic, no backend.

For local use, students can download the repository as a zip, extract it, and open `index.html` directly in their browser.

## Pedagogical notes

The design choices behind this tool — the choice of ionisation as the central Tab 1 narrative, the "same prep, different system" framing for Tab 2, the units, why we keep two separate broadening parameters (Γ for state preparation, σ for instrument resolution), what is deliberately not modelled — are documented in [PEDAGOGY.md](PEDAGOGY.md). Worth reading if you plan to use this in a course or adapt it.

## Sibling project

The infinite-well version of this tool, [*Particle, Quo Vadis?*](https://github.com/pkennepohl/particle-quo-vadis), is the natural predecessor in a course. A reasonable teaching sequence: start there, establish quantisation and the Born rule with the infinite-wall idealisation, then bring in Redux for the finite-wall consequences (ionisation, bound-state count, orbital diffuseness) and the geometry / mass story (Tab 2).

## Example states

The [`examples/`](examples/) folder hosts saved simulation states demonstrating specific pedagogical points. Suggested seeds:

- *Polyene-length comparison* — Tab 2 with L_A = 1 nm, L_B = 2 nm, m\* and V₀ linked
- *Effective-mass contrast* — Tab 2 with m\*_A = 1, m\*_B = 0.1 (semiconductor effective electron), other knobs linked
- *Shallow vs deep well* — Tab 2 with V₀_A = 1.5 eV, V₀_B = 10 eV
- *Near-threshold leakage* — Tab 1 with the energy slider on the topmost bound state
- *Photoionisation* — Tab 1 with the energy slider just above V₀

You can capture your own with the **Save** button in either tab.

## Cite this

If you use this tool in teaching or research, please cite it. GitHub renders a citation button from the [`CITATION.cff`](CITATION.cff) file; click "Cite this repository" near the top of the project page.

## License

- **Code** (the JSX, HTML, and any JavaScript) is licensed under the [MIT License](LICENSE).
- **Documentation and pedagogical materials** (this README, PEDAGOGY.md, screenshots, example data files) are licensed under [CC-BY-SA 4.0](LICENSE-docs).

You are free to use, modify, and redistribute under those terms.

Third-party runtime dependencies (React, Babel, the fonts) keep their own licences; see [`CREDITS.md`](CREDITS.md) for the full notice.

## Contributions and feedback

Feedback from instructors and students is welcome. Open an issue if you find a bug, a pedagogical flaw, or have a suggestion. Pull requests welcome but please open an issue first to discuss.

This is a personal teaching project and not commercially supported. I will respond as time allows.

## Acknowledgements

Redux was developed iteratively in conversation with Claude (Anthropic). The physics, design choices, and pedagogical framing are mine; Claude implemented the code and helped reason through visualisation and UX decisions.
