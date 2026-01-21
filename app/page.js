"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ------------------------------
// Semi-guided FAIR TPRM Training Tool (in-memory + localStorage)
// - Multi-vendor, multi-scenario
// - FAIR-ish workflow: Context -> Scenarios -> Quantify -> Treatments -> Decisions -> Portfolio -> Exports
// - Training-only: no login, no database
// ------------------------------

const LS_KEY = "fair_tprm_training_v2";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const money = (n) => {
  if (n === "" || n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
};

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
  scenarios: [],
});

const emptyScenario = () => ({
  id: uid(),
  title: "",
  assetAtRisk: "",
  threatActor: "External cybercriminal",
  threatEvent: "",
  lossEvent: "",
  primaryLossTypes: "",
  secondaryLossTypes: "",
  narrative: "",
  // Quantification (entered by learner)
  assumptions: "",
  tefLow: "",
  tefHigh: "",
  suscLow: "",
  suscHigh: "",
  lmPrimary: "",
  lmSecondary: "",
  eal: "",
  p90: "",
  p95: "",
  drivers: "",
  // Treatments
  treatments: [],
  // Decision
  decision: {
    status: "",
    owner: "",
    approver: "",
    reviewDate: "",
    rationale: "",
  },
});

const emptyTreatment = () => ({
  id: uid(),
  type: "Reduce susceptibility",
  control: "",
  annualCost: "",
  annualRiskReduction: "",
  residualEal: "",
});

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4 }} className="h-sub">{subtitle}</div> : null}
    </div>
  );
}

function Pill({ children }) {
  return <span className="badge">{children}</span>;
}

function Select({ value, onChange, options }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function QualityBanner({ items }) {
  if (!items.length) return null;
  return (
    <div className="hint" style={{ borderColor: "rgba(110,231,255,0.25)" }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>Quality checks</div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function MiniBars({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <Pill>Portfolio</Pill>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "220px 1fr 120px", gap: 10, alignItems: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>
              {r.label}
            </div>
            <div style={{ height: 10, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((r.value / max) * 100)}%`,
                  background: "linear-gradient(90deg, rgba(110,231,255,0.55), rgba(167,139,250,0.55))",
                }}
              />
            </div>
            <div style={{ textAlign: "right", fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{money(r.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");
  const [state, setState] = useState(() => {
    // Load from localStorage for training continuity
    if (typeof window === "undefined") return { vendors: [], selectedVendorId: "", selectedScenarioId: "" };
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      const parsed = JSON.parse(raw);
      // Light defensive defaults
      if (!parsed?.vendors?.length) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      return parsed;
    } catch {
      return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const vendors = state.vendors;
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null,
    [vendors, state.selectedVendorId]
  );

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return selectedVendor.scenarios.find((s) => s.id === state.selectedScenarioId) || selectedVendor.scenarios[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  // Ensure selection is always valid
  useEffect(() => {
    if (!vendors.length) {
      setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
      return;
    }
    if (!state.selectedVendorId && vendors[0]?.id) {
      setState((prev) => ({ ...prev, selectedVendorId: vendors[0].id }));
      return;
    }
    if (selectedVendor && selectedVendor.scenarios.length && !state.selectedScenarioId) {
      setState((prev) => ({ ...prev, selectedScenarioId: selectedVendor.scenarios[0].id }));
    }
  }, [vendors, state.selectedVendorId, state.selectedScenarioId, selectedVendor]);

  const setVendor = (vendorId, patch) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
    }));
  };

  const addVendor = () => {
    const v = emptyVendor();
    setState((prev) => ({
      ...prev,
      vendors: [...prev.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
  };

  const deleteVendor = (vendorId) => {
    setState((prev) => {
      const nextVendors = prev.vendors.filter((v) => v.id !== vendorId);
      const nextSelected = nextVendors[0]?.id || "";
      return {
        ...prev,
        vendors: nextVendors.length ? nextVendors : [emptyVendor()],
        selectedVendorId: nextSelected,
        selectedScenarioId: "",
      };
    });
  };

  const addScenario = () => {
    if (!selectedVendor) return;
    const s = emptyScenario();
    s.title = "";
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) =>
        v.id === selectedVendor.id ? { ...v, scenarios: [...v.scenarios, s] } : v
      ),
      selectedScenarioId: s.id,
    }));
  };

  const deleteScenario = (scenarioId) => {
    if (!selectedVendor) return;
    setState((prev) => {
      const nextVendors = prev.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return { ...v, scenarios: v.scenarios.filter((s) => s.id !== scenarioId) };
      });
      const v2 = nextVendors.find((v) => v.id === selectedVendor.id);
      const nextScenarioId = v2?.scenarios[0]?.id || "";
      return { ...prev, vendors: nextVendors, selectedScenarioId: nextScenarioId };
    });
  };

  const setScenario = (scenarioId, patch) => {
    if (!selectedVendor) return;
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return {
          ...v,
          scenarios: v.scenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch } : s)),
        };
      }),
    }));
  };

  const addTreatment = () => {
    if (!selectedScenario) return;
    const t = emptyTreatment();
    setScenario(selectedScenario.id, { treatments: [...selectedScenario.treatments, t] });
  };

  const updateTreatment = (treatmentId, patch) => {
    if (!selectedScenario) return;
    setScenario(selectedScenario.id, {
      treatments: selectedScenario.treatments.map((t) => (t.id === treatmentId ? { ...t, ...patch } : t)),
    });
  };

  const deleteTreatment = (treatmentId) => {
    if (!selectedScenario) return;
    setScenario(selectedScenario.id, { treatments: selectedScenario.treatments.filter((t) => t.id !== treatmentId) });
  };

  const resetTrainingData = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
    setActiveView("Vendors");
  };

  // ------------------------------
  // Semi-guided helpers
  // ------------------------------

  const vendorQuality = useMemo(() => {
    if (!selectedVendor) return [];
    const issues = [];
    if (!selectedVendor.name.trim()) issues.push("Vendor name is missing.");
    if (!selectedVendor.criticalFunction.trim()) issues.push("Critical business function is missing.");
    if (!selectedVendor.dataTypes.trim()) issues.push("Data types are missing.");
    return issues;
  }, [selectedVendor]);

  const scenarioQuality = useMemo(() => {
    if (!selectedScenario) return [];
    const issues = [];
    if (!selectedScenario.assetAtRisk.trim()) issues.push("Asset at risk is missing.");
    if (!selectedScenario.lossEvent.trim()) issues.push("Loss event is missing.");
    if (!selectedScenario.threatEvent.trim()) issues.push("Threat event is missing.");
    if (!selectedScenario.primaryLossTypes.trim()) issues.push("Primary loss types are missing.");
    if (!selectedScenario.title.trim()) issues.push("Scenario title is missing.");
    // Semi-guided: warn about generic title
    if (selectedScenario.title.trim() && selectedScenario.title.trim().length < 8) {
      issues.push("Scenario title looks too short. Make it specific.");
    }
    return issues;
  }, [selectedScenario]);

  const quantQuality = useMemo(() => {
    if (!selectedScenario) return [];
    const issues = [];
    const anyInput =
      selectedScenario.tefLow || selectedScenario.tefHigh || selectedScenario.suscLow || selectedScenario.suscHigh || selectedScenario.lmPrimary || selectedScenario.lmSecondary;
    if (!anyInput) issues.push("No input ranges captured yet (TEF, susceptibility, loss magnitude). ");
    if (!selectedScenario.assumptions.trim()) issues.push("Key assumptions are missing.");
    const anyOutput = selectedScenario.eal || selectedScenario.p90 || selectedScenario.p95;
    if (!anyOutput) issues.push("No outputs captured yet (EAL, P90, P95). ");
    if (!selectedScenario.drivers.trim()) issues.push("Key risk drivers are missing.");
    return issues;
  }, [selectedScenario]);

  const treatmentQuality = useMemo(() => {
    if (!selectedScenario) return [];
    const issues = [];
    if (!selectedScenario.treatments.length) issues.push("No treatment options captured yet.");
    const weak = selectedScenario.treatments.filter((t) => !t.control.trim() || !t.annualCost || !t.annualRiskReduction);
    if (weak.length) issues.push("Some treatments are missing control, cost, or risk reduction.");
    return issues;
  }, [selectedScenario]);

  const decisionQuality = useMemo(() => {
    if (!selectedScenario) return [];
    const issues = [];
    const d = selectedScenario.decision;
    if (!d.status) issues.push("Decision status is missing.");
    if (!d.owner.trim()) issues.push("Decision owner is missing.");
    if (!d.reviewDate.trim()) issues.push("Review date is missing.");
    if (!d.rationale.trim()) issues.push("Decision rationale is missing.");
    return issues;
  }, [selectedScenario]);

  // Simple tiering (training-only). Not FAIR. This is intake prioritization.
  const computeTier = (v) => {
    let score = 0;
    const dep = v.dependencyLevel;
    if (dep === "High") score += 3;
    if (dep === "Medium") score += 2;
    if (dep === "Low") score += 1;
    const data = (v.dataTypes || "").toLowerCase();
    if (data.includes("pii") || data.includes("personal")) score += 3;
    if (data.includes("payment") || data.includes("card")) score += 3;
    if (data.includes("health") || data.includes("phi")) score += 3;
    const fn = (v.criticalFunction || "").toLowerCase();
    if (fn.includes("revenue") || fn.includes("sales") || fn.includes("payments")) score += 2;
    if (fn.includes("production") || fn.includes("operations")) score += 2;

    if (score >= 7) return { tier: "High", rationale: "High dependency and/or sensitive data/business impact." };
    if (score >= 4) return { tier: "Medium", rationale: "Meaningful dependency with moderate sensitivity/impact." };
    return { tier: "Low", rationale: "Limited dependency and lower sensitivity/impact." };
  };

  // ------------------------------
  // Portfolio aggregates
  // ------------------------------

  const portfolio = useMemo(() => {
    const rows = [];
    for (const v of vendors) {
      const vendorEal = v.scenarios.reduce((sum, s) => sum + (Number(s.eal) || 0), 0);
      rows.push({ vendorId: v.id, vendorName: v.name || "(Unnamed vendor)", eal: vendorEal });
    }
    rows.sort((a, b) => b.eal - a.eal);
    const totalEal = rows.reduce((sum, r) => sum + r.eal, 0);
    const topScenarios = [];
    for (const v of vendors) {
      for (const s of v.scenarios) {
        const val = Number(s.eal) || 0;
        topScenarios.push({
          label: `${v.name || "(Vendor)"} · ${s.title || "(Scenario)"}`,
          value: val,
        });
      }
    }
    topScenarios.sort((a, b) => b.value - a.value);
    return {
      totalEal,
      topVendors: rows.slice(0, 8),
      topScenarios: topScenarios.slice(0, 8),
    };
  }, [vendors]);

  // ------------------------------
  // Exports
  // ------------------------------

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const vendorRows = vendors.map((v) => ({
      VendorID: v.id,
      VendorName: v.name,
      Category: v.category,
      BusinessOwner: v.businessOwner,
      CriticalFunction: v.criticalFunction,
      DataTypes: v.dataTypes,
      Geography: v.geography,
      DependencyLevel: v.dependencyLevel,
      Tier: v.tier,
      TierRationale: v.tierRationale,
    }));

    const scenarioRows = vendors.flatMap((v) =>
      v.scenarios.map((s) => ({
        VendorName: v.name,
        ScenarioID: s.id,
        Title: s.title,
        AssetAtRisk: s.assetAtRisk,
        ThreatActor: s.threatActor,
        ThreatEvent: s.threatEvent,
        LossEvent: s.lossEvent,
        PrimaryLossTypes: s.primaryLossTypes,
        SecondaryLossTypes: s.secondaryLossTypes,
        Narrative: s.narrative,
      }))
    );

    const inputRows = vendors.flatMap((v) =>
      v.scenarios.map((s) => ({
        VendorName: v.name,
        ScenarioID: s.id,
        TEF_Low: s.tefLow,
        TEF_High: s.tefHigh,
        Susc_Low: s.suscLow,
        Susc_High: s.suscHigh,
        LM_Primary: s.lmPrimary,
        LM_Secondary: s.lmSecondary,
        Assumptions: s.assumptions,
      }))
    );

    const resultRows = vendors.flatMap((v) =>
      v.scenarios.map((s) => ({
        VendorName: v.name,
        ScenarioID: s.id,
        EAL: s.eal,
        P90: s.p90,
        P95: s.p95,
        Drivers: s.drivers,
      }))
    );

    const treatmentRows = vendors.flatMap((v) =>
      v.scenarios.flatMap((s) =>
        (s.treatments || []).map((t) => ({
          VendorName: v.name,
          ScenarioID: s.id,
          ScenarioTitle: s.title,
          TreatmentType: t.type,
          Control: t.control,
          AnnualCost: t.annualCost,
          AnnualRiskReduction: t.annualRiskReduction,
          ResidualEAL: t.residualEal,
        }))
      )
    );

    const decisionRows = vendors.flatMap((v) =>
      v.scenarios.map((s) => ({
        VendorName: v.name,
        ScenarioID: s.id,
        ScenarioTitle: s.title,
        Decision: s.decision?.status,
        Owner: s.decision?.owner,
        Approver: s.decision?.approver,
        ReviewDate: s.decision?.reviewDate,
        Rationale: s.decision?.rationale,
      }))
    );

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorRows), "Vendors");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenarioRows), "Scenarios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inputRows), "FAIR Inputs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultRows), "FAIR Results");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treatmentRows), "Treatments");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(decisionRows), "Decisions");

    XLSX.writeFile(wb, `FAIR_TPRM_Training_Export.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.setFontSize(18);
    doc.text("FAIR-Based TPRM Training Report", 40, 50);

    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(`Portfolio EAL (sum of scenarios): ${money(portfolio.totalEal)}`, 40, 70);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 90,
      head: [["Top vendors (by EAL)", "EAL"]],
      body: portfolio.topVendors.map((r) => [r.vendorName, money(r.eal)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [["Top scenarios (by EAL)", "EAL"]],
      body: portfolio.topScenarios.map((r) => [r.label, money(r.value)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    // Vendor-by-vendor details
    for (const v of vendors) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text(`Vendor: ${v.name || "(Unnamed)"}`, 40, 50);

      autoTable(doc, {
        startY: 70,
        head: [["Field", "Value"]],
        body: [
          ["Category", v.category],
          ["Business owner", v.businessOwner],
          ["Critical function", v.criticalFunction],
          ["Data types", v.dataTypes],
          ["Geography", v.geography],
          ["Dependency", v.dependencyLevel],
          ["Tier", v.tier],
          ["Tier rationale", v.tierRationale],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 41, 59] },
        margin: { left: 40, right: 40 },
      });

      const scenarioSummary = v.scenarios.map((s) => [
        s.title || "(Scenario)",
        money(Number(s.eal) || 0),
        money(Number(s.p90) || 0),
        (s.drivers || "").slice(0, 60),
        s.decision?.status || "",
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 18,
        head: [["Scenario", "EAL", "P90", "Top drivers", "Decision"]],
        body: scenarioSummary.length ? scenarioSummary : [["No scenarios", "", "", "", ""]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 41, 59] },
        margin: { left: 40, right: 40 },
      });
    }

    doc.save("FAIR_TPRM_Training_Report.pdf");
  };

  // ------------------------------
  // UI
  // ------------------------------

  const nav = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Scenarios", label: "Scenarios" },
    { k: "Quantify", label: "Quantify" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Portfolio", label: "Portfolio" },
    { k: "Reports", label: "Reports" },
  ];

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h-title">FAIR TPRM Training Tool</h1>
          <p className="h-sub">
            Semi-guided workflow for third-party risk governance using FAIR concepts. Training only, data stays in your browser.
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{vendors.length} vendor(s)</Pill>
            <Pill>{vendors.reduce((n, v) => n + v.scenarios.length, 0)} scenario(s)</Pill>
            <Pill>Portfolio EAL: {money(portfolio.totalEal)}</Pill>
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn primary" onClick={exportPDF}>Export PDF</button>
          <button className="btn" onClick={resetTrainingData}>Reset training data</button>
        </div>
      </div>

      <div className="tabs" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
        {nav.map((t) => (
          <button
            key={t.k}
            className={`tab ${activeView === t.k ? "active" : ""}`}
            onClick={() => setActiveView(t.k)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {/* Left: Vendor + Scenario selectors */}
        <div className="col6">
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Workspace</div>
              <button className="btn" onClick={addVendor}>Add vendor</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Select vendor</div>
              <select
                className="input"
                value={selectedVendor?.id || ""}
                onChange={(e) => setState((prev) => ({ ...prev, selectedVendorId: e.target.value, selectedScenarioId: "" }))}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name ? v.name : "(Unnamed vendor)"}
                  </option>
                ))}
              </select>

              {selectedVendor ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>{selectedVendor.category}</Pill>
                  <Pill>Dependency: {selectedVendor.dependencyLevel}</Pill>
                  <Pill>Tier: {selectedVendor.tier || "Not set"}</Pill>
                  <button
                    className="btn"
                    onClick={() => deleteVendor(selectedVendor.id)}
                    style={{ marginLeft: "auto" }}
                  >
                    Delete vendor
                  </button>
                </div>
              ) : null}

              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Scenarios</div>
                <button className="btn" onClick={addScenario} disabled={!selectedVendor}>Add scenario</button>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Select scenario</div>
                <select
                  className="input"
                  value={selectedScenario?.id || ""}
                  onChange={(e) => setState((prev) => ({ ...prev, selectedScenarioId: e.target.value }))}
                  disabled={!selectedVendor || !selectedVendor.scenarios.length}
                >
                  {(selectedVendor?.scenarios || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title ? s.title : "(Untitled scenario)"}
                    </option>
                  ))}
                </select>

                {selectedScenario ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>EAL: {money(Number(selectedScenario.eal) || 0)}</Pill>
                    <Pill>P90: {money(Number(selectedScenario.p90) || 0)}</Pill>
                    <button
                      className="btn"
                      onClick={() => deleteScenario(selectedScenario.id)}
                      style={{ marginLeft: "auto" }}
                    >
                      Delete scenario
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Semi-guided quality hints */}
          {activeView === "Vendors" ? <QualityBanner items={vendorQuality} /> : null}
          {activeView === "Scenarios" ? <QualityBanner items={scenarioQuality} /> : null}
          {activeView === "Quantify" ? <QualityBanner items={quantQuality} /> : null}
          {activeView === "Treatments" ? <QualityBanner items={treatmentQuality} /> : null}
          {activeView === "Decisions" ? <QualityBanner items={decisionQuality} /> : null}
        </div>

        {/* Right: Active view */}
        <div className="col6">
          {activeView === "Vendors" && selectedVendor ? (
            <div className="card card-pad">
              <SectionTitle
                title="Vendor intake and context"
                subtitle="Capture business context first. This is TPRM intake, not FAIR quantification."
              />

              <div className="grid">
                <div className="col6">
                  <div className="label">Vendor name</div>
                  <input className="input" value={selectedVendor.name} onChange={(e) => setVendor(selectedVendor.id, { name: e.target.value })} />
                </div>
                <div className="col6">
                  <div className="label">Category</div>
                  <Select
                    value={selectedVendor.category}
                    onChange={(val) => setVendor(selectedVendor.id, { category: val })}
                    options={["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"]}
                  />
                </div>

                <div className="col6">
                  <div className="label">Business owner</div>
                  <input className="input" value={selectedVendor.businessOwner} onChange={(e) => setVendor(selectedVendor.id, { businessOwner: e.target.value })} />
                </div>
                <div className="col6">
                  <div className="label">Geography</div>
                  <Select value={selectedVendor.geography} onChange={(val) => setVendor(selectedVendor.id, { geography: val })} options={["EU", "US", "UK", "Global", "Other"]} />
                </div>

                <div className="col12">
                  <div className="label">Critical business function supported</div>
                  <input className="input" value={selectedVendor.criticalFunction} onChange={(e) => setVendor(selectedVendor.id, { criticalFunction: e.target.value })} placeholder="Example: Customer acquisition and retention" />
                </div>

                <div className="col12">
                  <div className="label">Data types accessed or processed</div>
                  <textarea className="textarea" value={selectedVendor.dataTypes} onChange={(e) => setVendor(selectedVendor.id, { dataTypes: e.target.value })} placeholder="Example: Customer PII, order history, support tickets" />
                </div>

                <div className="col6">
                  <div className="label">Dependency level</div>
                  <Select value={selectedVendor.dependencyLevel} onChange={(val) => setVendor(selectedVendor.id, { dependencyLevel: val })} options={["High", "Medium", "Low"]} />
                </div>
                <div className="col6" style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      const out = computeTier(selectedVendor);
                      setVendor(selectedVendor.id, { tier: out.tier, tierRationale: out.rationale });
                      setActiveView("Tiering");
                    }}
                  >
                    Compute tier
                  </button>
                </div>
              </div>

              <div className="hint">Semi-guided rule: if you cannot explain why this vendor matters, do not quantify yet.</div>
            </div>
          ) : null}

          {activeView === "Tiering" && selectedVendor ? (
            <div className="card card-pad">
              <SectionTitle
                title="Tiering and prioritization"
                subtitle="Tiering helps you decide where FAIR analysis is worth the effort. It is not a FAIR output."
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Pill>Vendor: {selectedVendor.name || "(Unnamed)"}</Pill>
                <Pill>Tier: {selectedVendor.tier || "Not set"}</Pill>
              </div>

              <div style={{ marginTop: 12 }} className="hint">
                <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Decision question</div>
                <div style={{ marginTop: 6 }}>
                  Should we quantify this vendor with FAIR now, based on material exposure and decision urgency?
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="label">Tier rationale</div>
                see how the tool computed it, then rewrite it in your own words.
              </div>

              <textarea
                className="textarea"
                value={selectedVendor.tierRationale}
                onChange={(e) => setVendor(selectedVendor.id, { tierRationale: e.target.value })}
                placeholder="Write a short rationale that a business leader would accept."
              />

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setActiveView("Scenarios")}>Go to scenarios</button>
                <button className="btn primary" onClick={() => setActiveView("Quantify")}>Go to quantification</button>
              </div>
            </div>
          ) : null}

          {activeView === "Scenarios" && selectedScenario ? (
            <div className="card card-pad">
              <SectionTitle
                title="Scenario definition"
                subtitle="A good scenario is specific, testable, and defensible. Avoid generic risk statements."
              />

              <div className="grid">
                <div className="col12">
                  <div className="label">Scenario title</div>
                  <input className="input" value={selectedScenario.title} onChange={(e) => setScenario(selectedScenario.id, { title: e.target.value })} placeholder="Example: CRM vendor credential compromise leading to PII exfiltration" />
                </div>
                <div className="col6">
                  <div className="label">Asset at risk</div>
                  <input className="input" value={selectedScenario.assetAtRisk} onChange={(e) => setScenario(selectedScenario.id, { assetAtRisk: e.target.value })} placeholder="Example: Customer PII in CRM" />
                </div>
                <div className="col6">
                  <div className="label">Threat actor</div>
                  <input className="input" value={selectedScenario.threatActor} onChange={(e) => setScenario(selectedScenario.id, { threatActor: e.target.value })} />
                </div>
                <div className="col6">
                  <div className="label">Threat event</div>
                  <input className="input" value={selectedScenario.threatEvent} onChange={(e) => setScenario(selectedScenario.id, { threatEvent: e.target.value })} placeholder="Example: Credential compromise" />
                </div>
                <div className="col6">
                  <div className="label">Loss event</div>
                  <input className="input" value={selectedScenario.lossEvent} onChange={(e) => setScenario(selectedScenario.id, { lossEvent: e.target.value })} placeholder="Example: Unauthorized data exfiltration" />
                </div>
                <div className="col6">
                  <div className="label">Primary loss types</div>
                  <input className="input" value={selectedScenario.primaryLossTypes} onChange={(e) => setScenario(selectedScenario.id, { primaryLossTypes: e.target.value })} placeholder="Response, replacement, productivity, fines" />
                </div>
                <div className="col6">
                  <div className="label">Secondary loss types</div>
                  <input className="input" value={selectedScenario.secondaryLossTypes} onChange={(e) => setScenario(selectedScenario.id, { secondaryLossTypes: e.target.value })} placeholder="Regulatory, legal, reputation" />
                </div>
                <div className="col12">
                  <div className="label">Narrative (2 to 4 sentences)</div>
                  <textarea className="textarea" value={selectedScenario.narrative} onChange={(e) => setScenario(selectedScenario.id, { narrative: e.target.value })} placeholder="Describe what happens, who is affected, and why it matters." />
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setActiveView("Quantify")}>Go to quantification</button>
              </div>

              <div className="hint">Semi-guided rule: if the scenario could apply to any vendor, it is too generic.</div>
            </div>
          ) : null}

          {activeView === "Quantify" && selectedScenario ? (
            <div className="card card-pad">
              <SectionTitle
                title="FAIR quantification"
                subtitle="Capture input ranges, assumptions, and the key outputs you will use to make decisions."
              />

              <div className="grid">
                <div className="col12">
                  <div className="label">Key assumptions</div>
                  <textarea className="textarea" value={selectedScenario.assumptions} onChange={(e) => setScenario(selectedScenario.id, { assumptions: e.target.value })} placeholder="Example: weekly log review, detection 7 to 14 days, notification SLA 72h." />
                </div>

                <div className="col6">
                  <div className="label">Threat event frequency low (per year)</div>
                  <input className="input" value={selectedScenario.tefLow} onChange={(e) => setScenario(selectedScenario.id, { tefLow: e.target.value })} placeholder="Example: 1" />
                </div>
                <div className="col6">
                  <div className="label">Threat event frequency high (per year)</div>
                  <input className="input" value={selectedScenario.tefHigh} onChange={(e) => setScenario(selectedScenario.id, { tefHigh: e.target.value })} placeholder="Example: 6" />
                </div>

                <div className="col6">
                  <div className="label">Susceptibility low (%)</div>
                  <input className="input" value={selectedScenario.suscLow} onChange={(e) => setScenario(selectedScenario.id, { suscLow: e.target.value })} placeholder="Example: 5" />
                </div>
                <div className="col6">
                  <div className="label">Susceptibility high (%)</div>
                  <input className="input" value={selectedScenario.suscHigh} onChange={(e) => setScenario(selectedScenario.id, { suscHigh: e.target.value })} placeholder="Example: 25" />
                </div>

                <div className="col6">
                  <div className="label">Loss magnitude primary (typical €)</div>
                  <input className="input" value={selectedScenario.lmPrimary} onChange={(e) => setScenario(selectedScenario.id, { lmPrimary: e.target.value })} placeholder="Example: 250000" />
                </div>
                <div className="col6">
                  <div className="label">Loss magnitude secondary (typical €)</div>
                  <input className="input" value={selectedScenario.lmSecondary} onChange={(e) => setScenario(selectedScenario.id, { lmSecondary: e.target.value })} placeholder="Example: 500000" />
                </div>

                <div className="col6">
                  <div className="label">Expected annual loss (EAL €)</div>
                  <input className="input" value={selectedScenario.eal} onChange={(e) => setScenario(selectedScenario.id, { eal: e.target.value })} placeholder="Example: 420000" />
                </div>
                <div className="col6">
                  <div className="label">90th percentile (P90 €)</div>
                  <input className="input" value={selectedScenario.p90} onChange={(e) => setScenario(selectedScenario.id, { p90: e.target.value })} placeholder="Example: 1600000" />
                </div>
                <div className="col6">
                  <div className="label">95th percentile (P95 €)</div>
                  <input className="input" value={selectedScenario.p95} onChange={(e) => setScenario(selectedScenario.id, { p95: e.target.value })} placeholder="Example: 2400000" />
                </div>

                <div className="col12">
                  <div className="label">Key risk drivers (plain language)</div>
                  <textarea className="textarea" value={selectedScenario.drivers} onChange={(e) => setScenario(selectedScenario.id, { drivers: e.target.value })} placeholder="Example: weak privileged access controls, slow detection, high data volume, regulatory exposure." />
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setActiveView("Treatments")}>Go to treatments</button>
              </div>

              <div className="hint">Semi-guided rule: outputs must be explainable via the drivers, not just numbers.</div>
            </div>
          ) : null}

          {activeView === "Treatments" && selectedScenario ? (
            <div className="card card-pad">
              <SectionTitle
                title="Treatment options"
                subtitle="Translate controls into annual cost and annual risk reduction. Focus on the few options that move the needle."
              />

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Pill>Scenario: {selectedScenario.title || "(Untitled)"}</Pill>
                  <Pill>Baseline EAL: {money(Number(selectedScenario.eal) || 0)}</Pill>
                </div>
                <button className="btn" onClick={addTreatment}>Add treatment</button>
              </div>

              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Control</th>
                      <th>Annual cost (€)</th>
                      <th>Annual risk reduction (€)</th>
                      <th>Residual EAL (€)</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScenario.treatments.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: "rgba(255,255,255,0.65)" }}>No treatments captured yet.</td>
                      </tr>
                    ) : null}

                    {selectedScenario.treatments.map((t) => {
                      const cost = Number(t.annualCost) || 0;
                      const rr = Number(t.annualRiskReduction) || 0;
                      const roi = cost > 0 ? (rr / cost).toFixed(1) : "";
                      return (
                        <tr key={t.id}>
                          <td style={{ minWidth: 160 }}>
                            <Select
                              value={t.type}
                              onChange={(val) => updateTreatment(t.id, { type: val })}
                              options={["Reduce TEF", "Reduce susceptibility", "Reduce loss magnitude", "Transfer", "Avoid"]}
                            />
                          </td>
                          <td style={{ minWidth: 280 }}>
                            <input className="input" value={t.control} onChange={(e) => updateTreatment(t.id, { control: e.target.value })} placeholder="Example: Enforce MFA for vendor admins" />
                            {roi ? <div style={{ marginTop: 6, color: "rgba(255,255,255,0.70)", fontSize: 12 }}>ROI (simple): {roi}x</div> : null}
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <input className="input" value={t.annualCost} onChange={(e) => updateTreatment(t.id, { annualCost: e.target.value })} placeholder="40000" />                          </td>
                          <td style={{ minWidth: 180 }}>
                            <input
                              className="input"
                              value={t.annualRiskReduction}
                              onChange={(e) =>
                                updateTreatment(t.id, { annualRiskReduction: e.target.value })
                              }
                              placeholder="150000"
                            />
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <input
                              className="input"
                              value={t.residualEal}
                              onChange={(e) =>
                                updateTreatment(t.id, { residualEal: e.target.value })
                              }
                              placeholder="270000"
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn"
                              onClick={() => deleteTreatment(t.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="hint">
                Semi-guided rule: only propose treatments that materially change the decision.
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={() => setActiveView("Decisions")}>
                  Go to decision
                </button>
              </div>
            </div>
          ) : null}

          {activeView === "Decisions" && selectedScenario ? (
            <div className="card card-pad">
              <SectionTitle
                title="Risk decision"
                subtitle="Turn analysis into an explicit, accountable decision."
              />

              <div className="grid">
                <div className="col6">
                  <div className="label">Decision</div>
                  <Select
                    value={selectedScenario.decision.status}
                    onChange={(val) =>
                      setScenario(selectedScenario.id, {
                        decision: { ...selectedScenario.decision, status: val },
                      })
                    }
                    options={["", "Accept", "Mitigate", "Transfer", "Avoid"]}
                  />
                </div>

                <div className="col6">
                  <div className="label">Decision owner</div>
                  <input
                    className="input"
                    value={selectedScenario.decision.owner}
                    onChange={(e) =>
                      setScenario(selectedScenario.id, {
                        decision: { ...selectedScenario.decision, owner: e.target.value },
                      })
                    }
                    placeholder="Business or risk owner"
                  />
                </div>

                <div className="col6">
                  <div className="label">Approver</div>
                  <input
                    className="input"
                    value={selectedScenario.decision.approver}
                    onChange={(e) =>
                      setScenario(selectedScenario.id, {
                        decision: { ...selectedScenario.decision, approver: e.target.value },
                      })
                    }
                    placeholder="Committee / executive"
                  />
                </div>

                <div className="col6">
                  <div className="label">Next review date</div>
                  <input
                    className="input"
                    type="date"
                    value={selectedScenario.decision.reviewDate}
                    onChange={(e) =>
                      setScenario(selectedScenario.id, {
                        decision: { ...selectedScenario.decision, reviewDate: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="col12">
                  <div className="label">Decision rationale</div>
                  <textarea
                    className="textarea"
                    value={selectedScenario.decision.rationale}
                    onChange={(e) =>
                      setScenario(selectedScenario.id, {
                        decision: { ...selectedScenario.decision, rationale: e.target.value },
                      })
                    }
                    placeholder="Explain why this decision is acceptable given the quantified risk."
                  />
                </div>
              </div>

              <div className="hint">
                FAIR value comes from defensible decisions, not perfect numbers.
              </div>
            </div>
          ) : null}

          {activeView === "Portfolio" && (
            <div className="grid">
              <MiniBars
                title="Top vendors by EAL"
                rows={portfolio.topVendors.map((v) => ({
                  label: v.vendorName,
                  value: v.eal,
                }))}
              />

              <MiniBars
                title="Top scenarios by EAL"
                rows={portfolio.topScenarios}
              />
            </div>
          )}

          {activeView === "Reports" && (
            <div className="card card-pad">
              <SectionTitle
                title="Reports & exports"
                subtitle="Use exports for training review, workshops, or management discussions."
              />

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn" onClick={exportExcel}>
                  Export Excel
                </button>
                <button className="btn primary" onClick={exportPDF}>
                  Export PDF
                </button>
              </div>

              <div className="hint">
                Training tip: ask learners to justify one decision verbally using the PDF.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
