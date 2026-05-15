#!/usr/bin/env node

const { runPostInstall } = require("../lib/installer");

runPostInstall().catch((error) => {
  console.error(`[developer-stack-skills] postinstall failed: ${error.message}`);
  process.exitCode = 1;
});
