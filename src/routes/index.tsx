import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { useTheme } from "@/hooks/use-theme";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  useTheme();
  const navigate = useNavigate();
  const createNote = useStore((s) => s.createNote);

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

  return <Dashboard />;
}
