import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBranchGeometry} from '../src/v8/branch-geometry.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const points=[V(0,0,0),V(1.5,1,.2),V(3,1.2,0),V(4.7,1.7,0)],radii=[.43,.35,.29,.07],sides=16,steps=36;

test('branch triangles face outward and surface normals meet across the UV seam',()=>{
 const g=createBranchGeometry([V(),V(0,5,0)],[.5,.2],sides,steps),p=g.attributes.position,n=g.attributes.normal,a=V(),b=V(),c=V(),normal=V(),centre=V();
 for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));centre.copy(a).add(b).add(c).multiplyScalar(1/3).setY(0);normal.crossVectors(b.sub(a),c.sub(a));assert.ok(normal.dot(centre)>0,'front face must point away from tube axis');}
 for(let i=0;i<=steps;i++){a.fromBufferAttribute(n,i*(sides+1));b.fromBufferAttribute(n,i*(sides+1)+sides);assert.ok(a.distanceTo(b)<1e-7,'duplicate UV endpoints must share a smooth normal');}
 g.dispose();
});
test('branch rings are perpendicular to the same curve parameter used for their centres',()=>{
 const g=createBranchGeometry(points,radii,sides,steps),curve=new T.CatmullRomCurve3(points),p=g.attributes.position,radial=V();
 for(let i=0;i<=steps;i++){const t=i/steps,centre=curve.getPoint(t),tangent=curve.getTangent(t);for(let j=0;j<=sides;j++){radial.fromBufferAttribute(p,i*(sides+1)+j).sub(centre);assert.ok(Math.abs(radial.dot(tangent))<2e-6,`skewed ring ${i}`);}}
 // Landing remains the authored third knot and radius, even with a smoother mesh.
 const landing=points[2];for(let j=0;j<=sides;j++){radial.fromBufferAttribute(p,24*(sides+1)+j);assert.ok(Math.abs(radial.distanceTo(landing)-.29)<2e-6);}
 g.dispose();
});
test('longitudinal bark UV uses real travel distance instead of arbitrary branch length',()=>{
 const a=createBranchGeometry([V(),V(0,1,0)],[.2,.1]),b=createBranchGeometry([V(),V(0,4,0)],[.2,.1]);
 assert.ok(Math.abs(b.attributes.uv.getY(b.attributes.uv.count-1)/a.attributes.uv.getY(a.attributes.uv.count-1)-4)<1e-7);
 a.dispose();b.dispose();
});
