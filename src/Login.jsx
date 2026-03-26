import { useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // TODO: Integrate with backend authentication
      console.log("Login attempt:", { email, password });
      
      // Simulated delay
      setTimeout(() => {
        setLoading(false);
        // TODO: Redirect to dashboard on success
      }, 1000);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog font-body text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(244,162,97,.33),transparent_30%),radial-gradient(circle_at_83%_12%,rgba(42,157,143,.25),transparent_28%),linear-gradient(160deg,#f7f6f2_0%,#eef3f5_46%,#dbe5ea_100%)]" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 bg-white/50 backdrop-blur-md">
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
              Welcome Back
            </h1>
            <p className="text-steel/70 text-sm">
              Sign in to manage your certificates
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:100ms] sm:p-8"
          >
            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 p-4">
                <p className="text-sm text-danger font-semibold">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="mb-6">
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-steel">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-steel">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/50" size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-steel/20 bg-white pl-12 pr-4 py-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="mb-6 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-steel/20" />
                <span className="text-steel/70">Remember me</span>
              </label>
              <a href="/forgot-password" className="text-mint hover:text-mint/80 transition font-semibold">
                Forgot password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-ink hover:bg-steel text-white font-semibold py-3 px-4 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight size={18} />}
            </button>

            {/* Sign Up Link */}
            <p className="mt-6 text-center text-sm text-steel/70">
              Don't have an account?{" "}
              <a href="/register" className="font-semibold text-mint hover:text-mint/80 transition">
                Sign up here
              </a>
            </p>
          </form>

          {/* Divider */}
          <div className="relative my-8 animate-rise [animation-delay:200ms]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-steel/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-fog px-2 text-steel/60">Or continue with</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-4 animate-rise [animation-delay:300ms]">
            <button className="rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm font-semibold text-steel transition hover:bg-fog">
              Google
            </button>
            <button className="rounded-xl border border-steel/20 bg-white px-4 py-3 text-sm font-semibold text-steel transition hover:bg-fog">
              GitHub
            </button>
          </div>

          {/* Footer Text */}
          <p className="mt-8 text-center text-xs text-steel/60 animate-rise [animation-delay:400ms]">
            By signing in, you agree to our{" "}
            <a href="/terms" className="text-mint hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-mint hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
