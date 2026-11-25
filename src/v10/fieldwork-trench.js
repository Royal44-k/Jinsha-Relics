import { width, height, witnesses, joint, top, radius } from './trench-profile.js';
import { wetSieve } from './fieldwork-sieve.js';

function random(seed) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
function sheet(w=width,h=height){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function stroke(g,points,color,size=1) {
  g.strokeStyle=color;g.lineWidth=size;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
}
function drawBrush(g){
  g.rotate(-.64);
  g.save();g.translate(1.5,2);g.shadowColor='#20181188';g.shadowBlur=5;g.fillStyle='#785c43';
  g.beginPath();g.moveTo(-3,-22);g.quadraticCurveTo(-4,-46,-2,-68);g.quadraticCurveTo(0,-73,2.3,-68);g.lineTo(4,-21);g.fill();g.restore();
  const handle=g.createLinearGradient(-4,0,4,0);handle.addColorStop(0,'#493528');handle.addColorStop(.25,'#976e46');handle.addColorStop(.56,'#c29a62');handle.addColorStop(.85,'#755637');handle.addColorStop(1,'#4a392a');
  g.fillStyle=handle;g.beginPath();g.moveTo(-3.4,-18);g.quadraticCurveTo(-3.7,-45,-2.2,-68);g.quadraticCurveTo(0,-72,2.2,-68);g.quadraticCurveTo(2.1,-51,3.8,-18);g.fill();
  const bristles=g.createLinearGradient(-11,-15,10,11);bristles.addColorStop(0,'#886646');bristles.addColorStop(.48,'#cba271');bristles.addColorStop(.76,'#e4c798');bristles.addColorStop(1,'#907456');
  g.fillStyle=bristles;g.beginPath();g.moveTo(-7,-16);g.lineTo(7,-16);g.quadraticCurveTo(9,-3,12,9);g.quadraticCurveTo(2,14,-12,10);g.quadraticCurveTo(-10,-2,-7,-16);g.fill();
  for(let i=-11;i<=11;i++){const edge=i*(.8+Math.cos(i*5)*.08);stroke(g,[[edge*.68,-12],[edge*.85,1],[i,9.5+Math.sin(i*2.1)*1.8]],i%3?'#f4dfb246':'#7760448f',.58);}
  const ferrule=g.createLinearGradient(-8,0,8,0);ferrule.addColorStop(0,'#74603d');ferrule.addColorStop(.3,'#d5bd8a');ferrule.addColorStop(.52,'#aa9470');ferrule.addColorStop(.82,'#d4bf92');ferrule.addColorStop(1,'#675938');
  g.fillStyle=ferrule;g.fillRect(-7.9,-23,15.8,9.7);g.fillStyle='#7e674c';g.fillRect(-7.9,-15.5,15.8,1);g.fillRect(-7.7,-21.7,15.4,.7);
}
// These immutable layers are baked against the recording curve. Browsers
// decode one copy across visits, while each visit owns its excavated dust mask.
const art = {};
function loadArt(name, url) {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image.decode().then(() => (art[name] = image), () => null);
}
const faceReady = loadArt('registered', '/assets/v10/trench-registered.webp')
  .then(face => face || loadArt('fallback', '/assets/v10/trench-fallback.webp'));
// Fold the edge of this photographed strip into its opposite edge once. Its
// top feathers over the previous row, allowing each row a different offset.
function makeGravelStrip(image){
  const overlap=Math.round(image.width*.21),period=image.width-overlap;
  const strip=sheet(period,image.height),g=strip.getContext('2d');
  g.drawImage(image,0,0,period,image.height,0,0,period,image.height);
  const edge=sheet(overlap,image.height),e=edge.getContext('2d');
  e.drawImage(image,period,0,overlap,image.height,0,0,overlap,image.height);
  const across=e.createLinearGradient(0,0,overlap,0);
  across.addColorStop(0,'#000');across.addColorStop(.25,'#000d');across.addColorStop(.75,'#0002');across.addColorStop(1,'#0000');
  e.globalCompositeOperation='destination-in';e.fillStyle=across;e.fillRect(0,0,overlap,image.height);
  g.drawImage(edge,0,0);
  const down=g.createLinearGradient(0,0,0,image.height*.30);
  down.addColorStop(0,'#0000');down.addColorStop(.25,'#0002');down.addColorStop(.75,'#000d');down.addColorStop(1,'#000');
  g.globalCompositeOperation='destination-in';g.fillStyle=down;g.fillRect(0,0,period,image.height);
  return strip;
}
const floorReady = loadArt('gravel', '/assets/v10/trench-gravel.webp')
  .then(image=>image&&(art.gravel=makeGravelStrip(image)));
const coverReady = loadArt('dust', '/assets/v10/trench-dust.webp');
const grainReady = loadArt('grain', '/assets/environment/forest_floor_diff_1k.webp');
const backdropReady = loadArt('backdrop', '/assets/v10/cutbank.webp');

let sketch;
function fieldSketch(){
  if(sketch)return sketch;
  sketch=sheet();const g=sketch.getContext('2d');
  // This small vector section keeps both windows readable even if every
  // image request fails. Its sand-to-mud contact uses the actual pin curve.
  for(const [color,edge] of [
    ['#574e37',top],['#856449',x=>top(x)+29],['#af8e67',x=>joint(x)-52],
    ['#594b40',joint],['#817357',x=>joint(x)+34]
  ]){
    g.fillStyle=color;g.beginPath();g.moveTo(0,height);
    for(let x=0;x<=width;x+=4)g.lineTo(x,edge(x));
    g.lineTo(width,height);g.closePath();g.fill();
  }
  return sketch;
}

export function uncoverTrench(ctx){
  const canvas=sheet(1,1);canvas.tabIndex=0;canvas.setAttribute('aria-label','探方剖面，拖刷两处绳框。键盘用方向键移刷，空格按住刷土，Tab 切换工具。');
  ctx.view.append(canvas);
  const g=canvas.getContext('2d'),dust=sheet(),rand=random(6455);
  // Both sampling windows read this mutable mask on each brush update.
  // A CPU-backed mask keeps the first erasing stroke responsive in Chromium.
  const d=dust.getContext('2d',{willReadFrequently:true});
  const cache=sheet(1,1),cacheContext=cache.getContext('2d');
  let surfaceDirty=true,face=art.registered||art.fallback||fieldSketch();
  const windows=witnesses.map(x=>({x,y:joint(x),cells:new Set()}));
  d.fillStyle='#877761';
  for(const w of windows)d.fillRect(w.x-radius-2,w.y-radius-2,2*radius+4,2*radius+4);
  const addDust=image=>{
    if(ctx.closed||!image)return;
    // Preserve holes brushed out before the small grain image finished decoding.
    d.save();d.globalCompositeOperation='source-in';d.drawImage(image,0,0);d.restore();dirty=true;
  };
  const header=document.createElement('strong'),sub=document.createElement('span');ctx.read.append(header,sub);
  let cursor={x:windows[0].x,y:windows[0].y},scale=1,ox=0,oy=0,dirty=true,insets=[];
  let brushing=false, marking=false, checked=false, previous=null, pressed=new Set(),lastSound=0,readState='';
  let notice='',tags=[],lastKeyTravel=0,backdrop=art.backdrop;
  let grain=art.grain;
  const dustPuffs=[];let lastPuff=0;
  const invalidateSurface=()=>{surfaceDirty=true;dirty=true;};
  faceReady.then(image=>{if(!ctx.closed&&image&&image!==face){face=image;invalidateSurface();}});
  if(!art.gravel)floorReady.then(image=>{if(!ctx.closed&&image)invalidateSurface();});
  if(!backdrop)backdropReady.then(image=>{if(!ctx.closed&&image){backdrop=image;invalidateSurface();}});
  if(!grain)grainReady.then(image=>{if(!ctx.closed&&image){grain=image;invalidateSurface();}});
  if(art.dust)addDust(art.dust);else coverReady.then(addDust);
  const tool=ctx.button('改用记录针',()=>{if(!windows.every(ready)){ctx.tip('先来回清理两个绳框，中部要露出连续的砂泥交界。');return;}marking=!marking;previous=null;update();});
  const focusTool=ctx.button('换取样窗',()=>{const w=windows[cursor.x<width/2?1:0];cursor={x:w.x,y:w.y};dirty=true;canvas.focus({preventScroll:true});});
  const undo=ctx.button('撤回标记',()=>{if(tags.length)tags.pop();notice='';update();});
  let resumeSieve;
  const archive=ctx.button('取样湿筛',()=>{
    if(!checked)return;
    if(resumeSieve)resumeSieve();
    else resumeSieve=wetSieve(ctx,()=>{readState='';update();archive.focus({preventScroll:true});});
  });
  function ready(w){return w.cells.size>=29;}
  function update(){
    const next=[...windows.map(w=>Math.min(29,w.cells.size)),marking,tags.length,notice].join('|');
    if(next===readState){dirty=true;return;}readState=next;
    ctx.step?.(marking?2:1,6,marking?'钉下两处层界':'刷出陶片所在的层位');
    checked=tags.length===2;tool.textContent=marking?'返回软刷':'改用记录针';tool.setAttribute('aria-pressed',String(marking));undo.hidden=!marking;archive.hidden=!checked;
    focusTool.hidden=checked;
    header.textContent=checked?'岸线已记录':marking?'两点定界':'剖面清理';
    sub.textContent=marking?'已标记 '+tags.length+' / 2 处层位':'西窗 '+Math.min(100,Math.round(windows[0].cells.size/29*100))+'%　东窗 '+Math.min(100,Math.round(windows[1].cells.size/29*100))+'%';
    ctx.tip(notice||(checked?'深色细泥上覆盖着粗砂。两处都记录了同一接触面。取一袋交界处的模拟土样，检查水冲走细泥后留下了什么。':marking?'在两个取样窗里，分别点浅色砂砾的下缘。键盘移针后按回车。':windows.every(ready)?'两窗都能看见层界了。换上记录针，标记浅砂落在深泥之上的位置。':'按住拖动软刷，来回扫开两个绳框中的浮土。方向键移刷，按住空格刷土。'));
    dirty=true;
  }
  function scrub(){
    const w=windows.find(w=>Math.abs(cursor.x-w.x)<radius+8&&Math.abs(cursor.y-w.y)<radius+8);
    if(!w){previous=null;return;}
    const setAt=(x,y)=>{
      for(let row=0;row<7;row++)for(let col=0;col<8;col++){
        const dx=w.x-radius+(col+.5)*12-x,dy=w.y-radius+(row+.5)*14-y;
        if(dx*dx+dy*dy<20*20)w.cells.add(row*8+col);
      }
      const gradient=d.createRadialGradient(x,y,5,x,y,23);gradient.addColorStop(0,'#000');gradient.addColorStop(.64,'#000d');gradient.addColorStop(1,'#0000');d.fillStyle=gradient;d.fillRect(x-23,y-23,46,46);
    };
    d.save();d.globalCompositeOperation='destination-out';
    if(previous&&previous.w===w){const n=Math.max(1,Math.ceil(Math.hypot(cursor.x-previous.x,cursor.y-previous.y)/7));for(let i=1;i<=n;i++)setAt(previous.x+(cursor.x-previous.x)*i/n,previous.y+(cursor.y-previous.y)*i/n);}
    else setAt(cursor.x,cursor.y);
    const now=performance.now(),impulse=previous?Math.max(-36,Math.min(36,(cursor.x-previous.x)*2)):0;
    if(now-lastPuff>45&&dustPuffs.length<32&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(let i=0;i<4;i++)dustPuffs.push({x:cursor.x+(rand()-.5)*20,y:cursor.y+(rand()-.5)*6,vx:impulse*.65+(rand()-.5)*18,vy:-9-rand()*14,t:0,r:.8+rand()*1.8});
      lastPuff=now;
    }
    d.restore();previous={...cursor,w};notice='';if(now-lastSound>190){ctx.cue('brush');lastSound=now;}update();
  }
  function mark(){
    if(checked)return;
    const index=windows.findIndex(w=>Math.abs(cursor.x-w.x)<radius+3&&Math.abs(cursor.y-w.y)<radius+3);
    if(index<0 || Math.abs(cursor.y-joint(cursor.x))>13){notice='针尖还在同一种土里。找色浅、带颗粒的砂层与下方暗泥相接的那条线。';update();return;}
    if(tags.some(t=>t.index===index)){notice='这个窗已经标好，再去另一个窗。';update();return;}
    tags.push({index,x:cursor.x,y:joint(cursor.x)});notice='';ctx.cue('mark');update();
  }
  function move(e){const r=canvas.getBoundingClientRect(),u=e.clientX-r.left,v=e.clientY-r.top;
    const inset=insets.find(box=>u>=box.x&&u<=box.x+box.size&&v>=box.y&&v<=box.y+box.size);
    cursor=inset?{x:inset.w.x-54+(u-inset.x)*108/inset.size,y:inset.w.y-54+(v-inset.y)*108/inset.size}:{x:(u-ox)/scale,y:(v-oy)/scale};dirty=true;}
  ctx.on(canvas,'pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);move(e);if(marking){mark();return;}brushing=true;scrub();});
  ctx.on(canvas,'pointermove',e=>{move(e);if(brushing&&!marking)scrub();});
  const release=()=>{brushing=false;previous=null;pressed.clear();};
  ctx.on(canvas,'pointerup',release);ctx.on(canvas,'pointercancel',release);ctx.on(canvas,'lostpointercapture',release);ctx.on(canvas,'blur',release);
  ctx.on(canvas,'keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter'].includes(e.code))return;e.preventDefault();e.stopPropagation();pressed.add(e.code);if(marking&&e.code==='Enter'&&!e.repeat)mark();});
  ctx.on(canvas,'keyup',e=>{pressed.delete(e.code);if(e.code==='Space')previous=null;});
  function fit(){const r=ctx.view.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.65);if(!r.width||!r.height)return;
    const nextWidth=Math.round(r.width*dpr),nextHeight=Math.round(r.height*dpr);
    if(nextWidth===canvas.width&&nextHeight===canvas.height)return;
    canvas.width=cache.width=nextWidth;canvas.height=cache.height=nextHeight;
    surfaceDirty=true;scale=Math.min(r.width/1020,r.height/560);ox=(r.width-width*scale)/2;
    const portrait=r.width<570&&r.height/r.width>1.03;oy=portrait?r.height*.28-height*scale/2:(r.height-height*scale)/2+6*scale;
    const size=Math.min(r.width*.425,r.height*.34);
    insets=portrait?windows.map((w,i)=>({w,x:r.width*(i?.748:.252)-size/2,y:r.height*.67-size/2,size})):[];dirty=true;
  }
  const ro=new ResizeObserver(fit);ro.observe(ctx.view);ctx.onClose(()=>ro.disconnect());fit();
  function paintSurface(g,w,h,dpr){
    g.setTransform(dpr,0,0,dpr,0,0);const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#6c7772');bg.addColorStop(.52,'#64675a');bg.addColorStop(1,'#31382d');g.fillStyle=bg;g.fillRect(0,0,w,h);
    if(backdrop){
      const cover=Math.max(w/backdrop.width,h/backdrop.height),iw=backdrop.width*cover,ih=backdrop.height*cover;
      g.drawImage(backdrop,(w-iw)*.29,(h-ih)*.41,iw,ih);
      const shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#1c221b26');shade.addColorStop(.25,'#252b2690');shade.addColorStop(.69,'#2f3025a8');shade.addColorStop(1,'#171d19ce');g.fillStyle=shade;g.fillRect(0,0,w,h);
    }
    g.translate(ox,oy);g.scale(scale,scale);
    // The wall turns into the two sides of the trench. A foreshortened
    // gravel floor continues to the viewer's feet below the section.
    const beyond=Math.max(170,ox/scale+36),bottom=(h-oy)/scale;
    g.fillStyle='#685540';g.fillRect(-beyond,377,width+2*beyond,Math.max(30,bottom-375));
    if(art.gravel){
      // The floor occupies a handful of tiles. Direct blits avoid the
      // software renderer constructing a filtered pattern for a large quad.
      const tileW=art.gravel.width*.82,tileH=art.gravel.height*.31,stride=tileH*.70;
      const left=-beyond,right=width+beyond,end=368+Math.max(40,bottom-360);
      const firstRow=Math.floor((368-380)/stride)-1;
      g.save();g.beginPath();g.rect(left,368,right-left,end-368);g.clip();
      for(let row=firstRow;380+row*stride<end;row++){
        const y=380+row*stride,origin=417+row*tileW*.38197;
        const firstX=origin+Math.floor((left-origin)/tileW)*tileW;
        for(let x=firstX;x<right;x+=tileW)g.drawImage(art.gravel,x,y,tileW+.45,tileH);
      }
      g.restore();
    }
    const floorShade=g.createLinearGradient(0,380,0,Math.max(445,bottom));floorShade.addColorStop(0,'#221a16db');floorShade.addColorStop(.15,'#3c31264d');floorShade.addColorStop(.8,'#2b281f47');floorShade.addColorStop(1,'#25241f75');g.fillStyle=floorShade;g.fillRect(-beyond,378,width+2*beyond,Math.max(30,bottom-376));
    for(const sign of [-1,1]){
      const edge=sign<0?0:width,sx=sign<0?0:width-146;
      g.save();g.transform(sign,.37,0,1,edge,0);g.drawImage(face,sx,0,146,height,0,0,beyond,height);
      const sideShade=g.createLinearGradient(0,0,beyond,0);sideShade.addColorStop(0,'#1918125c');sideShade.addColorStop(1,'#161813a8');g.fillStyle=sideShade;
      g.beginPath();g.moveTo(0,top(edge));g.lineTo(beyond,top(edge));g.lineTo(beyond,height);g.lineTo(0,height);g.fill();g.restore();
    }
    g.fillStyle='#55553f';g.beginPath();g.moveTo(-beyond,top(0)+51);
    for(let x=-beyond;x<=width+beyond;x+=12)g.lineTo(x,top(Math.min(width,Math.max(0,x)))-18-5*Math.sin(x*.019)-2*Math.sin(x*.087));
    g.lineTo(width+beyond,top(width)+70);for(let x=width;x>=0;x-=8)g.lineTo(x,top(x)+1);g.closePath();g.fill();
    if(grain){
      g.save();g.clip();g.globalAlpha=.48;
      const tileW=grain.width*.30,tileH=grain.height*.09;
      for(let y=0;y<125;y+=tileH)for(let x=Math.floor(-beyond/tileW)*tileW;x<width+beyond;x+=tileW)g.drawImage(grain,x,y,tileW,tileH);
      g.restore();
    }
    for(const x of [35,455,880]){stroke(g,[[x,-34],[x,top(x)+5]],'#504933',5);stroke(g,[[x+1,-34],[x+1,-13]],'#e9d7ae',3);}
    stroke(g,[[34,-22],[455,-15],[880,-21]],'#dccfa488',1.4);
    g.drawImage(face,0,0);if(grain&&face!==art.registered){g.save();g.beginPath();g.moveTo(0,top(0));for(let x=0;x<=900;x+=5)g.lineTo(x,top(x));g.lineTo(900,400);g.lineTo(0,400);g.closePath();g.clip();g.globalAlpha=.13;g.drawImage(grain,0,0,width,height);g.restore();}
    const footShade=g.createLinearGradient(0,393,0,421);footShade.addColorStop(0,'#16140f00');footShade.addColorStop(.28,'#211a158a');footShade.addColorStop(1,'#28211900');g.fillStyle=footShade;g.fillRect(0,393,width,28);
    for(let i=0;i<27;i++){
      const x=4+((i*337.27)%895),r=.8+1.9*(.5+.5*Math.sin(i*3.93))**2,y=403+((i*19.557)%65);
      g.fillStyle='#2e261d7f';g.beginPath();g.ellipse(x+1,y+1,r*1.42,r*.46,0,0,Math.PI*2);g.fill();
      g.fillStyle=i%3?'#796c58':'#96816a';g.beginPath();g.ellipse(x,y,r*1.24,r*.57,i*.35,0,Math.PI*2);g.fill();
    }
  }
  let lastCursor=null,lastLabels='';
  function paint(dt,time){
    if(canvas.hidden)return;
    if(pressed.size){
      cursor.x=Math.max(0,Math.min(width,cursor.x+dt*138*(Number(pressed.has('ArrowRight'))-Number(pressed.has('ArrowLeft')))));
      cursor.y=Math.max(0,Math.min(height,cursor.y+dt*138*(Number(pressed.has('ArrowDown'))-Number(pressed.has('ArrowUp')))));
      if(pressed.has('Space')&&!marking&&time-lastKeyTravel>.035){scrub();lastKeyTravel=time;}dirty=true;
    }
    if(dustPuffs.length){for(let i=dustPuffs.length-1;i>=0;i--){const puff=dustPuffs[i];puff.t+=dt;if(puff.t>.55)dustPuffs.splice(i,1);else{puff.x+=puff.vx*dt;puff.y+=puff.vy*dt;puff.vy+=26*dt;}}dirty=true;}
    if(!dirty||canvas.width<2||canvas.height<2)return;dirty=false;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=canvas.width/Math.max(1,w);
    const labels=marking+'-'+tags.length;
    const partial=lastCursor&&!surfaceDirty&&!insets.length&&lastLabels===labels;
    if(surfaceDirty){paintSurface(cacheContext,w,h,dpr);surfaceDirty=false;}
    g.save();g.setTransform(1,0,0,1,0,0);
    if(partial){
      const xs=[lastCursor.x,cursor.x,...dustPuffs.map(p=>p.x)],ys=[lastCursor.y,cursor.y,...dustPuffs.map(p=>p.y)];
      const left=Math.max(0,Math.floor((ox+(Math.min(...xs)-85)*scale)*dpr)),right=Math.min(canvas.width,Math.ceil((ox+(Math.max(...xs)+85)*scale)*dpr));
      const y0=Math.max(0,Math.floor((oy+(Math.min(...ys)-86)*scale)*dpr)),y1=Math.min(canvas.height,Math.ceil((oy+(Math.max(...ys)+66)*scale)*dpr));
      if(right>left&&y1>y0){g.beginPath();g.rect(left,y0,right-left,y1-y0);g.clip();g.drawImage(cache,left,y0,right-left,y1-y0,left,y0,right-left,y1-y0);}
      else{g.beginPath();g.rect(0,0,0,0);g.clip();}
    }else g.drawImage(cache,0,0);
    lastCursor={...cursor};lastLabels=labels;
    g.setTransform(dpr*scale,0,0,dpr*scale,ox*dpr,oy*dpr);
    g.drawImage(dust,0,0);
    for(const puff of dustPuffs){g.globalAlpha=Math.max(0,1-puff.t/.55)*.55;g.fillStyle='#dfc8a3';g.beginPath();g.arc(puff.x,puff.y,puff.r,0,Math.PI*2);g.fill();}g.globalAlpha=1;
    for(const [i,s] of windows.entries()){
      g.setLineDash([6,5]);g.strokeStyle='#e2d3a799';g.lineWidth=1.6;g.strokeRect(s.x-radius,s.y-radius,2*radius,2*radius);g.setLineDash([]);
      g.font='18px Georgia, serif';g.fillStyle='#eee3bc';g.fillText(i?'E':'W',s.x-radius,s.y-radius-10);
      for(const ax of [-radius,radius])for(const ay of [-radius,radius]){g.fillStyle='#352e24';g.beginPath();g.ellipse(s.x+ax,s.y+ay+2,3.6,3,0,0,Math.PI*2);g.fill();g.fillStyle='#ebc584';g.fillRect(s.x+ax-2,s.y+ay-3,4,4);}
    }
    for(let i=0;i<8;i++){g.fillStyle=i%2?'#303533':'#e3d9b0';g.fillRect(-14,64+i*35,9,35);}
    g.fillStyle='#e0d3ad';g.font='14px monospace';g.fillText('0',-34,74);g.fillText('80',-43,346);g.fillText('cm',-44,365);
    if(tags.length===2)stroke(g,[[tags[0].x,tags[0].y],[tags[1].x,tags[1].y]],'#dec38b',2);
    for(const t of tags){stroke(g,[[t.x,t.y],[t.x+7,t.y-22]],'#cfc4a2',2);g.fillStyle='#f7cf78';g.fillRect(t.x+5,t.y-26,13,7);}
    if(cursor.x>-25&&cursor.x<935&&cursor.y>-40&&cursor.y<425){
      g.save();g.translate(cursor.x,cursor.y);g.strokeStyle='#f2e3b8';g.lineWidth=1.3;g.beginPath();g.arc(0,0,marking?7:21,0,Math.PI*2);g.stroke();
      if(marking){stroke(g,[[-10,0],[10,0]],'#f6dd96');stroke(g,[[0,-10],[0,10]],'#f6dd96');}else{
        drawBrush(g);}
      g.restore();
    }
    if(insets.length){
      g.setTransform(dpr,0,0,dpr,0,0);
      for(const [i,box] of insets.entries()){
        const {x,y,size,w}=box,sx=w.x-54,sy=w.y-54,k=size/108;
        g.strokeStyle='#ded1a367';g.lineWidth=1;g.beginPath();g.moveTo(ox+w.x*scale,oy+(w.y+48)*scale);g.lineTo(ox+w.x*scale,y-29);g.stroke();
        g.fillStyle='#253029';g.fillRect(x-3,y-24,size+6,size+27);g.fillStyle='#d5c69d';g.font='12px system-ui, sans-serif';g.fillText(i?'东取样窗':'西取样窗',x+4,y-8);
        g.drawImage(face,sx,sy,108,108,x,y,size,size);g.drawImage(dust,sx,sy,108,108,x,y,size,size);
        g.strokeStyle='#d4bd83';g.strokeRect(x,y,size,size);
        if(Math.abs(cursor.x-w.x)<54&&Math.abs(cursor.y-w.y)<54){
          const px=x+(cursor.x-sx)*k,py=y+(cursor.y-sy)*k;g.strokeStyle='#f6dda3';g.beginPath();g.arc(px,py,(marking?6:14)*k,0,Math.PI*2);g.stroke();
        }
        for(const t of tags.filter(t=>t.index===i)){const px=x+(t.x-sx)*k,py=y+(t.y-sy)*k;stroke(g,[[px,py],[px+6,py-21]],'#f1dca9',1.6);g.fillStyle='#f2c461';g.fillRect(px+4,py-24,11,5);}
      }
    }
    g.restore();if(!canvas.dataset.painted)canvas.dataset.painted='true';
    const layer=face===art.registered?'registered-strata':face===art.fallback?'baked-sketch':'field-sketch';
    if(canvas.dataset.material!==layer)canvas.dataset.material=layer;
  }
  update();paint(0,performance.now()/1000);ctx.frame(paint);
}
