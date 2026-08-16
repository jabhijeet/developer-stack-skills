const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

/**
 * Resolves the skill path for a given agent and installation mode.
 *
 * @param {string} agent - Agent name (e.g., 'claude', 'cline', 'cursor')
 * @param {string} mode - Installation mode ('copy' or 'symlink')
 * @param {Object} agentRoots - Agent roots mapping from agent-roots.json
 * @param {string} homeDir - Home directory (defaults to os.homedir())
 * @returns {string} Resolved skill path
 * @throws {Error} If agent not found or path resolution fails
 */
function resolveSkillPath(agent, mode, agentRoots, homeDir = os.homedir()) {
  if (!agentRoots || !agentRoots["agent-roots"]) {
    throw new Error("Invalid agent-roots configuration");
  }

  const agentConfig = agentRoots["agent-roots"][agent];
  if (!agentConfig) {
    throw new Error(`Agent "${agent}" not found in agent-roots mapping`);
  }

  if (!["copy", "symlink"].includes(mode)) {
    throw new Error(`Invalid mode "${mode}". Must be 'copy' or 'symlink'`);
  }

  // Resolve path segments, replacing ~ with home directory
  const segments = agentConfig.root.map((seg) => (seg === "~" ? homeDir : seg));
  const basePath = path.join(...segments);

  // For symlink mode, return the base path directly
  if (mode === "symlink") {
    return basePath;
  }

  // For copy mode, append .ai-skills subdirectory
  return path.join(basePath, ".ai-skills");
}

/**
 * Validates that resolved skill paths exist before using them.
 *
 * @param {string} resolvedPath - The resolved skill path to validate
 * @param {boolean} strict - If true, throws error if path doesn't exist. If false, only warns.
 * @returns {Promise<boolean>} True if path exists, false otherwise
 * @throws {Error} If strict mode is enabled and path doesn't exist
 */
async function validateSkillPath(resolvedPath, strict = false) {
  try {
    await fsp.access(resolvedPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      if (strict) {
        throw new Error(`Skill path does not exist: ${resolvedPath}`);
      }
      console.warn(`Warning: Skill path not found: ${resolvedPath}`);
      return false;
    }
    throw error;
  }
}

/**
 * Loads agent-roots.json from a given path.
 *
 * @param {string} filePath - Path to agent-roots.json
 * @returns {Promise<Object>} Parsed agent-roots configuration
 * @throws {Error} If file doesn't exist or contains invalid JSON
 */
async function loadAgentRoots(filePath) {
  try {
    const content = await fsp.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`agent-roots.json not found at: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in agent-roots.json: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Checks for version mismatches between required and installed skill versions.
 *
 * @param {string} skillPath - Path to installed skill SKILL.md file
 * @param {string} requiredVersion - Required version string
 * @returns {Promise<Object>} Mismatch result { hasMatch: boolean, installedVersion?: string, error?: string }
 */
async function checkVersionMismatch(skillPath, requiredVersion) {
  try {
    const content = await fsp.readFile(skillPath, "utf8");
    // Simple regex to extract version from SKILL.md
    const versionMatch = content.match(/version[:\s]*([0-9]+\.[0-9]+\.[0-9]+)/i);
    const installedVersion = versionMatch ? versionMatch[1] : "unknown";

    return {
      hasMatch: installedVersion === requiredVersion,
      installedVersion,
      requiredVersion,
    };
  } catch (error) {
    return {
      hasMatch: false,
      error: `Failed to check version: ${error.message}`,
    };
  }
}

/**
 * Validates all agent paths and logs warnings for missing paths.
 *
 * @param {Object} agentRoots - Agent roots mapping
 * @param {string} homeDir - Home directory
 * @returns {Promise<Object>} Validation result { valid: number, invalid: number, warnings: string[] }
 */
async function validateAllAgentPaths(agentRoots, homeDir = os.homedir()) {
  const result = {
    valid: 0,
    invalid: 0,
    warnings: [],
  };

  if (!agentRoots || !agentRoots["agent-roots"]) {
    result.warnings.push("Invalid agent-roots configuration");
    return result;
  }

  for (const [agent, config] of Object.entries(agentRoots["agent-roots"])) {
    const segments = config.root.map((seg) => (seg === "~" ? homeDir : seg));
    const basePath = path.join(...segments);

    try {
      await fsp.access(basePath);
      result.valid += 1;
    } catch {
      result.invalid += 1;
      result.warnings.push(`Missing path for "${agent}": ${basePath}`);
    }
  }

  return result;
}

module.exports = {
  checkVersionMismatch,
  loadAgentRoots,
  resolveSkillPath,
  validateAllAgentPaths,
  validateSkillPath,
};

