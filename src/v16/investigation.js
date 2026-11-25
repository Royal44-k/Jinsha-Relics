import {cases} from './investigation-cases.js';
import {bindTouchButtons} from '../v12/touch-buttons.js';
import './investigation.css';

const memory=new Map();
const letters=['甲','乙','丙'];
const plate=id=>'/assets/v11/collections/'+id+'.webp';
const pairKey=slots=>slots.slice().sort().join('');
function element(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text)node.textContent=text;
  return node;
}
function button(label,cls,action){
  const node=element('button',cls,label);
  node.type='button';node.onclick=action;return node;
}
function read(key){
  if(memory.has(key))return memory.get(key);
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}
function write(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));memory.delete(key);return true;}
  catch{memory.set(key,value);return false;}
}
const indexes=value=>Array.isArray(value)?[...new Set(value.filter(i=>Number.isInteger(i)&&i>=0&&i<3))]:[];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function openInvestigation({completedCount=0,storageKey,photos=[],sound=()=>{}}={}){
  const previous=document.querySelector('dialog.investigation-desk[open]');
  if(previous){previous.focus();return;}
  const scope=storageKey||'jinsha-evidence-desk-v16';
  const opener=document.activeElement,dialog=element('dialog','investigation-desk');
  const mount=element('div','iv-mount');
  dialog.setAttribute('aria-label','证据推理台');dialog.append(mount);
  const life=new AbortController(),signal=life.signal;
  bindTouchButtons(dialog,(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal}),'button');
  let active=null,seen=[],slots=[],index=0,dragGhost=null,notice='',finished=null,localOnly=false;
  function clearDrag(){dragGhost?.remove();dragGhost=null;dialog.classList.remove('iv-dragging');}
  dialog.addEventListener('close',()=>{
    life.abort();clearDrag();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});
  },{once:true});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();dialog.close();}
    event.stopPropagation();
  });
  document.body.append(dialog);dialog.showModal();
  const played=(entry,pair)=>read(scope+'.'+entry.id+'.sealed.'+pair)===true;
  const completed=entry=>Object.keys(entry.results).filter(pair=>played(entry,pair)).length;
  function saveDraft(){
    localOnly=!write(scope+'.'+active.id+'.draft',{seen,slots,index});
  }
  function clear(){
    clearDrag();mount.replaceChildren();dialog.scrollTop=0;
  }
  function header(inner){
    const bar=element('header','iv-bar');
    bar.append(inner?button('‹ 案卷目录','iv-back',home):element('span','iv-brand','金沙 · 田野手册'));
    bar.append(button('返回图鉴 ×','iv-exit',()=>dialog.close()));mount.append(bar);
  }
  function home(){
    releaseGlass?.();clear();active=null;finished=null;header(false);
    const title=element('section','iv-title');
    title.append(element('h2','', '证据推理台'),element('p','','挑两份现场记录，写下它们共同支持的一句话。'));
    const shelf=element('div','iv-shelf');
    for(const entry of cases){
      const unlocked=completedCount>=entry.need;
      const card=button('','iv-case',()=>enter(entry));
      card.disabled=!unlocked;
      const pic=element('img','');pic.src=plate(unlocked?entry.cover:'layer');pic.alt='';
      const meta=element('span','iv-case-copy');
      meta.append(element('small','',unlocked?entry.place:'归档 '+entry.need+' 站后开放'),
        element('strong','',unlocked?entry.name:'待揭卷'),element('span','iv-case-count',unlocked?'已收录 '+completed(entry)+' / 3 条研判':''));
      card.append(pic,meta);shelf.append(card);
    }
    mount.append(title,shelf);mount.querySelector('.iv-case:enabled')?.focus({preventScroll:true});
  }
  function enter(entry){
    active=entry;const old=read(scope+'.'+entry.id+'.draft');
    seen=indexes(old?.seen);slots=indexes(old?.slots).filter(n=>seen.includes(n)).slice(0,2);
    index=indexes([old?.index])[0]??0;
    finished=null;notice='';board(true);
  }
  function tag(text){return element('span','iv-label',text);}
  function choose(i){
    index=i;notice='';saveDraft();board();
    mount.querySelector('[data-specimen="'+i+'"]')?.focus({preventScroll:true});
  }
  function assign(i,target){
    if(!seen.includes(i))return;
    if(slots.includes(i)){
      if(target!==undefined&&target<slots.length&&slots[target]!==i)slots.reverse();
      else if(target===undefined)slots=slots.filter(n=>n!==i);
    }else if(target!==undefined&&target<slots.length)slots.splice(target,1,i);
    else if(slots.length<2)slots.push(i);
    else{notice='记录夹已满。请先取下其中一份，或将新笔记拖到要替换的位置。';panel();return;}
    notice='';saveDraft();sound('perch',.26);panel();
  }
  function acquisition(){
    const section=element('section','iv-inspection'),samples=active.samples;
    section.setAttribute('aria-label','标本检视');
    const selectors=element('div','iv-tabs');
    for(const [i,s] of samples.entries()){
      const b=button('','iv-tab',()=>choose(i));
      b.dataset.specimen=i;b.setAttribute('aria-pressed',String(i===index));
      b.append(tag(letters[i]),element('span','',s.name),element('small','',seen.includes(i)?'已摘录':'待观察'));
      selectors.append(b);
    }
    const s=samples[index];
    const optical=element('div','iv-optical');
    const glass=element('div','iv-plate'),photo=element('img',''),target=element('i','iv-target'),lens=element('div','iv-lens');
    photo.src=plate(s.plate);photo.alt=s.name+'的教学图版';photo.draggable=false;
    glass.tabIndex=0;glass.setAttribute('role','group');
    glass.setAttribute('aria-label','移动观察镜，方向键微调，Home 键对中定位圈');
    const lensPhoto=element('img','');lensPhoto.alt='';lensPhoto.src=photo.src;lensPhoto.draggable=false;
    lens.append(lensPhoto);glass.append(photo,target,lens);
    target.style.left=100*s.x+'%';target.style.top=100*s.y+'%';
    const details=element('div','iv-readout');
    const meta=element('div','iv-plate-meta');
    meta.append(tag('图版 '+letters[index]),element('span','iv-mag','局部放大 × 2.2'));
    const observed=seen.includes(index);
    const field=element('p','iv-finding',observed?s.reading:'拖动镜心至虚线定位圈，查看这一处留下的痕迹。');
    const action=button(observed?'已摘录':'摘录观察','iv-record',()=>{
      if(!aligned||seen.includes(index))return;
      seen.push(index);saveDraft();action.disabled=true;action.textContent='已摘录';sound('perch',.33);
      selectors.children[index].querySelector('small').textContent='已摘录';
      panel();mount.querySelector('[data-note="'+index+'"]')?.focus({preventScroll:true});
    });
    action.dataset.action='record';action.disabled=true;
    const align=button('镜头对中','iv-align',()=>move(s.x,s.y));
    align.title='辅助对准标记，也可用方向键微调';
    const tools=element('div','iv-tools');tools.append(action,align);
    let px=observed?s.x:.18,py=observed?s.y:.77,aligned=false;
    function move(x,y){
      px=clamp(x,.04,.96);py=clamp(y,.04,.96);
      aligned=Math.hypot(px-s.x,py-s.y)<.12;
      glass.classList.toggle('iv-aligned',aligned);
      lens.style.left=px*100+'%';lens.style.top=py*100+'%';
      const size=glass.clientWidth||300;
      lensPhoto.style.width=size*2.2+'px';
      lensPhoto.style.left='calc(50% - '+px*size*2.2+'px)';
      lensPhoto.style.top='calc(50% - '+py*size*2.2+'px)';
      field.textContent=aligned||observed?s.reading:'拖动镜心至虚线定位圈，查看这一处留下的痕迹。';
      action.disabled=!aligned||observed||seen.includes(index);
    }
    function moveEvent(e){
      const r=glass.getBoundingClientRect();move((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
    }
    glass.onpointerdown=e=>{if(e.button!==0)return;glass.setPointerCapture(e.pointerId);moveEvent(e);};
    glass.onpointermove=e=>{if(glass.hasPointerCapture(e.pointerId))moveEvent(e);};
    glass.onkeydown=e=>{
      const nav={ArrowRight:[.045,0],ArrowLeft:[-.045,0],ArrowUp:[0,-.045],ArrowDown:[0,.045]};
      if(nav[e.key]){e.preventDefault();move(px+nav[e.key][0],py+nav[e.key][1]);}
      if(e.key==='Home'){e.preventDefault();move(s.x,s.y);}
    };
    const caption=element('small','iv-caption','教学图版 · 局部观察');
    details.append(meta,element('h4','',s.name),field,tools,caption);
    if(active.id==='horizon'&&s.plate==='ivory'&&typeof photos[0]==='string'&&/^data:image\/jpeg;base64,/.test(photos[0])){
      const film=element('details','iv-film'),thumb=element('img','');
      thumb.src=photos[0];thumb.alt='你在象牙现场保存的第一张原位底片';
      film.append(element('summary','','对照这卷的原位底片'),thumb);details.append(film);
    }
    optical.append(glass,details);section.append(selectors,optical);
    requestAnimationFrame(()=>{if(glass.isConnected)move(px,py);});
    const resize=()=>{if(glass.isConnected)move(px,py);};
    const observer=new ResizeObserver(resize);observer.observe(glass);
    releaseGlass=()=>observer.disconnect();
    return section;
  }
  let releaseGlass;
  dialog.addEventListener('close',()=>releaseGlass?.(),{once:true});
  function board(newCase=false){
    releaseGlass?.();clear();header(true);
    const heading=element('div','iv-case-head');
    const h=element('h3','',active.name);h.tabIndex=-1;
    heading.append(tag(active.place),h,element('p','',active.question));
    mount.append(heading,acquisition(),element('section','iv-notebook'));panel();
    if(completed(active)){
      const history=element('details','iv-history');
      history.append(element('summary','','翻看本卷已收录的研判（'+completed(active)+'）'));
      for(const [pair,result] of Object.entries(active.results)){
        if(played(active,pair))history.append(button(result.claim,'',()=>{finished=pair;report();}));
      }
      mount.append(history);
    }
    if(newCase)h.focus({preventScroll:true});
  }
  function bindNote(b,i){
    let origin=null,moved=false;
    b.onpointerdown=e=>{if(e.button!==0)return;moved=false;origin=[e.clientX,e.clientY];b.setPointerCapture(e.pointerId);};
    b.onpointermove=e=>{
      if(!origin||!b.hasPointerCapture(e.pointerId))return;
      if(!moved&&Math.hypot(e.clientX-origin[0],e.clientY-origin[1])<6)return;
      moved=true;
      if(!dragGhost){dragGhost=element('div','iv-ghost',active.samples[i].name);dialog.append(dragGhost);dialog.classList.add('iv-dragging');}
      dragGhost.style.left=e.clientX+'px';dragGhost.style.top=e.clientY+'px';
    };
    b.onpointerup=e=>{
      if(!origin)return;
      origin=null;clearDrag();
      const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');
      if(moved&&hit){assign(i,Number(hit.dataset.slot));}
    };
    b.onpointercancel=()=>{origin=null;clearDrag();};
    b.onclick=e=>{if(!moved||e.detail===0)assign(i);moved=false;};
  }
  function panel(){
    const notebook=mount.querySelector('.iv-notebook');if(!notebook)return;
    const hadFocus=notebook.contains(document.activeElement);
    const noteId=hadFocus?document.activeElement?.dataset?.note:null;
    notebook.replaceChildren();notebook.setAttribute('aria-label','证据记录夹');
    const notes=element('div','iv-notes'),clampRack=element('div','iv-clamps');
    const heading=element('div','iv-panel-head');
    heading.append(element('h4','','证据记录夹'),element('small','','将两份笔记拖入夹位，也可点选放入'));
    notebook.append(heading);
    if(!seen.length)notes.append(element('span','iv-empty','先在图版上摘录观察。'));
    for(const i of seen){
      const s=active.samples[i],b=button(s.name,'iv-note',()=>assign(i));
      b.dataset.note=i;b.setAttribute('aria-pressed',String(slots.includes(i)));bindNote(b,i);notes.append(b);
    }
    for(let n=0;n<2;n++){
      const i=slots[n],d=button('','iv-slot',()=>{if(i!==undefined)assign(i);});
      d.dataset.slot=n;d.setAttribute('aria-label',i===undefined?'空夹位 '+(n+1):'取下'+active.samples[i].name);
      d.append(tag('夹位 '+(n+1)),element('strong','',i===undefined?'放入笔记':active.samples[i].name));
      if(i!==undefined)d.append(element('small','','取下 ×'));clampRack.append(d);
    }
    notebook.append(notes,clampRack);
    if(slots.length===2){
      const pair=pairKey(slots),choices=element('div','iv-claims');
      choices.append(element('h4','','这两份记录共同支持哪句话？'));
      const keys=Object.keys(active.results);
      const distractor=keys[(keys.indexOf(pair)+1)%keys.length];
      const list=[{k:pair,t:active.results[pair].claim},{k:distractor,t:active.results[distractor].claim},{k:null,t:active.unsupported}];
      const pivot=(keys.indexOf(pair)+cases.indexOf(active)+1)%3;
      for(const candidate of [...list.slice(pivot),...list.slice(0,pivot)]){
        choices.append(button(candidate.t,'iv-claim',()=>{
          if(candidate.k===pair){
            localOnly=!write(scope+'.'+active.id+'.sealed.'+pair,true);
            finished=pair;sound('arrive',.50);report();return;
          }
          notice=candidate.k?'这句话还用到了「'+active.samples[[...candidate.k].map(Number).find(i=>!slots.includes(i))].name+'」的观察。请换一份笔记，或再读一次当前两份。':active.results[pair].limit;
          feedback.textContent=notice;feedback.focus({preventScroll:true});
        }));
      }
      notebook.append(choices);
    }
    const feedback=element('p','iv-feedback',notice);feedback.setAttribute('role','status');feedback.tabIndex=-1;notebook.append(feedback);
    if(noteId!==null&&noteId!==undefined)notes.querySelector('[data-note="'+noteId+'"]')?.focus({preventScroll:true});
  }
  function report(){
    releaseGlass?.();clear();header(true);
    const result=active.results[finished],sheet=element('article','iv-report');
    const heading=element('h2','',result.claim);heading.tabIndex=-1;
    const strip=element('div','iv-strip');
    for(const n of finished){
      const s=active.samples[Number(n)],f=element('figure',''),img=element('img','');img.src=plate(s.plate);img.alt=s.name;
      f.append(img,element('figcaption','',s.name));strip.append(f);
    }
    sheet.append(tag(active.place+'　／　'+(localOnly?'本页已记下':'研判已入卷')),heading,strip,
      element('p','',result.because),element('p','iv-limit','证据的边界　'+result.limit));
    const buttons=element('div','iv-report-actions');
    buttons.append(button('换一组证据','iv-record',()=>{slots=[];notice='';finished=null;saveDraft();board(true);}),
      button('回到案卷目录','iv-back',home));
    sheet.append(buttons);mount.append(sheet);heading.focus({preventScroll:true});
  }
  home();
}
