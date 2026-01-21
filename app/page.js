"use client";

import { useEffect, useMemo, useState } from "react";

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import ScenariosView from "./components/ScenariosView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

const LS_KEY = "fair_tprm_training_v4";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  tiering: emptyTiering(),
  carryForward: false,
  scenarios: [],
});

const emptyScenario = () => ({
  id: uid(),
  title: "",
  assetAtRisk: "",
  threatActor: "External cybercriminal",
  attackVector: "",
  lossEvent: "",
  narrative: "",
  // on remplira la quantification à l’étape 2
  quant: {
    sims: 10000,
    tef: { min: "", ml: "", max: "" },
    susc: { min: "", ml: "", max: "" },
    pel: { min: "", ml: "", max: "" },
    stats: null,
    aleSamples: [],
    pelSamples: [],
    lastRunAt: "",
  },
  treatments: [],
  decision: { status: "", owner: "", approver: "", reviewDate: "", rationale: "" },
});

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    }
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      const parsed = JSON.parse(raw);
      if (!parsed?.vendors?.length) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      return parsed;
    } catch {
      return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    }
  });

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const vendors = state.vendors;

  // ensure selection always valid
  useEffect(() => {
    if (!vendors.length) {
      setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
      return;
    }
    if (!state.selectedVendorId) {
      setState((p) => ({ ...p, selectedVendorId: vendors[0].id, selectedScenarioId: "" }));
      return;
    }
  }, [vendors, state.selectedVendorId]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null,
    [vendors, state.selectedVendorId]
  );

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    const sid = state.selectedScenarioId;
    return selectedVendor.scenarios.find((s) => s.id === sid) || selectedVendor.scenarios[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  useEffect(() => {
    if (!selectedVendor) return;
    if (selectedVendor.scenarios.length && !state.selectedScenarioId) {
      setState((p) => ({ ...p, selectedScenarioId: selectedVendor.scenarios[0].id }));
    }
  }, [selectedVendor, state.selectedScenarioId]);

  // ---------- Actions (global) ----------
  const selectVendor = (vendorId) =>
    setState((p) => ({ ...p, selectedVendorId: vendorId, selectedScenarioId: "" }));

  const selectScenario = (scenarioId) =>
    setState((p) => ({ ...p, selectedScenarioId: scenarioId }));

  const addVendor = () => {
    const v = emptyVendor();
    setState((p) => ({
      ...p,
      vendors: [...p.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
    setActiveView("Vendors");
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) => ({
      ...p,
      vendors: p.vendors.map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
    }));
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = p.vendors.filter((v) => v.id !== vendorId);
      const ensured = next.length ? next : [emptyVendor()];
      return {
        ...p,
        vendors: ensured,
        selectedVendorId: ensured[0].id,
        selectedScenarioId: "",
      };
    });
  };

  const addScenario = () => {
    if (!selectedVendor) return;
    const s = emptyScenario();
    setState((p) => ({
      ...p,
      vendors: p.vendors.map((v) =>
        v.id === selectedVendor.id ? { ...v, scenarios: [...v.scenarios, s] } : v
      ),
      selectedScenarioId: s.id,
    }));
    setActiveView("Scenarios");
  };

  const updateScenario = (scenarioId, patch) => {
    if (!selectedVendor) return;
    setState((p) => ({
      ...p,
      vendors: p.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return {
          ...v,
          scenarios: v.scenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch } : s)),
        };
      }),
    }));
  };

  const deleteScenario = (scenarioId) => {
    if (!selectedVendor) return;
    setState((p) => {
      const vendors2 = p.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return { ...v, scenarios: v.scenarios.filter((s) => s.id !== scenarioId) };
      });
      const v2 = vendors2.find((v) => v.id === selectedVendor.id);
      return {
        ...p,
        vendors: vendors2,
        selectedScenarioId: v2?.scenarios?.[0]?.id || "",
      };
    });
  };

  const resetAll = () => {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {}
    setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
    setActiveView("Vendors");
  };

  const stepActions = (
    <>
      <button className="btn" onClick={addVendor}>Add vendor</button>
      <button className="btn" onClick={addScenario} disabled={!selectedVendor}>Add scenario</button>
      <button className="btn" onClick={() => setActiveView("Tiering")} disabled={!selectedVendor}>Tier</button>
      <button className="btn" onClick={() => setActiveView("Quantify")} disabled={!selectedScenario}>Quantify</button>
      <button className="btn" onClick={() => setActiveView("Treatments")} disabled={!selectedScenario}>Treat</button>
      <button className="btn primary" onClick={() => setActiveView("Decisions")} disabled={!selectedScenario}>Decide</button>
    </>
  );

  const nav = ["Vendors","Tiering","Scenarios","Quantify","Treatments","Decisions","Dashboard"];

  return (
    <div className="container">
      <div className="header" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="h-title">FAIR TPRM Training Tool</h1>
          <p className="h-sub">Training only — data stays in your browser.</p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{vendors.length} vendor(s)</span>
            <span className="badge">{vendors.reduce((n, v) => n + v.scenarios.length, 0)} scenario(s)</span>
            <span className="badge">Carry-forward: {vendors.filter((v) => v.carryForward).length}</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={resetAll}>Reset</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <div className="tabs" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", flex: 1 }}>
          {nav.map((v) => (
            <button key={v} className={`tab ${activeView === v ? "active" : ""}`} onClick={() => setActiveView(v)}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{stepActions}</div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {/* LEFT: workspace selector */}
        <div className="col6">
          <div className="card card-pad">
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Workspace</div>

            <div className="label">Select vendor</div>
            <select className="input" value={selectedVendor?.id || ""} onChange={(e) => selectVendor(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name || "(Unnamed vendor)"}</option>
              ))}
            </select>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge">Tier index: {selectedVendor ? (
                selectedVendor.tiering.dataSensitivity *
                selectedVendor.tiering.integrationDepth *
                selectedVendor.tiering.accessPrivileges *
                selectedVendor.tiering.historicalIncidents *
                selectedVendor.tiering.businessCriticality
              ) : 0}</span>
              <span className="badge">{selectedVendor?.carryForward ? "Carry-forward: Yes" : "Carry-forward: No"}</span>
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Scenarios</div>
              <button className="btn" onClick={addScenario} disabled={!selectedVendor}>Add scenario</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="label">Select scenario</div>
              <select
                className="input"
                value={selectedScenario?.id || ""}
                onChange={(e) => selectScenario(e.target.value)}
                disabled={!selectedVendor || !selectedVendor.scenarios.length}
              >
                {(selectedVendor?.scenarios || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.title || "(Untitled scenario)"}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT: active view */}
        <div className="col6">
          {activeView === "Vendors" && (
            <VendorsView
              vendors={vendors}
              selectedVendor={selectedVendor}
              addVendor={addVendor}
              updateVendor={updateVendor}
              deleteVendor={deleteVendor}
            />
          )}

          {activeView === "Tiering" && (
            <TieringView
              vendors={vendors}
              updateVendor={updateVendor}
            />
          )}

          {activeView === "Scenarios" && (
            <ScenariosView
              selectedVendor={selectedVendor}
              selectedScenario={selectedScenario}
              addScenario={addScenario}
              updateScenario={updateScenario}
              deleteScenario={deleteScenario}
            />
          )}

          {activeView === "Quantify" && (
            <QuantifyView
              selectedScenario={selectedScenario}
              updateScenario={updateScenario}
            />
          )}

          {activeView === "Treatments" && (
            <TreatmentsView
              selectedScenario={selectedScenario}
              updateScenario={updateScenario}
            />
          )}

          {activeView === "Decisions" && (
            <DecisionsView
              selectedScenario={selectedScenario}
              updateScenario={updateScenario}
            />
          )}

          {activeView === "Dashboard" && (
            <DashboardView vendors={vendors} />
          )}
        </div>
      </div>
    </div>
  );
}
