// lib/fetchNSE.js
// Fetches live price from NSE India public API — completely FREE, no key needed
// Also fetches news from NewsAPI (free tier: 100 req/day)

// NSE symbol lookup
const NSE_SYMBOLS = {
  'reliance industries': 'RELIANCE',
  'reliance': 'RELIANCE',
  'hdfc bank': 'HDFCBANK',
  'tcs': 'TCS',
  'infosys': 'INFY',
  'zomato': 'ZOMATO',
  'bajaj finance': 'BAJFINANCE',
  'tata motors': 'TATAMOTORS',
  'icici bank': 'ICICIBANK',
  'asian paints': 'ASIANPAINT',
  'sun pharma': 'SUNPHARMA',
  'maruti': 'MARUTI',
  'maruti suzuki': 'MARUTI',
  'kotak mahindra bank': 'KOTAKBANK',
  'hindustan unilever': 'HINDUNILVR',
  'hul': 'HINDUNILVR',
  'wipro': 'WIPRO',
  'adani ports': 'ADANIPORTS',
  'ongc': 'ONGC',
  'ntpc': 'NTPC',
  'sbi': 'SBIN',
  'state bank': 'SBIN',
  'axis bank': 'AXISBANK',
  'l&t': 'LT',
  'titan': 'TITAN',
  'bharti airtel': 'BHARTIARTL',
  'airtel': 'BHARTIARTL',
  'cipla': 'CIPLA',
  'bajaj auto': 'BAJAJ-AUTO',
  'mahindra': 'M&M',
  'tata steel': 'TATASTEEL',
  'coal india': 'COALINDIA',
  'bpcl': 'BPCL',
  'dmart': 'DMART',
  'avenue supermarts': 'DMART',
  'irctc': 'IRCTC',
  'pidilite': 'PIDILITIND',
  'dabur': 'DABUR',
  'havells': 'HAVELLS',
};

function getNSESymbol(name) {
  const lower = name.toLowerCase().trim();
  if (NSE_SYMBOLS[lower]) return NSE_SYMBOLS[lower];
  for (const [k, v] of Object.entries(NSE_SYMBOLS)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }
  return name.toUpperCase().replace(/\s+/g, '');
}

export async function fetchNSEPrice(companyName) {
  const symbol = getNSESymbol(companyName);
  console.log(`[NSE] Fetching ${symbol}`);

  try {
    // NSE public API — no auth needed
    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`NSE returned ${res.status}`);

    const data = await res.json();
    const pd = data?.priceInfo || {};
    const meta = data?.metadata || data?.info || {};

    return {
      symbol,
      companyName: meta.companyName || companyName,
      series: meta.series,
      isin: meta.isin,
      price: {
        lastPrice: pd.lastPrice,
        open: pd.open,
        high: pd.intraDayHighLow?.max,
        low: pd.intraDayHighLow?.min,
        close: pd.previousClose,
        change: pd.change,
        changePct: pd.pChange,
        vwap: pd.vwap,
        high52: pd.weekHighLow?.max,
        low52: pd.weekHighLow?.min,
      },
      volume: data?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume,
      deliveryPct: data?.securityWiseDP?.deliveryToTradedQuantity,
      fetchedAt: new Date().toISOString(),
      source: 'NSE India',
    };
  } catch (err) {
    console.error(`[NSE] Error:`, err.message);
    return null;
  }
}

export async function fetchNews(companyName, newsApiKey) {
  // If no NewsAPI key, try Google News RSS (completely free)
  if (!newsApiKey) {
    return fetchGoogleNewsRSS(companyName);
  }

  console.log(`[News] Fetching NewsAPI for "${companyName}"`);
  try {
    const query = encodeURIComponent(`${companyName} stock India NSE`);
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${newsApiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`NewsAPI returned ${res.status}`);

    const data = await res.json();
    return (data.articles || []).map(a => ({
      title: a.title,
      source: a.source?.name,
      url: a.url,
      publishedAt: a.publishedAt?.split('T')[0],
      description: a.description,
    }));
  } catch (err) {
    console.error(`[News] NewsAPI error:`, err.message);
    return fetchGoogleNewsRSS(companyName);
  }
}

async function fetchGoogleNewsRSS(companyName) {
  console.log(`[News] Fetching Google RSS for "${companyName}"`);
  try {
    const query = encodeURIComponent(`${companyName} NSE stock`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Google RSS returned ${res.status}`);

    const xml = await res.text();
    // Simple XML parse for RSS items
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] ||
                    item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Google News';
      if (title) {
        items.push({
          title: title.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
          source,
          publishedAt: pubDate ? new Date(pubDate).toISOString().split('T')[0] : null,
          description: '',
        });
      }
      if (items.length >= 8) break;
    }
    return items;
  } catch (err) {
    console.error(`[News] RSS error:`, err.message);
    return [];
  }
}
