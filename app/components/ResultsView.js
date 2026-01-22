"use client";

import { useMemo, useState, useRef } from "react";

/*
ResultsView — FAIR Engine + Monte Carlo
- Reads scenario.quant only
- No mutation of quant inputs
- Writes results into scenario.results
*/

// ------------------ Helpers ------------------

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

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

// ------------------ Charts ------------------

function Histogram({ title, values }) {
  if (!values?.length) return null;
  const bins = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((v) => {
    const i = Math.min(
      bins - 1,
      Math.floor(((v - min) / span) * bins)
    );
    counts[i]++;
  });

  const peak = Math.max(...counts);

  return (
    <div className="card" style={{ padding: 12 }}>
      <strong>{title}</strong>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120, marginTop: 10 }}>
        {counts.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${(c / peak) * 100}%`,
              background: "currentColor",
              opacity: 0.75,
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {money(min)} → {money(max)}
      </div>
    </div>
  );
}

function ExceedanceCurve({ values }) {
  if (!values?.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pts = sorted.map((x, i) => ({
    x,
    y: 1 - i / (sorted.length - 1),
  }));

  const min = pts[0].x;
  const max = pts[pts.length - 1].x;

  const mapX = (x) => 30 + ((x - min) / (max - min)) * 460;
  const mapY = (y) => 140 - y * 120;

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x)} ${mapY(p.y)}`)
    .join(" ");

  return (
    <div className="card" style={{ padding: 12 }}>
      <strong>Loss Exceedance Curve</strong>
      <svg viewBox="0 0 520 160" style={{ marginTop: 10 }}>
        <path d="M30 20 L30 140 L490 140" stroke="currentColor" opacity="0.2" fill="none" />
        <path d={d} stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Y = P(Loss &gt; x)
      </div>
    </div>
  );
}

// ------------------ Main ------------------

export default function ResultsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario?.quant) {
    return <div className="card">No quantification data available.</div>;
  }

  const q = scenario.quant;
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const cancelRef = useRef(false);

  const runSimulation = async () => {
    setRunning(true);
    cancelRef.current = false;

    const sims = 10000;
    const ale = [];
    const pel = [];

    for (let i = 0; i < sims; i++) {
      if (cancelRef.current) break;

      // ---- Frequency chain
      let lef = 0;

      if (q.level === "LEF") {
        lef = triangularSample(q.lef.min, q.lef.ml, q.lef.max);
      }

      if (q.level === "TEF") {
        const tef = triangularSample(q.tef.min, q.tef.ml, q.tef.max);
        const susc =
          q.susceptibilityMode === "Direct"
            ? triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max) / 100
            : clamp01(
                triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max) -
                  triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max)
              );
        lef = tef * clamp01(susc);
      }

      if (q.level === "Contact Frequency") {
        const cf = triangularSample(q.contactFrequency.min, q.contactFrequency.ml, q.contactFrequency.max);
        const poa = triangularSample(q.probabilityOfAction.min, q.probabilityOfAction.ml, q.probabilityOfAction.max) / 100;
        const tef = cf * clamp01(poa);
        const susc =
          q.susceptibilityMode === "Direct"
            ? triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max) / 100
            : clamp01(
                triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max) -
                  triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max)
              );
        lef = tef * clamp01(susc);
      }

      // ---- Loss
      const primary = triangularSample(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max);
      const slef = triangularSample(
        q.secondaryLossEventFrequency.min,
        q.secondaryLossEventFrequency.ml,
        q.secondaryLossEventFrequency.max
      );
      const slm = triangularSample(
        q.secondaryLossMagnitude.min,
        q.secondaryLossMagnitude.ml,
        q.secondaryLossMagnitude.max
      );

      const perEvent = primary + slef * slm;

      const k = poisson(Math.max(0, lef));
      let annual = 0;
      for (let e = 0; e < k; e++) {
        annual += perEvent;
        pel.push(perEvent);
      }
      ale.push(annual);
    }

    const summary = {
      ale: {
        min: quantile(ale, 0.01),
        ml: quantile(ale, 0.5),
        max: quantile(ale, 0.99),
        p10: quantile(ale, 0.1),
        p90: quantile(ale, 0.9),
      },
      pel: {
        min: quantile(pel, 0.01),
        ml: quantile(pel, 0.5),
        max: quantile(pel, 0.99),
      },
      aleSamples: ale,
    };

    setResults(summary);
    setRunning(false);
  };

  return (
    <div className="card">
      <h2>FAIR Results</h2>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" onClick={() => setActiveView("Quantify")}>
          Back
        </button>
        <button className="btn primary" disabled={running} onClick={runSimulation}>
          {running ? "Running…" : "Run Monte Carlo"}
        </button>
      </div>

      {results && (
        <>
          <div className="grid" style={{ marginTop: 16 }}>
            <div className="card">
              <strong>ALE</strong>
              <div>Min: {money(results.ale.min)}</div>
              <div>ML: {money(results.ale.ml)}</div>
              <div>Max: {money(results.ale.max)}</div>
              <div>P10: {money(results.ale.p10)}</div>
              <div>P90: {money(results.ale.p90)}</div>
            </div>

            <div className="card">
              <strong>Per-Event Loss</strong>
              <div>Min: {money(results.pel.min)}</div>
              <div>ML: {money(results.pel.ml)}</div>
              <div>Max: {money(results.pel.max)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Histogram title="Annual Loss Distribution" values={results.aleSamples} />
            <ExceedanceCurve values={results.aleSamples} />
          </div>
        </>
      )}
    </div>
  );
}
