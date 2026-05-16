---
description: Review current branch changes against project conventions
allowed-tools: Bash(git:*), Read, Grep
---

Review changes in the current branch.

First, detect the repository's default branch by running: !`git remote show origin`

Then get the changed files and diff summary against that branch. Use `git diff <default-branch>...HEAD --name-only` and `git diff <default-branch>...HEAD --stat`. If the upstream tracking branch is set, prefer `git diff @{upstream}...HEAD`.

For each changed file review against:

**Code quality:**
- Follows stack conventions (layering, naming, injection patterns)
- No business logic leaked into wrong layer (controller, component)
- Error handling present and specific — no bare `catch (Exception e)` or bare `except:`
- No `any` in TypeScript, no mutable default args in Python

**Testing:**
- Tests added or updated for every behavior change
- At least one happy path and one failure path per change
- Tests assert behaviour, not implementation details

**project-conventions checklist:**
- No hardcoded secrets or credentials
- No `TODO` without a ticket ID
- No commented-out code
- PR is under 400 lines (warn if larger)
- Commit messages follow Conventional Commits format

Report findings grouped by: **Critical** (must fix) / **Warning** (should fix) / **Suggestion** (nice to have). Include file and line references.
