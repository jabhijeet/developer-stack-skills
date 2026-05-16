---
description: Implement feature following project stack conventions
argument-hint: [feature-description]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Implement: $ARGUMENTS

1. Detect project stack by checking root files:
   - `pom.xml` or `build.gradle` → Java/Spring Boot
   - `pyproject.toml`, `requirements.txt`, or `setup.py` → Python/FastAPI
   - `package.json` → TypeScript/JavaScript (React or Angular)

2. Read existing code to understand current architecture, naming conventions, and patterns before writing anything.

3. State assumptions and create a concise implementation plan. List files to create or modify.

4. Implement following the skill conventions already loaded for this stack:
   - Java: thin controllers, business logic in service layer, DTOs via records, constructor injection only
   - Python: Pydantic models for I/O, async handlers, pydantic-settings for config
   - TypeScript: functional components, TanStack Query for server state, no fetch inside components

5. Write tests alongside implementation:
   - Unit test for service/business logic
   - Integration test for any new API endpoint
   - Arrange-Act-Assert structure, one concept per test

6. After implementing, list all files changed and confirm the implementation compiles or type-checks.
