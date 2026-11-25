import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const groups = {
  games: '游戏与关卡', motion: '动效与交互', museum: '遗址与馆藏',
  nature: '鸟类与环境美术', assets: '材质与声音', tech: '渲染与制作'
};

// The key is an exact host/path from the project bibliography. Notes are editorial.
const selected = new Map([
  ['thatgamecompany.com/journey', ['风之旅人 · Journey','远景如何给路？从古河岸望向九柱所在的地平线。']],
  ['www.inklestudios.com/heavensvault', ['天堂之穹 · Heaven’s Vault','读铭文时要靠上下文。金沙将这种推理转成对陶片出土位置的追问。']],
  ['www.mobiusdigitalgames.com/outer-wilds.html', ['星际拓荒 · Outer Wilds','用上个地点留下的问题确定下一站，地图允许自己选点前往。']],
  ['obradinn.com', ['奥伯拉丁的回归 · Return of the Obra Dinn','重建现场需要位置关系。象牙调查要求分别拍下叠压、断口和泥层接触。']],
  ['www.rundisc.io/chants-of-sennaar', ['巴别塔圣歌 · Chants of Sennaar','先观察、再比较和推断。西台浮选用可旋看的标本检查玩家的判断。']],
  ['annapurnainteractive.com/zh-cn/games/gorogoa', ['画中世界 · Gorogoa','组合画面能产生新的解读。终章由玩家选三张现场记录编成展签。']],
  ['505games.com/games/abzu', ['智慧之海 · ABZÛ','随水域变化调整观察高度，重新认识水面、回流和水下的遗物。']],
  ['www.fireproofgames.com/games/the-room-three-2', ['未上锁的房间 3 · The Room Three','从环境走到工位，再凑近一颗稻粒。交互尺度随着要看的细节改变。']],
  ['dont-nod.com/en/games/jusant', ['Jusant · 攀登之旅','地形决定工具何时有用。烁羽可步行、飞过河沟或停栖。']],
  ['ashorthike.com', ['短途徒步旅行 · A Short Hike','把途中遇见的支路接回主线。可先调查西台，再沿河返回。']],
  ['www.inklestudios.com/a-highland-song', ['高地之歌 · A Highland Song','路径选择依赖地貌。用高地、水湾和等高线帮助玩家读懂地图。']],
  ['ustwogames.co.uk/news/the-environment-art-of-alba-a-wildlife-adventure', ['Alba · 环境美术手记','看创作团队如何简化环境形体，给小屏留出观察与单手操作的空间。']],
  ['www.monumentvalleygame.com', ['纪念碑谷 · Monument Valley','从另一个视角读同一组形状，对照柱洞、测绳与遗物的轮廓。']],
  ['showreel.design', ['Showreel Design','从策展目录找 CGI 镜头、声音设计和 UI 动效，比较远景、轮廓与细部的剪辑。']],
  ['sael.net', ['Ryan Sael · 互动实验目录','同一位作者的实时小世界、模拟和讲解，收录灯塔开场、河湾水槽与镜头剖面。']],
  ['sael.net/demo/farewell-light', ['Farewell Light · 灯塔序幕','可启动的实时演示。留意菜单中的远方灯火如何延续到开场镜头。']],
  ['motionsites.ai', ['MotionSites · 动效设计目录','按 3D、Interactive 或 Hero 浏览，比较如何让玩家看出哪里可以操作。']],
  ['sael.net/plane-of-focus', ['The Plane of Focus · 焦平面','拖动对焦环，看清晰区怎样从前景移到远景。对照象牙摄影的取景动作。']],
  ['sael.net/river-bend', ['River Bend · 河曲实验','改变流量与沉积物，看外岸冲刷、内岸堆积。对照古河水槽。']],
  ['sael.net/interior', ['Set the Mood · 室内光与材料','以拖放材质和移动日光改变同一空间，观察侧光下的表面差别。']],
  ['showreel.design/category/3d-cgi',['Showreel · 3D / CGI','用景别与受光方向比较立体形貌。']],
  ['showreel.design/category/uiux-motion',['Showreel · UI/UX Motion','在界面演示中寻找入口、状态过渡和撤回操作的节奏。']],
  ['showreel.design/videos/aixsponza-aixsponza-design-reel',['Aixsponza Design Reel','从工艺细节切到完整形体，再看动作。早期记录核对过策展条目。']],
  ['motionsites.ai/3d-websites',['MotionSites · 3D 网站','浏览网页空间、交互模型与作品集案例。']],
  ['motionsites.ai/backgrounds',['MotionSites · 动态背景','比较前景信息与背景运动的层次。']],
  ['bruno-simon.com',['Bruno Simon · 可驾驶的个人作品集','进入页面便能驾车探索，比较输入接管与空间中的路线引导。']],
  ['lusion.co/projects/of_the_oak',['Lusion · Of the Oak 制作案例','古树的根盘、枝冠及不同尺度的视线组织。']],
  ['oftheoak.co.uk',['Of the Oak · 古树体验','进入完整的树木体验，从枝叶细部回望整体树冠。']],
  ['www.jinshasitemuseum.com/info/4877',['黄忠小学地点的植物考古','西台烟火里的取样依据。从灰坑土样中浮选、辨认炭化植物遗存。']],
  ['www.jinshasitemuseum.com/info/706',['金沙遗址的发现与发掘','查阅居址、祭祀区与古河道材料，理解九次调查何以沿河展开。']],
  ['www.jinshasitemuseum.com/seardetail/2191',['古树根的树种鉴定','查核秋枫鉴定的实物依据，回看古木工位如何区分在地树根与漂木。']],
  ['www.nopss.gov.cn/n/2015/0727/c358567-27367530.html',['九柱建筑与冬至日出方向','查阅研究团队对建筑轴向和冬至日出方位的比较，理解候日场景的来历。']],
  ['onlinelibrary.wiley.com/doi/10.1111/arcm.70103',['金沙植物考古研究论文','发表于 Archaeometry 的研究。与黄忠小学地点的馆方解读对照阅读。']],
  ['www.jinshasitemuseum.com/node/197',['商周大金面具','回看金片的捶揲、眼口镂空和耳部结构，与终章展台的侧光相对照。']],
  ['www.jinshasitemuseum.com/node/216',['遗迹馆 · 滨河祭祀区','查找原位树根、象牙埋藏与第十八号遗迹，分辨遗迹和复原想象。']],
  ['www.jinshasitemuseum.com/seardetail/681',['太阳神鸟金饰','看内圈十二道齿芒和外圈四鸟的旋向，结合透光工位比较镂孔。']],
  ['www.jinshasitemuseum.com/seardetail/3793',['九柱基址的几种解释','从九个方形柱洞出发，阅读关于上部建筑的不同解释。']],
  ['www.jinshasitemuseum.com/info/2172',['金沙蛙形金箔','湿地动物造型与金工的文化参照。']],
  ['www.jinshasitemuseum.com/info/2611',['馆方吉祥物的设计报道','早期角色研究据此辨别既有形象与烁羽的原创造型。']],
  ['www.jinshasitemuseum.com/info/4897',['馆方数字人“小金”','馆方自身的数字角色资料。']],
  ['www.jinshasitemuseum.com/seardetail/2208',['祭祀区与古河道','观察遗存的位置与河岸分布。']],
  ['www.jinshasitemuseum.com/info/2029',['金沙石磬的展陈资料','查看石质发声器与展览演示的联系。']],
  ['www.jinshasitemuseum.com/seardetail/2382',['馆藏铜鸟','观察昂首、收翼和尾部的造型线索。']],
  ['www.jinshasitemuseum.com/seardetail/679',['馆藏玉琮','查找外部形制、孔壁和加工痕迹。']],
  ['www.jinshasitemuseum.com/node/174',['金沙遗址概况','馆方介绍遗址的发现、年代与主要遗存。']],
  ['www.thegoldenidol.com/the-case-of-the-golden-idol',['金偶像谜案 · The Case of the Golden Idol','用现场细节重建事件，启发调查工位区分观察、推断与复查。']],
  ['pentiment.obsidian.net',['隐迹渐现 · Pentiment','从手稿、版画与日常劳动理解时代，比较不同材料如何留下记录。']],
  ['the-witness.net/info',['见证者 · The Witness','环境中的尺度和视线就是线索，帮助理解九柱末站的测量。']],
  ['blog.playdead.com/articles/inside_presentations/inside_publications.html',['INSIDE · Playdead 技术演讲','开发者整理的光照、渲染和音画制作演讲。']],
  ['www.subnautica.com',['深海迷航 · Subnautica','水下观察、可回看的发现记录和工具能力。']],
  ['www.play-season.com/media',['SEASON · 摄影与手记','摄影、录音与写手记保存了地点的不同面貌。']],
  ['thatgamecompany.com/flower',['花 · Flower','自然环境随玩家的移动产生反馈，作为早期生态互动参照。']],
  ['thepathless.com/Description',['无路之旅 · The Pathless','视线、速度与开放空间中的寻路。']],
  ['store.steampowered.com/app/553420/TUNIC',['TUNIC · 发行商商店页','可翻阅的手册把发现留给玩家，也允许随时回顾。']],
  ['www.ubisoft.com/en-us/game/assassins-creed/discovery-tour',['Discovery Tour · 探索之旅','育碧的历史场景探索系列。对照导览、自由漫游和知识讲解。']],
  ['tapestry.cyark.org/content/petra',['CyArk · 佩特拉修道院','遗产虚拟参观结合场景、地标与解说。']],
  ['asia.si.edu/whats-on/exhibitions/body-of-devotion-the-cosmic-buddha-in-3d',['Cosmic Buddha · 立体展览','史密森尼亚洲艺术博物馆的文物细节与交互展览案例。']]
]);

function recordKey(url) {
  const u = new URL(url);
  return (u.hostname + u.pathname).replace(/\/$/, '');
}
const gameSites = /thatgamecompany|inklestudios|mobiusdigitalgames|obradinn|rundisc|annapurnainteractive|505games|fireproofgames|dont-nod|ashorthike|ustwogames|monumentvalley|goldenidol|pentiment|the-witness|playdead|subnautica|play-season|thepathless|yoshiscraftedworld|ubisoft|store\.steampowered|news\.xbox|playstation|gdcvault|giantsquidstudios/;
function group(url) {
  const host = new URL(url).hostname;
  if (gameSites.test(host)) return 'games';
  if (/sael\.net|showreel|motionsites|lusion|oftheoak|tympanus|bruno-simon/.test(host) || /brunosimon|codrops-cinematic|Motionsites-AI/.test(url)) return 'motion';
  if (/museum|artsandculture|nopss|wiley|historicengland|chaoxing|dpm\.org|smithsonian|sia?\.edu|cyark|heritage\.gov/.test(host)) return 'museum';
  if (/allaboutbirds|featheratlas|research\.pixar|rhs\.org|montreal|adfg|frontiersin|graphics\.unizar|disneyanimation/.test(url)) return 'nature';
  if (/polyhaven|ambientcg|creativecommons|versilian|sgossner|notofonts|sonniss|strezov|freesound|hexgrad|sherpa|heygen|elevenlabs/.test(url)) return 'assets';
  return 'tech';
}
const aliases = new Map([
  ['annapurnainteractive.com/games/gorogoa','https://annapurnainteractive.com/zh-cn/games/gorogoa'],
  ['www.ubisoft.com/en-gb/game/assassins-creed/discovery-tour','https://www.ubisoft.com/en-us/game/assassins-creed/discovery-tour'],
  ['www.jinshasitemuseum.com/seardetail/706','https://www.jinshasitemuseum.com/info/706'],
  ['dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr','https://polyhaven.com/a/forest_slope']
]);
function normalize(url) {
  let actual = new URL(aliases.get(recordKey(url)) || url);
  if (actual.hash === '#MeshPhysicalMaterial') actual = new URL('https://threejs.org/docs/pages/MeshPhysicalMaterial.html');
  if (actual.hostname === 'bruno-simon.com') actual.searchParams.delete('lang');
  if (actual.hostname === 'artsandculture.google.com') actual.searchParams.set('hl','zh-cn');
  if (actual.hostname === 'mooc1.chaoxing.com') { actual.searchParams.delete('_from_'); actual.searchParams.delete('rtag'); }
  return actual.href;
}
const records = new Map();
function store(url, label, v) {
  if (!url.startsWith('https://')) return;
  const href = normalize(url);
  const id = href.replace(/\/(?=([?#]|$))/, '');
  const row = records.get(id) || {href, tags:new Set(), labels:new Set(), category:group(href)};
  row.tags.add(v);
  row.labels.add(label.trim());
  records.set(id,row);
}
function collect(dir) {
  for (const file of readdirSync(dir, {withFileTypes:true})) {
    if (['blossom','baseline'].includes(file.name)) continue;
    const path = join(dir,file.name);
    if (file.isDirectory()) {collect(path);continue;}
    if (!file.name.endsWith('.md')) continue;
    const parts = relative(join(root,'docs'),path).split(sep);
    const v = parts.length === 1 ? 1 : Number(parts[0].slice(1));
    if (!Number.isInteger(v) || v < 1 || v > 14) continue;
    for (const match of readFileSync(path,'utf8').matchAll(/\[([^\[\]]{1,220})\]\((https?:\/\/[^\s)]+)\)/g)) store(match[2],match[1],v);
  }
}
collect(join(root,'docs'));
// This is the paper cited beside Huangzhong in the current credits.
store('https://onlinelibrary.wiley.com/doi/10.1111/arcm.70103','西台植物考古论文',14);
// The requested author index and three motion sites are also in the earlier notebook.
store('https://sael.net/','Ryan Sael',14);
store('https://sael.net/demo/farewell-light/','Farewell Light',2);
store('https://showreel.design/','Showreel',2);
store('https://motionsites.ai/','MotionSites',2);
// The side-panel revisit for the finished game. Keep V14's archive filter intact.
const finalVisit = new Set([
  'https://sael.net/demo/farewell-light/',
  'https://showreel.design/',
  'https://motionsites.ai/',
  'https://thatgamecompany.com/journey/',
  'https://www.inklestudios.com/heavensvault/',
  'https://www.mobiusdigitalgames.com/outer-wilds.html',
  'https://obradinn.com/',
  'https://www.rundisc.io/chants-of-sennaar/',
  'https://annapurnainteractive.com/zh-cn/games/gorogoa',
  'https://505games.com/games/abzu/',
  'https://www.fireproofgames.com/games/the-room-three-2',
  'https://dont-nod.com/en/games/jusant/',
  'https://ashorthike.com/',
  'https://www.jinshasitemuseum.com/info/4877',
].map(recordKey));
for(const row of records.values())if(finalVisit.has(recordKey(row.href)))row.tags.add(16);
const genericLabel = /^(官方|原作|开发者|发行商|作者|许可|首页|原许可证|链接|体验入口|官方体验|馆方说明|官方说明|馆方条目|制作资料|主页|条款|官方条款|官方手册|官方许可|模型说明)$/u;
const station = host => host.replace(/^www\./,'');
const archiveTitles = new Map([
  ['artsandculture.google.com/asset/stone-tiger/ygHjq8_EHD6vcA','金沙馆藏 · 石虎'],
  ['artsandculture.google.com/asset/bronze-bird/7QH-c8Zpgsixjg','金沙馆藏 · 铜鸟'],
  ['artsandculture.google.com/asset/bronze-standing-figure/HAGgFD7-L5VZAA','金沙馆藏 · 铜立人'],
  ['artsandculture.google.com/asset/sun-and-immortal-bird-gold-foil/DgGM_XRre4GIRQ','金沙馆藏 · 太阳神鸟金饰'],
  ['www.jinshasitemuseum.com/seardetail/714','馆方解读 · 太阳神鸟金饰'],
  ['www.jinshasitemuseum.com/seardetail/1095','馆方图录 · 十节玉琮'],
  ['www.jinshasitemuseum.com/site-85/info/3541','金沙治玉体验 · 切割、钻孔与打磨'],
  ['www.jinshasitemuseum.com/site-75/node/315','馆方遗迹馆导览'],
  ['www.chnmuseum.cn/zx/gbxw/202606/t20260613_279138.shtml','中国国家博物馆 · 古蜀金器展讯'],
  ['www.heritage.gov.hk/filemanager/heritage/en/content_46/Heritage_Newsletter_issue85.pdf','香港文物保育专员办事处 · 古蜀文明展讯（PDF）'],
  ['github.com/sgossner/VSCO-2-CE','VSCO 2 Community Edition · 管弦乐音源'],
  ['github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE','VSCO 2 · 采样许可'],
  ['showreel.design/about','Showreel · 策展与作者署名'],
  ['github.com/Motionsites-AI/claude-skill','MotionSites · 官方示例仓库'],
  ['raw.githubusercontent.com/Motionsites-AI/claude-skill/main/LICENSE','MotionSites · 代码及示例媒体许可'],
  ['motionsites.ai/terms','MotionSites · 使用条款'],
  ['studio.blender.org/projects/sprite-fright/pages/about','Sprite Fright · Blender Studio 项目与授权'],
  ['studio.blender.org/blog/sprite-fright-weeklies-recordings','Sprite Fright · 角色制作周会'],
  ['studio.blender.org/projects/sprite-fright/sprite','Sprite Fright · 角色造型制作档案'],
  ['sonniss.com/gdc-bundle-license','Sonniss GDC · 音效包许可'],
  ['www.strezov-sampling.com/data/uploads/products/64/f72bae6527fe8ab7edc1033bf56a69d5.pdf','JADE Ethnic Orchestra · 乐器手册（PDF）'],
  ['huggingface.co/hexgrad/Kokoro-82M-v1.1-zh','Kokoro v1.1 · 中文语言模型说明'],
  ['elevenlabs.io/docs/overview/administration/billing','ElevenLabs · 订阅权益'],
  ['elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-i-select-the-language-and-accent','ElevenLabs · 语言和口音'],
  ['www.adfg.alaska.gov/index.cfm','阿拉斯加鱼猎部 · 河乌的水下行为'],
  ['academy.allaboutbirds.org/feathers-article','康奈尔鸟类学实验室 · 羽毛结构图解'],
  ['freesound.org/people/guidofm/sounds/509176','Forest Ambience · Mátrafüred 林地实录'],
  ['freesound.org/people/RyanKingArt/sounds/695769','Campfire on the Beach · 海滩营火实录'],
  ['freesound.org/people/Yuval/sounds/197023','Small Stream Forest · 阿登林间溪流实录']
]);
function title(row) {
  const url = new URL(row.href);
  const archiveTitle = archiveTitles.get(recordKey(row.href));
  if(archiveTitle)return archiveTitle;
  const label = [...row.labels].filter(x=>!genericLabel.test(x)).sort((a,b)=>b.length-a.length)[0];
  if (url.hostname==='threejs.org') return 'Three.js · ' + (label||'渲染文档').replace(/^Three\.js[·：—\s]*/i,'');
  if (url.hostname==='polyhaven.com' && url.pathname.startsWith('/a/')) return 'Poly Haven · '+url.pathname.slice(3).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  return label || station(url.hostname)+' · '+decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)||'首页').replace(/\.html$|\.md$/,'').replaceAll('-',' ');
}
const renderOrder=new Map([...selected.keys()].map((id,i)=>[id,i]));
export const entries=[...records.values()].map(row=>{
  const id=recordKey(row.href);
  const words=selected.get(id);
  return {href:row.href, category:row.category, tags:[...row.tags].sort((a,b)=>a-b),title:words?.[0]||title(row),note:words?.[1]||'',order:renderOrder.get(id)??1000};
}).sort((a,b)=>a.order-b.order || a.title.localeCompare(b.title,'zh-CN'));

const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rounds(values) {
  const ranges=[];
  for (const n of values) {
    const tail=ranges.at(-1);
    if(tail && tail[1]===n-1)tail[1]=n;else ranges.push([n,n]);
  }
  return ranges.map(([a,b])=>a===b?'V'+a:'V'+a+'–'+b).join(' / ');
}
function markup() {
  const checks=join(root,'docs','v14','references');
  const direct=JSON.parse(readFileSync(join(checks,'external-links.json'),'utf8')).items;
  const web=JSON.parse(readFileSync(join(checks,'web-crosscheck.json'),'utf8')).items;
  const failed=new Set(direct.filter(r=>!(r.status>=200&&r.status<300)).map(r=>r.href));
  const unconfirmed=new Set(web.filter(r=>!r.readable&&failed.has(r.href)).map(r=>r.href));
  return Object.entries(groups).map(([key,label])=>{
    const list=entries.filter(e=>e.category===key);
    const cards=list.map(e=>{
      const host=station(new URL(e.href).hostname);
      const current=e.tags.includes(14);
      const access=unconfirmed.has(e.href)?' <span class="access-status">V14 访问未核实</span>':'';
      return `<li data-final="${e.tags.includes(16)?'yes':'no'}" data-current="${current?'yes':'no'}" data-history="${e.tags.some(n=>n<14)?'yes':'no'}"><a href="${esc(e.href)}" target="_blank" rel="noopener noreferrer"><span class="record-title">${esc(e.title)}<span aria-hidden="true" class="out">↗</span></span>${e.note?`<span class="note">${esc(e.note)}</span>`:''}<small>${esc(host)} <span>·</span> ${rounds(e.tags)}${access}</small></a></li>`;
    }).join('\n');
    return `<section id="${key}" class="catalog-section"><header><h2>${label}</h2><span class="section-count">${list.length} 条</span></header><ul class="records">\n${cards}\n</ul></section>`;
  }).join('\n');
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const path=join(root,'public','references.html');
  const source=readFileSync(path,'utf8');
  const section=/<!-- catalog:start -->[\s\S]*?<!-- catalog:end -->/;
  if(!section.test(source))throw new Error('找不到索引的静态内容位置');
  writeFileSync(path,source.replace(section,()=>`<!-- catalog:start -->\n${markup()}\n<!-- catalog:end -->`));
  console.log(entries.length,'条独立地址，V14 关卡研究',entries.filter(e=>e.tags.includes(14)).length,'条，V16 复访',entries.filter(e=>e.tags.includes(16)).length,'条');
}
