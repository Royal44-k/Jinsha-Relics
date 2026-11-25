import {sites,origin,riverX,riverWidth,ground,westEdge} from './geography.js';
import {FIELD_TRAILS} from '../v11/field-locations.js';

const project=(x,z)=>[15+(55-z)*2.88,79-x*1.04];
let relief;
// The field sheet uses the same ground samples as the playable river. Sample
// once and retain only the contour strokes between visits to the notebook.
function terrainContours(){
  if(relief)return relief;
  const heights=[];
  for(let x=-74;x<=60;x+=4){
    const row=[];
    for(let z=-85;z<=59;z+=4)row.push([x,z,ground(x,z)]);
    heights.push(row);
  }
  relief=[1.45,2.1,3.15,4.3].map(level=>{
    const strokes=[];
    for(let i=1;i<heights.length;i++)for(let j=1;j<heights[i].length;j++){
      const corners=[heights[i-1][j-1],heights[i][j-1],heights[i][j],heights[i-1][j]];
      if(corners[0][0]<westEdge(corners[0][1]))continue;
      const cut=[];
      corners.forEach((a,n)=>{
        const b=corners[(n+1)%4];
        if((a[2]<level)===(b[2]<level))return;
        const t=(level-a[2])/(b[2]-a[2]);
        cut.push(project(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t).map(v=>v.toFixed(1)).join(' '));
      });
      for(let n=1;n<cut.length;n+=2)strokes.push('M'+cut[n-1]+'L'+cut[n]);
    }
    return strokes.join('');
  });
  return relief;
}
export function fieldMap(count,position,found=[],places=[],onPick) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  const map=project;
  svg.setAttribute('class','ledger-map');svg.setAttribute('viewBox','0 0 430 168');
  svg.setAttribute('role',onPick?'group':'img');svg.setAttribute('aria-label','河岸调查图，北向右。可选择已知地点。');
  function draw(name,props,text){
    const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(props))e.setAttribute(k,v);
    if(text)e.textContent=text;svg.append(e);return e;
  }
  const left=[],right=[],axis=[];
  for(const path of terrainContours())draw('path',{d:path,fill:'none',stroke:'#738979','stroke-opacity':.34,'stroke-width':.65});
  for(let z=55;z>=-83;z-=1){const x=riverX(z),w=riverWidth(z);
    left.push(map(x-w,z));right.push(map(x+w,z));axis.push(map(x,z));}
  draw('path',{d:'M'+left.join(' L')+' L'+right.reverse().join(' L')+'Z',fill:'#39554f',stroke:'#7f9e8b','stroke-width':.7});
  draw('polyline',{points:axis.join(' '),fill:'none',stroke:'#9cae93','stroke-width':.5,'stroke-dasharray':'6 7'});
  const known=Math.min(9,count+1),path=[origin,...sites.slice(0,known)].map(([x,z])=>map(x,z));
  draw('polyline',{points:path.join(' '),fill:'none',stroke:'#d1b993','stroke-width':1.3,'stroke-dasharray':'3 3'});
  draw('text',{x:12,y:20,fill:'#c4b891'},'古河道测绘');draw('text',{x:380,y:19,fill:'#b0b69c'},'北  →');
  for(let i=0;i<known;i++){
    const [x,y]=map(...sites[i]);draw('circle',{cx:x,cy:y,r:4,fill:i<count?'#e8ca92':'#82c0ad',stroke:'#182426','stroke-width':1});
    const number=draw('text',{x,y:y-9,fill:'#ecddc4','text-anchor':'middle'},String(i+1));
    if(onPick){number.style.cursor='pointer';number.onclick=()=>onPick(places[i].id);}
  }
  for(const site of FIELD_TRAILS){
    const [x,y]=map(site.x,site.z),done=found.includes(site.id);
    draw('path',{d:'M'+x+' '+(y-3.1)+'l3.1 3.1 -3.1 3.1 -3.1 -3.1Z',fill:done?'#d2a974':'none',stroke:'#d2a974'});
    const name=draw('text',{x:x+(site.id==='netsinker'?-6:7),y:y+3,fill:'#e3ceaa','text-anchor':site.id==='netsinker'?'end':'start','font-size':8},site.title);
    if(onPick){name.style.cursor='pointer';name.onclick=()=>onPick(site.id);}
  }
  if(position){const [x,y]=map(position.x,position.z);draw('circle',{cx:x,cy:y,r:6.5,fill:'none',stroke:'#f6f1d5','stroke-width':1.4});}
  draw('text',{x:13,y:160,fill:'#bbc3a9'},'○ 烁羽当前位置');
  draw('path',{d:'M363 144v4h29v-4',fill:'none',stroke:'#bfb192'});draw('text',{x:368,y:160,fill:'#bfb192'},'10 米');
  for(const place of places){
    const [x,y]=map(...place.point);
    const pin=draw('circle',{cx:x,cy:y,r:8,fill:'transparent',class:'atlas-hit','data-map-place':place.id,
      role:'button',tabindex:-1,'aria-pressed':'false','aria-label':place.name});
    pin.addEventListener('click',()=>onPick(place.id));
    pin.addEventListener('keydown',e=>{
      if(e.key===' '||e.key==='Enter'){e.preventDefault();onPick(place.id);}
    });
  }
  return svg;
}

function html(tag,cls,text){
  const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;
}
export function fieldNavigator({count,chapters,position,found,selectedId,markStation,markTrail,review}){
  const places=chapters.slice(0,Math.min(count+1,chapters.length)).map((entry,i)=>({
    id:entry.id,name:entry.site,point:sites[i],approach:sites[i],title:entry.title,
    state:i<count?'已归档':'主线现场',index:i,done:i<count
  }));
  for(const trail of FIELD_TRAILS)places.push({
    id:trail.id,name:trail.title,point:[trail.x,trail.z],approach:trail.entry,title:trail.hint,
    state:found.includes(trail.id)?'已发现':'野外支线',trail
  });
  const box=html('section','field-atlas'),controls=html('div','atlas-operations');
  const select=html('select'),description=html('p','atlas-description'),mark=html('button','revisit','在罗盘标记'),repeat=html('button','revisit','就地回顾');
  select.setAttribute('aria-label','选择地图地点');description.setAttribute('aria-live','polite');
  for(const place of places){
    const option=html('option','',place.name);option.value=place.id;select.append(option);
  }
  let chosen;
  function pick(id){
    chosen=places.find(place=>place.id===id)||places[0];
    select.value=chosen.id;
    for(const pin of map.querySelectorAll('.atlas-hit'))pin.setAttribute('aria-pressed',String(pin.dataset.mapPlace===chosen.id));
    const distance=Math.round(Math.hypot(position.x-chosen.approach[0],position.z-chosen.approach[1]));
    description.textContent=chosen.state+'　·　直线 '+distance+' 米　｜　'+chosen.title;
    repeat.hidden=!chosen.done;
    mark.disabled=Boolean(chosen.trail&&found.includes(chosen.id)&&chosen.id!=='carbon-rice');
  }
  const map=fieldMap(count,position,found,places,pick);
  select.onchange=()=>pick(select.value);
  mark.onclick=()=>{if(chosen.trail)markTrail(chosen.trail);else markStation(chosen.index);};
  repeat.onclick=()=>{if(chosen.done)review(chosen.index);};
  controls.append(select,mark,repeat);box.append(map,controls,description);pick(selectedId);
  return box;
}
