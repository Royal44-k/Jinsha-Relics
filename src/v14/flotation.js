import {createFlotationArt} from './flotation-art.js';
import {bindTouchButtons} from '../v12/touch-buttons.js';
import './flotation.css';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const tau=Math.PI*2;
const names=['标本甲','标本乙','标本丙'];
const features=[
  '断面有层状木纹，边缘呈棱角。它也能随水浮起。',
  '轮廓长卵形，两端收窄。侧转后可看见纵向纹理。',
  '边缘薄而外翻，内侧有空腔。这块植物碎片缺少饱满的籽粒轮廓。'
];
function fallbackArt(canvas){
  const c=canvas.getContext('2d');
  function resize(){canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;}
  function unit(){return Math.min(canvas.width/5.6,canvas.height/4.0);}
  function point(cx,cy){const r=canvas.getBoundingClientRect(),k=unit();return [(cx-r.left-r.width/2)/k,(cy-r.top-r.height/2)/(k*.76)];}
  function paint(s){
    const w=canvas.width,h=canvas.height,k=unit();
    c.fillStyle='#203932';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(k,k*.76);
    c.beginPath();c.ellipse(0,0,2.16,2.16,0,0,tau);c.fillStyle=s.phase==='wash'?'#85785a':'#67897c';c.fill();c.strokeStyle='#bdab87';c.lineWidth=.1;c.stroke();
    if(['wash','skim'].includes(s.phase)){
      for(let i=0;i<13;i++)if(!s.caught.has(i)&&s.wash>(i%3)*.14+.07){
        const [x,z]=floatAt(i,s.angle);c.beginPath();c.ellipse(x,z,.14,.072,i,0,tau);c.fillStyle='#312f24';c.fill();
      }
      if(s.phase==='skim'){c.strokeStyle='#e3d5b4';c.lineWidth=.046;c.beginPath();c.arc(s.x,s.z,.48,0,tau);c.stroke();}
    }else{
      c.fillStyle='#c6b893';c.beginPath();c.ellipse(0,0,1.82,1.82,0,0,tau);c.fill();c.rotate(s.rotation*.5);
      c.fillStyle=['#4d4a39','#484337','#886c52'][s.selected];
      if(s.selected===1){c.beginPath();c.ellipse(0,0,1.10,.46,.14,0,tau);c.fill();c.beginPath();c.ellipse(.02,-.16,.93,.038,.12,0,tau);c.fillStyle='#77705a';c.fill();}
      else{c.beginPath();c.moveTo(-.94,-.32);c.lineTo(.48,-.43);c.lineTo(.91,.18);c.lineTo(.18,.52);c.lineTo(-.76,.27);c.fill();}
    }
    c.restore();
  }
  resize();return {resize,paint,point,dispose(){}};
}
function floatAt(i,angle){
  const a=i*2.40+angle*.25,r=.45+.94*((i*.618)%1);
  return [Math.cos(a)*r,Math.sin(a)*r];
}
export function openFlotation({sound,known,onClose}){
  const dialog=document.createElement('dialog');dialog.id='flotation-room';dialog.setAttribute('aria-labelledby','flotation-title');
  dialog.innerHTML=`<div class="float-deck"><header><div><small>西台烟火里　／　植物考古</small><h2 id="flotation-title">灰坑里的晚饭</h2></div><button type="button" data-leave>返回小院</button></header>
    <div class="float-body"><div class="float-image"><canvas tabindex="0" aria-label="土样浮选操作台"></canvas><span class="float-caption"></span></div>
    <section class="float-notes"><span class="float-index"></span><h3></h3><p class="float-guide"></p><div class="float-meter"><i></i></div>
    <output aria-live="polite"></output><div class="float-choices"></div><button class="float-submit" hidden></button> <button class="float-prev" hidden></button>
    <details><summary>这份土样能说明什么</summary><p>金沙“黄忠小学”地点曾进行土样浮选。许多份样品合在一起，才渐渐拼出居住者的食物图谱。这里演示的是取样之后的工作，器具、房屋与标本组合均为教学复原。</p><a target="_blank" rel="noopener" href="https://www.jinshasitemuseum.com/info/4877">查看金沙遗址博物馆研究介绍 ↗</a></details></section></div></div>`;
  const $=query=>dialog.querySelector(query),button=$('.float-submit');
  document.body.append(dialog);dialog.showModal();
  let canvas=$('canvas'),art,frame=0,drag=null,closed=false,won=false;
  const state={phase:'wash',wash:0,caught:new Set(),angle:0,x:0,z:1.4,selected:0,rotation:0};
  const sightings=[0,0,0];
  try{art=createFlotationArt(canvas);}catch{
    const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;art=fallbackArt(canvas);
  }
  function render(){frame=0;if(!closed)art.paint(state);}
  function redraw(){if(!frame&&!closed)frame=requestAnimationFrame(render);}
  const observer=new ResizeObserver(()=>{art.resize();redraw();});observer.observe(canvas);
  const life=new AbortController(),listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:life.signal});
  bindTouchButtons(dialog,listen,'button');
  function feedback(text){const out=$('output');if(out.textContent!==text)out.textContent=text;}
  function meter(progress){$('.float-meter i').style.width=clamp(progress*100,0,100)+'%';}
  function action(label,fn){button.hidden=false;button.textContent=label;button.onclick=fn;}
  function controls(){
    const phase=state.phase,level=['wash','skim','inspect','archived'].indexOf(phase);
    dialog.dataset.phase=phase;
    $('.float-index').textContent=['01 / 03　浸散','02 / 03　分离','03 / 03　检视','取样记录'][level];
    $('h3').textContent=['沿桶壁轻轻打圈','把浮起的轻物捞出','哪一件保留了稻粒的外形？','一粒稻，留下了一顿饭的线索'][level];
    $('.float-guide').textContent=[
      '按住水面绕着桶心转动，让土团松散。也可将焦点放在水桶上，连续按左右方向键环洗。',
      '拖动细网勺扫过漂浮物，至少收集七片，再将样品移入观察盘。方向键也能移动网勺。',
      '从阴干的样品中选一件。横拖放大标本，查看侧面与表面；方向键可以转动。找到稻粒后把判断写入图记。',
      '本份教学土样中辨认出了炭化稻粒。金沙实际的多份居址样品中还发现粟、黍。'
    ][level];
    $('.float-caption').textContent=['灰坑土样　·　水桶浮选','水面轻物　·　网勺采集','阴干样品　·　形态放大','炭化稻粒　·　教学模型'][level];
    button.hidden=true;$('.float-choices').replaceChildren();
    const previous=$('.float-prev');previous.hidden=phase!=='skim'&&phase!=='inspect';
    previous.textContent=phase==='inspect'?'返回网勺':'重新环洗';
    previous.onclick=()=>{
      if(phase==='inspect'){state.phase='skim';controls();skim(state.x,state.z);}
      else{state.phase='wash';state.wash=state.angle=0;state.caught.clear();controls();}
      canvas.focus({preventScroll:true});
    };
    if(phase==='wash'){meter(state.wash);feedback('土团尚未散开');}
    if(phase==='skim'){meter(state.caught.size/7);feedback('已捞取 '+state.caught.size+' / 7');}
    if(phase==='inspect'){
      for(const [i,name] of names.entries()){
        const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(i===state.selected));
        b.onclick=()=>{state.selected=i;state.rotation=0;controls();redraw();canvas.focus({preventScroll:true});};
        $('.float-choices').append(b);
      }
      meter(sightings[state.selected]/1.1);feedback(sightings[state.selected]>=1.1?features[state.selected]:'转动标本，把边缘转向亮处。');
      action('登记此件为稻粒',()=>{
        if(sightings[state.selected]<1.1){feedback('还缺少侧视记录。横拖标本，或按左右方向键转动。');canvas.focus();return;}
        if(state.selected!==1){feedback(features[state.selected]+' 再比较一件。');sound?.('brush',.5);return;}
        state.phase='archived';won=true;sound?.('record',.8);controls();redraw();
      });
    }
    if(phase==='archived'){
      meter(1);feedback(known?'本次复查已完成':'已辨认 · 炭化稻粒图记');
      action(known?'结束复查，返回小院':'收录图记，返回小院',()=>dialog.close());
    }
    redraw();
  }
  function wash(delta){
    const last=state.wash;
    state.angle+=delta;state.wash=clamp(state.wash+Math.abs(delta)/(tau*1.38),0,1);meter(state.wash);
    if(Math.floor(state.wash*5)>Math.floor(last*5))sound?.('water',.47);
    if(state.wash<1){feedback(state.wash<.34?'细土正从土团中松开':state.wash<.72?'水面已出现轻物，继续环洗':'轻物正在与砂砾分离');}
    else{feedback('轻物已经浮起，可以取网。');action('取网勺',()=>{state.phase='skim';controls();canvas.focus();});}
  }
  function skim(x,z,start=false){
    const d=Math.hypot(x,z),f=d>1.94?1.94/d:1;
    const fromX=start?x*f:state.x,fromZ=start?z*f:state.z;
    state.x=x*f;state.z=z*f;
    const dx=state.x-fromX,dz=state.z-fromZ,span=dx*dx+dz*dz;
    for(let i=0;i<13;i++){
      const [px,pz]=floatAt(i,state.angle);
      const u=span?clamp(((px-fromX)*dx+(pz-fromZ)*dz)/span,0,1):0;
      if(Math.hypot(fromX+u*dx-px,fromZ+u*dz-pz)<.52&&!state.caught.has(i)){state.caught.add(i);sound?.('water',.25);}
    }
    meter(state.caught.size/7);feedback(state.caught.size>=7?'已捞取 '+state.caught.size+' 片，样品足够观察。':'已捞取 '+state.caught.size+' / 7');
    if(state.caught.size>=7)action('移入阴干观察盘',()=>{state.phase='inspect';controls();canvas.focus();});
  }
  function turn(delta){
    state.rotation+=delta;sightings[state.selected]=Math.min(1.1,sightings[state.selected]+Math.abs(delta));
    meter(sightings[state.selected]/1.1);if(sightings[state.selected]>=1.1)feedback(features[state.selected]);
  }
  listen(canvas,'pointerdown',e=>{
    if(e.button!==0||drag||state.phase==='archived')return;
    e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    const [x,z]=art.point(e.clientX,e.clientY);drag={id:e.pointerId,x:e.clientX,a:Math.atan2(z,x)};
    if(state.phase==='skim'){skim(x,z,true);redraw();}
  });
  listen(canvas,'pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    const [x,z]=art.point(e.clientX,e.clientY),a=Math.atan2(z,x);
    if(state.phase==='wash'&&Math.hypot(x,z)>.23&&Math.hypot(x,z)<2.22){
      const diff=Math.atan2(Math.sin(a-drag.a),Math.cos(a-drag.a));
      wash(clamp(diff,-.55,.55));
    }else if(state.phase==='skim')skim(x,z);
    else if(state.phase==='inspect')turn((e.clientX-drag.x)*.022);
    drag.a=a;drag.x=e.clientX;redraw();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,()=>{drag=null;});
  listen(canvas,'keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const dx=Number(e.key==='ArrowRight')-Number(e.key==='ArrowLeft'),dz=Number(e.key==='ArrowDown')-Number(e.key==='ArrowUp');
    if(state.phase==='wash')wash((dx||-dz)*.43);
    if(state.phase==='skim')skim(state.x+.22*dx,state.z+.22*dz);
    if(state.phase==='inspect')turn((dx||-dz)*.27);redraw();
  });
  function clean(){
    if(closed)return;closed=true;cancelAnimationFrame(frame);observer.disconnect();life.abort();art.dispose();dialog.remove();onClose(won);
  }
  $('[data-leave]').onclick=()=>dialog.close();
  dialog.addEventListener('close',clean,{once:true});
  controls();canvas.focus({preventScroll:true});
  return ()=>{if(dialog.open)dialog.close();clean();};
}
