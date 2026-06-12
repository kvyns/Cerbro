import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env")

from auth import init_firebase
from database import close_client
from routers.certificates import router as certificates_router
from routers.projects import router as projects_router
from routers.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    yield
    await close_client()


app = FastAPI(title="GC Certificate API", lifespan=lifespan)

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Certificate-ID", "X-Verification-URL"],
)

app.include_router(certificates_router)
app.include_router(projects_router)
app.include_router(users_router)


@app.get("/")
def root():
    return {"message": "GC Certificate API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
