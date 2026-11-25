import {Vector3} from 'three';

// The surveyed lateral root runs from its narrow exposed end toward the root crown.
export function rootTrace(ctx,canvas,camera,onSample) {
  const local=[new Vector3(1.71,.22,-.19),new Vector3(1.11,.34,-.11),new Vector3(.38,.44,-.04)];
  const projected=local.map(()=>({x:0,y:0})),v=new Vector3();
  const line=document.createElementNS('http://www.w3.org/2000/svg','svg');
  line.classList.add('fw-core-path');const path=document.createElementNS(line.namespaceURI,'polyline');
  line.append(path);
  const knob=document.createElement('button');knob.type='button';knob.className='fw-core-grip';knob.setAttribute('aria-label','沿侧根拖动取样环');
  const end=document.createElement('span');end.className='fw-core-end';end.textContent='根盘';
  let progress=0,held=null,finished=false;
  function locate(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    line.setAttribute('viewBox','0 0 '+w+' '+h);
    for(const [i,pos] of local.entries()){
      v.copy(pos).project(camera);projected[i].x=(1+v.x)*w/2;projected[i].y=(1-v.y)*h/2;
    }
    path.setAttribute('points',projected.map(p=>p.x+','+p.y).join(' '));
    const [a,b,c]=projected,from=progress<.5?a:b,to=progress<.5?b:c,t=progress<.5?progress*2:(progress-.5)*2;
    knob.style.left=(from.x+(to.x-from.x)*t)+'px';knob.style.top=(from.y+(to.y-from.y)*t)+'px';
    end.style.left=c.x+'px';end.style.top=c.y+'px';knob.textContent=progress>0?Math.round(progress*100)+'%':'取样环';
  }
  function advance(value){
    progress=Math.min(1,Math.max(progress,value));locate();
    if(progress>=.96&&!finished){finished=true;held=null;ctx.cue('mark');onSample();}
  }
  ctx.on(knob,'pointerdown',e=>{held=e.pointerId;knob.setPointerCapture(e.pointerId);});
  ctx.on(knob,'pointermove',e=>{
    if(held!==e.pointerId||finished)return;const box=canvas.getBoundingClientRect(),px=e.clientX-box.left,py=e.clientY-box.top;
    let best=Infinity,along=0;
    for(let i=0;i<2;i++){
      const a=projected[i],b=projected[i+1],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
      const t=Math.min(1,Math.max(0,((px-a.x)*dx+(py-a.y)*dy)/Math.max(1,len)));
      const distance=Math.hypot(px-a.x-dx*t,py-a.y-dy*t);
      if(distance<best){best=distance;along=(i+t)/2;}
    }
    if(best<=27)advance(along);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])ctx.on(knob,type,()=>{held=null;});
  return {show(){ctx.overlay.replaceChildren(line,end,knob);progress=0;finished=false;locate();},locate,assist(){advance(progress+.34);}};
}
