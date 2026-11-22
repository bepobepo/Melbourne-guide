import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { makeInventory } from './scripts/prepare-offline.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
// Support the common dev-server form "npm run dev -- --host --port 5173".
const options = args.map((arg, index) =>
  arg === '--host' && (!args[index + 1] || args[index + 1].startsWith('-'))
    ? '--host=0.0.0.0' : arg);
const { values } = parseArgs({ args: options, options: {
  host: { type: 'string', default: '0.0.0.0' },
  port: { type: 'string', default: process.env.PORT || '5173' }
}});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const path = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || path.split('/').some(part => part.startsWith('.'))
        || !mime[extname(file)] || /^\/(scripts|node_modules|tests?)\//.test(path)
        || /^\/package(-lock)?\.json$/.test(path)) {
      response.writeHead(404).end();
      return;
    }
    // Recompute for dev requests. Static hosts use the checked-in inventory.
    let data = null;
    if (path === '/precache.js') {
      data = await makeInventory();
    } else {
      const resolved = await realpath(file);
      if (resolved.startsWith(root + sep) && (await stat(resolved)).isFile()) data = await readFile(resolved);
    }
    if (data === null) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)],
      'Content-Length': Buffer.byteLength(data),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (err) {
    response.writeHead(err.code === 'ENOENT' ? 404 : 400).end();
  }
});
server.listen(port, values.host, () => {
  console.log('Melbourne Field Guide listening on port ' + server.address().port);
});
