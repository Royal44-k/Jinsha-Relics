import {fieldTime,onFieldHoldChange,reviewPaused} from '../v13/review-clock.js';
import {bindTouchButtons} from '../v12/touch-buttons.js';
import './workshops.css';
import {taskSteps} from '../v11/task-steps.js';
import {makeStudio} from './workshop-scene.js';
import {cutJade,fitClay,readBronze} from './workshop-actions.js';

export const workshops = [
  {
    id:'jade-cut', title:'砂行成隙', site:'滨岸治玉作坊',
    prologue:'一根软绳，怎么能切开这么硬的玉？你看锯缝里，还粘着湿砂。把绳拉起来，手上就能觉出差别了。',
    objective:'润湿切口，让负砂的绳子往复拉过玉料，直到沿切线分开。',
    reward:'玉口规', transition:'切开后的玉片磨出一道圆弧。拿这把口规去陶作台，或许能认出残器缺失的口沿。'
  },
  {
    id:'clay-fit', title:'合为一器', site:'陶作修复架',
    prologue:'这几块陶片，以前也许挨得很近。先用口规比一比弧度，再把断口对着光，慢慢转。',
    objective:'调出口沿的直径，旋转三块陶片，再沿各自的断口归位。',
    reward:'复原陶托', transition:'三片陶合成一个稳固的底座。烁羽把它带到铜鸟支护台，要在上面架起两处支点，托住铜鸟的胸腹。'
  },
  {
    id:'bronze-shadow', title:'轻放一只铜鸟', site:'铜鸟支护台',
    prologue:'铜鸟的尾巴比看上去薄。先别松手，把陶托移到鸟身底下，再慢慢放。看看重量最后落在哪里。',
    objective:'把两只支托分别移到厚实的胸腹下方，缓降试托。观察倾斜的方向，调整支点。',
    reward:'铜鸟支护图', transition:'托稳一只铜鸟，还能从多个方向观察。可西岸象牙一旦挪动，彼此叠压的位置就会永远改变。先去保护棚，在原位留下三张照片。'
  }
];

const studios = {
  'jade-cut': {build:cutJade, eye:[5.3,4.1,1.0],look:[0,.58,0],width:5.6,portraitWidth:4.75,height:3.65,fog:0x302e28,sky:0xffeacd,floor:0x574532,key:0xffe8ca,rim:0x9bbfac},
  'clay-fit': {build:fitClay, eye:[0,3.5,8.5],look:[0,1.43,0],width:7.4,portraitWidth:6.45,height:3.9,fog:0x39342e,sky:0xffe7cd,floor:0x72574a,key:0xffe2b4,rim:0xc9d2c5},
  'bronze-shadow': {build:readBronze, eye:[0,2.16,7.8],look:[0,1.42,0],width:5.4,portraitWidth:4.15,height:3.35,fog:0x262d29,sky:0xe3efdd,floor:0x534b3d,key:0xffdf9c,rim:0x9dd8c5}
};

export function mountWorkshops(id,host,{complete,signal,sound,variant=0}={}) {
  const preset=studios[id],entry=workshops.find(row=>row.id===id);
  if(!preset) throw new Error('Unknown workshop ' + id);
  if(signal?.aborted)return ()=>{};
  const root=document.createElement('section'),life=new AbortController();
  root.className='js-at js-at-'+id;
  root.setAttribute('aria-label',entry.site+' · '+entry.title);
  root.innerHTML='<div class="at-stage"><div class="at-view"></div><div class="at-overlay"></div><div class="at-readout" aria-hidden="true"></div></div><aside class="at-panel"><header><p class="at-site"></p><h2></h2></header><p class="at-objective"></p><div class="at-instruments"></div><p class="at-feedback" role="status" aria-live="polite"></p><div class="at-controls"></div><p class="at-shortcuts"></p></aside>';
  host.append(root);
  const $=name=>root.querySelector(name),view=$('.at-view'),stage=$('.at-stage'),overlay=$('.at-overlay');
  $('.at-site').textContent=entry.site;
  $('h2').textContent=entry.title;
  $('.at-objective').textContent=entry.objective;
  const steps={
    'jade-cut':['试绳','砂水锯切','验看切面'],
    'clay-fit':['量口','旋转合缝','检查修复'],
    'bronze-shadow':['察看薄尾','调整双托','缓降低放']
  };
  const step=taskSteps($('.at-panel header'),steps[id]);
  const controls=$('.at-controls'),feedback=$('.at-feedback'),readout=$('.at-readout');
  let studio,observer,disposed=false,won=false,frame=0,motion=0,action;
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers=new Set();
  function after(fn,ms) {
    const deadline=fieldTime()+ms,listener=new AbortController();
    let timer;
    function cancel(){
      clearTimeout(timer);listener.abort();timers.delete(cancel);
    }
    function schedule(){
      clearTimeout(timer);
      if(!reviewPaused())timer=setTimeout(()=>{
        cancel();if(!disposed)fn();
      },Math.max(0,deadline-fieldTime()));
    }
    timers.add(cancel);onFieldHoldChange(schedule,listener.signal);schedule();
  }
  function listen(target,event,fn,options={}) {
    target.addEventListener(event,fn,{...options,signal:life.signal});
  }
  bindTouchButtons(root,listen,'.at-controls button,.at-tail-tag');
  function redraw(){
    if(disposed||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;studio?.render(true);action?.layout?.();});
  }
  function animate(milliseconds,draw){
    if(motion)cancelAnimationFrame(motion);
    if(still||milliseconds<=0){draw(1);redraw();return;}
    const start=fieldTime();
    function advance(now){
      if(disposed)return;
      if(reviewPaused()){motion=requestAnimationFrame(advance);return;}
      const t=Math.max(0,Math.min(1,(fieldTime(now)-start)/milliseconds));
      draw(t);redraw();motion=t===1?0:requestAnimationFrame(advance);
    }
    advance(performance.now());
  }
  function button(label,fn,opts={}){
    const el=document.createElement('button');el.type='button';el.textContent=label;
    if(opts.primary)el.classList.add('at-primary');
    if(opts.name)el.dataset.action=opts.name;
    if(opts.title)el.title=opts.title;
    controls.append(el);listen(el,'click',()=>{if(!won&&!disposed)fn();});return el;
  }
  function message(text) {if(feedback.textContent!==text)feedback.textContent=text;}
  function finish(text,delay=850){
    if(won||disposed)return;
    won=true;root.classList.add('at-solved');message(text);
    for(const el of controls.querySelectorAll('button'))el.disabled=true;
    after(()=>complete?.(),delay);
  }
  function cleanup(){
    if(disposed)return;
    disposed=true;life.abort();timers.forEach(cancel=>cancel());
    if(frame)cancelAnimationFrame(frame);if(motion)cancelAnimationFrame(motion);
    observer?.disconnect();action?.dispose?.();studio?.dispose();root.remove();
    signal?.removeEventListener('abort',cleanup);
  }
  signal?.addEventListener('abort',cleanup,{once:true});
  try{
    studio=makeStudio(view,{...preset,label:entry.site+'三维操作台'});
    const context={root,view,stage,studio,overlay,controls,readout,instruments:$('.at-instruments'),shortcuts:$('.at-shortcuts'),listen,redraw,animate,after,button,message,finish,step,variant,
      sound:(name,strength=1)=>sound?.(name,strength),enabled:()=>!won&&!disposed};
    action=preset.build(context);
    listen(root,'keydown',event=>{
      if(!context.enabled()||event.altKey||event.metaKey||event.ctrlKey)return;
      if(event.code==='Space'&&event.target.tagName==='BUTTON')return;
      if(event.code==='Enter'&&event.target.tagName==='BUTTON')return;
      if(action.key?.(event)){event.preventDefault();event.stopPropagation();}
    });
    observer=new ResizeObserver(redraw);observer.observe(view);studio.render(true);action.layout?.();
    studio.canvas.focus({preventScroll:true});
  }catch(e){cleanup();throw e;}
  return cleanup;
}
