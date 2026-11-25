import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;
export const vector = (x, y, z) => new T.Vector3(x, y, z);
export const material = (color, options = {}) => new T.MeshStandardMaterial({color, roughness: .76, ...options});

export function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
  const item = new T.Mesh(geometry, surface);
  item.position.set(x,y,z);
  item.castShadow = item.receiveShadow = true;
  parent.add(item);
  return item;
}

export function rod(parent, start, end, radius, surface, sides = 12) {
  const axis = end.clone().sub(start);
  const piece = mesh(parent, new T.CylinderGeometry(radius, radius, axis.length(), sides), surface);
  piece.quaternion.setFromUnitVectors(vector(0,1,0),axis.normalize());
  piece.position.copy(start).lerp(end,.5);
  return piece;
}

export function ring(parent, radius, tube, surface, x, y, z) {
  const item = mesh(parent,new T.TorusGeometry(radius,tube,8,72),surface,x,y,z);
  item.rotation.x = Math.PI / 2;
  return item;
}

export function bowl(parent, profile, surface, x, y, z) {
  const points = profile.map(([r,h]) => new T.Vector2(r,h));
  return mesh(parent,new T.LatheGeometry(points,64),surface,x,y,z);
}

function integerNoise(x,y,seed) {
  let n = Math.imul(x+seed,1597334677) ^ Math.imul(y-seed,3812015801);
  n = Math.imul(n ^ n >>> 16,2246822519);
  return ((n ^ n >>> 13) >>> 0) / 4294967296;
}

function noise(x,y,seed) {
  const i = Math.floor(x), j = Math.floor(y);
  let u=x-i,v=y-j;
  u=u*u*(3-2*u);v=v*v*(3-2*v);
  const a=integerNoise(i,j,seed), b=integerNoise(i+1,j,seed);
  const c=integerNoise(i,j+1,seed), d=integerNoise(i+1,j+1,seed);
  return T.MathUtils.lerp(T.MathUtils.lerp(a,b,u),T.MathUtils.lerp(c,d,u),v);
}

// Hand-authored material recipes. Fine incisions follow the wheel and saw;
// larger patterns describe minerals and oxidation beneath the tool marks.
export function workshopSurface(kind,scene) {
  const colors = {
    jade:[[41,75,65],[145,174,137],[202,214,162]],
    clay:[[94,44,31],[166,89,56],[210,145,94]],
    bronze:[[37,44,36],[145,103,53],[85,143,116]],
    wood:[[40,29,25],[96,66,45],[133,102,65]],
    stone:[[66,63,59],[102,111,106],[155,154,135]],
    linen:[[123,108,83],[170,154,115],[200,187,147]]
  }[kind];
  const hasPlate=['wood','jade','clay','bronze','stone'].includes(kind);
  const size=hasPlate?16:256, data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const coarse=noise(u*4,v*5,31), mid=noise(u*13+coarse*2,v*10,17);
    const grain=integerNoise(x,y,41);
    let mix=coarse*.44+mid*.43+grain*.13,accent=0;
    switch(kind){
      case 'jade':
        accent=Math.pow(Math.max(0,Math.cos(u*24+v*7+coarse*13+mid*2)),14)*.43;
        break;
      case 'clay':
        mix+=Math.sin(v*TAU*33+coarse)*.065;accent=grain>.981?.45:0;break;
      case 'bronze':
        mix*=1.18;accent=T.MathUtils.smoothstep(coarse*.6+mid*.4+.1*grain,.49,.77);break;
      case 'wood':
        mix=noise(u*3,v*28+coarse*3,33)*.85+grain*.15;
        accent=Math.pow(.5+.5*Math.sin(v*100+mid*5+coarse*7),10)*.27;break;
      case 'linen':
        mix=coarse*.4+grain*.1+.22*(1+Math.cos((x%4)*Math.PI/2)*Math.sin((y%4)*Math.PI/2));break;
      default:accent=grain>.97?.42:0;
    }
    const index=(y*size+x)*4;
    for(let c=0;c<3;c++)data[index+c]=T.MathUtils.lerp(T.MathUtils.lerp(colors[0][c],colors[1][c],mix),colors[2][c],accent);
    data[index+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  const surface=material(0xffffff,{map:texture,bumpMap:texture,bumpScale:kind==='jade'?.004:kind==='linen'?.007:.016,
    metalness:kind==='bronze'?.48:0,roughness:kind==='bronze'?.72:kind==='jade'?.45:.86});
  if(hasPlate&&scene){
    const url=kind==='stone'?'/assets/environment/rock_boulder_dry_diff_1k.webp':'/assets/v10/workshop/'+kind+'.jpg';
    new T.TextureLoader().load(url,plate=>{
      if(scene.userData.studioClosed){plate.dispose();return;}
      plate.colorSpace=T.SRGBColorSpace;
      plate.wrapS=plate.wrapT=T.MirroredRepeatWrapping;
      plate.anisotropy=4;
      if(kind==='wood')plate.repeat.set(2.6,1);
      if(kind==='bronze')plate.repeat.set(.65,.65);
      surface.map=surface.bumpMap=plate;surface.needsUpdate=true;texture.dispose();
      scene.dispatchEvent({type:'surface-ready'});
    });
  }
  return surface;
}

export function makeStudio(container, preset) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.03;
  const scene=new T.Scene();
  scene.background=new T.Color(preset.fog);
  scene.fog=new T.FogExp2(preset.fog,.034);
  const camera=new T.OrthographicCamera(-6,6,3,-3,.1,65);
  camera.position.fromArray(preset.eye);
  camera.lookAt(...preset.look);
  const lighting=new RoomEnvironment();
  const pmrem=new T.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(lighting,.08);
  scene.environment=environment.texture;scene.environmentIntensity=.40;
  lighting.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(preset.sky,preset.floor,.92));
  const key=new T.DirectionalLight(preset.key,2.7);
  key.position.set(-4.5,7,4);
  key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:18});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.012;key.shadow.bias=-.0002;
  scene.add(key,key.target);
  const rim=new T.DirectionalLight(preset.rim,1.45);
  rim.position.set(3,2,-3);scene.add(rim);
  const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('aria-label',preset.label);canvas.setAttribute('role','application');
  container.prepend(canvas);
  let dirty=true,readyFrame=0;
  function cropBackdrop(){
    if(!scene.background?.isTexture||!canvas.clientHeight)return;
    const photo=scene.background,screen=canvas.clientWidth/canvas.clientHeight,aspect=photo.image.width/photo.image.height;
    const u=Math.min(1,screen/aspect),v=Math.min(1,aspect/screen);
    photo.repeat.set(u,v);photo.offset.set((1-u)/2,(1-v)/2);
  }
  scene.addEventListener('surface-ready',()=>{
    if(readyFrame||scene.userData.studioClosed)return;
    readyFrame=requestAnimationFrame(()=>{readyFrame=0;cropBackdrop();renderer.render(scene,camera);});
  });
  const resize=()=>{
    const w=container.clientWidth,h=container.clientHeight;
    if(!w||!h)return;
    const ratio=w/h,span=ratio<.95&&w<570?preset.portraitWidth:preset.width,half=Math.max(preset.height,span/ratio)/2;
    camera.left=-half*ratio;camera.right=half*ratio;camera.top=half;camera.bottom=-half;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    renderer.setSize(w,h,false);cropBackdrop();dirty=true;
  };
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  const raycaster=new T.Raycaster(),mouse=new T.Vector2();
  const ray=(event)=>{
    const rect=canvas.getBoundingClientRect();
    mouse.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(mouse,camera);return raycaster;
  };
  function dispose() {
    observer.disconnect();scene.userData.studioClosed=true;if(readyFrame)cancelAnimationFrame(readyFrame);
    const geos=new Set(),mats=new Set(),textures=new Set();
    if(scene.background?.isTexture)textures.add(scene.background);
    scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
    for(const t of textures)t.dispose();
    for(const m of mats)m.dispose();
    for(const g of geos)g.dispose();
    key.shadow.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  return {renderer,scene,camera,canvas,key,ray,dispose,invalidate(){dirty=true;},
    render(force=false){if(force||dirty){renderer.render(scene,camera);dirty=false;}},
    project(point){const p=point.clone().project(camera);return {x:(p.x+1)/2,y:(1-p.y)/2};}};
}
