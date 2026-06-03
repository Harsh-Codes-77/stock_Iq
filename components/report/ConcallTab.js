// components/report/ConcallTab.js
// Concall transcript intelligence: guidance, deflections, credibility, excuses in terminal theme

export default function ConcallTab({ data }) {
  const concall = data.concall_analysis || {};
  const guidance = concall.guidance_statements || [];
  const excuses = concall.repeated_excuses || [];
  const avoided = concall.avoided_topics || [];
  const trajectory = concall.confidence_trajectory || 'STABLE';
  const score = concall.management_credibility_score || 5.0;
  const risks = concall.key_risks_mentioned || [];
  const opportunities = concall.key_opportunities_mentioned || [];
  const rules = concall.rule_based_detection || {};

  const getTrajectoryColor = (t) => {
    switch (t.toUpperCase()) {
      case 'IMPROVING': return 'var(--accent-green)';
      case 'DECLINING': return 'var(--accent-red)';
      default: return 'var(--accent-yellow)';
    }
  };

  const getScoreColor = (s) => {
    if (s >= 7.5) return 'var(--accent-green)';
    if (s >= 5.0) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Stats Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {/* Credibility Score */}
        <div style={{
          flex: '1 1 200px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
            MANAGEMENT CREDIBILITY SCORE
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: getScoreColor(score) }}>
            {score.toFixed(1)}<span style={{ fontSize: '14px', color: 'var(--text-2)' }}> / 10.0</span>
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--bg-2)',
            marginTop: '12px',
            width: '100%',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: getScoreColor(score),
              width: `${score * 10}%`
            }} />
          </div>
        </div>

        {/* Confidence Trajectory */}
        <div style={{
          flex: '1 1 200px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
            CONFIDENCE TRAJECTORY
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: getTrajectoryColor(trajectory), marginTop: '8px' }}>
            {trajectory}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-1)', marginTop: '12px', fontFamily: 'var(--font-sans)' }}>
            Comparing current tone against historical transcripts.
          </div>
        </div>

        {/* Heuristics Count */}
        <div style={{
          flex: '1 1 200px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
            RULE-BASED SIGNALS DETECTED
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <div>Guidance Tokens: <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>{(rules.guidance_statements || []).length}</span></div>
            <div>Excuse Phrases: <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{(rules.excuse_patterns || []).length}</span></div>
            <div>Tonality Indicator: <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{rules.confidence_indicators || 'N/A'}</span></div>
          </div>
        </div>
      </div>

      {/* Guidance Statements Table */}
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
          Specific Forward-Looking Guidance Statements
        </h3>
        <div style={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '16px', overflowX: 'auto' }}>
          {guidance.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', padding: '16px' }}>
              NO EXPLICIT GUIDANCE STATEMENTS CAPTURED IN ANALYZED EXCERPTS
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '80px' }}>QUARTER</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '120px' }}>METRIC</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal', width: '100px' }}>TARGET</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 'normal' }}>STATEMENT / CONTEXT</th>
                </tr>
              </thead>
              <tbody>
                {guidance.map((g, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--accent-yellow)', fontWeight: 500 }}>{g.quarter}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-0)' }}>{g.metric}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--accent-green)', fontWeight: 600 }}>{g.target}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-1)', fontSize: '11px', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
                      "{g.statement}"
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Excuses and Avoided Topics */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {/* Repeated Excuses */}
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
            Repeated Management Excuses / Headwind Narratives
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            minHeight: '150px',
            fontFamily: 'var(--font-mono)'
          }}>
            {excuses.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', paddingTop: '40px' }}>
                NO RECURRING EXCUSE PATTERNS DETECTED
              </div>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {excuses.map((e, i) => (
                  <li key={i} style={{
                    fontSize: '12px',
                    color: 'var(--text-1)',
                    lineHeight: 1.5,
                    marginBottom: '12px',
                    borderBottom: i < excuses.length - 1 ? '1px dashed var(--border-subtle)' : 'none',
                    paddingBottom: '8px'
                  }}>
                    <div style={{ color: 'var(--text-0)', fontWeight: 500 }}>{e.excuse}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '4px' }}>
                      Appeared in: {e.appeared_in_quarters.join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Avoided Topics / Deflections */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-yellow)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Uncomfortable Topics / Deflections in Q&A
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            minHeight: '150px',
            fontFamily: 'var(--font-mono)'
          }}>
            {avoided.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', paddingTop: '40px' }}>
                NO DEFLECTION PATTERNS IDENTIFIED
              </div>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {avoided.map((a, i) => (
                  <li key={i} style={{
                    fontSize: '12px',
                    color: 'var(--text-1)',
                    lineHeight: 1.4,
                    marginBottom: '8px',
                    position: 'relative',
                    paddingLeft: '16px'
                  }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--accent-yellow)' }}>↳</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Risks & Opportunities Mentioned */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {/* Risks */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-1)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Management Highlighted Risks
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            fontFamily: 'var(--font-sans)',
            minHeight: '120px'
          }}>
            {risks.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', paddingTop: '30px' }}>
                NO SPECIFIC RISKS HIGHLIGHTED
              </div>
            ) : (
              <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-1)', fontSize: '13px', lineHeight: 1.5 }}>
                {risks.map((r, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Opportunities */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-1)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.05em'
          }}>
            Management Highlighted Opportunities
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            fontFamily: 'var(--font-sans)',
            minHeight: '120px'
          }}>
            {opportunities.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)', textAlign: 'center', paddingTop: '30px' }}>
                NO SPECIFIC OPPORTUNITIES HIGHLIGHTED
              </div>
            ) : (
              <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-1)', fontSize: '13px', lineHeight: 1.5 }}>
                {opportunities.map((o, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{o}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
