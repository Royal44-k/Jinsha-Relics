import {ShaderChunk} from 'three';

/** Local foliage approximation: bounded back-light scattering, driven by the
 * actual incident sun/sky. It adds no emissive term, lights, or render pass. */
export function applyThinLeafLight(material,{strength=.38,shadowFraction=.22}={}){
 const transmission={value:strength},shadowTransmission={value:shadowFraction},previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
 material.userData.v9LeafLight={transmission,shadowTransmission};
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);shader.uniforms.uTreeLeafTransmission=transmission;shader.uniforms.uTreeLeafShadowTransmission=shadowTransmission;
  shader.fragmentShader='uniform float uTreeLeafTransmission;\nuniform float uTreeLeafShadowTransmission;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
   void addTreeLeafTransmission(const in IncidentLight incident, const in vec3 unshadowed, const in vec3 n, const in vec3 viewDir, const in PhysicalMaterial m, inout ReflectedLight light) {
    float back=max(-dot(n,incident.direction),0.0);
    float forward=pow(max(dot(-incident.direction,viewDir),0.0),3.0);
    float midrib=1.0-smoothstep(.012,.06,abs(vTreeLeaf.x-.5));
    float thickness=.84-.52*midrib;
    // A small transmitted fraction survives opaque shadow-map leaf layers.
    // Most light remains shadowed, and both the sun angle and leaf normal gate it.
    vec3 irradiance=mix(incident.color,unshadowed,uTreeLeafShadowTransmission);
    vec3 tint=m.diffuseColor*vec3(.86,1.0,.65);
    light.directDiffuse+=irradiance*tint*RECIPROCAL_PI*uTreeLeafTransmission*thickness*back*(.32+.68*forward);
   }
  `);
  const direct=ShaderChunk.lights_fragment_begin,begin=direct.indexOf('#if ( NUM_DIR_LIGHTS'),end=direct.indexOf('#if ( NUM_RECT_AREA_LIGHTS',begin);
  if(begin<0||end<0)throw new Error('Thin-leaf shader requires the directional-light chunk.');
  const call='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',section=direct.slice(begin,end);
  const replaced=section.replace(call,call+'\naddTreeLeafTransmission(directLight,directionalLight.color,geometryNormal,geometryViewDir,material,reflectedLight);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',direct.slice(0,begin)+replaced+direct.slice(end));
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #if NUM_HEMI_LIGHTS > 0
   #pragma unroll_loop_start
   for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
    reflectedLight.indirectDiffuse+=getHemisphereLightIrradiance(hemisphereLights[i],-geometryNormal)*material.diffuseColor*vec3(.86,1.0,.65)*RECIPROCAL_PI*uTreeLeafTransmission*.14;
   }
   #pragma unroll_loop_end
   #endif
  `);
 };
 material.customProgramCacheKey=()=>oldKey+'-thin-leaf-v9';return transmission;
}
