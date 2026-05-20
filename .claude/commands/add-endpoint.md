---
description: Add REST API endpoint following stack and REST conventions
argument-hint: [METHOD /path description]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, mcp__developer-stack-skills__detect_stack, mcp__developer-stack-skills__get_skill
---

Add endpoint: $ARGUMENTS

1. Identify the controller or router file where this endpoint will live. Call `detect_stack` with that file path, then call `get_skill` with the result to load full conventions before writing anything. If no existing file exists yet, call `detect_stack` with a representative source file (e.g. an existing controller).

2. Read existing endpoints in the project to understand current patterns, naming, and error handling.

3. Design the endpoint following REST conventions:
   - Correct HTTP method: GET (read), POST (create → 201), PUT/PATCH (update → 200), DELETE (204)
   - Request/response DTOs validated at the controller/router layer — never in service layer

4. Implement in layers — do not skip:
   - Controller/Router: thin, delegates all logic to service
   - Service: business logic, throws domain-specific exceptions
   - Repository: data access only (create if DB interaction needed)

5. Write integration test covering:
   - Happy path (correct status and response body)
   - Validation failure (400 with meaningful error message)
   - Not-found case (404) if endpoint accepts an ID

6. Check if OpenAPI/Swagger docs are auto-generated or manual. Update if manual.

7. Run existing tests to confirm no regressions.
