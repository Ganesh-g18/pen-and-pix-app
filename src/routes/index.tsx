import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { startCloudSync, stopCloudSync, hasLocalGuestData } from "@/lib/cloud-sync";
import { MigrationModal } from "@/components/migration-modal";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  useTheme();
  const navigate = useNavigate();
  const createNote = useStore((s) => s.createNote);
  const guestMode = useStore((s) => s.guestMode);
  const setGuestMode = useStore((s) => s.setGuestMode);
  const { user, session } = useAuth();
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Gate: welcome screen if neither authed nor guest
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Give auth a moment to hydrate from localStorage
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user && !guestMode) {
      navigate({ to: "/welcome" });
    }
  }, [ready, user, guestMode, navigate]);

  // Kick off cloud sync when signed in
  useEffect(() => {
    if (user) {
      const hadGuest = guestMode && hasLocalGuestData();
      startCloudSync(user).then(() => {
        if (hadGuest) setMigrationOpen(true);
        setGuestMode(false);
      });
    } else {
      stopCloudSync();
    }
  }, [user, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const id = createNote({ mode: "text" });
        navigate({ to: "/note/$id", params: { id } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, createNote]);

  if (!ready || (!user && !guestMode)) return null;

  return (
    <>
      <Dashboard />
      {user && (
        <MigrationModal open={migrationOpen} onClose={() => setMigrationOpen(false)} userId={user.id} />
      )}
    </>
  );
}
