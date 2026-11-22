import { sections } from './guide-copy.js';

// Coordinates mark a public viewing point. All visitor-facing place text lives in GUIDE.md.
const mapStops = [
  {
    "id": "flinders",
    "number": 1,
    "category": "architecture",
    "lat": -37.81798,
    "lon": 144.96709,
    "image": "./assets/flinders.jpg"
  },
  {
    "id": "library",
    "number": 2,
    "category": "culture",
    "lat": -37.81026,
    "lon": 144.96452,
    "image": "./assets/library.jpg"
  },
  {
    "id": "block",
    "number": 3,
    "category": "architecture",
    "lat": -37.81579,
    "lon": 144.96418,
    "image": "./assets/block.jpg"
  },
  {
    "id": "federation",
    "number": 4,
    "category": "culture",
    "lat": -37.81789,
    "lon": 144.9691,
    "image": "./assets/federation.jpg"
  },
  {
    "id": "cathedral",
    "number": 5,
    "category": "architecture",
    "lat": -37.81704,
    "lon": 144.96754,
    "image": "./assets/cathedral.jpg"
  },
  {
    "id": "immigration",
    "number": 6,
    "category": "history",
    "lat": -37.8190118,
    "lon": 144.9603154,
    "image": "./assets/immigration.jpg"
  },
  {
    "id": "royal",
    "number": 7,
    "category": "history",
    "lat": -37.81467,
    "lon": 144.96431,
    "image": "./assets/royal.jpg"
  },
  {
    "id": "market",
    "number": 8,
    "category": "history",
    "lat": -37.80749,
    "lon": 144.95935,
    "image": "./assets/market.jpg"
  },
  {
    "id": "flagstaff",
    "number": 9,
    "category": "parks",
    "lat": -37.8104,
    "lon": 144.95485,
    "image": "./assets/flagstaff.jpg"
  },
  {
    "id": "carlton",
    "number": 10,
    "category": "parks",
    "lat": -37.8068,
    "lon": 144.97146,
    "image": "./assets/carlton.jpg"
  },
  {
    "id": "treasury",
    "number": 11,
    "category": "parks",
    "lat": -37.81365,
    "lon": 144.97665,
    "image": "./assets/treasury.jpg"
  },
  {
    "id": "fitzroy",
    "number": 12,
    "category": "parks",
    "lat": -37.81373,
    "lon": 144.98003,
    "image": "./assets/fitzroy.jpg"
  },
  {
    "id": "birrarung",
    "number": 13,
    "category": "parks",
    "lat": -37.81894,
    "lon": 144.97315,
    "image": "./assets/birrarung.jpg"
  },
  {
    "id": "alexandra",
    "number": 14,
    "category": "parks",
    "lat": -37.82142,
    "lon": 144.9711,
    "image": "./assets/alexandra.jpg"
  }
];

export const sites = mapStops.map(stop => {
  const entry = sections['site.' + stop.id];
  if (!entry) throw new Error('Missing guide entry for ' + stop.id);
  const site = { ...stop, ...entry.details };
  for (const field of ['name','summary','history','question','answer','alt']) {
    site[field] = { en: entry.en[field], ru: entry.ru[field] };
  }
  if (entry.en.caption || entry.ru.caption) site.caption = {en:entry.en.caption, ru:entry.ru.caption};
  return site;
});
