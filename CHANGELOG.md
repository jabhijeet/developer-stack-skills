# Changelog

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
