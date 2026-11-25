const turn=Math.PI/180;
const profiles=[
  {seed:41,count:53,bands:true,title:'簇状孔参照',note:'这张参照的孔隙常成簇挤在一起。样本中央有一道稀疏、成对的孔列。'},
  {seed:88,count:32,bands:false,title:'散孔参照',note:''},
  {seed:219,count:145,bands:true,title:'细密孔参照',note:'这张参照的小孔排列十分密集。样本里的大孔更疏，宽窄关系也不同。'}
];
function micrograph(profile) {
  let seed=profile.seed;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=480;const g=canvas.getContext('2d');
  g.fillStyle='#bd8d56';g.fillRect(0,0,480,480);
  for(let y=-10;y<495;y+=5.5){
    let x=-15+rand()*7;
    while(x<490){const len=4+rand()*8,dy=rand()*3;g.beginPath();g.moveTo(x,y+1);g.lineTo(x+2,y-1);g.lineTo(x+len,y-.5);g.lineTo(x+len+1,y+3.6);g.lineTo(x+2,y+4.5+dy);g.closePath();
      g.fillStyle='hsl('+(27+rand()*15)+' '+(31+rand()*14)+'% '+(50+rand()*18)+'%)';g.fill();g.lineWidth=.65;g.strokeStyle='#814e32aa';g.stroke();x+=len;}
  }
  for(let i=0;i<28;i++){const x=rand()*480,drift=rand()*14;g.beginPath();g.moveTo(x,-2);g.bezierCurveTo(x+drift,193,x-drift,326,x+3,485);g.lineWidth=1+rand()*2.2;g.strokeStyle='#704a3790';g.stroke();}
  if(profile.bands)for(let i=0;i<4;i++){g.beginPath();g.moveTo(0,110*i+34);g.bezierCurveTo(154,110*i,270,110*i+90,480,110*i+33);g.strokeStyle='#7d51375c';g.lineWidth=7;g.stroke();}
  function pore(x,y,r,a){
    g.save();g.translate(x,y);g.rotate(a);g.scale(.78,1);g.beginPath();g.arc(0,0,r+2,0,2*Math.PI);g.fillStyle='#dfb77a';g.fill();
    const light=g.createRadialGradient(r*.23,r*.4,0,0,0,r);light.addColorStop(0,'#6c513d');light.addColorStop(.8,'#5c4130');light.addColorStop(1,'#443025');g.fillStyle=light;g.beginPath();g.arc(0,0,r,0,2*Math.PI);g.fill();g.restore();
  }
  for(let i=0;i<profile.count;i++){const x=rand()*480,y=rand()*480,r=(profile.count>100?2:5)+rand()*(profile.count>100?4:8),a=rand()*.5;pore(x,y,r,a);if(i%(profile.bands?2:4)===0)pore(x+r,y+r*.63,r*.7,a);}
  if(profile.seed===88)for(const [x,y,r] of [[192,201,15],[206,215,10],[279,253,13],[285,271,9],[222,304,10]])pore(x,y,r,.1);
  return canvas;
}
const slides=[];
let loading;
export function prepareSections(){
  if(!loading)loading=Promise.all(profiles.map(async(profile,i)=>{
    const image=new Image();image.decoding='async';image.src='/assets/v10/fieldwork-slide-'+(i+1)+'.webp';
    try{await image.decode();slides[i]=image;}catch{slides[i]=micrograph(profile);}
  }));
  return loading;
}
export function compareSections(ctx,onMatch,onBack){
  ctx.section.dataset.fieldPhase='microscope';ctx.overlay.replaceChildren();ctx.tools.replaceChildren();
  const head=ctx.read.querySelector('strong'),sub=ctx.read.querySelector('span');
  const cabinet=document.createElement('div');cabinet.className='fw-optics';
  const tray=document.createElement('div');tray.className='fw-lenses';cabinet.append(tray);
  const views=['根部样本','参照切片'].map(label=>{
    const cell=document.createElement('div');cell.className='fw-lens-cell';
    const lens=document.createElement('div');lens.className='fw-lens';
    const c=document.createElement('canvas');c.width=c.height=480;c.dataset.painted='true';c.setAttribute('aria-label',label);lens.append(c);
    const caption=document.createElement('span');caption.textContent=label;cell.append(lens,caption);tray.append(cell);return c;
  });
  const note=document.createElement('div');note.className='fw-optics-note';note.textContent='木材鉴定方法演示　／　显微图样为教学绘制';cabinet.append(note);
  ctx.view.append(cabinet);ctx.view.firstElementChild.hidden=true;
  let candidate=0,angle=-45,drag=null;
  const target=0,standard=views[1],options=[];
  function render(){
    for(const [j,c] of views.entries()){const g=c.getContext('2d');g.save();g.fillStyle='#34291e';g.fillRect(0,0,480,480);g.translate(240,240);g.rotate((j===0?target:angle)*turn);
      const image=slides[j===0?1:candidate];if(image)g.drawImage(image,-327,-327,654,654);g.restore();
      g.strokeStyle='#dfdfc6aa';g.lineWidth=1;g.beginPath();g.moveTo(208,240);g.lineTo(272,240);g.moveTo(240,208);g.lineTo(240,272);g.stroke();}
    head.textContent='并列显微镜';sub.textContent='参照 '+(candidate+1)+' / 3　·　转台 '+angle+'°';
  }
  function rotate(amount){angle=((((angle+amount+180)%360)+360)%360)-180;ctx.cue('slide-click');render();}
  for(const [i,p] of profiles.entries()){
    const b=ctx.button(p.title,()=>{candidate=i;options.forEach((o,k)=>o.setAttribute('aria-pressed',String(k===i)));ctx.cue('brush');ctx.tip('沿十字线观察孔的位置和疏密。拖转右侧参照，让相同的结构朝向一致，再复核。');render();});
    b.setAttribute('aria-pressed',String(i===0));options.push(b);
  }
  ctx.button('逆转 15°',()=>rotate(-15));ctx.button('顺转 15°',()=>rotate(15));
  ctx.button('复核切片',()=>{
    if(!slides[1]||!slides[candidate]){ctx.tip('正在装入切片，稍候再观察十字线附近的孔隙。');return;}
    if(candidate!==1){ctx.tip(profiles[candidate].note);ctx.cue('brush');return;}
    if(Math.abs(angle)>6){ctx.tip('孔的疏密相似。看十字线下方的双孔，旋转右侧参照，使两张图里的双孔方向重合。');return;}
    ctx.cue('mark');cabinet.hidden=true;ctx.view.firstElementChild.hidden=false;onMatch();
  });
  ctx.button('返回根部取样',()=>{cabinet.hidden=true;ctx.view.firstElementChild.hidden=false;onBack();});
  const controls=[...ctx.tools.children];
  standard.tabIndex=0;standard.setAttribute('aria-label','参照切片转台，横向拖动，或使用左右方向键');
  ctx.on(standard,'pointerdown',e=>{standard.focus({preventScroll:true});standard.setPointerCapture(e.pointerId);drag={x:e.clientX,rest:0};});
  ctx.on(standard,'pointermove',e=>{if(!drag)return;const distance=e.clientX-drag.x+drag.rest,step=Math.trunc(distance/18);drag.x=e.clientX;drag.rest=distance-step*18;if(step)rotate(step*15);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])ctx.on(standard,type,()=>{drag=null;});
  ctx.on(standard,'keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.code))return;e.preventDefault();e.stopPropagation();rotate(e.code==='ArrowLeft'?-15:15);});
  prepareSections().then(()=>{if(!ctx.closed&&cabinet.isConnected)render();});
  function resume(){
    ctx.section.dataset.fieldPhase='microscope';ctx.step?.(3,4,'旋转并比对木材切片');
    cabinet.hidden=false;ctx.overlay.replaceChildren();ctx.view.firstElementChild.hidden=true;ctx.tools.replaceChildren(...controls);
    render();ctx.tip('比较左侧样本和右侧参照的孔隙。挑选相似的切片，再拖转右侧透镜，让两幅视野中的双孔方向重合。');
    options[candidate].focus({preventScroll:true});
  }
  resume();return resume;
}
