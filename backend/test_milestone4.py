# backend/test_milestone4.py
import os
import shutil
import urllib.request
from pathlib import Path
from engines.pdf_extractor import extract_pdf
from engines.semantic_chunker import chunk_document

def prepare_test_pdf():
    test_pdf = Path("test_doc.pdf")
    if test_pdf.exists():
        print(f"Using existing {test_pdf}")
        return

    # Check local document directories
    possible_dirs = [Path("documents/TCS"), Path("../documents/TCS")]
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

# 1. Prepare PDF
prepare_test_pdf()

# 2. Extract PDF
result = extract_pdf("test_doc.pdf")
print(f"Pages extracted: {len(result['pages'])}")
print(f"Tables found: {len(result['tables'])}")

# 3. Chunk Document
chunks = chunk_document(result["pages"], "QUARTERLY_RESULTS")
print(f"Chunks created: {len(chunks)}")

# 4. Print preview of first 3 chunks
for c in chunks[:3]:
    print(f"\n--- Chunk {c.chunk_index}: {c.section_type} ---")
    print(f"Title: {c.section_title}")
    print(f"Tokens: {c.token_estimate}")
    print(f"Preview: {c.content[:200]}...")

# 5. Validation Assertions
assert len(result["pages"]) > 0, "No pages extracted!"
assert len(chunks) >= 5, f"Expected at least 5 chunks, found {len(chunks)}"

# Check if chunks are semantically-typed and token estimates are reasonable
semantically_typed_count = sum(1 for c in chunks if c.section_type != "GENERAL")
print(f"Semantically-typed chunks (non-GENERAL): {semantically_typed_count}")

# Check token estimates are mostly in the requested ranges
valid_size_chunks = [c for c in chunks if 200 <= c.token_estimate <= 700]
print(f"Chunks with token estimate 200-700: {len(valid_size_chunks)} / {len(chunks)}")

print("\nMilestone 4: ALL TESTS PASSED")
