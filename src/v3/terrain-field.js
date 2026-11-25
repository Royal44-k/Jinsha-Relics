// Shared visible terrain / locomotion field. All dimensions are game fiction.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function traversalHeight(distance,signed,base,length){
 const basin=1-smooth(length*.048,length*.069,Math.abs(distance-length*.215));
 const riverCentre=10.5+2*Math.sin(distance*.027);
 const channel=1-smooth(2.8,6.2,Math.abs(signed-riverCentre));
 let height=Math.min(base,base-(2.45*basin*channel));
 const gorgeLong=1-smooth(4.0,7.6,Math.abs(distance-length*.31));
 const gorgeWide=1-smooth(8,14,Math.abs(signed));
 height-=5.7*gorgeLong*gorgeWide;
 // The bank path has continuous raised ground; bridge surface itself is separate.
 const rice= (1-smooth(8,12,Math.abs(distance-length*.55))) * (1-smooth(3.8,5.5,Math.abs(signed+11)));
 height=height*(1-rice)+.05*rice;
 return height;
}
