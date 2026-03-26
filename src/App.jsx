import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "qrcode";
import Pricing from "./Pricing";

const API_DIRECT_URL = import.meta.env.VITE_CERT_VERIFY_API || "";
const DEPLOYMENT_ID = import.meta.env.VITE_DEPLOYMENT_ID || "";
const API_URL = import.meta.env.DEV && DEPLOYMENT_ID ? "/api/verify" : API_DIRECT_URL;
const QR_REGION_ID = "qr-reader-region";
const PUBLIC_VERIFY_BASE = (import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL || "https://cerbro.vercel.app").replace(/\/$/, "");

function sanitizeCertificateId(raw) {
  return (raw || "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

function extractScanPayload(qrText) {
  const text = (qrText || "").trim();
  if (!text) {
    return { error: "QR content is empty." };
  }

  let params;
  try {
    const parsed = new URL(text);
    params = parsed.searchParams;
  } catch {
    const rawQuery = text.includes("?") ? text.split("?").slice(1).join("?") : text;
    params = new URLSearchParams(rawQuery);
  }

  const id = sanitizeCertificateId(params.get("id"));
  const ts = (params.get("ts") || "").trim();
  const kid = (params.get("kid") || "").trim();
  const sig = (params.get("sig") || "").trim();

  if (!id || !ts || !sig) {
    return { error: "Invalid QR. Required params missing: id, ts, sig." };
  }

  return { id, ts, kid, sig };
}

function normalizeData(apiData, fallback) {
  const source = apiData || {};
  const rawTimestamp =
    source.timestamp_utc || source.timestamp || source.Timestamp || source.ts || fallback.ts || "";

  let displayTimestamp = rawTimestamp;
  const parsedDate = rawTimestamp ? new Date(rawTimestamp) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    displayTimestamp = `${parsedDate.toLocaleDateString()} ${parsedDate.toLocaleTimeString()}`;
  }

  return {
    certificateId: source.certificate_id || source.CertificateID || source.id || fallback.id || "",
    name: source.name || source.Name || "",
    entryNumber: source.entry_number || source.entrynumber || source.EntryNumber || "",
    hall: source.hall || source.Hall || "",
    event: source.event || source.Event || "",
    position: source.position || source.Position || "",
    timestamp: displayTimestamp,
    email: source.email || source.Email || "",
  };
}

function ConfettiBurst({ burstKey }) {
  const pieces = useMemo(() => {
    if (!burstKey) return [];
    const palette = ["#2a9d8f", "#f4a261", "#e76f51", "#264653", "#e9c46a", "#4f6d7a"];
    return Array.from({ length: 28 }, (_, index) => ({
      id: `${burstKey}-${index}`,
      left: 5 + Math.random() * 90,
      delay: Math.random() * 200,
      drift: -90 + Math.random() * 180,
      color: palette[index % palette.length],
      width: 6 + Math.round(Math.random() * 6),
      height: 10 + Math.round(Math.random() * 10),
    }));
  }, [burstKey]);

  if (!burstKey) return null;

  return (
    <div className="confetti-layer" key={burstKey}>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            "--left": `${piece.left}%`,
            "--delay": `${piece.delay}ms`,
            "--drift": `${piece.drift}px`,
            "--color": piece.color,
            width: `${piece.width}px`,
            height: `${piece.height}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const currentPath = window.location.pathname;
  
  // Route: /pricing
  if (currentPath === "/pricing") {
    return <Pricing />;
  }

  // Default route: / and /verify - Certificate Verifier
  return <CertificateVerifier />;
}

function CertificateVerifier() {
  const scannerRef = useRef(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanText, setScanText] = useState("");
  const [result, setResult] = useState(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState("");

  const statusText = loading ? "Verifying" : error ? "Invalid" : result ? "Verified" : "Awaiting scan";

  const metaRows = useMemo(() => {
    if (!result) return [];
    return [
      ["Certificate ID", result.certificateId],
      ["Name", result.name],
      ["Entry Number", result.entryNumber],
      ["Hall", result.hall],
      ["Event", result.event],
      ["Position", result.position],
      ["Timestamp", result.timestamp],
      ["Email", result.email],
    ];
  }, [result]);

  async function buildCertificateImageDataUrl(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1100;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const qrValue = data.verificationUrl || window.location.href;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, {
        margin: 1,
        width: 280,
        color: {
          dark: "#B8860B",
          light: "#FFFFFF",
        },
      });
    } catch {
      qrDataUrl = "";
    }

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#fffaf0");
    grad.addColorStop(1, "#f8f1dd");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle radial highlights for depth.
    const glowA = ctx.createRadialGradient(260, 220, 40, 260, 220, 300);
    glowA.addColorStop(0, "rgba(212,162,76,0.16)");
    glowA.addColorStop(1, "rgba(212,162,76,0)");
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glowB = ctx.createRadialGradient(1320, 860, 50, 1320, 860, 320);
    glowB.addColorStop(0, "rgba(31,58,95,0.14)");
    glowB.addColorStop(1, "rgba(31,58,95,0)");
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Soft geometric pattern in the background.
    ctx.strokeStyle = "rgba(184,134,11,0.18)";
    ctx.lineWidth = 1;
    for (let x = 120; x < canvas.width - 80; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x - 60, canvas.height - 120);
      ctx.stroke();
    }

    ctx.strokeStyle = "#1f3a5f";
    ctx.lineWidth = 14;
    ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 3;
    ctx.strokeRect(72, 72, canvas.width - 144, canvas.height - 144);

    // Decorative corner marks.
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 4;
    const corner = 44;
    const left = 86;
    const top = 86;
    const right = canvas.width - 86;
    const bottom = canvas.height - 86;

    ctx.beginPath();
    ctx.moveTo(left, top + corner);
    ctx.lineTo(left, top);
    ctx.lineTo(left + corner, top);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(right - corner, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, top + corner);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(left, bottom - corner);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left + corner, bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(right - corner, bottom);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right, bottom - corner);
    ctx.stroke();

    ctx.fillStyle = "#1f3a5f";
    ctx.font = "700 66px 'Times New Roman'";
    ctx.textAlign = "center";
    ctx.fillText("Digital Certificate", canvas.width / 2, 190);

    // Watermark brand text.
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 40);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(31,58,95,0.06)";
    ctx.font = "700 150px 'Times New Roman'";
    ctx.fillText("CERBRO", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#6b7280";
    ctx.font = "500 30px 'Times New Roman'";
    ctx.fillText("This certificate is presented to", canvas.width / 2, 258);

    ctx.strokeStyle = "#d4a24c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(390, 290);
    ctx.lineTo(1210, 290);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 62px 'Times New Roman'";
    ctx.fillText(data.name || "-", canvas.width / 2, 392);

    ctx.fillStyle = "#475569";
    ctx.font = "500 34px 'Times New Roman'";
    ctx.fillText("for securing", canvas.width / 2, 455);

    ctx.fillStyle = "#1f3a5f";
    ctx.font = "700 48px 'Times New Roman'";
    ctx.fillText(`${data.position || "-"} position`, canvas.width / 2, 520);

    ctx.fillStyle = "#334155";
    ctx.font = "600 36px 'Times New Roman'";
    ctx.fillText(`in ${data.event || "Achievement"}`, canvas.width / 2, 572);

    ctx.textAlign = "left";
    ctx.fillStyle = "#1e293b";
    ctx.font = "600 24px 'Segoe UI'";
    ctx.fillText(`Certificate ID: ${data.certificateId || "-"}`, 140, 680);
    ctx.fillText(`Entry Number: ${data.entryNumber || "-"}`, 140, 730);
    ctx.fillText(`Timestamp: ${data.timestamp || "-"}`, 140, 780);
    ctx.fillText(`Email: ${data.email || "-"}`, 140, 830);

    if (qrDataUrl) {
      const qrImage = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = qrDataUrl;
      });

      if (qrImage) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(canvas.width - 430, 600, 300, 300);
        ctx.strokeStyle = "#d4a24c";
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width - 430, 600, 300, 300);
        ctx.drawImage(qrImage, canvas.width - 410, 620, 260, 260);
        ctx.fillStyle = "#1f3a5f";
        ctx.textAlign = "center";
        ctx.font = "600 20px 'Segoe UI'";
        ctx.fillText("Scan to Verify", canvas.width - 280, 915);
      }
    }

    ctx.textAlign = "right";
    ctx.fillStyle = "#1f3a5f";
    ctx.font = "700 22px 'Segoe UI'";
    ctx.fillText("Status: VERIFIED", canvas.width - 140, 950);

    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = "500 19px 'Segoe UI'";
    ctx.fillText("Issued securely via Cerbro digital verification.", 140, 950);

    return canvas.toDataURL("image/png");
  }

  async function downloadDigitalCertificate() {
    if (!result) return;

    const safeName = (result.name || "user")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeEvent = (result.event || "event")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeId = (result.certificateId || "certificate").replace(/[^a-zA-Z0-9-_]/g, "_");
    const url = certificatePreviewUrl || (await buildCertificateImageDataUrl(result));
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName}-${safeEvent}-${safeId}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  async function stopScanner() {
    if (!scannerRef.current) {
      setScannerOpen(false);
      return;
    }
    try {
      await scannerRef.current.stop();
    } catch {
      // Ignore stop errors when scanner is already stopped.
    }
    try {
      await scannerRef.current.clear();
    } catch {
      // Ignore clear errors.
    }
    scannerRef.current = null;
    setScannerOpen(false);
  }

  async function verifyWithPayload(payload) {
    if (!API_URL) {
      setError("Missing VITE_CERT_VERIFY_API or VITE_DEPLOYMENT_ID in cert-verifier-web/.env");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const requestJson = async (baseUrl) => {
        const query = new URLSearchParams({
          id: payload.id,
          ts: payload.ts,
          sig: payload.sig,
        }).toString();

        const params = new URLSearchParams(query);
        if (payload.kid) {
          params.set("kid", payload.kid);
        }

        const response = await fetch(`${baseUrl}?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Verification service returned non-JSON response.");
        }

        return response.json();
      };

      let data = await requestJson(API_URL);

      if (import.meta.env.DEV && (data?.status === "NOT_FOUND" || data?.status === "INVALID") && API_DIRECT_URL) {
        data = await requestJson(API_DIRECT_URL);
      }

      const status = String(data?.status || "").toUpperCase();

      // Backward compatibility: if status is absent but payload shape looks like certificate data.
      const inferredValid = !status && data && (data.certificate_id || data.id);
      const isValid = status === "VALID" || inferredValid;

      if (!isValid) {
        if (status === "INVALID") {
          setError("QR signature invalid. Certificate is not valid.");
        } else if (status === "NOT_FOUND") {
          setError("Certificate record not found.");
        } else {
          setError("Unexpected verification response.");
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      params.set("id", payload.id);
      params.set("ts", payload.ts);
      if (payload.kid) {
        params.set("kid", payload.kid);
      }
      params.set("sig", payload.sig);
      const query = params.toString();

      const normalized = {
        ...normalizeData(data.data || data, payload),
        keyId: payload.kid || "",
        signature: payload.sig || "",
        verificationUrl: `${PUBLIC_VERIFY_BASE}/verify?${query}`,
      };
      setResult(normalized);
      setConfettiBurst((value) => value + 1);
      window.history.replaceState({}, "", `${window.location.pathname}?${query}`);
    } catch (err) {
      setError(err.message || "Unable to verify certificate right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScanResult(decodedText) {
    setScanText(decodedText);
    const payload = extractScanPayload(decodedText);
    if (payload.error) {
      setError(payload.error);
      return;
    }
    await stopScanner();
    await verifyWithPayload(payload);
  }

  async function startScanner() {
    setError("");
    if (scannerRef.current) return;

    try {
      const scanner = new Html5Qrcode(QR_REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        () => {
          // Ignore per-frame decode errors.
        }
      );
      setScannerOpen(true);
    } catch (err) {
      setError(err.message || "Camera access failed. Please allow camera permissions.");
      await stopScanner();
    }
  }

  async function handlePasteVerify(event) {
    event.preventDefault();
    const payload = extractScanPayload(scanText);
    if (payload.error) {
      setError(payload.error);
      return;
    }
    await verifyWithPayload(payload);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = extractScanPayload(params.toString());
    if (!candidate.error) {
      verifyWithPayload(candidate);
      setScanText(window.location.href);
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    async function generatePreview() {
      if (!result) {
        setCertificatePreviewUrl("");
        return;
      }
      const preview = await buildCertificateImageDataUrl(result);
      if (active) {
        setCertificatePreviewUrl(preview);
      }
    }

    generatePreview();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog font-body text-ink">
      <ConfettiBurst burstKey={confettiBurst} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(244,162,97,.33),transparent_30%),radial-gradient(circle_at_83%_12%,rgba(42,157,143,.25),transparent_28%),linear-gradient(160deg,#f7f6f2_0%,#eef3f5_46%,#dbe5ea_100%)]" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 bg-white/50 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-ink">Cerbro</div>
            <div className="flex gap-6">
              <a
                href="/"
                className="text-sm font-semibold text-steel hover:text-ink transition"
              >
                Verify
              </a>
              <a
                href="/pricing"
                className="text-sm font-semibold text-steel hover:text-ink transition"
              >
                Pricing
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-8">
        <header className="mb-10 animate-rise rounded-3xl border border-steel/10 bg-white/70 p-6 shadow-soft backdrop-blur-md sm:p-8">
          <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl mb-3">
            Cerbro
          </h1>
          <p className="mb-4 text-2xl font-bold text-ink sm:text-3xl">
            Certificate Verified. Instantly.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-steel/80 sm:text-base">
            Scan your certificate QR code to instantly validate credentials. No fuss, no edits. Just proof that you earned it.
          </p>
        </header>

        <section className="grid gap-6">
          <form
            onSubmit={handlePasteVerify}
            className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:90ms] sm:p-8"
          >
            <p className="mb-2 block text-sm font-semibold text-steel">Scan Your Certificate</p>

            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startScanner}
                disabled={loading || scannerOpen}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-steel disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scannerOpen ? "Camera Running" : "Open Camera"}
              </button>
              <button
                type="button"
                onClick={stopScanner}
                disabled={!scannerOpen}
                className="rounded-xl border border-steel/20 bg-white px-5 py-2.5 text-sm font-semibold text-steel transition hover:bg-fog disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stop Scanner
              </button>
            </div>

            <div id={QR_REGION_ID} className="mb-4 overflow-hidden rounded-2xl border border-steel/15 bg-white" />

            <label htmlFor="scan-text" className="mb-2 block text-sm font-semibold text-steel">
              Or Paste Certificate URL
            </label>
            <textarea
              id="scan-text"
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              placeholder="Paste full certificate URL"
              className="min-h-24 w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
            />

            <button
              type="submit"
              disabled={loading || !scanText.trim()}
              className="mt-3 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-steel disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify Certificate"}
            </button>

          </form>
        </section>

        <section className="mt-6 animate-rise rounded-3xl border border-steel/10 bg-white/85 p-6 shadow-soft backdrop-blur-sm [animation-delay:230ms] sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-ink">Verification Result</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                result ? "bg-mint/20 text-mint" : error ? "bg-danger/20 text-danger" : "bg-amber/20 text-amber"
              }`}
            >
              {statusText}
            </span>
          </div>

          {result ? (
            <div className="mb-5 rounded-2xl border border-mint/20 bg-gradient-to-r from-mint/10 via-white to-amber/10 p-4">
              <p className="text-sm font-semibold text-ink">Certificate image ready</p>
              <p className="mt-1 text-sm text-steel/80">This certificate includes complete details and a verification QR.</p>
              <button
                type="button"
                onClick={downloadDigitalCertificate}
                className="mt-3 rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint/90"
              >
                Download Certificate Image
              </button>
            </div>
          ) : null}

          {!result ? (
            <p className={`text-sm ${error ? "text-danger" : "text-steel/80"}`}>
              {error || "Scan your certificate QR code or paste the URL above to verify."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {metaRows.map(([label, value], index) => (
                <article
                  key={label}
                  className="rounded-xl border border-steel/10 bg-fog/70 p-4 text-sm [animation:rise_500ms_ease-out_both]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <p className="text-xs uppercase tracking-wide text-steel/70">{label}</p>
                  <p className="mt-1 break-words font-semibold text-ink">{value || "-"}</p>
                </article>
              ))}

              {certificatePreviewUrl ? (
                <article className="sm:col-span-2 rounded-xl border border-steel/10 bg-white p-4">
                  <p className="mb-3 text-xs uppercase tracking-wide text-steel/70">Digital Certificate Preview</p>
                  <img
                    src={certificatePreviewUrl}
                    alt="Digital certificate preview"
                    className="w-full rounded-lg border border-steel/10"
                  />
                  <p className="mt-3 text-sm text-steel/80">Formal certificate preview with embedded QR verification.</p>
                </article>
              ) : null}
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-sm text-steel/70">
          <p>Cerbro — Digital certificates, instantly verifiable. Issue. Share. Verify.</p>
        </footer>
      </main>
    </div>
  );
}
