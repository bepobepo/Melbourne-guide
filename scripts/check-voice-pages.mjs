import { completeMp3 } from '../mp3.js';
import { allTracks, assetPath } from '../voice-tracks.js';

const site = new URL(process.env.PAGES_URL.replace(/\/?$/, '/'));
const workerOnly = process.argv.includes('--worker');
const worker = process.env.VOICE_WORKER_URL;
const stop = allTracks().filter(track => track.id === 'site/flinders');

async function assertHtml(path, title) {
  const url = new URL(path, site);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: 'no-cache' });
  if (!response.ok) throw new Error(`GET ${url.pathname} returned HTTP ${response.status}.`);
  if (!(await response.text()).includes(title)) throw new Error(`Unexpected page content at ${url.pathname}.`);
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
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!response.ok || !['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(type)) {
    throw new Error(`GET ${track.id} (${track.lang}) returned HTTP ${response.status} with type ${type || 'unspecified'}.`);
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

// A new Pages deployment can take a moment to reach every CDN edge.
async function verify(check) {
  const attempts = workerOnly ? 1 : 5;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await check();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`Pages check ${attempt} will retry: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

try {
  if (!workerOnly) {
    await verify(() => assertHtml('./', 'Melbourne Field Guide'));
    await verify(() => assertHtml('install.html', 'Install the guide'));
  }
  const tracks = workerOnly ? stop : worker ? [] : allTracks();
  for (const track of tracks) await verify(() => assertMp3(track));
  const result = workerOnly ? 'Worker served current English and Russian recordings.' :
    `Verified the public guide, installation page and ${tracks.length} static recordings.`;
  console.log(process.env.GITHUB_ACTIONS ? '::notice::' + result : result);
} catch (error) {
  const message = String(error.message).replace(/[\r\n]/g, ' ');
  console.error((process.env.GITHUB_ACTIONS ? '::error::' : '') + message);
  process.exitCode = 1;
}
