const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fsp = require("fs/promises");
const { execSync } = require("child_process");

const {
  RULE_CONFIGS,
  CONVENTIONS_RULE_CONFIG,
  SKILLS,
  buildMcpCommand,
  buildRuleFileContent,
  buildSkillPaths,
  configureClaude,
  configureAgents,
  configureCline,
  configureClaudeHooks,
  configureClaudeRules,
  configureCursor,
  configureCursorMcp,
  configureMcp,
  configureRoocode,
  configureSharedMcp,
  removeMcpJsonEntry,
  replaceManagedBlock,
  unconfigureCursorMcp,
  unconfigureSharedMcp,
  writeMcpJsonFile,
} = require("../lib/installer");

const PACKAGE_ROOT = path.resolve(__dirname, "..");

// Parse --- ... --- YAML frontmatter into an object
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    result[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
  }
  return result;
}

async function withTempDir(fn) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "dss-test-"));
  try {
    await fn(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

// ── buildRuleFileContent ─────────────────────────────────────

test("buildRuleFileContent includes description and globs for stack skills", () => {
  const config = RULE_CONFIGS[0]; // java-spring
  const content = buildRuleFileContent("/path/to/SKILL.md", config);
  const fm = parseFrontmatter(content);

  assert.ok(fm, "frontmatter present");
  assert.equal(fm.description, config.description, "description matches");
  assert.ok(fm.globs, "globs field present");
  assert.equal(fm.alwaysApply, "false", "alwaysApply is false for stack skills");
  assert.match(content, /Load and follow this skill file/, "instruction present");
  assert.match(content, /SKILL\.md/, "skill path referenced");
});

test("buildRuleFileContent uses alwaysApply:true and omits globs for conventions", () => {
  const content = buildRuleFileContent("/path/to/project-conventions/SKILL.md", CONVENTIONS_RULE_CONFIG);
  const fm = parseFrontmatter(content);

  assert.ok(fm, "frontmatter present");
  assert.equal(fm.alwaysApply, "true", "alwaysApply is true");
  assert.ok(!fm.globs, "no globs field when alwaysApply is true");
});

test("buildRuleFileContent globs field is valid JSON array", () => {
  for (const config of RULE_CONFIGS) {
    const content = buildRuleFileContent("/path/SKILL.md", config);
    const fm = parseFrontmatter(content);
    if (!fm.globs) continue;
    const parsed = JSON.parse(fm.globs);
    assert.ok(Array.isArray(parsed), `${config.skillName} globs is JSON array`);
    assert.ok(parsed.length > 0, `${config.skillName} has at least one glob`);
  }
});

// ── Skill files on disk ──────────────────────────────────────

test("all SKILL.md files exist in package root", async () => {
  for (const skill of SKILLS) {
    const skillPath = path.join(PACKAGE_ROOT, skill, "SKILL.md");
    let stat;
    try { stat = await fsp.stat(skillPath); } catch {
      assert.fail(`Skill file missing: ${skillPath}`);
    }
    assert.ok(stat.isFile(), `${skill}/SKILL.md is a file`);
    const content = await fsp.readFile(skillPath, "utf8");
    assert.ok(content.length > 200, `${skill}/SKILL.md has substantive content`);
  }
});

test("all SKILL.md files have YAML frontmatter with required fields", async () => {
  for (const skill of SKILLS) {
    const skillPath = path.join(PACKAGE_ROOT, skill, "SKILL.md");
    const content = await fsp.readFile(skillPath, "utf8");
    const fm = parseFrontmatter(content);
    assert.ok(fm, `${skill}/SKILL.md has frontmatter`);
    assert.ok(fm.name, `${skill}/SKILL.md has name field`);
    assert.ok(fm.description, `${skill}/SKILL.md has description field`);
  }
});

// ── Hook script syntax ───────────────────────────────────────

test("hooks/pre-write.js is valid Node.js", () => {
  const hookPath = path.join(PACKAGE_ROOT, "hooks", "pre-write.js");
  assert.doesNotThrow(
    () => execSync(`node --check "${hookPath}"`, { stdio: "pipe" }),
    "pre-write.js syntax is valid",
  );
});

test("hooks/pre-bash.js is valid Node.js", () => {
  const hookPath = path.join(PACKAGE_ROOT, "hooks", "pre-bash.js");
  assert.doesNotThrow(
    () => execSync(`node --check "${hookPath}"`, { stdio: "pipe" }),
    "pre-bash.js syntax is valid",
  );
});

// ── configureClaudeRules integration ────────────────────────

test("configureClaudeRules creates rule files with valid frontmatter", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaudeRules(tmpDir, PACKAGE_ROOT);

    for (const config of RULE_CONFIGS) {
      const ruleFile = path.join(tmpDir, ".claude", "rules", `developer-stack-skills-${config.skillName}.md`);
      const content = await fsp.readFile(ruleFile, "utf8");
      const fm = parseFrontmatter(content);

      assert.ok(fm, `${config.skillName} rule has frontmatter`);
      assert.ok(fm.description, `${config.skillName} has description`);
      assert.ok(fm.globs, `${config.skillName} has globs`);
      assert.equal(fm.alwaysApply, "false");
      assert.match(content, /SKILL\.md/, "references skill file");
    }
  });
});

test("configureClaudeRules skill paths resolve to existing files on current OS", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaudeRules(tmpDir, PACKAGE_ROOT);

    for (const config of RULE_CONFIGS) {
      const ruleFile = path.join(tmpDir, ".claude", "rules", `developer-stack-skills-${config.skillName}.md`);
      const content = await fsp.readFile(ruleFile, "utf8");

      // Extract path from "- /path/to/SKILL.md" line
      const match = content.match(/^- (.+SKILL\.md)$/m);
      assert.ok(match, `${config.skillName} rule contains skill path`);

      const resolvedPath = match[1];
      const stat = await fsp.stat(resolvedPath);
      assert.ok(stat.isFile(), `Skill path resolves to real file: ${resolvedPath}`);
    }
  });
});

// ── configureClaudeHooks integration ────────────────────────

test("configureClaudeHooks writes valid JSON settings.json", async () => {
  await withTempDir(async (tmpDir) => {
    const hooksDir = path.join(tmpDir, ".ai-skills", "developer-stack-skills", "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);

    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    const raw = await fsp.readFile(settingsFile, "utf8");
    const settings = JSON.parse(raw); // throws if invalid JSON

    assert.ok(Array.isArray(settings.PreToolUse), "PreToolUse is array");
    assert.ok(settings.PreToolUse.length >= 2, "at least 2 PreToolUse entries");

    const writeHook = settings.PreToolUse.find((h) => h.matcher === "Write|Edit");
    assert.ok(writeHook, "Write|Edit hook present");
    assert.match(writeHook.hooks[0].command, /pre-write\.js/, "pre-write.js referenced");

    const bashHook = settings.PreToolUse.find((h) => h.matcher === "Bash");
    assert.ok(bashHook, "Bash hook present");
    assert.match(bashHook.hooks[0].command, /pre-bash\.js/, "pre-bash.js referenced");
  });
});

test("configureClaudeHooks is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    const hooksDir = path.join(tmpDir, ".ai-skills", "developer-stack-skills", "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);
    await configureClaudeHooks(tmpDir, hooksDir); // run twice

    const raw = await fsp.readFile(path.join(tmpDir, ".claude", "settings.json"), "utf8");
    const settings = JSON.parse(raw);
    const ourHooks = settings.PreToolUse.filter((h) =>
      (h.hooks || []).some((hk) => hk.command && hk.command.includes("developer-stack-skills")),
    );
    assert.equal(ourHooks.length, 2, "exactly 2 our hooks — not doubled");
  });
});

// ── configureCursor integration ──────────────────────────────

test("configureCursor creates per-skill .mdc files with globs frontmatter", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursor(tmpDir, PACKAGE_ROOT);

    for (const config of RULE_CONFIGS) {
      const mdc = path.join(tmpDir, ".cursor", "rules", `developer-stack-skills-${config.skillName}.mdc`);
      const content = await fsp.readFile(mdc, "utf8");
      const fm = parseFrontmatter(content);

      assert.ok(fm, `${config.skillName}.mdc has frontmatter`);
      assert.ok(fm.globs, `${config.skillName}.mdc has globs`);
      assert.equal(fm.alwaysApply, "false");
    }

    // project-conventions should have alwaysApply: true
    const conventions = path.join(tmpDir, ".cursor", "rules", "developer-stack-skills-project-conventions.mdc");
    const content = await fsp.readFile(conventions, "utf8");
    const fm = parseFrontmatter(content);
    assert.equal(fm.alwaysApply, "true", "conventions mdc uses alwaysApply: true");
    assert.ok(!fm.globs, "conventions mdc has no globs");
  });
});

// ── configureRoocode integration ────────────────────────────

test("configureRoocode writes to .roo/rules/developer-stack-skills.md", async () => {
  await withTempDir(async (tmpDir) => {
    const installRoot = PACKAGE_ROOT;
    const skillPaths = buildSkillPaths(installRoot);
    await configureRoocode(tmpDir, skillPaths);

    const rooFile = path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md");
    const content = await fsp.readFile(rooFile, "utf8");
    assert.match(content, /Developer Stack Skills/, "has heading");
    for (const skillPath of skillPaths) {
      assert.match(content, new RegExp(path.basename(path.dirname(skillPath))), `contains ${path.basename(path.dirname(skillPath))}`);
    }
  });
});

// ── buildMcpCommand ──────────────────────────────────────────

test("buildMcpCommand global uses direct binary", () => {
  const result = buildMcpCommand("global");
  assert.equal(result.command, "developer-stack-skills");
  assert.deepEqual(result.args, ["serve"]);
});

test("buildMcpCommand local uses npx", () => {
  const result = buildMcpCommand("local");
  assert.equal(result.command, "npx");
  assert.ok(result.args.includes("developer-stack-skills"));
  assert.ok(result.args.includes("serve"));
});

// ── configureCursorMcp ───────────────────────────────────────

test("configureCursorMcp writes to .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "global");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.ok(result.mcpServers["developer-stack-skills"], "our server entry present");
    assert.equal(result.mcpServers["developer-stack-skills"].command, "developer-stack-skills");
    assert.equal(result.mcpServers["developer-stack-skills"].type, "stdio");
  });
});

test("configureCursorMcp uses npx for local install", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "local");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.equal(result.mcpServers["developer-stack-skills"].command, "npx");
  });
});

// ── configureSharedMcp ───────────────────────────────────────

test("configureSharedMcp writes to .mcp.json at project root", async () => {
  await withTempDir(async (tmpDir) => {
    await configureSharedMcp(tmpDir, "local");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(result.mcpServers["developer-stack-skills"], "our server entry present");
    assert.equal(result.mcpServers["developer-stack-skills"].command, "npx");
    assert.equal(result.mcpServers["developer-stack-skills"].type, "stdio");
  });
});

test("configureSharedMcp preserves other mcpServers entries", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
    await fsp.writeFile(mcpFile, JSON.stringify({ mcpServers: { "other-tool": { command: "other" } } }), "utf8");
    await configureSharedMcp(tmpDir, "local");
    const result = JSON.parse(await fsp.readFile(mcpFile, "utf8"));
    assert.ok(result.mcpServers["other-tool"], "other server preserved");
    assert.ok(result.mcpServers["developer-stack-skills"], "our server added");
  });
});

// ── writeMcpJsonFile / removeMcpJsonEntry ────────────────────

test("writeMcpJsonFile skips and warns on invalid JSON", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    await fsp.writeFile(mcpFile, "{ bad json }", "utf8");
    await writeMcpJsonFile(mcpFile, "local");
    const raw = await fsp.readFile(mcpFile, "utf8");
    assert.equal(raw, "{ bad json }", "invalid JSON file left untouched");
  });
});

test("removeMcpJsonEntry removes our entry, preserves others", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    const initial = { mcpServers: { "developer-stack-skills": { command: "npx" }, "other": { command: "other" } } };
    await fsp.writeFile(mcpFile, JSON.stringify(initial), "utf8");
    await removeMcpJsonEntry(mcpFile);
    const result = JSON.parse(await fsp.readFile(mcpFile, "utf8"));
    assert.ok(!result.mcpServers["developer-stack-skills"], "our entry removed");
    assert.ok(result.mcpServers["other"], "other entry preserved");
  });
});

test("removeMcpJsonEntry deletes file when no entries remain", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    await fsp.writeFile(mcpFile, JSON.stringify({ mcpServers: { "developer-stack-skills": { command: "npx" } } }), "utf8");
    await removeMcpJsonEntry(mcpFile);
    await assert.rejects(fsp.stat(mcpFile), { code: "ENOENT" }, "file deleted when empty");
  });
});

test("removeMcpJsonEntry is no-op when file does not exist", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, "nonexistent.json");
    await assert.doesNotReject(() => removeMcpJsonEntry(mcpFile), "handles missing file gracefully");
  });
});

// ── unconfigureCursorMcp / unconfigureSharedMcp ──────────────

test("unconfigureCursorMcp removes our entry from .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "global");
    await unconfigureCursorMcp(tmpDir);
    await assert.rejects(fsp.stat(path.join(tmpDir, ".cursor", "mcp.json")), { code: "ENOENT" }, "file deleted when empty");
  });
});

test("unconfigureCursorMcp preserves other entries in .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".cursor", "mcp.json");
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    await fsp.writeFile(mcpFile, JSON.stringify({ mcpServers: { "developer-stack-skills": {}, "other": {} } }), "utf8");
    await unconfigureCursorMcp(tmpDir);
    const result = JSON.parse(await fsp.readFile(mcpFile, "utf8"));
    assert.ok(!result.mcpServers["developer-stack-skills"], "our entry removed");
    assert.ok(result.mcpServers["other"], "other entry preserved");
  });
});

test("unconfigureSharedMcp removes our entry from .mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureSharedMcp(tmpDir, "local");
    await unconfigureSharedMcp(tmpDir);
    await assert.rejects(fsp.stat(path.join(tmpDir, ".mcp.json")), { code: "ENOENT" }, "file deleted when empty");
  });
});

// ── MCP idempotency ──────────────────────────────────────────

test("configureCursorMcp is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "global");
    await configureCursorMcp(tmpDir, "global");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.equal(Object.keys(result.mcpServers).length, 1, "exactly one server — not duplicated");
  });
});

test("configureSharedMcp is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    await configureSharedMcp(tmpDir, "local");
    await configureSharedMcp(tmpDir, "local");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.equal(Object.keys(result.mcpServers).length, 1, "exactly one server — not duplicated");
  });
});

test("configureCline MCP mode is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureCline(tmpDir, skillPaths, true);
    const first = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    await configureCline(tmpDir, skillPaths, true);
    const second = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.equal(first, second, "idempotent");
  });
});

test("configureRoocode MCP mode is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureRoocode(tmpDir, skillPaths, true);
    const first = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    await configureRoocode(tmpDir, skillPaths, true);
    const second = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.equal(first, second, "idempotent");
  });
});

// ── configureAgents MCP routing integration ──────────────────

test("configureAgents cursor+MCP creates .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "cursor", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: true, packageInstallType: "local", dryRun: false });
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.ok(result.mcpServers["developer-stack-skills"], "cursor MCP configured");
  });
});

test("configureAgents cline+MCP creates .mcp.json and MCP-first .clinerules", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "cline", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: true, packageInstallType: "local", dryRun: false });
    const mcpResult = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(mcpResult.mcpServers["developer-stack-skills"], "shared MCP configured");
    const clineRules = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(clineRules, /detect_stack/, ".clinerules uses MCP instructions");
  });
});

test("configureAgents roocode+MCP creates .mcp.json and MCP-first rule file", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "roocode", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: true, packageInstallType: "local", dryRun: false });
    const mcpResult = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(mcpResult.mcpServers["developer-stack-skills"], "shared MCP configured");
    const rooRule = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.match(rooRule, /detect_stack/, "roo rule uses MCP instructions");
  });
});

test("configureAgents copilot+MCP does not create .mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "copilot", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: true, packageInstallType: "local", dryRun: false });
    await assert.rejects(fsp.stat(path.join(tmpDir, ".mcp.json")), { code: "ENOENT" }, "no .mcp.json for copilot");
  });
});

test("configureAgents without MCP does not create any MCP files", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "cursor", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: false, packageInstallType: "local", dryRun: false });
    await assert.rejects(fsp.stat(path.join(tmpDir, ".cursor", "mcp.json")), { code: "ENOENT" }, "no cursor MCP when disabled");
  });
});

test("configureAgents cline without MCP writes path-based .clinerules", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents({ agent: "cline", projectDir: tmpDir, installRoot: PACKAGE_ROOT, context: null, generateCommands: false, configureMcpServer: false, packageInstallType: "local", dryRun: false });
    const clineRules = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(clineRules, /Read and follow these skill files/, "path-based instructions when no MCP");
    await assert.rejects(fsp.stat(path.join(tmpDir, ".mcp.json")), { code: "ENOENT" }, "no .mcp.json when MCP disabled");
  });
});

// ── configureCline MCP mode ──────────────────────────────────

test("configureCline non-MCP mode writes skill file paths", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureCline(tmpDir, skillPaths, false);
    const result = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(result, /Read and follow these skill files/, "path-based instruction");
    assert.match(result, /SKILL\.md/, "skill path referenced");
    assert.ok(!result.includes("detect_stack"), "no MCP tool mention");
  });
});

test("configureCline MCP mode writes detect_stack instructions", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureCline(tmpDir, skillPaths, true);
    const result = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack mentioned");
    assert.match(result, /get_skill/, "get_skill mentioned");
    assert.match(result, /get_conventions/, "get_conventions mentioned");
    assert.ok(!result.includes("Read and follow these skill files"), "no path-based instruction");
  });
});

// ── configureRoocode MCP mode ────────────────────────────────

test("configureRoocode non-MCP mode writes skill file paths", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureRoocode(tmpDir, skillPaths, false);
    const result = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.match(result, /Load and follow these skill files/, "path-based instruction");
    assert.ok(!result.includes("detect_stack"), "no MCP tool mention");
  });
});

test("configureRoocode MCP mode writes detect_stack instructions", async () => {
  await withTempDir(async (tmpDir) => {
    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureRoocode(tmpDir, skillPaths, true);
    const result = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack mentioned");
    assert.match(result, /get_skill/, "get_skill mentioned");
    assert.ok(!result.includes("Load and follow these skill files"), "no path-based instruction");
  });
});

// ── Cross-platform path safety ───────────────────────────────

test("buildSkillPaths uses OS-native separators", () => {
  const installRoot = path.join("C:", "Users", "user", ".ai-skills", "developer-stack-skills");
  const paths = buildSkillPaths(installRoot);
  for (const p of paths) {
    // path.join produces native separators — no mixed slashes
    const hasMixed = p.includes("/") && p.includes("\\");
    assert.ok(!hasMixed, `No mixed separators in: ${p}`);
    assert.ok(p.endsWith("SKILL.md"), "ends with SKILL.md");
  }
});

test("buildRuleFileContent content references correct skill path", () => {
  const skillPath = path.join("C:", "test", "SKILL.md");
  const config = RULE_CONFIGS[0];
  const content = buildRuleFileContent(skillPath, config);
  assert.match(content, /SKILL\.md/, "SKILL.md appears in content");
});

// ── configureClaudeHooks preserves existing settings ────────

test("configureClaudeHooks preserves existing non-hook settings", async () => {
  await withTempDir(async (tmpDir) => {
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    const existingSettings = {
      permissions: { allow: ["Bash(git:*)"] },
      model: "sonnet",
    };
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, JSON.stringify(existingSettings, null, 2), "utf8");

    const hooksDir = path.join(tmpDir, "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);

    const result = JSON.parse(await fsp.readFile(settingsFile, "utf8"));
    assert.deepEqual(result.permissions, existingSettings.permissions, "permissions preserved");
    assert.equal(result.model, "sonnet", "model preserved");
    assert.ok(result.PreToolUse, "our hooks added");
  });
});

test("configureClaudeHooks skips and warns on invalid JSON", async () => {
  await withTempDir(async (tmpDir) => {
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, "{ this is not valid json }", "utf8");

    const hooksDir = path.join(tmpDir, "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);

    // File must be unchanged — no data loss
    const raw = await fsp.readFile(settingsFile, "utf8");
    assert.equal(raw, "{ this is not valid json }", "invalid JSON file left untouched");
  });
});

// ── configureMcp preserves existing MCP servers ──────────────

test("configureMcp preserves other mcpServers entries", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".claude", "mcp.json");
    const existingMcp = {
      mcpServers: {
        "other-tool": { command: "other-tool", args: ["serve"] },
      },
    };
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    await fsp.writeFile(mcpFile, JSON.stringify(existingMcp, null, 2), "utf8");

    await configureMcp(tmpDir, "global");

    const result = JSON.parse(await fsp.readFile(mcpFile, "utf8"));
    assert.ok(result.mcpServers["other-tool"], "existing MCP server preserved");
    assert.ok(result.mcpServers["developer-stack-skills"], "our server added");
  });
});

test("configureMcp skips and warns on invalid JSON", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".claude", "mcp.json");
    await fsp.mkdir(path.dirname(mcpFile), { recursive: true });
    await fsp.writeFile(mcpFile, "{ bad json }", "utf8");

    await configureMcp(tmpDir, "global");

    const raw = await fsp.readFile(mcpFile, "utf8");
    assert.equal(raw, "{ bad json }", "invalid JSON file left untouched");
  });
});

// ── Managed block preserves user content outside block ───────

test("configureCline preserves user content outside managed block", async () => {
  await withTempDir(async (tmpDir) => {
    const clinerules = path.join(tmpDir, ".clinerules");
    await fsp.writeFile(clinerules, "# My custom rules\n\nAlways write tests.\n", "utf8");

    const skillPaths = buildSkillPaths(PACKAGE_ROOT);
    await configureCline(tmpDir, skillPaths);

    const result = await fsp.readFile(clinerules, "utf8");
    assert.match(result, /My custom rules/, "custom heading preserved");
    assert.match(result, /Always write tests/, "custom rule preserved");
    assert.match(result, /developer-stack-skills:start/, "managed block added");
  });
});

test("configureClaude preserves user content outside managed block", async () => {
  await withTempDir(async (tmpDir) => {
    const claudeMd = path.join(tmpDir, "CLAUDE.md");
    await fsp.writeFile(claudeMd, "# My project\n\nUse TypeScript everywhere.\n", "utf8");

    const conventionsPath = path.join(PACKAGE_ROOT, "project-conventions", "SKILL.md");
    await configureClaude(tmpDir, conventionsPath, null);

    const result = await fsp.readFile(claudeMd, "utf8");
    assert.match(result, /My project/, "heading preserved");
    assert.match(result, /Use TypeScript everywhere/, "custom rule preserved");
    assert.match(result, /developer-stack-skills:start/, "managed block added");
  });
});

test("configureClaude non-MCP mode references conventions path", async () => {
  await withTempDir(async (tmpDir) => {
    const conventionsPath = path.join(PACKAGE_ROOT, "project-conventions", "SKILL.md");
    await configureClaude(tmpDir, conventionsPath, null, false);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /Load this skill file/, "path-based instruction present");
    assert.match(result, /SKILL\.md/, "conventions path referenced");
    assert.ok(!result.includes("detect_stack"), "no MCP tool mention in path mode");
  });
});

test("configureClaude MCP mode emits detect_stack instructions, no file path", async () => {
  await withTempDir(async (tmpDir) => {
    const conventionsPath = path.join(PACKAGE_ROOT, "project-conventions", "SKILL.md");
    await configureClaude(tmpDir, conventionsPath, null, true);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack tool mentioned");
    assert.match(result, /get_skill/, "get_skill tool mentioned");
    assert.match(result, /get_conventions/, "get_conventions tool mentioned");
    assert.match(result, /on demand/, "on-demand wording present");
    assert.ok(!result.includes("Load this skill file"), "no path-based instruction");
  });
});

test("configureClaude MCP mode preserves project context block", async () => {
  await withTempDir(async (tmpDir) => {
    const context = { description: "E-commerce API", testCmd: "mvn test" };
    const conventionsPath = path.join(PACKAGE_ROOT, "project-conventions", "SKILL.md");
    await configureClaude(tmpDir, conventionsPath, context, true);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /E-commerce API/, "project description present");
    assert.match(result, /mvn test/, "test command present");
    assert.match(result, /detect_stack/, "MCP instruction still present");
  });
});

// ── replaceManagedBlock idempotence ─────────────────────────

test("replaceManagedBlock applying twice gives same result", () => {
  const body = "Skills load contextually";
  const once = replaceManagedBlock("", body, "html");
  const twice = replaceManagedBlock(once, body, "html");
  assert.equal(once, twice, "idempotent");
});

test("replaceManagedBlock preserves content outside managed block", () => {
  const existing = "# My project\n\nSome existing content.\n";
  const result = replaceManagedBlock(existing, "Skills go here", "html");
  assert.match(result, /My project/, "existing header preserved");
  assert.match(result, /existing content/, "existing body preserved");
  assert.match(result, /Skills go here/, "new content present");
});
