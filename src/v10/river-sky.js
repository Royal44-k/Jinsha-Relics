import * as T from 'three';

export function skyDome(scene) {
  const panorama=new T.TextureLoader().load('/assets/v11/piedmont.webp');
  panorama.colorSpace=T.SRGBColorSpace;
  const material=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:{panorama:{value:panorama},warmth:{value:0}},
    vertexShader:`varying vec3 direction;void main(){
      direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader:`varying vec3 direction;uniform sampler2D panorama;uniform float warmth;
    void main(){vec3 d=normalize(direction);
      float u=acos(clamp(dot(normalize(d.xz+vec2(.00001)),normalize(vec2(-.60,-.80))),-1.,1.))/.99999/3.141593;
      float v=clamp(.155+asin(d.y)*1.15,.02,.985);
      vec3 c=texture2D(panorama,vec2(u,v)).rgb;
      c*=mix(vec3(.86,.93,.98),vec3(1.02,.96,.88),warmth);
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`
  });
  const dome=new T.Mesh(new T.SphereGeometry(410,40,18),material);dome.renderOrder=-100;scene.add(dome);
  return {dome,material};
}
