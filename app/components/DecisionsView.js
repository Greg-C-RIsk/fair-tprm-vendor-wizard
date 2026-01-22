"use client";

export default function DecisionsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor) return <div className="card card-pad">Select a vendor.</div>;
  if (!scenario) return <div className="card card-pad">Select a scenario.</div>;

  const decision = scenario.decision || { status: "", owner: "", approver: "", reviewDate: "", rationale: "" };

  const updateScenario = (patch) => {
    updateVendor(vendor.id, {
      scenarios: (vendor.scenarios || []).map((s) => (s.id === scenario.id ? { ...s, ...patch } : s)),
    });
  };

  const setDecision = (patch) => updateScenario({ decision: { ...decision, ...patch } });

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Decision</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Record the governance decision for this scenario.
          </div>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
            Vendor: <b>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</b> · Scenario:{" "}
            <b>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Treatments")}>← Treatments</button>
          <button className="btn primary" onClick={() => setActiveView?.("Dashboard")}>Go to Dashboard →</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Status</div>
          <select className="input" value={decision.status || ""} onChange={(e) => setDecision({ status: e.target.value })}>
            <option value="">—</option>
            <option value="Accepted">Accepted</option>
            <option value="Accepted with conditions">Accepted with conditions</option>
            <option value="Mitigate">Mitigate</option>
            <option value="Transfer">Transfer</option>
            <option value="Avoid">Avoid</option>
          </select>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="label">Review date</div>
          <input className="input" type="date" value={decision.reviewDate || ""} onChange={(e) => setDecision({ reviewDate: e.target.value })} />
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="label">Owner</div>
          <input className="input" value={decision.owner || ""} onChange={(e) => setDecision({ owner: e.target.value })} />
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="label">Approver</div>
          <input className="input" value={decision.approver || ""} onChange={(e) => setDecision({ approver: e.target.value })} />
        </div>

        <div className="card" style={{ padding: 12, gridColumn: "1 / -1" }}>
          <div className="label">Rationale</div>
          <textarea className="textarea" value={decision.rationale || ""} onChange={(e) => setDecision({ rationale: e.target.value })} placeholder="Explain why this decision is acceptable and what conditions apply." />
        </div>
      </div>
    </div>
  );
}
