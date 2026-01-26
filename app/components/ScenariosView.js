"use client";

import { useEffect, useMemo, useState } from "react";
import { emptyScenario, uid } from "../../lib/model";

function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>{label}</div>
      {textarea ? (
        <textarea
          className="textarea"
          value={value}
          placeholder={placeholder}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function ScenariosView({ vendor, updateVendor, setActiveView, selectScenario }) {
  const vendorScenarios = useMemo(() => {
    return Array.isArray(vendor?.scenarios) ? vendor.scenarios : [];
  }, [vendor]);
    // Signature stable (ids) pour éviter de re-hydrater pendant la saisie
  const vendorScenarioIdsSig = useMemo(() => {
    return (Array.isArray(vendorScenarios) ? vendorScenarios : [])
      .map((s) => s.id)
      .join("|");
  }, [vendorScenarios]);

  // Local working copy (edits live here until Save)
  const [localScenarios, setLocalScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

    // When vendor changes, re-hydrate local copy (reset dirty)
  // IMPORTANT: ne se relance que si la liste des scénarios change vraiment (ids)
  useEffect(() => {
    // clone => évite les références partagées qui peuvent provoquer des resets
    const cloned = JSON.parse(JSON.stringify(vendorScenarios));

    setLocalScenarios(cloned);
    setIsDirty(false);
    setJustSaved(false);

    setActiveScenarioId((prev) => {
      if (!cloned.length) return "";
      if (prev && cloned.some((s) => s.id === prev)) return prev;
      return cloned[0].id;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id, vendorScenarioIdsSig]);

  // Keep selection valid even as local list changes
  useEffect(() => {
    if (!localScenarios.length) {
      setActiveScenarioId("");
      return;
    }
    if (!activeScenarioId || !localScenarios.some((s) => s.id === activeScenarioId)) {
      setActiveScenarioId(localScenarios[0].id);
    }
  }, [localScenarios, activeScenarioId]);

  const activeScenario = useMemo(() => {
    return localScenarios.find((s) => s.id === activeScenarioId) || null;
  }, [localScenarios, activeScenarioId]);

  if (!vendor) {
    return (
      <div className="card">
        <h2 style={{ margin: 0 }}>Scenarios</h2>
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          No vendor selected. Go to <strong>Vendors</strong> first.
        </p>
      </div>
    );
  }

  const markDirty = () => {
    setIsDirty(true);
    setJustSaved(false);
  };

  const addScenario = () => {
    const s = emptyScenario();
    const next = [
      ...(Array.isArray(localScenarios) ? localScenarios : []),
      {
        ...s,
        id: uid(),
        title: `Scenario ${localScenarios.length + 1}`,
      },
    ];
    setLocalScenarios(next);
    setActiveScenarioId(next[next.length - 1].id);
    markDirty();
  };

  const deleteScenario = (scenarioId) => {
    const next = localScenarios.filter((s) => s.id !== scenarioId);

    if (next.length === 0) {
      const s = { ...emptyScenario(), id: uid(), title: "Scenario 1" };
      setLocalScenarios([s]);
      setActiveScenarioId(s.id);
      markDirty();
      return;
    }

    setLocalScenarios(next);
    setActiveScenarioId(next[0].id);
    markDirty();
  };

  const patchScenario = (scenarioId, patch) => {
    const next = localScenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch } : s));
    setLocalScenarios(next);
    markDirty();
  };

  const saveChanges = () => {
  updateVendor(vendor.id, { scenarios: localScenarios });

  if (typeof selectScenario === "function" && activeScenarioId) {
    selectScenario(activeScenarioId);
  }

  setIsDirty(false);
  setJustSaved(true);
  setTimeout(() => setJustSaved(false), 1500);
};

  const cancelChanges = () => {
    // Revert local edits
    setLocalScenarios(vendorScenarios);
    setIsDirty(false);
    setJustSaved(false);

    if (vendorScenarios.length) setActiveScenarioId(vendorScenarios[0].id);
    else setActiveScenarioId("");
    
    if (typeof selectScenario === "function" && vendorScenarios.length) {
  selectScenario(vendorScenarios[0].id);
}
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
      {/* Left: scenario list */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Scenarios</div>
          <button className="btn primary" onClick={addScenario}>
            + Add
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {localScenarios.map((s) => {
            const active = s.id === activeScenarioId;
            return (
              <button
                key={s.id}
                onClick={() => {
  setActiveScenarioId(s.id);
  // Ne sélectionne globalement que si le scénario existe déjà dans vendor.scenarios
  if (typeof selectScenario === "function" && vendorScenarios.some((x) => x.id === s.id)) {
    selectScenario(s.id);
  }
}}
                style={{
                  textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                  borderRadius: 14,
                  padding: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 900 }}>{s.title?.trim() ? s.title : "(Untitled scenario)"}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Threat actor: {s.threatActor?.trim() ? s.threatActor : "—"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Save/Cancel actions */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={saveChanges} disabled={!isDirty}>
            Save changes
          </button>
          <button className="btn" onClick={cancelChanges} disabled={!isDirty}>
            Cancel
          </button>
          {justSaved ? (
            <div style={{ fontSize: 12, opacity: 0.85, alignSelf: "center" }}>Saved ✅</div>
          ) : isDirty ? (
            <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>Unsaved changes</div>
          ) : null}
        </div>
      </div>

      {/* Right: scenario editor */}
      <div className="card">
        {!activeScenario ? (
          <div style={{ opacity: 0.8 }}>Select a scenario, or click “Add”.</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>
                  {activeScenario.title?.trim() ? activeScenario.title : "(Untitled scenario)"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                  Changes are kept locally until you click <strong>Save changes</strong>.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
  className="btn"
  onClick={() => {
    if (!activeScenario) return;

    if (isDirty) {
      saveChanges(); // ça va aussi faire selectScenario(activeScenarioId)
    } else if (typeof selectScenario === "function") {
      selectScenario(activeScenario.id);
    }

    setActiveView?.("Quantify");
  }}
>
  Go to Quantify →
</button>
                <button className="btn" onClick={() => deleteScenario(activeScenario.id)}>
                  Delete
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field
                label="Scenario title"
                value={activeScenario.title || ""}
                placeholder="Example: Ransomware on vendor admin console"
                onChange={(v) => patchScenario(activeScenario.id, { title: v })}
              />
              <Field
                label="Asset at risk"
                value={activeScenario.assetAtRisk || ""}
                placeholder="Example: Customer database / admin portal"
                onChange={(v) => patchScenario(activeScenario.id, { assetAtRisk: v })}
              />

              <Field
                label="Threat actor"
                value={activeScenario.threatActor || ""}
                placeholder="Example: External cybercriminal"
                onChange={(v) => patchScenario(activeScenario.id, { threatActor: v })}
              />
              <Field
                label="Attack vector"
                value={activeScenario.attackVector || ""}
                placeholder="Example: Credential stuffing + MFA bypass"
                onChange={(v) => patchScenario(activeScenario.id, { attackVector: v })}
              />

              <div style={{ gridColumn: "1 / -1" }}>
                <Field
                  label="Loss event"
                  value={activeScenario.lossEvent || ""}
                  placeholder="Example: Unauthorized access → data exfiltration"
                  onChange={(v) => patchScenario(activeScenario.id, { lossEvent: v })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field
                  label="Narrative"
                  value={activeScenario.narrative || ""}
                  placeholder="Short story of what happens, step-by-step"
                  textarea
                  onChange={(v) => patchScenario(activeScenario.id, { narrative: v })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field
                  label="Assumptions"
                  value={activeScenario.assumptions || ""}
                  placeholder="Key assumptions for FAIR estimation"
                  textarea
                  onChange={(v) => patchScenario(activeScenario.id, { assumptions: v })}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
