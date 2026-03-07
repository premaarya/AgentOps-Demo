#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("Running Dynamic Policy Engine Tests...\n");

const testProcess = spawn("node", [
  "--loader", "ts-node/esm",
  "--experimental-specifier-resolution=node",
  resolve(__dirname, "test/policyEngine.test.ts")
], {
  cwd: resolve(__dirname),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test"
  }
});

testProcess.on("close", (code) => {
  console.log(`\nTest process exited with code ${code}`);
  process.exit(code || 0);
});

testProcess.on("error", (error) => {
  console.error("Failed to start test process:", error);
  process.exit(1);
});