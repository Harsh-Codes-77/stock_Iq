"""
Document Crawler Engine

Given: ir_page_url + list of document_links (from IR Discovery)
Does:
  1. Filters links to high-priority document types
  2. Downloads PDFs to local storage (./documents/{ticker}/)
  3. Stores metadata in PostgreSQL documents table
  4. Returns list of saved document records
"""

import asyncio
import hashlib
import os
import re
from pathlib import Path
import httpx
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from ..core.database import AsyncSessionLocal
from ..models.document import DocumentRecord
from .document_classifier import classify_document, extract_fiscal_period
from ..core.config import settings

DOCUMENTS_DIR = Path("./documents")
DOCUMENTS_DIR.mkdir(exist_ok=True)

# Priority order for processing — process these first
PRIORITY_ORDER = [
    "ANNUAL_REPORT", "QUARTERLY_RESULTS", "CONCALL_TRANSCRIPT",
    "INVESTOR_PRESENTATION", "ANALYST_MEET", "CREDIT_RATING_REPORT",
    "ESG_REPORT", "SHAREHOLDING_REPORT", "AGM_PRESENTATION",
    "CAPEX_UPDATE", "PRESS_RELEASE", "BUSINESS_UPDATE", "UNKNOWN"
]

async def crawl_and_store_documents(
    ticker: str,
    company_id: int,
    document_links: list[dict],
    max_documents: int = None
) -> list[dict]:
    """
    Download and store document metadata.
    Only downloads PDFs — skips HTML pages.
    Caps at max_documents to avoid scraping too much.
    """
    max_docs = max_documents or settings.MAX_DOCUMENTS_PER_COMPANY
    ticker_dir = DOCUMENTS_DIR / ticker.upper()
    ticker_dir.mkdir(exist_ok=True)

    # Classify all links first
    classified = []
    for link in document_links:
        doc_type = classify_document(link["url"], link.get("text", ""))
        period = extract_fiscal_period(link.get("text", "") + " " + link["url"])
        classified.append({
            **link,
            "document_type": doc_type,
            **period
        })

    # Sort by priority
    classified.sort(key=lambda x: _priority_score(x["document_type"]))

    # Download top N documents
    saved_documents = []
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        download_count = 0
        for doc in classified:
            if download_count >= max_docs:
                break
            if not doc.get("is_pdf", False) and not doc["url"].lower().endswith(".pdf"):
                continue

            try:
                result = await _download_document(
                    client, doc, ticker, company_id, ticker_dir
                )
                if result:
                    saved_documents.append(result)
                    download_count += 1
                    await asyncio.sleep(0.5)  # Polite crawl delay
            except Exception as e:
                logger.warning(f"Failed to download {doc['url']}: {e}")

    return saved_documents

async def _download_document(
    client: httpx.AsyncClient,
    doc: dict,
    ticker: str,
    company_id: int,
    save_dir: Path
) -> dict | None:
    """Download a single PDF and save to disk."""
    url = doc["url"]

    # Generate stable filename from URL hash
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    safe_title = re.sub(r'[^\w\-_.]', '_', doc.get("text", "doc"))[:50]
    filename = f"{doc['document_type']}_{safe_title}_{url_hash}.pdf"
    local_path = save_dir / filename

    # Skip if already downloaded
    if local_path.exists():
        return {
            "ticker": ticker,
            "company_id": company_id,
            "document_type": doc["document_type"],
            "title": doc.get("text"),
            "source_url": url,
            "local_path": str(local_path),
            "fiscal_year": str(doc.get("fiscal_year")) if doc.get("fiscal_year") else None,
            "fiscal_quarter": doc.get("fiscal_quarter"),
            "already_existed": True
        }

    response_content = None
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        headers = {
            "Host": parsed.netloc,
            "Connection": "keep-alive",
            "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-User": "?1",
            "Sec-Fetch-Dest": "document",
            "Accept-Language": "en-US,en;q=0.9",
        }
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            response_content = response.content
        else:
            logger.warning(f"Download failed for {url} via HTTP client: status {response.status_code}. Retrying with Playwright...")
    except Exception as e:
        logger.warning(f"Download failed for {url} via HTTP client: {e}. Retrying with Playwright...")

    if not response_content or not response_content.startswith(b'%PDF'):
        success = await _download_with_playwright(url, local_path)
        if not success:
            return None
        file_size = local_path.stat().st_size
    else:
        with open(local_path, "wb") as f:
            f.write(response_content)
        file_size = len(response_content)

    record = {
        "ticker": ticker,
        "company_id": company_id,
        "document_type": doc["document_type"],
        "title": doc.get("text"),
        "source_url": url,
        "local_path": str(local_path),
        "fiscal_year": str(doc.get("fiscal_year")) if doc.get("fiscal_year") else None,
        "fiscal_quarter": doc.get("fiscal_quarter"),
        "file_size_bytes": file_size,
    }

    # Store in PostgreSQL
    await _save_document_record(record)
    return record

async def _download_with_playwright(url: str, local_path: Path) -> bool:
    """Download a document using Playwright page navigation to bypass WAF."""
    from playwright.async_api import async_playwright
    from urllib.parse import urlparse
    logger.info(f"Downloading with Playwright: {url}")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = await context.new_page()
            
            # First, visit base domain to establish cookies and bypass basic anti-bot
            try:
                parsed_url = urlparse(url)
                base_domain_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
                logger.info(f"Establishing session cookies at base domain: {base_domain_url}")
                await page.goto(base_domain_url, timeout=20000, wait_until="domcontentloaded")
                await asyncio.sleep(1.0)
            except Exception as e:
                logger.warning(f"Could not load base domain to establish cookies: {e}")
                
            # Now navigate to the PDF URL
            logger.info(f"Navigating to PDF: {url}")
            response = await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            if response and response.status == 200:
                content = await response.body()
                if content.startswith(b'%PDF'):
                    with open(local_path, "wb") as f:
                        f.write(content)
                    await browser.close()
                    logger.info(f"Successfully downloaded via Playwright: {url}")
                    return True
                else:
                    logger.warning(f"Playwright download received non-PDF content starting with: {content[:50]}")
            else:
                status = response.status if response else "No Response"
                logger.warning(f"Playwright download failed: status {status}")
            await browser.close()
    except Exception as e:
        logger.warning(f"Playwright download exception: {e}")
    return False

async def _save_document_record(record: dict):
    async with AsyncSessionLocal() as db:
        await db.execute(
            insert(DocumentRecord).values(**record).on_conflict_do_nothing()
        )
        await db.commit()

def _priority_score(doc_type: str) -> int:
    try:
        return PRIORITY_ORDER.index(doc_type)
    except ValueError:
        return len(PRIORITY_ORDER)
