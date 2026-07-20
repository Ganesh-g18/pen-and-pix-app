## Root cause
In `src/components/text-tool-panel.tsx` the Font control renders the `<Type>` icon as a sibling of the `<button>`, both wrapped in a `<div class="relative flex items-center">`. The icon has `pointer-events-none`, so a click on the icon passes through to the wrapper `<div>`, which has no `onClick`. Users who click on the icon (visually part of the "Font" label) see nothing happen.

## Fix
Move the `<Type>` icon **inside** the button so the entire icon + "Font" label is a single click target. Keep behavior otherwise identical.

Concretely, in the Font family block (~lines 201–210):
- Change wrapper to just `<div className="relative">`.
- Restructure the trigger to `<button ...><Type className="mr-1 h-3.5 w-3.5" />Font</button>` with `inline-flex items-center` layout.
- Add `type="button"` to be explicit and avoid any implicit submit behavior.

No other logic, popover markup, search input, or file changes.