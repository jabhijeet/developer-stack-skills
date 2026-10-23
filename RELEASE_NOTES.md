# Release Notes

## 4.0.0 - 2026-10-23

Makes the Claude Code integration actually work, and cuts how much context the skills cost. In 3.x, three of the four Claude Code pieces were written in formats Claude Code never reads: the hooks never ran, their reminders were shown only to the user, and the MCP server was registered in a file Claude Code doesn't load. The fourth, the rule files, loaded all 18 skills into every session. 4.0 replaces them with native skills that load on demand, adds a `doctor` command to check an install, and makes skill detection cover every skill.

### Upgrade

```bash
npm install -g developer-stack-skills@4
developer-stack-skills install --dir ./app --yes
developer-stack-skills doctor --dir ./app
```

Reinstalling migrates a 3.x project: it removes the old `.claude/rules/developer-stack-skills-*.md` files, moves hooks to `hooks.PreToolUse`, and moves the MCP entry from `.claude/mcp.json` to `.mcp.json`. `doctor` reports anything left over. See [Upgrading to 4.0](README.md#upgrading-to-40) for the full list.

### Breaking Changes

- **Native Claude Code skills replace rule files.** Skills install to `.claude/skills/<skill>/` and load only when a task matches their description. `CLAUDE.md` gets a short block naming the always-on skills (`loop-engineering`, `project-conventions`, `documentation`, `project-review`) instead of file paths to preload.
- **Default agent is `auto`.** The installer configures the agents it finds in the project (`CLAUDE.md`/`.claude`, `.cursor`, `.clinerules`, `.roo`, `.github/copilot-instructions.md`, `GEMINI.md`, `.kiro`, `.agent`, `AGENTS.md`). An empty project gets Claude Code plus `AGENTS.md`. Pass `--agent all` for the old behaviour; it now writes each format once.
- **Some `detect_stack` results changed.** `*Repository.java`/`*Entity.java` → `java-data`, plain `.js`/`.mjs`/`.cjs` → `typescript-5`, `Dockerfile` and Terraform → `devops`, CI files → `ci-cd`, `README*` → `documentation`, `package.json` → `project-conventions`.
- **Library API.** `configureClaude(dir, context, useMcp, dryRun)` drops the conventions path. `configureCline`, `configureRoocode`, `configureCopilot`, and `configureInstructionFile` take the install root instead of an array of skill paths. `configureClaudeRules` and `CONVENTIONS_RULE_CONFIG` are removed.
- **MCP launch command.** Generated configs use `npx -y` (no hang on an install prompt), `cmd /c` on Windows, and `node <checkout>/bin/developer-stack-skills.js` for source checkouts.

### Claude Code Fixes

| Piece | 3.x | 4.0 |
|---|---|---|
| Hooks | Top-level `PreToolUse` in `.claude/settings.json` (ignored) | `hooks.PreToolUse` |
| Hook output | `systemMessage` (user only) | `hookSpecificOutput.additionalContext` (reaches Claude) |
| MCP server | `.claude/mcp.json` (never read) | `.mcp.json` at project root |
| Skills | 18 rule files with Cursor-style frontmatter, all loaded every session | `.claude/skills/`, loaded on demand |

The write hook also fires on `MultiEdit`, and the bash hook ignores lockfile restores (`npm install`, `npm ci`, `pip install -r …`), firing only when a dependency is added.

### New Features

- **`doctor` command.** Read-only check of skill folders (missing, broken links, outdated copies), hook and MCP scripts, JSON validity, and leftovers from 3.x. Exits 1 on errors, so it can run in CI.
- **Skill detection for every skill.** One registry (`lib/skills.js`) defines each skill's description and file patterns; `detect_stack`, the Cursor rules, and the write hook all use it. The most specific pattern wins, and test files always resolve to `testing`.
- **MCP additions.** `get_skill_section` returns one section of a skill by heading. `detect_stack` returns `related_skills`. Every skill is available as a `skill://<name>` resource, and the five slash commands are exposed as MCP prompts for any MCP client.
- **Safe installs into shared skill folders.** An existing `.claude/skills/<name>` or `~/.claude/skills/<name>` you created is never overwritten or removed; `--force` replaces it. Copied skills carry a `.developer-stack-skills` marker with the package version.
- **Skill index for other agents.** Cline, Roo Code, Copilot, Gemini, Kiro, Antigravity, and `AGENTS.md` get one line per skill (name, description, path) and an instruction to read only what matches, instead of "read and follow" all 18.

### Other Fixes

- Write-hook migration advice now matches Flyway (`V<n>__description.sql`) instead of the date-prefix format Flyway ignores.
- Narrower patterns: `devops` no longer matches every YAML file, `graphql` every TypeScript file, `security-hardening` every `*Config.java`.
- `npx` runs copy files into the project instead of linking into npm's purgeable cache.
- Uninstalling one agent keeps the shared `.mcp.json` entry while Claude Code, Cline, or Roo Code still uses it.
- `-g` installs no longer add a `hooks` folder to the agent's skills directory.
- Interactive prompts re-ask on a typo; options without a command (`developer-stack-skills --dry-run`) run an install.
- MCP read errors other than a missing file are reported as `INTERNAL_ERROR`.
- Node.js 22 is supported again (`>=22.0.0`).
- MCP SDK raised to `@modelcontextprotocol/server@^2.3.1`, which fixes three high-severity advisories in 2.0.0–2.2.0. They affect the HTTP transport and bearer auth, which this stdio-only package does not use, but the old range allowed those versions. Note that the SDK's license changed from MIT to Apache-2.0 in 2.3.x.

### Project

- CI on GitHub Actions: Node 22 and 24 on Linux, Windows, and macOS, running syntax checks, tests, and `npm pack --dry-run`.
- New tests run the hooks as separate processes, cover the full install/uninstall lifecycle, and talk to the MCP server over stdio (154 tests, up from 125).
- `.claude/rules` and the unused path resolver are no longer shipped.

---

## 3.3.0 - 2026-08-16

Adds a new `documentation` skill that keeps READMEs, method comments, docstrings, and inline comments brief and self-explanatory, plus a new `project-review` skill for whole-project health audits, each with full registration across the installer, MCP server, and package manifest.

### New Skills

- **`documentation`** — cross-cutting style skill enforcing concise, non-verbose documentation for README files, method comments, docstrings, and inline comments; the code itself should be self-explanatory. Registered as an always-on workflow skill (like `loop-engineering` and `project-conventions`) in the `SKILLS` array and `RULE_CONFIGS` (`lib/installer.js`), `SKILL_META` (`lib/mcp-server.js`), and the package `files`/`skills` maps.

### Added

- `documentation` registered in the `SKILLS` array and `RULE_CONFIGS` with `alwaysApply: true` in `lib/installer.js`
- `documentation` registered in `SKILL_META` in `lib/mcp-server.js` and the package `files`/`skills` maps
- `documentation` added to the workflow-skill set excluded from the stack-specific glob assertion in `test/mcp-server.test.js`
- `project-review` skill for whole-project health audits, registered in the `SKILLS` array and `RULE_CONFIGS` with `alwaysApply: true`, `SKILL_META`, and the package `files`/`skills` maps; added to the workflow-skill exclusion set in `test/mcp-server.test.js`

Fixed:

- `code-review` is now registered in the installer `RULE_CONFIGS`, so it ships an agent rule file (`.claude/rules/` and `.cursor/rules/`) on install. Previously it existed only in `SKILLS`/`SKILL_META` and was never activated for rule-based agents.
- Added a regression test asserting every registered skill is covered by `RULE_CONFIGS` or the conventions config, so a missing rule registration fails CI.

---

## 3.2.0 - 2026-08-16

Adds new advanced skills and completes their full registration so every shipped skill is discoverable across the installer, the MCP server, and the package manifest.

### New Skills

- **`code-review`** — unified pull-request and code-review skill with a checklist covering correctness, security, performance, style, and testing for any language (Java, Python, JavaScript/TypeScript, Go, Rust). Registered in `SKILLS`, `SKILL_META`, and the package `files`/`skills` maps.
- **`typescript-5`**, **`ci-cd`**, **`test-coverage`**, **`security-hardening`**, **`devops`**, **`graphql`** — existing skill folders now ship with complete YAML frontmatter (`name`, `description`, and metadata) and are fully registered in the installer and MCP server.

### Added

- YAML frontmatter (`name`, `description`, `compatibility`, `version`, `last-reviewed`, `applies-to`) added to `typescript-5`, `ci-cd`, `test-coverage`, `security-hardening`, `devops`, `graphql`
- `code-review` added to the `SKILLS` array in `lib/installer.js`, `SKILL_META` in `lib/mcp-server.js`, and the package `files`/`skills` maps

---

## 3.0.0 - 2026-05-20

This release makes MCP the primary delivery mechanism for all supported agents, introduces structured MCP error responses, updates all stack versions to current LTS, and expands multi-agent MCP configuration.

### Breaking Changes

- **Node.js >=24 required.** Drops support for Node 18, 20, and 22.
- **MCP error responses are now structured JSON.** Tools that return errors now return `{"error_type": "...", "message": "...", "retryable": false}` instead of plain text. Consumers that parsed the error text string must be updated.
- **`configureCline` signature changed.** Third parameter is now `useMcp` (boolean), not `dryRun`. Update direct library calls: `configureCline(dir, paths, false, dryRun)`.
- **`configureRoocode` signature changed.** Same pattern: `configureRoocode(dir, paths, false, dryRun)`.

### MCP-First Agent Configuration

All supported agents now receive MCP configuration and MCP-first instructions on install (when MCP is opted in):

- **Claude** — `CLAUDE.md` now instructs `detect_stack` + `get_skill` instead of preloading all SKILL.md files
- **Cursor** — installer now writes `.cursor/mcp.json` in addition to per-stack rule files
- **Cline** — installer now writes `.mcp.json` (project root) and updates `.clinerules` to MCP-first instructions
- **Roocode** — same: `.mcp.json` + MCP-first `.roo/rules/developer-stack-skills.md`
- **GitHub Copilot** — unchanged; no MCP support; path-based instructions retained

New installer API:

| Function | Description |
|---|---|
| `configureCursorMcp(dir, type, dryRun)` | Writes `.cursor/mcp.json` |
| `configureSharedMcp(dir, type, dryRun)` | Writes `.mcp.json` (shared Cline/Roocode) |
| `writeMcpJsonFile(filePath, type, dryRun)` | Shared low-level helper for any MCP JSON file |
| `removeMcpJsonEntry(filePath, dryRun)` | Removes our entry, preserves others, deletes if empty |
| `unconfigureCursorMcp(dir, dryRun)` | Cleanup for `.cursor/mcp.json` |
| `unconfigureSharedMcp(dir, dryRun)` | Cleanup for `.mcp.json` |

### MCP Structured Errors

MCP tools now return structured error JSON on failure:

```json
{ "error_type": "INVALID_SKILL", "message": "Unknown skill: 'cobol'. Available: ...", "retryable": false }
```

Error types: `INVALID_SKILL`, `SKILL_NOT_FOUND`, `UNKNOWN_TOOL`.

### Commands Updated to Use MCP Tools

`implement-feature`, `write-tests`, and `add-endpoint` slash commands now call `detect_stack` and `get_skill` MCP tools instead of manually inspecting root files. Stack detection logic lives in one place — the MCP server — not duplicated in markdown.

### Language and Framework Version Updates

| Stack | Previous | Now |
|---|---|---|
| Java | Java 17+ | **Java 25** |
| Spring Boot | Spring Boot 3.x | **Spring Boot 4 / Spring Framework 7** |
| PostgreSQL (Testcontainers) | postgres:16 | **postgres:18** |
| Python | Python 3.12+ | **Python 3.14+** |
| React | React 18+ | **React 19+** |
| Angular | Angular 17+ | **Angular 21+** |
| Node.js (engine) | >=18.0.0 | **>=24.0.0** |
| ruff | >=0.4 | **>=1.0** |
| mypy | >=1.10 | **>=1.15** |
| pytest | >=8.0 | **>=8.3** |
| pytest-asyncio | >=0.23 | **>=0.24** |
| httpx | >=0.27 | **>=0.28** |
| uvicorn | >=0.30 | **>=0.34** |

### Testing Updates

- `@MockBean` replaced by `@MockitoBean` in all Java examples (removed in Spring Boot 4)
- Angular testing migrated from Jasmine+Karma (removed Angular 18) to **Jest**; `HttpClientTestingModule` replaced by `provideHttpClient()` + `provideHttpClientTesting()`
- 33 new tests added covering MCP routing, structured errors, idempotency, and unconfigure cleanup

---

## 2.0.0 - 2026-05-16

This release adds MCP server support, Claude Code slash commands, and hooks — making skills available to AI agents at runtime without manual SKILL.md loading.

### MCP Server

Skills are now exposed as MCP tools. Start the server with:

```bash
developer-stack-skills serve
```

Add to your MCP client config (stdio transport):

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

Or with npx (no global install required):

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
| `get_skill` | Load full SKILL.md for a stack before writing code |
| `get_conventions` | Load project-wide conventions |
| `detect_stack` | Detect which skill applies to a file path |

Typical agent workflow:

1. Agent opens a file → calls `detect_stack` with the file path
2. Server returns the recommended skill name
3. Agent calls `get_skill` to load full conventions
4. Agent writes code following those conventions

### Claude Code Commands

Five slash commands are now included and installed into your project:

- `/implement-feature [description]` — detect stack, plan, implement with tests
- `/write-tests [target]` — write tests following stack conventions
- `/review-pr` — review branch changes against conventions
- `/check-deps` — audit dependencies for outdated versions and vulnerabilities
- `/add-endpoint [description]` — add REST endpoint following stack and REST conventions

### Hooks

Two Claude Code hooks inject reminders automatically:

- `pre-write.js` — fires before any file write; injects a one-line stack reminder based on file extension (Java, Kotlin, Python, Angular, TypeScript, env files, SQL migrations)
- `pre-bash.js` — fires before bash commands; warns to verify latest stable version before any package install (`pip install`, `npm install`, `uv add`, etc.)

Hooks require Claude Code. They run automatically — no manual configuration beyond the installer wiring them up.

### Agent Config Updates

- **Claude Code**: `.claude/rules/` now contains per-stack rule files that auto-load the right skill
- **Cursor**: Single `.cursor/rules/developer-stack-skills.mdc` replaced by five per-stack `.mdc` files for finer-grained activation
- **Roocode**: Migrated from `.roo/config.yml` to `.roo/rules/developer-stack-skills.md`

---

## 1.2.1 - 2026-05-15

This release clarifies installation behavior and makes post-install setup explicit with a dedicated `configure` command.

Highlights:

- added `developer-stack-skills configure` as explicit post-install setup command
- bare `developer-stack-skills` now starts interactive configuration as shortcut
- documentation now explains that npm may hide `postinstall` prompts/logs unless `--foreground-scripts` is used
- global install flow now clearly tells users to run `developer-stack-skills configure` after installation

Recommended flow:

```bash
npm install -g developer-stack-skills
developer-stack-skills configure
```

If install-time prompts are required:

```bash
npm install -g developer-stack-skills --foreground-scripts
```

## 1.2.0 - 2026-05-15

This release streamlines package setup so installing package can immediately configure skills without extra manual steps in interactive environments.

Highlights:

- `npm install developer-stack-skills` now sets up project-level skills automatically
- `npm install -g developer-stack-skills` now sets up globally installed skills under `~/.ai-skills/developer-stack-skills/`
- added `uninstall`, `version`, and `help` commands
- added `--dry-run` for install and uninstall preview
- source checkout and CI/non-interactive installs skip auto-config safely

Behavior details:

- local package installs default to project-level skill installation and prefer `copy`
- global package installs default to global skill installation and prefer `symlink`
- agent integration still happens by updating agent config files with skill paths
- uninstall removes managed config entries and installed skill folders

Manual fallback remains available:

```bash
developer-stack-skills install
npx developer-stack-skills install
```
