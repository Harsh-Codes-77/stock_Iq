// components/report/ValuationTab.js
// Redesigned with custom table grids, horizontal dividers, and null-safe value formatting.

import dynamic from 'next/dynamic';
const SensitivityMatrix = dynamic(() => import('../charts/SensitivityMatrix'), { ssr: false });

export default function ValuationTab({ data }) {
  const dcf = data.computedScores?.dcf || {};
  const wacc = data.computedScores?.wacc || {};
  const sensitivity = data.computedScores?.sensitivity || {};
  const metrics = data.currentMetrics || {};
  const ai = data.aiAnalysis?.valuationAnalysis || {};
  const cmp = data.price || null;

  const waccItems = [
    { label: 'WACC', value: wacc.wacc !== null && wacc.wacc !== undefined ? `${(wacc.wacc * 100).toFixed(1)}%` : '—' },
    { label: 'Cost of Equity', value: wacc.costOfEquity !== null && wacc.costOfEquity !== undefined ? `${(wacc.costOfEquity * 100).toFixed(1)}%` : '—' },
    { label: 'Cost of Debt', value: wacc.costOfDebt !== null && wacc.costOfDebt !== undefined ? `${(wacc.costOfDebt * 100).toFixed(1)}%` : '—' },
    { label: 'Beta', value: wacc.beta !== null && wacc.beta !== undefined ? wacc.beta.toFixed(2) : '—' },
    { label: 'Debt Ratio', value: wacc.debtRatio !== null && wacc.debtRatio !== undefined ? `${(wacc.debtRatio * 100).toFixed(1)}%` : '—' },
    { label: 'Equity Ratio', value: wacc.equityRatio !== null && wacc.equityRatio !== undefined ? `${(wacc.equityRatio * 100).toFixed(1)}%` : '—' },
  ];

  const multiples = [
    { label: 'P/E Ratio', value: metrics.peRatio, s: 'x' },
    { label: 'P/B Ratio', value: metrics.pbRatio, s: 'x' },
    { label: 'EV/EBITDA', value: metrics.evEbitda, s: 'x' },
    { label: 'Div Yield', value: metrics.dividendYield, s: '%' },
    { label: 'ROE', value: metrics.roe, s: '%' },
    { label: 'ROCE', value: metrics.roce, s: '%' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* DCF Table */}
      <div>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-1)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          letterSpacing: '0.05em'
        }}>
          Discounted Cash Flow (DCF) Valuation
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal', fontSize: '10px' }}>SCENARIO</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal', fontSize: '10px' }}>INTRINSIC VALUE</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal', fontSize: '10px' }}>ESTIMATED UPSIDE</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'bear', label: 'Bear Case Scenario', color: 'var(--accent-red)' },
              { id: 'base', label: 'Base Case Scenario', color: 'var(--accent-yellow)' },
              { id: 'bull', label: 'Bull Case Scenario', color: 'var(--accent-green)' },
            ].map(sc => {
              const val = dcf[sc.id]?.intrinsicValue;
              const upside = dcf[sc.id]?.upside;
              return (
                <tr key={sc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-0)', fontWeight: 500 }}>{sc.label}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--text-0)', fontWeight: 600 }}>
                    {val ? `₹${Number(val).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: sc.color, fontWeight: 600 }}>
                    {upside !== null && upside !== undefined ? (parseFloat(upside) >= 0 ? `+${upside}%` : `${upside}%`) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* WACC Assumptions */}
      <div>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-1)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          letterSpacing: '0.05em'
        }}>
          Weighted Average Cost of Capital (WACC) Assumptions
        </h3>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)'
        }}>
          {waccItems.map((m, i) => (
            <div key={m.label} style={{ flex: '1 1 120px', minWidth: '100px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity Matrix */}
      {sensitivity.matrix?.length > 0 && (
        <div>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-1)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Valuation Sensitivity Matrix (WACC vs Growth Rate)
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            overflowX: 'auto'
          }}>
            <SensitivityMatrix data={sensitivity} currentPrice={cmp} />
          </div>
        </div>
      )}

      {/* Current Multiples */}
      <div>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-1)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          letterSpacing: '0.05em'
        }}>
          Current Trading Multiples & Ratios
        </h3>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)'
        }}>
          {multiples.map(m => (
            <div key={m.label} style={{ flex: '1 1 120px', minWidth: '100px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>
                {m.value !== null && m.value !== undefined ? `${m.value}${m.s}` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Commentary */}
      {ai.dcfInterpretation && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '20px'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
            AI Valuation Commentary
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
            {ai.dcfInterpretation}
          </p>
          {ai.marginOfSafety && (
            <p style={{
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--text-1)',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginBottom: 0
            }}>
              {ai.marginOfSafety}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
