# backend/test_milestone3.py
import asyncio
import os
from pathlib import Path
from sqlalchemy import select, insert, delete
from backend.core.database import AsyncSessionLocal
from backend.models.company import CompanyRecord
from backend.models.document import DocumentRecord
from backend.engines.document_classifier import classify_document, extract_fiscal_period
from backend.engines.company_resolver import search_company_website
from backend.engines.ir_discovery import discover_ir_page
from backend.engines.document_crawler import crawl_and_store_documents

def test_classifier():
    # Test classification
    assert classify_document("annual-report-fy2024.pdf", "Annual Report 2024") == "ANNUAL_REPORT"
    assert classify_document("q2fy24-results.pdf", "Q2 FY24 Financial Results") == "QUARTERLY_RESULTS"
    assert classify_document("concall-transcript-q1.pdf", "Q1 Earnings Call Transcript") == "CONCALL_TRANSCRIPT"
    assert classify_document("investor-presentation-2024.pdf", "Investor Presentation") == "INVESTOR_PRESENTATION"
    print("Classifier: ALL TESTS PASSED")

    # Test period extraction
    period = extract_fiscal_period("Q2 FY24 Results")
    assert period["fiscal_quarter"] == "Q2"
    assert period["fiscal_year"] == 2024
    print("Period Extractor: ALL TESTS PASSED")

async def test_crawler_integration():
    print("Starting crawler integration test against TCS...")

    # Clean up local directory for TCS to make the test idempotent
    import shutil
    tcs_dir = Path("./documents/TCS")
    if tcs_dir.exists():
        shutil.rmtree(tcs_dir)
        print("Cleaned up existing local documents/TCS directory.")

    # Clean up DB records for TCS documents
    async with AsyncSessionLocal() as db:
        await db.execute(delete(DocumentRecord).where(DocumentRecord.ticker == "TCS"))
        await db.commit()
        print("Cleaned up database records for TCS documents.")

    # 1. Resolve company website & discover IR page links
    resolver_res = await search_company_website("TCS", "Tata Consultancy Services")
    print(f"Company Resolver result: {resolver_res}")
    assert resolver_res["official_website"] is not None, "Failed to resolve website"

    ir_res = await discover_ir_page(resolver_res["official_website"])
    links = ir_res["document_links"]
    print(f"IR page URL: {ir_res['ir_page_url']} | Links found: {len(links)}")
    assert len(links) > 0, "No document links found"
    print("Sample Links:")
    for link in links[:5]:
        print(f" - {link}")

    # 2. Get or create company record in PostgreSQL database to satisfy foreign keys
    company_id = None
    async with AsyncSessionLocal() as db:
        # Check if TCS already exists
        q = select(CompanyRecord).where(CompanyRecord.ticker == "TCS")
        res = await db.execute(q)
        company = res.scalar_one_or_none()

        if company:
            company_id = company.id
            print(f"Found existing TCS company record with ID: {company_id}")
        else:
            print("TCS company record not found. Inserting...")
            new_company = CompanyRecord(
                ticker="TCS",
                company_name="Tata Consultancy Services",
                official_website=resolver_res["official_website"],
                ir_page_url=ir_res["ir_page_url"],
                crawl_status="pending"
            )
            db.add(new_company)
            await db.commit()
            await db.refresh(new_company)
            company_id = new_company.id
            print(f"Inserted TCS company record with ID: {company_id}")

    # 3. Run crawler to download documents
    # Limit max_documents to 5 to keep the test fast
    saved_docs = await crawl_and_store_documents(
        ticker="TCS",
        company_id=company_id,
        document_links=links,
        max_documents=5
    )

    print(f"Crawler processed and stored {len(saved_docs)} documents.")

    # 4. Verification Check: Check local directory
    tcs_dir = Path("./documents/TCS")
    assert tcs_dir.exists(), "Local directory ./documents/TCS does not exist"
    local_files = list(tcs_dir.glob("*.pdf"))
    print(f"Downloaded files in {tcs_dir}: {len(local_files)}")
    for f in local_files:
        print(f" - {f.name} (Size: {f.stat().st_size} bytes)")

    assert len(local_files) >= 3, f"Expected at least 3 files downloaded, found {len(local_files)}"

    # 5. Verification Check: Check database entries
    async with AsyncSessionLocal() as db:
        q = select(DocumentRecord).where(DocumentRecord.ticker == "TCS")
        res = await db.execute(q)
        db_docs = res.scalars().all()
        print(f"Database records found for TCS documents: {len(db_docs)}")
        for doc in db_docs:
            print(f" - ID: {doc.id} | Type: {doc.document_type} | Year: {doc.fiscal_year} | Quarter: {doc.fiscal_quarter} | Path: {doc.local_path}")
        assert len(db_docs) >= 3, f"Expected at least 3 document database records, found {len(db_docs)}"

    print("Crawler Integration Test: ALL TESTS PASSED")

if __name__ == "__main__":
    test_classifier()
    asyncio.run(test_crawler_integration())
