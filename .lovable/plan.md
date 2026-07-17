# Editor Premium Upgrade — Phased Plan

This is a very large scope (18 areas, effectively a rewrite of the editor surface). To keep the app stable, ship it in **4 phases**. Each phase is independently mergeable and preserves existing notes, auth, sync, and MCP.

Please confirm the phasing and pick where to start. I'll implement Phase 1 immediately after approval.

---

## Phase 1 — Unified Editor Shell + Toolbar + Theme Default (ship first)

Highest user-visible impact, lowest risk.

- **Unified surface**: Replace the Text/Canvas mode toggle in `src/routes/note.$id.tsx` with a single stacked layout: TipTap editor on a transparent layer, SVG stroke layer absolutely positioned above, sharing one scroll container. Drawing coordinates stored in document space (not viewport) so strokes stay pinned on scroll.
- **Active-tool model**: New `activeTool` state (`select | text | pen | highlighter | eraser | shape | lasso`). Pointer events routed to text layer when `text`/`select`, to canvas layer otherwise (via `pointer-events` toggle on the SVG overlay).
- **Compact floating toolbar**: New `<EditorToolbar />` — bottom-centered, glass, ~30% smaller (h-10 instead of h-14, tighter gaps), rounded-2xl, shadow-xl, `backdrop-blur-xl`. Auto-repositions on mobile.
- **Light mode default**: Change `defaultSettings.themeMode` to `"light"` in `src/lib/store.ts`; existing dark users keep their persisted preference (zustand persist). Never auto-switch.
- **Backward compat**: Existing notes render unchanged — old `mode` field becomes ignored, both `content` and `strokes` render together.

## Phase 2 — Pen System + Color + Size + Eraser + Highlighter

- **Pen library**: New `pens: Pen[]` in store with pin/reorder/duplicate/delete. Each pen: `{id, name, tool, color, size, opacity, smoothing, pressure}`. Pinned pens surface in toolbar; overflow in popover.
- **Size control**: Slider (0.2–30) + quick presets (0.2/0.5/1/2/3/5/8/10/15/20/30) with live dot preview.
- **Color picker**: Replace preset swatches with a real spectrum picker (`react-colorful` — small, no deps beyond React). HEX/RGB/HSV inputs, opacity slider, recent + favorites arrays in store. Eyedropper via `window.EyeDropper` where supported (Chromium).
- **Eraser**: Stroke eraser (existing) + spot eraser (hit-test path segments within radius, split/trim stroke). Toggle in toolbar.
- **Highlighter**: Separate tool with default multiply blend mode and opacity slider.

## Phase 3 — Shapes, Lasso, Rich Text, Insertables

- **Shape tool**: Draw freehand → on pointerup, classify (circle/rect/triangle/line/arrow/star) via simple heuristics (bounding box + vertex count from Douglas–Peucker). Replace stroke with clean shape.
- **Lasso**: Freehand selection → hit-test strokes with point-in-polygon → transform handle (move/resize/rotate), duplicate, delete, recolor, group.
- **Text extensions**: Add TipTap extensions for Underline, Table, TextAlign, FontFamily, FontSize (already have TaskList).
- **Insertables**: Slash menu for image / table / checklist / code block / sticky note (sticky = styled callout node).

## Phase 4 — Perf, Gestures, A11y, Settings

- **Virtualized strokes**: Split strokes into ~1000px vertical tiles; only render tiles intersecting viewport. `will-change: transform` on the active-stroke layer only.
- **Pinch zoom + pan**: Two-finger gesture on canvas layer; already have two-finger scroll from prior fix.
- **Keyboard**: Global shortcut handler for Undo/Redo/Copy/Paste/Select-All/Delete on selection.
- **Settings additions**: Palm rejection toggle, auto-straighten, toolbar position (bottom/left/right), gesture enable, default pen — wired into existing `/settings` page under a new "Drawing" section.
- **Fullscreen**: Button that calls `requestFullscreen()` on the editor container.

---

## Technical notes

- **No architecture change**: Same routes, same store, same Supabase client, same MCP tools. Only additive fields on `Note` (`strokes` already exists) and `Settings` (new `pens`, `recentColors`, `favoriteColors`).
- **Store migration**: Add a zustand `migrate` function bumping to `inkflow-store-v2` that fills in new fields with defaults for existing users.
- **New deps**: `react-colorful` (~3kb), `perfect-freehand` already usable via existing canvas code (verify), no other adds.
- **New files** (Phase 1): `src/components/editor-toolbar.tsx`, `src/components/unified-editor.tsx`; modified: `src/routes/note.$id.tsx`, `src/lib/store.ts`, `src/components/canvas-editor.tsx` (extract stroke rendering into overlay).

---

## Question for you

Which phase should I start with?
1. **Phase 1 only** (recommended — unified editor + compact toolbar + light default). Ships in this turn.
2. **Phase 1 + 2** (adds pen library, color spectrum, spot eraser, highlighter). Larger diff.
3. **All 4 phases now** (very large single change — higher risk of regressions to auth/sync/MCP).

If you don't reply, I'll proceed with **Phase 1**.
