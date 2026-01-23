"use client";

import { emptyScenario } from "../../lib/model";

export default function ScenariosView({
  vendor,
  selectedScenarioId,
  onSelectScenario,
  updateVendor,
  setActiveView,
}) {
  if (!vendor) {
    return <div className="card card-pad">Select a vendor first.</div>;
  }

  const scenarios = Array.isArray(vendor.scenarios) ? vendor.scenarios : [];
  const scenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0] || null;

  const updateScenario = (scenarioId, patch) => {
    const next = scenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch } : s));
    updateVendor(vendor.id, { scenarios: next });
  };

  const addScenario = () => {
    const s = emptyScenario();
    const next = [...scenarios, s];
    updateVendor(vendor.id, { scenarios: next });
    onSelectScenario(s.id);
  };

  const deleteScenario = (scenarioId) => {
    const s = scenarios.find((x) => x.id === scenarioId);
    const name = s?.title?.trim() ? s.title : "(Untitled scenario)";
    if (!confirm(`Delete scenario ${name}?`)) return;

    const next = scenarios.filter((x) => x.id !== scenarioId);
    const ensured = next.length ? next : [emptyScenario()];
    updateVendor(vendor.id, { scenarios: ensured });
    onSelectScenario(ensured[0]?.id || "");
  };

  return (
    <div className="card card-pad">
      <h2>Scenarios</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Vendor: {vendor.name || "(Unnamed)"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, marginTop: 16 }}>
        {/* List */}
        <div className="card card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>Scenario list</div>
            <button className="btn primary" onClick={addScenario}>+ Add</button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {scenarios.map((s) => {
              const active = s.id === scenario?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectScenario(s.id)}
                  style={{
                    textAlign: "left",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                    borderRadius: 14,
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{s.title?.trim() ? s.title : "(Untitled scenario)"}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {s.lossEvent?.trim() ? s.lossEvent : "No loss event yet"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="card card-pad">
          {!scenario ? (
            <div style={{ opacity: 0.8 }}>No scenario selected.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>
                  {scenario.title?.trim() ? scenario.title : "Scenario details"}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => deleteScenario(scenario.id)} disabled={scenarios.length <= 1}>
                    Delete
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      onSelectScenario(scenario.id);
                      setActiveView("Quantify");
                    }}
                  >
                    Quantify →
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div>
                  <div className="label">Scenario title</div>
                  <input className="input" value={scenario.title} onChange={(e) => updateScenario(scenario.id, { title: e.target.value })} />
                </div>

                <div>
                  <div className="label">Asset at risk</div>
                  <input className="input" value={scenario.assetAtRisk} onChange={(e) => updateScenario(scenario.id, { assetAtRisk: e.target.value })} />
                </div>

                <div>
                  <div className="label">Threat actor</div>
                  <input className="input" value={scenario.threatActor} onChange={(e) => updateScenario(scenario.id, { threatActor: e.target.value })} />
                </div>

                <div>
                  <div className="label">Attack vector</div>
                  <input className="input" value={scenario.attackVector} onChange={(e) => updateScenario(scenario.id, { attackVector: e.target.value })} />
                </div>

                <div>
                  <div className="label">Loss event</div>
                  <input className="input" value={scenario.lossEvent} onChange={(e) => updateScenario(scenario.id, { lossEvent: e.target.value })} />
                </div>

                <div>
                  <div className="label">Narrative</div>
                  <textarea className="textarea" rows={5} value={scenario.narrative} onChange={(e) => updateScenario(scenario.id, { narrative: e.target.value })} />
                </div>

                <div>
                  <div className="label">Assumptions</div>
                  <textarea className="textarea" rows={4} value={scenario.assumptions || ""} onChange={(e) => updateScenario(scenario.id, { assumptions: e.target.value })} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
