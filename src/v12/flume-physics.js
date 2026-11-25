export const grains=[
  {name:'粗砂',color:'#cb8957',sink:1.36,size:.050},
  {name:'中砂',color:'#e7cc90',sink:.70,size:.036},
  {name:'细砂',color:'#8bbfc8',sink:.29,size:.025}
];
export const cores=[
  {id:'wan',name:'退水河湾',unlock:1,target:[0,2],story:'洪水初入时的一层粗砂，上方覆着落水后的细砂。'},
  {id:'shoal',name:'双脉浅滩',unlock:3,target:[1,2,1],story:'两次来流把中砂带上浅滩，中间的细层记录了短暂的平静。'},
  {id:'channel',name:'复流古汊',unlock:9,target:[2,0,1,2],story:'先有静水沉积，随后洪峰到来。流势再逐渐转弱。'}
];
export const sample={left:.12,right:1.15,source:-1.98,outlet:3.16};
export function speed(gate){
  const open=Math.min(100,Math.max(0,gate));
  return .026*open+.35*(1-Math.exp(-open/1.8));
}
export function makePour(){
  let seed=137523;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const particles=[];
  for(let i=0;i<36;i++)for(let kind=0;kind<3;kind++){
    particles.push({kind,x:sample.source+(random()-.5)*.15,y:1.54+random()*.07,z:(random()-.5)*.77,
      delay:i*.012+random()*.023,fall:grains[kind].sink*(.91+random()*.18),advection:.96+random()*.08,
      phase:random()*Math.PI*2,radius:grains[kind].size*(.8+random()*.4),state:'waiting'});
  }
  return {particles,time:0,done:false,counts:[0,0,0],before:[0,0,0],after:[0,0,0],landing:[]};
}
// Same released mixture for each trial. Integrate velocity and detect the bed
// crossing inside the step so that displayed and recorded grains coincide.
export function advancePour(batch,dt,gate,depositHeight=0){
  if(batch.done)return;
  const start=batch.time;batch.time+=dt;const u=speed(gate);
  let remaining=0;
  for(const p of batch.particles){
    if(p.state==='bed'||p.state==='out')continue;
    const step=Math.max(0,batch.time-Math.max(start,p.delay));
    if(!step){remaining++;continue;}
    p.state='moving';
    const x=p.x,y=p.y;
    const dx=u*p.advection*(1+.027*Math.sin(start*3+p.phase))*step;
    const dy=-p.fall*step;
    const nx=x+dx,ny=y+dy;
    const bed=.075+p.radius*.55,top=bed+depositHeight;
    let floor=bed,f=Infinity;
    if(depositHeight>0&&ny<=top){
      const atTop=Math.max(0,(top-y)/dy),hitX=x+dx*atTop;
      if(hitX>=sample.left&&hitX<=sample.right){f=atTop;floor=top;}
      else if(x<sample.left&&nx>=sample.left){
        const atFace=(sample.left-x)/dx;
        if(y+dy*atFace<=top){f=atFace;floor=top;}
      }
    }
    if(!Number.isFinite(f)&&ny<=bed)f=Math.max(0,(bed-y)/dy);
    if(f<=1){
      p.x=x+dx*f;p.y=floor;
      if(p.x>=sample.outlet){p.state='out';batch.after[p.kind]++;continue;}
      p.state='bed';
      if(p.x<sample.left)batch.before[p.kind]++;
      else if(p.x>sample.right)batch.after[p.kind]++;
      else{batch.counts[p.kind]++;batch.landing.push({kind:p.kind,x:p.x,z:p.z,time:start+step*f});}
    }else if(nx>=sample.outlet){p.x=sample.outlet;p.y=ny;p.state='out';batch.after[p.kind]++;}
    else{p.x=nx;p.y=ny;remaining++;}
  }
  batch.done=remaining===0;
}
export function sediment(counts){
  const total=counts.reduce((a,b)=>a+b,0),dominant=counts.indexOf(Math.max(...counts));
  return {total,kind:total>=6&&counts[dominant]/total>=.60?dominant:-1};
}
export function flowAdvice(batch,kind){
  if(batch.before[kind]>batch.counts[kind]&&batch.before[kind]>=batch.after[kind])return grains[kind].name+'大多落在窗前。抬高闸门，让水把它送远一些。';
  if(batch.after[kind]>batch.counts[kind])return grains[kind].name+'大多越过了取样窗。降低闸门，让它提早落床。';
  return '目标颗粒已到达窗内，试着让一次投料期间的流速更稳定。';
}
