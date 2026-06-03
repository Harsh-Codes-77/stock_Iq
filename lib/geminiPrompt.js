// lib/geminiPrompt.js
// Builds the system + user prompt for Gemini
// Philosophy: AI interprets pre-computed numbers, never generates them

export function buildSystemPrompt() {
  return `You are a senior equity research analyst at a multi-billion dollar Indian hedge fund.
You write research notes in the style of Motilal Oswal Institutional Equities or Kotak Securities research — precise, data-backed, and direct.

Rules you must follow:
- Never make up numbers. All financial data is provided to you. Use ONLY the data provided.
- Every claim must reference a specific data point.
- If data is missing or seems unreliable, say so explicitly rather than guessing.
- Be direct about risks. Do not write promotional content.
- Use plain English. No buzzwords like "robust", "synergies", "headwinds" unless specifically appropriate.
- Write in active voice.
- Identify contradictions in the data (e.g. PAT growing but CFO declining is a red flag — say so).
- Return ONLY valid JSON — no markdown fences, no text outside the JSON.`;
}

export function buildUserPrompt(ticker, stockName, data, scores) {
  const { piotroski, beneish, altman, dupont, wcc, wacc, dcf, sensitivity } = scores;

  const newsHeadlines = (data.news || []).map(n => `[${n.publishedAt}] ${n.title} — ${n.source}`);
  const revArr = data.revenue || [];
  const ebitdaArr = data.ebitda || [];
  const patArr = data.pat || [];
  const cfoArr = data.cfo || [];
  const fcfArr = data.freeCashFlow || [];
  const roceArr = data.ratioTrend?.roce || [];
  const deArr = data.ratioTrend?.debtEquity || [];

  // Build formatted arrays (newest first)
  const fmtArr = (arr) => arr.length ? arr.join(', ') : 'N/A';

  return `
Analyze ${stockName} (${ticker}) and produce a structured research report.

## PRE-COMPUTED QUANTITATIVE DATA (use these numbers exactly, do not change them):

### Piotroski F-Score: ${piotroski.score}/9 (${piotroski.interpretation})
Signal breakdown:
${Object.entries(piotroski.signals).map(([k, v]) => `- ${k}: ${v ? 'PASS' : 'FAIL'}`).join('\n')}

### Beneish M-Score: ${beneish.mScore} (threshold: -1.78, result: ${beneish.flag})
Components: DSRI=${beneish.components.DSRI}, GMI=${beneish.components.GMI}, AQI=${beneish.components.AQI}, SGI=${beneish.components.SGI}, DEPI=${beneish.components.DEPI}, SGAI=${beneish.components.SGAI}, TATA=${beneish.components.TATA}, LVGI=${beneish.components.LVGI}
High DSRI means receivables growing faster than revenue. High TATA means accruals are high relative to assets.

### Altman Z-Score: ${altman.zScore} (${altman.zone} zone)
Components: X1=${altman.components.X1}, X2=${altman.components.X2}, X3=${altman.components.X3}, X4=${altman.components.X4}

### DuPont ROE Decomposition:
- Net Profit Margin: ${dupont.netProfitMargin}%
- Asset Turnover: ${dupont.assetTurnover}x
- Equity Multiplier: ${dupont.equityMultiplier}x
- Implied ROE: ${dupont.roe}% (${dupont.analysis})

### DCF Intrinsic Value (WACC: ${(wacc.wacc * 100).toFixed(1)}%):
- Bear Case: ₹${dcf.bear?.intrinsicValue} (${dcf.bear?.upside}% vs CMP)
- Base Case: ₹${dcf.base?.intrinsicValue} (${dcf.base?.upside}% vs CMP)
- Bull Case: ₹${dcf.bull?.intrinsicValue} (${dcf.bull?.upside}% vs CMP)

### Working Capital Cycle:
- Days Receivables: ${wcc.daysReceivables} days
- Days Inventory: ${wcc.daysInventory} days
- Days Payable: ${wcc.daysPayable} days
- Cash Conversion Cycle: ${wcc.cashConversionCycle} days

### Annual Financials (newest to oldest):
Revenue (₹ Cr): ${fmtArr(revArr)}
EBITDA (₹ Cr): ${fmtArr(ebitdaArr)}
PAT (₹ Cr): ${fmtArr(patArr)}
CFO (₹ Cr): ${fmtArr(cfoArr)}
Free Cash Flow (₹ Cr): ${fmtArr(fcfArr)}
ROCE (%): ${fmtArr(roceArr)}
D/E Ratio: ${fmtArr(deArr)}

### Current Valuation Multiples:
P/E: ${data.currentMetrics?.peRatio || 'N/A'}x | P/B: ${data.currentMetrics?.pbRatio || 'N/A'}x | EV/EBITDA: ${data.currentMetrics?.evEbitda || 'N/A'}x
Market Cap: ₹${data.marketCap || 'N/A'} Cr | CMP: ₹${data.price || 'N/A'}
ROE: ${data.currentMetrics?.roe || 'N/A'}% | ROCE: ${data.currentMetrics?.roce || 'N/A'}%

### Shareholding Pattern:
Promoter: ${data.shareholding?.promoterHolding}% (Pledge: ${data.shareholding?.promoterPledge}%)
FII: ${data.shareholding?.fiiHolding}% | DII: ${data.shareholding?.diiHolding}%
Promoter holding trend (quarters): ${data.shareholding?.trend?.map(t => t.promoter).join(', ') || 'N/A'}

### Recent News Headlines:
${newsHeadlines.length ? newsHeadlines.join('\n') : 'No recent news available'}

---

## Your Task

Return a JSON object with EXACTLY this structure. Do not add any text outside the JSON:

{
  "executiveSummary": {
    "oneLiner": "One sentence describing the company's core business",
    "investmentThesis": "2-3 sentence thesis: why this stock is or isn't worth buying RIGHT NOW based on the data above",
    "keyRisk": "The single most important risk that could make this thesis wrong",
    "verdict": "BUY or HOLD or SELL or AVOID",
    "confidenceLevel": "HIGH or MEDIUM or LOW",
    "targetPrice12M": number
  },
  "businessOverview": {
    "businessModel": "How does this company make money? Be specific — segments, margins, customers",
    "competitiveMoat": "What is the durable advantage? Pricing power, switching costs, network effects, cost advantage, or none",
    "moatStrength": "STRONG or MODERATE or WEAK or NONE",
    "capitalAllocationQuality": "How well has management deployed capital? Reference ROCE trend and FCF",
    "managementRedFlags": ["List specific red flags from data — pledge increase, DSRI spike, promoter selling, etc."]
  },
  "financialAnalysis": {
    "revenueQuality": "Is revenue growth backed by cash flows? CFO vs PAT trend",
    "marginAnalysis": "EBITDA margin trajectory — expanding, stable, or compressing?",
    "balanceSheetStrength": "Debt levels, current ratio, FCF generation",
    "earningsQuality": {
      "piotroskiInterpretation": "What the F-Score means for this company",
      "beneishInterpretation": "M-Score result — manipulation risk? Which components drove it?",
      "cfoPatAnalysis": "CFO vs PAT ratio trend — does the company actually generate the cash it reports?"
    },
    "dupontInsight": "What does DuPont tell us — margins, efficiency, or leverage driving ROE?"
  },
  "valuationAnalysis": {
    "multipleAssessment": "Is P/E and EV/EBITDA justified by growth and ROCE?",
    "dcfInterpretation": "Under what conditions does bull/base/bear play out?",
    "relativeValuation": "vs sector average — premium or discount, is it deserved?",
    "marginOfSafety": "At current price, margin of safety vs base case DCF?"
  },
  "riskMatrix": [
    {"risk": "name", "description": "specific description with data reference", "severity": "HIGH or MEDIUM or LOW", "probability": "HIGH or MEDIUM or LOW"}
  ],
  "altmanZInterpretation": "What does Z-Score zone mean for financial distress risk?",
  "shareholdingInsight": "Interpret promoter pledge, FII/DII trend, significant changes",
  "catalysts": {
    "positive": ["2-3 specific events that could drive upside"],
    "negative": ["2-3 specific events that could drive downside"]
  },
  "overallScore": {
    "businessQuality": number 0-10,
    "financialHealth": number 0-10,
    "valuation": number 0-10,
    "management": number 0-10,
    "overall": number 0-10
  }
}`;
}
