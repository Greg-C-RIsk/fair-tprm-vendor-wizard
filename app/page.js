"use client";

import { useEffect, useMemo, useState } from "react";

/* ================================
   IMPORTS DES VIEWS
   (doivent exister dans /components)
   ================================ */

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

/* ================================
   CONSTANTS & HELPERS
   ================================ */

const STORAGE_KEY = "fair-tprm-state";

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ================================
   EMPTY MODELS (CRITICAL)
   ================================ */

const emptyScenario = () => ({
  id: uid(),
  title: "",
  quant: {},
  treatments: [],
  decision: {},
});

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  criticalFunction: "",
  dataTypes: "",
  scenarios: [],
  tiering: {},
});

/* ================================
   INITIAL STATE (SERVER SAFE)
   ================================ */

const initialState = {
  vendors: [],
  selectedVendorId: null,
  selectedScenarioId: null,
  activeView: "Vendors",
};

/* ================================
   PAGE
   ================================ */

export default function Page() {
  const [state, setState] = useState(initialState);

  /* ------------------------------
     HYDRATION SAFE LOAD
     ------------------------------ */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      setState({
        vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
        selectedVendorId: parsed.selectedVendorId || null,
        selectedScenarioId: parsed.selectedScenarioId || null,
        activeView: parsed.activeView || "Vendors",
      });
    } catch {
      // ignore corrupted storage
    }
  }, []);

  /* ------------------------------
     PERSISTENCE
     ------------------------------ */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota / private mode
    }
  }, [state]);

  /* ================================
     DERIVED STATE (DEFENSIVE)
     ================================ */

  const vendors = state.vendors || [];

  const selectedVendor = useMemo(() => {
    return (
      vendors.find((v) => v.id === state.selectedVendorId) || null
    );
  }, [vendors, state.selectedVendorId]);

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return (
      (selectedVendor.scenarios || []).find(
        (s) => s.id === state.selectedScenarioId
      ) || null
    );
  }, [selectedVendor, state.selectedScenarioId]);

  /* ================================
     ACTIONS
     ================================ */

  const setActiveView = (view) =>
    setState((s) => ({ ...s, activeView: view }));

  const addVendor = () => {
    const v = emptyVendor();
    setState((s) => ({
      ...s,
      vendors: [...s.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: null,
      activeView: "Vendors",
    }));
  };

  const updateVendor = (vendorId, patch) => {
    setState((s) => ({
      ...s,
      vendors: s.vendors.map((v) =>
        v.id === vendorId ? { ...v, ...patch } : v
      ),
    }));
  };

  const addScenario = (vendorId) => {
    const sc = emptyScenario();
    setState((s) => ({
      ...s,
      vendors: s.vendors.map((v) =>
        v.id === vendorId
          ? { ...v, scenarios: [...(v.scenarios || []), sc] }
          : v
      ),
      selectedScenarioId: sc.id,
      activeView: "Quantify",
    }));
  };

  /* ================================
     RENDER
     ================================ */

  return (
    <div className="container">
      {/* HEADER */}
      <header style={{ marginBottom: 24 }}>
        <h1>FAIR TPRM Training Tool</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Vendors", "Tiering", "Quantify", "Treatments", "Decisions", "Dashboard"].map(
            (v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                disabled={
                  (v !== "Vendors" && !selectedVendor) ||
                  (v === "Quantify" && !selectedScenario)
                }
              >
                {v}
              </button>
            )
          )}

          <button onClick={addVendor}>Add vendor</button>
        </div>
      </header>

      {/* MAIN VIEW */}
      {state.activeView === "Vendors" && (
        <VendorsView
          vendors={vendors}
          selectedVendor={selectedVendor}
          addVendor={addVendor}
          updateVendor={updateVendor}
          addScenario={addScenario}
          setActiveView={setActiveView}
        />
      )}

      {state.activeView === "Tiering" && selectedVendor && (
        <TieringView
          vendor={selectedVendor}
          updateVendor={updateVendor}
          setActiveView={setActiveView}
        />
      )}

      {state.activeView === "Quantify" &&
        selectedVendor &&
        selectedScenario && (
          <QuantifyView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        )}

      {state.activeView === "Treatments" &&
        selectedVendor &&
        selectedScenario && (
          <TreatmentsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        )}

      {state.activeView === "Decisions" &&
        selectedVendor &&
        selectedScenario && (
          <DecisionsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        )}

      {state.activeView === "Dashboard" && (
        <DashboardView vendors={vendors} />
      )}
    </div>
  );
}
