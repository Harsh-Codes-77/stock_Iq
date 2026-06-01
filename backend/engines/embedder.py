"""
Embedding + ChromaDB Storage Engine

Uses Google Gemini's text-embedding-004 model.
Stores chunks in ChromaDB with metadata for filtered retrieval.

Collection naming: stockiq_{ticker_lowercase}
  e.g. stockiq_reliance, stockiq_tcs
"""

import asyncio

import google.generativeai as genai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from ..core.vector_store import get_or_create_collection
from ..core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=60))
async def embed_text(text: str) -> list[float]:
    """Embed a single text string using Gemini text-embedding-004 with fallback."""
    for model_name in ["models/text-embedding-004", "models/gemini-embedding-2"]:
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=model_name,
                content=text,
                task_type="retrieval_document",
            )
            return result["embedding"]
        except Exception as e:
            err_msg = str(e).lower()
            if "not found" in err_msg or "404" in err_msg or "not supported" in err_msg:
                logger.warning(f"Embedding model {model_name} not found or unsupported, trying fallback...")
                continue
            logger.error(f"Embedding failed for model {model_name}: {e}")
            raise
    raise Exception("All embedding models failed.")

async def store_chunks_in_vector_db(
    ticker: str,
    document_id: int,
    document_type: str,
    fiscal_year: int | None,
    chunks: list
) -> int:
    """
    Embed all chunks and store in ChromaDB.
    Returns number of chunks stored.
    """
    collection_name = f"stockiq_{ticker.lower()}"
    collection = get_or_create_collection(collection_name)

    stored_count = 0

    for chunk in chunks:
        try:
            chroma_id = f"{ticker}_{document_id}_{chunk.chunk_index if hasattr(chunk, 'chunk_index') else chunk.get('chunk_index', 0)}"
            content = chunk.content if hasattr(chunk, 'content') else chunk.get('content', '')
            section_type = chunk.section_type if hasattr(chunk, 'section_type') else chunk.get('section_type', 'GENERAL')

            embedding = await embed_text(content)

            collection.add(
                ids=[chroma_id],
                embeddings=[embedding],
                documents=[content],
                metadatas=[{
                    "ticker": ticker,
                    "document_id": document_id,
                    "document_type": document_type,
                    "fiscal_year": fiscal_year or 0,
                    "section_type": section_type,
                    "section_title": chunk.section_title if hasattr(chunk, 'section_title') else chunk.get('section_title', ''),
                    "chunk_index": chunk.chunk_index if hasattr(chunk, 'chunk_index') else chunk.get('chunk_index', 0),
                    "token_estimate": chunk.token_estimate if hasattr(chunk, 'token_estimate') else chunk.get('token_estimate', 0),
                }]
            )
            stored_count += 1

        except Exception as e:
            logger.warning(f"Failed to store chunk {chunk.chunk_index if hasattr(chunk, 'chunk_index') else chunk.get('chunk_index', '?') if isinstance(chunk, dict) else '?'}: {e}")

    logger.info(f"Stored {stored_count}/{len(chunks)} chunks for {ticker} doc {document_id}")
    return stored_count

async def retrieve_chunks(
    ticker: str,
    query: str,
    n_results: int = 8,
    section_type_filter: str | list[str] = None,
    document_type_filter: str | list[str] = None,
    fiscal_year_filter: int = None
) -> list[dict]:
    """
    Retrieve top-k relevant chunks for a query.
    Apply optional filters for section type, document type, fiscal year.
    """
    collection_name = f"stockiq_{ticker.lower()}"

    try:
        collection = get_or_create_collection(collection_name)
    except Exception:
        return []

    # Build where filter
    where_conditions = []
    if section_type_filter:
        if isinstance(section_type_filter, list):
            where_conditions.append({"section_type": {"$in": section_type_filter}})
        else:
            where_conditions.append({"section_type": {"$eq": section_type_filter}})
    if document_type_filter:
        if isinstance(document_type_filter, list):
            where_conditions.append({"document_type": {"$in": document_type_filter}})
        else:
            where_conditions.append({"document_type": {"$eq": document_type_filter}})
    if fiscal_year_filter:
        where_conditions.append({"fiscal_year": {"$eq": fiscal_year_filter}})

    where = None
    if len(where_conditions) == 1:
        where = where_conditions[0]
    elif len(where_conditions) > 1:
        where = {"$and": where_conditions}

    # Embed the query
    try:
        query_embedding = await embed_text_query(query)
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return []

    count = collection.count()
    if count == 0:
        return []

    kwargs = {
        "query_embeddings": [query_embedding],
        "n_results": min(n_results, count),
        "include": ["documents", "metadatas", "distances"]
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    chunks = []
    if results and "documents" in results and results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            chunks.append({
                "content": doc,
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
                "relevance_score": 1 - results["distances"][0][i]
            })

    return chunks

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=4, max=60))
async def embed_text_query(text: str) -> list[float]:
    """Embed a query string (different task_type from document embedding)."""
    for model_name in ["models/text-embedding-004", "models/gemini-embedding-2"]:
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=model_name,
                content=text,
                task_type="retrieval_query",
            )
            return result["embedding"]
        except Exception as e:
            err_msg = str(e).lower()
            if "not found" in err_msg or "404" in err_msg or "not supported" in err_msg:
                logger.warning(f"Embedding model {model_name} not found or unsupported, trying fallback...")
                continue
            logger.error(f"Query embedding failed for model {model_name}: {e}")
            raise
    raise Exception("All query embedding models failed.")
