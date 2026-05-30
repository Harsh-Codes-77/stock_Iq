// components/report/ForensicsTab.js
// Forensics (Piotroski, Beneish, Altman) + Rules Engine Signals in minimal terminal style

import dynamic from 'next/dynamic';
const PatCfoChart = dynamic(() => import('../charts/PatCfoChart'), { ssr: false });

export default function ForensicsTab({ data }) {
  const p = data.quant_scores?.piotroski || data.computedScores?.piotroski || {};
  const b = data.quant_scores?.beneish || data.computedScores?.beneish || {};
  const a = data.quant_scores?.altman || data.computedScores?.altman || {};
  const ai = data.aiAnalysis || {};
  const fin = data.financials || {};
  const years = [...(fin.annualYears || [])].reverse();
  const pat = [...(fin.pat || [])].reverse();
  const cfo = [...(fin.cfo || [])].reverse();
  const signals = data.signals || [];

  const signalLabels = {
    roa: 'Positive ROA', cfoPositive: 'Positive CFO', roaImproving: 'ROA Improving',
    accruals: 'CFO > Net Income (Accrual Check)', leverageDecreasing: 'Leverage Decreasing',
    liquidityImproving: 'Liquidity Improving', noShareDilution: 'No Share Dilution',
    grossMarginImproving: 'Gross Margin Up', assetTurnoverImproving: 'Asset Turnover Up',
  };

  const bLabels = {
    DSRI: 'Days Sales Receivables Index', GMI: 'Gross Margin Index',
    AQI: 'Asset Quality Index', SGI: 'Sales Growth Index',
    DEPI: 'Depreciation Index', SGAI: 'SG&A Index',
    TATA: 'Total Accruals / Assets', LVGI: 'Leverage Index',
  };

  // Helper styles for score state colors
  const getPiotroskiColor = (score) => {
    if (score === null || score === undefined) return 'var(--text-1)';
    return score >= 7 ? 'var(--accent-green)' : score >= 4 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  };

  const getBeneishColor = (flag) => {
    if (!flag || flag === 'N/A') return 'var(--text-1)';
    return flag === 'CLEAN' ? 'var(--accent-green)' : 'var(--accent-red)';
  };

  const getAltmanColor = (zone) => {
    if (!zone || zone === 'N/A') return 'var(--text-1)';
    return zone === 'SAFE' ? 'var(--accent-green)' : zone === 'GREY' ? 'var(--accent-yellow)' : 'var(--accent-red)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Rules Engine Signals (at the top for instant forensic flags) */}
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
          Financial Intelligence Rules Engine Signals ({signals.length})
        </h3>
        <div style={{
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          overflowX: 'auto'
        }}>
          {signals.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', padding: '16px' }}>
              NO RED FLAGS OR ANOMALIES DETECTED BY THE RULES ENGINE
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '90px' }}>RULE ID</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '110px' }}>SEVERITY</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '130px' }}>CATEGORY</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>TITLE & EVIDENCE</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>IMPLICATION</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((sig, i) => {
                  const sev = (sig.severity || '').toUpperCase();
                  let color = 'var(--text-0)';
                  if (sev === 'RED_FLAG') color = 'var(--accent-red)';
                  else if (sev === 'YELLOW_FLAG') color = 'var(--accent-yellow)';
                  else if (sev === 'POSITIVE') color = 'var(--accent-green)';
                  
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 8px', color: 'var(--text-1)' }}>{sig.rule_id}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          color: color,
                          backgroundColor: color === 'var(--accent-red)' ? 'rgba(229, 72, 77, 0.1)' : color === 'var(--accent-yellow)' ? 'rgba(232, 193, 63, 0.1)' : 'rgba(48, 164, 108, 0.1)',
                          border: `1px solid ${color}33`
                        }}>
                          {sig.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-2)' }}>{sig.category}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ color: 'var(--text-0)', fontWeight: 500 }}>{sig.title}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '2px' }}>{sig.evidence}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-1)', fontSize: '11px', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
                        {sig.implication}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Piotroski F-Score */}
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
          Piotroski F-Score (Financial strength / Solvency)
        </h3>
        <div style={{
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '32px',
              fontWeight: 700,
              color: getPiotroskiColor(p.score)
            }}>
              {p.score !== null && p.score !== undefined ? `${p.score}/9` : '—'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 600,
              color: getPiotroskiColor(p.score),
              textTransform: 'uppercase'
            }}>
              {p.interpretation || 'N/A'}
            </span>
          </div>

          {p.signals && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>STRENGTH SIGNAL</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(p.signals).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 0', color: 'var(--text-0)' }}>{signalLabels[k] || k}</td>
                    <td style={{
                      padding: '8px 0',
                      textAlign: 'right',
                      color: v ? 'var(--accent-green)' : 'var(--text-2)',
                      fontWeight: 600
                    }}>
                      {v ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ai.financialAnalysis?.earningsQuality?.piotroskiInterpretation && (
            <p style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--text-1)',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginBottom: 0
            }}>
              {ai.financialAnalysis.earningsQuality.piotroskiInterpretation}
            </p>
          )}
        </div>
      </div>

      {/* Beneish M-Score */}
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
          Beneish M-Score (Earnings Manipulation Risk)
        </h3>
        <div style={{
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '32px',
              fontWeight: 700,
              color: getBeneishColor(b.flag)
            }}>
              {b.mScore !== null && b.mScore !== undefined ? b.mScore : b.score !== null && b.score !== undefined ? b.score : '—'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                color: getBeneishColor(b.flag),
                textTransform: 'uppercase'
              }}>
                {b.flag === 'CLEAN' ? 'CLEAN (NON-MANIPULATOR)' : b.flag === 'POSSIBLE_MANIPULATION' ? 'POSSIBLE MANIPULATION ALERT' : 'INSUFFICIENT DATA'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>
                Threshold Limit: -1.78 (Score &gt; -1.78 implies manipulation risk)
              </span>
            </div>
          </div>

          {b.components && Object.keys(b.components).length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>INDEX VARIABLE</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>VALUE</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>EVALUATION</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(b.components).map(([k, v]) => {
                  let statusText = 'Normal';
                  let statusColor = 'var(--accent-green)';
                  if (k === 'DSRI' && v > 1.2) {
                    statusText = 'Receivables spike';
                    statusColor = 'var(--accent-red)';
                  } else if (k === 'TATA' && v > 0.05) {
                    statusText = 'High accruals';
                    statusColor = 'var(--accent-red)';
                  } else if (k === 'SGI' && v > 1.3) {
                    statusText = 'Sales acceleration';
                    statusColor = 'var(--accent-yellow)';
                  }

                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text-0)' }}>{bLabels[k] || k}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-0)' }}>{v}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: statusColor, fontWeight: 500 }}>
                        {statusText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {ai.financialAnalysis?.earningsQuality?.beneishInterpretation && (
            <p style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--text-1)',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginBottom: 0
            }}>
              {ai.financialAnalysis.earningsQuality.beneishInterpretation}
            </p>
          )}
        </div>
      </div>

      {/* Altman Z-Score */}
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
          Altman Z-Score (Emerging Markets Solvency / Bankruptcy Risk)
        </h3>
        <div style={{
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '32px',
              fontWeight: 700,
              color: getAltmanColor(a.zone)
            }}>
              {a.zScore !== null && a.zScore !== undefined ? a.zScore : a.score !== null && a.score !== undefined ? a.score : '—'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                color: getAltmanColor(a.zone),
                textTransform: 'uppercase'
              }}>
                {a.zone ? `${a.zone} ZONE` : 'N/A'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>
                Z &gt; 2.60: Safe | 1.10 - 2.60: Grey Zone | Z &lt; 1.10: Solvency distress risk
              </span>
            </div>
          </div>

          {a.components && Object.keys(a.components).length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>FACTOR COMPONENT</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>VALUE</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-2)', fontWeight: 'normal' }}>DESCRIPTION</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['X1 (Working Capital / Total Assets)', a.components?.X1, 'Short-term liquidity ratio'],
                  ['X2 (Retained Earnings / Total Assets)', a.components?.X2, 'Cumulative historical profitability'],
                  ['X3 (EBIT / Total Assets)', a.components?.X3, 'Asset earning efficiency'],
                  ['X4 (Market Value of Equity / Total Debt)', a.components?.X4, 'Financial leverage/solvency factor'],
                ].map(([label, val, desc]) => (
                  <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 0', color: 'var(--text-0)' }}>{label}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-0)' }}>
                      {val !== null && val !== undefined ? val : '—'}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-2)' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ai.altmanZInterpretation && (
            <p style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--text-1)',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginBottom: 0
            }}>
              {ai.altmanZInterpretation}
            </p>
          )}
        </div>
      </div>

      {/* CFO vs PAT chart */}
      {pat?.length > 0 && (
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
            Cash Conversion & Earnings Quality Graph (PAT vs CFO)
          </h3>
          <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <PatCfoChart years={years} pat={pat} cfo={cfo} />
          </div>
        </div>
      )}

    </div>
  );
}
