const path = require("path");
const fsp = require("fs/promises");

const PACKAGE_NAME = "developer-stack-skills";

const SKILL_META = {
  "java-spring": {
    description: "Java 25 & Spring Boot 4 / Spring 7 — JPA, REST APIs, JUnit 5, Mockito, Maven/Gradle",
    globs: ["**/*.java", "**/*.kt", "**/pom.xml", "**/build.gradle", "**/build.gradle.kts"],
  },
  "java-data": {
    description: "Java data access — Flyway/Liquibase migrations, JPA/Hibernate, transactions, connection pooling, query optimization, caching",
    globs: [
      "**/db/migration/**", "**/db/changelog/**", "**/repository/**", "**/entity/**",
      "**/*Repository.java", "**/*Entity.java",
    ],
  },
  "java-spring-ai": {
    description: "Spring AI — LLM chat clients, RAG pipelines, vector stores, prompt templates, function calling, streaming, observability",
    globs: [
      "**/ai/**", "**/*AiConfig.java", "**/*ChatClient.java", "**/*AiClient.java",
      "**/*RagService.java", "**/*VectorStore.java",
    ],
  },
  "java-spring-security": {
    description: "Spring Security — authentication, authorization, OAuth2/OIDC/JWT, method security, CORS, CSRF, headers, hardening",
    globs: [
      "**/security/**", "**/*SecurityConfig.java", "**/*JwtService.java",
      "**/*JwtUtil.java", "**/*UserDetailsService.java",
    ],
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
  "loop-engineering": {
    description: "Loop Engineering — plan, implement, verify, reflect, and repeat with evidence-driven checkpoints",
    globs: [],
  },
  "project-conventions": {
    description: "Project conventions — Git flow, Conventional Commits, PR process, ADRs, naming, env config",
    globs: [],
  },
  "typescript-5": {
    description: "Advanced TypeScript — conditional types, generics, utility types, Zod runtime validation, exhaustiveness checking, type-safe patterns",
    globs: ["**/*.ts", "**/*.tsx", "**/*.d.ts", "**/tsconfig*.json"],
  },
  "ci-cd": {
    description: "CI/CD pipelines — GitHub Actions, GitLab CI, Jenkins for multi-stack Java, Python, and JavaScript/TypeScript projects",
    globs: [
      "**/.github/workflows/**", "**/.gitlab-ci.yml", "**/Jenkinsfile",
      "**/azure-pipelines*.yml", "**/*.github-actions.yml",
    ],
  },
  "test-coverage": {
    description: "Test coverage & quality metrics — interpret coverage reports, set meaningful thresholds, improve test quality",
    globs: ["**/coverage/**", "**/*.lcov*", "**/jacoco/**", "**/reports/**"],
  },
  "security-hardening": {
    description: "Security hardening — OWASP Top 10 mitigation, secure coding patterns, dependency scanning, Azure-ready configurations",
    globs: [
      "**/security/**", "**/SECURITY.md", "**/*Security*.java",
      "**/*Vulnerability*.java", "**/*secure*.py", "**/owasp/**",
    ],
  },
  devops: {
    description: "DevOps & infrastructure — Docker, Kubernetes, Terraform/Bicep Infrastructure as Code, Azure-native practices",
    globs: [
      "**/Dockerfile*", "**/docker-compose*.yml", "**/*.tf", "**/*.bicep",
      "**/k8s/**", "**/kubernetes/**", "**/Kubernetes/**",
    ],
  },
  graphql: {
    description: "GraphQL — schema-first design, Java/Spring and Python/Strawberry servers, React/Vue client integration",
    globs: ["**/*.graphql", "**/*.gql", "**/*GraphQL*.java", "**/graphql/**"],
  },
  "code-review": {
    description: "Pull request & code reviews — unified checklist covering correctness, security, performance, style, and testing for any language",
    globs: ["**/*_review*.md", "**/docs/code-review/**", "**/.github/PULL_REQUEST_TEMPLATE.md"],
  },
  documentation: {
    description: "Documentation & comments — concise READMEs, method comments, docstrings, and inline comments; code should be self-explanatory",
    globs: [],
  },
  "project-review": {
    description: "Whole-project review & audit — structure, architecture, conventions, dependencies, security, testing, documentation, and release readiness",
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
          description: "Skill to retrieve: java-spring, java-data, java-spring-ai, java-spring-security, python-backend, frontend, testing, loop-engineering, or project-conventions.",
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
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new TypeError("file_path must be a non-empty string");
  }
  const parts = filePath.split(/[\\/]/);
  const name = parts.pop();
  const folder = parts.join("/").toLowerCase();
  const lowerName = name.toLowerCase();

  const isTestFile =
    /\.(test|spec)\.(java|py|ts|tsx|js|jsx)$/.test(name) ||
    /Tests?\.java$/.test(name) ||
    /IT\.java$/.test(name) ||
    /^test_/.test(name) ||
    /_test\.py$/.test(name);

  if (isTestFile) return "testing";

  // Java sub-skills are routed first so dedicated skills load for security, AI, and data work
  if (/\.(java|kt)$/.test(lowerName)) {
    if (/\/security\/|\/auth\//.test(`/${folder}/`) ||
        /(securityconfig|filterchain|jwt|oauth2|oidc|passwordencoder|userdetailsservice)/.test(lowerName)) {
      return "java-spring-security";
    }
    if (/\/ai\/|\/rag\/|\/llm\//.test(`/${folder}/`) ||
        /(aiconfig|aiclient|aichat|aiservice|aiagent|chatclient|springai|vectorstore|embeddingmodel|ragservice)/.test(lowerName)) {
      return "java-spring-ai";
    }
    if (/\/db\/|\/migration\/|\/changelog\//.test(`/${folder}/`) ||
        /(flyway|liquibase|changelog|migration)/.test(lowerName)) {
      return "java-data";
    }
    return "java-spring";
  }

  if (/\.(sql|xml|yaml|yml)$/.test(lowerName) && /\/db\/(migration|changelog)\//.test(`/${folder}/`)) {
    return "java-data";
  }

  if (/^(pom\.xml|build\.gradle(\.kts)?)$/.test(lowerName)) return "java-spring";
  if (/\.py$/.test(lowerName) || /^(pyproject\.toml|requirements.*\.txt|setup\.py|pipfile)$/.test(lowerName)) return "python-backend";
  if (/\.(component|service|module|guard|pipe|directive|interceptor|resolver)\.ts$/.test(lowerName)) return "frontend";
  if (/\.(tsx|jsx|ts|js|vue|svelte)$/.test(lowerName) || /^package\.json$/.test(lowerName)) return "frontend";
  return "project-conventions";
}

function errorResponse(error_type, message, retryable = false) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error_type, message, retryable }) }],
  };
}

async function handleTool(name, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return errorResponse("INVALID_ARGUMENT", "Tool arguments must be an object");
  }

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
    if (typeof stack_name !== "string" || !stack_name) {
      return errorResponse("INVALID_ARGUMENT", "stack_name must be a non-empty string");
    }
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
    if (typeof file_path !== "string" || !file_path.trim()) {
      return errorResponse("INVALID_ARGUMENT", "file_path must be a non-empty string");
    }
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
  const { Server } = require("@modelcontextprotocol/server");
  const { StdioServerTransport } = require("@modelcontextprotocol/server/stdio");

  const server = new Server(
    { name: PACKAGE_NAME, version: getVersion() },
    {
      capabilities: { tools: {} },
      instructions: "Use list_available_skills first to discover what skills are available. Load loop-engineering for non-trivial iterative work. Use detect_stack to identify which stack skill applies to a specific file, then use get_skill to load full conventions before writing code.",
    },
  );

  server.setRequestHandler("tools/list", async () => ({ tools: TOOLS }));

  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args = {} } = request.params;
    return handleTool(name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${PACKAGE_NAME}] MCP server started (stdio)\n`);
}

module.exports = { runMcpServer, detectStack, handleTool, SKILL_META, SKILL_NAMES };
