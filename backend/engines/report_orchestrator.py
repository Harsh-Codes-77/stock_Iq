import asyncio
from datetime import datetime
from decimal import Decimal
from loguru import logger
from sqlalchemy.future import select

from backend.core.database import AsyncSessionLocal
from backend.models.company import CompanyRecord
from backend.models.document import DocumentRecord
from backend.models.financials import FinancialRecord

# Import all engines
from backend.engines.company_resolver import search_company_website
from backend.engines.ir_discovery import discover_ir_page
from backend.engines.document_crawler import crawl_and_store_documents
from backend.engines.pdf_extractor import extract_pdf
from backend.engines.semantic_chunker import chunk_document
from backend.engines.embedder import store_chunks_in_vector_db
from backend.engines.financial_extractor import process_document_financials
from backend.engines.quant_scores import (
    piotroski_f_score,
    beneish_m_score,
    altman_z_score_emerging_markets,
    dupont_decomposition,
    working_capital_cycle,
    calculate_wacc,
    dcf_valuation,
    incremental_roce,
    operating_leverage
)
from backend.engines.rules_engine import run_all_rules
from backend.engines.concall_engine import run_concall_engine as run_concall_analysis
from backend.engines.forensic_engine import run_forensic_analysis
from backend.engines.rag_analysis_engine import run_rag_analysis_for_section, ANALYSIS_SECTIONS
from backend.engines.valuation_engine import run_full_valuation


def _log(report: dict, stage: str, data: dict):
    """Log stage metadata to the pipeline log."""
    if "pipeline_log" not in report:
        report["pipeline_log"] = []
    report["pipeline_log"].append({
        "stage": stage,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    })


async def get_or_create_company(
    ticker: str,
    company_name: str = None,
    official_website: str = None,
    ir_page_url: str = None
) -> dict:
    """Helper to retrieve or upsert company record in PostgreSQL."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(CompanyRecord).where(CompanyRecord.ticker == ticker.upper())
        )
        company = result.scalar_one_or_none()

        if not company:
            company = CompanyRecord(
                ticker=ticker.upper(),
                company_name=company_name or ticker.upper(),
                official_website=official_website,
                ir_page_url=ir_page_url,
                crawl_status="pending"
            )
            session.add(company)
            await session.commit()
            await session.refresh(company)
        else:
            updated = False
            if company_name and company.company_name != company_name:
                company.company_name = company_name
                updated = True
            if official_website and company.official_website != official_website:
                company.official_website = official_website
                updated = True
            if ir_page_url and company.ir_page_url != ir_page_url:
                company.ir_page_url = ir_page_url
                updated = True
            if updated:
                await session.commit()
                await session.refresh(company)

        return {
            "id": company.id,
            "ticker": company.ticker,
            "company_name": company.company_name,
            "official_website": company.official_website,
            "ir_page_url": company.ir_page_url,
            "sector": company.sector
        }


async def get_existing_documents(ticker: str) -> list[dict]:
    """Fetch existing documents for a ticker from PostgreSQL."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DocumentRecord).where(DocumentRecord.ticker == ticker.upper())
        )
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "ticker": r.ticker,
                "company_id": r.company_id,
                "document_type": r.document_type,
                "title": r.title,
                "source_url": r.source_url,
                "local_path": r.local_path,
                "fiscal_year": r.fiscal_year,
                "fiscal_quarter": r.fiscal_quarter,
                "file_size_bytes": r.file_size_bytes,
                "page_count": r.page_count,
                "extraction_status": r.extraction_status,
                "discovered_at": r.discovered_at.isoformat() if r.discovered_at else None,
                "extracted_at": r.extracted_at.isoformat() if r.extracted_at else None,
            }
            for r in records
        ]


async def update_document_extraction_status(doc_id: int, status: str, page_count: int = None):
    """Update status, page count, and timestamp of a document after extraction."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DocumentRecord).where(DocumentRecord.id == doc_id)
        )
        doc = result.scalar_one_or_none()
        if doc:
            doc.extraction_status = status
            if page_count is not None:
                doc.page_count = page_count
            doc.extracted_at = datetime.utcnow()
            await session.commit()


async def extract_structured_financials(ticker: str) -> list[dict]:
    """Retrieve financial records from Postgres and serialize to floats."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(FinancialRecord)
            .where(FinancialRecord.ticker == ticker.upper())
            .order_by(FinancialRecord.fiscal_year.desc())
        )
        records = result.scalars().all()
        financials = []
        for r in records:
            d = {}
            for col in r.__table__.columns:
                val = getattr(r, col.name)
                if isinstance(val, Decimal):
                    val = float(val)
                d[col.name] = val
            financials.append(d)
        return financials


def resolve_shareholding_data(financials: list[dict]) -> dict:
    """Build promoter shareholding dictionary dynamically from financials or fallback."""
    if not financials:
        return {
            "promoter_pledge_pct": 0.0,
            "promoter_holding": 50.0,
            "promoter_holding_prev": 50.0,
            "promoter_holding_trend": "Stable",
            "beta": 1.0
        }

    # Sort ascending for trend analysis
    sorted_fin = sorted(financials, key=lambda x: x.get("fiscal_year", 0))
    t0 = sorted_fin[-1] if sorted_fin else {}
    t1 = sorted_fin[-2] if len(sorted_fin) >= 2 else {}

    promoter_holding = t0.get("promoter_holding") or t0.get("promoterHolding") or 50.0
    promoter_holding_prev = t1.get("promoter_holding") or t1.get("promoterHolding") or promoter_holding

    trend = f"Stable at {promoter_holding}%"
    if promoter_holding > promoter_holding_prev:
        trend = f"Increasing: {promoter_holding_prev}% to {promoter_holding}% YoY"
    elif promoter_holding < promoter_holding_prev:
        trend = f"Decreasing: {promoter_holding_prev}% to {promoter_holding}% YoY"

    beta = t0.get("beta") or 1.0
    promoter_pledge_pct = t0.get("promoter_pledge_pct") or t0.get("promoter_pledge") or 0.0

    return {
        "promoter_pledge_pct": float(promoter_pledge_pct),
        "promoter_holding": float(promoter_holding),
        "promoter_holding_prev": float(promoter_holding_prev),
        "promoter_holding_trend": trend,
        "beta": float(beta)
    }


def resolve_current_metrics(financials: list[dict]) -> dict:
    """Build current valuation metrics from latest financials or default."""
    if not financials:
        return {
            "shares_outstanding": 1.0,
            "current_price": 100.0,
            "net_debt": 0.0,
            "ebit": 0.0,
            "tax_rate": 0.25,
            "fcf": 0.0
        }

    sorted_fin = sorted(financials, key=lambda x: x.get("fiscal_year", 0), reverse=True)
    latest = sorted_fin[0]

    shares = latest.get("shares_outstanding") or latest.get("shares") or 1.0
    price = latest.get("share_price") or latest.get("price") or 100.0
    net_debt = latest.get("total_debt") or 0.0

    ebit = latest.get("ebit") or latest.get("operating_income") or latest.get("operating_profit") or 0.0
    tax_rate = latest.get("tax_rate") or 0.25

    cfo = latest.get("cfo") or 0.0
    capex = latest.get("capex") or 0.0
    fcf = latest.get("free_cash_flow") or (cfo - abs(capex))

    return {
        "shares_outstanding": float(shares),
        "shares": float(shares),
        "current_price": float(price),
        "price": float(price),
        "net_debt": float(net_debt),
        "ebit": float(ebit),
        "tax_rate": float(tax_rate),
        "fcf": float(fcf),
        "free_cash_flow": float(fcf)
    }


async def run_rag_analysis(ticker: str, financials: list[dict], quant_scores: dict, rules_signals: list) -> dict:
    """Runs RAG analysis for all sections concurrently."""
    section_keys = list(ANALYSIS_SECTIONS.keys())

    combined_context = {
        "quant_scores": quant_scores or {},
        "financials_summary": financials[:3] if financials else []
    }

    tasks = [
        run_rag_analysis_for_section(ticker, key, combined_context)
        for key in section_keys
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    rag_report = {}
    for key, result in zip(section_keys, results):
        if isinstance(result, Exception):
            logger.error(f"RAG Analysis failed for section {key}: {result}")
            rag_report[key] = {
                "error": str(result),
                "status": "unavailable"
            }
        else:
            rag_report[key] = result

    return rag_report


def _calculate_completeness(report: dict) -> float:
    """Calculates data completeness percentage for a generated report."""
    fields = [
        "company",
        "financials",
        "quant_scores",
        "signals",
        "concall_analysis",
        "forensic_analysis",
        "rag_analysis",
        "valuation"
    ]

    completed = 0
    for field in fields:
        val = report.get(field)
        if val:
            if isinstance(val, (list, dict)):
                if len(val) > 0:
                    completed += 1
            else:
                completed += 1

    return round((completed / len(fields)) * 100.0, 2)


async def _update_job(job_id: str, progress: int, status: str = "running", result: dict = None, error: str = None):
    if not job_id:
        return
    try:
        from backend.core.cache import cache_set
        payload = {
            "status": status,
            "progress_pct": progress
        }
        if result is not None:
            payload["result"] = result
        if error is not None:
            payload["error"] = error
        await cache_set(f"job:{job_id}", payload, ttl=3600)
    except Exception as e:
        logger.warning(f"Failed to update job status for {job_id}: {e}")


async def generate_full_report(ticker: str, force_refresh: bool = False, job_id: str = None) -> dict:
    """
    Master pipeline. Calls all engines in order.
    Returns complete report JSON.
    """
    ticker_upper = ticker.upper()
    report = {
        "ticker": ticker_upper,
        "pipeline_log": [],
        "errors": []
    }

    try:
        await _update_job(job_id, 5)

        # Stage 1: Company Resolution
        try:
            company = await search_company_website(ticker_upper)
        except Exception as e:
            logger.error(f"Company resolution failed for {ticker_upper}: {e}")
            company = {
                "ticker": ticker_upper,
                "company_name": ticker_upper,
                "official_website": None,
                "search_confidence": "LOW",
                "error": str(e)
            }

        try:
            db_company = await get_or_create_company(
                ticker=ticker_upper,
                company_name=company.get("company_name"),
                official_website=company.get("official_website")
            )
            company_id = db_company["id"]
            company["id"] = company_id
            sector = db_company.get("sector") or "IT"
        except Exception as e:
            logger.error(f"Database company mapping failed: {e}")
            company_id = 0
            sector = "IT"

        _log(report, "STAGE_1_COMPANY_RESOLVER", company)
        await _update_job(job_id, 15)

        # Stage 2: IR Discovery
        ir_data = {}
        try:
            if company.get("official_website"):
                ir_data = await discover_ir_page(company["official_website"])
                if ir_data.get("ir_url") and company_id > 0:
                    await get_or_create_company(ticker_upper, ir_page_url=ir_data["ir_url"])
        except Exception as e:
            logger.error(f"IR discovery failed: {e}")
            report["errors"].append(f"ir_discovery: {str(e)}")

        _log(report, "STAGE_2_IR_DISCOVERY", {"ir_found": ir_data.get("ir_found"), "ir_url": ir_data.get("ir_url")})
        await _update_job(job_id, 30)

        # Stage 3: Document Crawling
        documents = []
        try:
            if company_id > 0:
                existing_docs = await get_existing_documents(ticker_upper)
                if existing_docs and not force_refresh:
                    documents = existing_docs
                    _log(report, "STAGE_3_DOCUMENTS", {"count": len(documents), "crawled_today": False})
                else:
                    documents = await crawl_and_store_documents(ticker_upper, company_id, ir_data.get("document_links", []))
                    _log(report, "STAGE_3_DOCUMENTS", {"count": len(documents), "crawled_today": True})
        except Exception as e:
            logger.error(f"Document crawling failed: {e}")
            report["errors"].append(f"document_crawling: {str(e)}")

        await _update_job(job_id, 45)

        # Stage 4: PDF Extraction + Chunking + Embedding
        try:
            for doc in documents:
                if doc.get("extraction_status") != "done":
                    try:
                        extracted = extract_pdf(doc["local_path"])
                        chunks = chunk_document(extracted.get("pages", []), doc["document_type"])
                        fiscal_yr = doc.get("fiscal_year")
                        try:
                            fiscal_yr_int = int(fiscal_yr) if fiscal_yr else None
                        except ValueError:
                            fiscal_yr_int = None

                        await store_chunks_in_vector_db(
                            ticker=ticker_upper,
                            document_id=doc["id"],
                            document_type=doc["document_type"],
                            fiscal_year=fiscal_yr_int,
                            chunks=chunks
                        )

                        await update_document_extraction_status(doc["id"], "done", len(extracted.get("pages", [])))
                    except Exception as e:
                        logger.error(f"Failed to extract document {doc.get('id')}: {e}")
                        report["errors"].append(f"document_extraction_{doc.get('id')}: {str(e)}")
        except Exception as e:
            logger.error(f"PDF extraction phase failed: {e}")
            report["errors"].append(f"pdf_extraction_phase: {str(e)}")

        _log(report, "STAGE_4_EXTRACTION_EMBEDDING", {"processed_count": len(documents)})
        await _update_job(job_id, 60)

        # Stage 5: Financial Data Extraction
        financials = []
        try:
            financials = await extract_structured_financials(ticker_upper)
            if (not financials or force_refresh) and documents:
                for doc in documents:
                    try:
                        async with AsyncSessionLocal() as db:
                            upserted = await process_document_financials(doc["id"], db)
                            logger.info(f"Processed financials for document ID {doc['id']}: upserted {upserted} rows")
                    except Exception as e:
                        logger.error(f"Structured extraction from document {doc.get('id')} failed: {e}")
                financials = await extract_structured_financials(ticker_upper)
        except Exception as e:
            logger.error(f"Financial extraction stage failed: {e}")
            report["errors"].append(f"financial_extraction_stage: {str(e)}")

        _log(report, "STAGE_5_FINANCIALS", {"years_available": len(financials)})
        await _update_job(job_id, 70)

        # Stage 6: Quantitative Scores
        quant = {}
        if len(financials) >= 2:
            try:
                quant["piotroski"] = piotroski_f_score(financials)
                quant["beneish"] = beneish_m_score(financials)
                quant["altman"] = altman_z_score_emerging_markets(financials)
                quant["dupont"] = dupont_decomposition(financials)
                quant["wcc"] = working_capital_cycle(financials)

                # Build inputs for WACC
                latest = financials[0]
                market_cap = (latest.get("shares_outstanding") or 1.0) * (latest.get("share_price") or latest.get("price") or 100.0)
                if not market_cap or market_cap == 0:
                    market_cap = 10000.0
                total_debt = latest.get("total_debt") or 0.0
                beta = latest.get("beta") or 1.0

                wacc_res = calculate_wacc(market_cap, total_debt, beta)
                quant["wacc"] = wacc_res

                # DCF Valuation
                last_fcf = latest.get("free_cash_flow") or (latest.get("cfo", 0.0) - abs(latest.get("capex", 0.0)))
                wacc_val = wacc_res.get("wacc") or 0.10
                quant["dcf"] = dcf_valuation(
                    last_fcf=last_fcf,
                    wacc=wacc_val,
                    price=latest.get("share_price") or latest.get("price"),
                    shares=latest.get("shares_outstanding"),
                    net_debt=total_debt
                )

                quant["incremental_roce"] = incremental_roce(financials)
                quant["operating_leverage"] = operating_leverage(financials)
            except Exception as e:
                logger.error(f"Quantitative scores calculation failed: {e}")
                report["errors"].append(f"quant_scores: {str(e)}")

        _log(report, "STAGE_6_QUANT_SCORES", {"calculated": bool(quant)})
        await _update_job(job_id, 80)

        # Stage 7: Rules Engine
        signals = []
        try:
            shareholding_data = resolve_shareholding_data(financials)
            rules_res = run_all_rules(financials, shareholding_data)
            if isinstance(rules_res, list):
                signals = rules_res
        except Exception as e:
            logger.error(f"Rules engine run failed: {e}")
            report["errors"].append(f"rules_engine: {str(e)}")

        _log(report, "STAGE_7_RULES_ENGINE", {"signals_count": len(signals)})
        await _update_job(job_id, 90)

        # Stage 8: Concurrent Analysis Engines
        shareholding = resolve_shareholding_data(financials)
        current_metrics = resolve_current_metrics(financials)

        (
            concall_analysis,
            forensic_analysis,
            rag_analysis,
            valuation
        ) = await asyncio.gather(
            run_concall_analysis(ticker_upper),
            run_forensic_analysis(ticker_upper, financials, quant, signals, shareholding),
            run_rag_analysis(ticker_upper, financials, quant, signals),
            asyncio.to_thread(run_full_valuation, financials, current_metrics, quant.get("wacc", {}), sector),
            return_exceptions=True
        )

        # Handle exceptions from gather
        for name, result in [
            ("concall", concall_analysis),
            ("forensic", forensic_analysis),
            ("rag", rag_analysis),
            ("valuation", valuation)
        ]:
            if isinstance(result, Exception):
                logger.error(f"Stage 8 concurrent run failed for {name}: {result}")
                report["errors"].append(f"{name}: {str(result)}")

        # Assemble final report
        report.update({
            "company": company,
            "financials": financials,
            "quant_scores": quant,
            "signals": [s.__dict__ if hasattr(s, "__dict__") else s for s in signals],
            "concall_analysis": concall_analysis if not isinstance(concall_analysis, Exception) else None,
            "forensic_analysis": forensic_analysis if not isinstance(forensic_analysis, Exception) else None,
            "rag_analysis": rag_analysis if not isinstance(rag_analysis, Exception) else None,
            "valuation": valuation if not isinstance(valuation, Exception) else None,
            "generated_at": datetime.utcnow().isoformat()
        })

        report["data_completeness"] = _calculate_completeness(report)
        _log(report, "STAGE_8_CONCURRENT_ANALYSIS_COMPLETE", {"completeness": report["data_completeness"]})

        await _update_job(job_id, 100, status="completed", result=report)
        return report
    except Exception as e:
        logger.error(f"Report orchestrator crashed: {e}")
        await _update_job(job_id, 100, status="failed", error=str(e))
        raise e
