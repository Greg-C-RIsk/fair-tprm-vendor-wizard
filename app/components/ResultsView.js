"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ensureQuant } from "../../lib/fairEngine";
import {
  runFairCamMonteCarlo,
  getScenarioControls,
  getBaselineControls,
  getWhatIfControls,
} from "../../lib/fairCamEngine";

/**
 * ResultsView — FAIR-CAM
 * Baseline (Implemented controls) vs What-If (Implemented + includeInWhatIf)
 * Monte Carlo + deltas (P50/P90/ALE etc.)
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
  return `${(x * 100).toFixed(1)}%`;
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
              P(Annual Loss &gt; x): <strong>{pct(hover.exceed)}</strong>
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

function deltaAbs(a, b) {
  // delta = b - a
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return b - a;
}

function deltaPctReduction(base, whatIf) {
  // reduction% positive when whatIf < base
  if (!Number.isFinite(base) || !Number.isFinite(whatIf)) return null;
  if (base === 0) return null;
  return (base - whatIf) / base;
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

  const allControls = useMemo(() => getScenarioControls(scenario), [scenario]);
  const baselineControls = useMemo(() => getBaselineControls(allControls), [allControls]);
  const whatIfControls = useMemo(() => getWhatIfControls(allControls), [allControls]);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // Results stored in scenario.camResults
  const camResults = scenario.camResults || null;

  const runBaselineVsWhatIf = async () => {
    setRunning(true);
    setProgress("Starting…");

    try {
      const baseQuant = ensureQuant(q);

      setProgress("Running baseline (Implemented controls) …");
      const baseline = await runFairCamMonteCarlo(baseQuant, baselineControls, {
        sims: baseQuant.sims,
        seed,
        onProgress: ({ label }) => setProgress(label || ""),
        yield: true,
      });

      setProgress("Running what-if (Implemented + simulated) …");
      const whatIf = await runFairCamMonteCarlo(baseQuant, whatIfControls, {
        sims: baseQuant.sims,
        seed, // same seed => more stable deltas
        onProgress: ({ label }) => setProgress(label || ""),
        yield: true,
      });

      const nextCamResults = {
        lastRunAt: new Date().toISOString(),
        seed,
        baseline: {
          ...baseline,
          controlCount: baselineControls.length,
        },
        whatIf: {
          ...whatIf,
          controlCount: whatIfControls.length,
        },
      };

      // persist into scenario
      const nextScenarios = (vendor.scenarios || []).map((s) =>
        s.id === scenario.id ? { ...s, camResults: nextCamResults } : s
      );
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

  const hasCam = !!camResults?.baseline?.stats && !!camResults?.whatIf?.stats;

  const deltas = useMemo(() => {
    if (!hasCam) return null;

    const b = camResults.baseline.stats;
    const w = camResults.whatIf.stats;

    const d = {
      ale: {
        p10: deltaAbs(b.ale.p10, w.ale.p10),
        p50: deltaAbs(b.ale.ml, w.ale.ml),
        p90: deltaAbs(b.ale.p90, w.ale.p90),
        redP50: deltaPctReduction(b.ale.ml, w.ale.ml),
        redP90: deltaPctReduction(b.ale.p90, w.ale.p90),
      },
      pel: {
        p10: deltaAbs(b.pel.p10, w.pel.p10),
        p50: deltaAbs(b.pel.ml, w.pel.ml),
        p90: deltaAbs(b.pel.p90, w.pel.p90),
        redP50: deltaPctReduction(b.pel.ml, w.pel.ml),
        redP90: deltaPctReduction(b.pel.p90, w.pel.p90),
      },
      chain: {
        tef: deltaAbs(camResults.baseline.chain?.avgTEF, camResults.whatIf.chain?.avgTEF),
        lef: deltaAbs(camResults.baseline.chain?.avgLEF, camResults.whatIf.chain?.avgLEF),
        susc: deltaAbs(camResults.baseline.chain?.avgSusceptibility, camResults.whatIf.chain?.avgSusceptibility),
      },
    };

    return d;
  }, [hasCam, camResults]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 980 }}>Results — Baseline vs What-If (FAIR-CAM)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
              Baseline uses <strong>Implemented</strong> controls only. What-If uses Implemented + Proposed/Planned controls
              marked <strong>Include in What-If</strong>. This supports decision-making without “pretending” controls are implemented.
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="neutral">Baseline controls: {baselineControls.length}</Badge>
              <Badge tone="neutral">What-If controls: {whatIfControls.length}</Badge>
              {camResults?.lastRunAt ? <Badge tone="blue">Last run: {new Date(camResults.lastRunAt).toLocaleString()}</Badge> : null}
              <Badge tone="neutral">Sims: {Number(q.sims || 10000).toLocaleString()}</Badge>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={() => setActiveView?.("Treatments")}>
              Back to Treatments
            </button>
            <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} disabled={running}>
              New seed
            </button>
            <button className="btn primary" onClick={runBaselineVsWhatIf} disabled={running}>
              {running ? "Running…" : "Run Baseline vs What-If"}
            </button>
          </div>
        </div>

               {progress ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Status: <strong>{progress}</strong>
          </div>
        ) : null}

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Seed (for comparability): <strong>{seed}</strong>
        </div>
      </Card>

      {!hasCam ? (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>No FAIR-CAM results yet</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
            Click <strong>Run Baseline vs What-If</strong>. If you get an error, check missing inputs in{" "}
            <strong>Quantify</strong>. Also ensure you have at least one <strong>Implemented</strong> control (baseline)
            or at least one control flagged <strong>Include in What-If</strong>.
          </div>
        </Card>
      ) : (
        <>
          {/* Summary: ALE baseline vs what-if */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>ALE — Baseline</div>
                <Badge tone="neutral">{camResults.baseline.controlCount} control(s)</Badge>
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(camResults.baseline.stats.ale.p10)} />
                <StatLine label="P50" value={money(camResults.baseline.stats.ale.ml)} />
                <StatLine label="P90" value={money(camResults.baseline.stats.ale.p90)} />
              </div>

              <Divider />

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Chain averages (per sim year):{" "}
                <strong>{camResults.baseline.chain?.avgTEF?.toFixed?.(2) ?? "—"}</strong> TEF,{" "}
                <strong>{camResults.baseline.chain?.avgSusceptibility?.toFixed?.(3) ?? "—"}</strong> Susc,{" "}
                <strong>{camResults.baseline.chain?.avgLEF?.toFixed?.(2) ?? "—"}</strong> LEF
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>ALE — What-If</div>
                <Badge tone="neutral">{camResults.whatIf.controlCount} control(s)</Badge>
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(camResults.whatIf.stats.ale.p10)} />
                <StatLine label="P50" value={money(camResults.whatIf.stats.ale.ml)} />
                <StatLine label="P90" value={money(camResults.whatIf.stats.ale.p90)} />
              </div>

              <Divider />

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Chain averages (per sim year):{" "}
                <strong>{camResults.whatIf.chain?.avgTEF?.toFixed?.(2) ?? "—"}</strong> TEF,{" "}
                <strong>{camResults.whatIf.chain?.avgSusceptibility?.toFixed?.(3) ?? "—"}</strong> Susc,{" "}
                <strong>{camResults.whatIf.chain?.avgLEF?.toFixed?.(2) ?? "—"}</strong> LEF
              </div>
            </Card>
          </div>

          {/* Summary: PEL baseline vs what-if */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>PEL — Baseline</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(camResults.baseline.stats.pel.p10)} />
                <StatLine label="P50" value={money(camResults.baseline.stats.pel.ml)} />
                <StatLine label="P90" value={money(camResults.baseline.stats.pel.p90)} />
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>PEL — What-If</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <StatLine label="P10" value={money(camResults.whatIf.stats.pel.p10)} />
                <StatLine label="P50" value={money(camResults.whatIf.stats.pel.ml)} />
                <StatLine label="P90" value={money(camResults.whatIf.stats.pel.p90)} />
              </div>
            </Card>
          </div>

          {/* Deltas */}
          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Delta (What-If − Baseline)</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              Negative € deltas are good (risk reduction). “Reduction %” is relative to baseline (positive = improvement).
            </div>

            <Divider />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>ALE deltas</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <StatLine
                    label="Δ P50"
                    value={money(deltas.ale.p50)}
                    help={deltas.ale.redP50 === null ? null : `Reduction: ${pct(deltas.ale.redP50)}`}
                  />
                  <StatLine
                    label="Δ P90"
                    value={money(deltas.ale.p90)}
                    help={deltas.ale.redP90 === null ? null : `Reduction: ${pct(deltas.ale.redP90)}`}
                  />
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>PEL deltas</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <StatLine
                    label="Δ P50"
                    value={money(deltas.pel.p50)}
                    help={deltas.pel.redP50 === null ? null : `Reduction: ${pct(deltas.pel.redP50)}`}
                  />
                  <StatLine
                    label="Δ P90"
                    value={money(deltas.pel.p90)}
                    help={deltas.pel.redP90 === null ? null : `Reduction: ${pct(deltas.pel.redP90)}`}
                  />
                </div>
              </Card>
            </div>

            <Divider />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Avg TEF (delta)</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {Number.isFinite(deltas.chain.tef) ? deltas.chain.tef.toFixed(3) : "—"} / year
                </div>
              </Card>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Avg Susceptibility (delta)</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {Number.isFinite(deltas.chain.susc) ? deltas.chain.susc.toFixed(4) : "—"}
                </div>
              </Card>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Avg LEF (delta)</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {Number.isFinite(deltas.chain.lef) ? deltas.chain.lef.toFixed(3) : "—"} / year
                </div>
              </Card>
            </div>
          </Card>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <Histogram
              title="Annual Loss — Baseline"
              subtitle="Distribution of annual loss (Implemented controls only)."
              values={camResults.baseline.aleSamples}
            />
            <Histogram
              title="Annual Loss — What-If"
              subtitle="Distribution of annual loss (Implemented + simulated controls)."
              values={camResults.whatIf.aleSamples}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <ExceedanceCurve
              title="Exceedance — Baseline"
              subtitle="P(Annual Loss > x) with Implemented controls."
              curve={camResults.baseline.curve}
            />
            <ExceedanceCurve
              title="Exceedance — What-If"
              subtitle="P(Annual Loss > x) with Implemented + simulated controls."
              curve={camResults.whatIf.curve}
            />
          </div>
        </>
      )}
    </div>
  );
}
