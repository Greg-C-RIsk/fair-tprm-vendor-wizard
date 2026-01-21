"use client";

const tierIndex = (t) =>
  Number(t.dataSensitivity || 1) *
  Number(t.integrationDepth || 1) *
  Number(t.accessPrivileges || 1) *
  Number(t.historicalIncidents || 1) *
  Number(t.businessCriticality || 1);

function Score({ value, onChange }) {
  return (
    <select className="input" value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}</option>)}
    </select>
  );
}

export default function TieringView({ vendors, updateVendor }) {
  return (
    <div className="card card-pad">
      <h2 style={{ marginBottom: 8 }}>Tiering Matrix</h2>
      <p className="h-sub">Rate 1→5 and multiply for a prioritization index.</p>

      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Vendor</th>
              <th>Data</th>
              <th>Integration</th>
              <th>Privileges</th>
              <th>Incidents</th>
              <th>Criticality</th>
              <th>Index</th>
              <th>Carry</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => {
              const t = v.tiering;
              const idx = tierIndex(t);
              return (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{v.name || "(Unnamed vendor)"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{v.category} · {v.geography}</div>
                  </td>
                  <td><Score value={t.dataSensitivity} onChange={(n) => updateVendor(v.id, { tiering: { ...t, dataSensitivity: n } })} /></td>
                  <td><Score value={t.integrationDepth} onChange={(n) => updateVendor(v.id, { tiering: { ...t, integrationDepth: n } })} /></td>
                  <td><Score value={t.accessPrivileges} onChange={(n) => updateVendor(v.id, { tiering: { ...t, accessPrivileges: n } })} /></td>
                  <td><Score value={t.historicalIncidents} onChange={(n) => updateVendor(v.id, { tiering: { ...t, historicalIncidents: n } })} /></td>
                  <td><Score value={t.businessCriticality} onChange={(n) => updateVendor(v.id, { tiering: { ...t, businessCriticality: n } })} /></td>
                  <td style={{ fontWeight: 900 }}>{idx}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!v.carryForward}
                      onChange={(e) => updateVendor(v.id, { carryForward: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
