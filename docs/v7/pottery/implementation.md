# 泥火留形 · 制作与集成

本轮新交互把玩家从“选对动作”推进为“留下自己的结果”。聚落主路肩有一张陶案，靠近后使用已有E/触屏动作进入近景；拖动直接改变中空器身，烧成后同一件器形继续在陶案上存在。没有目标吻合率，也不需要完成它才能继续五境主线。

## 已实现

- 13个受限轮廓控制点，以连续三次插值构成真实外壁、内壁、厚口与实体底部；高档80圆周段，最近三件缩小作品40段；低档48/24段。造型仍是旋转对称的游戏陶作，不是流体泥巴模拟。
- 鼠标/触屏实际拾取陶壁，再沿选中高度拖动收放；方向键选择高度/收放，Shift+方向键与环看模式转动视角。键盘工具等效可用。
- 抹平局部剖面；原创水纹细槽与谷痕错列浅压痕改变真实几何。可选轮廓仅供灵感，不代替个人形状、不当作出土文物精确图录。
- 撤销最后一笔：一次拖动合并为一步，最多16步运行期历史；Ctrl/⌘+Z与按钮同效。已烧成作品不可被撤销破坏。
- 7.5秒压缩火色演出：湿泥渐干、局部发热、暖赭色烧成。暂停或收起会冻结；重进继续，刷新则恢复可编辑泥坯，不恢复半途的表演计时。
- 保留最新泥坯和最近三件烧成作品，记录累计件数；旧存档默认空白，非法数值/未知纹样被清洗。新旅程清空陶作。
- 「看我的器物」可以逐件选择最近三件作品，原比例近景环看。回看是只读状态：即使直接调用修改API也会拒绝，不会把旧作品覆盖到当前泥坯，不重复计数；返回精确恢复当前泥坯。查看索引不写入存档。主控通过onCapture保存不含HTML界面的当前器物PNG。
- 材质采用原创128×128矿粒法线、细小轮制痕、微粗糙度和土色变化；未使用馆藏照片或游戏原作贴图。单个法线RGBA数据64KB，交互内部生成。
- 台案与陶坯参与实体阻挡和镜头避让。超过器口高度可飞越；没有把整片工作区做成不可见禁区。近景采用原场景和主渲染器，不新开永久3D画布。
- 全屏工具有焦点循环、Escape退出、二指防抢占、离焦释放触控；专属角色字幕与其他HUD分开，390像素布局在器物下方收拢工具。降低动态关闭自动转坯。

## 所有权与API

本模块文件为 `src/v7/pottery-state.js`、`pottery-world.js`、`pottery-ui.js`、`pottery-ui.css`；主控负责 `main.js` / `journey.js` / 音频 / 故事手册与正式构建。

`createPotteryWorld({scene,forest,traversal,saved,onEvent})`：

- `update(dt,{position,playing,active,reduced,quality,motion})`：仅active且playing推进烧制；grounded且距陶案3.05m内提供interaction。
- `setActive(bool)`、`shape(height01,deltaRadius)`、`smooth(height01)`、`setPattern(id)`、`fire()`、`remake()`、`undo()`、`stroke(start)`、`showWork(index|null)`。
- `orbit(dx,dy)`、`setReference(id)`、`cameraPose(aspect)`、`screenBounds(camera,width,height)`、`pick(camera,x,y,width,height)`。
- `resolveMotion(from,to,radius)`与`cameraColliders`供主控组合到既有碰撞；`serialize/restore/reset/dispose/snapshot`。
- `onEvent`发出change、cue、fired，包含世界坐标。cue名为pot-shape（65ms限频）、pot-smooth、pot-stamp、pot-fire；fired的name为pot-fired。主控接入实际本地音效/对白及持久化。

`createPotteryUI`回调与上述方法对应；`onClose`归主控；`onPick:(x,y)=>world.pick(camera,x,y,innerWidth,innerHeight)`确保真实表面选中；`onStroke:start=>world.stroke(start)`保证整笔撤销；`onViewWork:index=>world.showWork(index)`负责只读回看，`onCapture({name,workIndex})`交给主控输出PNG；`setCaption({speaker,text})`接实际旁白字幕。UI内部不另启动动画循环，根主循环调用update。

位置为路径fraction 0.610、side -4.8，台面宽2.45m、深1.60m、高0.65m；附近环境预留2.3m净空。此处是原创记忆景观布局。

## 研究及边界

文化与案例链接见[交互审视](../experience-audit.md)。[金沙博物馆的考古介绍](https://www.jinshasitemuseum.com/info/706)支持陶窑与陶器的主题；[灰坑说明](https://www.jinshasitemuseum.com/info/1406)支持生活遗存背景。自由捏形手势、快速烧成、三种纹样和工作台都是原创艺术解释，不声称复原古蜀具体工序。

## 验证

`node --test scripts/pottery-v7.test.js`：10项，通过非法存档、真实开口与内壁/底、步行和飞越、近处动作、资源释放、局部连续塑形、暂停烧制、个人形状精确保留、三件作品上限、整笔撤销、只读回看/草稿保护、低档几何预算、发现提示一次性，以及纹理尚未加载时保留共享木纹引用。初始缺模块的红测与后续塑形阈值/语法错误均已修正，最终结果不掩盖开发中间过程。

独立可视检视在[preview.html](preview.html)，它仅含陶案和标准预览照明，不把局部图冒充完整游戏实景。最终完整游戏的接入和声画验收归主控报告。`scripts/review-pottery-v7.cjs`用真实鼠标、键盘和CDP触屏检验UI；最终报告为 `final-browser-checks.json`（运行完成后写入）。第一版手工检查中的404来自预览缺favicon，已添加内联空favicon；不将旧记录说成零错误。

2026-11-19 02:03–02:06 UTC第二轮完成：

- [独立19项](final-browser-checks.json)全部通过，0页面/控制台/HTTP错误、GL0；包括实际鼠标、CDP双指、键盘、整笔撤销、暂停/退出、烧制、减动态、只读回看与恢复草稿。独立照明样片：[触屏泥坯](final-mobile-touch.png)、[旧作品近景](final-mobile-work-view.png)。
- [完整游戏15项](integration/results.json)全部通过，0页面/控制台错误；真实触控改变陶壁、整笔撤销、退出冻火、续烧、精确作品入主存档、刷新继续、只读回看并返回草稿。
- 实际导出PNG为547,812字节、390×844，文件名对应所查看作品。已目视确认非空、陶壁清晰且不含HTML工具。[自己的器物导出](integration/own-vessel-export.png)。
- 390×844字幕不覆盖工具、无横向溢出；844×390横屏工具面板留在窗内，内部滚动承载较多工具。[完整游戏手机回看](integration/04-mobile-work-view.png)、[横屏](integration/05-landscape.png)。
- 实际Shift+方向键环看10个角度，独立从相机反向向目标发射双面射线，均无场景遮挡且GL0；另保存10张实景截图。该证据覆盖这些采样角度，不夸称全世界所有角度均已测试。

02:07之后配合主控并行加载改动，将木纹优先从 `forest.surfaces.bark.map` 取得，避免依赖尚未出现的image.src；单元回归通过，最终全项目构建和生产冷启动由主控统一验证。全部浏览器已关闭，未占用后续GPU验证。
