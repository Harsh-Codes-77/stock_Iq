import json
import redis.asyncio as redis
try:
    from core.config import settings
except ImportError:
    from .config import settings
from loguru import logger

_client = None

async def get_redis():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client

async def cache_get(key: str) -> dict | None:
    try:
        r = await get_redis()
        data = await r.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        logger.warning(f"Cache GET failed for {key}: {e}")
        return None

async def cache_set(key: str, value: dict, ttl: int = None) -> None:
    try:
        r = await get_redis()
        ttl = ttl or settings.CACHE_TTL_SECONDS
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache SET failed for {key}: {e}")
