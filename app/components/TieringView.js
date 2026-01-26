"use client";

import { useEffect, useMemo, useState } from "react";
import { emptyTiering, tierIndex } from "../../lib/model";

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function factorLabel(key) {
  switch (key) {
    case "dataSensitivity":
      return "Data sensitivity";
    case "integrationDepth":
      return "Integration depth";
    case "accessPrivileges":
      return "Access privileges";
    case "historicalIncidents":
      return "Historical incidents";
    case "businessCriticality":
      return "Business criticality";
    default:
      return key;
  }
}

function factorHelp(key) {
  switch (key) {
    case "dataSensitivity":
      return "How sensitive is the data processed by the vendor?";
    case "integrationDepth":
      return "How deep is the technical / operational integration?";
    case "accessPrivileges":
      return "How much access does the vendor have to systems/data?";
    case "historicalIncidents":
      return "Past incidents / issues with the vendor (or similar vendors).";
    case "businessCriticality":
      return "How critical is the supported business function?";
    default:
      return "";
  }
}

function scoreMeaning(score) {
  // Simple pedagogy labels
  if (score <= 1) return "1 (Very low)";
  if (score === 2) return "2 (Low)";
  if (score === 3) return "3 (Medium)";
  if (score === 4) return "4 (High)";
  return "5 (Very high)";
}

function suggestTierFromIndex(idx) {
  // Index range: 1..3125 (5 factors, 1..5)
  // Training-friendly buckets (adjust later if you want)
  if (idx <= 50) return { tier: "Tier 3", label: "Low criticality / exposure" };
  if (idx <= 250) return { tier: "Tier 2", label: "Medium criticality / exposure" };
  return { tier: "Tier 1", label: "High criticality / exposure" };
}

function Card({ children, style }) {
  return (
    <div
      className="card"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />;
}

function TierBadge({ tier }) {
  // simple colors by tier
  const t = String(tier || "").trim();

  const styleByTier =
    t === "Tier 1"
      ? { background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)" } // red
      : t === "Tier 2"
      ? { background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)" } // amber
      : { background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)" }; // green (Tier 3 default)

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        ...styleByTier,
      }}
    >
      {t || "Tier —"}
    </span>
  );
}

function ScoreLegendTable() {
  const rows = [
    { s: 1, label: "Very low", example: "Minimal exposure / limited impact" },
    { s: 2, label: "Low", example: "Low exposure, small scope" },
    { s: 3, label: "Medium", example: "Moderate exposure or impact" },
    { s: 4, label: "High", example: "Significant exposure or impact" },
    { s: 5, label: "Very high", example: "Critical exposure, broad impact" },
  ];

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, marginBottom: 8 }}>
        Score → interpretation
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 140px 1fr",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          <div>Score</div>
          <div>Meaning</div>
          <div>Example</div>
        </div>

        {rows.map((r) => (
          <div
            key={r.s}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 140px 1fr",
              padding: "10px 12px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12,
              opacity: 0.92,
            }}
          >
            <div style={{ fontWeight: 900 }}>{r.s}</div>
            <div>{r.label}</div>
            <div style={{ opacity: 0.85 }}>{r.example}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactorRow({ k, value, onChange }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950 }}>{factorLabel(k)}</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{factorHelp(k)}</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 800 }}>{scoreMeaning(value)}</div>
      </div>

      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(clampInt(e.target.value, 1, 5))}
      />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.65 }}>
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
      </div>
    </div>
  );
}

export default function TieringView({ vendor, updateVendor }) {
  if (!vendor) {
    return (
      <Card>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Tiering</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Select a vendor first.</div>
      </Card>
    );
  }

  const baseTiering = useMemo(() => {
    return { ...emptyTiering(), ...(vendor.tiering || {}) };
  }, [vendor.tiering]);

  // Local copy (so typing doesn't instantly overwrite vendor)
  const [localTiering, setLocalTiering] = useState(baseTiering);
  const [tierOverride, setTierOverride] = useState(vendor.tier || "");
  const [rationale, setRationale] = useState(vendor.tierRationale || "");
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const t = { ...emptyTiering(), ...(vendor.tiering || {}) };
    setLocalTiering(t);
    setTierOverride(vendor.tier || "");
    setRationale(vendor.tierRationale || "");
    setIsDirty(false);
    setJustSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

  const idx = useMemo(() => tierIndex(localTiering), [localTiering]);
  const suggested = useMemo(() => suggestTierFromIndex(idx), [idx]);

  const effectiveTier = tierOverride?.trim() ? tierOverride.trim() : suggested.tier;

  const patchFactor = (k, v) => {
    setLocalTiering((prev) => ({ ...prev, [k]: clampInt(v, 1, 5) }));
    setIsDirty(true);
    setJustSaved(false);
  };

  const save = () => {
    if (!updateVendor) return;

    updateVendor(vendor.id, {
      tiering: localTiering,
      tier: effectiveTier,
      tierRationale: rationale,
    });

    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const cancel = () => {
    const t = { ...emptyTiering(), ...(vendor.tiering || {}) };
    setLocalTiering(t);
    setTierOverride(vendor.tier || "");
    setRationale(vendor.tierRationale || "");
    setIsDirty(false);
    setJustSaved(false);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>Tiering</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
              Score each factor from 1 (low) to 5 (high). We compute an index (multiplication) and propose a Tier.
            </div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              Selected vendor: <strong>{vendor.name?.trim() ? vendor.name : "(Unnamed vendor)"}</strong>
            </div>
          </div>

          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Tier (auto + override)</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
  <div style={{ fontSize: 13, opacity: 0.9 }}>
    Suggested: <strong>{suggested.tier}</strong> — {suggested.label}
  </div>
  <TierBadge tier={effectiveTier} />
</div>
              <select
                className="input"
                value={tierOverride}
                onChange={(e) => {
                  setTierOverride(e.target.value);
                  setIsDirty(true);
                  setJustSaved(false);
                }}
              >
                <option value="">Use suggested ({suggested.tier})</option>
                <option value="Tier 1">Tier 1 (High)</option>
                <option value="Tier 2">Tier 2 (Medium)</option>
                <option value="Tier 3">Tier 3 (Low)</option>
              </select>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Index: <strong>{idx.toLocaleString()}</strong> (range 1 → 3,125)
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Factors</div>
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <FactorRow
              k="dataSensitivity"
              value={localTiering.dataSensitivity}
              onChange={(v) => patchFactor("dataSensitivity", v)}
            />
            <FactorRow
              k="integrationDepth"
              value={localTiering.integrationDepth}
              onChange={(v) => patchFactor("integrationDepth", v)}
            />
            <FactorRow
              k="accessPrivileges"
              value={localTiering.accessPrivileges}
              onChange={(v) => patchFactor("accessPrivileges", v)}
            />
            <FactorRow
              k="historicalIncidents"
              value={localTiering.historicalIncidents}
              onChange={(v) => patchFactor("historicalIncidents", v)}
            />
            <FactorRow
              k="businessCriticality"
              value={localTiering.businessCriticality}
              onChange={(v) => patchFactor("businessCriticality", v)}
            />
          </div>

                <Divider />
<ScoreLegendTable />
        </Card>

        <Card>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Rationale (recommended)</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
            Write 2–5 lines explaining why this tier makes sense (good for auditability & training).
          </div>

          <textarea
            className="textarea"
            style={{ marginTop: 12 }}
            rows={10}
            value={rationale}
            onChange={(e) => {
              setRationale(e.target.value);
              setIsDirty(true);
              setJustSaved(false);
            }}
            placeholder="Example: Vendor processes customer PII, deep integration with SSO, admin access to core systems..."
          />

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn primary" onClick={save} disabled={!isDirty}>
              Save
            </button>
            <button className="btn" onClick={cancel} disabled={!isDirty}>
              Cancel
            </button>

            {justSaved ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Saved ✅</div>
            ) : isDirty ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Unsaved changes</div>
            ) : null}
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Training note</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              This is a simplified tiering approach (multiplicative index). In real programs, you may use a weighted model,
              thresholds, and governance rules. For training, the goal is to make tradeoffs explicit and consistent.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
