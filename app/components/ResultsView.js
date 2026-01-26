"use client";

import { useMemo, useRef, useState } from "react";
import { ensureQuant, runFairMonteCarlo } from "../lib/fairEngine";

// ------------------ Helpers ------------------

const money = (n) => {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

const pct = (x) => {
  if (!Number.isFinite(x)) return "–";
  return `${(x * 100).toFixed(1)}%`;
};

const mean = (arr) => {
  if (!arr?.length) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
};

const quantile = (arr, q) => {
  if (!arr?.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (a[base + 1] === undefined) return a[base];
  return a[base] + rest * (a[base + 1] - a[base]);
};

// CVaR (Expected Shortfall) = moyenne des pires X%
const cvar = (arr, q = 0.9) => {
  if (!arr?.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const start = Math.floor((a.length - 1) * q);
  const tail = a.slice(start);
  return mean(tail);
};

const exceedProb = (arr, x) => {
  if (!arr?.length) return 0;
  let c = 0;
  for (const v of arr) if (v > x) c++;
  return c / arr.length;
};

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

// ------------------ Interactive Histogram (tooltip) ------------------

function Histogram({ title, values }) {
  const [hover, setHover] = useState(null);
  if (!values?.length) return null;

  const bins = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);

  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    counts[idx]++;
  });

  const peak = Math.max(...counts);
  const total = values.length;

  const binRange = (i) => {
    const a = min + (i / bins) * span;
    const b = min + ((i + 1) / bins) * span;
    return { a, b };
  };

  return (
    <Card style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{title}</strong>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Survoler une barre pour voir la probabilité estimée.
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 12 }}>
        {hover ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              maxWidth: 260,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Bin</div>
            <div>
              Range: <span style={{ fontWeight: 800 }}>{money(hover.a)}</span> →{" "}
              <span style={{ fontWeight: 800 }}>{money(hover.b)}</span>
            </div>
            <div>
              Fréquence: <span style={{ fontWeight: 800 }}>{hover.count}</span> / {total} (
              <span style={{ fontWeight: 800 }}>{pct(hover.count / total)}</span>)
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            height: 140,
          }}
        >
          {counts.map((c, i) => {
            const h = peak ? (c / peak) * 100 : 0;
            const r = binRange(i);
            return (
              <div
                key={i}
                onMouseEnter={() => setHover({ ...r, count: c })}
                onMouseLeave={() => setHover(null)}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: "currentColor",
                  opacity: 0.78,
                  borderRadius: 4,
                  cursor: "default",
                }}
                title={`${money(r.a)} → ${money(r.b)} | ${c}/${total}`}
              />
            );
          })}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Axe X = perte annuelle (€). Axe Y = fréquence relative (probabilité estimée).
        </div>
      </div>
    </Card>
  );
}

// ------------------ Interactive Exceedance Curve (tooltip) ------------------

function ExceedanceCurve({ values }) {
  const [hover, setHover] = useState(null);
  if (!values?.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // points réduits pour un SVG plus léger
  const points = 220;
  const pts = Array.from({ length: points }, (_, i) => {
    const idx = Math.min(n - 1, Math.floor((i / (points - 1)) * (n - 1)));
    const x = sorted[idx];
    const exceed = 1 - idx / (n - 1);
    return { x, exceed };
  });

  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 26;
  const W = 560;
  const H = 190;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const mapX = (x) => padL + ((x - minX) / Math.max(1e-9, maxX - minX)) * innerW;
  const mapY = (y) => padT + (1 - y) * innerH; // y = exceed prob (1..0)

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x)} ${mapY(p.exceed)}`).join(" ");

  const onMove = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    // convertir mx -> x -> index
    const t = (mx - padL) / innerW;
    const clamped = Math.max(0, Math.min(1, t));
    const idx = Math.round(clamped * (pts.length - 1));
    const p = pts[idx];

    const rp = p.exceed > 0 ? 1 / p.exceed : Infinity; // "return period"
    setHover({
      x: p.x,
      exceed: p.exceed,
      returnPeriod: rp,
      sx: mapX(p.x),
      sy: mapY(p.exceed),
    });
  };

  return (
    <Card style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>Loss Exceedance Curve</strong>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Survoler la courbe → probabilité exacte + “return period”.
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 10 }}>
        {hover ? (
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 0,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              maxWidth: 300,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Point sur la courbe</div>
            <div>
              Seuil x: <span style={{ fontWeight: 800 }}>{money(hover.x)}</span>
            </div>
            <div>
              P(Perte annuelle &gt; x): <span style={{ fontWeight: 800 }}>{pct(hover.exceed)}</span>
            </div>
            <div style={{ opacity: 0.85 }}>
              Return period ≈{" "}
              <span style={{ fontWeight: 800 }}>
                {Number.isFinite(hover.returnPeriod) ? `${hover.returnPeriod.toFixed(1)} ans` : "—"}
              </span>{" "}
              (approx.)
            </div>
          </div>
        ) : null}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* axes */}
          <path d={`M${padL} ${padT} L${padL} ${H - padB} L${W - padR} ${H - padB}`} stroke="currentColor" opacity="0.25" fill="none" />

          {/* curve */}
          <path d={d} stroke="currentColor" strokeWidth="2.2" fill="none" />

          {/* hover point */}
          {hover ? (
            <>
              <line x1={hover.sx} y1={padT} x2={hover.sx} y2={H - padB} stroke="currentColor" opacity="0.2" />
              <line x1={padL} y1={hover.sy} x2={W - padR} y2={hover.sy} stroke="currentColor" opacity="0.2" />
              <circle cx={hover.sx} cy={hover.sy} r="4.5" fill="currentColor" />
            </>
          ) : null}
        </svg>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Axe X = seuil de perte annuelle (€). Axe Y = probabilité que la perte annuelle dépasse ce seuil.
        </div>
      </div>
    </Card>
  );
}

// ------------------ Main ------------------

export default function ResultsView({ vendor, scenario, updateVendor, setActiveView }) {
  if (!vendor || !scenario) {
    return <Card>No scenario selected.</Card>;
  }

  const q = ensureQuant(scenario.quant || {});
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const cancelRef = useRef(false);

  const runSimulation = async () => {
    setRunning(true);
    cancelRef.current = false;

    try {
      const out = await runFairMonteCarlo(q, {
        sims: q.sims || 10000,
        curvePoints: 80,
        chunkSize: 600,
        yield: true,
        shouldCancel: () => cancelRef.current,
      });

      // Optionnel: persister dans quant pour réutiliser sur Dashboard
      const nextScenarios = (vendor.scenarios || []).map((s) =>
        s.id === scenario.id ? { ...s, quant: { ...q, ...out } } : s
      );
      updateVendor(vendor.id, { scenarios: nextScenarios });

      setResults(out);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert(
        e?.missing?.length
          ? `Champs manquants:\n- ${e.missing.join("\n- ")}`
          : `Erreur: ${e?.message || "unknown"}`
      );
    } finally {
      setRunning(false);
    }
  };

  const derived = useMemo(() => {
    if (!results?.aleSamples?.length) return null;

    const ale = results.aleSamples;
    const pel = results.pelSamples || [];

    const aal = mean(ale); // Average Annual Loss (moyenne)
    const pZero = exceedProb(ale, 0) ? 1 - exceedProb(ale, 0) : 0; // P(<=0) approx
    const pLoss = exceedProb(ale, 0); // P(>0)

    const var90 = quantile(ale, 0.9);
    const var95 = quantile(ale, 0.95);
    const cvar90 = cvar(ale, 0.9);
    const cvar95 = cvar(ale, 0.95);

    // Seuils pédagogiques (tu peux en changer)
    const pGT1M = exceedProb(ale, 1_000_000);
    const pGT10M = exceedProb(ale, 10_000_000);

    return {
      aal,
      pZero,
      pLoss,
      var90,
      var95,
      cvar90,
      cvar95,
      pGT1M,
      pGT10M,
      pelML: pel.length ? quantile(pel, 0.5) : 0,
    };
  }, [results]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>FAIR Results</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82 }}>
              Cette page montre la <strong>distribution</strong> des pertes annuelles simulées (Monte Carlo) à partir de tes entrées FAIR.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setActiveView?.("Quantify")}>
              Back
            </button>
            <button className="btn" onClick={() => (cancelRef.current = true)} disabled={!running}>
              Cancel
            </button>
            <button className="btn primary" disabled={running} onClick={runSimulation}>
              {running ? "Running…" : "Run Monte Carlo"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
          <div>
            💡 <strong>Important</strong> : il est normal d’avoir souvent <strong>ALE = 0€</strong> sur une partie des simulations si la fréquence (LEF) est faible.
            Monte Carlo simule des années où il ne se passe “rien”, donc <em>perte annuelle = 0</em> ces années-là.
          </div>
        </div>
      </Card>

      {results?.stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Résumé — ALE (Annualized Loss Exposure)</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              L’ALE est la <strong>perte annuelle</strong> (en €) : on simule une année entière, avec un nombre d’évènements (Poisson) et une perte par évènement.
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 13 }}>
              <div>p10 (optimiste): <strong>{money(results.stats.ale.p10)}</strong></div>
              <div>p50 (médiane): <strong>{money(results.stats.ale.ml)}</strong></div>
              <div>p90 (pire 10%): <strong>{money(results.stats.ale.p90)}</strong></div>
              <div>~min (p01): <strong>{money(results.stats.ale.min)}</strong></div>
              <div>~max (p99): <strong>{money(results.stats.ale.max)}</strong></div>
            </div>

            {derived ? (
              <>
                <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>Lecture pédagogique</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                    • <strong>Moyenne (AAL)</strong> : {money(derived.aal)} → “ce qu’on s’attend à perdre en moyenne par an”.<br />
                    • <strong>P(perte &gt; 0€)</strong> : {pct(derived.pLoss)} → probabilité qu’au moins un évènement arrive dans l’année.<br />
                    • <strong>VaR 95%</strong> : {money(derived.var95)} → un seuil dépassé seulement dans ~5% des années (selon le modèle).<br />
                    • <strong>CVaR 95%</strong> : {money(derived.cvar95)} → moyenne des pertes dans les 5% des pires années.
                  </div>
                </div>
              </>
            ) : null}
          </Card>

          <Card>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Résumé — Per-event loss (PEL)</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              La PEL est la <strong>perte par évènement</strong> : <em>Primary Loss + (Secondary LEF × Secondary LM)</em>.
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 13 }}>
              <div>p10: <strong>{money(results.stats.pel.p10)}</strong></div>
              <div>p50 (médiane): <strong>{money(results.stats.pel.ml)}</strong></div>
              <div>p90: <strong>{money(results.stats.pel.p90)}</strong></div>
              <div>~min (p01): <strong>{money(results.stats.pel.min)}</strong></div>
              <div>~max (p99): <strong>{money(results.stats.pel.max)}</strong></div>
            </div>

            {derived ? (
              <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>Exemples de lecture</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                  • “Une perte typique par évènement” ≈ médiane = <strong>{money(derived.pelML)}</strong>.<br />
                  • Si la fréquence augmente, l’ALE augmente même si la PEL reste identique.
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      ) : (
        <Card>
          <div style={{ opacity: 0.85 }}>
            Clique sur <strong>Run Monte Carlo</strong> pour générer les résultats.
          </div>
        </Card>
      )}

      {results?.aleSamples?.length ? (
        <>
          <Histogram title="Annual Loss Distribution (ALE)" values={results.aleSamples} />
          <ExceedanceCurve values={results.aleSamples} />

          {derived ? (
            <Card>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Quelques questions “pédagogiques”</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                • “Quelle est la probabilité de dépasser 1M€ de perte annuelle ?” → <strong>{pct(derived.pGT1M)}</strong><br />
                • “Quelle est la probabilité de dépasser 10M€ ?” → <strong>{pct(derived.pGT10M)}</strong><br />
                • “Pourquoi beaucoup de 0€ ?” → si LEF est faible, beaucoup d’années simulées ont 0 évènement, donc 0€.
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
