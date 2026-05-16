# Release Notes

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
