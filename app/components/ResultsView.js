"use client";

import { useMemo, useRef, useState } from "react";
import { ensureQuant, runFairMonteCarlo } from "../../lib/fairEngine";

/**
 * ResultsView (Pedagogical)
 * - Uses scenario.quant (FAIR inputs + Monte Carlo outputs)
 * - Can re-run the simulation here
 * - Writes results back into scenario.quant (so Dashboard etc. can reuse)
 * - Interactive charts (hover tooltips)
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

const fmt = (n, digits = 2) => {
  if (!Number.isFinite(n)) return "—";
  return Number(n).toFixed(digits);
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

function StatLine({ label, value, help }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 850 }}>{label}</div>
        <div style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>
      </div>
      {help ? (
        <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>{help}</div>
      ) : null}
    </div>
  );
}

function Hint({ children }) {
  return (
    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
      {children}
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

    return { min, max, span, counts, peak, total, binEdges };
  }, [values, bins]);

  if (!model) return null;

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, opacity: 0.8 }}>{subtitle}</div> : null}
      </div>

      <div style={{ marginTop: 12, position: "relative" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 140 }}>
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
                aria-label={`Bin ${i}`}
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
              maxWidth: 280,
            }}
          >
            <div style={{ fontWeight: 900 }}>Annual loss bin</div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Range: {money(hover.from)} → {money(hover.to)}
            </div>
            <div style={{ opacity: 0.9 }}>
              Simulations in bin: {hover.count.toLocaleString()} ({pct(hover.prob)})
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        X-axis: annual loss amount • Y-axis: relative frequency (how often the simulation landed in that range)
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
  const ys = pts.map((p) => p.exceed);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = 1;

  // SVG frame
  const W = 560;
  const H = 180;
  const padL = 50;
  const padR = 20;
  const padT = 18;
  const padB = 34;

  const mapX = (x) => padL + ((x - minX) / Math.max(1e-9, maxX - minX)) * (W - padL - padR);
  const mapY = (y) => padT + (1 - (y - minY) / Math.max(1e-9, maxY - minY)) * (H - padT - padB);

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x).toFixed(2)} ${mapY(p.exceed).toFixed(2)}`)
    .join(" ");

  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;

    // Convert mouse X back to domain X, then find nearest point by X
    const t = (mx - padL) / Math.max(1e-9, (W - padL - padR));
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
              <line
                x1={mapX(hover.x)}
                y1={padT}
                x2={mapX(hover.x)}
                y2={H - padB}
                stroke="currentColor"
                opacity="0.12"
              />
              <line
                x1={padL}
                y1={mapY(hover.exceed)}
                x2={W - padR}
                y2={mapY(hover.exceed)}
                stroke="currentColor"
                opacity="0.12"
              />
            </>
          ) : null}
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
              maxWidth: 320,
            }}
          >
            <div style={{ fontWeight: 900 }}>Point details</div>
            <div style={{ marginTop: 6, opacity: 0.92 }}>
              Loss threshold (x): <strong>{money(hover.x)}</strong>
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
        The exceedance curve answers: “How likely is it to exceed a given annual loss amount?”
      </div>
    </Card>
  );
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

  // Prefer the most recent persisted quant results
  const q = useMemo(() => ensureQuant(localQuant), [localQuant]);

  const hasOutputs = !!q.stats && Array.isArray(q.aleSamples) && q.aleSamples.length > 0;

  const run = async () => {
    setRunning(true);
    setProgress("Starting…");
    try {
      const base = ensureQuant(q);

      const out = await runFairMonteCarlo(base, {
        sims: base.sims,
        onProgress: ({ done, total, label }) => {
          setProgress(label || `${done}/${total}`);
        },
        yield: true,
      });

      const merged = ensureQuant({ ...base, ...out });

      // Update local UI immediately
      setLocalQuant(merged);

      // Persist into the scenario so Dashboard can reuse it
      const nextScenarios = (vendor.scenarios || []).map((s) =>
        s.id === scenario.id ? { ...s, quant: merged } : s
      );
      updateVendor(vendor.id, { scenarios: nextScenarios });

      setProgress("Done.");
      setTimeout(() => setProgress(""), 900);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const msg =
        err?.missing?.length
          ? `Missing inputs: ${err.missing.join(", ")}`
          : err?.message || "Simulation failed.";
      setProgress(msg);
    } finally {
      setRunning(false);
    }
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
              This page explains what the Monte Carlo simulation produced and how to interpret it.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={() => setActiveView?.("Quantify")}>
              Back to Quantify
            </button>
            <button className="btn primary" onClick={run} disabled={running}>
              {running ? "Running…" : "Run Monte Carlo"}
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

      {/* Pedagogical explanation */}
      <Card>
        <div style={{ fontSize: 16, fontWeight: 950 }}>What are you looking at?</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <Hint>
            <strong>Monte Carlo simulation</strong> runs the FAIR model thousands of times. Each run samples your
            <strong> min / most-likely / max</strong> inputs (triangular distributions), then computes a possible
            annual outcome. The collection of outcomes becomes a distribution.
          </Hint>
          <Hint>
            <strong>ALE</strong> (Annualized Loss Exposure) is the simulated <strong>annual loss</strong>.
            <strong> PEL</strong> (Per-Event Loss) is the simulated loss for <strong>one loss event</strong>.
          </Hint>
          <Hint>
            Percentiles are key: <strong>P10</strong> means “10% of simulated years are below this value”.
            <strong> P90</strong> means “90% are below this value” (or 10% are above it).
          </Hint>
        </div>
      </Card>

      {/* Summary stats */}
      {!hasOutputs ? (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>No results yet</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
            Click <strong>Run Monte Carlo</strong> to generate results. If you get an error, it usually means some
            inputs are missing or not numeric.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>ALE (Annualized Loss Exposure)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <StatLine
                label="P10"
                value={money(s.ale.p10)}
                help="10% of simulated years are at or below this annual loss."
              />
              <StatLine
                label="P50 (median)"
                value={money(s.ale.ml)}
                help="The middle outcome: half of the simulated years are below, half are above."
              />
              <StatLine
                label="P90"
                value={money(s.ale.p90)}
                help="90% of simulated years are at or below this annual loss (10% exceed it)."
              />
              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "6px 0" }} />
              <StatLine label="~Min (P01)" value={money(s.ale.min)} help="A low-end tail estimate (1st percentile)." />
              <StatLine label="~Max (P99)" value={money(s.ale.max)} help="A high-end tail estimate (99th percentile)." />
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>PEL (Per-Event Loss)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <StatLine
                label="P10"
                value={money(s.pel.p10)}
                help="10% of loss events are at or below this per-event loss."
              />
              <StatLine
                label="P50 (median)"
                value={money(s.pel.ml)}
                help="Typical per-event loss (median)."
              />
              <StatLine
                label="P90"
                value={money(s.pel.p90)}
                help="Higher-end per-event loss (90th percentile)."
              />
              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "6px 0" }} />
              <StatLine label="~Min (P01)" value={money(s.pel.min)} help="Low-end tail estimate (1st percentile)." />
              <StatLine label="~Max (P99)" value={money(s.pel.max)} help="High-end tail estimate (99th percentile)." />
            </div>
          </Card>
        </div>
      )}

      {/* Charts */}
      {hasOutputs ? (
        <div style={{ display: "grid", gap: 14 }}>
          <Histogram
            title="Annual Loss Distribution (Histogram)"
            subtitle="Hover a bar to see the loss range and how often it occurred in the simulation."
            values={q.aleSamples}
          />

          <ExceedanceCurve
            title="Loss Exceedance Curve"
            subtitle="Hover the curve to see the probability of exceeding a given annual loss threshold."
            curve={q.curve}
          />

          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>How to interpret these results</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <Hint>
                If you need a <strong>typical planning number</strong>, use <strong>P50</strong> (median).
              </Hint>
              <Hint>
                If you need a <strong>risk-averse / stress</strong> number (e.g., for buffers), look at <strong>P90</strong>
                or the exceedance curve at your chosen threshold.
              </Hint>
              <Hint>
                The shape of the histogram shows uncertainty: a wide spread means your inputs allow very different outcomes.
                Tighten inputs (better evidence) to reduce uncertainty.
              </Hint>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
