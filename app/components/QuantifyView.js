"use client";

export default function QuantifyView() {
  return (
    <div className="card card-pad">
      <h2>FAIR Quantification</h2>
      <p>
        Estimate TEF, Susceptibility and Loss using calibrated ranges
        and Monte Carlo simulation.
      </p>

      <button className="btn primary">Run Monte Carlo</button>
    </div>
  );
}
