import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { TextBlock } from "@/lib/store";
import { TextFormatToolbar } from "./text-format-toolbar";
import { Copy, Trash2 } from "lucide-react";

interface Props {
  blocks: TextBlock[];
  onChange: (blocks: TextBlock[]) => void;
  /** Active tool from the parent editor. Text tool enables click-to-insert. */
  toolActive: "select" | "text" | "ink";
  /** Container ref used for coordinate math (document coordinate space). */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Renders freeform, movable, resizable, editable text blocks that live on
 * the same infinite scroll surface as the Tiptap document and ink layer.
 *
 * Interactions:
 *   - Text tool + click on empty space   → insert a new block at click.
 *   - Text tool + double-click a block   → focus & edit.
 *   - Select tool                        → drag to move, corner handle to resize.
 *   - Multi-select                       → shift-click to add; drag any selected to move all.
 *   - Delete / Backspace                 → remove selected blocks (when not editing).
 *   - Ctrl/Cmd + D                       → duplicate selected blocks.
 */
export const TextBlockLayer = memo(function TextBlockLayer({
  blocks, onChange, toolActive, surfaceRef,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    kind: "move" | "resize";
    startX: number; startY: number;
    original: Record<string, TextBlock>;
    resizeId?: string;
  } | null>(null);

  const setBlocks = useCallback((updater: (prev: TextBlock[]) => TextBlock[]) => {
    onChange(updater(blocks));
  }, [blocks, onChange]);

  // Insert block on canvas click in Text tool mode.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onClick = (e: MouseEvent) => {
      if (toolActive !== "text") return;
      const target = e.target as HTMLElement;
      // Skip clicks on existing blocks / tiptap
      if (target.closest("[data-text-block]")) return;
      if (target.closest(".tiptap")) return;
      const r = surface.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const id = Math.random().toString(36).slice(2, 10);
      const nb: TextBlock = {
        id, x, y, width: 260, height: 60,
        html: "",
      };
      setBlocks((prev) => [...prev, nb]);
      setSelected(new Set([id]));
      setEditingId(id);
    };
    surface.addEventListener("click", onClick);
    return () => surface.removeEventListener("click", onClick);
  }, [toolActive, surfaceRef, setBlocks]);

  // Keyboard shortcuts (when not editing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest("[contenteditable='true']") || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (selected.size === 0) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setBlocks((prev) => prev.filter((b) => !selected.has(b.id)));
        setSelected(new Set());
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const clones: TextBlock[] = [];
        blocks.forEach((b) => {
          if (selected.has(b.id)) {
            clones.push({ ...b, id: Math.random().toString(36).slice(2, 10), x: b.x + 20, y: b.y + 20 });
          }
        });
        setBlocks((prev) => [...prev, ...clones]);
        setSelected(new Set(clones.map((c) => c.id)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, blocks, setBlocks]);

  const startMove = (e: React.PointerEvent, block: TextBlock) => {
    if (toolActive === "text" && editingId === block.id) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    // Selection
    let nextSel: Set<string>;
    if (e.shiftKey) {
      nextSel = new Set(selected);
      nextSel.has(block.id) ? nextSel.delete(block.id) : nextSel.add(block.id);
    } else if (!selected.has(block.id)) {
      nextSel = new Set([block.id]);
    } else {
      nextSel = new Set(selected);
    }
    setSelected(nextSel);
    const orig: Record<string, TextBlock> = {};
    blocks.forEach((b) => { if (nextSel.has(b.id)) orig[b.id] = { ...b }; });
    dragState.current = { kind: "move", startX: e.clientX, startY: e.clientY, original: orig };
  };

  const startResize = (e: React.PointerEvent, block: TextBlock) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    dragState.current = {
      kind: "resize", startX: e.clientX, startY: e.clientY,
      original: { [block.id]: { ...block } },
      resizeId: block.id,
    };
  };

  const onLayerPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (st.kind === "move") {
      setBlocks((prev) => prev.map((b) => {
        const o = st.original[b.id];
        if (!o) return b;
        return { ...b, x: Math.max(0, o.x + dx), y: Math.max(0, o.y + dy) };
      }));
    } else if (st.kind === "resize" && st.resizeId) {
      const o = st.original[st.resizeId];
      setBlocks((prev) => prev.map((b) => b.id === st.resizeId
        ? { ...b, width: Math.max(80, o.width + dx), height: Math.max(30, o.height + dy) }
        : b));
    }
  };

  const onLayerPointerUp = () => { dragState.current = null; };

  const onBlockDoubleClick = (b: TextBlock) => {
    setEditingId(b.id);
    setSelected(new Set([b.id]));
    // Focus after paint
    setTimeout(() => {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${b.id}"] [contenteditable]`);
      el?.focus();
      // Move caret to end
      const range = document.createRange();
      if (el && el.childNodes.length) {
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 10);
  };

  const commitEdit = (id: string, html: string) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, html } : b));
  };

  /** Auto-scroll the nearest scrollable ancestor when the caret nears an edge. */
  const edgeAutoScroll = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    let rect = range.getBoundingClientRect();
    // Empty line: rect is 0,0 — fall back to editing element
    if (rect.top === 0 && rect.bottom === 0 && editingId) {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${editingId}"] [contenteditable]`);
      if (el) rect = el.getBoundingClientRect();
    }
    const margin = 80;
    // Walk up to find scrollable ancestors and nudge them.
    let node: HTMLElement | null = surfaceRef.current;
    while (node) {
      const cs = getComputedStyle(node);
      const scrollable = /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight;
      if (scrollable) {
        const nr = node.getBoundingClientRect();
        if (rect.bottom > nr.bottom - margin) {
          node.scrollBy({ top: rect.bottom - (nr.bottom - margin), behavior: "smooth" });
        } else if (rect.top < nr.top + margin) {
          node.scrollBy({ top: rect.top - (nr.top + margin), behavior: "smooth" });
        }
        break;
      }
      node = node.parentElement;
    }
    // Also nudge window if needed.
    if (rect.bottom > window.innerHeight - margin) {
      window.scrollBy({ top: rect.bottom - (window.innerHeight - margin), behavior: "smooth" });
    } else if (rect.top < margin) {
      window.scrollBy({ top: rect.top - margin, behavior: "smooth" });
    }
  }, [editingId, surfaceRef]);

  // Editing container ref for format toolbar
  return (
    <div
      className="pointer-events-none absolute inset-0"
      ref={editorRef}
      onPointerMove={onLayerPointerMove}
      onPointerUp={onLayerPointerUp}
    >
      {blocks.map((b) => {
        const isSel = selected.has(b.id);
        const isEditing = editingId === b.id;
        const isEmpty = !b.html || b.html === "<br>";
        return (
          <div
            key={b.id}
            data-text-block={b.id}
            className={`pointer-events-auto absolute rounded-md transition-shadow ${
              isSel ? "ring-2 ring-primary/60" : "ring-1 ring-transparent hover:ring-border/60"
            } ${isEditing ? "bg-background/60 shadow-float" : ""}`}
            style={{
              left: b.x, top: b.y, width: b.width, minHeight: b.height,
              cursor: isEditing ? "text" : "move",
            }}
            onPointerDown={(e) => { if (!isEditing) startMove(e, b); }}
            onDoubleClick={() => onBlockDoubleClick(b)}
          >
            <div
              contentEditable={isEditing}
              suppressContentEditableWarning
              spellCheck
              data-placeholder={isEditing && isEmpty ? "Type…" : undefined}
              className={`min-h-full w-full rounded-md p-2 text-[15px] leading-relaxed outline-none focus:outline-none text-block-editable ${
                isEditing ? "caret-primary" : ""
              }`}
              style={{
                fontFamily: "var(--font-sans)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                caretColor: "hsl(var(--primary))",
              }}
              onBlur={(e) => {
                commitEdit(b.id, (e.currentTarget as HTMLDivElement).innerHTML);
                setEditingId((cur) => (cur === b.id ? null : cur));
              }}
              onInput={(e) => {
                // Auto-grow height to fit content (grows and shrinks).
                const el = e.currentTarget as HTMLDivElement;
                const container = el.parentElement as HTMLDivElement;
                if (container) {
                  container.style.minHeight = "0px";
                  const needed = el.scrollHeight + 4;
                  container.style.minHeight = `${needed}px`;
                  if (needed !== b.height) {
                    setBlocks((prev) => prev.map((x) => x.id === b.id ? { ...x, height: needed } : x));
                  }
                }
                edgeAutoScroll();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                // Enter → new paragraph line; Shift+Enter → soft <br>.
                // We force <br> in both cases for predictable plain multi-line typing,
                // but Shift+Enter is explicitly a "soft" break (no paragraph split).
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.execCommand("insertLineBreak");
                  // Fire edge scroll after DOM updates.
                  requestAnimationFrame(edgeAutoScroll);
                }
              }}
              dangerouslySetInnerHTML={
                isEditing
                  ? { __html: b.html || "" }
                  : { __html: b.html || "<span style=\"opacity:.5\">Type…</span>" }
              }
            />


            {isSel && !isEditing && (
              <>
                {/* Resize handle */}
                <div
                  onPointerDown={(e) => startResize(e, b)}
                  className="absolute right-[-4px] bottom-[-4px] h-3 w-3 rounded-sm bg-primary shadow"
                  style={{ cursor: "nwse-resize" }}
                />
                {/* Mini toolbar */}
                <div className="absolute -top-8 right-0 flex gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-float">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const clone: TextBlock = { ...b, id: Math.random().toString(36).slice(2, 10), x: b.x + 20, y: b.y + 20 };
                      setBlocks((prev) => [...prev, clone]);
                      setSelected(new Set([clone.id]));
                    }}
                    className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
                    title="Duplicate"
                  ><Copy className="h-3 w-3" /></button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlocks((prev) => prev.filter((x) => x.id !== b.id));
                      setSelected(new Set());
                    }}
                    className="grid h-6 w-6 place-items-center rounded text-destructive hover:bg-destructive/10"
                    title="Delete"
                  ><Trash2 className="h-3 w-3" /></button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <TextFormatToolbar containerRef={editorRef} active={editingId !== null} />
    </div>
  );
});
