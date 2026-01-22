"use client";

import { useMemo, useState } from "react";

/*
TreatmentsView
- Reads scenario.quant.stats (from ResultsView)
- Applies FAIR-aligned treatment effects
- No re-simulation (training simplification)
- Outputs: Risk reduction, residual risk, ROI
*/

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

const uid = () => Math.random().toString(16).slice(2);

// FAIR-aligned treatment catalog (training)
const TREATMENT_LIBRARY = [
  {
    id: "MFA",
    label: "Enforce MFA and least privilege",
    affects: "Susceptibility",
    reductionPct: 30,
  },
  {
    id: "Monitoring",
    label: "Improve monitoring and detection",
    affects: "TEF",
    reductionPct: 20,
  },
  {
    id: "Segmentation",
    label: "Network segmentation / blast radius reduction",
    affects: "Loss Magnitude",
    reductionPct: 25,
  },
  {
    id: "IR",
    label: "Incident response readiness",
    affects: "Secondary Loss",
    reductionPct: 20,
  },
  {
    id: "Insurance",
    label: "Cyber insurance transfer",
    affects: "Financial Impact",
    reductionPct: 40,
  },
];

export default function TreatmentsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!scenario?.quant?.stats) {
    return <div className="card">Run quantification before defining treatments.</div>;
  }

  const baseALE = scenario.quant.stats.ale.ml;

  const [treatments, setTreatments] = useState([]);

  const addTreatment = (tpl) => {
    setTreatments((prev) => [
      ...prev,
      {
        id: uid(),
        name: tpl.label,
        affects: tpl.affects,
        reductionPct: tpl.reductionPct,
        annualCost: "",
      },
    ]);
  };

  const updateTreatment = (id, patch) => {
    setTreatments((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const removeTreatment = (id) => {
    setTreatments((prev) => prev.filter((t) => t.id !== id));
  };

  // Simple FAIR-consistent reduction model (training)
  const totalReductionPct = useMemo(() => {
    // diminishing returns
    let r = 0;
    treatments.forEach((t) => {
      r = r + (t.reductionPct / 100) * (1 - r);
    });
    return r;
  }, [treatments]);

  const residualALE = baseALE * (1 - totalReductionPct);

  const totalCost = treatments.reduce(
    (sum, t) => sum + (Number(t.annualCost) || 0),
    0
  );

  const benefit = baseALE - residualALE;
  const roi = totalCost > 0 ? benefit / totalCost : null;

  return (
    <div className="card">
      <h2>Treatment Analysis</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button className="btn" onClick={() => setActiveView("Results")}>
          Back to results
        </button>
        <button
          className="btn primary"
          onClick={() => setActiveView("Decisions")}
          disabled={!treatments.length}
        >
          Go to decision
        </button>
      </div>

      {/* Baseline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Baseline Risk</strong>
        <div>ALE (median): {money(baseALE)}</div>
      </div>

      {/* Treatment library */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Add treatments</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {TREATMENT_LIBRARY.map((t) => (
            <button key={t.id} className="btn" onClick={() => addTreatment(t)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected treatments */}
      {treatments.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Selected treatments</strong>

          {treatments.map((t) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 8,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <div>
                <strong>{t.name}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Affects: {t.affects} | Reduction: {t.reductionPct}%
                </div>
              </div>

              <input
                className="input"
                placeholder="Annual cost (€)"
                value={t.annualCost}
                onChange={(e) =>
                  updateTreatment(t.id, { annualCost: e.target.value })
                }
              />

              <div>{money((t.reductionPct / 100) * baseALE)}</div>

              <button className="btn" onClick={() => removeTreatment(t.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Impact summary */}
      {treatments.length > 0 && (
        <div className="card">
          <strong>Impact summary</strong>

          <div style={{ marginTop: 8 }}>
            <div>Risk before: {money(baseALE)}</div>
            <div>Risk after: {money(residualALE)}</div>
            <div>Risk reduction: {money(benefit)}</div>
            <div>Total annual cost: {money(totalCost)}</div>
            <div>
              ROI:{" "}
              {roi !== null ? roi.toFixed(2) : "–"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
