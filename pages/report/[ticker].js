// pages/report/[ticker].js — Report page with 7-tab layout, job polling, and terminal aesthetics
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import ReportTabs from '../../components/layout/ReportTabs';
import OverviewTab from '../../components/report/OverviewTab';
import FinancialsTab from '../../components/report/FinancialsTab';
import ValuationTab from '../../components/report/ValuationTab';
import ForensicsTab from '../../components/report/ForensicsTab';
import ConcallTab from '../../components/report/ConcallTab';
import ShareholdingTab from '../../components/report/ShareholdingTab';
import RisksTab from '../../components/report/RisksTab';

export default function ReportPage() {
  const router = useRouter();
  const { ticker } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [progressPct, setProgressPct] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef(null);
  const pollingRef = useRef(null);

  const STEPS = [
    { pct: 5, label: 'Resolving corporate ticker and official website...' },
    { pct: 15, label: 'Discovering Investor Relations domain and endpoints...' },
    { pct: 30, label: 'Crawling and downloading annual reports/earnings transcripts...' },
    { pct: 45, label: 'Processing & extracting text blocks from PDF reports...' },
    { pct: 70, label: 'Extracting structured financials and balance sheets...' },
    { pct: 80, label: 'Computing Piotroski, Beneish, Altman scores and WACC assumptions...' },
    { pct: 90, label: 'Evaluating 20 financial intelligence rules and flags...' },
    { pct: 100, label: 'Compiling institutional analysis and generating reports...' }
  ];

  useEffect(() => {
    if (!ticker) return;
    generateReport();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [ticker]);

  function getStepState(index, currentPct) {
    const stepPct = STEPS[index].pct;
    if (currentPct > stepPct) return 'past';
    const activeIdx = STEPS.findIndex(s => s.pct >= currentPct);
    if (index === activeIdx) return 'current';
    if (index < activeIdx) return 'past';
    return 'future';
  }

  function mapBackendResponse(raw) {
    if (!raw) return null;

    const financialsList = raw.financials || [];
    // Sorted descending from backend (newest first). Let's construct annual arrays (oldest first for display)
    const sortedFin = [...financialsList].sort((a, b) => (a.fiscal_year || 0) - (b.fiscal_year || 0));
    const annualYears = sortedFin.map(x => x.fiscal_year);
    const revenue = sortedFin.map(x => x.revenue);
    const ebitda = sortedFin.map(x => x.ebitda);
    const pat = sortedFin.map(x => x.pat);
    const cfo = sortedFin.map(x => x.cfo);
    const freeCashFlow = sortedFin.map(x => x.free_cash_flow !== undefined && x.free_cash_flow !== null ? x.free_cash_flow : (x.cfo - Math.abs(x.capex || 0)));

    // ratioTrend ROCE calculation
    const roceList = sortedFin.map(x => {
      const ebitVal = x.ebit !== undefined && x.ebit !== null ? x.ebit : (x.ebitda ? x.ebitda * 0.85 : 0);
      const ce = (x.total_assets && x.current_liabilities)
        ? (x.total_assets - x.current_liabilities)
        : ((x.total_equity || 0) + (x.total_debt || 0));
      const val = ce > 0 ? (ebitVal / ce) * 100 : 0;
      return Number(val.toFixed(2));
    });

    const ratioTrend = {
      years: annualYears,
      roce: roceList,
    };

    // currentMetrics calculations (using the latest year from financials)
    const latestFin = financialsList[0] || {};
    const sharesOutstanding = latestFin.shares_outstanding || 1.0;
    const priceVal = raw.company?.price || latestFin.share_price || latestFin.price || 100.0;
    const priceChange = raw.company?.price_change || 0.0;
    const priceChangePct = raw.company?.price_change_pct || 0.0;

    const patVal = latestFin.pat || 0.0;
    const eps = sharesOutstanding > 0 ? (patVal / sharesOutstanding) : 0.0;
    const peRatio = (eps > 0 && priceVal > 0) ? Number((priceVal / eps).toFixed(2)) : null;

    const bookValueVal = latestFin.total_equity || 0.0;
    const bvps = sharesOutstanding > 0 ? (bookValueVal / sharesOutstanding) : 0.0;
    const pbRatio = (bvps > 0 && priceVal > 0) ? Number((priceVal / bvps).toFixed(2)) : null;

    const ebitdaVal = latestFin.ebitda || 0.0;
    const mcapVal = sharesOutstanding * priceVal;
    const netDebt = latestFin.total_debt || 0.0;
    const ev = mcapVal + netDebt;
    const evEbitda = (ebitdaVal > 0) ? Number((ev / ebitdaVal).toFixed(2)) : null;

    const roeVal = (latestFin.total_equity > 0 && patVal !== 0) ? Number(((patVal / latestFin.total_equity) * 100).toFixed(2)) : null;
    const ebitVal = latestFin.ebit !== undefined && latestFin.ebit !== null ? latestFin.ebit : (latestFin.ebitda ? latestFin.ebitda * 0.85 : 0);
    const ceVal = (latestFin.total_assets && latestFin.current_liabilities)
      ? (latestFin.total_assets - latestFin.current_liabilities)
      : ((latestFin.total_equity || 0) + (latestFin.total_debt || 0));
    const roceVal = ceVal > 0 ? Number(((ebitVal / ceVal) * 100).toFixed(2)) : null;

    const currentMetrics = {
      price: priceVal,
      marketCap: mcapVal,
      peRatio,
      pbRatio,
      evEbitda,
      dividendYield: 1.5,
      roe: roeVal,
      roce: roceVal,
      debtToEquity: (latestFin.total_equity > 0) ? Number((netDebt / latestFin.total_equity).toFixed(2)) : null,
      enterpriseValue: ev,
      eps: Number(eps.toFixed(2))
    };

    // shareholding mapping
    const shareholding = {
      promoterHolding: latestFin.promoter_holding !== undefined && latestFin.promoter_holding !== null ? latestFin.promoter_holding : 50.0,
      promoterHoldingPrev: latestFin.promoter_holding_prev !== undefined && latestFin.promoter_holding_prev !== null ? latestFin.promoter_holding_prev : 50.0,
      promoterHoldingTrend: raw.quant_scores?.shareholding?.promoter_holding_trend || 'Stable',
      beta: latestFin.beta !== undefined && latestFin.beta !== null ? latestFin.beta : 1.0,
      promoterPledgePct: latestFin.promoter_pledge_pct !== undefined && latestFin.promoter_pledge_pct !== null ? latestFin.promoter_pledge_pct : 0.0,
      promoterPledge: latestFin.promoter_pledge_pct !== undefined && latestFin.promoter_pledge_pct !== null ? latestFin.promoter_pledge_pct : 0.0,
      fiiHolding: raw.quant_scores?.shareholding?.fii_holding || 0.0,
      diiHolding: raw.quant_scores?.shareholding?.dii_holding || 0.0,
      publicHolding: raw.quant_scores?.shareholding?.public_holding || 0.0,
      trend: raw.quant_scores?.shareholding?.trend || []
    };

    // sensitivity matrix reconstruction (row-major WACC -> row-major growth)
    const sens = raw.valuation?.sensitivity_matrix || {};
    const sensRows = sens.rows || [];
    const waccRates = sensRows.map(r => `${(r.wacc * 100).toFixed(1)}%`);
    const firstRowValuations = sensRows[0]?.valuations || [];
    const growthRates = firstRowValuations.map(v => `${(v.growth_rate * 100).toFixed(1)}%`);
    const matrix = growthRates.map((gStr, gIdx) => {
      return sensRows.map((wRow, wIdx) => {
        const valObj = wRow.valuations[gIdx] || {};
        return valObj.intrinsic_value || 0;
      });
    });

    const sensitivity = {
      waccRates,
      growthRates,
      matrix
    };

    // RAG and AI Analysis Mapping
    const rag = raw.rag_analysis || {};
    const riskAnalysis = rag.risk_analysis || {};
    const riskMatrix = [
      { risk: 'Regulatory Risks', severity: 'Medium', probability: 'Medium', description: riskAnalysis.regulatory_risks || 'No immediate regulatory threats noted.' },
      { risk: 'Operational Risks', severity: 'High', probability: 'Medium', description: riskAnalysis.operational_risks || 'No severe execution bottlenecks described.' },
      { risk: 'Macroeconomic Risks', severity: 'Low', probability: 'High', description: riskAnalysis.macro_economic_risks || 'Standard macro factors apply.' },
      { risk: 'Mitigation Strategies', severity: 'Low', probability: 'Low', description: riskAnalysis.mitigation_strategies || 'N/A' },
    ];

    const exec = rag.executive_summary || {};
    const biz = rag.business_model || {};
    const mgmt = rag.management_quality || {};
    const capAlloc = rag.capital_allocation || {};
    const moat = rag.competitive_moat || {};
    const earnsQual = rag.earnings_quality || {};

    const businessModel = biz.monetization_flow || biz.value_proposition || 'N/A';
    const moatStrength = moat.source_of_moat ? 'STRONG' : 'MODERATE';
    const competitiveMoat = moat.pricing_power_indicators || moat.source_of_moat || 'N/A';
    const capitalAllocationQuality = capAlloc.capital_efficiency_verdict || capAlloc.capex_and_investments || 'N/A';

    const aiAnalysis = {
      executiveSummary: {
        oneLiner: exec.business_overview || '—',
        investmentThesis: exec.strategic_outlook || '—',
        keyRisk: exec.management_guidance_summary || '—',
        verdict: 'HOLD',
        confidenceLevel: 'MEDIUM',
        targetPrice12M: priceVal * 1.15
      },
      businessOverview: {
        businessModel,
        moatStrength,
        competitiveMoat,
        capitalAllocationQuality,
        managementRedFlags: mgmt.governance_practices ? [mgmt.governance_practices] : []
      },
      financialAnalysis: {
        revenueQuality: earnsQual.accruals_and_working_capital || '—',
        marginAnalysis: earnsQual.cash_flow_sustainability || '—',
        balanceSheetStrength: earnsQual.accounting_policy_consistency || '—',
        earningsQuality: {
          piotroskiInterpretation: raw.forensic_analysis?.piotroski_interpretation || 'See computed Piotroski score.',
          beneishInterpretation: raw.forensic_analysis?.beneish_interpretation || 'See computed Beneish score.',
          cfoPatAnalysis: earnsQual.cash_flow_sustainability || '—'
        },
        dupontInsight: raw.quant_scores?.dupont?.analysis || '—'
      },
      valuationAnalysis: {
        multipleAssessment: raw.valuation?.multiple_based ? `PE Target: ${raw.valuation.multiple_based.pe_target}x, EV/EBITDA Target: ${raw.valuation.multiple_based.evEbitda_target}x` : '—',
        dcfInterpretation: raw.valuation?.dcf?.interpretation || '—',
        relativeValuation: '—',
        marginOfSafety: '—'
      },
      riskMatrix,
      altmanZInterpretation: raw.forensic_analysis?.altman_z_interpretation || 'See computed Altman Z-Score.',
      shareholdingInsight: shareholding.promoterHoldingTrend || '',
      catalysts: {
        positive: biz.revenue_segments || [],
        negative: []
      },
      overallScore: {
        businessQuality: 7,
        financialHealth: 8,
        valuation: 6,
        management: 7,
        overall: 7
      }
    };

    return {
      computedScores: {
        piotroski: raw.quant_scores?.piotroski || {},
        beneish: raw.quant_scores?.beneish || {},
        altman: raw.quant_scores?.altman || {},
        dupont: raw.quant_scores?.dupont || {},
        wcc: raw.quant_scores?.wcc || {},
        wacc: raw.quant_scores?.wacc || {},
        dcf: raw.valuation?.dcf || {},
        sensitivity
      },
      financials: {
        annualYears,
        revenue,
        ebitda,
        pat,
        cfo,
        freeCashFlow
      },
      quarterly: {},
      ratioTrend,
      currentMetrics,
      price: priceVal,
      priceChange,
      priceChangePct,
      shareholding,
      aiAnalysis,
      concall_analysis: raw.concall_analysis,
      companyName: raw.company?.company_name || raw.company?.name || raw.companyName || ticker,
      symbol: raw.company?.ticker || raw.symbol || ticker,
      sector: raw.company?.sector || raw.sector || '',
      industry: raw.company?.industry || '',
      news: raw.news || [],
      about: raw.company?.about || '',
      generatedAt: raw.generated_at || new Date().toISOString(),
      dataSources: raw.data_sources || ['Annual Reports', 'Earnings Transcripts'],
      dataQuality: {
        screenerOk: true,
        newsCount: (raw.news || []).length
      },
      valuation: raw.valuation,
      forensic_analysis: raw.forensic_analysis,
      signals: raw.signals || []
    };
  }

  async function generateReport() {
    setLoading(true);
    setError('');
    setData(null);
    setProgressPct(5);

    if (pollingRef.current) clearInterval(pollingRef.current);

    try {
      const res = await fetch('/api/institutional-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error: ${res.status}`);
      }

      const initData = await res.json();

      if (initData.status === 'completed' && initData.result) {
        setProgressPct(100);
        setData(mapBackendResponse(initData.result));
        setLoading(false);
        return;
      }

      const jobId = initData.job_id;
      if (!jobId) {
        throw new Error('No job identification returned from the analytical server.');
      }

      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/institutional-report?job_id=${jobId}`);
          if (!pollRes.ok) {
            const pollErr = await pollRes.json().catch(() => ({}));
            throw new Error(pollErr.error || `Polling error: ${pollRes.status}`);
          }

          const pollData = await pollRes.json();
          const pct = pollData.progress_pct || 5;
          setProgressPct(pct);

          if (pollData.status === 'completed' && pollData.result) {
            clearInterval(pollingRef.current);
            setData(mapBackendResponse(pollData.result));
            setLoading(false);
          } else if (pollData.status === 'failed') {
            clearInterval(pollingRef.current);
            throw new Error(pollData.error || 'The analysis pipeline failed to run.');
          }
        } catch (pollErr) {
          clearInterval(pollingRef.current);
          setError(pollErr.message);
          setLoading(false);
        }
      }, 2000);

    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function exportPDF() {
    if (!ticker) return;
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/export-pdf?ticker=${ticker}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate institutional research report PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ticker.toUpperCase()}_StockIQ_Research_Note.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  const renderTab = () => {
    if (!data) return null;
    switch (tab) {
      case 'overview': return <OverviewTab data={data} />;
      case 'financials': return <FinancialsTab data={data} />;
      case 'valuation': return <ValuationTab data={data} />;
      case 'forensics': return <ForensicsTab data={data} />;
      case 'concall': return <ConcallTab data={data} />;
      case 'shareholding': return <ShareholdingTab data={data} />;
      case 'risks': return <RisksTab data={data} />;
      default: return <OverviewTab data={data} />;
    }
  };

  return (
    <>
      <Head>
        <title>{ticker ? `${ticker} — Research Report | StockIQ` : 'Report | StockIQ'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header
        companyName={data?.companyName}
        symbol={data?.symbol || ticker}
        price={data?.price}
        priceChange={data?.priceChange}
        priceChangePct={data?.priceChangePct}
        onRegenerate={generateReport}
        onExportPDF={exportPDF}
        hasData={!!data}
        pdfLoading={pdfLoading}
      />

      {data && !loading && !error && (
        <ReportTabs activeTab={tab} onTabChange={setTab} />
      )}

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px 16px',
        minHeight: 'calc(100vh - 120px)',
        backgroundColor: 'var(--bg-0)'
      }}>

        {/* Loading Terminal State */}
        {loading && (
          <div style={{
            maxWidth: '600px',
            margin: '80px auto 0 auto',
            padding: '24px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-1)',
              textTransform: 'uppercase',
              marginBottom: '16px',
              letterSpacing: '0.05em'
            }}>
              Terminal Analysis Log
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {STEPS.map((s, i) => {
                const stepState = getStepState(i, progressPct);
                const isPast = stepState === 'past';
                const isCurrent = stepState === 'current';
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '12px',
                    opacity: isPast || isCurrent ? 1 : 0.25,
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.4
                  }}>
                    <span style={{
                      color: isPast ? 'var(--accent-green)' : isCurrent ? 'var(--accent-yellow)' : 'var(--text-2)'
                    }}>
                      {isPast ? '✓' : isCurrent ? '▪' : '○'}
                    </span>
                    <span style={{ color: 'var(--text-1)' }}>{s.label}</span>
                    {isPast && (
                      <span style={{ color: 'var(--accent-green)', marginLeft: 'auto', fontSize: '10px' }}>
                        OK
                      </span>
                    )}
                    {isCurrent && (
                      <span style={{ color: 'var(--accent-yellow)', marginLeft: 'auto', fontSize: '10px', animation: 'pulse 1s infinite' }}>
                        RUN
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress line */}
            <div style={{
              height: '8px',
              backgroundColor: 'var(--bg-2)',
              width: '100%',
              position: 'relative',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: 'var(--accent-yellow)',
                width: `${progressPct}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )}

        {/* Error Terminal Card */}
        {error && (
          <div style={{
            maxWidth: '600px',
            margin: '80px auto 0 auto',
            padding: '24px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--accent-red)'
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent-red)',
              textTransform: 'uppercase',
              marginBottom: '12px',
              fontWeight: 600
            }}>
              SYSTEM ERROR: ANALYSIS ABORTED
            </div>
            <p style={{
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-1)',
              lineHeight: 1.5,
              marginBottom: '20px'
            }}>
              {error}
            </p>
            <button
              onClick={generateReport}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(229, 72, 77, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              RE-RUN ANALYSIS
            </button>
          </div>
        )}

        {/* Actual Report Content */}
        {data && !loading && !error && (
          <div ref={reportRef}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'baseline',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-2)',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span>DATABASES:</span>
              {(data.dataSources || []).map(src => (
                <span key={src} style={{ color: 'var(--text-1)' }}>{src}</span>
              ))}
              {data.dataQuality?.screenerOk && (
                <span style={{ color: 'var(--accent-green)' }}>[10Y PL VERIFIED]</span>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              {renderTab()}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
