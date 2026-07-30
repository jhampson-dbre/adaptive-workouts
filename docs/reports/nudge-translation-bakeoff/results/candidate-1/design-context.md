# Design context

## Visual thesis

Warm Training Partner uses a room-like composition rather than a dashboard: a soft clay
canvas, deep charcoal type, open dividers, and one generous prepared space per screen.
Terracotta is the sole interactive accent. Olive supports status, always paired with
symbols and text. Plan and Review breathe; Performance tightens into a focused workbench;
History reads as a cared-for record.

## UX classification and scenarios

- Classification: `required`
- Rationale: responsive hierarchy, controls, focus, dense workout history, and concurrent
  timer states materially change.
- Approved artifact: the canonical A-r3 prompt, source images, this scenario record, and
  the independent UX design review completed before implementation.
- Plan: make the 45-minute choice and selected groups obvious, then lead directly to one
  primary action.
- Performance: scan ready target → actual inputs → Start set while both independent rest
  states stay visible and non-blocking.
- Review: inspect actual/planned phases, understand partial confirmation, then save or
  return.
- History: read the complete record in one document flow at 390 and 320 px without tiny
  type, squeezed columns, or horizontal scrolling.

## Key decisions

- Use canvas, rules, and proximity instead of a header-plus-card stack.
- Preserve native range, checkbox, number, and button semantics.
- Keep every supplied explanation beside the value or action it qualifies.
- Pair ready, rest, confirmed, and partial states with explicit words or symbols.
- Let mobile values wrap into labeled lines; never reduce type to force a table.
