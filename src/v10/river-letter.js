import {observations} from './observations.js';
import {evidencePlate} from './evidence-plates.js';

async function imageFrom(src) {
  const img=new Image();img.src=src;await img.decode();return img;
}

function fillPhoto(ctx,img,x,y,w,h) {
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale;
  ctx.drawImage(img,(iw-sw)/2,(ih-sh)/2,sw,sh,x,y,w,h);
}

export async function makeRiverLetter(record) {
  const hero=await imageFrom('/assets/v10/sunrise.webp');
  await document.fonts.ready;
  const hasFilm=record.photos.length===3;
  const prints=hasFilm?await Promise.all(record.photos.map(imageFrom)):[0,3,8].map(evidencePlate);
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1010;
  const c=canvas.getContext('2d'),serif="Jinsha, 'Noto Serif CJK SC', SimSun, serif";
  function write(words,x,y,size,color,font=serif) {
    c.fillStyle=color;c.font=size+'px '+font;c.fillText(words,x,y);
  }
  function line(x,y,w,color) {c.fillStyle=color;c.fillRect(x,y,w,1);}
  c.fillStyle='#e9ddc4';c.fillRect(0,0,1500,1010);
  c.fillStyle='#1b2c29';c.fillRect(0,0,1500,61);
  write('金沙遗存　／　古河岸田野档案',56,40,22,'#eee4ce');
  c.textAlign='right';write('JINSHA  ·  FIELD CORRESPONDENCE',1444,39,15,'#d3b889','Georgia');c.textAlign='left';
  fillPhoto(c,hero,0,61,1500,399);
  const veil=c.createLinearGradient(0,0,960,0);
  veil.addColorStop(0,'rgba(13,31,33,.91)');veil.addColorStop(.55,'rgba(17,32,30,.69)');veil.addColorStop(1,'rgba(24,29,22,0)');
  c.fillStyle=veil;c.fillRect(0,61,1500,399);
  write('给下一位来到河岸的人',71,138,24,'#e9ce99');
  write('河床来信',62,257,100,'#fff3d6');
  write('“'+record.inscription+'。”',69,330,31,'#f0dfba');
  write('烁羽　于九柱遗迹',74,394,20,'#d7ccb6');
  const filmTitles=hasFilm?['叠压关系','象牙断口','泥层接触']:['层位拓页','玉口规','九柱回声谱'];
  write(hasFilm?'滨河象牙埋藏区 · 原位底片':'三处遗存 · 手册图版',58,524,32,'#283b37');
  c.textAlign='right';write(hasFilm?'取自本次调查的三次快门':'馆藏线索与游戏绘图',1443,521,20,'#625e50');c.textAlign='left';
  line(58,543,1386,'#94836a');
  const frameWidth=444,gap=27;
  prints.forEach((img,i)=>{
    const x=58+i*(frameWidth+gap),y=563;
    c.fillStyle='#253230';c.fillRect(x,y,frameWidth,240);
    const w=318,h=204,px=x+(frameWidth-w)/2,py=y+10;
    if(hasFilm)c.drawImage(img,px,py,w,h);
    else {const scale=Math.min((frameWidth-20)/img.width,196/img.height);
      c.drawImage(img,x+(frameWidth-img.width*scale)/2,y+(216-img.height*scale)/2,img.width*scale,img.height*scale);}
    for(let j=0;j<7;j++){c.fillStyle='#b3aa92';c.fillRect(x+12,py+11+26*j,7,10);c.fillRect(x+frameWidth-19,py+11+26*j,7,10);}
    write('0'+(i+1)+'    '+filmTitles[i],x+18,y+230,17,'#e4d7b8');
  });
  write('沿河踏查　·　循器访工　·　以物见人',58,860,27,'#253a34');
  const notes=observations.filter(n=>record.observations.includes(n.id)).map(n=>n.title);
  write(notes.length?'页边还有　'+notes.join('　／　'):'从一线白砂，到九个仍在原地的柱洞。',59,907,22,'#5a6150');
  line(58,939,1385,'#b0a084');
  write('金沙 · 河床来信　　九处记录已合卷',58,978,18,'#75674e');
  const date=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
  c.textAlign='right';write('誊印于 '+date,1444,978,18,'#75674e');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('无法生成来信')),'image/png'));
}
