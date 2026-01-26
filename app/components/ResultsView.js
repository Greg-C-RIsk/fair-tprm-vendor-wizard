"use client";

import { useMemo, useRef, useState } from "react";
import { ensureQuant, runFairMonteCarlo } from "../../lib/fairEngine";

/**
 * ResultsView (Pedagogical)
 * - Re-runs Monte Carlo using fairEngine (same engine as Quantify)
 * - Interactive charts (hover tooltips)
 * - Adds learning callouts: Definition / Why it matters / Common mistakes
 * - Adds CSV download
 * - Displays derived (ML) TEF / Susceptibility / LEF to link back to FAIR taxonomy
 */

const money = (n) => {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

const pct = (x) => {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
};

const numOrNull = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Same idea as fairEngine deriveSusceptibility (sigmoid mapping)
const deriveSusceptibilityML = (tc, rs, softness = 2) => {
  const a = numOrNull(tc);
  const b = numOrNull(rs);
  if (a === null || b === null) return null;
  const z = (a - b) / Math.max(1e-9, softness);
  const s = 1 / (1 + Math.exp(-z));
  return clamp01(s);
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

function Callout({ kind = "definition", title, children }) {
  const meta =
    kind === "definition"
      ? { badge: "Definition", border: "rgba(59,130,246,0.35)", bg: "rgba(59,130,246,0.08)" }
      : kind === "why"
      ? { badge: "Why it matters", border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.08)" }
      : { badge: "Common mistakes", border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.08)" };

  return (
    <div
      style={{
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <span
          style={{
            fontSize: 12,
            opacity: 0.9,
            border: "1px solid rgba(255,255,255,0.14)",
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.20)",
            whiteSpace: "nowrap",
          }}
        >
          {meta.badge}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>{children}</div>
    </div>
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

/** Histogram with hover tooltip (Annual Loss) */
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
                onMouseEnter={() =>
                  setHover({
                    i,
                    from,
                    to,
                    count: c,
                    prob: c / model.total,
                  })
                }
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
            <div style={{ fontWeight: 900 }}>Annual loss bin</div>
            <div style={{ marginTop: 6, opacity: 0.92 }}>
              Range: {money(hover.from)} → {money(hover.to)}
            </div>
            <div style={{ opacity: 0.92 }}>
              In this bin: {hover.count.toLocaleString()} sims ({pct(hover.prob)})
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        X-axis: annual loss amount • Y-axis: how often the simulation landed in that range
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
          {/* axes */}
          <path
            d={`M ${padL} ${padT} L ${padL} ${H - padB} L ${W - padR} ${H - padB}`}
            stroke="currentColor"
            opacity="0.18"
            fill="none"
          />

          {/* curve */}
          <path d={d} stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.95" />

          {/* hover marker */}
          {hover ? (
            <>
              <circle cx={mapX(hover.x)} cy={mapY(hover.exceed)} r="4.5" fill="currentColor" />
              <line x1={mapX(hover.x)} y1={padT} x2={mapX(hover.x)} y2={H - padB} stroke="currentColor" opacity="0.12" />
              <line x1={padL} y1={mapY(hover.exceed)} x2={W - padR} y2={mapY(hover.exceed)} stroke="currentColor" opacity="0.12" />
            </>
          ) : null}

          {/* axis labels (simple) */}
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
              P(Annual Loss &gt; x): <strong>{pct(hover.exceed)}</strong>
            </div>
            <div style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.3 }}>
              Interpretation: in {pct(hover.exceed)} of simulated years, annual loss exceeds {money(hover.x)}.
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        This curve answers: “How likely is it to exceed a given annual loss amount?”
      </div>
    </Card>
  );
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export default function ResultsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>FAIR Results</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>No vendor/scenario selected.</div>
      </Card>
    );
  }

  const quantFromScenario = ensureQuant(scenario.quant || {});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [localQuant, setLocalQuant] = useState(quantFromScenario);

  const q = useMemo(() => ensureQuant(localQuant), [localQuant]);
  const hasOutputs = !!q.stats && Array.isArray(q.aleSamples) && q.aleSamples.length > 0;

  // --- Derived FAIR linkage (Most-Likely guidance)
  const derived = useMemo(() => {
    const level = q.level || "LEF";

    // TEF(ML)
    let tefML = null;
    if (level === "TEF") {
      tefML = numOrNull(q.tef?.ml);
    }
    if (level === "Contact Frequency") {
      const cf = numOrNull(q.contactFrequency?.ml);
      const poaPct = numOrNull(q.probabilityOfAction?.ml);
      if (cf !== null && poaPct !== null) tefML = cf * clamp01(poaPct / 100);
    }

    // Susceptibility(ML) as probability 0..1
    let suscML = null;
    if (level !== "LEF") {
      if ((q.susceptibilityMode || "Direct") === "Direct") {
        const sPct = numOrNull(q.susceptibility?.ml);
        if (sPct !== null) suscML = clamp01(sPct / 100);
      } else {
        // FromCapacityVsResistance (or "Derived" by older UI naming)
        const tc = numOrNull(q.threatCapacity?.ml);
        const rs = numOrNull(q.resistanceStrength?.ml);
        suscML = deriveSusceptibilityML(tc, rs, 2);
      }
    }

    // LEF(ML)
    let lefML = null;
    if (level === "LEF") {
      lefML = numOrNull(q.lef?.ml);
    } else if (tefML !== null && suscML !== null) {
      lefML = tefML * suscML;
    }

    // Small “unit mistake” detection (pedagogical)
    const poaML = numOrNull(q.probabilityOfAction?.ml);
    const suscInputML = numOrNull(q.susceptibility?.ml);

    const likelyUnitMistake =
      level !== "LEF" &&
      ((poaML !== null && poaML > 0 && poaML <= 1) ||
        (suscInputML !== null && suscInputML > 0 && suscInputML <= 1));

    return { level, tefML, suscML, lefML, likelyUnitMistake };
  }, [q]);

  const run = async () => {
    setRunning(true);
    setProgress("Starting…");
    try {
      const base = ensureQuant(q);
      const out = await runFairMonteCarlo(base, {
        sims: base.sims,
        onProgress: ({ label }) => setProgress(label || ""),
        yield: true,
      });

      const merged = ensureQuant({ ...base, ...out });

      setLocalQuant(merged);

      // Persist into scenario so Dashboard can reuse it
      const nextScenarios = (vendor.scenarios || []).map((s) => (s.id === scenario.id ? { ...s, quant: merged } : s));
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

  const downloadCSV = () => {
    if (!hasOutputs) return;

    const rows = [];
    rows.push(["type", "a", "b"].map(csvEscape).join(","));

    // Summary
    rows.push(["SUMMARY", "level", q.level || ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "sims", q.sims ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "lastRunAt", q.lastRunAt || ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "TEF_ML", derived.tefML ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "Susceptibility_ML(0..1)", derived.suscML ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "LEF_ML", derived.lefML ?? ""].map(csvEscape).join(","));

    // ALE stats
    rows.push(["SUMMARY", "ALE_P10", q.stats?.ale?.p10 ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "ALE_P50", q.stats?.ale?.ml ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "ALE_P90", q.stats?.ale?.p90 ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "ALE_P01", q.stats?.ale?.min ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "ALE_P99", q.stats?.ale?.max ?? ""].map(csvEscape).join(","));

    // PEL stats
    rows.push(["SUMMARY", "PEL_P10", q.stats?.pel?.p10 ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "PEL_P50", q.stats?.pel?.ml ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "PEL_P90", q.stats?.pel?.p90 ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "PEL_P01", q.stats?.pel?.min ?? ""].map(csvEscape).join(","));
    rows.push(["SUMMARY", "PEL_P99", q.stats?.pel?.max ?? ""].map(csvEscape).join(","));

    // Samples
    (q.aleSamples || []).forEach((v, i) => rows.push(["ALE", i, v].map(csvEscape).join(",")));
    (q.pelSamples || []).forEach((v, i) => rows.push(["PEL", i, v].map(csvEscape).join(",")));

    // Curve points
    (q.curve?.pts || []).forEach((p) => rows.push(["CURVE", p.x, p.exceed].map(csvEscape).join(",")));

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `fair-results-${scenario.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const s = q.stats;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 980 }}>FAIR Results</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              A pedagogical view to understand what the Monte Carlo simulation produced and how to interpret it.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={() => setActiveView?.("Quantify")}>
              Back to Quantify
            </button>
            <button className="btn primary" onClick={run} disabled={running}>
              {running ? "Running…" : "Run Monte Carlo"}
            </button>
            <button className="btn" onClick={downloadCSV} disabled={!hasOutputs}>
              Download results (CSV)
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Simulations: <strong>{Number(q.sims || 10000).toLocaleString()}</strong>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Last run: <strong>{q.lastRunAt ? new Date(q.lastRunAt).toLocaleString() : "—"}</strong>
          </div>
          {progress ? (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Status: <strong>{progress}</strong>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Learning callouts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "start" }}>
        <Callout kind="definition" title="What is Monte Carlo in FAIR?">
          You provide uncertainty ranges (min / most-likely / max). The tool samples those ranges thousands of times to
          generate many plausible annual outcomes. The result is a distribution, not a single “correct” number.
        </Callout>

        <Callout kind="why" title="Why does this matter?">
          Risk decisions often need confidence. Percentiles (P10/P50/P90) help you pick a conservative or typical number,
          depending on your use-case (planning vs. stress testing).
        </Callout>

        <Callout kind="mistakes" title="Common mistakes (very important)">
          FAIR Engine treats <strong>Probability of Action</strong> and <strong>Susceptibility</strong> as <strong>percent values</strong>.
          Example: enter <strong>30</strong> for 30% (not 0.30).
          {derived.likelyUnitMistake ? (
            <>
              <br />
              <br />
              <strong>Heads-up:</strong> some of your Most-Likely values look like proportions (0–1). This can make LEF ~0
              and produce many €0 annual loss years.
            </>
          ) : null}
        </Callout>
      </div>

      {/* FAIR linkage: TEF / Susceptibility / LEF */}
      <Card>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Link back to FAIR taxonomy (Most-Likely guidance)</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
          These values are derived from your <strong>Most-Likely</strong> inputs to help you understand the causal chain:
          <strong> TEF → Susceptibility → LEF</strong>.
        </div>

        <Divider />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Card style={{ padding: 12 }}>
            <div style={{ fontWeight: 950 }}>TEF (Most-Likely)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              {derived.tefML === null ? "—" : `${fmt(derived.tefML, 2)} / year`}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Threat Event Frequency. If you selected Contact Frequency level: TEF = CF × PoA.
            </div>
          </Card>

          <Card style={{ padding: 12 }}>
            <div style={{ fontWeight: 950 }}>Susceptibility (Most-Likely)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              {derived.suscML === null ? "—" : pct(derived.suscML)}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Probability that a threat event becomes a loss event (often modeled as P(TC &gt; RS)).
            </div>
          </Card>

          <Card style={{ padding: 12 }}>
            <div style={{ fontWeight: 950 }}>LEF (Most-Likely)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              {derived.lefML === null ? "—" : `${fmt(derived.lefML, 2)} / year`}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Loss Event Frequency. If level is TEF/CF: LEF = TEF × Susceptibility.
            </div>
          </Card>
        </div>
      </Card>

      {/* Summary stats + charts */}
      {!hasOutputs ? (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>No results yet</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
            Click <strong>Run Monte Carlo</strong> to generate results. If you get an error, some inputs are missing or not numeric.
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>ALE (Annualized Loss Exposure)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(s.ale.p10)} help="10% of simulated years are at or below this annual loss." />
                <StatLine label="P50 (median)" value={money(s.ale.ml)} help="Half the simulated years are below, half are above." />
                <StatLine label="P90" value={money(s.ale.p90)} help="90% of simulated years are at or below this annual loss (10% exceed it)." />
                <Divider />
                <StatLine label="~Min (P01)" value={money(s.ale.min)} help="A low-end tail estimate (1st percentile)." />
                <StatLine label="~Max (P99)" value={money(s.ale.max)} help="A high-end tail estimate (99th percentile)." />
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>PEL (Per-Event Loss)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(s.pel.p10)} help="10% of loss events are at or below this per-event loss." />
                <StatLine label="P50 (median)" value={money(s.pel.ml)} help="Typical per-event loss (median)." />
                <StatLine label="P90" value={money(s.pel.p90)} help="Higher-end per-event loss (90th percentile)." />
                <Divider />
                <StatLine label="~Min (P01)" value={money(s.pel.min)} help="Low-end tail estimate (1st percentile)." />
                <StatLine label="~Max (P99)" value={money(s.pel.max)} help="High-end tail estimate (99th percentile)." />
              </div>
            </Card>
          </div>

          <Histogram
            title="Annual Loss Distribution (Histogram)"
            subtitle="Hover a bar to see the annual loss range and how often it occurred."
            values={q.aleSamples}
          />

          <ExceedanceCurve
            title="Loss Exceedance Curve"
            subtitle="Hover the curve to see P(Annual Loss > threshold)."
            curve={q.curve}
          />

          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>How to use these numbers (quick guide)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
              <div>
                • Use <strong>P50</strong> as a “typical” planning number.
              </div>
              <div>
                • Use <strong>P90</strong> if you want a more conservative / stress-test number.
              </div>
              <div>
                • Use the <strong>exceedance curve</strong> to answer: “What’s the probability we exceed €X per year?”
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
