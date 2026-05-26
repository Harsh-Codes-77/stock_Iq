// lib/fetchAllData.js
// Master orchestrator — runs all free API calls in parallel, combines results
// Yahoo Finance + Screener.in + NSE + Google News → single rich data object

import { fetchYahooData } from './fetchYahoo.js';
import { fetchScreenerData } from './fetchScreener.js';
import { fetchNSEPrice, fetchNews } from './fetchNSE.js';

export async function fetchAllData(companyName, newsApiKey = null) {
  console.log(`\n[fetchAllData] Starting parallel fetch for: "${companyName}"`);
  const t0 = Date.now();

  // Run all fetches in parallel — don't wait for one before starting another
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

  // ── Merge: prefer Screener (most accurate for Indian cos) then Yahoo then NSE ──

  const currentPrice =
    n?.price?.lastPrice ||
    y?.price?.current ||
    s?.ratios?.currentPrice ||
    null;

  const marketCapCr =
    s?.ratios?.marketCap ||    // Screener gives in Cr already
    y?.valuation?.marketCapCr ||
    null;

  // Build clean merged object to inject into Claude prompt
  return {
    meta: {
      companyName: s?.name || y?.name || companyName,
      symbol: y?.symbol || n?.symbol || '',
      sector: y?.sector || '',
      industry: y?.industry || '',
      exchange: 'NSE/BSE',
      isin: n?.isin || '',
      fetchedAt: new Date().toISOString(),
      sources: [y && 'Yahoo Finance', s && 'Screener.in', n && 'NSE India', newsItems.length && 'Google News'].filter(Boolean),
    },
    price: {
      current: currentPrice,
      change: n?.price?.change || y?.price?.change,
      changePct: n?.price?.changePct || y?.price?.changePct,
      open: n?.price?.open || y?.price?.open,
      high52w: n?.price?.high52 || y?.price?.high52w,
      low52w: n?.price?.low52 || y?.price?.low52w,
      vwap: n?.price?.vwap,
      deliveryPct: n?.deliveryPct,
      volume: n?.volume || y?.price?.volume,
    },
    marketCap: {
      crores: marketCapCr,
      display: marketCapCr ? formatMarketCap(marketCapCr) : 'N/A',
    },
    valuation: {
      pe: s?.ratios?.pe || y?.valuation?.pe,
      forwardPe: y?.valuation?.forwardPe,
      pb: s?.ratios?.pb || y?.valuation?.pb,
      evEbitda: y?.valuation?.evEbitda,
      eps: s?.ratios?.eps || y?.valuation?.eps,
      dividendYield: s?.ratios?.dividendYield || y?.valuation?.dividendYield,
      bookValue: s?.ratios?.bookValue,
    },
    ratios: {
      roe: s?.ratios?.roe || y?.ratios?.roe,
      roce: s?.ratios?.roce,
      roa: y?.ratios?.roa,
      debtToEquity: s?.ratios?.debtEquity || y?.ratios?.debtToEquity,
      currentRatio: y?.ratios?.currentRatio,
      grossMargin: y?.ratios?.grossMargin,
      ebitdaMargin: y?.ratios?.ebitdaMargin || latestVal(s?.financials?.profitLoss?.ebitdaMargin),
      netMargin: y?.ratios?.netMargin,
      revenueGrowth: y?.ratios?.revenueGrowth,
      earningsGrowth: y?.ratios?.earningsGrowth,
      freeCashflowCr: y?.ratios?.freeCashflow,
    },
    // 10-year P&L from Screener
    financials: {
      years: s?.financials?.profitLoss?.years || [],
      revenue: s?.financials?.profitLoss?.revenue || [],
      ebitda: s?.financials?.profitLoss?.ebitda || [],
      ebitdaMarginPct: s?.financials?.profitLoss?.ebitdaMargin || [],
      pat: s?.financials?.profitLoss?.pat || [],
      eps: s?.financials?.profitLoss?.eps || [],
      // Balance sheet
      borrowings: s?.financials?.balanceSheet?.borrowings || [],
      totalAssets: s?.financials?.balanceSheet?.totalAssets || [],
      // Cash flow
      operatingCF: s?.financials?.cashFlow?.operating || [],
      investingCF: s?.financials?.cashFlow?.investing || [],
      financingCF: s?.financials?.cashFlow?.financing || [],
      // Quarterly
      quarters: s?.financials?.quarterly?.quarters || [],
      qRevenue: s?.financials?.quarterly?.revenue || [],
      qPat: s?.financials?.quarterly?.pat || [],
      qEbitda: s?.financials?.quarterly?.ebitda || [],
      qEbitdaMargin: s?.financials?.quarterly?.ebitdaMargin || [],
      // Historical from Yahoo (fallback)
      yahooHistory: y?.history || [],
    },
    // ROE/ROCE trend
    ratioTrend: {
      years: s?.keyRatioTable?.years || [],
      roe: s?.keyRatioTable?.roe || [],
      roce: s?.keyRatioTable?.roce || [],
      debtEquity: s?.keyRatioTable?.debtEquity || [],
    },
    shareholding: {
      promoter: s?.shareholding?.promoter,
      fii: s?.shareholding?.fii,
      dii: s?.shareholding?.dii,
      public: s?.shareholding?.public,
    },
    news: newsItems.slice(0, 8),
    about: s?.about || '',
    dataQuality: {
      yahooOk: !!y,
      screenerOk: !!s,
      nseOk: !!n,
      newsCount: newsItems.length,
    },
  };
}

function latestVal(arr) {
  if (!arr || !arr.length) return null;
  return arr[arr.length - 1];
}

function formatMarketCap(crores) {
  if (crores >= 100000) return `₹${(crores / 100000).toFixed(1)}L Cr`;
  if (crores >= 1000) return `₹${(crores / 1000).toFixed(1)}K Cr`;
  return `₹${crores} Cr`;
}
