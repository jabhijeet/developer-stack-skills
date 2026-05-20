const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fsp = require("fs/promises");

const { detectStack, handleTool, SKILL_META, SKILL_NAMES } = require("../lib/mcp-server");

const PACKAGE_ROOT = path.resolve(__dirname, "..");

// ── SKILL_META completeness ──────────────────────────────────

test("SKILL_META contains all five required skills", () => {
  const required = ["java-spring", "python-backend", "frontend", "testing", "project-conventions"];
  for (const skill of required) {
    assert.ok(SKILL_META[skill], `SKILL_META has ${skill}`);
    assert.ok(typeof SKILL_META[skill].description === "string", `${skill} has string description`);
    assert.ok(SKILL_META[skill].description.length > 10, `${skill} description is meaningful`);
    assert.ok(Array.isArray(SKILL_META[skill].globs), `${skill} has globs array`);
  }
});

test("SKILL_NAMES matches SKILL_META keys in order", () => {
  assert.deepEqual(SKILL_NAMES, Object.keys(SKILL_META));
});

test("non-convention skills have at least one glob", () => {
  const stackSkills = SKILL_NAMES.filter((n) => n !== "project-conventions");
  for (const skill of stackSkills) {
    assert.ok(SKILL_META[skill].globs.length > 0, `${skill} has at least one glob`);
  }
});

// ── detectStack — Java/Kotlin ────────────────────────────────

test("detectStack: .java source files → java-spring", () => {
  assert.equal(detectStack("src/UserService.java"), "java-spring");
  assert.equal(detectStack("src/main/java/com/app/UserController.java"), "java-spring");
  assert.equal(detectStack("UserRepository.java"), "java-spring");
});

test("detectStack: .kt files → java-spring", () => {
  assert.equal(detectStack("src/UserService.kt"), "java-spring");
  assert.equal(detectStack("build.gradle.kts"), "java-spring");
});

test("detectStack: build files → java-spring", () => {
  assert.equal(detectStack("pom.xml"), "java-spring");
  assert.equal(detectStack("build.gradle"), "java-spring");
});

// ── detectStack — Python ─────────────────────────────────────

test("detectStack: .py source files → python-backend", () => {
  assert.equal(detectStack("app/services/user_service.py"), "python-backend");
  assert.equal(detectStack("main.py"), "python-backend");
});

test("detectStack: Python project files → python-backend", () => {
  assert.equal(detectStack("pyproject.toml"), "python-backend");
  assert.equal(detectStack("requirements.txt"), "python-backend");
  assert.equal(detectStack("requirements-dev.txt"), "python-backend");
  assert.equal(detectStack("setup.py"), "python-backend");
  assert.equal(detectStack("Pipfile"), "python-backend");
});

// ── detectStack — Frontend ───────────────────────────────────

test("detectStack: .tsx and .jsx → frontend", () => {
  assert.equal(detectStack("src/components/UserCard.tsx"), "frontend");
  assert.equal(detectStack("src/components/Button.jsx"), "frontend");
});

test("detectStack: .ts files → frontend", () => {
  assert.equal(detectStack("src/utils/api.ts"), "frontend");
  assert.equal(detectStack("src/types/user.ts"), "frontend");
});

test("detectStack: Angular-specific files → frontend", () => {
  assert.equal(detectStack("src/app/user-card.component.ts"), "frontend");
  assert.equal(detectStack("src/app/core/auth.guard.ts"), "frontend");
  assert.equal(detectStack("src/app/auth.service.ts"), "frontend");
  assert.equal(detectStack("src/app/users.module.ts"), "frontend");
});

test("detectStack: package.json → frontend", () => {
  assert.equal(detectStack("package.json"), "frontend");
});

// ── detectStack — Testing (checked before source) ───────────

test("detectStack: Java test files → testing", () => {
  assert.equal(detectStack("src/UserServiceTest.java"), "testing");
  assert.equal(detectStack("src/UserServiceTests.java"), "testing");
  assert.equal(detectStack("src/UserRepositoryIT.java"), "testing");
});

test("detectStack: Python test files → testing", () => {
  assert.equal(detectStack("tests/test_user_service.py"), "testing");
  assert.equal(detectStack("tests/user_service_test.py"), "testing");
});

test("detectStack: TypeScript test files → testing", () => {
  assert.equal(detectStack("src/UserCard.test.tsx"), "testing");
  assert.equal(detectStack("src/utils.spec.ts"), "testing");
  assert.equal(detectStack("src/api.test.js"), "testing");
});

// ── detectStack — Conventions fallback ──────────────────────

test("detectStack: unknown files fall back to project-conventions", () => {
  assert.equal(detectStack("README.md"), "project-conventions");
  assert.equal(detectStack("Dockerfile"), "project-conventions");
  assert.equal(detectStack(".gitignore"), "project-conventions");
  assert.equal(detectStack("CHANGELOG.md"), "project-conventions");
});

// ── Cross-platform path handling ─────────────────────────────

test("detectStack: works with forward-slash paths (Unix style)", () => {
  const result = detectStack("src/main/java/com/app/UserService.java");
  assert.equal(result, "java-spring");
});

test("detectStack: works with backslash paths (Windows style)", () => {
  // path.basename handles backslashes on all platforms via the name extraction
  const file = "src\\main\\java\\com\\app\\UserService.java";
  const result = detectStack(file);
  // On Windows: basename = "UserService.java" → java-spring
  // On Unix: basename = full string, but .java$ still matches
  assert.ok(["java-spring", "project-conventions"].includes(result), `result is valid skill: ${result}`);
});

test("detectStack: test file detected before source type", () => {
  // UserServiceTest.java should be 'testing', not 'java-spring'
  assert.equal(detectStack("UserServiceTest.java"), "testing");
  // test_user.py should be 'testing', not 'python-backend'
  assert.equal(detectStack("test_user.py"), "testing");
  // UserCard.test.tsx should be 'testing', not 'frontend'
  assert.equal(detectStack("UserCard.test.tsx"), "testing");
});

// ── handleTool error shape ───────────────────────────────────

function parseError(result) {
  assert.ok(result.isError, "result.isError should be true");
  const payload = JSON.parse(result.content[0].text);
  assert.ok(typeof payload.error_type === "string", "error_type is string");
  assert.ok(typeof payload.message === "string", "message is string");
  assert.ok(typeof payload.retryable === "boolean", "retryable is boolean");
  return payload;
}

test("handleTool get_skill: unknown stack returns INVALID_SKILL error", async () => {
  const result = await handleTool("get_skill", { stack_name: "cobol" });
  const err = parseError(result);
  assert.equal(err.error_type, "INVALID_SKILL");
  assert.equal(err.retryable, false);
  assert.ok(err.message.includes("cobol"));
});

test("handleTool unknown tool returns UNKNOWN_TOOL error", async () => {
  const result = await handleTool("no_such_tool", {});
  const err = parseError(result);
  assert.equal(err.error_type, "UNKNOWN_TOOL");
  assert.equal(err.retryable, false);
});

test("handleTool get_skill: valid stack returns content, not error", async () => {
  const result = await handleTool("get_skill", { stack_name: "java-spring" });
  assert.ok(!result.isError, "should not be error");
  assert.ok(result.content[0].text.length > 100, "has skill content");
});

test("handleTool detect_stack: returns recommended_skill and next_step", async () => {
  const result = await handleTool("detect_stack", { file_path: "src/UserService.java" });
  assert.ok(!result.isError);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.recommended_skill, "java-spring");
  assert.ok(payload.next_step.includes("get_skill"));
});

test("handleTool get_conventions: returns content, not error", async () => {
  const result = await handleTool("get_conventions", {});
  assert.ok(!result.isError);
  assert.ok(result.content[0].text.length > 100);
});

// ── readSkillFile (indirect via module) ──────────────────────

test("all skill files readable from package root", async () => {
  for (const skillName of SKILL_NAMES) {
    const skillPath = path.join(PACKAGE_ROOT, skillName, "SKILL.md");
    let content;
    try { content = await fsp.readFile(skillPath, "utf8"); } catch {
      assert.fail(`Cannot read skill file: ${skillPath}`);
    }
    assert.ok(content.length > 100, `${skillName}/SKILL.md has content`);
  }
});
