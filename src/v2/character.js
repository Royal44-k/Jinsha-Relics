import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const TAU = Math.PI * 2, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const modes = new Set(['grounded', 'rising', 'flying', 'gliding', 'falling', 'swimming', 'diving', 'perched']);
const sideRig=[['L',-1,0],['R',1,.5]];

/** Original Shuoyu: front -Z, sole y≈.005, height 1.26. Physics owns outer group. */
export async function createCharacter({ lod = 0, plumage: applyPlumage } = {}) {
  const gltf = await new GLTFLoader().loadAsync(lod === 1 ? '/assets/shuoyu.lod1.glb' : '/assets/shuoyu.glb');
  const group = gltf.scene; group.name = 'Shuoyu';
  if (applyPlumage) applyPlumage(group);
  const nodes = {}, rest = {}, materials = new Map();
  let foldedWingYaw = 0,primaryTipPositions=null;
  group.traverse(n => {
    if (Number.isFinite(n.userData.foldedWingYaw)) foldedWingYaw = n.userData.foldedWingYaw;
    if(n.userData.primaryTipPositions)primaryTipPositions=n.userData.primaryTipPositions;
    nodes[n.name] = n;
    if (n.isBone) rest[n.name] = { position: n.position.clone(), quaternion: n.quaternion.clone(), scale: n.scale.clone() };
    if (!n.isMesh) return;
    n.castShadow = n.name !== 'Shuoyu_contour'; n.receiveShadow = true; n.frustumCulled = false;
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      for(const texture of [m.map,m.normalMap,m.roughnessMap])if(texture)texture.anisotropy=4;
      if(/feather|down/i.test(m.name))m.envMapIntensity=.85;
      materials.set(m, { color: m.color.clone(), roughness: m.roughness, sheen: m.sheen ?? 0, ior: m.ior ?? 1.5 });
    }
  });
  // Rest/bone membership is fixed after import. Cache entries once instead
  // of allocating 33 key/value pairs on every animation frame.
  const restEntries=Object.entries(rest),materialEntries=[...materials];
  // Growth changes selected plumage, never the whole bird's light output.
  // Capture sparse masks once; vertex colours update only on a level change.
  const growthTracts=[];
  const jade=new THREE.Color('#3c8278'),oldGold=new THREE.Color('#bba05f'),deepJade=new THREE.Color('#376f69');
  let growthLevel=-1,growthPose=0;
  group.traverse(node=>{
    if(!node.isSkinnedMesh||!node.geometry.attributes.color||!/Shuoyu_(plumage|contour|down|gold)/.test(node.name))return;
    const geometry=node.geometry,p=geometry.attributes.position,c=geometry.attributes.color,indices=geometry.attributes.skinIndex,vertices=[];
    for(let i=0;i<p.count;i++){
      const bone=node.skeleton.bones[indices.getX(i)]?.name,x=p.getX(i),y=p.getY(i),z=p.getZ(i);let zone=null,mask=0;
      if(bone==='Crest'){zone='crest';mask=THREE.MathUtils.smoothstep(y,1.045,1.11);}
      else if(bone==='Head'&&y>.987&&z<-.12){zone='crown';const line=.017+(1.04-y)*.15;mask=Math.exp(-(((Math.abs(x)-line)/.012)**2))*THREE.MathUtils.smoothstep(y,.987,1.019)*(1-THREE.MathUtils.smoothstep(y,1.043,1.062));}
      else if(bone==='Tail'){zone='tail';mask=THREE.MathUtils.smoothstep(z,.25,.55);}
      else if(/^Wing[LR]$/.test(bone)&&node.name==='Shuoyu_plumage'&&y<.44&&z<.49){zone='wing';mask=THREE.MathUtils.smoothstep(y,.245,.34)*(1-THREE.MathUtils.smoothstep(y,.40,.44));}
      if(zone&&mask>.003)vertices.push({i,zone,mask,y,z,base:[c.getX(i),c.getY(i),c.getZ(i)]});
    }
    if(vertices.length)growthTracts.push({color:c,vertices});
  });
  function setGrowthAppearance(value){
    const level=THREE.MathUtils.clamp(Math.round(Number.isFinite(value)?value:0),0,2);
    if(level===growthLevel)return;growthLevel=level;
    for(const{color,vertices}of growthTracts){
      for(const v of vertices){
        let tint=jade,amount=0;
        if(v.zone==='crown')amount=level>0?v.mask*(level===1?.76:.85):0;
        if(v.zone==='crest'){amount=level>0?v.mask*(level===1?.78:.93):0;if(level===2&&v.y>1.235)tint=oldGold;}
        if(v.zone==='tail'){amount=v.mask*(level===1?.13:level===2?.74:0);tint=level===2&&v.z>.62?oldGold:deepJade;}
        if(v.zone==='wing'){amount=level>0?v.mask*(level===1?.37:.57):0;tint=oldGold;}
        color.setXYZ(v.i,v.base[0]+(tint.r-v.base[0])*amount,v.base[1]+(tint.g-v.base[1])*amount,v.base[2]+(tint.b-v.base[2])*amount);
      }color.needsUpdate=true;
    }
    group.userData.growth={level,appearance:['ivory-fledgling','jade-crown','sunward-plumes'][level]};
  }
  // Authored UV-aligned roughness breaks uniform highlights. No high-poly bake.
  const plumage = nodes.Shuoyu_plumage?.material;
  if (plumage) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(128, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
      const barb = Math.sin((y + Math.abs(x - 64) * .67) * 2.6), shaft = Math.exp(-Math.pow((x - 64) / 2.2, 2));
      const value = Math.round(248 + barb * 6 - shaft * 20);
      pixels.data.set([value, value, value, 255], (y * 128 + x) * 4);
    }
    ctx.putImageData(pixels, 0, 0);
    plumage.roughnessMap = new THREE.CanvasTexture(canvas); plumage.roughnessMap.name = 'Runtime_feather_barb_roughness';
    plumage.roughness = .78; plumage.metalness = 0; plumage.normalScale.set(.22, .22); plumage.needsUpdate = true;
    materials.get(plumage).roughness = .78;
  }
  // Independent toe-pad deformation closes each grip around a branch and
  // releases the toes during the walking swing, without changing the sole target.
  const skin=nodes.Shuoyu_skin;
  if(skin?.isSkinnedMesh){
    const geo=skin.geometry,positions=geo.attributes.position;
    geo.morphAttributes.position=[];geo.morphAttributes.normal=[];
    for(const side of ['L','R']){
      const grip=positions.clone(),index=skin.skeleton.bones.indexOf(nodes[`Foot${side}`]);
      for(let i=0;i<positions.count;i++){
        if(geo.attributes.skinIndex.getX(i)!==index)continue;
        const z=positions.getZ(i),reach=z<-.04?clamp((-z-.04)/.14,0,1):clamp((z-.01)/.10,0,1);
        const closedZ=z+(z<-.04?1:-1)*reach*reach*.006;
        // All five authored rest boughs have a .29m local radius. Curl both
        // opposing sets of pads around that surface, preserving toe thickness.
        // The old symmetric bend plus positive foot pitch left the front toes
        // hovering while the shorter rear claw penetrated the branch.
        const branchRadius=.29,curve=Math.sqrt(Math.max(.001,branchRadius*branchRadius-closedZ*closedZ))-branchRadius;
        grip.setY(i,positions.getY(i)+curve);grip.setZ(i,closedZ);
      }
      grip.name='Grip'+side;geo.morphAttributes.position.push(grip);
      const closed=geo.clone();closed.setAttribute('position',grip);closed.morphAttributes={};closed.computeVertexNormals();geo.morphAttributes.normal.push(closed.attributes.normal.clone());closed.dispose();
    }
    skin.updateMorphTargets();
  }
  const mixer = new THREE.AnimationMixer(group);
  // Only disjoint base channels run. Exported Walk/Run/Glide remain editable,
  // but do not fight the contact and flight layers through concurrent blending.
  const breathSource = gltf.animations.find(c => c.name === 'IdleBreath');
  if (breathSource) mixer.clipAction(new THREE.AnimationClip('RuntimeBreath', breathSource.duration,
    breathSource.tracks.filter(t => t.name.endsWith('Breast.scale')).map(t => t.clone()))).play();
  const blink = gltf.animations.find(c => c.name === 'Blink'); if (blink) mixer.clipAction(blink).play();
  const weights = Object.fromEntries([...modes].map(name => [name, name === 'grounded' ? 1 : 0]));
  let disposed = false, phase = 0, flapPhase = 0, paddlePhase = 0, motion = 0, listening = 0,stanceRatio=.61,flightTuck=0;
  let dashPose=0,dashActive=false,dashLateral=0,cruisePose=0,approachPose=0;
  const wingbeatState={phase:0,count:0,strength:0,mode:'grounded'};
  let attentionYaw=0, attentionPitch=0, carriedGlow=0, focusPose=0, idleTime=0, dryShake=0, speaking=0, jawLevel=0, gazeYaw=0;
  let previousMode = 'grounded', previousSpeed = 0, previousVertical = 0, elapsed = 0;
  let landTime = 100, landStrength = 0, launchTime = 100, flinchTime=100, wet = 0, bank = 0, pitch = 0, resonance = 0, startle = 0, brake = 0;
  const q = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), footQ = new THREE.Quaternion();
  const euler = new THREE.Euler(), target = new THREE.Vector3(), direction = new THREE.Vector3(), restDirection = new THREE.Vector3();
  const terrainProbe = new THREE.Vector3(),slopeProbe=new THREE.Vector3(),slopeOrigin=new THREE.Vector3();
  const footTerrain={L:{at:-1,pitch:0,roll:0},R:{at:-1,pitch:0,roll:0}};
  const footPlants={L:{active:false,point:new THREE.Vector3(),orientation:new THREE.Quaternion()},R:{active:false,point:new THREE.Vector3(),orientation:new THREE.Quaternion()}},plantProbe=new THREE.Vector3(),bodyProbe=new THREE.Vector3(),previousBody=new THREE.Vector3();
  let bodySeen=false,plantResets=0;
  // Borrowed, reused records. Consumers may read them during this frame; copy
  // position when retaining a footprint. Coordinates are sole-pad world space.
  const footContacts=['L','R'].map(side=>({id:side==='L'?'left':'right',side,position:new THREE.Vector3(),planted:false,phase:0,speed:0,mode:'grounded'}));
  group.updateWorldMatrix(true,true);
  const wingTips=['L','R'].filter(side=>primaryTipPositions?.[side]&&nodes.Shuoyu_plumage).map(side=>{const mesh=nodes.Shuoyu_plumage,restTip=new THREE.Vector3().fromArray(primaryTipPositions[side]),point=new THREE.Vector3(),positions=mesh.geometry.attributes.position;let index=0,nearest=Infinity;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);const distance=point.distanceToSquared(restTip);if(distance<nearest){nearest=distance;index=i;}}return {mesh,index,position:new THREE.Vector3()};});
  const wingTipResults=wingTips.map(tip=>tip.position);
  function getWingTips(){
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld,
    // not Object3D.updateWorldMatrix. Do this before querying skinned vertices
    // so pre-render flight trails do not inherit the previous frame's origin.
    group.updateWorldMatrix(true,false);group.updateMatrixWorld(true);
    for(const tip of wingTips){tip.mesh.getVertexPosition(tip.index,tip.position);tip.mesh.localToWorld(tip.position);}return wingTipResults;
  }
  function getFootContacts(){
    // localToWorld below refreshes each foot's ancestor chain. Updating every
    // sibling mesh and wing here repeated the same full skeleton traversal.
    for(const contact of footContacts){const foot=nodes[`Foot${contact.side}`];contact.phase=(phase+(contact.side==='R'?.5:0))%1;contact.stance=stanceRatio;contact.mode=previousMode;contact.speed=previousSpeed;contact.planted=previousMode==='grounded'&&!dashActive&&(previousSpeed<.04||contact.phase<stanceRatio);contact.position.set(0,-.057,-.06);foot.localToWorld(contact.position);}
    return footContacts;
  }
  function rotate(name, x = 0, y = 0, z = 0) {
    if (nodes[name]) nodes[name].quaternion.multiply(q.setFromEuler(euler.set(x, y, z)));
  }
  // Two-link bird leg: the exposed backwards joint is the hock, not a human knee.
  // Solve both segments against a world-space sole target without stretching.
  const bendPole=new THREE.Vector3(),jointTarget=new THREE.Vector3(),endTarget=new THREE.Vector3();
  function placeFoot(side,x,y,z,amount,toePitch=0,toeRoll=0,plantedOrientation=null){
    if(amount<.001)return;
    const leg=nodes[`Leg${side}`],hock=nodes[`Hock${side}`],foot=nodes[`Foot${side}`];
    leg.parent.updateWorldMatrix(true,false);
    target.set(x,y,z);group.localToWorld(target);endTarget.copy(target);leg.parent.worldToLocal(target);
    direction.copy(target).sub(leg.position);
    if(hock){
      const l1=rest[`Hock${side}`].position.length(),l2=rest[`Foot${side}`].position.length();
      const d=clamp(direction.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);direction.normalize();
      bendPole.set(0,0,1).addScaledVector(direction,-direction.z).normalize();
      const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
      jointTarget.copy(direction).multiplyScalar(along).addScaledVector(bendPole,height);
      q.setFromUnitVectors(restDirection.copy(rest[`Hock${side}`].position).normalize(),jointTarget.normalize());leg.quaternion.slerp(q,amount);
      hock.updateWorldMatrix(true,false);target.copy(endTarget);leg.worldToLocal(target);target.sub(hock.position).normalize();
      q.setFromUnitVectors(restDirection.copy(rest[`Foot${side}`].position).normalize(),target);hock.quaternion.slerp(q,amount);hock.updateWorldMatrix(true,false);
      hock.getWorldQuaternion(parentQ);
    }else{
      // Old LOD/export compatibility until a cache refresh completes.
      restDirection.copy(rest[`Foot${side}`].position);const length=direction.length()/restDirection.length();
      q.setFromUnitVectors(restDirection.normalize(),direction.normalize());leg.quaternion.slerp(q,amount);
      leg.scale.setScalar(lerp(1,clamp(length,.64,1.25),amount));leg.updateWorldMatrix(true,true);leg.getWorldQuaternion(parentQ);foot.scale.setScalar(1/leg.scale.x);
    }
    if(plantedOrientation)worldQ.copy(plantedOrientation);else group.getWorldQuaternion(worldQ);footQ.copy(parentQ).invert().multiply(worldQ).multiply(q.setFromEuler(euler.set(toePitch,0,toeRoll)));foot.quaternion.slerp(footQ,amount);
  }
  function update(dt, time, state = {}) {
    if (disposed) return;
    // The controller supplies a bounded simulation delta. Do not silently lose
    // animation time on a 100–250ms render hitch while physics advances fully.
    dt = clamp(finite(dt), 0, .25);
    // A zero-step frame is a true pose hold, including mixer base channels.
    // Reapplying the mixer/rest layers at dt=0 can otherwise move the wing by
    // a few millimetres while menus and photo mode are supposed to be frozen.
    if(dt===0)return;
    elapsed += dt; time = elapsed;
    const initialGrowth=growthLevel<0;
    setGrowthAppearance(state.growth?.level??Math.max(0,growthLevel));
    growthPose=initialGrowth?growthLevel:lerp(growthPose,growthLevel,1-Math.exp(-dt*2.2));
    const speed = clamp(finite(state.speed), 0, 12);
    const mode = modes.has(state.mode) ? state.mode : state.gliding ? 'gliding' : 'grounded';
    const vertical = clamp(finite(state.verticalSpeed), -15, 15), ground = mode === 'grounded', perch = mode === 'perched';
    dashActive=!!state.dashing;
    const dashTarget=dashActive?Math.pow(Math.sin(Math.PI*clamp(finite(state.dashProgress),0,1)),.65):0;
    dashPose+=(dashTarget-dashPose)*(1-Math.exp(-dt*(dashActive?34:18)));
    cruisePose+=((state.cruise?1:0)-cruisePose)*(1-Math.exp(-dt*5));
    approachPose+=((state.perchApproach?1:0)-approachPose)*(1-Math.exp(-dt*8));
    if(dashActive){direction.set(finite(state.dashX),0,finite(state.dashZ));group.getWorldQuaternion(worldQ);direction.applyQuaternion(worldQ.invert());dashLateral=clamp(direction.x,-1,1);}
    group.getWorldPosition(bodyProbe);
    if(!ground||dashActive||!bodySeen||bodyProbe.distanceToSquared(previousBody)>.75*.75){footPlants.L.active=footPlants.R.active=false;}
    previousBody.copy(bodyProbe);bodySeen=true;
    const alpha = 1 - Math.exp(-dt * 10);
    speaking += ((state.speaking?1:0)-speaking)*(1-Math.exp(-dt*14));
    const voiceAmplitude=Number.isFinite(state.speechLevel)?clamp(state.speechLevel,0,1):.22+Math.max(0,Math.sin(time*17)*Math.sin(time*7.3))*.7;
    jawLevel+=((state.speaking?voiceAmplitude:0)-jawLevel)*(1-Math.exp(-dt*(voiceAmplitude>jawLevel?22:13)));
    attentionYaw+=(clamp(finite(state.attentionYaw),-.6,.6)-attentionYaw)*(1-Math.exp(-dt*4));
    attentionPitch+=(clamp(finite(state.attentionPitch),-.28,.3)-attentionPitch)*(1-Math.exp(-dt*4));
    carriedGlow+=((state.carrying?1:0)-carriedGlow)*alpha;focusPose+=((state.focusing?1:0)-focusPose)*alpha;
    if (['swimming','diving'].includes(previousMode) && ground && wet>.35) dryShake=1;
    idleTime = ground && speed<.04 && !state.listening && !state.focusing && !state.carrying ? idleTime+dt : 0;
    dryShake=Math.max(0,dryShake-dt/.85);
    if (mode !== previousMode) {
      if ((ground || perch) && !['grounded', 'perched', 'swimming'].includes(previousMode)) {
        landTime = 0; landStrength = clamp(.3 + Math.abs(previousVertical) / 8, .3, 1);
      }
      if (mode === 'rising') launchTime = 0;
    }
    landTime += dt; launchTime += dt;flinchTime+=dt;
    if (previousSpeed > .8 && speed < .15 && ground) brake = 1;
    previousSpeed = speed; previousVertical = vertical; previousMode = mode;
    motion += ((ground ? clamp(speed / .55, 0, 1) : 0) - motion) * alpha;
    listening += ((state.listening ? 1 : 0) - listening) * alpha;
    bank += (clamp(finite(state.bank), -.7, .7) - bank) * alpha;
    pitch += (clamp(finite(state.pitch), -.8, .8) - pitch) * alpha;
    for (const name of modes) weights[name] += ((mode === name ? 1 : 0) - weights[name]) * alpha;
    const wetTarget = clamp(finite(state.wetness, mode === 'swimming' || mode === 'diving' ? 1 : 0), 0, 1);
    wet += (wetTarget - wet) * (1 - Math.exp(-dt * (wetTarget > wet ? 3 : .7)));
    resonance = Math.max(0, resonance - dt / 2.2); startle = Math.max(0, startle - dt / .8); brake = Math.max(0, brake - dt / .4);
    // Reset rest transforms to prevent procedural rotation accumulating each frame.
    for (const [name, pose] of restEntries) {
      nodes[name].position.copy(pose.position); nodes[name].quaternion.copy(pose.quaternion); nodes[name].scale.copy(pose.scale);
    }
    mixer.update(dt);
    if(nodes.Crest){nodes.Crest.scale.y*=1+growthPose*.10;nodes.Crest.scale.z*=1+growthPose*.055;}
    if(nodes.TailTip)nodes.TailTip.scale.z*=1+Math.max(0,growthPose-1)*.12;
    const air = weights.rising + weights.flying + weights.gliding + weights.falling;
    const swim = weights.swimming, dive = weights.diving, perched = weights.perched;
    // Forward flight and submerged swimming fold the feet behind the belly.
    // Hover/launch keep their readable extension; falling releases the tuck
    // faster than it closes, while grounded IK owns the contact immediately.
    const tuckTarget=mode==='diving'?.64+.16*THREE.MathUtils.smoothstep(speed,.3,2.4):mode==='flying'||mode==='gliding'?THREE.MathUtils.smoothstep(speed,1.4,4.2):0;
    flightTuck+=(tuckTarget-flightTuck)*(1-Math.exp(-dt*(tuckTarget>flightTuck?5:11)));
    const legTuck=ground||perch?0:flightTuck;
    const running=clamp((speed-1.7)/1.6,0,1),overSpeed=clamp((speed-3.3)/2.3,0,1);
    // Longer running strides use a shorter support duty cycle. The maximum
    // leg excursion stays bounded, while the brief aerial phase prevents
    // unrealistically rapid tiny steps at sprint speed.
    const strideLength = lerp(.58, .75, clamp((speed - 1.2) / 2.1, 0, 1))+.22*running+.08*overSpeed;
    stanceRatio=lerp(.61,.46,running)-.03*overSpeed;
    if (ground && speed > .015 && !dashActive) phase = (phase + speed * dt / strideLength) % 1;
    const stepWave = Math.sin(phase * TAU), stepPulse = Math.cos(phase * TAU * 2);
    const landing = landTime < .62 ? Math.sin(Math.PI * clamp(landTime / .62, 0, 1)) * Math.exp(-landTime * 2) * landStrength : 0;
    const launch = launchTime < .4 ? Math.sin(Math.PI * launchTime / .4) : 0;
    const flinch=flinchTime<.42?Math.sin(Math.PI*flinchTime/.42)*Math.exp(-flinchTime*2):0;
    const fatigue = 1 - clamp(finite(state.stamina, 1), 0, 1);
    const flapPower = clamp(finite(state.wingbeat, mode === 'rising' || mode === 'flying' ? 1 : mode === 'falling' ? .45 : 0), 0, 1)*(1-dashPose*.74);
    const previousFlapPhase=flapPhase;
    const unwrappedFlapPhase=flapPhase + dt * (3.4 + flapPower * 1.5 - fatigue * .6-cruisePose*.75);
    flapPhase = unwrappedFlapPhase % 1;
    paddlePhase = (paddlePhase + dt * (.9 + Math.min(speed, 2) * .6)) % 1;
    // A firm 44% downstroke and longer recovery avoids a mechanical sine
    // pendulum. Keep its midpoint at phase .5 so the physical wing-sound event
    // continues to coincide with the loaded part of the downstroke.
    const shapedPhase=flapPhase>=.28&&flapPhase<.72?.25+(flapPhase-.28)/.44*.5:
      .75+((flapPhase<.28?flapPhase+1:flapPhase)-.72)/.56*.5;
    const flapAngle=shapedPhase*TAU,beat = Math.sin(flapAngle), wristBeat = Math.sin(flapAngle - .7), airFlap = flapPower * air;
    if(airFlap>.1&&['rising','flying'].includes(mode))wingbeatState.count+=Math.max(0,Math.floor(unwrappedFlapPhase+.5)-Math.floor(previousFlapPhase+.5));
    wingbeatState.phase=flapPhase;wingbeatState.strength=airFlap;wingbeatState.mode=mode;
    const recovery=Math.max(0,Math.cos(flapAngle)),flightFan=clamp(weights.gliding*.78+airFlap*(.25+.55*recovery)+weights.falling*.5,0,1);
    const breathing = Math.sin(time * 1.7);
    const idleCycle=idleTime%17,preen=idleCycle>8&&idleCycle<11?Math.sin((idleCycle-8)/3*Math.PI)**2:0;
    const shake=Math.sin(time*37)*dryShake;
    // A slight running crouch leaves reach for the outside leg in a turn;
    // otherwise the rising pelvis pulls a planted toe off the ground just
    // before toe-off, despite the world-space contact target being fixed.
    nodes.Pelvis.position.y += (-.023-.008*running) * motion + .010 * stepPulse * motion - .073 * landing - .028 * perched;
    nodes.Pelvis.position.x += .012 * stepWave * motion + Math.sin(time * 1.3) * .003 * perched;
    nodes.Root.position.y += .007 * breathing * air + .009 * Math.sin(time * 2.2) * swim + .045*dashPose*ground;
    // Forward flight carries the torso into the airflow; hover stays upright.
    // Controller pitch is a climb intention (negative = climbing), whereas
    // local +X raises the bird's -Z forward axis. Rotate around the breast base
    // so leaning does not move the entire body outside its physical capsule.
    const forwardLean = .46 * clamp(speed / 5.4, 0, 1) * air;
    const rootPitch = -pitch * air - forwardLean - .30 * swim - (1.20+.12*THREE.MathUtils.smoothstep(speed,.4,2.5) + pitch * .55) * dive-.16*dashPose+.12*approachPose;
    rotate('Root', rootPitch, 0, -bank * (air + swim * .3 + dive * .6)-dashLateral*dashPose*.15);
    target.set(0, .46, 0).applyQuaternion(nodes.Root.quaternion);
    nodes.Root.position.x -= target.x;
    nodes.Root.position.y += .46 - target.y;
    nodes.Root.position.z -= target.z;
    rotate('Breast', -.055 * motion - .06 * launch + .095 * brake + .018 * beat * airFlap + .06*flinch, shake*.065,
      -.026 * stepWave * motion + .018 * Math.sin(time * 1.4) * perched);
    rotate('Neck', .025 * motion + .13 * swim + .12 * dive + preen*.15, -.08 * listening - preen*.28, -.025 * Math.sin(time * 1.4) * perched + shake*.05);
    // A short hold and a quicker advance replaces an even pendulum bob. At
    // running speed the hold softens; during flight the head counters some
    // body roll/pitch while retaining intentional looking and dive posture.
    const headCycle=(phase*2)%1,headHold=headCycle<.68?(headCycle/.68-.5):(.5-((headCycle-.68)/.32)**2*(3-2*(headCycle-.68)/.32));
    const headTravel=headHold*.040*motion*(1-clamp((speed-2.8)/3,0,.7));
    nodes.Neck.position.z+=headTravel+.022*flinch;nodes.Neck.position.y-=.008*stepPulse*motion+.020*flinch;
    rotate('Neck',(-rootPitch*.34)*air,0,bank*air*.35);
    const lookCycle=(time+1.7)%11,lookTarget=lookCycle<3.6?0:lookCycle<5.5?.13:lookCycle<8.6?-.10:.035;
    gazeYaw+=(lookTarget-gazeYaw)*(1-Math.exp(-dt*7));
    const gaze=gazeYaw*(1-motion*.75);
    rotate('Head', .014 * breathing + .010 * stepPulse * motion - .07 * startle - .14*flinch + attentionPitch * (1-air*.75) + .06*carriedGlow + preen*.32 -rootPitch*air*.20, -preen*.48 + gaze * (1 - dive * .8) - bank * .15 + attentionYaw * (1-air*.75), -.13 * listening + bank * air * .30 + shake*.12 - preen*.15);
    rotate('Mandible', -.20*jawLevel,0,0);
    for(const eye of ['EyeL','EyeR'])rotate(eye,attentionPitch*.22,attentionYaw*.20+gaze*.14,0);
    rotate('Crest', -.018 * breathing + .035 * stepWave * motion - .055 * beat * airFlap - .16 * startle, .015 * Math.sin(time * 2.1), -.06 * listening);
    // Lift the folded retrices slightly while walking, leaving the planted feet
    // readable from the actual rear gameplay camera.
    rotate('Tail', -.19 * motion - .17*perched + .17 * air + .21 * swim + .12 * dive - .10 * landing, -.035 * stepWave * motion + bank * air * .17, .025 * Math.sin(paddlePhase * TAU) * (swim + dive));
    rotate('TailTip', -.02 * stepPulse * motion + .025 * wristBeat * airFlap, .045 * Math.sin(paddlePhase * TAU - .55) * (swim + dive), .014 * Math.sin(time * 3.1) * air);
    // Dipper-inspired propulsion: compact paired wing strokes under water,
    // with the feet folded behind the belly instead of a suspended walk.
    const waterStroke=Math.sin(paddlePhase*TAU),waterPower=.32+.18*clamp(speed/2.5,0,1);
    for (const [side, sign, offset] of sideRig) {
      // Shoulder opens folded source wing; delayed wrist gives primaries a distinct arc.
      const open = preen*(side==='R'?.16:.02) + dryShake*.12 + focusPose*.28 + carriedGlow*.035 + air * (1.10-dashPose*.48) + airFlap * .55 * beat + .13 * swim + (.24+waterPower*(.5+.5*waterStroke)) * dive + .14 * landing + .018 * perched + .18*dashPose*ground + .12*approachPose + .18*flinch*(1-air*.3);
      rotate(`Wing${side}`, -.28 * air - .09 * airFlap * Math.cos(flapAngle) - .09 * dive, sign * (.05 * airFlap * beat + .025 * swim),
        sign * (open + sign * bank * air * .12 + resonance * .16 + startle * .18));
      rotate(`Wing${side}`, 0, sign * foldedWingYaw * (air+dive*.42), 0);
      rotate(`Flight${side}`, .035 * airFlap * wristBeat - .11*airFlap*recovery, sign * (.31 * air + .12 * airFlap * wristBeat + .09 * dive + .14*airFlap*recovery),
        sign * (.20 * airFlap * wristBeat -.13*airFlap*recovery + .008 * Math.sin(time * 8.2 + offset) * (air + .15)));
      for(let finger=0;finger<5;finger++){
        const delay=Math.sin(flapAngle-.7-finger*.15),fan=(finger-2)*.062*flightFan;
        rotate(`Primary${side}${finger}`,fan+.035*airFlap*delay,sign*(.055*airFlap*recovery+.025*weights.gliding*Math.sin(time*2.1+finger*.6)),sign*(.024*airFlap*delay+.012*bank*air));
      }
      const tailSpread=clamp((.5*weights.gliding+.65*landing+.42*brake+.32*weights.falling+.12*swim)*(1-dashPose*.7)+.35*approachPose,0,1);
      rotate(`TailFan${side}`, -.035*tailSpread,sign*.22*tailSpread,sign*.035*tailSpread);
      const paddle = Math.sin((paddlePhase + offset) * TAU);
      rotate(`Leg${side}`, -.65 * air - 1.05*legTuck + (.30 + paddle * .42) * swim + (-.55 + paddle * .16) * dive);
      if(nodes[`Hock${side}`])rotate(`Hock${side}`, .62*air + .70*dive - .18*swim);
      rotate(`Foot${side}`, .40 * air - 1.70*legTuck + Math.max(0, paddle) * .48 * swim + .34 * dive);
      const phaseSide = (phase + offset) % 1, stance = stanceRatio;
      let travel, lift;
      if (phaseSide < stance) { travel = phaseSide / stance - .5; lift = 0; }
      else {
        const swing = (phaseSide - stance) / (1 - stance);
        travel = .5 - swing * swing * (3 - 2 * swing); lift = Math.sin(swing * Math.PI) * (.075 + speed * .012);
      }
      const reach = strideLength * stance * motion;
      let footX = sign * (.105 - .014 * perched), footZ = -.035 + (.09 * motion + travel * reach) * (1 - perched);
      if(dashPose>.02&&ground){footZ=lerp(footZ,side==='L'?-.17:.11,dashPose);lift+=dashPose*.045;}
      const plant=footPlants[side],support=ground&&!dashActive&&speed>.18&&phaseSide<stance;
      if(support){
        group.updateWorldMatrix(true,false);
        if(!plant.active){plant.point.set(footX,0,footZ);group.localToWorld(plant.point);group.getWorldQuaternion(plant.orientation);plant.active=true;}
        plantProbe.copy(plant.point);group.worldToLocal(plantProbe);
        // A hard turn can exceed the real two-link reach; let that foot make
        // a small corrective step rather than stretching or pinning the body.
        if(Math.hypot(plantProbe.x-sign*.105,plantProbe.z-.055)>.325){plant.point.set(footX,0,footZ);group.localToWorld(plant.point);group.getWorldQuaternion(plant.orientation);plantProbe.set(footX,0,footZ);plantResets++;}
        footX=plantProbe.x;footZ=plantProbe.z;
      }else plant.active=false;
      let terrainLift=0,terrainPitch=0,terrainRoll=0;
      if(perch){
        const slopeX=finite(state.perchSlopeX),slopeZ=finite(state.perchSlopeZ);
        group.getWorldQuaternion(worldQ);
        terrainProbe.set(1,0,0).applyQuaternion(worldQ);
        const localSlopeX=slopeX*terrainProbe.x+slopeZ*terrainProbe.z;
        terrainProbe.set(0,0,1).applyQuaternion(worldQ);
        const localSlopeZ=slopeX*terrainProbe.x+slopeZ*terrainProbe.z;
        // The controller's landing target is .29m above the branch centre.
        // A tilted circular section is slightly higher at fixed world X/Z.
        const upperSurface=.29*(Math.sqrt(1+slopeX*slopeX+slopeZ*slopeZ)-1);
        terrainLift=localSlopeX*footX+localSlopeZ*footZ+upperSurface;
        terrainPitch=-Math.atan(localSlopeZ);terrainRoll=Math.atan(localSlopeX);
      }
      if(ground&&typeof state.sampleGround==='function'){
        group.updateWorldMatrix(true,false);
        const groundAt=(x,z)=>{terrainProbe.set(x,0,z);group.localToWorld(terrainProbe);const height=state.sampleGround(terrainProbe);if(!Number.isFinite(height))return 0;terrainProbe.y=height;group.worldToLocal(terrainProbe);return terrainProbe.y;};
        terrainLift=clamp(groundAt(footX,footZ),-.25,.25);
        const cached=footTerrain[side];
        if(elapsed>=cached.at){
          // Sample along the planted toe's world direction, not the body's
          // changing yaw, so a turn on a slope does not twist the sole plane.
          slopeOrigin.set(footX,0,footZ);group.localToWorld(slopeOrigin);
          if(support)worldQ.copy(plant.orientation);else group.getWorldQuaternion(worldQ);
          const heightAlong=(x,z)=>{slopeProbe.set(x,0,z).applyQuaternion(worldQ).add(slopeOrigin);const value=state.sampleGround(slopeProbe);return Number.isFinite(value)?value:slopeOrigin.y;};
          cached.pitch=clamp(Math.atan2(heightAlong(0,-.065)-heightAlong(0,.065),.13),-.38,.38);cached.roll=clamp(Math.atan2(heightAlong(.035,0)-heightAlong(-.035,0),.07),-.28,.28);cached.at=elapsed+.075;
        }
        terrainPitch=cached.pitch;terrainRoll=cached.roll;
      }
      // Ground contact engages immediately; upper-body landing fades independently.
      placeFoot(side, footX, .07 + terrainLift + lift * motion * (1 - perched),
        footZ, ground || perch ? 1 : weights.grounded + perched, terrainPitch * (perch?1:weights.grounded),terrainRoll * (perch?1:weights.grounded),support?plant.orientation:null);
    }
    if(skin?.morphTargetInfluences)for(let i=0;i<2;i++){const p=(phase+i*.5)%1,swing=p>stanceRatio?Math.sin((p-stanceRatio)/(1-stanceRatio)*Math.PI):0;skin.morphTargetInfluences[i]=perched+weights.grounded*swing*.24*motion+air*.12+legTuck*.38;}
    for (const [material, dry] of materialEntries) {
      if (!/feather|down|bronze/i.test(material.name)) continue;
      material.color.copy(dry.color).multiplyScalar(1 - wet * .15);
      const wetRoughness = material === plumage ? .65 : Math.max(.48, dry.roughness * .57);
      material.roughness = lerp(dry.roughness, wetRoughness, wet);
      if (material.isMeshPhysicalMaterial) {
        material.sheen = dry.sheen * (1 - wet * .78);
        // The dielectric BRDF expects a relative IOR. Submerged feather surfaces
        // meet water, so the air-interface F0 produced implausible white glints.
        // Blend with the existing dive pose; floating/shore feathers retain their
        // air-interface response. This is an artistic single-layer approximation.
        if (/feather|down/i.test(material.name)) material.ior = lerp(dry.ior, Math.max(1, dry.ior / 1.333), dive);
      }
    }
    if (plumage) plumage.normalScale.setScalar(.22 - wet * .05);
    if (nodes.Shuoyu_glow) nodes.Shuoyu_glow.material.emissiveIntensity = .65 + listening * 1.15 + resonance * 1.5 + breathing * .10 + carriedGlow*.65 + focusPose*1.4;
    group.userData.motion = { mode, speed, phase, stance:stanceRatio,strideLength, wingbeat: airFlap, flightTuck:legTuck, wetness: wet, landing, footContact: (ground&&!dashActive) || perch, perchId: state.perchId ?? null, attentionYaw, attentionPitch, carrying:carriedGlow, focusing:focusPose, preening:preen, drying:dryShake, speaking, jawLevel, flightFan, headTravel,plantResets,dashing:dashActive,dashPose,dashLateral,cruise:cruisePose,perchApproach:approachPose, legRig:nodes.HockL?'two-link-hock':'legacy', featherRig:nodes.PrimaryL0?'articulated-primary-pairs':'legacy' }; 
  }
  function trigger(name) {
    if(name==='Flinch')flinchTime=0;
    if (name === 'Resonance' || name === 'Listen') resonance = 1;
    if (name === 'StartleRecover') startle = 1;
    if (name === 'Land') { landTime = 0; landStrength = .65; }
    if (name === 'Start') launchTime = 0;
    if (name === 'Brake') brake = 1;
  }
  function dispose() {
    if (disposed) return; disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(group);
    const resources = new Set();
    group.traverse(node => {
      if (node.geometry) resources.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!mat) continue; resources.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) resources.add(value);
      }
      if (node.skeleton) resources.add(node.skeleton);
    });
    resources.forEach(r => r.dispose?.()); group.removeFromParent();
  }
  group.userData.animations = gltf.animations.map(c => c.name);
  // SkeletonUtils.clone preserves Object3D.animations. An isolated gallery can
  // play IdleBreath/Blink/Glide through its own AnimationMixer and clock.
  group.animations = gltf.animations;
  group.userData.foldedWingYaw = foldedWingYaw;
  group.userData.collisionCapsule = { radius: .22, height: 1.06, offsetY: .53 };
  return { group, update, dispose, trigger, getFootContacts, getWingTips,getWingbeat:()=>wingbeatState,getGrowth:()=>({level:growthLevel,blend:growthPose}) };
}
