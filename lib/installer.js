const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const PACKAGE_NAME = "developer-stack-skills";
const MANAGED_START = "developer-stack-skills:start";
const MANAGED_END = "developer-stack-skills:end";

const AGENTS = ["all", "claude", "cursor", "cline", "roocode", "copilot"];
const MODES = ["copy", "symlink"];
const HOOKS_DIR = "hooks";

const SKILLS = [
  "java-spring",
  "python-backend",
  "frontend",
  "testing",
  "project-conventions",
];

const CONVENTIONS_RULE_CONFIG = {
  skillName: "project-conventions",
  description: "Project conventions — Git, commits, PRs, ADRs, naming, environment config",
  globs: [],
  alwaysApply: true,
};

const RULE_CONFIGS = [
  {
    skillName: "java-spring",
    description: "Java & Spring Boot — Spring Boot 3, JPA, REST APIs, JUnit 5, Maven/Gradle",
    globs: ["**/*.java", "**/*.kt", "**/pom.xml", "**/build.gradle", "**/build.gradle.kts"],
  },
  {
    skillName: "python-backend",
    description: "Python backend — FastAPI, Django, SQLAlchemy, Pydantic, pytest",
    globs: ["**/*.py", "**/requirements*.txt", "**/pyproject.toml", "**/setup.py", "**/Pipfile"],
  },
  {
    skillName: "frontend",
    description: "Frontend — React, Angular, TypeScript, TanStack Query, Vitest, Playwright",
    globs: ["**/*.tsx", "**/*.jsx", "**/*.ts", "**/*.js", "**/*.vue", "**/*.svelte"],
  },
  {
    skillName: "testing",
    description: "Testing — JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers",
    globs: [
      "**/*.test.ts", "**/*.test.tsx", "**/*.test.js", "**/*.test.jsx",
      "**/*.spec.ts", "**/*.spec.js", "**/*.spec.jsx",
      "**/test/**", "**/tests/**", "**/__tests__/**",
    ],
  },
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
    command: argv[0] || "install",
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
  console.log("  developer-stack-skills");
  console.log("  developer-stack-skills configure");
  console.log("  developer-stack-skills install");
  console.log("  developer-stack-skills uninstall");
  console.log("  developer-stack-skills version");
  console.log("  developer-stack-skills help");
  console.log("  developer-stack-skills install --agent all --mode symlink --dir .");
  console.log("  npx developer-stack-skills install --agent cline --mode copy --dry-run");
  console.log("");
  console.log("Commands:");
  console.log("  <none>       start interactive install");
  console.log("  configure    start interactive post-install configuration");
  console.log("  install      install skills and update agent config");
  console.log("  uninstall    remove installed skills and agent config entries");
  console.log("  serve        start MCP server on stdio");
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

function getHooksDestPath(installRoot) {
  return path.join(installRoot, HOOKS_DIR);
}

function buildHookCommand(hooksDir, scriptName) {
  return `node ${JSON.stringify(path.join(hooksDir, scriptName))}`;
}

function isOurHookEntry(entry) {
  return (entry.hooks || []).some(
    (h) => typeof h.command === "string" && h.command.includes(PACKAGE_NAME),
  );
}

function removeOurHookEntries(hookArray) {
  return (hookArray || []).filter((entry) => !isOurHookEntry(entry));
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

async function configureClaude(projectDir, conventionsPath, context, dryRun = false) {
  const filePath = path.join(projectDir, "CLAUDE.md");
  const current = await readIfExists(filePath);

  const lines = [];

  if (context && (context.description || context.testCmd || context.buildCmd)) {
    lines.push("## Project context", "");
    if (context.description) lines.push(context.description, "");
    if (context.testCmd) lines.push(`- Test: \`${context.testCmd}\``);
    if (context.buildCmd) lines.push(`- Build: \`${context.buildCmd}\``);
    lines.push("");
  }

  lines.push(
    "Load this skill file before starting work:",
    "",
    `- ${conventionsPath}`,
    "",
    "Stack skills (java-spring, python-backend, frontend, testing) load contextually via `.claude/rules/`.",
    "",
    "After loading, create concise implementation plan, state assumptions, then implement requested changes.",
  );

  const body = lines.join("\n");
  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

function buildRuleFileContent(skillPath, config) {
  const alwaysApply = config.alwaysApply === true;
  const lines = ["---", `description: ${config.description}`];
  if (!alwaysApply && config.globs && config.globs.length > 0) {
    lines.push(`globs: ${JSON.stringify(config.globs)}`);
  }
  lines.push(`alwaysApply: ${alwaysApply}`, "---", "", "Load and follow this skill file:", "", `- ${skillPath}`, "");
  return lines.join("\n");
}

async function configureClaudeRules(projectDir, installRoot, dryRun = false) {
  const rulesDir = path.join(projectDir, ".claude", "rules");
  const configured = [];

  for (const config of RULE_CONFIGS) {
    const skillPath = path.join(installRoot, config.skillName, "SKILL.md");
    const filePath = path.join(rulesDir, `developer-stack-skills-${config.skillName}.md`);
    await writeFileWithDirs(filePath, buildRuleFileContent(skillPath, config), dryRun);
    configured.push(filePath);
  }

  return configured;
}

async function configureClaudeCommands(projectDir, packageRoot, dryRun = false) {
  const sourceDir = path.join(packageRoot, "commands");
  const destDir = path.join(projectDir, ".claude", "commands");
  const configured = [];

  let files;
  try {
    files = await fsp.readdir(sourceDir);
  } catch {
    return configured;
  }

  await ensureDir(destDir, dryRun);

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, `developer-stack-skills-${file}`);
    if (!dryRun) await fsp.copyFile(sourcePath, destPath);
    configured.push(destPath);
  }

  return configured;
}

async function unconfigureClaudeCommands(projectDir, dryRun = false) {
  const commandsDir = path.join(projectDir, ".claude", "commands");
  let files;
  try {
    files = await fsp.readdir(commandsDir);
  } catch {
    return [];
  }

  const removed = [];
  for (const file of files) {
    if (file.startsWith("developer-stack-skills-") && file.endsWith(".md")) {
      const filePath = path.join(commandsDir, file);
      await removePath(filePath, dryRun);
      removed.push(filePath);
    }
  }
  return removed;
}

function buildMcpCommand(packageInstallType) {
  return packageInstallType === "global"
    ? { command: "developer-stack-skills", args: ["serve"] }
    : { command: "npx", args: ["developer-stack-skills", "serve"] };
}

async function configureMcp(projectDir, packageInstallType, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "mcp.json");
  const current = await readIfExists(filePath);

  let config = {};
  if (current.trim()) {
    try {
      config = JSON.parse(current);
    } catch {
      process.stderr.write(`[${PACKAGE_NAME}] Warning: ${filePath} has invalid JSON — skipping MCP update to avoid data loss\n`);
      return filePath;
    }
  }

  if (!config.mcpServers) config.mcpServers = {};
  const { command, args } = buildMcpCommand(packageInstallType);
  config.mcpServers[PACKAGE_NAME] = { command, args, type: "stdio" };

  await writeFileWithDirs(filePath, JSON.stringify(config, null, 2) + "\n", dryRun);
  return filePath;
}

async function unconfigureMcp(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "mcp.json");
  const current = await readIfExists(filePath);

  if (!current.trim()) return filePath;

  let config;
  try { config = JSON.parse(current); } catch { return filePath; }

  if (config.mcpServers) {
    delete config.mcpServers[PACKAGE_NAME];
    if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
  }

  if (Object.keys(config).length === 0) {
    await removePath(filePath, dryRun);
  } else {
    await writeFileWithDirs(filePath, JSON.stringify(config, null, 2) + "\n", dryRun);
  }

  return filePath;
}

async function unconfigureClaudeRules(projectDir, dryRun = false) {
  const rulesDir = path.join(projectDir, ".claude", "rules");
  let files;
  try {
    files = await fsp.readdir(rulesDir);
  } catch {
    return [];
  }

  const removed = [];
  for (const file of files) {
    if (file.startsWith("developer-stack-skills-") && file.endsWith(".md")) {
      const filePath = path.join(rulesDir, file);
      await removePath(filePath, dryRun);
      removed.push(filePath);
    }
  }
  return removed;
}

async function installHooks({ packageRoot, installRoot, mode, platform, dryRun = false }) {
  const sourcePath = path.join(packageRoot, HOOKS_DIR);
  const destPath = getHooksDestPath(installRoot);

  await removePath(destPath, dryRun);

  if (mode === "copy") {
    if (!dryRun) await fsp.cp(sourcePath, destPath, { recursive: true });
  } else {
    const symlinkType = platform === "windows" ? "junction" : "dir";
    if (!dryRun) await fsp.symlink(sourcePath, destPath, symlinkType);
  }

  return { sourcePath, destPath };
}

async function configureClaudeHooks(projectDir, hooksDir, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "settings.json");
  const current = await readIfExists(filePath);

  let settings = {};
  if (current.trim()) {
    try {
      settings = JSON.parse(current);
    } catch {
      process.stderr.write(`[${PACKAGE_NAME}] Warning: ${filePath} has invalid JSON — skipping hooks update to avoid data loss\n`);
      return filePath;
    }
  }

  if (settings.PreToolUse) {
    settings.PreToolUse = removeOurHookEntries(settings.PreToolUse);
    if (settings.PreToolUse.length === 0) delete settings.PreToolUse;
  }

  if (!settings.PreToolUse) settings.PreToolUse = [];
  settings.PreToolUse.push(
    {
      matcher: "Write|Edit",
      hooks: [{ type: "command", command: buildHookCommand(hooksDir, "pre-write.js"), timeout: 10 }],
    },
    {
      matcher: "Bash",
      hooks: [{ type: "command", command: buildHookCommand(hooksDir, "pre-bash.js"), timeout: 10 }],
    },
  );

  await writeFileWithDirs(filePath, JSON.stringify(settings, null, 2) + "\n", dryRun);
  return filePath;
}

async function unconfigureClaudeHooks(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "settings.json");
  const current = await readIfExists(filePath);

  if (!current.trim()) return filePath;

  let settings;
  try { settings = JSON.parse(current); } catch { return filePath; }

  if (settings.PreToolUse) {
    settings.PreToolUse = removeOurHookEntries(settings.PreToolUse);
    if (settings.PreToolUse.length === 0) delete settings.PreToolUse;
  }

  if (Object.keys(settings).length === 0) {
    await removePath(filePath, dryRun);
  } else {
    await writeFileWithDirs(filePath, JSON.stringify(settings, null, 2) + "\n", dryRun);
  }

  return filePath;
}

async function configureCursor(projectDir, installRoot, dryRun = false) {
  const rulesDir = path.join(projectDir, ".cursor", "rules");
  const configured = [];

  for (const config of RULE_CONFIGS) {
    const skillPath = path.join(installRoot, config.skillName, "SKILL.md");
    const filePath = path.join(rulesDir, `developer-stack-skills-${config.skillName}.mdc`);
    await writeFileWithDirs(filePath, buildRuleFileContent(skillPath, config), dryRun);
    configured.push(filePath);
  }

  const conventionsPath = path.join(installRoot, CONVENTIONS_RULE_CONFIG.skillName, "SKILL.md");
  const conventionsFilePath = path.join(rulesDir, `developer-stack-skills-${CONVENTIONS_RULE_CONFIG.skillName}.mdc`);
  await writeFileWithDirs(conventionsFilePath, buildRuleFileContent(conventionsPath, CONVENTIONS_RULE_CONFIG), dryRun);
  configured.push(conventionsFilePath);

  return configured;
}

async function configureCline(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const body = [
    "Read and follow these skill files before starting work:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
  ].join("\n");
  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureRoocode(projectDir, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "rules", "developer-stack-skills.md");
  const body = [
    "# Developer Stack Skills",
    "",
    "Load and follow these skill files before starting work:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
    "",
  ].join("\n");

  await writeFileWithDirs(filePath, body, dryRun);
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

async function configureAgents({ agent, projectDir, installRoot, context, generateCommands, configureMcpServer, packageInstallType, dryRun = false }) {
  const skillPaths = buildSkillPaths(installRoot);
  const targets = getAgentTargets(agent);
  const configured = [];

  const hooksDir = getHooksDestPath(installRoot);

  for (const target of targets) {
    if (target === "claude") {
      const conventionsPath = path.join(installRoot, "project-conventions", "SKILL.md");
      configured.push({ agent: target, filePath: await configureClaude(projectDir, conventionsPath, context, dryRun) });
      const ruleFiles = await configureClaudeRules(projectDir, installRoot, dryRun);
      for (const ruleFilePath of ruleFiles) {
        configured.push({ agent: "claude-rules", filePath: ruleFilePath });
      }
      configured.push({ agent: "claude-hooks", filePath: await configureClaudeHooks(projectDir, hooksDir, dryRun) });
      if (generateCommands) {
        const commandFiles = await configureClaudeCommands(projectDir, getPackageRoot(), dryRun);
        for (const filePath of commandFiles) {
          configured.push({ agent: "claude-commands", filePath });
        }
      }
      if (configureMcpServer) {
        configured.push({ agent: "claude-mcp", filePath: await configureMcp(projectDir, packageInstallType, dryRun) });
      }
      continue;
    }

    if (target === "cursor") {
      const cursorFiles = await configureCursor(projectDir, installRoot, dryRun);
      for (const filePath of cursorFiles) {
        configured.push({ agent: target, filePath });
      }
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
  const rulesDir = path.join(projectDir, ".cursor", "rules");
  let files;
  try {
    files = await fsp.readdir(rulesDir);
  } catch {
    return [];
  }

  const removed = [];
  for (const file of files) {
    if (file.startsWith("developer-stack-skills-") && file.endsWith(".mdc")) {
      const filePath = path.join(rulesDir, file);
      await removePath(filePath, dryRun);
      removed.push(filePath);
    }
  }
  return removed;
}

async function unconfigureCline(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const next = removeManagedBlock(current, "html");

  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
  return filePath;
}

async function unconfigureRoocode(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "rules", "developer-stack-skills.md");
  await removePath(filePath, dryRun);
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
  const targets = getAgentTargets(agent);
  const configured = [];

  for (const target of targets) {
    if (target === "claude") {
      configured.push({ agent: target, filePath: await unconfigureClaude(projectDir, dryRun) });
      const removedRules = await unconfigureClaudeRules(projectDir, dryRun);
      for (const ruleFilePath of removedRules) {
        configured.push({ agent: "claude-rules", filePath: ruleFilePath });
      }
      configured.push({ agent: "claude-hooks", filePath: await unconfigureClaudeHooks(projectDir, dryRun) });
      const removedCommands = await unconfigureClaudeCommands(projectDir, dryRun);
      for (const filePath of removedCommands) {
        configured.push({ agent: "claude-commands", filePath });
      }
      configured.push({ agent: "claude-mcp", filePath: await unconfigureMcp(projectDir, dryRun) });
      continue;
    }

    if (target === "cursor") {
      const removedCursor = await unconfigureCursor(projectDir, dryRun);
      for (const filePath of removedCursor) {
        configured.push({ agent: target, filePath });
      }
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await unconfigureCline(projectDir, dryRun) });
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await unconfigureRoocode(projectDir, dryRun) });
      continue;
    }

    if (target === "copilot") {
      configured.push({ agent: target, filePath: await unconfigureCopilot(projectDir, dryRun) });
    }
  }

  return configured;
}

async function collectProjectContext(prompt) {
  console.log("\n[developer-stack-skills] Optional: add project context to CLAUDE.md (Enter to skip each)");
  const description = await prompt.ask("Project description (1 line): ");
  const testCmd = await prompt.ask("Test command (e.g. mvn test, pytest, npm test): ");
  const buildCmd = await prompt.ask("Build/start command (e.g. mvn spring-boot:run, uvicorn main:app): ");

  const context = {};
  if (description.trim()) context.description = description.trim();
  if (testCmd.trim()) context.testCmd = testCmd.trim();
  if (buildCmd.trim()) context.buildCmd = buildCmd.trim();

  return Object.keys(context).length ? context : null;
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

    const normalizedAgent = normalizeAgent(agent) || "all";
    const isClaudeTarget = normalizedAgent === "all" || normalizedAgent === "claude";
    const projectContext = isClaudeTarget ? await collectProjectContext(prompt) : null;

    let generateCommands = false;
    let configureMcpServer = false;
    if (isClaudeTarget) {
      const commandsInput = await prompt.ask("\nGenerate Claude Code slash commands? [yes/no] (default: yes): ");
      generateCommands = commandsInput === "" || /^y(es)?$/i.test(commandsInput.trim());
      const mcpInput = await prompt.ask("Configure MCP server (skills on-demand via tools)? [yes/no] (default: yes): ");
      configureMcpServer = mcpInput === "" || /^y(es)?$/i.test(mcpInput.trim());
    }

    return {
      agent,
      mode,
      projectDir,
      projectContext,
      generateCommands,
      configureMcpServer,
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
    projectContext: null,
    generateCommands: true,
    configureMcpServer: true,
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

  const hooksResult = await installHooks({ packageRoot, installRoot, mode: selected.mode, platform, dryRun: rawArgs.dryRun });
  console.log(`[${PACKAGE_NAME}] hooks ${rawArgs.dryRun ? "would install" : "installed"}: ${hooksResult.destPath}`);

  const configured = await configureAgents({
    agent: selected.agent,
    projectDir: selected.projectDir,
    installRoot,
    context: selected.projectContext,
    generateCommands: selected.generateCommands,
    configureMcpServer: selected.configureMcpServer,
    packageInstallType,
    dryRun: rawArgs.dryRun,
  });
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

  const hooksPath = getHooksDestPath(installRoot);
  await removePath(hooksPath, rawArgs.dryRun);
  console.log(`[${PACKAGE_NAME}] hooks ${rawArgs.dryRun ? "would remove" : "removed"}: ${hooksPath}`);

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
    console.log(`[${PACKAGE_NAME}] postinstall configure skipped in non-interactive install`);
    console.log(`[${PACKAGE_NAME}] run "developer-stack-skills configure" to finish setup`);
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
  CONVENTIONS_RULE_CONFIG,
  HOOKS_DIR,
  MODES,
  RULE_CONFIGS,
  SKILLS,
  buildMcpCommand,
  buildRuleFileContent,
  buildSkillPaths,
  configureClaude,
  configureAgents,
  configureClaudeCommands,
  configureClaudeHooks,
  configureClaudeRules,
  configureCline,
  configureCursor,
  configureMcp,
  configureRoocode,
  detectPackageInstallType,
  detectPlatform,
  getDefaultMode,
  getDefaultProjectDir,
  getHooksDestPath,
  getInstallRoot,
  isInteractiveInstall,
  isOurHookEntry,
  parseArgs,
  printHelp,
  printVersion,
  removeManagedBlock,
  removeOurHookEntries,
  removeSkillsSectionItems,
  replaceManagedBlock,
  runInstall,
  runPostInstall,
  runUninstall,
  upsertSkillsSection,
  validateArgs,
};
