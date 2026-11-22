import { cp, copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeInventory } from './prepare-offline.mjs';
import { allTracks, assetPath } from '../voice-tracks.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = resolve(process.argv[2]);
const recordings = resolve(process.argv[3]);
const worker = process.env.VOICE_WORKER_URL?.trim() || '';
if (worker) {
  const url = new URL(worker);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('VOICE_WORKER_URL must be a public HTTPS audio endpoint without credentials, query or fragment.');
  }
}

// Always assemble a fresh artifact. Server code, local environment files, cache receipts,
// repository metadata, tests and tooling live outside the public directories.
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length) throw new Error('The Pages staging directory must be empty.');
for (const entry of await readdir(root, { withFileTypes: true })) {
  const { name } = entry;
  if (entry.isDirectory() && ['assets', 'icons', 'fonts'].includes(name)) {
    await cp(join(root, name), join(destination, name), { recursive: true });
  } else if (!name.startsWith('.') && entry.isFile() && ['.html', '.css', '.js', '.webmanifest'].includes(extname(name))) {
    await copyFile(join(root, name), join(destination, name));
  }
}
await writeFile(join(destination, 'voice-config.js'), 'export const voiceEndpoint = ' + JSON.stringify(worker) + ';\n');
if (!worker) {
  await mkdir(join(destination, 'audio'));
  for (const track of allTracks()) {
    const path = assetPath(track).replace(/^\.\/audio\//, '');
    await copyFile(join(recordings, path), join(destination, 'audio', path));
  }
}
await writeFile(join(destination, 'precache.js'), await makeInventory(destination));
