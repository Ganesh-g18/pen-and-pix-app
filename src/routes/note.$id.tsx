import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore, type PaperOptions } from "@/lib/store";
import { UnifiedEditor } from "@/components/unified-editor";
import { CommandPalette } from "@/components/command-palette";
import { flushNow, isCloudActive, subscribeStatus, type CloudStatus } from "@/lib/cloud-sync";
import { exportAsPdf, exportAsMarkdown, exportAsText } from "@/lib/export-note";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pin,
  Star,
  Trash2,
  Grid3x3,
  LayoutGrid,
  Rows3,
  Square,
  Save,
  Check,
  Download,
  Loader2,
  CloudOff,
  Sliders,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/note/$id")({
  component: NotePage,
});

function NotePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const note = useStore((s) => s.notes[id]);
  const updateNote = useStore((s) => s.updateNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const deleteNote = useStore((s) => s.deleteNote);
  const addStroke = useStore((s) => s.addStroke);
  const undoStroke = useStore((s) => s.undoStroke);
  const redoStroke = useStore((s) => s.redoStroke);
  const clearStrokes = useStore((s) => s.clearStrokes);
  const commitErase = useStore((s) => s.commitErase);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeStatus(setCloudStatus), []);

  useEffect(() => {
    if (!note) navigate({ to: "/" });
  }, [note, navigate]);

  // Track dirtiness relative to last sync (only meaningful when signed in).
  const lastUpdatedRef = useRef<number>(note?.updatedAt ?? 0);
  useEffect(() => {
    if (!note) return;
    if (note.updatedAt !== lastUpdatedRef.current) {
      lastUpdatedRef.current = note.updatedAt;
      if (isCloudActive()) setDirty(true);
    }
  }, [note?.updatedAt]);

  useEffect(() => {
    if (cloudStatus === "synced" && dirty) {
      setDirty(false);
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [cloudStatus, dirty]);

  const doSave = async () => {
    if (!isCloudActive()) {
      // Guest / local-only: everything is already persisted to localStorage.
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      toast.success("Saved locally");
      return;
    }
    try {
      await flushNow();
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch {
      toast.error("Save failed");
    }
  };

  // Flush immediately on unload / route change.
  useEffect(() => {
    const onUnload = () => {
      if (isCloudActive()) flushNow();
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      if (isCloudActive()) flushNow();
    };
  }, [id]);

  // Cmd/Ctrl+S save, Cmd/Ctrl+P export PDF.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        doSave();
      }
      if (k === "p") {
        e.preventDefault();
        handleExport("pdf");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Close export menu on outside click.
  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [exportOpen]);

  if (!note) return null;

  const eraseStroke = (sid: string) => {
    const filtered = note.strokes.filter((s) => s.id !== sid);
    updateNote(id, { strokes: filtered });
  };

  const handleExport = async (kind: "pdf" | "md" | "txt") => {
    setExportOpen(false);
    try {
      if (kind === "md") return exportAsMarkdown(note);
      if (kind === "txt") return exportAsText(note);
      const surface = editorRootRef.current?.querySelector("[data-editor-surface]") as HTMLElement | null;
      if (!surface) return toast.error("Editor surface not found");
      toast.loading("Rendering PDF…", { id: "pdf-export" });
      await exportAsPdf(surface, note);
      toast.success("PDF exported", { id: "pdf-export" });
    } catch (err) {
      console.error(err);
      toast.error("Export failed", { id: "pdf-export" });
    }
  };

  const saveStatus = getSaveStatus({ cloudActive: isCloudActive() && !!user, dirty, cloudStatus });

  return (
    <div className="flex h-dvh flex-col">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Top bar */}
      <header className="glass-strong border-b border-border/60 px-3 py-2 flex items-center gap-2 sticky top-0 z-30">
        <Link
          to="/"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-accent transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            className="shrink-0 text-2xl hover:scale-110 transition"
            onClick={() => {
              const e = prompt("Emoji", note.emoji || "📝");
              if (e) updateNote(id, { emoji: e });
            }}
            aria-label="Change emoji"
          >
            {note.emoji || "📝"}
          </button>
          <input
            value={note.title}
            onChange={(e) => updateNote(id, { title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
            placeholder="Untitled note"
          />
        </div>

        {/* Save status pill */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground min-w-[92px] justify-center">
          <saveStatus.Icon className={`h-3 w-3 ${saveStatus.spin ? "animate-spin" : ""} ${saveStatus.color}`} />
          <span>{saveStatus.label}</span>
        </div>

        <div className="hidden md:flex items-center rounded-xl bg-muted/60 p-0.5">
          <PaperBtn
            active={note.paper === "blank"}
            onClick={() => updateNote(id, { paper: "blank" })}
            icon={<Square className="h-3.5 w-3.5" />}
            label="Blank"
          />
          <PaperBtn
            active={note.paper === "grid"}
            onClick={() => updateNote(id, { paper: "grid" })}
            icon={<Grid3x3 className="h-3.5 w-3.5" />}
            label="Grid"
          />
          <PaperBtn
            active={note.paper === "dots"}
            onClick={() => updateNote(id, { paper: "dots" })}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label="Dots"
          />
          <PaperBtn
            active={note.paper === "lined"}
            onClick={() => updateNote(id, { paper: "lined" })}
            icon={<Rows3 className="h-3.5 w-3.5" />}
            label="Lined"
          />
          {note.paper !== "blank" && (
            <PaperOptionsMenu options={note.paperOptions} onChange={(opts) => updateNote(id, { paperOptions: opts })} />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Save */}
          <button
            onClick={doSave}
            disabled={isCloudActive() && !dirty && !savedFlash}
            className={`relative grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed ${
              dirty ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-accent"
            }`}
            title="Save (⌘S)"
            aria-label="Save note"
          ></button>

          {/* Export menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => handleExport("pdf")}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-accent transition"
              title="Download PDF"
              aria-label="Download PDF"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => togglePin(id)}
            className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition ${note.pinned ? "text-primary" : "text-muted-foreground"}`}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
          >
            <Pin className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleFavorite(id)}
            className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition ${note.favorite ? "text-yellow-500" : "text-muted-foreground"}`}
            aria-label={note.favorite ? "Unfavorite note" : "Favorite note"}
          >
            <Star className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              deleteNote(id);
              navigate({ to: "/" });
            }}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            aria-label="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Unified body */}
      <motion.div
        ref={editorRootRef}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 min-h-0 flex flex-col"
      >
        <UnifiedEditor
          content={note.content}
          strokes={note.strokes}
          paper={note.paper}
          paperOptions={note.paperOptions}
          textBlocks={note.textBlocks}
          onContentChange={(html) => updateNote(id, { content: html })}
          onTextBlocksChange={(blocks) => updateNote(id, { textBlocks: blocks })}
          onAddStroke={(s) => addStroke(id, s)}
          onUndoStroke={() => undoStroke(id)}
          onRedoStroke={() => redoStroke(id)}
          onClearStrokes={() => clearStrokes(id)}
          onEraseStroke={eraseStroke}
          onReplaceStrokes={(strokes) => updateNote(id, { strokes })}
          onCommitErase={(prev, next) => commitErase(id, prev, next)}
        />
      </motion.div>
    </div>
  );
}

function getSaveStatus({
  cloudActive,
  dirty,
  cloudStatus,
}: {
  cloudActive: boolean;
  dirty: boolean;
  cloudStatus: CloudStatus;
}) {
  if (!cloudActive) {
    return { label: "Saved locally", Icon: Check, color: "text-emerald-500", spin: false };
  }
  if (cloudStatus === "offline") return { label: "Offline", Icon: CloudOff, color: "text-orange-500", spin: false };
  if (cloudStatus === "error") return { label: "Save failed", Icon: CloudOff, color: "text-red-500", spin: false };
  if (cloudStatus === "syncing") return { label: "Saving…", Icon: Loader2, color: "text-blue-500", spin: true };
  if (dirty) return { label: "Unsaved", Icon: Save, color: "text-primary", spin: false };
  return { label: "Saved", Icon: Check, color: "text-emerald-500", spin: false };
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

function PaperBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label} paper`}
      className={`grid h-7 w-8 place-items-center rounded-lg transition ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
    </button>
  );
}

function PaperOptionsMenu({ options, onChange }: { options?: PaperOptions; onChange: (opts: PaperOptions) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opts: Required<PaperOptions> = {
    thickness: options?.thickness ?? 1,
    spacing: options?.spacing ?? 24,
    color: options?.color ?? "",
    margin: options?.margin ?? 0,
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Paper options"
        title="Paper options"
        className="grid h-7 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground transition"
      >
        <Sliders className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-64 rounded-xl border border-border bg-card text-card-foreground shadow-float p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Thickness</span>
              <span className="text-muted-foreground">{opts.thickness}px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={opts.thickness}
              onChange={(e) => onChange({ ...opts, thickness: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Spacing</span>
              <span className="text-muted-foreground">{opts.spacing}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={64}
              step={2}
              value={opts.spacing}
              onChange={(e) => onChange({ ...opts, spacing: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Margin ruler</span>
              <span className="text-muted-foreground">{opts.margin}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              step={4}
              value={opts.margin}
              onChange={(e) => onChange({ ...opts, margin: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Line color</span>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(opts.color) ? opts.color : "#94a3b8"}
              onChange={(e) => onChange({ ...opts, color: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded"
            />
          </div>
          <button
            onClick={() => onChange({})}
            className="w-full rounded-lg border border-border text-xs py-1.5 hover:bg-accent"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
