// components/report/RisksTab.js
// Risks matrix and positive/negative catalysts in terminal theme style

export default function RisksTab({ data }) {
  const ai = data.aiAnalysis || {};
  const risks = ai.riskMatrix || [];
  const catalysts = ai.catalysts || {};

  const getSeverityStyle = (level) => {
    const l = (level || '').toUpperCase();
    if (l === 'HIGH') {
      return {
        color: 'var(--accent-red)',
        backgroundColor: 'rgba(229, 72, 77, 0.1)',
        border: '1px solid rgba(229, 72, 77, 0.3)'
      };
    } else if (l === 'MEDIUM') {
      return {
        color: 'var(--accent-yellow)',
        backgroundColor: 'rgba(232, 193, 63, 0.1)',
        border: '1px solid rgba(232, 193, 63, 0.3)'
      };
    } else {
      return {
        color: 'var(--accent-green)',
        backgroundColor: 'rgba(48, 164, 108, 0.1)',
        border: '1px solid rgba(48, 164, 108, 0.3)'
      };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Risk Matrix Table */}
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
          Risk Factor Identification & Severity Matrix
        </h3>
        <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>RISK FACTOR</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '100px' }}>SEVERITY</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '100px' }}>PROBABILITY</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 8px', color: 'var(--text-0)', fontWeight: 500 }}>{r.risk}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      ...getSeverityStyle(r.severity)
                    }}>
                      {r.severity}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      ...getSeverityStyle(r.probability)
                    }}>
                      {r.probability}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-1)', fontSize: '11px', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
                    {r.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catalysts Flex Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px'
      }}>
        {/* Positive Catalysts */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-green)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Positive Catalysts (Upside Drivers)
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            minHeight: '120px'
          }}>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {(catalysts.positive || []).map((c, i) => (
                <li key={i} style={{
                  fontSize: '13px',
                  color: 'var(--text-1)',
                  lineHeight: 1.4,
                  marginBottom: '8px',
                  position: 'relative',
                  paddingLeft: '16px'
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>+</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Negative Catalysts */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-red)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Negative Catalysts (Downside Triggers)
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            minHeight: '120px'
          }}>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {(catalysts.negative || []).map((c, i) => (
                <li key={i} style={{
                  fontSize: '13px',
                  color: 'var(--text-1)',
                  lineHeight: 1.4,
                  marginBottom: '8px',
                  position: 'relative',
                  paddingLeft: '16px'
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>-</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
