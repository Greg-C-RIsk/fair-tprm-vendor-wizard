"use client";

import { useMemo, useState } from "react";
import { emptyTiering, tierIndex } from "../../lib/model";

// -----------------------------
// small utils
// -----------------------------
function toNum(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
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

// -----------------------------
// Scenario parsing
// -----------------------------
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

function scenarioToRow(v, s, effectiveTier, idx) {
  const status = scenarioStatus(s);
  const ale = getScenarioAle(s?.quant);

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

    // LEF (simple)
    lefML: toNum(s?.quant?.lef?.ml),
  };
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
            return <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" opacity="0.65" rx="2" />;
          })}

          {hover ? (
            <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke="currentColor" opacity="0.15" />
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
  const [sparkType, setSparkType] = useState("Exceedance"); // "Exceedance" | "Histogram"
  const [topN, setTopN] = useState(10);

  // Precompute “vendor cards” and “scenario rows” once (faster + cleaner)
  const computed = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const needle = q.trim().toLowerCase();

    const tierRank = (tier) => (tier === "Tier 1" ? 1 : tier === "Tier 2" ? 2 : tier === "Tier 3" ? 3 : 99);

    const vendorCards = [];
    const scenarioRows = [];

    for (const v of list) {
      // Search + filters (vendor-level)
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

      // vendor “headline”: worst p90
      let worst = null;
      for (const s of allScs) {
        const a = getScenarioAle(s?.quant);
        if (a && Number.isFinite(a.p90)) {
          if (!worst || a.p90 > worst.p90) worst = { ...a, scenario: s };
        }
      }

      // scenario rows for portfolio + scenario details
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

    // Sorting vendors
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

    return { vendorCards, scenarioRows, allVendorsCount: list.length };
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

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Search / filters */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Dashboard</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Portfolio overview: tiers + worst scenarios + quick drill-down.
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

      {/* Portfolio - Max Scenario */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Portfolio — Max scenario (worst ALE p90)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Worst-case view across all vendors (only scenarios with results).
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
                Worst p90: <strong>{moneyEUR(portfolio.worst.aleP90)}</strong>
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
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>ALE p50</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>ALE p90</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Last run</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {portfolio.top.map((r) => (
                  <tr key={r.vendorId + "_" + r.scenarioId} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px 6px" }}>{r.vendorName}</td>
                    <td style={{ padding: "8px 6px" }}>{r.tier}</td>
                    <td style={{ padding: "8px 6px" }}>{r.scenarioTitle}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>{moneyEUR(r.aleP50)}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 950 }}>{moneyEUR(r.aleP90)}</td>
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
                ))}
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
                      Worst scenario (by <strong>ALE p90</strong>):{" "}
                      <strong>{card.worst.scenario?.title?.trim() ? card.worst.scenario.title : "(Untitled scenario)"}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Pill>ALE p50: {moneyEUR(card.worst.p50)}</Pill>
                      <Pill>ALE p90: {moneyEUR(card.worst.p90)}</Pill>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      p50 = “typical” annual loss; p90 = “high-end” annual loss.
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
                    Show scenario details ({scs.length}
                    {onlyReadyScenarios ? " shown" : ""})
                  </summary>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {scs.map((s) => {
                      const st = scenarioStatus(s);
                      const ale = getScenarioAle(s?.quant);

                      const lefML = toNum(s?.quant?.lef?.ml);
                      const lefH = lefToHuman(lefML);

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
                            <Pill>Last run: {fmtDate(s?.quant?.lastRunAt)}</Pill>
                          </div>

                          {/* ✅ Simple LEF message (no chain) */}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill>
                              LEF (ML): <strong>{Number.isFinite(lefML) ? lefML.toFixed(2) :
                                                        <Pill>
                              LEF (ML): <strong>{Number.isFinite(lefML) ? lefML.toFixed(2) : "—"}</strong> / an
                            </Pill>
                            <Pill>
                              Interprétation: <strong>{lefH.cadenceLabel || "—"}</strong>
                            </Pill>
                            <Pill>
                              Proba sur 1 an:{" "}
                              <strong>
                                {Number.isFinite(lefH.probYear) ? (lefH.probYear * 100).toFixed(1) + "%" : "—"}
                              </strong>
                            </Pill>
                          </div>

                          {ale ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Pill>ALE p10: {moneyEUR(ale.p10)}</Pill>
                              <Pill>ALE p50: {moneyEUR(ale.p50)}</Pill>
                              <Pill>ALE p90: {moneyEUR(ale.p90)}</Pill>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.75 }}>No ALE stats yet (run simulation first).</div>
                          )}

                          {/* Mini chart */}
                          {Array.isArray(s?.quant?.aleSamples) && s.quant.aleSamples.length ? (
                            sparkType === "Histogram" ? (
                              <SparklineHistogram values={s.quant.aleSamples} />
                            ) : (
                              <SparklineExceedance values={s.quant.aleSamples} />
                            )
                          ) : null}

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
          The mini charts visualize the annual loss distribution (ALE) per scenario. Use <strong>Exceedance</strong> to see
          “P(Loss &gt; x)” or <strong>Histogram</strong> to see how simulations cluster into ranges. The LEF block gives a simple
          interpretation (cadence + probability over 1 year).
        </div>
      </Card>
    </div>
  );
}
