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
  const commands = [
    "install", "install-skills", "install-agent", "configure",
    "uninstall", "uninstall-skills", "uninstall-agent", "serve",
    "version", "--version", "-v", "help", "--help", "-h",
  ];

  if (!commands.includes(args.command)) {
    throw new Error(`Unknown command "${args.command}". Run "developer-stack-skills help" for usage.`);
  }

  if (["install", "install-skills", "install-agent", "configure"].includes(args.command)) {
    await runInstall(args);
    return;
  }

  if (["uninstall", "uninstall-skills", "uninstall-agent"].includes(args.command)) {
    await runUninstall(args);
    return;
  }

  if (args.command === "serve") {
    const { runMcpServer } = require("../lib/mcp-server");
    await runMcpServer();
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

}

main().catch((error) => {
  console.error(`[developer-stack-skills] command failed: ${error.message}`);
  process.exitCode = 1;
});
