import {Vector3} from 'three';

/** Only the small viewing corridor becomes porous; tree silhouettes stay put. */
export function createFoliageClearance(scene){
 const eye={value:new Vector3()},hero={value:new Vector3()},enabled={value:0},cinematic={value:0},radius={value:.82},patched=[];
 scene.traverse(object=>{
  if(!object.isMesh||!object.userData.foliageClearance&&!/Forest canopy|CC0 detailed fern|Responsive broadleaf|Riverside shrub thickets/.test(object.name))return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(patched.some(p=>p.material===material))continue;
   const previous=material.onBeforeCompile,key=material.customProgramCacheKey(),oldKey=material.customProgramCacheKey;
   material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    Object.assign(shader.uniforms,{uClearanceEye:eye,uClearanceHero:hero,uClearanceEnabled:enabled,uClearanceCinematic:cinematic,uClearanceRadius:radius,uClearanceSubject:{value:object.userData.foliageClearance?1:0}});
    shader.vertexShader='varying vec3 vClearanceWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     vec4 clearanceLocal=vec4(transformed,1.);
     #ifdef USE_INSTANCING
     clearanceLocal=instanceMatrix*clearanceLocal;
     #endif
     vClearanceWorld=(modelMatrix*clearanceLocal).xyz;`);
    shader.fragmentShader='uniform vec3 uClearanceEye;uniform vec3 uClearanceHero;uniform float uClearanceEnabled;uniform float uClearanceCinematic;uniform float uClearanceRadius;uniform float uClearanceSubject;varying vec3 vClearanceWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
     vec3 sight=uClearanceHero-uClearanceEye,delta=vClearanceWorld-uClearanceEye;
     float len2=max(dot(sight,sight),.01),along=dot(delta,sight)/len2;
     float corridor=length(delta-sight*clamp(along,0.,1.));
     float inside=(1.-smoothstep(uClearanceRadius*.46,uClearanceRadius,corridor))*smoothstep(.025,.14,along)*(1.-smoothstep(.92,1.04,along));
     float nearLens=1.-smoothstep(.28,.86,length(delta));
     float clearance=max(inside*.94,nearLens)*uClearanceEnabled*(1.-uClearanceSubject*uClearanceCinematic);
     float screenDoor=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
     if(screenDoor<clearance)discard;`);
   };
   material.customProgramCacheKey=()=>key+'-v9-view-corridor-'+(object.userData.foliageClearance?1:0);material.needsUpdate=true;
   patched.push({material,previous,oldKey});
  }
 });
 return {update(camera,position,active=true,treeShot=false){eye.value.copy(camera.position);hero.value.copy(position);if(!treeShot)hero.value.y+=.7;enabled.value=active?1:0;cinematic.value=treeShot?1:0;radius.value=treeShot?1.45:.82;},stats:()=>({materials:patched.length,active:enabled.value===1}),dispose(){for(const {material,previous,oldKey} of patched){material.onBeforeCompile=previous;material.customProgramCacheKey=oldKey;material.needsUpdate=true;}}};
}
