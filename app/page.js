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

    setState((p) =>
      normalizeState({
        ...p,
        vendors: [...(Array.isArray(p.vendors) ? p.vendors : []), v],
        selectedVendorId: v.id,
        selectedScenarioId: v.scenarios?.[0]?.id || "",
      })
    );

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
    setActiveView("Vendors");
    closeVendorForm();
  };

  const tabs = [
    { k: "Vendors", label: "Vendors" },
    { k: "Tiering", label: "Tiering" },
    { k: "Scenarios", label: "Scenarios" },
    { k: "Quantify", label: "Quantify" },
    { k: "Results", label: "Results" },
    { k: "Treatments", label: "Treatments" },
    { k: "Decisions", label: "Decisions" },
    { k: "Dashboard", label: "Dashboard" },
  ];

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
            <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" }}>FAIR TPRM Training Tool</div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>Training only — data stays in your browser.</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>{vendors.length} vendor(s)</Pill>
              <Pill>{totalScenarios} scenario(s)</Pill>
              <Pill>Carry-forward: {carried}</Pill>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button className="btn" onClick={resetAll}>
              Reset
            </Button>
          </div>
        </div>

        {/* Tabs */}
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
            <TreatmentsView vendor={selectedVendor} scenario={selectedScenario} />
          ) : activeView === "Decisions" ? (
            <DecisionsView vendor={selectedVendor} scenario={selectedScenario} />
          ) : activeView === "Dashboard" ? (
            <DashboardView vendors={vendors} />
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
