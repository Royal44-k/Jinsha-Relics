import './field-photo.css';
import {bindTouchButtons} from '../v12/touch-buttons.js';

export function openFieldPhoto(view,onClose){
  if(document.querySelector('.field-photo[open]'))return;
  const room=document.createElement('dialog');
  room.className='field-photo';
  room.setAttribute('aria-labelledby','field-photo-title');
  room.innerHTML=`<header><h2 id="field-photo-title">河岸摄影</h2><button type="button" data-close aria-label="关闭河岸摄影">×</button></header>
    <div class="field-photo-layout"><div class="field-view"><canvas tabindex="0" aria-label="实景取景，拖动或按方向键绕烁羽转动"></canvas></div>
    <div class="field-camera-controls"><label>画幅<select><option value=".75">竖幅 3∶4</option><option value=".5625">竖屏 9∶16</option><option value="1.77777778">横幅 16∶9</option></select></label>
    <label>镜头倍率<input type="range" min="0.8" max="2.4" value="1" step=".1"><output>1.0×</output></label>
    <p>拖动取景或按方向键，沿烁羽四周观察。</p><button type="button" class="photo-reset">恢复视角</button>
    <button type="button" class="photo-save">保存实景照片</button><small role="status"></small></div></div>`;
  const preview=room.querySelector('canvas'),shape=room.querySelector('select'),lens=room.querySelector('input');
  const output=room.querySelector('output'),status=room.querySelector('[role=status]'),save=room.querySelector('.photo-save');
  const caller=document.activeElement;
  let yaw=0,pitch=0,frame=0,drag=null,url=null,printing=false;
  const life=new AbortController();
  bindTouchButtons(room,(node,event,handler,options={})=>
    node.addEventListener(event,handler,{...options,signal:life.signal}),'.photo-save,.photo-reset');
  function paint(canvas,longSide){
    const aspect=Number(shape.value),width=aspect<1?Math.round(longSide*aspect):longSide;
    view.photograph(canvas,{yaw,pitch,zoom:Number(lens.value),width,height:Math.round(width/aspect)});
  }
  function refresh(){
    output.value=Number(lens.value).toFixed(1)+'×';
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      try{paint(preview,Math.min(840,Math.max(480,innerHeight)));save.disabled=printing;}
      catch{save.disabled=true;status.textContent='取景未能完成，请关闭后重新打开。';}
    });
  }
  function rotate(dx,dy){yaw+=dx;pitch=Math.max(-.9,Math.min(.45,pitch+dy));refresh();}
  preview.onpointerdown=e=>{if(!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};preview.setPointerCapture(e.pointerId);};
  preview.onpointermove=e=>{
    if(drag?.id!==e.pointerId)return;
    rotate((drag.x-e.clientX)*.009,(e.clientY-drag.y)*.006);drag.x=e.clientX;drag.y=e.clientY;
  };
  preview.onlostpointercapture=()=>{drag=null;};
  preview.onkeydown=e=>{
    const delta={ArrowLeft:[.10,0],ArrowRight:[-.10,0],ArrowUp:[0,-.06],ArrowDown:[0,.06]}[e.key];
    if(delta){e.preventDefault();rotate(...delta);}
  };
  shape.onchange=lens.oninput=refresh;
  room.querySelector('.photo-reset').onclick=()=>{yaw=pitch=0;lens.value='1';refresh();};
  save.onclick=()=>{
    if(printing)return;
    printing=true;save.disabled=true;status.textContent='正在冲印…';
    const print=document.createElement('canvas');
    try{
      paint(print,1920);
      print.toBlob(blob=>{
        if(!room.open)return;
        printing=false;save.disabled=false;
        if(!blob){status.textContent='照片未能生成，请重试。';return;}
        if(url)URL.revokeObjectURL(url);
        url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='金沙古蜀秘境-河岸实景-'+Date.now()+'.jpg';
        a.textContent='下载照片原图';status.replaceChildren('照片已生成。',a);a.click();
      },'image/jpeg',.94);
    }catch{printing=false;save.disabled=false;status.textContent='保存失败，请重新取景。';}
  };
  room.querySelector('[data-close]').onclick=()=>room.close();
  room.addEventListener('close',()=>{life.abort();cancelAnimationFrame(frame);if(url)URL.revokeObjectURL(url);room.remove();onClose();caller?.focus?.({preventScroll:true});},{once:true});
  document.body.append(room);room.showModal();preview.focus({preventScroll:true});refresh();
}
