import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Stroke, PaperType, PenStyle, PinnedPen, ToolPreset, TextBlock, PaperOptions, PageOrientation } from "@/lib/store";
import { useStore } from "@/lib/store";
import { EditorToolbar, type EditorTool, type EraserMode, type ToolConfigKey, type ShapeKind } from "./editor-toolbar";
import { TextBlockLayer } from "./text-block-layer";
import { TextToolPanel } from "./text-tool-panel";

interface Props {
  content: string;
  strokes: Stroke[];
  paper: PaperType;
  paperOptions?: PaperOptions;
  pageOrientation?: PageOrientation;
  textBlocks?: TextBlock[];
  onContentChange: (html: string) => void;
  onTextBlocksChange?: (blocks: TextBlock[]) => void;
  onAddStroke: (s: Stroke) => void;
  onUndoStroke: () => void;
  onRedoStroke: () => void;
  onClearStrokes: () => void;
  onEraseStroke: (id: string) => void;
  onReplaceStrokes?: (strokes: Stroke[]) => void;
  onCommitErase?: (prev: Stroke[], next: Stroke[]) => void;
}

const PAGE_SIZES = {
  A4: { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } },
} as const;
const PAGE_GAP = 24;

const FALLBACK_PRESET: ToolPreset = {
  color: "#0b0b0f",
  size: 2,
  opacity: 1,
  pressure: true,
  smoothing: true,
};
const DEFAULT_PRESETS: Record<ToolConfigKey, ToolPreset> = {
  ballpoint: { color: "#0b0b0f", size: 2, opacity: 1, pressure: true, smoothing: true },
  fountain: { color: "#1e3a8a", size: 2.5, opacity: 1, pressure: true, smoothing: true },
  marker: { color: "#dc2626", size: 6, opacity: 0.9, pressure: false, smoothing: true },
  pencil: { color: "#374151", size: 1.5, opacity: 0.75, pressure: true, smoothing: false },
  brush: { color: "#0b0b0f", size: 5, opacity: 0.95, pressure: true, smoothing: true },
  highlighter: { color: "#fde68a", size: 14, opacity: 0.35, pressure: false, smoothing: true },
};

export function UnifiedEditor({
  content,
  strokes,
  paper,
  paperOptions,
  textBlocks,
  onContentChange,
  onTextBlocksChange,
  onAddStroke,
  onUndoStroke,
  onRedoStroke,
  onClearStrokes,
  onReplaceStrokes,
  onCommitErase,
}: Props) {

  const [isExporting, setIsExporting] = useState(false);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [tool, setTool] = useState<EditorTool>("text");
  const [penStyle, setPenStyle] = useState<PenStyle>("ballpoint");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [eraserMode, setEraserMode] = useState<EraserMode>(settings.eraserPreset?.mode ?? "stroke");
  const [eraserSize, setEraserSize] = useState<number>(settings.eraserPreset?.size ?? 12);
  const [eraserSoftness, setEraserSoftness] = useState<number>(settings.eraserPreset?.softness ?? 0);

  const activeKey: ToolConfigKey = tool === "highlighter" ? "highlighter" : penStyle;
  const persistedPreset = settings.toolPresets?.[activeKey];
  const activeConfig: ToolPreset = useMemo(
    () => ({ ...DEFAULT_PRESETS[activeKey], ...(persistedPreset ?? {}) }),
    [activeKey, persistedPreset],
  );

  const patchConfig = useCallback(
    (patch: Partial<ToolPreset>) => {
      const cur = settings.toolPresets?.[activeKey] ?? DEFAULT_PRESETS[activeKey];
      updateSettings({
        toolPresets: {
          ...(settings.toolPresets ?? {}),
          [activeKey]: { ...cur, ...patch },
        },
      });
    },
    [settings.toolPresets, activeKey, updateSettings],
  );

  // Persist eraser preset on change
  useEffect(() => {
    updateSettings({ eraserPreset: { mode: eraserMode, size: eraserSize, softness: eraserSoftness } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraserMode, eraserSize, eraserSoftness]);

  const applyPinned = useCallback(
    (p: PinnedPen) => {
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
    },
    [settings.toolPresets, updateSettings],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const beginExport = useCallback(async () => {
  setIsExporting(true);

  // wait until React finishes rendering
  await new Promise(requestAnimationFrame);

  // wait for fonts
  if ("fonts" in document) {
    try {
      await (document as any).fonts.ready;
    } catch {}
  }

  // wait another frame so html2canvas captures a stable layout
  await new Promise(requestAnimationFrame);

  return surfaceRef.current;
}, []);

const endExport = useCallback(() => {
  setIsExporting(false);
}, []);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const activePointersRef = useRef<Set<number>>(new Set());
  const drawingPointerIdRef = useRef<number | null>(null);
  const eraseSessionRef = useRef<{ prev: Stroke[]; working: Stroke[]; changed: boolean } | null>(null);
  const [erasePreview, setErasePreview] = useState<Stroke[] | null>(null);
  const [, force] = useState(0);
  const [docHeight, setDocHeight] = useState(MIN_DOC_HEIGHT);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectDrag, setSelectDrag] = useState<{ ids: Set<string>; dx: number; dy: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "" }),
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

  const paperStyle: React.CSSProperties = paperOptions
    ? {
        ["--paper-thickness" as unknown as string]: `${paperOptions.thickness ?? 1}px`,
        ["--paper-spacing" as unknown as string]: `${paperOptions.spacing ?? 24}px`,
        ...(paperOptions.color ? { ["--paper-color" as unknown as string]: paperOptions.color } : {}),
        ...(paperOptions.margin ? { ["--paper-margin" as unknown as string]: `${paperOptions.margin}px` } : {}),
      }
    : {};

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

  const inkActive = tool === "pen" || tool === "highlighter" || tool === "eraser" || tool === "shape";

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

    if (tool === "shape") {
      shapeStartRef.current = { x: pt.x, y: pt.y };
      drawingRef.current = {
        id: Math.random().toString(36).slice(2, 10),
        tool: "pen",
        color: activeConfig.color,
        size: activeConfig.size,
        opacity: activeConfig.opacity,
        points: buildShapePoints(shapeKind, pt.x, pt.y, pt.x, pt.y),
      };
      force((n) => n + 1);
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

    if (tool === "eraser") {
      hitErase(pt.x, pt.y);
      return;
    }
    const s = drawingRef.current;
    if (!s) return;
    if (tool === "shape" && shapeStartRef.current) {
      const start = shapeStartRef.current;
      s.points = buildShapePoints(shapeKind, start.x, start.y, pt.x, pt.y);
      force((n) => n + 1);
      return;
    }
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
    if (tool === "shape") {
      shapeStartRef.current = null;
      if (s && s.points.length >= 6) onAddStroke(s);
    } else if (s && s.points.length >= 3) {
      // Bake pressure into per-stroke size for constant-width tools if pressure enabled.
      const bake = shouldBakePressure(tool, penStyle) && activeConfig.pressure;
      if (bake) {
        let sum = 0,
          n = 0;
        for (let i = 2; i < s.points.length; i += 3) {
          sum += s.points[i];
          n++;
        }
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
        es.working = next;
        es.changed = true;
        setErasePreview([...next]);
      }
    },
    [eraserMode, eraserSize],
  );

  // ---- Select-tool: drag drawn strokes (grouped by overlapping bounding boxes) ----
  type BBox = { minX: number; minY: number; maxX: number; maxY: number };
  const bboxOf = (s: Stroke): BBox => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const pts = s.points;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i],
        y = pts[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const pad = (s.size || 2) + 6;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  };
  const bboxOverlap = (a: BBox, b: BBox) => !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);

  const beginStrokeDrag = (e: React.PointerEvent<SVGGElement>, seedId: string) => {
    if (tool !== "select") return;
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const bboxes = new Map<string, BBox>();
    for (const s of strokes) bboxes.set(s.id, bboxOf(s));
    const group = new Set<string>([seedId]);
    const queue = [seedId];
    while (queue.length) {
      const cur = queue.shift()!;
      const cb = bboxes.get(cur);
      if (!cb) continue;
      for (const s of strokes) {
        if (group.has(s.id)) continue;
        const nb = bboxes.get(s.id);
        if (nb && bboxOverlap(cb, nb)) {
          group.add(s.id);
          queue.push(s.id);
        }
      }
    }
    const startX = e.clientX,
      startY = e.clientY;
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(pointerId);
    } catch {
      /* noop */
    }
    setSelectDrag({ ids: group, dx: 0, dy: 0 });
    const prevStrokes = strokes;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      setSelectDrag({ ids: group, dx: ev.clientX - startX, dy: ev.clientY - startY });
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* noop */
      }
      const dx = ev.clientX - startX,
        dy = ev.clientY - startY;
      setSelectDrag(null);
      if (Math.hypot(dx, dy) < 2) return;
      const next = prevStrokes.map((s) => {
        if (!group.has(s.id)) return s;
        const pts = s.points.slice();
        for (let i = 0; i < pts.length; i += 3) {
          pts[i] += dx;
          pts[i + 1] += dy;
        }
        return { ...s, points: pts };
      });
      if (onCommitErase) onCommitErase(prevStrokes, next);
      else if (onReplaceStrokes) onReplaceStrokes(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Cursor overlay — direct DOM writes, no re-render.
  const updateCursor = useCallback((cx: number, cy: number) => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
  }, []);

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    if (!inkActive) {
      el.style.display = "none";
      return;
    }
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
        el.style.width = "18px";
        el.style.height = "18px";
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
    } else if (tool === "shape") {
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "0";
      el.style.border = "none";
      el.style.opacity = "0.9";
      el.style.background =
        `linear-gradient(${activeConfig.color},${activeConfig.color}) center/100% 1.5px no-repeat,` +
        `linear-gradient(${activeConfig.color},${activeConfig.color}) center/1.5px 100% no-repeat`;
    } else {
      const d = Math.max(6, activeConfig.size * 2 + 2);
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
      el.style.borderRadius = "9999px";
      el.style.border = `1.5px solid ${activeConfig.color}`;
      el.style.background = "transparent";
      el.style.opacity = "1";
    }
  }, [tool, eraserMode, eraserSize, activeConfig.size, activeConfig.color, activeConfig.opacity, inkActive]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditable = !!(e.target as HTMLElement)?.closest("[contenteditable='true']");
      // List shortcuts inside text blocks / tiptap
      if (inEditable && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === "7" || e.code === "Digit7") {
          e.preventDefault();
          document.execCommand("insertOrderedList");
          return;
        }
        if (e.key === "8" || e.code === "Digit8") {
          e.preventDefault();
          document.execCommand("insertUnorderedList");
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (tool !== "text" && !inEditable) {
          e.preventDefault();
          onUndoStroke();
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        if (tool !== "text" && !inEditable) {
          e.preventDefault();
          onRedoStroke();
          return;
        }
      }
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "t") setTool("text");
      else if (k === "b") {
        setTool("pen");
        setPenStyle("ballpoint");
      } else if (k === "m") {
        setTool("pen");
        setPenStyle("marker");
      } else if (k === "p") {
        setTool("pen");
        setPenStyle("pencil");
      } else if (k === "f") {
        setTool("pen");
        setPenStyle("fountain");
      } else if (k === "r") {
        setTool("pen");
        setPenStyle("brush");
      } else if (k === "h") setTool("highlighter");
      else if (k === "e") setTool("eraser");
      else if (k === "v") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndoStroke, onRedoStroke, tool]);

  const cursor = inkActive ? "none" : "text";

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
    data-exporting={isExporting}
          className={`relative w-full ${paperClass}`}
          style={{ height: docHeight, minHeight: "100%", cursor: tool === "text" ? "text" : undefined, ...paperStyle }}
        >
          <div className="absolute inset-0" style={{ pointerEvents: tool === "select" ? "auto" : "none" }}>
            {editor && <EditorContent editor={editor} />}
          </div>

          {/* Freeform text blocks — sit above tiptap, below ink SVG. */}
          {onTextBlocksChange && (
            <TextBlockLayer
              blocks={textBlocks ?? []}
              onChange={onTextBlocksChange}
              toolActive={tool === "text" ? "text" : tool === "select" ? "select" : "ink"}
              surfaceRef={surfaceRef}
              editingId={editingTextId}
              onEditingChange={setEditingTextId}
            />
          )}

          <svg
            ref={svgRef}
            width="100%"
            height={docHeight}
            className="absolute inset-0 select-none"
            style={{
              cursor,
              pointerEvents: inkActive ? "auto" : tool === "select" ? "auto" : "none",
              touchAction: inkActive ? "pinch-zoom" : tool === "select" ? "none" : "auto",
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
            {(erasePreview ?? strokes).map((s) => {
              const child = renderStrokePath(s, false, activeConfig.pressure);
              if (tool !== "select") return child;
              const dragging = selectDrag?.ids.has(s.id);
              const transform = dragging ? `translate(${selectDrag!.dx} ${selectDrag!.dy})` : undefined;
              return (
                <g
                  key={s.id}
                  transform={transform}
                  style={{ pointerEvents: "auto", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                  onPointerDown={(e) => beginStrokeDrag(e, s.id)}
                >
                  {child}
                </g>
              );
            })}
            {drawingRef.current && renderStrokePath(drawingRef.current, true, activeConfig.pressure)}
            {tool === "shape" &&
              shapeStartRef.current &&
              drawingRef.current &&
              (() => {
                const s = shapeStartRef.current!;
                const pts = drawingRef.current!.points;
                let minX = s.x,
                  minY = s.y,
                  maxX = s.x,
                  maxY = s.y;
                for (let i = 0; i < pts.length; i += 3) {
                  if (pts[i] < minX) minX = pts[i];
                  if (pts[i] > maxX) maxX = pts[i];
                  if (pts[i + 1] < minY) minY = pts[i + 1];
                  if (pts[i + 1] > maxY) maxY = pts[i + 1];
                }
                const w = Math.round(maxX - minX);
                const h = Math.round(maxY - minY);
                return (
                  <g pointerEvents="none">
                    <rect
                      x={minX - 4}
                      y={minY - 4}
                      width={maxX - minX + 8}
                      height={maxY - minY + 8}
                      fill="none"
                      stroke="hsl(var(--primary, 220 90% 56%))"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.75}
                    />
                    {[
                      [minX - 4, minY - 4],
                      [maxX + 4, minY - 4],
                      [minX - 4, maxY + 4],
                      [maxX + 4, maxY + 4],
                    ].map(([hx, hy], i) => (
                      <rect
                        key={i}
                        x={hx - 3}
                        y={hy - 3}
                        width={6}
                        height={6}
                        fill="white"
                        stroke="hsl(var(--primary, 220 90% 56%))"
                        strokeWidth={1}
                      />
                    ))}
                    <g transform={`translate(${maxX + 8}, ${maxY + 16})`}>
                      <rect
                        x={0}
                        y={-11}
                        rx={4}
                        ry={4}
                        width={String(w).length * 7 + String(h).length * 7 + 22}
                        height={16}
                        fill="hsl(var(--primary, 220 90% 56%))"
                        opacity={0.95}
                      />
                      <text
                        x={6}
                        y={1}
                        fill="white"
                        fontSize={10}
                        fontFamily="ui-sans-serif, system-ui"
                        fontWeight={600}
                      >
                        {w} × {h}
                      </text>
                    </g>
                  </g>
                );
              })()}
          </svg>
        </div>
      </div>

      {/* Cursor preview overlay */}
      {!isExporting && (
<div
    ref={cursorRef}
    className="pointer-events-none fixed left-0 top-0 z-[45]"
    style={{
        display: "none",
        willChange: "transform",
    }}
/>
)}

      {!isExporting && (
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
        shapeKind={shapeKind}
        onShapeKindChange={setShapeKind}
      />
      )}
      {!isExporting &&
 tool === "text" &&
 onTextBlocksChange && (
        <TextToolPanel editingId={editingTextId} blocks={textBlocks ?? []} onBlocksChange={onTextBlocksChange} />
      )}
    </div>
  );
}

function shouldBakePressure(tool: EditorTool, penStyle: PenStyle): boolean {
  if (tool !== "pen") return false;
  return penStyle === "ballpoint" || penStyle === "marker";
}

function renderStrokePath(s: Stroke, isDrawing: boolean, pressureOn: boolean) {
  const key = isDrawing ? "drawing" : s.id;
  const dash = s.penStyle === "pencil" ? `${Math.max(0.5, s.size * 0.6)} ${Math.max(0.6, s.size * 0.8)}` : undefined;

  // Variable-width strokes for expressive tools while drawing (fountain, brush, pencil).
  const wantsVariable =
    isDrawing && pressureOn && (s.penStyle === "fountain" || s.penStyle === "brush" || s.penStyle === "pencil");

  if (wantsVariable && s.points.length >= 6) {
    // Emit stacked segments with per-sample width — cheap and legible.
    const segs: React.ReactElement[] = [];
    for (let i = 0; i + 5 < s.points.length; i += 3) {
      const x1 = s.points[i],
        y1 = s.points[i + 1],
        p1 = s.points[i + 2] || 0.5;
      const x2 = s.points[i + 3],
        y2 = s.points[i + 4],
        p2 = s.points[i + 5] || 0.5;
      const p = (p1 + p2) / 2;
      const factor =
        s.penStyle === "fountain" || s.penStyle === "brush"
          ? 0.2 + 1.1 * p
          : s.penStyle === "pencil"
            ? 0.3 + 0.9 * p
            : 1;
      segs.push(
        <line
          key={`${key}-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
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

// Sample points along the outline of a shape so it can be stored/edited as a normal stroke.
function buildShapePoints(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number): number[] {
  const pts: number[] = [];
  const push = (x: number, y: number) => pts.push(x, y, 0.5);

  if (kind === "line" || kind === "arrow") {
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
    if (kind === "arrow") {
      const dx = x1 - x0,
        dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len,
        uy = dy / len;
      const head = Math.min(28, Math.max(10, len * 0.22));
      const ang = Math.PI / 7;
      const cos = Math.cos(ang),
        sin = Math.sin(ang);
      // left barb
      const lx = x1 - head * (ux * cos + uy * sin);
      const ly = y1 - head * (uy * cos - ux * sin);
      // right barb
      const rx = x1 - head * (ux * cos - uy * sin);
      const ry = y1 - head * (uy * cos + ux * sin);
      const seg = 10;
      for (let i = 1; i <= seg; i++) {
        const t = i / seg;
        push(x1 + (lx - x1) * t, y1 + (ly - y1) * t);
      }
      for (let i = seg - 1; i >= 0; i--) {
        const t = i / seg;
        push(x1 + (lx - x1) * t, y1 + (ly - y1) * t);
      }
      for (let i = 1; i <= seg; i++) {
        const t = i / seg;
        push(x1 + (rx - x1) * t, y1 + (ry - y1) * t);
      }
    }
    return pts;
  }

  const minX = Math.min(x0, x1),
    maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1),
    maxY = Math.max(y0, y1);

  if (kind === "rect") {
    const stepsX = Math.max(6, Math.round((maxX - minX) / 6));
    const stepsY = Math.max(6, Math.round((maxY - minY) / 6));
    for (let i = 0; i <= stepsX; i++) push(minX + ((maxX - minX) * i) / stepsX, minY);
    for (let i = 1; i <= stepsY; i++) push(maxX, minY + ((maxY - minY) * i) / stepsY);
    for (let i = 1; i <= stepsX; i++) push(maxX - ((maxX - minX) * i) / stepsX, maxY);
    for (let i = 1; i <= stepsY; i++) push(minX, maxY - ((maxY - minY) * i) / stepsY);
    return pts;
  }

  if (kind === "circle") {
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    const rx = (maxX - minX) / 2,
      ry = (maxY - minY) / 2;
    const steps = Math.max(24, Math.round((rx + ry) * 0.6));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry);
    }
    return pts;
  }

  if (kind === "triangle") {
    const apex = { x: (minX + maxX) / 2, y: minY };
    const bl = { x: minX, y: maxY };
    const br = { x: maxX, y: maxY };
    const seg = 20;
    const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    };
    edge(apex, br);
    edge(br, bl);
    edge(bl, apex);
    return pts;
  }

  return pts;
}
