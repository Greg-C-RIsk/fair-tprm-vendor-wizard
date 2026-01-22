"use client";

import { useEffect, useMemo, useState } from "react";

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

const LS_KEY = "fair_tprm_training_v_ui_v1";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  dependencyLevel: "Medium",

  tier: "",
  tierRationale: "",
  tiering: {
    dataSensitivity: 1,
    integrationDepth: 1,
    accessPrivileges: 1,
    historicalIncidents: 1,
    businessCriticality: 1,
  },

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

  // QuantifyView sait "auto-réparer" si quant est vide
  quant: {},

  treatments: [],
  decision: { status: "", owner: "", approver: "", reviewDate: "", rationale: "" },
});

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  const [state, setState] = useState(() => {
    // SSR-safe: pas de window au build
    return {
      vendors: [emptyVendor()],
      selectedVendorId: "",
      selectedScenarioId: "",
    };
  });

  // Hydrate depuis localStorage côté client
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.vendors)) return;

      const vendors = parsed.vendors.length ? parsed.vendors : [emptyVendor()];
      setState({
        vendors,
        selectedVendorId: parsed.selectedVendorId || vendors[0]?.id || "",
        selectedScenarioId: parsed.selectedScenarioId || "",
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const vendors = state.vendors || [];

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    return vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null;
  }, [vendors, state.selectedVendorId]);

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    const sc = selectedVendor.scenarios || [];
    if (!sc.length) return null;
    return sc.find((s) => s.id === state.selectedScenarioId) || sc[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  // Assure qu'on a toujours une sélection valide
  useEffect(() => {
    if (!vendors.length) {
      const v = emptyVendor();
      setState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: "" });
      return;
    }

    if (!state.selectedVendorId) {
      setState((p) => ({ ...p, selectedVendorId: vendors[0]?.id || "" }));
      return;
    }

    const v = vendors.find((x) => x.id === state.selectedVendorId);
    if (!v) {
      setState((p) => ({ ...p, selectedVendorId: vendors[0]?.id || "", selectedScenarioId: "" }));
      return;
    }

    const sc = v.scenarios || [];
    if (sc.length && !state.selectedScenarioId) {
      setState((p) => ({ ...p, selectedScenarioId: sc[0].id }));
    }

    if (state.selectedScenarioId && sc.length && !sc.find((s) => s.id === state.selectedScenarioId)) {
      setState((p) => ({ ...p, selectedScenarioId: sc[0].id }));
    }
  }, [vendors, state.selectedVendorId, state.selectedScenarioId]);

  // --- Mutations
  const setSelectedVendorId = (id) => {
    setState((p) => ({ ...p, selectedVendorId: id, selectedScenarioId: "" }));
  };

  const setSelectedScenarioId = (id) => {
    setState((p) => ({ ...p, selectedScenarioId: id }));
  };

  const updateVendor = (vendorId, patch) => {
    setState((p) => ({
      ...p,
      vendors: (p.vendors || []).map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
    }));
  };

  const addVendor = () => {
    const v = emptyVendor();
    setState((p) => ({
      ...p,
      vendors: [...(p.vendors || []), v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
    setActiveView("Vendors");
    return v.id;
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (p.vendors || []).filter((v) => v.id !== vendorId);
      const ensured = next.length ? next : [emptyVendor()];
      return {
        ...p,
        vendors: ensured,
        selectedVendorId: ensured[0]?.id || "",
        selectedScenarioId: "",
      };
    });
    setActiveView("Vendors");
  };

  const addScenario = (vendorId) => {
    const s = emptyScenario();
    setState((p) => ({
      ...p,
      vendors: (p.vendors || []).map((v) =>
        v.id === vendorId ? { ...v, scenarios: [...(v.scenarios || []), s] } : v
      ),
      selectedVendorId: vendorId,
      selectedScenarioId: s.id,
    }));
    setActiveView("Quantify");
    return s.id;
  };

  const deleteScenario = (vendorId, scenarioId) => {
    setState((p) => {
      const nextVendors = (p.vendors || []).map((v) => {
        if (v.id !== vendorId) return v;
        const nextSc = (v.scenarios || []).filter((s) => s.id !== scenarioId);
        return { ...v, scenarios: nextSc };
      });

      const v2 = nextVendors.find((v) => v.id === vendorId);
      const nextScenarioId = v2?.scenarios?.[0]?.id || "";

      return { ...p, vendors: nextVendors, selectedScenarioId: nextScenarioId };
    });
  };

  const resetAll = () => {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    const v = emptyVendor();
    setState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: "" });
    setActiveView("Vendors");
  };

  // --- Nav
  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Quantify", label: "Quantify" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

  return (
    <div className="container">
      <div className="header" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 className="h-title">FAIR TPRM Training Tool</h1>
          <p className="h-sub">Training only — data stays in your browser.</p>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{vendors.length} vendor(s)</span>
            <span className="badge">{vendors.reduce((n, v) => n + ((v.scenarios || []).length), 0)} scenario(s)</span>
            <span className="badge">Carry-forward: {vendors.filter((v) => v.carryForward).length}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={resetAll}>Reset</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="tabs" style={{ flex: 1 }}>
          {tabs.map((t) => (
            <button key={t.k} className={`tab ${activeView === t.k ? "active" : ""}`} onClick={() => setActiveView(t.k)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {activeView === "Vendors" ? (
          <VendorsView
            vendors={vendors}
            selectedVendorId={selectedVendor?.id || ""}
            setSelectedVendorId={setSelectedVendorId}
            updateVendor={updateVendor}
            addVendor={addVendor}
            deleteVendor={deleteVendor}
            addScenario={addScenario}
            deleteScenario={deleteScenario}
            setActiveView={setActiveView}
          />
        ) : null}

        {activeView === "Tiering" ? (
          <TieringView
            vendors={vendors}
            selectedVendorId={selectedVendor?.id || ""}
            setSelectedVendorId={setSelectedVendorId}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : null}

        {activeView === "Quantify" ? (
          <QuantifyView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : null}

        {activeView === "Treatments" ? (
          <TreatmentsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : null}

        {activeView === "Decisions" ? (
          <DecisionsView
            vendor={selectedVendor}
            scenario={selectedScenario}
            updateVendor={updateVendor}
            setActiveView={setActiveView}
          />
        ) : null}

        {activeView === "Dashboard" ? (
          <DashboardView
            vendors={vendors}
            setActiveView={setActiveView}
          />
        ) : null}
      </div>
    </div>
  );
}
