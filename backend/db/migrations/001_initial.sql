CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255),
    official_website VARCHAR(500),
    ir_page_url VARCHAR(500),
    exchange VARCHAR(10) DEFAULT 'NSE',
    sector VARCHAR(100),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_crawled_at TIMESTAMPTZ,
    crawl_status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    ticker VARCHAR(20) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(500),
    source_url VARCHAR(1000),
    local_path VARCHAR(500),
    fiscal_year VARCHAR(20),
    fiscal_quarter VARCHAR(10),
    file_size_bytes INTEGER,
    page_count INTEGER,
    extraction_status VARCHAR(50) DEFAULT 'pending',
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    extracted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    ticker VARCHAR(20) NOT NULL,
    chunk_index INTEGER,
    section_type VARCHAR(100),
    section_title VARCHAR(500),
    content TEXT NOT NULL,
    token_count INTEGER,
    chroma_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financials (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    period_type VARCHAR(20) DEFAULT 'annual',
    fiscal_quarter VARCHAR(10),
    revenue NUMERIC,
    ebitda NUMERIC,
    ebit NUMERIC,
    pat NUMERIC,
    cfo NUMERIC,
    capex NUMERIC,
    free_cash_flow NUMERIC,
    total_debt NUMERIC,
    total_equity NUMERIC,
    total_assets NUMERIC,
    current_assets NUMERIC,
    current_liabilities NUMERIC,
    trade_receivables NUMERIC,
    inventory NUMERIC,
    trade_payables NUMERIC,
    retained_earnings NUMERIC,
    depreciation NUMERIC,
    interest_expense NUMERIC,
    tax_expense NUMERIC,
    shares_outstanding NUMERIC,
    data_source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, fiscal_year, period_type, fiscal_quarter)
);

CREATE TABLE IF NOT EXISTS analysis_reports (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    report_version INTEGER DEFAULT 1,
    pipeline_status VARCHAR(50) DEFAULT 'pending',
    report_json JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    documents_used INTEGER[],
    error_log TEXT
);

CREATE INDEX idx_documents_ticker ON documents(ticker);
CREATE INDEX idx_financials_ticker ON financials(ticker);
CREATE INDEX idx_chunks_ticker ON document_chunks(ticker);
