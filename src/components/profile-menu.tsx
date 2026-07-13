import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, RefreshCw, Download, Trash2, User as UserIcon, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getLastSync, stopCloudSync } from "@/lib/cloud-sync";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export function ProfileMenu() {
  const { user } = useAuth();
  const guestMode = useStore((s) => s.guestMode);
  const notes = useStore((s) => s.notes);
  const clearAll = useStore((s) => s.clearAll);
  const setGuestMode = useStore((s) => s.setGuestMode);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(getLastSync());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLastSync(getLastSync());
    const t = setInterval(() => setLastSync(getLastSync()), 5000);
    return () => clearInterval(t);
  }, [open]);

  const exportNotes = () => {
    const blob = new Blob([JSON.stringify(Object.values(notes), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inkflow-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLocal = () => {
    if (confirm("Delete all local notes? This can't be undone.")) {
      clearAll();
    }
  };

  const handleSignOut = async () => {
    stopCloudSync();
    await signOut();
    setGuestMode(false);
    navigate({ to: "/welcome" });
  };

  const handleSyncNow = async () => {
    if (!user) return;
    await supabase.from("notes").select("id").limit(1); // touch
    setLastSync(Date.now());
  };

  const initials = (user?.email ?? "G").slice(0, 1).toUpperCase();
  const displayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? "Guest User";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-primary-foreground shadow-float"
        style={{ background: user ? "var(--gradient-accent)" : "hsl(var(--muted))" }}
        aria-label="Profile menu"
      >
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url as string} alt="" className="h-full w-full rounded-full object-cover" />
        ) : user ? initials : <UserIcon className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute right-0 mt-2 w-72 rounded-2xl glass-strong p-3 shadow-float z-40"
          >
            <div className="p-3">
              <div className="font-semibold truncate">{displayName}</div>
              {user ? (
                <>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    Cloud Synced
                    {lastSync && <> · last sync {formatDistanceToNow(lastSync, { addSuffix: true })}</>}
                  </div>
                </>
              ) : guestMode ? (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                  Local Storage Only
                </div>
              ) : null}
            </div>

            <div className="my-1 h-px bg-border/60" />

            {user ? (
              <>
                <MenuItem icon={<Settings className="h-4 w-4" />} label="Account settings" onClick={() => alert("Coming soon")} />
                <MenuItem icon={<RefreshCw className="h-4 w-4" />} label="Sync now" onClick={handleSyncNow} />
                <MenuItem icon={<Download className="h-4 w-4" />} label="Export notes" onClick={exportNotes} />
                <div className="my-1 h-px bg-border/60" />
                <MenuItem icon={<LogOut className="h-4 w-4" />} label="Sign out" onClick={handleSignOut} destructive />
              </>
            ) : (
              <>
                <MenuItem icon={<LogIn className="h-4 w-4" />} label="Sign in" onClick={() => navigate({ to: "/auth" })} />
                <MenuItem icon={<Download className="h-4 w-4" />} label="Export notes" onClick={exportNotes} />
                <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Clear local data" onClick={clearLocal} destructive />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition ${destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent"}`}
    >
      {icon}
      {label}
    </button>
  );
}
