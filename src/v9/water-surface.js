import {Vector3} from 'three';

/** Static XZ index of the actual rendered river ribbon. Nearest-path formulae
 * disagree with a curved ribbon near bends, overlaps and width transitions. */
export function createWaterSurface(mesh,{cellSize=4}={}){
 const cells=new Map(),triangles=[];
 const position=mesh?.geometry?.attributes.position,index=mesh?.geometry?.index;
 if(position){
  mesh.updateWorldMatrix(true,false);
  const points=[new Vector3(),new Vector3(),new Vector3()],count=index?index.count:position.count;
  for(let i=0;i+2<count;i+=3){
   for(let j=0;j<3;j++)points[j].fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
   const [a,b,c]=points,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
   if(Math.abs(den)<1e-10)continue;
   const triangle={ax:a.x,ay:a.y,az:a.z,bx:b.x,by:b.y,bz:b.z,cx:c.x,cy:c.y,cz:c.z,den,
    minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
   triangles.push(triangle);
   for(let x=Math.floor(triangle.minX/cellSize);x<=Math.floor(triangle.maxX/cellSize);x++)for(let z=Math.floor(triangle.minZ/cellSize);z<=Math.floor(triangle.maxZ/cellSize);z++){
    const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(triangle);
   }
  }
 }
 function heightAt(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const bucket=cells.get(Math.floor(x/cellSize)+':'+Math.floor(z/cellSize));if(!bucket)return null;
  let level=null;
  for(const t of bucket){
   if(x<t.minX-1e-7||x>t.maxX+1e-7||z<t.minZ-1e-7||z>t.maxZ+1e-7)continue;
   const a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/t.den;
   const b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/t.den,c=1-a-b;
   if(a< -1e-7||b< -1e-7||c< -1e-7)continue;
   const y=a*t.ay+b*t.by+c*t.cy;if(level===null||y>level)level=y;
  }
  return level;
 }
 return {available:triangles.length>0,heightAt,stats:()=>({triangles:triangles.length,cells:cells.size})};
}
