import * as T from 'three';

const parameterFrames=(curve,rows)=>T.Curve.prototype.computeFrenetFrames.call({getTangentAt(t,target){return curve.getTangent(t,target);}},rows,false);
function closeNormalSeam(g,rows,sides){const n=g.attributes.normal,a=new T.Vector3(),b=new T.Vector3();for(let i=0;i<=rows;i++){const first=i*(sides+1),last=first+sides;a.fromBufferAttribute(n,first).add(b.fromBufferAttribute(n,last)).normalize();n.setXYZ(first,a.x,a.y,a.z);n.setXYZ(last,a.x,a.y,a.z);}return g;}

export function createRootGeometry(points,radii){
 const curve=new T.CatmullRomCurve3(points),steps=30,sides=9,frames=parameterFrames(curve,steps),p=[],uv=[],indices=[];
 for(let i=0;i<=steps;i++){const t=i/steps,point=curve.getPoint(t),k=Math.min(radii.length-2,Math.floor(t*(radii.length-1))),u=t*(radii.length-1)-k,r=T.MathUtils.lerp(radii[k],radii[k+1],u);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,cr=r*(1+Math.sin(a*3+t*9)*.16),n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));p.push(point.x+n.x*cr,point.y+n.y*cr,point.z+n.z*cr);uv.push(j/sides,t*3);if(i<steps&&j<sides){const q=i*(sides+1)+j;indices.push(q,q+1,q+sides+1,q+1,q+sides+2,q+sides+1);}}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return closeNormalSeam(g,steps,sides);
}

export function createBambooStemGeometry(curve,h,radius,baseTint,nodeCount=0){
 const rows=nodeCount?nodeCount*6:8,sides=nodeCount?9:5,p=[],idx=[],colors=[],frames=parameterFrames(curve,rows);
 for(let i=0;i<=rows;i++){const t=i/rows,q=curve.getPoint(t),u=nodeCount?t*nodeCount:0,node=nodeCount?Math.exp(-Math.pow(Math.min(u%1,1-u%1)/.08,2)):0,rad=radius*(1-t*.83)*(1+node*.19),tint=baseTint.clone().lerp(new T.Color('#dad7ac'),node*.40);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));p.push(...q.clone().addScaledVector(n,rad).toArray());colors.push(...tint.toArray());if(i<rows&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return closeNormalSeam(g,rows,sides);
}
