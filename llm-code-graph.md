# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- lib/installer.js (4↑ 2↓) | d: Contains 43 symbols.
  - s: [buildMcpCommand [(packageInstallType)], buildRuleFileContent [(skillPath, config)], collectAnswers [(args, defaults = {})], collectProjectContext [(prompt)], configureAgents [(], configureClaudeCommands [(projectDir, packageRoot, dryRun = false)], configureClaudeHooks [(projectDir, hooksDir, dryRun = false)], configureClaudeRules [(projectDir, installRoot, dryRun = false)], configureCline [(projectDir, skillPaths, useMcp = false, dryRun = false)], configureCopilot [(projectDir, skillPaths, dryRun = false)], configureCursor [(projectDir, installRoot, dryRun = false)], configureCursorMcp [(projectDir, packageInstallType, dryRun = false)], configureInstructionFile [(projectDir, relativePath, skillPaths, dryRun = false)], configureMcp [(projectDir, packageInstallType, dryRun = false)], configureRoocode [(projectDir, skillPaths, useMcp = false, dryRun = false)], configureSharedMcp [(projectDir, packageInstallType, dryRun = false)], detectPlatform [(platform = process.platform)], getAgentTargets [(agent)], installHooks [({ packageRoot, installRoot, mode, platform, dryRun = false })], normalizeAgent [(agent)], normalizeMode [(mode)], parseArgs [(argv)], printHelp [()], removeMcpJsonEntry [(filePath, dryRun = false)], ... +19 more]
- lib/mcp-server.js (5↑ 1↓) | d: Contains 7 symbols.
  - s: [detectStack [(filePath)], errorResponse [(error_type, message, retryable = false)], getPackageRoot [()], getVersion [()], handleTool [(name, args)], readSkillFile [(skillName)], runMcpServer [()]]
- hooks/pre-bash.js (0↑ 0↓) | d: Matches package install commands across supported ecosystems
  - s: []
- hooks/pre-write.js (1↑ 0↓) | d: Contains 1 symbols.
  - s: [getReminder [(filePath)]]
- test/install.test.js (7↑ 0↓) | d: Contains 2 symbols.
  - s: [parseFrontmatter [Parse --- ... --- YAML frontmatter into an object], withTempDir [(fn)]]
- test/installer.test.js (4↑ 0↓) | d: 
  - s: []
- test/mcp-server.test.js (5↑ 0↓) | d: ── SKILL_META completeness ──────────────────────────────────
  - s: [parseError [── handleTool error shape ───────────────────────────────────]]

## EDGES
[hooks/pre-write.js] -> [path]
[lib/installer.js] -> [fs/promises, os, path, readline]
[lib/mcp-server.js] -> [@modelcontextprotocol/sdk/server/index.js, @modelcontextprotocol/sdk/server/stdio.js, @modelcontextprotocol/sdk/types.js, fs/promises, path]
[test/install.test.js] -> [lib/installer.js, child_process, fs/promises, node:assert/strict, node:test, os, path]
[test/installer.test.js] -> [lib/installer.js, node:assert/strict, node:path, node:test]
[test/mcp-server.test.js] -> [lib/mcp-server.js, fs/promises, node:assert/strict, node:test, path]