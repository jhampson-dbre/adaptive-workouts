---
name: ux-quality-gate
description: Apply the approved, risk-proportional UX workflow to material UI work. Use for discovery, planning, and review decisions about interaction flow, hierarchy, viewport placement, state lifecycle, feedback, and recovery.
---

# UX Quality Gate

During discovery, classify UI work as `required`, `optional`, or `skip-recorded`. Required work needs a scenario-indexed UX artifact covering the screen's single job, action hierarchy and placement, compact wireframe, meaningful states, scroll/reach/interruption/recovery behavior, and transient-feedback ownership and retirement.

For required work, dispatch a fresh ux-design-reviewer before architecture-design-reviewer. The UX design reviewer assesses the approved UX artifact; architecture review retains authority for system boundaries, data, security, and feasibility. Material architecture changes that alter the UX contract return through UX design review before user approval.

After implementation and the required simplification pass, the coordinator performs coordinator-owned rendered verification using synthetic or de-identified local data. Record the build, viewport, state, actions, observed result, and limitation for each approved scenario. Static inspection cannot produce a usability pass.

After rendered verification, the fresh ux-usability-reviewer, code reviewer, and task-conformance reviewer run in parallel. UX review is heuristic review, not human research, accessibility certification, security review, or authorization to redesign approved behavior.

## CI Boundary

The static validator checks paths, registration, synchronized concepts, model policy, ordering, and package/workflow wiring only. It must not invoke agents, skills, browsers, LLMs, or external network tooling.
