const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectPackageInstallType,
  getDefaultMode,
  getInstallRoot,
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
  const result = validateArgs({ agent: "roo", mode: "COPY", projectDir: "." });

  assert.equal(result.agent, "roocode");
  assert.equal(result.mode, "copy");
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

test("getInstallRoot uses project path for local installs", () => {
  const result = getInstallRoot("D:\\demo\\app", "local");

  assert.equal(result, "D:\\demo\\app\\.ai-skills\\developer-stack-skills");
});
