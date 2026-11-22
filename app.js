import {text} from './guide-copy.js';
import {sites} from './sites.js';
import {mountMap} from './map.js';
import {renderGuide, activateGuide} from './guides.js';
import {icon} from './icons.js';
import {mountVoice, stopVoice} from './voice-player.js';

const main = document.querySelector('#main');
const sheet = document.querySelector('#sheet');
const byId = id => sites.find(site => site.id === id);
let lang = 'en';
try { lang = localStorage.getItem('melbourne-language') === 'ru' ? 'ru' : 'en'; } catch {}
let view, selected = 'flinders', map, locationState = 'idle', userLocation = null, locateRequest = 0;
function u(key, values = {}) {
  return text('ui.' + key, lang).replace(/%([a-zA-Z]+)%/g, (token, name) => values[name] ?? token);
}

function html(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
}

const label = (key, values) => html(u(key, values));
function historyParagraphs(value) {
  return value.trim().split(/\n\s*\n/).map(p => `<p class="detail-history">${html(p)}</p>`).join('');
}
const category = c => u('category.' + c);
const reference = {lat:-37.81798,lon:144.96709};
const currentView = () => ['history','info'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'explore';
function distance(a,b) {
  const rad = Math.PI/180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 12742000*Math.asin(Math.min(1, Math.sqrt(h)));
}
function formatDistance(site) {
  const d=distance(userLocation||reference,site);
  const nf=new Intl.NumberFormat(lang,{maximumFractionDigits:1});
  return d < 1000 ? u('distance.metres',{distance:nf.format(Math.round(d/10)*10)}) : u('distance.kilometres',{distance:nf.format(d/1000)});
}
function ranked() { return userLocation ? [...sites].sort((a,b)=>distance(userLocation,a)-distance(userLocation,b)) : sites; }
function header() {
  const links=[['explore','compass',u('nav.explore')],['history','book',u('nav.history')],['info','info',u('nav.info')]];
  document.querySelector('#header').innerHTML=`<div class="bar wrap">
  <a class="brand" href="#explore" aria-label="${label('brand.name')}"><span class="brand-mark">${icon('tram',27)}</span><span class="wordmark">${label('brand.city')}<small>${label('brand.subtitle')}</small></span></a>
  <nav class="nav" aria-label="${label('nav.label')}">${links.map(([key,symbol,name])=>`<a href="#${key}" ${view===key?'aria-current="page"':''}>${icon(symbol)}<span>${html(name)}</span></a>`).join('')}</nav>
  <div class="language" role="group" aria-label="${label('language.label')}">${icon('globe',16)}${['en','ru'].map(l=>`<button data-lang="${l}" lang="${l}" aria-label="${label(l==='en'?'language.english':'language.russian')}" aria-pressed="${lang===l}">${label('language.'+l)}</button>`).join('')}</div></div>`;
  document.querySelector('.skip').textContent=u('nav.skip');
  document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{
    lang=b.dataset.lang; try{localStorage.setItem('melbourne-language',lang)}catch{}
    render();
    document.querySelector(`[data-lang="${lang}"]`).focus({preventScroll:true});
  });
  document.querySelector('#footer').innerHTML=`<div class="wrap footer-line"><span>${icon('tram',17)} ${label('brand.name')}</span><a href="./install.html${lang==='ru'?'#ru':''}">${label('footer.install')}</a><a href="./photo-credits.html">${label('footer.credits')}</a></div>`;
}
function card(site) {
  return `<button class="place-card" data-site="${html(site.id)}">
    <span class="card-photo"><img src="${html(site.image)}" alt=""><span class="photo-number">${String(site.number).padStart(2,'0')}</span></span>
    <span class="card-copy"><span class="place-category ${html(site.category)}"><i></i>${html(category(site.category))}</span><strong>${html(site.name[lang])}</strong><span class="card-description">${html(site.summary[lang])}</span><span class="card-distance">${icon('pin',14)}${userLocation ? label('distance.away',{distance:formatDistance(site)}) : html(site.address)}</span></span>
    <span class="card-arrow">${icon('chevron',16)}</span></button>`;
}
function nearby() {
  document.querySelector('#near-title').textContent=userLocation?u('nearby.title'):u('nearby.discover');
  document.querySelector('#near-cards').innerHTML=ranked().slice(0,3).map(card).join('');
}
function locationBar() {
  const bar=document.querySelector('#location-bar');
  if(!bar)return;
  const within=userLocation&&distance(reference,userLocation)<4000;
  const heading=userLocation?(within?u('location.using'):u('location.outside')):u('location.intro');
  const statusLabel=({idle:u('location.idle'),pending:u('location.pending'),denied:u('location.denied'),error:u('location.error'),found:u('location.found')})[locationState];
  bar.innerHTML=`<span class="location-symbol">${icon('locate',20)}</span><span class="location-copy"><strong>${html(heading)}</strong><small>${html(statusLabel)}</small></span><button class="loc-btn" id="locate" ${locationState==='pending'?'disabled':''}>${icon('locate',14)}${html(userLocation?u('location.refresh'):u('location.locate'))}</button>`;
  document.querySelector('#locate').onclick=()=>getLocation(true);
}
function getLocation(recenter=false) {
  if(!navigator.geolocation) {locationState='error';locationBar();return;}
  const req=++locateRequest;
  locationState='pending'; locationBar();
  navigator.geolocation.getCurrentPosition(result=>{
    if(req!==locateRequest)return;
    userLocation={lat:result.coords.latitude, lon:result.coords.longitude}; locationState='found';
    if(view==='explore') { nearby(); locationBar(); updateMap(); if(recenter && distance(reference,userLocation)<4000)map.locate(userLocation); }
  },err=>{ if(req!==locateRequest)return; locationState=err.code===1?'denied':'error';
    userLocation=null;
    if(view==='explore'){ nearby(); locationBar(); updateMap(); } },{timeout:10000,maximumAge:recenter?0:120000,enableHighAccuracy:false});
}
function updateMap() {
  map?.destroy();
  map=mountMap(document.querySelector('#map'),{sites,lang,selected,onSelect:id=>openSite(id),userLocation:userLocation&&distance(reference,userLocation)<4000?userLocation:null});
}
function fieldNote(){
  const site=byId(selected);
  return `<div class="note-art" aria-hidden="true">${icon('binoculars',46)}</div><div class="note-copy"><span class="eyebrow">${label('field.label')}</span><h3>${label('field.title')}</h3><p>${html(site.question[lang])}</p></div><button data-prompt="${html(site.id)}" class="ink-btn">${label('field.open')} ${icon('right',16)}</button>`;
}
function explore() {
 main.innerHTML=`<div class="wrap explore-page">
 <section class="hero"><div class="hero-copy"><div class="eyebrow geo-tag"><span></span>${label('hero.region')}</div><h1>${label('hero.lead')} <em>${label('hero.city')}</em><b>${label('hero.period')}</b></h1><p>${label('hero.description')}</p></div><div class="hero-picture"><img alt="" src="./assets/station-engraving.webp"><span>${label('hero.coordinates')}</span></div></section>
 <div class="discover-grid"><section class="map-section"><div class="heading-row"><h2>${icon('map',22)}${label('map.title')}</h2><span class="map-count"><i></i>${label('counts.' + new Intl.PluralRules(lang).select(sites.length), {count:sites.length})}</span></div>
 <div class="map-shell"><div class="map-view"><div id="map"></div><span class="map-tag">${icon('pin',13)} ${label('map.tag')}</span><div class="map-controls"><button id="zoom-in" aria-label="${label('map.zoomIn')}">${icon('plus',17)}</button><button id="zoom-out" aria-label="${label('map.zoomOut')}">${icon('minus',17)}</button></div><span class="north" aria-hidden="true">${label('map.north')}<i></i></span></div><div id="location-bar" aria-live="polite"></div></div></section>
 <section class="near-section"><div class="heading-row"><h2>${icon('pin',22)}<span id="near-title"></span></h2><button class="link-btn" data-all>${label('nearby.all')} ${icon('right',16)}</button></div><div id="near-cards"></div></section></div>
 <section class="field-note" id="field-note">${fieldNote()}</section></div>`;
  nearby();locationBar();updateMap();
  document.querySelector('#zoom-in').onclick=()=>map.zoom(1);
  document.querySelector('#zoom-out').onclick=()=>map.zoom(-1);
}
function modal(content,accessibleName) {
  stopVoice();
  sheet.innerHTML=`<button class="modal-close" data-close aria-label="${label('dialog.close')}">${icon('cross',19)}</button>${content}`;
  sheet.setAttribute('aria-label',accessibleName);
  if(!sheet.open) sheet.showModal();
  sheet.scrollTop=0;
  document.body.classList.add('modal-open');
}
function openSite(id,prompt=false,fromList=false) {
  const s=byId(id);if(!s)return;
  selected=id;map?.select(id);
  const field=document.querySelector('#field-note');if(field)field.innerHTML=fieldNote();
  const image = `<img class="detail-photo" src="${html(s.image)}" alt="${html(s.alt[lang])}">`;
  const caption = s.caption?.[lang];
  const figure = caption ? `<figure class="site-image">${image}<figcaption class="site-image-caption">${html(caption)}</figcaption></figure>` : image;
  modal(`${figure}<div class="detail-body">${fromList?`<button class="back-list" data-all>← ${label('directory.title')}</button>`:''}<span class="place-category ${html(s.category)}"><i></i>${html(category(s.category))}</span><h2>${html(s.name[lang])}</h2><p class="detail-address">${icon('pin',16)} ${html(s.address)}</p><div class="site-voice"></div>${historyParagraphs(s.history[lang])}
  <details class="question" ${prompt?'open':''}><summary>${icon('binoculars',20)} ${label('field.title')} ${icon('down',16)}</summary><p>${html(s.question[lang])}</p><button class="reveal" aria-expanded="false">${label('field.reveal')}</button><p class="answer" hidden>${html(s.answer[lang])}</p></details><div class="detail-links"><a href="https://www.google.com/maps/dir/?api=1&destination=${html(s.lat)},${html(s.lon)}&travelmode=walking" target="_blank" rel="noopener noreferrer">${icon('walk',17)} ${label('site.directions')} ${icon('arrowup',13)}</a><a href="${html(s.source)}" target="_blank" rel="noopener noreferrer">${label('site.readMore')} ${icon('arrowup',13)}</a></div></div>`,s.name[lang]);
  mountVoice(sheet.querySelector('.site-voice'), {id:'site/'+s.id, lang});
  sheet.querySelector('.reveal').onclick=e=>{ const a=sheet.querySelector('.answer');a.hidden=!a.hidden;e.currentTarget.setAttribute('aria-expanded',String(!a.hidden));e.currentTarget.textContent=a.hidden?u('field.reveal'):u('field.hide'); };
  if(prompt) sheet.querySelector('.question').scrollIntoView({block:'nearest'});
}
function allPlaces() {
 const title=u('directory.title');
 modal(`<div class="directory"><div class="eyebrow">${label('directory.region')}</div><h2>${html(title)}</h2><label class="search">${icon('search')}<input type="search" id="site-search" placeholder="${label('directory.search')}" aria-label="${label('directory.search')}"></label><div class="filters">${['all','architecture','culture','history','parks'].map(k=>`<button data-filter="${k}" aria-pressed="${k==='all'}">${html(k==='all'?u('directory.all'):category(k))}</button>`).join('')}</div><div class="directory-results"></div></div>`,title);
 let filter='all';
 function refresh(){
 const q=sheet.querySelector('input').value.trim().toLocaleLowerCase();
 const found=ranked().filter(s=>(filter==='all'||s.category===filter)&&[s.name.en,s.name.ru,s.address].some(v=>v.toLocaleLowerCase().includes(q)));
 sheet.querySelector('.directory-results').innerHTML=found.map(card).join('') || `<p>${label('directory.empty')}</p>`;
 }
 sheet.querySelector('input').oninput=refresh;
 sheet.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter; sheet.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b));refresh()});refresh();
}
document.addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el)return;
 if(el.hasAttribute('data-close'))sheet.close();
 else if(el.hasAttribute('data-all'))allPlaces();
 else if(el.dataset.site)openSite(el.dataset.site,false,!!el.closest('.directory'));
 else if(el.dataset.prompt)openSite(el.dataset.prompt,true);
});
sheet.addEventListener('close',()=>{
  if(sheet.open)return;
  document.body.classList.remove('modal-open');
  if(view==='explore')stopVoice();
});
sheet.addEventListener('click',e=>{if(e.target!==sheet)return;const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close()});
function render() {
  stopVoice();
  view=currentView();document.documentElement.lang=lang;
  document.title=u('document.title',{section:u('nav.'+view),brand:u('brand.name')});
  if(sheet.open)sheet.close();map?.destroy();map=null;
  header();
  if(view==='explore') {
    explore();
    if(locationState==='idle')getLocation();
  } else {
    main.innerHTML=renderGuide(view,lang);
    activateGuide(main,view,lang);
    const anchor = view==='history' ? '.guide-heading' : '.transport-section h2';
    const player = document.createElement('div');
    main.querySelector(anchor).insertAdjacentElement('afterend',player);
    mountVoice(player,{id:view==='history'?'history':'transport',lang});
  }
}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(error=>console.warn('Offline setup:',error.message));
