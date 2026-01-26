"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureQuant, runFairMonteCarlo } from "../../lib/fairEngine";

function toNum(x) {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function triangularSample(min, ml, max) {
  const a = toNum(min);
  const c = toNum(ml);
  const b = toNum(max);
  if (a === null || b === null || c === null) return null;
  if (!(a <= c && c <= b)) return null;
  if (a === b) return a;

  const u = Math.random();
  const fc = (c - a) / (b - a);
  if (u < fc) return a + Math.sqrt(u * (b - a) * (c - a));
  return b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

// FAIR-ish: Susceptibility = P(Threat Capability > Resistance Strength)
function estimateSusceptibility(tc, rs, n = 3000) {
  const a = toNum(tc?.min), c = toNum(tc?.ml), b = toNum(tc?.max);
  const d = toNum(rs?.min), f = toNum(rs?.ml), e = toNum(rs?.max);
  if ([a, b, c, d, e, f].some((x) => x === null)) return null;

  let wins = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const tcs = triangularSample(a, c, b);
    const rss = triangularSample(d, f, e);
    if (tcs === null || rss === null) continue;
    total++;
    if (tcs > rss) wins++;
  }
  if (!total) return null;
  return wins / total;
}

function Card({ children }) {
  return (
    <div
      className="card"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Triad({ title, value, onChange, placeholderMin, placeholderMl, placeholderMax }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <input
          className="input"
          value={value?.min ?? ""}
          placeholder={placeholderMin || "min"}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
        <input
          className="input"
          value={value?.ml ?? ""}
          placeholder={placeholderMl || "most likely"}
          onChange={(e) => onChange({ ...value, ml: e.target.value })}
        />
        <input
          className="input"
          value={value?.max ?? ""}
          placeholder={placeholderMax || "max"}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
        />
      </div>
    </div>
  );
}

function StatBlock({ stats }) {
  if (!stats?.ale || !stats?.pel) return null;

  const fmt = (x) => {
    if (!Number.isFinite(x)) return "—";
    // format simple
    return Math.round(x).toLocaleString();
  };

  return (
    <Card>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Simulation results</div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>ALE (Annualized Loss Exposure)</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, display: "grid", gap: 4 }}>
            <div>p10: {fmt(stats.ale.p10)}</div>
            <div>p50: {fmt(stats.ale.ml)}</div>
            <div>p90: {fmt(stats.ale.p90)}</div>
            <div>~min (p01): {fmt(stats.ale.min)}</div>
            <div>~max (p99): {fmt(stats.ale.max)}</div>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>P(Loss Event) (per-event loss)</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, display: "grid", gap: 4 }}>
            <div>p10: {fmt(stats.pel.p10)}</div>
            <div>p50: {fmt(stats.pel.ml)}</div>
            <div>p90: {fmt(stats.pel.p90)}</div>
            <div>~min (p01): {fmt(stats.pel.min)}</div>
            <div>~max (p99): {fmt(stats.pel.max)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor }) {
  if (!vendor) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Quantify</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>No vendor selected.</div>
      </Card>
    );
  }

  if (!scenario) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Quantify</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>No scenario selected.</div>
      </Card>
    );
  }

  const [q, setQ] = useState(() => ensureQuant(scenario.quant || {}));
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setQ(ensureQuant(scenario.quant || {}));
    setIsDirty(false);
    setJustSaved(false);
  }, [scenario.id]); // important: change scenario => reset local state

  const level = q.level || "LEF";

  // Derived (ML) values for on-screen guidance
  const tefML = useMemo(() => {
    if (level === "TEF") return toNum(q.tef?.ml);
    if (level === "Contact Frequency") {
      const cf = toNum(q.contactFrequency?.ml);
      const poa = toNum(q.probabilityOfAction?.ml);
      if (cf === null || poa === null) return null;
      return cf * poa;
    }
    return null;
  }, [level, q.tef, q.contactFrequency, q.probabilityOfAction]);

  const suscML = useMemo(() => {
    if (level === "TEF") {
      const s = toNum(q.susceptibility?.ml);
      return s === null ? null : clamp01(s);
    }
    if (level === "Contact Frequency") {
      const est = estimateSusceptibility(q.threatCapacity, q.resistanceStrength, 2500);
      return est === null ? null : clamp01(est);
    }
    return null;
  }, [level, q.susceptibility, q.threatCapacity, q.resistanceStrength]);

  const lefML = useMemo(() => {
    if (level === "LEF") return toNum(q.lef?.ml);
    if (tefML === null || suscML === null) return null;
    return tefML * suscML;
  }, [level, q.lef, tefML, suscML]);

  const patch = (p) => {
    setQ((prev) => ensureQuant({ ...prev, ...p }));
    setIsDirty(true);
    setJustSaved(false);
  };

  const save = () => {
    const nextScenarios = (vendor.scenarios || []).map((s) =>
      s.id === scenario.id ? { ...s, quant: ensureQuant(q) } : s
    );
    updateVendor(vendor.id, { scenarios: nextScenarios });
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const run = async () => {
    setRunning(true);
    try {
      const base = ensureQuant(q);

      // set mode automatically to match your UX:
      const tuned =
        base.level === "TEF"
          ? { ...base, susceptibilityMode: "Direct" }
          : base.level === "Contact Frequency"
? { ...base, susceptibilityMode: "FromCapacityVsResistance" }
: base;

      const out = await runFairMonteCarlo(tuned);
      const merged = ensureQuant({ ...tuned, ...out });

      setQ(merged);
      setIsDirty(false);

      // Persist immediately so Results/Dashboard see it
      const nextScenarios = (vendor.scenarios || []).map((s) =>
        s.id === scenario.id ? { ...s, quant: merged } : s
      );
      updateVendor(vendor.id, { scenarios: nextScenarios });
    } finally {
      setRunning(false);
    }
  };

  // Contextual left panel fields

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <FrequencyPanel />
        <MagnitudePanel />
      </div>

      {/* Actions */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={save} disabled={!isDirty}>
              Save
            </button>
            <button className="btn" onClick={run} disabled={running}>
              {running ? "Running…" : "Run simulation (FAIR)"}
            </button>

            {justSaved ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Saved ✅</div>
            ) : isDirty ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Unsaved changes</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Simulations</div>
            <input
              className="input"
              style={{ width: 120 }}
              value={q.sims ?? 10000}
              onChange={(e) => patch({ sims: e.target.value })}
              placeholder="10000"
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {q.lastRunAt ? `Last run: ${new Date(q.lastRunAt).toLocaleString()}` : ""}
            </div>
          </div>
        </div>
      </Card>

      {/* Results preview */}
      {q.stats ? <StatBlock stats={q.stats} /> : null}
    </div>
  );
}
