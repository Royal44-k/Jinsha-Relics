import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRootGeometry,createBambooStemGeometry} from '../src/v8/profiled-tubes.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function outward(g,rows,sides){const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<g.index.count;i+=3){const a=V().fromBufferAttribute(p,g.index.getX(i)),b=V().fromBufferAttribute(p,g.index.getX(i+1)),c=V().fromBufferAttribute(p,g.index.getX(i+2)),mid=a.clone().add(b).add(c).multiplyScalar(1/3).setY(0);assert.ok(b.sub(a).cross(c.sub(a)).dot(mid)>0,'tube surface must face outward');}for(let i=0;i<=rows;i++)assert.ok(V().fromBufferAttribute(n,i*(sides+1)).distanceTo(V().fromBufferAttribute(n,i*(sides+1)+sides))<1e-7);}
test('hero-root ripples keep their profile and render their outside surface',()=>{
 const g=createRootGeometry([V(),V(0,5,0)],[.6,.2]);outward(g,30,9);assert.equal(g.attributes.position.count,310);assert.equal(g.index.count,1620);
 const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<=30;i++)for(let j=0;j<=9;j++){const t=i/30,a=j/9*Math.PI*2,r=T.MathUtils.lerp(.6,.2,t)*(1+Math.sin(a*3+t*9)*.16),n=i*10+j;assert.ok(Math.abs(Math.hypot(p.getX(n),p.getZ(n))-r)<2e-6);assert.ok(Math.abs(uv.getX(n)-j/9)<1e-7);assert.ok(Math.abs(uv.getY(n)-t*3)<2e-7);}g.dispose();
});
test('bamboo culms and thin branch tubes keep node radii and color while facing outwards',()=>{
 for(const nodes of [0,8]){const rows=nodes?nodes*6:8,sides=nodes?9:5,tint=new T.Color('#526435'),curve=new T.CatmullRomCurve3([V(),V(0,5,0)]),g=createBambooStemGeometry(curve,5,.065,tint,nodes);outward(g,rows,sides);const p=g.attributes.position,c=g.attributes.color;assert.equal(p.count,(rows+1)*(sides+1));assert.equal(g.index.count,rows*sides*6);
  for(let i=0;i<=rows;i++){const t=i/rows,u=t*nodes,node=nodes?Math.exp(-Math.pow(Math.min(u%1,1-u%1)/.08,2)):0,r=.065*(1-t*.83)*(1+node*.19),color=tint.clone().lerp(new T.Color('#dad7ac'),node*.40);for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;assert.ok(Math.abs(Math.hypot(p.getX(k),p.getZ(k))-r)<2e-6);assert.ok(Math.abs(c.getX(k)-color.r)<1e-7);assert.ok(Math.abs(c.getY(k)-color.g)<1e-7);assert.ok(Math.abs(c.getZ(k)-color.b)<1e-7);}}g.dispose();
 }
});
test('root and bamboo cross sections use the same parameter-space tangent as their centres',()=>{
 const points=[V(),V(.7,.8,.2),V(-.4,3,.4),V(.8,6,1)],curve=new T.CatmullRomCurve3(points);
 for(const [g,rows,sides]of [[createRootGeometry(points,[.6,.5,.3,.1]),30,9],[createBambooStemGeometry(curve,6,.065,new T.Color('#526435'),8),48,9]]){const p=g.attributes.position;for(let i=0;i<=rows;i++){const t=i/rows,centre=curve.getPoint(t),tan=curve.getTangent(t);for(let j=0;j<=sides;j++)assert.ok(Math.abs(V().fromBufferAttribute(p,i*(sides+1)+j).sub(centre).dot(tan))<2e-6);}g.dispose();}
});
