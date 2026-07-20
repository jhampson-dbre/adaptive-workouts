# Deterministic Emulator Workflows

These workflows use Firebase demo project `demo-project` and synthetic local data.
They never read or write production Firebase data.

## Choose the right workflow

| Goal | Command | State and sign-in behavior |
| --- | --- | --- |
| Normal app development | `npm run dev` | Existing Vite behavior. Emulator Google sign-in remains popup-based, browser caches remain persistent, and development PWA behavior is unchanged. |
| Resettable canonical emulators | `npm run emulators` | Clears Auth and Firestore, seeds and verifies the fixed identity, settings, 15-exercise catalog, and empty history. Never imports or exports mutable state. |
| Mutable scratch emulators | `npm run emulators:scratch` | Imports `.firebase/emulator-scratch/` when valid, otherwise initializes it from the canonical fixture with profile `scratch`. Clean Ctrl+C shutdown exports mutations. |
| Popup-free canonical browser | `npm run dev:baseline` | Owns canonical emulator startup and Vite on strict port 5174. Uses the fixed synthetic Google identity, memory-only Auth and Firestore caches, and no development service worker. Do not start another emulator command first. |
| Load dynamic scratch history | `npm run emulators:scenario -- <scenario> --reference-date YYYY-MM-DD` | Replaces only the fixed scratch/test user's history in one bounded transaction. Settings and catalog remain unchanged. |

The fixed local identity is `peach.otter.880@example.com` with Firebase UID
`emulator-baseline-user`. It is development-only and is rejected from production
build output.

## Canonical and baseline-browser use

Use `npm run emulators` when another local client or test needs a known empty
baseline. The command does not launch Vite.

Use `npm run dev:baseline` for the recommended popup-free browser workflow. Wait for
the parent command to report emulator verification and Vite readiness, then open
`http://localhost:5174`. The first paint prepares and verifies the baseline before
the existing Generate screen is exposed. Login must not flash and no Auth popup
should open.

The baseline browser is intentionally isolated:

- every launch resets canonical Auth and Firestore state;
- Auth persistence and Firestore cache are memory-only;
- reload reauthenticates and revalidates the fixture;
- the canonical profile always has empty history; and
- browser mutations are not exported.

## Scratch and scenario use

### Private-access scenarios

`npm run ux:private-access -- start --scenario UX-10-XX --viewport WIDTHxHEIGHT` owns a scratch emulator stack and stages the canonical Auth user's exact claim state before Vite starts. `UX-10-02` starts pending and accepts `approve-user`; `UX-10-03` accepts `reject-next-evaluation`, `hold-next-evaluation`, or `pass`; `UX-10-04` accepts `revoke-user`, `approve-user`, or `pass`. Stage actions through the session returned by `start`; claim actions are read back from the owned Auth emulator, while only reject/hold actions are delivered once to the baseline evaluator.

Start the scratch owner in terminal 1:

```powershell
npm run emulators:scratch
```

In terminal 2, point the loader at the owned local emulators and load one scenario.
Use the current local calendar date for manual evidence runs.

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
npm run emulators:scenario -- weighted-progression --reference-date 2026-07-18
```

Available stable scenarios are:

- `weighted-progression`
- `pivot-rotation-staleness`
- `recent-primary-leg-suppresses-tier4`
- `tier4-quota-closed-open`

The reference date means noon on that calendar date in the invoking machine's
system timezone. Repeating a scenario and reference date is idempotent. Changing the
reference date shifts every scenario timestamp while preserving its relative ages
and expected algorithm outcome.

To inspect a scenario in the existing UI, keep the scratch emulator command running,
start `npm run dev` in another terminal, and sign in through the normal local Auth
emulator flow with the fixed synthetic identity. Scenario applicability is
proportional: use only scenarios relevant to the changed surface. The revisioned
manifest at `scripts/emulator/scenarios/manifest.mjs` supplies setup, actions,
expected internal and visible outcomes, viewport/state coverage, and fields for the
canonical UX evidence matrix.

## Shutdown and recovery

Press Ctrl+C in the terminal that owns the stack. The parent coordinates child
shutdown; scratch mode exports only on this clean shutdown. Do not terminate
individual Firebase or Vite child processes.

If startup fails:

- Occupied port: stop the command that owns the reported port, then rerun the single
  intended owner.
- Canonical identity, revision, or catalog mismatch: stop the owner and rerun
  `npm run emulators` or `npm run dev:baseline`; do not repair canonical data by hand.
- Baseline browser error: use `Retry baseline` once for a transient failure. If the
  same failure persists, stop the owning command, rerun `npm run dev:baseline`, and
  reload after Vite reconnects. There is no production-login fallback.
- Corrupt scratch export: the command fails rather than silently discarding mutable
  state. Preserve the directory for diagnosis, or intentionally remove
  `.firebase/emulator-scratch/` only when its mutations may be discarded, then rerun
  scratch initialization.
- Scenario refusal: confirm the user document profile is `scratch` or `test`, the
  exact scenario name and reference-date format are used, and the scratch history is
  below the conservative transaction bound. Reset scratch state if the loader gives
  the bounded-history or transaction-retry recovery message.

## Verification commands

```powershell
npm run test:emulator-baseline
npm run verify:baseline-production
npm run ci:check
node scripts/emulator/scenarios/validate-manifest.mjs
node scripts/emulator/access-scenarios/validate-manifest.mjs
```

`verify:baseline-production` proves normal production output contains none of the
fixed identity, fixture, or private-access scenario-control markers and rejects a baseline-mode production build.
