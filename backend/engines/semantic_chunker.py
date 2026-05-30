"""
Semantic Chunker

Splits extracted PDF content into meaningful chunks based on document structure.

Rules:
- Chunk on detected headings (not random character count)
- Each chunk = one logical section
- Target: 400–600 tokens per chunk
- Never split a table across chunks
- Label each chunk with section_type

Section types recognized:
- MD_AND_A (Management Discussion & Analysis)
- FINANCIAL_STATEMENTS
- CASH_FLOW
- BALANCE_SHEET
- PROFIT_AND_LOSS
- NOTES_TO_ACCOUNTS
- SEGMENT_PERFORMANCE
- BUSINESS_OVERVIEW
- RISK_FACTORS
- MANAGEMENT_COMMENTARY
- CORPORATE_GOVERNANCE
- CHAIRPERSON_LETTER
- GENERAL
"""

import re
from dataclasses import dataclass

SECTION_TYPE_PATTERNS = {
    "MD_AND_A": [r"management\s*(discussion|review)", r"md\s*&?\s*a"],
    "FINANCIAL_STATEMENTS": [r"financial\s*result", r"financial\s*statement", r"audited\s*financial\s*results", r"statement\s*of\s*financial\s*results"],
    "CASH_FLOW": [r"cash\s*flow", r"statement\s*of\s*cash"],
    "BALANCE_SHEET": [r"balance\s*sheet", r"statement\s*of\s*financial\s*position"],
    "PROFIT_AND_LOSS": [r"profit\s*(and|&|or)\s*loss", r"income\s*statement", r"p\s*&\s*l"],
    "NOTES_TO_ACCOUNTS": [r"notes\s*to\s*(the\s*)?(financial\s*)?accounts"],
    "SEGMENT_PERFORMANCE": [r"segment\s*(performance|report|revenue|result)"],
    "BUSINESS_OVERVIEW": [r"business\s*overview", r"company\s*overview", r"about\s*(the\s*)?company"],
    "RISK_FACTORS": [r"risk\s*factor", r"key\s*risk"],
    "MANAGEMENT_COMMENTARY": [r"management\s*comment", r"chairman\s*(message|letter|speech)"],
    "CORPORATE_GOVERNANCE": [r"corporate\s*governance"],
    "CHAIRPERSON_LETTER": [r"chairman\s*letter", r"dear\s*shareholder"],
}

APPROX_TOKENS_PER_WORD = 1.3
TARGET_TOKENS = 500
MAX_TOKENS = 700

@dataclass
class Chunk:
    chunk_index: int
    section_type: str
    section_title: str
    content: str
    token_estimate: int
    source_pages: list[int]

def chunk_document(extracted_pages: list, document_type: str) -> list[Chunk]:
    """
    Produce semantic chunks from extracted pages.
    Groups pages by detected section headings.
    """
    chunks = []
    current_section_type = "GENERAL"
    current_section_title = "Document Start"
    current_content = []
    current_pages = []
    chunk_index = 0

    for page in extracted_pages:
        page_text = page.text if hasattr(page, 'text') else page.get('text', '')
        page_num = page.page_number if hasattr(page, 'page_number') else page.get('page_number', 0)

        if not page_text.strip():
            continue

        # Check if this page starts a new section
        for heading in (page.headings if hasattr(page, 'headings') else page.get('headings', [])):
            detected_type = _detect_section_type(heading)
            if detected_type != "GENERAL" and detected_type != current_section_type:
                # Save current chunk before starting new section
                if current_content:
                    chunk = _make_chunk(
                        chunk_index, current_section_type, current_section_title,
                        current_content, current_pages
                    )
                    if chunk:
                        chunks.extend(_split_if_too_large(chunk, chunk_index))
                        chunk_index = len(chunks)

                current_section_type = detected_type
                current_section_title = heading
                current_content = []
                current_pages = []
                break

        current_content.append(page_text)
        current_pages.append(page_num)

        # Force split if we've accumulated too many tokens
        estimated_tokens = sum(len(c.split()) * APPROX_TOKENS_PER_WORD for c in current_content)
        if estimated_tokens > MAX_TOKENS:
            chunk = _make_chunk(
                chunk_index, current_section_type, current_section_title,
                current_content, current_pages
            )
            if chunk:
                chunks.extend(_split_if_too_large(chunk, chunk_index))
                chunk_index = len(chunks)
            current_content = []
            current_pages = []

    # Don't forget the last section
    if current_content:
        chunk = _make_chunk(
            chunk_index, current_section_type, current_section_title,
            current_content, current_pages
        )
        if chunk:
            chunks.extend(_split_if_too_large(chunk, chunk_index))

    return chunks

def _detect_section_type(heading: str) -> str:
    heading_lower = heading.lower()
    for section_type, patterns in SECTION_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, heading_lower):
                return section_type
    return "GENERAL"

def _make_chunk(index, section_type, title, content_list, pages) -> Chunk | None:
    text = "\n\n".join(content_list).strip()
    if len(text) < 50:
        return None
    token_estimate = int(len(text.split()) * APPROX_TOKENS_PER_WORD)
    return Chunk(
        chunk_index=index,
        section_type=section_type,
        section_title=title,
        content=text,
        token_estimate=token_estimate,
        source_pages=pages
    )

def _split_if_too_large(chunk: Chunk, start_index: int) -> list[Chunk]:
    """Split a chunk that's over MAX_TOKENS into smaller pieces."""
    words = chunk.content.split()
    target_words = int(TARGET_TOKENS / APPROX_TOKENS_PER_WORD)

    if len(words) <= target_words * 1.5:
        chunk.chunk_index = start_index
        return [chunk]

    sub_chunks = []
    for i in range(0, len(words), target_words):
        sub_words = words[i:i + target_words]
        if len(sub_words) < 30:
            continue
        sub_chunks.append(Chunk(
            chunk_index=start_index + len(sub_chunks),
            section_type=chunk.section_type,
            section_title=chunk.section_title,
            content=" ".join(sub_words),
            token_estimate=int(len(sub_words) * APPROX_TOKENS_PER_WORD),
            source_pages=chunk.source_pages
        ))

    return sub_chunks if sub_chunks else [chunk]
