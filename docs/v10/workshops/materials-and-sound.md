# 工艺场的器物与声音

## 场景依据

金沙遗址博物馆的治玉体验介绍提到切割、钻孔、雕琢和抛光。第四站选取水、砂和往复运动演示加工原理。玉口规、复原陶托及其跨地点传递属于游戏叙事。[金沙遗址博物馆](https://www.jinshasitemuseum.com/site-85/info/3541) [故宫博物院的制玉讲座](https://www.dpm.org.cn/learing_detail/254454.html)

第五站的三块残片与背壁取自同一器形。每条断口的正反面和破口截面均可见。修好的器身在第六站倒扣于转台，转动时可以看见腹部的接缝。铜鸟借鉴馆藏器的昂首、圆目、收翼与残尾。压印时程序从陶托上的同一件模型投影，再让玩家标注眼、翼和尾。陶器形制、工作棚布局和光照台为美术演绎。[金沙遗址博物馆馆藏铜鸟](https://artsandculture.google.com/asset/bronze-bird/7QH-c8Zpgsixjg?hl=zh-cn)

## 美术资产

内置 ImageGen 生成一张四等分的无字材质图版，分别采集青色纤维状玉材、暗褐带绿锈的铜表、带矿物夹杂的素陶、横向磨蚀木纹的纹理。将每格裁成 512 像素方图，写入 `public/assets/v10/workshop/{jade,bronze,clay,wood}.jpg`。器物在 Three.js 中独立受光，图版提供表面颜色与细微凹凸。

另一幅原画使用的提示为“古蜀成都平原的陶棚内景，泥壁、木架、无纹陶罐、芦苇、竹篮与余烬窑口，从空出的近景工作台平视，暖侧光，中央留出暗部，全景轻度虚焦”。压缩后的 `public/assets/v10/workshop/kiln-room.webp` 用作陶作架远景。视觉构图属于本作创作。

## 乐谱与人声

《河岸》用六分拍的疏落拨音与有呼吸间隔的笛句，《循器》把三加二的节奏放进拨弦，《斜照》拉长弓弦低音与锣尾。收据的拨弦和弦、终章的高音回应及动作拟音由游戏实时演奏。进入九柱听辨后，伴奏与环境底声停止，让玩家单独辨别三种乐句。这是为本作创作的当代配乐。

「河心试胆」的左、右袭流从对应声道起响，接近竹筏时向中间移动。闷响代表筏身受撞，两声上扬的气泡提示涡心松开。落桨后的短促冲击和向外扩散的高频水声确认反击生效。静音时，水沫方向、涡心白环和字幕提供同一组线索。

旋律各用一份长笛、竖琴、大提琴和轻锣实录切片。原始声音取自项目已有的 VSCO 2 Community Edition（CC0），由 Versilian Studios / Sam Gossner、Ivy Audio / Simon Dalzell 提供。环境声沿用项目已归档的 CC0 溪水、树林、火堆实录。原始采样清单见 `scripts/audio-source/v6/sources.json` 和 `public/assets/audio/v5-field-sources.json`。[采样库](https://github.com/sgossner/VSCO-2-CE) [溪水](https://freesound.org/people/Yuval/sounds/197023/) [树林](https://freesound.org/people/guidofm/sounds/509176/) [火堆](https://freesound.org/people/RyanKingArt/sounds/695769/)

开场、九处旁白、九段路上对白及终章共 21 段中文语音，使用本机系统语音 Kangkang 与 Yaoyao 预合成。音频为按需加载的 Ogg Opus，配乐在人声响起时降低音量。音色、文本、音频及打包脚本分别见 `src/v10/survey-voices.json`、`public/assets/v10/sound` 与 `scripts/pack-survey-audio-v10.cjs`。

## 可复验入口

`node scripts/verify-workshops-v10.cjs --capture` 以真实 WebGL、鼠标、键盘和触屏完成三站。错误操作、归档次数以及退出后的画布清理均有断言。

`node scripts/verify-survey-audio-v10.cjs` 在浏览器中解码 21 条语音，用分析节点检测三幕配乐与十二种动作和水势提示声，分别测量左右袭流的声道强度，并检查静音、恢复、取消在途旁白和释放音频上下文。
