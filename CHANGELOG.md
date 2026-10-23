# Changelog

## 4.0.0 - 2026-10-23

Breaking:

- Claude Code now receives native skills in `.claude/skills/` instead of `.claude/rules/developer-stack-skills-*.md`; reinstalling removes the old rule files.
- Default agent target is `auto` (agents detected in the project) instead of `all`.
- `detect_stack` results changed for some paths: `*Repository`/`*Entity` Java files → `java-data`, plain `.js`/`.mjs`/`.cjs` → `typescript-5`, `package.json` → `project-conventions`, `Dockerfile` → `devops`, `README*` → `documentation`.
- `configureClaude(dir, context, useMcp, dryRun)` no longer takes a conventions path; `configureCline`, `configureRoocode`, `configureCopilot`, and `configureInstructionFile` take the install root instead of a list of skill paths.
- `buildMcpCommand` and the generated MCP configs use `npx -y`, `cmd /c` on Windows, and `node <checkout>/bin/…` for source checkouts.
- Removed `configureClaudeRules` and `CONVENTIONS_RULE_CONFIG` (project-conventions is a regular entry in `RULE_CONFIGS`).

Fixed:

- Claude hooks are written under `hooks.PreToolUse` in `.claude/settings.json`; the top-level `PreToolUse` key used before is ignored by Claude Code, so the hooks never ran. Reinstalling migrates existing entries.
- Hook reminders are returned as `hookSpecificOutput.additionalContext`, which reaches Claude; `systemMessage` was only shown to the user.
- The Claude MCP server is registered in `.mcp.json` at the project root, the file Claude Code reads; `.claude/mcp.json` was never loaded. Reinstalling removes the old entry.
- `.claude/rules/developer-stack-skills-*.md` used Cursor-style `globs`/`alwaysApply` frontmatter that Claude Code ignores, so all 18 rules loaded into every session. Claude now gets native skills instead (see Changed), and reinstalling removes the old rule files.
- `detect_stack` could never return 8 skills that have file patterns (`typescript-5`, `devops`, `ci-cd`, `graphql`, `test-coverage`, `security-hardening`, `code-review`, `documentation`), and routed Node backend `.js` files and `package.json` to `frontend`. Detection now matches each skill's globs and picks the most specific one.
- The pre-write SQL reminder recommended `YYYYMMDD_description.sql`, which Flyway does not pick up and which contradicted the `java-data` skill; it now gives Flyway/Liquibase guidance.
- Over-broad globs: `devops` no longer claims every `.yml`/`.yaml`, `graphql` every `.ts`/`.vue`, `security-hardening` every `*Config.java`.
- `npx` runs no longer symlink skills and hooks into npm's purgeable cache (new `npx` install type, default `copy`).
- MCP launch command: `npx -y` so clients without a TTY never hang on the install prompt, a `cmd /c` wrapper on Windows, and `node <checkout>/bin/…` for source checkouts.
- Instruction files for Cline, Roo Code, Copilot, Gemini, Kiro, Antigravity, and `AGENTS.md` list each skill with its description and tell the agent to read only the matching ones, instead of "read and follow" all 18.
- `--agent all` writes each config format once instead of rewriting `AGENTS.md` about 50 times.
- Uninstalling one agent keeps the shared `.mcp.json` entry while Claude, Cline, or Roo Code still uses it.
- Interactive prompts re-ask on an invalid answer instead of aborting the install.
- `developer-stack-skills --dry-run` (options without a command) runs an install instead of failing as an unknown command.
- Platform-global installs (`-g`) no longer put a `hooks` folder among the agent's skills and never overwrite a skill folder the user created.
- The MCP server reports read errors other than a missing file as `INTERNAL_ERROR` instead of `SKILL_NOT_FOUND`.
- `package-lock.json` version matches `package.json`.
- `@modelcontextprotocol/server` raised to `^2.3.1` (2.0.0–2.2.0 carry high-severity advisories GHSA-jm63-cq47-j5jp, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq; they affect the HTTP transport and bearer auth, which this package does not use, but the old range allowed vulnerable versions).
- Shipped `examples/smoke-tests` match the 4.0 output formats.

Added:

- `doctor` command: read-only health check of skills, hooks, MCP config, version drift, and leftovers from older releases; exits 1 on errors.
- `auto` agent target (new default): configures the agents detected in the project, or Claude Code plus `AGENTS.md` in an empty project.
- Native Claude Code skills in `.claude/skills/`, loaded on demand from their descriptions.
- `--force` to replace skill folders this package did not create.
- MCP: `get_skill_section` tool, `related_skills` in `detect_stack`, skills as `skill://<name>` resources, and the bundled slash commands as prompts.
- CI workflow (Node 22 and 24 on Linux, Windows, macOS) and an end-to-end MCP stdio test.

Changed:

- Skill metadata (descriptions, globs, always-on flags) lives in one registry, `lib/skills.js`, used by the installer, the MCP server, and the pre-write hook.
- Node.js engine requirement lowered to `>=22.0.0` (Node 22 is still a supported LTS).
- `.claude/rules` is no longer published in the package.

Removed:

- The unused path resolver (`lib/resolver.js`, `agent-roots.json`) and its documentation.

## 3.3.0 - 2026-08-16

Added:

- `documentation` skill — concise READMEs, method comments, docstrings, and inline comments (always-on)
- `project-review` skill — whole-project health audits (always-on)

Fixed:

- `code-review` is registered in `RULE_CONFIGS`, so it ships an agent rule file on install

## 3.2.0 - 2026-08-16

Added:

- `code-review` skill — unified PR/code-review checklist (correctness, security, performance, style, testing)
- YAML frontmatter (`name`, `description`, `compatibility`, `version`, `last-reviewed`, `applies-to`) on `typescript-5`, `ci-cd`, `test-coverage`, `security-hardening`, `devops`, `graphql`

Changed:

- `code-review` registered in `SKILLS` (`lib/installer.js`), `SKILL_META` (`lib/mcp-server.js`), and the package `skills`/`files` maps
- All shipped skill folders are now parseable by the installer and MCP server

## 3.0.0 - 2026-05-20

Breaking:

- Node.js engine requirement raised to `>=24.0.0` — drops Node 18, 20, 22
- MCP tool error responses changed from plain text to structured JSON `{error_type, message, retryable}` — `INVALID_SKILL`, `SKILL_NOT_FOUND`, `UNKNOWN_TOOL`
- `configureCline(dir, paths, dryRun)` → `configureCline(dir, paths, useMcp, dryRun)` — third param changed
- `configureRoocode(dir, paths, dryRun)` → `configureRoocode(dir, paths, useMcp, dryRun)` — third param changed
- `configureClaude` now generates MCP-first CLAUDE.md when `configureMcpServer=true` — installed projects get `detect_stack`/`get_skill` instructions instead of file paths

Added:

- `configureCursorMcp(dir, packageInstallType, dryRun)` — writes `.cursor/mcp.json`
- `configureSharedMcp(dir, packageInstallType, dryRun)` — writes `.mcp.json` at project root for Cline/Roocode
- `writeMcpJsonFile(filePath, packageInstallType, dryRun)` — shared MCP JSON write/merge helper
- `removeMcpJsonEntry(filePath, dryRun)` — removes package entry, preserves others, deletes file if empty
- `unconfigureCursorMcp(dir, dryRun)`, `unconfigureSharedMcp(dir, dryRun)` — cleanup counterparts
- `handleTool` exported from `lib/mcp-server.js` for direct testing
- Cursor now receives `.cursor/mcp.json` on install when MCP opted in
- Cline now receives `.mcp.json` + MCP-first `.clinerules` on install when MCP opted in
- Roocode now receives `.mcp.json` + MCP-first `.roo/rules/developer-stack-skills.md` on install when MCP opted in
- Source repo `.claude/mcp.json` and `.mcp.json` added for Cline/Roocode users of this repo
- 33 new tests: MCP routing in `configureAgents`, structured error shape, `writeMcpJsonFile`/`removeMcpJsonEntry` helpers, idempotency for all MCP config functions, unconfigure cleanup
- Smoke test fixtures (claude, cline, roocode) updated to MCP-first instructions; cline/roocode fixtures include `.mcp.json`

Changed:

- `configureCline` — generates MCP-first body when `useMcp=true`; path-based body when false
- `configureRoocode` — same
- `configureAgents` — passes `configureMcpServer` to all agent configurers; calls `configureCursorMcp`/`configureSharedMcp` when opted in; calls `unconfigureCursorMcp`/`unconfigureSharedMcp` on uninstall
- `configureMcp`/`unconfigureMcp` refactored to delegate to `writeMcpJsonFile`/`removeMcpJsonEntry`
- Commands `implement-feature`, `write-tests`, `add-endpoint` — replaced manual root-file stack detection with `detect_stack` + `get_skill` MCP tool calls; `allowed-tools` updated to include MCP tool names
- `MCP_INSTRUCTION_LINES` constant extracted in `lib/installer.js` — shared between Cline and Roocode instruction generation
- Java examples: `@MockBean` → `@MockitoBean` (removed Spring Boot 4)
- Angular testing: Jasmine+Karma → Jest; `HttpClientTestingModule` → `provideHttpClient()` + `provideHttpClientTesting()`
- All SKILL.md `last-reviewed` dates updated to `2026-05-20`

Version updates:

- Java 17+ → Java 25; Spring Boot 3.x → Spring Boot 4 / Spring Framework 7
- PostgreSQL container image: `postgres:16-alpine` → `postgres:18-alpine`
- Python `>=3.12` → `>=3.14`; ruff `>=0.4` → `>=1.0`; mypy `>=1.10` → `>=1.15`; pytest `>=8.0` → `>=8.3`; pytest-asyncio `>=0.23` → `>=0.24`; httpx `>=0.27` → `>=0.28`; uvicorn `>=0.30` → `>=0.34`; asyncpg `>=0.29` → `>=0.30`
- React 18+ → React 19+; Angular 17+ → Angular 21+; Node engine `>=18` → `>=24`

## 2.0.0 - 2026-05-16

Added:

- MCP server (`developer-stack-skills serve`) with four tools: `list_available_skills`, `get_skill`, `get_conventions`, `detect_stack`
- `serve` command in CLI to start MCP server over stdio
- Claude Code slash commands (`commands/`): `implement-feature`, `write-tests`, `review-pr`, `check-deps`, `add-endpoint`
- Claude Code hooks (`hooks/`): `pre-write.js` injects per-stack reminders on file writes; `pre-bash.js` warns on package install commands
- `.claude/rules/` per-stack rule files for automatic skill loading in Claude Code
- Cursor rules split into per-stack `.mdc` files: `developer-stack-skills-frontend.mdc`, `developer-stack-skills-java-spring.mdc`, `developer-stack-skills-python-backend.mdc`, `developer-stack-skills-project-conventions.mdc`, `developer-stack-skills-testing.mdc`
- Roocode migrated from `.roo/config.yml` to `.roo/rules/developer-stack-skills.md`
- `.gitignore` added to package

Changed:

- `@modelcontextprotocol/sdk` promoted to runtime dependency (was implicit dev dep)
- `files` in `package.json` now includes `commands/` and `hooks/`

Removed:

- `.roo/config.yml` replaced by `.roo/rules/developer-stack-skills.md`
- `.cursor/rules/developer-stack-skills.mdc` (single file) replaced by per-stack `.mdc` files

Notes:

- MCP server exposes all five skills as tools — agents can call `detect_stack` with a file path and get back which skill to load
- Hooks require Claude Code; Cursor and Copilot integration remains config-file based
- All MCP tools are read-only (`readOnlyHint: true`)

## 1.2.1 - 2026-05-15

Added:

- `configure` command alias for interactive post-install setup
- test coverage for `configure` command parsing

Changed:

- bare `developer-stack-skills` now defaults to interactive install/configuration instead of help output
- skipped `postinstall` message now tells users to run `developer-stack-skills configure`
- README now documents explicit post-install configuration flow, `--foreground-scripts` requirement for visible npm lifecycle prompts, and updated command examples
- README now clarifies why global install still asks for project directory and how global vs local install differ

Notes:

- recommended setup flow is now `npm install ...` followed by `developer-stack-skills configure`

## 1.2.0 - 2026-05-15

Added:

- `postinstall` hook to auto-run configuration during interactive `npm install`
- `source` package install type detection to skip auto-config when working inside repo checkout
- global skill install target at `~/.ai-skills/developer-stack-skills/`
- default install mode selection by package scope: `copy` for local install, `symlink` for global install
- `uninstall` command to remove installed skills and agent config entries
- `version` command
- `help` command
- `--dry-run` flag for install and uninstall preview
- test coverage for install scope helpers, `source` detection, and uninstall config cleanup helpers

Changed:

- `npm install developer-stack-skills` now configures project-level skills without separate installer step
- `npm install -g developer-stack-skills` now configures global skill install without separate installer step
- global install flow still prompts for project directory to update agent config files
- CLI now supports full command lifecycle: install, uninstall, version, and help
- help output now documents commands and dry-run usage
- README now documents auto-config behavior, local vs global install scope, uninstall/version/help commands, and updated example logs

Notes:

- auto-config skips in non-interactive environments such as CI
- uninstall removes agent linkage by rewriting config files, not by agent symlink removal
- manual fallback remains available with `developer-stack-skills install` or `npx developer-stack-skills install`

## 1.1.0 - 2026-05-15

Added:

- `developer-stack-skills install` CLI
- interactive install flow for agent selection, install mode, and target directory
- automatic OS detection
- `copy` and `symlink` install modes
- install logs for package version, OS, source directory, install directory, installed skills, and updated config files
- project-level agent config generation for `Claude`, `Cursor`, `Cline`, `Roocode`, and `GitHub Copilot`
- basic Node test coverage for installer argument parsing and config helpers

Changed:

- README now documents interactive and non-interactive installer usage
- published package files now include `bin/`, `lib/`, and `CHANGELOG.md`
- package description updated to mention installer CLI

Notes:

- installer originally required manual execution after package install
