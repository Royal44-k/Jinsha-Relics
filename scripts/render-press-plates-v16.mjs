import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const folder='docs/v16/发布物料';
const asImage=async(file,type='jpeg')=>'data:image/'+type+';base64,'+(await readFile(file)).toString('base64');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const serif=(await readFile('public/fonts/jinsha-serif.woff2')).toString('base64');
const css=`@font-face{font-family:Jinsha;src:url(data:font/woff2;base64,${serif})}*{box-sizing:border-box}
body{width:1080px;height:1440px;margin:0;position:relative;overflow:hidden;font:30px/1.4 "Microsoft YaHei",sans-serif}
h1,h2,p{margin:0}.serif{font-family:Jinsha,SimSun,serif}
.image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.mast{display:flex;align-items:center;justify-content:space-between;font-size:25px;letter-spacing:2px}
.cover{color:#f8ead0;padding:68px 72px;position:relative;height:100%;background:linear-gradient(180deg,#06141054,transparent 58%,#08100edc)}
.cover .mast{padding-bottom:20px;border-bottom:1px solid #dddbbd85}.cover h1{font-size:108px;letter-spacing:.035em;font-weight:500;line-height:1.14;margin-top:79px}
.cover h1 em{font-style:normal;color:#f0c77e}.cover .foot{position:absolute;bottom:70px;left:72px;right:72px}
.cover .foot p{font-size:42px;letter-spacing:3px}.cover .foot small{display:block;margin-top:10px;color:#e0d2b5;font-size:25px}
.work{background:#f3efe4;padding:52px 62px;color:#192e28;height:100%}.work .mast{border-bottom:2px solid #7b8b7b;padding-bottom:14px;font-size:23px}
.work h1{font-size:65px;line-height:1.35;margin:24px 0 18px;font-weight:500}
.work figure{margin:0 0 34px}.work figure img{display:block;width:100%;height:422px;object-fit:cover;object-position:center}
.work figure:last-child img{height:408px;object-fit:contain;background:#172724}
.work figcaption{display:flex;align-items:baseline;gap:24px;margin-top:11px}.work h2{font-size:34px;color:#224539;white-space:nowrap}.work figcaption span{font-size:25px;color:#394e45}
.work footer{position:absolute;bottom:46px;left:62px;right:62px;display:flex;justify-content:space-between;border-top:1px solid #8f9988;padding-top:14px;font-size:23px}
.bronze .lead{font-size:29px;color:#425850;margin:-7px 0 24px}.bronze .full{width:100%;display:block}.bronze .detail{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:28px}.bronze .cut{height:200px;background-size:205%;border:1px solid #aca68d}.bronze h2{font-size:37px;font-weight:500;margin:12px 0 4px}.bronze p{font-size:25px;color:#40564c}`;
try{
  const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
  async function render(contents,name){
    await page.setContent('<meta charset="utf-8"><style>'+css+'</style>'+contents);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    await page.screenshot({path:folder+'/'+name,type:'jpeg',quality:95});
  }
  const concept=await asImage(folder+'/托住铜鸟-主题概念图.png','png');
  await render(`<img class="image" src="${concept}"><main class="cover"><header class="mast"><span>金沙：古蜀秘境</span><span>浏览器探索游戏</span></header><h1 class="serif">一只铜鸟，<br>该<em>托</em>在哪里？</h1><div class="foot"><p class="serif">我把金沙遗址做成了游戏</p><small>铜鸟支护台　／　AI 辅助概念美术</small></div></main>`,'图文封面-铜鸟支护.jpg');
  const bronze=await asImage('docs/v16/campaign/site-6.jpg');
  await render(`<main class="work bronze"><header class="mast"><span>金沙：古蜀秘境</span><span>游戏实机手记</span></header><h1 class="serif">先别松手。</h1><p class="lead">横拖鸟身，侧转观察，再决定把两只托放在哪里。</p><img class="full" src="${bronze}"><section class="detail"><div><div class="cut" style="background-image:url(${bronze});background-size:335%;background-position:58% 65%"></div><h2 class="serif">看折垂的薄尾</h2><p>外形突出，支点却不能落在这里。</p></div><div><div class="cut" style="background-image:url(${bronze});background-size:240%;background-position:25% 72%"></div><h2 class="serif">再调两只支托</h2><p>移向厚实的胸腹，缓缓试托。</p></div></section><footer><span>铜鸟支护台　／　教学复制件</span><span>浏览器实机截取</span></footer></main>`,'铜鸟工作台-实机.jpg');
  const flight=await asImage('docs/v16/river-passage/flight.jpg'),evidence=await asImage('docs/v16/investigation/river-evidence.jpg');
  await render(`<main class="work"><header class="mast"><span>金沙：古蜀秘境</span><span>游戏实机手记</span></header><h1 class="serif">飞过河湾，再回来看证据。</h1><figure><img src="${flight}"><figcaption><h2 class="serif">芦湾起飞</h2><span>贴着水面掠过，水鸟向另一处浅湾落去。</span></figcaption></figure><figure><img src="${evidence}"><figcaption><h2 class="serif">两处记录</h2><span>对照夹砾层与河湾沉积，给出自己的判断。</span></figcaption></figure><footer><span>现场观察与研判</span><span>浏览器实机截取</span></footer></main>`,'图文配图-两处实机现场.jpg');
}finally{await browser.close();}
