const paths = {
  tram:'<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M8 6 11 2h5l-2 4M4 14h16M12 7v7M7 22l2-2m8 2-2-2M8 17h1m6 0h1"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.7 5.3L8 16l2.7-5.3z"/>',
  book:'<path d="M12 6c-2.5-2-6.5-2.5-10-1.5v14c3.5-1 7.5-.5 10 1.5 2.5-2 6.5-2.5 10-1.5v-14c-3.5-1-7.5-.5-10 1.5Zm0 0v14"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zm6-2v15m6-12v15"/>',
  locate:'<path d="m21 3-6 18-3-9-9-3z"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',
  right:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  arrowup:'<path d="M6 18 18 6M7 6h11v11"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  walk:'<circle cx="14" cy="4.5" r="1.5"/><path d="m7 12 3-3 3-1 2 5 4 1m-7-4-2 6-4 5m5-7 4 3 2 4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  cross:'<path d="m6 6 12 12M18 6 6 18"/>',
  eye:'<path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  binoculars:'<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m2.5 14.2 3.7-10a2 2 0 0 1 3.8.8v11M21.5 14.2l-3.7-10a2 2 0 0 0-3.8.8v11m-4-5h4"/>',
  flag:'<path d="M5 21V3c5-3 8 4 14 0v10c-6 4-9-3-14 0"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  down:'<path d="m6 9 6 6 6-6"/>'
};
export const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
