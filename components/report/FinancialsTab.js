// components/report/FinancialsTab.js
// Annual + Quarterly financials, charts, working capital, DuPont in terminal theme style

import { useState } from 'react';
import dynamic from 'next/dynamic';

const RevenueEbitdaChart = dynamic(() => import('../charts/RevenueEbitdaChart'), { ssr: false });
const PatCfoChart = dynamic(() => import('../charts/PatCfoChart'), { ssr: false });
const RoceTrendChart = dynamic(() => import('../charts/RoceTrendChart'), { ssr: false });
const DuPontChart = dynamic(() => import('../charts/DuPontChart'), { ssr: false });

export default function FinancialsTab({ data }) {
  const [view, setView] = useState('annual');
  const fin = data.financials || {};
  const q = data.quarterly || {};
  const rt = data.ratioTrend || {};
  const wcc = data.computedScores?.wcc || {};
  const dupont = data.computedScores?.dupont || {};
  const ai = data.aiAnalysis?.financialAnalysis || {};

  // Reverse arrays for display (oldest to newest)
  const years = [...(fin.annualYears || [])].reverse();
  const revenue = [...(fin.revenue || [])].reverse();
  const ebitda = [...(fin.ebitda || [])].reverse();
  const pat = [...(fin.pat || [])].reverse();
  const cfo = [...(fin.cfo || [])].reverse();
  const fcf = [...(fin.freeCashFlow || [])].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* View Toggle */}
      <div style={{
        display: 'flex',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-1)',
        width: 'fit-content'
      }}>
        {['annual', 'quarterly'].map(v => {
          const isActive = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '8px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                backgroundColor: isActive ? 'var(--bg-2)' : 'transparent',
                border: 'none',
                color: isActive ? 'var(--text-0)' : 'var(--text-1)',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      {view === 'annual' ? (
        <>
          {/* Revenue & EBITDA Chart */}
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
              Revenue & EBITDA Margin Trend
            </h3>
            <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
              <RevenueEbitdaChart
                years={years}
                revenue={revenue}
                ebitdaMargin={[...(rt.roce || [])]}
              />
            </div>
          </div>

          {/* PAT vs CFO Chart */}
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
              Net Profit (PAT) vs Cash Flow from Operations (CFO)
            </h3>
            <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
              <PatCfoChart years={years} pat={pat} cfo={cfo} />
              {ai.earningsQuality?.cfoPatAnalysis && (
                <p style={{
                  fontSize: '12px',
                  lineHeight: 1.5,
                  color: 'var(--text-2)',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  marginBottom: 0
                }}>
                  {ai.earningsQuality.cfoPatAnalysis}
                </p>
              )}
            </div>
          </div>

          {/* ROCE Trend Chart */}
          {rt.roce?.length > 0 && (
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
                Return on Capital Employed (ROCE) Trend
              </h3>
              <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                <RoceTrendChart years={rt.years || []} roce={rt.roce || []} />
              </div>
            </div>
          )}

          {/* Annual Financials Data Table */}
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
              Annual Balance Sheet & Income Metrics (₹ Crore)
            </h3>
            <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>METRIC</th>
                    {years.map(yr => (
                      <th key={yr} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>FY {yr}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Revenue', ...revenue],
                    ['EBITDA', ...ebitda],
                    ['Net Profit (PAT)', ...pat],
                    ['Operating Cash Flow (CFO)', ...cfo],
                    ['Free Cash Flow (FCF)', ...fcf],
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px', color: 'var(--text-0)', fontWeight: 500 }}>{row[0]}</td>
                      {row.slice(1).map((val, vidx) => (
                        <td key={vidx} style={{ padding: '8px', textAlign: 'right', color: 'var(--text-0)' }}>
                          {val !== null && val !== undefined ? `₹${Number(val).toLocaleString('en-IN')}` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Working Capital Cycle */}
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
              Working Capital efficiency Metrics
            </h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '16px',
              backgroundColor: 'var(--bg-1)',
              border: '1px solid var(--border-subtle)'
            }}>
              {[
                { label: 'Days Receivables', value: wcc.daysReceivables, unit: 'days' },
                { label: 'Days Inventory', value: wcc.daysInventory, unit: 'days' },
                { label: 'Days Payable', value: wcc.daysPayable, unit: 'days' },
                { label: 'Cash Conversion Cycle', value: wcc.cashConversionCycle, unit: 'days' },
              ].map((m) => (
                <div key={m.label} style={{ flex: '1 1 120px', minWidth: '100px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 600, color: 'var(--text-0)' }}>
                    {m.value !== null && m.value !== undefined ? `${m.value} ${m.unit}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DuPont Decomposition Chart */}
          {dupont.roe !== null && (
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
                DuPont 3-Factor ROE Decomposition
              </h3>
              <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                <DuPontChart dupont={dupont} />
              </div>
            </div>
          )}

          {/* DuPont AI Insights */}
          {ai.dupontInsight && (
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '20px'
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                AI DuPont Decomposition Insight
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
                {ai.dupontInsight}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Quarterly performance data table */
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
            Quarterly Performance Metrics (₹ Crore)
          </h3>
          <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>QUARTER</th>
                  {(q.quarters || []).map(qtr => (
                    <th key={qtr} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>{qtr}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Revenue', ...(q.revenue || [])],
                  ['EBITDA', ...(q.ebitda || [])],
                  ['Net Profit (PAT)', ...(q.pat || [])],
                  ['EBITDA Margin', ...(q.ebitdaMargin || []).map(v => v !== null && v !== undefined ? `${v}%` : null)],
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-0)', fontWeight: 500 }}>{row[0]}</td>
                    {row.slice(1).map((val, vidx) => (
                      <td key={vidx} style={{ padding: '8px', textAlign: 'right', color: 'var(--text-0)' }}>
                        {val !== null && val !== undefined ? (typeof val === 'number' ? `₹${Number(val).toLocaleString('en-IN')}` : val) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
