# TREK-315 Settings rendered evidence

Review date: 2026-08-08
Seeded private-access session: slot 2, `UX-10-01`, phone request `390x844`
Surface: authenticated Settings at `http://127.0.0.1:19153`

## Scenario evidence

| Contract | Rendered or interaction evidence | Supporting artifact |
| --- | --- | --- |
| Catalog is first and open on fresh mount | Four same-page job links precede the native disclosures; Catalog is the only open top-level disclosure after a fresh load. | `.impeccable/evidence/trek-315-settings-default-phone.png`, `.impeccable/evidence/trek-315-settings-default-desktop.png` |
| Catalog scan and filter recovery | Seeded active rows render alphabetically. Searching `zzzz` yields `0 exercises`, factual filtered-empty copy, and Clear filters. | `.impeccable/evidence/trek-315-catalog-no-results-phone.png`, `.impeccable/evidence/trek-315-catalog-no-results-desktop.png` |
| Inactive baseline and recovery | Deactivating a seeded exercise removes it from the baseline result set; Show inactive restores the row with Inactive status and exposes Clear filters. | `.impeccable/evidence/trek-315-catalog-show-inactive-phone.png` |
| Fast Add exercise flow | Add is a secondary native disclosure. Bodyweight selection reveals target reps just in time; Advanced remains optional; the factual summary reads `Tempo Push-Up / Chest / bodyweight`. | `.impeccable/evidence/trek-315-add-bodyweight-phone.png`, `.impeccable/evidence/trek-315-add-bodyweight-desktop.png` |
| Mounted draft across job switching | A `Tempo Push-Up` / bodyweight / 12-rep draft remained intact after opening Defaults and returning to Catalog; Add also remained open. | Browser interaction record from this session; Settings regressions cover the same lifecycle. |
| Defaults hierarchy | Recovery, Workout timing, and Schedule are separately headed and explained while retaining the existing rest, warmup, cooldown, and Leg Day controls. | `.impeccable/evidence/trek-315-defaults-groups-phone.png`, `.impeccable/evidence/trek-315-defaults-groups-desktop.png` |
| Superset Choose, Arrange, Review, Back | Choose reports `1 eligible member selected` for one active selection, does not misclassify the blank slot, excludes members assigned to another group, and keeps Next disabled. Disabled Next computes to neutral `rgb(229, 226, 217)` with `rgb(69, 69, 69)` text. Mixed 4-set/3-set members reached Arrange but could not advance: guidance named both members and focus returned to the first member selector. After choosing equal-set members, Review exposes only ordered member/set facts, compatibility, rest placement, Back, Cancel, and Save. No stale alert or editable select remains; Back returns to Arrange with both choices intact. | `.impeccable/evidence/trek-315-superset-choose-phone.png`, `.impeccable/evidence/trek-315-superset-choose-desktop.png`, `.impeccable/evidence/trek-315-superset-arrange-phone.png`, `.impeccable/evidence/trek-315-superset-review-phone.png`, `.impeccable/evidence/trek-315-superset-review-desktop.png` |
| Saved-order feedback outside a closed job | A real workout reorder was saved, Settings was opened, and the still-closed Saved exercise orders disclosure left `Order saved.` visible in the outside live region. The hidden panel contributed no duplicate live region. | `.impeccable/evidence/trek-315-closed-saved-order-feedback-phone.png` |
| Concurrent cross-area outcomes | With saved-order success still present, a later Catalog mutation visibly produced the composed outside message `Catalog: Catalog saved. Saved orders: Order saved.` instead of masking either truth. The focused component regression additionally verifies the deactivation-hidden announcement and results-heading focus. | `.impeccable/evidence/trek-315-combined-feedback-focus-phone.png` |
| Wayfinding contrast | Job links compute to `rgb(16, 16, 16)` on white; the current Superset step computes to `rgb(5, 5, 5)` on the yellow accent. | Final phone/desktop artifacts above plus browser computed-style inspection. |
| Narrow reflow and target geometry | At `320x844`, body and main scroll widths were both 305 px, matching the client width with no horizontal overflow. All four job links, all four top-level summaries, and the visible Add/Advanced summaries measured 45 px high. | `.impeccable/evidence/trek-315-settings-320.png` plus browser geometry inspection. |

## UX-315 matrix coverage and proportional exceptions

| Matrix row | Coverage |
| --- | --- |
| UX-315-01 | Direct phone and desktop default artifacts. |
| UX-315-02 | Direct filter interaction and desktop/phone filtered-state artifacts; focused derived-order regression. |
| UX-315-03 | Direct Clear filters interaction and filtered-state artifacts. |
| UX-315-04 | Direct filtered-empty and inactive show/hide artifacts; baseline-empty and inactive-only branches use the focused component regression because the fixed seeded scenario cannot truthfully remove the complete catalog without mutating the review fixture. |
| UX-315-05 | Direct inactive show/hide interaction; focused Edit/Deactivate/Reactivate, mutation-lock, hidden-focus, announcement, rollback, and retry regressions. |
| UX-315-06 | Direct bodyweight phone/desktop artifacts; simple and weighted mode branches use focused component regressions against the same mounted form and submit path. |
| UX-315-07 | Direct browser observation of mounted draft persistence; validation, failed-write retention, and retry use focused component regressions because private-access storage is intentionally healthy. |
| UX-315-08 | Direct phone/desktop Defaults artifacts; overlap, dirty, validation, failure, and retry semantics use focused component regressions. |
| UX-315-09 | Direct phone/desktop Choose and Review plus phone Arrange artifacts; focused save regression. |
| UX-315-10 | Direct incompatible Arrange, corrected Review, and Back observations; edit/failure/retry/remove/reactivate use focused component regressions. |
| UX-315-11 | Direct Add draft switch and real closed saved-order success; focused cross-job pending/success/failure and composed-feedback regressions. |
| UX-315-12 | Programmatic DOM/accessibility and focus observations plus focused keyboard/focus/ARIA regressions. Screenshots are not treated as proof of programmatic focus or screen-reader output. |
| UX-315-13 | Direct 320 px screenshot, no-overflow geometry, and 45 px target measurements. The 200% tooling limitation is recorded below. |
| UX-315-14 | Direct real saved-order closed success and composed cross-area feedback; clear confirmation and App-owned pending/indeterminate/failure/retry variants use focused Settings and App regressions rather than fabricating emulator failures. |

The coordinator accepts the focused rendered-component and integration tests above as the best safe evidence for states the fixed healthy private-access fixture cannot induce truthfully. This follows the repository rule to document unavailable rendered tooling and use a safe proportional alternative; no screenshot is claimed for an unobserved state.

## Automated support

- Focused Settings suite covers empty and inactive-only recovery, derived alphabetical order without persisted-order mutation, Edit/Deactivate/Reactivate, global mutation locking, focus recovery, Add validation and failed-save retention, Defaults overlap/retry semantics, Superset edit/remove/reactivate/save failure paths, disclosure switching, and App-owned preference outcome variants.
- App lazy-navigation suite covers preference operation ownership across Settings detours.
- Final command results are recorded in the TREK-315 completion comment.

## Constraints and limitations

- The private-access runner could not acquire slot 1 because port 19152 was already occupied. Slot 2 was acquired and verified independently; the unknown slot-1 process was left untouched.
- Screenshots use synthetic emulator data. No production credentials or production data were used.
- Browser keyboard zoom did not change the in-app browser's device metrics, so a distinct 200% zoom capture was unavailable. The required 320 px reflow check was completed with no horizontal overflow; this is a width stress check, not a substitute claim for text magnification.
