import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { completeMp3 } from '../mp3.js';
import { synthesize } from '../backend/inworld.js';
import { allTracks, assetPath } from '../voice-tracks.js';

async function inspectMp3(file) {
  const bytes = await readFile(file);
  if (!completeMp3(bytes)) return null;
  return createHash('sha256').update(bytes).digest('hex');
}

async function verifiedRecording(path) {
  try {
    const saved = await readFile(path + '.sha256', 'utf8');
    return saved.trim() === await inspectMp3(path);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// A receipt is written only after the complete provider stream passes validation.
export async function generateAudio({ directory, apiKey, tracks = allTracks(), render = synthesize }) {
  await mkdir(directory, { recursive: true });
  let generated = 0;
  for (const track of tracks) {
    const name = basename(assetPath(track));
    const target = join(directory, name);
    if (await verifiedRecording(target)) continue;
    if (!apiKey) throw new Error('Set the INWORLD_API_KEY Actions repository secret and run Voice guides again.');
    const part = target + '.' + randomUUID() + '.part';
    try {
      const audio = await render(track, apiKey);
      await pipeline(audio, createWriteStream(part, { flags: 'wx' }));
      const hash = await inspectMp3(part);
      if (!hash) throw new Error('Incomplete recording');
      await writeFile(part + '.sha256', hash + '\n', { flag: 'wx' });
      await rename(part, target);
      await rename(part + '.sha256', target + '.sha256');
      generated++;
      console.log('Recorded ' + name);
    } catch (error) {
      // Provider errors can include request information. Only expose a safe classification.
      const reason = error.name === 'InworldError' && /^[a-z_]+$/i.test(error.code) ? ' (' + error.code + ')' : '';
      throw new Error('Recording failed for ' + name + reason + '. Check the Inworld key, quota and service availability, then rerun.');
    } finally {
      await Promise.all([part, part + '.sha256'].map(file => rm(file, { force: true })));
    }
  }
  return { generated, reused: tracks.length - generated };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const directory = resolve(process.argv[2] || 'audio');
    const result = await generateAudio({ directory, apiKey: process.env.INWORLD_API_KEY });
    console.log('Recordings ready. Generated ' + result.generated + ', reused ' + result.reused + '.');
  } catch (error) {
    console.error((process.env.GITHUB_ACTIONS ? '::error::' : '') + error.message.replace(/[\r\n]/g, ' '));
    process.exitCode = 1;
  }
}
