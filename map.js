// A schematic of the Hoddle Grid. Project coordinates into local metres so
// landmarks, the visitor marker and the illustration share the same scale.
const NS = 'http://www.w3.org/2000/svg';
const geoxy = (lat, lon) => [(lon - 144.965) * 87971, (-37.814 - lat) * 111195];
const esc = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const worldPoint = pair => geoxy(pair[0], pair[1]).map(n => n.toFixed(1)).join(',');
const segment = (points, colour, width, extra='') =>
  `<polyline points="${points.map(worldPoint).join(' ')}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const street = (name, x, y, angle=0) =>
  `<text class="map-street" transform="translate(${x} ${y}) rotate(${angle})">${esc(name)}</text>`;
const district = (en,ru,x,y,lang) =>
  `<text class="map-district" x="${x}" y="${y}">${lang==='ru'?ru:en}</text>`;
const gx = geoxy(-37.82152,144.95515);
const rotation = -20.8;
const gridTransform = `translate(${gx.join(' ')}) rotate(${rotation})`;
const roadColour = '#fbf9ef';
let sequence = 0;

function neighbourhood() {
  // Carlton's north-south blocks and Southbank's smaller parcels form the
  // backdrop beyond the original street grid.
  const tiles=[];
  for(let col=-11;col<11;col++) {
    const x=col*220+19*Math.sin(col*1.4);
    const right=(col+1)*220+19*Math.sin((col+1)*1.4)-8;
    for(let row=-10;row<10;row++){
      const y=row*168+22*Math.sin(row*1.6);
      const bottom=(row+1)*168+22*Math.sin((row+1)*1.6)-8;
      const w=right-x, h=bottom-y;
      const cut=3+Math.abs(col*3+row)%9;
      const part=x+w*(.23+.12*Math.abs((col+row)%4));
      const mid=y+h*(.4+.055*((row*3+col)%5));
      const colours=['#ece9df','#ebe8de','#eeeadf','#e9e7dd'];
      tiles.push(`<path d="M${x+cut} ${y}H${right-3}L${right} ${y+4}V${bottom-5}L${right-5} ${bottom}H${x+2}L${x} ${bottom-3}V${y+cut}Z" fill="${colours[Math.abs(row*7+col)%4]}"/>
        <path d="M${x+2} ${mid}H${part}V${bottom-4}M${part+6} ${y+1}V${mid}H${right-2}" stroke="#f3f0e5" stroke-width="3" fill="none"/>`);
      if((col+row*7)%4===0)tiles.push(`<rect x="${part+10}" y="${mid+8}" width="${(right-part)*.72}" height="${(bottom-mid)*.6}" rx="8" fill="#e0e3d3"/>`);
    }
  }
  const [stadiumX,stadiumY]=geoxy(-37.81635,144.94745);
  tiles.push(`<g transform="translate(${stadiumX} ${stadiumY}) rotate(35)">
    <rect x="-138" y="-171" width="276" height="342" rx="78" fill="#dfded2"/>
    <ellipse rx="117" ry="149" fill="#e7e4d7" stroke="#cfcdc1" stroke-width="8"/>
    <ellipse rx="93" ry="116" fill="#d0dbbd" stroke="#d8d2c0" stroke-width="6"/>
    </g>`);
  return tiles.join('');
}

function cityGrid() {
  const pieces=[];
  const xs=[-500,-265,0,227,456,684,910,1142,1374,1604,1827,2070,2300];
  const ys=[-1360,-1200,-1090,-980,-867,-757,-649,-541,-434,-325,-216,-108,0];
  pieces.push(`<g transform="${gridTransform}"><rect x="-500" y="-1360" width="2800" height="1360" fill="${roadColour}"/>`);
  for(let c=0;c<xs.length-1;c++){
    for(let r=0;r<ys.length-1;r++){
      const x=xs[c]+9, y=ys[r]+(r%2===0?9:6);
      const w=xs[c+1]-x-9, h=ys[r+1]-y-(r%2===0?6:9);
      const colours=['#e9e6dc','#e6e4d9','#eae6dd','#e8e4da'];
      const seed=(c*3+r*7);
      pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${colours[seed%4]}" stroke="#dcd8cc" stroke-width="2"/>`);
      const a=x+w*(.25+(seed%4)*.04), b=x+w*(.65+(seed%3)*.03), mid=y+h*(.35+(seed%4)*.08);
      pieces.push(`<path d="M${a} ${y+2}V${y+h-2}M${b} ${y+2}V${mid}H${x+w-1} M${x+2} ${mid}H${a}" fill="none" stroke="#f3f1e7" stroke-width="5"/>`);
      if(seed%5===0) pieces.push(`<rect x="${b+4}" y="${mid+4}" width="${x+w-b-10}" height="${y+h-mid-10}" rx="3" fill="#d3ddc6"/>`);
    }
  }
  pieces.push('</g>');
  return pieces.join('');
}

const parks = [
  {name:['Flagstaff Gardens','Сады Флагстафф'], center:[-37.8102,144.9548],
    points:[[-37.8117,144.9541],[-37.81085,144.9571],[-37.80845,144.95595],[-37.80934,144.95292]]},
  {name:['Carlton Gardens','Карлтонские сады'], center:[-37.8052,144.9717],
    points:[[-37.80677,144.96835],[-37.808,144.97366],[-37.80664,144.97608],[-37.80308,144.97608],[-37.80296,144.96958]]},
  {name:['Treasury Gardens','Сады Трежери'], center:[-37.8141,144.9763],
    points:[[-37.81567,144.97507],[-37.81452,144.97862],[-37.81284,144.97773],[-37.81374,144.97434]]},
  {name:['Fitzroy Gardens','Сады Фицрой'],center:[-37.8124,144.9806],
    points:[[-37.81475,144.97923],[-37.81475,144.98398],[-37.80972,144.98398],[-37.80972,144.97899]]},
  {name:['Birrarung Marr','Биррарунг Марр'],center:[-37.81863,144.97485],
    points:[[-37.81967,144.96973],[-37.8188,144.97195],[-37.81748,144.97851],[-37.81975,144.97850],[-37.82219,144.97729],[-37.82069,144.97363]]},
  {name:['Alexandra Gardens','Александра-Гарденс'],center:[-37.82098,144.97089],
    points:[[-37.82043,144.96801],[-37.82065,144.97055],[-37.82154,144.97391],[-37.82232,144.97610],[-37.8241,144.97675],[-37.82252,144.97099]]},
];

function greenSpaces(lang,uid) {
  return parks.map(({points,name,center},i)=>{
    const projected = points.map(p=>geoxy(...p));
    const minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0]));
    const minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1]));
    const poly = points.map(worldPoint).join(' '), [x,y]=geoxy(...center);
    return `<defs><clipPath id="${uid}-park${i}"><polygon points="${poly}"/></clipPath></defs>
      <polygon points="${poly}" fill="#c8daba" stroke="#b9cda7" stroke-width="4"/>
      <g clip-path="url(#${uid}-park${i})">
        <rect x="${minX}" y="${minY}" width="${maxX-minX}" height="${maxY-minY}" fill="url(#${uid}-trees)"/>
        <path d="M${minX} ${minY} Q${x} ${y+40} ${maxX} ${maxY} M${minX} ${maxY} Q${x-30} ${y-5} ${maxX} ${minY}" fill="none" stroke="#ebeadd" stroke-width="7"/>
      </g>
      `;
  }).join('');
}

function river(lang) {
  const p=(lat,lon)=>worldPoint([lat,lon]);
  const line=`M${p(-37.8239,144.9330)} C${p(-37.8200,144.9433)} ${p(-37.8245,144.9488)} ${p(-37.8233,144.95424)}
    S${p(-37.82025,144.9612)} ${p(-37.82003,144.96552)}
    S${p(-37.8196,144.9719)} ${p(-37.82118,144.97464)}
    S${p(-37.82462,144.98015)} ${p(-37.82584,144.98588)}`;
  const bridge = (a,b,w) => segment([a,b],'#c4beb2',w+5)+segment([a,b],'#faf5e5',w);
  const [x,y]=geoxy(-37.82138,144.96035);
  return `<path d="${line}" fill="none" stroke="#b4cec6" stroke-width="123"/>
    <path d="${line}" fill="none" stroke="#90bcc5" stroke-width="110"/>
    ${bridge([-37.82099,144.95514],[-37.82465,144.95594],24)}
    ${bridge([-37.82034,144.95982],[-37.82212,144.96018],23)}
    ${bridge([-37.81853,144.96739],[-37.82104,144.96855],29)}
    <text class="map-water" transform="translate(${x} ${y}) rotate(-14)">${lang==='ru'?'Ярра':'Yarra River'}</text>`;
}

function railway() {
  // Flinders Street's platforms follow the river towards the viaduct and
  // continue east through the Jolimont rail corridor.
  const p=(lat,lon)=>worldPoint([lat,lon]);
  const track=`M${p(-37.82095,144.951)} C${p(-37.8226,144.9555)} ${p(-37.82075,144.9601)} ${p(-37.8198,144.9627)} S${p(-37.8189,144.9666)} ${p(-37.81865,144.9680)} S${p(-37.817,144.9752)} ${p(-37.8167,144.9788)}`;
  let rails='';
  for(const offset of [-9,1,11]) rails+=`<path d="${track}" transform="translate(0 ${offset})" fill="none" stroke="#c5c4b7" stroke-width="2"/>`;
  const platforms=Array.from({length:4},(_,i)=>`<rect x="${850+i*8}" y="${18+i*15}" width="${293-i*10}" height="10" rx="3" fill="#d4cbb5" stroke="#c7c1b1" stroke-width="1.5"/>`).join('');
  return `<path d="${track}" fill="none" stroke="#e4e2d5" stroke-width="33"/>${rails}
  <g transform="${gridTransform}">${platforms}</g>`;
}

function cityLabels(lang) {
  const pieces = [
    street('FLINDERS ST',245,9),street('FLINDERS ST',1410,9),
    street('COLLINS ST',180,-206),street('COLLINS ST',1580,-206),
    street('SWANSTON ST',1150,-975,-90),street('SWANSTON ST',1150,-444,-90),
    street('SPRING ST',1835,-600,-90),
    street('LA TROBE ST',480,-854),street('LA TROBE ST',1490,-854),
    street('LONSDALE ST',300,-639),street('LONSDALE ST',1450,-640),
    street('BOURKE ST',650,-424),street('BOURKE ST',1620,-424),
    street('COLLINS ST',470,-206),street('COLLINS ST',1430,-206),
    street('FLINDERS ST',570,9),street('FLINDERS ST',1565,9),
    street('QUEEN ST',692,-710,-90),street('WILLIAM ST',464,-420,-90),
    street('KING ST',235,-357,-90),street('ELIZABETH ST',918,-494,-90),
    street('SWANSTON ST',1150,-582,-90),street('RUSSELL ST',1382,-888,-90),
    street('EXHIBITION ST',1612,-500,-90),street('SPRING ST',1835,-335,-90),
    street('VICTORIA ST',652,-1191),street('FRANKLIN ST',320,-1081)
  ];
  return `<g transform="${gridTransform}">${pieces.join('')}</g>`+
    district('SOUTHBANK','САУТБАНК',-330,925,lang)+district('CARLTON','КАРЛТОН',500,-1020,lang)+
    district('MELBOURNE','МЕЛЬБУРН',-400,-22,lang);
}

function basemap(lang,uid) {
  return `<defs>
    <pattern id="${uid}-trees" patternUnits="userSpaceOnUse" width="65" height="61"><circle cx="14" cy="14" r="7" fill="#acbf99"/><circle cx="49" cy="29" r="6" fill="#b8cda6"/><circle cx="24" cy="52" r="7" fill="#b0c69e"/></pattern>
    <filter id="${uid}-shadow" x="-60%" y="-45%" width="220%" height="215%"><feDropShadow dx="0" dy="1.1" stdDeviation="1.2" flood-color="#414632" flood-opacity=".26"/></filter>
  </defs>
  <g aria-hidden="true"><rect x="-4000" y="-4000" width="8000" height="8000" fill="#f3f1e6"/>
    ${neighbourhood()}${cityGrid()}${railway()}${greenSpaces(lang,uid)}${river(lang)}${cityLabels(lang)}
    ${parks.map(({name,center})=>{
      const [x,y]=geoxy(...center);
      return `<text class="map-park" x="${x}" y="${y}">${esc(name[lang==='ru'?1:0])}</text>`;
    }).join('')}
  </g>`;
}

const clamp = (v,low,high) => Math.max(low,Math.min(high,v));
const coordOf = loc => {
  if (!loc) return null;
  const lat=loc.lat??loc.latitude, lon=loc.lon??loc.lng??loc.longitude;
  return Number.isFinite(lat)&&Number.isFinite(lon)?geoxy(lat,lon):null;
};

function placePins(sites,unitsPerPixel) {
  const pins=sites.map(site=>{
    const [x,y]=geoxy(site.lat,site.lon);
    return {site, x:x/unitsPerPixel, y:y/unitsPerPixel, anchorX:x/unitsPerPixel, anchorY:y/unitsPerPixel};
  });
  // Fan nearby pins apart just enough to tap. A short leader retains each
  // pin's true position, especially around Federation Square.
  for(let pass=0;pass<12;pass++){
    for(let i=0;i<pins.length;i++) for(let j=i+1;j<pins.length;j++){
      const a=pins[i], b=pins[j];
      const dx=b.x-a.x||0.001, dy=b.y-a.y;
      const distance=Math.hypot(dx,dy);
      if(distance>=35) continue;
      const move=(35-distance)/(2*distance);
      a.x-=dx*move; a.y-=dy*move;
      b.x+=dx*move; b.y+=dy*move;
    }
  }
  return pins;
}

export function mountMap(container,{sites=[],lang='en',selected=null,onSelect=()=>{},userLocation=null}={}) {
  const uid=`melb-map-${++sequence}`;
  const ru=lang==='ru';
  const el=document.createElement('div');
  el.className='cbd-map';
  el.tabIndex=0;
  el.setAttribute('role','region');
  el.setAttribute('aria-label',ru?'Интерактивная карта центра Мельбурна':'Interactive map of Melbourne CBD');
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('width','100%');
  svg.setAttribute('height','100%');
  svg.innerHTML=basemap(lang,uid)+`<g data-position></g><g data-leaders aria-hidden="true"></g><g data-markers></g>`;
  el.append(svg); container.append(el);

  const scene=svg.querySelector('[data-markers]');
  const leaders=svg.querySelector('[data-leaders]');
  const visitor=svg.querySelector('[data-position]');
  let chosen=selected, position=coordOf(userLocation);
  let centre=geoxy(-37.81405,144.9642), level=1, overview=true;
  let worldWidth=0,worldHeight=0, scale=1,width=1,height=1;
  let lastScale=0;
  let preventClick=false, start=null;
  const pointers=new Map();

  function styleSelection() {
    for(const node of scene.children) node.setAttribute('aria-pressed',String(node.dataset.site===String(chosen)));
    const active=Array.from(scene.children).find(node=>node.getAttribute('aria-pressed')==='true');
    if(active&&active!==scene.lastElementChild)scene.append(active);
  }
  // Reserve space around pins and higher-priority labels. Text stays readable
  // at the overview scale and more street names emerge as the reader zooms in.
  const labels=Array.from(svg.querySelectorAll('.map-water,.map-street,.map-park,.map-district'));
  const rank=node=>node.classList.contains('map-water')?0:node.classList.contains('map-park')?1:node.classList.contains('map-district')?2:3;
  labels.sort((a,b)=>rank(a)-rank(b));
  function fitLabels(){
    const bounds=svg.getBoundingClientRect();
    const used=Array.from(scene.querySelectorAll('.pin-body'),node=>node.getBoundingClientRect());
    const listed=new Set();
    const positions=labels.map(node=>[node,node.getBoundingClientRect()]);
    for(const [node,rect] of positions){
      const duplicate=listed.has(node.textContent);
      const off=rect.left<bounds.left+3||rect.right>bounds.right-3||rect.top<bounds.top+3||rect.bottom>bounds.bottom-3;
      const clashes=used.some(box=>rect.left<box.right+2&&rect.right>box.left-2&&rect.top<box.bottom+1&&rect.bottom>box.top-1);
      const show=!duplicate&&!off&&!clashes;
      node.style.visibility=show?'visible':'hidden';
      if(show){used.push(rect);listed.add(node.textContent);}
    }
  }
  function draw(){
    width=Math.max(1,el.clientWidth);height=Math.max(1,el.clientHeight);
    // Always include all eight landmarks on first load, even on a phone in portrait.
    const phone=width<500;
    if(overview)centre=geoxy(phone?-37.81285:-37.81405,144.9642);
    scale=Math.max(1700/width,(phone?2140:1990)/height)/level;
    worldWidth=width*scale; worldHeight=height*scale;
    svg.setAttribute('viewBox',`${centre[0]-worldWidth/2} ${centre[1]-worldHeight/2} ${worldWidth} ${worldHeight}`);
    if(lastScale!==scale){
      for(const [name,pixels] of Object.entries({road:phone?8:9,water:phone?12:14,park:phone?8.5:10,district:phone?9:11})){
        svg.style.setProperty('--map-'+name+'-size', Math.min(100,scale*pixels)+'px');
      }
      const previousFocus=document.activeElement?.closest?.('[data-site]')?.dataset.site;
      const pins=placePins(sites,scale);
      scene.innerHTML=pins.map(p=>{
        const label=p.site.name?.[lang]??p.site.name?.en??p.site.id;
        return `<g role="button" tabindex="0" data-site="${esc(p.site.id)}" class="map-marker" aria-label="${esc(p.site.number+'. '+label)}" transform="translate(${p.x*scale} ${p.y*scale}) scale(${scale})">
          <title>${esc(label)}</title>
          <rect x="-18" y="-36" width="36" height="41" fill="transparent"/>
          <path class="pin-body" filter="url(#${uid}-shadow)" d="M0 0C-2-3-13-9.6-13-18.7A13 13 0 1 1 13-18.7C13-9.6 2-3 0 0Z"/>
          <text class="pin-text" x="0" y="-14.8">${esc(p.site.number)}</text></g>`;
      }).join('');
      leaders.innerHTML=pins.filter(p=>Math.hypot(p.x-p.anchorX,p.y-p.anchorY)>3.5).map(p=>
        `<path d="M${p.anchorX*scale} ${p.anchorY*scale} L${p.x*scale} ${p.y*scale}" stroke="#657763" stroke-width="${scale*1.2}" fill="none"/><circle cx="${p.anchorX*scale}" cy="${p.anchorY*scale}" r="${1.8*scale}" fill="#657763"/>`).join('');
      styleSelection();
      if(previousFocus)Array.from(scene.children).find(n=>n.dataset.site===previousFocus)?.focus({preventScroll:true});
      lastScale=scale;
    }
    visitor.innerHTML=position?`<g transform="translate(${position.join(' ')}) scale(${scale})"><title>${ru?'Ваше местоположение':'Your location'}</title><circle r="12" fill="#4c8baf" opacity=".23"/><circle r="5.3" fill="#3784af" stroke="#fff" stroke-width="2"/></g>`:'';
    fitLabels();
  }
  function setCentre(x,y){
    overview=false;centre=[clamp(x,-1800,1800),clamp(y,-1500,1400)];
  }
  function zoom(delta){
    level=clamp(level*Math.pow(1.45,delta),.82,4.5);
    draw();
  }
  function select(id){
    chosen=id;styleSelection();
    const site=sites.find(s=>s.id===id);
    if(!site)return;
    const [x,y]=geoxy(site.lat,site.lon);
    if(Math.abs(x-centre[0])>worldWidth/2-22*scale || Math.abs(y-centre[1])>worldHeight/2-38*scale){
      setCentre(x,y);draw();
    }
  }
  function locate(coords){
    position=coordOf(coords);
    if(!position){
      overview=true;level=1;draw();return false;
    }
    if(Math.abs(position[0])>1800 || position[1]<-1500 || position[1]>1400){
      // A visitor outside the illustrated area still needs to see Melbourne.
      draw();return false;
    }
    setCentre(...position);draw();return true;
  }
  function activate(target){
    const node=target.closest?.('[data-site]');
    if(node&&scene.contains(node)){
      select(node.dataset.site);onSelect(node.dataset.site);
      return true;
    }
    return false;
  }
  el.addEventListener('click',event=>{if(!preventClick)activate(event.target); preventClick=false;});
  el.addEventListener('keydown',event=>{
    if(['Enter',' '].includes(event.key)&&activate(event.target)){
      event.preventDefault();return;
    }
    const pan={ArrowRight:[65,0],ArrowLeft:[-65,0],ArrowUp:[0,-65],ArrowDown:[0,65]}[event.key];
    if(pan){event.preventDefault();setCentre(centre[0]+pan[0]*scale,centre[1]+pan[1]*scale);draw();}
    if(['+','=','-'].includes(event.key)){event.preventDefault();zoom(event.key==='-'?-1:1);}
  });
  function pointerDistance(){
    const [a,b]=Array.from(pointers.values());
    return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
  }
  el.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    pointers.set(event.pointerId,[event.clientX,event.clientY]);
    preventClick=false;
    if(pointers.size===1)start={x:event.clientX,y:event.clientY,centre:[...centre],scale};
    if(pointers.size===2)start={gap:pointerDistance(),level};
  });
  el.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!start)return;
    pointers.set(event.pointerId,[event.clientX,event.clientY]);
    if(pointers.size>=2&&start.gap){
      preventClick=true;level=clamp(start.level*pointerDistance()/start.gap,.82,4.5);draw();return;
    }
    if(!start.centre)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.hypot(dx,dy)<4&&!preventClick)return;
    preventClick=true;
    el.setPointerCapture(event.pointerId);
    el.classList.add('is-dragging');
    setCentre(start.centre[0]-dx*start.scale,start.centre[1]-dy*start.scale);draw();
  });
  function pointerEnd(event){
    pointers.delete(event.pointerId);
    if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);
    if(!pointers.size){start=null;el.classList.remove('is-dragging');}
  }
  el.addEventListener('pointerup',pointerEnd);
  el.addEventListener('pointercancel',pointerEnd);
  el.addEventListener('pointerleave',event=>{
    if(!el.hasPointerCapture(event.pointerId)&&pointers.size===1)pointerEnd(event);
  });
  el.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();zoom(event.deltaY<0?.3:-.3);
  },{passive:false});
  const resize=new ResizeObserver(draw);resize.observe(el);
  draw();
  return {select,zoom,locate,destroy(){resize.disconnect();el.remove();}};
}
