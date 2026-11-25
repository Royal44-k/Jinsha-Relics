/** Static XZ broadphase. Entries keep their authored order; queries only prune
 * cylinders whose complete horizontal footprint cannot reach the sample. */
export function createCylinderIndex(cylinders,cellSize=6){
 const cells=new Map(),seen=new Uint32Array(cylinders.length);let stamp=0;
 for(let id=0;id<cylinders.length;id++){
  const c=cylinders[id];
  for(let x=Math.floor((c.x-c.r)/cellSize);x<=Math.floor((c.x+c.r)/cellSize);x++)for(let z=Math.floor((c.z-c.r)/cellSize);z<=Math.floor((c.z+c.r)/cellSize);z++){
   const key=x+','+z;let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(id);
  }
 }
 function query(x,z,radius,out){
  out.length=0;stamp=(stamp+1)>>>0;if(stamp===0){seen.fill(0);stamp=1;}
  for(let ix=Math.floor((x-radius)/cellSize);ix<=Math.floor((x+radius)/cellSize);ix++)for(let iz=Math.floor((z-radius)/cellSize);iz<=Math.floor((z+radius)/cellSize);iz++){
   const bucket=cells.get(ix+','+iz);if(!bucket)continue;
   for(const id of bucket){if(seen[id]===stamp)continue;seen[id]=stamp;const c=cylinders[id];if(Math.abs(c.x-x)<=c.r+radius&&Math.abs(c.z-z)<=c.r+radius)out.push(id);}
  }
  out.sort((a,b)=>a-b);return out;
 }
 return {query};
}
