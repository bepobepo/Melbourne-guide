import {text} from './guide-copy.js';
import { completeMp3 } from './mp3.js';
import { getTrack, assetPath } from './voice-tracks.js';
import { voiceEndpoint } from './voice-config.js';

const cacheName = 'melbourne-field-guide-audio-v1';
let disposeCurrent;

export function stopVoice() {
  disposeCurrent?.();
  disposeCurrent = undefined;
}

function abortIfStopped(signal) {
  if (signal.aborted) throw new DOMException('Playback stopped', 'AbortError');
}

async function validatedBlob(blob) {
  if (!completeMp3(new Uint8Array(await blob.arrayBuffer()))) throw new Error('Invalid MP3');
  return blob;
}

// Wait for one MediaSource operation. Remove listeners also on navigation,
// unsupported MSE implementations and synchronous appendBuffer failures.
function mediaStep(target, event, signal, start) {
  return new Promise((resolve, reject) => {
    const finish = failure => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stopped);
      target.removeEventListener(event, done);
      target.removeEventListener('error', failed);
      target.removeEventListener('abort', failed);
      if (failure) reject(failure); else resolve();
    };
    const done = () => finish();
    const failed = () => finish(new Error('Media buffer unavailable'));
    const stopped = () => finish(new DOMException('Playback stopped', 'AbortError'));
    const timer = setTimeout(failed, 4000);
    signal.addEventListener('abort', stopped, { once: true });
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', failed, { once: true });
    target.addEventListener('abort', failed, { once: true });
    try {
      abortIfStopped(signal);
      start();
    } catch (err) { finish(err); }
  });
}

function recordingURL(track) {
  if (!voiceEndpoint) return new URL(assetPath(track), import.meta.url);
  const url = new URL(voiceEndpoint, document.baseURI);
  url.searchParams.set('id', track.id);
  url.searchParams.set('lang', track.lang);
  return url;
}

async function download(track, signal, player) {
  const response = await fetch(recordingURL(track), { signal, credentials: 'omit', cache: 'no-store' });
  if (response.status !== 200) {
    const err = new Error('Recording request failed');
    if (response.status === 404 || response.status === 410) err.messageKey = 'missing';
    if (response.status === 503 && response.headers.get('content-type')?.includes('application/json')) {
      const reason = await response.json().catch(() => null);
      if (reason?.error === 'voice_not_configured') err.messageKey = 'unconfigured';
    }
    throw err;
  }
  // A cached app shell can briefly use an older catalogue than the Worker.
  const etag = response.headers.get('etag');
  if (voiceEndpoint && etag && etag !== '"' + track.revision + '"') {
    const err = new Error('Narration revisions differ');
    err.messageKey = 'changed';
    throw err;
  }
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type && !['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(type)) {
    throw new Error('Expected an MP3 response');
  }
  if (!response.body || !window.MediaSource?.isTypeSupported('audio/mpeg')) {
    return { blob: await validatedBlob(new Blob([await response.blob()], { type: 'audio/mpeg' })), streaming: false };
  }

  // Keep the bytes from the same request for offline use and for browsers
  // that advertise MSE but cannot append this particular recording.
  let source = new MediaSource();
  let buffer;
  try {
    await mediaStep(source, 'sourceopen', signal, () => player.setSource(source));
    buffer = source.addSourceBuffer('audio/mpeg');
  } catch {
    abortIfStopped(signal);
    source = null;
  }

  const chunks = [];
  const reader = response.body.getReader();
  let started = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    abortIfStopped(signal);
    chunks.push(value);
    if (source) {
      try {
        await mediaStep(buffer, 'updateend', signal, () => buffer.appendBuffer(value));
        if (!started && buffer.buffered.length) {
          started = true;
          player.start(true);
        }
      } catch {
        abortIfStopped(signal);
        source = null;
      }
    }
  }
  const blob = await validatedBlob(new Blob(chunks, { type: 'audio/mpeg' }));
  abortIfStopped(signal);
  if (source) {
    try { source.endOfStream(); } catch { source = null; }
  }
  return { blob, streaming: Boolean(source && started) };
}

export function mountVoice(container, { id, lang }) {
  stopVoice();
  const word = key => text('ui.voice.' + key, lang);
  const root = document.createElement('section');
  root.className = 'voice-player';
  root.setAttribute('aria-label', word('listen'));
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = word('listen');
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'auto';
  audio.hidden = true;
  audio.setAttribute('aria-label', word('listen'));
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(button, audio, status);
  container.replaceChildren(root);

  const track = getTrack(id, lang);
  let controller;
  let objectURL;
  let autoplayBlocked = false;
  const resetSource = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = undefined;
  };
  disposeCurrent = () => {
    controller?.abort();
    resetSource();
    root.remove();
  };
  if (!track) {
    button.hidden = true;
    status.textContent = word('missing');
    return;
  }

  const setSource = source => {
    resetSource();
    objectURL = URL.createObjectURL(source);
    audio.src = objectURL;
    audio.load();
  };
  async function play(signal, streaming = false) {
    abortIfStopped(signal);
    const moveFocus = document.activeElement === button;
    audio.hidden = false;
    button.hidden = true;
    if (moveFocus) audio.focus({ preventScroll: true });
    if (streaming) status.textContent = word('streaming');
    try { await audio.play(); }
    catch (err) {
      if (!signal.aborted && err.name === 'NotAllowedError') {
        autoplayBlocked = true;
        status.textContent = word('tap');
      }
    }
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    controller = new AbortController();
    const { signal } = controller;
    button.disabled = true;
    autoplayBlocked = false;
    status.textContent = word('loading');
    try {
      const cacheKey = new URL('./.voice-cache/' + encodeURIComponent(assetPath(track)), import.meta.url).href;
      let cache;
      let blob;
      try {
        cache = await window.caches?.open(cacheName);
        const saved = await cache?.match(cacheKey);
        if (saved) {
          try { blob = await validatedBlob(await saved.blob()); }
          catch { await cache.delete(cacheKey); }
        }
      } catch { /* Audio can still play when storage is unavailable. */ }
      abortIfStopped(signal);
      if (blob) {
        setSource(blob);
        status.textContent = word('saved');
        void play(signal);
        return;
      }
      const result = await download(track, signal, { setSource, start: streaming => void play(signal, streaming) });
      abortIfStopped(signal);
      if (!result.streaming) {
        setSource(result.blob);
        void play(signal);
      }
      let stored = false;
      if (cache) {
        try {
          await cache.put(cacheKey, new Response(result.blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
          stored = true;
        } catch { /* Saving is optional, playback remains available. */ }
      }
      if (!signal.aborted && !autoplayBlocked) status.textContent = stored ? word('saved') : word('ready');
    } catch (err) {
      if (signal.aborted) return;
      controller.abort();
      resetSource();
      audio.hidden = true;
      status.textContent = !navigator.onLine ? word('offline') : word(err.messageKey || 'error');
      button.textContent = word('retry');
      button.hidden = false;
      button.disabled = false;
    }
  });
}
