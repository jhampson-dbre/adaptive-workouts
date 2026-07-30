# Rendered evidence

All captures use the standalone Vite entry with synthetic, brief-supplied data.

| Evidence | Viewport and starting state | Actions | Observed result | Accessibility checks | Limitations |
| --- | --- | --- | --- | --- | --- |
| `plan-desktop.png` | 1440 × 900, `?screen=plan`; 45 minutes; Shoulders and Legs selected | Loaded the route and inspected the rendered viewport | Full screen fits without scrolling; the time choice and selected groups lead to one obvious Generate Plan action | Native range and checkboxes; selected state uses checkmarks and text; all buttons are 49 px high; contrast is carried by dark text and the plum action | Static disposable controls do not execute production behavior |
| `performance-mobile.png` | 390 × 844, `?screen=performance`; Bench Press set 2 ready | Loaded the route and inspected ready, rest, input, and completion controls | Full screen fits; `100 lb × 8` and Start set lead; Bench rest `0:38` and Row rest `0:24` remain visually distinct; Plank shows `2 sets remaining` | Inputs are 46 px high; buttons are 49 px high; rest states include clock symbols and explicit text; ready state includes a dot and explicit `ready` label | Timers are fixed synthetic states |
| `review-desktop.png` | 1440 × 900, `?screen=review`; 5 of 7 confirmed | Loaded the route and inspected phases, confirmation rows, warning, and actions | Full screen fits; actual/planned comparisons read as one rail; Save workout is the clear primary action | Complete/partial states use ✓/− symbols plus text; controls exceed 44 px; warning remains adjacent to the decision | Static disposable controls do not save |
| `history-mobile.png` | 390 × 844, `?screen=history`; July 26, 2026 expanded | Loaded the route and inspected all supplied history content | Complete supplied record and Load older fit in the viewport; dense text remains readable; measured `scrollWidth = clientWidth = 390` | Main record text is 15 px; supporting text is no smaller than 14 px; confirmed states use ✓ plus text; Load older is 49 px high | Only the supplied history record is represented |
| `history-reflow-320.png` | 320 × 844, same expanded History state | Resized to 320 px and reloaded | Content reflows to stacked metadata; measured `scrollWidth = clientWidth = 320`; no horizontal scrolling | Long target, assistance, timing, and recommendation strings wrap without clipping; Load older remains 49 px high | Narrowest required width only |
| `focus-visible.png` | 1440 × 900, Plan | Focused Generate Plan and issued a keyboard key | Generate Plan shows a computed `4px solid rgb(25, 103, 210)` outline with `4px` offset | Focus is obvious against both plum and warm canvas and is not color-adjacent to the control border | Focus capture demonstrates one meaningful control |

## Cross-screen checks

- Browser console: no errors or warnings after exercising all routes.
- Status never relies on color alone: ready/rest/remaining and complete/partial states
  retain explicit text or symbols.
- Measured contrast ratios: ink/canvas `13.08:1`, muted/paper `5.64:1`,
  white/plum `8.99:1`, Active Workout/plum-dark `7.08:1`, rest/paper `8.08:1`,
  success/paper `5.92:1`, and delta/paper `7.34:1`. Muted apricot is decorative or
  paired with explicit text rather than carrying meaning alone.
- No animation carries meaning. The reduced-motion media query removes transitions,
  animation, and smooth scrolling.
- Font stacks end in common platform and generic fallbacks; no web font or font-dependent
  geometry is required.
- Every screenshot was visually inspected after capture. The initial Performance render
  hid `Active Workout`; that direct defect was corrected and the screenshot recaptured.
