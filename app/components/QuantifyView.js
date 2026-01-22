"use client";

import { useMemo } from "react";

/*
QuantifyView — FAIR Inputs Only
- No Monte Carlo
- No charts
- No derived maths
- Pure FAIR estimation capture (min / ML / max)

Expected props:
- vendor
- scenario
- updateVendor(vendorId, patch)
- setActiveView(view)
*/

// ---------- Helpers ----------

const ensureTriad = (t) => ({
  min: t?.min ?? "",
  ml: t?.ml ?? "",
  max: t?.max ?? "",
});

const ensureQuant = (q = {}) => ({
  level: q.level || "LEF",
  susceptibilityMode: q.susceptibilityMode || "Direct",

  lef: ensureTriad(q.lef),
  tef: ensureTriad(q.tef),
  contactFrequency: ensureTriad(q.contactFrequency),
  probabilityOfAction: ensureTriad(q.probabilityOfAction),

  susceptibility: ensureTriad(q.susceptibility),
  threatCapacity: ensureTriad(q.threatCapacity),
  resistanceStrength: ensureTriad(q.resistanceStrength),

  primaryLoss: ensureTriad(q.primaryLoss),
  secondaryLossEventFrequency: ensureTriad(q.secondaryLossEventFrequency),
  secondaryLossMagnitude: ensureTriad(q.secondaryLossMagnitude),
});

// ---------- UI Components ----------

function Triad({ label, hint, unit, value, onChange }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 800 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, opacity: 0.75 }}>{hint}</div>}
      {unit && <div style={{ fontSize: 12, opacity: 0.75 }}>Unit: {unit}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
        {["min", "ml", "max"].map((k) => (
          <div key={k}>
            <div className="label">{k.toUpperCase()}</div>
            <input
              className="input"
              value={value[k]}
              inputMode="decimal"
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main View ----------

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return <div className="card">Select a vendor and a scenario to start quantification.</div>;
  }

  const q = ensureQuant(scenario.quant);

  const updateQuant = (patch) => {
    updateVendor(vendor.id, {
      scenarios: vendor.scenarios.map((s) =>
        s.id === scenario.id
          ? { ...s, quant: { ...q, ...patch } }
          : s
      ),
    });
  };

  const requiredMissing = useMemo(() => {
    const missing = [];
    const check = (t, name) => {
      if (![t.min, t.ml, t.max].every((v) => v !== "")) missing.push(name);
    };

    if (q.level === "LEF") check(q.lef, "LEF");
    if (q.level === "TEF") check(q.tef, "TEF");
    if (q.level === "Contact Frequency") {
      check(q.contactFrequency, "Contact Frequency");
      check(q.probabilityOfAction, "Probability of Action");
    }

    if (q.susceptibilityMode === "Direct") {
      check(q.susceptibility, "Susceptibility");
    } else {
      check(q.threatCapacity, "Threat Capacity");
      check(q.resistanceStrength, "Resistance Strength");
    }

    check(q.primaryLoss, "Primary Loss");
    check(q.secondaryLossEventFrequency, "Secondary Loss Event Frequency");
    check(q.secondaryLossMagnitude, "Secondary Loss Magnitude");

    return missing;
  }, [q]);

  return (
    <div className="card">
      <h2>Quantification — FAIR Inputs</h2>
      <p style={{ opacity: 0.8 }}>
        Provide <strong>min / most likely / max</strong> estimates for each FAIR factor.
        No calculations are performed at this stage.
      </p>

      {/* LEVEL SELECTION */}
      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div className="label">FAIR Abstraction Level</div>
        <select
          className="input"
          value={q.level}
          onChange={(e) => updateQuant({ level: e.target.value })}
        >
          <option value="LEF">LEF (Loss Event Frequency)</option>
          <option value="TEF">TEF (Threat Event Frequency)</option>
          <option value="Contact Frequency">Contact Frequency</option>
        </select>

        <div className="label" style={{ marginTop: 10 }}>
          Susceptibility Estimation Mode
        </div>
        <select
          className="input"
          value={q.susceptibilityMode}
          onChange={(e) => updateQuant({ susceptibilityMode: e.target.value })}
        >
          <option value="Direct">Direct Susceptibility (%)</option>
          <option value="FromCapacityVsResistance">
            Derived from Threat Capacity vs Resistance Strength
          </option>
        </select>
      </div>

      {/* FREQUENCY */}
      <div style={{ marginTop: 16 }}>
        <h3>Frequency Factors</h3>

        {q.level === "LEF" && (
          <Triad
            label="LEF — Loss Event Frequency"
            hint="Annual frequency of loss events."
            unit="events / year"
            value={q.lef}
            onChange={(v) => updateQuant({ lef: v })}
          />
        )}

        {q.level === "TEF" && (
          <Triad
            label="TEF — Threat Event Frequency"
            hint="How often threats act on the asset."
            unit="events / year"
            value={q.tef}
            onChange={(v) => updateQuant({ tef: v })}
          />
        )}

        {q.level === "Contact Frequency" && (
          <>
            <Triad
              label="Contact Frequency"
              unit="contacts / year"
              value={q.contactFrequency}
              onChange={(v) => updateQuant({ contactFrequency: v })}
            />
            <Triad
              label="Probability of Action"
              unit="%"
              value={q.probabilityOfAction}
              onChange={(v) => updateQuant({ probabilityOfAction: v })}
            />
          </>
        )}

        {q.level !== "LEF" &&
          (q.susceptibilityMode === "Direct" ? (
            <Triad
              label="Susceptibility"
              unit="%"
              value={q.susceptibility}
              onChange={(v) => updateQuant({ susceptibility: v })}
            />
          ) : (
            <>
              <Triad
                label="Threat Capacity"
                unit="relative score"
                value={q.threatCapacity}
                onChange={(v) => updateQuant({ threatCapacity: v })}
              />
              <Triad
                label="Resistance Strength"
                unit="relative score"
                value={q.resistanceStrength}
                onChange={(v) => updateQuant({ resistanceStrength: v })}
              />
            </>
          ))}
      </div>

      {/* LOSS */}
      <div style={{ marginTop: 16 }}>
        <h3>Loss Factors</h3>

        <Triad
          label="Primary Loss"
          unit="€ per event"
          value={q.primaryLoss}
          onChange={(v) => updateQuant({ primaryLoss: v })}
        />

        <Triad
          label="Secondary Loss Event Frequency"
          unit="events per primary event"
          value={q.secondaryLossEventFrequency}
          onChange={(v) => updateQuant({ secondaryLossEventFrequency: v })}
        />

        <Triad
          label="Secondary Loss Magnitude"
          unit="€ per secondary event"
          value={q.secondaryLossMagnitude}
          onChange={(v) => updateQuant({ secondaryLossMagnitude: v })}
        />
      </div>

      {/* VALIDATION */}
      {requiredMissing.length > 0 && (
        <div className="hint" style={{ marginTop: 16 }}>
          <strong>Missing estimates:</strong>
          <ul>
            {requiredMissing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ACTIONS */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn" onClick={() => setActiveView("Scenarios")}>
          Back to scenarios
        </button>
        <button
          className="btn primary"
          disabled={requiredMissing.length > 0}
          onClick={() => setActiveView("Results")}
        >
          Run FAIR analysis
        </button>
      </div>
    </div>
  );
}
