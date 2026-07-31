---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/components/Generator.jsx","src/components/WorkoutView.jsx","src/index.css","index.html"]
---

# Nudge core journey

## Scope and mode

Required mobile-first Operate UI for the shared shell and Plan → Perform → Cooldown → Review/completion. Settings and history keep their behavior and are outside this visual pilot.

## Audience and job

An individual trainee, often alone and handling a phone around equipment, needs Nudge to turn available time and training history into a focused session. The screen must keep them oriented without asking them to plan.

## Action and content

Each state presents what is happening, one dominant next action, then optional alternatives. Plan collects time and constraints; Perform exposes the current set and exercise list; Cooldown closes the session; Review confirms exactly what will be saved. Existing engine, timing, recovery, persistence, focus, authentication, and lazy navigation semantics remain unchanged.

## Direction and memorable moment

Airport-wayfinding structure without literal wayfinding copy. The memorable moment is the oversized yellow Start set panel. Use plain labels such as “Exercises,” never route, gate, destination, or next stop.

## Approved artifact and inventory

Approved comp: `.impeccable/mocks/nudge-single-next-action.png`.

- Semantic code: Nudge wordmark, four-phase progress, current exercise, set inputs, dominant action, passive concurrent-rest status, exercise rows, cooldown action, review summary.
- CSS geometry: black/yellow/white sign planes, large numeric identifiers, authored arrow geometry, thin rules, responsive stacking, visible keyboard focus.
- Raster media: none. Core text and controls remain semantic and responsive.

## Constraints

No streak pressure, punishment, trophies, generic praise, faux precision, unsupported readiness claims, guilt, urgency, exertion pressure, simulated intimacy, authoritative coaching, invented recommendations, or configuration beyond existing inputs.

## Unresolved decisions

None.
