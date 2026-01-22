"use client";

import { useMemo } from "react";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const tri = (x) => ({
  min: x?.min ?? "",
  ml: x?.ml ?? "",
  max: x?.max ?? "",
});

const ensureQuant = (scenario) => {
  const q = scenario?.quant || {};
  return {
    level: q.level || "LEF", // "LEF" | "TEF" | "Contact Frequency"
    susceptibilityMode: q.susceptibilityMode || "Direct", // "Direct" | "FromCapacityVsResistance"

    // frequency chain
    lef: tri(q.lef),
    tef: tri(q.tef),
    contactFrequency: tri(q.contactFrequency),
    probabilityOfAction: tri(q.probabilityOfAction),
    susceptibility: tri(q.susceptibility),

    threatCapacity: tri(q.threatCapacity),
    resistanceStrength: tri(q.resistanceStrength),

    // loss
    primaryLoss: tri(q.primaryLoss),
    secondaryLossEventFrequency: tri(q.secondaryLossEventFrequency),
    secondaryLossMagnitude: tri(q.secondaryLossMagnitude),

    // computed
    results: q.results || null,
  };
};

const isFiniteNumber = (v) => Number.isFinite(Number(v));

const validateTriad = (t) => {
  const a = Number(t.min);
  const m = Number(t.ml);
  const b = Number(t.max);
  return [a, m, b].every((x) => Number.isFinite(x)) && b >= a;
};

// training-friendly mapping from (TC, RS) -> susceptibility (0..1)
const deriveSusceptibility01 = (tc, rs) => {
  const k = 2; // softness
  const z = (tc - rs) / k;
  const s = 1 / (1 + Math.exp(-z));
  return clamp01(s);
};

function TriadCard({ title, unit, hint, value, onChange, placeholders }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {unit ? <div style={{ fontSize: 12, opacity: 0.7 }}>{unit}</div> : null}
      </div>
      {hint ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{hint}</div> : null}

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {["min", "ml", "max"].map((k) => (
          <div key={k}>
            <div className="label">{k.toUpperCase()}</div>
            <input
              className="input"
              inputMode="decimal"
              value={value[k]}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              placeholder={placeholders?.[k] || ""}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor) return <div className="card card-pad">Select a vendor.</div>;
  if (!scenario) return <div className="card card-pad">Create/select a scenario to quantify.</div>;

  const q = ensureQuant(scenario);

  const updateScenarioQuant = (patch) => {
    const scenarios = vendor.scenarios || [];
    updateVendor(vendor.id, {
      scenarios: scenarios.map((s) => (s.id === scenario.id ? { ...s, quant: { ...ensureQuant(s), ...patch } } : s)),
    });
  };

  const missing = useMemo(() => {
    const miss = [];

    // loss always required
    if (!validateTriad(q.primaryLoss)) miss.push("Primary Loss (min/ML/max)");
    if (!validateTriad(q.secondaryLossEventFrequency)) miss.push("Secondary Loss Event Frequency (min/ML/max)");
    if (!validateTriad(q.secondaryLossMagnitude)) miss.push("Secondary Loss Magnitude (min/ML/max)");

    // frequency inputs depend on abstraction level
    if (q.level === "LEF") {
      if (!validateTriad(q.lef)) miss.push("LEF (min/ML/max)");
    }
    if (q.level === "TEF") {
      if (!validateTriad(q.tef)) miss.push("TEF (min/ML/max)");
    }
    if (q.level === "Contact Frequency") {
      if (!validateTriad(q.contactFrequency)) miss.push("Contact Frequency (min/ML/max)");
      if (!validateTriad(q.probabilityOfAction)) miss.push("Probability of Action (min/ML/max)");
    }

    // susceptibility inputs if needed
    if (q.level !== "LEF") {
      if (q.susceptibilityMode === "Direct") {
        if (!validateTriad(q.susceptibility)) miss.push("Susceptibility (min/ML/max)");
      } else {
        if (!validateTriad(q.threatCapacity)) miss.push("Threat Capacity (min/ML/max)");
        if (!validateTriad(q.resistanceStrength)) miss.push("Resistance Strength (min/ML/max)");
      }
    }

    return miss;
  }, [q]);

  const computeResults = () => {
    if (missing.length) {
      alert("Missing / invalid inputs:\n- " + missing.join("\n- "));
      return;
    }

    // Helper to pick numbers
    const N = (v) => Number(v);

    // Susceptibility triad -> (min/ml/max) in 0..1
    const susc01 = (() => {
      if (q.level === "LEF") return { min: 1, ml: 1, max: 1 }; // not used
      if (q.susceptibilityMode === "Direct") {
        return {
          min: clamp01(N(q.susceptibility.min) / 100),
          ml: clamp01(N(q.susceptibility.ml) / 100),
          max: clamp01(N(q.susceptibility.max) / 100),
        };
      }
      // derived from TC/RS
      return {
        min: deriveSusceptibility01(N(q.threatCapacity.min), N(q.resistanceStrength.max)),
        ml: deriveSusceptibility01(N(q.threatCapacity.ml), N(q.resistanceStrength.ml)),
        max: deriveSusceptibility01(N(q.threatCapacity.max), N(q.resistanceStrength.min)),
      };
    })();

    // Compute LEF triad
    const lef = (() => {
      if (q.level === "LEF") {
        return { min: N(q.lef.min), ml: N(q.lef.ml), max: N(q.lef.max) };
      }
      if (q.level === "TEF") {
        return {
          min: N(q.tef.min) * susc01.min,
          ml: N(q.tef.ml) * susc01.ml,
          max: N(q.tef.max) * susc01.max,
        };
      }
      // Contact Frequency
      const tef = {
        min: N(q.contactFrequency.min) * clamp01(N(q.probabilityOfAction.min) / 100),
        ml: N(q.contactFrequency.ml) * clamp01(N(q.probabilityOfAction.ml) / 100),
        max: N(q.contactFrequency.max) * clamp01(N(q.probabilityOfAction.max) / 100),
      };
      return {
        min: tef.min * susc01.min,
        ml: tef.ml * susc01.ml,
        max: tef.max * susc01.max,
      };
    })();

    // Compute PEL triad (per-event loss exposure)
    const pel = (() => {
      const primary = { min: N(q.primaryLoss.min), ml: N(q.primaryLoss.ml), max: N(q.primaryLoss.max) };
      const slef = {
        min: N(q.secondaryLossEventFrequency.min),
        ml: N(q.secondaryLossEventFrequency.ml),
        max: N(q.secondaryLossEventFrequency.max),
      };
      const slm = {
        min: N(q.secondaryLossMagnitude.min),
        ml: N(q.secondaryLossMagnitude.ml),
        max: N(q.secondaryLossMagnitude.max),
      };
      return {
        min: primary.min + slef.min * slm.min,
        ml: primary.ml + slef.ml * slm.ml,
        max: primary.max + slef.max * slm.max,
      };
    })();

    // ALE ~ LEF * PEL
    const ale = {
      min: lef.min * pel.min,
      ml: lef.ml * pel.ml,
      max: lef.max * pel.max,
    };

    updateScenarioQuant({
      results: {
        lef,
        pel,
        ale,
        computedAt: new Date().toISOString(),
      },
    });
  };

  const results = q.results;

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Quantify (FAIR inputs)</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Saisie <b>min / ML / max</b> pour chaque facteur. Calcul simple LEF/PEL/ALE (sans Monte-Carlo pour l’instant).
          </div>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
            Vendor: <b>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</b> · Scenario:{" "}
            <b>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => setActiveView?.("Tiering")}>← Tiering</button>
          <button className="btn primary" onClick={computeResults}>Compute</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 14 }}>
        <div style={{ fontWeight: 900 }}>Abstraction level</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <select className="input" value={q.level} onChange={(e) => updateScenarioQuant({ level: e.target.value })}>
            <option value="LEF">LEF</option>
            <option value="TEF">TEF</option>
            <option value="Contact Frequency">Contact Frequency</option>
          </select>

          <select
            className="input"
            value={q.susceptibilityMode}
            onChange={(e) => updateScenarioQuant({ susceptibilityMode: e.target.value })}
            disabled={q.level === "LEF"}
          >
            <option value="Direct">Susceptibility = Direct estimate (%)</option>
            <option value="FromCapacityVsResistance">Susceptibility = From Threat Capacity vs Resistance Strength</option>
          </select>
        </div>

        {missing.length ? (
          <div className="hint" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>Missing / invalid inputs</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {/* Frequency */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Frequency</div>

          {q.level === "LEF" ? (
            <TriadCard
              title="LEF (Loss Event Frequency)"
              unit="per year"
              hint="Annual frequency of loss events (direct estimate)."
              value={q.lef}
              onChange={(v) => updateScenarioQuant({ lef: v })}
              placeholders={{ min: "0.1", ml: "1", max: "4" }}
            />
          ) : null}

          {q.level === "TEF" ? (
            <TriadCard
              title="TEF (Threat Event Frequency)"
              unit="per year"
              hint="How often threats act on the asset. LEF = TEF × Susceptibility."
              value={q.tef}
              onChange={(v) => updateScenarioQuant({ tef: v })}
              placeholders={{ min: "1", ml: "6", max: "20" }}
            />
          ) : null}

          {q.level === "Contact Frequency" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TriadCard
                title="Contact Frequency"
                unit="per year"
                hint="How often the asset is contacted by the threat community."
                value={q.contactFrequency}
                onChange={(v) => updateScenarioQuant({ contactFrequency: v })}
                placeholders={{ min: "10", ml: "60", max: "200" }}
              />
              <TriadCard
                title="Probability of Action"
                unit="%"
                hint="Given a contact, probability the threat takes action."
                value={q.probabilityOfAction}
                onChange={(v) => updateScenarioQuant({ probabilityOfAction: v })}
                placeholders={{ min: "1", ml: "5", max: "20" }}
              />
            </div>
          ) : null}

          {/* Susceptibility */}
          {q.level !== "LEF" ? (
            q.susceptibilityMode === "Direct" ? (
              <div style={{ marginTop: 12 }}>
                <TriadCard
                  title="Susceptibility"
                  unit="%"
                  hint="Probability the threat succeeds when acting."
                  value={q.susceptibility}
                  onChange={(v) => updateScenarioQuant({ susceptibility: v })}
                  placeholders={{ min: "1", ml: "10", max: "35" }}
                />
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TriadCard
                  title="Threat Capacity"
                  unit="score"
                  hint="Training scale (e.g. 1–10)."
                  value={q.threatCapacity}
                  onChange={(v) => updateScenarioQuant({ threatCapacity: v })}
                  placeholders={{ min: "3", ml: "6", max: "9" }}
                />
                <TriadCard
                  title="Resistance Strength"
                  unit="score"
                  hint="Training scale (e.g. 1–10)."
                  value={q.resistanceStrength}
                  onChange={(v) => updateScenarioQuant({ resistanceStrength: v })}
                  placeholders={{ min: "2", ml: "5", max: "8" }}
                />
                <div className="hint" style={{ gridColumn: "1 / -1" }}>
                  Susceptibility will be derived from Threat Capacity vs Resistance Strength.
                </div>
              </div>
            )
          ) : null}
        </div>

        {/* Loss */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Loss</div>

          <TriadCard
            title="Primary Loss"
            unit="€ per event"
            hint="Direct costs per event (response, recovery, replacement, etc.)."
            value={q.primaryLoss}
            onChange={(v) => updateScenarioQuant({ primaryLoss: v })}
            placeholders={{ min: "50000", ml: "250000", max: "900000" }}
          />

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TriadCard
              title="Secondary Loss Event Frequency"
              unit="events / primary event"
              hint="How many secondary events are triggered per primary event."
              value={q.secondaryLossEventFrequency}
              onChange={(v) => updateScenarioQuant({ secondaryLossEventFrequency: v })}
              placeholders={{ min: "0", ml: "0.2", max: "1.5" }}
            />
            <TriadCard
              title="Secondary Loss Magnitude"
              unit="€ per secondary event"
              hint="Magnitude of a secondary event (lawsuit, regulatory settlement, etc.)."
              value={q.secondaryLossMagnitude}
              onChange={(v) => updateScenarioQuant({ secondaryLossMagnitude: v })}
              placeholders={{ min: "0", ml: "150000", max: "2000000" }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Computed (simple)</div>

          {!results ? (
            <div style={{ opacity: 0.8 }}>Click <b>Compute</b> to generate LEF / PEL / ALE.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {["lef", "pel", "ale"].map((k) => (
                <div key={k} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, textTransform: "uppercase" }}>{k}</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                    Min: <b>{isFiniteNumber(results[k]?.min) ? String(Math.round(results[k].min * 100) / 100) : "—"}</b>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                    ML: <b>{isFiniteNumber(results[k]?.ml) ? String(Math.round(results[k].ml * 100) / 100) : "—"}</b>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                    Max: <b>{isFiniteNumber(results[k]?.max) ? String(Math.round(results[k].max * 100) / 100) : "—"}</b>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                    {k === "pel" || k === "ale" ? "€" : "per year"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn primary" onClick={() => setActiveView?.("Treatments")} disabled={!results}>
              Go to Treatments →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
