"use client";

import { useMemo } from "react";

const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
};

const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const tierIndex = (t) =>
  Number(t?.dataSensitivity || 1) *
  Number(t?.integrationDepth || 1) *
  Number(t?.accessPrivileges || 1) *
  Number(t?.historicalIncidents || 1) *
  Number(t?.businessCriticality || 1);

export default function DashboardView({ vendors = [], setActiveView }) {
  const { vendorRows, scenarioRows } = useMemo(() => {
    const vRows = (vendors || []).map((v) => {
      const idx = tierIndex(v.tiering || emptyTiering());
      const scen = Array.isArray(v.scenarios) ? v.scenarios : [];
      const aleSum = scen.reduce((sum, s) => {
        const aleML = Number(s?.quant?.results?.ale?.ml);
        return sum + (Number.isFinite(aleML) ? aleML : 0);
      }, 0);
      return {
        id: v.id,
        name: v.name?.trim() ? v.name : "(Unnamed vendor)",
        idx,
        tier: v.tier || "—",
        carry: !!v.carryForward,
        scenarios: scen.length,
        ale: aleSum,
      };
    }).sort((a, b) => b.idx - a.idx);

    const sRows = [];
    for (const v of vendors || []) {
      for (const s of v.scenarios || []) {
        const aleML = Number(s?.quant?.results?.ale?.ml);
        sRows.push({
          vendor: v.name?.trim() ? v.name : "(Vendor)",
          title: s.title?.trim() ? s.title : "(Scenario)",
          ale: Number.isFinite(aleML) ? aleML : 0,
          decision: s?.decision?.status || "—",
        });
      }
    }
    sRows.sort((a, b) => b.ale - a.ale);

    return { vendorRows: vRows, scenarioRows: sRows };
  }, [vendors]);

  const totalVendors = vendors?.length || 0;
  const totalScenarios = vendors.reduce((n, v) => n + (v.scenarios?.length || 0), 0);
  const carryForward = vendors.filter((v) => v.carryForward).length;

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Portfolio overview (tiering + computed ALE from Quantify).
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{totalVendors} vendor(s)</span>
            <span className="badge">{totalScenarios} scenario(s)</span>
            <span className="badge">Carry-forward: {carryForward}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Vendors")}>← Vendors</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Vendors (ranked by tier index)</div>
          {!vendorRows.length ? (
            <div style={{ opacity: 0.8 }}>No vendors.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Tier</th>
                    <th>Index</th>
                    <th>Carry</th>
                    <th>Scenarios</th>
                    <th>Σ ALE (ML)</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 800 }}>{r.name}</td>
                      <td>{r.tier}</td>
                      <td style={{ fontWeight: 900 }}>{r.idx}</td>
                      <td>{r.carry ? "Yes" : "No"}</td>
                      <td>{r.scenarios}</td>
                      <td>{money(r.ale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Top scenarios (by ALE ML)</div>
          {!scenarioRows.length ? (
            <div style={{ opacity: 0.8 }}>No scenarios.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>ALE (ML)</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioRows.slice(0, 12).map((r, i) => (
                    <tr key={`${r.vendor}-${r.title}-${i}`}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{r.vendor}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{r.title}</div>
                      </td>
                      <td>{money(r.ale)}</td>
                      <td>{r.decision}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            (ALE shown here comes from Quantify → Compute results.)
          </div>
        </div>
      </div>
    </div>
  );
}
