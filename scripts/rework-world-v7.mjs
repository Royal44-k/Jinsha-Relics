import fs from 'node:fs/promises';
const file='src/v2/world.js';let text=await fs.readFile(file,'utf8');
const replace=(from,to)=>{if(!text.includes(from))throw new Error('Missing replacement: '+from.slice(0,90));text=text.replace(from,to);};
replace('const q=p.clone().addScaledVector(n,radius*(1+.095*Math.sin(j*3+i*.64)+.035*Math.cos(j*5-i*1.8)));',`const flute=1+.10*Math.sin(a*5+t*1.9)+.045*Math.sin(a*9-t*2.8),rootFlare=1+.12*Math.exp(-t*7)*Math.pow(.5+.5*Math.cos(a*4+.7),2);
      const q=p.clone().addScaledVector(n,radius*flute*rootFlare);`);
replace('uv.push(j/sides*2,t*6);','uv.push(j/sides*2,t*curve.getLength()*.47);');
replace("const wood=[], leaves=[], h=variant===0?r(15,19):variant===1?r(10,13):r(12,16), drift=V(r(-1.6,1.6),0,r(-1.4,1.4));",`const wood=[], leaves=[], h=variant===0?r(15,19):variant===1?r(10,13):r(12,16), drift=V(r(-1.6,1.6),0,r(-1.4,1.4));
    const stem=[V(),V(.15,h*.22,.08),V(drift.x*.65,h*.48,drift.z*.75),V(drift.x,h*.74,drift.z),V(drift.x*.65,h,drift.z*1.4)],stemRadii=[.72,.56,.37,.23,.028];`);
replace('wood.push(taperedBranch([V(),V(.2,h*.3,.2),V(drift.x,h*.65,drift.z),V(drift.x*.6,h,drift.z*1.4)],[.7,.47,.28,.035],20,8));','wood.push(taperedBranch(stem,stemRadii,27,11));');
replace("const a=b*2.399+variant, y=h*(.43+b*.046), span=r(3.3,5.5)*(variant===1?1.27:variant===0?.8:1)*(1-b*.025), origin=V(drift.x*y/h,y,drift.z*y/h);",`const a=b*2.399+variant, y=h*((variant===0?.46:variant===1?.34:.38)+b*(variant===0?.043:.049)), span=r(3.3,5.5)*(variant===1?1.33:variant===0?.79:1.1)*(1-b*.025), origin=V(drift.x*y/h,y,drift.z*y/h);`);
replace("const pos=end.clone().add(V(r(-1.5,1.5),r(-.35,.65),r(-1.5,1.5)));",`const scatter=V(r(-1.5,1.5),r(-.35,.65),r(-1.5,1.5)),theta=l*2.399,rad=Math.sqrt((l+.5)/23);
          const pos=end.clone().add(V(Math.cos(theta)*rad*1.65+scatter.x*.23,scatter.y*.72+Math.sin(rad*Math.PI)*.28,Math.sin(theta)*rad*1.45+scatter.z*.23));`);
replace('V(r(.28,.58),r(.40,.79),1)','V(r(.42,.75),r(.62,1.02),1)');
replace('treeVariants.push({wood:combine(wood),leaves:combine(leaves)});','treeVariants.push({wood:combine(wood),leaves:combine(leaves),stem,stemRadii});');
replace("for(const list of transforms.tree)for(const t of list){const near=nearest(t.p);if(near.offset<8)colliders.push({x:t.p.x,z:t.p.z,r:.8*t.s.x,height:15*t.s.y});}",`// V7: all reachable stems are solid, including trees beyond the old 8 m
    // shoulder. Height slices follow the exact bent trunk transform; foliage
    // and distant silhouette trees never become an invisible wall.
    for(let variant=0;variant<3;variant++)for(const tr of transforms.tree[variant]){
      if(nearest(tr.p,true).offset>30)continue;
      const asset=plants.trees[variant],curve=new THREE.CatmullRomCurve3(asset.stem),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(tr.rx||0,tr.ry||0,tr.rz||0)),matrix=new THREE.Matrix4().compose(tr.p,q,tr.s);
      for(let j=0;j<12;j++){const u=j/12,k=u*(asset.stemRadii.length-1),i=Math.min(asset.stemRadii.length-2,Math.floor(k)),a=curve.getPoint(u).applyMatrix4(matrix),b=curve.getPoint((j+1)/12).applyMatrix4(matrix),radius=THREE.MathUtils.lerp(asset.stemRadii[i],asset.stemRadii[i+1],k-i)*Math.max(tr.s.x,tr.s.z)*1.22;
       colliders.push({x:(a.x+b.x)*.5,z:(a.z+b.z)*.5,r:radius+Math.hypot(b.x-a.x,b.z-a.z)*.5,minY:Math.min(a.y,b.y)-.025,height:Math.max(a.y,b.y)+.025,treeTrunk:true,reason:'古木的树干挡住了去路，绕过根脚，或振翼从枝间穿行。'});
      }
    }`);
const rootStart=text.indexOf('  // V6: one living, asymmetrical root crown'),rootEnd=text.indexOf('  rootVault(.09);',rootStart)+'  rootVault(.09);'.length;
if(rootStart<0||rootEnd<rootStart)throw new Error('root region');
text=text.slice(0,rootStart)+`  // V7: two living old trees frame an irregular opening. The silhouette is
  // grown upward through forks and broken tips, never a complete rubber arch.
  function rootVault(fraction) {
    const origin=sample(fraction*length),t=tangent(fraction*length),vault=new THREE.Group(),angle=Math.atan2(t.x,t.z);
    vault.name='Ancient buttress root tunnel';vault.position.copy(origin);vault.rotation.y=angle;group.add(vault);
    const wood=[],moss=[];
    const limb=(points,radii,steps=28,sides=12)=>{
      wood.push(taperedBranch(points,radii,steps,sides));
      const curve=new THREE.CatmullRomCurve3(points),count=Math.ceil(curve.getLength()/.5);
      for(let i=0;i<=count;i++){const f=i/count,k=f*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),radius=THREE.MathUtils.lerp(radii[j],radii[j+1],k-j)*1.23,q=curve.getPoint(f).applyAxisAngle(UP,angle).add(origin);if(radius<.09)continue;colliders.push({x:q.x,z:q.z,r:radius,minY:q.y-radius,height:q.y+radius,rootVault:true,reason:'古木在这里分叉，中央留着明亮的开口，也可以从枝间飞越。'});}
    };
    limb([V(-6.8,-.4,-1.2),V(-6.2,2.2,-.9),V(-5.9,5.9,-.2),V(-6.5,9.6,1.1),V(-5.2,13.3,1.3),V(-6.1,17.2,2.8)],[1.65,1.2,.93,.67,.39,.018],52,15);
    limb([V(-5.9,5.9,-.2),V(-4.1,8.1,.1),V(-2.2,9.6,.65),V(.5,10.4,.2),V(2.4,11.5,-.8)],[.76,.51,.31,.16,.018],37,12);
    limb([V(-6.5,9.6,1.1),V(-8.9,11.3,1.3),V(-11.4,11.9,2.5),V(-13.8,13.4,3.2)],[.53,.31,.16,.012],30,10);
    limb([V(-5.2,13.3,1.3),V(-2.5,15.1,2.7),V(-.8,15.9,4.8),V(.6,17.8,4.9)],[.31,.21,.10,.008],25,9);
    limb([V(6.2,-.3,1.5),V(5.7,2.6,1.8),V(6.3,5.3,1.1),V(5.6,9,.5),V(7.4,13.1,.8),V(7.1,16.3,-.8)],[1.38,.98,.73,.52,.26,.016],48,14);
    limb([V(6.3,5.3,1.1),V(4.9,7.9,.4),V(3.2,8.8,-.6),V(2.6,9.4,-2.1)],[.55,.36,.18,.065],31,10);
    limb([V(5.6,9,.5),V(8.8,10.8,.2),V(11.2,10.9,-1.1),V(13.4,12.1,-2.3)],[.47,.29,.13,.012],30,10);
    limb([V(7.4,13.1,.8),V(5.3,14.8,2.8),V(3.5,15.4,3.1),V(2.8,17.3,4.8)],[.27,.19,.09,.008],25,8);
    for(const side of [-1,1])for(let j=0;j<6;j++){
      const a=(-1.15+j*.46),x=side<0?-6.6:6.0,z=side<0?-1.1:1.5,reach=2.6+j*.2;
      limb([V(x,2.7+j*.13,z),V(x+side*Math.cos(a)*.85,.9,z+Math.sin(a)*.8),V(x+side*Math.cos(a)*reach,.17,z+Math.sin(a)*reach),V(x+side*Math.cos(a)*(reach+1.8),-.10,z+Math.sin(a)*(reach+1.8))],[.43-j*.026,.3,.13,.012],22,8);
    }
    // Slender liana follows its host's shape, so it reads as a living detail.
    for(let i=0;i<3;i++){const z=-1.5+i*.7;limb([V(-6.6+i*.1,.1,z),V(-6.0+i*.12,3.8,z+.4),V(-5.4+i*.25,6.8,z+.3),V(-3.1+i*.35,8.8,z+.5)],[.19,.13,.075,.012],26,6);}
    moss.push(taperedBranch([V(-6.9,.8,-.5),V(-6.4,3.1,-.3),V(-6.1,5.6,.1),V(-5.2,7.3,.5)],[.15,.19,.11,.01],28,7));
    mesh(combine(wood),materials.bark,vault).name='Forked old trees with buttress roots';mesh(combine(moss),materials.moss,vault).name='North-facing moss ridge';
    for(const [variant,p,s,rotation] of [[1,V(-5.9,5.7,1.4),V(.85,.77,.80),V(0,.7,0)],[2,V(6.6,5.1,1.1),V(.81,.76,.87),V(0,2.2,0)]]){const g=transformed(plants.trees[variant].leaves,p,s,rotation),o=mesh(g,materials.leaf,vault);o.name='Ancient crown leaf clusters';}
    const tip=new THREE.Mesh(new THREE.CircleGeometry(.067,14),materials.rock);tip.position.set(2.6,9.4,-2.1);tip.quaternion.setFromUnitVectors(V(0,0,1),V(-.6,.6,-1.5).normalize());vault.add(tip);
  }
  rootVault(.09);`+text.slice(rootEnd);
await fs.writeFile(file,text);
let chapters=await fs.readFile('src/v5/chapter-world.js','utf8');
chapters=chapters.replace("import { createLivingLandscape } from '../v6/world-details.js';","import { createLivingLandscape } from '../v6/world-details.js';\nimport { createMicroclimate } from '../v7/microclimate.js';");
chapters=chapters.replace("const living=createLivingLandscape({scene,forest,traversal}),reflection=createRiverReflection({scene,forest});","const living=createLivingLandscape({scene,forest,traversal}),reflection=createRiverReflection({scene,forest}),microclimate=createMicroclimate({scene,forest});");
chapters=chapters.replace("V(-6.6,-.3,-1.4),V(-5.6,1.8,-.8),V(-4.5,4.8,.1),V(-2.9,7.1,.8),V(.4,8.35,.3),V(3.1,7.8,-.65),V(5.7,5.3,-1.1)","V(-5.9,5.9,-.2),V(-4.1,8.1,.1),V(-2.2,9.6,.65),V(.5,10.4,.2),V(2.4,11.5,-.8)");
chapters=chapters.replace('living.update(dt,time,','microclimate.update(dt,time,{position:position||camera?.position||at(.02),camera,quality,reduced});living.update(dt,time,');
chapters=chapters.replace('reflection:reflection.stats(),living:living.stats(),','reflection:reflection.stats(),living:living.stats(),microclimate:microclimate.stats(),');
chapters=chapters.replace('function dispose(){reflection.dispose();living.dispose();','function dispose(){reflection.dispose();living.dispose();microclimate.dispose();');
await fs.writeFile('src/v5/chapter-world.js',chapters);
console.log('V7 arbor and microclimate source integrated.');
