const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const PACKAGE_NAME = "developer-stack-skills";
const MANAGED_START = "developer-stack-skills:start";
const MANAGED_END = "developer-stack-skills:end";

const AGENTS = ["all", "claude", "cursor", "cline", "roocode", "copilot"];
const MODES = ["copy", "symlink"];

const SKILLS = [
  "java-spring",
  "python-backend",
  "frontend",
  "testing",
  "project-conventions",
];

function detectPlatform() {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    default:
      return "linux";
  }
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || "help",
    agent: null,
    mode: null,
    projectDir: null,
    dryRun: false,
    yes: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--yes" || token === "-y") {
      args.yes = true;
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token.startsWith("--agent=")) {
      args.agent = token.slice("--agent=".length);
      continue;
    }

    if (token === "--agent") {
      args.agent = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (token.startsWith("--mode=")) {
      args.mode = token.slice("--mode=".length);
      continue;
    }

    if (token === "--mode") {
      args.mode = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (token.startsWith("--dir=")) {
      args.projectDir = token.slice("--dir=".length);
      continue;
    }

    if (token === "--dir") {
      args.projectDir = argv[index + 1] || null;
      index += 1;
    }
  }

  return args;
}

function normalizeAgent(agent) {
  if (!agent) {
    return null;
  }

  const normalized = agent.trim().toLowerCase();
  if (normalized === "roo") {
    return "roocode";
  }
  if (normalized === "github-copilot") {
    return "copilot";
  }
  return normalized;
}

function normalizeMode(mode) {
  return mode ? mode.trim().toLowerCase() : null;
}

function printHelp() {
  console.log(`${PACKAGE_NAME} installer`);
  console.log("");
  console.log("Usage:");
  console.log("  developer-stack-skills install");
  console.log("  developer-stack-skills uninstall");
  console.log("  developer-stack-skills version");
  console.log("  developer-stack-skills help");
  console.log("  developer-stack-skills install --agent all --mode symlink --dir .");
  console.log("  npx developer-stack-skills install --agent cline --mode copy --dry-run");
  console.log("");
  console.log("Commands:");
  console.log("  install      install skills and update agent config");
  console.log("  uninstall    remove installed skills and agent config entries");
  console.log("  version      print package version");
  console.log("  help         print this help");
  console.log("");
  console.log("Options:");
  console.log("  --agent <all|claude|cursor|cline|roocode|copilot>");
  console.log("  --mode <copy|symlink>");
  console.log("  --dir <project-directory>");
  console.log("  --dry-run");
  console.log("  --yes");
}

function printVersion() {
  console.log(getVersion());
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask(question) {
      return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
      });
    },
    close() {
      rl.close();
    },
  };
}

async function chooseValue(prompt, question, options, fallback) {
  const answer = await prompt.ask(question);
  const normalized = answer ? answer.trim().toLowerCase() : fallback;

  if (!normalized) {
    throw new Error(`Missing required value. Allowed: ${options.join(", ")}`);
  }

  if (!options.includes(normalized)) {
    throw new Error(`Invalid value "${answer}". Allowed: ${options.join(", ")}`);
  }

  return normalized;
}

function getPackageRoot() {
  return path.resolve(__dirname, "..");
}

function getVersion() {
  const packageJson = require(path.join(getPackageRoot(), "package.json"));
  return packageJson.version;
}

function detectPackageInstallType(packageRoot, projectDir) {
  const normalizedPackageRoot = path.resolve(packageRoot);
  const normalizedProjectDir = path.resolve(projectDir);
  const localNodeModulesRoot = path.resolve(projectDir, "node_modules", PACKAGE_NAME);

  if (normalizedPackageRoot === normalizedProjectDir) {
    return "source";
  }

  return normalizedPackageRoot === localNodeModulesRoot ? "local" : "global";
}

function getInstallRoot(projectDir, packageInstallType) {
  if (packageInstallType === "global") {
    return path.join(os.homedir(), ".ai-skills", PACKAGE_NAME);
  }

  return path.join(projectDir, ".ai-skills", PACKAGE_NAME);
}

function getDefaultProjectDir(env = process.env, cwd = process.cwd()) {
  return path.resolve(env.INIT_CWD || cwd);
}

function getDefaultMode(packageInstallType) {
  return packageInstallType === "local" ? "copy" : "symlink";
}

function isInteractiveInstall(env = process.env) {
  if (env.DEVELOPER_STACK_SKILLS_SKIP_POSTINSTALL === "1") {
    return false;
  }

  return Boolean(process.stdin.isTTY && process.stdout.isTTY && env.CI !== "true");
}

function getSkillSourcePath(packageRoot, skillName) {
  return path.join(packageRoot, skillName);
}

function getSkillDestPath(installRoot, skillName) {
  return path.join(installRoot, skillName);
}

async function ensureDir(dirPath, dryRun = false) {
  if (dryRun) {
    return;
  }
  await fsp.mkdir(dirPath, { recursive: true });
}

async function removePath(targetPath, dryRun = false) {
  if (dryRun) {
    return;
  }
  await fsp.rm(targetPath, { recursive: true, force: true });
}

async function installSkill({ packageRoot, installRoot, skillName, mode, platform, dryRun = false }) {
  const sourcePath = getSkillSourcePath(packageRoot, skillName);
  const destPath = getSkillDestPath(installRoot, skillName);

  await removePath(destPath, dryRun);

  if (mode === "copy") {
    if (!dryRun) {
      await fsp.cp(sourcePath, destPath, { recursive: true });
    }
  } else {
    const symlinkType = platform === "windows" ? "junction" : "dir";
    if (!dryRun) {
      await fsp.symlink(sourcePath, destPath, symlinkType);
    }
  }

  return {
    skillName,
    sourcePath,
    destPath,
  };
}

function buildSkillPaths(installRoot) {
  return SKILLS.map((skill) => path.join(installRoot, skill, "SKILL.md"));
}

function quoteYamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function replaceManagedBlock(content, block, commentStyle) {
  const startMarker = commentStyle === "html"
    ? `<!-- ${MANAGED_START} -->`
    : `# ${MANAGED_START}`;
  const endMarker = commentStyle === "html"
    ? `<!-- ${MANAGED_END} -->`
    : `# ${MANAGED_END}`;

  const managedBlock = `${startMarker}\n${block}\n${endMarker}`;
  const escapedStart = escapeRegExp(startMarker);
  const escapedEnd = escapeRegExp(endMarker);
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, managedBlock);
  }

  if (!content.trim()) {
    return `${managedBlock}\n`;
  }

  return `${content.replace(/\s*$/, "")}\n\n${managedBlock}\n`;
}

function removeManagedBlock(content, commentStyle) {
  const startMarker = commentStyle === "html"
    ? `<!-- ${MANAGED_START} -->`
    : `# ${MANAGED_START}`;
  const endMarker = commentStyle === "html"
    ? `<!-- ${MANAGED_END} -->`
    : `# ${MANAGED_END}`;
  const escapedStart = escapeRegExp(startMarker);
  const escapedEnd = escapeRegExp(endMarker);
  const pattern = new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, "m");

  return content.replace(pattern, "").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, content.trim() ? "\n" : "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertSkillsSection(content, items, itemRenderer) {
  const lines = content ? content.split(/\r?\n/) : [];
  const sectionLines = ["skills:", ...items.map(itemRenderer)];
  const sectionStart = lines.findIndex((line) => /^skills:\s*$/.test(line.trim()));

  if (sectionStart === -1) {
    return `${lines.filter(Boolean).join("\n")}${lines.filter(Boolean).length ? "\n\n" : ""}${sectionLines.join("\n")}\n`;
  }

  let sectionEnd = sectionStart + 1;
  while (sectionEnd < lines.length) {
    const line = lines[sectionEnd];
    if (!line.trim()) {
      sectionEnd += 1;
      continue;
    }
    if (/^\s*-/.test(line) || /^\s*#/.test(line)) {
      sectionEnd += 1;
      continue;
    }
    break;
  }

  const merged = [
    ...lines.slice(0, sectionStart),
    ...sectionLines,
    ...lines.slice(sectionEnd),
  ];

  return `${merged.join("\n").replace(/\s*$/, "")}\n`;
}

function removeSkillsSectionItems(content, items, itemRenderer) {
  const lines = content ? content.split(/\r?\n/) : [];
  const sectionStart = lines.findIndex((line) => /^skills:\s*$/.test(line.trim()));

  if (sectionStart === -1) {
    return content;
  }

  let sectionEnd = sectionStart + 1;
  while (sectionEnd < lines.length) {
    const line = lines[sectionEnd];
    if (!line.trim()) {
      sectionEnd += 1;
      continue;
    }
    if (/^\s*-/.test(line) || /^\s*#/.test(line)) {
      sectionEnd += 1;
      continue;
    }
    break;
  }

  const removeSet = new Set(items.map(itemRenderer));
  const keptLines = lines
    .slice(sectionStart + 1, sectionEnd)
    .filter((line) => !removeSet.has(line));
  const hasSkillEntries = keptLines.some((line) => /^\s*-/.test(line));

  const merged = hasSkillEntries
    ? [
      ...lines.slice(0, sectionStart),
      "skills:",
      ...keptLines,
      ...lines.slice(sectionEnd),
    ]
    : [
      ...lines.slice(0, sectionStart),
      ...lines.slice(sectionEnd),
    ];

  return `${merged.join("\n").replace(/\s*$/, "")}${merged.some((line) => line.trim()) ? "\n" : ""}`;
}

async function writeFileWithDirs(filePath, content, dryRun = false) {
  await ensureDir(path.dirname(filePath), dryRun);
  if (dryRun) {
    return;
  }
  await fsp.writeFile(filePath, content, "utf8");
}

async function readIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function configureClaude(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, "CLAUDE.md");
  const current = await readIfExists(filePath);
  const body = [
    "Load these skill files before starting work:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
    "",
    "After loading, create concise implementation plan, state assumptions, then implement requested changes.",
  ].join("\n");

  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureCursor(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".cursor", "rules", "developer-stack-skills.mdc");
  const body = [
    "---",
    "description: Load installed developer-stack-skills files before coding",
    "globs: []",
    "alwaysApply: false",
    "---",
    "",
    "Read and follow these skill files before starting work:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
  ].join("\n");

  await writeFileWithDirs(filePath, body, dryRun);
  return filePath;
}

async function configureCline(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const next = upsertSkillsSection(current, skillPaths, (skillPath) => `  - ${quoteYamlString(skillPath)}`);

  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureRoocode(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "config.yml");
  const current = await readIfExists(filePath);
  const next = upsertSkillsSection(current, skillPaths, (skillPath) => `  - path: ${quoteYamlString(skillPath)}`);

  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureCopilot(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".github", "copilot-instructions.md");
  const current = await readIfExists(filePath);
  const body = [
    "Follow these skill files before producing code or process guidance:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
  ].join("\n");

  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

function getAgentTargets(agent) {
  return agent === "all" ? AGENTS.filter((item) => item !== "all") : [agent];
}

async function configureAgents(agent, projectDir, installRoot, dryRun = false) {
  const skillPaths = buildSkillPaths(installRoot);
  const targets = getAgentTargets(agent);
  const configured = [];

  for (const target of targets) {
    if (target === "claude") {
      configured.push({ agent: target, filePath: await configureClaude(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "cursor") {
      configured.push({ agent: target, filePath: await configureCursor(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await configureCline(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await configureRoocode(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "copilot") {
      configured.push({ agent: target, filePath: await configureCopilot(projectDir, skillPaths, dryRun) });
    }
  }

  return configured;
}

async function unconfigureClaude(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, "CLAUDE.md");
  const current = await readIfExists(filePath);
  const next = removeManagedBlock(current, "html");

  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
  return filePath;
}

async function unconfigureCursor(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".cursor", "rules", "developer-stack-skills.mdc");
  await removePath(filePath, dryRun);
  return filePath;
}

async function unconfigureCline(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const next = removeSkillsSectionItems(current, skillPaths, (skillPath) => `  - ${quoteYamlString(skillPath)}`);

  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
  return filePath;
}

async function unconfigureRoocode(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "config.yml");
  const current = await readIfExists(filePath);
  const next = removeSkillsSectionItems(current, skillPaths, (skillPath) => `  - path: ${quoteYamlString(skillPath)}`);

  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
  return filePath;
}

async function unconfigureCopilot(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".github", "copilot-instructions.md");
  const current = await readIfExists(filePath);
  const next = removeManagedBlock(current, "html");

  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
  return filePath;
}

async function unconfigureAgents(agent, projectDir, installRoot, dryRun = false) {
  const skillPaths = buildSkillPaths(installRoot);
  const targets = getAgentTargets(agent);
  const configured = [];

  for (const target of targets) {
    if (target === "claude") {
      configured.push({ agent: target, filePath: await unconfigureClaude(projectDir, dryRun) });
      continue;
    }

    if (target === "cursor") {
      configured.push({ agent: target, filePath: await unconfigureCursor(projectDir, dryRun) });
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await unconfigureCline(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await unconfigureRoocode(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "copilot") {
      configured.push({ agent: target, filePath: await unconfigureCopilot(projectDir, dryRun) });
    }
  }

  return configured;
}

async function collectAnswers(args, defaults = {}) {
  const prompt = createPrompt();

  try {
    const defaultAgent = defaults.agent || "all";
    const defaultMode = defaults.mode || "symlink";
    const defaultProjectDir = path.resolve(defaults.projectDir || process.cwd());
    const askMode = defaults.askMode !== false;
    const agent = normalizeAgent(args.agent) || await chooseValue(
      prompt,
      `Agent to configure [all/claude/cursor/cline/roocode/copilot] (default: ${defaultAgent}): `,
      AGENTS,
      defaultAgent,
    );
    const mode = askMode
      ? (normalizeMode(args.mode) || await chooseValue(
        prompt,
        `Install mode [copy/symlink] (default: ${defaultMode}): `,
        MODES,
        defaultMode,
      ))
      : normalizeMode(args.mode || defaultMode);
    let projectDir;
    if (args.projectDir) {
      projectDir = path.resolve(args.projectDir);
    } else if (defaults.askProjectDir === false) {
      projectDir = defaultProjectDir;
    } else {
      const projectDirInput = await prompt.ask(`Project directory (default: ${defaultProjectDir}): `);
      projectDir = path.resolve(projectDirInput || defaultProjectDir);
    }

    return {
      agent,
      mode,
      projectDir,
    };
  } finally {
    prompt.close();
  }
}

function validateArgs(args, defaults = {}) {
  const agent = normalizeAgent(args.agent || defaults.agent || "all");
  const mode = normalizeMode(args.mode || defaults.mode || "symlink");

  if (!AGENTS.includes(agent)) {
    throw new Error(`Invalid agent "${args.agent}". Allowed: ${AGENTS.join(", ")}`);
  }

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode "${args.mode}". Allowed: ${MODES.join(", ")}`);
  }

  return {
    agent,
    mode,
    projectDir: path.resolve(args.projectDir || defaults.projectDir || process.cwd()),
  };
}

async function resolveSelection(rawArgs, options = {}) {
  const packageRoot = getPackageRoot();
  const packageInstallType = options.packageInstallType || detectPackageInstallType(
    packageRoot,
    options.projectDir || rawArgs.projectDir || process.cwd(),
  );
  const defaults = {
    agent: "all",
    mode: getDefaultMode(packageInstallType),
    projectDir: options.projectDir || getDefaultProjectDir(),
    askProjectDir: options.askProjectDir,
    askMode: options.askMode,
  };
  const selected = rawArgs.yes
    ? validateArgs(rawArgs, defaults)
    : await collectAnswers(rawArgs, defaults);
  const installRoot = getInstallRoot(selected.projectDir, packageInstallType);
  const installScope = packageInstallType === "global" ? "global" : "project";

  return {
    packageInstallType,
    selected,
    installRoot,
    installScope,
  };
}

async function runInstall(rawArgs, options = {}) {
  const platform = detectPlatform();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const { packageInstallType, selected, installRoot, installScope } = await resolveSelection(rawArgs, options);

  console.log(`[${PACKAGE_NAME}] installing version ${version}`);
  console.log(`[${PACKAGE_NAME}] package install type: ${packageInstallType}`);
  console.log(`[${PACKAGE_NAME}] skill install scope: ${installScope}`);
  console.log(`[${PACKAGE_NAME}] os: ${platform}`);
  console.log(`[${PACKAGE_NAME}] package dir: ${packageRoot}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${selected.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${installRoot}`);
  console.log(`[${PACKAGE_NAME}] agent: ${selected.agent}`);
  console.log(`[${PACKAGE_NAME}] mode: ${selected.mode}`);
  console.log(`[${PACKAGE_NAME}] dry run: ${rawArgs.dryRun ? "yes" : "no"}`);

  await ensureDir(installRoot, rawArgs.dryRun);

  const installedSkills = [];
  for (const skillName of SKILLS) {
    const result = await installSkill({
      packageRoot,
      installRoot,
      skillName,
      mode: selected.mode,
      platform,
      dryRun: rawArgs.dryRun,
    });
    installedSkills.push(result);
    console.log(`[${PACKAGE_NAME}] skill ${rawArgs.dryRun ? "would install" : "installed"}: ${result.skillName} -> ${result.destPath}`);
  }

  const configured = await configureAgents(selected.agent, selected.projectDir, installRoot, rawArgs.dryRun);
  for (const item of configured) {
    console.log(`[${PACKAGE_NAME}] ${item.agent} config ${rawArgs.dryRun ? "would update" : "updated"}: ${item.filePath}`);
  }

  console.log(`[${PACKAGE_NAME}] ${rawArgs.dryRun ? "install dry run complete" : "install complete"}`);

  return {
    version,
    platform,
    packageRoot,
    projectDir: selected.projectDir,
    installRoot,
    installScope,
    installedSkills,
    configured,
  };
}

async function runUninstall(rawArgs, options = {}) {
  const version = getVersion();
  const { packageInstallType, selected, installRoot, installScope } = await resolveSelection(
    rawArgs,
    { ...options, askMode: false },
  );

  console.log(`[${PACKAGE_NAME}] uninstalling version ${version}`);
  console.log(`[${PACKAGE_NAME}] package install type: ${packageInstallType}`);
  console.log(`[${PACKAGE_NAME}] skill install scope: ${installScope}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${selected.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${installRoot}`);
  console.log(`[${PACKAGE_NAME}] agent: ${selected.agent}`);
  console.log(`[${PACKAGE_NAME}] dry run: ${rawArgs.dryRun ? "yes" : "no"}`);

  const configured = await unconfigureAgents(selected.agent, selected.projectDir, installRoot, rawArgs.dryRun);
  for (const item of configured) {
    console.log(`[${PACKAGE_NAME}] ${item.agent} config ${rawArgs.dryRun ? "would remove" : "removed"}: ${item.filePath}`);
  }

  for (const skillName of SKILLS) {
    const skillPath = getSkillDestPath(installRoot, skillName);
    await removePath(skillPath, rawArgs.dryRun);
    console.log(`[${PACKAGE_NAME}] skill ${rawArgs.dryRun ? "would remove" : "removed"}: ${skillPath}`);
  }

  console.log(`[${PACKAGE_NAME}] ${rawArgs.dryRun ? "uninstall dry run complete" : "uninstall complete"}`);

  return {
    version,
    packageInstallType,
    projectDir: selected.projectDir,
    installRoot,
    installScope,
    configured,
  };
}

async function runPostInstall(env = process.env) {
  const packageRoot = getPackageRoot();
  const projectDir = getDefaultProjectDir(env);
  const packageInstallType = detectPackageInstallType(packageRoot, projectDir);

  if (packageInstallType === "source") {
    console.log(`[${PACKAGE_NAME}] postinstall skipped in source checkout`);
    return { skipped: true, reason: "source" };
  }

  if (!isInteractiveInstall(env)) {
    console.log(`[${PACKAGE_NAME}] postinstall skipped in non-interactive install`);
    console.log(`[${PACKAGE_NAME}] run "npx developer-stack-skills install" to configure later`);
    return { skipped: true, reason: "non-interactive" };
  }

  console.log(`[${PACKAGE_NAME}] postinstall detected ${packageInstallType} package install`);

  return runInstall(
    { command: "install" },
    {
      packageInstallType,
      projectDir,
      askProjectDir: packageInstallType === "global",
    },
  );
}

module.exports = {
  AGENTS,
  MODES,
  SKILLS,
  buildSkillPaths,
  configureAgents,
  detectPackageInstallType,
  detectPlatform,
  getDefaultMode,
  getDefaultProjectDir,
  getInstallRoot,
  isInteractiveInstall,
  parseArgs,
  printHelp,
  printVersion,
  removeManagedBlock,
  removeSkillsSectionItems,
  replaceManagedBlock,
  runInstall,
  runPostInstall,
  runUninstall,
  upsertSkillsSection,
  validateArgs,
};
