---
description: Add REST API endpoint following stack and REST conventions
argument-hint: [METHOD /path description]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Add endpoint: $ARGUMENTS

1. Detect stack:
   - `pom.xml` or `build.gradle` → Java/Spring Boot (@RestController pattern)
   - `pyproject.toml` or `requirements.txt` → Python/FastAPI (APIRouter pattern)
   - `package.json` without pom.xml/build.gradle → TypeScript/Node.js (Express/NestJS/Fastify — follow existing router pattern in project)
   - If no stack detected, state so and ask user to specify framework before proceeding.

2. Read existing endpoints in the project to understand current patterns, naming, and error handling before writing anything.

3. Design the endpoint following REST conventions:
   - Correct HTTP method: GET (read), POST (create → 201), PUT/PATCH (update → 200), DELETE (204)
   - Request/response DTOs: Java records with `@Valid`, Pydantic models with field validators
   - Input validated at controller/router layer — never in service layer

4. Implement in layers — do not skip:
   - Controller/Router: thin, delegates all logic to service
   - Service: business logic, throws domain-specific exceptions (never generic ones)
   - Repository: data access only (create if DB interaction needed)

5. Write integration test covering:
   - Happy path (correct status and response body)
   - Validation failure (400 with meaningful error message)
   - Not-found case (404) if endpoint accepts an ID

6. Check if OpenAPI/Swagger docs are auto-generated or manual. Update if manual.

7. Run existing tests to confirm no regressions.
