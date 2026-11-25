import fs from 'node:fs/promises';
import * as T from 'three';
import assert from 'node:assert/strict';
globalThis.document={createElement(){const canvas={width:0,height:0};const ctx={fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},stroke(){},putImageData(){},createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},getImageData(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4).fill(128)};}};canvas.getContext=()=>ctx;return canvas;}};
// Instrument a temporary copy of the exact authored source. The captured
// triangles are those passed to add(), not a separately reconstructed mesh.
let source=await fs.readFile('scripts/build-shuoyu.source.js','utf8');
function inject(before,after){assert.ok(source.includes(before),'Missing instrumentation anchor: '+before);source=source.replace(before,after);}
inject('seed=1206;','seed=1206;const audits=[];');
inject("function surface(mat,fn,cols,rows,color,boneName='Breast',uvFn=null){","function surface(mat,fn,cols,rows,color,boneName='Breast',uvFn=null,auditSpec=null){");
inject('add(actualMaterial,p,idx,uv,colors,boneName);','add(actualMaterial,p,idx,uv,colors,boneName);audits.push({mat:actualMaterial,boneName,p,idx,cols,rows,...auditSpec});');
inject('},cols,rows,color,boneName);',"},cols,rows,color,boneName,null,{kind:'ellipsoid',center:center.toArray(),scale:scale.toArray()});");
inject('},sides,(points.length-1)*3,color,boneName);',"},sides,(points.length-1)*3,color,boneName,null,{kind:'tube',line:points.map(p=>p.toArray())});");
inject("add('skin',p,idx,uv,colors,boneName);","add('skin',p,idx,uv,colors,boneName);audits.push({kind:'scute',mat:'skin',boneName,p,idx,line:[center.clone().addScaledVector(t,-length).toArray(),center.clone().addScaledVector(t,length).toArray()]});");
inject("add('down',wp,wi,wu,wc,name,ww);","add('down',wp,wi,wu,wc,name,ww);audits.push({kind:'wing-core',mat:'down',boneName:name,p:wp,idx:wi,line:[[s*.205,.705,.045],[s*.290,.395,.335]]});");
inject('return group;','group.userData.orientationAudit=audits;return group;');
const temporary='docs/v8/character/orientation-instrumented.mjs';await fs.writeFile(temporary,source);const{buildShuoyu}=await import('../'+temporary);
const report={at:new Date().toISOString(),method:'Exact source triangles instrumented at add(): face cross-product dotted against independent axis/ellipsoid outward vectors. Degenerate pole triangles excluded. Double-sided feather planes excluded from solid orientation claims.',lods:[]};
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),centre=new T.Vector3(),radial=new T.Vector3(),nearest=new T.Vector3(),candidate=new T.Vector3();
for(const detail of [1,.58]){
 const root=buildShuoyu({detail}),groups=[];
 for(const g of root.userData.orientationAudit){
  let kind=g.kind,origin=null,scale=null,line=null;
  if(kind==='ellipsoid'){origin=new T.Vector3(...g.center);scale=new T.Vector3(...g.scale);}
  else if(g.line)line=g.line.map(p=>new T.Vector3(...p));
  else if(g.mat==='down'&&g.boneName==='Breast'){kind='breast-hull';origin=new T.Vector3(0,.53,.052);}
  else if(g.mat==='down'&&g.boneName==='Head'){kind='head-hull';origin=new T.Vector3(0,.927,-.153);}
  else if(g.mat==='down'&&g.boneName==='Neck'){kind='neck-hull';line=Array.from({length:g.rows+1},(_,j)=>{const p=new T.Vector3();for(let i=0;i<g.cols;i++)p.add(new T.Vector3().fromArray(g.p,(j*(g.cols+1)+i)*3));return p.multiplyScalar(1/g.cols);});}
  else continue;
  let outward=0,inward=0,tangent=0,degenerate=0,lowest=1;
  for(let i=0;i<g.idx.length;i+=3){a.fromArray(g.p,g.idx[i]*3);b.fromArray(g.p,g.idx[i+1]*3);c.fromArray(g.p,g.idx[i+2]*3);normal.subVectors(b,a).cross(radial.subVectors(c,a));if(normal.lengthSq()<1e-18){degenerate++;continue;}normal.normalize();centre.copy(a).add(b).add(c).multiplyScalar(1/3);
   if(origin){radial.copy(centre).sub(origin);if(scale)radial.divide(new T.Vector3(scale.x*scale.x,scale.y*scale.y,scale.z*scale.z));}
   else{let distance=Infinity;for(let j=0;j<line.length-1;j++){new T.Line3(line[j],line[j+1]).closestPointToPoint(centre,true,candidate);const d=candidate.distanceToSquared(centre);if(d<distance){distance=d;nearest.copy(candidate);}}radial.copy(centre).sub(nearest);}
   const dot=normal.dot(radial.normalize());lowest=Math.min(lowest,dot);if(dot>1e-8)outward++;else if(dot< -1e-8)inward++;else tangent++;
  }
  groups.push({kind,bone:g.boneName,outward,inward,tangent,degenerate,lowest});
 }
 const totals=groups.reduce((r,g)=>({outward:r.outward+g.outward,inward:r.inward+g.inward,tangent:r.tangent+g.tangent,degenerate:r.degenerate+g.degenerate}),{outward:0,inward:0,tangent:0,degenerate:0});report.lods.push({detail,totals,groups});
}
await fs.writeFile('docs/v8/character/orientation-audit.json',JSON.stringify(report,null,2));assert.ok(report.lods.every(l=>l.totals.inward===0),'Solid character surfaces must face away from their own axis/centre');console.log(JSON.stringify(report.lods.map(l=>({detail:l.detail,groups:l.groups.length,...l.totals})),null,2));

