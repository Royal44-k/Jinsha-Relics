// Player-facing steps shared by the fieldwork fixture and main campaign walkthrough.
function actions(page,mobile) {
  return async name=>{
    const b=page.getByRole('button',{name,exact:true});await b.waitFor({state:'visible',timeout:45000});
    await b.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'nearest'}));const box=await b.boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
  };
}
async function dragOn(page,from,to,mobile) {
  const steps=12;
  if(mobile){
    const session=await page.context().newCDPSession(page);
    try{
      const send=(type,x,y)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y,radiusX:2,radiusY:2}]});
      await send('touchStart',...from);for(let i=1;i<=steps;i++)await send('touchMove',from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps);
      await send('touchEnd');
    }finally{await session.detach();}
  }else{await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps});await page.mouse.up();}
}
async function center(locator){const b=await locator.boundingBox();return [b.x+b.width/2,b.y+b.height/2];}
async function sieve(page,{mobile=false,check=()=>{},shot=async()=>{},finish=true}={}) {
  const click=actions(page,mobile),hint=page.locator('.js-field-hint');
  await click('取样湿筛');
  if(mobile){for(let i=0;i<6;i++)await click(i%2?'向右摇筛':'向左摇筛');}
  else{
    const canvas=page.locator('.fw-sieve canvas');await canvas.focus();
    for(let i=0;i<6;i++)await page.keyboard.press(i%2?'ArrowRight':'ArrowLeft');
  }
  check('task heading names the rim',/陶器口沿/.test(await page.locator('.js-field-panel h2').innerText()));
  await click('返回剖面');check('layer pins survive returning to the section',/2 \/ 2/.test(await page.locator('.js-field-reading').innerText()));
  await click('取样湿筛');await click('左侧残留物');check('water-rounded stone rejected as pottery',/水磨圆/.test(await hint.innerText()));
  await click('右侧残留物');check('wood splinter described from evidence',/纤维/.test(await hint.innerText()));
  await shot('sieve');await click('中部残留物');check('rim and fracture must both be examined',await page.getByRole('button',{name:'配层位签'}).isDisabled());
  const obj=page.locator('.fw-object-table canvas');await obj.waitFor();const point=await center(obj);
  const before=await obj.screenshot();await dragOn(page,point,[point[0]+55,point[1]-26],mobile);await page.waitForTimeout(100);
  check('drag rotates live three-dimensional specimen',!(await obj.screenshot()).equals(before));
  await click('看口沿');check('inspect the rim in macro view',/器口的方向/.test(await hint.innerText()));
  await click('返回筛盘');await click('中部残留物');check('returning to the tray keeps the rim observation',/✓ 外翻口边/.test(await page.locator('.js-field-reading').innerText()));
  await click('看断口');check('inspect inclusions at the break',/夹杂物/.test(await hint.innerText()));await shot('sherd');
  await click('配层位签');await click('上部根际土');check('misplaced provenance label cannot archive',await page.getByRole('button',{name:'封存陶片与层位记录'}).count()===0);
  await click('砂泥交界');
  if(finish)await click('封存陶片与层位记录');
}
async function transit(page,{mobile=false,check=()=>{},shot=async()=>{},finish=true}={}) {
  const click=actions(page,mobile);
  await click('观测漂木');
  await click('返回南岸泊位');check('returning to the raft retains both moorings',/两处靠泊/.test(await page.locator('.js-field-reading').innerText()));
  await click('观测漂木');const grip=page.locator('.fw-survey-tie.tie-0'),target=page.locator('.fw-survey-tie.tie-1');
  await grip.waitFor();await page.waitForTimeout(150);await dragOn(page,await center(grip),await center(target),mobile);
  await page.locator('[data-field-phase="transit"]').waitFor();check('rope snaps to the projected survey post',!(await grip.isVisible()));
  await click('架设测线触铃');await page.getByRole('button',{name:'收好岸线图',exact:true}).waitFor({timeout:24000});
  check('timed transit on real moving wood',/一条漂移观察/.test(await page.locator('.js-field-reading').innerText()));await shot('transit');
  if(finish)await click('收好岸线图');
}
async function roots(page,{mobile=false,check=()=>{},shot=async()=>{},finish=true}={}) {
  const click=actions(page,mobile),hint=page.locator('.js-field-hint'),sample=page.getByRole('button',{name:'采集根部样本'});
  const before=await sample.boundingBox();await click('向右环看');await page.waitForTimeout(600);
  const after=await sample.boundingBox();check('camera orbit moves root hotspot with the 3D root',Math.abs(before.x-after.x)+Math.abs(before.y-after.y)>4);
  await click('检查游离木段');check('driftwood cannot identify the root',/原地|根盘/.test(await hint.innerText()));await click('采集根部样本');
  const ring=page.locator('.fw-core-grip'),root=page.locator('.fw-core-end');await ring.waitFor();await page.waitForTimeout(480);
  await dragOn(page,await center(ring),await center(root),mobile);await page.locator('.fw-optics').waitFor();
  check('sample extracted by following the actual projected root',!(await ring.isVisible()));
  await click('复核切片');check('wrong reference prompts anatomical observation',/成簇/.test(await hint.innerText()));
  await click('散孔参照');await click('复核切片');check('matching pattern still needs alignment',/双孔/.test(await hint.innerText()));await shot('micrograph');
  await click('顺转 15°');await click('返回根部取样');await click('继续观察已取切片');
  check('microscopy retains reference and alignment on revisit',/参照 2 \/ 3.*-30°/.test(await page.locator('.js-field-reading').innerText()));
  for(let i=0;i<2;i++)await click('顺转 15°');await click('复核切片');await page.getByRole('button',{name:'看古林复原'}).waitFor({timeout:25000});
  await shot('grown');await click('看古林复原');check('forest reconstruction unlocked from specimen',/复原/.test(await page.locator('.js-field-reading').innerText()));await shot('forest');
  if(finish)await click('收存秋枫鉴定标本');
}
module.exports={sieve,transit,roots};
