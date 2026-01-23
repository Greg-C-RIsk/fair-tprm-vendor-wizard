// lib/model.js
// Shared data model + normalization helpers for the FAIR TPRM Training Tool.
// Goal: avoid any "Cannot access X before initialization" (TDZ) issues in prod bundles.

export function uid() {
  // simple, deterministic enough for training (browser-only persistence)
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

function emptyDecision() {
  return { status: "", owner: "", approver: "", reviewDate: "", rationale: "" };
}

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
    decision: emptyDecision(),
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

  const inputVendors = Array.isArray(base.vendors) ? base.vendors : [];
  const vendorsSeed = inputVendors.length ? inputVendors : [emptyVendor()];

  const vendors = vendorsSeed.map((vend) => {
    const vv = vend && typeof vend === "object" ? vend : {};

    const tieringObj =
      vv.tiering && typeof vv.tiering === "object" ? vv.tiering : {};
    const tiering = { ...emptyTiering(), ...tieringObj };

    const inputScenarios = Array.isArray(vv.scenarios) ? vv.scenarios : [];
    const scenariosSeed = inputScenarios.length ? inputScenarios : [emptyScenario()];

    const scenarios = scenariosSeed.map((sc) => {
      const ss = sc && typeof sc === "object" ? sc : {};

      const quantObj = ss.quant && typeof ss.quant === "object" ? ss.quant : {};
      const decisionObj =
        ss.decision && typeof ss.decision === "object" ? ss.decision : {};

      return {
        ...emptyScenario(),
        ...ss,
        id: ss.id || uid(),
        quant: { ...emptyQuant(), ...quantObj },
        treatments: Array.isArray(ss.treatments) ? ss.treatments : [],
        decision: { ...emptyDecision(), ...decisionObj },
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

  // Keep selected ids valid
  let selectedVendorId =
    typeof base.selectedVendorId === "string" ? base.selectedVendorId : "";
  if (!vendors.some((v) => v.id === selectedVendorId)) {
    selectedVendorId = vendors[0]?.id || "";
  }

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) || vendors[0] || null;

  let selectedScenarioId =
    typeof base.selectedScenarioId === "string" ? base.selectedScenarioId : "";
  const scenarioIds = (selectedVendor?.scenarios || []).map((s) => s.id);
  if (!scenarioIds.includes(selectedScenarioId)) {
    selectedScenarioId = selectedVendor?.scenarios?.[0]?.id || "";
  }

  return { vendors, selectedVendorId, selectedScenarioId };
}
