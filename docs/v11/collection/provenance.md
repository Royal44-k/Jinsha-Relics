# 金沙珍藏与羽装

## 馆藏依据

| 游戏观察 | 对照材料 |
| --- | --- |
| 陶片层位、旧河岸、象牙 | [成都金沙遗址博物馆遗址介绍](https://www.jinshasitemuseum.com/info/706) |
| 秋枫原位树根、古河道乌木 | [馆方介绍遗迹馆秋枫树根](https://www.jinshasitemuseum.com/info/4060) · [乌木林](https://www.jinshasitemuseum.com/seardetail/715) |
| 十节青玉琮 | [馆藏尺寸、纹饰和孔壁加工特征](https://www.jinshasitemuseum.com/seardetail/679) |
| 尖底陶杯 | [馆方介绍金沙各期陶器的形制变化](https://www.jinshasitemuseum.com/info/2200) |
| 青铜鸟形器 | [馆方铜鸟条目](https://www.jinshasitemuseum.com/seardetail/2382) · [古蜀文物教学图录中的金沙铜鸟](https://mooc1.chaoxing.com/mooc-ans/ztnodedetailcontroller/visitnodedetail?_from_=&courseId=84740038&knowledgeId=84740048&rtag=) |
| 太阳神鸟金饰 | [馆藏尺寸、厚度及内外两圈图案](https://www.jinshasitemuseum.com/seardetail/681) |
| 九柱建筑遗迹 | [馆方介绍实测柱洞与复原方案](https://www.jinshasitemuseum.com/seardetail/3793) |
| 终章特别展品 | [成都金沙遗址博物馆 · 商周大金面具尺寸、镂孔与内外表面处理](https://www.jinshasitemuseum.com/node/197) |
| 纺织、制器与渔猎工具 | [馆方介绍金沙居址、墓地和生产工具](https://www.jinshasitemuseum.com/info/706) |

游戏内每张卡将考古依据、观察方法与情景演绎分别标明。教学用剖面、工具位置、展台、测试用陶片和部分羽色均为本作设计。地图上的石璧坯料是用于俯察成组坯料摆放的虚构练习件。

## 探方剖面

西窗、东窗与放大镜共用现场的滨河土壁美术和砂泥界线。原位来自 900 像素宽的现场底图，局部细节从同一份原始纹理重新投影。四处取样练习引导玩家记录粒度、根隙、覆盖关系与待核对信息。梅苑真实剖面的堆积厚度、层数可查[成都金沙遗址博物馆的发掘介绍](https://www.jinshasitemuseum.com/seardetail/706)。剖面比较方法可查 [Historic England 田野记录手册](https://historicengland.org.uk/content/docs/research/historic-england-archaeological-recording-manual-2018/)。

## 图像与三维

土层、河湾、根盘、尖底陶杯、象牙和柱洞的图版来自本轮以 ImageGen 生成的一幅九宫格插画。三件野外拾遗中的纺轮、璧坯、网坠另绘于等宽三联画中，再分别裁成独立 WebP。游戏按需加载，图注标明创作示意。铜鸟、玉琮、金饰的静帧与可旋看的器物对应同一份项目原创几何模型。实物说明链接指向馆方资料。

三套羽装在项目烁羽骨骼模型上增加独立的初级飞羽、颈部飘羽或冠羽，染色保留原有羽轴明暗。阶数决定附属飞羽数量。九张透明底预览直接渲染这只角色的三套羽装与三档羽阶。

终章金面具沿用项目原有薄片的五个真实开孔，在独立展台中重新塑造鼻梁、鼻翼、眉脊、颧骨与耳窝。前面、内面和剪切边分别着色。整器、眼口、鼻耳、内面四张静帧均由这件模型在对应视点渲染，设备无法启用三维时仍可逐项观察。终章完成记录控制解锁，览展操作独立于阅历结算。

`node scripts/render-collection-forms-v11.mjs` 使用实际 WebGL 模型与材质重新渲染上述十二张图片。动态展台支持触拖、方向键、侧光与近看，仅在需要重绘时提交一帧。

## 验证方式

- `node --test scripts/collection-v11.test.js` 验证存档、首次采集、答题、重试、累计与可用阅历、升级消费、两页同时操作及存储禁用。
- `node scripts/check-collection-v11.mjs` 用预置九处已完成记录打开正常标题页，操作珍藏和换装。桌面与窄屏截图、检验结果位于此目录。
- `node scripts/check-collection-migration-v11.mjs` 在运行中的本地游戏验证空档、新旧旅程选择、重访和加载后的实装。可以用 `JINSHA_ORIGIN` 指定入口。旧档分支只预置 V10 记录，V11 收获和消费通过实际界面完成。
- `node scripts/check-gold-mask-v11.mjs` 在独立展厅测试实际模型旋转、真实触摸输入、四视点、离开销毁和缺少 WebGL 的静态降级。加上 `--render` 可同时重新导出四幅对应的静帧。
- `node scripts/check-strata-lens-v11.mjs` 检查两种分辨率的土壁对齐、鼠标取样、方向键换层、触摸放大与关闭回收。加上 `--render` 可从现场原始土壁纹理重建高清剖面。

