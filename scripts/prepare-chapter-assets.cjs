// Convert the downloaded CC0 originals to bounded, browser-ready textures.
// Sources, authors and MD5 checksums remain in docs/v5/source and the manifest.
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5186/docs/v5/source/texture-conversion.html');const report=[];
 for(const asset of ['rock_face_01','tree_stump_01','fern_02']){
  const dir=`public/assets/v5/${asset}`,gltf=JSON.parse(fs.readFileSync(`${dir}/${asset}.gltf`,'utf8'));
  for(const image of gltf.images){const file=image.uri.replace(/\.webp$/,'.jpg'),archived=`docs/v5/source/original-textures/${asset}/${path.basename(file)}`,source=fs.existsSync(archived)?archived:path.join(dir,file),quality=file.includes('nor_gl')?.93:.86;
   const out=await page.evaluate(async({url,quality})=>{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas'),factor=Math.min(1,1024/Math.max(img.width,img.height));canvas.width=Math.round(img.width*factor);canvas.height=Math.round(img.height*factor);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {width:canvas.width,height:canvas.height,original:[img.width,img.height],base64:canvas.toDataURL('image/webp',quality).split(',')[1]};},{url:source.startsWith('docs/')?'/'+source:`/assets/v5/${asset}/${file}`,quality});
   const target=file.replace(/\.jpg$/,'.webp'),bytes=Buffer.from(out.base64,'base64');fs.writeFileSync(path.join(dir,target),bytes);image.uri=target;
   report.push({asset,source:file,target,original:out.original,width:out.width,height:out.height,quality,sourceBytes:fs.statSync(source).size,bytes:bytes.length,sourceMD5:crypto.createHash('md5').update(fs.readFileSync(source)).digest('hex')});
  }fs.writeFileSync(`${dir}/${asset}.gltf`,JSON.stringify(gltf));
 }
 fs.mkdirSync('public/assets/v5/ground',{recursive:true});
 for(const kind of ['diff','nor_gl']){const source=`docs/v5/source/original-textures/aerial_grass_rock/aerial_grass_rock_${kind}_1k.jpg`,target=`public/assets/v5/ground/aerial_grass_rock_${kind}_1k.webp`,quality=kind==='nor_gl'?.93:.86;
  const data=await page.evaluate(async({source,quality})=>{const img=new Image();img.src='/'+source;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/webp',quality).split(',')[1];},{source,quality});const bytes=Buffer.from(data,'base64');fs.writeFileSync(target,bytes);report.push({asset:'aerial_grass_rock',source,target,quality,bytes:bytes.length,sourceMD5:crypto.createHash('md5').update(fs.readFileSync(source)).digest('hex')});
 }
 fs.writeFileSync('docs/v5/source/asset-conversion.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
