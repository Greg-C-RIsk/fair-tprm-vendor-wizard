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

import { emptyVendor, emptyScenario, normalizeState, safeParse } from "../lib/model";

/**
 * app/page.js — Shell stable (Next export safe)
 * - No circular deps
 * - No hook initializers referencing vars declared later (fixes "Cannot access 'i' before initialization")
 * - Centralized state + persistence
 * - Tabs + global vendor/scenario pickers
 */

const LS_KEY = "fair_tprm_training_v7";

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

  // ---- persisted app state (SSR-safe initializer)
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
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_KEY, JSON.stringify(normalizeState(state)));
      }
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

  // ---- helpers
  const setSelectedVendorId = (vendorId) => {
    setState((p) => {
      const next = normalizeState({ ...p, selectedVendorId: vendorId });
      // force scenario selection to first scenario of selected vendor
      const v = next.vendors.find((x) => x.id === next.selectedVendorId) || next.vendors[0] || null;
      const firstScenarioId = v?.scenarios?.[0]?.id || "";
      return normalizeState({ ...next, selectedScenarioId: firstScenarioId });
    });
  };

  const setSelectedScenarioId = (scenarioId) => {
    setState((p) => normalizeState({ ...p, selectedScenarioId: scenarioId }));
  };

  const addVendor = () => {
    setState((p) => {
      const v = emptyVendor();
      const next = normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      });
      return next;
    });
    setActiveView("Vendors");
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) => {
      const nextVendors = (Array.isArray(p.vendors) ? p.vendors : []).map((v) =>
        v.id === vendorId ? { ...v, ...patch } : v
      );
      return normalizeState({ ...p, vendors: nextVendors });
    });
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const remaining = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      const fallback = remaining.length ? remaining : [emptyVendor()];
      const selVendor = fallback[0];
      return normalizeState({
        ...p,
        vendors: fallback,
        selectedVendorId: selVendor?.id || "",
        selectedScenarioId: selVendor?.scenarios?.[0]?.id || "",
      });
    });
    setActiveView("Vendors");
  };

  const ensureVendorScenario = () => {
    if (!selectedVendor) return { v: null, s: null };
    const scenarios = Array.isArray(selectedVendor.scenarios) ? selectedVendor.scenarios : [];
    const s = selectedScenario || scenarios[0] || null;
    return { v: selectedVendor, s };
  };

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

  const totalScenarios = vendors.reduce(
    (n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0),
    0
  );

  const showScenarioPicker = activeView !== "Vendors" && !!selectedVendor;

  const { v, s } = ensureVendorScenario();

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>
            FAIR TPRM Training Tool
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{vendors.length} vendor(s)</Pill>
            <Pill>{totalScenarios} scenario(s)</Pill>
            <Pill>Selected: {selectedVendor?.name?.trim() ? selectedVendor.name : "(Unnamed vendor)"}</Pill>
            {showScenarioPicker ? (
              <Pill>
                Scenario:{" "}
                {s?.title?.trim() ? s.title : "(Untitled)"}
              </Pill>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn"
            onClick={() => {
              try {
                if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
              } catch {}
              const vv = emptyVendor();
              setState(
                normalizeState({
                  vendors: [vv],
                  selectedVendorId: vv.id,
                  selectedScenarioId: vv.scenarios?.[0]?.id || "",
                })
              );
              setActiveView("Vendors");
            }}
          >
            Reset
          </button>

          {showScenarioPicker ? (
            <select
              className="input"
              style={{ maxWidth: 360 }}
              value={s?.id || ""}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
            >
              {(selectedVendor?.scenarios || []).map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title?.trim() ? sc.title : "(Untitled scenario)"}
                </option>
              ))}
            </select>
          ) : null}
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
            selectedVendor={selectedVendor}
            onSelectVendor={setSelectedVendorId}
            onAddVendor={addVendor}
            onUpdateVendor={(vendorId, patch) => updateVendor(vendorId, patch)}
            onDeleteVendor={deleteVendor}
          />
        ) : activeView === "Scenarios" ? (
          v ? (
            <ScenariosView vendor={v} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>No vendor selected.</Card>
          )
        ) : activeView === "Tiering" ? (
          v ? (
            <TieringView vendor={v} />
          ) : (
            <Card>No vendor selected.</Card>
          )
        ) : activeView === "Quantify" ? (
          v && s ? (
            <QuantifyView vendor={v} scenario={s} />
          ) : (
            <Card>Select a vendor and scenario first.</Card>
          )
        ) : activeView === "Results" ? (
          v && s ? (
            <ResultsView vendor={v} scenario={s} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>Select a vendor and scenario first.</Card>
          )
        ) : activeView === "Treatments" ? (
          v && s ? (
            <TreatmentsView vendor={v} scenario={s} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>Select a vendor and scenario first.</Card>
          )
        ) : activeView === "Decisions" ? (
          v && s ? (
            <DecisionsView vendor={v} scenario={s} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : (
            <Card>Select a vendor and scenario first.</Card>
          )
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} />
        ) : (
          <Card>Unknown view.</Card>
        )}
      </div>
    </div>
  );
}
