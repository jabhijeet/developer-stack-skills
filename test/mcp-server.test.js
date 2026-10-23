const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fsp = require("fs/promises");

const {
  detectStack,
  extractSection,
  getPrompt,
  handleTool,
  listPrompts,
  listResources,
  readResource,
  SKILL_META,
  SKILL_NAMES,
  TOOLS,
} = require("../lib/mcp-server");
const { SKILLS } = require("../lib/installer");

const PACKAGE_ROOT = path.resolve(__dirname, "..");

// ── SKILL_META completeness ──────────────────────────────────

test("SKILL_META registers every installer skill exactly once", () => {
  assert.deepEqual(Object.keys(SKILL_META).sort(), [...SKILLS].sort());
});

test("SKILL_META entries are complete and meaningful", () => {
  for (const skill of SKILL_NAMES) {
    assert.ok(typeof SKILL_META[skill].description === "string", `${skill} has string description`);
    assert.ok(SKILL_META[skill].description.length > 10, `${skill} description is meaningful`);
    assert.ok(Array.isArray(SKILL_META[skill].globs), `${skill} has globs array`);
  }
});

test("every SKILL.md folder on disk is registered in SKILL_META", async () => {
  const entries = await fsp.readdir(PACKAGE_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(PACKAGE_ROOT, entry.name, "SKILL.md");
    try { await fsp.stat(skillFile); } catch { continue; }
    assert.ok(SKILL_META[entry.name], `SKILL_META registers on-disk skill folder '${entry.name}'`);
  }
});

test("SKILL_NAMES matches SKILL_META keys in order", () => {
  assert.deepEqual(SKILL_NAMES, Object.keys(SKILL_META));
});

test("stack-specific skills have at least one glob", () => {
  const stackSkills = SKILL_NAMES.filter((n) => !["loop-engineering", "project-conventions", "documentation", "project-review"].includes(n));
  for (const skill of stackSkills) {
    assert.ok(SKILL_META[skill].globs.length > 0, `${skill} has at least one glob`);
  }
});

// ── detectStack — Java/Kotlin ────────────────────────────────

test("detectStack: .java source files → java-spring", () => {
  assert.equal(detectStack("src/UserService.java"), "java-spring");
  assert.equal(detectStack("src/main/java/com/app/UserController.java"), "java-spring");
  assert.equal(detectStack("Contest.java"), "java-spring", "*Test.java is case-sensitive");
});

test("detectStack: Spring config files → java-spring", () => {
  assert.equal(detectStack("src/main/resources/application.yml"), "java-spring");
  assert.equal(detectStack("src/main/resources/application-prod.properties"), "java-spring");
});

test("detectStack: .kt files → java-spring", () => {
  assert.equal(detectStack("src/UserService.kt"), "java-spring");
  assert.equal(detectStack("build.gradle.kts"), "java-spring");
});

test("detectStack: build files → java-spring", () => {
  assert.equal(detectStack("pom.xml"), "java-spring");
  assert.equal(detectStack("build.gradle"), "java-spring");
});

// ── detectStack — Java sub-skills ─────────────────────────────

test("detectStack: security Java files → java-spring-security", () => {
  assert.equal(detectStack("src/main/java/com/app/security/SecurityConfig.java"), "java-spring-security");
  assert.equal(detectStack("src/main/java/com/app/config/SecurityConfig.java"), "java-spring-security");
  assert.equal(detectStack("src/main/java/com/app/security/JwtAuthenticationFilter.java"), "java-spring-security");
  assert.equal(detectStack("src/main/java/com/app/auth/OAuth2ClientConfig.java"), "java-spring-security");
});

test("detectStack: Spring AI Java files → java-spring-ai", () => {
  assert.equal(detectStack("src/main/java/com/app/ai/ChatClientConfig.java"), "java-spring-ai");
  assert.equal(detectStack("src/main/java/com/app/ai/RagService.java"), "java-spring-ai");
  assert.equal(detectStack("src/main/java/com/app/config/VectorStoreConfig.java"), "java-spring-ai");
  assert.equal(detectStack("src/main/java/com/app/ai/AiAgentService.java"), "java-spring-ai");
});

test("detectStack: data layer files → java-data", () => {
  assert.equal(detectStack("src/main/resources/db/migration/V4__add_status_to_orders.sql"), "java-data");
  assert.equal(detectStack("src/main/resources/db/changelog/db.changelog-master.xml"), "java-data");
  assert.equal(detectStack("src/main/java/com/app/config/FlywayConfig.java"), "java-data");
  assert.equal(detectStack("src/main/java/com/app/db/UserRepository.java"), "java-data");
});

test("detectStack: repositories and entities → java-data", () => {
  assert.equal(detectStack("src/main/java/com/app/repository/UserRepository.java"), "java-data");
  assert.equal(detectStack("UserRepository.java"), "java-data");
  assert.equal(detectStack("src/main/java/com/app/model/OrderEntity.java"), "java-data");
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

test("detectStack: package.json is not treated as frontend (backend Node projects have one too)", () => {
  assert.equal(detectStack("package.json"), "project-conventions");
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

test("detectStack: conventions files and unknown files → project-conventions", () => {
  assert.equal(detectStack(".gitignore"), "project-conventions");
  assert.equal(detectStack("CHANGELOG.md"), "project-conventions");
  assert.equal(detectStack(".env.example"), "project-conventions");
  assert.equal(detectStack("notes.txt"), "project-conventions");
});

// ── detectStack — skills previously unreachable ─────────────

test("detectStack: every skill with globs is reachable", () => {
  const cases = {
    "typescript-5": ["src/types/api.d.ts", "lib/installer.js", "server/app.mjs", "tsconfig.json"],
    devops: ["Dockerfile", "docker-compose.yml", "infra/main.tf", "k8s/deploy.yaml", "infra/main.bicep"],
    "ci-cd": [".github/workflows/ci.yml", ".gitlab-ci.yml", "Jenkinsfile"],
    graphql: ["schema.graphql", "src/main/resources/graphql/schema.graphqls"],
    "test-coverage": ["coverage/lcov.info", "vitest.config.ts", ".coveragerc"],
    "security-hardening": [".env", "SECURITY.md"],
    "code-review": [".github/PULL_REQUEST_TEMPLATE.md"],
    documentation: ["README.md", "docs/guide/setup.md"],
  };
  for (const [skill, paths] of Object.entries(cases)) {
    for (const filePath of paths) {
      assert.equal(detectStack(filePath), skill, `${filePath} → ${skill}`);
    }
  }
});

test("detectStack: Node backend code is not routed to frontend", () => {
  assert.notEqual(detectStack("lib/installer.js"), "frontend");
  assert.equal(detectStack("src/components/Button.js"), "frontend", "component folders stay frontend");
});

test("detectStack: Python files in a security folder stay python-backend", () => {
  assert.equal(detectStack("app/security/auth.py"), "python-backend");
});

// ── Cross-platform path handling ─────────────────────────────

test("detectStack: works with forward-slash paths (Unix style)", () => {
  const result = detectStack("src/main/java/com/app/UserService.java");
  assert.equal(result, "java-spring");
});

test("detectStack: works with backslash paths (Windows style)", () => {
  assert.equal(detectStack("src\\main\\java\\com\\app\\UserService.java"), "java-spring");
  assert.equal(detectStack("tests\\unit\\UserServiceTest.java"), "testing");
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

test("handleTool returns INVALID_ARGUMENT for missing or invalid arguments", async () => {
  for (const [toolName, args] of [
    ["get_skill", undefined],
    ["get_skill", { stack_name: "" }],
    ["detect_stack", undefined],
    ["detect_stack", { file_path: 42 }],
    ["detect_stack", []],
  ]) {
    const result = await handleTool(toolName, args);
    const err = parseError(result);
    assert.equal(err.error_type, "INVALID_ARGUMENT");
    assert.equal(err.retryable, false);
  }
});

test("handleTool get_skill: valid stack returns content, not error", async () => {
  const result = await handleTool("get_skill", { stack_name: "java-spring" });
  assert.ok(!result.isError, "should not be error");
  assert.ok(result.content[0].text.length > 100, "has skill content");
});

test("handleTool get_skill: returns Loop Engineering workflow", async () => {
  const result = await handleTool("get_skill", { stack_name: "loop-engineering" });
  assert.ok(!result.isError, "should not be error");
  assert.match(result.content[0].text, /Plan → Implement → Verify → Reflect → Repeat/);
});

test("handleTool detect_stack: returns recommended_skill and next_step", async () => {
  const result = await handleTool("detect_stack", { file_path: "src/UserService.java" });
  assert.ok(!result.isError);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.recommended_skill, "java-spring");
  assert.ok(payload.next_step.includes("get_skill"));
});

test("handleTool detect_stack: lists other matching skills", async () => {
  const result = await handleTool("detect_stack", { file_path: "src/main/java/com/app/config/SecurityConfig.java" });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.recommended_skill, "java-spring-security");
  assert.ok(payload.related_skills.includes("java-spring"));
  assert.ok(!payload.related_skills.includes("java-spring-security"));
});

test("handleTool get_skill_section returns one section only", async () => {
  const result = await handleTool("get_skill_section", { stack_name: "loop-engineering", heading: "loop engineering" });
  assert.ok(!result.isError, result.content[0].text);
  assert.match(result.content[0].text, /^#+ .*Loop Engineering/i);
  const full = await handleTool("get_skill", { stack_name: "loop-engineering" });
  assert.ok(result.content[0].text.length <= full.content[0].text.length);
});

test("handleTool get_skill_section lists headings when none match", async () => {
  const result = await handleTool("get_skill_section", { stack_name: "testing", heading: "no-such-heading-xyz" });
  const err = parseError(result);
  assert.equal(err.error_type, "SECTION_NOT_FOUND");
  assert.match(err.message, /Available headings:\n#/);
});

test("extractSection ignores headings inside code fences and stops at the next peer heading", () => {
  const markdown = "# Top\n## A\nalpha\n```bash\n# not a heading\n```\n### A.1\nsub\n## B\nbeta\n";
  const section = extractSection(markdown, "A");
  assert.ok(section.found);
  assert.equal(section.text, "## A\nalpha\n```bash\n# not a heading\n```\n### A.1\nsub");
});

test("tool schemas describe every skill instead of a stale subset", () => {
  const getSkill = TOOLS.find((tool) => tool.name === "get_skill");
  assert.deepEqual(getSkill.inputSchema.properties.stack_name.enum, SKILL_NAMES);
  assert.doesNotMatch(getSkill.inputSchema.properties.stack_name.description, /java-spring, java-data/);
});

test("resources expose every skill as skill://<name>", async () => {
  const resources = listResources();
  assert.deepEqual(resources.map((resource) => resource.uri), SKILL_NAMES.map((name) => `skill://${name}`));
  const read = await readResource("skill://testing");
  assert.match(read.contents[0].text, /^---/);
  await assert.rejects(readResource("skill://cobol"), /Unknown resource/);
});

test("prompts expose the bundled slash commands with $ARGUMENTS substituted", async () => {
  const prompts = await listPrompts();
  assert.ok(prompts.some((prompt) => prompt.name === "write-tests"));
  const prompt = await getPrompt("write-tests", { arguments: "src/UserService.java" });
  assert.match(prompt.messages[0].content.text, /Write tests for: src\/UserService\.java/);
  assert.doesNotMatch(prompt.messages[0].content.text, /^---/);
  await assert.rejects(getPrompt("nope"), /Unknown prompt/);
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
