import { useState, useEffect } from "react";
import {
  ArrowLeft, User, Lock, Bell, Shield, Zap, Save, Upload,
  Moon, Sun, Trash2, AlertTriangle, Eye, EyeOff, CreditCard, Download,
} from "lucide-react";
import {
  updateProfile, updatePassword,
  reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider,
} from "firebase/auth";
import { googleProvider } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useTheme } from "./context/ThemeContext";
import { useAuth } from "./context/AuthContext";
import { firestore } from "./firebase";
import { addCredits, exportData, deleteAccount } from "./api/users";

export default function Settings({ onBack }) {
  const { darkMode, setDarkMode } = useTheme();
  const { user: firebaseUser, logout, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  const isEmailUser = firebaseUser?.providerData?.[0]?.providerId === "password";

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profileData, setProfileData] = useState({
    fullName: firebaseUser?.displayName || "",
    organization: "",
  });
  const [avatarPreview, setAvatarPreview] = useState(
    firebaseUser?.photoURL || null
  );
  const initials = (() => {
    const name = firebaseUser?.displayName || firebaseUser?.email || "";
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || "?";
  })();

  // ── Security state ─────────────────────────────────────────────────────────
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // ── Notification state ─────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState({
    emailOnIssue: true,
    emailOnVerify: true,
    emailOnLowCredits: true,
    emailWeeklyDigest: false,
    pushNotifications: true,
  });

  // ── Credits ────────────────────────────────────────────────────────────────
  const [credits, setCredits] = useState(null);
  const [totalIssued, setTotalIssued] = useState(0);
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(doc(firestore, "users", firebaseUser.uid), (snap) => {
      if (snap.exists()) {
        setCredits(snap.data().credits ?? 0);
        setTotalIssued(snap.data().total_issued ?? 0);
      }
    });
    return unsub;
  }, [firebaseUser]);

  // ── Top-up state ───────────────────────────────────────────────────────────
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [topUpLoading, setTopUpLoading] = useState(false);

  // ── Delete account state ───────────────────────────────────────────────────
  const [deleteInput, setDeleteInput] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Messages ───────────────────────────────────────────────────────────────
  const [msg, setMsg] = useState({ text: "", type: "" });
  const flash = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    try {
      await updateProfile(firebaseUser, { displayName: profileData.fullName.trim() || null });
      flash("Profile updated successfully.");
    } catch (e) {
      flash(e.message, "error");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (!securityData.currentPassword || !securityData.newPassword) {
      flash("Please fill in all password fields.", "error");
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      flash("New passwords do not match.", "error");
      return;
    }
    if (securityData.newPassword.length < 8) {
      flash("New password must be at least 8 characters.", "error");
      return;
    }
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, securityData.currentPassword);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, securityData.newPassword);
      setSecurityData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      flash("Password changed successfully.");
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        flash("Current password is incorrect.", "error");
      } else {
        flash(e.message, "error");
      }
    }
  };

  const handleTopUp = async () => {
    if (topUpAmount < 1) return;
    setTopUpLoading(true);
    try {
      const token = await getIdToken();
      await addCredits(topUpAmount, token);
      flash(`Added ${topUpAmount} credits to your account.`);
    } catch (e) {
      flash(e.message, "error");
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const token = await getIdToken();
      const res = await exportData(token);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cerbro-export-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash(e.message, "error");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") return;
    if (isEmailUser && !deletePassword) {
      flash("Enter your current password to confirm deletion.", "error");
      return;
    }
    setDeleteLoading(true);
    try {
      // Re-authenticate BEFORE touching any data
      if (isEmailUser) {
        const cred = EmailAuthProvider.credential(firebaseUser.email, deletePassword);
        await reauthenticateWithCredential(firebaseUser, cred);
      } else {
        await reauthenticateWithPopup(firebaseUser, googleProvider);
      }

      // Fresh token after re-auth
      const token = await firebaseUser.getIdToken(true);

      // Delete Firebase Auth account first (if this fails, backend data is untouched)
      await firebaseUser.delete();

      // Wipe backend data (best-effort — user is already gone from Auth)
      await deleteAccount(token).catch(() => {});

      await logout();
      window.location.href = "/login";
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        flash("Incorrect password.", "error");
      } else if (e.code === "auth/popup-closed-by-user") {
        flash("Google sign-in popup was closed. Try again.", "error");
      } else {
        flash(e.message, "error");
      }
      setDeleteLoading(false);
    }
  };

  // ── Shared input class ─────────────────────────────────────────────────────
  const inputCls =
    "w-full rounded-xl border border-steel/20 dark:border-steel/40 bg-white dark:bg-steel/40 px-4 py-3 text-ink dark:text-fog outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30";

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 animate-rise">
          <button onClick={onBack} className="flex items-center gap-2 text-steel hover:text-ink transition mb-4">
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1 className="font-display text-3xl font-bold text-ink dark:text-fog">Settings</h1>
          <p className="text-steel/70 text-sm mt-2">Manage your account preferences and security settings</p>
        </div>

        {/* Flash message */}
        {msg.text && (
          <div className={`mb-6 animate-rise rounded-xl border p-4 ${
            msg.type === "error"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-mint/30 bg-mint/10 text-mint"
          }`}>
            <p className="text-sm font-semibold">{msg.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-4 shadow-soft backdrop-blur-sm sticky top-8">
              <div className="space-y-2">
                {[
                  { id: "profile", label: "Profile", icon: User },
                  { id: "security", label: "Security", icon: Lock },
                  { id: "notifications", label: "Notifications", icon: Bell },
                  { id: "privacy", label: "Privacy & Data", icon: Shield },
                  { id: "billing", label: "Credits", icon: Zap },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                      activeTab === id
                        ? "bg-mint text-white font-semibold"
                        : "text-steel dark:text-fog/70 hover:bg-fog dark:hover:bg-steel/40"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 animate-rise [animation-delay:100ms]">

            {/* ── Profile Tab ─────────────────────────────────────────────── */}
            {activeTab === "profile" && (
              <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-8 shadow-soft backdrop-blur-sm">
                <h2 className="font-display text-2xl font-bold text-ink dark:text-fog mb-6">Profile Information</h2>
                <div className="space-y-6">
                  {/* Avatar */}
                  <div>
                    <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-4">Profile Picture</label>
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mint to-mint/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {avatarPreview && avatarPreview.length > 10 ? (
                          <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-display text-2xl font-bold">{initials}</span>
                        )}
                      </div>
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-fog dark:bg-steel/40 hover:bg-steel/10 text-ink dark:text-fog font-semibold rounded-xl transition cursor-pointer text-sm">
                        <Upload size={16} />
                        Change Photo
                        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Dark mode toggle */}
                  <div className="py-4 border-t border-b border-steel/10 dark:border-steel/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {darkMode ? <Moon size={18} className="text-amber" /> : <Sun size={18} className="text-amber" />}
                        <div>
                          <p className="font-semibold text-ink dark:text-fog">Dark Mode</p>
                          <p className="text-xs text-steel/60">Switch between light and dark theme</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${darkMode ? "bg-mint" : "bg-steel/20"}`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${darkMode ? "translate-x-7" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Display name */}
                  <div>
                    <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">Display Name</label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData((p) => ({ ...p, fullName: e.target.value }))}
                      className={inputCls}
                      placeholder="Your name"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={firebaseUser?.email || ""}
                      readOnly
                      className={`${inputCls} opacity-60 cursor-not-allowed`}
                    />
                    <p className="text-xs text-steel/50 mt-1">Email cannot be changed from here.</p>
                  </div>

                  {/* Organization */}
                  <div>
                    <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">Organization</label>
                    <input
                      type="text"
                      value={profileData.organization}
                      onChange={(e) => setProfileData((p) => ({ ...p, organization: e.target.value }))}
                      className={inputCls}
                      placeholder="Your club / college / company"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    Save Profile
                  </button>
                </div>
              </div>
            )}

            {/* ── Security Tab ─────────────────────────────────────────────── */}
            {activeTab === "security" && (
              <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-8 shadow-soft backdrop-blur-sm">
                <h2 className="font-display text-2xl font-bold text-ink dark:text-fog mb-6">Security Settings</h2>

                {isEmailUser ? (
                  <div className="space-y-5">
                    <p className="text-sm text-steel/70">Change the password for <span className="font-semibold text-ink dark:text-fog">{firebaseUser?.email}</span>.</p>

                    {[
                      { key: "currentPassword", label: "Current Password", show: showPw.current, toggle: () => setShowPw((p) => ({ ...p, current: !p.current })) },
                      { key: "newPassword", label: "New Password", show: showPw.new, toggle: () => setShowPw((p) => ({ ...p, new: !p.new })) },
                      { key: "confirmPassword", label: "Confirm New Password", show: showPw.confirm, toggle: () => setShowPw((p) => ({ ...p, confirm: !p.confirm })) },
                    ].map(({ key, label, show, toggle }) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">{label}</label>
                        <div className="relative">
                          <input
                            type={show ? "text" : "password"}
                            value={securityData[key]}
                            onChange={(e) => setSecurityData((p) => ({ ...p, [key]: e.target.value }))}
                            className={`${inputCls} pr-11`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={toggle}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-steel/50 hover:text-steel transition"
                          >
                            {show ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleChangePassword}
                      className="w-full bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <Lock size={18} />
                      Update Password
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-steel/10 bg-fog dark:bg-steel/20 p-6 text-center">
                    <p className="text-sm text-steel/70">
                      You signed in with Google. Password management is handled through your Google account.
                    </p>
                  </div>
                )}

                <div className="border-t border-steel/10 dark:border-steel/40 pt-6 mt-8">
                  <h3 className="font-semibold text-ink dark:text-fog mb-4">Signed-in Providers</h3>
                  <div className="flex flex-wrap gap-2">
                    {firebaseUser?.providerData?.map((p) => (
                      <span key={p.providerId} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-mint/10 text-mint border border-mint/30">
                        {p.providerId === "password" ? "Email / Password" : p.providerId}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Notifications Tab ─────────────────────────────────────────── */}
            {activeTab === "notifications" && (
              <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-8 shadow-soft backdrop-blur-sm">
                <h2 className="font-display text-2xl font-bold text-ink dark:text-fog mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { id: "emailOnIssue", label: "Certificate Issued", desc: "Get notified when you issue a certificate" },
                    { id: "emailOnVerify", label: "Certificate Verified", desc: "Get notified when someone verifies your certificate" },
                    { id: "emailOnLowCredits", label: "Low Credits Alert", desc: "Alert when your credit balance drops below 3" },
                    { id: "emailWeeklyDigest", label: "Weekly Digest", desc: "Receive a weekly summary of your activity" },
                    { id: "pushNotifications", label: "Push Notifications", desc: "Enable browser push notifications" },
                  ].map(({ id, label, desc }) => (
                    <div key={id} className="flex items-center justify-between p-4 border border-steel/10 dark:border-steel/30 rounded-xl hover:bg-fog dark:hover:bg-steel/20 transition">
                      <div>
                        <p className="font-semibold text-ink dark:text-fog text-sm">{label}</p>
                        <p className="text-xs text-steel/60 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications((p) => ({ ...p, [id]: !p[id] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${notifications[id] ? "bg-mint" : "bg-steel/20"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifications[id] ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => flash("Notification preferences saved.")}
                  className="w-full mt-6 bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Preferences
                </button>
              </div>
            )}

            {/* ── Privacy Tab ───────────────────────────────────────────────── */}
            {activeTab === "privacy" && (
              <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-8 shadow-soft backdrop-blur-sm space-y-6">
                <h2 className="font-display text-2xl font-bold text-ink dark:text-fog">Privacy & Data</h2>

                {/* Export */}
                <div className="border border-steel/10 dark:border-steel/40 rounded-xl p-6">
                  <h3 className="font-semibold text-ink dark:text-fog mb-1">Export Your Data</h3>
                  <p className="text-sm text-steel/70 mb-2">Download a ZIP containing all your certificates (CSV), projects, and account info.</p>
                  <p className="text-xs text-steel/50 mb-4">Includes: <span className="font-mono">certificates.csv</span>, <span className="font-mono">projects.json</span>, <span className="font-mono">account.json</span></p>
                  <button
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="flex items-center gap-2 bg-steel hover:bg-ink disabled:opacity-40 text-white font-semibold py-2 px-6 rounded-lg transition text-sm"
                  >
                    <Download size={15} />
                    {exportLoading ? "Preparing…" : "Export My Data"}
                  </button>
                </div>

                {/* Delete account */}
                <div className="border border-danger/40 bg-danger/5 rounded-xl p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-danger mb-1">Delete Account</h3>
                      <p className="text-sm text-steel/70">
                        This permanently deletes your account, all certificates, all projects, and your credit balance. This action <span className="font-semibold text-ink dark:text-fog">cannot be undone</span>.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">
                      Type <span className="font-mono text-danger">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      className={`${inputCls} border-danger/30 focus:border-danger focus:ring-danger/20`}
                      placeholder="DELETE"
                    />
                  </div>

                  {isEmailUser && (
                    <div>
                      <label className="block text-sm font-semibold text-steel dark:text-fog/70 mb-2">
                        Current password
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className={`${inputCls} border-danger/30 focus:border-danger focus:ring-danger/20`}
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || deleteLoading || (isEmailUser && !deletePassword)}
                    className="flex items-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm"
                  >
                    <Trash2 size={16} />
                    {deleteLoading ? "Deleting…" : "Delete My Account"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Credits / Billing Tab ─────────────────────────────────────── */}
            {activeTab === "billing" && (
              <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-8 shadow-soft backdrop-blur-sm space-y-6">
                <h2 className="font-display text-2xl font-bold text-ink dark:text-fog">Credits</h2>

                {/* Balance card */}
                <div className="rounded-2xl border border-mint/30 bg-mint/10 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-steel/70 mb-1">Current Balance</p>
                    <p className="font-display text-5xl font-bold text-ink dark:text-fog">
                      {credits === null ? "—" : credits}
                    </p>
                    <p className="text-xs text-steel/60 mt-1">credits remaining</p>
                  </div>
                  <CreditCard size={48} className="text-mint opacity-40" />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-steel/10 dark:border-steel/40 p-4 text-center">
                    <p className="text-sm text-steel/60 mb-1">Total Issued</p>
                    <p className="font-display text-2xl font-bold text-ink dark:text-fog">{totalIssued}</p>
                  </div>
                  <div className="rounded-xl border border-steel/10 dark:border-steel/40 p-4 text-center">
                    <p className="text-sm text-steel/60 mb-1">1 credit</p>
                    <p className="font-display text-sm font-bold text-ink dark:text-fog mt-1">= 1 certificate</p>
                  </div>
                </div>

                {/* Top-up */}
                <div className="border border-steel/10 dark:border-steel/40 rounded-xl p-6 space-y-4">
                  <h3 className="font-semibold text-ink dark:text-fog">Add Credits</h3>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 25, 50, 100].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTopUpAmount(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                          topUpAmount === n
                            ? "bg-mint text-white border-mint"
                            : "border-steel/20 text-steel dark:text-fog/70 hover:bg-fog dark:hover:bg-steel/30"
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(Number(e.target.value))}
                      className="w-24 rounded-lg border border-steel/20 dark:border-steel/40 bg-white dark:bg-steel/40 px-3 py-2 text-ink dark:text-fog text-sm outline-none focus:border-mint"
                    />
                  </div>
                  <button
                    onClick={handleTopUp}
                    disabled={topUpLoading || topUpAmount < 1}
                    className="flex items-center gap-2 bg-mint hover:bg-mint/90 disabled:opacity-40 text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm"
                  >
                    <Zap size={16} />
                    {topUpLoading ? "Adding…" : `Add ${topUpAmount} Credits`}
                  </button>
                  <p className="text-xs text-steel/50">Credits are added instantly to your account.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
