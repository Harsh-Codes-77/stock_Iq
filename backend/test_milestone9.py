import asyncio
import os
import sys

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.engines.embedder import store_chunks_in_vector_db
from backend.engines.concall_engine import run_concall_engine
from backend.core.vector_store import get_chroma_client

async def test_concall_engine():
    print("=== Running Milestone 9 Concall Engine Tests ===")
    
    ticker = "INFY"
    
    # 1. Clear any existing ChromaDB collections for the test ticker to ensure a clean slate
    client = get_chroma_client()
    collection_name = f"stockiq_{ticker.lower()}"
    try:
        client.delete_collection(collection_name)
        print(f"Cleared existing collection {collection_name}")
    except Exception:
        pass
        
    # 2. Mock 2 concall transcripts
    # Document 1: Q1FY24 Call
    chunks_q1 = [
        {
            "content": (
                "Welcome to the INFY Q1FY24 earnings conference call. We are pleased to report a solid start to the fiscal year. "
                "For the full year, we guide for 10-12% revenue growth in constant currency. We expect operating margins to remain "
                "in the 20-22% range. However, we faced temporary headwinds in the retail sector due to macro uncertainties and "
                "inflationary pressures in North America. We anticipate capital expenditure of $300 million. We remain confident in "
                "our long-term robust business model and strong pipelines."
            ),
            "chunk_index": 0,
            "section_type": "CONCALL_TRANSCRIPT",
            "section_title": "Q1 Management Discussion"
        }
    ]
    
    # Document 2: Q2FY24 Call
    chunks_q2 = [
        {
            "content": (
                "Thank you for joining the INFY Q2FY24 earnings call. This quarter, we guide for 9-11% revenue growth, reflecting "
                "some delays in client decision-making. We expect margin pressures to ease in the coming quarters. We experienced "
                "temporary headwinds due to geopolitical uncertainty and one-off supply chain delays in Europe. When asked about "
                "the margin recovery timeline, management responded with general remarks on efficiency measures but did not provide "
                "specific dates. In terms of working capital deterioration, we are working closely to optimize inventories. "
                "Overall, our pipeline remains robust and we are confident in our resilient execution."
            ),
            "chunk_index": 0,
            "section_type": "CONCALL_TRANSCRIPT",
            "section_title": "Q2 Management Discussion"
        }
    ]
    
    # 3. Store mock chunks in ChromaDB
    print("Indexing Q1 FY24 transcript...")
    stored_q1 = await store_chunks_in_vector_db(
        ticker=ticker,
        document_id=101,
        document_type="CONCALL_TRANSCRIPT",
        fiscal_year=2024,
        chunks=chunks_q1
    )
    print(f"Indexed {stored_q1} chunks.")
    
    print("Indexing Q2 FY24 transcript...")
    stored_q2 = await store_chunks_in_vector_db(
        ticker=ticker,
        document_id=102,
        document_type="CONCALL_TRANSCRIPT",
        fiscal_year=2024,
        chunks=chunks_q2
    )
    print(f"Indexed {stored_q2} chunks.")
    
    # 4. Run Concall Engine
    print("\nRunning Concall Engine Analysis...")
    result = await run_concall_engine(ticker=ticker)
    
    # 5. Output Verification
    print("\n=== Concall Engine Analysis JSON Output ===")
    import pprint
    pprint.pprint(result)
    
    # Validate Step B AI response schema
    assert "guidance_statements" in result, "Schema missing 'guidance_statements'"
    assert "repeated_excuses" in result, "Schema missing 'repeated_excuses'"
    assert "avoided_topics" in result, "Schema missing 'avoided_topics'"
    assert "confidence_trajectory" in result, "Schema missing 'confidence_trajectory'"
    assert "management_credibility_score" in result, "Schema missing 'management_credibility_score'"
    assert "key_risks_mentioned" in result, "Schema missing 'key_risks_mentioned'"
    assert "key_opportunities_mentioned" in result, "Schema missing 'key_opportunities_mentioned'"
    
    # Validate Step A Heuristic output
    assert "rule_based_detection" in result, "Schema missing 'rule_based_detection'"
    heuristics = result["rule_based_detection"]
    assert "guidance_statements" in heuristics, "Heuristic result missing 'guidance_statements'"
    assert "excuse_patterns" in heuristics, "Heuristic result missing 'excuse_patterns'"
    assert "confidence_indicators" in heuristics, "Heuristic result missing 'confidence_indicators'"
    
    # Check that heuristics found matches
    print(f"\nHeuristic Guidance Count: {len(heuristics['guidance_statements'])}")
    print(f"Heuristic Excuse Count: {len(heuristics['excuse_patterns'])}")
    print(f"Heuristic Confidence Score: {heuristics['confidence_indicators']}")
    
    assert len(heuristics["guidance_statements"]) > 0, "Heuristic guidance statements list should not be empty"
    assert len(heuristics["excuse_patterns"]) > 0, "Heuristic excuse patterns list should not be empty"
    assert heuristics["confidence_indicators"] in ["HIGH", "MEDIUM", "LOW"], "Confidence indicator should be qualitative score"
    
    print("\nMilestone 9: ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_concall_engine())
