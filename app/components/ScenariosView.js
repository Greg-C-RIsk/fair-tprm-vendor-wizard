"use client";

export default function ScenariosView({ selectedVendor, selectedScenario, addScenario, updateScenario, deleteScenario }) {
  if (!selectedVendor) return (
    <div className="card card-pad">Select a vendor first.</div>
  );

  if (!selectedScenario) {
    return (
      <div className="card card-pad">
        <h2>Scenarios</h2>
        <p>No scenario yet.</p>
        <button className="btn primary" onClick={addScenario}>Add scenario</button>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <h2 style={{ marginBottom: 8 }}>Scenario Definition</h2>

      <div className="grid">
        <div className="col12">
          <div className="label">Scenario title</div>
          <input
            className="input"
            value={selectedScenario.title}
            onChange={(e) => updateScenario(selectedScenario.id, { title: e.target.value })}
          />
        </div>

        <div className="col6">
          <div className="label">Asset at risk</div>
          <input
            className="input"
            value={selectedScenario.assetAtRisk}
            onChange={(e) => updateScenario(selectedScenario.id, { assetAtRisk: e.target.value })}
          />
        </div>

        <div className="col6">
          <div className="label">Threat actor</div>
          <input
            className="input"
            value={selectedScenario.threatActor}
            onChange={(e) => updateScenario(selectedScenario.id, { threatActor: e.target.value })}
          />
        </div>

        <div className="col6">
          <div className="label">Attack vector</div>
          <input
            className="input"
            value={selectedScenario.attackVector}
            onChange={(e) => updateScenario(selectedScenario.id, { attackVector: e.target.value })}
          />
        </div>

        <div className="col6">
          <div className="label">Loss event</div>
          <input
            className="input"
            value={selectedScenario.lossEvent}
            onChange={(e) => updateScenario(selectedScenario.id, { lossEvent: e.target.value })}
          />
        </div>

        <div className="col12">
          <div className="label">Narrative</div>
          <textarea
            className="textarea"
            value={selectedScenario.narrative}
            onChange={(e) => updateScenario(selectedScenario.id, { narrative: e.target.value })}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={addScenario}>Add scenario</button>
        <button className="btn" onClick={() => deleteScenario(selectedScenario.id)}>Delete scenario</button>
      </div>
    </div>
  );
}
