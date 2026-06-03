import asyncio
import os
import sys

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.engines.report_orchestrator import generate_full_report

async def test_orchestrator():
    print("=== Running Milestone 13 Orchestrator Integration Test ===")
    
    ticker = "TCS"
    print(f"Executing generate_full_report for {ticker}...")
    
    try:
        report = await generate_full_report(ticker, force_refresh=False)
        print("\nReport generation completed successfully!")
        
        # Verify stages of pipeline
        print("\n--- Pipeline Stages Log ---")
        for log in report.get("pipeline_log", []):
            print(f"  [{log['stage']}] @ {log['timestamp']}")
            
        print(f"\nData Completeness: {report.get('data_completeness')}%")
        print(f"Total Errors Recorded: {len(report.get('errors', []))}")
        for err in report.get("errors", []):
            print(f"  - Error: {err}")
            
        # Basic validations
        assert "ticker" in report, "Report missing 'ticker'"
        assert report["ticker"] == "TCS", f"Expected ticker 'TCS', got {report['ticker']}"
        assert "pipeline_log" in report, "Report missing 'pipeline_log'"
        assert "company" in report, "Report missing 'company'"
        assert "financials" in report, "Report missing 'financials'"
        assert "quant_scores" in report, "Report missing 'quant_scores'"
        assert "signals" in report, "Report missing 'signals'"
        assert "concall_analysis" in report, "Report missing 'concall_analysis'"
        assert "forensic_analysis" in report, "Report missing 'forensic_analysis'"
        assert "rag_analysis" in report, "Report missing 'rag_analysis'"
        assert "valuation" in report, "Report missing 'valuation'"
        assert "data_completeness" in report, "Report missing 'data_completeness'"
        
        print("\nMilestone 13 Integration Test: ALL TESTS PASSED SUCCESSFULLY!")
        
    except Exception as e:
        print(f"\nERROR: Report orchestrator integration test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_orchestrator())
