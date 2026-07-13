import { motion, AnimatePresence } from "framer-motion";
import { Shield, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function SignInReminder() {
  const { user } = useAuth();
  const guestMode = useStore((s) => s.guestMode);
  const noteCount = useStore((s) => Object.values(s.notes).filter((n) => !n.trashed).length);
  const dismissedAt = useStore((s) => s.signInReminderDismissedAt);
  const dismiss = useStore((s) => s.dismissSignInReminder);
  const navigate = useNavigate();

  const shouldShow =
    !user &&
    guestMode &&
    noteCount >= 1 &&
    (!dismissedAt || Date.now() - dismissedAt > SEVEN_DAYS);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mx-6 mt-4 rounded-2xl glass p-3 flex items-center gap-3"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm">
            Protect your notes by creating a free account and enabling cloud backup.
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="rounded-lg px-3 py-1.5 text-xs text-primary-foreground shadow-float"
            style={{ background: "var(--gradient-accent)" }}
          >
            Sign In
          </button>
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Maybe Later
          </button>
          <button
            onClick={dismiss}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
