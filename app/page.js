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

const LS_KEY = "fair_tprm_training_v7";

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    // IMPORTANT: éviter crash prerender/build
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

  // ---- Actions (centralisées ici)
  const setSelectedVendorId = (vendorId) => {
    setState((p) => {
      const next = normalizeState(p);
      const v = next.vendors.find((x) => x.id === vendorId) || next.vendors[0] || null;
      return normalizeState({
        ...next,
        selectedVendorId: vendorId,
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      });
    });
  };

  const setSelectedScenarioId = (scenarioId) => {
    setState((p) => normalizeState({ ...p, selectedScenarioId: scenarioId }));
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) => {
      const nextVendors = (Array.isArray(p.vendors) ? p.vendors : []).map((v) =>
        v.id === vendorId ? { ...v, ...patch } : v
      );
      return normalizeState({ ...p, vendors: nextVendors });
    });
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
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...p, vendors: next, selectedVendorId: "", selectedScenarioId: "" });
    });
    setActiveView("Vendors");
  };

  const addScenario = (vendorId) => {
    setState((p) => {
      const next = normalizeState(p);
      const nextVendors = next.vendors.map((v) => {
        if (v.id !== vendorId) return v;
        const scenarios = Array.isArray(v.scenarios) ? v.scenarios : [];
        const s = emptyScenario();
        return { ...v, scenarios: [...scenarios, s] };
      });

      const v = nextVendors.find((x) => x.id === vendorId) || null;
      const last = v?.scenarios?.[v.scenarios.length - 1] || null;

      return normalizeState({
        ...next,
        vendors: nextVendors,
        selectedVendorId: vendorId,
        selectedScenarioId: last?.id || next.selectedScenarioId,
      });
    });
  };

  // ---- UI header
  const totalScenarios = vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0);

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill">{vendors.length} vendor(s)</span>
            <span className="pill">{totalScenarios} scenario(s)</span>
            <span className="pill">Carry-forward: {vendors.filter((v) => !!v.carryForward).length}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() => {
              try {
                if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
              } catch {}
              const v = emptyVendor();
              setState(normalizeState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" }));
              setActiveView("Vendors");
            }}
          >
            Reset
          </button>
        </div>
      </div>

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

      <div style={{ marginTop: 14 }}>
        {activeView === "Vendors" ? (
          <VendorsView
            vendors={vendors}
            selectedVendorId={selectedVendor?.id || ""}
            onSelectVendor={setSelectedVendorId}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Scenarios" ? (
          <ScenariosView
            vendor={selectedVendor}
            selectedScenarioId={selectedScenario?.id || ""}
            onSelectScenario={setSelectedScenarioId}
            onAddScenario={() => selectedVendor && addScenario(selectedVendor.id)}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : activeView === "Tiering" ? (
          <TieringView vendor={selectedVendor} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Quantify" ? (
          <QuantifyView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Results" ? (
          <ResultsView vendor={selectedVendor} scenario={selectedScenario} setActiveView={setActiveView} />
        ) : activeView === "Treatments" ? (
          <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Decisions" ? (
          <DecisionsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
        ) : activeView === "Dashboard" ? (
          <DashboardView vendors={vendors} setActiveView={setActiveView} />
        ) : (
          <div className="card">Unknown tab.</div>
        )}
      </div>
    </div>
  );
}
