import * as T from 'three';
import {jadeBench,clayBench,birdBench} from './workshop-art.js';

const clamp=T.MathUtils.clamp;
const wrapped=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const percent=v=>Math.round(v*100)+'%';
const degrees=a=>Math.round(wrapped(a)*180/Math.PI)+'°';

function instrument(ctx,label){
  const item=document.createElement('div');
  item.className='at-instrument';
  item.innerHTML='<span></span><output></output><i><b></b></i>';
  item.firstChild.textContent=label;
  ctx.instruments.append(item);
  return (value,fraction)=>{
    const out=item.querySelector('output');
    if(out.textContent!==value)out.textContent=value;
    const track=item.querySelector('i');track.hidden=fraction==null;
    if(fraction!=null)track.firstChild.style.width=percent(clamp(fraction,0,1));
  };
}

export function cutJade(ctx){
  const {studio,message,sound,button}=ctx,art=jadeBench(studio.scene);
  let depth=0,moisture=.63,direction=0,travel=0,progress=0,charged=false;
  let inspected=false,turn=-1.48,plainTrial=false;
  let pointer=null,previous=0,distance=0,currentSign=0,strokeComplete=false;
  const cut=instrument(ctx,'切入深度'),wet=instrument(ctx,'砂浆');
  function turnFace(delta){
    turn=clamp(turn+delta,-2.7,1.7);
    art.inspect(turn);
    const aligned=Math.abs(turn+.18)<.26;
    ctx.readout.textContent=aligned?'细弧纹连续 · 可记录':turn<-.18?'切面仍背光　向右转 ↷':'切面偏亮　↶ 向左转';
    cut('已贯通',1);wet(aligned?'可见磨痕':'寻找侧光',clamp(1-Math.abs(turn+.18)/1.6,0,1));
    ctx.redraw();
  }
  function inspectCut(){
    inspected=true;ctx.step(2);ctx.controls.replaceChildren();
    ctx.root.querySelector('h2').textContent='找到新切面上的磨痕';
    ctx.root.querySelector('.at-objective').textContent='横拖半块玉料，让侧光擦过新切面。看到成组的细弧纹，再把观察写入口规记录。';
    button('向左转玉',()=>turnFace(-.22),{name:'jade-turn-left'});
    button('向右转玉',()=>turnFace(.22),{name:'jade-turn-right'});
    button('记录切面磨痕',()=>{
      if(Math.abs(turn+.18)>=.26){message('眼下是外皮或逆光边。按画面方向转动，细弧纹会在切面连成一组。');return;}
      ctx.finish('你记录了砂粒往复留下的细弧纹。带上玉口规，去量下一处残器的口沿。');
    },{primary:true,name:'jade-record'});
    ctx.shortcuts.textContent='横向拖动玉料，或用左右键转动。';
    message('原皮有斑驳，切面上才有成组的细纹。把切面转向眼前。');turnFace(0);
  }
  function draw(){
    art.update(travel,depth,moisture,progress);
    cut(percent(depth),depth);wet(!charged?'清水 · 无砂':moisture<.18?'将干':moisture>.80?'水润':'含砂',moisture);
    ctx.readout.textContent=depth>=1?'玉料已分切':direction<0?'下一程  →':direction>0?'←  下一程':'←  往复绳锯  →';
    ctx.redraw();
  }
  function addWater(){
    if(!charged){moisture=.92;draw();sound('water-drop',.7);ctx.animate(500,art.pour);message('清水润湿了玉面。绳还是软的，试拉一程，再给绳上砂。');return;}
    if(moisture>.83){message('切口里水分充足，可以继续往复拉绳。');return;}
    moisture=Math.min(1,moisture+.68);sound('water-drop',.8);draw();ctx.animate(570,art.pour);
    message('水带着新砂流入切口。换向拉绳，砂粒才会继续切入。');
  }
  function stroke(sign){
    if(!ctx.enabled()||depth>=1)return;
    if(!charged){
      plainTrial=true;const from=travel;travel=sign;sound('rope',.45);
      ctx.animate(230,t=>art.update(T.MathUtils.lerp(from,sign,t),0,moisture,0));
      message('绳在玉面上滑过，湿痕很快消失。选「绳上蘸砂」再试，同一程会留下什么？');return;
    }
    if(sign===direction){message('绳头已经拉到这一端。现在往另一边拉。');return;}
    if(moisture<.16){message('砂浆发干，切线开始发涩。舀一勺水再继续。');sound('jade-scrape',.25);return;}
    const from=travel,before=depth;
    travel=sign;direction=sign;depth=Math.min(1,depth+.125);
    moisture=Math.max(0,moisture-.128);sound('jade-scrape',.65+depth*.25);
    if(depth>=1){
      progress=1;draw();ctx.after(inspectCut,720);
    }else{
      draw();message(moisture<.16?'切口里的水快干了。现在可以舀水补砂。':'切线更深了。交换两端的拉力，再走一程。');
    }
    art.pour(1);
    ctx.animate(depth===1?700:185,t=>{
      const ease=t*t*(3-2*t);
      art.update(T.MathUtils.lerp(from,sign,ease),T.MathUtils.lerp(before,depth,ease),moisture,progress*ease);
    });
  }
  button('← 左拉',()=>stroke(-1),{name:'pull-left'});
  button('右拉 →',()=>stroke(1),{name:'pull-right'});
  const grit=button('绳上蘸砂',()=>{
    if(charged)return;
    if(!plainTrial){message('先横拉一次素绳，记住清水湿痕的模样，再比较带砂的效果。');return;}
    charged=true;ctx.step(1);moisture=.63;direction=0;draw();
    grit.disabled=true;grit.textContent='绳槽已含砂';sound('brush',.72);
    message('湿绳把磨粒带进切口。先往左拉，再往右拉，观察上一程的痕迹是否仍在。');
  },{name:'charge-grit'});
  button('舀水润砂',addWater,{primary:true,name:'wet'});
  const canvas=studio.canvas;
  ctx.listen(canvas,'pointerdown',event=>{
    if(!ctx.enabled()||pointer!==null||event.button!==0)return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);pointer=event.pointerId;
    previous=event.clientX;distance=0;currentSign=0;strokeComplete=false;
  });
  ctx.listen(canvas,'pointermove',event=>{
    if(pointer!==event.pointerId||!ctx.enabled())return;
    const dx=event.clientX-previous,sign=Math.sign(dx);previous=event.clientX;
    if(inspected){turnFace(dx*.012);return;}
    if(depth>=1)return;
    if(!sign)return;
    if(sign!==currentSign){currentSign=sign;distance=0;strokeComplete=false;}
    distance+=Math.abs(dx);
    const reach=clamp(canvas.clientWidth*.15,42,112);
    travel=clamp(travel+dx/reach*.85,-1,1);art.update(travel,depth,moisture,progress);ctx.redraw();
    if(!strokeComplete&&distance>=reach){stroke(sign);strokeComplete=true;}
  });
  const release=event=>{if(pointer===event.pointerId)pointer=null;};
  ctx.listen(canvas,'pointerup',release);ctx.listen(canvas,'pointercancel',release);ctx.listen(canvas,'lostpointercapture',release);
  ctx.shortcuts.textContent='S 蘸砂，W 舀水。横向往返拖动，或用 ← → 交替拉绳。';
  message('眼前有一把软绳和一碗砂。你可以先用清水试拉，比较蘸砂之前和之后的切痕。');draw();
  return {key(e){
    const key=e.key.toLowerCase();
    if(inspected){
      if(key==='arrowleft'||key==='arrowright'){turnFace(key==='arrowleft'?-.22:.22);return true;}
      return false;
    }
    if(key==='s'){if(!e.repeat)grit.click();return true;}
    if(key==='w'){if(!e.repeat)addWater();return true;}
    if(!['arrowleft','arrowright','a','d'].includes(key))return false;
    if(!e.repeat)stroke(key==='arrowleft'||key==='a'?-1:1);return true;
  }};
}

const shardNames=['底足','器腹','口沿'];
function pin(ctx,cls){
  const el=document.createElement('i');el.className=cls;el.ariaHidden='true';ctx.overlay.append(el);return el;
}
function markAt(el,position,studio){
  const p=studio.project(position);
  el.style.left=percent(p.x);el.style.top=percent(p.y);
}

export function fitClay(ctx){
  const {studio,button,sound,message}=ctx,art=clayBench(studio.scene),pieces=art.pieces;
  if(ctx.variant){
    const turns=ctx.variant===1?[-2,3,-1]:[1,-3,2];
    pieces.forEach((p,i)=>{p.item.rotation.z=p.angle=turns[i]*Math.PI/6;});
  }
  const gauge=instrument(ctx,'玉口规'),record=instrument(ctx,'归位陶片');
  const marker=pin(ctx,'at-shard-pin'),target=pin(ctx,'at-target-pin');
  marker.textContent='＋';target.textContent='⌖';
  let diameter=2,calibrated=false,selected=0,drag=null,count=0;
  let viewAngle=0,gaugeX=0,gaugeStart=2,turningPiece=null;
  const handle=document.createElement('button');
  handle.type='button';handle.className='at-turn-handle';handle.textContent='↻';handle.hidden=true;
  handle.setAttribute('aria-label','拖动旋耳转动已选陶片');ctx.overlay.append(handle);
  const initial=pieces.map(p=>({pos:p.item.position.clone(),angle:p.angle}));
  const fitOrder=[];
  const normal=new T.Vector3(0,0,1),plane=new T.Plane(),point=new T.Vector3(),offset=new T.Vector3();
  const selectionButtons=[];
  function layout(){
    marker.hidden=target.hidden=!calibrated||count===3;
    handle.hidden=marker.hidden;if(marker.hidden)return;
    markAt(marker,pieces[selected].item.position,studio);markAt(target,pieces[selected].target,studio);
    const center=studio.project(pieces[selected].item.position);
    handle.style.left='clamp(22px,calc('+percent(center.x)+' + 34px),calc(100% - 22px))';
    handle.style.top='clamp(22px,calc('+percent(center.y)+' - 24px),calc(100% - 22px))';
  }
  function redraw(){
    const size=[.58,.72,.86,1,1.14,1.28][diameter];
    art.gauge.scale.set(size,1,size);gauge(calibrated?'已吻合':Math.round(size*100)+' 格',size/1.28);
    record(count+' / 3',count/3);
    ctx.readout.textContent=calibrated&&count<3?shardNames[selected]+'  ·  转角 '+degrees(pieces[selected].angle):calibrated?'器身完整':'校准口沿弧线';
    selectionButtons.forEach((b,i)=>{b.disabled=pieces[i].locked;b.setAttribute('aria-pressed',String(i===selected));});
    layout();ctx.redraw();
  }
  function select(i){
    if(!calibrated||pieces[i].locked)return;
    selected=i;redraw();message('已拿起'+shardNames[i]+'。按断面朝向转正，再对准器身上的十字。');
  }
  function rotate(sign){
    if(!calibrated||count===3)return;
    const p=pieces[selected];p.angle=wrapped(p.angle+sign*Math.PI/6);p.item.rotation.z=p.angle;
    sound('clay-turn',.38);redraw();
  }
  function inspectVessel(delta){
    viewAngle=clamp(viewAngle+delta,-Math.PI,Math.PI);art.turntable.rotation.y=viewAngle;ctx.redraw();
    ctx.readout.textContent=Math.abs(viewAngle)>1.08?'断面过渡连续 · 可归档':'横拖转台，查看修复侧缘';
  }
  function attempt(){
    if(!calibrated||count===3)return;
    const p=pieces[selected],gap=p.item.position.distanceTo(p.target),tilt=Math.abs(wrapped(p.angle));
    if(gap>.32){message('断面还够不到器身。把拿起的陶片移向同一高度的十字。');return;}
    if(tilt>.12){message('位置已经对上了。转动陶片，让口沿或底足恢复水平，再合缝。');return;}
    p.locked=true;p.angle=0;p.item.rotation.z=0;p.item.position.copy(p.target);count++;fitOrder.push(p.index);
    sound('clay-fit',.72+count*.07);
    if(count===3){
      ctx.step(2);art.showRestoration();redraw();ctx.controls.replaceChildren();
      ctx.root.querySelector('h2').textContent='转看修补的侧缘';
      ctx.shortcuts.textContent='横拖器身转台，或按左右键转动。';
      button('向左转台',()=>inspectVessel(-.4),{name:'clay-turn-left'});
      button('向右转台',()=>inspectVessel(.4),{name:'clay-turn-right'});
      button('收录复原陶托',()=>{
        if(Math.abs(viewAngle)<1.08){message('正面能看到拼片，侧面才能检查外壁是否接顺。转过约四分之一圈。');return;}
        ctx.finish('底足、器腹、口沿三道断面相接，器壁侧缘平顺。复原陶托已记入档案。');
      },{primary:true,name:'clay-record'});
      message('三片已接合。转到侧面观察口沿和器腹的轮廓，完成最后一次复核。');inspectVessel(0);return;
    }
    selected=pieces.findIndex(s=>!s.locked);redraw();message(shardNames[p.index]+'已咬合。下一片是'+shardNames[selected]+'。');
  }
  function prepare(){
    if(diameter!==3){message(diameter<3?'玉弧落在口沿内侧，再展开一格。':'玉弧超出了口沿，往内收一格。');return;}
    calibrated=true;ctx.step(1);sound('clay-fit',.62);ctx.controls.replaceChildren();
    for(let i=0;i<3;i++)selectionButtons.push(button(shardNames[i],()=>select(i),{name:'shard-'+i}));
    button('↶ 左旋',()=>rotate(1),{name:'rotate-left'});button('右旋 ↷',()=>rotate(-1),{name:'rotate-right'});
    button('合缝',attempt,{primary:true,name:'fit'});
    button('退回上一片',()=>{
      if(!fitOrder.length){message('还没有已接合的陶片。可直接移动当前这片。');return;}
      selected=fitOrder.pop();const piece=pieces[selected];piece.locked=false;
      piece.item.position.copy(initial[selected].pos);piece.item.rotation.z=piece.angle=initial[selected].angle;count--;redraw();message('上一片已取下，可以转正后重新合缝。');
    },{name:'undo-shard'});
    ctx.shortcuts.textContent='拖陶片平移；拖 ↻ 旋耳转片。键盘 1–3 选片，方向键移位，Q / R 旋转。';
    message('口规恰好贴住器沿。先试底足，旋转并移向器座上的十字。');redraw();
    studio.canvas.focus({preventScroll:true});
  }
  function changeDiameter(step){
    diameter=clamp(diameter+step,0,5);sound('clay-turn',.25);redraw();
    message('观察玉弧与残存口沿的间隙，等两圈重合再定径。');
  }
  button('收拢',()=>changeDiameter(-1),{name:'narrow'});
  button('展开',()=>changeDiameter(1),{name:'widen'});
  button('用玉口规定径',prepare,{primary:true,name:'gauge'});
  const canvas=studio.canvas;
  ctx.listen(handle,'pointerdown',e=>{
    if(!calibrated||count===3||e.button!==0)return;
    const r=canvas.getBoundingClientRect(),center=studio.project(pieces[selected].item.position);
    const x=r.left+center.x*r.width,y=r.top+center.y*r.height;
    turningPiece={id:e.pointerId,x,y,start:pieces[selected].angle,polar:Math.atan2(e.clientY-y,e.clientX-x)};
    handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  ctx.listen(handle,'pointermove',e=>{
    if(turningPiece?.id!==e.pointerId)return;
    const t=turningPiece,p=pieces[selected];
    p.angle=wrapped(t.start+t.polar-Math.atan2(e.clientY-t.y,e.clientX-t.x));p.item.rotation.z=p.angle;redraw();
  });
  ctx.listen(handle,'lostpointercapture',()=>{turningPiece=null;});
  ctx.listen(handle,'click',e=>{if(!e.detail)rotate(1);});
  ctx.listen(canvas,'pointerdown',e=>{
    if(!ctx.enabled()||drag!==null||e.button!==0)return;
    if(!calibrated||count===3){gaugeX=e.clientX;gaugeStart=diameter;drag=e.pointerId;canvas.setPointerCapture(drag);return;}
    studio.scene.updateMatrixWorld(true);
    const hits=studio.ray(e).intersectObjects(pieces.filter(s=>!s.locked).map(s=>s.item));
    if(!hits.length)return;
    select(pieces.findIndex(s=>s.item===hits[0].object));
    const p=pieces[selected];
    plane.set(normal,-p.item.position.z);
    if(!studio.ray(e).ray.intersectPlane(plane,point))return;
    offset.copy(p.item.position).sub(point);drag=e.pointerId;canvas.setPointerCapture(drag);canvas.focus({preventScroll:true});
  });
  ctx.listen(canvas,'pointermove',e=>{
    if(e.pointerId!==drag||!ctx.enabled())return;
    if(!calibrated){diameter=clamp(gaugeStart+Math.round((e.clientX-gaugeX)/(canvas.clientWidth*.08)),0,5);redraw();return;}
    if(count===3){inspectVessel((e.clientX-gaugeX)*.014);gaugeX=e.clientX;return;}
    if(studio.ray(e).ray.intersectPlane(plane,point)){
      const pos=pieces[selected].item.position;pos.copy(point).add(offset);
      pos.x=clamp(pos.x,-3.45,3.45);pos.y=clamp(pos.y,.22,3.18);redraw();
    }
  });
  ctx.listen(canvas,'pointerup',e=>{if(e.pointerId===drag){drag=null;attempt();}});
  const cancel=e=>{if(e.pointerId===drag)drag=null;};
  ctx.listen(canvas,'pointercancel',cancel);ctx.listen(canvas,'lostpointercapture',cancel);
  ctx.shortcuts.textContent='在玉弧上横拖收放口规，吻合后定径。也可用左右键和 Enter。';
  message('借上场取得的玉口规，补上朝向你的这半圈器口。');redraw();
  return {layout,key(e){
    const k=e.key.toLowerCase();
    if(count===3){if(k==='arrowleft'||k==='arrowright'){inspectVessel(k==='arrowleft'?-.4:.4);return true;}return false;}
    if(!calibrated){
      if(k==='arrowleft'||k==='arrowright'){changeDiameter(k==='arrowleft'?-1:1);return true;}
      if(k==='enter'){prepare();return true;}return false;
    }
    if(k==='q'||k==='r'){rotate(k==='q'?1:-1);return true;}
    if(k==='enter'){attempt();return true;}
    if('123'.includes(k)&&k.length===1){select(Number(k)-1);return true;}
    const steps={arrowleft:[-.18,0],arrowright:[.18,0],arrowup:[0,.18],arrowdown:[0,-.18]};
    if(!steps[k])return false;
    const [dx,dy]=steps[k],p=pieces[selected].item.position;
    p.x=clamp(p.x+dx,-3.45,3.45);p.y=clamp(p.y+dy,.22,3.18);redraw();return true;
  }};
}

export function readBronze(ctx){
  const {studio,button,sound,message}=ctx,art=birdBench(studio.scene);
  const frame=art.bird.parent;
  art.bird.getObjectByName('Exhibition support').visible=false;
  studio.key.position.set(-2.4,3.9,5.4);
  const supportMaterial=new T.MeshStandardMaterial({color:0xb69865,roughness:.92});
  const metal=new T.MeshStandardMaterial({color:0x64543d,roughness:.5,metalness:.45});
  const rail=new T.Mesh(new T.BoxGeometry(2.05,.07,.22),metal);
  rail.position.y=.75;rail.castShadow=true;frame.add(rail);
  const socket=new T.Mesh(new T.CylinderGeometry(.24,.16,.17,24),metal);
  socket.position.y=.66;frame.add(socket);
  const mounts=[-.84,-.46].map(x=>{
    const mount=new T.Group();
    const stem=new T.Mesh(new T.CylinderGeometry(.035,.058,.57,12),metal);
    const saddle=new T.Mesh(new T.CapsuleGeometry(.092,.28,4,12),supportMaterial);
    saddle.rotation.x=Math.PI/2;saddle.position.y=.29;
    mount.add(stem,saddle);frame.add(mount);mount.position.set(x,1.03,0);
    return mount;
  });
  let active=0,angle=0,pointer=null,lastX=0,startY=0,testing=false,marked=false,gesture='';
  const tailPoint=new T.Vector3(1.18,-.60,.10);
  const tailTag=document.createElement('button');tailTag.className='at-tail-tag';
  tailTag.type='button';tailTag.textContent='标出薄尾';ctx.overlay.append(tailTag);
  const tailLayout=()=>{
    tailTag.hidden=marked||Math.abs(angle)<.4;
    if(!tailTag.hidden)markAt(tailTag,art.bird.localToWorld(tailPoint.clone()),studio);
  };
  ctx.listen(tailTag,'click',()=>{
    marked=true;angle=0;ctx.step(1);draw();
    message('折垂的尾端已标出。拖两只衬托移到胸腹下方，再把铜鸟向下拖，观察哪端先受力。');
  });
  const names=['胸下衬托','腹下衬托'],center=-.14;
  const gauge=instrument(ctx,'支承跨度'),pressure=instrument(ctx,'正在调整');
  const select=button('切换到腹托',()=>choose(1-active),{name:'support-select'});
  button('← 移动',()=>shift(-.12),{name:'support-left'});
  button('移动 →',()=>shift(.12),{name:'support-right'});
  button('侧转观察',()=>{if(testing)return;angle=Math.abs(angle)<.4?.75:0;draw();},{name:'support-view'});
  button('缓降试托',test,{primary:true,name:'support-test'});
  function draw(){
    art.update(angle);gauge((mounts[1].position.x-mounts[0].position.x).toFixed(2)+' 格',null);
    pressure(names[active],null);select.setAttribute('aria-label',active?'切换到胸托':'切换到腹托');
    select.textContent=active?'切换到胸托':'切换到腹托';
    mounts.forEach((mount,i)=>mount.children[0].scale.setScalar(i===active?1.2:1));
    tailLayout();ctx.readout.textContent=marked?names[active]+'　'+mounts[active].position.x.toFixed(2)+' 格':Math.abs(angle)<.4?'横拖铜鸟，从侧面找折垂的薄尾':'已转到侧面　·　在折垂处标记';ctx.redraw();
  }
  function choose(which){if(testing)return;active=which;draw();}
  function shift(delta){
    if(testing)return;
    const x=mounts[active].position.x;
    mounts[active].position.x=active?clamp(x+delta,mounts[0].position.x+.16,.93):clamp(x+delta,-1,mounts[1].position.x-.16);
    sound('clay-turn',.32);draw();
  }
  function test(){
    if(testing||!ctx.enabled())return;
    if(!marked){message('先从侧面看这件复制品，标出需要避让的薄尾，再试托。');return;}
    testing=true;ctx.step(2);
    const a=mounts[0].position.x,b=mounts[1].position.x;
    const balanced=a<center-.18&&b>center+.19&&a>-.66&&b<.60;
    const tilt=center>b?-.22:center<a?.22:a<-.66?.14:b>.60?-.14:.07;
    sound(balanced?'bronze-register':'rope',.6);
    message(balanced?'两点都落在厚实的躯干部，重心夹在两托之间。铜鸟平稳就位。':b<=center+.19?'腹托太靠前，尾端下沉。把腹托向右移到腹下。':a<=-.66?'胸托顶住细颈，遇力容易受损。把胸托向右收进躯干。':b>=.60?'腹托碰到薄尾，把它稍微往左收。':'两个托点太近。把胸托向左移到胸部下方。');
    const pose=t=>{art.bird.position.y=1.69-.16*t;art.bird.rotation.z=balanced?0:tilt*t;ctx.redraw();};
    ctx.animate(450,pose);
    if(balanced){ctx.after(()=>ctx.finish('支护图已就位。西岸保护棚的象牙更脆弱，先在原位记录。',650),500);}
    else ctx.after(()=>{ctx.animate(320,t=>pose(1-t));ctx.after(()=>{testing=false;ctx.step(1);draw();},330);},680);
  }
  const canvas=studio.canvas;
  ctx.listen(canvas,'pointerdown',e=>{
    if(e.button!==0||testing)return;canvas.focus();canvas.setPointerCapture(e.pointerId);
    const area=canvas.getBoundingClientRect();
    const screen=mounts.map(m=>studio.project(m.getWorldPosition(new T.Vector3())));
    const nearRail=(e.clientY-area.top)/area.height>Math.min(...screen.map(p=>p.y))-.085;
    gesture=marked&&nearRail?'rail':'bird';
    if(gesture==='rail')choose(Math.abs((e.clientX-area.left)/area.width-screen[0].x)<Math.abs((e.clientX-area.left)/area.width-screen[1].x)?0:1);
    pointer=e.pointerId;lastX=e.clientX;startY=e.clientY;
  });
  ctx.listen(canvas,'pointermove',e=>{
    if(pointer!==e.pointerId||testing)return;
    const dx=e.clientX-lastX;lastX=e.clientX;
    if(gesture==='rail')shift(dx/Math.max(1,canvas.clientWidth)*5.6);
    else if(marked&&e.clientY-startY>Math.min(58,canvas.clientHeight*.16)){pointer=null;test();}
    else{angle=clamp(angle+dx*.012,-1.22,1.22);draw();}
  });
  const release=()=>{pointer=null;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])ctx.listen(canvas,event,release);
  ctx.shortcuts.textContent='横拖铜鸟侧看；拖衬托调整，向下拖铜鸟试托。也可用下方按钮。';
  message('先横拖铜鸟约半个翼幅，或选侧转观察。找出折垂的薄尾并标记，这个部位不能承重。');draw();
  return {layout:tailLayout,key(e){
    if(e.repeat&&e.key==='Enter')return true;
    if(e.key==='1'||e.key==='2'){choose(Number(e.key)-1);return true;}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const d=e.key==='ArrowLeft'?-1:1;if(marked)shift(d*.12);else{angle=clamp(angle+d*.25,-1.22,1.22);draw();}return true;}
    if(e.key==='Enter'){test();return true;}return false;
  }};
}
