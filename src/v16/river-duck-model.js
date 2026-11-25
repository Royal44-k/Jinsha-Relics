import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const once=new T.Object3D();
// Each colour lives in the mesh. The torso, shoulder and hand can therefore
// move separately while the entire flock shares one draw per anatomical part.
function partBuilder(){
  const pieces=[];
  function add(geo,colour,position,scale,rotation=[0,0,0]){
    const mesh=geo.index?geo.toNonIndexed():geo;
    if(mesh!==geo)geo.dispose();
    mesh.deleteAttribute('uv');
    const c=new T.Color(colour),rgb=[];
    for(let i=0;i<mesh.attributes.position.count;i++)rgb.push(c.r,c.g,c.b);
    mesh.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
    once.position.set(...position);once.scale.set(...scale);once.rotation.set(...rotation);
    once.updateMatrix();mesh.applyMatrix4(once.matrix);pieces.push(mesh);
  }
  function oval(colour,position,scale,angle){
    add(new T.SphereGeometry(1,12,8),colour,position,scale,angle);
  }
  function feather(colour,a,b,width){
    // A cambered vane, with its ridge displaced toward the leading edge.
    const [x,y,z]=a,[dx,dy,dz]=b.map((v,i)=>v-a[i]),len=Math.hypot(dx,dz);
    const sideX=-dz/len*width,sideZ=dx/len*width;
    const points=[],idx=[];
    for(const [i,u] of [0,.22,.55,.83,1].entries()){
      const w=Math.max(.024,Math.sin(Math.PI*u)**.65);
      const px=x+u*dx,py=y+u*dy+.025*Math.sin(Math.PI*u),pz=z+u*dz;
      points.push(px-sideX*w,py,pz-sideZ*w,px,py+.017*w,pz,px+sideX*w*.70,py,pz+sideZ*w*.70);
      if(i){const k=i*3;idx.push(k-3,k-2,k+1,k-3,k+1,k,k-2,k-1,k+2,k-2,k+2,k+1);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geo.setIndex(idx);geo.computeVertexNormals();add(geo,colour,[0,0,0],[1,1,1]);
  }
  return {oval,feather,finish(){const g=mergeGeometries(pieces);for(const p of pieces)p.dispose();return g;}};
}

export function duckBody(dappled){
  const g=partBuilder(),belly=dappled?0x8a7657:0xa7a492;
  g.oval(belly,[0,.15,-.022],[.177,.169,.371],[-.05,0,0]);
  g.oval(dappled?0x9b7c50:0x734732,[0,.21,.155],[.15,.157,.196],[-.11,0,0]);
  g.oval(dappled?0x705a3d:0x544c3b,[0,.263,-.087],[.14,.091,.31],[-.08,0,0]);
  for(const s of [-1,1]){
    g.oval(dappled?0x927c59:0x837f71,[s*.13,.22,-.085],[.064,.096,.288],[-.16,s*-.10,0]);
    for(let i=0;i<5;i++){
      const x=s*(.145-.007*i),z=.065-.075*i;
      g.feather(i%2?0x706850:0xb6aa90,[x,.28-i*.006,z],[x+s*.035,.16,z-.105],.017);
    }
    g.feather(0x383b37,[s*.08,.17,-.25],[s*.055,.20,-.52],.068);
  }
  g.oval(dappled?0x987f52:0xf1e7c8,[0,.321,.17],[.095,.04,.097]);
  return g.finish();
}

export function duckHead(dappled){
  const g=partBuilder(),head=dappled?0xa0916b:0x204e45;
  g.oval(head,[0,.405,.202],[.104,.113,.132],[-.10,0,0]);
  for(const s of [-1,1]){
    g.oval(dappled?0x433827:0x23473e,[s*.074,.423,.244],[.029,.037,.078]);
    g.oval(0x191a13,[s*.096,.437,.237],[.012,.013,.014]);
    g.oval(0xd7d1ae,[s*.106,.441,.239],[.003,.004,.004]);
  }
  g.oval(dappled?0xad803d:0xc0a344,[0,.384,.353],[.059,.030,.117],[-.025,0,0]);
  g.oval(0x4b4833,[0,.381,.454],[.024,.014,.016]);
  return g.finish().translate(0,-.315,-.17);
}

export function duckFoot(){
  const g=partBuilder();
  g.oval(0xad7748,[0,-.036,-.018],[.018,.087,.017],[-.32,0,0]);
  g.oval(0xb38657,[0,-.118,.01],[.04,.009,.07]);
  for(const s of [-1,0,1])g.oval(0xab7849,[s*.022,-.116,.043],[.008,.009,.052],[0,s*.4,0]);
  return g.finish();
}

export function duckWings(sign){
  const inner=partBuilder(),hand=partBuilder();
  for(let i=0;i<7;i++){
    const u=i/6,x=sign*(.025+u*.27);
    inner.feather(0x534c40,[x,.012,.075+u*.033],[x+sign*.087,-.005,-.189+u*.029],.059);
    inner.feather(0x566966,[x,.02,.067+u*.035],[x+sign*.064,.019,-.122+u*.016],.060);
    inner.feather(0xeeeece,[x,.024,.071+u*.037],[x+sign*.048,.022,-.083+u*.022],.055);
    inner.feather(0x405375,[x,.029,.071+u*.037],[x+sign*.045,.027,-.062+u*.024],.057);
    inner.feather(i%2?0x877f6e:0x777260,[x,.036,.081+u*.035],[x+sign*.030,.031,.010+u*.019],.053);
  }
  for(let i=0;i<8;i++){
    const u=i/7;
    hand.feather(i%2?0x4c4a41:0x5c574c,
      [sign*.075*u,u*.006,.04+.036*u],
      [sign*(.13+.385*u),-.025-.025*u,-.186+.095*u],.045-.011*u);
  }
  return [inner.finish(),hand.finish()];
}
