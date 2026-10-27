const { spawn } = require("node:child_process");
const fs = require("node:fs");

const file = process.argv[2];
const command = process.argv.slice(3);
if (!file || command.length === 0) {
  console.error("Usage: node scripts/with-env.cjs <env-file> <command> [args]");
  process.exit(1);
}

for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const index = line.indexOf("=");
  if (index < 1) continue;
  process.env[line.slice(0, index)] = line.slice(index + 1);
}

const child = spawn(command[0], command.slice(1), { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
