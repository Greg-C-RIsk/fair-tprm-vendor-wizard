"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { emptyVendor, normalizeState, safeParse } from "../lib/model";

// ✅ clé LS “stable” (tu peux garder la même)
const LS_KEY = "fair_tprm_training_v6_propre";

// ✅ Lazy-load: évite que les autres views cassent l’app au chargement
const VendorsView = dynamic(() => import("./components/VendorsView"), {
  ssr: false,
  loading: () => <div className="card">Loading Vendors…</div>,
});
const ScenariosView = dynamic(() => import("./components/ScenariosView"), {
  ssr: false,
  loading: () => <div className="card">Loading Scenarios…</div>,
});
const TieringView = dynamic(() => import("./components/TieringView"), {
  ssr: false,
  loading: () => <div className="card">Loading Tiering…</div>,
});
const QuantifyView = dynamic(() => import("./components/QuantifyView"), {
  ssr: false,
  loading: () => <div className="card">Loading Quantify…</div>,
});
const ResultsView = dynamic(() => import("./components/ResultsView"), {
  ssr: false,
  loading: () => <div className="card">Loading Results…</div>,
});
const TreatmentsView = dynamic(() => import("./components/TreatmentsView"), {
  ssr: false,
  loading: () => <div className="card">Loading Treatments…</div>,
});
const DecisionsView = dynamic(() => import("./components/DecisionsView"), {
  ssr: false,
  loading: () => <div className="card">Loading Decisions…</div>,
});
const DashboardView = dynamic(() => import("./components/DashboardView"), {
  ssr: false,
  loading: () => <div className="card">Loading Dashboard…</div>,
});

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
      className="card"
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

  // ----- Load state (safe SSR)
  const [state, setState] = useState(() => {
    const fallback = normalizeState({
      vendors: [emptyVendor()],
      selectedVendorId: "",
      selectedScenarioId: "",
    });

    if (typeof window === "undefined") return fallback;

    const raw = window.localStorage.getItem(LS_KEY);
    const parsed = raw
      ? safeParse(raw, {
          vendors: [emptyVendor()],
          selectedVendorId: "",
          selectedScenarioId: "",
        })
      : {
          vendors: [emptyVendor()],
          selectedVendorId: "",
          selectedScenarioId: "",
        };

    return normalizeState(parsed);
  });

  // ----- Persist (always normalized)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
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

  // ----- Helpers (mutations)
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

  const updateVendor = (vendorId, patch) => {
    setState((p) => {
      const nextVendors = (Array.isArray(p.vendors) ? p.vendors : []).map((v) =>
        v.id === vendorId ? { ...v, ...patch } : v
      );
      return normalizeState({ ...p, vendors: nextVendors });
    });
  };

  const addVendor = (vendor) => {
    setState((p) =>
      normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), vendor],
        selectedVendorId: vendor.id,
        selectedScenarioId: vendor?.scenarios?.[0]?.id || "",
      })
    );
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const kept = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({
        ...p,
        vendors: kept,
        selectedVendorId: "",
        selectedScenarioId: "",
      });
    });
  };

  // ----- Tabs
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
            <Pill>
              {vendors.reduce(
                (n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0),
                0
              )}{" "}
              scenario(s)
            </Pill>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() => {
              if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
              const v = emptyVendor();
              setState(
                normalizeState({
                  vendors: [v],
                  selectedVendorId: v.id,
                  selectedScenarioId: v.scenarios?.[0]?.id || "",
                })
              );
              setActiveView("Vendors");
            }}
          >
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
                  background:
                    activeView === t.k ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
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
            onSelectVendor={(id) => setSelectedVendorId(id)}
            onAddVendor={(v) => addVendor(v)}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onDeleteVendor={(id) => deleteVendor(id)}
            onNext={() => setActiveView("Scenarios")}
          />
        ) : activeView === "Scenarios" ? (
          <ScenariosView
            vendor={selectedVendor}
            selectedScenarioId={selectedScenario?.id || ""}
            onSelectScenario={(id) => setSelectedScenarioId(id)}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onNext={() => setActiveView("Tiering")}
            onBack={() => setActiveView("Vendors")}
          />
        ) : activeView === "Tiering" ? (
          <TieringView
            vendor={selectedVendor}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onNext={() => setActiveView("Quantify")}
            onBack={() => setActiveView("Scenarios")}
          />
        ) : activeView === "Quantify" ? (
          <QuantifyView
            vendor={selectedVendor}
            scenario={selectedScenario}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onNext={() => setActiveView("Results")}
            onBack={() => setActiveView("Tiering")}
          />
        ) : activeView === "Results" ? (
          <ResultsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            onNext={() => setActiveView("Treatments")}
            onBack={() => setActiveView("Quantify")}
          />
        ) : activeView === "Treatments" ? (
          <TreatmentsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onNext={() => setActiveView("Decisions")}
            onBack={() => setActiveView("Results")}
          />
        ) : activeView === "Decisions" ? (
          <DecisionsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            onUpdateVendor={(id, patch) => updateVendor(id, patch)}
            onNext={() => setActiveView("Dashboard")}
            onBack={() => setActiveView("Treatments")}
          />
        ) : activeView === "Dashboard" ? (
          <DashboardView
            vendors={vendors}
            selectedVendor={selectedVendor}
            selectedScenario={selectedScenario}
            onBack={() => setActiveView("Decisions")}
          />
        ) : (
          <Card>Unknown view.</Card>
        )}
      </div>
    </div>
  );
}
