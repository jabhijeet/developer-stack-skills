---
description: Write tests for a file or class following testing conventions
argument-hint: [file-or-class]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, mcp__developer-stack-skills__detect_stack, mcp__developer-stack-skills__get_skill
---

Write tests for: $ARGUMENTS

1. Call `detect_stack` with the target file path, then call `get_skill` with the result to load the full testing conventions for this stack before writing anything.

2. Read the target file thoroughly to understand all public methods, edge cases, and error paths.

3. For each public method or exported function, write:
   - At least one happy path test
   - At least one failure or edge case test
   - Test behaviour not implementation — assert on outputs and side effects, not internal calls

4. Follow Arrange-Act-Assert structure. Separate each section with a blank line.

5. Mock only external dependencies (DB sessions, HTTP clients, filesystem). Never mock your own code.

6. Use descriptive test names per the loaded skill conventions.

7. Place test file in the correct location per project structure. Run existing tests to confirm nothing broke.
