"use client";

import { useEffect, useMemo, useState } from "react";

const RATING_ML = {
  "N/A": 0,
  "Very Low": 0.25,
  Low: 0.675,
  Moderate: 0.825,
  High: 0.935,
  "Very High": 0.985,
};

const CONTROL_TYPE_OPTIONS = [
  "Avoidance",
  "Deterrence",
  "Resistance",
  "Detection",
  "Response",
  "Resilience",
  "Loss Minimization",
  "Vulnerability Management",
  "Configuration Management",
  "Change Management",
  "Monitoring & Testing",
  "Audit & Assurance",
  "Governance & Policy",
  "Risk Analysis & Reporting",
  "Asset & Data Management",
  "Threat Intelligence",
  "Awareness & Training",
];

function moneyEUR(n) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function toNum(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function quantileSorted(sorted, q) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function statsFromSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 10) return null;
  const sorted = samples.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (sorted.length < 10) return null;

  return {
    p10: quantileSorted(sorted, 0.1),
    p50: quantileSorted(sorted, 0.5),
    p90: quantileSorted(sorted, 0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function scenarioStatus(q) {
  const hasStats = Number.isFinite(q?.stats?.ale?.p90) || Number.isFinite(q?.stats?.ale?.ml);
  const hasSamples = Array.isArray(q?.aleSamples) && q.aleSamples.length >= 20;
  if (hasStats || hasSamples) return "Ready";

  const hasSomeInputs =
    q &&
    (q.level || q.lef?.ml || q.tef?.ml || q.contactFrequency?.ml || q.primaryLoss?.ml || q.secondaryLossMagnitude?.ml);

  return hasSomeInputs ? "Missing results" : "Missing inputs";
}

function deriveFrequency(q) {
  const level = q?.level || "LEF";
  if (level === "LEF") {
    const v = toNum(q?.lef?.ml);
    return { value: v, label: v === null ? "LEF -" : `LEF ${v.toFixed(2)} /yr` };
  }
  if (level === "TEF") {
    const tef = toNum(q?.tef?.ml);
    const susc = toNum(q?.susceptibility?.ml);
    const lef = Number.isFinite(tef) && Number.isFinite(susc) ? tef * clamp(susc, 0, 1) : null;
    return { value: lef, label: lef === null ? "TEF x Susc -" : `TEF->LEF ${lef.toFixed(2)} /yr` };
  }

  const cf = toNum(q?.contactFrequency?.ml);
  const poa = toNum(q?.probabilityOfAction?.ml);
  const susc = toNum(q?.susceptibility?.ml);
  const tef = Number.isFinite(cf) && Number.isFinite(poa) ? cf * clamp(poa, 0, 1) : null;
  const lef = Number.isFinite(tef) && Number.isFinite(susc) ? tef * clamp(susc, 0, 1) : tef;
  return { value: lef, label: lef === null ? "Contact->LEF -" : `Contact->LEF ${lef.toFixed(2)} /yr` };
}

function deriveMagnitude(q) {
  const pelP90 = toNum(q?.stats?.pel?.p90);
  const pelP50 = toNum(q?.stats?.pel?.ml);
  if (Number.isFinite(pelP90)) return pelP90;
  if (Number.isFinite(pelP50)) return pelP50;

  const p = toNum(q?.primaryLoss?.ml);
  const sf = toNum(q?.secondaryLossEventFrequency?.ml);
  const sm = toNum(q?.secondaryLossMagnitude?.ml);
  if (Number.isFinite(p) && Number.isFinite(sf) && Number.isFinite(sm)) return p + sf * sm;
  if (Number.isFinite(p)) return p;
  return null;
}

function controlMlEffect(control) {
  if (Number.isFinite(Number(control?.impactPct))) {
    return clamp(Number(control.impactPct) / 100, 0, 0.95);
  }

  const i = RATING_ML[control?.intended] ?? 0;
  const c = RATING_ML[control?.coverage] ?? 0;
  const r = RATING_ML[control?.reliability] ?? 0;
  return clamp(i * c * r, 0, 0.95);
}

function typeWeights(type) {
  const t = String(type || "");
  if (t === "Avoidance" || t === "Deterrence") return { freq: 1, mag: 0 };
  if (t === "Resistance" || t === "Detection") return { freq: 0.65, mag: 0.15 };
  if (t === "Response") return { freq: 0.45, mag: 0.45 };
  if (t === "Resilience" || t === "Loss Minimization") return { freq: 0.1, mag: 0.8 };
  return { freq: 0.25, mag: 0.25 };
}

function aggregateControlCuts(controls) {
  const enabled = (Array.isArray(controls) ? controls : []).filter((c) => c && c.enabled !== false);
  if (!enabled.length) return { freqCut: 0, magCut: 0 };

  let freqKeep = 1;
  let magKeep = 1;
  for (const c of enabled) {
    const eff = controlMlEffect(c);
    const w = typeWeights(c?.type);
    freqKeep *= 1 - clamp(eff * w.freq, 0, 0.95);
    magKeep *= 1 - clamp(eff * w.mag, 0, 0.95);
  }

  return { freqCut: 1 - freqKeep, magCut: 1 - magKeep };
}

function transformSamples(samples, controls) {
  if (!Array.isArray(samples) || !samples.length) return [];
  const { freqCut, magCut } = aggregateControlCuts(controls);
  const mult = (1 - freqCut) * (1 - magCut);
  return samples.map((x) => (Number.isFinite(x) ? Math.max(0, x * mult) : x));
}

function normalizeControls(scenario) {
  const src = Array.isArray(scenario?.controls)
    ? scenario.controls
    : Array.isArray(scenario?.treatments)
      ? scenario.treatments
      : [];

  return src.map((c) => ({
    id: c?.id || `ctrl_${Math.random().toString(16).slice(2)}`,
    name: c?.name || "Untitled control",
    type: c?.type || "Resistance",
    status: c?.status || "Proposed",
    intended: c?.intended || "N/A",
    coverage: c?.coverage || "N/A",
    reliability: c?.reliability || "N/A",
    includeInWhatIf: c?.includeInWhatIf !== false,
    impactPct: Number.isFinite(Number(c?.impactPct)) ? Number(c.impactPct) : null,
  }));
}

function extractScenarioRows(vendors) {
  const rows = [];

  for (const v of Array.isArray(vendors) ? vendors : []) {
    for (const s of Array.isArray(v?.scenarios) ? v.scenarios : []) {
      const q = s?.quant || {};
      const freq = deriveFrequency(q);
      const aleP50 = toNum(q?.stats?.ale?.ml);
      const aleP90 = toNum(q?.stats?.ale?.p90);
      const samples = Array.isArray(q?.aleSamples) ? q.aleSamples.filter((x) => Number.isFinite(x)) : [];

      let freqValue = Number.isFinite(freq.value) ? freq.value : null;
      let freqLabel = freq.label;
      let magnitudeValue = deriveMagnitude(q);

      // Fallback consistency:
      // if ALE exists but frequency or magnitude is missing/zero, infer from ALE p50.
      if ((!Number.isFinite(freqValue) || freqValue <= 0) && Number.isFinite(aleP50) && Number.isFinite(magnitudeValue) && magnitudeValue > 0) {
        freqValue = aleP50 / magnitudeValue;
      }

      if ((!Number.isFinite(magnitudeValue) || magnitudeValue <= 0) && Number.isFinite(aleP50) && Number.isFinite(freqValue) && freqValue > 0) {
        magnitudeValue = aleP50 / freqValue;
      }

      if (Number.isFinite(freqValue) && (!Number.isFinite(freq.value) || freq.value <= 0)) {
        freqLabel = `Derived LEF ${freqValue.toFixed(2)} /yr`;
      }

      let criticality = null;
      if (Number.isFinite(aleP90)) criticality = aleP90;
      else if (Number.isFinite(aleP50)) criticality = aleP50;
      else if (Number.isFinite(freqValue) && Number.isFinite(magnitudeValue)) criticality = freqValue * magnitudeValue;

      rows.push({
        vendorId: v?.id,
        vendorName: v?.name?.trim() ? v.name : "(Unnamed vendor)",
        scenarioId: s?.id,
        scenarioTitle: s?.title?.trim() ? s.title : "(Untitled scenario)",
        status: scenarioStatus(q),
        level: q?.level || "LEF",
        freqValue: Number.isFinite(freqValue) ? freqValue : null,
        freqLabel,
        magnitudeValue: Number.isFinite(magnitudeValue) ? magnitudeValue : null,
        aleP50: Number.isFinite(aleP50) ? aleP50 : null,
        aleP90: Number.isFinite(aleP90) ? aleP90 : null,
        samples,
        criticality,
        scenarioRef: s,
      });
    }
  }

  return rows;
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

function Tooltip({ hover }) {
  if (!hover) return null;
  const { row, x, y } = hover;

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y + 12,
        zIndex: 60,
        pointerEvents: "none",
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(0,0,0,0.72)",
        borderRadius: 12,
        padding: 10,
        backdropFilter: "blur(6px)",
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12 }}>{row.vendorName}</div>
      <div style={{ fontSize: 12, opacity: 0.92 }}>{row.scenarioTitle}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.86 }}>Frequency: {row.freqLabel}</div>
      <div style={{ fontSize: 12, opacity: 0.86 }}>Magnitude: {moneyEUR(row.magnitudeValue)}</div>
      <div style={{ fontSize: 12, opacity: 0.86 }}>ALE p50: {moneyEUR(row.aleP50)}</div>
      <div style={{ fontSize: 12, opacity: 0.86 }}>ALE p90: {moneyEUR(row.aleP90)}</div>
    </div>
  );
}

function ScatterPlot({ rows, selectedKey, onSelect, onHover, floatT }) {
  const W = 860;
  const H = 420;
  const pad = { l: 60, r: 26, t: 24, b: 46 };

  const plottable = useMemo(() => rows.filter((r) => Number.isFinite(r.freqValue) && Number.isFinite(r.magnitudeValue)), [rows]);

  const scales = useMemo(() => {
    const xs = plottable.map((r) => Math.max(0, r.freqValue));
    const ys = plottable.map((r) => Math.max(0, r.magnitudeValue));
    const cs = plottable.map((r) => (Number.isFinite(r.criticality) ? r.criticality : 0));

    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 1;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 1;
    const minC = cs.length ? Math.min(...cs) : 0;
    const maxC = cs.length ? Math.max(...cs) : 1;

    return {
      minX,
      maxX: maxX <= minX ? minX + 1 : maxX,
      minY,
      maxY: maxY <= minY ? minY + 1 : maxY,
      minC,
      maxC: maxC <= minC ? minC + 1 : maxC,
    };
  }, [plottable]);

  const mapX = (x) => pad.l + ((x - scales.minX) / (scales.maxX - scales.minX)) * (W - pad.l - pad.r);
  const mapY = (y) => pad.t + (1 - (y - scales.minY) / (scales.maxY - scales.minY)) * (H - pad.t - pad.b);

  const colorFor = (row) => {
    if (!Number.isFinite(row.criticality)) return "rgba(156,163,175,0.75)";
    const t = (row.criticality - scales.minC) / (scales.maxC - scales.minC);
    const r = Math.round(70 + t * 180);
    const g = Math.round(180 - t * 120);
    const b = Math.round(120 - t * 80);
    return `rgb(${r},${g},${b})`;
  };

  const radiusFor = (row) => {
    if (!Number.isFinite(row.criticality)) return 5;
    const t = (row.criticality - scales.minC) / (scales.maxC - scales.minC);
    return 5 + t * 7;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" rx={12} />

      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const y = pad.t + g * (H - pad.t - pad.b);
        return <line key={`gy${g}`} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="rgba(255,255,255,0.08)" />;
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const x = pad.l + g * (W - pad.l - pad.r);
        return <line key={`gx${g}`} x1={x} y1={pad.t} x2={x} y2={H - pad.b} stroke="rgba(255,255,255,0.06)" />;
      })}

      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="rgba(255,255,255,0.4)" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="rgba(255,255,255,0.4)" />

      <text x={W / 2} y={H - 12} textAnchor="middle" fill="currentColor" opacity="0.82" fontSize="12" fontWeight="700">
        Frequency (events/year)
      </text>
      <text
        x={16}
        y={H / 2}
        textAnchor="middle"
        fill="currentColor"
        opacity="0.82"
        fontSize="12"
        fontWeight="700"
        transform={`rotate(-90 16 ${H / 2})`}
      >
        Magnitude (EUR)
      </text>

      {plottable.map((row, i) => {
        const baseX = mapX(Math.max(0, row.freqValue));
        const baseY = mapY(Math.max(0, row.magnitudeValue));
        const key = `${row.vendorId}::${row.scenarioId}`;
        const isSelected = key === selectedKey;

        const jitterX = Math.sin(floatT * 0.9 + i * 0.45) * 1.4;
        const jitterY = Math.cos(floatT * 1.1 + i * 0.35) * 1.8;
        const x = baseX + jitterX;
        const y = baseY + jitterY;

        return (
          <g key={key}>
            <circle
              cx={x}
              cy={y}
              r={radiusFor(row) + (isSelected ? 3 : 0)}
              fill={colorFor(row)}
              opacity={0.92}
              stroke={isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.15)"}
              strokeWidth={isSelected ? 2 : 1}
              style={{ cursor: "pointer" }}
              onMouseMove={(e) => onHover(row, e.clientX, e.clientY)}
              onMouseLeave={() => onHover(null, 0, 0)}
              onClick={() => onSelect(row)}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ControlsEditor({ controls, onToggle, onImpactChange, onAddProposed }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>Proposed / planned controls</div>
        <button className="btn" onClick={onAddProposed}>+ Add proposed</button>
      </div>

      {!controls.length ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>No proposed/planned controls yet.</div>
      ) : (
        controls.map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              padding: 10,
              display: "grid",
              gap: 8,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={!!c.enabled} onChange={(e) => onToggle(c.id, e.target.checked)} />
              <span style={{ fontWeight: 800, fontSize: 13 }}>{c.name}</span>
              <span style={{ fontSize: 12, opacity: 0.76 }}>({c.type})</span>
            </label>

            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, opacity: 0.78 }}>Impact override: {Math.round(c.impactPct)}%</div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={Number.isFinite(c.impactPct) ? c.impactPct : 0}
                onChange={(e) => onImpactChange(c.id, Number(e.target.value))}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ScenarioDetails({
  row,
  existingControls,
  proposedControls,
  baseline,
  residual,
  deltaP50,
  deltaP90,
  draftDirty,
  onToggleProposed,
  onImpactChange,
  onAddProposed,
  onApplyDraft,
  onDiscardDraft,
  onOpenResults,
  onOpenTreatments,
}) {
  if (!row) {
    return (
      <Card>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Scenario details</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>Select a point in the heatmap to inspect controls and what-if impact.</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{row.vendorName} - {row.scenarioTitle}</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82 }}>
            {row.freqLabel} · Magnitude {moneyEUR(row.magnitudeValue)} · Status {row.status}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={onOpenTreatments}>Open Treatments</button>
          <button className="btn primary" onClick={onOpenResults}>Open Results</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Current risk (baseline)</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>ALE p50: {moneyEUR(baseline?.p50)}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p90: {moneyEUR(baseline?.p90)}</div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Residual risk (what-if)</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>ALE p50: {moneyEUR(residual?.p50)}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p90: {moneyEUR(residual?.p90)}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
        Delta p50: {moneyEUR(deltaP50)} · Delta p90: {moneyEUR(deltaP90)}
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Existing controls in place</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {!existingControls.length ? (
              <div style={{ fontSize: 13, opacity: 0.78 }}>None recorded.</div>
            ) : (
              existingControls.map((c) => (
                <div key={c.id} style={{ fontSize: 13, opacity: 0.9 }}>
                  {c.name} <span style={{ opacity: 0.7 }}>({c.type})</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 10 }}>
          <ControlsEditor
            controls={proposedControls}
            onToggle={onToggleProposed}
            onImpactChange={onImpactChange}
            onAddProposed={onAddProposed}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn primary" disabled={!draftDirty} onClick={onApplyDraft}>Save/apply proposed flags</button>
        <button className="btn" disabled={!draftDirty} onClick={onDiscardDraft}>Discard changes</button>
        {draftDirty ? <span style={{ fontSize: 12, opacity: 0.8 }}>Unsaved draft</span> : null}
      </div>
    </Card>
  );
}

export default function DashboardView({
  vendors,
  setActiveView,
  selectVendor,
  selectScenario,
  updateVendor,
}) {
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [hideMissing, setHideMissing] = useState(false);
  const [hover, setHover] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [floatT, setFloatT] = useState(0);

  const [draftByScenario, setDraftByScenario] = useState({});
  const [dirtyByScenario, setDirtyByScenario] = useState({});

  useEffect(() => {
    let raf = 0;
    const tick = (ts) => {
      setFloatT(ts / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows = useMemo(() => extractScenarioRows(vendors), [vendors]);
  const vendorOptions = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.vendorId)) m.set(r.vendorId, r.vendorName);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideMissing && r.status !== "Ready") return false;
      if (vendorFilter !== "all" && r.vendorId !== vendorFilter) return false;
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (!q) return true;
      return (
        r.vendorName.toLowerCase().includes(q) ||
        r.scenarioTitle.toLowerCase().includes(q) ||
        String(r.level || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, hideMissing, vendorFilter, levelFilter]);

  const sortedByCriticality = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aa = Number.isFinite(a.criticality) ? a.criticality : -1;
      const bb = Number.isFinite(b.criticality) ? b.criticality : -1;
      return bb - aa;
    });
  }, [filteredRows]);

  useEffect(() => {
    if (selectedKey) {
      const stillExists = rows.some((r) => `${r.vendorId}::${r.scenarioId}` === selectedKey);
      if (!stillExists) setSelectedKey("");
      return;
    }
    if (sortedByCriticality.length) {
      const first = sortedByCriticality[0];
      setSelectedKey(`${first.vendorId}::${first.scenarioId}`);
    }
  }, [rows, selectedKey, sortedByCriticality]);

  const selectedRow = useMemo(() => rows.find((r) => `${r.vendorId}::${r.scenarioId}` === selectedKey) || null, [rows, selectedKey]);

  const selectedScenarioControls = useMemo(() => normalizeControls(selectedRow?.scenarioRef), [selectedRow]);

  useEffect(() => {
    if (!selectedRow) return;
    const sid = selectedRow.scenarioId;
    setDraftByScenario((prev) => {
      if (prev[sid]) return prev;

      const proposed = selectedScenarioControls
        .filter((c) => c.status === "Proposed" || c.status === "Planned")
        .map((c) => ({
          ...c,
          enabled: !!c.includeInWhatIf,
          impactPct: Number.isFinite(c.impactPct) ? c.impactPct : Math.round(controlMlEffect(c) * 100),
        }));

      return {
        ...prev,
        [sid]: proposed,
      };
    });
  }, [selectedRow, selectedScenarioControls]);

  const existingControls = useMemo(() => selectedScenarioControls.filter((c) => c.status === "Implemented"), [selectedScenarioControls]);

  const proposedDraft = selectedRow ? draftByScenario[selectedRow.scenarioId] || [] : [];
  const draftDirty = selectedRow ? !!dirtyByScenario[selectedRow.scenarioId] : false;

  const riskSummary = useMemo(() => {
    if (!selectedRow) return null;

    const baselineFromSamples = statsFromSamples(selectedRow.samples);
    const baseline = baselineFromSamples || {
      p10: null,
      p50: selectedRow.aleP50,
      p90: selectedRow.aleP90,
      min: null,
      max: null,
    };

    const enabledProposed = proposedDraft.filter((c) => c.enabled !== false);

    let residual = null;
    if (baselineFromSamples) {
      const transformed = transformSamples(selectedRow.samples, enabledProposed);
      residual = statsFromSamples(transformed);
    } else if (baseline) {
      const { freqCut, magCut } = aggregateControlCuts(enabledProposed);
      const mult = (1 - freqCut) * (1 - magCut);
      residual = {
        p10: Number.isFinite(baseline.p10) ? baseline.p10 * mult : null,
        p50: Number.isFinite(baseline.p50) ? baseline.p50 * mult : null,
        p90: Number.isFinite(baseline.p90) ? baseline.p90 * mult : null,
      };
    }

    return {
      baseline,
      residual,
      deltaP50:
        Number.isFinite(residual?.p50) && Number.isFinite(baseline?.p50)
          ? residual.p50 - baseline.p50
          : null,
      deltaP90:
        Number.isFinite(residual?.p90) && Number.isFinite(baseline?.p90)
          ? residual.p90 - baseline.p90
          : null,
    };
  }, [selectedRow, proposedDraft]);

  const patchDraftControl = (scenarioId, controlId, patch) => {
    setDraftByScenario((prev) => {
      const list = Array.isArray(prev[scenarioId]) ? prev[scenarioId] : [];
      return {
        ...prev,
        [scenarioId]: list.map((c) => (c.id === controlId ? { ...c, ...patch } : c)),
      };
    });
    setDirtyByScenario((prev) => ({ ...prev, [scenarioId]: true }));
  };

  const addDraftControl = (scenarioId) => {
    setDraftByScenario((prev) => {
      const list = Array.isArray(prev[scenarioId]) ? prev[scenarioId] : [];
      const next = {
        id: `draft_${Math.random().toString(16).slice(2)}`,
        name: `Proposed control ${list.length + 1}`,
        type: "Resistance",
        status: "Proposed",
        enabled: true,
        intended: "Moderate",
        coverage: "Moderate",
        reliability: "Moderate",
        impactPct: 20,
        includeInWhatIf: true,
      };
      return { ...prev, [scenarioId]: [...list, next] };
    });
    setDirtyByScenario((prev) => ({ ...prev, [scenarioId]: true }));
  };

  const discardDraft = (scenarioId) => {
    const proposed = selectedScenarioControls
      .filter((c) => c.status === "Proposed" || c.status === "Planned")
      .map((c) => ({
        ...c,
        enabled: !!c.includeInWhatIf,
        impactPct: Number.isFinite(c.impactPct) ? c.impactPct : Math.round(controlMlEffect(c) * 100),
      }));

    setDraftByScenario((prev) => ({ ...prev, [scenarioId]: proposed }));
    setDirtyByScenario((prev) => ({ ...prev, [scenarioId]: false }));
  };

  const applyDraft = (scenarioId) => {
    if (!updateVendor || !selectedRow) {
      setDirtyByScenario((prev) => ({ ...prev, [scenarioId]: false }));
      return;
    }

    const draft = draftByScenario[scenarioId] || [];

    const nextScenarios = (Array.isArray(vendors) ? vendors : [])
      .find((v) => v.id === selectedRow.vendorId)
      ?.scenarios?.map((s) => {
        if (s.id !== scenarioId) return s;

        const base = Array.isArray(s?.controls)
          ? s.controls
          : Array.isArray(s?.treatments)
            ? s.treatments
            : [];

        const byId = new Map(draft.map((d) => [d.id, d]));

        const updated = base.map((c) => {
          const d = byId.get(c?.id);
          if (!d) return c;
          return {
            ...c,
            includeInWhatIf: !!d.enabled,
          };
        });

        const existingIds = new Set(updated.map((c) => c?.id));
        for (const d of draft) {
          if (existingIds.has(d.id)) continue;
          updated.push({
            id: d.id,
            name: d.name,
            type: CONTROL_TYPE_OPTIONS.includes(d.type) ? d.type : "Resistance",
            status: "Proposed",
            includeInWhatIf: !!d.enabled,
            intended: d.intended || "Moderate",
            coverage: d.coverage || "Moderate",
            reliability: d.reliability || "Moderate",
          });
        }

        return { ...s, controls: updated };
      });

    if (!Array.isArray(nextScenarios)) return;
    updateVendor(selectedRow.vendorId, { scenarios: nextScenarios });
    setDirtyByScenario((prev) => ({ ...prev, [scenarioId]: false }));
  };

  const topCritical = useMemo(() => {
    return sortedByCriticality.filter((r) => Number.isFinite(r.criticality)).slice(0, 8);
  }, [sortedByCriticality]);

  const statsTop = useMemo(() => {
    const total = rows.length;
    const ready = rows.filter((r) => r.status === "Ready").length;
    const plottable = filteredRows.filter((r) => Number.isFinite(r.freqValue) && Number.isFinite(r.magnitudeValue)).length;
    return { total, ready, plottable };
  }, [rows, filteredRows]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Critical Scenario Map</div>
            <div style={{ marginTop: 6, opacity: 0.82, fontSize: 13 }}>
              One-screen prioritization across all vendors: frequency vs magnitude, with criticality-encoded points.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.82 }}>{statsTop.total} scenarios</span>
            <span style={{ fontSize: 12, opacity: 0.82 }}>{statsTop.ready} ready</span>
            <span style={{ fontSize: 12, opacity: 0.82 }}>{statsTop.plottable} plotted</span>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select className="input" style={{ width: 220 }} value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
            <option value="all">All vendors</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select className="input" style={{ width: 170 }} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">All levels</option>
            <option value="LEF">LEF</option>
            <option value="TEF">TEF</option>
            <option value="Contact Frequency">Contact Frequency</option>
          </select>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor or scenario"
          />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
            <input type="checkbox" checked={hideMissing} onChange={(e) => setHideMissing(e.target.checked)} />
            Hide missing results
          </label>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, alignItems: "start" }}>
        <Card style={{ position: "relative", padding: 10 }}>
          <ScatterPlot
            rows={filteredRows}
            selectedKey={selectedKey}
            floatT={floatT}
            onSelect={(row) => {
              setSelectedKey(`${row.vendorId}::${row.scenarioId}`);
              selectVendor?.(row.vendorId);
              selectScenario?.(row.scenarioId);
            }}
            onHover={(row, x, y) => setHover(row ? { row, x, y } : null)}
          />
          <Tooltip hover={hover} />
        </Card>

        <Card>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Top critical scenarios</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Click a row to jump directly into details.</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {topCritical.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>No plottable scenarios with risk metrics yet.</div>
            ) : (
              topCritical.map((r) => {
                const key = `${r.vendorId}::${r.scenarioId}`;
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    className="btn"
                    onClick={() => {
                      setSelectedKey(key);
                      selectVendor?.(r.vendorId);
                      selectScenario?.(r.scenarioId);
                    }}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderColor: selected ? "rgba(24,184,167,0.7)" : "rgba(255,255,255,0.18)",
                      background: selected ? "rgba(24,184,167,0.16)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 900 }}>{r.vendorName}</div>
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.9 }}>{r.scenarioTitle}</div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.82 }}>
                      Criticity: {moneyEUR(r.criticality)} · {r.freqLabel}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 10, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Legend</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Point position: X = frequency, Y = magnitude</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Point size/color: higher = more critical</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Grey points: missing criticality fallback data</div>
          </div>
        </Card>
      </div>

      <ScenarioDetails
        row={selectedRow}
        existingControls={existingControls}
        proposedControls={proposedDraft}
        baseline={riskSummary?.baseline}
        residual={riskSummary?.residual}
        deltaP50={riskSummary?.deltaP50}
        deltaP90={riskSummary?.deltaP90}
        draftDirty={draftDirty}
        onToggleProposed={(id, enabled) => {
          if (!selectedRow) return;
          patchDraftControl(selectedRow.scenarioId, id, { enabled });
        }}
        onImpactChange={(id, impactPct) => {
          if (!selectedRow) return;
          patchDraftControl(selectedRow.scenarioId, id, { impactPct });
        }}
        onAddProposed={() => {
          if (!selectedRow) return;
          addDraftControl(selectedRow.scenarioId);
        }}
        onApplyDraft={() => {
          if (!selectedRow) return;
          applyDraft(selectedRow.scenarioId);
        }}
        onDiscardDraft={() => {
          if (!selectedRow) return;
          discardDraft(selectedRow.scenarioId);
        }}
        onOpenResults={() => {
          if (!selectedRow) return;
          selectVendor?.(selectedRow.vendorId);
          selectScenario?.(selectedRow.scenarioId);
          setActiveView?.("Results");
        }}
        onOpenTreatments={() => {
          if (!selectedRow) return;
          selectVendor?.(selectedRow.vendorId);
          selectScenario?.(selectedRow.scenarioId);
          setActiveView?.("Treatments");
        }}
      />
    </div>
  );
}
