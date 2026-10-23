// Single source of truth for skill metadata. Consumed by the installer (agent rule files),
// the MCP server (detect_stack, list_available_skills), and the pre-write hook.
// Kept dependency-free so the hook can run from a copied install root.

const FALLBACK_SKILL = "project-conventions";
const JVM = "{java,kt}";

const SKILLS = [
  {
    name: "java-spring",
    description: "Java 25 & Spring Boot 4 / Spring 7 — JPA, REST APIs, JUnit 5, Mockito, Maven/Gradle",
    globs: [
      `**/*.${JVM}`, "**/pom.xml", "**/build.gradle", "**/build.gradle.kts", "**/settings.gradle*",
      "**/application*.properties", "**/application*.{yml,yaml}",
    ],
  },
  {
    name: "java-data",
    description: "Java data access — Flyway/Liquibase migrations, JPA/Hibernate, transactions, connection pooling, query optimization, caching",
    globs: [
      "**/db/migration/**", "**/db/changelog/**", `**/db/**/*.${JVM}`,
      "**/repository/**", "**/entity/**",
      `**/*Repository.${JVM}`, `**/*Entity.${JVM}`, `**/*{Flyway,Liquibase}*.${JVM}`,
    ],
  },
  {
    name: "java-spring-ai",
    description: "Spring AI — LLM chat clients, RAG pipelines, vector stores, prompt templates, function calling, streaming, observability",
    globs: [
      `**/ai/**/*.${JVM}`, `**/rag/**/*.${JVM}`, `**/llm/**/*.${JVM}`,
      `**/*{AiConfig,AiClient,AiChat,AiService,AiAgent,ChatClient,SpringAi,VectorStore,EmbeddingModel,RagService}*.${JVM}`,
    ],
  },
  {
    name: "java-spring-security",
    description: "Spring Security — authentication, authorization, OAuth2/OIDC/JWT, method security, CORS, CSRF, headers, hardening",
    globs: [
      `**/security/**/*.${JVM}`, `**/auth/**/*.${JVM}`,
      `**/*{SecurityConfig,FilterChain,Jwt,OAuth2,Oidc,PasswordEncoder,UserDetailsService}*.${JVM}`,
    ],
  },
  {
    name: "python-backend",
    description: "Python 3.14 backend — FastAPI, Django, SQLAlchemy 2.x, Pydantic v2, pytest",
    globs: ["**/*.py", "**/requirements*.txt", "**/pyproject.toml", "**/setup.py", "**/setup.cfg", "**/Pipfile"],
  },
  {
    name: "frontend",
    description: "Frontend — React 19+, Angular 21+, TypeScript, TanStack Query, Vitest, Playwright",
    globs: [
      "**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.ts",
      "**/*.{component,service,module,guard,pipe,directive,interceptor,resolver}.ts",
      "**/components/**", "**/pages/**",
    ],
  },
  {
    name: "testing",
    description: "Testing — JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers",
    globs: [
      "**/*.test.*", "**/*.spec.*", `**/*{Test,Tests,IT}.${JVM}`, "**/test_*.py", "**/*_test.py",
      "**/conftest.py", "**/test/**", "**/tests/**", "**/__tests__/**",
    ],
    // Test files are classified as testing before their source language
    priority: 100,
  },
  {
    name: "loop-engineering",
    description: "Loop Engineering — plan, implement, verify, reflect, and repeat with evidence-driven checkpoints",
    globs: [],
    alwaysApply: true,
  },
  {
    name: "project-conventions",
    description: "Project conventions — Git flow, Conventional Commits, PR process, ADRs, naming, env config",
    globs: [
      "**/CHANGELOG*", "**/CONTRIBUTING*", "**/.gitignore", "**/.gitattributes", "**/.editorconfig",
      "**/.env.example", "**/adr/**",
    ],
    alwaysApply: true,
  },
  {
    name: "typescript-5",
    description: "Advanced TypeScript — conditional types, generics, utility types, Zod runtime validation, exhaustiveness checking, type-safe patterns",
    globs: [
      "**/*.ts", "**/*.mts", "**/*.cts", "**/*.d.ts", "**/tsconfig*.json",
      "**/*.js", "**/*.mjs", "**/*.cjs",
    ],
  },
  {
    name: "ci-cd",
    description: "CI/CD pipelines — GitHub Actions, GitLab CI, Jenkins for multi-stack Java, Python, and JavaScript/TypeScript projects",
    globs: [
      "**/.github/workflows/**", "**/.gitlab-ci.yml", "**/Jenkinsfile", "**/azure-pipelines*.yml",
      "**/bitbucket-pipelines.yml", "**/.circleci/**",
    ],
  },
  {
    name: "test-coverage",
    description: "Test coverage & quality metrics — interpret coverage reports, set meaningful thresholds, improve test quality",
    globs: [
      "**/coverage/**", "**/lcov.info", "**/jacoco*.xml", "**/.coveragerc", "**/codecov.yml",
      "**/jest.config.*", "**/vitest.config.*",
    ],
  },
  {
    name: "security-hardening",
    description: "Security hardening — OWASP Top 10 mitigation, secure coding patterns, dependency scanning, Azure-ready configurations",
    globs: ["**/SECURITY.md", "**/.env", "**/.env.*", "**/*secure*.py", "**/owasp/**", `**/*Vulnerability*.${JVM}`],
  },
  {
    name: "devops",
    description: "DevOps & infrastructure — Docker, Kubernetes, Terraform/Bicep Infrastructure as Code, Azure-native practices",
    globs: [
      "**/Dockerfile*", "**/*.dockerfile", "**/docker-compose*.{yml,yaml}", "**/compose.{yml,yaml}",
      "**/*.tf", "**/*.tfvars", "**/*.bicep", "**/k8s/**", "**/kubernetes/**", "**/Kubernetes/**",
      "**/helm/**", "**/Chart.yaml",
    ],
  },
  {
    name: "graphql",
    description: "GraphQL — schema-first design, Java/Spring and Python/Strawberry servers, React/Vue client integration",
    globs: ["**/*.graphql", "**/*.graphqls", "**/*.gql", `**/*GraphQL*.${JVM}`, "**/graphql/**"],
  },
  {
    name: "code-review",
    description: "Pull request & code reviews — unified checklist covering correctness, security, performance, style, and testing for any language",
    globs: ["**/*_review*.md", "**/docs/code-review/**", "**/.github/PULL_REQUEST_TEMPLATE.md"],
  },
  {
    name: "documentation",
    description: "Documentation & comments — concise READMEs, method comments, docstrings, and inline comments; code should be self-explanatory",
    globs: ["**/README*", "**/docs/**/*.md"],
    alwaysApply: true,
  },
  {
    name: "project-review",
    description: "Whole-project review & audit — structure, architecture, conventions, dependencies, security, testing, documentation, and release readiness",
    globs: [],
    alwaysApply: true,
  },
];

const SKILL_NAMES = SKILLS.map((skill) => skill.name);
const SKILLS_BY_NAME = new Map(SKILLS.map((skill) => [skill.name, skill]));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Supports **, *, ?, and {a,b}; matching is case-sensitive so *Test.java skips Contest.java
function globToRegExp(glob) {
  let pattern = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:.*/)?";
        index += 2;
      } else {
        pattern += ".*";
        index += 1;
      }
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else if (char === "{") {
      const end = glob.indexOf("}", index);
      const alternatives = glob.slice(index + 1, end).split(",").map(escapeRegExp);
      pattern += `(?:${alternatives.join("|")})`;
      index = end;
    } else {
      pattern += escapeRegExp(char);
    }
  }
  return new RegExp(`^${pattern}$`);
}

// Literal characters a glob pins down; a longer literal means a more specific match
function globSpecificity(glob) {
  return glob
    .replace(/\{([^}]*)\}/g, (_, alternatives) =>
      alternatives.split(",").reduce((shortest, alt) => (alt.length < shortest.length ? alt : shortest)))
    .replace(/\*\*\/|\*|\?/g, "")
    .length;
}

const COMPILED = SKILLS.map((skill) => ({
  name: skill.name,
  priority: skill.priority || 0,
  matchers: skill.globs.map((glob) => ({ regex: globToRegExp(glob), specificity: globSpecificity(glob) })),
}));

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Ranks every skill whose globs match the path, best match first.
 * Ties keep registry order, so earlier skills win equal-specificity matches.
 */
function rankSkills(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new TypeError("file_path must be a non-empty string");
  }
  const normalized = normalizePath(filePath.trim());
  const ranked = [];
  for (const skill of COMPILED) {
    let best = -1;
    for (const { regex, specificity } of skill.matchers) {
      if (specificity > best && regex.test(normalized)) best = specificity;
    }
    if (best >= 0) ranked.push({ name: skill.name, score: best + skill.priority });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

function detectStack(filePath) {
  const [best] = rankSkills(filePath);
  return best ? best.name : FALLBACK_SKILL;
}

function getSkill(name) {
  return SKILLS_BY_NAME.get(name) || null;
}

module.exports = {
  FALLBACK_SKILL,
  SKILLS,
  SKILL_NAMES,
  detectStack,
  getSkill,
  globToRegExp,
  rankSkills,
};
