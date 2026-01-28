"use client";

import { useMemo, useState, useEffect } from "react";
import { emptyTiering, tierIndex } from "../../lib/model";
import { ensureQuant, runFairMonteCarlo } from "../../lib/fairEngine";

// -----------------------------
// small utils
// -----------------------------
function toNum(x) {
  if (x === null || x === undefined || x === "") return null;
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

function isFinitePos(n) {
  return Number.isFinite(n) && n >= 0;
}

function fmtPct(x) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function safeDiv(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

// -----------------------------
// LEF => human text (simple)
// -----------------------------
function lefToHuman(lefPerYear) {
  const lef = Number(lefPerYear);
  if (!Number.isFinite(lef) || lef <= 0) {
    return { lef, cadenceLabel: "—", probYear: null };
  }

  const intervalYears = 1 / lef;

  let cadenceLabel = "";
  if (intervalYears >= 1) {
    cadenceLabel = `≈ 1 fois tous les ${intervalYears.toFixed(intervalYears < 10 ? 1 : 0)} ans`;
  } else {
    cadenceLabel = `≈ ${lef.toFixed(lef < 10 ? 1 : 0)} fois par an`;
  }

  // Probabilité d'au moins un événement sur 1 an (Poisson)
  const probYear = 1 - Math.exp(-lef);

  return { lef, cadenceLabel, probYear };
}

// -----------------------------
// UI atoms
// -----------------------------
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

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />;
}

function DeltaPill({ label, base, what }) {
  const d = Number.isFinite(what) && Number.isFinite(base) ? what - base : null;
  const pct = d !== null ? safeDiv(d, base) : null;

  const tone =
    d === null
      ? "rgba(255,255,255,0.06)"
      : d < 0
      ? "rgba(34,197,94,0.16)"
      : d > 0
      ? "rgba(239,68,68,0.16)"
      : "rgba(255,255,255,0.06)";

  const br =
    d === null
      ? "rgba(255,255,255,0.14)"
      : d < 0
      ? "rgba(34,197,94,0.35)"
      : d > 0
      ? "rgba(239,68,68,0.35)"
      : "rgba(255,255,255,0.14)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${br}`,
        background: tone,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
      title="Δ = What-if - Baseline"
    >
      {label}: {d === null ? "—" : `${moneyEUR(d)} (${pct === null ? "—" : fmtPct(pct)})`}
    </span>
  );
}

// -----------------------------
// Scenario parsing + runs
// -----------------------------
function scenarioStatus(s) {
  const q = s?.quant || {};

  const hasInputs =
    q &&
    q.primaryLoss &&
    q.secondaryLossEventFrequency &&
    q.secondaryLossMagnitude &&
    (q.level === "LEF" || q.level === "TEF" || q.level === "Contact Frequency");

  // backward compat: old result fields OR new runs.baseline
  const hasOldResults = !!q?.stats?.ale && Array.isArray(q?.aleSamples) && q.aleSamples.length > 0;
  const hasBaselineRun = !!q?.runs?.baseline?.stats?.ale && Array.isArray(q?.runs?.baseline?.aleSamples);

  if (!hasInputs) return "Missing inputs";
  if (!hasOldResults && !hasBaselineRun) return "Missing results";
  return "Ready";
}

function getAleFromStats(stats) {
  const ale = stats?.ale;
  if (!ale) return null;
  return { p50: ale.ml, p90: ale.p90, p10: ale.p10, min: ale.min, max: ale.max };
}

function getScenarioAle(q, mode = "baseline") {
  if (!q) return null;

  // New model: quant.runs.baseline / quant.runs.whatif
  if (mode === "baseline") {
    const fromRun = getAleFromStats(q?.runs?.baseline?.stats);
    if (fromRun) return fromRun;
    return getAleFromStats(q?.stats);
  }

  const fromWhatIf = getAleFromStats(q?.runs?.whatif?.stats);
  return fromWhatIf || null;
}

function getScenarioLastRunAt(q, mode = "baseline") {
  if (!q) return "";
  if (mode === "baseline") return q?.runs?.baseline?.lastRunAt || q?.lastRunAt || "";
  return q?.runs?.whatif?.lastRunAt || "";
}

function scenarioToRow(v, s, effectiveTier, idx) {
  const status = scenarioStatus(s);

  const baseAle = getScenarioAle(s?.quant, "baseline");
  const whatAle = getScenarioAle(s?.quant, "whatif");

  return {
    vendorId: v.id,
    vendorName: v?.name?.trim() ? v.name : "(Unnamed vendor)",
    tier: effectiveTier,
    tierIndex: idx,

    scenarioId: s.id,
    scenarioTitle: s?.title?.trim() ? s.title : "(Untitled scenario)",
    status,

    // baseline
    aleP50: baseAle?.p50 ?? null,
    aleP90: baseAle?.p90 ?? null,
    lastRunAt: getScenarioLastRunAt(s?.quant, "baseline"),

    // what-if
    whatAleP50: whatAle?.p50 ?? null,
    whatAleP90: whatAle?.p90 ?? null,
    whatLastRunAt: getScenarioLastRunAt(s?.quant, "whatif"),

    // LEF (simple)
    lefML: toNum(s?.quant?.lef?.ml),
  };
}

// -----------------------------
// Controls (simple model)
// -----------------------------
function defaultControlSet() {
  // Multipliers < 1 reduce risk; > 1 increase risk (rare but allowed).
  return [
    {
      id: "mfa-sso",
      name: "MFA / SSO",
      enabled: true,
      effects: { freqMultiplier: 0.7 },
      hint: "Réduit la fréquence (LEF/TEF/CF) d'environ 30%",
    },
    {
      id: "edr-monitoring",
      name: "EDR + Monitoring",
      enabled: true,
      effects: { primaryLossMultiplier: 0.85 },
      hint: "Réduit une partie des pertes primaires (~15%)",
    },
    {
      id: "ir-retainer",
      name: "IR Retainer + Playbooks",
      enabled: false,
      effects: { secondaryLossMultiplier: 0.8 },
      hint: "Réduit les pertes secondaires (~20%)",
    },
  ];
}

function applyMultiplierToTriad(triad, m) {
  if (!triad || !Number.isFinite(m)) return triad;
  const out = { ...triad };
  for (const k of ["min", "ml", "max"]) {
    const v = toNum(triad?.[k]);
    if (v === null) continue;
    out[k] = v * m;
  }
  return out;
}

function applyControlsToQuant(baseQuant, controls) {
  const q = ensureQuant(baseQuant || {});
  const enabled = Array.isArray(controls) ? controls.filter((c) => c?.enabled) : [];

  // Aggregate multipliers
  let freqMultiplier = 1;
  let primaryLossMultiplier = 1;
  let secondaryLossMultiplier = 1;

  for (const c of enabled) {
    const e = c?.effects || {};
    if (Number.isFinite(e.freqMultiplier)) freqMultiplier *= e.freqMultiplier;
    if (Number.isFinite(e.primaryLossMultiplier)) primaryLossMultiplier *= e.primaryLossMultiplier;
    if (Number.isFinite(e.secondaryLossMultiplier)) secondaryLossMultiplier *= e.secondaryLossMultiplier;
  }

  const next = structuredClone(q);

  // Frequency knobs (simple, works for LEF / TEF / CF)
  // - if LEF exists => multiply it
  // - else if TEF exists => multiply it
  // - else if contactFrequency exists => multiply it (PoA left unchanged)
  if (next?.lef) next.lef = applyMultiplierToTriad(next.lef, freqMultiplier);
  else if (next?.tef) next.tef = applyMultiplierToTriad(next.tef, freqMultiplier);
  else if (next?.contactFrequency) next.contactFrequency = applyMultiplierToTriad(next.contactFrequency, freqMultiplier);

  // Loss magnitude knobs (simple)
  // q.primaryLoss (triad) — scale
  // q.secondaryLossMagnitude (triad) — scale
  if (next?.primaryLoss) next.primaryLoss = applyMultiplierToTriad(next.primaryLoss, primaryLossMultiplier);

  if (next?.secondaryLossMagnitude) {
    next.secondaryLossMagnitude = applyMultiplierToTriad(next.secondaryLossMagnitude, secondaryLossMultiplier);
  }

  // Tag
  next.whatif = {
    appliedAt: new Date().toISOString(),
    controlsApplied: enabled.map((c) => ({ id: c.id, name: c.name, effects: c.effects })),
    multipliers: { freqMultiplier, primaryLossMultiplier, secondaryLossMultiplier },
  };

  return next;
}

// -----------------------------
// Mini charts (sparklines)
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

  const padL = 8,
    padR = 8,
    padT = 6,
    padB = 10;
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
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>Mini curve: Exceedance (ALE)</div>

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

  const padL = 8,
    padR = 8,
    padT = 6,
    padB = 10;
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
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>Mini chart: Histogram (ALE)</div>

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
            return <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" opacity="0.65" rx="2" />;
          })}

          {hover ? <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke="currentColor" opacity="0.15" /> : null}
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
export default function DashboardView({
  vendors,
  setActiveView,
  selectVendor,
  selectScenario,
  updateVendor, // OPTIONAL but needed for portfolio apply/run persistence
}) {
  const [q, setQ] = useState("");
  const [showOnlyCarry, setShowOnlyCarry] = useState(false);
  const [onlyTier1, setOnlyTier1] = useState(false);
  const [onlyReadyScenarios, setOnlyReadyScenarios] = useState(false);
  const [sortBy, setSortBy] = useState("Worst ALE p90");
  const [sparkType, setSparkType] = useState("Exceedance"); // "Exceedance" | "Histogram"
  const [topN, setTopN] = useState(10);

  // Portfolio controls / what-if
  const [controls, setControls] = useState(() => defaultControlSet());
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const [applyScope, setApplyScope] = useState("Filtered vendors"); // All vendors | Filtered vendors | Tier 1 vendors | Selected vendors
  const [selectedVendorIds, setSelectedVendorIds] = useState(() => new Set());

  // Keep Set stable when vendors change (avoid dangling IDs)
  useEffect(() => {
    const ids = new Set((Array.isArray(vendors) ? vendors : []).map((v) => v?.id).filter(Boolean));
    setSelectedVendorIds((prev) => {
      const next = new Set();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next;
    });
  }, [vendors]);

  // Precompute “vendor cards” and “scenario rows” once
  const computed = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const needle = q.trim().toLowerCase();

    const tierRank = (tier) => (tier === "Tier 1" ? 1 : tier === "Tier 2" ? 2 : tier === "Tier 3" ? 3 : 99);

    const vendorCards = [];
    const scenarioRows = [];

    for (const v of list) {
      if (showOnlyCarry && !v?.carryForward) continue;

      const tObj = v?.tiering || emptyTiering();
      const idx = tierIndex(tObj);
      const suggested = suggestTierFromIndex(idx);
      const effectiveTier = (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;

      if (onlyTier1 && effectiveTier !== "Tier 1") continue;

      if (needle) {
        const ok =
          (v?.name || "").toLowerCase().includes(needle) ||
          (v?.category || "").toLowerCase().includes(needle) ||
          (v?.geography || "").toLowerCase().includes(needle);
        if (!ok) continue;
      }

      const allScs = Array.isArray(v?.scenarios) ? v.scenarios : [];
      const readyCount = allScs.filter((s) => scenarioStatus(s) === "Ready").length;

      if (onlyReadyScenarios && readyCount === 0) continue;

      // vendor “headline”: worst baseline p90
      let worst = null;
      for (const s of allScs) {
        const a = getScenarioAle(s?.quant, "baseline");
        if (a && Number.isFinite(a.p90)) {
          if (!worst || a.p90 > worst.p90) worst = { ...a, scenario: s };
        }
      }

      for (const s of allScs) {
        scenarioRows.push(scenarioToRow(v, s, effectiveTier, idx));
      }

      vendorCards.push({
        vendor: v,
        tierIndex: idx,
        suggested,
        effectiveTier,
        allScs,
        readyCount,
        worst,
        tierRank: tierRank(effectiveTier),
      });
    }

    const worstP90OfVendor = (card) => {
      const w = card?.worst;
      return w && Number.isFinite(w.p90) ? w.p90 : -1;
    };

    vendorCards.sort((a, b) => {
      if (sortBy === "Name") return String(a?.vendor?.name || "").localeCompare(String(b?.vendor?.name || ""));
      if (sortBy === "Most scenarios") return (b?.allScs?.length || 0) - (a?.allScs?.length || 0);
      if (sortBy === "Tier") return (a?.tierRank || 99) - (b?.tierRank || 99);
      return worstP90OfVendor(b) - worstP90OfVendor(a);
    });

    return { vendorCards, scenarioRows };
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

  const portfolio = useMemo(() => {
    const readyRows = computed.scenarioRows.filter((r) => r.status === "Ready" && isFinitePos(r.aleP90));
    const sorted = [...readyRows].sort((a, b) => (b.aleP90 ?? -1) - (a.aleP90 ?? -1));

    const worst = sorted[0] || null;
    const top = sorted.slice(0, Math.max(1, Math.min(50, Number(topN) || 10)));

    return { worst, top, readyCount: readyRows.length };
  }, [computed.scenarioRows, topN]);

  // --- Portfolio what-if table (baseline vs what-if) ---
  const portfolioWhatIf = useMemo(() => {
    const readyRows = computed.scenarioRows.filter((r) => r.status === "Ready" && isFinitePos(r.aleP90));
    const withWhat = readyRows.filter((r) => isFinitePos(r.whatAleP90));
    const sortedByDelta = [...withWhat].sort((a, b) => {
      const da = (a.whatAleP90 ?? 0) - (a.aleP90 ?? 0);
      const db = (b.whatAleP90 ?? 0) - (b.aleP90 ?? 0);
      // most negative first = best improvement
      return da - db;
    });
    return {
      countWithWhatIf: withWhat.length,
      topImprovers: sortedByDelta.slice(0, 10),
      worstBackfires: sortedByDelta.slice(-10).reverse(),
    };
  }, [computed.scenarioRows]);

  // -----------------------------
  // Targeting: which vendors to apply
  // -----------------------------
  const filteredVendorIds = useMemo(() => new Set(computed.vendorCards.map((c) => c.vendor?.id).filter(Boolean)), [computed.vendorCards]);

  const tier1VendorIds = useMemo(() => {
    const set = new Set();
    for (const c of computed.vendorCards) {
      if (c.effectiveTier === "Tier 1" && c.vendor?.id) set.add(c.vendor.id);
    }
    return set;
  }, [computed.vendorCards]);

  const targetVendorIds = useMemo(() => {
    if (applyScope === "All vendors") return new Set((Array.isArray(vendors) ? vendors : []).map((v) => v?.id).filter(Boolean));
    if (applyScope === "Tier 1 vendors") return new Set(tier1VendorIds);
    if (applyScope === "Selected vendors") return new Set(selectedVendorIds);
    return new Set(filteredVendorIds); // "Filtered vendors"
  }, [applyScope, vendors, tier1VendorIds, selectedVendorIds, filteredVendorIds]);

  // -----------------------------
  // Batch run baseline + what-if
  // -----------------------------
  const canPersist = typeof updateVendor === "function";

  const runPortfolioBaselineAndWhatIf = async () => {
    if (!canPersist) {
      setProgress("Missing prop: updateVendor (cannot persist runs from Dashboard).");
      setTimeout(() => setProgress(""), 1800);
      return;
    }

    const vendorList = Array.isArray(vendors) ? vendors : [];
    const enabledControls = controls.filter((c) => c.enabled);

    if (enabledControls.length === 0) {
      setProgress("No controls enabled (What-if would equal Baseline). Enable at least one control.");
      setTimeout(() => setProgress(""), 1800);
      return;
    }

    setRunning(true);
    setProgress("Preparing…");

    try {
      // Build worklist: scenarios for targeted vendors
      const work = [];
      for (const v of vendorList) {
        if (!v?.id || !targetVendorIds.has(v.id)) continue;
        const scs = Array.isArray(v?.scenarios) ? v.scenarios : [];

        for (const s of scs) {
          if (scenarioStatus(s) !== "Ready") continue;

          // Must have enough inputs to run
          const baseQuant = ensureQuant(s?.quant || {});
          work.push({ vendorId: v.id, vendor: v, scenario: s, baseQuant });
        }
      }

      if (work.length === 0) {
        setProgress("No ready scenarios found in the selected scope.");
        setTimeout(() => setProgress(""), 1800);
        return;
      }

      let done = 0;

      // Run sequentially (simpler + predictable); you can parallelize later if needed
      for (const item of work) {
        const { vendor, vendorId, scenario, baseQuant } = item;

        done++;
        setProgress(`Running ${done}/${work.length} — ${vendor?.name || "Vendor"} / ${scenario?.title || "Scenario"}`);

        // Baseline
        const baselineRes = await runFairMonteCarlo(baseQuant, {
          sims: baseQuant.sims,
          seed,
          curvePoints: Number(baseQuant?.curvePoints ?? 60),
          onProgress: () => {},
          yield: true,
        });

        // What-if
        const whatQuant = applyControlsToQuant(baseQuant, controls);
        const whatifRes = await runFairMonteCarlo(whatQuant, {
          sims: whatQuant.sims,
          seed, // SAME seed for fair comparison
          curvePoints: Number(whatQuant?.curvePoints ?? 60),
          onProgress: () => {},
          yield: true,
        });

        // Persist into vendor.scenarios
        const nextScenarios = (vendor.scenarios || []).map((s) => {
          if (s.id !== scenario.id) return s;

          const prevQ = ensureQuant(s?.quant || {});
          const nextQuant = {
            ...prevQ,

            // Backward compat: keep baseline in legacy fields
            sims: baselineRes.sims,
            lastRunAt: baselineRes.lastRunAt,
            stats: baselineRes.stats,
            aleSamples: baselineRes.aleSamples,
            pelSamples: baselineRes.pelSamples,
            curve: baselineRes.curve,

            // New: runs store baseline + what-if
            runs: {
              ...(prevQ.runs || {}),
              baseline: {
                seed,
                sims: baselineRes.sims,
                lastRunAt: baselineRes.lastRunAt,
                stats: baselineRes.stats,
                aleSamples: baselineRes.aleSamples,
                pelSamples: baselineRes.pelSamples,
                curve: baselineRes.curve,
              },
              whatif: {
                seed,
                sims: whatifRes.sims,
                lastRunAt: whatifRes.lastRunAt,
                stats: whatifRes.stats,
                aleSamples: whatifRes.aleSamples,
                pelSamples: whatifRes.pelSamples,
                curve: whatifRes.curve,
                controlsApplied: (whatQuant?.whatif?.controlsApplied || []).slice(0),
                multipliers: whatQuant?.whatif?.multipliers || null,
              },
            },
          };

          return { ...s, quant: nextQuant };
        });

        updateVendor(vendorId, { scenarios: nextScenarios });
      }

      setProgress(`Done. Ran baseline + what-if for ${work.length} scenario(s).`);
      setTimeout(() => setProgress(""), 1400);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setProgress(err?.message || "Batch simulation failed.");
    } finally {
      setRunning(false);
    }
  };

  // -----------------------------
  // Controls UI handlers
  // -----------------------------
  const toggleControl = (id) => {
    setControls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const setControlMultiplier = (id, key, value) => {
    const n = toNum(value);
    setControls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          effects: {
            ...(c.effects || {}),
            [key]: n === null ? 1 : Math.max(0, n),
          },
        };
      })
    );
  };

  const selectAllInScope = () => {
    setSelectedVendorIds(new Set(filteredVendorIds));
  };

  const clearSelected = () => {
    setSelectedVendorIds(new Set());
  };

  const toggleVendorSelected = (id) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Search / filters */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Dashboard</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Portfolio overview: tiers + worst scenarios + what-if controls (baseline vs what-if).
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>{totals.vendors} vendor(s)</Pill>
              <Pill>{totals.scenarios} scenario(s)</Pill>
              <Pill>{totals.ready} ready</Pill>
              <Pill>{totals.missing} missing</Pill>
            </div>

            {progress ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                Status: <strong>{progress}</strong>
              </div>
            ) : null}
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
                Tier 1 only
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                <input
                  type="checkbox"
                  checked={onlyReadyScenarios}
                  onChange={(e) => setOnlyReadyScenarios(e.target.checked)}
                />
                Only vendors with ready scenarios
              </label>

              <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option>Worst ALE p90</option>
                <option>Name</option>
                <option>Tier</option>
                <option>Most scenarios</option>
              </select>
            </div>

            {/* Sparkline selector */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Mini chart</div>
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

              <div style={{ marginLeft: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Portfolio top</div>
                <select className="input" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ✅ NEW: Controls impact (portfolio) */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Controls impact — Portfolio (baseline vs what-if)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82, lineHeight: 1.5 }}>
              This runs a <strong>baseline</strong> simulation, then a <strong>what-if</strong> simulation with controls applied,
              using the <strong>same seed</strong> for a fair comparison. Results are stored in{" "}
              <code style={{ fontSize: 12 }}>scenario.quant.runs.baseline/whatif</code>.
            </div>

            <Divider />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Pill>
                Seed: <strong>{seed}</strong>
              </Pill>
              <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} disabled={running}>
                New seed
              </button>

              <Pill>
                Target scope: <strong>{applyScope}</strong>
              </Pill>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input" value={applyScope} onChange={(e) => setApplyScope(e.target.value)}>
                <option>Filtered vendors</option>
                <option>All vendors</option>
                <option>Tier 1 vendors</option>
                <option>Selected vendors</option>
              </select>

              <Pill>
                Target vendors: <strong>{targetVendorIds.size}</strong>
              </Pill>

              <button className="btn" onClick={selectAllInScope} type="button">
                Select all (filtered)
              </button>
              <button className="btn" onClick={clearSelected} type="button">
                Clear selected
              </button>
            </div>

            {!canPersist ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, lineHeight: 1.45 }}>
                ⚠️ <strong>updateVendor</strong> prop not provided — this Dashboard cannot persist runs. Add{" "}
                <code style={{ fontSize: 12 }}>updateVendor</code> to enable portfolio simulations.
              </div>
            ) : null}
          </div>

          <div style={{ minWidth: 360, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 950 }}>Control set</div>
              <Pill>
                Enabled: <strong>{controls.filter((c) => c.enabled).length}</strong>
              </Pill>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {controls.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!c.enabled} onChange={() => toggleControl(c.id)} />
                      <span style={{ fontWeight: 950 }}>{c.name}</span>
                    </label>
                    <Pill>{c.enabled ? "Enabled" : "Disabled"}</Pill>
                  </div>

                  {c.hint ? <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>{c.hint}</div> : null}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: 12, opacity: 0.85 }}>
                      Freq multiplier
                      <input
                        className="input"
                        style={{ marginLeft: 8, width: 90 }}
                        defaultValue={c.effects?.freqMultiplier ?? 1}
                        onBlur={(e) => setControlMultiplier(c.id, "freqMultiplier", e.target.value)}
                      />
                    </label>

                    <label style={{ fontSize: 12, opacity: 0.85 }}>
                      Primary loss multiplier
                      <input
                        className="input"
                        style={{ marginLeft: 8, width: 90 }}
                        defaultValue={c.effects?.primaryLossMultiplier ?? 1}
                        onBlur={(e) => setControlMultiplier(c.id, "primaryLossMultiplier", e.target.value)}
                      />
                    </label>

                    <label style={{ fontSize: 12, opacity: 0.85 }}>
                      Secondary loss multiplier
                      <input
                        className="input"
                        style={{ marginLeft: 8, width: 90 }}
                        defaultValue={c.effects?.secondaryLossMultiplier ?? 1}
                        onBlur={(e) => setControlMultiplier(c.id, "secondaryLossMultiplier", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn primary" onClick={runPortfolioBaselineAndWhatIf} disabled={running || !canPersist}>
                {running ? "Running…" : "Run baseline + what-if (portfolio)"}
              </button>
            </div>
          </div>
        </div>

        <Divider />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Pill>
            What-if available: <strong>{portfolioWhatIf.countWithWhatIf}</strong> scenario(s)
          </Pill>
          <Pill>
            Top improvers shown: <strong>{portfolioWhatIf.topImprovers.length}</strong>
          </Pill>
          <Pill>
            Worst backfires shown: <strong>{portfolioWhatIf.worstBackfires.length}</strong>
          </Pill>
        </div>

        {(portfolioWhatIf.topImprovers.length || portfolioWhatIf.worstBackfires.length) ? (
          <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
            {portfolioWhatIf.topImprovers.length ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.9 }}>Best improvements (Δ ALE p90)</div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ opacity: 0.8 }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>Vendor</th>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>Scenario</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Baseline p90</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>What-if p90</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Δ</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioWhatIf.topImprovers.map((r) => {
                        const d = (r.whatAleP90 ?? 0) - (r.aleP90 ?? 0);
                        const pct = safeDiv(d, r.aleP90 ?? 0);
                        return (
                          <tr key={`imp_${r.vendorId}_${r.scenarioId}`} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td style={{ padding: "8px 6px" }}>{r.vendorName}</td>
                            <td style={{ padding: "8px 6px" }}>{r.scenarioTitle}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>{moneyEUR(r.aleP90)}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 950 }}>{moneyEUR(r.whatAleP90)}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>
                              <span style={{ fontWeight: 950 }}>{moneyEUR(d)}</span> ({pct === null ? "—" : fmtPct(pct)})
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>
                              <button
                                className="btn primary"
                                onClick={() => {
                                  selectVendor?.(r.vendorId);
                                  selectScenario?.(r.scenarioId);
                                  setActiveView?.("Results");
                                }}
                              >
                                Results →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {portfolioWhatIf.worstBackfires.length ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.9 }}>Worst backfires (Δ ALE p90)</div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ opacity: 0.8 }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>Vendor</th>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>Scenario</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Baseline p90</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>What-if p90</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Δ</th>
                        <th style={{ textAlign: "right", padding: "8px 6px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioWhatIf.worstBackfires.map((r) => {
                        const d = (r.whatAleP90 ?? 0) - (r.aleP90 ?? 0);
                        const pct = safeDiv(d, r.aleP90 ?? 0);
                        return (
                          <tr key={`bad_${r.vendorId}_${r.scenarioId}`} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td style={{ padding: "8px 6px" }}>{r.vendorName}</td>
                            <td style={{ padding: "8px 6px" }}>{r.scenarioTitle}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>{moneyEUR(r.aleP90)}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 950 }}>{moneyEUR(r.whatAleP90)}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>
                              <span style={{ fontWeight: 950 }}>{moneyEUR(d)}</span> ({pct === null ? "—" : fmtPct(pct)})
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "right" }}>
                              <button
                                className="btn"
                                onClick={() => {
                                  selectVendor?.(r.vendorId);
                                  selectScenario?.(r.scenarioId);
                                  setActiveView?.("Results");
                                }}
                              >
                                Results →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            No what-if results yet. Run the portfolio simulation above to populate baseline vs what-if.
          </div>
        )}
      </Card>

      {/* Portfolio - Max Scenario (baseline) */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Portfolio — Max scenario (worst baseline ALE p90)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Worst-case view across all vendors (baseline only; scenarios with results).
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>
                Ready scenarios: <strong>{portfolio.readyCount}</strong>
              </Pill>
              <Pill>
                Showing: <strong>{portfolio.top.length}</strong>
              </Pill>
            </div>
          </div>

          {portfolio.worst ? (
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <Pill>
                Worst baseline p90: <strong>{moneyEUR(portfolio.worst.aleP90)}</strong>
              </Pill>
              <div style={{ fontSize: 12, opacity: 0.8, textAlign: "right" }}>
                {portfolio.worst.vendorName} — {portfolio.worst.scenarioTitle}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  className="btn"
                  onClick={() => {
                    selectVendor?.(portfolio.worst.vendorId);
                    selectScenario?.(portfolio.worst.scenarioId);
                    setActiveView?.("Scenarios");
                  }}
                >
                  Open →
                </button>

                <button
                  className="btn"
                  onClick={() => {
                    selectVendor?.(portfolio.worst.vendorId);
                    selectScenario?.(portfolio.worst.scenarioId);
                    setActiveView?.("Quantify");
                  }}
                >
                  Quantify →
                </button>

                <button
                  className="btn primary"
                  onClick={() => {
                    selectVendor?.(portfolio.worst.vendorId);
                    selectScenario?.(portfolio.worst.scenarioId);
                    setActiveView?.("Results");
                  }}
                >
                  Results →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.8 }}>No ready scenarios with results yet.</div>
          )}
        </div>

        <Divider />

        {portfolio.top.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ opacity: 0.8 }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Vendor</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Tier</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Scenario</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Baseline ALE p50</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Baseline ALE p90</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>What-if ALE p90</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Δ p90</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Last run</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {portfolio.top.map((r) => {
                  const d = Number.isFinite(r.whatAleP90) && Number.isFinite(r.aleP90) ? r.whatAleP90 - r.aleP90 : null;
                  const pct = d !== null ? safeDiv(d, r.aleP90) : null;

                  return (
                    <tr key={r.vendorId + "_" + r.scenarioId} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "8px 6px" }}>{r.vendorName}</td>
                      <td style={{ padding: "8px 6px" }}>{r.tier}</td>
                      <td style={{ padding: "8px 6px" }}>{r.scenarioTitle}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{moneyEUR(r.aleP50)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 950 }}>{moneyEUR(r.aleP90)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{moneyEUR(r.whatAleP90)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        {d === null ? "—" : (
                          <>
                            <span style={{ fontWeight: 950 }}>{moneyEUR(d)}</span> ({pct === null ? "—" : fmtPct(pct)})
                          </>
                        )}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{fmtDate(r.lastRunAt)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        <button
                          className="btn"
                          onClick={() => {
                            selectVendor?.(r.vendorId);
                            selectScenario?.(r.scenarioId);
                            setActiveView?.("Scenarios");
                          }}
                        >
                          Open
                        </button>{" "}
                        <button
                          className="btn"
                          onClick={() => {
                            selectVendor?.(r.vendorId);
                            selectScenario?.(r.scenarioId);
                            setActiveView?.("Quantify");
                          }}
                        >
                          Quantify
                        </button>{" "}
                        <button
                          className="btn primary"
                          onClick={() => {
                            selectVendor?.(r.vendorId);
                            selectScenario?.(r.scenarioId);
                            setActiveView?.("Results");
                          }}
                        >
                          Results
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No scenarios with results yet.</div>
        )}
      </Card>

      {/* Vendor cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {computed.vendorCards.map((card) => {
          const v = card.vendor;
          const allScs = card.allScs;

          const scs = onlyReadyScenarios ? allScs.filter((s) => scenarioStatus(s) === "Ready") : allScs;

          const selected = selectedVendorIds.has(v.id);

          return (
            <Card key={v.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 18, fontWeight: 950, wordBreak: "break-word" }}>
                      {v?.name?.trim() ? v.name : "(Unnamed vendor)"}
                    </div>

                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.9 }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleVendorSelected(v.id)}
                        title="Select vendor (for 'Selected vendors' scope)"
                      />
                      Select
                    </label>
                  </div>

                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>{v?.category || "—"}</Pill>
                    <Pill>{v?.geography || "—"}</Pill>
                    <Pill>Dependency: {v?.dependencyLevel || "—"}</Pill>
                    {v?.carryForward ? <Pill>Carry-forward</Pill> : <Pill>Not carried</Pill>}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <TierBadge tier={card.effectiveTier} />
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Index: <strong>{card.tierIndex.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <Divider />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>
                  Scenarios: <strong>{allScs.length}</strong>
                </Pill>
                <Pill>
                  Ready: <strong>{card.readyCount}</strong>
                </Pill>
                <Pill>
                  Suggested: <strong>{card.suggested.tier}</strong>
                </Pill>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Risk spotlight</div>
                {card.worst ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13, opacity: 0.92 }}>
                    <div>
                      Worst scenario (by <strong>baseline ALE p90</strong>):{" "}
                      <strong>{card.worst.scenario?.title?.trim() ? card.worst.scenario.title : "(Untitled scenario)"}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Pill>Baseline p50: {moneyEUR(card.worst.p50)}</Pill>
                      <Pill>Baseline p90: {moneyEUR(card.worst.p90)}</Pill>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>p50 = “typical” annual loss; p90 = “high-end” annual loss.</div>
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
                    Show scenario details ({scs.length}
                    {onlyReadyScenarios ? " shown" : ""})
                  </summary>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {scs.map((s) => {
                      const st = scenarioStatus(s);

                      const baseAle = getScenarioAle(s?.quant, "baseline");
                      const whatAle = getScenarioAle(s?.quant, "whatif");

                      const lefML = toNum(s?.quant?.lef?.ml);
                      const lefH = lefToHuman(lefML);

                      const baseSamples = s?.quant?.runs?.baseline?.aleSamples || s?.quant?.aleSamples || [];
                      const whatSamples = s?.quant?.runs?.whatif?.aleSamples || [];

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
                            <div style={{ fontWeight: 950 }}>{s?.title?.trim() ? s.title : "(Untitled scenario)"}</div>
                            <StatusBadge status={st} />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Pill>Level: {s?.quant?.level || "—"}</Pill>
                            <Pill>Baseline run: {fmtDate(getScenarioLastRunAt(s?.quant, "baseline"))}</Pill>
                            <Pill>What-if run: {fmtDate(getScenarioLastRunAt(s?.quant, "whatif"))}</Pill>
                          </div>

                          {/* Simple LEF interpretation */}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill>
                              LEF (ML): <strong>{Number.isFinite(lefML) ? lefML.toFixed(2) : "—"}</strong> / an
                            </Pill>
                            <Pill>
                              Interprétation: <strong>{lefH.cadenceLabel || "—"}</strong>
                            </Pill>
                            <Pill>
                              Proba sur 1 an:{" "}
                              <strong>{Number.isFinite(lefH.probYear) ? (lefH.probYear * 100).toFixed(1) + "%" : "—"}</strong>
                            </Pill>
                          </div>

                          {/* Baseline + What-if numbers + deltas */}
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <Pill>
                                Baseline p50: <strong>{moneyEUR(baseAle?.p50)}</strong>
                              </Pill>
                              <Pill>
                                Baseline p90: <strong>{moneyEUR(baseAle?.p90)}</strong>
                              </Pill>
                              <Pill>
                                What-if p50: <strong>{moneyEUR(whatAle?.p50)}</strong>
                              </Pill>
                              <Pill>
                                What-if p90: <strong>{moneyEUR(whatAle?.p90)}</strong>
                              </Pill>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <DeltaPill label="Δ p50" base={baseAle?.p50} what={whatAle?.p50} />
                              <DeltaPill label="Δ p90" base={baseAle?.p90} what={whatAle?.p90} />
                            </div>
                          </div>

                          {/* Mini charts: baseline (always) + what-if (if available) */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              {Array.isArray(baseSamples) && baseSamples.length ? (
                                sparkType === "Histogram" ? (
                                  <SparklineHistogram values={baseSamples} />
                                ) : (
                                  <SparklineExceedance values={baseSamples} />
                                )
                              ) : (
                                <div style={{ fontSize: 12, opacity: 0.75 }}>No baseline samples yet.</div>
                              )}
                            </div>

                            <div>
                              {Array.isArray(whatSamples) && whatSamples.length ? (
                                sparkType === "Histogram" ? (
                                  <SparklineHistogram values={whatSamples} />
                                ) : (
                                  <SparklineExceedance values={whatSamples} />
                                )
                              ) : (
                                <div style={{ fontSize: 12, opacity: 0.75 }}>No what-if samples yet (run portfolio simulation).</div>
                              )}
                            </div>
                          </div>

                          {/* Navigation buttons */}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            <button
                              className="btn"
                              onClick={() => {
                                selectVendor?.(v.id);
                                selectScenario?.(s.id);
                                setActiveView?.("Scenarios");
                              }}
                            >
                              Open scenario →
                            </button>

                            <button
                              className="btn"
                              onClick={() => {
                                selectVendor?.(v.id);
                                selectScenario?.(s.id);
                                setActiveView?.("Quantify");
                              }}
                            >
                              Go to Quantify →
                            </button>

                            <button
                              className="btn primary"
                              onClick={() => {
                                selectVendor?.(v.id);
                                selectScenario?.(s.id);
                                setActiveView?.("Results");
                              }}
                            >
                              Go to Results →
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {scs.length === 0 ? <div style={{ fontSize: 13, opacity: 0.8 }}>No scenarios to show for this filter.</div> : null}
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
          This Dashboard now supports <strong>baseline vs what-if</strong> at portfolio scale. The controls apply simple multipliers
          to frequency and loss magnitude inputs, then re-run FAIR with the <strong>same seed</strong> to reduce noise. Results are
          stored as <code style={{ fontSize: 12 }}>quant.runs.baseline</code> and <code style={{ fontSize: 12 }}>quant.runs.whatif</code>.
        </div>
      </Card>
    </div>
  );
}
