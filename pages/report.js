import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// Chart.js loaded only client-side (no SSR)
const ChartComp = dynamic(() => import('../components/ChartComp'), { ssr: false });

// ─── colour helpers ────────────────────────────────────────────────────────────
const RATING_COLOR = { BUY:'#22543D', ACCUMULATE:'#276749', HOLD:'#744210', REDUCE:'#7B341E', SELL:'#742A2A' };
const RATING_BG    = { BUY:'#F0FFF4', ACCUMULATE:'#F0FFF4', HOLD:'#FFFBEB', REDUCE:'#FFF5F5', SELL:'#FFF5F5' };
const STATUS_STYLE = {
  DELIVERED: { bg:'#F0FFF4', color:'#22543D' },
  PARTIAL:   { bg:'#FFFBEB', color:'#744210' },
  MISSED:    { bg:'#FFF5F5', color:'#742A2A' },
  HEALTHY:   { bg:'#F0FFF4', color:'#22543D' },
  WARNING:   { bg:'#FFFBEB', color:'#744210' },
  RISK:      { bg:'#FFF5F5', color:'#742A2A' },
};
const SEVERITY_COLOR = s => s >= 7 ? '#A32D2D' : s >= 4 ? '#BA7517' : '#27500A';
const ACTION_COLOR = a => a === 'BUY' ? '#22543D' : a === 'AVOID' ? '#742A2A' : '#744210';

export default function Report() {
  const router = useRouter();
  const { company, sector, price, marketCap, skipLive } = router.query;

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [step, setStep]     = useState(0);
  const [tab, setTab]       = useState('overview');
  const reportRef           = useRef(null);

  const STEPS = ['Fetching company data','Running financial models','Forensic analysis','Generating report'];

  useEffect(() => {
    if (!company) return;
    generateReport();
  }, [company]);

  async function generateReport() {
    setLoading(true); setError(''); setData(null); setStep(0);
    const interval = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 2200);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, sector, price, marketCap, skipLive }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        const snippet = text ? text.slice(0, 200) : '';
        throw new Error(snippet ? `Invalid JSON response: ${snippet}` : 'Empty response from server');
      }
      if (!res.ok || !json.success) throw new Error(json.error || `Failed to generate report (${res.status})`);
      setData(json.data);
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Try Skip live data fetch or check your API key/network.');
      } else {
      setError(e.message);
      }
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  async function exportPDF() {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    let y = 0;
    const pageH = pdf.internal.pageSize.getHeight();
    while (y < pdfH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH);
      y += pageH;
    }
    pdf.save(`${data?.company?.name || company}_Research_Report.pdf`);
  }

  const TABS = [
    { id:'overview',  label:'Overview'   },
    { id:'financial', label:'Financials' },
    { id:'valuation', label:'Valuation'  },
    { id:'management',label:'Management' },
    { id:'forensic',  label:'Forensic'   },
    { id:'concall',   label:'Concall'    },
    { id:'risks',     label:'Risks'      },
    { id:'smartmoney',label:'Smart Money'},
    { id:'verdict',   label:'Verdict'    },
  ];

  const revenueSegments = Array.isArray(data?.businessOverview?.revenueSegments)
    ? data.businessOverview.revenueSegments
    : [];

  return (
    <>
      <Head>
        <title>{company ? `${company} — Research Report | StockIQ` : 'Report | StockIQ'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* TOP NAV */}
      <div className="mobile-stack mobile-card-padding" style={{background:'#0B1E3D',padding:'0.875rem 1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{cursor:'pointer',color:'rgba(255,255,255,0.6)',fontSize:13}} onClick={()=>router.push('/')}>← StockIQ</span>
          <span style={{color:'rgba(255,255,255,0.3)'}}>|</span>
          <span style={{color:'#fff',fontWeight:600,fontSize:14}}>{company || '—'}</span>
          {data?.company?.rating && (
            <span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:RATING_BG[data.company.rating],color:RATING_COLOR[data.company.rating]}}>
              {data.company.rating}
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={generateReport} style={{background:'rgba(255,255,255,0.1)',color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:500}}>
            🔄 Regenerate
          </button>
          {data && (
            <button onClick={exportPDF} style={{background:'#185FA5',color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:500}}>
              📄 Export PDF
            </button>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{maxWidth:900,margin:'4rem auto',textAlign:'center',padding:'2rem'}}>
          <div style={{fontSize:40,marginBottom:'1rem'}}>⏳</div>
          <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>Generating Institutional Report</div>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:'2rem'}}>{STEPS[step]}...</div>
          <div style={{display:'flex',gap:0,maxWidth:480,margin:'0 auto'}}>
            {STEPS.map((s,i) => (
              <div key={i} style={{flex:1,height:4,background:i<=step?'#185FA5':'var(--border)',transition:'background 0.4s',borderRadius:i===0?'4px 0 0 4px':i===STEPS.length-1?'0 4px 4px 0':'0'}} />
            ))}
          </div>
          <div style={{marginTop:8,fontSize:11,color:'var(--muted)'}}>{step+1} / {STEPS.length}</div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div style={{maxWidth:900,margin:'2rem auto',padding:'1.5rem',background:'#FFF5F5',border:'1px solid #FEB2B2',borderRadius:12,textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:8}}>⚠️</div>
          <div style={{fontWeight:600,marginBottom:4,color:'#742A2A'}}>Report generation failed</div>
          <div style={{fontSize:13,color:'#742A2A',marginBottom:'1rem'}}>{error}</div>
          <button onClick={generateReport} style={{background:'#742A2A',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',fontSize:13}}>Try Again</button>
        </div>
      )}

      {/* REPORT */}
      {data && (
        <div style={{maxWidth:960,margin:'0 auto',padding:'1rem'}} ref={reportRef}>

          {/* COVER CARD */}
          <div className="mobile-card-padding" style={{background:'#0B1E3D',borderRadius:16,padding:'1.75rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:'1rem'}}>
              <div>
                <div style={{fontSize:22,fontWeight:700,color:'#fff',marginBottom:4}}>{data.company.name}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>
                  NSE: {data.company.symbol} · {data.company.sector} · {data.company.exchange || 'NSE/BSE'}
                </div>
              </div>
              <span style={{padding:'8px 18px',borderRadius:20,fontWeight:700,fontSize:14,background:RATING_BG[data.company.rating],color:RATING_COLOR[data.company.rating]}}>
                {data.company.rating}
              </span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
              {[
                ['CMP', `₹${data.company.cmp?.toLocaleString('en-IN') || '—'}`,''],
                ['Target Price', `₹${data.company.targetPrice?.toLocaleString('en-IN') || '—'}`, `+${Math.round((data.company.targetPrice/data.company.cmp-1)*100)}%`],
                ['Market Cap', data.company.marketCapCr ? `₹${(data.company.marketCapCr/100000).toFixed(1)}L Cr` : '—', ''],
                ['52W High', `₹${data.company.fiftyTwoWeekHigh?.toLocaleString('en-IN') || '—'}`, ''],
                ['52W Low', `₹${data.company.fiftyTwoWeekLow?.toLocaleString('en-IN') || '—'}`, ''],
                ['P/E Ratio', data.ratios?.peRatio?.toFixed(1) + 'x' || '—', ''],
              ].map(([label,val,sub])=>(
                <div key={label} style={{background:'rgba(255,255,255,0.07)',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4}}>{label}</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>{val}</div>
                  {sub && <div style={{fontSize:10,color:'#68D391',marginTop:2}}>{sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* DATA SOURCES BANNER */}
          {(data._dataSources?.length > 0) && (
            <div style={{background:'var(--bg2)',borderRadius:10,padding:'8px 14px',marginBottom:'1rem',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:11,fontWeight:600,color:'var(--muted)'}}>📡 DATA SOURCES:</span>
              {data._dataSources.map(src => (
                <span key={src} style={{fontSize:11,padding:'2px 10px',borderRadius:20,
                  background: src.includes('Yahoo')?'#EBF8FF': src.includes('Screener')?'#F0FFF4': src.includes('NSE')?'#FAF5FF':'#FFFBEB',
                  color: src.includes('Yahoo')?'#2B6CB0': src.includes('Screener')?'#276749': src.includes('NSE')?'#553C9A':'#744210',
                  fontWeight:600}}>✓ {src}</span>
              ))}
              {data._dataQuality?.screenerOk && <span style={{fontSize:11,color:'#276749'}}>· Real P&L ✓</span>}
              {data._dataQuality?.nseOk && <span style={{fontSize:11,color:'#2B6CB0'}}>· Live price ✓</span>}
              {data._fetchError && <span style={{fontSize:11,color:'#C05621'}}>⚠ Some sources unavailable — AI filled gaps</span>}
            </div>
          )}

          {data._aiModel === 'fallback' && (
            <div style={{background:'#FFFBEB',border:'1px solid #FBD38D',borderRadius:10,padding:'10px 14px',marginBottom:'1rem'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#744210',marginBottom:4}}>AI analysis unavailable</div>
              <div style={{fontSize:12,color:'#744210'}}>{data._fetchError || 'AI provider did not return a result.'}</div>
            </div>
          )}

          {/* OVERALL SCORE */}
          <div className="grid-1-2">
            <div style={CARD}>
              <div style={CARD_LABEL}>Overall Score</div>
              <div style={{textAlign:'center',padding:'0.5rem'}}>
                <div style={{fontSize:52,fontWeight:700,color:'#185FA5'}}>{data.scores.overall}</div>
                <ScoreBar value={data.scores.overall} color='#185FA5' />
                <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>out of 100</div>
              </div>
            </div>
            <div style={CARD}>
              <div style={CARD_LABEL}>Quality Scorecard</div>
              {Object.entries({
                'Business Quality': data.scores.businessQuality,
                'Management Quality': data.scores.managementQuality,
                'Financial Quality': data.scores.financialQuality,
                'Growth Visibility': data.scores.growthVisibility,
                'Competitive Moat': data.scores.competitiveMoat,
                'Valuation Comfort': data.scores.valuationComfort,
                'Cash Flow Quality': data.scores.cashFlowQuality,
              }).map(([k,v])=>(
                <div key={k} style={{marginBottom:7}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                    <span style={{color:'var(--muted)'}}>{k}</span>
                    <span style={{fontWeight:500}}>{v}/10</span>
                  </div>
                  <ScoreBar value={v*10} color={v>=8?'#1D9E75':v>=6?'#185FA5':'#BA7517'} />
                </div>
              ))}
            </div>
          </div>

          {/* TABS */}
          <div className="no-scrollbar" style={{display:'flex',gap:2,marginBottom:'1rem',overflowX:'auto',borderBottom:'1px solid var(--border)',paddingBottom:0}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:'none',border:'none',padding:'10px 16px',
                fontSize:12,fontWeight:500,whiteSpace:'nowrap',cursor:'pointer',
                borderBottom:`2px solid ${tab===t.id?'#185FA5':'transparent'}`,
                color:tab===t.id?'#185FA5':'var(--muted)',transition:'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {tab==='overview' && (
            <div>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📋 Executive Summary</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>{data.executiveSummary.oneLiner}</div>
                  <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginBottom:12}}>{data.executiveSummary.investmentThesis}</p>
                  <InfoRow label="Biggest Opportunity" val={data.executiveSummary.biggestOpportunity} color='#1D9E75' />
                  <InfoRow label="Biggest Risk" val={data.executiveSummary.biggestRisk} color='#A32D2D' />
                  <InfoRow label="Ideal For" val={data.executiveSummary.idealInvestor} color='#185FA5' />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>🍩 Revenue Segments</div>
                  {revenueSegments.length ? (
                    <ChartComp type="doughnut" data={{
                      labels: revenueSegments.map(s=>s.name),
                      datasets:[{data: revenueSegments.map(s=>s.percentage),
                        backgroundColor: revenueSegments.map(s=>s.color||'#185FA5'),
                        borderWidth:3}]
                    }} height={200} />
                  ) : (
                    <div style={{fontSize:12,color:'var(--muted)',padding:'0.5rem 0'}}>
                      No segment breakdown available.
                    </div>
                  )}
                </div>
              </TwoCol>

              <div style={CARD}>
                <div style={CARD_LABEL}>🏢 Business Overview</div>
                <div style={{marginBottom:10}}><span style={PILL_LABEL}>What it does</span>
                  <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginTop:6}}>{data.businessOverview.whatItDoes}</p>
                </div>
                <div style={{marginBottom:10}}><span style={PILL_LABEL}>How it makes money</span>
                  <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginTop:6}}>{data.businessOverview.howItEarnsMoney}</p>
                </div>
                <div style={{background:'#EFF6FF',borderRadius:10,padding:'1rem',border:'1px solid #BFDBFE'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#185FA5'}}>🎓 ELI15 (Explain like I'm 15)</span>
                  <p style={{fontSize:13,color:'#1e3a5f',lineHeight:1.7,marginTop:6}}>{data.businessOverview.eli15}</p>
                </div>
              </div>

              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>✅ Hidden Strengths</div>
                  {data.businessOverview.hiddenStrengths?.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <span style={{color:'#22543D',fontSize:14}}>●</span><span style={{color:'var(--muted)'}}>{s}</span>
                    </div>
                  ))}
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>⚠️ Hidden Weaknesses</div>
                  {data.businessOverview.hiddenWeaknesses?.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <span style={{color:'#A32D2D',fontSize:14}}>●</span><span style={{color:'var(--muted)'}}>{s}</span>
                    </div>
                  ))}
                </div>
              </TwoCol>

              {/* COMPETITORS */}
              <div style={CARD}>
                <div style={CARD_LABEL}>🏆 Competitor Benchmarking</div>
                <div style={{overflowX:'auto'}}>
                  <table className="mobile-table" style={TABLE}>
                    <thead><tr style={{background:'var(--bg2)'}}>
                      {['Company','MCap','Rev Growth','EBITDA Mgn','ROE','D/E','P/E','Rating'].map(h=>(
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.competitors?.map((c,i)=>(
                        <tr key={i} style={{background:c.isSubject?'rgba(24,95,165,0.06)':'transparent'}}>
                          <td style={{...TD,fontWeight:c.isSubject?700:400}}>{c.name}{c.isSubject?' ★':''}</td>
                          <td style={TD}>{c.mcap}</td>
                          <td style={{...TD,color:c.revenueGrowth>0?'#22543D':'#742A2A'}}>{c.revenueGrowth}%</td>
                          <td style={TD}>{c.ebitdaMargin}%</td>
                          <td style={TD}>{c.roe}%</td>
                          <td style={TD}>{c.debtEquity}x</td>
                          <td style={TD}>{c.pe}x</td>
                          <td style={TD}><span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10,background:RATING_BG[c.rating]||'#F0FFF4',color:RATING_COLOR[c.rating]||'#22543D'}}>{c.rating}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INDUSTRY */}
              <div style={CARD}>
                <div style={CARD_LABEL}>🏭 Industry Analysis</div>
                <div className="grid-2" style={{marginBottom:0}}>
                  <div>
                    <MiniStat label="Industry Size" val={data.industryAnalysis?.size} />
                    <MiniStat label="Growth Rate" val={`${data.industryAnalysis?.growthRate}% CAGR`} />
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:6,fontWeight:600}}>TAILWINDS 🟢</div>
                      {data.industryAnalysis?.tailwinds?.map((t,i)=><div key={i} style={{fontSize:12,color:'var(--muted)',padding:'3px 0'}}>▲ {t}</div>)}
                    </div>
                  </div>
                  <div>
                    <div style={{marginTop:6}}>
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:6,fontWeight:600}}>HEADWINDS 🔴</div>
                      {data.industryAnalysis?.headwinds?.map((h,i)=><div key={i} style={{fontSize:12,color:'var(--muted)',padding:'3px 0'}}>▼ {h}</div>)}
                    </div>
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:6,fontWeight:600}}>INDUSTRY LEADERS</div>
                      {data.industryAnalysis?.leaders?.map((l,i)=><div key={i} style={{fontSize:12,color:'var(--muted)',padding:'3px 0'}}>· {l}</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NEWS (inline in overview) ── */}
          {tab==='overview' && data.news?.length > 0 && (
            <div style={CARD}>
              <div style={CARD_LABEL}>📰 Latest News ({data.news.length} articles)</div>
              {data.news.map((n,i)=>(
                <div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:12,fontWeight:500,lineHeight:1.5,color:'var(--text)'}}>{n.title}</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{n.source} · {n.publishedAt}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── FINANCIALS TAB ── */}
          {tab==='financial' && (
            <div>
              <div style={CARD}>
                <div style={CARD_LABEL}>📈 Revenue Trend (₹ Crore)</div>
                <ChartComp type="bar" data={{
                  labels: data.financials.revenueGrowth.map(d=>d.year),
                  datasets:[{ label:'Revenue', data: data.financials.revenueGrowth.map(d=>d.value),
                    backgroundColor: data.financials.revenueGrowth.map((_,i,a)=>i===a.length-1?'#0C447C':'#B5D4F4') }]
                }} height={200} />
              </div>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>💰 EBITDA Trend (₹ Cr)</div>
                  <ChartComp type="bar" data={{
                    labels: data.financials.ebitdaGrowth.map(d=>d.year),
                    datasets:[{ label:'EBITDA', data: data.financials.ebitdaGrowth.map(d=>d.value),
                      backgroundColor:'rgba(29,158,117,0.7)', borderRadius:4 }]
                  }} height={180} />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>🟢 PAT Trend (₹ Cr)</div>
                  <ChartComp type="line" data={{
                    labels: data.financials.patGrowth.map(d=>d.year),
                    datasets:[{ label:'PAT', data: data.financials.patGrowth.map(d=>d.value),
                      borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,0.08)', fill:true, tension:0.3, pointRadius:4 }]
                  }} height={180} />
                </div>
              </TwoCol>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📊 Margin Trend (%)</div>
                  <ChartComp type="line" data={{
                    labels: data.financials.margins.map(d=>d.year),
                    datasets:[
                      { label:'EBITDA Margin', data: data.financials.margins.map(d=>d.ebitda), borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,0.06)', fill:true, tension:0.3, pointRadius:4 },
                      { label:'Net Margin', data: data.financials.margins.map(d=>d.net), borderColor:'#1D9E75', backgroundColor:'transparent', tension:0.3, pointRadius:4 },
                    ]
                  }} height={180} />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📅 Quarterly Performance</div>
                  <ChartComp type="bar" data={{
                    labels: data.financials.quarterlyRevenue.map(d=>d.quarter),
                    datasets:[
                      { label:'Revenue', data: data.financials.quarterlyRevenue.map(d=>d.revenue), backgroundColor:'rgba(24,95,165,0.6)', yAxisID:'y' },
                      { label:'EBITDA', data: data.financials.quarterlyRevenue.map(d=>d.ebitda), backgroundColor:'rgba(29,158,117,0.7)', yAxisID:'y' },
                    ]
                  }} height={180} multiAxis />
                </div>
              </TwoCol>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📈 ROE &amp; ROCE Trend (%)</div>
                  <ChartComp type="line" data={{
                    labels: data.ratios.roeHistory.map(d=>d.year),
                    datasets:[
                      { label:'ROE', data: data.ratios.roeHistory.map(d=>d.value), borderColor:'#185FA5', tension:0.3, pointRadius:4 },
                      { label:'ROCE', data: data.ratios.roceHistory.map(d=>d.value), borderColor:'#1D9E75', tension:0.3, pointRadius:4 },
                    ]
                  }} height={180} />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📋 Key Ratios Summary</div>
                  <table className="mobile-table" style={{...TABLE,width:'100%'}}>
                    <tbody>
                      {[
                        ['P/E Ratio', data.ratios.peRatio + 'x'],
                        ['P/B Ratio', data.ratios.pbRatio + 'x'],
                        ['EV/EBITDA', data.ratios.evEbitda + 'x'],
                        ['Debt/Equity', data.ratios.debtEquity + 'x'],
                        ['Interest Coverage', data.ratios.interestCoverage + 'x'],
                        ['Current Ratio', data.ratios.currentRatio + 'x'],
                        ['CFO/PAT', data.ratios.cfoPat + 'x'],
                        ['Dividend Yield', data.ratios.dividendYield + '%'],
                      ].map(([k,v])=>(
                        <tr key={k}>
                          <td style={{...TD,color:'var(--muted)',fontSize:12}}>{k}</td>
                          <td style={{...TD,fontWeight:600,textAlign:'right'}}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TwoCol>
            </div>
          )}

          {/* ── VALUATION TAB ── */}
          {tab==='valuation' && (
            data?.valuation ? (
              <div>
                {/* Scenario cards */}
                <div className="grid-3">
                  {[
                    ['BEAR CASE', data.valuation.bear, '#FFF5F5','#742A2A'],
                    ['BASE CASE', data.valuation.base, '#EBF8FF','#2B6CB0'],
                    ['BULL CASE', data.valuation.bull, '#F0FFF4','#22543D'],
                  ].map(([label,sc,bg,col])=>(
                    <div key={label} style={{background:bg,borderRadius:12,padding:'1.25rem',textAlign:'center',border:`1px solid ${col}40`}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.5px',color:col,marginBottom:8}}>{label}</div>
                      <div style={{fontSize:26,fontWeight:700,color:col}}>₹{sc?.price?.toLocaleString('en-IN')}</div>
                      <div style={{fontSize:13,color:col,margin:'6px 0'}}>{sc?.upside > 0 ? '+' : ''}{sc?.upside}% from CMP</div>
                      <div style={{fontSize:11,color:col,opacity:0.8,lineHeight:1.6}}>{sc?.assumption}</div>
                    </div>
                  ))}
                </div>

                {/* Target prices */}
                <div className="grid-3">
                  {[
                    ['1 Year Target', data.valuation.targets?.oneYear],
                    ['3 Year Target', data.valuation.targets?.threeYear],
                    ['5 Year Target', data.valuation.targets?.fiveYear],
                  ].map(([label,t])=>(
                    <div key={label} style={{background:'var(--bg2)',borderRadius:12,padding:'1rem',textAlign:'center'}}>
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:6}}>{label}</div>
                      <div style={{fontSize:22,fontWeight:700}}>₹{t?.price?.toLocaleString('en-IN')}</div>
                      <div style={{fontSize:12,color:'#185FA5',margin:'4px 0'}}>+{t?.upside}% upside</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>{t?.cagr}% CAGR</div>
                    </div>
                  ))}
                </div>

                {/* DCF assumptions */}
                <div style={CARD}>
                  <div style={CARD_LABEL}>🧮 DCF Assumptions</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
                    {[
                      ['WACC', `${data.valuation.dcfAssumptions?.wacc}%`],
                      ['Terminal Growth', `${data.valuation.dcfAssumptions?.terminalGrowth}%`],
                      ['Revenue CAGR', `${data.valuation.dcfAssumptions?.revenueCagr}%`],
                      ['EBITDA Margin', `${data.valuation.dcfAssumptions?.ebitdaMargin}%`],
                    ].map(([k,v])=>(
                      <div key={k} style={{background:'var(--bg2)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>{k}</div>
                        <div style={{fontSize:18,fontWeight:700}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensitivity table */}
                <div style={CARD}>
                  <div style={CARD_LABEL}>📊 DCF Sensitivity Matrix — Intrinsic Value per Share (₹)</div>
                  <div style={{overflowX:'auto'}}>
                    <table className="mobile-table" style={TABLE}>
                      <thead><tr style={{background:'var(--bg2)'}}>
                        <th style={TH}>WACC \ TG</th>
                        {data.valuation.sensitivityMatrix?.tgValues?.map(v=><th key={v} style={TH}>{v}%</th>)}
                      </tr></thead>
                      <tbody>
                        {data.valuation.sensitivityMatrix?.matrix?.map((row,i)=>(
                          <tr key={i} style={{background: i===2?'rgba(24,95,165,0.07)':'transparent'}}>
                            <td style={{...TH,textAlign:'left'}}>{data.valuation.sensitivityMatrix?.waccValues?.[i]}%{i===2?' (Base)':''}</td>
                            {row.map((v,j)=>(
                              <td key={j} style={{...TD,textAlign:'right',fontWeight: i===2&&j===Math.floor(row.length/2)?700:400,
                                color: v > data.company.cmp*1.2 ? '#22543D' : v < data.company.cmp*0.9 ? '#742A2A' : 'inherit'}}>
                                ₹{v?.toLocaleString('en-IN')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Multibagger triggers */}
                <div style={CARD}>
                  <div style={CARD_LABEL}>🚀 Multibagger Triggers</div>
                  <div className="grid-2" style={{marginBottom:0}}>
                    {data.multibaggerTriggers?.map((t,i)=>(
                      <div key={i} style={{background:'#EFF6FF',borderRadius:8,padding:'0.875rem',fontSize:12,color:'#1e3a5f',lineHeight:1.6,border:'1px solid #BFDBFE'}}>
                        ⚡ {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={CARD}>
                <div style={CARD_LABEL}>Valuation Unavailable</div>
                <div style={{fontSize:13,color:'var(--muted)'}}>
                  Valuation data is missing from the AI response. Try regenerating the report.
                </div>
              </div>
            )
          )}

          {/* ── MANAGEMENT TAB ── */}
          {tab==='management' && (
            <div>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>👔 Management Score</div>
                  <div style={{textAlign:'center',padding:'0.5rem'}}>
                    <div style={{fontSize:48,fontWeight:700,color:'#185FA5'}}>{data.management.score}</div>
                    <ScoreBar value={data.management.score*10} color='#185FA5' />
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>out of 10</div>
                  </div>
                  <InfoRow label="Capital Allocation" val={data.management.capitalAllocationRating} />
                  <InfoRow label="Promoter Stake" val={`${data.management.promoterStake}%`} />
                  <InfoRow label="Pledged Shares" val={`${data.management.pledgedShares}%`} color={data.management.pledgedShares>5?'#A32D2D':'#22543D'} />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📖 Background</div>
                  <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7}}>{data.management.background}</p>
                </div>
              </TwoCol>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>✅ Green Flags</div>
                  {data.management.greenFlags?.map((f,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <span style={{color:'#22543D',flexShrink:0}}>✓</span><span style={{color:'var(--muted)'}}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>🚩 Red Flags</div>
                  {data.management.redFlags?.map((f,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <span style={{color:'#A32D2D',flexShrink:0}}>✗</span><span style={{color:'var(--muted)'}}>{f}</span>
                    </div>
                  ))}
                </div>
              </TwoCol>
              {/* Shareholding */}
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>🥧 Shareholding Pattern</div>
                  <ChartComp type="doughnut" data={{
                    labels:['Promoter','FII','DII','Public'],
                    datasets:[{data:[data.shareholding.current.promoter,data.shareholding.current.fii,data.shareholding.current.dii,data.shareholding.current.public],
                      backgroundColor:['#0B1E3D','#185FA5','#1D9E75','#BA7517'],borderWidth:3}]
                  }} height={200} />
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>📉 FII / DII Trend</div>
                  <ChartComp type="line" data={{
                    labels: data.shareholding.trend.map(d=>d.quarter),
                    datasets:[
                      { label:'FII %', data: data.shareholding.trend.map(d=>d.fii), borderColor:'#1D9E75', tension:0.3, pointRadius:4 },
                      { label:'DII %', data: data.shareholding.trend.map(d=>d.dii), borderColor:'#185FA5', tension:0.3, pointRadius:4 },
                      { label:'Promoter %', data: data.shareholding.trend.map(d=>d.promoter), borderColor:'#0B1E3D', tension:0.3, pointRadius:4 },
                    ]
                  }} height={200} />
                </div>
              </TwoCol>
            </div>
          )}

          {/* ── FORENSIC TAB ── */}
          {tab==='forensic' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:'1rem'}}>
                {data.forensic.checks?.map((c,i)=>(
                  <div key={i} style={{background:STATUS_STYLE[c.status]?.bg||'var(--bg2)',borderRadius:10,padding:'0.875rem',textAlign:'center',border:`1px solid ${STATUS_STYLE[c.status]?.color||'var(--border)'}40`}}>
                    <div style={{fontSize:10,color:'var(--muted)',marginBottom:5}}>{c.metric}</div>
                    <div style={{fontSize:15,fontWeight:700}}>{c.value}</div>
                    <div style={{fontSize:10,fontWeight:600,marginTop:4,color:STATUS_STYLE[c.status]?.color}}>{c.status}</div>
                  </div>
                ))}
              </div>
              <div style={CARD}>
                <div style={CARD_LABEL}>🔬 Forensic Notes</div>
                {data.forensic.checks?.map((c,i)=>(
                  <div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-start'}}>
                    <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10,flexShrink:0,background:STATUS_STYLE[c.status]?.bg,color:STATUS_STYLE[c.status]?.color}}>{c.status}</span>
                    <span style={{fontSize:12,color:'var(--muted)'}}><strong style={{color:'var(--text)'}}>{c.metric}:</strong> {c.note}</span>
                  </div>
                ))}
              </div>
              <div className="grid-2" style={{marginBottom:0}}>
                <div style={CARD}>
                  <div style={CARD_LABEL}>Forensic Score</div>
                  <div style={{textAlign:'center',padding:'0.5rem'}}>
                    <div style={{fontSize:48,fontWeight:700,color:data.forensic.overallScore>=7?'#22543D':data.forensic.overallScore>=5?'#BA7517':'#A32D2D'}}>{data.forensic.overallScore}/10</div>
                    <ScoreBar value={data.forensic.overallScore*10} color='#185FA5' />
                  </div>
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>Key Forensic Metrics</div>
                  <MiniStat label="CFO/PAT Ratio" val={`${data.forensic.cfoPat}x`} />
                  <MiniStat label="Receivable Days" val={`${data.forensic.receivableDays} days`} />
                  <MiniStat label="Inventory Days" val={`${data.forensic.inventoryDays} days`} />
                </div>
              </div>
            </div>
          )}

          {/* ── CONCALL TAB ── */}
          {tab==='concall' && (
            <div>
              <div style={CARD}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                  <div style={CARD_LABEL}>🎙️ Concall Promise vs Delivery</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#185FA5'}}>Credibility: {data.concall.managementCredibility}/10</div>
                </div>
                {data.concall.promises?.map((p,i)=>(
                  <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'flex-start'}}>
                    <span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:10,flexShrink:0,whiteSpace:'nowrap',background:STATUS_STYLE[p.status]?.bg,color:STATUS_STYLE[p.status]?.color}}>{p.status}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{p.promise}</div>
                      <div style={{fontSize:12,color:'var(--muted)'}}>{p.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RISKS TAB ── */}
          {tab==='risks' && (
            <div>
              <div style={CARD}>
                <div style={CARD_LABEL}>⚡ Risk Heatmap</div>
                <div className="grid-2">
                  {data.risks?.map((r,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',background:'var(--bg2)',borderRadius:10,border:`1px solid ${SEVERITY_COLOR(r.severity)}30`}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:SEVERITY_COLOR(r.severity),flexShrink:0,marginTop:5}} />
                      <div>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{r.name}
                          <span style={{fontSize:10,marginLeft:6,padding:'1px 6px',borderRadius:6,background:`${SEVERITY_COLOR(r.severity)}20`,color:SEVERITY_COLOR(r.severity)}}>{r.level}</span>
                        </div>
                        <div style={{fontSize:12,color:'var(--muted)'}}>{r.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={CARD}>
                <div style={CARD_LABEL}>📊 Risk Severity Chart</div>
                <ChartComp type="horizontalBar" data={{
                  labels: data.risks?.map(r=>r.name),
                  datasets:[{ label:'Severity', data: data.risks?.map(r=>r.severity),
                    backgroundColor: data.risks?.map(r=>SEVERITY_COLOR(r.severity)) }]
                }} height={220} />
              </div>
            </div>
          )}

          {/* ── SMART MONEY TAB ── */}
          {tab==='smartmoney' && (
            <div>
              <div className="grid-2">
                {data.smartMoney?.map((inv,i)=>(
                  <div key={i} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'1rem'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:4}}>{inv.investor}</div>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:ACTION_COLOR(inv.action)}}>{inv.action}</div>
                    <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>{inv.reason}</div>
                  </div>
                ))}
              </div>
              <TwoCol>
                <div style={CARD}>
                  <div style={CARD_LABEL}>✅ Top 10 Reasons to BUY</div>
                  {data.buyReasons?.map((r,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                      <span style={{color:'#22543D',fontWeight:700,flexShrink:0}}>{i+1}.</span>
                      <span style={{color:'var(--muted)'}}>{r}</span>
                    </div>
                  ))}
                </div>
                <div style={CARD}>
                  <div style={CARD_LABEL}>❌ Top 10 Reasons to AVOID</div>
                  {data.avoidReasons?.map((r,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                      <span style={{color:'#A32D2D',fontWeight:700,flexShrink:0}}>{i+1}.</span>
                      <span style={{color:'var(--muted)'}}>{r}</span>
                    </div>
                  ))}
                </div>
              </TwoCol>
            </div>
          )}

          {/* ── VERDICT TAB ── */}
          {tab==='verdict' && (
            <div>
              <div style={{background: RATING_BG[data.finalVerdict.rating], border:`1px solid ${RATING_COLOR[data.finalVerdict.rating]}50`, borderRadius:16, padding:'2rem', textAlign:'center', marginBottom:'1rem'}}>
                <div style={{fontSize:40,fontWeight:800,color:RATING_COLOR[data.finalVerdict.rating],marginBottom:6}}>{data.finalVerdict.rating}</div>
                <div style={{fontSize:13,color:RATING_COLOR[data.finalVerdict.rating],marginBottom:'1.25rem'}}>
                  Conviction: {data.finalVerdict.conviction} · Risk: {data.finalVerdict.riskLevel} · Expected CAGR: {data.finalVerdict.expectedCagr3yr}% (3yr)
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:8,flexWrap:'wrap'}}>
                  {[
                    `Entry Zone: ${data.finalVerdict.idealBuyZone}`,
                    `SIP: ${data.finalVerdict.sipSuitable ? '✅ Yes' : '❌ No'}`,
                    `Best For: ${data.finalVerdict.suitableFor}`,
                  ].map((c,i)=>(
                    <span key={i} style={{fontSize:11,padding:'5px 14px',borderRadius:20,background:`${RATING_COLOR[data.finalVerdict.rating]}15`,color:RATING_COLOR[data.finalVerdict.rating]}}>{c}</span>
                  ))}
                </div>
              </div>

              <div className="grid-3">
                {[
                  ['🎯 Key Metric to Track', data.finalVerdict.keyMetricToTrack, '#185FA5'],
                  ['🚀 Re-rating Trigger', data.finalVerdict.reratingTrigger, '#22543D'],
                  ['⚠️ De-rating Trigger', data.finalVerdict.deratingTrigger, '#A32D2D'],
                ].map(([label,val,col])=>(
                  <div key={label} style={{background:'var(--bg2)',borderRadius:12,padding:'1rem',borderLeft:`3px solid ${col}`}}>
                    <div style={{fontSize:11,fontWeight:600,color:col,marginBottom:6}}>{label}</div>
                    <div style={{fontSize:13,lineHeight:1.6}}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={CARD}>
                <div style={CARD_LABEL}>🚪 Exit Signals</div>
                {data.finalVerdict.exitSignals?.map((s,i)=>(
                  <div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                    <span style={{color:'#A32D2D'}}>⚠</span><span style={{color:'var(--muted)'}}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{textAlign:'center',fontSize:11,color:'var(--muted)',marginTop:'1.5rem',padding:'1rem',background:'var(--bg2)',borderRadius:10}}>
            AI-generated institutional research · {data.company.name} · Not investment advice · Do your own due diligence
          </div>
        </div>
      )}
    </>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────
const CARD = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'0.875rem' };
const CARD_LABEL = { fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:'0.875rem', textTransform:'uppercase', letterSpacing:'0.5px' };
const PILL_LABEL = { fontSize:11, fontWeight:700, color:'#185FA5', background:'#EBF8FF', padding:'2px 8px', borderRadius:6 };
const TABLE = { width:'100%', borderCollapse:'collapse', fontSize:12 };
const TH = { textAlign:'left', padding:'8px 10px', fontWeight:600, fontSize:11, color:'var(--muted)', borderBottom:'1px solid var(--border)' };
const TD = { padding:'8px 10px', borderBottom:'1px solid var(--border)', color:'var(--text)' };

function TwoCol({ children }) {
  return <div className="grid-2">{children}</div>;
}
function ScoreBar({ value, color }) {
  return (
    <div style={{ height:6, background:'var(--bg2)', borderRadius:3, overflow:'hidden', margin:'6px 0' }}>
      <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:3, transition:'width 1s ease' }} />
    </div>
  );
}
function InfoRow({ label, val, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
      <span style={{ color:'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight:600, color:color||'var(--text)' }}>{val}</span>
    </div>
  );
}
function MiniStat({ label, val }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12 }}>
      <span style={{ color:'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight:600 }}>{val}</span>
    </div>
  );
}
