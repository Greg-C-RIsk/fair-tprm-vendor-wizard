"use client";

import { useMemo, useState } from "react";
import { emptyTiering, tierIndex } from "../../lib/model";
import { deriveSusceptibility as deriveSuscEngine } from "../../lib/fairEngine";

function toNum(x) {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function moneyEUR(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function suggestTierFromIndex(idx) {
  if (idx <= 50) return { tier: "Tier 3", label: "Low criticality / exposure" };
  if (idx <= 250) return { tier: "Tier 2", label: "Medium criticality / exposure" };
  return { tier: "Tier 1", label: "High criticality / exposure" };
}

function TierBadge({ tier }) {
  const t = String(tier || "").trim();
  const styleByTier =
    t === "Tier 1"
      ? { background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)" }
      : t === "Tier 2"
      ? { background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)" }
      : { background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        ...styleByTier,
      }}
    >
      {t || "Tier —"}
    </span>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 12,
        opacity: 0.95,
        whiteSpace: "nowrap",
        gap: 6,
      }}
    >
      {children}
    </span>
  );
}

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

function StatusBadge({ status }) {
  const s = status || "Unknown";
  const styleBy =
    s === "Ready"
      ? { background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.35)" }
      : s === "Missing results"
      ? { background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.35)" }
      : { background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.35)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        ...styleBy,
      }}
    >
      {s}
    </span>
  );
}

function scenarioStatus(s) {
  const q = s?.quant || {};
  const hasInputs =
    q &&
    q.primaryLoss &&
    q.secondaryLossEventFrequency &&
    q.secondaryLossMagnitude &&
    (q.level === "LEF" || q.level === "TEF" || q.level === "Contact Frequency");

  const hasResults = !!q?.stats?.ale && Array.isArray(q?.aleSamples) && q.aleSamples.length > 0;

  if (!hasInputs) return "Missing inputs";
  if (!hasResults) return "Missing results";
  return "Ready";
}

function getScenarioAle(q) {
  const ale = q?.stats?.ale;
  if (!ale) return null;
  return { p50: ale.ml, p90: ale.p90, p10: ale.p10, min: ale.min, max: ale.max };
}

function scenarioToRow(v, s) {
  const status = scenarioStatus(s);
  const ale = getScenarioAle(s?.quant);
  const tieringObj = v?.tiering || emptyTiering();
  const idx = tierIndex(tieringObj);
  const suggested = suggestTierFromIndex(idx);
  const effectiveTier = (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;

  return {
    vendorId: v.id,
    vendorName: v?.name?.trim() ? v.name : "(Unnamed vendor)",
    tier: effectiveTier,
    tierIndex: idx,

    scenarioId: s.id,
    scenarioTitle: s?.title?.trim() ? s.title : "(Untitled scenario)",
    status,

    aleP50: ale?.p50 ?? null,
    aleP90: ale?.p90 ?? null,
    lastRunAt: s?.quant?.lastRunAt || "",
  };
}

function isFinitePos(n) {
  return Number.isFinite(n) && n >= 0;
}

// -----------------------------
// FAIR summary (TEF / Susc / LEF)
// -----------------------------
function interpretPoa(x) {
  // In FAIR engine, PoA is treated as % (0..100), but your UI sometimes labels 0..1.
  // We support both:
  // - if value <= 1 -> treat as 0..1
  // - if value > 1 -> treat as percent -> /100
  if (x === null) return null;
  if (x <= 1) return clamp01(x);
  return clamp01(x / 100);
}

function interpretSusc(x) {
  // Support both 0..1 and 0..100
  if (x === null) return null;
  if (x <= 1) return clamp01(x);
  return clamp01(x / 100);
}

function fairSummaryFromQuant(q) {
  const level = q?.level || "LEF";

  const lefML = toNum(q?.lef?.ml);
  const tefML_direct = toNum(q?.tef?.ml);

  const cfML = toNum(q?.contactFrequency?.ml);
  const poaML_raw = toNum(q?.probabilityOfAction?.ml);
  const poaML = interpretPoa(poaML_raw);

  const tcML = toNum(q?.threatCapacity?.ml);
  const rsML = toNum(q?.resistanceStrength?.ml);

  const suscMode = q?.susceptibilityMode || "Direct";
  const suscDirectML = interpretSusc(toNum(q?.susceptibility?.ml));

  let tefML = null;
  let suscML = null;
  let lefCalcML = null;

  if (level === "LEF") {
    tefML = null;
    suscML = null;
    lefCalcML = lefML;
  } else if (level === "TEF") {
    tefML = tefML_direct;

    if (suscMode === "Direct") {
      suscML = suscDirectML;
    } else {
      if (tcML !== null && rsML !== null) {
        suscML = clamp01(deriveSuscEngine(tcML, rsML));
      }
    }

    if (tefML !== null && suscML !== null) lefCalcML = tefML * suscML;
  } else if (level === "Contact Frequency") {
    if (cfML !== null && poaML !== null) tefML = cfML * poaML;

    if (suscMode === "Direct") {
      suscML = suscDirectML;
    } else {
      if (tcML !== null && rsML !== null) {
        suscML = clamp01(deriveSuscEngine(tcML, rsML));
      }
    }

    if (tefML !== null && suscML !== null) lefCalcML = tefML * suscML;
  }

  return { level, tefML, suscML, lefCalcML };
}

function fmtRate(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtProb(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

// -----------------------------
// Sparkline types
// -----------------------------
function SparklineExceedance({ values, width = 240, height = 54 }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    if (!Array.isArray(values) || values.length < 20) return null;
    const sorted = [...values].sort((a, b) => a - b);

    const points = 36;
    const pts = [];
    for (let i = 0; i < points; i++) {
      const q = i / (points - 1);
      const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
      const x = sorted[idx];
      const exceed = 1 - q;
      pts.push({ x, exceed });
    }

    return { pts, minX: pts[0].x, maxX: pts[pts.length - 1].x };
  }, [values]);

  if (!data) return null;

  const padL = 8, padR = 8, padT = 6, padB = 10;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);

  const mapX = (x) => {
    const span = Math.max(1e-9, data.maxX - data.minX);
    return padL + ((x - data.minX) / span) * innerW;
  };

  const mapY = (exceed) => padT + (1 - exceed) * innerH;

  const d = data.pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x).toFixed(2)} ${mapY(p.exceed).toFixed(2)}`)
    .join(" ");

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const t = Math.max(0, Math.min(1, (xPx - padL) / Math.max(1, innerW)));
    const i = Math.round(t * (data.pts.length - 1));
    const p = data.pts[Math.max(0, Math.min(data.pts.length - 1, i))];

    setHover({ x: mapX(p.x), y: mapY(p.exceed), loss: p.x, exceed: p.exceed });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>
        Mini curve: Exceedance (ALE)
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 8, position: "relative" }}>
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: "block", cursor: "crosshair" }}
        >
          <path
            d={`M ${padL} ${padT} L ${padL} ${height - padB} L ${width - padR} ${height - padB}`}
            stroke="currentColor"
            opacity="0.20"
            fill="none"
          />
          <path d={d} stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />

          {hover ? (
            <>
              <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke="currentColor" opacity="0.15" />
              <circle cx={hover.x} cy={hover.y} r="3.5" fill="currentColor" opacity="0.95" />
            </>
          ) : null}
        </svg>

        {hover ? (
          <div
            style={{
              position: "absolute",
              left: Math.min(Math.max(0, hover.x), width - 1),
              top: 0,
              transform: "translate(-50%, -6px)",
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 10,
              padding: "6px 8px",
              fontSize: 12,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>{moneyEUR(hover.loss)}</div>
            <div style={{ opacity: 0.85 }}>P(Loss &gt; x): {(hover.exceed * 100).toFixed(1)}%</div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, opacity: 0.7 }}>
          <span>{moneyEUR(data.minX)}</span>
          <span>{moneyEUR(data.maxX)}</span>
        </div>
      </div>
    </div>
  );
}

function SparklineHistogram({ values, width = 240, height = 54 }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    if (!Array.isArray(values) || values.length < 20) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = 16;
    const span = Math.max(1e-9, max - min);

    const counts = Array.from({ length: bins }, () => 0);
    for (const v of values) {
      const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
      counts[i]++;
    }
    const peak = Math.max(...counts);
    return { min, max, bins, counts, peak, total: values.length };
  }, [values]);

  if (!data) return null;

  const padL = 8, padR = 8, padT = 6, padB = 10;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const barW = innerW / data.bins;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const i = Math.max(0, Math.min(data.bins - 1, Math.floor((xPx - padL) / Math.max(1, barW))));
    const lo = data.min + (i / data.bins) * (data.max - data.min);
    const hi = data.min + ((i + 1) / data.bins) * (data.max - data.min);
    const c = data.counts[i] || 0;

    setHover({
      i,
      x: padL + i * barW + barW / 2,
      count: c,
      lo,
      hi,
      pct: (c / Math.max(1, data.total)) * 100,
    });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>
        Mini chart: Histogram (ALE)
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 8, position: "relative" }}>
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: "block", cursor: "crosshair" }}
        >
          <path
            d={`M ${padL} ${padT} L ${padL} ${height - padB} L ${width - padR} ${height - padB}`}
            stroke="currentColor"
            opacity="0.20"
            fill="none"
          />

          {data.counts.map((c, i) => {
            const h = (c / Math.max(1, data.peak)) * innerH;
            const x = padL + i * barW + 1;
            const y = padT + (innerH - h);
            const w = Math.max(1, barW - 2);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="currentColor"
                opacity="0.65"
                rx="2"
              />
            );
          })}

          {hover ? (
            <>
              <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke="currentColor" opacity="0.15" />
            </>
          ) : null}
        </svg>

        {hover ? (
          <div
            style={{
              position: "absolute",
              left: Math.min(Math.max(0, hover.x), width - 1),
              top: 0,
              transform: "translate(-50%, -6px)",
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 10,
              padding: "6px 8px",
              fontSize: 12,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>
              {moneyEUR(hover.lo)} → {moneyEUR(hover.hi)}
            </div>
            <div style={{ opacity: 0.85 }}>
              {hover.count} samples ({hover.pct.toFixed(1)}%)
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, opacity: 0.7 }}>
          <span>{moneyEUR(data.min)}</span>
          <span>{moneyEUR(data.max)}</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Main
// -----------------------------
export default function DashboardView({ vendors, setActiveView, selectVendor, selectScenario }) {
  const [q, setQ] = useState("");
  const [showOnlyCarry, setShowOnlyCarry] = useState(false);

  const [onlyTier1, setOnlyTier1] = useState(false);
  const [onlyReadyScenarios, setOnlyReadyScenarios] = useState(false);

  const [sortBy, setSortBy] = useState("Worst ALE p90");

  // ✅ NEW: sparkline toggle
  const [sparkType, setSparkType] = useState("Exceedance"); // "Exceedance" | "Histogram"

  const rows = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const needle = q.trim().toLowerCase();

    const effectiveTierOf = (v) => {
      const idx = tierIndex(v?.tiering || emptyTiering());
      const suggested = suggestTierFromIndex(idx);
      return (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;
    };

    let out = list.filter((v) => {
      if (showOnlyCarry && !v?.carryForward) return false;
      if (onlyTier1 && effectiveTierOf(v) !== "Tier 1") return false;

      if (needle) {
        const ok =
          (v?.name || "").toLowerCase().includes(needle) ||
          (v?.category || "").toLowerCase().includes(needle) ||
          (v?.geography || "").toLowerCase().includes(needle);
        if (!ok) return false;
      }

      if (onlyReadyScenarios) {
        const scs = Array.isArray(v?.scenarios) ? v.scenarios : [];
        return scs.some((s) => scenarioStatus(s) === "Ready");
      }

      return true;
    });

    const tierRank = (tier) => (tier === "Tier 1" ? 1 : tier === "Tier 2" ? 2 : tier === "Tier 3" ? 3 : 99);

    const worstP90 = (v) => {
      const scs = Array.isArray(v?.scenarios) ? v.scenarios : [];
      let best = -Infinity;
      for (const s of scs) {
        const a = getScenarioAle(s?.quant);
        if (a && Number.isFinite(a.p90)) best = Math.max(best, a.p90);
      }
      return best === -Infinity ? -1 : best;
    };

    out = out.sort((a, b) => {
      if (sortBy === "Name") return String(a?.name || "").localeCompare(String(b?.name || ""));
      if (sortBy === "Most scenarios") return (b?.scenarios || []).length - (a?.scenarios || []).length;
      if (sortBy === "Tier") {
        const ia = tierRank(effectiveTierOf(a));
        const ib = tierRank(effectiveTierOf(b));
        return ia - ib;
      }
      return worstP90(b) - worstP90(a);
    });

    return out;
  }, [vendors, q, showOnlyCarry, onlyTier1, onlyReadyScenarios, sortBy]);

  const totals = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    let scenarios = 0;
    let ready = 0;
    let missing = 0;

    for (const v of list) {
      const scs = Array.isArray(v?.scenarios) ? v.scenarios : [];
      scenarios += scs.length;
      for (const s of scs) {
        const st = scenarioStatus(s);
        if (st === "Ready") ready++;
        else missing++;
      }
    }
    return { vendors: list.length, scenarios, ready, missing };
  }, [vendors]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Dashboard</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Portfolio overview: tiering + FAIR scenario outputs (training-friendly).
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>{totals.vendors} vendor(s)</Pill>
              <Pill>{totals.scenarios} scenario(s)</Pill>
              <Pill>{totals.ready} ready</Pill>
              <Pill>{totals.missing} missing</Pill>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, minWidth: 420 }}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vendors (name, category, geography)…"
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                <input type="checkbox" checked={showOnlyCarry} onChange={(e) => setShowOnlyCarry(e.target.checked)} />
                Carry-forward only
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                <input type="checkbox" checked={onlyTier1} onChange={(e) => setOnlyTier1(e.target.checked)} />
                Show only Tier 1 vendors
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                <input
                  type="checkbox"
                  checked={onlyReadyScenarios}
                  onChange={(e) => setOnlyReadyScenarios(e.target.checked)}
                />
                Only ready scenarios
              </label>

              <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option>Worst ALE p90</option>
                <option>Name</option>
                <option>Tier</option>
                <option>Most scenarios</option>
              </select>
            </div>

            {/* ✅ NEW: Sparkline type toggle */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Sparkline type</div>
              <button
                className={sparkType === "Exceedance" ? "btn primary" : "btn"}
                onClick={() => setSparkType("Exceedance")}
                type="button"
              >
                Exceedance
              </button>
              <button
                className={sparkType === "Histogram" ? "btn primary" : "btn"}
                onClick={() => setSparkType("Histogram")}
                type="button"
              >
                Histogram
              </button>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                (Shown per scenario)
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {rows.map((v) => {
          const tObj = v?.tiering || emptyTiering();
          const idx = tierIndex(tObj);
          const suggested = suggestTierFromIndex(idx);
          const effectiveTier = (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;

          const allScs = Array.isArray(v?.scenarios) ? v.scenarios : [];
          const scs = onlyReadyScenarios ? allScs.filter((s) => scenarioStatus(s) === "Ready") : allScs;
          const readyCount = allScs.filter((s) => scenarioStatus(s) === "Ready").length;

          // Vendor “headline”: worst p90
          let worst = null;
          for (const s of allScs) {
            const a = getScenarioAle(s?.quant);
            if (a && Number.isFinite(a.p90)) {
              if (!worst || a.p90 > worst.p90) worst = { ...a, scenario: s };
            }
          }

          return (
            <Card key={v.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, wordBreak: "break-word" }}>
                    {v?.name?.trim() ? v.name : "(Unnamed vendor)"}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>{v?.category || "—"}</Pill>
                    <Pill>{v?.geography || "—"}</Pill>
                    <Pill>Dependency: {v?.dependencyLevel || "—"}</Pill>
                    {v?.carryForward ? <Pill>Carry-forward</Pill> : <Pill>Not carried</Pill>}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <TierBadge tier={effectiveTier} />
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Index: <strong>{idx.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>Scenarios: <strong>{allScs.length}</strong></Pill>
                <Pill>Ready: <strong>{readyCount}</strong></Pill>
                <Pill>Suggested: <strong>{suggested.tier}</strong></Pill>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Risk spotlight (training)</div>
                {worst ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13, opacity: 0.92 }}>
                    <div>
                      Worst scenario (by <strong>ALE p90</strong>):{" "}
                      <strong>{worst.scenario?.title?.trim() ? worst.scenario.title : "(Untitled scenario)"}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Pill>ALE p50: {moneyEUR(worst.p50)}</Pill>
                      <Pill>ALE p90: {moneyEUR(worst.p90)}</Pill>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      p50 = “typical” annual loss; p90 = “high-end” annual loss (90% of years are below this).
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    No simulation results found yet. Run a simulation in <strong>Quantify</strong> or <strong>Results</strong>.
                  </div>
                )}
              </div>

              {/* Scenario list */}
              <div style={{ marginTop: 12 }}>
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 13, opacity: 0.9 }}>
                    Show scenario details ({scs.length}{onlyReadyScenarios ? " shown" : ""})
                  </summary>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {scs.map((s) => {
                      const st = scenarioStatus(s);
                      const ale = getScenarioAle(s?.quant);
                      const fair = fairSummaryFromQuant(s?.quant || {});

                      return (
                        <div
                          key={s.id}
                          style={{
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 14,
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950 }}>
                              {s?.title?.trim() ? s.title : "(Untitled scenario)"}
                            </div>
                            <StatusBadge status={st} />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Pill>Level: {s?.quant?.level || "—"}</Pill>
                            <Pill>Last run: {fmtDate(s?.quant?.lastRunAt)}</Pill>
                          </div>

                          {/* ✅ NEW: FAIR calculated summary */}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill>TEF (calc, ML): <strong>{fair.tefML === null ? "—" : fmtRate(fair.tefML)}</strong></Pill>
                            <Pill>Susceptibility (calc, ML): <strong>{fair.suscML === null ? "—" : fmtProb(fair.suscML)}</strong></Pill>
                            <Pill>LEF (calc, ML): <strong>{fair.lefCalcML === null ? "—" : fmtRate(fair.lefCalcML)}</strong></Pill>
                          </div>

                          {ale ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Pill>ALE p10: {moneyEUR(ale.p10)}</Pill>
                              <Pill>ALE p50: {moneyEUR(ale.p50)}</Pill>
                              <Pill>ALE p90: {moneyEUR(ale.p90)}</Pill>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              No ALE stats yet (run simulation first).
                            </div>
                          )}

                          {/* ✅ NEW: Sparkline type switch */}
                          {Array.isArray(s?.quant?.aleSamples) && s.quant.aleSamples.length ? (
                            sparkType === "Histogram" ? (
                              <SparklineHistogram values={s.quant.aleSamples} />
                            ) : (
                              <SparklineExceedance values={s.quant.aleSamples} />
                            )
                          ) : null}

                          {/* Navigation buttons */}
                          {(setActiveView || selectVendor || selectScenario) ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (selectVendor) selectVendor(v.id);
                                  if (selectScenario) selectScenario(s.id);
                                  if (setActiveView) setActiveView("Scenarios");
                                }}
                              >
                                Open scenario →
                              </button>

                              <button
                                className="btn"
                                onClick={() => {
                                  if (selectVendor) selectVendor(v.id);
                                  if (selectScenario) selectScenario(s.id);
                                  if (setActiveView) setActiveView("Quantify");
                                }}
                              >
                                Go to Quantify →
                              </button>

                              <button
                                className="btn primary"
                                onClick={() => {
                                  if (selectVendor) selectVendor(v.id);
                                  if (selectScenario) selectScenario(s.id);
                                  if (setActiveView) setActiveView("Results");
                                }}
                              >
                                Go to Results →
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {scs.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.8 }}>No scenarios to show for this filter.</div>
                    ) : null}
                  </div>
                </details>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Teaching note</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
          The sparklines visualize the annual loss distribution (ALE) per scenario. Use <strong>Exceedance</strong> to see
          “P(Loss &gt; x)” or <strong>Histogram</strong> to see how simulations cluster into ranges. The FAIR summary shows the
          calculated TEF / Susceptibility / LEF (ML) so learners can connect results back to the FAIR frequency taxonomy.
        </div>
      </Card>
    </div>
  );
}
