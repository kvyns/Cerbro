import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from auth import get_current_user  # noqa: E402
from database import get_db  # noqa: E402

router = APIRouter(prefix="/api/projects", tags=["projects"])
CurrentUser = Annotated[dict, Depends(get_current_user)]


def generate_prefix(name: str) -> str:
    """Turn a project name into a short uppercase cert-ID prefix.

    "Design Competition 2026" → "DC2026"
    "Monochrome Club"         → "MC2026"
    "Annual Tech Fest"        → "ATF2026"
    """
    words = re.split(r"\s+", name.strip())
    year = ""
    filtered = []
    for w in words:
        if re.match(r"^\d{4}$", w):
            year = w
        else:
            filtered.append(w)
    if not filtered:
        filtered = words
    initials = "".join(w[0].upper() for w in filtered if w and w[0].isalpha())[:6]
    if not initials:
        initials = re.sub(r"[^A-Z0-9]", "", name.upper())[:6]
    if not year:
        year = str(datetime.now(timezone.utc).year)
    return (initials + year) if initials else f"CERT{year}"


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


@router.post("/")
async def create_project(body: ProjectCreate, current_user: CurrentUser):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Project name is required")

    db = get_db()
    prefix = generate_prefix(body.name)

    # Make prefix unique per user
    count = await db.projects.count_documents(
        {"prefix": {"$regex": f"^{re.escape(prefix)}"}, "created_by_uid": current_user["uid"]}
    )
    if count > 0:
        prefix = f"{prefix}{count + 1}"

    doc = {
        "project_id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "description": body.description.strip(),
        "prefix": prefix,
        "created_by_uid": current_user["uid"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/")
async def list_projects(current_user: CurrentUser):
    db = get_db()
    cursor = db.projects.find({"created_by_uid": current_user["uid"]}, {"_id": 0}).sort("created_at", -1)
    projects = await cursor.to_list(length=100)
    # Attach certificate count to each project
    for p in projects:
        p["cert_count"] = await db.certificates.count_documents(
            {"project_id": p["project_id"], "issued_by_uid": current_user["uid"]}
        )
    return projects


@router.delete("/{project_id}")
async def delete_project(project_id: str, current_user: CurrentUser):
    db = get_db()
    result = await db.projects.delete_one(
        {"project_id": project_id, "created_by_uid": current_user["uid"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted"}
