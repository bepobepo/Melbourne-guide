import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseGuide } from '../scripts/guide-markdown.mjs';
import { sections, labels } from '../guide-copy.js';
import { sites } from '../sites.js';
import { getTrack } from '../voice-tracks.js';

const root = new URL('../', import.meta.url);
const guide = await readFile(new URL('GUIDE.md', root), 'utf8');

test('the published stops and bilingual narration use the reviewed Markdown', () => {
  const parsed = parseGuide(guide);
  assert.deepEqual(parsed, { sections, labels });

  const reviewedStops = Object.keys(sections).filter(key => key.startsWith('site.'));
  assert.deepEqual(sites.map(site => 'site.' + site.id).sort(), reviewedStops.sort());
  const parks = sites.filter(site => site.category === 'parks').map(site => site.id);
  for (const id of ['flagstaff', 'carlton', 'treasury', 'fitzroy', 'birrarung', 'alexandra']) {
    assert.ok(parks.includes(id), 'Missing park stop: ' + id);
  }

  for (const site of sites) {
    const entry = sections['site.' + site.id];
    assert.equal(site.address, entry.details.address);
    assert.equal(site.source, entry.details.source);
    assert.equal(new URL(site.source).protocol, 'https:');
    for (const lang of ['en', 'ru']) {
      for (const key of ['name', 'summary', 'alt', 'history', 'question', 'answer']) {
        assert.equal(site[key][lang], entry[lang][key], [site.id, lang, key].join(' / '));
      }
      const track = getTrack('site/' + site.id, lang);
      for (const field of ['name', 'history', 'question']) {
        assert.ok(track.text.includes(entry[lang][field]), 'Recording omits ' + field + ' for ' + site.id + '/' + lang);
      }
    }
  }
  for (const [id, chapter] of Object.entries(sections)) {
    if (id.startsWith('site.')) continue;
    const trackId = id.startsWith('chapter.') ? 'history' : 'transport';
    for (const lang of ['en', 'ru']) {
      assert.ok(getTrack(trackId, lang).text.includes(chapter[lang].story), 'Recording omits ' + id + '/' + lang);
    }
  }
});

test('a reviewed history edit reaches the site and revises only its edited narration', async t => {
  // Exercise the actual build in a temporary directory without changing the working guide.
  const dir = await mkdtemp(join(tmpdir(), 'melbourne-guide-edit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'assets'));
  for (const file of ['scripts/build-content.mjs', 'scripts/guide-markdown.mjs', 'scripts/render-install.mjs',
    'scripts/render-credits.mjs', 'assets/photos.json', 'package.json', 'index.html', 'manifest.webmanifest', 'sites.js', 'guides.js', 'voice-tracks.js']) {
    await copyFile(new URL(file, root), join(dir, file));
  }
  const history = sections['site.flinders'].en.history;
  const edited = history + '\n\nA visitor’s note: “Platform <A> & Platform B”.';
  await writeFile(join(dir, 'GUIDE.md'), guide.replace(history, () => edited));
  execFileSync(process.execPath, ['scripts/build-content.mjs'], { cwd: dir });
  const revisedSites = await import(pathToFileURL(join(dir, 'sites.js')));
  const revisedTracks = await import(pathToFileURL(join(dir, 'voice-tracks.js')));
  assert.equal(revisedSites.sites.find(s => s.id === 'flinders').history.en, edited);
  const revised = revisedTracks.getTrack('site/flinders', 'en');
  assert.ok(revised.text.includes(edited));
  assert.notEqual(revised.revision, getTrack('site/flinders', 'en').revision);
  assert.equal(revisedTracks.getTrack('site/flinders', 'ru').revision, getTrack('site/flinders', 'ru').revision);
});

test('an incomplete translation stops publication and identifies the field to fix', () => {
  const missingAlt = guide.replace('**Alt**\n\n' + sections['site.flinders'].ru.alt, '');
  assert.throws(() => parseGuide(missingAlt), /Missing site\.flinders \/ ru \/ alt/);
  const missingLabel = guide.replace(/^(\| `ui\.map\.title` \| .*? \|) .*? \|$/m, '$1  |');
  assert.throws(() => parseGuide(missingLabel), /Missing translation for ui\.map\.title/);
});
