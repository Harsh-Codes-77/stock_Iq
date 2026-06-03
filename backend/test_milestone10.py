import asyncio
import os
import sys

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.engines.embedder import store_chunks_in_vector_db
from backend.engines.forensic_engine import run_forensic_analysis
from backend.core.vector_store import get_chroma_client
from backend.engines.rules_engine import Signal

async def test_forensic_engine():
    print("=== Running Milestone 10 Forensic Engine Tests ===")
    
    ticker = "TCS"
    
    # 1. Clear any existing ChromaDB collections for the test ticker to ensure clean slate
    client = get_chroma_client()
    collection_name = f"stockiq_{ticker.lower()}"
    try:
        client.delete_collection(collection_name)
        print(f"Cleared existing collection {collection_name}")
    except Exception:
        pass
        
    # 2. Mock MD&A / Notes to Accounts chunks matching forensic queries
    chunks = [
        {
            "content": (
                "Note 34: Related Party Transactions. The Company entered into material sales transactions with its "
                "parent entity, ParentCorp, totaling $150 million. These transactions were conducted on an arm's length basis, "
                "although outstanding trade receivables from the parent entity increased by 45% during the fiscal year."
            ),
            "chunk_index": 0,
            "section_type": "MD_AND_A",
            "section_title": "Notes to Accounts - Related Parties"
        },
        {
            "content": (
                "Note 42: Contingent Liabilities. The Company has outstanding contingent liabilities of $85 million "
                "relating to disputed tax assessments and ongoing intellectual property litigation. No provision has been "
                "made in the financial statements as management believes the outflow of resources is unlikely."
            ),
            "chunk_index": 1,
            "section_type": "MD_AND_A",
            "section_title": "Notes to Accounts - Contingent Liabilities"
        },
        {
            "content": (
                "Note 2: Summary of Significant Accounting Policies. Revenue Recognition. During the year, the company "
                "aligned its revenue recognition policy for licensing agreements with standard market practices, leading to "
                "recognition of $25 million of future license fees upfront, which was previously deferred."
            ),
            "chunk_index": 2,
            "section_type": "MD_AND_A",
            "section_title": "Notes to Accounts - Revenue Recognition"
        },
        {
            "content": (
                "Report of the Independent Auditor. Audit Qualifications. The auditors noted that while the financial "
                "statements present a true and fair view in all material respects, they draw attention to Note 18 regarding "
                "the recoverability of deferred tax assets amounting to $40 million, which is dependent on future taxable profits."
            ),
            "chunk_index": 3,
            "section_type": "MD_AND_A",
            "section_title": "Auditor's Report"
        },
        {
            "content": (
                "Note 14: Impairment of Assets. The company recorded impairment charges of $18 million in relation to its "
                "subsidiary goodwill and write-down of slow-moving inventory items valued at $5 million due to changing technological standards."
            ),
            "chunk_index": 4,
            "section_type": "MD_AND_A",
            "section_title": "Notes to Accounts - Impairments"
        },
        {
            "content": (
                "Note 20: Short-term Borrowings. Working capital loans increased by $65 million to support inventory staging "
                "and receivables collections. Interest rates on the loans range from 8.5% to 10.2% per annum, secured against "
                "the current assets of the company."
            ),
            "chunk_index": 5,
            "section_type": "MD_AND_A",
            "section_title": "Notes to Accounts - Borrowings"
        }
    ]
    
    # 3. Store mock chunks in ChromaDB
    print("Indexing mock MD&A chunks into ChromaDB...")
    stored = await store_chunks_in_vector_db(
        ticker=ticker,
        document_id=201,
        document_type="ANNUAL_REPORT",
        fiscal_year=2024,
        chunks=chunks
    )
    print(f"Stored {stored} chunks in vector database.")
    
    # 4. Set up mock financials, quant scores, rules signals, and shareholding data
    mock_financials = [
        {"fiscal_year": 2024, "revenue": 1000.0, "pat": 100.0},
        {"fiscal_year": 2023, "revenue": 900.0, "pat": 90.0}
    ]
    
    mock_quant_scores = {
        "beneish": {"mScore": -2.10, "verdict": "NON_MANIPULATOR"}, # below threshold -1.78
        "altman": {"zScore": 1.45, "zone": "GREY_ZONE"},
        "piotroski": {"score": 7}
    }
    
    # Add a mock RED_FLAG rules engine signal to trigger prompt logic
    mock_rules_signals = [
        Signal(
            rule_id="RULE_EQ02",
            severity="RED_FLAG",
            category="EARNINGS_QUALITY",
            title="Persistent low cash conversion",
            evidence="CFO/PAT ratio = 0.52 for 2 consecutive years",
            implication="High risk of cash flow deficit relative to book profits."
        ),
        Signal(
            rule_id="RULE_FR03",
            severity="RED_FLAG",
            category="GROWTH",
            title="High promoter pledge",
            evidence="Promoter pledged shares at 42.0%",
            implication="Subject to margin call risks if prices decline."
        )
    ]
    
    mock_shareholding = {
        "promoter_pledge_pct": 42.0,
        "promoter_holding_trend": "Decreasing: 65% to 61% YoY"
    }
    
    # 5. Run forensic analysis
    print("\nRunning Forensic Risk Assessment...")
    result = await run_forensic_analysis(
        ticker=ticker,
        financials=mock_financials,
        quant_scores=mock_quant_scores,
        rules_signals=mock_rules_signals,
        shareholding=mock_shareholding
    )
    
    print("\n=== Forensic Risk Assessment Output ===")
    import pprint
    pprint.pprint(result)
    
    # 6. Assertions
    assert "fraud_probability_score" in result, "Output missing 'fraud_probability_score'"
    assert "earnings_quality_score" in result, "Output missing 'earnings_quality_score'"
    assert "key_concerns" in result, "Output missing 'key_concerns'"
    assert "clean_signals" in result, "Output missing 'clean_signals'"
    assert "overall_forensic_verdict" in result, "Output missing 'overall_forensic_verdict'"
    assert "one_paragraph_summary" in result, "Output missing 'one_paragraph_summary'"
    
    # Data type checks
    assert isinstance(result["fraud_probability_score"], (int, float)), "fraud_probability_score should be numeric"
    assert isinstance(result["earnings_quality_score"], (int, float)), "earnings_quality_score should be numeric"
    assert isinstance(result["key_concerns"], list), "key_concerns should be a list"
    assert isinstance(result["clean_signals"], list), "clean_signals should be a list"
    assert result["overall_forensic_verdict"] in ["CLEAN", "MINOR_CONCERNS", "SIGNIFICANT_CONCERNS", "HIGH_RISK"], "Invalid overall_forensic_verdict"
    assert isinstance(result["one_paragraph_summary"], str), "one_paragraph_summary should be a string"
    
    print("\nMilestone 10: ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_forensic_engine())
