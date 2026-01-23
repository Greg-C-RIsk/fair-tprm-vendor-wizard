"use client";

export default function DecisionsView({ vendor, scenario }) {
  return (
    <div className="card card-pad">
      <h2>Decisions</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {vendor ? `Vendor: ${vendor.name || "(Unnamed)"}` : "Select a vendor first."}
      </div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {scenario ? `Scenario: ${scenario.title || "(Untitled)"}` : "Select a scenario first."}
      </div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Placeholder stable — decision workflow will go here.
      </div>
    </div>
  );
}
