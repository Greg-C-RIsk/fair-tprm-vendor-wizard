"use client";

import { useState } from "react";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const Field = ({ label, value, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label className="label">{label}</label>
    <input
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="min / ML / max"
    />
  </div>
);

const Triad = ({ title, triad, onChange }) => (
  <div className="card card-pad">
    <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
    <div className="grid">
      <div className="col4">
        <Field label="Min" value={triad.min} onChange={(v) => onChange({ ...triad, min: v })} />
      </div>
      <div className="col4">
        <Field label="Most Likely" value={triad.ml} onChange={(v) => onChange({ ...triad, ml: v })} />
      </div>
      <div className="col4">
        <Field label="Max" value={triad.max} onChange={(v) => onChange({ ...triad, max: v })} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------
// Quantify View
// ---------------------------------------------
export default function QuantifyView({ quant, onChange }) {
  const q = quant;

  const update = (patch) => {
    onChange({ ...q, ...patch });
  };

  return (
    <div className="card card-pad">
      <h2 className="h-title">Quantification (FAIR)</h2>
      <p className="h-sub">
        Choose the abstraction level and provide min / most-likely / max estimates for each factor.
      </p>

      {/* TAXONOMY LEVEL */}
      <div style={{ marginBottom: 16 }}>
        <label className="label">Taxonomy level</label>
        <select
          className="input"
          value={q.level}
          onChange={(e) => update({ level: e.target.value })}
        >
          <option value="LEF">Loss Event Frequency (LEF)</option>
          <option value="TEF">Threat Event Frequency (TEF)</option>
          <option value="Contact">Contact Frequency</option>
        </select>
      </div>

      {/* FREQUENCY SIDE */}
      <div className="grid">
        <div className="col12">
          <h3>Frequency factors</h3>
        </div>

        <div className="col6">
          <Triad title="LEF" triad={q.lef} onChange={(v) => update({ lef: v })} />
        </div>

        <div className="col6">
          <Triad title="TEF" triad={q.tef} onChange={(v) => update({ tef: v })} />
        </div>

        <div className="col6">
          <Triad
            title="Contact Frequency"
            triad={q.contactFrequency}
            onChange={(v) => update({ contactFrequency: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Probability of Action"
            triad={q.probabilityOfAction}
            onChange={(v) => update({ probabilityOfAction: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Susceptibility"
            triad={q.susceptibility}
            onChange={(v) => update({ susceptibility: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Threat Capacity"
            triad={q.threatCapacity}
            onChange={(v) => update({ threatCapacity: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Resistance Strength"
            triad={q.resistanceStrength}
            onChange={(v) => update({ resistanceStrength: v })}
          />
        </div>
      </div>

      {/* LOSS SIDE */}
      <div className="grid" style={{ marginTop: 20 }}>
        <div className="col12">
          <h3>Loss magnitude</h3>
        </div>

        <div className="col6">
          <Triad
            title="Primary Loss"
            triad={q.primaryLoss}
            onChange={(v) => update({ primaryLoss: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Secondary Loss Event Frequency"
            triad={q.secondaryLossEventFrequency}
            onChange={(v) => update({ secondaryLossEventFrequency: v })}
          />
        </div>

        <div className="col6">
          <Triad
            title="Secondary Loss Magnitude"
            triad={q.secondaryLossMagnitude}
            onChange={(v) => update({ secondaryLossMagnitude: v })}
          />
        </div>
      </div>

      {/* ACTION */}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button className="btn primary">Run Monte Carlo simulation</button>
      </div>
    </div>
  );
}
