// The water ribbon must cover the excavated bed all the way to dry ground.
// Its final translucent edge lives underneath the bank, not over a deep bed.
export function riverBankExtent({point,normal,center,side,minimum,groundAt,waterLevel=-.2}){
 const maximum=minimum+3.6;
 for(let extent=minimum;extent<=maximum;extent+=.2){
  const x=point.x+normal.x*(center+side*extent),z=point.z+normal.z*(center+side*extent);
  if(groundAt(x,z)>=waterLevel+.03)return Math.min(maximum,extent+.9);
 }
 // A gorge can have no bank in this section. Bound the ribbon locally rather
 // than flooding every low point of the intentionally traversable gorge.
 return maximum;
}
