"use client";

import { useState } from "react";

import VendorsView from "./components/VendorsView";
import TieringView from "./components/TieringView";
import ScenariosView from "./components/ScenariosView";
import QuantifyView from "./components/QuantifyView";
import TreatmentsView from "./components/TreatmentsView";
import DecisionsView from "./components/DecisionsView";
import DashboardView from "./components/DashboardView";

export default function Page() {
  const [activeView, setActiveView] = useState("Vendors");

  return (
    <div className="container">
      <h1 className="h-title">FAIR TPRM Training Tool</h1>

      {/* Navigation */}
      <div className="tabs">
        {["Vendors","Tiering","Scenarios","Quantify","Treatments","Decisions","Dashboard"].map(v => (
          <button
            key={v}
            className={`tab ${activeView === v ? "active" : ""}`}
            onClick={() => setActiveView(v)}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Views */}
      {activeView === "Vendors" && <VendorsView />}
      {activeView === "Tiering" && <TieringView />}
      {activeView === "Scenarios" && <ScenariosView />}
      {activeView === "Quantify" && <QuantifyView />}
      {activeView === "Treatments" && <TreatmentsView />}
      {activeView === "Decisions" && <DecisionsView />}
      {activeView === "Dashboard" && <DashboardView />}
    </div>
  );
}
