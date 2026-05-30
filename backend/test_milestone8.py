import sys
import os

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.rules_engine import run_all_rules, Signal

def test_rules_engine():
    print("=== Running Milestone 8 Verification Tests ===")

    # Scenario 1: A business with several red/yellow flags
    # - Low cash conversion: CFO/PAT < 0.7 for 2 consecutive years (RULE_EQ02)
    # - Receivables stretch: trade receivables spike (RULE_WC01)
    # - Dangerous leverage: high debt, low interest coverage (RULE_LV01)
    # - High promoter pledge: 45% (RULE_FR03)
    # - Promoter stake decrease: 60% -> 54% (RULE_FR04)
    # - Altman Z distress: < 1.1 (RULE_FR05)
    flagged_financials = [
        {
            "fiscal_year": 2024,
            "revenue": 100000.0,
            "ebitda": 15000.0,
            "ebit": 3000.0,
            "pat": 8000.0,
            "cfo": 4000.0, # CFO/PAT = 0.5
            "total_assets": 100000.0,
            "total_equity": 5000.0,
            "total_debt": 70000.0, # D/E = 14
            "current_assets": 20000.0,
            "current_liabilities": 45000.0,
            "shares_outstanding": 1000.0,
            "share_price": 10.0,
            "trade_receivables": 30000.0, # Receivables days = 109.5
            "inventory": 10000.0,
            "trade_payables": 10000.0,
            "retained_earnings": 1000.0,
            "depreciation": 5000.0,
            "interest_expense": 6000.0, # Interest Coverage = 3000 / 6000 = 0.5x
            "capex": 2000.0
        },
        {
            "fiscal_year": 2023,
            "revenue": 95000.0,
            "ebitda": 18000.0,
            "ebit": 13000.0,
            "pat": 9000.0,
            "cfo": 4500.0, # CFO/PAT = 0.5
            "total_assets": 98000.0,
            "total_equity": 22000.0,
            "total_debt": 48000.0,
            "current_assets": 32000.0,
            "current_liabilities": 32000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 15000.0, # Receivables days = 57.6
            "inventory": 8000.0,
            "trade_payables": 9000.0,
            "retained_earnings": 6000.0,
            "depreciation": 5000.0,
            "interest_expense": 5500.0
        },
        {
            "fiscal_year": 2022,
            "revenue": 90000.0,
            "ebitda": 17000.0,
            "ebit": 12000.0,
            "pat": 8500.0,
            "cfo": 5000.0,
            "total_assets": 95000.0,
            "total_equity": 21000.0,
            "total_debt": 45000.0,
            "current_assets": 30000.0,
            "current_liabilities": 30000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 14000.0,
            "inventory": 7500.0,
            "trade_payables": 8500.0,
            "retained_earnings": 5500.0,
            "depreciation": 5000.0,
            "interest_expense": 5000.0
        },
        {
            "fiscal_year": 2021,
            "revenue": 85000.0,
            "ebitda": 16000.0,
            "ebit": 11000.0,
            "pat": 8000.0,
            "cfo": 4800.0,
            "total_assets": 90000.0,
            "total_equity": 20000.0,
            "total_debt": 40000.0,
            "current_assets": 28000.0,
            "current_liabilities": 28000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 13000.0,
            "inventory": 7000.0,
            "trade_payables": 8000.0,
            "retained_earnings": 5000.0,
            "depreciation": 5000.0,
            "interest_expense": 4500.0
        }
    ]

    flagged_shareholding = {
        "promoter_holding": 54.0,
        "promoter_holding_prev": 60.0, # Decreased by 6% (RULE_FR04)
        "promoter_pledge_pct": 45.0, # Pledged > 40% (RULE_FR03)
        "beta": 1.2
    }

    signals = run_all_rules(flagged_financials, flagged_shareholding)
    print(f"Total signals found: {len(signals)}")
    for s in signals:
        print(f"  [{s.severity}] {s.rule_id}: {s.title}")
        print(f"    Evidence: {s.evidence}")
        print(f"    Implication: {s.implication}")

    # Verify that specific expected rules triggered
    rule_ids = [s.rule_id for s in signals]
    assert "RULE_EQ02" in rule_ids, "RULE_EQ02 (Low cash conversion) should have triggered"
    assert "RULE_WC01" in rule_ids, "RULE_WC01 (Receivables stretch) should have triggered"
    assert "RULE_LV01" in rule_ids, "RULE_LV01 (Dangerous leverage) should have triggered"
    assert "RULE_FR03" in rule_ids, "RULE_FR03 (High promoter pledge) should have triggered"
    assert "RULE_FR04" in rule_ids, "RULE_FR04 (Promoter stake decrease) should have triggered"
    assert "RULE_FR05" in rule_ids, "RULE_FR05 (Altman Z distress) should have triggered"

    # Scenario 2: A healthy business with positive metrics
    # - Consistent high quality earnings: CFO/PAT > 1.3 for 2 consecutive years (RULE_EQ03)
    # - Negative Cash Conversion Cycle (RULE_WC03)
    # - Deliberate deleveraging (RULE_LV02)
    # - FCF yield > 5% consistently (RULE_CA02)
    healthy_financials = [
        {
            "fiscal_year": 2024,
            "revenue": 200000.0,
            "ebitda": 50000.0,
            "ebit": 45000.0,
            "pat": 35000.0,
            "cfo": 50000.0, # CFO/PAT = 1.43
            "total_assets": 120000.0,
            "total_equity": 100000.0,
            "total_debt": 5000.0, # D/E = 0.05
            "current_assets": 60000.0,
            "current_liabilities": 20000.0,
            "shares_outstanding": 1000.0,
            "share_price": 100.0, # Market cap = 100,000
            "trade_receivables": 10000.0, # Rec Days = 18.25
            "inventory": 5000.0, # Inv Days = 15.2
            "trade_payables": 30000.0, # Pay Days = 91.25 -> Negative CCC!
            "retained_earnings": 50000.0,
            "depreciation": 5000.0,
            "capex": 5000.0 # FCF = CFO - capex = 45000 -> FCF Yield = 45%
        },
        {
            "fiscal_year": 2023,
            "revenue": 180000.0,
            "ebitda": 45000.0,
            "ebit": 40000.0,
            "pat": 30000.0,
            "cfo": 42000.0, # CFO/PAT = 1.4
            "total_assets": 110000.0,
            "total_equity": 85000.0,
            "total_debt": 10000.0, # D/E = 0.12
            "current_assets": 50000.0,
            "current_liabilities": 18000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 9000.0,
            "inventory": 4500.0,
            "trade_payables": 28000.0,
            "retained_earnings": 40000.0,
            "depreciation": 5000.0,
            "capex": 4000.0 # FCF = 38000 -> FCF Yield = 38%
        },
        {
            "fiscal_year": 2022,
            "revenue": 160000.0,
            "ebitda": 40000.0,
            "ebit": 35000.0,
            "pat": 26000.0,
            "cfo": 38000.0,
            "total_assets": 100000.0,
            "total_equity": 70000.0,
            "total_debt": 15000.0, # D/E = 0.21
            "current_assets": 45000.0,
            "current_liabilities": 16000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 8000.0,
            "inventory": 4000.0,
            "trade_payables": 25000.0,
            "retained_earnings": 30000.0,
            "depreciation": 5000.0
        },
        {
            "fiscal_year": 2021,
            "revenue": 140000.0,
            "ebitda": 35000.0,
            "ebit": 30000.0,
            "pat": 22000.0,
            "cfo": 32000.0,
            "total_assets": 90000.0,
            "total_equity": 55000.0,
            "total_debt": 22000.0, # D/E = 0.40
            "current_assets": 40000.0,
            "current_liabilities": 15000.0,
            "shares_outstanding": 1000.0,
            "trade_receivables": 7000.0,
            "inventory": 3500.0,
            "trade_payables": 20000.0,
            "retained_earnings": 20000.0,
            "depreciation": 5000.0
        }
    ]

    healthy_shareholding = {
        "promoter_holding": 75.0,
        "promoter_holding_prev": 75.0,
        "promoter_pledge_pct": 0.0,
        "beta": 0.8
    }

    signals_healthy = run_all_rules(healthy_financials, healthy_shareholding)
    print(f"\nTotal healthy signals found: {len(signals_healthy)}")
    for s in signals_healthy:
        print(f"  [{s.severity}] {s.rule_id}: {s.title}")
        print(f"    Evidence: {s.evidence}")

    healthy_rule_ids = [s.rule_id for s in signals_healthy]
    assert "RULE_EQ03" in healthy_rule_ids, "RULE_EQ03 (High quality earnings) should have triggered"
    assert "RULE_WC03" in healthy_rule_ids, "RULE_WC03 (Negative CCC) should have triggered"
    assert "RULE_LV02" in healthy_rule_ids, "RULE_LV02 (Deleveraging) should have triggered"
    assert "RULE_CA02" in healthy_rule_ids, "RULE_CA02 (FCF Yield > 5%) should have triggered"

    # Scenario 3: Insufficient data null-safety check
    insufficient_res = run_all_rules(healthy_financials[:1], healthy_shareholding)
    print(f"\nNull Safety response for < 2 years: {insufficient_res}")
    assert insufficient_res["score"] is None, "Null safety check failed"
    assert insufficient_res["data_quality"] == "INSUFFICIENT", "Null safety data quality check failed"

    print("\nAll Rules Engine tests PASSED successfully!")

if __name__ == "__main__":
    test_rules_engine()
