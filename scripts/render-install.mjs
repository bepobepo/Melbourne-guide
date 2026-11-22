// Render the standalone install page from the same bilingual copy as the app.
export function renderInstall(text) {
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const label = (key, lang) => escape(text('ui.' + key, lang));

  function step(key, lang) {
    // Only the named OS control gets emphasis; guide prose is always plain text.
    return label('install.' + key, lang).replace(/%([a-zA-Z]+)%/g, (_, control) =>
      '<strong>' + label('install.control.' + control, lang) + '</strong>');
  }

  function section(lang) {
    const title = lang === 'en' ? 'h1' : 'h2';
    const heading = lang === 'en' ? 'h2' : 'h3';
    return `    <section id="${lang}" lang="${lang}" aria-labelledby="${lang}-title">
      <${title} id="${lang}-title">${label('install.title', lang)}</${title}>
      <p>${label('install.note', lang)}</p>
      <a class="open" href="./">${label('install.open', lang)} →</a>
      <${heading} class="platform">${label('install.ios', lang)}</${heading}>
      <ol>
        ${['iosShare', 'iosHome', 'iosAdd'].map(key => '<li>' + step(key, lang) + '</li>').join('\n        ')}
      </ol>
      <${heading} class="platform">${label('install.android', lang)}</${heading}>
      <ol>
        ${['androidMenu', 'androidInstall'].map(key => '<li>' + step(key, lang) + '</li>').join('\n        ')}
      </ol>
    </section>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#203f34">
  <title>${label('install.documentTitle', 'en').replace('%brand%', () => label('brand.name', 'en'))}</title>
  <link rel="icon" href="./icons/apple-touch-icon.png">
  <style>
    @font-face { font-family: "DM Sans"; src: url("./assets/fonts/dm-sans-latin-400-normal.woff2"); font-display: swap }
    @font-face { font-family: "DM Serif Text"; src: url("./assets/fonts/dm-serif-text-latin-400-normal.woff2"); font-display: swap }
    * { box-sizing: border-box }
    body { margin: 0; background: #f7f5ed; color: #203f34; font: 1rem/1.55 "DM Sans", Arial, sans-serif }
    main { margin: auto; padding: 1.25rem clamp(1.1rem, 5vw, 3.4rem) 3rem; max-width: 46rem }
    header, nav, .brand { display: flex; align-items: center; gap: .75rem }
    header { flex-wrap: wrap; justify-content: space-between; border-bottom: 1px solid #c8c9b9; padding-bottom: 1rem }
    .brand { text-decoration: none; font: 1.3rem Georgia, serif }
    img { border-radius: .4rem }
    nav a { padding-block: .6rem }
    a { color: inherit; text-underline-offset: .2em }
    a:focus-visible { outline: 3px solid #ac552c; outline-offset: 3px }
    section { scroll-margin: 1rem; padding-block: 1.6rem }
    section + section { border-top: 1px solid #c8c9b9 }
    h1, h2, h3 { font-family: "DM Serif Text", Georgia, serif; line-height: 1.15; font-weight: 400 }
    h1, #ru-title { margin: 0 0 .5rem; font-size: clamp(2rem, 6.5vw, 3.2rem) }
    .platform { font-size: 1.45rem; margin: 1.5rem 0 .55rem }
    p { margin: 0 0 1rem }
    ol { margin: 0; padding-left: 1.6rem }
    li { padding-left: .2rem; margin-bottom: .4rem }
    .open { display: inline-block; background: #203f34; color: #fffdf4; border-radius: .35rem; padding: .65rem 1.15rem; text-decoration: none }
  </style>
</head>
<body>
  <main>
    <header>
      <a class="brand" href="./"><img src="./icons/icon-192.png" width="38" height="38" alt="">${label('brand.name', 'en')}</a>
      <nav aria-label="${label('language.label', 'en')}"><a href="#en">${label('language.english', 'en')}</a><a href="#ru" lang="ru">${label('language.russian', 'ru')}</a></nav>
    </header>
${section('en')}
${section('ru')}
  </main>
</body>
</html>
`;
}
