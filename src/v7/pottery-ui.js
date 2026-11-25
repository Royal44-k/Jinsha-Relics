import {POTTERY_REFERENCES} from './pottery-state.js';
import './pottery-ui.css';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createPotteryUI({onClose=()=>{},onShape=()=>{},onSmooth=()=>{},onPattern=()=>{},onFire=()=>{},onRemake=()=>{},onOrbit=()=>{},onReference=()=>{},onPick=null,onUndo=()=>{},onStroke=()=>{},onViewWork=()=>{},onCapture=()=>{}}={}){
 const root=document.createElement('section');root.id='v7-pottery';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','pottery-title');
 root.innerHTML=`<div class="pottery-surface" tabindex="0" role="application" aria-label="陶坯塑形区。上下键选择高度，左右键收放器身；按住Shift与方向键转动观察。"></div>
 <header class="pottery-header"><div><span>稻火聚落 · 一件留给后来者的器物</span><h2 id="pottery-title">泥火留形</h2></div><button class="pottery-close" aria-label="收起陶作，返回探索">收起 <kbd>Esc</kbd></button></header>
 <div class="pottery-introduction"><span class="pottery-small-label">从一抔泥开始</span><h3>不必一模一样，<br>让它像你。</h3><p>沿器身横向拖动。<br>往外展开，往内收拢。<br>留一道指痕，也很好。</p><div class="pottery-state" aria-live="polite"></div><div class="pottery-caption" hidden aria-live="polite"><strong></strong><span></span></div></div>
 <div class="pottery-cursor" hidden><i></i><span>指尖所至</span></div>
 <aside class="pottery-tools" aria-label="塑形工具"><div class="pottery-tool-row pottery-mode"><button data-mode="shape" aria-pressed="true">捏形</button><button data-mode="orbit" aria-pressed="false">环看</button><button data-undo aria-label="撤销上一笔，Ctrl加Z">撤销</button></div>
 <div class="pottery-collection" hidden><small>看我的器物</small><div class="pottery-work-list"></div></div>
 <label class="pottery-height-label">指尖高度 <output>55%</output><input type="range" min="5" max="100" value="55" aria-label="选择器身塑形高度"></label>
 <div class="pottery-tool-row pottery-actions"><button data-form="in" aria-label="收拢当前高度的器身">收拢</button><button data-form="smooth">抹平</button><button data-form="out" aria-label="展开当前高度的器身">展开</button></div>
 <fieldset><legend>留一点纹理</legend><div class="pottery-tool-row"><button data-pattern="plain" aria-pressed="true">素泥</button><button data-pattern="ripple" aria-pressed="false">水纹</button><button data-pattern="seed" aria-pressed="false">谷痕</button></div></fieldset>
 <label class="pottery-reference-label">借一条轮廓<select aria-label="可选原创器形灵感"><option value="">自由捏形</option>${POTTERY_REFERENCES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
 <div class="pottery-primary" aria-label="器物操作"><div class="pottery-fire-progress" hidden><span></span><i></i></div><button class="pottery-fire">交给窑火 <span>→</span></button><button class="pottery-remake" hidden>再揉一抔泥</button><button class="pottery-return" hidden>返回当前泥坯</button><button class="pottery-capture" hidden>为它留影 <span>↗</span></button></div>
 <p class="pottery-personal-count"></p></aside>
 <footer class="pottery-footer"><span class="pottery-keyboard">↑ ↓ 选高度 · ← → 收放 · Shift + 方向键环看</span><span>原创器形与纹样 · 制陶主题的艺术演绎</span></footer>`;
 document.body.append(root);const surface=root.querySelector('.pottery-surface'),cursor=root.querySelector('.pottery-cursor'),status=root.querySelector('.pottery-state'),heightInput=root.querySelector('input'),heightOutput=root.querySelector('output'),fire=root.querySelector('.pottery-fire'),remake=root.querySelector('.pottery-remake'),progress=root.querySelector('.pottery-fire-progress'),reference=root.querySelector('select');
 let active=false,snapshot={},bounds=null,selected=.55,mode='shape',drag=null,hover=false,lastFocus=null,lastText='',focusPending=false,workSignature='';
 const changeHeight=value=>{selected=clamp(value,.05,1);heightInput.value=String(Math.round(selected*100));heightOutput.value=Math.round(selected*100)+'%';};
 const editEnabled=()=>active&&!snapshot.displayFired&&!snapshot.fired&&!snapshot.firing;
 function setMode(value){mode=value;root.dataset.mode=value;root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===value)));surface.setAttribute('aria-label',value==='shape'?'陶坯塑形区。上下键选择高度，左右键收放器身。':'转动观察。拖动可环绕，按住Shift和方向键也可环绕。');}
 function finishDrag(e){if(drag&&e?.pointerId!==undefined&&e.pointerId!==drag.id)return;const id=drag?.id;drag=null;if(id!==undefined){onStroke(false);if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);}root.classList.remove('is-touching');}
 const hAt=y=>bounds?clamp((bounds.bottom-y)/Math.max(1,bounds.height),.05,1):selected;
 function isOverPot(e){if(onPick)return !!onPick(e.clientX,e.clientY);return bounds&&Math.abs(e.clientX-bounds.x)<bounds.width*.59&&e.clientY>bounds.y-24&&e.clientY<bounds.bottom+20;}
 surface.addEventListener('pointerdown',e=>{if(!active||snapshot.firing||drag||e.button!==0)return;if(mode==='shape'&&(!editEnabled()||!isOverPot(e)))return;e.preventDefault();surface.focus({preventScroll:true});surface.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,sign:bounds&&e.clientX<bounds.x?-1:1};if(mode==='shape'){onStroke(true);changeHeight(onPick?.(e.clientX,e.clientY)?.height??hAt(e.clientY));drag.heightOffset=selected-hAt(e.clientY);}root.classList.add('is-touching');});
 surface.addEventListener('pointermove',e=>{hover=isOverPot(e);if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(mode==='orbit')onOrbit(-dx*.008,dy*.002);else{changeHeight(hAt(e.clientY)+(drag.heightOffset||0));onShape(selected,dx*drag.sign/Math.max(bounds?.height||200,140)*.9);}drag.x=e.clientX;drag.y=e.clientY;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,finishDrag);
 surface.addEventListener('pointerleave',()=>{hover=false;});
 root.querySelector('.pottery-close').onclick=()=>onClose();
 root.querySelector('[data-undo]').onclick=()=>{finishDrag();onUndo();};
 root.querySelector('.pottery-return').onclick=()=>{onViewWork(null);setMode(snapshot.fired?'orbit':'shape');};
 root.querySelector('.pottery-capture').onclick=()=>onCapture({name:snapshot.displayName||snapshot.name,workIndex:snapshot.viewingWork??null});
 root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
 root.querySelectorAll('[data-form]').forEach(button=>button.onclick=()=>{if(!editEnabled())return;if(button.dataset.form==='smooth')onSmooth(selected);else onShape(selected,button.dataset.form==='in'?-.035:.035);});
 root.querySelectorAll('[data-pattern]').forEach(button=>button.onclick=()=>{if(editEnabled())onPattern(button.dataset.pattern);});
 heightInput.oninput=()=>changeHeight(Number(heightInput.value)/100);reference.onchange=()=>onReference(reference.value);fire.onclick=()=>{finishDrag();onFire();};remake.onclick=()=>{onRemake();setMode('shape');};
 function keydown(e){if(!active)return;if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();finishDrag();onClose();return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.stopImmediatePropagation();finishDrag();onUndo();return;}
  if(e.code==='Tab'){const items=[...root.querySelectorAll('button:not(:disabled):not([hidden]),select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),i=items.indexOf(document.activeElement);if(i<0||(e.shiftKey&&i===0)||(!e.shiftKey&&i===items.length-1)){e.preventDefault();(e.shiftKey?items.at(-1):items[0])?.focus();}return;}
  if(e.target.matches('select,input'))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();
   if(e.shiftKey||mode==='orbit'){onOrbit(e.code==='ArrowLeft'?-.09:e.code==='ArrowRight'?.09:0,e.code==='ArrowUp'?-.035:e.code==='ArrowDown'?.035:0);}
   else if(editEnabled()){if(e.code==='ArrowUp'||e.code==='ArrowDown')changeHeight(selected+(e.code==='ArrowUp'?.055:-.055));else onShape(selected,e.code==='ArrowLeft'?-.024:.024);}hover=true;
  }
 }
 window.addEventListener('keydown',keydown,true);const blur=()=>finishDrag();window.addEventListener('blur',blur);
 function update(value={},screenBounds){snapshot=value;if(screenBounds)bounds=screenBounds;if(!active)return;const viewed=value.viewingWork!==null&&value.viewingWork!==undefined,isFired=value.displayFired??value.fired;root.classList.toggle('is-firing',!!value.firing);root.classList.toggle('is-fired',!!isFired);root.classList.toggle('is-viewing-work',viewed);
  const text=value.firing?(value.heat<.3?'湿泥渐干，等一等火色。':value.heat<.72?'火色在器身上慢慢行走。':'余温落下，指痕留了下来。'):viewed?`回看第 ${value.totalMade-(value.works?.length||0)+value.viewingWork+1} 件「${value.displayName}」；当前泥坯已为你留好。`:isFired?`你的「${value.displayName||value.name}」留在了陶案上。`:'没有标准答案，手指留下的就是你的器形。';if(text!==lastText){status.textContent=text;lastText=text;root.querySelector('.pottery-introduction h3').innerHTML=isFired?'一件器物，<br>记住一双手。':'不必一模一样，<br>让它像你。';root.querySelector('.pottery-introduction p').innerHTML=isFired?'拖动，慢慢环看。<br>收起后，它还会留在这里。<br>为它留一张光影。':'沿器身横向拖动。<br>往外展开，往内收拢。<br>留一道指痕，也很好。';}
  root.querySelectorAll('[data-form],[data-pattern],input,select').forEach(b=>b.disabled=!!isFired||!!value.firing);root.querySelector('[data-mode="shape"]').disabled=!!isFired||!!value.firing;root.querySelector('[data-mode="orbit"]').disabled=!!value.firing;
  root.querySelectorAll('[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pattern===(value.displayPattern||value.pattern))));
  root.querySelector('[data-undo]').disabled=!value.canUndo;
  fire.hidden=!!isFired||!!value.firing;remake.hidden=!value.fired||viewed;root.querySelector('.pottery-return').hidden=!viewed;root.querySelector('.pottery-return').textContent=value.fired?'返回当前器物':'返回当前泥坯';root.querySelector('.pottery-capture').hidden=!isFired||!!value.firing;progress.hidden=!value.firing;if(value.firing){progress.querySelector('span').textContent=Math.round(value.heat*100)+'% · 窑火留形';progress.querySelector('i').style.transform=`scaleX(${value.heat})`;}
  root.querySelector('.pottery-personal-count').textContent=value.totalMade?`已留下 ${value.totalMade} 件 · 最近三件摆在陶案`:'作品与泥坯会自动保存在这段旅程中';
  const collection=root.querySelector('.pottery-collection'),list=root.querySelector('.pottery-work-list'),count=value.works?.length||0;collection.hidden=!count;const sig=count+':'+value.totalMade;if(sig!==workSignature){list.replaceChildren();for(let i=0;i<count;i++){const button=document.createElement('button'),number=value.totalMade-count+i+1;button.textContent=String(number).padStart(2,'0');button.dataset.work=String(i);button.setAttribute('aria-label','回看第'+number+'件器物');button.onclick=()=>{finishDrag();onViewWork(i);setMode('orbit');};list.append(button);}workSignature=sig;}list.querySelectorAll('button').forEach(b=>{b.disabled=!!value.firing;b.setAttribute('aria-pressed',String(viewed&&Number(b.dataset.work)===value.viewingWork));});
  if(isFired&&mode==='shape')setMode('orbit');if(reference.value!==(value.reference||''))reference.value=value.reference||'';
  cursor.hidden=!bounds||!editEnabled()||mode!=='shape'||!hover&&!drag;if(!cursor.hidden){cursor.style.left=bounds.x+'px';cursor.style.top=(bounds.bottom-selected*bounds.height)+'px';cursor.style.width=Math.min(240,bounds.width)+'px';}
  if(focusPending){surface.focus({preventScroll:true});focusPending=false;}
 }
 const caption=root.querySelector('.pottery-caption');
 return {open(value){if(!active)lastFocus=document.activeElement;active=true;root.hidden=false;document.body.classList.add('pottery-active');setMode(value?.fired?'orbit':'shape');focusPending=true;update(value||{});},close(){active=false;root.hidden=true;finishDrag();hover=false;caption.hidden=true;document.body.classList.remove('pottery-active');lastFocus?.focus?.({preventScroll:true});},setCaption({speaker='',text=''}={}){caption.hidden=!text;caption.querySelector('strong').textContent=speaker;caption.querySelector('span').textContent=text;},update,active:()=>active,dispose(){finishDrag();window.removeEventListener('keydown',keydown,true);window.removeEventListener('blur',blur);root.remove();document.body.classList.remove('pottery-active');}};
}
