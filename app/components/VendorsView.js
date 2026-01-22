"use client";

import { useMemo, useState } from "react";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

// Local helpers only for display
const emptyTiering = () => ({
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
});

const tierIndex = (t) =>
  Number(t?.dataSensitivity || 1) *
  Number(t?.integrationDepth || 1) *
  Number(t?.accessPrivileges || 1) *
  Number(t?.historicalIncidents || 1) *
  Number(t?.businessCriticality || 1);

const emptyQuant = () => ({
  level: "LEF",
  lef: { min: "", ml: "", max: "" },
  tef: { min: "", ml: "", max: "" },
  contactFrequency: { min: "", ml: "", max: "" },
  probabilityOfAction: { min: "", ml: "", max: "" },
  susceptibility: { min: "", ml: "", max: "" },
  threatCapacity: { min: "", ml: "", max: "" },
  resistanceStrength: { min: "", ml: "", max: "" },
  primaryLoss: { min: "", ml: "", max: "" },
  secondaryLossEventFrequency: { min: "", ml: "", max: "" },
  secondaryLossMagnitude: { min: "", ml: "", max: "" },
  sims: 10000,
  stats: null,
  aleSamples: [],
  pelSamples: [],
  lastRunAt: "",
});

const emptyScenario = () => ({
  id: uid(),
  title: "",
  assetAtRisk: "",
  threatActor: "External cybercriminal",
  attackVector: "",
  lossEvent: "",
  narrative: "",
  assumptions: "",
  quant: emptyQuant(),
  treatments: [],
  decision: { status: "", owner: "", approver: "", reviewDate: "", rationale: "" },
});

const emptyVendorDraft = () => ({
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  dependencyLevel: "Medium",
  carryForward: false,
  scenarios: [emptyScenario()],
});

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

function VendorForm({ mode, draft, onChange, onCancel, onSubmit }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{mode === "create" ? "Create a new vendor" : "Edit vendor"}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            Fill in the minimum required fields first. You can refine later.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={onCancel} className="btn">Cancel</Button>
          <Button onClick={onSubmit} className="btn primary">
            {mode === "create" ? "Create vendor" : "Save changes"}
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InputRow label="Vendor name">
          <input className="input" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </InputRow>

        <InputRow label="Category">
          <select className="input" value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value })}>
            {["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </InputRow>

        <InputRow label="Business owner">
          <input className="input" value={draft.businessOwner} onChange={(e) => onChange({ ...draft, businessOwner: e.target.value })} />
        </InputRow>

        <InputRow label="Geography">
          <select className="input" value={draft.geography} onChange={(e) => onChange({ ...draft, geography: e.target.value })}>
            {["EU", "US", "UK", "Global", "Other"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </InputRow>

        <div style={{ gridColumn: "1 / -1" }}>
          <InputRow label="Critical business function supported">
            <input className="input" value={draft.criticalFunction} onChange={(e) => onChange({ ...draft, criticalFunction: e.target.value })} />
          </InputRow>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <InputRow label="Data types processed">
            <textarea className="textarea" value={draft.dataTypes} onChange={(e) => onChange({ ...draft, dataTypes: e.target.value })} rows={5} />
          </InputRow>
        </div>

        <InputRow label="Dependency level">
          <select className="input" value={draft.dependencyLevel} onChange={(e) => onChange({ ...draft, dependencyLevel: e.target.value })}>
            {["Low", "Medium", "High"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </InputRow>

        <InputRow label="Carry-forward (for deeper analysis)">
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, opacity: 0.9 }}>
            <input type="checkbox" checked={!!draft.carryForward} onChange={(e) => onChange({ ...draft, carryForward: e.target.checked })} />
            Carry-forward
          </label>
        </InputRow>

        <div style={{ gridColumn: "1 / -1", marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Tip: Create the vendor first, then go to Tiering and Quantify with scenarios.
        </div>
      </div>
    </Card>
  );
}

export default function VendorsView({
  vendors,
  selectedVendor,
  onSelectVendor,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onGoTiering,
}) {
  const [q, setQ] = useState("");

  const [vendorForm, setVendorForm] = useState({ open: false, mode: "create", draft: null });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter(
      (v) => (v.name || "").toLowerCase().includes(s) || (v.category || "").toLowerCase().includes(s)
    );
  }, [vendors, q]);

  const openCreateVendor = () => {
    setVendorForm({ open: true, mode: "create", draft: { ...emptyVendorDraft(), scenarios: [emptyScenario()] } });
  };

  const openEditVendor = () => {
    if (!selectedVendor) return;
    setVendorForm({ open: true, mode: "edit", draft: JSON.parse(JSON.stringify(selectedVendor)) });
  };

  const closeVendorForm = () => setVendorForm({ open: false, mode: "create", draft: null });

  const createVendor = () => {
    const d = vendorForm.draft;
    if (!d) return;
    onAddVendor({
      ...d,
      scenarios: Array.isArray(d.scenarios) && d.scenarios.length ? d.scenarios : [emptyScenario()],
    });
    closeVendorForm();
  };

  const saveVendor = () => {
    const d = vendorForm.draft;
    if (!d) return;
    onUpdateVendor(d.id, { ...d });
    closeVendorForm();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
      {/* Left list */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Vendors</div>
          <Button className="btn primary" onClick={openCreateVendor}>
            + Add vendor
          </Button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor…" />
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.8, padding: "10px 0" }}>No vendors found.</div>
          ) : (
            filtered.map((v) => {
              const isActive = v.id === selectedVendor?.id;
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
                    <div style={{ fontWeight: 900 }}>{v.name?.trim() ? v.name : "(Unnamed vendor)"}</div>
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

      {/* Right side: either form or details */}
      {vendorForm.open ? (
        <VendorForm
          mode={vendorForm.mode}
          draft={vendorForm.draft}
          onChange={(next) => setVendorForm((p) => ({ ...p, draft: next }))}
          onCancel={closeVendorForm}
          onSubmit={vendorForm.mode === "create" ? createVendor : saveVendor}
        />
      ) : (
        <Card>
          {!selectedVendor ? (
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              Select a vendor on the left, or click <strong>Add vendor</strong>.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 950 }}>
                    {selectedVendor.name?.trim() ? selectedVendor.name : "(Unnamed vendor)"}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>{selectedVendor.category}</Pill>
                    <Pill>{selectedVendor.geography}</Pill>
                    <Pill>Dependency: {selectedVendor.dependencyLevel}</Pill>
                    <Pill>Tier: {selectedVendor.tier || "—"}</Pill>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Button className="btn" onClick={openEditVendor}>Edit</Button>
                  <Button className="btn" onClick={() => onDeleteVendor(selectedVendor.id)}>Delete</Button>
                  <Button className="btn primary" onClick={onGoTiering}>Go to tiering →</Button>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Card style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Critical function</div>
                  <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                    {selectedVendor.criticalFunction?.trim() ? selectedVendor.criticalFunction : "—"}
                  </div>
                </Card>

                <Card style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Business owner</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    {selectedVendor.businessOwner?.trim() ? selectedVendor.businessOwner : "—"}
                  </div>
                </Card>

                <Card style={{ padding: 12, gridColumn: "1 / -1" }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Data types</div>
                  <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                    {selectedVendor.dataTypes?.trim() ? selectedVendor.dataTypes : "—"}
                  </div>
                </Card>

                <Card style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Scenarios</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    {Array.isArray(selectedVendor.scenarios) && selectedVendor.scenarios.length
                      ? selectedVendor.scenarios.map((s) => (s.title?.trim() ? s.title : "(Untitled scenario)")).join(" • ")
                      : "—"}
                  </div>
                </Card>

                <Card style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Prioritization</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>Index: {tierIndex(selectedVendor.tiering || emptyTiering())}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>Carry-forward: {selectedVendor.carryForward ? "Yes" : "No"}</div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
