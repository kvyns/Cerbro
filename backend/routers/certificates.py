import csv
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from generate_secure_overlays import (  # noqa: E402
    QR_SIZE, QR_X, QR_Y,
    ID_FONT, ID_FONT_SIZE, ID_TEXT_PREFIX, ID_X, ID_Y,
    build_certificate_id, build_signature_payload, build_verification_url,
    create_overlay_pdf, make_qr_image, merge_overlay, sign_payload, utc_iso_timestamp,
)

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from auth import get_current_user  # noqa: E402
from database import get_db  # noqa: E402
from routers.users import deduct_credits  # noqa: E402

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

CurrentUser = Annotated[dict, Depends(get_current_user)]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


@router.post("/issue")
async def issue_certificate(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    name: str = Form(...),
    event: str = Form(...),
    template_pdf: Optional[UploadFile] = None,
    organizer: str = Form(""),
    entry_number: str = Form(""),
    mobile_number: str = Form(""),
    email: str = Form(""),
    hall: str = Form(""),
    position: str = Form(""),
    extra_fields: str = Form(""),
    project_id: str = Form(""),
):
    secret_key = _env("CERT_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=500, detail="CERT_SECRET_KEY not configured")

    verify_base_url = _env("CERT_VERIFY_BASE_URL", "https://cerbro.vercel.app/verify")
    key_id = _env("CERT_KEY_ID", "K1")
    id_prefix = _env("CERT_ID_PREFIX", "GC2026")

    # Use project prefix if a project is selected
    if project_id:
        db = get_db()
        proj = await db.projects.find_one(
            {"project_id": project_id, "created_by_uid": current_user["uid"]}, {"_id": 0}
        )
        if proj:
            id_prefix = proj["prefix"]

    # Parse extra_fields JSON
    parsed_extra: dict = {}
    if extra_fields.strip():
        try:
            parsed_extra = json.loads(extra_fields)
            if not isinstance(parsed_extra, dict):
                raise ValueError
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="extra_fields must be a JSON object")

    cert_id = build_certificate_id(id_prefix)
    ts = utc_iso_timestamp()
    payload = build_signature_payload(cert_id, ts, key_id, name, event)
    sig = sign_payload(payload, secret_key)
    url = build_verification_url(verify_base_url, cert_id, ts, key_id, sig)

    doc = {
        "certificate_id": cert_id,
        "timestamp_utc": ts,
        "key_id": key_id,
        "name": name,
        "event": event,
        "organizer": organizer,
        "entry_number": entry_number,
        "mobile_number": mobile_number,
        "email": email,
        "hall": hall,
        "position": position,
        "extra_fields": parsed_extra,
        "verification_url": url,
        "signature": sig,
        "issued_by_uid": current_user.get("uid"),
        "issued_by_email": current_user.get("email"),
        "project_id": project_id or None,
        "has_pdf": False,
    }

    # Deduct 1 credit before doing any work
    await deduct_credits(current_user["uid"], 1)

    # Generate PDF only if template was uploaded
    if template_pdf and template_pdf.filename:
        suffix = Path(template_pdf.filename).suffix or ".pdf"
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp_in.write(await template_pdf.read())
            tmp_in.flush()
            tmp_in.close()
            tmp_out.close()

            source_pdf = Path(tmp_in.name)
            output_pdf = Path(tmp_out.name)

            from pypdf import PdfReader

            reader = PdfReader(str(source_pdf))
            if not reader.pages:
                raise HTTPException(status_code=400, detail="Uploaded PDF has no pages")
            page = reader.pages[0]
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)

            qr_img = make_qr_image(url)
            overlay = create_overlay_pdf(
                page_width=page_w, page_height=page_h,
                qr_image=qr_img,
                qr_x=QR_X, qr_y=QR_Y, qr_size=QR_SIZE,
                id_x=ID_X, id_y=ID_Y,
                cert_id=cert_id, id_font=ID_FONT,
                id_font_size=ID_FONT_SIZE, text_prefix=ID_TEXT_PREFIX,
            )
            merge_overlay(source_pdf, overlay, output_pdf)

            doc["has_pdf"] = True
            db = get_db()
            await db.certificates.insert_one({**doc})

            background_tasks.add_task(os.unlink, tmp_in.name)
            background_tasks.add_task(os.unlink, tmp_out.name)

            return FileResponse(
                path=str(output_pdf),
                media_type="application/pdf",
                filename=f"{cert_id}.pdf",
                headers={"X-Certificate-ID": cert_id, "X-Verification-URL": url},
            )

        except HTTPException:
            _cleanup(tmp_in.name, tmp_out.name)
            raise
        except Exception as exc:
            _cleanup(tmp_in.name, tmp_out.name)
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    # No template — save record and return JSON
    db = get_db()
    await db.certificates.insert_one({**doc})
    return JSONResponse(
        content={k: v for k, v in doc.items() if k != "issued_by_uid"},
        headers={"X-Certificate-ID": cert_id, "X-Verification-URL": url},
    )


def _cleanup(*paths: str):
    for p in paths:
        try:
            os.unlink(p)
        except OSError:
            pass


@router.post("/bulk-issue")
async def bulk_issue_certificates(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    event: str = Form(...),
    recipients_csv: UploadFile = File(...),
    template_pdf: Optional[UploadFile] = None,
    organizer: str = Form(""),
    hall: str = Form(""),
    extra_fields: str = Form(""),
    project_id: str = Form(""),
):
    secret_key = _env("CERT_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=500, detail="CERT_SECRET_KEY not configured")

    verify_base_url = _env("CERT_VERIFY_BASE_URL", "https://cerbro.vercel.app/verify")
    key_id = _env("CERT_KEY_ID", "K1")
    id_prefix = _env("CERT_ID_PREFIX", "GC2026")

    if project_id:
        db = get_db()
        proj = await db.projects.find_one(
            {"project_id": project_id, "created_by_uid": current_user["uid"]}, {"_id": 0}
        )
        if proj:
            id_prefix = proj["prefix"]

    # Parse shared extra_fields
    parsed_extra: dict = {}
    if extra_fields.strip():
        try:
            parsed_extra = json.loads(extra_fields)
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="extra_fields must be a JSON object")

    # Parse CSV (supports UTF-8 BOM from Excel)
    raw = await recipients_csv.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    # Normalise header keys: lowercase, spaces→underscore
    rows = []
    for row in reader:
        normalised = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()}
        rows.append(normalised)

    valid_rows = [r for r in rows if r.get("name", "").strip()]
    if not valid_rows:
        raise HTTPException(status_code=400, detail="No valid recipients found. CSV must have a 'name' column.")

    # ── Credit pre-check ────────────────────────────────────────────────────────
    # Read balance NOW before doing any heavy work. If insufficient, bail out fast.
    needed = len(valid_rows)
    from routers.users import _get_or_create_sync, INITIAL_CREDITS  # noqa: E402
    import asyncio as _asyncio
    user_doc = await _asyncio.get_running_loop().run_in_executor(
        None, _get_or_create_sync, current_user["uid"], current_user.get("email", "")
    )
    available = user_doc.get("credits", 0)
    if available < needed:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough credits. You need {needed} (1 per certificate) but your account has {available}. Top up from the Dashboard.",
        )

    # Build certificate docs
    docs = []
    for row in valid_rows:
        name = row["name"]
        cert_id = build_certificate_id(id_prefix)
        ts = utc_iso_timestamp()
        payload = build_signature_payload(cert_id, ts, key_id, name, event)
        sig = sign_payload(payload, secret_key)
        url = build_verification_url(verify_base_url, cert_id, ts, key_id, sig)

        doc = {
            "certificate_id": cert_id,
            "timestamp_utc": ts,
            "key_id": key_id,
            "name": name,
            "event": event,
            "organizer": row.get("organizer", organizer) or organizer,
            "entry_number": row.get("entry_number", ""),
            "mobile_number": row.get("mobile_number", ""),
            "email": row.get("email", ""),
            "hall": row.get("hall", hall) or hall,
            "position": row.get("position", ""),
            "extra_fields": parsed_extra,
            "verification_url": url,
            "signature": sig,
            "issued_by_uid": current_user.get("uid"),
            "issued_by_email": current_user.get("email"),
            "project_id": project_id or None,
            "has_pdf": False,
        }
        docs.append(doc)

    # Deduct credits atomically before saving (1 per certificate)
    await deduct_credits(current_user["uid"], len(docs))

    # Save all records to DB
    db = get_db()
    await db.certificates.insert_many([{**d} for d in docs])

    # If template PDF provided — generate overlaid PDFs and return as ZIP
    if template_pdf and template_pdf.filename:
        from pypdf import PdfReader

        suffix = Path(template_pdf.filename).suffix or ".pdf"
        tmp_template = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            tmp_template.write(await template_pdf.read())
            tmp_template.flush()
            tmp_template.close()

            source_pdf = Path(tmp_template.name)
            reader_pdf = PdfReader(str(source_pdf))
            if not reader_pdf.pages:
                raise HTTPException(status_code=400, detail="Uploaded PDF has no pages")
            page = reader_pdf.pages[0]
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)

            tmp_pdfs = []
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for doc in docs:
                    tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                    tmp_out.close()
                    out_path = Path(tmp_out.name)
                    tmp_pdfs.append(str(out_path))
                    try:
                        qr_img = make_qr_image(doc["verification_url"])
                        overlay = create_overlay_pdf(
                            page_width=page_w, page_height=page_h,
                            qr_image=qr_img,
                            qr_x=QR_X, qr_y=QR_Y, qr_size=QR_SIZE,
                            id_x=ID_X, id_y=ID_Y,
                            cert_id=doc["certificate_id"], id_font=ID_FONT,
                            id_font_size=ID_FONT_SIZE, text_prefix=ID_TEXT_PREFIX,
                        )
                        merge_overlay(source_pdf, overlay, out_path)
                        zf.write(str(out_path), f"{doc['certificate_id']}.pdf")
                    except Exception:
                        pass

            for p in tmp_pdfs:
                background_tasks.add_task(_cleanup, p)
            background_tasks.add_task(_cleanup, tmp_template.name)

            # Mark has_pdf=True in DB
            ids = [d["certificate_id"] for d in docs]
            await db.certificates.update_many(
                {"certificate_id": {"$in": ids}},
                {"$set": {"has_pdf": True}},
            )

            zip_buf.seek(0)
            return Response(
                content=zip_buf.getvalue(),
                media_type="application/zip",
                headers={"Content-Disposition": "attachment; filename=certificates-bulk.zip"},
            )
        except HTTPException:
            _cleanup(tmp_template.name)
            raise
        except Exception as exc:
            _cleanup(tmp_template.name)
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    # No template — return JSON metadata so frontend can render canvas PDFs
    return JSONResponse(content=[
        {k: v for k, v in d.items() if k != "issued_by_uid"}
        for d in docs
    ])


@router.get("/verify")
async def verify_certificate(id: str, ts: str, sig: str, kid: str = "K1"):
    """Public endpoint — no auth required. Called by the frontend verifier."""
    secret_key = _env("CERT_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=500, detail="CERT_SECRET_KEY not configured")

    db = get_db()
    doc = await db.certificates.find_one({"certificate_id": id}, {"_id": 0})

    if not doc:
        return {"status": "NOT_FOUND"}

    # Recompute expected signature from stored payload
    stored_payload = doc.get("payload") or build_signature_payload(
        id, ts, doc.get("key_id", kid), doc.get("name", ""), doc.get("event", "")
    )
    expected = sign_payload(stored_payload, secret_key)

    import hmac as _hmac
    if not _hmac.compare_digest(expected, sig):
        return {"status": "INVALID"}

    return {
        "status": "VALID",
        "data": {
            "certificate_id": doc.get("certificate_id"),
            "name": doc.get("name"),
            "event": doc.get("event"),
            "organizer": doc.get("organizer"),
            "entry_number": doc.get("entry_number"),
            "mobile_number": doc.get("mobile_number"),
            "email": doc.get("email"),
            "hall": doc.get("hall"),
            "position": doc.get("position"),
            "timestamp_utc": doc.get("timestamp_utc"),
            "key_id": doc.get("key_id"),
            "verification_url": doc.get("verification_url"),
            "extra_fields": doc.get("extra_fields", {}),
        },
    }


@router.get("/")
async def list_certificates(current_user: CurrentUser):
    db = get_db()
    cursor = (
        db.certificates.find({"issued_by_uid": current_user["uid"]}, {"_id": 0})
        .sort("timestamp_utc", -1)
        .limit(100)
    )
    return await cursor.to_list(length=100)


@router.get("/{certificate_id}")
async def get_certificate(certificate_id: str, current_user: CurrentUser):
    db = get_db()
    doc = await db.certificates.find_one(
        {"certificate_id": certificate_id, "issued_by_uid": current_user["uid"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return doc
