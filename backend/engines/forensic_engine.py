import json
import re
import google.generativeai as genai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.core.config import settings
from backend.engines.embedder import retrieve_chunks

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=60))
async def call_gemini_with_retry(prompt: str, max_tokens: int = 1500) -> str:
    """
    Call Gemini models with fallback and retries, expecting a JSON response.
    """
    for model_name in ["models/gemini-3.1-flash-lite", "models/gemini-1.5-flash", "models/gemini-3.1-flash"]:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "max_output_tokens": max_tokens
                }
            )
            return response.text
        except Exception as e:
            logger.warning(f"Failed to query Gemini model {model_name}: {e}")
            continue
    raise Exception("All Gemini models failed in call_gemini_with_retry.")

def parse_json_response(response_text: str) -> dict:
    """
    Safely parses JSON output from Gemini, using fallbacks if parsing fails.
    """
    try:
        return json.loads(response_text)
    except Exception as e:
        logger.warning(f"Failed direct JSON load of Gemini response: {e}")
        # Try finding JSON block in case of conversational wrapper
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        
        # Conforming fallback schema
        return {
            "fraud_probability_score": 5.0,
            "earnings_quality_score": 5.0,
            "key_concerns": ["Could not parse JSON response from Gemini"],
            "clean_signals": [],
            "overall_forensic_verdict": "MINOR_CONCERNS",
            "one_paragraph_summary": "Forensic analysis executed but output parsing failed. Check raw model output logs."
        }

async def run_forensic_analysis(
    ticker: str,
    financials: list[dict],
    quant_scores: dict,
    rules_signals: list,
    shareholding: dict
) -> dict:
    """
    Combines:
    1. Quantitative signals (Beneish, Altman, Piotroski)
    2. Rules engine red flags
    3. AI analysis of relevant MD&A and notes to accounts chunks

    Returns forensic risk assessment.
    """

    # Retrieve relevant chunks
    forensic_queries = [
        "related party transactions",
        "contingent liabilities off-balance-sheet",
        "revenue recognition policy changes",
        "audit qualifications",
        "impairment losses write-offs",
        "working capital loans short-term borrowings"
    ]

    all_chunks = []
    for query in forensic_queries:
        # Retrieve chunks with filter if CONCALL_TRANSCRIPT is excluded,
        # but let's query generally across any relevant documents (Annual Report/MD&A)
        chunks = await retrieve_chunks(ticker, query, n_results=4)
        all_chunks.extend(chunks)

    # Deduplicate chunks
    seen_ids = set()
    unique_chunks = []
    for c in all_chunks:
        cid = c["metadata"].get("chunk_index")
        doc_id = c["metadata"].get("document_id")
        # Unique identifier is combination of doc_id and chunk_index
        unique_key = (doc_id, cid)
        if unique_key not in seen_ids:
            seen_ids.add(unique_key)
            unique_chunks.append(c)

    # Build forensic AI prompt
    context = "\n\n---\n\n".join([c["content"] for c in unique_chunks[:12]])

    # Filter rules engine signals for RED_FLAGS
    # Ensure rules_signals attributes or dict keys are handled safely
    red_flag_signals = []
    for s in rules_signals:
        severity = getattr(s, "severity", None) or (s.get("severity") if isinstance(s, dict) else None)
        if severity == "RED_FLAG":
            red_flag_signals.append(s)

    signal_lines = []
    for s in red_flag_signals:
        rule_id = getattr(s, "rule_id", None) or (s.get("rule_id") if isinstance(s, dict) else "?")
        title = getattr(s, "title", None) or (s.get("title") if isinstance(s, dict) else "?")
        evidence = getattr(s, "evidence", None) or (s.get("evidence") if isinstance(s, dict) else "?")
        signal_lines.append(f"- {rule_id}: {title} | Evidence: {evidence}")

    signal_summary = "\n".join(signal_lines)

    prompt = f"""
You are a forensic accountant conducting institutional due diligence on {ticker}.

PRE-COMPUTED RISK SIGNALS (these are mathematical facts, not estimates):
{signal_summary if signal_summary else "No red flags detected by rules engine"}

BENEISH M-SCORE: {quant_scores.get('beneish', {}).get('mScore', 'N/A')} (threshold: -1.78, higher = more risk)
ALTMAN Z-SCORE: {quant_scores.get('altman', {}).get('zScore', 'N/A')} (zone: {quant_scores.get('altman', {}).get('zone', 'N/A')})
PIOTROSKI F-SCORE: {quant_scores.get('piotroski', {}).get('score', 'N/A')}/9

PROMOTER PLEDGE: {shareholding.get('promoter_pledge_pct', 'N/A')}%
PROMOTER HOLDING TREND: {shareholding.get('promoter_holding_trend', 'N/A')}

DOCUMENT EXCERPTS (from annual reports, notes to accounts, MD&A):
{context}

Your task: Produce a forensic risk assessment in JSON format.
- fraud_probability_score: 0-10 (0 = clean, 10 = high probability of manipulation)
- earnings_quality_score: 0-10 (10 = high quality, cash-backed earnings)
- key_concerns: list of specific forensic concerns with evidence
- clean_signals: list of things that look genuinely healthy
- overall_forensic_verdict: "CLEAN" | "MINOR_CONCERNS" | "SIGNIFICANT_CONCERNS" | "HIGH_RISK"
- one_paragraph_summary: 3-4 sentence forensic summary for institutional use

Return ONLY valid JSON. No preamble.
"""

    # Call Gemini
    response = await call_gemini_with_retry(prompt, max_tokens=1500)
    return parse_json_response(response)
