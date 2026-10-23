#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Copy installs place skills.js beside this hook; symlink installs resolve to the package's lib/
const { detectStack } = require(fs.existsSync(path.join(__dirname, "skills.js")) ? "./skills.js" : "../lib/skills.js");

const JAVA = "java-spring conventions: constructor injection only; DTOs are Java records; JPA associations use FetchType.LAZY; exceptions are handled in @ControllerAdvice; controllers hold no business logic.";

const REMINDERS = {
  "java-spring": JAVA,
  "java-spring-security": JAVA,
  "java-spring-ai": JAVA,
  "java-data": "java-data conventions: applied migrations are never edited; schema changes go in a new versioned migration (Flyway V<n>__description.sql or a new Liquibase changeset).",
  "python-backend": "python-backend conventions: Pydantic models for all I/O; async handlers in FastAPI; secrets come from pydantic-settings, never hardcoded; pytest with fixtures, not unittest.",
  frontend: "frontend conventions: functional components; no `any` in TypeScript; TanStack Query for server state; no useEffect for data fetching; components never fetch directly.",
  "typescript-5": "typescript-5 conventions: no `any` (use `unknown` and narrow); external input is validated at runtime (e.g. Zod); switch statements over unions are exhaustive with a `never` check.",
  testing: "testing conventions: Arrange-Act-Assert; one concept per test; test behaviour, not implementation; mock only external dependencies (DB, HTTP), not the project's own code.",
  "security-hardening": "security-hardening conventions: secrets are never committed. .env.example lists every required key with values redacted; config is read through pydantic-settings or Spring @Value.",
};

const KOTLIN = "java-spring (Kotlin) conventions: constructor injection only; DTOs are data classes; exceptions are handled in @ControllerAdvice; controllers hold no business logic.";
const ANGULAR = "frontend (Angular) conventions: standalone components with OnPush; signals for reactive state; services return Observables and never subscribe internally.";
const ANGULAR_FILE = /\.(component|service|module|guard|pipe|interceptor|directive|resolver)\.ts$/;

function getReminder(filePath) {
  if (!filePath) return null;
  const stack = detectStack(filePath);
  const name = path.basename(filePath);
  if (stack === "java-spring" && name.endsWith(".kt")) return KOTLIN;
  if (stack === "frontend" && ANGULAR_FILE.test(name)) return ANGULAR;
  return REMINDERS[stack] || null;
}

if (require.main === module) {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    let input = {};
    try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch {}

    const reminder = getReminder(input.tool_input?.file_path || "");

    // additionalContext reaches the model; systemMessage would only be shown to the user
    if (reminder) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: `[developer-stack-skills] ${reminder}`,
        },
      }));
    }

    process.exit(0);
  });
}

module.exports = { getReminder };
