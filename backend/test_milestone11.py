import asyncio
import os
import sys

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.engines.embedder import store_chunks_in_vector_db
from backend.engines.rag_analysis_engine import run_rag_analysis_for_section, ANALYSIS_SECTIONS
from backend.core.vector_store import get_chroma_client

async def test_rag_analysis_engine():
    print("=== Running Milestone 11 RAG Analysis Engine Tests ===")
    
    ticker = "RIL"
    
    # 1. Clear any existing ChromaDB collections for the test ticker to ensure clean slate
    client = get_chroma_client()
    collection_name = f"stockiq_{ticker.lower()}"
    try:
        client.delete_collection(collection_name)
        print(f"Cleared existing collection {collection_name}")
    except Exception:
        pass
        
    # 2. Mock RAG chunks covering different section types and queries
    chunks = [
        # Executive Summary / Business Overview
        {
            "content": (
                "RIL is a diversified conglomerate. Our business strategy focuses on expanding digital services "
                "via Jio and retail footprint via Reliance Retail. For the fiscal year, consolidated revenue increased "
                "by 14% to $110 billion. Management guides for continued expansion of retail stores and aims to launch "
                "new 5G services nationwide by Q4."
            ),
            "chunk_index": 0,
            "section_type": "BUSINESS_OVERVIEW",
            "section_title": "Corporate Overview"
        },
        # Business Model / Segment Performance
        {
            "content": (
                "RIL generates revenue from three primary segments: Oil-to-Chemicals (O2C) contributing 60% of revenues, "
                "Retail contributing 25%, and Digital Services (Jio) contributing 15%. Jio monetization flows through "
                "monthly subscriber tariffs, serving over 440 million active users. Retail operates through physical stores and e-commerce."
            ),
            "chunk_index": 1,
            "section_type": "SEGMENT_PERFORMANCE",
            "section_title": "Revenue Breakdown"
        },
        # Competitive Moat / Business Overview
        {
            "content": (
                "Our competitive advantage stems from vertical integration in our O2C business and massive scale-based pricing "
                "power in telecom. Jio has built significant barriers to entry through a proprietary nationwide fiber network, "
                "making it highly difficult for new entrants to match our cost structure or speed."
            ),
            "chunk_index": 2,
            "section_type": "BUSINESS_OVERVIEW",
            "section_title": "Market Position"
        }
    ]
    
    # 3. Store mock chunks in ChromaDB
    print("Indexing mock chunks into ChromaDB...")
    stored = await store_chunks_in_vector_db(
        ticker=ticker,
        document_id=301,
        document_type="ANNUAL_REPORT",
        fiscal_year=2024,
        chunks=chunks
    )
    print(f"Stored {stored} chunks in vector database.")
    
    # 4. Set up mock quant scores
    mock_quant_scores = {
        "piotroski": {"score": 8},
        "altman": {"zScore": 2.8, "zone": "SAFE_ZONE"},
        "dcf": {"valuation": 2450.0}
    }
    
    # 5. Run tests for a couple of sections
    test_sections = ["executive_summary", "business_model", "competitive_moat"]
    
    for section in test_sections:
        print(f"\nRunning RAG Analysis for section: {section}...")
        result = await run_rag_analysis_for_section(
            ticker=ticker,
            section_key=section,
            quant_scores=mock_quant_scores
        )
        
        print(f"=== {section} Output ===")
        import pprint
        pprint.pprint(result)
        
        # Verify schema
        target_schema = ANALYSIS_SECTIONS[section]["target_schema"]
        for key in target_schema.keys():
            assert key in result, f"Section {section} result missing key: {key}"

    # 6. Test insufficient data handling
    print("\nRunning RAG Analysis for empty section to test fallback/insufficient data handling...")
    # Using 'risk_analysis' where no RISK_FACTORS section chunks are indexed
    result_empty = await run_rag_analysis_for_section(
        ticker=ticker,
        section_key="risk_analysis",
        quant_scores=mock_quant_scores
    )
    print("=== risk_analysis (Empty) Output ===")
    import pprint
    pprint.pprint(result_empty)
    
    # Check that at least one of the fields resolved to INSUFFICIENT_DATA due to lack of risk chunks
    # (Since there are no RISK_FACTORS chunks in database)
    assert any(val == "INSUFFICIENT_DATA" or "insufficient" in str(val).lower() for val in result_empty.values()), \
        "Empty section analysis should result in INSUFFICIENT_DATA fields"
    
    print("\nMilestone 11: ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_rag_analysis_engine())
