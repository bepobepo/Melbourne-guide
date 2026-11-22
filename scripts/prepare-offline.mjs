import { createHash } from 'node:crypto';
import { opendir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const supportFiles = new Set(['sw.js', 'precache.js', 'package.json', 'package-lock.json']);
const publicExtensions = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.ico', '.txt']);
const publicDirs = new Set(['assets', 'icons', 'fonts']);

async function listFiles(dir, root) {
  const files = [];
  for await (const entry of await opendir(dir)) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory() && (dir !== root || publicDirs.has(entry.name))) {
      files.push(...await listFiles(path, root));
    } else if (entry.isFile() && publicExtensions.has(extname(path))
        && !supportFiles.has(relative(root, path))) {
      files.push(relative(root, path));
    }
  }
  return files;
}

export async function makeInventory(root = defaultRoot) {
  const files = (await listFiles(root, root)).sort();
  const hash = createHash('sha256').update(await readFile(join(root, 'sw.js')));
  for (const file of files) {
    const digest = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
    hash.update(JSON.stringify([file, digest]));
  }
  return 'self.PRECACHE = ' + JSON.stringify({
    revision: hash.digest('hex').slice(0, 20),
    files: files.map(file => './' + file.split('/').map(encodeURIComponent).join('/'))
  }, null, 2) + ';\n';
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const js = await makeInventory();
  const target = join(defaultRoot, 'precache.js');
  const temp = target + '.' + process.pid;
  await writeFile(temp, js);
  await rename(temp, target);
  console.log('Updated precache.js for static hosting.');
}
