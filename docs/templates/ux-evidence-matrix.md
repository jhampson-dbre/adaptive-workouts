# Scenario-Indexed UX Evidence Matrix

Use this template for UX Quality Gate work. Keep one record per approved scenario
or evidence area. Classify the overall UI work as required, optional, or skip-recorded
(use the corresponding code values); optional and skip-recorded decisions are durable
planning decisions.

This matrix records evidence; it does not replace architecture review, user approval,
or Trekker ownership. Use only synthetic or de-identified local data. Request
representative synthetic or de-identified screenshots when safe so an independent
reviewer can reinspect the observation. If screenshots are not safe or useful, record
an explicit text-only rationale. Never require sensitive, personal, or production
evidence.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` / `optional` / `skip-recorded` |
| Applicability rationale | Why the gate applies, is optional, or is genuinely not applicable |
| Proportional artifact | Link or path to the scenario-indexed artifact; record its risk/depth rationale |
| Required UX design review | Reviewer handoff/status, or durable reason it is not required |
| Architecture authority | Architecture retains authority for system boundaries, data, security, and feasibility |

## Per-scenario record

| Field | Record |
| --- | --- |
| Scenario ID and name | Stable identifier and user outcome |
| Changed surface | UI surface or `none`; direct changed-surface findings block |
| Applicability | `applicable` / `genuinely-not-applicable` and rationale |
| Per-run capability probe | Harness, version/session, bounded safe probe, and result; re-probe every future required run and do not cache waivers |
| `capability_state` | `supported` / `partial` / `unsupported` |
| Unsupported metadata | For unsupported only: `capability_reason: unsupported-by-harness`; harness/version/session; eligible alternatives and selection rationale; bounded safe probe; limitation; fallback; residual risk; reactivation trigger |
| Evidence kind | `rendered-primary` / `rendered-proxy` / `component-test` / `source-audit` |
| Outcome | `observed-pass` / `defect` / `inconclusive` / `not-tested` / `static-risk` |
| Changed-surface routing | Direct changed-surface defect blocks; unrelated finding uses duplicate search and approved follow-up routing |
| Evidence obligation | `satisfied` / `unsatisfied` |
| Disposition | `blocking` / `nonblocking-residual` / `not-applicable` |
| Allowed recommendation | `rendered-usability-pass` / `evidence-complete-with-residual-capability-risk` / `needs-changes` / `blocked` |
| Build / commit | Build identifier and commit |
| Fixture / data revision | Fixture or data revision, if applicable |
| Requested and actual viewport | Requested viewport and actual viewport |
| Starting state | Initial route, authenticated state, fixture state, and preconditions |
| Action | User or test action |
| Observed result | What actually occurred, including recovery or feedback retirement |
| Evidence link and limitation | Screenshot/link when safe, or explicit text-only rationale; limitation and residual risk |

## Interpretation rules

- Static or proxy evidence may prove a defect but never a rendered usability pass.
- Partial capability requires rendered-primary evidence for the supported portion and
  the prescribed fallback for the unsupported portion.
- Unsupported capability is not established by one failed, flaky, fragile, or overly
  complex attempt; use tool documentation plus a bounded safe probe.
- Missing prescribed evidence blocks the task. A completed task is not reopened only
  because tooling later improves; the next required run performs its own probe.
