import {Vector3} from 'three';

const EPS=1e-5;
const CELL=6;
const width=s=>s.halfX??s.radius;
const depth=s=>s.halfZ??s.radius;
const key=(x,z)=>x*1024+z;

export function timberSolids(list,a,b,radius,hint){
  const length=Math.hypot(b.x-a.x,b.z-a.z);
  const parts=Math.max(1,Math.ceil(length/Math.max(.24,radius*1.25)));
  for(let i=0;i<parts;i++){
    const u=(i+.5)/parts,dy=(b.y-a.y)/parts;
    list.push({x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,
      y:a.y+(b.y-a.y)*u-Math.abs(dy)/2-Math.min(radius,.044),
      height:Math.abs(dy)+2*Math.min(radius,.044),radius:radius+length/(2*parts),hint});
  }
}

// All movement and lens casts use the same physical footprint. A cast starts
// at the bird's feet; height extends upward and radius pads its sides.
export function contactFraction(a,b,s,radius,height,normal,verticalPad=0){
  const x=a.x-s.x,z=a.z-s.z,dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y;
  const bottom=s.y-height-verticalPad,top=s.y+s.height+verticalPad;
  let lo=-Infinity,hi=Infinity,nx=0,ny=0,nz=0;
  if(Math.abs(dy)<EPS){if(a.y<=bottom+EPS||a.y>=top-EPS)return Infinity;}
  else{
    const u=(bottom-a.y)/dy,v=(top-a.y)/dy;
    lo=Math.min(u,v);hi=Math.max(u,v);ny=-Math.sign(dy);
  }
  if(s.halfX!==undefined){
    const hx=s.halfX+radius,hz=s.halfZ+radius;
    if(Math.abs(dx)<EPS){if(Math.abs(x)>=hx-EPS)return Infinity;}
    else{
      const u=(-hx-x)/dx,v=(hx-x)/dx,l=Math.min(u,v);
      if(l>lo){lo=l;nx=-Math.sign(dx);ny=0;}hi=Math.min(hi,Math.max(u,v));
    }
    if(Math.abs(dz)<EPS){if(Math.abs(z)>=hz-EPS)return Infinity;}
    else{
      const u=(-hz-z)/dz,v=(hz-z)/dz,l=Math.min(u,v);
      if(l>lo){lo=l;nz=-Math.sign(dz);nx=ny=0;}hi=Math.min(hi,Math.max(u,v));
    }
  }else{
    const len=dx*dx+dz*dz,r=s.radius+radius,dist=x*x+z*z-r*r;
    if(len<EPS*EPS){if(dist>=-EPS)return Infinity;}
    else{
      const dot=x*dx+z*dz,det=dot*dot-len*dist;if(det<=0)return Infinity;
      const q=Math.sqrt(det),l=(-dot-q)/len;if(l>lo){
        lo=l;nx=(x+dx*l)/r;nz=(z+dz*l)/r;ny=0;
      }
      hi=Math.min(hi,(-dot+q)/len);
    }
  }
  if(hi<=Math.max(0,lo)+EPS||lo>1)return Infinity;
  // A collider may be streamed around an already standing player. Let the
  // body move outward, without allowing an inward stroke through its centre.
  if(lo< -EPS){
    if(normal===null)return Infinity;
    if(dy>0&&Math.abs(dx)+Math.abs(dz)<EPS)return Infinity;
    if(s.halfX!==undefined){
      if(s.halfX+radius-Math.abs(x)<s.halfZ+radius-Math.abs(z)){nx=Math.sign(x)||1;nz=0;}
      else{nx=0;nz=Math.sign(z)||1;}
    }else{const n=Math.hypot(x,z);nx=n?x/n:1;nz=n?z/n:0;}
    ny=0;if(nx*dx+nz*dz>=-EPS)return Infinity;
  }
  normal?.set(nx,ny,nz);return Math.max(0,lo);
}

export function surveyCollision(colliders){
  const buckets=new Map(),nearby=[],seen=new Set();
  let count=-1,fromCell=NaN,toCell=NaN;
  function near(a,b=a,pad=0){
    if(count!==colliders.length){
      buckets.clear();fromCell=NaN;count=colliders.length;
      for(const s of colliders){
        for(let x=Math.floor((s.x-width(s))/CELL);x<=Math.floor((s.x+width(s))/CELL);x++)
          for(let z=Math.floor((s.z-depth(s))/CELL);z<=Math.floor((s.z+depth(s))/CELL);z++){
            const id=key(x,z);if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(s);
          }
      }
    }
    const x0=Math.floor((Math.min(a.x,b.x)-pad)/CELL),x1=Math.floor((Math.max(a.x,b.x)+pad)/CELL);
    const z0=Math.floor((Math.min(a.z,b.z)-pad)/CELL),z1=Math.floor((Math.max(a.z,b.z)+pad)/CELL);
    const start=key(x0,z0),end=key(x1,z1);if(start===fromCell&&end===toCell)return nearby;
    fromCell=start;toCell=end;nearby.length=0;seen.clear();
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const item of buckets.get(key(x,z))??[]){
      if(!seen.has(item)){seen.add(item);nearby.push(item);}
    }
    return nearby;
  }
  const position=new Vector3(),end=new Vector3(),delta=new Vector3(),probe=new Vector3(),normal=new Vector3();
  const result={position,normal,hit:false,reason:''};
  function resolveMotion(from,to,radius){
    position.copy(from);end.copy(to);result.hit=false;result.reason='';
    for(let pass=0;pass<4;pass++){
      let first=Infinity,obstacle=null;
      for(const s of near(position,end,radius)){
        const t=contactFraction(position,end,s,radius,1,probe);
        if(t<first){first=t;normal.copy(probe);obstacle=s;}
      }
      if(!obstacle){position.copy(end);break;}
      result.hit=true;result.reason=obstacle.hint||'前方有实体阻挡。转向从侧面绕行，或在空旷处展翼越过。';
      delta.subVectors(end,position);position.addScaledVector(delta,first).addScaledVector(normal,.0001);
      delta.multiplyScalar(1-first);delta.addScaledVector(normal,-Math.min(0,delta.dot(normal)));
      if(delta.lengthSq()<EPS*EPS)break;
      end.copy(position).add(delta);
    }
    return result;
  }
  return {near,resolveMotion,invalidate(){count=-1;}};
}
