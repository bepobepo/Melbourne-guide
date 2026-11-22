import { assetPath, getTrack } from '../voice-tracks.js';
import { completeMp3 } from '../mp3.js';
import { InworldError, synthesize } from './inworld.js';

const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const STORAGE_CHUNK_BYTES = 64 * 1024;
const MAX_LISTENERS = 32;

function jsonError(code, status, headers = {}) {
  return Response.json({ error: code }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function requestTrack(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/audio') return null;
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 2 || keys.filter(key => key === 'id').length !== 1 ||
      keys.filter(key => key === 'lang').length !== 1) return null;
  return getTrack(url.searchParams.get('id'), url.searchParams.get('lang'));
}

function originAllowed(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://bepobepo.github.io').split(',').map(value => value.trim());
  return allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function audioResponse(stream, track, length) {
  const headers = {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    ETag: `"${track.revision}"`
  };
  if (length !== undefined) headers['Content-Length'] = String(length);
  return new Response(stream, { headers });
}

/** Public API accepts only known, versioned narration IDs; never arbitrary text. */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && !originAllowed(origin, env)) return jsonError('origin_not_allowed', 403);
    const cors = origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Length, ETag, Retry-After',
      Vary: 'Origin'
    } : {};
    if (!['GET', 'OPTIONS'].includes(request.method)) return jsonError('method_not_allowed', 405, { ...cors, Allow: 'GET, OPTIONS' });
    if (!requestTrack(request)) return jsonError('unknown_track', 404, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.AUDIO_TRACKS) return jsonError('voice_not_configured', 503, cors);
    try {
      const track = requestTrack(request);
      // Name incorporates the text, voice and model revision, not user-provided text.
      const id = env.AUDIO_TRACKS.idFromName(assetPath(track));
      const response = await env.AUDIO_TRACKS.get(id).fetch(request);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return jsonError('voice_unavailable', 503, cors);
    }
  }
};

/**
 * One globally unique Durable Object per narration revision. Its SQLite-backed
 * storage retains audio and the attempt budget across requests and restarts.
 * Generation continues after a listener disconnects, so a retry reuses that work.
 */
export class AudioTrack {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.generation = null;
    this.ready = state.blockConcurrencyWhile(async () => {
      this.meta = await state.storage.get('complete');
      this.budget = await state.storage.get('budget') || { attempts: [], retryAt: 0 };
    });
  }

  async fetch(request) {
    if (request.method !== 'GET') return jsonError('method_not_allowed', 405);
    const track = requestTrack(request);
    if (!track) return jsonError('unknown_track', 404);
    await this.ready;
    // The Worker fixes the object identity. Also refuse accidental internal reuse.
    const key = assetPath(track);
    if (this.trackKey && this.trackKey !== key) return jsonError('unknown_track', 404);
    this.trackKey = key;
    if (this.meta) {
      if (this.meta.key !== key) return jsonError('stored_track_mismatch', 503);
      return audioResponse(this.cachedStream(), track, this.meta.length);
    }
    if (!this.generation) {
      if (typeof this.env.INWORLD_API_KEY !== 'string' || !this.env.INWORLD_API_KEY.trim()) {
        return jsonError('voice_not_configured', 503);
      }
      this.budget.attempts = this.budget.attempts.filter(time => time > Date.now() - ATTEMPT_WINDOW_MS);
      if (this.budget.attempts.length >= MAX_ATTEMPTS) {
        return jsonError('generation_attempt_limit', 503, {
          'Retry-After': String(Math.max(1, Math.ceil((this.budget.attempts[0] + ATTEMPT_WINDOW_MS - Date.now()) / 1000)))
        });
      }
      if (Date.now() < this.budget.retryAt) {
        return jsonError('generation_cooldown', 503, { 'Retry-After': String(Math.ceil((this.budget.retryAt - Date.now()) / 1000)) });
      }
      this.beginGeneration(track);
    }
    const generation = this.generation;
    if (generation.listeners.size >= MAX_LISTENERS) return jsonError('too_many_listeners', 429, { 'Retry-After': '10' });
    try {
      await generation.started;
      if (generation.listeners.size >= MAX_LISTENERS) return jsonError('too_many_listeners', 429, { 'Retry-After': '10' });
      return audioResponse(this.listen(generation), track);
    } catch (error) {
      return jsonError(error instanceof InworldError ? error.code : 'voice_unavailable', error.status || 502);
    }
  }

  cachedStream() {
    let index = 0;
    const { storage } = this.state;
    const count = this.meta.chunks;
    return new ReadableStream({
      async pull(controller) {
        if (index === count) { controller.close(); return; }
        try {
          const bytes = await storage.get(`audio:${index++}`);
          if (!(bytes instanceof Uint8Array)) throw new Error('missing_audio_chunk');
          controller.enqueue(bytes);
        } catch {
          controller.error(new InworldError('stored_audio_unavailable', 503));
        }
      }
    });
  }

  listen(generation) {
    let listener;
    return new ReadableStream({
      start(controller) {
        listener = controller;
        for (const bytes of generation.chunks) controller.enqueue(bytes);
        if (generation.error) controller.error(generation.error);
        else if (generation.done) controller.close();
        else generation.listeners.add(controller);
      },
      cancel() { generation.listeners.delete(listener); }
    });
  }

  beginGeneration(track) {
    let start;
    let failStart;
    const generation = {
      chunks: [], listeners: new Set(), done: false, error: null,
      started: new Promise((resolve, reject) => { start = resolve; failStart = reject; })
    };
    // Install the shared promise before the first await so simultaneous requests
    // cannot both reserve an attempt or open a paid upstream request.
    this.generation = generation;
    const task = (async () => {
      try {
        this.budget = { attempts: [...this.budget.attempts, Date.now()], retryAt: Date.now() + RETRY_DELAY_MS };
        await this.state.storage.put('budget', this.budget);
        const stream = await synthesize(track, this.env.INWORLD_API_KEY);
        const reader = stream.getReader();
        let length = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            generation.chunks.push(value);
            start();
            for (const controller of generation.listeners) controller.enqueue(value);
          }
        } finally { reader.releaseLock(); }
        // Publish completion last. A partial stream or failed write never creates
        // a cache hit, even if the object is evicted during generation.
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of generation.chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        if (!completeMp3(bytes)) throw new InworldError('incomplete_audio');
        let index = 0;
        for (offset = 0; offset < bytes.length; offset += STORAGE_CHUNK_BYTES) {
          await this.state.storage.put(`audio:${index++}`, bytes.slice(offset, offset + STORAGE_CHUNK_BYTES));
        }
        const meta = { key: assetPath(track), chunks: index, length };
        await this.state.storage.put('complete', meta);
        this.meta = meta;
        generation.done = true;
        for (const controller of generation.listeners) controller.close();
      } catch (error) {
        const safeError = error instanceof InworldError ? error : new InworldError('voice_unavailable', 503);
        generation.error = safeError;
        failStart(safeError);
        for (const controller of generation.listeners) controller.error(safeError);
      } finally {
        generation.listeners.clear();
        this.generation = null;
      }
    })();
    // Retains the paid work and validated cache write when the browser cancels.
    this.state.waitUntil(task);
  }
}
