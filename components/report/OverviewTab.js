// components/report/OverviewTab.js
// Re-architected with custom styled panels, unconstrained layout fonts, and strict null/NA safety.

function ScoreStrip({ scores }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '20px',
      padding: '16px',
      backgroundColor: 'var(--bg-1)',
      border: '1px solid var(--border-subtle)',
      marginBottom: '24px',
      justifyContent: 'space-between'
    }}>
      {scores.map((s, idx) => (
        <div key={idx} style={{ flex: '1 1 150px', minWidth: '130px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '6px'
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', letterSpacing: '0.05em' }}>
              {s.label.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-0)' }}>
              {s.value !== null && s.value !== undefined ? `${s.value}/${s.max}` : '—'}
            </span>
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--bg-2)',
            width: '100%',
            position: 'relative'
          }}>
            {s.value !== null && s.value !== undefined && (
              <div style={{
                height: '100%',
                width: `${(s.value / s.max) * 100}%`,
                backgroundColor: s.label.toLowerCase() === 'overall' ? 'var(--accent-yellow)' : 'var(--text-0)',
                transition: 'width 0.3s ease'
              }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const v = (verdict || 'HOLD').toUpperCase();
  let badgeStyle = {
    backgroundColor: 'rgba(232, 193, 63, 0.1)',
    color: 'var(--accent-yellow)',
    border: '1px solid rgba(232, 193, 63, 0.3)'
  };
  if (v === 'BUY' || v === 'STRONG_BUY') {
    badgeStyle = {
      backgroundColor: 'rgba(48, 164, 108, 0.1)',
      color: 'var(--accent-green)',
      border: '1px solid rgba(48, 164, 108, 0.3)'
    };
  } else if (v === 'SELL' || v === 'AVOID') {
    badgeStyle = {
      backgroundColor: 'rgba(229, 72, 77, 0.1)',
      color: 'var(--accent-red)',
      border: '1px solid rgba(229, 72, 77, 0.3)'
    };
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '24px',
      padding: '0 12px',
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.05em',
      ...badgeStyle
    }}>
      {v}
    </div>
  );
}

export default function OverviewTab({ data }) {
  const ai = data.aiAnalysis || {};
  const scores = ai.overallScore || {};
  const exec = ai.executiveSummary || {};
  const biz = ai.businessOverview || {};
  const dcf = data.computedScores?.dcf || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Score Strip */}
      <ScoreStrip scores={[
        { label: 'Business Quality', value: scores.businessQuality ?? null, max: 10 },
        { label: 'Financial Health', value: scores.financialHealth ?? null, max: 10 },
        { label: 'Valuation', value: scores.valuation ?? null, max: 10 },
        { label: 'Management', value: scores.management ?? null, max: 10 },
        { label: 'Overall Rating', value: scores.overall ?? null, max: 10 },
      ]} />

      {/* Main Thesis Card (Integrated styling, unconstrained text) */}
      <div style={{
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--border-subtle)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 'normal',
            lineHeight: 1.2,
            color: 'var(--text-0)',
          }}>
            Investment Thesis
          </h2>
          <VerdictBadge verdict={exec.verdict} />
        </div>

        <p style={{
          fontSize: '15px',
          lineHeight: 1.6,
          color: 'var(--text-0)',
          fontFamily: 'var(--font-sans)',
          margin: 0
        }}>
          {exec.investmentThesis || 'Analysis pending...'}
        </p>

        {/* Thesis Metrics Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
              12M Target Price
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, color: 'var(--accent-yellow)' }}>
              {exec.targetPrice12M ? `₹${Number(exec.targetPrice12M).toLocaleString('en-IN')}` : '—'}
            </div>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
              Confidence Level
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-0)', textTransform: 'uppercase' }}>
              {exec.confidenceLevel || '—'}
            </div>
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
              Key Driving Risk
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--text-1)' }}>
              {exec.keyRisk || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* One-Liner Summary */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '20px'
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
          Company Description
        </div>
        <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-0)', margin: 0 }}>
          {exec.oneLiner || data.about || '—'}
        </p>
      </div>

      {/* Business Model & Competitive Moat */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-1)',
          textTransform: 'uppercase',
          margin: 0,
          letterSpacing: '0.05em'
        }}>
          Business Operations & Strategic Analysis
        </h3>
        
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Business Model
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
            {biz.businessModel || '—'}
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase' }}>
              Competitive Moat Strength
            </span>
            {biz.moatStrength && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 600,
                color: biz.moatStrength === 'STRONG' ? 'var(--accent-green)' : biz.moatStrength === 'MODERATE' ? 'var(--accent-yellow)' : 'var(--accent-red)'
              }}>
                [{biz.moatStrength}]
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
            {biz.competitiveMoat || '—'}
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Capital Allocation Strategy
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
            {biz.capitalAllocationQuality || '—'}
          </p>
        </div>

        {/* Corporate Red Flags */}
        {biz.managementRedFlags?.length > 0 && (
          <div style={{
            borderLeft: '2px solid var(--accent-red)',
            paddingLeft: '16px',
            marginTop: '12px',
            backgroundColor: 'rgba(229, 72, 77, 0.03)',
            paddingTop: '10px',
            paddingBottom: '10px'
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--accent-red)',
              textTransform: 'uppercase',
              marginBottom: '6px',
              letterSpacing: '0.05em'
            }}>
              Corporate Governance & Management Red Flags
            </div>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {biz.managementRedFlags.map((flag, idx) => (
                <li key={idx} style={{
                  fontSize: '13px',
                  color: 'var(--text-1)',
                  lineHeight: 1.4,
                  marginBottom: '4px',
                  position: 'relative',
                  paddingLeft: '12px'
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent-red)' }}>▪</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* DCF Valuation Projections Table */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '20px'
      }}>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-1)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          letterSpacing: '0.05em'
        }}>
          Discounted Cash Flow (DCF) Projections
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
              { label: 'Bear Case Scenario', val: dcf.bear?.intrinsicValue, upside: dcf.bear?.upside, color: 'var(--accent-red)' },
              { label: 'Base Case Scenario', val: dcf.base?.intrinsicValue, upside: dcf.base?.upside, color: 'var(--accent-yellow)' },
              { label: 'Bull Case Scenario', val: dcf.bull?.intrinsicValue, upside: dcf.bull?.upside, color: 'var(--accent-green)' },
            ].map((sc, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-0)', fontWeight: 500 }}>{sc.label}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-0)', fontWeight: 600 }}>
                  {sc.val ? `₹${Number(sc.val).toLocaleString('en-IN')}` : '—'}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: sc.color, fontWeight: 600 }}>
                  {sc.upside !== null && sc.upside !== undefined ? (parseFloat(sc.upside) >= 0 ? `+${sc.upside}%` : `${sc.upside}%`) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent News */}
      {data.news?.length > 0 && (
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
            Corporate News & Intelligence Feed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.news.map((item, idx) => (
              <div key={idx} style={{
                paddingBottom: '10px',
                borderBottom: idx < data.news.length - 1 ? '1px solid var(--border-subtle)' : 'none'
              }}>
                <div style={{ fontSize: '13px', color: 'var(--text-0)', lineHeight: 1.4 }}>{item.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', marginTop: '4px' }}>
                  {item.source} · {item.publishedAt}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
