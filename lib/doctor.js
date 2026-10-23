const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const { SKILL_NAMES } = require("./skills");
const { MANAGED_MARKER } = require("./installer");

const PACKAGE_NAME = "developer-stack-skills";

function getPackageVersion() {
  return require(path.join(__dirname, "..", "package.json")).version;
}

async function inspectPath(targetPath) {
  try {
    const stat = await fsp.lstat(targetPath);
    if (!stat.isSymbolicLink()) return { exists: true, link: false, broken: false };
    try {
      await fsp.stat(targetPath);
      return { exists: true, link: true, broken: false };
    } catch {
      return { exists: true, link: true, broken: true };
    }
  } catch {
    return { exists: false, link: false, broken: false };
  }
}

async function readJson(filePath) {
  let raw;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { missing: true };
    throw error;
  }
  try {
    return { value: JSON.parse(raw) };
  } catch (error) {
    return { invalid: error.message };
  }
}

async function readMarkerVersion(skillDir) {
  const marker = await readJson(path.join(skillDir, MANAGED_MARKER));
  return marker.value ? marker.value.version : null;
}

function createReport() {
  const results = [];
  const add = (level, message) => results.push({ level, message });
  return {
    results,
    ok: (message) => add("ok", message),
    warn: (message) => add("warn", message),
    error: (message) => add("error", message),
  };
}

// Checks one directory of installed skill folders (install root or .claude/skills)
async function checkSkillDirs(report, label, rootDir, version, { required }) {
  let healthy = 0;
  for (const skillName of SKILL_NAMES) {
    const skillDir = path.join(rootDir, skillName);
    const state = await inspectPath(skillDir);
    if (!state.exists) {
      if (required) report.error(`${label}: ${skillName} is missing (${skillDir})`);
      continue;
    }
    if (state.broken) {
      report.error(`${label}: ${skillName} is a broken link (${skillDir}); rerun install`);
      continue;
    }
    if (!(await inspectPath(path.join(skillDir, "SKILL.md"))).exists) {
      report.error(`${label}: ${skillName}/SKILL.md is missing`);
      continue;
    }
    const installedVersion = state.link ? null : await readMarkerVersion(skillDir);
    if (installedVersion && installedVersion !== version) {
      report.warn(`${label}: ${skillName} is version ${installedVersion}, package is ${version}; rerun install to update`);
    }
    healthy += 1;
  }
  if (healthy) report.ok(`${label}: ${healthy}/${SKILL_NAMES.length} skills present`);
}

function hookCommands(entries) {
  return (entries || []).flatMap((entry) => (entry.hooks || []).map((hook) => hook.command)).filter((command) => typeof command === "string");
}

async function checkClaudeSettings(report, projectDir) {
  const filePath = path.join(projectDir, ".claude", "settings.json");
  const settings = await readJson(filePath);
  if (settings.missing) return;
  if (settings.invalid) {
    report.error(`${filePath} is invalid JSON: ${settings.invalid}`);
    return;
  }
  const legacy = hookCommands(settings.value.PreToolUse).filter((command) => command.includes(PACKAGE_NAME));
  if (legacy.length) {
    report.error(`${filePath} has hooks under top-level "PreToolUse", which Claude Code ignores; rerun install to move them under "hooks"`);
  }
  const ours = hookCommands(settings.value.hooks && settings.value.hooks.PreToolUse).filter((command) => command.includes(PACKAGE_NAME));
  for (const command of ours) {
    const match = /^node\s+"(.+)"$/.exec(command);
    const scriptPath = match ? JSON.parse(`"${match[1]}"`) : null;
    if (scriptPath && !(await inspectPath(scriptPath)).exists) {
      report.error(`Claude hook script missing: ${scriptPath}; rerun install`);
    }
  }
  if (ours.length) report.ok(`Claude hooks configured (${ours.length})`);
}

async function checkMcpFile(report, filePath, { legacy = false } = {}) {
  const config = await readJson(filePath);
  if (config.missing) return;
  if (config.invalid) {
    report.error(`${filePath} is invalid JSON: ${config.invalid}`);
    return;
  }
  const entry = config.value.mcpServers && config.value.mcpServers[PACKAGE_NAME];
  if (!entry) return;
  if (legacy) {
    report.warn(`${filePath} has a ${PACKAGE_NAME} entry Claude Code never reads; rerun install to move it to .mcp.json`);
    return;
  }
  const scriptArg = (entry.args || []).find((arg) => typeof arg === "string" && arg.endsWith(".js"));
  if (entry.command === "node" && scriptArg && path.isAbsolute(scriptArg) && !(await inspectPath(scriptArg)).exists) {
    report.error(`${filePath}: MCP server script missing: ${scriptArg}`);
    return;
  }
  report.ok(`MCP server registered in ${filePath}`);
}

async function checkLegacyRules(report, projectDir) {
  let files = [];
  try {
    files = await fsp.readdir(path.join(projectDir, ".claude", "rules"));
  } catch {
    return;
  }
  const legacy = files.filter((file) => file.startsWith(`${PACKAGE_NAME}-`) && file.endsWith(".md"));
  if (legacy.length) {
    report.warn(`${legacy.length} legacy .claude/rules/${PACKAGE_NAME}-*.md files load every skill unconditionally; rerun install to replace them with .claude/skills`);
  }
}

async function resolveInstallRoot(projectDir, installRoot) {
  if (installRoot) return path.resolve(installRoot);
  const projectRoot = path.join(projectDir, ".ai-skills", PACKAGE_NAME);
  if ((await inspectPath(projectRoot)).exists) return projectRoot;
  return path.join(os.homedir(), ".ai-skills", PACKAGE_NAME);
}

/**
 * Read-only health check of an installation. Never modifies files; every problem names its fix.
 * Returns the report; the caller decides the exit code (non-zero when any error is found).
 */
async function runDoctor({ projectDir = process.cwd(), installRoot = null } = {}) {
  const report = createReport();
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedInstallRoot = await resolveInstallRoot(resolvedProjectDir, installRoot);
  const version = getPackageVersion();

  if ((await inspectPath(resolvedInstallRoot)).exists) {
    await checkSkillDirs(report, "install root", resolvedInstallRoot, version, { required: true });
    const hooksDir = path.join(resolvedInstallRoot, "hooks");
    if ((await inspectPath(hooksDir)).exists) {
      const hooks = await inspectPath(path.join(hooksDir, "pre-write.js"));
      if (!hooks.exists) report.error(`hooks are missing or broken (${hooksDir}); rerun install`);
    }
  } else {
    report.error(`no installation found at ${resolvedInstallRoot}; run "${PACKAGE_NAME} install"`);
  }

  const claudeSkillsDir = path.join(resolvedProjectDir, ".claude", "skills");
  if ((await inspectPath(claudeSkillsDir)).exists) {
    await checkSkillDirs(report, ".claude/skills", claudeSkillsDir, version, { required: false });
  }

  await checkClaudeSettings(report, resolvedProjectDir);
  await checkMcpFile(report, path.join(resolvedProjectDir, ".mcp.json"));
  await checkMcpFile(report, path.join(resolvedProjectDir, ".cursor", "mcp.json"));
  await checkMcpFile(report, path.join(resolvedProjectDir, ".claude", "mcp.json"), { legacy: true });
  await checkLegacyRules(report, resolvedProjectDir);

  const errors = report.results.filter((result) => result.level === "error").length;
  const warnings = report.results.filter((result) => result.level === "warn").length;
  return { projectDir: resolvedProjectDir, installRoot: resolvedInstallRoot, version, results: report.results, errors, warnings };
}

function printDoctorReport(report) {
  console.log(`[${PACKAGE_NAME}] doctor ${report.version}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${report.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${report.installRoot}`);
  for (const result of report.results) {
    console.log(`  [${result.level}] ${result.message}`);
  }
  console.log(`[${PACKAGE_NAME}] ${report.errors} error(s), ${report.warnings} warning(s)`);
}

module.exports = { printDoctorReport, runDoctor };
