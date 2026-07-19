import {
  Pen,
  PenTool,
  Pencil,
  Paintbrush,
  Brush,
  Highlighter,
  Eraser,
  Type,
  MousePointer2,
  Undo2,
  Redo2,
  Trash2,
  ChevronDown,
  CircleDashed,
  Pin,
  X,
  GripVertical,
  Plus,
  Pipette,
  Bookmark,
  BookmarkPlus,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PenStyle, PinnedPen, ToolPreset } from "@/lib/store";
import { useStore } from "@/lib/store";

export type EditorTool = "select" | "text" | "pen" | "highlighter" | "eraser";
export type EraserMode = "stroke" | "spot";
export type ToolConfigKey = PenStyle | "highlighter";

const HIGHLIGHT_SWATCHES = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa"];
const PEN_SWATCHES = ["#0b0b0f", "#2563eb", "#dc2626", "#059669", "#eab308", "#a855f7", "#ec4899", "#f97316"];

const PEN_LIBRARY: { id: PenStyle; label: string; desc: string }[] = [
  { id: "ballpoint", label: "Ballpoint", desc: "Crisp, consistent line" },
  { id: "fountain", label: "Fountain", desc: "Pressure-varied elegance" },
  { id: "marker", label: "Marker", desc: "Thick, opaque strokes" },
  { id: "pencil", label: "Pencil", desc: "Soft, sketchy texture" },
  { id: "brush", label: "Brush", desc: "Expressive, pressure brush" },
];

const PEN_ICON: Record<PenStyle, typeof Pen> = {
  ballpoint: Pen,
  fountain: PenTool,
  marker: Paintbrush,
  pencil: Pencil,
  brush: Brush,
};

const LONG_PRESS_MS = 2000;
const EMPTY_PINNED_PENS: PinnedPen[] = [];

interface Props {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  penStyle: PenStyle;
  onPenStyleChange: (p: PenStyle) => void;
  // Active tool's resolved config (owned by parent, backed by toolPresets in the store):
  activeConfig: ToolPreset;
  onConfigPatch: (patch: Partial<ToolPreset>) => void;
  eraserMode: EraserMode;
  onEraserModeChange: (m: EraserMode) => void;
  eraserSize: number;
  onEraserSizeChange: (n: number) => void;
  eraserSoftness: number;
  onEraserSoftnessChange: (n: number) => void;
  onApplyPinned: (p: PinnedPen) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export const EditorToolbar = memo(function EditorToolbar({
  tool,
  onToolChange,
  penStyle,
  onPenStyleChange,
  activeConfig,
  onConfigPatch,
  eraserMode,
  onEraserModeChange,
  eraserSize,
  onEraserSizeChange,
  eraserSoftness,
  onEraserSoftnessChange,
  onApplyPinned,
  onUndo,
  onRedo,
  onClear,
}: Props) {
  const settings = useStore((s) => s.settings);
  const pinnedPens = settings.pinnedPens ?? EMPTY_PINNED_PENS;
  const recentColors = settings.recentColors ?? [];
  const savedColors = settings.savedColors ?? [];
  const updateSettings = useStore((s) => s.updateSettings);

  const [penOpen, setPenOpen] = useState(false);
  const [penListOpen, setPenListOpen] = useState(false);
  const [hiOpen, setHiOpen] = useState(false);
  const [eraserOpen, setEraserOpen] = useState(false);

  const closeAllPopovers = () => {
    setPenOpen(false);
    setHiOpen(false);
    setEraserOpen(false);
    setPenListOpen(false);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        closeAllPopovers();
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
    if (lpTimer.current) {
      window.clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };

  const btn = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  const isPen = tool === "pen";
  const isHi = tool === "highlighter";
  const popover = "fixed left-1/2 -translate-x-1/2 bottom-16 z-50";

  const PenIcon = useMemo(() => PEN_ICON[penStyle] ?? Pen, [penStyle]);
  const EraserIcon = eraserMode === "spot" ? CircleDashed : Eraser;

  const pushRecent = (c: string) => {
    const arr = [c, ...recentColors.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 12);
    updateSettings({ recentColors: arr });
  };
  const toggleSaved = (c: string) => {
    const exists = savedColors.some((x) => x.toLowerCase() === c.toLowerCase());
    updateSettings({
      savedColors: exists
        ? savedColors.filter((x) => x.toLowerCase() !== c.toLowerCase())
        : [...savedColors, c].slice(0, 24),
    });
  };

  const pinCurrent = () => {
    if (!isPen) return;
    const exists = pinnedPens.some(
      (p) =>
        p.style === penStyle &&
        p.color.toLowerCase() === activeConfig.color.toLowerCase() &&
        p.size === activeConfig.size,
    );
    if (exists) return;
    const next: PinnedPen = {
      id: "pp-" + Math.random().toString(36).slice(2, 8),
      style: penStyle,
      color: activeConfig.color,
      size: activeConfig.size,
      opacity: activeConfig.opacity,
      pressure: activeConfig.pressure,
      smoothing: activeConfig.smoothing,
    };
    updateSettings({ pinnedPens: [...pinnedPens, next] });
  };

  const removePinned = (id: string) => updateSettings({ pinnedPens: pinnedPens.filter((p) => p.id !== id) });

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
  const onDragEnd = () => {
    dragId.current = null;
    setDragOver(null);
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed left-1/2 bottom-3 z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)] rounded-xl glass-strong shadow-float backdrop-blur-xl"
      role="toolbar"
      aria-label="Editor tools"
    >
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-1.5">
        <button
          className={btn(tool === "select")}
          onClick={() => { closeAllPopovers(); onToolChange("select"); }}
          title="Select (V)"
          aria-label="Select"
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button
          className={btn(tool === "text")}
          onClick={() => { closeAllPopovers(); onToolChange("text"); }}
          title="Text (T)"
          aria-label="Text"
        >
          <Type className="h-4 w-4" />
        </button>

        {/* Pen: click activates immediately, long-press (2s) or right-click opens settings */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(isPen)}
            onPointerDown={() => {
              if (isPen) startLongPress(() => setPenOpen(true));
            }}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              onToolChange("pen");
              setPenOpen(true);
            }}
            onClick={() => {
              if (lpFired.current) {
                lpFired.current = false;
                return;
              }
              setHiOpen(false); setEraserOpen(false); setPenListOpen(false);
              if (isPen) setPenOpen((v) => !v);
              else { onToolChange("pen"); setPenOpen(false); }
            }}
            title={`Pen · ${penStyle} (long-press or right-click for settings)`}
            aria-label={`Pen — ${penStyle}`}
            style={{ color: isPen ? activeConfig.color : undefined }}
          >
            <PenIcon className="h-4 w-4 transition-all duration-200" />
          </button>
          <button
            className="grid h-8 w-3 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              onToolChange("pen");
              setPenListOpen((v) => !v);
            }}
            aria-label="Pen library"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {penListOpen && (
            <div
              className={`${popover} w-64 rounded-xl bg-card text-card-foreground border border-border p-2 shadow-float`}
            >
              {PEN_LIBRARY.map((p) => {
                const Ico = PEN_ICON[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onPenStyleChange(p.id);
                      setPenListOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      penStyle === p.id ? "bg-primary/15 text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <Ico className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {penOpen && isPen && (
            <div className={popover}>
              <ToolSettingsPopover
                title={PEN_LIBRARY.find((x) => x.id === penStyle)?.label ?? "Pen"}
                config={activeConfig}
                onPatch={onConfigPatch}
                previewKind="pen"
                penStyle={penStyle}
                swatches={PEN_SWATCHES}
                recentColors={recentColors}
                savedColors={savedColors}
                onCommitColor={pushRecent}
                onToggleSaved={toggleSaved}
                minSize={0.5}
                maxSize={30}
                showPin
                onPin={pinCurrent}
              />
            </div>
          )}
        </div>

        {/* Highlighter */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(isHi)}
            onPointerDown={() => {
              if (isHi) startLongPress(() => setHiOpen(true));
            }}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              onToolChange("highlighter");
              setHiOpen(true);
            }}
            onClick={() => {
              if (lpFired.current) {
                lpFired.current = false;
                return;
              }
              if (isHi) setHiOpen((v) => !v);
              else onToolChange("highlighter");
            }}
            title="Highlighter (long-press for settings)"
            aria-label="Highlighter"
            style={{ color: isHi ? activeConfig.color : undefined }}
          >
            <Highlighter className="h-4 w-4" />
          </button>
          {hiOpen && isHi && (
            <div className={popover}>
              <ToolSettingsPopover
                title="Highlighter"
                config={activeConfig}
                onPatch={onConfigPatch}
                previewKind="highlighter"
                swatches={HIGHLIGHT_SWATCHES}
                recentColors={recentColors}
                savedColors={savedColors}
                onCommitColor={pushRecent}
                onToggleSaved={toggleSaved}
                minSize={4}
                maxSize={40}
              />
            </div>
          )}
        </div>

        {/* Eraser */}
        <div className="relative flex shrink-0 items-center">
          <button
            className={btn(tool === "eraser")}
            onPointerDown={() => {
              if (tool === "eraser") startLongPress(() => setEraserOpen(true));
            }}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              onToolChange("eraser");
              setEraserOpen(true);
            }}
            onClick={() => {
              if (lpFired.current) {
                lpFired.current = false;
                return;
              }
              if (tool === "eraser") setEraserOpen((v) => !v);
              else onToolChange("eraser");
            }}
            title={`Eraser · ${eraserMode} (long-press for settings)`}
            aria-label={`Eraser — ${eraserMode}`}
          >
            <EraserIcon className="h-4 w-4 transition-all duration-200" />
          </button>
          {eraserOpen && (
            <div
              className={`${popover} w-64 rounded-xl bg-card text-card-foreground border border-border p-2 shadow-float`}
            >
              <div className="grid grid-cols-2 gap-1">
                {(["stroke", "spot"] as EraserMode[]).map((m) => {
                  const Ico = m === "spot" ? CircleDashed : Eraser;
                  return (
                    <button
                      key={m}
                      onClick={() => onEraserModeChange(m)}
                      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs transition ${
                        eraserMode === m ? "bg-primary/15 text-primary" : "hover:bg-accent"
                      }`}
                    >
                      <Ico className="h-4 w-4" />
                      <span className="capitalize">{m}</span>
                    </button>
                  );
                })}
              </div>
              <Slider
                label="Size"
                value={eraserSize}
                min={4}
                max={80}
                step={1}
                onChange={onEraserSizeChange}
                unit="px"
              />
              {eraserMode === "spot" && (
                <Slider
                  label="Softness"
                  value={eraserSoftness}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={onEraserSoftnessChange}
                />
              )}
              <div className="mt-2 flex items-center justify-center py-1">
                {eraserMode === "spot" ? (
                  <span
                    className="rounded-full border border-dashed border-foreground/50 bg-foreground/5"
                    style={{ width: eraserSize, height: eraserSize }}
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Removes entire strokes on contact</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-border" />

        {/* Pinned pens strip */}
        {pinnedPens.length > 0 && (
          <div className="flex items-center gap-1">
            {pinnedPens.map((p) => {
              const active =
                isPen &&
                p.style === penStyle &&
                p.color.toLowerCase() === activeConfig.color.toLowerCase() &&
                p.size === activeConfig.size;
              return (
                <PinnedPenItem
                  key={p.id}
                  pen={p}
                  active={active}
                  dragOver={dragOver === p.id}
                  onDragStart={onDragStart(p.id)}
                  onDragOver={onDragOver(p.id)}
                  onDrop={onDrop(p.id)}
                  onDragEnd={onDragEnd}
                  onApply={() => onApplyPinned(p)}
                  onRemove={() => removePinned(p.id)}
                />
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

        <button className={btn(false)} onClick={onUndo} title="Undo (⌘Z)" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className={btn(false)} onClick={onRedo} title="Redo (⌘⇧Z)" aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          className={btn(false)}
          onClick={() => {
            if (confirm("Clear all ink strokes?")) onClear();
          }}
          title="Clear ink"
          aria-label="Clear ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

/* ------- Popover ------- */

interface ToolPopoverProps {
  title: string;
  config: ToolPreset;
  onPatch: (p: Partial<ToolPreset>) => void;
  previewKind: "pen" | "highlighter";
  penStyle?: PenStyle;
  swatches: string[];
  recentColors: string[];
  savedColors: string[];
  onCommitColor: (c: string) => void;
  onToggleSaved: (c: string) => void;
  minSize: number;
  maxSize: number;
  showPin?: boolean;
  onPin?: () => void;
}

const ToolSettingsPopover = memo(function ToolSettingsPopover({
  title,
  config,
  onPatch,
  previewKind,
  penStyle,
  swatches,
  recentColors,
  savedColors,
  onCommitColor,
  onToggleSaved,
  minSize,
  maxSize,
  showPin,
  onPin,
}: ToolPopoverProps) {
  const [hex, setHex] = useState(config.color);
  useEffect(() => setHex(config.color), [config.color]);
  const rgb = hexToRgb(config.color);
  const hasEyedropper = typeof window !== "undefined" && "EyeDropper" in window;
  const isSaved = savedColors.some((c) => c.toLowerCase() === config.color.toLowerCase());

  const setColor = (c: string) => {
    onPatch({ color: c });
    onCommitColor(c);
  };

  const openEyedropper = async () => {
    try {
      const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } })
        .EyeDropper;
      const res = await new ED().open();
      if (res?.sRGBHex) setColor(res.sRGBHex);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="w-72 rounded-xl bg-card text-card-foreground border border-border p-3 shadow-float">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-medium">{title}</div>
        <button
          onClick={() => onToggleSaved(config.color)}
          className="text-muted-foreground hover:text-foreground"
          title={isSaved ? "Remove from saved" : "Save color"}
        >
          {isSaved ? <Bookmark className="h-3.5 w-3.5 fill-current" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Preview */}
      <div className="mb-2 flex h-10 items-center justify-center rounded-lg border border-border bg-muted/40 px-3">
        <StrokePreview
          kind={previewKind}
          penStyle={penStyle}
          color={config.color}
          size={config.size}
          opacity={config.opacity}
        />
      </div>

      {/* Color: hex + swatches + eyedropper */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-7 w-7 shrink-0 rounded-lg border border-border" style={{ background: config.color }} />
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            setHex(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onPatch({ color: v });
          }}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) onCommitColor(hex);
          }}
          className="w-24 rounded-md border border-border bg-transparent px-1.5 py-1 text-[11px] font-mono outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Hex color"
        />
        {hasEyedropper && (
          <button
            onClick={openEyedropper}
            className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-accent"
            title="Eyedropper"
            aria-label="Eyedropper"
          >
            <Pipette className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* RGB */}
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {(["r", "g", "b"] as const).map((k, i) => (
          <label key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="uppercase">{k}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[i]}
              onChange={(e) => {
                const nv = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                const next: [number, number, number] = [...rgb];
                next[i] = nv;
                setColor(rgbToHex(next[0], next[1], next[2]));
              }}
              className="w-full rounded-md border border-border bg-transparent px-1 py-0.5 text-[11px] outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        ))}
      </div>

      {/* Swatches */}
      <div className="mb-1 text-[10px] text-muted-foreground">Presets</div>
      <div className="mb-2 flex flex-wrap gap-1">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="h-5 w-5 rounded-md ring-1 ring-border hover:scale-110 transition"
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>

      {recentColors.length > 0 && (
        <>
          <div className="mb-1 text-[10px] text-muted-foreground">Recent</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {recentColors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-5 w-5 rounded-md ring-1 ring-border hover:scale-110 transition"
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </>
      )}

      {savedColors.length > 0 && (
        <>
          <div className="mb-1 text-[10px] text-muted-foreground">Saved</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {savedColors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-5 w-5 rounded-md ring-1 ring-border hover:scale-110 transition"
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </>
      )}

      {/* Hue slider (quick spectrum) */}
      <HueRow color={config.color} onChange={setColor} />

      <Slider
        label="Thickness"
        value={config.size}
        min={minSize}
        max={maxSize}
        step={0.5}
        onChange={(n) => onPatch({ size: n })}
        unit="px"
      />
      <Slider
        label="Opacity"
        value={config.opacity}
        min={0.05}
        max={1}
        step={0.05}
        onChange={(n) => onPatch({ opacity: n })}
      />

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Toggle label="Pressure" value={config.pressure} onChange={(v) => onPatch({ pressure: v })} />
        <Toggle label="Smoothing" value={config.smoothing} onChange={(v) => onPatch({ smoothing: v })} />
      </div>

      {showPin && (
        <button
          onClick={onPin}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-accent/40 px-2 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Pin className="h-3.5 w-3.5" /> Pin this pen
        </button>
      )}
    </div>
  );
});

/* ------- helpers ------- */

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  unit?: string;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {value.toFixed(step < 1 ? 2 : 1)}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full accent-primary"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-[11px] transition ${
        value ? "bg-primary/15 text-primary" : "hover:bg-accent text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-block h-3 w-6 rounded-full transition ${value ? "bg-primary" : "bg-muted-foreground/40"}`}
        style={{ position: "relative" }}
      >
        <span
          className="absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all"
          style={{ left: value ? 14 : 2 }}
        />
      </span>
    </button>
  );
}

function HueRow({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [h, s, l] = hexToHsl(color);
  const [hue, setHue] = useState(h);
  useEffect(() => setHue(hexToHsl(color)[0]), [color]);
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Hue</span>
        <span className="font-mono">{hue}°</span>
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => {
          const nh = Number(e.target.value);
          setHue(nh);
          onChange(hslToHex(nh, Math.max(40, s), l < 20 || l > 80 ? 50 : l));
        }}
        className="h-2 w-full appearance-none rounded-full"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      />
    </div>
  );
}

function StrokePreview({
  kind,
  penStyle,
  color,
  size,
  opacity,
}: {
  kind: "pen" | "highlighter";
  penStyle?: PenStyle;
  color: string;
  size: number;
  opacity: number;
}) {
  if (kind === "highlighter") {
    return (
      <span
        className="block h-4 w-full rounded-sm"
        style={{ background: color, opacity, height: Math.max(4, Math.min(20, size)) }}
      />
    );
  }
  const dash = penStyle === "pencil" ? `${Math.max(0.5, size * 0.6)} ${Math.max(0.6, size * 0.8)}` : undefined;
  return (
    <svg width="100%" height="24" viewBox="0 0 200 24" preserveAspectRatio="none">
      <path
        d="M4 12 C 40 4, 80 22, 120 10 S 180 14, 196 12"
        fill="none"
        stroke={color}
        strokeWidth={Math.max(0.5, size)}
        opacity={opacity}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

const PinnedGlyph = memo(function PinnedGlyph({ pen }: { pen: PinnedPen }) {
  const Ico = PEN_ICON[pen.style] ?? Pen;
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
      <span
        className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background"
        style={{ background: pen.color }}
      />
    </div>
  );
});

function PinnedPenItem({
  pen,
  active,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onApply,
  onRemove,
}: {
  pen: PinnedPen;
  active: boolean;
  dragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longFiredRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLongPress = () => {
    longFiredRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longFiredRef.current = true;
      setConfirming(true);
    }, 300);
  };

  useEffect(() => {
    if (!confirming) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(`[data-pinned-id="${pen.id}"]`)) setConfirming(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [confirming, pen.id]);

  useEffect(() => () => clearTimer(), []);

  return (
    <div
      data-pinned-id={pen.id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex shrink-0 items-center ${dragOver ? "ring-2 ring-primary/40 rounded-md" : ""}`}
      title={pen.name ?? `${pen.style} · ${pen.color} · ${pen.size}px  (long-press or right-click to delete)`}
    >
      <button
        onClick={() => {
          if (longFiredRef.current) {
            longFiredRef.current = false;
            return;
          }
          onApply();
        }}
        onPointerDown={startLongPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => {
          e.preventDefault();
          clearTimer();
          setConfirming(true);
        }}
        className={`grid h-8 w-8 place-items-center rounded-md transition ring-2 ${
          active ? "bg-primary/15" : "hover:bg-accent"
        }`}
        style={{ borderColor: "transparent", boxShadow: `inset 0 0 0 2px ${pen.color}55` }}
        aria-label={`Pinned ${pen.style}`}
      >
        <PinnedGlyph pen={pen} />
      </button>
      <GripVertical className="pointer-events-none absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground/0 group-hover:text-muted-foreground/60" />
      {confirming && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 rounded-md border border-border bg-card text-card-foreground shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setConfirming(false);
              onRemove();
            }}
            className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 rounded-md"
          >
            <X className="h-3 w-3" /> Delete pin
          </button>
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, n | 0))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255,
    g = g0 / 255,
    b = b0 / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100,
    L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const c = L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
