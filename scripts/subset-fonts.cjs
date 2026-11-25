const fs=require('node:fs');
const {createFont,woff2}=require('fonteditor-core');
(async()=>{
 const content=['index.html','src/main.js','src/data.js','src/v2/main.js','src/v2/journey.js','src/v2/audio.js','src/v3/locomotion.js','src/v3/traversal-world.js',...['v5','v6','v7','v8','v9'].flatMap(version=>fs.readdirSync('src/'+version).filter(n=>n.endsWith('.js')||n.endsWith('.css')).map(n=>'src/'+version+'/'+n))].map(p=>fs.readFileSync(p,'utf8')).join('')+'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 const subset=[...new Set([...content].map(c=>c.codePointAt(0)))];
 await woff2.init();fs.mkdirSync('public/fonts',{recursive:true});
 const font=createFont(fs.readFileSync('C:/Windows/Fonts/NotoSerifSC-VF.ttf'),{type:'ttf',subset,hinting:false,compound2simple:true});
 fs.writeFileSync('public/fonts/jinsha-serif.woff2',font.write({type:'woff2'}));
 console.log('Subset glyphs:',subset.length,'bytes:',fs.statSync('public/fonts/jinsha-serif.woff2').size);
})();
