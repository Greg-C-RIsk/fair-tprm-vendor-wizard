"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Page() {
  const [step, setStep] = useState(1);

  const [vendor, setVendor] = useState({
    name: "",
    category: "",
    owner: "",
    function: "",
    data: "",
  });

  const [scenario, setScenario] = useState({
    asset: "",
    threat: "",
    event: "",
    loss: "",
  });

  const [results, setResults] = useState({
    eal: "",
    p90: "",
    driver: "",
  });

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([vendor]),
      "Vendor"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([scenario]),
      "Scenario"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([results]),
      "Results"
    );

    XLSX.writeFile(wb, "FAIR_TPRM_Vendor_Profile.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("FAIR-Based TPRM Report", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Field", "Value"]],
      body: Object.entries(vendor),
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Scenario Field", "Value"]],
      body: Object.entries(scenario),
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Metric", "Value"]],
      body: Object.entries(results),
    });

    doc.save("FAIR_TPRM_Report.pdf");
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h-title">FAIR TPRM Vendor Wizard</h1>
          <p className="h-sub">
            Guided example to capture vendor context, define a FAIR scenario,
            and document quantitative results.
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn primary" onClick={exportPDF}>Export PDF</button>
        </div>
      </div>

      <div className="tabs">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            className={`tab ${step === s ? "active" : ""}`}
            onClick={() => setStep(s)}
          >
            Step {s}
          </button>
        ))}
      </div>

      <div className="card card-pad">
        {step === 1 && (
          <>
            <h3>Vendor Overview</h3>
            <div className="grid">
              <div className="col6">
                <label className="label">Vendor name</label>
                <input className="input" onChange={e => setVendor(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div className="col6">
                <label className="label">Category</label>
                <input className="input" onChange={e => setVendor(v => ({ ...v, category: e.target.value }))} />
              </div>
              <div className="col12">
                <label className="label">Critical business function</label>
                <input className="input" onChange={e => setVendor(v => ({ ...v, function: e.target.value }))} />
              </div>
            </div>
            <div className="hint">
              Focus on business context first. No controls, no scores.
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Risk Scenario</h3>
            <div className="grid">
              <div className="col6">
                <label className="label">Asset at risk</label>
                <input className="input" onChange={e => setScenario(s => ({ ...s, asset: e.target.value }))} />
              </div>
              <div className="col6">
                <label className="label">Threat actor</label>
                <input className="input" onChange={e => setScenario(s => ({ ...s, threat: e.target.value }))} />
              </div>
              <div className="col12">
                <label className="label">Loss event</label>
                <input className="input" onChange={e => setScenario(s => ({ ...s, loss: e.target.value }))} />
              </div>
            </div>
            <div className="hint">
              If you cannot clearly describe the loss event, you cannot quantify it.
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3>FAIR Results</h3>
            <div className="grid">
              <div className="col6">
                <label className="label">Expected Annual Loss (€)</label>
                <input className="input" onChange={e => setResults(r => ({ ...r, eal: e.target.value }))} />
              </div>
              <div className="col6">
                <label className="label">90th percentile (€)</label>
                <input className="input" onChange={e => setResults(r => ({ ...r, p90: e.target.value }))} />
              </div>
              <div className="col12">
                <label className="label">Main risk driver</label>
                <input className="input" onChange={e => setResults(r => ({ ...r, driver: e.target.value }))} />
              </div>
            </div>
            <div className="hint">
              These numbers support decisions, not compliance reporting.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
