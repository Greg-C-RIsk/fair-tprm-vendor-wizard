"use client";

export default function DashboardView({ vendors }) {
  return (
    <div className="card card-pad">
      <h2>Dashboard</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Vendors in portfolio: {Array.isArray(vendors) ? vendors.length : 0}
      </div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Placeholder stable — portfolio summaries + heatmap will go here.
      </div>
    </div>
  );
}
