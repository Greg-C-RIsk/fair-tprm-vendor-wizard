"use client";

const CRITERIA = [
  {
    key: "dataSensitivity",
    label: "Data sensitivity",
    help: "Does the vendor handle personal, regulated, or financial data?",
  },
  {
    key: "integrationDepth",
    label: "Integration depth",
    help: "How tightly coupled is the vendor with core systems?",
  },
  {
    key: "accessPrivileges",
    label: "Access privileges",
    help: "Does the vendor have admin or API-level access?",
  },
  {
    key: "historicalIncidents",
    label: "Historical incidents",
    help: "Has the vendor or its industry experienced breaches?",
  },
  {
    key: "businessCriticality",
    label: "Business criticality",
    help: "Would a vendor outage significantly disrupt operations?",
  },
];

const emptyTiering = {
  dataSensitivity: 1,
  integrationDepth: 1,
  accessPrivileges: 1,
  historicalIncidents: 1,
  businessCriticality: 1,
};

function computeIndex(tiering) {
  return (
    tiering.dataSensitivity *
    tiering.integrationDepth *
    tiering.accessPrivileges *
    tiering.historicalIncidents *
    tiering.businessCriticality
  );
}

function tierFromIndex(index) {
  if (index >= 400) return "High";
  if (index >= 120) return "Medium";
  return "Low";
}

export default function TieringView({
  vendors,
  updateVendor,
  setActiveView,
}) {
  if (!vendors || vendors.length === 0) {
    return <div>No vendors available</div>;
  }

  return (
    <div className="card">
      <h2>Vendor Tiering</h2>

      <p style={{ opacity: 0.8 }}>
        Rate each vendor from <strong>1 (low)</strong> to{" "}
        <strong>5 (high)</strong> across the filtering criteria.
        The prioritization index is the <strong>product</strong> of all scores.
      </p>

      <table style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th align="left">Vendor</th>
            {CRITERIA.map((c) => (
              <th key={c.key} align="center">{c.label}</th>
            ))}
            <th align="center">Index</th>
            <th align="center">Tier</th>
            <th align="center">Carry forward</th>
          </tr>
        </thead>

        <tbody>
          {vendors.map((vendor) => {
            const tiering = vendor.tiering || emptyTiering;
            const index = computeIndex(tiering);
            const tier = tierFromIndex(index);

            return (
              <tr key={vendor.id}>
                <td>
                  <strong>{vendor.name || "(Unnamed vendor)"}</strong>
                </td>

                {CRITERIA.map((c) => (
                  <td key={c.key} align="center">
                    <select
                      value={tiering[c.key]}
                      onChange={(e) =>
                        updateVendor(vendor.id, {
                          tiering: {
                            ...tiering,
                            [c.key]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </td>
                ))}

                <td align="center">
                  <strong>{index}</strong>
                </td>

                <td align="center">
                  <span className={`pill ${tier.toLowerCase()}`}>
                    {tier}
                  </span>
                </td>

                <td align="center">
                  <input
                    type="checkbox"
                    checked={!!vendor.carryForward}
                    onChange={(e) =>
                      updateVendor(vendor.id, {
                        carryForward: e.target.checked,
                        tier,
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
        <button onClick={() => setActiveView("Scenarios")}>
          Back to scenarios
        </button>

        <button onClick={() => setActiveView("Quantify")}>
          Go to quantification
        </button>
      </div>
    </div>
  );
}
