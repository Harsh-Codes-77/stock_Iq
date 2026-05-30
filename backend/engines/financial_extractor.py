import asyncio
import json
import re
import fitz  # PyMuPDF
import pdfplumber
import google.generativeai as genai
from pathlib import Path
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from sqlalchemy import select, insert, update
from backend.core.config import settings
from backend.models.document import DocumentRecord
from backend.models.financials import FinancialRecord
from backend.engines.pdf_extractor import _detect_headings, _is_financial_table, ExtractedPage, ExtractedTable
from backend.engines.semantic_chunker import chunk_document

genai.configure(api_key=settings.GEMINI_API_KEY)

METRIC_KEYS = [
    "revenue", "ebitda", "ebit", "pat", "cfo", "capex", "free_cash_flow",
    "total_debt", "total_equity", "total_assets", "current_assets",
    "current_liabilities", "trade_receivables", "inventory", "trade_payables",
    "retained_earnings", "depreciation", "interest_expense", "tax_expense",
    "shares_outstanding"
]

def get_pref_weight(doc_type: str) -> int:
    """Get document preference weight. Annual Report > Quarterly Results > Investor Presentation."""
    if doc_type == "ANNUAL_REPORT":
        return 3
    elif doc_type == "QUARTERLY_RESULTS":
        return 2
    elif doc_type == "INVESTOR_PRESENTATION":
        return 1
    return 0

def clean_and_parse_number(val_str: str, multiplier: float) -> float | None:
    """Clean and parse a string representing a number into a normalized float (₹ Crore)."""
    if not val_str:
        return None
    val_str = val_str.strip()
    if val_str in ("-", "", "nil", "null", "none"):
        return None
    
    # Remove commas, currency symbols, and spaces
    cleaned = val_str.replace(",", "").replace(" ", "").replace("₹", "").replace("Rs.", "").replace("Rs", "")
    
    # Handle brackets for negative values, e.g. (1,234) -> -1234
    is_negative = False
    if (cleaned.startswith("(") and cleaned.endswith(")")) or cleaned.startswith("-"):
        is_negative = True
        cleaned = cleaned.strip("()-")
        
    try:
        val = float(cleaned)
        if is_negative:
            val = -val
        return val * multiplier
    except ValueError:
        return None

def normalize_text_for_search(text: str) -> str:
    """Normalize text by removing all whitespace and lowercasing."""
    return "".join(text.split()).lower()

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=60), reraise=True)
async def extract_financials_from_doc_data(
    doc_text: str,
    tables_formatted: str,
    document_type: str
) -> dict:
    """Call Gemini to map table rows and columns to financial metrics and periods."""
    prompt = f"""
You are an expert financial analyst. Your task is to extract structured financial data from the provided page text and structured tables of a financial document.

--- PAGE RAW TEXT ---
{doc_text}

--- EXTRACTED TABLES ---
{tables_formatted}

--- INSTRUCTIONS ---
1. Identify the unit/scale of the numbers. If numbers are in "Crores" (or ₹ Crore), unit_multiplier is 1.0. If "Lakhs", multiplier is 0.01. If "Millions", multiplier is 0.1. If "Billions", multiplier is 10.0. If absolute Rupees, multiplier is 0.0000001 (1e-7). If not specified or not applicable, default to 1.0.
2. Identify all unique periods (years and quarters) represented in the tables. For each period, determine the period_type ('annual' or 'quarterly'), the fiscal_year (integer, e.g. 2025), and the fiscal_quarter (e.g. 'Q1', 'Q2', 'Q3', 'Q4' or null if annual).
3. For each of the target financial metrics listed below, extract the EXACT string representation of the numbers for each of the identified periods in the same order as the periods list. Find the values in the relevant tables (for example, annual numbers in the annual or trend tables, and quarterly numbers in the quarterly tables).
   Allowed metric keys:
   - revenue (Revenue from operations / Turnover / Total revenue / Total income)
   - ebitda (EBITDA / Operating Profit / Operating EBITDA. If not explicitly present in the table, calculate/derive it as 'Total revenue from operations' minus 'Total cost (excluding interest & depreciation)' [or 'Employee cost' + 'Other operating cost'], and output the calculated number)
   - ebit (EBIT / Operating profit after depreciation / Profit before interest and tax)
   - pat (Profit After Tax / Net Profit / Profit for the period / Profit for the year)
   - cfo (Cash Flow from Operating Activities / Net cash generated from operating activities)
   - capex (Capital Expenditure / Purchase of property, plant and equipment / Purchase of fixed assets)
   - free_cash_flow (Free Cash Flow)
   - total_debt (Total Debt / Borrowings / Long-term + Short-term borrowings)
   - total_equity (Total Equity / Shareholder's Equity / Net Worth / Equity Share Capital + Other Equity)
   - total_assets (Total Assets)
   - current_assets (Total Current Assets)
   - current_liabilities (Total Current Liabilities)
   - trade_receivables (Trade Receivables / Sundry Debtors)
   - inventory (Inventories)
   - trade_payables (Trade Payables / Sundry Creditors)
   - retained_earnings (Retained Earnings / Other Equity)
   - depreciation (Depreciation & Amortisation)
   - interest_expense (Finance Costs / Interest Expense)
   - tax_expense (Tax Expense / Total Tax / Current tax + Deferred tax)
   - shares_outstanding (Number of shares outstanding / Share Capital face value)

4. CRITICAL: The extracted value strings must be the EXACT substrings from the document text (including commas, brackets for negative values, e.g., "70,698" or "(254)" or "-"). If a metric is not present or has no value for a period, use null.
5. Do NOT perform any math, conversion, or normalization on the value strings (except for calculating ebitda as described in the ebitda metric instructions). Simply extract them as they appear. The value must be a single string representing the exact number from the cell. Do not include multiple values or newlines.

Return a JSON object matching this schema:
{{
  "unit_multiplier": float,
  "periods": [
    {{
      "period_type": "annual" | "quarterly",
      "fiscal_year": int,
      "fiscal_quarter": string | null
    }}
  ],
  "metrics": {{
    "metric_key_1": [string | null, string | null, ...],
    "metric_key_2": [string | null, string | null, ...]
  }}
}}
"""
    model = genai.GenerativeModel("models/gemini-3.1-flash-lite")
    response = await model.generate_content_async(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(response.text)

async def process_document_financials(document_id: int, db_session) -> int:
    """
    Extract financials for a given document and merge them into the database.
    Returns the number of periods upserted.
    """
    # 1. Fetch document record
    q = select(DocumentRecord).where(DocumentRecord.id == document_id)
    res = await db_session.execute(q)
    doc_rec = res.scalar_one_or_none()
    if not doc_rec:
        logger.error(f"Document ID {document_id} not found in database.")
        return 0

    pdf_path = doc_rec.local_path
    path = Path(pdf_path)
    if not path.exists():
        logger.error(f"Document local PDF file not found: {pdf_path}")
        return 0

    logger.info(f"Extracting financials from {pdf_path} (ID: {document_id})...")

    # 2. Extract text and headings using PyMuPDF to find target pages
    doc = fitz.open(pdf_path)
    extracted_pages = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text("text")
        headings = _detect_headings(page)
        extracted_pages.append(ExtractedPage(
            page_number=page_num,
            text=text.strip(),
            has_table=False,
            headings=headings
        ))
    doc.close()

    # 3. Chunk document using semantic chunker to find financial sections
    chunks = chunk_document(extracted_pages, doc_rec.document_type)
    
    target_sections = {"FINANCIAL_STATEMENTS", "BALANCE_SHEET", "PROFIT_AND_LOSS", "CASH_FLOW", "MD_AND_A"}
    chunk_pages = set()
    for chunk in chunks:
        if chunk.section_type in target_sections:
            chunk_pages.update(chunk.source_pages)

    # Filter pages into primary statements and trend pages
    primary_pages = set()
    trend_pages = set()
    
    for page_num in chunk_pages:
        page_index = page_num - 1
        if page_index < len(extracted_pages):
            text_lower = extracted_pages[page_index].text.lower()
            snippet = text_lower[:400]
            
            has_bs = "balance sheet" in snippet
            has_pl = "profit and loss" in snippet or "profit & loss" in snippet or "statement of profit" in snippet
            has_cf = "cash flow" in snippet or "statement of cash" in snippet
            has_qr = doc_rec.document_type == "QUARTERLY_RESULTS" and ("financial results" in snippet or "audited results" in snippet)
            has_trend = "performance trend" in snippet or "decade at a glance" in snippet or "10-year summary" in snippet or "ten-year summary" in snippet or "financial highlights" in snippet
            
            if has_trend:
                trend_pages.add(page_num)
            elif has_bs or has_pl or has_cf or has_qr:
                primary_pages.add(page_num)

    # Proactively check ALL pages for trend pages (bypassing chunker limits)
    for page in extracted_pages:
        text_lower = page.text.lower()
        snippet = text_lower[:400]
        has_trend = "performance trend" in snippet or "decade at a glance" in snippet or "10-year summary" in snippet or "ten-year summary" in snippet or "financial highlights" in snippet
        if has_trend:
            trend_pages.add(page.page_number)
            primary_pages.discard(page.page_number)

    # Fallback to pages with keywords if both are empty
    if not primary_pages and not trend_pages:
        logger.info("No target financial sections filtered. Falling back to keyword search on pages.")
        for page in extracted_pages:
            text_lower = page.text.lower()
            snippet = text_lower[:400]
            has_bs = "balance sheet" in snippet
            has_pl = "profit and loss" in snippet or "profit & loss" in snippet or "statement of profit" in snippet
            has_cf = "cash flow" in snippet or "statement of cash" in snippet
            has_qr = ("financial results" in snippet or "audited results" in snippet)
            has_trend = "performance trend" in snippet or "decade at a glance" in snippet or "10-year summary" in snippet or "ten-year summary" in snippet or "financial highlights" in snippet
            
            if has_trend:
                trend_pages.add(page.page_number)
            elif has_bs or has_pl or has_cf or has_qr:
                primary_pages.add(page.page_number)

    if not primary_pages and not trend_pages:
        logger.warning(f"No financial pages identified in {pdf_path}.")
        return 0

    logger.info(f"Scanning pages: Primary: {sorted(list(primary_pages))}, Trend: {sorted(list(trend_pages))}")

    # Group metrics by period (ticker, year, period_type, quarter)
    periods_data = {}

    async def process_page_set(pages_set: set, label: str):
        if not pages_set:
            return
            
        # Extract tables from target pages using pdfplumber
        extracted_tables = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_num in sorted(list(pages_set)):
                if page_num > len(pdf.pages):
                    continue
                page = pdf.pages[page_num - 1]
                tables = page.extract_tables()
                if not tables:
                    continue
    
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    headers = [str(h or "").strip() for h in table[0]]
                    rows = [[str(cell or "").strip() for cell in row] for row in table[1:]]
                    if _is_financial_table(headers, rows):
                        raw_text = "\n".join(["|".join(headers)] + ["|".join(r) for r in rows])
                        extracted_tables.append(ExtractedTable(
                            page_number=page_num,
                            headers=headers,
                            rows=rows,
                            raw_text=raw_text
                        ))
    
        if not extracted_tables:
            logger.info(f"No financial tables found for {label} pages of document {document_id}")
            return
            
        combined_tables_lines = []
        for idx, table in enumerate(extracted_tables):
            combined_tables_lines.append(f"--- Table {idx} on Page {table.page_number} ---")
            combined_tables_lines.append(f"Headers: {table.headers}")
            for r_idx, row in enumerate(table.rows):
                combined_tables_lines.append(f"Row {r_idx}: {row}")
        combined_tables = "\n".join(combined_tables_lines)
    
        combined_text = "\n\n".join([
            extracted_pages[p_num - 1].text 
            for p_num in sorted(list(pages_set)) 
            if p_num <= len(extracted_pages)
        ])
        
        try:
            data = await extract_financials_from_doc_data(combined_text, combined_tables, doc_rec.document_type)
        except Exception as e:
            logger.error(f"Gemini API table mapping failed for {label} pages of document {document_id}: {e}")
            data = {}
            
        if data and "periods" in data and "metrics" in data:
            multiplier = data.get("unit_multiplier", 1.0)
            periods = data.get("periods", [])
            metrics = data.get("metrics", {})
    
            normalized_doc_text = normalize_text_for_search(combined_text)
            normalized_combined_tables = normalize_text_for_search(combined_tables)
    
            for metric_key, val_list in metrics.items():
                if metric_key not in METRIC_KEYS or val_list is None:
                    continue
                if not isinstance(val_list, list):
                    val_list = [val_list]
    
                for p_idx, val in enumerate(val_list):
                    if p_idx >= len(periods):
                        break
                    if val is None or val == "-" or val == "":
                        continue
    
                    # Strict validation to avoid hallucinations
                    norm_val = normalize_text_for_search(val)
                    if norm_val not in normalized_doc_text and norm_val not in normalized_combined_tables:
                        if metric_key == "ebitda":
                            # Allow derived EBITDA values calculated by Gemini
                            pass
                        else:
                            logger.warning(f"Hallucination alert: value '{val}' for metric '{metric_key}' not found in source text. Skipping.")
                            continue
    
                    parsed_num = clean_and_parse_number(val, multiplier)
                    if parsed_num is None:
                        continue
    
                    # Validation: Revenue must be > 0
                    if metric_key == "revenue" and parsed_num <= 0:
                        logger.warning(f"Validation alert: revenue value {parsed_num} <= 0. Skipping.")
                        continue
    
                    p = periods[p_idx]
                    p_key = (doc_rec.ticker, p["fiscal_year"], p["period_type"], p.get("fiscal_quarter"))
                    if p_key not in periods_data:
                        periods_data[p_key] = {}
                    periods_data[p_key][metric_key] = parsed_num

    # Execute extractions for primary and trend pages in parallel
    await asyncio.gather(
        process_page_set(primary_pages, "primary"),
        process_page_set(trend_pages, "trend")
    )

    # 6. Fallback/derive EBITDA/EBIT in Python if components are present
    for p_key, metrics_dict in periods_data.items():
        dep = metrics_dict.get("depreciation")
        interest = metrics_dict.get("interest_expense")
        tax = metrics_dict.get("tax_expense")
        pat = metrics_dict.get("pat")
        ebit = metrics_dict.get("ebit")
        ebitda = metrics_dict.get("ebitda")

        if ebitda is None:
            if ebit is not None and dep is not None:
                metrics_dict["ebitda"] = ebit + dep
                logger.debug(f"Calculated EBITDA (EBIT + Dep) for {p_key}: {metrics_dict['ebitda']} Cr")
            elif pat is not None and dep is not None:
                # Fallback EBITDA calculation: pat + tax + interest + dep
                calc_tax = tax or 0
                calc_interest = interest or 0
                metrics_dict["ebitda"] = pat + calc_tax + calc_interest + dep
                logger.debug(f"Calculated EBITDA (PAT + Tax + Int + Dep) for {p_key}: {metrics_dict['ebitda']} Cr")
        else:
            # We have EBITDA, validate EBITDA >= EBIT (if both are present)
            if ebit is not None and ebitda < ebit - 1.0:
                logger.warning(f"Validation alert: EBITDA ({ebitda}) < EBIT ({ebit}) for {p_key}. Rejecting ebitda value.")
                metrics_dict["ebitda"] = None

        if metrics_dict.get("ebit") is None:
            if pat is not None:
                calc_tax = tax or 0
                calc_interest = interest or 0
                metrics_dict["ebit"] = pat + calc_tax + calc_interest
                logger.debug(f"Calculated EBIT for {p_key}: {metrics_dict['ebit']} Cr")

    # 7. Perform DB Upserts with Preference resolution
    upserted_count = 0
    new_doc_pref = get_pref_weight(doc_rec.document_type)

    for p_key, metrics_dict in periods_data.items():
        ticker, year, period_type, quarter = p_key
        
        # Load existing record
        q = select(FinancialRecord).where(
            FinancialRecord.ticker == ticker,
            FinancialRecord.fiscal_year == year,
            FinancialRecord.period_type == period_type,
            FinancialRecord.fiscal_quarter == quarter
        )
        res = await db_session.execute(q)
        existing_rec = res.scalar_one_or_none()

        if not existing_rec:
            # Create new record
            insert_data = {
                "ticker": ticker,
                "fiscal_year": year,
                "period_type": period_type,
                "fiscal_quarter": quarter,
                "data_source": str(document_id)
            }
            for k in METRIC_KEYS:
                insert_data[k] = metrics_dict.get(k)
            
            stmt = insert(FinancialRecord).values(**insert_data)
            await db_session.execute(stmt)
            upserted_count += 1
            logger.info(f"Inserted new financials for {ticker} FY {year} {quarter or ''}")
        else:
            # Resolve preference
            existing_doc_id = None
            try:
                existing_doc_id = int(existing_rec.data_source) if existing_rec.data_source else None
            except ValueError:
                pass
            
            existing_doc_pref = 0
            if existing_doc_id:
                eq = select(DocumentRecord.document_type).where(DocumentRecord.id == existing_doc_id)
                eres = await db_session.execute(eq)
                existing_doc_type = eres.scalar_one_or_none()
                if existing_doc_type:
                    existing_doc_pref = get_pref_weight(existing_doc_type)

            if new_doc_pref > existing_doc_pref:
                # Overwrite all fields with new values
                update_data = {"data_source": str(document_id)}
                for k in METRIC_KEYS:
                    update_data[k] = metrics_dict.get(k)
                
                stmt = update(FinancialRecord).where(FinancialRecord.id == existing_rec.id).values(**update_data)
                await db_session.execute(stmt)
                upserted_count += 1
                logger.info(f"Overwrote financials for {ticker} FY {year} {quarter or ''} (new preference {doc_rec.document_type} > existing)")
            elif new_doc_pref == existing_doc_pref:
                # Merge fields: overwrite existing record only where new values are not null
                update_data = {"data_source": str(document_id)}
                for k in METRIC_KEYS:
                    new_val = metrics_dict.get(k)
                    if new_val is not None:
                        update_data[k] = new_val
                
                stmt = update(FinancialRecord).where(FinancialRecord.id == existing_rec.id).values(**update_data)
                await db_session.execute(stmt)
                upserted_count += 1
                logger.info(f"Merged financials for {ticker} FY {year} {quarter or ''} (same preference)")
            else:
                # New doc preference is lower than existing doc preference
                # Only update fields that are currently NULL in the existing record
                update_data = {}
                for k in METRIC_KEYS:
                    existing_val = getattr(existing_rec, k)
                    new_val = metrics_dict.get(k)
                    if existing_val is None and new_val is not None:
                        update_data[k] = new_val
                
                if update_data:
                    stmt = update(FinancialRecord).where(FinancialRecord.id == existing_rec.id).values(**update_data)
                    await db_session.execute(stmt)
                    upserted_count += 1
                    logger.info(f"Filled NULL fields in financials for {ticker} FY {year} {quarter or ''} (lower preference {doc_rec.document_type} < existing)")

    await db_session.commit()
    return upserted_count
