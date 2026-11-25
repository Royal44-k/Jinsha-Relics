import {Vector3} from 'three';
import {perchGuidance} from './action-intent.js';
import './motion-ui.css';

/** State-driven controls; no independent movement or landing eligibility rules. */
export function createMotionUI({onCruise,onDash,onPerch,onQuick}={}){
 const hud=document.getElementById('hud'),touch=document.querySelector('.touch-actions');
 const root=document.createElement('div');root.id='v8-motion';root.hidden=true;
 root.innerHTML='<div class="v8-action-strip"><button data-v8="quick" aria-pressed="false"><kbd>Shift</kbd><span>快走</span></button><button data-v8="dash"><kbd>X</kbd><span>闪身</span><i></i></button><button data-v8="cruise" aria-pressed="false"><kbd>V</kbd><span>持续飞行</span></button><button data-v8="perch"><kbd>R</kbd><span>停栖</span></button></div><button class="v8-branch" hidden><span class="v8-branch-mark">⌁</span><span><strong></strong><small></small></span></button>';
 hud.appendChild(root);
 const events={quick:onQuick,dash:onDash,cruise:onCruise,perch:onPerch},buttons={};
 for(const [key,callback]of Object.entries(events)){
  const desktop=root.querySelector('[data-v8="'+key+'"]');desktop.onclick=e=>{callback?.();if(e.detail>0)document.querySelector('#scene canvas')?.focus({preventScroll:true});};
  const mobile=document.createElement('button');mobile.id='touch-'+key;mobile.textContent=({quick:'快走',dash:'闪身',cruise:'续飞',perch:'停栖'})[key];mobile.setAttribute('aria-label',({quick:'切换快走',dash:'短距闪身',cruise:'切换持续飞行',perch:'停栖或离枝'})[key]);mobile.onclick=e=>{callback?.();if(e.detail>0)document.querySelector('#scene canvas')?.focus({preventScroll:true});};touch.appendChild(mobile);buttons[key]=[desktop,mobile];
 }
 const branch=root.querySelector('.v8-branch'),title=branch.querySelector('strong'),detail=branch.querySelector('small'),projected=new Vector3();
 branch.onclick=e=>{onPerch?.();if(e.detail>0)document.querySelector('#scene canvas')?.focus({preventScroll:true});};
 const attr=(el,key,value)=>{if(el.getAttribute(key)!==value)el.setAttribute(key,value);};
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function update({motion,perch,playing,quick=false,cinematic=false,camera,width,height}){
  root.hidden=!playing;if(!playing){branch.hidden=true;return;}
  const cooled=(motion.dashCooldown||0)<=.001,cruise=!!motion.cruise;
  const quickLabel=['swimming','diving'].includes(motion.mode)?'快游':['flying','gliding','rising','falling'].includes(motion.mode)?'疾飞':'快走';
  for(const el of buttons.quick){attr(el,'aria-pressed',String(quick||motion.gait==='quick'));text(el.querySelector('span')||el,quickLabel);attr(el,'aria-label','切换'+quickLabel);}
  for(const el of buttons.cruise)attr(el,'aria-pressed',String(cruise));
  for(const el of buttons.dash){el.disabled=!cooled;el.style.setProperty('--recharge',String(Math.max(0,Math.min(1,1-(motion.dashCooldown||0)/1.1))));}
  const hint=perchGuidance(perch?.distance<=12?perch:null,motion);branch.hidden=!hint||motion.grounded||cinematic;
  for(const el of buttons.perch){el.disabled=!hint;text(el.querySelector('span')||el,motion.mode==='perched'?'离枝':'停栖');}
  if(hint){
   text(title,hint.title);text(detail,hint.detail);branch.dataset.ready=String(hint.ready);
   const p=perch?.position;
   if(p&&camera){projected.set(p.x??p[0],p.y??p[1],p.z??p[2]).project(camera);const onscreen=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.88&&Math.abs(projected.y)<.70;
    branch.dataset.projected=String(onscreen);branch.style.left=onscreen?Math.max(120,Math.min(width-120,(projected.x+1)*width/2+(projected.x>.25?-160:160)))+'px':'50%';branch.style.top=onscreen?Math.max(120,(1-projected.y)*height/2-90)+'px':'';
   }else{branch.dataset.projected='false';branch.style.left='50%';branch.style.top='';}
  }

 }
 return {update,dispose(){root.remove();for(const pair of Object.values(buttons))pair[1].remove();}};
}
