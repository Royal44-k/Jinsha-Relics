import {contactFraction} from './survey-solids.js';

// A small lens envelope keeps the near plane on the player's side of a solid.
export function cameraReach(aim,eye,colliders) {
  let end=1;
  for(const solid of colliders){
    const contact=contactFraction(aim,eye,solid,.16,0,null,.12);
    if(contact<end)end=Math.max(.07,contact-.045);
  }
  return end;
}