import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {sites,ground} from './geography.js';
import {V,tau,makePalette,makeKit} from './station-kit.js';
import {disposeGraph} from './fieldwork-studio.js';
import {excavation as trench} from './station-trench.js';
import {postOffsets,postWidth} from './post-layout.js';

const names=['滨河探方','古河道渡口','古木鉴定台','滨岸治玉作坊','陶作修复架','铜鸟支护台','象牙保护棚','金箔光学工位','滨河建筑基址'];
const ochre=0xb49e74,cord=0x9f855e,iron=0x4e4d43;


function dock(k){
  const {group,y,rod,box,coll,perch}=k,water=-group.position.y,rz=-2.31;
  const start=-.59,end=2.61,level=water+.29,from=y(start,rz)+.10,to=level+.075;
  const deckHeight=x=>T.MathUtils.lerp(from,to,T.MathUtils.clamp((x-start)/(end-start),0,1));
  for(const zz of [rz-.68,rz+.68])rod([start,from-.12,zz],[end,to-.12,zz],.082,'wood',0xa08b69);
  for(let i=0;i<18;i++){const x=T.MathUtils.lerp(start,end,i/17),h=deckHeight(x)-.052;
    box([x,h,rz],[(end-start)/17*.97,.104,1.53],'wood',i%3?0xc8aa78:0xb49e70,[.004*Math.sin(i),.005*Math.sin(i*3),0]);}
  k.surface(start-.08,end+.08,rz-.76,rz+.76,deckHeight);
  for(const [x,zz] of [[start,rz-.82],[end,rz-.82],[end,rz+.76]]){
    const h=deckHeight(x)+.91;rod([x,Math.min(y(x,zz)-.2,water-.2),zz],[x,h,zz],.095,'wood',ochre,.073);coll(x,zz,y(x,zz),Math.max(.4,h-y(x,zz)),.12);
    for(let i=0;i<5;i++)k.ring([x,h-.27+i*.038,zz],.086,.016,'matte',cord);
  }
  perch('渡口系缆桩',end,to+.91,rz+.76);
  const rx=end+.79;
  for(let i=-4;i<=4;i++){const x=rx+i*.13,l=1.47-.035*Math.abs(i),tint=i%2?0xac945f:0xb9a76f;
    rod([x,water+.09,rz-l],[x,water+.09,rz+l],.071,'matte',tint,.068);
    for(let j=-2;j<=2;j++)rod([x,water+.09,rz+j*.49-.014],[x,water+.09,rz+j*.49+.014],.074,'matte',0x776d4b);
  }
  for(const dz of [-.86,.81]){rod([rx-.62,water+.18,rz+dz],[rx+.63,water+.18,rz+dz],.054,'wood',ochre);
    for(let i=-2;i<=2;i++)k.ring([rx+i*.25,water+.13,rz+dz],.101,.02,'matte',cord,[0,Math.PI/2,0]);}
  k.sweep([[end,to+.70,rz+.76],[end+.23,level+.36,rz+.79],[rx,water+.16,rz+.89]],[.017,.017,.017],'matte',cord);
  rod([rx-.69,water+.12,rz-1.15],[rx+.39,water+.78,rz+1.0],.025,'wood',ochre);
  k.surface(rx-.54,rx+.54,rz-1.28,rz+1.28,()=>water+.17);
}

function rootCradle(k){
  const {y,rng,peg,rod,ell,sweep,coll,perch}=k,cx=2.12,cz=-1.94,b=y(cx,cz),rows=[];
  for(let i=0;i<7;i++){const a=i*tau/7+.17*Math.sin(i*13),dx=Math.cos(a),dz=Math.sin(a),r=1.35+(i%3)*.36;
    const pts=[[cx+dx*.19,b+.60,cz+dz*.19],[cx+dx*.65,b+.38,cz+dz*.67],[cx+dx*r*.81,y(cx+dx*r*.81,cz+dz*r*.81)+.12,cz+dz*r*.81],[cx+dx*r,y(cx+dx*r,cz+dz*r)+.05,cz+dz*r]];
    sweep(pts,[.38,.32,.13,.018],'wood',i%2?0xc0ad8e:0xa5957b,.78);
    const t=pts[2];for(const sign of [-1,1]){const ex=t[0]+dx*.36+dz*sign*.25,ez=t[2]+dz*.36-dx*sign*.25;sweep([pts[1],t,[ex,y(ex,ez)+.025,ez]],[.10,.065,.007],'wood',0xb8a78c);}
    rows.push(pts[3]);
  }
  // Broken, irregular crown with a dark wet heart and splintered sapwood.
  ell([cx,b+.30,cz],[.57,.31,.48],'wood',0xc6bc9e);
  for(let i=0;i<8;i++){const a=tau*i/8,r=.39+.06*rng(),h=.49+.24*rng();
    const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    sweep([[x,b+.21,z],[x+.04,b+h*.7,z-.03],[x+.09*Math.sin(i),b+h,z+.038]],[.13,.096,.015],'wood',i%4?0xa7977c:0xcabd97);}
  k.group.userData.assetReady=new GLTFLoader().loadAsync('/assets/v10/tree-root-lod.gltf').then(({scene})=>{
    if(!k.isAlive()){disposeGraph(scene);return;}
    scene.position.set(cx+.02,b+.19,cz);scene.rotation.y=.26;scene.scale.setScalar(1.92);k.addScan(scene);
  }).catch(()=>{});
  coll(cx,cz,b,1.39,.66);
  const branch=[[cx,b+.45,cz],[cx+.62,b+.91,cz-.16],[cx+.98,b+1.02,cz-.42],[cx+1.35,b+1.04,cz-.61]];
  sweep(branch,[.20,.14,.09,.045],'wood',0x97866b);perch('古根侧枝',cx+1.06,b+1.115,cz-.47,.5);
  for(const i of [0,2,4,6]){const [x,,z]=rows[i],h=peg(x+.10,z,.71,.040);rod([x+.10,h-.10,z],[x+.1,h,z],.043,'matte',0xd8bf88);}
}

function jadeShelter(k){
  const {y,peg,rod,box,ell,cloth,perch,coll,rng}=k,shade=[[-2.66,-1.45],[2.70,-1.45],[2.70,-4.03],[-2.66,-4.03]],ceiling=y(0,-2.6)+2.63;
  for(const [i,[x,z]] of shade.entries()){const h=ceiling+(i>1?-.68:.11),by=y(x,z);
    rod([x,by-.16,z],[x,h,z],.105,'wood',0xc4a478,.079);coll(x,z,by,h-by,.13);
    rod([x,by+.38,z],[x+(x>0?-.64:.64),h-.12,z],.055,'wood',0xad8e66);}
  for(let i=0;i<4;i++){const [x,z]=shade[i],[xx,zz]=shade[(i+1)%4];rod([x,ceiling+(i>1?-.68:.11),z],[xx,ceiling+((i+1)%4>1?-.68:.11),zz],.079,'wood',ochre);}
  cloth([[-3.1,ceiling+.15,-1.20],[3.15,ceiling+.15,-1.20],[3.15,ceiling-.64,-4.31],[-3.1,ceiling-.64,-4.31]],'cloth',0x887951,.11);
  for(let i=0;i<77;i++){
    const x=-3.09+i*.081,lag=rng()*.14,c=i%3?0xab9969:0x8f855f;
    rod([x,ceiling-.59,-4.31],[x+.046*Math.sin(i*2),ceiling+.12-lag,-1.05+lag],.047,'matte',c,.025,5);
  }
  const x=-.52,z=-2.49,b=y(x,z);box([x,b+.40,z],[2.33,.23,1.03],'stone',0xaeaa8c);
  [-.72,.72].forEach(dx=>{box([x+dx,b+.18,z],[.39,.45,.74],'stone',0x9c927b);});
  box([x,b+.67,z],[1.02,.37,.49],'stone',0x76a995,[0,.12,.03]);box([x+.19,b+.855,z],[.028,.021,.41],'matte',0x344d43,[0,.12,0]);
  k.sweep([[x-.81,b+.81,z+.02],[x-.67,b+1.58,z-.01],[x+.85,b+1.42,z+.04],[x+.73,b+.82,z+.03]],[.034,.058,.052,.03],'wood',ochre);
  rod([x-.81,b+.81,z+.02],[x+.73,b+.82,z+.03],.012,'matte',cord);
  k.pot([x+1.20,b+.51,z+.18],[[.13,0],[.24,.10],[.21,.37],[.10,.49],[.11,.53],[.084,.52],[.083,.47]],0x93795f,.71);
  k.ring([x-.96,b+.55,z+.18],.153,.065,'stone',0xa8c69f);
  k.solidBox(x,z,b,.90,1.16,.52,'前方是治玉案，沿案边绕开或从玉料上方越过。');perch('玉棚横梁',2.70,ceiling+.19,-1.45);
}

function potteryYard(k){
  const {y,rod,box,pot,ring,coll,perch,shape}=k,x=-.43,z=-2.99,b=y(x,z);
  // A kiln slice opens towards the clearing. Its dark firing chamber, clay
  // lining, ash bed and vent remain discernible while the player approaches.
  for(const [r,d,color] of [[1.06,0,0xab7f66],[.90,.017,0x604e43]]){
    const profile=[[r,.02],[r*1.08,.33],[r*.98,.7],[r*.70,.99],[r*.46,1.18],[r*.40,1.28]];
    shape(new T.LatheGeometry(profile.map(([a,h])=>new T.Vector2(a,h)),41,.62,tau-1.24),'ceramic',color,[x,b+d,z]);
  }
  pot([x,b+1.21,z],[[.43,0],[.38,.12],[.31,.19],[.29,.34],[.24,.34],[.24,.14]],0x655646);
  k.ell([x,b+.06,z],[.97,.09,.96],'earth',0x675345);
  for(let i=0;i<7;i++){const dx=-.63+i*.205;box([x+dx,b+.13,z+.59],[.14,.16,.47],'ceramic',i%2?0x826554:0x614e42,[.02*Math.sin(i),.09*Math.cos(i),0]);}
  coll(x,z,b,1.57,.97);
  const xx=2.20,zz=.05,by=y(xx,zz);
  for(const dx of [-.59,.59])for(const dz of [-1.13,1.13])rod([xx+dx,y(xx+dx,zz+dz)-.07,zz+dz],[xx+dx,by+1.22,zz+dz],.071,'wood',ochre);
  for(const h of [.47,.99])for(let i=0;i<6;i++)box([xx-.57+i*.225,by+h,zz],[.16,.055,2.43],'wood',0xafa07b);
  const body=[[.16,0],[.25,.032],[.35,.25],[.33,.43],[.21,.53],[.22,.59],[.25,.61],[.22,.63],[.19,.6],[.18,.55]];
  for(let i=0;i<6;i++){const h=i<3?.498:1.017,v=.63+(i%3)*.11,p=[xx,by+h,zz-.78+(i%3)*.74];pot(p,body,i%2?0x9c715a:0xa4846b,v);
    for(let j=0;j<3;j++)ring([p[0],p[1]+(.37+j*.038)*v,p[2]],(.342-j*.01)*v,.010*v,'ceramic',0x806653);}
  for(let i=0;i<9;i++){const a=i*1.17,dx=1.14*Math.cos(a),dz=.56*Math.sin(a);shape(new T.CircleGeometry(.16+k.rng()*.08,5,0,Math.PI*1.4),'ceramic',i%2?0xbe997b:0x9e735e,[x+dx,y(x+dx,z+1.10+dz)+.04,z+1.1+dz],[-1.39,a,.12]);}
  k.solidBox(xx,zz,by,1.47,.65,1.21,'陶架上摆着修复中的器物。从架子外侧绕行。');perch('晾陶架横木',xx+.58,by+1.22,zz+1.13);
}

function bronzeTable(k){
  const {y,rod,box,ell,cloth,coll,perch}=k,x=-.63,z=-2.52,b=y(x,z);
  const h=2.17;for(const dx of [-1.48,1.48]){
    rod([x+dx,b-.07,z],[x+dx,b+h,z],.085,'wood',0x937651);
    rod([x+dx,b+.04,z-.63],[x+dx,b+1.4,z],.048,'wood',ochre);
  }
  rod([x-1.65,b+h,z],[x+1.65,b+h,z],.095,'wood',ochre);
  box([x,b+.74,z+.73],[1.92,.24,.71],'stone',0xc5b89a);
  for(const dx of [-.61,.61])box([x+dx,b+.38,z+.73],[.36,.67,.55],'stone',0x8e8979);
  const at=[x,b+.87,z+.71];
  for(const dx of [-.20,.20]){
    rod([x+dx,b+.88,z+.62],[x+dx,b+1.29,z+.62],.032,'bronze',0x91836e);
    k.sweep([[x+dx,b+1.29,z+.57],[x+dx,b+1.25,z+.72],[x+dx,b+1.31,z+.83]],[.028,.027,.024],'cloth',0xafa184);
  }
  ell([at[0],at[1]+.48,at[2]],[.15,.12,.26],'bronze',0x668274,[.27,0,0]);
  k.sweep([[x,b+1.32,z+.67],[x,b+1.60,z+.67],[x,b+1.65,z+.53],[x,b+1.61,z+.42]],[.094,.08,.065,.012],'bronze',0x8b9a7d);
  for(const s of [-1,1]){k.sweep([[x+s*.11,b+1.33,z+.71],[x+s*.23,b+1.51,z+.77],[x+s*.24,b+1.73,z+.86]],[.07,.08,.011],'bronze',0x628578,.53);
    rod([x+s*.064,b+1.09,z+.70],[x+s*.064,b+1.28,z+.70],.025,'bronze',0x75866a);}
  const lx=x+1.46,lz=z+.76,lb=y(lx,lz);k.pot([lx,lb,lz],[[.21,0],[.27,.06],[.10,.13],[.082,.88],[.28,.96],[.31,1.04],[.28,1.07],[.19,1.00]],0x926948);
  k.sweep([[lx,lb+1.03,lz],[lx-.035,lb+1.20,lz],[lx+.045,lb+1.34,lz]],[.052,.064,.002],'flame',0xffcd72);
  k.solidBox(x,z+.73,b,1.72,.96,.37,'铜鸟支护台在前面，请从台面旁绕行。');for(const dx of [-1.48,1.48])coll(x+dx,z,b,h,.09);k.solidBox(x,z,b+h-.08,.16,1.63,.09);perch('支护台横木',x+1.32,b+h+.09,z);
}

function ivoryCanopy(k){
  const {y,rod,box,ell,cloth,sweep,coll,perch}=k,cx=.07,cz=-3.04,b=y(cx,cz),corners=[[-2.85,-1.58],[2.86,-1.57],[2.72,-4.64],[-2.71,-4.59]],heights=[2.66,3.27,2.67,3.19];
  for(const [i,[x,z]] of corners.entries()){
    const h=b+heights[i],by=y(x,z);rod([x,by-.13,z],[x+.04*Math.sin(i),h,z],.087,'wood',0xa79377,.068);
    const dx=x+(x<0?-.59:.59),dz=z+(i<2?.31:-.53);
    rod([x,h-.05,z],[dx,y(dx,dz)+.12,dz],.013,'matte',cord);k.peg(dx,dz,.22,.042);
    coll(x,z,by,h-by,.11);
  }
  const points=corners.map(([x,z],i)=>[x,b+heights[i]-.03,z]);cloth(points,'cloth',0xc7c5af,.35);
  // The hanging hem makes the four-point shade readable against a bright sky.
  for(const [i,c] of points.entries()){
    const n=points[(i+1)%4];cloth([c,n,[n[0],n[1]-.14,n[2]],[c[0],c[1]-.14,c[2]]],'cloth',0x9eaa9a,.035);
  }
  const floor=b+.17;
  box([cx,b+.035,cz],[4.40,.25,2.04],'earth',0x8c7964);
  for(const [dx,dz,hue] of [[-.31,-.31,0xc7b798],[.11,.21,0xb4a387],[.47,-.45,0xc3ad88]]){
    const p=[[-1.31+dx,floor+.13,cz+dz],[dx-.48,floor+.19,cz+.17+dz],[dx+.52,floor+.13,cz+.24+dz],[1.18+dx,floor+.21,cz-.02+dz],[1.56+dx,floor+.29,cz-.39+dz]];
    sweep(p,[.145,.136,.112,.063,.014],'ceramic',hue,.97);
  }
  for(const dx of [-1.35,.1,1.47]){rod([dx,floor+.05,cz+.85],[dx,floor+.56,cz+.85],.026,'matte',0xad7754);box([dx,floor+.46,cz+.86],[.19,.12,.02],'cloth',0xccbe9d);}
  for(let i=0;i<8;i++)ell([-1.94+i*.57,floor+.07,cz-.95],[.30,.13,.17],'cloth',i%2?0x8e8772:0xaba086,[.07,.11*Math.sin(i),.04*Math.sin(i)]);
  k.solidBox(cx,cz,b-.08,.52,2.20,1.02,'象牙保护区需要保留原位。请绕过保护台边缘。');
  const [sx,sz]=corners[3];perch('保护棚后桩',sx,b+heights[3],sz);
}

function foilCut(){
  const disk=new T.Shape();disk.absarc(0,0,1,0,tau,false);
  const p=(r,a)=>[r*Math.cos(a),r*Math.sin(a)],sun=new T.Path();sun.moveTo(...p(.72,0));
  for(let i=0;i<12;i++){const a=i*tau/12;sun.bezierCurveTo(...p(.62,a-.04),...p(.48,a-.20),...p(.415,a-.41));sun.quadraticCurveTo(...p(.57,a+.08),...p(.72,a+tau/12));}sun.closePath();disk.holes.push(sun);
  const bird=new T.Path();
  bird.moveTo(-.58,.636);bird.bezierCurveTo(-.49,.78,-.33,.838,-.16,.817);bird.quadraticCurveTo(-.075,.816,-.071,.879);
  bird.bezierCurveTo(-.09,.929,-.012,.948,.029,.914);bird.quadraticCurveTo(-.025,.924,-.015,.875);bird.bezierCurveTo(.061,.861,.115,.909,.163,.909);
  bird.quadraticCurveTo(.115,.87,.103,.844);bird.quadraticCurveTo(.212,.835,.335,.87);bird.lineTo(.548,.683);
  bird.lineTo(.602,.695);bird.lineTo(.576,.647);bird.lineTo(.607,.629);bird.lineTo(.552,.626);bird.lineTo(.532,.664);
  bird.lineTo(.318,.827);bird.quadraticCurveTo(.19,.795,.062,.821);bird.quadraticCurveTo(-.038,.729,-.15,.796);
  bird.quadraticCurveTo(-.346,.772,-.564,.61);bird.closePath();
  for(let i=0;i<4;i++){const angle=i*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),pts=bird.getPoints(9).map(v=>new T.Vector2(c*v.x-s*v.y,s*v.x+c*v.y));disk.holes.push(new T.Path(pts));}
  return new T.ShapeGeometry(disk,14);
}
function lightScreen(k){
  const {y,rod,box,ring,shape,coll,perch}=k,x=0,z=-2.91,b=y(x,z),mid=b+1.66;
  // The enlarged tracing belongs to this viewing instrument. Its perforated
  // sheet transmits daylight through four birds and the twelve swept rays.
  const r=1.20;
  shape(new T.CircleGeometry(r+.018,80),'cloth',0xd9cba7,[x,mid,z-.09],[0,.075,0]);
  shape(foilCut(),'gold',0xb99959,[x,mid,z],[0,.075,0],[r,r,r]);
  ring([x,mid,z-.02],r+.06,.043,'bronze',0x88795e,[0,.075,0]);
  ring([x,mid,z-.025],r+.19,.066,'wood',0xb0a07c,[0,.075,0]);
  for(let i=0;i<36;i++){const a=i*tau/36,inner=r+.11,outer=r+(i%3?.15:.21);
    rod([Math.cos(a)*inner,mid+Math.sin(a)*inner,z-.019],[Math.cos(a)*outer,mid+Math.sin(a)*outer,z-.019],.012,'matte',0xe0c993);}
  for(const sign of [-1,1]){
    rod([x+sign*1.35,b-.08,z-.24],[x+sign*.89,mid-.72,z-.10],.115,'wood',0xba9f6c);
    box([x+sign*1.30,b+.12,z-.15],[.54,.26,.69],'stone',0xaa9b86);coll(x+sign*1.30,z,b,1.09,.25);
  }
  k.solidBox(x,z,mid-r-.1,r*2+.2,r+.13,.12,'前方是透光框。可从框边绕行，或振翼越过上沿。');
  const flap=[[-2.17,b+2.93,z-.40],[2.20,b+2.84,z-.42],[2.43,b+2.49,z-1.45],[-2.39,b+2.45,z-1.46]];
  k.cloth(flap,'cloth',0x7f8271,.085);
  for(const sign of [-1,1]){rod([sign*2.03,y(sign*2.03,z-1.01)-.08,z-1.01],[sign*2.03,b+2.76,z-.82],.074,'wood',ochre);}
  perch('透光框侧撑',1.35,b+.32,z-.2);
}

function postCourt(k){
  const {y,rod,perch,rng,shape}=k,cx=postOffsets[1][0],front=postOffsets[0][1];
  const dx=postOffsets[1][0]-postOffsets[0][0],dz=postOffsets[0][1]-postOffsets[3][1];
  function bed(x,z){
    const u=Math.abs((x-cx)/(1.5*dx)),v=Math.abs((z-(front-dz))/(1.5*dz));
    return y(x,z)+.022+.17*(1-T.MathUtils.smoothstep(Math.max(u,v),.82,1));
  }
  // Excavation 18 retained nine square sockets from posts about 0.40 m
  // wide. Each four-sided recess has soil walls and a dark compacted floor.
  for(const [x,z] of postOffsets){
    const half=postWidth/2;
    const outline=[[-1,-1],[1,-1],[1,1],[-1,1]];
    const inner=outline.map(([a,b])=>[x+a*half,z+b*half]);
    const outer=outline.map(([a,b])=>[x+a*dx*.5,z+b*dz*.5]);
    const vertices=[],uv=[],index=[];
    for(let j=0;j<4;j++){
      const n=(j+1)%4,steps=6,rings=5,base=vertices.length/3;
      for(let r=0;r<=rings;r++)for(let s=0;s<=steps;s++){
        const t=s/steps,u=r/rings;
        const xx=T.MathUtils.lerp(T.MathUtils.lerp(inner[j][0],inner[n][0],t),T.MathUtils.lerp(outer[j][0],outer[n][0],t),u);
        const zz=T.MathUtils.lerp(T.MathUtils.lerp(inner[j][1],inner[n][1],t),T.MathUtils.lerp(outer[j][1],outer[n][1],t),u);
        vertices.push(xx,bed(xx,zz),zz);uv.push(xx*.57,zz*.57);
        if(r<rings&&s<steps){const v=base+r*(steps+1)+s;index.push(v,v+1,v+steps+1,v+1,v+steps+2,v+steps+1);}
      }
      const [[ax,az],[bx,bz]]=[inner[j],inner[n]],h=y(x,z)+.018;
      const wall=new T.BufferGeometry().setFromPoints([V(ax,bed(ax,az),az),V(bx,bed(bx,bz),bz),V(x+(bx-x)*.84,h,z+(bz-z)*.84),V(x+(ax-x)*.84,h,z+(az-z)*.84)]);
      wall.setIndex([0,1,2,0,2,3]);wall.computeVertexNormals();shape(wall,'cloth',j%2?0x554838:0x655443);
    }
    const soil=new T.BufferGeometry();soil.setAttribute('position',new T.Float32BufferAttribute(vertices,3));soil.setAttribute('uv',new T.Float32BufferAttribute(uv,2));soil.setIndex(index);soil.computeVertexNormals();shape(soil,'earth',0xc5b798);
    k.box([x,y(x,z)+.022,z],[.352,.012,.352],'matte',0x302c25);
    for(let i=0;i<5;i++){
      const n=i%4,[ax,az]=inner[n],[bx,bz]=inner[(n+1)%4],t=rng(),px=T.MathUtils.lerp(ax,bx,t),pz=T.MathUtils.lerp(az,bz,t);
      shape(new T.IcosahedronGeometry(1,0),'earth',0xc8af8a,[px,bed(px,pz),pz],[.02,rng()*tau,.04],[.042,.018,.033]);
    }
  }
  const minX=cx-dx*1.5,maxX=cx+dx*1.5,minZ=front-2.5*dz,maxZ=front+.5*dz;
  k.surface(minX,maxX,minZ,maxZ,(x,z)=>postOffsets.some(p=>Math.abs(x-p[0])<.18&&Math.abs(z-p[1])<.18)?y(x,z)+.026:bed(x,z));
  // Small outside survey stakes carry removable datum strings. The presumed
  // ancient wooden structure is left absent, as it is in the excavated site.
  const marks=[[cx-dx-.41,front+.37],[cx-dx-.41,front-2*dz-.37],[cx+dx+.41,front-2*dz-.37],[cx+dx+.41,front+.37]];
  const hs=[];
  for(const [i,[x,z]] of marks.entries()){
    const top=bed(x,z)+.58;hs.push(top);
    rod([x,y(x,z)-.04,z],[x,top,z],.027,'matte',0xa99165,.024,7);
    rod([x,top-.085,z],[x,top,z],.027,'matte',0xd7c9a1,.024,7);
    if(i>0){const [px,pz]=marks[i-1];k.sweep([[px,hs[i-1]-.09,pz],[(px+x)/2,(hs[i-1]+top)/2-.14,(pz+z)/2],[x,top-.09,z]],[.008,.008,.008],'matte',0xa89067);}
  }
  const xx=-2.29,zz=-1.69,b=y(xx,zz);
  for(const ox of [-.42,.42])rod([xx+ox,y(xx+ox,zz)-.06,zz],[xx+ox,b+1.37,zz],.078,'wood',ochre);
  rod([xx-.59,b+1.36,zz],[xx+.59,b+1.36,zz],.071,'wood',ochre);
  for(let i=0;i<5;i++){
    const dx=(i-2)*.063;
    k.sweep([[xx-.22+dx,b+1.38,zz],[xx-.31+dx,b+.80,zz+.06],[xx+dx,b+.59,zz+.09],[xx+.30+dx,b+.81,zz+.07],[xx+.19+dx,b+1.38,zz]],[.018,.018,.018,.018,.018],'matte',cord);
  }
  perch('九柱场边的测绳架',xx,b+1.43,zz);
}

const builders=[trench,dock,rootCradle,jadeShelter,potteryYard,bronzeTable,ivoryCanopy,lightScreen,postCourt];

export function createStations(scene,world){
  const palette=makePalette(),states=[];let alive=true;
  const groups=sites.map(([x,z],i)=>{
    const group=new T.Group();group.name=names[i];group.position.set(x,ground(x,z),z);group.visible=false;scene.add(group);
    states.push({assets:null,known:false,fade:0,solid:false});return group;
  });
  function build(i){
    const state=states[i];if(state.assets)return;
    const kit=makeKit(groups[i],palette,world,i,()=>alive);builders[i](kit);state.assets=kit.finish();
  }
  let last=0;
  function update(time,count,player){
    const step=Math.max(.012,Math.min(.17,time-last));last=time;
    for(let i=0;i<groups.length;i++){
      const group=groups[i],state=states[i],distance=Math.hypot(player.x-group.position.x,player.z-group.position.z);
      if(i>count){
        group.visible=false;
        if(state.solid){state.assets.deactivate();state.solid=false;}
        state.known=false;state.fade=0;continue;
      }
      if(distance<19.3&&!state.known){build(i);state.known=true;if(i===0||i<count)state.fade=1;}
      if(!state.known)continue;
      group.visible=distance<34;
      if(!group.visible)continue;
      state.fade=Math.min(1,state.fade+step*1.22);
      const far=1-T.MathUtils.smoothstep(distance,26,34),opacity=state.fade*far;
      for(const material of state.assets.materials){
        const blend=opacity<.998;
        if(material.transparent!==blend){material.transparent=blend;material.needsUpdate=true;}
        material.opacity=blend?opacity:1;
      }
      if(!state.solid){state.assets.activate();state.solid=true;}
    }
  }
  // Build only the next earned setting while its predecessor's paper receipt
  // is open. Visibility, fade, perches and collisions still depend on proximity.
  function prepare(i){
    if(!alive||!states[i])return null;
    build(i);
    return groups[i];
  }
  return {groups,update,prepare,ready:palette.ready,dispose(){
    alive=false;
    for(const state of states)if(state.solid){state.assets.deactivate();state.solid=false;}
    for(const m of Object.values(palette))m.dispose();
  }};
}
