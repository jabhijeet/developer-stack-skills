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

Version in this README: `3.0.0`

Interactive `npm install` can auto-run post-install configuration, but recent npm versions hide lifecycle script output by default. Treat configuration as explicit step after installation unless you install with `--foreground-scripts`.

- `npm install developer-stack-skills`
  Installs skills into `<project>/.ai-skills/developer-stack-skills`
  Default mode prompt prefers `copy`
- `npm install -g developer-stack-skills`
  Installs skills into `~/.ai-skills/developer-stack-skills`
  Default mode prompt prefers `symlink`
  Post-install configure step: `developer-stack-skills configure`

Why global install still asks for project directory:

- Global install has two separate outputs:
  1. Skill files go into shared user-level folder: `~/.ai-skills/developer-stack-skills`
  2. Agent config files still get written into one specific project
- Installer asks for `Project directory` so it knows where to update `CLAUDE.md`, `.clinerules`, `.roo/config.yml`, `.cursor/rules/developer-stack-skills.mdc`, and `.github/copilot-instructions.md`
- Global package install does not mean "enable skills for every repo automatically"
- It means "store one shared copy of skills globally, then link chosen project to those skills"

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

Start MCP server (stdio):

```bash
developer-stack-skills serve
```

Or run from local package without global install:

```bash
npx developer-stack-skills configure
npx developer-stack-skills serve
```

Installer will:

1. Detect Windows, macOS, or Linux automatically and reject unsupported operating systems
2. Ask which agent to configure: `all`, `claude`, `cursor`, `cline`, `roocode`, or `copilot`
3. Ask whether to `copy` files or create `symlink`
4. Ask which project directory to install into when needed
5. Install all skill folders into project or global skill directory
6. Update agent-specific config files in that project
7. Log package version, package install type (`source`, `local`, or `global`), install scope, OS, source directory, install directory, and each generated config path

## Supported platforms and target paths

The CLI runs on Windows (`win32`), macOS (`darwin`), and Linux. Unsupported operating systems fail before installation. Agent platforms are separate from the operating system: pass the platform positionally, or use the backward-compatible `--agent` option.

Use `-g` before or after the platform to install all bundled skills in that platform's user-level skills directory. Without `-g`, skills use the existing project store and native project instructions are generated where supported.

| Agent platform | Command | Global install target |
| :--- | :--- | :--- |
| AdaL, Aider, AiderDesk | `developer-stack-skills install-skills -g adal` | `~/.adal/skills/` (`~/.aider/skills/`, `~/.aider-desk/skills/`) |
| Amp, Kimi CLI, Replit, Universal | `developer-stack-skills install-skills -g amp` | `~/.config/agents/skills/` |
| Antigravity | `developer-stack-skills install-skills -g antigravity` | `~/.gemini/antigravity/skills/` |
| Claude Code | `developer-stack-skills install-skills -g claude` | `~/.claude/skills/` |
| Cline / Warp | `developer-stack-skills install-skills -g cline` | `~/.agents/skills/` |
| Codex | `developer-stack-skills install-skills -g codex` | `~/.codex/skills/` |
| Cursor | `developer-stack-skills install-skills -g cursor` | `~/.cursor/skills/` |
| Gemini CLI | `developer-stack-skills install-skills -g gemini` | `~/.gemini/skills/` |
| GitHub Copilot | `developer-stack-skills install-skills -g copilot` | `~/.copilot/skills/` |
| Kiro IDE / CLI | `developer-stack-skills install-skills -g kiro` | `~/.kiro/skills/` |
| OpenCode | `developer-stack-skills install-skills -g opencode` | `~/.config/opencode/skills/` |
| Pi | `developer-stack-skills install-skills -g pi` | `~/.pi/agent/skills/` |
| Roo Code | `developer-stack-skills install-skills -g roocode` | `~/.roocode/skills/` |
| VS Code Copilot | `developer-stack-skills install-skills -g vscode` | `~/.vscode/skills/` |
| Windsurf | `developer-stack-skills install-skills -g windsurf` | `~/.codeium/windsurf/skills/` |
| Other supported platforms | `developer-stack-skills install-skills -g <platform>` | `~/.<platform>/skills/` |

Other supported platform identifiers are `augment`, `bob`, `codearts-agent`, `codebuddy`, `codemaker`, `codestudio`, `command-code`, `continue`, `cortex`, `crush`, `deepagents`, `devin`, `droid`, `firebender`, `forgecode`, `generic`, `goose`, `hermes`, `iflow-cli`, `intellij`, `junie`, `kilo`, `kode`, `mcpjam`, `mistral-vibe`, `mux`, `neovate`, `openclaw`, `openhands`, `pochi`, `qoder`, `qwen-code`, `rovodev`, `tabnine-cli`, `trae`, `trae-cn`, and `zencoder`. Aliases: `roo` → `roocode`, `github-copilot` → `copilot`, `gemini-cli` → `gemini`, and `kiro-cli` → `kiro`.

Existing default paths remain compatible:

| Install type | Default target |
|---|---|
| Project command | `<project>/.ai-skills/developer-stack-skills/` |
| Globally installed npm package using legacy `install` | `~/.ai-skills/developer-stack-skills/` |
| Explicit platform-global command using `-g` | Platform-specific target from the table above |

Override OS detection for testing with `--platform windows`, `--platform macos`, or `--platform linux`. Override the skill and hook target with `--install-root <path>`; relative overrides resolve from the current working directory.

```bash
developer-stack-skills install --agent claude --platform linux --dir ./app --yes
developer-stack-skills install --agent all --install-root ./shared-skills --dir ./app --yes
developer-stack-skills uninstall --agent all --install-root ./shared-skills --dir ./app --yes
```

Use the same `--install-root` for uninstall that was used for install.

`postinstall` skips auto-config in non-interactive environments and in source checkout of this repo. npm also hides lifecycle script output by default unless `--foreground-scripts` is set. In those cases, run `developer-stack-skills configure` after installation.

Non-interactive install:

```bash
developer-stack-skills install --agent all --mode symlink --dir . --yes
developer-stack-skills uninstall --agent all --dir . --dry-run --yes
```

Example log output:

```text
[developer-stack-skills] installing version 3.0.0
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

### Platform integration details

Every supported platform receives all bundled skills. Platforms with native instruction formats get native artifacts; the rest receive the same mandatory paths through `AGENTS.md`.

| Platform | Action taken | Project files |
| :--- | :--- | :--- |
| Claude Code | Installs rules, hooks, optional commands, MCP config, and managed instructions. | `CLAUDE.md`, `.claude/rules/`, `.claude/settings.json`, `.claude/commands/`, `.claude/mcp.json` |
| Cursor | Writes always-on `.mdc` rules and optional MCP config. | `.cursor/rules/`, `.cursor/mcp.json` |
| Cline | Writes managed skill or MCP instructions. | `.clinerules`, `.mcp.json` |
| Roo Code | Writes native rules and optional shared MCP config. | `.roo/rules/developer-stack-skills.md`, `.mcp.json` |
| GitHub Copilot / VS Code | Writes session-persistent instructions. | `.github/copilot-instructions.md` |
| Gemini CLI | Writes managed Gemini memory instructions. | `GEMINI.md` |
| Kiro IDE / CLI | Writes a steering file. | `.kiro/steering/developer-stack-skills.md` |
| Antigravity | Writes a native agent rule. | `.agent/rules/developer-stack-skills.md` |
| Codex, OpenCode, IntelliJ, Aider, Trae, and other platforms | Writes portable mandatory instructions. | `AGENTS.md` |

`install-skills` and `install-agent` are reference-compatible aliases for the complete install because this package's skills, hooks, and on-demand MCP guidance form one integration unit. Their uninstall counterparts likewise perform the complete managed uninstall.

Flags:

- `--agent <platform>` (backward-compatible alternative to the positional platform)
- `--global`, `-g`
- `--mode <copy|symlink>`
- `--platform <windows|macos|linux>`
- `--dir <project-directory>`
- `--install-root <path>`
- `--dry-run`
- `--yes`, `-y`

Options accept either `--option value` or `--option=value`. Missing values, unknown options, unsupported platforms, invalid agents, and invalid modes fail with actionable messages and a non-zero exit code.

Commands:

| Command | Aliases | Description |
|---|---|---|
| `configure` | — | Start interactive post-install configuration |
| `install [platform]` | default when omitted | Install skills and update selected agent configuration |
| `install-skills [-g] <platform>` | — | Reference-compatible complete install alias; `-g` selects the platform user directory |
| `install-agent <platform>` | — | Reference-compatible complete integration alias |
| `uninstall [platform]` | — | Remove installed skills and managed agent configuration |
| `uninstall-skills [-g] <platform>` | — | Reference-compatible complete uninstall alias |
| `uninstall-agent <platform>` | — | Reference-compatible complete integration uninstall alias |
| `serve` | — | Start the MCP stdio server |
| `version` | `--version`, `-v` | Print the package version |
| `help` | `--help`, `-h` | Print command and option help |

Unknown commands fail instead of silently displaying help.

---

## MCP Server

Skills are exposed as MCP tools via stdio transport.

```bash
developer-stack-skills serve
```

Add to MCP client config:

```json
{
  "mcpServers": {
    "developer-stack-skills": {
      "command": "developer-stack-skills",
      "args": ["serve"]
    }
  }
}
```

Or without global install:

```json
{
  "mcpServers": {
    "developer-stack-skills": {
      "command": "npx",
      "args": ["developer-stack-skills", "serve"]
    }
  }
}
```

Available tools:

| Tool | Description |
|---|---|
| `list_available_skills` | List all skills with descriptions and file patterns |
| `get_skill` | Load full SKILL.md for a skill (`java-spring`, `python-backend`, `frontend`, `testing`, `loop-engineering`, `project-conventions`) |
| `get_conventions` | Load project-wide conventions (shortcut for `get_skill` with `project-conventions`) |
| `detect_stack` | Given a file path, return which skill applies and a ready-to-use `get_skill` call |

---

## Claude Code Commands

Five slash commands are installed into your project:

| Command | Description |
|---|---|
| `/implement-feature [description]` | Detect stack, plan, implement with tests |
| `/write-tests [target]` | Write tests following stack conventions |
| `/review-pr` | Review branch changes against conventions |
| `/check-deps` | Audit dependencies for outdated versions and vulnerabilities |
| `/add-endpoint [description]` | Add REST endpoint following stack and REST conventions |

---

## Hooks

Two Claude Code hooks fire automatically:

| Hook | File | Fires When |
|---|---|---|
| `pre-write` | `hooks/pre-write.js` | Before any file write — injects stack reminder based on file extension |
| `pre-bash` | `hooks/pre-bash.js` | Before bash commands — warns to verify latest stable version on package installs |

The `pre-write` hook covers: Java, Kotlin, Python, Angular TypeScript, generic TypeScript/JSX, `.env` files, and `.sql` migrations.

The `pre-bash` hook detects: `pip install`, `uv add`, `npm install`, `yarn add`, `pnpm add`, `bun add`, `poetry add`, and `npx pkg@latest`.

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

With `--install-root`, skill folders and hooks are placed under the exact resolved override path instead.

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

## FAQ

### Why does `npm install -g developer-stack-skills` still ask for `Project directory`?

Because installer does two different things:

1. It installs skill folders
2. It updates agent config files for a specific project

With global package install, skill folders go to:

```text
~/.ai-skills/developer-stack-skills/
```

But agent configs still must be written into a real project, for example:

```text
D:\Projects\my-app\CLAUDE.md
D:\Projects\my-app\.clinerules
D:\Projects\my-app\.roo\config.yml
```

So `Project directory` prompt is still required. Global install means shared skill storage, not machine-wide auto-enable for every repository.

### What is difference between `npm install -g developer-stack-skills` and `npm install developer-stack-skills`?

`npm install -g developer-stack-skills`

- Package installs into global npm directory
- CLI command `developer-stack-skills` works anywhere
- Skills install into `~/.ai-skills/developer-stack-skills/`
- Default install mode is `symlink`
- Best when you want one shared install reused across many projects

`npm install developer-stack-skills`

- Package installs into current project's `node_modules`
- CLI usually runs through `npx developer-stack-skills` or npm scripts
- Skills install into `<project>/.ai-skills/developer-stack-skills/`
- Default install mode is `copy`
- Best when each project should keep its own isolated skill copy

Same in both cases:

- Installer still updates agent config files per project
- Skills are not auto-enabled for every repository on machine

---

## Skills Included

| Skill | File | Use When |
|---|---|---|
| `java-spring` | `java-spring/SKILL.md` | Spring Boot, JPA, REST APIs, JUnit |
| `python-backend` | `python-backend/SKILL.md` | FastAPI, SQLAlchemy, Pydantic, pytest |
| `frontend` | `frontend/SKILL.md` | React, Angular, TypeScript, TanStack Query |
| `testing` | `testing/SKILL.md` | Unit, integration, E2E across all stacks |
| `loop-engineering` | `loop-engineering/SKILL.md` | Plan, implement, verify, reflect, and repeat |
| `project-conventions` | `project-conventions/SKILL.md` | Git, ADRs, naming, PR standards, README |

---

## Stack

- **Java**: Java 25, Spring Boot 4 / Spring Framework 7, JPA/Hibernate, JUnit 5, Mockito
- **Python**: Python 3.14+, FastAPI, Pydantic v2, SQLAlchemy 2.x, pytest
- **Frontend**: React 19+, Angular 21+, TypeScript 5+, TanStack Query, Vitest
- **Testing**: JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers
- **Conventions**: Conventional Commits, ADRs, Git Flow or Trunk-Based Development

---

## License

MIT
