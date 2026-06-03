"""
Company Resolver Engine

Given: ticker string (e.g. "RELIANCE", "TCS", "HDFCBANK")
Returns: {
    "ticker": "RELIANCE",
    "company_name": "Reliance Industries Limited",
    "official_website": "https://www.ril.com",
    "search_confidence": "HIGH" | "MEDIUM" | "LOW"
}

Strategy:
1. Search DuckDuckGo for "{ticker} NSE official website investor relations"
2. Parse top 3 results for likely official domains (skip NSE, BSE, moneycontrol, screener)
3. Validate: fetch the domain, check it's a real company site (has nav, logo, etc.)
4. Fallback: If DDG is rate-limited or fails, search Yahoo Search for the company website.
5. Return the most likely official domain
"""

import httpx
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
import urllib.parse
import re

# Domains to EXCLUDE from results — these are aggregators, not official company sites
EXCLUDED_DOMAINS = {
    "nseindia.com", "bseindia.com", "moneycontrol.com", "screener.in",
    "tickertape.in", "valueresearchonline.com", "economictimes.com",
    "livemint.com", "businessstandard.com", "reuters.com", "bloomberg.com",
    "wikipedia.org", "linkedin.com", "twitter.com", "facebook.com",
    "youtube.com", "investopedia.com", "zerodha.com", "groww.in"
}

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def search_company_website(ticker: str, company_name: str = None) -> dict:
    """Search for official company website using DuckDuckGo HTML, fallback to Yahoo."""
    query = company_name or ticker
    search_queries = [
        f"{query} official website investor relations annual report",
        f"{query} NSE India company official site",
    ]

    # Try DuckDuckGo
    for query_str in search_queries:
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query_str},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
                )
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, "html.parser")
                    results = soup.select(".result__url")

                    for result in results[:5]:
                        url = result.get_text(strip=True)
                        if not url.startswith("http"):
                            url = "https://" + url

                        domain = _extract_domain(url)
                        if domain and domain not in EXCLUDED_DOMAINS:
                            is_valid = await _validate_corporate_website(url)
                            if is_valid:
                                return {
                                    "ticker": ticker,
                                    "company_name": company_name or ticker,
                                    "official_website": f"https://{domain}",
                                    "search_confidence": "HIGH",
                                    "source_query": query_str,
                                    "resolver_source": "duckduckgo"
                                }
        except Exception as e:
            logger.warning(f"DDG Search attempt failed for {ticker}: {e}")

    # Fallback to Yahoo Search
    logger.info(f"DDG rate limited or failed. Falling back to Yahoo Search for {ticker}...")
    for query_str in search_queries:
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(
                    "https://search.yahoo.com/search",
                    params={"p": query_str},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
                )
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, "html.parser")
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        match = re.search(r"/RU=([^/]+)", href)
                        if match:
                            url = urllib.parse.unquote(match.group(1))
                            if "yahoo.com" in url or "yahoo.co" in url:
                                continue
                            domain = _extract_domain(url)
                            if domain and domain not in EXCLUDED_DOMAINS:
                                is_valid = await _validate_corporate_website(url)
                                if is_valid:
                                    return {
                                        "ticker": ticker,
                                        "company_name": company_name or ticker,
                                        "official_website": f"https://{domain}",
                                        "search_confidence": "HIGH",
                                        "source_query": query_str,
                                        "resolver_source": "yahoo"
                                    }
        except Exception as e:
            logger.warning(f"Yahoo Search attempt failed for {ticker}: {e}")

    return {
        "ticker": ticker,
        "company_name": company_name or ticker,
        "official_website": None,
        "search_confidence": "LOW",
        "error": "Could not resolve official website"
    }

def _extract_domain(url: str) -> str | None:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        return domain if "." in domain else None
    except Exception:
        return None

async def _validate_corporate_website(url: str) -> bool:
    """Check if URL returns a real corporate page (not 404, not redirect to aggregator)."""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"}
            )
            return response.status_code in [200, 301, 302, 403, 405, 503]
    except Exception:
        return False
