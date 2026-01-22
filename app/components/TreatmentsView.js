"use client";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const emptyTreatment = () => ({
  id: uid(),
  kind: "Reduce susceptibility",
  title: "",
  owner: "",
  annualCost: "",
  effectPct: 20,
});

export default function TreatmentsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor) return <div className="card card-pad">Select a vendor.</div>;
  if (!scenario) return <div className="card card-pad">Select a scenario.</div>;

  const treatments = Array.isArray(scenario.treatments) ? scenario.treatments : [];

  const updateScenario = (patch) => {
    updateVendor(vendor.id, {
      scenarios: (vendor.scenarios || []).map((s) => (s.id === scenario.id ? { ...s, ...patch } : s)),
    });
  };

  const upsertTreatment = (id, patch) => {
    updateScenario({
      treatments: treatments.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  const add = () => updateScenario({ treatments: [...treatments, emptyTreatment()] });

  const del = (id) => updateScenario({ treatments: treatments.filter((t) => t.id !== id) });

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Treatments</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Capture proposed controls / treatments for this scenario.
          </div>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
            Vendor: <b>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</b> · Scenario:{" "}
            <b>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Quantify")}>← Quantify</button>
          <button className="btn primary" onClick={add}>+ Add treatment</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {!treatments.length ? (
          <div className="hint">No treatments yet. Click “Add treatment”.</div>
        ) : null}

        {treatments.map((t) => (
          <div key={t.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>{t.title?.trim() ? t.title : "(Untitled treatment)"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => del(t.id)}>Delete</button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="label">Kind</div>
                <select className="input" value={t.kind} onChange={(e) => upsertTreatment(t.id, { kind: e.target.value })}>
                  <option>Reduce TEF</option>
                  <option>Reduce susceptibility</option>
                  <option>Reduce loss magnitude</option>
                  <option>Transfer</option>
                  <option>Avoid</option>
                </select>
              </div>

              <div>
                <div className="label">Owner</div>
                <input className="input" value={t.owner || ""} onChange={(e) => upsertTreatment(t.id, { owner: e.target.value })} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div className="label">Title</div>
                <input className="input" value={t.title || ""} onChange={(e) => upsertTreatment(t.id, { title: e.target.value })} placeholder="Example: Enforce MFA for vendor admin accounts" />
              </div>

              <div>
                <div className="label">Annual cost (€)</div>
                <input className="input" inputMode="decimal" value={t.annualCost || ""} onChange={(e) => upsertTreatment(t.id, { annualCost: e.target.value })} />
              </div>

              <div>
                <div className="label">Effect (%)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(t.effectPct ?? 20)}
                  onChange={(e) => upsertTreatment(t.id, { effectPct: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn primary" onClick={() => setActiveView?.("Decisions")}>
          Go to Decisions →
        </button>
      </div>
    </div>
  );
}
