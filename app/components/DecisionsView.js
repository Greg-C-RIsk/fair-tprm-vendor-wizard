"use client";

import { useMemo, useState } from "react";

/*
DecisionsView
- Consumes ResultsView + TreatmentsView outputs
- Formalizes risk decisions
- Audit-friendly, board-ready
*/

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

const DECISION_OPTIONS = [
  {
    key: "ACCEPT",
    label: "Accept risk",
    description: "Residual risk is within appetite. No further action required.",
  },
  {
    key: "MITIGATE",
    label: "Mitigate risk",
    description: "Implement selected controls to reduce risk to acceptable level.",
  },
  {
    key: "TRANSFER",
    label: "Transfer risk",
    description: "Transfer financial impact via insurance or contractual mechanisms.",
  },
  {
    key: "AVOID",
    label: "Avoid risk",
    description: "Exit the activity or terminate the vendor relationship.",
  },
];

export default function DecisionsView({
  vendor,
  scenario,
  treatments,
  setActiveView,
  updateVendor,
}) {
  if (!scenario?.quant?.stats) {
    return <div className="card">Run quantification first.</div>;
  }

  const [decision, setDecision] = useState({
    choice: "",
    owner: "",
    approver: "",
    reviewDate: "",
    rationale: "",
  });

  const ale = scenario.quant.stats.ale;
  const baseALE = ale.ml;
  const p90 = ale.p90;

  const treatmentSummary = useMemo(() => {
    if (!treatments?.length) return null;

    const totalCost = treatments.reduce(
      (s, t) => s + (Number(t.annualCost) || 0),
      0
    );

    const totalReductionPct = treatments.reduce((r, t) => {
      return r + (t.reductionPct / 100) * (1 - r);
    }, 0);

    const residualALE = baseALE * (1 - totalReductionPct);

    return {
      totalCost,
      residualALE,
      reduction: baseALE - residualALE,
      roi: totalCost > 0 ? (baseALE - residualALE) / totalCost : null,
    };
  }, [treatments, baseALE]);

  const saveDecision = () => {
    updateVendor(vendor.id, {
      scenarios: vendor.scenarios.map((s) =>
        s.id === scenario.id
          ? {
              ...s,
              decision: {
                ...decision,
                decidedAt: new Date().toISOString(),
              },
            }
          : s
      ),
    });

    alert("Decision saved.");
    setActiveView("Dashboard");
  };

  const isComplete =
    decision.choice &&
    decision.owner &&
    decision.approver &&
    decision.reviewDate &&
    decision.rationale;

  return (
    <div className="card">
      <h2>Risk Decision</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button className="btn" onClick={() => setActiveView("Treatments")}>
          Back to treatments
        </button>
        <button
          className="btn primary"
          onClick={saveDecision}
          disabled={!isComplete}
        >
          Confirm decision
        </button>
      </div>

      {/* Context */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Scenario context</strong>
        <div>Vendor: {vendor.name}</div>
        <div>Scenario: {scenario.title}</div>
      </div>

      {/* Risk summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Risk summary</strong>
        <div>Baseline ALE (median): {money(baseALE)}</div>
        <div>P90: {money(p90)}</div>

        {treatmentSummary && (
          <>
            <div style={{ marginTop: 8 }}>
              Residual ALE: {money(treatmentSummary.residualALE)}
            </div>
            <div>Risk reduction: {money(treatmentSummary.reduction)}</div>
            <div>Total cost: {money(treatmentSummary.totalCost)}</div>
            <div>
              ROI:{" "}
              {treatmentSummary.roi !== null
                ? treatmentSummary.roi.toFixed(2)
                : "–"}
            </div>
          </>
        )}
      </div>

      {/* Decision choice */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Decision</strong>

        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {DECISION_OPTIONS.map((o) => (
            <label
              key={o.key}
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                padding: 10,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="decision"
                value={o.key}
                checked={decision.choice === o.key}
                onChange={() => setDecision({ ...decision, choice: o.key })}
              />{" "}
              <strong>{o.label}</strong>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {o.description}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Governance fields */}
      <div className="card">
        <strong>Governance</strong>

        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <input
            className="input"
            placeholder="Risk owner"
            value={decision.owner}
            onChange={(e) =>
              setDecision({ ...decision, owner: e.target.value })
            }
          />

          <input
            className="input"
            placeholder="Approver"
            value={decision.approver}
            onChange={(e) =>
              setDecision({ ...decision, approver: e.target.value })
            }
          />

          <input
            className="input"
            type="date"
            value={decision.reviewDate}
            onChange={(e) =>
              setDecision({ ...decision, reviewDate: e.target.value })
            }
          />

          <textarea
            className="textarea"
            placeholder="Decision rationale (why this option was chosen)"
            rows={4}
            value={decision.rationale}
            onChange={(e) =>
              setDecision({ ...decision, rationale: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}
