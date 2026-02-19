"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureQuant } from "../../lib/fairEngine";
import {
  runFairCamMonteCarlo,
  getScenarioControls,
  getBaselineControls,
  getWhatIfControls,
} from "../../lib/fairCamEngine";

function moneyEUR(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pctDelta(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function Card({ children, style }) {
  return (
    <div className="card" style={{ padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder = "" }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder = "", rows = 4 }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <textarea
        className="textarea"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function defaultDecision() {
  return {
    status: "Pending",
    type: "Monitor",
    owner: "",
    approver: "",
    approvedAt: "",
    reviewDate: "",
    rationale: "",
    assumptions: "",
    thresholds: "",
    notes: "",
    conditions: "",
    analysis: null,
  };
}

function normalizeDecision(d) {
  const base = d && typeof d === "object" ? d : {};
  return { ...defaultDecision(), ...base };
}

function hasQuantData(scenario) {
  const q = ensureQuant(scenario?.quant || {});
  return !!(
    Array.isArray(q.aleSamples) &&
    q.aleSamples.length >= 20 &&
    q.level &&
    q.primaryLoss &&
    q.secondaryLossEventFrequency &&
    q.secondaryLossMagnitude
  );
}

function toneFromDelta(deltaPct) {
  if (!Number.isFinite(deltaPct)) return "rgba(255,255,255,0.10)";
  if (deltaPct < 0) return "rgba(34,197,94,0.35)";
  if (deltaPct > 0) return "rgba(239,68,68,0.35)";
  return "rgba(245,158,11,0.35)";
}

export default function DecisionsView({ vendor, scenario, updateVendor, appMode = "tprm" }) {
  const entityLabel = appMode === "enterprise" ? "asset" : "vendor";
  if (!vendor) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Decisions</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a {entityLabel} first.</div>
      </Card>
    );
  }

  if (!scenario) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Decisions</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a scenario first.</div>
      </Card>
    );
  }

  const [decision, setDecision] = useState(() => normalizeDecision(scenario.decision));
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [simsOverride, setSimsOverride] = useState("");

  useEffect(() => {
    setDecision(normalizeDecision(scenario.decision));
    setIsDirty(false);
    setJustSaved(false);
    setRunMessage("");
    setSimsOverride("");
  }, [scenario.id]);

  const controls = useMemo(() => getScenarioControls(scenario), [scenario]);
  const baselineControls = useMemo(() => getBaselineControls(controls), [controls]);
  const whatIfControls = useMemo(() => getWhatIfControls(controls), [controls]);

  const analysis = decision.analysis && typeof decision.analysis === "object" ? decision.analysis : null;
  const baseline = analysis?.baseline || null;
  const residual = analysis?.residual || null;

  const deltaP90 = useMemo(() => {
    const b = baseline?.ale?.p90;
    const r = residual?.ale?.p90;
    if (!Number.isFinite(b) || !Number.isFinite(r) || b === 0) return null;
    return ((r - b) / b) * 100;
  }, [baseline, residual]);

  const recommendation = useMemo(() => {
    if (!Number.isFinite(deltaP90)) return "Run baseline vs residual to derive a decision recommendation.";
    if (deltaP90 <= -40) return "Residual risk is materially lower. Candidate decision: Approved with conditions.";
    if (deltaP90 <= -15) return "Residual risk improves meaningfully. Candidate decision: Mitigate + monitor.";
    if (deltaP90 < 5) return "Residual risk is near baseline. Candidate decision: Monitor or conditional approval.";
    return "Residual risk is not improving. Candidate decision: Rework controls, transfer, or avoid.";
  }, [deltaP90]);

  const completion = useMemo(() => {
    let score = 0;
    if (decision.status) score += 1;
    if (decision.type) score += 1;
    if ((decision.rationale || "").trim()) score += 1;
    if ((decision.approver || "").trim()) score += 1;
    if (decision.reviewDate) score += 1;
    return Math.round((score / 5) * 100);
  }, [decision]);

  const patchDecision = (patch) => {
    setDecision((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
    setJustSaved(false);
  };

  const saveDecision = () => {
    const nextScenarios = (vendor.scenarios || []).map((s) => {
      if (s.id !== scenario.id) return s;
      return { ...s, decision: normalizeDecision(decision) };
    });
    updateVendor(vendor.id, { scenarios: nextScenarios });
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1300);
  };

  const cancelDecision = () => {
    setDecision(normalizeDecision(scenario.decision));
    setIsDirty(false);
    setJustSaved(false);
  };

  const runBaselineVsResidual = async () => {
    setRunning(true);
    setRunMessage("Running baseline and residual simulations…");

    try {
      const q = ensureQuant(scenario.quant || {});
      const requestedSims = Number(simsOverride || q.sims || 10000);
      const sims = Math.max(1000, Math.min(30000, Number.isFinite(requestedSims) ? requestedSims : 10000));
      const seed = Number((scenario.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 777);

      const baseOut = await runFairCamMonteCarlo(q, baselineControls, {
        sims,
        seed,
        yield: true,
      });

      const residualOut = await runFairCamMonteCarlo(q, whatIfControls, {
        sims,
        seed,
        yield: true,
      });

      const nextAnalysis = {
        computedAt: new Date().toISOString(),
        sims,
        baselineControlCount: baselineControls.length,
        residualControlCount: whatIfControls.length,
        baseline: baseOut.stats,
        residual: residualOut.stats,
      };

      patchDecision({ analysis: nextAnalysis });
      setRunMessage("Comparison complete.");
    } catch (err) {
      const msg = err?.missing?.length
        ? `Missing FAIR inputs: ${err.missing.join(", ")}`
        : err?.message || "Comparison failed.";
      setRunMessage(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 980 }}>Decision Record</div>
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>
              {appMode === "enterprise" ? "Asset" : "Vendor"}:{" "}
              <strong>{vendor.name?.trim() ? vendor.name : appMode === "enterprise" ? "(Unnamed asset)" : "(Unnamed vendor)"}</strong> · Scenario: <strong>{scenario.title?.trim() ? scenario.title : "(Untitled scenario)"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.07)",
              }}
            >
              Completion: {completion}%
            </span>
            {analysis?.computedAt ? (
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(59,130,246,0.15)",
                }}
              >
                Last compare: {new Date(analysis.computedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Decision</div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SelectField
              label="Decision status"
              value={decision.status}
              onChange={(v) => patchDecision({ status: v })}
              options={[
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Conditional", label: "Conditional" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />

            <SelectField
              label="Decision type"
              value={decision.type}
              onChange={(v) => patchDecision({ type: v })}
              options={[
                { value: "Accept", label: "Accept" },
                { value: "Mitigate", label: "Mitigate" },
                { value: "Transfer", label: "Transfer" },
                { value: "Avoid", label: "Avoid" },
                { value: "Monitor", label: "Monitor" },
              ]}
            />

            <Field
              label="Decision owner"
              value={decision.owner}
              onChange={(v) => patchDecision({ owner: v })}
              placeholder="Example: TPRM Lead"
            />

            <Field
              label="Approver"
              value={decision.approver}
              onChange={(v) => patchDecision({ approver: v })}
              placeholder="Example: CISO"
            />

            <div style={{ display: "grid", gap: 6 }}>
              <Label>Approved at</Label>
              <input
                className="input"
                type="date"
                value={decision.approvedAt || ""}
                onChange={(e) => patchDecision({ approvedAt: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Label>Review date</Label>
              <input
                className="input"
                type="date"
                value={decision.reviewDate || ""}
                onChange={(e) => patchDecision({ reviewDate: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField
                label="Rationale"
                value={decision.rationale}
                onChange={(v) => patchDecision({ rationale: v })}
                placeholder="Why this decision is justified based on the risk analysis."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField
                label="Assumptions"
                value={decision.assumptions}
                onChange={(v) => patchDecision({ assumptions: v })}
                placeholder="Baseline assumptions, scope limits, constraints."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField
                label="Thresholds"
                value={decision.thresholds}
                onChange={(v) => patchDecision({ thresholds: v })}
                placeholder="Example: p90 < 500k EUR and Tier 1 requires CISO approval."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField
                label="Conditions / required actions"
                value={decision.conditions}
                onChange={(v) => patchDecision({ conditions: v })}
                placeholder="Actions, deadlines, evidence expected."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <TextAreaField
                label="Notes"
                value={decision.notes}
                onChange={(v) => patchDecision({ notes: v })}
                placeholder="Any additional context for audit trail."
                rows={3}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Current vs residual risk</div>
          <div style={{ marginTop: 6, opacity: 0.82, fontSize: 13, lineHeight: 1.45 }}>
            Baseline = implemented controls. Residual (what-if) = implemented + planned/proposed controls included in what-if.
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Sims</span>
            <input
              className="input"
              style={{ width: 120 }}
              value={simsOverride}
              onChange={(e) => setSimsOverride(e.target.value)}
              placeholder={String(scenario?.quant?.sims || 10000)}
            />
            <button className="btn primary" onClick={runBaselineVsResidual} disabled={running || !hasQuantData(scenario)}>
              {running ? "Running…" : "Run baseline vs residual"}
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>
            Controls: baseline {baselineControls.length} · residual {whatIfControls.length}
          </div>

          {!hasQuantData(scenario) ? (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
              Quantitative data is incomplete. Run and save a FAIR simulation in Quantify/Results first.
            </div>
          ) : null}

          {runMessage ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Status: <strong>{runMessage}</strong>
            </div>
          ) : null}

          {baseline && residual ? (
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 900 }}>Baseline</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p50: {moneyEUR(baseline.ale?.ml)}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p90: {moneyEUR(baseline.ale?.p90)}</div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 900 }}>Residual (what-if)</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p50: {moneyEUR(residual.ale?.ml)}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>ALE p90: {moneyEUR(residual.ale?.p90)}</div>
              </div>

              <div
                style={{
                  border: `1px solid ${toneFromDelta(deltaP90)}`,
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Change (Residual - Baseline)</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>ALE p90 delta: {pctDelta(deltaP90)}</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>{recommendation}</div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13, opacity: 0.82 }}>
            Decision record fields persisted in <code>scenario.decision</code>.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={saveDecision} disabled={!isDirty}>
              Save decision
            </button>
            <button className="btn" onClick={cancelDecision} disabled={!isDirty}>
              Cancel
            </button>

            {justSaved ? (
              <span style={{ fontSize: 12, opacity: 0.85 }}>Saved ✅</span>
            ) : isDirty ? (
              <span style={{ fontSize: 12, opacity: 0.75 }}>Unsaved changes</span>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
