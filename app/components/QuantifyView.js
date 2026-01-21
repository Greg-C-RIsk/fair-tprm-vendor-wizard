"use client";

import { useMemo, useState } from "react";

/**
 * QuantifyView
 * Props:
 * - state, setState (global)
 * - selectedVendor
 * - selectedScenario
 *
 * Objectif: ne JAMAIS crasher si scenario/quant est manquant.
 */

const TRIAD = (v = {}) => ({
  min: v?.min ?? "",
  ml: v?.ml ?? "",
  max: v?.max ?? "",
});

const ensureQuantShape = (q) => ({
  level: q?.level ?? "LEF",

  lef: TRIAD(q?.lef),
  tef: TRIAD(q?.tef),
  contactFrequency: TRIAD(q?.contactFrequency),
  probabilityOfAction: TRIAD(q?.probabilityOfAction),
  susceptibility: TRIAD(q?.susceptibility),

  threatCapacity: TRIAD(q?.threatCapacity),
  resistanceStrength: TRIAD(q?.resistanceStrength),

  primaryLoss: TRIAD(q?.primaryLoss),
  secondaryLossEventFrequency: TRIAD(q?.secondaryLossEventFrequency),
  secondaryLossMagnitude: TRIAD(q?.secondaryLossMagnitude),

  sims: Number.isFinite(Number(q?.sims)) ? Number(q.sims) : 10000,
  stats: q?.stats ?? null,
  aleSamples: Array.isArray(q?.aleSamples) ? q.aleSamples : [],
  pelSamples: Array.isArray(q?.pelSamples) ? q.pelSamples : [],
  lastRunAt: q?.lastRunAt ?? "",
});

function TriadRow({ label, value, onChange }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <div>
          <div className="label">Min</div>
          <input
            className="input"
            value={value.min}
            onChange={(e) => onChange({ ...value, min: e.target.value })}
            placeholder="min"
          />
        </div>
        <div>
          <div className="label">ML</div>
          <input
            className="input"
            value={value.ml}
            onChange={(e) => onChange({ ...value, ml: e.target.value })}
            placeholder="most likely"
          />
        </div>
        <div>
          <div className="label">Max</div>
          <input
            className="input"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
            placeholder="max"
          />
        </div>
      </div>
    </div>
  );
}

export default function QuantifyView({ state, setState, selectedVendor, selectedScenario }) {
  const [localError, setLocalError] = useState("");

  // ✅ Guards anti-crash
  if (!selectedVendor) {
    return (
      <div className="card card-pad">
        <div style={{ fontWeight: 800 }}>Quantification</div>
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
          Aucun vendor sélectionné.
        </div>
      </div>
    );
  }

  if (!selectedScenario) {
    return (
      <div className="card card-pad">
        <div style={{ fontWeight: 800 }}>Quantification</div>
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
          Aucun scénario sélectionné.
        </div>
      </div>
    );
  }

  // ✅ Normalise la shape pour éviter undefined partout
  const q = useMemo(() => ensureQuantShape(selectedScenario.quant), [selectedScenario.quant]);

  // ✅ Update helper (safe)
  const updateQuant = (patch) => {
    try {
      setLocalError("");
      setState((prev) => {
        const vendors = prev.vendors.map((v) => {
          if (v.id !== selectedVendor.id) return v;

          const scenarios = (v.scenarios || []).map((s) => {
            if (s.id !== selectedScenario.id) return s;

            const nextQuant = ensureQuantShape({ ...(s.quant || {}), ...patch });
            return { ...s, quant: nextQuant };
          });

          return { ...v, scenarios };
        });

        return { ...prev, vendors };
      });
    } catch (e) {
      console.error("QuantifyView updateQuant error:", e);
      setLocalError(String(e?.message || e));
    }
  };

  const updateTriad = (key, triad) => updateQuant({ [key]: triad });

  // ✅ Niveau de travail
  const levels = ["LEF", "TEF", "Contact Frequency"];

  // ✅ Champs à afficher selon niveau
  const visible = useMemo(() => {
    // On affiche tout (debug), mais tu peux conditionner ensuite
    return [
      { key: "lef", label: "LEF" },
      { key: "tef", label: "TEF" },
      { key: "contactFrequency", label: "Contact Frequency" },
      { key: "probabilityOfAction", label: "Probability of Action" },
      { key: "susceptibility", label: "Susceptibility" },
      { key: "threatCapacity", label: "Threat Capacity" },
      { key: "resistanceStrength", label: "Resistance Strength" },
      { key: "primaryLoss", label: "Primary Loss" },
      { key: "secondaryLossEventFrequency", label: "Secondary Loss Event Frequency" },
      { key: "secondaryLossMagnitude", label: "Secondary Loss Magnitude" },
    ];
  }, []);

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Quantification</div>
          <div className="h-sub" style={{ marginTop: 4 }}>
            Vendor: <b>{selectedVendor.name || "(Unnamed vendor)"}</b> — Scenario:{" "}
            <b>{selectedScenario.title || "(Untitled scenario)"}</b>
          </div>
        </div>

        <div style={{ minWidth: 260 }}>
          <div className="label">Niveau de taxonomie</div>
          <select
            className="input"
            value={q.level}
            onChange={(e) => updateQuant({ level: e.target.value })}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {localError ? (
        <div className="hint" style={{ marginTop: 12, borderColor: "rgba(248,113,113,0.35)" }}>
          <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
            QuantifyView error (caught)
          </div>
          <div style={{ marginTop: 6 }}>{localError}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {visible.map((f) => (
          <TriadRow
            key={f.key}
            label={f.label}
            value={q[f.key]}
            onChange={(triad) => updateTriad(f.key, triad)}
          />
        ))}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Simulation</div>
          <div className="label">Nombre de simulations Monte-Carlo</div>
          <input
            className="input"
            value={String(q.sims)}
            onChange={(e) => updateQuant({ sims: e.target.value })}
            placeholder="10000"
          />
          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            (Debug) Ici on branche ensuite le moteur de simulation.
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Dernier run</div>
          <div style={{ color: "rgba(255,255,255,0.75)" }}>
            {q.lastRunAt ? q.lastRunAt : "—"}
          </div>
          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            stats: {q.stats ? "OK" : "null"}
          </div>
        </div>
      </div>
    </div>
  );
}
