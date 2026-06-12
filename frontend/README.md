# 🎓 Cerbro

**The Ultimate Digital Certificate Platform**

Cerbro makes certificates digital, portable, and instantly verifiable. Issuers sign certificates. Holders access them anytime, anywhere. Recipients verify with a single scan.

---

## 📍 Where We Are Now

**Currently Available:** ✅ Certificate Verification
- **Scan or paste** any certificate QR code / URL
- **Instant cryptographic verification** via HMAC-SHA256 signatures
- **See certificate details** in real-time (name, event, position, timestamp, etc.)
- **Zero friction** – no signup, no account, just scan and trust

**Coming Soon:** 🚀 Certificate Issuance
- Dashboard for institutions to create and sign certificates
- Bulk upload and management tools
- Custom branding and templates
- Direct distribution to certificate holders

For now, if you have pre-signed certificates (with QR codes and signatures), Cerbro's verification portal can validate them instantly. The issuance platform is on the way!

---

## 🎯 The Problem

Paper certificates get lost. Email links expire. Verification is manual and slow. Sharing is cumbersome. Trust is hard to establish.

## ✨ The Cerbro Solution

**For Certificate Issuers:**
- Generate cryptographically signed digital certificates
- Shareable via QR codes and URLs
- Recipients get a portable credential they own

**For Certificate Holders:**
- Access your certificate 24/7 from anywhere
- Share it with anyone—job interviews, events, verification boards
- One QR code proves authenticity instantly

**For Certificate Verifiers:**
- No paperwork, no phone calls, no databases
- Scan the QR code
- Cerbro instantly confirms: **VALID**, **INVALID**, or **NOT_FOUND**

---

## 🔄 The Complete Flow

### 1. **Issuance** (Issuer Side)
Institutions use Cerbro's backend to:
- Create and sign certificates with HMAC-SHA256 cryptography
- Generate QR codes containing signed payloads (id, timestamp, key, signature)
- Deliver to certificate holders via QR or shareable link

### 2. **Storage & Access** (Holder Side)
Certificate holders:
- Receive their digital certificate (QR code or link)
- Store it in their phone, email, or password manager
- Access anytime—no loss, no expiration

### 3. **Sharing** (Holder to Verifier)
Certificate holders can:
- Share the QR code (via screenshot, printed certificate, etc.)
- Share the verifiable link directly
- Recipients don't need any app—just scan and view

### 4. **Verification** (Verifier Side)
Anyone who receives the certificate can:
- **Scan the QR code** with any smartphone camera
- **Or paste the link** into Cerbro's verification portal
- **Get instant result**: Is this certificate genuine?
- No signup, no database lookup, cryptography does the trust

---

## 📱 How to Use Cerbro Verification Portal

1. **Receive a certificate** QR code or share link from someone
2. **Scan with your phone camera** (or paste the link here)
3. **View the verified details** instantly:
   - Holder's name, event, position
   - Issuance timestamp
   - Cryptographic verification status
4. **Trust established.** No intermediary, no delay.

---

## 🔐 Why Cerbro Works

**Cryptographic Trust**
- Issued certificates are signed with HMAC-SHA256
- Each signature is unique to the certificate content
- Forgery is mathematically impossible without the issuer's secret key

**Zero Friction**
- No accounts needed
- No app download required
- Works with any smartphone camera
- Verification happens in milliseconds

**Portable Credentials**
- Certificates exist as shareable QR codes/links
- Recipients own their credential
- Works across all contexts: job boards, event check-ins, verification calls

---

## 🛠️ Tech Stack
- **Frontend**: React 18 + Vite 5 + Tailwind CSS 3
- **QR Scanning**: html5-qrcode (camera + paste fallback)
- **Verification Engine**: HMAC-SHA256 cryptographic signatures
- **Backend**: Google Apps Sheet-backed Apps Script service
- **Deployment**: Production-ready with env-based configuration

---

## 📋 Setup Instructions

### Prerequisites
- Node.js 20+
- `.env` file with backend credentials

### Getting Started
1. **Install**
   ```bash
   npm install
   ```

2. **Configure**
   - Copy `.env.example` to `.env`
   - Set `VITE_CERT_VERIFY_API` (your verification backend URL)
   - Set `VITE_DEPLOYMENT_ID` (deployment identifier)

3. **Run**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173`

4. **Build**
   ```bash
   npm run build
   ```

5. **Lint** (optional)
   ```bash
   npm run lint
   ```

---

## 🔐 Verification Flow (Technical)

### What Happens on Scan

**Payload Extraction:**
- QR code contains: `id=<CERT_ID>&ts=<TIMESTAMP>&kid=<KEY_ID>&sig=<SIGNATURE>`

**Signature Verification:**
- Frontend sends GET request with all parameters to Cerbro backend
- Backend recalculates the HMAC-SHA256 signature using the same key
- Compares provided signature with calculated signature
- If they match: Certificate is **VALID**
- If they don't match or cert not found: **INVALID** or **NOT_FOUND**

**Response Contract:**
```json
{
  "status": "VALID|INVALID|NOT_FOUND",
  "data": {
    "name": "John Doe",
    "event": "General Championship",
    "position": "1st",
    "certificate_id": "CERT123",
    "timestamp_utc": "2024-01-01T10:00:00Z",
    ...
  }
}
```

---

## ✅ Verification Results

### Success ✅
- Certificate details displayed in a clean grid
- Contains: name, event, position, entry number, hall, timestamp, email
- Status badge shows **Verified**

### Failure ❌
- Clear error message: `Invalid QR signature` or `Certificate not found`
- Status badge shows **Invalid**
- User guided to troubleshoot or contact issuer

---
### Push to Git
```bash
git add .
git commit -m "Initial Cerbro: Digital certificate platform with QR verification"
git push origin main
```

---

## 💬 Support

- **Camera permission denied?** Allow camera access in your browser settings
- **Certificate won't verify?** Ensure the backend service is running and URL is correct
- **QR code not scanning?** Use the paste fallback to enter the certificate URL manually
- **Need a backend?** Use the reference Google Apps Script library and backend service

---

**Cerbro: Issue. Share. Verify. Instantly. ✨**
