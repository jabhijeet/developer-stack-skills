const path = require("path");
const fsp = require("fs/promises");

const { SKILLS, SKILL_NAMES, detectStack, getSkill, rankSkills } = require("./skills");

const PACKAGE_NAME = "developer-stack-skills";
const RESOURCE_SCHEME = "skill://";

const SKILL_META = Object.fromEntries(
  SKILLS.map((skill) => [skill.name, { description: skill.description, globs: skill.globs }]),
);

const STACK_NAME_SCHEMA = {
  type: "string",
  enum: SKILL_NAMES,
  description: "Skill name. Call list_available_skills to see every skill with its description.",
};

const TOOLS = [
  {
    name: "list_available_skills",
    description: "List all developer stack skills with descriptions and applicable file patterns.",
    inputSchema: { type: "object", properties: {}, required: [] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_skill",
    description: "Get full SKILL.md content for a technology stack. Load this before writing code in that stack.",
    inputSchema: {
      type: "object",
      properties: { stack_name: STACK_NAME_SCHEMA },
      required: ["stack_name"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_skill_section",
    description: "Get one section of a SKILL.md by heading (case-insensitive substring match). Cheaper than get_skill when only one topic is needed; an unknown heading returns the available headings.",
    inputSchema: {
      type: "object",
      properties: {
        stack_name: STACK_NAME_SCHEMA,
        heading: { type: "string", description: "Heading text to find, e.g. \"Error handling\" or \"Testing\"." },
      },
      required: ["stack_name", "heading"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_conventions",
    description: "Get project-wide conventions: Git branching, Conventional Commits, PR process, naming rules, ADRs, env config.",
    inputSchema: { type: "object", properties: {}, required: [] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "detect_stack",
    description: "Detect the recommended skill to load from a file path. Returns the best skill, other matching skills, and a ready-to-use get_skill call.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "File path to analyze, e.g. src/UserService.java or app/routes/users.py.",
        },
      },
      required: ["file_path"],
    },
    annotations: { readOnlyHint: true },
  },
];

function getPackageRoot() {
  return path.resolve(__dirname, "..");
}

function getVersion() {
  return require(path.join(getPackageRoot(), "package.json")).version;
}

async function readSkillFile(skillName) {
  const skillPath = path.join(getPackageRoot(), skillName, "SKILL.md");
  try {
    return await fsp.readFile(skillPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Headings inside fenced code blocks (e.g. "# comment" in a shell sample) are not sections
function listHeadings(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ level: match[1].length, text: match[2], line: index });
  });
  return { lines, headings };
}

function extractSection(markdown, heading) {
  const { lines, headings } = listHeadings(markdown);
  const needle = heading.trim().toLowerCase();
  const startIndex = headings.findIndex((h) => h.text.toLowerCase().includes(needle));
  if (startIndex === -1) {
    return { found: false, headings: headings.map((h) => `${"#".repeat(h.level)} ${h.text}`) };
  }
  const start = headings[startIndex];
  const next = headings.slice(startIndex + 1).find((h) => h.level <= start.level);
  const end = next ? next.line : lines.length;
  return { found: true, text: lines.slice(start.line, end).join("\n").trimEnd() };
}

function errorResponse(error_type, message, retryable = false) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error_type, message, retryable }) }],
  };
}

function textResponse(text) {
  return { content: [{ type: "text", text }] };
}

function missingSkillResponse(skillName) {
  return errorResponse(
    "SKILL_NOT_FOUND",
    `Skill '${skillName}' file is missing from the ${PACKAGE_NAME} package. Reinstall the package.`,
  );
}

function validateStackName(stack_name) {
  if (typeof stack_name !== "string" || !stack_name) {
    return errorResponse("INVALID_ARGUMENT", "stack_name must be a non-empty string");
  }
  if (!getSkill(stack_name)) {
    return errorResponse(
      "INVALID_SKILL",
      `Unknown skill: '${stack_name}'. Available: ${SKILL_NAMES.join(", ")}`,
    );
  }
  return null;
}

async function dispatchTool(name, args) {
  if (name === "list_available_skills") {
    const skills = SKILLS.map((skill) => ({
      name: skill.name,
      description: skill.description,
      applies_to: skill.alwaysApply ? "always" : skill.globs.slice(0, 3).join(", "),
    }));
    return textResponse(JSON.stringify(skills, null, 2));
  }

  if (name === "get_skill") {
    const invalid = validateStackName(args.stack_name);
    if (invalid) return invalid;
    const content = await readSkillFile(args.stack_name);
    return content ? textResponse(content) : missingSkillResponse(args.stack_name);
  }

  if (name === "get_skill_section") {
    const invalid = validateStackName(args.stack_name);
    if (invalid) return invalid;
    if (typeof args.heading !== "string" || !args.heading.trim()) {
      return errorResponse("INVALID_ARGUMENT", "heading must be a non-empty string");
    }
    const content = await readSkillFile(args.stack_name);
    if (!content) return missingSkillResponse(args.stack_name);
    const section = extractSection(content, args.heading);
    if (!section.found) {
      return errorResponse(
        "SECTION_NOT_FOUND",
        `No heading matching '${args.heading}' in ${args.stack_name}. Available headings:\n${section.headings.join("\n")}`,
      );
    }
    return textResponse(section.text);
  }

  if (name === "get_conventions") {
    const content = await readSkillFile("project-conventions");
    return content ? textResponse(content) : missingSkillResponse("project-conventions");
  }

  if (name === "detect_stack") {
    const { file_path } = args;
    if (typeof file_path !== "string" || !file_path.trim()) {
      return errorResponse("INVALID_ARGUMENT", "file_path must be a non-empty string");
    }
    const stack = detectStack(file_path);
    const related = rankSkills(file_path).map((match) => match.name).filter((skill) => skill !== stack);
    return textResponse(JSON.stringify({
      file_path,
      recommended_skill: stack,
      description: getSkill(stack).description,
      related_skills: related,
      next_step: `Call get_skill with stack_name: "${stack}"`,
    }, null, 2));
  }

  return errorResponse("UNKNOWN_TOOL", `Unknown tool: '${name}'`);
}

async function handleTool(name, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return errorResponse("INVALID_ARGUMENT", "Tool arguments must be an object");
  }
  try {
    return await dispatchTool(name, args);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", error.message, true);
  }
}

// ── Resources: each SKILL.md as skill://<name> ──────────────

function listResources() {
  return SKILLS.map((skill) => ({
    uri: `${RESOURCE_SCHEME}${skill.name}`,
    name: skill.name,
    description: skill.description,
    mimeType: "text/markdown",
  }));
}

async function readResource(uri) {
  const skillName = typeof uri === "string" && uri.startsWith(RESOURCE_SCHEME)
    ? uri.slice(RESOURCE_SCHEME.length)
    : null;
  if (!skillName || !getSkill(skillName)) {
    throw new Error(`Unknown resource: ${uri}`);
  }
  const content = await readSkillFile(skillName);
  if (!content) throw new Error(`Skill '${skillName}' file is missing from the package`);
  return { contents: [{ uri, mimeType: "text/markdown", text: content }] };
}

// ── Prompts: the bundled commands/*.md slash commands ───────

function parseCommandFile(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  const frontmatter = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { frontmatter, body: match ? content.slice(match[0].length) : content };
}

async function loadCommands() {
  const commandsDir = path.join(getPackageRoot(), "commands");
  let files;
  try {
    files = await fsp.readdir(commandsDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const commands = [];
  for (const file of files.filter((name) => name.endsWith(".md")).sort()) {
    const { frontmatter, body } = parseCommandFile(await fsp.readFile(path.join(commandsDir, file), "utf8"));
    commands.push({
      name: path.basename(file, ".md"),
      description: frontmatter.description || "",
      argumentHint: frontmatter["argument-hint"] || "",
      body,
    });
  }
  return commands;
}

async function listPrompts() {
  const commands = await loadCommands();
  return commands.map((command) => ({
    name: command.name,
    description: command.description,
    arguments: [{
      name: "arguments",
      description: command.argumentHint || "Command arguments",
      required: false,
    }],
  }));
}

async function getPrompt(name, args = {}) {
  const command = (await loadCommands()).find((item) => item.name === name);
  if (!command) throw new Error(`Unknown prompt: ${name}`);
  const text = command.body.replace(/\$ARGUMENTS/g, (args && args.arguments) || "").trim();
  return {
    description: command.description,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

async function runMcpServer() {
  // Lazy-load SDK so pure functions (detectStack, etc.) work without it installed
  const { Server } = require("@modelcontextprotocol/server");
  const { StdioServerTransport } = require("@modelcontextprotocol/server/stdio");

  const server = new Server(
    { name: PACKAGE_NAME, version: getVersion() },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: "Use list_available_skills first to discover what skills are available. Load loop-engineering for non-trivial iterative work. Use detect_stack to identify which stack skill applies to a specific file, then use get_skill (or get_skill_section for one topic) to load conventions before writing code.",
    },
  );

  server.setRequestHandler("tools/list", async () => ({ tools: TOOLS }));
  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args = {} } = request.params;
    return handleTool(name, args);
  });
  server.setRequestHandler("resources/list", async () => ({ resources: listResources() }));
  server.setRequestHandler("resources/read", async (request) => readResource(request.params.uri));
  server.setRequestHandler("prompts/list", async () => ({ prompts: await listPrompts() }));
  server.setRequestHandler("prompts/get", async (request) => getPrompt(request.params.name, request.params.arguments));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${PACKAGE_NAME}] MCP server started (stdio)\n`);
}

module.exports = {
  runMcpServer,
  detectStack,
  extractSection,
  getPrompt,
  handleTool,
  listPrompts,
  listResources,
  readResource,
  SKILL_META,
  SKILL_NAMES,
  TOOLS,
};
