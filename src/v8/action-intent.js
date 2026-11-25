/** One priority rule for the action label and its actual keyboard/click route. */
export function resolveActionIntent({adventure=null,pottery=null,legacy=null,perch=null,motion={},trialActive=false}={}){
 if(motion.perchApproach)return {kind:'perch-cancel',id:'perch-cancel',key:'R',label:'正在收翼落枝',detail:'R 取消 · 方向键或空格接管'};
 const airborne=!motion.grounded&&!['swimming','diving'].includes(motion.mode);
 // An airborne landing intention wins over an optional collectible at that branch.
 if(airborne&&perch?.canRequest&&!trialActive)return {kind:'perch',id:'perch-'+perch.id,key:'E',label:'收翼落枝 · '+perch.label,detail:'也可按 R 停栖 · 空格重新起飞'};
 if(adventure)return {...adventure,kind:'adventure'};
 if(pottery)return {...pottery,kind:'pottery'};
 if(legacy)return {...legacy,kind:'legacy'};
 return null;
}

export function perchGuidance(candidate,motion={}){
 if(motion.mode==='perched')return {title:'枝头歇息',detail:'R 离枝 · 空格展翼',ready:true};
 if(motion.perchApproach)return {title:'收翼落枝',detail:'方向键或空格可接管',ready:true};
 if(!candidate)return null;
 const name=candidate.label||'树枝';
 if(candidate.canRequest)return {title:name,detail:'R 停栖 · 羽力会在枝头恢复',ready:true};
 const height=Number(candidate.height)||0,distance=Number(candidate.distance)||0;
 if(candidate.reason)return {title:name,detail:candidate.reason+' · '+distance.toFixed(1)+'米',ready:false};
 const vertical=Math.abs(height)>.9?(height>0?'升高一些':'降低一些'):'靠近枝环';
 const fast=Math.abs(Number(candidate.speed)||0)>6;
 return {title:name,detail:(fast?'松开方向，收翼减速':vertical)+' · '+distance.toFixed(1)+'米',ready:false};
}
