"use client";

import { useMemo } from "react";

/**
 * QuantifyView – STABLE TRAINING FORM
 * - No Monte Carlo
 * - No charts
 * - No derived maths
 * - Just FAIR estimation inputs (min / ML / max)
 *
 * Props:
 * - vendor
 * - scenario
 * - updateVendor(vendorId, patch)
 * - setActiveView(viewKey)
 */

const emptyTriad = (t) => ({
  min: t?.min ?? "",
  ml: t?.ml ?? "",
  max: t?.max ?? "",
});

const ensureQuant = (scenario) => {
  const q = scenario?.quant || {};
  return {
    level: q.level || "LEF",

    lef: emptyTriad(q.lef),
    tef: emptyTriad(q.tef),
    contactFrequency: emptyTriad(q.contactFrequency),
    probabilityOfAction: emptyTriad(q.probabilityOfAction),
    susceptibility: emptyTriad(q.susceptibility),

    threatCapacity: emptyTriad(q.threatCapacity),
    resistanceStrength: emptyTriad(q.resistanceStrength),

    primaryLoss: emptyTriad(q.primaryLoss),
    secondaryLossEventFrequency: emptyTriad(q.secondaryLossEventFrequency),
    secondaryLossMagnitude: emptyTriad(q.secondaryLossMagnitude),
  };
};

function Triad({ label, unit, value, onChange }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        {label} {unit ? <span style={{ opacity: 0.6 }}>({unit})</span> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input
          className="input"
          placeholder="Min"
          value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
        <input
          className="input"
          placeholder="Most likely"
          value={value.ml}
          onChange={(e) => onChange({ ...value, ml: e.target.value })}
        />
        <input
          className="input"
          placeholder="Max"
          value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return <div className="card">Select a vendor and a scenario first.</div>;
  }

  const q = useMemo(() => ensureQuant(scenario), [scenario]);

  const updateQuant = (patch) => {
    updateVendor(vendor.id, {
      scenarios: vendor.scenarios.map((s) =>
        s.id === scenario.id
          ? { ...s, quant: { ...q, ...patch } }
          : s
      ),
    });
  };

  return (
    <div className="card card-pad">
      <h2>Quantification (FAIR)</h2>
      <p style={{ opacity: 0.75 }}>
        Training mode — provide <strong>min / most likely / max</strong> estimates
        for each FAIR factor.
      </p>

      {/* LEVEL */}
      <div className="card" style={{ padding: 12, marginTop: 14 }}>
        <div className="label">FAIR abstraction level</div>
        <select
          className="input"
          value={q.level}
          onChange={(e) => updateQuant({ level: e.target.value })}
          style={{ maxWidth: 280 }}
        >
          <option value="LEF">LEF (Loss Event Frequency)</option>
          <option value="TEF">TEF (Threat Event Frequency)</option>
          <option value="Contact Frequency">Contact Frequency</option>
        </select>
      </div>

      {/* FREQUENCY */}
      <div style={{ marginTop: 16 }}>
        <h3>Frequency factors</h3>

        {q.level === "LEF" && (
          <Triad
            label="LEF – Loss Event Frequency"
            unit="per year"
            value={q.lef}
            onChange={(v) => updateQuant({ lef: v })}
          />
        )}

        {q.level === "TEF" && (
          <>
            <Triad
              label="TEF – Threat Event Frequency"
              unit="per year"
              value={q.tef}
              onChange={(v) => updateQuant({ tef: v })}
            />
            <Triad
              label="Susceptibility"
              unit="%"
              value={q.susceptibility}
              onChange={(v) => updateQuant({ susceptibility: v })}
            />
          </>
        )}

        {q.level === "Contact Frequency" && (
          <>
            <Triad
              label="Contact Frequency"
              unit="per year"
              value={q.contactFrequency}
              onChange={(v) => updateQuant({ contactFrequency: v })}
            />
            <Triad
              label="Probability of Action"
              unit="%"
              value={q.probabilityOfAction}
              onChange={(v) => updateQuant({ probabilityOfAction: v })}
            />
            <Triad
              label="Susceptibility"
              unit="%"
              value={q.susceptibility}
              onChange={(v) => updateQuant({ susceptibility: v })}
            />
          </>
        )}
      </div>

      {/* CAPABILITY / RESISTANCE */}
      <div style={{ marginTop: 16 }}>
        <h3>Threat vs resistance</h3>

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
      </div>

      {/* LOSSES */}
      <div style={{ marginTop: 16 }}>
        <h3>Loss magnitude</h3>

        <Triad
          label="Primary Loss"
          unit="€ per event"
          value={q.primaryLoss}
          onChange={(v) => updateQuant({ primaryLoss: v })}
        />

        <Triad
          label="Secondary Loss Event Frequency"
          unit="events per primary loss"
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

      {/* NAV */}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button className="btn" onClick={() => setActiveView("Scenarios")}>
          Back to scenarios
        </button>
        <button
          className="btn primary"
          onClick={() => setActiveView("Treatments")}
        >
          Continue to treatments
        </button>
      </div>
    </div>
  );
}
