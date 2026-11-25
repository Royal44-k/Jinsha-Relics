import {observations} from './observations.js';
export const saveKey='jinsha-ancient-shu-v11';
export const chapterIds=['river-trench','paleochannel','root-survey','jade-cut','clay-fit','bronze-shadow','ivory-record','sunfoil','nine-posts'];
export function validTriptych(value){
  return Array.isArray(value)&&value.length===3&&
    [0,1,2].every(row=>chapterIds.slice(row*3,row*3+3).includes(value[row]))?value.slice():[];
}
export function validFilm(value){
  return Array.isArray(value)&&value.length===3&&value.every(s=>typeof s==='string'&&s.length<=32810&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(s))?value.slice():[];
}
export function restore(raw){
  let data;try{data=JSON.parse(raw)}catch{}
  const record={completed:[],ending:false,started:false,muted:false,quality:'auto',inscription:'',observations:[],photos:[],fieldTriptych:[],revisits:{}};
  if (!data || data.version!==1)return record;
  for(const id of chapterIds){if(data.completed?.[record.completed.length]!==id)break;record.completed.push(id);}
  for(const id of record.completed){
    const count=data.revisits?.[id];
    if(Number.isSafeInteger(count)&&count>0)record.revisits[id]=count;
  }
  record.started=!!data.started||record.completed.length>0;
  record.ending=record.completed.length===9&&data.ending===true;
  if(record.ending)record.fieldTriptych=validTriptych(data.fieldTriptych);
  if(record.ending && ['让证据保有原来的位置','让想象留下可辨的笔迹'].includes(data.inscription))record.inscription=data.inscription;
  if(Array.isArray(data.observations))record.observations=observations.filter(n=>data.observations.includes(n.id)&&n.count<=record.completed.length).map(n=>n.id);
  if(record.completed.includes('ivory-record'))record.photos=validFilm(data.photos);
  if(['auto','economy','high'].includes(data.quality))record.quality=data.quality;
  record.muted=data.muted===true;return record;
}
export function secureRecord(record,id) {
  if(record.completed.length>=chapterIds.length||chapterIds[record.completed.length]!==id)return false;
  record.completed.push(id);record.started=true;return true;
}
export function encode(record) {return JSON.stringify({version:1,...record});}
export function mergeArchive(local,stored,changed={}){
  const revisits={};
  for(const id of chapterIds){
    const older=stored.revisits?.[id]||0;
    const count=Math.max(local.revisits?.[id]||0,older+(changed.revisited===id?1:0));
    if(count)revisits[id]=Math.min(Number.MAX_SAFE_INTEGER,count);
  }
  const merged={...local,
    revisits,
    started:local.started||stored.started,ending:local.ending||stored.ending,
    completed:[...(local.completed.length>=stored.completed.length?local.completed:stored.completed)],
    observations:[...new Set([...stored.observations,...local.observations])],
    photos:changed.photos&&local.photos.length?local.photos:(stored.photos.length?stored.photos:local.photos),
    fieldTriptych:changed.fieldTriptych&&validTriptych(local.fieldTriptych).length?local.fieldTriptych:
      (validTriptych(stored.fieldTriptych).length?stored.fieldTriptych:local.fieldTriptych),
    inscription:changed.inscription&&local.inscription?local.inscription:(stored.inscription||local.inscription),
    quality:changed.quality?local.quality:stored.quality,muted:changed.muted?local.muted:stored.muted
  };
  return restore(encode(merged));
}
export const phases=['沿河踏查','循器访工','以物见人'];
export const rankNames=['识土','识水','识光'];
export const skillLevel = count => count>=6?2:count>=3?1:0;
export const travelLines=[
  '木桩后头有点不一样。咱们飞低一点，贴着土壁看看。',
  '从上面看得真清楚！那道砂带一直弯向河心。走，我们去芦湾解竹排。',
  '你看，东岸坡上那团黑影，像不像树根？我先飞过去，等你一起看。',
  '等等，斜棚里那块玉上有条细缝。是谁切到一半，把绳子搁下了？',
  '这个口规先带着。你看，前面席子上那些陶片，好像少了半边。',
  '我可不敢落在那只铜鸟尾巴上，太薄啦。把刚修好的陶托也带过来吧。',
  '西岸棚子底下露出了一截象牙。先拍照，好不好？我想记住它原来躺在哪儿。',
  '那边有一盏灯！我想知道，把光挪到金箔后面，还能不能看见那四只鸟。',
  '终于到高台了。把测绳递给我一头，咱们看看，这几排柱洞究竟朝哪边。'
];
export const siteFacts=[
  '金沙古河道曾有乌木沉积。地层中物件的上下关系可以帮助研究者理解堆积先后。',
  '考古发掘揭露了金沙的古河道。本次行舟、水位与航线是为理解河岸关系设计的模拟。',
  '金沙遗址发现过大型树根遗迹。研究者通过木材解剖特征鉴定过秋枫。关卡把这类观察简化为切片比对，树冠生长是生态想象。',
  '金沙出土了多种玉器。此处用水、磨料与往复运动演示一种加工原理。',
  '金沙发现过陶器、窑址与房址。接合断口能够说明碎片怎样构成一件器物。',
  '铜鸟是金沙青铜器中的动物造型。烁羽的羽冠与性格属于本作创作。',
  '金沙祭祀区发现过大量象牙。位置、方向及与周围遗存的关系也属于记录内容。',
  '太阳神鸟金饰厚约0.2毫米。外圈四鸟与内圈十二道齿状芒旋向相反。',
  '馆方记录的九柱建筑遗迹呈三行三列，东西平均间距约2.9米、南北约1.9米。有研究指出其东南朝向接近冬至日出方位。游戏中的木构和候日情景为推想复原。'
];
