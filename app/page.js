"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------
// FAIR TPRM Training Tool (browser-only)
// - Multi-vendor / multi-scenario
// - Tiering matrix (1-5) with prioritization index (product)
// - Monte Carlo FAIR-ish quant (Poisson frequency + loss distribution)
// - Auto-suggest treatments from drivers
// - Decision dashboard
// ---------------------------------------------

const LS_KEY = "fair_tprm_training_v3";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const money = (n) => {
  if (n === "" || n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --- distributions
const triangularSample = (min, ml, max) => {
  const a = Number(min);
  const c = Number(ml);
  const b = Number(max);
  if (![a, b, c].every((v) => Number.isFinite(v))) return 0;
  if (b <= a) return a;
  const u = Math.random();
  const fc = (c - a) / (b - a);
  if (u < fc) return a + Math.sqrt(u * (b - a) * (c - a));
  return b - Math.sqrt((1 - u) * (b - a) * (b - c));
};

// Poisson sampler (Knuth)
const poisson = (lambda) => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (a[base + 1] === undefined) return a[base];
  return a[base] + rest * (a[base + 1] - a[base]);
};

const summarizeTriad = (min, ml, max) => {
  const a = Number(min);
  const c = Number(ml);
  const b = Number(max);
  return {
    min: Number.isFinite(a) ? a : 0,
    ml: Number.isFinite(c) ? c : 0,
    max: Number.isFinite(b) ? b : 0,
  };
};

// ---------------------------------------------
// Data model
// ---------------------------------------------

const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const tierIndex = (t) =>
  Number(t.dataSensitivity || 1) *
  Number(t.integrationDepth || 1) *
  Number(t.accessPrivileges || 1) *
  Number(t.historicalIncidents || 1) *
  Number(t.businessCriticality || 1);

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  dependencyLevel: "Medium",
  tier: "",
  tierRationale: "",
  tiering: emptyTiering(),
  carryForward: false,
  scenarios: [],
});

const emptyQuant = () => ({
  // abstraction level
  level: "LEF",
  // frequency
  tef: { min: "", ml: "", max: "" }, // per year
  susc: { min: "", ml: "", max: "" }, // %
  // loss per event (primary + secondary)
  pel: { min: "", ml: "", max: "" }, // per event loss exposure
  // results
  sims: 10000,
  lastRunAt: "",
  aleSamples: [],
  pelSamples: [],
  stats: null,
});

const emptyScenario = () => ({
  id: uid(),
  title: "",
  assetAtRisk: "",
  threatActor: "External cybercriminal",
  attackVector: "",
  lossEvent: "",
  narrative: "",
  // quant
  assumptions: "",
  quant: emptyQuant(),
  // treatments (auto-suggested + editable)
  treatments: [],
  // decision
  decision: {
    status: "",
    owner: "",
    approver: "",
    reviewDate: "",
    rationale: "",
  },
});

const emptyTreatment = (kind) => ({
  id: uid(),
  kind, // Reduce TEF / Reduce susceptibility / Reduce loss magnitude / Transfer / Avoid
  title: "",
  owner: "",
  annualCost: "",
  // effect model (simple training model)
  effectPct: 20, // % reduction on target driver
});

// ---------------------------------------------
// UI helpers
// ---------------------------------------------

function Pill({ children }) {
  return <span className="badge">{children}</span>;
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 4 }} className="h-sub">{subtitle}</div> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{right}</div> : null}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ScoreSelect({ value, onChange }) {
  return (
    <select className="input" value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
    </select>
  );
}

function QualityBanner({ items }) {
  if (!items.length) return null;
  return (
    <div className="hint" style={{ borderColor: "rgba(110,231,255,0.25)" }}>
      <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Quality checks</div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function SparkHistogram({ title, values, width = 520, height = 120, bins = 24 }) {
  const v = values || [];
  const data = useMemo(() => {
    if (!v.length) return null;
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = Math.max(1e-9, max - min);
    const counts = Array.from({ length: bins }, () => 0);
    for (const x of v) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((x - min) / span) * bins)));
      counts[idx] += 1;
    }
    const m = Math.max(1, ...counts);
    return { min, max, counts, m };
  }, [v, bins]);

  if (!data) {
    return (
      <div className="card card-pad">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.65)" }}>Run a simulation to see the distribution.</div>
      </div>
    );
  }

  const { min, max, counts, m } = data;
  const barW = width / bins;

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          {money(min)} → {money(max)}
        </div>
      </div>
      <svg width={width} height={height} style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
        {counts.map((c, i) => {
          const h = (c / m) * (height - 18);
          return (
            <rect
              key={i}
              x={i * barW}
              y={height - h}
              width={Math.max(1, barW - 2)}
              height={h}
              rx="3"
              opacity="0.85"
              fill="currentColor"
            />
          );
        })}
      </svg>
    </div>
  );
}

function ExceedanceCurve({ title, values, width = 520, height = 180, points = 60 }) {
  const v = values || [];
  const data = useMemo(() => {
    if (!v.length) return null;
    const sorted = [...v].sort((a, b) => a - b);
    const n = sorted.length;
    const xs = [];
    for (let i = 0; i < points; i++) {
      const q = i / (points - 1);
      xs.push(sorted[Math.floor(q * (n - 1))]);
    }
    const min = xs[0];
    const max = xs[xs.length - 1];
    return { xs, min, max };
  }, [v, points]);

  if (!data) {
    return (
      <div className="card card-pad">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.65)" }}>Run a simulation to see the loss exceedance curve.</div>
      </div>
    );
  }

  const { xs, min, max } = data;
  const pad = 18;
  const w = width;
  const h = height;

  // Exceedance P(L > x) = 1 - F(x)
  const pts = xs.map((x, i) => {
    const q = i / (xs.length - 1);
    const ex = 1 - q;
    const nx = (x - min) / Math.max(1e-9, max - min);
    const ny = ex; // 0..1
    const px = pad + nx * (w - 2 * pad);
    const py = pad + (1 - ny) * (h - 2 * pad);
    return [px, py];
  });

  const d = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          {money(min)} → {money(max)}
        </div>
      </div>
      <svg width={w} height={h} style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
      </svg>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Y = P(Loss &gt; x) (exceedance)</div>
    </div>
  );
}

// ---------------------------------------------
// Page
// ---------------------------------------------

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return { vendors: [], selectedVendorId: "", selectedScenarioId: "" };
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      const parsed = JSON.parse(raw);
      if (!parsed?.vendors?.length) return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
      return parsed;
    } catch {
      return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const vendors = state.vendors;

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null,
    [vendors, state.selectedVendorId]
  );

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    return selectedVendor.scenarios.find((s) => s.id === state.selectedScenarioId) || selectedVendor.scenarios[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  useEffect(() => {
    if (!vendors.length) {
      setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
      return;
    }
    if (!state.selectedVendorId && vendors[0]?.id) {
      setState((prev) => ({ ...prev, selectedVendorId: vendors[0].id }));
      return;
    }
    if (selectedVendor && selectedVendor.scenarios.length && !state.selectedScenarioId) {
      setState((prev) => ({ ...prev, selectedScenarioId: selectedVendor.scenarios[0].id }));
    }
  }, [vendors, state.selectedVendorId, state.selectedScenarioId, selectedVendor]);

  const setVendor = (vendorId, patch) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === vendorId ? { ...v, ...patch } : v)),
    }));
  };

  const setScenario = (scenarioId, patch) => {
    if (!selectedVendor) return;
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return { ...v, scenarios: v.scenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch } : s)) };
      }),
    }));
  };

  const addVendor = () => {
    const v = emptyVendor();
    setState((prev) => ({
      ...prev,
      vendors: [...prev.vendors, v],
      selectedVendorId: v.id,
      selectedScenarioId: "",
    }));
    setActiveView("Vendors");
  };

  const deleteVendor = (vendorId) => {
    setState((prev) => {
      const nextVendors = prev.vendors.filter((v) => v.id !== vendorId);
      const nextSelected = nextVendors[0]?.id || "";
      return {
        ...prev,
        vendors: nextVendors.length ? nextVendors : [emptyVendor()],
        selectedVendorId: nextSelected,
        selectedScenarioId: "",
      };
    });
  };

  const addScenario = () => {
    if (!selectedVendor) return;
    const s = emptyScenario();
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === selectedVendor.id ? { ...v, scenarios: [...v.scenarios, s] } : v)),
      selectedScenarioId: s.id,
    }));
    setActiveView("Scenarios");
  };

  const deleteScenario = (scenarioId) => {
    if (!selectedVendor) return;
    setState((prev) => {
      const nextVendors = prev.vendors.map((v) => {
        if (v.id !== selectedVendor.id) return v;
        return { ...v, scenarios: v.scenarios.filter((s) => s.id !== scenarioId) };
      });
      const v2 = nextVendors.find((v) => v.id === selectedVendor.id);
      const nextScenarioId = v2?.scenarios[0]?.id || "";
      return { ...prev, vendors: nextVendors, selectedScenarioId: nextScenarioId };
    });
  };

  const resetTrainingData = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    setState({ vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" });
    setActiveView("Vendors");
  };

  // ---------------------------------------------
  // Quality checks
  // ---------------------------------------------

  const vendorQuality = useMemo(() => {
    if (!selectedVendor) return [];
    const issues = [];
    if (!selectedVendor.name.trim()) issues.push("Vendor name is missing.");
    if (!selectedVendor.criticalFunction.trim()) issues.push("Critical business function is missing.");
    if (!selectedVendor.dataTypes.trim()) issues.push("Data types are missing.");
    return issues;
  }, [selectedVendor]);

  const scenarioQuality = useMemo(() => {
    if (!selectedScenario) return [];
    const issues = [];
    if (!selectedScenario.title.trim()) issues.push("Scenario title is missing.");
    if (!selectedScenario.assetAtRisk.trim()) issues.push("Asset at risk is missing.");
    if (!selectedScenario.lossEvent.trim()) issues.push("Loss event is missing.");
    if (!selectedScenario.attackVector.trim()) issues.push("Attack vector is missing.");
    return issues;
  }, [selectedScenario]);

  // ---------------------------------------------
  // Tiering
  // ---------------------------------------------

  const recomputeTierFromIndex = (idx) => {
    if (idx >= 400) return { tier: "High", rationale: "High composite score across filtering criteria." };
    if (idx >= 120) return { tier: "Medium", rationale: "Moderate composite score across filtering criteria." };
    return { tier: "Low", rationale: "Low composite score across filtering criteria." };
  };

  const autoSelectTop2ForQuant = () => {
    const rows = vendors
      .map((v) => ({ id: v.id, name: v.name || "(Unnamed vendor)", idx: tierIndex(v.tiering || emptyTiering()) }))
      .sort((a, b) => b.idx - a.idx);
    const top2 = new Set(rows.slice(0, 2).map((r) => r.id));
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => ({ ...v, carryForward: top2.has(v.id) })),
    }));
  };

  // ---------------------------------------------
  // Quantification engine (Monte Carlo)
  // ---------------------------------------------

  const [runState, setRunState] = useState({ running: false, done: 0, total: 0, label: "" });
  const runCancelRef = useRef({ cancelled: false });

  const computeDrivers = (q) => {
    const tefML = Number(q.tef.ml) || 0;
    const suscML = (Number(q.susc.ml) || 0) / 100;
    const pelML = Number(q.pel.ml) || 0;
    // crude driver weight (for training)
    const d = [
      { k: "TEF", v: tefML },
      { k: "Susceptibility", v: suscML },
      { k: "Per-event loss", v: pelML / 100000 },
    ].sort((a, b) => b.v - a.v);
    return d.map((x) => x.k);
  };

  const suggestTreatmentsFromDrivers = (q) => {
    const d = computeDrivers(q);
    const out = [];
    if (d.includes("Susceptibility")) {
      const t = emptyTreatment("Reduce susceptibility");
      t.title = "Improve vendor access controls / MFA / least privilege";
      t.effectPct = 30;
      out.push(t);
    }
    if (d.includes("TEF")) {
      const t = emptyTreatment("Reduce TEF");
      t.title = "Reduce exposure surface (network segmentation, hardening, monitoring)";
      t.effectPct = 20;
      out.push(t);
    }
    if (d.includes("Per-event loss")) {
      const t = emptyTreatment("Reduce loss magnitude");
      t.title = "Limit blast radius (tokenization, encryption, backups, incident playbooks)";
      t.effectPct = 25;
      out.push(t);
    }
    if (!out.length) {
      const t = emptyTreatment("Reduce susceptibility");
      t.title = "Baseline hardening";
      out.push(t);
    }
    return out;
  };

  const runMonteCarlo = async () => {
    if (!selectedScenario) return;
    const q = selectedScenario.quant;

    const sims = Math.max(1000, Math.min(200000, Number(q.sims) || 10000));

    const tef = summarizeTriad(q.tef.min, q.tef.ml, q.tef.max);
    const susc = summarizeTriad(q.susc.min, q.susc.ml, q.susc.max);
    const pel = summarizeTriad(q.pel.min, q.pel.ml, q.pel.max);

    // basic validation
    const errs = [];
    if (!(tef.min && tef.ml && tef.max)) errs.push("TEF min/ML/max");
    if (!(susc.min && susc.ml && susc.max)) errs.push("Susceptibility min/ML/max");
    if (!(pel.min && pel.ml && pel.max)) errs.push("Per-event loss min/ML/max");

    if (errs.length) {
      alert(`Missing inputs: ${errs.join(", ")}`);
      return;
    }

    runCancelRef.current.cancelled = false;
    setRunState({ running: true, done: 0, total: sims, label: `Running ${sims.toLocaleString()} simulations…` });

    const ale = [];
    const pelSamples = [];

    // chunked loop to keep UI responsive
    const chunk = 400;
    let done = 0;

    while (done < sims) {
      if (runCancelRef.current.cancelled) break;
      const n = Math.min(chunk, sims - done);

      for (let i = 0; i < n; i++) {
        // sample TEF and Susc → LEF
        const tefS = Math.max(0, triangularSample(tef.min, tef.ml, tef.max));
        const suscS = clamp01(triangularSample(susc.min, susc.ml, susc.max) / 100);
        const lef = tefS * suscS;

        // frequency per year: model as Poisson with lambda = LEF
        const k = poisson(Math.max(0, lef));

        let annualLoss = 0;
        for (let e = 0; e < k; e++) {
          const perEvent = Math.max(0, triangularSample(pel.min, pel.ml, pel.max));
          annualLoss += perEvent;
          pelSamples.push(perEvent);
        }
        ale.push(annualLoss);
      }

      done += n;
      setRunState({ running: true, done, total: sims, label: `Running ${sims.toLocaleString()} simulations… (${done.toLocaleString()}/${sims.toLocaleString()})` });
      // yield
      await new Promise((r) => setTimeout(r, 0));
    }

    const p10 = quantile(ale, 0.1);
    const p90 = quantile(ale, 0.9);

    const stats = {
      ale: {
        min: quantile(ale, 0.01),
        ml: quantile(ale, 0.5),
        max: quantile(ale, 0.99),
        p10,
        p90,
      },
      pel: {
        min: quantile(pelSamples, 0.01),
        ml: quantile(pelSamples, 0.5),
        max: quantile(pelSamples, 0.99),
        p10: quantile(pelSamples, 0.1),
        p90: quantile(pelSamples, 0.9),
      },
    };

    const now = new Date().toISOString();

    // auto treatments suggestion (only if none yet)
    const existing = selectedScenario.treatments || [];
    const suggested = existing.length ? existing : suggestTreatmentsFromDrivers(q);

    setScenario(selectedScenario.id, {
      quant: {
        ...q,
        sims,
        lastRunAt: now,
        aleSamples: ale,
        pelSamples,
        stats,
      },
      treatments: suggested,
    });

    setRunState({ running: false, done: sims, total: sims, label: "Simulation complete." });
  };

  const cancelRun = () => {
    runCancelRef.current.cancelled = true;
    setRunState((p) => ({ ...p, running: false, label: "Cancelled." }));
  };

  // ---------------------------------------------
  // Portfolio
  // ---------------------------------------------

  const portfolio = useMemo(() => {
    const vendorRows = vendors
      .map((v) => {
        const idx = tierIndex(v.tiering || emptyTiering());
        const vendorAle = v.scenarios.reduce((sum, s) => sum + (Number(s.quant?.stats?.ale?.ml) || 0), 0);
        return { vendorId: v.id, vendorName: v.name || "(Unnamed vendor)", idx, ale: vendorAle, carryForward: !!v.carryForward };
      })
      .sort((a, b) => b.idx - a.idx);

    const scenRows = [];
    for (const v of vendors) {
      for (const s of v.scenarios) {
        scenRows.push({
          label: `${v.name || "(Vendor)"} · ${s.title || "(Scenario)"}`,
          aleML: Number(s.quant?.stats?.ale?.ml) || 0,
          p90: Number(s.quant?.stats?.ale?.p90) || 0,
          decision: s.decision?.status || "",
        });
      }
    }
    scenRows.sort((a, b) => b.aleML - a.aleML);

    return {
      vendorRows,
      scenRows,
    };
  }, [vendors]);

  // ---------------------------------------------
  // Exports
  // ---------------------------------------------

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const vendorRows = vendors.map((v) => ({
      VendorID: v.id,
      VendorName: v.name,
      Category: v.category,
      BusinessOwner: v.businessOwner,
      CriticalFunction: v.criticalFunction,
      DataTypes: v.dataTypes,
      Geography: v.geography,
      DependencyLevel: v.dependencyLevel,
      Tier: v.tier,
      TierRationale: v.tierRationale,
      CarryForward: v.carryForward ? "Yes" : "No",
      DataSensitivity: v.tiering?.dataSensitivity,
      IntegrationDepth: v.tiering?.integrationDepth,
      AccessPrivileges: v.tiering?.accessPrivileges,
      HistoricalIncidents: v.tiering?.historicalIncidents,
      BusinessCriticality: v.tiering?.businessCriticality,
      PrioritizationIndex: tierIndex(v.tiering || emptyTiering()),
    }));

    const scenarioRows = vendors.flatMap((v) =>
      v.scenarios.map((s) => ({
        VendorName: v.name,
        ScenarioID: s.id,
        Title: s.title,
        AssetAtRisk: s.assetAtRisk,
        ThreatActor: s.threatActor,
        AttackVector: s.attackVector,
        LossEvent: s.lossEvent,
        Narrative: s.narrative,
        Assumptions: s.assumptions,
        Sims: s.quant?.sims,
        ALE_ML: s.quant?.stats?.ale?.ml,
        ALE_P10: s.quant?.stats?.ale?.p10,
        ALE_P90: s.quant?.stats?.ale?.p90,
        PEL_ML: s.quant?.stats?.pel?.ml,
        Decision: s.decision?.status,
        Owner: s.decision?.owner,
        ReviewDate: s.decision?.reviewDate,
      }))
    );

    const treatmentRows = vendors.flatMap((v) =>
      v.scenarios.flatMap((s) =>
        (s.treatments || []).map((t) => ({
          VendorName: v.name,
          ScenarioTitle: s.title,
          TreatmentKind: t.kind,
          Title: t.title,
          Owner: t.owner,
          AnnualCost: t.annualCost,
          EffectPct: t.effectPct,
        }))
      )
    );

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorRows), "Vendors");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenarioRows), "Scenarios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treatmentRows), "Treatments");

    XLSX.writeFile(wb, "FAIR_TPRM_Training_Export.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.setFontSize(18);
    doc.text("FAIR TPRM Training Report", 40, 50);

    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(`Vendors: ${vendors.length}  |  Scenarios: ${vendors.reduce((n, v) => n + v.scenarios.length, 0)}`, 40, 70);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 90,
      head: [["Vendor", "Prioritization index", "Carry forward", "ALE (median)" ]],
      body: portfolio.vendorRows.slice(0, 10).map((r) => [r.vendorName, String(r.idx), r.carryForward ? "Yes" : "No", money(r.ale)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [["Scenario", "ALE (median)", "P90", "Decision"]],
      body: portfolio.scenRows.slice(0, 12).map((r) => [r.label, money(r.aleML), money(r.p90), r.decision || "" ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    doc.save("FAIR_TPRM_Training_Report.pdf");
  };

  // ---------------------------------------------
  // Views
  // ---------------------------------------------

  const nav = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Scenarios", label: "Scenarios" },
    { k: "Quantify", label: "Quantify" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
    { k: "Reports", label: "Reports" },
  ];

  const stepActions = (
    <>
      <button className="btn" onClick={addVendor}>Add vendor</button>
      <button className="btn" onClick={addScenario} disabled={!selectedVendor}>Add scenario</button>
      <button className="btn" onClick={() => setActiveView("Tiering")} disabled={!selectedVendor}>Tier vendor</button>
      <button className="btn" onClick={() => setActiveView("Quantify")} disabled={!selectedScenario}>Quantify</button>
      <button className="btn" onClick={() => setActiveView("Treatments")} disabled={!selectedScenario}>Treat</button>
      <button className="btn primary" onClick={() => setActiveView("Decisions")} disabled={!selectedScenario}>Decide</button>
    </>
  );

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h-title">FAIR TPRM Training Tool</h1>
          <p className="h-sub">
            Guided flow for third-party risk governance using FAIR concepts. Training only — data stays in your browser.
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{vendors.length} vendor(s)</Pill>
            <Pill>{vendors.reduce((n, v) => n + v.scenarios.length, 0)} scenario(s)</Pill>
            <Pill>Carry-forward: {vendors.filter((v) => v.carryForward).length}</Pill>
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn primary" onClick={exportPDF}>Export PDF</button>
          <button className="btn" onClick={resetTrainingData}>Reset</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <div className="tabs" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))", flex: 1 }}>
          {nav.map((t) => (
            <button key={t.k} className={`tab ${activeView === t.k ? "active" : ""}`} onClick={() => setActiveView(t.k)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{stepActions}</div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {/* Left: Workspace */}
        <div className="col6">
          <div className="card card-pad">
            <SectionTitle
              title="Workspace"
              subtitle="Pick a vendor and scenario, then use the step buttons above."
              right={null}
            />

            <div className="grid">
              <div className="col12">
                <div className="label">Select vendor</div>
                <select
                  className="input"
                  value={selectedVendor?.id || ""}
                  onChange={(e) => setState((prev) => ({ ...prev, selectedVendorId: e.target.value, selectedScenarioId: "" }))}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name ? v.name : "(Unnamed vendor)"}
                    </option>
                  ))}
                </select>

                {selectedVendor ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>{selectedVendor.category}</Pill>
                    <Pill>Tier: {selectedVendor.tier || "Not set"}</Pill>
                    <Pill>Index: {tierIndex(selectedVendor.tiering || emptyTiering())}</Pill>
                    <Pill>{selectedVendor.carryForward ? "Carry-forward: Yes" : "Carry-forward: No"}</Pill>
                    <button className="btn" onClick={() => deleteVendor(selectedVendor.id)} style={{ marginLeft: "auto" }}>
                      Delete vendor
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="col12" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>Scenarios</div>
                  <button className="btn" onClick={addScenario} disabled={!selectedVendor}>Add scenario</button>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="label">Select scenario</div>
                  <select
                    className="input"
                    value={selectedScenario?.id || ""}
                    onChange={(e) => setState((prev) => ({ ...prev, selectedScenarioId: e.target.value }))}
                    disabled={!selectedVendor || !selectedVendor.scenarios.length}
                  >
                    {(selectedVendor?.scenarios || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title ? s.title : "(Untitled scenario)"}
                      </option>
                    ))}
                  </select>

                  {selectedScenario ? (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>ALE (median): {money(Number(selectedScenario.quant?.stats?.ale?.ml) || 0)}</Pill>
                      <Pill>P90: {money(Number(selectedScenario.quant?.stats?.ale?.p90) || 0)}</Pill>
                      <Pill>Decision: {selectedScenario.decision?.status || "—"}</Pill>
                      <button className="btn" onClick={() => deleteScenario(selectedScenario.id)} style={{ marginLeft: "auto" }}>
                        Delete scenario
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {activeView === "Vendors" ? <QualityBanner items={vendorQuality} /> : null}
          {activeView === "Scenarios" ? <QualityBanner items={scenarioQuality} /> : null}
        </div>

        {/* Right: Active view */}
        <div className="col6">
          {activeView === "Vendors" && selectedVendor ? (
            <div className="card card-pad">
              <SectionTitle title="Vendor intake" subtitle="Capture context first (TPRM intake)." right={null} />

              <div className="grid">
                <div className="col6">
                  <div className="label">Vendor name</div>
                  <input className="input" value={selectedVendor.name} onChange={(e) => setVendor(selectedVendor.id, { name: e.target.value })} />
                </div>
                <div className="col6">
                  <div className="label">Category</div>
                  <Select value={selectedVendor.category} onChange={(val) => setVendor(selectedVendor.id, { category: val })} options={["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"]} />
                </div>

                <div className="col6">
                  <div className="label">Business owner</div>
                  <input className="input" value={selectedVendor.businessOwner} onChange={(e) => setVendor(selectedVendor.id, { businessOwner: e.target.value })} />
                </div>
                <div className="col6">
                  <div className="label">Geography</div>
                  <Select value={selectedVendor.geography} onChange={(val) => setVendor(selectedVendor.id, { geography: val })} options={["EU", "US", "UK", "Global", "Other"]} />
                </div>

                <div className="col12">
                  <div className="label">Critical business function supported</div>
                  <input className="input" value={selectedVendor.criticalFunction} onChange={(e) => setVendor(selectedVendor.id, { criticalFunction: e.target.value })} placeholder="Example: Customer acquisition and retention" />
                </div>

                <div className="col12">
                  <div className="label">Data types accessed or processed</div>
                  <textarea className="textarea" value={selectedVendor.dataTypes} onChange={(e) => setVendor(selectedVendor.id, { dataTypes: e.target.value })} placeholder="Example: Customer PII, order history, support tickets" />
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setActiveView("Tiering")}>Go to tiering</button>
                <button className="btn primary" onClick={addScenario}>Add scenario</button>
              </div>
            </div>
          ) : null}

          {activeView === "Tiering" ? (
            <div className="card card-pad">
              <SectionTitle
                title="Tiering matrix"
                subtitle="Rate each vendor 1 (low) → 5 (high). Multiply to get a prioritization index. Select the top 2 to carry forward."
                right={
                  <>
                    <button className="btn" onClick={autoSelectTop2ForQuant}>Auto-select top 2</button>
                    <button className="btn primary" onClick={() => setActiveView("Quantify")} disabled={!selectedScenario}>Go to quantification</button>
                  </>
                }
              />

              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Vendor</th>
                      <th style={{ minWidth: 160 }}>Data sensitivity</th>
                      <th style={{ minWidth: 160 }}>Integration depth</th>
                      <th style={{ minWidth: 160 }}>Access privileges</th>
                      <th style={{ minWidth: 160 }}>Historical incidents</th>
                      <th style={{ minWidth: 160 }}>Business criticality</th>
                      <th style={{ minWidth: 160 }}>Index (product)</th>
                      <th style={{ minWidth: 160 }}>Carry forward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => {
                      const t = v.tiering || emptyTiering();
                      const idx = tierIndex(t);
                      return (
                        <tr key={v.id}>
                          <td>
                            <div style={{ fontWeight: 800 }}>{v.name || "(Unnamed vendor)"}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{v.category} · {v.geography}</div>
                          </td>
                          <td><ScoreSelect value={t.dataSensitivity} onChange={(n) => setVendor(v.id, { tiering: { ...t, dataSensitivity: n } })} /></td>
                          <td><ScoreSelect value={t.integrationDepth} onChange={(n) => setVendor(v.id, { tiering: { ...t, integrationDepth: n } })} /></td>
                          <td><ScoreSelect value={t.accessPrivileges} onChange={(n) => setVendor(v.id, { tiering: { ...t, accessPrivileges: n } })} /></td>
                          <td><ScoreSelect value={t.historicalIncidents} onChange={(n) => setVendor(v.id, { tiering: { ...t, historicalIncidents: n } })} /></td>
                          <td><ScoreSelect value={t.businessCriticality} onChange={(n) => setVendor(v.id, { tiering: { ...t, businessCriticality: n } })} /></td>
                          <td style={{ fontWeight: 900 }}>{idx}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!v.carryForward}
                              onChange={(e) => {
                                const idx2 = tierIndex(t);
                                const out = recomputeTierFromIndex(idx2);
                                setVendor(v.id, { carryForward: e.target.checked, tier: out.tier, tierRationale: out.rationale });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedVendor ? (
                <div style={{ marginTop: 12 }} className="hint">
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Selected vendor tier</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Pill>Vendor: {selectedVendor.name || "(Unnamed)"}</Pill>
                    <Pill>Tier: {selectedVendor.tier || "Not set"}</Pill>
                    <Pill>Index: {tierIndex(selectedVendor.tiering || emptyTiering())}</Pill>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div className="label">Tier rationale</div>
                    <textarea className="textarea" value={selectedVendor.tierRationale} onChange={(e) => setVendor(selectedVendor.id, { tierRationale: e.target.value })} placeholder="Write a short rationale a business leader would accept." />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeView === "Scenarios" && selectedScenario ? (
            <div className="card card-pad">
              <SectionTitle title="Scenario definition" subtitle="Keep it specific and defensible." right={
                <>
                  <button className="btn" onClick={addScenario}>Add scenario</button>
                  <button className="btn primary" onClick={() => setActiveView("Quantify")}>Quantify</button>
                </>
              } />

              <div className="grid">
                <div className="col12">
                  <div className="label">Scenario title</div>
                  <input className="input" value={selectedScenario.title} onChange={(e) => setScenario(selectedScenario.id, { title: e.target.value })} placeholder="Example: CRM vendor credential compromise leading to PII exfiltration" />
                </div>

                <div className="col6">
  <div className="label">Asset at risk</div>
  <input
    className="input"
    value={selectedScenario.assetAtRisk}
    onChange={(e) =>
      setScenario(selectedScenario.id, { assetAtRisk: e.target.value })
    }
  />
</div>

<div className="col6">
  <div className="label">Attack vector</div>
  <input
    className="input"
    value={selectedScenario.attackVector}
    onChange={(e) =>
      setScenario(selectedScenario.id, { attackVector: e.target.value })
    }
    placeholder="Phishing, API abuse, credential stuffing…"
  />
</div>

<div className="col12">
  <div className="label">Loss event</div>
  <input
    className="input"
    value={selectedScenario.lossEvent}
    onChange={(e) =>
      setScenario(selectedScenario.id, { lossEvent: e.target.value })
    }
  />
</div>

<div className="col12">
  <div className="label">Scenario narrative</div>
  <textarea
    className="textarea"
    value={selectedScenario.narrative}
    onChange={(e) =>
      setScenario(selectedScenario.id, { narrative: e.target.value })
    }
  />
</div>

</div>
</div>
) : null}

</div>
</div>
</div>
);
}
