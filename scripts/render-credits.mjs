// Keep the page readable offline without running JavaScript.
export function renderCredits(text, sections, images) {
  const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const label = (key, lang) => escape(text('ui.credits.' + key, lang));

  function card(image) {
    const site = sections['site.' + image.id];
    if (!site) throw new Error('No matching guide entry for image ' + image.id);
    const names = ['en', 'ru'].map(lang => escape(site[lang].name));
    const title = image.source ? '<a href="' + escape(image.source) + '">' + names[0] + '</a>' : names[0];
    const details = [];
    if (image.type === 'illustration' || image.type === 'engraving') {
      const key = image.type === 'engraving' ? 'historicalArt' : 'fieldArt';
      const year = image.year ? ' (' + escape(image.year) + ')' : '';
      details.push('<p>' + label(key, 'en') + year + ' · <span lang="ru">' + label(key, 'ru') + year + '</span></p>');
    }
    if (image.author && image.license_url) {
      details.push('<p>' + escape(image.author) + ' · <a href="' + escape(image.license_url) + '">' + escape(image.license) + '</a></p>');
    }
    return '    <li><img src="./assets/' + escape(image.id) + '.jpg" loading="lazy" alt=""><div><h2>' + title + '</h2><p lang="ru">' + names[1] + '</p>' + details.join('') + '</div></li>';
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#203f34">
  <title>${label('title','en')} · ${escape(text('ui.brand.name','en'))}</title>
  <link rel="icon" href="./icons/apple-touch-icon.png">
  <style>
    @font-face {font-family:"DM Sans";src:url("./assets/fonts/dm-sans-latin-400-normal.woff2");font-display:swap}
    @font-face {font-family:"DM Serif Text";src:url("./assets/fonts/dm-serif-text-latin-400-normal.woff2");font-display:swap}
    * {box-sizing:border-box}
    body {margin:0;background:#f7f5ed;color:#203f34;font:1rem/1.5 "DM Sans",Arial,sans-serif}
    main {max-width:54rem;margin:auto;padding:clamp(20px,5vw,64px)}
    h1,h2 {font-family:"DM Serif Text",Georgia,serif;font-weight:400;line-height:1.15}
    h1 {font-size:clamp(2.2rem,5vw,3.5rem);margin:2rem 0 1rem}
    h1 small {font:normal 1.25rem/1.5 Georgia,serif;display:block;margin-top:.25rem}
    a {color:inherit;text-underline-offset:.2em}
    ul {padding:0;list-style:none;margin:2rem 0}
    li {display:flex;align-items:center;gap:1rem;border-top:1px solid #ccc9ba;padding:1rem 0}
    li img {width:clamp(5.5rem,18vw,10rem);height:clamp(4.5rem,12vw,6.8rem);object-fit:cover;border-radius:3px}
    p {margin:.25rem 0;font-size:.95rem}
    h2 {font-size:1.25rem;margin:0 0 .35rem}
    a:focus-visible {outline:3px solid #ad552c;outline-offset:3px}
  </style>
</head>
<body><main>
  <a href="./">← ${label('back','en')} · <span lang="ru">${label('back','ru')}</span></a>
  <h1>${label('title','en')}<small lang="ru">${label('title','ru')}</small></h1>
  <p>${label('note','en')}</p>
  <p lang="ru">${label('note','ru')}</p>
  <ul>
${images.map(card).join('\n')}
  </ul>
</main></body>
</html>
`;
}
