from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from loguru import logger

from backend.engines.report_orchestrator import generate_full_report
from backend.core.cache import cache_get, cache_set

router = APIRouter()

class AnalyzeRequest(BaseModel):
    ticker: str
    company_name: str | None = None
    exchange: str = "NSE"
    force_refresh: bool = False

@router.post("/analyze")
async def analyze_company(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    cache_key = f"report:{request.ticker.upper()}"
    if not request.force_refresh:
        cached = await cache_get(cache_key)
        if cached:
            cached["from_cache"] = True
            return cached

    try:
        report = await generate_full_report(request.ticker.upper(), force_refresh=request.force_refresh)
        # Store report in cache
        await cache_set(cache_key, report)
        return report
    except Exception as e:
        logger.error(f"Report generation failed for {request.ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
