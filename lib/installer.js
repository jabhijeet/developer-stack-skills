const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const { SKILLS: SKILL_REGISTRY, SKILL_NAMES } = require("./skills");

const PACKAGE_NAME = "developer-stack-skills";
const MANAGED_MARKER = ".developer-stack-skills";
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
// "auto" configures the agents detected in the project; "all" configures every agent target
const AGENTS = ["auto", "all", ...AGENT_PLATFORMS];

// Agents with a dedicated config format; every other platform reads AGENTS.md
const NATIVE_AGENT_TARGETS = ["claude", "cursor", "cline", "roocode", "copilot", "gemini", "kiro", "antigravity"];
const AGENT_MARKERS = {
  claude: ["CLAUDE.md", ".claude"],
  cursor: [".cursor", ".cursorrules"],
  cline: [".clinerules"],
  roocode: [".roo", ".roomodes"],
  copilot: [path.join(".github", "copilot-instructions.md")],
  gemini: ["GEMINI.md", ".gemini"],
  kiro: [".kiro"],
  antigravity: [".agent"],
  generic: ["AGENTS.md"],
};
const AUTO_FALLBACK_TARGETS = ["claude", "generic"];
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

const SKILLS = SKILL_NAMES;

// Rule-file metadata for agents that scope instructions by glob (Cursor)
const RULE_CONFIGS = SKILL_REGISTRY.map((skill) => ({
  skillName: skill.name,
  description: skill.description,
  globs: skill.globs,
  alwaysApply: skill.alwaysApply === true,
}));

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
  // Options without a command (e.g. `developer-stack-skills --dry-run`) imply install
  const commandFlags = ["--version", "-v", "--help", "-h"];
  const hasCommand = Boolean(argv[0]) && (!argv[0].startsWith("-") || commandFlags.includes(argv[0]));
  const args = {
    command: hasCommand ? argv[0] : "install",
    agent: null,
    mode: null,
    platform: null,
    projectDir: null,
    installRoot: null,
    global: false,
    dryRun: false,
    force: false,
    yes: false,
  };
  const valueOptions = {
    "--agent": "agent",
    "--mode": "mode",
    "--platform": "platform",
    "--dir": "projectDir",
    "--install-root": "installRoot",
  };

  for (let index = hasCommand ? 1 : 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--yes" || token === "-y") {
      args.yes = true;
      continue;
    }

    if (token === "--force") {
      args.force = true;
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
  console.log("  developer-stack-skills doctor [--dir <project>] [--install-root <path>]");
  console.log("  developer-stack-skills version");
  console.log("  developer-stack-skills help");
  console.log("  developer-stack-skills install --agent auto --mode symlink --dir .");
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
  console.log("  doctor           check the installation and agent config; exits 1 on errors");
  console.log("  version      print package version");
  console.log("  help         print this help");
  console.log("");
  console.log("Options:");
  console.log(`  --agent <auto|all|${AGENT_PLATFORMS.join("|")}>`);
  console.log("                                  auto (default): agents detected in the project");
  console.log("                                  all: every agent config format");
  console.log("  --global, -g                    Install skills in the platform's user directory");
  console.log("  --mode <copy|symlink>");
  console.log("  --platform <windows|macos|linux>  Override detected operating system");
  console.log("  --dir <project-directory>");
  console.log("  --install-root <path>             Override the skill installation directory");
  console.log("  --dry-run");
  console.log("  --force                           Replace skill folders not created by this package");
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

const MAX_PROMPT_ATTEMPTS = 3;

// Re-asks on a typo instead of aborting the whole install; gives up after a few attempts
async function chooseValue(prompt, question, options, fallback, normalize = (value) => value.trim().toLowerCase()) {
  for (let attempt = 1; attempt <= MAX_PROMPT_ATTEMPTS; attempt += 1) {
    const answer = await prompt.ask(question);
    const normalized = answer ? normalize(answer) : fallback;

    if (normalized && options.includes(normalized)) {
      return normalized;
    }

    const reason = normalized ? `Invalid value "${answer}"` : "A value is required";
    if (attempt === MAX_PROMPT_ATTEMPTS) {
      throw new Error(`${reason}. Allowed: ${options.join(", ")}`);
    }
    console.log(`${reason}. Allowed: ${options.join(", ")}`);
  }
  return fallback;
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

  if (normalizedPackageRoot === localNodeModulesRoot) {
    return "local";
  }

  // npx runs from a purgeable cache (…/_npx/<hash>/node_modules/…); links into it go stale
  return normalizedPackageRoot.split(/[\\/]/).includes("_npx") ? "npx" : "global";
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
    if (!agent || agent === "all" || agent === "auto") {
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
  return packageInstallType === "local" || packageInstallType === "npx" ? "copy" : "symlink";
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

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

// A skill directory may be replaced when it is absent, is our link (live or dangling),
// or is a copy carrying our marker. Anything else belongs to the user.
async function canReplaceSkillDir(destPath, sourcePath) {
  let stat;
  try {
    stat = await fsp.lstat(destPath);
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    try {
      return (await fsp.realpath(destPath)) === (await fsp.realpath(sourcePath));
    } catch {
      return true;
    }
  }
  return pathExists(path.join(destPath, MANAGED_MARKER));
}

async function readManagedMarker(skillDir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(skillDir, MANAGED_MARKER), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Copies or links one skill directory. With `guarded`, an existing directory that is not
 * ours (e.g. a user's own ~/.claude/skills/testing) is left alone unless `force` is set.
 */
async function installSkill({ packageRoot, installRoot, skillName, mode, platform, dryRun = false, guarded = false, force = false }) {
  const sourcePath = getSkillSourcePath(packageRoot, skillName);
  const destPath = getSkillDestPath(installRoot, skillName);

  if (guarded && !force && !(await canReplaceSkillDir(destPath, sourcePath))) {
    return { skillName, sourcePath, destPath, skipped: true };
  }

  await removePath(destPath, dryRun);

  if (mode === "copy") {
    if (!dryRun) {
      await fsp.cp(sourcePath, destPath, { recursive: true });
      await fsp.writeFile(
        path.join(destPath, MANAGED_MARKER),
        `${JSON.stringify({ package: PACKAGE_NAME, version: getVersion() })}\n`,
        "utf8",
      );
    }
  } else {
    const symlinkType = platform === "windows" ? "junction" : "dir";
    if (!dryRun) {
      await ensureDir(path.dirname(destPath));
      await fsp.symlink(sourcePath, destPath, symlinkType);
    }
  }

  return { skillName, sourcePath, destPath, skipped: false };
}

async function uninstallSkill({ packageRoot, installRoot, skillName, dryRun = false, guarded = false, force = false }) {
  const destPath = getSkillDestPath(installRoot, skillName);
  if (guarded && !force && !(await canReplaceSkillDir(destPath, getSkillSourcePath(packageRoot, skillName)))) {
    return { skillName, destPath, skipped: true };
  }
  await removePath(destPath, dryRun);
  return { skillName, destPath, skipped: false };
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

const ALWAYS_ON_SKILLS = SKILL_REGISTRY.filter((skill) => skill.alwaysApply).map((skill) => skill.name);

async function configureClaude(projectDir, context, useMcp = false, dryRun = false) {
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

  // Native skills in .claude/skills load on demand from their descriptions, so this block
  // only names the cross-cutting skills; it never asks Claude to preload skill files.
  lines.push(
    "Developer stack skills are installed in `.claude/skills/` and load on demand when a task matches their description.",
    "",
    `Apply these skills to all work: ${ALWAYS_ON_SKILLS.map((name) => `\`${name}\``).join(", ")}.`,
  );
  if (useMcp) {
    lines.push(
      "",
      "For an unfamiliar file type, the `developer-stack-skills` MCP server's `detect_stack` tool names the matching skill.",
    );
  }

  const body = lines.join("\n");
  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

function getClaudeSkillsDir(projectDir) {
  return path.join(projectDir, ".claude", "skills");
}

async function configureClaudeSkills({ projectDir, packageRoot, mode, platform, force = false, dryRun = false }) {
  const skillsDir = getClaudeSkillsDir(projectDir);
  const results = [];
  for (const skillName of SKILLS) {
    results.push(await installSkill({ packageRoot, installRoot: skillsDir, skillName, mode, platform, dryRun, guarded: true, force }));
  }
  return results;
}

async function unconfigureClaudeSkills({ projectDir, packageRoot, force = false, dryRun = false }) {
  const skillsDir = getClaudeSkillsDir(projectDir);
  const results = [];
  for (const skillName of SKILLS) {
    results.push(await uninstallSkill({ packageRoot, installRoot: skillsDir, skillName, dryRun, guarded: true, force }));
  }
  return results;
}

// One line per skill so agents read only the skill that matches the work at hand
function renderSkillIndex(installRoot) {
  return SKILL_REGISTRY.map((skill) => {
    const scope = skill.alwaysApply ? " (applies to all work)" : "";
    return `- \`${skill.name}\`${scope} — ${skill.description}: ${path.join(installRoot, skill.name, "SKILL.md")}`;
  });
}

function buildSkillIndexBlock(installRoot, intro) {
  return [
    intro,
    "Read only the skill files that match the current task or file; do not preload all of them.",
    "",
    ...renderSkillIndex(installRoot),
  ].join("\n");
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

/**
 * MCP launch command per install type. A source checkout runs its own bin so edits take
 * effect; npx gets -y so a client without a TTY never blocks on the install prompt; on
 * Windows, npm shims (.cmd) only start through cmd.exe.
 */
function buildMcpCommand(packageInstallType, platform = detectPlatform(process.platform), packageRoot = getPackageRoot()) {
  if (packageInstallType === "source") {
    return { command: "node", args: [path.join(packageRoot, "bin", "developer-stack-skills.js"), "serve"] };
  }
  const base = packageInstallType === "global"
    ? ["developer-stack-skills", "serve"]
    : ["npx", "-y", "developer-stack-skills", "serve"];
  return platform === "windows"
    ? { command: "cmd", args: ["/c", ...base] }
    : { command: base[0], args: base.slice(1) };
}

async function writeMcpJsonFile(filePath, packageInstallType, dryRun = false, platform = undefined) {
  const current = await readIfExists(filePath);
  let config = {};
  if (current.trim()) {
    try { config = JSON.parse(current); } catch {
      throw new Error(`${filePath} has invalid JSON; MCP configuration was not changed`);
    }
  }
  if (!config.mcpServers) config.mcpServers = {};
  const { command, args } = buildMcpCommand(packageInstallType, platform);
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

// Claude Code reads project MCP servers from .mcp.json at the project root (shared with Cline/Roo)
async function configureMcp(projectDir, packageInstallType, dryRun = false, platform = undefined) {
  return configureSharedMcp(projectDir, packageInstallType, dryRun, platform);
}

async function configureCursorMcp(projectDir, packageInstallType, dryRun = false, platform = undefined) {
  return writeMcpJsonFile(path.join(projectDir, ".cursor", "mcp.json"), packageInstallType, dryRun, platform);
}

async function configureSharedMcp(projectDir, packageInstallType, dryRun = false, platform = undefined) {
  return writeMcpJsonFile(path.join(projectDir, ".mcp.json"), packageInstallType, dryRun, platform);
}

// Removes the entry older releases wrote to .claude/mcp.json, which Claude Code never read
async function unconfigureLegacyClaudeMcp(projectDir, dryRun = false) {
  return removeMcpJsonEntry(path.join(projectDir, ".claude", "mcp.json"), dryRun);
}

async function hasManagedBlock(filePath) {
  return (await readIfExists(filePath)).includes(`<!-- ${MANAGED_START} -->`);
}

// .mcp.json is shared by Claude, Cline, and Roo; keep our entry while any of them is still configured
async function isSharedMcpInUse(projectDir) {
  return (await hasManagedBlock(path.join(projectDir, "CLAUDE.md")))
    || (await hasManagedBlock(path.join(projectDir, ".clinerules")))
    || pathExists(path.join(projectDir, ".roo", "rules", "developer-stack-skills.md"));
}

async function unconfigureSharedMcpIfUnused(projectDir, dryRun = false) {
  if (await isSharedMcpInUse(projectDir)) return null;
  return unconfigureSharedMcp(projectDir, dryRun);
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
    if (!dryRun) {
      await fsp.cp(sourcePath, destPath, { recursive: true });
      // Hooks share detection with the MCP server; a copied install has no lib/ beside it
      await fsp.copyFile(path.join(packageRoot, "lib", "skills.js"), path.join(destPath, "skills.js"));
    }
  } else {
    const symlinkType = platform === "windows" ? "junction" : "dir";
    if (!dryRun) await fsp.symlink(sourcePath, destPath, symlinkType);
  }

  return { sourcePath, destPath };
}

function parseSettingsFile(filePath, current) {
  if (!current.trim()) return {};
  try {
    return JSON.parse(current);
  } catch {
    throw new Error(`${filePath} has invalid JSON; Claude hooks were not changed`);
  }
}

// Drops our PreToolUse entries from settings.hooks and from the top-level key older
// releases wrote by mistake (Claude Code only reads settings.hooks).
function stripOurHooks(settings, hooksDir) {
  if (settings.PreToolUse) {
    settings.PreToolUse = removeOurHookEntries(settings.PreToolUse, hooksDir);
    if (settings.PreToolUse.length === 0) delete settings.PreToolUse;
  }
  if (settings.hooks && settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = removeOurHookEntries(settings.hooks.PreToolUse, hooksDir);
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }
  return settings;
}

async function configureClaudeHooks(projectDir, hooksDir, dryRun = false) {
  const filePath = path.join(projectDir, ".claude", "settings.json");
  const settings = stripOurHooks(parseSettingsFile(filePath, await readIfExists(filePath)), hooksDir);

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  settings.hooks.PreToolUse.push(
    {
      matcher: "Write|Edit|MultiEdit",
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

  const settings = stripOurHooks(parseSettingsFile(filePath, current), hooksDir);

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

const SKILL_INDEX_INTRO = "These developer-stack-skills files hold the coding conventions for this project.";

async function configureCline(projectDir, installRoot, useMcp = false, dryRun = false) {
  const filePath = path.join(projectDir, ".clinerules");
  const current = await readIfExists(filePath);
  const body = useMcp
    ? MCP_INSTRUCTION_LINES.join("\n")
    : buildSkillIndexBlock(installRoot, SKILL_INDEX_INTRO);
  const next = replaceManagedBlock(current, body, "html");
  await writeFileWithDirs(filePath, next, dryRun);
  return filePath;
}

async function configureRoocode(projectDir, installRoot, useMcp = false, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "rules", "developer-stack-skills.md");
  const body = useMcp
    ? ["# Developer Stack Skills", "", ...MCP_INSTRUCTION_LINES, ""].join("\n")
    : ["# Developer Stack Skills", "", buildSkillIndexBlock(installRoot, SKILL_INDEX_INTRO), ""].join("\n");
  await writeFileWithDirs(filePath, body, dryRun);
  return filePath;
}

async function configureCopilot(projectDir, installRoot, dryRun = false) {
  return configureInstructionFile(projectDir, path.join(".github", "copilot-instructions.md"), installRoot, dryRun);
}

async function configureInstructionFile(projectDir, relativePath, installRoot, dryRun = false) {
  const filePath = path.join(projectDir, relativePath);
  const current = await readIfExists(filePath);
  const body = buildSkillIndexBlock(installRoot, SKILL_INDEX_INTRO);
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

async function detectAgents(projectDir) {
  const detected = [];
  for (const [agent, markers] of Object.entries(AGENT_MARKERS)) {
    for (const marker of markers) {
      if (await pathExists(path.join(projectDir, marker))) {
        detected.push(agent);
        break;
      }
    }
  }
  return detected.length ? detected : AUTO_FALLBACK_TARGETS;
}

// "all" covers each config format once: every platform outside NATIVE_AGENT_TARGETS shares AGENTS.md
async function getAgentTargets(agent, projectDir) {
  if (agent === "all") return [...NATIVE_AGENT_TARGETS, "generic"];
  if (agent === "auto") return detectAgents(projectDir);
  return [agent];
}

function getInstructionFile(target) {
  if (target === "copilot" || target === "vscode") return path.join(".github", "copilot-instructions.md");
  if (target === "gemini") return "GEMINI.md";
  if (target === "kiro") return path.join(".kiro", "steering", "developer-stack-skills.md");
  if (target === "antigravity") return path.join(".agent", "rules", "developer-stack-skills.md");
  return "AGENTS.md";
}

const SKIPPED_ACTION = "skipped (existing directory not managed by developer-stack-skills; use --force to replace)";

async function configureAgents({
  agent, projectDir, installRoot, context, generateCommands, configureMcpServer, packageInstallType,
  packageRoot = getPackageRoot(), mode = "copy", platform = detectPlatform(process.platform), force = false, dryRun = false,
}) {
  const targets = await getAgentTargets(agent, projectDir);
  const configured = [];
  const hooksDir = getHooksDestPath(installRoot);
  const record = (target, filePath, action = "updated") => configured.push({ agent: target, filePath, action });
  let sharedMcpWritten = false;
  const configureSharedMcpOnce = async (target) => {
    if (sharedMcpWritten) return;
    sharedMcpWritten = true;
    record(target, await configureSharedMcp(projectDir, packageInstallType, dryRun, platform));
  };

  for (const target of targets) {
    if (target === "claude") {
      record(target, await configureClaude(projectDir, context, configureMcpServer, dryRun));
      for (const result of await configureClaudeSkills({ projectDir, packageRoot, mode, platform, force, dryRun })) {
        record("claude-skills", result.destPath, result.skipped ? SKIPPED_ACTION : "updated");
      }
      // Rule files from earlier releases would load every skill unconditionally next to the native skills
      for (const filePath of await unconfigureClaudeRules(projectDir, dryRun)) {
        record("claude-legacy-rules", filePath, "removed");
      }
      record("claude-hooks", await configureClaudeHooks(projectDir, hooksDir, dryRun));
      if (generateCommands) {
        for (const filePath of await configureClaudeCommands(projectDir, packageRoot, dryRun)) {
          record("claude-commands", filePath);
        }
      }
      await unconfigureLegacyClaudeMcp(projectDir, dryRun);
      if (configureMcpServer) await configureSharedMcpOnce("claude-mcp");
      continue;
    }

    if (target === "cursor") {
      for (const filePath of await configureCursor(projectDir, installRoot, dryRun)) {
        record(target, filePath);
      }
      if (configureMcpServer) {
        record("cursor-mcp", await configureCursorMcp(projectDir, packageInstallType, dryRun, platform));
      }
      continue;
    }

    if (target === "cline") {
      record(target, await configureCline(projectDir, installRoot, configureMcpServer, dryRun));
      if (configureMcpServer) await configureSharedMcpOnce("cline-mcp");
      continue;
    }

    if (target === "roocode") {
      record(target, await configureRoocode(projectDir, installRoot, configureMcpServer, dryRun));
      if (configureMcpServer) await configureSharedMcpOnce("roocode-mcp");
      continue;
    }

    record(target, await configureInstructionFile(projectDir, getInstructionFile(target), installRoot, dryRun));
  }

  return configured;
}

async function unconfigureClaude(projectDir, dryRun = false) {
  return unconfigureInstructionFile(projectDir, "CLAUDE.md", dryRun);
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
  return unconfigureInstructionFile(projectDir, ".clinerules", dryRun);
}

async function unconfigureRoocode(projectDir, dryRun = false) {
  const filePath = path.join(projectDir, ".roo", "rules", "developer-stack-skills.md");
  await removePath(filePath, dryRun);
  return filePath;
}

async function unconfigureAgents({ agent, projectDir, installRoot, packageRoot = getPackageRoot(), force = false, dryRun = false }) {
  const targets = await getAgentTargets(agent, projectDir);
  const configured = [];
  const record = (target, filePath, action = "removed") => configured.push({ agent: target, filePath, action });

  for (const target of targets) {
    if (target === "claude") {
      record(target, await unconfigureClaude(projectDir, dryRun));
      for (const result of await unconfigureClaudeSkills({ projectDir, packageRoot, force, dryRun })) {
        record("claude-skills", result.destPath, result.skipped ? SKIPPED_ACTION : "removed");
      }
      for (const filePath of await unconfigureClaudeRules(projectDir, dryRun)) {
        record("claude-legacy-rules", filePath);
      }
      record("claude-hooks", await unconfigureClaudeHooks(projectDir, getHooksDestPath(installRoot), dryRun));
      for (const filePath of await unconfigureClaudeCommands(projectDir, dryRun)) {
        record("claude-commands", filePath);
      }
      await unconfigureLegacyClaudeMcp(projectDir, dryRun);
      continue;
    }

    if (target === "cursor") {
      for (const filePath of await unconfigureCursor(projectDir, dryRun)) {
        record(target, filePath);
      }
      record("cursor-mcp", await unconfigureCursorMcp(projectDir, dryRun));
      continue;
    }

    if (target === "cline") {
      record(target, await unconfigureCline(projectDir, dryRun));
      continue;
    }

    if (target === "roocode") {
      record(target, await unconfigureRoocode(projectDir, dryRun));
      continue;
    }

    record(target, await unconfigureInstructionFile(projectDir, getInstructionFile(target), dryRun));
  }

  if (targets.some((target) => ["claude", "cline", "roocode"].includes(target))) {
    const sharedMcp = await unconfigureSharedMcpIfUnused(projectDir, dryRun);
    if (sharedMcp) record("shared-mcp", sharedMcp);
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
    const defaultAgent = defaults.agent || "auto";
    const defaultMode = defaults.mode || "symlink";
    const defaultProjectDir = path.resolve(defaults.projectDir || process.cwd());
    const askMode = defaults.askMode !== false;
    const agent = normalizeAgent(args.agent) || await chooseValue(
      prompt,
      `Agent platform to configure (default: ${defaultAgent} = agents detected in the project; see help for supported values): `,
      AGENTS,
      defaultAgent,
      normalizeAgent,
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

    const normalizedAgent = normalizeAgent(agent) || "auto";
    const isClaudeTarget = ["auto", "all", "claude"].includes(normalizedAgent);
    const projectContext = isClaudeTarget ? await collectProjectContext(prompt) : null;

    let generateCommands = false;
    let configureMcpServer = false;
    if (isClaudeTarget) {
      const commandsInput = await prompt.ask("\nGenerate Claude Code slash commands? [yes/no] (default: yes): ");
      generateCommands = commandsInput === "" || /^y(es)?$/i.test(commandsInput.trim());
      const mcpInput = await prompt.ask("Configure MCP server (detect_stack/get_skill tools)? [yes/no] (default: yes): ");
      configureMcpServer = mcpInput === "" || /^y(es)?$/i.test(mcpInput.trim());
    }

    return {
      agent: normalizedAgent,
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
  const agent = normalizeAgent(args.agent || defaults.agent || "auto");
  const mode = normalizeMode(args.mode || defaults.mode || "symlink");
  const platform = detectPlatform(args.platform || defaults.platform || process.platform);

  if (!AGENTS.includes(agent)) {
    throw new Error(`Invalid agent "${args.agent}". Allowed: ${AGENTS.join(", ")}`);
  }

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode "${args.mode}". Allowed: ${MODES.join(", ")}`);
  }

  if (args.global && (agent === "all" || agent === "auto")) {
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

function getInstallScope(selected, packageInstallType) {
  if (selected.installRoot) return "custom";
  if (selected.global) return "platform-global";
  return packageInstallType === "global" ? "global" : "project";
}

async function resolveSelection(rawArgs, options = {}) {
  const packageRoot = getPackageRoot();
  const platform = detectPlatform(rawArgs.platform || options.platform || process.platform);
  // Same project dir as the install defaults (INIT_CWD under npm), so detection and target agree
  const defaultProjectDir = options.projectDir || getDefaultProjectDir();
  const packageInstallType = options.packageInstallType || detectPackageInstallType(
    packageRoot,
    rawArgs.projectDir ? path.resolve(rawArgs.projectDir) : defaultProjectDir,
  );
  const defaults = {
    agent: "auto",
    mode: getDefaultMode(packageInstallType),
    platform,
    projectDir: defaultProjectDir,
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

  return {
    packageInstallType,
    selected,
    installRoot,
    installScope: getInstallScope(selected, packageInstallType),
  };
}

function logItems(items, dryRun) {
  for (const item of items) {
    const action = dryRun && !item.action.startsWith("skipped") ? `would be ${item.action}` : item.action;
    console.log(`[${PACKAGE_NAME}] ${item.agent} ${action}: ${item.filePath}`);
  }
}

async function runInstall(rawArgs, options = {}) {
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const { packageInstallType, selected, installRoot, installScope } = await resolveSelection(rawArgs, options);
  const platform = selected.platform;
  const dryRun = Boolean(rawArgs.dryRun);
  // A platform-global root (e.g. ~/.claude/skills) also holds the user's own skills
  const guarded = installScope === "platform-global";

  console.log(`[${PACKAGE_NAME}] installing version ${version}`);
  console.log(`[${PACKAGE_NAME}] package install type: ${packageInstallType}`);
  console.log(`[${PACKAGE_NAME}] skill install scope: ${installScope}`);
  console.log(`[${PACKAGE_NAME}] os: ${platform}`);
  console.log(`[${PACKAGE_NAME}] package dir: ${packageRoot}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${selected.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${installRoot}`);
  console.log(`[${PACKAGE_NAME}] agent: ${selected.agent}`);
  console.log(`[${PACKAGE_NAME}] mode: ${selected.mode}`);
  console.log(`[${PACKAGE_NAME}] dry run: ${dryRun ? "yes" : "no"}`);

  await ensureDir(installRoot, dryRun);

  const installedSkills = [];
  for (const skillName of SKILLS) {
    const result = await installSkill({
      packageRoot,
      installRoot,
      skillName,
      mode: selected.mode,
      platform,
      dryRun,
      guarded,
      force: rawArgs.force,
    });
    installedSkills.push(result);
    logItems([{ agent: "skill", filePath: result.destPath, action: result.skipped ? SKIPPED_ACTION : "installed" }], dryRun);
  }

  // Hooks only serve project agent configs, which a platform-global install does not write
  if (!selected.global) {
    const hooksResult = await installHooks({ packageRoot, installRoot, mode: selected.mode, platform, dryRun });
    logItems([{ agent: "hooks", filePath: hooksResult.destPath, action: "installed" }], dryRun);
  }

  const configured = selected.global ? [] : await configureAgents({
    agent: selected.agent,
    projectDir: selected.projectDir,
    installRoot,
    context: selected.projectContext,
    generateCommands: selected.generateCommands,
    configureMcpServer: selected.configureMcpServer,
    packageInstallType,
    packageRoot,
    mode: selected.mode,
    platform,
    force: rawArgs.force,
    dryRun,
  });
  logItems(configured, dryRun);

  console.log(`[${PACKAGE_NAME}] ${dryRun ? "install dry run complete" : "install complete"}`);

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
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const { packageInstallType, selected, installRoot, installScope } = await resolveSelection(
    rawArgs,
    { ...options, askMode: false },
  );
  const dryRun = Boolean(rawArgs.dryRun);

  console.log(`[${PACKAGE_NAME}] uninstalling version ${version}`);
  console.log(`[${PACKAGE_NAME}] package install type: ${packageInstallType}`);
  console.log(`[${PACKAGE_NAME}] skill install scope: ${installScope}`);
  console.log(`[${PACKAGE_NAME}] project dir: ${selected.projectDir}`);
  console.log(`[${PACKAGE_NAME}] install dir: ${installRoot}`);
  console.log(`[${PACKAGE_NAME}] agent: ${selected.agent}`);
  console.log(`[${PACKAGE_NAME}] dry run: ${dryRun ? "yes" : "no"}`);

  const configured = selected.global
    ? []
    : await unconfigureAgents({ agent: selected.agent, projectDir: selected.projectDir, installRoot, packageRoot, force: rawArgs.force, dryRun });
  logItems(configured, dryRun);

  for (const skillName of SKILLS) {
    const result = await uninstallSkill({
      packageRoot,
      installRoot,
      skillName,
      dryRun,
      guarded: installScope === "platform-global",
      force: rawArgs.force,
    });
    logItems([{ agent: "skill", filePath: result.destPath, action: result.skipped ? SKIPPED_ACTION : "removed" }], dryRun);
  }

  if (!selected.global) {
    const hooksPath = getHooksDestPath(installRoot);
    await removePath(hooksPath, dryRun);
    logItems([{ agent: "hooks", filePath: hooksPath, action: "removed" }], dryRun);
  }

  console.log(`[${PACKAGE_NAME}] ${dryRun ? "uninstall dry run complete" : "uninstall complete"}`);

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
  HOOKS_DIR,
  MANAGED_MARKER,
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
  configureClaudeSkills,
  configureCline,
  configureCursor,
  configureCursorMcp,
  configureMcp,
  configureRoocode,
  configureSharedMcp,
  detectAgents,
  detectPackageInstallType,
  detectPlatform,
  getAgentTargets,
  getDefaultMode,
  getDefaultProjectDir,
  getHooksDestPath,
  getInstallRoot,
  getPlatformGlobalRoot,
  installSkill,
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
  unconfigureAgents,
  unconfigureClaudeSkills,
  unconfigureCursorMcp,
  unconfigureSharedMcp,
  unconfigureSharedMcpIfUnused,
  upsertSkillsSection,
  validateArgs,
  writeMcpJsonFile,
};
