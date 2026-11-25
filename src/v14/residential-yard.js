import * as T from 'three';

// The broken walls expose the alternating woven core. Both footprint and
// section come from this schedule, so a visible doorway stays traversable.
const walls=[
  [-4.8,-1.7,.16,2.6,1.66],[-2.85,-4.15,2.05,.16,1.32],
  [-.90,-2.72,.16,.96,.90],[-4.03,.75,.80,.16,.75]
];
const jars=[[-3.87,-2.90,.38],[-3.32,-3.25,.28],[-1.54,-3.43,.41]];
const flags=[[1.0,1.24],[2.83,1.24],[2.83,2.46],[1.0,2.46]];

export function buildResidentialYard({local,put,pole,cord,mat,wood,fiber,clay,stone,reedTexture,wind}){
  const earth=mat(0xa77b56),silt=mat(0x78614c),ash=mat(0x514a42),straw=mat(0xc2a176);
  const loader=typeof document!=='undefined'?new T.TextureLoader():null;
  function tile(path){
    const texture=loader.load(path);texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
  }
  if(loader){
    const clayPhoto=tile('/assets/v10/workshop/clay.jpg'),daub=tile('/assets/v14/daub.webp');
    earth.map=earth.bumpMap=daub;earth.bumpScale=.045;earth.color.setHex(0xf3e8ce);
    clay.map=clay.bumpMap=silt.map=ash.map=clayPhoto;clay.bumpScale=.014;
    wood.map=tile('/assets/v14/pole-grain.webp');wood.map.repeat.set(1,.58);wood.color.setHex(0xe4d7b9);
    silt.color.setHex(0x89806d);ash.color.setHex(0x5e665c);clay.color.setHex(0xc3a486);
    const floor=mat(0xdfdcc3);floor.map=tile('/assets/v14/yard-earth.webp');
    floor.vertexColors=floor.transparent=true;floor.depthWrite=false;floor.polygonOffset=true;floor.polygonOffsetFactor=-2;
    const skin=new T.PlaneGeometry(16,15,32,30);skin.rotateX(-Math.PI/2);
    const p=skin.attributes.position,uv=skin.attributes.uv,colors=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),edge=Math.hypot(x/7.4,z/6.25)+.044*Math.sin(x*1.2+z*.61);
      const alpha=.91*(1-T.MathUtils.smoothstep(edge,.66,1));
      p.setY(i,local(x,z)+.026);uv.setXY(i,(x+.07*z)*.31,(z-.07*x)*.31);colors.push(1,1,1,alpha);
    }
    skin.setAttribute('color',new T.Float32BufferAttribute(colors,4));skin.computeVertexNormals();put(skin,floor,0,0,0);
  }
  for(const [x,z,hx,hz,height] of walls){
    const y=local(x,z);
    const block=new T.BoxGeometry(hx*2,height+.08,hz*2,Math.ceil(hx*8),5,Math.ceil(hz*8));
    const p=block.attributes.position,uv=block.attributes.uv;
    for(let i=0;i<p.count;i++){
      const a=p.getX(i),b=p.getY(i),c=p.getZ(i),along=hx>hz?a:c;
      const band=b/height+.5,broken=.085*Math.cos(along*2.3)+.055*Math.sin(along*4.6);
      const rough=.019*Math.sin(13*along+b*5)*Math.cos(8*b);
      p.setXYZ(i,a+rough*(hx<hz),b+broken*band*band,c+rough*(hx>hz));
      uv.setXY(i,(along+.16*(a+c)+1.56)*.89,(b+.07*Math.sin(along))*.87);
    }
    block.computeVertexNormals();put(block,earth,x,y+height*.5-.04,z);
    const alongX=hx>hz,length=Math.max(hx,hz)*2,ox=alongX?1:0,oz=1-ox;
    for(let i=0;i<=Math.ceil(length/.37);i++){
      const offset=(i/Math.ceil(length/.37)-.5)*length;
      const px=x+offset*ox,pz=z+offset*oz,top=height+.24+.32*Math.sin(i*.9+.4);
      pole([px,y-.10,pz],[px+.045*Math.sin(i),y+top,pz],.042,wood);
    }
    for(let layer=0;layer<4;layer++){
      const points=[];
      for(let i=0;i<=18;i++){
        const d=length*(i/18-.5),wave=.044*Math.cos(i*Math.PI*.5+layer*Math.PI);
        points.push([x+d*ox+wave*oz,y+height-.20+layer*.094+.025*Math.sin(i*.56),z+d*oz+wave*ox]);
      }
      cord(points,layer%2?fiber:wood,.022);
    }
    for(let i=0;i<36;i++){
      const d=(i/36-.5)*length,px=x+ox*d+oz*(hx+.002),pz=z+oz*d+ox*(hz+.002);
      const h=y+.11+(height-.13)*((i*.618)%1);
      pole([px,h,pz],[px+ox*.08,h+.036,pz+oz*.08],.008,straw);
    }
  }
  // Leave the front span open as a cutaway; thatch survives only in the rear bay.
  const roofing=mat(0xe3d5b0);roofing.map=loader?tile('/assets/v14/thatch.webp'):reedTexture();
  roofing.bumpMap=roofing.map;roofing.bumpScale=.034;
  const ridge=-2.85,back=-4.56,front=-2.14;
  for(const x of [-4.9,-.8])for(const z of [-4.20,-2.40])pole([x,local(x,z)-.1,z],[x,2.34,z],.084,wood);
  for(const z of [-4.20,-2.40]){
    pole([-4.98,2.22,z],[-.74,2.22,z],.075,wood);
    pole([-4.98,2.20,z],[ridge,3.33,z],.080,wood);pole([ridge,3.33,z],[-.74,2.20,z],.080,wood);
  }
  pole([ridge,3.35,back],[ridge,3.35,front],.085,wood);
  for(const side of [-1,1]){
    const roof=new T.PlaneGeometry(1,1,9,42),p=roof.attributes.position,uv=roof.attributes.uv;
    for(let i=0;i<p.count;i++){
      const u=p.getX(i)+.5,v=p.getY(i)+.5,f=.045*Math.sin(v*94+side);
      p.setXYZ(i,ridge+side*u*(2.42+f),3.41-1.29*u+f*u,back+(front-back)*v+.045*Math.sin(u*19+side));
      uv.setXY(i,v*2.1,u*.81);
    }
    roof.computeVertexNormals();put(roof,roofing,0,0,0);
    for(let i=0;i<37;i++){
      const z=back+(front-back)*i/36,drop=.06+.14*(.5+.5*Math.sin(i*3.41));
      pole([ridge+side*2.34,2.17,z],[ridge+side*(2.42+drop),2.10-drop,z+.024*Math.sin(i)],.012,i%4?roofing:straw);
    }
  }
  for(const [x,z,r] of jars){
    const y=local(x,z),profile=[[.40,0],[.54,.10],[.92,.48],[1,.85],[.80,1.22],[.56,1.39],[.56,1.55],[.67,1.57],[.65,1.65],[.53,1.62],[.49,1.51],[.47,1.27]];
    put(new T.LatheGeometry(profile.map(([u,v])=>new T.Vector2(r*u,r*v)),26),clay,x,y,z);
    for(let k=0;k<3;k++)put(new T.TorusGeometry(r*(.65+k*.045),.009,4,26),silt,x,y+r*(1.34-k*.064),z,[Math.PI/2,0,0]);
  }
  for(const [i,[x,z]] of flags.entries()){
    const y=local(x,z);pole([x,y,z],[x,y+.53,z],.027,wood);
    const next=flags[(i+1)%4];
    cord([[x,y+.42,z],[(x+next[0])/2,y+.36,(z+next[1])/2],[next[0],local(...next)+.42,next[1]]],fiber,.009);
  }
  // A shallow ash stain and charcoal lenses are read from the yard edge.
  for(let k=0;k<4;k++){
    const x=1.91+Math.sin(k*2.4)*.18,z=1.83+.14*Math.cos(k*2.4);
    put(new T.SphereGeometry(1,25,7),k%2?ash:silt,x,local(x,z)+.006+k*.006,z,[0,k*.4,0],[.79-k*.12,.023,.48-k*.057]);
  }
  for(let n=0;n<18;n++){
    const x=1.91+.53*Math.sin(n*2.14)*Math.cos(n*.46),z=1.83+.33*Math.cos(n*2.14);
    put(new T.IcosahedronGeometry(.052,0),n%4?ash:clay,x,local(x,z)+.055,z,[n,n*.42,.45],[1,.39,.71]);
  }
  // Dry panicles at the margin frame the low house without obscuring its doors.
  const leafGreen=mat(0x8f9653),leafGold=mat(0xada05f),husk=mat(0xbaa267);
  if(loader){
    const crop=mat(0xddd8aa);crop.map=tile('/assets/v14/rice-clump.webp');
    crop.map.wrapS=crop.map.wrapT=T.ClampToEdgeWrapping;
    crop.alphaTest=.44;crop.alphaToCoverage=true;crop.vertexColors=true;
    crop.onBeforeCompile=shader=>{
      shader.uniforms.earTime=wind;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float earTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=.026*sin(earTime*1.6+position.z*1.1)*smoothstep(.10,1.10,position.y);');
    };
    for(let i=0;i<23;i++){
      const x=3.78+.77*Math.sin(i*2.07),z=-3.49+(i%9)*.53+.23*Math.cos(i*2.33);
      const y=local(x,z),h=.87+.32*(.5+.5*Math.sin(i*1.07));
      for(let side=0;side<2;side++){
        const card=new T.PlaneGeometry(h*.69,h,2,4),p=card.attributes.position,colors=[];
        const c=new T.Color().setHSL(.13+.012*Math.sin(i),.25,.70+.10*Math.sin(i*2.3));
        for(let n=0;n<p.count;n++){
          const u=p.getX(n),t=.5+p.getY(n)/h;
          p.setZ(n,.042*t*t+.042*(1-Math.abs(u)/(h*.345)));
          const light=.76+.24*t;colors.push(c.r*light,c.g*light,c.b*light);
        }
        card.computeVertexNormals();card.setAttribute('color',new T.Float32BufferAttribute(colors,3));
        put(card,crop,x,y+h*.5-.015,z,[.032*Math.cos(i),i*2.31+side*1.37,0]);
      }
    }
  }
  for(let n=0;n<13;n++){
    const x=3.70+.88*Math.sin(n*1.73),z=-3.5+n*.13+.40*Math.sin(n*2.41),y=local(x,z),h=.83+.22*Math.cos(n*.71);
    const sway=.14*Math.sin(n*2.3);
    pole([x,y,z],[x+sway*.28,y+h*.65,z],.013,leafGreen);
    pole([x+sway*.28,y+h*.65,z],[x+sway,y+h,z+.06],.010,leafGold);
    for(let k=0;k<4;k++){
      const a=k*2.39+n,h0=y+h*(.15+k*.14),length=.48+.14*Math.cos(n+k);
      const blade=new T.PlaneGeometry(1,1,2,7),points=blade.attributes.position;
      for(let j=0;j<points.count;j++){
        const u=points.getX(j)*2,t=points.getY(j)+.5,w=.024*Math.sin(Math.PI*t)**.67;
        const d=length*t*t,along=h0+.46*t-.27*t*t+.06*Math.sin(t*Math.PI);
        points.setXYZ(j,x+sway*.24+Math.sin(a)*d+Math.cos(a)*u*w,along+.012*(1-Math.abs(u)),z+Math.cos(a)*d-Math.sin(a)*u*w);
      }
      blade.computeVertexNormals();put(blade,(n+k)%4?leafGreen:leafGold,0,0,0);
    }
    for(let branch=0;branch<4;branch++){
      const a=n*.7+branch*1.93,l=.085+branch*.019,starting=[x+sway,y+h+.035-branch*.028,z+.06];
      const tip=[starting[0]+l*Math.cos(a),starting[1]-.125-.043*branch,starting[2]+l*Math.sin(a)];
      pole(starting,tip,.0065,husk);
      for(let grain=0;grain<5;grain++){
        const f=.20+grain*.17;
        put(new T.SphereGeometry(.020,5,3),husk,starting[0]*(1-f)+tip[0]*f+.013*Math.sin(grain*2),starting[1]*(1-f)+tip[1]*f-.022,starting[2]*(1-f)+tip[2]*f,[.10*Math.cos(a),a,.36*Math.sin(a)],[.59,1.5,.65]);
      }
    }
  }
  for(const [x,z] of [[-5.27,1.72],[-5.66,1.51],[.39,-4.7]]){
    put(new T.IcosahedronGeometry(.30,1),stone,x,local(x,z)+.06,z,[.4,x,0],[1,.57,1.02]);
  }
}
export function addResidentialSupports({box,post}){
  for(const [x,z,hx,hz,h] of walls)box(x,z,-.09,h+.22,hx+.025,hz+.025,'前方是木骨泥墙。绕到院子的南侧，从断墙之间通过。');
  for(const [x,z,r] of jars)post(x,z,r*1.65,r);
  for(const [x,z] of flags)post(x,z,.53,.029);
  for(const x of [-4.9,-.8])for(const z of [-4.2,-2.4])post(x,z,2.34,.084);
  for(let i=0;i<20;i++){
    const dx=(i-9.5)*.25,h=3.41-1.29*Math.abs(dx)/2.42;
    box(-2.85+dx,-3.35,h-.11,h+.05,.125,1.26,'后屋还留着草檐，从敞开的前院展翼。');
  }
}
