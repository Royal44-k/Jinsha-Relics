import * as T from 'three';

const tau=Math.PI*2;
const mat=(color,roughness=.78,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geometry,material,x=0,y=0,z=0){
  const object=new T.Mesh(geometry,material);object.position.set(x,y,z);parent.add(object);return object;
}
function lathe(profile,n=96){return new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),n);}
function loop(parent,r,t,m,x,y,z){
  const ring=mesh(parent,new T.TorusGeometry(r,t,6,68),m,x,y,z);
  ring.rotation.x=Math.PI/2;return ring;
}
function line(parent,a,b,r,m){
  const d=new T.Vector3().fromArray(b).sub(new T.Vector3(...a)),mid=new T.Vector3(...a).addScaledVector(d,.5);
  const shaft=mesh(parent,new T.CylinderGeometry(r,r,d.length(),6),m,mid.x,mid.y,mid.z);
  shaft.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return shaft;
}
// Broken char, carbonised rice and fired clay have different silhouettes even
// in monochrome. The paired grooves follow the rice grain's long axis.
export function specimen(index){
  const group=new T.Group(),seed=index===1;
  if(index===2){
    const shell=new T.PlaneGeometry(1,1,30,12),p=shell.attributes.position;
    for(let i=0;i<p.count;i++){
      const u=p.getX(i)*2,v=p.getY(i)*2,w=Math.sqrt(Math.max(.001,1-u*u));
      p.setXYZ(i,u*1.14,w*(v*v*.47-.21)+u*u*.08,w*Math.sin(v*1.29)*.43);
    }
    shell.computeVertexNormals();const rind=mat(0x8b7962);rind.side=T.DoubleSide;
    mesh(group,shell,rind);return group;
  }
  if(!seed){
    const chunk=mesh(group,new T.IcosahedronGeometry(1,index===0?1:0),mat(index===0?0x373831:0x946b4c));
    chunk.scale.set(index===0?1.15:.89,index===0?.31:.27,index===0?.44:.83);
    chunk.rotation.z=.13;
    if(index===0)for(let j=0;j<6;j++){
      const x=-.60+j*.22;
      mesh(group,new T.BoxGeometry(.14,.18,.60-Math.abs(x)*.23),mat(j%2?0x454640:0x595748),x,.16,.02);
    }
    return group;
  }
  const geo=new T.SphereGeometry(1,56,32),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(y,z);
    const groove=.14*Math.exp(-Math.pow((a-1.52)/.16,2))+.060*Math.exp(-Math.pow((a+.86)/.14,2));
    const noise=.018*Math.sin(x*55+a*5)*Math.cos(a*15-x*16),taper=1-.13*x;
    p.setXYZ(i,x*1.16+.015*Math.sin(x*6),y*(.405-groove+noise)*taper+.063*(1-x*x),z*(.51-groove+noise)*taper);
    const c=new T.Color(0x49473d).multiplyScalar(.80+.17*Math.sin(x*62+a*6)*Math.cos(a*7)+.16*Math.cos(a*2.4));
    colors.push(c.r,c.g,c.b);
  }
  geo.computeVertexNormals();geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const kernel=mesh(group,geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.72}));kernel.rotation.y=.10;
  return group;
}

export function createFlotationArt(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-4,4,3,-3,.1,40);
  scene.background=new T.Color(0x243831);
  scene.add(new T.HemisphereLight(0xffeacf,0x789b8e,2.1));
  const key=new T.DirectionalLight(0xffdfb2,3.3);key.position.set(-4,7,3);scene.add(key);
  const rim=new T.DirectionalLight(0xb3d8d9,2);rim.position.set(2,1,-5);scene.add(rim);
  const stage=new T.Group(),lens=new T.Group();scene.add(stage,lens);lens.visible=false;
  const bronze=mat(0x8d6a45,.41,.42),tin=mat(0xb7ad92,.42,.38),silt=mat(0x675742),dark=mat(0x4f5343);
  const bucket=mesh(stage,lathe([[.01,-.58],[1.62,-.58],[2.11,.43],[2.16,.48],[2.18,.54],[2.09,.54],[1.59,-.45],[.01,-.45]]),tin);
  bucket.name='浮选桶';loop(stage,2.14,.057,bronze,0,.52,0);loop(stage,1.73,.036,bronze,0,-.40,0);
  const water=mesh(stage,new T.CircleGeometry(2.015,96),mat(0x907d54,.44,.15),0,.30,0);water.rotation.x=-Math.PI/2;
  const clear=new T.Color(0x577b70),mud=new T.Color(0x857453);
  const ripples=Array.from({length:3},(_,i)=>loop(stage,1.0+.30*i,.011,mat(0x8eac99,.32),0,.315+i*.002,0));
  const soil=mesh(stage,new T.IcosahedronGeometry(.82,2),silt,-.35,.33,0);soil.scale.set(1.13,.22,.84);
  const net=new T.Group();stage.add(net);net.visible=false;net.scale.setScalar(.66);
  loop(net,.65,.028,bronze,0,.04,0);
  for(let i=-4;i<=4;i++){
    const a=i*.128,b=Math.sqrt(.62*.62-a*a);
    line(net,[a,.009,-b],[a,.009,b],.009,tin);line(net,[-b,0,a],[b,0,a],.009,tin);
  }
  line(net,[0,.05,.6],[0,.17,2.13],.075,bronze);
  const floats=[];
  for(let i=0;i<13;i++){
    const s=mesh(stage,new T.IcosahedronGeometry(.093,1),i%3===0?dark:mat(0x443f31));
    s.scale.set(i%3===1?1.75:.88,.55,.82);floats.push(s);
  }
  const dishes=mat(0x96927b,.65),plate=mesh(lens,lathe([[0,-.42],[1.65,-.42],[2.02,-.20],[2.07,-.12],[2.01,-.08],[1.64,-.24],[0,-.24]]),dishes);
  plate.position.z=.18;
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=96;
  const ink=shadowCanvas.getContext('2d'),shade=ink.createRadialGradient(48,48,2,48,48,47);
  shade.addColorStop(0,'rgba(27,23,15,.56)');shade.addColorStop(.58,'rgba(33,28,21,.22)');shade.addColorStop(1,'rgba(33,28,21,0)');
  ink.fillStyle=shade;ink.fillRect(0,0,96,96);
  const shadowMap=new T.CanvasTexture(shadowCanvas);
  const shadow=mesh(lens,new T.PlaneGeometry(3.1,1.48),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),.08,-.224,.09);
  shadow.rotation.x=-Math.PI/2;
  const models=[0,1,2].map(i=>{const o=specimen(i);o.position.y=.12;lens.add(o);return o;});
  const plane=new T.Plane(new T.Vector3(0,1,0),-.34),ray=new T.Raycaster(),hit=new T.Vector3();
  function resize(){
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),extent=Math.max(2.32,2.80*h/w);
    camera.left=-extent*w/h;camera.right=extent*w/h;camera.top=extent;camera.bottom=-extent;
    camera.position.set(.1,6.8,5.20);camera.lookAt(0,.08,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    renderer.setSize(w,h,false);
  }
  function point(clientX,clientY){
    const b=canvas.getBoundingClientRect();
    ray.setFromCamera({x:2*(clientX-b.left)/b.width-1,y:1-2*(clientY-b.top)/b.height},camera);
    ray.ray.intersectPlane(plane,hit);return [hit.x,hit.z];
  }
  function paint(state){
    const {phase,wash,caught,x,z,angle,selected,rotation}=state;
    stage.visible=phase==='wash'||phase==='skim';lens.visible=!stage.visible;
    if(stage.visible){
      water.material.color.copy(mud).lerp(clear,wash);
      soil.scale.y=.22*(1-wash);soil.visible=wash<.99;
      ripples.forEach((r,i)=>{const f=.5+.5*Math.sin(angle*1.5+i*1.8);r.scale.setScalar(.75+.18*f);r.visible=wash>.015;});
      floats.forEach((o,i)=>{
        const theta=i*2.40+angle*.25,dist=.45+.94*((i*.618)%1);
        o.position.set(Math.cos(theta)*dist,.32+.09*wash,Math.sin(theta)*dist);o.rotation.y=theta+.36*i;
        o.visible=wash>(i%3)*.14+.07&&!caught.has(i);
      });
      net.visible=phase==='skim';net.position.set(x,.49,z);
    }else{
      models.forEach((o,i)=>{o.visible=i===selected;o.rotation.set(.25+rotation*.28,rotation,-.2);});
      if(phase==='archived')models[1].rotation.y=rotation;
    }
    renderer.render(scene,camera);
  }
  function dispose(){
    const mats=new Set();
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)mats.add(o.material);});
    shadowMap.dispose();mats.forEach(m=>m.dispose());
    renderer.dispose();
    // Each visit owns a separate canvas. Release its native context on exit.
    renderer.forceContextLoss();
  }
  resize();
  return {paint,point,resize,dispose};
}
