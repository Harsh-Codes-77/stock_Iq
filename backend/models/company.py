from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
import sys
import os

# Adjust path to import Base from core.database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from core.database import Base
except ImportError:
    from ..core.database import Base

class CompanyRecord(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    official_website = Column(String(500), nullable=True)
    ir_page_url = Column(String(500), nullable=True)
    exchange = Column(String(10), default="NSE")
    sector = Column(String(100), nullable=True)
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    last_crawled_at = Column(DateTime(timezone=True), nullable=True)
    crawl_status = Column(String(50), default="pending")
