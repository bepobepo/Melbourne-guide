import { labels, sections, text } from './guide-copy.js';

const currencyCodes = ['USD', 'GBP', 'EUR', 'ILS'];
const html = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
function pageCopy(lang, format = value => value) {
  const copy = {};
  for (const [key, pair] of Object.entries(labels)) {
    if (/^guide\.\w+$/.test(key)) copy[key.slice(6)] = format(pair[lang]);
  }
  const records = prefix => Object.entries(sections)
    .filter(([id]) => id.startsWith(prefix + '.')).map(([, section]) => section[lang]);
  copy.chapters = records('chapter').map(s => [s.period, s.title, s.story].map(format));
  copy.sections = records('transport').map(s => [s.title, s.story].map(format));
  copy.currencies = currencyCodes.map(code => format(text('guide.currency.' + code, lang)));
  return copy;
}

// Shared by the guide pages and the audio track catalogue.
export function guideNarration(id, lang) {
  const c = pageCopy(lang);
  if (id === 'history') {
    const chapters = c.chapters.map(([, title, story]) => title + '. ' + story);
    return [c.historyTitle + '.', ...chapters].join('\n\n');
  }
  if (id === 'transport') {
    const sections = c.sections.map(([title, advice]) => title + '. ' + advice);
    return [c.transport + '.', ...sections].join('\n\n');
  }
  return null;
}

const bundledRates = {
  date: '2026-11-22',
  aud: { usd: 0.66208946, gbp: 0.5060331, eur: 0.60354761, ils: 2.20296221 },
};
const cacheKey = 'melbourne-field-guide:exchange-rates:v1';
let lastRates = bundledRates;

function sourceUrl(version) {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${version}/v1/currencies/aud.json`;
}

function validRates(record) {
  if (!record || typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false;
  const day = Date.parse(record.date + 'T00:00:00Z');
  return Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === record.date
    && day <= Date.now() + 86400000 && currencyCodes.every(code => {
      const rate = record.aud?.[code.toLowerCase()];
      return Number.isFinite(rate) && rate > 0;
    });
}

function savedRates() {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (validRates(cached) && cached.date >= lastRates.date) lastRates = cached;
  } catch { /* Storage may be unavailable in a private browsing session. */ }
  return lastRates;
}

function rateNote(date, lang, refreshed = false) {
  const c = pageCopy(lang);
  const day = new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-AU', {
    dateStyle: 'long', timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
  return c.rateNote.replace(/%(kind|date|fees)%/g, (_, key) => ({kind:refreshed ? c.latestRates : c.savedRates, date:day, fees:c.fees})[key]);
}

function formatCurrency(amount, code, lang) {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-AU', {
    style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
  }).format(amount);
}

function paragraphs(formatted) {
  return formatted.split(/\n\s*\n/).map(p => '<p>' + p + '</p>').join('');
}

function externalLink(url, label) {
  return `<a class="guide-link" href="${url}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`;
}

export function renderGuide(view, lang = 'en') {
  const c = pageCopy(lang, html);
  if (view === 'history') {
    return `<section class="guide-page" aria-labelledby="guide-heading">
      <header class="guide-heading"><h1 id="guide-heading">${c.historyTitle}</h1><p>${c.historyIntro}</p></header>
      <div class="history-layout"><div class="history-timeline">
      ${c.chapters.map(([year, title, text]) => `<article class="history-chapter"><span class="chapter-date">${year}</span><h2>${title}</h2>${paragraphs(text)}</article>`).join('')}
      ${externalLink('https://collections.museumsvictoria.com.au/', c.moreHistory)}
      </div><figure class="history-picture"><img src="./assets/flinders.jpg" alt="${c.historyPhoto}"><figcaption>${c.photoCaption}</figcaption></figure></div>
    </section>`;
  }
  const rates = savedRates();
  return `<section class="guide-page" aria-labelledby="guide-heading">
    <header class="guide-heading"><h1 id="guide-heading">${c.infoTitle}</h1><p>${c.infoIntro}</p></header>
    <div class="local-layout">
      <section class="guide-section transport-section"><h2>${c.transport}</h2>
        ${c.sections.map(([title, text]) => `<article><h3>${title}</h3>${paragraphs(text)}</article>`).join('')}
        ${externalLink('https://transport.vic.gov.au/journey', c.transportLink)}
        ${externalLink('https://transport.vic.gov.au/tickets-and-myki', c.ticketLink)}
      </section>
      <section class="guide-section currency-section" aria-labelledby="currency-heading">
        <h2 id="currency-heading">${c.converter}</h2>
        <label for="guide-amount">${c.label}</label>
        <div class="guide-input-wrap"><input type="text" id="guide-amount" inputmode="decimal" value="100" autocomplete="off" aria-describedby="guide-amount-error"><span>AUD</span></div>
        <p id="guide-amount-error" class="guide-field-error" hidden>${c.invalid}</p>
        <dl class="guide-rates" aria-live="polite" aria-atomic="true">
          ${currencyCodes.map((code, i) => `<div><dt><span class="guide-ccy">${code}</span><span>${c.currencies[i]}</span></dt><dd data-currency="${code}">${formatCurrency(rates.aud[code.toLowerCase()] * 100, code, lang)}</dd></div>`).join('')}
        </dl><p class="guide-rate-note">${html(rateNote(rates.date, lang))}</p>${externalLink(sourceUrl(rates.date.replaceAll('-', '.')), c.rateLink)}
      </section>
    </div></section>`;
}

export async function activateGuide(root, view, lang = 'en') {
  if (view !== 'info') return;
  const panel = root.querySelector('.currency-section');
  if (!panel) return;
  const amount = panel.querySelector('#guide-amount');
  const error = panel.querySelector('#guide-amount-error');
  const outputs = panel.querySelectorAll('[data-currency]');
  let rates = savedRates();
  function calculate() {
    const value = amount.value.trim().replace(',', '.');
    const number = Number(value);
    const valid = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && currencyCodes.every(code => Number.isFinite(number * rates.aud[code.toLowerCase()]));
    error.hidden = valid || !value.length;
    amount.setAttribute('aria-invalid', String(!error.hidden));
    outputs.forEach(output => {
      const code = output.dataset.currency;
      output.textContent = valid ? formatCurrency(number * rates.aud[code.toLowerCase()], code, lang) : '—';
    });
  }
  amount.addEventListener('input', calculate);
  if (navigator.onLine === false) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(sourceUrl('latest'), {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return;
    const fresh = await response.json();
    if (!validRates(fresh) || fresh.date < savedRates().date) return;
    // Keep just the four rates the guide uses.
    rates = {
      date: fresh.date,
      aud: Object.fromEntries(currencyCodes.map(code => [code.toLowerCase(), fresh.aud[code.toLowerCase()]])),
    };
    lastRates = rates;
    try { localStorage.setItem(cacheKey, JSON.stringify(rates)); } catch { /* In-memory fallback. */ }
    calculate();
    panel.querySelector('.guide-rate-note').textContent = rateNote(rates.date, lang, true);
    panel.querySelector('.guide-link').href = sourceUrl(rates.date.replaceAll('-', '.'));
  } catch { /* The saved reference rates are already visible. */ }
  finally { clearTimeout(timeout); }
}
