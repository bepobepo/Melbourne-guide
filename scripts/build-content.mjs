import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseGuide } from './guide-markdown.mjs';
import { renderInstall } from './render-install.mjs';
import { renderCredits } from './render-credits.mjs';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
async function write(name, value) {
  if (await read(name).catch(() => null) === value) return;
  const temp = new URL(name + '.' + process.pid + '.tmp', root);
  await writeFile(temp, value);
  await rename(temp, new URL(name, root));
}

const { sections, labels } = parseGuide(await read('GUIDE.md'));
function text(key, lang) {
  const value = labels[key]?.[lang];
  if (value === undefined) throw new Error('Missing guide text: ' + key + ' / ' + lang);
  return value;
}
const module = '// Generated from GUIDE.md. Edit that file, then run npm run content:build.\n'
  + 'export const sections = ' + JSON.stringify(sections, null, 2) + ';\n'
  + 'export const labels = ' + JSON.stringify(labels, null, 2) + ';\n'
  + 'export ' + text.toString() + '\n';
await write('guide-copy.js', module);
await write('install.html', renderInstall(text));

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const title = text('ui.document.title','en')
  .replace('%section%',text('ui.nav.explore','en')).replace('%brand%',text('ui.brand.name','en'));
const index = (await read('index.html'))
  .replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + escapeHtml(title) + '</title>')
  .replace(/<meta name="description" content="[^"]*">/, () =>
    '<meta name="description" content="' + escapeHtml(text('ui.document.description','en')) + '">')
  .replace(/(<a class="skip" href="#main">)[\s\S]*?(<\/a>)/, (_, open, close) =>
    open + escapeHtml(text('ui.nav.skip','en')) + close);
await write('index.html', index);
const manifest = JSON.parse(await read('manifest.webmanifest'));
const metadata = {
  name: text('ui.brand.name','en'),
  short_name: text('ui.app.shortName','en'),
  description: text('ui.app.description','en')
};
if (Object.keys(metadata).some(key => metadata[key] !== manifest[key])) {
  await write('manifest.webmanifest', JSON.stringify({ ...manifest, ...metadata },null,2) + '\n');
}

await write('photo-credits.html', renderCredits(text, sections, JSON.parse(await read('assets/photos.json'))));
