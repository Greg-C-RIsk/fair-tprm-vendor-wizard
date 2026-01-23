// lib/model.js
// Shared data model + normalization helpers for the FAIR TPRM Training Tool.
// NOTE: Use function declarations (hoisted) to avoid TDZ issues in production builds.

export function uid() {
  return Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

// ---------- Tiering ----------
export function emptyTiering() {
  return {
    dataSensitivity: 1,
    integrationDepth: 1,
    accessPrivileges: 1,
    historicalIncidents: 1,
    businessCriticality: 1,
  };
}

export function tierIndex(t) {
  return (
    Number(t?.dataSensitivity || 1) *
    Number(t?.integrationDepth || 1) *
    Number(t?.accessPrivileges || 1) *
    Number(t?.historicalIncidents || 1) *
    Number(t?.businessCriticality || 1)
  );
}

// ---------- Quantification (FAIR inputs only) ----------
export function emptyQuant() {
  return {
    level: "LEF", // "LEF" | "TEF" | "Contact Frequency"

    lef: { min: "", ml: "", max: "" },
    tef: { min: "", ml: "", max: "" },
    contactFrequency: { min: "", ml: "", max: "" },
    probabilityOfAction: { min: "", ml: "", max: "" },
    susceptibility: { min: "", ml: "", max: "" },

    threatCapacity: { min: "", ml: "", max: "" },
    resistanceStrength: { min: "", ml: "", max: "" },

    primaryLoss: { min: "", ml: "", max: "" },
    secondaryLossEventFrequency: { min: "", ml: "", max: "" },
    secondaryLossMagnitude: { min: "", ml: "", max: "" },

    sims: 10000,
    stats: null,
    aleSamples: [],
    pelSamples: [],
    lastRunAt: "",
  };
}

const DECISION_DEFAULT = {
  status: "",
  owner: "",
  approver: "",
  reviewDate: "",
  rationale: "",
};

// ---------- Scenario ----------
export function emptyScenario() {
  return {
    id: uid(),
    title: "",
    assetAtRisk: "",
    threatActor: "External cybercriminal",
    attackVector: "",
    lossEvent: "",
    narrative: "",
    assumptions: "",
    quant: emptyQuant(),
    treatments: [],
    decision: { ...DECISION_DEFAULT },
  };
}

// ---------- Vendor ----------
export function emptyVendor() {
  return {
    id: uid(),
    name: "",
    category: "SaaS",
    businessOwner: "",
    criticalFunction: "",
    dataTypes: "",
    geography: "EU",
    dependencyLevel: "Medium",
    tier: "",
    tierRationale: "",
    tiering: emptyTiering(),
    carryForward: false,
    scenarios: [emptyScenario()],
  };
}

// ---------- Storage helpers ----------
export function safeParse(raw, fallback) {
  try {
    const x = JSON.parse(raw);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Normalize state loaded from storage so we never crash:
 * - vendors is array, at least 1
 * - each vendor has tiering + scenarios (at least 1)
 * - each scenario has quant/treatments/decision
 * - selectedVendorId / selectedScenarioId always valid
 */
export function normalizeState(maybeState) {
  const base = maybeState && typeof maybeState === "object" ? maybeState : {};
  let vendors = Array.isArray(base.vendors) ? base.vendors : [];

  if (!vendors.length) vendors = [emptyVendor()];

  vendors = vendors.map((v) => {
    const vv = v && typeof v === "object" ? v : {};

    const tiering =
      vv.tiering && typeof vv.tiering === "object"
        ? { ...emptyTiering(), ...vv.tiering }
        : emptyTiering();

    let scenarios = Array.isArray(vv.scenarios) ? vv.scenarios : [];
    if (!scenarios.length) scenarios = [emptyScenario()];

    scenarios = scenarios.map((s) => {
      const ss = s && typeof ss === "object" ? s : {};

      const quant =
        ss.quant && typeof ss.quant === "object"
          ? { ...emptyQuant(), ...ss.quant }
          : emptyQuant();

      const decision =
        ss.decision && typeof ss.decision === "object"
          ? { ...DECISION_DEFAULT, ...ss.decision }
          : { ...DECISION_DEFAULT };

      return {
        ...emptyScenario(),
        ...ss,
        id: ss.id || uid(),
        quant,
        treatments: Array.isArray(ss.treatments) ? ss.treatments : [],
        decision,
      };
    });

    return {
      ...emptyVendor(),
      ...vv,
      id: vv.id || uid(),
      tiering,
      scenarios,
      carryForward: !!vv.carryForward,
    };
  });

  const selectedVendorId = vendors.some((v) => v.id === base.selectedVendorId)
    ? base.selectedVendorId
    : vendors[0]?.id || "";

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) || vendors[0] || null;
  const scenarioIds = (selectedVendor?.scenarios || []).map((s) => s.id);

  const selectedScenarioId = scenarioIds.includes(base.selectedScenarioId)
    ? base.selectedScenarioId
    : selectedVendor?.scenarios?.[0]?.id || "";

  return { vendors, selectedVendorId, selectedScenarioId };
}
