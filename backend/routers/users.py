import asyncio
import csv
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from auth import get_current_user  # noqa: E402

router = APIRouter(prefix="/api/users", tags=["users"])
CurrentUser = Annotated[dict, Depends(get_current_user)]

INITIAL_CREDITS = 10


def _fs():
    from firebase_admin import firestore
    return firestore.client()


def _get_or_create_sync(uid: str, email: str = "") -> dict:
    from firebase_admin import firestore as fs_module
    db = _fs()
    ref = db.collection("users").document(uid)
    snap = ref.get()
    if snap.exists:
        return snap.to_dict()
    data = {"uid": uid, "email": email, "credits": INITIAL_CREDITS, "total_issued": 0}
    ref.set(data)
    return data


def _deduct_sync(uid: str, amount: int) -> dict:
    from firebase_admin import firestore as fs_module

    db = _fs()
    ref = db.collection("users").document(uid)

    @fs_module.transactional
    def _txn(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            if INITIAL_CREDITS < amount:
                raise ValueError(
                    f"Insufficient credits. Account starts with {INITIAL_CREDITS} but need {amount}."
                )
            data = {"uid": uid, "credits": INITIAL_CREDITS - amount, "total_issued": amount, "email": ""}
            transaction.set(ref, data)
            return data
        d = snap.to_dict()
        bal = d.get("credits", 0)
        if bal < amount:
            raise ValueError(
                f"Insufficient credits. You have {bal} credit{'s' if bal != 1 else ''} but need {amount}."
            )
        transaction.update(ref, {
            "credits": fs_module.Increment(-amount),
            "total_issued": fs_module.Increment(amount),
        })
        d["credits"] = bal - amount
        return d

    txn = db.transaction()
    return _txn(txn)


async def _run(fn, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fn, *args)


async def deduct_credits(uid: str, amount: int = 1) -> dict:
    try:
        return await _run(_deduct_sync, uid, amount)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: CurrentUser):
    try:
        return await _run(_get_or_create_sync, current_user["uid"], current_user.get("email", ""))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Firestore error: {exc}. Make sure Firestore is enabled in your Firebase project.")


@router.get("/me/export")
async def export_account_data(current_user: CurrentUser):
    uid = current_user["uid"]
    from database import get_db
    db = get_db()

    certs = await db.certificates.find(
        {"issued_by_uid": uid}, {"_id": 0, "issued_by_uid": 0}
    ).sort("timestamp_utc", -1).to_list(length=10_000)

    projects = await db.projects.find(
        {"created_by_uid": uid}, {"_id": 0, "created_by_uid": 0}
    ).to_list(length=1_000)

    # ── certificates.csv ──────────────────────────────────────────────────────
    CERT_FIELDS = [
        "certificate_id", "name", "event", "organizer", "entry_number",
        "mobile_number", "email", "hall", "position", "timestamp_utc",
        "verification_url", "project_id", "has_pdf",
    ]
    csv_buf = io.StringIO()
    writer = csv.DictWriter(csv_buf, fieldnames=CERT_FIELDS, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for c in certs:
        writer.writerow({f: c.get(f, "") for f in CERT_FIELDS})

    # ── projects.json ─────────────────────────────────────────────────────────
    projects_json = json.dumps(projects, indent=2, default=str).encode()

    # ── account.json ──────────────────────────────────────────────────────────
    try:
        fs_doc = await _run(_get_or_create_sync, uid, current_user.get("email", ""))
    except Exception:
        fs_doc = {}
    account_info = {
        "uid": uid,
        "email": current_user.get("email", ""),
        "credits": fs_doc.get("credits", 0),
        "total_issued": fs_doc.get("total_issued", 0),
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    account_json = json.dumps(account_info, indent=2).encode()

    # ── zip ───────────────────────────────────────────────────────────────────
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("certificates.csv", csv_buf.getvalue().encode("utf-8-sig"))
        zf.writestr("projects.json", projects_json)
        zf.writestr("account.json", account_json)
    zip_buf.seek(0)

    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=zip_buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=cerbro-export-{date_str}.zip"},
    )


class AddCreditsBody(BaseModel):
    amount: int


@router.delete("/me")
async def delete_account(current_user: CurrentUser):
    uid = current_user["uid"]
    # Delete all MongoDB data
    from database import get_db
    db = get_db()
    await db.certificates.delete_many({"issued_by_uid": uid})
    await db.projects.delete_many({"created_by_uid": uid})
    # Delete Firestore user doc
    def _delete_fs():
        _fs().collection("users").document(uid).delete()
    try:
        await _run(_delete_fs)
    except Exception:
        pass  # Don't block account deletion if Firestore call fails
    return {"deleted": True}


@router.post("/me/credits/add")
async def add_credits(body: AddCreditsBody, current_user: CurrentUser):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    def _add():
        from firebase_admin import firestore as fs_module
        db = _fs()
        ref = db.collection("users").document(current_user["uid"])
        snap = ref.get()
        if not snap.exists:
            ref.set({"uid": current_user["uid"], "email": current_user.get("email", ""),
                     "credits": INITIAL_CREDITS + body.amount, "total_issued": 0})
        else:
            ref.update({"credits": fs_module.Increment(body.amount)})
        return ref.get().to_dict()

    try:
        return await _run(_add)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Firestore error: {exc}")
