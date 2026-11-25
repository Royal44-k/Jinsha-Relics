import {Vector3} from 'three';

// All integration happens at a fixed cadence. Position is the contact point of
// the feet, in world space; the renderer must not add a second jump offset.
const STEP = 1 / 90;
const RADIUS = .27;
const SURFACE_OFFSET = .42;
const DASH_TIME = .24;
const DASH_RECOVERY = 1.1;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const finite = (v,fallback=0) => Number.isFinite(v) ? v : fallback;
const waterMode = mode => mode==='swimming' || mode==='diving';

export function createLocomotion({world,position=new Vector3(),onEvent=()=>{}}) {
  if (!world?.sample || !world?.resolveMotion) throw new TypeError('Locomotion needs a sampled, collidable world.');
  const velocity=new Vector3();
  const state={mode:'grounded',speed:0,verticalSpeed:0,bank:0,pitch:0,wingbeat:0,stamina:1,oxygen:1,wetness:0,grounded:true,perchId:null,perchYaw:null,perchSlopeX:0,perchSlopeZ:0,boundaryMessage:'',zoneId:null,zoneName:'',gait:'idle',cruise:false,dashing:false,dashProgress:0,dashCooldown:0,dashX:0,dashZ:0,perchApproach:null};
  const safePosition=position.clone(),previousPosition=position.clone(),desired=new Vector3(),candidate=new Vector3(),before=new Vector3();
  const eventTimes=new Map();
  let safePerchId=null,accumulator=0,clock=0,airTime=0,launchGrace=0,outsideTime=0;
  let flightArmed=false,fatigued=false,landingRequested=false,forcedSurface=false;
  let diveLatched=false,oxygenLock=false,lastYaw=0;
  let surfaceRiseIntent=false,surfaceRiseHeld=0;
  let lastGround=-Infinity,cruiseAltitude=0,dashRemaining=0,dashSpeed=0,approachTime=0,approachBlocked=0;
  let perchHeldAscend=false,perchHeldDescend=false;
  const growth={airEfficiency:1,dashRecovery:1};
  let groundSpeed=1;
  function setGrowth(value){
    growth.airEfficiency=clamp(finite(value?.airEfficiency,1),value?.collection ? .64 : .8,1);
    growth.dashRecovery=clamp(finite(value?.dashRecovery,1),value?.collection ? .64 : .76,1);
    groundSpeed=clamp(finite(value?.groundSpeed,1),.85,1.3);
  }
  const lastInput={moveX:0,moveZ:0,yaw:0,ascend:false,descend:false},approachInput={x:0,z:0,ascend:false,descend:false};

  function emit(type,text,detail={},cooldown=0) {
    if(clock-(eventTimes.get(type)??-Infinity)<cooldown) return;
    eventTimes.set(type,clock);
    onEvent({type,text,...detail});
  }
  function sample(p) {
    const s=world.sample(p);
    return {...s,waterLevel:Number.isFinite(s.waterLevel)?s.waterLevel:null,waterDepth:Math.max(0,finite(s.waterDepth)),ceil:finite(s.ceil,16),groundHeight:finite(s.groundHeight,-80)};
  }
  // Keep a wet controller wet across small shoreline depth changes. Water
  // depth comes from the riverbed, never from an overhead support surface.
  function isDeep(s,retained=waterMode(state.mode)) {return s.waterLevel!==null && s.waterDepth>(retained?.45:.72);}
  function setMode(mode) {
    state.mode=mode;
    state.grounded=mode==='grounded' || mode==='perched';
    if(mode!=='perched') {state.perchId=null;state.perchYaw=null;state.perchSlopeX=state.perchSlopeZ=0;}
  }
  function initialize(p) {
    if(p && p!==position) position.copy(p);
    position.set(finite(position.x),finite(position.y),finite(position.z));
    const s=sample(position);
    const perch=world.perches?.find(p=>p.position.distanceTo(position)<.08);
    if(perch) {setMode('perched');state.perchId=perch.id;state.perchYaw=Number.isFinite(perch.yaw)?perch.yaw:null;state.perchSlopeX=finite(perch.slope?.x);state.perchSlopeZ=finite(perch.slope?.z);}
    else if(isDeep(s,true) && position.y<=s.waterLevel-SURFACE_OFFSET+.12) setMode(position.y<s.waterLevel-.75&&s.waterDepth>=1.45?'diving':'swimming');
    else if(position.y<=s.groundHeight+.08) {position.y=s.groundHeight;setMode('grounded');}
    else setMode('falling');
    state.zoneId=s.zoneId??null;state.zoneName=s.zoneName??'';
    safePosition.copy(position);safePerchId=state.perchId;
    if(!state.grounded) {
      safePosition.y=isDeep(s)?s.waterLevel-SURFACE_OFFSET:Math.max(s.groundHeight,-12);
      safePerchId=null;
    }
    state.boundaryMessage='';
    lastGround=state.mode==='grounded'?clock:-Infinity;
    perchHeldAscend=perchHeldDescend=false;
    previousPosition.copy(position);
  }
  function stop() {
    velocity.set(0,0,0);accumulator=0;
    state.speed=state.verticalSpeed=state.bank=state.pitch=state.wingbeat=0;
    state.cruise=false;state.dashing=false;state.dashProgress=0;dashRemaining=0;state.perchApproach=null;
    state.gait=state.mode==='perched'?'perch':'idle';
    surfaceRiseIntent=false;surfaceRiseHeld=0;
    previousPosition.copy(position);lastInput.moveX=lastInput.moveZ=0;lastInput.ascend=lastInput.descend=false;
  }
  function reset(p=position) {
    stop();flightArmed=false;fatigued=false;landingRequested=false;
    forcedSurface=false;oxygenLock=false;diveLatched=false;airTime=launchGrace=outsideTime=0;
    state.stamina=state.oxygen=1;state.wetness=0;
    state.dashCooldown=0;
    initialize(p);
  }
  function jump() {
    state.perchApproach=null;
    // In sustained flight the held input steers the altitude target. Repeated
    // key edges must not reapply the ground/manual-flight launch impulse.
    if(state.cruise)return true;
    if(waterMode(state.mode) && (state.mode==='diving' || forcedSurface)) {
      diveLatched=false;forcedSurface=true;surfaceRiseIntent=true;surfaceRiseHeld=0;return true;
    }
    surfaceRiseIntent=false;surfaceRiseHeld=0;
    if(state.grounded || state.mode==='swimming' || !flightArmed && clock-lastGround<=.1) {
      const perched=state.mode==='perched';
      velocity.y=perched?4.3:4.1;
      lastGround=-Infinity;
      flightArmed=perched;landingRequested=false;airTime=0;launchGrace=.28;
      setMode(perched?'flying':'rising');
      if(perched) emit('takeoff','离枝展翼，顺风起飞。');
      else emit('jump','轻跃后按住空格展翼；再次按下可立即起飞。',{},1);
      return true;
    }
    if(state.stamina>.08 && !fatigued) {
      if(!flightArmed) emit('takeoff','羽翼托起身体，按住空格爬升，松开滑翔。',{},1);
      flightArmed=true;landingRequested=false;velocity.y=Math.max(velocity.y,3.3);setMode('flying');return true;
    }
    return false;
  }
  function land() {
    state.cruise=false;state.perchApproach=null;
    if(state.mode==='perched') {setMode('falling');velocity.y=-.5;}
    if(waterMode(state.mode)) {diveLatched=false;forcedSurface=true;return true;}
    landingRequested=true;flightArmed=true;return true;
  }
  function dive() {
    state.cruise=false;state.perchApproach=null;
    const s=sample(position);
    if(waterMode(state.mode)&&s.waterDepth<1.45){
      emit('shallow-water','这里是浅滩，收翼浮游即可。循着更深的青绿色水光，才能潜入深潭。',{},5);
      return false;
    }
    if(waterMode(state.mode) && isDeep(s) && !oxygenLock && !forcedSurface) {
      if(state.mode!=='diving') emit('dive','潜入水下：空格上浮，Ctrl / C 下潜；留意呼吸。',{},2);
      setMode('diving');diveLatched=true;velocity.y=Math.min(velocity.y,-1.3);return true;
    }
    if(!state.grounded) {landingRequested=true;return true;}
    return false;
  }
  function getPerchCandidate() {
    let nearest=null,best=Infinity;
    for(const p of world.perches??[]){const d=p.position.distanceToSquared(position);if(d<best){best=d;nearest=p;}}
    if(!nearest)return null;
    const distance=Math.sqrt(best),horizontal=Math.hypot(nearest.position.x-position.x,nearest.position.z-position.z),height=nearest.position.y-position.y;
    const underwater=waterMode(state.mode),tooFast=state.speed>7.8||Math.abs(velocity.y)>6.2;
    const inReach=distance<=2.85&&horizontal<=2.7&&Math.abs(height)<=1.7;
    const reason=underwater?'先浮出水面，再展翼靠近枝头。':Math.abs(height)>1.7?(height>0?'再升高一些，与枝环接近。':'再降低一些，与枝环接近。'):!inReach?'向金色枝环靠近。':tooFast?'稍缓一缓，让双足对准枝头。':'';
    return {id:nearest.id,label:nearest.label??'树枝',position:nearest.position.toArray(),distance,horizontal,height,speed:state.speed,canRequest:inReach&&!underwater&&!tooFast&&!state.dashing,canPerch:distance<=Math.max(.85,nearest.radius??1)+.45&&state.speed<4.2&&Math.abs(velocity.y)<4.8&&!underwater,reason:state.dashing?'闪身结束后，再收翼停栖。':reason};
  }
  function finishPerch(nearest) {
    // The command consumes controls already held during the approach. A fresh
    // press may leave the branch, but an old held key must not undo touchdown.
    perchHeldAscend=lastInput.ascend;perchHeldDescend=lastInput.descend;
    position.copy(nearest.position);stop();setMode('perched');state.perchId=nearest.id;state.perchYaw=Number.isFinite(nearest.yaw)?nearest.yaw:null;state.perchSlopeX=finite(nearest.slope?.x);state.perchSlopeZ=finite(nearest.slope?.z);state.gait='perch';
    safePosition.copy(position);safePerchId=nearest.id;flightArmed=false;landingRequested=false;
    emit('perch',`栖于${nearest.label??'树枝'}，羽翼正在恢复。`,{perchId:nearest.id},1);
  }
  function requestPerch(input=lastInput) {
    if(state.mode==='perched')return jump();
    if(state.perchApproach){state.perchApproach=null;emit('perch-cancel','收回停栖，继续飞行。');return true;}
    const offer=getPerchCandidate();
    if(!offer?.canRequest){if(offer)emit('perch-hint',offer.reason,{perchId:offer.id},1);return false;}
    state.perchApproach=offer.id;state.cruise=false;flightArmed=true;landingRequested=false;setMode('flying');
    // Commands can arrive between animation frames. Capture the controls at
    // the event, rather than mistaking a pre-command key for later takeover.
    approachTime=approachBlocked=0;approachInput.x=clamp(finite(input.moveX),-1,1);approachInput.z=clamp(finite(input.moveZ),-1,1);approachInput.ascend=!!input.ascend;approachInput.descend=!!input.descend;
    emit('perch-approach','收翼靠枝；改变方向或按空格可随时接管。',{perchId:offer.id});return true;
  }
  function toggleCruise() {
    if(state.cruise){state.cruise=false;emit('cruise-end','收住振翼，转入滑翔。');return false;}
    if(waterMode(state.mode)||fatigued||state.stamina<.12){emit('cruise-hint',waterMode(state.mode)?'先浮出水面，再长按空格离水起飞。':'羽翼需要歇息，落地或栖枝后再起飞。',{},2);return false;}
    const fromGround=state.grounded;
    if(fromGround)jump();
    state.perchApproach=null;state.cruise=true;flightArmed=true;landingRequested=false;
    cruiseAltitude=fromGround?position.y+2.4:position.y;setMode('flying');
    emit('cruise-start','持续振翼：空格升高，C降低；再次切换可滑翔。');return true;
  }
  function dash(input=lastInput) {
    if(state.dashCooldown>0||state.stamina<.11||forcedSurface||state.perchApproach)return false;
    if(state.mode==='perched')jump();
    const mx=finite(input.moveX),mz=finite(input.moveZ),yaw=finite(input.yaw,lastYaw),mag=Math.hypot(mx,mz);
    const x=mag>.05?mx/mag:0,z=mag>.05?mz/mag:1;
    state.dashX=Math.cos(yaw)*x-Math.sin(yaw)*z;state.dashZ=-Math.sin(yaw)*x-Math.cos(yaw)*z;
    dashSpeed=waterMode(state.mode)?5.4:state.grounded?9.6:11.2;
    dashRemaining=DASH_TIME;state.dashing=true;state.dashProgress=0;state.dashCooldown=DASH_RECOVERY*growth.dashRecovery;state.stamina-=.1;
    emit('dash',waterMode(state.mode)?'收翼掠水，向前轻冲。':state.grounded?'贴地闪身，轻巧错开。':'借风闪身，继续前行。',{surface:waterMode(state.mode)?'water':state.grounded?'ground':'air'});return true;
  }
  function interact({perchOnly=false,input=lastInput}={}) {
    if(state.mode==='perched') return jump();
    if(perchOnly)return requestPerch(input);
    const offer=getPerchCandidate(),nearest=offer?.canPerch?(world.perches??[]).find(p=>p.id===offer.id):null;
    if(nearest) {finishPerch(nearest);return true;}
    if(state.mode==='swimming') return dive();
    if(state.mode==='diving') {diveLatched=false;forcedSurface=true;return true;}
    return false;
  }
  function recover() {
    const heldAscend=lastInput.ascend,heldDescend=lastInput.descend;
    position.copy(safePosition);stop();outsideTime=0;flightArmed=false;landingRequested=false;
    forcedSurface=false;oxygenLock=false;diveLatched=false;state.oxygen=1;state.stamina=Math.max(state.stamina,.45);
    if(safePerchId) {setMode('perched');state.perchId=safePerchId;perchHeldAscend=heldAscend;perchHeldDescend=heldDescend;const perch=world.perches?.find(p=>p.id===safePerchId);state.perchYaw=Number.isFinite(perch?.yaw)?perch.yaw:null;state.perchSlopeX=finite(perch?.slope?.x);state.perchSlopeZ=finite(perch?.slope?.z);}
    else {const s=sample(position);setMode(isDeep(s)&&s.groundHeight<s.waterLevel?'swimming':'grounded');}
    emit('recovery','林间气流将你轻轻送回上一处落脚点。',{},5);
  }
  function updateResources(dt,s,input) {
    const submerged=waterMode(state.mode) && position.y<s.waterLevel-.7;
    if(submerged) {
      state.oxygen=Math.max(0,state.oxygen-dt*.052);
      if(state.oxygen<=.05 && !forcedSurface) {
        forcedSurface=true;oxygenLock=true;diveLatched=false;
        emit('oxygen','气息渐短，正缓缓上浮。抵达水面即可恢复呼吸。',{},8);
      }
    } else state.oxygen=Math.min(1,state.oxygen+dt*.32);
    if(oxygenLock && !input.descend && state.oxygen>.35) oxygenLock=false;
    if(state.grounded || waterMode(state.mode)) {
      state.stamina=Math.min(1,state.stamina+dt*(state.mode==='perched'?.22:waterMode(state.mode)?.08:.15));
      if(state.stamina>.3) fatigued=false;
    }
    state.wetness=clamp(state.wetness+(waterMode(state.mode)?dt*2:-dt*.045),0,1);
  }
  function step(dt,input) {
    clock+=dt;launchGrace=Math.max(0,launchGrace-dt);
    if(!input.ascend){surfaceRiseIntent=false;surfaceRiseHeld=0;}
    state.dashCooldown=Math.max(0,state.dashCooldown-dt);
    if(state.mode==='grounded')lastGround=clock;
    const s=sample(position);
    if(!Number.isFinite(position.x+position.y+position.z) || position.y<Math.min(-24,safePosition.y-18)) {recover();return;}
    if(s.zoneId!==state.zoneId) {state.zoneId=s.zoneId;state.zoneName=s.zoneName??'';emit('zone',s.zoneName??'',{zoneId:s.zoneId,zoneName:s.zoneName},3);}
    updateResources(dt,s,input);
    if(state.mode==='perched') {
      const p=world.perches?.find(p=>p.id===state.perchId);
      if(p) position.copy(p.position);else setMode('falling');
      if(!input.ascend)perchHeldAscend=false;if(!input.descend)perchHeldDescend=false;
      if(input.ascend&&!perchHeldAscend) jump();
      else if(input.descend&&!perchHeldDescend) land();
      else {state.gait='perch';state.speed=state.verticalSpeed=state.wingbeat=0;state.bank*=Math.exp(-dt*7);state.pitch*=Math.exp(-dt*7);return;}
    }
    const grounded=state.mode==='grounded';
    let swimming=waterMode(state.mode);
    const moveX=clamp(finite(input.moveX),-1,1),moveZ=clamp(finite(input.moveZ),-1,1);
    const yaw=finite(input.yaw,lastYaw),magnitude=Math.hypot(moveX,moveZ),divisor=Math.max(1,magnitude);
    const x=moveX/divisor,z=moveZ/divisor;
    // Listening suggests a slower pace; an explicit quick-move command wins.
    const speed=(grounded?(input.sprint?3.9:2.2)*groundSpeed:swimming?(input.sprint?2.7:2.05):(input.sprint?6.5:5.4))*(input.listen&&!input.sprint?.55:1);
    desired.set(Math.cos(yaw)*x-Math.sin(yaw)*z,0,-Math.sin(yaw)*x-Math.cos(yaw)*z).multiplyScalar(speed);
    // Manual gliding coasts; sustained wing flight can brake into a hover.
    if(!grounded && !swimming && magnitude<.01) {
      if(state.cruise)desired.set(0,0,0);
      else desired.set(velocity.x,0,velocity.z).multiplyScalar(.96);
    }
    let approach=state.perchApproach?(world.perches??[]).find(p=>p.id===state.perchApproach):null;
    if(approach){
      const changedDirection=magnitude>.15&&(Math.hypot(approachInput.x,approachInput.z)<.15||Math.hypot(moveX-approachInput.x,moveZ-approachInput.z)>.6);
      if(input.ascend&&!approachInput.ascend||input.descend&&!approachInput.descend||changedDirection){state.perchApproach=null;approach=null;emit('perch-cancel','继续飞行。');}
      else if(magnitude<.1){approachInput.x=approachInput.z=0;}
      if(!input.ascend)approachInput.ascend=false;if(!input.descend)approachInput.descend=false;
    }
    if(approach){
      approachTime+=dt;desired.copy(approach.position).sub(position);desired.y=0;
      const reach=desired.length();if(reach>0)desired.multiplyScalar(Math.min(5.5,reach*6)/reach);
      if(approachTime>2||approachBlocked>.32){state.perchApproach=null;approach=null;emit('perch-blocked','枝前有阻挡，请换个角度靠近。');}
    }
    if(state.dashing){
      state.dashProgress=clamp(1-dashRemaining/DASH_TIME,0,1);
      const burst=dashSpeed*(.42+.58*Math.sin(Math.PI*state.dashProgress));desired.set(state.dashX*burst,0,state.dashZ*burst);
    }
    state.boundaryMessage='';
    if(s.boundary && s.boundary.distance<4) {
      const pressure=clamp((4-s.boundary.distance)/4,0,2.5);
      desired.addScaledVector(s.boundary.inward,pressure*(grounded?4.5:swimming?3.8:7));
      state.boundaryMessage=s.boundary.message??'前方风势渐强，请沿林间回转。';
      emit('boundary',state.boundaryMessage,{distance:s.boundary.distance},6);
      outsideTime=s.boundary.distance<-6?outsideTime+dt:0;
      if(s.boundary.distance<-14 || outsideTime>7) {recover();return;}
    } else outsideTime=0;
    if(!grounded && !swimming && s.wind) desired.addScaledVector(s.wind,.55);
    const response=state.dashing?36:approach?12:grounded?(magnitude>.01?10:13):swimming?3.6:state.cruise&&magnitude<.01?3.2:2.5;
    const blend=1-Math.exp(-response*dt);
    velocity.x+=(desired.x-velocity.x)*blend;velocity.z+=(desired.z-velocity.z)*blend;
    if(grounded) velocity.y=0;
    else if(approach){velocity.y+=(clamp((approach.position.y-position.y)*6,-3.8,3.8)-velocity.y)*(1-Math.exp(-dt*12));setMode('flying');}
    else if(swimming) {
      if(state.mode==='diving'&&s.waterDepth<1.05){diveLatched=false;forcedSurface=true;}
      if(input.descend && !input.ascend && !oxygenLock && !forcedSurface) dive();
      const surface=s.waterLevel-SURFACE_OFFSET;
      if(state.mode==='diving') {
        let targetY=forcedSurface||input.ascend?2.1:input.descend?-1.85:diveLatched?-.25:0;
        if(position.y<s.groundHeight+.5 && targetY<0) targetY=Math.max(0,(s.groundHeight+.25-position.y)*3);
        velocity.y+=(targetY-velocity.y)*(1-Math.exp(-dt*4));
        if(position.y>=surface-.1 && (forcedSurface||input.ascend)) {
          setMode('swimming');diveLatched=false;forcedSurface=false;
          emit('surface','回到水面，呼吸与羽翼正慢慢恢复。',{},2);
        }
      } else velocity.y+=(clamp((surface-position.y)*6,-1.8,1.8)-velocity.y)*(1-Math.exp(-dt*8));
      // A held Space gesture can continue from the deep pool into the air.
      // Briefly settle at the surface so the animation/camera can read the
      // transition. E surfacing and automatic oxygen rescue never arm this.
      if(state.mode==='swimming'&&surfaceRiseIntent&&input.ascend&&!oxygenLock&&position.y>=surface-.12){
        surfaceRiseHeld+=dt;
        if(surfaceRiseHeld>=.3){jump();swimming=false;}
      }else surfaceRiseHeld=0;
    } else {
      airTime+=dt;
      const canPower=(input.ascend||state.cruise) && !landingRequested && !fatigued && state.stamina>.01;
      if(canPower && (flightArmed || airTime>.18)) {
        if(!flightArmed) emit('takeoff','羽翼托起身体，按住空格爬升，松开滑翔。',{},1);
        flightArmed=true;setMode('flying');
        if(state.cruise)cruiseAltitude=clamp(cruiseAltitude+(input.ascend?2.7:input.descend?-2.7:0)*dt,s.groundHeight+.2,s.ceil-1.1);
        const climb=state.cruise?clamp((cruiseAltitude-position.y)*3,-3.45,3.45):Math.min(3.45,(s.ceil-.8-position.y)*2.5);
        velocity.y+=(climb-velocity.y)*(1-Math.exp(-dt*3.5));
        state.stamina=Math.max(0,state.stamina-dt*(state.cruise?(input.sprint?.045:.034):input.sprint?.074:.06)*growth.airEfficiency);
        if(state.stamina<=.01) {fatigued=true;state.cruise=false;emit('fatigue','羽翼渐疲，转入滑翔。落地、栖枝或浮水可以恢复。',{},8);}
      } else if(flightArmed) {
        setMode('gliding');const sink=input.descend||landingRequested?-3.5:-1.35;
        velocity.y+=(sink-velocity.y)*(1-Math.exp(-dt*1.8));
      } else {velocity.y-=9.8*dt;setMode(velocity.y>0?'rising':'falling');}
      // Vertical wind supports the body as well as moving it sideways. A gorge
      // updraft slows the sink but still leaves descent and steering available.
      velocity.y+=clamp(finite(s.wind?.y),-4,4)*dt*.8;
      if(position.y>s.ceil-2) {
        state.boundaryMessage='高处风势过强，顺着气流降低高度。';
        emit('boundary',state.boundaryMessage,{altitude:true},6);
        velocity.y-=Math.max(0,position.y-(s.ceil-1.2))*dt*7;
      }
      if(position.y>s.ceil+3) velocity.y=Math.min(velocity.y,-4);
    }
    before.copy(position);candidate.copy(position).addScaledVector(velocity,dt);
    let next=sample(candidate);
    // A cliff is a wall when the feet cannot clear its top. Gradual terrain and
    // steps up to 28 cm remain walkable; airborne feet clear the same obstacle.
    const rise=next.groundHeight-s.groundHeight;
    if(!swimming && rise>.28 && before.y<next.groundHeight-.06 && candidate.y<next.groundHeight) {
      candidate.x=before.x;candidate.z=before.z;velocity.x=velocity.z=0;next=s;
      emit('obstacle','地势陡起：按住空格展翼越过，或沿缓坡绕行。',{},6);
    }
    const resolved=world.resolveMotion(before,candidate,RADIUS);
    if(resolved?.position) candidate.copy(resolved.position);
    if(resolved?.hit && resolved.normal) {
      const dot=velocity.dot(resolved.normal);
      if(dot<0) velocity.addScaledVector(resolved.normal,-dot);
      if(resolved.reason) emit('obstacle',resolved.reason,{},6);
    }
    if(approach){
      approachBlocked=before.distanceToSquared(candidate)<.000025?approachBlocked+dt:0;
      if(candidate.distanceTo(approach.position)<.13){
        const finalStep=world.resolveMotion(candidate,approach.position,RADIUS);
        if(!finalStep?.hit||finalStep.position?.distanceTo(approach.position)<.03){finishPerch(approach);return;}
      }
    }
    next=sample(candidate);
    const surface=next.waterLevel!==null?next.waterLevel-SURFACE_OFFSET:null;
    if(isDeep(next) && candidate.y<=surface+.08 && launchGrace<=0) {
      if(!swimming) {
        const splashSpeed=Math.abs(velocity.y);velocity.y=Math.max(velocity.y*.15,-.65);
        setMode('swimming');swimming=true;flightArmed=false;landingRequested=false;airTime=0;state.cruise=false;state.perchApproach=null;state.dashing=false;dashRemaining=0;
        emit('splash','落入水中，轻划前行。Ctrl / C 下潜，空格上浮。',{impact:splashSpeed},1.5);
      }
      candidate.y=Math.max(next.groundHeight+.18,candidate.y);
      if(candidate.y<=next.groundHeight+.18 && velocity.y<0) velocity.y=0;
    } else if(swimming && !isDeep(next)) {
      if(candidate.y<=next.groundHeight+.3) {candidate.y=next.groundHeight;velocity.y=0;setMode('grounded');}
      else {setMode('falling');flightArmed=false;}
    } else if(!swimming) {
      if(candidate.y<=next.groundHeight || grounded && next.groundHeight>=candidate.y-.2) {
        const impact=Math.abs(velocity.y);
        candidate.y=next.groundHeight;velocity.y=0;setMode('grounded');
        if(!grounded) emit('land','双足落稳，羽翼收拢。',{impact},.5);
        flightArmed=false;landingRequested=false;airTime=0;
        state.cruise=false;state.perchApproach=null;
      } else if(grounded) {setMode('falling');airTime=0;}
    }
    position.copy(candidate);
    if(state.mode==='grounded' && (!next.boundary || next.boundary.distance>1) && next.groundHeight>-18) {safePosition.copy(position);safePerchId=null;}
    state.speed=Math.hypot(position.x-before.x,position.z-before.z)/dt;
    state.verticalSpeed=velocity.y;
    if(state.dashing){dashRemaining=Math.max(0,dashRemaining-dt);if(dashRemaining<=0){state.dashing=false;state.dashProgress=0;}}
    state.gait=state.dashing?'dash':state.grounded?(state.speed>.15?input.sprint?'quick':'walk':'idle'):swimming?'swim':'air';
    const turn=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));lastYaw=yaw;
    const bankTarget=state.grounded?-.045*x:swimming?-.1*x:clamp(-x*.25+turn*8,-.5,.5);
    const pitchTarget=state.grounded?-.025*state.speed:swimming?clamp(-velocity.y*.11,-.28,.28):clamp(-velocity.y*.1,-.38,.38);
    state.bank+=(bankTarget-state.bank)*(1-Math.exp(-dt*6));state.pitch+=(pitchTarget-state.pitch)*(1-Math.exp(-dt*5));
    const wingTarget=state.mode==='flying'?.72+state.stamina*.28:state.mode==='rising'?.35:0;
    state.wingbeat+=(wingTarget-state.wingbeat)*(1-Math.exp(-dt*9));
  }
  function update(dt,input={}) {
    lastInput.moveX=finite(input.moveX);lastInput.moveZ=finite(input.moveZ);lastInput.yaw=finite(input.yaw,lastYaw);lastInput.ascend=!!input.ascend;lastInput.descend=!!input.descend;
    accumulator+=clamp(finite(dt),0,.25);
    while(accumulator+1e-10>=STEP) {accumulator-=STEP;previousPosition.copy(position);step(STEP,input);}
    return state;
  }
  // This is a visual pose only. Rules, collision and save data use position.
  // A one-physics-step display delay removes 1/2-step alternation at 60 Hz.
  function getRenderPosition(out) {return out.lerpVectors(previousPosition,position,clamp(accumulator/STEP,0,1));}
  function getSnapshot() {
    return {...state,growth:{...growth},position:position.toArray(),velocity:velocity.toArray(),safePosition:safePosition.toArray(),safePerchId};
  }
  initialize(position);
  return {position,velocity,state,update,jump,land,dive,interact,requestPerch,getPerchCandidate,toggleCruise,dash,reset,stop,setGrowth,getRenderPosition,getSnapshot};
}
