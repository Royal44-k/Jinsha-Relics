export const observations=[
  {id:'submerged-wood',title:'水封古木',at:'古河道渡口',hint:'驶过渡口后，潜入白色水标东侧的深水，沿河床找横卧的木身。',entry:'浮在水面只能辨出树影。潜到木身旁，才看清它是横卧在河床上的。金沙古河道确曾清理出乌木。',count:2},
  {id:'beam-view',title:'梁上的工场',at:'滨岸治玉作坊',hint:'飞到玉棚檐下，在横梁旁按 T 收翼。',entry:'站得比锯架高一些，才看得出水钵、磨料和绳锯怎样围着工位放置。这处工场依加工原理构想。',count:3},
  {id:'absent-posts',title:'缺席的木构',at:'九柱遗迹声场',hint:'飞到柱场上方，离地三米以上，打开辨迹，观察缺失木柱的排列。',entry:'木头不在场，洞口仍给出了位置。空中出现的木柱仅是一种空间假设，柱洞上部形制还有待研究。',count:8}
];
export function matchObservation(count,state,position,read,features) {
  const {log,posts}=features;
  if(count>=2&&state.mode==='diving'&&Math.hypot(position.x-log.x,position.z-log.z)<3.4)return 'submerged-wood';
  if(count>=3&&state.mode==='perched'&&state.perchId==='station-3-0')return 'beam-view';
  if(count>=8&&read&&['flying','gliding'].includes(state.mode)&&position.y-posts.y>=3&&Math.hypot(position.x-posts.x,position.z-posts.z)<6.8)return 'absent-posts';
  return null;
}
