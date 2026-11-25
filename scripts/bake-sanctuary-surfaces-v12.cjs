const { chromium }=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
async function bake(){
  const output=path.resolve(__dirname,'../public/assets/v12');
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage();
    const maps=await page.evaluate(()=>{
function noise(seed){
  let a=seed|0;
  return ()=>{a=(Math.imul(a,1664525)+1013904223)|0;return (a>>>0)/4294967296;};
}
function sediment(wall=false) {
  const rng=noise(wall?15221:32551),n=384,canvas=document.createElement('canvas');
  canvas.width=canvas.height=n;const pen=canvas.getContext('2d'),data=pen.createImageData(n,n);
  const scales=[4,9,23,51,117],fields=scales.map(size=>Float32Array.from({length:size*size},rng));
  function sample(u,v,i){
    const size=scales[i],field=fields[i],x=u*size,y=v*size,x0=Math.floor(x),y0=Math.floor(y);
    const fx=x-x0,fy=y-y0,ix=fx*fx*(3-2*fx),iy=fy*fy*(3-2*fy);
    const read=(xx,yy)=>field[(yy%size)*size+(xx%size)];
    return (read(x0,y0)*(1-ix)+read(x0+1,y0)*ix)*(1-iy)+(read(x0,y0+1)*(1-ix)+read(x0+1,y0+1)*ix)*iy;
  }
  const palette=wall?[119,100,76]:[111,91,69];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n;
    const m=(sample(u,v,0)-.5)*26+(sample(u,v,1)-.5)*22+(sample(u,v,2)-.5)*24+(sample(u,v,3)-.5)*20+(sample(u,v,4)-.5)*19+(rng()-.5)*17;
    const vein=wall?Math.pow(.5+.5*Math.sin(v*76+7*sample(u,v,1)+2*sample(u,v,2)),9)*7:0;
    const i=(y*n+x)*4;for(let c=0;c<3;c++)data.data[i+c]=palette[c]+m*(1-c*.07)+vein;
    data.data[i+3]=255;
  }
  pen.putImageData(data,0,0);
  for(let i=0;i<2800;i++){
    const x=rng()*n,y=rng()*n,r=.2+rng()**4*1.9;
    pen.fillStyle=i%3===0?'rgba(203,180,142,.39)':'rgba(49,38,32,.35)';
    pen.fillRect(x,y,r*1.4,r*.75);
  }
  return canvas;
}
function metalTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const pen=canvas.getContext('2d'),image=pen.createImageData(256,256),data=image.data,rng=noise(3297);
  const pits=Array.from({length:33},()=>[rng(),rng(),.017+rng()*.07]);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const u=x/256,v=y/256;let dent=0;
    for(const [px,py,r] of pits){const d=((px-u)**2+(py-v)**2)/r**2;if(d<1)dent+=Math.cos(Math.PI/2*Math.sqrt(d))*18;}
    const i=(y*256+x)*4,val=126+Math.sin(u*91+Math.sin(v*11))*3+rng()*14-dent;
    data[i]=data[i+1]=data[i+2]=val;data[i+3]=255;
  }
  pen.putImageData(image,0,0);
  return canvas;
}
      return [sediment(false),sediment(true),metalTexture()].map(c=>c.toDataURL('image/png').split(',')[1]);
    });
    for(const [i,name] of ['river-sediment','deposit-wall','gold-relief'].entries())
      await fs.writeFile(path.join(output,name+'.png'),Buffer.from(maps[i],'base64'));
  }finally{await browser.close();}
}
bake().catch(e=>{console.error(e);process.exitCode=1;});
