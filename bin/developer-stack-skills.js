#!/usr/bin/env node

const {
  parseArgs,
  printHelp,
  printVersion,
  runInstall,
  runUninstall,
} = require("../lib/installer");

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (["install", "configure"].includes(args.command)) {
    await runInstall(args);
    return;
  }

  if (args.command === "uninstall") {
    await runUninstall(args);
    return;
  }

  if (["version", "--version", "-v"].includes(args.command)) {
    printVersion();
    return;
  }

  if (["help", "--help", "-h"].includes(args.command)) {
    printHelp();
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(`[developer-stack-skills] command failed: ${error.message}`);
  process.exitCode = 1;
});
