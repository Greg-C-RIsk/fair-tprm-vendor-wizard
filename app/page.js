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

const LS_KEY = "fair_tprm_training_v7";

// Small shared UI atoms for the shell
function Pill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 12,
        opacity: 0.95,
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  // --- persisted state (safe for prerender)
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

  // Persist normalized state (prevents “bad shape” from living forever)
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
    return (
      (selectedVendor.scenarios || []).find((s) => s.id === state.selectedScenarioId) ||
      selectedVendor.scenarios?.[0] ||
      null
    );
  }, [selectedVendor, state.selectedScenarioId]);

  // Keep selection valid if vendors/scenarios change
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

  // --- state mutation helpers (passed to views)
  const setSelectedVendorId = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId) || vendors[0] || null;
    setState((p) =>
      normalizeState({
        ...p,
        selectedVendorId: vendorId,
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      })
    );
  };

  const setSelectedScenarioId = (scenarioId) => {
    setState((p) => normalizeState({ ...p, selectedScenarioId: scenarioId }));
  };

  const createVendor = (vendorDraft) => {
    setState((p) =>
      normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), vendorDraft],
        selectedVendorId: vendorDraft.id,
        selectedScenarioId: vendorDraft.scenarios?.[0]?.id || "",
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

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...p, vendors: next, selectedVendorId: "", selectedScenarioId: "" });
    });
  };

  const resetAll = () => {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    const v = emptyVendor();
    setState(normalizeState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" }));
    setActiveView("Vendors");
  };

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
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{vendors.length} vendor(s)</Pill>
            <Pill>{vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0)} scenario(s)</Pill>
            <Pill>Carry-forward: {vendors.filter((v) => !!v.carryForward).length}</Pill>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={resetAll}>
            Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 14 }}>
        <Card style={{ padding: 10 }}>
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
            onSelectVendor={setSelectedVendorId}
            onCreateVendor={createVendor}
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
            onSelectScenario={setSelectedScenarioId}
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
          <DashboardView vendors={vendors} selectedVendorId={selectedVendor?.id || ""} setActiveView={setActiveView} />
        ) : (
          <Card>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Unknown view</div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>This tab is not wired yet.</div>
          </Card>
        )}
      </div>
    </div>
  );
}
