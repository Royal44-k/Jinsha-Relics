import {Float32BufferAttribute,MathUtils,Vector3} from 'three';

// Sample the two actual triangles in each landscape cell. A second, denser
// mesh can then emerge from the bank without changing its texture or light.
export function makeTerrainSampler(terrain,material){
  const {position,normal,uv,color,bedCover}=terrain.attributes;
  const {width,height,widthSegments:columns,heightSegments:rows}=terrain.parameters;
  const stride=columns+1,xMin=position.getX(0),zMin=position.getZ(0);
  const originalNormal=new Vector3(),bankNormal=new Vector3();
  const va=new Vector3(),vb=new Vector3(),vc=new Vector3();
  let a,b,c,wa,wb,wc;
  function locate(x,z){
    const gx=MathUtils.clamp((x-xMin)*columns/width,0,columns),gz=MathUtils.clamp((z-zMin)*rows/height,0,rows);
    const ix=Math.min(Math.floor(gx),columns-1),iz=Math.min(Math.floor(gz),rows-1);
    const u=gx-ix,v=gz-iz,corner=iz*stride+ix;
    if(u+v<=1){a=corner;b=corner+stride;c=corner+1;wa=1-u-v;wb=v;wc=u;}
    else{a=corner+stride;b=corner+stride+1;c=corner+1;wa=1-u;wb=u+v-1;wc=1-v;}
  }
  function value(attr,channel){
    const n=attr.itemSize;
    return wa*attr.array[a*n+channel]+wb*attr.array[b*n+channel]+wc*attr.array[c*n+channel];
  }
  return {
    heightAt(x,z){locate(x,z);return value(position,1);},
    contactNormal(x,z,out){
      locate(x,z);va.fromBufferAttribute(position,a);
      vb.fromBufferAttribute(position,b).sub(va);vc.fromBufferAttribute(position,c).sub(va);
      return out.crossVectors(vb,vc).normalize();
    },
    applyTo(geometry,offset){
      const p=geometry.attributes.position,normals=geometry.attributes.normal;
      const localUv=geometry.attributes.uv,localColor=geometry.attributes.color;
      const weights=new Float32Array(p.count*4);
      for(let i=0;i<p.count;i++){
        locate(offset.x+p.getX(i),offset.z+p.getZ(i));
        localUv.setXY(i,value(uv,0),value(uv,1));
        localColor.setXYZ(i,value(color,0),value(color,1),value(color,2));
        for(let ch=0;ch<4;ch++)weights[4*i+ch]=value(bedCover,ch);
        const relief=offset.y+p.getY(i)-value(position,1);
        originalNormal.set(value(normal,0),value(normal,1),value(normal,2)).normalize();
        bankNormal.fromBufferAttribute(normals,i);
        originalNormal.lerp(bankNormal,MathUtils.smoothstep(relief,.012,.28)).normalize();
        normals.setXYZ(i,originalNormal.x,originalNormal.y,originalNormal.z);
      }
      geometry.setAttribute('bedCover',new Float32BufferAttribute(weights,4));
    },
    makeMaterial(){
      // Landmark opacity changes during its approach. It owns that state
      // while the terrain supplies its shader, samplers and texture scales.
      const skin=material.clone();skin.onBeforeCompile=material.onBeforeCompile;return skin;
    }
  };
}
