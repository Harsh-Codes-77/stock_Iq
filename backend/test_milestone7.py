import sys
import os

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.quant_scores import (
    piotroski_f_score,
    beneish_m_score,
    altman_z_score_emerging_markets,
    dupont_decomposition,
    working_capital_cycle,
    calculate_wacc,
    dcf_valuation,
    incremental_roce,
    operating_leverage
)

def run_tests():
    print("=== Running Milestone 7 Verification Tests ===")

    # Mock financial data (TCS-like data)
    test_financials = [
        {
            "fiscal_year": 2024,
            "revenue": 240000.0,
            "ebitda": 60000.0,
            "ebit": 55000.0,
            "pat": 46000.0,
            "cfo": 50000.0,
            "total_assets": 150000.0,
            "total_equity": 100000.0,
            "total_debt": 10000.0,
            "current_assets": 80000.0,
            "current_liabilities": 40000.0,
            "shares_outstanding": 3600.0,
            "trade_receivables": 40000.0,
            "inventory": 10000.0,
            "trade_payables": 15000.0,
            "retained_earnings": 70000.0,
            "depreciation": 5000.0
        },
        {
            "fiscal_year": 2023,
            "revenue": 225000.0,
            "ebitda": 56000.0,
            "ebit": 51500.0,
            "pat": 42000.0,
            "cfo": 46000.0,
            "total_assets": 140000.0,
            "total_equity": 95000.0,
            "total_debt": 12000.0,
            "current_assets": 75000.0,
            "current_liabilities": 38000.0,
            "shares_outstanding": 3600.0,
            "trade_receivables": 38000.0,
            "inventory": 9500.0,
            "trade_payables": 14000.0,
            "retained_earnings": 65000.0,
            "depreciation": 4500.0
        },
        {
            "fiscal_year": 2022,
            "revenue": 190000.0,
            "ebitda": 48000.0,
            "ebit": 44000.0,
            "pat": 38000.0,
            "cfo": 40000.0,
            "total_assets": 120000.0,
            "total_equity": 85000.0,
            "total_debt": 15000.0,
            "current_assets": 65000.0,
            "current_liabilities": 32000.0,
            "shares_outstanding": 3600.0,
            "trade_receivables": 32000.0,
            "inventory": 8000.0,
            "trade_payables": 12000.0,
            "retained_earnings": 55000.0,
            "depreciation": 4000.0
        },
        {
            "fiscal_year": 2021,
            "revenue": 160000.0,
            "ebitda": 42000.0,
            "ebit": 38500.0,
            "pat": 32000.0,
            "cfo": 35000.0,
            "total_assets": 105000.0,
            "total_equity": 75000.0,
            "total_debt": 18000.0,
            "current_assets": 55000.0,
            "current_liabilities": 28000.0,
            "shares_outstanding": 3650.0,
            "trade_receivables": 28000.0,
            "inventory": 7000.0,
            "trade_payables": 10000.0,
            "retained_earnings": 45000.0,
            "depreciation": 3500.0
        },
        {
            "fiscal_year": 2020,
            "revenue": 155000.0,
            "ebitda": 41000.0,
            "ebit": 37500.0,
            "pat": 31000.0,
            "cfo": 33000.0,
            "total_assets": 100000.0,
            "total_equity": 70000.0,
            "total_debt": 20000.0,
            "current_assets": 50000.0,
            "current_liabilities": 27000.0,
            "shares_outstanding": 3700.0,
            "trade_receivables": 27000.0,
            "inventory": 6500.0,
            "trade_payables": 9500.0,
            "retained_earnings": 40000.0,
            "depreciation": 3500.0
        }
    ]

    # Test 1: Piotroski F-Score
    p = piotroski_f_score(test_financials)
    print(f"Piotroski Score: {p['score']}/9 — {p['interpretation']}")
    assert p['score'] is not None, "Piotroski score should not be None"
    assert 0 <= p['score'] <= 9, "Piotroski score must be between 0 and 9"

    # Test 2: Beneish M-Score
    m = beneish_m_score(test_financials)
    print(f"Beneish M-Score: {m['m_score']} (Flag: {m['flag']})")
    assert m['m_score'] is not None, "Beneish score should not be None"
    assert "DSRI" in m['components'], "Beneish components missing DSRI"

    # Test 3: Altman Z-Score
    z = altman_z_score_emerging_markets(test_financials)
    print(f"Altman Z-Score: {z['z_score']} (Zone: {z['zone']})")
    assert z['z_score'] is not None, "Altman score should not be None"
    assert z['zone'] in ["SAFE", "GREY", "DISTRESS"], "Invalid Altman zone"

    # Test 4: DuPont Decomposition
    d = dupont_decomposition(test_financials)
    print(f"DuPont ROE: {d['roe']}% (NPM: {d['net_profit_margin']}%, Asset Turnover: {d['asset_turnover']}, Equity Multiplier: {d['equity_multiplier']})")
    assert d['roe'] is not None, "DuPont ROE should not be None"

    # Test 5: Working Capital Cycle
    wcc = working_capital_cycle(test_financials)
    print(f"Working Capital Cycle (Days): Receivables={wcc['days_receivables']}, Inventory={wcc['days_inventory']}, Payables={wcc['days_payable']}, CCC={wcc['cash_conversion_cycle']}")
    assert wcc['cash_conversion_cycle'] is not None, "CCC should not be None"

    # Test 6: WACC Calculation
    # Let's get market cap, total debt, and beta from 2024
    wacc_dict = calculate_wacc(market_cap=2000000.0, total_debt=10000.0, beta=1.1)
    print(f"WACC: {wacc_dict['wacc'] * 100:.2f}% (Cost of Equity: {wacc_dict['cost_of_equity'] * 100:.2f}%)")
    assert wacc_dict['wacc'] is not None, "WACC should not be None"

    # Test 7: DCF Valuation
    dcf = dcf_valuation(last_fcf=40000.0, wacc=wacc_dict, price=3000.0, shares=3600.0, net_debt=10000.0)
    print(f"DCF base Intrinsic Value: {dcf['base']['intrinsic_value']} (Upside: {dcf['base']['upside']}%)")
    assert dcf['base']['intrinsic_value'] > 0, "Intrinsic value should be positive"

    # Test 8: Incremental ROCE
    iroce = incremental_roce(test_financials)
    print(f"Incremental ROCE: {iroce['value']}% (Interpretation: {iroce['interpretation']})")
    assert iroce['value'] is not None, "Incremental ROCE should not be None"
    for period in iroce['periods']:
        print(f"  Period {period['period']}: {period['value']}% | EBIT Change: {period['change_in_ebit']} | CE Change: {period['change_in_capital_employed']}")

    # Test 9: Operating Leverage
    op_lev = operating_leverage(test_financials)
    print(f"Operating Leverage: {op_lev['value']} (Interpretation: {op_lev['interpretation']})")
    assert op_lev['value'] is not None, "Operating Leverage should not be None"
    for period in op_lev['periods']:
        print(f"  YoY {period['period']}: {period['value']} | Revenue Change %: {period['pct_change_revenue']}% | EBIT Change %: {period['pct_change_ebit']}%")

    # Test 10: Null safety check with insufficient data
    insufficient_data = test_financials[:1]
    res = piotroski_f_score(insufficient_data)
    print(f"Null Safety response for < 2 years: {res}")
    assert res["score"] is None, "Null safety check failed"
    assert res["data_quality"] == "INSUFFICIENT", "Null safety data quality check failed"

    print("\nAll quantitative score tests PASSED successfully!")

if __name__ == "__main__":
    run_tests()
