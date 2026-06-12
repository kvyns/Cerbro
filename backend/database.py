import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        url = os.environ.get("MONGODB_URL")
        if not url:
            raise RuntimeError("MONGODB_URL environment variable is not set")
        _client = AsyncIOMotorClient(url)
    return _client


def get_db():
    db_name = os.environ.get("MONGODB_DB")
    if not db_name:
        raise RuntimeError("MONGODB_DB environment variable is not set")
    return get_client()[db_name]


async def close_client():
    global _client
    if _client:
        _client.close()
        _client = None
