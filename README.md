# developer-stack-skills

> AI agent SKILL.md files for full-stack developers — Java, Python, React, Angular, Testing, and Project Conventions.

Compatible with **Claude**, **Cline**, **Roocode**, **GitHub Copilot**, and **Cursor**.

---

## Install

```bash
npm install developer-stack-skills
```

Global install:

```bash
npm install -g developer-stack-skills
```

Version in this README: `1.1.0`

Run installer:

```bash
developer-stack-skills install
```

Or run from local package without global install:

```bash
npx developer-stack-skills install
```

Installer will:

1. Detect OS automatically
2. Ask which agent to configure: `all`, `claude`, `cursor`, `cline`, `roocode`, or `copilot`
3. Ask whether to `copy` files or create `symlink`
4. Ask which project directory to install into
5. Install all skill folders into:

```text
<project>/.ai-skills/developer-stack-skills/
```

6. Update agent-specific config files in that project
7. Log package version, package install type (`local` or `global`), OS, source directory, install directory, and each generated config path

Installer does not run automatically on `npm install`. Run `developer-stack-skills install` or `npx developer-stack-skills install` when you want to configure a project.

Non-interactive install:

```bash
developer-stack-skills install --agent all --mode symlink --dir . --yes
```

Example log output:

```text
[developer-stack-skills] installing version 1.1.0
[developer-stack-skills] package install type: global
[developer-stack-skills] os: windows
[developer-stack-skills] package dir: C:\Users\<you>\AppData\Roaming\npm\node_modules\developer-stack-skills
[developer-stack-skills] project dir: D:\Projects\my-app
[developer-stack-skills] install dir: D:\Projects\my-app\.ai-skills\developer-stack-skills
[developer-stack-skills] skill installed: java-spring -> D:\Projects\my-app\.ai-skills\developer-stack-skills\java-spring
[developer-stack-skills] cline config updated: D:\Projects\my-app\.clinerules
[developer-stack-skills] install complete
```

Flags:

- `--agent <all|claude|cursor|cline|roocode|copilot>`
- `--mode <copy|symlink>`
- `--dir <project-directory>`
- `--yes`

---

## Installed Files

Skill files get copied or linked here:

```text
<project>/.ai-skills/developer-stack-skills/
```

Agent configs get created or updated here:

- `Claude`: `CLAUDE.md`
- `Cursor`: `.cursor/rules/developer-stack-skills.mdc`
- `Cline`: `.clinerules`
- `Roocode`: `.roo/config.yml`
- `GitHub Copilot`: `.github/copilot-instructions.md`

Notes:

- `copy` makes project-local copies of skill folders
- `symlink` keeps installed skills linked to package source
- Running installer again refreshes installed skill folders and rewrites managed config sections

---

## Skills Included

| Skill | File | Use When |
|---|---|---|
| `java-spring` | `java-spring/SKILL.md` | Spring Boot, JPA, REST APIs, JUnit |
| `python-backend` | `python-backend/SKILL.md` | FastAPI, SQLAlchemy, Pydantic, pytest |
| `frontend` | `frontend/SKILL.md` | React, Angular, TypeScript, TanStack Query |
| `testing` | `testing/SKILL.md` | Unit, integration, E2E across all stacks |
| `project-conventions` | `project-conventions/SKILL.md` | Git, ADRs, naming, PR standards, README |

---

## Stack

- **Java**: Java 17+, Spring Boot 3.x, JPA/Hibernate, JUnit 5, Mockito
- **Python**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, pytest
- **Frontend**: React 18+, Angular 17+, TypeScript 5+, TanStack Query, Vitest
- **Testing**: JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers
- **Conventions**: Conventional Commits, ADRs, Git Flow or Trunk-Based Development

---

## License

MIT
