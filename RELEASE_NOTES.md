# Release Notes

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
