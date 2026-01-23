"use client";

export default function QuantifyView({ vendor, scenario }) {
  return (
    <div className="card card-pad">
      <h2>Quantify</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {vendor ? `Vendor: ${vendor.name || "(Unnamed)"}` : "Select a vendor first."}
      </div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {scenario ? `Scenario: ${scenario.title || "(Untitled)"}` : "Select a scenario first."}
      </div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Placeholder stable — FAIR-only form will go here.
      </div>
    </div>
  );
}
