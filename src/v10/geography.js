import { Vector3, MathUtils } from 'three';
import {surveyCollision} from './survey-solids.js';

// The expedition is an interpretive river valley, not a survey of the modern museum.
export const sites = [
  [-10, 34], [4.5, 20], [18.5, 13], [24, 1], [18, -15],
  [5.5, -25], [-17, -33], [-13, -49], [13.5, -58]
];
export const origin = [-11, 40];
export const riverX = z => 3 + 5.4 * Math.sin(z * .074 + .2) + 2.1 * Math.sin(z * .13);
export const riverWidth = z => 3.1 + .65 * Math.cos(z * .085);
// A shelf above the west bank opens into the residential sampling yard.
export const westEdge=z=>-54-18*(1-MathUtils.smoothstep(Math.abs(z+41),8,22));
export function ground(x,z) {
  const bank = Math.abs(x-riverX(z)) - riverWidth(z);
  const field = 1.18 + .39*Math.sin(x*.23 + z*.07) + .47*Math.cos(z*.20) + .14*Math.sin(x*.77+z*.4);
  const ridge = 3.7*Math.exp(-((x+31)**2/76+(z+9)**2/340)) + 3.1*Math.exp(-((x-32)**2/115+(z+39)**2/210));
  const t = MathUtils.smoothstep(bank,-1.55,3.35);
  const shelf=1-MathUtils.smoothstep(Math.hypot(x+61,(z+41)*.93),6.6,11);
  return MathUtils.lerp(-1.85+.17*Math.cos(x*.75+z*.27),MathUtils.lerp(field+ridge,2.12,shelf),t);
}
export function createSurveyWorld() {
  const inward = new Vector3(),wind=new Vector3();
  const colliders=[], perches=[],surfaces=[];
  const physics=surveyCollision(colliders);
  function sample(p) {
    // The footfall and its shadow must land on the drawn triangle. The design
    // height is also used before the landscape is attached (and by map tools).
    const riverbed=world.terrainSurface?.heightAt(p.x,p.z)??ground(p.x,p.z);let h=riverbed;
    for(const support of surfaces){
      if(p.x<support.minX||p.x>support.maxX||p.z<support.minZ||p.z>support.maxZ)continue;
      const top=support.heightAt(p.x,p.z);
      if(support.earth||p.y>=top-.27)h=Math.max(h,top);
    }
    for(const s of physics.near(p)){
      const top=s.y+s.height;
      if(p.y<top-.018||top<=h)continue;
      const x=p.x-s.x,z=p.z-s.z;
      if(s.halfX!==undefined ? Math.abs(x)<=s.halfX&&Math.abs(z)<=s.halfZ : x*x+z*z<=s.radius*s.radius)h=top;
    }
    const west=p.x-westEdge(p.z),east=55-p.x,north=p.z+83,south=55-p.z;
    const d=Math.min(west,east,north,south);
    inward.set(d===west?1:d===east?-1:0,0,d===north?1:d===south?-1:0);
    wind.set(.05,.04,0);
    return {groundHeight:h,waterLevel:h<.02?0:null,waterDepth:h<.02?Math.max(0,-riverbed):0,ceil:15,
      wind,boundary:d<5?{distance:d,inward,message:d===north?'渔汊尽头，芦梢被回流压向南方。沿来路回游，前方已出踏查区。':d===west?(westEdge(p.z)<-58?'脚下的土台收窄了。沿取样旗向东，能回到小院和河岸。':'西面的芦丛已经合拢。循织棚的屋脊向东，回到河岸。'):d===east?'东坡的碎石开始滑落。向西侧转身，石场脚下还有缓坡。':'南岸雾深，已到本次调查的界桩。沿河向北，可看见第一座探方。'}:null};
  }
  const world={sample,resolveMotion:physics.resolveMotion,solidsNear:physics.near,invalidateSolids:physics.invalidate,colliders,perches,surfaces};
  return world;
}
