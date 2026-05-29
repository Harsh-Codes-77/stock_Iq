"""
IR Discovery Engine

Given: official_website (e.g. "https://www.ril.com")
Returns: {
    "ir_page_url": "https://www.ril.com/investors",
    "document_links": [...],
    "ir_found": True
}

Strategy:
1. Try 12 known IR path patterns
2. If none work, use Playwright to load homepage and look for IR nav links
3. From the IR page, extract all PDF links and categorize them
4. Fallback: Search DuckDuckGo/Yahoo Search directly for PDF links if WAF blocks crawler access.
"""

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from loguru import logger
from urllib.parse import urljoin, urlparse
import urllib.parse
import httpx
import re

# Common IR page paths — try in order
IR_PATH_PATTERNS = [
    "/investors", "/investor-relations", "/investor_relations",
    "/financial-results", "/financials", "/annual-report",
    "/investor", "/results", "/shareholders", "/ir",
    "/corporate/investors", "/about/investors",
]

# Nav link text that indicates an IR section
IR_NAV_KEYWORDS = [
    "investor", "investors", "investor relations", "financials",
    "annual report", "quarterly results", "shareholder", "ir"
]

async def discover_ir_page(official_website: str) -> dict:
    """Find the IR page URL and all document links on it."""
    base = official_website.rstrip("/")
    parsed_url = urlparse(official_website)
    domain = parsed_url.netloc.replace("www.", "")

    # Step 1: Try known path patterns with simple HTTP
    for path in IR_PATH_PATTERNS:
        url = base + path
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    url, 
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
                )
                if resp.status_code == 200 and _looks_like_ir_page(resp.text):
                    links = _extract_document_links(resp.text, url)
                    if len(links) >= 5:
                        return {
                            "ir_page_url": url,
                            "document_links": links,
                            "ir_found": True,
                            "discovery_method": "path_pattern"
                        }
        except Exception:
            continue

    # Step 2: Use Playwright to find IR link in navigation
    ir_url = None
    try:
        ir_url = await _find_ir_via_playwright(base)
        if ir_url:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    ir_url, 
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
                )
                if resp.status_code == 200:
                    links = _extract_document_links(resp.text, ir_url)
                    if len(links) >= 5:
                        return {
                            "ir_page_url": ir_url,
                            "document_links": links,
                            "ir_found": True,
                            "discovery_method": "nav_scrape"
                        }
    except Exception as e:
        logger.warning(f"Playwright IR discovery failed: {e}")

    # Step 3: Fallback - Search DuckDuckGo / Yahoo for the IR page directly
    if not ir_url:
        try:
            ir_url = await _search_ddg_for_ir_page(domain)
            if not ir_url:
                ir_url = await _search_yahoo_for_ir_page(domain)
        except Exception as e:
            logger.warning(f"IR page search failed: {e}")

    # Fallback to searching search engines for PDFs directly from that domain
    try:
        logger.info(f"Falling back to Search Engine PDF extraction for domain: {domain}")
        pdf_links = await _search_ddg_for_pdfs(domain)
        if len(pdf_links) < 5:
            # Fallback to Yahoo Search if DDG yielded fewer than 5 links
            logger.info("DDG returned fewer than 5 PDF links. Trying Yahoo Search...")
            yahoo_pdf_links = await _search_yahoo_for_pdfs(domain)
            # Combine results, ensuring unique URLs
            seen_urls = {link["url"] for link in pdf_links}
            for link in yahoo_pdf_links:
                if link["url"] not in seen_urls:
                    pdf_links.append(link)
                    seen_urls.add(link["url"])
                    
        if len(pdf_links) > 0:
            return {
                "ir_page_url": ir_url or f"https://{domain}/investors",
                "document_links": pdf_links,
                "ir_found": True,
                "discovery_method": "search_engine_pdf"
            }
    except Exception as e:
        logger.warning(f"Search Engine PDF extraction failed: {e}")

    # Ultimate fallback if we found the URL but got absolutely 0 links
    if ir_url:
        return {
            "ir_page_url": ir_url,
            "document_links": [],
            "ir_found": True,
            "discovery_method": "url_only"
        }

    return {
        "ir_page_url": None,
        "document_links": [],
        "ir_found": False,
        "error": "Could not find IR page or document links"
    }

def _looks_like_ir_page(html: str) -> bool:
    """Heuristic: does this page contain IR-related content?"""
    text = html.lower()
    ir_signals = ["annual report", "quarterly results", "investor", "pdf", "financial"]
    return sum(1 for s in ir_signals if s in text) >= 3

def _extract_document_links(html: str, base_url: str) -> list[dict]:
    """Extract all PDF and document links from a page."""
    soup = BeautifulSoup(html, "html.parser")
    documents = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)

        # Only interested in PDF links or links that look like documents
        if not href or (not href.lower().endswith(".pdf") and not _text_suggests_document(text)):
            continue

        full_url = urljoin(base_url, href)
        documents.append({
            "url": full_url,
            "text": text,
            "is_pdf": href.lower().endswith(".pdf")
        })

    return documents[:100]  # Cap at 100 links per page

def _text_suggests_document(text: str) -> bool:
    text_lower = text.lower()
    document_keywords = [
        "annual report", "quarterly", "q1", "q2", "q3", "q4",
        "concall", "transcript", "investor presentation", "earnings",
        "financial result", "agm", "analyst meet"
    ]
    return any(kw in text_lower for kw in document_keywords)

async def _find_ir_via_playwright(base_url: str) -> str | None:
    """Use Playwright to find IR link in site navigation."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            })
            await page.goto(base_url, timeout=20000, wait_until="domcontentloaded")

            links = await page.query_selector_all("a")
            for link in links:
                text = (await link.inner_text()).lower().strip()
                href = await link.get_attribute("href") or ""

                if any(kw in text for kw in IR_NAV_KEYWORDS):
                    full_url = urljoin(base_url, href)
                    return full_url

        except Exception as e:
            logger.warning(f"Playwright navigation failed: {e}")
        finally:
            await browser.close()

    return None

async def _search_ddg_for_ir_page(domain: str) -> str | None:
    """Search DuckDuckGo to discover the exact IR page URL."""
    query = f"site:{domain} investor relations"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                results = soup.select(".result__url")
                for r in results[:3]:
                    url = r.get_text(strip=True)
                    if not url.startswith("http"):
                        url = "https://" + url
                    if "investor" in url.lower() or "ir" in url.lower():
                        return url
    except Exception as e:
        logger.warning(f"Error in _search_ddg_for_ir_page: {e}")
    return None

async def _search_yahoo_for_ir_page(domain: str) -> str | None:
    """Search Yahoo Search to discover the exact IR page URL."""
    query = f"site:{domain} investor relations"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://search.yahoo.com/search",
                params={"p": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    match = re.search(r"/RU=([^/]+)", href)
                    if match:
                        actual_url = urllib.parse.unquote(match.group(1))
                        parsed_actual = urlparse(actual_url)
                        if domain in parsed_actual.netloc and ("investor" in actual_url.lower() or "ir" in actual_url.lower()):
                            return actual_url
    except Exception as e:
        logger.warning(f"Yahoo IR page search failed: {e}")
    return None

async def _search_ddg_for_pdfs(domain: str) -> list[dict]:
    """Search DuckDuckGo to extract PDF documents directly."""
    query = f"site:{domain} filetype:pdf (annual OR report OR financial OR results OR presentation)"
    pdf_links = []
    seen_urls = set()

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                result_blocks = soup.select(".result__body")
                
                for block in result_blocks:
                    url_el = block.select_one(".result__url")
                    title_el = block.select_one(".result__title")
                    
                    if not url_el:
                        continue
                        
                    url = url_el.get_text(strip=True)
                    if not url.startswith("http"):
                        url = "https://" + url
                        
                    if url in seen_urls:
                        continue
                        
                    text = title_el.get_text(strip=True) if title_el else "PDF Document"
                    
                    seen_urls.add(url)
                    pdf_links.append({
                        "url": url,
                        "text": text,
                        "is_pdf": True
                    })
    except Exception as e:
        logger.warning(f"Error in _search_ddg_for_pdfs: {e}")
            
    return pdf_links[:100]

async def _search_yahoo_for_pdfs(domain: str) -> list[dict]:
    """Search Yahoo to extract PDF documents directly."""
    query = f"site:{domain} filetype:pdf (annual OR report OR financial OR results OR presentation)"
    pdf_links = []
    seen_urls = set()
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://search.yahoo.com/search",
                params={"p": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    text = a.get_text(strip=True)
                    match = re.search(r"/RU=([^/]+)", href)
                    if match:
                        actual_url = urllib.parse.unquote(match.group(1))
                        parsed_actual = urlparse(actual_url)
                        if domain in parsed_actual.netloc and actual_url not in seen_urls:
                            clean_text = text.split("https://")[0].strip() if "https://" in text else text
                            seen_urls.add(actual_url)
                            pdf_links.append({
                                "url": actual_url,
                                "text": clean_text or "PDF Document",
                                "is_pdf": True
                            })
    except Exception as e:
        logger.warning(f"Yahoo PDF search failed: {e}")
    return pdf_links
