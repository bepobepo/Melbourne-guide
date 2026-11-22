import { TTS_SETTINGS } from '../voice-tracks.js';

const ENDPOINT = 'https://api.inworld.ai/tts/v1/voice:stream';
const MAX_LINE_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/** Deliberately contains no provider response, request text, or credentials. */
export class InworldError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = 'InworldError';
    this.code = code;
    this.status = status;
  }
}

function decodeAudio(value) {
  if (typeof value !== 'string' || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new InworldError('invalid_audio_encoding');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function* parseAudio(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  let total = 0;
  let prefix = new Uint8Array();
  let identified = false;
  let completed = false;

  function parseLine(line) {
    if (!line.trim()) return null;
    if (line.length > MAX_LINE_BYTES) throw new InworldError('provider_response_too_large');
    let message;
    try { message = JSON.parse(line); }
    catch { throw new InworldError('invalid_provider_json'); }
    if (!message || message.error || !message.result ||
        typeof message.result !== 'object' || Array.isArray(message.result) || message.result.error) {
      throw new InworldError('provider_stream_error');
    }
    // A result may contain timing metadata only; at least one audio frame is required overall.
    if (message.result.audioContent === undefined || message.result.audioContent === '') return null;
    let bytes = decodeAudio(message.result.audioContent);
    total += bytes.byteLength;
    if (total > MAX_AUDIO_BYTES) throw new InworldError('provider_response_too_large');
    if (!identified) {
      const joined = new Uint8Array(prefix.length + bytes.length);
      joined.set(prefix);
      joined.set(bytes, prefix.length);
      prefix = joined;
      if (prefix.length < 3) return null;
      const mp3 = (prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33) ||
        (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0);
      if (!mp3) throw new InworldError('invalid_audio_format');
      identified = true;
      bytes = prefix;
      prefix = new Uint8Array();
    }
    return bytes;
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const bytes = parseLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (bytes) yield bytes;
      }
      if (pending.length > MAX_LINE_BYTES) throw new InworldError('provider_response_too_large');
      if (done) break;
    }
    // A final complete JSON record need not have a trailing newline. Partial JSON must fail.
    const finalBytes = parseLine(pending);
    if (finalBytes) yield finalBytes;
    if (!identified || total < 3) throw new InworldError('empty_audio');
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * Return MP3 bytes as they arrive. A successful HTTP response alone does not mean
 * synthesis completed: consumers must read to clean EOF before publishing/caching.
 * `fetch` is injectable for tests. Abort and timeout cover headers AND the body.
 */
export async function synthesize(track, apiKey, options = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) {
    throw new InworldError('voice_not_configured', 503);
  }
  if (!track || typeof track.text !== 'string' || !track.text.trim() || track.text.length > 20000 ||
      typeof track.voiceId !== 'string' || typeof track.language !== 'string') {
    throw new InworldError('invalid_track', 400);
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 120000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) {
    throw new InworldError('invalid_timeout', 400);
  }
  const controller = new AbortController();
  const signal = options.signal;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  };
  const safeError = error => error instanceof InworldError ? error :
    new InworldError(timedOut ? 'provider_timeout' : controller.signal.aborted ? 'synthesis_cancelled' : 'provider_unavailable');

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        text: track.text,
        voice_id: track.voiceId,
        model_id: TTS_SETTINGS.modelId,
        audio_config: {
          audio_encoding: TTS_SETTINGS.audioConfig.audioEncoding,
          speaking_rate: TTS_SETTINGS.audioConfig.speakingRate
        },
        delivery_mode: TTS_SETTINGS.deliveryMode,
        language: track.language
      }),
      signal: controller.signal,
      redirect: 'error'
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {});
      throw new InworldError(response.status === 429 ? 'provider_rate_limited' : 'provider_unavailable');
    }
    const iterator = parseAudio(response.body);
    return new ReadableStream({
      async pull(stream) {
        try {
          const { value, done } = await iterator.next();
          if (done) { cleanup(); stream.close(); }
          else stream.enqueue(value);
        } catch (error) {
          const failure = safeError(error);
          controller.abort();
          cleanup();
          stream.error(failure);
        }
      },
      async cancel() {
        controller.abort();
        cleanup();
        await iterator.return().catch(() => {});
      }
    });
  } catch (error) {
    const failure = safeError(error);
    controller.abort();
    cleanup();
    throw failure;
  }
}
