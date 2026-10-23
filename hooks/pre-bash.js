#!/usr/bin/env node

// Package-manager commands that add a new dependency. A bare `npm install` or
// `pip install -r requirements.txt` only restores locked versions and is ignored.
const ADD_COMMANDS = [
  /^(?:python3?\s+-m\s+)?pip3?\s+install\b/,
  /^uv\s+pip\s+install\b/,
  /^uv\s+add\b/,
  /^poetry\s+add\b/,
  /^npm\s+(?:install|i|add)\b/,
  /^(?:yarn|pnpm|bun)\s+add\b/,
];
const FLAGS_WITH_VALUE = new Set(["-r", "--requirement", "-c", "--constraint", "-e", "--editable", "--registry", "--index-url", "-i"]);
const NPX_PINNED = /\bnpx\s+(?:-y\s+|--yes\s+)?\S+@(?:latest|\d)/;

function addsPackage(segment) {
  const trimmed = segment.trim();
  const manager = ADD_COMMANDS.map((pattern) => pattern.exec(trimmed)).find(Boolean);
  if (!manager) return false;

  const tokens = trimmed.slice(manager[0].length).trim().split(/\s+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (FLAGS_WITH_VALUE.has(token)) {
      index += 1;
      continue;
    }
    if (!token.startsWith("-")) return true;
  }
  return false;
}

function isDependencyAdd(command) {
  if (NPX_PINNED.test(command)) return true;
  return command.split(/&&|\|\||;|\|/).some(addsPackage);
}

if (require.main === module) {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    let input = {};
    try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch {}

    const command = input.tool_input?.command || "";

    if (isDependencyAdd(command)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: "[developer-stack-skills] freshdeps: this command adds a dependency. The version should be the latest stable release, free of known vulnerabilities and not deprecated.",
        },
      }));
    }

    process.exit(0);
  });
}

module.exports = { isDependencyAdd };
