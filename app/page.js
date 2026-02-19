"use client";

import { useEffect, useMemo, useState, Component } from "react";

// Views (components folder)
import TieringView from "./components/TieringView";
import ScenariosView from "./components/ScenariosView";
import QuantifyView from "./components/QuantifyView";
import ResultsView from "./components/ResultsView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

// Shared model (root /lib)
import {
  uid,
  emptyVendor,
  emptyScenario,
  emptyTiering,
  tierIndex,
  safeParse,
  normalizeState,
} from "../lib/model";

const LS_KEY = "fair_tprm_training_v6";

function makeSamples(mid, count = 240, spread = 0.28, phase = 0) {
  const base = Math.max(1, Number(mid) || 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.sin((i + phase) / 7) * spread + Math.cos((i + phase) / 13) * (spread / 2);
    const noise = ((i * 17 + phase * 11) % 19) / 100 - 0.09;
    const v = Math.max(0, base * (1 + wave + noise));
    out.push(v);
  }
  return out;
}

function makeTPRMTestDataset() {
  const vendorSeeds = [
    {
      name: "Northbridge CRM Cloud",
      category: "SaaS",
      businessOwner: "Head of Sales Ops",
      geography: "EU",
      criticalFunction: "CRM operations and lead lifecycle",
      dataTypes: "Customer PII, contract metadata, sales pipeline",
      dependencyLevel: "High",
      carryForward: true,
      tiering: { dataSensitivity: 4, integrationDepth: 4, accessPrivileges: 4, historicalIncidents: 2, businessCriticality: 5 },
      tier: "Tier 1",
    },
    {
      name: "Orion Pay Gateway",
      category: "Payment",
      businessOwner: "Finance Director",
      geography: "Global",
      criticalFunction: "Payment processing and settlement",
      dataTypes: "Payment tokens, transaction logs, merchant references",
      dependencyLevel: "High",
      carryForward: true,
      tiering: { dataSensitivity: 5, integrationDepth: 5, accessPrivileges: 4, historicalIncidents: 3, businessCriticality: 5 },
      tier: "Tier 1",
    },
    {
      name: "Helios Managed IT Services",
      category: "MSP",
      businessOwner: "IT Director",
      geography: "US",
      criticalFunction: "Endpoint administration and infrastructure support",
      dataTypes: "Admin credentials, endpoint telemetry, incident tickets",
      dependencyLevel: "Medium",
      carryForward: false,
      tiering: { dataSensitivity: 3, integrationDepth: 3, accessPrivileges: 4, historicalIncidents: 2, businessCriticality: 4 },
      tier: "Tier 2",
    },
  ];

  const levelCycle = ["LEF", "TEF", "Contact Frequency"];
  const scenarioTitles = [
    "Credential takeover of vendor admin console",
    "Ransomware propagation through integration channel",
    "Sensitive data exfiltration via API misuse",
  ];

  const vendors = vendorSeeds.map((seed, vIdx) => {
    const v = { ...emptyVendor(), id: uid(), ...seed };

    v.scenarios = Array.from({ length: 3 }).map((_, sIdx) => {
      const level = levelCycle[sIdx % levelCycle.length];
      const aleP50 = 90000 + vIdx * 60000 + sIdx * 45000;
      const aleP90 = aleP50 * (1.55 + sIdx * 0.1);
      const pelP50 = 25000 + vIdx * 14000 + sIdx * 9000;
      const pelP90 = pelP50 * 1.7;

      const aleSamples = makeSamples(aleP50, 260, 0.38, vIdx * 29 + sIdx * 11);
      const pelSamples = makeSamples(pelP50, 420, 0.27, vIdx * 17 + sIdx * 7);

      const s = { ...emptyScenario(), id: uid() };
      s.title = `${scenarioTitles[sIdx]} (${seed.name.split(" ")[0]})`;
      s.assetAtRisk = sIdx === 0 ? "Admin accounts and privileged workflows" : sIdx === 1 ? "Business continuity and platform availability" : "Customer and transaction data";
      s.threatActor = sIdx === 2 ? "Malicious insider / data broker" : "External cybercriminal";
      s.attackVector = sIdx === 0 ? "Credential stuffing and MFA fatigue" : sIdx === 1 ? "Remote tooling abuse + lateral movement" : "Token abuse and excessive API permissions";
      s.lossEvent = sIdx === 1 ? "Operational outage and delayed recovery" : "Unauthorized access and data compromise";
      s.narrative = "Test dataset scenario for training walkthrough.";
      s.assumptions = "Generated synthetic values for demo only.";
      s.quant = {
        ...s.quant,
        level,
        lef: { min: "0.2", ml: String(0.8 + vIdx * 0.4 + sIdx * 0.2), max: String(2.2 + vIdx * 0.6 + sIdx * 0.4) },
        tef: { min: "1.2", ml: String(4 + vIdx + sIdx), max: String(9 + vIdx * 1.2 + sIdx * 1.2) },
        contactFrequency: { min: "20", ml: String(45 + vIdx * 12 + sIdx * 8), max: String(100 + vIdx * 18 + sIdx * 14) },
        probabilityOfAction: { min: "0.05", ml: String(0.18 + 0.04 * sIdx), max: String(0.42 + 0.06 * sIdx) },
        susceptibility: { min: "0.08", ml: String(0.24 + 0.05 * sIdx), max: String(0.52 + 0.06 * sIdx) },
        threatCapacity: { min: "2", ml: String(4 + sIdx), max: "8" },
        resistanceStrength: { min: "2", ml: String(3 + vIdx), max: "7" },
        primaryLoss: { min: String(Math.round(pelP50 * 0.45)), ml: String(Math.round(pelP50 * 0.8)), max: String(Math.round(pelP90 * 0.85)) },
        secondaryLossEventFrequency: { min: "0.2", ml: String(0.7 + sIdx * 0.2), max: String(1.8 + sIdx * 0.35) },
        secondaryLossMagnitude: { min: String(Math.round(pelP50 * 0.1)), ml: String(Math.round(pelP50 * 0.35)), max: String(Math.round(pelP50 * 0.8)) },
        sims: 10000,
        lastRunAt: new Date().toISOString(),
        aleSamples,
        pelSamples,
        stats: {
          ale: { min: Math.min(...aleSamples), ml: aleP50, max: Math.max(...aleSamples), p10: aleP50 * 0.58, p90: aleP90 },
          pel: { min: Math.min(...pelSamples), ml: pelP50, max: Math.max(...pelSamples), p10: pelP50 * 0.65, p90: pelP90 },
        },
      };

      s.controls = [
        {
          id: uid(),
          name: "Enforce phishing-resistant MFA",
          function: "LEC",
          type: "Resistance",
          status: "Implemented",
          includeInWhatIf: true,
          intended: "High",
          coverage: "Moderate",
          reliability: "High",
        },
        {
          id: uid(),
          name: "24/7 detection and response playbook",
          function: "LEC",
          type: "Detection",
          status: "Planned",
          includeInWhatIf: true,
          intended: "Moderate",
          coverage: "High",
          reliability: "Moderate",
        },
        {
          id: uid(),
          name: "Segmentation + recovery drill",
          function: "LEC",
          type: "Resilience",
          status: "Proposed",
          includeInWhatIf: true,
          intended: "Moderate",
          coverage: "Moderate",
          reliability: "Moderate",
        },
      ];

      return s;
    });

    return v;
  });

  return {
    vendors,
    selectedVendorId: vendors[0]?.id || "",
    selectedScenarioId: vendors[0]?.scenarios?.[0]?.id || "",
  };
}

function makePrimaryTestDataset() {
  const primaryContexts = [
    {
      name: "Enterprise Identity Core",
      category: "Internal",
      businessOwner: "CISO Office",
      geography: "Global",
      criticalFunction: "Identity and access management",
      dataTypes: "Employee identities, auth logs, privileged entitlements",
      dependencyLevel: "High",
      carryForward: true,
      tiering: { dataSensitivity: 4, integrationDepth: 5, accessPrivileges: 5, historicalIncidents: 2, businessCriticality: 5 },
      tier: "Tier 1",
    },
    {
      name: "Finance ERP Platform",
      category: "Internal",
      businessOwner: "Finance Director",
      geography: "EU",
      criticalFunction: "Financial operations and reporting",
      dataTypes: "Invoices, accounting entries, payroll metadata",
      dependencyLevel: "High",
      carryForward: true,
      tiering: { dataSensitivity: 4, integrationDepth: 4, accessPrivileges: 4, historicalIncidents: 2, businessCriticality: 5 },
      tier: "Tier 1",
    },
    {
      name: "Customer Digital Channels",
      category: "Internal",
      businessOwner: "Head of Digital",
      geography: "Global",
      criticalFunction: "Customer acquisition and account servicing",
      dataTypes: "Customer accounts, session tokens, service events",
      dependencyLevel: "Medium",
      carryForward: true,
      tiering: { dataSensitivity: 4, integrationDepth: 4, accessPrivileges: 3, historicalIncidents: 3, businessCriticality: 4 },
      tier: "Tier 2",
    },
  ];

  const levelCycle = ["LEF", "TEF", "Contact Frequency"];
  const scenarioTitles = [
    "Privileged account compromise in IAM",
    "Ransomware disruption of core operations",
    "Data leakage through misconfigured API gateway",
  ];

  const vendors = primaryContexts.map((seed, vIdx) => {
    const v = { ...emptyVendor(), id: uid(), ...seed };

    v.scenarios = Array.from({ length: 3 }).map((_, sIdx) => {
      const level = levelCycle[sIdx % levelCycle.length];
      const aleP50 = 120000 + vIdx * 70000 + sIdx * 52000;
      const aleP90 = aleP50 * (1.65 + sIdx * 0.08);
      const pelP50 = 30000 + vIdx * 12000 + sIdx * 10500;
      const pelP90 = pelP50 * 1.75;

      const aleSamples = makeSamples(aleP50, 260, 0.34, vIdx * 21 + sIdx * 13);
      const pelSamples = makeSamples(pelP50, 420, 0.25, vIdx * 19 + sIdx * 9);

      const s = { ...emptyScenario(), id: uid() };
      s.title = `${scenarioTitles[sIdx]} (${seed.name.split(" ")[0]})`;
      s.assetAtRisk = sIdx === 0 ? "Privileged identity plane" : sIdx === 1 ? "Core business continuity" : "Customer data and trust";
      s.threatActor = sIdx === 2 ? "External attacker / opportunistic actor" : "External cybercriminal";
      s.attackVector = sIdx === 0 ? "Session hijack + privilege escalation" : sIdx === 1 ? "Malware delivery + lateral movement" : "API key abuse / over-permissioned services";
      s.lossEvent = sIdx === 1 ? "Operational shutdown and delayed recovery" : "Unauthorized access and confidentiality breach";
      s.narrative = "Primary-risk synthetic scenario for training and demo.";
      s.assumptions = "Synthetic values, generated for local testing.";
      s.quant = {
        ...s.quant,
        level,
        lef: { min: "0.3", ml: String(1 + vIdx * 0.45 + sIdx * 0.25), max: String(2.7 + vIdx * 0.6 + sIdx * 0.45) },
        tef: { min: "1.4", ml: String(4.8 + vIdx + sIdx), max: String(10.5 + vIdx * 1.1 + sIdx * 1.2) },
        contactFrequency: { min: "25", ml: String(52 + vIdx * 10 + sIdx * 9), max: String(112 + vIdx * 16 + sIdx * 15) },
        probabilityOfAction: { min: "0.05", ml: String(0.16 + 0.05 * sIdx), max: String(0.4 + 0.07 * sIdx) },
        susceptibility: { min: "0.09", ml: String(0.27 + 0.05 * sIdx), max: String(0.56 + 0.05 * sIdx) },
        threatCapacity: { min: "2", ml: String(4 + sIdx), max: "8" },
        resistanceStrength: { min: "2", ml: String(3 + vIdx), max: "7" },
        primaryLoss: { min: String(Math.round(pelP50 * 0.45)), ml: String(Math.round(pelP50 * 0.82)), max: String(Math.round(pelP90 * 0.88)) },
        secondaryLossEventFrequency: { min: "0.25", ml: String(0.8 + sIdx * 0.2), max: String(1.9 + sIdx * 0.3) },
        secondaryLossMagnitude: { min: String(Math.round(pelP50 * 0.1)), ml: String(Math.round(pelP50 * 0.35)), max: String(Math.round(pelP50 * 0.82)) },
        sims: 10000,
        lastRunAt: new Date().toISOString(),
        aleSamples,
        pelSamples,
        stats: {
          ale: { min: Math.min(...aleSamples), ml: aleP50, max: Math.max(...aleSamples), p10: aleP50 * 0.57, p90: aleP90 },
          pel: { min: Math.min(...pelSamples), ml: pelP50, max: Math.max(...pelSamples), p10: pelP50 * 0.66, p90: pelP90 },
        },
      };

      s.controls = [
        {
          id: uid(),
          name: "Privileged access hardening",
          function: "LEC",
          type: "Resistance",
          status: "Implemented",
          includeInWhatIf: true,
          intended: "High",
          coverage: "Moderate",
          reliability: "High",
        },
        {
          id: uid(),
          name: "Detection engineering uplift",
          function: "LEC",
          type: "Detection",
          status: "Planned",
          includeInWhatIf: true,
          intended: "Moderate",
          coverage: "High",
          reliability: "Moderate",
        },
        {
          id: uid(),
          name: "Resilience and recovery rehearsal",
          function: "LEC",
          type: "Resilience",
          status: "Proposed",
          includeInWhatIf: true,
          intended: "Moderate",
          coverage: "Moderate",
          reliability: "Moderate",
        },
      ];

      return s;
    });

    return v;
  });

  return {
    vendors,
    selectedVendorId: vendors[0]?.id || "",
    selectedScenarioId: vendors[0]?.scenarios?.[0]?.id || "",
  };
}

function makeTestDataset(mode = "tprm") {
  return mode === "primary" ? makePrimaryTestDataset() : makeTPRMTestDataset();
}

// ---------------------------
// Minimal ErrorBoundary (évite la “page blanche”)
// ---------------------------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err) {
    // log console for debugging
    // eslint-disable-next-line no-console
    console.error("UI ErrorBoundary caught:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900 }}>Application error</div>
            <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
              Une exception JS s’est produite. Ouvre la console pour le détail.
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>
              {String(this.state.err?.message || this.state.err || "")}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// React n’est pas importé explicitement en Next 14 normalement,
// mais une classe ErrorBoundary en a besoin.

// ---------------------------
// UI atoms
// ---------------------------
function Button({ className = "", ...props }) {
  return <button {...props} className={className || "btn"} />;
}

function InputRow({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>{label}</div>
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

function Card({ children, style }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(255,255,255,0.10)",
        margin: "12px 0",
      }}
    />
  );
}

// ---------------------------
// Vendors UX (form + list/details)
// ---------------------------
function VendorForm({ mode, draft, onChange, onCancel, onSubmit }) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            {mode === "create" ? "Create a new vendor" : "Edit vendor"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            Fill in the minimum required fields first. You can refine later.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={onCancel} className="btn">
            Cancel
          </Button>
          <Button onClick={onSubmit} className="btn primary">
            {mode === "create" ? "Create vendor" : "Save changes"}
          </Button>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <InputRow label="Vendor name">
          <input
            className="input"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Example: TalentLMS"
          />
        </InputRow>

        <InputRow label="Category">
          <select
            className="input"
            value={draft.category}
            onChange={(e) => onChange({ ...draft, category: e.target.value })}
          >
            {["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </InputRow>

        <InputRow label="Business owner">
          <input
            className="input"
            value={draft.businessOwner}
            onChange={(e) => onChange({ ...draft, businessOwner: e.target.value })}
            placeholder="Example: Head of Sales Ops"
          />
        </InputRow>

        <InputRow label="Geography">
          <select
            className="input"
            value={draft.geography}
            onChange={(e) => onChange({ ...draft, geography: e.target.value })}
          >
            {["EU", "US", "UK", "Global", "Other"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </InputRow>

        <div style={{ gridColumn: "1 / -1" }}>
          <InputRow label="Critical business function supported">
            <input
              className="input"
              value={draft.criticalFunction}
              onChange={(e) => onChange({ ...draft, criticalFunction: e.target.value })}
              placeholder="Example: Customer acquisition & retention"
            />
          </InputRow>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <InputRow label="Data types processed">
            <textarea
              className="textarea"
              value={draft.dataTypes}
              onChange={(e) => onChange({ ...draft, dataTypes: e.target.value })}
              placeholder="Example: Customer PII, order history, support tickets"
              rows={5}
            />
          </InputRow>
        </div>

        <InputRow label="Dependency level">
          <select
            className="input"
            value={draft.dependencyLevel}
            onChange={(e) => onChange({ ...draft, dependencyLevel: e.target.value })}
          >
            {["Low", "Medium", "High"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </InputRow>

        <InputRow label="Carry-forward (for deeper analysis)">
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, opacity: 0.9 }}>
            <input
              type="checkbox"
              checked={!!draft.carryForward}
              onChange={(e) => onChange({ ...draft, carryForward: e.target.checked })}
            />
            Carry-forward
          </label>
        </InputRow>

        <div style={{ gridColumn: "1 / -1", marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Tip: Create the vendor first, then go to Tiering, Scenarios and Quantify.
        </div>
      </div>
    </Card>
  );
}

function VendorsView({
  vendors,
  selectedVendorId,
  onSelectVendor,
  onRequestCreate,
  onRequestEdit,
  onDeleteVendor,
  onGoTiering,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter(
      (v) =>
        (v.name || "").toLowerCase().includes(s) ||
        (v.category || "").toLowerCase().includes(s)
    );
  }, [vendors, q]);

  const selected = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Vendors</div>
          <Button className="btn primary" onClick={onRequestCreate}>
            + Add vendor
          </Button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendor…"
          />
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.8, padding: "10px 0" }}>No vendors found.</div>
          ) : (
            filtered.map((v) => {
              const isActive = v.id === selectedVendorId;
              const scenarioCount = Array.isArray(v.scenarios) ? v.scenarios.length : 0;
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectVendor(v.id)}
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
                    <div style={{ fontWeight: 900 }}>
                      {v.name?.trim() ? v.name : "(Unnamed vendor)"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{v.category}</div>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>Index: {tierIndex(v.tiering || emptyTiering())}</Pill>
                    <Pill>{scenarioCount} scenario(s)</Pill>
                    <Pill>{v.carryForward ? "Carry-forward" : "Not carried"}</Pill>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        {!selected ? (
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            Select a vendor on the left, or click <strong>Add vendor</strong>.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>
                  {selected.name?.trim() ? selected.name : "(Unnamed vendor)"}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>{selected.category}</Pill>
                  <Pill>{selected.geography}</Pill>
                  <Pill>Dependency: {selected.dependencyLevel}</Pill>
                  <Pill>Tier: {selected.tier || "—"}</Pill>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Button className="btn" onClick={() => onRequestEdit(selected.id)}>
                  Edit
                </Button>
                <Button className="btn" onClick={() => onDeleteVendor(selected.id)}>
                  Delete
                </Button>
                <Button className="btn primary" onClick={onGoTiering}>
                  Go to tiering →
                </Button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Critical function</div>
                <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {selected.criticalFunction?.trim() ? selected.criticalFunction : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Business owner</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {selected.businessOwner?.trim() ? selected.businessOwner : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Data types</div>
                <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {selected.dataTypes?.trim() ? selected.dataTypes : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Scenarios</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {Array.isArray(selected.scenarios) && selected.scenarios.length
                    ? selected.scenarios
                        .map((s) => (s.title?.trim() ? s.title : "(Untitled scenario)"))
                        .join(" • ")
                    : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Prioritization</div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    Index: {tierIndex(selected.tiering || emptyTiering())}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    Carry-forward: {selected.carryForward ? "Yes" : "No"}
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ---------------------------
// Page
// ---------------------------
export default function Page() {
  const [appMode, setAppMode] = useState("tprm"); // "primary" | "tprm"
  const [activeView, setActiveView] = useState("Vendors");

  // IMPORTANT: on attend l’hydratation avant de persister / utiliser certains onglets
  const [hydrated, setHydrated] = useState(false);

  const [state, setState] = useState(() => ({
    vendors: [],
    selectedVendorId: "",
    selectedScenarioId: "",
  }));

  // Hydrate from localStorage (client only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      const base = raw
        ? safeParse(raw, { vendors: [], selectedVendorId: "", selectedScenarioId: "" })
        : { vendors: [], selectedVendorId: "", selectedScenarioId: "" };

      const normalized = normalizeState(
        Array.isArray(base.vendors) && base.vendors.length
          ? base
          : { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" }
      );

      setState(normalized);
    } catch {
      const v = emptyVendor();
      setState(
        normalizeState({
          vendors: [v],
          selectedVendorId: v.id,
          selectedScenarioId: v.scenarios?.[0]?.id || "",
        })
      );
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state (client only) — mais seulement APRÈS hydratation
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(normalizeState(state)));
    } catch {
      // ignore
    }
  }, [hydrated, state]);

  const vendors = Array.isArray(state.vendors) ? state.vendors : [];

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null;
  }, [vendors, state.selectedVendorId]);

  const selectedScenario = useMemo(() => {
    if (!selectedVendor) return null;
    const scenarios = Array.isArray(selectedVendor.scenarios) ? selectedVendor.scenarios : [];
    return scenarios.find((s) => s.id === state.selectedScenarioId) || scenarios[0] || null;
  }, [selectedVendor, state.selectedScenarioId]);

  const updateVendor = (vendorId, patch) => {
    setState((p) =>
      normalizeState({
        ...p,
        vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) =>
          v.id === vendorId ? { ...v, ...patch } : v
        ),
      })
    );
  };

const updateManyVendors = (vendorIds, patchOrFn) => {
  setState((p) =>
    normalizeState({
      ...p,
      vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) => {
        if (!vendorIds.includes(v.id)) return v;
        const patch = typeof patchOrFn === "function" ? patchOrFn(v) : patchOrFn;
        return { ...v, ...patch };
      }),
    })
  );
};

  const selectVendor = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId) || vendors[0] || null;
    setState((p) =>
      normalizeState({
        ...p,
        selectedVendorId: v?.id || "",
        selectedScenarioId: v?.scenarios?.[0]?.id || "",
      })
    );
  };

  const selectScenario = (scenarioId) => {
    setState((p) =>
      normalizeState({
        ...p,
        selectedScenarioId: scenarioId,
      })
    );
  };

  // ---- Vendor create/edit UX state
  const [vendorForm, setVendorForm] = useState({ open: false, mode: "create", draft: null });

  const openCreateVendor = () => {
    const v = emptyVendor();
    setVendorForm({
      open: true,
      mode: "create",
      draft: {
        ...v,
        scenarios: [emptyScenario()],
        tiering: emptyTiering(),
      },
    });
  };

  const openEditVendor = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setVendorForm({ open: true, mode: "edit", draft: JSON.parse(JSON.stringify(v)) });
  };

  const closeVendorForm = () => setVendorForm({ open: false, mode: "create", draft: null });

  const createVendor = () => {
    const d = vendorForm.draft;
    if (!d) return;

    const v = {
      ...emptyVendor(),
      ...d,
      id: uid(),
      tiering: d.tiering || emptyTiering(),
      scenarios: Array.isArray(d.scenarios) && d.scenarios.length ? d.scenarios : [emptyScenario()],
    };

    const isPlaceholderVendor = (x) => {
      if (!x || typeof x !== "object") return false;
      const hasIdentity = !!(x.name?.trim() || x.businessOwner?.trim() || x.criticalFunction?.trim() || x.dataTypes?.trim());
      const sc = Array.isArray(x.scenarios) ? x.scenarios : [];
      const onlyEmptyScenario =
        sc.length === 1 &&
        !sc[0]?.title?.trim() &&
        !sc[0]?.assetAtRisk?.trim() &&
        !sc[0]?.attackVector?.trim() &&
        !sc[0]?.lossEvent?.trim() &&
        !(Array.isArray(sc[0]?.quant?.aleSamples) && sc[0].quant.aleSamples.length > 0) &&
        !Number.isFinite(sc[0]?.quant?.stats?.ale?.p90);
      return !hasIdentity && onlyEmptyScenario;
    };

    setState((p) => {
      const current = Array.isArray(p.vendors) ? p.vendors : [];
      const vendors = current.length === 1 && isPlaceholderVendor(current[0]) ? [v] : [...current, v];

      return normalizeState({
        ...p,
        vendors,
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      });
    });

    closeVendorForm();
  };

  const saveVendor = () => {
    const d = vendorForm.draft;
    if (!d) return;

    setState((p) =>
      normalizeState({
        ...p,
        vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) =>
          v.id === d.id ? { ...v, ...d } : v
        ),
      })
    );

    closeVendorForm();
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      return normalizeState({ ...p, vendors: next, selectedVendorId: "", selectedScenarioId: "" });
    });
  };

  const resetAll = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
    const v = emptyVendor();
    setState(
      normalizeState({
        vendors: [v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      })
    );
    setActiveView(appMode === "primary" ? "Scenarios" : "Vendors");
    closeVendorForm();
  };

  const loadTestData = () => {
    if (typeof window !== "undefined") {
      const label = appMode === "primary" ? "Primary Risk" : "TPRM";
      const ok = window.confirm(`Load synthetic ${label} test dataset (3 contexts x 3 scenarios) and replace current local data?`);
      if (!ok) return;
    }

    const ds = makeTestDataset(appMode);
    setState(normalizeState(ds));
    setActiveView("Dashboard");
    closeVendorForm();
  };

  const tabs = useMemo(() => {
    if (appMode === "primary") {
      return [
        { k: "Scenarios", label: "Scenarios" },
        { k: "Quantify", label: "Quantify" },
        { k: "Results", label: "Results" },
        { k: "Treatments", label: "Treatments" },
        { k: "Decisions", label: "Decisions" },
        { k: "Dashboard", label: "Dashboard" },
      ];
    }
    return [
      { k: "Vendors", label: "Vendors" },
      { k: "Tiering", label: "Tiering" },
      { k: "Scenarios", label: "Scenarios" },
      { k: "Quantify", label: "Quantify" },
      { k: "Results", label: "Results" },
      { k: "Decisions", label: "Decisions" },
      { k: "Dashboard", label: "Dashboard" },
    ];
  }, [appMode]);

  useEffect(() => {
    if (tabs.some((t) => t.k === activeView)) return;
    setActiveView(tabs[0]?.k || "Scenarios");
  }, [tabs, activeView]);

  const totalScenarios = useMemo(() => {
    return vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0);
  }, [vendors]);

  const carried = useMemo(() => vendors.filter((v) => !!v.carryForward).length, [vendors]);

  const showContextBar = !vendorForm.open && activeView !== "Vendors";

  // Guards (évite crash si scenario null)
  const needsVendor = activeView !== "Vendors";
  const needsScenario = ["Quantify", "Results", "Treatments", "Decisions"].includes(activeView);

  return (
    <ErrorBoundary>
      <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR Risk Studio</div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>Mode: {appMode === "primary" ? "Primary Risk" : "TPRM"}</Pill>
              <Pill>{vendors.length} vendor(s)</Pill>
              <Pill>{totalScenarios} scenario(s)</Pill>
              <Pill>Carry-forward: {carried}</Pill>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button className="btn primary" onClick={loadTestData}>
              Load test data
            </Button>
            <Button className="btn" onClick={resetAll}>
              Reset
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 14 }}>
          <Card style={{ padding: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button
                onClick={() => setAppMode("primary")}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: appMode === "primary" ? "rgba(16,185,129,0.24)" : "rgba(255,255,255,0.06)",
                  color: "inherit",
                  borderRadius: 999,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Primary Risk Mode
              </button>
              <button
                onClick={() => setAppMode("tprm")}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: appMode === "tprm" ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
                  color: "inherit",
                  borderRadius: 999,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                TPRM Mode
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setActiveView(t.k)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: activeView === t.k ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
                    color: "inherit",
                    borderRadius: 999,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    opacity: activeView === t.k ? 1 : 0.92,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Context bar */}
        {showContextBar ? (
          <div style={{ marginTop: 14 }}>
            <Card style={{ padding: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 800 }}>Context</div>

                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Vendor</div>
                    <select
                      className="input"
                      value={selectedVendor?.id || ""}
                      onChange={(e) => selectVendor(e.target.value)}
                      disabled={!vendors.length}
                    >
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name?.trim() ? v.name : "(Unnamed vendor)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ minWidth: 320 }}>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Scenario</div>
                    <select
                      className="input"
                      value={selectedScenario?.id || ""}
                      onChange={(e) => selectScenario(e.target.value)}
                      disabled={!selectedVendor || !Array.isArray(selectedVendor?.scenarios) || selectedVendor.scenarios.length === 0}
                    >
                      {(selectedVendor?.scenarios || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title?.trim() ? s.title : "(Untitled scenario)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>Index: {selectedVendor ? tierIndex(selectedVendor.tiering || emptyTiering()) : "—"}</Pill>
                    <Pill>Tier: {selectedVendor?.tier || "—"}</Pill>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Button className="btn" onClick={() => setActiveView("Vendors")}>
                    Manage vendors
                  </Button>
                </div>
              </div>

              {!selectedVendor ? (
                <>
                  <Divider />
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    No vendor selected yet. Go to <strong>Vendors</strong> and create one.
                  </div>
                </>
              ) : null}
            </Card>
          </div>
        ) : null}

        {/* Main */}
        <div style={{ marginTop: 14 }}>
          {!hydrated ? (
            <Card>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Loading…</div>
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>Hydrating local data.</div>
            </Card>
          ) : vendorForm.open ? (
            <VendorForm
              mode={vendorForm.mode}
              draft={vendorForm.draft}
              onChange={(next) => setVendorForm((p) => ({ ...p, draft: next }))}
              onCancel={closeVendorForm}
              onSubmit={vendorForm.mode === "create" ? createVendor : saveVendor}
            />
          ) : activeView === "Vendors" ? (
            <VendorsView
              vendors={vendors}
              selectedVendorId={selectedVendor?.id || ""}
              onSelectVendor={(id) => selectVendor(id)}
              onRequestCreate={openCreateVendor}
              onRequestEdit={openEditVendor}
              onDeleteVendor={deleteVendor}
              onGoTiering={() => setActiveView("Tiering")}
            />
          ) : needsVendor && !selectedVendor ? (
            <Card>
              <div style={{ fontSize: 18, fontWeight: 900 }}>No vendor</div>
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                Create a vendor first in <strong>Vendors</strong>.
              </div>
            </Card>
          ) : needsScenario && !selectedScenario ? (
            <Card>
              <div style={{ fontSize: 18, fontWeight: 900 }}>No scenario</div>
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                Create/select a scenario in <strong>Scenarios</strong> first.
              </div>
            </Card>
          ) : activeView === "Tiering" ? (
            <TieringView vendor={selectedVendor} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : activeView === "Scenarios" ? (
  <ScenariosView
    vendor={selectedVendor}
    updateVendor={updateVendor}
    setActiveView={setActiveView}
    selectScenario={selectScenario}
  />
) : activeView === "Quantify" ? (
            <QuantifyView
  vendor={selectedVendor}
  scenario={selectedScenario}
  updateVendor={updateVendor}
  setActiveView={setActiveView}
/>
          ) : activeView === "Results" ? (
            <ResultsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} setActiveView={setActiveView} />
          ) : activeView === "Treatments" ? (
  <TreatmentsView
    vendor={selectedVendor}
    scenario={selectedScenario}
    updateVendor={updateVendor}
  />
) : activeView === "Decisions" ? (
            <DecisionsView vendor={selectedVendor} scenario={selectedScenario} updateVendor={updateVendor} />
          ) : activeView === "Dashboard" ? (
  <DashboardView
    vendors={vendors}
    setActiveView={setActiveView}
    selectVendor={selectVendor}
    selectScenario={selectScenario}
    updateVendor={updateVendor}
    updateManyVendors={updateManyVendors}
  />
) : (
            <Card>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Unknown view</div>
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                This tab is not wired yet.
              </div>
            </Card>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
