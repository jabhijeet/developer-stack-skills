---
name: loop-engineering
description: >
  Use this skill for iterative engineering work that should proceed through a disciplined
  plan, implement, verify, reflect, and repeat loop. Trigger for features, bug fixes,
  refactors, migrations, and other multi-step changes where evidence-driven checkpoints,
  bounded iterations, and explicit completion criteria reduce rework and risk.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-13
applies-to: Multi-step features, bug fixes, refactors, migrations, iterative delivery
---

# Loop Engineering Skill

## Purpose

Loop Engineering turns a broad engineering task into small, verifiable iterations:

**Plan → Implement → Verify → Reflect → Repeat**

Each loop should produce evidence, reduce uncertainty, and move the task toward an explicit
done state. The loop is not permission to churn indefinitely; use the smallest number of
iterations needed to satisfy the agreed success criteria.

## When to Use This Skill

Load this skill when the task involves:

- Implementing a feature across multiple steps or files
- Diagnosing and fixing a bug whose cause is not yet proven
- Refactoring while preserving existing behavior
- Migrating an API, dependency, schema, or architecture incrementally
- Improving reliability, performance, security, or maintainability with measurable evidence
- Recovering from a failed implementation or verification attempt

For a trivial, isolated edit with an obvious verification step, use one compact loop rather
than creating unnecessary process.

## Priority Order

1. Follow repository-local instructions, enforced automation, and established patterns
2. Load and follow the applicable stack and testing skills
3. Use this workflow to organize execution and evidence
4. Prefer the smallest safe change over speculative redesign

## Conflict Resolution

Use this precedence order when instructions conflict:

1. Existing repository code and enforced automation
2. Repository documentation and local agent instructions
3. Loaded project conventions
4. Loaded stack-specific and testing skills
5. This workflow skill
6. Generic engineering practices

## Before the First Loop

Establish a compact task contract:

- **Goal:** Describe the observable outcome, not merely the code to write
- **Success criteria:** List checks that prove the goal is met
- **Constraints:** Record compatibility, scope, security, performance, and time limits
- **Known facts:** Separate evidence from assumptions
- **Unknowns:** Identify uncertainties that could change the implementation
- **Baseline:** Capture current behavior or failing evidence when relevant

If critical information is missing and cannot be discovered safely from the repository,
ask one focused clarification before implementation.

## The Loop

### 1. Plan

Create the smallest next step that meaningfully reduces risk or delivers value.

- Inspect only the context needed for this iteration
- State assumptions that affect the design
- Identify files and behavior expected to change
- Choose a focused verification method before editing
- Define a stop condition for the iteration
- Avoid planning speculative later work in detail

A useful iteration should be independently understandable and usually small enough to review
as one coherent change.

### 2. Implement

Make a surgical change aligned with the plan.

- Preserve existing architecture and naming unless change is required
- Change only files needed for the current iteration
- Use current, stable, compatible APIs and dependencies
- Add or update tests with behavior changes
- Do not hide failures with broad catches, disabled checks, or weakened assertions
- Do not mix unrelated cleanup into the change

If implementation reveals that a core assumption is false, stop and return to planning rather
than forcing the original design.

### 3. Verify

Collect evidence at the narrowest useful level first, then broaden as risk requires.

Recommended order:

1. Syntax, formatting, or static analysis for touched files
2. Focused unit or component tests for changed behavior
3. Relevant integration or contract tests
4. Full regression suite when scope or risk justifies it
5. Build, package, or runtime smoke checks when applicable

For bug fixes, prove both sides when possible:

- The pre-fix condition reproduces or is represented by a failing regression test
- The post-fix condition passes without breaking related behavior

Report commands or checks run, their outcomes, and any checks that could not be run. Never
claim verification without evidence.

### 4. Reflect

Compare evidence with the iteration's expected result.

Ask:

- Did the change satisfy the iteration's stop condition?
- Which assumptions were confirmed or disproved?
- Did verification expose a new defect, risk, or missing requirement?
- Is the current solution still the simplest safe option?
- Did this reveal a reusable repository or environment lesson?

Classify the outcome:

- **Pass:** Evidence supports the expected result
- **Adjust:** Progress was made, but another bounded loop is needed
- **Replan:** A key assumption or approach was invalidated
- **Blocked:** External information, access, or infrastructure is required

Record durable lessons through the repository's reflection mechanism when one exists. Do not
record routine task narration as a reusable lesson.

### 5. Repeat or Stop

Start another loop only when a specific remaining gap exists. Carry forward:

- Confirmed facts
- Remaining success criteria
- New constraints or risks
- The next smallest hypothesis or change

Stop when all success criteria are supported by evidence, or when a blocker is stated with its
impact and the exact missing input.

## Loop Status Format

Keep status concise and evidence-driven:

```markdown
Iteration N
- Goal: [small observable outcome]
- Assumption: [important uncertainty]
- Change: [focused implementation]
- Verification: [check and result]
- Reflection: Pass | Adjust | Replan | Blocked — [reason]
- Next: [next bounded action or Done]
```

For long tasks, maintain a checklist and update it after each loop. Do not mark work complete
before verification succeeds.

## Guardrails (CRITICAL — Do Not Violate)

- **Never** skip evidence collection before calling work "complete" — no evidence = unverified
- **Never** set unrealistic success criteria that can't be verified — all criteria must be testable
- **Never** mix unrelated changes into a single loop — one coherent objective per loop
- **Never** weaken tests or requirements merely to make verification pass — fix the code instead
- **Never** suppress or ignore test failures — investigate every failure thoroughly
- **Never** accumulate unexplained failures across iterations — stop and replan
- **Always** preserve a passing baseline; never commit broken code to shared branches
- **Always** stop repeating an unchanged approach after failure — revise the hypothesis or escalate
- **Always** escalate blockers early — do not spend multiple loops stuck on unresolvable issues
- **Always** keep failed-attempt artifacts out of the final change unless they provide lasting value
- **Always** update the checklist after each loop for transparency and accountability
- **Never** claim iteration completion before verification succeeds — success criteria must be demonstrated
- **Always** distinguish verified facts from unverified assumptions in completion reports
- After repeated failed iterations (3+), stop and request clarification — churning is not progress

## Completion Contract

Before reporting completion:

- Every success criterion is satisfied or explicitly blocked
- Relevant tests and checks pass
- Changed files and observable behavior are summarized
- Assumptions and residual risks are stated
- No unrelated changes or temporary diagnostics remain
- Reusable lessons from non-obvious failures or environment quirks are recorded

A completion report should distinguish verified facts from unverified assumptions.
