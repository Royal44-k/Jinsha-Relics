# V9 研究、视觉取舍与素材登记

2026-11-20。首先回顾既有[原视频拆解](../video-analysis.md)、V5玩法脚本与V6–V8实测记录，再针对用户此次实际问题设计。原片110.47秒、3314个帧位置的程序分析和视觉抽样范围沿用原记录，本轮没有冒称再次人工逐帧观看全部画面。

## 具体参照与落地

- [Nature Beyond Technology / Codrops](https://tympanus.net/codrops/2025/12/04/crafting-nature-beyond-technology-a-project-from-roots-to-leaves/)：本轮早期读到作者关于树干/叶片分层、树根曲线、雾中空间层次及分开的镜头位置/转向/焦点控制说明。采用的是分层制作方法：实体枝干与曲面叶独立生长、根树18秒观察镜头、明确的近中远景。没有复制文章的受保护图片或把案例性能当成本作性能。后续再次直接打开返回403，不能视为新一轮实时演示已观看。
- [Codrops 3D Particle Explorations](https://tympanus.net/codrops/2017/12/12/3d-particle-explorations/)：错峰运动与缓入缓出的视觉原则转为低成本加载页光尘和四羽日轮，不在游戏编译时另开第二个WebGL场景。
- [Cinematic Scroll Animations 作者代码](https://github.com/JosephASG/codrops-cinematic-scroll-animations)：参考环境、文字与镜头分别编排的结构。未直接导入其生成图片或代码。
- [Showreel](https://showreel.design/)本轮web读取403；[Farewell Light](https://sael.net/demo/farewell-light/)web读取不可访问。保留此前已认可的光线引路、空气层次、克制界面方向，不声称此次成功逐项试玩。
- [MotionSites](https://motionsites.ai/)可读公开分类目录，仍作为创意交互/3D/作品集的发现入口；没有把目录描述当作模型使用许可或完整视觉审查。

## 金沙文化依据与创作边界

[金沙遗址博物馆·金沙简介](https://www.jinshasitemuseum.com/node/174)记载大型建筑基址、祭祀区、居住址、墓地及金铜玉石象牙漆木等器物。由此延伸滨河、根木、泥火聚落与祭祀记忆的主题，具体地图、快速树木生长、羽灵、种火、蚀影和进化为原创幻想。馆方介绍中的当代园区植物不是古代植被考古证据，不据此将本作树种或场景称为遗址复原。

三场可选挑战分别恢复芦叶之声、归家石路、九柱前的种火，将环境修复和主线相连。净化对象是虚构蚀影；关卡规则不宣称出自古蜀宗教史。

## 新美术资产

- 原创概念画：内置imagegen生成，原文件位于art/living-river-concept-original.png；网页版本public/assets/v9/living-river-concept.webp，1672×941，426246字节。只做PNG→WebP格式压缩，未用绘图脚本修饰生成内容。加载页明确标注原创概念画；首页和实玩仍为真实3D。
- 提示词：Premium cinematic environment concept painting, original browser adventure inspired by Jinsha ancient Shu; landscape 16:9; humid Chengdu plain river at dawn, huge once-dead tree on far bank with fresh translucent emerald shoots growing a great canopy, timber posts/earthen ritual terraces, small clay kiln and reeds, no castles or modern objects; warm gold disk four-bird spiral in distant sunlight, tiny white/jade feather-spirit bird at right foreground; palette teal/jade/umber/gold; left 42% dark mist negative space for typography, right 58% tree/river/light; physical textures/leaves/reflections; no text/logo/UI/watermark.
- 四羽日轮：本项目原创SVG形态，public/assets/v9/jinsha-seal.svg；以四羽环行和太阳为主题，不标称馆方官方标志。
- 三阶成长立绘：public/assets/v9/growth-0/1/2.png，由本项目实际GLB同灯光、同机位渲染，480×480透明背景；并非生成概念图代替实际模型。
- 原有CC0环境素材及HDRI许可继续见此前资源登记。新增绿树、遭遇地标与生态恢复几何由项目原创制作。

## 新声音

11种原创生命/净化声效由src/v9/life-foley.js生成并预渲染为24kHz单声道16-bit WAV，总816008字节。以低风声、木质摩擦、石质共鸣和克制的五声音程组织预警/露核/受击/鸣光/生长阶段；不宣称复原古蜀乐器。运行时异步解码，不在移动帧实时合成大量波形。原有多轨配乐与烁羽/录忆者人声来源不变；商业声音许可状态仍按既有登记。

## 验证方法

界面fixture截图只用于版式和交互检查，明确阻断main.js与WebGL；不能当作游戏截图或性能证据。CPU几何/规则测试、真实GPU截图、连续实走、生产版验证分别记录。新树实际绘制成本、角色GLB哈希和相机/水域基准由各专项文档给出，不以增加三角面数量等同3A成品。

### 补充核对（2026-11-20）
[馆方遗迹馆说明](https://www.jinshasitemuseum.com/node/216)进一步核对了滨河祭祀区、大型树根遗迹与九柱遗迹（现存柱洞，木结构祭台为推测）。本作的古树复苏、九柱形态与种火旅程仍为艺术设计，不将现代节庆表演照片作为古代仪式实证。

新检索到 Codrops [The Sleepers](https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques/) 与 [Blender/Three.js 浏览器世界教程](https://tympanus.net/codrops/2025/04/08/3d-world-in-the-browser-with-blender-and-three-js/)，仅检索摘要可读、正文403；没有据此声称已学习其全部实现或拷贝素材。已能读取的 Nature Beyond Technology 作者案例支持树干/叶片分层、根部曲线造型、雾层塑造纵深等方法，本作结合交互与性能约束重新实现。
