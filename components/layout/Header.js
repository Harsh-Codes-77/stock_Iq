// components/layout/Header.js
// Top bar: logo + ticker display + actions in minimal terminal style

import { useRouter } from 'next/router';

export default function Header({ companyName, symbol, price, priceChange, priceChangePct, onExportPDF, hasData, pdfLoading }) {
  const router = useRouter();
  
  const symbolStr = symbol || '';
  const exchange = symbolStr.endsWith('.NS') ? 'NSE' : symbolStr.endsWith('.BO') ? 'BSE' : 'NSE';
  const ticker = symbolStr.replace('.NS', '').replace('.BO', '');

  const isPositive = parseFloat(priceChangePct) >= 0;

  return (
    <header style={{
      backgroundColor: 'var(--bg-0)',
      borderBottom: '1px solid var(--border-subtle)',
      height: '48px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      boxSizing: 'border-box'
    }}>
      {/* Brand logo */}
      <div
        onClick={() => router.push('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          marginRight: '24px'
        }}
      >
        <span style={{
          backgroundColor: 'var(--accent-red)',
          color: '#ffffff',
          fontWeight: 800,
          padding: '2px 6px',
          fontSize: '12px',
          borderRadius: '2px',
          fontFamily: 'var(--font-mono)'
        }}>STQ</span>
        <span className="hidden-xs-mobile" style={{
          fontWeight: 700,
          color: 'var(--text-0)',
          fontSize: '14px',
          letterSpacing: '-0.5px'
        }}>STOCKIQ</span>
      </div>

      {/* Symbol Details */}
      {symbol && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            color: 'var(--text-2)',
            backgroundColor: 'var(--bg-1)',
            padding: '2px 6px',
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--border-subtle)'
          }}>{exchange}</span>
          <span style={{
            fontWeight: 600,
            color: 'var(--text-0)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)'
          }}>{ticker}</span>
          {companyName && (
            <span className="hidden-xs-mobile" style={{
              color: 'var(--text-2)',
              fontSize: '11px',
              maxWidth: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>| {companyName}</span>
          )}
        </div>
      )}

      {/* Right-aligned Stats & Actions */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {price !== null && price !== undefined && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-0)', fontWeight: 600, fontSize: '14px' }}>
                ₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {priceChangePct !== null && priceChangePct !== undefined && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)'
                }}>
                  {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(priceChangePct))}%
                </span>
              )}
            </div>
          )}

          {hasData && onExportPDF && (
            <button
              onClick={pdfLoading ? null : onExportPDF}
              disabled={pdfLoading}
              className="hidden-xs-mobile"
              style={{
                backgroundColor: 'var(--bg-1)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-0)',
                padding: '4px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: pdfLoading ? 'not-allowed' : 'pointer',
                opacity: pdfLoading ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => { if (!pdfLoading) e.currentTarget.style.borderColor = 'var(--text-1)'; }}
              onMouseOut={(e) => { if (!pdfLoading) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              {pdfLoading ? 'Generating PDF...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
