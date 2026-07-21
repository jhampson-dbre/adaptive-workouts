# Private Owner-Approved Access

## Status

- Discovery brief and decision log: approved by the user.
- Architecture/design review: completed; all findings incorporated.
- Design: approved by the user.
- Implementation-plan conformance review: completed; all findings incorporated.
- Trekker creation and planning Task 1: approved by the user.
- Post-planning UX Quality Gate retrofit: TREK-244; the user approved the reconciled
  same-gate baseline architecture and 15-second access deadline. Final v2 reviews
  completed with no remaining findings before this planning task completed.
- Feature implementation: not yet authorized. Tasks 2-5 must remain `todo` until a separate, fresh approval.

## Problem

Any Google-authenticated account can currently initialize and use its own Firestore
subtree. A malicious account can therefore consume Firebase quota even though UID
isolation prevents access to other users' data. The application is intended for a
small private group whose members are approved personally by the owner.

## Goals

- Require the strict boolean custom claim `approved: true` before any protected UI,
  Firestore access, or local-data migration.
- Give unapproved users a clear pending-access workflow with refresh and sign-out.
- Provide local owner commands to approve and revoke users by email or UID.
- Preserve unrelated custom claims when approval changes.
- Use keyless, least-privilege local administrator authentication.
- Keep Firestore rules as the authoritative enforcement boundary.
- Avoid hosted runtime services, a Blaze-plan requirement, and new usage-based
  infrastructure.

## Non-goals

- Preventing Firebase Authentication account creation.
- Hosted functions, invitation links, invitation email, or an admin dashboard.
- App Check, request rate limiting, or unrelated Firestore schema hardening.
- Deleting Auth accounts or existing Firestore data.
- Immediate revocation of an already-issued ID token.
- Erasing data already downloaded into a device's persistent Firestore cache.

## User experience

1. A user signs in through the existing Google popup.
2. The app immediately enters an access-checking state and verifies the ID-token
   claim before calling storage code.
3. `approved: true` permits the existing migration and normal application
   experience.
4. A missing, false, or non-boolean claim shows an **Awaiting approval** screen with
   the signed-in email and UID plus **Check again** and **Sign out**.
5. **Check again** force-refreshes the ID token and re-evaluates access without
   requiring sign-out.
6. A claim-verification or refresh failure fails closed and shows **Unable to verify
   access**, with **Retry** and **Sign out**.
7. Initial auth settlement and every claim or forced-refresh evaluation have an
   app-owned 15-second deadline. A timeout uses the same **Unable to verify access**
   recovery; it never authorizes access or creates another state.

The owner uses one of these explicit, project-targeted commands:

```powershell
npm run approve-user -- --email person@example.com --project-id PROJECT_ID
npm run approve-user -- --uid FIREBASE_UID --project-id PROJECT_ID
npm run revoke-user -- --email person@example.com --project-id PROJECT_ID
npm run revoke-user -- --uid FIREBASE_UID --project-id PROJECT_ID
```

Commands report the target project and user plus whether a mutation occurred. They
never print credentials or token contents.

## Behavior rules

- Only the strict boolean `approved === true` authorizes access.
- Observe ID-token changes rather than auth-state changes alone, so successful token
  refreshes re-evaluate approval and revocation.
- Use explicit states: `signed-out`, `checking`, `pending`, `verification-error`, and
  `authorized`.
- Every non-null token event or manual retry immediately enters `checking` and
  unmounts protected components before asynchronous verification.
- Initial auth settlement and each claim or forced-refresh evaluation own a
  15-second logical deadline. The deadline starts with that generation, retires on
  settlement, supersession, sign-out, account switch, or unmount, and routes expiry
  to `verification-error` with existing **Retry** and **Sign out** actions.
- Generation-guard asynchronous work so stale results cannot authorize after
  sign-out, timeout, retry, token supersession, or an account switch. Late Firebase
  listener or promise results from an expired generation are ignored.
- Deduplicate overlapping listener/retry evaluations and migration so migration
  cannot run concurrently for the same signed-in authorization session.
- Never call `migrateLocalData` for an unapproved user or after claim verification
  fails.
- Preserve the current behavior of logging migration failure and continuing only
  for a verified approved user. This remains a console diagnostic only; the access
  gate adds no migration alert, toast, or recovery action.
- Normal and `DEV`+`baseline` modes use the same strict access-decision contract.
  Baseline mode may specialize synthetic sign-in, identity validation, fixture
  readiness, and focus presentation, but it may not bypass or duplicate
  authorization and may not read baseline Firestore data before strict approval.
- Only local Admin SDK tooling changes approval claims.
- Approval merges `approved: true` into existing custom claims.
- Revocation removes only `approved`, preserving every unrelated claim.
- Missing users, invalid arguments, credential failures, permission failures, and
  project-targeting errors exit nonzero without mutation.
- Exactly one of `--email` and `--uid` is required, as is an explicit `--project-id`.

## Data and security model

No Firestore document or collection is introduced. Existing rules become:

```javascript
allow read, write: if request.auth != null
  && request.auth.uid == userId
  && request.auth.token.approved == true;
```

Existing UID isolation, paths, and stored data remain unchanged. Revocation does not
delete the Auth user or their data.

The deterministic emulator baseline seeds its canonical synthetic Auth identity with
the strict boolean custom claim `approved: true`. Its ordering is:

1. Synthetic sign-in and fixed-identity validation.
2. The shared claim evaluation and 15-second generation deadline.
3. Approved-only baseline Firestore fixture verification.
4. Protected application mount.

The baseline retains its `DEV` plus explicit `baseline` mode guards, memory-only
caches, fixed `demo-project`, and production-build exclusion. Client, UID,
alternate-rules-file, or baseline-mode exceptions to `approved === true` are
forbidden. The existing Firestore data revision remains stable when data semantics do
not change. Export `BASELINE_AUTH_MARKER = 'emulator-baseline-auth-v2'` from
`scripts/emulator/fixtures/baseline.mjs` and store it at the exact fixture-provenance
path `baselineFixture.auth.contractRevision`. This marker is dev-only provenance, not
an ID-token claim and never an authorization input. The canonical emulator user's
custom claims contain strict `{ approved: true }`; only that strict boolean controls
authorization. Fixture validation, Admin import, post-seed lookup, client baseline
validation, integration tests, and production exclusion must agree on these separate
contracts. Production scanning rejects both the retired v1 and current v2 marker.

`firebase-admin` is development-only local tooling and is never imported into the
browser bundle. Administration uses a dedicated, project-local access-admin service
account without a downloaded private key:

1. Install and initialize Google Cloud CLI.
2. Enable the Service Account Credentials API.
3. Create a dedicated access-admin service account in the Firebase project.
4. Grant it `roles/firebaseauth.admin` on that project.
5. Grant the owner `roles/iam.serviceAccountTokenCreator` on that service account
   only.
6. Generate local ADC:

   ```powershell
   gcloud auth application-default login --impersonate-service-account=SERVICE_ACCOUNT_EMAIL
   ```

7. Initialize Firebase Admin with `applicationDefault()` and the command's explicit
   `projectId`.
8. Remove workstation credentials when appropriate with:

   ```powershell
   gcloud auth application-default revoke
   ```

Do not set `GOOGLE_APPLICATION_CREDENTIALS` or commit credential files. Impersonated
ADC is chosen over ordinary gcloud end-user ADC because Firebase Admin Authentication
does not accept credentials made with gcloud's default OAuth client. It is also
chosen over a Desktop OAuth workaround or service-account key because it uses
short-lived credentials and introduces no key file.

## UI surfaces

- Keep the existing login screen for signed-out users.
- Add a checking surface with an accessible heading and non-per-second verification
  status while protected UI is absent.
- Add pending-access and verification-error surfaces using the existing application
  styling.
- Pending access exposes only the current user's own email and UID; it never exposes
  administrator or project configuration.

## Planning UX Quality Gate

### Classification and artifact authority

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | The client task introduces a fail-closed access journey with new checking, pending, verification-error, authorization, refresh, revocation, and recovery states. These materially change task flow, hierarchy, feedback, and protected-content visibility. |
| Proportional artifact | This section is the authoritative scenario-indexed artifact. Four scenarios cover the client gate and production smoke obligations. The administration CLI and Firestore rules have no rendered user surface and remain governed by their security and operations contracts. |
| Planning artifact revision | `UX-ARTIFACT: private-owner-approved-access@v2`; authoritative location: this section of `docs/specs/2026-07-14-private-owner-approved-access.md`. This document is the only final design and implementation plan. |
| Planning wireframe status | `planning-only`; the compact wireframes below communicate intended hierarchy and are not rendered implementation evidence. |
| Required UX design review | Fresh `ux-design-reviewer` required against this artifact, the approved design, and the implementation plan before implementation authorization. |
| Architecture authority | Architecture retains authority for authentication, authorization, token, storage, migration, data, security, and deployment boundaries. Any UX finding that changes those boundaries returns to architecture/design review and user approval. |

### Shared access-gate interaction contract

The access gate has one job: establish whether the signed-in identity may enter the
private application, while keeping protected UI unmounted and providing a safe,
understandable next action when access cannot yet be granted.

Action hierarchy is state-specific:

1. **Signed out:** the existing Google sign-in action remains primary.
2. **Checking:** verification status is primary information; protected content and
   stale prior actions are absent during the app-owned 15-second asynchronous check.
3. **Pending:** **Check again** is primary and **Sign out** is secondary.
4. **Verification error:** **Retry** is primary and **Sign out** is secondary.
5. **Authorized:** the access surface retires and the existing application becomes
   the primary experience only after strict verification succeeds.

No destructive action is added. At the 375-CSS-pixel-wide reference viewport, the access-state
heading, explanation, identity details when applicable, and actions fit without
horizontal scrolling or obscuring the focused control. Email and UID wrap safely and
remain selectable without exposing project or administrator configuration. Busy
transitions prevent duplicate activation, retain an understandable verification
status, and do not leave stale pending/error messages actionable. Record the actual
viewport height; normal document scrolling must keep wrapped identity details and both
actions reachable without a nested scroll trap.

Feedback ownership and retirement are explicit:

- the access gate owns checking, pending, and verification-error status;
- the existing login surface owns sign-in failure feedback while signed out;
- approved-user migration failure retains the existing console-only diagnostic and
  continuation; the access gate does not add visible migration feedback;
- manual refresh or retry immediately retires the actionable pending/error surface
  into checking, and the next verified result owns the replacement state;
- sign-out retires signed-in identity details and returns to the existing login;
- account switch, token refresh, or revocation re-check immediately retires protected
  UI before asynchronous verification begins.

Focus destinations and timing are part of the approved contract:

- entering checking focuses its heading after the state commits, including from an
  authorized app, pending/error retry, account switch, restored session, or baseline
  synthetic sign-in;
- pending and verification-error results focus their respective headings after the
  destination surface mounts;
- authorization focuses the existing app's first contextual main heading when
  available, otherwise its programmatically focusable `main`; baseline mode may keep
  its existing generated-workout focus target after the same strict claim decision;
- sign-out focuses the existing Google sign-in action after Login mounts;
- a still-pending or repeated-error result refocuses the owning destination heading
  once, without an additional live-region echo or focus trap;
- stale or overlapping generations never move focus after their result is ignored.

Focus changes announce the new full-screen state without stealing focus during field
entry because pending and error surfaces contain actions but no editable form. The
checking status is not a per-second countdown; the 15-second deadline is an internal
fail-closed boundary.

Browser backgrounding, refresh delivery, overlapping token events, sign-out, and
account switch must never reveal protected content from a stale identity. Full page
reload follows the existing Firebase session restoration path through checking; the
gate does not promise offline revocation or retraction of already cached data.

### Scenario UX-10-01 — Verify sign-in and enter the private application

**Changed surface:** `App` authentication/access gate. **Applicability:**
`applicable`; this is the authorization journey's entry and success transition.

**Approved flow and states:** the existing Google sign-in remains unchanged. Initial
auth settlement and every non-null token event enter checking before any migration or
protected component can mount. Checking presents a stable verification status,
focuses its heading, and owns a 15-second deadline without exposing protected content.
Strict `approved === true` permits the existing migration boundary and then the
existing app. Migration failure for a verified approved user remains console-only and
continues into the app. Timeout enters verification error; late results cannot change
state or focus. Refreshing or restoring a session repeats checking before protected
UI appears.

In `DEV`+`baseline` mode, synthetic sign-in and fixed identity validation precede the
same shared strict claim decision. The canonical identity carries `approved: true`;
only then may baseline Firestore fixture verification run and the protected app mount.
The existing baseline checking/error presentation and production exclusion remain,
but neither is an authorization exception or a substitute for this scenario's gate
evidence.

```text
+ Private access
| Checking access…
| Verifying this signed-in account.
| (no protected navigation, workout data, or stale prior actions)

verified approved === true
  -> existing application mounts
```

| Evidence field | Planning record |
| --- | --- |
| Scenario ID and name | `UX-10-01` — Verify sign-in and enter the private application |
| Changed surface | `src/App.jsx` and the checking-state presentation introduced by TREK-157 |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `rendered-primary` planned, with component-test support |
| Outcome | `not-tested` |
| Changed-surface routing | A direct defect in protected-content suppression, state clarity, focus, reach, narrow-width layout, or the authorized transition blocks the task. |
| Evidence obligation | `unsatisfied` before execution |
| Disposition | `blocking` until required execution evidence is complete |
| Allowed recommendation | `blocked` before execution |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run`; use synthetic or de-identified signed-out, checking, timeout, approved, and migration-failure fixtures, including the claim-bearing baseline auth-contract revision |
| Requested and actual viewport | Requested 375 CSS px wide with recorded height; actual width/height `not-run` |
| Starting state | `not-run`; signed out, token received, or restored session with protected UI absent |
| Action | `not-run`; sign in, restore, refresh, time out, complete strict verification, and observe late-result suppression |
| Observed result | `not-run`; checking remains understandable, focus follows the approved destination, and protected UI mounts only after authorization |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence |

### Scenario UX-10-02 — Wait for approval and check again

**Changed surface:** pending-access screen. **Applicability:** `applicable`; this is
the primary recovery flow for an authenticated but unapproved user.

**Approved flow and states:** a missing, false, or non-boolean claim produces
**Awaiting approval** with only the signed-in user's email and UID. **Check again** is
the primary action and **Sign out** is secondary. Check again force-refreshes the
token, immediately enters checking, prevents overlapping activation, and resolves to
authorized, pending, verification error, or the same verification error on timeout.
Returning pending refreshes the current state without duplicating messages or
controls. Focus follows checking and the eventual destination headings. Sign out
clears identity details and focuses the existing Google sign-in action after login
mounts.

```text
+ Awaiting approval
| This account does not have access yet.
| Email: signed-in-user@example.test
| UID: synthetic-user-id-that-wraps-safely
| [Check again]
| [Sign out]
```

| Evidence field | Planning record |
| --- | --- |
| Scenario ID and name | `UX-10-02` — Wait for approval and check again |
| Changed surface | `src/components/PendingApproval.jsx` and its App integration |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `rendered-primary` planned, with component-test support |
| Outcome | `not-tested` |
| Changed-surface routing | A direct defect in identity privacy, action hierarchy, busy behavior, state transition, focus, wrapping, reach, or sign-out recovery blocks the task. |
| Evidence obligation | `unsatisfied` before execution |
| Disposition | `blocking` until required execution evidence is complete |
| Allowed recommendation | `blocked` before execution |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run`; use synthetic missing, false, non-boolean, newly approved, and still-pending claim fixtures |
| Requested and actual viewport | Requested 375 CSS px wide with recorded height; actual width/height `not-run` |
| Starting state | `not-run`; authenticated pending user with protected UI absent |
| Action | `not-run`; Check again, repeat while busy, resolve still-pending/approved/timeout, or Sign out |
| Observed result | `not-run`; only the current identity is shown, duplicate work is prevented, focus follows the approved contract, and each result owns one clear state |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence |

### Scenario UX-10-03 — Recover from an access-verification failure

**Changed surface:** verification-error screen. **Applicability:** `applicable`;
fail-closed verification needs a comprehensible recovery path.

**Approved flow and states:** verification or forced-refresh failure produces
**Unable to verify access** without treating the user as pending or revoked. **Retry**
is primary and **Sign out** is secondary. Retry immediately enters checking, prevents
overlapping activation, and resolves to the newly verified state. Repeated failure or
the 15-second deadline returns one current error surface and focuses its heading. The
message reveals no credentials, token content, administrator identity, project
configuration, or misleading revocation claim.

```text
+ Unable to verify access
| We could not verify this account right now.
| No access decision has been made.
| [Retry]
| [Sign out]
```

| Evidence field | Planning record |
| --- | --- |
| Scenario ID and name | `UX-10-03` — Recover from an access-verification failure |
| Changed surface | `src/components/AccessVerificationError.jsx` and its App integration |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `rendered-primary` planned, with component-test support |
| Outcome | `not-tested` |
| Changed-surface routing | A direct defect in fail-closed behavior, explanation accuracy, secret/config disclosure, action hierarchy, busy behavior, focus, reach, wrapping, or recovery blocks the task. |
| Evidence obligation | `unsatisfied` before execution |
| Disposition | `blocking` until required execution evidence is complete |
| Allowed recommendation | `blocked` before execution |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run`; use synthetic verification failure, refresh failure, timeout, late result, repeated failure, recovered pending, and recovered approved fixtures |
| Requested and actual viewport | Requested 375 CSS px wide with recorded height; actual width/height `not-run` |
| Starting state | `not-run`; authenticated verification error with protected UI absent |
| Action | `not-run`; Retry, repeat while busy, resolve failure/pending/approved, or Sign out |
| Observed result | `not-run`; the gate remains fail-closed, ignores late results, follows the focus contract, and provides one truthful recoverable state |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence |

### Scenario UX-10-04 — Remove access after refresh, sign-out, or account switch

**Changed surface:** authorized-to-checking transition and access-gate recovery.
**Applicability:** `applicable`; immediate protected-UI retirement is central to both
security and user understanding.

**Approved flow and states:** any relevant token event, sign-out, or account switch
invalidates the current authorization generation and unmounts protected UI before
asynchronous verification. A successful refreshed token without strict approval
lands on pending; a verification failure lands on verification error; sign-out lands
on login; a newly approved identity enters the existing app only after its own check.
Stale or overlapping completions never flash or remount the prior user's content.
The current generation's heading or authorized destination owns focus.
Background/offline limitations remain accurately described and no immediate server
token revocation or cache retraction is implied.

```text
existing private application
  -> token/account/sign-out event
  -> protected UI unmounted
  -> Checking access…
     -> Awaiting approval | Unable to verify access | Login | existing app
```

| Evidence field | Planning record |
| --- | --- |
| Scenario ID and name | `UX-10-04` — Remove access after refresh, sign-out, or account switch |
| Changed surface | `src/App.jsx` authorization lifecycle and destination access surfaces |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `rendered-primary` planned where harness-visible, with component-test evidence for bounded race timing |
| Outcome | `not-tested` |
| Changed-surface routing | A direct defect in immediate unmounting, stale-identity suppression, destination clarity, focus, or protected-content flash blocks the task. Proxy evidence may prove a defect but cannot produce a rendered usability pass. |
| Evidence obligation | `unsatisfied` before execution |
| Disposition | `blocking` until required execution evidence is complete |
| Allowed recommendation | `blocked` before execution |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run`; use synthetic approved, revoked, switched-account, signed-out, stale-result, and overlapping-event fixtures |
| Requested and actual viewport | Requested 375 CSS px wide with recorded height; actual width/height `not-run` |
| Starting state | `not-run`; authorized UI visible for a synthetic identity |
| Action | `not-run`; deliver refreshed claim, switch account, sign out, background/return, and resolve overlapping checks |
| Observed result | `not-run`; protected UI and stale focus retire before verification and only the current generation's destination appears and receives focus |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence |

### Task applicability and execution evidence obligation

- TREK-155 administration tooling and TREK-156 Firestore rules/baseline-fixture work
  have no rendered changed surface of their own. They remain security-critical and
  require their approved TDD, code, conformance, emulator, and operational
  verification; this artifact does not weaken or replace those gates. TREK-156 owns
  seeding and validating the strict baseline claim and proving strict rules-backed
  reads, not client-gate presentation.
- TREK-157 implements UX-10-01 through UX-10-04 and is `required` for per-run UX
  evidence. After simplification, the coordinator must perform a fresh bounded
  capability probe, instantiate the canonical matrix with every evidence concept in
  its own field, and record rendered evidence from the task build using synthetic or
  de-identified data. Preserve representative screenshots when safe; otherwise record
  an explicit text-only rationale and limitation.
- TREK-158 is operational confirmation, not a second UX evidence run. Against the
  exact reviewed production build, it references TREK-157's canonical matrix and
  records safe, owner-approved, redacted operational outcomes: approved login for
  UX-10-01; pending plus approval-refresh for UX-10-02; revoke-plus-successful-refresh
  and sign-out recovery for the safe portion of UX-10-04. UX-10-03 is not fault-
  induced in production; its record is the unchanged-build reference to TREK-157's
  canonical timeout/error/retry evidence and explicitly says `not-induced-in-production`.
  TREK-158 must not claim a new rendered-usability pass
  or expose email, UID, credentials, token contents, project configuration, or other
  sensitive data in screenshots or durable comments. If its build differs, a
  repository correction changes UI, or a new UX recommendation is sought, it becomes
  a new required run with its own fresh probe, canonical matrix, rendered evidence,
  and fresh usability review.

Missing prescribed rendered evidence blocks the applicable task and requires a
resumable `Checkpoint:`. Static or proxy evidence may prove a defect but cannot
produce a rendered usability pass. After TREK-157 simplification and
coordinator-owned rendered verification, dispatch a fresh `ux-usability-reviewer` in
parallel with the fresh code reviewer and task-conformance reviewer. Reviewers may
report defects but may not redesign or expand this approved artifact or grant product,
architecture, security, Trekker, rollout, or user-approval authority.

### UX scenario integrity and failure attribution

Every UX evidence run must distinguish an invalid evidence harness from a valid
product UX defect. The run records the build commit, artifact ID, stable scenario IDs,
scenario/manifest revision, Firestore fixture revision, baseline auth-contract
revision, harness/session, and requested/actual viewport.

Before a scenario can evaluate product behavior, a separate harness-owned preflight
must pass without depending on the product's expected DOM, action visibility,
protected-content suppression, or focus result:

1. Validate the scenario schema and exact registered revision against this artifact.
2. Validate the fixture and auth-contract revisions, strict claim, emulator project,
   and rules-backed readiness without using the rendered scenario's expected result.
3. Confirm through harness-owned Admin/emulator state and driver acknowledgements that
   the requested identity, claim/token event, timeout control, and network condition
   were staged; validate browser/session connectivity, viewport setup, registered
   driver commands, and capture instrumentation.
4. Record that preflight independently. Only then observe whether the product renders
   the approved surface, suppresses protected content, exposes the approved actions,
   moves focus correctly, and produces the approved result.

Failures are classified as follows:

- `harness-invalid`: scenario schema/revision, fixture, harness-owned state loader,
  driver command, Admin/emulator staging acknowledgement, viewport setup, or evidence
  capture instrumentation is wrong or cannot stage the requested inputs. Record
  outcome `inconclusive`, evidence obligation
  `unsatisfied`, disposition `blocking`, and recommendation `blocked`. This is not a
  product UX finding. Correct the harness to restore the already approved scenario,
  record the correction and rerun preflight plus the scenario.
- `ux-defect`: harness-owned preflight passed, but the product omits the approved
  surface/action, exposes protected content, moves focus incorrectly, cannot complete
  the approved user action, or otherwise diverges from the scenario contract. Record outcome
  `defect`, evidence obligation `unsatisfied`, disposition `blocking`, and
  recommendation `needs-changes`. Fix the product through the owning implementation
  task and rerun required verification and reviews.
- `unsupported-by-harness`: use only after the bounded capability probe and complete
  canonical unsupported metadata. It is neither a product pass nor a harness-invalid
  shortcut.

Changing a scenario's starting state, user action, expected result, stable ID,
evidence obligation, or routing to make a valid defect disappear is forbidden. Such a
semantic change requires a new artifact revision, fresh UX and architecture review as
applicable, and renewed user approval. A mechanical harness correction may retain the
scenario ID only when it restores the existing approved meaning; it must include a
targeted validator regression that rejects the broken revision or harness-owned
staging precondition. Classifier coverage must include both (a) an invalid manifest,
fixture, state loader, driver, or capture setup producing `harness-invalid` and (b) a
validly staged run whose intentionally defective product fixture omits an action,
chooses the wrong focus owner, exposes protected content, or returns the wrong result
producing `ux-defect`.

## Edge cases and limitations

- Approval becomes visible after forced refresh, normal refresh, or a new sign-in.
- After revocation, online server access can continue until the old ID token expires.
  The app reflects revocation after it successfully receives a refreshed token
  without the claim.
- A refresh failure does not prove revocation and therefore produces the fail-closed
  verification-error state.
- An initial listener, claim read, or forced refresh that does not settle within 15
  seconds produces the same verification-error state. A late result is ignored until
  the user retries or a newer token generation begins.
- Baseline bootstrap timeout and access-decision timeout have distinct ownership and
  diagnostics but neither authorizes access. Baseline Firestore verification never
  begins before the shared strict claim decision succeeds.
- An offline device may continue displaying previously cached data. Revocation
  cannot retract data already delivered to that device.
- Old PWA clients remain protected by server rules even if their UI does not
  understand the new pending state.
- Repeated approve/revoke operations are safe and do not erase unrelated claims.

## Migration and production rollout

There is no Firestore data migration and no billing-plan change.

The production sequence is tied to the exact reviewed commit because merging to the
main branch triggers Vercel deployment:

1. Configure keyless impersonated ADC and the dedicated access-admin service
   account.
2. Ensure the owner and intended existing users have Auth records, then approve
   them.
3. Reauthenticate or refresh the owner token and confirm the approved claim path
   before enforcement.
4. Run `npm run ci:check`, both cumulative final-integration reviews, push the
   reviewed branch, open the draft PR, and obtain passing checks.
5. Record the exact reviewed commit SHA.
6. After explicit production-rollout authority, deploy Firestore rules from that
   reviewed commit with an explicit production project ID.
7. Merge that unchanged reviewed SHA to trigger the Vercel application deployment.
8. Verify the production deployment corresponds to the reviewed SHA.
9. Run the approved, pending, approval-plus-refresh, and
   revoke-plus-successful-refresh smoke matrix.
10. Reference the unchanged-build TREK-157 evidence for verification-error/timeout
    recovery; do not induce production network/auth failure solely for UX-10-03.
11. Keep the rollout task open until all PR, deployment, and smoke evidence exists.

Rules-first deployment is intentional: old PWA clients must not retain permissive
server access. Existing sessions without refreshed claims may temporarily fail
between rule and application deployment.

## Testing strategy

### Local administration

The directly executable `scripts/manage-user-approval.mjs` exposes `main(argv, deps)`
or an equivalent dependency-injection seam so tests exercise production wiring.
Tests cover:

- `applicationDefault()` selection.
- Explicit `projectId` passed to `initializeApp`.
- Both npm aliases selecting the correct action.
- No mutation before argument and initialization validation succeeds.
- Exactly one user selector and a required project ID.
- Email and UID lookup.
- Approve/revoke idempotency and unrelated-claim preservation.
- Safe nonzero missing-user, credential, permission, initialization, and targeting
  failures.

### Firestore rules

Emulator tests cover:

- Unauthenticated access denied.
- Missing, false, and non-boolean approval denied for own root and subtree.
- Approved own root and subtree allowed.
- Approved cross-user access denied.
- The canonical baseline Auth identity carries strict `approved: true`, its auth
  contract marker distinguishes the claim-bearing fixture, and strict rules-backed
  baseline reads succeed only with that token.

### Client gate

Tests cover:

- Missing, false, and non-boolean claims do not migrate or mount protected UI.
- Verification and refresh failures fail closed.
- Initial auth settlement, claim evaluation, and forced refresh time out at 15
  seconds into verification error; timers retire on settlement/supersession/unmount,
  and late results cannot change state or focus.
- Approved users migrate and enter the existing app.
- Forced refresh moves a pending user to authorized.
- A successful refreshed token without approval removes authorized UI.
- Sign-out and account-switch races cannot authorize a stale user.
- Overlapping token/retry events do not concurrently migrate.
- Migration runs at most once per signed-in authorization session.
- Pending/error identifiers, controls, and busy behavior work.
- Checking, pending, verification-error, authorized, sign-out, retry, and
  account-switch transitions follow the approved focus destinations.
- Approved-user migration failure retains console-only continuation without a new
  access-gate message.
- Baseline synthetic sign-in and identity validation use the shared claim decision
  before Firestore fixture reads, with no client or rules bypass; existing baseline
  production exclusion remains proven.
- Dev-only emulator host parsing preserves current defaults, accepts the runner's
  alternate Auth/Firestore hosts, rejects malformed values, and cannot affect
  production configuration.
- The loopback scenario-control adapter passes through by default, acknowledges only
  registered/session-scoped actions, stages reject/hold at the auth-adapter boundary,
  never changes React state or expected outcomes, and is absent from production.
- Runner lifecycle tests pin `demo-project`, `firebase.emulator-test.json`, scratch
  profile, `seedProfile: 'test'`, temporary-state cleanup, emitted session metadata,
  Vite host injection, explicit shutdown, process-tree cleanup, and
  `exportScratch: false`.
- UX harness validators reject unknown scenario revisions, mismatched fixture/auth
  revisions, invalid starting-state preconditions, and unregistered scenario IDs.
- A negative-control evidence test proves a validated scenario reports a product
  defect when the observed result intentionally violates the approved expectation;
  harness-validation failures remain separately classified as inconclusive.

### Verification boundaries

- Task 2 / TREK-155: targeted admin tests, `npm run ci:lint`, and
  `npm run ci:build`.
- Task 3 / TREK-156: red/green `npm run ci:rules`, focused fixture/validator tests,
  `npm run test:emulator-baseline`, `npm run verify:baseline-production`, and
  `npm run ci:lint`.
- Task 4 / TREK-157: targeted App auth, baseline auth/bootstrap/focus, and access
  scenario-manifest tests; `npm run test:emulator-baseline`,
  `npm run verify:baseline-production`, `npm run ci:check`; a bounded
  `npm run ux:private-access -- start --scenario UX-10-XX --viewport WIDTHxHEIGHT` run for
  every registered scenario; and coordinator-owned
  rendered evidence for UX-10-01 through UX-10-04 after a fresh bounded harness
  probe.
- Tasks 2-4 each require a fresh implementor, the task-scoped simplification gate,
  final coordinator verification, fresh code and task-conformance review, a scoped
  commit, and a `Summary:` containing the commit and TDD evidence.
- Task 4 additionally requires the task-scoped simplification gate and, after
  coordinator-owned rendered verification, a fresh `ux-usability-reviewer` alongside
  code and task-conformance review. Missing prescribed evidence blocks completion.
- Task 5 remains open until PR checks, deployment evidence, and the production smoke
  matrix for UX-10-01 through UX-10-04 are recorded with redacted or de-identified
  evidence.

## Acceptance criteria

- An unapproved user makes no migration/storage call from the app, and Firestore
  rules deny every read and write.
- An approved user retains existing application behavior and UID isolation.
- The owner can locally approve or revoke by email or UID without overwriting other
  claims.
- Pending users can obtain access with **Check again** after approval.
- Access checks fail closed after the approved 15-second deadline and ignore late
  results from expired generations.
- Successful token refresh re-evaluates revocation.
- Async races cannot expose protected UI to a stale or unchecked identity.
- No credential key is downloaded or committed.
- No hosted backend or usage-billed runtime is introduced.
- The deterministic baseline uses a claim-bearing synthetic identity and the same
  strict access decision before any Firestore fixture read; production builds retain
  no baseline marker or path.
- UX evidence records independently validated harness/preflight provenance and cannot
  convert a valid product defect into a pass by changing scenario semantics.
- Automated tests, rules validation, lint, build, review, deployment, and smoke
  checks satisfy their stated completion boundaries.
- Operations documentation covers setup, IAM, commands, rollout, cleanup, and
  revocation/offline limitations.

## Persisted duration contract

Not applicable. This feature does not create, read, write, migrate, reuse, or change
persisted timing or duration data.

## Implementation plan

### Task 1: Establish the epic feature branch and durable approved spec

- Create or switch to `codex/private-owner-approved-access`.
- Save this approved document at
  `docs/specs/2026-07-14-private-owner-approved-access.md`.
- Commit only the planning artifact with
  `docs: add private owner-approved access plan`.
- Record the branch, spec path, and planning commit hash on the epic and in the task
  `Summary:`.
- Complete only Task 1. Leave Tasks 2-5 `todo` and require fresh implementation
  approval.
- Verification: branch/spec/commit/epic references/Summary agree; no unexplained
  worktree changes.
- TDD: none; planning artifact only.

### Post-planning gate: Apply the UX Quality Gate

**Trekker:** TREK-244

- Merge current `main` into the focused branch and reconcile changed auth, storage,
  and evidence-harness paths before implementation authorization.
- Maintain this file as the single authoritative, cohesive design spec and
  implementation plan. `UX-ARTIFACT: private-owner-approved-access@v2` is an inline
  section, not a competing specification.
- Complete fresh UX design review, targeted architecture confirmation, and
  senior-developer planning conformance; incorporate validated planning findings.
- Commit only the unified planning document and record its commit on EPIC-10 and in
  the TREK-244 `Summary:`.
- Add the implementation-only dependency `TREK-155 depends on TREK-244`, because the
  reviewed planning retrofit must complete before any product task can start. This
  does not make TREK-244 a product implementation task.
- Complete only TREK-244. Leave TREK-155 through TREK-158 `todo` and require separate
  fresh implementation authorization.

Verification is immediate: current `main` is an ancestor of the branch; the unified
spec, artifact ID, reviewed task/file scope, Trekker descriptions/dependencies,
planning commit, and Summary agree; workflow validators pass; no product file is
changed. TDD is not applicable to this planning-only retrofit.

### Task 2: Add keyless local user approval administration

Artifacts:

- `scripts/user-approval-core.mjs`
- `scripts/manage-user-approval.mjs`
- `src/tests/user-approval.test.js`
- `docs/private-access-operations.md`
- `package.json` for the approved `approve-user` and `revoke-user` aliases
- `package-lock.json` only if a concrete dependency-resolution change is required

Use the already installed development-only `firebase-admin`; do not reinstall or
change its resolution without a concrete dependency need. Implement the commands,
production-wiring test seam, validation, explicit project
targeting, impersonated ADC, lookup paths, idempotency, claim preservation, safe
errors, and owner documentation described above. Use failing tests first. Complete
locally after targeted verification, fresh reviews, scoped commit, and `Summary:`.
Actual IAM and production mutation are deferred to Task 5.

Implementation discretion is limited to helper names, internal module organization,
and concise console wording. No additional CLI dependency, downloaded key, hosted
runtime, implicit project selection, or claim-overwriting implementation is allowed.

### Task 3: Enforce approved access in Firestore rules

Artifacts:

- `firestore.rules`
- `src/tests/firestore.rules.test.js`
- `scripts/emulator/fixtures/baseline.mjs`
- `scripts/emulator/seed-baseline.mjs`
- `scripts/emulator/validate-fixture.mjs`
- `src/utils/baselineAuth.js` for marker/provenance validation only
- `src/tests/baselineAuth.test.js`
- `src/tests/emulatorFixture.test.js`
- `src/tests/emulatorBaseline.integration.test.js`
- `scripts/emulator/verify-baseline-production.mjs`
- `docs/private-access-operations.md`

Write the denial/allow matrix first, confirm it fails against the permissive rule,
then implement the strict claim check without unrelated policy changes. In the same
rules-contract task, seed and validate strict `approved: true` on the canonical Auth
emulator identity, advance the separate baseline auth-contract marker, and prove the
claim-bearing client token can perform the baseline's strict rules-backed reads. Do
not change the stable Firestore data revision unless its data semantics change, and
do not add a UID, client, alternate-rules-file, or baseline-mode exception. Move and
export `BASELINE_AUTH_MARKER` from the fixture module with exact value
`emulator-baseline-auth-v2`, persist it only at
`baselineFixture.auth.contractRevision`, and validate it as non-authorizing provenance.
Seed the Auth user with only the strict authorization claim `{ approved: true }` and
validate that claim during fixture validation, Admin import, post-seed Auth lookup,
client baseline validation, and real emulator integration. Update focused marker
tests and make production exclusion scan both `emulator-baseline-auth-v1` and
`emulator-baseline-auth-v2`. Document the exact production deployment command and
prerequisites. Complete locally after
`npm run ci:rules`, focused baseline fixture/integration tests,
`npm run verify:baseline-production`, `npm run ci:lint`, fresh reviews, scoped commit,
and `Summary:`. Production deployment is deferred to Task 5.

### Task 4: Add the serialized fail-closed client access gate

Expected artifacts:

- `src/App.jsx`
- `src/utils/auth.js`
- `src/utils/baselineAuth.js`
- `src/utils/baselineBootstrap.js`
- `src/components/Login.jsx`
- `src/components/AccessChecking.jsx`
- `src/components/PendingApproval.jsx`
- `src/components/AccessVerificationError.jsx`
- `src/tests/App.auth.test.jsx` and focused adjacent component tests if useful
- existing baseline auth, bootstrap, and focus tests
- `scripts/emulator/access-scenarios/manifest.mjs`
- `scripts/emulator/access-scenarios/preflight.mjs`
- `scripts/emulator/access-scenarios/validate-manifest.mjs`
- `scripts/emulator/access-scenarios/control-server.mjs`
- `scripts/emulator/access-scenarios/driver.mjs`
- `scripts/emulator/access-scenarios/run.mjs`
- `src/tests/accessScenarioManifest.test.js`
- `src/utils/accessScenarioControl.js`
- `src/tests/accessScenarioControl.test.js`
- `src/utils/firebase.js`
- `src/utils/firebaseMode.js`
- `src/tests/firebaseMode.test.js`
- `firebase.emulator-test.json` as the selected alternate-port config
- `scripts/emulator/verify-baseline-production.mjs` for scenario-control exclusion
- `package.json` for the `ux:private-access` runner alias
- `src/App.css` only if needed
- `docs/private-access-operations.md`
- `docs/emulator-baseline.md`
- `docs/evidence/epic-10/trek-157-private-access-ux-evidence.md`
- `docs/evidence/epic-10/trek-157/` for safe synthetic screenshots

Write behavior and race tests first. Implement ID-token observation, helpers, the
five-state gate, strict claim evaluation, immediate invalidation, stale-result
protection, deduplication, once-per-session migration, accessible UI, and cumulative
documentation while preserving `UX-ARTIFACT: private-owner-approved-access@v2`.
TREK-157's `src/utils/baselineAuth.js` ownership is limited to shared-gate sequencing
and runtime behavior; TREK-156 already owns the marker/provenance definition and
focused marker tests.
In `src/utils/auth.js`, keep Firebase primitives behind named helpers for ID-token
observation and strict token-result evaluation. The App-owned access controller owns
the current generation, one in-flight evaluation, and one cancellable 15-second
deadline; Firebase promises are not treated as cancellable, so only the current
generation may commit a result. Normal mode starts the initial-settlement deadline
when observation begins. Baseline mode completes synthetic sign-in and identity
validation before handing that user to the same claim-evaluation/deadline controller,
and it prevents the listener from racing ahead of that validation.
Implement one shared access-decision contract for normal and baseline modes. Baseline
synthetic sign-in and fixed-identity validation precede that decision; baseline
Firestore verification follows it. Add the app-owned 15-second initial-settlement and
claim/forced-refresh deadline, timer cleanup, generation invalidation, late-result
suppression, and the approved focus destinations. Preserve console-only migration
failure continuation and existing baseline production exclusion.
Create a dedicated access-gate manifest rather than changing the existing optional
history-scenario manifest. Register UX-10-01 through UX-10-04 under
`private-access-ux-scenarios-v1`, pin this artifact ID plus the fixture and auth
contract revisions, and add independent preflight/validator coverage for strict
claim/rules readiness, harness-owned starting-state input staging, and registered
driver commands/action identifiers without asserting product DOM or action visibility. The
preflight may use only the explicit `demo-project` Auth/Firestore emulators and must
drive the real shared access gate; direct React-state injection is proxy evidence.
Add a negative control that reaches a valid preflight but intentionally observes the
wrong product result so defect attribution is proven separately from harness
rejection. A harness correction may not change an approved scenario's semantics or
expected outcome.

The executable lifecycle starts with
`npm run ux:private-access -- start --scenario UX-10-XX --viewport WIDTHxHEIGHT`;
registered staging actions use
`npm run ux:private-access -- stage --session SESSION_ID --action ACTION_ID`.
`run.mjs` reuses the existing parent-owned `startEmulatorStack` lifecycle with exact
`projectId: 'demo-project'`, `configPath: 'firebase.emulator-test.json'`,
`profile: 'scratch'`, `seedProfile: 'test'`, and a per-run OS-temporary scratch
directory. It starts Vite in `baseline` mode on its owned strict port and passes the
selected Auth/Firestore hosts through dev-only
`VITE_FIREBASE_AUTH_EMULATOR_HOST` and
`VITE_FIRESTORE_EMULATOR_HOST`. `src/utils/firebase.js` parses those hosts only in
development, defaults to the existing 9099/8080 hosts when absent, and preserves
production behavior. Focused Firebase-mode tests cover defaults, valid injection, and
invalid-host rejection.

`control-server.mjs` is a loopback-only, session-ID-scoped control channel owned by
the runner. `driver.mjs` exposes only action IDs registered by the manifest for
Admin/Auth-emulator claim/token staging and for named auth-adapter controls. The
`DEV`+`baseline`-only dynamic adapter `src/utils/accessScenarioControl.js` wraps the
Firebase claim-evaluation dependency with pass-through, reject-next-evaluation, or
hold-next-evaluation behavior. It never sets React state, DOM, focus, authorization,
or expected results. Reject stages verification failure; hold lets the real App-owned
15-second deadline expire. The driver and control server emit a machine-readable
session/revision/action acknowledgement before product observation. The adapter and
control channel use marker `private-access-scenario-control-v1`; production builds
must exclude the marker and reject scenario-control configuration.

After startup the runner emits the session URL, ports, artifact/scenario/fixture/auth
revisions, viewport request, control-session ID, and preflight acknowledgement, then
stays alive until explicit coordinator shutdown or process termination. Shutdown
stops Vite, the loopback control server, and the owned emulator process tree; calls
`stack.stop({ exportScratch: false })`; and removes the per-run temporary directory.
It must not create another emulator implementation, persist scenario mutations, or
compete with `npm run test:emulator-baseline`. The runner/preflight never calls a
browser or evaluates product DOM/focus/outcomes.

After the bounded capability probe, the coordinator uses the available browser
harness to navigate the emitted URL, perform the approved actions, verify actual
viewport dimensions and capture safe synthetic evidence. Preflight and product
observations are recorded separately in
`docs/evidence/epic-10/trek-157-private-access-ux-evidence.md`; representative safe
screenshots live under `docs/evidence/epic-10/trek-157/`. If browser capture is
unsupported, the canonical unsupported metadata and explicit text-only fallback are
recorded instead of inventing a pass.
After the task-scoped simplification pass, the coordinator performs a fresh bounded
harness probe and records the canonical, separate-field rendered evidence for
UX-10-01 through UX-10-04 at the requested 375px viewport using synthetic or
de-identified data. Then run a fresh `ux-usability-reviewer` alongside fresh code and
task-conformance review. Missing prescribed rendered evidence blocks completion and
requires a resumable `Checkpoint:`. Complete locally after targeted tests,
`npm run ci:check`, required rendered evidence and reviews, scoped commit, and a
`Summary:` containing RED/GREEN, capability-probe, rendered-evidence, review, and
commit evidence, including separate harness-preflight and product-observation results.
Real Google/PWA/production checks are deferred to Task 5.

Implementation discretion is limited to pure-helper extraction, test subdivision,
styling, and copy that preserves the approved meaning. The state list, strict claim
check, 15-second deadline, shared normal/baseline decision, baseline ordering, focus
destinations, invalidation, race safety, migration boundary, and revocation/cache
semantics may not vary.

### Task 5: Roll out and verify private access in production

This task depends on Tasks 2-4 and is owned by the main coordinator and user. Do not
share ADC, IAM access, account identifiers, or production authority with subagents.

Follow the exact rollout sequence above. Invoke
`$epic-development-branch-completion`, complete both cumulative review gates, and
record:

- Reviewed commit SHA.
- Draft/ready PR URL and required checks.
- Redacted IAM/ADC setup confirmation.
- Explicit Firebase production project ID used for rules deployment.
- Rules deployment result.
- Vercel deployment reference and matching SHA.
- Test identities without credentials or token contents.
- The explicit operational mapping: UX-10-01 approved login; UX-10-02 pending and
  approval-refresh; UX-10-04 revoke-plus-successful-refresh and sign-out recovery;
  UX-10-03 `not-induced-in-production` with an unchanged-build reference to TREK-157's
  canonical verification-error/timeout/retry evidence. Screenshots are redacted or
  omitted under an explicit text-only rationale when safe independent reinspection is
  not possible.
- The TREK-157 canonical matrix reference and confirmation that the deployed SHA is
  unchanged from the reviewed evidence build, plus the exact scenario/manifest,
  fixture, and auth-contract revisions whose preflight passed. TREK-158 is operational
  confirmation and must not claim a second usability pass.
- Operational deviations and disposition.
- Final `git status --short --branch`.

Keep the task `in_progress` or checkpointed until every deferred item exists. If
rollout finds a required repository correction, stop, return it to the applicable
implementation scope, and repeat task and cumulative reviews. If the production build
differs, UI changes, or a new UX recommendation is requested, perform a new required
UX run with a fresh capability probe, canonical matrix, rendered evidence, and fresh
usability reviewer before rollout can complete.

## Dependencies

- TREK-155 depends on TREK-244 (`implementation-only`): implementation cannot begin
  until the current-main compatibility audit and unified reviewed plan are complete.
  TREK-244 itself follows the already completed durable-spec Task 1 and does not delay
  preservation of the original approved artifact.
- TREK-156 depends on TREK-155 (`implementation-only`): owner tooling must exist
  before strict rules and the claim-bearing emulator contract progress toward rollout.
- TREK-157 depends on TREK-156 (`implementation-only`): the client and rendered
  harness implement the already tested strict server and emulator claim contract.
- TREK-158 depends on TREK-155, TREK-156, and TREK-157 (`implementation-only`):
  rollout requires all reviewed tooling, policy, client behavior, UX evidence, and
  documentation. None of these dependencies authorize implementation or production
  operations by themselves.

## Review notes

### Architecture/design review

Accepted and incorporated:

- Use impersonated service-account ADC rather than ordinary end-user ADC, Desktop
  OAuth configuration, or a downloaded service-account key.
- Serialize access states, invalidate protected UI immediately, guard stale results,
  and deduplicate migration.
- State precise token-expiry, successful-refresh, and offline-cache revocation limits.
- Pre-approve the owner and use security-first rules-before-app deployment.

Rejected findings: none. At original planning time, exact incorporation did not
require another architecture pass.

### Post-planning UX and architecture reconciliation

After current `main` introduced the deterministic emulator baseline, the fresh UX
design review found that baseline auth/storage ordering and the absence of a bounded
normal access check were not represented in the original plan. Targeted architecture
review recommended, and the user approved:

- one strict access-decision contract for normal and baseline modes;
- a claim-bearing canonical emulator identity and approved-only baseline Firestore
  verification without client, UID, or rules exceptions;
- an app-owned 15-second initial-settlement and claim/refresh deadline using the
  existing verification-error recovery and generation guards;
- TREK-158 operational confirmation of TREK-157 evidence rather than a second UX
  recommendation; and
- console-only approved-user migration-failure continuation.

The user additionally required unambiguous failure attribution: validated scenario
observations may report product UX defects, while invalid scenario revisions,
fixtures, preconditions, automation, or capture are separately blocking
`harness-invalid` evidence failures. Implementors may repair a harness only to restore
the approved scenario contract and may not weaken expected behavior to make a defect
pass.

The inline `UX-ARTIFACT: private-owner-approved-access@v2`, task/file scope, tests,
dependencies, focus contract, and evidence obligations are the cohesive result.

The final fresh UX design review found no issues. It confirmed that harness preflight
is exclusively harness-owned; product DOM, actions, protected-content suppression,
focus, and outcomes are observations; paired negative controls distinguish
`harness-invalid` from `ux-defect`; and TREK-158's safe operational mapping does not
claim another UX pass.

Targeted architecture confirmation approved the shared gate, baseline ordering,
strict claim/rules boundary, deadline ownership, generation safety, focus contract,
migration behavior, production exclusion, and evidence split. Its sole planning-
specificity finding required the exact non-authorizing marker path and all definition,
test, seed, integration, and production-scan consumers to be owned by TREK-156. That
clarification is incorporated without changing approved architecture or requiring
renewed user approval.

The final senior-developer planning-conformance review found no remaining issues after
the executable access-scenario lifecycle was pinned: alternate emulator host wiring,
scratch ownership and cleanup, loopback auth-adapter failure staging, production
exclusion, exact commands, separate preflight/product observations, and durable
evidence paths are all explicit. Recommendation: ready for Trekker synchronization
and the planning-only commit; implementation remains unauthorized.

### Senior-developer planning-conformance review

Accepted and incorporated:

- Tie rollout to an exact reviewed SHA so rules deploy before merge-triggered Vercel
  deployment.
- Test the actual Admin SDK entrypoint and initialization path, not only pure core
  logic.
- Assign cumulative operations-document ownership across Tasks 2-5.
- Make every task's verification and durable commit/Summary boundary explicit.
- Record complete PR, deployment, provenance, and smoke evidence in Task 5.

Rejected findings: none. At original planning time, exact incorporation did not
require another planning-conformance pass.

## Workflow feedback

The post-planning retrofit exposed that the initial artifact draft did not inventory
auth, storage, and harness branches merged after the original planning commit.
Duplicate searches for `compatibility`, `retrofit`, and `baseline` found the completed
baseline epic/tasks and the EPIC-11 retrofit, but no open owner for a merged-main
compatibility audit requirement. Proposed follow-up:
`[Planning] Require merged-main compatibility audit for UX-gate retrofits` under
EPIC-6. Creating that workflow task is outside this planning revision unless the user
separately approves the backlog write; TREK-244 preserves the observation meanwhile.
