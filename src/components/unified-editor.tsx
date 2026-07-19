import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Stroke, PaperType, PenStyle, PinnedPen, ToolPreset } from "@/lib/store";
import { useStore } from "@/lib/store";
import { EditorToolbar, type EditorTool, type EraserMode, type ToolConfigKey } from "./editor-toolbar";

interface Props {
  content: string;
  strokes: Stroke[];
  paper: PaperType;
  onContentChange: (html: string) => void;
  onAddStroke: (s: Stroke) => void;
  onUndoStroke: () => void;
  onRedoStroke: () => void;
  onClearStrokes: () => void;
  onEraseStroke: (id: string) => void;
  onReplaceStrokes?: (strokes: Stroke[]) => void;
  onCommitErase?: (prev: Stroke[], next: Stroke[]) => void;
}

const MIN_DOC_HEIGHT = 2400;

const FALLBACK_PRESET: ToolPreset = {
  color: "#0b0b0f", size: 2, opacity: 1, pressure: true, smoothing: true,
};
const DEFAULT_PRESETS: Record<ToolConfigKey, ToolPreset> = {
  ballpoint: { color: "#0b0b0f", size: 2, opacity: 1, pressure: true, smoothing: true },
  fountain:  { color: "#1e3a8a", size: 2.5, opacity: 1, pressure: true, smoothing: true },
  marker:    { color: "#dc2626", size: 6, opacity: 0.9, pressure: false, smoothing: true },
  pencil:    { color: "#374151", size: 1.5, opacity: 0.75, pressure: true, smoothing: false },
  brush:     { color: "#0b0b0f", size: 5, opacity: 0.95, pressure: true, smoothing: true },
  highlighter: { color: "#fde68a", size: 14, opacity: 0.35, pressure: false, smoothing: true },
};

export function UnifiedEditor({
  content, strokes, paper, onContentChange,
  onAddStroke, onUndoStroke, onRedoStroke,
  onClearStrokes, onReplaceStrokes, onCommitErase,
}: Props) {

  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [tool, setTool] = useState<EditorTool>("text");
  const [penStyle, setPenStyle] = useState<PenStyle>("ballpoint");
  const [eraserMode, setEraserMode] = useState<EraserMode>(settings.eraserPreset?.mode ?? "stroke");
  const [eraserSize, setEraserSize] = useState<number>(settings.eraserPreset?.size ?? 12);
  const [eraserSoftness, setEraserSoftness] = useState<number>(settings.eraserPreset?.softness ?? 0);

  const activeKey: ToolConfigKey = tool === "highlighter" ? "highlighter" : penStyle;
  const persistedPreset = settings.toolPresets?.[activeKey];
  const activeConfig: ToolPreset = useMemo(
    () => ({ ...DEFAULT_PRESETS[activeKey], ...(persistedPreset ?? {}) }),
    [activeKey, persistedPreset],
  );

  const patchConfig = useCallback((patch: Partial<ToolPreset>) => {
    const cur = settings.toolPresets?.[activeKey] ?? DEFAULT_PRESETS[activeKey];
    updateSettings({
      toolPresets: {
        ...(settings.toolPresets ?? {}),
        [activeKey]: { ...cur, ...patch },
      },
    });
  }, [settings.toolPresets, activeKey, updateSettings]);

  // Persist eraser preset on change
  useEffect(() => {
    updateSettings({ eraserPreset: { mode: eraserMode, size: eraserSize, softness: eraserSoftness } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraserMode, eraserSize, eraserSoftness]);

  const applyPinned = useCallback((p: PinnedPen) => {
    setTool("pen");
    setPenStyle(p.style);
    const merged: ToolPreset = {
      color: p.color,
      size: p.size,
      opacity: p.opacity ?? DEFAULT_PRESETS[p.style].opacity,
      pressure: p.pressure ?? DEFAULT_PRESETS[p.style].pressure,
      smoothing: p.smoothing ?? DEFAULT_PRESETS[p.style].smoothing,
    };
    updateSettings({
      toolPresets: {
        ...(settings.toolPresets ?? {}),
        [p.style]: merged,
      },
    });
  }, [settings.toolPresets, updateSettings]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    let maxY = 0;
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i += 3) {
        if (s.points[i] > maxY) maxY = s.points[i];
      }
    }
    const textEl = surfaceRef.current?.querySelector(".tiptap") as HTMLElement | null;
    const textH = textEl ? textEl.offsetTop + textEl.offsetHeight : 0;
    setDocHeight(Math.max(MIN_DOC_HEIGHT, maxY + 600, textH + 600));
  }, [strokes, content]);

  const paperClass =
    paper === "grid" ? "paper-grid" : paper === "dots" ? "paper-dots" : paper === "lined" ? "paper-lined" : "";

  const getPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      p: e.pressure && e.pressure > 0 ? e.pressure : 0,
      pt: e.pointerType,
    };
  };

  const cancelActiveStroke = () => {
    drawingRef.current = null;
    drawingPointerIdRef.current = null;
    force((n) => n + 1);
  };

  const inkActive = tool === "pen" || tool === "highlighter" || tool === "eraser";

  const strokeToolFor = (): Stroke["tool"] => {
    if (tool === "highlighter") return "highlighter";
    if (penStyle === "marker") return "marker";
    if (penStyle === "brush") return "brush";
    return "pen";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!inkActive) return;
    if (e.button && e.button !== 0) return;
    activePointersRef.current.add(e.pointerId);
    if (activePointersRef.current.size >= 2) { cancelActiveStroke(); return; }
    if (e.pointerType === "touch") e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const pt = getPoint(e);

    if (tool === "eraser") {
      eraseSessionRef.current = { prev: strokes, working: [...strokes], changed: false };
      hitErase(pt.x, pt.y);
      return;
    }

    drawingRef.current = {
      id: Math.random().toString(36).slice(2, 10),
      tool: strokeToolFor(),
      penStyle: tool === "highlighter" ? undefined : penStyle,
      color: activeConfig.color,
      size: activeConfig.size,
      opacity: activeConfig.opacity,
      points: [pt.x, pt.y, pt.p || 0.5],
    };
    force((n) => n + 1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!inkActive) return;
    const pt = getPoint(e);
    updateCursor(e.clientX, e.clientY);

    if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return;
    if (activePointersRef.current.size >= 2) return;
    if (tool === "eraser" ? drawingPointerIdRef.current !== e.pointerId : !drawingRef.current) return;
    if (e.pointerType === "touch") e.preventDefault();

    if (tool === "eraser") { hitErase(pt.x, pt.y); return; }
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
    if (s && s.points.length >= 3) {
      // Bake pressure into per-stroke size for constant-width tools if pressure enabled.
      const bake = shouldBakePressure(tool, penStyle) && activeConfig.pressure;
      if (bake) {
        let sum = 0, n = 0;
        for (let i = 2; i < s.points.length; i += 3) { sum += s.points[i]; n++; }
        const avg = n > 0 ? sum / n : 0.5;
        s.size = s.size * (0.65 + 0.7 * avg);
      }
      onAddStroke(s);
    }
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
      const radius = eraserSize / 2;
      if (eraserMode === "stroke") {
        for (let i = es.working.length - 1; i >= 0; i--) {
          const s = es.working[i];
          const pts = s.points;
          for (let j = 0; j < pts.length; j += 3) {
            const dx = pts[j] - x;
            const dy = pts[j + 1] - y;
            if (dx * dx + dy * dy < (radius + s.size) ** 2) {
              es.working.splice(i, 1);
              es.changed = true;
              setErasePreview([...es.working]);
              return;
            }
          }
        }
        return;
      }
      let changed = false;
      const next: Stroke[] = [];
      for (const s of es.working) {
        const pts = s.points;
        const r2 = radius + s.size;
        const segments: number[][] = [];
        let current: number[] = [];
        let hit = false;
        for (let j = 0; j < pts.length; j += 3) {
          const dx = pts[j] - x;
          const dy = pts[j + 1] - y;
          if (dx * dx + dy * dy < r2 * r2) {
            hit = true;
            if (current.length >= 6) segments.push(current);
            current = [];
          } else {
            current.push(pts[j], pts[j + 1], pts[j + 2]);
          }
        }
        if (current.length >= 6) segments.push(current);
        if (!hit) next.push(s);
        else {
          changed = true;
          for (const seg of segments) {
            next.push({ ...s, id: Math.random().toString(36).slice(2, 10), points: seg });
          }
        }
      }
      if (changed) {
        es.working = next; es.changed = true;
        setErasePreview([...next]);
      }
    },
    [eraserMode, eraserSize],
  );

  // Cursor overlay — direct DOM writes, no re-render.
  const updateCursor = useCallback((cx: number, cy: number) => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
  }, []);

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    if (!inkActive) { el.style.display = "none"; return; }
    el.style.display = "block";
    // Size/appearance:
    if (tool === "eraser") {
      if (eraserMode === "spot") {
        el.style.width = `${eraserSize}px`;
        el.style.height = `${eraserSize}px`;
        el.style.borderRadius = "9999px";
        el.style.border = "1px dashed rgba(15,23,42,0.65)";
        el.style.background = "rgba(148,163,184,0.15)";
      } else {
        el.style.width = "18px"; el.style.height = "18px";
        el.style.borderRadius = "3px";
        el.style.border = "1.5px solid rgba(15,23,42,0.75)";
        el.style.background = "rgba(255,255,255,0.6)";
      }
    } else if (tool === "highlighter") {
      el.style.width = "36px";
      el.style.height = `${Math.max(6, Math.min(40, activeConfig.size))}px`;
      el.style.borderRadius = "3px";
      el.style.border = "none";
      el.style.background = activeConfig.color;
      el.style.opacity = String(activeConfig.opacity);
    } else {
      const d = Math.max(6, activeConfig.size * 2 + 2);
      el.style.width = `${d}px`; el.style.height = `${d}px`;
      el.style.borderRadius = "9999px";
      el.style.border = `1.5px solid ${activeConfig.color}`;
      el.style.background = "transparent";
      el.style.opacity = "1";
    }
  }, [tool, eraserMode, eraserSize, activeConfig.size, activeConfig.color, activeConfig.opacity, inkActive]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (tool !== "text" && !(e.target as HTMLElement)?.closest("[contenteditable]")) {
          e.preventDefault(); onUndoStroke(); return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        if (tool !== "text" && !(e.target as HTMLElement)?.closest("[contenteditable]")) {
          e.preventDefault(); onRedoStroke(); return;
        }
      }
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "t") setTool("text");
      else if (k === "b") { setTool("pen"); setPenStyle("ballpoint"); }
      else if (k === "m") { setTool("pen"); setPenStyle("marker"); }
      else if (k === "p") { setTool("pen"); setPenStyle("pencil"); }
      else if (k === "f") { setTool("pen"); setPenStyle("fountain"); }
      else if (k === "r") { setTool("pen"); setPenStyle("brush"); }
      else if (k === "h") setTool("highlighter");
      else if (k === "e") setTool("eraser");
      else if (k === "v") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndoStroke, onRedoStroke, tool]);

  const cursor =
    inkActive ? "none" : "text";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto"
        style={{ touchAction: inkActive ? "pinch-zoom" : "pan-y pinch-zoom" }}
      >
        <div
          ref={surfaceRef}
          data-editor-surface
          className={`relative w-full ${paperClass}`}
          style={{ height: docHeight, minHeight: "100%" }}
        >
          <div className="absolute inset-0" style={{ pointerEvents: inkActive ? "none" : "auto" }}>
            {editor && <EditorContent editor={editor} />}
          </div>

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
            onPointerLeave={(e) => {
              if (cursorRef.current) cursorRef.current.style.display = "none";
              onPointerUp(e);
            }}
            onPointerEnter={() => {
              if (cursorRef.current && inkActive) cursorRef.current.style.display = "block";
            }}
          >
            {(erasePreview ?? strokes).map((s) => renderStrokePath(s, false, activeConfig.pressure))}
            {drawingRef.current && renderStrokePath(drawingRef.current, true, activeConfig.pressure)}
          </svg>
        </div>
      </div>

      {/* Cursor preview overlay */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[45]"
        style={{ display: "none", willChange: "transform" }}
      />

      <EditorToolbar
        tool={tool}
        onToolChange={setTool}
        penStyle={penStyle}
        onPenStyleChange={setPenStyle}
        activeConfig={activeConfig}
        onConfigPatch={patchConfig}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
        eraserSoftness={eraserSoftness}
        onEraserSoftnessChange={setEraserSoftness}
        onApplyPinned={applyPinned}
        onUndo={onUndoStroke}
        onRedo={onRedoStroke}
        onClear={onClearStrokes}
      />
    </div>
  );
}

function shouldBakePressure(tool: EditorTool, penStyle: PenStyle): boolean {
  if (tool !== "pen") return false;
  return penStyle === "ballpoint" || penStyle === "marker";
}

function renderStrokePath(s: Stroke, isDrawing: boolean, pressureOn: boolean) {
  const key = isDrawing ? "drawing" : s.id;
  const dash = s.penStyle === "pencil"
    ? `${Math.max(0.5, s.size * 0.6)} ${Math.max(0.6, s.size * 0.8)}`
    : undefined;

  // Variable-width strokes for expressive tools while drawing (fountain, brush, pencil).
  const wantsVariable = isDrawing && pressureOn &&
    (s.penStyle === "fountain" || s.penStyle === "brush" || s.penStyle === "pencil");

  if (wantsVariable && s.points.length >= 6) {
    // Emit stacked segments with per-sample width — cheap and legible.
    const segs: JSX.Element[] = [];
    for (let i = 0; i + 5 < s.points.length; i += 3) {
      const x1 = s.points[i], y1 = s.points[i + 1], p1 = s.points[i + 2] || 0.5;
      const x2 = s.points[i + 3], y2 = s.points[i + 4], p2 = s.points[i + 5] || 0.5;
      const p = (p1 + p2) / 2;
      const factor =
        s.penStyle === "fountain" || s.penStyle === "brush" ? 0.2 + 1.1 * p :
        s.penStyle === "pencil" ? 0.3 + 0.9 * p : 1;
      segs.push(
        <line
          key={`${key}-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={s.color}
          strokeWidth={Math.max(0.3, s.size * factor)}
          strokeLinecap="round"
          opacity={s.opacity}
        />,
      );
    }
    return <g key={key}>{segs}</g>;
  }

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
