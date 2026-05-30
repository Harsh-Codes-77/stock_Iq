from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

try:
    from api import analyze, documents, health, export
except ImportError:
    from .api import analyze, documents, health, export

app = FastAPI(
    title="StockIQ Institutional Research Engine",
    version="2.0.0",
    description="AI-powered institutional equity research backend"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://stock-iq-eight.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(export.router, prefix="/api")

@app.on_event("startup")
async def startup():
    logger.info("StockIQ backend starting up")

@app.on_event("shutdown")
async def shutdown():
    logger.info("StockIQ backend shutting down")
