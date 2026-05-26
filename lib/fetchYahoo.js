// lib/fetchYahoo.js
// Fetches live price, ratios, market cap from Yahoo Finance — FREE, no API key

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

// Map company names to NSE symbols for Yahoo Finance (append .NS)
const NAME_TO_SYMBOL = {
  'reliance industries': 'RELIANCE.NS',
  'reliance': 'RELIANCE.NS',
  'hdfc bank': 'HDFCBANK.NS',
  'tcs': 'TCS.NS',
  'tata consultancy': 'TCS.NS',
  'infosys': 'INFY.NS',
  'zomato': 'ZOMATO.NS',
  'bajaj finance': 'BAJFINANCE.NS',
  'tata motors': 'TATAMOTORS.NS',
  'icici bank': 'ICICIBANK.NS',
  'asian paints': 'ASIANPAINT.NS',
  'sun pharma': 'SUNPHARMA.NS',
  'sun pharmaceutical': 'SUNPHARMA.NS',
  'maruti': 'MARUTI.NS',
  'maruti suzuki': 'MARUTI.NS',
  'kotak mahindra': 'KOTAKBANK.NS',
  'kotak bank': 'KOTAKBANK.NS',
  'hul': 'HINDUNILVR.NS',
  'hindustan unilever': 'HINDUNILVR.NS',
  'wipro': 'WIPRO.NS',
  'adani ports': 'ADANIPORTS.NS',
  'adani enterprises': 'ADANIENT.NS',
  'ongc': 'ONGC.NS',
  'ntpc': 'NTPC.NS',
  'power grid': 'POWERGRID.NS',
  'sbi': 'SBIN.NS',
  'state bank': 'SBIN.NS',
  'axis bank': 'AXISBANK.NS',
  'l&t': 'LT.NS',
  'larsen': 'LT.NS',
  'titan': 'TITAN.NS',
  'nestle': 'NESTLEIND.NS',
  'ultratech': 'ULTRACEMCO.NS',
  'bharti airtel': 'BHARTIARTL.NS',
  'airtel': 'BHARTIARTL.NS',
  'divis lab': 'DIVISLAB.NS',
  'cipla': 'CIPLA.NS',
  'dr reddy': 'DRREDDY.NS',
  'bajaj auto': 'BAJAJ-AUTO.NS',
  'hero motocorp': 'HEROMOTOCO.NS',
  'm&m': 'M&M.NS',
  'mahindra': 'M&M.NS',
  'tata steel': 'TATASTEEL.NS',
  'jsw steel': 'JSWSTEEL.NS',
  'hindalco': 'HINDALCO.NS',
  'vedanta': 'VEDL.NS',
  'coal india': 'COALINDIA.NS',
  'bpcl': 'BPCL.NS',
  'ioc': 'IOC.NS',
  'indian oil': 'IOC.NS',
  'pidilite': 'PIDILITIND.NS',
  'dabur': 'DABUR.NS',
  'godrej consumer': 'GODREJCP.NS',
  'berger paints': 'BERGEPAINT.NS',
  'havells': 'HAVELLS.NS',
  'voltas': 'VOLTAS.NS',
  'dmart': 'DMART.NS',
  'avenue supermarts': 'DMART.NS',
  'nykaa': 'NYKAA.NS',
  'paytm': 'PAYTM.NS',
  'policybazaar': 'POLICYBZR.NS',
  'irctc': 'IRCTC.NS',
  'hdfclife': 'HDFCLIFE.NS',
  'sbi life': 'SBILIFE.NS',
  'icici lombard': 'ICICIGI.NS',
  'muthoot finance': 'MUTHOOTFIN.NS',
  'cholamandalam': 'CHOLAFIN.NS',
  'shriram finance': 'SHRIRAMFIN.NS',
};

export function guessSymbol(companyName) {
  const lower = companyName.toLowerCase().trim();
  // Direct match
  if (NAME_TO_SYMBOL[lower]) return NAME_TO_SYMBOL[lower];
  // Partial match
  for (const [key, sym] of Object.entries(NAME_TO_SYMBOL)) {
    if (lower.includes(key) || key.includes(lower)) return sym;
  }
  // Fallback: uppercase + .NS (works for many NSE symbols)
  return companyName.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9&-]/g, '') + '.NS';
}

export async function fetchYahooData(companyName) {
  const symbol = guessSymbol(companyName);
  console.log(`[Yahoo] Fetching ${symbol} for "${companyName}"`);

  try {
    const [quote, summary] = await Promise.allSettled([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory']
      })
    ]);

    const q = quote.status === 'fulfilled' ? quote.value : null;
    const s = summary.status === 'fulfilled' ? summary.value : null;

    if (!q && !s) {
      console.warn(`[Yahoo] No data for ${symbol}`);
      return null;
    }

    const fin = s?.financialData || {};
    const det = s?.summaryDetail || {};
    const stat = s?.defaultKeyStatistics || {};

    // Extract income statement history (last 4 years)
    const incomeHistory = s?.incomeStatementHistory?.incomeStatementHistory || [];
    const revenueHistory = incomeHistory.map(y => ({
      year: new Date(y.endDate).getFullYear(),
      revenue: Math.round((y.totalRevenue?.raw || 0) / 1e7), // convert to Cr
      ebitda: Math.round(((y.ebit?.raw || 0) + (y.depreciation?.raw || 0)) / 1e7),
      pat: Math.round((y.netIncome?.raw || 0) / 1e7),
    })).reverse();

    return {
      symbol,
      name: q?.longName || q?.shortName || companyName,
      // Live price data
      price: {
        current: q?.regularMarketPrice || null,
        change: q?.regularMarketChange?.toFixed(2) || null,
        changePct: q?.regularMarketChangePercent?.toFixed(2) || null,
        open: q?.regularMarketOpen || null,
        high52w: q?.fiftyTwoWeekHigh || null,
        low52w: q?.fiftyTwoWeekLow || null,
        volume: q?.regularMarketVolume || null,
        avgVolume: q?.averageDailyVolume3Month || null,
      },
      // Market cap & valuation
      valuation: {
        marketCapCr: q?.marketCap ? Math.round(q.marketCap / 1e7) : null,
        pe: det?.trailingPE?.raw || q?.trailingPE || null,
        forwardPe: det?.forwardPE?.raw || q?.forwardPE || null,
        pb: stat?.priceToBook?.raw || null,
        evEbitda: stat?.enterpriseToEbitda?.raw || null,
        dividendYield: (det?.dividendYield?.raw || 0) * 100,
        eps: stat?.trailingEps?.raw || null,
      },
      // Financial ratios
      ratios: {
        roe: fin?.returnOnEquity?.raw ? (fin.returnOnEquity.raw * 100).toFixed(1) : null,
        roa: fin?.returnOnAssets?.raw ? (fin.returnOnAssets.raw * 100).toFixed(1) : null,
        debtToEquity: fin?.debtToEquity?.raw ? (fin.debtToEquity.raw / 100).toFixed(2) : null,
        currentRatio: fin?.currentRatio?.raw?.toFixed(2) || null,
        grossMargin: fin?.grossMargins?.raw ? (fin.grossMargins.raw * 100).toFixed(1) : null,
        ebitdaMargin: fin?.ebitdaMargins?.raw ? (fin.ebitdaMargins.raw * 100).toFixed(1) : null,
        netMargin: fin?.profitMargins?.raw ? (fin.profitMargins.raw * 100).toFixed(1) : null,
        revenueGrowth: fin?.revenueGrowth?.raw ? (fin.revenueGrowth.raw * 100).toFixed(1) : null,
        earningsGrowth: fin?.earningsGrowth?.raw ? (fin.earningsGrowth.raw * 100).toFixed(1) : null,
        freeCashflow: fin?.freeCashflow?.raw ? Math.round(fin.freeCashflow.raw / 1e7) : null,
      },
      // Historical financials (last 4 years from income statements)
      history: revenueHistory,
      // Exchange info
      exchange: q?.exchange || 'NSE',
      sector: q?.sector || null,
      industry: q?.industry || null,
      currency: q?.currency || 'INR',
      fetchedAt: new Date().toISOString(),
      source: 'yahoo-finance2',
    };
  } catch (err) {
    console.error(`[Yahoo] Error for ${symbol}:`, err.message);
    return null;
  }
}
