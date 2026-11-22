// MPEG Layer III bitrate indexes (kb/s) and base sample rates (Hz).
const mpeg1Rates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
const lowerRates = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
const samples = [44100,48000,32000];

function hasTag(bytes, at, name) {
  return [...name].every((c, i) => bytes[at + i] === c.charCodeAt(0));
}

function frameAt(bytes, offset) {
  const header = bytes[offset + 1];
  if (bytes[offset] !== 255 || (header & 224) !== 224 || ((header >> 1) & 3) !== 1) return null;
  const version = (header >> 3) & 3;
  const flags = bytes[offset + 2];
  const kbps = (version === 3 ? mpeg1Rates : lowerRates)[flags >> 4];
  const hz = samples[(flags >> 2) & 3] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  if (version === 1 || !kbps || !hz) return null;
  const mono = (bytes[offset + 3] >> 6) === 3;
  const sideInfo = version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const length = Math.floor((version === 3 ? 144000 : 72000) * kbps / hz) + ((flags >> 1) & 1);
  return { length, version, hz, mono, sideInfo };
}

// Walk every frame so an interrupted final frame never enters the cache.
function scanFrames(bytes, visit) {
  let offset = 0;
  let end = bytes.length;
  if (hasTag(bytes, 0, 'ID3')) {
    if (end < 10 || bytes.subarray(6, 10).some(n => n > 127)) return false;
    const size = bytes.subarray(6, 10).reduce((n, part) => n * 128 + part, 0);
    offset = 10 + size + (bytes[3] === 4 && (bytes[5] & 16) ? 10 : 0);
  }
  if (end >= 128 && hasTag(bytes, end - 128, 'TAG')) end -= 128;

  let count = 0;
  while (offset + 4 <= end) {
    const frame = frameAt(bytes, offset);
    if (!frame || offset + frame.length > end) return false;
    visit?.(frame, offset, count);
    offset += frame.length;
    count++;
  }
  return count > 0 && offset === end;
}

export function completeMp3(bytes) {
  return scanFrames(bytes);
}

function isSeekFrame(bytes, offset, frame) {
  const start = offset + 4 + frame.sideInfo;
  const markers = [start];
  if (!(bytes[offset + 1] & 1)) markers.push(start + 2); // CRC-protected frame
  return markers.some(i => hasTag(bytes, i, 'Xing') || hasTag(bytes, i, 'Info')) ||
    hasTag(bytes, offset + 36, 'VBRI');
}

/**
 * Concatenate independently encoded MP3 recordings without a transcoder.
 * Keep all audio frames, discarding each part’s tags and track-local seek index.
 * A new Xing header gives native players the duration and byte offsets for
 * the complete story, including variable-bitrate recordings.
 */
export function joinMp3(parts) {
  const frames = [];
  let format;
  let size = 0;
  for (const bytes of parts) {
    const before = frames.length;
    const valid = scanFrames(bytes, (frame, offset, index) => {
      if (index === 0 && isSeekFrame(bytes, offset, frame)) return;
      if (format && (format.hz !== frame.hz || format.mono !== frame.mono || format.version !== frame.version)) {
        throw new Error('incompatible_audio_segments');
      }
      format ??= frame;
      frames.push(bytes.subarray(offset, offset + frame.length));
      size += frame.length;
    });
    if (!valid || frames.length === before) throw new Error('incomplete_audio_segment');
  }
  if (!format) throw new Error('empty_audio');
  const header = Uint8Array.from(frames[0].subarray(0, 4));
  header[1] |= 1; // no CRC on the new metadata frame
  header[2] = (12 << 4) | (header[2] & 12); // room for a 100-entry seek table
  const indexFrame = frameAt(header, 0);
  const result = new Uint8Array(indexFrame.length + size);
  result.set(header);
  const tagAt = 4 + indexFrame.sideInfo;
  result.set([88,105,110,103], tagAt); // Xing
  const fields = new DataView(result.buffer, tagAt + 4);
  fields.setUint32(0, 7); // frame count, byte count, seek table
  fields.setUint32(4, frames.length);
  fields.setUint32(8, result.length);
  let offset = indexFrame.length;
  let percentile = 1; // TOC[0] defaults to 0 (start of file).
  for (const [i, frame] of frames.entries()) {
    while (percentile < 100 && Math.floor(percentile * frames.length / 100) <= i) {
      fields.setUint8(12 + percentile, Math.min(255, Math.floor(offset * 256 / result.length)));
      percentile++;
    }
    result.set(frame, offset);
    offset += frame.length;
  }
  return result;
}
