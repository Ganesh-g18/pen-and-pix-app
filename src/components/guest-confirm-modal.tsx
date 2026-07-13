import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onSignInInstead: () => void;
}

export function GuestConfirmModal({ open, onOpenChange, onConfirm, onSignInInstead }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center px-4 bg-background/70 backdrop-blur-md"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-md rounded-3xl glass-strong p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500/15 text-orange-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h2 className="font-display text-xl">Continue as Guest?</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Your notes will only be stored on this device.
            </p>

            <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm">
              <div className="font-medium mb-2">Guest mode does not support:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Cloud Backup</li>
                <li>• Cross-device Sync</li>
                <li>• Sharing Notes</li>
                <li>• Version History</li>
                <li>• Real-time Collaboration</li>
              </ul>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              If you clear your browser data or uninstall the app, your notes may be permanently lost.
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={onSignInInstead}
                className="flex-1 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium hover:bg-accent transition"
              >
                Sign In Instead
              </button>
              <button
                onClick={() => { onConfirm(); onOpenChange(false); }}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm text-primary-foreground shadow-float"
                style={{ background: "var(--gradient-accent)" }}
              >
                Continue as Guest
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
