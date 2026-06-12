import { useState } from "react";
import { Mail, Lock, User, Building2, ArrowRight } from "lucide-react";
import { useAuth } from "./context/AuthContext";

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organization: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!formData.agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.fullName);
      setSuccess(true);
    } catch (err) {
      setError(friendlyError(err.code));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginWithGoogle();
      window.location.href = "/dashboard";
    } catch (err) {
      setError(friendlyError(err.code));
    }
  };

  if (success) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-fog font-body text-ink">
        <div className="pointer-events-none absolute inset-0 gradient-bg" />
        <nav className="relative border-b border-steel/10 bg-white/50 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8">
            <div className="flex items-center justify-between">
              <a href="/" className="font-display text-2xl font-bold text-ink hover:text-steel transition">Cerbro</a>
              <div className="flex gap-6">
                <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">Verify</a>
                <a href="/pricing" className="text-sm font-semibold text-steel hover:text-ink transition">Pricing</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-8">
          <div className="mx-auto w-full max-w-sm">
            <div className="animate-rise text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-mint/20 p-4">
                  <Mail className="text-mint" size={32} />
                </div>
              </div>
              <h1 className="font-display text-3xl font-bold text-ink mb-3">Account Created!</h1>
              <p className="text-steel/70 text-sm mb-6">
                Welcome to Cerbro, <strong>{formData.fullName || formData.email}</strong>
              </p>
              <a
                href="/dashboard"
                className="inline-block rounded-xl bg-ink hover:bg-steel text-white font-semibold py-2.5 px-6 transition"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      <nav className="relative border-b border-steel/10 dark:border-steel/40 bg-white/50 dark:bg-ink/20 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-2xl font-bold text-ink dark:text-fog hover:text-steel dark:hover:text-mint transition">Cerbro</a>
            <div className="flex gap-6">
              <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">Verify</a>
              <a href="/pricing" className="text-sm font-semibold text-steel hover:text-ink transition">Pricing</a>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 animate-rise text-center">
            <h1 className="font-display text-3xl font-bold text-ink mb-2">Create Account</h1>
            <p className="text-steel/70 text-sm">Join Cerbro and start managing certificates</p>
          </div>

          <form
            onSubmit={handleRegister}
            className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms] sm:p-8"
          >
            {error && (
              <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 p-4">
                <p className="text-sm text-danger font-semibold">{error}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-steel">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="fullName" type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                  placeholder="John Doe" required
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-steel">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="email" type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="your@email.com" required
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="organization" className="mb-2 block text-sm font-semibold text-steel">Organization (Optional)</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="organization" type="text" name="organization" value={formData.organization} onChange={handleChange}
                  placeholder="Your organization name"
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-steel">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="password" type="password" name="password" value={formData.password} onChange={handleChange}
                  placeholder="••••••••" required minLength={8}
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
              <p className="mt-2 text-xs text-steel/60">At least 8 characters</p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-steel">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                  placeholder="••••••••" required
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox" name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange}
                  className="mt-1 rounded border-steel/20" required
                />
                <span className="text-xs text-steel/70">
                  I agree to the{" "}
                  <a href="/terms" className="text-mint hover:underline">Terms of Service</a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-mint hover:underline">Privacy Policy</a>
                </span>
              </label>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account"}
              {!loading && <ArrowRight size={18} />}
            </button>

            <p className="mt-6 text-center text-sm text-steel/70">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-mint hover:text-mint/80 transition">Sign in here</a>
            </p>
          </form>

          <div className="relative my-6 animate-rise [animation-delay:200ms]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-steel/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-fog px-2 text-steel/60">Or continue with</span>
            </div>
          </div>

          <div className="animate-rise [animation-delay:300ms]">
            <button
              onClick={handleGoogle}
              className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm font-semibold text-steel transition hover:bg-fog"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Invalid email address.";
    default:
      return "Registration failed. Please try again.";
  }
}
