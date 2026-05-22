# Changelog

All notable changes to *Particle, Quo Vadis. Redux* will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] – 2026-05-22

First public-ready release. Tabs 1 and 2 are complete and the app has been used end-to-end against the chemistry-undergraduate use case it was designed for.

### Added — Tab 1 (Depth)

- Numerical eigenvalue solver for the 1D finite square well: bisection on the matching-condition residuals (even and odd parity), brackets identified by a fine-grid sign-change scan, normalisation via analytic inside/outside integrals cross-checked by trapezoidal integration.
- Live classical / quantum simulation parallel to the first app, extended for finite walls. Below $V_0$ the classical particle bounces with the same wall and speed jitter as in *Particle, Quo Vadis?*. Above $V_0$ the classical particle escapes the well (one-way trip, dashed escape trail) and the quantum particle is reported as ionised.
- Wavefunction visualisation extending past the box walls with the classically forbidden region shown as a faded continuation; exponential decay length $1/\kappa$ is computed and shown per state.
- $V_0$ slider (settings-purple accent). The energy slider range, eigenstate ticks, and histogram axis all adapt as $V_0$ changes.
- Energy histogram shows bound states below $V_0$ and an "ionised" indicator above. Carries the dual-broadening ($\Gamma$ for state preparation, $\sigma$ for instrument resolution) machinery forward, restricted to the bound spectrum.
- "Quantum bound state manifold" readout in the parameter block: $n$, $E_n$, parity, $k$, decay length $1/\kappa$, and (gated on *Show eigenstates*) Born $|c_n|^2$ for the current preparation, displayed as a percentage with a bar.
- Adaptive Notes section ("What you're looking at") with chemistry framing — bound-state count, wavefunction leakage past the walls, photoelectron / quantum-dot connections, eigenstate vs superposition language.
- Data export (CSV + JSON) under schema `finite-well-particle-export/v1`. Filename prefix `fwell_single_…`.

### Added — Tab 2 (Width)

- Side-by-side comparison of two independently configured quantum wells (System A and System B) in real units: $L$ in nm, $m^*$ in $m_e$, $V_0$ in eV.
- Particle preset picker (clickable `m*/m_e` label): electron, light effective electron (0.067 $m_e$, GaAs-like), heavy effective electron (0.5 $m_e$), muon, proton, deuteron, alpha.
- Per-parameter link toggles between A and B for $L$, $m^*$, $V_0$, $\Gamma$, $\sigma$, and the energy slider. Default: all linked (same-vs-same baseline on first run).
- Smart energy linking — clicking an eigenstate tick on one side's energy slider while linked pairs both sides on their own $n = k$ eigenstate (different absolute eV, same quantum number); dragging the slider pairs by absolute eV.
- Real-units rendering inside the simulation panels: the box visibly scales with $L$, the position axis is in nm, energies are reported in eV.
- $\pm$ steppers and editable numeric values for all parameters (click any number to type; typed values clamp to the control's valid range).
- Per-side Spectroscopy panel (collapsible) reporting within-system transition energies (with photon wavelengths in nm) and the A→B same-$n$ photon energy for inter-well comparisons.
- Tab 2-specific Notes section ("What you're looking at") that describes the A↔B comparison the user has set up.
- Data export (CSV + JSON) under schema `finite-well-comparison-export/v1`. Filename prefix `fwell_pair_…`.

### Added — shared

- Unified Play / Pause toggle (single button) and Stop (resets histograms, keeps parameters).
- Save offers both CSV and JSON. Load auto-detects the schema and offers a cross-tab import flow when the file's tab doesn't match the active tab (pick which side / which destination).
- Settings modal (per-tab preferences): measurements per cycle, max bound states shown, wavefunction time speed, random seed, language scaffold.
- *Show theory* / *Show eigenstates* toggles. *Show eigenstates* drives the eigenstate tick marks on the energy slider, energy-histogram ticks, and the Born $|c_n|^2$ column in Tab 1's bound-state readout.
- Click any numeric value to type it directly, with auto-select-on-edit and range clamping.
- Defaults on first run: stopped, *Show eigenstates* off, *Show theory* off, all link toggles on, $|\psi|^2$ visualisation, Notes and Spectroscopy collapsed.

### Added — documentation

- `PEDAGOGY.md` covering the design rationale: ionisation as the central Tab 1 narrative, the "same prep, different physical system" framing for Tab 2, unit choices, why two broadening parameters, what is deliberately not modelled.
- `README.md` describing both tabs' chemistry narratives, the control vocabulary, example states, hosting instructions.
- `NOTES.md` capturing working development hand-off notes and open questions.

### Internal

- Per-system independent PRNGs (mulberry32) so System A and System B in Tab 2 do not share noise.
- `useSavedState` hook for localStorage persistence of UI preferences (per tab).
- Lorentzian state-preparation weights $|c_n|^2 \propto 1/((E_n - E_\text{set})^2 + (\Gamma/2)^2)$ normalised over the bound spectrum.

## [0.1.0-dev] – 2026-05-16

Internal development snapshot. Numerical solver shell with sanity-check display of the bound spectrum at hardcoded $V_0 = 200$. Not user-facing.
