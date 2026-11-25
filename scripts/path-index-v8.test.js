import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,CatmullRomCurve3} from 'three';
import {createPathIndex} from '../src/v8/path-index.js';
const width=d=>3.4+1.15*Math.sin(d*.035)**2+3.1*(1-Math.max(0,Math.min(1,Math.abs(d-380)/10)));
function reference(segments,p,mainOnly,corridor){let best=Infinity,metric=Infinity,out=null;for(const s of segments){if(mainOnly&&s.side)continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(dx*dx+dz*dz))),x=s.a.x+dx*t,z=s.a.z+dz*t,d2=(x-p.x)**2+(z-p.z)**2,d=s.d0+(s.d1-s.d0)*t,m=corridor?Math.sqrt(d2)-(s.width||width(d)):d2;if(m<metric){metric=m;best=d2;out={distance:d,point:new Vector3(x,0,z),offset:Math.sqrt(d2),width:s.width,side:s.side,signed:((p.x-x)*(-dz)+(p.z-z)*dx)/Math.hypot(dx,dz)};}}return out;}
function fixture(){const curve=new CatmullRomCurve3(Array.from({length:20},(_,i)=>new Vector3(Math.sin(i*.8)*22,0,-i*20))),points=curve.getSpacedPoints(700);return points.slice(0,-1).map((a,i)=>({a,b:points[i+1],d0:i*.6,d1:(i+1)*.6,width:0,side:false})).concat(Array.from({length:100},(_,i)=>({a:new Vector3(i*.1,0,-50),b:new Vector3((i+1)*.1,0,-50),d0:50+i*.1,d1:50+(i+1)*.1,width:2.2,side:true})));}
test('indexed path queries exactly preserve full-scan main, side and corridor results',()=>{
 const segments=fixture(),index=createPathIndex(segments,{width,maxWidth:7.65});let seed=42;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(let i=0;i<1200;i++){const p=new Vector3(rnd()*130-65,rnd()*20,-rnd()*450);for(const [main,corridor]of [[true,false],[false,false],[false,true]]){const expected=reference(segments,p,main,corridor),actual=index.nearest(p,main,corridor);assert.ok(Math.abs(actual.distance-expected.distance)<1e-9);assert.ok(actual.point.distanceTo(expected.point)<1e-9);assert.ok(Math.abs(actual.offset-expected.offset)<1e-9);assert.ok(Math.abs(actual.signed-expected.signed)<1e-9);assert.equal(actual.side,expected.side);assert.equal(actual.width,expected.width);}}
});
test('equal-distance overlapping segments keep authored order regardless of tree ordering',()=>{
 const a=new Vector3(0,0,0),b=new Vector3(0,0,-10),segments=Array.from({length:30},(_,i)=>({a:a.clone(),b:b.clone(),d0:i*10,d1:i*10+10,width:0,side:i%2===1})),index=createPathIndex(segments,{width,maxWidth:7.65});
 assert.equal(index.nearest(new Vector3(2,0,-4)).distance,4);assert.equal(index.nearest(new Vector3(0,0,-4),true).distance,4);
});
