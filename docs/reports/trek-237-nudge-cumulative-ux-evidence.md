# TREK-237 Nudge cumulative UX evidence

## Scope and provenance

- Classification: `required`
- Integration base: merged `main` commit `a56f5ec`.
- Production direction: `PRODUCT.md`, `DESIGN.md`, and the accepted task artifacts named in the source reports below.
- Evidence policy: all rendered assets use synthetic local fixtures or the canonical emulator baseline. Historical concept and translation-bake-off material remains documentation evidence only and is not a production reference.

## Scenario index

| ID | Surface and state | Primary evidence | Result |
| --- | --- | --- | --- |
| CORE-01 | Plan, phone and desktop | `trek-233-plan-mobile-current.png`; `trek-233-plan-desktop-current.png` | Time and one yellow Plan action lead; optional constraints remain subordinate. |
| CORE-02 | Workout ready and active performance | `trek-233-workout-ready-mobile-current.png`; `trek-233-performance-header-390-current.png`; `trek-233-performance-390-current.png` | Start/Confirm is dominant, Cancel is neutral, and the phone heading does not overflow. |
| CORE-03 | Due leg-day choice | `trek-233-leg-day-choice-mobile-current.png` | Focus reaches the inline decision; both choices preserve agency without pressure copy. |
| CORE-04 | Early-finish guard | `trek-233-early-finish-mobile-current.png` | Remaining work is factual; Return remains primary and Continue is explicit. |
| CORE-05 | Cooldown and resume | `trek-233-cooldown-mobile-current.png` | Finish is dominant; Resume is neutral; remaining work is disclosed on demand. |
| CORE-06 | Review and saved acknowledgement | `trek-233-review-mobile-current.png`; `trek-233-save-ack-mobile-current.png` | Review is factual and saved feedback persists until an explicit next action. |
| REC-01 | Resumable draft | `trek-234-c-01-viewport.png` | Resume is emphasized; Discard remains explicit; heading focus and reflow hold. |
| REC-02 | Ownership conflict and timeout | `trek-234-conflict-actions-viewport.png`; `trek-234-timeout-actions-viewport.png` | Handoff leads while Retry and Exit remain available; failed retry retains state. |
| REC-03 | Invalid, stale, version, user, and project mismatch | `trek-234-malformed-viewport.png`; `trek-234-unsupported-version-viewport.png`; `trek-234-c-04-viewport.png`; `trek-234-wrong-user-viewport.png`; `trek-234-wrong-project-viewport.png` | Each outcome exposes only its safe discard or exit choice with factual copy. |
| REC-04 | Local recovery storage failure | `trek-234-c-05-viewport.png` | Calm blocking feedback exposes Exit without unsafe retry or takeover claims. |
| REC-05 | Save uncertainty, conflict, and retirement | `trek-234-reconcile-actions-viewport.png`; `trek-234-blocked-conflict-feedback-viewport.png`; `trek-234-saved-viewport.png` | Reconciliation choices stay explicit; saved transition retires stale feedback. |
| HIST-01 | Dense phone history | `trek-235-history-mobile.png` | Newest-first cards wrap without overflow and remain subordinate to the workout. |
| HIST-02 | Dense desktop history | `trek-235-history-desktop.png` | Phase durations use equal columns and shared focus remains visible. |
| HIST-03 | History 320px reflow | `trek-235-history-reflow-320.png` | Cards and set rows stack with `scrollWidth` equal to `clientWidth`. |
| HIST-04 | Keyboard traversal | `trek-235-history-keyboard-mobile.png` | Focus moves from disclosure to Load older in DOM order with a visible outline. |
| HIST-05 | Initial loading and offline recovery | `trek-235-history-loading-mobile.png`; `trek-235-history-error-mobile.png` | Loading is polite; failure keeps the workout available with one Retry alert. |
| HIST-06 | Older-page failure | `trek-235-history-older-error-mobile.png` | Loaded history remains and focus moves to Retry older workouts. |
| HIST-07 | Malformed saved workout | `trek-235-history-malformed-mobile.png` | The unavailable card avoids an invented completion claim. |
| HIST-08 | Empty history | `trek-235-history-empty-mobile.png` | A factual empty message appears without a fake recovery action. |
| HIST-09 | Exhausted history | `trek-235-history-exhausted-mobile.png` | A polite terminal message replaces pagination controls. |
| HIST-10 | Saved progression explanation | `trek-235-history-progression-mobile.png` | Existing saved recommendation data is reported factually without new coaching logic. |
| SET-01 | Settings hierarchy, phone and desktop | `trek-236-settings-mobile.png`; `trek-236-settings-desktop.png` | Defaults, Add, and Catalog follow the approved hierarchy; Add is the sole signal. |
| SET-02 | Settings 320px reflow | `trek-236-settings-reflow-320.png` | Controls stack and document `scrollWidth` equals `clientWidth`. |
| SET-03 | Invalid default rest | `trek-236-settings-invalid-mobile.png` | An inline alert explains the constraint and preserves the value for correction. |
| SET-04 | Dirty catalog edit | `trek-236-settings-edit-add-neutral-mobile.png`; `trek-236-settings-edit-mobile.png` | Add becomes neutral while Save is the sole yellow action; Cancel remains neutral. |
| SET-05 | Deactivate and reactivate | `trek-236-settings-inactive-mobile.png`; `trek-236-settings-reactivated-mobile.png` | Non-color status and reversible actions prove both inactive and restored states. |

Evidence assets are under `.impeccable/evidence/`. Full actions, viewports, observations, limitations, and task-level verification are recorded in:

- `docs/reports/trek-233-nudge-core-journey-ux-evidence.md`
- `docs/reports/trek-234-nudge-recovery-ux-evidence.md`
- `docs/reports/trek-235-nudge-history-ux-evidence.md`
- `docs/reports/trek-236-nudge-settings-ux-evidence.md`

## Production-boundary audit

- Production source has no import or runtime reference to `docs/reports/nudge-concepts`, `docs/reports/nudge-translation-bakeoff`, `.impeccable/mocks`, `.impeccable/sketches`, or `.impeccable/nudge-direction-options.json`.
- The stale generated "airport wayfinding / chosen challenger / seed" HTML comment was removed from `index.html`; concept and bake-off language now remains under documentation/evidence paths only.
- No EPIC-13 prototype component, experimental hook, route, stored field, package, or generated product-context module is present. The existing Timing harness remains explicitly non-production, script-addressable, and test-covered for recovery evidence.
- Runtime copy inspection found no EPIC-13 addition of gamification, guilt, fake urgency, simulated intimacy, readiness claims, or authoritative coaching language. Existing saved recommendation values retain their pre-redesign data meaning.

## Bounded integration verification

- `npm run ci:check` reached the Firestore emulator launch after 38 test files passed (673 tests passed, 18 skipped), lint passed, and the production/PWA build and bundle budgets passed. The bundled rules step could not bind its fixed `8080`/`9150` ports because an unrelated pre-existing Firestore emulator owned `8080`; that process was preserved.
- The identical Firestore rules suite was then run with the repository's isolated `firebase.emulator-test.json` ports (`18080`/`19150`): all 14 tests passed. `npm run ci:workflow` and `npm run ci:agent-models` also passed.
- The current production build emits a service worker, web manifest, both PWA icons, and a Workbox precache containing all three approved local font assets: `atkinson-hyperlegible-bold.ttf`, `atkinson-hyperlegible-regular.woff2`, and `barlow-condensed-bold.ttf`.
- The bundle contract rejects a build when any required font is absent from the final precache; its six focused Node tests pass. Font faces retain `font-display: swap` for a readable fallback while the local asset loads.
- The integration delta changes no rendered layout or interaction code. The 26 scenario rows above retain their task-level phone, desktop, 320px reflow, keyboard, loading, failure, recovery, and saved-state evidence; the current build continues to enforce the existing touch-target and overflow contracts.
- Device-specific Safari behavior and a true network-interruption session remain the documented limitations from the source reports; offline shell/font availability is verified from the generated production service worker rather than inferred from screenshots.
