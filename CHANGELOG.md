# Changelog

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
