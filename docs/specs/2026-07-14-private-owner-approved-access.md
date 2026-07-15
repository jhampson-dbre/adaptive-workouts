# Private Owner-Approved Access

## Status

- Discovery brief and decision log: approved by the user.
- Architecture/design review: completed; all findings incorporated.
- Design: approved by the user.
- Implementation-plan conformance review: completed; all findings incorporated.
- Trekker creation and planning Task 1: approved by the user.
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
- Generation-guard asynchronous work so stale results cannot authorize after
  sign-out or an account switch.
- Deduplicate overlapping listener/retry evaluations and migration so migration
  cannot run concurrently for the same signed-in authorization session.
- Never call `migrateLocalData` for an unapproved user or after claim verification
  fails.
- Preserve the current behavior of logging migration failure and continuing only
  for a verified approved user.
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
- Add pending-access and verification-error surfaces using the existing application
  styling.
- Pending access exposes only the current user's own email and UID; it never exposes
  administrator or project configuration.

## Edge cases and limitations

- Approval becomes visible after forced refresh, normal refresh, or a new sign-in.
- After revocation, online server access can continue until the old ID token expires.
  The app reflects revocation after it successfully receives a refreshed token
  without the claim.
- A refresh failure does not prove revocation and therefore produces the fail-closed
  verification-error state.
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
10. Keep the rollout task open until all PR, deployment, and smoke evidence exists.

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

### Client gate

Tests cover:

- Missing, false, and non-boolean claims do not migrate or mount protected UI.
- Verification and refresh failures fail closed.
- Approved users migrate and enter the existing app.
- Forced refresh moves a pending user to authorized.
- A successful refreshed token without approval removes authorized UI.
- Sign-out and account-switch races cannot authorize a stale user.
- Overlapping token/retry events do not concurrently migrate.
- Migration runs at most once per signed-in authorization session.
- Pending/error identifiers, controls, and busy behavior work.
- Approved-user migration failure retains the existing continuation behavior.

### Verification boundaries

- Task 2: targeted admin tests, `npm run ci:lint`, and `npm run ci:build`.
- Task 3: red/green `npm run ci:rules` and `npm run ci:lint`.
- Task 4: targeted App auth tests and `npm run ci:check`.
- Tasks 2-4 each require fresh code and task-conformance review, a scoped commit,
  and a `Summary:` containing the commit and TDD evidence.
- Task 5 remains open until PR checks, deployment evidence, and the production smoke
  matrix are recorded.

## Acceptance criteria

- An unapproved user makes no migration/storage call from the app, and Firestore
  rules deny every read and write.
- An approved user retains existing application behavior and UID isolation.
- The owner can locally approve or revoke by email or UID without overwriting other
  claims.
- Pending users can obtain access with **Check again** after approval.
- Successful token refresh re-evaluates revocation.
- Async races cannot expose protected UI to a stale or unchecked identity.
- No credential key is downloaded or committed.
- No hosted backend or usage-billed runtime is introduced.
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

### Task 2: Add keyless local user approval administration

Artifacts:

- `scripts/user-approval-core.mjs`
- `scripts/manage-user-approval.mjs`
- `src/tests/user-approval.test.js`
- `docs/private-access-operations.md`
- `package.json` and `package-lock.json`

Implement the commands, production-wiring test seam, validation, explicit project
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
- `docs/private-access-operations.md`

Write the denial/allow matrix first, confirm it fails against the permissive rule,
then implement the strict claim check without unrelated policy changes. Document the
exact production deployment command and prerequisites. Complete locally after
`npm run ci:rules`, `npm run ci:lint`, fresh reviews, scoped commit, and `Summary:`.
Production deployment is deferred to Task 5.

### Task 4: Add the serialized fail-closed client access gate

Expected artifacts:

- `src/App.jsx`
- `src/utils/auth.js`
- `src/components/PendingApproval.jsx`
- `src/components/AccessVerificationError.jsx`
- `src/tests/App.auth.test.jsx` and focused adjacent component tests if useful
- `src/App.css` only if needed
- `docs/private-access-operations.md`

Write behavior and race tests first. Implement ID-token observation, helpers, the
five-state gate, strict claim evaluation, immediate invalidation, stale-result
protection, deduplication, once-per-session migration, accessible UI, and cumulative
documentation. Complete locally after targeted tests, `npm run ci:check`, fresh
reviews, scoped commit, and `Summary:`. Real Google/PWA/production checks are
deferred to Task 5.

Implementation discretion is limited to pure-helper extraction, test subdivision,
styling, and copy that preserves the approved meaning. The state list, strict claim
check, invalidation, race safety, migration boundary, and revocation/cache semantics
may not vary.

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
- Every smoke result.
- Operational deviations and disposition.
- Final `git status --short --branch`.

Keep the task `in_progress` or checkpointed until every deferred item exists. If
rollout finds a required repository correction, stop, return it to the applicable
implementation scope, and repeat task and cumulative reviews.

## Dependencies

- Task 2 depends on Task 1 because implementation cannot begin before the durable
  approved plan exists.
- Task 3 depends on Task 2 so owner tooling exists before enforcement progresses
  toward rollout.
- Task 4 depends on Task 3 so the client implements the tested server contract.
- Task 5 depends on Tasks 2, 3, and 4 because rollout requires all reviewed tooling,
  policy, client behavior, and documentation.

## Review notes

### Architecture/design review

Accepted and incorporated:

- Use impersonated service-account ADC rather than ordinary end-user ADC, Desktop
  OAuth configuration, or a downloaded service-account key.
- Serialize access states, invalidate protected UI immediately, guard stale results,
  and deduplicate migration.
- State precise token-expiry, successful-refresh, and offline-cache revocation limits.
- Pre-approve the owner and use security-first rules-before-app deployment.

Rejected findings: none. A second architecture review was not required after exact
incorporation.

### Senior-developer planning-conformance review

Accepted and incorporated:

- Tie rollout to an exact reviewed SHA so rules deploy before merge-triggered Vercel
  deployment.
- Test the actual Admin SDK entrypoint and initialization path, not only pure core
  logic.
- Assign cumulative operations-document ownership across Tasks 2-5.
- Make every task's verification and durable commit/Summary boundary explicit.
- Record complete PR, deployment, provenance, and smoke evidence in Task 5.

Rejected findings: none. Another planning-conformance pass was not required after
exact incorporation.

## Workflow feedback

No durable workflow issue was found during discovery, design, architecture review,
implementation planning, or planning-conformance review. No EPIC-6 follow-up is
needed.
