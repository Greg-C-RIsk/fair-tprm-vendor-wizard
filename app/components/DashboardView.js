"use client";

import { useMemo } from "react";

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

export default function DashboardView({ vendors, setActiveView }) {
  // Flatten scenarios
  const scenarios = useMemo(() => {
    const rows = [];
    for (const v of vendors) {
      for (const s of v.scenarios || []) {
        if (!s.quant?.stats) continue;
        rows.push({
          vendorId: v.id,
          vendorName: v.name,
          scenarioId: s.id,
          scenarioTitle: s.title,
          ale: s.quant.stats.ale.ml,
          p90: s.quant.stats.ale.p90,
          decision: s.decision?.choice || "UNDECIDED",
        });
      }
    }
    return rows;
  }, [vendors]);

  const totals = useMemo(() => {
    const t = {
      totalALE: 0,
      accepted: 0,
      mitigated: 0,
      transferred: 0,
      avoided: 0,
      undecided: 0,
    };

    for (const s of scenarios) {
      t.totalALE += s.ale || 0;

      switch (s.decision) {
        case "ACCEPT":
          t.accepted += s.ale || 0;
          break;
        case "MITIGATE":
          t.mitigated += s.ale || 0;
          break;
        case "TRANSFER":
          t.transferred += s.ale || 0;
          break;
        case "AVOID":
          t.avoided += s.ale || 0;
          break;
        default:
          t.undecided += s.ale || 0;
      }
    }

    return t;
  }, [scenarios]);

  const topScenarios = [...scenarios]
    .sort((a, b) => b.ale - a.ale)
    .slice(0, 10);

  return (
    <div className="card">
      <h2>Risk Dashboard</h2>

      {/* Global summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Portfolio overview</strong>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
          <div>
            <div className="label">Total ALE</div>
            <div style={{ fontWeight: 900 }}>{money(totals.totalALE)}</div>
          </div>

          <div>
            <div className="label">Accepted risk</div>
            <div>{money(totals.accepted)}</div>
          </div>

          <div>
            <div className="label">Undecided risk</div>
            <div style={{ color: totals.undecided > 0 ? "#fbbf24" : "inherit" }}>
              {money(totals.undecided)}
            </div>
          </div>

          <div>
            <div className="label">Mitigated risk</div>
            <div>{money(totals.mitigated)}</div>
          </div>

          <div>
            <div className="label">Transferred risk</div>
            <div>{money(totals.transferred)}</div>
          </div>

          <div>
            <div className="label">Avoided risk</div>
            <div>{money(totals.avoided)}</div>
          </div>
        </div>
      </div>

      {/* Top risk drivers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Top scenarios by ALE</strong>

        <table className="table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Scenario</th>
              <th>ALE (median)</th>
              <th>P90</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {topScenarios.map((s) => (
              <tr key={s.scenarioId}>
                <td>{s.vendorName}</td>
                <td>{s.scenarioTitle}</td>
                <td>{money(s.ale)}</td>
                <td>{money(s.p90)}</td>
                <td>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      background:
                        s.decision === "UNDECIDED"
                          ? "rgba(251,191,36,0.2)"
                          : "rgba(34,197,94,0.2)",
                    }}
                  >
                    {s.decision}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" onClick={() => setActiveView("Vendors")}>
          Vendors
        </button>
        <button className="btn" onClick={() => setActiveView("Scenarios")}>
          Scenarios
        </button>
        <button className="btn" onClick={() => setActiveView("Decisions")}>
          Decisions
        </button>
      </div>
    </div>
  );
}
