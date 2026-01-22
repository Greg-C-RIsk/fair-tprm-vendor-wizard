"use client";

import { useMemo } from "react";

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

const recomputeTierFromIndex = (idx) => {
  if (idx >= 400) return { tier: "High", rationale: "High composite score across criteria." };
  if (idx >= 120) return { tier: "Medium", rationale: "Moderate composite score across criteria." };
  return { tier: "Low", rationale: "Low composite score across criteria." };
};

function ScoreSelect({ value, onChange }) {
  return (
    <select className="input" value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
    </select>
  );
}

export default function TieringView({
  vendors = [],
  selectedVendorId = "",
  setSelectedVendorId,
  updateVendor,
  setActiveView,
}) {
  const rows = useMemo(() => {
    return (vendors || []).map((v) => {
      const t = v.tiering || emptyTiering();
      const idx = tierIndex(t);
      return { v, t, idx };
    });
  }, [vendors]);

  const autoSelectTop2 = () => {
    const ranked = [...rows].sort((a, b) => b.idx - a.idx);
    const top2 = new Set(ranked.slice(0, 2).map((r) => r.v.id));
    for (const r of ranked) {
      const nextCarry = top2.has(r.v.id);
      const out = recomputeTierFromIndex(r.idx);
      updateVendor(r.v.id, {
        carryForward: nextCarry,
        tier: out.tier,
        tierRationale: r.v.tierRationale || out.rationale,
      });
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>Tiering</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Note chaque vendor de <b>1 → 5</b>. Index = produit des 5 critères.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={autoSelectTop2} disabled={!vendors?.length}>
            Auto-select top 2
          </button>
          <button className="btn primary" onClick={() => setActiveView?.("Quantify")}>
            Go to Quantify →
          </button>
        </div>
      </div>

      {!vendors?.length ? (
        <div style={{ marginTop: 12, opacity: 0.8 }}>No vendors yet. Create one in Vendors.</div>
      ) : (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Vendor</th>
                <th style={{ minWidth: 160 }}>Data sensitivity</th>
                <th style={{ minWidth: 160 }}>Integration depth</th>
                <th style={{ minWidth: 160 }}>Access privileges</th>
                <th style={{ minWidth: 160 }}>Historical incidents</th>
                <th style={{ minWidth: 160 }}>Business criticality</th>
                <th style={{ minWidth: 120 }}>Index</th>
                <th style={{ minWidth: 140 }}>Carry forward</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, t, idx }) => (
                <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setSelectedVendorId?.(v.id)}>
                  <td>
                    <div style={{ fontWeight: 800 }}>
                      {v.name?.trim() ? v.name : "(Unnamed vendor)"}
                      {v.id === selectedVendorId ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(selected)</span> : null}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{v.category || "—"} · {v.geography || "—"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Tier: <b>{v.tier || "—"}</b></div>
                  </td>

                  <td>
                    <ScoreSelect value={t.dataSensitivity} onChange={(n) => updateVendor(v.id, { tiering: { ...t, dataSensitivity: n } })} />
                  </td>
                  <td>
                    <ScoreSelect value={t.integrationDepth} onChange={(n) => updateVendor(v.id, { tiering: { ...t, integrationDepth: n } })} />
                  </td>
                  <td>
                    <ScoreSelect value={t.accessPrivileges} onChange={(n) => updateVendor(v.id, { tiering: { ...t, accessPrivileges: n } })} />
                  </td>
                  <td>
                    <ScoreSelect value={t.historicalIncidents} onChange={(n) => updateVendor(v.id, { tiering: { ...t, historicalIncidents: n } })} />
                  </td>
                  <td>
                    <ScoreSelect value={t.businessCriticality} onChange={(n) => updateVendor(v.id, { tiering: { ...t, businessCriticality: n } })} />
                  </td>

                  <td style={{ fontWeight: 900 }}>{idx}</td>

                  <td>
                    <input
                      type="checkbox"
                      checked={!!v.carryForward}
                      onChange={(e) => {
                        const out = recomputeTierFromIndex(idx);
                        updateVendor(v.id, {
                          carryForward: e.target.checked,
                          tier: out.tier,
                          tierRationale: v.tierRationale || out.rationale,
                        });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected vendor rationale */}
      {vendors?.length && selectedVendorId ? (
        <div className="hint" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Tier rationale (selected vendor)</div>
          {(() => {
            const v = vendors.find((x) => x.id === selectedVendorId);
            if (!v) return <div style={{ opacity: 0.8 }}>Select a vendor row.</div>;
            return (
              <>
                <div style={{ opacity: 0.8, marginBottom: 6 }}>
                  Vendor: <b>{v.name?.trim() ? v.name : "(Unnamed vendor)"}</b> · Tier: <b>{v.tier || "—"}</b>
                </div>
                <textarea
                  className="textarea"
                  value={v.tierRationale || ""}
                  onChange={(e) => updateVendor(v.id, { tierRationale: e.target.value })}
                  placeholder="Write a short rationale that a business leader would accept."
                />
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
