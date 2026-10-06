/**
 * Parallel upload of this folder to R2 bucket `solvingfcb-assets`.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = process.env.R2_BUCKET || "solvingfcb-assets";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY || 8);
const SKIP = new Set([
  ".git",
  ".gitignore",
  ".assetsignore",
  "node_modules",
  ".wrangler",
  "scripts",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "wrangler.toml",
  "README.md",
  "cors.json",
  ".env",
  ".dev.vars",
]);

const EXT_CT = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".html": "text/html",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (dir === ROOT && SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(path.relative(ROOT, full).replaceAll("\\", "/"));
  }
  return out;
}

function contentType(rel) {
  return EXT_CT[path.extname(rel).toLowerCase()] || undefined;
}

const WRANGLER_JS = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

function put(rel) {
  return new Promise((resolve) => {
    const args = [
      WRANGLER_JS,
      "r2",
      "object",
      "put",
      `${BUCKET}/${rel}`,
      `--file=${path.join(ROOT, rel)}`,
      "--remote",
    ];
    const ct = contentType(rel);
    if (ct) args.push(`--content-type=${ct}`);
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => resolve({ rel, code: 1, err: String(e) }));
    child.on("close", (code) => resolve({ rel, code, err }));
  });
}

const files = walk(ROOT);
console.log(`Uploading ${files.length} files to r2://${BUCKET} (concurrency=${CONCURRENCY})`);

let i = 0;
let ok = 0;
let fail = 0;
const failed = [];

async function worker() {
  while (i < files.length) {
    const idx = i++;
    const rel = files[idx];
    const res = await put(rel);
    if (res.code === 0) ok += 1;
    else {
      fail += 1;
      failed.push(rel);
      console.error(`FAIL ${rel}\n${res.err.slice(0, 300)}`);
    }
    if ((ok + fail) % 20 === 0 || ok + fail === files.length) {
      console.log(`  ${ok + fail}/${files.length} (ok=${ok} fail=${fail})`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
console.log(`Done. uploaded=${ok} failed=${fail}`);
if (failed.length) {
  console.log("Failed keys:");
  for (const f of failed.slice(0, 30)) console.log(`  ${f}`);
  process.exit(1);
}
