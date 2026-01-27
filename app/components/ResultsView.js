"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ensureQuant, runFairMonteCarlo, deriveSusceptibility, clamp01 } from "../../lib/fairEngine";

/**
 * ResultsView — FAIR only
 * - ALE / PEL p10/p50/p90
 * - Exceedance curve + histogram
 * - Input sanity checks (0..1 for probabilities)
 * - No CAM, no baseline/what-if
 */

const money = (n) => {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

function Card({ children, style }) {
  return (
    <div
      className="card"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />;
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "rgba(255,255,255,0.08)", br: "rgba(255,255,255,0.14)" },
    good: { bg: "rgba(34,197,94,0.18)", br: "rgba(34,197,94,0.35)" },
    warn: { bg: "rgba(245,158,11,0.18)", br: "rgba(245,158,11,0.35)" },
    bad: { bg: "rgba(239,68,68,0.18)", br: "rgba(239,68,68,0.35)" },
    blue: { bg: "rgba(59,130,246,0.18)", br: "rgba(59,130,246,0.35)" },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${t.br}`,
        background: t.bg,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatLine({ label, value, help }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 850 }}>{label}</div>
        <div style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>
      </div>
      {help ? <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>{help}</div> : null}
    </div>
  );
}

/** Histogram with hover tooltip (values = distribution) */
function Histogram({ title, subtitle, values, bins = 28 }) {
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    if (!values?.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-9, max - min);
    const counts = Array.from({ length: bins }, () => 0);

    values.forEach((v) => {
      const i = Math.max(0, Math.min(bins - 1, Math.floor(((v - min) / span) * bins)));
      counts[i]++;
    });

    const peak = Math.max(...counts);
    const total = values.length;
    const binEdges = Array.from({ length: bins + 1 }, (_, i) => min + (i / bins) * span);

    return { min, max, counts, peak, total, binEdges };
  }, [values, bins]);

  if (!model) return null;

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, opacity: 0.8 }}>{subtitle}</div> : null}
      </div>

      <div style={{ marginTop: 12, position: "relative" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 150 }}>
          {model.counts.map((c, i) => {
            const h = model.peak ? (c / model.peak) * 100 : 0;
            const from = model.binEdges[i];
            const to = model.binEdges[i + 1];
            return (
              <div
                key={i}
                onMouseEnter={() => setHover({ i, from, to, count: c, prob: c / model.total })}
                onMouseLeave={() => setHover(null)}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: "currentColor",
                  opacity: hover?.i === i ? 0.95 : 0.65,
                  borderRadius: 4,
                  cursor: "default",
                }}
              />
            );
          })}
        </div>

        {hover ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: "translate(0, -8px)",
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              fontSize: 12,
              pointerEvents: "none",
              maxWidth: 320,
            }}
          >
            <div style={{ fontWeight: 900 }}>Bin details</div>
            <div style={{ marginTop: 6, opacity: 0.92 }}>
              Range: {money(hover.from)} → {money(hover.to)}
            </div>
            <div style={{ opacity: 0.92 }}>
              In this bin: {hover.count.toLocaleString()} sims ({(hover.prob * 100).toFixed(1)}%)
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        X-axis: value • Y-axis: frequency in simulation
      </div>
    </Card>
  );
}

/** Exceedance curve with hover tooltip */
function ExceedanceCurve({ title, subtitle, curve }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const pts = curve?.pts || [];
  if (!pts.length) return null;

  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const W = 560;
  const H = 190;
  const padL = 56;
  const padR = 20;
  const padT = 18;
  const padB = 42;

  const mapX = (x) => padL + ((x - minX) / Math.max(1e-9, maxX - minX)) * (W - padL - padR);
  const mapY = (y) => padT + (1 - y) * (H - padT - padB);

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x).toFixed(2)} ${mapY(p.exceed).toFixed(2)}`)
    .join(" ");

  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const t = (mx - padL) / Math.max(1e-9, W - padL - padR);
    const domainX = minX + t * (maxX - minX);

    let best = null;
    let bestDist = Infinity;
    for (const p of pts) {
      const dist = Math.abs(p.x - domainX);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    if (best) setHover(best);
  };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, opacity: 0.8 }}>{subtitle}</div> : null}
      </div>

      <div style={{ marginTop: 12, position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto" }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <path
            d={`M ${padL} ${padT} L ${padL} ${H - padB} L ${W - padR} ${H - padB}`}
            stroke="currentColor"
            opacity="0.18"
            fill="none"
          />
          <path d={d} stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.95" />

          {hover ? (
            <>
              <circle cx={mapX(hover.x)} cy={mapY(hover.exceed)} r="4.5" fill="currentColor" />
              <line x1={mapX(hover.x)} y1={padT} x2={mapX(hover.x)} y2={H - padB} stroke="currentColor" opacity="0.12" />
              <line x1={padL} y1={mapY(hover.exceed)} x2={W - padR} y2={mapY(hover.exceed)} stroke="currentColor" opacity="0.12" />
            </>
          ) : null}

          <text x={padL} y={H - 12} fontSize="10" fill="currentColor" opacity="0.7">
            Loss threshold →
          </text>
          <text x={8} y={padT + 8} fontSize="10" fill="currentColor" opacity="0.7">
            P(exceed)
          </text>
        </svg>

        {hover ? (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              fontSize: 12,
              maxWidth: 340,
            }}
          >
            <div style={{ fontWeight: 900 }}>Point details</div>
            <div style={{ marginTop: 6, opacity: 0.92 }}>
              Threshold (x): <strong>{money(hover.x)}</strong>
            </div>
            <div style={{ opacity: 0.92 }}>
              P(Annual Loss &gt; x): <strong>{(hover.exceed * 100).toFixed(1)}%</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        “How likely is it to exceed a given annual loss amount?”
      </div>
    </Card>
  );
}

// -------------------- small helpers --------------------
const toNum = (x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function checkTriad01(label, triad) {
  const out = [];
  for (const k of ["min", "ml", "max"]) {
    const v = toNum(triad?.[k]);
    if (v === null) continue;
    if (v < 0 || v > 1) out.push(`${label} (${k}) must be between 0 and 1 (you have ${v}).`);
  }
  return out;
}

function fmtRate(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}
function fmtProb(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(3);
}
function lefToHuman(lefPerYear) {
  const lef = Number(lefPerYear);
  if (!Number.isFinite(lef) || lef <= 0) {
    return {
      lef,
      cadenceLabel: "—",
      intervalYears: null,
      probYear: null,
    };
  }

  // interval = 1/LEF years (mean waiting time)
  const intervalYears = 1 / lef;

  let cadenceLabel = "";
  if (intervalYears >= 1) {
    cadenceLabel = `≈ 1 fois tous les ${intervalYears.toFixed(intervalYears < 10 ? 1 : 0)} ans`;
  } else {
    // < 1 year => show "x times per year"
    cadenceLabel = `≈ ${lef.toFixed(lef < 10 ? 1 : 0)} fois par an`;
  }

  // Probability of ≥1 event in a year under Poisson(LEF)
  const probYear = 1 - Math.exp(-lef);

  return { lef, cadenceLabel, intervalYears, probYear };
}

function calcFrequencySummary(q) {
  const level = q?.level || "LEF";
  const lefML = toNum(q?.lef?.ml);
  const tefML = toNum(q?.tef?.ml);
  const cfML = toNum(q?.contactFrequency?.ml);
  const poaML = toNum(q?.probabilityOfAction?.ml);

  const suscMode = q?.susceptibilityMode || "Direct";
  const suscDirectML = toNum(q?.susceptibility?.ml);
  const tcML = toNum(q?.threatCapacity?.ml);
  const rsML = toNum(q?.resistanceStrength?.ml);

  let tefCalcML = null;
  let suscCalcML = null;
  let lefCalcML = null;

  if (level === "LEF") {
    lefCalcML = lefML;
  } else if (level === "TEF") {
    tefCalcML = tefML;

    if (suscMode === "Direct") {
      suscCalcML = suscDirectML;
    } else if (tcML !== null && rsML !== null) {
      suscCalcML = clamp01(deriveSusceptibility(tcML, rsML));
    }

    if (tefCalcML !== null && suscCalcML !== null) lefCalcML = tefCalcML * suscCalcML;
  } else {
    // Contact Frequency
    if (cfML !== null && poaML !== null) tefCalcML = cfML * poaML;

    if (suscMode === "Direct") {
      suscCalcML = suscDirectML;
    } else if (tcML !== null && rsML !== null) {
      suscCalcML = clamp01(deriveSusceptibility(tcML, rsML));
    }

    if (tefCalcML !== null && suscCalcML !== null) lefCalcML = tefCalcML * suscCalcML;
  }

  return { level, tefCalcML, suscCalcML, lefCalcML };
}

export default function ResultsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Results</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>No vendor/scenario selected.</div>
      </Card>
    );
  }

  const quantFromScenario = ensureQuant(scenario.quant || {});
  const [localQuant, setLocalQuant] = useState(quantFromScenario);

  useEffect(() => {
    setLocalQuant(ensureQuant(scenario.quant || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const q = useMemo(() => ensureQuant(localQuant), [localQuant]);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  const hasResults = !!q?.stats?.ale && Array.isArray(q?.aleSamples) && q.aleSamples.length > 0;

  // --- Input sanity checks (probabilities must be 0..1)
  const inputWarnings = useMemo(() => {
    const warnings = [];

    // Only probabilities:
    // - Contact Frequency: Probability of Action must be 0..1
    // - Any level != LEF: Susceptibility (if Direct) must be 0..1
    const level = q?.level || "LEF";

    if (level === "Contact Frequency") warnings.push(...checkTriad01("Probability of Action", q?.probabilityOfAction));

    if (level !== "LEF" && (q?.susceptibilityMode || "Direct") === "Direct") {
      warnings.push(...checkTriad01("Susceptibility", q?.susceptibility));
    }

    // Also: if user typed 30 (meaning 30%), show a “common mistake” hint
    const spotPercentMistake = (label, triad) => {
      const ml = toNum(triad?.ml);
      if (ml !== null && ml > 1 && ml <= 100) {
        warnings.push(`${label} looks like a percent (ML=${ml}). In this tool you must use 0..1 (so 30% = 0.30).`);
      }
    };

    if (level === "Contact Frequency") spotPercentMistake("Probability of Action", q?.probabilityOfAction);
    if (level !== "LEF" && (q?.susceptibilityMode || "Direct") === "Direct") spotPercentMistake("Susceptibility", q?.susceptibility);

    return warnings;
  }, [q]);

  const freqSummary = useMemo(() => calcFrequencySummary(q), [q]);

  const runFairOnly = async () => {
    setRunning(true);
    setProgress("Starting…");

    try {
      const baseQuant = ensureQuant(q);

      const res = await runFairMonteCarlo(baseQuant, {
        sims: baseQuant.sims,
        seed,
        curvePoints: Number(baseQuant?.curvePoints ?? 60),
        onProgress: ({ label }) => setProgress(label || ""),
        yield: true,
      });

      // persist into scenario.quant
      const nextScenarios = (vendor.scenarios || []).map((s) => {
        if (s.id !== scenario.id) return s;
        return {
          ...s,
          quant: {
            ...(s.quant || {}),
            sims: res.sims,
            lastRunAt: res.lastRunAt,
            stats: res.stats,
            aleSamples: res.aleSamples,
            pelSamples: res.pelSamples,
            curve: res.curve,
          },
        };
      });

      updateVendor(vendor.id, { scenarios: nextScenarios });

      setProgress("Done.");
      setTimeout(() => setProgress(""), 900);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const msg = err?.missing?.length ? `Missing inputs: ${err.missing.join(", ")}` : err?.message || "Simulation failed.";
      setProgress(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 980 }}>Results — FAIR analysis</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
              This page shows <strong>FAIR outputs only</strong>: ALE/PEL quantiles + distribution charts. (Controls / What-If
              are handled in the Dashboard.)
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="neutral">Level: {q.level}</Badge>
              <Badge tone="neutral">Sims: {Number(q.sims || 10000).toLocaleString()}</Badge>
              {q?.lastRunAt ? <Badge tone="blue">Last run: {new Date(q.lastRunAt).toLocaleString()}</Badge> : null}
              <Badge tone="neutral">Seed: {seed}</Badge>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={() => setActiveView?.("Quantify")}>
              Back to Quantify
            </button>
            <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} disabled={running}>
              New seed
            </button>
            <button className="btn primary" onClick={runFairOnly} disabled={running}>
              {running ? "Running…" : "Run FAIR simulation"}
            </button>
          </div>
        </div>

        {progress ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Status: <strong>{progress}</strong>
          </div>
        ) : null}
      </Card>

      {/* Input checks */}
      {inputWarnings.length ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Input sanity checks</div>
            <Badge tone="warn">{inputWarnings.length} warning(s)</Badge>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.88, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Probabilities must be typed as 0..1</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {inputWarnings.map((w, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {/* Frequency summary (connect inputs to taxonomy) */}
      <Card>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Frequency summary (from your inputs, ML)</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.55 }}>
          This is a “quick read” that helps you connect your scenario inputs to the FAIR frequency chain.
        </div>

        <Divider />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge tone="neutral">Level: {freqSummary.level}</Badge>
          <Badge tone="neutral">
            TEF (calc, ML): {freqSummary.tefCalcML === null ? "—" : fmtRate(freqSummary.tefCalcML)}
          </Badge>
          <Badge tone="neutral">
            Susceptibility (calc, ML): {freqSummary.suscCalcML === null ? "—" : fmtProb(freqSummary.suscCalcML)}
          </Badge>
          <Badge tone="neutral">
            LEF (calc, ML): {freqSummary.lefCalcML === null ? "—" : fmtRate(freqSummary.lefCalcML)}
          </Badge>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
          Note: this uses the <strong>ML</strong> values only. The simulation uses min/ML/max to generate a distribution.
        </div>
      </Card>

      {/* No results yet */}
      {!hasResults ? (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>No FAIR results yet</div>
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13, lineHeight: 1.55 }}>
            Click <strong>Run FAIR simulation</strong>. If you get an error, go to <strong>Quantify</strong> and complete the
            missing min/ML/max inputs.
          </div>
        </Card>
      ) : (
        <>
          {/* Summary: ALE + PEL */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Annual Loss Exposure (ALE)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(q.stats.ale.p10)} help="Low-end annual loss (10% of years are below this)." />
                <StatLine label="P50" value={money(q.stats.ale.ml)} help="Typical annual loss (median)." />
                <StatLine label="P90" value={money(q.stats.ale.p90)} help="High-end annual loss (90% of years are below this)." />
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Per-Event Loss (PEL)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(q.stats.pel.p10)} />
                <StatLine label="P50" value={money(q.stats.pel.ml)} />
                <StatLine label="P90" value={money(q.stats.pel.p90)} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
                PEL is the loss amount <strong>when a loss event happens</strong>. ALE is the distribution of total loss per year.
              </div>
            </Card>
          </div>

          {/* Charts: ALE histogram + ALE exceedance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Histogram
              title="Histogram — Annual Loss (ALE)"
              subtitle="How annual losses cluster across simulation years."
              values={q.aleSamples}
            />
            <ExceedanceCurve
              title="Exceedance — Annual Loss (ALE)"
              subtitle="P(Annual Loss > x) across simulation years."
              curve={q.curve}
            />
          </div>

          {/* Optional: PEL histogram */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" }}>
            <Histogram
              title="Histogram — Per-Event Loss (PEL)"
              subtitle="Distribution of loss size per event."
              values={q.pelSamples}
              bins={24}
            />
          </div>
        </>
      )}
    </div>
  );
}
