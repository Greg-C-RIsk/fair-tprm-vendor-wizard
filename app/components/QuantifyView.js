"use client";

import { useEffect, useMemo, useState } from "react";
import { emptyQuant } from "../../lib/model";

function RangeRow({ label, value, onChange }) {
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
      <div style={{ fontSize: 11, opacity: 0.65 }}>
        Mets des nombres (ex: 1, 5, 12). Tu peux laisser vide si tu n’as pas encore l’estimation.
      </div>
    </div>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  const scenarioId = scenario?.id || "";

  // Copie locale (on édite ici, puis Save écrit dans le state global)
  const [localQuant, setLocalQuant] = useState(emptyQuant());
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Recharger quand on change de scénario
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

  const frequencyLabel = useMemo(() => {
    if (localQuant.level === "LEF") return "Loss Event Frequency (LEF)";
    if (localQuant.level === "TEF") return "Threat Event Frequency (TEF)";
    return "Contact Frequency";
  }, [localQuant.level]);

  const frequencyValue = useMemo(() => {
    if (localQuant.level === "LEF") return localQuant.lef;
    if (localQuant.level === "TEF") return localQuant.tef;
    return localQuant.contactFrequency;
  }, [localQuant.level, localQuant.lef, localQuant.tef, localQuant.contactFrequency]);

  const setFrequencyValue = (nextRange) => {
    if (localQuant.level === "LEF") patchQuant({ lef: nextRange });
    else if (localQuant.level === "TEF") patchQuant({ tef: nextRange });
    else patchQuant({ contactFrequency: nextRange });
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

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Quantify</h2>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed)"}</strong> • Scenario:{" "}
            <strong>{scenario.title?.trim() ? scenario.title : "(Untitled)"}</strong>
          </div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Tu modifies ici, puis <strong>Save</strong> pour enregistrer. Ensuite tu peux aller sur Results.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Scenarios")}>← Back to Scenarios</button>
          <button className="btn" onClick={() => setActiveView?.("Results")}>Go to Results →</button>
        </div>
      </div>

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

      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {/* Level */}
        <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Abstraction level</div>
          <select
            className="input"
            value={localQuant.level || "LEF"}
            onChange={(e) => patchQuant({ level: e.target.value })}
          >
            <option value="LEF">LEF</option>
            <option value="TEF">TEF</option>
            <option value="Contact Frequency">Contact Frequency</option>
          </select>
        </div>

        {/* Frequency */}
        <RangeRow label={frequencyLabel} value={frequencyValue} onChange={setFrequencyValue} />

        {/* Probability / Susceptibility */}
        <RangeRow
          label="Probability of Action"
          value={localQuant.probabilityOfAction}
          onChange={(v) => patchQuant({ probabilityOfAction: v })}
        />
        <RangeRow
          label="Susceptibility"
          value={localQuant.susceptibility}
          onChange={(v) => patchQuant({ susceptibility: v })}
        />

        {/* Loss */}
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

        {/* Sims */}
        <div style={{ display: "grid", gap: 6, maxWidth: 240 }}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Simulations</div>
          <input
            className="input"
            value={localQuant.sims ?? 10000}
            onChange={(e) => patchQuant({ sims: e.target.value })}
            placeholder="10000"
          />
          <div style={{ fontSize: 11, opacity: 0.65 }}>
            Tu peux laisser 10000.
          </div>
        </div>
      </div>
    </div>
  );
}
