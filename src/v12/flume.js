import './flume.css';
import {advancePour,cores,flowAdvice,grains,makePour,sample,sediment,speed} from './flume-physics.js';
import {flumeView} from './flume-view.js';

function pack(landing){
  const counts=[0,0,0];for(const p of landing)counts[p.kind]++;
  const {kind,total}=sediment(counts);
  return {landing,counts,kind,height:total*.0022,color:kind<0?'#aa9981':grains[kind].color};
}
function readCore(core,key){
  const empty={gate:32,trials:0,best:0,layers:[]};
  try{
    const value=JSON.parse(localStorage.getItem(key));
    if(!value||value.version!==1)return empty;
    const layers=[];
    for(const records of (Array.isArray(value.layers)?value.layers:[]).slice(0,core.target.length)){
      if(!Array.isArray(records)||records.length>108||records.length<6)break;
      if(!records.every(p=>p&&Number.isInteger(p.kind)&&p.kind>=0&&p.kind<3&&Number.isFinite(p.x)&&p.x>=sample.left&&p.x<=sample.right&&Number.isFinite(p.z)&&Math.abs(p.z)<.6))break;
      layers.push(pack(records));
    }
    const number=n=>Number.isSafeInteger(n)&&n>=0?n:0;
    return {gate:Number.isFinite(value.gate)?Math.round(Math.max(0,Math.min(100,value.gate))):32,trials:number(value.trials),best:number(value.best),layers};
  }catch{return empty;}
}
export function mountFlume(host,{completedCount=0,signal,sound,onClose,storageKey='jinsha-flume-v1'}={}){
  if(!host||signal?.aborted)return ()=>{};
  const root=document.createElement('section');root.className='fl-lab';root.setAttribute('aria-label','古河水槽');
  root.innerHTML=`<div class="fl-stations" role="group" aria-label="目标岩芯"></div>
    <div class="fl-layout"><div class="fl-instrument">
      <div class="fl-stage"><button type="button" class="fl-grip" data-grip="gate">↕ 拖闸</button><button type="button" class="fl-grip" data-grip="pour">↷ 倾样</button><span class="fl-window">固定取样窗</span></div>
      <div class="fl-controls"><label>水闸开度 <output></output><input type="range" min="0" max="100" aria-label="水闸开度"></label>
        <div class="fl-buttons"><button data-act="trial">先试流</button><button data-act="pour">倾倒混合样</button><button data-act="camera">正视水槽</button></div>
        <small class="fl-instruction">上下拖闸，横拖样勺倾倒。拖动槽身可环看。试流会清走示踪颗粒。</small></div>
    </div><div class="fl-log"><h3></h3><p class="fl-story"></p>
      <div class="fl-cores"><div><h4>目标岩芯</h4><ol class="fl-goal"></ol></div><div><h4>窗内堆积</h4><ol class="fl-observed"></ol></div></div>
      <small class="fl-order">底层在下，按沉积先后自下向上读。</small>
      <p class="fl-status" role="status"></p><div class="fl-counts" aria-label="窗内示踪颗粒数"></div>
      <div class="fl-buttons"><button data-act="undo">撤回上一层</button><button data-act="again" hidden>再配一份</button></div>
      <details><summary>实验原理与考古依据</summary><p>金沙的祭祀区沿古河道南岸分布。三份岩芯以这段河岸为背景，供你研究水流可能留下的沉积痕迹。</p><p>每次各投放 36 个粗、中、细砂示踪粒。粒子随流向下游移动，粗粒下沉快、细粒下沉慢。横向位置落在采样框内才计入岩芯。每层至少需要 6 粒，同一种占六成或以上才能辨认层性。</p>
        <p>速度和粒径均经缩放，流速读数用槽长每秒表示。此处演示输运与沉积，不模拟黏结、再悬浮和真实地层年代。三份岩芯为创作的实验题。</p>
        <a href="https://www.usgs.gov/publications/fluvial-sediments-a-summary-source-transportation-deposition-and-measurement-sediment" target="_blank" rel="noopener">USGS · 河流泥沙输运 ↗</a>
        <a href="https://www.jinshasitemuseum.com/node/216" target="_blank" rel="noopener">金沙遗址博物馆 · 遗迹馆 ↗</a></details>
    </div></div><footer><span class="fl-saved"></span><button data-act="close">收起水槽</button></footer>`;
  host.append(root);
  const $=selector=>root.querySelector(selector),act=id=>$('[data-act="'+id+'"]');
  const life=new AbortController(),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:life.signal});
  for(const b of root.querySelectorAll('button'))b.type='button';
  const key=id=>storageKey+'.'+id;
  const loadRecord=c=>readCore(c,key(c.id));
  const limit=Math.max(0,Math.trunc(Number(completedCount)||0));let core=cores[0],record=loadRecord(core);
  const unlocked=()=>core.unlock<=limit;
  const handles={gate:$('[data-grip=gate]'),pour:$('[data-grip=pour]'),window:$('.fl-window')};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running=null,frame=0,last=0,lastPaint=0,lastStatus=0,waterTime=0,accumulator=0,closed=false,scene=null,lastCounts=[0,0,0];
  const countEls=grains.map(g=>{const el=document.createElement('span');el.style.setProperty('--grain',g.color);$('.fl-counts').append(el);return el;});
  const missions=cores.map(c=>{
    const b=document.createElement('button');b.type='button';b.className='fl-target';b.disabled=limit<c.unlock;
    b.textContent=c.name+(b.disabled?' · '+c.unlock+' 站解锁':'');on(b,'click',()=>load(c));$('.fl-stations').append(b);return b;
  });
  function cue(name){if(typeof sound==='function')sound(name);}
  function announce(text){$('.fl-status').textContent=text;}
  const wrong=()=>record.layers.some((l,i)=>l.kind!==core.target[i]);
  const complete=()=>!wrong()&&record.layers.length===core.target.length;
  function save(){
    if(!unlocked())return;
    try{
      const prior=loadRecord(core).best;if(prior)record.best=record.best?Math.min(record.best,prior):prior;
      localStorage.setItem(key(core.id),JSON.stringify({version:1,gate:record.gate,trials:record.trials,best:record.best,layers:record.layers.map(l=>l.landing)}));
      $('.fl-saved').textContent=record.best?'已留存岩芯纪录 · 最少 '+record.best+' 次正式投料':'本次试验已保存在此设备';
    }catch{$('.fl-saved').textContent='本次试验在当前页面保留';}
  }
  function counts(){
    for(const [i,el] of countEls.entries()){
      const str=grains[i].name+' '+lastCounts[i];if(el.textContent!==str)el.textContent=str;
    }
  }
  function drawCore(host,kinds){
    host.replaceChildren();
    for(const [i,k] of kinds.entries()){
      const li=document.createElement('li');li.style.setProperty('--grain',k==null?'#405450':k<0?'#aa9981':grains[k].color);
      const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');
      li.append(n,document.createTextNode(k==null?'待沉积':k<0?'混合层':grains[k].name));host.append(li);
    }
  }
  function controls(){
    const locked=!unlocked();act('trial').disabled=locked||!!running;act('pour').disabled=locked||!!running||wrong()||complete();
    handles.pour.disabled=act('pour').disabled;act('undo').disabled=!!running||!record.layers.length;
    act('again').hidden=!complete();act('again').disabled=!!running;
    root.dataset.phase=running?(running.trial?'trial':'pour'):complete()?'complete':wrong()?'mismatch':'ready';
  }
  function drawLogs(){
    $('.fl-log h3').textContent=core.name;$('.fl-story').textContent=core.story;
    for(const [i,b] of missions.entries())b.setAttribute('aria-pressed',String(core===cores[i]));
    drawCore($('.fl-goal'),core.target);drawCore($('.fl-observed'),core.target.map((_,i)=>record.layers[i]?.kind));
    counts();controls();scene?.strata(record.layers);
  }
  function prompt(){
    if(!unlocked())return '完成滨河探方后即可投料。可以先转动水槽，查看取样窗与闸门。';
    if(complete())return '两侧岩芯已吻合。可再配一份，尝试用更少的正式投料完成。';
    if(wrong())return '窗内刚留下的层性与目标不同。撤回上一层，调整流速再投料。';
    return '下一层需要'+grains[core.target[record.layers.length]].name+'。先试流，观察它落在取样窗的上游、窗内还是下游。';
  }
  function setGate(amount){
    record.gate=Math.max(0,Math.min(100,Math.round(amount)));$('input').value=String(record.gate);
    $('output').textContent=record.gate+'%　·　'+(speed(record.gate)/6.36).toFixed(2)+' 槽长/秒';scene?.setGate(record.gate);
  }
  function stop(){
    cancelAnimationFrame(frame);frame=0;last=lastPaint=lastStatus=accumulator=0;running=null;scene?.paint(null,waterTime);scene?.setTilt(0);
  }
  function load(c){
    stop();core=c;record=loadRecord(c);lastCounts=record.layers.at(-1)?.counts.slice()||[0,0,0];setGate(record.gate);
    drawLogs();announce(prompt());$('.fl-saved').textContent=record.best?'已留存岩芯纪录 · 最少 '+record.best+' 次正式投料':'';
  }
  function settle(){
    const {batch,trial,goal}=running,{total,kind}=sediment(batch.counts),advice=flowAdvice(batch,goal);
    stop();lastCounts=batch.counts.slice();
    if(!trial){record.trials++;if(total>=6)record.layers.push(pack(batch.landing));}
    let message='窗内共 '+total+' 粒。';
    if(trial)message='试流结束，窗内 '+total+' 粒。'+advice;
    else if(total<6)message+='不足以形成可辨认的一层。'+advice;
    else if(kind!==goal)message+=(kind<0?'混合层':grains[kind].name)+'与目标层不符。'+advice+' 撤回本层可再试。';
    else if(complete()){
      record.best=record.best?Math.min(record.best,record.trials):record.trials;
      message='剖面吻合。'+core.name+'从底至顶依次为'+core.target.map(i=>grains[i].name).join('、')+'。';cue('discovery');
    }else{message+='已新增'+grains[kind].name+'层。'+prompt();cue('mark');}
    drawLogs();save();announce(message);
  }
  function tick(now){
    frame=0;if(closed||!running||document.hidden)return;
    const dt=last?Math.min(.15,(now-last)/1000):1/60;last=now;accumulator+=dt;
    const bed=record.layers.reduce((sum,l)=>sum+l.height,0);
    while(accumulator>=1/60&&!running.batch.done){advancePour(running.batch,1/60,record.gate,bed);accumulator-=1/60;}
    waterTime+=dt*speed(record.gate)*.35;
    if(now-lastPaint>=(reduced?120:scene.software?33:15)){lastPaint=now;scene.paint(running.batch,waterTime);scene.setTilt(-1.12*Math.max(0,1-running.batch.time/1.4));}
    if(now-lastStatus>=200){lastStatus=now;lastCounts=running.batch.counts;counts();}
    if(running.batch.done)settle();else frame=requestAnimationFrame(tick);
  }
  function pour(trial){
    if(!unlocked()||running||(!trial&&(wrong()||complete())))return;
    const mismatch=record.layers.findIndex((l,i)=>l.kind!==core.target[i]);
    const goal=core.target[mismatch>=0?mismatch:Math.min(core.target.length-1,record.layers.length)];
    running={batch:makePour(),trial,goal};lastCounts=[0,0,0];
    counts();controls();announce(trial?'试流中，颗粒经过后将清走。':'示踪颗粒正在沉降。落进两条铜线之间的颗粒会写入本层。');cue('water-drop');frame=requestAnimationFrame(tick);
  }
  on($('.fl-stage'),'flume-cutaway',()=>{
    act('camera').hidden=true;
    $('.fl-instruction').textContent='当前以正面剖面观察。上下拖闸，向右倾样。试流会清走示踪颗粒。';
  });
  scene=flumeView($('.fl-stage'),handles);
  on($('input'),'input',e=>setGate(Number(e.target.value)));on($('input'),'change',save);
  on(act('camera'),'click',()=>scene.resetCamera());
  function instrument(button,isGate){
    let grip=null;
    on(button,'pointerdown',e=>{if(button.disabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);grip={id:e.pointerId,x:e.clientX,y:e.clientY,start:record.gate,tip:0};});
    on(button,'pointermove',e=>{if(grip?.id!==e.pointerId)return;
      if(isGate)setGate(grip.start+(grip.y-e.clientY)*.72);
      else{grip.tip=Math.max(0,Math.min(1,(e.clientX-grip.x+(e.clientY-grip.y)*.45)/49));scene.setTilt(-1.3*grip.tip);}
    });
    on(button,'pointerup',e=>{if(grip?.id!==e.pointerId)return;
      if(isGate)save();else if(grip.tip>=.6)pour(false);else{scene.setTilt(0);announce('按住样勺向右倾倒，或使用下方「倾倒混合样」。');}grip=null;
    });
    on(button,'lostpointercapture',()=>{grip=null;if(!running)scene.setTilt(0);});
    on(button,'click',e=>{if(e.detail!==0)return;if(isGate)$('input').focus();else pour(false);});
  }
  instrument(handles.gate,true);instrument(handles.pour,false);
  on(act('trial'),'click',()=>pour(true));on(act('pour'),'click',()=>pour(false));
  on(act('undo'),'click',()=>{if(running||!record.layers.length)return;record.layers.pop();lastCounts=record.layers.at(-1)?.counts.slice()||[0,0,0];drawLogs();save();announce('已取出最上层。'+prompt());});
  on(act('again'),'click',()=>{record.layers=[];record.trials=0;lastCounts=[0,0,0];drawLogs();save();announce(prompt());});
  on(act('close'),'click',()=>{cleanup();onClose?.();});
  on(document,'visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden&&running)frame=requestAnimationFrame(tick);});
  function cleanup(){if(closed)return;closed=true;save();stop();life.abort();signal?.removeEventListener('abort',cleanup);scene.dispose();root.remove();}
  signal?.addEventListener('abort',cleanup,{once:true});load(core);return cleanup;
}
