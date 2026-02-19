"use client";

function toFinite(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

export function clamp(n, lo, hi) {
  const x = toFinite(n);
  if (x === null) return lo;
  return Math.max(lo, Math.min(hi, x));
}

export function moneyEUR(n) {
  const x = toFinite(n);
  if (x === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(x);
}

export function compactMoneyEUR(n) {
  const x = toFinite(n);
  if (x === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(x);
}

export function compactNumber(n) {
  const x = toFinite(n);
  if (x === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(x);
}

export function pct(n, digits = 0, signed = false) {
  const x = toFinite(n);
  if (x === null) return "—";
  const prefix = signed && x > 0 ? "+" : "";
  return `${prefix}${x.toFixed(digits)}%`;
}

export function MiniSparkline({
  values,
  width = 260,
  height = 62,
  stroke = "rgba(128,46,255,0.95)",
  fill = "rgba(128,46,255,0.16)",
}) {
  const clean = Array.isArray(values) ? values.filter((v) => Number.isFinite(v)) : [];
  if (clean.length < 2) {
    return <div style={{ fontSize: 12, opacity: 0.72 }}>No distribution preview yet.</div>;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = Math.max(1e-9, max - min);

  const pts = clean.map((v, i) => {
    const t = i / Math.max(1, clean.length - 1);
    const x = t * width;
    const y = height - ((v - min) / span) * height;
    return { x, y };
  });

  const dLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const dArea = `${dLine} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <path d={dArea} fill={fill} />
      <path d={dLine} fill="none" stroke={stroke} strokeWidth="2.2" />
    </svg>
  );
}

export function HorizontalBarList({
  title,
  subtitle = "",
  items,
  tone = "rgba(128,46,255,0.9)",
  valueFormatter = compactNumber,
}) {
  const clean = Array.isArray(items) ? items.filter((i) => Number.isFinite(i?.value)) : [];
  const max = clean.length ? Math.max(...clean.map((i) => i.value)) : 1;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.76 }}>{subtitle}</div> : null}

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {clean.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.72 }}>No data.</div>
        ) : (
          clean.map((item) => {
            const widthPct = (item.value / Math.max(1e-9, max)) * 100;
            return (
              <div key={item.key || item.label} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ fontWeight: 800 }}>{item.label}</span>
                  <span style={{ opacity: 0.84 }}>{valueFormatter(item.value)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${widthPct}%`, height: "100%", background: tone, borderRadius: 999 }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function StackedShareBar({ title, subtitle = "", segments }) {
  const clean = Array.isArray(segments) ? segments.filter((s) => Number.isFinite(s?.value) && s.value > 0) : [];
  const total = clean.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.76 }}>{subtitle}</div> : null}

      <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", display: "flex" }}>
        {clean.map((s) => (
          <div
            key={s.key || s.label}
            style={{
              width: `${((s.value / Math.max(1e-9, total)) * 100).toFixed(2)}%`,
              background: s.color || "rgba(128,46,255,0.88)",
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {clean.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.72 }}>No data.</div>
        ) : (
          clean.map((s) => (
            <div key={s.key || s.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color || "rgba(128,46,255,0.88)" }} />
                <span style={{ fontWeight: 800 }}>{s.label}</span>
              </span>
              <span style={{ opacity: 0.84 }}>{s.value.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ScoreGauge({
  title,
  subtitle = "",
  score = 0,
  max = 100,
  color = "linear-gradient(90deg,#EC7833,#802eff)",
}) {
  const safeMax = Math.max(1, toFinite(max) || 1);
  const safeScore = clamp(score, 0, safeMax);
  const pctValue = (safeScore / safeMax) * 100;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.76 }}>{subtitle}</div> : null}
      <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div
          style={{
            width: `${pctValue}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900 }}>{safeScore.toFixed(0)} / {safeMax.toFixed(0)}</div>
    </div>
  );
}

export function BaselineResidualCompare({
  title,
  baselineLabel = "Baseline",
  residualLabel = "Residual",
  baselineValue,
  residualValue,
  format = moneyEUR,
  lowerIsBetter = true,
}) {
  const b = toFinite(baselineValue);
  const r = toFinite(residualValue);
  const max = Math.max(1, b || 0, r || 0);
  const deltaAbs = b !== null && r !== null ? r - b : null;
  const deltaPct = b !== null && r !== null && b !== 0 ? (deltaAbs / b) * 100 : null;
  const improving = deltaPct !== null ? (lowerIsBetter ? deltaPct < 0 : deltaPct > 0) : null;

  const tone = improving === null ? "rgba(255,255,255,0.22)" : improving ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)";

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {[{ label: baselineLabel, value: b }, { label: residualLabel, value: r }].map((row) => (
          <div key={row.label} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
              <span style={{ fontWeight: 800 }}>{row.label}</span>
              <span style={{ opacity: 0.86 }}>{format(row.value)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${((row.value || 0) / Math.max(1e-9, max)) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: row.label === baselineLabel ? "rgba(236,120,51,0.88)" : "rgba(128,46,255,0.88)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 12,
          border: `1px solid ${tone}`,
          borderRadius: 10,
          padding: "8px 10px",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        Delta: {format(deltaAbs)} ({pct(deltaPct, 1, true)})
      </div>
    </div>
  );
}

export function DecisionNarrative({ title = "Decision guidance", message, tone = "neutral" }) {
  const toneMap = {
    neutral: { border: "rgba(255,255,255,0.16)", bg: "rgba(255,255,255,0.03)" },
    good: { border: "rgba(34,197,94,0.42)", bg: "rgba(34,197,94,0.10)" },
    warn: { border: "rgba(245,158,11,0.42)", bg: "rgba(245,158,11,0.10)" },
    bad: { border: "rgba(239,68,68,0.42)", bg: "rgba(239,68,68,0.10)" },
    info: { border: "rgba(59,130,246,0.42)", bg: "rgba(59,130,246,0.10)" },
  };
  const style = toneMap[tone] || toneMap.neutral;

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        background: style.bg,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>{message}</div>
    </div>
  );
}
