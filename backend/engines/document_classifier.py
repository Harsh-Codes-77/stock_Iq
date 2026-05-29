"""
Document Classification Engine

Given: document URL + title text
Returns: document_type from the following fixed taxonomy

TAXONOMY:
- ANNUAL_REPORT
- QUARTERLY_RESULTS
- INVESTOR_PRESENTATION
- CONCALL_TRANSCRIPT
- PRESS_RELEASE
- AGM_PRESENTATION
- ANALYST_MEET
- CREDIT_RATING_REPORT
- SHAREHOLDING_REPORT
- ESG_REPORT
- CAPEX_UPDATE
- CORPORATE_GOVERNANCE_REPORT
- BUSINESS_UPDATE
- UNKNOWN
"""

import re

CLASSIFICATION_RULES = {
    "CONCALL_TRANSCRIPT": [
        r"concall", r"earnings[\s\-_/]*call", r"conference[\s\-_/]*call",
        r"transcript", r"call[\s\-_/]*transcript"
    ],
    "INVESTOR_PRESENTATION": [
        r"investor[\s\-_/]*pres", r"earnings[\s\-_/]*pres", r"investor[\s\-_/]*day",
        r"capital[\s\-_/]*market[\s\-_/]*day", r"analyst[\s\-_/]*pres"
    ],
    "ANNUAL_REPORT": [
        r"annual[\s\-_/]*report", r"ar[\s\-_/]*20\d\d", r"yearly[\s\-_/]*report",
        r"integrated[\s\-_/]*report", r"\bar\d{2}\b"
    ],
    "AGM_PRESENTATION": [
        r"\bagm\b", r"annual[\s\-_/]*general[\s\-_/]*meet"
    ],
    "ANALYST_MEET": [
        r"analyst[\s\-_/]*meet", r"analyst[\s\-_/]*day", r"investor[\s\-_/]*meet"
    ],
    "CREDIT_RATING_REPORT": [
        r"credit[\s\-_/]*rat", r"crisil", r"icra", r"care[\s\-_/]*rat", r"fitch", r"moody"
    ],
    "SHAREHOLDING_REPORT": [
        r"shareholding", r"share[\s\-_/]*holding[\s\-_/]*pattern"
    ],
    "ESG_REPORT": [
        r"\besg\b", r"sustainability[\s\-_/]*report", r"csr[\s\-_/]*report",
        r"environmental[\s\-_/]*report", r"brsr"
    ],
    "PRESS_RELEASE": [
        r"press[\s\-_/]*release", r"media[\s\-_/]*release", r"news[\s\-_/]*release"
    ],
    "CAPEX_UPDATE": [
        r"capex", r"expansion[\s\-_/]*update", r"project[\s\-_/]*update",
        r"capacity[\s\-_/]*expansion"
    ],
    "QUARTERLY_RESULTS": [
        r"q[1-4][\s\-_/]*(fy)?[\s\-_/]*20\d\d", r"quarterly[\s\-_/]*result",
        r"financial[\s\-_/]*result", r"q[1-4][\s\-_/]*result", r"\bq[1-4]\b.*result",
        r"/q[1-4]/", r"\bq[1-4]\b"
    ],
}

def classify_document(url: str, title: str) -> str:
    """Classify a document based on URL and title text."""
    combined = (url + " " + title).lower()

    for doc_type, patterns in CLASSIFICATION_RULES.items():
        for pattern in patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                return doc_type

    return "UNKNOWN"

def extract_fiscal_period(text: str) -> dict:
    """Extract fiscal year and quarter from document title/URL."""
    text = text.lower()

    # Extract fiscal year: FY24, FY2024, 2023-24, 2024
    fy_match = re.search(r"fy\s*(\d{2,4})|(\d{4})-(\d{2,4})|(\d{4})", text)
    fiscal_year = None
    if fy_match:
        if fy_match.group(1):
            yr = int(fy_match.group(1))
            fiscal_year = 2000 + yr if yr < 100 else yr
        elif fy_match.group(2):
            fiscal_year = int(fy_match.group(2))
        elif fy_match.group(4):
            fiscal_year = int(fy_match.group(4))

    # Extract quarter: Q1, Q2, Q3, Q4
    q_match = re.search(r"q([1-4])", text, re.IGNORECASE)
    quarter = f"Q{q_match.group(1)}" if q_match else None

    return {"fiscal_year": fiscal_year, "fiscal_quarter": quarter}
