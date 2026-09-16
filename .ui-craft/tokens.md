# Token decisions

## Color

- Neutral family: cool graphite neutrals for canvas, borders, and text.
- Accent: Excel green (`oklch(55% 0.15 145)`) for the primary action, active sheet, focus, and one key metric.
- Semantic colors: green for saved/healthy, amber for warnings, red for destructive/error states.

## Type

- UI: system sans-serif stack for fast Chinese and Latin rendering.
- Data: the same family with `tabular-nums`; JSON uses the system monospace stack.
- Scale: 12, 13, 14, 16, 20, 28 px.

## Spacing

- Four-pixel base with 4, 8, 12, 16, 24, and 32 px steps.
- Compact table rows; larger separation between the header, summary, and data workspace.

## Radius

- Inputs: 6 px.
- Buttons and table shell: 8 px.
- Summary panels: 10 px.
- Dialogs and drawers: 14 px.

## Shadow

- Raised surfaces use a restrained two-layer cool shadow.
- Table rows use a small lift only on pointer hover.

## Motion

- 120 ms for hover/focus feedback and 220 ms for dialogs or drawers.
- No decorative or continuous animation; reduced-motion disables transforms.

## Layering

- Base 0, sticky 20, modal backdrop 30, modal 40, toast 50.
