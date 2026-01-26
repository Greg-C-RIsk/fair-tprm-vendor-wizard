"use client";

import { useEffect, useMemo, useState } from "react";

function Card({ children, style }) {
  return (
    <div className="card card-pad" style={style}>
      {children}
    </div>
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
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Triad({ label, value, onChange, hint }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>{label}</div>
      {hint ? <div style={{ fontSize: 12, opacity: 0.7 }}>{hint}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input
          className="input"
          inputMode="decimal"
          placeholder="min"
          value={value?.min ?? ""}
          onChange={(e) => set("min", e.target.value)}
        />
        <input
          className="input"
          inputMode="decimal"
          placeholder="most likely"
          value={value?.ml ?? ""}
          onChange={(e) => set("ml", e.target.value)}
        />
        <input
          className="input"
          inputMode="decimal"
          placeholder="max"
          value={value?.max ?? ""}
          onChange={(e) => set("max", e.target.value)}
        />
      </div>
    </div>
  );
}

function parseNum(x) {
  if (x === null || x === undefined) return null;
  const s = String(x).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function triadWarning(t) {
  const a = parseNum(t?.min);
  const b = parseNum(t?.ml);
  const c = parseNum(t?.max);
  if (a === null || b === null || c === null) return null; // only validate when all 3 filled
  if (a > b || b > c) return "⚠️ Check ordering (min ≤ ML ≤ max)";
  return null;
}

export default function QuantifyView({ vendor, scenario, updateVendor }) {
  const canEdit = !!vendor && !!scenario && typeof updateVendor === "function";

  // Local draft (no auto-save)
  const [draft, setDraft] = useState(null);
  const [savedAt, setSavedAt] = useState("");

  // (re)load draft when scenario changes
  useEffect(() => {
    if (!scenario?.quant) {
      setDraft(null);
      return;
    }
    // deep clone for safe editing
    setDraft(JSON.parse(JSON.stringify(scenario.quant)));
    setSavedAt("");
  }, [scenario?.id]); // important: only when scenario changes

  const dirty = useMemo(() => {
    if (!scenario?.quant || !draft) return false;
    try {
      return JSON.stringify(scenario.quant) !== JSON.stringify(draft);
    } catch {
      return true;
    }
  }, [scenario?.quant, draft]);

  const warnings = useMemo(() => {
    if (!draft) return [];
    const checks = [
      ["LEF", triadWarning(draft.lef)],
      ["TEF", triadWarning(draft.tef)],
      ["Contact Frequency", triadWarning(draft.contactFrequency)],
      ["Probability of Action", triadWarning(draft.probabilityOfAction)],
      ["Susceptibility", triadWarning(draft.susceptibility)],
      ["Threat Capacity", triadWarning(draft.threatCapacity)],
      ["Resistance Strength", triadWarning(draft.resistanceStrength)],
      ["Primary Loss", triadWarning(draft.primaryLoss)],
      ["Secondary Loss Event Frequency", triadWarning(draft.secondaryLossEventFrequency)],
      ["Secondary Loss Magnitude", triadWarning(draft.secondaryLossMagnitude)],
    ]
      .filter(([, w]) => !!w)
      .map(([k, w]) => `${k}: ${w}`);

    return checks;
  }, [draft]);

  const doSave = () => {
    if (!canEdit || !draft) return;

    const scenarios = Array.isArray(vendor.scenarios) ? vendor.scenarios : [];
    const nextScenarios = scenarios.map((s) =>
      s.id === scenario.id ? { ...s, quant: JSON.parse(JSON.stringify(draft)) } : s
    );

    updateVendor(vendor.id, { scenarios: nextScenarios });
    setSavedAt(new Date().toLocaleString());
  };

  const revert = () => {
    if (!scenario?.quant) return;
    setDraft(JSON.parse(JSON.stringify(scenario.quant)));
    setSavedAt("");
  };

  if (!vendor) {
    return (
      <Card>
        <h2>Quantify</h2>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a vendor first.</div>
      </Card>
    );
  }

  if (!scenario) {
    return (
      <Card>
        <h2>Quantify</h2>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a scenario first.</div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Quantify (FAIR inputs only)</h2>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              Vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed)"}</strong> • Scenario:{" "}
              <strong>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</strong>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>Draft: {dirty ? "Unsaved changes" : "Saved"}</Pill>
              {savedAt ? <Pill>Saved at: {savedAt}</Pill> : null}
              <Pill>Mode: {draft?.level || "LEF"}</Pill>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={revert} disabled={!dirty}>
              Revert
            </button>
            <button className="btn primary" onClick={doSave} disabled={!dirty || !canEdit}>
              Save
            </button>
          </div>
        </div>

        {warnings.length ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800, marginBottom: 6 }}>
              Validation hints (non-blocking)
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              {warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Form */}
      <Card>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Level */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Abstraction level</div>
            <select
              className="input"
              value={draft?.level || "LEF"}
              onChange={(e) => setDraft((p) => ({ ...(p || {}), level: e.target.value }))}
            >
              {["LEF", "TEF", "Contact Frequency"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

          {/* Frequency */}
          <div style={{ fontSize: 14, fontWeight: 900 }}>Frequency inputs</div>
          <Triad
            label="LEF (Loss Event Frequency)"
            value={draft?.lef}
            onChange={(next) => setDraft((p) => ({ ...p, lef: next }))}
            hint="If you already estimate LEF directly, fill this first."
          />
          <Triad
            label="TEF (Threat Event Frequency)"
            value={draft?.tef}
            onChange={(next) => setDraft((p) => ({ ...p, tef: next }))}
          />
          <Triad
            label="Contact Frequency"
            value={draft?.contactFrequency}
            onChange={(next) => setDraft((p) => ({ ...p, contactFrequency: next }))}
          />
          <Triad
            label="Probability of Action"
            value={draft?.probabilityOfAction}
            onChange={(next) => setDraft((p) => ({ ...p, probabilityOfAction: next }))}
          />
          <Triad
            label="Susceptibility"
            value={draft?.susceptibility}
            onChange={(next) => setDraft((p) => ({ ...p, susceptibility: next }))}
            hint="Training: keep as direct estimate (min / ML / max)."
          />

          <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

          {/* Capability / Resistance (optional) */}
          <div style={{ fontSize: 14, fontWeight: 900 }}>Optional (capability / resistance)</div>
          <Triad
            label="Threat Capacity"
            value={draft?.threatCapacity}
            onChange={(next) => setDraft((p) => ({ ...p, threatCapacity: next }))}
          />
          <Triad
            label="Resistance Strength"
            value={draft?.resistanceStrength}
            onChange={(next) => setDraft((p) => ({ ...p, resistanceStrength: next }))}
          />

          <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

          {/* Loss */}
          <div style={{ fontSize: 14, fontWeight: 900 }}>Loss inputs</div>
          <Triad
            label="Primary Loss (currency)"
            value={draft?.primaryLoss}
            onChange={(next) => setDraft((p) => ({ ...p, primaryLoss: next }))}
          />
          <Triad
            label="Secondary Loss Event Frequency"
            value={draft?.secondaryLossEventFrequency}
            onChange={(next) => setDraft((p) => ({ ...p, secondaryLossEventFrequency: next }))}
          />
          <Triad
            label="Secondary Loss Magnitude (currency)"
            value={draft?.secondaryLossMagnitude}
            onChange={(next) => setDraft((p) => ({ ...p, secondaryLossMagnitude: next }))}
          />

          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            Note: no Monte Carlo / charts here. This tab only stores FAIR estimation inputs (min / ML / max).
          </div>
        </div>
      </Card>
    </div>
  );
}
