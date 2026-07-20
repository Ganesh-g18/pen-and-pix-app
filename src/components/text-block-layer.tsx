import { memo, useCallback, useEffect, useRef } from "react";
import type { TextBlock } from "@/lib/store";

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
 * Freeform inline text — OneNote-style.
 *
 * There are no visible text boxes. Each "block" is just an absolutely-positioned
 * span of editable text with NO border, background, ring, or resize handles.
 * The Text tool turns the whole surface into an insertion cursor: clicking
 * anywhere places a caret at that exact spot and lets the user type instantly.
 *
 * - Text tool + click empty space  → create a bare inline block, focus at click.
 * - Text tool + click existing text → place caret at the click position.
 * - Esc                            → blur, keep the text tool active.
 * - Empty block on blur            → auto-removed (no invisible artefacts).
 */
const MAX_WIDTH = 720;

export const TextBlockLayer = memo(function TextBlockLayer({
  blocks, onChange, toolActive, surfaceRef, editingId: editingIdProp, onEditingChange,
}: Props) {
  const editingIdRef = useRef<string | null>(null);
  const editingId = editingIdProp ?? editingIdRef.current;
  const setEditingId = useCallback((id: string | null) => {
    editingIdRef.current = id;
    onEditingChange?.(id);
  }, [onEditingChange]);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  /** Focus a block and (optionally) place caret at a client-x/y point. */
  const focusBlock = useCallback((id: string, clientPoint?: { x: number; y: number } | null) => {
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${id}"]`);
      if (!el) return;
      el.focus();
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
          e.preventDefault();
          focusBlock(id, { x: e.clientX, y: e.clientY });
        }
        return;
      }

      // Ignore clicks that land on the base tiptap doc (keep structured typing).
      if (target.closest(".tiptap")) return;

      const r = surface.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const id = Math.random().toString(36).slice(2, 10);
      const nb: TextBlock = { id, x, y, width: 0, height: 0, html: "" };
      onChange([...blocksRef.current, nb]);
      // Focus on the next frame so the element is mounted.
      requestAnimationFrame(() => focusBlock(id, null));
    };
    surface.addEventListener("mousedown", onDown);
    return () => surface.removeEventListener("mousedown", onDown);
  }, [toolActive, surfaceRef, onChange, focusBlock]);

  // Exit editing when the tool changes away from text.
  useEffect(() => {
    if (toolActive !== "text" && editingIdRef.current) {
      const el = document.querySelector<HTMLDivElement>(`[data-text-block="${editingIdRef.current}"]`);
      el?.blur();
      setEditingId(null);
    }
  }, [toolActive, setEditingId]);

  const commitEdit = (id: string, html: string) => {
    onChange(blocksRef.current.map((b) => b.id === id ? { ...b, html } : b));
  };

  const removeEmpty = (id: string) => {
    onChange(blocksRef.current.filter((b) => b.id !== id));
  };

  const edgeAutoScroll = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
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
  }, [surfaceRef]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((b) => {
        const isEmpty = !b.html || b.html === "<br>";
        const isEditing = editingId === b.id;
        return (
          <div
            key={b.id}
            data-text-block={b.id}
            contentEditable={toolActive === "text"}
            suppressContentEditableWarning
            spellCheck
            data-placeholder={isEditing && isEmpty ? "Type…" : undefined}
            className={`text-inline-block absolute text-[15px] leading-relaxed outline-none focus:outline-none ${
              toolActive === "text" ? "pointer-events-auto" : "pointer-events-none"
            }`}
            style={{
              left: b.x,
              top: b.y,
              maxWidth: MAX_WIDTH,
              minWidth: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-sans)",
              caretColor: "hsl(var(--primary))",
              zIndex: (b.zIndex ?? 0) + 1,
            }}
            onFocus={() => setEditingId(b.id)}
            onBlur={(e) => {
              const html = (e.currentTarget as HTMLDivElement).innerHTML;
              const text = (e.currentTarget as HTMLDivElement).textContent ?? "";
              if (!text.trim() && (!html || html === "<br>")) {
                removeEmpty(b.id);
              } else {
                commitEdit(b.id, html);
              }
              if (editingIdRef.current === b.id) setEditingId(null);
            }}
            onInput={() => edgeAutoScroll()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).blur();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                // Let default Enter create a new line (block behaves like a paragraph).
                // Browsers default to inserting <div> or <br>; normalise to <br> for tight spacing.
                e.preventDefault();
                document.execCommand("insertLineBreak");
                requestAnimationFrame(edgeAutoScroll);
              }
            }}
            dangerouslySetInnerHTML={{ __html: b.html || "" }}
          />
        );
      })}
    </div>
  );
});
