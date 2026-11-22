// GUIDE.md uses standard Markdown headings, bold field names and a bilingual table.
const fields = {
  site: ['name', 'summary', 'history', 'question', 'answer', 'alt'],
  chapter: ['period', 'title', 'story'],
  transport: ['title', 'story'],
};

export function parseGuide(markdown) {
  const sections = {};
  const labels = {};
  let section, lang, field, lines = [];
  function finish() {
    if (field) {
      const value = lines.join('\n').trim();
      if (!value) throw new Error(`Empty ${section} / ${lang} / ${field}`);
      sections[section][lang][field] = value;
    }
    field = null;
    lines = [];
  }
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (/^#{1,4} /.test(line)) {
      finish();
      if (!line.startsWith('#### ')) {
        section = null;
        lang = null;
        const match = /^### .* `((?:site|chapter|transport)\.[a-z0-9-]+)`$/.exec(line);
        if (match) {
          section = match[1];
          if (sections[section]) throw new Error('Duplicate section ' + section);
          sections[section] = {};
        }
      } else if (section) {
        lang = {'#### English':'en', '#### Русский':'ru', '#### Place details':'details'}[line];
        if (!lang || sections[section][lang]) throw new Error('Unexpected heading in ' + section + ': ' + line);
        sections[section][lang] = {};
      }
    } else if (section && lang && /^\*\*[^*]+\*\*$/.test(line)) {
      finish();
      field = line.slice(2,-2).toLowerCase();
      if (Object.hasOwn(sections[section][lang],field)) throw new Error(`Duplicate ${section} / ${field}`);
    } else if (field) {
      lines.push(line);
    } else if (line.startsWith('| `')) {
      const row = /^\| `([a-zA-Z][\w.-]+)` \| (.*?) \| (.*?) \|$/.exec(line);
      if (!row || labels[row[1]]) throw new Error('Invalid or duplicate translation row: ' + line);
      const [, key, en, ru] = row;
      if (!en.trim() || !ru.trim()) throw new Error('Missing translation for ' + key);
      const tokens = value => [...value.matchAll(/%\w+%/g)].map(x=>x[0]).sort().join(' ');
      if (tokens(en) !== tokens(ru)) throw new Error('Different placeholders in translations of ' + key);
      labels[key] = { en, ru };
    }
  }
  finish();
  for (const [id, entry] of Object.entries(sections)) {
    const kind = id.split('.')[0];
    for (const lang of ['en','ru']) {
      for (const key of fields[kind]) {
        if (!entry[lang]?.[key]) throw new Error(`Missing ${id} / ${lang} / ${key}`);
      }
    }
    if (kind === 'site' && (!entry.details?.address || !/^https:\/\//.test(entry.details?.source))) {
      throw new Error('Missing address or HTTPS source for ' + id);
    }
  }
  if (!Object.keys(labels).length || !Object.keys(sections).length) throw new Error('Missing guide sections or translations.');
  return { sections, labels };
}
