// components/report/ValuationTab.js
// Redesigned with custom table grids, horizontal dividers, null-safe value formatting, Reverse DCF, and EPV metrics.

import dynamic from 'next/dynamic';
const SensitivityMatrix = dynamic(() => import('../charts/SensitivityMatrix'), { ssr: false });

export default function ValuationTab({ data }) {
  const dcf = data.computedScores?.dcf || {};
  const wacc = data.computedScores?.wacc || {};
  const sensitivity = data.computedScores?.sensitivity || {};
  const metrics = data.currentMetrics || {};
  const ai = data.aiAnalysis?.valuationAnalysis || {};
  const cmp = data.price || null;

  // Valuation Engine rich outputs
  const valuation = data.valuation || {};
  const reverseDcf = valuation.reverse_dcf || {};
  const epv = valuation.earnings_power_value || {};

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

  const formatGrowthRate = (val) => {
    if (val === null || val === undefined) return '—';
    // If it's a decimal like 0.125, convert to percentage
    if (Math.abs(val) < 1.0 && val !== 0) {
      return `${(val * 100).toFixed(2)}%`;
    }
    return `${val.toFixed(2)}%`;
  };

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

      {/* Reverse DCF & Earnings Power Value (EPV) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {/* Reverse DCF Panel */}
        <div style={{
          flex: '1 1 300px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
            REVERSE DCF ANALYSIS
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Implied FCF Growth Rate (Priced-in by Market)</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-yellow)', margin: '8px 0' }}>
            {formatGrowthRate(reverseDcf.implied_growth_rate)}
          </div>
          {reverseDcf.interpretation && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-1)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.4,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '8px',
              marginTop: '8px'
            }}>
              {reverseDcf.interpretation}
            </div>
          )}
        </div>

        {/* EPV Panel */}
        <div style={{
          flex: '1 1 300px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
            EARNINGS POWER VALUE (EPV)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>No-Growth Value per Share</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-0)', margin: '8px 0' }}>
            {epv.epv ? `₹${Number(epv.epv).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', gap: '6px', alignItems: 'center' }}>
            Upside/Downside to CMP: 
            <span style={{
              fontWeight: 600,
              color: (epv.upside_pct || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
              {epv.upside_pct !== null && epv.upside_pct !== undefined ? `${(epv.upside_pct).toFixed(1)}%` : '—'}
            </span>
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.4,
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '8px',
            marginTop: '8px'
          }}>
            EPV isolates current earnings power assuming zero future growth, comparing it against the market price to check for a margin of safety.
          </div>
        </div>
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
