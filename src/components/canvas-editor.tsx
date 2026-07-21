import { useEffect, useRef, useState, useCallback } from "react";
import type { Stroke, PaperType } from "@/lib/store";
import { Pen, Highlighter, Eraser, Undo2, Trash2, Circle, Minus } from "lucide-react";

type Tool = "pen" | "highlighter" | "marker" | "eraser";

interface Props {
  strokes: Stroke[];
  paper: PaperType;
  onAddStroke: (s: Stroke) => void;
  onUndo: () => void;
  onClear: () => void;
  onEraseStroke: (id: string) => void;
}

const COLORS = ["#0b0b0f", "#2563eb", "#dc2626", "#059669", "#eab308", "#a855f7", "#ec4899", "#f97316"];

export function CanvasEditor({ strokes, paper, onAddStroke, onUndo, onClear, onEraseStroke }: Props) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const activePointersRef = useRef<Set<number>>(new Set());
  const drawingPointerIdRef = useRef<number | null>(null);
  const [, force] = useState(0);

  const paperClass =
    paper === "grid" ? "paper-grid" : paper === "dots" ? "paper-dots" : paper === "lined" ? "paper-lined" : "";

  const getPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      p: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const cancelActiveStroke = (e?: React.PointerEvent) => {
    drawingRef.current = null;
    drawingPointerIdRef.current = null;
    if (e) {
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
    }
    force((n) => n + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activePointersRef.current.add(e.pointerId);

    // Second (or more) pointer down — cancel any in-progress drawing and let the browser handle gesture
    if (activePointersRef.current.size >= 2) {
      cancelActiveStroke();
      return;
    }

    // Only touch requires preventDefault to start drawing; leave pen/mouse alone
    if (e.pointerType === "touch") e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const pt = getPoint(e);

    if (tool === "eraser") {
      drawingRef.current = null;
      hitErase(pt.x, pt.y);
      return;
    }

    const opacity = tool === "highlighter" ? 0.35 : 1;
    const strokeTool: Stroke["tool"] = tool === "highlighter" ? "highlighter" : tool === "marker" ? "marker" : "pen";
    drawingRef.current = {
      id: Math.random().toString(36).slice(2, 10),
      tool: strokeTool,
      color,
      size: tool === "highlighter" ? size * 4 : tool === "marker" ? size * 2 : size,
      opacity,
      points: [pt.x, pt.y, pt.p],
    };
    force((n) => n + 1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Ignore moves from pointers other than the one that started drawing
    e.preventDefault();
    if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return;
    if (activePointersRef.current.size >= 2) return;
    if (tool !== "eraser" && !drawingRef.current) return;

    if (e.pointerType === "touch") e.preventDefault();
    const pt = getPoint(e);

    if (tool === "eraser") {
      hitErase(pt.x, pt.y);
      return;
    }
    const s = drawingRef.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent as PointerEvent];
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    for (const ev of events) {
      s.points.push(ev.clientX - r.left, ev.clientY - r.top, ev.pressure || 0.5);
    }
    force((n) => n + 1);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    activePointersRef.current.delete(e.pointerId);
    if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) {
      // A non-drawing finger lifted; keep state as-is
      return;
    }
    const s = drawingRef.current;
    drawingRef.current = null;
    drawingPointerIdRef.current = null;
    if (s && s.points.length >= 3) onAddStroke(s);
    force((n) => n + 1);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (drawingPointerIdRef.current === e.pointerId) {
      drawingRef.current = null;
      drawingPointerIdRef.current = null;
      force((n) => n + 1);
    }
  };

  const hitErase = useCallback(
    (x: number, y: number) => {
      const threshold = 12;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        const pts = s.points;
        for (let j = 0; j < pts.length; j += 3) {
          const dx = pts[j] - x;
          const dy = pts[j + 1] - y;
          if (dx * dx + dy * dy < (threshold + s.size) ** 2) {
            onEraseStroke(s.id);
            return;
          }
        }
      }
    },
    [strokes, onEraseStroke],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.key === "p" || e.key === "P") setTool("pen");
      if (e.key === "h" || e.key === "H") setTool("highlighter");
      if (e.key === "b" || e.key === "B") setTool("marker");
      if (e.key === "e" || e.key === "E") setTool("eraser");
      if (["1", "2", "3", "4"].includes(e.key)) setSize([2, 3, 5, 8][Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo]);

  const btn = (active: boolean) =>
    `grid h-9 w-9 place-items-center rounded-xl transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;

  return (
    <div
      className="relative flex-1 overflow-hidden select-none"
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div className={`absolute inset-0 ${paperClass}`}>
        <svg
          ref={svgRef}
          className="w-full h-full select-none"
          style={{
            cursor: "crosshair",
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerUp}
        >
          {strokes.map((s) => (
            <path
              key={s.id}
              d={strokeToPath(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.size}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.opacity}
            />
          ))}
          {drawingRef.current && (
            <path
              d={strokeToPath(drawingRef.current)}
              fill="none"
              stroke={drawingRef.current.color}
              strokeWidth={drawingRef.current.size}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={drawingRef.current.opacity}
            />
          )}
        </svg>
      </div>

      {/* Floating toolbar */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-1 rounded-2xl glass-strong px-2 py-1.5 shadow-float">
        <button className={btn(tool === "pen")} onClick={() => setTool("pen")} title="Pen (P)">
          <Pen className="h-4 w-4" />
        </button>
        <button className={btn(tool === "highlighter")} onClick={() => setTool("highlighter")} title="Highlighter (H)">
          <Highlighter className="h-4 w-4" />
        </button>
        <button className={btn(tool === "marker")} onClick={() => setTool("marker")} title="Marker (B)">
          <Circle className="h-4 w-4 fill-current" />
        </button>
        <button className={btn(tool === "eraser")} onClick={() => setTool("eraser")} title="Eraser (E)">
          <Eraser className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        {[2, 3, 5, 8].map((s, i) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${size === s ? "bg-primary/15" : "hover:bg-accent"}`}
            title={`Size ${i + 1}`}
          >
            <span className="rounded-full bg-current" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        <div className="flex items-center gap-1 px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full ring-2 transition ${color === c ? "ring-primary scale-110" : "ring-transparent hover:scale-110"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="w-px h-6 bg-border mx-1" />
        <button className={btn(false)} onClick={onUndo} title="Undo (⌘Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          className={btn(false)}
          onClick={() => {
            if (confirm("Clear canvas?")) onClear();
          }}
          title="Clear"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Convert flat points to smooth SVG path using quadratic curves
function strokeToPath(s: Stroke): string {
  const pts = s.points;
  if (pts.length < 3) return "";
  let d = `M ${pts[0]} ${pts[1]}`;
  if (pts.length < 9) {
    for (let i = 3; i < pts.length; i += 3) d += ` L ${pts[i]} ${pts[i + 1]}`;
    return d;
  }
  for (let i = 3; i < pts.length - 3; i += 3) {
    const x1 = pts[i],
      y1 = pts[i + 1];
    const x2 = pts[i + 3],
      y2 = pts[i + 4];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    d += ` Q ${x1} ${y1} ${mx} ${my}`;
  }
  const last = pts.length - 3;
  d += ` L ${pts[last]} ${pts[last + 1]}`;
  return d;
}
