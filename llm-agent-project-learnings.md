# LLM_LEARNINGS
> READ BEFORE TASKS. UPDATE ON FAILURES.

- [LOGIC] CLI value options must reject a following flag as a missing value, and custom install roots must be reused for uninstall.
- [LOGIC] Keep operating-system detection separate from agent-platform catalogs; positional platform commands and -g should resolve agent-specific paths without changing legacy install roots.
- [LOGIC] Tests iterating RULE_CONFIGS must derive globs and alwaysApply assertions from each config because workflow skills can be always-on while stack skills remain glob-scoped.