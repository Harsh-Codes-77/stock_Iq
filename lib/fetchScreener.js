// lib/fetchScreener.js
// Scrapes Screener.in for 10-year P&L, balance sheet, ratios — FREE, no API key
// Screener.in is a public website — we're reading publicly available data

import * as cheerio from 'cheerio';

// Convert company name to screener slug
function toScreenerSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+&\s+/g, '-and-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Common slug overrides for popular companies
const SLUG_MAP = {
  'reliance industries': 'reliance-industries',
  'reliance': 'reliance-industries',
  'hdfc bank': 'hdfc-bank',
  'tcs': 'tcs',
  'tata consultancy': 'tcs',
  'infosys': 'infosys',
  'zomato': 'zomato',
  'bajaj finance': 'bajaj-finance',
  'tata motors': 'tata-motors',
  'icici bank': 'icici-bank',
  'asian paints': 'asian-paints',
  'sun pharma': 'sun-pharmaceutical-industries',
  'maruti suzuki': 'maruti-suzuki-india',
  'maruti': 'maruti-suzuki-india',
  'kotak mahindra bank': 'kotak-mahindra-bank',
  'kotak bank': 'kotak-mahindra-bank',
  'hindustan unilever': 'hindustan-unilever',
  'hul': 'hindustan-unilever',
  'wipro': 'wipro',
  'adani ports': 'adani-ports-and-special-economic-zone',
  'ongc': 'oil-and-natural-gas-corporation',
  'ntpc': 'ntpc',
  'sbi': 'state-bank-of-india',
  'state bank': 'state-bank-of-india',
  'axis bank': 'axis-bank',
  'l&t': 'larsen-and-toubro',
  'larsen': 'larsen-and-toubro',
  'titan': 'titan-company',
  'nestle': 'nestle-india',
  'ultratech': 'ultratech-cement',
  'bharti airtel': 'bharti-airtel',
  'airtel': 'bharti-airtel',
  'cipla': 'cipla',
  'dr reddys': 'dr-reddys-laboratories',
  'bajaj auto': 'bajaj-auto',
  'hero motocorp': 'hero-motocorp',
  'mahindra': 'mahindra-and-mahindra',
  'm&m': 'mahindra-and-mahindra',
  'tata steel': 'tata-steel',
  'coal india': 'coal-india',
  'bpcl': 'bharat-petroleum-corporation',
  'dmart': 'avenue-supermarts',
  'avenue supermarts': 'avenue-supermarts',
  'irctc': 'indian-railway-catering-and-tourism-corporation',
  'pidilite': 'pidilite-industries',
  'dabur': 'dabur-india',
  'havells': 'havells-india',
  'nykaa': 'fsl',
  'paytm': 'one97-communications',
};

function getSlug(companyName) {
  const lower = companyName.toLowerCase().trim();
  if (SLUG_MAP[lower]) return SLUG_MAP[lower];
  for (const [k, v] of Object.entries(SLUG_MAP)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }
  return toScreenerSlug(companyName);
}

// Parse number from strings like "1,23,456" or "12.3%"
function parseNum(str) {
  if (!str) return null;
  const clean = str.replace(/,/g, '').replace(/%/, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

export async function fetchScreenerData(companyName) {
  const slug = getSlug(companyName);
  const url = `https://www.screener.in/company/${slug}/consolidated/`;
  console.log(`[Screener] Fetching ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Try standalone
      const url2 = `https://www.screener.in/company/${slug}/`;
      const res2 = await fetch(url2, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res2.ok) throw new Error(`Screener returned ${res2.status}`);
      return parseScreenerHtml(await res2.text(), companyName);
    }

    return parseScreenerHtml(await res.text(), companyName);
  } catch (err) {
    console.error(`[Screener] Error:`, err.message);
    return null;
  }
}

function parseScreenerHtml(html, companyName) {
  const $ = cheerio.load(html);

  // Key ratios from the top section
  const ratios = {};
  $('#top-ratios li, .company-ratios li').each((_, el) => {
    const label = $(el).find('.name').text().trim();
    const val = $(el).find('.number, .value').first().text().trim();
    if (label && val) ratios[label] = val;
  });

  // Helper: parse a data table (P&L / Balance Sheet etc.)
  function parseTable(sectionId) {
    const rows = {};
    const years = [];

    $(`#${sectionId} thead tr th`).each((i, th) => {
      if (i > 0) years.push($(th).text().trim());
    });

    $(`#${sectionId} tbody tr`).each((_, tr) => {
      const cells = $(tr).find('td');
      const label = cells.first().text().trim();
      if (!label) return;
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

  // Shareholding
  const shareholding = {};
  $('#shareholding tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    const label = cells.first().text().trim().toLowerCase();
    const latestVal = parseNum(cells.eq(cells.length - 1).text());
    if (label.includes('promoter')) shareholding.promoter = latestVal;
    else if (label.includes('fii') || label.includes('foreign')) shareholding.fii = latestVal;
    else if (label.includes('dii') || label.includes('institution')) shareholding.dii = latestVal;
    else if (label.includes('public')) shareholding.public = latestVal;
  });

  // Company name & description
  const name = $('h1.h2, .company-name h1').first().text().trim() || companyName;
  const about = $('.company-profile p, #about p').first().text().trim();

  // Quarterly results
  const quarterly = parseTable('quarters');

  return {
    name,
    about,
    ratios: {
      raw: ratios,
      pe: parseNum(ratios['Stock P/E'] || ratios['P/E']),
      pb: parseNum(ratios['Price to Book value'] || ratios['P/B']),
      roe: parseNum(ratios['Return on Equity %'] || ratios['ROE %']),
      roce: parseNum(ratios['ROCE %']),
      debtEquity: parseNum(ratios['Debt to equity'] || ratios['D/E']),
      dividendYield: parseNum(ratios['Dividend Yield']),
      marketCap: parseNum(ratios['Market Cap']),
      currentPrice: parseNum(ratios['Current Price']),
      bookValue: parseNum(ratios['Book Value']),
      eps: parseNum(ratios['EPS in Rs']),
    },
    financials: {
      profitLoss: {
        years: pl.years,
        revenue: pl.rows['Revenue'] || pl.rows['Sales'] || pl.rows['Net Sales'],
        ebitda: pl.rows['OPM %'] ? null : pl.rows['Operating Profit'] || pl.rows['EBITDA'],
        ebitdaMargin: pl.rows['OPM %'],
        pat: pl.rows['Net Profit'] || pl.rows['PAT'],
        eps: pl.rows['EPS in Rs'],
      },
      balanceSheet: {
        years: bs.years,
        equity: bs.rows['Equity Capital'],
        reserves: bs.rows['Reserves'],
        borrowings: bs.rows['Borrowings'],
        totalAssets: bs.rows['Total Assets'],
      },
      cashFlow: {
        years: cf.years,
        operating: cf.rows['Cash from Operating Activity'],
        investing: cf.rows['Cash from Investing Activity'],
        financing: cf.rows['Cash from Financing Activity'],
      },
      quarterly: {
        quarters: quarterly.years,
        revenue: quarterly.rows['Revenue'] || quarterly.rows['Sales'],
        pat: quarterly.rows['Net Profit'],
        ebitda: quarterly.rows['Operating Profit'],
        ebitdaMargin: quarterly.rows['OPM %'],
      },
    },
    shareholding,
    keyRatioTable: {
      years: ratioTable.years,
      roe: ratioTable.rows['Return on equity %'],
      roce: ratioTable.rows['ROCE %'],
      debtEquity: ratioTable.rows['Debt to equity'],
    },
    fetchedAt: new Date().toISOString(),
    source: 'screener.in',
  };
}
