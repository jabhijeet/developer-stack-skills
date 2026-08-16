---
name: project-review
description: >
  Use this skill for whole-project health reviews and audits — evaluating the overall
  repository, its structure, architecture, conventions, configuration, dependencies,
  security, testing, documentation, observability, and operational readiness. Trigger
  when the user asks to review the project itself (rather than a single pull request or
  diff), audit a codebase, assess tech debt, evaluate onboarding experience, or determine
  release readiness. Works alongside stack-specific skills.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-16
applies-to: Full-project reviews, repository audits, architecture and structure, tech debt, release readiness
---

# Project Review Skill

## When to Use This Skill

Load this skill whenever the task involves:
- Reviewing an entire repository or codebase, not a single PR or diff
- Auditing project structure, architecture, and module boundaries
- Assessing tech debt, maintainability, and onboarding experience
- Evaluating configuration, dependencies, and build setup
- Determining readiness for release, handover, or further investment

## Distinction from `code-review`

- `code-review` reviews a single pull request, diff, or change set
- `project-review` reviews the project as a whole — a cross-cutting health audit

## Priority Order

1. Load and apply relevant stack skills (`java-spring`, `python-backend`, `frontend`, `testing`, `devops`, etc.) for language-specific findings
2. Apply `project-conventions` for naming, structure, and commit standards
3. Use this checklist to structure the review report

## Output Contract

- Produce a structured report organized by review dimension (below)
- Rate each dimension with an explicit severity (Blocker / Warning / Info)
- Cite specific files, directories, or config keys for every finding
- Distinguish actionable recommended changes from nice-to-have suggestions
- Call out risks, missing information, and follow-up work explicitly

## Review Dimensions

### Structure & Architecture
- Is the repository layout conventional for its stack(s)? Are module and package boundaries clear?
- Are responsibilities separated cleanly? Are there god classes, god modules, or cyclic dependencies?
- Is the codebase consistent (naming, patterns, layering) across modules?
- Is there a documented architecture (ADRs, diagrams) that matches the reality?

### Conventions & Documentation
- Are Conventional Commits, branch, and PR conventions followed consistently?
- Is a README present and accurate (intro, install, usage, config)?
- Are key architectural decisions documented (ADRs)? Are public APIs documented?
- Is there a CONTRIBUTING / onboarding guide for new developers?

### Dependencies & Build
- Are dependencies pinned to stable, compatible versions? Any deprecated or abandoned packages?
- Is the build reproducible and documented? Are lockfiles committed for app projects?
- Are there known-vulnerable or unused dependencies? Any transitive bloat?

### Configuration & Secrets
- Are secrets and credentials kept out of source control (no hardcoded keys, `.env` committed)?
- Is configuration externalized and environment-aware (dev/test/prod)?
- Is there a documented list of required environment variables (`.env.example`)?

### Security
- Are authN/authZ applied consistently across entry points?
- Do file uploads, inputs, and queries use safe patterns (parameterization, validation, escaping)?
- Is dependency scanning and secret scanning enabled? Any OWASP Top 10 risks visible?

### Testing & Quality
- Is there meaningful unit, integration, and (where relevant) E2E coverage?
- Do bug fixes ship with a reproducing test? Are test thresholds enforced?
- Are there TODO/FIXMEs without ticket references, dead code, or commented-out code?

### CI/CD & Automation
- Are builds, tests, and static analysis run in CI on every change?
- Is deployment automated and repeatable (IaC, staged environments)?
- Are release/versioning processes documented and followed?

### Observability & Operations
- Is logging consistent and operational (structured, levels, correlation IDs)?
- Are metrics, tracing, and health endpoints present for runtime components?
- Are error handling and resilience patterns applied at service boundaries?

### Tech Debt & Maintainability
- Are there obvious refactoring opportunities with clear value?
- Is the codebase sized reasonably for its team (monolith vs. over-split services)?
- Are there lingering stability risks (flaky tests, unhandled errors)?

## Report Format

Present findings as a table per dimension, or a bulleted list grouped by severity:

| Severity | Finding | Location | Suggested action |
|----------|---------|----------|------------------|
| Blocker  | ...     | `path/to/file` | ... |
| Warning  | ...     | `path/to/file` | ... |
| Info     | ...     | `path/to/file` | ... |

Close with:
1. **Top strengths** — what is healthy and should be protected
2. **Top risks** — highest-impact items to address first
3. **Recommended next steps** — a short, prioritized plan

## Non-Negotiable Standards

- **Never** report a full project as "healthy" when secret material or known CVEs are found
- **Always** verify claims against the actual files, not assumptions
- **Always** match recommendations to the project's stated conventions and constraints
- **Always** separate discovered facts from inferences, and state what was not examined

## Related Skills

- `code-review` — PR/diff-level review of a single change set
- `project-conventions` — naming, branching, commits, PR process, ADRs
- `testing` — test structure, mocking, coverage standards
- `security-hardening` — OWASP Top 10, secure coding
- `devops` — infrastructure, CI/CD, observability standards