"use client";

import { useEffect, useMemo, useState } from "react";
import { uid } from "../../lib/model";

// -------------------- Small UI helpers (DECLARED OUTSIDE to avoid focus loss) --------------------

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

function NumField({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <input
        className="input"
        value={value ?? ""}
        placeholder={placeholder || ""}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
      />
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

function toPctNumber(x) {
  if (x === "" || x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// -------------------- Model helpers --------------------

function emptyTreatment() {
  return {
    id: uid(),
    name: "New treatment",
    category: "Preventive", // Preventive | Detective | Corrective
    affects: "Frequency", // Frequency | Magnitude | Both
    status: "Proposed", // Proposed | Planned | Implemented | Rejected
    owner: "",
    description: "",
    // Training-friendly “effect” fields (simple, not over-scientific)
    // % reductions are 0..100
    reduceFrequencyPct: "",
    reduceMagnitudePct: "",
    costEstimate: "",
    notes: "",
  };
}

function summarizeEffect(t) {
  const rf = toPctNumber(t.reduceFrequencyPct);
  const rm = toPctNumber(t.reduceMagnitudePct);

  const parts = [];
  if (rf !== null) parts.push(`-${rf}% freq`);
  if (rm !== null) parts.push(`-${rm}% mag`);
  return parts.length ? parts.join(" / ") : "No effect set";
}

function statusTone(status) {
  if (status === "Implemented") return "good";
  if (status === "Planned") return "blue";
  if (status === "Rejected") return "bad";
  return "neutral"; // Proposed
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
          Missing <code>updateVendor</code> prop. Go back to <strong>page.js</strong> and pass it to
          TreatmentsView.
        </div>
      </Card>
    );
  }

  const scenarioTreatments = useMemo(() => {
    return Array.isArray(scenario.treatments) ? scenario.treatments : [];
  }, [scenario.treatments]);

  // Local working copy (avoid editing vendor state on each keystroke)
  const [localTreatments, setLocalTreatments] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLocalTreatments(scenarioTreatments);
    setIsDirty(false);
    setJustSaved(false);

    if (!scenarioTreatments.length) {
      setActiveId("");
    } else if (!activeId || !scenarioTreatments.some((t) => t.id === activeId)) {
      setActiveId(scenarioTreatments[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  useEffect(() => {
    if (!localTreatments.length) {
      setActiveId("");
      return;
    }
    if (!activeId || !localTreatments.some((t) => t.id === activeId)) {
      setActiveId(localTreatments[0].id);
    }
  }, [localTreatments, activeId]);

  const active = useMemo(() => {
    return localTreatments.find((t) => t.id === activeId) || null;
  }, [localTreatments, activeId]);

  const markDirty = () => {
    setIsDirty(true);
    setJustSaved(false);
  };

  const addTreatment = () => {
    const t = emptyTreatment();
    const next = [...localTreatments, t];
    setLocalTreatments(next);
    setActiveId(t.id);
    markDirty();
  };

  const deleteTreatment = (id) => {
    const next = localTreatments.filter((t) => t.id !== id);
    setLocalTreatments(next);
    setActiveId(next[0]?.id || "");
    markDirty();
  };

  const patchTreatment = (id, patch) => {
    setLocalTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    markDirty();
  };

  const saveChanges = () => {
    const nextScenarios = (vendor.scenarios || []).map((s) =>
      s.id === scenario.id ? { ...s, treatments: localTreatments } : s
    );
    updateVendor(vendor.id, { scenarios: nextScenarios });
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const cancelChanges = () => {
    setLocalTreatments(scenarioTreatments);
    setIsDirty(false);
    setJustSaved(false);
    setActiveId(scenarioTreatments[0]?.id || "");
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Treatments</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
              Treatments are actions that reduce <strong>frequency</strong>, <strong>magnitude</strong>, or both.
              Keep them simple: what you do, who owns it, and what effect you expect.
            </div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              Vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</strong> — Scenario:{" "}
              <strong>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={addTreatment}>
              + Add treatment
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

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
        {/* Left list */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Treatment list</div>
            <Badge tone="neutral">{localTreatments.length} item(s)</Badge>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {localTreatments.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.8 }}>No treatments yet. Click “Add treatment”.</div>
            ) : (
              localTreatments.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
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
                      <div style={{ fontWeight: 950 }}>{t.name?.trim() ? t.name : "(Untitled)"}</div>
                      <Badge tone={statusTone(t.status)}>{t.status || "Proposed"}</Badge>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge tone="neutral">{t.category || "Preventive"}</Badge>
                      <Badge tone="neutral">Affects: {t.affects || "Frequency"}</Badge>
                      <Badge tone="neutral">{summarizeEffect(t)}</Badge>
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
            <div style={{ opacity: 0.8 }}>Select a treatment on the left, or click “Add treatment”.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>
                    {active.name?.trim() ? active.name : "(Untitled treatment)"}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge tone={statusTone(active.status)}>{active.status}</Badge>
                    <Badge tone="neutral">{active.category}</Badge>
                    <Badge tone="neutral">Affects: {active.affects}</Badge>
                    <Badge tone="neutral">{summarizeEffect(active)}</Badge>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => deleteTreatment(active.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field
                  label="Treatment name"
                  value={active.name}
                  placeholder="Example: Enforce MFA for vendor admin accounts"
                  onChange={(v) => patchTreatment(active.id, { name: v })}
                />

                <Field
                  label="Owner"
                  value={active.owner}
                  placeholder="Example: Vendor Security Manager"
                  onChange={(v) => patchTreatment(active.id, { owner: v })}
                />

                <SelectField
                  label="Category"
                  value={active.category}
                  onChange={(v) => patchTreatment(active.id, { category: v })}
                  options={[
                    { value: "Preventive", label: "Preventive (stops events)" },
                    { value: "Detective", label: "Detective (finds events)" },
                    { value: "Corrective", label: "Corrective (limits impact)" },
                  ]}
                />

                <SelectField
                  label="Status"
                  value={active.status}
                  onChange={(v) => patchTreatment(active.id, { status: v })}
                  options={[
                    { value: "Proposed", label: "Proposed" },
                    { value: "Planned", label: "Planned" },
                    { value: "Implemented", label: "Implemented" },
                    { value: "Rejected", label: "Rejected" },
                  ]}
                />

                <SelectField
                  label="Affects"
                  value={active.affects}
                  onChange={(v) => patchTreatment(active.id, { affects: v })}
                  options={[
                    { value: "Frequency", label: "Frequency (reduce how often it happens)" },
                    { value: "Magnitude", label: "Magnitude (reduce loss per event)" },
                    { value: "Both", label: "Both" },
                  ]}
                />

                <NumField
                  label="Cost estimate (optional)"
                  value={active.costEstimate}
                  placeholder="Example: 15000"
                  onChange={(v) => patchTreatment(active.id, { costEstimate: v })}
                />

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field
                    label="Description (what is it?)"
                    value={active.description}
                    placeholder="Short description of the control / action."
                    textarea
                    onChange={(v) => patchTreatment(active.id, { description: v })}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>Expected effect (simple)</div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                      For training, we represent effect as a percentage reduction. Later we can “apply” these to the
                      Monte Carlo inputs.
                    </div>
                  </div>
                </div>

                <NumField
                  label="Reduce Frequency (%)"
                  value={active.reduceFrequencyPct}
                  placeholder="0 to 100"
                  onChange={(v) => patchTreatment(active.id, { reduceFrequencyPct: v })}
                />

                <NumField
                  label="Reduce Magnitude (%)"
                  value={active.reduceMagnitudePct}
                  placeholder="0 to 100"
                  onChange={(v) => patchTreatment(active.id, { reduceMagnitudePct: v })}
                />

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field
                    label="Notes / assumptions"
                    value={active.notes}
                    placeholder="Example: Assumes MFA adoption by all vendor admins within 30 days..."
                    textarea
                    onChange={(v) => patchTreatment(active.id, { notes: v })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Training note</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                  In FAIR terms, treatments usually reduce <strong>LEF</strong> (frequency) and/or <strong>Loss Magnitude</strong>.
                  We keep it simple here so you can practice: define the action, ownership, and expected impact.
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
