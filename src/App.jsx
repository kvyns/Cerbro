import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const API_DIRECT_URL = import.meta.env.VITE_CERT_VERIFY_API || "";
const DEPLOYMENT_ID = import.meta.env.VITE_DEPLOYMENT_ID || "";
const API_URL = import.meta.env.DEV && DEPLOYMENT_ID ? "/api/verify" : API_DIRECT_URL;
const QR_REGION_ID = "qr-reader-region";

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
  const scannerRef = useRef(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanText, setScanText] = useState("");
  const [result, setResult] = useState(null);
  const [confettiBurst, setConfettiBurst] = useState(0);

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

      const normalized = normalizeData(data.data || data, payload);
      setResult(normalized);
      setConfettiBurst((value) => value + 1);

      const params = new URLSearchParams(window.location.search);
      params.set("id", payload.id);
      params.set("ts", payload.ts);
      if (payload.kid) {
        params.set("kid", payload.kid);
      }
      params.set("sig", payload.sig);
      const query = params.toString();
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog font-body text-ink">
      <ConfettiBurst burstKey={confettiBurst} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(244,162,97,.33),transparent_30%),radial-gradient(circle_at_83%_12%,rgba(42,157,143,.25),transparent_28%),linear-gradient(160deg,#f7f6f2_0%,#eef3f5_46%,#dbe5ea_100%)]" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

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
