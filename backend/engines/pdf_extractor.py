"""
PDF Extraction Engine

Given: local PDF path
Returns: {
    "pages": [...],
    "tables": [...],
    "metadata": {...}
}

Uses PyMuPDF for text, pdfplumber for tables.
"""

import fitz  # PyMuPDF
import pdfplumber
from pathlib import Path
from loguru import logger
from dataclasses import dataclass

@dataclass
class ExtractedPage:
    page_number: int
    text: str
    has_table: bool
    headings: list[str]

@dataclass
class ExtractedTable:
    page_number: int
    headers: list[str]
    rows: list[list]
    raw_text: str

def extract_pdf(pdf_path: str) -> dict:
    """Main extraction function. Returns structured content."""
    path = Path(pdf_path)
    if not path.exists():
        return {"error": f"File not found: {pdf_path}", "pages": [], "tables": []}

    result = {
        "path": pdf_path,
        "pages": [],
        "tables": [],
        "total_pages": 0,
        "extraction_status": "ok"
    }

    try:
        # Phase 1: Text extraction with PyMuPDF
        doc = fitz.open(pdf_path)
        result["total_pages"] = len(doc)

        for page_num, page in enumerate(doc, 1):
            text = page.get_text("text")
            headings = _detect_headings(page)

            result["pages"].append(ExtractedPage(
                page_number=page_num,
                text=text.strip(),
                has_table=False,  # Updated in Phase 2
                headings=headings
            ))
        doc.close()

        # Phase 2: Table extraction with pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                if not tables:
                    continue

                # Mark page as having tables
                if page_num <= len(result["pages"]):
                    result["pages"][page_num - 1].has_table = True

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    headers = [str(h or "").strip() for h in table[0]]
                    rows = [[str(cell or "").strip() for cell in row] for row in table[1:]]

                    # Only keep tables that look like financial tables
                    if _is_financial_table(headers, rows):
                        result["tables"].append(ExtractedTable(
                            page_number=page_num,
                            headers=headers,
                            rows=rows,
                            raw_text="\n".join(["|".join(headers)] + ["|".join(r) for r in rows])
                        ))

    except Exception as e:
        logger.error(f"PDF extraction failed for {pdf_path}: {e}")
        result["extraction_status"] = f"error: {str(e)}"

    return result

def _detect_headings(page) -> list[str]:
    """Detect heading text based on font size (larger = heading), bold styling, or key financial keywords."""
    import re
    blocks = page.get_text("dict")["blocks"]
    headings = []
    
    # Calculate average font size dynamically to adapt to different documents
    sizes = []
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                sizes.append(span.get("size", 0))
    
    avg_size = sum(sizes) / len(sizes) if sizes else 11.0
    if avg_size < 8.0:
        avg_size = 8.0

    # Patterns for key section headers to verify
    financial_sections = [
        "balance sheet", "statement of cash flows", "segment revenue",
        "segment performance", "cash flow statement", "profit & loss",
        "profit and loss", "income statement", "notes to accounts",
        "notes to financial accounts", "business overview", "risk factors",
        "corporate governance", "chairman's letter", "chairperson's letter"
    ]

    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if len(line_text) < 4:
                continue
            
            is_heading = False
            for span in line.get("spans", []):
                span_size = span.get("size", 0)
                span_font = span.get("font", "").lower()
                span_flags = span.get("flags", 0)
                
                # Condition 1: Font size is larger than average
                if span_size > avg_size * 1.25:
                    is_heading = True
                    break
                # Condition 2: Bold font
                if "bold" in span_font or (span_flags & 16):
                    if len(line_text) < 100:
                        is_heading = True
                        break
            
            # Condition 3: Check if the text matches key financial headings
            if not is_heading:
                line_lower = line_text.lower()
                if len(line_text) < 80 and any(sect in line_lower for sect in financial_sections):
                    is_heading = True
            
            if is_heading:
                if line_text not in headings:
                    headings.append(line_text)

    return headings[:10]

def _is_financial_table(headers: list, rows: list) -> bool:
    """Check if a table contains financial data worth keeping."""
    combined = " ".join(headers).lower()
    financial_keywords = [
        "revenue", "income", "profit", "loss", "ebitda", "ebit",
        "assets", "liabilities", "equity", "cash", "crore", "lakhs",
        "₹", "rs.", "amount", "quarter", "year", "fy"
    ]
    return any(kw in combined for kw in financial_keywords)
