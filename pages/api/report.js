// pages/api/report.js
// 1. Fetch real data (Yahoo + Screener + NSE + News) in parallel
// 2. Inject into AI prompt → supports OpenRouter (any model) + Gemini fallback
// 3. AI analyses REAL numbers → returns structured JSON report

import { fetchAllData } from '../../lib/fetchAllData.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { company, sector, price: manualPrice, marketCap: manualMcap } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  // ── Check for API keys ────────────────────────────────────────────────────────
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openrouterModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openrouterKey && !geminiKey) {
    return res.status(500).json({
      error: 'No API key configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env.local'
    });
  }

  // ── Step 1: Fetch all real data ──────────────────────────────────────────────
  let realData = null;
  let dataFetchError = null;

  try {
    realData = await fetchAllData(company, null);
  } catch (err) {
    dataFetchError = err.message;
    console.error('[report] Data fetch failed:', err.message);
  }

  // Use manual overrides if provided
  if (realData && manualPrice) realData.price.current = parseFloat(manualPrice);
  if (realData && manualMcap)  realData.marketCap.crores = parseFloat(manualMcap);

  // ── Step 2: Build prompt with real data injected ─────────────────────────────
  const prompt = buildPrompt(company, sector, realData, manualPrice, manualMcap);

  // ── Step 3: Try OpenRouter first, then Gemini as fallback ────────────────────
  let lastError = null;

  // ── 3a. OpenRouter (primary — any model, no free-tier rate limits) ───────────
  if (openrouterKey) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[report] OpenRouter attempt ${attempt}/2 with ${openrouterModel}`);
        const result = await callOpenRouter(openrouterKey, openrouterModel, prompt);
        console.log(`[report] OpenRouter success — ${result.raw.length} chars`);

        const report = extractJson(result.raw, result.truncated);
        report._dataSources = realData?.meta?.sources || ['AI knowledge'];
        report._dataQuality = realData?.dataQuality || {};
        report._fetchError  = dataFetchError;
        report._aiModel     = `${openrouterModel} (OpenRouter)`;

        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
        return res.status(200).json({ success: true, data: report });
      } catch (err) {
        lastError = err;
        console.error(`[report] OpenRouter attempt ${attempt} failed:`, err.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // ── 3b. Gemini Direct fallback (free but rate-limited) ──────────────────────
  if (geminiKey) {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[report] Gemini attempt ${attempt}/2 with ${model}`);
          const result = await callGeminiDirect(geminiKey, model, prompt);
          console.log(`[report] Gemini success — ${result.raw.length} chars`);

          const report = extractJson(result.raw, result.truncated);
          report._dataSources = realData?.meta?.sources || ['Gemini knowledge'];
          report._dataQuality = realData?.dataQuality || {};
          report._fetchError  = dataFetchError;
          report._aiModel     = `${model} (free)`;

          res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
          return res.status(200).json({ success: true, data: report });
        } catch (err) {
          lastError = err;
          console.error(`[report] Gemini ${model} attempt ${attempt} failed:`, err.message);
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  console.error('[report] All AI providers failed:', lastError?.message);
  return res.status(500).json({ error: lastError?.message || 'All AI providers failed' });
}

// ── OpenRouter API call (OpenAI-compatible format) ────────────────────────────
async function callOpenRouter(apiKey, model, prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://stockiq.app',
      'X-Title': 'StockIQ Research'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an elite institutional equity research analyst. Return ONLY valid JSON — no markdown, no explanation.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const finishReason = data?.choices?.[0]?.finish_reason;
  console.log(`[report] OpenRouter finish_reason: ${finishReason}, model: ${data?.model}`);

  if (!raw) throw new Error('Empty response from OpenRouter');
  return { raw, truncated: finishReason === 'length' };
}

// ── Gemini Direct API call ────────────────────────────────────────────────────
async function callGeminiDirect(apiKey, model, prompt) {
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json'
    }
  };

  if (model.includes('2.5')) {
    requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
  );

  if (response.status === 429) {
    throw new Error(`Rate limited on ${model}`);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const finishReason = data?.candidates?.[0]?.finishReason;
  console.log(`[report] Gemini ${model} finish: ${finishReason}`);

  if (!raw) throw new Error(`Empty response from ${model}`);
  return { raw, truncated: finishReason === 'MAX_TOKENS' };
}

// ── JSON extractor — handles markdown fences, truncated JSON, and malformed output ──
function extractJson(text, isTruncated = false) {
  // Strip markdown code fences if present
  let clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Strategy 1: Direct parse (best case — works most of the time)
  try {
    return JSON.parse(clean);
  } catch (e1) {
    console.error('[extractJson] Direct parse failed:', e1.message);
    console.log('[extractJson] Text length:', clean.length);
  }

  // Strategy 2: Fix unescaped newlines/tabs inside JSON string values
  // This is the most common Gemini issue — literal newlines in strings
  try {
    const fixed = fixNewlinesInJsonStrings(clean);
    return JSON.parse(fixed);
  } catch (e2) {
    console.error('[extractJson] Newline-fix parse failed:', e2.message);
  }

  // Strategy 3: Extract the largest JSON block from the text
  const m = clean.match(/\{[\s\S]*\}/);
  if (m && m[0] !== clean) {
    try {
      return JSON.parse(m[0]);
    } catch {
      try {
        return JSON.parse(fixNewlinesInJsonStrings(m[0]));
      } catch {}
    }
  }

  // Strategy 4: Repair truncated JSON (closes unclosed brackets/braces)
  try {
    const repaired = repairTruncatedJson(clean);
    return JSON.parse(repaired);
  } catch (e3) {
    try {
      return JSON.parse(fixNewlinesInJsonStrings(repairTruncatedJson(clean)));
    } catch {}
    console.error('[extractJson] Repair failed:', e3.message);
  }

  // Strategy 5: Aggressive sanitization — remove ALL control characters
  try {
    const sanitized = clean
      .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, ' ')  // Replace control chars with space
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    return JSON.parse(sanitized);
  } catch (e4) {
    console.error('[extractJson] Aggressive sanitize failed:', e4.message);
  }

  console.error('[extractJson] ALL strategies failed. Last 500 chars:', text.slice(-500));
  throw new Error('Could not parse Gemini JSON response. Raw: ' + clean.slice(0, 300));
}

// ── Fix literal newlines inside JSON string values ────────────────────────────
// JSON spec requires \n not actual newlines in strings. Gemini sometimes violates this.
function fixNewlinesInJsonStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      // Replace literal control characters inside strings with their escape sequences
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      if (ch.charCodeAt(0) < 0x20) { continue; } // Skip other control chars
    }

    result += ch;
  }

  return result;
}

// ── Repair truncated JSON by closing unclosed brackets/braces/strings ─────────
function repairTruncatedJson(text) {
  // Remove any trailing incomplete key-value pair (e.g., `"key": "some incomple`)
  // First, remove a trailing incomplete value after the last comma or opening brace
  let repaired = text;

  // Remove trailing incomplete string value (unmatched quote)
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // Odd number of quotes — close the last string
    repaired += '"';
  }

  // Remove trailing partial key:value pairs that can't be completed
  // Look for patterns like `,"key": ` at the end without a value
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  // Also handle trailing comma
  repaired = repaired.replace(/,\s*$/, '');

  // Now close any unclosed brackets/braces
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // If still inside a string, close it
  if (inString) {
    repaired += '"';
  }

  // Close everything that's still open
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}

// ── Prompt builder — same as before, unchanged ───────────────────────────────
function buildPrompt(company, sector, d, manualPrice, manualMcap) {
  const hasRealData = !!d;
  const price = d?.price?.current || manualPrice || 'N/A';
  const mcap  = d?.marketCap?.display || (manualMcap ? `₹${manualMcap} Cr` : 'N/A');

  const formatTable = (years, rows, label) => {
    if (!years?.length) return '';
    const header   = ['Year', ...years].join(' | ');
    const dataRows = Object.entries(rows)
      .filter(([, v]) => v?.length)
      .map(([k, v]) => `${k} | ${v.join(' | ')}`)
      .join('\n');
    return `\n${label}:\n${header}\n${dataRows}`;
  };

  const financialData = hasRealData ? `
=== REAL LIVE DATA FETCHED FROM FREE APIs ===
Sources: ${d.meta.sources.join(', ')}
Fetched at: ${d.meta.fetchedAt}
Data quality: Yahoo=${d.dataQuality.yahooOk}, Screener=${d.dataQuality.screenerOk}, NSE=${d.dataQuality.nseOk}

LIVE PRICE (NSE/Yahoo):
- Current Price: ₹${price}
- Day Change: ${d.price.change || 'N/A'} (${d.price.changePct || 'N/A'}%)
- 52W High: ₹${d.price.high52w || 'N/A'}
- 52W Low: ₹${d.price.low52w || 'N/A'}
- VWAP: ₹${d.price.vwap || 'N/A'}
- Volume: ${d.price.volume?.toLocaleString('en-IN') || 'N/A'}
- Delivery %: ${d.price.deliveryPct || 'N/A'}%

MARKET CAP & VALUATION:
- Market Cap: ${mcap}
- P/E (TTM): ${d.valuation.pe || 'N/A'}
- Forward P/E: ${d.valuation.forwardPe || 'N/A'}
- P/B: ${d.valuation.pb || 'N/A'}
- EV/EBITDA: ${d.valuation.evEbitda || 'N/A'}
- EPS: ₹${d.valuation.eps || 'N/A'}
- Dividend Yield: ${d.valuation.dividendYield || 'N/A'}%
- Book Value: ₹${d.valuation.bookValue || 'N/A'}

KEY RATIOS (Screener + Yahoo):
- ROE: ${d.ratios.roe || 'N/A'}%
- ROCE: ${d.ratios.roce || 'N/A'}%
- Debt/Equity: ${d.ratios.debtToEquity || 'N/A'}x
- EBITDA Margin: ${d.ratios.ebitdaMargin || 'N/A'}%
- Net Margin: ${d.ratios.netMargin || 'N/A'}%
- Revenue Growth: ${d.ratios.revenueGrowth || 'N/A'}%
- Free Cash Flow: ₹${d.ratios.freeCashflowCr || 'N/A'} Cr

SHAREHOLDING PATTERN (latest):
- Promoter: ${d.shareholding.promoter || 'N/A'}%
- FII: ${d.shareholding.fii || 'N/A'}%
- DII: ${d.shareholding.dii || 'N/A'}%
- Public: ${d.shareholding.public || 'N/A'}%

${d.financials.years.length ? formatTable(
  d.financials.years,
  {
    'Revenue (₹Cr)':    d.financials.revenue,
    'EBITDA (₹Cr)':     d.financials.ebitda,
    'EBITDA Margin %':  d.financials.ebitdaMarginPct,
    'PAT (₹Cr)':        d.financials.pat,
    'EPS ₹':            d.financials.eps,
    'Borrowings (₹Cr)': d.financials.borrowings,
    'Operating CF (₹Cr)':d.financials.operatingCF,
  },
  '10-YEAR P&L + BALANCE SHEET (from Screener.in)'
) : '(Screener data not available — use your knowledge)'}

${d.financials.quarters.length ? formatTable(
  d.financials.quarters,
  {
    'Revenue (₹Cr)':   d.financials.qRevenue,
    'PAT (₹Cr)':       d.financials.qPat,
    'EBITDA (₹Cr)':    d.financials.qEbitda,
    'EBITDA Margin %': d.financials.qEbitdaMargin,
  },
  'QUARTERLY RESULTS (last 8 quarters)'
) : ''}

${d.ratioTrend.years.length ? formatTable(
  d.ratioTrend.years,
  { 'ROE %': d.ratioTrend.roe, 'ROCE %': d.ratioTrend.roce, 'Debt/Equity': d.ratioTrend.debtEquity },
  'ROE/ROCE TREND'
) : ''}

RECENT NEWS (${d.news.length} articles):
${d.news.map((n, i) => `${i+1}. [${n.publishedAt}] ${n.title} — ${n.source}`).join('\n')}

ABOUT: ${d.about || 'N/A'}
=== END REAL DATA ===
` : `
=== NOTE: Live data fetch failed. Use your best knowledge for ${company}. ===
Price: ₹${manualPrice || 'unknown'}, Market Cap: ${manualMcap || 'unknown'}
`;

  return `You are an elite institutional equity research analyst combining Goldman Sachs, hedge fund, and forensic accounting expertise.

TASK: Generate a COMPLETE institutional research report for: ${company}
Sector: ${sector || 'auto-detect'}, Exchange: NSE/BSE

${financialData}

CRITICAL INSTRUCTIONS:
1. Use the REAL DATA above as the PRIMARY source for all numbers
2. Where real data has gaps, use your knowledge to fill in
3. Return ONLY a valid JSON object — no text outside the JSON, no markdown fences
4. All financial values in ₹ Crore unless noted
5. Be specific with real numbers — this is institutional grade research

Return this exact JSON structure filled with real data:

{
  "company": {
    "name": "string",
    "symbol": "NSE symbol",
    "sector": "string",
    "cmp": ${d?.price?.current || manualPrice || 0},
    "targetPrice": number,
    "rating": "BUY|ACCUMULATE|HOLD|REDUCE|SELL",
    "marketCapCr": ${d?.marketCap?.crores || 0},
    "fiftyTwoWeekHigh": ${d?.price?.high52w || 0},
    "fiftyTwoWeekLow": ${d?.price?.low52w || 0},
    "exchange": "NSE/BSE"
  },
  "scores": {
    "overall": number,
    "businessQuality": number,
    "managementQuality": number,
    "financialQuality": number,
    "growthVisibility": number,
    "competitiveMoat": number,
    "valuationComfort": number,
    "cashFlowQuality": number
  },
  "executiveSummary": {
    "oneLiner": "string",
    "investmentThesis": "string",
    "biggestOpportunity": "string",
    "biggestRisk": "string",
    "idealInvestor": "string"
  },
  "businessOverview": {
    "whatItDoes": "string",
    "howItEarnsMoney": "string",
    "eli15": "string",
    "revenueSegments": [{"name":"string","percentage":number,"color":"string"}],
    "moatAnalysis": "string",
    "pricingPower": "LOW|MEDIUM|HIGH",
    "hiddenStrengths": ["string"],
    "hiddenWeaknesses": ["string"]
  },
  "financials": {
    "revenueGrowth": [{"year":"string","value":number}],
    "ebitdaGrowth": [{"year":"string","value":number}],
    "patGrowth": [{"year":"string","value":number}],
    "margins": [{"year":"string","ebitda":number,"net":number}],
    "quarterlyRevenue": [{"quarter":"string","revenue":number,"pat":number,"ebitda":number}]
  },
  "ratios": {
    "roeHistory": [{"year":"string","value":number}],
    "roceHistory": [{"year":"string","value":number}],
    "debtEquity": number,
    "interestCoverage": number,
    "currentRatio": number,
    "cfoPat": number,
    "peRatio": number,
    "pbRatio": number,
    "evEbitda": number,
    "dividendYield": number
  },
  "shareholding": {
    "current": {"promoter":${d?.shareholding?.promoter||0},"fii":${d?.shareholding?.fii||0},"dii":${d?.shareholding?.dii||0},"public":${d?.shareholding?.public||0}},
    "trend": [
      {"quarter":"Q1FY25","promoter":number,"fii":number,"dii":number},
      {"quarter":"Q2FY25","promoter":number,"fii":number,"dii":number},
      {"quarter":"Q3FY25","promoter":number,"fii":number,"dii":number},
      {"quarter":"Q4FY25","promoter":number,"fii":number,"dii":number}
    ]
  },
  "valuation": {
    "bear": {"price":number,"upside":number,"assumption":"string"},
    "base": {"price":number,"upside":number,"assumption":"string"},
    "bull": {"price":number,"upside":number,"assumption":"string"},
    "dcfAssumptions": {"wacc":number,"terminalGrowth":number,"revenueCagr":number,"ebitdaMargin":number},
    "sensitivityMatrix": {"waccValues":[9.5,10.0,10.5,11.0,11.5],"tgValues":[2.5,3.0,3.5,4.0],"matrix":[[number,number,number,number],[number,number,number,number],[number,number,number,number],[number,number,number,number],[number,number,number,number]]},
    "targets": {
      "oneYear":   {"price":number,"upside":number,"cagr":number},
      "threeYear": {"price":number,"upside":number,"cagr":number},
      "fiveYear":  {"price":number,"upside":number,"cagr":number}
    }
  },
  "management": {
    "score": number,
    "background": "string",
    "greenFlags": ["string"],
    "redFlags": ["string"],
    "pledgedShares": number,
    "promoterStake": number,
    "capitalAllocationRating": "EXCELLENT|GOOD|AVERAGE|POOR"
  },
  "forensic": {
    "overallScore": number,
    "cfoPat": number,
    "receivableDays": number,
    "inventoryDays": number,
    "checks": [
      {"metric":"CFO/PAT Ratio","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"},
      {"metric":"Receivable Days","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"},
      {"metric":"Inventory Days","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"},
      {"metric":"Pledged Shares","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"},
      {"metric":"Auditor Quality","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"},
      {"metric":"Net Debt/EBITDA","value":"string","status":"HEALTHY|WARNING|RISK","note":"string"}
    ]
  },
  "concall": {
    "managementCredibility": number,
    "promises": [
      {"promise":"string","status":"DELIVERED|PARTIAL|MISSED","detail":"string"},
      {"promise":"string","status":"DELIVERED|PARTIAL|MISSED","detail":"string"},
      {"promise":"string","status":"DELIVERED|PARTIAL|MISSED","detail":"string"},
      {"promise":"string","status":"DELIVERED|PARTIAL|MISSED","detail":"string"},
      {"promise":"string","status":"DELIVERED|PARTIAL|MISSED","detail":"string"}
    ]
  },
  "risks": [
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"},
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"},
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"},
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"},
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"},
    {"name":"string","severity":number,"level":"HIGH|MEDIUM|LOW","description":"string"}
  ],
  "competitors": [
    {"name":"string","mcap":"string","revenueGrowth":number,"ebitdaMargin":number,"roe":number,"debtEquity":number,"pe":number,"rating":"BUY|HOLD|AVOID","isSubject":true},
    {"name":"string","mcap":"string","revenueGrowth":number,"ebitdaMargin":number,"roe":number,"debtEquity":number,"pe":number,"rating":"BUY|HOLD|AVOID","isSubject":false},
    {"name":"string","mcap":"string","revenueGrowth":number,"ebitdaMargin":number,"roe":number,"debtEquity":number,"pe":number,"rating":"BUY|HOLD|AVOID","isSubject":false},
    {"name":"string","mcap":"string","revenueGrowth":number,"ebitdaMargin":number,"roe":number,"debtEquity":number,"pe":number,"rating":"BUY|HOLD|AVOID","isSubject":false}
  ],
  "smartMoney": [
    {"investor":"Rakesh Jhunjhunwala","action":"BUY|HOLD|AVOID","reason":"string"},
    {"investor":"Vijay Kedia","action":"BUY|HOLD|AVOID","reason":"string"},
    {"investor":"Warren Buffett","action":"BUY|HOLD|AVOID","reason":"string"},
    {"investor":"Peter Lynch","action":"BUY|HOLD|AVOID","reason":"string"},
    {"investor":"Howard Marks","action":"BUY|HOLD|AVOID","reason":"string"},
    {"investor":"Ashish Kacholia","action":"BUY|HOLD|AVOID","reason":"string"}
  ],
  "industryAnalysis": {
    "size": "string",
    "growthRate": number,
    "tailwinds": ["string","string","string"],
    "headwinds": ["string","string"],
    "leaders": ["string","string","string"]
  },
  "buyReasons":          ["string","string","string","string","string","string","string","string","string","string"],
  "avoidReasons":        ["string","string","string","string","string","string","string","string","string","string"],
  "multibaggerTriggers": ["string","string","string","string"],
  "news": ${JSON.stringify(d?.news?.slice(0,5) || [])},
  "finalVerdict": {
    "rating": "BUY|ACCUMULATE|HOLD|REDUCE|SELL",
    "conviction": "HIGH|MEDIUM|LOW",
    "riskLevel": "LOW|MODERATE|HIGH",
    "expectedCagr3yr": number,
    "idealBuyZone": "string",
    "sipSuitable": true,
    "exitSignals": ["string","string"],
    "suitableFor": "string",
    "keyMetricToTrack": "string",
    "reratingTrigger": "string",
    "deratingTrigger": "string"
  }
}`;
}
