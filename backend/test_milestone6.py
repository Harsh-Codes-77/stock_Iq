import asyncio
from sqlalchemy import select, delete
from backend.core.database import AsyncSessionLocal
from backend.models.document import DocumentRecord
from backend.models.financials import FinancialRecord
from backend.engines.financial_extractor import process_document_financials

async def main():
    print("Starting Milestone 6 Verification Test...")

    # 1. Clean up any existing financials in database to ensure clean test
    async with AsyncSessionLocal() as db:
        await db.execute(delete(FinancialRecord).where(FinancialRecord.ticker == "TCS"))
        await db.commit()
        print("Cleared existing TCS financials records from database.")

    # 2. Get all document records for TCS
    async with AsyncSessionLocal() as db:
        q = select(DocumentRecord).where(DocumentRecord.ticker == "TCS").order_by(DocumentRecord.id)
        res = await db.execute(q)
        documents = res.scalars().all()
        print(f"Found {len(documents)} TCS documents in database.")
        for d in documents:
            print(f" - ID: {d.id} | Type: {d.document_type} | Path: {d.local_path}")

    if not documents:
        print("ERROR: No TCS documents found in database. Please run test_milestone3.py first.")
        return

    # 3. Run the extraction pipeline on each document
    # We run them one by one
    for doc in documents:
        print(f"\nProcessing Document ID {doc.id} ({doc.document_type})...")
        async with AsyncSessionLocal() as db:
            upserted = await process_document_financials(doc.id, db)
            print(f"Processed Document ID {doc.id}. Upserted {upserted} periods.")

    # 4. Verification Check: Check database entries
    print("\n--- Verifying Database Financial Records ---")
    async with AsyncSessionLocal() as db:
        q = select(FinancialRecord).where(FinancialRecord.ticker == "TCS").order_by(
            FinancialRecord.period_type,
            FinancialRecord.fiscal_year,
            FinancialRecord.fiscal_quarter
        )
        res = await db.execute(q)
        records = res.scalars().all()
        
        annual_records = [r for r in records if r.period_type == "annual"]
        quarterly_records = [r for r in records if r.period_type == "quarterly"]

        print(f"Total annual records found: {len(annual_records)}")
        for idx, r in enumerate(annual_records):
            print(f"  [{idx+1}] FY {r.fiscal_year}: Revenue={r.revenue} Cr, EBITDA={r.ebitda} Cr, PAT={r.pat} Cr, CFO={r.cfo} Cr, Source={r.data_source}")
            
        print(f"Total quarterly records found: {len(quarterly_records)}")
        for idx, r in enumerate(quarterly_records):
            print(f"  [{idx+1}] FY {r.fiscal_year} {r.fiscal_quarter}: Revenue={r.revenue} Cr, EBITDA={r.ebitda} Cr, PAT={r.pat} Cr, Source={r.data_source}")

        # Assertions
        print("\nChecking assertions...")
        assert len(records) > 0, "No financial records created in database."
        
        # Verify no 0 values are stored - should be None (NULL) instead
        for r in records:
            for field in ["revenue", "ebitda", "pat", "cfo", "capex"]:
                val = getattr(r, field)
                assert val != 0, f"Error: stored 0 instead of NULL for {field} in FY {r.fiscal_year} {r.fiscal_quarter or ''}"

        # Verify revenue validation (revenue must be > 0)
        for r in records:
            if r.revenue is not None:
                assert r.revenue > 0, f"Error: revenue must be > 0, got {r.revenue} for FY {r.fiscal_year}"

        print("\nAll assertions PASSED successfully!")

if __name__ == "__main__":
    asyncio.run(main())
