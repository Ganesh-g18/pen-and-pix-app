import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TextBlock } from "@/lib/store";

/** Treat blocks as empty only when neither text nor meaningful markup exists. */
function isBlockEmpty(html: string, text: string): boolean {
  if (text.trim().length > 0) return false;
  if (!html) return true;
  // Strip <br>, whitespace, and empty formatting wrappers.
  const stripped = html
    .replace(/<br\s*\/?>(?=|$)/gi, "")
    .replace(/<(span|div|p|font|b|i|u|em|strong)[^>]*>\s*<\/\1>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/\s+/g, "");
  return stripped.length === 0;
}

interface Props {
  blocks: TextBlock[];
  onChange: (blocks: TextBlock[]) => void;
  /** Active tool from the parent editor. Text tool enables click-to-insert; Select tool enables drag-to-move. */
  toolActive: "select" | "text" | "ink";
  /** Container ref used for coordinate math (document coordinate space). */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  /** Editing state broadcast to the parent so the text-tool panel can format the active block. */
  editingId?: string | null;
  onEditingChange?: (id: string | null) => void;
}

/**
 * Freeform inline text — OneNote-style.
 *
 * - Text tool + click empty space  → create a bare inline block, focus at click.
 * - Text tool + click existing text → place caret at the click position.
 * - Select tool + drag on text     → move the block; click alone leaves it in place.
 * - Esc                            → blur, keep the active tool.
 * - Empty block on blur            → auto-removed (no invisible artefacts).
 */
const MAX_WIDTH = 720;
const DRAG_THRESHOLD = 4; // px before a click promotes to a drag

export const TextBlockLayer = memo(function TextBlockLayer({
  blocks,
  onChange,
  toolActive,
  surfaceRef,
  editingId: editingIdProp,
  onEditingChange,
}: Props) {
  const editingIdRef = useRef<string | null>(null);
  const editingId = editingIdProp ?? editingIdRef.current;
  const setEditingId = useCallback(
    (id: string | null) => {
      editingIdRef.current = id;
      onEditingChange?.(id);
    },
    [onEditingChange],
  );

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** Focus a block and (optionally) place caret at a client-x/y point. */
  const focusBlock = useCallback(
    (id: string, clientPoint?: { x: number; y: number } | null) => {
      setEditingId(id);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLDivElement>(`[data-text-block="${id}"]`);
        if (!el) return;
        el.focus({
    preventScroll: true,
});
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        let placed = false;
        if (clientPoint) {
          const doc = document as Document & {
            caretRangeFromPoint?: (x: number, y: number) => Range | null;
            caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
          };
          let range: Range | null = null;
          if (typeof doc.caretRangeFromPoint === "function") {
            range = doc.caretRangeFromPoint(clientPoint.x, clientPoint.y);
          } else if (typeof doc.caretPositionFromPoint === "function") {
            const pos = doc.caretPositionFromPoint(clientPoint.x, clientPoint.y);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
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
    },
    [setEditingId],
  );

  // Surface click in Text mode → create new block or focus existing at caret.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onDown = (e: MouseEvent) => {
      if (toolActive !== "text") return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;

      // Click on existing inline text → focus at caret position.
      const existing = target.closest<HTMLElement>("[data-text-block]");
      if (existing) {
        const id = existing.getAttribute("data-text-block");
        if (id) {
          // Allow the browser's native selection if this block is already being edited.
          if (editingIdRef.current === id) {
            return;
          }

          e.preventDefault();
          focusBlock(id, { x: e.clientX, y: e.clientY });
        }
        return;
      }

      // Ignore clicks that land on the base tiptap doc (keep structured typing).
      if (target.closest(".tiptap")) return;

      // Prevent the browser from stealing focus before we can commit the
      // currently-editing block. Without this, the editable blurs and React
      // re-renders wipe the freshly typed DOM content.
      e.preventDefault();

      // Commit / drop the currently editing block using the latest DOM html.
      let latest = blocksRef.current;
      const curId = editingIdRef.current;
      if (curId) {
        const curEl = document.querySelector<HTMLDivElement>(`[data-text-block="${curId}"]`);
        if (curEl) {
          const html = curEl.innerHTML;
          const text = curEl.textContent ?? "";
          if (isBlockEmpty(html, text)) {
            latest = latest.filter((b) => b.id !== curId);
          } else {
            latest = latest.map((b) => (b.id === curId ? { ...b, html } : b));
          }
        }
        try {
          (document.activeElement as HTMLElement | null)?.blur();
        } catch {
          /* noop */
        }
      }

      const r = surface.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const id = Math.random().toString(36).slice(2, 10);
      const nb: TextBlock = { id, x, y, width: 0, height: 0, html: "" };
      setEditingId(id);
      onChange([...latest, nb]);


// just now deleted useeffect
      const id = Math.random().toString(36).slice(2, 10);
const nb: TextBlock = { id, x, y, width: 0, height: 0, html: "" };

setEditingId(id);
onChange([...latest, nb]);

requestAnimationFrame(() => {
    focusBlock(id, null);
});

});
    surface.addEventListener("mousedown", onDown);
    return () => surface.removeEventListener("mousedown", onDown);
  }, [toolActive, surfaceRef, onChange, focusBlock]);

  // Exit editing when the tool changes away from text.
  useEffect(() => {
    if (toolActive !== "text" && editingIdRef.current) {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${editingIdRef.current}"]`);
      if (el) {
        const html = el.innerHTML;
        const text = el.textContent ?? "";
        if (isBlockEmpty(html, text)) {
          onChange(blocksRef.current.filter((b) => b.id !== editingIdRef.current));
        } else {
          onChange(blocksRef.current.map((b) => (b.id === editingIdRef.current ? { ...b, html } : b)));
        }
        el.blur();
      }
      setEditingId(null);
    }
  }, [toolActive, setEditingId, onChange]);
  useEffect(() => {
    if (toolActive !== "text") return;

    if (!editingIdRef.current) return;

    requestAnimationFrame(() => {
        const el = document.querySelector<HTMLDivElement>(
            `[data-text-block="${editingIdRef.current}"]`
        );

        el?.focus({ preventScroll: true });
    });
}, [toolActive]);
  const commitEdit = (id: string, html: string) => {
    onChange(blocksRef.current.map((b) => (b.id === id ? { ...b, html } : b)));
  };

  const removeEmpty = (id: string) => {
    onChange(blocksRef.current.filter((b) => b.id !== id));
  };

  /** Drag-to-move (Select tool). */
  const beginDrag = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (toolActive !== "select") return;
      if (e.button !== 0) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      e.preventDefault();
      e.stopPropagation();
      const block = blocksRef.current.find((b) => b.id === id);
      if (!block) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const originX = block.x;
      const originY = block.y;
      const pointerId = e.pointerId;
      const targetEl = e.currentTarget as HTMLDivElement;
      let dragging = false;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!dragging) {
          dragging = true;
          setDraggingId(id);
          try {
            targetEl.setPointerCapture(pointerId);
          } catch {
            /* noop */
          }
        }
        onChange(
          blocksRef.current.map((b) =>
            b.id === id ? { ...b, x: Math.max(0, originX + dx), y: Math.max(0, originY + dy) } : b,
          ),
        );
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        try {
          targetEl.releasePointerCapture(pointerId);
        } catch {
          /* noop */
        }
        setDraggingId(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [toolActive, surfaceRef, onChange],
  );

  const edgeAutoScroll = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (rect.top === 0 && rect.bottom === 0 && rect.left === 0) return;
    const margin = 80;
    let node: HTMLElement | null = surfaceRef.current;
    while (node) {
      const cs = getComputedStyle(node);
      const scrollable = /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight;
      if (scrollable) {
        const nr = node.getBoundingClientRect();
        if (rect.bottom > nr.bottom - margin)
          node.scrollBy({ top: rect.bottom - (nr.bottom - margin), behavior: "smooth" });
        else if (rect.top < nr.top + margin) node.scrollBy({ top: rect.top - (nr.top + margin), behavior: "smooth" });
        break;
      }
      node = node.parentElement;
    }
  }, [surfaceRef]);

  const interactive = toolActive === "text" || toolActive === "select";

  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((b) => {
        const isEditing = editingId === b.id;
        const isDragging = draggingId === b.id;
        const selectMode = toolActive === "select";
        return (
          <EditableBlock
            key={b.id}
            block={b}
            toolActive={toolActive}
            interactive={interactive}
            selectMode={selectMode}
            isEditing={isEditing}
            isDragging={isDragging}
            maxWidth={MAX_WIDTH}
            onPointerDown={selectMode ? (e) => beginDrag(e, b.id) : undefined}
            onFocus={() => setEditingId(b.id)}
            onHtmlChange={(html) => commitEdit(b.id, html)}
            onBlurCommit={(html, text) => {
              if (isBlockEmpty(html, text)) {
                removeEmpty(b.id);
              } else {
                commitEdit(b.id, html);
              }
              if (editingIdRef.current === b.id) setEditingId(null);
            }}
            onEdgeAutoScroll={edgeAutoScroll}
          />
        );
      })}
    </div>
  );
});

interface EditableBlockProps {
  block: TextBlock;
  toolActive: "select" | "text" | "ink";
  interactive: boolean;
  selectMode: boolean;
  isEditing: boolean;
  isDragging: boolean;
  maxWidth: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onFocus: () => void;
  onHtmlChange: (html: string) => void;
  onBlurCommit: (html: string, text: string) => void;
  onEdgeAutoScroll: () => void;
}

const EditableBlock = memo(function EditableBlock({
  block: b,
  toolActive,
  interactive,
  selectMode,
  isEditing,
  isDragging,
  maxWidth,
  onPointerDown,
  onFocus,
  onHtmlChange,
  onBlurCommit,
  onEdgeAutoScroll,
}: EditableBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync incoming html into the DOM imperatively so that parent re-renders
  // do NOT clobber the user's in-progress typing while the block is focused.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // never overwrite live edits
    const next = b.html || "";
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [b.html]);

  const isEmpty = !b.html || b.html === "<br>";

  return (
    <div
      ref={ref}
      data-text-block={b.id}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={isEditing && isEmpty ? "Type…" : undefined}
      className={`text-inline-block absolute text-[15px] leading-relaxed outline-none focus:outline-none ${
        interactive ? "pointer-events-auto" : "pointer-events-none"
      } ${selectMode ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""} ${
        selectMode ? "ring-1 ring-primary/30 hover:ring-primary/60 rounded-sm" : ""
      }`}
      style={{
        left: b.x,
        top: b.y,
        maxWidth,
        minWidth: 8,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: undefined,
        caretColor: "hsl(var(--primary))",
        zIndex: (b.zIndex ?? 0) + 1,
        userSelect: selectMode ? "none" : undefined,
        touchAction: selectMode ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        onBlurCommit(el.innerHTML, el.textContent ?? "");
      }}
      onInput={(e) => {
        const el = e.currentTarget;

        onHtmlChange(el.innerHTML);

        onEdgeAutoScroll();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).blur();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
          requestAnimationFrame(onEdgeAutoScroll);
        }
      }}
    />
  );
});
