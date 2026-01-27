"use client";

import { useMemo, useState } from "react";
import { emptyTiering, tierIndex } from "../../lib/model";

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
  return {
    p50: ale.ml,
    p90: ale.p90,
    p10: ale.p10,
    min: ale.min,
    max: ale.max,
  };
}

/**
 * Mini sparkline for ALE samples (exceedance curve style).
 * - X axis = loss (EUR)
 * - Y axis = exceedance probability (P(Loss > x))
 * Hover shows exact (approx) value.
 */
function Sparkline({ values, width = 240, height = 54 }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    if (!Array.isArray(values) || values.length < 20) return null;
    const sorted = [...values].sort((a, b) => a - b);

    // downsample using quantiles (keeps shape)
    const points = 36;
    const pts = [];
    for (let i = 0; i < points; i++) {
      const q = i / (points - 1);
      const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
      const x = sorted[idx];
      const exceed = 1 - q; // exceedance curve
      pts.push({ x, exceed });
    }

    const minX = pts[0].x;
    const maxX = pts[pts.length - 1].x;
    return { pts, minX, maxX };
  }, [values]);

  if (!data) return null;

  const padL = 8;
  const padR = 8;
  const padT = 6;
  const padB = 10;

  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);

  const mapX = (x) => {
    const span = Math.max(1e-9, data.maxX - data.minX);
    return padL + ((x - data.minX) / span) * innerW;
  };

  const mapY = (exceed) => {
    return padT + (1 - exceed) * innerH; // exceed=1 => top ; exceed=0 => bottom
  };

  const d = data.pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x).toFixed(2)} ${mapY(p.exceed).toFixed(2)}`)
    .join(" ");

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;

    const t = Math.max(0, Math.min(1, (xPx - padL) / Math.max(1, innerW)));
    const i = Math.round(t * (data.pts.length - 1));
    const p = data.pts[Math.max(0, Math.min(data.pts.length - 1, i))];

    setHover({
      x: mapX(p.x),
      y: mapY(p.exceed),
      loss: p.x,
      exceed: p.exceed,
    });
  };

  const onLeave = () => setHover(null);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>
        Mini exceedance curve (ALE)
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: 8,
          position: "relative",
        }}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ display: "block", cursor: "crosshair" }}
        >
          {/* axes */}
          <path
            d={`M ${padL} ${padT} L ${padL} ${height - padB} L ${width - padR} ${height - padB}`}
            stroke="currentColor"
            opacity="0.20"
            fill="none"
          />

          {/* curve */}
          <path d={d} stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />

          {/* hover dot */}
          {hover ? (
            <>
              <line
                x1={hover.x}
                y1={padT}
                x2={hover.x}
                y2={height - padB}
                stroke="currentColor"
                opacity="0.15"
              />
              <circle cx={hover.x} cy={hover.y} r="3.5" fill="currentColor" opacity="0.95" />
            </>
          ) : null}
        </svg>

        {/* hover tooltip */}
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
            <div style={{ opacity: 0.85 }}>
              P(Loss &gt; x): {(hover.exceed * 100).toFixed(1)}%
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, opacity: 0.7 }}>
          <span>{moneyEUR(data.minX)}</span>
          <span>{moneyEUR(data.maxX)}</span>
        </div>

        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          This shows the shape of the annual loss distribution: as x increases, exceedance probability decreases.
        </div>
      </div>
    </div>
  );
}

export default function DashboardView({ vendors, setActiveView, selectVendor, selectScenario }) {
  const [q, setQ] = useState("");
  const [showOnlyCarry, setShowOnlyCarry] = useState(false);

  // ✅ NEW filters
  const [onlyTier1, setOnlyTier1] = useState(false);
  const [onlyReadyScenarios, setOnlyReadyScenarios] = useState(false);

  const [sortBy, setSortBy] = useState("Worst ALE p90");

  const rows = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const needle = q.trim().toLowerCase();

    // helper for effective tier
    const effectiveTierOf = (v) => {
      const idx = tierIndex(v?.tiering || emptyTiering());
      const suggested = suggestTierFromIndex(idx);
      return (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;
    };

    let out = list.filter((v) => {
      if (showOnlyCarry && !v?.carryForward) return false;

      // ✅ Filter: only Tier 1 vendors
      if (onlyTier1 && effectiveTierOf(v) !== "Tier 1") return false;

      // search
      if (needle) {
        const ok =
          (v?.name || "").toLowerCase().includes(needle) ||
          (v?.category || "").toLowerCase().includes(needle) ||
          (v?.geography || "").toLowerCase().includes(needle);
        if (!ok) return false;
      }

      // ✅ Filter: only vendors with at least 1 READY scenario
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
              Portfolio overview: tiering + FAIR scenario results (training-friendly).
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>{totals.vendors} vendor(s)</Pill>
              <Pill>{totals.scenarios} scenario(s)</Pill>
              <Pill>{totals.ready} ready</Pill>
              <Pill>{totals.missing} missing</Pill>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, minWidth: 360 }}>
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

              {/* ✅ NEW filters */}
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
                <Pill>
                  Scenarios: <strong>{allScs.length}</strong>
                </Pill>
                <Pill>
                  Ready: <strong>{readyCount}</strong>
                </Pill>
                <Pill>
                  Suggested: <strong>{suggested.tier}</strong>
                </Pill>
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

                          {/* ✅ NEW: sparkline per scenario */}
                          {Array.isArray(s?.quant?.aleSamples) && s.quant.aleSamples.length ? (
                            <Sparkline values={s.quant.aleSamples} />
                          ) : null}

                          {/* Optional navigation buttons */}
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
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        No scenarios to show for this filter.
                      </div>
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
          The mini sparkline is an exceedance curve preview for annual loss exposure (ALE). Hover to see approximate values.
          Use filters to focus on Tier 1 vendors and scenarios that are fully “Ready” (inputs + simulation results).
        </div>
      </Card>
    </div>
  );
}
