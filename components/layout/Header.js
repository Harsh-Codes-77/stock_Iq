// components/layout/Header.js
// Top bar: logo + ticker display + actions in minimal terminal style

import { useRouter } from 'next/router';

export default function Header({ companyName, symbol, price, priceChange, priceChangePct, onExportPDF, hasData }) {
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
      width: '100%'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 16px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%'
      }}>
        {/* Left: Logo & Meta Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
              fontWeight: 'italic',
              fontStyle: 'italic',
              color: 'var(--text-0)',
              cursor: 'pointer'
            }}
          >
            StockIQ
          </button>
          
          {companyName && (
            <>
              <span className="hidden-mobile" style={{ color: 'var(--text-2)' }}>/</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span className="hidden-mobile" style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--text-0)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {companyName}
                </span>
                
                {symbol && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    padding: '1px 6px',
                    backgroundColor: 'var(--bg-2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-1)',
                    whiteSpace: 'nowrap'
                  }}>
                    {exchange}:{ticker}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Live Price and PDF Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
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
              onClick={onExportPDF}
              className="hidden-xs-mobile"
              style={{
                backgroundColor: 'var(--bg-1)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-0)',
                padding: '4px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--text-1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              Export PDF
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
