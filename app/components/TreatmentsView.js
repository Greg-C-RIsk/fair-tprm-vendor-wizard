"use client";

import { useEffect, useMemo, useState } from "react";
import { uid } from "../../lib/model";
import { operationalEffectivenessTriad, mapLecTypeToFactors } from "../../lib/fairCamEngine";

// -------------------- UI helpers (declared outside to avoid focus loss) --------------------

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

function Label({ children }) {
  return <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      {textarea ? (
        <textarea
          className="textarea"
          value={value ?? ""}
          placeholder={placeholder || ""}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input"
          value={value ?? ""}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
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

function statusTone(status) {
  if (status === "Implemented") return "good";
  if (status === "Planned") return "blue";
  if (status === "Rejected") return "bad";
  return "neutral";
}

function fmtPct01(x) {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

function factorsLabel(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (!a.length) return "—";
  return a
    .map((f) => {
      if (f === "SUSC") return "Susceptibility";
      return f;
    })
    .join(", ");
}

function controlTypeOptions(func) {
  if (func === "LEC") {
    return [
      { value: "Avoidance", label: "Avoidance (reduces exposure → TEF)" },
      { value: "Deterrence", label: "Deterrence (reduces attempts → TEF)" },
      { value: "Resistance", label: "Resistance (reduces vulnerability → Susceptibility)" },
      { value: "Detection", label: "Detection (reduces loss events → LEF)" },
      { value: "Response", label: "Response (reduces LEF + LM)" },
      { value: "Resilience", label: "Resilience (reduces LM)" },
      { value: "Loss Minimization", label: "Loss Minimization (reduces LM)" },
    ];
  }
  if (func === "VMC") {
    return [
      { value: "Vulnerability Management", label: "Vulnerability Management" },
      { value: "Configuration Management", label: "Configuration Management" },
      { value: "Change Management", label: "Change Management" },
      { value: "Monitoring & Testing", label: "Monitoring & Testing" },
      { value: "Audit & Assurance", label: "Audit & Assurance" },
    ];
  }
  return [
    { value: "Governance & Policy", label: "Governance & Policy" },
    { value: "Risk Analysis & Reporting", label: "Risk Analysis & Reporting" },
    { value: "Asset & Data Management", label: "Asset & Data Management" },
    { value: "Threat Intelligence", label: "Threat Intelligence" },
    { value: "Awareness & Training", label: "Awareness & Training" },
  ];
}

const ratingOptions = [
  { value: "N/A", label: "N/A (0%)" },
  { value: "Very Low", label: "Very Low (<50%)" },
  { value: "Low", label: "Low (>50%)" },
  { value: "Moderate", label: "Moderate (>75%)" },
  { value: "High", label: "High (>90%)" },
  { value: "Very High", label: "Very High (>97%)" },
];

// -------------------- Model --------------------

function emptyControl() {
  return {
    id: uid(),
    name: "New control",
    description: "",
    owner: "",
    status: "Proposed", // Proposed | Planned | Implemented | Rejected
    includeInWhatIf: true, // used by Results to build What-If portfolio

    function: "LEC", // LEC | VMC | DSC
    type: "Avoidance",

    intendedRating: "Moderate",
    coverageRating: "Moderate",
    reliabilityRating: "Moderate",

    notes: "",
  };
}

// -------------------- Component --------------------

export default function TreatmentsView({ vendor, scenario, updateVendor }) {
  if (!vendor) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Treatments</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a vendor first.</div>
      </Card>
    );
  }

  if (!scenario) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Treatments</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a scenario first.</div>
      </Card>
    );
  }

  if (!updateVendor) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Treatments</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Missing <code>updateVendor</code> prop. Pass it from <strong>page.js</strong>.
        </div>
      </Card>
    );
  }

  const scenarioControls = useMemo(() => {
    // Canonical: scenario.controls (fallback to scenario.treatments if old data exists)
    if (Array.isArray(scenario.controls)) return scenario.controls;
    if (Array.isArray(scenario.treatments)) return scenario.treatments;
    return [];
  }, [scenario.controls, scenario.treatments]);

  const [localControls, setLocalControls] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLocalControls(scenarioControls);
    setIsDirty(false);
    setJustSaved(false);

    if (!scenarioControls.length) setActiveId("");
    else setActiveId(scenarioControls[0].id);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  useEffect(() => {
    if (!localControls.length) {
      setActiveId("");
      return;
    }
    if (!activeId || !localControls.some((c) => c.id === activeId)) {
      setActiveId(localControls[0].id);
    }
  }, [localControls, activeId]);

  const active = useMemo(() => localControls.find((c) => c.id === activeId) || null, [localControls, activeId]);

  const markDirty = () => {
    setIsDirty(true);
    setJustSaved(false);
  };

  const addControl = () => {
    const c = emptyControl();
    const next = [...localControls, c];
    setLocalControls(next);
    setActiveId(c.id);
    markDirty();
  };

  const deleteControl = (id) => {
    const next = localControls.filter((c) => c.id !== id);
    setLocalControls(next);
    setActiveId(next[0]?.id || "");
    markDirty();
  };

  const patchControl = (id, patch) => {
    setLocalControls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    markDirty();
  };

  const saveChanges = () => {
    const nextScenarios = (vendor.scenarios || []).map((s) =>
      s.id === scenario.id
        ? {
            ...s,
            // Canonical store:
            controls: localControls,
            // Optional: keep legacy field synced if you want:
            // treatments: localControls,
          }
        : s
    );

    updateVendor(vendor.id, { scenarios: nextScenarios });

    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const cancelChanges = () => {
    setLocalControls(scenarioControls);
    setIsDirty(false);
    setJustSaved(false);
    setActiveId(scenarioControls[0]?.id || "");
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Treatments (FAIR-CAM Controls)</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
              Build a control portfolio using <strong>FAIR-CAM</strong>:
              <br />
              <strong>LEC</strong> directly reduce risk drivers (TEF / Susceptibility / LEF / LM).{" "}
              <strong>VMC</strong> improves the reliability of LEC. <strong>DSC</strong> improves decision quality.
              <br />
              Use <strong>“Include in What-If”</strong> to simulate controls that are not implemented yet.
            </div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              Vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</strong> — Scenario:{" "}
              <strong>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={addControl}>
              + Add control
            </button>
            <button className="btn primary" onClick={saveChanges} disabled={!isDirty}>
              Save changes
            </button>
            <button className="btn" onClick={cancelChanges} disabled={!isDirty}>
              Cancel
            </button>

            {justSaved ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Saved ✅</div>
            ) : isDirty ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Unsaved changes</div>
            ) : null}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, alignItems: "start" }}>
        {/* Left list */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Control list</div>
            <Badge tone="neutral">{localControls.length} item(s)</Badge>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {localControls.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.8 }}>No controls yet. Click “Add control”.</div>
            ) : (
              localControls.map((c) => {
                const isActive = c.id === activeId;
                const op = operationalEffectivenessTriad(c.intendedRating, c.coverageRating, c.reliabilityRating);
                const impacts = c.function === "LEC" ? mapLecTypeToFactors(c.type) : [];
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: isActive ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                      borderRadius: 14,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{c.name?.trim() ? c.name : "(Untitled)"}</div>
                      <Badge tone={statusTone(c.status)}>{c.status || "Proposed"}</Badge>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge tone="neutral">{c.function || "LEC"}</Badge>
                      <Badge tone="neutral">{c.type || "—"}</Badge>
                      {c.function === "LEC" ? <Badge tone="neutral">Impacts: {factorsLabel(impacts)}</Badge> : null}
                      <Badge tone="neutral">OE (ML): {fmtPct01(op.ml)}</Badge>
                      {c.status !== "Implemented" && c.status !== "Rejected" ? (
                        <Badge tone={c.includeInWhatIf ? "blue" : "neutral"}>
                          What-If: {c.includeInWhatIf ? "Included" : "Off"}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right editor */}
        <Card>
          {!active ? (
            <div style={{ opacity: 0.8 }}>Select a control on the left, or click “Add control”.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>
                    {active.name?.trim() ? active.name : "(Untitled control)"}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge tone={statusTone(active.status)}>{active.status}</Badge>
                    <Badge tone="neutral">{active.function}</Badge>
                    <Badge tone="neutral">{active.type}</Badge>
                    {active.function === "LEC" ? (
                      <Badge tone="neutral">Impacts: {factorsLabel(mapLecTypeToFactors(active.type))}</Badge>
                    ) : null}
