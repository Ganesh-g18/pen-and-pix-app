import { useEffect, useRef, useState } from "react";
import type { TextBlock } from "@/lib/store";
import { useStore } from "@/lib/store";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette, Highlighter, Type, Minus, Plus, Copy, Trash2, ChevronsUp, ChevronsDown,
  IndentIncrease, IndentDecrease,
} from "lucide-react";

const FONTS = [
  "Inter", "Instrument Serif", "Georgia", "Times New Roman",
  "Helvetica", "Arial", "Courier New", "Menlo", "JetBrains Mono",
];
const SIZES = [
  { label: "10", val: "1" }, { label: "13", val: "2" }, { label: "16", val: "3" },
  { label: "18", val: "4" }, { label: "24", val: "5" }, { label: "32", val: "6" }, { label: "48", val: "7" },
];
const HIGHLIGHTS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa", "transparent"];
const COLORS = ["#0b0b0f", "#dc2626", "#059669", "#2563eb", "#a855f7", "#eab308", "#ec4899", "#ffffff"];

interface Props {
  editingId: string | null;
  blocks: TextBlock[];
  onBlocksChange: (blocks: TextBlock[]) => void;
}

/**
 * Contextual toolbar rendered just above the annotation panel while the
 * Text tool is active. Applies formatting to the currently editing block
 * via execCommand (retaining current text selection). Actions (duplicate,
 * delete, bring forward/back) operate on the editing block directly.
 */
export function TextToolPanel({ editingId, blocks, onBlocksChange }: Props) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const recentColors = settings.recentColors ?? [];

  const [openMenu, setOpenMenu] = useState<null | "font" | "size" | "color" | "highlight" | "paragraph">(null);
  const [fontQuery, setFontQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Preserve selection whenever the user is about to click a toolbar control.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      const anchor = r.startContainer as Node;
      const el = anchor.nodeType === 1 ? (anchor as HTMLElement) : anchor.parentElement;
      if (el?.closest("[contenteditable='true']")) savedRangeRef.current = r.cloneRange();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const editingBlock = editingId ? blocks.find((b) => b.id === editingId) ?? null : null;

  const getEditableEl = (id: string | null) =>
    id ? document.querySelector<HTMLDivElement>(`[data-text-block="${id}"]`) : null;

  const withSelection = (fn: () => void) => {
    const el = getEditableEl(editingId);
    if (el) {
      el.focus();
      const sel = window.getSelection();
      if (sel && savedRangeRef.current) {
        sel.removeAllRanges();
        try { sel.addRange(savedRangeRef.current); } catch { /* range detached */ }
      } else if (sel && sel.rangeCount === 0) {
        // Fallback: place caret at end of the editable so commands have a target.
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.addRange(r);
      }
    }
    fn();
    // Persist HTML after formatting so it survives blur/remounts.
    if (el && editingId) {
      const html = el.innerHTML;
      onBlocksChange(blocks.map((b) => b.id === editingId ? { ...b, html } : b));
    }
  };

  const cmd = (name: string, value?: string) => withSelection(() => document.execCommand(name, false, value));

  const pushRecent = (c: string) => {
    const next = [c, ...recentColors.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 12);
    updateSettings({ recentColors: next });
  };

  const currentIndex = editingBlock ? blocks.findIndex((b) => b.id === editingBlock.id) : -1;

  const bringForward = () => {
    if (!editingBlock || currentIndex === -1 || currentIndex === blocks.length - 1) return;
    const arr = [...blocks];
    [arr[currentIndex], arr[currentIndex + 1]] = [arr[currentIndex + 1], arr[currentIndex]];
    onBlocksChange(arr);
  };
  const sendBackward = () => {
    if (!editingBlock || currentIndex <= 0) return;
    const arr = [...blocks];
    [arr[currentIndex], arr[currentIndex - 1]] = [arr[currentIndex - 1], arr[currentIndex]];
    onBlocksChange(arr);
  };
  const duplicate = () => {
    if (!editingBlock) return;
    onBlocksChange([
      ...blocks,
      { ...editingBlock, id: Math.random().toString(36).slice(2, 10), x: editingBlock.x + 20, y: editingBlock.y + 20 },
    ]);
  };
  const remove = () => {
    if (!editingBlock) return;
    onBlocksChange(blocks.filter((b) => b.id !== editingBlock.id));
  };

  const adjustSize = (delta: number) => {
    withSelection(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      // Find current font-size on the anchor node’s parent
      const el = (r.startContainer.nodeType === 1
        ? (r.startContainer as HTMLElement)
        : r.startContainer.parentElement) as HTMLElement | null;
      const px = parseFloat(getComputedStyle(el ?? document.body).fontSize) || 16;
      const next = Math.max(8, Math.min(96, Math.round(px + delta)));
      // execCommand fontSize only accepts 1-7; use styleWithCSS + a wrapper span for precision.
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontSize", false, "7");
      // Replace the last font tag with a span using the exact px.
      document.querySelectorAll<HTMLElement>("font[size='7']").forEach((f) => {
        const span = document.createElement("span");
        span.style.fontSize = `${next}px`;
        span.innerHTML = f.innerHTML;
        f.replaceWith(span);
      });
    });
  };

  const applyBlockStyle = (patch: Partial<React.CSSProperties>) => {
    if (!editingBlock) return;
    const el = getEditableEl(editingBlock.id);
    if (!el) return;
    Object.entries(patch).forEach(([k, v]) => { (el.style as unknown as Record<string, string>)[k] = String(v); });
    onBlocksChange(
      blocks.map((b) => b.id === editingBlock.id ? { ...b, html: el.innerHTML } : b),
    );
  };

  const insertChecklist = () => withSelection(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const html = `<ul data-checklist="1" style="list-style:none;padding-left:0;">
      <li><input type="checkbox" style="margin-right:0.5em;">Item</li>
    </ul>`;
    const frag = range.createContextualFragment(html);
    range.deleteContents();
    range.insertNode(frag);
  });

  const Btn = ({ onClick, title, children, active }: {
    onClick: () => void; title: string; children: React.ReactNode; active?: boolean;
  }) => (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="mx-1 h-5 w-px shrink-0 bg-border" />;

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed left-1/2 bottom-[3.75rem] z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)] rounded-xl glass-strong shadow-float backdrop-blur-xl"
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar px-2 py-1.5">
        {/* Font family (compact dropdown w/ search) */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOpenMenu(openMenu === "font" ? null : "font"); setFontQuery(""); }}
            className="inline-flex items-center h-8 rounded-md bg-transparent px-2 text-xs outline-none hover:bg-accent max-w-[8rem] truncate text-left text-muted-foreground hover:text-foreground"
            title="Font family"
          >
            <Type className="mr-1 h-3.5 w-3.5" />
            Font
          </button>
          {openMenu === "font" && (
            <div className="absolute bottom-10 left-0 w-52 rounded-lg border border-border bg-card text-card-foreground shadow-float p-1 z-10">
              <input
                autoFocus
                value={fontQuery}
                onChange={(e) => setFontQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Search fonts…"
                className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="max-h-56 overflow-y-auto">
                {FONTS.filter((f) => f.toLowerCase().includes(fontQuery.trim().toLowerCase())).map((f) => (
                  <button
                    key={f}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { cmd("fontName", f); setOpenMenu(null); }}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    style={{ fontFamily: f }}
                  >{f}</button>
                ))}
                {FONTS.filter((f) => f.toLowerCase().includes(fontQuery.trim().toLowerCase())).length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</div>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Font size (select + +/-) */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => cmd("fontSize", e.target.value)}
          defaultValue="3"
          className="h-8 rounded-md bg-transparent px-1 text-xs outline-none hover:bg-accent"
          title="Font size"
        >
          {SIZES.map((s) => <option key={s.val} value={s.val}>{s.label}</option>)}
        </select>
        <Btn title="Decrease size" onClick={() => adjustSize(-2)}><Minus className="h-3.5 w-3.5" /></Btn>
        <Btn title="Increase size" onClick={() => adjustSize(+2)}><Plus className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Bold (⌘B)" onClick={() => cmd("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn title="Italic (⌘I)" onClick={() => cmd("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn title="Underline (⌘U)" onClick={() => cmd("underline")}><Underline className="h-3.5 w-3.5" /></Btn>
        <Btn title="Strikethrough" onClick={() => cmd("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></Btn>

        <Divider />

        {/* Text color */}
        <div className="relative">
          <Btn title="Text color" onClick={() => setOpenMenu(openMenu === "color" ? null : "color")}>
            <Palette className="h-3.5 w-3.5" />
          </Btn>
          {openMenu === "color" && (
            <div className="absolute bottom-10 left-0 rounded-lg border border-border bg-card shadow-float p-2 z-10 w-56">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preset</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { cmd("foreColor", c); pushRecent(c); setOpenMenu(null); }}
                    className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />
                ))}
                <input type="color" onChange={(e) => { cmd("foreColor", e.target.value); pushRecent(e.target.value); }}
                  className="h-6 w-8 cursor-pointer rounded" />
              </div>
              {recentColors.length > 0 && (
                <>
                  <div className="mt-2 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Recent</div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentColors.map((c) => (
                      <button key={c} onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { cmd("foreColor", c); setOpenMenu(null); }}
                        className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <Btn title="Highlight" onClick={() => setOpenMenu(openMenu === "highlight" ? null : "highlight")}>
            <Highlighter className="h-3.5 w-3.5" />
          </Btn>
          {openMenu === "highlight" && (
            <div className="absolute bottom-10 left-0 rounded-lg border border-border bg-card shadow-float p-2 z-10 flex items-center gap-1.5">
              {HIGHLIGHTS.map((c) => (
                <button key={c} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { cmd("hiliteColor", c); setOpenMenu(null); }}
                  title={c === "transparent" ? "Clear" : c}
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ background: c === "transparent" ? "transparent" : c }} />
              ))}
              <input type="color" onChange={(e) => cmd("hiliteColor", e.target.value)}
                className="h-6 w-8 cursor-pointer rounded" />
            </div>
          )}
        </div>

        <Divider />

        <Btn title="Align left" onClick={() => cmd("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></Btn>
        <Btn title="Align center" onClick={() => cmd("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></Btn>
        <Btn title="Align right" onClick={() => cmd("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></Btn>
        <Btn title="Justify" onClick={() => cmd("justifyFull")}><AlignJustify className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Bullet list (⌘⇧8)" onClick={() => cmd("insertUnorderedList")}><List className="h-3.5 w-3.5" /></Btn>
        <Btn title="Numbered list (⌘⇧7)" onClick={() => cmd("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn title="Checklist" onClick={insertChecklist}><ListChecks className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Outdent" onClick={() => cmd("outdent")}><IndentDecrease className="h-3.5 w-3.5" /></Btn>
        <Btn title="Indent" onClick={() => cmd("indent")}><IndentIncrease className="h-3.5 w-3.5" /></Btn>

        {/* Paragraph settings */}
        <div className="relative">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "paragraph" ? null : "paragraph")}
            className="rounded-md px-2 h-8 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Paragraph"
          >¶</button>
          {openMenu === "paragraph" && editingBlock && (
            <div className="absolute bottom-10 left-0 w-56 rounded-lg border border-border bg-card shadow-float p-3 z-10 space-y-2">
              <div>
                <label className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Line height</span>
                  <span>{(parseFloat(getEditableEl(editingBlock.id)?.style.lineHeight || "1.5") || 1.5).toFixed(2)}</span>
                </label>
                <input type="range" min="1" max="3" step="0.05" defaultValue="1.5"
                  onChange={(e) => applyBlockStyle({ lineHeight: e.target.value })}
                  className="w-full" />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Letter spacing</span>
                </label>
                <input type="range" min="-2" max="10" step="0.1" defaultValue="0"
                  onChange={(e) => applyBlockStyle({ letterSpacing: `${e.target.value}px` })}
                  className="w-full" />
              </div>
            </div>
          )}
        </div>

        <Divider />

        <Btn title="Duplicate box" onClick={duplicate}><Copy className="h-3.5 w-3.5" /></Btn>
        <Btn title="Bring forward" onClick={bringForward}><ChevronsUp className="h-3.5 w-3.5" /></Btn>
        <Btn title="Send backward" onClick={sendBackward}><ChevronsDown className="h-3.5 w-3.5" /></Btn>
        <Btn title="Delete box" onClick={remove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Btn>
      </div>
      {!editingBlock && (
        <div className="pointer-events-none absolute inset-x-0 -top-6 text-center text-[10px] text-muted-foreground">
          Click anywhere on the page to type
        </div>
      )}
    </div>
  );
}
