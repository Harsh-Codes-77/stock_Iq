import json
import re
import google.generativeai as genai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.core.config import settings
from backend.engines.embedder import retrieve_chunks

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

# Define Analysis Sections
ANALYSIS_SECTIONS = {
    "executive_summary": {
        "queries": ["business overview strategy", "key financial highlights", "management guidance"],
        "section_filters": ["BUSINESS_OVERVIEW", "MD_AND_A", "CHAIRPERSON_LETTER"],
        "target_schema": {
            "business_overview": "Summary of the business activities and long-term strategy.",
            "financial_highlights": "Key quantitative highlights from the period.",
            "management_guidance_summary": "Summary of management's future targets and outlook.",
            "strategic_outlook": "Overall strategic trajectory of the company."
        }
    },
    "business_model": {
        "queries": ["revenue segments products services customers", "how company makes money"],
        "section_filters": ["BUSINESS_OVERVIEW", "SEGMENT_PERFORMANCE"],
        "target_schema": {
            "revenue_segments": ["Segment name and contribution"],
            "value_proposition": "Core value proposition offered to customers.",
            "customer_concentration": "Evidence of customer concentration or key customer dynamics.",
            "monetization_flow": "Detailed explanation of monetization mechanics."
        }
    },
    "management_quality": {
        "queries": ["management commentary guidance targets", "chairman message strategy"],
        "section_filters": ["MANAGEMENT_COMMENTARY", "MD_AND_A"],
        "target_schema": {
            "management_track_record": "Evaluation of management execution and track record.",
            "governance_practices": "Corporate governance observations.",
            "alignment_with_shareholders": "Evidence of management alignment with minority shareholders."
        }
    },
    "capital_allocation": {
        "queries": ["capex investment acquisition dividend buyback", "capital allocation strategy"],
        "section_filters": ["MD_AND_A", "CASH_FLOW"],
        "target_schema": {
            "capex_and_investments": "Analysis of capital expenditures and investments.",
            "dividend_and_buyback_policy": "Analysis of dividend payout and buyback policies.",
            "acquisitions_and_disposals": "Analysis of M&A and asset disposals.",
            "capital_efficiency_verdict": "Verdict on overall capital allocation efficiency."
        }
    },
    "competitive_moat": {
        "queries": ["competitive advantage market position pricing power", "barriers to entry"],
        "section_filters": ["BUSINESS_OVERVIEW", "MD_AND_A"],
        "target_schema": {
            "source_of_moat": "Primary source of competitive advantage.",
            "pricing_power_indicators": "Evidence of pricing power or margin protection.",
            "market_share_trends": "Observed market share trends.",
            "threat_of_substitutes": "Assessment of industry threats and substitutes."
        }
    },
    "risk_analysis": {
        "queries": ["risk factors regulatory competition", "key risks challenges"],
        "section_filters": ["RISK_FACTORS", "MD_AND_A"],
        "target_schema": {
            "regulatory_risks": "Key regulatory or compliance risks.",
            "operational_risks": "Operational or execution risks.",
            "macro_economic_risks": "Macroeconomic or external industry risks.",
            "mitigation_strategies": "Actions taken by management to mitigate risks."
        }
    },
    "segment_analysis": {
        "queries": ["segment revenue EBITDA performance", "business segment breakdown"],
        "section_filters": ["SEGMENT_PERFORMANCE"],
        "target_schema": {
            "segmental_revenue_ebitda": "Breakdown of segmental revenue and EBITDA.",
            "growth_engines": "Segments driving the overall corporate growth.",
            "underperforming_segments": "Segments experiencing headwinds or decline."
        }
    },
    "earnings_quality": {
        "queries": ["cash flow from operations working capital", "accruals receivables"],
        "section_filters": ["CASH_FLOW", "MD_AND_A"],
        "target_schema": {
            "cash_flow_sustainability": "Sustainability of operating cash flows.",
            "accruals_and_working_capital": "Analysis of working capital build or release.",
            "accounting_policy_consistency": "Assessment of accounting policies and disclosures."
        }
    },
    "guidance_accuracy": {
        "queries": ["guidance targets we expect we aim", "outlook forecast"],
        "section_filters": ["MD_AND_A", "MANAGEMENT_COMMENTARY"],
        "target_schema": {
            "guidance_statements_made": "Specific guidance statements identified in the text.",
            "historical_achievement_rate": "Assessment of management's target achievement rate.",
            "guidance_deviations_explanations": "Explanations provided for deviations from guidance."
        }
    }
}

INSTITUTIONAL_ANALYST_SYSTEM_PROMPT = """
You are a senior equity research analyst writing for institutional investors.

Non-negotiable rules:
1. Every claim must reference specific numbers or quotes from the provided context.
2. If context does not contain information to answer a section, say "INSUFFICIENT_DATA" for that field.
3. Never use buzzwords: "robust", "synergies", "well-positioned", "headwinds", "tailwinds".
4. Write in active voice. Be direct. Hedge only when genuinely uncertain.
5. Identify contradictions. If management says margins will improve but the numbers show compression, flag it.
6. Return ONLY valid JSON. No markdown, no preamble, no backticks.
"""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=60))
async def call_gemini_with_retry(prompt: str, max_tokens: int = 2000) -> str:
    """
    Calls Gemini model with retry and fallback mechanics.
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
            logger.warning(f"Failed to query Gemini model {model_name} in RAG engine: {e}")
            continue
    raise Exception("All Gemini models failed in call_gemini_with_retry.")

def parse_json_response(response_text: str) -> dict:
    """
    Safely parses JSON text or uses regex extraction.
    """
    try:
        return json.loads(response_text)
    except Exception as e:
        logger.warning(f"Failed direct JSON load of Gemini response in RAG: {e}")
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return {}

async def run_rag_analysis_for_section(
    ticker: str,
    section_key: str,
    quant_scores: dict = None
) -> dict:
    """
    Retrieves chunks, combines with quant scores, prompts Gemini, and returns structured analysis.
    """
    if section_key not in ANALYSIS_SECTIONS:
        raise ValueError(f"Unknown section key: {section_key}")

    section_info = ANALYSIS_SECTIONS[section_key]
    queries = section_info["queries"]
    section_filters = section_info["section_filters"]
    target_schema = section_info["target_schema"]

    # 1. Retrieve top-8 chunks from ChromaDB for each query
    all_chunks = []
    for query in queries:
        chunks = await retrieve_chunks(
            ticker=ticker,
            query=query,
            n_results=8,
            section_type_filter=section_filters
        )
        all_chunks.extend(chunks)

    # 2. Deduplicate chunks
    seen_ids = set()
    unique_chunks = []
    for c in all_chunks:
        cid = c["metadata"].get("chunk_index")
        doc_id = c["metadata"].get("document_id")
        unique_key = (doc_id, cid)
        if unique_key not in seen_ids:
            seen_ids.add(unique_key)
            unique_chunks.append(c)

    # limit context to top 15 unique chunks
    context = "\n\n---\n\n".join([c["content"] for c in unique_chunks[:15]])

    # 3. Format pre-computed quantitative data
    quant_summary = "No quantitative scores provided."
    if quant_scores:
        quant_summary = json.dumps(quant_scores, indent=2)

    # 4. Build prompt
    prompt = f"""
{INSTITUTIONAL_ANALYST_SYSTEM_PROMPT}

SECTION-SPECIFIC ANALYSIS TASK:
You are analyzing the {section_key.upper().replace('_', ' ')} section for {ticker}.

PRE-COMPUTED QUANTITATIVE SCORES:
{quant_summary}

DOCUMENT EXCERPTS:
{context}

Your task: Produce an analysis matching this exact JSON schema:
{json.dumps(target_schema, indent=2)}

Ensure every field contains specific numerical or textual evidence from the excerpts. If evidence is lacking, set the field to "INSUFFICIENT_DATA". Do not use disallowed buzzwords.
"""

    # 5. Call Gemini
    response_text = await call_gemini_with_retry(prompt)
    
    # 6. Parse response
    parsed = parse_json_response(response_text)
    
    # Ensure all target keys are present in result
    for key in target_schema.keys():
        if key not in parsed:
            parsed[key] = "INSUFFICIENT_DATA"
            
    return parsed
