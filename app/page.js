"use client";

import { useEffect, useMemo, useState } from "react";

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

/**
 * page.js = SHELL stable
 * - Top nav = tabs only
 * - Global state + localStorage safe (no prerender crash)
 * - Selected vendor/scenario always valid
 * - Delegates per-tab UX to components/
 */

const LS_KEY = "fair_tprm_training_v6";
const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

// ---------------------------
// Model helpers (same as your Mode A)
// ---------------------------

const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const emptyQuant = () => ({
  level: "LEF",
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
});

const emptyScenario = () => ({
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
  decision: { status: "", owner: "", approver: "", reviewDate: "", rationale: "" },
});

const emptyVendor = () => ({
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
});

// ---------------------------
// Safety / normalization (copied from your file, unchanged conceptually)
// ---------------------------

function safeParse(raw, fallback) {
  try {
    const x = JSON.parse(raw);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(maybeState) {
  const base = maybeState && typeof maybeState === "object" ? maybeState : {};
  let vendors = Array.isArray(base.vendors) ? base.vendors : [];

  if (!vendors.length) vendors = [emptyVendor()];

  vendors = vendors.map((v) => {
    const vv = v && typeof v === "object" ? v : {};
    const tiering = vv.tiering && typeof vv.tiering === "object" ? { ...emptyTiering(), ...vv.tiering } : emptyTiering();

    let scenarios = Array.isArray(vv.scenarios) ? vv.scenarios : [];
    if (!scenarios.length) scenarios = [emptyScenario()];

    scenarios = scenarios.map((s) => {
      const ss = s && typeof s === "object" ? s : {};
      const quant = ss.quant && typeof ss.quant === "object" ? { ...emptyQuant(), ...ss.quant } : emptyQuant();
      return {
        ...emptyScenario(),
        ...ss,
        id: ss.id || uid(),
        quant,
        treatments: Array.isArray(ss.treatments) ? ss.treatments : [],
        decision:
          ss.decision && typeof ss.decision === "object"
            ? { ...emptyScenario().decision, ...ss.decision }
            : emptyScenario().decision,
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

  const selectedVendorId =
    vendors.some((v) => v.id === base.selectedVendorId) ? base.selectedVendorId : vendors[0]?.id || "";

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) || vendors[0] || null;
  const scenarioIds = selectedVendor?.scenarios?.map((s) => s.id) || [];
  const selectedScenarioId = scenarioIds.includes(base.selectedScenarioId)
    ? base.selectedScenarioId
    : selectedVendor?.scenarios?.[0]?.id || "";

  return { vendors, selectedVendorId, selectedScenarioId };
}

// ---------------------------
// Page (shell)
// ---------------------------

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return normalizeState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
    }
    const raw = window.localStorage.getItem(LS_KEY);
    const base = raw
      ? safeParse(raw, { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" })
      : { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    return normalizeState(base);
  });

  // Persist normalized state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(normalizeState(state)));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const vendors = Array.isArray(state.vendors) ? state.vendors : [];

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null;
  }, [vendors, state.selectedVendorId]);

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return (selectedVendor.scenarios || []).find((s) => s.id === state.selectedScenarioId) || selectedVendor.scenarios?.[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  // Keep selection valid if vendors list changes
  useEffect(() => {
    const next = normalizeState(state);
    if (
      next.selectedVendorId !== state.selectedVendorId ||
      next.selectedScenarioId !== state.selectedScenarioId ||
      next.vendors.length !== vendors.length
    ) {
      setState(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors.length]);

  // ---- mutations
  const selectVendor = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId) || vendors[0] || null;
    setState((p) =>
      normalizeState({
        ...p,
        selectedVendorId: vendorId,
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      })
    );
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) =>
      normalizeState({
        ...p,
        vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
      })
    );
  };

  const addVendor = (draft) => {
    const v = {
      ...emptyVendor(),
      ...draft,
      id: uid(),
      tiering: draft?.tiering || emptyTiering(),
      scenarios: Array.isArray(draft?.scenarios) && draft.scenarios.length ? draft.scenarios : [emptyScenario()],
    };

    setState((p) =>
      normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      })
    );
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...p, vendors: next, selectedVendorId: "", selectedScenarioId: "" });
    });
  };

  const resetAll = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LS_KEY);
      } catch {
        // ignore
      }
    }
    const v = emptyVendor();
    setState(normalizeState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" }));
    setActiveView("Vendors");
  };

  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Quantify", label: "Quantify" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{vendors.length} vendor(s)</span>
            <span className="badge">
              {vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0)} scenario(s)
            </span>
            <span className="badge">Carry-forward: {vendors.filter((v) => !!v.carryForward).length}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={resetAll}>Reset</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 999,
            padding: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setActiveView(t.k)}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: activeView === t.k ? "rgba(59,130,246,0.22)" : "rgba(0,0,0,0.12)",
                color: "inherit",
                borderRadius: 999,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                opacity: activeView === t.k ? 1 : 0.92,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ marginTop: 14 }}>
        {activeView === "Vendors" ? (
          <VendorsView
            vendors={vendors}
            selectedVendor={selectedVendor}
            onSelectVendor={selectVendor}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Tiering" ? (
          <TieringView
            vendor={selectedVendor}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Quantify" ? (
          <QuantifyView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Treatments" ? (
          <TreatmentsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Decisions" ? (
          <DecisionsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Dashboard" ? (
          <DashboardView
            vendors={vendors}
            setActiveView={setActiveView}
          />
        ) : null}
      </div>
    </div>
  );
}
