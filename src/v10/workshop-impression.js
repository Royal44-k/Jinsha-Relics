import * as T from 'three';

// The print is a relief projection of the same model the player just rotated.
// Triangle depth order leaves the near wing, eye boss and broken tail legible.
export function printBird(ctx,art){
  const W=960,H=610,scale=250;
  const frame=document.createElement('div');frame.className='at-print';
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.tabIndex=0;
  canvas.setAttribute('role','application');canvas.setAttribute('aria-label','铜鸟侧影纸，移动探针或点按对应形态');
  const sheet=document.createElement('canvas');sheet.width=W;sheet.height=H;
  const env=sheet.getContext('2d'),g=canvas.getContext('2d');
  const xMap=x=>W*.52+x*scale,yMap=y=>H*.49-y*scale;
  const normalized=p=>({x:xMap(p.x)/W,y:yMap(p.y)/H});
  const paper=env.createImageData(W,H);
  let seed=831;
  function random(){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=4*(y*W+x);
    const weather=Math.cos(x*.012)*Math.cos(y*.009)*3+Math.cos(y*2.4)*1.5;
    const v=random()*15+weather;
    paper.data[i]=189+v;paper.data[i+1]=173+v;paper.data[i+2]=137+v;paper.data[i+3]=255;
  }
  env.putImageData(paper,0,0);
  env.strokeStyle='rgba(70,61,41,.22)';env.strokeRect(22.5,22.5,W-45,H-45);
  env.lineWidth=1;
  for(let i=0;i<70;i++){
    const x=32+i*13;
    env.beginPath();env.moveTo(x,H-31);env.lineTo(x,H-(i%5===0?42:36));env.stroke();
  }
  const inv=art.bird.matrixWorld.clone().invert(),matrix=new T.Matrix4();
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
  const light=new T.Vector3(-.35,.59,.72).normalize(),triangles=[];
  art.bird.traverse(item=>{
    if(!item.isMesh||item.name==='Exhibition support')return;
    const attr=item.geometry.getAttribute('position'),indices=item.geometry.index,count=indices?indices.count:attr.count;
    matrix.multiplyMatrices(inv,item.matrixWorld);
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(attr,indices?indices.getX(i):i).applyMatrix4(matrix);
      b.fromBufferAttribute(attr,indices?indices.getX(i+1):i+1).applyMatrix4(matrix);
      c.fromBufferAttribute(attr,indices?indices.getX(i+2):i+2).applyMatrix4(matrix);
      const n=ab.subVectors(b,a).cross(ac.subVectors(c,a)).normalize();
      if(n.z<.0001)continue;
      const lit=clamp01(.35+n.dot(light)*.63);
      triangles.push({z:(a.z+b.z+c.z)/3,lit,
        xy:[xMap(a.x),yMap(a.y),xMap(b.x),yMap(b.y),xMap(c.x),yMap(c.y)]});
    }
  });
  triangles.sort((a,b)=>a.z-b.z);
  env.lineWidth=.56;env.lineJoin='round';
  for(const {lit,xy} of triangles){
    const ink='rgb('+Math.round(43+lit*54)+','+Math.round(51+lit*56)+','+Math.round(44+lit*43)+')';
    env.fillStyle=env.strokeStyle=ink;env.beginPath();env.moveTo(xy[0],xy[1]);env.lineTo(xy[2],xy[3]);env.lineTo(xy[4],xy[5]);env.closePath();env.fill();env.stroke();
  }
  // A dry transfer picks up short paper fibres through the denser ink.
  env.strokeStyle='rgba(214,196,148,.13)';env.lineWidth=.6;
  for(let i=0;i<18000;i++){
    const x=random()*W,y=random()*H;
    env.beginPath();env.moveTo(x,y);env.lineTo(x+1+random()*2,y+.4);env.stroke();
  }
  env.fillStyle='#55503f';env.font='16px serif';env.fillText('铜鸟  /  正侧影',45,55);
  const targets=art.points.map(normalized);
  const candidates=[
    normalized({x:-1.22,y:.50}),targets[0],normalized({x:-.32,y:.0}),
    targets[1],normalized({x:.15,y:-.24}),targets[2]
  ];
  let probeIndex=-1,lens=null;
  const stamps=[];
  function draw(){
    g.drawImage(sheet,0,0);
    for(const i of stamps){
      const x=targets[i].x*W,y=targets[i].y*H,side=i===0?-1:1,end=x+side*54;
      g.strokeStyle='#953c29';g.fillStyle='#8b3423';g.lineWidth=2.4;g.setLineDash([]);
      g.beginPath();g.arc(x,y,13,0,Math.PI*2);g.stroke();
      g.beginPath();g.moveTo(x+side*13,y);g.lineTo(end,y+13);g.lineTo(end+side*22,y+13);g.stroke();
      g.font='bold 18px serif';g.textAlign=side===1?'left':'right';g.fillText(['目','翼','尾'][i],end+side*25,y+19);
    }
    if(probeIndex>=0){
      const p=candidates[probeIndex],x=p.x*W,y=p.y*H;
      g.strokeStyle='#ffde76';g.lineWidth=4;g.shadowColor='#302819';g.shadowBlur=2;
      g.beginPath();g.arc(x,y,18,0,Math.PI*2);g.moveTo(x-24,y);g.lineTo(x-13,y);g.moveTo(x+13,y);g.lineTo(x+24,y);
      g.moveTo(x,y-24);g.lineTo(x,y-13);g.moveTo(x,y+13);g.lineTo(x,y+24);g.stroke();g.shadowBlur=0;
    }
    if(lens){
      const x=lens.x*W,y=lens.y*H,r=Math.max(43,Math.min(103,38*W/Math.max(1,canvas.clientWidth)));
      const cx=Math.max(r+8,Math.min(W-r-8,x+(x>W*.64?-1:1)*r*1.25)),cy=Math.max(r+8,Math.min(H-r-8,y+(y>H*.36?-1:1)*r*1.28));
      g.save();g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.clip();
      g.fillStyle='#c0b185';g.fillRect(cx-r,cy-r,r*2,r*2);
      g.drawImage(sheet,x-r/2.4,y-r/2.4,r/1.2,r/1.2,cx-r,cy-r,r*2,r*2);
      g.strokeStyle='#f2d49b';g.lineWidth=1.6;g.beginPath();
      g.moveTo(cx-9,cy);g.lineTo(cx-3,cy);g.moveTo(cx+3,cy);g.lineTo(cx+9,cy);g.moveTo(cx,cy-9);g.lineTo(cx,cy-3);g.moveTo(cx,cy+3);g.lineTo(cx,cy+9);g.stroke();g.restore();
      g.lineWidth=4;g.strokeStyle='#69573b';g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();
      g.lineWidth=1;g.strokeStyle='#dfcda6';g.beginPath();g.arc(cx,cy,r-3,0,Math.PI*2);g.stroke();
    }
  }
  frame.append(canvas);ctx.overlay.append(frame);ctx.root.classList.add('at-has-print');draw();
  return {canvas,candidates,showProbe(i){lens=null;probeIndex=i;draw();},magnify(point){probeIndex=-1;lens=point;draw();},stamp(i){stamps.push(i);probeIndex=-1;lens=null;draw();},
    matches(point,index){
      const t=targets[index],r=Math.min(W*.105,Math.max(38,22*W/Math.max(1,canvas.clientWidth)));
      return Math.hypot((point.x-t.x)*W,(point.y-t.y)*H)<r;
    }};
}

function clamp01(value){return Math.max(0,Math.min(1,value));}
