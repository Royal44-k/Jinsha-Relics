import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
const module=await import('../src/v7/camera-clearance.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function resolver(){assert.equal(typeof module.createCameraClearance,'function','final camera clearance resolver is required');return module.createCameraClearance();}
function camera(position){const c=new T.PerspectiveCamera(48,1.6,.08,100);c.position.copy(position);return c;}
function obstacle(position,size){const m=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({side:T.DoubleSide}));m.position.copy(position);m.updateMatrixWorld();return m;}
function hits(c,target,objects){const d=target.clone().sub(c.position),ray=new T.Raycaster(c.position,d.clone().normalize(),0,d.length()-.001);return ray.intersectObjects(objects,true).length;}

test('a smoothed camera is pulled in immediately when its final sightline is blocked',()=>{
 const fix=resolver(),target=new T.Vector3(0,.85,0),wall=obstacle(new T.Vector3(0,1,2),[1,3,.3]),c=camera(new T.Vector3(0,1.6,4));assert.ok(hits(c,target,[wall])>0);fix.constrain(c,target,[wall]);assert.equal(hits(c,target,[wall]),0);assert.ok(c.position.z<1.85);
});
test('near-clip corner clearance detects a thin obstacle missed by the centre ray',()=>{
 const fix=resolver(),target=new T.Vector3(0,1,0),wall=obstacle(new T.Vector3(.09,1,3.92),[.05,1,.08]),c=camera(new T.Vector3(0,1,4));assert.equal(hits(c,target,[wall]),0);fix.constrain(c,target,[wall]);assert.ok(c.position.z<3.88,'lens envelope must remain in front of the obstacle');
});
test('a close obstacle is never ignored to retain an arbitrary minimum camera distance',()=>{
 const fix=resolver(),target=new T.Vector3(0,1,0),wall=obstacle(new T.Vector3(0,1,.22),[1,2,.12]),c=camera(new T.Vector3(0,1,4));fix.constrain(c,target,[wall]);assert.ok(c.position.z<.16);assert.equal(hits(c,target,[wall]),0);
});
test('clear underwater and high-perch views keep their authored positions exactly',()=>{
 const fix=resolver();for(const [a,b] of [[[0,-2,4],[0,-2,0]],[[0,10,4],[0,8.6,0]]]){const c=camera(new T.Vector3(...a)),before=c.position.clone();fix.constrain(c,new T.Vector3(...b),[]);assert.ok(c.position.equals(before));}
});

test('an unusably close cinematic keeps the validated player position, orientation and FOV in the same frame',()=>{
 const fix=resolver(),target=new T.Vector3(0,1,0),wall=obstacle(new T.Vector3(0,1,.4),[.6,2,.3]),c=camera(new T.Vector3(5,1,2));c.lookAt(target);const before={position:c.position.clone(),quaternion:c.quaternion.clone(),fov:c.fov};
 const source=fs.readFileSync(new URL('../src/v2/main.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('function applyMomentCamera('),source.indexOf('function headingAt('));let resets=0;
 const run=new Function('THREE','cameraTarget','camera','ray','forest','traversal','adventure','pottery','cameraClearance','visibleCameraColliders','director','position',`let activeShot={};${body}return applyMomentCamera;`)(T,target,c,new T.Raycaster(),{cameraColliders:[wall]},{cameraColliders:[],sample:()=>({groundHeight:0})},{cameraColliders:[]},null,fix,()=>[wall],{reset(){resets++;}},new T.Vector3(0,.15,0));
 run({target,position:new T.Vector3(0,1,4),weight:1,fov:44});assert.equal(resets,1);assert.ok(c.position.equals(before.position));assert.ok(c.quaternion.equals(before.quaternion));assert.equal(c.fov,before.fov);
});

test('cinematic framing keeps a visible subject sphere while allowing off-centre composition',()=>{
 const fix=resolver(),c=camera(new T.Vector3(0,1.2,5));assert.equal(typeof fix.isUsableShot,'function');const subject=new T.Vector3();
 assert.equal(fix.isUsableShot(c,c.position,new T.Vector3(.6,1,0),subject,48),true);
 assert.equal(fix.isUsableShot(c,c.position,new T.Vector3(10,1,0),subject,48),false);
 assert.equal(fix.isUsableShot(c,new T.Vector3(0,1,.4),new T.Vector3(0,1,0),subject,48),false);
});
