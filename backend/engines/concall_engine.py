import re
import json
import google.generativeai as genai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.core.config import settings
from backend.engines.embedder import retrieve_chunks

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

CONCALL_ANALYSIS_PROMPT = """
You are analyzing earnings call transcripts for institutional equity research.
You will receive transcript excerpts. Your job is to identify:

1. Specific guidance statements made (quote them exactly, include quarter/year context)
2. Management language quality: direct and specific vs vague and hedged
3. Questions management appeared uncomfortable with (deflection patterns)
4. Repeated excuses (if same excuse appears across multiple quarters, flag it explicitly)
5. Confidence trajectory: is management more or less confident than 4 quarters ago?

Format your output as JSON exactly matching this structure. Do not add any text outside the JSON:
{
    "guidance_statements": [{"quarter": "quarter name", "statement": "exact quote", "metric": "affected metric", "target": "target metric value"}],
    "repeated_excuses": [{"excuse": "excuse description", "appeared_in_quarters": ["Q1FY23", "Q2FY23"]}],
    "avoided_topics": ["topic name 1", "topic name 2"],
    "confidence_trajectory": "DECLINING" | "STABLE" | "IMPROVING",
    "management_credibility_score": 7.2,
    "key_risks_mentioned": ["risk description 1"],
    "key_opportunities_mentioned": ["opportunity description 1"]
}
"""

def detect_heuristics(text: str) -> dict:
    """
    Step A — Rule-based detection (no AI) on concall transcript text:
    Detects guidance statements, excuse patterns, and qualitative confidence score.
    """
    # Split text into sentences/lines
    sentences = re.split(r'[.\n?!]', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
    
    # Heuristics for guidance statements
    guidance_regex = re.compile(
        r"\b(we expect|we guide|guidance of|target of|we forecast|we anticipate|outlook for|expect to achieve|growth target|forecasted to|anticipating)\b",
        re.IGNORECASE
    )
    
    # Heuristics for excuses
    excuse_regex = re.compile(
        r"\b(due to macro|temporary headwinds|one-time|one-off|unprecedented|geopolitical|inflationary|supply chain|seasonality|challenging environment|input cost|macro headwinds|macroeconomic)\b",
        re.IGNORECASE
    )
    
    guidance_statements = []
    excuse_patterns = []
    
    for s in sentences:
        if guidance_regex.search(s):
            guidance_statements.append(s)
        if excuse_regex.search(s):
            excuse_patterns.append(s)
            
    # Calculate confidence indicators
    strong_words = ["confident", "robust", "strong", "resilient", "accelerate", "headroom", "positive", "growth"]
    weak_words = ["uncertain", "difficult", "challenging", "headwinds", "cautious", "unclear", "softness", "slowdown", "pressure"]
    
    strong_count = 0
    weak_count = 0
    
    for w in strong_words:
        strong_count += len(re.findall(r"\b" + re.escape(w) + r"\b", text, re.IGNORECASE))
    for w in weak_words:
        weak_count += len(re.findall(r"\b" + re.escape(w) + r"\b", text, re.IGNORECASE))
        
    if strong_count > 2 * weak_count + 1:
        confidence = "HIGH"
    elif weak_count > strong_count:
        confidence = "LOW"
    else:
        confidence = "MEDIUM"
        
    return {
        "guidance_statements": guidance_statements,
        "excuse_patterns": excuse_patterns,
        "confidence_indicators": confidence
    }

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=60))
async def analyze_concall_with_ai(chunks: list[dict]) -> dict:
    """
    Step B — AI interpretation using Gemini models.
    Converts chunks into prompt context, queries Gemini, and enforces JSON output structure.
    """
    if not chunks:
        logger.warning("No concall transcript chunks provided for AI interpretation.")
        return {
            "guidance_statements": [],
            "repeated_excuses": [],
            "avoided_topics": [],
            "confidence_trajectory": "STABLE",
            "management_credibility_score": 5.0,
            "key_risks_mentioned": [],
            "key_opportunities_mentioned": []
        }
        
    combined_excerpts = "\n\n".join([f"--- Excerpt ---\n{c['content']}" for c in chunks])
    
    prompt = f"""
    System instructions:
    {CONCALL_ANALYSIS_PROMPT}
    
    Here are the earnings call transcript excerpts to analyze:
    {combined_excerpts}
    """
    
    # Try models in order of preference
    for model_name in ["models/gemini-3.1-flash-lite", "models/gemini-1.5-flash", "models/gemini-3.1-flash"]:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            logger.debug(f"Raw Gemini response: {response.text}")
            data = json.loads(response.text)
            
            # Ensure return matches expected structure
            return {
                "guidance_statements": data.get("guidance_statements", []),
                "repeated_excuses": data.get("repeated_excuses", []),
                "avoided_topics": data.get("avoided_topics", []),
                "confidence_trajectory": data.get("confidence_trajectory", "STABLE"),
                "management_credibility_score": float(data.get("management_credibility_score", 5.0)),
                "key_risks_mentioned": data.get("key_risks_mentioned", []),
                "key_opportunities_mentioned": data.get("key_opportunities_mentioned", [])
            }
        except Exception as e:
            logger.warning(f"Failed to generate concall analysis with model {model_name}: {e}")
            continue
            
    raise Exception("All Gemini models failed for Concall AI analysis.")

async def run_concall_engine(ticker: str) -> dict:
    """
    Coordinator function that retrieves chunks, runs Step A heuristics,
    runs Step B AI analysis, and returns the unified result.
    """
    logger.info(f"Running Concall Intelligence Engine for {ticker}...")
    
    # Retrieve concall chunks from ChromaDB
    chunks = await retrieve_chunks(
        ticker=ticker,
        query="management guidance, future outlook, headwinds, supply chain, margins, question answers",
        n_results=20,
        document_type_filter="CONCALL_TRANSCRIPT"
    )
    
    # Deduplicate retrieved chunks
    seen = set()
    unique_chunks = []
    for chunk in chunks:
        content = chunk.get("content", "")
        if content not in seen:
            seen.add(content)
            unique_chunks.append(chunk)
            
    # Combine chunk text for heuristics
    combined_text = "\n\n".join([c["content"] for c in unique_chunks])
    
    # Run Step A
    heuristics_result = detect_heuristics(combined_text)
    
    # Run Step B
    ai_result = await analyze_concall_with_ai(unique_chunks)
    
    # Attach heuristic detection to output (without breaking Step B schema validation)
    # We return the primary JSON schema required, enriched with a 'rule_based_detection' field
    result = {
        "guidance_statements": ai_result.get("guidance_statements", []),
        "repeated_excuses": ai_result.get("repeated_excuses", []),
        "avoided_topics": ai_result.get("avoided_topics", []),
        "confidence_trajectory": ai_result.get("confidence_trajectory", "STABLE"),
        "management_credibility_score": ai_result.get("management_credibility_score", 5.0),
        "key_risks_mentioned": ai_result.get("key_risks_mentioned", []),
        "key_opportunities_mentioned": ai_result.get("key_opportunities_mentioned", []),
        "rule_based_detection": heuristics_result
    }
    
    return result
