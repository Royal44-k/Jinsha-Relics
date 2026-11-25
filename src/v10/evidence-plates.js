// Original field-book drawings. Scale ticks describe the drawings, not museum measurements.
const TAU=Math.PI*2;
const ink='#4c4637',faint='#9a8866',green='#627c70',brown='#916945',gold='#b28a3b';
const titles=['河床沉积剖面','古河岸线与水势','古根原位取样','切口与砂痕','口沿、器腹和底足','铜鸟支护图','象牙原位摄影索引','金箔透射图例','九柱基线测图'];
const notes=[
  ['浅砂覆于暗泥','细线沿两种颗粒的交界延伸。'],
  ['水入内湾','折返点留在较缓的岸侧。'],
  ['取样位置','从扎入岸土的侧根取得切片。'],
  ['往复走砂','细长砂痕沿切口平行排列。'],
  ['断边相合','器壁的弧度从口沿延续到底足。'],
  ['分散载荷','薄尾悬空，胸腹下设两处支托。'],
  ['三处关系','叠压、断口和层面都留在原位。'],
  ['同心异向','外圈四鸟逆行，内圈十二芒顺旋。'],
  ['柱距与轴向','横纵相邻的孔心之间留有两种间距。']
];
function random(seed){
  let state=seed;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
function line(p,points,color=ink,width=1,close=false,fill=null){
  p.beginPath();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));if(close)p.closePath();
  if(fill){p.fillStyle=fill;p.fill();}if(color){p.strokeStyle=color;p.lineWidth=width;p.stroke();}
}
function path(p,d,fill=null,stroke=ink,width=1){
  const shape=new Path2D(d);if(fill){p.fillStyle=fill;p.fill(shape);}if(stroke){p.strokeStyle=stroke;p.lineWidth=width;p.stroke(shape);}
}
function ellipse(p,x,y,rx,ry,fill=null,stroke=ink,width=1,rot=0){
  p.beginPath();p.ellipse(x,y,rx,ry,rot,0,TAU);if(fill){p.fillStyle=fill;p.fill();}if(stroke){p.lineWidth=width;p.strokeStyle=stroke;p.stroke();}
}
function label(p,text,x,y,size=14,color=ink){
  p.save();p.fillStyle=color;p.font=size+'px "Songti SC",SimSun,serif';p.fillText(text,x,y);p.restore();
}
function leader(p,pts){line(p,pts,faint,.85);ellipse(p,pts[0][0],pts[0][1],2.2,2.2,ink,null);}
function parallel(p,seed,count,extent,color,width=1){
  const rng=random(seed);for(let i=0;i<count;i++){const x=extent[0]+rng()*extent[2],y=extent[1]+rng()*extent[3],d=3+rng()*12;line(p,[[x,y],[x+d,y+d*.2]],color,width);}
}
function clip(p,d,fn){p.save();p.clip(new Path2D(d));fn();p.restore();}
function sectionView(p,rng){
  const colors=['#aca080','#c9b48a','#b99773','#7e7c69','#958570'];
  function horizon(x,row){return 66+row*31+Math.sin(x*.012+row*.17)*8+Math.cos(x*.029+row*.12)*4;}
  for(let row=0;row<5;row++){
    const pts=[];for(let x=44;x<=600;x+=4)pts.push([x,horizon(x,row)]);
    for(let x=600;x>=44;x-=4)pts.push([x,horizon(x,row+1)]);line(p,pts,'#74694e',1,true,colors[row]);
    for(let i=0;i<340;i++){const x=45+rng()*553,y=horizon(x,row)+rng()*28;line(p,[[x,y],[x+1+rng()*(row===1?8:3),y+rng()]],i%4?'#64574558':'#e3d4af93',.8);}
  }
  p.save();p.setLineDash([7,4]);
  const edge=[];for(let x=46;x<600;x+=4)edge.push([x,horizon(x,3)]);line(p,edge,'#e9d5a0',2);p.restore();
  for(const x of [151,410]){const y=horizon(x,3);p.strokeStyle=ink;p.lineWidth=1.4;p.strokeRect(x-21,y-24,42,47);}
  leader(p,[[343,horizon(343,3)],[394,41],[465,41]]);label(p,'泥砂交界',471,45);
}
function riverView(p,rng){
  const outline='M34 164 C130 139 138 55 250 62 C338 66 342 195 436 175 C514 162 529 92 604 93 L604 145 C548 147 534 187 473 211 C344 259 306 121 248 111 C163 95 140 193 34 208 Z';
  path(p,outline,'#92a799',green,1.8);clip(p,outline,()=>{
    for(let i=0;i<39;i++){
      const y=55+i*4;path(p,'M22 '+y+' C142 '+(y+1)+' 141 '+(y-111)+' 253 '+(y-91)+' S354 '+(y+65)+' 451 '+(y+16)+' S548 '+(y-74)+' 616 '+(y-62),null,'#d2d9be86',1);
    }});
  for(let i=0;i<80;i++){const x=42+rng()*546,y=36+rng()*185;if(p.isPointInPath(new Path2D(outline),x,y))continue;line(p,[[x,y],[x+3,y-3],[x+5,y-1]],'#8f8f673d',1);}
  p.save();p.setLineDash([5,4]);path(p,'M67 181 C153 156 170 65 238 87 S328 174 377 178 Q439 202 504 146',null,'#5b6151',1.7);p.restore();
  for(const [x,y] of [[238,87],[377,178],[504,146]])ellipse(p,x,y,4,4,'#d8d0ae',ink,1.3);
  leader(p,[[375,181],[406,99],[464,99]]);label(p,'芦湾测点',470,103);
  line(p,[[503,132],[510,119],[516,132]],green,1.2);
}
function rootsView(p,rng){
  function bough(x,y,angle,breadth,span,depth){
    const pts=[[x,y]];let a=angle;
    for(let j=0;j<6;j++){a+=(rng()-.5)*.26;x+=Math.cos(a)*span/6;y+=Math.sin(a)*span/7;pts.push([x,y]);}
    const edge=(side)=>pts.map(([xx,yy],j)=>{const next=pts[Math.min(j+1,6)],prev=pts[Math.max(j-1,0)],a=Math.atan2(next[1]-prev[1],next[0]-prev[0])+Math.PI/2;return [xx+side*Math.cos(a)*breadth*(1-j/8),yy+side*Math.sin(a)*breadth*(1-j/8)];});
    line(p,[...edge(1),...edge(-1).reverse()],brown,.7,true,depth>1?'#aa9470':'#8c7c60');line(p,pts,'#655b463e',.7);
    if(depth){bough(x,y,a+(rng()-.5)*.24,breadth*.6,span*.56,depth-1);bough(pts[4][0],pts[4][1],a+(rng()<.5?-1:1)*(.40+rng()*.32),breadth*.36,span*.58,depth-1);}
  }
  p.save();p.translate(305,139);p.scale(1,.63);
  for(let i=0;i<14;i++)bough(0,0,i*TAU/14,8+rng()*6,56+rng()*64,3);
  for(let i=16;i>=1;i--)ellipse(p,0,0,i*2.74,i*2.29,i===16?'#aa9475':null,i%3?'#796a4f86':'#796a4fc7',.82,.11);
  p.restore();p.save();p.setLineDash([5,4]);line(p,[[90,206],[521,67]],'#6b796b',1.5);p.restore();
  for(const [x,y] of [[90,206],[521,67]]){line(p,[[x-3,y-6],[x+3,y+6]],ink,1.7);ellipse(p,x,y,3,3,'#f0e4c6',ink);}
  label(p,'侧根取样',531,70);
}
function jadeView(p,rng){
  const slab='M59 191 Q83 121 126 83 Q212 56 328 68 L486 104 536 151 489 188 Q387 199 290 194 L170 218 Z';
  path(p,slab,'#879886',ink,2);clip(p,slab,()=>{
    for(let i=0;i<65;i++){const x=rng()*560,y=rng()*220;path(p,'M'+x+' '+y+' q25 -12 58 -4 t79 -17 q19 -9 51 -3',null,i%5?'#aaba996e':'#465c4e70',i%4===0?1.4:.6);}
    const cut='M102 194 Q236 141 391 108 L440 101 Q331 145 158 202 Z';path(p,cut,'#505f50','#4b5448',1.2);
    for(let k=0;k<11;k++)path(p,'M'+(84+k*4)+' '+(201+k/2)+' Q245 '+(138+k/2)+' 449 '+(99+k*.4),null,'#d7d6b2b0',.9);
  });
  path(p,'M51 155 Q215 125 399 101 Q518 79 585 49',null,brown,4);
  for(let i=0;i<90;i++){const x=70+i*5.55,y=153-(x-50)*.186;line(p,[[x,y+2],[x+2,y-2]],'#d0af74',1);}
  leader(p,[[313,140],[428,61],[482,61]]);label(p,'负砂切缝',487,64);
}
function potView(p,rng){
  const body='M144 64 Q203 53 257 63 L253 71 Q229 77 236 91 C237 114 284 124 277 160 Q269 188 232 200 L230 210 Q205 216 175 208 L176 202 Q139 193 126 172 C111 139 149 113 165 95 Q174 77 147 71 Z';
  path(p,body,'#b58969',ink,2);clip(p,body,()=>{
    for(let i=0;i<30;i++)path(p,'M104 '+(72+i*4.7)+' Q191 '+(88+i*4.7)+' 290 '+(72+i*4.7),null,i%4?'#6f574749':'#dfbf966f',.9);
    parallel(p,45,240,[105,63,170,151],'#69564352',.75);
    line(p,[[181,57],[186,90],[173,105],[185,119],[226,124],[233,146],[214,168],[217,206]],'#5f4b3e',1.6);
    line(p,[[226,124],[251,107],[268,114]],'#5f4b3e',1.2);
  });
  ellipse(p,201,64,56,7,'#5c4e3f',ink,1.1);ellipse(p,201,64,48,3.4,'#a59677','#d8b68b',1);
  path(p,'M355 82 Q391 74 430 81 L424 93 408 94 396 107 375 100 366 91 Z','#b48f72',ink,1.5);
  path(p,'M398 127 L426 117 Q444 133 446 148 L423 170 411 163 394 166 382 143 Z','#b18564',ink,1.5);
  path(p,'M340 179 L361 166 383 177 393 190 383 204 Q362 212 335 200 Z','#a47e62',ink,1.5);
  for(const [x,y,t] of [[430,86,'口沿'],[444,143,'器腹'],[382,198,'底足']]){leader(p,[[x,y],[490,y]]);label(p,t,500,y+4);}
}
function bronzeView(p){
  const bird='M75 132 Q100 115 126 111 Q136 72 169 79 Q195 83 204 106 Q246 100 290 86 Q333 72 370 38 Q364 73 319 111 L362 99 Q346 128 315 149 L377 162 408 188 Q372 183 346 176 L374 201 Q331 184 291 175 Q262 191 209 177 Q170 164 151 136 Q137 123 120 122 L101 135 Q90 142 73 138 Q85 135 92 126 Z';
  path(p,bird,'#7d9181',ink,2);clip(p,bird,()=>{
    parallel(p,719,460,[70,42,347,159],'#46635768',.8);
    for(let i=0;i<7;i++)path(p,'M'+(181+i*6)+' '+(125+i*4)+' Q249 '+(113+i*6)+' '+(366-i*7)+' '+(46+i*9),null,'#496b5d',1);
  });
  ellipse(p,154,103,10,9,'#a2af94','#475849',1.3);ellipse(p,155,102,4.5,4,'#4b5142',null);
  for(const [[x,y],[ex,ey],txt] of [[[86,131],[55,81],'喙'],[[329,80],[422,60],'翼缘'],[[366,175],[435,184],'折尾']]){
    leader(p,[[x,y],[ex,ey],[ex+40,ey]]);label(p,txt,ex+46,ey+5);
  }
}
function ivoryView(p,rng){
  const silhouettes=[
    'M58 177 Q91 143 143 121 Q183 102 214 110 Q168 117 126 143 Q90 165 69 185 Z',
    'M72 99 Q113 106 135 139 Q151 163 177 170 Q144 169 125 148 Q99 118 67 113 Z',
    'M235 114 Q273 112 313 133 L329 146 322 159 Q273 135 231 135 Z',
    'M339 151 Q357 165 386 165 Q364 178 332 163 Z',
    'M413 109 Q465 102 501 128 Q532 154 542 185 Q509 143 482 137 Q453 127 411 131 Z'
  ];
  for(const silhouette of silhouettes){path(p,silhouette,'#d9c6a1',ink,1.5);clip(p,silhouette,()=>parallel(p,1932,1000,[50,100,500,86],'#876b4f61',.75));}
  for(let i=0;i<54;i++){const x=515+rng()*39,y=146+rng()*43;line(p,[[x,y],[x+3,y-4],[x+8,y-1],[x+4,y+2]],'#887958',.7,true,'#a18c66');}
  for(const [x,name] of [[125,'叠压'],[329,'断口'],[522,'层面']]){
    p.save();p.strokeStyle='#6a7161';p.setLineDash([3,3]);p.strokeRect(x-33,104,66,74);p.restore();
    leader(p,[[x,173],[x-9,201],[x+14,201]]);label(p,name,x+19,205);
  }
}
function foilView(p){
  const cx=239,cy=134,r=96;ellipse(p,cx,cy,r,r,'#af8a41',ink,1.6);
  p.save();p.translate(cx,cy);
  p.beginPath();const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];p.moveTo(...polar(67,0));
  for(let i=0;i<12;i++){const a=i*TAU/12;p.bezierCurveTo(...polar(57,a+.06),...polar(42,a+.29),...polar(39,a+.37));p.bezierCurveTo(...polar(52,a+.19),...polar(64,a+.35),...polar(67,a+TAU/12));}
  p.closePath();p.fillStyle='#e7d9b9';p.fill();p.strokeStyle='#796b4f';p.lineWidth=.8;p.stroke();
  for(let i=0;i<4;i++){p.save();p.rotate(i*TAU/4);
    path(p,'M-54 -60 Q-43 -77 -15 -79 Q-11 -89 -5 -84 Q-4 -83 3 -86 Q8 -88 11 -85 L5 -82 Q25 -86 42 -72 L57 -60 45 -67 52 -59 32 -72 Q12 -74 0 -71 Q-9 -66 -14 -73 Q-38 -79 -54 -60 Z','#e7d9b9','#7a6c4d',.7);p.restore();}
  p.restore();leader(p,[[258,44],[370,58],[406,58]]);label(p,'四鸟 · 逆时针',414,63);
  leader(p,[[244,102],[389,156],[412,156]]);label(p,'十二芒 · 顺时针',420,161);
}
function postsView(p){
  const coords=[];for(let row=0;row<3;row++)for(let col=0;col<3;col++)coords.push([124+col*122-row*12,72+row*58+col*7]);
  for(const [i,[x,y]] of coords.entries()){
    p.beginPath();p.roundRect(x-11,y-10,24,23,4);p.fillStyle='#8f806a';p.fill();p.strokeStyle=ink;p.lineWidth=1.6;p.stroke();
    if(i%3===0){p.beginPath();p.roundRect(x-6,y-5,13,13,2);p.strokeStyle='#d2b895';p.stroke();}
    else parallel(p,45+i,9,[x-8,y-8,10,13],'#4d4a3e74',.8);
  }
  p.save();p.setLineDash([5,5]);line(p,[coords[1],coords[4],coords[5]],green,1.6);p.restore();
  label(p,'1.9 m',coords[1][0]+14,coords[1][1]+32);
  label(p,'2.9 m',coords[4][0]+37,coords[4][1]-7);
  line(p,[[485,196],[537,69]],faint,1.1);line(p,[[530,77],[537,69],[538,80]],faint,1.1);label(p,'日出方向示意',468,216);
}
const draws=[sectionView,riverView,rootsView,jadeView,potView,bronzeView,ivoryView,foilView,postsView];
export function evidencePlate(index){
  if(!Number.isInteger(index)||index<0||index>=draws.length)throw new RangeError('Unknown evidence plate index');
  const canvas=document.createElement('canvas');canvas.width=848;canvas.height=256;canvas.className='evidence-plate';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',titles[index]+'。'+notes[index].join('。'));
  Object.assign(canvas.style,{display:'block',width:'100%',height:'auto',maxHeight:'26vh',objectFit:'contain',margin:'12px 0'});
  const p=canvas.getContext('2d'),rng=random(7171+index*751);p.lineJoin='round';p.lineCap='round';
  const sheet=p.createLinearGradient(0,0,848,256);sheet.addColorStop(0,'#e3d7b9');sheet.addColorStop(.48,'#f2e6c9');sheet.addColorStop(1,'#ded0b1');
  p.fillStyle=sheet;p.fillRect(0,0,848,256);
  for(let i=0;i<8000;i++){const x=rng()*848,y=rng()*256;p.fillStyle=i%3?'rgba(99,79,41,.047)':'rgba(255,250,218,.25)';p.fillRect(x,y,1+rng()*3,.7);}
  draws[index](p,rng);
  p.save();p.setLineDash([2,5]);line(p,[[623,29],[623,224]],'#92805d8c',.9);p.restore();
  label(p,titles[index],647,69,19);label(p,notes[index][0],647,111,14,green);
  const info=notes[index][1];Array.from({length:Math.ceil(info.length/12)},(_,j)=>label(p,info.slice(j*12,j*12+12),647,138+j*21,12,'#655f4c'));
  for(let n=0;n<6;n++){p.fillStyle=n%2?'#e5d5af':'#706952';p.fillRect(648+15*n,194,15,4);}
  line(p,[[648,191],[648,200],[738,200],[738,191]],'#706952',.65);label(p,'图版相对标尺',647,219,10,faint);
  return canvas;
}
