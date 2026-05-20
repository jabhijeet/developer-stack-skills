---
description: Implement feature following project stack conventions
argument-hint: [feature-description]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, mcp__developer-stack-skills__detect_stack, mcp__developer-stack-skills__get_skill, mcp__developer-stack-skills__get_conventions
---

Implement: $ARGUMENTS

1. Identify the primary file to create or modify for this feature. Call `detect_stack` with that file path to determine the stack, then call `get_skill` with the result to load full conventions before writing anything.

2. Read existing code to understand current architecture, naming conventions, and patterns.

3. State assumptions and create a concise implementation plan. List files to create or modify.

4. Implement following the loaded skill conventions.

5. Write tests alongside implementation:
   - Unit test for service/business logic
   - Integration test for any new API endpoint
   - Arrange-Act-Assert structure, one concept per test

6. After implementing, list all files changed and confirm the implementation compiles or type-checks.
