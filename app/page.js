"use client";

import { useEffect, useMemo, useState } from "react";

// IMPORTS DES VUES
import VendorView from "./components/VendorView";
import TieringView from "./components/TieringView";
import QuantifyView from "./components/QuantifyView";

// ---------------------------------------------
// Utils
// ---------------------------------------------

const LS_KEY = "fair_tprm_training_debug_v1";

const uid = () =>
  Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

// ---------------------------------------------
// Data factories (STABLES)
// ---------------------------------------------

const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const emptyQuant = () => ({
  level: "LEF",

  // fréquence
  lef: { min: "", ml: "", max: "" },
  tef: { min: "", ml: "", max: "" },
  contactFrequency: { min: "", ml: "", max: "" },
  probabilityOfAction: { min: "", ml: "", max: "" },
  susceptibility: { min: "", ml: "", max: "" },

  // capacité / résistance
  threatCapacity: { min: "", ml: "", max: "" },
  resistanceStrength: { min: "", ml: "", max: "" },

  // pertes
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
  attackVector: "",
  lossEvent: "",
  narrative: "",
  quant: emptyQuant(),
  treatments: [],
  decision: {
    status: "",
    owner: "",
    rationale: "",
  },
});

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  criticalFunction: "",
  dataTypes: "",
  tiering: emptyTiering(),
  carryForward: false,
  scenarios: [],
});

// ---------------------------------------------
// Page
// ---------------------------------------------

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
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) {
        return {
          vendors: [emptyVendor()],
          selectedVendorId: "",
          selectedScenarioId: "",
        };
      }
      return JSON.parse(raw);
    } catch {
      return {
        vendors: [emptyVendor()],
        selectedVendorId: "",
        selectedScenarioId: "",
      };
    }
  });

  // Persist state
  useEffect(() => {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const vendors = state.vendors;

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === state.selectedVendorId) || vendors[0];
  }, [vendors, state.selectedVendorId]);

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return (
      selectedVendor.scenarios.find(
        (s) => s.id === state.selectedScenarioId
      ) || selectedVendor.scenarios[0]
    );
  }, [selectedVendor, state.selectedScenarioId]);

  // ---------------------------------------------
  // Mutators (SAFE)
  // ---------------------------------------------

  const addVendor = () => {
    const v = emptyVendor();
    setState((prev) => ({
      ...prev,
      vendors: [...prev.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
  };

  const updateVendor = (vendorId, patch) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) =>
        v.id === vendorId ? { ...v, ...patch } : v
      ),
    }));
  };

  const addScenario = (vendorId) => {
    const s = emptyScenario();
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) =>
        v.id === vendorId
          ? { ...v, scenarios: [...v.scenarios, s] }
          : v
      ),
      selectedScenarioId: s.id,
    }));
  };

  const updateScenario = (vendorId, scenarioId, patch) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) =>
        v.id !== vendorId
          ? v
          : {
              ...v,
              scenarios: v.scenarios.map((s) =>
                s.id === scenarioId ? { ...s, ...patch } : s
              ),
            }
      ),
    }));
  };

  // ---------------------------------------------
  // Render
  // ---------------------------------------------

  return (
    <div className="container">
      <h1>FAIR TPRM Training Tool</h1>

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setActiveView("Vendors")}>Vendors</button>
        <button onClick={() => setActiveView("Tiering")}>Tiering</button>
        <button onClick={() => setActiveView("Quantify")}>Quantify</button>
        <button onClick={addVendor}>Add vendor</button>
      </div>

      {activeView === "Vendors" && selectedVendor && (
        <VendorView
          vendor={selectedVendor}
          addScenario={() => addScenario(selectedVendor.id)}
          updateVendor={updateVendor}
          setActiveView={setActiveView}
        />
      )}

      {activeView === "Tiering" && (
        <TieringView
          vendors={vendors}
          updateVendor={updateVendor}
        />
      )}

      {activeView === "Quantify" && selectedVendor && selectedScenario && (
        <QuantifyView
          scenario={selectedScenario}
          vendorId={selectedVendor.id}
          updateScenario={updateScenario}
        />
      )}
    </div>
  );
}
