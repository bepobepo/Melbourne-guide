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
const t = (en, ru) => lang === 'ru' ? ru : en;
const category = c => ({architecture:t('Architecture','Архитектура'), culture:t('Culture','Культура'), history:t('History','История')})[c];
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
  return d < 1000 ? nf.format(Math.round(d/10)*10)+t(' m',' м') : nf.format(d/1000)+t(' km',' км');
}
function ranked() { return userLocation ? [...sites].sort((a,b)=>distance(userLocation,a)-distance(userLocation,b)) : sites; }
function header() {
  const links=[['explore','compass',t('Explore','Обзор')],['history','book',t('History','История')],['info','info',t('Local info','На месте')]];
  document.querySelector('#header').innerHTML=`<div class="bar wrap">
  <a class="brand" href="#explore" aria-label="Melbourne Field Guide"><span class="brand-mark">${icon('tram',27)}</span><span class="wordmark">Melbourne<small>FIELD GUIDE</small></span></a>
  <nav class="nav" aria-label="${t('Main navigation','Главное меню')}">${links.map(([key,symbol,name])=>`<a href="#${key}" ${view===key?'aria-current="page"':''}>${icon(symbol)}<span>${name}</span></a>`).join('')}</nav>
  <div class="language" role="group" aria-label="${t('Language','Язык')}">${icon('globe',16)}${['en','ru'].map(l=>`<button data-lang="${l}" lang="${l}" aria-label="${l==='en'?'English':'Русский'}" aria-pressed="${lang===l}">${l.toUpperCase()}</button>`).join('')}</div></div>`;
  document.querySelector('.skip').textContent=t('Skip to content','К содержанию');
  document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{
    lang=b.dataset.lang; try{localStorage.setItem('melbourne-language',lang)}catch{}
    render();
    document.querySelector(`[data-lang="${lang}"]`).focus({preventScroll:true});
  });
  document.querySelector('#footer').innerHTML=`<div class="wrap footer-line"><span>${icon('tram',17)} Melbourne Field Guide</span><a href="./install.html${lang==='ru'?'#ru':''}">${t('Install guide','Установка')}</a><a href="./photo-credits.html">${t('Photo credits','Авторы фотографий')}</a></div>`;
}
function card(site) {
  return `<button class="place-card" data-site="${site.id}">
    <span class="card-photo"><img src="${site.image}" alt=""><span class="photo-number">${String(site.number).padStart(2,'0')}</span></span>
    <span class="card-copy"><span class="place-category ${site.category}"><i></i>${category(site.category)}</span><strong>${site.name[lang]}</strong><span class="card-description">${site.summary[lang]}</span><span class="card-distance">${icon('pin',14)}${userLocation ? formatDistance(site) + t(' away',' от вас') : site.address}</span></span>
    <span class="card-arrow">${icon('chevron',16)}</span></button>`;
}
function nearby() {
  document.querySelector('#near-title').textContent=userLocation?t('Near you','Рядом с вами'):t('Discover nearby','Что посмотреть');
  document.querySelector('#near-cards').innerHTML=ranked().slice(0,3).map(card).join('');
}
function locationBar() {
  const bar=document.querySelector('#location-bar');
  if(!bar)return;
  const within=userLocation&&distance(reference,userLocation)<4000;
  const heading=userLocation?(within?t('Using your location','Показываем места рядом'):t('You’re outside the CBD','Вы за пределами центра')):t('Explore from your location','Начните прогулку рядом с вами');
  const label=({idle:t('Find the closest places to you.','Найдите ближайшие к вам места.'),pending:t('Checking your location…','Определяем ваше местоположение…'),denied:t('Allow location in browser settings to see nearby stops.','Разрешите геолокацию в настройках браузера.'),error:t('Location unavailable. Browse the city map or try again.','Местоположение недоступно. Попробуйте ещё раз.'),found:t('Places are sorted by distance from you.','Места отсортированы по расстоянию от вас.')})[locationState];
  bar.innerHTML=`<span class="location-symbol">${icon('locate',20)}</span><span class="location-copy"><strong>${heading}</strong><small>${label}</small></span><button class="loc-btn" id="locate" ${locationState==='pending'?'disabled':''}>${icon('locate',14)}${userLocation?t('Refresh','Обновить'):t('Locate me','Найти меня')}</button>`;
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
  return `<div class="note-art" aria-hidden="true">${icon('binoculars',46)}</div><div class="note-copy"><span class="eyebrow">${t('FIELD PROMPT','ВОПРОС НА ПРОГУЛКЕ')}</span><h3>${t('Look a little closer','Присмотритесь внимательнее')}</h3><p>${site.question[lang]}</p></div><button data-prompt="${site.id}" class="ink-btn">${t('Explore prompt','Посмотреть вопрос')} ${icon('right',16)}</button>`;
}
function explore() {
 main.innerHTML=`<div class="wrap explore-page">
 <section class="hero"><div class="hero-copy"><div class="eyebrow geo-tag"><span></span>${t('VICTORIA, AUSTRALIA','ВИКТОРИЯ, АВСТРАЛИЯ')}</div><h1>${t('Explore <em>Melbourne</em>','Откройте <em>Мельбурн</em>')}<b>.</b></h1><p>${t('Your walking companion to the landmarks and stories of the CBD.','Ваш пеший путеводитель по достопримечательностям и истории центра.')}</p></div><div class="hero-picture"><img alt="" src="./assets/station-engraving.webp"><span>37°48′ S &nbsp; 144°58′ E</span></div></section>
 <div class="discover-grid"><section class="map-section"><div class="heading-row"><h2>${icon('map',22)}${t('City map','Карта центра')}</h2><span class="map-count"><i></i>${t('8 landmarks','8 мест')}</span></div>
 <div class="map-shell"><div class="map-view"><div id="map"></div><span class="map-tag">${icon('pin',13)} MELBOURNE CBD</span><div class="map-controls"><button id="zoom-in" aria-label="${t('Zoom in','Увеличить масштаб')}">${icon('plus',17)}</button><button id="zoom-out" aria-label="${t('Zoom out','Уменьшить масштаб')}">${icon('minus',17)}</button></div><span class="north" aria-hidden="true">N<i></i></span></div><div id="location-bar" aria-live="polite"></div></div></section>
 <section class="near-section"><div class="heading-row"><h2>${icon('pin',22)}<span id="near-title"></span></h2><button class="link-btn" data-all>${t('View all','Все места')} ${icon('right',16)}</button></div><div id="near-cards"></div></section></div>
 <section class="field-note" id="field-note">${fieldNote()}</section></div>`;
  nearby();locationBar();updateMap();
  document.querySelector('#zoom-in').onclick=()=>map.zoom(1);
  document.querySelector('#zoom-out').onclick=()=>map.zoom(-1);
}
function modal(content,label) {
  stopVoice();
  sheet.innerHTML=`<button class="modal-close" data-close aria-label="${t('Close','Закрыть')}">${icon('cross',19)}</button>${content}`;
  sheet.setAttribute('aria-label',label);
  if(!sheet.open) sheet.showModal();
  sheet.scrollTop=0;
  document.body.classList.add('modal-open');
}
function openSite(id,prompt=false,fromList=false) {
  const s=byId(id);if(!s)return;
  selected=id;map?.select(id);
  const field=document.querySelector('#field-note');if(field)field.innerHTML=fieldNote();
  modal(`<img class="detail-photo" src="${s.image}" alt="${s.alt[lang]}"><div class="detail-body">${fromList?`<button class="back-list" data-all>← ${t('All places','Все места')}</button>`:''}<span class="place-category ${s.category}"><i></i>${category(s.category)}</span><h2>${s.name[lang]}</h2><p class="detail-address">${icon('pin',16)} ${s.address}</p><div class="site-voice"></div><p class="detail-history">${s.history[lang]}</p>
  <details class="question" ${prompt?'open':''}><summary>${icon('binoculars',20)} ${t('Look a little closer','Присмотритесь внимательнее')} ${icon('down',16)}</summary><p>${s.question[lang]}</p><button class="reveal" aria-expanded="false">${t('Reveal the answer','Узнать ответ')}</button><p class="answer" hidden>${s.answer[lang]}</p></details><div class="detail-links"><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking" target="_blank" rel="noopener noreferrer">${icon('walk',17)} ${t('Walking directions','Пеший маршрут')} ${icon('arrowup',13)}</a><a href="${s.source}" target="_blank" rel="noopener noreferrer">${t('Read more','Подробнее')} ${icon('arrowup',13)}</a></div></div>`,s.name[lang]);
  mountVoice(sheet.querySelector('.site-voice'), {id:'site/'+s.id, lang});
  sheet.querySelector('.reveal').onclick=e=>{ const a=sheet.querySelector('.answer');a.hidden=!a.hidden;e.currentTarget.setAttribute('aria-expanded',String(!a.hidden));e.currentTarget.textContent=a.hidden?t('Reveal the answer','Узнать ответ'):t('Hide answer','Скрыть ответ'); };
  if(prompt) sheet.querySelector('.question').scrollIntoView({block:'nearest'});
}
function allPlaces() {
 const title=t('All places','Все места');
 modal(`<div class="directory"><div class="eyebrow">${t('MELBOURNE CBD','ЦЕНТР МЕЛЬБУРНА')}</div><h2>${title}</h2><label class="search">${icon('search')}<input type="search" id="site-search" placeholder="${t('Search landmarks','Найти место')}" aria-label="${t('Search landmarks','Найти место')}"></label><div class="filters">${['all','architecture','culture','history'].map(k=>`<button data-filter="${k}" aria-pressed="${k==='all'}">${k==='all'?t('All','Все'):category(k)}</button>`).join('')}</div><div class="directory-results"></div></div>`,title);
 let filter='all';
 function refresh(){
 const q=sheet.querySelector('input').value.trim().toLocaleLowerCase();
 const found=ranked().filter(s=>(filter==='all'||s.category===filter)&&[s.name.en,s.name.ru,s.address].some(v=>v.toLocaleLowerCase().includes(q)));
 sheet.querySelector('.directory-results').innerHTML=found.map(card).join('') || `<p>${t('No places match your search.','По вашему запросу ничего не найдено.')}</p>`;
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
  document.title=({explore:t('Explore','Обзор'),history:t('History','История'),info:t('Local info','На месте')})[view]+' · Melbourne Field Guide';
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
