// components/report/ShareholdingTab.js
// Shareholding metrics and trend view in custom terminal layout

import dynamic from 'next/dynamic';
const ShareholdingChart = dynamic(() => import('../charts/ShareholdingChart'), { ssr: false });

export default function ShareholdingTab({ data }) {
  const sh = data.shareholding || {};
  const ai = data.aiAnalysis || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Current Shareholding Metrics */}
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
          Current Shareholding Structure
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
            { label: 'Promoter', value: sh.promoterHolding, suffix: '%' },
            { label: 'Promoter Pledge', value: sh.promoterPledge, suffix: '%', warn: sh.promoterPledge > 5 },
            { label: 'FII Holding', value: sh.fiiHolding, suffix: '%' },
            { label: 'DII Holding', value: sh.diiHolding, suffix: '%' },
            { label: 'Public & Others', value: sh.publicHolding, suffix: '%' },
          ].map((m) => (
            <div key={m.label} style={{ flex: '1 1 120px', minWidth: '100px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                fontWeight: 600,
                color: m.warn ? 'var(--accent-red)' : 'var(--text-0)'
              }}>
                {m.value !== null && m.value !== undefined ? `${m.value}${m.suffix}` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shareholding Trend Chart */}
      {sh.trend?.length > 0 && (
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
            Shareholding Trend (Last 8 Quarters)
          </h3>
          <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <ShareholdingChart trend={sh.trend} />
          </div>
        </div>
      )}

      {/* AI Shareholding Insight */}
      {ai.shareholdingInsight && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '20px'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-1)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
            AI Shareholding & Ownership Trend Analysis
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-1)', margin: 0 }}>
            {ai.shareholdingInsight}
          </p>
        </div>
      )}

    </div>
  );
}
