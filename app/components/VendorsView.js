"use client";

export default function VendorView({
  vendor,
  updateVendor,
  addScenario,
  setActiveView,
}) {
  if (!vendor) {
    return <div>Aucun vendor sélectionné</div>;
  }

  return (
    <div className="card">
      <h2>Vendor Intake</h2>

      <div className="field">
        <label>Vendor name</label>
        <input
          type="text"
          value={vendor.name}
          onChange={(e) =>
            updateVendor(vendor.id, { name: e.target.value })
          }
          placeholder="Vendor name"
        />
      </div>

      <div className="field">
        <label>Category</label>
        <select
          value={vendor.category}
          onChange={(e) =>
            updateVendor(vendor.id, { category: e.target.value })
          }
        >
          <option value="SaaS">SaaS</option>
          <option value="Cloud">Cloud</option>
          <option value="MSP">MSP</option>
          <option value="Data processor">Data processor</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="field">
        <label>Critical business function</label>
        <input
          type="text"
          value={vendor.criticalFunction}
          onChange={(e) =>
            updateVendor(vendor.id, {
              criticalFunction: e.target.value,
            })
          }
          placeholder="Example: Customer acquisition"
        />
      </div>

      <div className="field">
        <label>Data types processed</label>
        <textarea
          value={vendor.dataTypes}
          onChange={(e) =>
            updateVendor(vendor.id, { dataTypes: e.target.value })
          }
          placeholder="PII, financial data, credentials…"
        />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={addScenario}>
          Add scenario
        </button>

        <button
          onClick={() => setActiveView("Tiering")}
        >
          Go to tiering
        </button>
      </div>

      {vendor.scenarios.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Scenarios</h3>
          <ul>
            {vendor.scenarios.map((s) => (
              <li key={s.id}>
                {s.title || "(Untitled scenario)"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
