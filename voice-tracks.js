import { sites } from './sites.js';
import { guideNarration } from './guides.js';

const voices = {
  en: { voiceId: 'Jarrah', language: 'en-AU' },
  ru: { voiceId: 'Polina', language: 'ru-RU' },
};

export const TTS_SETTINGS = Object.freeze({
  modelId: 'inworld-tts-2',
  deliveryMode: 'CREATIVE',
  audioConfig: Object.freeze({ audioEncoding: 'MP3', speakingRate: 1 }),
});

// FNV-1a over UTF-8 gives the server and browser the same synchronous cache key.
function revisionFor(settings) {
  const bytes = new TextEncoder().encode(JSON.stringify(settings));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function getTrack(id, lang) {
  if (typeof id !== 'string' || !Object.hasOwn(voices, lang)) return null;
  let text;
  if (id.startsWith('site/')) {
    const site = sites.find(place => place.id === id.slice('site/'.length));
    if (!site) return null;
    text = [site.name[lang] + '.', site.history[lang], site.question[lang]].join('\n\n');
  } else {
    text = guideNarration(id, lang);
    if (!text) return null;
  }
  const { voiceId, language } = voices[lang];
  const revision = revisionFor([text, voiceId, language, TTS_SETTINGS]);
  return { id, lang, text, voiceId, language, revision };
}

export function allTracks() {
  const ids = [...sites.map(site => 'site/' + site.id), 'history', 'transport'];
  return ids.flatMap(id => Object.keys(voices).map(lang => getTrack(id, lang)));
}

export function assetPath(track) {
  return './audio/' + track.id.replaceAll('/', '-') + '-' + track.lang + '-' + track.revision + '.mp3';
}
