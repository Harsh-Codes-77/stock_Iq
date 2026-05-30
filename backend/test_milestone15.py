import asyncio
import os
import sys

# Set up python path for easy importing
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.core.cache import cache_set, cache_get
from backend.engines.report_orchestrator import generate_full_report
from backend.api.export import export_pdf

async def test_pdf_generation():
    print("=== Running Milestone 15 WeasyPrint PDF Export Test ===")
    
    ticker = "TCS"
    cache_key = f"report:{ticker}"
    
    # 1. Fetch cached report or generate a new one
    print(f"Checking cache or generating report for {ticker}...")
    report = await cache_get(cache_key)
    if not report:
        print("Report not found in cache. Running orchestrator...")
        report = await generate_full_report(ticker)
        await cache_set(cache_key, report)
        print("Report generated and cached.")
    else:
        print("Report retrieved from cache.")
        
    # 2. Call PDF export endpoint logic
    print("Invoking export_pdf response stream...")
    try:
        response = await export_pdf(ticker)
        
        # Read streaming response body
        pdf_bytes = b""
        async for chunk in response.body_iterator:
            pdf_bytes += chunk
            
        print(f"PDF bytes generated: {len(pdf_bytes)} bytes")
        
        # Write to local file to inspect it
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_export.pdf")
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
            
        print(f"Successfully wrote PDF to {output_path}")
        assert len(pdf_bytes) > 10000, "PDF file seems too small (less than 10KB)"
        print("Milestone 15 PDF Export Test: ALL CHECKS PASSED SUCCESSFULLY!")
        
    except Exception as e:
        print(f"ERROR: PDF export test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_pdf_generation())
