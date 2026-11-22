import { completeMp3 } from '../mp3.js';
import { allTracks, assetPath } from '../voice-tracks.js';

const site = new URL(process.env.PAGES_URL.replace(/\/?$/, '/'));
const workerOnly = process.argv.includes('--worker');
const worker = process.env.VOICE_WORKER_URL;
const stop = allTracks().filter(track => track.id === 'site/flinders');

async function assertHtml(path, title) {
  const response = await fetch(new URL(path, site), { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !(await response.text()).includes(title)) throw new Error('Pages did not serve the expected ' + path);
}

async function assertMp3(track) {
  const url = new URL(worker || assetPath(track), site);
  if (worker) {
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('VOICE_WORKER_URL must be the public HTTPS audio endpoint without credentials or query parameters.');
    }
    url.searchParams.set('id', track.id);
    url.searchParams.set('lang', track.lang);
  }
  const response = await fetch(url, {
    headers: worker ? { Origin: site.origin } : {},
    signal: AbortSignal.timeout(150000), redirect: 'error',
  });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/mpeg')) {
    throw new Error('Expected a playable ' + track.lang + ' MP3; the audio endpoint returned HTTP ' + response.status + '.');
  }
  if (worker && (response.headers.get('access-control-allow-origin') !== site.origin ||
      response.headers.get('etag') !== '"' + track.revision + '"')) {
    throw new Error('Deploy the current Worker and allow the Pages origin ' + site.origin + '.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!completeMp3(bytes)) {
    throw new Error('Invalid MP3 response for ' + track.lang + '.');
  }
}

if (!workerOnly) {
  await assertHtml('index.html', 'Melbourne Field Guide');
  await assertHtml('install.html', 'Install the guide');
}
if (workerOnly || !worker) {
  for (const track of stop) await assertMp3(track);
}
console.log(workerOnly ? 'Worker served current English and Russian recordings.' : 'Published guide and installation page verified.');
