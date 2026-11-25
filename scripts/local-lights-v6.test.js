import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,PointLight,SpotLight,Group,PerspectiveCamera,Vector3} from 'three';
import {createLocalLightBudget} from '../src/v6/local-lights.js';
test('local lights keep a fixed rendering budget across hidden source groups and preserve source transforms',()=>{
 const scene=new Scene(),parent=new Group();parent.position.set(3,0,0);scene.add(parent);
 const a=new PointLight(0xffaa66,2,8),b=new PointLight(0x88bbff,1,5),c=new PointLight(0xffffff,1,4);a.position.x=1;parent.add(a);b.position.x=6;scene.add(b);c.position.x=50;scene.add(c);
 const camera=new PerspectiveCamera(),pool=createLocalLightBudget(scene);pool.update(new Vector3(),camera);
 let rendered=[];scene.traverseVisible(o=>{if(o.isPointLight&&o.layers.test(camera.layers))rendered.push(o);});assert.equal(rendered.length,2);assert.deepEqual(pool.stats(),{slots:2,active:2,sources:3});assert.ok(rendered.some(o=>o.position.x===4&&o.color.equals(a.color)));
 parent.visible=false;b.visible=false;pool.update(new Vector3(),camera);rendered=[];scene.traverseVisible(o=>{if(o.isPointLight&&o.layers.test(camera.layers))rendered.push(o);});assert.equal(rendered.length,2);assert.equal(pool.stats().active,0);
 pool.dispose();assert.equal(a.layers.mask,1);assert.equal(b.layers.mask,1);assert.equal(scene.children.filter(o=>o.name.startsWith('Local light budget')).length,0);
});
test('switching the companion side-light changes intensity while its shader light count stays constant',()=>{
 const scene=new Scene(),source=new SpotLight(0xffaa66,12,9,.65,.7,1.5),camera=new PerspectiveCamera();source.visible=false;source.position.set(2,3,4);source.target.position.set(0,0,-4);scene.add(source,source.target);
 const pool=createLocalLightBudget(scene);pool.update(new Vector3(),camera);const rendered=[];scene.traverseVisible(o=>{if(o.isSpotLight&&o.layers.test(camera.layers))rendered.push(o);});assert.equal(rendered.length,1);assert.equal(rendered[0].intensity,0);
 source.visible=true;pool.update(new Vector3(),camera);assert.equal(rendered[0].intensity,12);assert.deepEqual(rendered[0].position.toArray(),[2,3,4]);assert.equal(rendered[0].target,source.target);pool.dispose();assert.equal(source.layers.mask,1);
});
