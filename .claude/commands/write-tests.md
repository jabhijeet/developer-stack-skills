---
description: Write tests for a file or class following testing conventions
argument-hint: [file-or-class]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Write tests for: $ARGUMENTS

1. Read the target file thoroughly to understand all public methods, edge cases, and error paths.

2. Detect test framework from project:
   - Java → JUnit 5 + Mockito (check pom.xml or build.gradle)
   - Python → pytest (check pyproject.toml)
   - TypeScript/React → Vitest + Testing Library
   - Angular → Jasmine + Karma

3. For each public method or exported function, write:
   - At least one happy path test
   - At least one failure or edge case test
   - Test behaviour not implementation — assert on outputs and side effects, not internal calls

4. Follow Arrange-Act-Assert structure. Separate each section with a blank line.

5. Mock only external dependencies (DB sessions, HTTP clients, filesystem). Never mock your own code.

6. Use descriptive test names: `method_WhenCondition_ExpectedResult` (Java) or `test_does_x_when_y` (Python) or `should do X when Y` (TypeScript).

7. Place test file in the correct location per project structure. Run existing tests to confirm nothing broke.
