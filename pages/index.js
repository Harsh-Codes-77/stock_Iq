import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const POPULAR = [
  'Reliance Industries','HDFC Bank','TCS','Infosys','Zomato',
  'Bajaj Finance','Tata Motors','ICICI Bank','Asian Paints','Sun Pharma'
];
const SECTORS = [
  '','Banking & Finance','IT & Technology','Pharmaceuticals','FMCG',
  'Auto & Auto Ancillary','Infrastructure & Capital Goods','Energy & Oil & Gas',
  'Metals & Mining','Real Estate','Telecom','Chemicals & Specialty'
];

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [sector, setSector] = useState('');
  const [price, setPrice] = useState('');
  const [marketCap, setMarketCap] = useState('');
  const [hoveredChip, setHoveredChip] = useState('');

  function handleAnalyze() {
    if (!company.trim()) return;
    const params = new URLSearchParams({ company: company.trim() });
    if (sector) params.set('sector', sector);
    if (price) params.set('price', price);
    if (marketCap) params.set('marketCap', marketCap);
    router.push('/report?' + params.toString());
  }

  return (
    <>
      <Head>
        <title>StockIQ — Institutional Research for NSE/BSE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{minHeight:'100vh',padding:'1rem',maxWidth:900,margin:'0 auto'}}>

        {/* NAV */}
        <div className="mobile-stack mobile-card-padding" style={{background:'#0B1E3D',borderRadius:16,padding:'1.25rem 1.5rem',marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>📊</span>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:'#fff'}}>StockIQ</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>Institutional Research · NSE · BSE</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[['NSE','#1A3A5C','#5FA8D3'],['BSE','#1C2E1C','#5CB85C'],['Gemini Free','#2E1C3A','#B87DD4']].map(([t,bg,col])=>(
              <span key={t} style={{fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:20,background:bg,color:col}}>{t}</span>
            ))}
          </div>
        </div>

        {/* HERO */}
        <div style={{textAlign:'center',padding:'2rem 1rem 1.5rem'}}>
          <div className="mobile-text-lg" style={{fontSize:30,fontWeight:700,letterSpacing:'-0.5px',marginBottom:10}}>Hedge Fund Grade Research</div>
          <div style={{fontSize:14,color:'var(--muted)',lineHeight:1.8}}>
            Full institutional report — 20+ charts, DCF valuation, forensic accounting,<br className="mobile-hide"/>
            management quality, smart money analysis & PDF export. Free for family & friends.
          </div>
        </div>

        {/* SEARCH */}
        <div className="mobile-card-padding" style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:'1.5rem',marginBottom:'1.5rem',boxShadow:'0 2px 16px rgba(0,0,0,0.06)'}}>
          <div className="mobile-stack" style={{display:'flex',gap:10,marginBottom:12}}>
            <div style={{flex:1,position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:16}}>🔍</span>
              <input
                style={{width:'100%',padding:'12px 14px 12px 40px',border:'1.5px solid var(--border)',borderRadius:10,fontSize:14,background:'var(--bg)',color:'var(--text)',outline:'none'}}
                type="text"
                placeholder="Enter company — e.g. Reliance Industries, HDFC Bank, Infosys..."
                value={company}
                onChange={e=>setCompany(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleAnalyze()}
              />
            </div>
            <button
              onClick={handleAnalyze}
              style={{background:'#0B1E3D',color:'#fff',border:'none',borderRadius:10,padding:'12px 24px',fontSize:14,fontWeight:600,whiteSpace:'nowrap'}}
            >Analyze →</button>
          </div>

          <div className="grid-3" style={{marginBottom:14}}>
            {[
              ['Sector (optional)', <select style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,background:'var(--bg)',color:'var(--text)',outline:'none'}} value={sector} onChange={e=>setSector(e.target.value)}>{SECTORS.map(s=><option key={s} value={s}>{s||'Auto-detect'}</option>)}</select>],
              ['Current Price ₹', <input style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,background:'var(--bg)',color:'var(--text)',outline:'none'}} type="number" placeholder="e.g. 2450" value={price} onChange={e=>setPrice(e.target.value)} />],
              ['Market Cap ₹ Cr', <input style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,background:'var(--bg)',color:'var(--text)',outline:'none'}} type="text" placeholder="e.g. 1500000" value={marketCap} onChange={e=>setMarketCap(e.target.value)} />],
            ].map(([label,input])=>(
              <div key={label}><label style={{fontSize:11,color:'var(--muted)',display:'block',marginBottom:4}}>{label}</label>{input}</div>
            ))}
          </div>

          <div className="grid-popular">
            <span style={{fontSize:11,color:'var(--muted)'}}>Popular:</span>
            {POPULAR.map(name=>(
              <span key={name}
                onClick={()=>setCompany(name)}
                style={{fontSize:11,padding:'4px 12px',border:`1px solid ${hoveredChip===name?'#185FA5':'var(--border)'}`,borderRadius:20,cursor:'pointer',color:hoveredChip===name?'#185FA5':'var(--muted)',background:'var(--bg2)',transition:'all 0.15s'}}
                onMouseEnter={()=>setHoveredChip(name)}
                onMouseLeave={()=>setHoveredChip('')}
              >{name}</span>
            ))}
          </div>
        </div>

        {/* FEATURES */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginBottom:'2rem'}}>
          {[
            ['📈','20+ Charts','Revenue, EBITDA, PAT, margins, ratios, shareholding — all visual'],
            ['🔬','Forensic Check','CFO/PAT, working capital stress, red flags, auditor quality'],
            ['💰','DCF Valuation','Bear/Base/Bull + sensitivity matrix + 1/3/5 yr price targets'],
            ['🧠','Smart Money','Buffett, Jhunjhunwala, Peter Lynch perspective analysis'],
            ['📋','Concall Tracker','Management promises vs actual delivery — with credibility score'],
            ['📄','PDF Export','Download full institutional report as PDF one click'],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{title}</div>
              <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{textAlign:'center',fontSize:11,color:'var(--muted)',paddingBottom:'2rem'}}>
          Built for personal use · Powered by Google Gemini (Free) · Not investment advice
        </div>
      </div>
    </>
  );
}
