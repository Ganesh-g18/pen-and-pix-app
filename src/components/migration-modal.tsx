import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, Loader2 } from "lucide-react";
import { useState } from "react";
import { importGuestData, clearLocalGuestData } from "@/lib/cloud-sync";
import { useStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function MigrationModal({ open, onClose, userId }: Props) {
  const [importing, setImporting] = useState(false);
  const noteCount = useStore((s) => Object.values(s.notes).length);

  const handleImport = async () => {
    setImporting(true);
    try {
      await importGuestData(userId);
      clearLocalGuestData();
      onClose();
    } catch (e) {
      alert("Import failed. Your local notes are still safe.");
      setImporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center px-4 bg-background/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-md rounded-3xl glass-strong p-6 shadow-float"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <CloudUpload className="h-5 w-5" />
              </div>
              <h2 className="font-display text-xl">Import Guest Notes?</h2>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              We found {noteCount} {noteCount === 1 ? "note" : "notes"} stored on this device.
              Would you like to import them into your cloud account?
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={onClose}
                disabled={importing}
                className="flex-1 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm text-primary-foreground shadow-float disabled:opacity-50"
                style={{ background: "var(--gradient-accent)" }}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import Everything
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
