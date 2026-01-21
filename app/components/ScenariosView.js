"use client";

const emptyScenario = () => ({
  id: crypto.randomUUID(),
  title: "",
  assetAtRisk: "",
  attackVector: "",
  threatActor: "External cybercriminal",
  lossEvent: "",
  narrative: "",
  quant: null, // sera rempli à l’étape Quantify
});

export default function ScenariosView({
  vendor,
  updateVendor,
  setActiveView,
}) {
  if (!vendor) {
    return <div className="card">No vendor selected</div>;
  }

  const scenarios = vendor.scenarios || [];

  const addScenario = () => {
    updateVendor(vendor.id, {
      scenarios: [...scenarios, emptyScenario()],
    });
  };

  const updateScenario = (scenarioId, patch) => {
    updateVendor(vendor.id, {
      scenarios: scenarios.map((s) =>
        s.id === scenarioId ? { ...s, ...patch } : s
      ),
    });
  };

  const deleteScenario = (scenarioId) => {
    updateVendor(vendor.id, {
      scenarios: scenarios.filter((s) => s.id !== scenarioId),
    });
  };

  return (
    <div className="card">
      <h2>Risk Scenarios</h2>

      <p style={{ opacity: 0.8 }}>
        Define <strong>specific, vendor-bound scenarios</strong>.  
        If a scenario could apply to any vendor, it is too generic.
      </p>

      {scenarios.length === 0 && (
        <div className="hint">
          No scenarios yet. Add at least one scenario before quantification.
        </div>
      )}

      {scenarios.map((scenario, index) => (
        <div
          key={scenario.id}
          className="card"
          style={{ marginTop: 20 }}
        >
          <h3>Scenario {index + 1}</h3>

          <div className="form-grid">
            <div>
              <label>Scenario title</label>
              <input
                value={scenario.title}
                onChange={(e) =>
                  updateScenario(scenario.id, { title: e.target.value })
                }
                placeholder="CRM vendor credential compromise"
              />
            </div>

            <div>
              <label>Asset at risk</label>
              <input
                value={scenario.assetAtRisk}
                onChange={(e) =>
                  updateScenario(scenario.id, {
                    assetAtRisk: e.target.value,
                  })
                }
                placeholder="Customer PII stored in CRM"
              />
            </div>

            <div>
              <label>Attack vector</label>
              <input
                value={scenario.attackVector}
                onChange={(e) =>
                  updateScenario(scenario.id, {
                    attackVector: e.target.value,
                  })
                }
                placeholder="Phishing leading to credential theft"
              />
            </div>

            <div>
              <label>Threat actor</label>
              <select
                value={scenario.threatActor}
                onChange={(e) =>
                  updateScenario(scenario.id, {
                    threatActor: e.target.value,
                  })
                }
              >
                <option>External cybercriminal</option>
                <option>Nation state</option>
                <option>Insider</option>
                <option>Hacktivist</option>
                <option>Accidental / non-malicious</option>
              </select>
            </div>

            <div className="full">
              <label>Loss event</label>
              <input
                value={scenario.lossEvent}
                onChange={(e) =>
                  updateScenario(scenario.id, {
                    lossEvent: e.target.value,
                  })
                }
                placeholder="Unauthorized disclosure of customer data"
              />
            </div>

            <div className="full">
              <label>Scenario narrative</label>
              <textarea
                value={scenario.narrative}
                onChange={(e) =>
                  updateScenario(scenario.id, {
                    narrative: e.target.value,
                  })
                }
                placeholder="An attacker compromises vendor credentials via phishing, gains access to the CRM platform, and exfiltrates customer PII."
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <button
              className="danger"
              onClick={() => deleteScenario(scenario.id)}
            >
              Delete scenario
            </button>

            <button
              onClick={() => setActiveView("Quantify")}
              disabled={
                !scenario.title ||
                !scenario.assetAtRisk ||
                !scenario.attackVector ||
                !scenario.lossEvent
              }
            >
              Quantify this scenario
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
        <button onClick={() => setActiveView("Tiering")}>
          Back to tiering
        </button>

        <button onClick={addScenario}>
          Add scenario
        </button>
      </div>
    </div>
  );
}
