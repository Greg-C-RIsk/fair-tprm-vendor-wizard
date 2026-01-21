"use client";

import { useMemo, useRef, useState } from "react";

/* ---------- Helpers ---------- */

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
};

const triangular = (min, ml, max) => {
  const a = Number(min);
  const c = Number(ml);
  const b = Number(max);
  if (![a, b, c].every(Number.isFinite)) return 0;
  if (b <= a) return a;
  const u = Math.random();
  const fc = (c - a) / (b - a);
  return u < fc
    ? a + Math.sqrt(u * (b - a) * (c - a))
    : b - Math.sqrt((1 - u) * (b - a) * (b - c));
};

const poisson = (lambda) => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined
    ? s[base] + rest * (s[base + 1] - s[base])
    : s[base];
};

/* ---------- UI ---------- */

function Triad({ label, unit, value, onChange }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 800 }}>{label}</div>
      {unit && <div style={{ fontSize: 12, opacity: 0.7 }}>{unit}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
        {["min", "ml", "max"].map((k) => (
          <input
            key={k}
            className="input"
            placeholder={k.toUpperCase()}
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Main View ---------- */

export default function QuantifyView({ vendor, scenario, updateVendor }) {
  if (!vendor || !scenario) {
    return <div className="card">Select a vendor and scenario.</div>;
  }

  const q = scenario.quant;
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const updateQuant = (patch) => {
    updateVendor(vendor.id, {
      scenarios: vendor.scenarios.map((s) =>
        s.id === scenario.id ? { ...s, quant: { ...q, ...patch } } : s
      ),
    });
  };

  const runSimulation = async () => {
    setRunning(true);
    cancelRef.current = false;

    const sims = Number(q.sims) || 10000;
    const ale = [];
    const pel = [];

    for (let i = 0; i < sims; i++) {
      if (cancelRef.current) break;

      const lef = triangular(q.lef.min, q.lef.ml, q.lef.max);
      const primary = triangular(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max);
      const slef = triangular(
        q.secondaryLossEventFrequency.min,
        q.secondaryLossEventFrequency.ml,
        q.secondaryLossEventFrequency.max
      );
      const slm = triangular(
        q.secondaryLossMagnitude.min,
        q.secondaryLossMagnitude.ml,
        q.secondaryLossMagnitude.max
      );

      const perEvent = primary + slef * slm;
      const events = poisson(lef);

      let annual = 0;
      for (let e = 0; e < events; e++) {
        annual += perEvent;
        pel.push(perEvent);
      }
      ale.push(annual);
    }

    updateQuant({
      aleSamples: ale,
      pelSamples: pel,
      stats: {
        ale: {
          min: quantile(ale, 0.01),
          ml: quantile(ale, 0.5),
          max: quantile(ale, 0.99),
          p10: quantile(ale, 0.1),
          p90: quantile(ale, 0.9),
        },
      },
      lastRunAt: new Date().toISOString(),
    });

    setRunning(false);
  };

  return (
    <div className="card">
      <h2>Quantification (FAIR)</h2>

      <Triad label="LEF" unit="per year" value={q.lef} onChange={(v) => updateQuant({ lef: v })} />
      <Triad label="Primary Loss" unit="€" value={q.primaryLoss} onChange={(v) => updateQuant({ primaryLoss: v })} />
      <Triad
        label="Secondary Loss Event Frequency"
        value={q.secondaryLossEventFrequency}
        onChange={(v) => updateQuant({ secondaryLossEventFrequency: v })}
      />
      <Triad
        label="Secondary Loss Magnitude"
        unit="€"
        value={q.secondaryLossMagnitude}
        onChange={(v) => updateQuant({ secondaryLossMagnitude: v })}
      />

      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={runSimulation} disabled={running}>
          {running ? "Running..." : "Run Monte Carlo"}
        </button>
      </div>

      {q.stats && (
        <div className="card" style={{ marginTop: 14 }}>
          <div><strong>ALE (Median):</strong> {money(q.stats.ale.ml)}</div>
          <div><strong>P90:</strong> {money(q.stats.ale.p90)}</div>
        </div>
      )}
    </div>
  );
}
