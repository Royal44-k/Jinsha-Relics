import {fieldTime} from '../v13/review-clock.js';
import * as T from 'three';
import {measuringLine} from './fieldwork-measuring-line.js';
import {disposeGraph,mat,rod,V} from './fieldwork-studio.js';

// A moving transit gives a current record; nothing is lifted out of the channel.
export function driftTransit(ctx,studio,backToRaft) {
  const origin=V(0,.15,0),wood=new T.Group(),marker=new T.Group(),scene=new T.Scene();
  scene.add(wood,marker);scene.background=new T.Color(0x5b766a);
  const sun=new T.DirectionalLight(0xffe2ab,2.05);sun.position.set(-4,5,-4);scene.add(sun,new T.HemisphereLight(0xc7dfde,0x69533b,1.7));
  const eye=new T.OrthographicCamera(-2,2,1.7,-1.7,.05,40);eye.position.set(1.3,4.7,5.4);eye.lookAt(0,.04,0);eye.updateMatrixWorld();
  const dark=mat(0x9b886a,.87,{map:studio.texture('/assets/environment/bark_brown_02_diff_1k.webp'),normalMap:studio.texture('/assets/environment/bark_brown_02_nor_gl_1k.webp','normal')});
  const drift=new T.CylinderGeometry(.072,.112,1.09,19,7),p=drift.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z);
    const ridge=1+.10*Math.sin(a*7+y*3)+.07*Math.cos(a*5-y*5);
    p.setXYZ(i,y+.023*Math.cos(a*5),x*ridge+.060*Math.sin(y*3.8),z*ridge+.08*Math.cos(y*4.4+.6));
  }
  drift.computeVertexNormals();wood.add(new T.Mesh(drift,dark));
  rod(wood,V(-.07,.003,.025),V(-.31,.14,-.17),.06,dark,.016,10);
  rod(wood,V(.26,-.02,.045),V(.18,.065,.22),.037,dark,.009,8);
  const wire=new T.MeshBasicMaterial({color:0xf7d692,transparent:true,opacity:.92,depthWrite:false});
  const gauge=new T.Mesh(new T.RingGeometry(.45,.475,56),wire);gauge.rotation.x=-Math.PI/2;marker.add(gauge);marker.position.copy(origin).y=.029;
  const wake=new T.Mesh(new T.RingGeometry(.29,.298,44),new T.MeshBasicMaterial({color:0xffe7b8,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}));wake.rotation.x=-Math.PI/2;scene.add(wake);
  const shadow=new T.Mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial({color:0x212f24,transparent:true,opacity:.23,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);shadow.scale.set(.53,.13,1);
  let backdrop=null,viewAspect=0,lastFinishedRevision=-1,preparation=0;
  function prepare(){
    if(backdrop)return;
    backdrop=studio.texture('/assets/v10/fieldwork-eddy-pocket.webp');
    const renderer=studio.renderer;
    if(studio.software||!window.requestIdleCallback||!renderer.extensions.has('KHR_parallel_shader_compile'))return;
    // Submit the next camera's material programs while the raft is still upstream.
    // The first visible drift frame will use the same renderer, scene and lights.
    const materials=[backdrop,dark.map,dark.normalMap];
    function prepareTexture(){
      preparation=0;
      if(ctx.closed||active||finished)return;
      const texture=materials.shift();
      if(texture?.image?.complete&&texture.image.naturalWidth)renderer.initTexture(texture);
      if(materials.length)preparation=window.requestIdleCallback(prepareTexture);
    }
    preparation=window.requestIdleCallback(()=>{
      preparation=0;
      if(ctx.closed||active||finished)return;
      renderer.compileAsync(scene,eye).then(()=>{
        if(!ctx.closed&&!active&&!finished)preparation=window.requestIdleCallback(prepareTexture);
      }).catch(()=>{});
    });
  }
  ctx.onClose(()=>{
    if(preparation)window.cancelIdleCallback(preparation);
    scene.background=null;disposeGraph(scene);
  });
  const tag=document.createElement('button');tag.type='button';tag.className='fw-transit-pin';tag.textContent='测';tag.setAttribute('aria-label','记录经过测线的木段');ctx.overlay.append(tag);
  let active=false,finished=false,elapsed=0,misses=0,gap=0,armed=false,lastPass=-Infinity;
  const stamp=ctx.button('木段过线时记时',record);
  const anchor=ctx.button('架设测线触铃',()=>{armed=true;anchor.hidden=true;ctx.tip('触铃已架在金环上。保持观测，木段经过时会触响并留下读数。');});
  anchor.hidden=true;
  const head=ctx.read.querySelector('strong'),sub=ctx.read.querySelector('span');
  function shown(value){wood.visible=marker.visible=value;tag.hidden=stamp.hidden=!value;}
  let tying=false,previousControls=[],firstDirection=0,measured=false;
  const line=measuringLine(ctx,scene,eye,studio.canvas,startWatch);
  const assist=ctx.button('辅助架设测绳',()=>line.hook());
  const back=ctx.button('返回南岸泊位',leave);
  const remeasure=ctx.button('重新布设测线',()=>begin(true));
  const finish=ctx.button('收好岸线图',()=>ctx.finish());
  for(const b of [assist,back,remeasure,finish])b.hidden=true;
  function startWatch(){
    tying=false;active=true;finished=false;elapsed=0;gap=-1.45;lastPass=-Infinity;armed=false;
    wire.color.setHex(0xf7d692);head.textContent='记录两个通过方向';sub.textContent='第一次过线　／　等待漂木';
    ctx.step?.(4,4,'测两次漂木过线');ctx.tip('观察漂木第一次经过测绳，再等它反向经过。经过金环时轻点「测」或按 E 记时。可架触铃辅助记录。');
    ctx.section.dataset.fieldPhase='transit';shown(true);assist.hidden=true;anchor.hidden=false;remeasure.hidden=false;finish.hidden=true;
  }
  function begin(reset){
    active=true;finished=false;back.hidden=false;finish.hidden=true;
    if(measured&&!reset){showResult();return;}
    if(reset){measured=false;firstDirection=0;}
    if(reset||!line.locked){tying=true;ctx.section.dataset.fieldPhase='gauge';line.show(true);shown(false);wood.visible=true;
      ctx.step?.(3,4,'把测绳系到对岸');head.textContent='架设横断测线';sub.textContent='抓住绳头　→　对岸系桩';
      ctx.tip('按住水面左侧绳头，向右拖到「对岸系桩」后松手。两桩之间的测绳将作为漂木经过的同一位置。');
      assist.hidden=false;anchor.hidden=remeasure.hidden=true;
    }else startWatch();
  }
  function leave(){
    active=finished=tying=false;armed=false;shown(false);line.hide();
    for(const b of [assist,back,remeasure,finish,anchor])b.hidden=true;
    for(const b of previousControls)b.hidden=false;
    ctx.section.dataset.fieldPhase='river';backToRaft();
  }
  function record(){
    if(!active||finished||tying)return;
    if(Math.abs(gap)>.59&&fieldTime()-lastPass>350){misses++;anchor.hidden=armed;ctx.tip('木段还在测线外。等漂木进入金环再记录，也可以亲手架设触铃，让木段过线时撞铃记时。');ctx.cue('water');return;}
    const direction=Math.sign(Math.cos(elapsed*1.15-Math.PI/2))||1;
    if(!firstDirection){firstDirection=direction;ctx.cue('mark');ctx.tip('已记下第一次过线。保持绳位，等待木段回转后从相反方向通过。');return;}
    if(direction===firstDirection){ctx.tip('这一趟的方向已经记录。观察木段转向，在回程经过金环时再记一次。');return;}
    measured=true;ctx.cue('mark');showResult();
  }
  function showResult(){
    active=false;finished=true;tying=false;wood.visible=marker.visible=true;ctx.step?.(4,4,'读出回水方向');
    tag.hidden=stamp.hidden=anchor.hidden=assist.hidden=true;remeasure.hidden=false;wire.color.setHex(0xeac774);wire.opacity=1;
    head.textContent='实测岸线已合拢';sub.textContent='两处靠泊 · 一条漂移观察 · 两次反向通过';
    ctx.tip('同一段木材可以被水搬运。把这一点记在图上，沿南岸寻找仍与原地泥土相连的根盘。');
    finish.hidden=false;finish.focus({preventScroll:true});
  }
  ctx.on(tag,'click',record);
  ctx.on(ctx.section,'keydown',e=>{if(active&&!e.repeat&&e.code==='KeyE'){e.preventDefault();e.stopPropagation();record();}});
  const location=V();
  shown(false);
  return {
    prepare,
    get active(){return active;},get finished(){return finished;},
    enter(){
      previousControls=[...ctx.tools.querySelectorAll('button')].filter(b=>!b.hidden);
      prepare();
      for(const b of previousControls)b.hidden=true;begin(false);
    },
    update(dt){
      if(!active||tying)return;
      elapsed+=Math.min(.16,dt)/(1+Math.min(2,misses)*.3);
      const t=elapsed*1.15-Math.PI/2;gap=1.55*Math.sin(t);
      wood.position.copy(origin);wood.position.x+=gap*.22;wood.position.z+=gap;wood.position.y+=.021*Math.cos(t*3);
      wood.rotation.set(.09*Math.sin(t),.57+.24*Math.cos(t),-.06*Math.cos(t));
      wake.position.copy(wood.position);wake.position.y=.008;wake.position.z+=.13;const ripple=(elapsed*.75)%1;wake.scale.set(.81+ripple*.66,.48+ripple*.57,1);wake.material.opacity=.38*(1-ripple);
      shadow.position.copy(wood.position);shadow.position.y=.009;shadow.position.x+=.045;shadow.rotation.z=-wood.rotation.y;
      const crossing=Math.abs(gap)<.59;
      if(crossing){lastPass=fieldTime();if(armed){record();return;}}
      gauge.material.opacity=crossing?1:.56;tag.classList.toggle('in-sight',crossing);
      const reading=(firstDirection?'回程　':'首程　')+'木段离测线 '+Math.abs(gap).toFixed(1)+' 米　·　'+(crossing?'经过测线':'观察木段');
      if(sub.textContent!==reading)sub.textContent=reading;
    },
    render(){
      const {clientWidth:w,clientHeight:h}=studio.canvas,aspect=w/Math.max(1,h);
      if(finished&&lastFinishedRevision===studio.revision&&aspect===viewAspect)return;
      if(backdrop?.image){scene.background=backdrop;const imageAspect=backdrop.image.width/backdrop.image.height;
        const rx=Math.min(1,aspect/imageAspect),ry=Math.min(1,imageAspect/aspect);
        backdrop.repeat.set(rx,ry);backdrop.offset.set((1-rx)/2,(1-ry)/2);}
      if(aspect!==viewAspect){viewAspect=aspect;const half=Math.max(1.70,1.34/aspect);eye.top=half;eye.bottom=-half;eye.left=-half*aspect;eye.right=half*aspect;eye.updateProjectionMatrix();}
      if(tying)line.locate();
      if(active&&!tying){location.set(.56,.43,0).project(eye);tag.style.left=((location.x+1)*50)+'%';tag.style.top=((1-location.y)*50)+'%';}
      studio.render(true,scene,eye);
      if(finished)lastFinishedRevision=studio.revision;
    }
  };
}
