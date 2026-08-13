const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AGENT_PLATFORMS,
  detectPackageInstallType,
  detectPlatform,
  getDefaultMode,
  getInstallRoot,
  getPlatformGlobalRoot,
  parseArgs,
  removeManagedBlock,
  removeSkillsSectionItems,
  replaceManagedBlock,
  upsertSkillsSection,
  validateArgs,
} = require("../lib/installer");

test("parseArgs reads install flags", () => {
  const result = parseArgs([
    "install",
    "--agent",
    "cline",
    "--mode=copy",
    "--dir",
    "demo",
    "--dry-run",
    "--yes",
  ]);

  assert.equal(result.command, "install");
  assert.equal(result.agent, "cline");
  assert.equal(result.mode, "copy");
  assert.equal(result.projectDir, "demo");
  assert.equal(result.dryRun, true);
  assert.equal(result.yes, true);
});

test("parseArgs reads platform and install root overrides", () => {
  const result = parseArgs(["install", "--platform=darwin", "--install-root", "custom"]);

  assert.equal(result.platform, "darwin");
  assert.equal(result.installRoot, "custom");
});

test("parseArgs reads reference-compatible positional platform and global flag", () => {
  const result = parseArgs(["install-skills", "-g", "gemini-cli", "--yes"]);

  assert.equal(result.command, "install-skills");
  assert.equal(result.agent, "gemini-cli");
  assert.equal(result.global, true);
  assert.equal(result.yes, true);
});

test("parseArgs rejects unknown options", () => {
  assert.throws(() => parseArgs(["install", "--unknown"]), /Unknown option or argument/);
});

test("parseArgs rejects missing option values", () => {
  assert.throws(() => parseArgs(["install", "--dir", "--yes"]), /Option --dir requires a value/);
});

test("parseArgs defaults to interactive install when no command provided", () => {
  const result = parseArgs([]);

  assert.equal(result.command, "install");
});

test("parseArgs preserves configure command", () => {
  const result = parseArgs(["configure"]);

  assert.equal(result.command, "configure");
});

test("replaceManagedBlock appends html managed block", () => {
  const result = replaceManagedBlock("Header", "Body", "html");

  assert.match(result, /Header/);
  assert.match(result, /<!-- developer-stack-skills:start -->/);
  assert.match(result, /Body/);
  assert.match(result, /<!-- developer-stack-skills:end -->/);
});

test("removeManagedBlock removes html managed block", () => {
  const result = removeManagedBlock(
    "Header\n\n<!-- developer-stack-skills:start -->\nBody\n<!-- developer-stack-skills:end -->\n",
    "html",
  );

  assert.equal(result, "Header\n");
});

test("upsertSkillsSection creates skills block", () => {
  const result = upsertSkillsSection("", ["a", "b"], (item) => `  - ${item}`);

  assert.equal(result, "skills:\n  - a\n  - b\n");
});

test("upsertSkillsSection replaces existing skills block", () => {
  const result = upsertSkillsSection(
    "name: demo\nskills:\n  - old\n\nmode: strict\n",
    ["new"],
    (item) => `  - ${item}`,
  );

  assert.equal(result, "name: demo\nskills:\n  - new\nmode: strict\n");
});

test("removeSkillsSectionItems removes selected entries", () => {
  const result = removeSkillsSectionItems(
    "name: demo\nskills:\n  - \"a\"\n  - \"b\"\nmode: strict\n",
    ["a"],
    (item) => `  - "${item}"`,
  );

  assert.equal(result, "name: demo\nskills:\n  - \"b\"\nmode: strict\n");
});

test("removeSkillsSectionItems removes empty section", () => {
  const result = removeSkillsSectionItems(
    "skills:\n  - \"a\"\n",
    ["a"],
    (item) => `  - "${item}"`,
  );

  assert.equal(result, "");
});

test("validateArgs normalizes defaults", () => {
  const result = validateArgs({ agent: "roo", mode: "COPY", platform: "darwin", projectDir: "." });

  assert.equal(result.agent, "roocode");
  assert.equal(result.mode, "copy");
  assert.equal(result.platform, "macos");
});

test("validateArgs normalizes install root override", () => {
  const result = validateArgs({
    agent: "claude",
    mode: "copy",
    platform: "linux",
    projectDir: ".",
    installRoot: "custom-skills",
  });

  assert.equal(result.installRoot, require("node:path").resolve("custom-skills"));
});

test("validateArgs accepts the full platform catalog and aliases", () => {
  assert.ok(AGENT_PLATFORMS.includes("adal"));
  assert.ok(AGENT_PLATFORMS.includes("windsurf"));
  assert.equal(validateArgs({ agent: "gemini-cli", mode: "copy", platform: "linux" }).agent, "gemini");
  assert.equal(validateArgs({ agent: "kiro-cli", mode: "copy", platform: "linux" }).agent, "kiro");
});

test("validateArgs requires one platform for global installation", () => {
  assert.throws(
    () => validateArgs({ agent: "all", mode: "copy", platform: "linux", global: true }),
    /requires one agent platform/,
  );
});

test("validateArgs rejects invalid agents and modes", () => {
  assert.throws(
    () => validateArgs({ agent: "unknown", mode: "copy", platform: "linux" }),
    /Invalid agent/,
  );
  assert.throws(
    () => validateArgs({ agent: "claude", mode: "hardlink", platform: "linux" }),
    /Invalid mode/,
  );
});

test("detectPlatform maps supported Node platform identifiers", () => {
  assert.equal(detectPlatform("win32"), "windows");
  assert.equal(detectPlatform("darwin"), "macos");
  assert.equal(detectPlatform("linux"), "linux");
});

test("detectPlatform rejects unsupported platforms", () => {
  assert.throws(() => detectPlatform("aix"), /Unsupported platform.*windows, macos, linux/);
});

test("detectPackageInstallType returns local for project node_modules path", () => {
  const result = detectPackageInstallType(
    "D:\\demo\\app\\node_modules\\developer-stack-skills",
    "D:\\demo\\app",
  );

  assert.equal(result, "local");
});

test("detectPackageInstallType returns global for non-project path", () => {
  const result = detectPackageInstallType(
    "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\developer-stack-skills",
    "D:\\demo\\app",
  );

  assert.equal(result, "global");
});

test("detectPackageInstallType returns source for package checkout", () => {
  const result = detectPackageInstallType(
    "D:\\Projects\\developer-stack-skills",
    "D:\\Projects\\developer-stack-skills",
  );

  assert.equal(result, "source");
});

test("getDefaultMode prefers copy for local install", () => {
  assert.equal(getDefaultMode("local"), "copy");
  assert.equal(getDefaultMode("global"), "symlink");
});

test("getInstallRoot uses global path for global installs", () => {
  const result = getInstallRoot("D:\\demo\\app", "global");

  assert.match(result, /[\\/]\.ai-skills[\\/]developer-stack-skills$/);
  assert.doesNotMatch(result, /^D:\\demo\\app/);
});

test("getPlatformGlobalRoot uses custom and conventional platform paths", () => {
  assert.equal(getPlatformGlobalRoot("cline", "D:\\Users\\me"), "D:\\Users\\me\\.agents\\skills");
  assert.equal(getPlatformGlobalRoot("windsurf", "D:\\Users\\me"), "D:\\Users\\me\\.codeium\\windsurf\\skills");
  assert.equal(getPlatformGlobalRoot("adal", "D:\\Users\\me"), "D:\\Users\\me\\.adal\\skills");
});

test("getInstallRoot uses the platform path for explicit global installs", () => {
  const result = getInstallRoot("D:\\demo\\app", "local", null, "gemini", true);

  assert.match(result, /[\\/]\.gemini[\\/]skills$/);
});

test("getInstallRoot accepts an explicit absolute override", () => {
  const result = getInstallRoot("D:\\demo\\app", "local", "D:\\shared\\skills");

  assert.equal(result, "D:\\shared\\skills");
});

test("getInstallRoot uses project path for local installs", () => {
  const result = getInstallRoot("D:\\demo\\app", "local");

  assert.equal(result, "D:\\demo\\app\\.ai-skills\\developer-stack-skills");
});

test("parseArgs keeps the legacy agent option compatible", () => {
  const result = parseArgs(["install-agent", "--agent", "cursor", "--yes"]);

  assert.equal(result.command, "install-agent");
  assert.equal(result.agent, "cursor");
});
