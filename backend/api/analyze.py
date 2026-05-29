from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

router = APIRouter()

class AnalyzeRequest(BaseModel):
    ticker: str
    company_name: str | None = None
    exchange: str = "NSE"
    force_refresh: bool = False

@router.post("/analyze")
async def analyze_company(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    # Stub — implemented fully in Milestone 13
    return {"status": "not_yet_implemented", "ticker": request.ticker}
