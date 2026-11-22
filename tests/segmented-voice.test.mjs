import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { synthesize } from '../backend/inworld.js';
import { completeMp3, joinMp3 } from '../mp3.js';
import { generateAudio } from '../scripts/generate-audio.mjs';
import { getTrack } from '../voice-tracks.js';

function frame() {
  const bytes = Buffer.alloc(417); // 128 kb/s at 44.1 kHz, MPEG-1 stereo
  bytes.set([0xff, 0xfb, 0x90, 0x64]);
  return bytes;
}

function recording(marker) {
  const id3 = Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]);
  const localIndex = frame();
  localIndex.write('Info', 36); // A track-local index that must not survive joining.
  const speech = frame();
  speech[speech.length - 1] = marker;
  return Buffer.concat([id3, localIndex, speech]);
}

function packet(bytes) {
  return new Response(JSON.stringify({ result: { audioContent: bytes.toString('base64') } }) + '\n');
}

for (const lang of ['en', 'ru']) {
  test('long ' + lang + ' guide retains every sentence and MP3 frame in one indexed recording', async () => {
    const sentence = lang === 'en' ? 'Walk together through the gardens. ' : 'Мы вместе гуляем по саду. ';
    const text = [1, 2, 3].map(n => (n + '. ' + sentence.repeat(50)).trim()).join('\n\n');
    const track = { ...getTrack('history', lang), text };
    const requests = [];
    const stream = await synthesize(track, 'test', {
      fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push(body.text);
        assert.equal(body.voice_id, lang === 'ru' ? 'Polina' : 'Jarrah');
        assert.equal(body.language, lang === 'ru' ? 'ru-RU' : 'en-AU');
        assert.equal(body.model_id, 'inworld-tts-2');
        assert.equal(body.delivery_mode, 'CREATIVE');
        assert.deepEqual(body.audio_config, { audio_encoding: 'MP3', speaking_rate: 1 });
        assert.ok(body.text.length <= 2000 && body.text.endsWith('.'));
        return packet(recording(requests.length));
      },
    });
    assert.equal(requests.length, 3);
    assert.equal(requests.join('\n\n'), text);
    const result = Buffer.from(await new Response(stream).arrayBuffer());
    assert.ok(completeMp3(result));
    const index = result.indexOf('Xing');
    assert.equal(result.indexOf('ID3'), -1);
    assert.equal(result.indexOf('Info'), -1);
    assert.equal(result.readUInt32BE(index + 8), 3); // duration in audio frames
    assert.equal(result.readUInt32BE(index + 12), result.length);
    for (let i = 0; i < 3; i++) assert.equal(result[result.length - 1 - (2 - i) * 417], i + 1);
  });
}

test('a truncated second segment stops synthesis and leaves no file for the Pages or phone cache', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'test-segmented-voice-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const track = { ...getTrack('transport', 'ru'), text: Array(3).fill('маршрут '.repeat(180).trim()).join('\n\n') };
  let calls = 0;
  await assert.rejects(generateAudio({
    directory, apiKey: 'test', tracks: [track],
    render: (track, key) => synthesize(track, key, {
      fetch: async () => packet(++calls === 2 ? recording(calls).subarray(0, -1) : recording(calls)),
    }),
  }), /Recording failed/);
  assert.equal(calls, 2);
  assert.deepEqual(await readdir(directory), []);
});

test('joining rejects changes in sample rate between independently encoded streams', () => {
  const changed = Buffer.alloc(384); // 128 kb/s at 48 kHz
  changed.set([0xff, 0xfb, 0x94, 0x64]);
  assert.throws(() => joinMp3([frame(), changed]), /incompatible_audio_segments/);
});
