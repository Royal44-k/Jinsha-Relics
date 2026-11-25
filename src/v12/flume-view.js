import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {grains,sample} from './flume-physics.js';

// A single camera projects both instrument handles and the sampling window.
export function flumeView(host,handles){
  const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.className='fl-canvas';
  canvas.setAttribute('aria-label','古河水槽剖面。拖动空白处环看，方向键转动视角。');host.prepend(canvas);
  let gl=null,scene,camera,gate,ladle,ripples,dots=[],bed=[],gateNum=32,tilt=0,flowTime=0;
  const homeAngle=.26,homePitch=.29;
  let angle=homeAngle,pitch=homePitch,layoutDirty=true,dead=false,queued=0,batch=null,layers=[],software=false;
  let ctx=null,alternate=null;const cleanups=[];const v=new T.Vector3(),dummy=new T.Object3D();
  const life=new AbortController(),on=(el,ev,fn)=>el.addEventListener(ev,fn,{signal:life.signal});
  function material(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.83,...extra});}
  function bar(x,y,z,w,h,d,m,parent=scene){
    const shape=new T.Mesh(new T.BoxGeometry(w,h,d),m);shape.position.set(x,y,z);parent.add(shape);return shape;
  }
  function fallback(){
    if(dead||ctx)return;
    alternate=document.createElement('canvas');alternate.className='fl-fallback';host.prepend(alternate);
    alternate.setAttribute('aria-label','水槽正面剖面，取样窗位于两条铜线之间。');
    ctx=alternate.getContext('2d');canvas.hidden=true;layoutDirty=true;host.dispatchEvent(new Event('flume-cutaway'));dirty();
  }
  function init(){
    const options={alpha:true,antialias:true,powerPreference:'low-power'};
    const context=canvas.getContext('webgl2',options);if(!context){fallback();return;}
    gl=new T.WebGLRenderer({canvas,context,...options});gl.setClearColor(0,0);
    const debug=gl.getContext().getExtension('WEBGL_debug_renderer_info');
    software=debug&&/swiftshader|llvmpipe|software rasterizer/i.test(gl.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL));
    gl.setPixelRatio(software?.82:Math.min(1.5,devicePixelRatio||1));gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.16;
    scene=new T.Scene();camera=new T.OrthographicCamera(-4,4,2,-2,.1,60);
    scene.add(new T.HemisphereLight(0xe4f0e1,0x726250,1.75));
    const key=new T.DirectionalLight(0xffdfae,2.45);key.position.set(-3,5,4);scene.add(key);
    const rim=new T.DirectionalLight(0x9ec8c0,1.1);rim.position.set(3,2,-3);scene.add(rim);
    const bronze=material(0xaf9467,{metalness:.49,roughness:.40}),black=material(0x323631,{metalness:.27}),wood=material(0xbfa783),soil=material(0xd3bda1);
    function surface(m,name,tile){
      const map=new T.TextureLoader().load('/assets/v10/workshop/'+name+'.jpg',texture=>{
        if(dead)return;texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
        texture.repeat.set(...tile);m.map=texture;m.needsUpdate=true;dirty();
      },undefined,()=>{});
      cleanups.push(()=>map.dispose());
    }
    surface(soil,'clay',[3.1,1]);surface(wood,'wood',[1.2,1]);
    bar(0,-.11,0,6.6,.22,1.34,black);bar(0,.037,0,6.36,.074,1.14,soil);
    for(const x of [-2.73,0,2.73]){bar(x,-.28,0,.24,.19,1.68,wood);bar(x,-.40,0,.48,.06,1.76,bronze);}
    const waterMat=new T.MeshStandardMaterial({color:0x79bba9,roughness:.34,transparent:true,opacity:.14,depthWrite:false,side:T.FrontSide});
    const water=bar(0,.78,0,6.36,1.40,1.12,waterMat);water.renderOrder=2;
    for(const z of [-.62,.62]){
      bar(0,.02,z,6.6,.073,.065,bronze);bar(0,1.64,z,6.6,.049,.047,bronze);
      for(const x of [-3.21,3.21])bar(x,.83,z,.067,1.66,.064,black);
    }
    const glass=bar(0,.79,-.63,6.38,1.58,.025,new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false}));
    const colors=[],p=glass.geometry.attributes.position;
    const bottom=new T.Color(0x1d3634),top=new T.Color(0x759a86),color=new T.Color();
    for(let i=0;i<p.count;i++){color.copy(bottom).lerp(top,Math.max(0,Math.min(1,p.getY(i)/1.58+.5)));colors.push(color.r,color.g,color.b);}
    glass.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));glass.renderOrder=1;
    for(let i=0;i<=32;i++)bar(-3.13+i*.195,.02,-.58,.014,i%4?.12:.22,.04,bronze);
    for(const x of [sample.left,sample.right]){bar(x,.10,0,.035,.070,1.09,bronze);bar(x,.33,.61,.02,.52,.022,bronze);}
    bar((sample.left+sample.right)/2,.57,.61,sample.right-sample.left,.025,.022,bronze);
    gate=new T.Group();gate.position.x=-2.57;scene.add(gate);
    bar(0,1.16,0,.095,1.26,1.08,wood,gate);bar(-.073,1.4,0,.09,.075,1.16,bronze,gate);bar(0,1.92,0,.05,.52,.05,bronze,gate);
    for(const z of [-.59,.59])bar(-2.57,1.16,z,.13,2.29,.095,black);
    bar(-2.57,2.30,0,.14,.09,1.27,bronze);
    const wheel=new T.Mesh(new T.TorusGeometry(.147,.025,8,28),bronze);wheel.position.set(-2.57,2.21,.68);scene.add(wheel);
    for(let i=0;i<3;i++){const spoke=bar(-2.57,2.21,.68,.273,.018,.022,bronze);spoke.rotation.z=i*Math.PI/3;}
    for(const x of [-3.20,-2.57,3.20])for(const y of [.06,1.60]){
      const pin=new T.Mesh(new T.CylinderGeometry(.038,.038,.032,10),bronze);pin.position.set(x,y,.67);pin.rotation.x=Math.PI/2;scene.add(pin);
    }
    ladle=new T.Group();ladle.position.set(sample.source,1.91,-.10);scene.add(ladle);
    const bowl=new T.Mesh(new T.LatheGeometry([new T.Vector2(.09,0),new T.Vector2(.16,.03),new T.Vector2(.25,.20),new T.Vector2(.26,.24),new T.Vector2(.24,.24),new T.Vector2(.205,.15),new T.Vector2(.08,.034)],25),material(0xb5885e,{side:T.DoubleSide}));ladle.add(bowl);
    bar(-.3,.18,0,.4,.055,.065,wood,ladle);
    const stream=[];
    for(let j=0;j<4;j++)for(let i=0;i<12;i++){
      const x=-3.05+i*.49+Math.sin(i+5*j)*.12,z=j*.235-.34;
      stream.push(x,1.49,z,x+.09+.12*Math.abs(Math.cos(i+j)),1.49,z+.021*Math.sin(i+j*2));
    }
    const waveGeo=new T.BufferGeometry();waveGeo.setAttribute('position',new T.Float32BufferAttribute(stream,3));
    ripples=new T.LineSegments(waveGeo,new T.LineBasicMaterial({color:0xd2eee1,transparent:true,opacity:.41}));ripples.renderOrder=3;scene.add(ripples);
    // Keep calibrated ticks, frame joints and feet within one draw per material.
    const fixed=new Map();
    for(const mesh of scene.children.slice()){
      if(!mesh.isMesh||mesh.material.transparent)continue;
      mesh.updateMatrix();mesh.geometry.applyMatrix4(mesh.matrix);
      if(!fixed.has(mesh.material))fixed.set(mesh.material,[]);fixed.get(mesh.material).push(mesh.geometry);scene.remove(mesh);
    }
    for(const [mat,segments] of fixed){
      const merged=mergeGeometries(segments);scene.add(new T.Mesh(merged,mat));
      segments.forEach(g=>g.dispose());
    }
    for(const [i,grain] of grains.entries()){
      const geom=i===0?new T.DodecahedronGeometry(1,0):new T.IcosahedronGeometry(1,0);
      const m=new T.InstancedMesh(geom,material(grain.color,{emissive:grain.color,emissiveIntensity:.13}),36);m.count=0;m.frustumCulled=false;scene.add(m);dots.push(m);
    }
    on(canvas,'webglcontextlost',fallback);
  }
  function place(el,x,y,z){
    const w=host.clientWidth,h=host.clientHeight;
    if(ctx){el.style.left=((x+3.5)/7*92+4)+'%';el.style.top=(74-y*25)+'%';return;}
    v.set(x,y,z).project(camera);el.style.left=(v.x+1)*w*.5+'px';el.style.top=(1-v.y)*h*.5+'px';
  }
  function positionTags(){
    place(handles.gate,-2.62,2.35,.48);place(handles.pour,sample.source+.49,1.98,-.2);place(handles.window,.63,-.26,.62);
  }
  function configure(){
    layoutDirty=false;
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(ctx){alternate.width=w;alternate.height=h;}
    else{
      gl.setSize(w,h,false);const aspect=w/h,half=Math.max(1.78,3.89/aspect);
      camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
      camera.position.set(Math.sin(angle)*10*Math.cos(pitch),.96+10*Math.sin(pitch),Math.cos(angle)*10*Math.cos(pitch));
      camera.lookAt(0,.96,0);camera.updateMatrixWorld();
    }
    positionTags();
  }
  function updateParticles(){
    const written=[0,0,0];
    for(const p of batch?.particles||[]){if(p.state==='waiting'||p.state==='out')continue;
      dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.radius*1.21,p.radius*.84,p.radius);dummy.rotation.set(p.phase,p.x*.45,p.phase*.72);
      dummy.updateMatrix();dots[p.kind].setMatrixAt(written[p.kind]++,dummy.matrix);}
    for(const [i,mesh] of dots.entries()){mesh.count=written[i];mesh.instanceMatrix.needsUpdate=true;}
  }
  function paintFallback(){
    const w=alternate.width,h=alternate.height,g=ctx;g.clearRect(0,0,w,h);
    const x=n=>w*((n+3.5)/7*.92+.04),y=n=>h*(.74-n*.25);
    const water=g.createLinearGradient(0,y(1.48),0,y(.07));water.addColorStop(0,'#86b4a9a0');water.addColorStop(1,'#243e3cce');
    g.fillStyle=water;g.fillRect(x(-3.16),y(1.48),x(3.16)-x(-3.16),y(.07)-y(1.48));
    g.strokeStyle='#bb9e70';g.strokeRect(x(-3.2),y(1.67),x(3.2)-x(-3.2),y(0)-y(1.67));
    g.fillStyle='#ad9063';g.fillRect(x(-3.2),y(.075),x(3.2)-x(-3.2),5);
    g.strokeRect(x(sample.left),y(.43),x(sample.right)-x(sample.left),y(0)-y(.43));
    g.beginPath();for(let i=0;i<=32;i++){const gx=x(-3.13+i*.195);g.moveTo(gx,y(.06));g.lineTo(gx,y(i%4?.12:.20));}g.stroke();
    g.fillStyle='#8f704c';g.fillRect(x(-2.60),y(1.92),8,y(gateNum*.006)-y(1.92));
    g.save();g.translate(x(sample.source),y(1.85));g.rotate(-tilt);
    g.fillStyle='#c29266';g.beginPath();g.arc(0,0,Math.max(5,w*.018),0,Math.PI);g.fill();g.fillRect(-w*.041,-2,w*.033,3);g.restore();
    let base=.076;
    for(const layer of layers){g.fillStyle=layer.color;g.fillRect(x(sample.left),y(base+layer.height),x(sample.right)-x(sample.left),y(base)-y(base+layer.height));for(const grain of layer.landing){g.fillStyle=grains[grain.kind].color;g.fillRect(x(grain.x),y(base+layer.height*(grain.z+.5)),4,3);}base+=layer.height;}
    for(const p of batch?.particles||[]){if(p.state==='waiting'||p.state==='out')continue;g.fillStyle=grains[p.kind].color;g.beginPath();g.arc(x(p.x),y(p.y),Math.max(1.5,p.radius*w*.115),0,2*Math.PI);g.fill();}
  }
  function draw(){
    queued=0;if(dead||!host.clientWidth||!host.clientHeight)return;
    if(layoutDirty)configure();if(ctx){paintFallback();return;}
    gate.position.y=-.45+gateNum*.0068;ladle.rotation.z=tilt;
    ripples.position.x=flowTime%.49;updateParticles();gl.render(scene,camera);
  }
  function dirty(){if(!queued&&!dead)queued=requestAnimationFrame(draw);}
  function strata(next){
    layers=next;
    if(!ctx){
      for(const m of bed){scene.remove(m);if(m.isInstancedMesh)m.dispose();m.geometry.dispose();m.material.dispose();}bed=[];
      let base=.076;
      for(const l of layers){
        // Display every captured grain, in its actual along-stream position and
        // arrival order. An opaque cut face gives the slice a readable thickness.
        const block=bar((sample.left+sample.right)*.5,base+l.height/2,0,sample.right-sample.left,l.height,.96,material(l.color));bed.push(block);
        const geo=new T.IcosahedronGeometry(1,0),mat=material(0xffffff),n=l.landing.length;
        const scatter=new T.InstancedMesh(geo,mat,n);scatter.frustumCulled=false;
        for(const [j,p] of l.landing.entries()){
          dummy.position.set(p.x,base+.008+l.height*j/Math.max(1,n-1),.51+p.z*.1);
          dummy.scale.setScalar(grains[p.kind].size*.65);dummy.updateMatrix();scatter.setMatrixAt(j,dummy.matrix);
          scatter.setColorAt(j,new T.Color(grains[p.kind].color));}
        scene.add(scatter);bed.push(scatter);base+=l.height;
      }
    }
    dirty();
  }
  function orbit(dx,dy){if(ctx)return;angle=T.MathUtils.clamp(angle+dx,-.83,.83);pitch=T.MathUtils.clamp(pitch+dy,-.04,.69);layoutDirty=true;dirty();}
  let hand=null;
  on(canvas,'pointerdown',e=>{canvas.setPointerCapture(e.pointerId);hand={id:e.pointerId,x:e.clientX,y:e.clientY};});
  on(canvas,'pointermove',e=>{if(e.pointerId!==hand?.id)return;orbit((hand.x-e.clientX)*.008,(e.clientY-hand.y)*.006);hand.x=e.clientX;hand.y=e.clientY;});
  on(canvas,'lostpointercapture',()=>{hand=null;});
  on(canvas,'keydown',e=>{const d={ArrowLeft:[-.14,0],ArrowRight:[.14,0],ArrowUp:[0,.09],ArrowDown:[0,-.09],Home:[homeAngle-angle,homePitch-pitch]}[e.key];if(d){e.preventDefault();e.stopPropagation();orbit(...d);}});
  try{init();}catch{fallback();}
  const resize=new ResizeObserver(()=>{layoutDirty=true;dirty();});resize.observe(host);dirty();
  return {setGate(n){gateNum=n;dirty();},setTilt(n){tilt=n;dirty();},paint(p,t){batch=p;flowTime=t;dirty();},strata,
    get software(){return software||Boolean(ctx);},get flat(){return Boolean(ctx);},
    resetCamera(){angle=homeAngle;pitch=homePitch;layoutDirty=true;dirty();},
    dispose(){
      dead=true;life.abort();cancelAnimationFrame(queued);resize.disconnect();for(const m of cleanups)m();
      if(scene){const assets=new Set();scene.traverse(o=>{if(o.geometry)assets.add(o.geometry);if(o.material)assets.add(o.material);if(o.isInstancedMesh)o.dispose();});for(const a of assets)a.dispose();}
      gl?.dispose();gl?.forceContextLoss();canvas.remove();alternate?.remove();
    }};
}
