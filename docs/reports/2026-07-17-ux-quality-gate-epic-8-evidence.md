# EPIC-8 Pilot Evidence Matrix

Frozen build for every row: `ce5a389a01a8718f220d5766181aec0730c4832e`.

All rows use local Auth/Firestore emulators and synthetic/de-identified data. Screenshots were inspected in the in-app browser; this text matrix is the persisted non-sensitive evidence artifact.

| Scenario | Ref | Viewport | Normative expectation and action | Observed result | Classification / limitation |
| --- | --- | --- | --- | --- | --- |
| A Generate | E-01 | 375×812 | Signed-in ready state exposes Generate Plan and reachable constraints without horizontal overflow. | Header, two-column controls, slider, and primary action rendered. | `observed-pass`; keyboard focus and touch targets not measured. |
| A Generate | E-02 | 390×844 | Same mobile hierarchy remains operable at the second required width. | Same responsive structure; primary action visible in the card. | `observed-pass`; no quantitative target measurement. |
| A Generate | E-03 | 1280×800 | Wider layout keeps generator centered and utility navigation distinct. | Centered readable card and header utility; no console warnings/errors. | `observed-pass`; no production comparison. |
| A Generate | E-04 | Initial/default | Signed-out and loading states must transition to a usable sign-in gate. | Loading state and signed-out Google button were observed before emulator sign-in. | `observed-pass`; no persisted screenshot. |
| A Generate | E-05 | 375×812 | Generate Plan produces a scrollable plan with locked/ready state explanation. | Five-exercise plan rendered with locked later sets and vertical scrolling. | `observed-pass`; fixed-notice occlusion needs further scroll capture. |
| A Generate | E-06 | 375×812 | Validation/application errors expose visible recovery. | No generator error was safely induced. | `not-tested`; no error fixture or network fault was used. |
| A Generate | E-07 | 375×812 | Long content must scroll without horizontal overflow and keep the fixed notice away from required controls. | Workout and catalog scrolled vertically; no horizontal overflow observed. | `observed-pass` for scroll/no-overflow; `unresolved` for full reach and notice occlusion. |
| B Active workout | E-08 | 375×812 | Ready/work/locked states expose one clear next action. | Start Workout, ready Start set, work Confirm/Cancel, and locked explanations rendered. | `observed-pass`; collapse utility not separately tested. |
| B Active workout | E-09 | 375×812 | A second Start is refused while one work timer runs, with current active-set guidance. | Bench Press start was refused; status named active Barbell Curl set 1. | `observed-pass` for guard; captured through DOM, not persisted video. |
| B Active workout | E-10a | 375×812 | Cancel retires the conflict status when the work timer stops. | Set became actionable, but concurrent-start status remained after 1.2s. | `defect`; confirmed frozen-commit issue linked to TREK-201. |
| B Active workout | E-10b | 375×812 | Confirm/Rest replaces the conflict status with current rest state. | Rest state rendered, but concurrent-start status remained after 1.2s. | `defect`; confirmed frozen-commit issue linked to TREK-201. |
| B Active workout | E-10c | 375×812 | Undo retires the conflict status when the completed set is reopened. | Set became actionable, but concurrent-start status remained after 1.2s. | `defect`; confirmed frozen-commit issue linked to TREK-201. |
| B Active workout | E-11 | 375×812 | Finish while a timer runs is blocked with recovery guidance. | Finish was blocked with “finish or cancel” guidance in the shared status region. | `observed-pass` for blocking; `unresolved` for proximity beside Finish; interruption not tested. |
| B Active workout | E-12 | 375×812 | Zero-confirmation finish gives recoverable summary and disabled save. | 0/15 summary showed alert, disabled Save, and Back to workout. | `observed-pass`; incomplete path only. |
| B Active workout | E-13 | 375×812 | A confirmed set can finish and save, with saved history/reload behavior defined. | One confirmed set produced 1/18 summary; Save returned to Generator. | `observed-pass` for local save/return; `not-tested` for history visibility and reload verification. |
| B Active workout | E-14 | 375×812 | Collapse and interruption/resume preserve a clear active-set context. | No collapse or background/resume scenario was safely completed. | `not-tested`; browser harness limitation. |
| C Catalog | E-15 | 1280×800 | Dense catalog remains readable, scrollable, and separates destructive actions. | Centered readable catalog with vertical scroll and Edit/Deactivate controls. | `observed-pass` visually; hierarchy not measured quantitatively. |
| C Catalog | E-16 | 375×812 | Catalog form/list reflows without horizontal overflow; Add must remain reachable and clear of the fixed notice. | Single-column form; document width 360px against 375px viewport. | `observed-pass` for reflow/no-overflow; `unresolved` for Add reach and notice occlusion. |
| C Catalog | E-17 | 375×812 | Blank Add provides clear, proximal recovery guidance. | Native `required` exists; no visible inline message or custom focus guidance captured. | `unresolved`; native validation may have blocked submission. |
| C Catalog | E-18 | 375×812 | Add, Edit/Save, Deactivate/Reactivate preserve catalog recovery. | Synthetic entry was added, renamed/saved, deactivated, and reactivated. | `observed-pass`; emulator-only mutation cleared at teardown. |
| C Catalog | E-19 | 375×812 | Route exit with unsaved edits has explicit preservation/discard behavior. | No unsaved-edit exit was safely completed. | `not-tested`; no production data involved. |
| D Cross-cutting | E-20 | All tested viewports | Console errors are absent but never substitute for usability evidence. | No warning/error entries captured. | `observed-pass` technical-only; not a usability result. |
| D Cross-cutting | E-21 | Applicable widths | Offline/interruption, keyboard focus, 200% reflow, safe area, reduced motion, and 44×44 targets are classified explicitly. | These states were not safely verifiable in the selected browser harness. | `not-tested`; recorded limitation, not a pass. |

Reproduction metadata is the frozen build, named viewport, starting state, and action sequence recorded for each observed row. The active-timer branches are independently reproducible from E-09 → E-10a, E-10b, and E-10c; E-13 is reproduced by Generate Plan → Start Workout → Start set → Confirm → Finish Workout → Save workout. No screenshot files were persisted; live screenshots corroborated the textual observations.
