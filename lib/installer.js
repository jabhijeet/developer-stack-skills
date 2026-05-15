const fsp = require("fs/promises");
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
    yes: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--yes" || token === "-y") {
      args.yes = true;
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
  console.log("  developer-stack-skills install --agent all --mode symlink --dir .");
  console.log("  npx developer-stack-skills install --agent cline --mode copy");
  console.log("");
  console.log("Options:");
  console.log("  --agent <all|claude|cursor|cline|roocode|copilot>");
  console.log("  --mode <copy|symlink>");
  console.log("  --dir <project-directory>");
  console.log("  --yes");
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
  const localNodeModulesRoot = path.resolve(projectDir, "node_modules", PACKAGE_NAME);

  return normalizedPackageRoot === localNodeModulesRoot ? "local" : "global";
}

function getInstallRoot(projectDir) {
  return path.join(projectDir, ".ai-skills", PACKAGE_NAME);
}

function getSkillSourcePath(packageRoot, skillName) {
  return path.join(packageRoot, skillName);
}

function getSkillDestPath(installRoot, skillName) {
  return path.join(installRoot, skillName);
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function removePath(targetPath) {
  await fsp.rm(targetPath, { recursive: true, force: true });
}

async function installSkill({ packageRoot, installRoot, skillName, mode, platform }) {
  const sourcePath = getSkillSourcePath(packageRoot, skillName);
  const destPath = getSkillDestPath(installRoot, skillName);

  await removePath(destPath);

  if (mode === "copy") {
    await fsp.cp(sourcePath, destPath, { recursive: true });
  } else {
    const symlinkType = platform === "windows" ? "junction" : "dir";
    await fsp.symlink(sourcePath, destPath, symlinkType);
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

async function writeFileWithDirs(filePath, content) {
  await ensureDir(path.dirname(filePath));
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

async function configureClaude(projectDir, skillPaths) {
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
  await writeFileWithDirs(filePath, next);
  return filePath;
}

async function configureCursor(projectDir, skillPaths) {
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

  await writeFileWithDirs(filePath, body);
  return filePath;
}

async function configureCline(projectDir, skillPaths) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const next = upsertSkillsSection(current, skillPaths, (skillPath) => `  - ${quoteYamlString(skillPath)}`);

  await writeFileWithDirs(filePath, next);
  return filePath;
}

async function configureRoocode(projectDir, skillPaths) {
  const filePath = path.join(projectDir, ".roo", "config.yml");
  const current = await readIfExists(filePath);
  const next = upsertSkillsSection(current, skillPaths, (skillPath) => `  - path: ${quoteYamlString(skillPath)}`);

  await writeFileWithDirs(filePath, next);
  return filePath;
}

async function configureCopilot(projectDir, skillPaths) {
  const filePath = path.join(projectDir, ".github", "copilot-instructions.md");
  const current = await readIfExists(filePath);
  const body = [
    "Follow these skill files before producing code or process guidance:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
  ].join("\n");

  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next);
  return filePath;
}

function getAgentTargets(agent) {
  return agent === "all" ? AGENTS.filter((item) => item !== "all") : [agent];
}

async function configureAgents(agent, projectDir, installRoot) {
  const skillPaths = buildSkillPaths(installRoot);
  const targets = getAgentTargets(agent);
  const configured = [];

  for (const target of targets) {
    if (target === "claude") {
      configured.push({ agent: target, filePath: await configureClaude(projectDir, skillPaths) });
      continue;
    }

    if (target === "cursor") {
      configured.push({ agent: target, filePath: await configureCursor(projectDir, skillPaths) });
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await configureCline(projectDir, skillPaths) });
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await configureRoocode(projectDir, skillPaths) });
      continue;
    }

    if (target === "copilot") {
      configured.push({ agent: target, filePath: await configureCopilot(projectDir, skillPaths) });
    }
  }

  return configured;
}

async function collectAnswers(args) {
  const prompt = createPrompt();

  try {
    const agent = normalizeAgent(args.agent) || await chooseValue(
      prompt,
      "Agent to configure [all/claude/cursor/cline/roocode/copilot] (default: all): ",
      AGENTS,
      "all",
    );
    const mode = normalizeMode(args.mode) || await chooseValue(
      prompt,
      "Install mode [copy/symlink] (default: symlink): ",
      MODES,
      "symlink",
    );
    const projectDirInput = args.projectDir || await prompt.ask(`Project directory (default: ${process.cwd()}): `);
    const projectDir = path.resolve(projectDirInput || process.cwd());

    return {
      agent,
      mode,
      projectDir,
    };
  } finally {
    prompt.close();
  }
}

function validateArgs(args) {
  const agent = normalizeAgent(args.agent || "all");
  const mode = normalizeMode(args.mode || "symlink");

  if (!AGENTS.includes(agent)) {
    throw new Error(`Invalid agent "${args.agent}". Allowed: ${AGENTS.join(", ")}`);
  }

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode "${args.mode}". Allowed: ${MODES.join(", ")}`);
  }

  return {
    agent,
    mode,
    projectDir: path.resolve(args.projectDir || process.cwd()),
  };
}

async function runInstall(rawArgs) {
  const platform = detectPlatform();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const selected = rawArgs.yes ? validateArgs(rawArgs) : await collectAnswers(rawArgs);
  const installRoot = getInstallRoot(selected.projectDir);
  const packageInstallType = detectPackageInstallType(packageRoot, selected.projectDir);

  console.log(`[${PACKAGE_NAME}] installing version ${version}`);
  console.log(`[${PACKAGE_NAME}] package install type: ${packageInstallType}`);
  console.log(`[${PACKAGE_NAME}] os: ${platform}`);
  console.log(`[${PACKAGE_NAME}] package dir: ${packageRoot}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${selected.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${installRoot}`);
  console.log(`[${PACKAGE_NAME}] agent: ${selected.agent}`);
  console.log(`[${PACKAGE_NAME}] mode: ${selected.mode}`);

  await ensureDir(installRoot);

  const installedSkills = [];
  for (const skillName of SKILLS) {
    const result = await installSkill({
      packageRoot,
      installRoot,
      skillName,
      mode: selected.mode,
      platform,
    });
    installedSkills.push(result);
    console.log(`[${PACKAGE_NAME}] skill installed: ${result.skillName} -> ${result.destPath}`);
  }

  const configured = await configureAgents(selected.agent, selected.projectDir, installRoot);
  for (const item of configured) {
    console.log(`[${PACKAGE_NAME}] ${item.agent} config updated: ${item.filePath}`);
  }

  console.log(`[${PACKAGE_NAME}] install complete`);

  return {
    version,
    platform,
    packageRoot,
    projectDir: selected.projectDir,
    installRoot,
    installedSkills,
    configured,
  };
}

module.exports = {
  AGENTS,
  MODES,
  SKILLS,
  buildSkillPaths,
  configureAgents,
  detectPlatform,
  parseArgs,
  printHelp,
  replaceManagedBlock,
  runInstall,
  upsertSkillsSection,
  validateArgs,
  detectPackageInstallType,
};
