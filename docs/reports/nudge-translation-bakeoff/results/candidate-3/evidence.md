# A-r3 Warm Training Partner — rendered evidence

Build under test: local Vite entry `trek-229-bakeoff.html` after `npm run build`
completed successfully. Captures used the in-app browser against the local Vite
development server with synthetic locked bake-off data.

| Evidence | Viewport and starting state | Actions | Observed result | Accessibility checks | Limitation |
| --- | --- | --- | --- | --- | --- |
| `plan-desktop.png` | 1440 × 900; `?screen=plan`; 45 minutes; Shoulders and Legs checked | Loaded the route and inspected the rendered controls | Complete screen fit in one viewport with no horizontal or vertical scroll. The time choice leads, recovery choices remain user-controlled, and Generate Plan is the single filled action. | Buttons measured 44 px high; native labeled range and checkboxes were exposed in the accessibility tree; selected groups were programmatically checked; text contrast passed AA. | Presentation-only controls intentionally do not mutate workout state. |
| `performance-mobile.png` | 390 × 844; `?screen=performance`; Bench Press set 2 ready | Loaded the route and measured controls and overflow | Ready Bench Press is the dominant outlined region. Bench Press `0:38` and Row `0:24` remain separately visible without blocking Start set; Plank retains `2 sets remaining`. The complete screen fits without scroll. | Start set and Finish Workout measured 44 px high; both inputs measured 44 px high and have accessible names; viewport and document widths both measured 390 px. | Timer progression is intentionally static in this disposable translation. |
| `review-desktop.png` | 1440 × 900; `?screen=review`; 5 of 7 confirmed | Loaded the route and inspected hierarchy and status marks | Actual/planned phase values scan as one ruled comparison plane. Save workout is the only filled action. Check and dash marks reinforce confirmed versus partial status alongside explicit text. | Buttons measured 44 px high; status is not color-only; viewport and document widths both measured 1440 px; body and action text passed AA contrast. | Save and Back actions are presentation-only. |
| `history-mobile.png` | 390 × 844; `?screen=history`; July 26 record expanded | Loaded the route and inspected dense text and target size | The complete supplied workout record and Load older control fit in one viewport. No line is clipped and the record reads as one cared-for chronology rather than nested cards. | Dense body text renders at 14 px with 1.48 line height; Load older measured 44 px high; viewport and document widths both measured 390 px. | Only the canonical supplied record is rendered. |
| `history-reflow-320.png` | 320 × 844; same expanded History state | Reloaded at the narrow verification width and checked element scroll widths | Long weighted, rest, and bodyweight lines wrap cleanly. Document width equals viewport width at 320 px; no inspected element had content wider than its client box. | Load older measured 44 px high; text stays at 14 px; no horizontal scrolling or clipped dense text. | Generic fallback font selection cannot be named reliably by the browser; the system/sans-serif stack rendered without overflow at the narrowest required width. |
| `focus-visible.png` | 1440 × 900; Review | Used keyboard navigation to focus Back to workout | A blue focus outline is clearly visible outside the secondary action without obscuring its label or colliding with Save workout. | Computed focus was a solid `#2563B8` outline with a positive offset; contrast against the warm canvas is 5.26:1. | Focus evidence covers one meaningful state as required, not every control. |

## Cross-scenario checks

- Primary action text (`#FFFAF2` on `#B9470E`) measures 5.09:1.
- Muted text (`#706860` on `#F7F1E8`) measures 4.87:1.
- Success text (`#2D6948` on `#FDF8F0`) measures 6.16:1.
- Control borders (`#8D8174`) measure at least 3.38:1 against adjacent warm surfaces.
- The interface has no meaning-bearing animation. Its reduced-motion rule disables
  transitions and animation without removing content or state.
- The font stack is dependency-free (`ui-rounded`, Avenir Next, Segoe UI, sans-serif);
  the rendered system fallback preserved every required viewport and the 320 px reflow.
- All six screenshots were visually inspected after final capture. No direct clipping,
  collision, illegible text, obscured action, or incorrect locked state remained.
