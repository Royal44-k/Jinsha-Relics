import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createDetailedRelic } from '../src/v4/relics.js';
const relics=Object.fromEntries(['bird','jade','mask','tiger','sun'].map(id=>[id,createDetailedRelic(id)]));
const hit=(id,origin,direction)=>{const r=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction));return r.intersectObject(relics[id],true).length>0;};
test('all five assets have finite real geometry, UVs and bounded draw calls',()=>{
 for(const [id,g]of Object.entries(relics)){let count=0;g.traverse(o=>{if(!o.isMesh)return;count++;assert.ok(o.geometry.attributes.uv,id+' UVs');for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),id+' position');});assert.ok(count<=15,id+' draw calls');assert.ok(g.userData.bounds.size.every(n=>n>0&&n<5));}
});
test('jade bore transmits a ray completely; four surrounding walls remain solid',()=>{
 assert.equal(hit('jade',[0,4,0],[0,-1,0]),false);for(const [x,z]of [[.37,0],[-.37,0],[0,.37],[0,-.37]])assert.equal(hit('jade',[x,4,z],[0,-1,0]),true);
 // Count connected geometric components, joining duplicate position seams.
 const geo=relics.jade.getObjectByName('Ten hollow tapered carved sections').geometry,p=geo.attributes.position,unique=new Map(),parent=[],ids=[];
 const find=a=>parent[a]===a?a:(parent[a]=find(parent[a]));
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(!unique.has(key)){unique.set(key,parent.length);parent.push(parent.length);}ids.push(unique.get(key));}
 for(let i=0;i<p.count;i+=3){const a=find(ids[i]);parent[find(ids[i+1])]=a;parent[find(ids[i+2])]=a;}
 assert.equal(new Set(parent.map((_,i)=>find(i))).size,10,'exactly ten connected section shells');
});
test('mask eye, mouth and ear openings are geometry holes while cheeks/nose are solid',()=>{
 for(const [x,y]of [[-.60,.10],[.60,.10],[0,-.665],[-1.45,-.30],[1.45,-.30]])assert.equal(hit('mask',[x,y,4],[0,0,-1]),false,`${x},${y} cut`);
 for(const [x,y]of [[0,-.30],[.75,-.40],[-.75,-.40],[0,.70]])assert.equal(hit('mask',[x,y,4],[0,0,-1]),true,`${x},${y} solid`);
});
test('sun center is cut through and a radial sweep resolves twelve rays',()=>{
 assert.equal(hit('sun',[0,0,3],[0,0,-1]),false);assert.equal(hit('sun',[1.475,0,3],[0,0,-1]),true);
 const result=[];for(let i=0;i<360;i++){const a=i*Math.PI/180;result.push(hit('sun',[Math.cos(a)*.91,Math.sin(a)*.91,3],[0,0,-1]));}let starts=0;for(let i=0;i<360;i++)if(result[i]&&!result[(i+359)%360])starts++;assert.equal(starts,12);
 // Four body silhouettes occupy quarter-rotated positions near the outer ring.
 for(let i=0;i<4;i++){const a=i*Math.PI/2,x=-.13,y=1.18;assert.equal(hit('sun',[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),3],[0,0,-1]),false);}
 const phase=radius=>{let x=0,y=0;for(let i=0;i<360;i++){const a=i*Math.PI/180;if(hit('sun',[Math.cos(a)*radius,Math.sin(a)*radius,3],[0,0,-1])){x+=Math.cos(a*12);y+=Math.sin(a*12);}}return Math.atan2(y,x)/12;};
 assert.ok(phase(.72)-phase(.95)<-3*Math.PI/180,'gold ray tips sweep clockwise from their outer bases');
});
test('stone veins are volume-authored vertex colors, mouth is actually open',()=>{
 const mesh=relics.tiger.getObjectByName('Continuous crouching stone tiger with raised neck and carved mouth'),colors=mesh.geometry.attributes.color.array;let lo=1,hi=0;for(const x of colors){lo=Math.min(lo,x);hi=Math.max(hi,x);}assert.ok(hi-lo>.3);assert.equal(hit('tiger',[-1.3,.447,2],[0,0,-1]),false);assert.equal(hit('tiger',[-1,.6,2],[0,0,-1]),true);
});
