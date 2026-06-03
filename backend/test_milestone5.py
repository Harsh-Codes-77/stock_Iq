# backend/test_milestone5.py
import os
import shutil
import urllib.request
import asyncio
from pathlib import Path
from backend.engines.pdf_extractor import extract_pdf
from backend.engines.semantic_chunker import chunk_document
from backend.engines.embedder import store_chunks_in_vector_db, retrieve_chunks
from backend.core.vector_store import get_chroma_client


def prepare_test_pdf():
    test_pdf = Path("test_doc.pdf")
    if test_pdf.exists():
        print(f"Using existing {test_pdf}")
        return

    # Check if test_doc.pdf is in the backend directory
    backend_pdf = Path("backend/test_doc.pdf")
    if backend_pdf.exists():
        shutil.copy(backend_pdf, test_pdf)
        print(f"Copied {backend_pdf} to {test_pdf}")
        return

    # Check local document directories
    possible_dirs = [Path("documents/TCS"), Path("../documents/TCS"), Path("backend/documents/TCS")]
    for d in possible_dirs:
        if d.exists():
            pdfs = list(d.glob("*.pdf"))
            if pdfs:
                # Use the smallest one for speed
                pdfs.sort(key=lambda p: p.stat().st_size)
                shutil.copy(pdfs[0], test_pdf)
                print(f"Copied {pdfs[0]} to {test_pdf}")
                return


    # If no local PDF, download a sample
    print("No local PDF found. Downloading a sample Reliance financial PDF...")
    url = "https://www.rfil.co.in/pdf/financial/reliance-financial-2023.pdf"  # Fallback sample URL
    try:
        urllib.request.urlretrieve(url, test_pdf)
        print(f"Downloaded sample to {test_pdf}")
    except Exception as e:
        print(f"Download failed: {e}")
        # Try a simpler, reliable PDF if the above fails
        simple_url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        urllib.request.urlretrieve(simple_url, test_pdf)
        print(f"Downloaded dummy PDF to {test_pdf}")

async def run_milestone5_test():
    # 1. Prepare PDF
    prepare_test_pdf()

    # 2. Extract PDF
    result = extract_pdf("test_doc.pdf")
    print(f"Pages extracted: {len(result['pages'])}")
    print(f"Tables found: {len(result['tables'])}")

    # 3. Chunk Document
    chunks = chunk_document(result["pages"], "QUARTERLY_RESULTS")
    print(f"Chunks created: {len(chunks)}")

    # 4. Clean up any existing Chroma collection for TCS to ensure clean test
    client = get_chroma_client()
    try:
        client.delete_collection("stockiq_tcs")
        print("Cleared existing stockiq_tcs collection")
    except Exception:
        pass

    # 5. Store chunks in Vector DB
    stored = await store_chunks_in_vector_db(
        ticker="TCS",
        document_id=1,
        document_type="QUARTERLY_RESULTS",
        fiscal_year=2024,
        chunks=chunks
    )
    print(f"Stored {stored} chunks in ChromaDB")

    # 6. Retrieve and verify
    query = "revenue growth and EBITDA margin trends"
    print(f"Retrieving chunks for query: '{query}'")
    results = await retrieve_chunks(
        ticker="TCS",
        query=query,
        n_results=5
    )

    print(f"Retrieved {len(results)} chunks")
    high_relevance_count = 0
    for i, r in enumerate(results):
        score = r['relevance_score']
        section_type = r['metadata']['section_type']
        preview = r['content'][:150].replace('\n', ' ')
        print(f"  {i+1}. Section: {section_type} | Relevance Score: {score:.4f}")
        print(f"     Preview: {preview}...")
        if score > 0.4:
            high_relevance_count += 1

    # 7. Assertions
    assert len(results) >= 3, f"Expected at least 3 retrieved chunks, got {len(results)}"
    assert high_relevance_count >= 3, f"Expected at least 3 chunks with relevance score > 0.4, got {high_relevance_count}"

    print("\nMilestone 5: ALL TESTS PASSED")

if __name__ == "__main__":
    asyncio.run(run_milestone5_test())
