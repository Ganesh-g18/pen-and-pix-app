import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TextEditor } from "@/components/text-editor";
import { CanvasEditor } from "@/components/canvas-editor";
import { CommandPalette } from "@/components/command-palette";
import {
  ArrowLeft, FileText, PenLine, Pin, Star, MoreHorizontal,
  Trash2, Grid3x3, LayoutGrid, Rows3, Square,
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!note) navigate({ to: "/" });
  }, [note, navigate]);

  if (!note) return null;

  const setMode = (mode: "text" | "canvas") => updateNote(id, { mode });

  const eraseStroke = (sid: string) => {
    const filtered = note.strokes.filter((s) => s.id !== sid);
    updateNote(id, { strokes: filtered });
  };

  return (
    <div className="flex h-screen flex-col">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Top bar */}
      <header className="glass-strong border-b border-border/60 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            className="text-2xl hover:scale-110 transition"
            onClick={() => {
              const e = prompt("Emoji", note.emoji || "📝");
              if (e) updateNote(id, { emoji: e });
            }}
          >{note.emoji || "📝"}</button>
          <input
            value={note.title}
            onChange={(e) => updateNote(id, { title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
            placeholder="Untitled note"
          />
        </div>

        {/* Mode toggle */}
        <div className="flex items-center rounded-xl bg-muted/60 p-1">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${note.mode === "text" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-3.5 w-3.5" /> Text
          </button>
          <button
            onClick={() => setMode("canvas")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${note.mode === "canvas" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <PenLine className="h-3.5 w-3.5" /> Canvas
          </button>
        </div>

        {note.mode === "canvas" && (
          <div className="hidden sm:flex items-center rounded-xl bg-muted/60 p-1">
            <PaperBtn active={note.paper === "blank"} onClick={() => updateNote(id, { paper: "blank" })} icon={<Square className="h-3.5 w-3.5" />} />
            <PaperBtn active={note.paper === "grid"} onClick={() => updateNote(id, { paper: "grid" })} icon={<Grid3x3 className="h-3.5 w-3.5" />} />
            <PaperBtn active={note.paper === "dots"} onClick={() => updateNote(id, { paper: "dots" })} icon={<LayoutGrid className="h-3.5 w-3.5" />} />
            <PaperBtn active={note.paper === "lined"} onClick={() => updateNote(id, { paper: "lined" })} icon={<Rows3 className="h-3.5 w-3.5" />} />
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePin(id)}
            className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition ${note.pinned ? "text-primary" : "text-muted-foreground"}`}
          >
            <Pin className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleFavorite(id)}
            className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition ${note.favorite ? "text-yellow-500" : "text-muted-foreground"}`}
          >
            <Star className="h-4 w-4" />
          </button>
          <button
            onClick={() => { deleteNote(id); navigate({ to: "/" }); }}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <motion.div
        key={note.mode}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 min-h-0 flex flex-col"
      >
        {note.mode === "text" ? (
          <TextEditor
            content={note.content}
            onChange={(html) => updateNote(id, { content: html })}
          />
        ) : (
          <CanvasEditor
            strokes={note.strokes}
            paper={note.paper}
            onAddStroke={(s) => addStroke(id, s)}
            onUndo={() => undoStroke(id)}
            onClear={() => clearStrokes(id)}
            onEraseStroke={eraseStroke}
          />
        )}
      </motion.div>
    </div>
  );
}

function PaperBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-7 w-8 place-items-center rounded-lg transition ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
    </button>
  );
}
