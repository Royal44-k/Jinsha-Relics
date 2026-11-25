import {Vector3} from 'three';

/** Static AABB tree over authored path segments. Queries retain the original
 * exact segment projection, corridor metric and first-in-order tie rule. */
export function createPathIndex(segments,{width,maxWidth=7.65}){
 const entries=segments.map((s,id)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z;return {s,id,dx,dz,lengthSquared:dx*dx+dz*dz,length:Math.hypot(dx,dz),minX:Math.min(s.a.x,s.b.x),maxX:Math.max(s.a.x,s.b.x),minZ:Math.min(s.a.z,s.b.z),maxZ:Math.max(s.a.z,s.b.z)};});
 function build(items){
  const node={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,maxWidth:0,hasMain:false,left:null,right:null,items:null};
  for(const e of items){node.minX=Math.min(node.minX,e.minX);node.maxX=Math.max(node.maxX,e.maxX);node.minZ=Math.min(node.minZ,e.minZ);node.maxZ=Math.max(node.maxZ,e.maxZ);node.maxWidth=Math.max(node.maxWidth,e.s.width||maxWidth);node.hasMain||=!e.s.side;}
  if(items.length<=8){node.items=items;return node;}
  const x=node.maxX-node.minX>=node.maxZ-node.minZ;items.sort((a,b)=>x?a.minX+a.maxX-b.minX-b.maxX:a.minZ+a.maxZ-b.minZ-b.maxZ);const split=Math.floor(items.length/2);node.left=build(items.slice(0,split));node.right=build(items.slice(split));return node;
 }
 const root=build(entries);
 function nearest(position,mainOnly=false,corridor=false){
  let best=Infinity,bestMetric=Infinity,bestId=Infinity,bx=0,bz=0,bd=0,bw=0,bs=false,bsg=0;
  const bound=node=>{const dx=Math.max(node.minX-position.x,0,position.x-node.maxX),dz=Math.max(node.minZ-position.z,0,position.z-node.maxZ),d2=dx*dx+dz*dz;return corridor?Math.sqrt(d2)-node.maxWidth:d2;};
  function visit(node,lower){
   if(mainOnly&&!node.hasMain||lower>bestMetric+1e-10)return;
   if(node.items){for(const e of node.items){const s=e.s;if(mainOnly&&s.side)continue;
    const t=Math.max(0,Math.min(1,((position.x-s.a.x)*e.dx+(position.z-s.a.z)*e.dz)/e.lengthSquared)),x=s.a.x+e.dx*t,z=s.a.z+e.dz*t,d2=(x-position.x)**2+(z-position.z)**2,d=s.d0+(s.d1-s.d0)*t,metric=corridor?Math.sqrt(d2)-(s.width||width(d)):d2;
    if(metric<bestMetric||metric===bestMetric&&e.id<bestId){bestMetric=metric;bestId=e.id;best=d2;bx=x;bz=z;bd=d;bw=s.width;bs=s.side;bsg=((position.x-x)*(-e.dz)+(position.z-z)*e.dx)/e.length;}
   }return;}
   const left=bound(node.left),right=bound(node.right);if(left<=right){visit(node.left,left);visit(node.right,right);}else{visit(node.right,right);visit(node.left,left);}
  }
  visit(root,bound(root));return {distance:bd,point:new Vector3(bx,0,bz),offset:Math.sqrt(best),width:bw,side:bs,signed:bsg};
 }
 return {nearest};
}
