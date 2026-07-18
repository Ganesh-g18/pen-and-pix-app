import {
  Pen, PenTool, Pencil, Paintbrush, Highlighter, Eraser, Type, MousePointer2,
  Undo2, Redo2, Trash2, ChevronDown, CircleDashed, Pin, X, GripVertical, Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PenStyle, PinnedPen } from "@/lib/store";
import { useStore } from "@/lib/store";

export type EditorTool = "select" | "text" | "pen" | "highlighter" | "eraser";
export type EraserMode = "stroke" | "spot";

const COLORS = ["#0b0b0f", "#2563eb", "#dc2626", "#059669", "#eab308", "#a855f7", "#ec4899", "#f97316"];
const HIGHLIGHT_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa"];

const PEN_LIBRARY: { id: PenStyle; label: string; desc: string }[] = [
  { id: "ballpoint", label: "Ballpoint", desc: "Crisp, consistent line" },
  { id: "fountain", label: "Fountain", desc: "Pressure-varied elegance" },
  { id: "marker", label: "Marker", desc: "Thick, opaque strokes" },
  { id: "pencil", label: "Pencil", desc: "Soft, sketchy texture" },
];

const PEN_ICON: Record<PenStyle, typeof Pen> = {
  ballpoint: Pen,
  fountain: PenTool,
  marker: Paintbrush,
  pencil: Pencil,
};

const LONG_PRESS_MS = 450;

interface Props {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  penStyle: PenStyle;
  onPenStyleChange: (p: PenStyle) => void;
  color: string;
  onColorChange: (c: string) => void;
  highlighterColor: string;
  onHighlighterColorChange: (c: string) => void;
  size: number;
  onSizeChange: (n: number) => void;
  eraserMode: EraserMode;
  onEraserModeChange: (m: EraserMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function EditorToolbar({
  tool, onToolChange, penStyle, onPenStyleChange,
  color, onColorChange, highlighterColor, onHighlighterColorChange,
  size, onSizeChange, eraserMode, onEraserModeChange, onUndo, onRedo, onClear,
}: Props) {

  const pinnedPens = useStore((s) => s.settings.pinnedPens);
  const updateSettings = useStore((s) => s.updateSettings);

  const [penOpen, setPenOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [eraserOpen, setEraserOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPenOpen(false); setColorOpen(false); setEraserOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const startLongPress = (fn: () => void) => {
    lpFired.current = false;
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
    lpTimer.current = window.setTimeout(() => {
      lpFired.current = true;
      fn();
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (lpTimer.current) { window.clearTimeout(lpTimer.current); lpTimer.current = null; }
  };

  const btn = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  const isPen = tool === "pen";
  const activeColor = tool === "highlighter" ? highlighterColor : color;
  const setActiveColor = tool === "highlighter" ? onHighlighterColorChange : onColorChange;
  const swatches = tool === "highlighter" ? HIGHLIGHT_COLORS : COLORS;

  const popover = "fixed left-1/2 -translate-x-1/2 bottom-16 z-50";

  const PenIcon = useMemo(() => PEN_ICON[penStyle] ?? Pen, [penStyle]);
  const EraserIcon = eraserMode === "spot" ? CircleDashed : Eraser;

  const applyPinned = (p: PinnedPen) => {
    onToolChange("pen");
    onPenStyleChange(p.style);
    onColorChange(p.color);
    onSizeChange(p.size);
  };

  const pinCurrent = () => {
    const exists = pinnedPens.some(
      (p) => p.style === penStyle && p.color.toLowerCase() === color.toLowerCase() && p.size === size,
    );
    if (exists) return;
    const next: PinnedPen = {
      id: "pp-" + Math.random().toString(36).slice(2, 8),
      style: penStyle,
      color,
      size,
    };
    updateSettings({ pinnedPens: [...pinnedPens, next] });
  };

  const removePinned = (id: string) =>
    updateSettings({ pinnedPens: pinnedPens.filter((p) => p.id !== id) });

  // HTML5 drag-reorder
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const onDragStart = (id: string) => (e: React.DragEvent) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== id) setDragOver(id);
  };
  const onDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragId.current;
    dragId.current = null;
    setDragOver(null);
    if (!src || src === targetId) return;
    const arr = [...pinnedPens];
    const from = arr.findIndex((p) => p.id === src);
    const to = arr.findIndex((p) => p.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    updateSettings({ pinnedPens: arr });
  };
  const onDragEnd = () => { dragId.current = null; setDragOver(null); };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed left-1/2 bottom-3 z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)] rounded-xl glass-strong shadow-float backdrop-blur-xl"
      role="toolbar"
      aria-label="Editor tools"
    >
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-1.5">
        <button className={btn(tool === "select")} onClick={() => onToolChange("select")} title="Select (V)" aria-label="Select">
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button className={btn(tool === "text")} onClick={() => onToolChange("text")} title="Text (T)" aria-label="Text">
          <Type className="h-4 w-4" />
        </button>

        {/* Pen with long-press popover */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(isPen)}
            onPointerDown={() => startLongPress(() => { onToolChange("pen"); setPenOpen(true); })}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={() => {
              if (lpFired.current) { lpFired.current = false; return; }
              onToolChange("pen");
              if (isPen) setPenOpen((v) => !v);
            }}
            title={`Pen · ${penStyle} (long-press for options)`}
            aria-label={`Pen — ${penStyle}`}
          >
            <PenIcon className="h-4 w-4 transition-all duration-200" />
          </button>
          <button
            className="grid h-8 w-3 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => { onToolChange("pen"); setPenOpen((v) => !v); }}
            aria-label="Pen library"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {penOpen && (
            <div className={`${popover} w-72 rounded-xl bg-card text-card-foreground border border-border p-2 shadow-float`}>
              {PEN_LIBRARY.map((p) => {
                const Ico = PEN_ICON[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { onPenStyleChange(p.id); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      penStyle === p.id ? "bg-primary/15 text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <Ico className="h-4 w-4 shrink-0" style={{ color }} />
                    <PenPreview style={p.id} color={color} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
              <div className="mt-2 border-t border-border pt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Thickness</span>
                  <span className="font-mono">{size.toFixed(1)}px</span>
                </div>
                <input
                  type="range" min={0.5} max={30} step={0.5} value={size}
                  onChange={(e) => onSizeChange(Number(e.target.value))}
                  className="h-1.5 w-full accent-primary"
                />
                <button
                  onClick={pinCurrent}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-accent/40 px-2 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Pin className="h-3.5 w-3.5" /> Pin this pen
                </button>
              </div>
            </div>
          )}
        </div>

        <button className={btn(tool === "highlighter")} onClick={() => onToolChange("highlighter")} title="Highlighter (H)" aria-label="Highlighter">
          <Highlighter className="h-4 w-4" />
        </button>

        {/* Eraser with long-press popover */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(tool === "eraser")}
            onPointerDown={() => startLongPress(() => { onToolChange("eraser"); setEraserOpen(true); })}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={() => {
              if (lpFired.current) { lpFired.current = false; return; }
              onToolChange("eraser");
              if (tool === "eraser") setEraserOpen((v) => !v);
            }}
            title={`Eraser · ${eraserMode} (long-press for options)`}
            aria-label={`Eraser — ${eraserMode}`}
          >
            <EraserIcon className="h-4 w-4 transition-all duration-200" />
          </button>
          <button
            className="grid h-8 w-3 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => { onToolChange("eraser"); setEraserOpen((v) => !v); }}
            aria-label="Eraser mode"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {eraserOpen && (
            <div className={`${popover} w-64 rounded-xl bg-card text-card-foreground border border-border p-2 shadow-float`}>
              {(["stroke", "spot"] as EraserMode[]).map((m) => {
                const Ico = m === "spot" ? CircleDashed : Eraser;
                return (
                  <button
                    key={m}
                    onClick={() => { onEraserModeChange(m); setEraserOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      eraserMode === m ? "bg-primary/15 text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <Ico className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-[13px] font-medium capitalize">{m} eraser</div>
                      <div className="text-[11px] text-muted-foreground">
                        {m === "stroke" ? "Remove entire strokes on touch" : "Erase only the touched portion"}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="mt-2 border-t border-border pt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Eraser size</span>
                  <span className="font-mono">{size.toFixed(1)}px</span>
                </div>
                <input
                  type="range" min={2} max={40} step={0.5} value={size}
                  onChange={(e) => onSizeChange(Number(e.target.value))}
                  className="h-1.5 w-full accent-primary"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-border" />

        {/* Pinned pens strip (drag to reorder) */}
        {pinnedPens.length > 0 && (
          <div className="flex items-center gap-1">
            {pinnedPens.map((p) => {
              const active =
                isPen && p.style === penStyle &&
                p.color.toLowerCase() === color.toLowerCase() && p.size === size;
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={onDragStart(p.id)}
                  onDragOver={onDragOver(p.id)}
                  onDrop={onDrop(p.id)}
                  onDragEnd={onDragEnd}
                  className={`group relative flex shrink-0 items-center ${
                    dragOver === p.id ? "ring-2 ring-primary/40 rounded-md" : ""
                  }`}
                  title={`${p.style} · ${p.color} · ${p.size}px (drag to reorder)`}
                >
                  <button
                    onClick={() => applyPinned(p)}
                    className={`grid h-8 w-8 place-items-center rounded-md transition ${
                      active ? "bg-primary/15" : "hover:bg-accent"
                    }`}
                    aria-label={`Pinned ${p.style}`}
                  >
                    <PinnedGlyph pen={p} />
                  </button>
                  <button
                    onClick={() => removePinned(p.id)}
                    className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 place-items-center rounded-full bg-foreground/70 text-background group-hover:grid"
                    aria-label="Remove pinned pen"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <GripVertical className="pointer-events-none absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground/0 group-hover:text-muted-foreground/60" />
                </div>
              );
            })}
            <button
              onClick={pinCurrent}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Pin current pen"
              aria-label="Pin current pen"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mx-1 h-5 w-px shrink-0 bg-border" />

        {/* Spectrum color picker */}
        <div className="relative flex shrink-0 items-center">
          <button
            onClick={() => setColorOpen((v) => !v)}
            className="h-6 w-6 rounded-full ring-2 ring-border transition hover:scale-110"
            style={{
              background:
                "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #a855f7, #ec4899, #ef4444)",
            }}
            aria-label="Color picker"
            title={`Color ${activeColor}`}
          />
          {colorOpen && (
            <div className={popover}>
              <SpectrumPicker
                value={activeColor}
                onChange={setActiveColor}
                onClose={() => setColorOpen(false)}
                swatches={swatches}
              />
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button className={btn(false)} onClick={onUndo} title="Undo (⌘Z)" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className={btn(false)} onClick={onRedo} title="Redo (⌘⇧Z)" aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </button>

        <button
          className={btn(false)}
          onClick={() => { if (confirm("Clear all ink strokes?")) onClear(); }}
          title="Clear ink"
          aria-label="Clear ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PinnedGlyph({ pen }: { pen: PinnedPen }) {
  const Ico = PEN_ICON[pen.style];
  return (
    <div className="relative grid h-full w-full place-items-center">
      <Ico className="h-4 w-4" style={{ color: pen.color }} />
      <span
        className="absolute -bottom-0.5 h-1 rounded-full"
        style={{
          background: pen.color,
          width: Math.min(16, Math.max(4, pen.size * 1.5)),
        }}
      />
    </div>
  );
}

function PenPreview({ style, color }: { style: PenStyle; color: string }) {
  const path =
    style === "fountain"
      ? "M2 14 C 6 4, 14 20, 22 6"
      : style === "marker"
      ? "M2 10 L22 10"
      : style === "pencil"
      ? "M2 12 L22 10"
      : "M2 12 L22 12";
  const width = style === "marker" ? 6 : style === "fountain" ? 2.5 : style === "pencil" ? 1.4 : 2;
  const opacity = style === "marker" ? 0.9 : style === "pencil" ? 0.7 : 1;
  return (
    <svg width="24" height="14" viewBox="0 0 24 16" className="shrink-0">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
        strokeDasharray={style === "pencil" ? "1 1.2" : undefined}
      />
    </svg>
  );
}

function SpectrumPicker({
  value, onChange, onClose, swatches,
}: { value: string; onChange: (c: string) => void; onClose: () => void; swatches: string[] }) {
  const [h, s, l] = hexToHsl(value);
  const [hue, setHue] = useState(h);
  const [sat, setSat] = useState(s);
  const [lig, setLig] = useState(l);
  useEffect(() => {
    const [nh, ns, nl] = hexToHsl(value);
    setHue(nh); setSat(ns); setLig(nl);
  }, [value]);

  const commit = (nh: number, ns: number, nl: number) => {
    setHue(nh); setSat(ns); setLig(nl);
    onChange(hslToHex(nh, ns, nl));
  };

  return (
    <div className="w-64 rounded-xl bg-card text-card-foreground border border-border p-3 shadow-float">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg border border-border" style={{ background: value }} />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
          }}
          className="flex-1 rounded-lg border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Hex color"
        />
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Done</button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {swatches.map((sw) => (
          <button
            key={sw}
            onClick={() => onChange(sw)}
            className="h-5 w-5 rounded-md ring-1 ring-border hover:scale-110 transition"
            style={{ background: sw }}
            aria-label={`Color ${sw}`}
          />
        ))}
      </div>
      <label className="mb-1 block text-[10px] text-muted-foreground">Hue</label>
      <input
        type="range" min={0} max={360} value={hue}
        onChange={(e) => commit(Number(e.target.value), sat, lig)}
        className="h-2 w-full appearance-none rounded-full"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      />
      <label className="mb-1 mt-2 block text-[10px] text-muted-foreground">Saturation</label>
      <input
        type="range" min={0} max={100} value={sat}
        onChange={(e) => commit(hue, Number(e.target.value), lig)}
        className="h-2 w-full appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, hsl(${hue} 0% ${lig}%), hsl(${hue} 100% ${lig}%))` }}
      />
      <label className="mb-1 mt-2 block text-[10px] text-muted-foreground">Lightness</label>
      <input
        type="range" min={0} max={100} value={lig}
        onChange={(e) => commit(hue, sat, Number(e.target.value))}
        className="h-2 w-full appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, #000, hsl(${hue} ${sat}% 50%), #fff)` }}
      />
    </div>
  );
}

function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const c = L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
