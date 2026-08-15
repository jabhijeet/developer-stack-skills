const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const PACKAGE_NAME = "developer-stack-skills";
const MANAGED_START = "developer-stack-skills:start";
const MANAGED_END = "developer-stack-skills:end";

const AGENT_PLATFORMS = [
  "adal", "aider", "aider-desk", "amp", "antigravity", "augment", "bob",
  "claude", "cline", "codearts-agent", "codebuddy", "codemaker", "codestudio",
  "codex", "command-code", "continue", "copilot", "cortex", "crush", "cursor",
  "deepagents", "devin", "droid", "firebender", "forgecode", "gemini", "generic",
  "goose", "hermes", "iflow-cli", "intellij", "junie", "kilo", "kimi-cli", "kiro",
  "kode", "mcpjam", "mistral-vibe", "mux", "neovate", "openclaw", "opencode",
  "openhands", "pi", "pochi", "qoder", "qwen-code", "replit", "roocode", "rovodev",
  "tabnine-cli", "trae", "trae-cn", "universal", "vscode", "warp", "windsurf", "zencoder",
];
const AGENTS = ["all", ...AGENT_PLATFORMS];
const MODES = ["copy", "symlink"];
const SUPPORTED_PLATFORMS = ["windows", "macos", "linux"];
const PLATFORM_GLOBAL_PATHS = {
  antigravity: [".gemini", "antigravity", "skills"],
  amp: [".config", "agents", "skills"],
  cline: [".agents", "skills"],
  "codearts-agent": [".codeartsdoer", "skills"],
  "command-code": [".commandcode", "skills"],
  copilot: [".copilot", "skills"],
  cortex: [".snowflake", "cortex", "skills"],
  crush: [".config", "crush", "skills"],
  deepagents: [".deepagents", "agent", "skills"],
  devin: [".config", "devin", "skills"],
  droid: [".factory", "skills"],
  forgecode: [".forge", "skills"],
  gemini: [".gemini", "skills"],
  goose: [".config", "goose", "skills"],
  "iflow-cli": [".iflow", "skills"],
  kilo: [".kilocode", "skills"],
  "kimi-cli": [".config", "agents", "skills"],
  "mistral-vibe": [".vibe", "skills"],
  opencode: [".config", "opencode", "skills"],
  pi: [".pi", "agent", "skills"],
  "qwen-code": [".qwen", "skills"],
  replit: [".config", "agents", "skills"],
  "tabnine-cli": [".tabnine", "agent", "skills"],
  "trae-cn": [".trae-cn", "skills"],
  universal: [".config", "agents", "skills"],
  warp: [".agents", "skills"],
  windsurf: [".codeium", "windsurf", "skills"],
};
const HOOKS_DIR = "hooks";

const SKILLS = [
  "java-spring",
  "java-data",
  "java-spring-ai",
  "java-spring-security",
  "python-backend",
  "frontend",
  "testing",
  "loop-engineering",
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
    description: "Java 25 & Spring Boot 4 / Spring 7 — JPA, REST APIs, JUnit 5, Maven/Gradle",
    globs: ["**/*.java", "**/*.kt", "**/pom.xml", "**/build.gradle", "**/build.gradle.kts"],
  },
  {
    skillName: "java-data",
    description: "Java data access — Flyway/Liquibase migrations, JPA/Hibernate, transactions, connection pooling, query optimization, caching",
    globs: [
      "**/db/migration/**", "**/db/changelog/**", "**/repository/**", "**/entity/**",
      "**/*Repository.java", "**/*Entity.java",
    ],
  },
  {
    skillName: "java-spring-ai",
    description: "Spring AI — LLM chat clients, RAG pipelines, vector stores, prompt templates, function calling, streaming, observability",
    globs: [
      "**/ai/**", "**/*AiConfig.java", "**/*ChatClient.java", "**/*AiClient.java",
      "**/*RagService.java", "**/*VectorStore.java",
    ],
  },
  {
    skillName: "java-spring-security",
    description: "Spring Security — authentication, authorization, OAuth2/OIDC/JWT, method security, CORS, CSRF, headers, hardening",
    globs: [
      "**/security/**", "**/*SecurityConfig.java", "**/*JwtService.java",
      "**/*JwtUtil.java", "**/*UserDetailsService.java",
    ],
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
  {
    skillName: "loop-engineering",
    description: "Loop Engineering — plan, implement, verify, reflect, and repeat with evidence-driven checkpoints",
    globs: [],
    alwaysApply: true,
  },
];

function detectPlatform(platform = process.platform) {
  const normalized = String(platform).trim().toLowerCase();
  const aliases = {
    win32: "windows",
    windows: "windows",
    darwin: "macos",
    macos: "macos",
    linux: "linux",
  };
  const detected = aliases[normalized];
  if (!detected) {
    throw new Error(`Unsupported platform "${platform}". Supported: ${SUPPORTED_PLATFORMS.join(", ")}`);
  }
  return detected;
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || "install",
    agent: null,
    mode: null,
    platform: null,
    projectDir: null,
    installRoot: null,
    global: false,
    dryRun: false,
    yes: false,
  };
  const valueOptions = {
    "--agent": "agent",
    "--mode": "mode",
    "--platform": "platform",
    "--dir": "projectDir",
    "--install-root": "installRoot",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--yes" || token === "-y") {
      args.yes = true;
      continue;
    }

    if (token === "--global" || token === "-g") {
      args.global = true;
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    const equalsIndex = token.indexOf("=");
    const option = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
    const property = valueOptions[option];
    if (property) {
      const value = equalsIndex === -1 ? argv[index + 1] : token.slice(equalsIndex + 1);
      if (!value || value.startsWith("-")) {
        throw new Error(`Option ${option} requires a value`);
      }
      args[property] = value;
      if (equalsIndex === -1) index += 1;
      continue;
    }

    if (!token.startsWith("-") && !args.agent) {
      args.agent = token;
      continue;
    }

    throw new Error(`Unknown option or argument "${token}". Run "${PACKAGE_NAME} help" for usage.`);
  }

  return args;
}

function normalizeAgent(agent) {
  if (!agent) {
    return null;
  }

  const normalized = agent.trim().toLowerCase();
  const aliases = {
    roo: "roocode",
    "github-copilot": "copilot",
    "gemini-cli": "gemini",
    "kiro-cli": "kiro",
  };
  return aliases[normalized] || normalized;
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
  console.log("  developer-stack-skills install [platform]");
  console.log("  developer-stack-skills uninstall [platform]");
  console.log("  developer-stack-skills install-skills [-g] <platform>");
  console.log("  developer-stack-skills uninstall-skills [-g] <platform>");
  console.log("  developer-stack-skills install-agent <platform>");
  console.log("  developer-stack-skills uninstall-agent <platform>");
  console.log("  developer-stack-skills version");
  console.log("  developer-stack-skills help");
  console.log("  developer-stack-skills install --agent all --mode symlink --dir .");
  console.log("  npx developer-stack-skills install --agent cline --mode copy --dry-run");
  console.log("");
  console.log("Commands:");
  console.log("  <none>       start interactive install");
  console.log("  configure    start interactive post-install configuration");
  console.log("  install          install skills and update agent config");
  console.log("  install-skills   reference-compatible install alias");
  console.log("  install-agent    reference-compatible install alias");
  console.log("  uninstall        remove installed skills and agent config entries");
  console.log("  uninstall-skills reference-compatible uninstall alias");
  console.log("  uninstall-agent  reference-compatible uninstall alias");
  console.log("  serve            start MCP server on stdio");
  console.log("  version      print package version");
  console.log("  help         print this help");
  console.log("");
  console.log("Options:");
  console.log(`  --agent <all|${AGENT_PLATFORMS.join("|")}>`);
  console.log("  --global, -g                    Install skills in the platform's user directory");
  console.log("  --mode <copy|symlink>");
  console.log("  --platform <windows|macos|linux>  Override detected operating system");
  console.log("  --dir <project-directory>");
  console.log("  --install-root <path>             Override the skill installation directory");
  console.log("  --dry-run");
  console.log("  --yes, -y");
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

function getPlatformGlobalRoot(agent, homeDir = os.homedir()) {
  const segments = PLATFORM_GLOBAL_PATHS[agent] || [`.${agent}`, "skills"];
  return path.join(homeDir, ...segments);
}

function getInstallRoot(projectDir, packageInstallType, installRoot = null, agent = null, globalInstall = false) {
  if (installRoot) {
    return path.resolve(installRoot);
  }
  if (globalInstall) {
    if (!agent || agent === "all") {
      throw new Error("Global platform installation requires one agent platform");
    }
    return getPlatformGlobalRoot(agent);
  }
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

function isOurHookEntry(entry, hooksDir = null) {
  const expectedCommands = hooksDir
    ? new Set([
      buildHookCommand(hooksDir, "pre-write.js"),
      buildHookCommand(hooksDir, "pre-bash.js"),
    ])
    : null;

  return (entry.hooks || []).some((hook) => {
    if (typeof hook.command !== "string") return false;
    return expectedCommands
      ? expectedCommands.has(hook.command)
      : hook.command.includes(PACKAGE_NAME);
  });
}

function removeOurHookEntries(hookArray, hooksDir = null) {
  return (hookArray || []).filter((entry) => !isOurHookEntry(entry, hooksDir));
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

async function configureClaude(projectDir, conventionsPath, context, useMcp = false, dryRun = false) {
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

  if (useMcp) {
    lines.push(
      "Use the developer-stack-skills MCP server before editing any file:",
      "",
      "1. Call `detect_stack` with the file path to identify the relevant stack.",
      "2. Call `get_skill` with the detected stack to load its conventions.",
      "3. Do not preload all skill files — load only the relevant skill on demand.",
      "",
      "For cross-cutting decisions, call `get_conventions` to load project-wide standards.",
      "",
      "After loading the relevant skill, create a concise implementation plan, state assumptions, then implement.",
    );
  } else {
    lines.push(
      "Load this skill file before starting work:",
      "",
      `- ${conventionsPath}`,
      "",
      "Stack skills (java-spring, python-backend, frontend, testing) load contextually via `.claude/rules/`; loop-engineering is always active.",
      "",
      "After loading, create concise implementation plan, state assumptions, then implement requested changes.",
    );
  }

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

async function writeMcpJsonFile(filePath, packageInstallType, dryRun = false) {
  const current = await readIfExists(filePath);
  let config = {};
  if (current.trim()) {
    try { config = JSON.parse(current); } catch {
      throw new Error(`${filePath} has invalid JSON; MCP configuration was not changed`);
    }
  }
  if (!config.mcpServers) config.mcpServers = {};
  const { command, args } = buildMcpCommand(packageInstallType);
  config.mcpServers[PACKAGE_NAME] = { command, args, type: "stdio" };
  await writeFileWithDirs(filePath, JSON.stringify(config, null, 2) + "\n", dryRun);
  return filePath;
}

async function removeMcpJsonEntry(filePath, dryRun = false) {
  const current = await readIfExists(filePath);
  if (!current.trim()) return filePath;
  let config;
  try { config = JSON.parse(current); } catch {
    throw new Error(`${filePath} has invalid JSON; MCP configuration was not changed`);
  }
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

async function configureMcp(projectDir, packageInstallType, dryRun = false) {
  return writeMcpJsonFile(path.join(projectDir, ".claude", "mcp.json"), packageInstallType, dryRun);
}

async function configureCursorMcp(projectDir, packageInstallType, dryRun = false) {
  return writeMcpJsonFile(path.join(projectDir, ".cursor", "mcp.json"), packageInstallType, dryRun);
}

async function configureSharedMcp(projectDir, packageInstallType, dryRun = false) {
  return writeMcpJsonFile(path.join(projectDir, ".mcp.json"), packageInstallType, dryRun);
}

async function unconfigureMcp(projectDir, dryRun = false) {
  return removeMcpJsonEntry(path.join(projectDir, ".claude", "mcp.json"), dryRun);
}

async function unconfigureCursorMcp(projectDir, dryRun = false) {
  return removeMcpJsonEntry(path.join(projectDir, ".cursor", "mcp.json"), dryRun);
}

async function unconfigureSharedMcp(projectDir, dryRun = false) {
  return removeMcpJsonEntry(path.join(projectDir, ".mcp.json"), dryRun);
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
      throw new Error(`${filePath} has invalid JSON; Claude hooks were not changed`);
    }
  }

  if (settings.PreToolUse) {
    settings.PreToolUse = removeOurHookEntries(settings.PreToolUse, hooksDir);
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

async function unconfigureClaudeHooks(projectDir, hooksDir, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "settings.json");
  const current = await readIfExists(filePath);

  if (!current.trim()) return filePath;

  let settings;
  try { settings = JSON.parse(current); } catch {
    throw new Error(`${filePath} has invalid JSON; Claude hooks were not changed`);
  }

  if (settings.PreToolUse) {
    settings.PreToolUse = removeOurHookEntries(settings.PreToolUse, hooksDir);
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

const MCP_INSTRUCTION_LINES = [
  "Use the developer-stack-skills MCP server before editing any file:",
  "",
  "1. Call `detect_stack` with the file path to identify the relevant stack.",
  "2. Call `get_skill` with the detected stack to load its conventions.",
  "3. Do not preload all skill files — load only the relevant skill on demand.",
  "",
  "For cross-cutting decisions, call `get_conventions` to load project-wide standards.",
  "",
  "After loading the relevant skill, create a concise implementation plan, state assumptions, then implement.",
];

async function configureCline(projectDir, skillPaths, useMcp = false, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const body = useMcp
    ? MCP_INSTRUCTION_LINES.join("\n")
    : [
      "Read and follow these skill files before starting work:",
      "",
      ...skillPaths.map((skillPath) => `- ${skillPath}`),
    ].join("\n");
  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureRoocode(projectDir, skillPaths, useMcp = false, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "rules", "developer-stack-skills.md");
  const body = useMcp
    ? ["# Developer Stack Skills", "", ...MCP_INSTRUCTION_LINES, ""].join("\n")
    : [
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

async function configureInstructionFile(projectDir, relativePath, skillPaths, dryRun = false) {
  const filePath = path.join(projectDir, relativePath);
  const current = await readIfExists(filePath);
  const body = [
    "Follow every bundled developer-stack-skills instruction before producing code or process guidance:",
    "",
    ...skillPaths.map((skillPath) => `- ${skillPath}`),
  ].join("\n");
  await writeFileWithDirs(filePath, replaceManagedBlock(current, body, "html"), dryRun);
  return filePath;
}

async function unconfigureInstructionFile(projectDir, relativePath, dryRun = false) {
  const filePath = path.join(projectDir, relativePath);
  const current = await readIfExists(filePath);
  const next = removeManagedBlock(current, "html");
  if (next.trim()) {
    await writeFileWithDirs(filePath, next, dryRun);
  } else {
    await removePath(filePath, dryRun);
  }
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
      configured.push({ agent: target, filePath: await configureClaude(projectDir, conventionsPath, context, configureMcpServer, dryRun) });
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
      if (configureMcpServer) {
        configured.push({ agent: "cursor-mcp", filePath: await configureCursorMcp(projectDir, packageInstallType, dryRun) });
      }
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await configureCline(projectDir, skillPaths, configureMcpServer, dryRun) });
      if (configureMcpServer) {
        configured.push({ agent: "cline-mcp", filePath: await configureSharedMcp(projectDir, packageInstallType, dryRun) });
      }
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await configureRoocode(projectDir, skillPaths, configureMcpServer, dryRun) });
      if (configureMcpServer) {
        configured.push({ agent: "roocode-mcp", filePath: await configureSharedMcp(projectDir, packageInstallType, dryRun) });
      }
      continue;
    }

    if (target === "copilot" || target === "vscode") {
      configured.push({ agent: target, filePath: await configureCopilot(projectDir, skillPaths, dryRun) });
      continue;
    }

    if (target === "gemini") {
      configured.push({ agent: target, filePath: await configureInstructionFile(projectDir, "GEMINI.md", skillPaths, dryRun) });
      continue;
    }

    if (target === "kiro") {
      configured.push({ agent: target, filePath: await configureInstructionFile(projectDir, path.join(".kiro", "steering", "developer-stack-skills.md"), skillPaths, dryRun) });
      continue;
    }

    if (target === "antigravity") {
      configured.push({ agent: target, filePath: await configureInstructionFile(projectDir, path.join(".agent", "rules", "developer-stack-skills.md"), skillPaths, dryRun) });
      continue;
    }

    configured.push({ agent: target, filePath: await configureInstructionFile(projectDir, "AGENTS.md", skillPaths, dryRun) });
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
      configured.push({ agent: "claude-hooks", filePath: await unconfigureClaudeHooks(projectDir, getHooksDestPath(installRoot), dryRun) });
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
      configured.push({ agent: "cursor-mcp", filePath: await unconfigureCursorMcp(projectDir, dryRun) });
      continue;
    }

    if (target === "cline") {
      configured.push({ agent: target, filePath: await unconfigureCline(projectDir, dryRun) });
      configured.push({ agent: "cline-mcp", filePath: await unconfigureSharedMcp(projectDir, dryRun) });
      continue;
    }

    if (target === "roocode") {
      configured.push({ agent: target, filePath: await unconfigureRoocode(projectDir, dryRun) });
      configured.push({ agent: "roocode-mcp", filePath: await unconfigureSharedMcp(projectDir, dryRun) });
      continue;
    }

    if (target === "copilot" || target === "vscode") {
      configured.push({ agent: target, filePath: await unconfigureCopilot(projectDir, dryRun) });
      continue;
    }

    if (target === "gemini") {
      configured.push({ agent: target, filePath: await unconfigureInstructionFile(projectDir, "GEMINI.md", dryRun) });
      continue;
    }

    if (target === "kiro") {
      configured.push({ agent: target, filePath: await unconfigureInstructionFile(projectDir, path.join(".kiro", "steering", "developer-stack-skills.md"), dryRun) });
      continue;
    }

    if (target === "antigravity") {
      configured.push({ agent: target, filePath: await unconfigureInstructionFile(projectDir, path.join(".agent", "rules", "developer-stack-skills.md"), dryRun) });
      continue;
    }

    configured.push({ agent: target, filePath: await unconfigureInstructionFile(projectDir, "AGENTS.md", dryRun) });
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
      `Agent platform to configure (default: ${defaultAgent}; see help for supported values): `,
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
  const platform = detectPlatform(args.platform || defaults.platform || process.platform);

  if (!AGENTS.includes(agent)) {
    throw new Error(`Invalid agent "${args.agent}". Allowed: ${AGENTS.join(", ")}`);
  }

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode "${args.mode}". Allowed: ${MODES.join(", ")}`);
  }

  if (args.global && agent === "all") {
    throw new Error("Global platform installation requires one agent platform");
  }

  return {
    agent,
    mode,
    platform,
    global: Boolean(args.global),
    projectDir: path.resolve(args.projectDir || defaults.projectDir || process.cwd()),
    installRoot: args.installRoot ? path.resolve(args.installRoot) : null,
    projectContext: null,
    generateCommands: true,
    configureMcpServer: true,
  };
}

async function resolveSelection(rawArgs, options = {}) {
  const packageRoot = getPackageRoot();
  const platform = detectPlatform(rawArgs.platform || options.platform || process.platform);
  const packageInstallType = options.packageInstallType || detectPackageInstallType(
    packageRoot,
    options.projectDir || rawArgs.projectDir || process.cwd(),
  );
  const defaults = {
    agent: "all",
    mode: getDefaultMode(packageInstallType),
    platform,
    projectDir: options.projectDir || getDefaultProjectDir(),
    askProjectDir: options.askProjectDir,
    askMode: options.askMode,
  };
  const selected = rawArgs.yes
    ? validateArgs(rawArgs, defaults)
    : await collectAnswers(rawArgs, defaults);
  selected.platform = platform;
  selected.global = Boolean(rawArgs.global);
  selected.installRoot = rawArgs.installRoot ? path.resolve(rawArgs.installRoot) : null;
  const installRoot = getInstallRoot(
    selected.projectDir,
    packageInstallType,
    selected.installRoot,
    selected.agent,
    selected.global,
  );
  const installScope = selected.installRoot
    ? "custom"
    : selected.global ? "platform-global" : packageInstallType === "global" ? "global" : "project";

  return {
    packageInstallType,
    selected,
    installRoot,
    installScope,
  };
}

async function runInstall(rawArgs, options = {}) {
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const { packageInstallType, selected, installRoot, installScope } = await resolveSelection(rawArgs, options);
  const platform = selected.platform;

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

  const configured = selected.global ? [] : await configureAgents({
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

  const configured = selected.global
    ? []
    : await unconfigureAgents(selected.agent, selected.projectDir, installRoot, rawArgs.dryRun);
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
  AGENT_PLATFORMS,
  AGENTS,
  CONVENTIONS_RULE_CONFIG,
  HOOKS_DIR,
  MODES,
  PLATFORM_GLOBAL_PATHS,
  SUPPORTED_PLATFORMS,
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
  configureCursorMcp,
  configureMcp,
  configureRoocode,
  configureSharedMcp,
  detectPackageInstallType,
  detectPlatform,
  getDefaultMode,
  getDefaultProjectDir,
  getHooksDestPath,
  getInstallRoot,
  getPlatformGlobalRoot,
  isInteractiveInstall,
  isOurHookEntry,
  parseArgs,
  printHelp,
  printVersion,
  removeManagedBlock,
  removeMcpJsonEntry,
  removeOurHookEntries,
  removeSkillsSectionItems,
  replaceManagedBlock,
  runInstall,
  runPostInstall,
  runUninstall,
  unconfigureCursorMcp,
  unconfigureSharedMcp,
  upsertSkillsSection,
  validateArgs,
  writeMcpJsonFile,
};
