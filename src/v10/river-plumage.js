import {Color, MathUtils} from 'three';

// The markings follow feather tracts in the exported rest pose. They stay
// attached when a wing unfolds and become the base of the two growth stages.
export function applyRiverPlumage(group) {
  const smooth=MathUtils.smoothstep;
  const mantle=new Color('#685f4e'), slate=new Color('#415b58'), umber=new Color('#5a5148');
  const paint=new Color(),eyeStripe=new Color('#635b50'),brow=new Color('#eee7d0');
  group.traverse(mesh=>{
    if(!mesh.isSkinnedMesh || !/^Shuoyu_(plumage|down|contour)$/.test(mesh.name))return;
    const {position,uv,color,skinIndex}=mesh.geometry.attributes;
    const bones=mesh.skeleton.bones.map(b=>b.name);
    const isFeather=mesh.name!=='Shuoyu_down';
    for(let i=0;i<position.count;i++){
      const bone=bones[skinIndex.getX(i)],x=Math.abs(position.getX(i)),y=position.getY(i),z=position.getZ(i);
      const u=uv.getX(i),v=uv.getY(i);
      // Keep a narrow light shaft and a soft unpigmented edge on each vane.
      const shaft=1-.32*Math.exp(-((u-.5)**2)/.0035);
      const vane=isFeather?shaft*(.77+.23*Math.sin(v*6.4+.6)**2):1;
      let pigment=mantle,amount=0;
      if(bone==='Head'||bone==='Neck'||bone==='Breast'){
        // Darker at the nape and mantle. Face, throat and breast retain ivory.
        const back=bone==='Head'?smooth(z,-.21,-.062):smooth(z,-.055,.17);
        amount=(bone==='Head'?.60:bone==='Neck'?.70:.73)*back*vane;
      }else if(bone==='WingL'||bone==='WingR'||bone.startsWith('Primary')){
        pigment=slate;
        amount=(.41+.41*smooth(z,.05,.41)+.08*smooth(x,.12,.24))*vane;
        if(isFeather)amount*=.86+.14*Math.cos(v*10.8);
      }else if(bone==='Tail'){
        pigment=umber;
        const terminalBand=Math.exp(-((z-.56)**2)/.0012);
        amount=(.49+.18*smooth(z,.30,.54)+.23*terminalBand)*vane;
      }else if(bone==='Crest'){
        amount=.30*smooth(y,1.08,1.22)*vane;
      }
      if(amount>0){
        paint.fromBufferAttribute(color,i).lerp(pigment,Math.min(.92,amount));
        color.setXYZ(i,paint.r,paint.g,paint.b);
      }
      if(bone==='Head'&&x>.060&&z>-.27&&z<-.026){
        // The lateral tract leaves the amber eye socket and tapers under the
        // rear crown. Align markings across the base down and its fine coverts.
        const reach=smooth(z,-.269,-.217)*(1-smooth(z,-.125,-.033))*smooth(x,.061,.105);
        const line=.953+(z+.235)*.118;
        const charcoal=Math.exp(-((y-line)**2)/.00022)*reach;
        const cream=Math.exp(-((y-line-.022)**2)/.000082)*reach;
        paint.fromBufferAttribute(color,i).lerp(eyeStripe,.72*charcoal).lerp(brow,.52*cream);
        color.setXYZ(i,paint.r,paint.g,paint.b);
      }
    }
    color.needsUpdate=true;
  });
}
