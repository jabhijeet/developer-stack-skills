#!/usr/bin/env node

const { parseArgs, printHelp, runInstall } = require("../lib/installer");

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "install") {
    await runInstall(args);
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(`[developer-stack-skills] install failed: ${error.message}`);
  process.exitCode = 1;
});
