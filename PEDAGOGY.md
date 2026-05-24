# Pedagogical Notes

This document captures the design decisions behind *Particle, Quo Vadis. Redux* – the *why* behind the *what*. It is written for instructors who plan to use this tool in a course, and for anyone forking it to adapt.

Redux is the finite-square-well sibling of the original *Particle, Quo Vadis?*. Many of the choices that worked in that tool – units, Lorentzian state preparation, parallel measurement protocols, two separate broadening parameters – carry forward unchanged and are documented here so this repository stands on its own without depending on the first one. Choices specific to the finite well, or revised from the first tool, are flagged as such.

## Audience and framing

Redux is for chemistry undergraduates, not physics students. That single commitment shapes everything below. The "particle in a box" stands in for an electron in a molecule, a $\pi$-system, or a quantum dot – never an abstract physics problem. Vocabulary defaults to chemistry framing where applicable; where a physics term is needed, it is briefly tied back to a chemistry analog.

## What this model is and isn't

This is a 1D model of a bound electron in a finite well. **The bound states of this model are not atomic orbitals, molecular orbitals, or any other specific real electronic state.** They are eigenstates of a deliberately simplified mathematical structure that captures qualitative features common to many real bound-electron systems: a discrete and finite set of allowed energies, wavefunctions with amplitude past the classical boundary, an ionisation threshold above which the electron is unbound.

The vocabulary in the app and these notes is tiered to respect that distinction:

- **Neutral physics terms** – *bound state, eigenstate, energy level, wavefunction, |ψ|², eigenvalue, ionisation, continuum* – are used when describing what the model is doing. These describe the simulation accurately at any level of chemistry coursework.
- **Chemistry vocabulary** that names real systems and techniques – *photoelectron spectroscopy, ionisation potential, conjugated π-system, quantum dot, electron transfer, scanning tunneling microscopy* – is used when explicitly connecting the model to real chemistry, and is framed as application or analogy rather than identity. The model *plays the role of* a bound electron in those settings; it is not literally one.
- **"Orbital" language** (atomic or molecular) is used only in connection-making contexts, plural and generic, never as a synonym for an individual bound state of this model. A student who hasn't met orbital theory yet can ignore these mentions without missing the simulation's actual content. A student who has met it can see how this model maps onto orbital pictures.

This tiering is load-bearing: the model is a stepping stone to orbital theory, not orbital theory itself, and the language should make that clear.

## The chemistry narrative – ionisation, not tunneling

The single chemistry story Redux tells is **ionisation**. Set the system energy below $V_0$ and you have a bound electron in a molecular orbital. Set it above $V_0$ and the electron has been ejected – this is the photoelectron spectroscopy / work function / ionisation potential regime. The threshold itself is the lesson. $V_0$ is the ionisation potential.

Tunneling was considered as the central narrative and rejected. Tunneling in the chemistry sense students will eventually meet (Marcus theory, scanning tunneling microscopy, hydrogen migration in enzymes) is *barrier penetration* – wavefunction amplitude traverses a classically forbidden region from one allowed region to another. A 1D finite square well has no barrier; it has only wavefunction leakage into the asymptotic forbidden region outside the walls. That leakage is the *precondition* for tunneling, not tunneling itself. Selling it as "tunneling" would be dishonest. The honest framing – "this is why tunneling is possible" – is true but lacks the rhetorical punch of a single-lecture punchline. Ionisation wins on three grounds: it has a visible threshold event, it maps directly onto named chemistry techniques (UPS / XPS, work functions, quantum dot bandgaps), and the finite bound-state count comes along for free as a chemistry intuition ("deeper well, more bound orbitals").

Tunneling intuition and orbital diffuseness (why molecular orbitals are not sharply confined) are real benefits the geometry delivers and are flagged in the adaptive notes – but as supporting observations, not headlines.

## Tab structure

Redux is a tabbed app. Two tabs are shipped, each telling one coherent chemistry story; a third is reserved for future work.

**Tab 1 – Depth. Classical vs quantum, state preparation, fixed $L$ and $m$.** This is the direct sibling of the first app. The user prepares a state at a chosen energy and watches classical and quantum particles confined to the same finite well. The classical / quantum head-to-head comparison is the spine of the app series and is preserved here. New relative to the first app: the well is finite (eigenvalues are numerical solutions of transcendental equations rather than $n^2 \pi^2$), there is a finite number of bound states, wavefunctions visibly extend past the walls, and a $V_0$ slider controls the well depth. Above $V_0$ the classical particle escapes the well (one-way trip) and the quantum particle is treated as ionised.

**Tab 2 – Width. Two quantum systems, side by side.** This tab drops the classical comparison and shows two independently configured finite wells (System A and System B) running in parallel. The user can vary $L$, $m^*$, and $V_0$ on each side, choose a particle preset ($m^*$ for electron, light/heavy effective electron, muon, proton, deuteron, alpha), and toggle per-parameter linking between the two systems. The chemistry stories are geometry and inertia driving the energy ladder: shrink the well or increase the effective mass, the gaps widen and the bound-state count changes. This is the textbook explanation for conjugated $\pi$-system absorption colours, cyanine dye chain-length shifts, and quantum-dot fluorescence tuning. Side-by-side comparison is the framing because the chemistry argument is always comparative ("the longer polyene absorbs at a longer wavelength than the shorter one") and a single tunable system requires the student to hold the previous configuration in memory; A↔B makes the contrast visible at a glance. Defaults to all-parameters-linked so the student starts from a same-vs-same baseline and unlocks the one or two parameters they want to compare. Classical mechanics has little to say about this geometry story – classical frequencies scale continuously with $L$ without showing discrete spacing – so the classical side is honestly dropped, not just omitted for room.

**Tab 3 – Shape.** Two quantum systems side by side, each with a shape picker (finite-square, truncated-parabolic, softened-Coulomb). The electron is "the particle" across all three shapes. The chemistry story is *shape of the confining potential determines the bound spectrum*, with all three shapes parametrised by the same FWHM $L$ and depth $V_0$ so the comparison is genuinely controlled. Designed; not yet implemented. See *Tab 3 – shape over vibration* below for the full rationale.

This split lets each tab carry one coherent narrative. Tab 1 is the classical-vs-quantum comparison extended to finite walls; Tab 2 is the comparative geometry-and-mass story.

## Tab 2 – why A↔B comparison, why link toggles

Tab 2's structure is **two systems, side by side, with per-parameter linking between them**. Three alternatives were considered and rejected.

- **Single quantum system with a "compare to previous configuration" memory.** The student would tune one well, snapshot it, then tune again and visually overlay. Rejected because it puts the cognitive load on the student to maintain the previous configuration; the comparison gets weaker the further the student wanders from the snapshot.
- **Single quantum system, no comparison.** Just $L$, $m^*$, $V_0$ on one well. Rejected because chemistry arguments about size and mass dependence are *always* comparative ("the longer polyene absorbs at longer wavelength than the shorter one"). A single well makes the student do the comparative work in their head.
- **Two systems, fully independent (no linking).** Rejected because, on first run, the student would face an overwhelming twelve knobs (six per side) with no obvious anchoring. The all-linked default means six knobs that move both sides together, with one click per parameter to break the symmetry.

The shipped design is: **two systems, all parameters linked by default, every parameter has a chain-icon toggle next to it.** Same prep, same physical system on first run. To compare $L$, unlock the $L$ chain and crank one side's $L$ – everything else stays locked, so the *only* visible difference between the two histograms is the geometry. This is the same as a controlled experiment in lab.

Energy linking is "smart" because the chemistry of comparison can be one of two things: *same quantum number, different absolute energy* (the natural way to compare the $n = 2 \to n = 1$ transition in two different boxes) or *same absolute energy, different state of each system* (the natural way to ask "what does an electron at 3 eV look like in each well"). Clicking an eigenstate tick on one slider while linked snaps both sides to their own $n = k$ eigenstate (different eV, same $n$); dragging the slider continuously moves both sides to the same eV.

## Tab 3 – shape over vibration, why FWHM unifies the controls

Tab 3's chemistry story is **the shape of the confining potential determines the structure of the bound spectrum**. Three shapes ship: finite-square (Tab 1's case as a baseline), truncated-parabolic, and softened-Coulomb. The electron remains "the particle" on every shape, matching Tabs 1 and 2.

Vibrational quanta in a diatomic – the obvious chemistry candidate, with harmonic-vs-Morse as the contrast – was considered and rejected. In a vibrational problem "the particle" is the reduced-mass coordinate $\mu = m_A m_B / (m_A + m_B)$ moving along a bond-length displacement, not an object in space; the box, the wavefunction, and the bound-state ladder all silently change meaning. For a chemistry junior who has just built up the "particle in a box ≈ electron in a molecule" intuition across Tabs 1–2, a silent gear-shift on what the simulation actually represents costs more than the harmonic-vs-Morse punchline buys. Vibrations enter Tab 3 as an *applied connection* in the adaptive Notes ("the same math describes a diatomic vibrating, with a reduced-mass particle instead of an electron"), parallel to how Tab 1 frames UPS / XPS as applied connections to the ionisation story rather than as the model's literal subject.

Structure mirrors Tab 2: two quantum systems side by side, each with a **shape picker** at the top, per-parameter link toggles between A and B, the classical comparison dropped. The chemistry argument is comparative ("the converging Coulomb-like ladder is denser near the threshold than the evenly-spaced parabolic ladder"); a single tunable shape would put the cognitive load on the student to remember the previous configuration, exactly the failure mode Tab 2 was built to avoid. Defaults follow Tab 2: both sides finite-square on first run, all parameters linked, identical histograms accumulating – the first thing the student discovers by clicking is what the other shapes look like.

The cross-shape comparison only works because the three shapes share a **unified parametrisation**: $L$, $V_0$, and $m^*$ mean the same physical thing on every shape, so the link toggles port over from Tab 2 without semantic drift. The choice that makes this work is to define $L$ as the *width at half the well depth* (FWHM) on every shape:

- **Finite square.** Walls are vertical, so width at $V_0/2$ is exactly $L$. No change from Tabs 1–2.
- **Truncated parabolic.** $V(x) = \min(\tfrac{1}{2} m^* \omega^2 x^2, V_0)$: parabolic flanks meeting a flat ceiling at depth $V_0$. FWHM gives $L = 2 \sqrt{V_0 / (m^* \omega^2)}$, so the curvature $\omega$ is determined by $L$ and $V_0$.
- **Softened Coulomb.** $V(x) = -A / \sqrt{x^2 + a^2}$, shifted in convention to read floor at $0$ and asymptote at $V_0 = A$. FWHM gives $L = 2 a \sqrt{3}$, so the softening parameter $a = L / (2 \sqrt{3})$ is determined by $L$.

Two consequences flow from this choice. First, **Tab 1's ionisation / threshold framing extends to every Tab 3 shape**: every well has a $V_0$ above which the electron is ionised. Tab 1's story stops being a Tab-1 thing and becomes an app-wide thing. Second, **the softened-Coulomb's softening length, which would otherwise be a non-physical "regularisation" knob the student has no chemistry intuition for, falls out of the FWHM convention by construction** rather than needing to be surfaced and hand-waved.

The trade-off worth flagging is the parabolic case. A pure harmonic oscillator ($V \to \infty$) has no width at half-height and so cannot live in this convention. The truncated parabolic is, however, physically real: semiconductor quantum dots have approximately parabolic confinement that saturates at the band offset – exactly this shape. And the textbook result – evenly-spaced ladder $\hbar \omega (n + \tfrac{1}{2})$ – survives as a deep-well asymptote: in the $V_0 \gg \hbar \omega$ limit the lower states recover it, and at finite $V_0$ the student visibly sees anharmonic deviations near the top of the well as a teaching point in its own right. Trading the pure-textbook starting point for the unified threshold story is, on balance, more chemistry per click.

Sign convention: floor at $0$, asymptote at $V_0$ on every shape. The softened Coulomb's natural atomic-physics convention (floor at $-A$, asymptote at $0$) is shifted to match. This keeps the energy slider doing the same thing on every shape and the threshold meaning constant; the adaptive Notes flag the convention for students who have already met the atomic-physics one.

The Spectroscopy panel from Tab 2 ports unchanged. The chemistry payoff is sharper than in Tab 2 because the spacings *qualitatively* differ across shapes: an $n=1 \to n=2$ transition in a parabolic well costs $\hbar \omega$; the same transition in a Coulomb-like well costs much more because the lower spacings are far wider. Confinement-shape-determines-absorption-spectrum, made quantitative.

## What the simulation actually represents (tab 1)

The system in tab 1 is a single particle in a 1D finite square well of length $L$ and depth $V_0$. Two simulations run in parallel:

- **Classical side**: a single particle is integrated forward in time inside the well. Its position is binned into the position histogram every step. At each step, a separate "energy measurement" is reported (the slider energy plus Gaussian instrument noise) and binned into the energy histogram. If the user sets the energy above $V_0$, the classical particle escapes the well and the panel switches to an "ionised" indicator.
- **Quantum side**: the prepared state is a Lorentzian-weighted superposition of bound-state energies, centered on the slider energy and truncated to the bound spectrum. Position measurements sample $|\psi(x,t)|^2$ at the current time, over the full real line (inside *and* outside the box). Energy measurements sample the Born-rule distribution then add Gaussian instrument noise. If the slider energy is set above $V_0$, the quantum particle is reported as ionised and the panel shows an indicator rather than a continuum wavefunction (see "Continuum states above $V_0$" below).

The two sides use parallel measurement protocols, exactly as in the first app, so the histograms remain directly comparable.

## Tab 1 implementation – state-preparation reading

The energy slider in tab 1 reads as "the system energy" (mean energy of the prepared state), exactly as in the first app. An alternative framing was considered – slider as "photon energy delivered to a ground-state system" – and is mathematically equivalent because the same Lorentzian state preparation can be relabeled as either. We chose the state-preparation reading for continuity with the first app. The added-energy framing remains available as a sentence in the adaptive notes ("you can also read this slider as the photon energy delivered to an electron in the ground state; below $V_0$ this is a bound–bound transition, above $V_0$ it is photoionisation") so the spectroscopy story is told without splitting the simulation into two modes.

## Visualising the classical particle: aperiodic bouncing as a kinetic-energy cue

The classical panel draws the particle inside a side-view of the well: solid walls at $x = 0$ and $x = L$, a floor at $V = 0$, and a dashed line across the top of the box marking $V_0$. The particle bounces in parabolic arcs whose *phase advances in sim time, independent of x*; each bounce has its own random duration (0.04 – 0.10 sim time) and random peak fraction (50 – 100 % of the energy-scaled envelope). The bounce envelope's maximum height scales linearly with $E / V_0$, so at $E = V_0$ the tallest bounces just brush the rim; above $V_0$ the particle is drawn outside the box with a dashed escape trail going up over the rim and an upward arrow.

This is a deliberate visual choice, not a literal model of the dynamics. The actual simulation is one-dimensional along $x$ – the particle has no $y$-momentum and no real "bounce" – but a flat slider with a sideways-skating dot does not communicate kinetic energy at all. The bouncing borrows the everyday "ball bouncing in a well" intuition: more energy, higher bounce; crank up to $V_0$ and the bounce brushes the rim; crank higher and the ball flies out.

The bounces are *decoupled from x* on purpose. A single parabolic arc parameterised by $x$, peaking at $x = L/2$ and zero at the walls, is geometrically identical to the ground-state quantum wavefunction $\psi_1$. Using that shape for the classical visualisation would conflate the classical and quantum pictures – the exact comparison this app is built to make. Randomising each bounce's duration and peak fraction and advancing the phase in sim time produces an irregular, aperiodic trajectory that the eye cannot mistake for any quantum eigenstate.

The Notes section under the simulation states this disclaimer plainly so a careful student is not led to misread the picture. The trade-off was considered explicitly: a literal flat-line visualisation is more honest about the physics but visually inert; an aperiodic bouncing visualisation is engaging and pedagogically loaded, with the misconception risk (vertical motion as a degree of freedom) neutralised by the disclaimer and the quantum-eigenstate-confusion risk neutralised by the aperiodicity.

## Continuum states above $V_0$

When the user sets the energy above $V_0$, the quantum particle is treated as ionised and removed from the visualisation. A label appears in its place. The classical particle similarly escapes. This is the honest answer for early undergraduates: continuum states are not normalisable, require wave-packet language to draw faithfully, and a fake oscillatory $\psi$ above $V_0$ would mislead more than it teaches. The parallel "escape" of both particles preserves the classical-vs-quantum spine of tab 1 while staying truthful about the physics.

## Bound-state count cap

The number of bound states grows with $V_0$. The display caps at 8 eigenstates regardless. Deeper wells than that produce a cluttered energy histogram and offer no additional pedagogical content – the existence of "many more bound states than I can see" is itself the lesson there. The cap is a UI choice, not a physical one; the simulation accurately reports that the well contains more states than are drawn.

## Units

Energies are dimensionless multiples of $\hbar^2 / (2mL^2)$. In these units the *infinite-well* eigenvalues would be $E_n^{\infty} = n^2 \pi^2$, so $E_1^{\infty} \approx 9.87$, $E_2^{\infty} \approx 39.48$, and so on. The first app uses this same convention; carrying it over keeps the units page-compatible between the two tools.

Inside the finite well the eigenvalues are *numerical* roots of the transcendental matching conditions. With $k = \sqrt{E}$ and $\kappa = \sqrt{V_0 - E}$ in these units:

$$k \tan(kL/2) = \kappa \quad \text{(even-parity bound states)}$$
$$-k \cot(kL/2) = \kappa \quad \text{(odd-parity bound states)}$$

For numerical robustness Redux finds zeros of the equivalent residual forms $\kappa \cos(kL/2) - k \sin(kL/2)$ (even) and $\kappa \sin(kL/2) + k \cos(kL/2)$ (odd), which avoid the singularities of tan and cot.

$V_0$ in Tab 1 is set in the same units, so a student can directly compare it to the infinite-well eigenvalues they know from the first app.

Tab 2 uses **real units** ($L$ in nm, $m^*$ in $m_e$, $V_0$ in eV) because the chemistry stories Tab 2 tells – polyene chain-length shifts, quantum-dot bandgaps, effective-mass differences in semiconductors – live in those units in real chemistry coursework. The internal energy scale is $E^* = \hbar^2 / (2 m^* L^2)$, with $E^*_\text{ref} = 0.0381$ eV taken at $L = 1$ nm, $m = m_e$. The solver remains in dimensionless units internally; UI display and export use the real-units conversion. The particle-preset menu attached to the $m^*$ label exposes electron, two effective electrons (0.067 $m_e$ for GaAs-like, 0.5 $m_e$ for a heavier semiconductor), muon, proton, deuteron, alpha – enough to make "what if the particle were heavier" a one-click experiment.

An alternative would be to use units of $E_1^{\infty}$ so the infinite-well eigenvalues become $1, 4, 9, 16, \ldots$ exactly. The current choice keeps $\pi^2$ visible, matching the textbook derivation.

## Why we use a Lorentzian for state preparation

The state-preparation parameter $\Gamma$ controls how broadly the prepared state spreads across bound states. The weights are

$$|c_n|^2 \propto \frac{1}{(E_n - E_\text{set})^2 + (\Gamma/2)^2}$$

normalised to sum to 1 over the bound spectrum. This is a Lorentzian profile, physically motivated by:

- The time–energy uncertainty relation: a state of finite lifetime $\tau$ has natural linewidth $\Gamma \sim \hbar/\tau$.
- It matches natural lineshapes seen in real spectroscopy.
- The heavy tails (compared to Gaussian) give a meaningful contribution from distant eigenstates, which is pedagogically useful when $E_\text{set}$ is far from any eigenvalue.

A Gaussian was considered but rejected – the heavy Lorentzian tails make the "non-eigenstate" case more visibly different from the "eigenstate" case.

The internal floor for $\Gamma$ is 1 (in the same energy units) to avoid numerical singularity. The displayed value is offset by $-1$ so users see "$\Gamma = 0$" at the minimum, which corresponds intuitively to "perfect spectral resolution."

## Why we have two separate broadening parameters ($\Gamma$ and $\sigma$)

Real spectroscopy involves at least two sources of line width:

- **Intrinsic linewidth** ($\Gamma$ here) – a property of the system being measured. Set by lifetime, dephasing, or in our case by how the state was prepared.
- **Instrument resolution** ($\sigma$ here) – a property of the measurement apparatus. Gaussian noise added to each reported value.

Keeping these separate lets students see how each affects the histogram independently. Lorentzian $\Gamma$ broadens by spreading the *underlying* probability across more eigenstates. Gaussian $\sigma$ broadens each reported peak by adding measurement noise.

At $\sigma = 0$ the underlying eigenstate structure is visible as sharp lines. As $\sigma$ grows, peaks merge and quantisation becomes invisible – the same way it does in low-resolution spectrometers. This is the pedagogical point.

The default $\sigma = 0$ preserves the quantisation story by default. The default $\Gamma = 0$ (internal value 1) preserves the eigenstate-as-pure-state story by default.

## Why the classical particle has wall jitter and speed jitter

A purely deterministic ballistic particle bouncing in a 1D box has a *periodic orbit*. Such an orbit fills only a measure-zero subset of $[0, L]$. The position histogram never converges to the uniform distribution – instead it accumulates only in the bins the orbit visits.

This is correct classical mechanics. Real ballistic particles ergodicize because of microscopic imperfections in the walls, thermal fluctuations, and numerical noise in the integrator. Redux includes these as:

- $\pm 20\%$ multiplicative speed jitter on each step (breaks the periodic orbit).
- A small ($\sim 1$ bin width) random offset on each wall bounce (ensures the bins next to the wall sample at the same rate as interior bins).

Without these, the classical histogram shows a visible periodic-orbit pattern and the bins next to the walls are systematically under-sampled. The first app verified this convergence behaviour empirically and Redux inherits the same parameters.

The energy is recorded as the *slider value*, not the per-step instantaneous kinetic energy. This is defensible: in real spectroscopy, the spectrometer reports the system's energy from a single coherent measurement, not the integrand of a microscopic trajectory. Conceptually, the slider sets the system energy and the spectrometer reads it with finite resolution $\sigma$.

## Why Brownian classical motion is not included

The first app offers a ballistic / Brownian toggle. Redux drops it. The Brownian toggle in the first app exists to demonstrate that ergodic classical motion converges to a uniform distribution regardless of *how* it ergodicises. In a finite well, thermal Brownian motion combined with $E > V_0$ becomes the Arrhenius / transition-state-theory story (thermal activation over a barrier), which is a *different* chemistry lesson and would compete with the ionisation narrative this app is built around. Cleaner to drop it.

## Why position and energy histograms look different

The position histogram is a *time-average* of $|\psi(x,t)|^2$ sampled at the current time, plus the bins of independent particles each measured once. For eigenstates these are identical (eigenstates are stationary); for superpositions they differ slightly (the time-evolving $|\psi(x,t)|^2$ oscillates).

The energy histogram is built from independent measurements, each of which collapses to a single eigenvalue. This is the Born rule made visible: $P(n) = |c_n|^2$.

The protocols are deliberately parallel: both panels record one observable per step, into a histogram. The difference is what each observable looks like under the Born rule. Position has a continuous spectrum (any value in the real line is possible, including outside the box); energy has a discrete spectrum below $V_0$ and a continuum above (which Redux treats as the "ionised" label rather than drawing).

## Why we report $\langle x \rangle$ and $\langle E \rangle$ as running means

Students see two convergent quantities: $\langle x \rangle$ and $\langle E \rangle$. Both update as more measurements come in.

For the classical particle in any uniform-density state, $\langle x \rangle \to L/2$. For a quantum eigenstate of the finite well, also $\langle x \rangle = L/2$ exactly (eigenstates have definite parity about $L/2$, so $|\psi_n|^2$ is symmetric). For a mixed-parity superposition, $\langle x \rangle$ can drift away from $L/2$. This is correct physics – $\langle x \rangle$ in a mixed-parity state generally is not $L/2$.

One thing students will see in Redux that they did not see in the first app: $\langle x \rangle$ can drift *outside* $[0, L]$ when the wavefunction has significant amplitude outside the well, especially for states near the top of the well. This is the orbital-diffuseness story made quantitative.

## Auto-pause at every 10,000 measurements

Without intervention, the simulation could run indefinitely and the histograms would converge with arbitrary precision. This is not the lesson – students should *experience* convergence as a process.

Auto-pausing at 10k checkpoints lets students notice that the histogram still has visible noise at small N, see the noise decrease as they keep adding more measurements, and decide for themselves when they have collected enough data. The 10k increment is a compromise inherited from the first app; smaller would interrupt too often, larger would let the histograms converge too smoothly between checkpoints.

## "Show theory" in the finite well

The first app's "show theory" overlay displays the analytical $|\psi|^2$. In the finite well the functional *form* of $\psi$ is analytical (cosines or sines about $L/2$ inside, exponentials outside) but the eigenvalues and matching coefficients are numerical. The overlay is still labeled "show theory" – the distinction between "form is analytical, values are numerical" is lost on undergraduates and is true to how chemistry textbooks present finite-well results.

## Data export

Both tabs export CSV (long-format tidy data) and JSON, following the first app's pattern. Two schemas are used so JSON files are unambiguous:

- `finite-well-particle-export/v1` for Tab 1, filename prefix `fwell_single_…`. Captures $V_0$, the numerical bound-state spectrum, and the bound / continuum classification of each energy measurement.
- `finite-well-comparison-export/v1` for Tab 2, filename prefix `fwell_pair_…`. Captures both systems' parameters, bound spectra, link state, and measurement series.

Neither schema overlaps with the first app's `particle-in-a-box-export/v1`. Loading a Tab 1 file into Tab 2 (or vice versa) is supported via a cross-import flow: the load handler detects the schema in the JSON payload and prompts the user to pick a destination side (when importing single → pair) or a source side (when importing pair → single). Unit conversion uses $E^*_\text{ref}$ so a state saved at Tab 1's dimensionless units lands at sensible nm / eV values in Tab 2 and vice versa.

## Things the simulation deliberately doesn't model

Beyond the omissions inherited from the first app (time-dependent Hamiltonians, multiple particles, spin, applied fields), Redux specifically omits:

- **Barrier tunneling.** Single well only. The well-barrier-well geometry that exhibits proper tunneling between two bound regions is a candidate for a future sibling, not an addition here.
- **Brownian classical motion.** Reasoning above.
- **Continuum wavefunctions above $V_0$.** Replaced by an "ionised" label; reasoning above.
- **Variable $L$ and $m$ in tab 1.** These are tab 2's job. Tab 1 fixes $L$ and $m$ to match the first app and to keep the new $V_0$ slider as the only added control.

These omissions are deliberate. Each adds complexity without changing the core lessons Redux is built to teach.

## Defaults

First-run defaults are tuned to a "useful first contact" – the student opens the app and immediately sees something they recognise without having to discover the controls.

- **Tab 1.** $V_0$ at a value that contains roughly 4–5 bound states (deep enough to show structure, shallow enough that the threshold is reachable by sliding the energy up). Energy slider on or near the ground state. $\Gamma$ and $\sigma$ at zero.
- **Tab 2.** Same well in both panels (all parameters linked, $L$ and $m^*$ at their middle values, $V_0$ deep enough for several bound states). The all-linked default means the first thing the student sees is two identical histograms; the *next* thing they discover, by clicking a chain icon, is what changes when they unlock one parameter.
- **Both tabs.** Stopped on first load (so the student can configure before running). *Show eigenstates* and *Show theory* off (so the histogram looks like a noisy spectrum, not an annotated diagram – revealing the eigenstate ticks is part of the lesson). Quantum visualisation set to $|\psi|^2$. Notes and Spectroscopy sections collapsed. Random seed deterministic so the same default produces the same first run.

Pressing Play immediately shows the classical and quantum histograms diverging in shape (Tab 1) or the two systems' histograms accumulating in parallel (Tab 2). Turning on *Show theory* reveals the underlying analytical forms; turning on *Show eigenstates* reveals the discrete energy structure and (in Tab 1) the per-state Born $|c_n|^2$ for the current preparation.

## Visual design

Inherits the first app's palette and typography unchanged:

- Classical accent: orange (`#e0a868`).
- Quantum accent: teal (`#7adfd0`).
- Setting / eigenstate accent: purple (`#c9a0ff`).
- Destructive (Stop / Reset): red-orange (`#e8745a`).
- Background: deep blue-black (`#0e1320`).
- Panels: slate (`#161c2e`).
- Text: warm cream (`#e9e4d4`) and muted grey (`#9aa0b4`).

The classical / quantum colours are chosen to be distinguishable for the most common forms of colour-vision deficiency (orange vs teal differs in both hue and luminance). The new $V_0$ control adopts the settings-purple accent.

Typography uses Fraunces (display serif) for the main title and large expectation values, JetBrains Mono for technical labels and numbers, DM Sans for body text. All three are open-source and CDN-available.
