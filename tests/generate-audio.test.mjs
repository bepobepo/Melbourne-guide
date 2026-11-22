import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { Readable } from 'node:stream';
import { generateAudio } from '../scripts/generate-audio.mjs';
import { allTracks, assetPath } from '../voice-tracks.js';

test('interrupted rendering retains completed tracks, and a rerun repairs corrupted cache entries', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'test-voice-generator-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const tracks = allTracks().slice(0, 2);
  const apiKey = 'test-credential';
  const file = track => join(directory, basename(assetPath(track)));
  const audio = Buffer.alloc(417); // One 128 kbps MPEG-1 Layer III frame at 44.1 kHz.
  audio.set([0xff, 0xfb, 0x90, 0x64]);
  const calls = [];
  let interrupt = true;
  const render = async (track, key) => {
    calls.push(track.lang);
    assert.equal(key, apiKey);
    return Readable.from((async function* () {
      yield audio;
      if (track.lang === 'ru' && interrupt) throw new Error(apiKey);
    })());
  };
  const generate = () => generateAudio({ directory, apiKey, tracks, render });
  await assert.rejects(generate(), error => error.message.includes('Recording failed') && !error.message.includes(apiKey));
  assert.deepEqual(await readFile(file(tracks[0])), audio);
  assert.equal((await readdir(directory)).length, 2);
  interrupt = false;
  assert.deepEqual(await generate(), { generated: 1, reused: 1 });
  assert.deepEqual(await generate(), { generated: 0, reused: 2 });
  await writeFile(file(tracks[1]), Buffer.concat([audio, audio]));
  assert.deepEqual(await generate(), { generated: 1, reused: 1 });
  assert.deepEqual(calls, ['en', 'ru', 'ru', 'ru']);
});

test('a non-MP3 provider response cannot be published', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'test-voice-generator-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  await assert.rejects(generateAudio({
    directory, tracks: allTracks().slice(0, 1), apiKey: 'test',
    render: () => Readable.from([Buffer.from('<html>Gateway error</html>')]),
  }), /Recording failed/);
  assert.deepEqual(await readdir(directory), []);
});
