import {PointLight,SpotLight,Vector3} from 'three';

/** Two persistent slots avoid recompiling the whole scene when local lights appear. */
export function createLocalLightBudget(scene,budget=2){
 const sources=[],spots=[];
 scene.traverse(light=>{if(light.isPointLight){sources.push({light,mask:light.layers.mask,position:new Vector3(),score:0});light.layers.disable(0);}else if(light.isSpotLight){spots.push({source:light,mask:light.layers.mask});light.layers.disable(0);}});
 const lights=Array.from({length:budget},(_,i)=>{const light=new PointLight(0xffffff,0,8,2);light.name='Local light budget '+i;scene.add(light);return light;});
 for(const entry of spots){const source=entry.source,light=new SpotLight(source.color,0,source.distance,source.angle,source.penumbra,source.decay);light.name='Persistent companion side-light';light.target=source.target;scene.add(light);entry.light=light;}
 let selected=[];
 function visible(light){for(let p=light;p;p=p.parent)if(!p.visible)return false;return true;}
 return {
  update(position,camera){
   for(const {source,light} of spots){source.getWorldPosition(light.position);light.color.copy(source.color);light.intensity=visible(source)?source.intensity:0;}
   selected=sources.filter(source=>{
    const light=source.light;if(light.intensity<=0||!visible(light))return false;
    light.getWorldPosition(source.position);
    const distance=Math.min(source.position.distanceTo(position),source.position.distanceTo(camera.position));
    source.score=distance/(Math.max(.1,light.intensity)**.2);return distance<Math.max(8,light.distance)+30;
   }).sort((a,b)=>a.score-b.score).slice(0,budget);
   for(let i=0;i<lights.length;i++){
    const slot=lights[i],source=selected[i];
    if(!source){slot.intensity=0;continue;}
    slot.position.copy(source.position);slot.color.copy(source.light.color);slot.intensity=source.light.intensity;slot.distance=source.light.distance;slot.decay=source.light.decay;
   }
  },
  stats:()=>({slots:lights.length,active:selected.length,sources:sources.length}),
  dispose(){for(const {light,mask} of sources)light.layers.mask=mask;for(const {source,mask,light} of spots){source.layers.mask=mask;light.removeFromParent();light.dispose();}for(const light of lights){light.removeFromParent();light.dispose();}}
 };
}
