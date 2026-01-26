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

function fmtNum(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return Number(n).toFixed(digits);
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
  // Same training-friendly buckets as TieringView (adjust anytime)
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

export default function DashboardView({
  vendors,
  // Optional navigation hooks (recommended)
  setActiveView,
  selectVendor,
  selectScenario,
}) {
  const [q, setQ] = useState("");
  const [showOnlyCarry, setShowOnlyCarry] = useState(false);
  const [sortBy, setSortBy] = useState("Worst ALE p90"); // "Name" | "Tier" | "Worst ALE p90" | "Most scenarios"

  const rows = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const needle = q.trim().toLowerCase();

    let out = list.filter((v) => {
      if (showOnlyCarry && !v?.carryForward) return false;
      if (!needle) return true;
      return (
        (v?.name || "").toLowerCase().includes(needle) ||
        (v?.category || "").toLowerCase().includes(needle) ||
        (v?.geography || "").toLowerCase().includes(needle)
      );
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
      if (sortBy === "Most scenarios") {
        const na = (a?.scenarios || []).length;
        const nb = (b?.scenarios || []).length;
        return nb - na;
      }
      if (sortBy === "Tier") {
        const ia = tierRank(a?.tier || "");
        const ib = tierRank(b?.tier || "");
        return ia - ib;
      }
      // Worst ALE p90 (default)
      return worstP90(b) - worstP90(a);
    });

    return out;
  }, [vendors, q, showOnlyCarry, sortBy]);

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

          <div style={{ display: "grid", gap: 10, minWidth: 320 }}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vendors (name, category, geography)…"
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                <input
                  type="checkbox"
                  checked={showOnlyCarry}
                  onChange={(e) => setShowOnlyCarry(e.target.checked)}
                />
                Carry-forward only
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
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {rows.map((v) => {
          const tObj = v?.tiering || emptyTiering();
          const idx = tierIndex(tObj);
          const suggested = suggestTierFromIndex(idx);
          const effectiveTier = (v?.tier || "").trim() ? v.tier.trim() : suggested.tier;

          const scs = Array.isArray(v?.scenarios) ? v.scenarios : [];
          const readyCount = scs.filter((s) => scenarioStatus(s) === "Ready").length;

          // Vendor-level “headline” = worst p90 across scenarios (simple risk spotlight)
          let worst = null;
          for (const s of scs) {
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
                  Scenarios: <strong>{scs.length}</strong>
                </Pill>
                <Pill>
                  Ready: <strong>{readyCount}</strong>
                </Pill>
                <Pill>
                  Suggested: <strong>{suggested.tier}</strong>
                </Pill>
              </div>

              {/* Headline risk */}
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
                    No simulation results found yet for this vendor. Run a simulation in <strong>Quantify</strong> or
                    <strong> Results</strong>.
                  </div>
                )}
              </div>

              {/* Scenario list */}
              <div style={{ marginTop: 12 }}>
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 13, opacity: 0.9 }}>
                    Show scenario details ({scs.length})
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
                  </div>
                </details>
              </div>
            </Card>
          );
        })}
      </div>

      {/* small teaching footer */}
      <Card>
        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Teaching note</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
          The dashboard is a portfolio overview. For learning, focus on how Tiering influences prioritization, then
          compare scenario-level FAIR outputs (ALE p50/p90). In real programs you would also add controls, confidence,
          and governance.
        </div>
      </Card>
    </div>
  );
}
