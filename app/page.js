"use client";

import { useEffect, useMemo, useState } from "react";

const emptyDraft = () => ({
  name: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  dependencyLevel: "Medium",
});

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 12, opacity: 0.75 }}>{hint}</div> : null}
    </div>
  );
}

export default function VendorsView({
  vendors,
  selectedVendorId,
  onSelectVendor,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
}) {
  const list = Array.isArray(vendors) ? vendors : [];

  const selected = useMemo(() => {
    return list.find((v) => v.id === selectedVendorId) || list[0] || null;
  }, [list, selectedVendorId]);

  // UI modes
  const [mode, setMode] = useState("list"); // "list" | "create" | "edit"
  const [draft, setDraft] = useState(emptyDraft());

  // When switching vendor, return to list
  useEffect(() => {
    setMode("list");
  }, [selectedVendorId]);

  const startCreate = () => {
    setDraft(emptyDraft());
    setMode("create");
  };

  const startEdit = () => {
    if (!selected) return;
    setDraft({
      name: selected.name || "",
      category: selected.category || "SaaS",
      businessOwner: selected.businessOwner || "",
      criticalFunction: selected.criticalFunction || "",
      dataTypes: selected.dataTypes || "",
      geography: selected.geography || "EU",
      dependencyLevel: selected.dependencyLevel || "Medium",
    });
    setMode("edit");
  };

  const cancel = () => {
    setMode("list");
    setDraft(emptyDraft());
  };

  const canSubmit = draft.name.trim().length > 0;

  const submitCreate = () => {
    if (!canSubmit) return;
    onAddVendor({
      ...draft,
      name: draft.name.trim(),
    });
    setMode("list");
    setDraft(emptyDraft());
  };

  const submitEdit = () => {
    if (!selected) return;
    if (!canSubmit) return;

    onUpdateVendor(selected.id, {
      ...draft,
      name: draft.name.trim(),
    });

    setMode("list");
    setDraft(emptyDraft());
  };

  return (
    <div className="grid" style={{ alignItems: "start" }}>
      {/* LEFT: Vendors list */}
      <div className="col6">
        <div className="card card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Vendors</div>
              <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                Sélectionne un vendor, ou crée-en un nouveau.
              </div>
            </div>

            <button className="btn primary" onClick={startCreate} type="button">
              Add vendor
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {list.length === 0 ? (
              <div className="hint">Aucun vendor pour l’instant.</div>
            ) : (
              list.map((v) => {
                const active = v.id === (selected?.id || "");
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVendor(v.id)}
                    className="card"
                    style={{
                      padding: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      border: active ? "1px solid rgba(110,231,255,0.40)" : "1px solid rgba(255,255,255,0.10)",
                      background: active ? "rgba(110,231,255,0.06)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900 }}>
                        {v.name?.trim() ? v.name : "(Unnamed vendor)"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{v.category || "—"}</div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      {v.geography || "—"} · Dependency: {v.dependencyLevel || "—"}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                      Scenarios: {v.scenarios?.length || 0}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Details / Create / Edit */}
      <div className="col6">
        {/* Create */}
        {mode === "create" ? (
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Create vendor</div>
                <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                  Remplis les infos minimales, puis crée le vendor.
                </div>
              </div>

              <button className="btn" onClick={cancel} type="button">
                Cancel
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <Field label="Vendor name" hint="Requis">
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ex: Salesforce"
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Category">
                  <select
                    className="input"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Geography">
                  <select
                    className="input"
                    value={draft.geography}
                    onChange={(e) => setDraft((d) => ({ ...d, geography: e.target.value }))}
                  >
                    {["EU", "US", "UK", "Global", "Other"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Business owner">
                <input
                  className="input"
                  value={draft.businessOwner}
                  onChange={(e) => setDraft((d) => ({ ...d, businessOwner: e.target.value }))}
                  placeholder="Ex: Head of Sales Ops"
                />
              </Field>

              <Field label="Critical business function supported">
                <input
                  className="input"
                  value={draft.criticalFunction}
                  onChange={(e) => setDraft((d) => ({ ...d, criticalFunction: e.target.value }))}
                  placeholder="Ex: Customer acquisition and retention"
                />
              </Field>

              <Field label="Data types accessed or processed">
                <textarea
                  className="textarea"
                  value={draft.dataTypes}
                  onChange={(e) => setDraft((d) => ({ ...d, dataTypes: e.target.value }))}
                  placeholder="Ex: PII, billing data, support tickets"
                />
              </Field>

              <Field label="Dependency level">
                <select
                  className="input"
                  value={draft.dependencyLevel}
                  onChange={(e) => setDraft((d) => ({ ...d, dependencyLevel: e.target.value }))}
                >
                  {["Low", "Medium", "High"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
                <button className="btn" onClick={cancel} type="button">
                  Cancel
                </button>
                <button className={`btn primary`} onClick={submitCreate} disabled={!canSubmit} type="button">
                  Create vendor
                </button>
              </div>

              {!canSubmit ? <div className="hint">Le nom du vendor est requis.</div> : null}
            </div>
          </div>
        ) : null}

        {/* Edit */}
        {mode === "edit" && selected ? (
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Edit vendor</div>
                <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                  Modifie puis sauvegarde.
                </div>
              </div>

              <button className="btn" onClick={cancel} type="button">
                Cancel
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <Field label="Vendor name" hint="Requis">
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Category">
                  <select
                    className="input"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {["SaaS", "Cloud", "MSP", "Payment", "Data processor", "AI provider", "Other"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Geography">
                  <select
                    className="input"
                    value={draft.geography}
                    onChange={(e) => setDraft((d) => ({ ...d, geography: e.target.value }))}
                  >
                    {["EU", "US", "UK", "Global", "Other"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Business owner">
                <input
                  className="input"
                  value={draft.businessOwner}
                  onChange={(e) => setDraft((d) => ({ ...d, businessOwner: e.target.value }))}
                />
              </Field>

              <Field label="Critical business function supported">
                <input
                  className="input"
                  value={draft.criticalFunction}
                  onChange={(e) => setDraft((d) => ({ ...d, criticalFunction: e.target.value }))}
                />
              </Field>

              <Field label="Data types accessed or processed">
                <textarea
                  className="textarea"
                  value={draft.dataTypes}
                  onChange={(e) => setDraft((d) => ({ ...d, dataTypes: e.target.value }))}
                />
              </Field>

              <Field label="Dependency level">
                <select
                  className="input"
                  value={draft.dependencyLevel}
                  onChange={(e) => setDraft((d) => ({ ...d, dependencyLevel: e.target.value }))}
                >
                  {["Low", "Medium", "High"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
                <button className="btn" onClick={cancel} type="button">
                  Cancel
                </button>
                <button className="btn primary" onClick={submitEdit} disabled={!canSubmit} type="button">
                  Save changes
                </button>
              </div>

              {!canSubmit ? <div className="hint">Le nom du vendor est requis.</div> : null}
            </div>
          </div>
        ) : null}

        {/* Details (default) */}
        {mode === "list" ? (
          <div className="card card-pad">
            {!selected ? (
              <div className="hint">Sélectionne un vendor dans la liste ou clique “Add vendor”.</div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {selected.name?.trim() ? selected.name : "(Unnamed vendor)"}
                    </div>
                    <div style={{ opacity: 0.75, marginTop: 6 }}>
                      {selected.category || "—"} · {selected.geography || "—"} · Dependency:{" "}
                      {selected.dependencyLevel || "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={startEdit} type="button">
                      Edit
                    </button>
                    <button className="btn" onClick={() => onDeleteVendor(selected.id)} type="button">
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div className="hint">
                    <div style={{ fontWeight: 800 }}>Business owner</div>
                    <div style={{ marginTop: 4 }}>{selected.businessOwner?.trim() ? selected.businessOwner : "—"}</div>
                  </div>

                  <div className="hint">
                    <div style={{ fontWeight: 800 }}>Critical business function</div>
                    <div style={{ marginTop: 4 }}>{selected.criticalFunction?.trim() ? selected.criticalFunction : "—"}</div>
                  </div>

                  <div className="hint">
                    <div style={{ fontWeight: 800 }}>Data types</div>
                    <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                      {selected.dataTypes?.trim() ? selected.dataTypes : "—"}
                    </div>
                  </div>

                  <div className="hint">
                    <div style={{ fontWeight: 800 }}>Scenarios</div>
                    <div style={{ marginTop: 4 }}>{selected.scenarios?.length || 0} scenario(s)</div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
