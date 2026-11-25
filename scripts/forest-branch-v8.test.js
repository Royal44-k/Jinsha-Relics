import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {taperedBranch} from '../src/v2/world.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
test('fluted forest wood faces outwards and has no lighting seam',()=>{
 const g=taperedBranch([V(),V(0,5,0)],[.5,.2],24,8),p=g.attributes.position,n=g.attributes.normal;
 for(let i=0;i<g.index.count;i+=3){const a=V().fromBufferAttribute(p,g.index.getX(i)),b=V().fromBufferAttribute(p,g.index.getX(i+1)),c=V().fromBufferAttribute(p,g.index.getX(i+2)),mid=a.clone().add(b).add(c).multiplyScalar(1/3).setY(0);assert.ok(b.sub(a).cross(c.sub(a)).dot(mid)>0);}
 for(let i=0;i<=24;i++)assert.ok(V().fromBufferAttribute(n,i*9).distanceTo(V().fromBufferAttribute(n,i*9+8))<1e-7);
 assert.equal(p.count,225);assert.equal(g.index.count,1152);g.dispose();
});
test('forest rings retain fluting and root flare on the exact authored curve with unchanged UV configuration',()=>{
 const points=[V(),V(.5,2,.3),V(-1,7,.5),V(1,9,1)],radii=[.72,.56,.23,.028],segments=27,sides=11,curve=new T.CatmullRomCurve3(points),g=taperedBranch(points,radii,segments,sides),p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<=segments;i++){const t=i/segments,centre=curve.getPoint(t),tangent=curve.getTangent(t),rIndex=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(rIndex)),radius=T.MathUtils.lerp(radii[k],radii[k+1],rIndex-k);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,flute=1+.10*Math.sin(a*5+t*1.9)+.045*Math.sin(a*9-t*2.8),flare=1+.12*Math.exp(-t*7)*Math.pow(.5+.5*Math.cos(a*4+.7),2),radial=V().fromBufferAttribute(p,i*(sides+1)+j).sub(centre);assert.ok(Math.abs(radial.dot(tangent))<2e-6);assert.ok(Math.abs(radial.length()-radius*flute*flare)<2e-6);assert.ok(Math.abs(uv.getX(i*(sides+1)+j)-j/sides*2)<1e-6);assert.ok(Math.abs(uv.getY(i*(sides+1)+j)-t*curve.getLength()*.47)<1e-6);}}
 g.dispose();
});
