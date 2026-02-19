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

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function DonutBreakdown({ title, subtitle = "", segments, centerLabel = "" }) {
  const clean = Array.isArray(segments) ? segments.filter((s) => Number.isFinite(s?.value) && s.value > 0) : [];
  const total = clean.reduce((sum, s) => sum + s.value, 0);
  const size = 120;
  const cx = 60;
  const cy = 60;
  const r = 46;

  let angle = 0;
  const arcs = clean.map((s) => {
    const delta = (s.value / Math.max(1e-9, total)) * 360;
    const start = angle;
    const end = angle + delta;
    angle = end;
    return {
      ...s,
      d: arcPath(cx, cy, r, start, end),
    };
  });

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

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: "block" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="14" />
            {arcs.map((a) => (
              <path
                key={a.key || a.label}
                d={a.d}
                fill="none"
                stroke={a.color || "rgba(128,46,255,0.9)"}
                strokeWidth="14"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {centerLabel || total.toLocaleString()}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {clean.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.72 }}>No data.</div>
          ) : (
            clean.map((s) => (
              <div key={s.key || s.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color || "rgba(128,46,255,0.9)" }} />
                  <span style={{ fontWeight: 800 }}>{s.label}</span>
                </span>
                <span style={{ opacity: 0.84 }}>{s.value.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function RadarProfile({
  title,
  subtitle = "",
  dimensions,
  maxValue = 5,
  width = 280,
  height = 240,
  stroke = "rgba(236,120,51,0.95)",
  fill = "rgba(236,120,51,0.18)",
}) {
  const dims = Array.isArray(dimensions) ? dimensions.filter((d) => Number.isFinite(d?.value)) : [];
  const cx = width / 2;
  const cy = height / 2 - 6;
  const radius = Math.min(width, height) * 0.32;
  const rings = 5;

  const pointsFor = (r) => {
    return dims.map((d, i) => {
      const angle = (i / Math.max(1, dims.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  };

  const valuePts = dims.map((d, i) => {
    const angle = (i / Math.max(1, dims.length)) * Math.PI * 2 - Math.PI / 2;
    const rr = (clamp(d.value, 0, maxValue) / Math.max(1e-9, maxValue)) * radius;
    return {
      x: cx + Math.cos(angle) * rr,
      y: cy + Math.sin(angle) * rr,
      labelX: cx + Math.cos(angle) * (radius + 22),
      labelY: cy + Math.sin(angle) * (radius + 22),
      label: d.label,
    };
  });

  const polygonPath = valuePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";

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

      {dims.length < 3 ? (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.72 }}>Not enough dimensions for radar.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", marginTop: 6 }}>
          {Array.from({ length: rings }).map((_, i) => {
            const rr = ((i + 1) / rings) * radius;
            const pts = pointsFor(rr);
            const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
            return <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.10)" />;
          })}

          {pointsFor(radius).map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.10)" />
          ))}

          <path d={polygonPath} fill={fill} stroke={stroke} strokeWidth="2" />

          {valuePts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3.5" fill={stroke} />
              <text x={p.labelX} y={p.labelY} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.78">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export function FlowChain({ title, subtitle = "", nodes }) {
  const clean = Array.isArray(nodes) ? nodes : [];
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

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, clean.length * 2 - 1)}, minmax(0,1fr))`, gap: 8, alignItems: "center" }}>
        {clean.map((n, i) => (
          <div
            key={n.key || i}
            style={{
              gridColumn: `${i * 2 + 1} / span 1`,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: 8,
              background: "rgba(255,255,255,0.03)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.75 }}>{n.label}</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900 }}>{n.value}</div>
          </div>
        ))}
        {clean.map((n, i) =>
          i < clean.length - 1 ? (
            <div key={`arrow_${i}`} style={{ gridColumn: `${i * 2 + 2} / span 1`, textAlign: "center", opacity: 0.55, fontWeight: 900 }}>
              {"->"}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

export function HeatDotMatrix({ title, subtitle = "", rows, steps = 5 }) {
  const clean = Array.isArray(rows) ? rows : [];
  const norm = (v) => clamp(v, 0, 100);

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
          clean.map((r) => {
            const score = norm(r.value);
            const active = Math.round((score / 100) * steps);
            return (
              <div key={r.key || r.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{r.label}</div>
                <div style={{ display: "inline-flex", gap: 6 }}>
                  {Array.from({ length: steps }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: i < active ? "rgba(128,46,255,0.9)" : "rgba(255,255,255,0.12)",
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 12, opacity: 0.82 }}>{Math.round(score)}%</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function QuantileStrip({ title, subtitle = "", p10, p50, p90 }) {
  const vals = [toFinite(p10), toFinite(p50), toFinite(p90)].filter((v) => v !== null);
  if (vals.length < 2) {
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
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Not enough quantiles yet.</div>
      </div>
    );
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const map = (v) => (toFinite(v) === null ? 0 : ((v - min) / Math.max(1e-9, max - min)) * 100);

  const pts = [
    { label: "P10", v: p10, x: map(p10), color: "rgba(59,130,246,0.92)" },
    { label: "P50", v: p50, x: map(p50), color: "rgba(236,120,51,0.92)" },
    { label: "P90", v: p90, x: map(p90), color: "rgba(128,46,255,0.92)" },
  ].filter((p) => toFinite(p.v) !== null);

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

      <div style={{ marginTop: 12, position: "relative", height: 42 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 20, height: 2, background: "rgba(255,255,255,0.14)" }} />
        {pts.map((p) => (
          <div key={p.label} style={{ position: "absolute", left: `calc(${p.x}% - 8px)`, top: 0, textAlign: "center" }}>
            <div style={{ fontSize: 10, opacity: 0.76 }}>{p.label}</div>
            <div style={{ width: 10, height: 10, borderRadius: 999, margin: "6px auto 0", background: p.color }} />
          </div>
        ))}
      </div>
    </div>
  );
}
