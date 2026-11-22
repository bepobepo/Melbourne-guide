// MP3 can start with ID3 metadata and end with an ID3v1 tag. Walk every
// MPEG Layer III frame so an interrupted final frame never enters the cache.
export function completeMp3(bytes) {
  const tag = (at, name) => [...name].every((c, i) => bytes[at + i] === c.charCodeAt(0));
  let offset = 0;
  let end = bytes.length;
  if (tag(0, 'ID3')) {
    if (end < 10 || bytes.subarray(6, 10).some(n => n > 127)) return false;
    const size = bytes.subarray(6, 10).reduce((n, part) => n * 128 + part, 0);
    offset = 10 + size + (bytes[3] === 4 && (bytes[5] & 16) ? 10 : 0);
  }
  if (end >= 128 && tag(end - 128, 'TAG')) end -= 128;

  const mpeg1Rates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
  const lowerRates = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  const samples = [44100,48000,32000];
  let frames = 0;
  while (offset + 4 <= end) {
    const header = bytes[offset + 1];
    if (bytes[offset] !== 255 || (header & 224) !== 224 || ((header >> 1) & 3) !== 1) return false;
    const version = (header >> 3) & 3;
    const flags = bytes[offset + 2];
    const kbps = (version === 3 ? mpeg1Rates : lowerRates)[flags >> 4];
    const hz = samples[(flags >> 2) & 3] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    if (version === 1 || !kbps || !hz) return false;
    offset += Math.floor((version === 3 ? 144000 : 72000) * kbps / hz) + ((flags >> 1) & 1);
    frames++;
  }
  return frames > 0 && offset === end;
}
