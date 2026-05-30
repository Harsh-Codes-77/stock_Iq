import uuid
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

async def background_analysis_task(job_id: str, ticker: str, force_refresh: bool):
    try:
        report = await generate_full_report(ticker, force_refresh=force_refresh, job_id=job_id)
        # Store report in main cache
        cache_key = f"report:{ticker}"
        await cache_set(cache_key, report)
    except Exception as e:
        logger.error(f"Background task failed for job {job_id} ({ticker}): {e}")

@router.post("/analyze")
async def analyze_company(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    ticker_upper = request.ticker.upper()
    cache_key = f"report:{ticker_upper}"

    # Check cache first (unless force_refresh is True)
    if not request.force_refresh:
        cached = await cache_get(cache_key)
        if cached:
            return {
                "job_id": f"cached_{ticker_upper}",
                "status": "completed",
                "progress_pct": 100,
                "result": cached
            }

    # Generate job_id
    job_id = str(uuid.uuid4())

    # Initialize job status in cache
    initial_status = {
        "status": "pending",
        "progress_pct": 0
    }
    await cache_set(f"job:{job_id}", initial_status, ttl=3600)

    # Start background task
    background_tasks.add_task(background_analysis_task, job_id, ticker_upper, request.force_refresh)

    return {
        "job_id": job_id,
        "status": "pending",
        "progress_pct": 0
    }

@router.get("/analyze/{job_id}/status")
async def get_job_status(job_id: str):
    # If it is a cached run
    if job_id.startswith("cached_"):
        ticker = job_id.replace("cached_", "")
        cache_key = f"report:{ticker}"
        cached = await cache_get(cache_key)
        if cached:
            return {
                "status": "completed",
                "progress_pct": 100,
                "result": cached
            }

    # Get from cache
    job_data = await cache_get(f"job:{job_id}")
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_data
