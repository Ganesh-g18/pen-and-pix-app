import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { TextBlock } from "@/lib/store";
import { Copy, Trash2 } from "lucide-react";

interface Props {
  blocks: TextBlock[];
  onChange: (blocks: TextBlock[]) => void;
  /** Active tool from the parent editor. Text tool enables click-to-insert. */
  toolActive: "select" | "text" | "ink";
  /** Container ref used for coordinate math (document coordinate space). */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  /** Editing state broadcast to the parent so the text-tool panel can format the active block. */
  editingId?: string | null;
  onEditingChange?: (id: string | null) => void;
}

/**
 * Freeform text blocks.
 * - Text tool + click empty space  → create block AND immediately focus (no double-click).
 * - Text tool + click existing box  → focus that box, caret at click location.
 * - Select tool                     → drag to move, corner handle to resize.
 * - Esc                             → exit editing but keep the text tool active.
 * - Delete / Backspace              → remove selected blocks (when not editing).
 * - Ctrl/Cmd + D                    → duplicate selected blocks.
 */
export const TextBlockLayer = memo(function TextBlockLayer({
  blocks, onChange, toolActive, surfaceRef, editingId: editingIdProp, onEditingChange,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingIdInternal, setEditingIdInternal] = useState<string | null>(null);
  const editingId = editingIdProp !== undefined ? editingIdProp : editingIdInternal;
  const setEditingId = useCallback((id: string | null) => {
    setEditingIdInternal(id);
    onEditingChange?.(id);
  }, [onEditingChange]);

  const editorRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    kind: "move" | "resize";
    startX: number; startY: number;
    original: Record<string, TextBlock>;
    resizeId?: string;
    moved?: boolean;
  } | null>(null);
  const pendingCaretPoint = useRef<{ x: number; y: number } | null>(null);

  const setBlocks = useCallback((updater: (prev: TextBlock[]) => TextBlock[]) => {
    onChange(updater(blocks));
  }, [blocks, onChange]);

  /** Focus a block and (optionally) place caret at a client-x/y point. */
  const focusBlock = useCallback((id: string, clientPoint?: { x: number; y: number } | null) => {
    setEditingId(id);
    setSelected(new Set([id]));
    // wait for contenteditable to be applied
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${id}"] [contenteditable]`);
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      let placed = false;
      if (clientPoint) {
        // Prefer caretRangeFromPoint (Chromium/Safari); fall back to caretPositionFromPoint (Firefox).
        const doc = document as Document & {
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        };
        let range: Range | null = null;
        if (typeof doc.caretRangeFromPoint === "function") {
          range = doc.caretRangeFromPoint(clientPoint.x, clientPoint.y);
        } else if (typeof doc.caretPositionFromPoint === "function") {
          const pos = doc.caretPositionFromPoint(clientPoint.x, clientPoint.y);
          if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
        }
        if (range && el.contains(range.startContainer)) {
          sel.addRange(range);
          placed = true;
        }
      }
      if (!placed) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.addRange(r);
      }
    });
  }, [setEditingId]);

  // Insert / focus block on surface click in Text tool mode.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onDown = (e: MouseEvent) => {
      if (toolActive !== "text") return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Click on an existing block: let the block's own handler focus + place caret.
      if (target.closest("[data-text-block]")) return;
      // Ignore clicks on tiptap doc (users may still tap tiptap for structured text).
      if (target.closest(".tiptap")) return;
      const r = surface.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const id = Math.random().toString(36).slice(2, 10);
      const nb: TextBlock = { id, x, y, width: 260, height: 40, html: "" };
      pendingCaretPoint.current = null;
      onChange([...blocks, nb]);
      // Focus on next frame — element will have been mounted by then.
      requestAnimationFrame(() => focusBlock(id, null));
    };
    surface.addEventListener("mousedown", onDown);
    return () => surface.removeEventListener("mousedown", onDown);
  }, [toolActive, surfaceRef, blocks, onChange, focusBlock]);

  // Keyboard shortcuts (when not editing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editingActive = !!target?.closest("[contenteditable='true']");
      // Esc always exits edit mode (but keeps the tool selected).
      if (e.key === "Escape" && editingActive) {
        e.preventDefault();
        (target as HTMLElement).blur();
        setEditingId(null);
        return;
      }
      if (editingActive || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
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
  }, [selected, blocks, setBlocks, setEditingId]);

  const startMoveOrEdit = (e: React.PointerEvent, block: TextBlock) => {
    // In text tool: never drag; treat as focus-and-place-caret.
    if (toolActive === "text") {
      if (editingId === block.id) return; // already editing; let native caret handling work
      e.stopPropagation();
      focusBlock(block.id, { x: e.clientX, y: e.clientY });
      return;
    }
    if (editingId === block.id) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
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
    dragState.current = { kind: "move", startX: e.clientX, startY: e.clientY, original: orig, moved: false };
  };

  const startResize = (e: React.PointerEvent, block: TextBlock) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    dragState.current = {
      kind: "resize", startX: e.clientX, startY: e.clientY,
      original: { [block.id]: { ...block } }, resizeId: block.id, moved: false,
    };
  };

  const onLayerPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) st.moved = true;
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
    if (rect.top === 0 && rect.bottom === 0 && editingId) {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${editingId}"] [contenteditable]`);
      if (el) rect = el.getBoundingClientRect();
    }
    const margin = 80;
    let node: HTMLElement | null = surfaceRef.current;
    while (node) {
      const cs = getComputedStyle(node);
      const scrollable = /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight;
      if (scrollable) {
        const nr = node.getBoundingClientRect();
        if (rect.bottom > nr.bottom - margin) node.scrollBy({ top: rect.bottom - (nr.bottom - margin), behavior: "smooth" });
        else if (rect.top < nr.top + margin) node.scrollBy({ top: rect.top - (nr.top + margin), behavior: "smooth" });
        break;
      }
      node = node.parentElement;
    }
    if (rect.bottom > window.innerHeight - margin) window.scrollBy({ top: rect.bottom - (window.innerHeight - margin), behavior: "smooth" });
    else if (rect.top < margin) window.scrollBy({ top: rect.top - margin, behavior: "smooth" });
  }, [editingId, surfaceRef]);

  // Exit editing when the tool changes away from text
  useEffect(() => {
    if (toolActive !== "text" && editingId) {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${editingId}"] [contenteditable]`);
      el?.blur();
      setEditingId(null);
    }
  }, [toolActive, editingId, setEditingId]);

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
        const cursorStyle =
          isEditing ? "text" : toolActive === "text" ? "text" : "move";
        return (
          <div
            key={b.id}
            data-text-block={b.id}
            className={`pointer-events-auto absolute rounded-md transition-shadow ${
              isSel || isEditing ? "ring-2 ring-primary/60" : "ring-1 ring-transparent hover:ring-border/60"
            } ${isEditing ? "bg-background/60 shadow-float" : ""}`}
            style={{
              left: b.x, top: b.y, width: b.width, minHeight: b.height,
              cursor: cursorStyle,
              zIndex: (b.zIndex ?? 0) + 1,
            }}
            onPointerDown={(e) => startMoveOrEdit(e, b)}
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
                setEditingId(editingId === b.id ? null : editingId);
              }}
              onInput={(e) => {
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
                if (e.key === "Escape") {
                  e.preventDefault();
                  (e.currentTarget as HTMLDivElement).blur();
                  setEditingId(null);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.execCommand("insertLineBreak");
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
                <div
                  onPointerDown={(e) => startResize(e, b)}
                  className="absolute right-[-4px] bottom-[-4px] h-3 w-3 rounded-sm bg-primary shadow"
                  style={{ cursor: "nwse-resize" }}
                />
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
    </div>
  );
});
