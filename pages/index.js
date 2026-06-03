// pages/index.js — Bloomberg-style minimal landing page
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const POPULAR = [
  'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ZOMATO',
  'BAJFINANCE', 'TATAMOTORS', 'ICICIBANK', 'ASIANPAINT', 'SUNPHARMA',
];

export default function Home() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('stockiq_recent') || '[]');
      setRecent(saved.slice(0, 6));
    } catch {}
  }, []);

  function handleAnalyze(t) {
    const target = (t || ticker).trim().toUpperCase();
    if (!target) return;

    // Save to recent
    try {
      const saved = JSON.parse(localStorage.getItem('stockiq_recent') || '[]');
      const updated = [target, ...saved.filter(s => s !== target)].slice(0, 8);
      localStorage.setItem('stockiq_recent', JSON.stringify(updated));
    } catch {}

    router.push(`/report/${encodeURIComponent(target)}`);
  }

  return (
    <>
      <Head>
        <title>StockIQ — Institutional Equity Research · NSE/BSE</title>
        <meta name="description" content="AI-powered institutional equity research for Indian stocks. Piotroski, Beneish, Altman scoring with DCF valuation." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-0)'
      }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          
          {/* Logo / Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '48px',
              fontStyle: 'italic',
              fontWeight: 'normal',
              color: 'var(--text-0)',
              marginBottom: '6px',
              letterSpacing: '-0.02em'
            }}>
              StockIQ
            </h1>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: 'var(--text-1)',
              textTransform: 'uppercase'
            }}>
              Institutional Equity Intelligence
            </div>
          </div>

          {/* Search Terminal Input */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-1)',
              height: '42px',
              alignItems: 'stretch'
            }}>
              <input
                type="text"
                placeholder="Enter ticker (e.g. RELIANCE, TCS)..."
                value={ticker}
                onChange={e => setTicker(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                style={{
                  flex: 1,
                  padding: '0 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-0)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  outline: 'none',
                }}
                id="search-input"
                autoFocus
              />
              <button
                onClick={() => handleAnalyze()}
                style={{
                  backgroundColor: 'var(--bg-2)',
                  border: 'none',
                  borderLeft: '1px solid var(--border-subtle)',
                  color: 'var(--text-0)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '0 20px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-subtle)'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)'; }}
                id="analyze-btn"
              >
                RUN
              </button>
            </div>
          </div>

          {/* Popular Tickers */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--text-2)',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '0.05em'
            }}>
              Active Terminals
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {POPULAR.map(t => (
                <button
                  key={t}
                  onClick={() => handleAnalyze(t)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-1)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--text-0)';
                    e.currentTarget.style.borderColor = 'var(--text-1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--text-1)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Searches */}
          {recent.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-2)',
                textTransform: 'uppercase',
                marginBottom: '8px',
                letterSpacing: '0.05em'
              }}>
                Recent Queries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {recent.map(t => (
                  <button
                    key={t}
                    onClick={() => handleAnalyze(t)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = 'var(--text-0)';
                      e.currentTarget.style.borderColor = 'var(--text-1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = 'var(--text-1)';
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Model Features Divider */}
          <div style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {[
              ['Scoring Models', 'Piotroski, Beneish, Altman'],
              ['Intrinsic Valuation', '3-Scenario WACC DCF'],
              ['Equity Analysis', 'Institutional Gemini Engine'],
            ].map(([header, desc]) => (
              <div key={header} style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  color: 'var(--text-0)',
                  fontWeight: 500,
                  lineHeight: 1.2
                }}>
                  {header}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--text-2)',
                  marginTop: '2px',
                  lineHeight: 1.2
                }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>

          {/* SEBI Compliance Footnote */}
          <div style={{
            textAlign: 'center',
            marginTop: '32px',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--text-2)',
            lineHeight: 1.4
          }}>
            DISCLAIMER: Non-SEBI registered model. Outputs represent mathematical valuations and synthetic AI analyses for educational purposes.
          </div>

        </div>
      </div>
    </>
  );
}
