# Project-Native UX Quality Gate

Status: Approved, amended 2026-07-17

Date: 2026-07-17

Parent: EPIC-6 — Agent Workflow Improvements

Branch: `codex/epic-6-ux-quality-gate`

Frozen pilot commit: `ce5a389a01a8718f220d5766181aec0730c4832e`

## Summary

Add a risk-triggered UX workflow under the existing standing EPIC-6. Do not create a new epic and do not modify or reopen EPIC-11.

The workflow introduces:

- `$ux-quality-gate`, a project-native skill;
- a fresh `ux-design-reviewer` before architecture review;
- a fresh `ux-usability-reviewer` against rendered evidence after implementation;
- proportional UX artifacts covering task flow, action hierarchy, viewport placement, state lifecycle, and recovery; and
- static CI validation of workflow-contract consistency.

CI never runs agents, skills, browsers, LLMs, or external network tooling.

The design adapts selected practices from:

- [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design);
- [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines);
- [AccessLint](https://github.com/AccessLint/skills);
- [Bencium UX Designer](https://github.com/bencium/bencium-marketplace/tree/main/bencium-controlled-ux-designer); and
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).

React Best Practices and Composition Patterns remain conditional implementation guidance. React Native Skills are not adopted. No third-party UI/UX plugin is installed, executed, or copied.

## Goals

- Catch interaction, hierarchy, viewport, state-lifecycle, and recovery problems before user acceptance testing.
- Make UX rigor proportional to product risk rather than mandatory ceremony for every change.
- Give design reviewers an explicit gate before architecture approval and usability reviewers trustworthy rendered evidence after implementation.
- Preserve existing product, architecture, authorization, simplification, verification, and review boundaries.
- Detect drift between workflow documents, agent contracts, skill registration, and CI wiring without putting agent execution in CI.

## Non-goals

- Human-subject usability research.
- Accessibility certification.
- Security review.
- Product redesign outside approved intent.
- Production-data access, production mutations, or use of production credentials.
- Replacing architecture review, code review, task-conformance review, or user approval.

## UX Quality Gate Contract

### Classification

During discovery, classify UI work as one of:

- `required`: the full proportional gate applies;
- `optional`: the artifacts or reviews may be used when they improve confidence; or
- `skip-recorded`: the coordinator records why the gate does not apply.

The gate is required for material workflows, navigation or disclosures, mobile-critical interactions, action hierarchy, multi-state behavior, and visible feedback lifecycles. Recorded skips are allowed for copy-only work, isolated styling, documentation, generated output, and tiny mechanical changes.

### Proportional UX artifact

Required work provides one scenario-indexed artifact. It may be concise, but it must contain:

- the screen's single job;
- primary, secondary, destructive, and utility actions;
- action labels and expected viewport placement;
- a compact wireframe;
- meaningful state and action coverage;
- scroll, reach, interruption, and recovery behavior; and
- transient-feedback source, ownership, concurrency, and retirement.

The artifact must make the relationship between scenarios, screen states, actions, feedback, and recovery explicit. Its depth should track the risk and number of meaningful states rather than the size of the code diff.

### Design review ordering

For required work, a fresh `ux-design-reviewer` reviews the artifact before architecture review. Architecture retains authority over system boundaries, data, security, and technical feasibility. Material architecture changes that alter the approved UX contract return through UX design review before user approval.

### Implementation and rendered evidence

Implementors preserve the approved UX artifact and do not independently redesign the workflow. After implementation and the required simplification pass, the coordinator owns rendered verification using synthetic or de-identified local data and local emulators where applicable.

Evidence must cover the approved scenarios and identify the build, viewport, state, actions, observed result, and any limitation. Missing prescribed evidence blocks the task with a resumable `Checkpoint:`. Harness limitations use the capability-aware evidence contract below; static inspection cannot produce a rendered usability pass.

After coordinator-owned rendered verification, fresh UX usability, code, and task-conformance reviews run in parallel. A UX finding that changes approved product behavior, architecture, data, authentication, migration, or scope follows the existing clarification and escalation rules. Any changed final diff receives renewed verification and affected reviews.

### Evidence safety

- Use synthetic or de-identified local data only.
- Do not use production credentials, tokens, personal screenshots, or production mutations.
- Prefer existing local dependencies and Auth/Firestore emulators.
- Track every process started by the workflow and stop only those tracked processes.
- Validate temporary paths before removing a worktree or junction.

### Review boundary

UX review is expert heuristic review. It is not human research, accessibility certification, security review, or authorization to redesign approved behavior.

### Capability-aware evidence contract

For every applicable evidence area, follow this order: applicability, per-run capability probe, required evidence, outcome, changed-surface routing, evidence obligation, and recommendation. Record these dimensions separately:

- Applicability: `applicable` or `genuinely-not-applicable`.
- `capability_state`: `supported`, `partial`, or `unsupported`. An unsupported area also records `capability_reason: unsupported-by-harness`, the harness/version/session, eligible alternatives and selection rationale, a bounded safe probe, the limitation, fallback, residual risk, and reactivation trigger.
- Evidence kind: `rendered-primary`, `rendered-proxy`, `component-test`, or `source-audit`.
- Outcome: `observed-pass`, `defect`, `inconclusive`, `not-tested`, or `static-risk`.
- Evidence obligation: `satisfied` or `unsatisfied`.
- Disposition: `blocking`, `nonblocking-residual`, or `not-applicable`.

A failed, flaky, fragile, or overly complex attempt alone does not establish unsupported capability. Use tool documentation plus a bounded safe probe. Partial support requires rendered-primary evidence for the supported portion and the prescribed fallback for the unsupported portion. Unsupported capability requires the fallback and complete limitation metadata. Missing prescribed evidence blocks. Static or proxy evidence may prove a defect but never a rendered usability pass.

Any direct changed-surface defect or audit finding blocks regardless of evidence kind. An unrelated finding follows duplicate search and user-approved follow-up routing. Frozen EPIC-8 is the evaluation target, not the TREK-206 implementation surface; product findings are routed durably without changing EPIC-8 or EPIC-11. Re-probe capability on every future required run; do not cache waivers. Improved tooling does not retroactively reopen completed tasks.

Allowed recommendations are:

- `rendered-usability-pass`: every applicable obligation has a rendered-primary pass and no blocking finding.
- `evidence-complete-with-residual-capability-risk`: every capability-specific obligation is satisfied, at least one applicable portion remains partial or unsupported, and no direct changed-surface defect exists.
- `needs-changes`: a concrete direct changed-surface defect or source/proxy audit finding exists.
- `blocked`: prescribed evidence is missing, remains inconclusive without a satisfied prescribed fallback, or a mandatory scenario cannot be completed safely and determinately.

The coordinator owns the capability matrix and Trekker routing. The UX reviewer validates evidence and recommendation, the code reviewer validates source and proxy evidence, and the spec reviewer validates conformance. No reviewer may promote static or unsupported evidence to a rendered pass or expand product scope.

Use these fallbacks when the harness cannot provide primary rendered evidence:

- Sequential keyboard: semantic DOM, native roles, `tabIndex`, disabled/hidden state, and focus logic source audit plus focused component tests; record reliable rendered focus-indicator observations separately.
- Browser zoom: use half the representative CSS width, record requested and actual width, and use the smallest reliable width if clamped. Inspect overflow, clipping, overlap, reachability, and fixed-element occlusion. Label it a reflow proxy, not actual zoom.
- Notched safe area: when fixed or sticky edge UI or PWA presentation applies, inspect `viewport-fit`, `env(safe-area-*)`, offsets, padding, and overlays, plus rectangular-viewport reachability. Missing accommodation is `source-audit` / `static-risk`.
- Reduced motion: inventory rendered transitions and animations and inspect CSS/JavaScript preference handling. Missing accommodation is `source-audit` / `static-risk`.

Saved-history reload and active-workout resume remain mandatory rendered scenarios. Use the same emulator processes, app build/server, browser profile/session, synthetic identity, and stable UID throughout. For history, save a workout, observe an identifiable history entry, reload without restarting or clearing authentication, and observe the same entry. For interruption/resume, start a new workout and set timer, reload without restarting, and observe the same identifiable active context or an already-approved user-visible explanation with actionable recovery or exit. Emulator restart, authentication loss, sign-in fallback, silent reset, or ambiguity does not satisfy these scenarios.

## Verification Matrix

Apply scenarios in proportion to the changed surface and approved artifact:

- 375px and 390px widths for mobile-critical surfaces;
- changed responsive breakpoints and one representative wider viewport;
- long or dense content;
- error and offline behavior;
- interruption and resume behavior;
- concurrent states;
- keyboard navigation and focus recovery;
- 200% zoom and reflow;
- applicable safe-area and reduced-motion behavior;
- 44×44 CSS-pixel touch targets or documented contextual exceptions; and
- feedback/status teardown after success, correction, cancellation, Undo, completion, or route exit.

## Static CI Contract

Add `scripts/validate-ux-quality-gate.mjs` using Node built-ins. The validator checks only:

- required paths and registrations;
- synchronized concepts across Markdown and TOML role contracts;
- reviewer model and fallback policy;
- discovery, planning, execution, and review ordering; and
- package and GitHub Actions workflow wiring.

Expose the validator as `npm run ci:workflow`, include it in `ci:check`, and add an explicit static workflow-contract step to `.github/workflows/ci.yml`. The validator and CI must not invoke agents, skills, browsers, LLMs, or external network tooling.

## Implementation Plan

All work remains under EPIC-6. Dependencies are strictly serial:

```text
TREK-204 → TREK-205 → TREK-206 → TREK-207 → TREK-208 → TREK-209
```

### TREK-204 — Establish the branch and approved workflow spec

- Create `codex/epic-6-ux-quality-gate` from current `main`.
- Save this approved design and six-task plan at `docs/specs/2026-07-17-ux-quality-gate-workflow.md`.
- Commit only the planning artifact.
- Record the branch, spec path, and planning commit on EPIC-6.
- Complete only this task. Leave Tasks 2–6 `todo`.

### TREK-205 — Create the foundation and CI contract validation

- Create `$ux-quality-gate` and its `agents/openai.yaml` registration.
- Add synchronized Markdown/TOML contracts for `ux-design-reviewer` and `ux-usability-reviewer`.
- Configure reviewer TOMLs for `gpt-5.6-sol` with high reasoning and document `gpt-5.6-terra` with high reasoning as the nearest-tier fallback.
- Add the Node-built-in static validator and wire `ci:workflow`, `ci:check`, and the explicit GitHub Actions step.
- Develop the validator RED/GREEN.
- Run mandatory simplification, verification, and fresh code and task-conformance reviews.

Verification:

```powershell
node --check scripts/validate-ux-quality-gate.mjs
npm run ci:workflow
npm run ci:check
git diff --check
```

### TREK-206 — Pilot against frozen EPIC-8

- Depend on TREK-205.
- Pin `ce5a389a01a8718f220d5766181aec0730c4832e` as post-EPIC-8/pre-EPIC-11.
- Use a resolved GUID-named detached worktree outside the workspace; never use the paused EPIC-11 checkout.
- Install nothing. Use existing dependencies and existing Auth/Firestore emulators with a synthetic Google-provider identity.
- Run fresh UX design and rendered-usability reviews at applicable widths and states.
- Produce `docs/reports/2026-07-17-ux-quality-gate-epic-8-retrospective.md` and non-sensitive evidence.
- Record known issues caught, false positives, false negatives, retrospective bias, and evidence cost.
- Apply the capability-aware evidence contract to sequential keyboard, browser zoom, notched safe area, and reduced motion. Unsupported capability is nonblocking only when its prescribed fallback and metadata satisfy the evidence obligation.
- Run saved-history reload and active-workout resume in one uninterrupted emulator, build/server, browser, authentication, and synthetic-identity lifecycle.
- If prescribed evidence is missing, or either uninterrupted rendered scenario is ambiguous or loses authentication, leave the task blocked with a resumable `Checkpoint:` and prevent Tasks 4–6 from starting.
- Stop only tracked processes and remove only the validated temporary worktree or junction.

Pilot coverage includes the proportional items in the verification matrix, with particular attention to long/dense, error, offline, interruption/resume, concurrent, keyboard/focus, zoom/reflow, safe-area, reduced-motion, touch-target, and feedback-retirement states.

### TREK-207 — Integrate into discovery and feature design

- Depend on TREK-206 and consume its findings.
- Update discovery, feature planning, feature-planner, architecture-reviewer, and senior-reviewer contracts.
- Update planning/design sections of `AGENTS.md` and the main-coordinator contract.
- Preserve architecture authority and user approval boundaries.
- Create the canonical `docs/templates/ux-evidence-matrix.md` taxonomy and integrate only planning/core workflow sections in this task. Begin validator changes with a failing RED assertion.
- Extend the validator RED/GREEN for classification, UX artifacts, review ordering, and escalation.
- Run mandatory simplification and fresh code and task-conformance reviews.

Verification:

```powershell
node --check scripts/validate-ux-quality-gate.mjs
npm run ci:workflow
git diff --check
```

### TREK-208 — Integrate into task execution and review

- Depend on TREK-207.
- Update execution/review sections of the workflow and main-coordinator contracts.
- Update synchronized implementor, simplifier, code-reviewer, and spec-reviewer Markdown/TOML pairs.
- Require implementors to preserve approved UX artifacts rather than redesign.
- Require coordinator-owned rendered evidence and parallel UX, code, and task-conformance reviews.
- Integrate the canonical capability-aware taxonomy into execution and reviewer contracts only, and begin validator changes with a failing RED assertion.
- Preserve existing clarification, escalation, simplification, and re-review rules.
- Extend the validator RED/GREEN with execution-contract assertions, then simplify and review.

Verification:

```powershell
node --check scripts/validate-ux-quality-gate.mjs
npm run ci:workflow
git diff --check
```

### TREK-209 — Validate the branch and publish a draft PR

- Depend on TREK-208.
- Invoke `$epic-development-branch-completion`.
- Verify task commits and `Summary:` comments and inspect the cumulative `main...HEAD` range.
- Run static workflow validation and the full repository CI gate.
- Run fresh epic and epic-conformance reviews.
- Push and open a draft PR.
- Keep the task open until required GitHub checks have final passing evidence.
- Keep standing EPIC-6 open and never close or modify EPIC-11.

## Approval Boundary

Approval of this plan authorizes creation of TREK-204 through TREK-209 and execution of TREK-204 only. TREK-205 through TREK-209 remain `todo`. Starting TREK-205 requires separate fresh user approval after TREK-204 is committed and summarized.

The frozen EPIC-8 replay validates the workflow only and creates no product authority. Static CI guards contract drift; it does not perform UX review.
