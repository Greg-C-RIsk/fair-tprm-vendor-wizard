"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================
   Components
========================= */

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import ScenariosView from "./components/ScenariosView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

/* =========================
   Utils & storage
========================= */

const LS_KEY = "fair_tprm_training_state_v1";
const uid = () => Math.random().toString(36).slice(2);

/* =========================
   Data models
========================= */

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

  quant: emptyQuant(),
  treatments: [],
  decision: {
    status: "",
    owner: "",
    approver: "",
    reviewDate: "",
    rationale: "",
  },
});

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",

  tiering: {
    dataSensitivity: 1,
    integrationDepth: 1,
    accessPrivileges: 1,
    historicalIncidents: 1,
    businessCriticality: 1,
  },

  tier: "",
  tierRationale: "",
  carryForward: false,

  scenarios: [],
});

/* =========================
   Page
========================= */

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return {
        vendors: [emptyVendor()],
        selectedVendorId: "",
        selectedScenarioId: "",
      };
    }

    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) throw new Error();
      return JSON.parse(raw);
    } catch {
      return {
        vendors: [emptyVendor()],
        selectedVendorId: "",
        selectedScenarioId: "",
      };
    }
  });

  /* =========================
     Persistence
  ========================= */

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  /* =========================
     Derived state
  ========================= */

  const vendors = state.vendors;

  const selectedVendor = useMemo(
    () => vendors.find(v => v.id === state.selectedVendorId) || vendors[0] || null,
    [vendors, state.selectedVendorId]
  );

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return (
      selectedVendor.scenarios.find(s => s.id === state.selectedScenarioId) ||
      selectedVendor.scenarios[0] ||
      null
    );
  }, [selectedVendor, state.selectedScenarioId]);

  /* =========================
     Actions
  ========================= */

  const addVendor = () => {
    const v = emptyVendor();
    setState(prev => ({
      ...prev,
      vendors: [...prev.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
    setActiveView("Vendors");
  };

  const addScenario = () => {
    if (!selectedVendor) return;
    const s = emptyScenario();

    setState(prev => ({
      ...prev,
      vendors: prev.vendors.map(v =>
        v.id === selectedVendor.id
          ? { ...v, scenarios: [...v.scenarios, s] }
          : v
      ),
      selectedScenarioId: s.id,
    }));

    setActiveView("Scenarios");
  };

  /* =========================
     Render
  ========================= */

  return (
    <div className="container">
      <header className="header">
        <h1>FAIR TPRM Training Tool</h1>

        <div className="nav">
          {["Vendors", "Tiering", "Scenarios", "Quantify", "Treatments", "Decisions", "Dashboard"].map(v => (
            <button
              key={v}
              className={activeView === v ? "active" : ""}
              onClick={() => setActiveView(v)}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="actions">
          <button onClick={addVendor}>Add vendor</button>
          <button onClick={addScenario} disabled={!selectedVendor}>
            Add scenario
          </button>
        </div>
      </header>

      {activeView === "Vendors" && (
        <VendorsView
          state={state}
          setState={setState}
          selectedVendor={selectedVendor}
        />
      )}

      {activeView === "Tiering" && (
        <TieringView
          state={state}
          setState={setState}
          selectedVendor={selectedVendor}
        />
      )}

      {activeView === "Scenarios" && (
        <ScenariosView
          state={state}
          setState={setState}
          selectedVendor={selectedVendor}
          selectedScenario={selectedScenario}
        />
      )}

      {activeView === "Quantify" && (
        <QuantifyView
          state={state}
          setState={setState}
          selectedVendor={selectedVendor}
          selectedScenario={selectedScenario}
        />
      )}

      {activeView === "Treatments" && (
        <TreatmentsView
          state={state}
          setState={setState}
          selectedScenario={selectedScenario}
        />
      )}

      {activeView === "Decisions" && (
        <DecisionsView
          state={state}
          setState={setState}
          selectedScenario={selectedScenario}
        />
      )}

      {activeView === "Dashboard" && (
        <DashboardView state={state} />
      )}
    </div>
  );
}
