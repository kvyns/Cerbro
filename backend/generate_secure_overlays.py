import argparse
import base64
import csv
import hashlib
import hmac
import io
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import qrcode
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# QR Code Position & Size
QR_X = 650.0
QR_Y = 350.0
QR_SIZE = 90.0

# Certificate ID Text Position & Style
ID_X = 325.0
ID_Y = 15.0
ID_FONT = "Helvetica"
ID_FONT_SIZE = 10
ID_TEXT_PREFIX = "ID: "


@dataclass
class Record:
    source_pdf: Path
    output_pdf: Path
    name: str
    event: str
    organizer: str
    entry_number: str
    mobile_number: str
    email: str
    hall: str
    position: str


def load_env_file(env_file: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not env_file.exists():
        return env

    for raw_line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value and ((value[0] == value[-1]) and value[0] in {'"', "'"}):
            value = value[1:-1]
        env[key] = value

    return env


def merged_env(env_file: Path) -> Dict[str, str]:
    env = dict(os.environ)
    env.update(load_env_file(env_file))
    return env


def read_keys_map(env: Dict[str, str], keys_file: Optional[Path]) -> Dict[str, str]:
    keys: Dict[str, str] = {}

    if keys_file:
        if not keys_file.exists():
            raise ValueError(f"keys file not found: {keys_file}")
        loaded = json.loads(keys_file.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict):
            raise ValueError("keys file must contain JSON object: {\"K1\":\"secret\", ...}")
        for k, v in loaded.items():
            keys[str(k)] = str(v)

    keys_json = env.get("CERT_KEYS_JSON", "").strip()
    if keys_json:
        loaded = json.loads(keys_json)
        if not isinstance(loaded, dict):
            raise ValueError("CERT_KEYS_JSON must be JSON object: {\"K1\":\"secret\", ...}")
        for k, v in loaded.items():
            keys[str(k)] = str(v)

    prefix = "CERT_KEY_"
    for key, value in env.items():
        if key.startswith(prefix) and value:
            kid = key[len(prefix) :]
            if kid:
                keys[kid] = value

    return keys


def resolve_run_secret(
    secret_key_arg: Optional[str], key_id: str, env: Dict[str, str], keys_file: Optional[Path]
) -> str:
    if secret_key_arg:
        return secret_key_arg

    if env.get("CERT_SECRET_KEY"):
        return env["CERT_SECRET_KEY"]

    keys_map = read_keys_map(env, keys_file)
    if key_id in keys_map:
        return keys_map[key_id]

    raise ValueError(
        "Secret key not found. Provide --secret-key, set CERT_SECRET_KEY in .env, "
        "or set key-specific secrets (e.g. CERT_KEY_K1=...)."
    )


def utc_iso_timestamp() -> str:
    # Example: 2026-03-26T19:10:32.123456Z
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_certificate_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def build_signature_payload(cert_id: str, timestamp: str, key_id: str, name: str, event: str) -> str:
    return json.dumps(
        {
            "id": cert_id,
            "ts": timestamp,
            "kid": key_id,
            "name": name.strip(),
            "event": event.strip(),
        },
        separators=(",", ":"),
        ensure_ascii=True,
    )


def sign_payload(payload: str, secret_key: str) -> str:
    digest = hmac.new(secret_key.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def build_verification_url(base_url: str, cert_id: str, timestamp: str, key_id: str, signature: str) -> str:
    base = base_url.rstrip("/")
    return f"{base}?id={cert_id}&ts={timestamp}&kid={key_id}&sig={signature}"


def sniff_delimiter(input_csv: Path) -> str:
    sample = input_csv.read_text(encoding="utf-8-sig", errors="ignore")[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        return dialect.delimiter
    except csv.Error:
        return ","


def normalize_row(row: Dict[str, str]) -> Dict[str, str]:
    cleaned: Dict[str, str] = {}
    for key, value in row.items():
        norm_key = (key or "").strip().lower()
        cleaned[norm_key] = (value or "").strip()
    return cleaned


def first_nonempty(row: Dict[str, str], keys: List[str]) -> str:
    for key in keys:
        value = row.get(key, "").strip()
        if value:
            return value
    return ""


def resolve_output_path(output_dir: Path, out_name: str, source_pdf: Path) -> Path:
    if out_name:
        out_path = Path(out_name).expanduser()
        if out_path.is_absolute():
            return out_path.resolve()

        # Avoid output_pdfs/output_pdfs duplication if CSV already includes output dir prefix.
        if out_path.parts and out_path.parts[0].lower() == output_dir.name.lower():
            return (output_dir.parent / out_path).resolve()
        return (output_dir / out_path).resolve()

    return (output_dir / f"{source_pdf.stem}_signed.pdf").resolve()


def parse_csv(input_csv: Path, output_dir: Path, source_pattern: Optional[str]) -> List[Record]:
    records: List[Record] = []
    delimiter = sniff_delimiter(input_csv)

    with input_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)

        for index, raw_row in enumerate(reader, start=2):
            row = normalize_row(raw_row)
            name = first_nonempty(row, ["name"])
            event = first_nonempty(row, ["event", "event_name"])

            if not name or not event:
                raise ValueError(
                    f"Row {index}: missing required name/event data. "
                    "Expected columns like name + event or event_name."
                )

            source_value = first_nonempty(row, ["source_pdf", "pdf", "pdf_path", "source"])
            if not source_value:
                if not source_pattern:
                    raise ValueError(
                        f"Row {index}: source PDF not found. Provide source_pdf column "
                        "or pass --source-pattern."
                    )
                try:
                    source_value = source_pattern.format(**row)
                except KeyError as exc:
                    raise ValueError(
                        f"Row {index}: source pattern uses unknown field {exc}. "
                        "Update --source-pattern placeholders to match CSV headers."
                    ) from exc

            src = Path(source_value).expanduser()
            if not src.is_absolute():
                src = (input_csv.parent / src).resolve()

            out_name = first_nonempty(row, ["output_pdf", "output"])
            out_path = resolve_output_path(output_dir, out_name, src)

            records.append(
                Record(
                    source_pdf=src,
                    output_pdf=out_path,
                    name=name,
                    event=event,
                    organizer=first_nonempty(row, ["organizer", "organization", "organiser", "organisation"]),
                    entry_number=first_nonempty(row, ["entry_number", "entry", "entry_no"]),
                    mobile_number=first_nonempty(row, ["mobile_number", "mobile", "phone", "phone_number"]),
                    email=first_nonempty(row, ["email"]),
                    hall=first_nonempty(row, ["hall", "hall_details"]),
                    position=first_nonempty(row, ["position"]),
                )
            )

    return records


def make_qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(border=3, box_size=12)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#B8860B", back_color="white")

    buff = io.BytesIO()
    img.save(buff, format="PNG")
    buff.seek(0)
    return ImageReader(buff)


def create_overlay_pdf(
    page_width: float,
    page_height: float,
    qr_image: ImageReader,
    qr_x: float,
    qr_y: float,
    qr_size: float,
    id_x: float,
    id_y: float,
    cert_id: str,
    id_font: str,
    id_font_size: int,
    text_prefix: str,
) -> PdfReader:
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

    c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, mask="auto")
    c.setFont(id_font, id_font_size)
    c.drawString(id_x, id_y, f"{text_prefix}{cert_id}")

    c.save()
    packet.seek(0)
    return PdfReader(packet)


def merge_overlay(source_pdf: Path, overlay: PdfReader, output_pdf: Path) -> None:
    reader = PdfReader(str(source_pdf))
    writer = PdfWriter()

    if not reader.pages:
        raise ValueError(f"No pages found in PDF: {source_pdf}")

    first_page = reader.pages[0]
    first_page.merge_page(overlay.pages[0])
    writer.add_page(first_page)

    for page in reader.pages[1:]:
        writer.add_page(page)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    with output_pdf.open("wb") as f:
        writer.write(f)


def append_master_log(log_path: Path, rows: Iterable[Dict[str, str]]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    exists = log_path.exists()

    fieldnames = [
        "certificate_id",
        "timestamp_utc",
        "key_id",
        "name",
        "event",
        "organizer",
        "entry_number",
        "mobile_number",
        "hall",
        "position",
        "source_pdf",
        "output_pdf",
        "verification_url",
        "payload",
        "signature",
        "status",
        "error",
        "email",
    ]

    with log_path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not exists:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)


def append_record_log(log_path: Path, rows: Iterable[Dict[str, str]]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    exists = log_path.exists()

    fieldnames = [
        "CertificateID",
        "Name",
        "EntryNumber",
        "Hall",
        "Event",
        "Organizer",
        "Position",
        "Timestamp",
        "Hash",
        "Email",
    ]

    with log_path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not exists:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)


def process_certificates(
    input_csv: Path,
    output_dir: Path,
    log_path: Path,
    record_log_path: Path,
    source_pattern: Optional[str],
    secret_key: str,
    key_id: str,
    verify_base_url: str,
    id_prefix: str,
    qr_x: float,
    qr_y: float,
    qr_size: float,
    id_x: float,
    id_y: float,
    id_font: str,
    id_font_size: int,
    text_prefix: str,
) -> Tuple[int, int]:
    records = parse_csv(input_csv, output_dir, source_pattern)
    success = 0
    failed = 0
    log_rows: List[Dict[str, str]] = []
    record_rows: List[Dict[str, str]] = []

    for rec in records:
        cert_id = build_certificate_id(id_prefix)
        ts = utc_iso_timestamp()
        payload = build_signature_payload(cert_id, ts, key_id, rec.name, rec.event)
        sig = sign_payload(payload, secret_key)
        url = build_verification_url(verify_base_url, cert_id, ts, key_id, sig)

        row = {
            "certificate_id": cert_id,
            "timestamp_utc": ts,
            "key_id": key_id,
            "name": rec.name,
            "event": rec.event,
            "organizer": rec.organizer,
            "entry_number": rec.entry_number,
            "mobile_number": rec.mobile_number,
            "hall": rec.hall,
            "position": rec.position,
            "source_pdf": str(rec.source_pdf),
            "output_pdf": str(rec.output_pdf),
            "verification_url": url,
            "payload": payload,
            "signature": sig,
            "status": "ok",
            "error": "",
            "email": rec.email,
        }

        record_row = {
            "CertificateID": cert_id,
            "Name": rec.name,
            "EntryNumber": rec.entry_number,
            "Hall": rec.hall,
            "Event": rec.event,
            "Organizer": rec.organizer,
            "Position": rec.position,
            "Timestamp": ts,
            "Hash": sig,
            "Email": rec.email,
        }

        try:
            if not rec.source_pdf.exists():
                raise FileNotFoundError(f"Source PDF not found: {rec.source_pdf}")

            base_reader = PdfReader(str(rec.source_pdf))
            if not base_reader.pages:
                raise ValueError(f"No pages found in PDF: {rec.source_pdf}")
            first_page = base_reader.pages[0]
            page_w = float(first_page.mediabox.width)
            page_h = float(first_page.mediabox.height)

            qr_img = make_qr_image(url)
            overlay = create_overlay_pdf(
                page_width=page_w,
                page_height=page_h,
                qr_image=qr_img,
                qr_x=qr_x,
                qr_y=qr_y,
                qr_size=qr_size,
                id_x=id_x,
                id_y=id_y,
                cert_id=cert_id,
                id_font=id_font,
                id_font_size=id_font_size,
                text_prefix=text_prefix,
            )
            merge_overlay(rec.source_pdf, overlay, rec.output_pdf)
            success += 1
        except Exception as exc:
            row["status"] = "failed"
            row["error"] = str(exc)
            failed += 1

        log_rows.append(row)
        record_rows.append(record_row)

    append_master_log(log_path, log_rows)
    append_record_log(record_log_path, record_rows)
    return success, failed


def verify_row(
    log_csv: Path,
    cert_id: str,
    timestamp: str,
    signature: str,
    key_id_arg: Optional[str],
    secret_key_arg: Optional[str],
    keys_map: Dict[str, str],
) -> bool:
    with log_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("certificate_id") == cert_id and row.get("timestamp_utc") == timestamp:
                payload = row.get("payload", "")
                row_key_id = (row.get("key_id") or "").strip()
                key_id = key_id_arg or row_key_id

                if secret_key_arg:
                    secret = secret_key_arg
                elif key_id and key_id in keys_map:
                    secret = keys_map[key_id]
                elif row_key_id and row_key_id in keys_map:
                    secret = keys_map[row_key_id]
                elif "default" in keys_map:
                    secret = keys_map["default"]
                else:
                    return False

                expected = sign_payload(payload, secret)
                return hmac.compare_digest(expected, signature)
    return False


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Overlay secure QR + certificate ID on Canva-exported PDFs and maintain master CSV."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Generate signed QR overlays for all rows in CSV")
    run_p.add_argument("--input-csv", required=True, type=Path, help="CSV/TSV input. Supports name,event OR name,event_name schema")
    run_p.add_argument("--output-dir", required=True, type=Path, help="Directory for generated PDFs")
    run_p.add_argument("--env-file", default=Path(".env"), type=Path, help="Path to .env file")
    run_p.add_argument("--key-id", default="K1", help="Signing key identifier (kid) included in QR")
    run_p.add_argument("--keys-file", default=None, type=Path, help="Optional JSON file with key map, e.g. {\"K1\":\"secret\"}")
    run_p.add_argument(
        "--source-pattern",
        default=None,
        help=(
            "Optional PDF path template if source_pdf column is missing. "
            "Example: input_pdfs/{entry_number}_{event_name}.pdf"
        ),
    )
    run_p.add_argument("--master-log", default=Path("issued_certificates.csv"), type=Path, help="CSV log path")
    run_p.add_argument(
        "--record-log",
        default=Path("issued_certificates_record.csv"),
        type=Path,
        help="Second CSV log with compact certificate record format",
    )
    run_p.add_argument("--secret-key", required=False, default=None, help="Private key used for HMAC signing (optional if provided via .env)")
    run_p.add_argument("--verify-base-url", required=True, help="Base verify URL, e.g. https://verify.yourdomain.com/verify")
    run_p.add_argument("--id-prefix", default="GC2026", help="Certificate ID prefix")

    # Placement and style controls (points in PDF coordinate space)
    run_p.add_argument("--qr-x", type=float, default=QR_X, help="QR x position")
    run_p.add_argument("--qr-y", type=float, default=QR_Y, help="QR y position")
    run_p.add_argument("--qr-size", type=float, default=QR_SIZE, help="QR width/height")
    run_p.add_argument("--id-x", type=float, default=ID_X, help="Certificate ID text x position")
    run_p.add_argument("--id-y", type=float, default=ID_Y, help="Certificate ID text y position")
    run_p.add_argument("--id-font", default=ID_FONT, help="Certificate ID font")
    run_p.add_argument("--id-font-size", type=int, default=ID_FONT_SIZE, help="Certificate ID font size")
    run_p.add_argument("--id-text-prefix", default=ID_TEXT_PREFIX, help="Prefix before certificate ID")

    verify_p = sub.add_parser("verify", help="Verify one certificate tuple against master CSV")
    verify_p.add_argument("--env-file", default=Path(".env"), type=Path)
    verify_p.add_argument("--keys-file", default=None, type=Path, help="Optional JSON file with key map, e.g. {\"K1\":\"secret\"}")
    verify_p.add_argument("--key-id", default=None, help="Optional key id override")
    verify_p.add_argument("--secret-key", default=None, help="Optional direct secret (overrides key maps)")
    verify_p.add_argument("--master-log", required=True, type=Path)
    verify_p.add_argument("--certificate-id", required=True)
    verify_p.add_argument("--timestamp", required=True)
    verify_p.add_argument("--signature", required=True)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "run":
        env = merged_env(args.env_file.resolve())
        secret_key = resolve_run_secret(args.secret_key, args.key_id, env, args.keys_file.resolve() if args.keys_file else None)
        ok, fail = process_certificates(
            input_csv=args.input_csv.resolve(),
            output_dir=args.output_dir.resolve(),
            log_path=args.master_log.resolve(),
            record_log_path=args.record_log.resolve(),
            source_pattern=args.source_pattern,
            secret_key=secret_key,
            key_id=args.key_id,
            verify_base_url=args.verify_base_url,
            id_prefix=args.id_prefix,
            qr_x=args.qr_x,
            qr_y=args.qr_y,
            qr_size=args.qr_size,
            id_x=args.id_x,
            id_y=args.id_y,
            id_font=args.id_font,
            id_font_size=args.id_font_size,
            text_prefix=args.id_text_prefix,
        )
        total = ok + fail
        print(f"Completed: {ok}/{total} successful, {fail} failed")

    elif args.command == "verify":
        env = merged_env(args.env_file.resolve())
        keys_map = read_keys_map(env, args.keys_file.resolve() if args.keys_file else None)
        valid = verify_row(
            log_csv=args.master_log.resolve(),
            cert_id=args.certificate_id,
            timestamp=args.timestamp,
            signature=args.signature,
            key_id_arg=args.key_id,
            secret_key_arg=args.secret_key,
            keys_map=keys_map,
        )
        print("VALID" if valid else "INVALID")


if __name__ == "__main__":
    main()
