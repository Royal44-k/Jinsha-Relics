# V6 万物回声：研究、来源与署名

整理日期：2026-11-18。本文记录实际使用的资源和设计借鉴，并区分本轮网页访问、此前观察、原创制作及尚未核定的权利；不是最终构建或性能验收报告。

## 研究如何进入游戏

本轮继续以用户确定的「浏览器优先、林河寻光」为主线。制作判断是让角色、树根水岸、生态相遇、镜头与音乐共同响应行动，先精修已有章节。原参考视频提供基础探索框架；先前分析范围见[视频分析](../video-analysis.md)，V6没有重新逐帧审片，也没有把原视频画面、音乐或模型打包入游戏。

### 用户指定网站的实际访问范围

| 来源 | V6访问情况与已有证据 | 本项目采用的方法与边界 |
|---|---|---|
| [Showreel.design](https://showreel.design/)；[Aixsponza Design Reel](https://showreel.design/videos/aixsponza-aixsponza-design-reel/) | V6网页工具再次返回403。V2曾在浏览器打开首页并记录Art Graft Reel2026、Aixsponza等卡片，未逐镜看完全部视频 | 用材质特写、角色轮廓与动作节奏作为审美检查顺序。网站是作品策展；没有复制视频、音乐、模型或站点代码 |
| [Sael](https://sael.net/)；[Farewell Light](https://sael.net/demo/farewell-light/) | V6对Farewell Light的网页抓取不可访问；没有新增完整试玩。V2实际进入并启动开场，观察海岸、灯塔、冷暖前中远景、建立镜头及署名字幕。旧记录不足以证明已验证自由移动、完整通关或音频质量 | 延续同一世界内的首页、远方视觉目标、进入后的短构图；V6将短镜头设计为移动/拖动即可接管。没有使用原作灯塔、晶体、服装或音轨 |
| [Sael Plane of Focus](https://sael.net/plane-of-focus/)、[River Bend](https://sael.net/river-bend/)、[Set the Mood](https://sael.net/interior/) | 沿用V2/V3官方说明研究；本轮未重新验证所有交互 | 学习有目的的对焦、河弯层次和同一光照下的材质比较。游戏常规移动保持落点清楚，河流不冒称真实水文模拟 |
| [MotionSites](https://motionsites.ai/) | V6成功读取公开首页、3D/Interactive等目录入口。V2观察过Flower Valley、Golden Portal、Ink Reveal等卡片，但部分缩略图未加载；未核验所有详情动画 | 用作界面动效与构成索引；没有取得付费提示词库、购买会员、导入其媒体或声称目录就是授权资产包 |

原观察和截图范围见[V2研究笔记](../v2/research-notebook.md)与[参考登记](../v2/reference-and-asset-register.md)。公开可阅读、可播放与允许复制素材是不同事项；旧版本研究不冒充本轮新增试玩。

### 成熟作品与制作资料

| 具体来源 | 本轮转译成的设计 | 访问与复用边界 |
|---|---|---|
| [Journey官方介绍](https://thatgamecompany.com/journey/) | 用远方目标、行旅节奏和声音支持前进动机；终局回应先前携光经历 | V6读取官方介绍。设计推论由本项目作出；未复制角色、符号、音乐，也未复现其联网系统 |
| Giant Squid：[ABZÛ概念设计，Matt Nava](https://giantsquidstudios.com/ABZU-Concept-Art)、[Introduction](https://giantsquidstudios.com/Introduction) | 水下生物从背景变成相遇；鱼群、玩家方向与镜头保持可读的空间关系 | V6读取官方介绍及概念设计页面。不是完整游玩或取得原作算法；本项目的鱼鸟网格、行为和镜头均另行实现 |
| [Sky官方自然日更新](https://thatgamecompany.helpshift.com/hc/es/17-sky-children-of-the-light/faq/890-patch-notes---april-5-2022---0-17-0-187527/?l=zh&p=all&s=seasons) | 活物在世界中持续存在，完成后仍可重访，而非只剩一次性收集标记 | V6生态研究引用官方更新；未复制任务、美术或音频 |
| [Cornell Lab：羽毛结构](https://academy.allaboutbirds.org/feathers-article/) | 区分柔软体羽、轮廓羽和长飞羽，重新安排羽区与材质 | 生物结构参考；烁羽仍是原创幻想角色，不对应具体考古物种 |
| [Epic环境光照教程](https://dev.epicgames.com/documentation/unreal-engine/07-adjust-environment-lighting-features?lang=en-US)；[社区森林路径制作案例](https://dev.epicgames.com/community/learning/tutorials/XYeP/unreal-engine-5-forest-path-tutorial-full-workflow-breakdown) | 以局部光差、路径疏密和前中远景组织环境，避免均匀白雾、均匀树阵 | 官方教程可读；社区案例取得页面/检索信息，未宣称完整观看教程。项目没有移植Unreal体积雾或原案例资产 |
| [Three.js Reflector](https://threejs.org/docs/pages/Reflector.html)、[MeshPhysicalMaterial](https://threejs.org/docs/#MeshPhysicalMaterial) | 384px平面反射与低档/水下回退；羽片材质和规范化顶点数据 | 使用项目依赖的Three.js及其附加模块，保留依赖自身MIT许可；CPU提交耗时不当作GPU实测 |

此前还研究过[Lusion Of The Oak](https://lusion.co/projects/of_the_oak/)、[Bruno Simon源码与制作管线](https://github.com/brunosimon/folio-2025)、[Codrops ZERO](https://tympanus.net/codrops/2026/07/17/zero-the-engineering-behind-a-defiant-interactive-narrative/)与[ambientCG资源许可](https://docs.ambientcg.com/license/)，用于树木数据、输入接管、分段生命周期和候选材质库。它们属于旧研究，不计为本轮新试玩或已导入资源。具体访问限制保留在[V2登记](../v2/reference-and-asset-register.md)。

## 金沙依据与艺术解释

| 馆方资料 | 可以支持的内容 | 游戏中的原创安排 |
|---|---|---|
| [金沙遗址与博物馆介绍](https://www.jinshasitemuseum.com/node/174) | 遗址及展陈涉及生态、建筑、生产生活、祭祀等多个方面 | 五境记忆景观、路径与任务顺序；不是遗址原址地图 |
| [祭祀区古河道](https://www.jinshasitemuseum.com/seardetail/2208)、[园林生态与乌木](https://www.jinshasitemuseum.com/node/188) | 水岸、古木与生态环境可成为叙事主题 | 根冠、沟谷、深潭、飞行地形及生物相遇。现代园林植物清单不是金沙古植物名录 |
| [金沙考古与制陶线索](https://www.jinshasitemuseum.com/info/706)、[灰坑保护说明](https://www.jinshasitemuseum.com/info/1406)、[植物考古研究](https://www.jinshasitemuseum.com/info/4877) | 生活遗存、陶器和稻作研究为聚落主题提供依据；灰坑与居址周围的日常活动有关 | 编席、谷粒、木屋、晾架、田块与通水机关的具体形制和摆放；不声称出土过该场景布局 |
| [九柱遗迹](https://www.jinshasitemuseum.com/seardetail/3793) | 柱位等遗迹为开放解释提供依据 | 九柱上方光景、日轮机关与完成演出；不把某一上部建筑假说做成已证实宫殿 |
| [太阳神鸟金饰馆藏资料](https://www.jinshasitemuseum.com/seardetail/681)、[馆方铜鸟条目](https://artsandculture.google.com/asset/bronze-bird/7QH-c8Zpgsixjg?hl=zh-cn) | 器物造型、四鸟与十二芒等可核对的形制 | 烁羽性格、金羽、心灯、对话和暮湾四鸟的动态意象；象征含义不写成唯一考古定论 |

五件文物的逐项依据及原创补充见[V4来源说明](../v4/quality-and-provenance.md)。馆藏页面用于研究，未取得或使用馆藏三维扫描，亦未把网页照片直接用作游戏纹理。三类生态相遇、低声对白与配乐都是当代创作。终章四只光鸟约5.2秒合围、暮湾约8秒由冷蓝转暖的晨光，以及桌面/手机不同的结语构图，也属于原创动态演绎；整理本文时仍在最终视觉复验，不是历史仪式复原或已完成的成品认证。

## 实际使用的环境资源

以下Poly Haven资源依[官方CC0资产许可](https://polyhaven.com/license)使用。该许可适用于下载资产，不自动覆盖网页文案、标志和示例渲染；本项目未打包这些网页内容。保留署名是为了来源透明，不是为CC0添加额外条件。

| 资源 / 原作者 | 使用范围 |
|---|---|
| **V6新增** [Island Tree 01](https://polyhaven.com/a/island_tree_01) — Rob Tuytel（扫描、处理），Rico Cilliers（清理、处理） | 仅使用叶片diffuse、alpha、normal-GL三张1K原图；alpha合入颜色后输出两张WebP，总计184,502字节。八种叶片区域用于原创树冠和灌木，未导入其整株树模型 |
| [Rock Face 01](https://polyhaven.com/a/rock_face_01) — Dario Barresi | 沿用V5岩面glTF及1K PBR，缩放/转向、原创岩脚封边 |
| [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) — Rob Tuytel | 沿用V5树桩glTF及1K PBR |
| [Fern 02](https://polyhaven.com/a/fern_02) — Rico Cilliers建模、Rob Tuytel扫描 | 沿用V5蕨叶网格与贴图，实例化及小型变体 |
| [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) — Rob Tuytel | 沿用V5地表颜色/法线，V6调整草土混合与色调 |
| [Forest Floor](https://polyhaven.com/a/forest_floor) — eye-candy.xyz；[Bark Brown 02](https://polyhaven.com/a/bark_brown_02) — Rob Tuytel；[Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) — Dimitrios Savva摄影、Rico Cilliers处理 | 沿用早期1K环境贴图，离线转换为WebP |
| [Forest Slope](https://polyhaven.com/a/forest_slope) — Andreas Mischok | 沿用V4 HDR环境照明与材质反射，不作为全屏照片背景 |

V6记录：[下载目录](island-tree-files.json)、[作者信息](source/island-tree-info.json)、[转换与校验](source/canopy-conversion.json)、[随资源分发的许可](../../public/assets/v6/canopy/LICENSE.txt)。既有来源见[V5资产登记](../v5/assets-and-license.md)、[环境许可](../../public/assets/environment/LICENSE.txt)、[HDR加工记录](../v4/lighting-asset.json)。

烁羽的几何、羽片和纹理，根冠、草灌骨架、编席、谷粒，以及鱼、鸟、萤火均由本项目原创生成。使用真实叶片或扫描岩石并不证明这些植物和石面来自金沙原址，也不构成古环境复原。

## 配乐、声景与对白

### V6真实乐器采样与原创配乐

采样库为[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)，作者署名 **Versilian Studios / Sam Gossner；Ivy Audio / Simon Dalzell**。官方页面与所用仓库版本均明确为CC0；使用固定提交 `440300901dfe9275fd84e0b7763af1f8443ae62e`，对应[原许可证](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE)。V6重新在线核对了这两处，而非将专业版或其他衍生库的许可混用。

本项目取10份单音采样：长笛3份、大提琴组3份、竖琴3份、锣1份。原始URL、作者和字节数在[采样清单](../../scripts/audio-source/v6/sources.json)，许可副本在[LICENSE-CC0.txt](../../scripts/audio-source/v6/LICENSE-CC0.txt)。未使用其他游戏的成品音乐。

《万物回声》为本项目重新作曲与编排：75 BPM、4/4、D/E/G/A/B音阶材料，三条同步76.8秒声部和两段完成短乐句。地面、飞行、潜水与相遇状态改变混合，朗读时让出空间。真实采样意味着这些音色来自乐器录音，不意味着是古蜀乐器或古蜀曲谱复原。[编配记录](score-render.json)与[音频技术验证](audio-verification.json)保留解码、峰值、同时起播、暂停及长段同步证据；未把这些检查当作已完成的主观听音认证。

### 沿用V5的CC0自然实录

| 声景 | 原作者与来源 | 用法 |
|---|---|---|
| 森林 | guidofm — [Forest Ambience](https://freesound.org/people/guidofm/sounds/509176/) | 18秒片段、循环交叉淡化 |
| 溪流 | Yuval — [small stream forest](https://freesound.org/people/Yuval/sounds/197023/) | 40秒片段、循环交叉淡化 |
| 窑火 | RyanKingArt — [Campfire on the Beach](https://freesound.org/people/RyanKingArt/sounds/695769/) | 32秒片段、循环交叉淡化 |

V5核查原页面均标注CC0；本轮沿用同一批文件及[来源记录](../../public/assets/audio/v5-field-sources.json)，没有把它们列为V6新下载。录音来自现代外地环境，不是金沙现场录音或古代生态证据。V5原创合成音效与对白也继续使用，详见[此前声音说明](../v5/audio-and-licenses.md)。

### HeyGen公开声线及使用边界

烁羽沿用 **Haoran – Bright & Articulate**，录忆者沿用 **Shuxian – Clear & Trustworthy**。V6新增5段原创烁羽台词，覆盖开场、三次相遇与终章，延续V5的16段对白。原始语音按完整句子切分，保持生成音高和速度；[脚本](../../scripts/audio-source/v6/dialogue-script.json)、[剪辑映射](dialogue-edit-map.json)及实际长度用于字幕。张喙读取人声音幅，是动态开合，不是音素级口型或完整面部捕捉。

V5会话观察到HeyGen账户为免费套餐；V6沿用同一使用边界，没有据此推断商业发行权，也未购买订阅。目前按**内部本地评审**使用。HeyGen声音不是CC0，VSCO和环境素材的CC0不能替代语音服务许可。公开发行、商业用途或再次分发前应单独核定适用套餐、生成时间对应条款与具体声音权利；本文不宣称这项核定已经完成。

## 字体、代码与交付边界

本地 `Jinsha Serif` 是Noto Serif SC的游戏用字子集，原版权©2017–2023 Adobe，Noto为Google商标，按SIL Open Font License 1.1分发。原项目：[Noto CJK Serif](https://github.com/notofonts/noto-cjk/tree/main/Serif)；随包的[NOTICE](../../public/fonts/NOTICE.txt)与[OFL](../../public/fonts/OFL.txt)保留完整说明。V6将新增文案用字纳入子集，当前157,216字节；子集之外的字形仍回退到系统字体。

项目代码元数据为ISC；Three.js、Vite及其他依赖保留各自许可。ISC不覆盖所有媒体和服务生成内容。当前没有购买订阅或向公网发布。V6仍有程序化树形/羽片、简化生物行为、近似碰撞和平面反射的限制，最终生产包、整机帧时间和真机适配应以另行验收记录为准。
