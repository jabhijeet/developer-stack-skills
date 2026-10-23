const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");

const BIN = path.resolve(__dirname, "..", "bin", "developer-stack-skills.js");

// Minimal newline-delimited JSON-RPC client over the server's stdio
function startServer() {
  const child = spawn(process.execPath, [BIN, "serve"], { stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let buffer = "";
  let nextId = 1;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });

  return {
    request(method, params = {}) {
      const id = nextId++;
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    notify(method, params = {}) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    stop() {
      child.stdin.end();
      child.kill();
    },
  };
}

test("MCP server speaks stdio: tools, prompts, and resources", async () => {
  const server = startServer();
  try {
    const init = await server.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    assert.ok(init.result, JSON.stringify(init));
    assert.ok(init.result.capabilities.tools && init.result.capabilities.prompts && init.result.capabilities.resources);
    server.notify("notifications/initialized");

    const tools = await server.request("tools/list");
    assert.ok(tools.result.tools.some((tool) => tool.name === "get_skill_section"));

    const detect = await server.request("tools/call", { name: "detect_stack", arguments: { file_path: "Dockerfile" } });
    assert.equal(JSON.parse(detect.result.content[0].text).recommended_skill, "devops");

    const prompts = await server.request("prompts/list");
    assert.ok(prompts.result.prompts.some((prompt) => prompt.name === "review-pr"));

    const prompt = await server.request("prompts/get", { name: "write-tests", arguments: { arguments: "a.py" } });
    assert.match(prompt.result.messages[0].content.text, /Write tests for: a\.py/);

    const resources = await server.request("resources/list");
    assert.ok(resources.result.resources.some((resource) => resource.uri === "skill://devops"));

    const resource = await server.request("resources/read", { uri: "skill://devops" });
    assert.match(resource.result.contents[0].text, /name: devops/);
  } finally {
    server.stop();
  }
});
