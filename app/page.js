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

const LS_KEY = "fair_tprm_training_v7_shell";

/**
 * page.js (Shell stable)
 * - Persists state in localStorage
 * - Keeps selectedVendorId / selectedScenarioId always valid via normalizeState()
 * - Renders tab components from /app/components/*
 */

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    // IMPORTANT: avoid SSR/prerender crashes
    if (typeof window === "undefined") {
      return normalizeState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
    }
    const raw = window.localStorage.getItem(LS_KEY);
    const base = raw
      ? safeParse(raw, { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" })
      : { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    return normalizeState(base);
  });

  // Persist (always normalized so we never keep a "bad shape" forever)
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
    const list = Array.isArray(selectedVendor.scenarios) ? selectedVendor.scenarios : [];
    return list.find((s) => s.id === state.selectedScenarioId) || list[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  // ---- Actions (all safe + normalized)

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

  const selectVendor = (vendorId) => {
    setState((p) => {
      const next = normalizeState(p);
      const v = (next.vendors || []).find((x) => x.id === vendorId) || next.vendors?.[0] || null;
      return normalizeState({
        ...next,
        selectedVendorId: vendorId,
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      });
    });
  };

  const selectScenario = (scenarioId) => {
    setState((p) => normalizeState({ ...p, selectedScenarioId: scenarioId }));
  };

  const addVendor = (vendorObj) => {
    setState((p) => {
      const next = normalizeState(p);
      const incoming = vendorObj && typeof vendorObj === "object" ? vendorObj : emptyVendor();
      const vendorsNext = [...(Array.isArray(next.vendors) ? next.vendors : []), incoming];

      const normalized = normalizeState({
        ...next,
        vendors: vendorsNext,
        selectedVendorId: incoming.id || next.selectedVendorId,
        selectedScenarioId: incoming?.scenarios?.[0]?.id || next.selectedScenarioId,
      });

      // if incoming had no id, normalizeState will generate one; select last vendor
      const last = normalized.vendors?.[normalized.vendors.length - 1] || null;
      return normalizeState({
        ...normalized,
        selectedVendorId: last?.id || normalized.selectedVendorId,
        selectedScenarioId: last?.scenarios?.[0]?.id || normalized.selectedScenarioId,
      });
    });
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = normalizeState(p);
      const remaining = (Array.isArray(next.vendors) ? next.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...next, vendors: remaining, selectedVendorId: "", selectedScenarioId: "" });
    });
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) => {
      const next = normalizeState(p);
      const vendorsNext = (Array.isArray(next.vendors) ? next.vendors : []).map((v) =>
        v.id === vendorId ? { ...v, ...(patch || {}) } : v
      );
      return normalizeState({ ...next, vendors: vendorsNext });
    });
  };

  // ---- Header stats
  const totalScenarios = useMemo(() => {
    return vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0);
  }, [vendors]);

  // ---- Tabs
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

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill">{vendors.length} vendor(s)</span>
            <span className="pill">{totalScenarios} scenario(s)</span>
            <span className="pill">Selected: {selectedVendor?.name?.trim() ? selectedVendor.name : "(none)"}</span>
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
            selectedVendor={selectedVendor}
            onSelectVendor={selectVendor}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
          />
        ) : activeView === "Scenarios" ? (
          <ScenariosView
            vendor={selectedVendor}
            scenario={selectedScenario}
            onSelectScenario={selectScenario}
            onUpdateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Tiering" ? (
          <TieringView vendor={selectedVendor} onUpdateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Quantify" ? (
          <QuantifyView vendor={selectedVendor} scenario={selectedScenario} onUpdateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Results" ? (
          <ResultsView vendor={selectedVendor} scenario={selectedScenario} setActiveView={setActiveView} />
        ) : activeView === "Treatments" ? (
          <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} onUpdateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Decisions" ? (
          <DecisionsView vendor={selectedVendor} scenario={selectedScenario} onUpdateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} setActiveView={setActiveView} />
        ) : (
          <div className="card">Unknown view.</div>
        )}
      </div>
    </div>
  );
}
