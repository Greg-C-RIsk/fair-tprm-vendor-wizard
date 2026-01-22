"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * page.js (single-file “Mode A”)
 * UX goals:
 * - Top nav = ONLY tabs (no duplicate “Add vendor” in the header)
 * - Vendors tab:
 *   - Left: vendor list + search + “Add vendor”
 *   - Right: vendor details panel
 *   - Add/Edit uses a dedicated form panel with “Create vendor” / “Save” / “Cancel”
 * - Safe localStorage + safe defaults (no SSR/prerender crashes)
 *
 * Notes:
 * - This file is self-contained (no imports from ./components needed).
 * - If you already have other tabs (Quantify/Treatments/etc.), they are included as placeholders
 *   so the app remains usable while you iterate. We’ll plug your real views afterward.
 */

const LS_KEY = "fair_tprm_training_v6";

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

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

const emptyVendor = () => ({
  id: uid(),
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  dependencyLevel: "Medium",
  tier: "",
  tierRationale: "",
  tiering: emptyTiering(),
  carryForward: false,
  scenarios: [emptyScenario()],
});

function safeParse(raw, fallback) {
  try {
    const x = JSON.parse(raw);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

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
  // mode: "create" | "edit"
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          Tip: Create the vendor first, then go to Tiering and Quantify with scenarios.
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
    return vendors.filter((v) => (v.name || "").toLowerCase().includes(s) || (v.category || "").toLowerCase().includes(s));
  }, [vendors, q]);

  const selected = useMemo(() => vendors.find((v) => v.id === selectedVendorId) || null, [vendors, selectedVendorId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
      {/* Left list */}
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

      {/* Right details */}
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
                    ? selected.scenarios.map((s) => (s.title?.trim() ? s.title : "(Untitled scenario)")).join(" • ")
                    : "—"}
                </div>
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Prioritization</div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Index: {tierIndex(selected.tiering || emptyTiering())}</div>
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

function PlaceholderView({ title, text }) {
  return (
    <Card>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>{text}</div>
    </Card>
  );
}

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  // persisted app state
  const [state, setState] = useState(() => {
    // Important: do NOT assume window exists (avoids prerender crashes)
    if (typeof window === "undefined") {
      return { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };
    }
    const raw = window.localStorage.getItem(LS_KEY);
    const base = raw
      ? safeParse(raw, { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" })
      : { vendors: [emptyVendor()], selectedVendorId: "", selectedScenarioId: "" };

    // normalize
    const vendors = Array.isArray(base.vendors) && base.vendors.length ? base.vendors : [emptyVendor()];
    return {
      vendors,
      selectedVendorId: base.selectedVendorId || vendors[0]?.id || "",
      selectedScenarioId: base.selectedScenarioId || vendors[0]?.scenarios?.[0]?.id || "",
    };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const vendors = Array.isArray(state.vendors) ? state.vendors : [];

  // ensure a selected vendor exists
  useEffect(() => {
    if (!vendors.length) {
      const v = emptyVendor();
      setState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" });
      return;
    }
    if (!state.selectedVendorId) {
      setState((p) => ({ ...p, selectedVendorId: vendors[0]?.id || "" }));
      return;
    }
    const exists = vendors.some((v) => v.id === state.selectedVendorId);
    if (!exists) {
      setState((p) => ({ ...p, selectedVendorId: vendors[0]?.id || "", selectedScenarioId: vendors[0]?.scenarios?.[0]?.id || "" }));
    }
  }, [vendors, state.selectedVendorId]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === state.selectedVendorId) || vendors[0] || null,
    [vendors, state.selectedVendorId]
  );

  // ---- Vendor create/edit UX state
  const [vendorForm, setVendorForm] = useState({ open: false, mode: "create", draft: null });

  const openCreateVendor = () => {
    setVendorForm({ open: true, mode: "create", draft: { ...emptyVendor(), scenarios: [emptyScenario()] } });
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
      ...d,
      id: uid(),
      scenarios: Array.isArray(d.scenarios) && d.scenarios.length ? d.scenarios : [emptyScenario()],
      tiering: d.tiering || emptyTiering(),
    };
    setState((p) => ({
      ...p,
      vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), v],
      selectedVendorId: v.id,
      selectedScenarioId: v.scenarios?.[0]?.id || "",
    }));
    closeVendorForm();
  };

  const saveVendor = () => {
    const d = vendorForm.draft;
    if (!d) return;
    setState((p) => ({
      ...p,
      vendors: (Array.isArray(p.vendors) ? p.vendors : []).map((v) => (v.id === d.id ? { ...v, ...d } : v)),
    }));
    closeVendorForm();
  };

  const deleteVendor = (vendorId) => {
    setState((p) => {
      const next = (Array.isArray(p.vendors) ? p.vendors : []).filter((v) => v.id !== vendorId);
      const fallback = next.length ? next : [emptyVendor()];
      const sel = fallback[0];
      return {
        ...p,
        vendors: fallback,
        selectedVendorId: sel?.id || "",
        selectedScenarioId: sel?.scenarios?.[0]?.id || "",
      };
    });
  };

  // ---- Header/nav
  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Quantify", label: "Quantify" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

  return (
    <div className="container" style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Training only — data stays in your browser.
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{vendors.length} vendor(s)</Pill>
            <Pill>
              {vendors.reduce((n, v) => n + (Array.isArray(v.scenarios) ? v.scenarios.length : 0), 0)} scenario(s)
            </Pill>
            <Pill>Carry-forward: {vendors.filter((v) => !!v.carryForward).length}</Pill>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            className="btn"
            onClick={() => {
              if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
              const v = emptyVendor();
              setState({ vendors: [v], selectedVendorId: v.id, selectedScenarioId: v.scenarios?.[0]?.id || "" });
              setActiveView("Vendors");
              closeVendorForm();
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Tabs (no “Add vendor” here) */}
      <div style={{ marginTop: 14 }}>
        <Card style={{ padding: 10 }}>
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

      {/* Main */}
      <div style={{ marginTop: 14 }}>
        {vendorForm.open ? (
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
            onSelectVendor={(id) => setState((p) => ({ ...p, selectedVendorId: id }))}
            onRequestCreate={openCreateVendor}
            onRequestEdit={openEditVendor}
            onDeleteVendor={deleteVendor}
            onGoTiering={() => setActiveView("Tiering")}
          />
        ) : activeView === "Tiering" ? (
          <PlaceholderView
            title="Tiering"
            text="Tiering view placeholder (stable). Next step: we plug your full Tiering matrix here, using selectedVendor."
          />
        ) : activeView === "Quantify" ? (
          <PlaceholderView
            title="Quantify"
            text="Quantify view placeholder (stable). Next step: we plug your FAIR-only form + engine outputs here."
          />
        ) : activeView === "Treatments" ? (
          <PlaceholderView
            title="Treatments"
            text="Treatments view placeholder (stable). Next step: show auto-suggested treatments + manual edits."
          />
        ) : activeView === "Decisions" ? (
          <PlaceholderView
            title="Decisions"
            text="Decisions view placeholder (stable). Next step: decision status, approver, rationale, review date."
          />
        ) : activeView === "Dashboard" ? (
          <PlaceholderView
            title="Dashboard"
            text="Dashboard view placeholder (stable). Next step: portfolio summary + heatmap + top risks."
          />
        ) : (
          <PlaceholderView title="Unknown view" text="This tab is not wired yet." />
        )}
      </div>
    </div>
  );
}
