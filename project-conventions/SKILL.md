---
name: project-conventions
description: >
  Use this skill to enforce team-wide project conventions. Covers Git branching strategy,
  commit message format (Conventional Commits), pull request process, code review checklist,
  folder and file naming conventions, Architecture Decision Records (ADRs), environment
  configuration, versioning, and documentation standards. Load this skill alongside any
  language-specific skill for complete context. Trigger when the user asks about how to
  structure a project, write a commit message, open a PR, name a file, document a decision,
  or follow team standards.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-05-15
applies-to: Branching, commits, pull requests, ADRs, naming, environment config, documentation
---

# Project Conventions Skill

## When to Use This Skill

Load this skill whenever the task involves:
- Creating a new branch or naming a branch
- Writing a commit message or PR description
- Reviewing code against team standards
- Documenting an architectural decision (ADR)
- Naming files, folders, classes, or database tables
- Setting up or reviewing environment configuration
- Onboarding a new developer to the project
- Structuring a new repository from scratch

## Priority Order

1. Follow repo-local docs, automation, and established patterns first
2. Use this skill for gaps, greenfield setup, or standardization
3. If this skill conflicts with stack-specific skills, prefer repo pattern; otherwise prefer stack-specific implementation details

## Output Contract

- State assumptions when repo context is missing
- List files changed when making edits
- Add or update tests or verification steps for behavior changes
- Avoid unrelated refactors unless they are required to complete task safely
- Call out blockers, risks, and follow-up work explicitly

## Conflict Resolution

Use this precedence order when instructions conflict:
1. Existing repo code and enforced automation
2. Repo docs and local agent instructions
3. This conventions skill
4. Loaded stack-specific skill
5. Generic best practices

---

## Git Branching Strategy

Choose one workflow per repo and document it in `README.md`. Do not mix them.

### Option A — Git Flow

Use for projects with scheduled releases and explicit release branches.

### Branch Naming

```
<type>/<ticket-id>-<short-description>

Examples:
  feature/PROJ-123-user-authentication
  bugfix/PROJ-456-fix-null-pointer-in-user-service
  hotfix/PROJ-789-patch-payment-timeout
  chore/PROJ-012-upgrade-spring-boot-3
  refactor/PROJ-345-extract-user-mapper
  docs/PROJ-567-add-adr-for-auth-strategy
```

### Branch Types
| Type       | Purpose                                         | Base Branch | Merges Into        |
|------------|-------------------------------------------------|-------------|--------------------|
| `feature`  | New features                                    | `develop`   | `develop`          |
| `bugfix`   | Non-critical bug fixes                          | `develop`   | `develop`          |
| `hotfix`   | Critical production fix                         | `main`      | `main` + `develop` |
| `chore`    | Dependencies, tooling, CI config                | `develop`   | `develop`          |
| `refactor` | Code improvement with no behavior change        | `develop`   | `develop`          |
| `release`  | Release preparation (version bumps, changelogs) | `develop`   | `main` + `develop` |

### Protected Branches
- `main` — production-ready only; no direct commits; requires PR + approval
- `develop` — integration branch; no direct commits; requires PR

### Option B — Trunk-Based Development

Use for continuous delivery teams shipping from `main` frequently.

#### Branch Naming
```
<type>/<ticket-id>-<short-description>

Examples:
  feature/PROJ-123-user-authentication
  fix/PROJ-456-null-token-guard
  chore/PROJ-012-upgrade-spring-boot-3
```

#### Rules
- Branch from `main`
- Keep branches short-lived; merge within 1-2 days when possible
- Rebase or merge `main` frequently to avoid drift
- Use feature flags instead of long-running feature branches
- `main` is protected; no direct commits; requires PR + passing CI

---

## Commit Messages (Conventional Commits)

Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<scope>): <short summary>

[optional body — what and why, not how]

[optional footer — breaking changes, closes ticket]
```

### Types
| Type       | When to Use                              |
|------------|------------------------------------------|
| `feat`     | New feature                              |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting only (no logic change)        |
| `refactor` | Code restructure (no behavior change)    |
| `test`     | Adding or modifying tests                |
| `chore`    | Tooling, dependencies, build scripts     |
| `perf`     | Performance improvement                  |
| `ci`       | CI/CD configuration changes              |
| `revert`   | Reverts a previous commit                |

### Good Examples
```
feat(users): add email verification on registration

Sends a verification email after user creation.
Token expires after 24 hours.

Closes PROJ-123
```

```
fix(auth): prevent null pointer when token is missing

The token was not checked for null before decoding,
causing 500 errors for unauthenticated requests.

Closes PROJ-456
```

### Bad Examples
```
fixed stuff         ← too vague
WIP                 ← never commit WIP to shared branches
update              ← meaningless
PROJ-123            ← ticket ID with no context
```

### Rules
- Subject line: 50 characters max, imperative mood ("add" not "added")
- No period at end of subject line
- Wrap body at 72 characters
- Reference tickets in footer: `Closes PROJ-123` or `Ref PROJ-123`

---

## Pull Request Process

### PR Title
Same format as commit messages:
```
feat(users): add email verification on registration
```

### PR Description Template
```markdown
## Summary
<!-- What does this PR do? One paragraph. -->

## Changes
- Added `EmailVerificationService` with token generation
- Added `POST /api/v1/users/verify` endpoint
- Added email template for verification

## Testing Done
- [ ] Unit tests added/updated
- [ ] Integration tests pass locally
- [ ] Manual testing performed (describe steps)

## Screenshots (if UI change)

## Related
Closes PROJ-123
```

### PR Rules
- Max 400 lines changed — split large features into smaller PRs
- Self-review before requesting review — read your own diff
- No `// TODO` without a linked ticket
- All CI checks must pass before requesting review
- At least 1 approval required before merge
- Squash-merge feature branches; merge-commit for releases

---

## Code Review Checklist

**Correctness**
- [ ] Does the code do what the PR description says?
- [ ] Are edge cases handled (null, empty, boundary values)?
- [ ] Are errors handled with proper HTTP status codes / exceptions?

**Design**
- [ ] Is the code in the right layer (controller / service / repository)?
- [ ] Is there unnecessary complexity or over-engineering?
- [ ] Could this reuse existing utilities or abstractions?

**Security**
- [ ] Is user input validated before use?
- [ ] Are no secrets, tokens, or PII written to logs?
- [ ] Are authorization checks in place for protected endpoints?

**Testing**
- [ ] Is there a test for the happy path?
- [ ] Is there a test for at least one failure path?
- [ ] Do tests assert meaningful behavior (not just coverage)?

**Conventions**
- [ ] Naming follows project conventions?
- [ ] No commented-out code?
- [ ] No debug or temporary code left in?

---

## File & Folder Naming Conventions

| Context             | Convention     | Example                           |
|---------------------|----------------|-----------------------------------|
| Java classes        | PascalCase     | `UserService.java`                |
| Python modules      | snake_case     | `user_service.py`                 |
| React components    | PascalCase     | `UserCard.tsx`                    |
| React hooks         | camelCase      | `useUser.ts`                      |
| Angular files       | kebab-case     | `user-card.component.ts`          |
| Config files        | kebab-case     | `application.yml`, `.env.local`   |
| SQL migrations      | timestamp+desc | `20240901_add_users_table.sql`    |
| ADR files           | `NNN-title`    | `001-use-postgresql.md`           |

### Folder Rules
- Always lowercase
- Hyphens for multi-word in web projects: `user-profile/`
- Underscores for Python packages: `user_profile/`
- Follow repo's existing organization first
- For greenfield repos, choose either domain-first or layered structure early and stay consistent

---

## Environment Configuration

### File Hierarchy
```
.env.example       ← committed template; no secrets
.env.local         ← local overrides (gitignored)
.env.test          ← optional committed test-only defaults; no secrets
.env.production    ← never committed; managed via secret manager
```

### Rules
- **Never** commit secrets, passwords, API keys, or connection strings with credentials
- **Always** provide `.env.example` with all required keys (values redacted)
- Do not commit `.env` unless repo explicitly uses non-secret shared defaults and policy allows it
- Use a secret manager in production (AWS Secrets Manager, Vault, GCP Secret Manager)
- Prefix env vars by concern: `DB_`, `API_`, `SMTP_`, `FEATURE_`

### .env.example (required in every repo)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=
DB_PASSWORD=

# API
API_SECRET_KEY=
API_BASE_URL=http://localhost:8080

# Feature Flags
FEATURE_EMAIL_VERIFICATION=true
```

---

## Architecture Decision Records (ADRs)

Document every significant architectural decision. Store in `docs/adr/`.

### ADR File Naming
```
docs/adr/
├── 001-use-postgresql-as-primary-database.md
├── 002-adopt-fastapi-over-django.md
├── 003-use-react-with-zustand-for-state.md
```

### ADR Template
```markdown
# ADR-NNN: [Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-NNN
**Deciders**: [Names or roles]

## Context
<!-- What situation requires a decision? What forces are at play? -->

## Decision
<!-- What was decided? State it directly. -->

## Consequences
<!-- What becomes easier? What becomes harder? What are the trade-offs? -->

## Alternatives Considered
<!-- What else was evaluated and why was it not chosen? -->
```

### When to Write an ADR
- Choice of framework, database, or third-party service
- Authentication / authorization strategy
- API design standards (REST vs gRPC, versioning strategy)
- Data model changes affecting multiple services
- Breaking changes to existing contracts

---

## README.md (Required in Every Repo)

Every repository README must contain:
1. Project name and one-sentence description
2. Prerequisites — runtime versions, required tools
3. Quick start — commands to run locally in under 5 minutes
4. Project structure — annotated folder tree
5. Environment variables — link to `.env.example`
6. Running tests — single command
7. Branching strategy — reference this conventions doc
8. Contributing — PR process summary

---

## Code Comment Standards

Comment **why**, not **what** — the code already shows what.

```java
// Good — explains the non-obvious reason
// Retry 3 times with exponential backoff because the upstream service
// has intermittent 502s during peak hours (see PROJ-789).
retryWithBackoff(3, this::fetchPaymentStatus);

// Bad — just describes the code
// retry 3 times
retryWithBackoff(3, this::fetchPaymentStatus);
```

- Never commit commented-out code — delete it; git history preserves it
- Use `TODO: PROJ-NNN description` for intentional deferrals; never naked `TODO`

---

## Versioning

Follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| Increment | When                                          |
|-----------|-----------------------------------------------|
| `MAJOR`   | Breaking API change                           |
| `MINOR`   | New backward-compatible functionality         |
| `PATCH`   | Backward-compatible bug fix                   |

Maintain a `CHANGELOG.md` using [Keep a Changelog](https://keepachangelog.com/) format.

---

## Non-Negotiable Rules

- **Never** commit directly to protected long-lived branches (`main`, `develop`, or repo-defined equivalent) — always use a PR
- **Never** commit secrets or credentials of any kind
- **Never** merge a PR with failing CI checks
- **Never** leave `TODO` without a linked ticket ID
- **Always** provide `.env.example` when adding a new environment variable
- **Always** write an ADR for decisions affecting more than one developer or service
- **Always** keep PRs under 400 lines — split if larger
- Branch names, commit messages, and PR titles must follow the conventions in this skill
