import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  ArrowRight, Building2, CheckCircle, CreditCard, Download, FileText,
  GripVertical, Hash, Mail, Phone, Plus, Table, Trash2,
  Trophy, User, X, XCircle, Zap,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { firestore } from "./firebase";
import { issueCertificate, bulkIssueCertificates } from "./api/certificates";
import { listProjects, createProject } from "./api/projects";

// ── Certificate canvas config ─────────────────────────────────────────────────
const CERT_W = 1600;
const CERT_H = 1100;

const STYLE_OPTIONS = [
  { value: "title",      label: "Title" },
  { value: "subtitle",   label: "Subtitle" },
  { value: "name",       label: "Recipient Name" },
  { value: "highlight",  label: "Highlight" },
  { value: "body",       label: "Body" },
  { value: "body-bold",  label: "Body Bold" },
  { value: "small",      label: "Small" },
  { value: "divider",    label: "— Divider —" },
  { value: "spacer",     label: "— Spacer —" },
];

const STYLE_CFG = {
  title:      { font: `700 66px 'Times New Roman'`,   color: "#1f3a5f", gap: 22 },
  subtitle:   { font: `500 30px 'Times New Roman'`,   color: "#6b7280", gap: 16 },
  name:       { font: `700 62px 'Times New Roman'`,   color: "#0f172a", gap: 28 },
  highlight:  { font: `700 48px 'Times New Roman'`,   color: "#1f3a5f", gap: 20 },
  body:       { font: `500 34px 'Times New Roman'`,   color: "#475569", gap: 16 },
  "body-bold":{ font: `600 36px 'Times New Roman'`,   color: "#334155", gap: 14 },
  small:      { font: `500 24px 'Segoe UI'`,          color: "#6b7280", gap: 10 },
  divider:    { font: `12px sans-serif`,              color: "#b8860b",    gap: 18 },
  spacer:     { font: `12px sans-serif`,              color: "transparent", gap: 20 },
};

const DEFAULT_TEMPLATE = [
  { id: 1, text: "Digital Certificate",              style: "title"     },
  { id: 2, text: "This certificate is presented to", style: "subtitle"  },
  { id: 3, text: "",                                 style: "divider"   },
  { id: 4, text: "{{name}}",                         style: "name"      },
  { id: 5, text: "for securing",                     style: "body"      },
  { id: 6, text: "{{position}} position",            style: "highlight" },
  { id: 7, text: "in {{event}}",                     style: "body"      },
  { id: 8, text: "Organized by {{organizer}}",       style: "body-bold" },
];

// Standard optional fields
const STANDARD_FIELDS = [
  { key: "organizer",     label: "Organizer",       icon: Building2, placeholder: "Organizing body",     type: "text"  },
  { key: "entry_number",  label: "Entry Number",    icon: Hash,      placeholder: "e.g. 2025001",         type: "text"  },
  { key: "email",         label: "Recipient Email", icon: Mail,      placeholder: "recipient@email.com",  type: "email" },
  { key: "mobile_number", label: "Mobile Number",   icon: Phone,     placeholder: "+91 98765 43210",      type: "tel"   },
  { key: "hall",          label: "Hall / Venue",    icon: Building2, placeholder: "Hall or venue name",   type: "text"  },
  { key: "position",      label: "Position",        icon: Trophy,    placeholder: "1st, 2nd, Winner…",    type: "text"  },
];

// Extract px size from a CSS font string like "700 66px 'Times New Roman'"
function fontSize(fontStr) {
  const m = fontStr.match(/(\d+)px/);
  return m ? parseInt(m[1]) : 20;
}

// ── Placeholder substitution ──────────────────────────────────────────────────
function substitute(text, values, preview = false) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = values[key];
    if (val) return val;
    return preview ? `[${key}]` : `{{${key}}}`;
  });
}

function fieldValues(required, enabledStd, stdValues, customFields) {
  const v = { ...required };
  for (const key of enabledStd) v[key] = stdValues[key] || "";
  for (const f of customFields) {
    if (f.label.trim()) {
      v[f.label.trim().toLowerCase().replace(/\s+/g, "_")] = f.value;
    }
  }
  return v;
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
// finalData = { certId, entryNumber, timestamp, qrImg } — provided after issuance
function drawCertificate(canvas, templateLines, values, finalData = null) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 1600
  const H = canvas.height;  // 1100

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#fffaf0");
  grad.addColorStop(1, "#f8f1dd");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Radial depth glows
  const glowA = ctx.createRadialGradient(260, 220, 40, 260, 220, 300);
  glowA.addColorStop(0, "rgba(212,162,76,0.16)");
  glowA.addColorStop(1, "rgba(212,162,76,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);

  const glowB = ctx.createRadialGradient(1320, 860, 50, 1320, 860, 320);
  glowB.addColorStop(0, "rgba(31,58,95,0.14)");
  glowB.addColorStop(1, "rgba(31,58,95,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  // Diagonal line pattern
  ctx.strokeStyle = "rgba(184,134,11,0.18)";
  ctx.lineWidth = 1;
  for (let x = 120; x < W - 80; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 120);
    ctx.lineTo(x - 60, H - 120);
    ctx.stroke();
  }

  // Outer dark border
  ctx.strokeStyle = "#1f3a5f";
  ctx.lineWidth = 14;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Inner gold border
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 3;
  ctx.strokeRect(72, 72, W - 144, H - 144);

  // Corner L-brackets
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 4;
  const arm = 44, L = 86, T = 86, R = W - 86, B = H - 86;
  [
    [[L, T + arm], [L, T], [L + arm, T]],
    [[R - arm, T], [R, T], [R, T + arm]],
    [[L, B - arm], [L, B], [L + arm, B]],
    [[R - arm, B], [R, B], [R, B - arm]],
  ].forEach((pts) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.stroke();
  });

  // Watermark
  ctx.save();
  ctx.translate(W / 2, H / 2 + 40);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(31,58,95,0.06)";
  ctx.font = "700 150px 'Times New Roman'";
  ctx.fillText("CERBRO", 0, 0);
  ctx.restore();

  // ── Template lines ───────────────────────────────────────────────────────────
  const lines = templateLines.filter((l) => l.style === "spacer" || l.style === "divider" || l.text.trim());
  const CONTENT_TOP = 100;
  const CONTENT_BOT = 700;

  // Measure total height
  const totalH = lines.reduce((sum, l) => {
    const cfg = STYLE_CFG[l.style] || STYLE_CFG.body;
    if (l.style === "divider") return sum + 16 + cfg.gap;
    return sum + fontSize(cfg.font) + cfg.gap;
  }, 0);

  let y = CONTENT_TOP + Math.max(0, (CONTENT_BOT - CONTENT_TOP - totalH) / 2);

  ctx.textAlign = "center";
  for (const line of lines) {
    const cfg = STYLE_CFG[line.style] || STYLE_CFG.body;
    const size = fontSize(cfg.font);
    if (line.style === "divider") {
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.24, y + 8);
      ctx.lineTo(W * 0.76, y + 8);
      ctx.stroke();
      y += 16 + cfg.gap;
    } else if (line.style !== "spacer") {
      ctx.font = cfg.font;
      ctx.fillStyle = cfg.color;
      const text = substitute(line.text, values, true);
      ctx.fillText(text, W / 2, y + size);
      y += size + cfg.gap;
    } else {
      y += size + cfg.gap;
    }
  }

  // ── Bottom details (left) ────────────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.fillStyle = "#1e293b";
  ctx.font = "600 24px 'Segoe UI'";
  const detailRows = [
    finalData?.certId   ? ["Certificate ID", finalData.certId] : null,
    values.entry_number ? ["Entry Number", values.entry_number] : null,
    ["Timestamp", finalData?.timestamp || new Date().toLocaleString()],
  ].filter(Boolean);
  detailRows.forEach(([label, val], i) => {
    ctx.fillText(`${label}: ${val}`, 140, 760 + i * 46);
  });

  // ── QR (right) ───────────────────────────────────────────────────────────────
  const qrX = W - 400, qrY = 640, qrS = 250;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX, qrY, qrS, qrS);
  ctx.strokeStyle = "#d4a24c";
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX, qrY, qrS, qrS);

  if (finalData?.qrImg) {
    ctx.drawImage(finalData.qrImg, qrX + 15, qrY + 15, qrS - 30, qrS - 30);
  } else {
    ctx.fillStyle = "#b8860b";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.fillText("QR", qrX + qrS / 2, qrY + qrS / 2 + 14);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("(generated on issue)", qrX + qrS / 2, qrY + qrS / 2 + 36);
  }

  ctx.font = "600 18px 'Segoe UI'";
  ctx.textAlign = "center";
  ctx.fillStyle = "#1f3a5f";
  ctx.fillText("Scan to Verify", W - 275, 907);

  const verified = finalData !== null;
  ctx.font = "700 22px 'Segoe UI'";
  ctx.fillStyle = verified ? "#1f3a5f" : "#b91c1c";
  ctx.fillText(verified ? "Status: VERIFIED" : "Status: UNVERIFIED", W - 275, 935);

  // ── Footer ────────────────────────────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = "500 19px 'Segoe UI'";
  ctx.fillText("Issued securely via Cerbro digital verification.", 140, 950);
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1)
    .filter((l) => l.trim())
    .map((l, i) => {
      const vals = parseCsvLine(l);
      const obj = { _id: i };
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
      return obj;
    })
    .filter((r) => (r.name || "").trim());
  return { headers, rows };
}

// Render one certificate to a PDF blob (used in bulk)
async function renderCertPdf(meta, templateLines) {
  const verifyUrl = meta.verification_url || "";
  const qrDataUrl = await QRCode.toDataURL(verifyUrl || "N/A", {
    margin: 1, width: 220,
    color: { dark: "#B8860B", light: "#FFFFFF" },
  });
  const qrImg = await new Promise((res) => {
    const img = new Image(); img.onload = () => res(img); img.src = qrDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = CERT_W; canvas.height = CERT_H;
  const values = {
    name: meta.name || "",
    event: meta.event || "",
    organizer: meta.organizer || "",
    position: meta.position || "",
    entry_number: meta.entry_number || "",
    hall: meta.hall || "",
    email: meta.email || "",
    mobile_number: meta.mobile_number || "",
    ...(meta.extra_fields || {}),
  };
  drawCertificate(canvas, templateLines, values, {
    certId: meta.certificate_id,
    entryNumber: meta.entry_number || "",
    timestamp: new Date(meta.timestamp_utc || Date.now()).toLocaleString(),
    qrImg,
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [CERT_W, CERT_H] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, CERT_W, CERT_H);
  return { blob: pdf.output("blob"), filename: `${meta.certificate_id}.pdf` };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IssueCertificate() {
  const { user, getIdToken } = useAuth();
  const fileRef = useRef(null);

  const [mode, setMode] = useState("design"); // "design" | "upload" | "bulk"
  const [templateLines, setTemplateLines] = useState(DEFAULT_TEMPLATE);

  // Projects
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");

  // Live credits from Firestore
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
      if (snap.exists()) setCredits(snap.data().credits ?? 0);
    });
    return unsub;
  }, [user]);;

  const [required, setRequired] = useState({ name: "", event: "" });
  const [enabledStd, setEnabledStd] = useState(new Set(["organizer", "entry_number", "position"]));
  const [stdValues, setStdValues] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [templateFile, setTemplateFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Bulk state
  const [bulkPreview, setBulkPreview] = useState(null); // { headers, rows }
  const [bulkProgress, setBulkProgress] = useState(null); // { current, total, label }
  const [bulkResults, setBulkResults] = useState(null); // array of result objects
  const bulkCsvRef = useRef(null);

  const canvasRef = useRef(null);
  const values = fieldValues(required, enabledStd, stdValues, customFields);

  // Fetch projects on mount
  useEffect(() => {
    if (!user) return;
    getIdToken()
      .then((token) => listProjects(token))
      .then((data) => Array.isArray(data) && setProjects(data))
      .catch(() => {});
  }, [user]);

  // Re-draw canvas whenever template or values change
  useEffect(() => {
    if (mode !== "design" || !canvasRef.current) return;
    drawCertificate(canvasRef.current, templateLines, values);
  }, [templateLines, required, stdValues, customFields, enabledStd, mode]);

  // ── Field toggle ────────────────────────────────────────────────────────────
  const toggleStd = (key) => {
    setEnabledStd((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); setStdValues((v) => { const c = { ...v }; delete c[key]; return c; }); }
      else next.add(key);
      return next;
    });
  };

  // ── Custom fields ───────────────────────────────────────────────────────────
  const addCustomField = () => setCustomFields((p) => [...p, { id: Date.now(), label: "", value: "" }]);
  const updateCustomField = (id, k, v) => setCustomFields((p) => p.map((f) => f.id === id ? { ...f, [k]: v } : f));
  const removeCustomField = (id) => setCustomFields((p) => p.filter((f) => f.id !== id));

  // ── Template line ops ───────────────────────────────────────────────────────
  const updateLine = (id, k, v) => setTemplateLines((p) => p.map((l) => l.id === id ? { ...l, [k]: v } : l));
  const removeLine = (id) => setTemplateLines((p) => p.filter((l) => l.id !== id));
  const addLine = () => setTemplateLines((p) => [...p, { id: Date.now(), text: "", style: "body" }]);

  // ── File ────────────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setTemplateFile(file || null); setError("");
  };

  // ── Build form body (shared) ────────────────────────────────────────────────
  function buildFormBody() {
    const body = new FormData();
    body.append("name", required.name);
    body.append("event", required.event);
    for (const key of enabledStd) body.append(key, stdValues[key] || "");
    const extraObj = {};
    for (const f of customFields) if (f.label.trim()) extraObj[f.label.trim()] = f.value;
    if (Object.keys(extraObj).length) body.append("extra_fields", JSON.stringify(extraObj));
    if (selectedProject) body.append("project_id", selectedProject);
    return body;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setResult(null);
    if (!user) { setError("You must be logged in."); return; }

    setLoading(true);
    try {
      const token = await getIdToken();

      if (mode === "design") {
        // Step 1: save record to backend (no PDF) → get cert metadata
        const metaRes = await issueCertificate(buildFormBody(), token);
        const meta = await metaRes.json();
        const certId = meta.certificate_id || metaRes.headers?.get?.("X-Certificate-ID") || "";
        const verifyUrl = meta.verification_url || "";

        // Step 2: generate QR image from verification URL
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          margin: 1, width: 220,
          color: { dark: "#B8860B", light: "#FFFFFF" },
        });
        const qrImg = await new Promise((res) => {
          const img = new Image(); img.onload = () => res(img); img.src = qrDataUrl;
        });

        // Step 3: draw final canvas with real QR + cert ID
        const canvas = canvasRef.current;
        const finalData = {
          certId,
          entryNumber: stdValues.entry_number || "",
          timestamp: new Date().toLocaleString(),
          qrImg,
        };
        drawCertificate(canvas, templateLines, values, finalData);

        // Step 4: canvas → PDF blob
        const W = canvas.width, H = canvas.height;
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, W, H);
        const pdfBlob = pdf.output("blob");

        setResult({
          pdfUrl: URL.createObjectURL(pdfBlob),
          certId,
          verifyUrl,
          filename: `${certId}.pdf`,
          hasPdf: true,
        });

      } else {
        // Upload mode — send template PDF to backend for QR overlay
        const body = buildFormBody();
        if (templateFile) body.append("template_pdf", templateFile);

        const res = await issueCertificate(body, token);
        const certId = res.headers.get("X-Certificate-ID") || "";
        const verifyUrl = res.headers.get("X-Verification-URL") || "";
        const contentType = res.headers.get("Content-Type") || "";
        if (contentType.includes("application/pdf")) {
          const blob = await res.blob();
          setResult({ pdfUrl: URL.createObjectURL(blob), certId, verifyUrl, filename: `${certId}.pdf`, hasPdf: true });
        } else {
          setResult({ certId, verifyUrl, hasPdf: false });
        }
      }
    } catch (err) {
      setError(err.message || "Failed to issue certificate.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (result?.pdfUrl) URL.revokeObjectURL(result.pdfUrl);
    setResult(null); setTemplateFile(null);
    setRequired({ name: "", event: "" }); setStdValues({}); setCustomFields([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Bulk CSV import ─────────────────────────────────────────────────────────
  const handleBulkCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCsv(ev.target.result || "");
      if (!rows.length) { setError("CSV has no valid rows (need at least a 'name' column)."); return; }
      setError("");
      setBulkPreview({ headers, rows, file });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Bulk submit ─────────────────────────────────────────────────────────────
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setError(""); setBulkResults(null);
    if (!user) { setError("You must be logged in."); return; }
    if (!bulkPreview?.rows?.length) { setError("Upload a CSV file first."); return; }
    if (!required.event.trim()) { setError("Event name is required."); return; }

    setLoading(true);
    setBulkProgress({ current: 0, total: bulkPreview.rows.length, label: "Uploading…" });

    try {
      const token = await getIdToken();
      const body = new FormData();
      body.append("event", required.event);
      body.append("organizer", stdValues.organizer || "");
      body.append("hall", stdValues.hall || "");
      const extraObj = {};
      for (const f of customFields) if (f.label.trim()) extraObj[f.label.trim()] = f.value;
      if (Object.keys(extraObj).length) body.append("extra_fields", JSON.stringify(extraObj));
      body.append("recipients_csv", bulkPreview.file);
      if (templateFile) body.append("template_pdf", templateFile);
      if (selectedProject) body.append("project_id", selectedProject);

      const res = await bulkIssueCertificates(body, token);

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/zip")) {
        // Upload mode — direct ZIP download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "certificates-bulk.zip";
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setBulkResults([{ zip: true, count: bulkPreview.rows.length }]);
      } else {
        // Design mode — render each cert on canvas
        const metaList = await res.json();
        setBulkProgress({ current: 0, total: metaList.length, label: "Rendering certificates…" });
        const results = [];
        for (let i = 0; i < metaList.length; i++) {
          setBulkProgress({ current: i + 1, total: metaList.length, label: `Rendering ${i + 1}/${metaList.length}…` });
          try {
            const { blob, filename } = await renderCertPdf(metaList[i], templateLines);
            const pdfUrl = URL.createObjectURL(blob);
            results.push({ meta: metaList[i], pdfUrl, filename, error: null });
          } catch (err) {
            results.push({ meta: metaList[i], pdfUrl: null, filename: null, error: err.message });
          }
        }
        setBulkResults(results);
      }
    } catch (err) {
      setError(err.message || "Bulk issue failed.");
    } finally {
      setLoading(false);
      setBulkProgress(null);
    }
  };

  // ── All available placeholder tags ─────────────────────────────────────────
  const allTags = [
    { key: "name", label: "{{name}}" },
    { key: "event", label: "{{event}}" },
    ...STANDARD_FIELDS.filter((f) => enabledStd.has(f.key)).map((f) => ({ key: f.key, label: `{{${f.key}}}` })),
    ...customFields.filter((f) => f.label.trim()).map((f) => {
      const k = f.label.trim().toLowerCase().replace(/\s+/g, "_");
      return { key: k, label: `{{${k}}}` };
    }),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />

      <nav className="relative border-b border-steel/10 dark:border-steel/40 bg-white/50 dark:bg-ink/20 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8 flex items-center justify-between">
          <a href="/" className="font-display text-2xl font-bold text-ink dark:text-fog hover:text-steel transition">Cerbro</a>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              credits === 0 ? "bg-danger/10 border-danger/30 text-danger"
              : credits !== null && credits <= 3 ? "bg-amber/10 border-amber/30 text-amber"
              : "bg-mint/10 border-mint/30 text-mint"
            }`}>
              <Zap size={12} />
              {credits === null ? "…" : credits} credit{credits !== 1 ? "s" : ""}
            </div>
            <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">Verify</a>
            <a href="/dashboard" className="text-sm font-semibold text-steel hover:text-ink transition">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        <div className="mb-8 animate-rise">
          <h1 className="font-display text-3xl font-bold text-ink dark:text-fog mb-2">Issue Certificate</h1>
          <p className="text-steel/70 text-sm">Design your certificate or upload a PDF template, then fill in recipient details.</p>
        </div>

        {/* Project selector */}
        <ProjectSelector
          projects={projects}
          selected={selectedProject}
          onSelect={setSelectedProject}
          onCreated={(p) => { setProjects((prev) => [p, ...prev]); setSelectedProject(p.project_id); }}
          getIdToken={getIdToken}
        />

        {result ? (
          <CertificateResult result={result} onReset={handleReset} />
        ) : (
          <form onSubmit={mode === "bulk" ? handleBulkSubmit : handleSubmit} className="animate-rise space-y-5">

            {/* Mode toggle */}
            <div className="flex rounded-2xl border border-steel/10 bg-white/80 p-1.5 gap-1.5 shadow-soft w-fit flex-wrap">
              {[["design", "Design Certificate"], ["upload", "Upload PDF"], ["bulk", "Bulk Issue"]].map(([m, label]) => (
                <button key={m} type="button" onClick={() => { setMode(m); setError(""); setBulkResults(null); }}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                    mode === m ? "bg-ink text-white shadow" : "text-steel/70 hover:text-ink"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── DESIGN MODE ─────────────────────────────────────────────── */}
            {mode === "design" && (
              <div className="space-y-4">
                {/* Live preview */}
                <Section title="Certificate Preview" subtitle="Updates live as you fill in fields">
                  <div className="mt-3 overflow-x-auto rounded-xl border border-steel/10">
                    <canvas ref={canvasRef} width={CERT_W} height={CERT_H}
                      className="w-full max-w-full rounded-xl"
                      style={{ aspectRatio: `${CERT_W}/${CERT_H}` }}
                    />
                  </div>
                </Section>

                {/* Template editor */}
                <Section
                  title="Certificate Text"
                  subtitle={`Use {{field_name}} placeholders — click a tag below to copy`}
                >
                  {/* Tag chips */}
                  <div className="flex flex-wrap gap-2 mt-3 mb-4">
                    {allTags.map((t) => (
                      <button key={t.key} type="button"
                        onClick={() => navigator.clipboard.writeText(t.label)}
                        title="Click to copy"
                        className="rounded-full bg-steel/10 hover:bg-mint/20 border border-steel/20 hover:border-mint/40 px-3 py-1 text-xs font-mono text-steel hover:text-mint transition">
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Lines */}
                  <div className="space-y-2">
                    {templateLines.map((line, idx) => (
                      <div key={line.id} className="flex gap-2 items-center">
                        <GripVertical size={15} className="shrink-0 text-steel/30 cursor-grab" />
                        <select value={line.style} onChange={(e) => updateLine(line.id, "style", e.target.value)}
                          className="shrink-0 rounded-lg border border-steel/20 bg-white px-2 py-2 text-xs text-steel outline-none focus:border-mint w-32">
                          {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input type="text" value={line.text}
                          onChange={(e) => updateLine(line.id, "text", e.target.value)}
                          placeholder={line.style === "spacer" ? "(spacer)" : line.style === "divider" ? "(horizontal line)" : "Type text or {{field}}…"}
                          disabled={line.style === "spacer" || line.style === "divider"}
                          className="flex-1 min-w-0 rounded-lg border border-steel/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mint focus:ring-1 focus:ring-mint/30 disabled:bg-fog disabled:text-steel/30"
                        />
                        <button type="button" onClick={() => removeLine(line.id)}
                          className="shrink-0 p-1.5 rounded-lg text-steel/30 hover:text-danger transition">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={addLine}
                      className="flex items-center gap-1.5 rounded-lg border border-steel/20 bg-white px-3 py-1.5 text-xs font-semibold text-steel hover:bg-fog transition">
                      <Plus size={13} /> Add Line
                    </button>
                    <button type="button" onClick={() => setTemplateLines(DEFAULT_TEMPLATE)}
                      className="flex items-center gap-1.5 rounded-lg border border-steel/20 bg-white px-3 py-1.5 text-xs font-semibold text-steel hover:bg-fog transition">
                      Reset to Default
                    </button>
                  </div>
                </Section>
              </div>
            )}

            {/* ── UPLOAD MODE ─────────────────────────────────────────────── */}
            {mode === "upload" && (
              <Section title="Template PDF" subtitle="Optional — skip to save record only">
                <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-steel/20 bg-fog/50 p-4 cursor-pointer hover:border-mint/50 transition mt-3"
                  onClick={() => fileRef.current?.click()}>
                  <FileText className="shrink-0 text-steel/40" size={22} />
                  <span className="text-sm text-steel/60 truncate">
                    {templateFile ? templateFile.name : "Click to upload PDF template (optional)"}
                  </span>
                  {templateFile && (
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); setTemplateFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="ml-auto shrink-0 text-steel/40 hover:text-danger transition">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
              </Section>
            )}

            {/* ── BULK MODE ────────────────────────────────────────────────── */}
            {mode === "bulk" && (
              <div className="space-y-4">
                <Section
                  title="Bulk Issue via CSV"
                  subtitle="Upload a CSV file with one recipient per row. Required column: name. Optional: entry_number, position, email, mobile_number, hall, organizer."
                >
                  {/* CSV template download hint */}
                  <div className="mt-3 rounded-xl bg-steel/5 border border-steel/10 p-3 text-xs text-steel/70">
                    <span className="font-semibold text-ink">CSV format: </span>
                    name, entry_number, position, email, mobile_number, hall, organizer
                    <br />
                    <span className="italic">Tip: Export from Excel as "CSV UTF-8" for best results.</span>
                  </div>

                  {/* File upload */}
                  <div
                    className="mt-3 flex items-center gap-3 rounded-xl border-2 border-dashed border-steel/20 bg-fog/50 p-4 cursor-pointer hover:border-mint/50 transition"
                    onClick={() => bulkCsvRef.current?.click()}
                  >
                    <Table className="shrink-0 text-steel/40" size={22} />
                    <span className="text-sm text-steel/60 truncate">
                      {bulkPreview ? `${bulkPreview.rows.length} recipients loaded — ${bulkPreview.file.name}` : "Click to upload CSV or Excel (saved as CSV)"}
                    </span>
                    {bulkPreview && (
                      <button type="button" onClick={(ev) => { ev.stopPropagation(); setBulkPreview(null); setBulkResults(null); }}
                        className="ml-auto shrink-0 text-steel/40 hover:text-danger transition">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input ref={bulkCsvRef} type="file" accept=".csv,text/csv" onChange={handleBulkCsv} className="hidden" />

                  {/* Preview table */}
                  {bulkPreview && bulkPreview.rows.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-steel/10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-steel/5 border-b border-steel/10">
                            <th className="px-3 py-2 text-left font-semibold text-steel/70">#</th>
                            {bulkPreview.headers.map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-steel/70 capitalize">
                                {h.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.rows.slice(0, 10).map((row, i) => (
                            <tr key={row._id} className="border-b border-steel/5 hover:bg-fog/50">
                              <td className="px-3 py-1.5 text-steel/40">{i + 1}</td>
                              {bulkPreview.headers.map((h) => (
                                <td key={h} className="px-3 py-1.5 text-ink">{row[h] || <span className="text-steel/30">—</span>}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {bulkPreview.rows.length > 10 && (
                        <p className="px-3 py-2 text-xs text-steel/50">+ {bulkPreview.rows.length - 10} more rows</p>
                      )}
                    </div>
                  )}
                </Section>

                {/* Template PDF for bulk (optional) */}
                <Section title="Template PDF" subtitle="Optional — upload a PDF template to get a ZIP of overlaid certificates">
                  <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-steel/20 bg-fog/50 p-4 cursor-pointer hover:border-mint/50 transition mt-3"
                    onClick={() => fileRef.current?.click()}>
                    <FileText className="shrink-0 text-steel/40" size={22} />
                    <span className="text-sm text-steel/60 truncate">
                      {templateFile ? templateFile.name : "Click to upload PDF template (optional — without it, canvas certificates are generated)"}
                    </span>
                    {templateFile && (
                      <button type="button" onClick={(ev) => { ev.stopPropagation(); setTemplateFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        className="ml-auto shrink-0 text-steel/40 hover:text-danger transition">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
                </Section>

                {/* Progress */}
                {bulkProgress && (
                  <div className="rounded-2xl border border-steel/10 bg-white/80 p-5">
                    <p className="text-sm font-semibold text-ink mb-2">{bulkProgress.label}</p>
                    <div className="w-full bg-steel/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-mint rounded-full transition-all"
                        style={{ width: `${bulkProgress.total ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-steel/50 mt-1">{bulkProgress.current} / {bulkProgress.total}</p>
                  </div>
                )}

                {/* Bulk results */}
                {bulkResults && (
                  <BulkResults results={bulkResults} onReset={() => { setBulkResults(null); setBulkPreview(null); }} />
                )}
              </div>
            )}

            {/* ── RECIPIENT FIELDS (hidden in bulk mode) ───────────────────── */}
            {mode !== "bulk" && (
              <>
                <Section title="Required Fields">
                  {error && (
                    <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 mb-3 flex items-start gap-2">
                      <XCircle size={16} className="shrink-0 text-danger mt-0.5" />
                      <p className="text-sm text-danger font-semibold">{error}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-3">
                    <Field icon={<User size={17} />} label="Recipient Name *" value={required.name}
                      onChange={(v) => setRequired((p) => ({ ...p, name: v }))} required placeholder="Full name" />
                    <Field icon={<Trophy size={17} />} label="Event *" value={required.event}
                      onChange={(v) => setRequired((p) => ({ ...p, event: v }))} required placeholder="Event or competition name" />
                  </div>
                </Section>

                <Section title="Optional Fields" subtitle="Toggle on or off">
                  <div className="flex flex-wrap gap-2 mt-3">
                    {STANDARD_FIELDS.map((f) => (
                      <button key={f.key} type="button" onClick={() => toggleStd(f.key)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                          enabledStd.has(f.key) ? "bg-mint/10 border-mint/40 text-mint" : "bg-white border-steel/20 text-steel/60 hover:border-steel/40"
                        }`}>
                        {enabledStd.has(f.key)
                      ? <><CheckCircle size={12} className="inline mr-1" />{f.label}</>
                      : <><Plus size={12} className="inline mr-1" />{f.label}</>
                    }
                      </button>
                    ))}
                  </div>
                  {enabledStd.size > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
                      {STANDARD_FIELDS.filter((f) => enabledStd.has(f.key)).map((f) => (
                        <Field key={f.key} icon={<f.icon size={17} />} label={f.label} type={f.type}
                          value={stdValues[f.key] || ""} onChange={(v) => setStdValues((p) => ({ ...p, [f.key]: v }))}
                          placeholder={f.placeholder} onRemove={() => toggleStd(f.key)} />
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Custom Fields" subtitle="Add any extra fields">
                  {customFields.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {customFields.map((f) => (
                        <div key={f.id} className="flex gap-2 items-start">
                          <input type="text" placeholder="Field name" value={f.label}
                            onChange={(e) => updateCustomField(f.id, "label", e.target.value)}
                            className="w-2/5 min-w-0 rounded-xl border border-steel/20 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint focus:ring-2 focus:ring-mint/30" />
                          <input type="text" placeholder="Value" value={f.value}
                            onChange={(e) => updateCustomField(f.id, "value", e.target.value)}
                            className="flex-1 min-w-0 rounded-xl border border-steel/20 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint focus:ring-2 focus:ring-mint/30" />
                          <button type="button" onClick={() => removeCustomField(f.id)}
                            className="shrink-0 p-2.5 rounded-xl border border-steel/20 text-steel/40 hover:text-danger hover:border-danger/30 transition">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={addCustomField}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-steel/20 bg-white px-3 py-1.5 text-xs font-semibold text-steel hover:bg-fog transition">
                    <Plus size={13} /> Add Field
                  </button>
                </Section>
              </>
            )}

            {/* Bulk mode: show Event (shared) + error */}
            {mode === "bulk" && (
              <Section title="Shared Fields" subtitle="These values apply to all recipients in the CSV">
                {error && (
                  <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 mb-3">
                    <p className="text-sm text-danger font-semibold">{error}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-3">
                  <Field icon={<Trophy size={17} />} label="Event *" value={required.event}
                    onChange={(v) => setRequired((p) => ({ ...p, event: v }))} required placeholder="Event or competition name" />
                  <Field icon={<Building2 size={17} />} label="Organizer" value={stdValues.organizer || ""}
                    onChange={(v) => setStdValues((p) => ({ ...p, organizer: v }))} placeholder="Organizing body (can be overridden per-row in CSV)" />
                </div>
              </Section>
            )}

            {!bulkResults && (
              <>
                {credits === 0 && (
                  <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 flex items-center gap-2 text-sm text-danger font-semibold">
                    <CreditCard size={16} className="shrink-0" />
                    You have 0 credits. <a href="/dashboard" className="underline ml-1">Top up from the Dashboard</a>.
                  </div>
                )}
                <button type="submit" disabled={loading || credits === 0}
                  className="w-full rounded-xl bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading
                    ? (bulkProgress?.label || "Generating…")
                    : mode === "bulk" ? "Issue All Certificates" : "Issue Certificate"}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProjectSelector({ projects, selected, onSelect, onCreated, getIdToken }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const selectedProj = projects.find((p) => p.project_id === selected);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true); setErr("");
    try {
      const token = await getIdToken();
      const proj = await createProject({ name: newName.trim(), description: newDesc.trim() }, token);
      onCreated(proj);
      setNewName(""); setNewDesc(""); setCreating(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mb-5 animate-rise rounded-2xl border border-steel/10 bg-white/80 p-4 shadow-soft backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className="text-xs font-bold text-ink shrink-0">Project / Event:</span>
          <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="flex-1 min-w-0 max-w-xs rounded-lg border border-steel/20 bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-mint"
          >
            <option value="">— No project (default prefix) —</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.name}  [{p.prefix}]
              </option>
            ))}
          </select>
          {selectedProj && (
            <span className="rounded-full bg-mint/10 border border-mint/30 px-2.5 py-0.5 text-xs font-mono text-mint">
              Cert IDs: {selectedProj.prefix}-…
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-steel/20 bg-white hover:bg-fog px-3 py-1.5 text-xs font-semibold text-steel transition"
        >
          <Plus size={13} /> New Project
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2 items-end border-t border-steel/10 pt-3">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-semibold text-steel mb-1 block">Project / Event Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Design Competition 2026"
              className="w-full rounded-lg border border-steel/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mint"
              required
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs font-semibold text-steel mb-1 block">Description (optional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short description"
              className="w-full rounded-lg border border-steel/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </div>
          {newName.trim() && (
            <span className="text-xs text-steel/50 self-center">
              Prefix preview: <span className="font-mono font-semibold text-ink">{previewPrefix(newName)}</span>
            </span>
          )}
          {err && <p className="w-full text-xs text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-mint hover:bg-mint/90 text-white text-xs font-semibold px-4 py-2 transition disabled:opacity-60">
              {saving ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setErr(""); }}
              className="rounded-lg border border-steel/20 bg-white text-xs font-semibold px-3 py-2 text-steel hover:bg-fog transition">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Mirror of backend generate_prefix for live preview
function previewPrefix(name) {
  const words = name.trim().split(/\s+/);
  let year = "";
  const filtered = [];
  for (const w of words) {
    if (/^\d{4}$/.test(w)) year = w;
    else filtered.push(w);
  }
  const base = filtered.length ? filtered : words;
  const initials = base
    .map((w) => (w[0] || "").toUpperCase())
    .filter((c) => /[A-Z]/.test(c))
    .slice(0, 6)
    .join("");
  const y = year || new Date().getFullYear().toString();
  return (initials || "CERT") + y;
}

function Section({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-steel/10 bg-white/80 p-5 shadow-soft backdrop-blur-sm sm:p-6">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-xs text-steel/50 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({ icon, label, value, onChange, required, placeholder, type = "text", onRemove }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold text-steel">{label}</label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-steel/30 hover:text-danger transition">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-steel/40">{icon}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          required={required} placeholder={placeholder}
          className="w-full rounded-xl border border-steel/20 bg-white pl-10 pr-3 py-2.5 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
        />
      </div>
    </div>
  );
}

function BulkResults({ results, onReset }) {
  // ZIP result (upload mode)
  if (results?.[0]?.zip) {
    return (
      <div className="animate-rise rounded-3xl border border-mint/30 bg-mint/5 p-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="rounded-full bg-mint/20 p-4"><Download className="text-mint" size={32} /></div>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink mb-1">Bulk Issue Complete!</h2>
        <p className="text-steel/70 text-sm mb-4">{results[0].count} certificates generated and downloaded as ZIP.</p>
        <button onClick={onReset} className="rounded-xl border border-steel/20 bg-white hover:bg-fog text-steel font-semibold py-2.5 px-5 transition">
          Issue Another Batch
        </button>
      </div>
    );
  }

  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  return (
    <div className="animate-rise space-y-4">
      <div className="rounded-3xl border border-mint/30 bg-mint/5 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {succeeded.length}/{results.length} Certificates Issued
            </h2>
            {failed.length > 0 && (
              <p className="text-xs text-danger mt-0.5">{failed.length} failed</p>
            )}
          </div>
          <button onClick={onReset} className="rounded-xl border border-steel/20 bg-white hover:bg-fog text-steel text-sm font-semibold py-2 px-4 transition">
            Issue Another Batch
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${r.error ? "border-danger/20 bg-danger/5" : "border-steel/10 bg-white"}`}>
              {r.error
                ? <XCircle size={16} className="shrink-0 text-danger" />
                : <CheckCircle size={16} className="shrink-0 text-mint" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.meta?.name || `Row ${i + 1}`}</p>
                {r.error
                  ? <p className="text-xs text-danger truncate">{r.error}</p>
                  : <p className="text-xs text-steel/60 font-mono truncate">{r.meta?.certificate_id}</p>
                }
              </div>
              {r.pdfUrl && (
                <a href={r.pdfUrl} download={r.filename}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-ink hover:bg-steel text-white text-xs font-semibold py-1.5 px-3 transition">
                  <Download size={12} /> PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CertificateResult({ result, onReset }) {
  return (
    <div className="animate-rise space-y-6">
      <div className="rounded-3xl border border-mint/30 bg-mint/5 p-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="rounded-full bg-mint/20 p-4"><Trophy className="text-mint" size={32} /></div>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink mb-1">Certificate Issued!</h2>
        <p className="text-steel/70 text-sm mb-1">
          Certificate ID: <span className="font-mono font-semibold text-ink">{result.certId}</span>
        </p>
        {result.verifyUrl && (
          <p className="text-xs text-steel/50 break-all mb-4">
            <a href={result.verifyUrl} target="_blank" rel="noopener noreferrer" className="text-mint hover:underline">{result.verifyUrl}</a>
          </p>
        )}
        {!result.hasPdf && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            No template was uploaded — record saved without PDF.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {result.hasPdf && (
            <a href={result.pdfUrl} download={result.filename}
              className="rounded-xl bg-ink hover:bg-steel text-white font-semibold py-2.5 px-5 transition flex items-center justify-center gap-2">
              <Download size={16} /> Download PDF
            </a>
          )}
          <button onClick={onReset}
            className="rounded-xl border border-steel/20 bg-white hover:bg-fog text-steel font-semibold py-2.5 px-5 transition">
            Issue Another
          </button>
        </div>
      </div>
    </div>
  );
}
