import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createLocomotion} from '../src/v3/locomotion.js';

const flat=(extra={})=>({perches:[],sample:()=>({groundHeight:0,waterLevel:null,waterDepth:0,ceil:16,wind:new Vector3(),...extra}),resolveMotion:(from,to)=>({position:to.clone(),hit:false})});
function make(world=flat(),position=new Vector3()){const events=[];return {c:createLocomotion({world,position,onEvent:e=>events.push(e)}),events};}
function advance(c,seconds,input={},fps=60){for(let i=0;i<Math.round(seconds*fps);i++)c.update(1/fps,input);}

test('ordinary walking is modestly faster, quick walking remains distinct',()=>{
 const slow=make().c,quick=make().c;advance(slow,3,{moveZ:1});advance(quick,3,{moveZ:1,sprint:true});
 assert.ok(-slow.position.z>6.25&&-slow.position.z<6.65);assert.ok(-quick.position.z>11.1&&-quick.position.z<11.7);
 assert.equal(slow.state.gait,'walk');assert.equal(quick.state.gait,'quick');
});

for(const medium of ['ground','air','water'])test(`listening slows ordinary ${medium} movement but explicit quick movement takes priority until released`,()=>{
 const water=medium==='water',world=flat(water?{groundHeight:-3,waterLevel:0,waterDepth:3}:{}),position=new Vector3(0,water?-.42:medium==='air'?4:0,0),c=make(world,position).c;
 if(medium==='air')c.toggleCruise();
 const ordinary=water?2.05:medium==='air'?5.4:2.2,quick=water?2.7:medium==='air'?6.5:3.9;
 advance(c,3,{moveZ:1,listen:true});assert.ok(Math.abs(c.state.speed-ordinary*.55)<.01,'ordinary listening stays deliberately slow');
 advance(c,3,{moveZ:1,listen:true,sprint:true});assert.ok(Math.abs(c.state.speed-quick)<.01,'explicit sprint keeps the full speed even while listening');
 advance(c,3,{moveZ:1,listen:true});assert.ok(Math.abs(c.state.speed-ordinary*.55)<.01,'releasing sprint restores the listening pace');
});
test('dash is a bounded movement with cooldown and preserves swept wall collisions',()=>{
 const world=flat();world.resolveMotion=(from,to,r)=>{const p=to.clone();if(p.z<-.8+r&&p.y<1.8){p.z=-.8+r;return {position:p,hit:true,normal:new Vector3(0,0,1),reason:'wall'};}return {position:p,hit:false};};
 const {c,events}=make(world);assert.equal(typeof c.dash,'function');assert.equal(c.dash({moveZ:1,yaw:0}),true);assert.equal(c.dash({moveZ:1}),false);
 advance(c,.3,{moveZ:1});assert.ok(c.position.z>=-.531);assert.equal(c.state.dashing,false);assert.ok(c.state.dashCooldown>0);assert.equal(events.filter(e=>e.type==='dash').length,1);
 advance(c,1.2);assert.equal(c.dash({moveX:1}),true);
});
test('dash covers the same real distance at 30, 60 and 144 Hz and never teleports on request',()=>{
 const positions=[30,60,144].map(fps=>{const c=make().c;c.dash({moveZ:1});assert.equal(c.position.length(),0);advance(c,.5,{},fps);return c.position.clone();});
 assert.ok(-positions[0].z>1.0&&-positions[0].z<2.8);
 assert.ok(positions[0].distanceTo(positions[1])<.001);assert.ok(positions[0].distanceTo(positions[2])<.001);
});
test('continuous wing flight holds altitude without holding ascend and remains steerable',()=>{
 const c=make(flat(),new Vector3(0,4,0)).c;assert.equal(typeof c.toggleCruise,'function');assert.equal(c.toggleCruise(),true);advance(c,5,{moveZ:1});
 assert.equal(c.state.cruise,true);assert.equal(c.state.mode,'flying');assert.ok(Math.abs(c.position.y-4)<.15);assert.ok(c.position.z<-15);assert.ok(c.state.stamina<1);
 advance(c,1,{ascend:true});assert.ok(c.position.y>5);const height=c.position.y;advance(c,1);assert.ok(c.position.y>height-.3);
 const releaseHeight=c.position.y;c.toggleCruise();advance(c,1);assert.equal(c.state.cruise,false);assert.equal(c.state.mode,'gliding');assert.ok(c.position.y<releaseHeight);
});
test('continuous flight gives way to fatigue, water, pause and landing requests',()=>{
 const c=make(flat(),new Vector3(0,6,0)).c;c.toggleCruise();c.state.stamina=.02;advance(c,2);assert.equal(c.state.cruise,false);assert.notEqual(c.state.mode,'flying');
 const wet=make(flat({groundHeight:-3,waterLevel:0,waterDepth:3}),new Vector3(0,-.42,0)).c;assert.equal(wet.toggleCruise(),false);assert.equal(wet.state.mode,'swimming');
 c.reset(new Vector3(0,4,0));c.toggleCruise();c.stop();assert.equal(c.state.cruise,false);assert.equal(c.state.dashing,false);
 c.toggleCruise();c.land();advance(c,.1);assert.equal(c.state.cruise,false);assert.ok(c.velocity.y<0);
});
test('perch candidate and request use one reach envelope and brake into a branch without teleporting',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85,label:'歇脚枝'}];const c=make(world,new Vector3(0,3,2.2)).c;
 assert.equal(typeof c.getPerchCandidate,'function');const offer=c.getPerchCandidate();assert.equal(offer.id,'b');assert.equal(offer.canRequest,true);assert.equal(offer.canPerch,false);
 const before=c.position.clone();assert.equal(c.requestPerch(),true);assert.deepEqual(c.position,before);advance(c,1.4);
 assert.equal(c.state.mode,'perched');assert.equal(c.state.perchId,'b');assert.ok(c.position.distanceTo(world.perches[0].position)<.01);assert.equal(c.state.perchApproach,null);
});
test('assisted perch approach cannot phase through a blocker',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];world.resolveMotion=(from,to,r)=>{const p=to.clone();if(p.z<1+r){p.z=1+r;return {position:p,hit:true,normal:new Vector3(0,0,1),reason:'trunk'};}return {position:p,hit:false};};
 const {c,events}=make(world,new Vector3(0,3,2.4));assert.equal(c.requestPerch(),true);advance(c,3);
 assert.notEqual(c.state.mode,'perched');assert.equal(c.state.perchApproach,null);assert.ok(c.position.z>=1.269);assert.ok(events.some(e=>e.type==='perch-blocked'));
});
test('perch assistance can be cancelled and refuses unreachable branches or underwater requests',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world,new Vector3(0,3,2)).c;c.requestPerch();c.jump();assert.equal(c.state.perchApproach,null);assert.equal(c.state.mode,'flying');
 c.reset(new Vector3(0,0,0));assert.equal(c.getPerchCandidate().canRequest,false);assert.equal(c.requestPerch(),false);
 const water=flat({groundHeight:-4,waterLevel:0,waterDepth:4});water.perches=world.perches;const diver=make(water,new Vector3(0,-1,0)).c;assert.equal(diver.requestPerch(),false);
});
test('perch command brakes existing held flight input but a fresh climb or steering command takes over',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world,new Vector3(0,3,2)).c;
 c.update(1/90,{ascend:true,moveZ:1});assert.equal(c.requestPerch(),true);c.update(1/90,{ascend:true,moveZ:1});assert.equal(c.state.perchApproach,'b');
 c.update(1/90,{});c.update(1/90,{ascend:true});assert.equal(c.state.perchApproach,null);
 c.reset(new Vector3(0,3,2));assert.equal(c.requestPerch(),true);c.update(1/90,{moveX:1});assert.equal(c.state.perchApproach,null);
});
test('a late edge jump remains a jump before the short coyote window closes',()=>{
 const world=flat();world.sample=p=>({groundHeight:p.z<-.5?-5:0,waterLevel:null,waterDepth:0,ceil:16,wind:new Vector3()});const c=make(world).c;
 while(c.state.mode==='grounded')c.update(1/90,{moveZ:1});c.update(1/90,{moveZ:1});assert.equal(c.jump(),true);assert.equal(c.state.mode,'rising');assert.ok(c.velocity.y>=4);
});
test('render interpolation removes the alternating physical-step spacing without modifying physics',()=>{
 const paths=[30,60,144].map(fps=>{const c=make().c,out=new Vector3();advance(c,2,{moveZ:1},fps);const spacing=[];let previous=c.getRenderPosition(out).z;
  for(let i=0;i<fps;i++){c.update(1/fps,{moveZ:1});const physical=c.position.clone();c.getRenderPosition(out);assert.deepEqual(c.position,physical);spacing.push(previous-out.z);previous=out.z;}
  assert.ok(Math.max(...spacing)-Math.min(...spacing)<.00001);return out.clone();});
 assert.ok(paths[0].distanceTo(paths[1])<.00001);assert.ok(paths[0].distanceTo(paths[2])<.00001);
});
test('reset, stopping and branch contact reset visual history without a ghost trajectory',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world).c,out=new Vector3();advance(c,.3,{moveZ:1});c.reset(new Vector3(0,3,2));assert.deepEqual(c.getRenderPosition(out),c.position);
 c.requestPerch();advance(c,1.4);assert.equal(c.state.mode,'perched');assert.deepEqual(c.getRenderPosition(out),c.position);c.jump();advance(c,.2,{ascend:true});c.stop();assert.deepEqual(c.getRenderPosition(out),c.position);
});
test('a ground dash cannot climb a cliff but the same dash clears it with real altitude',()=>{
 const world=flat();world.sample=p=>({groundHeight:p.z<-1.2?3:0,waterLevel:null,waterDepth:0,ceil:16,wind:new Vector3()});const c=make(world).c;
 c.dash({moveZ:1});advance(c,.6,{moveZ:1});assert.ok(c.position.z>=-1.2);assert.equal(c.position.y,0);
 c.reset(new Vector3(0,4.5,0));c.dash({moveZ:1});advance(c,.5,{moveZ:1});assert.ok(c.position.z<-1.3);assert.ok(c.position.y>=3);
});
test('water dash remains below the surface and never blocks oxygen rescue',()=>{
 const c=make(flat({groundHeight:-4,waterLevel:0,waterDepth:4}),new Vector3(0,-1.6,0)).c;c.dive();assert.equal(c.dash({moveX:1}),true);advance(c,.5);assert.ok(c.position.x>.6);assert.ok(c.position.y<-.7);assert.equal(c.state.mode,'diving');
 c.state.oxygen=.001;advance(c,.1,{descend:true});assert.equal(c.dash(),false);advance(c,5,{descend:true});assert.equal(c.state.mode,'swimming');
});
test('cruise climb and descent are invariant across display refresh rates',()=>{
 const points=[30,60,144].map(fps=>{const c=make(flat(),new Vector3(0,5,0)).c;c.toggleCruise();advance(c,1,{moveZ:1,ascend:true},fps);advance(c,1,{moveX:1,descend:true},fps);advance(c,1,{},fps);return c.position.clone();});assert.ok(points[0].distanceTo(points[1])<.001);assert.ok(points[0].distanceTo(points[2])<.001);
});
test('releasing steering during cruise brakes into a stable hover within two metres',()=>{
 const c=make(flat(),new Vector3(0,5,0)).c;c.toggleCruise();advance(c,3,{moveZ:1});const before=c.position.clone();advance(c,1.5);
 assert.ok(c.position.distanceTo(before)<2);assert.ok(c.state.speed<.12);assert.ok(Math.abs(c.position.y-before.y)<.1);assert.equal(c.state.cruise,true);
 const glide=make(flat(),new Vector3(0,7,0)).c;glide.jump();advance(glide,1,{ascend:true,moveZ:1});const released=glide.position.clone();advance(glide,1.5);assert.ok(glide.position.distanceTo(released)>3);assert.equal(glide.state.mode,'gliding');
});
test('perch orientation and slope follow the branch and clear on leaving it',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85,yaw:1.2,slope:{x:.15,z:-.2}}];const c=make(world,new Vector3(0,3,2)).c;c.requestPerch();advance(c,1.4);assert.equal(c.state.perchYaw,1.2);assert.equal(c.state.perchSlopeX,.15);assert.equal(c.state.perchSlopeZ,-.2);c.jump();assert.equal(c.state.perchYaw,null);assert.equal(c.state.perchSlopeX,0);assert.equal(c.state.perchSlopeZ,0);c.reset(world.perches[0].position);assert.equal(c.state.perchYaw,1.2);assert.equal(c.state.perchSlopeX,.15);assert.equal(c.state.perchSlopeZ,-.2);
});
test('a cruise ascent key adjusts target altitude instead of applying a second jump impulse',()=>{
 const c=make(flat(),new Vector3(0,5,0)).c;c.toggleCruise();advance(c,1);const before=c.velocity.y;assert.equal(c.jump(),true);assert.equal(c.velocity.y,before);advance(c,.1,{ascend:true});assert.ok(c.velocity.y>0&&c.velocity.y<.5);assert.equal(c.state.cruise,true);
});
test('a perch consumes inherited held ascent until release, then a fresh jump leaves normally',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world,new Vector3(0,3,2)).c;c.update(1/90,{ascend:true,moveZ:1});c.requestPerch();advance(c,2,{ascend:true,moveZ:1});assert.equal(c.state.mode,'perched');assert.equal(c.position.y,3);
 c.update(1/90,{});c.jump();assert.equal(c.state.mode,'flying');advance(c,.2,{ascend:true});assert.ok(c.position.y>3);
});
test('a perch consumes inherited held descent until release, then a fresh descent leaves',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world,new Vector3(0,3,2)).c;c.update(1/90,{descend:true});c.requestPerch();advance(c,2,{descend:true});assert.equal(c.state.mode,'perched');assert.equal(c.position.y,3);
 c.update(1/90,{});advance(c,.2,{descend:true});assert.notEqual(c.state.mode,'perched');assert.ok(c.position.y<3);
});
test('perch requests capture keys pressed before the next animation update',()=>{
 for(const held of [{descend:true},{ascend:true},{moveZ:2,moveX:.4,descend:true}]){
  const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const {c,events}=make(world,new Vector3(0,3,2));
  c.update(1/90,{});assert.equal(c.requestPerch(held),true);advance(c,2,held);
  assert.equal(c.state.mode,'perched',JSON.stringify(held));assert.equal(events.some(e=>e.type==='perch-cancel'),false);
 }
});
test('a request snapshot can release old keys while fresh post-request controls still cancel',()=>{
 const world=flat();world.perches=[{id:'b',position:new Vector3(0,3,0),radius:.85}];const c=make(world,new Vector3(0,3,2)).c;
 c.update(1/90,{ascend:true,descend:true,moveZ:1});assert.equal(c.requestPerch({}),true);c.update(1/90,{descend:true});assert.equal(c.state.perchApproach,null);
 c.reset(new Vector3(0,3,2));assert.equal(c.requestPerch({descend:true}),true);c.update(1/90,{descend:true,moveX:1});assert.equal(c.state.perchApproach,null);
});
