import * as T from 'three';

// A wall fragment cut from a wheel-formed vessel. The original lip, exterior,
// interior and broken edges are independent faces and can be picked in 3D.
function fragment(repaint) {
  const group=new T.Group(), faces=[[],[],[],[]],uvs=[[],[],[],[]], cols=32,rows=22;
  const lower=[-.30,-.47,-.42,-.70,-.59,-.90,-.81,-1.06,-.80,-.89,-.63,-.69,-.37];
  function vertex(i,j,inner){
    const u=i/cols,v=j/rows,k=u*(lower.length-1),n=Math.floor(k);
    const bottom=T.MathUtils.lerp(lower[n],lower[Math.min(n+1,lower.length-1)],k-n);
    const y=T.MathUtils.lerp(bottom,.78+.022*Math.sin(u*8.2),v);
    const angle=(u-.5)*(.89+.34*v)+.007*Math.sin(j*1.78)*(1-v)**2;
    const rim=.15*Math.exp(-(((1-v)/.13)**2));
    const r=2.04+.18*v+rim-(inner?.115+rim*.7:0);
    return [r*Math.sin(angle),y,r*Math.cos(angle)-1.91];
  }
  function quad(face,a,b,c,d) {
    for(const v of [a,b,d,b,c,d]){faces[face].push(...v);uvs[face].push(v[0]*1.15+v[2]*.35,v[1]*1.15+v[2]*.5);}
  }
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const a=vertex(i,j,false),b=vertex(i+1,j,false),c=vertex(i+1,j+1,false),d=vertex(i,j+1,false);
    const ai=vertex(i,j,true),bi=vertex(i+1,j,true),ci=vertex(i+1,j+1,true),di=vertex(i,j+1,true);
    quad(0,a,b,c,d);quad(1,bi,ai,di,ci);
    if(j===rows-1){
      const rounded=(outer,inside,k)=>outer.map((v,m)=>T.MathUtils.lerp(v,inside[m],k)+(m===1?.078*Math.sin(k*Math.PI):0));
      for(let step=0;step<6;step++){
        const t=step/6,next=(step+1)/6,p=rounded(d,di,t),q=rounded(c,ci,t),r=rounded(c,ci,next),s=rounded(d,di,next);
        quad(2,p,q,r,s);
        if(i===0)quad(3,di,p,s,di);if(i===cols-1)quad(3,ci,r,q,ci);
      }
    }
    if(j===0)quad(3,ai,bi,b,a);
    if(i===0)quad(3,ai,a,d,di);
    if(i===cols-1)quad(3,b,bi,ci,c);
  }
  const tile=document.createElement('canvas');tile.width=tile.height=192;
  const g=tile.getContext('2d'),data=g.createImageData(192,192);let seed=77192;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  for(let y=0;y<192;y++)for(let x=0;x<192;x++){
    const fleck=rand(),tone=202+rand()*25+8*Math.cos(y*.32+Math.sin(x*.09))+(fleck>.985?24:fleck<.025?-74:0);
    const p=4*(y*192+x);data.data.set([tone,tone-6,tone-13,255],p);
  }
  g.putImageData(data,0,0);
  const grain=new T.CanvasTexture(tile);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.colorSpace=T.SRGBColorSpace;
  const materials=[0xca8961,0xaf7555,0xe0a678,0xbb8e71].map((color,i)=>new T.MeshStandardMaterial({
    color,map:grain,bumpMap:grain,bumpScale:i===3?.045:.012,roughness:i===2?.71:.92,side:T.DoubleSide
  }));
  let disposed=false;
  const earth=new T.TextureLoader().load('/assets/v10/workshop/clay.jpg',map=>{
    if(disposed)return;map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.repeat.set(.45,.45);
    const tones=[0xe9c8ad,0xc6b2a2,0xf2d6ab,0xe4cabc];
    for(const [i,m] of materials.entries()){m.map=map;m.color.setHex(tones[i]);m.needsUpdate=true;}
    repaint();
  },undefined,()=>{});
  for(const [i,list] of faces.entries()){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(list,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uvs[i],2));geo.computeVertexNormals();
    const part=new T.Mesh(geo,materials[i]);part.userData.part=i;group.add(part);
  }
  return {group,anchors:[new T.Vector3(...vertex(17,rows,false)),new T.Vector3(...vertex(cols,11,false))],dispose(){disposed=true;earth.dispose();for(const mesh of group.children)mesh.geometry.dispose();for(const m of materials)m.dispose();grain.dispose();}};
}

export function inspectSherd(ctx,host,onEvidence) {
  const box=document.createElement('div');box.className='fw-object-table';host.append(box);
  const caption=document.createElement('span');caption.className='fw-object-label';caption.textContent='乙号取样　／　夹砂陶片 · 教学模型';box.append(caption);
  const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','旋转陶片。拖动或按方向键翻转，轻触口沿和断面留下观察记录。');box.prepend(canvas);
  let renderer=null,scene,camera,model,drag=null,pitch=.22,yaw=-.28,frame=0,closed=false,visible=true;
  const tags=['口缘','断面'].map((label,i)=>{
    const tag=document.createElement('button');tag.type='button';tag.hidden=true;tag.className='fw-clay-tag';tag.textContent=label;
    tag.setAttribute('aria-label','在模型上标记'+label);ctx.on(tag,'click',()=>evidence(i===0?2:3));box.append(tag);return tag;
  });
  const at=new T.Vector3(),normal=new T.Vector3(),sight=new T.Vector3();
  let zoom=false;const yawMax=Math.PI,ray=new T.Raycaster();
  function paint(){
    frame=0;if(closed||!visible||!renderer||canvas.hidden)return;
    const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;
    const ratio=Math.min(1.5,devicePixelRatio||1);
    if(canvas.width!==Math.floor(w*ratio)||canvas.height!==Math.floor(h*ratio)){renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);}
    camera.aspect=w/h;camera.position.z=(zoom?3.05:4.05)*Math.max(1,1.2/camera.aspect);camera.updateProjectionMatrix();
    model.group.rotation.set(pitch,yaw,0,'YXZ');renderer.render(scene,camera);canvas.dataset.painted='true';
    for(const [i,tag] of tags.entries()){
      at.copy(model.anchors[i]).applyMatrix4(model.group.matrixWorld);
      normal.set(i,1-i,0).applyQuaternion(model.group.quaternion);sight.copy(camera.position).sub(at).normalize();const facing=normal.dot(sight);
      at.project(camera);tag.hidden=facing<.31||Math.abs(at.x)>.91||Math.abs(at.y)>.90;
      if(!tag.hidden){tag.style.left=(at.x+1)*50+'%';tag.style.top=(1-at.y)*50+'%';}
    }
  }
  function dirty(){if(!frame&&!closed&&visible)frame=requestAnimationFrame(paint);}
  function usePhoto(){
    canvas.hidden=true;box.classList.add('fw-object-static');for(const tag of tags)tag.hidden=true;
    caption.textContent='乙号取样　／　夹砂陶片 · 静态观察图版';
  }
  ctx.on(canvas,'webglcontextlost',()=>{if(!closed)usePhoto();});
  try{
    renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0,0);
    scene=new T.Scene();camera=new T.PerspectiveCamera(36,1,.1,25);
    scene.add(new T.HemisphereLight(0xe7ead7,0x816756,1.6));const key=new T.DirectionalLight(0xffead2,2.65);key.position.set(-3,4,3);scene.add(key);
    const rim=new T.DirectionalLight(0xffe1ad,1.1);rim.position.set(2,.2,-2);scene.add(rim);
    model=fragment(dirty);scene.add(model.group);canvas.dataset.render='mesh';
  }catch{
    renderer?.dispose();renderer=null;usePhoto();
  }
  function turn(dx,dy){yaw=(yaw+dx)%(yawMax*2);pitch=T.MathUtils.clamp(pitch+dy,-1.45,1.45);dirty();}
  ctx.on(canvas,'pointerdown',e=>{canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,length:0};});
  ctx.on(canvas,'pointermove',e=>{if(drag?.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.length+=Math.hypot(dx,dy);turn(dx*.012,dy*.012);drag.x=e.clientX;drag.y=e.clientY;});
  function evidence(part){
    const lip=part===2,fracture=part===3;
    if(!lip&&!fracture){ctx.tip('这是器壁。试着翻到上方连续的口边，或下方锯齿状的破面。');return;}
    onEvidence(lip?'rim':'break');
  }
  ctx.on(canvas,'pointerup',e=>{if(drag?.id!==e.pointerId)return;const tap=drag.length<7;drag=null;if(!tap||!renderer)return;
    const b=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
    const hit=ray.intersectObjects(model.group.children,false)[0];if(hit)evidence(hit.object.userData.part);});
  for(const type of ['pointercancel','lostpointercapture'])ctx.on(canvas,type,()=>{drag=null;});
  ctx.on(canvas,'keydown',e=>{const d={ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowDown:[0,.18],ArrowUp:[0,-.18]}[e.key];
    if(d){e.preventDefault();e.stopPropagation();turn(...d);}});
  const observer=new ResizeObserver(dirty);observer.observe(box);dirty();
  return {
    landmark(id){pitch=id==='rim'?.72:-.56;yaw=id==='rim'?-.30:-.90;dirty();evidence(id==='rim'?2:3);},
    zoom(){zoom=!zoom;box.classList.toggle('magnified',zoom);dirty();return zoom;},
    show(value){visible=value;box.hidden=!value;if(value)dirty();},
    dispose(){closed=true;observer.disconnect();cancelAnimationFrame(frame);model?.dispose();renderer?.dispose();renderer?.forceContextLoss();box.remove();}
  };
}
