"use client";

import { useMemo, useState } from "react";
import { emptyVendor, emptyScenario, emptyTiering, tierIndex } from "../../lib/model";

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
            Create the vendor first, then do Tiering + Scenarios + Quantify.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={onCancel} className="btn">Cancel</Button>
          <Button onClick={onSubmit} className="btn primary">{mode === "create" ? "Create vendor" : "Save changes"}</Button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InputRow label="Vendor name">
          <input className="input" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Example: TalentLMS" />
        </InputRow>

        <InputRow label="Category">
          <select className="input" value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value })}>
            {["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </InputRow>

        <InputRow label="Business owner">
          <input className="input" value={draft.businessOwner} onChange={(e) => onChange({ ...draft, businessOwner: e.target.value })} placeholder="Example: Head of Sales Ops" />
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
            <input className="input" value={draft.criticalFunction} onChange={(e) => onChange({ ...draft, criticalFunction: e.target.value })} placeholder="Example: Customer acquisition & retention" />
          </InputRow>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <InputRow label="Data types processed">
            <textarea className="textarea" value={draft.dataTypes} onChange={(e) => onChange({ ...draft, dataTypes: e.target.value })} placeholder="Example: Customer PII, order history, support tickets" rows={5} />
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
          Note: Scenarios are created in the <strong>Scenarios</strong> tab.
        </div>
      </div>
    </Card>
  );
}

export default function VendorsView({
  vendors,
  selectedVendorId,
  onSelectVendor,
  onCreateVendor,
  onUpdateVendor,
  onDeleteVendor,
  onGoTiering,
}) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ open: false, mode: "create", draft: null });

  const openCreate = () => {
    const v = emptyVendor();
    v.scenarios = [emptyScenario()];
    setForm({ open: true, mode: "create", draft: v });
  };

  const openEdit = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setForm({ open: true, mode: "edit", draft: JSON.parse(JSON.stringify(v)) });
  };

  const closeForm = () => setForm({ open: false, mode: "create", draft: null });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) => (v.name || "").toLowerCase().includes(s) || (v.category || "").toLowerCase().includes(s));
  }, [vendors, search]);

  const selected = useMemo(() => vendors.find((v) => v.id === selectedVendorId) || null, [vendors, selectedVendorId]);

  const submit = () => {
    if (!form.draft) return;
    if (form.mode === "create") {
      onCreateVendor(form.draft);
      onSelectVendor(form.draft.id);
      closeForm();
      return;
    }
    onUpdateVendor(form.draft.id, form.draft);
    closeForm();
  };

  const remove = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId);
    const name = v?.name?.trim() ? v.name : "(Unnamed vendor)";
    if (!confirm(`Delete vendor ${name}?`)) return;
    onDeleteVendor(vendorId);
  };

  if (form.open) {
    return (
      <VendorForm
        mode={form.mode}
        draft={form.draft}
        onChange={(next) => setForm((p) => ({ ...p, draft: next }))}
        onCancel={closeForm}
        onSubmit={submit}
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, alignItems: "start" }}>
      {/* Left */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Vendors</div>
          <Button className="btn primary" onClick={openCreate}>+ Add vendor</Button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor…" />
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.8, padding: "10px 0" }}>No vendors found.</div>
          ) : (
            filtered.map((v) => {
              const isActive = v.id === selectedVendorId;
              const scenarioCount = Array.isArray(v.scenarios) ? v.scenarios.length : 0;
              const idx = tierIndex(v.tiering || emptyTiering());

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
                    <Pill>Index: {idx}</Pill>
                    <Pill>{scenarioCount} scenario(s)</Pill>
                    <Pill>{v.carryForward ? "Carry-forward" : "Not carried"}</Pill>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* Right */}
      <Card>
        {!selected ? (
          <div style={{ fontSize: 14, opacity: 0.85 }}>Select a vendor on the left, or click <strong>Add vendor</strong>.</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>{selected.name?.trim() ? selected.name : "(Unnamed vendor)"}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>{selected.category}</Pill>
                  <Pill>{selected.geography}</Pill>
                  <Pill>Dependency: {selected.dependencyLevel}</Pill>
                  <Pill>Tier: {selected.tier || "—"}</Pill>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Button className="btn" onClick={() => openEdit(selected.id)}>Edit</Button>
                <Button className="btn" onClick={() => remove(selected.id)}>Delete</Button>
                <Button className="btn primary" onClick={onGoTiering}>Go to tiering →</Button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Critical function</div>
                <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>{selected.criticalFunction?.trim() ? selected.criticalFunction : "—"}</div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Business owner</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{selected.businessOwner?.trim() ? selected.businessOwner : "—"}</div>
              </Card>

              <Card style={{ padding: 12, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Data types</div>
                <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>{selected.dataTypes?.trim() ? selected.dataTypes : "—"}</div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Scenarios</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {Array.isArray(selected.scenarios) && selected.scenarios.length
                    ? selected.scenarios.map((s) => (s.title?.trim() ? s.title : "(Untitled scenario)")).join(" • ")
                    : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Prioritization</div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Index: {tierIndex(selected.tiering || emptyTiering())}</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Carry-forward: {selected.carryForward ? "Yes" : "No"}</div>
                </div>
              </Card>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
