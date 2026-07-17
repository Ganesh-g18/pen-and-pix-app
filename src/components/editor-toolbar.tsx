import { Pen, Highlighter, Eraser, Type, MousePointer2, Undo2, Trash2 } from "lucide-react";

export type EditorTool = "select" | "text" | "pen" | "highlighter" | "eraser";

const COLORS = ["#0b0b0f", "#2563eb", "#dc2626", "#059669", "#eab308", "#a855f7", "#ec4899", "#f97316"];

interface Props {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  size: number;
  onSizeChange: (n: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

export function EditorToolbar({ tool, onToolChange, color, onColorChange, size, onSizeChange, onUndo, onClear }: Props) {
  const btn = (active: boolean) =>
    `grid h-7 w-7 place-items-center rounded-lg transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <div
      className="pointer-events-auto fixed left-1/2 bottom-4 z-40 -translate-x-1/2 flex items-center gap-0.5 rounded-2xl glass-strong px-1.5 py-1 shadow-float backdrop-blur-xl"
      role="toolbar"
      aria-label="Editor tools"
    >
      <button className={btn(tool === "select")} onClick={() => onToolChange("select")} title="Select" aria-label="Select">
        <MousePointer2 className="h-3.5 w-3.5" />
      </button>
      <button className={btn(tool === "text")} onClick={() => onToolChange("text")} title="Text (T)" aria-label="Text">
        <Type className="h-3.5 w-3.5" />
      </button>
      <button className={btn(tool === "pen")} onClick={() => onToolChange("pen")} title="Pen (P)" aria-label="Pen">
        <Pen className="h-3.5 w-3.5" />
      </button>
      <button className={btn(tool === "highlighter")} onClick={() => onToolChange("highlighter")} title="Highlighter (H)" aria-label="Highlighter">
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      <button className={btn(tool === "eraser")} onClick={() => onToolChange("eraser")} title="Eraser (E)" aria-label="Eraser">
        <Eraser className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-5 w-px bg-border" />

      <input
        type="range"
        min={0.5}
        max={30}
        step={0.5}
        value={size}
        onChange={(e) => onSizeChange(Number(e.target.value))}
        className="h-1 w-20 accent-primary"
        aria-label="Brush size"
        title={`Size ${size}px`}
      />
      <div className="mx-1 grid h-6 w-6 place-items-center">
        <span className="rounded-full bg-foreground" style={{ width: Math.min(size + 2, 18), height: Math.min(size + 2, 18) }} />
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <div className="flex items-center gap-0.5 px-0.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`h-5 w-5 rounded-full ring-2 transition ${
              color === c ? "ring-primary scale-110" : "ring-transparent hover:scale-110"
            }`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
          aria-label="Custom color"
          title="Custom color"
        />
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <button className={btn(false)} onClick={onUndo} title="Undo (⌘Z)" aria-label="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        className={btn(false)}
        onClick={() => {
          if (confirm("Clear all ink strokes?")) onClear();
        }}
        title="Clear ink"
        aria-label="Clear ink"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
