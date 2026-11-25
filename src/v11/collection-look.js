import {BufferGeometry,Color,CubicBezierCurve3,DoubleSide,Float32BufferAttribute,Group,MathUtils,Mesh,MeshStandardMaterial,Vector3} from 'three';

const caches = new WeakMap();
const smooth = MathUtils.smoothstep;

function collectTracts(group) {
  const tracts = [];
  group.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !/^Shuoyu_(plumage|contour|down)$/.test(mesh.name)) return;
    const {position, color, skinIndex} = mesh.geometry.attributes;
    if (!position || !color || !skinIndex) return;
    const bones=mesh.skeleton.bones.map(bone=>{
      const name=bone.name;
      return {used:/^(Wing[LR]|Primary[LR][0-4]|Flight[LR]|TailTip|TailFan[LR]|Breast|Neck)$/.test(name),
        wing:/^Wing/.test(name),neck:name==='Neck',shoulder:name==='Breast'||name==='Neck',min:Infinity,max:-Infinity};
    });
    const mask=new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const bone = bones[skinIndex.getX(i)];
      // In the exported GLB, most wing feathers have WingL/R in the first
      // skin-weight slot. The articulated primary bones occupy later slots.
      if (!bone?.used) continue;
      const y=position.getY(i),z=position.getZ(i);
      const storyBand=mesh.name==='Shuoyu_plumage' && bone.wing && y>.245 && y<.44 && z<.49;
      if (storyBand || (bone.neck && y>.84)) continue;
      bone.min=Math.min(bone.min,z);bone.max=Math.max(bone.max,z);
      mask[i]=1;
    }
    const indices=[],samples=[];
    for (let i=0;i<position.count;i++) {
      if (!mask[i]) continue;
      const bone=bones[skinIndex.getX(i)],y=position.getY(i);
      const length=(position.getZ(i)-bone.min)/Math.max(.001,bone.max-bone.min);
      const weight = bone.shoulder ? smooth(y,.34,.52) * (1 - smooth(y,.76,.88)) * .73
        : .64 + .36 * smooth(length,.16,.85);
      if (weight <= .02) continue;
      const r=color.getX(i),g=color.getY(i),b=color.getZ(i);
      indices.push(i);samples.push(r,g,b,weight,.58+.42*MathUtils.clamp(Math.max(r,g,b),0,1),bone.shoulder?-1:length);
    }
    if (indices.length) tracts.push({color,indices:Uint32Array.from(indices),samples:Float32Array.from(samples)});
  });
  return {tracts, signature:'',accessory:null};
}

const outlines = {
  reed:{bone:'Wing',base:[.135,.63,.04],rise:[.205,.63,.13],mid:[.248,.49,.27],tip:[.255,.41,.36],width:.029},
  jade:{bone:'Neck',base:[.038,.91,-.025],rise:[.067,1.01,.10],mid:[.114,.92,.30],tip:[.148,.74,.39],width:.025},
  sun:{bone:'Crest',base:[.018,1.023,-.098],rise:[.036,1.16,-.026],mid:[.063,1.27,.10],tip:[.10,1.32,.18],width:.021}
};

// Shingled scapulars bridge the shoulder and the bases of the flight feathers.
// They use the same bone and draw call as the costume's existing pinion.
function shoulderCoverts(sign,fold,bind,inverse,rootTint,wingTint,positions,colors,indices) {
  const up=new Vector3(0,1,0),joint=new Vector3(sign*.19,.705,.035);
  const point=new Vector3(),shade=new Color(),base=new Color(),quill=new Color('#bdbaa6');
  const mantle=new Color('#acafa3'),edgeTint=new Color('#a69980');
  const ribs=[-1,-.55,-.11,0,.11,.55,1];
  function surface(distance,chord,across,width,offset){
    const half=.10*Math.pow(Math.sin(Math.PI*Math.pow(MathUtils.clamp(distance,0,1),.78)),.6);
    const x=.207+distance*.092+.024*Math.sin(distance*Math.PI);
    point.set(sign*(x+offset),.705-distance*.31,.045+distance*.29+chord*half+across*width);
    point.sub(joint).applyAxisAngle(up,-sign*fold).add(joint).applyMatrix4(bind).applyMatrix4(inverse);
    positions.push(point.x,point.y,point.z);
  }
  for(let row=3;row>=0;row--){
    for(let j=0;j<8;j++){
      const seed=Math.sin(17.3*j+24.6*row),center=(j+.25+.45*(row%2))/8*1.85-.91;
      const start=.026+.15*row+.037*seed+.069*center*center,length=.22+.045*Math.cos(3*j+row);
      const size=.0225+.003*seed,first=positions.length/3;
      base.copy(rootTint).lerp(wingTint,.32+.08*row).lerp(mantle,.77-.10*row).multiplyScalar(.95+.04*seed);
      for(let k=0;k<=10;k++){
        const t=k*.1,d=start+length*t;
        const width=size*Math.pow(Math.max(.015,Math.sin(Math.PI*t**.87)),.56);
        for(const across of ribs){
          const edge=Math.abs(across);
          surface(d,center*(.82+.18*t)+(.11+.07*seed)*t,across,width,.014-.0024*row+.005*(1-edge)*Math.sin(Math.PI*t)+.002*t);
          shade.copy(base).lerp(edgeTint,.16*t*t).multiplyScalar(.90+.045*t+.07*(1-edge)+.02*Math.cos(k*1.7+edge*4+seed));
          if(!edge)shade.lerp(quill,.11+.04*t);
          else shade.lerp(quill,Math.max(0,t-.73)*.54+.033*edge*t);
          colors.push(shade.r,shade.g,shade.b);
        }
        if(!k)continue;
        for(let n=0;n<ribs.length-1;n++){
          const a=first+(k-1)*ribs.length+n,b=a+ribs.length;
          if(sign>0)indices.push(a,b+1,b,a,a+1,b+1);
          else indices.push(a,b,b+1,a,b+1,a+1);
        }
      }
    }
  }
}

function pinions(group,traits) {
  const rig=group.getObjectByName('Shuoyu_plumage');
  if (!rig?.skeleton) return null;
  const layout=outlines[traits.id];
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.07,side:DoubleSide});
  const pigment=new Color(traits.wingTint),rootPigment=new Color(traits.bodyTint);
  const shaft=new Color(traits.id==='sun'?'#f6df96':traits.id==='jade'?'#b4d9be':'#ddc699');
  const feathers=[];
  for (const sign of [-1,1]) {
    const boneName=layout.bone==='Wing'?'Wing'+(sign<0?'L':'R'):layout.bone;
    const boneIndex=rig.skeleton.bones.findIndex(b=>b.name===boneName);
    if (boneIndex<0) continue;
    const bundle=new Group();
    bundle.name='Collection_'+traits.id+'_'+(sign<0?'L':'R');
    const positions=[],colors=[],indices=[];
    const wing=rig.skeleton.bones.findIndex(b=>b.name==='Wing'+(sign<0?'L':'R'));
    if(layout.bone==='Wing')shoulderCoverts(sign,group.userData.foldedWingYaw||0,rig.bindMatrix,rig.skeleton.boneInverses[wing],rootPigment,pigment,positions,colors,indices);
    for (let feather=0;feather<traits.level;feather++) {
      const point=(v,progress)=>new Vector3(sign*(v[0]+feather*.016*progress),v[1]-.035*feather*progress,v[2]-.034*feather*progress);
      const curve=new CubicBezierCurve3(point(layout.base,0),point(layout.rise,.3),point(layout.mid,.7),point(layout.tip,1));
      const offset=positions.length/3;
      for (let j=0;j<=24;j++) {
        const t=j/24,p=curve.getPoint(t);
        const width=layout.width*Math.pow(Math.sin(Math.PI*t),.63)*(1-feather*.1);
        const depth=layout.bone==='Wing'?1:.38;
        for (const across of [-1,-.18,0,.18,1]) {
          const edge=Math.abs(across);
          const v=p.clone();
          v.x+=across*width*sign;
          v.y-=edge*width*.25;
          v.z+=across*width*depth;
          v.applyMatrix4(rig.bindMatrix).applyMatrix4(rig.skeleton.boneInverses[boneIndex]);
          positions.push(v.x,v.y,v.z);
          const c=rootPigment.clone().lerp(pigment,.35+.65*t);
          if (across===0) c.lerp(shaft,.77);
          else if (edge===1) c.multiplyScalar(.71+(.12*Math.sin(j*1.95+feather)));
          colors.push(c.r,c.g,c.b);
        }
        if (j) for (let k=0;k<4;k++) {
          const a=offset+(j-1)*5+k;
          indices.push(a,a+1,a+5,a+1,a+6,a+5);
        }
      }
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
    bundle.add(mesh);rig.skeleton.bones[boneIndex].add(bundle);
    feathers.push({bundle,geometry});
  }
  return {dispose(){for(const {bundle,geometry} of feathers){bundle.removeFromParent();geometry.dispose();}material.dispose();}};
}

export function applyCollectionLook(actor, traits) {
  const group = actor?.group || actor;
  if (!group?.traverse || !traits || !['reed','jade','sun'].includes(traits.id)) return false;
  const cache = caches.get(group) || collectTracts(group);
  caches.set(group,cache);
  const signature = traits.id + '-' + traits.level;
  if (cache.signature === signature) return false;
  const body = new Color(traits.bodyTint), wing = new Color(traits.wingTint);
  const strength = .78 + .09 * MathUtils.clamp(traits.level - 1,0,2);
  for (const {color,indices,samples} of cache.tracts) {
    for (let j=0;j<indices.length;j++) {
      const k=j*6,length=samples[k+5];
      const tint = length<0 || (traits.id==='sun' && length<.38) ? body : wing;
      // Keep the authored vane and rachis shading in the dyed zone.
      const shade=samples[k+4],blend=samples[k+3]*strength;
      const r=samples[k],g=samples[k+1],b=samples[k+2];
      color.setXYZ(indices[j],r+(tint.r*shade-r)*blend,g+(tint.g*shade-g)*blend,b+(tint.b*shade-b)*blend);
    }
    color.needsUpdate=true;
  }
  cache.accessory?.dispose();
  cache.accessory=pinions(group,traits);
  group.userData.collectionForm = {id:traits.id,level:traits.level};
  cache.signature=signature;
  return true;
}

