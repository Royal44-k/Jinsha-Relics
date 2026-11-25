# V6 林河环境精修交付

2026-11-18，本子任务约11:38–12:24 UTC；生产代码在12:23冻结，供主任务整合验收。不是3A成品或全部设备性能认证。

## 可见变化

- 入口七层整齐倒U根门改为两株斜生树干的交错根冠；根脚、侧枝、断尖、苔脊与下垂细根来自不同曲线。可见木材合并为少数绘制批次，中央开口仍可步行与飞行通过。273个碰撞采样来自同一组曲线，补足之前根门没有实体碰撞的问题。
- 八种带细脉、破损与颜色差异的真实叶片图集替换手绘树冠叶；现有树骨架仍为原创程序模型。树群按疏密斑块分布，并调整尺度、冠幅与轻微倾角；入口添加有目的的前景树框。
- 修正原地表草土混合：聚落坡地原有效草权重仅约0.56，暖色顶点染色过重。现在非主路径更连续地覆草，主径保留裸土；未改变可达地形高度。
- 4735簇细草、1105株七枝灌木分区实例化。灌木为低矮宽冠、三株一簇的连片地被，留下大块空隙；细草与叶片会随风及角色靠近弯折。高低档控制实例量与可见距离。
- 河岸新增避开河心的漂浮叶簇；屋内现有木台增加细编席与谷粒，作为日常劳动的艺术叙事。没有新增不可见墙或无法进入的装饰房屋。
- 高档河面使用真实384×384平面反射，每帧反射场景树影、岸坡及角色；曲折岸线与旧水面一致。菲涅耳混合、细波扰动与日光反射一起工作。低档与水下自动回到原水面；不是SSR、光线追踪或流体模拟。
- 增加根冠开口内的局部斜光，调整聚落冷暖平衡；没有全屏白雾遮挡。根冠斜光仍是深度测试透明几何，不冒称体积光模拟。

## 文件与接口

- src/v2/world.js：原始森林、非对称根冠、同源碰撞、树群、树叶UV、地表材质。
- src/v5/chapter-data.js：五区光色。
- src/v5/chapter-world.js：整合细景/反射、调整挂根、扫描资产镜头遮挡。
- src/v6/world-details.js：细草、枝叶灌木、浮叶、编席、谷粒及局部斜光。
- src/v6/world-water.js：384px平面反射及低档/水下回退。
- chapterWorld.warmup(renderer,camera)：须在主场景首次render已经初始化阴影后调用；复用已编译的场景程序并提交首轮反射。不能在阴影贴图尚不存在时先调用Reflector。
- chapterWorld.stats()新增living与reflection统计；reflection.cpuSubmitMs仅CPU提交时间，不是GPU时间。

## 资源与许可

新增运行时图片总计184,502字节：75,020字节颜色/透明度、109,482字节法线，均1024px WebP。没有新增重量级树模型。

[Poly Haven Island Tree 01](https://polyhaven.com/a/island_tree_01) 叶片纹理由Rob Tuytel（scanning, processing）及Rico Cilliers（cleanup, processing）创作；[官方许可](https://polyhaven.com/license)为CC0。本次只用leaf diffuse、alpha与normal-GL，不使用树模型或网页展示图。把alpha合入颜色并编码WebP；八个叶片区域映射到原创几何上。不把该现代植物素材认作金沙具体古植被复原。

官方manifest：island-tree-files.json；作者信息：source/island-tree-info.json；三份原始PNG与MD5/输出记录：source/canopy-conversion.json。可复现处理：scripts/prepare-canopy-v6.cjs，依赖本机Edge与5186开发服务。运行时许可随public/assets/v6/canopy/LICENSE.txt分发。

既有岩石、树桩、蕨叶与草地PBR继续沿用V5来源，见../v5/assets-and-license.md。

## 研究如何进入设计

- [Epic：环境局部雾与光照](https://dev.epicgames.com/documentation/unreal-engine/07-adjust-environment-lighting-features?lang=en-US)：采用不同高度/局部的层次思路，避免统一灰雾压平场景；本项目没有移植Unreal体积雾。
- [Epic社区森林路径案例](https://dev.epicgames.com/community/learning/tutorials/XYeP/unreal-engine-5-forest-path-tutorial-full-workflow-breakdown)：用路径、植被疏密和前后景构图组织浏览器场景，不复制代码/成品。
- [Three.js Reflector官方文档](https://threejs.org/docs/pages/Reflector.html)：真实平面反射，384px、MSAA=0、clipBias=.003；保持低档回退并计入额外渲染成本。
- [金沙博物馆考古介绍](https://www.jinshasitemuseum.com/info/706)：制陶与生活空间线索延续到现有陶火场景；[灰坑保护说明](https://www.jinshasitemuseum.com/info/1406)说明日常器物、房屋居址周围生活遗存也是文化叙事的一部分。编席/谷粒摆放、植物形制、根冠、光效均为艺术设计，不声称出土了该布局。

## 验收证据与边界

scripts/verify-world-v6.cjs：五境高低档预览、首次已render之后的warmup、根冠中央通行/根基实体、水下回退全部通过；浏览器错误0，warmup前后GL0。截图为world-captures/before-*.png和after-*.png；source及pass1–pass4保留迭代过程。

最后一轮预览的1440×900静止采样，中位约16.7ms；湿地/聚落/暮湾p95约16.8–17.1ms，但入口高档p95为133.5ms、岩廊高档为100.2ms，不能据此称全程60fps。该次运行时其他协作任务也可能在用GPU，且只给1.5秒稳定期；这些长尾已原样保存，不删异常数据。高档draw154/268/260/257/121，低档142/135/146/146/71。预览没有主游戏角色/后处理，最后发布判断应以主任务独立主游戏测试为准。

另外9项既有空间/碰撞单元测试通过；生产包构建、全章节实机与移动端矩阵由根任务统一验收。还存在程序树形、简化近景枝叶、无专业高模烘焙与动态刚体树枝等限制。

## 主控后续整合

主控补入河道40段保守视锥判定，只有完全离屏时省略额外反射，重新入镜当帧刷新；实页结果见 [reflection-runtime.json](performance/reflection-runtime.json)。局部点光与角色侧光由固定槽位驱动，避免区域显隐改变着色器灯光数量，原光源的颜色、范围与可见条件仍用于选择。最终统计见 [统一验收](verification.md)。
