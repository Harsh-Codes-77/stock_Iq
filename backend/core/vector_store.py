import chromadb
from chromadb.config import Settings as ChromaSettings
from loguru import logger

_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path="./chroma_db",
            settings=ChromaSettings(anonymized_telemetry=False)
        )
    return _client

def get_or_create_collection(name: str):
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"}
    )
