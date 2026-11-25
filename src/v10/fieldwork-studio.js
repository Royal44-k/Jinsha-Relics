import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
export function seeded(seed) {return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
export function fieldStudio(ctx,{background,sky,bounce,key,zoom=10,fog=.025}){
  const renderer = new T.WebGLRenderer({antialias:true,alpha:false});
  const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
  const software=info&&/swiftshader|llvmpipe|software rasterizer/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  let pixelRatio=Math.min(devicePixelRatio||1,software?.75:1.4);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
  renderer.setClearColor(background);
  const canvas=renderer.domElement;canvas.tabIndex=0;ctx.view.append(canvas);
  const scene=new T.Scene();scene.background=new T.Color(background);scene.fog=new T.FogExp2(background,fog);
  const camera=new T.OrthographicCamera(-zoom,zoom,zoom,-zoom,.05,160);
  const light=new T.DirectionalLight(key,2.35);light.position.set(-9,13,7);scene.add(light,new T.HemisphereLight(sky,bounce,1.35));
  const fill=new T.DirectionalLight(0x91bbb0,.45);fill.position.set(9,5,-7);scene.add(fill);
  let minimumWidth=0,revision=0;
  function size(){const {width,height}=ctx.view.getBoundingClientRect();if(width<1||height<1)return;
    const aspect=width/height,vert=Math.max(zoom,minimumWidth/aspect);
    camera.left=-aspect*vert;camera.right=aspect*vert;camera.top=vert;camera.bottom=-vert;camera.updateProjectionMatrix();renderer.setSize(width,height,false);revision++;}
  const ro=new ResizeObserver(size);ro.observe(ctx.view);size();
  const textures=new Map();
  function texture(url,category='color',repeat=[1,1]){
    const key=[url,category,...repeat].join('|');
    if(textures.has(key))return textures.get(key);
    const tex=new T.TextureLoader().load(url,()=>{revision++;});tex.wrapS=tex.wrapT=T.RepeatWrapping;
    tex.repeat.set(...repeat);if(category==='color')tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=software?1:Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.set(key,tex);return tex;
  }
  ctx.onClose(()=>{ro.disconnect();disposeGraph(scene);for(const t of textures.values())t.dispose();renderer.dispose();renderer.forceContextLoss();});
  let overBudget=0,lastPaint=0;
  return {scene,camera,renderer,canvas,texture,software:Boolean(software),minimumWidth(value){minimumWidth=value;size();},invalidate(){revision++;},get revision(){return revision;},render(adaptive=false,view=scene,eye=camera){
    const now=performance.now();
    if(adaptive&&lastPaint){overBudget=Math.max(0,Math.min(12,overBudget+(now-lastPaint>43?1:-2)));
      if(overBudget>=6&&pixelRatio>.55){pixelRatio=Math.max(.55,pixelRatio*.84);renderer.setPixelRatio(pixelRatio);size();overBudget=0;}}
    lastPaint=now;renderer.render(view,eye);if(!canvas.dataset.painted)canvas.dataset.painted='true';
  }};
}
export function disposeGraph(scene){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
}
export function mesh(parent,geo,mat,pos=V()){
  const object=new T.Mesh(geo,mat);object.position.copy(pos);parent.add(object);return object;
}
export function rod(parent,p0,p1,radius,material,top=radius,sides=10){
  const axis=p1.clone().sub(p0);const obj=mesh(parent,new T.CylinderGeometry(top,radius,axis.length(),sides),material);
  obj.position.copy(p0).lerp(p1,.5);obj.quaternion.setFromUnitVectors(V(0,1,0),axis.normalize());return obj;
}
export function mat(color,roughness=.82,params={}){
  return new T.MeshStandardMaterial({color,roughness,...params});
}

export function joinFixedProps(parent,except=[]){
  const groups=new Map();
  for(const part of parent.children){
    if(!part.isMesh||part.isInstancedMesh||part.isSkinnedMesh||except.includes(part)||Array.isArray(part.material)||part.material.transparent)continue;
    const group=groups.get(part.material)||[];group.push(part);groups.set(part.material,group);
  }
  for(const [material,parts] of groups){
    if(parts.length<2)continue;
    const shapes=parts.map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
    const joined=mergeGeometries(shapes);
    for(const shape of shapes)shape.dispose();
    if(!joined)continue;
    for(const part of parts){parent.remove(part);part.geometry.dispose();}
    parent.add(new T.Mesh(joined,material));
  }
}

export function useVertexLighting(parent){
  const replacements=new Map();
  parent.traverse(node=>{
    if(!node.isMesh||!node.material.isMeshStandardMaterial)return;
    const source=node.material;
    if(!replacements.has(source))replacements.set(source,new T.MeshLambertMaterial({
      color:source.color,map:source.map,side:source.side,vertexColors:source.vertexColors,alphaTest:source.alphaTest
    }));
    node.material=replacements.get(source);
  });
  for(const material of replacements.keys())material.dispose();
}
