"use client";

export default function VendorsView({ selectedVendor, addVendor, updateVendor, deleteVendor }) {
  if (!selectedVendor) return null;

  return (
    <div className="card card-pad">
      <h2 style={{ marginBottom: 8 }}>Vendor Intake</h2>

      <div className="grid">
        <div className="col6">
          <div className="label">Vendor name</div>
          <input
            className="input"
            value={selectedVendor.name}
            onChange={(e) => updateVendor(selectedVendor.id, { name: e.target.value })}
          />
        </div>

        <div className="col6">
          <div className="label">Category</div>
          <select
            className="input"
            value={selectedVendor.category}
            onChange={(e) => updateVendor(selectedVendor.id, { category: e.target.value })}
          >
            {["SaaS","Cloud","MSP","Payment","Data processor","AI provider","Other"].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="col12">
          <div className="label">Critical function</div>
          <input
            className="input"
            value={selectedVendor.criticalFunction}
            onChange={(e) => updateVendor(selectedVendor.id, { criticalFunction: e.target.value })}
          />
        </div>

        <div className="col12">
          <div className="label">Data types</div>
          <textarea
            className="textarea"
            value={selectedVendor.dataTypes}
            onChange={(e) => updateVendor(selectedVendor.id, { dataTypes: e.target.value })}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={addVendor}>Add vendor</button>
        <button className="btn" onClick={() => deleteVendor(selectedVendor.id)}>Delete vendor</button>
      </div>
    </div>
  );
}
