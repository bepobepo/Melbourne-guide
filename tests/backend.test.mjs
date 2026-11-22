import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesize } from '../backend/inworld.js';
import worker, { AudioTrack } from '../backend/worker.js';
import { getTrack, assetPath, TTS_SETTINGS } from '../voice-tracks.js';

const encoder = new TextEncoder();
const track = getTrack('site/flinders', 'ru');
// One complete 128 kbit/s, 44.1 kHz MPEG-1 Layer III frame with an empty ID3 tag.
const audio = new Uint8Array(10 + 417);
audio.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64]);
const line = bytes => JSON.stringify({ result: { audioContent: Buffer.from(bytes).toString('base64') } });
const request = () => new Request('https://voice.example/audio?id=site%2Fflinders&lang=ru');

function responseFor(parts, options = {}) {
  let index = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (index < parts.length) controller.enqueue(encoder.encode(parts[index++]));
      else if (options.error) controller.error(new Error('provider socket closed with sensitive detail'));
      else controller.close();
    }
  }), { headers: { 'Content-Type': 'application/x-ndjson' } });
}

function fakeState(initial = {}) {
  const values = new Map(Object.entries(initial));
  const pending = [];
  return {
    values, pending,
    storage: {
      async get(key) { return structuredClone(values.get(key)); },
      async put(key, value) { values.set(key, structuredClone(value)); }
    },
    blockConcurrencyWhile(callback) { return callback(); },
    waitUntil(promise) { pending.push(promise); }
  };
}

test('streaming request maps fixed voice settings, uses raw Basic key, and handles split records', async () => {
  const whole = line(audio.subarray(0, 2)) + '\r\n' + line(audio.subarray(2)) + '\n';
  let call;
  const stream = await synthesize(track, 'synthetic-test-value', {
    fetch: async (url, options) => {
      call = { url, options };
      return responseFor([whole.slice(0, 13), whole.slice(13, 55), whole.slice(55)]);
    }
  });
  assert.deepEqual(new Uint8Array(await new Response(stream).arrayBuffer()), audio);
  assert.equal(call.url, 'https://api.inworld.ai/tts/v1/voice:stream');
  assert.equal(call.options.headers.Authorization, 'Basic synthetic-test-value');
  assert.equal(call.options.redirect, 'error');
  assert.deepEqual(JSON.parse(call.options.body), {
    text: track.text, voice_id: 'Polina', model_id: TTS_SETTINGS.modelId,
    audio_config: { audio_encoding: 'MP3', speaking_rate: 1 },
    delivery_mode: 'CREATIVE', language: 'ru-RU'
  });
});

test('a complete final NDJSON record without newline is accepted', async () => {
  const stream = await synthesize(track, 'test', { fetch: async () => responseFor([line(audio)]) });
  assert.deepEqual(new Uint8Array(await new Response(stream).arrayBuffer()), audio);
});

for (const [name, parts, expected] of [
  ['truncated final JSON', [line(audio) + '\n{"result":'], 'invalid_provider_json'],
  ['provider error after audio', [line(audio) + '\n{"error":{"message":"private detail"}}\n'], 'provider_stream_error'],
  ['invalid base64 after audio', [line(audio) + '\n{"result":{"audioContent":"%%%="}}\n'], 'invalid_audio_encoding'],
  ['non-MP3 response', [line(encoder.encode('not an mp3')) + '\n'], 'invalid_audio_format'],
  ['empty stream', ['\n'], 'empty_audio']
]) {
  test(`${name} errors the response and never reports clean completion`, async () => {
    const stream = await synthesize(track, 'test', { fetch: async () => responseFor(parts) });
    await assert.rejects(new Response(stream).arrayBuffer(), error => error.code === expected && !error.message.includes('private'));
  });
}

test('provider body disconnect errors after received audio', async () => {
  const stream = await synthesize(track, 'test', { fetch: async () => responseFor([line(audio) + '\n'], { error: true }) });
  await assert.rejects(new Response(stream).arrayBuffer(), { code: 'provider_unavailable' });
});

test('missing key fails before any provider call', async () => {
  let calls = 0;
  await assert.rejects(synthesize(track, undefined, { fetch: async () => { calls++; } }), { code: 'voice_not_configured', status: 503 });
  assert.equal(calls, 0);
});

test('upstream HTTP errors redact provider response and credentials', async () => {
  await assert.rejects(synthesize(track, 'test', { fetch: async () => new Response('private provider detail', { status: 401 }) }),
    error => error.code === 'provider_unavailable' && !error.message.includes('private'));
});

test('timeout aborts the upstream request', async () => {
  let aborted = false;
  await assert.rejects(synthesize(track, 'test', {
    timeoutMs: 10,
    fetch: async (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
    })
  }), { code: 'provider_timeout' });
  assert.equal(aborted, true);
});

test('Durable Object coalesces concurrent requests and reuses persistent audio after restart', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return responseFor([line(audio) + '\n']); };
  try {
    const state = fakeState();
    const object = new AudioTrack(state, { INWORLD_API_KEY: 'test' });
    const responses = await Promise.all([object.fetch(request()), object.fetch(request()), object.fetch(request())]);
    const data = await Promise.all(responses.map(response => response.arrayBuffer()));
    for (const bytes of data) assert.deepEqual(new Uint8Array(bytes), audio);
    await Promise.all(state.pending);
    assert.equal(calls, 1);
    assert.equal(state.values.get('budget').attempts.length, 1);
    assert.equal(state.values.get('complete').key, assetPath(track));
    const restarted = new AudioTrack(state, {}); // cached tracks don't require a live key
    const cached = await restarted.fetch(request());
    assert.equal(cached.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(cached.headers.get('Content-Length'), String(audio.length));
    assert.deepEqual(new Uint8Array(await cached.arrayBuffer()), audio);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

test('Durable Object continues caching if the first listener disconnects', async () => {
  const oldFetch = globalThis.fetch;
  let finish;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(line(audio) + '\n'));
      finish = () => controller.close();
    }
  }));
  try {
    const state = fakeState();
    const object = new AudioTrack(state, { INWORLD_API_KEY: 'test' });
    const response = await object.fetch(request());
    await response.body.cancel();
    finish();
    await Promise.all(state.pending);
    assert.equal(state.values.get('complete').length, audio.length);
  } finally { globalThis.fetch = oldFetch; }
});

test('failed generation never persists a completed cache and retries are bounded durably', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return responseFor([line(audio) + '\n{"error":{}}\n']); };
  try {
    const state = fakeState();
    const first = new AudioTrack(state, { INWORLD_API_KEY: 'test' });
    const response = await first.fetch(request());
    await assert.rejects(response.arrayBuffer());
    await Promise.all(state.pending);
    assert.equal(state.values.has('complete'), false);
    const restarted = new AudioTrack(state, { INWORLD_API_KEY: 'test' });
    const cooldown = await restarted.fetch(request());
    assert.equal(cooldown.status, 503);
    assert.equal((await cooldown.json()).error, 'generation_cooldown');
    assert.ok(Number(cooldown.headers.get('Retry-After')) > 0);
    assert.equal(calls, 1);
    state.values.set('budget', { attempts: [Date.now() - 1000, Date.now() - 500, Date.now()], retryAt: 0 });
    const exhausted = new AudioTrack(state, { INWORLD_API_KEY: 'test' });
    assert.equal((await (await exhausted.fetch(request())).json()).error, 'generation_attempt_limit');
    assert.equal(calls, 1);
    // The budget expires without DB deletion, allowing transient failures or a
    // corrected provider key to recover after the retry window.
    state.values.set('budget', { attempts: [Date.now() - 3600001], retryAt: 0 });
    globalThis.fetch = async () => { calls++; return responseFor([line(audio) + '\n']); };
    const recovered = new AudioTrack(state, { INWORLD_API_KEY: 'corrected-test-key' });
    assert.deepEqual(new Uint8Array(await (await recovered.fetch(request())).arrayBuffer()), audio);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = oldFetch; }
});

test('clean provider EOF with a truncated MP3 frame never becomes a completed cache', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => responseFor([line(audio.subarray(0, -1)) + '\n']);
  try {
    const state = fakeState();
    const response = await new AudioTrack(state, { INWORLD_API_KEY: 'test' }).fetch(request());
    await assert.rejects(response.arrayBuffer(), { code: 'incomplete_audio' });
    await Promise.all(state.pending);
    assert.equal(state.values.has('complete'), false);
  } finally { globalThis.fetch = oldFetch; }
});

test('missing deployment key returns 503 without consuming a generation attempt', async () => {
  const state = fakeState();
  const response = await new AudioTrack(state, {}).fetch(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'voice_not_configured');
  assert.equal(state.values.has('budget'), false);
});

test('public Worker allows only the finite track query and supported origins/methods', async () => {
  let forwards = 0;
  const env = { AUDIO_TRACKS: {
    idFromName(name) { assert.equal(name, assetPath(track)); return name; },
    get() { return { async fetch() { forwards++; return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } }); } }; }
  } };
  const good = new Request(request(), { headers: { Origin: 'https://bepobepo.github.io' } });
  const allowed = await worker.fetch(good, env);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://bepobepo.github.io');
  assert.equal(forwards, 1);
  for (const url of [
    'https://voice.example/audio?id=made-up&lang=ru',
    'https://voice.example/audio?id=site%2Fflinders&lang=unknown',
    'https://voice.example/audio?id=site%2Fflinders&lang=ru&text=arbitrary',
    'https://voice.example/audio?id=site%2Fflinders&id=history&lang=ru',
    'https://voice.example/unrelated?id=site%2Fflinders&lang=ru'
  ]) assert.equal((await worker.fetch(new Request(url), env)).status, 404);
  assert.equal((await worker.fetch(new Request(good, { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(new Request(good, { headers: { Origin: 'https://untrusted.example' } }), env)).status, 403);
  const local = await worker.fetch(new Request(good, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }), env);
  assert.equal(local.status, 204);
  assert.equal(local.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  assert.equal(forwards, 1);
});
