# Release Notes

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
