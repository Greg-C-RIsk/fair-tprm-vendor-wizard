"use client";

import { useMemo, useRef, useState } from "react";

/**
 * QuantifyView
 * - Lets user choose abstraction: LEF / TEF / Contact Frequency
 * - Requires min / ML / max for:
 *   LEF, TEF, Contact Frequency, Probability of Action, Susceptibility,
 *   Threat Capacity, Resistance Strength,
 *   Primary Loss, Secondary Loss Event Frequency, Secondary Loss Magnitude
 * - Monte Carlo simulation:
 *   Frequency modeled with Poisson(lambda = LEF)
 *   Per-event loss = PrimaryLoss + (SecondaryLossEventFrequency * SecondaryLossMagnitude)
 * - Outputs:
 *   ALE (min/ML/max), PEL (min/ML/max), P10/P90, histogram, exceedance curve
 *
 * Props expected (same pattern as ScenariosView):
 *   - vendor
 *   - scenario
 *   - updateVendor(vendorId, patch)
 *   - setActiveView(viewKey)
 */

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
};

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
  if (!arr?.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (a[base + 1] === undefined) return a[base];
  return a[base] + rest * (a[base + 1] - a[base]);
};

const ensureQuant = (scenario) => {
  // Quant object shape required by this view (safe defaults)
  const q = scenario?.quant || {};
  const tri = (x) => ({
    min: x?.min ?? "",
    ml: x?.ml ?? "",
    max: x?.max ?? "",
  });

  return {
    level: q.level || "LEF",
    susceptibilityMode: q.susceptibilityMode || "Direct", // "Direct" or "FromCapacityVsResistance"

    // Risk factors (triads)
    lef: tri(q.lef),
    tef: tri(q.tef),
    contactFrequency: tri(q.contactFrequency),
    probabilityOfAction: tri(q.probabilityOfAction),
    susceptibility: tri(q.susceptibility),

    threatCapacity: tri(q.threatCapacity),
    resistanceStrength: tri(q.resistanceStrength),

    primaryLoss: tri(q.primaryLoss),
    secondaryLossEventFrequency: tri(q.secondaryLossEventFrequency),
    secondaryLossMagnitude: tri(q.secondaryLossMagnitude),

    // Simulation
    sims: Number(q.sims || 10000),
    lastRunAt: q.lastRunAt || "",
    stats: q.stats || null,
    aleSamples: Array.isArray(q.aleSamples) ? q.aleSamples : [],
    pelSamples: Array.isArray(q.pelSamples) ? q.pelSamples : [],
  };
};

function Triad({ label, hint, unit, value, onChange, placeholderMin, placeholderML, placeholderMax }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 800 }}>{label}</div>
        {unit ? <div style={{ fontSize: 12, opacity: 0.75 }}>{unit}</div> : null}
      </div>
      {hint ? <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>{hint}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
        <div>
          <div className="label">Min</div>
          <input
            className="input"
            inputMode="decimal"
            value={value.min}
            onChange={(e) => onChange({ ...value, min: e.target.value })}
            placeholder={placeholderMin || ""}
          />
        </div>
        <div>
          <div className="label">ML</div>
          <input
            className="input"
            inputMode="decimal"
            value={value.ml}
            onChange={(e) => onChange({ ...value, ml: e.target.value })}
            placeholder={placeholderML || ""}
          />
        </div>
        <div>
          <div className="label">Max</div>
          <input
            className="input"
            inputMode="decimal"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
            placeholder={placeholderMax || ""}
          />
        </div>
      </div>
    </div>
  );
}

function Histogram({ title, values, bins = 26 }) {
  const data = useMemo(() => {
    if (!values?.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-9, max - min);
    const counts = Array.from({ length: bins }, () => 0);
    for (const x of values) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((x - min) / span) * bins)));
      counts[idx] += 1;
    }
    const peak = Math.max(...counts);
    return { min, max, counts, peak };
  }, [values, bins]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {data ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {money(data.min)} → {money(data.max)}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Run simulation to populate</div>
        )}
      </div>

      <div style={{ marginTop: 10, height: 120, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", padding: 8 }}>
        {!data ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No distribution yet.</div>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: "100%" }}>
            {data.counts.map((c, i) => {
              const h = (c / data.peak) * 100;
              return (
                <div
                  key={i}
                  style={{
                    width: "100%",
                    height: `${h}%`,
                    background: "currentColor",
                    opacity: 0.75,
                    borderRadius: 6,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ExceedanceCurve({ title, values, points = 60 }) {
  const data = useMemo(() => {
    if (!values?.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const xs = [];
    for (let i = 0; i < points; i++) {
      const q = i / (points - 1);
      xs.push(sorted[Math.floor(q * (n - 1))]);
    }
    const min = xs[0];
    const max = xs[xs.length - 1];

    const pts = xs.map((x, i) => {
      const q = i / (xs.length - 1);
      const exceed = 1 - q; // P(Loss > x)
      return { x, exceed };
    });

    return { min, max, pts };
  }, [values, points]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {data ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {money(data.min)} → {money(data.max)}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Run simulation to populate</div>
        )}
      </div>

      <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", padding: 8 }}>
        {!data ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No exceedance curve yet.</div>
        ) : (
          <svg width="100%" height="160" viewBox="0 0 520 160">
            {/* axes-ish padding */}
            <path d="M 30 10 L 30 140 L 510 140" fill="none" stroke="currentColor" opacity="0.25" />
            {/* curve */}
            <path
              d={(() => {
                const padX1 = 30;
                const padX2 = 510;
                const padY1 = 10;
                const padY2 = 140;

                const spanX = Math.max(1e-9, data.max - data.min);

                const mapX = (x) => padX1 + ((x - data.min) / spanX) * (padX2 - padX1);
                const mapY = (p) => padY2 - p * (padY2 - padY1);

                return data.pts
                  .map((p, i) => {
                    const x = mapX(p.x);
                    const y = mapY(p.exceed);
                    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
                  })
                  .join(" ");
              })()}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.9"
            />
          </svg>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        Y = P(Loss &gt; x)
      </div>
    </div>
  );
}

export default function QuantifyView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return <div className="card">Select a vendor and a scenario to quantify.</div>;
  }

  const q = ensureQuant(scenario);

  const [runState, setRunState] = useState({ running: false, done: 0, total: 0, label: "" });
  const cancelRef = useRef({ cancelled: false });

  const updateScenarioQuant = (patch) => {
    const scenarios = vendor.scenarios || [];
    updateVendor(vendor.id, {
      scenarios: scenarios.map((s) =>
        s.id === scenario.id
          ? { ...s, quant: { ...ensureQuant(s), ...patch } }
          : s
      ),
    });
  };

  const validateTriad = (t) => {
    const a = Number(t.min);
    const m = Number(t.ml);
    const b = Number(t.max);
    return [a, m, b].every((x) => Number.isFinite(x)) && b >= a;
  };

  const missingInputs = useMemo(() => {
    const miss = [];

    // Always required: loss inputs
    if (!validateTriad(q.primaryLoss)) miss.push("Primary Loss (min/ML/max)");
    if (!validateTriad(q.secondaryLossEventFrequency)) miss.push("Secondary Loss Event Frequency (min/ML/max)");
    if (!validateTriad(q.secondaryLossMagnitude)) miss.push("Secondary Loss Magnitude (min/ML/max)");

    // Frequency chain based on level
    if (q.level === "LEF") {
      if (!validateTriad(q.lef)) miss.push("LEF (min/ML/max)");
    } else if (q.level === "TEF") {
      if (!validateTriad(q.tef)) miss.push("TEF (min/ML/max)");
    } else if (q.level === "Contact Frequency") {
      if (!validateTriad(q.contactFrequency)) miss.push("Contact Frequency (min/ML/max)");
      if (!validateTriad(q.probabilityOfAction)) miss.push("Probability of Action (min/ML/max)");
    }

    // Susceptibility choice
    if (q.susceptibilityMode === "Direct") {
      if (!validateTriad(q.susceptibility)) miss.push("Susceptibility (min/ML/max)");
    } else {
      if (!validateTriad(q.threatCapacity)) miss.push("Threat Capacity (min/ML/max)");
      if (!validateTriad(q.resistanceStrength)) miss.push("Resistance Strength (min/ML/max)");
    }

    return miss;
  }, [q]);

  // Convert (Threat Capacity, Resistance Strength) to Susceptibility
  // Training-friendly mapping: susceptibility = sigmoid((TC - RS)/k)
  const deriveSusceptibility = (tc, rs) => {
    const k = 2; // softness
    const z = (tc - rs) / k;
    const s = 1 / (1 + Math.exp(-z)); // 0..1
    return clamp01(s);
  };

  const runMonteCarlo = async () => {
    if (missingInputs.length) {
      alert("Missing / invalid inputs:\n- " + missingInputs.join("\n- "));
      return;
    }

    const sims = Math.max(1000, Math.min(200000, Number(q.sims) || 10000));
    cancelRef.current.cancelled = false;

    setRunState({ running: true, done: 0, total: sims, label: `Running ${sims.toLocaleString()} simulations…` });

    const ale = [];
    const pel = []; // per-event loss exposure samples (one per event)

    const chunk = 400;
    let done = 0;

    while (done < sims) {
      if (cancelRef.current.cancelled) break;

      const n = Math.min(chunk, sims - done);

      for (let i = 0; i < n; i++) {
        // ----- Frequency chain
        let lefSample = 0;

        if (q.level === "LEF") {
          lefSample = Math.max(0, triangularSample(q.lef.min, q.lef.ml, q.lef.max));
        }

        if (q.level === "TEF") {
          const tefS = Math.max(0, triangularSample(q.tef.min, q.tef.ml, q.tef.max));
          // susceptibility below
          let suscS = 0;
          if (q.susceptibilityMode === "Direct") {
            suscS = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max) / 100);
          } else {
            // assume TC/RS are on a 0..10-ish scale (training), derived susceptibility 0..1
            const tcS = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max);
            const rsS = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max);
            suscS = deriveSusceptibility(tcS, rsS);
          }
          lefSample = tefS * suscS;
        }

        if (q.level === "Contact Frequency") {
          const cfS = Math.max(0, triangularSample(q.contactFrequency.min, q.contactFrequency.ml, q.contactFrequency.max));
          const poaS = clamp01(triangularSample(q.probabilityOfAction.min, q.probabilityOfAction.ml, q.probabilityOfAction.max) / 100);
          const tefS = cfS * poaS;

          let suscS = 0;
          if (q.susceptibilityMode === "Direct") {
            suscS = clamp01(triangularSample(q.susceptibility.min, q.susceptibility.ml, q.susceptibility.max) / 100);
          } else {
            const tcS = triangularSample(q.threatCapacity.min, q.threatCapacity.ml, q.threatCapacity.max);
            const rsS = triangularSample(q.resistanceStrength.min, q.resistanceStrength.ml, q.resistanceStrength.max);
            suscS = deriveSusceptibility(tcS, rsS);
          }

          lefSample = tefS * suscS;
        }

        // ----- Per-event loss exposure
        const primary = Math.max(0, triangularSample(q.primaryLoss.min, q.primaryLoss.ml, q.primaryLoss.max));
        const slef = Math.max(0, triangularSample(q.secondaryLossEventFrequency.min, q.secondaryLossEventFrequency.ml, q.secondaryLossEventFrequency.max));
        const slm = Math.max(0, triangularSample(q.secondaryLossMagnitude.min, q.secondaryLossMagnitude.ml, q.secondaryLossMagnitude.max));

        const perEventLoss = primary + (slef * slm);

        // ----- Annual events (Poisson) with lambda = LEF
        const k = poisson(Math.max(0, lefSample));

        let annualLoss = 0;
        for (let e = 0; e < k; e++) {
          annualLoss += perEventLoss;
          pel.push(perEventLoss);
        }
        ale.push(annualLoss);
      }

      done += n;
      setRunState({
        running: true,
        done,
        total: sims,
        label: `Running ${sims.toLocaleString()} simulations… (${done.toLocaleString()}/${sims.toLocaleString()})`,
      });

      // yield to UI
      await new Promise((r) => setTimeout(r, 0));
    }

    const stats = {
      ale: {
        min: quantile(ale, 0.01),
        ml: quantile(ale, 0.5),
        max: quantile(ale, 0.99),
        p10: quantile(ale, 0.1),
        p90: quantile(ale, 0.9),
      },
      pel: {
        min: quantile(pel, 0.01),
        ml: quantile(pel, 0.5),
        max: quantile(pel, 0.99),
        p10: quantile(pel, 0.1),
        p90: quantile(pel, 0.9),
      },
    };

    updateScenarioQuant({
      sims,
      lastRunAt: new Date().toISOString(),
      aleSamples: ale,
      pelSamples: pel,
      stats,
    });

    setRunState({ running: false, done: sims, total: sims, label: "Simulation complete." });
  };

  const cancel = () => {
    cancelRef.current.cancelled = true;
    setRunState((p) => ({ ...p, running: false, label: "Cancelled." }));
  };

  const stats = q.stats;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h2>Quantification (FAIR)</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Provide <strong>min / ML / max</strong> estimates for the factors. Then run Monte Carlo to compute ALE + distributions.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setActiveView("Scenarios")}>Back</button>
          <button onClick={() => setActiveView("Treatments")} disabled={!q?.stats}>Go to treatments</button>
        </div>
      </div>

      {/* LEVEL */}
      <div className="card" style={{ padding: 12, marginTop: 14 }}>
        <div style={{ fontWeight: 900 }}>Choose abstraction level</div>
        <div style={{ opacity: 0.8, fontSize: 13, marginTop: 6 }}>
          Work at <strong>LEF</strong> directly, or compute LEF from <strong>TEF</strong>, or from <strong>Contact Frequency</strong>.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <select
            className="input"
            value={q.level}
            onChange={(e) => updateScenarioQuant({ level: e.target.value })}
            style={{ maxWidth: 260 }}
          >
            <option value="LEF">LEF</option>
            <option value="TEF">TEF</option>
            <option value="Contact Frequency">Contact Frequency</option>
          </select>

          <select
            className="input"
            value={q.susceptibilityMode}
            onChange={(e) => updateScenarioQuant({ susceptibilityMode: e.target.value })}
            style={{ maxWidth: 360 }}
          >
            <option value="Direct">Susceptibility = Direct estimate (%)</option>
            <option value="FromCapacityVsResistance">Susceptibility = From Threat Capacity vs Resistance Strength</option>
          </select>

          <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
            Scenario: <strong>{scenario.title || "(Untitled)"}</strong>
          </div>
        </div>

        {missingInputs.length ? (
          <div className="hint" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>Missing / invalid inputs</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {missingInputs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* FACTORS */}
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {/* Frequency chain */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Frequency factors</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {q.level === "LEF" ? (
              <Triad
                label="LEF (Loss Event Frequency)"
                hint="Direct annual frequency of loss events (per year)."
                unit="per year"
                value={q.lef}
                onChange={(v) => updateScenarioQuant({ lef: v })}
                placeholderMin="0.1"
                placeholderML="1"
                placeholderMax="4"
              />
            ) : null}

            {q.level === "TEF" ? (
              <Triad
                label="TEF (Threat Event Frequency)"
                hint="How often threats act on the asset (per year). LEF = TEF × Susceptibility."
                unit="per year"
                value={q.tef}
                onChange={(v) => updateScenarioQuant({ tef: v })}
                placeholderMin="1"
                placeholderML="6"
                placeholderMax="20"
              />
            ) : null}

            {q.level === "Contact Frequency" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Triad
                  label="Contact Frequency"
                  hint="How often the asset is contacted by the threat community."
                  unit="per year"
                  value={q.contactFrequency}
                  onChange={(v) => updateScenarioQuant({ contactFrequency: v })}
                  placeholderMin="10"
                  placeholderML="60"
                  placeholderMax="200"
                />
                <Triad
                  label="Probability of Action"
                  hint="Given a contact, probability the threat takes action."
                  unit="%"
                  value={q.probabilityOfAction}
                  onChange={(v) => updateScenarioQuant({ probabilityOfAction: v })}
                  placeholderMin="1"
                  placeholderML="5"
                  placeholderMax="20"
                />
              </div>
            ) : null}

            {/* Susceptibility */}
            {q.level !== "LEF" ? (
              q.susceptibilityMode === "Direct" ? (
                <Triad
                  label="Susceptibility"
                  hint="Probability the threat succeeds when acting (percentage)."
                  unit="%"
                  value={q.susceptibility}
                  onChange={(v) => updateScenarioQuant({ susceptibility: v })}
                  placeholderMin="1"
                  placeholderML="10"
                  placeholderMax="35"
                />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Triad
                    label="Threat Capacity"
                    hint="Threat capability level (training scale, e.g. 1–10)."
                    unit="score"
                    value={q.threatCapacity}
                    onChange={(v) => updateScenarioQuant({ threatCapacity: v })}
                    placeholderMin="3"
                    placeholderML="6"
                    placeholderMax="9"
                  />
                  <Triad
                    label="Resistance Strength"
                    hint="Control strength (training scale, e.g. 1–10)."
                    unit="score"
                    value={q.resistanceStrength}
                    onChange={(v) => updateScenarioQuant({ resistanceStrength: v })}
                    placeholderMin="2"
                    placeholderML="5"
                    placeholderMax="8"
                  />
                  <div className="hint" style={{ gridColumn: "1 / -1" }}>
                    Susceptibility will be derived from Threat Capacity vs Resistance Strength using a smooth mapping (0..1).
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Loss factors */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Loss factors</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <Triad
              label="Primary Loss"
              hint="Direct costs per loss event (response, replacement, productivity, etc.)."
              unit="€ per event"
              value={q.primaryLoss}
              onChange={(v) => updateScenarioQuant({ primaryLoss: v })}
              placeholderMin="50000"
              placeholderML="250000"
              placeholderMax="900000"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Triad
                label="Secondary Loss Event Frequency"
                hint="Expected number of secondary loss events triggered per primary event (e.g., lawsuits)."
                unit="events per primary event"
                value={q.secondaryLossEventFrequency}
                onChange={(v) => updateScenarioQuant({ secondaryLossEventFrequency: v })}
                placeholderMin="0"
                placeholderML="0.2"
                placeholderMax="1.5"
              />

              <Triad
  label="Secondary Loss Magnitude"
  hint="Magnitude per secondary event (e.g., legal/regulatory settlements)."
  unit="€ per secondary event"
  value={q.secondaryLossMagnitude}
  onChange={(v) => updateScenarioQuant({ secondaryLossMagnitude: v })}
  placeholderMin="10000"
  placeholderML="75000"
  placeholderMax="300000"
/>
          </div>
        </div>
      </div>

      {/* SIMULATION */}
      <div className="card" style={{ padding: 12, marginTop: 14 }}>
        <div style={{ fontWeight: 900 }}>Monte Carlo simulation</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
          Run Monte Carlo to compute ALE, loss distributions and exceedance curves.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <div className="label">Simulations</div>
            <input
              className="input"
              inputMode="numeric"
              value={q.sims}
              onChange={(e) => updateScenarioQuant({ sims: e.target.value })}
              style={{ maxWidth: 160 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <button
              className="btn primary"
              onClick={runMonteCarlo}
              disabled={runState.running}
            >
              Run simulation
            </button>

            {runState.running ? (
              <button className="btn" onClick={cancel}>
                Cancel
              </button>
            ) : null}
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "flex-end" }}>
            {runState.label}
          </div>
        </div>
      </div>

      {/* RESULTS */}
      {stats ? (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              Key results (Annualized Loss Exposure)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div>
                <div className="label">ALE Min</div>
                <div style={{ fontWeight: 800 }}>{money(stats.ale.min)}</div>
              </div>
              <div>
                <div className="label">ALE ML (Median)</div>
                <div style={{ fontWeight: 800 }}>{money(stats.ale.ml)}</div>
              </div>
              <div>
                <div className="label">ALE Max</div>
                <div style={{ fontWeight: 800 }}>{money(stats.ale.max)}</div>
              </div>
              <div>
                <div className="label">ALE P10</div>
                <div style={{ fontWeight: 800 }}>{money(stats.ale.p10)}</div>
              </div>
              <div>
                <div className="label">ALE P90</div>
                <div style={{ fontWeight: 800 }}>{money(stats.ale.p90)}</div>
              </div>
              <div>
                <div className="label">Last run</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {q.lastRunAt ? new Date(q.lastRunAt).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* DISTRIBUTIONS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Histogram
              title="Annual Loss Distribution (ALE)"
              values={q.aleSamples}
            />

            <Histogram
              title="Per-Event Loss Distribution (PEL)"
              values={q.pelSamples}
            />
          </div>

          <ExceedanceCurve
            title="Loss Exceedance Curve (ALE)"
            values={q.aleSamples}
          />
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 14 }}>
          Run the simulation to generate FAIR results and visualizations.
        </div>
      )}
    </div>
  );
}
