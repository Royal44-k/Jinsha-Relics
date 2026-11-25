import * as T from 'three';

const stages = ['warning','surge','opening','riposte','won','lost'];
const tau = Math.PI * 2;
const riverMath = `
uniform float uStage, uSide, uProgress, uTime, uRound, uWidth, uBoat, uHit;
float danger(float x) { return smoothstep(-.16,.33,x*uSide); }
float bow(float x) {
  return mix(2.45,-3.05,uProgress) - .20*x*uSide
    + .15*sin(x*2.4+uRound) + .07*sin(x*5.2-uTime*1.35);
}
float gauss(float x,float width) { return exp(-x*x/(width*width)); }
vec2 eyePoint() { return vec2(clamp(uBoat,-uWidth+.70,uWidth-.70),-.98); }
`;

const vertexShader = riverMath + `
varying vec2 vRiver;
void main() {
  vRiver=vec2(position.x*uWidth,position.z);
  float height=.034;
  if(uStage>.5 && uStage<1.5) {
    float along=vRiver.y-bow(vRiver.x);
    float crest=gauss(along,.21)+.23*gauss(along-.44,.37);
    height+=danger(vRiver.x)*crest*(.26+.035*uRound);
  }
  if(uStage>1.5 && uStage<3.5) {
    float r=length((vRiver-eyePoint())*vec2(1.,1.16));
    float radius=uStage<2.5?mix(.22,.86,smoothstep(0.,.77,uProgress)):mix(.85,2.12,uProgress);
    height+=.082*gauss(r-radius,.12);
  }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(vRiver.x,height,vRiver.y,1.);
}`;

const fragmentShader = riverMath + `
varying vec2 vRiver;
float hash(vec2 p) {
  vec3 p3=fract(p.xyx*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float noise(vec2 p) {
  vec2 b=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(b),hash(b+vec2(1,0)),f.x),mix(hash(b+vec2(0,1)),hash(b+vec2(1,1)),f.x),f.y);
}
void main() {
  vec2 p=vRiver;
  float edge=(1.-smoothstep(uWidth-.28,uWidth,abs(p.x)))*(1.-smoothstep(2.95,3.39,abs(p.y)));
  if(edge<.008) discard;
  float grain=noise(p*vec2(8.2,12.3)+vec2(0.,uTime*.86));
  float grit=noise(p*vec2(13.,21.)+vec2(uTime*.37,0.));
  vec3 sand=vec3(.51,.30,.12), silt=vec3(.094,.105,.052);
  vec3 foam=vec3(.83,.85,.63), jade=vec3(.11,.48,.42);
  float alpha=0.;vec3 color=foam;
  if(uStage<.5) {
    // Amber shoal water rims the approaching half. Three foam streaks bend
    // towards the raft, leaving the opposite half completely legible.
    float width=uWidth-.46;
    float lane=uSide*p.x;
    float rear=1.-smoothstep(.5,2.6,abs(p.y-.05));
    float roots=fract(p.y*.55+uTime*.32+uRound*.17);
    float stream=lane-(width*.42+.32*sin(roots*2.8+.5)+.1*p.y);
    float strokes=gauss(stream,.052)+.65*gauss(stream-.33,.039)+.42*gauss(stream+.27,.033);
    strokes*=smoothstep(0.,.16,roots)*(1.-smoothstep(.65,.96,roots));
    float lip=gauss(lane-.12-.10*sin(p.y*1.7+uTime),.038);
    float incoming=danger(p.x)*rear*(.19+.10*uProgress);
    alpha=incoming+rear*(strokes*.72+lip*.36)*(.65+.35*grain);
    color=mix(sand,foam,smoothstep(.12,.52,strokes+.4*lip));
  } else if(uStage<1.5) {
    float along=p.y-bow(p.x)+.052*(grain-.5);
    float shelf=gauss(along-.29,.56)*danger(p.x);
    float ridge=gauss(along,.071)*(.57+.43*grit);
    float broken=gauss(along-.19-.055*sin(p.x*6.+uTime),.08)*smoothstep(.30,.69,grain);
    float tails=gauss(along-.55,.37)*pow(max(0.,sin(p.x*17.+grain*4.+along*7.)),5.);
    float froth=danger(p.x)*(ridge+.63*broken+.38*tails);
    alpha=.66*shelf+froth*.88;color=mix(silt,foam,clamp(froth*1.65,0.,1.));
  } else {
    vec2 delta=(p-eyePoint())*vec2(1.,1.16);
    float r=length(delta),ang=atan(delta.y,delta.x);
    float spiral=.5+.5*cos(ang*3.-r*9.-uTime*2.8);
    float motes=smoothstep(.4,.77,grain);
    if(uStage<2.5) {
      float radius=mix(.22,.86,smoothstep(0.,.77,uProgress));
      float lip=gauss(r-radius-.035*sin(ang*4.+uTime*1.4),.065);
      float braid=pow(spiral,5.)*smoothstep(.12,.30,r)*(1.-smoothstep(radius,radius+.19,r));
      float pool=(1.-smoothstep(radius*.48,radius+.16,r))*.54;
      alpha=pool+lip*.85+braid*.43;
      color=mix(vec3(.035,.16,.15),jade,braid+.25);color=mix(color,foam,lip*(.68+.32*motes));
    } else if(uStage<3.5) {
      float radius=mix(.85,2.12,uProgress);
      float arc=.5+.5*cos(ang*7.+uRound+grain*1.4);
      float foamRing=gauss(r-radius,.063+.10*uProgress)*(.48+.52*arc);
      float trails=gauss(r-radius+.25,.22)*pow(spiral,3.)*(.32+.68*motes);
      alpha=(foamRing+trails*.71)*(1.-smoothstep(.58,1.,uProgress));
      color=mix(jade,vec3(.94,.92,.67),foamRing);
    } else if(uStage<4.5) {
      float rad=.58+1.4*uProgress;
      float echoes=gauss(r-rad,.040)+.59*gauss(r-rad+.26,.030)+.28*gauss(r-rad+.51,.023);
      alpha=echoes*(1.-smoothstep(.49,1.,uProgress))*(.40+.58*grain);
      color=mix(jade,foam,.69);
    } else {
      vec2 wake=(p-vec2(uBoat,0.))*vec2(.90,1.16);
      float wakeR=length(wake),ripples=gauss(wakeR-(.27+uProgress*1.6),.11);
      float cloud=gauss(wakeR,.85+uProgress*.39)*(.25+.36*grain);
      alpha=(cloud+.48*ripples)*(1.-smoothstep(.53,1.,uProgress));
      color=mix(silt,sand,ripples*.58);
    }
  }
  if(uHit>.01) {
    float r=length((p-vec2(uBoat,0.))*vec2(.9,1.15));
    float pulse=gauss(r-(.30+(1.-uHit)*.91),.065)*uHit;
    color=mix(color,foam,pulse);alpha+=pulse*.89;
  }
  alpha=clamp(alpha*edge,0.,.92);if(alpha<.012) discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function spray(scene) {
  const count=42,geometry=new T.IcosahedronGeometry(1,0);
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.56,metalness:0});
  const drops=new T.InstancedMesh(geometry,material,count),dummy=new T.Object3D();
  drops.name='河心 · 浪花';drops.frustumCulled=false;
  drops.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const seeds=Array.from({length:count},(_,i)=>{
    drops.setColorAt(i,new T.Color(i%4===0?0xaeae7d:0xe3e5c4));
    return {angle:i*2.39996,spread:((i*37)%101)/101,delay:((i*67)%103)/103};
  });
  scene.add(drops);
  return function updateDrops(stage,data,side,boat) {
    const {progress,time,halfWidth,round}=data;
    drops.visible=stage===1||stage===3||data.hit>.01;
    if(!drops.visible)return;
    let visible=0;
    for(let i=0;i<count;i++){
      const seed=seeds[i];
      let x,y,z,size,stretch;
      const contact=data.hit>.01 && i<12;
      if(stage===1 && !contact){
        const angle=seed.angle,life=(time*1.4+seed.delay)%1;
        x=side*(.11+seed.spread*(halfWidth-.35));
        const crest=2.45-5.50*progress-.20*x*side+.15*Math.sin(x*2.4+round)+.07*Math.sin(x*5.2-time*1.35);
        z=crest+.27*life+.04*Math.cos(angle);
        y=.13+.27*Math.sin(Math.PI*life);size=.011+.017*seed.spread;stretch=1.1;
      } else {
        const life=contact?(1-data.hit)-seed.delay*.18:progress*1.20-seed.delay*.26;
        if(life<=0||life>=1)continue;
        const radius=(contact?.20:.44)+life*(.60+seed.spread*1.18);
        const cx=contact?boat:T.MathUtils.clamp(boat,-halfWidth+.7,halfWidth-.7);
        x=cx+Math.cos(seed.angle)*radius;
        z=(contact?0:-.98)+Math.sin(seed.angle)*radius*.78;
        y=.09+4*life*(1-life)*(.19+.34*seed.spread);
        size=(.011+.023*seed.spread)*(1-life*.60);stretch=1.85;
      }
      dummy.position.set(x,y,z);dummy.rotation.set(0,seed.angle,.18*Math.sin(seed.angle));
      dummy.scale.set(size,size*stretch,size);dummy.updateMatrix();
      drops.setMatrixAt(visible++,dummy.matrix);
    }
    drops.count=visible;drops.instanceMatrix.needsUpdate=true;
  };
}

export function makeEddyArt(scene) {
  const group=new T.Group();group.name='河心试胆 · 浊流与旋眼';group.visible=false;scene.add(group);
  const uniforms={};
  for(const key of ['Stage','Side','Progress','Time','Round','Width','Boat','Hit'])uniforms['u'+key]={value:0};
  const geom=new T.PlaneGeometry(2,6.8,54,42);geom.rotateX(-Math.PI/2);
  const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
  const river=new T.Mesh(geom,material);river.frustumCulled=false;river.renderOrder=2;group.add(river);
  const updateDrops=spray(group);
  return {
    update(data) {
      const stage=stages.indexOf(data.phase);
      if(stage<0){group.visible=false;return;}
      const side=data.side<0?-1:1,boat=data.boatX-data.riverX;
      group.visible=true;group.position.set(data.riverX,0,-data.s);
      uniforms.uStage.value=stage;uniforms.uSide.value=side;
      uniforms.uProgress.value=T.MathUtils.clamp(data.progress,0,1);
      uniforms.uTime.value=data.time;uniforms.uRound.value=data.round;
      uniforms.uWidth.value=data.halfWidth;uniforms.uBoat.value=boat;
      uniforms.uHit.value=data.hit||0;
      updateDrops(stage,data,side,boat);
    },
    hide(){group.visible=false;}
  };
}
