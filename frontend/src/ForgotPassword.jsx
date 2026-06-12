import { useState } from "react";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [step, setStep] = useState("email"); // email, verify, reset, success
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep("verify");
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (code === "123456") {
        setStep("reset");
      } else {
        setError("Invalid verification code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep("success");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 dark:border-steel/40 bg-white/50 dark:bg-ink/20 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-2xl font-bold text-ink hover:text-steel transition">
              Cerbro
            </a>
            <div className="flex gap-6">
              <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">
                Verify
              </a>
              <a href="/pricing" className="text-sm font-semibold text-steel hover:text-ink transition">
                Pricing
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          {/* Header */}
          <div className="mb-8 animate-rise text-center">
            <h1 className="font-display text-3xl font-bold text-ink mb-2">
              Reset Your Password
            </h1>
            <p className="text-steel/70 text-sm">
              {step === "email" && "Enter your email to receive a reset code"}
              {step === "verify" && "Enter the code sent to your email"}
              {step === "reset" && "Create a new password"}
              {step === "success" && "Your password has been reset!"}
            </p>
          </div>

          {/* Success Message */}
          {step === "success" && (
            <div className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-8 shadow-soft backdrop-blur-sm text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-mint/20 p-4">
                  <Mail className="text-mint" size={32} />
                </div>
              </div>
              <p className="text-steel/70 text-sm mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <a
                href="/login"
                className="inline-block rounded-xl bg-ink hover:bg-steel text-white font-semibold py-2.5 px-6 transition"
              >
                Go to Login
              </a>
            </div>
          )}

          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleSendReset} className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms] sm:p-8">
              {error && (
                <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 p-4">
                  <p className="text-sm text-danger font-semibold">{error}</p>
                </div>
              )}

              <div className="mb-6">
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-steel">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-ink hover:bg-steel text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Reset Code"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <a href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-mint hover:text-mint/80 transition font-semibold">
                <ArrowLeft size={16} />
                Back to Login
              </a>
            </form>
          )}

          {/* Verify Code Step */}
          {step === "verify" && (
            <form onSubmit={handleVerifyCode} className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms] sm:p-8">
              {error && (
                <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 p-4">
                  <p className="text-sm text-danger font-semibold">{error}</p>
                </div>
              )}

              <div className="mb-6">
                <label htmlFor="code" className="mb-2 block text-sm font-semibold text-steel">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 text-center text-lg tracking-widest"
                />
                <p className="text-xs text-steel/60 mt-2">Enter the 6-digit code sent to your email</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-ink hover:bg-steel text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify Code"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="mt-6 flex items-center justify-center gap-2 text-sm text-mint hover:text-mint/80 transition font-semibold w-full"
              >
                <ArrowLeft size={16} />
                Use Different Email
              </button>
            </form>
          )}

          {/* Reset Password Step */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms] sm:p-8">
              {error && (
                <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 p-4">
                  <p className="text-sm text-danger font-semibold">{error}</p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-steel">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-steel">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Resetting..." : "Reset Password"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
