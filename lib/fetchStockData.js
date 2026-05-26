// lib/fetchStockData.js
// Fetches real data from 4 FREE sources — no API key needed for most!

// ─── 1. Yahoo Finance (unofficial, totally free, no key) ─────────────────────
export async function fetchYahooFinance(symbol) {
  try {
    // Convert NSE symbol to Yahoo format  e.g. RELIANCE → RELIANCE.NS
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('Yahoo fetch failed');

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) return null;

    return {
      symbol: meta.symbol,
      cmp: meta.regularMarketPrice,
      previousClose: meta.previousClose,
      change: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2),
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      exchange: meta.exchangeName,
      source: 'Yahoo Finance'
    };
  } catch (e) {
    console.warn('Yahoo Finance failed:', e.message);
    return null;
  }
}

// ─── 2. Yahoo Finance — Fundamentals (PE, EPS, etc.) ────────────────────────
export async function fetchYahooFundamentals(symbol) {
  try {
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('Yahoo fundamentals fetch failed');

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const sd = result.summaryDetail || {};
    const ks = result.defaultKeyStatistics || {};
    const fd = result.financialData || {};
    const ap = result.assetProfile || {};

    return {
      pe: sd.trailingPE?.raw,
      forwardPE: sd.forwardPE?.raw,
      pb: ks.priceToBook?.raw,
      eps: ks.trailingEps?.raw,
      roe: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) : null,
      profitMargin: fd.profitMargins?.raw ? (fd.profitMargins.raw * 100).toFixed(1) : null,
      debtToEquity: fd.debtToEquity?.raw,
      currentRatio: fd.currentRatio?.raw,
      revenueGrowth: fd.revenueGrowth?.raw ? (fd.revenueGrowth.raw * 100).toFixed(1) : null,
      earningsGrowth: fd.earningsGrowth?.raw ? (fd.earningsGrowth.raw * 100).toFixed(1) : null,
      dividendYield: sd.dividendYield?.raw ? (sd.dividendYield.raw * 100).toFixed(2) : null,
      beta: sd.beta?.raw,
      sector: ap.sector,
      industry: ap.industry,
      employees: ap.fullTimeEmployees,
      description: ap.longBusinessSummary?.substring(0, 400),
      source: 'Yahoo Finance Fundamentals'
    };
  } catch (e) {
    console.warn('Yahoo fundamentals failed:', e.message);
    return null;
  }
}

// ─── 3. Screener.in scraper (free, public data) ──────────────────────────────
export async function fetchScreenerData(companyName) {
  try {
    // Search for company on Screener
    const searchUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(companyName)}&v=3`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.screener.in'
      }
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    if (!searchData?.length) return null;

    // Get first result's slug
    const slug = searchData[0]?.url?.replace('/company/', '').replace('/', '');
    if (!slug) return null;

    // Fetch company page
    const companyUrl = `https://www.screener.in/company/${slug}/consolidated/`;
    const companyRes = await fetch(companyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.screener.in'
      }
    });

    if (!companyRes.ok) return null;

    const html = await companyRes.text();

    // Extract key numbers from HTML using regex
    const extract = (pattern, str) => {
      const match = str.match(pattern);
      return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    };

    // Extract financial ratios from Screener page
    const stockPE   = extract(/Stock P\/E<\/span>[\s\S]*?<span[^>]*>([\d,.]+)<\/span>/i, html);
    const bookValue = extract(/Book Value<\/span>[\s\S]*?<span[^>]*>[\u20B9]?\s*([\d,.]+)<\/span>/i, html);
    const divYield  = extract(/Dividend Yield<\/span>[\s\S]*?<span[^>]*>([\d,.]+)%?<\/span>/i, html);
    const roce      = extract(/ROCE<\/span>[\s\S]*?<span[^>]*>([\d,.]+)%?<\/span>/i, html);
    const roe       = extract(/ROE<\/span>[\s\S]*?<span[^>]*>([\d,.]+)%?<\/span>/i, html);
    const faceValue = extract(/Face Value<\/span>[\s\S]*?<span[^>]*>[\u20B9]?\s*([\d,.]+)<\/span>/i, html);

    // Extract promoter holding
    const promoter = extract(/Promoters[\s\S]*?([\d.]+)%/i, html);

    return {
      slug,
      screenerUrl: companyUrl,
      stockPE,
      bookValue,
      dividendYield: divYield,
      roce,
      roe,
      faceValue,
      promoterHolding: promoter,
      source: 'Screener.in'
    };
  } catch (e) {
    console.warn('Screener fetch failed:', e.message);
    return null;
  }
}

// ─── 4. NewsAPI.org (100 free requests/day — get key at newsapi.org) ─────────
export async function fetchNews(companyName, apiKey) {
  if (!apiKey) return [];
  try {
    const query = encodeURIComponent(`"${companyName}" stock`);
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.articles || []).map(a => ({
      title: a.title,
      source: a.source?.name,
      url: a.url,
      publishedAt: a.publishedAt?.split('T')[0],
      description: a.description?.substring(0, 120)
    }));
  } catch (e) {
    console.warn('NewsAPI failed:', e.message);
    return [];
  }
}

// ─── 5. NSE India public API (free, no key) ─────────────────────────────────
export async function fetchNSEData(symbol) {
  try {
    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com',
        'Connection': 'keep-alive'
      }
    });
    if (!res.ok) return null;

    const data = await res.json();
    const info = data?.info || {};
    const pd   = data?.priceInfo || {};

    return {
      symbol: info.symbol,
      companyName: info.companyName,
      industry: info.industry,
      series: info.series,
      cmp: pd.lastPrice,
      open: pd.open,
      high: pd.intraDayHighLow?.max,
      low: pd.intraDayHighLow?.min,
      change: pd.change,
      pChange: pd.pChange,
      fiftyTwoWeekHigh: pd.weekHighLow?.max,
      fiftyTwoWeekLow: pd.weekHighLow?.min,
      source: 'NSE India'
    };
  } catch (e) {
    console.warn('NSE fetch failed:', e.message);
    return null;
  }
}

// ─── Master function: fetch everything in parallel ───────────────────────────
export async function fetchAllData(companyName, nseSymbol) {
  console.log(`Fetching data for: ${companyName} (${nseSymbol})`);

  const [yahoo, fundamentals, screener, news, nse] = await Promise.allSettled([
    fetchYahooFinance(nseSymbol || companyName),
    fetchYahooFundamentals(nseSymbol || companyName),
    fetchScreenerData(companyName),
    fetchNews(companyName, process.env.NEWS_API_KEY),
    fetchNSEData(nseSymbol || companyName)
  ]);

  const getValue = r => r.status === 'fulfilled' ? r.value : null;

  return {
    price:        getValue(yahoo),
    fundamentals: getValue(fundamentals),
    screener:     getValue(screener),
    news:         getValue(news) || [],
    nse:          getValue(nse),
    fetchedAt:    new Date().toISOString()
  };
}
