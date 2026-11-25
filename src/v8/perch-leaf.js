import {BufferGeometry,Float32BufferAttribute} from 'three';

// The existing CC0 island-leaf atlas: second leaf, including its natural edge.
export const PERCH_LEAF_RECT=[175,16,347,417];
export function createPerchLeafGeometry(){
 const p=[],uv=[],index=[],rect=PERCH_LEAF_RECT;
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){
  const t=row/3,u=col/2,fold=Math.sin(t*Math.PI);
  p.push((u-.5)*.43,t,fold*(.08-.04*Math.abs(u*2-1))+t*t*.045);
  uv.push((rect[0]+u*(rect[2]-rect[0]))/1024,1-(rect[3]-t*(rect[3]-rect[1]))/1024);
  if(row<3&&col<2){const a=row*3+col;index.push(a,a+1,a+3,a+1,a+4,a+3);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
