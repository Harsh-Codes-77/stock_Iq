from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
import sys
import os

# Adjust path to import Base from core.database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from core.database import Base
except ImportError:
    from ..core.database import Base

class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    ticker = Column(String(20), nullable=False, index=True)
    document_type = Column(String(100), nullable=False)
    title = Column(String(500), nullable=True)
    source_url = Column(String(1000), nullable=True)
    local_path = Column(String(500), nullable=True)
    fiscal_year = Column(String(20), nullable=True)
    fiscal_quarter = Column(String(10), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    extraction_status = Column(String(50), default="pending")
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    extracted_at = Column(DateTime(timezone=True), nullable=True)
