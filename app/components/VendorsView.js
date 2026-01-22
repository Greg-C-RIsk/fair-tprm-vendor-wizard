"use client";

export default function VendorsView({
  vendors,
  selectedVendor,
  setSelectedVendorId,
  addVendor,
  updateVendor,
  deleteVendor,
  setActiveView,
}) {
  const [mode, setMode] = useState("list"); // list | create | edit
  const [draft, setDraft] = useState(null);

  // ---------- handlers ----------
  const startCreate = () => {
    setDraft({
      name: "",
      category: "SaaS",
      criticalFunction: "",
      dataTypes: "",
    });
    setMode("create");
  };

  const startEdit = () => {
    setDraft({ ...selectedVendor });
    setMode("edit");
  };

  const cancel = () => {
    setDraft(null);
    setMode("list");
  };

  const submitCreate = () => {
    addVendor(draft);
    setDraft(null);
    setMode("list");
  };

  const submitEdit = () => {
    updateVendor(selectedVendor.id, draft);
    setDraft(null);
    setMode("list");
  };

  // ---------- render ----------
  return (
    <div className="card">
      <h2>Vendors</h2>

      {/* LIST */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        {/* LEFT: vendor list */}
        <div>
          <button onClick={startCreate}>➕ Add vendor</button>

          <ul style={{ marginTop: 12 }}>
            {vendors.length === 0 && <li>No vendors yet</li>}
            {vendors.map((v) => (
              <li
                key={v.id}
                style={{
                  cursor: "pointer",
                  fontWeight: selectedVendor?.id === v.id ? 800 : 400,
                }}
                onClick={() => {
                  setSelectedVendorId(v.id);
                  setMode("list");
                }}
              >
                {v.name || "(Unnamed vendor)"}
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: content */}
        <div>
          {/* EMPTY */}
          {mode === "list" && !selectedVendor && (
            <div className="hint">
              Select a vendor or create a new one.
            </div>
          )}

          {/* VIEW */}
          {mode === "list" && selectedVendor && (
            <div>
              <h3>{selectedVendor.name}</h3>
              <p><strong>Category:</strong> {selectedVendor.category}</p>
              <p><strong>Critical function:</strong> {selectedVendor.criticalFunction}</p>
              <p><strong>Data types:</strong> {selectedVendor.dataTypes}</p>

              <div style={{ marginTop: 12 }}>
                <button onClick={startEdit}>Edit</button>
                <button onClick={() => deleteVendor(selectedVendor.id)}>Delete</button>
                <button onClick={() => setActiveView("Tiering")}>
                  Go to tiering →
                </button>
              </div>
            </div>
          )}

          {/* FORM */}
          {(mode === "create" || mode === "edit") && (
            <div>
              <h3>{mode === "create" ? "Create vendor" : "Edit vendor"}</h3>

              <div className="grid">
                <input
                  placeholder="Vendor name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option>SaaS</option>
                  <option>Cloud</option>
                  <option>MSP</option>
                </select>
                <input
                  placeholder="Critical business function"
                  value={draft.criticalFunction}
                  onChange={(e) =>
                    setDraft({ ...draft, criticalFunction: e.target.value })
                  }
                />
                <textarea
                  placeholder="Data types processed"
                  value={draft.dataTypes}
                  onChange={(e) =>
                    setDraft({ ...draft, dataTypes: e.target.value })
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
                {mode === "create" ? (
                  <button onClick={submitCreate}>Create vendor</button>
                ) : (
                  <button onClick={submitEdit}>Save changes</button>
                )}
                <button onClick={cancel}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
