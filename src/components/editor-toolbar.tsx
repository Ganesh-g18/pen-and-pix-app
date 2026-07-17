import { Pen, Highlighter, Eraser, Type, MousePointer2, Undo2, Trash2, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PenStyle } from "@/lib/store";

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
  onClear: () => void;
}

export function EditorToolbar({
  tool, onToolChange, penStyle, onPenStyleChange,
  color, onColorChange, highlighterColor, onHighlighterColorChange,
  size, onSizeChange, eraserMode, onEraserModeChange, onUndo, onClear,
}: Props) {
  const [penOpen, setPenOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [eraserOpen, setEraserOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPenOpen(false); setColorOpen(false); setEraserOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const btn = (active: boolean) =>
    `grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  const isPen = tool === "pen";
  const activeColor = tool === "highlighter" ? highlighterColor : color;
  const setActiveColor = tool === "highlighter" ? onHighlighterColorChange : onColorChange;
  const swatches = tool === "highlighter" ? HIGHLIGHT_COLORS : COLORS;

  const popover = "fixed left-1/2 -translate-x-1/2 bottom-16 z-50";

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

        {/* Pen with library popover */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(isPen)}
            onClick={() => { onToolChange("pen"); if (isPen) setPenOpen((v) => !v); }}
            title={`Pen · ${penStyle} (P)`}
            aria-label="Pen"
          >
            <Pen className="h-4 w-4" />
          </button>
          <button
            className="grid h-9 w-3 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => { onToolChange("pen"); setPenOpen((v) => !v); }}
            aria-label="Pen library"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {penOpen && (
            <div className={`${popover} w-60 rounded-xl glass-strong border border-border/60 p-2 shadow-float`}>
              {PEN_LIBRARY.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onPenStyleChange(p.id); setPenOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    penStyle === p.id ? "bg-primary/15 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <PenPreview style={p.id} color={color} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className={btn(tool === "highlighter")} onClick={() => onToolChange("highlighter")} title="Highlighter (H)" aria-label="Highlighter">
          <Highlighter className="h-4 w-4" />
        </button>

        {/* Eraser with mode popover */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(tool === "eraser")}
            onClick={() => { onToolChange("eraser"); if (tool === "eraser") setEraserOpen((v) => !v); }}
            title={`Eraser · ${eraserMode} (E)`}
            aria-label="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            className="grid h-9 w-3 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => { onToolChange("eraser"); setEraserOpen((v) => !v); }}
            aria-label="Eraser mode"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {eraserOpen && (
            <div className={`${popover} w-52 rounded-xl glass-strong border border-border/60 p-2 shadow-float`}>
              {(["stroke", "spot"] as EraserMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { onEraserModeChange(m); setEraserOpen(false); }}
                  className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    eraserMode === m ? "bg-primary/15 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <span className="font-medium capitalize">{m} eraser</span>
                  <span className="text-xs text-muted-foreground">
                    {m === "stroke" ? "Remove entire strokes on touch" : "Erase only the touched portion"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1.5 h-5 w-px shrink-0 bg-border" />

        <input
          type="range"
          min={0.5}
          max={30}
          step={0.5}
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="h-1.5 w-20 shrink-0 accent-primary"
          aria-label="Brush size"
          title={`Size ${size}px`}
        />
        <div className="mx-1 grid h-6 w-6 shrink-0 place-items-center">
          <span
            className="rounded-full"
            style={{ background: activeColor, width: Math.min(size + 2, 16), height: Math.min(size + 2, 16) }}
          />
        </div>

        <div className="mx-1.5 h-5 w-px shrink-0 bg-border" />

        {/* Spectrum color picker only */}
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
              />
            </div>
          )}
        </div>

        <div className="mx-1.5 h-5 w-px shrink-0 bg-border" />

        <button className={btn(false)} onClick={onUndo} title="Undo (⌘Z)" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
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
    <svg width="28" height="16" viewBox="0 0 24 16" className="shrink-0">
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
  value, onChange, onClose,
}: { value: string; onChange: (c: string) => void; onClose: () => void }) {
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
    <div className="w-64 rounded-xl glass-strong border border-border/60 p-3 shadow-float">
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
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
