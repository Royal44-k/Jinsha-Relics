import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ground} from '../v10/geography.js';
import {FIELD_TRAILS} from './field-locations.js';
import {buildResidentialYard,addResidentialSupports} from '../v14/residential-yard.js';
export {FIELD_TRAILS} from './field-locations.js';

const Y=new T.Vector3(0,1,0);
const tau=Math.PI*2;
function reedTexture(){
  const size=192,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const band=Math.floor(y/32),split=(x+.42*Math.sin(y*.099+x*.21)+band*2.74)%5;
    const strand=split<.9?-.20:split<1.6?.11:0;
    const grain=.12*Math.sin(Math.floor((x+band*2.74)/5)*31.12+band*.9)+.05*Math.cos(x*12.1+y*28.3);
    const seam=(y%32)/2.4;
    const v=.78+strand+grain-.19*Math.exp(-seam*seam);
    const i=(y*size+x)*4;pixels[i]=221*v;pixels[i+1]=194*v;pixels[i+2]=142*v;pixels[i+3]=255;
  }
  const tex=new T.DataTexture(pixels,size,size,T.RGBAFormat);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}
function buildSite(item,textures){
  const root=new T.Group(),base=ground(item.x,item.z);
  root.name=item.title;root.position.set(item.x,base,item.z);
  const groups=new Map();
  const mat=(color,roughness=1)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
  const wood=mat(0x715338),fiber=mat(0xb8a67a),fiberDark=mat(0x74684b),clay=mat(0x935e40),stone=mat(0x89918b,.76),lichen=mat(0x637867,.9);
  const wind={value:0};
  if(textures){
    wood.map=textures.bark;wood.color.setHex(0xc3b18f);
    stone.map=lichen.map=textures.stone;stone.color.setHex(0xc0c4be);lichen.color.setHex(0x94aa91);
  }
  const local=(x,z)=>ground(item.x+x,item.z+z)-base;
  function put(g,m,x,y,z,rotation=[0,0,0],scale=[1,1,1]){
    const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale));
    const geom=g.index?g.toNonIndexed():g;geom.applyMatrix4(matrix);
    if(!groups.has(m))groups.set(m,[]);groups.get(m).push(geom);if(g!==geom)g.dispose();
  }
  function pole(a,b,r,m=wood){
    const from=new T.Vector3(...a),to=new T.Vector3(...b),axis=to.clone().sub(from),len=axis.length();
    const g=new T.CylinderGeometry(r*.85,r,len,7),mid=from.lerp(to,.5);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y,axis.normalize()));put(g,m,mid.x,mid.y,mid.z);
  }
  function cord(points,m=fiber,r=.018){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));put(new T.TubeGeometry(curve,Math.max(6,points.length*3),r,4,false),m,0,0,0);
  }
  function wheel(radius,hole,depth,m,x,y,z,tilt){
    const ring=new T.Shape();ring.absarc(0,0,radius,0,tau,false);
    const holePath=new T.Path();holePath.absarc(0,0,hole,0,tau,true);ring.holes.push(holePath);
    const geo=new T.ExtrudeGeometry(ring,{depth,bevelEnabled:true,bevelThickness:.014,bevelSize:.016,bevelSegments:2,curveSegments:25});
    put(geo,m,x,y,z,tilt);
  }
  let waypoints=[];
  if(item.id==='spindle'){
    // An open-sided loom shelter. The hanging warp changes from loose strands
    // to a woven cloth; the three finding spots run down the centre aisle.
    for(const x of [-2.35,2.35])for(const z of [-3.2,3.2])pole([x,local(x,z)-.2,z],[x,3.55,z],.12);
    for(const x of [-2.35,0,2.35])pole([x,3.52+(x===0?.9:0),-3.5],[x,3.52+(x===0?.9:0),3.55],.105);
    const reeds=mat(0xffffff);reeds.map=reedTexture();
    for(const dir of [-1,1]){
      const roof=new T.PlaneGeometry(1,1,7,60),points=roof.attributes.position,uv=roof.attributes.uv;
      for(let n=0;n<points.count;n++){
        const u=points.getX(n)+.5,v=points.getY(n)+.5,z=(v-.5)*7.20,fringe=Math.sin(v*563)*.055+Math.cos(v*119)*.045;
        points.setXYZ(n,dir*u*(2.69+fringe*u),4.49-1.29*u-.074*u*u+fringe*u*.60,z+.029*Math.sin(6*u+v*20));
        uv.setXY(n,v*4.6,u*.83+v*.019);
      }
      roof.computeVertexNormals();put(roof,reeds,0,0,0);
      for(let k=0;k<65;k++){
        const z=-3.57+k*.112,l=.08+.25*(.5+.5*Math.sin(15.27*k));
        pole([dir*2.46,3.19,z],[dir*(2.68+l),3.03-l*.55,z+.045*Math.sin(k)],.020,k%4===0?fiberDark:fiber);
      }
      for(let k=0;k<8;k++){const z=-3.43+k*.97;pole([0,4.38,z],[dir*2.61,3.1,z],.065,wood);}
    }
    for(const z of [-1.95,1.95])pole([-2,local(-2,z),z],[-2,2.68,z],.087);
    pole([-2,2.55,-2.2],[-2,2.55,2.2],.092);pole([-1.48,.8,-2.1],[-1.48,.8,2.1],.084);
    for(let n=0;n<58;n++){
      const z=-2+n*.07;cord([[-2,2.54,z],[-1.82,1.49,z+.01],[-1.48,.83,z]],n%5===0?clay:fiber,.017);
    }
    for(let n=0;n<24;n++){const y=.88+n*.034;pole([-1.52-(y-.88)*.30,y,-2],[-1.52-(y-.88)*.30,y,.65],.020,n%7<2?clay:fiberDark);}
    for(const z of [-2.35,.15,2.25]){
      const x=.97;pole([x,local(x,z),z],[x,1.47,z],.044);wheel(.23,.055,.085,clay,x,1.05,z,[-Math.PI/2,0,0]);
      cord([[x,1.47,z],[x+.08,2.05,z],[1.7,3.45,z]],fiber,.022);
    }
    for(const [x,z,r] of [[1.64,1.16,.32],[-1.58,2.84,.25],[1.64,-1.51,.38]]){
      const y=local(x,z),body=new T.LatheGeometry([[.51,0],[.81,.10],[1,.42],[.86,.67]].map(([u,v])=>new T.Vector2(r*u,r*2.3*v)),24);
      put(body,reeds,x,y,z);
      for(let band=0;band<6;band++){const a=band/5,h=r*(.34+a*1.16);put(new T.TorusGeometry(r*(.85+.12*Math.sin(a*Math.PI)),.014,5,24),fiberDark,x,y+h,z,[Math.PI/2,0,0]);}
      for(let reed=0;reed<11;reed++){const a=reed*2.4;pole([x+.11*Math.sin(a),y+.40,z+.09*Math.cos(a)],[x+.28*Math.sin(a),y+.64+.24*Math.cos(reed*1.8),z+.21*Math.cos(a)],.015,fiber);}
    }
    // A living timber at the mouth of the shelter. Its low lateral limb
    // bridges the player's arrival point; the feet land on that exact limb.
    const trunk=mat(0x665544),crown=mat(0x667844),sunLeaves=mat(0x88925c);
    if(textures){trunk.map=textures.bark;trunk.color.setHex(0xcebf9c);}
    for(const m of [crown,sunLeaves]){
      m.onBeforeCompile=shader=>{
        shader.uniforms.fieldTime=wind;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float fieldTime;');
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += .025*sin(fieldTime*1.8+position.y*2.7+position.z)*smoothstep(3.0,5.8,position.y);');
      };
    }
    const baseY=local(3.45,4.74);
    pole([3.45,baseY-.12,4.74],[3.12,2.01,4.65],.26,trunk);
    pole([3.12,2.01,4.65],[3.37,3.80,4.83],.215,trunk);
    pole([3.37,3.80,4.83],[2.95,5.35,4.72],.118,trunk);
    pole([3.12,2.01,4.65],[1.21,2.67,4.57],.13,trunk);
    pole([1.21,2.67,4.57],[-.63,2.60,4.77],.09,trunk);
    for(let n=0;n<5;n++){
      const a=n*1.37;pole([3.45,baseY+.12,4.74],[3.45+.60*Math.cos(a),local(3.45+.60*Math.cos(a),4.74+.62*Math.sin(a)),4.74+.62*Math.sin(a)],.105,trunk);
    }
    const leaf=new T.Shape();leaf.moveTo(0,0);leaf.quadraticCurveTo(.10,.13,.018,.38);leaf.quadraticCurveTo(-.08,.18,0,0);
    for(let limb=0;limb<19;limb++){
      const a=limb*2.4,h=3.34+(limb%4)*.48,cx=3.20+Math.cos(a)*(1.7+.38*Math.sin(limb*1.7)),cz=4.72+Math.sin(a)*1.68;
      pole([3.20,h-.56,4.72],[cx,h+.32,cz],.05,trunk);
      for(let k=0;k<4;k++){
        const b=a+k*1.57,ex=cx+Math.sin(b)*.65,ez=cz+Math.cos(b)*.60,ey=h+.53+.23*Math.cos(k);
        pole([cx,h+.32,cz],[ex,ey,ez],.020,trunk);
        for(let j=0;j<5;j++){
          const f=.18+j*.16,x=cx+(ex-cx)*f,y=h+.32+(ey-h-.32)*f,z=cz+(ez-cz)*f;
          put(new T.ShapeGeometry(leaf,4),(k+limb)%4===0?sunLeaves:crown,x,y,z,[1.16+.60*Math.sin(j+limb),b+j*.74,.31*Math.sin(j*3.7)],[1.4,1.1,1]);
        }
      }
    }
    waypoints=[[0,2.25],[0,.03],[0,-2.35]];
  } else if(item.id==='carbon-rice'){
    buildResidentialYard({local,put,pole,cord,mat,wood,fiber,clay,stone,reedTexture,wind});
    waypoints=[[2,3.2]];
  } else if(item.id==='stoneblank'){
    // Inclined blanks, discs and cut flakes. The fan arrangement only reads
    // clearly from above, which motivates the observation in flight.
    for(let band=0;band<3;band++)for(let i=0;i<8-band;i++){
      const a=-1.0+i*.28+band*.08,r=1.45+band*.64,x=Math.sin(a)*r,z=Math.cos(a)*r-1.6;
      wheel(.55+.08*Math.cos(i),.09+.05*(i%3),.088,band===1?lichen:stone,x,local(x,z)+.12+i*.045,z,[-1.1+i*.018,.08,a*.32]);
    }
    for(let i=0;i<39;i++){
      const a=i*2.39,r=2.4+.8*Math.sin(i*6.21),x=Math.sin(a)*r,z=Math.cos(a)*r;
      put(new T.IcosahedronGeometry(1,0),i%3===0?lichen:stone,x,local(x,z)+.042,z,[i,.3,i*.8],[.1+i%4*.043,.054,.11]);
    }
    for(const x of [-2.5,2.5])pole([x,local(x,-2.8),-2.8],[x,2.4,-2.8],.078);
    cord([[-2.5,2.35,-2.8],[0,2.05,-2.8],[2.5,2.35,-2.8]]);
  }else{
    // Diamond mesh hung between two split stakes. Portions sag beneath the
    // waterline; weighted lower corners rest against the actual bed.
    const top=.72-base,lower=.20;
    for(const x of [-1.85,1.85]){
      pole([x,local(x,0)-.1,0],[x,top+.5,0],.085);
      pole([x,top+.08,0],[x+.26,top+.47,0],.047);
      for(let n=0;n<5;n++)put(new T.TorusGeometry(.095,.013,5,10),fiber,x,top+.02+n*.045,0,[-Math.PI/2,0,0]);
    }
    const net=(u,v)=>[(u-.5)*3.65,top+(lower-top)*v-.24*Math.sin(u*Math.PI),Math.sin(u*Math.PI)*(.24+v*.22)];
    for(let k=-8;k<17;k++){
      for(const dir of [-1,1]){let pts=[];for(let n=0;n<=9;n++){const v=n/9,u=k/11+dir*v*.4;if(u>=0&&u<=1)pts.push(net(u,v));}if(pts.length>=2)cord(pts,fiberDark,.017);}
    }
    for(let i=0;i<9;i++){const u=i/8,[x,y,z]=net(u,1);wheel(.115,.032,.078,clay,x,y,z,[.1,i*.13,0]);}
    for(let k=0;k<6;k++){const [x,y,z]=net(k/5,0);put(new T.SphereGeometry(.13,10,7),fiber,x,y,z,[0,0,0],[1.4,.8,.8]);}
  }
  for(const [material,geometries] of groups){
    const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const mesh=new T.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  }
  for(const m of [wood,fiber,fiberDark,clay,stone,lichen])if(!groups.has(m))m.dispose();
  const marker=new T.Mesh(new T.OctahedronGeometry(.115),new T.MeshBasicMaterial({color:0xffd794}));
  marker.name='在察标位';marker.visible=false;root.add(marker);
  return {root,marker,waypoints,base,wind};
}

function addPhysicalSupports(world,site){
  if(!world)return;
  const {item,base}=site;
  const y=(x,z)=>ground(item.x+x,item.z+z);
  function post(x,z,top,radius,label){
    const bottom=y(x,z);
    world.colliders.push({x:item.x+x,z:item.z+z,y:bottom,height:base+top-bottom,radius});
    if(label)world.perches.push({id:item.id+'-'+label,label,position:new T.Vector3(item.x+x,base+top+.08,item.z+z),radius:.69,yaw:0});
  }
  function box(x,z,bottom,top,halfX,halfZ,hint){
    world.colliders.push({x:item.x+x,z:item.z+z,y:base+bottom,height:top-bottom,halfX,halfZ,hint});
  }
  if(item.id==='spindle'){
    for(const x of [-2.35,2.35])for(const z of [-3.2,3.2])post(x,z,3.55,.12);
    // Walking underneath and landing above the sloped roof use the same
    // geometry as the thatch. The raised support activates from above.
    world.surfaces.push({minX:item.x-2.6,maxX:item.x+2.6,minZ:item.z-3.55,maxZ:item.z+3.55,heightAt:x=>base+4.51-.50*Math.abs(x-item.x)});
    for(let i=0;i<12;i++){
      const x=-2.475+i*.45,at=4.49-.50*Math.abs(x);
      box(x,0,at-.16,at+.075,.225,3.59,'这里是织棚的斜顶。沿檐口飞出，再升到屋脊。');
    }
    box(-1.75,0,.82,2.55,.22,2.03,'经线绷在织机上。请沿中央通道靠近工位。');
    for(const z of [-2.35,.15,2.25])post(.97,z,1.47,.10);
    for(const [x,z,r] of [[1.64,1.16,.32],[-1.58,2.84,.25],[1.64,-1.51,.38]])
      post(x,z,y(x,z)-base+r*1.56,r);
    world.perches.push({id:'spindle-ridge',label:'织棚脊梁',position:new T.Vector3(item.x,base+4.54,item.z+3.3),radius:.85,yaw:0});
    post(3.45,4.74,3.85,.22);
    const t=1.21/(1.21+.63);
    world.perches.push({id:'spindle-living-bough',label:'织棚老树横枝',position:new T.Vector3(item.x,base+2.67+(2.60-2.67)*t+.08,item.z+4.57+(4.77-4.57)*t),radius:.68,yaw:0});
  }else if(item.id==='carbon-rice'){
    addResidentialSupports({box,post});
  }else if(item.id==='stoneblank'){
    post(-2.5,-2.8,2.4,.078,'石场西桩');post(2.5,-2.8,2.4,.078,'石场东桩');
    for(let band=0;band<3;band++)for(let i=0;i<8-band;i++){
      const a=-1+i*.28+band*.08,r=1.45+band*.64,x=Math.sin(a)*r,z=Math.cos(a)*r-1.6;
      post(x,z,y(x,z)-base+.25+i*.045,.43);
    }
  }else{
    for(const x of [-1.85,1.85])post(x,0,1.22-base,.085,x<0?'河汊西渔标':'河汊东渔标');
    box(0,.26,.11,.72-base,1.80,.16,'渔网横在汊口。从侧边的渔标绕过去，可以潜看网脚。');
  }
}

export function createFieldTrails(scene,callbacks,world){
  const locations=FIELD_TRAILS.map(item=>({item,...buildSite(item,world?.fieldTextures)}));
  locations.forEach(site=>{site.root.visible=false;scene.add(site.root);addPhysicalSupports(world,site);});
  let tracked=null,nearby=null,step=0,seen=new Set(),time=0,currentMode='grounded',currentPos=null,ready=false;
  let lab=null,busy=false,destroyed=false;
  function restore(){seen=new Set(callbacks.sideFinds?.()||[]);step=0;ready=false;tracked=null;nearby=null;}
  restore();
  const visitable=id=>!seen.has(id)||id==='carbon-rice';
  function track(id){const field=locations.find(o=>o.item.id===id);tracked=field&&visitable(id)?field:null;return tracked?.item||null;}
  function markerSpot(site){
    const {item,waypoints}=site,[dx,dz]=waypoints[Math.min(step,2)]||[0,0];
    return {x:item.x+dx,z:item.z+dz};
  }
  function describe(site){
    if(!site||!currentPos)return {hint:'',ready:false};
    const {item}=site,spot=markerSpot(site),d=Math.hypot(currentPos.x-spot.x,currentPos.z-spot.z);
    if(item.id==='carbon-rice'){
      const within=site===nearby&&d<2.3&&Math.abs(currentPos.y-ground(spot.x,spot.z))<1.6;
      return {hint:item.title+' · '+(within?'按 E 开始灰坑土样浮选':'前往取样旗（'+Math.ceil(d)+' 米）'),ready:within};
    }
    const task=item.id==='spindle'?['检查牵麻工位','检查加捻工位','登记纺轮'][Math.min(step,2)]:item.id==='stoneblank'?'升至石坯上方俯察':'潜到网脚，辨认陶坠';
    const atSite=site===nearby,atLoom=atSite&&item.id==='spindle'&&d<1.72&&Math.abs(currentPos.y-ground(spot.x,spot.z))<1.5;
    const canRegister=atSite&&ready;
    const prompt=canRegister?'按 E 登记 '+item.relic:atLoom?'按 E '+task:task+'（'+Math.ceil(d)+' 米）';
    return {hint:atSite?item.title+' · '+prompt:item.title+' · '+Math.ceil(d)+' 米',ready:canRegister||atLoom};
  }
  function info(){
    const local=describe(nearby),navigation=tracked===nearby?local:describe(tracked);
    return {sideId:tracked?.item.id||null,sideHint:navigation.hint,sideNear:!!nearby,
      nearbySideId:nearby?.item.id||null,nearbySideHint:local.hint,sideReady:local.ready};
  }
  function siteWaypoint(out){
    if(!tracked||tracked!==nearby)return false;
    out.copy(tracked.marker.position).add(tracked.root.position);return true;
  }
  function update(dt,position,state){
    time+=dt;currentMode=state.mode;currentPos=position;
    const active=locations.find(({item})=>visitable(item.id)&&Math.hypot(position.x-item.x,position.z-item.z)<7.5);
    if(nearby!==active){nearby=active;step=0;ready=false;}
    for(const o of locations){
      const d=Math.hypot(o.item.x-position.x,o.item.z-position.z);
      o.root.visible=d<(o.item.revealRadius??47);
      if(o.root.visible)o.wind.value=time;
      o.marker.visible=o===nearby&&visitable(o.item.id);
      if(!o.marker.visible)continue;
      const spot=markerSpot(o),horizontal=Math.hypot(position.x-spot.x,position.z-spot.z);
      const y=ground(spot.x,spot.z)+(o.item.id==='stoneblank'?2.1:o.item.id==='netsinker'?.46:.70);
      o.marker.position.set(spot.x-o.item.x,y-o.base+.07*Math.sin(time*2.3),spot.z-o.item.z);o.marker.rotation.y=time*.9;
      if(o.item.id==='stoneblank'&&horizontal<3.8&&position.y-ground(spot.x,spot.z)>1.35&&['flying','gliding','rising','perched','falling'].includes(currentMode))ready=true;
      if(o.item.id==='netsinker'&&horizontal<3.2&&state.mode==='diving'&&position.y<-.28)ready=true;
    }
  }
  function interact(){
    if(!nearby||!visitable(nearby.item.id))return false;
    const item=nearby.item,spot=markerSpot(nearby);
    if(item.id==='carbon-rice'){
      if(!describe(nearby).ready){callbacks.message?.(item.hint);return true;}
      if(!busy)void openLab(item);
      return true;
    }
    if(item.id==='spindle'&&Math.hypot(currentPos.x-spot.x,currentPos.z-spot.z)<1.72&&Math.abs(currentPos.y-ground(spot.x,spot.z))<1.5){
      if(step<2){step++;callbacks.cue?.('perch');callbacks.message?.(step===1?'牵出散纤维。沿麻线向棚内第二处光标移动。':'纤维加捻成束。走到棚尾的纺轮旁，登记轮孔。');return true;}ready=true;
    }
    if(!ready){callbacks.message?.(item.hint);return true;}
    seen.add(item.id);callbacks.sideFind?.(item.id);if(tracked===nearby)tracked=null;
    callbacks.message?.('已收录「'+item.relic+'」。打开地图的「珍藏与鉴定」查看用途与成长经验。');
    nearby=null;ready=false;return true;
  }
  async function openLab(item){
    busy=true;callbacks.holdActivity?.(true);
    try{
      const {openFlotation}=await import('../v14/flotation.js');
      if(destroyed)return;
      lab=openFlotation({sound:callbacks.cue,known:seen.has(item.id),onClose:done=>{
        busy=false;lab=null;
        if(destroyed)return;
        callbacks.holdActivity?.(false);
        if(done){
          const fresh=!seen.has(item.id);
          if(fresh){seen.add(item.id);callbacks.sideFind?.(item.id);}
          if(tracked?.item===item)callbacks.sideFinished?.();
          callbacks.message?.(fresh?'炭化稻粒图记已入珍藏。打开探险图鉴可查看研究出处。':'再次核读完成，炭化稻粒图记可在珍藏里翻阅。',6200);
        }
      }});
    }catch(e){
      if(!destroyed){busy=false;callbacks.holdActivity?.(false);callbacks.message?.('浮选台未能载入，可在取样旗旁再次进入。');console.warn('Flotation stage',e);}
    }
  }
  return {update,info,siteWaypoint,track,restore,interact,dispose(){destroyed=true;lab?.();},get tracked(){return tracked?.item||null;}};
}
