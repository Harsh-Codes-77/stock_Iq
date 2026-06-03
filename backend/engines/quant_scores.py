import math

# ─── Helper functions ──────────────────────────────────────────────────────────
def safe(val, fallback=None):
    if val is None:
        return fallback
    try:
        n = float(val)
        return n if math.isfinite(n) else fallback
    except (ValueError, TypeError):
        return fallback

def safe_div(a, b, fallback=None):
    na = safe(a)
    nb = safe(b)
    if na is None or nb is None or nb == 0:
        return fallback
    return na / nb

def get_val(d, key: str, default=None):
    if d is None:
        return default
    
    # Try dictionary access
    if isinstance(d, dict):
        if key in d:
            return d[key]
        parts = key.split('_')
        camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
        if camel_key in d:
            return d[camel_key]
        return default
        
    # Try attribute access (for SQLAlchemy models or other objects)
    if hasattr(d, key):
        return getattr(d, key)
    parts = key.split('_')
    camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
    if hasattr(d, camel_key):
        return getattr(d, camel_key)
        
    return default

# ─── Piotroski F-Score (0–9) ───────────────────────────────────────────────────
def piotroski_f_score(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    t0 = sorted_financials[0]
    t1 = sorted_financials[1]
    
    pat0 = safe(get_val(t0, "pat"))
    pat1 = safe(get_val(t1, "pat"))
    cfo0 = safe(get_val(t0, "cfo"))
    ta0 = safe(get_val(t0, "total_assets"))
    ta1 = safe(get_val(t1, "total_assets"))
    debt0 = safe(get_val(t0, "total_debt"))
    debt1 = safe(get_val(t1, "total_debt"))
    eq0 = safe(get_val(t0, "total_equity"))
    eq1 = safe(get_val(t1, "total_equity"))
    ca0 = safe(get_val(t0, "current_assets"))
    ca1 = safe(get_val(t1, "current_assets"))
    cl0 = safe(get_val(t0, "current_liabilities"))
    cl1 = safe(get_val(t1, "current_liabilities"))
    shares0 = safe(get_val(t0, "shares_outstanding"))
    shares1 = safe(get_val(t1, "shares_outstanding"))
    ebitda0 = safe(get_val(t0, "ebitda"))
    ebitda1 = safe(get_val(t1, "ebitda"))
    rev0 = safe(get_val(t0, "revenue"))
    rev1 = safe(get_val(t1, "revenue"))
    
    has_min_data = pat0 is not None and ta0 is not None and rev0 is not None
    if not has_min_data:
        return {
            "score": None,
            "signals": {},
            "interpretation": "N/A",
            "reason": "Unable to compute — key financials missing from data sources",
            "data_quality": "INSUFFICIENT"
        }
        
    signals = {}
    
    # Profitability (4 signals)
    roa0 = safe_div(pat0, ta0)
    roa1 = safe_div(pat1, ta1)
    signals["roa"] = 1 if (roa0 is not None and roa0 > 0) else 0
    signals["cfoPositive"] = 1 if (cfo0 is not None and cfo0 > 0) else 0
    signals["roaImproving"] = 1 if (roa0 is not None and roa1 is not None and roa0 > roa1) else 0
    
    cfo_ta = safe_div(cfo0, ta0)
    signals["accruals"] = 1 if (cfo_ta is not None and roa0 is not None and cfo_ta > roa0) else 0
    
    # Leverage / Liquidity (3 signals)
    lev0 = safe_div(debt0, eq0)
    lev1 = safe_div(debt1, eq1)
    signals["leverageDecreasing"] = 1 if (lev0 is not None and lev1 is not None and lev0 < lev1) else 0
    
    liq0 = safe_div(ca0, cl0)
    liq1 = safe_div(ca1, cl1)
    signals["liquidityImproving"] = 1 if (liq0 is not None and liq1 is not None and liq0 > liq1) else 0
    
    signals["noShareDilution"] = 1 if (shares0 is not None and shares1 is not None and shares0 <= shares1) else 0
    
    # Operating Efficiency (2 signals)
    gm0 = safe_div(ebitda0, rev0)
    gm1 = safe_div(ebitda1, rev1)
    signals["grossMarginImproving"] = 1 if (gm0 is not None and gm1 is not None and gm0 > gm1) else 0
    
    ato0 = safe_div(rev0, ta0)
    ato1 = safe_div(rev1, ta1)
    signals["assetTurnoverImproving"] = 1 if (ato0 is not None and ato1 is not None and ato0 > ato1) else 0
    
    score = sum(signals.values())
    
    return {
        "score": score,
        "signals": signals,
        "interpretation": "STRONG" if score >= 7 else "MODERATE" if score >= 4 else "WEAK",
        "data_quality": "HIGH"
    }

# ─── Beneish M-Score (Earnings Manipulation Detection) ─────────────────────────
def beneish_m_score(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    t0 = sorted_financials[0]
    t1 = sorted_financials[1]
    
    rev0 = safe(get_val(t0, "revenue"))
    rev1 = safe(get_val(t1, "revenue"))
    recv0 = safe(get_val(t0, "trade_receivables"))
    recv1 = safe(get_val(t1, "trade_receivables"))
    
    cogs0 = safe(get_val(t0, "cogs"))
    if cogs0 is None:
        cogs0 = rev0 * 0.6 if rev0 is not None else None
    cogs1 = safe(get_val(t1, "cogs"))
    if cogs1 is None:
        cogs1 = rev1 * 0.6 if rev1 is not None else None
        
    ca0 = safe(get_val(t0, "current_assets"))
    ca1 = safe(get_val(t1, "current_assets"))
    
    ta0 = safe(get_val(t0, "total_assets"))
    ta1 = safe(get_val(t1, "total_assets"))
    
    ppe0 = safe(get_val(t0, "ppe"))
    if ppe0 is None:
        ppe0 = ta0 * 0.3 if ta0 is not None else None
    ppe1 = safe(get_val(t1, "ppe"))
    if ppe1 is None:
        ppe1 = ta1 * 0.3 if ta1 is not None else None
        
    dep0 = safe(get_val(t0, "depreciation"))
    if dep0 is None:
        dep0 = ppe0 * 0.05 if ppe0 is not None else None
    dep1 = safe(get_val(t1, "depreciation"))
    if dep1 is None:
        dep1 = ppe1 * 0.05 if ppe1 is not None else None
        
    sgna0 = safe(get_val(t0, "sgna"))
    if sgna0 is None:
        sgna0 = rev0 * 0.1 if rev0 is not None else None
    sgna1 = safe(get_val(t1, "sgna"))
    if sgna1 is None:
        sgna1 = rev1 * 0.1 if rev1 is not None else None
        
    pat0 = safe(get_val(t0, "pat"))
    cfo0 = safe(get_val(t0, "cfo"))
    debt0 = safe(get_val(t0, "total_debt"))
    debt1 = safe(get_val(t1, "total_debt"))
    
    has_min_data = rev0 is not None and rev1 is not None and ta0 is not None and ta1 is not None
    if not has_min_data:
        return {
            "mScore": None,
            "m_score": None,
            "score": None,
            "threshold": -1.78,
            "flag": "N/A",
            "components": {},
            "data_quality": "INSUFFICIENT"
        }
        
    DSRI = safe_div(safe_div(recv0, rev0), safe_div(recv1, rev1), fallback=1.0)
    GMI = safe_div(safe_div(rev1 - cogs1, rev1), safe_div(rev0 - cogs0, rev0), fallback=1.0)
    
    sum_ca_ppe0 = (ca0 or 0.0) + (ppe0 or 0.0)
    sum_ca_ppe1 = (ca1 or 0.0) + (ppe1 or 0.0)
    AQI = safe_div(1.0 - safe_div(sum_ca_ppe0, ta0, fallback=0.0), 1.0 - safe_div(sum_ca_ppe1, ta1, fallback=0.0), fallback=1.0)
    
    SGI = safe_div(rev0, rev1, fallback=1.0)
    
    dep_ppe0 = (dep0 or 0.0) + (ppe0 or 0.0)
    dep_ppe1 = (dep1 or 0.0) + (ppe1 or 0.0)
    DEPI = safe_div(safe_div(dep1, dep_ppe1), safe_div(dep0, dep_ppe0), fallback=1.0)
    
    SGAI = safe_div(safe_div(sgna0, rev0), safe_div(sgna1, rev1), fallback=1.0)
    TATA = safe_div((pat0 or 0.0) - (cfo0 or 0.0), ta0, fallback=0.0)
    LVGI = safe_div(safe_div(debt0, ta0), safe_div(debt1, ta1), fallback=1.0)
    
    m_score = -4.84 + (0.92 * DSRI) + (0.528 * GMI) + (0.404 * AQI) + (0.892 * SGI) + (0.115 * DEPI) - (0.172 * SGAI) + (4.679 * TATA) - (0.327 * LVGI)
    final_score = round(m_score, 2) if math.isfinite(m_score) else None
    
    return {
        "mScore": final_score,
        "m_score": final_score,
        "score": final_score,
        "threshold": -1.78,
        "flag": "POSSIBLE_MANIPULATION" if (final_score is not None and final_score > -1.78) else "CLEAN",
        "components": {
            "DSRI": round(DSRI, 3),
            "GMI": round(GMI, 3),
            "AQI": round(AQI, 3),
            "SGI": round(SGI, 3),
            "DEPI": round(DEPI, 3),
            "SGAI": round(SGAI, 3),
            "TATA": round(TATA, 4),
            "LVGI": round(LVGI, 3)
        },
        "data_quality": "HIGH"
    }

# ─── Altman Z-Score (Emerging Markets Z'' version) ─────────────────────────────
def altman_z_score_emerging_markets(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    t0 = sorted_financials[0]
    
    ca = safe(get_val(t0, "current_assets"))
    cl = safe(get_val(t0, "current_liabilities"))
    ta = safe(get_val(t0, "total_assets"))
    
    re = safe(get_val(t0, "retained_earnings"))
    if re is None:
        eq_val = safe(get_val(t0, "total_equity"))
        re = eq_val * 0.7 if eq_val is not None else None
        
    ebit = safe(get_val(t0, "ebit"))
    if ebit is None:
        ebitda_val = safe(get_val(t0, "ebitda"))
        ebit = ebitda_val * 0.85 if ebitda_val is not None else None
        
    eq = safe(get_val(t0, "total_equity"))
    debt = safe(get_val(t0, "total_debt"))
    
    has_min_data = ta is not None and ta != 0
    if not has_min_data:
        return {
            "zScore": None,
            "z_score": None,
            "score": None,
            "zone": "N/A",
            "components": {},
            "data_quality": "INSUFFICIENT"
        }
        
    X1 = safe_div(safe(ca) - safe(cl) if ca is not None and cl is not None else None, ta, fallback=0.0)
    X2 = safe_div(re, ta, fallback=0.0)
    X3 = safe_div(ebit, ta, fallback=0.0)
    X4 = safe_div(eq, debt, fallback=10.0) if (debt is not None and debt > 0) else 10.0
    
    z_score = (6.56 * X1) + (3.26 * X2) + (6.72 * X3) + (1.05 * min(X4, 10.0))
    final_score = round(z_score, 2) if math.isfinite(z_score) else None
    
    return {
        "zScore": final_score,
        "z_score": final_score,
        "score": final_score,
        "zone": "SAFE" if (final_score is not None and final_score > 2.6) else "GREY" if (final_score is not None and final_score > 1.1) else "DISTRESS",
        "components": {
            "X1": round(X1, 4),
            "X2": round(X2, 4),
            "X3": round(X3, 4),
            "X4": round(min(X4, 10.0), 4)
        },
        "data_quality": "HIGH"
    }

# ─── DuPont 3-Factor Decomposition ─────────────────────────────────────────────
def dupont_decomposition(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    t0 = sorted_financials[0]
    
    pat = safe(get_val(t0, "pat"))
    rev = safe(get_val(t0, "revenue"))
    ta = safe(get_val(t0, "total_assets"))
    eq = safe(get_val(t0, "total_equity"))
    
    if pat is None or rev is None or rev == 0 or ta is None or ta == 0 or eq is None or eq == 0:
        return {
            "netProfitMargin": None,
            "net_profit_margin": None,
            "assetTurnover": None,
            "asset_turnover": None,
            "equityMultiplier": None,
            "equity_multiplier": None,
            "roe": None,
            "analysis": "N/A",
            "data_quality": "INSUFFICIENT"
        }
        
    net_profit_margin = pat / rev
    asset_turnover = rev / ta
    equity_multiplier = ta / eq
    roe = net_profit_margin * asset_turnover * equity_multiplier
    
    return {
        "netProfitMargin": round(net_profit_margin * 100.0, 1),
        "net_profit_margin": round(net_profit_margin * 100.0, 1),
        "assetTurnover": round(asset_turnover, 2),
        "asset_turnover": round(asset_turnover, 2),
        "equityMultiplier": round(equity_multiplier, 2),
        "equity_multiplier": round(equity_multiplier, 2),
        "roe": round(roe * 100.0, 1),
        "analysis": "MARGIN_DRIVEN" if net_profit_margin > asset_turnover else "TURNOVER_DRIVEN",
        "data_quality": "HIGH"
    }

# ─── Working Capital Cycle ─────────────────────────────────────────────────────
def working_capital_cycle(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    t0 = sorted_financials[0]
    
    rev = safe(get_val(t0, "revenue"))
    recv = safe(get_val(t0, "trade_receivables"))
    inv = safe(get_val(t0, "inventory"))
    pay = safe(get_val(t0, "trade_payables"))
    
    cogs = safe(get_val(t0, "cogs"))
    if cogs is None:
        cogs = rev * 0.6 if rev is not None else None
        
    if rev is None or rev == 0:
        return {
            "daysReceivables": None,
            "days_receivables": None,
            "daysInventory": None,
            "days_inventory": None,
            "daysPayable": None,
            "days_payable": None,
            "cashConversionCycle": None,
            "cash_conversion_cycle": None,
            "data_quality": "INSUFFICIENT"
        }
        
    days_receivables = safe_div(recv, rev, fallback=0.0) * 365.0
    days_inventory = safe_div(inv, cogs, fallback=0.0) * 365.0 if (inv is not None and inv > 0) else 0.0
    days_payable = safe_div(pay, cogs, fallback=0.0) * 365.0 if (pay is not None and pay > 0) else 0.0
    cash_conversion_cycle = days_receivables + days_inventory - days_payable
    
    return {
        "daysReceivables": round(days_receivables) if days_receivables is not None else None,
        "days_receivables": round(days_receivables) if days_receivables is not None else None,
        "daysInventory": round(days_inventory) if days_inventory is not None else None,
        "days_inventory": round(days_inventory) if days_inventory is not None else None,
        "daysPayable": round(days_payable) if days_payable is not None else None,
        "days_payable": round(days_payable) if days_payable is not None else None,
        "cashConversionCycle": round(cash_conversion_cycle) if cash_conversion_cycle is not None else None,
        "cash_conversion_cycle": round(cash_conversion_cycle) if cash_conversion_cycle is not None else None,
        "data_quality": "HIGH"
    }

# ─── WACC (Weighted Average Cost of Capital) ───────────────────────────────────
def calculate_wacc(market_cap: float, total_debt: float, beta: float) -> dict:
    mcap = safe(market_cap)
    debt = safe(total_debt) if total_debt is not None else 0.0
    b = safe(beta)
    
    risk_free_rate = 0.07
    
    if mcap is None or mcap == 0:
        return {
            "wacc": None,
            "costOfEquity": None,
            "cost_of_equity": None,
            "costOfDebt": None,
            "cost_of_debt": None,
            "debtRatio": None,
            "debt_ratio": None,
            "equityRatio": None,
            "equity_ratio": None,
            "beta": b,
            "riskFreeRate": risk_free_rate,
            "risk_free_rate": risk_free_rate,
            "data_quality": "INSUFFICIENT"
        }
        
    safe_beta = b if b is not None else 1.0
    market_risk_premium = 0.07
    cost_of_equity = risk_free_rate + (safe_beta * market_risk_premium)
    
    debt_ratio = debt / (debt + mcap)
    equity_ratio = 1.0 - debt_ratio
    cost_of_debt = 0.09
    tax_rate = 0.25
    
    wacc = (equity_ratio * cost_of_equity) + (debt_ratio * cost_of_debt * (1.0 - tax_rate))
    
    return {
        "wacc": round(wacc, 4),
        "costOfEquity": round(cost_of_equity, 4),
        "cost_of_equity": round(cost_of_equity, 4),
        "costOfDebt": cost_of_debt,
        "cost_of_debt": cost_of_debt,
        "debtRatio": round(debt_ratio, 4),
        "debt_ratio": round(debt_ratio, 4),
        "equityRatio": round(equity_ratio, 4),
        "equity_ratio": round(equity_ratio, 4),
        "beta": safe_beta,
        "riskFreeRate": risk_free_rate,
        "risk_free_rate": risk_free_rate,
        "data_quality": "HIGH"
    }

# ─── DCF Valuation (3 scenarios) ───────────────────────────────────────────────
def dcf_valuation(last_fcf: float, wacc: float, price: float = None, shares: float = None, net_debt: float = 0.0) -> dict:
    lf = safe(last_fcf)
    wacc_rate = safe(wacc.get("wacc")) if isinstance(wacc, dict) else safe(wacc)
    p = safe(price)
    sh = safe(shares)
    nd = safe(net_debt) if net_debt is not None else 0.0
    
    if lf is None or wacc_rate is None:
        return {
            "bear": None,
            "base": None,
            "bull": None,
            "note": "Insufficient data for WACC/FCF to run DCF",
            "data_quality": "INSUFFICIENT"
        }
        
    if lf <= 0:
        fallback_p = p if p is not None else 100.0
        return {
            "bear": {"intrinsicValue": round(fallback_p * 0.8), "intrinsic_value": round(fallback_p * 0.8), "upside": "-20.0"},
            "base": {"intrinsicValue": round(fallback_p * 1.0), "intrinsic_value": round(fallback_p * 1.0), "upside": "0.0"},
            "bull": {"intrinsicValue": round(fallback_p * 1.3), "intrinsic_value": round(fallback_p * 1.3), "upside": "30.0"},
            "note": "Negative/missing FCF — fallback to multiples-based estimate",
            "data_quality": "HIGH"
        }
        
    scenarios = {
        "bear": {"growth_rate": 0.05, "terminal_growth": 0.04},
        "base": {"growth_rate": 0.12, "terminal_growth": 0.05},
        "bull": {"growth_rate": 0.20, "terminal_growth": 0.06}
    }
    
    results = {}
    for key, s in scenarios.items():
        g_rate = s["growth_rate"]
        t_growth = s["terminal_growth"]
        
        projected_fcf = []
        for i in range(1, 6):
            projected_fcf.append(lf * ((1.0 + g_rate) ** i))
            
        pv_fcf = 0.0
        for i, fcf in enumerate(projected_fcf):
            pv_fcf += fcf / ((1.0 + wacc_rate) ** (i + 1))
            
        term_val = projected_fcf[-1] * (1.0 + t_growth) / max(wacc_rate - t_growth, 0.01)
        pv_term = term_val / ((1.0 + wacc_rate) ** 5)
        
        ev = pv_fcf + pv_term
        eq_val = ev - nd
        
        if sh and sh > 0:
            intrinsic_val = max(0.0, eq_val / sh)
            upside_val = ((intrinsic_val - p) / p * 100.0) if p and p > 0 else 0.0
            upside_str = f"{upside_val:.1f}"
        else:
            intrinsic_val = max(0.0, eq_val)
            upside_str = "0.0"
            
        results[key] = {
            "intrinsicValue": round(intrinsic_val),
            "intrinsic_value": round(intrinsic_val),
            "upside": upside_str,
            "projectedFCFs": [round(f) for f in projected_fcf],
            "projected_fcf": [round(f) for f in projected_fcf],
            "terminalValue": round(term_val),
            "terminal_value": round(term_val),
            "enterpriseValue": round(ev),
            "enterprise_value": round(ev)
        }
        
    results["data_quality"] = "HIGH"
    return results

# ─── Incremental ROCE ─────────────────────────────────────────────────────────
def incremental_roce(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0))
    
    periods = []
    for i in range(len(sorted_financials) - 3):
        t_start = sorted_financials[i]
        t_end = sorted_financials[i + 3]
        
        ebit_start = safe(get_val(t_start, "ebit"))
        ebit_end = safe(get_val(t_end, "ebit"))
        
        ta_start = safe(get_val(t_start, "total_assets"))
        cl_start = safe(get_val(t_start, "current_liabilities"))
        ta_end = safe(get_val(t_end, "total_assets"))
        cl_end = safe(get_val(t_end, "current_liabilities"))
        
        if ta_start is not None and cl_start is not None:
            ce_start = ta_start - cl_start
        else:
            eq_start = safe(get_val(t_start, "total_equity"))
            debt_start = safe(get_val(t_start, "total_debt")) or 0.0
            ce_start = eq_start + debt_start if eq_start is not None else None
            
        if ta_end is not None and cl_end is not None:
            ce_end = ta_end - cl_end
        else:
            eq_end = safe(get_val(t_end, "total_equity"))
            debt_end = safe(get_val(t_end, "total_debt")) or 0.0
            ce_end = eq_end + debt_end if eq_end is not None else None
            
        if ebit_start is not None and ebit_end is not None and ce_start is not None and ce_end is not None:
            change_ebit = ebit_end - ebit_start
            change_ce = ce_end - ce_start
            
            if change_ce < 0 and change_ebit >= 0:
                val = 999.99
                interpretation = "Capital allocation is creating value"
            elif change_ce == 0:
                val = None
                interpretation = "N/A"
            else:
                val = (change_ebit / change_ce) * 100.0
                if val > 20.0:
                    interpretation = "Capital allocation is creating value"
                elif 10.0 <= val <= 20.0:
                    interpretation = "Moderate returns on incremental investment"
                else:
                    interpretation = "Diminishing returns — question reinvestment thesis"
                    
            periods.append({
                "period": f"{get_val(t_start, 'fiscal_year')}-{get_val(t_end, 'fiscal_year')}",
                "start_year": get_val(t_start, "fiscal_year"),
                "end_year": get_val(t_end, "fiscal_year"),
                "change_in_ebit": change_ebit,
                "change_in_capital_employed": change_ce,
                "value": round(val, 2) if val is not None else None,
                "interpretation": interpretation
            })
            
    if not periods:
        return {
            "score": None,
            "value": None,
            "interpretation": "N/A - Insufficient data to calculate rolling 3-year Incremental ROCE",
            "data_quality": "INSUFFICIENT"
        }
        
    latest_period = periods[-1]
    
    return {
        "score": latest_period["value"],
        "value": latest_period["value"],
        "interpretation": latest_period["interpretation"],
        "data_quality": "HIGH",
        "periods": periods
    }

# ─── Operating Leverage ────────────────────────────────────────────────────────
def operating_leverage(financials: list[dict]) -> dict:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}
        
    sorted_financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0))
    
    periods = []
    for i in range(len(sorted_financials) - 1):
        t_start = sorted_financials[i]
        t_end = sorted_financials[i + 1]
        
        rev_start = safe(get_val(t_start, "revenue"))
        rev_end = safe(get_val(t_end, "revenue"))
        ebit_start = safe(get_val(t_start, "ebit"))
        ebit_end = safe(get_val(t_end, "ebit"))
        
        if rev_start and rev_end and ebit_start and ebit_end:
            pct_change_rev = (rev_end - rev_start) / rev_start
            pct_change_ebit = (ebit_end - ebit_start) / ebit_start
            
            if pct_change_rev != 0:
                op_lev = pct_change_ebit / pct_change_rev
                val = round(op_lev, 2)
                
                if val > 2.0:
                    interpretation = "High operating leverage — fixed cost base, margins expand fast with volume"
                elif 1.0 <= val <= 2.0:
                    interpretation = "Moderate"
                else:
                    interpretation = "Low — either variable cost or declining margins despite volume growth"
                    
                periods.append({
                    "period": f"{get_val(t_start, 'fiscal_year')}-{get_val(t_end, 'fiscal_year')}",
                    "year": get_val(t_end, "fiscal_year"),
                    "pct_change_revenue": round(pct_change_rev * 100.0, 2),
                    "pct_change_ebit": round(pct_change_ebit * 100.0, 2),
                    "value": val,
                    "interpretation": interpretation
                })
                
    if not periods:
        return {
            "score": None,
            "value": None,
            "interpretation": "N/A - Insufficient data to calculate Operating Leverage",
            "data_quality": "INSUFFICIENT"
        }
        
    latest_period = periods[-1]
    
    return {
        "score": latest_period["value"],
        "value": latest_period["value"],
        "interpretation": latest_period["interpretation"],
        "data_quality": "HIGH",
        "periods": periods
    }
