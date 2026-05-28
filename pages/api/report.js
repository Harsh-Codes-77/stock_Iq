// pages/api/report.js
// 1. Fetch real data (Yahoo + Screener + NSE + News)
// 2. Pre-compute all quantitative scores server-side
// 3. Build AI prompt with pre-computed numbers
// 4. Call Gemini for interpretation only
// 5. Return merged computed data + AI analysis

import { fetchAllData } from '../../lib/fetchAllData.js';
import {
  calculatePiotroskiScore,
  calculateBeneishMScore,
  calculateAltmanZScore,
  calculateDuPont,
  calculateWorkingCapitalCycle,
  calculateWACC,
  calculateDCF,
  calculateSensitivityMatrix,
} from '../../lib/quantScores.js';
import { buildSystemPrompt, buildUserPrompt } from '../../lib/geminiPrompt.js';

const TOTAL_TIMEOUT_MS = 55000;
const AI_TIMEOUT_MS = 40000;

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(504).json({ error: 'Report generation timed out.' });
    }
  }, TOTAL_TIMEOUT_MS);

  const safeJson = (status, body) => {
    if (timedOut || res.headersSent) return;
    clearTimeout(timeoutId);
    res.status(status).json(body);
  };

  const { ticker, sector } = req.body;
  if (!ticker) return safeJson(400, { error: 'Ticker required' });

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openrouterModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const openrouterMaxTokens = Number(process.env.OPENROUTER_MAX_TOKENS || 8192);

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openrouterKey && !geminiKey) {
    return safeJson(500, { error: 'Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured' });
  }

  // ── Step 1: Fetch all data ──────────────────────────────────────────────────
  let rawData = null;
  let dataFetchError = null;

  try {
    rawData = await fetchAllData(ticker, null);
  } catch (err) {
    dataFetchError = err.message;
    console.error('[report] Data fetch failed:', err.message);
  }

  if (!rawData) {
    return safeJson(500, { error: 'Failed to fetch financial data. ' + (dataFetchError || '') });
  }

  // ── Step 2: Compute all quantitative scores ─────────────────────────────────
  console.log('[report] Computing quantitative scores...');
  const piotroski = calculatePiotroskiScore(rawData);
  const beneish = calculateBeneishMScore(rawData);
  const altman = calculateAltmanZScore(rawData);
  const dupont = calculateDuPont(rawData);
  const wcc = calculateWorkingCapitalCycle(rawData);
  const wacc = calculateWACC(rawData);
  const dcf = calculateDCF(rawData, wacc);
  const sensitivity = calculateSensitivityMatrix(rawData, wacc);

  console.log(`[report] Piotroski: ${piotroski.score}/9, Beneish: ${beneish.mScore}, Altman: ${altman.zScore}`);

  // ── Step 3: Build prompt ────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    rawData.symbol || ticker,
    rawData.companyName || ticker,
    rawData,
    { piotroski, beneish, altman, dupont, wcc, wacc, dcf, sensitivity }
  );

  // ── Step 4: Call AI (OpenRouter with Gemini Fallback) ───────────────────────
  let aiAnalysis = null;

  if (openrouterKey) {
    try {
      console.log(`[report] Calling OpenRouter ${openrouterModel}...`);
      const result = await callOpenRouter(openrouterKey, openrouterModel, openrouterMaxTokens, systemPrompt, userPrompt);
      console.log(`[report] OpenRouter ${openrouterModel} success — ${result.length} chars`);
      aiAnalysis = extractJson(result);
    } catch (err) {
      console.error(`[report] OpenRouter failed:`, err.message);
    }
  }

  if (!aiAnalysis && geminiKey) {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

    for (const model of models) {
      try {
        console.log(`[report] Calling Gemini ${model}...`);
        const result = await callGemini(geminiKey, model, systemPrompt, userPrompt);
        console.log(`[report] Gemini ${model} success — ${result.length} chars`);
        aiAnalysis = extractJson(result);
        break;
      } catch (err) {
        console.error(`[report] Gemini ${model} failed:`, err.message);
        if (model === models[models.length - 1]) {
          console.error('[report] All Gemini models failed');
        }
      }
    }
  }

  // ── Step 5: Merge and return ────────────────────────────────────────────────
  const finalReport = {
    // Computed scores (never from AI)
    computedScores: { piotroski, beneish, altman, dupont, wcc, wacc, dcf, sensitivity },

    // Raw financial data for charts
    financials: {
      annualYears: rawData.annualYears || [],
      revenue: rawData.revenue || [],
      ebitda: rawData.ebitda || [],
      pat: rawData.pat || [],
      cfo: rawData.cfo || [],
      freeCashFlow: rawData.freeCashFlow || [],
    },
    quarterly: rawData.quarterly || {},
    ratioTrend: rawData.ratioTrend || {},

    // Current metrics
    currentMetrics: rawData.currentMetrics || {},
    price: rawData.price,
    priceChange: rawData.priceChange,
    priceChangePct: rawData.priceChangePct,
    high52w: rawData.high52w,
    low52w: rawData.low52w,
    marketCap: rawData.marketCap,

    // Shareholding
    shareholding: rawData.shareholding || {},

    // AI analysis (interpretation only)
    aiAnalysis: aiAnalysis || buildFallbackAnalysis(),

    // Meta
    companyName: rawData.companyName,
    symbol: rawData.symbol,
    sector: rawData.sector || sector || '',
    industry: rawData.industry || '',
    news: rawData.news || [],
    about: rawData.about || '',
    generatedAt: new Date().toISOString(),
    dataSources: rawData.meta?.sources || [],
    dataQuality: rawData.dataQuality || {},
  };

  if (!timedOut) res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
  return safeJson(200, { success: true, data: finalReport });
}

// ── Gemini API call ───────────────────────────────────────────────────────────
async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  if (model.includes('2.5')) {
    requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    if (response.status === 429) throw new Error(`Rate limited on ${model}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error(`Empty response from ${model}`);
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}

// ── OpenRouter API call ───────────────────────────────────────────────────────────
async function callOpenRouter(apiKey, model, maxTokens, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://stockiq.app',
        'X-Title': 'StockIQ Research',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error(`OpenRouter rate limited on ${model}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    if (!raw) throw new Error(`Empty response from OpenRouter ${model}`);
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}

// ── JSON extractor ────────────────────────────────────────────────────────────
function extractJson(text) {
  let clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Strategy 1: Direct parse
  try { return JSON.parse(clean); } catch {}

  // Strategy 2: Fix newlines in strings
  try { return JSON.parse(fixNewlinesInJsonStrings(clean)); } catch {}

  // Strategy 3: Extract largest JSON block
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
    try { return JSON.parse(fixNewlinesInJsonStrings(m[0])); } catch {}
  }

  // Strategy 4: Repair truncated JSON
  try { return JSON.parse(repairTruncatedJson(clean)); } catch {}

  throw new Error('Could not parse Gemini JSON response');
}

function fixNewlinesInJsonStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      if (ch.charCodeAt(0) < 0x20) continue;
    }
    result += ch;
  }
  return result;
}

function repairTruncatedJson(text) {
  let repaired = text;
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  repaired = repaired.replace(/,\s*$/, '');
  const stack = [];
  let inStr = false, esc = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack.length && stack[stack.length - 1] === ch) stack.pop();
  }
  if (inStr) repaired += '"';
  while (stack.length) repaired += stack.pop();
  return repaired;
}

// ── Fallback analysis when AI fails ───────────────────────────────────────────
function buildFallbackAnalysis() {
  return {
    executiveSummary: {
      oneLiner: 'AI analysis unavailable — quantitative scores computed successfully.',
      investmentThesis: 'Review the pre-computed Piotroski, Beneish, and Altman scores for a quantitative assessment.',
      keyRisk: 'AI interpretation unavailable.',
      verdict: 'HOLD',
      confidenceLevel: 'LOW',
      targetPrice12M: 0,
    },
    businessOverview: {
      businessModel: 'Data unavailable.',
      competitiveMoat: 'Data unavailable.',
      moatStrength: 'MODERATE',
      capitalAllocationQuality: 'Review ROCE trend in financials tab.',
      managementRedFlags: [],
    },
    financialAnalysis: {
      revenueQuality: 'See CFO vs PAT chart in forensics tab.',
      marginAnalysis: 'See EBITDA margin trend in financials tab.',
      balanceSheetStrength: 'See Altman Z-Score in forensics tab.',
      earningsQuality: {
        piotroskiInterpretation: 'See computed score.',
        beneishInterpretation: 'See computed score.',
        cfoPatAnalysis: 'See computed data.',
      },
      dupontInsight: 'See DuPont decomposition in financials tab.',
    },
    valuationAnalysis: {
      multipleAssessment: 'Review P/E and EV/EBITDA in valuation tab.',
      dcfInterpretation: 'See computed DCF bear/base/bull values.',
      relativeValuation: 'Data unavailable.',
      marginOfSafety: 'See DCF base case vs CMP.',
    },
    riskMatrix: [{ risk: 'AI Unavailable', description: 'Full risk analysis requires AI interpretation.', severity: 'LOW', probability: 'HIGH' }],
    altmanZInterpretation: 'See computed Z-Score.',
    shareholdingInsight: 'See shareholding tab for trend data.',
    catalysts: { positive: ['Data unavailable'], negative: ['Data unavailable'] },
    overallScore: { businessQuality: 5, financialHealth: 5, valuation: 5, management: 5, overall: 5 },
  };
}
