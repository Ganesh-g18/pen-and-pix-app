import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Stroke, PaperType, PenStyle } from "@/lib/store";
import { EditorToolbar, type EditorTool, type EraserMode } from "./editor-toolbar";

interface Props {
  content: string;
  strokes: Stroke[];
  paper: PaperType;
  onContentChange: (html: string) => void;
  onAddStroke: (s: Stroke) => void;
  onUndoStroke: () => void;
  onClearStrokes: () => void;
  onEraseStroke: (id: string) => void;
  onReplaceStrokes?: (strokes: Stroke[]) => void;
  onCommitErase?: (prev: Stroke[], next: Stroke[]) => void;
}


const MIN_DOC_HEIGHT = 2400;

export function UnifiedEditor({
  content,
  strokes,
  paper,
  onContentChange,
  onAddStroke,
  onUndoStroke,
  onClearStrokes,
  onEraseStroke,
  onReplaceStrokes,
  onCommitErase,
}: Props) {

  const [tool, setTool] = useState<EditorTool>("text");
  const [penStyle, setPenStyle] = useState<PenStyle>("ballpoint");
  const [color, setColor] = useState("#0b0b0f");
  const [highlighterColor, setHighlighterColor] = useState("#fde68a");
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke");
  const [size, setSize] = useState(3);

  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const activePointersRef = useRef<Set<number>>(new Set());
  const drawingPointerIdRef = useRef<number | null>(null);
  const eraseSessionRef = useRef<{ prev: Stroke[]; working: Stroke[]; changed: boolean } | null>(null);
  const [erasePreview, setErasePreview] = useState<Stroke[] | null>(null);
  const [, force] = useState(0);
  const [docHeight, setDocHeight] = useState(MIN_DOC_HEIGHT);


  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type or draw anywhere…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none text-[15px] leading-relaxed max-w-3xl mx-auto px-6 py-10 min-h-[400px]",
      },
    },
    onUpdate: ({ editor }) => onContentChange(editor.getHTML()),
  });

  const lastExternal = useRef(content);
  useEffect(() => {
    if (editor && content !== lastExternal.current && content !== editor.getHTML()) {
      lastExternal.current = content;
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Recompute surface height when strokes or text change so canvas is truly infinite-ish.
  useEffect(() => {
    let maxY = 0;
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i += 3) {
        if (s.points[i] > maxY) maxY = s.points[i];
      }
    }
    const textEl = surfaceRef.current?.querySelector(".tiptap") as HTMLElement | null;
    const textH = textEl ? textEl.offsetTop + textEl.offsetHeight : 0;
    const next = Math.max(MIN_DOC_HEIGHT, maxY + 600, textH + 600);
    setDocHeight(next);
  }, [strokes, content]);

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

  const cancelActiveStroke = () => {
    drawingRef.current = null;
    drawingPointerIdRef.current = null;
    force((n) => n + 1);
  };

  const inkActive = tool === "pen" || tool === "highlighter" || tool === "eraser";

  const onPointerDown = (e: React.PointerEvent) => {
    if (!inkActive) return;
    if (e.button && e.button !== 0) return;
    activePointersRef.current.add(e.pointerId);
    if (activePointersRef.current.size >= 2) {
      cancelActiveStroke();
      return;
    }
    if (e.pointerType === "touch") e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const pt = getPoint(e);
    if (tool === "eraser") {
      eraseSessionRef.current = { prev: strokes, working: [...strokes], changed: false };
      hitErase(pt.x, pt.y);
      return;
    }

    const isHi = tool === "highlighter";
    const activeColor = isHi ? highlighterColor : color;
    const penSize =
      isHi ? size * 4 :
      penStyle === "marker" ? size * 2 :
      penStyle === "pencil" ? Math.max(0.8, size * 0.7) :
      size;
    const penOpacity =
      isHi ? 0.35 :
      penStyle === "marker" ? 0.9 :
      penStyle === "pencil" ? 0.75 :
      1;
    const strokeTool: Stroke["tool"] = isHi ? "highlighter" : penStyle === "marker" ? "marker" : "pen";
    drawingRef.current = {
      id: Math.random().toString(36).slice(2, 10),
      tool: strokeTool,
      penStyle: isHi ? undefined : penStyle,
      color: activeColor,
      size: penSize,
      opacity: penOpacity,
      points: [pt.x, pt.y, pt.p],
    };
    force((n) => n + 1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!inkActive) return;
    if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return;
    if (activePointersRef.current.size >= 2) return;
    if (tool === "eraser" ? drawingPointerIdRef.current !== e.pointerId : !drawingRef.current) return;
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
    activePointersRef.current.delete(e.pointerId);
    if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return;
    const s = drawingRef.current;
    drawingRef.current = null;
    drawingPointerIdRef.current = null;
    if (s && s.points.length >= 3) onAddStroke(s);
    const es = eraseSessionRef.current;
    if (es) {
      eraseSessionRef.current = null;
      setErasePreview(null);
      if (es.changed) {
        if (onCommitErase) onCommitErase(es.prev, es.working);
        else if (onReplaceStrokes) onReplaceStrokes(es.working);
      }
    }
    force((n) => n + 1);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (drawingPointerIdRef.current === e.pointerId) cancelActiveStroke();
    if (eraseSessionRef.current) {
      eraseSessionRef.current = null;
      setErasePreview(null);
    }
  };

  const hitErase = useCallback(
    (x: number, y: number) => {
      const es = eraseSessionRef.current;
      if (!es) return;
      const threshold = 12;
      if (eraserMode === "stroke") {
        for (let i = es.working.length - 1; i >= 0; i--) {
          const s = es.working[i];
          const pts = s.points;
          for (let j = 0; j < pts.length; j += 3) {
            const dx = pts[j] - x;
            const dy = pts[j + 1] - y;
            if (dx * dx + dy * dy < (threshold + s.size) ** 2) {
              es.working.splice(i, 1);
              es.changed = true;
              setErasePreview([...es.working]);
              return;
            }
          }
        }
        return;
      }
      // Spot eraser: split strokes at hit points
      let changed = false;
      const next: Stroke[] = [];
      for (const s of es.working) {
        const pts = s.points;
        const radius = threshold + s.size;
        const segments: number[][] = [];
        let current: number[] = [];
        let hit = false;
        for (let j = 0; j < pts.length; j += 3) {
          const dx = pts[j] - x;
          const dy = pts[j + 1] - y;
          if (dx * dx + dy * dy < radius * radius) {
            hit = true;
            if (current.length >= 6) segments.push(current);
            current = [];
          } else {
            current.push(pts[j], pts[j + 1], pts[j + 2]);
          }
        }
        if (current.length >= 6) segments.push(current);
        if (!hit) {
          next.push(s);
        } else {
          changed = true;
          for (const seg of segments) {
            next.push({ ...s, id: Math.random().toString(36).slice(2, 10), points: seg });
          }
        }
      }
      if (changed) {
        es.working = next;
        es.changed = true;
        setErasePreview([...next]);
      }
    },
    [eraserMode],
  );


  // Keyboard shortcuts (tool switching only when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (tool !== "text" && !(e.target as HTMLElement)?.closest("[contenteditable]")) {
          e.preventDefault();
          onUndoStroke();
          return;
        }
      }
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "t" || e.key === "T") setTool("text");
      if (e.key === "p" || e.key === "P") setTool("pen");
      if (e.key === "h" || e.key === "H") setTool("highlighter");
      if (e.key === "e" || e.key === "E") setTool("eraser");
      if (e.key === "v" || e.key === "V") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndoStroke, tool]);

  const cursor =
    tool === "eraser" ? "crosshair" : tool === "pen" || tool === "highlighter" ? "crosshair" : "text";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto"
        style={{ touchAction: inkActive ? "pinch-zoom" : "pan-y pinch-zoom" }}
      >
        <div
          ref={surfaceRef}
          className={`relative w-full ${paperClass}`}
          style={{ height: docHeight, minHeight: "100%" }}
        >
          {/* Text layer */}
          <div className="absolute inset-0" style={{ pointerEvents: inkActive ? "none" : "auto" }}>
            {editor && <EditorContent editor={editor} />}
          </div>

          {/* Ink layer */}
          <svg
            ref={svgRef}
            width="100%"
            height={docHeight}
            className="absolute inset-0 select-none"
            style={{
              cursor,
              pointerEvents: inkActive ? "auto" : "none",
              touchAction: inkActive ? "pinch-zoom" : "auto",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerUp}
          >
            {(erasePreview ?? strokes).map((s) => renderStrokePath(s, false))}
            {drawingRef.current && renderStrokePath(drawingRef.current, true)}

          </svg>
        </div>
      </div>

      <EditorToolbar
        tool={tool}
        onToolChange={setTool}
        penStyle={penStyle}
        onPenStyleChange={setPenStyle}
        color={color}
        onColorChange={setColor}
        highlighterColor={highlighterColor}
        onHighlighterColorChange={setHighlighterColor}
        size={size}
        onSizeChange={setSize}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        onUndo={onUndoStroke}
        onClear={onClearStrokes}
      />
    </div>
  );
}

function renderStrokePath(s: Stroke, isDrawing: boolean) {
  const key = isDrawing ? "drawing" : s.id;
  const dash = s.penStyle === "pencil"
    ? `${Math.max(0.5, s.size * 0.6)} ${Math.max(0.6, s.size * 0.8)}`
    : undefined;
  return (
    <path
      key={key}
      d={strokeToPath(s)}
      fill="none"
      stroke={s.color}
      strokeWidth={s.size}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={s.opacity}
      strokeDasharray={dash}
    />
  );
}

function strokeToPath(s: Stroke): string {
  const pts = s.points;
  if (pts.length < 3) return "";
  let d = `M ${pts[0]} ${pts[1]}`;
  if (pts.length < 9) {
    for (let i = 3; i < pts.length; i += 3) d += ` L ${pts[i]} ${pts[i + 1]}`;
    return d;
  }
  for (let i = 3; i < pts.length - 3; i += 3) {
    const x1 = pts[i], y1 = pts[i + 1];
    const x2 = pts[i + 3], y2 = pts[i + 4];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    d += ` Q ${x1} ${y1} ${mx} ${my}`;
  }
  const last = pts.length - 3;
  d += ` L ${pts[last]} ${pts[last + 1]}`;
  return d;
}
