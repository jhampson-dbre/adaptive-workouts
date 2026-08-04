---
name: maintain-agent-workflows
description: Make minimal, anti-circular changes to this repository's agent prompts, AGENTS.md, agent TOMLs, role docs, workflow skills, gates, validators, or review routing. Use whenever changing agentic development workflows or responding to workflow feedback, especially when normal TDD or review rules could create duplicated instructions, wording tests, paperwork, or recursive review.
---

# Maintain Agent Workflows

Act as an independent policy maintainer. Do not treat the workflow being changed as
authority for how that change must be designed, implemented, or reviewed.

Start from an observed failure or requested outcome. Existing workflow text and prior
review findings are evidence, not acceptance criteria. Make no change when current
behavior already protects the outcome. Otherwise, choose the smallest rule change and
name the material safety, authority, evidence, or outcome risk it protects.

Distinguish policy from executable behavior:

- For prompt-only policy changes, edit directly and verify by tracing the actual loading
  and dispatch paths plus inspecting the resulting diff. Do not manufacture a failing
  test, implementor dispatch, planning artifact, or reviewer ladder.
- For executable parsers, validators, or routing code, use one focused behavior test that
  would fail for the defect. Test behavior, not prose, synonyms, ordering, or duplicated
  wording.
- Preserve ordinary application safeguards when application behavior, data, auth,
  security, deployment, or another material boundary actually changes.

Keep each instruction in one authoritative surface. Put always-on coordination
invariants in `AGENTS.md`, executable role behavior in the role TOML, and conditional
procedure in a skill or role document. Reference the authority briefly instead of
mirroring its prose. Delete superseded instructions and validators in the same change.

Reject mechanisms that exist only to prove process compliance: prose-regex or snapshot
tests, synchronized prompt assertions, mandatory skip records, empty dispositions,
review transcripts, evidence ledgers, and reruns on unchanged evidence. Add a role,
gate, record, validator, or durable artifact only when it prevents a concrete failure
that a simpler instruction or existing boundary cannot.

Finish with proportionate evidence: validate skill or configuration structure, run
focused tests only for changed executable behavior, and inspect the complete diff for
new duplication, conflicts, ceremony, and circular dispatch. Report the protected
outcome, the minimal mechanism, and any material residual risk; do not narrate every
workflow step.
