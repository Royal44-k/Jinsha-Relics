import {Vector3,MathUtils} from 'three';
import {makeEddyArt} from './fieldwork-eddy-art.js';
import './fieldwork-eddy.css';

const rounds=3;
const warningTime=[2.8,2.5,2.3];
const openings=[2.8,2.5,2.3];
const bankName=side=>side<0?'左':'右';
const damp=MathUtils.damp;

// This encounter borrows the existing river and raft. Its lateral movement,
// countdowns and damage are local to the challenge; the survey keeps its position.
export function makeRiverEddy(ctx,{studio,pose,center,breadth,channel,read,onEnter,onLeave}){
  const {canvas,camera,scene}=studio;
  let phase='idle',elapsed=0,round=0,knots=2,side=-1,lane=0,velocity=0,stream=0,arena=0,clearedCrest=false;
  let aim=null,hit=0,art=null,oldTime=0,result='',won=false,lastFalseStroke=-2;
  const keys=new Set(),held=new Map(),anchor=new Vector3();
  const hud=document.createElement('div');hud.className='eddy-hud';hud.hidden=true;
  const text=document.createElement('strong'),record=document.createElement('span');
  const wick=document.createElement('i'),charge=document.createElement('i');wick.className='eddy-tide';wick.append(charge);hud.append(text,record,wick);ctx.overlay.append(hud);
  const near=document.createElement('button');near.type='button';near.className='eddy-eye';near.hidden=true;near.setAttribute('aria-label','拍向眼前的涡心');near.textContent='拍';ctx.overlay.append(near);
  const entry=ctx.button('河心试胆 · 选做',enter);
  entry.classList.add('eddy-entry');
  const act=(name,fn)=>{const b=ctx.button(name,fn);b.classList.add('eddy-action');b.hidden=true;return b;};
  const begin=act('迎向回涡',beginRun),left=act('左拨',()=>{}),right=act('右拨',()=>{}),strike=act('拍水还击 F',attack),leave=act('继续测河',exit);
  const active=()=>phase!=='idle',fighting=()=>['warning','surge','opening','riposte','wash'].includes(phase);
  function clear(){keys.clear();held.clear();aim=null;}
  function setPhase(next){
    phase=next;elapsed=0;ctx.section.dataset.eddyPhase=next;
    const from=bankName(side),to=bankName(-side);
    let title,caption,tip;
    switch(next){
      case 'ready':
        title='河心试胆';caption='烁羽的想象';tip='烁羽把翻卷的浊流想成一尾水影。看哪侧泛白，向另一侧拨桨；等涡心松开，拍水打散它。';break;
      case 'warning':
        title=from+'侧起沫';caption='向'+to+'拨桨';tip=from+'侧水纹正在并拢。按住'+to+'拨或方向键，也可以在水面拖向'+to+'边。';ctx.cue('eddy-warn-'+(side<0?'left':'right'));break;
      case 'surge':
        clearedCrest=false;title=from+'侧袭流';caption='守住'+to+'侧';tip='白浪过筏时，留在安静的半边河面。';break;
      case 'opening':
        title='涡眼松开';caption='此刻拍水';tip='空心的白沫就在筏前。点涡心、按 F 或点「拍水还击」把它打散。';ctx.cue('eddy-open');break;
      case 'riposte':
        title='水影散开';caption='击散 '+round+' / '+rounds;tip=round===rounds?'最后一层浊浪退去，桨尖划开了清水。':'水沫从桨尖散开。留神下一股袭流的来向。';ctx.cue('eddy-strike');break;
      case 'wash':
        title=result;caption='稳住竹排';tip=knots?'一束筏绳松了，还能再迎一次。':'两束筏绳已松，竹排滑入岸边回水。';break;
      case 'lost':
        title='竹排入湾';caption='这一趟止于回水';tip='桨仍在手里。可重新入流，也可接着测河，已经记录的泊位会保留。';break;
      case 'won':
        title='一桨见清';caption='三道回涡已散';tip='三重水影化成一圈圈亮纹。烁羽学会听浪先向哪半边倾斜。';ctx.cue('mark');break;
    }
    text.textContent=caption;record.textContent=fighting()?'击散 '+round+' / '+rounds+'　系绳 '+knots+' / 2':'古河道 · 支线';
    read(title,caption);ctx.tip(tip);
    begin.hidden=next!=='ready'&&next!=='lost'&&next!=='won';
    begin.textContent=next==='ready'?'迎向回涡':'再试一次';
    for(const b of [left,right,strike])b.hidden=!fighting();
    leave.hidden=false;near.hidden=next!=='opening';wick.hidden=!['warning','surge','opening'].includes(next);
  }
  function enter(){
    if(active())return;
    onEnter();const p=pose();stream=p.s;arena=channel(stream);
    lane=MathUtils.clamp((p.x-center(stream))/breadth(stream),-.86,.86);velocity=0;hit=0;clear();
    ctx.section.classList.add('eddy-on');entry.hidden=true;hud.hidden=false;
    setPhase('ready');begin.focus({preventScroll:true});
  }
  function beginRun(){
    if(!['ready','lost','won'].includes(phase))return;
    if(!art)art=makeEddyArt(scene);
    round=0;knots=2;hit=0;clear();side=lane>.12?1:-1;
    canvas.focus({preventScroll:true});setPhase('warning');
  }
  function exit(){
    if(!active())return;
    clear();art?.hide();phase='idle';hit=0;
    delete ctx.section.dataset.eddyPhase;ctx.section.classList.remove('eddy-on');
    for(const b of [begin,left,right,strike,leave,near,hud])b.hidden=true;
    entry.hidden=false;entry.textContent=won?'重访河心试胆':'河心试胆 · 选做';
    onLeave();canvas.focus({preventScroll:true});
  }
  function attack(){
    if(phase==='opening'){
      round++;hit=1;setPhase('riposte');return;
    }
    if((phase==='warning'||phase==='surge')&&oldTime-lastFalseStroke>.8){
      lastFalseStroke=oldTime;ctx.cue('water');ctx.tip('桨只挑起浅水。先闪过流头，等涡心的白环张开。');
    }
  }
  ctx.on(near,'click',attack);
  function damage(message){
    knots--;hit=1;result=message;ctx.cue('eddy-hit');setPhase('wash');
  }
  function retryWave(){side=lane<-.12?-1:lane>.12?1:-side;setPhase('warning');}
  for(const [button,direction] of [[left,-1],[right,1]]){
    ctx.on(button,'pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.set(e.pointerId,direction);aim=null;});
    for(const type of ['pointerup','lostpointercapture','pointercancel'])ctx.on(button,type,e=>held.delete(e.pointerId));
  }
  ctx.on(ctx.section,'keydown',e=>{
    if(!active())return;
    if(e.code==='Escape'){e.preventDefault();e.stopPropagation();exit();return;}
    if(!fighting())return;
    if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){
      e.preventDefault();e.stopPropagation();keys.add(e.code);aim=null;
    }else if(e.code==='KeyF'||(e.code==='Space'&&e.target===canvas)){
      e.preventDefault();e.stopPropagation();if(!e.repeat)attack();
    }
  });
  ctx.on(ctx.section,'keyup',e=>keys.delete(e.code));ctx.on(window,'blur',clear);
  ctx.on(ctx.section,'focusout',e=>{if(!ctx.section.contains(e.relatedTarget))clear();});
  function direct(e){
    const r=canvas.getBoundingClientRect();
    aim=MathUtils.clamp(((e.clientX-r.left)/r.width*2-1)*1.25,-.88,.88);
  }
  ctx.on(canvas,'pointerdown',e=>{if(fighting()){canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);direct(e);}});
  ctx.on(canvas,'pointermove',e=>{if(fighting()&&e.buttons)direct(e);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])ctx.on(canvas,type,()=>{aim=null;});
  function frame(delta,time){
    if(!active())return null;
    const dt=Math.min(.12,delta);oldTime=time;elapsed+=dt;hit=Math.max(0,hit-dt*2.4);
    stream=damp(stream,arena,3.5,dt);
    let axis=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    for(const direction of held.values())axis+=direction;
    if(aim!==null)axis=MathUtils.clamp((aim-lane)*3,-1,1);
    const motion=fighting()?MathUtils.clamp(axis,-1,1):0;
    velocity=damp(velocity,motion*1.28,9,dt);lane=MathUtils.clamp(lane+velocity*dt,-.88,.88);
    if(phase==='warning'&&elapsed>=warningTime[round])setPhase('surge');
    else if(phase==='surge'){
      // The rendered crest crosses the raft just before its halfway point.
      // Judge the crossing, then let its trailing foam pass before the counter.
      if(!clearedCrest&&elapsed>=.30){
        if(side*lane>-.20)damage('流头撞上竹排');else clearedCrest=true;
      }
      if(clearedCrest&&elapsed>=.66)setPhase('opening');
    }else if(phase==='opening'&&elapsed>=openings[round])damage('涡心重新合拢');
    else if(phase==='wash'&&elapsed>=.9){if(knots)retryWave();else setPhase('lost');}
    else if(phase==='riposte'&&elapsed>=1.05){if(round===rounds){won=true;setPhase('won');}else retryWave();}
    const length=phase==='warning'?warningTime[round]:phase==='opening'?openings[round]:phase==='surge'?.66:1.05;
    const progress=Math.min(1,elapsed/length),riverX=center(stream),halfWidth=breadth(stream),boatX=riverX+lane*halfWidth;
    if(!wick.hidden)charge.style.transform='scaleX('+(phase==='opening'?1-progress:progress)+')';
    if(art&&phase!=='ready')art.update({phase:phase==='wash'?'lost':phase,side,round:Math.min(round,2),progress,time,boatX,riverX,halfWidth,s:stream,hit});
    return {x:boatX,s:stream,lateral:velocity*2.2,roll:hit*Math.sin(time*22)*.075,stroke:phase==='riposte'?Math.sin(progress*Math.PI)*.78:0};
  }
  function locate(){
    if(phase!=='opening')return;
    const half=breadth(stream);
    anchor.set(center(stream)+MathUtils.clamp(lane*half,-half+.7,half-.7),.13,-stream-.98).project(camera);
    near.style.left=((anchor.x+1)*50)+'%';near.style.top=((1-anchor.y)*50)+'%';
  }
  return {get active(){return active();},frame,locate};
}
