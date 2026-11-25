// Re-register the full-size soil art to exactly the joint/rim used by the first
// excavation. The low-res witness plate was baked by bake-trench-v10.mjs.
export async function registeredDetail(page) {
  return page.evaluate(async () => {
    const {width,height,top,joint}=await import('/src/v10/trench-profile.js');
    const img=new Image();
    img.src='/assets/v10/trench-strata.webp';
    await img.decode();
    function sheet(w,h) {
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      return canvas;
    }
    const sw=img.naturalWidth,sh=img.naturalHeight;
    const reference=sheet(width,Math.round(width*sh/sw));
    const ref=reference.getContext('2d',{willReadFrequently:true});
    ref.drawImage(img,0,0,width,reference.height);
    const small=ref.getImageData(0,0,width,reference.height).data;
    const luma=(x,y)=>{const p=4*(y*width+x);return small[p]*.25+small[p+1]*.58+small[p+2]*.17;};
    const raw=new Int16Array(width),edges=new Int16Array(width);
    for(let x=0;x<width;x++) {
      let highest=-Infinity;
      for(let y=Math.floor(reference.height*.604);y<reference.height*.695;y++) {
        const contrast=luma(x,y-8)+luma(x,y-5)+luma(x,y-2)-luma(x,y+2)-luma(x,y+5)-luma(x,y+9);
        if(contrast>highest){highest=contrast;raw[x]=y;}
      }
    }
    for(let x=0;x<width;x++) {
      const neighbours=[];
      for(let j=-4;j<=4;j++)neighbours.push(raw[Math.max(0,Math.min(width-1,x+j))]);
      edges[x]=neighbours.sort((a,b)=>a-b)[4];
    }
    const source=sheet(sw,sh).getContext('2d',{willReadFrequently:true});
    source.drawImage(img,0,0);
    const pixels=source.getImageData(0,0,sw,sh).data;
    const output=sheet(sw,Math.round(height*sw/width));
    const context=output.getContext('2d');
    const target=context.createImageData(output.width,output.height);
    const rowScale=sh/reference.height;
    for(let i=0;i<output.width;i++) {
      const x=i*width/output.width,xi=Math.floor(x),fract=x-xi;
      const edge=edges[xi]+fract*(edges[Math.min(width-1,xi+1)]-edges[xi]);
      const rim=top(x),contact=joint(x);
      for(let j=Math.ceil(rim*output.height/height);j<output.height;j++) {
        const y=j*height/output.height;
        const ry=y<contact?(y-rim)*edge/(contact-rim):edge+(y-contact)*(reference.height-edge-1)/(height-contact);
        const sy=ry*rowScale,lo=Math.max(0,Math.floor(sy)),hi=Math.min(sh-1,lo+1),mix=sy-lo;
        const p=(lo*sw+i)*4,q=(hi*sw+i)*4,k=(j*output.width+i)*4;
        for(let c=0;c<3;c++)target.data[k+c]=pixels[p+c]+mix*(pixels[q+c]-pixels[p+c]);
        target.data[k+3]=255;
      }
    }
    context.putImageData(target,0,0);
    return output.toDataURL('image/webp',.86);
  });
}
