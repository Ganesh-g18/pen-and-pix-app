import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const SIZES = [10, 13, 16, 18, 24, 32, 48];
const HIGHLIGHTS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa", "transparent"];
const COLORS = ["#0b0b0f", "#dc2626", "#059669", "#2563eb", "#a855f7", "#eab308", "#ec4899", "#ffffff"];

type MenuKey = null | "font" | "color" | "highlight" | "paragraph";

interface Props {
  editingId: string | null;
  blocks: TextBlock[];
  onBlocksChange: (blocks: TextBlock[]) => void;
}

/**
 * Contextual toolbar rendered just above the annotation panel while the
 * Text tool is active. Popovers render into a portal with fixed positioning
 * so the toolbar's horizontal scroll container never clips them.
 */
export function TextToolPanel({ editingId, blocks, onBlocksChange }: Props) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const recentColors = settings.recentColors ?? [];

  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [fontQuery, setFontQuery] = useState("");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastFontRef = useRef<string>("Inter");

  const openWith = useCallback((menu: Exclude<MenuKey, null>, el: HTMLElement | null) => {
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setOpenMenu((prev) => (prev === menu ? null : menu));
    setFontQuery("");
  }, []);

  // Track editable selection so toolbar clicks retain user's caret/selection.
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

  // Close on outside pointer / Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Reposition popover on scroll/resize while open.
  useLayoutEffect(() => {
    if (!openMenu) return;
    const update = () => {
      const trigger = rootRef.current?.querySelector<HTMLElement>(`[data-menu-trigger="${openMenu}"]`);
      if (trigger) setAnchorRect(trigger.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [openMenu]);

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
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.addRange(r);
      }
    }
    fn();
    if (el && editingId) {
      const html = el.innerHTML;
      onBlocksChange(blocks.map((b) => b.id === editingId ? { ...b, html } : b));
    }
  };

  const cmd = (name: string, value?: string) => withSelection(() => document.execCommand(name, false, value));

  /**
   * Apply an inline CSS style to the current selection. If the selection is
   * collapsed, wrap a zero-width space so subsequent typing inherits the style.
   * This is more reliable than execCommand("fontName"/"fontSize"), which is
   * inconsistent across browsers and interacts badly with styleWithCSS.
   */
  const applyInlineStyle = (style: Partial<CSSStyleDeclaration>) => {
    withSelection(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      Object.assign(span.style, style);
      if (range.collapsed) {
        span.appendChild(document.createTextNode("\u200B"));
        range.insertNode(span);
        const r = document.createRange();
        r.setStart(span.firstChild!, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        try {
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
          const r = document.createRange();
          r.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(r);
        } catch {
          /* selection crossed non-editable boundary */
        }
      }
    });
  };

  const applyFont = (f: string) => {
    lastFontRef.current = f;
    applyInlineStyle({ fontFamily: f });
    setOpenMenu(null);
  };

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

  const applySize = (px: number) => {
    const next = Math.max(8, Math.min(96, Math.round(px)));
    applyInlineStyle({ fontSize: `${next}px` });
  };

  const adjustSize = (delta: number) => {
    const sel = window.getSelection();
    const r = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const node = r?.startContainer;
    const el = (node?.nodeType === 1 ? node : node?.parentElement) as HTMLElement | null;
    const px = parseFloat(getComputedStyle(el ?? document.body).fontSize) || 16;
    applySize(px + delta);
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

  const Btn = ({ onClick, title, children, active, dataMenu }: {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; title: string;
    children: React.ReactNode; active?: boolean; dataMenu?: string;
  }) => (
    <button
      type="button"
      title={title}
      data-menu-trigger={dataMenu}
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

  /** Position a popover just above the trigger, keeping it inside the viewport. */
  const popoverStyle = (width: number): React.CSSProperties => {
    if (!anchorRect) return { display: "none" };
    const gap = 8;
    const vw = window.innerWidth;
    let left = anchorRect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    return {
      position: "fixed",
      left,
      top: anchorRect.top - gap,
      transform: "translateY(-100%)",
      zIndex: 60,
    };
  };

  const renderPopover = () => {
    if (!openMenu || !anchorRect) return null;
    let content: React.ReactNode = null;
    let width = 224;
    if (openMenu === "font") {
      width = 224;
      const filtered = FONTS.filter((f) => f.toLowerCase().includes(fontQuery.trim().toLowerCase()));
      content = (
        <div className="w-56 rounded-lg border border-border bg-card text-card-foreground shadow-float p-1">
          <input
            autoFocus
            value={fontQuery}
            onChange={(e) => setFontQuery(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search fonts…"
            className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((f) => (
              <button
                key={f}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFont(f)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                  lastFontRef.current === f ? "bg-accent/60" : ""
                }`}
                style={{ fontFamily: f }}
              >{f}</button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</div>
            )}
          </div>
        </div>
      );
    } else if (openMenu === "color") {
      width = 224;
      content = (
        <div className="w-56 rounded-lg border border-border bg-card shadow-float p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preset</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
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
                  <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { cmd("foreColor", c); setOpenMenu(null); }}
                    className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />
                ))}
              </div>
            </>
          )}
        </div>
      );
    } else if (openMenu === "highlight") {
      width = 220;
      content = (
        <div className="rounded-lg border border-border bg-card shadow-float p-2 flex items-center gap-1.5">
          {HIGHLIGHTS.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { cmd("hiliteColor", c); setOpenMenu(null); }}
              title={c === "transparent" ? "Clear" : c}
              className="h-5 w-5 rounded-full border border-border"
              style={{ background: c === "transparent" ? "transparent" : c }} />
          ))}
          <input type="color" onChange={(e) => cmd("hiliteColor", e.target.value)}
            className="h-6 w-8 cursor-pointer rounded" />
        </div>
      );
    } else if (openMenu === "paragraph" && editingBlock) {
      width = 224;
      const el = getEditableEl(editingBlock.id);
      content = (
        <div className="w-56 rounded-lg border border-border bg-card shadow-float p-3 space-y-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Line height</span>
              <span>{(parseFloat(el?.style.lineHeight || "1.5") || 1.5).toFixed(2)}</span>
            </label>
            <input type="range" min="1" max="3" step="0.05" defaultValue={el?.style.lineHeight || "1.5"}
              onChange={(e) => applyBlockStyle({ lineHeight: e.target.value })}
              className="w-full" />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Letter spacing</span>
            </label>
            <input type="range" min="-2" max="10" step="0.1"
              defaultValue={parseFloat(el?.style.letterSpacing || "0") || 0}
              onChange={(e) => applyBlockStyle({ letterSpacing: `${e.target.value}px` })}
              className="w-full" />
          </div>
        </div>
      );
    }
    if (!content) return null;
    return createPortal(
      <div
        ref={popoverRef}
        style={popoverStyle(width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {content}
      </div>,
      document.body,
    );
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed left-1/2 bottom-[3.75rem] z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)] rounded-xl glass-strong shadow-float backdrop-blur-xl"
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar px-2 py-1.5">
        {/* Font family */}
        <button
          type="button"
          data-menu-trigger="font"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openWith("font", e.currentTarget)}
          className="inline-flex items-center h-8 rounded-md bg-transparent px-2 text-xs outline-none hover:bg-accent max-w-[8rem] truncate text-left text-muted-foreground hover:text-foreground"
          title="Font family"
        >
          <Type className="mr-1 h-3.5 w-3.5" />
          Font
        </button>

        {/* Font size */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => applySize(parseInt(e.target.value, 10))}
          defaultValue="16"
          className="h-8 rounded-md bg-transparent px-1 text-xs outline-none hover:bg-accent"
          title="Font size"
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Btn title="Decrease size" onClick={() => adjustSize(-2)}><Minus className="h-3.5 w-3.5" /></Btn>
        <Btn title="Increase size" onClick={() => adjustSize(+2)}><Plus className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Bold (⌘B)" onClick={() => cmd("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn title="Italic (⌘I)" onClick={() => cmd("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn title="Underline (⌘U)" onClick={() => cmd("underline")}><Underline className="h-3.5 w-3.5" /></Btn>
        <Btn title="Strikethrough" onClick={() => cmd("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn dataMenu="color" title="Text color" onClick={(e) => openWith("color", e.currentTarget)}>
          <Palette className="h-3.5 w-3.5" />
        </Btn>
        <Btn dataMenu="highlight" title="Highlight" onClick={(e) => openWith("highlight", e.currentTarget)}>
          <Highlighter className="h-3.5 w-3.5" />
        </Btn>

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

        <button
          type="button"
          data-menu-trigger="paragraph"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openWith("paragraph", e.currentTarget)}
          className="rounded-md px-2 h-8 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Paragraph"
        >¶</button>

        <Divider />

        <Btn title="Duplicate box" onClick={duplicate}><Copy className="h-3.5 w-3.5" /></Btn>
        <Btn title="Bring forward" onClick={bringForward}><ChevronsUp className="h-3.5 w-3.5" /></Btn>
        <Btn title="Send backward" onClick={sendBackward}><ChevronsDown className="h-3.5 w-3.5" /></Btn>
        <Btn title="Delete box" onClick={remove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Btn>
      </div>
      {renderPopover()}
    </div>
  );
}
