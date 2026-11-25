import {inspectSherd} from './fieldwork-sherd.js';
// A second look at the material retained by the screen connects a find to its layer.
const candidates = [
  { title:'左侧残留物', x:.27, y:.49, note:'这枚砾石的边缘全被水磨圆了，没有成形器壁和折口。看看旁边带弧度的残片。' },
  { title:'中部残留物', x:.53, y:.59, note:'' },
  { title:'右侧残留物', x:.75, y:.43, note:'这是自然木屑，表面有沿长轴排列的纤维，找不到陶器的口沿。' }
];
function seeded(seed) { return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
function shape(g,x,y,rx,ry,angle,fill) {
  g.beginPath();g.ellipse(x,y,rx,ry,angle,0,2*Math.PI);g.fillStyle=fill;g.fill();
}
function material() {
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=460;
  const g=canvas.getContext('2d'),rng=seeded(908);
  const grad=g.createRadialGradient(364,202,55,460,265,480);
  grad.addColorStop(0,'#697065');grad.addColorStop(.67,'#3d5046');grad.addColorStop(1,'#24362f');
  g.fillStyle=grad;g.fillRect(0,0,800,460);
  for(let i=0;i<3300;i++)shape(g,rng()*800,rng()*460,.4+rng()*2.1,.4+rng(),0,i%2?'#a9b58428':'#121e2336');
  // The two wire families over/under at alternating intersections.
  for(let x=-12;x<=812;x+=9){g.fillStyle='#102c27aa';g.fillRect(x+1,0,3,460);g.fillStyle='#a39b77';g.fillRect(x,0,1.1,460);}
  for(let y=0;y<460;y+=9){g.fillStyle='#19372cbd';g.fillRect(0,y+1,800,2);g.fillStyle='#abac86';g.fillRect(0,y,800,.9);}
  for(let i=0;i<800;i+=9)for(let j=0;j<460;j+=18){g.fillStyle='#d4c9a1a0';g.fillRect(i,j+(i%18?9:0)-1,1.15,3);}
  shape(g,216,230,82,38,-.2,'#162a25b5');
  const stone=g.createLinearGradient(170,163,235,257);stone.addColorStop(0,'#c2bda7');stone.addColorStop(.44,'#8a8c78');stone.addColorStop(1,'#4a584f');
  shape(g,216,221,76,40,-.24,stone);
  g.save();g.clip();for(let i=0;i<750;i++)shape(g,137+rng()*159,168+rng()*107,1+rng()*2.2,.6+rng(),0,i%2?'#54625e3c':'#dbd2b549');g.restore();
  g.save();g.translate(424,271);g.rotate(.18);g.beginPath();g.moveTo(-76,-36);g.quadraticCurveTo(-4,-48,68,-26);g.lineTo(48,6);g.lineTo(39,8);g.lineTo(24,39);g.lineTo(-9,53);g.lineTo(-26,34);g.lineTo(-58,23);g.closePath();
  const body=g.createLinearGradient(-10,-40,12,60);body.addColorStop(0,'#c4a47e');body.addColorStop(.45,'#a0805e');body.addColorStop(1,'#5a4638');g.fillStyle=body;g.fill();g.save();g.clip();
  for(let i=0;i<2800;i++)shape(g,-82+rng()*160,-47+rng()*108,.45+rng()*1.2,.35+rng()*.7,0,i%3?'#49392b45':'#e9d3ab9b');
  for(let i=-4;i<8;i++){g.beginPath();g.moveTo(i*14+14,-16);g.lineTo(i*14-24,29);g.strokeStyle='#553f2e58';g.lineWidth=2.3;g.stroke();}
  g.restore();g.beginPath();g.moveTo(-76,-34);g.quadraticCurveTo(-6,-48,67,-26);g.strokeStyle='#cbae89';g.lineWidth=10;g.stroke();g.translate(0,4);g.strokeStyle='#705237';g.lineWidth=2;g.stroke();g.restore();
  g.save();g.translate(603,199);g.rotate(-.54);
  for(let j=0;j<17;j++){g.beginPath();g.moveTo(-47+rng()*21,j*1.1-9);g.bezierCurveTo(-13,-14+j,17,j-6,41+rng()*18,3+j*.6);g.strokeStyle=j%3?'#59442e':'#b1915f';g.lineWidth=2;g.stroke();}
  g.restore();return canvas;
}
export function wetSieve(ctx,onReturn) {
  const backdrop=ctx.view.firstElementChild,previousTools=[...ctx.tools.children],previousRead=[...ctx.read.children];
  const layer=document.createElement('div');layer.className='fw-sieve';
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=460;canvas.dataset.painted='true';canvas.tabIndex=0;canvas.setAttribute('aria-label','湿筛。拖动筛框，来回清洗土样。');
  const tray=document.createElement('div');tray.className='fw-sieve-tray';tray.append(canvas);layer.append(tray);ctx.view.append(layer);
  const tag=document.createElement('div');tag.className='fw-specimen-tag';layer.append(tag);
  const heading=document.createElement('strong'),detail=document.createElement('span');
  let raw=null;const g=canvas.getContext('2d'),rng=seeded(174);
  const sand=Array.from({length:1100},(_,i)=>({x:70+rng()*660,y:80+rng()*282,r:2+rng()*9,shade:['#644e39','#83684b','#765d45','#a38763','#b09a77'][i%5],order:rng()}));
  const dust=document.createElement('canvas');dust.width=800;dust.height=460;const grit=dust.getContext('2d');
  let steps=0,lastDir=0,grip=null,push=0,motion=0,phase='wash',visible=true,drawnSteps=-1,stage=null,linked=false;
  const found=new Set();
  function draw(){
    if(raw)g.drawImage(raw,0,0,800,460);else{g.fillStyle='#415343';g.fillRect(0,0,800,460);}
    if(drawnSteps!==steps){
      grit.clearRect(0,0,800,460);
      for(const p of sand)if(p.order>=steps/6)shape(grit,p.x,p.y,p.r,p.r*.67,p.order,p.shade);
      drawnSteps=steps;
    }
    g.drawImage(dust,push*4,0);tray.style.setProperty('--tilt',(push*1.65)+'deg');
  }
  function activate(dir){
    if(!visible||phase!=='wash')return;
    if(dir===lastDir){ctx.tip('细砂堆在同一边。向相反方向回摇筛框。');return;}
    lastDir=dir;steps++;push=dir;motion=1;draw();ctx.cue('screen-wash');
    if(steps===6){phase='choose';render();objects[0].focus({preventScroll:true});}
    else detail.textContent='往复摇筛　'+steps+' / 6';
  }
  ctx.on(canvas,'pointerdown',e=>{grip=e.clientX;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
  ctx.on(canvas,'pointermove',e=>{if(grip===null)return;const dx=e.clientX-grip;if(Math.abs(dx)<Math.max(14,canvas.clientWidth*.10))return;activate(Math.sign(dx));grip=e.clientX;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])ctx.on(canvas,type,()=>{grip=null;});
  ctx.on(canvas,'keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.code))return;e.preventDefault();e.stopPropagation();if(!e.repeat)activate(e.code==='ArrowLeft'?-1:1);});
  function phaseTo(next){phase=next;render();}
  const objects=candidates.map((obj,i)=>{
    const b=document.createElement('button');b.type='button';b.className='fw-specimen-pin';
    b.textContent=['甲','乙','丙'][i];b.setAttribute('aria-label',obj.title);b.style.left=obj.x*100+'%';b.style.top=(obj.y+.13)*100+'%';tray.append(b);
    ctx.on(b,'click',()=>{
      if(i!==1){ctx.tip(obj.note);b.classList.add('examined');ctx.cue('brush');return;}
      if(!stage){stage=inspectSherd(ctx,layer,documentEvidence);ctx.onClose(()=>stage.dispose());}
      ctx.cue('mark');phaseTo('inspect');
    });return b;
  });
  function documentEvidence(id){
    found.add(id);progress();ctx.cue('brush');
    ctx.tip(id==='rim'?'连续外翻的口边指明了器口的方向。侧着拿，再观察锯齿状断口里的胎土。':'断口露出粗颗粒夹杂物和胎土内部，器表则有成形的弧面。两处观察都可随时复核。');
  }
  function progress(){
    if(phase!=='inspect')return;
    detail.textContent=(found.has('rim')?'✓':'○')+' 外翻口边　'+(found.has('break')?'✓':'○')+' 夹砂断面';
    next.disabled=found.size!==2;
  }
  const left=ctx.button('向左摇筛',()=>activate(-1)),right=ctx.button('向右摇筛',()=>activate(1));
  const back=ctx.button('返回剖面',()=>{
    visible=false;stage?.show(false);layer.hidden=true;backdrop.hidden=false;ctx.section.dataset.fieldPhase='trench';
    ctx.tools.replaceChildren(...previousTools);ctx.read.replaceChildren(...previousRead);onReturn();
  });
  const rewash=ctx.button('重新摇筛',()=>{steps=0;lastDir=0;push=motion=0;phaseTo('wash');draw();});
  const clue=ctx.button('对照形态提示',()=>{
    objects[1].classList.add('fw-clue');objects[1].focus({preventScroll:true});
    ctx.tip('看乙号赭色残片：上缘形成一道外翻的弧边，下面的器壁逐渐变薄。把它拿到观察台，翻过来核实这一判断。');
  });
  const rim=ctx.button('看口沿',()=>stage.landmark('rim')),edge=ctx.button('看断口',()=>stage.landmark('break'));
  const zoom=ctx.button('放大标本',()=>{const near=stage.zoom();zoom.textContent=near?'恢复全貌':'放大标本';});
  const next=ctx.button('配层位签',()=>{if(found.size===2)phaseTo('label');});
  const chooseAgain=ctx.button('返回筛盘',()=>{phaseTo('choose');objects[1].focus({preventScroll:true});});
  const inspectAgain=ctx.button('返回观察陶片',()=>phaseTo('inspect'));
  ctx.on(document,'keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented||!visible||document.querySelector('dialog[open],#transcript[open]'))return;
    event.preventDefault();
    const previous=phase==='label'?inspectAgain:phase==='inspect'?chooseAgain:back;
    previous.click();
  });
  const samples=['上部根际土','砂泥交界','游离砾石层'].map((label,i)=>ctx.button(label,()=>{
    if(i!==1){ctx.tip('回忆取样针的位置。两窗的针都标在浅砂盖住暗泥的接触面，土样取自这里。');ctx.cue('brush');return;}
    linked=true;render();ctx.cue('mark');save.focus({preventScroll:true});
  }));
  const save=ctx.button('封存陶片与层位记录',()=>{if(linked&&found.size===2)ctx.finish();});
  function render(){
    const inspecting=phase==='inspect'||phase==='label';
    tray.hidden=inspecting;stage?.show(inspecting);tag.hidden=inspecting;
    for(const b of objects)b.hidden=phase!=='choose';
    ctx.section.dataset.fieldPhase=({wash:'sieve',choose:'residue',inspect:'sherd',label:'provenance'})[phase];
    if(phase==='wash'){
      ctx.step?.(3,6,'摇筛，留下陶器残片');tag.textContent='砂泥交界取样　／　湿筛';
      heading.textContent='清去细泥';detail.textContent='往复摇筛　'+steps+' / 6';
      ctx.tip('按住筛框向两边来回摇。细泥从网孔流走，留意渐渐显露的器物边缘。');ctx.tools.replaceChildren(left,right,back);
    }else if(phase==='choose'){
      ctx.step?.(4,6,'找出陶器口沿');tag.textContent='筛余物　／　甲 · 乙 · 丙';
      heading.textContent='目标 · 陶器口沿';detail.textContent='线索　弯曲器壁，上缘向外翻起';
      ctx.tip('从三件筛余物里挑出保留弯曲器壁和外翻口边的一件。拿不准时，可对照形态提示。');ctx.tools.replaceChildren(clue,back,rewash);
    }else if(phase==='inspect'){
      ctx.step?.(5,6,'翻看陶片的两处证据');heading.textContent='观察外翻口边与胎土';progress();
      ctx.tip('拖动标本翻面，轻点上唇和下方断口作记录。也可用「看口沿」「看断口」转到对应角度。');
      ctx.tools.replaceChildren(rim,edge,zoom,next,chooseAgain);
    }else{
      ctx.step?.(6,6,'给陶片配层位签');heading.textContent=linked?'层位与器物已配对':'这袋土样取自哪里？';
      detail.textContent=linked?'砂泥交界　／　夹砂陶口沿':'回忆东、西窗两支针的位置';
      ctx.tip(linked?'保留器物与出土位置的关系，沿这条砂带去寻找古河道。':'选择与最初标记吻合的层位签，再封存。也可退回筛盘，重看剖面。');
      ctx.tools.replaceChildren(...(linked?[save]:samples),inspectAgain);
    }
  }
  function show(){visible=true;backdrop.hidden=true;layer.hidden=false;ctx.read.replaceChildren(heading,detail);render();if(phase==='wash')canvas.focus({preventScroll:true});}
  const photo=new Image();photo.decoding='async';photo.src='/assets/v10/fieldwork-wet-sieve.webp';
  photo.decode().then(()=>{if(!ctx.closed){raw=photo;draw();}}).catch(()=>{if(!ctx.closed){raw=material();draw();}});
  ctx.frame(dt=>{if(!visible||!motion||phase!=='wash')return;motion=Math.max(0,motion-dt*4);push=lastDir*motion;draw();});
  show();draw();return show;
}
