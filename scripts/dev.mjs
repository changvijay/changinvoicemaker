// Runs the API server and the Vite dev server together; Ctrl+C stops both.
import { spawn } from "child_process";

const API_PORT = process.env.API_PORT || "4000";

const run = (name, args, env = {}) => {
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, API_PORT, ...env } });
  const prefix = (chunk) => chunk.toString().replace(/^(?=.)/gm, `[${name}] `);
  child.stdout.on("data", (c) => process.stdout.write(prefix(c)));
  child.stderr.on("data", (c) => process.stderr.write(prefix(c)));
  child.on("exit", (code) => {
    console.log(`[${name}] exited (${code})`);
    shutdown(code ?? 0);
  });
  return child;
};

const children = [
  run("api", ["--watch", "server/invoiceServer.mjs"], { PORT: API_PORT }),
  run("web", ["node_modules/vite/bin/vite.js"]),
];

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => c.kill());
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
