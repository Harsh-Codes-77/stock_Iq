import sys
import os

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.engines.valuation_engine import run_full_valuation

def main():
    print("=== Running Milestone 12 Valuation Engine Tests ===")

    test_financials = [
        {
            "fiscal_year": 2024,
            "fcf": 120.0,
            "ebit": 150.0,
            "tax_rate": 0.25
        },
        {
            "fiscal_year": 2023,
            "fcf": 100.0,
            "ebit": 130.0,
            "tax_rate": 0.25
        }
    ]

    test_metrics = {
        "current_price": 1500.0,
        "shares_outstanding": 0.5, # 0.5 shares
        "net_debt": 50.0,
        "ebit": 150.0,
        "tax_rate": 0.25
    }

    test_wacc = {
        "wacc": 0.09,
        "cost_of_equity": 0.11,
        "cost_of_debt": 0.05
    }

    # Run full valuation
    result = run_full_valuation(test_financials, test_metrics, test_wacc, "IT")

    # Assertions requested in the prompt
    assert "dcf" in result
    assert "reverse_dcf" in result
    assert result["dcf"]["base"]["intrinsic_value"] > 0
    assert result["sensitivity_matrix"]["rows"]

    print("Bear:", result["dcf"]["bear"]["intrinsic_value"])
    print("Base:", result["dcf"]["base"]["intrinsic_value"])
    print("Bull:", result["dcf"]["bull"]["intrinsic_value"])
    print("Reverse DCF implied growth:", result["reverse_dcf"]["implied_growth_rate"])

    # Additional verifications
    assert "earnings_power_value" in result
    assert "multiple_based" in result
    assert "wacc_assumptions" in result
    assert result["multiple_based"]["pe_target"] == 25.0  # target PE for IT sector

    print("\nEarnings Power Value:", result["earnings_power_value"]["epv"])
    print("EPV Upside %:", result["earnings_power_value"]["upside_pct"])
    print("Reverse DCF Interpretation:", result["reverse_dcf"]["interpretation"])
    print("Sensitivity matrix rows count:", len(result["sensitivity_matrix"]["rows"]))

    print("\nMilestone 12: ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
