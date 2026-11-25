import * as T from 'three';

function patch(k,across,vertical,vertex,uvAt,kind,tint,reverse=false){
  const coords=[],uv=[],indices=[];
  for(let j=0;j<=vertical;j++)for(let i=0;i<=across;i++){
    const u=i/across,v=j/vertical,p=vertex(u,v);
    coords.push(...p);uv.push(...uvAt(u,v,p));
    if(i<across&&j<vertical){const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;
      if(reverse)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(coords,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();k.shape(g,kind,tint);
}

export function excavation(k){
  const {y,rng,shape,rod,box,coll,perch}=k;
  const baseHeight=k.terrainY??y;
  const left=-2.77,right=2.80;
  const front=x=>-2.68+.10*Math.sin(x*1.38)+.045*Math.cos(x*3.71);
  // A cut made THROUGH a continuous tapered bank. Four shared edges connect
  // the sloping rear ground, flanking shoulders and the three exposed faces.
  function bankTop(x,z){
    const wx=x<.4?(x-.4)/7.75:(x-.4)/11.3;
    const wz=z< -2.60?(z+2.60)/7.15:(z+2.60)/6.35;
    const footprint=Math.max(0,1-wx*wx)*Math.max(0,1-wz*wz);
    const relief=(1.69+.13*Math.sin(x*1.05+z*.63)+.08*Math.cos(z*1.40-x*.76)+.032*Math.sin(x*4+z*3))*footprint**2;
    return baseHeight(x,z)+relief-.018;
  }
  function groundPatch(a,b,zEnd){
    patch(k,Math.max(15,Math.round((b-a)*4.5)),31,(u,v)=>{
      const x=T.MathUtils.lerp(a,b,u),z=T.MathUtils.lerp(-10.1,zEnd(x),v);return [x,bankTop(x,z),z];
    },(u,v,p)=>[p[0]*.37,p[2]*.37],'riverBed',0xc4bb91,true);
  }
  groundPatch(-7.55,left,()=>4.06);groundPatch(left,right,front);groundPatch(right,12,()=>4.06);
  function cutFace(at,normal,length,uvLeft=0,uvRight=1){
    const nx=normal[0],nz=normal[1];
    patch(k,Math.max(20,Math.ceil(length*10)),13,(u,v)=>{
      const [x,z]=at(u),bottom=y(x,z)-.09,top=bankTop(x,z);
      const edgeFade=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      const split=(.031*Math.sin(x*9.1+z*7.4+v*12)+.045*Math.sin(v*21+u*17)+.081*(1-v)**2)*edgeFade;
      return [x+nx*split,T.MathUtils.lerp(bottom,top,v),z+nz*split];
    },(u,v)=>[T.MathUtils.lerp(uvLeft,uvRight,u),v],'profile',0xf6ecdc);
  }
  cutFace(u=>{const x=T.MathUtils.lerp(left,right,u);return [x,front(x)];},[0,1],right-left);
  cutFace(u=>[left,T.MathUtils.lerp(4.06,front(left),u)],[1,0],6.9,.93,.06);
  cutFace(u=>[right,T.MathUtils.lerp(front(right),4.06,u)],[-1,0],6.9,.075,.99);
  // The open southern approach stays at the original ground level. Loose
  // sediment collects at the base of the cuts, never on the central stand.
  for(let i=0;i<102;i++){
    const rear=i<66,x=rear?T.MathUtils.lerp(left+.11,right-.11,rng()):(i%2?left+.09+rng()*.24:right-.09-rng()*.24);
    const z=rear?front(x)+.07+rng()*.36:T.MathUtils.lerp(-2,2.58,rng());
    const r=.026+rng()**2*.108,c=i%3?0xc0a888:0xaa8a66;
    shape(new T.IcosahedronGeometry(1,0),'stone',c,[x,y(x,z)+r*.15,z],[rng()*.3,rng()*6,0],[r*1.4,r*.61,r]);
  }
  for(let i=0;i<19;i++){
    const x=rng()*(right-left)+left,z=front(x)-.04,h=bankTop(x,z);
    const length=.12+rng()*.40;
    k.sweep([[x,h+.012,z],[x+.039,h-length*.43,z+.07],[x-.032,h-length,z+.1]],[.014,.007,.0025],'matte',i%3?0x705b41:0xa38b60);
  }
  for(let i=0;i<68;i++){
    const x=rng()*14-5.1,z=-3.04-rng()*5.0,r=.19+rng()*.27;
    if(i%3===0&&x>1.45&&x<4.2)continue;
    for(let j=0;j<4;j++){
      const px=x+(rng()-.5)*.07,pz=z+(rng()-.5)*.07,h=bankTop(px,pz)-.03,slant=(rng()-.5)*.14;
      rod([px,h,pz],[px+slant,h+r*(.65+rng()*.75),pz+(rng()-.5)*.10],.0095,'matte',i%2?0x899063:0x9a9464,.002,4);
    }
  }
  const steps=[];
  const stairZ=-.67,lip=bankTop(left,stairZ),count=Math.max(4,Math.ceil((lip-y(left,stairZ))/.22));
  for(let i=0;i<count;i++){
    const x=left+.15+i*.31,z=stairZ,h=T.MathUtils.lerp(lip,y(left+.15+.31*count,z),i/count);
    const g=new T.BoxGeometry(.32,h-y(x,z)+.10,1.17),p=g.attributes.position;
    for(let v=0;v<p.count;v++){const xx=p.getX(v),zz=p.getZ(v);p.setY(v,p.getY(v)+.027*Math.sin(xx*14+zz*3+i));}
    g.computeVertexNormals();shape(g,'earth',i%2?0xb99f7a:0xbca785,[x,(h+y(x,z)-.10)*.50,z]);
    steps.push({x,z,h});
  }
  const support=(x,z)=>{
    for(const step of steps)if(Math.abs(x-step.x)<.1601&&Math.abs(z-step.z)<.585)return step.h;
    if(x>=left&&x<=right&&z>front(x))return y(x,z);
    return bankTop(x,z);
  };
  k.surface(-7.55,12,-10.1,4.06,support,true);
  for(const x of [-2.64,-1.76,-.88,0,.88,1.76,2.64]){const z=front(x)-.20;coll(x,z,y(x,z)-.02,bankTop(x,z)-y(x,z),.45);}
  for(const edge of [left,right])for(const z of [-1.84,-.88,.13,1.13]){
    if(edge===left&&z===-.88)continue;
    coll(edge+(edge===left?-.18:.18),z,y(edge,z)-.03,Math.max(.18,bankTop(edge,z)-y(edge,z)),.43);
  }
  const grid=[[left-.29,1.63],[left-.29,-3.05],[right+.22,-3.05],[right+.22,1.63]],tops=[];
  for(const [i,[x,z]] of grid.entries()){
    const b=bankTop(x,z),h=b+.58;tops.push(h);rod([x,b-.055,z],[x,h,z],.043,'wood',0xc7b48c,.034);
    rod([x,h-.13,z],[x,h-.015,z],.036,'matte',0xe5d7ad);
    if(i>0){const [a,c]=grid[i-1];k.sweep([[a,tops[i-1]-.15,c],[(a+x)/2,(tops[i-1]+h)/2-.21,(c+z)/2],[x,h-.15,z]],[.009,.009,.009],'matte',0xbbab87);}
  }
  perch('探方标尺旁的界桩',grid[0][0],tops[0],grid[0][1]);
  const px=-2.27,pz=front(px)+.11,by=y(px,pz);
  for(let i=0;i<14;i++)box([px,by+.067+i*.124,pz],[.099,.124,.042],'matte',i%2?0x4c4a41:0xe7dbc1);
  const x=1.98,z=.51,sy=y(x,z);
  coll(x,z,sy,.35,.35,'筛筐在脚边。侧转绕开，或者轻跃过去。');
  k.pot([x,sy,z],[[.14,0],[.32,.08],[.40,.32],[.42,.37],[.37,.37],[.30,.09]],0x9a784a,.91);
  for(let i=1;i<7;i++)k.ring([x,sy+.055+i*.044,z],.25+i*.022,.011,'matte',i%2?0xb59563:0x815e40);
  rod([1.55,y(1.55,.70)+.055,.70],[2.01,sy+.41,.49],.031,'wood',0xc6a87d);
}
