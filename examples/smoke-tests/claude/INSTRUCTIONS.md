Use the developer-stack-skills MCP server before editing any file:

1. Call `detect_stack` with the file path to identify the relevant stack.
2. Call `get_skill` with the detected stack to load its conventions.
3. Do not preload all skill files — load only the relevant skill on demand.

For cross-cutting decisions, call `get_conventions` to load project-wide standards.

After loading the relevant skill, create a concise implementation plan, state assumptions, then implement requested changes.
