// app/lib/fairEngine.js
// FAIR Engine (training tool)
// - Pure JS (no React)
// - Supports abstraction levels: "LEF" | "TEF" | "Contact Frequency"
// - Inputs as min / ML / max triads for FAIR-ish factors
// - Monte Carlo simulation with Poisson annual event count
// - Returns distributions + summary stats + exceedance curve points

// ------------------------
// Utilities
// ------------------------

export const clamp01 = (x) => Math.max(0, Math.min(1, x));

export const num = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export const tri = (t) => ({
  min: t?.min ?? "",
  ml: t?.ml ?? "",
  max: t?.max ?? "",
});

export const isTriadValid = (t) => {
  const a = Number(t?.min);
  const m = Number(t?.ml);
  const b = Number(t?.max);
  return [a, m, b].every((x) => Number.isFinite(x)) && b >= a;
};

// Optional deterministic RNG (mulberry32)
export const makeRng = (seed = 123456789) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Triangular distribution sampler (min, mode, max)
export const triangularSample = (min, ml, max, rnd = Math.random) => {
  const a = num(min, NaN);
  const c = num(ml, NaN);
  const b = num(max, NaN);
  if (![a, b, c].every((v) => Number.isFinite(v))) return 0;
  if (b <= a) return a;

  const u = rnd();
  const fc = (c - a) / (b - a);

  if (u < fc) return a + Math.sqrt(u * (b - a) * (c - a));
  return b - Math.sqrt((1 - u) * (b - a) * (b - c));
};

// Poisson sampler (Knuth)
export const poisson = (lambda, rnd = Math.random) => {
  const lam = Math.max(0, num(lambda, 0));
  if (lam === 0) return 0;

  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= rnd();
  } while (p > L);

  return k - 1;
};

export const quantile = (arr, q) => {
  if (!arr?.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (a[base + 1] === undefined) return a[base];
  return a[base] + rest * (a[base + 1] - a[base]);
};

// Exceedance curve points: array of { x, exceed } where exceed = P(Loss > x)
export const exceedanceCurve = (values, points = 60) => {
  if (!values?.length) return { min: 0, max: 0, pts: [] };

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const xs = [];
  for (let i = 0; i < points; i++) {
    const q = i / (points - 1);
    xs.push(sorted[Math.floor(q * (n - 1))]);
  }

  const min = xs[0];
  const max = xs[xs.length - 1];

  const pts = xs.map((x, i) => {
    const q = i / (xs.length - 1);
    const exceed = 1 - q;
    return { x, exceed };
  });

  return { min, max, pts };
};

// Smooth mapping ThreatCapacity vs ResistanceStrength -> susceptibility (0..1)
// Training-friendly: sigmoid((TC - RS)/k)
export const deriveSusceptibility = (threatCapacity, resistanceStrength, softness = 2) => {
  const tc = num(threatCapacity, 0);
  const rs = num(resistanceStrength, 0);
  const z = (tc - rs) / Math.max(1e-9, softness);
  const s = 1 / (1 + Math.exp(-z));
  return clamp01(s);
};

// ------------------------
// Canonical quant shape
// ------------------------

export const ensureQuant = (scenarioQuant) => {
  const q = scenarioQuant || {};
  return {
    // abstraction level: "LEF" | "TEF" | "Contact Frequency"
    level: q.level || "LEF",

    // susceptibility mode: "Direct" | "FromCapacityVsResistance"
    susceptibilityMode: q.susceptibilityMode || "Direct",

    // Frequency factors
    lef: tri(q.lef),
    tef: tri(q.tef),
    contactFrequency: tri(q.contactFrequency),
    probabilityOfAction: tri(q.probabilityOfAction), // %
    susceptibility: tri(q.susceptibility), // %

    // Capability vs resistance
    threatCapacity: tri(q.threatCapacity), // score
    resistanceStrength: tri(q.resistanceStrength), // score

    // Loss factors
    primaryLoss: tri(q.primaryLoss), // €
    secondaryLossEventFrequency: tri(q.secondaryLossEventFrequency), // events per primary event
    secondaryLossMagnitude: tri(q.secondaryLossMagnitude), // € per secondary event

    // Simulation controls + outputs
    sims: Number(q.sims || 10000),
    lastRunAt: q.lastRunAt || "",
    stats: q.stats || null,
    aleSamples: Array.isArray(q.aleSamples) ? q.aleSamples : [],
    pelSamples: Array.isArray(q.pelSamples) ? q.pelSamples : [],
    curve: q.curve || null,
  };
};

// ------------------------
// Validation
// ------------------------

export const validateQuantForRun = (quant) => {
  const q = ensureQuant(quant);
  const missing = [];

  // Loss always required
  if (!isTriadValid(q.primaryLoss)) missing.push("Primary Loss (min/ML/max)");
  if (!isTriadValid(q.secondaryLossEventFrequency)) missing.push("Secondary Loss Event Frequency (min/ML/max)");
  if (!isTriadValid(q.secondaryLossMagnitude)) missing.push("Secondary Loss Magnitude (min/ML/max)");

  // Frequency chain depends on level
  if (q.level === "LEF") {
    if (!isTriadValid(q.lef)) missing.push("LEF (min/ML/max)");
  } else if (q.level === "TEF") {
    if (!isTriadValid(q.tef)) missing.push("TEF (min/ML/max)");
  } else if (q.level === "Contact Frequency") {
    if (!isTriadValid(q.contactFrequency)) missing.push("Contact Frequency (min/ML/max)");
    if (!isTriadValid(q.probabilityOfAction)) missing.push("Probability of Action (min/ML/max)");
  } else {
    missing.push('Level must be "LEF", "TEF" or "Contact Frequency"');
  }

  // Susceptibility depends on mode (only needed when level != LEF, because LEF is direct)
  if (q.level !== "LEF") {
    if (q.susceptibilityMode === "Direct") {
      if (!isTriadValid(q.susceptibility)) missing.push("Susceptibility (min/ML/max)");
    } else if (q.susceptibilityMode === "FromCapacityVsResistance") {
      if (!isTriadValid(q.threatCapacity)) missing.push("Threat Capacity (min/ML/max)");
      if (!isTriadValid(q.resistanceStrength)) missing.push("Resistance Strength (min/ML/max)");
    } else {
      missing.push('Susceptibility mode must be "Direct" or "FromCapacityVsResistance"');
    }
  }

  return { ok: missing.length === 0, missing, quant: q };
};

// ------------------------
// Core: compute one simulation draw
// ------------------------

export const sampleModelOnce = (q, rnd = Math.random) => {
  // Frequency chain -> LEF sample
  let lef = 0;

  if (q.level === "LEF") {
    lef = Math.max(0, triangularSample(q.lef.min, q.lef.ml, q.lef.max, rnd));
  }

  if (q.level === "TEF") {
    const tef = Math.max(0, triangularSample(q.tef.min, q.tef.ml, q.tef.max, rnd));

    let susc = 0;
    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      const rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * susc;
  }

  if (q.level === "Contact Frequency") {
    const cf = Math.max(0, triangularSample(q.contactFrequency.min, q.contactFrequency.ml, q.contactFrequency.max, rnd));
    const poa = clamp01(triangularSample(q.probabilityOfAction.min, q.probabilityOfAction.ml, q.probabilityOfAction.max, rnd));
    const tef = cf * poa;

    let susc = 0;
    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd) / 100);
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      const rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * susc;
  }

  // Per-event loss exposure (PEL)
  const primary = Math.max(0, triangularSample(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max, rnd));
  const slef = Math.max(0, triangularSample(q.secondaryLossEventFrequency.min, q.secondaryLossEventFrequency.ml, q.secondaryLossEventFrequency.max, rnd));
  const slm = Math.max(0, triangularSample(q.secondaryLossMagnitude.min, q.secondaryLossMagnitude.ml, q.secondaryLossMagnitude.max, rnd));

  const perEventLoss = primary + slef * slm;

  return { lef, perEventLoss };
};

// ------------------------
// Monte Carlo runner
// ------------------------

/**
 * runFairMonteCarlo(quant, options)
 * options:
 *  - sims: override simulation count
 *  - seed: number (deterministic RNG if provided)
 *  - curvePoints: points for exceedance curve
 *  - chunkSize: yield-friendly chunk size (for UI)
 *  - onProgress: ({ done, total, label }) => void   (optional)
 *  - shouldCancel: () => boolean                    (optional)
 */
export const runFairMonteCarlo = async (quant, options = {}) => {
  const { ok, missing, quant: q0 } = validateQuantForRun(quant);
  if (!ok) {
    const err = new Error("Invalid inputs");
    err.missing = missing;
    throw err;
  }

  const sims = Math.max(1000, Math.min(200000, Number(options.sims ?? q0.sims ?? 10000)));
  const curvePoints = Math.max(20, Math.min(200, Number(options.curvePoints ?? 60)));
  const chunkSize = Math.max(100, Math.min(5000, Number(options.chunkSize ?? 400)));

  const rnd =
    typeof options.seed === "number" ? makeRng(options.seed) : Math.random;

  const aleSamples = [];
  const pelSamples = [];

  let done = 0;

  const progress = (label) => {
    if (typeof options.onProgress === "function") {
      options.onProgress({ done, total: sims, label });
    }
  };

  progress(`Running ${sims.toLocaleString()} simulations…`);

  while (done < sims) {
    if (typeof options.shouldCancel === "function" && options.shouldCancel()) {
      const err = new Error("Cancelled");
      err.cancelled = true;
      throw err;
    }

    const n = Math.min(chunkSize, sims - done);

    for (let i = 0; i < n; i++) {
      const { lef, perEventLoss } = sampleModelOnce(q0, rnd);

      // Annual count ~ Poisson(lambda=LEF)
      const k = poisson(lef, rnd);

      let annualLoss = 0;
      for (let e = 0; e < k; e++) {
        annualLoss += perEventLoss;
        pelSamples.push(perEventLoss);
      }
      aleSamples.push(annualLoss);
    }

    done += n;
    progress(`Running ${sims.toLocaleString()} simulations… (${done.toLocaleString()}/${sims.toLocaleString()})`);

    // yield (if called from UI)
    if (options.yield !== false) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const stats = {
    ale: {
      min: quantile(aleSamples, 0.01),
      ml: quantile(aleSamples, 0.5),
      max: quantile(aleSamples, 0.99),
      p10: quantile(aleSamples, 0.1),
      p90: quantile(aleSamples, 0.9),
    },
    pel: {
      min: quantile(pelSamples, 0.01),
      ml: quantile(pelSamples, 0.5),
      max: quantile(pelSamples, 0.99),
      p10: quantile(pelSamples, 0.1),
      p90: quantile(pelSamples, 0.9),
    },
  };

  const curve = exceedanceCurve(aleSamples, curvePoints);

  return {
    sims,
    lastRunAt: new Date().toISOString(),
    aleSamples,
    pelSamples,
    stats,
    curve,
  };
};

// Convenience: synchronous runner (no chunk/yield). Useful for tests.
export const runFairMonteCarloSync = (quant, options = {}) => {
  const { ok, missing, quant: q0 } = validateQuantForRun(quant);
  if (!ok) {
    const err = new Error("Invalid inputs");
    err.missing = missing;
    throw err;
  }

  const sims = Math.max(1000, Math.min(200000, Number(options.sims ?? q0.sims ?? 10000)));
  const curvePoints = Math.max(20, Math.min(200, Number(options.curvePoints ?? 60)));
  const rnd = typeof options.seed === "number" ? makeRng(options.seed) : Math.random;

  const aleSamples = [];
  const pelSamples = [];

  for (let i = 0; i < sims; i++) {
    const { lef, perEventLoss } = sampleModelOnce(q0, rnd);
    const k = poisson(lef, rnd);

    let annualLoss = 0;
    for (let e = 0; e < k; e++) {
      annualLoss += perEventLoss;
      pelSamples.push(perEventLoss);
    }
    aleSamples.push(annualLoss);
  }

  const stats = {
    ale: {
      min: quantile(aleSamples, 0.01),
      ml: quantile(aleSamples, 0.5),
      max: quantile(aleSamples, 0.99),
      p10: quantile(aleSamples, 0.1),
      p90: quantile(aleSamples, 0.9),
    },
    pel: {
      min: quantile(pelSamples, 0.01),
      ml: quantile(pelSamples, 0.5),
      max: quantile(pelSamples, 0.99),
      p10: quantile(pelSamples, 0.1),
      p90: quantile(pelSamples, 0.9),
    },
  };

  const curve = exceedanceCurve(aleSamples, curvePoints);

  return {
    sims,
    lastRunAt: new Date().toISOString(),
    aleSamples,
    pelSamples,
    stats,
    curve,
  };
};
