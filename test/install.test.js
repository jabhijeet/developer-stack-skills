const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fsp = require("fs/promises");
const { execSync, execFileSync } = require("child_process");

const {
  MANAGED_MARKER,
  RULE_CONFIGS,
  SKILLS,
  buildMcpCommand,
  buildRuleFileContent,
  buildSkillPaths,
  configureClaude,
  configureAgents,
  configureClaudeSkills,
  configureCline,
  configureClaudeHooks,
  configureCursor,
  configureCursorMcp,
  configureMcp,
  configureRoocode,
  configureSharedMcp,
  detectAgents,
  getAgentTargets,
  removeMcpJsonEntry,
  removeOurHookEntries,
  replaceManagedBlock,
  runInstall,
  runUninstall,
  unconfigureAgents,
  unconfigureClaudeSkills,
  unconfigureCursorMcp,
  unconfigureSharedMcp,
  writeMcpJsonFile,
} = require("../lib/installer");
const { runDoctor } = require("../lib/doctor");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const pkg = require("../package.json");

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

async function exists(targetPath) {
  try {
    await fsp.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function agentOptions(tmpDir, overrides = {}) {
  return {
    agent: "claude",
    projectDir: tmpDir,
    installRoot: PACKAGE_ROOT,
    context: null,
    generateCommands: false,
    configureMcpServer: false,
    packageInstallType: "local",
    packageRoot: PACKAGE_ROOT,
    mode: "copy",
    platform: "linux",
    dryRun: false,
    ...overrides,
  };
}

function runHook(scriptName, input) {
  const output = execFileSync(process.execPath, [path.join(PACKAGE_ROOT, "hooks", scriptName)], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  return output ? JSON.parse(output) : null;
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
  const conventions = RULE_CONFIGS.find((config) => config.skillName === "project-conventions");
  const content = buildRuleFileContent("/path/to/project-conventions/SKILL.md", conventions);
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

test("rule globs stay narrow: devops and graphql no longer match every yaml or ts file", () => {
  const globsFor = (name) => RULE_CONFIGS.find((config) => config.skillName === name).globs;
  assert.ok(!globsFor("devops").includes("**/*.yml"), "devops does not claim every .yml");
  assert.ok(!globsFor("devops").includes("**/*.yaml"), "devops does not claim every .yaml");
  assert.ok(!globsFor("graphql").includes("**/*.ts"), "graphql does not claim every .ts");
  assert.ok(!globsFor("security-hardening").includes("**/*Config.java"), "security-hardening does not claim every *Config.java");
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

test("every SKILL.md folder on disk is registered in SKILLS", async () => {
  const entries = await fsp.readdir(PACKAGE_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(PACKAGE_ROOT, entry.name, "SKILL.md");
    try { await fsp.stat(skillFile); } catch { continue; }
    assert.ok(SKILLS.includes(entry.name), `SKILLS registers on-disk skill folder '${entry.name}'`);
  }
});

test("package.json ships and maps every registered skill", () => {
  for (const skill of SKILLS) {
    const skillPath = pkg.skills[skill];
    assert.ok(skillPath, `package.json skills maps '${skill}'`);
    assert.ok(skillPath.endsWith("/SKILL.md"), `'${skill}' maps to a SKILL.md path`);
    assert.ok(pkg.files.includes(skillPath), `package.json files includes '${skill}'`);
  }
});

test("package.json does not ship this repository's own .claude rules", () => {
  assert.ok(!pkg.files.some((entry) => entry.startsWith(".claude")), "no .claude entries in files");
});

test("every registered skill has exactly one rule config", () => {
  assert.deepEqual(RULE_CONFIGS.map((cfg) => cfg.skillName), [...SKILLS]);
});

test("all SKILL.md files have YAML frontmatter with name matching the folder", async () => {
  for (const skill of SKILLS) {
    const skillPath = path.join(PACKAGE_ROOT, skill, "SKILL.md");
    const content = (await fsp.readFile(skillPath, "utf8")).replace(/\r\n/g, "\n");
    const fm = parseFrontmatter(content);
    assert.ok(fm, `${skill}/SKILL.md has frontmatter on the first line`);
    assert.equal(fm.name, skill, `${skill}/SKILL.md name matches its folder`);
    assert.ok(fm.description, `${skill}/SKILL.md has description field`);
  }
});

// ── Hook scripts ─────────────────────────────────────────────

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

test("pre-write hook sends its reminder to the model via additionalContext", () => {
  const result = runHook("pre-write.js", { tool_input: { file_path: "src/main/java/com/app/UserService.java" } });
  assert.equal(result.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.match(result.hookSpecificOutput.additionalContext, /constructor injection/);
  assert.equal(result.systemMessage, undefined, "no user-only systemMessage");
});

test("pre-write hook gives Flyway-compatible migration advice", () => {
  const result = runHook("pre-write.js", { tool_input: { file_path: "src/main/resources/db/migration/V5__add_index.sql" } });
  assert.match(result.hookSpecificOutput.additionalContext, /V<n>__description\.sql/);
  assert.doesNotMatch(result.hookSpecificOutput.additionalContext, /YYYYMMDD/);
});

test("pre-write hook stays silent for files without a reminder", () => {
  assert.equal(runHook("pre-write.js", { tool_input: { file_path: "README.md" } }), null);
});

test("pre-bash hook flags dependency additions but not lockfile restores", () => {
  assert.ok(runHook("pre-bash.js", { tool_input: { command: "npm install lodash" } }).hookSpecificOutput.additionalContext);
  assert.ok(runHook("pre-bash.js", { tool_input: { command: "uv add httpx" } }));
  assert.ok(runHook("pre-bash.js", { tool_input: { command: "npm ci && pnpm add zod" } }));
  assert.equal(runHook("pre-bash.js", { tool_input: { command: "npm install" } }), null);
  assert.equal(runHook("pre-bash.js", { tool_input: { command: "pip install -r requirements.txt" } }), null);
  assert.equal(runHook("pre-bash.js", { tool_input: { command: "npm i --save-dev" } }), null);
});

// ── Native Claude skills ─────────────────────────────────────

test("configureClaudeSkills installs every skill into .claude/skills with a marker", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaudeSkills({ projectDir: tmpDir, packageRoot: PACKAGE_ROOT, mode: "copy", platform: "linux" });
    for (const skill of SKILLS) {
      const skillDir = path.join(tmpDir, ".claude", "skills", skill);
      const content = (await fsp.readFile(path.join(skillDir, "SKILL.md"), "utf8")).replace(/\r\n/g, "\n");
      assert.equal(parseFrontmatter(content).name, skill, `${skill} installed with frontmatter`);
      const marker = JSON.parse(await fsp.readFile(path.join(skillDir, MANAGED_MARKER), "utf8"));
      assert.equal(marker.version, pkg.version);
    }
  });
});

test("configureClaudeSkills leaves a user's own skill folder alone unless forced", async () => {
  await withTempDir(async (tmpDir) => {
    const userSkill = path.join(tmpDir, ".claude", "skills", "testing");
    await fsp.mkdir(userSkill, { recursive: true });
    await fsp.writeFile(path.join(userSkill, "SKILL.md"), "my own testing skill", "utf8");

    const results = await configureClaudeSkills({ projectDir: tmpDir, packageRoot: PACKAGE_ROOT, mode: "copy", platform: "linux" });
    assert.ok(results.find((result) => result.skillName === "testing").skipped, "user skill reported as skipped");
    assert.equal(await fsp.readFile(path.join(userSkill, "SKILL.md"), "utf8"), "my own testing skill");

    await unconfigureClaudeSkills({ projectDir: tmpDir, packageRoot: PACKAGE_ROOT });
    assert.ok(await exists(userSkill), "uninstall keeps the user skill");
    assert.ok(!(await exists(path.join(tmpDir, ".claude", "skills", "frontend"))), "uninstall removes our skills");

    await configureClaudeSkills({ projectDir: tmpDir, packageRoot: PACKAGE_ROOT, mode: "copy", platform: "linux", force: true });
    assert.notEqual(await fsp.readFile(path.join(userSkill, "SKILL.md"), "utf8"), "my own testing skill", "--force replaces");
  });
});

test("configureClaudeSkills symlink mode links to the package and reinstalls cleanly", async () => {
  await withTempDir(async (tmpDir) => {
    const options = { projectDir: tmpDir, packageRoot: PACKAGE_ROOT, mode: "symlink", platform: process.platform === "win32" ? "windows" : "linux" };
    await configureClaudeSkills(options);
    const results = await configureClaudeSkills(options);
    assert.ok(results.every((result) => !result.skipped), "our own links are replaceable");
    const linked = await fsp.realpath(path.join(tmpDir, ".claude", "skills", "frontend"));
    assert.equal(linked, await fsp.realpath(path.join(PACKAGE_ROOT, "frontend")));
  });
});

test("configureAgents claude removes legacy rule files and legacy .claude/mcp.json entry", async () => {
  await withTempDir(async (tmpDir) => {
    const legacyRule = path.join(tmpDir, ".claude", "rules", "developer-stack-skills-frontend.md");
    const userRule = path.join(tmpDir, ".claude", "rules", "my-rule.md");
    await fsp.mkdir(path.dirname(legacyRule), { recursive: true });
    await fsp.writeFile(legacyRule, "---\nglobs: [\"**/*.tsx\"]\n---\n", "utf8");
    await fsp.writeFile(userRule, "keep me", "utf8");
    const legacyMcp = path.join(tmpDir, ".claude", "mcp.json");
    await fsp.writeFile(legacyMcp, JSON.stringify({ mcpServers: { "developer-stack-skills": { command: "npx" } } }), "utf8");

    await configureAgents(agentOptions(tmpDir));

    assert.ok(!(await exists(legacyRule)), "legacy rule removed");
    assert.ok(await exists(userRule), "user rule kept");
    assert.ok(!(await exists(legacyMcp)), "legacy mcp file removed");
  });
});

// ── configureClaudeHooks integration ────────────────────────

test("configureClaudeHooks writes hooks under settings.hooks.PreToolUse", async () => {
  await withTempDir(async (tmpDir) => {
    const hooksDir = path.join(tmpDir, ".ai-skills", "developer-stack-skills", "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);

    const settings = JSON.parse(await fsp.readFile(path.join(tmpDir, ".claude", "settings.json"), "utf8"));

    assert.equal(settings.PreToolUse, undefined, "nothing at the top level");
    assert.ok(Array.isArray(settings.hooks.PreToolUse), "hooks.PreToolUse is array");

    const writeHook = settings.hooks.PreToolUse.find((h) => h.matcher === "Write|Edit|MultiEdit");
    assert.ok(writeHook, "Write|Edit|MultiEdit hook present");
    assert.match(writeHook.hooks[0].command, /pre-write\.js/, "pre-write.js referenced");

    const bashHook = settings.hooks.PreToolUse.find((h) => h.matcher === "Bash");
    assert.ok(bashHook, "Bash hook present");
    assert.match(bashHook.hooks[0].command, /pre-bash\.js/, "pre-bash.js referenced");
  });
});

test("configureClaudeHooks migrates legacy top-level PreToolUse entries", async () => {
  await withTempDir(async (tmpDir) => {
    const hooksDir = path.join(tmpDir, "hooks");
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    const legacyEntry = { matcher: "Write|Edit", hooks: [{ type: "command", command: `node ${JSON.stringify(path.join(hooksDir, "pre-write.js"))}` }] };
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, JSON.stringify({ PreToolUse: [legacyEntry], model: "sonnet" }), "utf8");

    await configureClaudeHooks(tmpDir, hooksDir);

    const settings = JSON.parse(await fsp.readFile(settingsFile, "utf8"));
    assert.equal(settings.PreToolUse, undefined, "legacy key removed");
    assert.equal(settings.hooks.PreToolUse.length, 2);
    assert.equal(settings.model, "sonnet");
  });
});

test("configureClaudeHooks is idempotent — re-run produces same output", async () => {
  await withTempDir(async (tmpDir) => {
    const hooksDir = path.join(tmpDir, ".ai-skills", "developer-stack-skills", "hooks");
    await configureClaudeHooks(tmpDir, hooksDir);
    await configureClaudeHooks(tmpDir, hooksDir); // run twice

    const settings = JSON.parse(await fsp.readFile(path.join(tmpDir, ".claude", "settings.json"), "utf8"));
    const ourHooks = settings.hooks.PreToolUse.filter((h) =>
      (h.hooks || []).some((hk) => hk.command && hk.command.includes("developer-stack-skills")),
    );
    assert.equal(ourHooks.length, 2, "exactly 2 our hooks — not doubled");
  });
});

test("configureClaudeHooks preserves existing non-hook settings and other hooks", async () => {
  await withTempDir(async (tmpDir) => {
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    const otherHook = { matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] };
    const existingSettings = {
      permissions: { allow: ["Bash(git:*)"] },
      model: "sonnet",
      hooks: { PreToolUse: [otherHook], Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }] },
    };
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, JSON.stringify(existingSettings, null, 2), "utf8");

    await configureClaudeHooks(tmpDir, path.join(tmpDir, "hooks"));

    const result = JSON.parse(await fsp.readFile(settingsFile, "utf8"));
    assert.deepEqual(result.permissions, existingSettings.permissions, "permissions preserved");
    assert.equal(result.model, "sonnet", "model preserved");
    assert.deepEqual(result.hooks.PreToolUse[0], otherHook, "user hook preserved");
    assert.deepEqual(result.hooks.Stop, existingSettings.hooks.Stop, "other events preserved");
    assert.equal(result.hooks.PreToolUse.length, 3, "our two hooks added");
  });
});

test("removeOurHookEntries removes exact custom-root hooks and preserves unrelated hooks", () => {
  const hooksDir = path.join("C:", "custom", "hooks");
  const managed = {
    matcher: "Bash",
    hooks: [{ type: "command", command: `node ${JSON.stringify(path.join(hooksDir, "pre-bash.js"))}` }],
  };
  const unrelated = {
    matcher: "Bash",
    hooks: [{ type: "command", command: "node C:\\tools\\developer-stack-skills-helper.js" }],
  };

  assert.deepEqual(removeOurHookEntries([managed, unrelated], hooksDir), [unrelated]);
});

test("configureClaudeHooks rejects invalid JSON without changing the file", async () => {
  await withTempDir(async (tmpDir) => {
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, "{ this is not valid json }", "utf8");

    await assert.rejects(
      configureClaudeHooks(tmpDir, path.join(tmpDir, "hooks")),
      /invalid JSON; Claude hooks were not changed/,
    );

    assert.equal(await fsp.readFile(settingsFile, "utf8"), "{ this is not valid json }", "invalid JSON file left untouched");
  });
});

// ── Full lifecycle ───────────────────────────────────────────

test("custom-root lifecycle is idempotent and removes everything it created", async () => {
  await withTempDir(async (tmpDir) => {
    const installRoot = path.join(tmpDir, "custom-root");
    const args = {
      agent: "claude",
      mode: "copy",
      platform: process.platform,
      projectDir: tmpDir,
      installRoot,
      yes: true,
      dryRun: false,
    };

    await runInstall(args, { packageInstallType: "source", projectDir: tmpDir });
    await runInstall(args, { packageInstallType: "source", projectDir: tmpDir });

    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    const settings = JSON.parse(await fsp.readFile(settingsFile, "utf8"));
    assert.equal(settings.hooks.PreToolUse.length, 2, "reinstall keeps exactly two managed hooks");
    assert.ok(await exists(path.join(installRoot, "hooks", "skills.js")), "copied hooks carry the skill registry");
    assert.ok(await exists(path.join(tmpDir, ".claude", "skills", "java-spring", "SKILL.md")), "native skills installed");
    assert.ok(await exists(path.join(tmpDir, ".mcp.json")), "Claude MCP server registered at project root");

    const doctor = await runDoctor({ projectDir: tmpDir, installRoot });
    assert.equal(doctor.errors, 0, JSON.stringify(doctor.results));

    await runUninstall({ ...args, command: "uninstall" }, { packageInstallType: "source", projectDir: tmpDir });
    await assert.rejects(fsp.stat(settingsFile), { code: "ENOENT" }, "managed-only settings file removed");
    assert.ok(!(await exists(path.join(tmpDir, ".claude", "skills", "java-spring"))), "native skills removed");
    assert.ok(!(await exists(path.join(tmpDir, ".mcp.json"))), "MCP entry removed");
    assert.ok(!(await exists(path.join(tmpDir, "CLAUDE.md"))), "managed-only CLAUDE.md removed");
  });
});

test("copied pre-write hook runs from the install root without the package lib", async () => {
  await withTempDir(async (tmpDir) => {
    const installRoot = path.join(tmpDir, "root");
    await runInstall(
      { agent: "claude", mode: "copy", platform: process.platform, projectDir: tmpDir, installRoot, yes: true },
      { packageInstallType: "source", projectDir: tmpDir },
    );
    const output = execFileSync(process.execPath, [path.join(installRoot, "hooks", "pre-write.js")], {
      input: JSON.stringify({ tool_input: { file_path: "app/main.py" } }),
      encoding: "utf8",
    });
    assert.match(JSON.parse(output).hookSpecificOutput.additionalContext, /Pydantic/);
  });
});

test("platform-global install skips hooks and never replaces a user's skill", async () => {
  await withTempDir(async (tmpDir) => {
    const globalRoot = path.join(tmpDir, "home", ".claude", "skills");
    const userSkill = path.join(globalRoot, "frontend");
    await fsp.mkdir(userSkill, { recursive: true });
    await fsp.writeFile(path.join(userSkill, "SKILL.md"), "mine", "utf8");

    const originalHome = process.env.HOME;
    const originalProfile = process.env.USERPROFILE;
    process.env.HOME = path.join(tmpDir, "home");
    process.env.USERPROFILE = path.join(tmpDir, "home");
    try {
      const args = { agent: "claude", global: true, mode: "copy", platform: process.platform, projectDir: tmpDir, yes: true };
      await runInstall(args, { packageInstallType: "local", projectDir: tmpDir });
      assert.equal(await fsp.readFile(path.join(userSkill, "SKILL.md"), "utf8"), "mine");
      assert.ok(await exists(path.join(globalRoot, "testing", "SKILL.md")), "our skills installed");
      assert.ok(!(await exists(path.join(globalRoot, "hooks"))), "no hooks folder among skills");

      await runUninstall({ ...args, command: "uninstall" }, { packageInstallType: "local", projectDir: tmpDir });
      assert.ok(await exists(userSkill), "uninstall keeps the user's skill");
      assert.ok(!(await exists(path.join(globalRoot, "testing"))), "uninstall removes ours");
    } finally {
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalProfile;
    }
  });
});

// ── configureCursor integration ──────────────────────────────

test("configureCursor creates one .mdc per skill with matching frontmatter", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursor(tmpDir, PACKAGE_ROOT);

    for (const config of RULE_CONFIGS) {
      const mdc = path.join(tmpDir, ".cursor", "rules", `developer-stack-skills-${config.skillName}.mdc`);
      const fm = parseFrontmatter(await fsp.readFile(mdc, "utf8"));

      assert.ok(fm, `${config.skillName}.mdc has frontmatter`);
      assert.equal(fm.alwaysApply, String(config.alwaysApply === true));
      if (config.alwaysApply || config.globs.length === 0) {
        assert.ok(!fm.globs, `${config.skillName}.mdc omits globs`);
      } else {
        assert.ok(fm.globs, `${config.skillName}.mdc has globs`);
      }
    }
  });
});

// ── Skill index for path-based agents ───────────────────────

test("configureRoocode writes a skill index with one line per skill", async () => {
  await withTempDir(async (tmpDir) => {
    await configureRoocode(tmpDir, PACKAGE_ROOT);

    const content = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.match(content, /Developer Stack Skills/, "has heading");
    assert.match(content, /Read only the skill files that match/, "on-demand instruction");
    for (const skillPath of buildSkillPaths(PACKAGE_ROOT)) {
      assert.ok(content.includes(skillPath), `contains ${skillPath}`);
    }
  });
});

test("configureCline non-MCP mode writes an on-demand skill index", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCline(tmpDir, PACKAGE_ROOT, false);
    const result = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(result, /Read only the skill files that match/, "on-demand instruction");
    assert.match(result, /`java-spring` — Java 25/, "skill described");
    assert.ok(!result.includes("detect_stack"), "no MCP tool mention");
    assert.ok(!/before starting work/.test(result), "no preload-everything instruction");
  });
});

test("configureCline MCP mode writes detect_stack instructions", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCline(tmpDir, PACKAGE_ROOT, true);
    const result = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack mentioned");
    assert.match(result, /get_skill/, "get_skill mentioned");
    assert.match(result, /get_conventions/, "get_conventions mentioned");
    assert.ok(!result.includes("Read only the skill files"), "no path-based instruction");
  });
});

test("configureRoocode MCP mode writes detect_stack instructions", async () => {
  await withTempDir(async (tmpDir) => {
    await configureRoocode(tmpDir, PACKAGE_ROOT, true);
    const result = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack mentioned");
    assert.match(result, /get_skill/, "get_skill mentioned");
    assert.ok(!result.includes("Read only the skill files"), "no path-based instruction");
  });
});

test("configureCline preserves user content outside managed block", async () => {
  await withTempDir(async (tmpDir) => {
    const clinerules = path.join(tmpDir, ".clinerules");
    await fsp.writeFile(clinerules, "# My custom rules\n\nAlways write tests.\n", "utf8");

    await configureCline(tmpDir, PACKAGE_ROOT);

    const result = await fsp.readFile(clinerules, "utf8");
    assert.match(result, /My custom rules/, "custom heading preserved");
    assert.match(result, /Always write tests/, "custom rule preserved");
    assert.match(result, /developer-stack-skills:start/, "managed block added");
  });
});

// ── buildMcpCommand ──────────────────────────────────────────

test("buildMcpCommand global uses the installed binary", () => {
  assert.deepEqual(buildMcpCommand("global", "linux"), { command: "developer-stack-skills", args: ["serve"] });
});

test("buildMcpCommand local and npx use non-interactive npx", () => {
  assert.deepEqual(buildMcpCommand("local", "macos"), { command: "npx", args: ["-y", "developer-stack-skills", "serve"] });
  assert.deepEqual(buildMcpCommand("npx", "linux"), { command: "npx", args: ["-y", "developer-stack-skills", "serve"] });
});

test("buildMcpCommand wraps npm shims in cmd /c on Windows", () => {
  assert.deepEqual(buildMcpCommand("local", "windows"), { command: "cmd", args: ["/c", "npx", "-y", "developer-stack-skills", "serve"] });
  assert.deepEqual(buildMcpCommand("global", "windows"), { command: "cmd", args: ["/c", "developer-stack-skills", "serve"] });
});

test("buildMcpCommand source checkout runs its own bin with node", () => {
  const result = buildMcpCommand("source", "windows", PACKAGE_ROOT);
  assert.equal(result.command, "node");
  assert.deepEqual(result.args, [path.join(PACKAGE_ROOT, "bin", "developer-stack-skills.js"), "serve"]);
});

// ── MCP config files ─────────────────────────────────────────

test("configureMcp registers the Claude MCP server in root .mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureMcp(tmpDir, "global", false, "linux");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.equal(result.mcpServers["developer-stack-skills"].command, "developer-stack-skills");
    assert.ok(!(await exists(path.join(tmpDir, ".claude", "mcp.json"))), "no .claude/mcp.json");
  });
});

test("configureCursorMcp writes to .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "global", false, "linux");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.equal(result.mcpServers["developer-stack-skills"].command, "developer-stack-skills");
    assert.equal(result.mcpServers["developer-stack-skills"].type, "stdio");
  });
});

test("configureSharedMcp writes to .mcp.json at project root", async () => {
  await withTempDir(async (tmpDir) => {
    await configureSharedMcp(tmpDir, "local", false, "linux");
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
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

test("writeMcpJsonFile rejects invalid JSON without changing the file", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
    await fsp.writeFile(mcpFile, "{ bad json }", "utf8");
    await assert.rejects(
      writeMcpJsonFile(mcpFile, "local"),
      /invalid JSON; MCP configuration was not changed/,
    );
    assert.equal(await fsp.readFile(mcpFile, "utf8"), "{ bad json }", "invalid JSON file left untouched");
  });
});

test("removeMcpJsonEntry removes our entry, preserves others", async () => {
  await withTempDir(async (tmpDir) => {
    const mcpFile = path.join(tmpDir, ".mcp.json");
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
    await fsp.writeFile(mcpFile, JSON.stringify({ mcpServers: { "developer-stack-skills": { command: "npx" } } }), "utf8");
    await removeMcpJsonEntry(mcpFile);
    await assert.rejects(fsp.stat(mcpFile), { code: "ENOENT" }, "file deleted when empty");
  });
});

test("removeMcpJsonEntry is no-op when file does not exist", async () => {
  await withTempDir(async (tmpDir) => {
    await assert.doesNotReject(() => removeMcpJsonEntry(path.join(tmpDir, "nonexistent.json")), "handles missing file gracefully");
  });
});

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

test("MCP config writers are idempotent", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCursorMcp(tmpDir, "global");
    await configureCursorMcp(tmpDir, "global");
    await configureSharedMcp(tmpDir, "local");
    await configureSharedMcp(tmpDir, "local");
    const cursor = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    const shared = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.equal(Object.keys(cursor.mcpServers).length, 1);
    assert.equal(Object.keys(shared.mcpServers).length, 1);
  });
});

test("configureCline and configureRoocode MCP modes are idempotent", async () => {
  await withTempDir(async (tmpDir) => {
    await configureCline(tmpDir, PACKAGE_ROOT, true);
    await configureRoocode(tmpDir, PACKAGE_ROOT, true);
    const cline = await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8");
    const roo = await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8");
    await configureCline(tmpDir, PACKAGE_ROOT, true);
    await configureRoocode(tmpDir, PACKAGE_ROOT, true);
    assert.equal(await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8"), cline);
    assert.equal(await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8"), roo);
  });
});

// ── configureAgents routing ──────────────────────────────────

test("configureAgents cursor+MCP creates .cursor/mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "cursor", configureMcpServer: true }));
    const result = JSON.parse(await fsp.readFile(path.join(tmpDir, ".cursor", "mcp.json"), "utf8"));
    assert.ok(result.mcpServers["developer-stack-skills"], "cursor MCP configured");
  });
});

test("configureAgents cline+MCP creates .mcp.json and MCP-first .clinerules", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "cline", configureMcpServer: true }));
    const mcpResult = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(mcpResult.mcpServers["developer-stack-skills"], "shared MCP configured");
    assert.match(await fsp.readFile(path.join(tmpDir, ".clinerules"), "utf8"), /detect_stack/);
  });
});

test("configureAgents roocode+MCP creates .mcp.json and MCP-first rule file", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "roocode", configureMcpServer: true }));
    const mcpResult = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(mcpResult.mcpServers["developer-stack-skills"], "shared MCP configured");
    assert.match(await fsp.readFile(path.join(tmpDir, ".roo", "rules", "developer-stack-skills.md"), "utf8"), /detect_stack/);
  });
});

test("configureAgents copilot+MCP does not create .mcp.json", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "copilot", configureMcpServer: true }));
    await assert.rejects(fsp.stat(path.join(tmpDir, ".mcp.json")), { code: "ENOENT" }, "no .mcp.json for copilot");
    assert.match(await fsp.readFile(path.join(tmpDir, ".github", "copilot-instructions.md"), "utf8"), /Read only the skill files/);
  });
});

test("configureAgents without MCP does not create any MCP files", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "cursor" }));
    await assert.rejects(fsp.stat(path.join(tmpDir, ".cursor", "mcp.json")), { code: "ENOENT" }, "no cursor MCP when disabled");
  });
});

test("configureAgents writes native project artifacts for extended platforms", async () => {
  await withTempDir(async (tmpDir) => {
    for (const agent of ["gemini", "kiro", "antigravity"]) {
      await configureAgents(agentOptions(tmpDir, { agent }));
    }

    assert.match(await fsp.readFile(path.join(tmpDir, "GEMINI.md"), "utf8"), /developer-stack-skills:start/);
    assert.match(await fsp.readFile(path.join(tmpDir, ".kiro", "steering", "developer-stack-skills.md"), "utf8"), /java-spring/);
    assert.match(await fsp.readFile(path.join(tmpDir, ".agent", "rules", "developer-stack-skills.md"), "utf8"), /project-conventions/);
  });
});

test("configureAgents uses AGENTS.md fallback for portable platforms", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "codex" }));

    const instructions = await fsp.readFile(path.join(tmpDir, "AGENTS.md"), "utf8");
    assert.match(instructions, /developer-stack-skills:start/);
    assert.match(instructions, /testing[\\/]SKILL\.md/);
    assert.doesNotMatch(instructions, /Follow every/, "no load-everything instruction");
  });
});

test("configureAgents all writes each config format once", async () => {
  await withTempDir(async (tmpDir) => {
    const configured = await configureAgents(agentOptions(tmpDir, { agent: "all", configureMcpServer: true }));
    const agentsMdWrites = configured.filter((item) => item.filePath === path.join(tmpDir, "AGENTS.md"));
    const sharedMcpWrites = configured.filter((item) => item.filePath === path.join(tmpDir, ".mcp.json"));
    assert.equal(agentsMdWrites.length, 1, "AGENTS.md written once");
    assert.equal(sharedMcpWrites.length, 1, ".mcp.json written once");
  });
});

// ── Agent auto-detection ─────────────────────────────────────

test("detectAgents finds agents from project markers", async () => {
  await withTempDir(async (tmpDir) => {
    await fsp.mkdir(path.join(tmpDir, ".cursor"));
    await fsp.writeFile(path.join(tmpDir, ".clinerules"), "", "utf8");
    assert.deepEqual(await detectAgents(tmpDir), ["cursor", "cline"]);
  });
});

test("detectAgents falls back to Claude plus AGENTS.md in an empty project", async () => {
  await withTempDir(async (tmpDir) => {
    assert.deepEqual(await detectAgents(tmpDir), ["claude", "generic"]);
  });
});

test("getAgentTargets keeps explicit agents and expands auto/all", async () => {
  await withTempDir(async (tmpDir) => {
    assert.deepEqual(await getAgentTargets("codex", tmpDir), ["codex"]);
    assert.deepEqual(await getAgentTargets("auto", tmpDir), ["claude", "generic"]);
    const all = await getAgentTargets("all", tmpDir);
    assert.ok(all.includes("claude") && all.includes("generic"));
    assert.ok(!all.includes("codex"), "AGENTS.md platforms collapse into generic");
  });
});

// ── Shared .mcp.json ownership on uninstall ──────────────────

test("uninstalling one agent keeps the shared MCP entry another agent still uses", async () => {
  await withTempDir(async (tmpDir) => {
    await configureAgents(agentOptions(tmpDir, { agent: "claude", configureMcpServer: true }));
    await configureAgents(agentOptions(tmpDir, { agent: "cline", configureMcpServer: true }));

    await unconfigureAgents({ agent: "cline", projectDir: tmpDir, installRoot: PACKAGE_ROOT, packageRoot: PACKAGE_ROOT });
    const shared = JSON.parse(await fsp.readFile(path.join(tmpDir, ".mcp.json"), "utf8"));
    assert.ok(shared.mcpServers["developer-stack-skills"], "Claude still uses the entry");

    await unconfigureAgents({ agent: "claude", projectDir: tmpDir, installRoot: PACKAGE_ROOT, packageRoot: PACKAGE_ROOT });
    assert.ok(!(await exists(path.join(tmpDir, ".mcp.json"))), "entry removed once no agent uses it");
  });
});

// ── Cross-platform path safety ───────────────────────────────

test("buildSkillPaths uses OS-native separators", () => {
  const installRoot = path.join("C:", "Users", "user", ".ai-skills", "developer-stack-skills");
  for (const p of buildSkillPaths(installRoot)) {
    const hasMixed = p.includes("/") && p.includes("\\");
    assert.ok(!hasMixed, `No mixed separators in: ${p}`);
    assert.ok(p.endsWith("SKILL.md"), "ends with SKILL.md");
  }
});

// ── CLAUDE.md managed block ──────────────────────────────────

test("configureClaude preserves user content outside managed block", async () => {
  await withTempDir(async (tmpDir) => {
    const claudeMd = path.join(tmpDir, "CLAUDE.md");
    await fsp.writeFile(claudeMd, "# My project\n\nUse TypeScript everywhere.\n", "utf8");

    await configureClaude(tmpDir, null);

    const result = await fsp.readFile(claudeMd, "utf8");
    assert.match(result, /My project/, "heading preserved");
    assert.match(result, /Use TypeScript everywhere/, "custom rule preserved");
    assert.match(result, /developer-stack-skills:start/, "managed block added");
  });
});

test("configureClaude points at native skills and names the always-on skills", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaude(tmpDir, null, false);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /\.claude\/skills\//, "native skills referenced");
    assert.match(result, /`loop-engineering`/, "always-on skill named");
    assert.ok(!result.includes("detect_stack"), "no MCP mention without MCP");
    assert.ok(!/SKILL\.md/.test(result), "no file paths to preload");
  });
});

test("configureClaude MCP mode mentions detect_stack without mandating preloading", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaude(tmpDir, null, true);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /detect_stack/, "detect_stack tool mentioned");
    assert.ok(!/before editing any file/.test(result), "no mandatory per-edit tool calls");
  });
});

test("configureClaude keeps the project context block", async () => {
  await withTempDir(async (tmpDir) => {
    await configureClaude(tmpDir, { description: "E-commerce API", testCmd: "mvn test" }, true);

    const result = await fsp.readFile(path.join(tmpDir, "CLAUDE.md"), "utf8");
    assert.match(result, /E-commerce API/, "project description present");
    assert.match(result, /mvn test/, "test command present");
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

// ── doctor ───────────────────────────────────────────────────

test("doctor reports a missing install and legacy Claude config", async () => {
  await withTempDir(async (tmpDir) => {
    const settingsFile = path.join(tmpDir, ".claude", "settings.json");
    await fsp.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsp.writeFile(settingsFile, JSON.stringify({
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node \"/x/developer-stack-skills/hooks/pre-bash.js\"" }] }],
    }), "utf8");
    await fsp.writeFile(path.join(tmpDir, ".claude", "mcp.json"), JSON.stringify({ mcpServers: { "developer-stack-skills": {} } }), "utf8");

    const report = await runDoctor({ projectDir: tmpDir, installRoot: path.join(tmpDir, "nowhere") });
    const messages = report.results.map((result) => `${result.level}: ${result.message}`).join("\n");
    assert.match(messages, /error: no installation found/);
    assert.match(messages, /error: .*top-level "PreToolUse"/);
    assert.match(messages, /warn: .*never reads/);
    assert.ok(report.errors >= 2);
  });
});

test("doctor flags copied skills from an older version", async () => {
  await withTempDir(async (tmpDir) => {
    const installRoot = path.join(tmpDir, "root");
    await runInstall(
      { agent: "codex", mode: "copy", platform: process.platform, projectDir: tmpDir, installRoot, yes: true },
      { packageInstallType: "source", projectDir: tmpDir },
    );
    await fsp.writeFile(path.join(installRoot, "testing", MANAGED_MARKER), JSON.stringify({ version: "0.0.1" }), "utf8");

    const report = await runDoctor({ projectDir: tmpDir, installRoot });
    assert.equal(report.errors, 0);
    assert.ok(report.results.some((result) => result.level === "warn" && /testing is version 0\.0\.1/.test(result.message)));
  });
});
