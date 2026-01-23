"use client";

export default function TreatmentsView({ vendor, scenario }) {
  return (
    <div className="card card-pad">
      <h2>Treatments</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {vendor ? `Vendor: ${vendor.name || "(Unnamed)"}` : "Select a vendor first."}
      </div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {scenario ? `Scenario: ${scenario.title || "(Untitled)"}` : "Select a scenario first."}
      </div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Placeholder stable — treatments list/editor will go here.
      </div>
    </div>
  );
}
