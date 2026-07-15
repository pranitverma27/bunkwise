"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoHref, setLogoHref] = useState("/");
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLogoHref("/dashboard");
        router.push("/dashboard");
      }
    }
    checkUser();
  }, [router]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("Check your email to confirm your account!");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] font-body-md flex flex-col">
      {/* Top Bar */}
      <header className="p-gutter flex justify-between items-center border-b border-white/10 glass-nav">
        <Link href={logoHref} className="font-headline-md font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>BunkWise</Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-container-padding">
        <div className="w-full max-w-md space-y-stack-md">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="font-headline-lg text-white" style={{ fontFamily: 'Space Grotesk' }}>
              {mode === "login" ? "Welcome Back" : "Join BunkWise"}
            </h1>
            <p className="text-on-surface-variant font-body-md">
              {mode === "login" ? "Bunk scientifically. Start tracking." : "One upload. Zero setup. Zero HOD calls."}
            </p>
          </div>

          {/* Auth Card */}
          <div className="glass-card p-8 rounded-3xl space-y-6 neon-glow-purple-sm">
            {error && (
              <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl text-error text-sm font-medium">
                {error}
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform hover:bg-white/90 disabled:opacity-50"
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-white/10"></div>
              <span className="font-label-sm text-on-surface-variant/40">OR EMAIL</span>
              <div className="h-px flex-1 bg-white/10"></div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="font-label-sm text-on-surface-variant uppercase ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container border-b border-white/10 py-3 px-1 text-white focus:border-primary transition-all font-body-md"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-label-sm text-on-surface-variant uppercase ml-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container border-b border-white/10 py-3 px-1 text-white focus:border-primary transition-all font-body-md"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full primary-gradient text-on-primary py-4 rounded-xl font-bold active:scale-95 transition-transform hover-glow-purple disabled:opacity-50"
              >
                {loading ? "Processing..." : (mode === "login" ? "Log In" : "Create Account")}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
              >
                {mode === "login" ? "Don't have an account? Join now" : "Already have an account? Log in"}
              </button>
            </div>
          </div>

          <div className="text-center px-6">
            <p className="text-xs text-on-surface-variant/40">
              By continuing, you agree to BunkWise's Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
