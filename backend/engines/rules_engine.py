import math
from dataclasses import dataclass

# Import helper engines with fallback for relative imports
try:
    from engines.quant_scores import (
        beneish_m_score,
        altman_z_score_emerging_markets,
        working_capital_cycle,
        calculate_wacc,
        incremental_roce,
        get_val,
        safe,
        safe_div
    )
except ImportError:
    from .quant_scores import (
        beneish_m_score,
        altman_z_score_emerging_markets,
        working_capital_cycle,
        calculate_wacc,
        incremental_roce,
        get_val,
        safe,
        safe_div
    )

@dataclass
class Signal:
    rule_id: str
    severity: str      # "RED_FLAG" | "YELLOW_FLAG" | "POSITIVE" | "NEUTRAL"
    category: str      # "EARNINGS_QUALITY" | "CASH_FLOW" | "LEVERAGE" | "EFFICIENCY" | "GROWTH"
    title: str
    evidence: str      # Specific numbers that triggered this rule
    implication: str   # What this typically means (not AI — hardcoded institutional logic)

def run_all_rules(financials: list[dict], shareholding_data: dict) -> list:
    if not financials or len(financials) < 2:
        return {"score": None, "data_quality": "INSUFFICIENT", "reason": "Need at least 2 years of data"}

    # Sort financials descending by fiscal_year to ensure financials[0] is t0
    financials = sorted(financials, key=lambda x: get_val(x, "fiscal_year", 0), reverse=True)
    n_years = len(financials)

    t0 = financials[0]
    fy0 = get_val(t0, "fiscal_year")
    pat_t0 = safe(get_val(t0, "pat"))
    cfo_t0 = safe(get_val(t0, "cfo"))
    rev_t0 = safe(get_val(t0, "revenue"))
    ebitda_t0 = safe(get_val(t0, "ebitda"))
    ebit_t0 = safe(get_val(t0, "ebit"))
    debt_t0 = safe(get_val(t0, "total_debt"))
    eq_t0 = safe(get_val(t0, "total_equity"))
    capex_t0 = safe(get_val(t0, "capex"))

    t1 = financials[1]
    fy1 = get_val(t1, "fiscal_year")
    pat_t1 = safe(get_val(t1, "pat"))
    cfo_t1 = safe(get_val(t1, "cfo"))
    rev_t1 = safe(get_val(t1, "revenue"))
    ebitda_t1 = safe(get_val(t1, "ebitda"))
    ebit_t1 = safe(get_val(t1, "ebit"))
    debt_t1 = safe(get_val(t1, "total_debt"))
    eq_t1 = safe(get_val(t1, "total_equity"))

    signals = []

    # ─── 1. EARNINGS QUALITY ───────────────────────────────────────────────────

    # RULE_EQ01: IF PAT_CAGR_3Y > CFO_CAGR_3Y + 0.10: RED_FLAG "Profit growing faster than cash"
    if n_years >= 4:
        t3 = financials[3]
        pat_t3 = safe(get_val(t3, "pat"))
        cfo_t3 = safe(get_val(t3, "cfo"))
        if pat_t0 and pat_t3 and cfo_t0 and cfo_t3:
            if pat_t0 > 0 and pat_t3 > 0 and cfo_t0 > 0 and cfo_t3 > 0:
                pat_cagr = (pat_t0 / pat_t3) ** (1/3) - 1
                cfo_cagr = (cfo_t0 / cfo_t3) ** (1/3) - 1
                if pat_cagr > cfo_cagr + 0.10:
                    signals.append(Signal(
                        rule_id="RULE_EQ01",
                        severity="RED_FLAG",
                        category="EARNINGS_QUALITY",
                        title="Profit growing faster than cash",
                        evidence=f"PAT 3Y CAGR = {pat_cagr*100:.1f}% vs CFO 3Y CAGR = {cfo_cagr*100:.1f}%",
                        implication="Operating cash flows are not keeping pace with accounting profits. This could indicate aggressive revenue recognition, growing receivables, or lower earnings quality."
                    ))

    # RULE_EQ02: IF CFO/PAT < 0.7 for 2+ consecutive years: RED_FLAG "Persistent low cash conversion"
    if pat_t0 and pat_t1 and cfo_t0 and cfo_t1:
        if pat_t0 > 0 and pat_t1 > 0:
            ratio_t0 = cfo_t0 / pat_t0
            ratio_t1 = cfo_t1 / pat_t1
            if ratio_t0 < 0.7 and ratio_t1 < 0.7:
                signals.append(Signal(
                    rule_id="RULE_EQ02",
                    severity="RED_FLAG",
                    category="EARNINGS_QUALITY",
                    title="Persistent low cash conversion",
                    evidence=f"CFO/PAT ratio in {fy0} = {ratio_t0:.2f}, in {fy1} = {ratio_t1:.2f}",
                    implication="The company is consistently converting less than 70% of its net profits into operating cash flows. This signals potential cash flow distress or low quality of accounting profits."
                ))

    # RULE_EQ03: IF CFO/PAT > 1.3 consistently: POSITIVE "High quality earnings, cash backed"
    if pat_t0 and pat_t1 and cfo_t0 and cfo_t1:
        if pat_t0 > 0 and pat_t1 > 0:
            ratio_t0 = cfo_t0 / pat_t0
            ratio_t1 = cfo_t1 / pat_t1
            if ratio_t0 > 1.3 and ratio_t1 > 1.3:
                signals.append(Signal(
                    rule_id="RULE_EQ03",
                    severity="POSITIVE",
                    category="EARNINGS_QUALITY",
                    title="High quality earnings, cash backed",
                    evidence=f"CFO/PAT ratio in {fy0} = {ratio_t0:.2f}, in {fy1} = {ratio_t1:.2f}",
                    implication="Operating cash flow exceeds net profits significantly, demonstrating strong cash generation, conservative accounting practices, and high-quality earnings."
                ))

    # ─── 2. WORKING CAPITAL ────────────────────────────────────────────────────

    # RULE_WC01: IF receivable_days increases > 15 days YoY: YELLOW_FLAG "Receivable stretch — possible collection pressure"
    recv_t0 = safe(get_val(t0, "trade_receivables"))
    recv_t1 = safe(get_val(t1, "trade_receivables"))
    if recv_t0 is not None and recv_t1 is not None and rev_t0 and rev_t1:
        rec_days_t0 = (recv_t0 / rev_t0) * 365.0
        rec_days_t1 = (recv_t1 / rev_t1) * 365.0
        if rec_days_t0 - rec_days_t1 > 15.0:
            signals.append(Signal(
                rule_id="RULE_WC01",
                severity="YELLOW_FLAG",
                category="CASH_FLOW",
                title="Receivable stretch — possible collection pressure",
                evidence=f"Receivable days increased from {rec_days_t1:.1f} days to {rec_days_t0:.1f} days (+{rec_days_t0 - rec_days_t1:.1f} days YoY)",
                implication="Customers are taking longer to pay, which could tie up working capital and signal collection difficulties or aggressive sales terms."
            ))

    # RULE_WC02: IF inventory_days increases > 20 days YoY: YELLOW_FLAG "Inventory buildup — demand risk or overproduction"
    inv_t0 = safe(get_val(t0, "inventory"))
    inv_t1 = safe(get_val(t1, "inventory"))
    cogs_t0 = safe(get_val(t0, "cogs")) or (rev_t0 * 0.6 if rev_t0 else None)
    cogs_t1 = safe(get_val(t1, "cogs")) or (rev_t1 * 0.6 if rev_t1 else None)
    if inv_t0 is not None and inv_t1 is not None and cogs_t0 and cogs_t1:
        inv_days_t0 = (inv_t0 / cogs_t0) * 365.0
        inv_days_t1 = (inv_t1 / cogs_t1) * 365.0
        if inv_days_t0 - inv_days_t1 > 20.0:
            signals.append(Signal(
                rule_id="RULE_WC02",
                severity="YELLOW_FLAG",
                category="CASH_FLOW",
                title="Inventory buildup — demand risk or overproduction",
                evidence=f"Inventory days increased from {inv_days_t1:.1f} days to {inv_days_t0:.1f} days (+{inv_days_t0 - inv_days_t1:.1f} days YoY)",
                implication="Inventory is accumulating faster than sales are growing, indicating potential overproduction, slowing demand, or obsolescence risk."
            ))

    # RULE_WC03: IF cash_conversion_cycle < 0: POSITIVE "Negative CCC — business funded by suppliers"
    wcc_res = working_capital_cycle(financials)
    ccc = wcc_res.get("cash_conversion_cycle")
    if ccc is not None and ccc < 0:
        signals.append(Signal(
            rule_id="RULE_WC03",
            severity="POSITIVE",
            category="CASH_FLOW",
            title="Negative CCC — business funded by suppliers",
            evidence=f"Cash Conversion Cycle is {ccc} days",
            implication="The company collects cash from customers before paying its suppliers, effectively using interest-free supplier credit to fund its working capital."
        ))

    # ─── 3. LEVERAGE ───────────────────────────────────────────────────────────

    # RULE_LV01: IF debt_to_equity > 2.0 AND interest_coverage < 2.0: RED_FLAG "Dangerous leverage"
    interest_expense_t0 = safe(get_val(t0, "interest_expense"))
    if eq_t0 and eq_t0 > 0 and debt_t0 is not None and ebit_t0 is not None and interest_expense_t0 and interest_expense_t0 > 0:
        de = debt_t0 / eq_t0
        ic = ebit_t0 / interest_expense_t0
        if de > 2.0 and ic < 2.0:
            signals.append(Signal(
                rule_id="RULE_LV01",
                severity="RED_FLAG",
                category="LEVERAGE",
                title="Dangerous leverage",
                evidence=f"Debt/Equity = {de:.2f}, Interest Coverage = {ic:.2f}x",
                implication="The company has a highly leveraged balance sheet combined with weak operating earnings to cover its interest obligations, presenting a significant default risk."
            ))

    # RULE_LV02: IF debt_to_equity falls for 3+ consecutive years: POSITIVE "Deliberate deleveraging"
    if n_years >= 4:
        t2 = financials[2]
        t3 = financials[3]
        debt_t2 = safe(get_val(t2, "total_debt"))
        eq_t2 = safe(get_val(t2, "total_equity"))
        debt_t3 = safe(get_val(t3, "total_debt"))
        eq_t3 = safe(get_val(t3, "total_equity"))
        
        de_t0 = safe_div(debt_t0, eq_t0)
        de_t1 = safe_div(debt_t1, eq_t1)
        de_t2 = safe_div(debt_t2, eq_t2)
        de_t3 = safe_div(debt_t3, eq_t3)
        
        if de_t0 is not None and de_t1 is not None and de_t2 is not None and de_t3 is not None:
            if de_t0 < de_t1 < de_t2 < de_t3:
                signals.append(Signal(
                    rule_id="RULE_LV02",
                    severity="POSITIVE",
                    category="LEVERAGE",
                    title="Deliberate deleveraging",
                    evidence=f"Debt/Equity ratio fell consistently: {de_t3:.2f} -> {de_t2:.2f} -> {de_t1:.2f} -> {de_t0:.2f}",
                    implication="Management is actively paying down debt or growing equity organically, improving balance sheet strength and reducing financial risk."
                ))

    # RULE_LV03: IF total_debt increased > 30% YoY with no capex justification: YELLOW_FLAG "Unexplained debt increase"
    if debt_t0 is not None and debt_t1 and debt_t1 > 0:
        pct_increase = (debt_t0 - debt_t1) / debt_t1
        debt_diff = debt_t0 - debt_t1
        if pct_increase > 0.30:
            if capex_t0 is None or capex_t0 < 0.5 * debt_diff:
                signals.append(Signal(
                    rule_id="RULE_LV03",
                    severity="YELLOW_FLAG",
                    category="LEVERAGE",
                    title="Unexplained debt increase",
                    evidence=f"Total debt increased by {pct_increase*100:.1f}% (from {debt_t1:.1f} to {debt_t0:.1f}) while Capex was {capex_t0 or 0.0:.1f}",
                    implication="Debt increased significantly without a corresponding increase in capital expenditure, suggesting the funds may have been used for unproductive purposes, operating cash shortfalls, or acquisitions."
                ))

    # ─── 4. MARGINS (EFFICIENCY) ───────────────────────────────────────────────

    # RULE_MG01: IF EBITDA_margin expands > 300bps while industry faces cost pressure: POSITIVE "Pricing power demonstrated"
    if ebitda_t0 is not None and ebitda_t1 is not None and rev_t0 and rev_t1:
        margin_t0 = ebitda_t0 / rev_t0
        margin_t1 = ebitda_t1 / rev_t1
        if margin_t0 - margin_t1 > 0.03:
            signals.append(Signal(
                rule_id="RULE_MG01",
                severity="POSITIVE",
                category="EFFICIENCY",
                title="Pricing power demonstrated",
                evidence=f"EBITDA margin expanded from {margin_t1*100:.1f}% to {margin_t0*100:.1f}% (+{(margin_t0 - margin_t1)*10000:.0f} bps YoY)",
                implication="The company successfully expanded its EBITDA margin despite industry cost pressures, demonstrating strong pricing power or excellent cost optimization."
            ))

    # RULE_MG02: IF EBITDA_margin compresses > 200bps for 2+ years: YELLOW_FLAG "Structural margin erosion"
    if n_years >= 3:
        t2 = financials[2]
        ebitda_t2 = safe(get_val(t2, "ebitda"))
        rev_t2 = safe(get_val(t2, "revenue"))
        if ebitda_t0 is not None and ebitda_t1 is not None and ebitda_t2 is not None and rev_t0 and rev_t1 and rev_t2:
            margin_t0 = ebitda_t0 / rev_t0
            margin_t1 = ebitda_t1 / rev_t1
            margin_t2 = ebitda_t2 / rev_t2
            diff1 = margin_t0 - margin_t1
            diff2 = margin_t1 - margin_t2
            if diff1 < -0.02 and diff2 < -0.02:
                signals.append(Signal(
                    rule_id="RULE_MG02",
                    severity="YELLOW_FLAG",
                    category="EFFICIENCY",
                    title="Structural margin erosion",
                    evidence=f"EBITDA margin compressed by {-diff2*10000:.0f} bps in {fy1} and {-diff1*10000:.0f} bps in {fy0}",
                    implication="Continuous margin contraction over multiple years suggests structural cost pressures, loss of pricing power, or intense competitive headwinds."
                ))

    # RULE_MG03: IF PAT_margin spike coincides with tax benefit (not operating improvement): YELLOW_FLAG "One-time tax benefit inflating PAT"
    if pat_t0 is not None and pat_t1 is not None and rev_t0 and rev_t1:
        pat_margin_t0 = pat_t0 / rev_t0
        pat_margin_t1 = pat_t1 / rev_t1
        tax_t0 = safe(get_val(t0, "tax_expense"))
        tax_t1 = safe(get_val(t1, "tax_expense"))
        if pat_margin_t0 - pat_margin_t1 > 0.02:
            is_benefit = False
            if tax_t0 is not None and tax_t0 < 0:
                is_benefit = True
            elif tax_t0 is not None and tax_t1 is not None and tax_t0 < tax_t1 * 0.5:
                is_benefit = True
            
            if is_benefit:
                signals.append(Signal(
                    rule_id="RULE_MG03",
                    severity="YELLOW_FLAG",
                    category="EFFICIENCY",
                    title="One-time tax benefit inflating PAT",
                    evidence=f"PAT margin spike from {pat_margin_t1*100:.1f}% to {pat_margin_t0*100:.1f}% while tax expense was {tax_t0 or 0.0:.1f}",
                    implication="A significant spike in profit margin is driven by non-operating tax credits or adjustments rather than sustainable operating efficiency gains."
                ))

    # ─── 5. CAPITAL ALLOCATION & GROWTH ────────────────────────────────────────

    # RULE_CA01: IF incremental_ROCE < WACC: RED_FLAG "Value destruction — returns below cost of capital"
    iroce_res = incremental_roce(financials)
    iroce_val = iroce_res.get("value")
    
    shares = safe(get_val(t0, "shares_outstanding"))
    price = safe(get_val(t0, "share_price") or get_val(shareholding_data, "price") or get_val(shareholding_data, "share_price"))
    debt = safe(get_val(t0, "total_debt")) or 0.0
    beta = safe(get_val(t0, "beta") or get_val(shareholding_data, "beta")) or 1.0
    
    wacc_pct = None
    if shares and price:
        mcap = shares * price
        wacc_res = calculate_wacc(market_cap=mcap, total_debt=debt, beta=beta)
        wacc_val = wacc_res.get("wacc")
        if wacc_val is not None:
            wacc_pct = wacc_val * 100.0
            
    if iroce_val is not None and wacc_pct is not None:
        if iroce_val < wacc_pct:
            signals.append(Signal(
                rule_id="RULE_CA01",
                severity="RED_FLAG",
                category="GROWTH",
                title="Value destruction — returns below cost of capital",
                evidence=f"Incremental ROCE = {iroce_val:.1f}% vs WACC = {wacc_pct:.1f}%",
                implication="The returns on new capital investments are lower than the company's cost of capital, indicating that growth is destroying shareholder value."
            ))

    # RULE_CA02: IF FCF_yield > 5% consistently: POSITIVE "Strong free cash flow generating business"
    shares = safe(get_val(t0, "shares_outstanding"))
    price = safe(get_val(t0, "share_price") or get_val(shareholding_data, "price") or get_val(shareholding_data, "share_price"))
    if shares and price:
        mcap = shares * price
        capex_t0 = safe(get_val(t0, "capex")) or 0.0
        capex_t1 = safe(get_val(t1, "capex")) or 0.0
        fcf_t0 = cfo_t0 - capex_t0 if cfo_t0 is not None else None
        fcf_t1 = cfo_t1 - capex_t1 if cfo_t1 is not None else None
        if fcf_t0 is not None and fcf_t1 is not None and mcap > 0:
            fcf_yield_t0 = fcf_t0 / mcap
            fcf_yield_t1 = fcf_t1 / mcap
            if fcf_yield_t0 > 0.05 and fcf_yield_t1 > 0.05:
                signals.append(Signal(
                    rule_id="RULE_CA02",
                    severity="POSITIVE",
                    category="CASH_FLOW",
                    title="Strong free cash flow generating business",
                    evidence=f"FCF Yield in {fy0} = {fcf_yield_t0*100:.1f}%, in {fy1} = {fcf_yield_t1*100:.1f}%. FCF: {fy0}={fcf_t0:.1f}, {fy1}={fcf_t1:.1f}",
                    implication="The business consistently generates substantial free cash flow relative to its market valuation, providing high financial flexibility and safety."
                ))

    # RULE_CA03: IF capex > CFO for 3+ consecutive years: YELLOW_FLAG "Capex exceeding cash generation"
    if n_years >= 3:
        t2 = financials[2]
        capex_t1 = safe(get_val(t1, "capex"))
        capex_t2 = safe(get_val(t2, "capex"))
        cfo_t2 = safe(get_val(t2, "cfo"))
        if capex_t0 is not None and capex_t1 is not None and capex_t2 is not None:
            if cfo_t0 is not None and cfo_t1 is not None and cfo_t2 is not None:
                if capex_t0 > cfo_t0 and capex_t1 > cfo_t1 and capex_t2 > cfo_t2:
                    signals.append(Signal(
                        rule_id="RULE_CA03",
                        severity="YELLOW_FLAG",
                        category="GROWTH",
                        title="Capex exceeding cash generation",
                        evidence=f"Capex > CFO for 3 consecutive years (Latest: Capex={capex_t0:.1f} vs CFO={cfo_t0:.1f})",
                        implication="Capital expenditures are higher than operating cash generation, indicating reliance on external debt or equity dilution to fund growth."
                    ))

    # ─── 6. FORENSIC ───────────────────────────────────────────────────────────

    # RULE_FR01: IF beneish_dsri > 1.2: RED_FLAG "Receivables growing much faster than revenue"
    beneish = beneish_m_score(financials)
    dsri = beneish.get("components", {}).get("DSRI")
    if dsri is not None and dsri > 1.2:
        signals.append(Signal(
            rule_id="RULE_FR01",
            severity="RED_FLAG",
            category="EARNINGS_QUALITY",
            title="Receivables growing much faster than revenue",
            evidence=f"Beneish DSRI = {dsri:.2f}",
            implication="Receivables are growing disproportionately relative to revenue. This could indicate aggressive revenue recognition, channel stuffing, or worsening credit terms."
        ))

    # RULE_FR02: IF beneish_tata > 0.05: RED_FLAG "High accruals — profits not backed by cash"
    tata = beneish.get("components", {}).get("TATA")
    if tata is not None and tata > 0.05:
        signals.append(Signal(
            rule_id="RULE_FR02",
            severity="RED_FLAG",
            category="EARNINGS_QUALITY",
            title="High accruals — profits not backed by cash",
            evidence=f"Beneish TATA = {tata:.4f}",
            implication="Net income is driven heavily by accruals rather than cash flow, raising flags about earnings quality and potential manipulation."
        ))

    # RULE_FR03: IF promoter_pledge_pct > 40: RED_FLAG "High promoter pledge — funding risk"
    promoter_pledge_pct = safe(get_val(shareholding_data, "promoter_pledge_pct")) or safe(get_val(shareholding_data, "promoter_pledge")) or safe(get_val(shareholding_data, "promoterPledge")) or 0.0
    if promoter_pledge_pct > 40.0:
        signals.append(Signal(
            rule_id="RULE_FR03",
            severity="RED_FLAG",
            category="LEVERAGE",
            title="High promoter pledge — funding risk",
            evidence=f"Promoter Pledge = {promoter_pledge_pct:.1f}%",
            implication="A significant portion of promoter shares is pledged, creating liquidation risk if the stock price falls and promoters cannot meet margin calls."
        ))

    # RULE_FR04: IF promoter_holding decreases > 5% YoY: YELLOW_FLAG "Promoter reducing stake"
    promoter_holding = safe(get_val(shareholding_data, "promoter_holding")) or safe(get_val(shareholding_data, "promoter")) or safe(get_val(shareholding_data, "promoterHolding"))
    promoter_holding_prev = safe(get_val(shareholding_data, "promoter_holding_prev")) or safe(get_val(shareholding_data, "promoter_prev")) or safe(get_val(shareholding_data, "promoterHoldingPrev"))
    
    # Try trend array fallback if not present directly
    if promoter_holding is None or promoter_holding_prev is None:
        trend = get_val(shareholding_data, "trend", [])
        if trend and len(trend) >= 5:
            latest_q = trend[-1]
            prev_q = trend[-5]
            promoter_holding = safe(get_val(latest_q, "promoter")) or safe(get_val(latest_q, "promoterHolding"))
            promoter_holding_prev = safe(get_val(prev_q, "promoter")) or safe(get_val(prev_q, "promoterHolding"))
            
    if promoter_holding is not None and promoter_holding_prev is not None:
        diff = promoter_holding_prev - promoter_holding
        if diff > 5.0:
            signals.append(Signal(
                rule_id="RULE_FR04",
                severity="YELLOW_FLAG",
                category="GROWTH",
                title="Promoter reducing stake",
                evidence=f"Promoter holding fell from {promoter_holding_prev:.1f}% to {promoter_holding:.1f}% (-{diff:.1f}% YoY)",
                implication="Promoters are selling down their equity stake, which could signal lack of confidence in future growth or need for personal liquidity."
            ))

    # RULE_FR05: IF altman_z < 1.1: RED_FLAG "Financial distress risk"
    altman = altman_z_score_emerging_markets(financials)
    z_score = altman.get("z_score")
    if z_score is not None and z_score < 1.1:
        signals.append(Signal(
            rule_id="RULE_FR05",
            severity="RED_FLAG",
            category="LEVERAGE",
            title="Financial distress risk",
            evidence=f"Altman Z-Score = {z_score:.2f}",
            implication="The Z-Score falls into the distress zone, indicating a heightened probability of financial failure or insolvency in the near term."
        ))

    return signals
