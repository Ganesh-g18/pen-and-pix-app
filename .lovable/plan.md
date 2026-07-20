## Goal

Make the **Font family** control match the compact style of the **Font size** control (inline `<select>` dropdown), instead of the current button-with-popover.

## Change (single file: `src/components/text-tool-panel.tsx`)

Replace the Font button + popover block (lines ~200–222) with an inline native `<select>` that mirrors the size dropdown:

- Same height (`h-8`), text size (`text-xs`), transparent background, `hover:bg-accent` styling.
- Each `<option>` is a font from the existing `FONTS` array, with `style={{ fontFamily: f }}` so the option renders in its own typeface (where the OS supports it in `<option>`).
- `onChange` calls `cmd("fontName", e.target.value)` to apply to the current selection (same pattern as size).
- Remove the now-unused `"font"` value from `openMenu`'s union type.
- Keep the `Type` icon by placing it just before the select as a small non-interactive prefix, so the control still visually reads as "Font".

No other toolbar sections, drawing logic, or store code changes.

## Result

Font family becomes a single-tap compact dropdown sitting directly next to the Font size dropdown, matching its visual weight and interaction.

Add search font option

&nbsp;