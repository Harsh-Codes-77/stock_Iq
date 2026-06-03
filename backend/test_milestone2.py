# backend/test_milestone2.py
import asyncio
from engines.company_resolver import search_company_website
from engines.ir_discovery import discover_ir_page

async def test():
    # Test 1: Company Resolver
    result = await search_company_website("TCS", "Tata Consultancy Services")
    print("Company Resolver:", result)
    assert result["official_website"] is not None, "Should find TCS website"

    # Test 2: IR Discovery (use a known IR page)
    ir = await discover_ir_page("https://www.tcs.com")
    print("IR Discovery:", ir["ir_page_url"], "| Links found:", len(ir["document_links"]))
    assert ir["ir_found"], "Should find TCS IR page"

if __name__ == "__main__":
    asyncio.run(test())
