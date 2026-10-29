# Spin for dinner

## Selected design

Candidate E, **Clay turntable**, was selected on 2026-10-29 because it felt
best to the user. Keep its composition, clay quality tags, food artwork,
palette and motion. Further visual changes need a separate decision.

The full A–E prototypes, switcher and original HTML concept are archived on
`prototype/dinner-turntable-candidates` (commit `1aa85930263c`). They are not
part of the app.

## Behavior

- Open `/dinner-turntable` from Home's **Spin for dinner** entry.
- Tap a quality to keep it, again to rule it out, and again to release it.
  Spins respect those choices; they never silently relax them.
- Flick the wheel horizontally or use **Spin again**. Quality tags stay put.
  Reduced motion keeps the same actions without the rotation and scale.
- **Earlier** restores that dinner and the choices it had.
- **Cook this** hands the selected dinner and explicit choices to chat,
  without asking for another set of twists. It is unavailable when the
  current dinner conflicts with those choices or there is no active List.

Ideas and their time estimates are bundled editorial data. The turntable
does not yet filter by household preferences, allergies, equipment or stock.
Its choices are in-memory for this visit, not lasting household settings.
