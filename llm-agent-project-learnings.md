# LLM_LEARNINGS
> READ BEFORE TASKS. UPDATE ON FAILURES.

- [LOGIC] CLI value options must reject a following flag as a missing value, and custom install roots must be reused for uninstall.
- [LOGIC] Keep operating-system detection separate from agent-platform catalogs; positional platform commands and -g should resolve agent-specific paths without changing legacy install roots.
- [LOGIC] Tests iterating RULE_CONFIGS must derive globs and alwaysApply assertions from each config because workflow skills can be always-on while stack skills remain glob-scoped.
- [LOGIC] Managed Claude hooks must be identified by exact generated command paths when install roots are configurable; package-name substring matching breaks reinstall idempotency and uninstall cleanup.
- [RELIABILITY] Invalid managed JSON must remain untouched and propagate a non-zero failure; warning-and-return behavior falsely reports configuration success.
- [LOGIC] New skills must be registered in every catalog: installer SKILLS/RULE_CONFIGS, mcp-server SKILL_META, and package.json files/skills; derive tests from on-disk skill folders so a missing registration fails CI.
- [LOGIC] When a detection branch lowercases file names, case-sensitive tokens (e.g. Pipfile) must be lowercased in the regex too; otherwise valid files silently fall through to the default skill.