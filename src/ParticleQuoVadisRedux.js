/*
 * Particle, Quo Vadis. Redux — finite potential well simulation
 * Copyright (c) 2026 Pierre Kennepohl, University of Calgary
 * MIT License (see LICENSE)
 *
 * This file contains JSX. It uses the .js extension (not .jsx) so static
 * web servers — including GitHub Pages — serve it with the correct
 * JavaScript MIME type. Babel-standalone compiles the JSX in the browser
 * at load time; see index.html. No build step required.
 *
 * React is loaded globally from the UMD CDN script tags in the HTML, so
 * this file uses the global `React` object directly rather than ES module
 * imports.
 *
 * Status: chunk 2 of tab 1.
 *   - chunk 1: numerical eigenvalue solver for the finite well.
 *   - chunk 2: classical particle simulation with escape above V0 (this chunk),
 *              with the page layout matched to the sibling infinite-well app.
 *              The Quantum panel is a placeholder until chunk 3.
 * See NOTES.md for the working plan and PEDAGOGY.md for the design rationale.
 */

const { useState, useEffect, useRef, useMemo } = React;

// =============================================================
// PHYSICS — finite square well, dimensionless (ħ = 1, 2m = 1, L = 1)
// =============================================================

const L = 1;
const MAX_BOUND_STATES_DISPLAY = 8;

const E_INF = [];
for (let n = 1; n <= MAX_BOUND_STATES_DISPLAY; n++) {
  E_INF.push(n * n * Math.PI * Math.PI);
}

function fEven(E, V0) {
  const k = Math.sqrt(E);
  const kappa = Math.sqrt(V0 - E);
  return kappa * Math.cos(k * L / 2) - k * Math.sin(k * L / 2);
}

function fOdd(E, V0) {
  const k = Math.sqrt(E);
  const kappa = Math.sqrt(V0 - E);
  return kappa * Math.sin(k * L / 2) + k * Math.cos(k * L / 2);
}

function bisect(f, a, b, tol = 1e-12, maxIter = 200) {
  let fa = f(a), fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;
  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || (b - a) < tol) return m;
    if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return 0.5 * (a + b);
}

function findBrackets(f, V0, nScan = 4000) {
  const eps = 1e-6;
  const brackets = [];
  const Emin = eps, Emax = V0 - eps;
  if (Emax <= Emin) return brackets;
  let prevE = Emin, prevF = f(prevE, V0);
  for (let i = 1; i <= nScan; i++) {
    const E = Emin + (Emax - Emin) * i / nScan;
    const fv = f(E, V0);
    if (prevF * fv < 0) brackets.push([prevE, E]);
    prevE = E; prevF = fv;
  }
  return brackets;
}

function normalize(E, V0, parity) {
  const k = Math.sqrt(E);
  const kappa = Math.sqrt(V0 - E);
  let outside, inside;
  if (parity === 'even') {
    outside = (Math.cos(k * L / 2) ** 2) / kappa;
    inside  = L / 2 + Math.sin(k * L) / (2 * k);
  } else {
    outside = (Math.sin(k * L / 2) ** 2) / kappa;
    inside  = L / 2 - Math.sin(k * L) / (2 * k);
  }
  return 1 / Math.sqrt(inside + outside);
}

function findBoundStates(V0, maxDisplay = MAX_BOUND_STATES_DISPLAY) {
  if (V0 <= 0) return [];
  const states = [];
  for (const [a, b] of findBrackets(fEven, V0)) {
    const E = bisect((E) => fEven(E, V0), a, b);
    if (E !== null && E > 0 && E < V0) {
      states.push({ parity: 'even', E, k: Math.sqrt(E), kappa: Math.sqrt(V0 - E), A: normalize(E, V0, 'even') });
    }
  }
  for (const [a, b] of findBrackets(fOdd, V0)) {
    const E = bisect((E) => fOdd(E, V0), a, b);
    if (E !== null && E > 0 && E < V0) {
      states.push({ parity: 'odd', E, k: Math.sqrt(E), kappa: Math.sqrt(V0 - E), A: normalize(E, V0, 'odd') });
    }
  }
  states.sort((a, b) => a.E - b.E);
  states.forEach((s, i) => { s.n = i + 1; });
  return states.slice(0, Math.min(maxDisplay, MAX_BOUND_STATES_DISPLAY));
}

// =============================================================
// QUANTUM HELPERS — state preparation and sampling
// =============================================================
//
// State preparation: a Lorentzian-weighted superposition of bound states
// centered on the slider energy E_set with width Γ.
//   |c_n|² ∝ 1 / ((E_n − E_set)² + (Γ/2)²)
// normalised so Σ|c_n|² = 1 over the bound spectrum. This is the same
// prescription as in the sibling infinite-well app; here the spectrum is
// finite (capped at the bound-state count, typically 4–8) and the high
// states near V0 dominate when E_set approaches V0.
//
// |ψ(x, t)|² is the squared modulus of Σ c_n ψ_n(x) exp(−i E_n t),
// evaluated either on a grid (for visualisation and sampling) or at a
// single point. The wavefunction extends past the box on both sides via
// finiteWellPsi's exponential tails — sampling from the grid therefore
// occasionally produces x values outside [0, L], which is the
// leakage-into-the-forbidden-region story made measurable.

function computeProbs(E_set, gammaInternal, states) {
  const w = new Float64Array(states.length);
  if (states.length === 0) return w;
  const half = gammaInternal / 2;
  let sum = 0;
  for (let i = 0; i < states.length; i++) {
    const d = states[i].E - E_set;
    w[i] = 1 / (d * d + half * half);
    sum += w[i];
  }
  if (sum > 0) for (let i = 0; i < states.length; i++) w[i] /= sum;
  return w;
}

function expectedEnergyFromProbs(probs, states) {
  let E = 0;
  for (let i = 0; i < states.length; i++) E += probs[i] * states[i].E;
  return E;
}

// Squared modulus of the time-evolving superposition at a single (x, t).
function densityAt(states, probs, x, t) {
  let re = 0, im = 0;
  for (let i = 0; i < states.length; i++) {
    if (probs[i] < 1e-14) continue;
    const c = Math.sqrt(probs[i]);
    const psi = finiteWellPsi(states[i], x);
    if (psi === 0) continue;
    const ph = -states[i].E * t;
    re += c * psi * Math.cos(ph);
    im += c * psi * Math.sin(ph);
  }
  return re * re + im * im;
}

// Sample |ψ|² on a uniform grid spanning [xMin, xMax].
function densityGrid(states, probs, t, xMin, xMax, N) {
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const x = xMin + (xMax - xMin) * i / (N - 1);
    out[i] = densityAt(states, probs, x, t);
  }
  return out;
}

// Inverse-CDF sample from a density grid, returning an x in [xMin, xMax].
function sampleFromGrid(grid, xMin, xMax, rng = Math.random) {
  const N = grid.length;
  let cum = 0;
  const cdf = new Float64Array(N);
  for (let i = 0; i < N; i++) { cum += grid[i]; cdf[i] = cum; }
  if (cum === 0) return 0.5 * (xMin + xMax);
  const u = rng() * cum;
  let lo = 0, hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return xMin + (xMax - xMin) * lo / (N - 1);
}

// Sample which eigenstate index a Born-rule energy measurement collapses to.
function sampleEnergyIdx(probs, rng = Math.random) {
  const u = rng();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (u < cum) return i;
  }
  return probs.length - 1;
}

// Lorentzian cumulative distribution. F(V0) is the probability that the
// preparation Lorentzian places weight in the bound region (E < V0);
// the rest is in the continuum (E > V0) and represents the part of the
// prepared state that is actually ionised. The naive bound-only
// renormalisation throws this away — important to capture near V0
// where the tails are still tall.
function lorentzCDF(E, ESet, gammaInternal) {
  return 0.5 + Math.atan((E - ESet) / (gammaInternal / 2)) / Math.PI;
}

// Inverse Lorentzian CDF truncated to E > cutoff. Used to sample
// continuum energies for the energy histogram bars above V0.
function sampleLorentzAbove(cutoff, ESet, gammaInternal, rng = Math.random) {
  const F0 = lorentzCDF(cutoff, ESet, gammaInternal);
  const u  = F0 + rng() * (1 - F0);
  // Inverse CDF of the (untruncated) Lorentzian.
  return ESet + (gammaInternal / 2) * Math.tan(Math.PI * (u - 0.5));
}

function finiteWellPsi(state, x) {
  const { parity, k, kappa, A } = state;
  if (x >= 0 && x <= L) {
    return parity === 'even'
      ? A * Math.cos(k * (x - L / 2))
      : A * Math.sin(k * (x - L / 2));
  }
  if (x < 0) {
    const left = parity === 'even' ? A * Math.cos(k * L / 2) : -A * Math.sin(k * L / 2);
    return left * Math.exp(kappa * x);
  }
  const right = parity === 'even' ? A * Math.cos(k * L / 2) : A * Math.sin(k * L / 2);
  return right * Math.exp(-kappa * (x - L));
}

// =============================================================
// SIMULATION CONSTANTS
// =============================================================
//
// Mirror the sibling infinite-well app so the classical comparison
// remains apples-to-apples. Pacing in particular: the loop advances
// roughly one simulation step per animation frame (~60 measurements
// per real second), which is slow enough that students see histograms
// fill bin-by-bin in correlation with the visible particle motion,
// and 10 000-measurement checkpoints take a couple of minutes — a
// pace that matches the first app exactly.

const DT = 0.0016;
const PAUSE_INCREMENT = 10000;
const NBINS_X = 120;
const NBINS_E = 100;
const SPEED_JITTER = 0.20;
const FLASH_AGE = 30;             // animation frames a measurement marker stays visible
const FLASH_EVERY_N = 5;          // push to flash buffer every Nth measurement
const FLASH_BUFFER_MAX = 40;      // soft cap on simultaneous flashes

// Position plot extends past the walls so the quantum wavefunction's
// leakage into the classically forbidden region is visible. The classical
// particle is still confined to [0, L]; bins outside [0, L] are simply
// always zero on the classical side. The margin (0.3 L on each side) is
// wide enough to show roughly 1.5 decay lengths for the topmost bound
// state at typical V0 — i.e. most of the visible leakage.
const X_PLOT_MARGIN = 0.3;
const X_PLOT_MIN    = -X_PLOT_MARGIN;
const X_PLOT_MAX    = L + X_PLOT_MARGIN;
const X_PLOT_RANGE  = X_PLOT_MAX - X_PLOT_MIN;

// V0 is a user-controlled slider as of chunk 4. Below V0_MIN the well
// doesn't contain a bound state (or barely does); above V0_MAX we'd
// have more bound states than we can usefully display (cap at
// MAX_BOUND_STATES_DISPLAY = 8). The slider energy range and the
// energy-histogram axis are derived from the current V0 so the
// pedagogically interesting region (bound spectrum + a comfortable
// continuum band above V0) always fills the slider.
const V0_DEFAULT = 200;
const V0_MIN = 20;
const V0_MAX = 600;
const E_SLIDER_MIN = 5;
function eAxisMaxForV0(V0) {
  return Math.round(1.4 * V0);
}

const SIGMA_MIN = 0;
const SIGMA_MAX = 30;
const SIGMA_DEFAULT = 0;

// Γ (state-preparation width) is stored with an internal floor of 1 to
// avoid the Lorentzian singularity at exact eigenvalues; the displayed
// value is offset by −1 so the user sees Γ = 0 at the "sharpest
// preparation" extreme. Matched to the sibling app convention.
const GAMMA_INTERNAL_MIN = 1;
const GAMMA_INTERNAL_MAX = 31;     // displayed 0 – 30
const GAMMA_DEFAULT      = 1;      // displayed 0

// Density grid resolution used for sampling |ψ(x,t)|² and for the
// continuous wavefunction view overlay. Higher = smoother visualisation
// at the cost of per-step work.
const DENSITY_GRID_N = 240;

// Quantum-time scale factor. At 1× the natural cosine evolution lingers
// at extremes (the arcsine PDF of cos(θ) for uniform θ). The previous
// fix was to speed up t, but that made higher-n eigenstates flicker
// uncontrollably. The new fix — plotting both Re(ψ) and Im(ψ) — gives
// continuous visual motion at *any* speed because the phase rotates
// uniformly through the complex plane: when one curve is at an
// extremum the other is at zero and changing fastest. So we hold this
// at 1× by default. The constant remains as a tuning knob for future
// users who want to demonstrate faster or slower evolution; expose it
// as a slider when needed.
const WAVE_TIME_MULTIPLIER = 1;

function classicalSpeed(E) {
  // Per-step velocity scale in dimensionless units, matched to the
  // sibling app so a given E feels the same speed in both apps.
  return Math.sqrt(2 * Math.max(E, 0));
}

// Position bin index in the extended [X_PLOT_MIN, X_PLOT_MAX] axis,
// or −1 if x falls outside the plot range.
function posToBin(x) {
  const frac = (x - X_PLOT_MIN) / X_PLOT_RANGE;
  if (frac < 0 || frac >= 1) return -1;
  return Math.min(NBINS_X - 1, Math.floor(frac * NBINS_X));
}

// Box–Muller Gaussian (mean 0, std 1).
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Seedable pseudo-random number generator (mulberry32). Returns a
// function that produces uniform numbers in [0, 1). Pass any nonzero
// integer as seed for reproducibility; pass 0 / null / undefined for
// an unseeded generator that falls back to Math.random.
function makePRNG(seed) {
  if (!seed) return () => Math.random();
  let a = (seed >>> 0) || 0xC0FFEE;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gaussian sample drawn from a supplied uniform rng.
function randnWith(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// localStorage-backed React state. JSON.stringify/parse for general
// values, falls back to defaultValue on any error or absent key.
function useSavedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored);
    } catch (e) {
      return defaultValue;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }, [key, value]);
  return [value, setValue];
}

// =============================================================
// REAL-UNITS CONVERSION  (foundation for tab 2)
// =============================================================
//
// Tab 1 works in dimensionless units (L = 1, ℏ²/2m = 1) so the natural
// energy unit is E* = ℏ²/(2mL²). Tab 2 lets the student dial well
// width in nm, effective mass in electron masses, and well depth in
// eV — quantities they have intuition for from chemistry — and
// converts to/from the same dimensionless engine that powers tab 1.
//
// Anchor value for L = 1 nm, m_eff = m_e:
//   E*_REF = ℏ² / (2 m_e (1 nm)²)
//          = (1.054 571 817e-34 J·s)² / (2 × 9.109 383 7e-31 kg × (1e-9 m)²)
//          ≈ 6.1042e-21 J = 0.038 100 eV
// (Using exact post-2019 values of h and the eV, CODATA m_e.)
//
// For arbitrary L (nm) and m_eff (m_e):
//   E*(L, m) = E*_REF × (1/m) × (1/L)²

const E_STAR_REF_EV = 0.038100;

// Slider range for tab 2's well width. Lower bound is roughly a single
// covalent bond; upper bound is around the larger end of common
// semiconductor quantum dots (CdSe, ~5 nm). Step is 0.05 nm so the
// well visibly grows or shrinks with every click of the slider.
const L_MIN_NM = 0.3;
const L_MAX_NM = 5.0;
const L_STEP_NM = 0.05;

// Well depth in eV. The range goes from a half-eV (weakly-bound surface
// state) up to 20 eV (deep enough that a 1-nm electron well still
// supports a dozen-odd bound states). Step is 0.1 eV which matches the
// resolution the energy slider can land on.
const V0_MIN_EV = 0.5;
const V0_MAX_EV = 20.0;
const V0_STEP_EV = 0.1;

// Effective-mass picker for tab 2. The presets span six decades, from
// a "light effective electron" typical of GaAs-like semiconductors
// through the alpha particle, so the same finite well can be re-cast
// as everything from a quantum dot to a deuteron in a nucleus-sized
// box. The slider underneath the picker is log-scaled so each decade
// gets equal screen space.
const M_MIN_ME      = 0.01;
const M_MAX_ME      = 10000;
const M_PRESET_TOL  = 0.005;   // fractional match tolerance for "preset selected"
const PARTICLE_PRESETS = [
  // Option labels avoid the bare asterisk because HTML <option> text
  // can't contain markup, so we can't superscript the star the way we
  // can elsewhere — the numeric value lives in the slider readout
  // next to the picker.
  { id: 'm_eff_light', label: 'Light effective electron (semiconductor)', m: 0.1     },
  { id: 'electron',    label: 'Electron',                                 m: 1.0     },
  { id: 'm_eff_heavy', label: 'Heavy effective electron',                 m: 5.0     },
  { id: 'muon',        label: 'Muon',                                 m: 206.77  },
  { id: 'proton',      label: 'Proton',                               m: 1836.15 },
  { id: 'deuteron',    label: 'Deuteron',                             m: 3670.48 },
  { id: 'alpha',       label: 'Alpha particle',                       m: 7294.30 },
];

function matchPreset(m) {
  for (const p of PARTICLE_PRESETS) {
    if (Math.abs(Math.log(m / p.m)) < M_PRESET_TOL) return p.id;
  }
  return 'custom';
}

function eStarEv(lengthNm, mEffMe) {
  return E_STAR_REF_EV / (mEffMe * lengthNm * lengthNm);
}

// Maps real-units parameters to the dimensionless engine and back.
// Returned object holds the conversion factor and a helper so callers
// don't have to remember which way the multiplication goes.
function realToInternal(lengthNm, mEffMe, v0eV) {
  const eStar = eStarEv(lengthNm, mEffMe);
  return {
    eStarEv:    eStar,
    V0Internal: v0eV / eStar,
    eToEv:      (Ei) => Ei * eStar,
  };
}

// =============================================================
// VISUAL DESIGN — palette and typography (inherited from the sibling app)
// =============================================================

const COL = {
  bg:        '#0e1320',
  panel:     '#161c2e',
  rule:      '#232a40',
  ruleHi:    '#2c344d',
  ink:       '#e9e4d4',
  inkDim:    '#9aa0b4',
  classical: '#e0a868',
  quantum:   '#7adfd0',
  accent:    '#c9a0ff',  // settings / slider accent
  danger:    '#e8745a',
  ionised:   '#e8a5b8',
};

const FONTS = {
  display: "'Fraunces', serif",
  body:    "'DM Sans', system-ui, sans-serif",
  mono:    "'JetBrains Mono', monospace",
};

function panelStyle() {
  return {
    background: COL.panel,
    border: `1px solid ${COL.rule}`,
    borderRadius: 4,
    padding: '14px 18px',
  };
}

// =============================================================
// TAB 1 — finite well at fixed L, V0 variable, classical + quantum
// =============================================================

function Tab1Content({ activeTab, onChangeTab }) {
  // Load app fonts (DM Sans / Fraunces / JetBrains Mono).
  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);

  // Persistent settings (read first because `states` depends on the cap).
  const [pauseIncrement, setPauseIncrement] = useSavedState('redux:pauseIncrement', 10000);
  const [maxBoundCap,    setMaxBoundCap]    = useSavedState('redux:maxBoundCap',    8);
  const [waveTimeMult,   setWaveTimeMult]   = useSavedState('redux:waveTimeMult',   1);
  const [language,       setLanguage]       = useSavedState('redux:language',       'en');
  const [showNotes,      setShowNotes]      = useSavedState('redux:showNotes',      false);
  const [randomSeed,     setRandomSeed]     = useState(0);  // not persisted
  const [settingsOpen,   setSettingsOpen]   = useState(false);

  const [V0, setV0]           = useState(V0_DEFAULT);
  // What's drawn in the quantum simulation panel: 'density' = |ψ|²,
  // 'wavefunction' = Re ψ + Im ψ, 'off' = neither (just the well + flashes).
  const [psiMode, setPsiMode] = useSavedState('redux:psiMode', 'density');
  const [showEigen, setShowEigen]   = useState(false);  // eigenstate ticks on the slider + histograms
  const [showTheory, setShowTheory] = useState(false);  // |c_n|² overlay on the quantum P(E)
  const [logEnergy, setLogEnergy]   = useState(false);  // log vs linear y axis on the P(E) panels
  const states = useMemo(() => findBoundStates(V0, maxBoundCap), [V0, maxBoundCap]);

  // Energy axis max scales with V0 so the slider always covers the
  // bound spectrum (0 < E < V0) plus a comfortable continuum band.
  const eHistMax   = eAxisMaxForV0(V0);
  const eSliderMax = eHistMax;

  // Slider energy: start at the (rounded) ground-state energy of the finite well.
  const [energy, setEnergy]   = useState(() => Math.round(states[0].E));
  const [sigma, setSigma]     = useState(SIGMA_DEFAULT);
  const [gammaInternal, setGammaInternal] = useState(GAMMA_DEFAULT);
  const [running, setRunning] = useState(false);
  const [, setTick]           = useState(0);  // force-redraw counter

  // When V0 changes, clamp the energy slider if it now exceeds the new
  // max, and reset every histogram / counter / mean (the previous
  // measurements were for a different physical system and combining
  // them with new ones would be misleading).
  const prevV0Ref = useRef(V0);
  useEffect(() => {
    if (prevV0Ref.current === V0) return;
    prevV0Ref.current = V0;
    if (isLoadingRef.current) return;  // load is restoring state itself
    if (energy > eSliderMax) setEnergy(eSliderMax);
    // Clear histograms and counters.
    xHistRef.current = new Float64Array(NBINS_X);
    eHistRef.current = new Float64Array(NBINS_E);
    xSumRef.current = 0; eSumRef.current = 0;
    countRef.current = 0; nextPauseRef.current = pauseIncrement;
    recentXRef.current = []; recentERef.current = []; flashCounterRef.current = 0;
    qXHistRef.current = new Float64Array(NBINS_X);
    qEHistRef.current = new Float64Array(NBINS_E);
    qXSumRef.current = 0; qESumRef.current = 0;
    qXCountRef.current = 0; qECountRef.current = 0;
    qIonisedCountRef.current = 0; qXOutsideCountRef.current = 0;
    qRecentXRef.current = []; qRecentERef.current = []; qFlashCounterRef.current = 0;
    tRef.current = 0;
    setRunning(false);
    setTick((t) => t + 1);
  }, [V0, energy, eSliderMax]);

  // Refs mirror state values so the simulation loop can read them stably.
  const energyRef = useRef(energy);
  useEffect(() => { energyRef.current = energy; }, [energy]);
  const sigmaRef = useRef(sigma);
  useEffect(() => { sigmaRef.current = sigma; }, [sigma]);
  const gammaInternalRef = useRef(gammaInternal);
  useEffect(() => { gammaInternalRef.current = gammaInternal; }, [gammaInternal]);
  const V0Ref = useRef(V0);
  useEffect(() => { V0Ref.current = V0; }, [V0]);
  const eHistMaxRef = useRef(eHistMax);
  useEffect(() => { eHistMaxRef.current = eHistMax; }, [eHistMax]);
  const statesRef = useRef(states);
  useEffect(() => { statesRef.current = states; }, [states]);

  // Quantum state-preparation probabilities. Recomputed when energy, Γ,
  // or the bound spectrum (V0) changes.
  const probs = useMemo(
    () => computeProbs(energy, gammaInternal, states),
    [energy, gammaInternal, states]
  );
  const probsRef = useRef(probs);
  useEffect(() => { probsRef.current = probs; }, [probs]);

  // Mutable simulation state.
  const xRef         = useRef(L / 2);
  const vRef         = useRef(classicalSpeed(energy));
  const xHistRef     = useRef(new Float64Array(NBINS_X));
  const eHistRef     = useRef(new Float64Array(NBINS_E));
  const xSumRef      = useRef(0);
  const eSumRef      = useRef(0);
  const countRef     = useRef(0);
  const nextPauseRef = useRef(PAUSE_INCREMENT);

  // Visual bouncing state — see ParticleView for the visual model. The
  // bouncing is decoupled from x so that the y-trajectory does not look
  // like a single sinusoidal hump (which would look like the quantum
  // n = 1 eigenstate and conflate the classical and quantum pictures).
  // Each bounce has its own random duration and peak fraction, drawn
  // anew when the phase wraps past 1.
  const bouncePhaseRef    = useRef(0);
  const bounceDurationRef = useRef(0.06);
  const bouncePeakFracRef = useRef(0.8);

  // Recent-measurement flash buffers. Each entry is { x | E, age }; ages
  // advance per animation frame and entries older than FLASH_AGE are
  // pruned. Pushed every FLASH_EVERY_N-th measurement so individual
  // events are distinguishable on screen rather than smearing together.
  const recentXRef    = useRef([]);   // classical position flashes
  const recentERef    = useRef([]);   // classical energy flashes
  const flashCounterRef = useRef(0);

  // Quantum simulation state. The quantum particle has no trajectory;
  // its only state is the simulation time t (driving the phase factors
  // exp(-i E_n t) in |ψ(x, t)|²) and the latest measurement positions.
  // Each step samples x from |ψ(x, t)|² and E from the Born distribution,
  // collecting them into histograms parallel to the classical side.
  const tRef            = useRef(0);
  const qXLatestRef     = useRef(L / 2);  // last sampled position, for the live "particle" indicator
  const qXHistRef       = useRef(new Float64Array(NBINS_X));
  const qEHistRef       = useRef(new Float64Array(NBINS_E));
  const qXSumRef        = useRef(0);
  const qESumRef        = useRef(0);
  // Position count and energy count diverge: a continuum-collapse event
  // (probability ≈ 1 − F(V0) of the Lorentzian) registers an energy
  // measurement above V0 but no position measurement, since the
  // electron has been ejected.
  const qXCountRef       = useRef(0);
  const qECountRef       = useRef(0);
  const qIonisedCountRef = useRef(0);
  const qXOutsideCountRef = useRef(0);   // position samples outside [0, L]
  const qRecentXRef     = useRef([]);
  const qRecentERef     = useRef([]);
  const qFlashCounterRef = useRef(0);

  // Timestamp of the most recent reset. The simulation loop sits idle
  // for ~400 ms after a reset so the "histograms-wiping-clean" beat is
  // visually perceivable rather than instant. Mirrors PQV's behaviour.
  const lastResetRef = useRef(0);

  // Load-in-progress flag. When true, the V₀-change reset effect bails
  // out — applyLoadedState will restore the histograms itself and
  // doesn't want them wiped by the effect that normally fires when V₀
  // changes. Cleared on a microtask after the load completes.
  const isLoadingRef = useRef(false);

  // Save-menu open state (CSV / JSON dropdown) and the file input ref
  // for the hidden <input type="file"> that the Load button triggers.
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [pendingLoadFile, setPendingLoadFile] = useState(null);
  // Cross-tab import: when a tab 2 pair file gets loaded into tab 1,
  // the user has to pick which side (A or B) to keep — this stores
  // the payload until they choose.
  const [pendingCrossImport, setPendingCrossImport] = useState(null);
  const fileInputRef = useRef(null);

  // Refs to mirror settings the simulation loop reads inside its hot
  // path. The PRNG instance itself is rebuilt whenever the seed
  // changes — all subsequent random ops inside the loop draw from it.
  const pauseIncrementRef = useRef(pauseIncrement);
  useEffect(() => { pauseIncrementRef.current = pauseIncrement; }, [pauseIncrement]);
  const waveTimeMultRef = useRef(waveTimeMult);
  useEffect(() => { waveTimeMultRef.current = waveTimeMult; }, [waveTimeMult]);
  const prngRef = useRef(makePRNG(randomSeed));
  useEffect(() => { prngRef.current = makePRNG(randomSeed); }, [randomSeed]);

  const isIonised = energy > V0;

  // -------------------------------------------------------------
  // Simulation loop
  // -------------------------------------------------------------
  // Real-time-paced: number of sim steps per frame derives from the
  // wall-clock delta since the previous frame, matching the sibling
  // app exactly. At ~60 fps this means ~1 measurement per frame, i.e.
  // ~60 measurements per second. Slow enough that students see the
  // histograms fill bin-by-bin in correlation with the visible motion;
  // 10 000-measurement checkpoints take roughly three minutes, which
  // matches the pedagogy of "experience convergence as a process."
  useEffect(() => {
    if (!running || isIonised) return;
    let rafId = 0;
    let last = performance.now();

    function frame(now) {
      const dt = Math.min(60, now - last);
      last = now;
      // Idle for ~400 ms after a reset so the wipe is visible.
      const sinceReset = now - lastResetRef.current;
      const steps = sinceReset > 400 ? Math.max(1, Math.floor(dt / 16)) : 0;

      const E          = energyRef.current;
      const sigma      = sigmaRef.current;
      const V0Loop     = V0Ref.current;
      const eHistLoop  = eHistMaxRef.current;
      const statesLoop = statesRef.current;
      const pauseAt    = pauseIncrementRef.current;
      const waveMult   = waveTimeMultRef.current;
      const rng        = prngRef.current;
      const vMag       = classicalSpeed(E);

      for (let s = 0; s < steps; s++) {
        let x   = xRef.current;
        let dir = vRef.current >= 0 ? 1 : -1;

        // Per-step displacement = direction × speed × DT, with ±20 %
        // speed jitter to break the periodic orbit. Speed is sourced
        // from the slider each step so the mean energy does not drift.
        const speed = vMag * DT * (1 + SPEED_JITTER * 2 * (rng() - 0.5));
        let newX = x + dir * speed;

        // Wall reflection with a small overshoot (~1.5 % of L) so the
        // first and last bins sample at the same rate as the interior.
        // Matched to the sibling app's overshoot convention.
        if (newX <= 0 || newX >= L) {
          const overshoot = rng() * 0.015;
          newX = newX <= 0 ? overshoot : L - overshoot;
          dir = -dir;
        }

        xRef.current = newX;
        vRef.current = dir * vMag; // sign carries direction; magnitude reference

        // Position histogram + running mean. Histogram bins span the
        // extended plot range so the quantum side's leakage past the
        // walls can be visualised in the same axis; the classical
        // particle is always inside [0, L], so its bins outside that
        // range are simply always zero.
        const xBin = posToBin(newX);
        if (xBin >= 0 && xBin < NBINS_X) xHistRef.current[xBin]++;
        xSumRef.current += newX;

        // Energy measurement = slider value + Gaussian instrument noise
        // of standard deviation σ. Values that fall outside [0, eHistMax)
        // are still recorded in the running mean but skipped in the
        // histogram (a real spectrometer would simply not detect them).
        const eMeas = E + sigma * randnWith(rng);
        eSumRef.current += eMeas;
        if (eMeas >= 0 && eMeas < eHistLoop) {
          const eBin = Math.min(NBINS_E - 1, Math.floor(eMeas / eHistLoop * NBINS_E));
          eHistRef.current[eBin]++;
        }

        countRef.current++;
        flashCounterRef.current++;

        // Push a flash marker every Nth step so individual events are
        // distinguishable rather than smearing.
        if (flashCounterRef.current % FLASH_EVERY_N === 0) {
          recentXRef.current.push({ x: newX, age: 0 });
          if (recentXRef.current.length > FLASH_BUFFER_MAX) recentXRef.current.shift();
          recentERef.current.push({ E: eMeas, age: 0 });
          if (recentERef.current.length > FLASH_BUFFER_MAX) recentERef.current.shift();
        }

        // ---------- Quantum step (using the same per-step PRNG so a
        // seeded run is fully reproducible across classical+quantum) -
        // Each measurement event is either:
        //   (a) bound-state collapse: probability F(V0) of the
        //       preparation Lorentzian. Sample n from |c_n|² (bound
        //       probabilities, renormalised to sum to F(V0)) and bin
        //       both energy (E_n + σ noise) and position (sampled
        //       from |ψ(x,t)|²).
        //   (b) continuum collapse: probability 1 − F(V0). The
        //       electron is ionised — bin an energy measurement
        //       drawn from the Lorentzian truncated to E > V0
        //       (plus σ noise), but no position measurement.
        //
        // The bound probability F(V0) is the cumulative Lorentzian
        // up to V0. Near V0 with wide Γ, a meaningful fraction of
        // events fall in the continuum — this is the missing piece
        // that the old "renormalise over bound states only" approach
        // squashed onto the topmost bound states, distorting the
        // energy distribution there.
        tRef.current += DT * waveMult;
        const qProbs = probsRef.current;
        const gammaInt = gammaInternalRef.current;
        const Fbound = lorentzCDF(V0Loop, E, gammaInt);

        if (rng() < Fbound && qProbs && qProbs.length > 0) {
          // (a) bound-state event
          const grid = densityGrid(statesLoop, qProbs, tRef.current,
                                   X_PLOT_MIN, X_PLOT_MAX, DENSITY_GRID_N);
          const xSamp = sampleFromGrid(grid, X_PLOT_MIN, X_PLOT_MAX, rng);
          qXLatestRef.current = xSamp;
          qXSumRef.current += xSamp;
          qXCountRef.current++;
          if (xSamp < 0 || xSamp > L) qXOutsideCountRef.current++;
          const qxBin = posToBin(xSamp);
          if (qxBin >= 0 && qxBin < NBINS_X) qXHistRef.current[qxBin]++;

          const eIdx = sampleEnergyIdx(qProbs, rng);
          const eReported = statesLoop[eIdx].E + sigma * randnWith(rng);
          qESumRef.current += eReported;
          qECountRef.current++;
          if (eReported >= 0 && eReported < eHistLoop) {
            const qeBin = Math.min(NBINS_E - 1, Math.floor(eReported / eHistLoop * NBINS_E));
            qEHistRef.current[qeBin]++;
          }
          qFlashCounterRef.current++;
          if (qFlashCounterRef.current % FLASH_EVERY_N === 0) {
            qRecentXRef.current.push({ x: xSamp, age: 0 });
            if (qRecentXRef.current.length > FLASH_BUFFER_MAX) qRecentXRef.current.shift();
            qRecentERef.current.push({ E: eReported, age: 0 });
            if (qRecentERef.current.length > FLASH_BUFFER_MAX) qRecentERef.current.shift();
          }
        } else {
          // (b) continuum event — energy only, no position.
          const eReported = sampleLorentzAbove(V0Loop, E, gammaInt, rng) + sigma * randnWith(rng);
          qESumRef.current += eReported;
          qECountRef.current++;
          qIonisedCountRef.current++;
          if (eReported >= 0 && eReported < eHistLoop) {
            const qeBin = Math.min(NBINS_E - 1, Math.floor(eReported / eHistLoop * NBINS_E));
            qEHistRef.current[qeBin]++;
          }
          qFlashCounterRef.current++;
          if (qFlashCounterRef.current % FLASH_EVERY_N === 0) {
            qRecentERef.current.push({ E: eReported, age: 0 });
            if (qRecentERef.current.length > FLASH_BUFFER_MAX) qRecentERef.current.shift();
          }
        }

        // Visual bounce phase (see ParticleView).
        bouncePhaseRef.current += DT / bounceDurationRef.current;
        if (bouncePhaseRef.current >= 1) {
          bouncePhaseRef.current -= Math.floor(bouncePhaseRef.current);
          bounceDurationRef.current = 0.04 + 0.06 * rng();
          bouncePeakFracRef.current = 0.5  + 0.5  * rng();
        }

        if (countRef.current >= nextPauseRef.current) {
          nextPauseRef.current += pauseAt;
          setRunning(false);
          break;
        }
      }

      // Age flash markers once per frame and prune the expired ones.
      const ageX = (m) => ({ x: m.x, age: m.age + 1 });
      const ageE = (m) => ({ E: m.E, age: m.age + 1 });
      const live = (m) => m.age < FLASH_AGE;
      recentXRef.current  = recentXRef.current.map(ageX).filter(live);
      recentERef.current  = recentERef.current.map(ageE).filter(live);
      qRecentXRef.current = qRecentXRef.current.map(ageX).filter(live);
      qRecentERef.current = qRecentERef.current.map(ageE).filter(live);

      setTick((t) => t + 1);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [running, isIonised]);

  // -------------------------------------------------------------
  // Control handlers
  // -------------------------------------------------------------
  function handleStop() {
    xHistRef.current = new Float64Array(NBINS_X);
    eHistRef.current = new Float64Array(NBINS_E);
    xSumRef.current = 0;
    eSumRef.current = 0;
    countRef.current = 0;
    nextPauseRef.current = pauseIncrement;
    recentXRef.current = [];
    recentERef.current = [];
    flashCounterRef.current = 0;

    qXHistRef.current = new Float64Array(NBINS_X);
    qEHistRef.current = new Float64Array(NBINS_E);
    qXSumRef.current = 0;
    qESumRef.current = 0;
    qXCountRef.current = 0;
    qECountRef.current = 0;
    qIonisedCountRef.current = 0;
    qXOutsideCountRef.current = 0;
    qRecentXRef.current = [];
    qRecentERef.current = [];
    qFlashCounterRef.current = 0;
    tRef.current = 0;
    lastResetRef.current = performance.now();

    setRunning(false);
    setTick((t) => t + 1);
  }
  function handlePlay()  { if (!isIonised) setRunning(true);  }
  function handlePause() { setRunning(false); }

  // -------------------------------------------------------------
  // Data export / load — CSV and JSON
  // -------------------------------------------------------------
  // Redux schema: finite-well-particle-export/v1. Distinct from PQV's
  // particle-in-a-box-export/v1 because the finite well has different
  // bin layouts (extended x range, dynamic energy range) and an extra
  // bound-state spectrum that must be preserved across save/load.

  function buildSnapshot() {
    const cMeanX = count > 0 ? xSumRef.current / count : null;
    const cMeanE = count > 0 ? eSumRef.current / count : null;
    const qMeanX = qXCount > 0 ? qXSumRef.current / qXCount : null;
    const qMeanE = qECount > 0 ? qESumRef.current / qECount : null;

    const now = new Date().toISOString();
    const meta = {
      exported_at: now,
      v0: V0,
      energy_setting: energy,
      gamma_internal: gammaInternal,
      gamma_displayed: gammaInternal - 1,
      instrument_sigma: sigma,
      energy_units: 'hbar^2 / (2 m L^2)',
      position_units: 'L (box length)',
      n_position_bins: NBINS_X,
      x_plot_min: X_PLOT_MIN,
      x_plot_max: X_PLOT_MAX,
      n_energy_bins: NBINS_E,
      energy_axis_max: eHistMax,
      classical_measurements: count,
      classical_mean_x: cMeanX,
      classical_mean_E: cMeanE,
      quantum_position_measurements: qXCount,
      quantum_energy_measurements: qECount,
      quantum_ionisation_events: qIonisedCountRef.current,
      quantum_outside_box_events: qXOutsideCountRef.current,
      quantum_mean_x: qMeanX,
      quantum_mean_E: qMeanE,
    };

    const eigenvalues = states.map((s) => ({
      n: s.n, parity: s.parity, E_n: s.E,
      k: s.k, kappa: s.kappa,
    }));

    const xBinW = X_PLOT_RANGE / NBINS_X;
    const eBinW = eHistMax / NBINS_E;
    const positionBins = [];
    for (let i = 0; i < NBINS_X; i++) {
      positionBins.push({
        bin_index: i,
        bin_center: X_PLOT_MIN + (i + 0.5) * xBinW,
        classical: xHistDensity[i],
        quantum: qXHistDensity[i],
      });
    }
    const energyBins = [];
    for (let i = 0; i < NBINS_E; i++) {
      energyBins.push({
        bin_index: i,
        bin_center: (i + 0.5) * eBinW,
        classical: eHistDensity[i],
        quantum: qEHistDensity[i],
      });
    }

    return { meta, eigenvalues, positionBins, energyBins, now };
  }

  function baseFilename(now) {
    const stamp = now.replace(/[:T]/g, '-').slice(0, 19);
    // `single` prefix distinguishes tab 1's one-system exports from
    // tab 2's `pair` (A+B) exports at a glance in a Downloads folder.
    return `fwell_single_V${V0}_E${energy}_g${gammaInternal - 1}_s${sigma}_${stamp}`;
  }

  function triggerDownload(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const snap = buildSnapshot();
    const fmt = (v) => v === null || v === undefined ? '' : (typeof v === 'number' ? v.toFixed(6) : v);

    const metaRows = [['key', 'value']];
    for (const [k, v] of Object.entries(snap.meta)) metaRows.push([k, fmt(v)]);

    const eigenRows = [['eigenstate_n', 'parity', 'energy_E_n', 'k', 'kappa']];
    for (const e of snap.eigenvalues) eigenRows.push([e.n, e.parity, fmt(e.E_n), fmt(e.k), fmt(e.kappa)]);

    const dataRows = [['type', 'panel', 'bin_index', 'bin_center', 'density']];
    for (const b of snap.positionBins) {
      dataRows.push(['position', 'classical', b.bin_index, fmt(b.bin_center), fmt(b.classical)]);
      dataRows.push(['position', 'quantum',   b.bin_index, fmt(b.bin_center), fmt(b.quantum)]);
    }
    for (const b of snap.energyBins) {
      dataRows.push(['energy', 'classical', b.bin_index, fmt(b.bin_center), fmt(b.classical)]);
      dataRows.push(['energy', 'quantum',   b.bin_index, fmt(b.bin_center), fmt(b.quantum)]);
    }

    function esc(v) {
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }
    const toCSV = (rows) => rows.map(r => r.map(esc).join(',')).join('\n');
    const csv = toCSV(metaRows) + '\n\n' + toCSV(eigenRows) + '\n\n' + toCSV(dataRows) + '\n';
    triggerDownload(csv, 'text/csv;charset=utf-8', `${baseFilename(snap.now)}.csv`);
  }

  function exportJSON() {
    const snap = buildSnapshot();
    const payload = {
      schema: 'finite-well-particle-export/v1',
      meta: snap.meta,
      eigenvalues: snap.eigenvalues,
      position_histogram: {
        units: { bin_center: 'L', density: '1/L' },
        bins: snap.positionBins,
      },
      energy_histogram: {
        units: { bin_center: 'hbar^2/(2mL^2)', density: '(hbar^2/(2mL^2))^-1' },
        bins: snap.energyBins,
      },
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'application/json', `${baseFilename(snap.now)}.json`);
  }

  function applyLoadedState(payload) {
    // Cross-tab import: a tab 2 pair file landing in tab 1's loader.
    // Defer to a side-selection modal — the user has to tell us which
    // system (A or B) to pull into this tab.
    if (payload.schema === 'finite-well-comparison-export/v1') {
      setPendingCrossImport(payload);
      return false;
    }
    if (payload.schema !== 'finite-well-particle-export/v1') {
      alert(`Unsupported file: schema "${payload.schema || 'unknown'}". This app loads "finite-well-particle-export/v1" or "finite-well-comparison-export/v1" files.`);
      return false;
    }
    const m = payload.meta || {};
    if (m.n_position_bins !== NBINS_X || m.n_energy_bins !== NBINS_E) {
      alert('File was created with different bin counts. Load aborted.');
      return false;
    }
    if (typeof m.v0 !== 'number') {
      alert('File is missing the V₀ parameter. Load aborted.');
      return false;
    }

    // Suppress the V₀-change reset effect so we don't wipe the
    // histograms we're about to restore. Cleared on a microtask.
    isLoadingRef.current = true;
    setRunning(false);

    // Restore primary parameters.
    if (typeof m.energy_setting === 'number') setEnergy(m.energy_setting);
    if (typeof m.gamma_internal === 'number') setGammaInternal(m.gamma_internal);
    if (typeof m.instrument_sigma === 'number') setSigma(m.instrument_sigma);
    setV0(m.v0);

    // Reconstruct counts from density × total × binWidth.
    const xBinW = X_PLOT_RANGE / NBINS_X;
    const loadedEHistMax = m.energy_axis_max;
    const eBinW = loadedEHistMax / NBINS_E;
    const cPosTotal = m.classical_measurements || 0;
    const qPosTotal = m.quantum_position_measurements || 0;
    const qEnTotal = m.quantum_energy_measurements || 0;

    const cPos = new Float64Array(NBINS_X);
    const qPos = new Float64Array(NBINS_X);
    const cEn  = new Float64Array(NBINS_E);
    const qEn  = new Float64Array(NBINS_E);

    for (const b of payload.position_histogram?.bins || []) {
      if (b.bin_index >= 0 && b.bin_index < NBINS_X) {
        cPos[b.bin_index] = (b.classical || 0) * cPosTotal * xBinW;
        qPos[b.bin_index] = (b.quantum   || 0) * qPosTotal * xBinW;
      }
    }
    for (const b of payload.energy_histogram?.bins || []) {
      if (b.bin_index >= 0 && b.bin_index < NBINS_E) {
        cEn[b.bin_index] = (b.classical || 0) * cPosTotal * eBinW;
        qEn[b.bin_index] = (b.quantum   || 0) * qEnTotal  * eBinW;
      }
    }

    xHistRef.current = cPos;
    qXHistRef.current = qPos;
    eHistRef.current = cEn;
    qEHistRef.current = qEn;

    countRef.current = cPosTotal;
    qXCountRef.current = qPosTotal;
    qECountRef.current = qEnTotal;
    qIonisedCountRef.current = m.quantum_ionisation_events || 0;
    qXOutsideCountRef.current = m.quantum_outside_box_events || 0;

    xSumRef.current = (m.classical_mean_x != null) ? m.classical_mean_x * cPosTotal : 0;
    eSumRef.current = (m.classical_mean_E != null) ? m.classical_mean_E * cPosTotal : 0;
    qXSumRef.current = (m.quantum_mean_x != null) ? m.quantum_mean_x * qPosTotal : 0;
    qESumRef.current = (m.quantum_mean_E != null) ? m.quantum_mean_E * qEnTotal : 0;

    recentXRef.current  = [];
    recentERef.current  = [];
    qRecentXRef.current = [];
    qRecentERef.current = [];

    const ceiled = Math.ceil((cPosTotal + 1) / pauseIncrement) * pauseIncrement;
    nextPauseRef.current = Math.max(pauseIncrement, ceiled);

    setTick((t) => t + 1);
    setTimeout(() => { isLoadingRef.current = false; }, 0);
    return true;
  }

  function readFileAndLoad(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        applyLoadedState(payload);
      } catch (e) {
        alert(`Could not parse file: ${e.message}`);
      }
    };
    reader.onerror = () => alert('Could not read file.');
    reader.readAsText(file);
  }

  // Cross-import: pull one side of a tab 2 pair file into tab 1.
  // Tab 2's per-side state is in real units (nm / eV / m_e); tab 1
  // works in engine units, so we convert via E* of the source side.
  // Histograms aren't transferred — cross-import resets measurements
  // so a fresh run accumulates against the new parameters.
  function applyTab2SideToTab1(payload, side) {
    const m = (side === 'A' ? payload.meta.A : payload.meta.B);
    if (!m) { alert(`Selected file is missing System ${side}.`); return; }
    const eStarOfSide = (typeof m.e_star_ev === 'number')
      ? m.e_star_ev
      : (E_STAR_REF_EV / (m.m_eff_me * m.length_nm * m.length_nm));
    const v0Engine    = Math.round(m.v0_ev / eStarOfSide);
    const v0Clamped   = Math.max(V0_MIN, Math.min(V0_MAX, v0Engine));
    const eClamped    = Math.max(E_SLIDER_MIN, Math.min(eAxisMaxForV0(v0Clamped), Math.round(m.energy_ev / eStarOfSide)));
    const gInt        = Math.max(GAMMA_INTERNAL_MIN, Math.min(GAMMA_INTERNAL_MAX, Math.round(m.gamma_ev / eStarOfSide) + 1));
    const sigEngine   = Math.max(SIGMA_MIN, Math.min(SIGMA_MAX, Math.round(m.sigma_ev / eStarOfSide)));
    setV0(v0Clamped);
    setEnergy(eClamped);
    setGammaInternal(gInt);
    setSigma(sigEngine);
    // Reset measurement state so the new parameters get clean stats.
    handleStop();
    setPendingCrossImport(null);
  }

  function handleFileChosen(file) {
    if (!file) return;
    if (count > 0 || qECount > 0) {
      setPendingLoadFile(file);
    } else {
      readFileAndLoad(file);
    }
  }

  // Close the save menu on Escape.
  useEffect(() => {
    if (!saveMenuOpen) return;
    function onKey(e) { if (e.key === 'Escape') setSaveMenuOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveMenuOpen]);

  // -------------------------------------------------------------
  // Render-time data
  // -------------------------------------------------------------
  // Convert raw histogram counts to probability density so that the
  // bars and the theory overlay live on the same scale (matched to
  // the sibling infinite-well app's convention).
  // Density[i] = count[i] / (total × bin_width). Integrates to 1 over
  // the support, and |c_n|² / bin_width is directly comparable as a
  // theoretical density at the eigenvalue position.
  const xBinWidth = X_PLOT_RANGE / NBINS_X;
  const eBinWidth = eHistMax / NBINS_E;
  const count = countRef.current;
  const qXCount = qXCountRef.current;
  const qECount = qECountRef.current;
  const xHistDensity  = count   > 0 ? Array.from(xHistRef.current).map((c) => c / (count   * xBinWidth)) : Array(NBINS_X).fill(0);
  const eHistDensity  = count   > 0 ? Array.from(eHistRef.current).map((c) => c / (count   * eBinWidth)) : Array(NBINS_E).fill(0);
  const qXHistDensity = qXCount > 0 ? Array.from(qXHistRef.current).map((c) => c / (qXCount * xBinWidth)) : Array(NBINS_X).fill(0);
  const qEHistDensity = qECount > 0 ? Array.from(qEHistRef.current).map((c) => c / (qECount * eBinWidth)) : Array(NBINS_E).fill(0);

  const xMean = count > 0 ? xSumRef.current / count : null;
  const eMean = count > 0 ? eSumRef.current / count : null;
  // Separate counts on the quantum side: continuum events register an
  // energy measurement only, so the position count and energy count
  // diverge once Γ widens enough for the Lorentzian to spill above V0.
  const qxMean  = qXCount > 0 ? qXSumRef.current / qXCount : null;
  const qeMean  = qECount > 0 ? qESumRef.current / qECount : null;
  const qIonisedFrac = qECount > 0 ? qIonisedCountRef.current / qECount : 0;
  const qLeakFrac    = qXCount > 0 ? qXOutsideCountRef.current / qXCount : 0;

  // Theoretical position density curves for the "show theory" overlay.
  //   Classical: uniform inside the well (1/L), zero outside. A
  //     well-mixed ballistic particle samples every point in [0, L]
  //     with equal probability, so this top-hat is the limit of the
  //     position histogram.
  //   Quantum: Σ |c_n|² |ψ_n(x)|². The static envelope that the
  //     time-evolving |ψ(x, t)|² averages to and that the position
  //     histogram converges to.
  const cPosTheoryDensity = useMemo(() => {
    const N = 240;
    const arr = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = X_PLOT_MIN + (X_PLOT_RANGE * i) / (N - 1);
      const d = (x >= 0 && x <= L) ? 1 / L : 0;
      arr[i] = { x, d };
    }
    return arr;
  }, []);
  const qPosTheoryDensity = useMemo(() => {
    if (!states.length) return null;
    const N = 240;
    const arr = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = X_PLOT_MIN + (X_PLOT_RANGE * i) / (N - 1);
      let d = 0;
      for (let k = 0; k < states.length; k++) {
        const psi = finiteWellPsi(states[k], x);
        d += probs[k] * psi * psi;
      }
      arr[i] = { x, d };
    }
    return arr;
  }, [states, probs]);

  // Theoretical energy density curves for the "show theory" overlay.
  // The histogram converges to two separable contributions:
  //   bound:     F(V₀) × Σ_n |c_n|² × Gaussian(E − E_n, σ)
  //   continuum: ∫_{V₀}^∞ L(E′) × Gaussian(E − E′, σ) dE′
  // where F(V₀) is the Lorentzian CDF at V₀ — the probability that
  // a given preparation event lands in the bound region — and L is
  // the un-truncated Lorentzian centred on E_set with width Γ.
  //
  // σ_eff is bounded below at one bin width / √(2π) so a strict σ=0
  // still produces a finite-height bound peak whose area equals |c_n|².
  // The continuum term collapses to zero when Γ is sharp and E_set
  // sits well below V₀ (F(V₀) ≈ 1).
  //
  // The classical theory is a single Gaussian of width σ centred on
  // the slider energy — the classical particle reports the slider
  // value with instrument noise. Classical above V₀ pauses the
  // simulation, so no continuum is needed on that side.
  const cEnergyTheoryDensity = useMemo(() => {
    const N = 240;
    const arr = new Array(N);
    const eBinW = eHistMax / NBINS_E;
    const sigmaEff = Math.max(sigma, eBinW / Math.sqrt(2 * Math.PI));
    const norm = 1 / (sigmaEff * Math.sqrt(2 * Math.PI));
    const twoSig2 = 2 * sigmaEff * sigmaEff;
    for (let i = 0; i < N; i++) {
      const E = (eHistMax * i) / (N - 1);
      const dE = E - energy;
      arr[i] = { E, d: norm * Math.exp(-(dE * dE) / twoSig2) };
    }
    return { bound: arr, continuum: null };
  }, [energy, sigma, eHistMax]);
  const qEnergyTheoryDensity = useMemo(() => {
    if (!states.length) return null;
    const N = 240;
    const eBinW = eHistMax / NBINS_E;
    const sigmaEff = Math.max(sigma, eBinW / Math.sqrt(2 * Math.PI));
    const norm = 1 / (sigmaEff * Math.sqrt(2 * Math.PI));
    const twoSig2 = 2 * sigmaEff * sigmaEff;
    const gamHalf = gammaInternal / 2;
    const Fbound = lorentzCDF(V0, energy, gammaInternal);

    // Pre-compute Lorentzian × dE′ values on a uniform grid above V₀
    // for the continuum integration. Extend a few Γ past the energy
    // axis so the Gaussian-convolved tail is captured.
    const NC = 200;
    const Emax = Math.max(eHistMax * 1.5, energy + 10 * gammaInternal, V0 + 10 * gammaInternal);
    const dEc = (Emax - V0) / NC;
    const lorW = new Float64Array(NC);
    const Ep = new Float64Array(NC);
    for (let j = 0; j < NC; j++) {
      Ep[j] = V0 + (j + 0.5) * dEc;
      const dEp = Ep[j] - energy;
      lorW[j] = (gamHalf / Math.PI) / (dEp * dEp + gamHalf * gamHalf) * dEc;
    }

    const bound = new Array(N);
    const continuum = new Array(N);
    for (let i = 0; i < N; i++) {
      const E = (eHistMax * i) / (N - 1);

      // Bound = F(V₀) × Σ_n |c_n|² × Gauss(E − E_n, σ_eff)
      let dB = 0;
      for (let k = 0; k < states.length; k++) {
        const dE = E - states[k].E;
        dB += probs[k] * norm * Math.exp(-(dE * dE) / twoSig2);
      }
      bound[i] = { E, d: Fbound * dB };

      // Continuum = ∫_{V₀}^∞ L(E′) × Gauss(E − E′, σ_eff) dE′
      let dC = 0;
      for (let j = 0; j < NC; j++) {
        const dEp = E - Ep[j];
        dC += lorW[j] * norm * Math.exp(-(dEp * dEp) / twoSig2);
      }
      continuum[i] = { E, d: dC };
    }
    return { bound, continuum };
  }, [states, probs, sigma, eHistMax, V0, energy, gammaInternal]);

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <div style={{ background: COL.bg, color: COL.ink, fontFamily: FONTS.body, minHeight: '100vh', padding: '20px 24px 32px' }}>
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          pauseIncrement={pauseIncrement} setPauseIncrement={setPauseIncrement}
          maxBoundCap={maxBoundCap}       setMaxBoundCap={setMaxBoundCap}
          waveTimeMult={waveTimeMult}     setWaveTimeMult={setWaveTimeMult}
          randomSeed={randomSeed}         setRandomSeed={setRandomSeed}
          language={language}             setLanguage={setLanguage}
          showNotes={showNotes}           setShowNotes={setShowNotes}
          col={COL}
          fonts={FONTS}
        />
      )}
      {pendingLoadFile && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setPendingLoadFile(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COL.panel, border: `1px solid ${COL.rule}`, borderRadius: 6,
              padding: '20px 24px', maxWidth: 460,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontFamily: FONTS.body,
            }}
          >
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontStyle: 'italic', marginBottom: 10 }}>
              Discard current data?
            </div>
            <div style={{ color: COL.inkDim, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              Loading{' '}
              <span style={{ color: COL.ink, fontFamily: FONTS.mono, fontSize: 13 }}>{pendingLoadFile.name}</span>
              {' '}will replace your current simulation state
              {' '}({count.toLocaleString()} classical, {qECount.toLocaleString()} quantum measurements).
              {' '}Save first?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingLoadFile(null)}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.inkDim,
                  border: `1px solid ${COL.rule}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  const f = pendingLoadFile;
                  setPendingLoadFile(null);
                  readFileAndLoad(f);
                }}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.danger,
                  border: `1px solid ${COL.danger}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Discard and load</button>
              <button
                onClick={() => {
                  exportJSON();
                  const f = pendingLoadFile;
                  setPendingLoadFile(null);
                  readFileAndLoad(f);
                }}
                style={{
                  padding: '8px 14px', background: COL.quantum, color: '#0e1320',
                  border: `1px solid ${COL.quantum}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Save first, then load</button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-tab import — user picks which side of a tab 2 pair
          file to pull into this single-system tab. */}
      {pendingCrossImport && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setPendingCrossImport(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COL.panel, border: `1px solid ${COL.rule}`, borderRadius: 6,
              padding: '20px 24px', maxWidth: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontFamily: FONTS.body,
            }}
          >
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontStyle: 'italic', marginBottom: 10 }}>
              Comparison file — pick one side
            </div>
            <div style={{ color: COL.inkDim, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              This file is a tab 2 dual-system snapshot. This tab simulates
              a single system, so pick which side to import (the histograms
              won't be transferred — only the parameters; you'll need to
              re-run to accumulate measurements).
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPendingCrossImport(null)}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.inkDim,
                  border: `1px solid ${COL.rule}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Cancel</button>
              <button
                onClick={() => applyTab2SideToTab1(pendingCrossImport, 'A')}
                style={{
                  padding: '8px 18px', background: COL.accent, color: '#0e1320',
                  border: `1px solid ${COL.accent}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Import System A</button>
              <button
                onClick={() => applyTab2SideToTab1(pendingCrossImport, 'B')}
                style={{
                  padding: '8px 18px', background: COL.accent, color: '#0e1320',
                  border: `1px solid ${COL.accent}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Import System B</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* ===== HEADER ===== */}
        <header style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: FONTS.display, fontWeight: 400, fontSize: 38, margin: 0, padding: 0,
            lineHeight: 1, letterSpacing: -0.5, fontStyle: 'italic', whiteSpace: 'nowrap',
          }}>
            Particle, Quo Vadis. Redux
          </h1>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 13, color: COL.inkDim, letterSpacing: 0.5,
            lineHeight: 1.4, paddingBottom: 2,
          }}>
            Classical and quantum electrons in a finite well
          </div>
        </header>

        <TabBar activeTab={activeTab} onChange={onChangeTab} />

        {/* ===== TOP CONTROLS =====
             Transport bar full width, then a parameters block + energy
             slider side-by-side. Same layout as Tab 2 for visual parity. */}

        {/* Transport + measurement count — full width. */}
        <div style={{ ...panelStyle(), padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <TransportButton kind="playpause" active={running} onClick={running ? handlePause : handlePlay} disabled={isIonised} colour={isIonised ? COL.inkDim : COL.quantum} bg={COL.panel} />
                <TransportButton kind="stop"      active={false}   onClick={handleStop} colour={COL.danger} bg={COL.panel} />

                {/* Save dropdown — only enabled once there's data. */}
                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <TransportButton
                    kind="save"
                    active={saveMenuOpen}
                    onClick={() => {
                      if (count === 0 && qECount === 0) return;
                      setSaveMenuOpen((o) => !o);
                    }}
                    colour={count > 0 || qECount > 0 ? COL.quantum : COL.inkDim}
                    bg={COL.panel}
                  />
                  {saveMenuOpen && (
                    <div
                      style={{
                        position: 'absolute', top: '110%', left: '50%',
                        transform: 'translateX(-50%)',
                        background: COL.panel, border: `1px solid ${COL.rule}`,
                        borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 10, display: 'flex', flexDirection: 'column',
                        minWidth: 96, overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => { exportCSV();  setSaveMenuOpen(false); }}
                        style={{
                          padding: '8px 14px', background: 'transparent', color: COL.ink,
                          border: 'none', cursor: 'pointer',
                          fontFamily: FONTS.mono, fontSize: 13,
                          textAlign: 'left', letterSpacing: 0.3,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = COL.rule; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >CSV</button>
                      <button
                        onClick={() => { exportJSON(); setSaveMenuOpen(false); }}
                        style={{
                          padding: '8px 14px', background: 'transparent', color: COL.ink,
                          border: 'none', cursor: 'pointer',
                          fontFamily: FONTS.mono, fontSize: 13,
                          textAlign: 'left', letterSpacing: 0.3,
                          borderTop: `1px solid ${COL.rule}`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = COL.rule; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >JSON</button>
                    </div>
                  )}
                </div>

                {/* Load triggers a hidden file picker. */}
                <TransportButton
                  kind="load"
                  active={false}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  colour={COL.quantum}
                  bg={COL.panel}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    handleFileChosen(f);
                    e.target.value = '';
                  }}
                />

                {/* Settings — gear icon, opens a modal. */}
                <TransportButton
                  kind="settings"
                  active={settingsOpen}
                  onClick={() => setSettingsOpen((o) => !o)}
                  colour={COL.inkDim}
                  bg={COL.panel}
                />
              </div>
              {/* Stacked display toggles — two 22-px rows fit the 46-px
                  transport button height. Same layout as tab 2 for
                  visual parity. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CheckboxRow
                  checked={showTheory}
                  onChange={() => setShowTheory((b) => !b)}
                  label="Show theory"
                  accent={COL.quantum}
                  inkDim={COL.inkDim} rule={COL.rule} ink={COL.ink} mono={FONTS.mono}
                />
                <CheckboxRow
                  checked={showEigen}
                  onChange={() => setShowEigen((b) => !b)}
                  label="Show eigenstates"
                  accent={COL.quantum}
                  inkDim={COL.inkDim} rule={COL.rule} ink={COL.ink} mono={FONTS.mono}
                />
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', fontFamily: FONTS.mono, lineHeight: 1.1 }}>
                <div style={{ fontSize: 22, color: COL.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: COL.inkDim, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>
                  measurements
                </div>
              </div>
        </div>{/* end transport panel */}

        {/* Parameters block (left) + energy slider (right), side-by-side
            at equal heights so the V₀ / Γ / σ rows spread to match the
            slider's vertical extent. Mirrors each Tab 2 system panel. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 14, alignItems: 'stretch' }}>
          <div style={{ ...panelStyle(), padding: '10px 16px', display: 'flex', flexDirection: 'column' }}>
            {/* Editable controls grouped at the top, tightly stacked. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <V0Slider
                label="Well depth V₀"
                tooltip="Depth of the finite well (units of ħ²/(2mL²)). Deeper wells contain more bound states; the slider energy and energy axis adapt."
                value={V0}
                onChange={(v) => setV0(Math.round(v))}
                min={V0_MIN}
                max={V0_MAX}
                step={5}
                accent={COL.ionised}
                rule={COL.rule} ink={COL.ink} inkDim={COL.inkDim} mono={FONTS.mono}
                decimals={0}
              />
              <PreferenceNumberRow
                label="Γ (preparation width)"
                value={gammaInternal}
                onChange={setGammaInternal}
                min={GAMMA_INTERNAL_MIN}
                max={GAMMA_INTERNAL_MAX}
                accent={COL.quantum}
                ink={COL.ink} inkDim={COL.inkDim} rule={COL.rule} mono={FONTS.mono}
                displayOffset={-1}
              />
              <PreferenceNumberRow
                label="σ (instrument resolution)"
                value={sigma}
                onChange={setSigma}
                min={SIGMA_MIN}
                max={SIGMA_MAX}
                accent={COL.accent}
                ink={COL.ink} inkDim={COL.inkDim} rule={COL.rule} mono={FONTS.mono}
              />
            </div>

            {/* Quantum bound states — read-only table below the
                controls. flex: 1 lets it fill remaining height;
                space-around inside the row list spreads the n=k rows
                evenly across whatever vertical room is left, no matter
                how many states the current V₀ supports. */}
            <div style={{
              marginTop: 12, flex: 1,
              display: 'flex', flexDirection: 'column',
              fontFamily: FONTS.mono, fontSize: 12, color: COL.inkDim,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <div style={{ marginBottom: 4 }}>
                Quantum bound states (<span style={{ color: COL.ink }}>{states.length}</span>)
              </div>
              {states.length === 0 ? (
                <div style={{ fontStyle: 'italic', paddingLeft: 8 }}>
                  no bound states at this depth
                </div>
              ) : (() => {
                // Column template — the |c_n|² column (and its bar) is
                // only present when Show eigenstates is on. Without it
                // the table collapses to 5 columns and the row widths
                // tighten naturally. Born probability is a "what the
                // current preparation looks like" indicator and reads
                // as eigenstate-specific information, so it's gated on
                // the same toggle that drives the eigenstate ticks.
                const cols = showEigen
                  ? '18px 46px 46px 38px 46px 1fr'
                  : '18px 46px 46px 38px 46px';
                const headerCellStyle = {
                  fontSize: 10, color: COL.inkDim, letterSpacing: 0.5,
                };
                return (
                  <>
                    <div style={{
                      display: 'grid', gridTemplateColumns: cols,
                      columnGap: 8, alignItems: 'baseline',
                      paddingLeft: 8, marginBottom: 4,
                    }}>
                      <div style={headerCellStyle}><i>n</i></div>
                      <div style={headerCellStyle} title="Energy in engine units (ℏ²/2mL²)"><i>E</i><sub>n</sub></div>
                      <div style={headerCellStyle} title="Wavefunction parity about the centre of the well">parity</div>
                      <div style={headerCellStyle} title="Wavenumber inside the well, √E_n">k</div>
                      <div style={headerCellStyle} title="Wavefunction decay length outside the well, 1 / √(V₀ − E_n)">1/κ</div>
                      {showEigen && (
                        <div style={headerCellStyle} title="Born probability — fraction of the current preparation in this state">|c<sub>n</sub>|²</div>
                      )}
                    </div>
                    <div style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      justifyContent: 'space-around', paddingLeft: 8,
                    }}>
                      {states.map((s, i) => {
                        const p = (probs && probs[i]) || 0;
                        const kInv = s.kappa > 0 ? (1 / s.kappa).toFixed(2) : '∞';
                        const pct = p >= 0.001
                          ? (p * 100).toFixed(p < 0.1 ? 1 : 0) + '%'
                          : (p > 0 ? '<0.1%' : '—');
                        return (
                          <div key={i} style={{
                            display: 'grid', gridTemplateColumns: cols,
                            columnGap: 8, alignItems: 'center',
                          }}>
                            <div>{i + 1}</div>
                            <div style={{ color: COL.ink }}>{s.E.toFixed(1)}</div>
                            <div>{s.parity}</div>
                            <div>{s.k.toFixed(1)}</div>
                            <div>{kInv}</div>
                            {showEigen && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <div style={{
                                  flex: 1, height: 4, background: COL.rule,
                                  borderRadius: 2, overflow: 'hidden', minWidth: 24,
                                }}>
                                  <div style={{
                                    width: Math.max(0, Math.min(100, p * 100)) + '%',
                                    height: '100%', background: COL.quantum,
                                    transition: 'width 0.15s',
                                  }} />
                                </div>
                                <div style={{
                                  width: 38, textAlign: 'right', fontSize: 10,
                                  color: p >= 0.01 ? COL.ink : COL.inkDim,
                                }}>
                                  {pct}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Energy slider (vertical, matched to Tab 2). */}
          <div style={{ ...panelStyle(), padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VerticalSlider
              label="Energy"
              value={energy}
              onChange={setEnergy}
              min={E_SLIDER_MIN}
              max={eSliderMax}
              accent={COL.accent}
              ionisedAccent={COL.ionised}
              rule={COL.rule}
              inkDim={COL.inkDim}
              ink={COL.ink}
              mono={FONTS.mono}
              v0={V0}
              decimals={0}
              ticks={showEigen ? states.map((s) => s.E) : null}
              onTickClick={showEigen ? (E) => setEnergy(Math.round(E)) : null}
              tickAccent={COL.quantum}
              trackHeight={140}
              v0LabelSide="right"
            />
          </div>
        </div>

        {/* ===== MAIN GRID — Classical | Quantum ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* CLASSICAL */}
          <section style={{ ...panelStyle(), padding: '10px 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PanelHeader tag="Classical" color={COL.classical} />

            <ParticleView
              x={xRef.current}
              energy={energy}
              V0={V0}
              isIonised={isIonised}
              bouncePhase={bouncePhaseRef.current}
              bouncePeakFrac={bouncePeakFracRef.current}
              recentMeasurements={recentXRef.current}
              col={COL.classical}
              wall={COL.ink}
              bg={COL.panel}
              ionisedCol={COL.ionised}
              mono={FONTS.mono}
            />

            <PositionHistogram
              hist={xHistDensity}
              recentMarkers={recentXRef.current}
              col={COL.classical}
              ink={COL.ink}
              inkDim={COL.inkDim}
              rule={COL.rule}
              mono={FONTS.mono}
              meanX={xMean}
              isIonised={isIonised}
              ionisedCol={COL.ionised}
              leakFrac={0}
              overlay={showTheory ? cPosTheoryDensity : null}
            />

            <EnergyHistogram
              hist={eHistDensity}
              recentMarkers={recentERef.current}
              col={COL.classical}
              ink={COL.ink}
              inkDim={COL.inkDim}
              rule={COL.rule}
              mono={FONTS.mono}
              eSet={energy}
              meanE={eMean}
              v0={V0}
              eHistMax={eHistMax}
              ionisedCol={COL.ionised}
              accent={COL.accent}
              ionisedFrac={0}
              eigenStates={showEigen ? states : null}
              theoryCurve={showTheory ? cEnergyTheoryDensity : null}
              logY={logEnergy}
              onToggleLogY={() => setLogEnergy((b) => !b)}
            />
          </section>

          {/* QUANTUM */}
          <section style={{ ...panelStyle(), padding: '10px 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <PanelHeader tag="Quantum" color={COL.quantum} />
              <SegmentedToggle
                value={psiMode}
                onChange={setPsiMode}
                options={[
                  { value: 'density',      label: '|ψ|²' },
                  { value: 'wavefunction', label: 'ψ' },
                  { value: 'off',          label: 'Off' },
                ]}
                accent={COL.quantum}
                inkDim={COL.inkDim}
                rule={COL.rule}
                mono={FONTS.mono}
              />
            </div>

            <WavefunctionView
              states={states}
              probs={probs}
              t={tRef.current}
              isIonised={isIonised}
              psiMode={psiMode}
              latestX={qXLatestRef.current}
              recentMeasurements={qRecentXRef.current}
              col={COL.quantum}
              wall={COL.ink}
              bg={COL.panel}
              ionisedCol={COL.ionised}
              mono={FONTS.mono}
            />

            <PositionHistogram
              hist={qXHistDensity}
              recentMarkers={qRecentXRef.current}
              col={COL.quantum}
              ink={COL.ink}
              inkDim={COL.inkDim}
              rule={COL.rule}
              mono={FONTS.mono}
              meanX={qxMean}
              isIonised={isIonised}
              ionisedCol={COL.ionised}
              leakFrac={qLeakFrac}
              overlay={showTheory ? qPosTheoryDensity : null}
            />

            <EnergyHistogram
              hist={qEHistDensity}
              recentMarkers={qRecentERef.current}
              col={COL.quantum}
              ink={COL.ink}
              inkDim={COL.inkDim}
              rule={COL.rule}
              mono={FONTS.mono}
              eSet={energy}
              meanE={qeMean}
              v0={V0}
              eHistMax={eHistMax}
              ionisedCol={COL.ionised}
              accent={COL.accent}
              ionisedFrac={qIonisedFrac}
              eigenStates={showEigen ? states : null}
              theoryCurve={showTheory ? qEnergyTheoryDensity : null}
              logY={logEnergy}
              onToggleLogY={() => setLogEnergy((b) => !b)}
            />
          </section>
        </div>

        {/* ===== Notes (adaptive chemistry framing) — collapsible. ===== */}
        <CollapsibleSection
          title="What you're looking at"
          expanded={showNotes}
          onToggle={() => setShowNotes((v) => !v)}
          mono={FONTS.mono} inkDim={COL.inkDim}
        >
          <Notes
            energy={energy}
            V0={V0}
            states={states}
            probs={probs}
            gammaDisplayed={gammaInternal - 1}
            sigma={sigma}
            isIonised={isIonised}
            qIonisedFrac={qIonisedFrac}
            qLeakFrac={qLeakFrac}
            qXCount={qXCount}
            qECount={qECount}
            qxMean={qxMean}
            qeMean={qeMean}
            mono={FONTS.mono}
            display={FONTS.display}
            body={FONTS.body}
            ink={COL.ink}
            inkDim={COL.inkDim}
            cCol={COL.classical}
            qCol={COL.quantum}
            aCol={COL.accent}
            ionisedCol={COL.ionised}
          />
        </CollapsibleSection>

        <footer style={{
          marginTop: 28, fontSize: 13, color: COL.inkDim,
          fontFamily: FONTS.mono, textAlign: 'center', letterSpacing: 1,
        }}>
          Bound states · Wavefunction leakage · Photoionisation · Lorentzian state preparation · finite square well
        </footer>

      </div>
    </div>
  );
}

// =============================================================
// SUBCOMPONENTS
// =============================================================

// ---------- Panel header (small caps tag, optional title) ----------
function PanelHeader({ tag, color }) {
  return (
    <div style={{
      fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 2,
      color, textTransform: 'uppercase', fontWeight: 600,
    }}>
      {tag}
    </div>
  );
}

// ---------- Transport buttons (Play / Pause / Stop) ----------
// Round, 46px, filled when active, with a 2px coloured border. Matches the
// sibling app's button language.
function TransportButton({ kind, active, onClick, colour, bg, disabled = false }) {
  const SIZE = 46;
  const fill   = active ? bg : colour;
  const bgFill = active ? colour : bg;
  // 'playpause' is a single toggle: when active (i.e. running) the
  // button reads "pause" because clicking it pauses; when inactive
  // it reads "play". Replaces the older split Play / Pause pair so
  // the transport bar matches a standard media-player toggle.
  const title = kind === 'play'      ? 'Play'
              : kind === 'pause'     ? 'Pause'
              : kind === 'playpause' ? (active ? 'Pause' : 'Play')
              : kind === 'stop'      ? 'Stop & reset'
              : kind === 'save'      ? 'Save data (CSV or JSON)'
              : kind === 'load'      ? 'Load saved state'
              : kind === 'settings'  ? 'Settings'
              : '';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        background: bgFill, border: `2px solid ${colour}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer', padding: 0,
        flexShrink: 0, opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
      }}
    >
      <svg width={22} height={22} viewBox="0 0 20 20">
        {kind === 'play'  && <polygon points="6,4 6,16 16,10" fill={fill} />}
        {kind === 'pause' && (
          <g fill={fill}>
            <rect x={5}  y={4} width={4} height={12} />
            <rect x={11} y={4} width={4} height={12} />
          </g>
        )}
        {kind === 'playpause' && (active ? (
          <g fill={fill}>
            <rect x={5}  y={4} width={4} height={12} />
            <rect x={11} y={4} width={4} height={12} />
          </g>
        ) : (
          <polygon points="6,4 6,16 16,10" fill={fill} />
        ))}
        {kind === 'stop'  && (
          <g>
            <rect x={4} y={4} width={12} height={12} fill={colour} />
            <g transform="translate(4, 4) scale(0.5)" stroke="#0e1320" strokeWidth={3}
              fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </g>
          </g>
        )}
        {kind === 'save' && (
          <g fill="none" stroke={fill} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {/* download tray: down arrow into a base */}
            <line x1={10} y1={3} x2={10} y2={12} />
            <polyline points="6,8 10,12 14,8" />
            <line x1={4} y1={16} x2={16} y2={16} />
          </g>
        )}
        {kind === 'load' && (
          <g fill="none" stroke={fill} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {/* upload tray: up arrow out of a base */}
            <line x1={10} y1={12} x2={10} y2={3} />
            <polyline points="6,7 10,3 14,7" />
            <line x1={4} y1={16} x2={16} y2={16} />
          </g>
        )}
        {kind === 'settings' && (() => {
          // 6-tooth gear, programmatically built. 24 vertices: alternating
          // outer / outer / inner / inner around the perimeter, giving each
          // tooth a flat top and rounded valleys.
          const cx = 10, cy = 10;
          const outerR = 8, innerR = 5.5;
          const teeth = 6;
          const N = teeth * 4;
          const pts = [];
          for (let i = 0; i < N; i++) {
            const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
            const phase = i % 4;
            const r = phase < 2 ? outerR : innerR;
            pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
          }
          const gearPath = `M${pts.join(' L')} Z`;
          return (
            <g stroke={fill} strokeWidth={1.4} fill="none" strokeLinejoin="round">
              <path d={gearPath} />
              <circle cx={cx} cy={cy} r={2.4} />
            </g>
          );
        })()}
      </svg>
    </button>
  );
}

// ---------- Checkbox row (full-width, used in the preferences panel) ----------
// Mirrors PQV's CheckboxRow: label on the left, checkmark cell on the right.
function CheckboxRow({ checked, onChange, label, accent, inkDim, rule, ink, mono }) {
  // onClick on the outer label so clicking the text toggles the box
  // too. Onclick is only on one element (no inner handler on the box
  // span) to avoid double-firing via event bubbling.
  return (
    <label
      onClick={onChange}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14,
        cursor: 'pointer', userSelect: 'none',
        fontFamily: mono, fontSize: 14, color: ink || '#e9e4d4', height: 22,
      }}
    >
      <span style={{ color: checked ? (ink || '#e9e4d4') : inkDim, letterSpacing: 0.3 }}>{label}</span>
      <span
        style={{
          width: 20, height: 20, borderRadius: 3,
          border: `1.5px solid ${checked ? accent : rule}`,
          background: checked ? accent : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s',
        }}
      >
        {checked && (
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M2,6 L5,9 L10,3" fill="none" stroke="#0e1320" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </label>
  );
}

// ---------- Preference number row (mixed-case label + ± buttons + editable value) ----------
// Mirrors PQV's PreferenceNumberRow widget. Used for Γ (spectral) and σ
// (instrument) where integer steps are the natural granularity and a
// horizontal slider is overkill. `displayOffset` lets us store an
// internal value with a different offset to the display (Γ stores +1
// internally to avoid the Lorentzian singularity at exact eigenvalues).
function PreferenceNumberRow({ label, value, onChange, min, max, accent, ink, inkDim, rule, mono, displayOffset = 0 }) {
  const displayed = value + displayOffset;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(displayed));
  useEffect(() => { if (!editing) setDraft(String(value + displayOffset)); }, [value, displayOffset, editing]);
  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, Math.round(n - displayOffset))));
    setEditing(false);
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      userSelect: 'none', fontFamily: mono, fontSize: 14, color: ink, height: 22,
    }}>
      <span style={{ color: ink, letterSpacing: 0.3 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 22, height: 22, border: `1.5px solid ${rule}`,
            background: 'transparent', color: inkDim,
            fontFamily: mono, fontSize: 15, cursor: 'pointer', borderRadius: 3,
            padding: 0, lineHeight: 1, fontWeight: 600,
          }}
        >−</button>
        {editing ? (
          <input
            autoFocus type="text" value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(String(value + displayOffset)); } }}
            style={{
              width: 40, textAlign: 'center', background: 'transparent', color: accent,
              border: `1.5px solid ${accent}`, padding: '2px 2px',
              fontFamily: mono, fontSize: 15, fontVariantNumeric: 'tabular-nums', borderRadius: 3,
            }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              width: 40, textAlign: 'center', color: accent,
              fontFamily: mono, fontSize: 15, fontVariantNumeric: 'tabular-nums',
              padding: '2px 2px', border: `1.5px solid transparent`,
              cursor: 'text', borderRadius: 3, fontWeight: 600,
            }}
          >
            {displayed}
          </div>
        )}
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 22, height: 22, border: `1.5px solid ${rule}`,
            background: 'transparent', color: inkDim,
            fontFamily: mono, fontSize: 15, cursor: 'pointer', borderRadius: 3,
            padding: 0, lineHeight: 1, fontWeight: 600,
          }}
        >+</button>
      </div>
    </div>
  );
}

// ---------- Segmented toggle (small two-or-more option pill) ----------
function SegmentedToggle({ value, onChange, options, accent, inkDim, rule, mono }) {
  return (
    <div style={{
      display: 'inline-flex', border: `1px solid ${rule}`, borderRadius: 3,
      overflow: 'hidden', fontFamily: mono, fontSize: 11,
    }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '3px 9px',
              background: active ? accent : 'transparent',
              color: active ? '#0e1320' : inkDim,
              border: 'none',
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              letterSpacing: 0.3,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Generic broadening slider (used for Γ and σ) ----------
// Horizontal slider with an inline label and numeric readout. Used for:
//   - Γ (preparation width of the state-preparation Lorentzian);
//   - σ (Gaussian instrument resolution added per energy measurement).
// At Γ = 0 the prepared state is sharpest available (closest to a
// single eigenstate); at σ = 0 each reported measurement is exact.
// ---------- V₀ slider (horizontal range, mixed-case label) ----------
// Kept as a slider (not a ± row) because V₀ is a primary parameter that
// changes the spectrum and is meaningful to drag continuously, unlike
// Γ / σ which are preference-style integer adjustments.
function V0Slider({ label, tooltip, value, onChange, min, max, step, accent, rule, ink, inkDim, mono, decimals = 0, labelMinWidth = 110, valueWidth = 40, fontSize = 14 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} title={tooltip || ''}>
      <div style={{
        fontFamily: mono, fontSize, color: ink || '#e9e4d4',
        letterSpacing: 0.3, minWidth: labelMinWidth,
      }}>
        {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1, accentColor: accent, margin: 0,
        }}
      />
      <EditableValue
        value={value} onChange={onChange}
        min={min} max={max} decimals={decimals}
        style={{
          width: valueWidth, textAlign: 'right',
          fontFamily: mono, fontSize: fontSize + 1, fontVariantNumeric: 'tabular-nums',
          color: accent, fontWeight: 600,
        }}
      />
    </div>
  );
}

// ---------- Editable numeric value (click to type a number) ----------
// Used wherever a slider exposes a value that the student might want
// to set precisely without dragging — e.g. typing 1.234 for L when
// the slider's 0.05 nm step is too coarse. The display reverts to
// read-only on blur, Enter, or Escape.
function EditableValue({ value, onChange, min, max, decimals = 0, displayFn, style }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = displayFn ? displayFn(value) : value.toFixed(decimals);
  function startEdit() {
    setDraft(value.toFixed(decimals));
    setEditing(true);
  }
  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
      onChange(clamped);
    }
    setEditing(false);
  }
  if (editing) {
    return (
      <input
        autoFocus type="text" value={draft}
        // Select all on focus so the user can just start typing and the
        // existing value gets replaced — no need to manually clear.
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          ...style,
          background: 'transparent',
          border: `1px solid ${style && style.color ? style.color : 'currentColor'}`,
          outline: 'none',
          padding: '0 2px',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <div onClick={startEdit} style={{ ...style, cursor: 'text' }} title="Click to type a value">
      {display}
    </div>
  );
}

// ---------- Stepper (used in tab 2 for L / m* / V0 / Γ / σ rows) ----------
// Three pieces side-by-side: [−] [editable value] [+]. Either button
// nudges the value by `step` (multiplicative for log-scale params like
// m*, additive otherwise). The editable value is the same EditableValue
// used elsewhere so click-to-type works consistently.
function Stepper({
  value, onChange, min, max, step, decimals = 2,
  displayFn, multiplicative = false,
  color, rule, mono, valueWidth = 52,
}) {
  function clamp(v) { return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)); }
  function dec() { onChange(clamp(multiplicative ? value / step : value - step)); }
  function inc() { onChange(clamp(multiplicative ? value * step : value + step)); }
  const btnStyle = {
    width: 22, height: 22, padding: 0, lineHeight: 1,
    background: 'transparent', color,
    border: `1px solid ${rule}`, borderRadius: 3,
    cursor: 'pointer', fontFamily: mono, fontSize: 14, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={dec} style={btnStyle} title="Decrease">−</button>
      <EditableValue
        value={value} onChange={onChange}
        min={min} max={max} decimals={decimals} displayFn={displayFn}
        style={{
          width: valueWidth, textAlign: 'right',
          fontFamily: mono, fontSize: 13, fontVariantNumeric: 'tabular-nums',
          color, fontWeight: 600,
        }}
      />
      <button onClick={inc} style={btnStyle} title="Increase">+</button>
    </div>
  );
}

// ---------- Link toggle (couples a parameter between System A and B) ----------
// Small chain-link icon. Linked = accent color, two pills overlapping.
// Unlinked = inkDim, two pills with a gap. Click to toggle; the parent
// owns the boolean state and the sync-on-link logic.
function LinkToggle({ linked, onToggle, accent, inkDim }) {
  const col = linked ? accent : inkDim;
  return (
    <button
      onClick={onToggle}
      title={linked ? 'Linked across A & B — click to unlink' : 'Independent — click to link'}
      style={{
        width: 24, height: 24, padding: 0,
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, opacity: linked ? 1 : 0.65,
      }}
    >
      <svg width={18} height={18} viewBox="0 0 24 24" stroke={col} strokeWidth={1.8} fill="none" strokeLinecap="round">
        {linked ? (
          <g>
            <rect x={2}  y={9} width={12} height={6} rx={3} />
            <rect x={10} y={9} width={12} height={6} rx={3} />
          </g>
        ) : (
          <g>
            <rect x={2}  y={9} width={9}  height={6} rx={3} />
            <rect x={13} y={9} width={9}  height={6} rx={3} />
          </g>
        )}
      </svg>
    </button>
  );
}

// ---------- Vertical slider (with V0 threshold marker) ----------
// Adapted from the sibling app. Two Redux-specific additions:
//   - the segment of the track above V0 is drawn in the ionised colour,
//     so the user sees the threshold without needing a tooltip;
//   - the value label and knob both adopt the ionised colour above V0.
function VerticalSlider({ label, value, onChange, min, max, accent, ionisedAccent, rule, inkDim, ink, mono, v0, decimals = 0, ticks, onTickClick, tickAccent, trackHeight = 200, activeTickTolerance = 0.5, valueAddon = null, v0LabelSide = 'left' }) {
  const TRACK_H = trackHeight;
  const TRACK_W = 8;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 10;
  const innerH = TRACK_H;
  const trackX = 28;

  function yFor(v) {
    const clamped = Math.max(min, Math.min(max, v));
    return PAD_TOP + innerH - ((clamped - min) / (max - min)) * innerH;
  }

  const knobY = yFor(value);
  const v0Y   = yFor(v0);
  const isAbove = value > v0;
  const knobAccent = isAbove ? ionisedAccent : accent;

  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  function valueFromClientY(clientY) {
    const rect = trackRef.current.getBoundingClientRect();
    const yLocal = clientY - rect.top;
    const frac = 1 - Math.max(0, Math.min(innerH, yLocal - PAD_TOP)) / innerH;
    const raw = min + frac * (max - min);
    const scale = Math.pow(10, decimals);
    return Math.round(raw * scale) / scale;
  }
  function onPointerDown(e) {
    draggingRef.current = true;
    onChange(valueFromClientY(e.clientY));
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    onChange(valueFromClientY(e.clientY));
  }
  function onPointerUp() { draggingRef.current = false; }

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!editing) setDraft(value.toFixed(decimals)); }, [value, decimals, editing]);
  function commitDraft() {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      <div style={{
        fontFamily: mono, fontSize: 13, color: inkDim, letterSpacing: 1,
        textTransform: 'uppercase', marginBottom: 4, fontWeight: 500,
      }}>
        {label}
      </div>
      <svg
        ref={trackRef}
        width={88}
        height={PAD_TOP + innerH + PAD_BOTTOM}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: 'pointer', touchAction: 'none' }}
      >
        {/* base track (below V0 — bound region) */}
        <rect x={trackX - TRACK_W / 2} y={v0Y} width={TRACK_W} height={(PAD_TOP + innerH) - v0Y} fill={rule} rx={4} />
        {/* upper track (above V0 — continuum region, drawn faintly in the ionised colour) */}
        <rect x={trackX - TRACK_W / 2} y={PAD_TOP} width={TRACK_W} height={v0Y - PAD_TOP} fill={ionisedAccent} opacity={0.18} rx={4} />

        {/* filled portion from min up to current value */}
        <rect x={trackX - TRACK_W / 2} y={knobY} width={TRACK_W}
              height={(PAD_TOP + innerH) - knobY}
              fill={knobAccent} opacity={0.75} rx={4} />

        {/* V₀ tick. Default is on the LEFT of the track so the right
            stays available for the eigenstate "n=X" labels (tab 1
            convention, where V₀ sits in the middle of the slider and
            could crowd a nearby n label on the right). When slider
            max = V₀ (tab 2), V₀ sits at the top with no eigenstates
            above it, and placing it on the right alongside the n
            labels reads cleaner. */}
        {v0LabelSide === 'right' ? (
          <g>
            <line x1={trackX + TRACK_W / 2 + 2} x2={trackX + TRACK_W / 2 + 9}
                  y1={v0Y} y2={v0Y}
                  stroke={ionisedAccent} strokeWidth={2.5} />
            <text x={trackX + TRACK_W / 2 + 12} y={v0Y + 4}
                  fill={ionisedAccent} fontSize={11} fontFamily={mono}>
              V₀
            </text>
          </g>
        ) : (
          <g>
            <line x1={trackX - TRACK_W / 2 - 8} x2={trackX - TRACK_W / 2 - 2}
                  y1={v0Y} y2={v0Y}
                  stroke={ionisedAccent} strokeWidth={2.5} />
            <text x={trackX - TRACK_W / 2 - 11} y={v0Y + 4}
                  fill={ionisedAccent} fontSize={11} fontFamily={mono} textAnchor="end">
              V₀
            </text>
          </g>
        )}

        {/* Eigenstate ticks on the RIGHT of the track (matches the
            sibling app). Clickable hit-area extends rightward so the
            "n=X" labels are easy targets. Active eigenstate (slider
            value within 0.5 of the eigenvalue) is bolded. */}
        {ticks && ticks.map((tE, i) => {
          if (tE < min || tE > max) return null;
          const tY = yFor(tE);
          const isActive = Math.abs(value - tE) < activeTickTolerance;
          const tickCol = isActive ? ink : (tickAccent || accent);
          const clickable = !!onTickClick;
          // When the V₀ label is on the same side and lives near this
          // tick (within ~14 px vertically), shift this eigenstate's
          // label downward so the two text labels don't overlap. Only
          // the label moves; the tick line stays at tY.
          const v0Clash = (v0LabelSide === 'right') && Math.abs(tY - v0Y) < 14;
          const labelDy = v0Clash ? 12 : 4;
          return (
            <g
              key={i}
              style={clickable ? { cursor: 'pointer' } : undefined}
              onPointerDown={clickable ? (e) => { e.stopPropagation(); onTickClick(tE, i); } : undefined}
            >
              {clickable && (
                <rect x={trackX + TRACK_W / 2 + 1} y={tY - 8}
                      width={48} height={16} fill="transparent" />
              )}
              <line x1={trackX + TRACK_W / 2 + 2} x2={trackX + TRACK_W / 2 + 9}
                    y1={tY} y2={tY}
                    stroke={tickCol} strokeWidth={isActive ? 3 : 2}
                    opacity={0.95} />
              <text x={trackX + TRACK_W / 2 + 12} y={tY + labelDy}
                    fill={tickCol} fontSize={isActive ? 13 : 12}
                    fontFamily={mono} letterSpacing={0.3} opacity={0.95}>
                <tspan fontStyle="italic">n</tspan>={i + 1}
              </text>
            </g>
          );
        })}

        {/* knob */}
        <circle cx={trackX} cy={knobY} r={10} fill={knobAccent} stroke={ink} strokeWidth={2} />
      </svg>

      {/* Editable numeric value + optional addon (e.g. a LinkToggle).
          Wrapping them in a flex row keeps the addon visually paired
          with the value rather than dangling below the whole slider. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        {editing ? (
          <input
            autoFocus type="text" value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitDraft();
              if (e.key === 'Escape') { setEditing(false); setDraft(value.toFixed(decimals)); }
            }}
            style={{
              width: 52, textAlign: 'center', background: 'transparent', color: knobAccent,
              border: `1px solid ${knobAccent}`, padding: '2px 4px',
              fontFamily: mono, fontSize: 14, fontVariantNumeric: 'tabular-nums',
              borderRadius: 2, fontWeight: 600,
            }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              width: 52, textAlign: 'center', color: knobAccent, fontFamily: mono, fontSize: 14,
              fontVariantNumeric: 'tabular-nums', padding: '2px 4px',
              border: `1px solid transparent`, cursor: 'text', borderRadius: 2, fontWeight: 600,
            }}
          >
            {value.toFixed(decimals)}
          </div>
        )}
        {valueAddon}
      </div>
    </div>
  );
}

// ---------- Classical particle view: bouncing in a finite well ----------
// Visualises the box from the side: walls represent the V0 jump, the dashed
// ceiling is the V0 level (top of the well), the floor is V = 0.
//
// The particle bounces in irregular parabolic arcs whose phase advances
// in *sim time*, not as a function of x. This is the load-bearing
// pedagogical choice: a single arc parameterised by x (peak at x = L/2,
// zero at the walls) is geometrically identical to the ground-state
// quantum wavefunction ψ_1, and would conflate the classical and
// quantum pictures — the exact comparison this app is built to make.
// Decoupling from x and randomising each bounce's duration and peak
// breaks the visual association with any quantum eigenstate.
//
// Peak height scales linearly with E / V0 so that at E = V0 the bounce
// envelope just reaches the rim of the well. Above V0 the particle is
// drawn outside the box with a dashed escape trail — the visceral
// image of ionisation.
//
// Pedagogical disclaimer (also stated in the Notes section): the vertical
// motion is a visual indicator of kinetic energy, not a real degree of
// freedom. The actual simulation is one-dimensional along x.
//
// Layout: width is responsive via viewBox; the horizontal padding (60 px
// each side) matches PositionHistogram below so the walls line up
// between the two views in the column.
function ParticleView({ x, energy, V0, isIonised, bouncePhase, bouncePeakFrac, recentMeasurements, col, wall, bg, ionisedCol, mono }) {
  const W = 480, H = 130;
  const PAD_L = 60, PAD_R = 60;
  const INNER_W = W - PAD_L - PAD_R;
  // Walls drawn inside the plot area so the regions outside [0, L]
  // remain visible — this is where the quantum wavefunction's leakage
  // appears in the WavefunctionView, and keeping both views on the
  // same x-axis lets the two panels be compared directly.
  function xToPx(xv) { return PAD_L + ((xv - X_PLOT_MIN) / X_PLOT_RANGE) * INNER_W; }
  const wallLeftX  = xToPx(0);
  const wallRightX = xToPx(L);
  const ceilY  = 22;             // top of well wall = V0 level
  const floorY = H - 14;         // bottom of well = V = 0
  const boxHeight = floorY - ceilY;
  const r = 6;                   // particle radius

  // Bounce envelope: maximum peak height available at this E.
  // Scales linearly with E / V0 so that at E = V0 the envelope spans
  // (nearly) the whole box. The actual bounce uses a random fraction
  // of this envelope (bouncePeakFrac), so most bounces are smaller than
  // the maximum — only occasional bounces reach the rim.
  const eFrac = Math.min(1, Math.max(0, energy / V0));
  const envelope = eFrac * (boxHeight - 2 * r);
  const peak = envelope * bouncePeakFrac;

  // Parabolic arc as a function of bouncePhase ∈ [0, 1].
  // Phase advances in sim time and is independent of x.
  const yOff = 4 * peak * bouncePhase * (1 - bouncePhase);

  const px = xToPx(x);
  // Clamp at the rim so a particularly tall bounce at E near V0
  // visibly bumps the ceiling rather than overflowing it. This is a
  // pleasant visual cue that the particle is "about to escape."
  let py = floorY - r - yOff;
  if (py < ceilY + r) py = ceilY + r;

  const flashY = floorY - 2; // right above the floor, distinct from the particle

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: bg, borderRadius: 2 }}>
      {/* floor of well (V = 0) */}
      <line x1={wallLeftX} x2={wallRightX} y1={floorY} y2={floorY} stroke={wall} strokeWidth={2} />
      {/* walls (V jumps from 0 to V0 at the box edges) */}
      <line x1={wallLeftX}  x2={wallLeftX}  y1={ceilY} y2={floorY} stroke={wall} strokeWidth={5} />
      <line x1={wallRightX} x2={wallRightX} y1={ceilY} y2={floorY} stroke={wall} strokeWidth={5} />
      {/* dashed line at V0 level (top of the rim) */}
      <line x1={wallLeftX} x2={wallRightX} y1={ceilY} y2={ceilY}
        stroke={ionisedCol} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      <text x={wallRightX + 6} y={ceilY + 4}
        fill={ionisedCol} fontFamily={mono} fontSize={11}>
        V₀
      </text>

      {/* Recent measurement flashes — each measurement (every Nth step)
          leaves a small fading dot near the floor, so the discrete
          measurement-by-measurement nature of the histogram becomes
          visible. The flashes share their semantics with the position
          histogram ticks above. */}
      {recentMeasurements && recentMeasurements.map((m, i) => {
        const opacity = Math.max(0, 1 - m.age / FLASH_AGE);
        const rr = 1.5 + (1 - m.age / FLASH_AGE) * 3;
        return <circle key={i} cx={xToPx(m.x)} cy={flashY} r={rr} fill={col} opacity={opacity * 0.85} />;
      })}

      {!isIonised ? (
        <circle cx={px} cy={py} r={r}
          fill={col} fillOpacity={0.9} stroke={col} strokeWidth={1.5} />
      ) : (
        // Ionised state: particle drawn above the box with a dashed
        // escape trail and an upward arrow. The box is still visible so
        // the rim (V0) remains the visual anchor for the threshold.
        <g>
          <line x1={W / 2} y1={ceilY - 2} x2={W / 2} y2={8}
            stroke={ionisedCol} strokeWidth={2} strokeDasharray="2 3" opacity={0.75} />
          <polygon
            points={`${W / 2 - 5},10 ${W / 2 + 5},10 ${W / 2},2`}
            fill={ionisedCol}
          />
          <circle cx={W / 2} cy={ceilY - 12} r={r}
            fill={col} fillOpacity={0.4} stroke={col} strokeWidth={1} />
          <text x={W / 2 + 18} y={14}
            fill={ionisedCol} fontFamily={mono} fontSize={12}>
            escaped over V₀
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------- Wavefunction view (quantum side, parallel to ParticleView) ----------
// Side-view of the well showing |ψ(x, t)|² as a filled curve. The
// wavefunction's exponential tails extend past the walls; this is the
// visible representation of the chemistry punchline that bound electrons
// have nonzero amplitude outside the well — the precondition for
// tunneling, the reason molecular orbitals are diffuse. The walls and
// V0 ceiling line are drawn in the same positions as the classical
// ParticleView so the two panels can be compared directly.
//
// A live "particle" dot tracks the latest sampled position; flashes
// mark recent measurements; above V0 the panel switches to the
// ionised indicator just like the classical side.
function WavefunctionView({
  states, probs, t, isIonised, psiMode, latestX, recentMeasurements,
  col, wall, bg, ionisedCol, mono,
  // Optional nm-space rendering (Tab 2). When lengthNm + xMinNm + xMaxNm
  // are all provided, engine x ∈ [0, 1] is mapped to nm space [0, lengthNm]
  // and the visible axis spans [xMinNm, xMaxNm] across the panel. A and B
  // share the same nm axis so a wider well visibly fills more of the panel.
  // Tab 1 omits these and falls back to engine-unit rendering unchanged.
  lengthNm, xMinNm, xMaxNm,
}) {
  // psiMode: 'density' = |ψ|², 'wavefunction' = Re ψ + Im ψ, 'off' = no curve
  const showDensity      = psiMode === 'density';
  const showWavefunction = psiMode === 'wavefunction';
  const W = 480, H = 130;
  const PAD_L = 60, PAD_R = 60;
  const INNER_W = W - PAD_L - PAD_R;
  const nmMode = lengthNm !== undefined && xMinNm !== undefined && xMaxNm !== undefined;
  const xRangeNm = nmMode ? (xMaxNm - xMinNm) : 1;
  // In nm mode, center this system's well horizontally in the panel
  // (rather than left-aligning at nm = 0). When L changes, both walls
  // move symmetrically so the box stays anchored at the midline; A and
  // B's wells share their visual centers, which makes the side-by-side
  // comparison read cleaner.
  const wellCenterNm = nmMode ? (xMinNm + xMaxNm) / 2 : 0.5;
  const wellLeftOffsetNm = nmMode ? (wellCenterNm - lengthNm / 2) : 0;
  function xToPx(xv) {
    if (nmMode) {
      const xNm = wellLeftOffsetNm + xv * lengthNm;
      return PAD_L + ((xNm - xMinNm) / xRangeNm) * INNER_W;
    }
    return PAD_L + ((xv - X_PLOT_MIN) / X_PLOT_RANGE) * INNER_W;
  }
  const wallLeftX  = xToPx(0);
  const wallRightX = xToPx(L);
  const ceilY  = 22;
  const floorY = H - 14;
  const r = 6;
  const flashY = floorY - 2;

  // Two display modes:
  //   - |ψ|² (probability density): a non-negative curve filled from
  //     the floor up to the density value. Amplitude scaled so the
  //     tallest point fills ~75 % of the box height.
  //   - Re(ψ) (signed wavefunction): a curve crossing a horizontal
  //     centerline at (floorY + ceilY) / 2. Positive lobes shaded
  //     above the centerline, negative lobes shaded below. Nodes are
  //     visible as zero-crossings; for time-evolving superpositions
  //     the curve sloshes as the phase factors exp(-i E_n t) advance.
  //     The Im(ψ) part is dropped — it does its own oscillation but
  //     adding both curves clutters the picture for the chemistry
  //     audience. Phase color encoding is a possible future addition.
  const ampMax  = (floorY - ceilY) * 0.75;
  const midY    = (floorY + ceilY) / 2;
  const halfAmp = (floorY - ceilY) * 0.40;
  let path = '';   // for |ψ|² mode: filled density curve
  let rePath = ''; // for ψ mode: Re(ψ) outline
  let imPath = ''; // for ψ mode: Im(ψ) outline

  // Engine-x range over which we sample the wavefunction. In engine
  // mode this is the fixed [X_PLOT_MIN, X_PLOT_MAX] window; in nm
  // mode it's whatever engine range corresponds to the visible nm
  // axis (so leakage tails of a narrow well don't spill past the
  // visible region, and a wide well's full body stays in view).
  const sampleEngMin = nmMode ? xMinNm / lengthNm : X_PLOT_MIN;
  const sampleEngMax = nmMode ? xMaxNm / lengthNm : X_PLOT_MAX;
  const sampleEngRange = sampleEngMax - sampleEngMin;

  if (!isIonised && states.length > 0) {
    if (showDensity) {
      // |ψ|² density mode — non-negative curve filled from the floor.
      const density = new Float64Array(DENSITY_GRID_N);
      let dMax = 0;
      for (let i = 0; i < DENSITY_GRID_N; i++) {
        const xs = sampleEngMin + (sampleEngRange * i) / (DENSITY_GRID_N - 1);
        density[i] = densityAt(states, probs, xs, t);
        if (density[i] > dMax) dMax = density[i];
      }
      if (dMax > 0) {
        for (let i = 0; i < DENSITY_GRID_N; i++) {
          const xs = sampleEngMin + (sampleEngRange * i) / (DENSITY_GRID_N - 1);
          const X = xToPx(xs).toFixed(2);
          const Y = (floorY - ampMax * (density[i] / dMax)).toFixed(2);
          path += (i === 0 ? `M${X},${floorY} L${X},${Y}` : ` L${X},${Y}`);
        }
        path += ` L${(PAD_L + INNER_W).toFixed(2)},${floorY} Z`;
      }
    } else if (showWavefunction) {
      // ψ mode — plot both Re(ψ) and Im(ψ) as separate outline curves
      // crossing the midline. Because Im(ψ) = -Σ c_n ψ_n(x) sin(E_n t)
      // lags Re(ψ) by 90°, the two curves swap dominance as the phase
      // rotates: when one is at an extremum the other is at zero and
      // moving fastest. The pair therefore has continuous visible
      // motion at any time scale — the lingering of pure cos(E t) is
      // not visible because the partner curve is busy.
      //
      // Both curves are scaled by max |ψ| = sqrt(Re² + Im²) so the
      // pair together fills the box: when Re hits max and Im is zero
      // the Re curve reaches the geometric limit; when they're equal
      // each is at 1/√2 of that limit. This is the visualisation of
      // a complex unit vector rotating in time.
      const re = new Float64Array(DENSITY_GRID_N);
      const im = new Float64Array(DENSITY_GRID_N);
      let psi2Max = 0;
      for (let i = 0; i < DENSITY_GRID_N; i++) {
        const xs = sampleEngMin + (sampleEngRange * i) / (DENSITY_GRID_N - 1);
        let reSum = 0, imSum = 0;
        for (let k = 0; k < states.length; k++) {
          if (probs[k] < 1e-14) continue;
          const c = Math.sqrt(probs[k]);
          const psi = finiteWellPsi(states[k], xs);
          if (psi === 0) continue;
          const ph = -states[k].E * t;
          reSum += c * psi * Math.cos(ph);
          imSum += c * psi * Math.sin(ph);
        }
        re[i] = reSum;
        im[i] = imSum;
        const psi2 = reSum * reSum + imSum * imSum;
        if (psi2 > psi2Max) psi2Max = psi2;
      }
      const aMax = Math.sqrt(psi2Max);
      if (aMax > 0) {
        for (let i = 0; i < DENSITY_GRID_N; i++) {
          const xs = sampleEngMin + (sampleEngRange * i) / (DENSITY_GRID_N - 1);
          const X = xToPx(xs).toFixed(2);
          const Yre = (midY - halfAmp * (re[i] / aMax)).toFixed(2);
          const Yim = (midY - halfAmp * (im[i] / aMax)).toFixed(2);
          rePath += (i === 0 ? `M${X},${Yre}` : ` L${X},${Yre}`);
          imPath += (i === 0 ? `M${X},${Yim}` : ` L${X},${Yim}`);
        }
      }
    }
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: bg, borderRadius: 2 }}>
      {/* faint "outside the box" shading to make the forbidden region read */}
      <rect x={PAD_L} y={ceilY} width={wallLeftX  - PAD_L} height={floorY - ceilY}
            fill={ionisedCol} opacity={0.04} />
      <rect x={wallRightX} y={ceilY} width={(PAD_L + INNER_W) - wallRightX} height={floorY - ceilY}
            fill={ionisedCol} opacity={0.04} />

      {/* floor of well (V = 0) */}
      <line x1={wallLeftX} x2={wallRightX} y1={floorY} y2={floorY} stroke={wall} strokeWidth={2} />
      {/* walls (V jumps from 0 to V0 at the box edges). Thinner in nm
          mode because the visible box can be narrow (a small L on the
          shared axis) and 5-px walls would dominate. */}
      <line x1={wallLeftX}  x2={wallLeftX}  y1={ceilY} y2={floorY} stroke={wall} strokeWidth={nmMode ? 2 : 5} />
      <line x1={wallRightX} x2={wallRightX} y1={ceilY} y2={floorY} stroke={wall} strokeWidth={nmMode ? 2 : 5} />
      {/* dashed V0 line */}
      <line x1={wallLeftX} x2={wallRightX} y1={ceilY} y2={ceilY}
        stroke={ionisedCol} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      <text x={wallRightX + 6} y={ceilY + 4}
        fill={ionisedCol} fontFamily={mono} fontSize={11}>V₀</text>

      {!isIonised && path && showDensity && (
        <path d={path} fill={col} fillOpacity={0.28} stroke={col} strokeWidth={1.8} />
      )}

      {!isIonised && showWavefunction && (
        <g>
          {/* dashed ψ = 0 reference line through the panel midline */}
          <line x1={wallLeftX} x2={wallRightX} y1={midY} y2={midY}
            stroke="#9aa0b4" strokeWidth={1} opacity={0.6} strokeDasharray="3 4" />
          {/* Re(ψ): solid line in the panel accent colour (teal) */}
          {rePath && <path d={rePath} fill="none" stroke={col} strokeWidth={1.8} />}
          {/* Im(ψ): solid line in light red for contrast against teal.
              Two solid curves in distinct hues are easier to read at a
              glance than the same hue with different dash styles. */}
          {imPath && <path d={imPath} fill="none" stroke={ionisedCol} strokeWidth={1.8} />}
          {/* tiny in-corner legend so the convention reads at a glance */}
          <g transform={`translate(${wallLeftX + 6}, ${ceilY + 8})`}>
            <line x1={0} y1={0} x2={14} y2={0} stroke={col} strokeWidth={1.8} />
            <text x={18} y={3} fill={col} fontFamily={mono} fontSize={10}>Re ψ</text>
            <line x1={0} y1={10} x2={14} y2={10} stroke={ionisedCol} strokeWidth={1.8} />
            <text x={18} y={13} fill={ionisedCol} fontFamily={mono} fontSize={10}>Im ψ</text>
          </g>
        </g>
      )}

      {!isIonised && recentMeasurements && recentMeasurements.map((m, i) => {
        const opacity = Math.max(0, 1 - m.age / FLASH_AGE);
        const rr = 1.5 + (1 - m.age / FLASH_AGE) * 3;
        return <circle key={i} cx={xToPx(m.x)} cy={flashY} r={rr} fill={col} opacity={opacity * 0.85} />;
      })}

      {isIonised && (
        <g>
          <line x1={W / 2} y1={ceilY - 2} x2={W / 2} y2={8}
            stroke={ionisedCol} strokeWidth={2} strokeDasharray="2 3" opacity={0.75} />
          <polygon points={`${W / 2 - 5},10 ${W / 2 + 5},10 ${W / 2},2`} fill={ionisedCol} />
          <text x={W / 2 + 18} y={14}
            fill={ionisedCol} fontFamily={mono} fontSize={12}>
            ionised — continuum state (not drawn)
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------- Position histogram ----------
// Same horizontal padding as ParticleView so the x = 0 and x = L walls
// align between the two views in the column.
function PositionHistogram({
  hist, recentMarkers, col, ink, inkDim, rule, mono, meanX, isIonised,
  ionisedCol, leakFrac, overlay,
  // Optional nm-space rendering (Tab 2). Engine x ∈ [0, 1] maps to
  // nm [0, lengthNm] and the visible axis covers [xMinNm, xMaxNm].
  // Tab 1 omits these and uses the default engine-units rendering.
  lengthNm, xMinNm, xMaxNm,
}) {
  const W = 480, H = 220;
  const PAD = { l: 60, r: 60, t: 30, b: 54 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const nmMode = lengthNm !== undefined && xMinNm !== undefined && xMaxNm !== undefined;
  const xRangeNm = nmMode ? (xMaxNm - xMinNm) : 1;
  // Center this system's well in the panel (see WavefunctionView's
  // comment for why). Engine x = 0 maps to wellLeftOffsetNm in nm.
  const wellCenterNm = nmMode ? (xMinNm + xMaxNm) / 2 : 0.5;
  const wellLeftOffsetNm = nmMode ? (wellCenterNm - lengthNm / 2) : 0;

  const histMax = hist.reduce((a, v) => (v > a ? v : a), 0);
  const yMax = Math.max(histMax, 0.5) * 1.25;

  // Engine x → pixel. In nm mode, route through nm space so a wider
  // well takes more horizontal screen real estate; in engine mode
  // (Tab 1) the panel always spans the full [X_PLOT_MIN, X_PLOT_MAX]
  // window so walls land at the same pixel positions as ParticleView.
  function xScale(xSim) {
    if (nmMode) {
      const xNm = wellLeftOffsetNm + xSim * lengthNm;
      return PAD.l + ((xNm - xMinNm) / xRangeNm) * innerW;
    }
    return PAD.l + ((xSim - X_PLOT_MIN) / X_PLOT_RANGE) * innerW;
  }
  function yScale(v) { return PAD.t + innerH - Math.min(1, v / yMax) * innerH; }

  // In nm mode the histogram still has NBINS_X bins over engine
  // [X_PLOT_MIN, X_PLOT_MAX]; bars outside the visible nm range get
  // clipped at the panel edges by virtue of the xScale mapping.
  const NB = hist.length;
  const bars = hist.map((v, i) => {
    if (v <= 0) return null;
    const xSim0 = X_PLOT_MIN + (i     / NB) * X_PLOT_RANGE;
    const xSim1 = X_PLOT_MIN + ((i+1) / NB) * X_PLOT_RANGE;
    const X = xScale(xSim0), X2 = xScale(xSim1);
    // Cull bars that fall entirely outside the panel.
    if (X2 < PAD.l || X > PAD.l + innerW) return null;
    const Y = yScale(v);
    return (
      <rect key={i}
        x={X + 0.5} y={Y}
        width={Math.max(1, X2 - X - 1)} height={PAD.t + innerH - Y}
        fill={col} opacity={0.7}
      />
    );
  });

  const axisY = PAD.t + innerH;
  const xTicks = [0, 0.5, 1];
  // In nm mode the tick labels show the actual nm values rather than
  // "0 / L/2 / L" placeholders — the student gets a concrete length
  // scale on the x axis. Engine mode keeps the dimensionless labels.
  const xLabel = (v) => {
    if (nmMode) {
      const nm = v * lengthNm;
      return `${nm.toFixed(nm < 1 ? 2 : 1)} nm`;
    }
    return v === 0 ? '0' : v === 1 ? 'L' : 'L/2';
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Outside-the-box shaded regions — the classically forbidden
          region for the bound electron. A faint tint here makes the
          well boundary read at a glance, before the walls are drawn. */}
      <rect x={PAD.l} y={PAD.t}
        width={Math.max(0, xScale(0) - PAD.l)} height={innerH}
        fill={inkDim} opacity={0.08} />
      <rect x={xScale(L)} y={PAD.t}
        width={Math.max(0, (PAD.l + innerW) - xScale(L))} height={innerH}
        fill={inkDim} opacity={0.08} />

      {/* y-axis */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={axisY} stroke={rule} strokeWidth={1.5} />
      {/* x-axis baseline */}
      <line x1={PAD.l} x2={PAD.l + innerW} y1={axisY} y2={axisY} stroke={rule} strokeWidth={1.5} />

      {bars}

      {/* Wall indicators drawn AFTER bars so they're not hidden by
          near-wall bin heights. Solid, thick, full opacity — same
          line weight as the wall lines in the particle / wavefunction
          views above. */}
      <line x1={xScale(0)} x2={xScale(0)} y1={PAD.t} y2={axisY}
        stroke={ink} strokeWidth={3} opacity={0.85} />
      <line x1={xScale(L)} x2={xScale(L)} y1={PAD.t} y2={axisY}
        stroke={ink} strokeWidth={3} opacity={0.85} />

      {/* Theory overlay: time-averaged |ψ(x)|² density (quantum) or
          uniform-inside-the-well density (classical) as a continuous
          curve, with a faint shaded fill underneath so the curve and
          its support read at a glance. Same y-scale as the histogram
          bars (both in density units); the histogram converges to lie
          under this curve. */}
      {overlay && (() => {
        const linePath = overlay.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(2)},${yScale(p.d).toFixed(2)}`).join(' ');
        const firstX = xScale(overlay[0].x).toFixed(2);
        const lastX  = xScale(overlay[overlay.length - 1].x).toFixed(2);
        const fillPath = `${linePath} L${lastX},${axisY} L${firstX},${axisY} Z`;
        return (
          <g>
            <path d={fillPath} fill={col} fillOpacity={0.18} stroke="none" />
            <path d={linePath} fill="none" stroke={col} strokeWidth={1.8} opacity={0.95} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })()}

      {/* Recent-measurement flash ticks at the top of the histogram —
          one short vertical line per recent measurement, fading with
          age. These give a visible measurement-by-measurement signal
          that the histogram is being filled in real time. */}
      {recentMarkers && recentMarkers.map((m, i) => {
        const X = xScale(m.x);
        const opacity = Math.max(0, 1 - m.age / FLASH_AGE);
        return <line key={i} x1={X} x2={X} y1={PAD.t} y2={PAD.t + 9}
          stroke={col} strokeWidth={2.5} opacity={opacity} />;
      })}

      {/* tick marks and labels */}
      {xTicks.map((t) => (
        <g key={t}>
          <line x1={xScale(t)} x2={xScale(t)} y1={axisY} y2={axisY + 5} stroke={rule} strokeWidth={1.5} />
          <text x={xScale(t)} y={axisY + 20} textAnchor="middle"
            fill={inkDim} fontSize={16} fontFamily={mono} fontWeight={500}>
            {xLabel(t)}
          </text>
        </g>
      ))}

      {/* axis titles */}
      <text x={PAD.l - 8} y={PAD.t + 10} textAnchor="end"
        fill={inkDim} fontSize={15} fontFamily={mono} fontWeight={500} fontStyle="italic">
        P(x)
      </text>
      <text x={PAD.l + innerW / 2} y={axisY + 42} textAnchor="middle"
        fill={inkDim} fontSize={16} fontFamily={mono} fontWeight={500} fontStyle="italic">
        x
      </text>

      {/* ⟨x⟩ overlay in the header band above the plot. In nm mode
          this reads as an actual nm value; in engine mode it reads
          as a fraction of L. */}
      {meanX !== null && (
        <text x={PAD.l + innerW - 6} y={PAD.t - 8} textAnchor="end"
          fontFamily={mono} fontSize={18} fontWeight={500} fontVariantNumeric="tabular-nums">
          <tspan fill={inkDim}>⟨x⟩ = </tspan>
          {nmMode ? (
            <tspan fill={isIonised ? ionisedCol : col}>{(meanX * lengthNm).toFixed(2)}<tspan fill={inkDim} fontSize={12}> nm</tspan></tspan>
          ) : (
            <tspan fill={isIonised ? ionisedCol : col}>{meanX.toFixed(2)}<tspan fill={inkDim}>L</tspan></tspan>
          )}
        </text>
      )}

      {/* P_out: fraction of position measurements that fell outside the
          box (classically forbidden region). Shown on both panels —
          classical is 0 by construction; the contrast is the chemistry
          point. Coloured in the panel accent (NOT the ionised pink)
          because outside-the-box probability is a property of the
          bound state, not an ionisation event. */}
      {leakFrac !== undefined && (
        <text x={PAD.l + 6} y={PAD.t - 8} textAnchor="start"
          fontFamily={mono} fontSize={18} fontWeight={500} fontVariantNumeric="tabular-nums">
          <tspan fill={inkDim}>P</tspan>
          <tspan fill={inkDim} dy={5} fontSize={12}>out</tspan>
          <tspan fill={inkDim} dy={-5} fontSize={18}> = </tspan>
          <tspan fill={leakFrac > 0 ? col : inkDim}>{(leakFrac * 100).toFixed(1)}<tspan fill={inkDim} fontSize={12}>%</tspan></tspan>
        </text>
      )}
    </svg>
  );
}

// ---------- Energy histogram ----------
// Horizontal energy axis 0 → E_HIST_MAX. The V0 threshold is drawn as a
// dashed vertical line; above V0 a faint shaded band indicates the
// continuum (ionised) region. The slider value is shown as a small
// triangle on the axis.
// ---------- Settings modal (gear button → popup) ----------
// Five rows of basic parameters that are otherwise hardcoded. Changes
// apply live and persist to localStorage (except the random seed,
// which is per-session by design). Click anywhere outside the modal
// or press Close to dismiss. Reset to defaults restores factory values.
function SettingsModal({
  onClose,
  pauseIncrement, setPauseIncrement,
  maxBoundCap,    setMaxBoundCap,
  waveTimeMult,   setWaveTimeMult,
  randomSeed,     setRandomSeed,
  language,       setLanguage,
  showNotes,      setShowNotes,
  col, fonts,
}) {
  const rowStyle = {
    display: 'grid', gridTemplateColumns: '180px 1fr 200px',
    gap: 14, alignItems: 'center',
    paddingTop: 10, paddingBottom: 10,
    borderBottom: `1px solid ${col.bg}`,
  };
  const labelStyle = {
    fontFamily: fonts.mono, fontSize: 13, color: col.ink, letterSpacing: 0.3,
  };
  const hintStyle = {
    fontFamily: fonts.body, fontSize: 12, color: col.inkDim, lineHeight: 1.4,
  };
  const inputStyle = {
    width: 80, padding: '4px 8px', textAlign: 'right',
    background: 'transparent', color: col.accent, fontWeight: 600,
    border: `1.5px solid ${col.rule}`, borderRadius: 3,
    fontFamily: fonts.mono, fontSize: 14, fontVariantNumeric: 'tabular-nums',
  };
  function intInput(value, onChange, min, max) {
    return (
      <input
        type="number" min={min} max={max} step={1} value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={inputStyle}
      />
    );
  }
  function floatInput(value, onChange, min, max, step) {
    return (
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={inputStyle}
      />
    );
  }
  function resetAll() {
    setPauseIncrement(10000);
    setMaxBoundCap(8);
    setWaveTimeMult(1);
    setRandomSeed(0);
    setLanguage('en');
    setShowNotes(true);
  }
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: col.panel, border: `1px solid ${col.rule}`, borderRadius: 6,
          padding: '20px 28px', maxWidth: 720, width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontFamily: fonts.body, color: col.ink,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{
          fontFamily: fonts.display, fontSize: 24, fontStyle: 'italic',
          marginBottom: 16, color: col.ink,
        }}>
          Settings
        </div>

        <div style={{
          fontFamily: fonts.body, fontSize: 13, color: col.inkDim,
          marginBottom: 8, lineHeight: 1.5,
        }}>
          Settings apply immediately. Most persist across reloads; the
          random seed is per-session.
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>Measurements per cycle</div>
          {intInput(pauseIncrement, setPauseIncrement, 1000, 50000)}
          <div style={hintStyle}>
            How often the simulation auto-pauses so you can see convergence as a process. Default 10 000.
          </div>
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>Maximum bound states shown</div>
          {intInput(maxBoundCap, setMaxBoundCap, 1, 8)}
          <div style={hintStyle}>
            Cap on how many bound states are displayed on the energy
            slider and the P(E) panels. 8 is the absolute maximum.
          </div>
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>Wavefunction time speed</div>
          {floatInput(waveTimeMult, setWaveTimeMult, 0.1, 20, 0.5)}
          <div style={hintStyle}>
            Visual speed-up factor for the time evolution of ψ. 1× is
            the natural rate; higher values make Re(ψ) / Im(ψ) rotate
            faster (good for demos), but high-n states may flicker.
          </div>
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>Random seed</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {intInput(randomSeed, setRandomSeed, 0, 2147483647)}
            <button
              onClick={() => setRandomSeed(Math.floor(Math.random() * 1e9))}
              style={{
                padding: '4px 10px', fontSize: 12, fontFamily: fonts.mono,
                background: 'transparent', color: col.inkDim,
                border: `1px solid ${col.rule}`, borderRadius: 3, cursor: 'pointer',
              }}
            >Random</button>
            <button
              onClick={() => setRandomSeed(0)}
              style={{
                padding: '4px 10px', fontSize: 12, fontFamily: fonts.mono,
                background: 'transparent', color: col.inkDim,
                border: `1px solid ${col.rule}`, borderRadius: 3, cursor: 'pointer',
              }}
            >Auto</button>
          </div>
          <div style={hintStyle}>
            Set a nonzero integer to make runs reproducible (same seed +
            same Stop / Reset → identical histogram development). 0 =
            unseeded (default), each run is different.
          </div>
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>Language</div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              ...inputStyle, width: 'auto', minWidth: 100,
              padding: '4px 8px', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <option value="en">English</option>
          </select>
          <div style={hintStyle}>
            UI language. English is the only fully-translated locale at
            present; additional languages will land in future versions.
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 12, justifyContent: 'space-between',
          alignItems: 'center', marginTop: 18,
        }}>
          <button
            onClick={resetAll}
            style={{
              padding: '8px 14px', fontSize: 13, fontFamily: fonts.mono,
              background: 'transparent', color: col.danger,
              border: `1px solid ${col.danger}`, borderRadius: 4, cursor: 'pointer',
              letterSpacing: 0.3,
            }}
          >Reset to defaults</button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', fontSize: 13, fontFamily: fonts.mono,
              background: col.quantum, color: '#0e1320',
              border: `1px solid ${col.quantum}`, borderRadius: 4, cursor: 'pointer',
              letterSpacing: 0.3, fontWeight: 600,
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Adaptive Notes ("What you're looking at") ----------
// Three columns, chemistry-framed, content adapts to the slider state.
// Column 1 — what state has been prepared (single MO, superposition,
// ionised). Column 2 — what the histograms are showing right now.
// Column 3 — the chemistry punchline (leakage / orbital diffuseness,
// or photoionisation, depending on which is the live story).
// Percentage formatter used by the adaptive Notes sections. Pierre's
// rule: only show decimals when the percentage is below 1 % — round
// integers above that. Keeps the Notes text concise without losing
// resolution on the small-but-pedagogically-interesting cases.
function fmtPct(p) {
  if (!isFinite(p) || p <= 0) return '0 %';
  return (p >= 0.01 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + ' %';
}

// Display an energy in eV with three decimals for everyday values, switching
// to scientific notation when the magnitude drops below 1e-3 eV (heavy-mass
// regimes like proton / deuteron / alpha in a nm-wide well). Keeps the Notes
// and Spectroscopy panels readable for the muon-and-up cases without padding
// them with leading zeros for the lighter ones.
function fmtEv(eV) {
  if (!isFinite(eV)) return '— eV';
  const a = Math.abs(eV);
  if (a === 0) return '0.000 eV';
  if (a < 1e-3) return eV.toExponential(2) + ' eV';
  return eV.toFixed(3) + ' eV';
}

function Notes({ energy, V0, states, probs, gammaDisplayed, sigma, isIonised, qIonisedFrac, qLeakFrac, qXCount, qECount, qxMean, qeMean, mono, display, body, ink, inkDim, cCol, qCol, aCol, ionisedCol }) {
  // Dominant eigenstates (Born probabilities above 5 %), sorted high → low.
  const dominant = [];
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 0.05) dominant.push({ n: states[i].n, E: states[i].E, p: probs[i], parity: states[i].parity });
  }
  dominant.sort((a, b) => b.p - a.p);

  const isSinglePeak  = dominant.length === 1 || (dominant[0] && dominant[0].p > 0.85);
  const significantIonisation = qIonisedFrac > 0.03 && qECount > 0;
  const significantLeakage    = qLeakFrac > 0.01 && qXCount > 0;
  const closestEigen = states.length
    ? states.reduce((acc, s) => Math.abs(s.E - energy) < Math.abs(acc.E - energy) ? s : acc, states[0])
    : null;

  // ----- Column 1: state preparation -----
  let prepLabel, prepText, prepColour;
  if (isIonised) {
    prepLabel  = 'Photoionised system';
    prepColour = ionisedCol;
    prepText = (
      <>
        The slider energy is {energy} – above the well depth V₀ = {V0}.
        Classically the electron has escaped; quantum-mechanically it has
        been ejected into the continuum. In chemistry this is{' '}
        <em>photoionisation</em>: the energy delivered exceeds the
        ionisation potential. Photoelectron spectroscopy (UPS / XPS)
        measures exactly this threshold for real atoms and molecules.
      </>
    );
  } else if (isSinglePeak && dominant[0]) {
    prepLabel  = 'A single bound state';
    prepColour = qCol;
    const d = dominant[0];
    prepText = (
      <>
        Γ ≈ {gammaDisplayed} and the slider sits near E<sub>{d.n}</sub> ≈ {d.E.toFixed(1)},
        so the prepared state is essentially the {d.parity}-parity n = {d.n} bound state{' '}
        (Born probability {fmtPct(d.p)}). The quantum panel's
        position histogram converges to |ψ<sub>{d.n}</sub>|² – the shape
        of that one state – and the energy histogram is a single peak at
        E<sub>{d.n}</sub>. Nudge the slider or widen Γ and the state gets
        mixed with its neighbours.
      </>
    );
  } else if (dominant.length >= 2) {
    prepLabel  = 'A superposition of bound states';
    prepColour = aCol;
    const list = dominant.slice(0, 3).map((d, i) =>
      `n=${d.n} (${fmtPct(d.p).replace(' ', '')})${i === Math.min(dominant.length, 3) - 1 ? '' : ', '}`
    ).join('');
    prepText = (
      <>
        With Γ = {gammaDisplayed} and slider energy {energy} sitting between
        eigenvalues, the prepared state is a Lorentzian-weighted
        superposition of {dominant.length} bound states: {list}.
        Γ here is the <em>spectral linewidth</em> of the preparation:
        a finite-lifetime state has Γ ≈ ℏ/τ by the time–energy
        uncertainty relation, and physical perturbations (collisions,
        thermal motion, pressure) further broaden real spectroscopic
        lines. Every quantum energy measurement collapses onto one of
        these eigenvalues (Born rule); the slider energy is the
        <em>mean</em>, never the <em>result</em>. Drag the slider
        until one bar of the energy histogram dominates – you'll have
        landed on a pure eigenstate.
      </>
    );
  } else {
    prepLabel  = 'A single dominant state';
    prepColour = qCol;
    prepText = (
      <>
        With Γ ≈ {gammaDisplayed} the prepared state is concentrated on a
        single bound state (n ≈ {closestEigen?.n ?? '?'}).
        The energy histogram is essentially one peak at the corresponding
        eigenvalue; the position histogram converges to that state's
        |ψ|² shape.
      </>
    );
  }

  // ----- Column 2: what the histograms show right now -----
  let measureLabel, measureText, measureColour;
  if (isIonised) {
    measureLabel  = 'Why the histograms are frozen';
    measureColour = inkDim;
    measureText = (
      <>
        With E &gt; V₀ the simulation reports the system as ionised – no
        classical trajectory to integrate, no bound state to sample.
        Histograms are paused. Lower the slider back below V₀ to bind
        the electron again, or hit Stop / Reset to wipe the collected
        data and start over.
      </>
    );
  } else {
    measureLabel  = 'Two histograms, two stories';
    measureColour = ink;
    measureText = (
      <>
        Position histograms show <em>where</em> the electron is.
        Classically it samples positions uniformly across the well
        (⟨x⟩ → L/2) and never escapes. Quantum-mechanically it samples
        |ψ(x, t)|², which extends past the walls{qXCount > 0 ? ` – here, ${fmtPct(qLeakFrac)} of measurements were outside the box` : ''}.
        Energy histograms show <em>what energy</em> a spectrometer
        would report. Classically the answer is exactly the slider value
        plus σ noise. Quantum-mechanically it collapses onto one of the
        discrete eigenvalues – the bound energy levels of this well.
        Note: σ noise can push reported energies above V₀ on either
        panel — those are measurement artefacts, not ionisation. The
        system is still bound; only the spectrometer is reading high.
        Genuine ionisation (quantum continuum collapse) is tracked
        separately as P<sub>ion</sub>.
      </>
    );
  }

  // ----- Column 3: chemistry punchline -----
  let chemLabel, chemText, chemColour;
  if (significantIonisation) {
    chemLabel  = 'Bound + continuum: real spectroscopy';
    chemColour = ionisedCol;
    chemText = (
      <>
        With Γ this wide and the slider close to V₀, the Lorentzian
        preparation has tails extending above V₀. About{' '}
        <strong style={{ color: ionisedCol }}>{fmtPct(qIonisedFrac)}</strong>{' '}
        of energy measurements end up in the continuum – they are
        photoionisation events. The discrete peaks below V₀ in P(E) are
        bound-state collapses; the broad distribution above V₀ is the
        ionised electron. This is the structure of a real photoelectron
        spectrum near the ionisation threshold.
      </>
    );
  } else if (significantLeakage) {
    chemLabel  = 'Why bound electronic states are diffuse';
    chemColour = qCol;
    chemText = (
      <>
        The quantum position histogram has weight outside the well –{' '}
        <strong style={{ color: qCol }}>{fmtPct(qLeakFrac)}</strong>{' '}
        of measurements found the electron in the classically forbidden
        region. <em>This is not ionisation</em>: the electron is still
        bound — its wavefunction is just delocalised past the well's
        nominal boundary. (For the actual fraction of measurements that
        leave the well as continuum events, see P<sub>ion</sub> on the
        energy histogram.) The same mechanism applied to real systems is
        why atomic and molecular orbitals are diffuse rather than sharply
        confined, why bond electrons can spread between atoms, and the
        precondition for tunneling (electron transfer, STM, hydrogen
        migration in enzymes). Leakage depth scales as 1/κ, with
        κ = √(V₀ − E): states near the rim leak farther.
      </>
    );
  } else {
    chemLabel  = 'Quantising the well';
    chemColour = qCol;
    chemText = (
      <>
        This finite well contains {states.length} bound state{states.length === 1 ? '' : 's'}{' '}
        at E ≈ {states.map((s) => s.E.toFixed(0)).join(', ')}. Deepen
        the well (V₀ slider) and new bound states appear at the top;
        shrink it and they disappear into the continuum. The number of
        bound states scales roughly as √V₀ / π. Applied to real systems,
        the same trend explains why heavier or more highly-charged nuclei,
        larger conjugated π-systems, and bigger quantum dots can support
        more bound electronic states (atomic and molecular orbitals in
        their full setting).
      </>
    );
  }

  const items = [
    { label: prepLabel,    text: prepText,    colour: prepColour },
    { label: measureLabel, text: measureText, colour: measureColour },
    { label: chemLabel,    text: chemText,    colour: chemColour },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{
            fontFamily: mono, fontSize: 12, letterSpacing: 1.5,
            color: it.colour, textTransform: 'uppercase', marginBottom: 6,
          }}>
            {it.label}
          </div>
          <div style={{ fontSize: 13, color: ink, lineHeight: 1.55, fontFamily: body }}>
            {it.text}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Collapsible section — used for Notes and Spectroscopy ----------
// Replaces the older "Show notes" settings toggle: the section is
// always present, and the student collapses it via a chevron on the
// header instead of from Settings. Collapsed state persists per-tab
// per-section via localStorage.
function CollapsibleSection({ title, expanded, onToggle, children, mono, inkDim }) {
  return (
    <section style={{ marginTop: 22, ...panelStyle() }}>
      <button
        onClick={onToggle}
        title={expanded ? 'Click to collapse' : 'Click to expand'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: mono, fontSize: 12, color: inkDim,
          width: 14, display: 'inline-block', textAlign: 'center',
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>▾</span>
        <span style={{
          fontFamily: mono, fontSize: 13, color: inkDim,
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {children}
        </div>
      )}
    </section>
  );
}

// ---------- Tab 2 Spectroscopy — eigenstate transitions as observables ----------
// Converts bound-state energy differences into the wavelengths and
// spectral regions a student would actually report from a UV-Vis or
// PL spectrum. Three lists side-by-side:
//   1. Within A: the absorption ladder n=1↔2, 2↔3, … inside well A.
//   2. Within B: same ladder for well B.
//   3. Same-n A↔B: the energy gap between A's n=k state and B's n=k
//      state — the "inter-well" photon energy when comparing two
//      systems where the geometry has changed under the same electron.
//
// Spectral region tagging follows the standard chemistry convention:
//   UV < 400 nm, visible 400–700, near-IR 700–2500, IR > 2500.
const HC_EV_NM = 1239.84193;   // h·c in eV·nm (≈ 1240).

function spectralRegion(nm) {
  if (!isFinite(nm) || nm <= 0) return { name: '—',         colour: '#666' };
  if (nm < 400)                 return { name: 'UV',        colour: '#a890ff' };
  if (nm < 700)                 return { name: 'visible',   colour: '#7adfd0' };
  if (nm < 2500)                return { name: 'near-IR',   colour: '#e8a868' };
  return                                { name: 'IR',        colour: '#e8745a' };
}

function Tab2Spectroscopy({
  statesA, statesB, eStarA, eStarB,
  mono, body, ink, inkDim, accent, qCol,
}) {
  function buildLadder(states, eStar) {
    const out = [];
    for (let i = 0; i + 1 < states.length; i++) {
      const eV = (states[i + 1].E - states[i].E) * eStar;
      const nm = HC_EV_NM / eV;
      out.push({ label: `${i + 1} → ${i + 2}`, eV, nm, region: spectralRegion(nm) });
    }
    return out;
  }
  function buildCross(statesA, eStarA, statesB, eStarB) {
    const n = Math.min(statesA.length, statesB.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const eVa = statesA[i].E * eStarA;
      const eVb = statesB[i].E * eStarB;
      const dE = Math.abs(eVa - eVb);
      // Cross-system transitions can have a zero gap (when geometries
      // happen to match) — display as "—" rather than blowing up λ.
      const nm = dE > 1e-9 ? HC_EV_NM / dE : Infinity;
      out.push({
        label: `n = ${i + 1}`,
        eV: dE,
        nm,
        region: spectralRegion(nm),
        sublabel: `A: ${fmtEv(eVa)} · B: ${fmtEv(eVb)}`,
      });
    }
    return out;
  }

  const aLadder = buildLadder(statesA, eStarA);
  const bLadder = buildLadder(statesB, eStarB);
  const cross   = buildCross(statesA, eStarA, statesB, eStarB);

  function Row({ label, eV, nm, region, sublabel }) {
    const showNm = isFinite(nm);
    return (
      <div style={{
        padding: '6px 0', borderBottom: `1px solid ${inkDim}22`,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
          fontFamily: mono, fontSize: 12,
        }}>
          <span style={{ color: ink }}>{label}</span>
          <span style={{
            color: region.colour, fontSize: 10, letterSpacing: 1,
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            {region.name}
          </span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: mono, fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: inkDim,
        }}>
          <span>ΔE = <span style={{ color: ink }}>{fmtEv(eV).replace(' eV', '')}</span> eV</span>
          <span>λ = <span style={{ color: ink }}>{showNm ? nm.toFixed(0) : '—'}</span> nm</span>
        </div>
        {sublabel && (
          <div style={{ fontFamily: mono, fontSize: 11, color: inkDim, fontVariantNumeric: 'tabular-nums' }}>
            {sublabel}
          </div>
        )}
      </div>
    );
  }

  function Column({ title, rows, emptyText }) {
    return (
      <div>
        <div style={{
          fontFamily: mono, fontSize: 12, letterSpacing: 1.5, color: accent,
          textTransform: 'uppercase', marginBottom: 6, fontWeight: 600,
        }}>
          {title}
        </div>
        {rows.length === 0 ? (
          <div style={{ fontFamily: body, fontSize: 12, color: inkDim, fontStyle: 'italic', paddingTop: 4 }}>
            {emptyText}
          </div>
        ) : (
          rows.map((r, i) => <Row key={i} {...r} />)
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
      <Column
        title="Within A · absorption ladder"
        rows={aLadder}
        emptyText="System A has fewer than two bound states — no ladder transitions."
      />
      <Column
        title="Within B · absorption ladder"
        rows={bLadder}
        emptyText="System B has fewer than two bound states — no ladder transitions."
      />
      <Column
        title="A ↔ B · same n (inter-well photon)"
        rows={cross}
        emptyText="Either A or B has no bound states; no matched-n pairing to compare."
      />
    </div>
  );
}

// ---------- Tab 2 Adaptive Notes — A vs B comparison framing ----------
// Three columns mirror tab 1's pattern, but the narrative pivots from
// "what state is prepared" to "what's different between A and B and
// what chemistry that maps to". The text adapts to which geometry
// knobs are varied, whether either side is ionised, whether the prep
// is a single eigenstate or a superposition, and so on.
function Tab2Notes({
  // Per-system, mostly mirrors tab 1's Notes prop shape.
  energyA, energyB, lengthA, lengthB, mEffA, mEffB, v0A, v0B,
  gammaA, gammaB, sigmaA, sigmaB,
  statesA, statesB, probsA, probsB, eStarA, eStarB,
  isIonisedA, isIonisedB,
  qIonisedFracA, qIonisedFracB, qLeakFracA, qLeakFracB,
  qXCountA, qXCountB, qECountA, qECountB,
  // Styling
  mono, display, body, ink, inkDim, accent, qCol, ionisedCol,
}) {
  // What differs between the two geometries? Use a tolerant comparison
  // (L and V0 to 0.01, m* on a log scale because the m* slider is log).
  const lDiff  = Math.abs(lengthA - lengthB) > 0.01;
  const mDiff  = Math.abs(Math.log(mEffA / mEffB)) > 0.005;
  const v0Diff = Math.abs(v0A - v0B) > 0.05;
  const diffs = [];
  if (lDiff)  diffs.push('L');
  if (mDiff)  diffs.push('m*');
  if (v0Diff) diffs.push('V₀');

  // Dominant eigenstates per side (Born prob > 5 %, sorted descending).
  function dominant(probs, states) {
    const dom = [];
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > 0.05) dom.push({ n: i + 1, E: states[i].E, p: probs[i], parity: states[i].parity });
    }
    return dom.sort((a, b) => b.p - a.p);
  }
  const domA = dominant(probsA, statesA);
  const domB = dominant(probsB, statesB);
  const singleA = domA.length === 1 || (domA[0] && domA[0].p > 0.85);
  const singleB = domB.length === 1 || (domB[0] && domB[0].p > 0.85);
  const sameNAcrossSides = singleA && singleB && domA[0] && domB[0] && domA[0].n === domB[0].n;

  // ---------- Column 1: what's prepared in each side ----------
  let prepLabel, prepText, prepColour;
  if (isIonisedA && isIonisedB) {
    prepLabel  = 'Both systems ionised';
    prepColour = ionisedCol;
    prepText = (
      <>
        Both preparation energies exceed their wells' V<sub>0</sub> — neither
        side has a bound preparation. To compare bound-state physics
        drop at least one side's energy below its V<sub>0</sub>.
      </>
    );
  } else if (isIonisedA || isIonisedB) {
    const ion = isIonisedA ? 'A' : 'B';
    const bnd = isIonisedA ? 'B' : 'A';
    prepLabel  = `${ion} ionised, ${bnd} bound`;
    prepColour = ionisedCol;
    prepText = (
      <>
        System <strong style={{ color: ionisedCol }}>{ion}</strong>'s prep energy
        sits above its V<sub>0</sub> — the electron has been ejected into
        the continuum. System <strong>{bnd}</strong> is still bound. The
        comparison panels now contrast bound-state collapse on one side
        with continuum (photoionisation-style) measurements on the other.
      </>
    );
  } else if (sameNAcrossSides) {
    prepLabel  = `Same n = ${domA[0].n} in both wells`;
    prepColour = accent;
    const eA = (domA[0].E * eStarA).toFixed(3);
    const eB = (domB[0].E * eStarB).toFixed(3);
    prepText = (
      <>
        Both systems are prepared on the same quantum number,
        <em> n</em> = {domA[0].n}, but the absolute energies differ:
        A's E<sub>{domA[0].n}</sub> = <strong>{eA} eV</strong>,
        B's E<sub>{domB[0].n}</sub> = <strong>{eB} eV</strong>.
        Same orbital, different geometry — exactly the chemistry
        comparison the energy lock is designed for.
      </>
    );
  } else if (singleA && singleB) {
    prepLabel  = 'Different bound states';
    prepColour = accent;
    prepText = (
      <>
        A is essentially in <em>n</em> = {domA[0].n}
        ({fmtEv(domA[0].E * eStarA)}); B is in
        <em> n</em> = {domB[0].n} ({fmtEv(domB[0].E * eStarB)}).
        Use the energy lock to pair the two sides on the same <em>n</em>
        and isolate the geometry effect.
      </>
    );
  } else {
    prepLabel  = 'Superposition prep';
    prepColour = accent;
    const counts = `A: ${domA.length || 0} dominant state${domA.length === 1 ? '' : 's'}, ` +
                   `B: ${domB.length || 0}`;
    prepText = (
      <>
        Γ broadens the Lorentzian prep so at least one side is a
        superposition of bound states ({counts}). Every quantum
        measurement still collapses onto a single eigenvalue (Born
        rule), but the histogram weight distributes across several
        peaks. Narrow Γ on either side to inspect a single state.
      </>
    );
  }

  // ---------- Column 2: what the panels show ----------
  // Energy gap between the two side's dominant eigenstates (or null
  // if either side is a superposition / ionised).
  const eVgap = (singleA && singleB && !isIonisedA && !isIonisedB && domA[0] && domB[0])
    ? Math.abs(domA[0].E * eStarA - domB[0].E * eStarB) : null;
  const showLeak = qXCountA > 0 && qXCountB > 0;
  const showIon  = (qECountA > 0 || qECountB > 0) && (qIonisedFracA > 0.01 || qIonisedFracB > 0.01);

  const measureLabel  = 'What you can read off';
  const measureColour = qCol;
  const measureText = (
    <>
      A has <strong>{statesA.length}</strong> bound state{statesA.length === 1 ? '' : 's'};
      B has <strong>{statesB.length}</strong>.
      {eVgap != null && (
        <>{' '}At the current preparation, the two reported eigenenergies
          differ by <strong style={{ color: accent }}>{fmtEv(eVgap)}</strong>
          {' '}— that's the energy of a photon that would carry an electron
          from one well's state to the same-<em>n</em> state in the other,
          a spectroscopic transition energy you can read off directly.
        </>
      )}
      {showLeak && (
        <>{' '}Wavefunction leakage (P<sub>out</sub>):
          {' '}<strong style={{ color: qCol }}>A {fmtPct(qLeakFracA)}</strong>,
          {' '}<strong style={{ color: qCol }}>B {fmtPct(qLeakFracB)}</strong>.
          The side with the shallower well or the higher state typically
          leaks farther — leakage depth scales as 1 / √(V<sub>0</sub> − E).
        </>
      )}
      {showIon && (
        <>{' '}Ionisation (P<sub>ion</sub>): A {fmtPct(qIonisedFracA)},
          B {fmtPct(qIonisedFracB)}.</>
      )}
    </>
  );

  // ---------- Column 3: chemistry punchline ----------
  let chemLabel, chemText, chemColour = qCol;
  if (diffs.length === 0) {
    chemLabel = 'Same setup on both sides';
    chemText = (
      <>
        Both systems share L, m<sup>*</sup>, and V<sub>0</sub>. The two
        panels become a consistency check: independent simulations of the
        same physical system should produce statistically identical
        histograms. Vary any geometry knob on one side (unlock its
        chain icon first) to start a real comparison.
      </>
    );
  } else if (lDiff && !mDiff && !v0Diff) {
    chemLabel = 'Box length sets the energy scale';
    chemText = (
      <>
        E<sup>*</sup> ∝ 1 / L<sup>2</sup>. A wider well (longer "box")
        gives a lower E<sup>*</sup>, so the entire bound spectrum
        compresses as L grows. This is the conjugated-π-system story:
        short chains like butadiene have wider HOMO–LUMO gaps than long
        chains like β-carotene; the colours of cyanine dyes shift with
        chain length for the same reason. It is also why
        size-tuneable emission works in semiconductor quantum dots —
        a 3 nm CdSe dot fluoresces blue, a 7 nm dot red.
      </>
    );
  } else if (mDiff && !lDiff && !v0Diff) {
    chemLabel = 'Mass sets the kinetic scale';
    chemText = (
      <>
        E<sup>*</sup> ∝ 1 / m<sup>*</sup>. Heavier particles have smaller
        E<sup>*</sup>, so the same well admits more bound states with
        tighter spacing. In semiconductors, conduction-band electrons
        often have effective masses well below m<sub>e</sub> — that is why
        quantum-confinement effects are pronounced in nanostructures
        even though atomic dimensions are sub-nm. The inverse case
        (heavy proton vs light electron) is why molecular vibrations
        are described in classical / semiclassical terms while electrons
        require full quantum treatment.
      </>
    );
  } else if (v0Diff && !lDiff && !mDiff) {
    chemLabel = 'Well depth sets the bound-state count';
    chemText = (
      <>
        The number of bound states scales as ~ √V<sub>0</sub>. Shallow
        wells barely hold a single state (e.g. a weakly-bound surface
        or image-potential state); deep wells approach the
        infinite-well limit where the spectrum is the n<sup>2</sup>
        ladder of the particle-in-a-box. Real-world parallels:
        photoejection thresholds in PES, well depths in
        semiconductor heterostructures, the work function in metals.
      </>
    );
  } else {
    chemLabel = 'Multiple parameters vary';
    let example = '';
    if (lDiff && mDiff)  example = ' (e.g. CdSe vs Si quantum dots — different both in confinement scale and in electron effective mass)';
    else if (lDiff && v0Diff)  example = ' (e.g. shallow wide surface states vs deep narrow quantum-well structures)';
    else if (mDiff && v0Diff)  example = ' (e.g. comparing different effective-mass particles in differently-binding hosts)';
    chemText = (
      <>
        A and B differ on more than one geometry knob ({diffs.join(', ')}){example}.
        To isolate the effect of a single variable, set the others equal
        (click the chain icon for that parameter to link them across A
        and B). Or keep the dual variation to explore a richer chemistry
        contrast where multiple length / mass / depth scales matter at
        once.
      </>
    );
  }

  const items = [
    { label: prepLabel,    text: prepText,    colour: prepColour },
    { label: measureLabel, text: measureText, colour: measureColour },
    { label: chemLabel,    text: chemText,    colour: chemColour },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{
            fontFamily: mono, fontSize: 12, letterSpacing: 1.5,
            color: it.colour, textTransform: 'uppercase', marginBottom: 6,
          }}>
            {it.label}
          </div>
          <div style={{ fontSize: 13, color: ink, lineHeight: 1.55, fontFamily: body }}>
            {it.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function EnergyHistogram({ hist, recentMarkers, col, ink, inkDim, rule, mono, eSet, meanE, v0, eHistMax, ionisedCol, accent, ionisedFrac, eigenStates, theoryCurve, logY, onToggleLogY, energyUnitLabel = 'ℏ²/2mL²' }) {
  const W = 480, H = 220;
  // PAD.t leaves a header band so the P_ion and ⟨E⟩ overlays don't
  // overlap tall bars or the continuum-shaded band.
  const PAD = { l: 60, r: 60, t: 30, b: 54 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const axisY = PAD.t + innerH;

  // yMax is set from the histogram data only — toggling the theory
  // overlay does not shift the y axis. (Floor of 0.005 matches PQV
  // so that very-broadened σ peaks still scale to fill the panel.)
  const dataMax = hist.reduce((a, v) => (v > a ? v : a), 0);
  const NB = hist.length;
  const linYMax = Math.max(dataMax, 0.005) * 1.25;

  // Log y-axis spans three decades down from yMax (yMin = yMax / 1000).
  // The histogram bar floor is the axis baseline; bars whose density
  // falls below yMin appear at zero height.
  const logYMax = Math.max(dataMax, 0.005);
  const logYMin = logYMax / 1000;

  function xScale(E) { return PAD.l + (E / eHistMax) * innerW; }
  function yScale(v) {
    if (!logY) return PAD.t + innerH - Math.min(1, v / linYMax) * innerH;
    if (v <= 0) return axisY;
    const lv = Math.log10(Math.max(v, logYMin));
    const frac = (lv - Math.log10(logYMin)) / (Math.log10(logYMax) - Math.log10(logYMin));
    return PAD.t + innerH - Math.max(0, Math.min(1, frac)) * innerH;
  }

  const bars = hist.map((v, i) => {
    if (v <= 0) return null;
    const E0 = (i / NB) * eHistMax, E1 = ((i + 1) / NB) * eHistMax;
    const X = xScale(E0), X2 = xScale(E1);
    const Y = yScale(v);
    return (
      <rect key={i}
        x={X + 0.5} y={Y}
        width={Math.max(1, X2 - X - 1)} height={axisY - Y}
        fill={col} opacity={0.7}
      />
    );
  });

  // (x-axis ticks computed inline below from eHistMax)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Clip rect: keeps the theory curve from overflowing into the
          header band when its peak is taller than the histogram's
          current data peak. The histogram bars never overflow (their
          height is capped by the data) so they don't need this clip. */}
      <defs>
        <clipPath id="energyPlotClip">
          <rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} />
        </clipPath>
      </defs>

      {/* shaded continuum band */}
      <rect x={xScale(v0)} y={PAD.t} width={xScale(eHistMax) - xScale(v0)} height={innerH}
        fill={ionisedCol} opacity={0.05} />
      {/* V0 threshold line */}
      <line x1={xScale(v0)} x2={xScale(v0)} y1={PAD.t} y2={axisY}
        stroke={ionisedCol} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />

      {/* y-axis */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={axisY} stroke={rule} strokeWidth={1.5} />
      {/* x-axis baseline */}
      <line x1={PAD.l} x2={PAD.l + innerW} y1={axisY} y2={axisY} stroke={rule} strokeWidth={1.5} />

      {bars}

      {/* Theory overlay — two curves drawn separately:
          * bound part in the panel accent (Σ |c_n|² × Gaussian
            convolved with the σ instrument response, scaled by F(V₀))
          * continuum part in the ionised pink — the upper Lorentzian
            tail convolved with σ, representing the predicted
            distribution of photoionisation events.
          The histogram converges to bound + continuum at each E.
          Same yScale as the bars, so works in linear and log mode. */}
      {theoryCurve && (() => {
        function pathsFor(curve) {
          if (!curve || curve.length === 0) return null;
          const line = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.E).toFixed(2)},${yScale(p.d).toFixed(2)}`).join(' ');
          const firstX = xScale(curve[0].E).toFixed(2);
          const lastX  = xScale(curve[curve.length - 1].E).toFixed(2);
          const fill = `${line} L${lastX},${axisY} L${firstX},${axisY} Z`;
          return { line, fill };
        }
        const b = pathsFor(theoryCurve.bound);
        const c = pathsFor(theoryCurve.continuum);
        return (
          <g clipPath="url(#energyPlotClip)">
            {b && (
              <g>
                <path d={b.fill} fill={col} fillOpacity={0.18} stroke="none" />
                <path d={b.line} fill="none" stroke={col} strokeWidth={1.8} opacity={0.95} vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {c && (
              <g>
                <path d={c.fill} fill={ionisedCol} fillOpacity={0.18} stroke="none" />
                <path d={c.line} fill="none" stroke={ionisedCol} strokeWidth={1.8} opacity={0.95} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </g>
        );
      })()}

      {/* "set" energy line — dashed vertical at the slider energy with
          a small label. Tells the student where they're trying to
          place the system, distinct from the histogram peaks (which
          show where measurements actually land). */}
      {eSet !== undefined && (
        <g>
          <line x1={xScale(eSet)} x2={xScale(eSet)}
            y1={PAD.t} y2={axisY}
            stroke={accent} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.75} />
          <text x={xScale(eSet) + 4} y={PAD.t + 11}
            textAnchor="start" fill={accent}
            fontFamily={mono} fontSize={12} fontWeight={500} opacity={0.95}>
            set
          </text>
        </g>
      )}

      {/* Eigenstate tick markers below the x-axis with "n=N" italic
          labels, matching the slider label convention. */}
      {eigenStates && eigenStates.map((s, i) => {
        const X = xScale(s.E);
        return (
          <g key={`eig${i}`}>
            <line x1={X} x2={X} y1={axisY - 3} y2={axisY + 6}
              stroke={col} strokeWidth={1.5} opacity={0.9} />
            <text x={X} y={axisY + 18} textAnchor="middle"
              fill={col} fontSize={11} fontFamily={mono} opacity={0.95}>
              <tspan fontStyle="italic">n</tspan>={i + 1}
            </text>
          </g>
        );
      })}

      {/* Recent-measurement flash ticks at the top of the histogram. */}
      {recentMarkers && recentMarkers.map((m, i) => {
        if (m.E < 0 || m.E > eHistMax) return null;
        const X = xScale(m.E);
        const opacity = Math.max(0, 1 - m.age / FLASH_AGE);
        return <line key={i} x1={X} x2={X} y1={PAD.t} y2={PAD.t + 9}
          stroke={col} strokeWidth={2.5} opacity={opacity} />;
      })}

      {/* Numeric x-axis ticks at "nice" intervals based on the
          current energy range. We additionally render a V₀ tick in
          the ionised colour so the bound/continuum boundary is
          visually distinct from the regular numeric grid. */}
      {(() => {
        // Pick a rounded interval that gives ~4-7 ticks across the range.
        const target = eHistMax / 5;
        const pow10 = Math.pow(10, Math.floor(Math.log10(target)));
        let step = 1 * pow10;
        if (target / pow10 > 2) step = 2 * pow10;
        if (target / pow10 > 5) step = 5 * pow10;
        // Build the tick list by multiplication rather than repeated
        // addition — floating-point accumulation (0.1 + 0.1 + ... ≠ 0.3)
        // was leaking into the rendered labels as "0.30000000000004".
        // Decimals derived from step so we render "0.2" rather than
        // "0.2000000000003" or, for integer steps, "5" rather than "5.0".
        const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
        const nTicks = Math.floor((eHistMax + step * 0.5) / step) + 1;
        const ticks = [];
        for (let i = 0; i < nTicks; i++) ticks.push(i * step);
        return ticks.map((E) => {
          // skip a tick if it's too close to V₀ (we draw V₀ separately)
          if (Math.abs(E - v0) < step * 0.25) return null;
          return (
            <g key={`xt${E.toFixed(decimals)}`}>
              <line x1={xScale(E)} x2={xScale(E)} y1={axisY + 6} y2={axisY + 10} stroke={rule} strokeWidth={1.5} />
              <text x={xScale(E)} y={axisY + 33} textAnchor="middle"
                fill={inkDim} fontSize={13} fontFamily={mono} fontWeight={500}>
                {E.toFixed(decimals)}
              </text>
            </g>
          );
        });
      })()}
      {/* V₀ tick label below the axis in the ionised colour. */}
      <g>
        <line x1={xScale(v0)} x2={xScale(v0)} y1={axisY + 6} y2={axisY + 10}
          stroke={ionisedCol} strokeWidth={1.5} />
        <text x={xScale(v0)} y={axisY + 33} textAnchor="middle"
          fill={ionisedCol} fontSize={13} fontFamily={mono} fontWeight={500}>
          V₀={v0}
        </text>
      </g>

      {/* axis title. Clickable to toggle log/linear y-axis — useful
          when σ broadens peaks down to a density invisible on a linear
          scale next to sharper features. "log" sits above "P(E)" when
          active so the wider label still fits in the left margin. */}
      <g
        style={onToggleLogY ? { cursor: 'pointer' } : undefined}
        onClick={onToggleLogY}
      >
        {onToggleLogY && (
          <rect x={PAD.l - 50} y={PAD.t - 6} width={50} height={26} fill="transparent" />
        )}
        {logY && (
          <text x={PAD.l - 8} y={PAD.t - 1} textAnchor="end"
            fill={inkDim} fontSize={11} fontFamily={mono} fontWeight={500}>
            log
          </text>
        )}
        <text x={PAD.l - 8} y={logY ? PAD.t + 14 : PAD.t + 10} textAnchor="end"
          fill={inkDim} fontSize={15} fontFamily={mono} fontWeight={500} fontStyle="italic">
          P(E)
        </text>
      </g>
      <text x={PAD.l + innerW / 2} y={H - 4} textAnchor="middle"
        fill={inkDim} fontSize={15} fontFamily={mono} fontWeight={500}>
        <tspan fontStyle="italic">E</tspan>
        <tspan fontSize={11}>{' (' + energyUnitLabel + ')'}</tspan>
      </text>

      {/* ⟨E⟩ overlay in the header band above the plot. */}
      {meanE !== null && (
        <text x={PAD.l + innerW - 6} y={PAD.t - 8} textAnchor="end"
          fontFamily={mono} fontSize={18} fontWeight={500} fontVariantNumeric="tabular-nums">
          <tspan fill={inkDim}>⟨E⟩ = </tspan>
          <tspan fill={eSet > v0 ? ionisedCol : col}>{meanE.toFixed(1)}</tspan>
        </text>
      )}

      {/* P_ion: fraction of energy measurements that collapsed into the
          continuum (ionisation events). Shown on both panels for
          contrast — classical is 0 (no continuum sampling on the
          classical side), quantum can be nontrivial near V0 with
          wide Γ. */}
      {ionisedFrac !== undefined && (
        <text x={PAD.l + 6} y={PAD.t - 8} textAnchor="start"
          fontFamily={mono} fontSize={18} fontWeight={500} fontVariantNumeric="tabular-nums">
          <tspan fill={inkDim}>P</tspan>
          <tspan fill={inkDim} dy={5} fontSize={12}>ion</tspan>
          <tspan fill={inkDim} dy={-5} fontSize={18}> = </tspan>
          <tspan fill={ionisedFrac > 0 ? ionisedCol : inkDim}>{(ionisedFrac * 100).toFixed(1)}<tspan fill={inkDim} fontSize={12}>%</tspan></tspan>
        </text>
      )}
    </svg>
  );
}

// =============================================================
// TAB BAR
// =============================================================
//
// Abstract labels — they name the parameter that varies, not the
// chemistry application, so the same tabs can be used for any
// pedagogical framing. Tab 3 is shown but disabled until the
// variable-potential-shape work lands.

const TABS = [
  { id: 'tab1', label: 'Depth',    enabled: true  },
  { id: 'tab2', label: 'Width',    enabled: true  },
  { id: 'tab3', label: 'Shape',    enabled: false },
];

function TabBar({ activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2, marginBottom: 14,
      borderBottom: `1px solid ${COL.rule}`,
    }}>
      {TABS.map((t) => {
        const isActive = t.id === activeTab;
        const isDisabled = !t.enabled;
        return (
          <button
            key={t.id}
            onClick={() => { if (!isDisabled && !isActive) onChange(t.id); }}
            disabled={isDisabled}
            style={{
              padding: '8px 18px',
              background: isActive ? COL.panel : 'transparent',
              color: isDisabled ? COL.inkDim : (isActive ? COL.ink : COL.inkDim),
              border: `1px solid ${isActive ? COL.rule : 'transparent'}`,
              borderBottom: isActive ? `1px solid ${COL.panel}` : 'none',
              borderRadius: '4px 4px 0 0',
              marginBottom: -1,
              fontFamily: FONTS.mono,
              fontSize: 13,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontWeight: isActive ? 600 : 500,
              cursor: isDisabled ? 'not-allowed' : (isActive ? 'default' : 'pointer'),
              opacity: isDisabled ? 0.4 : 1,
            }}
            title={isDisabled ? 'Coming later' : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================
// TAB 2 — variable width L, quantum only
// =============================================================

// Well-only visual: a rectangular box whose width scales linearly
// with L / L_MAX. Anchored to the centre of the panel so growth /
// shrink is symmetric. Dashed line at the rim marks V0; the depth
// dimension is fixed because V0 is not yet varied in this tab.
function WellView({ lengthNm, v0eV, eStar, nBound, col, wall, bg, ionisedCol, ink, inkDim, mono }) {
  const W = 480, H = 170;
  const PAD_L = 50, PAD_R = 50;
  const INNER_W = W - PAD_L - PAD_R;
  const ceilY  = 30;
  const floorY = H - 20;

  // Width in pixels proportional to L; horizontally centred.
  const lFrac      = Math.max(0, Math.min(1, lengthNm / L_MAX_NM));
  const boxWidthPx = lFrac * INNER_W;
  const centreX    = PAD_L + INNER_W / 2;
  const wallLeft   = centreX - boxWidthPx / 2;
  const wallRight  = centreX + boxWidthPx / 2;

  // Tick marks every 1 nm under the floor for spatial calibration.
  const ticks = [];
  for (let nm = 0; nm <= Math.ceil(L_MAX_NM); nm++) {
    const xFrac = nm / L_MAX_NM;
    const px = centreX - INNER_W / 2 + xFrac * INNER_W;
    ticks.push({ nm, px });
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: bg, borderRadius: 2 }}>
      {/* Floor of the well (V = 0). Always spans the full plot area so
          the "outside" region around a small well is still visible. */}
      <line x1={PAD_L} x2={W - PAD_R} y1={floorY} y2={floorY}
        stroke={wall} strokeWidth={1} opacity={0.35} strokeDasharray="2 4" />
      <line x1={wallLeft} x2={wallRight} y1={floorY} y2={floorY}
        stroke={wall} strokeWidth={2} />

      {/* Walls of the well. Thinner than tab 1's particle view because
          this panel has more empty space around the box; the heavier
          stroke that reads well next to a 6-pixel particle dot looks
          chunky here. */}
      <line x1={wallLeft}  x2={wallLeft}  y1={ceilY} y2={floorY}
        stroke={wall} strokeWidth={2} />
      <line x1={wallRight} x2={wallRight} y1={ceilY} y2={floorY}
        stroke={wall} strokeWidth={2} />

      {/* V0 rim — dashed, ionised colour to echo tab 1's threshold line. */}
      <line x1={wallLeft} x2={wallRight} y1={ceilY} y2={ceilY}
        stroke={ionisedCol} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      <text x={wallRight + 6} y={ceilY + 4}
        fill={ionisedCol} fontFamily={mono} fontSize={12}>
        V₀ = {v0eV.toFixed(2)} eV
      </text>

      {/* L caliper — short tick marks at the wall positions and a label
          centred below the floor so the student reads width directly. */}
      <line x1={wallLeft}  x2={wallLeft}  y1={floorY + 4} y2={floorY + 10} stroke={col} strokeWidth={1} />
      <line x1={wallRight} x2={wallRight} y1={floorY + 4} y2={floorY + 10} stroke={col} strokeWidth={1} />
      <line x1={wallLeft}  x2={wallRight} y1={floorY + 7} y2={floorY + 7}  stroke={col} strokeWidth={1} />
      <text x={centreX} y={floorY + 24} textAnchor="middle"
        fill={col} fontFamily={mono} fontSize={13} fontVariantNumeric="tabular-nums">
        L = {lengthNm.toFixed(2)} nm
      </text>

      {/* nm scale ticks at the bottom of the panel — fixed reference so
          the changing box has something invariant to scale against. */}
      {ticks.map((t) => (
        <g key={t.nm}>
          <line x1={t.px} x2={t.px} y1={H - 6} y2={H - 2}
            stroke={inkDim} strokeWidth={1} opacity={0.4} />
          {t.nm % 1 === 0 && (
            <text x={t.px} y={H - 8} textAnchor="middle"
              fill={inkDim} fontFamily={mono} fontSize={10} opacity={0.5}>
              {t.nm}
            </text>
          )}
        </g>
      ))}

      {/* E* and bound-count overlay in the header band, mirroring how
          ⟨x⟩ / ⟨E⟩ are shown in tab 1's panels. */}
      <text x={PAD_L} y={ceilY - 10} textAnchor="start"
        fontFamily={mono} fontSize={13} fontVariantNumeric="tabular-nums">
        <tspan fill={inkDim}>E</tspan>
        <tspan fill={inkDim} dy={-4} fontSize={10}>*</tspan>
        <tspan fill={inkDim} dy={4}> = </tspan>
        <tspan fill={ink}>{eStar.toFixed(4)}</tspan>
        <tspan fill={inkDim} fontSize={11}> eV</tspan>
      </text>
      <text x={W - PAD_R} y={ceilY - 10} textAnchor="end"
        fontFamily={mono} fontSize={13} fontVariantNumeric="tabular-nums">
        <tspan fill={inkDim}>bound states: </tspan>
        <tspan fill={ink}>{nBound}</tspan>
      </text>
    </svg>
  );
}

// One side of tab 2's A | B comparison. Owns the per-system controls
// (L, m*, V0), the well diagram, and the three live quantum panels.
// Everything per-system is passed in by props; shared values (the
// energy slider's eV value, the σ/Γ controls' eV values, the
// show-theory / show-eigen toggles) come in by props too so the
// parent stays the single source of truth for prep state.
function Tab2SystemPanel({
  label,
  lengthVal, setLengthVal,
  mEffVal,   setMEffVal,
  v0Val,     setV0Val,
  gammaVal,  setGammaVal,
  sigmaVal,  setSigmaVal,
  energyVal, setEnergyVal, setEnergyByIndex,
  // Per-parameter A↔B link state + toggles. Identical for A and B
  // (they're shared state lifted to the parent); each system panel
  // renders its own LinkToggle but they reflect the same boolean.
  linkedL,      toggleLinkedL,
  linkedMEff,   toggleLinkedMEff,
  linkedV0,     toggleLinkedV0,
  linkedGamma,  toggleLinkedGamma,
  linkedSigma,  toggleLinkedSigma,
  linkedEnergy, toggleLinkedEnergy,
  eStar, V0Internal, states, eigenStatesEv,
  isIonised, probs,
  tCurrent, qXLatest, qRecentX, qRecentE,
  qXHistDensity, qEHistDensity, qxMean, qeMean,
  qIonisedFrac, qLeakFrac,
  qPosTheory, qEnergyTheory,
  psiMode, setPsiMode,
  eHistMaxEv, v0Max,
  showEigen, showTheory, logEnergy, setLogEnergy,
  xMinNm, xMaxNm,
}) {
  // Tight grid rows: [label 78px] [flex spacer 1fr] [stepper auto] [lock 24px].
  // The stepper (− value +) sits on the right next to the lock; the
  // flex spacer absorbs whatever width is left. CSS grid keeps the
  // link icons in every row aligned at the same x position.
  const labelMin = 78;
  const valueWidth = 52;
  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: `${labelMin}px 1fr auto 24px`,
    gap: 8, alignItems: 'center',
  };
  const labelStyle = {
    fontFamily: FONTS.mono, fontSize: 12, color: COL.ink,
    letterSpacing: 0.3, whiteSpace: 'nowrap',
  };
  const valueStyle = (col) => ({
    textAlign: 'right',
    fontFamily: FONTS.mono, fontSize: 13, fontVariantNumeric: 'tabular-nums',
    color: col, fontWeight: 600,
  });
  const linkProps = { accent: COL.accent, inkDim: COL.inkDim };

  // σ/Γ slider range — bounded by the deeper of the two wells so wide-Γ
  // exploration still has headroom in the narrower system.
  const sigmaGammaMax = Math.max(0.5, v0Max / 4);

  // Particle preset dropdown anchored to the m*/m_e label. The dedicated
  // "Particle" row collapsed into the m* slider row to save vertical
  // space: clicking the label opens the menu, picking a preset writes
  // the mass and closes.
  const [particleMenuOpen, setParticleMenuOpen] = useState(false);
  const currentPresetId = matchPreset(mEffVal);

  return (
    <section style={{ ...panelStyle(), display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
        <PanelHeader tag={`System ${label}`} color={COL.accent} />
        <div style={{
          fontFamily: FONTS.mono, fontSize: 11, color: COL.inkDim,
          fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          <span>E<sup>*</sup>=<span style={{ color: COL.ink }}>{eStar < 0.001 ? eStar.toExponential(2) : eStar.toFixed(4)}</span></span>
          <span><i>V</i><sub>0</sub>/E<sup>*</sup>=<span style={{ color: COL.ink }}>{V0Internal.toFixed(1)}</span></span>
          <span>bound:<span style={{ color: COL.ink }}>{' '}{states.length}</span></span>
        </div>
      </div>

      {/* Controls row: 5 parameter sliders on the left, compact
          vertical energy slider on the right, with a 1-px vertical
          rule between them so the energy column reads as a distinct
          control region rather than blending into the well-parameter
          stack. `alignItems: stretch` gives the controls column the
          slider's full height; inside, `justify-content: space-between`
          distributes the 5 rows so the first lines up with the slider's
          "Energy" label and the last with the value + link toggle. */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>

      {/* L stepper */}
      <div style={rowStyle} title="Width of this well in nanometres.">
        <div style={labelStyle}>Width <i>L</i></div>
        <div />
        <Stepper
          value={lengthVal} onChange={setLengthVal}
          min={L_MIN_NM} max={L_MAX_NM} step={L_STEP_NM} decimals={2}
          color={COL.accent} rule={COL.rule} mono={FONTS.mono}
          valueWidth={valueWidth}
        />
        <LinkToggle linked={linkedL} onToggle={toggleLinkedL} {...linkProps} />
      </div>

      {/* Effective mass row. The "m-over-m_e" label is a clickable
          button that opens the particle-preset menu; the rest of the
          row is the usual log-scale stepper + editable value + lock. */}
      <div style={rowStyle}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setParticleMenuOpen((o) => !o)}
            title="Click to choose a particle preset"
            style={{
              ...labelStyle,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', textAlign: 'left',
              display: 'inline-flex', alignItems: 'baseline', gap: 3,
              textDecoration: 'underline dotted',
              textDecorationColor: COL.inkDim,
              textUnderlineOffset: 2,
            }}
          >
            <span>m<sup>*</sup>/m<sub>e</sub></span>
            <span style={{ fontSize: 9, color: COL.inkDim }}>▾</span>
          </button>
          {particleMenuOpen && (
            <>
              {/* Transparent backdrop captures outside-clicks to close
                  the menu without needing a document-level listener. */}
              <div
                onClick={() => setParticleMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
              />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: COL.panel, border: `1px solid ${COL.rule}`,
                borderRadius: 4, padding: 4, zIndex: 20, minWidth: 240,
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.55)',
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                {PARTICLE_PRESETS.map((p) => {
                  const isCurrent = currentPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setMEffVal(p.m); setParticleMenuOpen(false); }}
                      style={{
                        textAlign: 'left',
                        background: isCurrent ? COL.rule : 'transparent',
                        color: isCurrent ? COL.ink : COL.inkDim,
                        border: 'none', padding: '5px 9px',
                        fontFamily: FONTS.mono, fontSize: 12,
                        cursor: 'pointer', borderRadius: 2,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {currentPresetId === 'custom' && (
                  <div style={{
                    padding: '5px 9px', color: COL.inkDim,
                    fontFamily: FONTS.mono, fontSize: 11, fontStyle: 'italic',
                    borderTop: `1px solid ${COL.rule}`, marginTop: 2,
                  }}>
                    Current value is custom; pick a preset above or close to keep it.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div />
        <Stepper
          value={mEffVal} onChange={setMEffVal}
          min={M_MIN_ME} max={M_MAX_ME}
          step={Math.pow(10, 0.1)}  // multiplicative: ~×1.26 per click (10 clicks per decade)
          multiplicative={true} decimals={2}
          displayFn={(v) => (v < 100 ? v.toFixed(2) : v.toExponential(1))}
          color={COL.accent} rule={COL.rule} mono={FONTS.mono}
          valueWidth={valueWidth}
        />
        <LinkToggle linked={linkedMEff} onToggle={toggleLinkedMEff} {...linkProps} />
      </div>

      {/* V0 stepper */}
      <div style={rowStyle} title="Well depth in eV.">
        <div style={labelStyle}>Depth <i>V</i><sub>0</sub></div>
        <div />
        <Stepper
          value={v0Val} onChange={setV0Val}
          min={V0_MIN_EV} max={V0_MAX_EV} step={V0_STEP_EV} decimals={1}
          color={COL.ionised} rule={COL.rule} mono={FONTS.mono}
          valueWidth={valueWidth}
        />
        <LinkToggle linked={linkedV0} onToggle={toggleLinkedV0} {...linkProps} />
      </div>

      {/* Γ stepper — preparation Lorentzian width in eV. Short label
          keeps the row in line; the tooltip carries the longer
          explanation. */}
      <div style={rowStyle} title="Γ — preparation Lorentzian width in eV. Γ = 0 picks a single eigenstate; wider Γ blends several.">
        <div style={labelStyle}>Γ <span style={{ color: COL.inkDim, fontSize: 11 }}>(prep)</span></div>
        <div />
        <Stepper
          value={gammaVal} onChange={setGammaVal}
          min={0} max={sigmaGammaMax} step={0.01} decimals={2}
          color={COL.accent} rule={COL.rule} mono={FONTS.mono}
          valueWidth={valueWidth}
        />
        <LinkToggle linked={linkedGamma} onToggle={toggleLinkedGamma} {...linkProps} />
      </div>

      {/* σ stepper — instrument-resolution Gaussian σ in eV. */}
      <div style={rowStyle} title="σ — instrument-resolution Gaussian σ in eV. Each energy measurement is broadened by this much.">
        <div style={labelStyle}>σ <span style={{ color: COL.inkDim, fontSize: 11 }}>(res)</span></div>
        <div />
        <Stepper
          value={sigmaVal} onChange={setSigmaVal}
          min={0} max={sigmaGammaMax} step={0.01} decimals={2}
          color={COL.accent} rule={COL.rule} mono={FONTS.mono}
          valueWidth={valueWidth}
        />
        <LinkToggle linked={linkedSigma} onToggle={toggleLinkedSigma} {...linkProps} />
      </div>

        </div>{/* end controls column */}

        {/* Vertical rule separating the well-parameter controls from
            the energy region — small visual cue that the energy slider
            is a different kind of control (sets the preparation, not
            the box). */}
        <div style={{ width: 1, background: COL.ruleHi, alignSelf: 'stretch', marginLeft: 10 }} />

        {/* Vertical energy slider. Slider max = this system's V₀ (no
            continuum region) so the student can only select bound
            energies; the V₀ label naturally lives at the top of the
            track because v0 == max. Energy link toggle sits inline
            with the value display rather than dangling below. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <VerticalSlider
            label="Energy"
            value={energyVal}
            onChange={setEnergyVal}
            min={0}
            max={v0Val}
            accent={COL.accent}
            ionisedAccent={COL.ionised}
            rule={COL.rule}
            inkDim={COL.inkDim}
            ink={COL.ink}
            mono={FONTS.mono}
            v0={v0Val}
            decimals={2}
            ticks={showEigen ? eigenStatesEv.map((s) => s.E) : null}
            onTickClick={showEigen ? (E, i) => setEnergyByIndex(i) : null}
            tickAccent={COL.quantum}
            trackHeight={140}
            activeTickTolerance={0.005}
            v0LabelSide="right"
            valueAddon={
              <LinkToggle linked={linkedEnergy} onToggle={toggleLinkedEnergy} accent={COL.accent} inkDim={COL.inkDim} />
            }
          />
        </div>
      </div>{/* end controls + slider row */}

      {/* Sim stack at full system-panel width. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SegmentedToggle
          value={psiMode}
          onChange={setPsiMode}
          options={[
            { value: 'density',      label: '|ψ|²' },
            { value: 'wavefunction', label: 'ψ' },
            { value: 'off',          label: 'Off' },
          ]}
          accent={COL.quantum}
          inkDim={COL.inkDim}
          rule={COL.rule}
          mono={FONTS.mono}
        />
      </div>

      <WavefunctionView
        states={states}
        probs={probs}
        t={tCurrent}
        isIonised={isIonised}
        psiMode={psiMode}
        latestX={qXLatest}
        recentMeasurements={qRecentX}
        col={COL.quantum}
        wall={COL.ink}
        bg={COL.panel}
        ionisedCol={COL.ionised}
        mono={FONTS.mono}
        lengthNm={lengthVal}
        xMinNm={xMinNm}
        xMaxNm={xMaxNm}
      />

      <PositionHistogram
        hist={qXHistDensity}
        recentMarkers={qRecentX}
        col={COL.quantum}
        ink={COL.ink}
        inkDim={COL.inkDim}
        rule={COL.rule}
        mono={FONTS.mono}
        meanX={qxMean}
        isIonised={isIonised}
        ionisedCol={COL.ionised}
        leakFrac={qLeakFrac}
        overlay={showTheory ? qPosTheory : null}
        lengthNm={lengthVal}
        xMinNm={xMinNm}
        xMaxNm={xMaxNm}
      />

      <EnergyHistogram
        hist={qEHistDensity}
        recentMarkers={qRecentE}
        col={COL.quantum}
        ink={COL.ink}
        inkDim={COL.inkDim}
        rule={COL.rule}
        mono={FONTS.mono}
        eSet={energyVal}
        meanE={qeMean}
        v0={v0Val}
        eHistMax={eHistMaxEv}
        ionisedCol={COL.ionised}
        accent={COL.accent}
        ionisedFrac={qIonisedFrac}
        eigenStates={showEigen ? eigenStatesEv : null}
        theoryCurve={showTheory ? qEnergyTheory : null}
        logY={logEnergy}
        onToggleLogY={() => setLogEnergy((v) => !v)}
        energyUnitLabel="eV"
      />
    </section>
  );
}

function Tab2Content({ activeTab, onChangeTab }) {
  // System A and B geometry. Each "system" is a quantum well with its
  // own width, effective mass, and depth; preparation (energy slider,
  // σ, Γ) is shared across both so the diff between the two panels
  // traces to geometry alone. Defaults give a visible contrast on first
  // load — A is the narrow shallow well, B is twice as wide.
  const [lengthA, setLengthA] = useSavedState('redux:tab2.A.lengthNm', 1.0);
  const [mEffA,   setMEffA]   = useSavedState('redux:tab2.A.mEffMe',   1.0);
  const [v0A,     setV0A]     = useSavedState('redux:tab2.A.v0eV',     5.0);
  const [lengthB, setLengthB] = useSavedState('redux:tab2.B.lengthNm', 2.0);
  const [mEffB,   setMEffB]   = useSavedState('redux:tab2.B.mEffMe',   1.0);
  const [v0B,     setV0B]     = useSavedState('redux:tab2.B.v0eV',     5.0);
  // Shared display cap on bound-state count (one number governs both
  // panels — it's a UI knob, not a physical knob).
  const [maxBoundCap,    setMaxBoundCap]    = useSavedState('redux:tab2.maxBoundCap', 8);
  // Per-tab preferences shared via the Settings modal. Same shape as
  // tab 1's, namespaced under `redux:tab2.*` so the two tabs can
  // diverge if the student wants.
  const [pauseIncrement, setPauseIncrement] = useSavedState('redux:tab2.pauseIncrement', 10000);
  const [waveTimeMult,   setWaveTimeMult]   = useSavedState('redux:tab2.waveTimeMult',   1);
  const [language,       setLanguage]       = useSavedState('redux:language',            'en');
  const [showNotes,      setShowNotes]      = useSavedState('redux:tab2.showNotes',      false);
  const [spectroscopyExpanded, setSpectroscopyExpanded] = useSavedState('redux:tab2.spectroscopyExpanded', false);
  const [randomSeed,     setRandomSeed]     = useState(0);  // per-session
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [saveMenuOpen,   setSaveMenuOpen]   = useState(false);
  const [pendingLoadFile, setPendingLoadFile] = useState(null);
  // Cross-tab import: a tab 1 single-system file landing in tab 2's
  // loader. User picks which side (A or B) to drop it into; the other
  // side stays untouched.
  const [pendingCrossImport, setPendingCrossImport] = useState(null);
  const isLoadingRef = useRef(false);
  // Hidden file input — the Load button clicks this ref to open the
  // OS file picker (more reliable than a <label>-wrapped pattern).
  const fileInputRefTab2 = useRef(null);

  // Per-system real → engine conversions. Independent because eStar
  // depends on L and m* (and a slight V0-eV ratio dependence flows
  // through to V0Internal).
  const { eStarEv: eStarA, V0Internal: V0IntA, eToEv: eToEvA } = useMemo(
    () => realToInternal(lengthA, mEffA, v0A),
    [lengthA, mEffA, v0A],
  );
  const { eStarEv: eStarB, V0Internal: V0IntB, eToEv: eToEvB } = useMemo(
    () => realToInternal(lengthB, mEffB, v0B),
    [lengthB, mEffB, v0B],
  );
  const statesA = useMemo(() => findBoundStates(V0IntA, maxBoundCap), [V0IntA, maxBoundCap]);
  const statesB = useMemo(() => findBoundStates(V0IntB, maxBoundCap), [V0IntB, maxBoundCap]);

  // Shared energy-slider range. The slider must cover both wells —
  // taking max(V0_A, V0_B) means whichever side is deeper still has
  // its full bound spectrum on the slider. eHistMax sets the eV
  // binning width too, so a single slider drives both panels' axes.
  // Per-system energy axes. Each side's slider and energy histogram
  // span [0, 1.4 × V₀_X], so a deep B doesn't squash A's bound
  // spectrum off the bottom of A's panel and vice versa. v0Max is
  // still useful for the σ/Γ slider range (a wide value can be
  // meaningful for either system).
  const v0Max        = Math.max(v0A, v0B);
  const eHistMaxEvA  = Math.round(1.4 * v0A * 100) / 100;
  const eHistMaxEvB  = Math.round(1.4 * v0B * 100) / 100;
  const eSliderMinEv = 0;

  // Per-system preparation energy. Each side starts on its own ground
  // state — different absolute eV values for different geometries.
  // The energy link toggle below couples the two when the student
  // wants the "same eV in both wells" view.
  const [energyA, setEnergyA] = useState(() => {
    const initS = findBoundStates(V0IntA, maxBoundCap);
    const initE = initS[0] ? eToEvA(initS[0].E) : 0.3;
    return Math.round(initE * 100) / 100;
  });
  const [energyB, setEnergyB] = useState(() => {
    const initS = findBoundStates(V0IntB, maxBoundCap);
    const initE = initS[0] ? eToEvB(initS[0].E) : 0.3;
    return Math.round(initE * 100) / 100;
  });
  // σ and Γ are now per-system. Default-linked (the lock toggles below
  // default to true for these two), so out of the box the student sees
  // "same instrument, same preparation, different box" — change one
  // side's slider and the other tracks. Either can be unlinked to
  // compare what e.g. a sharper preparation does in well A only.
  const [sigmaA,     setSigmaA]     = useState(0);
  const [sigmaB,     setSigmaB]     = useState(0);
  const [gammaA,     setGammaA]     = useState(0);
  const [gammaB,     setGammaB]     = useState(0);
  const [running,    setRunning]    = useState(false);
  const [showEigen,  setShowEigen]  = useState(false);
  const [showTheory, setShowTheory] = useState(false);
  const [psiModeA,   setPsiModeA]   = useSavedState('redux:tab2.A.psiMode', 'density');
  const [psiModeB,   setPsiModeB]   = useSavedState('redux:tab2.B.psiMode', 'density');
  const [logEnergy,  setLogEnergy]  = useState(false);
  const [, setTick] = useState(0);

  // Per-parameter A↔B link state. The geometry knobs (L, m*, V₀)
  // default to unlinked because the whole point of two systems is to
  // contrast their geometries; the preparation knobs (Γ, σ) default
  // to linked because the typical pedagogy is "same prep, different
  // box" and the student probably wants to start there.
  const [linkedL,     setLinkedL]     = useSavedState('redux:tab2.linkedL',     true);
  const [linkedMEff,  setLinkedMEff]  = useSavedState('redux:tab2.linkedMEff',  true);
  const [linkedV0,    setLinkedV0]    = useSavedState('redux:tab2.linkedV0',    true);
  const [linkedGamma, setLinkedGamma] = useSavedState('redux:tab2.linkedGamma', true);
  const [linkedSigma, setLinkedSigma] = useSavedState('redux:tab2.linkedSigma', true);
  // Energy defaults to unlinked: the default workflow is "compare n=k
  // across geometries", which means each side sits on its own E_n in
  // its own eV. The student can lock it for "same prep energy in
  // both wells" comparisons.
  const [linkedEnergy, setLinkedEnergy] = useSavedState('redux:tab2.linkedEnergy', true);

  // Wrapped setters that propagate changes when the corresponding lock
  // is on. Either side's setter can drive both — the lock is symmetric.
  // (`linkedX` is read directly inside the setter; React's closure
  // captures the latest value because these are defined inline on
  // every render.)
  const setLengthAWithLink = (v) => { setLengthA(v); if (linkedL) setLengthB(v); };
  const setLengthBWithLink = (v) => { setLengthB(v); if (linkedL) setLengthA(v); };
  const setMEffAWithLink   = (v) => { setMEffA(v);   if (linkedMEff) setMEffB(v); };
  const setMEffBWithLink   = (v) => { setMEffB(v);   if (linkedMEff) setMEffA(v); };
  const setV0AWithLink     = (v) => { setV0A(v);    if (linkedV0) setV0B(v); };
  const setV0BWithLink     = (v) => { setV0B(v);    if (linkedV0) setV0A(v); };
  const setGammaAWithLink  = (v) => { setGammaA(v); if (linkedGamma) setGammaB(v); };
  const setGammaBWithLink  = (v) => { setGammaB(v); if (linkedGamma) setGammaA(v); };
  const setSigmaAWithLink  = (v) => { setSigmaA(v); if (linkedSigma) setSigmaB(v); };
  const setSigmaBWithLink  = (v) => { setSigmaB(v); if (linkedSigma) setSigmaA(v); };
  const setEnergyAWithLink = (v) => { setEnergyA(v); if (linkedEnergy) setEnergyB(v); };
  const setEnergyBWithLink = (v) => { setEnergyB(v); if (linkedEnergy) setEnergyA(v); };

  // Eigenstate-aware energy setters: when the student clicks the n=k
  // tick on one side's slider, the linked partner snaps to its own
  // n=k eigenvalue (different absolute eV, same quantum number) rather
  // than copying the eV value. Falls back to eV-matching if the
  // partner doesn't have a k-th bound state (e.g. shallow well).
  const setEnergyAByIndex = (i) => {
    if (!statesA[i]) return;
    const evA = Math.round(statesA[i].E * eStarA * 100) / 100;
    setEnergyA(evA);
    if (linkedEnergy) {
      if (statesB[i]) {
        setEnergyB(Math.round(statesB[i].E * eStarB * 100) / 100);
      } else {
        setEnergyB(evA);  // partner has no n=i state — match eV
      }
    }
  };
  const setEnergyBByIndex = (i) => {
    if (!statesB[i]) return;
    const evB = Math.round(statesB[i].E * eStarB * 100) / 100;
    setEnergyB(evB);
    if (linkedEnergy) {
      if (statesA[i]) {
        setEnergyA(Math.round(statesA[i].E * eStarA * 100) / 100);
      } else {
        setEnergyA(evB);
      }
    }
  };

  // Detect whether a side's current energy lands on (within rounding
  // of) any of its bound states. Used by the energy lock-on toggle to
  // decide whether to pair by index (eigenstate workflow) or by eV.
  function eigenstateIndexAt(energyEv, states, eStarX) {
    for (let i = 0; i < states.length; i++) {
      if (Math.abs(energyEv - states[i].E * eStarX) < 0.005) return i;
    }
    return -1;
  }

  // Toggling a lock ON syncs B to A's current value so the two sides
  // are immediately consistent. Toggling OFF leaves both untouched.
  const toggleLinkedL     = () => { if (!linkedL)     setLengthB(lengthA); setLinkedL(!linkedL); };
  const toggleLinkedMEff  = () => { if (!linkedMEff)  setMEffB(mEffA);     setLinkedMEff(!linkedMEff); };
  const toggleLinkedV0    = () => { if (!linkedV0)    setV0B(v0A);          setLinkedV0(!linkedV0); };
  const toggleLinkedGamma = () => { if (!linkedGamma) setGammaB(gammaA);   setLinkedGamma(!linkedGamma); };
  const toggleLinkedSigma  = () => { if (!linkedSigma)  setSigmaB(sigmaA);   setLinkedSigma(!linkedSigma); };
  const toggleLinkedEnergy = () => {
    // Smart sync at lock-on: if A is sitting on its E_n, pair B with
    // its own E_n (same quantum number, different absolute eV). If A
    // is on an arbitrary value (continuous drag), pair B by eV.
    if (!linkedEnergy) {
      const idxA = eigenstateIndexAt(energyA, statesA, eStarA);
      if (idxA >= 0 && statesB[idxA]) {
        setEnergyB(Math.round(statesB[idxA].E * eStarB * 100) / 100);
      } else {
        setEnergyB(energyA);
      }
    }
    setLinkedEnergy(!linkedEnergy);
  };

  // Ionisation is per-system: now each side has its own prep energy too,
  // so isIonised compares system X's energy against system X's V₀.
  const isIonisedA = energyA > v0A;
  const isIonisedB = energyB > v0B;
  const allIonised = isIonisedA && isIonisedB;

  // Per-system Γ_internal — uses each side's own Γ-in-eV and eStar.
  const gammaIntA = Math.max(GAMMA_INTERNAL_MIN, 1 + gammaA / eStarA);
  const gammaIntB = Math.max(GAMMA_INTERNAL_MIN, 1 + gammaB / eStarB);

  const probsA = useMemo(
    () => computeProbs(energyA / eStarA, gammaIntA, statesA),
    [energyA, eStarA, gammaIntA, statesA],
  );
  const probsB = useMemo(
    () => computeProbs(energyB / eStarB, gammaIntB, statesB),
    [energyB, eStarB, gammaIntB, statesB],
  );

  // --- Mirror refs for the rAF loop. Every per-system value (energy,
  // σ, Γ, eStar, V0_int, states, probs, eHistMax_eV) is mirrored as an
  // A/B pair so the loop can read each side independently. ---
  const pauseIncrementRef = useRef(pauseIncrement);
  const waveTimeMultRef   = useRef(waveTimeMult);
  const prngSeedRef       = useRef(randomSeed);
  useEffect(() => { pauseIncrementRef.current = pauseIncrement; }, [pauseIncrement]);
  useEffect(() => { waveTimeMultRef.current   = waveTimeMult;   }, [waveTimeMult]);
  // Re-seed both PRNGs whenever the seed changes — gives reproducible
  // runs when the seed is set, falls back to Math.random when 0.
  useEffect(() => {
    prngSeedRef.current = randomSeed;
    prngARef.current = makePRNG(randomSeed === 0 ? 0 : (randomSeed ^ PRNG_ROOT_A) >>> 0);
    prngBRef.current = makePRNG(randomSeed === 0 ? 0 : (randomSeed ^ PRNG_ROOT_B) >>> 0);
  }, [randomSeed]);  // eslint-disable-line react-hooks/exhaustive-deps
  const energyARef     = useRef(energyA);
  const energyBRef     = useRef(energyB);
  const sigmaARef      = useRef(sigmaA);
  const sigmaBRef      = useRef(sigmaB);
  const gammaARef      = useRef(gammaA);
  const gammaBRef      = useRef(gammaB);
  const eHistMaxEvARef = useRef(eHistMaxEvA);
  const eHistMaxEvBRef = useRef(eHistMaxEvB);
  const eStarARef      = useRef(eStarA);
  const V0IntARef      = useRef(V0IntA);
  const statesARef     = useRef(statesA);
  const probsARef      = useRef(probsA);
  const eStarBRef      = useRef(eStarB);
  const V0IntBRef      = useRef(V0IntB);
  const statesBRef     = useRef(statesB);
  const probsBRef      = useRef(probsB);
  useEffect(() => { energyARef.current     = energyA;     }, [energyA]);
  useEffect(() => { energyBRef.current     = energyB;     }, [energyB]);
  useEffect(() => { sigmaARef.current      = sigmaA;      }, [sigmaA]);
  useEffect(() => { sigmaBRef.current      = sigmaB;      }, [sigmaB]);
  useEffect(() => { gammaARef.current      = gammaA;      }, [gammaA]);
  useEffect(() => { gammaBRef.current      = gammaB;      }, [gammaB]);
  useEffect(() => { eHistMaxEvARef.current = eHistMaxEvA; }, [eHistMaxEvA]);
  useEffect(() => { eHistMaxEvBRef.current = eHistMaxEvB; }, [eHistMaxEvB]);
  useEffect(() => { eStarARef.current  = eStarA;  }, [eStarA]);
  useEffect(() => { V0IntARef.current  = V0IntA;  }, [V0IntA]);
  useEffect(() => { statesARef.current = statesA; }, [statesA]);
  useEffect(() => { probsARef.current  = probsA;  }, [probsA]);
  useEffect(() => { eStarBRef.current  = eStarB;  }, [eStarB]);
  useEffect(() => { V0IntBRef.current  = V0IntB;  }, [V0IntB]);
  useEffect(() => { statesBRef.current = statesB; }, [statesB]);
  useEffect(() => { probsBRef.current  = probsB;  }, [probsB]);

  // --- Per-system simulation refs. Each side gets its own histograms,
  // sums, counters, flash buffers, time, PRNG. The two PRNGs share a
  // pair of constant root seeds so seeded runs are reproducible, but
  // advance independently — otherwise their flash patterns lockstep,
  // which would mislead students into thinking the noise is correlated. ---
  const PRNG_ROOT_A = 0x5EEDA;
  const PRNG_ROOT_B = 0x5EEDB;

  const qXHistARef         = useRef(new Float64Array(NBINS_X));
  const qEHistARef         = useRef(new Float64Array(NBINS_E));
  const qXSumARef          = useRef(0);
  const qESumARef          = useRef(0);
  const qXCountARef        = useRef(0);
  const qECountARef        = useRef(0);
  const qIonisedCountARef  = useRef(0);
  const qXOutsideCountARef = useRef(0);
  const qXLatestARef       = useRef(L / 2);
  const qRecentXARef       = useRef([]);
  const qRecentEARef       = useRef([]);
  const qFlashCounterARef  = useRef(0);
  const tARef              = useRef(0);
  const nextPauseARef      = useRef(PAUSE_INCREMENT);
  const lastResetARef      = useRef(0);
  const prngARef           = useRef(makePRNG(PRNG_ROOT_A));

  const qXHistBRef         = useRef(new Float64Array(NBINS_X));
  const qEHistBRef         = useRef(new Float64Array(NBINS_E));
  const qXSumBRef          = useRef(0);
  const qESumBRef          = useRef(0);
  const qXCountBRef        = useRef(0);
  const qECountBRef        = useRef(0);
  const qIonisedCountBRef  = useRef(0);
  const qXOutsideCountBRef = useRef(0);
  const qXLatestBRef       = useRef(L / 2);
  const qRecentXBRef       = useRef([]);
  const qRecentEBRef       = useRef([]);
  const qFlashCounterBRef  = useRef(0);
  const tBRef              = useRef(0);
  const nextPauseBRef      = useRef(PAUSE_INCREMENT);
  const lastResetBRef      = useRef(0);
  const prngBRef           = useRef(makePRNG(PRNG_ROOT_B));

  // --- Per-system reset on geometry change. Tracks each side's three
  // real-units parameters directly so a change is caught even in the
  // (rare) degenerate case where two changes leave V0_int unchanged
  // (e.g. L → 2L and m* → m*/2 together). The reset pauses the whole
  // sim so the wipe is visible, matching tab 1. ---
  const isFirstResetARef = useRef(true);
  useEffect(() => {
    if (isFirstResetARef.current) { isFirstResetARef.current = false; return; }
    if (isLoadingRef.current) return;  // load is restoring; don't wipe
    qXHistARef.current = new Float64Array(NBINS_X);
    qEHistARef.current = new Float64Array(NBINS_E);
    qXSumARef.current = 0; qESumARef.current = 0;
    qXCountARef.current = 0; qECountARef.current = 0;
    qIonisedCountARef.current = 0; qXOutsideCountARef.current = 0;
    qRecentXARef.current = []; qRecentEARef.current = []; qFlashCounterARef.current = 0;
    nextPauseARef.current = pauseIncrementRef.current;
    tARef.current = 0;
    lastResetARef.current = performance.now();
    setRunning(false);
    setTick((t) => t + 1);
  }, [lengthA, mEffA, v0A]);

  const isFirstResetBRef = useRef(true);
  useEffect(() => {
    if (isFirstResetBRef.current) { isFirstResetBRef.current = false; return; }
    if (isLoadingRef.current) return;
    qXHistBRef.current = new Float64Array(NBINS_X);
    qEHistBRef.current = new Float64Array(NBINS_E);
    qXSumBRef.current = 0; qESumBRef.current = 0;
    qXCountBRef.current = 0; qECountBRef.current = 0;
    qIonisedCountBRef.current = 0; qXOutsideCountBRef.current = 0;
    qRecentXBRef.current = []; qRecentEBRef.current = []; qFlashCounterBRef.current = 0;
    nextPauseBRef.current = pauseIncrementRef.current;
    tBRef.current = 0;
    lastResetBRef.current = performance.now();
    setRunning(false);
    setTick((t) => t + 1);
  }, [lengthB, mEffB, v0B]);

  // Per-system slider clamp on V₀ change. When v0X drops, eHistMaxEvX
  // shrinks; pull energyX back inside the new axis so the slider
  // doesn't sit past its own ceiling.
  useEffect(() => { if (energyA > eHistMaxEvA) setEnergyA(eHistMaxEvA); }, [eHistMaxEvA]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (energyB > eHistMaxEvB) setEnergyB(eHistMaxEvB); }, [eHistMaxEvB]);  // eslint-disable-line react-hooks/exhaustive-deps

  // --- Dual simulation loop. Each rAF tick steps both systems with
  // their own PRNG. Either side hitting its pause cap pauses the
  // whole sim; otherwise paused-on-A would still advance B and the
  // counts would drift. Ionised sides skip the step but their refs
  // still age (no flashes accumulate). ---
  useEffect(() => {
    if (!running || allIonised) return;
    let rafId = 0;
    let last = performance.now();

    function stepSide(
      eStarLoop, V0_int, statesLoop, probsLoop, rng, tLocalRef,
      sigmaR, gammaR, energyR, eHistMaxEvR,
      qXHist, qEHist, qXSumR, qESumR, qXCountR, qECountR,
      qIonisedR, qXOutR, qXLatestR, qRecentXR, qRecentER, qFlashR,
    ) {
      const E_int = energyR.current / eStarLoop;
      const sigma_eV = sigmaR.current;
      const gamma_int = Math.max(GAMMA_INTERNAL_MIN, 1 + gammaR.current / eStarLoop);
      const eHistMaxEvLoop = eHistMaxEvR.current;

      tLocalRef.current += DT * waveTimeMultRef.current;
      const Fbound = lorentzCDF(V0_int, E_int, gamma_int);

      if (rng() < Fbound && probsLoop && probsLoop.length > 0) {
        const grid = densityGrid(statesLoop, probsLoop, tLocalRef.current,
                                 X_PLOT_MIN, X_PLOT_MAX, DENSITY_GRID_N);
        const xSamp = sampleFromGrid(grid, X_PLOT_MIN, X_PLOT_MAX, rng);
        qXLatestR.current = xSamp;
        qXSumR.current += xSamp;
        qXCountR.current++;
        if (xSamp < 0 || xSamp > L) qXOutR.current++;
        const qxBin = posToBin(xSamp);
        if (qxBin >= 0 && qxBin < NBINS_X) qXHist[qxBin]++;

        const eIdx = sampleEnergyIdx(probsLoop, rng);
        const eMeas_eV = statesLoop[eIdx].E * eStarLoop + sigma_eV * randnWith(rng);
        qESumR.current += eMeas_eV;
        qECountR.current++;
        if (eMeas_eV >= 0 && eMeas_eV < eHistMaxEvLoop) {
          const qeBin = Math.min(NBINS_E - 1, Math.floor(eMeas_eV / eHistMaxEvLoop * NBINS_E));
          qEHist[qeBin]++;
        }
        qFlashR.current++;
        if (qFlashR.current % FLASH_EVERY_N === 0) {
          qRecentXR.current.push({ x: xSamp, age: 0 });
          if (qRecentXR.current.length > FLASH_BUFFER_MAX) qRecentXR.current.shift();
          qRecentER.current.push({ E: eMeas_eV, age: 0 });
          if (qRecentER.current.length > FLASH_BUFFER_MAX) qRecentER.current.shift();
        }
      } else {
        const eMeas_int = sampleLorentzAbove(V0_int, E_int, gamma_int, rng);
        const eMeas_eV = eMeas_int * eStarLoop + sigma_eV * randnWith(rng);
        qESumR.current += eMeas_eV;
        qECountR.current++;
        qIonisedR.current++;
        if (eMeas_eV >= 0 && eMeas_eV < eHistMaxEvLoop) {
          const qeBin = Math.min(NBINS_E - 1, Math.floor(eMeas_eV / eHistMaxEvLoop * NBINS_E));
          qEHist[qeBin]++;
        }
        qFlashR.current++;
        if (qFlashR.current % FLASH_EVERY_N === 0) {
          qRecentER.current.push({ E: eMeas_eV, age: 0 });
          if (qRecentER.current.length > FLASH_BUFFER_MAX) qRecentER.current.shift();
        }
      }
    }

    function frame(now) {
      const dt = Math.min(60, now - last);
      last = now;
      const sinceReset = Math.min(now - lastResetARef.current, now - lastResetBRef.current);
      const steps = sinceReset > 400 ? Math.max(1, Math.floor(dt / 16)) : 0;
      const pauseAt = pauseIncrementRef.current;

      for (let s = 0; s < steps; s++) {
        if (!isIonisedA) {
          stepSide(
            eStarARef.current, V0IntARef.current, statesARef.current, probsARef.current,
            prngARef.current, tARef,
            sigmaARef, gammaARef, energyARef, eHistMaxEvARef,
            qXHistARef.current, qEHistARef.current, qXSumARef, qESumARef, qXCountARef, qECountARef,
            qIonisedCountARef, qXOutsideCountARef, qXLatestARef,
            qRecentXARef, qRecentEARef, qFlashCounterARef,
          );
        }
        if (!isIonisedB) {
          stepSide(
            eStarBRef.current, V0IntBRef.current, statesBRef.current, probsBRef.current,
            prngBRef.current, tBRef,
            sigmaBRef, gammaBRef, energyBRef, eHistMaxEvBRef,
            qXHistBRef.current, qEHistBRef.current, qXSumBRef, qESumBRef, qXCountBRef, qECountBRef,
            qIonisedCountBRef, qXOutsideCountBRef, qXLatestBRef,
            qRecentXBRef, qRecentEBRef, qFlashCounterBRef,
          );
        }
        const hitA = qECountARef.current >= nextPauseARef.current;
        const hitB = qECountBRef.current >= nextPauseBRef.current;
        if (hitA || hitB) {
          if (hitA) nextPauseARef.current += pauseAt;
          if (hitB) nextPauseBRef.current += pauseAt;
          setRunning(false);
          break;
        }
      }

      const ageX = (m) => ({ x: m.x, age: m.age + 1 });
      const ageE = (m) => ({ E: m.E, age: m.age + 1 });
      const live = (m) => m.age < FLASH_AGE;
      qRecentXARef.current = qRecentXARef.current.map(ageX).filter(live);
      qRecentEARef.current = qRecentEARef.current.map(ageE).filter(live);
      qRecentXBRef.current = qRecentXBRef.current.map(ageX).filter(live);
      qRecentEBRef.current = qRecentEBRef.current.map(ageE).filter(live);

      setTick((t) => t + 1);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [running, isIonisedA, isIonisedB, allIonised]);

  function handlePlay()  { if (!allIonised) setRunning(true); }
  function handlePause() { setRunning(false); }
  function handleStop()  {
    qXHistARef.current = new Float64Array(NBINS_X);
    qEHistARef.current = new Float64Array(NBINS_E);
    qXSumARef.current = 0; qESumARef.current = 0;
    qXCountARef.current = 0; qECountARef.current = 0;
    qIonisedCountARef.current = 0; qXOutsideCountARef.current = 0;
    qRecentXARef.current = []; qRecentEARef.current = []; qFlashCounterARef.current = 0;
    nextPauseARef.current = pauseIncrementRef.current;
    tARef.current = 0;
    lastResetARef.current = performance.now();

    qXHistBRef.current = new Float64Array(NBINS_X);
    qEHistBRef.current = new Float64Array(NBINS_E);
    qXSumBRef.current = 0; qESumBRef.current = 0;
    qXCountBRef.current = 0; qECountBRef.current = 0;
    qIonisedCountBRef.current = 0; qXOutsideCountBRef.current = 0;
    qRecentXBRef.current = []; qRecentEBRef.current = []; qFlashCounterBRef.current = 0;
    nextPauseBRef.current = pauseIncrementRef.current;
    tBRef.current = 0;
    lastResetBRef.current = performance.now();

    setRunning(false);
    setTick((t) => t + 1);
  }

  // -------------------------------------------------------------
  // Save / Load
  // -------------------------------------------------------------
  // Schema: `finite-well-comparison-export/v1`. Distinct from tab 1's
  // `finite-well-particle-export/v1` because this snapshot carries
  // two systems' state plus the A↔B link booleans — different shape
  // entirely. Loaders reject the wrong schema.

  function buildSnapshotTab2() {
    function sideMeta(label, lengthV, mEffV, v0V, gammaV, sigmaV, energyV,
                      eStarV, V0IntV, eHistMaxV,
                      qXCountR, qECountR, qIonisedR, qXOutR,
                      qXSumR, qESumR) {
      const qXc = qXCountR.current;
      const qEc = qECountR.current;
      return {
        length_nm: lengthV, m_eff_me: mEffV, v0_ev: v0V,
        gamma_ev: gammaV, sigma_ev: sigmaV, energy_ev: energyV,
        e_star_ev: eStarV, v0_internal: V0IntV, e_hist_max_ev: eHistMaxV,
        position_measurements: qXc,
        energy_measurements: qEc,
        ionisation_events: qIonisedR.current,
        outside_box_events: qXOutR.current,
        mean_x_engine: qXc > 0 ? qXSumR.current / qXc : null,
        mean_e_ev:     qEc > 0 ? qESumR.current / qEc : null,
      };
    }
    const now = new Date().toISOString();
    const meta = {
      exported_at: now,
      n_position_bins: NBINS_X, x_plot_min: X_PLOT_MIN, x_plot_max: X_PLOT_MAX,
      n_energy_bins: NBINS_E,
      show_eigenstates: showEigen, show_theory: showTheory,
      links: {
        L: linkedL, m_eff: linkedMEff, v0: linkedV0,
        gamma: linkedGamma, sigma: linkedSigma, energy: linkedEnergy,
      },
      A: sideMeta('A', lengthA, mEffA, v0A, gammaA, sigmaA, energyA,
                  eStarA, V0IntA, eHistMaxEvA,
                  qXCountARef, qECountARef, qIonisedCountARef, qXOutsideCountARef,
                  qXSumARef, qESumARef),
      B: sideMeta('B', lengthB, mEffB, v0B, gammaB, sigmaB, energyB,
                  eStarB, V0IntB, eHistMaxEvB,
                  qXCountBRef, qECountBRef, qIonisedCountBRef, qXOutsideCountBRef,
                  qXSumBRef, qESumBRef),
    };
    function eigArr(states, eStarX) {
      return states.map((s, i) => ({
        n: i + 1, parity: s.parity, e_n_ev: s.E * eStarX,
        e_n_engine: s.E, k: s.k, kappa: s.kappa,
      }));
    }
    const eigenvalues = { A: eigArr(statesA, eStarA), B: eigArr(statesB, eStarB) };

    function posBins(densityArr) {
      const xBinW = X_PLOT_RANGE / NBINS_X;
      const out = [];
      for (let i = 0; i < NBINS_X; i++) {
        out.push({ bin_index: i, bin_center_engine: X_PLOT_MIN + (i + 0.5) * xBinW, density: densityArr[i] });
      }
      return out;
    }
    function enBins(densityArr, eHistMax) {
      const eBinW = eHistMax / NBINS_E;
      const out = [];
      for (let i = 0; i < NBINS_E; i++) {
        out.push({ bin_index: i, bin_center_ev: (i + 0.5) * eBinW, density: densityArr[i] });
      }
      return out;
    }
    return {
      meta, eigenvalues,
      position_histogram: { A: posBins(qXHistDensityA), B: posBins(qXHistDensityB) },
      energy_histogram: {
        A: enBins(qEHistDensityA, eHistMaxEvA),
        B: enBins(qEHistDensityB, eHistMaxEvB),
      },
      now,
    };
  }

  function baseFilenameTab2(now) {
    const stamp = now.replace(/[:T]/g, '-').slice(0, 19);
    // `pair` prefix marks a tab 2 dual-system export, distinguishable
    // from tab 1's `single` files even in a casual file listing.
    return `fwell_pair_LA${lengthA}_LB${lengthB}_V${v0A}-${v0B}_${stamp}`;
  }

  function triggerDownload(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportTab2JSON() {
    const snap = buildSnapshotTab2();
    const payload = {
      schema: 'finite-well-comparison-export/v1',
      meta: snap.meta,
      eigenvalues: snap.eigenvalues,
      position_histogram: snap.position_histogram,
      energy_histogram:   snap.energy_histogram,
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'application/json', `${baseFilenameTab2(snap.now)}.json`);
  }

  function exportTab2CSV() {
    const snap = buildSnapshotTab2();
    const fmt = (v) => v === null || v === undefined ? '' : (typeof v === 'number' ? v.toFixed(6) : v);
    const metaRows = [['key', 'value']];
    function pushMeta(prefix, obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && typeof v === 'object') pushMeta(prefix + k + '.', v);
        else metaRows.push([prefix + k, fmt(v)]);
      }
    }
    pushMeta('', snap.meta);

    const eigenRows = [['system', 'n', 'parity', 'E_n_ev', 'E_n_engine', 'k', 'kappa']];
    for (const e of snap.eigenvalues.A) eigenRows.push(['A', e.n, e.parity, fmt(e.e_n_ev), fmt(e.e_n_engine), fmt(e.k), fmt(e.kappa)]);
    for (const e of snap.eigenvalues.B) eigenRows.push(['B', e.n, e.parity, fmt(e.e_n_ev), fmt(e.e_n_engine), fmt(e.k), fmt(e.kappa)]);

    const dataRows = [['kind', 'system', 'bin_index', 'bin_center', 'density']];
    for (const b of snap.position_histogram.A) dataRows.push(['position', 'A', b.bin_index, fmt(b.bin_center_engine), fmt(b.density)]);
    for (const b of snap.position_histogram.B) dataRows.push(['position', 'B', b.bin_index, fmt(b.bin_center_engine), fmt(b.density)]);
    for (const b of snap.energy_histogram.A)   dataRows.push(['energy',   'A', b.bin_index, fmt(b.bin_center_ev),     fmt(b.density)]);
    for (const b of snap.energy_histogram.B)   dataRows.push(['energy',   'B', b.bin_index, fmt(b.bin_center_ev),     fmt(b.density)]);

    function esc(v) { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
    const toCSV = (rows) => rows.map(r => r.map(esc).join(',')).join('\n');
    const csv = toCSV(metaRows) + '\n\n' + toCSV(eigenRows) + '\n\n' + toCSV(dataRows) + '\n';
    triggerDownload(csv, 'text/csv;charset=utf-8', `${baseFilenameTab2(snap.now)}.csv`);
  }

  function applyLoadedStateTab2(payload) {
    // Cross-tab import: a tab 1 single-system file. Need the user to
    // pick which destination side (A or B) — deferred to a modal.
    if (payload.schema === 'finite-well-particle-export/v1') {
      setPendingCrossImport(payload);
      return false;
    }
    if (payload.schema !== 'finite-well-comparison-export/v1') {
      alert(`Unsupported file: schema "${payload.schema || 'unknown'}". This tab loads "finite-well-comparison-export/v1" or "finite-well-particle-export/v1" files.`);
      return false;
    }
    const m = payload.meta || {};
    if (m.n_position_bins !== NBINS_X || m.n_energy_bins !== NBINS_E) {
      alert('File was created with different bin counts. Load aborted.');
      return false;
    }
    if (!m.A || !m.B) {
      alert('File is missing System A or B metadata. Load aborted.');
      return false;
    }

    // Suppress the per-system reset-on-geometry-change effects while
    // restoring — we don't want them wiping the histograms we're
    // about to load.
    isLoadingRef.current = true;
    setRunning(false);

    // Primary parameters
    setLengthA(m.A.length_nm); setMEffA(m.A.m_eff_me); setV0A(m.A.v0_ev);
    setGammaA(m.A.gamma_ev);   setSigmaA(m.A.sigma_ev); setEnergyA(m.A.energy_ev);
    setLengthB(m.B.length_nm); setMEffB(m.B.m_eff_me); setV0B(m.B.v0_ev);
    setGammaB(m.B.gamma_ev);   setSigmaB(m.B.sigma_ev); setEnergyB(m.B.energy_ev);
    if (m.links) {
      setLinkedL(!!m.links.L);         setLinkedMEff(!!m.links.m_eff);
      setLinkedV0(!!m.links.v0);       setLinkedGamma(!!m.links.gamma);
      setLinkedSigma(!!m.links.sigma); setLinkedEnergy(!!m.links.energy);
    }
    if (typeof m.show_eigenstates === 'boolean') setShowEigen(m.show_eigenstates);
    if (typeof m.show_theory      === 'boolean') setShowTheory(m.show_theory);

    // Reconstruct counts from density × total × binWidth, per side.
    const xBinW = X_PLOT_RANGE / NBINS_X;
    function restoreSide(meta, posBins, enBins, qXHistR, qEHistR, qXSumR, qESumR,
                        qXCountR, qECountR, qIonisedR, qXOutR,
                        qRecentXR, qRecentER, qFlashR, tR, nextPauseR, lastResetR) {
      const xTotal = meta.position_measurements || 0;
      const eTotal = meta.energy_measurements || 0;
      const eBinW = meta.e_hist_max_ev / NBINS_E;
      const xHist = new Float64Array(NBINS_X);
      const eHist = new Float64Array(NBINS_E);
      for (const b of posBins || []) {
        if (b.bin_index >= 0 && b.bin_index < NBINS_X) xHist[b.bin_index] = (b.density || 0) * xTotal * xBinW;
      }
      for (const b of enBins || []) {
        if (b.bin_index >= 0 && b.bin_index < NBINS_E) eHist[b.bin_index] = (b.density || 0) * eTotal * eBinW;
      }
      qXHistR.current = xHist;
      qEHistR.current = eHist;
      qXCountR.current = xTotal;
      qECountR.current = eTotal;
      qIonisedR.current = meta.ionisation_events || 0;
      qXOutR.current    = meta.outside_box_events || 0;
      qXSumR.current = (meta.mean_x_engine != null) ? meta.mean_x_engine * xTotal : 0;
      qESumR.current = (meta.mean_e_ev     != null) ? meta.mean_e_ev     * eTotal : 0;
      qRecentXR.current = []; qRecentER.current = []; qFlashR.current = 0;
      tR.current = 0;
      lastResetR.current = performance.now();
      const ceiled = Math.ceil((eTotal + 1) / pauseIncrementRef.current) * pauseIncrementRef.current;
      nextPauseR.current = Math.max(pauseIncrementRef.current, ceiled);
    }
    restoreSide(m.A, payload.position_histogram?.A, payload.energy_histogram?.A,
                qXHistARef, qEHistARef, qXSumARef, qESumARef,
                qXCountARef, qECountARef, qIonisedCountARef, qXOutsideCountARef,
                qRecentXARef, qRecentEARef, qFlashCounterARef, tARef, nextPauseARef, lastResetARef);
    restoreSide(m.B, payload.position_histogram?.B, payload.energy_histogram?.B,
                qXHistBRef, qEHistBRef, qXSumBRef, qESumBRef,
                qXCountBRef, qECountBRef, qIonisedCountBRef, qXOutsideCountBRef,
                qRecentXBRef, qRecentEBRef, qFlashCounterBRef, tBRef, nextPauseBRef, lastResetBRef);

    setTick((t) => t + 1);
    // Clear the loading guard on the next tick — by then, the reset
    // effects for any changed parameters will have run as no-ops.
    setTimeout(() => { isLoadingRef.current = false; }, 0);
    return true;
  }

  function readFileAndLoadTab2(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try { applyLoadedStateTab2(JSON.parse(reader.result)); }
      catch (e) { alert(`Could not parse file: ${e.message}`); }
    };
    reader.onerror = () => alert('Could not read file.');
    reader.readAsText(file);
  }

  // Cross-import: drop a tab 1 single-system file into one of tab 2's
  // sides. Tab 1 stores parameters in engine units; we use the default
  // L=1 nm, m*=1 m_e mapping so each engine value scales by E*_REF.
  // Histograms aren't transferred — only parameters; the user re-runs
  // to accumulate. The other side stays untouched.
  function applyTab1ToTab2Side(payload, side) {
    const m = payload.meta || {};
    if (typeof m.v0 !== 'number') { alert('Source file is missing V₀.'); return; }
    const eStar = E_STAR_REF_EV;  // default L=1 nm, m*=1 m_e
    // Clamp to tab 2's ranges and round to slider steps.
    const v0Ev    = Math.max(V0_MIN_EV, Math.min(V0_MAX_EV, Math.round((m.v0 * eStar) * 10) / 10));
    const eEv     = Math.max(0, Math.min(1.4 * v0Ev, Math.round((m.energy_setting * eStar) * 100) / 100));
    const gEv     = Math.max(0, Math.round(((m.gamma_displayed != null ? m.gamma_displayed : (m.gamma_internal - 1)) * eStar) * 100) / 100);
    const sigEv   = Math.max(0, Math.round((m.instrument_sigma * eStar) * 100) / 100);

    const setLength = side === 'A' ? setLengthA : setLengthB;
    const setMEff   = side === 'A' ? setMEffA   : setMEffB;
    const setV0     = side === 'A' ? setV0A     : setV0B;
    const setEnergy = side === 'A' ? setEnergyA : setEnergyB;
    const setGamma  = side === 'A' ? setGammaA  : setGammaB;
    const setSigma  = side === 'A' ? setSigmaA  : setSigmaB;

    // Suppress that side's reset effect so we apply changes atomically;
    // the histograms get cleared explicitly below.
    isLoadingRef.current = true;
    setLength(1.0);
    setMEff(1.0);
    setV0(v0Ev);
    setEnergy(eEv);
    setGamma(gEv);
    setSigma(sigEv);
    // Clear that side's histograms (cross-import = parameters only).
    const xRef = side === 'A' ? qXHistARef : qXHistBRef;
    const eRef = side === 'A' ? qEHistARef : qEHistBRef;
    xRef.current = new Float64Array(NBINS_X);
    eRef.current = new Float64Array(NBINS_E);
    (side === 'A' ? qXSumARef : qXSumBRef).current = 0;
    (side === 'A' ? qESumARef : qESumBRef).current = 0;
    (side === 'A' ? qXCountARef : qXCountBRef).current = 0;
    (side === 'A' ? qECountARef : qECountBRef).current = 0;
    (side === 'A' ? qIonisedCountARef : qIonisedCountBRef).current = 0;
    (side === 'A' ? qXOutsideCountARef : qXOutsideCountBRef).current = 0;
    (side === 'A' ? qRecentXARef : qRecentXBRef).current = [];
    (side === 'A' ? qRecentEARef : qRecentEBRef).current = [];
    (side === 'A' ? qFlashCounterARef : qFlashCounterBRef).current = 0;
    (side === 'A' ? tARef : tBRef).current = 0;
    (side === 'A' ? nextPauseARef : nextPauseBRef).current = pauseIncrementRef.current;
    (side === 'A' ? lastResetARef : lastResetBRef).current = performance.now();
    setRunning(false);
    setTick((t) => t + 1);
    setPendingCrossImport(null);
    setTimeout(() => { isLoadingRef.current = false; }, 0);
  }

  function handleFileChosenTab2(file) {
    if (!file) return;
    const hasData = (qECountARef.current > 0) || (qECountBRef.current > 0);
    if (hasData) setPendingLoadFile(file);
    else readFileAndLoadTab2(file);
  }

  // Escape closes the save menu, mirroring tab 1's affordance.
  useEffect(() => {
    if (!saveMenuOpen) return;
    function onKey(e) { if (e.key === 'Escape') setSaveMenuOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveMenuOpen]);

  // --- Per-system display values. Density-normalised so theory
  // overlays can sit directly on top. ---
  const qXCountA = qXCountARef.current;
  const qECountA = qECountARef.current;
  const qXCountB = qXCountBRef.current;
  const qECountB = qECountBRef.current;
  const xBinWidth = X_PLOT_RANGE / NBINS_X;
  // Each side has its own eV-axis range, so its bin width differs.
  const eBinWidthEvA = eHistMaxEvA / NBINS_E;
  const eBinWidthEvB = eHistMaxEvB / NBINS_E;
  const qXHistDensityA = qXCountA > 0 ? Array.from(qXHistARef.current).map((c) => c / (qXCountA * xBinWidth)) : Array(NBINS_X).fill(0);
  const qEHistDensityA = qECountA > 0 ? Array.from(qEHistARef.current).map((c) => c / (qECountA * eBinWidthEvA)) : Array(NBINS_E).fill(0);
  const qXHistDensityB = qXCountB > 0 ? Array.from(qXHistBRef.current).map((c) => c / (qXCountB * xBinWidth)) : Array(NBINS_X).fill(0);
  const qEHistDensityB = qECountB > 0 ? Array.from(qEHistBRef.current).map((c) => c / (qECountB * eBinWidthEvB)) : Array(NBINS_E).fill(0);
  const qxMeanA = qXCountA > 0 ? qXSumARef.current / qXCountA : null;
  const qeMeanA = qECountA > 0 ? qESumARef.current / qECountA : null;
  const qIonisedFracA = qECountA > 0 ? qIonisedCountARef.current / qECountA : 0;
  const qLeakFracA    = qXCountA > 0 ? qXOutsideCountARef.current / qXCountA : 0;
  const qxMeanB = qXCountB > 0 ? qXSumBRef.current / qXCountB : null;
  const qeMeanB = qECountB > 0 ? qESumBRef.current / qECountB : null;
  const qIonisedFracB = qECountB > 0 ? qIonisedCountBRef.current / qECountB : 0;
  const qLeakFracB    = qXCountB > 0 ? qXOutsideCountBRef.current / qXCountB : 0;

  // A and B advance lockstep (each rAF tick steps both), so their
  // counts are always equal — the transport bar shows qECountA as
  // the single source of truth.

  const eigenStatesEvA = useMemo(() => statesA.map((s) => ({ ...s, E: eToEvA(s.E) })), [statesA, eStarA]);  // eslint-disable-line react-hooks/exhaustive-deps
  const eigenStatesEvB = useMemo(() => statesB.map((s) => ({ ...s, E: eToEvB(s.E) })), [statesB, eStarB]);  // eslint-disable-line react-hooks/exhaustive-deps

  // --- Theory overlays per system. Position theory is time-averaged
  // Σ_n |c_n|² ψ_n(x)² in engine units (PositionHistogram does the
  // nm-axis mapping). Energy theory is in eV: bound = F(V₀)·Σ |c_n|²
  // ·Gauss(E−E_n_eV, σ_eff_eV) + continuum = ∫ Lorentzian × Gauss.
  function makePosTheory(statesX, probsX) {
    if (!statesX.length) return null;
    const N = 240;
    const arr = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = X_PLOT_MIN + (X_PLOT_RANGE * i) / (N - 1);
      let d = 0;
      for (let k = 0; k < statesX.length; k++) {
        const psi = finiteWellPsi(statesX[k], x);
        d += probsX[k] * psi * psi;
      }
      arr[i] = { x, d };
    }
    return arr;
  }
  function makeEnergyTheory(statesX, probsX, sigmaX, gammaX, eStarX, V0IntX, v0X, energyX, eHistMaxX) {
    if (!statesX.length) return null;
    const N = 240;
    const eBinW = eHistMaxX / NBINS_E;
    const sigmaEff = Math.max(sigmaX, eBinW / Math.sqrt(2 * Math.PI));
    const norm = 1 / (sigmaEff * Math.sqrt(2 * Math.PI));
    const twoSig2 = 2 * sigmaEff * sigmaEff;
    const gammaIntX = Math.max(GAMMA_INTERNAL_MIN, 1 + gammaX / eStarX);
    const gammaEvEff = gammaIntX * eStarX;
    const gamHalf = gammaEvEff / 2;
    const Fbound = lorentzCDF(V0IntX, energyX / eStarX, gammaIntX);

    const NC = 200;
    const Emax = Math.max(eHistMaxX * 1.5, energyX + 10 * gammaEvEff, v0X + 10 * gammaEvEff);
    const dEc = (Emax - v0X) / NC;
    const lorW = new Float64Array(NC);
    const Ep = new Float64Array(NC);
    for (let j = 0; j < NC; j++) {
      Ep[j] = v0X + (j + 0.5) * dEc;
      const dEp = Ep[j] - energyX;
      lorW[j] = (gamHalf / Math.PI) / (dEp * dEp + gamHalf * gamHalf) * dEc;
    }

    const bound = new Array(N);
    const continuum = new Array(N);
    for (let i = 0; i < N; i++) {
      const E = (eHistMaxX * i) / (N - 1);
      let dB = 0;
      for (let k = 0; k < statesX.length; k++) {
        const dE = E - statesX[k].E * eStarX;
        dB += probsX[k] * norm * Math.exp(-(dE * dE) / twoSig2);
      }
      bound[i] = { E, d: Fbound * dB };
      let dC = 0;
      for (let j = 0; j < NC; j++) {
        const dEp = E - Ep[j];
        dC += lorW[j] * norm * Math.exp(-(dEp * dEp) / twoSig2);
      }
      continuum[i] = { E, d: dC };
    }
    return { bound, continuum };
  }
  const qPosTheoryA = useMemo(() => makePosTheory(statesA, probsA), [statesA, probsA]);  // eslint-disable-line react-hooks/exhaustive-deps
  const qPosTheoryB = useMemo(() => makePosTheory(statesB, probsB), [statesB, probsB]);  // eslint-disable-line react-hooks/exhaustive-deps
  const qEnergyTheoryA = useMemo(
    () => makeEnergyTheory(statesA, probsA, sigmaA, gammaA, eStarA, V0IntA, v0A, energyA, eHistMaxEvA),
    [statesA, probsA, sigmaA, gammaA, eStarA, V0IntA, v0A, energyA, eHistMaxEvA],  // eslint-disable-line react-hooks/exhaustive-deps
  );
  const qEnergyTheoryB = useMemo(
    () => makeEnergyTheory(statesB, probsB, sigmaB, gammaB, eStarB, V0IntB, v0B, energyB, eHistMaxEvB),
    [statesB, probsB, sigmaB, gammaB, eStarB, V0IntB, v0B, energyB, eHistMaxEvB],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Shared nm axis for the position panels. Both systems' wells +
  // leakage tails fit within this range (the wider system's tails
  // define the edges). When A and B are equal length the result is
  // each panel's natural [-0.3L, 1.3L] window.
  const lengthMaxNm = Math.max(lengthA, lengthB);
  const xMinNm = -X_PLOT_MARGIN * lengthMaxNm;
  const xMaxNm = (1 + X_PLOT_MARGIN) * lengthMaxNm;

  // (Single-column compatibility aliases removed in 5d-ii — both A
  // and B are now rendered explicitly by the new layout below.)

  return (
    <div style={{ background: COL.bg, color: COL.ink, fontFamily: FONTS.body, minHeight: '100vh', padding: '20px 24px 32px' }}>

      {/* Settings modal — reuses tab 1's component since the shape is
          identical (pause, max-bound cap, wave-time speed, seed,
          language, show-notes). All bindings point at tab 2's saved
          state so the two tabs can hold different values. */}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          pauseIncrement={pauseIncrement} setPauseIncrement={setPauseIncrement}
          maxBoundCap={maxBoundCap}       setMaxBoundCap={setMaxBoundCap}
          waveTimeMult={waveTimeMult}     setWaveTimeMult={setWaveTimeMult}
          randomSeed={randomSeed}         setRandomSeed={setRandomSeed}
          language={language}             setLanguage={setLanguage}
          showNotes={showNotes}           setShowNotes={setShowNotes}
          col={COL}
          fonts={FONTS}
        />
      )}

      {/* Load-confirmation modal — appears when the user picks a file
          while measurements already exist. Offers Cancel / Discard /
          Save-then-load, same UX as tab 1. */}
      {pendingLoadFile && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setPendingLoadFile(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COL.panel, border: `1px solid ${COL.rule}`, borderRadius: 6,
              padding: '20px 24px', maxWidth: 480,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontFamily: FONTS.body,
            }}
          >
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontStyle: 'italic', marginBottom: 10 }}>
              Discard current data?
            </div>
            <div style={{ color: COL.inkDim, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              Loading{' '}
              <span style={{ color: COL.ink, fontFamily: FONTS.mono, fontSize: 13 }}>{pendingLoadFile.name}</span>
              {' '}will replace your current simulation state
              {' '}(A: {qECountA.toLocaleString()} · B: {qECountB.toLocaleString()} measurements).
              {' '}Save first?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPendingLoadFile(null)}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.inkDim,
                  border: `1px solid ${COL.rule}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  const f = pendingLoadFile;
                  setPendingLoadFile(null);
                  readFileAndLoadTab2(f);
                }}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.danger,
                  border: `1px solid ${COL.danger}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Discard and load</button>
              <button
                onClick={() => {
                  exportTab2JSON();
                  const f = pendingLoadFile;
                  setPendingLoadFile(null);
                  readFileAndLoadTab2(f);
                }}
                style={{
                  padding: '8px 14px', background: COL.quantum, color: '#0e1320',
                  border: `1px solid ${COL.quantum}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Save first, then load</button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-tab import — user picks destination side (A or B) for
          an incoming tab 1 single-system file. The other side is
          unaffected. */}
      {pendingCrossImport && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setPendingCrossImport(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COL.panel, border: `1px solid ${COL.rule}`, borderRadius: 6,
              padding: '20px 24px', maxWidth: 520,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontFamily: FONTS.body,
            }}
          >
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontStyle: 'italic', marginBottom: 10 }}>
              Single-system file — pick a destination
            </div>
            <div style={{ color: COL.inkDim, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              This file is a tab 1 single-system snapshot. Which side of
              this tab's comparison should it load into? The other side
              stays untouched. Tab 1 stores parameters in dimensionless
              engine units; we map them to real units using
              <em> L</em> = 1 nm, <em>m</em><sup>*</sup> = m<sub>e</sub>
              as defaults. Histograms aren't transferred — re-run to
              accumulate measurements.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPendingCrossImport(null)}
                style={{
                  padding: '8px 14px', background: 'transparent', color: COL.inkDim,
                  border: `1px solid ${COL.rule}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                }}
              >Cancel</button>
              <button
                onClick={() => applyTab1ToTab2Side(pendingCrossImport, 'A')}
                style={{
                  padding: '8px 18px', background: COL.accent, color: '#0e1320',
                  border: `1px solid ${COL.accent}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Into System A</button>
              <button
                onClick={() => applyTab1ToTab2Side(pendingCrossImport, 'B')}
                style={{
                  padding: '8px 18px', background: COL.accent, color: '#0e1320',
                  border: `1px solid ${COL.accent}`, borderRadius: 4, cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3, fontWeight: 600,
                }}
              >Into System B</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: FONTS.display, fontWeight: 400, fontSize: 38, margin: 0, padding: 0,
            lineHeight: 1, letterSpacing: -0.5, fontStyle: 'italic', whiteSpace: 'nowrap',
          }}>
            Particle, Quo Vadis. Redux
          </h1>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 13, color: COL.inkDim, letterSpacing: 0.5,
            lineHeight: 1.4, paddingBottom: 2,
          }}>
            Quantum particle in a finite well of variable width
          </div>
        </header>

        <TabBar activeTab={activeTab} onChange={onChangeTab} />

        {/* ===== Transport bar — full width, shared across A & B. Plays
             both sims at once; Stop resets both. Show-theory / Show-
             eigenstates checkboxes folded in here so the display row
             is one tight bar instead of a sparse "Display" panel above
             the visualisations. ===== */}
        <div style={{ ...panelStyle(), padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <TransportButton kind="playpause" active={running} onClick={running ? handlePause : handlePlay} disabled={allIonised} colour={allIonised ? COL.inkDim : COL.quantum} bg={COL.panel} />
            <TransportButton kind="stop"      active={false}   onClick={handleStop} colour={COL.danger} bg={COL.panel} />

            {/* Save dropdown. Disabled until at least one side has
                accumulated measurements. */}
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <TransportButton
                kind="save"
                active={saveMenuOpen}
                onClick={() => {
                  if (qECountA === 0 && qECountB === 0) return;
                  setSaveMenuOpen((o) => !o);
                }}
                colour={(qECountA > 0 || qECountB > 0) ? COL.quantum : COL.inkDim}
                bg={COL.panel}
              />
              {saveMenuOpen && (
                <div
                  style={{
                    position: 'absolute', top: '110%', left: '50%',
                    transform: 'translateX(-50%)',
                    background: COL.panel, border: `1px solid ${COL.rule}`,
                    borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 10, display: 'flex', flexDirection: 'column',
                    minWidth: 96, overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => { exportTab2CSV();  setSaveMenuOpen(false); }}
                    style={{
                      padding: '8px 14px', background: 'transparent', color: COL.ink,
                      border: 'none', borderBottom: `1px solid ${COL.rule}`,
                      cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 13,
                      letterSpacing: 0.3, textAlign: 'left',
                    }}
                  >CSV</button>
                  <button
                    onClick={() => { exportTab2JSON(); setSaveMenuOpen(false); }}
                    style={{
                      padding: '8px 14px', background: 'transparent', color: COL.ink,
                      border: 'none', cursor: 'pointer',
                      fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.3,
                      textAlign: 'left',
                    }}
                  >JSON</button>
                </div>
              )}
            </div>

            {/* Load button: explicitly triggers the hidden file input
                via a ref. Wrapping a TransportButton inside a <label>
                doesn't forward clicks to the input across browsers
                because the button captures the click; programmatic
                .click() avoids the issue. */}
            <TransportButton
              kind="load"
              active={false}
              onClick={() => fileInputRefTab2.current && fileInputRefTab2.current.click()}
              colour={COL.quantum}
              bg={COL.panel}
            />
            <input
              ref={fileInputRefTab2}
              type="file" accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                handleFileChosenTab2(file);
                e.target.value = '';
              }}
            />

            <TransportButton
              kind="settings"
              active={settingsOpen}
              onClick={() => setSettingsOpen((o) => !o)}
              colour={COL.accent}
              bg={COL.panel}
            />
          </div>
          {/* Stack the two display toggles vertically so their combined
              height matches the 46-px transport buttons next to them.
              Each CheckboxRow is 22 px tall; gap 2 brings the pair to 46 px. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <CheckboxRow
              checked={showTheory}
              onChange={() => setShowTheory((b) => !b)}
              label="Show theory"
              accent={COL.quantum}
              inkDim={COL.inkDim} rule={COL.rule} ink={COL.ink} mono={FONTS.mono}
            />
            <CheckboxRow
              checked={showEigen}
              onChange={() => setShowEigen((b) => !b)}
              label="Show eigenstates"
              accent={COL.quantum}
              inkDim={COL.inkDim} rule={COL.rule} ink={COL.ink} mono={FONTS.mono}
            />
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 26, fontWeight: 600,
              color: COL.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {qECountA.toLocaleString()}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COL.inkDim,
              letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2,
            }}>
              Measurements
            </div>
          </div>
        </div>

        {/* ===== A | B. Each system carries its own vertical energy
             slider inside its panel now, so the layout collapses to a
             clean 1fr 1fr grid. ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
          <Tab2SystemPanel
            label="A"
            lengthVal={lengthA} setLengthVal={setLengthAWithLink}
            mEffVal={mEffA}     setMEffVal={setMEffAWithLink}
            v0Val={v0A}         setV0Val={setV0AWithLink}
            gammaVal={gammaA}   setGammaVal={setGammaAWithLink}
            sigmaVal={sigmaA}   setSigmaVal={setSigmaAWithLink}
            linkedL={linkedL}         toggleLinkedL={toggleLinkedL}
            linkedMEff={linkedMEff}   toggleLinkedMEff={toggleLinkedMEff}
            linkedV0={linkedV0}       toggleLinkedV0={toggleLinkedV0}
            linkedGamma={linkedGamma} toggleLinkedGamma={toggleLinkedGamma}
            linkedSigma={linkedSigma} toggleLinkedSigma={toggleLinkedSigma}
            eStar={eStarA} V0Internal={V0IntA} states={statesA} eigenStatesEv={eigenStatesEvA}
            isIonised={isIonisedA} probs={probsA}
            tCurrent={tARef.current}
            qXLatest={qXLatestARef.current}
            qRecentX={qRecentXARef.current}
            qRecentE={qRecentEARef.current}
            qXHistDensity={qXHistDensityA}
            qEHistDensity={qEHistDensityA}
            qxMean={qxMeanA} qeMean={qeMeanA}
            qIonisedFrac={qIonisedFracA} qLeakFrac={qLeakFracA}
            qPosTheory={qPosTheoryA} qEnergyTheory={qEnergyTheoryA}
            psiMode={psiModeA} setPsiMode={setPsiModeA}
            energyVal={energyA} setEnergyVal={setEnergyAWithLink} setEnergyByIndex={setEnergyAByIndex}
            linkedEnergy={linkedEnergy} toggleLinkedEnergy={toggleLinkedEnergy}
            eHistMaxEv={eHistMaxEvA} v0Max={v0Max}
            showEigen={showEigen} showTheory={showTheory} logEnergy={logEnergy} setLogEnergy={setLogEnergy}
            xMinNm={xMinNm} xMaxNm={xMaxNm}
          />
          <Tab2SystemPanel
            label="B"
            lengthVal={lengthB} setLengthVal={setLengthBWithLink}
            mEffVal={mEffB}     setMEffVal={setMEffBWithLink}
            v0Val={v0B}         setV0Val={setV0BWithLink}
            gammaVal={gammaB}   setGammaVal={setGammaBWithLink}
            sigmaVal={sigmaB}   setSigmaVal={setSigmaBWithLink}
            linkedL={linkedL}         toggleLinkedL={toggleLinkedL}
            linkedMEff={linkedMEff}   toggleLinkedMEff={toggleLinkedMEff}
            linkedV0={linkedV0}       toggleLinkedV0={toggleLinkedV0}
            linkedGamma={linkedGamma} toggleLinkedGamma={toggleLinkedGamma}
            linkedSigma={linkedSigma} toggleLinkedSigma={toggleLinkedSigma}
            eStar={eStarB} V0Internal={V0IntB} states={statesB} eigenStatesEv={eigenStatesEvB}
            isIonised={isIonisedB} probs={probsB}
            tCurrent={tBRef.current}
            qXLatest={qXLatestBRef.current}
            qRecentX={qRecentXBRef.current}
            qRecentE={qRecentEBRef.current}
            qXHistDensity={qXHistDensityB}
            qEHistDensity={qEHistDensityB}
            qxMean={qxMeanB} qeMean={qeMeanB}
            qIonisedFrac={qIonisedFracB} qLeakFrac={qLeakFracB}
            qPosTheory={qPosTheoryB} qEnergyTheory={qEnergyTheoryB}
            psiMode={psiModeB} setPsiMode={setPsiModeB}
            energyVal={energyB} setEnergyVal={setEnergyBWithLink} setEnergyByIndex={setEnergyBByIndex}
            linkedEnergy={linkedEnergy} toggleLinkedEnergy={toggleLinkedEnergy}
            eHistMaxEv={eHistMaxEvB} v0Max={v0Max}
            showEigen={showEigen} showTheory={showTheory} logEnergy={logEnergy} setLogEnergy={setLogEnergy}
            xMinNm={xMinNm} xMaxNm={xMaxNm}
          />
        </div>

        {/* ===== Notes (adaptive A vs B framing) — collapsible. ===== */}
        <CollapsibleSection
          title="What you're looking at"
          expanded={showNotes}
          onToggle={() => setShowNotes((v) => !v)}
          mono={FONTS.mono} inkDim={COL.inkDim}
        >
          <Tab2Notes
            energyA={energyA} energyB={energyB}
            lengthA={lengthA} lengthB={lengthB}
            mEffA={mEffA}     mEffB={mEffB}
            v0A={v0A}         v0B={v0B}
            gammaA={gammaA}   gammaB={gammaB}
            sigmaA={sigmaA}   sigmaB={sigmaB}
            statesA={statesA} statesB={statesB}
            probsA={probsA}   probsB={probsB}
            eStarA={eStarA}   eStarB={eStarB}
            isIonisedA={isIonisedA} isIonisedB={isIonisedB}
            qIonisedFracA={qIonisedFracA} qIonisedFracB={qIonisedFracB}
            qLeakFracA={qLeakFracA}       qLeakFracB={qLeakFracB}
            qXCountA={qXCountA} qXCountB={qXCountB}
            qECountA={qECountA} qECountB={qECountB}
            mono={FONTS.mono} display={FONTS.display} body={FONTS.body}
            ink={COL.ink} inkDim={COL.inkDim}
            accent={COL.accent} qCol={COL.quantum} ionisedCol={COL.ionised}
          />
        </CollapsibleSection>

        {/* ===== Spectroscopy (transitions as observables) — collapsible. ===== */}
        <CollapsibleSection
          title="Spectroscopy"
          expanded={spectroscopyExpanded}
          onToggle={() => setSpectroscopyExpanded((v) => !v)}
          mono={FONTS.mono} inkDim={COL.inkDim}
        >
          <Tab2Spectroscopy
            statesA={statesA} statesB={statesB}
            eStarA={eStarA}   eStarB={eStarB}
            mono={FONTS.mono} body={FONTS.body}
            ink={COL.ink} inkDim={COL.inkDim}
            accent={COL.accent} qCol={COL.quantum}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// =============================================================
// TOP-LEVEL DISPATCHER
// =============================================================

// Both tabs stay mounted so their simulations keep running in the
// background — switching tabs only swaps visibility, not lifecycle.
// (Display:none keeps requestAnimationFrame ticking but skips paint
// for the hidden subtree, so the simulation loop continues but the
// hidden panels do no rendering work.)
function ParticleQuoVadisRedux() {
  const [activeTab, setActiveTab] = useSavedState('redux:activeTab', 'tab1');
  return (
    <>
      <div style={{ display: activeTab === 'tab1' ? 'block' : 'none' }}>
        <Tab1Content activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
      <div style={{ display: activeTab === 'tab2' ? 'block' : 'none' }}>
        <Tab2Content activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
    </>
  );
}
