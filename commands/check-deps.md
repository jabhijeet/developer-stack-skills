---
description: Audit dependencies for outdated versions and known vulnerabilities
allowed-tools: Bash, Read, Glob
---

Audit all project dependencies for outdated versions and security vulnerabilities.

Detect package managers from project root files:
- `package.json` → npm / yarn / pnpm / bun
- `pyproject.toml` or `requirements*.txt` → pip / uv / poetry
- `pom.xml` → Maven
- `build.gradle` or `build.gradle.kts` → Gradle

For each detected package manager, run the appropriate audit command and check for:
1. **Security vulnerabilities** — packages with known CVEs (highest priority)
2. **Major version updates** — breaking changes available
3. **Minor/patch updates** — non-breaking updates available
4. **Deprecated packages** — no longer maintained, replacement needed

Audit commands by ecosystem:
- npm: `npm audit --json`
- yarn: `yarn audit --json`
- pnpm: `pnpm audit --json`
- pip/uv: `pip-audit` or `safety check` if available, otherwise `pip list --outdated`
- poetry: `poetry show --outdated`
- Maven: `mvn versions:display-dependency-updates`
- Gradle: `gradle dependencyUpdates` (if plugin present) or check `build.gradle` for version declarations

Report findings as a prioritized table:

| Package | Current | Latest | Severity | Action |
|---------|---------|--------|----------|--------|

Suggest the exact update command(s) for each package manager found. Flag any package where upgrading requires migration steps. Do not update anything without explicit confirmation.
