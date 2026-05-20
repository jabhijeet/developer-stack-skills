const path = require("path");
const fsp = require("fs/promises");

const PACKAGE_NAME = "developer-stack-skills";

const SKILL_META = {
  "java-spring": {
    description: "Java 25 & Spring Boot 4 / Spring 7 — JPA, REST APIs, JUnit 5, Mockito, Maven/Gradle",
    globs: ["**/*.java", "**/*.kt", "**/pom.xml", "**/build.gradle", "**/build.gradle.kts"],
  },
  "python-backend": {
    description: "Python 3.14 backend — FastAPI, Django, SQLAlchemy 2.x, Pydantic v2, pytest",
    globs: ["**/*.py", "**/requirements*.txt", "**/pyproject.toml", "**/setup.py", "**/Pipfile"],
  },
  frontend: {
    description: "Frontend — React 19+, Angular 21+, TypeScript, TanStack Query, Vitest, Playwright",
    globs: ["**/*.tsx", "**/*.jsx", "**/*.ts", "**/*.js", "**/*.vue", "**/*.svelte", "**/package.json"],
  },
  testing: {
    description: "Testing — JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers",
    globs: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/__tests__/**"],
  },
  "project-conventions": {
    description: "Project conventions — Git flow, Conventional Commits, PR process, ADRs, naming, env config",
    globs: [],
  },
};

const SKILL_NAMES = Object.keys(SKILL_META);

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
      properties: {
        stack_name: {
          type: "string",
          enum: SKILL_NAMES,
          description: "Stack to retrieve: java-spring, python-backend, frontend, testing, or project-conventions.",
        },
      },
      required: ["stack_name"],
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
    description: "Detect the recommended skill to load from a file path. Returns the skill name and a ready-to-use get_skill call.",
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
  } catch {
    return null;
  }
}

function detectStack(filePath) {
  const name = path.basename(filePath);

  const isTestFile =
    /\.(test|spec)\.(java|py|ts|tsx|js|jsx)$/.test(name) ||
    /Tests?\.java$/.test(name) ||
    /IT\.java$/.test(name) ||
    /^test_/.test(name) ||
    /_test\.py$/.test(name);

  if (isTestFile) return "testing";
  if (/\.(java|kt)$/.test(name) || /^(pom\.xml|build\.gradle(\.kts)?)$/.test(name)) return "java-spring";
  if (/\.py$/.test(name) || /^(pyproject\.toml|requirements.*\.txt|setup\.py|Pipfile)$/.test(name)) return "python-backend";
  if (/\.(component|service|module|guard|pipe|directive|interceptor|resolver)\.ts$/.test(name)) return "frontend";
  if (/\.(tsx|jsx|ts|js|vue|svelte)$/.test(name) || /^package\.json$/.test(name)) return "frontend";
  return "project-conventions";
}

function errorResponse(error_type, message, retryable = false) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error_type, message, retryable }) }],
  };
}

async function handleTool(name, args) {
  if (name === "list_available_skills") {
    const skills = SKILL_NAMES.map((skillName) => ({
      name: skillName,
      description: SKILL_META[skillName].description,
      applies_to: SKILL_META[skillName].globs.slice(0, 3).join(", ") || "always",
    }));
    return { content: [{ type: "text", text: JSON.stringify(skills, null, 2) }] };
  }

  if (name === "get_skill") {
    const { stack_name } = args;
    if (!SKILL_META[stack_name]) {
      return errorResponse(
        "INVALID_SKILL",
        `Unknown skill: '${stack_name}'. Available: ${SKILL_NAMES.join(", ")}`,
      );
    }
    const content = await readSkillFile(stack_name);
    if (!content) {
      return errorResponse(
        "SKILL_NOT_FOUND",
        `Skill '${stack_name}' file missing. Run: developer-stack-skills install`,
      );
    }
    return { content: [{ type: "text", text: content }] };
  }

  if (name === "get_conventions") {
    const content = await readSkillFile("project-conventions");
    if (!content) {
      return errorResponse(
        "SKILL_NOT_FOUND",
        "Skill 'project-conventions' file missing. Run: developer-stack-skills install",
      );
    }
    return { content: [{ type: "text", text: content }] };
  }

  if (name === "detect_stack") {
    const { file_path } = args;
    const stack = detectStack(file_path);
    const meta = SKILL_META[stack];
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          file_path,
          recommended_skill: stack,
          description: meta.description,
          next_step: `Call get_skill with stack_name: "${stack}"`,
        }, null, 2),
      }],
    };
  }

  return errorResponse("UNKNOWN_TOOL", `Unknown tool: '${name}'`);
}

async function runMcpServer() {
  // Lazy-load SDK so pure functions (detectStack, etc.) work without it installed
  const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
  const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
  const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

  const server = new Server(
    { name: PACKAGE_NAME, version: getVersion() },
    {
      capabilities: { tools: {} },
      instructions: "Use list_available_skills first to discover what stacks are available. Use detect_stack to identify which skill applies to a specific file. Use get_skill to load full conventions before writing code.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    return handleTool(name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${PACKAGE_NAME}] MCP server started (stdio)\n`);
}

module.exports = { runMcpServer, detectStack, handleTool, SKILL_META, SKILL_NAMES };
