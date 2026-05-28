// lib/quantScores.js
// Pre-computed quantitative scoring models — pure Node.js math
// Made fully null-safe to prevent NaN and mathematical distortions.

// ─── Helper functions ──────────────────────────────────────────────────────────
function safe(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function safeDiv(a, b, fallback = null) {
  const na = safe(a);
  const nb = safe(b);
  if (na === null || nb === null || nb === 0) return fallback;
  return na / nb;
}

// ─── Piotroski F-Score (0–9) ───────────────────────────────────────────────────
export function calculatePiotroskiScore(data) {
  const signals = {};

  const pat0 = safe(data.pat?.[0]);
  const pat1 = safe(data.pat?.[1]);
  const cfo0 = safe(data.cfo?.[0]);
  const ta0  = safe(data.totalAssets?.[0]);
  const ta1  = safe(data.totalAssets?.[1]);
  const debt0 = safe(data.totalDebt?.[0]);
  const debt1 = safe(data.totalDebt?.[1]);
  const eq0  = safe(data.totalEquity?.[0]);
  const eq1  = safe(data.totalEquity?.[1]);
  const ca0  = safe(data.currentAssets?.[0]);
  const ca1  = safe(data.currentAssets?.[1]);
  const cl0  = safe(data.currentLiabilities?.[0]);
  const cl1  = safe(data.currentLiabilities?.[1]);
  const shares0 = safe(data.sharesOutstanding?.[0]);
  const shares1 = safe(data.sharesOutstanding?.[1]);
  const ebitda0 = safe(data.ebitda?.[0]);
  const ebitda1 = safe(data.ebitda?.[1]);
  const rev0 = safe(data.revenue?.[0]);
  const rev1 = safe(data.revenue?.[1]);

  const hasMinData = pat0 !== null && ta0 !== null && rev0 !== null;
  if (!hasMinData) {
    return {
      score: null,
      signals: {},
      interpretation: 'N/A',
      message: 'Unable to compute — key financials missing from data sources'
    };
  }

  // Profitability (4 signals)
  const roa0 = safeDiv(pat0, ta0);
  const roa1 = safeDiv(pat1, ta1);
  signals.roa = (roa0 !== null && roa0 > 0) ? 1 : 0;
  signals.cfoPositive = (cfo0 !== null && cfo0 > 0) ? 1 : 0;
  signals.roaImproving = (roa0 !== null && roa1 !== null && roa0 > roa1) ? 1 : 0;

  const cfoTa = safeDiv(cfo0, ta0);
  signals.accruals = (cfoTa !== null && roa0 !== null && cfoTa > roa0) ? 1 : 0;

  // Leverage / Liquidity (3 signals)
  const lev0 = safeDiv(debt0, eq0);
  const lev1 = safeDiv(debt1, eq1);
  signals.leverageDecreasing = (lev0 !== null && lev1 !== null && lev0 < lev1) ? 1 : 0;

  const liq0 = safeDiv(ca0, cl0);
  const liq1 = safeDiv(ca1, cl1);
  signals.liquidityImproving = (liq0 !== null && liq1 !== null && liq0 > liq1) ? 1 : 0;
  
  signals.noShareDilution = (shares0 !== null && shares1 !== null && shares0 <= shares1) ? 1 : 0;

  // Operating Efficiency (2 signals)
  const gm0 = safeDiv(ebitda0, rev0);
  const gm1 = safeDiv(ebitda1, rev1);
  signals.grossMarginImproving = (gm0 !== null && gm1 !== null && gm0 > gm1) ? 1 : 0;

  const ato0 = safeDiv(rev0, ta0);
  const ato1 = safeDiv(rev1, ta1);
  signals.assetTurnoverImproving = (ato0 !== null && ato1 !== null && ato0 > ato1) ? 1 : 0;

  const score = Object.values(signals).reduce((a, b) => a + b, 0);

  return {
    score,
    signals,
    interpretation: score >= 7 ? 'STRONG' : score >= 4 ? 'MODERATE' : 'WEAK',
  };
}

// ─── Beneish M-Score (Earnings Manipulation Detection) ─────────────────────────
export function calculateBeneishMScore(data) {
  const t = 0;
  const t1 = 1;

  const rev0 = safe(data.revenue?.[t]);
  const rev1 = safe(data.revenue?.[t1]);
  const recv0 = safe(data.tradeReceivables?.[t]);
  const recv1 = safe(data.tradeReceivables?.[t1]);
  const cogs0 = safe(data.cogs?.[t], rev0 !== null ? rev0 * 0.6 : null);
  const cogs1 = safe(data.cogs?.[t1], rev1 !== null ? rev1 * 0.6 : null);
  const ca0 = safe(data.currentAssets?.[t]);
  const ca1 = safe(data.currentAssets?.[t1]);
  const ppe0 = safe(data.ppe?.[t], safe(data.totalAssets?.[t]) !== null ? safe(data.totalAssets?.[t]) * 0.3 : null);
  const ppe1 = safe(data.ppe?.[t1], safe(data.totalAssets?.[t1]) !== null ? safe(data.totalAssets?.[t1]) * 0.3 : null);
  const ta0 = safe(data.totalAssets?.[t]);
  const ta1 = safe(data.totalAssets?.[t1]);
  const dep0 = safe(data.depreciation?.[t], ppe0 !== null ? ppe0 * 0.05 : null);
  const dep1 = safe(data.depreciation?.[t1], ppe1 !== null ? ppe1 * 0.05 : null);
  const sgna0 = safe(data.sgna?.[t], rev0 !== null ? rev0 * 0.1 : null);
  const sgna1 = safe(data.sgna?.[t1], rev1 !== null ? rev1 * 0.1 : null);
  const pat0 = safe(data.pat?.[t]);
  const cfo0 = safe(data.cfo?.[t]);
  const debt0 = safe(data.totalDebt?.[t]);
  const debt1 = safe(data.totalDebt?.[t1]);

  const hasMinData = rev0 !== null && rev1 !== null && ta0 !== null && ta1 !== null;
  if (!hasMinData) {
    return {
      mScore: null,
      threshold: -1.78,
      flag: 'N/A',
      components: {},
    };
  }

  const DSRI = safeDiv(safeDiv(recv0, rev0), safeDiv(recv1, rev1)) ?? 1.0;
  const GMI  = safeDiv(safeDiv(rev1 - cogs1, rev1), safeDiv(rev0 - cogs0, rev0)) ?? 1.0;
  const AQI  = safeDiv(1 - safeDiv(ca0 + ppe0, ta0), 1 - safeDiv(ca1 + ppe1, ta1)) ?? 1.0;
  const SGI  = safeDiv(rev0, rev1) ?? 1.0;
  const DEPI = safeDiv(safeDiv(dep1, dep1 + ppe1), safeDiv(dep0, dep0 + ppe0)) ?? 1.0;
  const SGAI = safeDiv(safeDiv(sgna0, rev0), safeDiv(sgna1, rev1)) ?? 1.0;
  const TATA = safeDiv(pat0 - cfo0, ta0) ?? 0.0;
  const LVGI = safeDiv(safeDiv(debt0, ta0), safeDiv(debt1, ta1)) ?? 1.0;

  const mScore = -4.84 + (0.92 * DSRI) + (0.528 * GMI) + (0.404 * AQI) +
    (0.892 * SGI) + (0.115 * DEPI) - (0.172 * SGAI) + (4.679 * TATA) - (0.327 * LVGI);

  return {
    mScore: Number.isFinite(mScore) ? parseFloat(mScore.toFixed(2)) : null,
    threshold: -1.78,
    flag: mScore > -1.78 ? 'POSSIBLE_MANIPULATION' : 'CLEAN',
    components: {
      DSRI: parseFloat(DSRI.toFixed(3)),
      GMI: parseFloat(GMI.toFixed(3)),
      AQI: parseFloat(AQI.toFixed(3)),
      SGI: parseFloat(SGI.toFixed(3)),
      DEPI: parseFloat(DEPI.toFixed(3)),
      SGAI: parseFloat(SGAI.toFixed(3)),
      TATA: parseFloat(TATA.toFixed(4)),
      LVGI: parseFloat(LVGI.toFixed(3)),
    },
  };
}

// ─── Altman Z-Score (Emerging Markets Z'' version) ─────────────────────────────
export function calculateAltmanZScore(data) {
  const t = 0;
  const ca = safe(data.currentAssets?.[t]);
  const cl = safe(data.currentLiabilities?.[t]);
  const ta = safe(data.totalAssets?.[t]);
  const re = safe(data.retainedEarnings?.[t], safe(data.totalEquity?.[t]) !== null ? safe(data.totalEquity?.[t]) * 0.7 : null);
  const ebit = safe(data.ebit?.[t], safe(data.ebitda?.[t]) !== null ? safe(data.ebitda?.[t]) * 0.85 : null);
  const eq = safe(data.totalEquity?.[t]);
  const debt = safe(data.totalDebt?.[t]);

  const hasMinData = ta !== null && ta !== 0;
  if (!hasMinData) {
    return {
      zScore: null,
      zone: 'N/A',
      components: {},
    };
  }

  const X1 = safeDiv(ca - cl, ta) ?? 0.0;
  const X2 = safeDiv(re, ta) ?? 0.0;
  const X3 = safeDiv(ebit, ta) ?? 0.0;
  const X4 = (debt !== null && debt > 0) ? (safeDiv(eq, debt) ?? 10.0) : 10.0;

  const zScore = (6.56 * X1) + (3.26 * X2) + (6.72 * X3) + (1.05 * Math.min(X4, 10));

  return {
    zScore: Number.isFinite(zScore) ? parseFloat(zScore.toFixed(2)) : null,
    zone: zScore > 2.6 ? 'SAFE' : zScore > 1.1 ? 'GREY' : 'DISTRESS',
    components: {
      X1: parseFloat(X1.toFixed(4)),
      X2: parseFloat(X2.toFixed(4)),
      X3: parseFloat(X3.toFixed(4)),
      X4: parseFloat(Math.min(X4, 10).toFixed(4)),
    },
  };
}

// ─── DuPont 3-Factor Decomposition ─────────────────────────────────────────────
export function calculateDuPont(data) {
  const t = 0;
  const pat = safe(data.pat?.[t]);
  const rev = safe(data.revenue?.[t]);
  const ta = safe(data.totalAssets?.[t]);
  const eq = safe(data.totalEquity?.[t]);

  if (pat === null || rev === null || rev === 0 || ta === null || ta === 0 || eq === null || eq === 0) {
    return {
      netProfitMargin: null,
      assetTurnover: null,
      equityMultiplier: null,
      roe: null,
      analysis: 'N/A',
    };
  }

  const netProfitMargin = pat / rev;
  const assetTurnover = rev / ta;
  const equityMultiplier = ta / eq;
  const roe = netProfitMargin * assetTurnover * equityMultiplier;

  return {
    netProfitMargin: parseFloat((netProfitMargin * 100).toFixed(1)),
    assetTurnover: parseFloat(assetTurnover.toFixed(2)),
    equityMultiplier: parseFloat(equityMultiplier.toFixed(2)),
    roe: parseFloat((roe * 100).toFixed(1)),
    analysis: netProfitMargin > assetTurnover ? 'MARGIN_DRIVEN' : 'TURNOVER_DRIVEN',
  };
}

// ─── Working Capital Cycle ─────────────────────────────────────────────────────
export function calculateWorkingCapitalCycle(data) {
  const t = 0;
  const rev = safe(data.revenue?.[t]);
  const recv = safe(data.tradeReceivables?.[t]);
  const inv = safe(data.inventory?.[t]);
  const pay = safe(data.tradePayables?.[t]);
  const cogs = safe(data.cogs?.[t], rev !== null ? rev * 0.6 : null);

  if (rev === null || rev === 0) {
    return {
      daysReceivables: null,
      daysInventory: null,
      daysPayable: null,
      cashConversionCycle: null,
    };
  }

  const daysReceivables = safeDiv(recv, rev) * 365;
  const daysInventory = inv > 0 ? safeDiv(inv, cogs) * 365 : 0;
  const daysPayable = pay > 0 ? safeDiv(pay, cogs) * 365 : 0;
  const cashConversionCycle = daysReceivables + daysInventory - daysPayable;

  return {
    daysReceivables: daysReceivables !== null ? parseFloat(daysReceivables.toFixed(0)) : null,
    daysInventory: daysInventory !== null ? parseFloat(daysInventory.toFixed(0)) : null,
    daysPayable: daysPayable !== null ? parseFloat(daysPayable.toFixed(0)) : null,
    cashConversionCycle: cashConversionCycle !== null ? parseFloat(cashConversionCycle.toFixed(0)) : null,
  };
}

// ─── WACC (Weighted Average Cost of Capital) ───────────────────────────────────
export function calculateWACC(data, riskFreeRate = 0.07) {
  const beta = safe(data.beta);
  const mcap = safe(data.marketCap);
  const debt = safe(data.totalDebt?.[0]) ?? 0;

  if (mcap === null || mcap === 0) {
    return {
      wacc: null,
      costOfEquity: null,
      costOfDebt: null,
      debtRatio: null,
      equityRatio: null,
      beta: null,
      riskFreeRate,
    };
  }

  const safeBeta = beta !== null ? beta : 1.0;
  const marketRiskPremium = 0.07;
  const costOfEquity = riskFreeRate + (safeBeta * marketRiskPremium);

  const debtRatio = debt / (debt + mcap);
  const equityRatio = 1 - debtRatio;
  const costOfDebt = 0.09;
  const taxRate = 0.25;

  const wacc = (equityRatio * costOfEquity) + (debtRatio * costOfDebt * (1 - taxRate));

  return {
    wacc: parseFloat(wacc.toFixed(4)),
    costOfEquity: parseFloat(costOfEquity.toFixed(4)),
    costOfDebt,
    debtRatio: parseFloat(debtRatio.toFixed(4)),
    equityRatio: parseFloat(equityRatio.toFixed(4)),
    beta: safeBeta,
    riskFreeRate,
  };
}

// ─── DCF Valuation (3 scenarios) ───────────────────────────────────────────────
export function calculateDCF(data, wacc) {
  const price = safe(data.price);
  const shares = safe(data.sharesOutstanding?.[0]);
  const waccRate = safe(wacc?.wacc);

  if (price === null || price === 0 || shares === null || shares === 0 || waccRate === null) {
    return {
      bear: null,
      base: null,
      bull: null,
      note: 'Insufficient data for WACC/Price/Shares to run DCF',
    };
  }

  const lastFCF = safe(data.freeCashFlow?.[0], safe(data.cfo?.[0]) !== null ? safe(data.cfo?.[0]) * 0.7 : null);
  const netDebt = (safe(data.totalDebt?.[0]) ?? 0) - (safe(data.cash?.[0]) ?? 0);

  if (lastFCF === null || lastFCF <= 0) {
    return {
      bear: { intrinsicValue: Math.round(price * 0.8), upside: '-20.0' },
      base: { intrinsicValue: Math.round(price * 1.0), upside: '0.0' },
      bull: { intrinsicValue: Math.round(price * 1.3), upside: '30.0' },
      note: 'Negative/missing FCF — fallback to multiples-based estimate',
    };
  }

  const scenarios = {
    bear: { growthRate: 0.05, terminalGrowth: 0.04 },
    base: { growthRate: 0.12, terminalGrowth: 0.05 },
    bull: { growthRate: 0.20, terminalGrowth: 0.06 },
  };

  const results = {};
  for (const [key, s] of Object.entries(scenarios)) {
    const projectedFCFs = [];
    for (let i = 1; i <= 5; i++) {
      projectedFCFs.push(lastFCF * Math.pow(1 + s.growthRate, i));
    }

    const pvFCFs = projectedFCFs.reduce((sum, fcf, i) => {
      return sum + fcf / Math.pow(1 + waccRate, i + 1);
    }, 0);

    const terminalValue = projectedFCFs[4] * (1 + s.terminalGrowth) / Math.max(waccRate - s.terminalGrowth, 0.01);
    const pvTerminal = terminalValue / Math.pow(1 + waccRate, 5);

    const enterpriseValue = pvFCFs + pvTerminal;
    const equityValue = enterpriseValue - netDebt;
    const intrinsicValue = Math.max(0, equityValue / shares);

    results[key] = {
      intrinsicValue: Math.round(intrinsicValue),
      upside: ((intrinsicValue - price) / price * 100).toFixed(1),
      projectedFCFs: projectedFCFs.map(f => Math.round(f)),
      terminalValue: Math.round(terminalValue),
      enterpriseValue: Math.round(enterpriseValue),
    };
  }

  return results;
}

// ─── Sensitivity Matrix (growth × WACC grid) ──────────────────────────────────
export function calculateSensitivityMatrix(data, wacc) {
  const price = safe(data.price);
  const shares = safe(data.sharesOutstanding?.[0]);
  const waccRate = safe(wacc?.wacc);

  if (price === null || price === 0 || shares === null || shares === 0 || waccRate === null) {
    return {
      growthRates: [],
      waccRates: [],
      matrix: [],
      currentPrice: null,
    };
  }

  const lastFCF = safe(data.freeCashFlow?.[0], safe(data.cfo?.[0]) !== null ? safe(data.cfo?.[0]) * 0.7 : null);
  const netDebt = (safe(data.totalDebt?.[0]) ?? 0) - (safe(data.cash?.[0]) ?? 0);

  const growthRates = [0.05, 0.08, 0.12, 0.15, 0.18];
  const waccRates = [0.08, 0.09, 0.10, 0.11, 0.12];
  const terminalGrowth = 0.05;

  const matrix = growthRates.map(g => {
    return waccRates.map(w => {
      if (lastFCF === null || lastFCF <= 0) return Math.round(price * (1 + g));
      const fcfs = [];
      for (let i = 1; i <= 5; i++) fcfs.push(lastFCF * Math.pow(1 + g, i));
      const pvFCFs = fcfs.reduce((s, f, i) => s + f / Math.pow(1 + w, i + 1), 0);
      const tv = fcfs[4] * (1 + terminalGrowth) / Math.max(w - terminalGrowth, 0.01);
      const pvTV = tv / Math.pow(1 + w, 5);
      const ev = pvFCFs + pvTV;
      const eq = ev - netDebt;
      return Math.max(0, Math.round(eq / shares));
    });
  });

  return {
    growthRates: growthRates.map(g => `${(g * 100).toFixed(0)}%`),
    waccRates: waccRates.map(w => `${(w * 100).toFixed(0)}%`),
    matrix,
    currentPrice: Math.round(price),
  };
}
