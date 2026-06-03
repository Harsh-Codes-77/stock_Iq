// lib/fetchYahoo.js
// Fetches live price, ratios, market cap, balance sheet data from Yahoo Finance

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

// ── Symbol lookup ──────────────────────────────────────────────────────────────
const NAME_TO_SYMBOL = {
  'reliance industries': 'RELIANCE.NS', 'reliance': 'RELIANCE.NS',
  'hdfc bank': 'HDFCBANK.NS', 'tcs': 'TCS.NS', 'tata consultancy': 'TCS.NS',
  'infosys': 'INFY.NS', 'zomato': 'ZOMATO.NS', 'bajaj finance': 'BAJFINANCE.NS',
  'tata motors': 'TATAMOTORS.NS', 'icici bank': 'ICICIBANK.NS',
  'asian paints': 'ASIANPAINT.NS', 'sun pharma': 'SUNPHARMA.NS',
  'sun pharmaceutical': 'SUNPHARMA.NS', 'maruti': 'MARUTI.NS',
  'maruti suzuki': 'MARUTI.NS', 'kotak mahindra': 'KOTAKBANK.NS',
  'kotak bank': 'KOTAKBANK.NS', 'hul': 'HINDUNILVR.NS',
  'hindustan unilever': 'HINDUNILVR.NS', 'wipro': 'WIPRO.NS',
  'adani ports': 'ADANIPORTS.NS', 'adani enterprises': 'ADANIENT.NS',
  'ongc': 'ONGC.NS', 'ntpc': 'NTPC.NS', 'power grid': 'POWERGRID.NS',
  'sbi': 'SBIN.NS', 'state bank': 'SBIN.NS', 'axis bank': 'AXISBANK.NS',
  'l&t': 'LT.NS', 'larsen': 'LT.NS', 'titan': 'TITAN.NS',
  'nestle': 'NESTLEIND.NS', 'ultratech': 'ULTRACEMCO.NS',
  'bharti airtel': 'BHARTIARTL.NS', 'airtel': 'BHARTIARTL.NS',
  'divis lab': 'DIVISLAB.NS', 'cipla': 'CIPLA.NS', 'dr reddy': 'DRREDDY.NS',
  'bajaj auto': 'BAJAJ-AUTO.NS', 'hero motocorp': 'HEROMOTOCO.NS',
  'm&m': 'M&M.NS', 'mahindra': 'M&M.NS', 'tata steel': 'TATASTEEL.NS',
  'jsw steel': 'JSWSTEEL.NS', 'hindalco': 'HINDALCO.NS', 'vedanta': 'VEDL.NS',
  'coal india': 'COALINDIA.NS', 'bpcl': 'BPCL.NS', 'ioc': 'IOC.NS',
  'indian oil': 'IOC.NS', 'pidilite': 'PIDILITIND.NS', 'dabur': 'DABUR.NS',
  'godrej consumer': 'GODREJCP.NS', 'berger paints': 'BERGEPAINT.NS',
  'havells': 'HAVELLS.NS', 'voltas': 'VOLTAS.NS', 'dmart': 'DMART.NS',
  'avenue supermarts': 'DMART.NS', 'nykaa': 'NYKAA.NS', 'paytm': 'PAYTM.NS',
  'policybazaar': 'POLICYBZR.NS', 'irctc': 'IRCTC.NS',
  'hdfclife': 'HDFCLIFE.NS', 'sbi life': 'SBILIFE.NS',
  'icici lombard': 'ICICIGI.NS', 'muthoot finance': 'MUTHOOTFIN.NS',
  'cholamandalam': 'CHOLAFIN.NS', 'shriram finance': 'SHRIRAMFIN.NS',
};

export function guessSymbol(companyName) {
  const lower = companyName.toLowerCase().trim();
  // If already has .NS or .BO suffix, use as-is
  if (/\.(NS|BO)$/i.test(companyName)) return companyName.toUpperCase();
  if (NAME_TO_SYMBOL[lower]) return NAME_TO_SYMBOL[lower];
  for (const [key, sym] of Object.entries(NAME_TO_SYMBOL)) {
    if (lower.includes(key) || key.includes(lower)) return sym;
  }
  return companyName.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9&-]/g, '') + '.NS';
}

// ── Convert raw value to ₹ Crore ──────────────────────────────────────────────
function toCr(val) {
  if (!val && val !== 0) return null;
  const raw = typeof val === 'object' ? (val.raw ?? val) : val;
  return Math.round(Number(raw) / 1e7);
}

function rawVal(val) {
  if (!val && val !== 0) return null;
  return typeof val === 'object' ? (val.raw ?? val) : val;
}

// ── Main fetch function ────────────────────────────────────────────────────────
export async function fetchYahooData(companyName) {
  const symbol = guessSymbol(companyName);
  console.log(`[Yahoo] Fetching ${symbol} for "${companyName}"`);

  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Yahoo Finance Timeout')), 10000));
    const [quote, summary] = await Promise.allSettled([
      Promise.race([yahooFinance.quote(symbol), timeoutPromise]),
      Promise.race([
        yahooFinance.quoteSummary(symbol, {
          modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory']
        }),
        timeoutPromise
      ])
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

    // ── Extract annual income statements (last 4 years, newest first) ──
    const incomeStmts = (s?.incomeStatementHistory?.incomeStatementHistory || []).reverse();
    // ── Extract balance sheets ──
    const balanceSheets = (s?.balanceSheetHistory?.balanceSheetHistory || []).reverse();
    // ── Extract cashflow statements ──
    const cashflows = (s?.cashflowStatementHistory?.cashflowStatementHistory || []).reverse();

    // Build annual arrays (newest first = index 0)
    const annualData = {
      years: incomeStmts.map(y => new Date(y.endDate).getFullYear()),
      revenue: incomeStmts.map(y => toCr(y.totalRevenue)),
      ebitda: incomeStmts.map(y => toCr((rawVal(y.ebit) || 0) + (rawVal(y.depreciation) || 0))),
      pat: incomeStmts.map(y => toCr(y.netIncome)),
      depreciation: incomeStmts.map(y => toCr(y.depreciation)),
      cogs: incomeStmts.map(y => toCr(y.costOfRevenue)),
      sgna: incomeStmts.map(y => toCr(y.sellingGeneralAdministrative)),
      ebit: incomeStmts.map(y => toCr(y.ebit)),
    };

    const balanceData = {
      totalAssets: balanceSheets.map(y => toCr(y.totalAssets)),
      currentAssets: balanceSheets.map(y => toCr(y.totalCurrentAssets)),
      currentLiabilities: balanceSheets.map(y => toCr(y.totalCurrentLiabilities)),
      totalDebt: balanceSheets.map(y => toCr((rawVal(y.longTermDebt) || 0) + (rawVal(y.shortLongTermDebt) || 0))),
      totalEquity: balanceSheets.map(y => toCr(y.totalStockholderEquity)),
      retainedEarnings: balanceSheets.map(y => toCr(y.retainedEarnings)),
      tradeReceivables: balanceSheets.map(y => toCr(y.netReceivables)),
      inventory: balanceSheets.map(y => toCr(y.inventory)),
      cash: balanceSheets.map(y => toCr(y.cash)),
      ppe: balanceSheets.map(y => toCr(y.propertyPlantEquipment)),
    };

    const cashflowData = {
      cfo: cashflows.map(y => toCr(y.totalCashFromOperatingActivities)),
      capex: cashflows.map(y => Math.abs(toCr(y.capitalExpenditures) || 0)),
      freeCashFlow: cashflows.map((y, i) => {
        const cfo = toCr(y.totalCashFromOperatingActivities) || 0;
        const capex = Math.abs(toCr(y.capitalExpenditures) || 0);
        return cfo - capex;
      }),
    };

    return {
      symbol,
      name: q?.longName || q?.shortName || companyName,
      // Live price
      price: {
        current: q?.regularMarketPrice || null,
        change: q?.regularMarketChange?.toFixed(2) || null,
        changePct: q?.regularMarketChangePercent?.toFixed(2) || null,
        open: q?.regularMarketOpen || null,
        high52w: q?.fiftyTwoWeekHigh || null,
        low52w: q?.fiftyTwoWeekLow || null,
        volume: q?.regularMarketVolume || null,
      },
      // Valuation
      valuation: {
        marketCapCr: q?.marketCap ? Math.round(q.marketCap / 1e7) : null,
        pe: rawVal(det?.trailingPE) || q?.trailingPE || null,
        forwardPe: rawVal(det?.forwardPE) || q?.forwardPE || null,
        pb: rawVal(stat?.priceToBook) || null,
        evEbitda: rawVal(stat?.enterpriseToEbitda) || null,
        eps: rawVal(stat?.trailingEps) || null,
        dividendYield: (rawVal(det?.dividendYield) || 0) * 100,
        enterpriseValue: rawVal(stat?.enterpriseValue) ? Math.round(rawVal(stat.enterpriseValue) / 1e7) : null,
        beta: rawVal(stat?.beta) || q?.beta || null,
        sharesOutstanding: rawVal(stat?.sharesOutstanding) ? Math.round(rawVal(stat.sharesOutstanding) / 1e7) : null,
      },
      // Financial ratios
      ratios: {
        roe: rawVal(fin?.returnOnEquity) ? (rawVal(fin.returnOnEquity) * 100).toFixed(1) : null,
        roa: rawVal(fin?.returnOnAssets) ? (rawVal(fin.returnOnAssets) * 100).toFixed(1) : null,
        debtToEquity: rawVal(fin?.debtToEquity) ? (rawVal(fin.debtToEquity) / 100).toFixed(2) : null,
        currentRatio: rawVal(fin?.currentRatio)?.toFixed(2) || null,
        grossMargin: rawVal(fin?.grossMargins) ? (rawVal(fin.grossMargins) * 100).toFixed(1) : null,
        ebitdaMargin: rawVal(fin?.ebitdaMargins) ? (rawVal(fin.ebitdaMargins) * 100).toFixed(1) : null,
        netMargin: rawVal(fin?.profitMargins) ? (rawVal(fin.profitMargins) * 100).toFixed(1) : null,
        revenueGrowth: rawVal(fin?.revenueGrowth) ? (rawVal(fin.revenueGrowth) * 100).toFixed(1) : null,
        freeCashflow: rawVal(fin?.freeCashflow) ? Math.round(rawVal(fin.freeCashflow) / 1e7) : null,
      },
      // Annual historical data (newest first)
      annual: annualData,
      balance: balanceData,
      cashflow: cashflowData,
      // Raw sector info
      sector: q?.sector || null,
      industry: q?.industry || null,
      exchange: q?.exchange || 'NSE',
      fetchedAt: new Date().toISOString(),
      source: 'yahoo-finance2',
    };
  } catch (err) {
    console.error(`[Yahoo] Error for ${symbol}:`, err.message);
    return null;
  }
}
