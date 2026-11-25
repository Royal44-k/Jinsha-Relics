import * as T from 'three';

// A strip remembers real surface positions. Both arms follow turns instead of
// rotating the entire wake with the animal's current heading.
export function createWakeStrip(scene,lanes,samples){
  const ages=Array.from({length:lanes},()=>({points:[],clock:0}));
  const xyz=new Float32Array(lanes*2*samples*6),rgba=new Float32Array(lanes*2*samples*8);
  const index=[],color=new T.Color(0xc3cbb3);
  for(let i=0;i<rgba.length;i+=4)rgba.set([color.r,color.g,color.b,0],i);
  for(let lane=0;lane<lanes*2;lane++)for(let n=0;n<samples-1;n++){
    const a=2*(lane*samples+n);index.push(a,a+1,a+3,a,a+3,a+2);
  }
  const geo=new T.BufferGeometry(),position=new T.BufferAttribute(xyz,3),colors=new T.BufferAttribute(rgba,4);
  position.setUsage(T.DynamicDrawUsage);colors.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',position);geo.setAttribute('color',colors);geo.setIndex(index);
  const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide}));
  mesh.name='河湾 · 分水纹';mesh.frustumCulled=false;mesh.renderOrder=3;scene.add(mesh);
  let hasInk=false;
  function write(id,dt,x,z,yaw,strength,width){
    const lane=ages[id],points=lane.points;lane.clock+=dt;
    for(const p of points)p.age+=dt;
    if(strength>0&&lane.clock>=.11){
      lane.clock=0;
      if(points.length&&Math.hypot(x-points[0].x,z-points[0].z)>1.5)points.length=0;
      points.unshift({x,z,yaw,age:0,strength,width});
      if(points.length>samples)points.pop();
    }
    while(points.length&&points.at(-1).age>1.45)points.pop();
    for(let a=0;a<2;a++){
      let last=points[0];
      for(let n=0;n<samples;n++){
        const p=points[n]||last,base=((id*2+a)*samples+n)*2;
        if(!p){rgba[base*4+3]=rgba[(base+1)*4+3]=0;continue;}
        last=p;
        const spread=p.width*(.34+1.55*p.age),side=a===0?-1:1;
        const alpha=points[n]?p.strength*Math.max(0,1-p.age/1.45)**1.4*Math.min(1,(n+.12)*.85):0;
        if(alpha>.001)hasInk=true;
        for(let e=0;e<2;e++){
          const offset=side*(spread+(.012+p.width*.11)*(e-.5)),k=base+e;
          xyz[k*3]=p.x+Math.cos(p.yaw)*offset;xyz[k*3+1]=.034;xyz[k*3+2]=p.z-Math.sin(p.yaw)*offset;
          rgba[k*4+3]=alpha;
        }
      }
    }
  }
  function flush(){
    mesh.visible=hasInk;
    if(hasInk){position.needsUpdate=true;colors.needsUpdate=true;}
    hasInk=false;
  }
  return {write,flush,reset(){ages.forEach(l=>{l.points.length=0;});mesh.visible=false;}};
}
