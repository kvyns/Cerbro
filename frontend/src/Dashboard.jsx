import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Download, Share2, Trash2, Plus, CreditCard, FileText, Folder, Archive, TrendingUp, LogOut, Settings, Bell, X, Zap, ArrowLeft, CheckCircle } from "lucide-react";
import Notifications from "./Notifications";
import SettingsPage from "./Settings";
import { useAuth } from "./context/AuthContext";
import { firestore } from "./firebase";
import { listCertificates } from "./api/certificates";
import { listProjects, deleteProject } from "./api/projects";
import { getMe } from "./api/users";

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export default function Dashboard() {
  const { user: firebaseUser, logout, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [currentView, setCurrentView] = useState("dashboard");
  const [issuedCertificates, setIssuedCertificates] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [openProject, setOpenProject] = useState(null);
  const [credits, setCredits] = useState(null); // null = loading

  const user = {
    name: firebaseUser?.displayName || "",
    email: firebaseUser?.email || "",
    photoURL: firebaseUser?.photoURL || null,
    initials: getInitials(firebaseUser?.displayName, firebaseUser?.email),
  };

  useEffect(() => {
    if (!firebaseUser) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const data = await listCertificates(token);
        if (!cancelled) setIssuedCertificates(data);
      } catch {
        // backend may not be running; silently ignore
      } finally {
        if (!cancelled) setCertsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser]);

  // Real-time credits listener via Firestore
  useEffect(() => {
    if (!firebaseUser) return;
    // Initialise user doc on backend (creates it with 10 credits if new)
    getIdToken().then((token) => getMe(token).catch(() => {}));
    // Subscribe to live credit updates
    const unsub = onSnapshot(doc(firestore, "users", firebaseUser.uid), (snap) => {
      if (snap.exists()) setCredits(snap.data().credits ?? 0);
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const data = await listProjects(token);
        if (!cancelled) setProjects(data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const now = new Date();
  const thisMonthCount = issuedCertificates.filter((c) => {
    const d = new Date(c.timestamp_utc);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const lastMonthCount = issuedCertificates.filter((c) => {
    const d = new Date(c.timestamp_utc);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  }).length;
  const monthDiff = thisMonthCount - lastMonthCount;

  const stats = {
    certificatesIssued: issuedCertificates.length,
    vaultCertificates: 0,
    creditsRemaining: credits ?? "—",
    creditsUsed: issuedCertificates.length,
    thisMonthCount,
    lastMonthCount,
    monthDiff,
  };

  const vaultCertificates = [];
  const creditHistory = [];
  const showOrganizer = issuedCertificates.some((cert) => (cert.organizer || "").trim());

  return (
    <>
      {currentView === "notifications" && (
        <Notifications onBack={() => setCurrentView("dashboard")} />
      )}
      {currentView === "settings" && (
        <SettingsPage onBack={() => setCurrentView("dashboard")} />
      )}
      {currentView === "dashboard" && (
        <DashboardContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onNotificationsClick={() => setCurrentView("notifications")}
          onSettingsClick={() => setCurrentView("settings")}
          onLogout={handleLogout}
          stats={stats}
          issuedCertificates={issuedCertificates}
          certsLoading={certsLoading}
          vaultCertificates={vaultCertificates}
          creditHistory={creditHistory}
          showOrganizer={showOrganizer}
          user={user}
          projects={projects}
          projectsLoading={projectsLoading}
          getIdToken={getIdToken}
          setProjects={setProjects}
          openProject={openProject}
          setOpenProject={setOpenProject}
          credits={credits}
        />
      )}
    </>
  );
}

function DashboardContent({
  activeTab,
  setActiveTab,
  onNotificationsClick,
  onSettingsClick,
  onLogout,
  stats,
  issuedCertificates,
  certsLoading,
  vaultCertificates,
  creditHistory,
  showOrganizer,
  user,
  projects,
  projectsLoading,
  getIdToken,
  setProjects,
  openProject,
  setOpenProject,
  credits,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 dark:border-steel/40 bg-white/50 dark:bg-ink/20 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-2xl font-bold text-ink dark:text-fog hover:text-steel dark:hover:text-mint transition">
              Cerbro
            </a>
            <div className="flex gap-4 items-center">
              <button onClick={onNotificationsClick} className="text-steel hover:text-ink transition">
                <Bell size={20} />
              </button>
              <button onClick={onSettingsClick} className="text-steel hover:text-ink transition">
                <Settings size={20} />
              </button>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-white font-bold text-sm">
                  {user.initials}
                </div>
              )}
              <button onClick={onLogout} className="text-steel hover:text-danger transition">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-8 sm:px-8">
        {/* User Profile Header */}
        <div className="mb-8 animate-rise rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/70 dark:bg-ink/80 p-6 shadow-soft backdrop-blur-md sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-ink dark:text-fog mb-1">
                Welcome back, {user.name || user.email}!
              </h1>
              <p className="text-steel/70 dark:text-fog/60 text-sm">
                {user.email}
              </p>
            </div>
            <a href="/issue-certificate" className="bg-mint hover:bg-mint/90 text-white font-semibold py-2.5 px-6 rounded-xl transition flex items-center gap-2">
              <Plus size={18} />
              Issue Certificate
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Certificates Issued */}
          <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-steel/70">Certificates Issued</h3>
              <FileText className="text-amber" size={20} />
            </div>
            <p className="font-display text-4xl font-bold text-ink mb-1">{stats.certificatesIssued}</p>
            <p className="text-xs text-mint font-semibold flex items-center gap-1"><TrendingUp size={11} /> {issuedCertificates.length} total</p>
          </div>

          {/* Vault Certificates */}
          <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:150ms]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-steel/70">Your Certificates</h3>
              <Archive className="text-mint" size={20} />
            </div>
            <p className="font-display text-4xl font-bold text-ink mb-1">{stats.vaultCertificates}</p>
            <p className="text-xs text-steel/60">In your vault</p>
          </div>

          {/* Credits Available */}
          <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:200ms]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-steel/70">Credits Available</h3>
              <CreditCard className="text-amber" size={20} />
            </div>
            <p className={`font-display text-4xl font-bold mb-1 ${credits === 0 ? "text-danger" : "text-ink"}`}>
              {stats.creditsRemaining}
            </p>
            {credits === 0
              ? <p className="text-xs text-danger font-semibold">No credits — top up to issue</p>
              : <p className="text-xs text-steel/60">{stats.creditsUsed} certificates issued</p>
            }
          </div>

          {/* This month */}
          <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:250ms]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-steel/70">This Month</h3>
              <TrendingUp className="text-mint" size={20} />
            </div>
            <p className="font-display text-4xl font-bold text-ink mb-1">{stats.thisMonthCount}</p>
            {certsLoading ? (
              <p className="text-xs text-steel/40">Loading…</p>
            ) : stats.lastMonthCount === 0 && stats.thisMonthCount === 0 ? (
              <p className="text-xs text-steel/50">No certificates yet</p>
            ) : stats.monthDiff > 0 ? (
              <p className="text-xs text-mint font-semibold flex items-center gap-1">
                <TrendingUp size={11} /> {stats.monthDiff} more than last month
              </p>
            ) : stats.monthDiff < 0 ? (
              <p className="text-xs text-amber font-semibold flex items-center gap-1">
                <TrendingUp size={11} className="rotate-180" /> {Math.abs(stats.monthDiff)} fewer than last month
              </p>
            ) : (
              <p className="text-xs text-steel/60">Same as last month ({stats.lastMonthCount})</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-steel/10">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-3 font-semibold text-sm transition-colors ${
                activeTab === "overview"
                  ? "text-ink border-b-2 border-mint -mb-1"
                  : "text-steel/70 hover:text-steel"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("issued")}
              className={`py-3 font-semibold text-sm transition-colors ${
                activeTab === "issued"
                  ? "text-ink border-b-2 border-mint -mb-1"
                  : "text-steel/70 hover:text-steel"
              }`}
            >
              Certificates Issued
            </button>
            <button
              onClick={() => setActiveTab("vault")}
              className={`py-3 font-semibold text-sm transition-colors ${
                activeTab === "vault"
                  ? "text-ink border-b-2 border-mint -mb-1"
                  : "text-steel/70 hover:text-steel"
              }`}
            >
              Your Vault
            </button>
            <button
              onClick={() => setActiveTab("credits")}
              className={`py-3 font-semibold text-sm transition-colors ${
                activeTab === "credits"
                  ? "text-ink border-b-2 border-mint -mb-1"
                  : "text-steel/70 hover:text-steel"
              }`}
            >
              Credits
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-rise">

            {/* Projects / Event Folders */}
            <div className="rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
              {openProject ? (
                /* ── Project drill-down ── */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setOpenProject(null)}
                      className="rounded-xl border border-steel/20 bg-white hover:bg-fog px-3 py-1.5 text-xs font-semibold text-steel transition flex items-center gap-1">
                      <ArrowLeft size={13} /> Back
                    </button>
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-bold text-ink truncate">{openProject.name}</h2>
                      <span className="text-xs font-mono text-steel/50">{openProject.prefix}-…</span>
                    </div>
                    <a href="/issue-certificate"
                      className="ml-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-mint hover:bg-mint/90 text-white px-3 py-1.5 text-xs font-semibold transition">
                      <Plus size={13} /> Issue
                    </a>
                  </div>
                  {(() => {
                    const certs = issuedCertificates.filter((c) => c.project_id === openProject.project_id);
                    if (certsLoading) return <p className="text-sm text-steel/50">Loading…</p>;
                    if (!certs.length) return (
                      <p className="text-sm text-steel/50">No certificates in this project yet.</p>
                    );
                    return (
                      <div className="overflow-x-auto rounded-xl border border-steel/10">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-steel/5 border-b border-steel/10 text-xs text-steel/60 uppercase tracking-wide">
                              <th className="py-2.5 px-4 text-left">Recipient</th>
                              <th className="py-2.5 px-4 text-left">Cert ID</th>
                              <th className="py-2.5 px-4 text-left">Position</th>
                              <th className="py-2.5 px-4 text-left">Date</th>
                              <th className="py-2.5 px-4 text-right">Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {certs.map((cert) => (
                              <tr key={cert.certificate_id} className="border-b border-steel/5 hover:bg-fog/50">
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-ink">{cert.name}</p>
                                  {cert.entry_number && <p className="text-xs text-steel/50">{cert.entry_number}</p>}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-steel/60 max-w-[180px] truncate">{cert.certificate_id}</td>
                                <td className="py-3 px-4 text-steel/70">{cert.position || "—"}</td>
                                <td className="py-3 px-4 text-steel/60 text-xs">{new Date(cert.timestamp_utc).toLocaleDateString()}</td>
                                <td className="py-3 px-4 text-right">
                                  {cert.verification_url && (
                                    <a href={cert.verification_url} target="_blank" rel="noopener noreferrer"
                                      className="text-steel/50 hover:text-mint transition">
                                      <Share2 size={15} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* ── Projects grid ── */
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-xl font-bold text-ink">Projects</h2>
                    <a href="/issue-certificate"
                      className="flex items-center gap-1.5 rounded-xl border border-steel/20 bg-white hover:bg-fog px-3 py-1.5 text-xs font-semibold text-steel transition">
                      <Plus size={13} /> New Project
                    </a>
                  </div>
                  {projectsLoading ? (
                    <p className="text-sm text-steel/50">Loading…</p>
                  ) : projects.length === 0 ? (
                    <p className="text-sm text-steel/50">No projects yet. Create one from the <a href="/issue-certificate" className="text-mint hover:underline">Issue Certificate</a> page.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((p) => (
                        <ProjectCard
                          key={p.project_id}
                          project={p}
                          onClick={() => setOpenProject(p)}
                          onDelete={async () => {
                            const token = await getIdToken();
                            await deleteProject(p.project_id, token);
                            setProjects((prev) => prev.filter((x) => x.project_id !== p.project_id));
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
              <h2 className="font-display text-xl font-bold text-ink mb-6">Recent Activity</h2>
              {certsLoading ? (
                <p className="text-sm text-steel/50">Loading…</p>
              ) : issuedCertificates.length === 0 ? (
                <p className="text-sm text-steel/50">No certificates issued yet.</p>
              ) : (
                <div className="space-y-4">
                  {issuedCertificates.slice(0, 5).map((cert) => (
                    <div key={cert.certificate_id} className="flex items-center justify-between pb-4 border-b border-steel/10 last:border-0">
                      <div>
                        <p className="font-semibold text-ink text-sm">{cert.name}</p>
                        <p className="text-xs text-steel/60">{cert.event}</p>
                        {cert.organizer && <p className="text-xs text-steel/50">Organizer: {cert.organizer}</p>}
                        <p className="text-xs text-steel/50 mt-1">{new Date(cert.timestamp_utc).toLocaleDateString()}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-mint/20 text-mint">
                        <CheckCircle size={11} className="inline mr-1" />Issued
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Certificates Issued Tab */}
        {activeTab === "issued" && (
          <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
            {certsLoading ? (
              <p className="text-sm text-steel/50">Loading…</p>
            ) : issuedCertificates.length === 0 ? (
              <p className="text-sm text-steel/50">No certificates issued yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-steel/10">
                      <th className="text-left py-3 px-4 font-semibold text-steel/70">Recipient</th>
                      <th className="text-left py-3 px-4 font-semibold text-steel/70">Event</th>
                      {showOrganizer && <th className="text-left py-3 px-4 font-semibold text-steel/70">Organizer</th>}
                      <th className="text-left py-3 px-4 font-semibold text-steel/70">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-steel/70">Certificate ID</th>
                      <th className="text-right py-3 px-4 font-semibold text-steel/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedCertificates.map((cert) => (
                      <tr key={cert.certificate_id} className="border-b border-steel/10 last:border-0 hover:bg-fog transition">
                        <td className="py-3 px-4 font-medium">{cert.name}</td>
                        <td className="py-3 px-4">{cert.event}</td>
                        {showOrganizer && <td className="py-3 px-4 text-steel/70">{cert.organizer}</td>}
                        <td className="py-3 px-4 text-steel/60">{new Date(cert.timestamp_utc).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-steel/60 bg-fog px-2 py-1 rounded-lg">{cert.certificate_id}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {cert.verification_url && (
                            <a href={cert.verification_url} target="_blank" rel="noopener noreferrer"
                              className="text-steel/60 hover:text-mint transition mr-3 inline-block">
                              <Share2 size={16} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Vault Tab */}
        {activeTab === "vault" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-rise">
            {vaultCertificates.map((cert) => (
              <div key={cert.id} className="rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm hover:shadow-[0_20px_45px_rgba(13,27,42,0.2)] transition">
                <div className="flex items-start justify-between mb-4">
                  <Archive className="text-mint" size={24} />
                  <button className="text-steel/60 hover:text-danger transition">
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="font-semibold text-ink mb-1 text-sm">{cert.title}</h3>
                <p className="text-xs text-steel/60 mb-4">{cert.issuer}</p>
                <div className="bg-fog rounded-lg p-3 mb-4">
                  <p className="text-xs text-steel/60 mb-1">Credential ID</p>
                  <p className="font-mono text-xs text-ink">{cert.credentialId}</p>
                </div>
                <p className="text-xs text-steel/50 mb-4">Issued on {cert.date}</p>
                <button className="w-full py-2 px-4 bg-mint hover:bg-mint/90 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2">
                  <Download size={16} />
                  Download Certificate
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === "credits" && (
          <div className="space-y-6 animate-rise">
            {/* Credit Balance */}
            <div className="rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-steel/70 text-sm font-semibold mb-1">Current Balance</p>
                  <p className={`font-display text-4xl font-bold ${credits === 0 ? "text-danger" : "text-ink"}`}>
                    {credits ?? "…"} Credits
                  </p>
                </div>
                <button className="bg-amber hover:bg-amber/90 text-white font-semibold py-2.5 px-6 rounded-xl transition flex items-center gap-2">
                  <Plus size={18} />
                  Buy More Credits
                </button>
              </div>
              <div className="bg-fog rounded-lg p-4">
                <p className="text-xs text-steel/60 mb-2">Usage this month</p>
                <div className="w-full bg-white rounded-full h-2">
                  <div className="bg-gradient-to-r from-mint to-amber h-2 rounded-full" style={{width: '15%'}}></div>
                </div>
                <p className="text-xs text-steel/60 mt-2">{stats.creditsUsed} certificates issued total</p>
              </div>
            </div>

            {/* Credit History */}
            <div className="rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
              <h2 className="font-display text-xl font-bold text-ink mb-6">Credit History</h2>
              <div className="space-y-4">
                {creditHistory.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between pb-4 border-b border-steel/10 last:border-0">
                    <div>
                      <p className="font-semibold text-ink text-sm">{entry.description}</p>
                      <p className="text-xs text-steel/60">{entry.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${entry.credits > 0 ? "text-mint" : "text-steel"}`}>
                        {entry.credits > 0 ? "+" : ""}{entry.credits}
                      </p>
                      <p className="text-xs text-steel/60">Balance: {entry.balance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project, onClick, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      className="rounded-2xl border border-steel/10 bg-fog/60 p-4 flex flex-col gap-2 cursor-pointer hover:border-mint/30 hover:bg-mint/5 transition"
      onClick={(e) => { if (!confirming) onClick?.(); }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-xl bg-mint/10 p-2 shrink-0">
            <Folder size={18} className="text-mint" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink text-sm truncate">{project.name}</p>
            {project.description && (
              <p className="text-xs text-steel/50 truncate">{project.description}</p>
            )}
          </div>
        </div>
        {!confirming ? (
          <button onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            className="shrink-0 p-1.5 text-steel/30 hover:text-danger transition rounded-lg">
            <X size={14} />
          </button>
        ) : (
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={onDelete}
              className="rounded-lg bg-danger/10 text-danger text-xs font-semibold px-2 py-1 hover:bg-danger/20 transition">
              Delete
            </button>
            <button onClick={() => setConfirming(false)}
              className="rounded-lg border border-steel/20 text-steel text-xs px-2 py-1 hover:bg-fog transition">
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="rounded-full bg-white border border-steel/10 px-2.5 py-0.5 text-xs font-mono text-steel/70">
          {project.prefix}-…
        </span>
        <span className="text-xs text-steel/50">
          {project.cert_count ?? 0} cert{project.cert_count !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-steel/40 text-center mt-1">Click to view certificates</p>
    </div>
  );
}
