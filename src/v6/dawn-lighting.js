import {Color,MathUtils} from 'three';

const dawn={sky:'#668a99',fog:'#b9ac92',sunColor:'#ffe0a6',hemiSky:'#d2d6c0',hemiGround:'#3e4934',sunIntensity:2.25,hemiIntensity:.98,environmentIntensity:.4,exposure:1.04,night:.38};
const colour=new Color(),target=new Color();
/** The completed bay warms gradually; earlier chapters retain their own light. */
export function dawnLighting(base,amount,progress){
 const blend=MathUtils.clamp(amount,0,1)*MathUtils.smoothstep(progress,.78,.9);
 if(blend<=0)return base;
 const result={...base};
 for(const [key,value] of Object.entries(dawn))result[key]=typeof value==='string'?'#'+colour.set(base[key]).lerp(target.set(value),blend).getHexString():MathUtils.lerp(base[key],value,blend);
 return result;
}
