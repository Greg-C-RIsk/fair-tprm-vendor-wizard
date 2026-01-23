"use client";

export default function TieringView({ vendor }) {
  return (
    <div className="card card-pad">
      <h2>Tiering</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {vendor ? `Selected vendor: ${vendor.name || "(Unnamed)"}` : "Select a vendor first."}
      </div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Placeholder stable — we plug the tiering matrix here next.
      </div>
    </div>
  );
}
