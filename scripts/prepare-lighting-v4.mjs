import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {FloatType} from 'three';
const bytes=await fs.readFile('docs/v4/source/forest_slope_1k.hdr');
const hdr=new HDRLoader().setDataType(FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const width=512,height=256,output=[Buffer.from('#?RADIANCE\n# Poly Haven Forest Slope, CC0, resampled locally\nFORMAT=32-bit_rle_rgbe\n\n-Y '+height+' +X '+width+'\n')];
for(let y=0;y<height;y++){
 const row=new Uint8Array(width*4);
 for(let x=0;x<width;x++){
  const sum=[0,0,0];let count=0;
  for(let sy=Math.floor(y*hdr.height/height);sy<Math.floor((y+1)*hdr.height/height);sy++)for(let sx=Math.floor(x*hdr.width/width);sx<Math.floor((x+1)*hdr.width/width);sx++){const n=(sy*hdr.width+sx)*4;for(let c=0;c<3;c++)sum[c]+=hdr.data[n+c];count++;}
  for(let c=0;c<3;c++)sum[c]/=count;
  const maximum=Math.max(...sum);if(maximum<1e-12)continue;const exponent=Math.floor(Math.log2(maximum))+1,multiplier=256/Math.pow(2,exponent);
  for(let c=0;c<3;c++)row[c*width+x]=Math.min(255,Math.floor(sum[c]*multiplier));row[width*3+x]=exponent+128;
 }
 output.push(Buffer.from([2,2,width>>8,width&255]));
 for(let c=0;c<4;c++)for(let x=0;x<width;){let run=1;while(x+run<width&&run<127&&row[c*width+x+run]===row[c*width+x])run++;if(run>=4){output.push(Buffer.from([128+run,row[c*width+x]]));x+=run;}else{const start=x;x+=run;while(x<width&&x-start<127){let n=1;while(x+n<width&&n<4&&row[c*width+x+n]===row[c*width+x])n++;if(n>=4)break;x+=Math.min(n,127-(x-start));}output.push(Buffer.from([x-start]),Buffer.from(row.subarray(c*width+start,c*width+x)));}}
}
const result=Buffer.concat(output),target='public/assets/environment/forest-light-512.hdr';await fs.writeFile(target,result);
const verify=new HDRLoader().setDataType(FloatType).parse(result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength));
if(verify.width!==width||verify.height!==height||!verify.data.every(Number.isFinite))throw Error('HDR conversion failed');
const manifest={asset:'Forest Slope',source:'https://polyhaven.com/a/forest_slope',download:'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr',license:'CC0',licensePage:'https://polyhaven.com/license',sourceBytes:bytes.length,sourceMD5:crypto.createHash('md5').update(bytes).digest('hex'),target,bytes:result.length,width,height,method:'Box-filtered linear radiance, Radiance RGBE encoding. Used for environment lighting, not a backdrop image.'};
await fs.writeFile('docs/v4/lighting-asset.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
