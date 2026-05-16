#!/usr/bin/env node

// Matches package install commands across supported ecosystems
const INSTALL_PATTERN = /\b(?:pip3?\s+install|uv\s+(?:pip\s+install|add)|poetry\s+add|npm\s+(?:install|i)\b|yarn\s+add|pnpm\s+add|bun\s+add|npx\s+\S+@(?:latest|\d))/i;

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch {}

  const command = input.tool_input?.command || "";

  if (INSTALL_PATTERN.test(command)) {
    process.stdout.write(JSON.stringify({
      continue: true,
      systemMessage: "[developer-stack-skills] freshdeps: Verify this is the latest stable version before installing. Check for known vulnerabilities or deprecated releases.",
    }));
  }

  process.exit(0);
});
