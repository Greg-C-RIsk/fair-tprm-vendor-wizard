"use client";

import { useMemo, useRef, useState } from "react";

/* ------------------ helpers ------------------ */

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const triangular = (min, ml, max) => {
  const a = Number(min);
  const b = Number(max);
  const c = Number(ml);
  if (![a, b, c].every(Number.isFinite) || b <= a) return 0;

  const u = Math.random();
  const fc = (c - a) / (b - a);
  return u < fc
    ? a + Math.sqrt(u * (b - a) * (c - a))
    : b - Math.sqrt((1 - u) * (b - a) * (b - c));
};

// Poisson (Knuth)
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
  return s[base + 1]
    ? s[base] + rest * (s[base + 1] - s[base])
    : s[base];
};

const money = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/* ------------------ component ------------------ */

export default function QuantifyView({ selectedScenario, updateScenario }) {
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  if (!selectedScenario) {
    return (
      <div className="card card-pad">
        <h2>Quantification</h2>
        <p>Select a scenario first.</p>
      </div>
    );
  }

  const q = selectedScenario.quant;

  const runSimulation = async () => {
    const sims = Math.max(1000, Number(q.sims) || 10000);

    const ale = [];

    cancelRef.current = false;
    setRunning(true);

    for (let i = 0; i < sims; i++) {
      if (cancelRef.current) break;

      const tef = Math.max(0, triangular(q.tef.min, q.tef.ml, q.tef.max));
      const susc = clamp01(triangular(q.susc.min, q.susc.ml, q.susc.max) / 100);
      const lef = tef * susc;

      const events = poisson(lef);

      let annualLoss = 0;
      for (let e = 0; e < events; e++) {
        annualLoss += Math.max(0, triangular(q.pel.min, q.pel.ml, q.pel.max));
      }

      ale.push(annualLoss);

      if (i % 500 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const stats = {
      min: quantile(ale, 0.01),
      ml: quantile(ale, 0.5),
      max: quantile(ale, 0.99),
      p90: quantile(ale, 0.9),
    };

    updateScenario(selectedScenario.id, {
      quant: {
        ...q,
        aleSamples: ale,
        stats,
        lastRunAt: new Date().toISOString(),
      },
    });

    setRunning(false);
  };

  const cancel = () => {
    cancelRef.current = true;
    setRunning(false);
  };

  const stats = q.stats;

  return (
    <div className="card card-pad">
      <h2>Quantification (FAIR)</h2>

      <div className="grid">
        <div className="col4">
          <div className="label">TEF (events/year)</div>
          <input className="input" placeholder="min" value={q.tef.min}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, tef: { ...q.tef, min: e.target.value }}})} />
          <input className="input" placeholder="most likely" value={q.tef.ml}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, tef: { ...q.tef, ml: e.target.value }}})} />
          <input className="input" placeholder="max" value={q.tef.max}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, tef: { ...q.tef, max: e.target.value }}})} />
        </div>

        <div className="col4">
          <div className="label">Susceptibility (%)</div>
          <input className="input" placeholder="min" value={q.susc.min}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, susc: { ...q.susc, min: e.target.value }}})} />
          <input className="input" placeholder="most likely" value={q.susc.ml}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, susc: { ...q.susc, ml: e.target.value }}})} />
          <input className="input" placeholder="max" value={q.susc.max}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, susc: { ...q.susc, max: e.target.value }}})} />
        </div>

        <div className="col4">
          <div className="label">Loss per event (€)</div>
          <input className="input" placeholder="min" value={q.pel.min}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, pel: { ...q.pel, min: e.target.value }}})} />
          <input className="input" placeholder="most likely" value={q.pel.ml}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, pel: { ...q.pel, ml: e.target.value }}})} />
          <input className="input" placeholder="max" value={q.pel.max}
            onChange={(e) => updateScenario(selectedScenario.id, { quant: { ...q, pel: { ...q.pel, max: e.target.value }}})} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        {!running && <button className="btn primary" onClick={runSimulation}>Run simulation</button>}
        {running && <button className="btn" onClick={cancel}>Cancel</button>}
      </div>

      {stats && (
        <div className="hint" style={{ marginTop: 14 }}>
          <strong>Annual Loss Exposure (ALE)</strong>
          <div style={{ marginTop: 6 }}>Min: {money(stats.min)}</div>
          <div>Median: {money(stats.ml)}</div>
          <div>P90: {money(stats.p90)}</div>
          <div>Max: {money(stats.max)}</div>
        </div>
      )}
    </div>
  );
}
