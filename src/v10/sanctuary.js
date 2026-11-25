import './sanctuary.css';
import {bindTouchButtons} from '../v12/touch-buttons.js';
import {taskSteps} from '../v11/task-steps.js';
import { createSanctuaryStage, drawIvory, drawFoil, drawCourt, drawFinale } from './sanctuary-stage.js';
import {mountPrintRoom} from '../v14/field-triptych.js';

export const sanctuary = [
  {
    id:'ivory-record', title:'在原处留下它', site:'滨河象牙埋藏区',
    prologue:'这一根象牙压着另一根。等它们被抬起来，谁在上、谁在下，就再也看不见了。趁现在，把它们一起拍下来。',
    objective:'在原位为三处关系取景，把比例尺落在近侧泥面，分别留下叠压、断口与泥层接触面照片。',
    reward:'原位底片', transition:'最后一张底片的侧光掠过断口。把这束光借给下一件极薄的器物，也许会看见另外一面。'
  },
  {
    id:'sunfoil', title:'辨金 · 透光台', site:'金箔光学工位',
    prologue:'把灯慢慢移到金箔背后。刚才还晃眼的金面暗下去了，光却从镂空的地方透出来。四只鸟，就在那儿。',
    objective:'在掠射光与透射光下鉴别三片教学金片，再回看太阳神鸟的镂空工艺。',
    reward:'金箔透光图版', transition:'光穿过金箔的空隙。河边还有九处四方的空印，烁羽带上测绳，去看它们如何排列。'
  },
  {
    id:'nine-posts', title:'九柱定向', site:'滨河建筑基址',
    prologue:'还记得河湾边那九个洞吗？现在，测绳在你手里了。从一个洞心拉到另一个，量出这座建筑曾经的方向。',
    objective:'将测绳架在相邻的洞心之间，分别量出一段开间和一段进深。',
    reward:'九柱基线测图', transition:'基线向东南伸去。天色将明，烁羽想沿着这座建筑的轴线，亲眼看一次冬至日出。'
  }
];

const finale = {id:'finale',site:'天将明 · 河岸',title:'冬至 · 日出金沙'};
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

function createView(host, data, options) {
  const section = document.createElement('section');
  section.className = 'js-sanctuary jss-'+data.id;
  section.setAttribute('aria-label',data.title);
  section.innerHTML = `<header class="jss-heading"><span></span><h2></h2></header>
    <div class="jss-viewport"><div class="jss-surface" aria-hidden="true"></div><div class="jss-marks"></div></div>
    <div class="jss-desk"><div class="jss-copy"><div class="jss-readout"></div><p class="jss-note" role="status"></p></div><div class="jss-tools"></div></div>`;
  section.querySelector('header span').textContent=data.site;
  section.querySelector('h2').textContent=data.title;
  host.append(section);
  const $ = name=>section.querySelector('.jss-'+name);
  const life = new AbortController(), disposers=[];
  let closed=false, completed=false;
  function on(node,event,fn,other={}) {node.addEventListener(event,fn,{...other,signal:life.signal});}
  bindTouchButtons(section,on,'.jss-action,.jss-focus-mark,.jss-film button,.jss-ruler-target,.js-print-specimen');
  function cleanup(){
    if(closed)return;
    closed=true;
    life.abort();
    for(const fn of disposers.reverse())fn();
    options.signal?.removeEventListener('abort',cleanup);
    section.remove();
  }
  options.signal?.addEventListener('abort',cleanup,{once:true});
  const ctx = {
    section,viewport:$('viewport'),surface:$('surface'),marks:$('marks'),tools:$('tools'),options,on,cleanup,disposers,
    read(text){$('readout').textContent=text;},
    note(text){if($('note').textContent!==text)$('note').textContent=text;},
    mark(label,css=''){
      const node=document.createElement('button');node.type='button';node.className='jss-marker '+css;
      node.textContent=label;ctx.marks.append(node);return node;
    },
    button(label,fn,css=''){
      const node=document.createElement('button');node.type='button';node.className='jss-action '+css;
      node.textContent=label;on(node,'click',fn);ctx.tools.append(node);return node;
    },
    slider(caption,min,max,value,fn){
      const holder=document.createElement('label');holder.className='jss-slider';
      const title=document.createElement('span');title.textContent=caption;
      const bar=document.createElement('input');bar.type='range';bar.min=min;bar.max=max;bar.value=value;
      const output=document.createElement('output');output.textContent=value;
      holder.append(title,bar,output);ctx.tools.append(holder);
      function change(){output.textContent=bar.value;fn(Number(bar.value));}
      on(bar,'input',change);return {bar,output};
    },
    finish(result){
      if(completed||closed)return;
      completed=true;
      options.complete?.(result);
    }
  };
  const steps={'ivory-record':['取景','落尺','对焦','封存'],'sunfoil':['察边','透光','鉴别'],'nine-posts':['开间','进深','对角复尺']};
  ctx.step=steps[data.id]?taskSteps(section.querySelector('header'),steps[data.id]):()=>{};
  const audio = makeScore(options);
  ctx.noteTone = audio.play;disposers.push(audio.dispose);
  return ctx;
}

// The chapter voices feed the same gain/limiter as the expedition, including mute.
function makeScore(options){
  const active=new Set();let audio,destination,noiseBuffer=null;
  function connect(source,nodes,start,end,pan){
    const balance=audio.createStereoPanner?.();if(balance){balance.pan.value=pan;nodes.push(balance);}
    let previous=source;for(const node of nodes){previous.connect(node);previous=node;}previous.connect(destination);
    const entry={source,nodes};active.add(entry);
    source.onended=()=>{active.delete(entry);source.disconnect();nodes.forEach(node=>node.disconnect());};
    source.start(start);source.stop(end+.035);
  }
  function friction(voice,base,start,level,pan){
    if(voice===2)return;
    if(!noiseBuffer||noiseBuffer.sampleRate!==audio.sampleRate){
      const rate=audio.sampleRate,buffer=audio.createBuffer(1,Math.round(rate*1.5),rate),samples=buffer.getChannelData(0);
      let seed=9847,prior=0;for(let i=0;i<samples.length;i++){seed=(Math.imul(1664525,seed)+1013904223)>>>0;prior=.38*prior+.62*(seed/2147483648-1);samples[i]=prior;}
      noiseBuffer=buffer;
    }
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    const end=start+(voice===0?1.05:.057);source.buffer=noiseBuffer;
    filter.type='bandpass';filter.Q.value=voice===0?1.15:.68;filter.frequency.setValueAtTime(voice===0?base*3.67:1800,start);
    filter.frequency.exponentialRampToValueAtTime(voice===0?base*2.72:540,end);
    gain.gain.setValueAtTime(.00001,start);gain.gain.exponentialRampToValueAtTime((voice===0?.055:.090)*level,start+(voice===0?.18:.004));
    gain.gain.exponentialRampToValueAtTime(.00001,end);connect(source,[filter,gain],start,end,pan);
  }
  function play(voice=0,pitch=0,delay=0,level=1,pan=0){
    audio=options.audioContext;destination=options.audioDestination;
    if(!audio||!destination||audio.state==='closed'||options.volume===0)return;
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const start=audio.currentTime+delay, base=[294,196,392][voice]*2**(pitch/12);
    const duration=[1.5,.58,2.1][voice];
    friction(voice,base,start,level,pan);
    // A breathy fifth, a hollow wooden knock, and a struck stone with inharmonic overtones.
    const partials=[[1,1.501,2.009],[1,2.76,4.19],[1,1.61,2.76]][voice];
    partials.forEach((multiple,i)=>{
      const osc=audio.createOscillator(),gain=audio.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(base*multiple,start);
      if(voice===1)osc.frequency.exponentialRampToValueAtTime(base*multiple*.86,start+.12);
      const attack=[.18,.009,.014][voice], end=start+duration/(1+i*.35);
      gain.gain.setValueAtTime(.00001,start);gain.gain.exponentialRampToValueAtTime(.072*level/(1+i*2.7),start+attack);
      gain.gain.exponentialRampToValueAtTime(.00001,end);connect(osc,[gain],start,end,pan);
    });
  }
  return {play,dispose(){
    for(const {source,nodes} of active){source.onended=null;try{source.stop();}catch{}source.disconnect();nodes.forEach(node=>node.disconnect());}
    active.clear();
  }};
}

function place(node,x,y){node.style.left=(x*100)+'%';node.style.top=(y*100)+'%';}
function addKeys(ctx,handler){
  ctx.on(window,'keydown',ev=>{
    if(ev.defaultPrevented||ev.altKey||ev.metaKey||ev.ctrlKey||document.body.hasAttribute('data-review-paused'))return;
    if(ev.target?.matches('input,select,textarea')||ev.target?.closest('[role="dialog"]')&&!ctx.section.contains(ev.target))return;
    if(handler(ev)){ev.preventDefault();ev.stopPropagation();}
  });
}

function ivory(ctx){
  const samples=[
    {name:'两根的叠压',short:'叠压',focus:74,description:'上层象牙横过下层，交叠次序已记录。'},
    {name:'错开的断口',short:'断口',focus:46,description:'两段断口形态相接，缝隙与错位已记录。'},
    {name:'泥层的接触面',short:'层面',focus:27,description:'泥质边缘贴住象牙，器物与堆积的位置已记录。'}
  ];
  const scene=createSanctuaryStage(ctx,drawIvory);
  let selected=-1, focus=50,exposing=false;
  const plates=new Map(),scaled=new Set();
  const holder=ctx.mark('便携标尺','jss-ruler-tool');holder.setAttribute('aria-label','拖动便携比例尺');holder.hidden=true;
  const landing=ctx.mark('落尺','jss-ruler-target');landing.setAttribute('aria-label','放置同框比例尺');landing.hidden=true;
  let dragging=null;
  const film=document.createElement('div');film.className='jss-film';ctx.marks.append(film);
  const filmSlots=samples.map((sample,i)=>{
    const cell=document.createElement('button');cell.type='button';cell.innerHTML='<i></i><span></span>';
    cell.setAttribute('aria-label','底片取景：'+sample.name);ctx.on(cell,'click',()=>aim(i));
    cell.lastChild.textContent=sample.short;film.append(cell);return cell;
  });
  const marks=samples.map((sample,i)=>{
    const node=ctx.mark(String(i+1).padStart(2,'0'),'jss-focus-mark');node.setAttribute('aria-label','取景：'+sample.name);
    ctx.on(node,'click',()=>aim(i));return node;
  });
  function scaleUI(){
    holder.hidden=landing.hidden=selected<0||scaled.has(selected);
    if(!landing.hidden)place(landing,...scene.project(scene.art.rulerSpot(selected)));
  }
  function placeScale(screen){
    if(selected<0||scaled.has(selected))return;
    if(!scene.art.layScale(selected,screen)){ctx.note('尺端会遮住遗物，或已经离开构图。请放在虚线指示的近侧泥面。');return;}
    scaled.add(selected);scaleUI();ctx.noteTone(1,2,0,.42);ctx.note('黑白标尺已经入镜。把焦距调到双线重合，再按快门。');meter();
  }
  ctx.on(holder,'pointerdown',ev=>{dragging=ev.pointerId;holder.setPointerCapture(ev.pointerId);holder.classList.add('taken');});
  ctx.on(holder,'pointermove',ev=>{
    if(dragging!==ev.pointerId)return;const r=ctx.viewport.getBoundingClientRect();
    holder.style.left=ev.clientX-r.left+'px';holder.style.top=ev.clientY-r.top+'px';
  });
  ctx.on(holder,'pointerup',ev=>{
    if(dragging!==ev.pointerId)return;const r=ctx.viewport.getBoundingClientRect();
    placeScale([(ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height]);resetDrag();
  });
  function resetDrag(){dragging=null;holder.classList.remove('taken');holder.style.left=holder.style.top='';}
  ctx.on(holder,'lostpointercapture',resetDrag);ctx.on(holder,'pointercancel',resetDrag);
  ctx.on(landing,'click',()=>placeScale());ctx.on(holder,'click',ev=>{if(ev.detail===0)placeScale();});
  scene.onLayout((project)=>{scene.art.targets.forEach((target,i)=>place(marks[i],...project(target)));scaleUI();});
  const lens=ctx.slider('镜头 / 焦距',10,90,focus,val=>{focus=val;meter();});
  const shutter=ctx.button('按下快门',expose,'jss-primary');
  const retake=ctx.button('重拍选中底片',()=>{
    if(selected<0||!plates.has(selected))return;
    plates.delete(selected);filmSlots[selected].classList.remove('exposed');filmSlots[selected].firstChild.style.backgroundImage='';
    marks[selected].classList.remove('saved');shutter.textContent='按下快门';meter();
    ctx.note('这一格已取出。横拖换机位、上下拖调焦后重新拍摄，另外两格保留。');
  });
  retake.hidden=true;
  let cameraDrag=null;
  ctx.on(ctx.viewport,'pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input'))return;
    cameraDrag={id:e.pointerId,x:e.clientX,y:e.clientY,focus};
    ctx.viewport.setPointerCapture(e.pointerId);
  });
  ctx.on(ctx.viewport,'pointermove',e=>{
    if(e.pointerId!==cameraDrag?.id)return;
    scene.art.orbit((cameraDrag.x-e.clientX)*.006);cameraDrag.x=e.clientX;
    focus=clamp(Math.round(cameraDrag.focus+(cameraDrag.y-e.clientY)*.32),10,90);
    lens.bar.value=focus;lens.output.textContent=focus;meter();
  });
  ctx.on(ctx.viewport,'lostpointercapture',()=>{cameraDrag=null;});
  shutter.setAttribute('aria-keyshortcuts','Enter');shutter.title='也可按回车拍摄';
  function aim(i){
    selected=i;marks.forEach((node,j)=>node.classList.toggle('current',i===j));filmSlots.forEach((node,j)=>node.setAttribute('aria-pressed',i===j));
    if(!plates.has(i))ctx.note(scaled.has(i)?'把焦距调到轮廓重合，记录「'+samples[i].name+'」。':'把便携标尺拖到近侧泥面的落尺线。也可点落尺标记，或按 B。');
    else ctx.note(samples[i].description);
    scene.art.emphasize(i);scaleUI();meter();
  }
  function meter(){
    const entry=samples[selected];
    retake.hidden=selected<0||!plates.has(selected);
    ctx.step(plates.size===3?3:selected<0?0:scaled.has(selected)?2:1);
    if(!entry){ctx.read('原位摄影　'+plates.size+' / 3');return;}
    const delta=focus-entry.focus, offset=Math.min(Math.abs(delta),35)/2.2;
    ctx.section.style.setProperty('--jss-focus',offset+'px');
    ctx.section.style.setProperty('--jss-defocus',(Math.min(1.4,Math.max(0,(Math.abs(delta)-5)/21)))+'px');
    ctx.read(entry.name+'　·　'+(scaled.has(selected)?'标尺入镜':'等待标尺')+'　·　'+(Math.abs(delta)<=5?'双像重合':delta>0?'缩短焦距  ←':'延长焦距  →')+'　'+plates.size+'/3');
    marks[selected].classList.toggle('sharp',Math.abs(delta)<=5);
  }
  async function expose(){
    if(exposing)return;
    if(plates.size===3){ctx.finish({photos:samples.map((sample,i)=>plates.get(i))});return;}
    if(selected<0){ctx.note('先点取景标记，或按 1、2、3 选择一处关系。');return;}
    if(!scaled.has(selected)){ctx.note('这张底片需要同框比例尺。将尺拖到泥面，或按 B 辅助落尺。');return;}
    if(Math.abs(focus-samples[selected].focus)>5){ctx.note('两道取景线仍然分开。依照焦距提示调整，再按快门。');return;}
    if(plates.has(selected)){ctx.note('这格底片已留存。请选另一个取景标记。');return;}
    const shot=selected;
    exposing=true;shutter.disabled=true;
    ctx.note('正在显影…');
    const thumbnail=await scene.snapshot(scene.art.framing(shot));
    if(!ctx.section.isConnected||ctx.options.signal?.aborted)return;
    exposing=false;shutter.disabled=false;
    if(!thumbnail){ctx.note('这一格尚未成像。待取景画面清楚后，再按一次快门。');return;}
    plates.set(shot,thumbnail);const cell=filmSlots[shot];cell.classList.add('exposed');
    cell.firstChild.style.backgroundImage='url('+thumbnail+')';
    ctx.section.classList.remove('jss-flash');void ctx.section.offsetWidth;ctx.section.classList.add('jss-flash');
    marks[shot].classList.add('saved');ctx.noteTone(1,shot*3,0,.65);
    if(selected===shot)ctx.note(samples[shot].description);
    meter();
    if(plates.size===3){shutter.textContent='封存三格底片　→';ctx.note('三处关系已在原位记录。封存底片，带走这束侧光。');}
  }
  addKeys(ctx,ev=>{
    if(/^[123]$/.test(ev.key)){aim(Number(ev.key)-1);return true;}
    if(ev.key.toLowerCase()==='b'){placeScale();return true;}
    if(ev.key==='ArrowLeft'||ev.key==='ArrowRight'){
      focus=clamp(focus+(ev.key==='ArrowLeft'?-2:2),10,90);lens.bar.value=focus;lens.output.textContent=focus;meter();return true;
    }
    if(ev.key==='Enter'&&!ev.target?.matches('button')){expose();return true;}
    return false;
  });
  ctx.note('选叠压、断口或层面。横拖泥面换机位，拖动标尺入镜，上下拖动对焦；三张都拍好再封存。');meter();
}

function foil(ctx){
  const scene=createSanctuaryStage(ctx,drawFoil);
  const samples=[
    {name:'甲',kind:'镂空',edge:'边缘成弧，刀口收拢成闭合的细纹。',back:'灯光透入完整的弧孔，孔外的金面仍暗。'},
    {name:'乙',kind:'折痕',edge:'一道暗脊随着掠光反亮，周围金面仍相连。',back:'转到背灯，这一道痕迹没有漏光。'},
    {name:'丙',kind:'缺口',edge:'断缘一路连向试片外侧，呈现参差的折线。',back:'亮隙通到试片的外沿，边界没有闭合。'}
  ];
  const order=ctx.options.variant===1?[1,2,0]:ctx.options.variant===2?[2,0,1]:[0,1,2];
  const tray=order.map((id,i)=>({...samples[id],id,name:['甲','乙','丙'][i]}));
  let index=0,mode='edge',viewed=new Set(),solved=false,angle=0,turned=false,lampPosition=0,drag=null;
  const tabs=document.createElement('div');tabs.className='jss-glass-label';ctx.marks.append(tabs);
  const edge=ctx.button('切至掠射光',()=>observe('edge'));
  const back=ctx.button('切至透射光',()=>observe('back'));
  for(const lamp of [edge,back]){
    lamp.setAttribute('aria-keyshortcuts','V');
    lamp.title='按 V 切换掠射光与透射光';
  }
  const rail=document.createElement('div');
  rail.className='jss-lamp-track';
  const hand=document.createElement('button');hand.type='button';hand.className='jss-lamp-handle';
  hand.textContent='提灯';hand.setAttribute('aria-label','拖动照明灯，从掠射光到透射光');
  rail.append(hand);ctx.marks.append(rail);
  function lampAt(value){
    lampPosition=clamp(value,0,1);hand.style.left='calc('+lampPosition*100+'% + '+(19-38*lampPosition)+'px)';
    const next=lampPosition<.20?'edge':lampPosition>.80?'back':null;
    if(!solved&&next&&next!==mode)observe(next,true,false);
    scene.art.lamp(lampPosition);
  }
  function dragLamp(e){const r=rail.getBoundingClientRect();lampAt((e.clientX-r.left-19)/Math.max(1,r.width-38));}
  ctx.on(hand,'pointerdown',e=>{if(e.button!==0)return;hand.setPointerCapture(e.pointerId);e.preventDefault();});
  ctx.on(hand,'pointermove',e=>{if(hand.hasPointerCapture(e.pointerId))dragLamp(e);});
  ctx.on(hand,'keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();lampAt(lampPosition+(e.key==='ArrowRight'?.12:-.12));}});
  function turn(delta){
    angle=clamp(angle+delta,-1.1,1.1);scene.art.turn(angle);
    if(!solved&&Math.abs(angle)>.31&&!turned){turned=true;ctx.note('边缘的厚薄已看清。把灯沿轨道移到另一端，再判断这片金面。');status();}
  }
  ctx.on(ctx.viewport,'pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input'))return;drag={id:e.pointerId,x:e.clientX};ctx.viewport.setPointerCapture(e.pointerId);
  });
  ctx.on(ctx.viewport,'pointermove',e=>{if(drag?.id===e.pointerId){turn((e.clientX-drag.x)*.012);drag.x=e.clientX;}});
  ctx.on(ctx.viewport,'lostpointercapture',()=>{drag=null;});
  ctx.button('侧转试片',()=>turn(angle>.3?-.74:.74));
  for(const kind of ['镂空','折痕','缺口'])ctx.button('判作'+kind,()=>identify(kind));
  const previous=ctx.button('返回上一片',()=>{
    if(!index||solved)return;index--;viewed=new Set();angle=0;turned=false;scene.art.turn(0);observe('edge');ctx.note('已取回试片'+samples[index].name+'。重新转看、换光后可以更正记录。');
  });
  function status(){
    if(solved)return;
    previous.disabled=index===0;
    ctx.step(!turned?0:viewed.size<2?1:2);
    ctx.read('试片 '+samples[index].name+'　·　'+(turned?'已侧看':'待侧看')+'　·　两种灯位 '+viewed.size+'/2　·　已辨 '+index+'/3');
  }
  function observe(next,announce=true,snap=true){
    mode=next;viewed.add(mode);const sample=tray[index];
    scene.art.inspect(sample.id,mode);edge.setAttribute('aria-pressed',mode==='edge');back.setAttribute('aria-pressed',mode==='back');
    tabs.textContent='实验试片 '+sample.name+'　/　'+(mode==='edge'?'掠射光':'透射光');
    if(snap){lampPosition=mode==='back'?1:0;hand.style.left=lampPosition?'calc(100% - 19px)':'19px';scene.art.lamp(lampPosition);}
    status();
    if(announce)ctx.note(sample[mode]);
  }
  function identify(kind){
    if(solved)return;
    const sample=tray[index];
    if(!turned){ctx.note('先横拖试片或用「侧转试片」看边缘厚薄，再核对两种灯位。');return;}
    if(viewed.size<2){ctx.note('先切换一次灯位，对照反光与透光，再判断金面是否连续。');return;}
    if(kind!==sample.kind){ctx.note(sample.back+' 再看孔缘是否闭合。');ctx.noteTone(1,0,0,.34);return;}
    ctx.noteTone(2,2+index*2,0,.62);index++;
    if(index<3){viewed=new Set();angle=0;turned=false;scene.art.turn(0);observe('edge',false);ctx.note('上一片确认为'+kind+'。换上试片'+samples[index].name+'，横拖从侧面观察，再移动提灯。');return;}
    solved=true;angle=0;scene.art.turn(0);scene.art.inspect(-1,'back');ctx.tools.replaceChildren();tabs.textContent='器物全貌　/　太阳神鸟金饰';
    ctx.read('三种边缘已辨明');ctx.note('重新看整件金饰。相连的金面与镂出的空隙，共同构成四鸟与十二芒。');
    ctx.button('带走透光图版　→',()=>ctx.finish({optics:['镂空','折痕','缺口']}),'jss-primary');
  }
  addKeys(ctx,ev=>{
    if(solved)return false;
    if(ev.key.toLowerCase()==='v'){observe(mode==='edge'?'back':'edge');return true;}
    if(/^[123]$/.test(ev.key)){identify(['镂空','折痕','缺口'][+ev.key-1]);return true;}return false;
  });
  observe('edge',false);ctx.note('横拖金片查看边缘厚薄，再把下方提灯拖到右端。比较两种光下的边界，判断它是镂孔、折痕还是破口。');
}

function court(ctx){
  const scene=createSanctuaryStage(ctx,drawCourt);
  const measured=new Set(),labels=['一','二','三','四','五','六','七','八','九'];
  let first=null,finished=false,drag=null;
  const marks=scene.art.targets.map((p,i)=>{
    const mark=ctx.mark(labels[i],'jss-post');mark.setAttribute('aria-label','柱洞 '+(i+1));mark.dataset.post=i;
    ctx.on(mark,'click',ev=>{if(!ev.detail)select(i);});
    ctx.on(mark,'pointerdown',ev=>{if(ev.button!==0||finished)return;drag={from:i,x:ev.clientX,y:ev.clientY};mark.setPointerCapture(ev.pointerId);});
    ctx.on(mark,'pointermove',ev=>{
      if(!drag||drag.from!==i||!mark.hasPointerCapture(ev.pointerId))return;
      const r=ctx.viewport.getBoundingClientRect(),length=scene.art.pull(i,(ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height);
      if(length!==undefined)ctx.read('放绳　'+length.toFixed(2)+' 米　·　松手落在另一处洞心');
    });
    ctx.on(mark,'pointerup',ev=>{
      if(!drag)return;const start=drag;drag=null;scene.art.pull(null);
      const dest=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-post]');
      if(dest&&+dest.dataset.post!==start.from){first=start.from;select(+dest.dataset.post);}
      else if(Math.hypot(start.x-ev.clientX,start.y-ev.clientY)<14)select(i);
    });
    ctx.on(mark,'pointercancel',()=>{drag=null;scene.art.pull(null);display();});return mark;
  });
  scene.onLayout(project=>scene.art.targets.forEach((p,i)=>place(marks[i],...project(p))));
  const rule=document.createElement('div');rule.className='jss-glass-label';ctx.marks.append(rule);
  function display(){
    rule.textContent='开间 '+(measured.has('long')?'2.90 m':'—')+'　/　进深 '+(measured.has('short')?'1.90 m':'—')+'　/　对角 '+(measured.has('diagonal')?'3.47 m':'—');
    ctx.step(measured.has('long')&&measured.has('short')?2:measured.has('long')?1:0);
    ctx.read('测绳　'+(first===null?'等待落桩':'已定 '+labels[first]+' 号孔')+'　·　'+measured.size+'/3');
    marks.forEach((m,i)=>m.setAttribute('aria-pressed',first===i));
  }
  function select(i){
    if(finished)return;
    scene.art.strike(i);
    if(first===null||first===i){first=first===i?null:i;display();ctx.note(first===null?'已拔桩，请重新选起点。':'绳头已定。选择同一排或前后一排的相邻洞心。');return;}
    const start=first;first=null;
    const a=scene.art.targets[start],b=scene.art.targets[i],dx=Math.abs(a[0]-b[0]),dz=Math.abs(a[2]-b[2]),d=Math.hypot(dx,dz);
    const cross=Math.abs(dx-2.9)<.01&&Math.abs(dz-1.9)<.01;
    const type=dz<.01&&Math.abs(dx-2.9)<.01?'long':dx<.01&&Math.abs(dz-1.9)<.01?'short':cross&&measured.has('long')&&measured.has('short')?'diagonal':null;
    scene.art.baseline(start,i);
    if(type)measured.add(type);
    ctx.note('实测 '+d.toFixed(2)+' 米。'+(type==='long'?'同排相邻的横距已记下。':type==='short'?'两排之间的纵距已记下。':type==='diagonal'?'斜距与长方形两边推得的数值吻合。':'这段跨排或斜穿场地。先分别量出相邻横距和纵距。'));
    ctx.noteTone(type?2:1,type==='long'?4:0,0,.48);display();
    if(measured.size===2)ctx.note('两边已量得。若四个洞心接近直角，单格斜距应约为 3.47 米；拉同一小格的一条对角线复核。');
    if(measured.size===3){finished=true;marks.forEach(m=>m.disabled=true);ctx.read('基址测绘完成 · 对角已复核');
      ctx.note('两条垂直基线给出了柱网尺度。沿建筑西北—东南轴线移步，看冬至日头从哪里升起。');
      ctx.button('沿东南轴线候日　→',()=>ctx.finish({bay:2.9,depth:1.9}),'jss-primary');}
  }
  addKeys(ctx,ev=>{if(/^[1-9]$/.test(ev.key)){select(+ev.key-1);return true;}return false;});
  display();ctx.note('拖绳连接两个洞心，测一段同排的开间和一段跨排的进深。也可依次点击，或按数字 1–9 落桩。');
}
export function mountSanctuary(id,host,options={}){
  const data=sanctuary.find(ch=>ch.id===id);if(!data)throw new Error('Unknown sanctuary '+id);
  if(options.signal?.aborted)return ()=>{};
  const ctx=createView(host,data,options);
  try{({'ivory-record':ivory,'sunfoil':foil,'nine-posts':court})[id](ctx);}
  catch(error){ctx.cleanup();throw error;}
  return ctx.cleanup;
}

export function mountFinale(host,options={}){
  if(options.signal?.aborted)return ()=>{};
  const ctx=createView(host,finale,options);
  try{
    const stage=createSanctuaryStage(ctx,drawFinale);
    const caption=document.createElement('div');caption.className='jss-final-lines';ctx.marks.append(caption);
    const kicker=document.createElement('small'),line=document.createElement('h3');caption.append(kicker,line);
    const reticle=document.createElement('div');reticle.className='jss-sight';reticle.setAttribute('aria-hidden','true');ctx.marks.append(reticle);
    const iris=document.createElement('div');iris.className='jss-iris';ctx.marks.append(iris);
    const point=document.createElement('div');point.className='jss-sun-dot';ctx.marks.append(point);
    let offset=-1.6,begun=false,time=0,act=-1,drag=null,printing=false;
    kicker.textContent='冬至前夜　／　九柱遗迹';line.textContent='站到日出的轴线上';
    ctx.button('向左移步',()=>move(-.4));ctx.button('向右移步',()=>move(.4));
    ctx.button('沿轴候日',align,'jss-primary');
    function update(){
      stage.art.sight(offset);
      const p=stage.project(stage.art.horizon);place(point,...p);
      const near=Math.abs(offset)<.26;
      reticle.classList.toggle('aligned',near);point.classList.toggle('aligned',near);
      ctx.read(near?'准线重合　·　可以候日':'冬至方位　·　东偏南约 27°');
      ctx.note(near?'近处的中列柱位与远处日出方位已在同一直线上。按「沿轴候日」。':offset<0?'日出标在准线右侧。向右移步，让近处柱位与远处晨光重合。':'日出标在准线左侧。向左移步，让近处柱位与远处晨光重合。');
    }
    function move(d){if(begun)return;offset=clamp(offset+d,-2.8,2.8);update();}
    function align(){
      if(begun)return;
      if(Math.abs(offset)>=.26){update();return;}
      begun=true;reticle.remove();point.remove();ctx.tools.replaceChildren();ctx.noteTone(0,-5,0,.6);
      ctx.button('略过镜头，进入展厅',()=>{time=18;screen();});screen();
    }
    function screen(){
      const index=time<4.8?0:time<10?1:time<16?2:3;
      stage.art.seek(time,!!options.reduced);
      const opacity=time<13.8?0:time<14.8?(time-13.8):Math.max(0,1-(time-14.8)/1.25);
      iris.style.opacity=String(opacity);
      if(index===act)return;act=index;
      const shots=[
        ['第一幕　／　土地','晨光穿过九个柱位','洞口的位置与间距来自测绘。这束晨光，取自关于冬至日出方位的一种研究解释。'],
        ['第二幕　／　人的尺度','一座建筑，在光里起身','眼前木构是依据柱网所作的想象复原。它可能曾是高台，也可能有屋顶，确切形制仍待更多证据。'],
        ['第三幕　／　古蜀的太阳','地上的孔，金上的空','空洞记下消失的木柱，镂空勾出永远飞行的鸟。烁羽沿河返回，一路所见在晨光里合拢。'],
        ['终幕　／　今日展厅','金沙：古蜀秘境','展灯亮起。今天，来自金沙的这束光仍照着每一位驻足的人。']
      ];
      kicker.textContent=shots[index][0];line.textContent=shots[index][1];ctx.note(shots[index][2]);ctx.read(index===3?'九处主线遗存　·　踏查完成':'冬至日出　·　'+['河岸实景','建筑推演','金饰转场'][index]);
      ctx.noteTone(index===1?1:2,[0,2,5,7][index],0,.55);ctx.noteTone(0,[0,2,5,7][index]+7,.38,.45);
      if(index===3){
        ctx.tools.replaceChildren();
        const open=ctx.button('进入九站印相台　→',()=>{
          if(printing)return;
          printing=true;stage.holdImage();mountPrintRoom(ctx,ids=>ctx.finish({dawnAligned:true,fieldTriptych:ids}));
        },'jss-primary');
        ctx.note('今天，九处现场的调查记录来到展厅。挑出三幅，亲手印一张留给下一位观众的展签。');
        open.focus({preventScroll:true});
      }
    }
    ctx.on(ctx.viewport,'pointerdown',e=>{if(begun||e.target.closest('button'))return;drag={x:e.clientX,start:offset};ctx.viewport.setPointerCapture(e.pointerId);});
    ctx.on(ctx.viewport,'pointermove',e=>{if(!drag||begun)return;offset=clamp(drag.start+(e.clientX-drag.x)*.012,-2.8,2.8);update();});
    ctx.on(ctx.viewport,'lostpointercapture',()=>{drag=null;});
    addKeys(ctx,e=>{if(begun)return false;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){move(e.key==='ArrowRight'?.4:-.4);return true;}if(e.key==='Enter'&&!e.target?.matches('button')){align();return true;}return false;});
    stage.onLayout(()=>{if(!begun)update();});stage.onFrame((t,dt)=>{if(begun&&!printing&&time<20){time=Math.min(20,time+dt);screen();}});
  }catch(error){ctx.cleanup();throw error;}
  return ctx.cleanup;
}
