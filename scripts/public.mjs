import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  verb = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(verb))
  throw new Error("Choose dev, build or start.");
const args = [
  require.resolve("next/dist/bin/next"),
  verb,
  ...(verb === "build"
    ? []
    : [
        "--port",
        process.env.LOYALTY_PORT || "3001",
        "--hostname",
        "127.0.0.1",
      ]),
];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, APP_ROLE: "public" },
});
child.on("exit", (code) => process.exit(code || 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
