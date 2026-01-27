// app/lib/fairCamEngine.js
// FAIR-CAM integrated Monte Carlo engine
// - Uses FAIR quant model (LEF / TEF / Contact Frequency)
// - Applies FAIR-CAM controls (LEC direct; VMC improves reliability; DSC informational)
// - Produces Baseline vs What-If results

import {
  ensureQuant,
  validateQuantForRun,
  makeRng,
  triangularSample,
  poisson,
  quantile,
  exceedanceCurve,
  deriveSusceptibility,
  clamp01,
} from "./fairEngine";

// -------------------- FAIR-CAM rating scale (triads) --------------------
export const ratingScale = {
  "Very High": { min: 0.97, ml: 0.985, max: 0.999 },
  High: { min: 0.9, ml: 0.935, max: 0.969 },
  Moderate: { min: 0.75, ml: 0.825, max: 0.899 },
  Low: { min: 0.5, ml: 0.675, max: 0.749 },
  "Very Low": { min: 0.0, ml: 0.25, max: 0.499 },
  "N/A": { min: 0.0, ml: 0.0, max: 0.0 },
};

export function triadFromRating(label) {
  return ratingScale[label] || ratingScale["N/A"];
}

// Operational Effectiveness (triad) = Intended × Coverage × Reliability (pointwise)
export function operationalEffectivenessTriad(intendedLabel, coverageLabel, reliabilityLabel) {
  const a = triadFromRating(intendedLabel);
  const b = triadFromRating(coverageLabel);
  const c = triadFromRating(reliabilityLabel);
  return {
    min: +(a.min * b.min * c.min).toFixed(4),
    ml: +(a.ml * b.ml * c.ml).toFixed(4),
    max: +(a.max * b.max * c.max).toFixed(4),
  };
}

export function sampleEffectiveness(effectTriad, rnd) {
  const v = triangularSample(effectTriad.min, effectTriad.ml, effectTriad.max, rnd);
  return clamp01(v);
}

// Combine multiple reductions: 1 - Π(1 - e_i)
export function combineReductions(effects) {
  let keep = 1;
  for (const e of effects) keep *= 1 - clamp01(e);
  return clamp01(1 - keep);
}

// VMC: reliability uplift toward 1
export function applyVmcToReliability(r, vmcEff) {
  const rr = clamp01(r);
  const e = clamp01(vmcEff);
  return clamp01(rr + e * (1 - rr));
}

// LEC types mapped to FAIR factors (training-friendly but consistent)
export function mapLecTypeToFactors(type) {
  const t = String(type || "").trim();
  if (!t) return [];
  if (t === "Avoidance" || t === "Deterrence") return ["TEF"];
  if (t === "Resistance") return ["SUSC"];
  if (t === "Detection") return ["LEF"];
  if (t === "Response") return ["LEF", "LM"];
  if (t === "Resilience" || t === "Loss Minimization") return ["LM"];
  return [];
}

// -------------------- Controls helpers --------------------
function normalizeControls(controls) {
  return Array.isArray(controls) ? controls : [];
}

export function getScenarioControls(scenario) {
  if (Array.isArray(scenario?.controls)) return scenario.controls;
  if (Array.isArray(scenario?.treatments)) return scenario.treatments;
  return [];
}

export function getBaselineControls(scenarioControls) {
  return normalizeControls(scenarioControls).filter((c) => c?.status === "Implemented");
}

export function getWhatIfControls(scenarioControls) {
  return normalizeControls(scenarioControls).filter((c) => {
    if (c?.status === "Rejected") return false;
    if (c?.status === "Implemented") return true;
    return !!c?.includeInWhatIf;
  });
}

function splitControls(controls) {
  const lec = [];
  const vmc = [];
  const dsc = [];
  for (const c of controls) {
    if (c?.function === "LEC") lec.push(c);
    else if (c?.function === "VMC") vmc.push(c);
    else dsc.push(c);
  }
  return { lec, vmc, dsc };
}

// ✅ align with TreatmentsView fields: intended/coverage/reliability
function effectivenessTriadForControl(c) {
  return operationalEffectivenessTriad(c.intended, c.coverage, c.reliability);
}

// Returns a single draw including trace values
export function sampleOnceWithControls(qIn, controls, rnd) {
  const q = ensureQuant(qIn);
  const included = controls || [];
  const { lec, vmc } = splitControls(included);

  // --- VMC combined “strength”
  const vmcEffects = vmc.map((c) => sampleEffectiveness(effectivenessTriadForControl(c), rnd));
  const vmcCombined = combineReductions(vmcEffects);

  // --- Base frequency chain
  let tef = 0;
  let susc = 0;
  let lef = 0;

  if (q.level === "LEF") {
    lef = Math.max(0, triangularSample(q.lef.min, q.lef.ml, q.lef.max, rnd));
  } else if (q.level === "TEF") {
    tef = Math.max(0, triangularSample(q.tef.min, q.tef.ml, q.tef.max, rnd));

    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      const rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * clamp01(susc);
  } else {
    const cf = Math.max(0, triangularSample(q.contactFrequency.min, q.contactFrequency.ml, q.contactFrequency.max, rnd));
    const poa = clamp01(triangularSample(q.probabilityOfAction.min, q.probabilityOfAction.ml, q.probabilityOfAction.max, rnd));
    tef = cf * poa;

    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      const rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * clamp01(susc);
  }

  // --- Apply LEC effects
  const tefReductions = [];
  const lefReductions = [];
  const lmReductions = [];
  const suscReductions = [];
  const rsUplifts = [];

  for (const c of lec) {
    const iTri = triadFromRating(c.intended);
const covTri = triadFromRating(c.coverage);
const relTriBase = triadFromRating(c.reliability);

    const intended = sampleEffectiveness(iTri, rnd);
    const coverage = sampleEffectiveness(covTri, rnd);

    let reliability = sampleEffectiveness(relTriBase, rnd);
    reliability = applyVmcToReliability(reliability, vmcCombined);

    const eff = clamp01(intended * coverage * reliability);

    const factors = mapLecTypeToFactors(c?.type);
    for (const f of factors) {
      if (f === "TEF") tefReductions.push(eff);
      if (f === "LEF") lefReductions.push(eff);
      if (f === "LM") lmReductions.push(eff);
      if (f === "SUSC") {
        if (q.susceptibilityMode === "FromCapacityVsResistance") rsUplifts.push(eff);
        else suscReductions.push(eff);
      }
    }
  }

  // TEF reductions
  const tefCut = combineReductions(tefReductions);
  if (q.level !== "LEF") tef = tef * (1 - tefCut);

  // Susceptibility reductions / RS uplift
  const suscCut = combineReductions(suscReductions);
  if (q.level !== "LEF") {
    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(susc * (1 - suscCut));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      let rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      const uplift = combineReductions(rsUplifts);
      rs = rs * (1 + uplift);
      susc = deriveSusceptibility(tc, rs);
    }
  }

  // LEF recompute + explicit LEF cuts
  let lefCut = 0;

  if (q.level === "LEF") {
    const collapsed = combineReductions([...tefReductions, ...lefReductions, ...suscReductions, ...rsUplifts]);
    lef = lef * (1 - collapsed);
    lefCut = collapsed;
  } else {
    lef = tef * clamp01(susc);
    lefCut = combineReductions(lefReductions);
    lef = lef * (1 - lefCut);
  }

  lef = Math.max(0, lef);

  // --- Magnitude / per-event loss
  let primary = Math.max(0, triangularSample(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max, rnd));
  const slef = Math.max(0, triangularSample(q.secondaryLossEventFrequency.min, q.secondaryLossEventFrequency.ml, q.secondaryLossEventFrequency.max, rnd));
  let slm = Math.max(0, triangularSample(q.secondaryLossMagnitude.min, q.secondaryLossMagnitude.ml, q.secondaryLossMagnitude.max, rnd));

  const lmCut = combineReductions(lmReductions);
  primary = primary * (1 - lmCut);
  slm = slm * (1 - lmCut);

  const perEventLoss = primary + slef * slm;

  return {
    tef,
    susceptibility: clamp01(susc),
    lef,
    perEventLoss,
    tefCut,
    lefCut,
    lmCut,
  };
}

// -------------------- Runner --------------------
export async function runFairCamMonteCarlo(quant, controls, options = {}) {
  const { ok, missing, quant: q0 } = validateQuantForRun(quant);
  if (!ok) {
    const err = new Error("Invalid inputs");
    err.missing = missing;
    throw err;
  }

  const sims = Math.max(1000, Math.min(200000, Number(options.sims ?? q0.sims ?? 10000)));
  const curvePoints = Math.max(20, Math.min(200, Number(options.curvePoints ?? 60)));
  const chunkSize = Math.max(100, Math.min(5000, Number(options.chunkSize ?? 500)));

  const rnd = typeof options.seed === "number" ? makeRng(options.seed) : Math.random;

  const aleSamples = [];
  const pelSamples = [];

  let tefSum = 0;
  let suscSum = 0;
  let lefSum = 0;

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
      const draw = sampleOnceWithControls(q0, controls, rnd);

      const k = poisson(draw.lef, rnd);
      let annualLoss = 0;

      for (let e = 0; e < k; e++) {
        annualLoss += draw.perEventLoss;
        pelSamples.push(draw.perEventLoss);
      }

      aleSamples.push(annualLoss);

      tefSum += draw.tef;
      suscSum += draw.susceptibility;
      lefSum += draw.lef;
    }

    done += n;
    progress(`Running ${sims.toLocaleString()} simulations… (${done.toLocaleString()}/${sims.toLocaleString()})`);

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

  const chain = {
    avgTEF: tefSum / sims,
    avgSusceptibility: suscSum / sims,
    avgLEF: lefSum / sims,
  };

  const curve = exceedanceCurve(aleSamples, curvePoints); // ✅ add

  return {
    sims,
    lastRunAt: new Date().toISOString(),
    aleSamples,
    pelSamples,
    stats,
    chain,
    curve, // ✅ add
  };
}
