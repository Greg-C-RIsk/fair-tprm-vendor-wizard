"use client";

import { useEffect, useMemo, useState } from "react";
import { uid } from "../../lib/model";

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

function Field({ label, value, onChange, placeholder, textarea, rows = 5 }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      {textarea ? (
        <textarea
          className="textarea"
          value={value ?? ""}
          placeholder={placeholder || ""}
          rows={rows}
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
    purple: { bg: "rgba(168,85,247,0.18)", br: "rgba(168,85,247,0.35)" },
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

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />;
}

// -------------------- FAIR-CAM model (embedded) --------------------

// Rating scale for efficacy, coverage, reliability -> min / ml / max (0..1)
const RATING_SCALE = {
  "N/A": { min: 0.0, ml: 0.0, max: 0.0 },
  "Very Low": { min: 0.0, ml: 0.25, max: 0.499 },
  Low: { min: 0.5, ml: 0.675, max: 0.749 },
  Moderate: { min: 0.75, ml: 0.825, max: 0.899 },
  High: { min: 0.9, ml: 0.935, max: 0.969 },
  "Very High": { min: 0.97, ml: 0.985, max: 0.999 },
};

const FUNCTION_OPTIONS = [
  { value: "LEC", label: "LEC — Loss Event Control (direct risk reduction)" },
  { value: "VMC", label: "VMC — Variance Management (control reliability)" },
  { value: "DSC", label: "DSC — Decision Support (better decisions)" },
];

const CONTROL_TYPES = {
  LEC: [
    { value: "Avoidance", label: "Avoidance — prevent exposure to threat events", hint: "Typically reduces TEF by avoiding exposure altogether." },
    { value: "Deterrence", label: "Deterrence — discourage threat activity", hint: "Typically reduces TEF by making attacks less attractive." },
    { value: "Resistance", label: "Resistance — make it harder for the threat to succeed", hint: "Primarily reduces vulnerability / susceptibility." },
    { value: "Detection", label: "Detection — identify events or compromises", hint: "Influences LEF by shortening time to detect." },
    { value: "Response", label: "Response — contain and eradicate events", hint: "Influences LEF and LM by containing spread and duration." },
    { value: "Resilience", label: "Resilience — maintain or restore service", hint: "Primarily reduces LM by limiting downtime / impact." },
    { value: "Loss Minimization", label: "Loss Minimization — limit the size of losses", hint: "Primarily reduces LM (segmentation, contractual limits, backups, insurance…)." },
  ],
  VMC: [
    { value: "Vulnerability Management", label: "Vulnerability Management", hint: "Improves the reliability of resistance controls and patch/config posture." },
    { value: "Configuration Management", label: "Configuration Management", hint: "Reduces variance and misconfig risk across many LEC." },
    { value: "Change Management", label: "Change Management", hint: "Prevents changes from degrading control effectiveness." },
    { value: "Monitoring & Testing", label: "Monitoring & testing of controls", hint: "Detects control failures and drift over time." },
    { value: "Audit & Assurance", label: "Audit & Assurance of controls", hint: "Independent confirmation that controls perform as designed." },
  ],
  DSC: [
    { value: "Governance & Policy", label: "Governance & Policy", hint: "Guides which controls exist and how they are used." },
    { value: "Risk Analysis & Reporting", label: "Risk Analysis & Reporting", hint: "Improves how risk and control choices are prioritised." },
    { value: "Asset & Data Management", label: "Asset & Data Management", hint: "Enables scoping and coverage decisions for LEC/VMC." },
    { value: "Threat Intelligence", label: "Threat Intelligence", hint: "Improves where and how LEC/VMC are targeted against real threats." },
    { value: "Awareness & Training", label: "Awareness & Training", hint: "Improves decisions and behaviours that drive control performance." },
  ],
};

// Map LEC types to FAIR factors for pedagogy (high-level)
function mapLecTypeToFactors(type) {
  const t = String(type || "");
  const factors = [];
  if (t === "Avoidance" || t === "Deterrence") factors.push("TEF");
  if (t === "Resistance") factors.push("Vulnerability / Susceptibility");
  if (t === "Detection") factors.push("LEF");
  if (t === "Response") factors.push("LEF", "Loss Magnitude");
  if (t === "Resilience" || t === "Loss Minimization") factors.push("Loss Magnitude");
  return factors;
}

function factorsLabel(arr) {
  if (!arr?.length) return "—";
  return arr.join(", ");
}

function deriveOverallRating(ml) {
  if (ml >= 0.97) return "Very High";
  if (ml >= 0.9) return "High";
  if (ml >= 0.75) return "Moderate";
  if (ml >= 0.5) return "Low";
  if (ml > 0) return "Very Low";
  return "N/A";
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function opEffectivenessFromRatings(intended, coverage, reliability) {
  const i = RATING_SCALE[intended] || RATING_SCALE["N/A"];
  const c = RATING_SCALE[coverage] || RATING_SCALE["N/A"];
  const r = RATING_SCALE[reliability] || RATING_SCALE["N/A"];

  const min = clamp01(i.min * c.min * r.min);
  const ml = clamp01(i.ml * c.ml * r.ml);
  const max = clamp01(i.max * c.max * r.max);

  return { min, ml, max, rating: deriveOverallRating(ml) };
}

function statusTone(status) {
  if (status === "Implemented") return "good";
  if (status === "Planned") return "blue";
  if (status === "Rejected") return "bad";
  return "neutral"; // Proposed
}

function functionTone(fn) {
  if (fn === "LEC") return "warn";
  if (fn === "VMC") return "purple";
  if (fn === "DSC") return "blue";
  return "neutral";
}

function pct(n) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

// -------------------- Control model --------------------

function emptyControl() {
  return {
    id: uid(),
    name: "New control",
    description: "",
    function: "LEC", // LEC | VMC | DSC
    type: "Resistance",
    status: "Proposed", // Proposed | Planned | Implemented | Rejected
    owner: "",
    // What-if flag: allows simulation without being implemented
    includeInWhatIf: true,
    // Ratings (qualitative -> used to compute operational effectiveness triad)
    intended: "N/A",
    coverage: "N/A",
    reliability: "N/A",
    notes: "",
  };
}

function getTypeOptions(fn) {
  return CONTROL_TYPES[fn] || [];
}

function typeHint(fn, type) {
  const list = CONTROL_TYPES[fn] || [];
  const match = list.find((t) => t.value === type);
  return match?.hint || "";
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

  // We store FAIR-CAM controls in scenario.controls (but keep backward compatibility)
  const storedControls = useMemo(() => {
    if (Array.isArray(scenario.controls)) return scenario.controls;
    if (Array.isArray(scenario.treatments)) return scenario.treatments; // fallback from older versions
    return [];
  }, [scenario.controls, scenario.treatments]);

  const [localControls, setLocalControls] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLocalControls(storedControls);
    setIsDirty(false);
    setJustSaved(false);

    if (!storedControls.length) setActiveId("");
    else setActiveId(storedControls[0]?.id || "");
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
      s.id === scenario.id ? { ...s, controls: localControls } : s
    );
    updateVendor(vendor.id, { scenarios: nextScenarios });
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const cancelChanges = () => {
    setLocalControls(storedControls);
    setIsDirty(false);
    setJustSaved(false);
    setActiveId(storedControls[0]?.id || "");
  };

  const activeOp = useMemo(() => {
    if (!active) return null;
    return opEffectivenessFromRatings(active.intended, active.coverage, active.reliability);
  }, [active]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Treatments</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
              Here, a “treatment” is modeled as a <strong>FAIR-CAM control</strong> (LEC / VMC / DSC). We capture how it
              impacts risk drivers and estimate <strong>operational effectiveness</strong> (intended efficacy × coverage × reliability).
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
                const op = opEffectivenessFromRatings(c.intended, c.coverage, c.reliability);

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
                      <Badge tone={functionTone(c.function)}>{c.function || "LEC"}</Badge>
                      <Badge tone="neutral">{c.type || "—"}</Badge>
                      <Badge tone="neutral">OpEff (ML): {pct(op.ml)}</Badge>
                      {c.status !== "Implemented" && c.status !== "Rejected" ? (
                        <Badge tone={c.includeInWhatIf ? "good" : "neutral"}>
                          What-if: {c.includeInWhatIf ? "Included" : "Excluded"}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Divider />

          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Rating scale (training)</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            “Operational effectiveness” is computed as <strong>Intended × Coverage × Reliability</strong> using a min/ML/max scale.
            This is a simplified training representation aligned with FAIR-CAM reasoning.
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
                    <Badge tone={functionTone(active.function)}>{active.function}</Badge>
                    <Badge tone="neutral">{active.type}</Badge>
                    {activeOp ? <Badge tone="neutral">OpEff (Min/ML/Max): {pct(activeOp.min)} / {pct(activeOp.ml)} / {pct(activeOp.max)}</Badge> : null}
                    {activeOp ? <Badge tone="neutral">Overall: {activeOp.rating}</Badge> : null}
                    {active.function === "LEC" ? (
                      <Badge tone="neutral">Impacts: {factorsLabel(mapLecTypeToFactors(active.type))}</Badge>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => deleteControl(active.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field
                  label="Control name"
                  value={active.name}
                  placeholder="Example: Enforce MFA for vendor admin accounts"
                  onChange={(v) => patchControl(active.id, { name: v })}
                />

                <Field
                  label="Owner"
                  value={active.owner}
                  placeholder="Example: Vendor Security Manager"
                  onChange={(v) => patchControl(active.id, { owner: v })}
                />

                <SelectField
                  label="FAIR-CAM Function"
                  value={active.function}
                  onChange={(v) => {
                    const nextFn = v;
                    const firstType = getTypeOptions(nextFn)[0]?.value || "";
                    patchControl(active.id, { function: nextFn, type: firstType });
                  }}
                  options={FUNCTION_OPTIONS}
                />

                <SelectField
                  label="Control type"
                  value={active.type}
                  onChange={(v) => patchControl(active.id, { type: v })}
                  options={[
                    { value: "", label: "Select a type" },
                    ...getTypeOptions(active.function).map((t) => ({ value: t.value, label: t.label })),
                  ]}
                />

                <SelectField
                  label="Status"
                  value={active.status}
                  onChange={(v) => patchControl(active.id, { status: v })}
                  options={[
                    { value: "Proposed", label: "Proposed" },
                    { value: "Planned", label: "Planned" },
                    { value: "Implemented", label: "Implemented" },
                    { value: "Rejected", label: "Rejected" },
                  ]}
                />

                <div style={{ display: "grid", gap: 6 }}>
                  <Label>What-if simulation</Label>
                  <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
                    Use this to test a control’s impact <strong>without implementing it</strong>. Implemented controls are always part of the baseline.
                  </div>

                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                    <input
                      type="checkbox"
                      checked={!!active.includeInWhatIf}
                      disabled={active.status === "Implemented" || active.status === "Rejected"}
                      onChange={(e) => patchControl(active.id, { includeInWhatIf: e.target.checked })}
                    />
                    Include in What-If (only when Proposed/Planned)
                  </label>

                  {(active.status === "Implemented" || active.status === "Rejected") ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      This flag is disabled because the control is <strong>{active.status}</strong>.
                    </div>
                  ) : null}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field
                    label="Description"
                    value={active.description}
                    placeholder="What does the control do, in one paragraph?"
                    textarea
                    rows={4}
                    onChange={(v) => patchControl(active.id, { description: v })}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Divider />
                  <div style={{ fontSize: 14, fontWeight: 950 }}>Operational effectiveness ratings</div>
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                    Rate <strong>Intended efficacy</strong>, <strong>Coverage</strong>, and <strong>Reliability</strong>. The tool computes
                    operational effectiveness as a <strong>min / most likely / max</strong> triad.
                  </div>
                </div>

                <SelectField
                  label="Intended efficacy"
                  value={active.intended}
                  onChange={(v) => patchControl(active.id, { intended: v })}
                  options={Object.keys(RATING_SCALE).map((k) => ({ value: k, label: k }))}
                />

                <SelectField
                  label="Coverage"
                  value={active.coverage}
                  onChange={(v) => patchControl(active.id, { coverage: v })}
                  options={Object.keys(RATING_SCALE).map((k) => ({ value: k, label: k }))}
                />

                <SelectField
                  label="Reliability"
                  value={active.reliability}
                  onChange={(v) => patchControl(active.id, { reliability: v })}
                  options={Object.keys(RATING_SCALE).map((k) => ({ value: k, label: k }))}
                />

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ fontWeight: 950 }}>Type hint</div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                      {typeHint(active.function, active.type) || "—"}
                    </div>
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field
                    label="Notes / assumptions"
                    value={active.notes}
                    placeholder="Example: assumes MFA enrollment for all vendor admins within 30 days..."
                    textarea
                    rows={5}
                    onChange={(v) => patchControl(active.id, { notes: v })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Training note (FAIR-CAM)</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                  <strong>LEC</strong> directly reduce risk drivers (TEF / Vulnerability / LEF / Loss Magnitude).{" "}
                  <strong>VMC</strong> and <strong>DSC</strong> usually improve stability and decision quality, which indirectly improves risk reduction.
                  Next step: we’ll connect these controls to Monte Carlo results (Baseline vs What-if).
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
