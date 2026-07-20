import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Plus,
  Pin,
  Star,
  Trash2,
  Folder as FolderIcon,
  Sun,
  Moon,
  Command,
  Sparkles,
  FileText,
  PenLine,
  Download,
} from "lucide-react";
import { exportNoteQuickPdf } from "@/lib/export-note";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CommandPalette } from "@/components/command-palette";
import { ProfileMenu } from "@/components/profile-menu";
import { CloudStatusBadge } from "@/components/cloud-status-badge";
import { SignInReminder } from "@/components/signin-reminder";
import { formatDistanceToNow } from "date-fns";

type Filter = "all" | "pinned" | "favorites" | "trash" | { folder: string };

export function Dashboard() {
  const navigate = useNavigate();
  const notes = useStore((s) => s.notes);
  const folders = useStore((s) => s.folders);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const createNote = useStore((s) => s.createNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const deleteNote = useStore((s) => s.deleteNote);
  const restoreNote = useStore((s) => s.restoreNote);
  const addFolder = useStore((s) => s.addFolder);

  const [filter, setFilter] = useState<Filter>("all");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = Object.values(notes);
    if (filter === "trash") list = list.filter((n) => n.trashed);
    else list = list.filter((n) => !n.trashed);

    if (filter === "pinned") list = list.filter((n) => n.pinned);
    if (filter === "favorites") list = list.filter((n) => n.favorite);
    if (typeof filter === "object") list = list.filter((n) => n.folderId === filter.folder);

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, filter, query]);

  const handleCreate = (mode: "text" | "canvas") => {
    const id = createNote({ mode });
    navigate({ to: "/note/$id", params: { id } });
  };

  return (
    <div className="flex min-h-screen">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Sidebar */}
      <aside className="hidden md:flex w-72 flex-col gap-2 border-r border-border/60 p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-xl leading-none gradient-text">Pen Flow</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Notes reimagined</div>
          </div>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mt-1 flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 transition"
        >
          <span className="flex items-center gap-2">
            <Command className="h-4 w-4" /> Quick actions
          </span>
          <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5">⌘K</kbd>
        </button>

        <div className="mt-3 space-y-1">
          <NavItem
            active={filter === "all"}
            onClick={() => setFilter("all")}
            icon={<FileText className="h-4 w-4" />}
            label="All notes"
            count={Object.values(notes).filter((n) => !n.trashed).length}
          />
          <NavItem
            active={filter === "pinned"}
            onClick={() => setFilter("pinned")}
            icon={<Pin className="h-4 w-4" />}
            label="Pinned"
          />
          <NavItem
            active={filter === "favorites"}
            onClick={() => setFilter("favorites")}
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
          />
          <NavItem
            active={filter === "trash"}
            onClick={() => setFilter("trash")}
            icon={<Trash2 className="h-4 w-4" />}
            label="Trash"
          />
        </div>

        <div className="mt-5 flex items-center justify-between px-2">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Folders</div>
          <button
            onClick={() => {
              const name = prompt("Folder name");
              if (name) addFolder(name);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Add folder"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-1 overflow-y-auto scrollbar-thin">
          {folders.map((f) => (
            <NavItem
              key={f.id}
              active={typeof filter === "object" && filter.folder === f.id}
              onClick={() => setFilter({ folder: f.id })}
              icon={<span>{f.emoji}</span>}
              label={f.name}
              count={Object.values(notes).filter((n) => !n.trashed && n.folderId === f.id).length}
            />
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between rounded-xl glass px-3 py-2">
          <div className="text-xs text-muted-foreground">Local-only · autosaved</div>
          <button
            onClick={toggleTheme}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 glass-strong px-6 py-4 flex items-center gap-3 border-b border-border/60">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, ideas, anything…"
              className="w-full rounded-xl bg-background/60 border border-border/60 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <CloudStatusBadge />
            <button
              onClick={() => handleCreate("text")}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm hover:bg-accent transition"
            >
              <FileText className="h-4 w-4" /> New text
            </button>
            <button
              onClick={() => handleCreate("canvas")}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-primary-foreground shadow-float"
              style={{ background: "var(--gradient-accent)" }}
            >
              <Plus className="h-4 w-4" /> New note
            </button>
            <ProfileMenu />
          </div>
        </header>
        <SignInReminder />

        <section className="px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end justify-between mb-6"
          >
            <div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight">
                {filter === "trash"
                  ? "Trash"
                  : filter === "pinned"
                    ? "Pinned"
                    : filter === "favorites"
                      ? "Favorites"
                      : typeof filter === "object"
                        ? folders.find((f) => f.id === filter.folder)?.name
                        : "Your library"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {filtered.length} {filtered.length === 1 ? "note" : "notes"}
                {query && ` matching "${query}"`}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Everything saves as you write.
            </div>
          </motion.div>

          {filtered.length === 0 ? (
            <EmptyState onCreate={() => handleCreate("text")} isTrash={filter === "trash"} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                >
                  <Link
                    to="/note/$id"
                    params={{ id: n.id }}
                    className="group relative flex h-52 flex-col overflow-hidden rounded-2xl glass p-4 hover:shadow-float transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-2xl">{n.emoji || "📝"}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            togglePin(n.id);
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg hover:bg-accent ${n.pinned ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleFavorite(n.id);
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg hover:bg-accent ${n.favorite ? "text-yellow-500" : "text-muted-foreground"}`}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        {n.trashed ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              restoreNote(n.id);
                            }}
                            className="text-[11px] rounded-lg px-2 py-1 hover:bg-accent"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  await exportNoteQuickPdf(n);
                                  toast.success("PDF downloaded");
                                } catch (err) {
                                  console.error(err);
                                  toast.error("Could not export PDF");
                                }
                              }}
                              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                              aria-label="Download as PDF"
                              title="Download as PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                deleteNote(n.id);
                              }}
                              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 font-semibold truncate">{n.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-4 flex-1">
                      {n.mode === "canvas"
                        ? `${n.strokes.length} strokes · handwritten canvas`
                        : stripHtml(n.content) || "Empty note"}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {n.mode === "canvas" ? <PenLine className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                        {n.mode}
                      </span>
                      <span>{formatDistanceToNow(n.updatedAt, { addSuffix: true })}</span>
                    </div>
                    {n.pinned && (
                      <div className="absolute top-2 left-2 text-primary">
                        <Pin className="h-3 w-3 fill-current" />
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-primary/12 text-primary" : "text-foreground/80 hover:bg-accent/60"}`}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {typeof count === "number" && <span className="text-[11px] text-muted-foreground">{count}</span>}
    </button>
  );
}

function EmptyState({ onCreate, isTrash }: { onCreate: () => void; isTrash: boolean }) {
  return (
    <div className="glass rounded-3xl p-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/12 text-primary mb-4">
        {isTrash ? <Trash2 className="h-7 w-7" /> : <FolderIcon className="h-7 w-7" />}
      </div>
      <h2 className="font-display text-2xl">{isTrash ? "Trash is empty" : "Start something great"}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {isTrash
          ? "Deleted notes will land here so you can restore them."
          : "Create your first note — write with text, or sketch by hand on the canvas."}
      </p>
      {!isTrash && (
        <button
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-primary-foreground shadow-float"
          style={{ background: "var(--gradient-accent)" }}
        >
          <Plus className="h-4 w-4" /> Create your first note
        </button>
      )}
    </div>
  );
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
