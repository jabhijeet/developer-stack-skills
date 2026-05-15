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

Version in this README: `1.2.1`

Interactive `npm install` can auto-run post-install configuration, but recent npm versions hide lifecycle script output by default. Treat configuration as explicit step after installation unless you install with `--foreground-scripts`.

- `npm install developer-stack-skills`
  Installs skills into `<project>/.ai-skills/developer-stack-skills`
  Default mode prompt prefers `copy`
- `npm install -g developer-stack-skills`
  Installs skills into `~/.ai-skills/developer-stack-skills`
  Default mode prompt prefers `symlink`
  Post-install configure step: `developer-stack-skills configure`

Post-install configure command:

```bash
developer-stack-skills configure
```

Shortcut:

```bash
developer-stack-skills
developer-stack-skills install
```

To force npm to show install-time prompts/logs:

```bash
npm install developer-stack-skills --foreground-scripts
npm install -g developer-stack-skills --foreground-scripts
```

Remove installed skills and agent config:

```bash
developer-stack-skills uninstall
```

Show version:

```bash
developer-stack-skills version
```

Show help:

```bash
developer-stack-skills help
```

Or run from local package without global install:

```bash
npx developer-stack-skills configure
```

Installer will:

1. Detect OS automatically
2. Ask which agent to configure: `all`, `claude`, `cursor`, `cline`, `roocode`, or `copilot`
3. Ask whether to `copy` files or create `symlink`
4. Ask which project directory to install into when needed
5. Install all skill folders into project or global skill directory
6. Update agent-specific config files in that project
7. Log package version, package install type (`source`, `local`, or `global`), install scope, OS, source directory, install directory, and each generated config path

Project-level install dir:

```text
<project>/.ai-skills/developer-stack-skills/
```

Global install dir:

```text
~/.ai-skills/developer-stack-skills/
```

`postinstall` skips auto-config in non-interactive environments and in source checkout of this repo. npm also hides lifecycle script output by default unless `--foreground-scripts` is set. In those cases, run `developer-stack-skills configure` after installation.

Non-interactive install:

```bash
developer-stack-skills install --agent all --mode symlink --dir . --yes
developer-stack-skills uninstall --agent all --dir . --dry-run --yes
```

Example log output:

```text
[developer-stack-skills] installing version 1.2.1
[developer-stack-skills] package install type: global
[developer-stack-skills] skill install scope: global
[developer-stack-skills] os: windows
[developer-stack-skills] package dir: C:\Users\<you>\AppData\Roaming\npm\node_modules\developer-stack-skills
[developer-stack-skills] project dir: D:\Projects\my-app
[developer-stack-skills] install dir: C:\Users\<you>\.ai-skills\developer-stack-skills
[developer-stack-skills] skill installed: java-spring -> C:\Users\<you>\.ai-skills\developer-stack-skills\java-spring
[developer-stack-skills] cline config updated: D:\Projects\my-app\.clinerules
[developer-stack-skills] install complete
```

Flags:

- `--agent <all|claude|cursor|cline|roocode|copilot>`
- `--mode <copy|symlink>`
- `--dir <project-directory>`
- `--dry-run`
- `--yes`

Commands:

- `configure`
- `install`
- `uninstall`
- `version`
- `help`

---

## Installed Files

Skill files get copied or linked here:

```text
<project>/.ai-skills/developer-stack-skills/
```

Or for global package installs:

```text
~/.ai-skills/developer-stack-skills/
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
