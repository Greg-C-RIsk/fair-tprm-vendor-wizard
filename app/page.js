"use client";

import { useEffect, useMemo, useState } from "react";

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import ScenariosView from "./components/ScenariosView";
import QuantifyView from "./components/QuantifyView";
import ResultsView from "./components/ResultsView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

import { emptyVendor, normalizeState, safeParse } from "../lib/model";

const LS_KEY = "fair_tprm_training_v6";

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    const fallback = { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };

    // IMPORTANT: éviter les crashs SSR/prerender
    if (typeof window === "undefined") return normalizeState(fallback);

    const raw = window.localStorage.getItem(LS_KEY);
    const base = raw ? safeParse(raw, fallback) : fallback;
    return normalizeState(base);
  });

  // Persist (et renormalise pour éviter qu’un état “cassé” reste stocké)
  useEffect(() => {
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
    const scenarios = Array.isArray(selectedVendor.scenarios) ? selectedVendor.scenarios : [];
    return scenarios.find((s) => s.id === state.selectedScenarioId) || scenarios[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  // --- Actions (state management) ---
  const selectVendor = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId) || vendors[0] || null;
    const firstScenarioId = v?.scenarios?.[0]?.id || "";
    setState((p) => normalizeState({ ...p, selectedVendorId: vendorId, selectedScenarioId: firstScenarioId }));
  };

  const selectScenario = (scenarioId) => {
    setState((p) => normalizeState({ ...p, selectedScenarioId: scenarioId }));
  };

  const addVendor = (vendorObj) => {
    setState((p) => normalizeState({ ...p, vendors: [...(p.vendors || []), vendorObj] }));
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) =>
      normalizeState({
        ...p,
        vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
      })
    );
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...p, vendors: next, selectedVendorId: "", selectedScenarioId: "" });
    });
    setActiveView("Vendors");
  };

  const resetAll = () => {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    } catch {}
    const v = emptyVendor();
    setState(normalizeState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" }));
    setActiveView("Vendors");
  };

  // --- UI helpers (pills) ---
  const vendorCount = vendors.length;
  const scenarioCount = vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0);
  const carryCount = vendors.filter((v) => !!v.carryForward).length;

  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Scenarios", label: "Scenarios" },
    { k: "Quantify", label: "Quantify" },
    { k: "Results", label: "Results" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill">{vendorCount} vendor(s)</span>
            <span className="pill">{scenarioCount} scenario(s)</span>
            <span className="pill">Carry-forward: {carryCount}</span>
          </div>
        </div>

        <button className="btn" onClick={resetAll}>
          Reset
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 14 }}>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveView(t.k)}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: activeView === t.k ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
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
      </div>

      {/* Main */}
      <div style={{ marginTop: 14 }}>
        {activeView === "Vendors" ? (
          <VendorsView
            vendors={vendors}
            selectedVendorId={selectedVendor?.id || ""}
            onSelectVendor={selectVendor}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Tiering" ? (
          <TieringView vendor={selectedVendor} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Scenarios" ? (
          <ScenariosView
            vendor={selectedVendor}
            selectedScenarioId={selectedScenario?.id || ""}
            onSelectScenario={selectScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Quantify" ? (
          <QuantifyView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Results" ? (
          <ResultsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Treatments" ? (
          <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Decisions" ? (
          <DecisionsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} setActiveView={setActiveView} />
        ) : (
          <div className="card">Unknown view.</div>
        )}
      </div>
    </div>
  );
}
