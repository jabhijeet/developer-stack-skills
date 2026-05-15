# Changelog

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

- installer is manual by design; it does not auto-run during `npm install`
