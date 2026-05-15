# Smoke Tests

Use these fixtures to verify agents can load `SKILL.md` files consistently from the installed npm package.

## Goal

Each fixture points an agent at the published package paths under `node_modules/io.github.jabhijeet/`.
The smoke test passes when the agent:

1. Acknowledges the loaded skill files
2. Follows the documented priority and conflict-resolution rules
3. Produces stack-appropriate output for the prompt

## Suggested Test Flow

1. Install package in a clean repo:
   ```bash
   npm install io.github.jabhijeet
   ```
2. Copy one fixture config into the test repo
3. Open the prompt file for that fixture
4. Ask agent to complete the task
5. Review output against expected checks in this file

## Fixtures

- `copilot/`: `.github/copilot-instructions.md` + prompt
- `cline/`: `.clinerules` + prompt
- `roocode/`: `.roo/config.yml` + prompt
- `claude/`: prompt snippet for system or project instructions

## Expected Checks

- Frontend prompt:
  - Uses TypeScript
  - Keeps API logic out of component body
  - Mentions tests or adds test plan
- Python prompt:
  - Uses typed FastAPI patterns
  - Returns schema, not ORM model
  - Handles failure path
- Conventions prompt:
  - Produces Conventional Commit message
  - Uses protected-branch workflow
  - References `.env.example` instead of committing secrets
