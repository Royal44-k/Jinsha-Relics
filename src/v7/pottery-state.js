import {simulationDelta} from '../v8/frame-time.js';

export const POTTERY_PROFILE=Object.freeze([.26,.35,.40,.43,.44,.44,.43,.42,.40,.39,.38,.39,.40]);
export const POTTERY_PATTERNS=Object.freeze(['plain','ripple','seed']);
export const POTTERY_REFERENCES=Object.freeze([
 {id:'river',name:'盛一捧水',profile:[.26,.34,.43,.50,.53,.53,.50,.43,.35,.29,.28,.31,.34]},
 {id:'grain',name:'留一袋谷',profile:[.30,.41,.51,.56,.57,.56,.53,.48,.39,.31,.29,.30,.33]},
 {id:'dawn',name:'接一道晨光',profile:[.23,.26,.29,.32,.34,.37,.40,.43,.46,.49,.52,.55,.58]},
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const profile=value=>Array.isArray(value)&&value.length===13?value.map((n,i)=>Number.isFinite(n)?clamp(n,.18,.68):POTTERY_PROFILE[i]):[...POTTERY_PROFILE];
const pattern=value=>POTTERY_PATTERNS.includes(value)?value:'plain';
const work=value=>({profile:profile(value?.profile),pattern:pattern(value?.pattern)});
export function sanitizePottery(value){
 const works=Array.isArray(value?.works)?value.works.filter(w=>w&&Array.isArray(w.profile)&&w.profile.length===13).slice(-3).map(work):[];
 return {version:1,profile:profile(value?.profile),pattern:pattern(value?.pattern),fired:value?.fired===true,discovered:value?.discovered===true||works.length>0,works,totalMade:Number.isInteger(value?.totalMade)?clamp(value.totalMade,works.length,9999):works.length};
}
export function describePottery(p){const belly=Math.max(...p.slice(2,9)),mouth=p[12];return mouth>belly*.96?'承光的敞口器':mouth<belly*.67?'藏水的束口器':'留谷的圆腹器';}
/** Player-authored form. No target-shape scoring and no state from wall-clock timers. */
export function createPotteryState(saved,onEvent=()=>{}){
 let data=sanitizePottery(saved),firing=false,heat=0,revision=0,edits=0,history=[],stroke=false,strokeSaved=false;
 const emit=type=>onEvent({type,name:type==='fired'?'pot-fired':'pot-change'});
 const changed=()=>{revision++;emit('change');};
 const remember=()=>{if(stroke&&strokeSaved)return;history.push(work(data));history=history.slice(-16);strokeSaved=stroke;};
 function shape(height,amount){
  if(firing||data.fired||!Number.isFinite(height)||!Number.isFinite(amount))return false;
  const h=clamp(height,0,1),delta=clamp(amount,-.075,.075);if(Math.abs(delta)<.00001)return false;
  let moved=false;const next=data.profile.map((r,i)=>{if(i===0)return r;const d=Math.abs(i/12-h),weight=d<.29?Math.exp(-d*d/.018):0,n=clamp(r+delta*weight,.18,.68);if(Math.abs(n-r)>.00001)moved=true;return n;});
  if(moved){remember();data.profile=next;edits++;changed();}return moved;
 }
 function smooth(height){
  if(firing||data.fired||!Number.isFinite(height))return false;const old=[...data.profile];
  remember();data.profile=old.map((r,i)=>i>0&&i<12&&Math.abs(i/12-height)<.25?r*.4+(old[i-1]+old[i+1])*.3:r);edits++;changed();return true;
 }
 return {
  shape,smooth,beginStroke(){stroke=true;strokeSaved=false;},endStroke(){stroke=false;strokeSaved=false;},
  undo(){if(firing||data.fired||!history.length)return false;const previous=history.pop();data.profile=previous.profile;data.pattern=previous.pattern;stroke=false;strokeSaved=false;changed();return true;},
  discover(){if(!data.discovered){data.discovered=true;changed();}},
  setPattern(id){if(firing||data.fired||!POTTERY_PATTERNS.includes(id)||data.pattern===id)return false;remember();data.pattern=id;changed();return true;},
  fire(){if(firing||data.fired)return false;firing=true;heat=0;onEvent({type:'cue',name:'pot-fire',strength:.6});return true;},
  update(dt,live=true){if(!firing||!live)return;heat=Math.min(1,heat+simulationDelta(dt)/7.5);if(heat>=1-1e-8){heat=1;firing=false;data.fired=true;data.works.push(work(data));data.works=data.works.slice(-3);data.totalMade=Math.min(9999,data.totalMade+1);changed();emit('fired');}},
  remake(){if(firing)return false;data.profile=[...POTTERY_PROFILE];data.pattern='plain';data.fired=false;heat=0;edits=0;history=[];stroke=false;changed();return true;},
  snapshot(){return {...sanitizePottery(data),firing,heat,revision,edits,canUndo:history.length>0&&!firing&&!data.fired,name:describePottery(data.profile)};},
  serialize:()=>sanitizePottery(data),
  restore(value){data=sanitizePottery(value);firing=false;heat=0;edits=0;history=[];stroke=false;revision++;},
  reset(){data=sanitizePottery();firing=false;heat=0;edits=0;history=[];stroke=false;revision++;},
 };
}
