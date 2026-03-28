import hashlib
import json

from app.core.redis import get_redis


async def get_cache(key: str) -> dict | None:
    redis = await get_redis()
    data = await redis.get(key)
    if data:
        try:
            return json.loads(data)
        except Exception:
            return None
    return None


async def set_cache(key: str, value: dict, ttl: int = 60) -> None:
    redis = await get_redis()
    try:
        await redis.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass


async def invalidate_cache(pattern: str) -> None:
    redis = await get_redis()
    try:
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
    except Exception:
        pass


def make_cache_key(prefix: str, params: dict) -> str:
    sorted_params = json.dumps(params, sort_keys=True, default=str)
    hash_val = hashlib.md5(sorted_params.encode()).hexdigest()
    return f"{prefix}:{hash_val}"
