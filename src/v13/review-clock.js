// Each document has its own field clock. A historical workbench can run
// while the retained river or workbench in the parent is stationary.
let heldAt=null;
let idle=0;
const events=new EventTarget();

export const reviewPaused=()=>heldAt!==null;
export const fieldTime=(stamp=performance.now())=>(heldAt??stamp)-idle;
export function holdField(hold){
  if(hold===reviewPaused())return;
  if(hold)heldAt=performance.now();
  else{
    idle+=performance.now()-heldAt;
    heldAt=null;
  }
  events.dispatchEvent(new Event('change'));
  if(!hold)events.dispatchEvent(new Event('resume'));
}
export function onFieldHoldChange(run,signal){
  events.addEventListener('change',run,{signal});
}
export function whenFieldResumes(run,signal){
  if(signal?.aborted)return;
  if(reviewPaused())events.addEventListener('resume',run,{once:true,signal});
  else run();
}
