# Examples

Curated experiments for each tab, with explicit parameter setups and what the student should look for. The examples are written for instructors to demonstrate a single chemistry idea per run — each one isolates one thing the simulation makes visible.

Each tab carries a different *kind* of comparison:

- **Tab 1 (Depth) — classical vs quantum particle in the same well.** Both panels run together. The point is what the two particles do *differently* under identical conditions.
- **Tab 2 (Width) — two quantum systems, A vs B, in real units.** Each side configures its own well; preparation is shared. The point is how the bound spectrum responds to changing geometry, mass, or depth.
- **Tab 3 (Shape) — two quantum systems with different confining-potential shapes.** Same width *L* and depth *V₀* in both, but the *geometry of confinement* differs. The point is that the shape of the potential sets the shape of the spectrum.

Parameter values are starting points; the experiments are robust to nearby choices. Show theory / Show eigenstates are noted per example when they sharpen the lesson.

---

## Tab 1 — Depth (classical vs quantum)

The Depth tab runs a classical and a quantum particle in the same finite well at the same preparation energy. Every example below is a place where the two diverge.

### 1.1 Position distribution: uniform vs structured

**Setup.** *V₀* = 200, Γ = 0, σ = 0. Show eigenstates ON. Click the *n* = 1 eigenstate tick on the energy slider.

**Observe.** The classical position histogram (P(x), bottom of left panel) is roughly flat — the particle is ergodic in its allowed region. The quantum position histogram is a single broad peak in the middle — the n = 1 wavefunction shape. Set the energy slider to *n* = 2: the classical histogram stays flat; the quantum histogram develops two peaks separated by a node.

**Chemistry.** A classical particle samples the inside of its container uniformly. A quantum particle has spatial structure dictated by its wavefunction. Same energy, dramatically different position distribution.

### 1.2 Correspondence principle

**Setup.** *V₀* = 400 (deep well, many bound states). Γ = 0, σ = 0. Show eigenstates ON. Run with the prep at *n* = 1, then drag the prep up the eigenstate ladder one tick at a time toward the highest bound state.

**Observe.** The classical histogram stays flat throughout. The quantum |ψ|² goes from a single peak (n = 1) through 2-, 3-, ... lobes; at the highest n, the wiggles smooth out (especially under instrument broadening) and the *averaged* quantum distribution becomes nearly flat — i.e. nearly classical.

**Chemistry.** The classical–quantum boundary is not sharp. High-quantum-number states look classical on average. Bohr's correspondence principle expressed in two panels.

### 1.3 Wavefunction leakage past the walls

**Setup.** *V₀* = 50 (shallow well, only a couple of bound states). Γ = 0, σ = 0. Show eigenstates ON. Prep at the topmost bound state.

**Observe.** Classical *P*<sub>out</sub> = 0 — the particle is confined, period. Quantum *P*<sub>out</sub> is visibly nonzero and *large* for the topmost state of this shallow well — measured **≈ 35–40 %** at 10 k measurements (the topmost eigenstate sits only ~3.5 below *V*₀, so its decay length is a sizeable fraction of *L* and the tails carry a lot of probability). The wavefunction extends well past the walls into the classically forbidden region. *P*<sub>ion</sub> stays **exactly 0** on both sides (with Γ = 0 the preparation is a pure eigenstate sitting below *V*₀; no continuum admixture). The contrast is purely about **position**: same prep, same energy, but the quantum particle has measurable probability of being found outside the box.

**Chemistry.** This is the *precondition for tunneling* — wavefunction amplitude in classically forbidden regions. It's also why molecular orbitals are spatially diffuse rather than sharply confined to bonds. Note: position-leakage (P_out) and ionisation (P_ion) are different events — leakage measures *where* a bound electron is found, not *whether* it's bound.

### 1.4 The ionisation onset is fuzzy, not sharp

**Setup.** *V₀* = 100. Γ = 20 (broadband prep), σ = 2. Prep at *E* = 80 (clearly below *V₀*).

**Observe.** Classical *P*<sub>ion</sub> = 0 — its energy is below *V₀*, so it cannot escape. Quantum *P*<sub>ion</sub> is nonzero because the Lorentzian preparation has a tail that crosses *V₀* — with this broad Γ = 20 prep it measures **≈ 15 %** at 10 k (a Lorentzian centred at *E* = 80 with FWHM 20 puts roughly that much weight past *V₀* = 100). For a smaller pre-threshold fraction, narrow Γ or drop the prep further below *V₀*. Show theory ON makes the band cross over the threshold visible.

**Chemistry.** Photoionisation cross-sections rise smoothly through the threshold, not as a step. The broadband nature of a real source is what makes pre-threshold ionisation observable.

### 1.5 Discrete vs continuous energies

**Setup.** *V₀* = 200, Γ = 0, σ = 1. Show eigenstates ON to read off where the eigenvalues are. Prep at an energy *between* two eigenstates (e.g. *E* = 50 when *E*<sub>2</sub> ≈ 30 and *E*<sub>3</sub> ≈ 67).

**Observe.** The classical energy histogram piles up around *E* = 50 (a Gaussian of width σ around the prep). The quantum histogram does *not* show a peak at 50 — it puts measurements onto the nearest eigenstate(s), so peaks appear at *E*<sub>2</sub> and/or *E*<sub>3</sub>.

**Chemistry.** Energy measurements collapse the wavefunction onto an eigenstate. The classical world lets you pick any energy you want; the quantum world has a discrete menu and your prep is just an instruction to sample from it.

### 1.6 σ vs Γ — the two broadenings, three regimes for P_ion

**Setup.** *V₀* = 100 (so the topmost bound state is fairly close to ionisation). Show eigenstates ON. Prep at the topmost bound state.

Run four times, changing only the broadening parameters:

1. Γ = 0, σ = 0 — pure eigenstate, no measurement noise. Both histograms show a sharp peak at *E*<sub>top</sub>. *P*<sub>ion</sub> is **exactly 0** on both sides — the prep is a single bound state, sampling never crosses *V*<sub>0</sub>.
2. Γ = 0, σ = 5 — pure eigenstate, blurred readout. Both histograms now show a Gaussian of width σ around *E*<sub>top</sub>. *P*<sub>ion</sub> is still **0** — σ broadens *measurements* but doesn't move the prep into the continuum. Some readings happen to fall above *V*<sub>0</sub> due to noise, but those are still bound events, just with noisy energy values.
3. σ = 0, Γ = 5 — broad prep, sharp readout. Classical stays sharp at *E*<sub>top</sub>. Quantum now spreads into peaks at neighbouring eigenstates (*E*<sub>top−1</sub>, *E*<sub>top−2</sub>) — the Lorentzian preparation has admixed those nearby states. *P*<sub>ion</sub> now picks up a genuine contribution from the Lorentzian's tail crossing *V*<sub>0</sub> — measured **≈ 20 %** at 10 k. (It's not a tiny number here precisely because the prep sits at the topmost state, only ~4 below *V*₀ = 100; the point is that it is the prep, not the readout, that creates it.)
4. σ = 5, Γ = 10 — both. Quantum histogram shows broadened peaks at several eigenstates; *P*<sub>ion</sub> is the largest of the four runs (**≈ 30 %** at 10 k) because the prep tail extends well past *V*<sub>0</sub> *and* the readout is noisy.

*Measured P*<sub>ion</sub> *ordering across the four runs (10 k each): 0, 0, ≈ 0.20, ≈ 0.30 — the equality of the first two (σ alone never ionises) and the strict increase across the last two are the lesson, not the absolute magnitudes.*

**Chemistry.** σ models *instrument resolution* — it blurs measurements on both sides equally; it does NOT change the prepared state or the bound/continuum split. Γ models *preparation width* — it widens the prepared state into a Lorentzian-weighted superposition of nearby eigenstates and routes some probability into the continuum. Only Γ can cause an "I prepared below V₀ but got ionised events" outcome. The two are independent and act at different stages of the experiment: prep → measurement.

---

## Tab 2 — Width (two quantum systems, A vs B)

The Width tab compares two independently configured quantum wells in real units (nm, eV, m<sub>e</sub>). All examples below set A and B differently in exactly one (or two) parameters and run the same preparation on both.

### 2.1 Quantum dot size effect

**Setup.** Unlink *L*. System A: *L* = 0.5 nm. System B: *L* = 2.0 nm. Everything else linked: *m*\* = 1.0 m<sub>e</sub>, *V*<sub>0</sub> = 8 eV, Γ = 0, σ = 0.1, prep at *E* = 1 eV. Show eigenstates ON.

**Observe.** A barely supports a ground state and the wavefunction has visible tails past the walls; B has many bound states tightly packed. The bound-state ladders in the two parameter panels read very differently: A's spacings are large, B's are small.

**Chemistry.** This is the size-tuning principle behind CdSe and similar colloidal quantum dots: shrink the dot, the bandgap (≈ *E*<sub>2</sub> – *E*<sub>1</sub>) blue-shifts. Same material, same potential depth — only the size changes.

### 2.2 Effective mass

**Setup.** Unlink *m*\*. A: *m*\* = 1.0 m<sub>e</sub> (free electron). B: *m*\* = 0.067 m<sub>e</sub> (GaAs-like effective mass). Linked: *L* = 1.0 nm, *V*<sub>0</sub> = 8 eV. *Note:* the particle menu's lightest preset is "Light effective electron (semiconductor)" at 0.1 m<sub>e</sub> — there is no 0.067/GaAs preset, so type 0.067 into B's *m*\* field directly (or use the 0.1 preset for a slightly weaker effect).

**Observe.** B's spectrum is much sparser and shifted up — only ~2 bound states vs A's ~5. The underlying confinement scale *E*\* scales as 1/*m*\*, so it is ~15× larger for B; the measured *ground-state* ratio is smaller (**≈ 8×** here) because the lighter particle leaks more, pulling its finite-well *E*<sub>1</sub> further below the infinite-well value. The wavefunctions look similar in shape but the energy ladder is dramatically different.

**Chemistry.** In a semiconductor, the conduction-band electron has an effective mass that can be much smaller than m<sub>e</sub>. The confinement physics is identical; only the inertia changes. This is why quantum-dot energies depend strongly on the host material.

### 2.3 Heavy particle in the same well

**Setup.** Unlink *m*\*. A: electron preset. B: proton preset (*m* ≈ 1836 m<sub>e</sub>). Everything else linked.

**Observe.** B's spectrum is so dense the bound states blur together; B has essentially zero leakage past the walls. The classical-quantum distinction starts to vanish — the proton in this well behaves nearly classically.

**Chemistry.** Protons in molecular wells (e.g. the proton in an O–H bond) are nearly classical at room temperature — they don't show the quantum effects an electron in the same well would. This is why we usually treat nuclear motion classically and electronic motion quantum-mechanically.

### 2.4 Photon transitions across two wells

**Setup.** Unlink *L*. A: *L* = 1.0 nm. B: *L* = 1.5 nm. Linked: *V*<sub>0</sub> = 8 eV, *m*\* = 1.0 m<sub>e</sub>. Show eigenstates ON. With energy linked, click the *n* = 2 eigenstate tick on either side — both A and B snap to their own *n* = 2 eigenstate (linked-by-quantum-number, not by absolute energy).

**Observe.** Open the Spectroscopy panel at the bottom. The within-system Δ*n* = 1 transition energies are listed for each side; the *n*<sub>A</sub> = 2 → *n*<sub>B</sub> = 2 photon-energy difference is reported. A's transitions are blue-shifted relative to B's.

**Chemistry.** Absorption peak positions scale ~ 1/*L*² in the deep-well limit. This is the quantitative version of the size effect — students can read off the photon energies that A and B would absorb.

### 2.5 Quantum confinement scaling

**Setup.** Unlink *L*. A: *L* = 1 nm. B: *L* = 2 nm. Linked: *m*\* = 1, *V*<sub>0</sub> = 10 eV. Show eigenstates ON, prep at *n* = 1 on each (eigenstate-linked).

**Observe.** A's *E*<sub>1</sub> is roughly 4× B's *E*<sub>1</sub>. Doubling the box quarters the ground-state binding energy.

**Chemistry.** The quantitative 1/*L*² scaling of ground-state confinement energy. The "tighter box → higher energy" intuition, made explicit.

### 2.6 Muon vs electron

**Setup.** Unlink *m*\*. A: electron. B: muon preset (*m* ≈ 207 m<sub>e</sub>). Linked: *L*, *V*<sub>0</sub>.

**Observe.** B's spectrum is compressed and shifted far down: many more bound states fit (≈ 8 vs A's ≈ 5) and leakage drops. The confinement scale *E*\* compresses by the full mass ratio (~207×); the measured *ground-state* energy ratio is somewhat less (**≈ 160×** here) for the same finite-well-leakage reason as in 2.2.

**Chemistry.** Muonic atoms have orbitals ~ 200× smaller than electronic atoms — same Coulomb potential, vastly different particle.

---

## Tab 3 — Shape (two quantum systems, different geometries)

The Shape tab compares confining potential geometries. The shape picker offers three: finite-square (a rigid box with leaky walls), truncated parabolic (harmonic oscillator capped at *V*<sub>0</sub>), and softened Coulomb (atomic-like). The same *L* (defined as FWHM at *V*<sub>0</sub>/2 on every shape) and *V*<sub>0</sub> give very different spectra.

### 3.1 Harmonic vs Coulomb spectral ladders

**Setup.** Unlink shape. A: Truncated parabolic. B: Softened Coulomb. Linked: *L* = 1 nm, *V*<sub>0</sub> = 10 eV, *m*\* = 1, Γ = 0, σ = 0.1. Show eigenstates ON.

**Observe.** A's eigenvalue ladder is evenly spaced (ℏω(*n* + ½)) — the harmonic oscillator signature. B's ladder converges as 1/*n*² (a Rydberg-like series) and crowds toward *V*<sub>0</sub>. The shape of the spectrum mirrors the shape of the well.

**Chemistry.** Molecular vibrations are harmonic at low quantum number (the evenly-spaced ladder); atomic Rydberg states converge toward the ionisation limit (the 1/*n*² series). Same particle, same *L*, completely different spectroscopy because the geometry differs.

### 3.2 Square vs Coulomb

**Setup.** Unlink shape. A: Finite-square. B: Softened Coulomb. Linked: *L*, *V*<sub>0</sub>, *m*\*. Show eigenstates ON.

**Observe.** A has a roughly *n*²-spacing ladder (the deep-well limit of the particle-in-a-box result); B has the converging 1/*n*² ladder. The wavefunction shapes differ: A's are sinusoids on the inside of the box; B's are sharply peaked at *x* = 0.

**Chemistry.** A quantum dot (box-like) vs an atom-like orbital (Coulomb-like). Same width, dramatically different physics.

### 3.3 Square vs Parabolic — bond dissociation

**Setup.** Unlink shape. A: Finite-square. B: Truncated parabolic. Linked: *L*, *V*<sub>0</sub>, *m*\*. Show eigenstates ON. Prep at the topmost bound state on each side.

**Observe.** A's high state still has sinusoidal character inside the box. B's high state is near the truncation ceiling and shows anharmonic spacing — the eigenvalues crowd together as they approach *V*<sub>0</sub>.

**Chemistry.** Real molecular vibrations are harmonic only at low *v*; near the dissociation limit they are strongly anharmonic and the bond breaks. The truncated parabola is the simplest model of bond dissociation — the harmonic spacing for low *v* is the textbook result; the crowding near *V*<sub>0</sub> is the experimentally observed anharmonicity.

### 3.4 Rydberg series — same shape, different size

**Setup.** Both Coulomb. Unlink *L*. A: *L* = 0.2 nm (atomic-scale). B: *L* = 2 nm (mesoscopic). Linked: *V*<sub>0</sub> = 10 eV, *m*\* = 1. Show eigenstates ON.

**Observe.** A's spectrum has a deeply bound ground state and a few sparse higher states. B has a dense Rydberg-like series approaching the ionisation limit.

**Chemistry.** The 1s orbital of a real atom is a deeply bound, sparse-spectrum state (A-like). High-*n* Rydberg states are diffuse with a dense ladder converging to ionisation (B-like). Both come from the same Coulomb shape — only the size changes the regime.

### 3.5 Coulomb shape, different particle mass

**Setup.** Both Coulomb. Unlink *m*\*. A: *m*\* = 1.0 m<sub>e</sub> (electron). B: *m*\* = 207 m<sub>e</sub> (muon). Linked: *L*, *V*<sub>0</sub>.

**Observe.** B's spectrum is compressed by ~ m<sub>μ</sub>/m<sub>e</sub>; the ladder has the same Coulomb shape, just rescaled.

**Chemistry.** Muonic atom physics — same Coulomb potential, different particle, dramatically smaller orbital radii. The bound-state structure of the muonic atom is what you get by replacing the electron with a heavier point particle in the same potential.

---

## Notes for instructors

- All three tabs use the same preparation language: Γ (preparation width, a Lorentzian FWHM weighting eigenstates around the slider energy) and σ (instrument resolution, a Gaussian noise added to each measurement). Γ = 0 picks a pure eigenstate; σ > 0 always broadens the readout.
- The Save button exports the current configuration plus the accumulated histograms as a JSON or CSV file. To distribute a worked example as a click-and-load preset, run the example once, click Save, and bundle the JSON file with the lab handout.
- Tab 1's classical/quantum panels share preparation; you cannot configure them independently — that's the point. To compare two quantum wells, switch to Tab 2.
- Tab 2's six per-parameter link toggles are the comparison structure: lock the parameters you want to hold constant, vary the one you want to compare. Defaults link everything so the student starts from a same-vs-same baseline.
- Tab 3 adds a seventh link toggle (shape itself), so even the well shape can be locked across A and B.
- Show theory overlays the predicted distributions on every histogram; Show eigenstates marks each bound state on the energy axis and adds the |c<sub>n</sub>|² column to the bound-state table. Both are off by default so the student first sees raw simulation behaviour, then turns on theory to compare.

### Preset library (`examples/`)

- Every example above is saved as a ready-to-load JSON preset under `examples/`, named `<tab>_<n>_<slug>.json` (e.g. `depth_1.1_position_distribution.json`, `width_2.1_quantum_dot_size.json`, `shape_3.2_square_vs_coulomb.json`). Each was run to ~10 k measurements. The four examples best suited to offline analysis (1.4, 1.6, 2.4, 3.1) also ship a matching `.csv`.
- `examples/convergence/` holds a **Monte-Carlo convergence exercise**: the 1.6-case-3 configuration (*V₀* = 100, Γ = 5, σ = 0, prep at the topmost bound state) exported at *N* = 1 k, 2 k, 5 k, 10 k, 20 k (`depth_conv_N01k.json` … `N20k.json`). Load them in turn and watch the *P*<sub>ion</sub> estimate settle (≈ 0.19 → 0.20) and the energy-histogram noise floor drop as *N* grows — a hands-on illustration of why these histograms need several thousand measurements before they're trustworthy.

### Walkthrough gotchas (worth knowing when building presets)

- **Snap-to-eigenstate** with Show eigenstates ON is the reliable way to "prep at *E*<sub>n</sub>": click the tick on the energy slider rather than typing a number. With Γ = 0 the prep collapses to the nearest eigenstate anyway, so prepping "at the topmost bound state" just means setting *E* a hair below *V*₀.
- On Tabs 2/3, set a parameter's **link toggle first, then its A/B values** — toggling the link and changing the value in the same motion can briefly use the old link state and sync both sides unintentionally.
- Several examples prep at the **topmost, barely-bound state** (1.3, 1.6, 3.3). That is deliberately the most leakage- and ionisation-prone case, so the measured *P*<sub>out</sub>/*P*<sub>ion</sub> magnitudes are larger than a naïve "small tail" estimate — see the per-example numbers above.
