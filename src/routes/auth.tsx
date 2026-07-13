import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import { GoogleIcon } from "@/components/icons";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl glass-strong p-8 shadow-float"
      >
        <Link to="/welcome" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" ? "Sign in to sync your notes." : "Start syncing your notes across devices."}
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
        >
          <GoogleIcon className="h-4 w-4" /> Continue with Google
        </button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
          <div className="relative flex justify-center"><span className="bg-background px-2 text-[11px] uppercase tracking-widest text-muted-foreground">or email</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-background/60 border border-border/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full rounded-xl bg-background/60 border border-border/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          {error && <div className="text-xs text-destructive">{error}</div>}
          {info && <div className="text-xs text-primary">{info}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-primary-foreground shadow-float disabled:opacity-50"
            style={{ background: "var(--gradient-accent)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>Don't have an account?{" "}
              <button className="text-primary hover:underline" onClick={() => { setMode("signup"); setError(null); }}>Sign up</button>
            </>
          ) : (
            <>Already have one?{" "}
              <button className="text-primary hover:underline" onClick={() => { setMode("signin"); setError(null); }}>Sign in</button>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/welcome" className="text-xs text-muted-foreground hover:text-foreground">Or continue as guest →</Link>
        </div>
      </motion.div>
    </div>
  );
}
