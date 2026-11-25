import './gold-mask.css';

export const maskViews = [
  {id:'whole',title:'器物全貌',direction:'正面',label:'一张由金片立起的脸',
    text:'从平额、双眉向下看到鼻翼和颧骨，再看两侧外展的耳。馆藏大金面具在模具上捶揲成形，厚约 0.8 毫米，金片随面部一起起伏。',
    pose:{yaw:-.18,pitch:.065,z:2.43}},
  {id:'eyes',title:'眼口镂孔',direction:'迎光观察',label:'眼与口，是透进去的光',
    text:'让黑色衬底从两个眼眶透过，再看狭长的唇缝。上眼睑向外鼓起，眼下内收，嘴角略有上扬。开口和边缘一起构成了表情。',
    pose:{yaw:.12,pitch:.02,z:1.64,y:.015}},
  {id:'ear',title:'鼻梁与耳垂',direction:'四分之三侧面',label:'一条曲线连起鼻翼与颧骨',
    text:'把面具转向侧光，高鼻与颧骨的起伏就分得开了。耳部向外张开，上方凹下，耳垂另有小孔。沿孔边追过去，能看到金片很薄。',
    pose:{yaw:-.74,pitch:.08,z:1.99,x:-.12,sideLight:true}},
  {id:'back',title:'翻看内面',direction:'内面',label:'同一片黄金，两种表面',
    text:'翻到里面，凸出的面部变成凹陷。馆方记载，外表经过打磨，内面保留较粗糙的质感。在侧光下比较反光的宽窄，可以辨出这道工序。',
    pose:{yaw:Math.PI-.28,pitch:-.10,z:2.32,sideLight:true}}
];

const active=new WeakMap();
function node(tag,cls,text) {
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;
  return n;
}

export function mountGoldMask(host) {
  if(!host?.append)return ()=>{};
  active.get(host)?.();
  const controller=new AbortController();
  const {signal}=controller;
  const root=node('article','gold-mask-room jc');
  root.setAttribute('aria-label','商周大金面具观察展台');
  const figure=node('figure','gold-mask-plate');
  const images=node('div','gold-mask-stills');
  const photo=node('img','');
  photo.decoding='async';
  const live=node('div','jc-model gold-mask-live');
  const caption=node('figcaption','gold-mask-caption');
  const orientation=node('span','');
  const launch=node('button','','开启三维展台');
  launch.type='button';
  caption.append(orientation,launch);
  images.append(photo);figure.append(images,live,caption);
  const copy=node('section','gold-mask-guide');
  const identity=node('small','jc-kicker','成都金沙遗址　／　商周金器');
  const title=node('h4','');
  const description=node('p','gold-mask-reading');
  const views=node('div','gold-mask-views');
  views.setAttribute('role','group');views.setAttribute('aria-label','面具观察点');
  const facts=node('p','gold-mask-measures','馆藏尺寸　长 20.5 厘米　宽 10.4 厘米　高 10.7 厘米');
  const source=node('a','jc-source','成都金沙遗址博物馆 · 商周大金面具 ↗');
  source.href='https://www.jinshasitemuseum.com/node/197';
  source.target='_blank';source.rel='noopener noreferrer';
  const foot=node('small','gold-mask-label','图像与暗室采用同一件游戏复原模型。');
  copy.append(identity,title,description,views,facts,source,foot);
  root.append(figure,copy);host.append(root);

  let done=false,generation=0,stage=null,release=null,selected=maskViews[0];
  function showStill(error=false) {
    generation++;
    release?.();release=null;stage=null;
    live.replaceChildren();
    live.inert=true;
    root.dataset.mode=error?'fallback':'still';
    launch.hidden=false;
    launch.disabled=false;
    launch.textContent=error?'重试三维展台':'开启三维展台';
    orientation.textContent=selected.direction+'　／　'+(error?'静帧观察':'展品静帧');
  }
  function choose(view) {
    selected=view;
    photo.src='/assets/v11/collections/mask-'+view.id+'.webp';
    photo.alt='商周大金面具复原 · '+view.title;
    title.textContent=view.label;description.textContent=view.text;
    orientation.textContent=view.direction+'　／　'+(stage?'暗室实景':'展品静帧');
    for(const b of views.children)b.setAttribute('aria-pressed',String(b.dataset.view===view.id));
    stage?.inspect(view.pose);
  }
  for(const view of maskViews){
    const b=node('button','',view.title);b.type='button';b.dataset.view=view.id;
    b.addEventListener('click',()=>choose(view),{signal});
    views.append(b);
  }
  async function open() {
    if(done || !root.isConnected || ['loading','live'].includes(root.dataset.mode))return;
    const attempt=++generation;
    root.dataset.mode='loading';launch.disabled=true;
    orientation.textContent=selected.direction+'　／　正在布光';
    try {
      const {mountArtifactViewer}=await import('./collection-inspection.js');
      if(done || generation!==attempt || !root.isConnected)return;
      release=mountArtifactViewer(live,'mask','商周大金面具',()=>showStill(),{
        focusCanvas:false,
        onReady:viewer=>{
          if(done || generation!==attempt)return;
          stage=viewer;live.inert=false;root.dataset.mode='live';launch.hidden=true;
          choose(selected);
        },
        onError:()=>{if(!done && generation===attempt)showStill(true);}
      });
    } catch {
      if(!done && generation===attempt)showStill(true);
    }
  }
  launch.addEventListener('click',open,{signal});
  choose(selected);showStill();
  const firstFrame=requestAnimationFrame(open);
  const observer=new MutationObserver(()=>{if(!root.isConnected)cleanup();});
  observer.observe(document.body,{childList:true,subtree:true});
  const dialog=host.closest('dialog');
  function cleanup() {
    if(done)return;
    done=true;generation++;cancelAnimationFrame(firstFrame);
    controller.abort();observer.disconnect();dialog?.removeEventListener('close',cleanup);
    release?.();release=null;stage=null;root.remove();active.delete(host);
  }
  dialog?.addEventListener('close',cleanup,{once:true});
  active.set(host,cleanup);
  return cleanup;
}

