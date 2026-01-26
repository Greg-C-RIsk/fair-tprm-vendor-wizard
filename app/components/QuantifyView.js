"use client";

import { useEffect, useMemo, useState } from "react";
import { emptyQuant } from "../../lib/model";

function CardBlock({ title, subtitle, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function RangeRow({ label, value, onChange, help }) {
  const v = value || { min: "", ml: "", max: "" };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>{label}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input
          className="input"
          placeholder="min"
          value={v.min ?? ""}
          onChange={(e) => onChange({ ...v, min: e.target.value })}
        />
        <input
          className="input"
          placeholder="most likely"
          value={v.ml ?? ""}
          onChange={(e) => onChange({ ...v, ml: e.target.value })}
        />
        <input
          className="input"
          placeholder="max"
          value={v.max ?? ""}
          onChange={(e) => onChange({ ...v, max: e.target.value })}
        />
      </div>

      {help ? <div style={{ fontSize: 11, opacity: 0.65 }}>{help}</div> : null}
    </div>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  const scenarioId = scenario?.id || "";

  // local copy (edit here, save writes to global state)
  const [localQuant, setLocalQuant] = useState(emptyQuant());
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const q = scenario?.quant && typeof scenario.quant === "object" ? scenario.quant : emptyQuant();
    setLocalQuant({ ...emptyQuant(), ...q });
    setIsDirty(false);
    setJustSaved(false);
  }, [scenarioId]);

  const markDirty = () => {
    setIsDirty(true);
    setJustSaved(false);
  };

  const patchQuant = (patch) => {
    setLocalQuant((p) => ({ ...p, ...patch }));
    markDirty();
  };

  const save = () => {
    if (!vendor || !scenario || !updateVendor) return;

    const nextScenarios = (Array.isArray(vendor.scenarios) ? vendor.scenarios : []).map((s) =>
      s.id === scenario.id ? { ...s, quant: localQuant } : s
    );

    updateVendor(vendor.id, { scenarios: nextScenarios });
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const cancel = () => {
    const q = scenario?.quant && typeof scenario.quant === "object" ? scenario.quant : emptyQuant();
    setLocalQuant({ ...emptyQuant(), ...q });
    setIsDirty(false);
    setJustSaved(false);
  };

  if (!vendor || !scenario) {
    return (
      <div className="card card-pad">
        <h2>Quantify</h2>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Sélectionne d’abord un vendor et un scénario.
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setActiveView?.("Vendors")}>Go Vendors</button>
          <button className="btn" onClick={() => setActiveView?.("Scenarios")}>Go Scenarios</button>
        </div>
      </div>
    );
  }

  // --- Contextuel : FREQUENCE (colonne gauche)
  const level = localQuant.level || "LEF";

  const renderFrequencyLeft = () => {
    if (level === "LEF") {
      return (
        <CardBlock
          title="Frequency (LEF)"
          subtitle="Renseigne uniquement la Loss Event Frequency (min / ML / max)."
        >
          <RangeRow
            label="Loss Event Frequency (LEF)"
            value={localQuant.lef}
            onChange={(v) => patchQuant({ lef: v })}
          />
        </CardBlock>
      );
    }

    if (level === "TEF") {
      return (
        <CardBlock
          title="Frequency (TEF)"
          subtitle="Renseigne Threat Event Frequency et Vulnerability (min / ML / max)."
        >
          <div style={{ display: "grid", gap: 14 }}>
            <RangeRow
              label="Threat Event Frequency (TEF)"
              value={localQuant.tef}
              onChange={(v) => patchQuant({ tef: v })}
            />
            <RangeRow
              label="Vulnerability (Susceptibility)"
              value={localQuant.susceptibility}
              onChange={(v) => patchQuant({ susceptibility: v })}
              help="(On garde Susceptibility comme proxy de Vulnerability pour ton modèle.)"
            />
          </div>
        </CardBlock>
      );
    }

    // Contact Frequency
    return (
      <CardBlock
        title="Frequency (Contact Frequency)"
        subtitle="Renseigne Contact Frequency, Probability of Action, Threat Capacity, Resistance Strength."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <RangeRow
            label="Contact Frequency"
            value={localQuant.contactFrequency}
            onChange={(v) => patchQuant({ contactFrequency: v })}
          />
          <RangeRow
            label="Probability of Action"
            value={localQuant.probabilityOfAction}
            onChange={(v) => patchQuant({ probabilityOfAction: v })}
          />
          <RangeRow
            label="Threat Capacity"
            value={localQuant.threatCapacity}
            onChange={(v) => patchQuant({ threatCapacity: v })}
          />
          <RangeRow
            label="Resistance Strength"
            value={localQuant.resistanceStrength}
            onChange={(v) => patchQuant({ resistanceStrength: v })}
          />
        </div>
      </CardBlock>
    );
  };

  // --- Toujours visible : MAGNITUDE (colonne droite)
  const renderLossRight = () => {
    return (
      <CardBlock
        title="Magnitude (Loss)"
        subtitle="Toujours visible : Primary Loss + Secondary Loss (Frequency + Magnitude)."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <RangeRow
            label="Primary Loss"
            value={localQuant.primaryLoss}
            onChange={(v) => patchQuant({ primaryLoss: v })}
          />
          <RangeRow
            label="Secondary Loss Event Frequency"
            value={localQuant.secondaryLossEventFrequency}
            onChange={(v) => patchQuant({ secondaryLossEventFrequency: v })}
          />
          <RangeRow
            label="Secondary Loss Magnitude"
            value={localQuant.secondaryLossMagnitude}
            onChange={(v) => patchQuant({ secondaryLossMagnitude: v })}
          />
        </div>
      </CardBlock>
    );
  };

  return (
    <div className="card card-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Quantify</h2>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed)"}</strong> • Scenario:{" "}
            <strong>{scenario.title?.trim() ? scenario.title : "(Untitled)"}</strong>
          </div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Édite → <strong>Save</strong> → Results.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Scenarios")}>← Back to Scenarios</button>
          <button className="btn" onClick={() => setActiveView?.("Results")}>Go to Results →</button>
        </div>
      </div>

      {/* Save/Cancel */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn primary" onClick={save} disabled={!isDirty}>
          Save
        </button>
        <button className="btn" onClick={cancel} disabled={!isDirty}>
          Cancel
        </button>
        {justSaved ? (
          <div style={{ fontSize: 12, opacity: 0.85 }}>Saved ✅</div>
        ) : isDirty ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Unsaved changes</div>
        ) : null}
      </div>

      {/* Abstraction level */}
      <div style={{ marginTop: 16, maxWidth: 420 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Abstraction level</div>
        <select
          className="input"
          value={level}
          onChange={(e) => patchQuant({ level: e.target.value })}
        >
          <option value="LEF">LEF</option>
          <option value="TEF">TEF</option>
          <option value="Contact Frequency">Contact Frequency</option>
        </select>
      </div>

      {/* Two-column layout: Frequency (left) / Magnitude (right) */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {renderFrequencyLeft()}

          <CardBlock title="Simulation" subtitle="Optionnel (tu peux laisser 10000).">
            <div style={{ display: "grid", gap: 6, maxWidth: 240 }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Simulations</div>
              <input
                className="input"
                value={localQuant.sims ?? 10000}
                onChange={(e) => patchQuant({ sims: e.target.value })}
                placeholder="10000"
              />
            </div>
          </CardBlock>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {renderLossRight()}
        </div>
      </div>
    </div>
  );
}
