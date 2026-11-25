import {width,height,top,joint,witnesses} from '../v10/trench-profile.js';
import './strata-lens.css';

const samples=[
  {id:'roots',name:'褐土与根隙',key:'表层',tone:'#9d7156',finding:'沿褐色土的顶缘寻找细长、分叉的线。根隙会向下切入，有时穿过颜色不同的土。',
    meaning:'这一小块土有根系活动的痕迹。穿过层界的细根，可以晚于它伸入的土。',
    check:'追踪根隙是否从上层贯入，再比较四周未受扰动的土。仅看一条细根，还不足以确定植物种类或年代。'},
  {id:'sand',name:'浅色砂带',key:'上覆',tone:'#ceaa70',finding:'在浅黄色带里寻找边缘可辨的颗粒，比较它与下方细土的粗细。向两侧追踪，看看这条砂带是否连续。',
    meaning:'这部分的可见颗粒比下方细土粗。两处同时出现砂带，可以提出沉积物搬运条件发生变化的假设。',
    check:'分别取样比较粒度与分选，追踪砂带能延伸多远。一次洪水、反复淤积或岸坡再搬运，仍需更多证据区分。'},
  {id:'contact',name:'砂泥界面',key:'接触面',tone:'#c9bb93',finding:'浅砂在上，下面突然转成暗色细土。把视线沿接触线移向另一扇取样窗，线的位置有高有低。',
    meaning:'在这幅连续、未见翻转的教学剖面上，砂体盖住了下方细土，记录了两者的相对先后。',
    check:'到东、西窗各点一次同一界面，再检查中间有无切坑、根穴或侵蚀缺口。仅凭一处高差无法给出绝对年代。'},
  {id:'fine',name:'下伏细土',key:'下部',tone:'#a99078',finding:'避开接触线往下看，颗粒边缘较难逐粒辨认。留意细裂隙和暗色夹杂与周围基质的差别。',
    meaning:'这幅图的下部基质显得较细，值得与上方粗砂分开记录。若是水成沉积，较平静的水体是一种解释。',
    check:'取实样核对粒度、结构和含水状况，再与邻近剖面对比。照片的深浅还会受湿度与光线影响。'}
];

const illustration='/assets/v10/trench-registered.webp',detail='/assets/v11/strata-detail.webp';
const previous=new WeakMap(),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const boundaries=x=>({rim:top(x),sand:top(x)+(joint(x)-top(x))*.36,contact:joint(x)});
function which(x,y){
  const b=boundaries(x);
  if(y<b.sand)return 0;
  if(y<b.contact-10)return 1;
  if(y<=b.contact+10)return 2;
  return 3;
}
function center(x,i){
  const {rim,sand,contact}=boundaries(x);
  return [rim+(sand-rim)*.48,sand+(contact-sand)*.60,contact,contact+(height-contact)*.49][i];
}
function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
}
function credit(href,text){
  const link=el('a','',text+' ↗');link.href=href;link.target='_blank';link.rel='noopener noreferrer';return link;
}

export function mountStrataLens(host) {
  if(!host?.append)return ()=>{};
  previous.get(host)?.();
  const abort=new AbortController(),options={signal:abort.signal};
  const root=el('section','strata-lens');
  root.setAttribute('aria-label','教学剖面放大镜');
  const figure=el('figure','strata-figure');
  const readout=el('figcaption','strata-readout');
  const location=el('strong',''),scale=el('span','');
  readout.append(location,scale);
  const diagram=el('div','strata-glass');
  const canvas=el('canvas','strata-canvas');
  canvas.tabIndex=0;canvas.setAttribute('role','group');
  canvas.setAttribute('aria-label','剖面取样位置。上下键选土层，左右键换取样窗，回车切换放大。');
  diagram.append(canvas);
  const actions=el('div','strata-actions');
  const zoom=el('button','','放大 2.8×');zoom.type='button';
  const cross=el('button','','换到东窗');cross.type='button';
  actions.append(zoom,cross);figure.append(diagram,readout,actions);
  const chooser=el('div','strata-samples');
  chooser.setAttribute('role','group');chooser.setAttribute('aria-label','按地层选样');
  const copy=el('article','strata-copy');
  const name=el('h4',''),body=el('div','strata-notes');
  name.setAttribute('aria-live','polite');
  const fields={};
  for(const [key,heading] of [['finding','如何辨认'],['meaning','可以推断'],['check','还需核对']]){
    const line=el('section','');fields[key]=el('p','');line.append(el('h5','',heading),fields[key]);body.append(line);
  }
  copy.append(name,body);
  const basis=el('details','strata-basis');
  basis.append(el('summary','','真实发掘与教学剖面'),
    el('p','','本图沿用游戏滨河探方的土壁与砂泥界线。馆方记录的梅苑地点，机械开挖剖面中约 4.5 米的文化堆积至少可分 16 层。本图的四个观察位置仅供练习，实际层位和年代以发掘报告为准。'),
    credit('https://www.jinshasitemuseum.com/seardetail/706','成都金沙遗址博物馆 · 梅苑发掘'),
    credit('https://historicengland.org.uk/content/docs/research/historic-england-archaeological-recording-manual-2018/','田野记录方法 · Historic England'));
  const intro=el('p','strata-intro','教学剖面　·　点土壁取样，或用上下方向键选层。');
  root.append(el('h3','strata-title','剖面放大镜'),intro,figure,chooser,copy,basis);host.append(root);

  let x=witnesses[0],y=joint(x),index=2,zoomed=false,done=false,frame=0,face=null,large=null,largeRequested=false,lastView;
  const g=canvas.getContext('2d');
  function schedule(){
    if(done || frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(!done)draw();});
  }
  function load(url,onload,onerror){
    const image=new Image();image.decoding='async';image.src=url;
    image.decode().then(()=>{if(!done){onload(image);schedule();}},()=>{if(!done)onerror?.();});
  }
  load(illustration,im=>{face=im;},()=>load('/assets/v10/trench-fallback.webp',im=>{face=im;}));
  function extent(){
    const factor=zoomed?2.8:1,sw=width/factor,sh=height/factor;
    return {sx:clamp(x-sw/2,0,width-sw),sy:clamp(y-sh/2,0,height-sh),sw,sh};
  }
  function draw(){
    if(!g)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w<=0||h<=0)return;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    const pw=Math.round(w*ratio),ph=Math.round(h*ratio);
    if(canvas.width!==pw || canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
    const view=extent();lastView=view;
    const {sx,sy,sw,sh}=view;
    const mx=v=>(v-sx)*pw/sw,my=v=>(v-sy)*ph/sh;
    g.fillStyle='#182722';g.fillRect(0,0,pw,ph);
    const img=zoomed && large?large:face;
    if(img){
      const kx=img.naturalWidth/width,ky=img.naturalHeight/height;
      g.drawImage(img,sx*kx,sy*ky,sw*kx,sh*ky,0,0,pw,ph);
    } else {
      for (const [edge,color] of [[top,'#846049'],[at=>boundaries(at).sand,'#b8996b'],[joint,'#624f40'],[at=>joint(at)+20,'#8a7865']]) {
        g.beginPath();g.moveTo(0,ph);
        for(let u=sx;u<=sx+sw+4;u+=4)g.lineTo(mx(u),my(edge(u)));
        g.lineTo(pw,ph);g.closePath();g.fillStyle=color;g.fill();
      }
    }
    if(!zoomed){
      g.save();g.lineWidth=ratio;g.setLineDash([3*ratio,5*ratio]);g.strokeStyle='#f2e3bb88';
      for(const wx of witnesses){
        const cy=my(joint(wx));g.beginPath();g.moveTo(mx(wx),cy-11*ratio);g.lineTo(mx(wx),cy+11*ratio);g.stroke();
      }
      g.restore();
    }
    const cx=mx(x),cy=my(y);
    if(index===2){
      const span=zoomed?sw*.21:width*.065;
      g.save();g.strokeStyle='#f1d591df';g.lineWidth=1.2*ratio;g.setLineDash([5*ratio,5*ratio]);g.beginPath();
      for(let p=Math.max(0,x-span);p<=Math.min(width,x+span);p+=2) {
        if(p===Math.max(0,x-span))g.moveTo(mx(p),my(joint(p)));else g.lineTo(mx(p),my(joint(p)));
      }
      g.stroke();g.restore();
    }
    const radius=(zoomed?15:10)*ratio;
    g.strokeStyle='#1c211a';g.lineWidth=3.5*ratio;g.beginPath();g.arc(cx,cy,radius,0,Math.PI*2);g.stroke();
    g.strokeStyle='#f8d9a0';g.lineWidth=1.3*ratio;g.stroke();g.beginPath();
    g.moveTo(cx-radius-5*ratio,cy);g.lineTo(cx-radius+2*ratio,cy);g.moveTo(cx+radius-2*ratio,cy);g.lineTo(cx+radius+5*ratio,cy);
    g.moveTo(cx,cy-radius-5*ratio);g.lineTo(cx,cy-radius+2*ratio);g.moveTo(cx,cy+radius-2*ratio);g.lineTo(cx,cy+radius+5*ratio);g.stroke();
    canvas.dataset.painted=img?(zoomed&&large?'detail':'registered'):'sketch';
  }
  function refresh(){
    index=which(x,y);
    const sample=samples[index],west=x<width*.5;
    root.dataset.layer=sample.id;root.dataset.scale=zoomed?'magnified':'context';
    location.textContent=(west?'西段':'东段')+'　／　'+sample.key;
    scale.textContent=zoomed?'局部 2.8×':'原位 1×';
    zoom.textContent=zoomed?'返回原位':'放大 2.8×';
    zoom.setAttribute('aria-pressed',String(zoomed));
    cross.textContent=west?'换到东窗':'换到西窗';
    name.textContent=sample.name;
    for(const key of Object.keys(fields))fields[key].textContent=sample[key];
    [...chooser.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    if(zoomed&&!largeRequested){largeRequested=true;load(detail,im=>{large=im;});}
    schedule();
  }
  function select(i){index=clamp(i,0,samples.length-1);y=center(x,index);refresh();}
  function switchWindow(destination) {x=witnesses[destination];y=center(x,index);refresh();}
  function magnify(){zoomed=!zoomed;refresh();}
  zoom.addEventListener('click',magnify,options);
  cross.addEventListener('click',()=>switchWindow(x<width*.5?1:0),options);
  samples.forEach((sample,i)=>{
    const b=el('button','','');b.type='button';b.dataset.sample=sample.id;
    b.style.setProperty('--sample',sample.tone);
    b.append(el('i',''),document.createTextNode(sample.name));b.addEventListener('click',()=>select(i),options);chooser.append(b);
  });
  let down=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !e.isPrimary)return;
    down={id:e.pointerId,x:e.clientX,y:e.clientY};
  },options);
  canvas.addEventListener('pointercancel',()=>{down=null;},options);
  canvas.addEventListener('pointerup',e=>{
    if(!down || down.id!==e.pointerId)return;
    const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
    if(moved>12)return;
    const rect=canvas.getBoundingClientRect(),v=lastView||extent();
    const px=clamp(v.sx+(e.clientX-rect.left)*v.sw/rect.width,0,width-1);
    const py=v.sy+(e.clientY-rect.top)*v.sh/rect.height;
    if(py<top(px))return;
    x=px;y=clamp(py,top(px)+1,height-1);refresh();canvas.focus({preventScroll:true});
  },options);
  canvas.addEventListener('keydown',e=>{
    if(e.key==='ArrowUp')select(index-1);
    else if(e.key==='ArrowDown')select(index+1);
    else if(e.key==='ArrowLeft')switchWindow(0);
    else if(e.key==='ArrowRight')switchWindow(1);
    else if(e.key==='Enter'||e.key===' ')magnify();else return;
    e.preventDefault();e.stopPropagation();
  },options);
  const resizer=new ResizeObserver(schedule);resizer.observe(diagram);
  const dialog=host.closest('dialog');
  function cleanup(){
    if(done)return;done=true;abort.abort();resizer.disconnect();cancelAnimationFrame(frame);
    dialog?.removeEventListener('close',cleanup);face=null;large=null;root.remove();previous.delete(host);
  }
  dialog?.addEventListener('close',cleanup,{once:true});
  previous.set(host,cleanup);refresh();
  if(dialog?.open)canvas.focus({preventScroll:true});
  return cleanup;
}

