/**
 * Build a tiny static index + podcast manifest for Cloudflare Workers assets deploy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PODCAST_DIR = path.join(ROOT, "podcast");
const AUDIO_RE = /\.(m4a|mp3|mp4)$/i;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full);
    else n += 1;
  }
  return n;
}

const podcastFiles = fs.existsSync(PODCAST_DIR)
  ? fs
      .readdirSync(PODCAST_DIR)
      .filter((name) => AUDIO_RE.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(PODCAST_DIR, name));
        return { name, size: stat.size, sizeLabel: formatBytes(stat.size) };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  : [];

const sections = [
  { id: "images", label: "Images", count: countFiles(path.join(ROOT, "images")) },
  { id: "podcast", label: "Podcast audio", count: podcastFiles.length },
  { id: "files", label: "Files", count: countFiles(path.join(ROOT, "files")) },
  { id: "map", label: "Map tiles / styles", count: countFiles(path.join(ROOT, "map")) },
  { id: "geojson", label: "GeoJSON", count: countFiles(path.join(ROOT, "geojson")) },
  { id: "icons", label: "Icons", count: countFiles(path.join(ROOT, "icons")) },
].filter((s) => s.count > 0);

const manifest = {
  title: "Solving-FCB assets",
  updatedAt: new Date().toISOString(),
  sections,
  podcast: {
    count: podcastFiles.length,
    files: podcastFiles.map(({ name, size }) => ({ name, size, path: `podcast/${name}` })),
  },
};

fs.writeFileSync(path.join(ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const sectionRows = sections
  .map((s) => `      <li><strong>${s.label}</strong> — ${s.count.toLocaleString()} files (<code>/${s.id}/</code>)</li>`)
  .join("\n");

const podcastRows = podcastFiles
  .map(
    (f) =>
      `      <li><a href="./podcast/${encodeURIComponent(f.name).replace(/%2F/gi, "/")}">${escapeHtml(f.name)}</a> <span>${f.sizeLabel}</span></li>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solving-FCB assets</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 2rem auto; max-width: 52rem; padding: 0 1rem; line-height: 1.45; }
    h1 { font-size: 1.35rem; font-weight: 650; margin: 0 0 0.35rem; }
    h2 { font-size: 1.05rem; margin: 1.75rem 0 0.5rem; }
    p { margin: 0 0 1rem; opacity: 0.85; }
    ul, ol { margin: 0; padding-left: 1.25rem; }
    li { margin: 0.35rem 0; word-break: break-all; }
    li span { opacity: 0.65; white-space: nowrap; margin-left: 0.4rem; font-variant-numeric: tabular-nums; }
    a { color: inherit; }
    code { font-size: 0.92em; }
    footer { margin-top: 2rem; font-size: 0.9rem; opacity: 0.7; }
  </style>
</head>
<body>
  <h1>Solving-FCB assets</h1>
  <p>
    Static media for the Solving-FCB website.
    Machine-readable summary: <a href="./manifest.json">manifest.json</a>.
  </p>
  <h2>Bundles</h2>
  <ul>
${sectionRows}
  </ul>
  <h2>Deep Dive podcast</h2>
  <p>${podcastFiles.length} episodes under <code>/podcast/</code></p>
  <ol>
${podcastRows}
  </ol>
  <footer>
    Set <code>ASSETS_BASE_URL</code> on the website to this origin (no trailing slash).
    Podcasts resolve at <code>{ASSETS_BASE_URL}/podcast/&lt;file&gt;</code>.
  </footer>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);
console.log(
  `Wrote index.html and manifest.json (${podcastFiles.length} podcast files, ${sections.reduce((n, s) => n + s.count, 0)} listed assets)`,
);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
