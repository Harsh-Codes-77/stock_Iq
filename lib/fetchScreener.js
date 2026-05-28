// lib/fetchScreener.js
// Scrapes Screener.in for 10-year P&L, balance sheet, ratios, shareholding trend

import * as cheerio from 'cheerio';

// ── Fallback slug mapping ───────────────────────────────────────────────────────
function toScreenerSlug(name) {
  return name.toLowerCase()
    .replace(/\s+&\s+/g, '-and-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const SLUG_MAP = {
  'reliance industries': 'RELIANCE', 'reliance': 'RELIANCE',
  'hdfc bank': 'HDFCBANK', 'tcs': 'TCS', 'tata consultancy': 'TCS',
  'infosys': 'INFY', 'zomato': 'ETERNAL', 'bajaj finance': 'BAJFINANCE',
  'tata motors': 'TATAMOTORS', 'icici bank': 'ICICIBANK',
  'asian paints': 'ASIANPAINT', 'sun pharma': 'SUNPHARMA',
  'maruti suzuki': 'MARUTI', 'maruti': 'MARUTI',
  'kotak mahindra bank': 'KOTAKBANK', 'kotak bank': 'KOTAKBANK',
  'hindustan unilever': 'HINDUNILVR', 'hul': 'HINDUNILVR',
  'wipro': 'WIPRO', 'adani ports': 'ADANIPORTS',
  'ongc': 'ONGC', 'ntpc': 'NTPC',
  'sbi': 'SBIN', 'state bank': 'SBIN',
  'axis bank': 'AXISBANK', 'l&t': 'LT', 'larsen': 'LT',
  'titan': 'TITAN', 'nestle': 'NESTLEIND', 'ultratech': 'ULTRACEMCO',
  'bharti airtel': 'BHARTIARTL', 'airtel': 'BHARTIARTL',
  'cipla': 'CIPLA', 'dr reddys': 'DRREDDY',
  'bajaj auto': 'BAJAJ-AUTO', 'hero motocorp': 'HEROMOTOCO',
  'mahindra': 'M&M', 'm&m': 'M&M',
  'tata steel': 'TATASTEEL', 'coal india': 'COALINDIA',
  'bpcl': 'BPCL', 'dmart': 'DMART',
  'avenue supermarts': 'DMART',
  'irctc': 'IRCTC',
  'pidilite': 'PIDILITIND', 'dabur': 'DABUR',
  'havells': 'HAVELLS', 'nykaa': 'FSNEV', 'paytm': 'PAYTM',
};

async function getSlug(companyName) {
  const lower = companyName.toLowerCase().trim();
  
  // 1. Try searching the Screener Autocomplete API first for the most current slug
  try {
    const cleanQuery = companyName.replace(/\.(NS|BO)$/i, '').trim();
    const searchUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(cleanQuery)}`;
    console.log(`[Screener] Querying autocomplete API: ${searchUrl}`);
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const results = await res.json();
      if (results && results.length > 0) {
        const url = results[0].url; // e.g. "/company/ETERNAL/consolidated/"
        const match = url.match(/\/company\/([^\/]+)/);
        if (match && match[1]) {
          console.log(`[Screener] Resolved slug dynamically for "${companyName}" -> "${match[1]}"`);
          return match[1];
        }
      }
    }
  } catch (err) {
    console.warn(`[Screener] Autocomplete search failed for "${companyName}":`, err.message);
  }

  // 2. Fallback to hardcoded map
  if (SLUG_MAP[lower]) return SLUG_MAP[lower];
  for (const [k, v] of Object.entries(SLUG_MAP)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }
  
  // 3. Last fallback: default slug format
  return toScreenerSlug(companyName);
}

function parseNum(str) {
  if (!str) return null;
  // Clean currency symbols, commas, percent signs and clean whitespaces
  const clean = str.replace(/₹/g, '').replace(/,/g, '').replace(/%/g, '').trim();
  
  // Find first match of a numeric value (including decimals and negative values)
  const match = clean.match(/-?\d+(\.\d+)?/);
  if (match) {
    const n = parseFloat(match[0]);
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// ── Main fetch ─────────────────────────────────────────────────────────────────
export async function fetchScreenerData(companyName) {
  const slug = await getSlug(companyName);
  const url = `https://www.screener.in/company/${slug}/consolidated/`;
  console.log(`[Screener] Fetching consolidated page: ${url}`);

  try {
    let html;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const url2 = `https://www.screener.in/company/${slug}/`;
      console.log(`[Screener] Consolidated 404, fetching main page: ${url2}`);
      const res2 = await fetch(url2, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res2.ok) throw new Error(`Screener returned ${res2.status}`);
      html = await res2.text();
    } else {
      html = await res.text();
    }

    return parseScreenerHtml(html, companyName);
  } catch (err) {
    console.error(`[Screener] Error fetching data for "${companyName}":`, err.message);
    return null;
  }
}

function parseScreenerHtml(html, companyName) {
  const $ = cheerio.load(html);

  // ── Key ratios from top section ──
  const ratios = {};
  $('#top-ratios li, .company-ratios li').each((_, el) => {
    const label = $(el).find('.name').text().trim();
    const val = $(el).find('.number, .value').first().text().trim();
    if (label && val) ratios[label] = val;
  });

  // ── Table parser ──
  function parseTable(sectionId) {
    const rows = {};
    const years = [];
    $(`#${sectionId} thead tr th`).each((i, th) => {
      if (i > 0) years.push($(th).text().trim());
    });
    $(`#${sectionId} tbody tr`).each((_, tr) => {
      const cells = $(tr).find('td');
      let label = cells.first().text().trim();
      if (!label) return;

      // Clean label: remove "+" symbol and replace non-breaking spaces with spaces
      label = label.replace(/\s*\+\s*$/, '').replace(/\u00a0/g, ' ').trim();

      rows[label] = [];
      cells.each((i, td) => {
        if (i > 0) rows[label].push(parseNum($(td).text()));
      });
    });
    return { years, rows };
  }

  const pl = parseTable('profit-loss');
  const bs = parseTable('balance-sheet');
  const cf = parseTable('cash-flow');
  const ratioTable = parseTable('ratios');
  const quarterly = parseTable('quarters');

  // ── Shareholding with trend (all quarters) ──
  const shareholding = { promoter: null, fii: null, dii: null, public: null, trend: [] };
  const shTable = $('#shareholding table').eq(0);
  
  if (shTable.length > 0) {
    const shYears = [];
    shTable.find('thead tr th').each((i, th) => {
      if (i > 0) shYears.push($(th).text().trim());
    });

    const shRows = {};
    shTable.find('tbody tr').each((_, tr) => {
      const cells = $(tr).find('td');
      let label = cells.first().text().trim().toLowerCase();
      
      // Clean shareholding labels
      label = label.replace(/\s*\+\s*$/, '').replace(/\u00a0/g, ' ').trim();

      const values = [];
      cells.each((i, td) => {
        if (i > 0) values.push(parseNum($(td).text()));
      });

      if (label.includes('promoter') && !label.includes('pledge')) {
        shareholding.promoter = values[values.length - 1];
        shRows.promoter = values;
      } else if (label.includes('fii') || label.includes('foreign')) {
        shareholding.fii = values[values.length - 1];
        shRows.fii = values;
      } else if (label.includes('dii') || label.includes('institution')) {
        shareholding.dii = values[values.length - 1];
        shRows.dii = values;
      } else if (label.includes('public')) {
        shareholding.public = values[values.length - 1];
        shRows.public = values;
      } else if (label.includes('pledge')) {
        shareholding.promoterPledge = values[values.length - 1] || 0;
        shRows.pledge = values;
      }
    });

    // Build trend array (last 8 quarters)
    const trendLen = Math.min(shYears.length, 8);
    const startIdx = Math.max(0, shYears.length - trendLen);
    for (let i = startIdx; i < shYears.length; i++) {
      shareholding.trend.push({
        quarter: shYears[i],
        promoter: shRows.promoter?.[i] || 0,
        fii: shRows.fii?.[i] || 0,
        dii: shRows.dii?.[i] || 0,
        public: shRows.public?.[i] || 0,
        pledge: shRows.pledge?.[i] || 0,
      });
    }
  }

  // ── Company name & description ──
  const name = $('h1.h2, .company-name h1').first().text().trim() || companyName;
  const about = $('.company-profile p, #about p').first().text().trim();

  return {
    name,
    about,
    ratios: {
      raw: ratios,
      pe: parseNum(ratios['Stock P/E'] || ratios['P/E']),
      pb: parseNum(ratios['Price to Book value'] || ratios['P/B']),
      roe: parseNum(ratios['Return on Equity'] || ratios['Return on Equity %'] || ratios['ROE %'] || ratios['ROE']),
      roce: parseNum(ratios['ROCE'] || ratios['ROCE %']),
      debtEquity: parseNum(ratios['Debt to equity'] || ratios['D/E'] || ratios['Debt to Equity']),
      dividendYield: parseNum(ratios['Dividend Yield']),
      marketCap: parseNum(ratios['Market Cap']),
      currentPrice: parseNum(ratios['Current Price']),
      bookValue: parseNum(ratios['Book Value']),
      eps: parseNum(ratios['EPS in Rs'] || ratios['EPS']),
    },
    financials: {
      profitLoss: {
        years: pl.years,
        revenue: pl.rows['Revenue'] || pl.rows['Sales'] || pl.rows['Net Sales'] || [],
        ebitda: pl.rows['Operating Profit'] || pl.rows['EBITDA'] || [],
        ebitdaMargin: pl.rows['OPM %'] || [],
        pat: pl.rows['Net Profit'] || pl.rows['PAT'] || [],
        eps: pl.rows['EPS in Rs'] || [],
        depreciation: pl.rows['Depreciation'] || [],
        materialCost: pl.rows['Raw Material Cost'] || pl.rows['Material Cost %'] || [],
        otherExpenses: pl.rows['Other Expenses'] || [],
      },
      balanceSheet: {
        years: bs.years,
        equity: bs.rows['Equity Capital'] || [],
        reserves: bs.rows['Reserves'] || [],
        borrowings: bs.rows['Borrowings'] || [],
        totalAssets: bs.rows['Total Assets'] || [],
        tradeReceivables: bs.rows['Trade Receivables'] || bs.rows['Debtors'] || [],
        inventory: bs.rows['Inventories'] || bs.rows['Inventory'] || [],
        currentAssets: bs.rows['Other Assets'] || [], 
        tradePayables: bs.rows['Trade Payables'] || bs.rows['Sundry Creditors'] || [],
      },
      cashFlow: {
        years: cf.years,
        operating: cf.rows['Cash from Operating Activity'] || [],
        investing: cf.rows['Cash from Investing Activity'] || [],
        financing: cf.rows['Cash from Financing Activity'] || [],
      },
      quarterly: {
        quarters: quarterly.years,
        revenue: quarterly.rows['Revenue'] || quarterly.rows['Sales'] || [],
        pat: quarterly.rows['Net Profit'] || [],
        ebitda: quarterly.rows['Operating Profit'] || [],
        ebitdaMargin: quarterly.rows['OPM %'] || [],
      },
    },
    shareholding,
    keyRatioTable: {
      years: ratioTable.years,
      roe: ratioTable.rows['Return on equity %'] || [],
      roce: ratioTable.rows['ROCE %'] || [],
      debtEquity: ratioTable.rows['Debt to equity'] || [],
    },
    fetchedAt: new Date().toISOString(),
    source: 'screener.in',
  };
}
