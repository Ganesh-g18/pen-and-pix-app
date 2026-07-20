# Pen Flow — Freeform Hybrid Notebook Upgrade

Large scope; ship in ordered phases so nothing regresses. Existing notes (single Tiptap `content` + `strokes[]`) stay fully compatible — new features are additive.

## Phase 1 — Freeform Text Blocks (core)
Data model (backward compatible):
- Extend `Note` with optional `textBlocks?: TextBlock[]`. Legacy `content` continues to render as the "main page" body in the background layer; new blocks live on top.
- `TextBlock = { id, x, y, width, height, html, rotation?, zIndex, style?: { fontFamily, fontSize, ... } }`.

Editor changes (`src/components/unified-editor.tsx`):
- Add a `blocks` layer between text background and SVG ink.
- Text tool: click empty space → create block at click point, auto-focus, min width, auto-grow height.
- Each block = its own lightweight Tiptap instance (memoized). Draggable via handle + resizable via corner. Selection state per block.
- Pen/highlighter/eraser tools ignore pointer events on blocks (blocks get `pointer-events:none` while inking); ink flows naturally around/over them.
- Multi-select via Shift+click; group drag / duplicate (Ctrl+D) / delete.
- Undo/redo integrates with existing snapshot history (extend snapshots to include textBlocks).

## Phase 2 — Floating Formatting Toolbar
- New `src/components/text-format-toolbar.tsx`: appears above the active block or selection using floating-ui positioning; hidden while drawing.
- Includes: font family, size, weight, B/I/U/S, color (spectrum + hex + RGB + recent + saved), align, lists (bullet/numbered/checklist/nested), line-height, letter-spacing, paragraph spacing, indent, highlight, super/subscript, clear formatting.
- Tiptap extensions to add: TextStyle, Color, FontFamily, FontSize (custom), Underline, Highlight, Superscript, Subscript, TextAlign, TaskList/TaskItem (already installed).
- Keyboard shortcuts: Ctrl+B/I/U, Ctrl+Shift+7/8, Ctrl+K link, Ctrl+Z/Y/A wired through Tiptap.

## Phase 3 — Live Settings
- Extend store settings with: `uiDensity`, `cornerRadius`, `toolbarSize`, `animationsEnabled`, template thickness fields.
- Apply via CSS variables on `<html>` in a new `useLiveSettings()` hook, so changes propagate instantly to every component without refresh:
  - `--radius`, `--density-scale`, `--toolbar-scale`, `--accent`, transitions gated by `[data-animations="off"]`.
- Update `src/styles.css` to consume these variables in paper backgrounds and shadcn base tokens.
- Settings page toggles/sliders call `updateSettings` (already reactive) — verify each row calls the store, not local-only state.

## Phase 4 — Template Thickness
- Extend note (or global settings) with `paperOptions: { lineThickness, gridThickness, dotSize, marginThickness }`.
- Convert `.paper-grid/.paper-dots/.paper-lined` in `src/styles.css` to consume CSS variables set inline on the surface `<div>`.
- Sliders added to Paper picker (in editor toolbar or note settings sheet).

## Phase 5 — Polish & perf
- `React.memo` on TextBlock, toolbar buttons; `useMemo` for derived stroke arrays; rAF-batched drag/resize.
- Virtualization deferred unless page count grows; add windowing only if perf regresses.
- Smooth animations (fade/scale) on block insert + toolbar mount via existing tailwind keyframes.
- Verify export (`export-note.ts`) renders text blocks — extend PDF/MD/TXT serialization to include block content.
- Verify cloud-sync persists `textBlocks` and new settings (already JSON columns).

## Compatibility guarantees
- All new fields optional with sane defaults; migrations coerce `undefined → []/defaults`.
- Legacy notes (only `content`+`strokes`) open unchanged; opening then saving does not mutate absent fields.
- Guest mode, cloud sync, undo/redo, export/import untouched at API level.

## Technical notes
- One Tiptap instance per block is fine for typical block counts (<50); above that, switch to a single shared editor rendered into the active block only.
- Ink layer stays in document coordinate space (unchanged) so strokes remain aligned as blocks move.
- Snapshot history entry format bumps to `{ strokes, textBlocks }`; old snapshots stay valid via defaulting.

## Delivery order
Phase 1 first (largest user value, unblocks Phase 2). Then 2 → 3 → 4 → 5. I'll pause after Phase 1 for you to try it before continuing.
