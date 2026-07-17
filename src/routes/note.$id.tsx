import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { UnifiedEditor } from "@/components/unified-editor";
import { CommandPalette } from "@/components/command-palette";
import {
  ArrowLeft, Pin, Star, Trash2, Grid3x3, LayoutGrid, Rows3, Square,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/note/$id")({
  component: NotePage,
});

function NotePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const note = useStore((s) => s.notes[id]);
  const updateNote = useStore((s) => s.updateNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const deleteNote = useStore((s) => s.deleteNote);
  const addStroke = useStore((s) => s.addStroke);
  const undoStroke = useStore((s) => s.undoStroke);
  const clearStrokes = useStore((s) => s.clearStrokes);
  const commitErase = useStore((s) => s.commitErase);

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!note) navigate({ to: "/" });
  }, [note, navigate]);

  if (!note) return null;

  const eraseStroke = (sid: string) => {
    const filtered = note.strokes.filter((s) => s.id !== sid);
    updateNote(id, { strokes: filtered });
  };

  return (
    <div className="flex h-dvh flex-col">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Top bar */}
      <header className="glass-strong border-b border-border/60 px-3 py-2 flex items-center gap-2 sticky top-0 z-30">
        <Link to="/" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-accent transition" aria-label="Back">
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
          >{note.emoji || "📝"}</button>
          <input
            value={note.title}
            onChange={(e) => updateNote(id, { title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
            placeholder="Untitled note"
          />
        </div>

        <div className="hidden sm:flex items-center rounded-xl bg-muted/60 p-0.5">
          <PaperBtn active={note.paper === "blank"} onClick={() => updateNote(id, { paper: "blank" })} icon={<Square className="h-3.5 w-3.5" />} label="Blank" />
          <PaperBtn active={note.paper === "grid"} onClick={() => updateNote(id, { paper: "grid" })} icon={<Grid3x3 className="h-3.5 w-3.5" />} label="Grid" />
          <PaperBtn active={note.paper === "dots"} onClick={() => updateNote(id, { paper: "dots" })} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Dots" />
          <PaperBtn active={note.paper === "lined"} onClick={() => updateNote(id, { paper: "lined" })} icon={<Rows3 className="h-3.5 w-3.5" />} label="Lined" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
            onClick={() => { deleteNote(id); navigate({ to: "/" }); }}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            aria-label="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Unified body */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 min-h-0 flex flex-col"
      >
        <UnifiedEditor
          content={note.content}
          strokes={note.strokes}
          paper={note.paper}
          onContentChange={(html) => updateNote(id, { content: html })}
          onAddStroke={(s) => addStroke(id, s)}
          onUndoStroke={() => undoStroke(id)}
          onClearStrokes={() => clearStrokes(id)}
          onEraseStroke={eraseStroke}
          onReplaceStrokes={(strokes) => updateNote(id, { strokes })}
          onCommitErase={(prev, next) => commitErase(id, prev, next)}
        />

      </motion.div>
    </div>
  );
}

function PaperBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
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
