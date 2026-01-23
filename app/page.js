"use client";

import { useEffect, useMemo, useState } from "react";

import VendorsView from "./components/VendorsView";
import ScenariosView from "./components/ScenariosView";
import TieringView from "./components/TieringView";
import QuantifyView from "./components/QuantifyView";
import ResultsView from "./components/ResultsView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

import { emptyVendor, normalizeState, safeParse } from "../lib/model";

const LS_KEY = "fair_tprm_training_v7";

function Card({ children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </div>
  );
}

export default function Page() {
  // Tabs: définis AVANT le return (évite tout problème TDZ en minification)
  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Scenarios", label: "Scenarios" },
    { k: "Tiering", label: "Tiering" },
    { k: "Quantify", label: "Quantify" },
    { k: "Results", label: "Results" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

  const [activeView, setActiveView] = useState("Vendors");

  // State persistant (safe SSR)
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

  // Persist
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_KEY, JSON.stringify(normalizeState(state)));
      }
    } catch {
      // ignore
    }
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

  // Keep selection valid (si vendor supprimé, scenario manquant, etc.)
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

  // ---- Mutations “source of truth” ----
  const selectVendor = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId) || null;
    setState((p) =>
      normalizeState({
        ...p,
        selectedVendorId: vendorId,
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      })
    );
  };

  const selectScenario = (scenarioId) => {
    setState((p) =>
      normalizeState({
        ...p,
        selectedScenarioId: scenarioId,
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

  const addVendor = () => {
    const v = emptyVendor();
    setState((p) =>
      normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      })
    );
    setActiveView("Vendors");
  };

  const deleteVendor = (vendorId) => {
    setState((p) => normalizeState({ ...p, vendors: (p.vendors || []).filter((v) => v.id !== vendorId) }));
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

  // ---- Header stats ----
  const scenarioCount = useMemo(() => {
    return vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0);
  }, [vendors]);

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill">{vendors.length} vendor(s)</span>
            <span className="pill">{scenarioCount} scenario(s)</span>
            {selectedVendor ? <span className="pill">Selected: {selectedVendor.name?.trim() ? selectedVendor.name : "(Unnamed)"}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={addVendor}>
            + Add vendor
          </button>
          <button className="btn" onClick={resetAll}>
            Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 14 }}>
        <Card>
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
        </Card>
      </div>

      {/* Main */}
      <div style={{ marginTop: 14 }}>
        {activeView === "Vendors" ? (
          <VendorsView
            vendors={vendors}
            selectedVendorId={selectedVendor?.id || ""}
            onSelectVendor={selectVendor}
            onCreateVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Scenarios" ? (
          selectedVendor ? (
            <ScenariosView vendor={selectedVendor} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No vendor selected. Go to Vendors.</Card>
          )
        ) : activeView === "Tiering" ? (
          selectedVendor ? (
            <TieringView vendor={selectedVendor} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No vendor selected. Go to Vendors.</Card>
          )
        ) : activeView === "Quantify" ? (
          selectedVendor && selectedScenario ? (
            <QuantifyView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No scenario selected. Go to Scenarios.</Card>
          )
        ) : activeView === "Results" ? (
          selectedVendor && selectedScenario ? (
            <ResultsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No scenario selected. Go to Scenarios.</Card>
          )
        ) : activeView === "Treatments" ? (
          selectedVendor && selectedScenario ? (
            <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No scenario selected. Go to Scenarios.</Card>
          )
        ) : activeView === "Decisions" ? (
          selectedVendor && selectedScenario ? (
            <DecisionsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No scenario selected. Go to Scenarios.</Card>
          )
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} setActiveView={setActiveView} />
        ) : (
          <Card>Unknown view.</Card>
        )}
      </div>
    </div>
  );
}
