const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

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

test("parseArgs treats leading options as an install", () => {
  const result = parseArgs(["--dry-run", "--agent", "cursor", "--force"]);

  assert.equal(result.command, "install");
  assert.equal(result.dryRun, true);
  assert.equal(result.agent, "cursor");
  assert.equal(result.force, true);
});

test("parseArgs keeps --help and --version as commands", () => {
  assert.equal(parseArgs(["--help"]).command, "--help");
  assert.equal(parseArgs(["-v"]).command, "-v");
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

  assert.equal(result.installRoot, path.resolve("custom-skills"));
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
  assert.throws(
    () => validateArgs({ mode: "copy", platform: "linux", global: true }),
    /requires one agent platform/,
    "the auto default also needs an explicit platform",
  );
});

test("validateArgs defaults to auto-detected agents", () => {
  assert.equal(validateArgs({ mode: "copy", platform: "linux" }).agent, "auto");
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

// Paths are built with the platform's own path module so these tests hold on Windows, Linux, and macOS
const ROOT = path.resolve(os.tmpdir(), "dss-paths");
const PROJECT = path.join(ROOT, "demo", "app");
const HOME = path.join(ROOT, "home", "me");

test("detectPackageInstallType returns local for project node_modules path", () => {
  const result = detectPackageInstallType(path.join(PROJECT, "node_modules", "developer-stack-skills"), PROJECT);

  assert.equal(result, "local");
});

test("detectPackageInstallType returns global for non-project path", () => {
  const result = detectPackageInstallType(
    path.join(HOME, "AppData", "Roaming", "npm", "node_modules", "developer-stack-skills"),
    PROJECT,
  );

  assert.equal(result, "global");
});

test("detectPackageInstallType returns source for package checkout", () => {
  const checkout = path.join(ROOT, "Projects", "developer-stack-skills");

  assert.equal(detectPackageInstallType(checkout, checkout), "source");
});

test("detectPackageInstallType returns npx for the npx cache", () => {
  assert.equal(
    detectPackageInstallType(path.join(HOME, ".npm", "_npx", "a1b2c3", "node_modules", "developer-stack-skills"), PROJECT),
    "npx",
  );
  // Windows-style cache paths are recognised on every OS (separators are split both ways)
  assert.equal(
    detectPackageInstallType("C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\a1b2c3\\node_modules\\developer-stack-skills", PROJECT),
    "npx",
  );
});

test("getDefaultMode copies when the package location is not durable", () => {
  assert.equal(getDefaultMode("local"), "copy");
  assert.equal(getDefaultMode("npx"), "copy", "never link into the purgeable npx cache");
  assert.equal(getDefaultMode("global"), "symlink");
  assert.equal(getDefaultMode("source"), "symlink");
});

test("getInstallRoot installs npx runs into the project", () => {
  assert.equal(getInstallRoot(PROJECT, "npx"), path.join(PROJECT, ".ai-skills", "developer-stack-skills"));
});

test("getInstallRoot uses global path for global installs", () => {
  const result = getInstallRoot(PROJECT, "global");

  assert.equal(result, path.join(os.homedir(), ".ai-skills", "developer-stack-skills"));
  assert.ok(!result.startsWith(PROJECT));
});

test("getPlatformGlobalRoot uses custom and conventional platform paths", () => {
  assert.equal(getPlatformGlobalRoot("cline", HOME), path.join(HOME, ".agents", "skills"));
  assert.equal(getPlatformGlobalRoot("windsurf", HOME), path.join(HOME, ".codeium", "windsurf", "skills"));
  assert.equal(getPlatformGlobalRoot("adal", HOME), path.join(HOME, ".adal", "skills"));
});

test("getInstallRoot uses the platform path for explicit global installs", () => {
  const result = getInstallRoot(PROJECT, "local", null, "gemini", true);

  assert.equal(result, path.join(os.homedir(), ".gemini", "skills"));
});

test("getInstallRoot accepts an explicit absolute override", () => {
  const override = path.join(ROOT, "shared", "skills");

  assert.equal(getInstallRoot(PROJECT, "local", override), override);
});

test("getInstallRoot uses project path for local installs", () => {
  assert.equal(getInstallRoot(PROJECT, "local"), path.join(PROJECT, ".ai-skills", "developer-stack-skills"));
});

test("parseArgs keeps the legacy agent option compatible", () => {
  const result = parseArgs(["install-agent", "--agent", "cursor", "--yes"]);

  assert.equal(result.command, "install-agent");
  assert.equal(result.agent, "cursor");
});
