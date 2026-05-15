const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectPackageInstallType,
  parseArgs,
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
    "--yes",
  ]);

  assert.equal(result.command, "install");
  assert.equal(result.agent, "cline");
  assert.equal(result.mode, "copy");
  assert.equal(result.projectDir, "demo");
  assert.equal(result.yes, true);
});

test("replaceManagedBlock appends html managed block", () => {
  const result = replaceManagedBlock("Header", "Body", "html");

  assert.match(result, /Header/);
  assert.match(result, /<!-- developer-stack-skills:start -->/);
  assert.match(result, /Body/);
  assert.match(result, /<!-- developer-stack-skills:end -->/);
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
