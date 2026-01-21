"use client";

import { useMemo, useRef, useState } from "react";

/* ======================================================
   Helpers
====================================================== */

const emptyTriad = () => ({ min: "", ml: "", max: "" });

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const triangularSample = (min, ml, max) => {
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
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined
    ? a[base] + rest * (a[base + 1] - a[base])
    : a[base];
};

const money = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/* ======================================================
   Small UI helpers
====================================================== */

function Triad({ label, triad, onChange, pct = false }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input className="input" placeholder={pct ? "min %" : "min"} value={triad.min} onChange={(e) => onChange({ ...triad, min: e.target.value })} />
        <input className="input" placeholder={pct ? "most likely %" : "most likely"} value={triad.ml} onChange={(e) => onChange({ ...triad, ml: e.target.value })} />
        <input className="input" placeholder={pct ? "max %" : "max"} value={triad.max} onChange={(e) => onChange({ ...triad, max: e.target.value })} />
      </div>
    </div>
  );
}

/* ======================================================
   QuantifyView
====================================================== */
/**
 * Props:
 *  - quant : quant object
 *  - onChange(updatedQuant)
 */
export default function QuantifyView({ quant, onChange }) {
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const runSimulation = async () => {
    cancelRef.current = false;
    setRunning(true);

    const sims = Number(quant.sims) || 10000;

    const aleSamples = [];
    const perEventSamples = [];

    const pct = (t) => ({
      min: Number(t.min) / 100,
      ml: Number(t.ml) / 100,
      max: Number(t.max) / 100,
    });

    for (let i = 0; i < sims; i++) {
      if (cancelRef.current) break;

      /* -------- Frequency -------- */
      let lambda = 0;

      if (quant.level === "LEF") {
        lambda = triangularSample(quant.lef.min, quant.lef.ml, quant.lef.max);
      }

      if (quant.level === "TEF") {
        const tef = triangularSample(quant.tef.min, quant.tef.ml, quant.tef.max);
        const susc = triangularSample(...Object.values(pct(quant.susceptibility)));
        lambda = tef * clamp01(susc);
      }

      if (quant.level === "Contact Frequency") {
        const cf = triangularSample(quant.contactFrequency.min, quant.contactFrequency.ml, quant.contactFrequency.max);
        const poa = triangularSample(...Object.values(pct(quant.probabilityOfAction)));
        const susc = triangularSample(...Object.values(pct(quant.susceptibility)));
        lambda = cf * clamp01(poa) * clamp01(susc);
      }

      const events = poisson(Math.max(0, lambda));
      let annualLoss = 0;

      /* -------- Loss per event -------- */
      for (let e = 0; e < events; e++) {
        const primary = triangularSample(
          quant.primaryLoss.min,
          quant.primaryLoss.ml,
          quant.primaryLoss.max
        );

        const secProb = triangularSample(
          ...Object.values(pct(quant.secondaryLossEventFrequency))
        );

        const secondary =
          Math.random() < clamp01(secProb)
            ? triangularSample(
                quant.secondaryLossMagnitude.min,
                quant.secondaryLossMagnitude.ml,
                quant.secondaryLossMagnitude.max
              )
            : 0;

        const perEvent = primary + secondary;
        perEventSamples.push(perEvent);
        annualLoss += perEvent;
      }

      aleSamples.push(annualLoss);
    }

    const stats = {
      ale: {
        min: quantile(aleSamples, 0.01),
        ml: quantile(aleSamples, 0.5),
        max: quantile(aleSamples, 0.99),
        p10: quantile(aleSamples, 0.1),
        p90: quantile(aleSamples, 0.9),
      },
      perEvent: {
        min: quantile(perEventSamples, 0.01),
        ml: quantile(perEventSamples, 0.5),
        max: quantile(perEventSamples, 0.99),
      },
    };

    onChange({
      ...quant,
      aleSamples,
      perEventSamples,
      stats,
      lastRunAt: new Date().toISOString(),
    });

    setRunning(false);
  };

  /* ======================================================
     Render
  ====================================================== */

  return (
    <div className="card card-pad">
      <h2>Quantification (FAIR)</h2>

      <div className="label">Taxonomy entry point</div>
      <select className="input" value={quant.level} onChange={(e) => onChange({ ...quant, level: e.target.value })}>
        <option>LEF</option>
        <option>TEF</option>
        <option>Contact Frequency</option>
      </select>

      <hr />

      {quant.level === "LEF" && (
        <Triad label="LEF (events/year)" triad={quant.lef} onChange={(t) => onChange({ ...quant, lef: t })} />
      )}

      {quant.level === "TEF" && (
        <>
          <Triad label="TEF (events/year)" triad={quant.tef} onChange={(t) => onChange({ ...quant, tef: t })} />
          <Triad label="Susceptibility (%)" pct triad={quant.susceptibility} onChange={(t) => onChange({ ...quant, susceptibility: t })} />
        </>
      )}

      {quant.level === "Contact Frequency" && (
        <>
          <Triad label="Contact Frequency (events/year)" triad={quant.contactFrequency} onChange={(t) => onChange({ ...quant, contactFrequency: t })} />
          <Triad label="Probability of Action (%)" pct triad={quant.probabilityOfAction} onChange={(t) => onChange({ ...quant, probabilityOfAction: t })} />
          <Triad label="Susceptibility (%)" pct triad={quant.susceptibility} onChange={(t) => onChange({ ...quant, susceptibility: t })} />
        </>
      )}

      <hr />

      <h3>Loss factors</h3>

      <Triad label="Primary Loss (€ / event)" triad={quant.primaryLoss} onChange={(t) => onChange({ ...quant, primaryLoss: t })} />
      <Triad label="Secondary Loss Event Frequency (%)" pct triad={quant.secondaryLossEventFrequency} onChange={(t) => onChange({ ...quant, secondaryLossEventFrequency: t })} />
      <Triad label="Secondary Loss Magnitude (€)" triad={quant.secondaryLossMagnitude} onChange={(t) => onChange({ ...quant, secondaryLossMagnitude: t })} />

      <hr />

      <div className="label">Monte-Carlo simulations</div>
      <input className="input" value={quant.sims} onChange={(e) => onChange({ ...quant, sims: e.target.value })} />

      <button className="btn primary" disabled={running} onClick={runSimulation}>
        {running ? "Running…" : "Run simulation"}
      </button>

      {quant.stats && (
        <div className="hint" style={{ marginTop: 12 }}>
          <strong>ALE (median):</strong> {money(quant.stats.ale.ml)} <br />
          <strong>P10 / P90:</strong> {money(quant.stats.ale.p10)} / {money(quant.stats.ale.p90)}
        </div>
      )}
    </div>
  );
}      </div>
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
