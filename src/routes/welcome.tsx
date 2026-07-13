import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { PenLine, Mail, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import { GoogleIcon } from "@/components/icons";
import { GuestConfirmModal } from "@/components/guest-confirm-modal";

export const Route = createFileRoute("/welcome")({
  component: Welcome,
});

function Welcome() {
  useTheme();
  const navigate = useNavigate();
  const setGuestMode = useStore((s) => s.setGuestMode);
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleGoogle = async () => {
    setLoading("google");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(null);
      alert("Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full blur-3xl" style={{ background: "var(--gradient-accent)" }} />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full blur-3xl opacity-70" style={{ background: "var(--gradient-accent)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-3xl glass-strong p-8 shadow-float"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-2xl gradient-text leading-none">InkFlow</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Notes reimagined</div>
          </div>
        </div>

        <h1 className="font-display text-3xl tracking-tight">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick how you'd like to start. You can switch anytime.
        </p>

        <div className="mt-6 space-y-2">
          <button
            onClick={handleGoogle}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
          >
            <GoogleIcon className="h-4 w-4" />
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>

          <Link
            to="/auth"
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-medium hover:bg-accent transition"
          >
            <Mail className="h-4 w-4" />
            Continue with Email
          </Link>

          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-[11px] uppercase tracking-widest text-muted-foreground">or</span></div>
          </div>

          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-primary-foreground shadow-float"
            style={{ background: "var(--gradient-accent)" }}
          >
            Continue as Guest <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
          <Sparkles className="h-3 w-3" /> No account required. Sign in later to sync across devices.
        </div>
      </motion.div>

      <GuestConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setGuestMode(true);
          navigate({ to: "/" });
        }}
        onSignInInstead={() => {
          setConfirmOpen(false);
          navigate({ to: "/auth" });
        }}
      />
    </div>
  );
}
