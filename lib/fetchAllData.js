// lib/fetchAllData.js
// Master orchestrator — fetches Yahoo + Screener + NSE + News in parallel
// Merges into a standardized structure for quant scoring

import { fetchYahooData } from './fetchYahoo.js';
import { fetchScreenerData } from './fetchScreener.js';
import { fetchNSEPrice, fetchNews } from './fetchNSE.js';

export async function fetchAllData(companyName, newsApiKey = null) {
  console.log(`\n[fetchAllData] Starting parallel fetch for: "${companyName}"`);
  const t0 = Date.now();

  const [yahoo, screener, nse, news] = await Promise.allSettled([
    fetchYahooData(companyName),
    fetchScreenerData(companyName),
    fetchNSEPrice(companyName),
    fetchNews(companyName, newsApiKey),
  ]);

  const y = yahoo.status === 'fulfilled' ? yahoo.value : null;
  const s = screener.status === 'fulfilled' ? screener.value : null;
  const n = nse.status === 'fulfilled' ? nse.value : null;
  const newsItems = news.status === 'fulfilled' ? news.value : [];

  console.log(`[fetchAllData] Done in ${Date.now() - t0}ms — Yahoo:${!!y} Screener:${!!s} NSE:${!!n} News:${newsItems.length}`);
  // ── Merge into standardized financial data ──────────────────────────────────
  const sanitize = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v));
  };

  // Use Screener 10-year data as primary, fill gaps with Yahoo 4-year data
  const plYears = s?.financials?.profitLoss?.years || y?.annual?.years || [];
  const bsYears = s?.financials?.balanceSheet?.years || [];

  // Helper: merge arrays (Screener is full 10yr, Yahoo is 4yr backup)
  function mergeArr(screenerArr, yahooArr) {
    if (screenerArr?.length) return sanitize(screenerArr);
    return sanitize(yahooArr || []);
  }

  // P&L data (newest last in Screener, newest first in Yahoo — normalize to newest first)
  const screenerRev = [...(s?.financials?.profitLoss?.revenue || [])].reverse();
  const screenerEbitda = [...(s?.financials?.profitLoss?.ebitda || [])].reverse();
  const screenerPat = [...(s?.financials?.profitLoss?.pat || [])].reverse();
  const screenerEps = [...(s?.financials?.profitLoss?.eps || [])].reverse();
  const screenerDep = [...(s?.financials?.profitLoss?.depreciation || [])].reverse();

  // Balance sheet (newest last in Screener — reverse)
  const screenerBorr = [...(s?.financials?.balanceSheet?.borrowings || [])].reverse();
  const screenerTA = [...(s?.financials?.balanceSheet?.totalAssets || [])].reverse();
  const screenerRecv = [...(s?.financials?.balanceSheet?.tradeReceivables || [])].reverse();
  const screenerInv = [...(s?.financials?.balanceSheet?.inventory || [])].reverse();
  const screenerPayables = [...(s?.financials?.balanceSheet?.tradePayables || [])].reverse();
  const screenerEq = [...(s?.financials?.balanceSheet?.equity || [])].reverse();
  const screenerRes = [...(s?.financials?.balanceSheet?.reserves || [])].reverse();

  // Cash flow (newest last in Screener — reverse)
  const screenerCFO = [...(s?.financials?.cashFlow?.operating || [])].reverse();
  const screenerCFI = [...(s?.financials?.cashFlow?.investing || [])].reverse();

  // Compute derived fields
  const totalEquity = screenerEq.map((eq, i) => {
    const res = screenerRes[i] || 0;
    if (eq === null || eq === undefined) return null;
    return (eq || 0) + (res || 0);
  });

  const freeCashFlow = screenerCFO.map((cfo, i) => {
    const capex = Math.abs(screenerCFI[i] || 0);
    if (cfo === null || cfo === undefined) return null;
    return (cfo || 0) - capex;
  });

  // Current price
  const currentPrice =
    n?.price?.lastPrice ||
    y?.price?.current ||
    s?.ratios?.currentPrice ||
    null;

  const marketCapCr =
    s?.ratios?.marketCap ||
    y?.valuation?.marketCapCr ||
    null;

  // ── Build the quantitative data structure ──────────────────────────────────
  // All arrays are newest-first (index 0 = latest year)
  const quantData = {
    // Identifiers
    companyName: s?.name || y?.name || companyName,
    symbol: y?.symbol || n?.symbol || '',
    sector: y?.sector || '',
    industry: y?.industry || '',

    // Price & market
    price: currentPrice,
    priceChange: n?.price?.change || y?.price?.change,
    priceChangePct: n?.price?.changePct || y?.price?.changePct,
    high52w: n?.price?.high52 || y?.price?.high52w,
    low52w: n?.price?.low52 || y?.price?.low52w,
    marketCap: marketCapCr,
    beta: y?.valuation?.beta || 1.0,

    // Annual financials (newest first)
    revenue: mergeArr(screenerRev, y?.annual?.revenue),
    ebitda: mergeArr(screenerEbitda, y?.annual?.ebitda),
    pat: mergeArr(screenerPat, y?.annual?.pat),
    cfo: mergeArr(screenerCFO, y?.cashflow?.cfo),
    freeCashFlow: freeCashFlow.length ? sanitize(freeCashFlow) : sanitize(y?.cashflow?.freeCashFlow || []),
    depreciation: mergeArr(screenerDep, y?.annual?.depreciation),
    cogs: sanitize(y?.annual?.cogs || []),
    sgna: sanitize(y?.annual?.sgna || []),
    ebit: sanitize(y?.annual?.ebit || []),

    // Balance sheet (newest first)
    totalAssets: mergeArr(screenerTA, y?.balance?.totalAssets),
    currentAssets: sanitize(y?.balance?.currentAssets || []),
    currentLiabilities: sanitize(y?.balance?.currentLiabilities || []),
    totalDebt: mergeArr(screenerBorr, y?.balance?.totalDebt),
    totalEquity: totalEquity.length && totalEquity[0] !== null ? sanitize(totalEquity) : sanitize(y?.balance?.totalEquity || []),
    retainedEarnings: sanitize(y?.balance?.retainedEarnings || []),
    tradeReceivables: mergeArr(screenerRecv, y?.balance?.tradeReceivables),
    inventory: mergeArr(screenerInv, y?.balance?.inventory),
    tradePayables: sanitize(screenerPayables),
    cash: sanitize(y?.balance?.cash || []),
    ppe: sanitize(y?.balance?.ppe || []),
    sharesOutstanding: y?.valuation?.sharesOutstanding ? [y.valuation.sharesOutstanding, y.valuation.sharesOutstanding] : [1, 1],

    // Current metrics
    currentMetrics: {
      price: currentPrice,
      marketCap: marketCapCr,
      peRatio: s?.ratios?.pe || y?.valuation?.pe,
      pbRatio: s?.ratios?.pb || y?.valuation?.pb,
      evEbitda: y?.valuation?.evEbitda,
      dividendYield: s?.ratios?.dividendYield || y?.valuation?.dividendYield,
      roe: s?.ratios?.roe || y?.ratios?.roe,
      roce: s?.ratios?.roce,
      debtToEquity: s?.ratios?.debtEquity || y?.ratios?.debtToEquity,
      currentRatio: y?.ratios?.currentRatio,
      enterpriseValue: y?.valuation?.enterpriseValue,
      eps: s?.ratios?.eps || y?.valuation?.eps,
    },

    // Quarterly (newest last from Screener — keep as-is for display)
    quarterly: {
      quarters: s?.financials?.quarterly?.quarters || [],
      revenue: s?.financials?.quarterly?.revenue || [],
      pat: s?.financials?.quarterly?.pat || [],
      ebitda: s?.financials?.quarterly?.ebitda || [],
      ebitdaMargin: s?.financials?.quarterly?.ebitdaMargin || [],
    },

    // Ratio trends
    ratioTrend: {
      years: s?.keyRatioTable?.years || [],
      roe: s?.keyRatioTable?.roe || [],
      roce: s?.keyRatioTable?.roce || [],
      debtEquity: s?.keyRatioTable?.debtEquity || [],
    },

    // Annual years labels (newest last from Screener)
    annualYears: [...plYears].reverse(),

    // Shareholding
    shareholding: {
      promoterHolding: s?.shareholding?.promoter || 0,
      promoterPledge: s?.shareholding?.promoterPledge || 0,
      fiiHolding: s?.shareholding?.fii || 0,
      diiHolding: s?.shareholding?.dii || 0,
      publicHolding: s?.shareholding?.public || 0,
      trend: s?.shareholding?.trend || [],
    },

    // News
    news: newsItems.slice(0, 8),
    about: s?.about || '',

    // Data quality
    meta: {
      sources: [y && 'Yahoo Finance', s && 'Screener.in', n && 'NSE India', newsItems.length && 'Google News'].filter(Boolean),
      fetchedAt: new Date().toISOString(),
    },
    dataQuality: {
      yahooOk: !!y,
      screenerOk: !!s,
      nseOk: !!n,
      newsCount: newsItems.length,
    },
  };

  return quantData;
}
