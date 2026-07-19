# Private access operations

## Local owner administration

The local commands use the development-only Firebase Admin SDK with keyless,
impersonated Application Default Credentials (ADC). They never belong in the browser
bundle and must always receive an explicit Firebase project ID.

Before running either command, complete the production IAM and ADC setup described in
the approved private-access specification. In brief: use a dedicated access-admin
service account with `roles/firebaseauth.admin`, grant the owner
`roles/iam.serviceAccountTokenCreator` only on that service account, then sign in
with impersonated ADC:

```powershell
gcloud auth application-default login --impersonate-service-account=SERVICE_ACCOUNT_EMAIL
```

Approve or revoke exactly one user selector at a time:

```powershell
npm run approve-user -- --email person@example.com --project-id PROJECT_ID
npm run approve-user -- --uid FIREBASE_UID --project-id PROJECT_ID
npm run revoke-user -- --email person@example.com --project-id PROJECT_ID
npm run revoke-user -- --uid FIREBASE_UID --project-id PROJECT_ID
```

Approval adds the strict `approved: true` claim while retaining unrelated custom
claims. Revocation removes only `approved`. Both operations are idempotent and report
the selected project, user, and whether a mutation was made; they never print
credentials or token contents.

Do not use `GOOGLE_APPLICATION_CREDENTIALS`, download service-account keys, or commit
credential files. Remove local ADC when it is no longer needed:

```powershell
gcloud auth application-default revoke
```

Actual IAM configuration and production mutations are deferred to TREK-158. This
document will accumulate the later rules-deployment and rollout procedures.
