const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const results=[];
for(const [asset,metadata] of [['rock_face_01','rock-face-files'],['tree_stump_01','tree-stump-files'],['fern_02','fern-02-files']]){
 const official=JSON.parse(fs.readFileSync(`docs/v5/source/${metadata}.json`,'utf8')).gltf['1k'].gltf;
 for(const [name,source] of Object.entries(official.include)){
  const file=name.endsWith('.jpg')?`docs/v5/source/original-textures/${asset}/${path.basename(name)}`:`public/assets/v5/${asset}/${name}`;
  const md5=crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');assert.equal(md5,source.md5,file);results.push({file,md5,verified:true,source:source.url});
 }
 const gltf=JSON.parse(fs.readFileSync(`public/assets/v5/${asset}/${asset}.gltf`,'utf8'));
 for(const entry of [...gltf.buffers,...gltf.images]){assert.ok(!entry.uri.includes('://')&&!entry.uri.includes('..'));assert.ok(fs.existsSync(`public/assets/v5/${asset}/${entry.uri}`));}
}
const grass=JSON.parse(fs.readFileSync('docs/v5/source/aerial-grass-rock-files.json','utf8'));
for(const [key,suffix] of [['Diffuse','diff'],['nor_gl','nor_gl']]){const file=`docs/v5/source/original-textures/aerial_grass_rock/aerial_grass_rock_${suffix}_1k.jpg`,md5=crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');assert.equal(md5,grass[key]['1k'].jpg.md5);results.push({file,md5,verified:true,source:grass[key]['1k'].jpg.url});}
fs.writeFileSync('docs/v5/source/asset-verification.json',JSON.stringify(results,null,2));console.log(`${results.length} official asset checksums match; all glTF dependencies are local and present.`);
