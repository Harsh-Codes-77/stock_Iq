def solve_reverse_dcf(
    last_fcf: float,
    wacc_rate: float,
    current_price: float,
    shares: float,
    net_debt: float
) -> float:
    """
    Binary search solver to find FCF growth rate implied by the current market price.
    """
    if last_fcf <= 0 or wacc_rate <= 0 or current_price <= 0 or not shares:
        return 0.0

    target_eq_val = current_price * shares
    target_ev = target_eq_val + net_debt

    low = -0.50
    high = 2.00

    for _ in range(100):
        g = (low + high) / 2
        # Project 5-year FCFs
        projected = [last_fcf * ((1.0 + g) ** i) for i in range(1, 6)]
        pv_fcf = sum(f / ((1.0 + wacc_rate) ** i) for i, f in enumerate(projected, 1))

        # Terminal value assumptions
        t_growth = min(0.04, g) if g > 0 else 0.02
        tv = projected[-1] * (1.0 + t_growth) / max(wacc_rate - t_growth, 0.01)
        pv_tv = tv / ((1.0 + wacc_rate) ** 5)

        ev = pv_fcf + pv_tv
        if ev < target_ev:
            low = g
        else:
            high = g

    return low

def run_full_valuation(
    financials: list[dict],
    current_metrics: dict,
    wacc: dict,
    sector: str
) -> dict:
    """
    Returns complete valuation output incorporating DCF (Bear, Base, Bull),
    Reverse DCF, Earnings Power Value (EPV), Sensitivity Matrix, WACC assumptions,
    and multiple-based targets.
    """
    # 1. Sort financials
    sorted_fins = sorted(financials, key=lambda x: x.get("fiscal_year", 0), reverse=True)

    # 2. Extract key valuation parameters
    shares = current_metrics.get("shares_outstanding") or current_metrics.get("shares") or 1.0
    price = current_metrics.get("current_price") or current_metrics.get("price") or 100.0
    net_debt = current_metrics.get("net_debt") or 0.0

    wacc_rate = wacc.get("wacc") if isinstance(wacc, dict) else wacc
    if wacc_rate is None or wacc_rate <= 0:
        wacc_rate = 0.10

    # Extract last FCF
    last_fcf = None
    if sorted_fins:
        latest = sorted_fins[0]
        if "fcf" in latest and latest["fcf"] is not None:
            last_fcf = latest["fcf"]
        else:
            cfo = latest.get("cfo") or latest.get("cash_flow_from_operations") or latest.get("operating_cash_flow")
            capex = latest.get("capex") or latest.get("capital_expenditure") or latest.get("capital_expenditures")
            if cfo is not None:
                capex_val = capex if capex is not None else 0.0
                last_fcf = cfo - abs(capex_val)

    if last_fcf is None:
        last_fcf = current_metrics.get("fcf") or current_metrics.get("free_cash_flow") or 0.0

    # Handle negative FCF DCF fallback
    fcf_is_positive = last_fcf > 0

    # 3. DCF Scenarios
    scenarios = {
        "bear": {"growth": 0.05, "terminal": 0.03},
        "base": {"growth": 0.12, "terminal": 0.04},
        "bull": {"growth": 0.18, "terminal": 0.05}
    }

    dcf_out = {}
    for key, s in scenarios.items():
        g = s["growth"]
        t_growth = s["terminal"]

        if fcf_is_positive:
            projected = [last_fcf * ((1.0 + g) ** i) for i in range(1, 6)]
            pv_fcf = sum(f / ((1.0 + wacc_rate) ** i) for i, f in enumerate(projected, 1))
            tv = projected[-1] * (1.0 + t_growth) / max(wacc_rate - t_growth, 0.01)
            pv_tv = tv / ((1.0 + wacc_rate) ** 5)
            ev = pv_fcf + pv_tv
            eq_val = ev - net_debt
            intrinsic = max(0.0, eq_val / shares)
        else:
            # Fallback for negative FCF
            multiplier = 0.8 if key == "bear" else (1.0 if key == "base" else 1.3)
            intrinsic = price * multiplier

        upside_pct = ((intrinsic - price) / price * 100.0) if price > 0 else 0.0
        dcf_out[key] = {
            "intrinsic_value": round(intrinsic, 2),
            "growth_rate": g,
            "terminal_growth": t_growth,
            "upside_pct": round(upside_pct, 2)
        }

    # 4. Reverse DCF
    implied_growth = solve_reverse_dcf(last_fcf, wacc_rate, price, shares, net_debt)
    implied_growth_pct = implied_growth * 100.0

    if implied_growth_pct > 25.0:
        interpretation = f"Implied growth rate is high ({implied_growth_pct:.1f}%). The stock is priced for perfection."
    elif implied_growth_pct > 12.0:
        interpretation = f"Implied growth rate is moderate ({implied_growth_pct:.1f}%). Reasonable if current momentum persists."
    elif implied_growth_pct > 5.0:
        interpretation = f"Implied growth rate is low ({implied_growth_pct:.1f}%). Stock might be undervalued."
    else:
        interpretation = f"Implied growth rate is conservative/negative ({implied_growth_pct:.1f}%). Value play if stable."

    reverse_dcf_out = {
        "implied_growth_rate": round(implied_growth, 4),
        "interpretation": interpretation
    }

    # 5. Earnings Power Value (EPV)
    ebit = current_metrics.get("ebit") or 0.0
    if ebit <= 0 and sorted_fins:
        latest = sorted_fins[0]
        ebit = latest.get("ebit") or latest.get("operating_income") or latest.get("operating_profit") or 0.0

    tax_rate = current_metrics.get("tax_rate")
    if tax_rate is None and sorted_fins:
        tax_rate = sorted_fins[0].get("tax_rate")
    if tax_rate is None:
        tax_rate = 0.25
    if tax_rate > 1.0:
        tax_rate = tax_rate / 100.0

    epv_firm = (ebit * (1.0 - tax_rate)) / wacc_rate
    epv_equity = epv_firm - net_debt
    epv_per_share = max(0.0, epv_equity / shares)
    epv_upside = ((epv_per_share - price) / price * 100.0) if price > 0 else 0.0

    epv_out = {
        "epv": round(epv_per_share, 2),
        "upside_pct": round(epv_upside, 2)
    }

    # 6. Sensitivity Matrix (WACC vs Growth Rate)
    wacc_steps = [wacc_rate - 0.02, wacc_rate - 0.01, wacc_rate, wacc_rate + 0.01, wacc_rate + 0.02]
    growth_steps = [0.06, 0.09, 0.12, 0.15, 0.18]

    rows = []
    for w_step in wacc_steps:
        if w_step <= 0.01:
            continue
        vals = []
        for g_step in growth_steps:
            if fcf_is_positive:
                t_g = min(0.04, g_step)
                proj = [last_fcf * ((1.0 + g_step) ** i) for i in range(1, 6)]
                pv_f = sum(f / ((1.0 + w_step) ** i) for i, f in enumerate(proj, 1))
                tv = proj[-1] * (1.0 + t_g) / max(w_step - t_g, 0.01)
                pv_t = tv / ((1.0 + w_step) ** 5)
                ev = pv_f + pv_t
                eq = ev - net_debt
                val = max(0.0, eq / shares)
            else:
                # Fallback multipliers for sensitivity matrix under negative FCF
                mult = 1.0 + (g_step - 0.12) - (w_step - wacc_rate) * 2.0
                val = price * max(0.5, mult)

            vals.append({
                "growth_rate": round(g_step, 4),
                "intrinsic_value": round(val, 2)
            })

        rows.append({
            "wacc": round(w_step, 4),
            "valuations": vals
        })

    sensitivity_out = {
        "rows": rows
    }

    # 7. Sector Multiple-based Target Price
    pe_targets = {
        "IT": 25.0,
        "PHARMA": 22.0,
        "BANKING": 15.0,
        "INFRA": 12.0,
        "AUTO": 18.0,
        "CONSUMER": 35.0
    }
    ev_ebitda_targets = {
        "IT": 15.0,
        "PHARMA": 14.0,
        "BANKING": 10.0,
        "INFRA": 8.0,
        "AUTO": 10.0,
        "CONSUMER": 22.0
    }

    sec = (sector or "IT").upper()
    pe_target = pe_targets.get(sec, 15.0)
    ev_ebitda_target = ev_ebitda_targets.get(sec, 10.0)

    multiple_out = {
        "pe_target": pe_target,
        "evEbitda_target": ev_ebitda_target
    }

    # 8. WACC Assumptions summary
    wacc_assumptions = {
        "wacc": round(wacc_rate, 4),
        "cost_of_equity": wacc.get("cost_of_equity") if isinstance(wacc, dict) else 0.12,
        "cost_of_debt": wacc.get("cost_of_debt") if isinstance(wacc, dict) else 0.06,
        "tax_rate": round(tax_rate, 4)
    }

    return {
        "dcf": dcf_out,
        "reverse_dcf": reverse_dcf_out,
        "earnings_power_value": epv_out,
        "sensitivity_matrix": sensitivity_out,
        "multiple_based": multiple_out,
        "wacc_assumptions": wacc_assumptions
    }
