// app/lib/fairCamEngine.js
// FAIR-CAM integrated Monte Carlo engine
// - Uses your FAIR quant model (LEF / TEF / Contact Frequency)
// - Applies FAIR-CAM controls (LEC direct; VMC improves reliability; DSC informational)
// - Produces Baseline vs What-If results

import {
  ensureQuant,
  validateQuantForRun,
  makeRng,
  triangularSample,
  poisson,
  quantile,
  deriveSusceptibility,
  clamp01,
} from "./fairEngine";

// -------------------- FAIR-CAM rating scale (triads) --------------------
// Same idea as your HTML tool: qualitative ratings map to (min, ml, max).
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

// Sample an operational effectiveness value (0..1) from a triad
export function sampleEffectiveness(effectTriad, rnd) {
  const v = triangularSample(effectTriad.min, effectTriad.ml, effectTriad.max, rnd);
  return clamp01(v);
}

// Combine multiple effects on same factor.
// If you have two independent reductions e1 and e2, combined reduction is:
// 1 - (1 - e1)(1 - e2)
export function combineReductions(effects) {
  let keep = 1;
  for (const e of effects) keep *= 1 - clamp01(e);
  return clamp01(1 - keep);
}

// VMC: improves reliability of LECs (indirect).
// We model it as pushing reliability upward toward 1.
// r' = r + vmcEff*(1-r)
export function applyVmcToReliability(r, vmcEff) {
  const rr = clamp01(r);
  const e = clamp01(vmcEff);
  return clamp01(rr + e * (1 - rr));
}

// -------------------- FAIR-CAM mapping --------------------
// LEC types mapped to FAIR factors (Training-friendly & consistent with CAM)
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

// -------------------- Core sampling with controls --------------------

function normalizeControls(controls) {
  return Array.isArray(controls) ? controls : [];
}

function getIncludedControls(controls, mode) {
  // mode: "baseline" or "whatif"
  // Baseline includes Implemented only.
  // What-if includes Implemented + controls flagged includeInWhatIf (and not Rejected).
  const list = normalizeControls(controls);

  if (mode === "baseline") {
    return list.filter((c) => c?.status === "Implemented");
  }

  // whatif
  return list.filter((c) => {
    if (c?.status === "Rejected") return false;
    if (c?.status === "Implemented") return true;
    return !!c?.includeInWhatIf;
  });
}

function effectivenessTriadForControl(c) {
  return operationalEffectivenessTriad(c.intendedRating, c.coverageRating, c.reliabilityRating);
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

// Returns a single draw including “trace” values for pedagogy in Results
export function sampleOnceWithControls(qIn, controls, rnd) {
  const q = ensureQuant(qIn);

  const included = controls || [];
  const { lec, vmc } = splitControls(included);

  // --- First: compute “effective reliability uplift” from VMC (indirect)
  // We'll apply VMC to each LEC reliability sample.
  const vmcEffects = vmc.map((c) => {
    const tri = effectivenessTriadForControl(c);
    return sampleEffectiveness(tri, rnd);
  });
  const vmcCombined = combineReductions(vmcEffects); // interpret as “improvement strength” (0..1)

  // --- Frequency chain: we compute TEF and Susceptibility (explicit), then LEF
  let tef = 0;
  let susc = 0;
  let lef = 0;

  // Base TEF calculation depends on abstraction level
  if (q.level === "LEF") {
    // LEF direct
    lef = Math.max(0, triangularSample(q.lef.min, q.lef.ml, q.lef.max, rnd));
  } else if (q.level === "TEF") {
    tef = Math.max(0, triangularSample(q.tef.min, q.tef.ml, q.tef.max, rnd));

    if (q.susceptibilityMode === "Direct") {
      // stored as % in fairEngine quant -> divide by 100 there, but here your Quantify UI uses 0..1.
      // Your engine fairEngine expects % (it divides by 100). To stay consistent with engine:
      // In this CAM engine we assume susceptibility inputs are 0..1 already if user uses your UI.
      // We'll clamp to 0..1.
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      let rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      // susceptibility is derived later (after LEC Resistance effects)
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * clamp01(susc);
  } else {
    // Contact Frequency
    const cf = Math.max(0, triangularSample(q.contactFrequency.min, q.contactFrequency.ml, q.contactFrequency.max, rnd));
    const poa = clamp01(triangularSample(q.probabilityOfAction.min, q.probabilityOfAction.ml, q.probabilityOfAction.max, rnd));
    tef = cf * poa;

    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max, rnd));
    } else {
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      let rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);
      susc = deriveSusceptibility(tc, rs);
    }

    lef = tef * clamp01(susc);
  }

  // --- Apply LEC effects
  // For each LEC, we sample its operational effectiveness (with VMC improving reliability)
  // and apply the effect to the correct FAIR factor.
  const tefReductions = [];
  const lefReductions = [];
  const lmReductions = [];
  const suscReductions = [];
  const rsUplifts = [];

  for (const c of lec) {
    // Sample intended/coverage/reliability by rating, with VMC improving reliability behavior
    const iTri = triadFromRating(c.intendedRating);
    const covTri = triadFromRating(c.coverageRating);
    const relTriBase = triadFromRating(c.reliabilityRating);

    const intended = sampleEffectiveness(iTri, rnd);
    const coverage = sampleEffectiveness(covTri, rnd);

    let reliability = sampleEffectiveness(relTriBase, rnd);
    reliability = applyVmcToReliability(reliability, vmcCombined);

    const eff = clamp01(intended * coverage * reliability); // operational effectiveness sample

    const factors = mapLecTypeToFactors(c.type);
    for (const f of factors) {
      if (f === "TEF") tefReductions.push(eff);
      if (f === "LEF") lefReductions.push(eff);
      if (f === "LM") lmReductions.push(eff);
      if (f === "SUSC") {
        // If we are in derived susceptibility mode, interpret Resistance as increasing RS.
        // Otherwise, treat as direct reduction on susceptibility.
        if (q.susceptibilityMode === "FromCapacityVsResistance") rsUplifts.push(eff);
        else suscReductions.push(eff);
      }
    }
  }

  // Apply TEF reductions (only if TEF exists in this abstraction level)
  const tefCut = combineReductions(tefReductions);
  if (q.level !== "LEF") {
    tef = tef * (1 - tefCut);
  }

  // Apply susceptibility reductions
  const suscCut = combineReductions(suscReductions);
  if (q.level !== "LEF") {
    if (q.susceptibilityMode === "Direct") {
      susc = clamp01(susc * (1 - suscCut));
    } else {
      // Recompute susceptibility with uplifted RS
      const tc = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max, rnd);
      let rs = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max, rnd);

      // Combine uplifts: r' = r * (1 + upliftCombined)
      const uplift = combineReductions(rsUplifts); // interpret as “strength gain”
      rs = rs * (1 + uplift);

      susc = deriveSusceptibility(tc, rs);
    }
  }

  // Recompute LEF if TEF+Susc are used
  if (q.level === "LEF") {
    // If user measured LEF directly, frequency-side controls collapse into LEF reductions.
    const collapsed = combineReductions([...tefReductions, ...lefReductions, ...suscReductions, ...rsUplifts]);
    lef = lef * (1 - collapsed);
  } else {
    lef = tef * clamp01(susc);
    // Apply explicit LEF reductions (Detection/Response)
    const lefCut = combineReductions(lefReductions);
    lef = lef * (1 - lefCut);
  }

  lef = Math.max(0, lef);

  // --- Magnitude / per-event loss
  // Base loss model: primary + SLEF * SLM
  let primary = Math.max(0, triangularSample(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max, rnd));
  let slef = Math.max(0, triangularSample(q.secondaryLossEventFrequency.min, q.secondaryLossEventFrequency.ml, q.secondaryLossEventFrequency.max, rnd));
  let slm = Math.max(0, triangularSample(q.secondaryLossMagnitude.min, q.secondaryLossMagnitude.ml, q.secondaryLossMagnitude.max, rnd));

  // Apply LM reductions (Resilience/Loss Minimization/Response)
  const lmCut = combineReductions(lmReductions);
  primary = primary * (1 - lmCut);
  slm = slm * (1 - lmCut);

  const perEventLoss = primary + slef * slm;

  // Return trace values for pedagogy
  return {
    tef,
    susceptibility: clamp01(susc),
    lef,
    perEventLoss,
    tefCut,
    lefCut: combineReductions(lefReductions),
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

  // For pedagogy summary (average chain values)
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

  return {
    sims,
    lastRunAt: new Date().toISOString(),
    aleSamples,
    pelSamples,
    stats,
    chain,
  };
}

export function getScenarioControls(scenario) {
  // Backward compatible: if old "treatments" exist, we still read them
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
