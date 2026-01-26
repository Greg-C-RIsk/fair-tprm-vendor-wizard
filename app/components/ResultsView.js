"use client";

import { useMemo, useState } from "react";
import { ensureQuant, runFairMonteCarlo } from "../../lib/fairEngine";

/*
ResultsView
- Uses the SAME FAIR engine as Quantify (runFairMonteCarlo)
- Displays quant.stats + distributions if present
- Can run simulation from here and persist results into scenario.quant
- Auto-fixes % scale if user typed 0..1 instead of 0..100 (PoA + Susceptibility in Direct mode)
*/

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

// If triad looks like 0..1, convert to 0..100 (percent)
function maybeConvert01toPercent(triad) {
  const a = Number(String(triad?.min ?? "").replace(",", "."));
  const m = Number(String(triad?.ml ?? "").replace(",", "."));
  const b = Number(String(triad?.max ?? "").replace(",", "."));

  const vals = [a, m, b].filter((x) => Number.isFinite(x));
  if (!vals.length) return triad;

  // Heuristic: if all provided values are between 0 and 1, treat as fraction and convert to %
  const allBetween01 = vals.every((x) => x >= 0 && x <= 1);
  if (!allBetween01) return triad;

  return {
    ...triad,
    min: triad?.min === "" ? "" : String(a * 100),
    ml: triad?.ml === "" ? "" : String(m * 100),
    max: triad?.max === "" ? "" : String(b * 100),
  };
}

// ------------------ Charts ------------------

function Histogram({ title, values }) {
  if (!values?.length) return null;
  const bins = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((v) => {
    const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
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
              height: `${peak ? (c / peak) * 100 : 0}%`,
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

function ExceedanceCurve({ curve, values }) {
  // Prefer curve computed by engine (more accurate), fallback to values
  const pts = curve?.pts?.length
    ? curve.pts.map((p) => ({ x: p.x, y: p.exceed }))
    : values?.length
    ? [...values]
        .sort((a, b) => a - b)
        .map((x, i, arr) => ({ x, y: 1 - i / (arr.length - 1) }))
    : null;

  if (!pts?.length) return null;

  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;
  const spanX = Math.max(1e-9, maxX - minX);

  const mapX = (x) => 30 + ((x - minX) / spanX) * 460;
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
      <div style={{ fontSize: 12, opacity: 0.7 }}>Y = P(Loss &gt; x)</div>
    </div>
  );
}

// ------------------ Main ------------------

export default function ResultsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return <div className="card">No data available.</div>;
  }

  const quant = useMemo(() => ensureQuant(scenario.quant || {}), [scenario?.id]);

  const [running, setRunning] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const stats = quant.stats;
  const aleSamples = Array.isArray(quant.aleSamples) ? quant.aleSamples : [];
  const curve = quant.curve || null;

  const runSimulation = async () => {
    setRunning(true);
    setErrMsg("");

    try {
      // IMPORTANT: don’t mutate inputs – only build a simulation copy
      let qForSim = ensureQuant(quant);

      // Auto-fix % scale if user typed 0..1:
      // - PoA is always treated as % in engine
      // - Susceptibility is treated as % ONLY in Direct mode
      if (qForSim.level === "Contact Frequency") {
        qForSim = {
          ...qForSim,
          probabilityOfAction: maybeConvert01toPercent(qForSim.probabilityOfAction),
        };
      }

      if (qForSim.level !== "LEF" && qForSim.susceptibilityMode === "Direct") {
        qForSim = {
          ...qForSim,
          susceptibility: maybeConvert01toPercent(qForSim.susceptibility),
        };
      }

      const out = await runFairMonteCarlo(qForSim, { sims: qForSim.sims });

      const merged = ensureQuant({ ...quant, ...out });

      // Persist into the scenario (so Dashboard/others see it)
      const nextScenarios = (vendor.scenarios || []).map((s) =>
        s.id === scenario.id ? { ...s, quant: merged } : s
      );
      updateVendor(vendor.id, { scenarios: nextScenarios });
    } catch (e) {
      // fairEngine throws { missing: [...] } when inputs invalid
      const missing = e?.missing;
      if (Array.isArray(missing) && missing.length) {
        setErrMsg("Champs manquants / invalides :\n- " + missing.join("\n- "));
      } else {
        setErrMsg(e?.message ? String(e.message) : "Erreur inconnue");
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card">
      <h2>FAIR Results</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => setActiveView?.("Quantify")}>
          Back
        </button>
        <button className="btn primary" disabled={running} onClick={runSimulation}>
          {running ? "Running…" : "Run Monte Carlo"}
        </button>
      </div>

      {errMsg ? (
        <div style={{ marginTop: 12, whiteSpace: "pre-wrap", fontSize: 13, opacity: 0.9 }}>
          {errMsg}
        </div>
      ) : null}

      {!stats ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>
          Pas de résultats encore. Clique <strong>Run Monte Carlo</strong>.
        </div>
      ) : (
        <>
          <div className="grid" style={{ marginTop: 16 }}>
            <div className="card">
              <strong>ALE</strong>
              <div>Min: {money(stats.ale?.min)}</div>
              <div>ML: {money(stats.ale?.ml)}</div>
              <div>Max: {money(stats.ale?.max)}</div>
              <div>P10: {money(stats.ale?.p10)}</div>
              <div>P90: {money(stats.ale?.p90)}</div>
            </div>

            <div className="card">
              <strong>Per-Event Loss</strong>
              <div>Min: {money(stats.pel?.min)}</div>
              <div>ML: {money(stats.pel?.ml)}</div>
              <div>Max: {money(stats.pel?.max)}</div>
              <div>P10: {money(stats.pel?.p10)}</div>
              <div>P90: {money(stats.pel?.p90)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <Histogram title="Annual Loss Distribution" values={aleSamples} />
            <ExceedanceCurve curve={curve} values={aleSamples} />
          </div>
        </>
      )}
    </div>
  );
}
