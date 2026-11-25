// Minimal static server for the exported site in out/, used by the E2E test and local preview.
// It mirrors GitHub Pages: /route/ serves /route/index.html and unknown paths serve 404.html.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd(), "out");
const port = Number(process.env.PORT ?? 3100);
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function resolveFile(urlPath) {
  let path = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length) || "/";
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  if (existsSync(index)) return index;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

createServer((request, response) => {
  const file = resolveFile(request.url ?? "/");
  const status = file ? 200 : 404;
  const served = file ?? join(root, "404.html");
  response.writeHead(status, { "Content-Type": TYPES[extname(served)] ?? "application/octet-stream" });
  createReadStream(served).pipe(response);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port}${basePath}/`);
});
