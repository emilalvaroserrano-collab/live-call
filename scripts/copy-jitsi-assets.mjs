import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "vendor/jitsi");

if (!existsSync(src)) {
  console.error("[orbit] vendor/jitsi is missing");
  process.exit(1);
}

const copied = [];

function copyInto(runtimeDir) {
  const dest = join(runtimeDir, "vendor/jitsi");
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  copied.push(dest);
}

const functionsRoot = join(root, ".vercel/output/functions");
if (existsSync(functionsRoot)) {
  for (const entry of readdirSync(functionsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith(".func")) {
      copyInto(join(functionsRoot, entry.name));
    }
  }
}

const nodeOutput = join(root, ".output/server");
if (existsSync(nodeOutput)) {
  copyInto(nodeOutput);
}

if (copied.length) {
  console.log(`[orbit] copied Jitsi vendor assets into ${copied.length} server runtime bundle(s)`);
} else {
  console.log("[orbit] no server runtime bundle detected; nothing to copy");
}
