## Scope

Extend the existing `editor-toolbar.tsx` and `unified-editor.tsx` with per-tool memory, richer popovers, pressure sensitivity, and a live cursor preview. No architectural changes, no schema changes, no UI redesign.

## Data model (backward compatible)

In `src/lib/store.ts`, add an optional `toolPresets` field to `Settings` (defaulted at read time so legacy persisted state keeps working):

```ts
type ToolId = "ballpoint" | "fountain" | "marker" | "pencil" | "brush" | "highlighter" | "eraser";
interface ToolPreset {
  color: string; size: number; opacity: number;
  pressure: boolean; smoothing: boolean;
  name?: string;
}
toolPresets?: Partial<Record<ToolId, ToolPreset>>;
recentColors?: string[];   // capped to 12
savedColors?: string[];    // user-pinned
```

Extend `PinnedPen` with optional `opacity`, `pressure`, `smoothing`, `name` (all optional so existing pinned pens still load). Extend `PenStyle` with `"brush"`; extend `Stroke.tool` union with `"brush"` (renders like marker with pressure).

## Toolbar changes (`editor-toolbar.tsx`)

1. Click a pen → activate immediately. Long-press (2s) OR right-click on the active pen → open that pen's settings popover.
2. New unified `PenSettingsPopover` used by Ballpoint / Fountain / Marker / Pencil / Brush / Highlighter:
   - Spectrum color picker (reuse existing `SpectrumPicker`) + hex + RGB inputs
   - Recent colors row + Saved colors row (add/remove)
   - Eyedropper button (feature-detect `window.EyeDropper`; hide otherwise)
   - Opacity slider, thickness slider, live stroke preview
   - Pressure sensitivity toggle, smoothing toggle
   - "Pin this pen" writes the full config to `pinnedPens`
3. Eraser popover: Stroke/Spot toggle, size slider, softness slider (spot only), live preview circle.
4. Each tool remembers its own color/size/opacity/pressure/smoothing via `toolPresets`; switching tools restores that preset. Highlighter thickness is independent.
5. Pinned pen glyph gets a colored ring + colored size-bar so the color is instantly recognizable. Clicking a pinned pen restores every stored property.
6. Dynamic eraser icon already exists; keep it and reflect size in the cursor.

## Canvas changes (`unified-editor.tsx`)

1. Pressure-sensitive width per tool, applied when `pointer.pressure > 0` and the tool's `pressure` toggle is on:
   - ballpoint: `size * (0.6 + 0.4*p)`
   - pencil: `size * (0.3 + 0.9*p)` (already dashed)
   - fountain / brush: `size * (0.2 + 1.1*p)`
   - marker: `size * (0.85 + 0.2*p)`
   - highlighter: near-constant width; `opacity *= 0.7 + 0.4*p`
   Fallback to constant width when `pressure === 0` or `pointerType !== "pen"`.
   Implementation: store per-sample pressure (already in `points[i+2]`) and switch `strokeToPath` to emit variable-width segments only for brush/fountain/pencil; ballpoint/marker keep a single path with `size * avgPressure` at commit time to avoid re-render cost.
2. Live cursor preview overlay (single absolutely-positioned div, updated via `ref.style.transform`, no React re-render on move):
   - Pen: solid ring at current width
   - Highlighter: translucent rounded rectangle at highlighter width
   - Spot eraser: dashed circle sized to eraser thickness
   - Stroke eraser: existing eraser glyph
3. Keep existing eraser session/undo behavior. Spot eraser radius reads from active eraser size.

## Performance

- Memoize `PenSettingsPopover`, `EraserPopover`, `PinnedGlyph` with `React.memo`.
- Cursor overlay updates via `requestAnimationFrame` + direct DOM writes, not `setState`.
- Slider drags update local state; commit to store on `pointerup` only.
- Selector splitting already in place; keep `pinnedPens` and `toolPresets` reads narrow.

## Compatibility guardrails

- All new `Settings` fields optional with runtime defaults, so old persisted stores load.
- `Stroke` shape unchanged (still `points: number[]`, `opacity`, `size`, `tool`, optional `penStyle`); `"brush"` added to unions, older strokes still render.
- PinnedPen extra fields optional; existing pinned pens keep working.
- No changes to routes, cloud-sync payloads, PDF export, guest mode, auth.

## Out of scope for this pass

- Redesigning any layout.
- Migrating persisted stores (defaults are applied on read instead).
- Rewriting `canvas-editor.tsx` (legacy mode-switch editor, untouched).