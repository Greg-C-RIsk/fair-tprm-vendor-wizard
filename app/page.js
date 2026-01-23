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

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  // ---------------------------
  // Persisted state (safe for prerender/export)
  // ---------------------------
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      // During build/prerender: return a safe minimal shape
      const v = emptyVendor();
      return normalizeState({
        vendors: [v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      });
    }

    const raw = window.localStorage.getItem(LS_KEY);
    const base = raw
      ? safeParse(raw, { vendors: [], selectedVendorId: "", selectedScenarioId: "" })
      : { vendors: [], selectedVendorId: "", selectedScenarioId: "" };

    return normalizeState(base);
  });

  useEffect(() => {
    try {
      // Persist normalized state so we never keep a “bad shape”
      window.localStorage.setItem(LS_KEY, JSON.stringify(normalizeState(state)));
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

  // Keep selection valid whenever vendors/scenarios change
  useEffect(() => {
    setState((prev) => normalizeState(prev));
  }, [vendors.length]);

  // ---------------------------
  // Actions (hoisted-safe, no TDZ)
  // ---------------------------
  function selectVendor(vendorId) {
    setState((prev) => {
      const v = (prev.vendors || []).find((x) => x.id === vendorId) || null;
      const firstScenarioId = v?.scenarios?.[0]?.id || "";
      return normalizeState({
        ...prev,
        selectedVendorId: vendorId,
        selectedScenarioId: firstScenarioId,
      });
    });
  }

  function selectScenario(scenarioId) {
    setState((prev) =>
      normalizeState({
        ...prev,
        selectedScenarioId: scenarioId,
      })
    );
  }

  function addVendor(vendorDraft) {
    setState((prev) => {
      const next = normalizeState(prev);
      const v = vendorDraft && typeof vendorDraft === "object" ? vendorDraft : emptyVendor();
      const merged = normalizeState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" }).vendors[0];
      const vendors2 = [...(next.vendors || []), merged];
      return normalizeState({
        ...next,
        vendors: vendors2,
        selectedVendorId: merged.id,
        selectedScenarioId: merged.scenarios?.[0]?.id || "",
      });
    });
  }

  function updateVendor(vendorId, patch) {
    setState((prev) => {
      const nextVendors = (prev.vendors || []).map((v) => {
        if (v.id !== vendorId) return v;
        const p = patch && typeof patch === "object" ? patch : {};
        return { ...v, ...p };
      });
      return normalizeState({ ...prev, vendors: nextVendors });
    });
  }

  function deleteVendor(vendorId) {
    setState((prev) => {
      const remaining = (prev.vendors || []).filter((v) => v.id !== vendorId);
      return normalizeState({
        ...prev,
        vendors: remaining,
        selectedVendorId: "",
        selectedScenarioId: "",
      });
    });
  }

  function resetAll() {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    const v = emptyVendor();
    setState(
      normalizeState({
        vendors: [v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      })
    );
    setActiveView("Vendors");
  }

  // ---------------------------
  // UI helpers (simple, stable)
  // ---------------------------
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

  const scenarioList = selectedVendor?.scenarios || [];

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="pill">{vendors.length} vendor(s)</span>
            <span className="pill">
              {(vendors || []).reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0)} scenario(s)
            </span>
            <span className="pill">Carry-forward: {(vendors || []).filter((v) => !!v.carryForward).length}</span>

            {/* Global workspace selector (keeps Scenarios usable everywhere) */}
            <span className="pill" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span style={{ opacity: 0.9, fontWeight: 800 }}>Workspace:</span>
              <span style={{ opacity: 0.9 }}>
                {selectedVendor?.name?.trim() ? selectedVendor.name : "(Unnamed vendor)"}
              </span>
              <span style={{ opacity: 0.6 }}>•</span>
              <select
                className="input"
                style={{ height: 30, padding: "0 10px", borderRadius: 999, maxWidth: 260 }}
                value={selectedScenario?.id || ""}
                onChange={(e) => selectScenario(e.target.value)}
                disabled={!scenarioList.length}
              >
                {scenarioList.length ? (
                  scenarioList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title?.trim() ? s.title : "(Untitled scenario)"}
                    </option>
                  ))
                ) : (
                  <option value="">(No scenario)</option>
                )}
              </select>
            </span>
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
            selectedVendor={selectedVendor}
            onSelectVendor={selectVendor}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Scenarios" ? (
          <ScenariosView
            vendor={selectedVendor}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Tiering" ? (
          <TieringView
            vendor={selectedVendor}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Quantify" ? (
          <QuantifyView vendor={selectedVendor} scenario={selectedScenario} />
        ) : activeView === "Results" ? (
          <ResultsView vendor={selectedVendor} scenario={selectedScenario} />
        ) : activeView === "Treatments" ? (
          <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} />
        ) : activeView === "Decisions" ? (
          <DecisionsView vendor={selectedVendor} scenario={selectedScenario} />
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} />
        ) : (
          <div className="card">Unknown tab.</div>
        )}
      </div>
    </div>
  );
}
