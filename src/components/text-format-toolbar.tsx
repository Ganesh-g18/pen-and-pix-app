import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Superscript, Subscript,
  Highlighter, Type, Palette, Link as LinkIcon, IndentIncrease, IndentDecrease,
} from "lucide-react";

const FONTS = [
  "Inter", "Instrument Serif", "Georgia", "Times New Roman",
  "Helvetica", "Arial", "Courier New", "Menlo", "JetBrains Mono",
];

/**
 * A lightweight floating rich-text toolbar. Operates on the current
 * document.selection via execCommand — good enough coverage across
 * bold/italic/underline/strike/lists/align/color/highlight/font/etc.
 * Positioned above the current selection rect and follows scroll.
 */
export function TextFormatToolbar({
  containerRef,
  active,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  active: boolean;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);

  useEffect(() => {
    if (!active) { setRect(null); return; }
    const compute = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setRect(null); return; }
      const range = sel.getRangeAt(0);
      // Only show inside our container
      const node = range.commonAncestorContainer as Node;
      const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
      if (!el || !containerRef.current?.contains(el)) { setRect(null); return; }
      const r = range.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) { setRect(null); return; }
      setRect(r);
    };
    const onSel = () => compute();
    const onScroll = () => compute();
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [active, containerRef]);

  const pos = useMemo(() => {
    if (!rect) return null;
    const top = Math.max(8, rect.top - 46);
    const left = Math.min(window.innerWidth - 20, Math.max(10, rect.left + rect.width / 2));
    return { top, left };
  }, [rect]);

  if (!active || !rect || !pos) return null;

  const cmd = (name: string, value?: string) => {
    // Preserve selection: execCommand acts on current selection.
    document.execCommand(name, false, value);
  };

  const Btn = ({ onMouseDown, title, children, activeState }: {
    onMouseDown: (e: React.MouseEvent) => void;
    title: string;
    children: React.ReactNode;
    activeState?: boolean;
  }) => (
    <button
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(e); }}
      className={`grid h-7 w-7 place-items-center rounded-md transition text-foreground/80 hover:bg-accent hover:text-foreground ${activeState ? "bg-accent text-foreground" : ""}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="mx-0.5 h-4 w-px bg-border" />;

  const HIGHLIGHTS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa"];
  const COLORS = ["#0b0b0f", "#dc2626", "#059669", "#2563eb", "#a855f7", "#eab308", "#ec4899", "#ffffff"];

  return createPortal(
    <div
      className="fixed z-[120] -translate-x-1/2 rounded-xl border border-border bg-card text-card-foreground shadow-float animate-in fade-in-0 zoom-in-95"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 p-1">
        {/* Font family */}
        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); setFontOpen((v) => !v); }}
            className="flex items-center gap-1 rounded-md px-2 h-7 text-xs hover:bg-accent"
            title="Font family"
          >
            <Type className="h-3.5 w-3.5" /> Aa
          </button>
          {fontOpen && (
            <div className="absolute top-8 left-0 z-10 w-44 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-float p-1">
              {FONTS.map((f) => (
                <button
                  key={f}
                  onMouseDown={(e) => { e.preventDefault(); cmd("fontName", f); setFontOpen(false); }}
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  style={{ fontFamily: f }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Size */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => cmd("fontSize", e.target.value)}
          defaultValue="3"
          className="h-7 rounded-md bg-transparent px-1 text-xs outline-none hover:bg-accent"
          title="Font size"
        >
          <option value="1">10</option>
          <option value="2">13</option>
          <option value="3">16</option>
          <option value="4">18</option>
          <option value="5">24</option>
          <option value="6">32</option>
          <option value="7">48</option>
        </select>

        <Divider />

        <Btn title="Bold (⌘B)" onMouseDown={() => cmd("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn title="Italic (⌘I)" onMouseDown={() => cmd("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn title="Underline (⌘U)" onMouseDown={() => cmd("underline")}><Underline className="h-3.5 w-3.5" /></Btn>
        <Btn title="Strikethrough" onMouseDown={() => cmd("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></Btn>

        <Divider />

        {/* Color */}
        <div className="relative">
          <Btn title="Text color" onMouseDown={() => { setColorOpen((v) => !v); setHighlightOpen(false); }}>
            <Palette className="h-3.5 w-3.5" />
          </Btn>
          {colorOpen && (
            <div className="absolute top-8 left-0 z-10 rounded-lg border border-border bg-popover shadow-float p-2 flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onMouseDown={(e) => { e.preventDefault(); cmd("foreColor", c); setColorOpen(false); }}
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                onChange={(e) => cmd("foreColor", e.target.value)}
                className="h-6 w-8 cursor-pointer rounded"
              />
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <Btn title="Highlight" onMouseDown={() => { setHighlightOpen((v) => !v); setColorOpen(false); }}>
            <Highlighter className="h-3.5 w-3.5" />
          </Btn>
          {highlightOpen && (
            <div className="absolute top-8 left-0 z-10 rounded-lg border border-border bg-popover shadow-float p-2 flex items-center gap-1.5">
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  onMouseDown={(e) => { e.preventDefault(); cmd("hiliteColor", c); setHighlightOpen(false); }}
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ background: c }}
                />
              ))}
              <button
                onMouseDown={(e) => { e.preventDefault(); cmd("hiliteColor", "transparent"); setHighlightOpen(false); }}
                className="h-5 w-5 rounded-full border border-border bg-background"
                title="Clear"
              />
            </div>
          )}
        </div>

        <Divider />

        <Btn title="Bulleted list" onMouseDown={() => cmd("insertUnorderedList")}><List className="h-3.5 w-3.5" /></Btn>
        <Btn title="Numbered list" onMouseDown={() => cmd("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn title="Checklist" onMouseDown={() => insertChecklist()}><ListChecks className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Align left" onMouseDown={() => cmd("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></Btn>
        <Btn title="Align center" onMouseDown={() => cmd("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></Btn>
        <Btn title="Align right" onMouseDown={() => cmd("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></Btn>
        <Btn title="Justify" onMouseDown={() => cmd("justifyFull")}><AlignJustify className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Indent" onMouseDown={() => cmd("indent")}><IndentIncrease className="h-3.5 w-3.5" /></Btn>
        <Btn title="Outdent" onMouseDown={() => cmd("outdent")}><IndentDecrease className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Superscript" onMouseDown={() => cmd("superscript")}><Superscript className="h-3.5 w-3.5" /></Btn>
        <Btn title="Subscript" onMouseDown={() => cmd("subscript")}><Subscript className="h-3.5 w-3.5" /></Btn>

        <Divider />

        <Btn title="Insert link" onMouseDown={() => {
          const url = prompt("Link URL");
          if (url) cmd("createLink", url);
        }}><LinkIcon className="h-3.5 w-3.5" /></Btn>
      </div>
    </div>,
    document.body,
  );
}

function insertChecklist() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const html = `<ul data-checklist="1" style="list-style:none;padding-left:0;">
    <li><input type="checkbox" style="margin-right:0.5em;">Item</li>
  </ul>`;
  const frag = range.createContextualFragment(html);
  range.deleteContents();
  range.insertNode(frag);
}
