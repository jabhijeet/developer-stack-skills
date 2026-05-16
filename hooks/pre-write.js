#!/usr/bin/env node

const path = require("path");

const REMINDERS = {
  java: "java-spring: Constructor injection only. DTOs via Java records. FetchType.LAZY for all JPA associations. @ControllerAdvice for exceptions. No business logic in controllers.",
  kotlin: "java-spring (Kotlin): Constructor injection only. Data classes for DTOs. @ControllerAdvice for exceptions. No business logic in controllers.",
  python: "python-backend: Pydantic models for all I/O. Async handlers in FastAPI. Never hardcode secrets — use pydantic-settings. pytest with fixtures, not unittest.",
  angular: "frontend (Angular): Standalone components + OnPush. Signals for reactive state. Return Observable from services — never subscribe inside services.",
  frontend: "frontend: Functional components. Never use `any` in TypeScript. TanStack Query for server state. No useEffect for data fetching. Never fetch directly in components.",
  test: "testing: Arrange-Act-Assert. One concept per test. Test behaviour not implementation. Mock only external deps (DB, HTTP) — not your own code.",
  config: "project-conventions: Never commit secrets. .env.example must list all required keys (values redacted). Use pydantic-settings or Spring @Value for env vars.",
  sql: "project-conventions: SQL migrations → timestamp prefix: YYYYMMDD_description.sql. Never modify existing migrations — add a new one instead.",
};

function getReminder(filePath) {
  const name = path.basename(filePath);

  // Test files — checked first so test files don't get source reminder
  const isJavaTest = /Tests?\.java$/.test(name) || /IT\.java$/.test(name) || /ITest\.java$/.test(name);
  const isPythonTest = /^test_/.test(name) || /_test\.py$/.test(name);
  const isGenericTest = /\.(test|spec)\.(ts|tsx|js|jsx|py|java)$/.test(name);
  if (isJavaTest || isPythonTest || isGenericTest) return REMINDERS.test;

  // Source files by extension
  if (/\.java$/.test(name)) return REMINDERS.java;
  if (/\.kt$/.test(name)) return REMINDERS.kotlin;
  if (/\.py$/.test(name)) return REMINDERS.python;

  // Angular-specific TypeScript files before generic TS catch-all
  if (/\.(component|service|module|guard|pipe|interceptor|directive|resolver)\.ts$/.test(name)) return REMINDERS.angular;
  if (/\.(ts|tsx|js|jsx)$/.test(name)) return REMINDERS.frontend;

  // Config / secrets — skip .env.example (safe template)
  if (/^\.env(\.|$)/.test(name) && !name.endsWith(".example")) return REMINDERS.config;

  // SQL migrations
  if (/\.sql$/.test(name)) return REMINDERS.sql;

  return null;
}

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch {}

  const filePath = input.tool_input?.file_path || "";
  const reminder = getReminder(filePath);

  if (reminder) {
    process.stdout.write(JSON.stringify({
      continue: true,
      systemMessage: `[developer-stack-skills] ${reminder}`,
    }));
  }

  process.exit(0);
});
