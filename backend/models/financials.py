from sqlalchemy import Column, Integer, String, DateTime, Numeric, UniqueConstraint
from sqlalchemy.sql import func
import sys
import os

# Adjust path to import Base from core.database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from core.database import Base
except ImportError:
    from ..core.database import Base

class FinancialRecord(Base):
    __tablename__ = "financials"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    fiscal_year = Column(Integer, nullable=False)
    period_type = Column(String(20), default="annual")
    fiscal_quarter = Column(String(10), nullable=True)
    
    # Financial metrics (stored in ₹ Crore, normalized)
    revenue = Column(Numeric, nullable=True)
    ebitda = Column(Numeric, nullable=True)
    ebit = Column(Numeric, nullable=True)
    pat = Column(Numeric, nullable=True)
    cfo = Column(Numeric, nullable=True)
    capex = Column(Numeric, nullable=True)
    free_cash_flow = Column(Numeric, nullable=True)
    total_debt = Column(Numeric, nullable=True)
    total_equity = Column(Numeric, nullable=True)
    total_assets = Column(Numeric, nullable=True)
    current_assets = Column(Numeric, nullable=True)
    current_liabilities = Column(Numeric, nullable=True)
    trade_receivables = Column(Numeric, nullable=True)
    inventory = Column(Numeric, nullable=True)
    trade_payables = Column(Numeric, nullable=True)
    retained_earnings = Column(Numeric, nullable=True)
    depreciation = Column(Numeric, nullable=True)
    interest_expense = Column(Numeric, nullable=True)
    tax_expense = Column(Numeric, nullable=True)
    shares_outstanding = Column(Numeric, nullable=True)
    
    data_source = Column(String(100), nullable=True)  # Will store document ID as string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("ticker", "fiscal_year", "period_type", "fiscal_quarter", name="uq_financials_period"),
    )
