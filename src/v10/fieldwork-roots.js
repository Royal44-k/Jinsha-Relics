import {rootTrace} from './fieldwork-root-trace.js';
import * as T from 'three';
import { compareSections, prepareSections } from './fieldwork-microscope.js';
import { growCrown } from './fieldwork-canopy.js';
import { prepareCrownFilm } from './fieldwork-film.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fieldStudio, disposeGraph, seeded, mat, mesh, rod, V, joinFixedProps, useVertexLighting } from './fieldwork-studio.js';

const stations = [
  {name:'甲',x:-3.06,z:.39}, {name:'乙',x:.83,z:-2.27},
  {name:'丙',x:2.96,z:-.47}, {name:'丁',x:-.48,z:2.39}
];
const pegHeight=1.24;
const pointOf = p => V(p.x,pegHeight,p.z);

function shapedRoot(points,baseRadius,endRadius,lift,ridges){
  const curve=new T.CatmullRomCurve3(points);
  const length=curve.getLength(),along=Math.max(10,Math.ceil(length*13)),sides=ridges?20:9;
  const position=[],uv=[],index=[];
  for(let i=0;i<=along;i++){
    const t=i/along,center=curve.getPointAt(t),axis=curve.getTangentAt(t);
    const lateral=V(axis.z,0,-axis.x).normalize(),up=lateral.clone().cross(axis).negate().normalize();
    const radius=T.MathUtils.lerp(endRadius,baseRadius,Math.pow(1-t,.82));
    for(let j=0;j<=sides;j++){
      const a=j/sides*Math.PI*2;
      const relief=1+(ridges?.08:.035)*Math.sin(a*5+t*3.7)+.035*Math.cos(a*3-t*8);
      const vertex=center.clone().addScaledVector(lateral,Math.cos(a)*radius*relief).addScaledVector(up,Math.sin(a)*radius*lift*relief);
      position.push(vertex.x,vertex.y,vertex.z);uv.push(t*length*.75,j/sides*1.3);
      if(i<along&&j<sides){const n=i*(sides+1)+j;index.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

export function buildRoots(ctx,studio){
  const {scene,texture}=studio,rng=seeded(416);
  const bark=texture('/assets/environment/bark_brown_02_diff_1k.webp'),normal=texture('/assets/environment/bark_brown_02_nor_gl_1k.webp','normal');
  const wood=mat(0xcab89b,.87,{map:bark,normalMap:normal,normalScale:new T.Vector2(.65,.65)});
  const soil=texture('/assets/environment/forest_floor_diff_1k.webp','color',[4,4]),soilNormal=texture('/assets/environment/forest_floor_nor_gl_1k.webp','normal',[4,4]);
  const slab=mesh(scene,new T.BoxGeometry(16,.42,13),mat(0x948476,.96,{map:soil,normalMap:soilNormal,normalScale:new T.Vector2(.48,.48)}),V(0,-.24,-.3));
  const ramp=mesh(scene,new T.BoxGeometry(20,.24,17),mat(0x594c3f,.95),V(0,-.61,-.3));ramp.rotation.y=-.018;
  const pieces=[];
  const rootEnds=[...stations,{x:1.62,z:1.53},{x:-1.45,z:-1.47},{x:2.12,z:.85},{x:-1.74,z:1.36}];
  for(const [i,tip] of rootEnds.entries()){
    const end=V(tip.x,.065,tip.z),out=end.clone().setY(0).normalize(),side=V(out.z,0,-out.x);
    const mid=end.clone().multiplyScalar(.42).addScaledVector(side,.24*Math.sin(i*2+.2)).setY(.15);
    const elbow=end.clone().multiplyScalar(.74).addScaledVector(side,-.25*Math.cos(i*2+.2)).setY(.07);
    const path=[out.clone().multiplyScalar(.28).setY(.37),mid,elbow,end];
    pieces.push(shapedRoot(path,i<4?.39:.29,.018,i<4?.85:.72,true));
    const curve=new T.CatmullRomCurve3(path);
    for(let k=0;k<4;k++){
      const branch=curve.getPointAt(.3+k*.13),sign=k%2?1:-1;
      const tail=branch.clone().addScaledVector(out,.45+rng()*.52).addScaledVector(side,sign*(.24+.44*rng())).setY(.025);
      const bend=branch.clone().lerp(tail,.57).addScaledVector(side,sign*.12).setY(.07);
      pieces.push(shapedRoot([branch,bend,tail],.105-k*.012,.009,.71,false));
      const twig=bend.clone().lerp(tail,.6).addScaledVector(side,sign*(.14+rng()*.19)).setY(.02);
      pieces.push(shapedRoot([bend,bend.clone().lerp(twig,.45).setY(.046),twig],.035,.006,.7,false));
    }
  }
  const combined=mergeGeometries(pieces);mesh(scene,combined,wood);pieces.forEach(g=>g.dispose());
  const fallback=mesh(scene,new T.CylinderGeometry(.54,.78,.74,31,6),wood,V(0,.36,0));fallback.scale.z=.89;
  new GLTFLoader().load('/assets/v10/tree-root-lod.gltf',gltf=>{
    if(ctx.closed){disposeGraph(gltf.scene);return;}
    gltf.scene.scale.setScalar(2.15);gltf.scene.position.set(.035,.19,-.025);gltf.scene.rotation.y=.26;
    scene.add(gltf.scene);fallback.visible=false;studio.invalidate();
  },undefined,()=>{ /* The hand-modeled crown and radial roots stay in view. */ });
  // A soft contact mat fixes the scanned specimen to the earthen bed.
  const shade=document.createElement('canvas');shade.width=shade.height=96;const brush=shade.getContext('2d'),gradient=brush.createRadialGradient(48,48,4,48,48,47);
  gradient.addColorStop(0,'rgba(40,26,17,.77)');gradient.addColorStop(.59,'rgba(37,28,20,.38)');gradient.addColorStop(1,'rgba(43,32,24,0)');
  brush.fillStyle=gradient;brush.fillRect(0,0,96,96);
  const shadow=mesh(scene,new T.PlaneGeometry(5.5,4.6),new T.MeshBasicMaterial({map:new T.CanvasTexture(shade),transparent:true,depthWrite:false}),V(0,-.021,0));shadow.rotation.x=-Math.PI/2;
  const gravel=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),mat(0xffffff,.94),400),dummy=new T.Object3D(),tint=new T.Color();
  for(let i=0;i<gravel.count;i++){
    const x=(rng()-.5)*10,z=(rng()-.5)*8,r=.014+.08*rng();dummy.position.set(x,-.028,z);dummy.rotation.set(rng(),rng()*6,rng());
    dummy.scale.set(r*1.5,r*.45,r);dummy.updateMatrix();gravel.setMatrixAt(i,dummy.matrix);
    gravel.setColorAt(i,tint.setHSL(.09+rng()*.015,.12+rng()*.12,.24+rng()*.18,T.SRGBColorSpace));
  }scene.add(gravel);
  const dowel=mat(0x8c7860),cord=mat(0xbda97b),graduations=mat(0xd2bb85),varnish=mat(0x563e31);
  for(const p of stations){
    rod(scene,V(p.x,-.03,p.z),pointOf(p).add(V(0,.07,0)),.044,dowel,.037,12);
    for(const [j,h] of [.25,.52,.79,1.06].entries())rod(scene,V(p.x,h,p.z),V(p.x,h+.05,p.z),.047,j%2?graduations:varnish,.047,12);
    const loop=mesh(scene,new T.TorusGeometry(.058,.016,6,16),cord,pointOf(p));loop.rotation.x=Math.PI/2;
  }
  const border=[V(-4.38,.12,-3.22),V(4.38,.12,-3.22),V(4.38,.12,3.22),V(-4.38,.12,3.22)];
  for(const [i,p] of border.entries()){
    rod(scene,p.clone().setY(-.03),p.clone().setY(.32),.05,dowel,.045,8);
    rod(scene,p,border[(i+1)%4],.011,cord);
  }
  const board=new T.Group();board.position.set(-.15,.016,2.92);scene.add(board);
  for(let i=0;i<10;i++)mesh(board,new T.BoxGeometry(.20,.028,.10),i%2?varnish:graduations,V(-1+i*.20,0,0));
  joinFixedProps(board);joinFixedProps(scene,[fallback,slab,ramp,shadow]);
  if(studio.software)useVertexLighting(scene);
  return slab;
}

export function surveyRoots(ctx){
  const studio=fieldStudio(ctx,{background:0x695f4e,sky:0xf2dfbd,bounce:0x5f6e53,key:0xffdea5,zoom:3.7,fog:.024});
  const {scene,camera,canvas}=studio;studio.minimumWidth(4.65);
  prepareSections();buildRoots(ctx,studio);ctx.section.dataset.fieldPhase='wood';
  const driftwood=mat(0x3d3023,.94,{map:studio.texture('/assets/environment/bark_brown_02_diff_1k.webp')});
  const looseA=V(-2.49,.13,-1.43),looseB=V(-1.22,.19,-1.86);
  rod(scene,looseA,looseB,.14,driftwood,.10,12);
  rod(scene,V(-1.97,.17,-1.61),V(-2.08,.39,-1.95),.074,driftwood,.028,9);
  canvas.setAttribute('aria-label','古木根盘。拖动环看，检查根部样点或游离木段。');
  const head=document.createElement('strong'),sub=document.createElement('span');ctx.read.append(head,sub);
  head.textContent='寻找原位木样';sub.textContent='观察木段与根盘是否相连';
  ctx.tip('古河床里既有阴沉木，也有大型树根。若要追问这棵树的身份，先看哪处木样还连着原来的根盘。');
  let desired=.23,angle=desired,drag=null,phase='wood',growth=null,film=null,elapsed=0,previous=-1,revision=-1,poster=null,showLandscape=null;
  function orbit(amount){desired+=amount;}
  function tag(title,text,point,activate){
    const b=document.createElement('button');b.type='button';b.className='fw-root-tag';b.textContent=text;b.setAttribute('aria-label',title);ctx.overlay.append(b);ctx.on(b,'click',activate);return {b,point};
  }
  const samples=[
    tag('检查游离木段','游离木段',looseA.clone().lerp(looseB,.5).setY(.51),()=>{
      head.textContent='受水流搬运的可能';sub.textContent='游离木段 · 记录关联不足';
      ctx.tip('两端断开，旁边没有与它相连的侧根。漂移木也记录环境，但单凭它无法确认眼前这座根盘的树种。');ctx.cue('brush');
    }),
    tag('采集根部样本','根部样点',V(1.71,.40,-.19),openTrace)
  ];
  const woodButtons=[ctx.button('向左环看',()=>orbit(-.38)),ctx.button('向右环看',()=>orbit(.38))];
  let microscope=null,sampled=false;
  const tracer=rootTrace(ctx,canvas,camera,()=>{sampled=true;toMicroscope();});
  const traceButtons=[ctx.button('沿根进样',()=>tracer.assist()),ctx.button('返回查看根盘',showWood)];
  const replayGrowth=ctx.button('重看树冠生长',reconstruct),toForest=ctx.button('看古林复原',showForest);
  const reviewMicro=ctx.button('返回显微镜',toMicroscope),store=ctx.button('收存秋枫鉴定标本',()=>ctx.finish());
  function showWood(){
    phase='wood';elapsed=0;revision=-1;ctx.section.dataset.fieldPhase='wood';ctx.step?.(1,4,'找仍连在原处的根');
    ctx.tools.replaceChildren(...woodButtons);ctx.overlay.replaceChildren(...samples.map(s=>s.b));
    head.textContent='寻找原位木样';sub.textContent='观察木段与根盘是否相连';
    ctx.tip('拖动地面环看根盘。在取样前辨认游离木段和连在根盘上的侧根。');
  }
  function openTrace(){
    phase='sample';elapsed=0;revision=-1;desired=.23;ctx.section.dataset.fieldPhase='core';ctx.step?.(2,4,'沿侧根追到根盘');
    ctx.tools.replaceChildren(...traceButtons);tracer.show();head.textContent='保留原位关系';sub.textContent='侧根末端　→　根盘';
    ctx.tip('按住取样环，沿标出的侧根拖向根盘，留下它与树体相连的记录。使用「沿根进样」也可分段操作。');
    if(sampled)ctx.tools.prepend(continueSlide);
  }
  const continueSlide=ctx.button('继续观察已取切片',toMicroscope);
  function clearForest(){
    film?.stop();film=null;poster?.remove();poster=null;growth?.(0);elapsed=0;revision=-1;
  }
  function toMicroscope(){
    clearForest();phase='optics';ctx.overlay.replaceChildren();
    if(microscope)microscope();else microscope=compareSections(ctx,reconstruct,openTrace);
    if(!studio.software&&!reduced&&!growth&&!warmCrown){
      const prepare=()=>{
        warmCrown=0;
        if(ctx.closed||phase!=='optics'||growth)return;
        growth=growCrown(studio);growth(0);
        studio.renderer.compileAsync(scene,camera).catch(()=>{});
      };
      warmCrown=window.requestIdleCallback?window.requestIdleCallback(prepare,{timeout:1100}):setTimeout(prepare,100);
    }
  }
  function reconstruct(){
    clearForest();ctx.overlay.replaceChildren();film=(studio.software||reduced)?prepareCrownFilm(ctx,reduced):null;
    phase=film?'cinema':'growing';ctx.section.dataset.fieldPhase='reconstruction';ctx.step?.(4,4,'从木样重见古林');
    if(!film){ctx.section.dataset.crownMode='realtime';growth??=growCrown(studio);growth(0);}
    ctx.tools.replaceChildren(toForest,reviewMicro);showLandscape=toForest;showLandscape.hidden=true;
    head.textContent='秋枫';sub.textContent='Bischofia javanica　／　古环境复原';
    ctx.tip('研究人员将古根木样软化、制片并比对，鉴定为秋枫。眼前新梢、绿叶与树冠表现这一树种可能有过的生命形态。');
    ctx.cue('canopy-rise');poster=document.createElement('div');poster.className='fw-canopy-matte';poster.hidden=true;
    const caption=document.createElement('span');caption.textContent='秋枫古林　／　依据树种所作的环境想象';poster.append(caption);ctx.view.append(poster);
    film?.play(poster,()=>{showLandscape.hidden=false;showLandscape.focus({preventScroll:true});});
  }
  function showForest(){
    phase='forest';film?.stop();ctx.section.dataset.fieldPhase='forest';poster.hidden=false;
    head.textContent='回到旧河岸';sub.textContent='秋枫喜暖湿 · 游戏场景艺术复原';
    ctx.tip('根的位置和树种给河岸环境增添了线索。收好鉴定标本，沿南岸去找留在玉料上的加工痕迹。');
    ctx.tools.replaceChildren(store,replayGrowth,reviewMicro);store.focus({preventScroll:true});
  }
  showWood();
  ctx.on(canvas,'pointerdown',e=>{if(phase!=='wood')return;drag=e.clientX;canvas.setPointerCapture(e.pointerId);});
  ctx.on(canvas,'pointermove',e=>{if(drag===null||phase!=='wood')return;orbit((drag-e.clientX)*.009);drag=e.clientX;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])ctx.on(canvas,type,()=>{drag=null;});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,proj=V();
  let warmCrown=0;
  ctx.onClose(()=>{
    if(window.cancelIdleCallback)window.cancelIdleCallback(warmCrown);else clearTimeout(warmCrown);
  });
  ctx.frame(dt=>{
    if(phase==='optics'||phase==='forest'||phase==='cinema')return;
    const grow=phase==='growing';
    if(grow){
      elapsed+=dt;const t=Math.min(1,elapsed/(reduced?.25:4.1));growth(t);
      if(t===1){phase='grown';showLandscape.hidden=false;showLandscape.focus({preventScroll:true});}
    }
    angle=T.MathUtils.damp(angle,desired,14,dt);if(Math.abs(angle-desired)<.0015)angle=desired;
    if(!grow&&Math.abs(previous-angle)<.0001&&revision===studio.revision)return;
    previous=angle;revision=studio.revision;
    const up=T.MathUtils.smoothstep(elapsed,0,reduced?.25:4.1);
    camera.zoom=phase==='sample'?2.1:1-.25*up;camera.updateProjectionMatrix();camera.position.set(Math.sin(angle)*9.6,6.0+up*1.5,Math.cos(angle)*9.6);if(phase==='sample')camera.lookAt(1.08,.34,-.10);else camera.lookAt(0,.27+up*2.6,0);camera.updateMatrixWorld();
    if(phase==='sample')tracer.locate();
    if(phase==='wood')for(const {b,point} of samples){
      proj.copy(point).project(camera);b.style.left=((proj.x+1)*canvas.clientWidth/2)+'px';b.style.top=((1-proj.y)*canvas.clientHeight/2)+'px';
    }
    studio.render();
  });
}
