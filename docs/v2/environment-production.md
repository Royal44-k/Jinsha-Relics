# 林河寻光：环境制作与来源记录

日期：2026-11-18。对应实现：`src/v2/world.js`。

## 已实装内容

- 一块连续的 200 × 370 地形网格，包含平缓林道、隆起泥岸与下凹河床；没有悬浮岛或第三方照片背景。主路线实际弧长 **412.898 米**，起点 `(0,0,12)`。
- 两条可行走且重新汇合的支路，分别连接主路 4.5%–13.5% 和 34%–46%。两路均参与地形、植被避让和移动边界计算。
- 两处由七条有厚度树根构成的根洞；五组内弯高岩脊；这些是实际遮挡几何，不依靠关闭下一节点实现隐藏。
- 原创分枝树的三种可编辑几何变体、蕨类、草、落叶、苔石、浅河和花粉。植物以 16 个空间单元分别实例化；远单元在雾外休眠，近单元保留树冠阴影。
- 铜鸟、玉琮、金面、石虎、太阳神鸟依次位于 20% / 42% / 60% / 77% / 94%。后三类及玉琮复用本项目旧版原创几何；铜鸟在本次建立。都是参考形制的艺术模型，不是扫描件、测绘复原或考古精确复制品。
- 入口使用深林雾；首处河湾与末段逐渐过渡到较暖的空气色。少数透明几何光束仅位于揭示位置。水面采用程序波纹法线、菲涅耳颜色和高光，**没有**平面反射或真实体积光。

## 实际资产来源与处理

全部外部资产来自 Poly Haven 正式下载端点。2026-11-18 再次核验 [Poly Haven 资产许可](https://polyhaven.com/license)：资产采用 CC0，允许修改、商业使用与随项目分发。没有复制网站示例渲染、商标、演示视频或其他第三方界面。

| 本地文件前缀 | 原资产 / 作者 | 使用范围 | 处理 |
|---|---|---|---|
| `forest_floor_*` | [Forest Floor](https://polyhaven.com/a/forest_floor)，eye-candy.xyz | 连续土壤与苔藓微表面 | 1K diffuse + OpenGL normal；土壤降低饱和度，颜色与尺度统一 |
| `bark_brown_02_*` | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02)，Rob Tuytel | 原创树干、枝条和根洞 | 1K diffuse + OpenGL normal；重复 UV，较深色调 |
| `rock_boulder_dry_*` | [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry)，Dimitrios Savva 摄影、Rico Cilliers 处理 | 原创岩块、岩脊、铜鸟表面微变化 | 1K diffuse + OpenGL normal；顶点变形与平滑法线 |

最终文件、精确下载 URL、CC0 标记、字节数与 SHA-256 位于 `public/assets/environment/manifest.json`。原始 JPG 合计 **6,046,880 bytes**，浏览器 Canvas 转为 WebP（颜色 .82，法线 .92）后合计 **2,255,694 bytes**，减小约 **62.7%**。最终只保留六张 WebP；原下载路径可从 manifest 重建。转换代码在 `scripts/prepare-environment.cjs`，尺寸不变。当前不是 KTX2/Basis GPU 压缩纹理。

树叶透明纹理、叶脉、树枝、蕨类和地形均为本项目生成的原创源代码资产。树叶不使用网上图片剪贴。未使用 Poly Haven 苔石或蕨类模型，未采用 HDRI 背景，避免误写为已导入扫描模型。

## 接口与集成

`createForest(scene)` 返回 `path / length / sample / project / constrain / update / landmarks / dispose`，并提供 `ready`（六张本地贴图已完成或失败）、`group`、`sidePaths`、`colliders`、`cameraColliders`。

- `sample(distance)` 返回地面高度为 0 的 `Vector3`。
- `project(position)` 返回主线等效距离、最近中心点和偏移；支路按端点主线距离映射。
- `constrain(position)` 保留传入 y，只限制横向可走范围和近地实体；支路与主路按走廊并集处理。
- `landmarks[].object` 仅含器物，便于主程序克隆到独立检视器；台座与灯光放在其父组。
- `cameraColliders` 包含实心树干/根/岩，不含树叶或雾。主程序应仅对可见单元和附近障碍进行镜头检测。
- `update` 会更新该场景的 Fog 颜色、近远距离与纯色背景。基准实机预览灯光：半球光 .95、暖主光 3.9、曝光 .97、环境反射 .35。主程序可按角色曝光继续校准。

## 实机核查与限制

测试入口 `forest-preview.html` 是隔离环境的开发预览，不是交付主页。`node scripts/check-forest.cjs` 使用本机 Edge 无头模式、1440 × 900、DPR 1、2048 阴影图。最近一次详细结果在 `forest-check.json`，五个固定截图为 `forest-entry.png` / `forest-root-vault.png` / `forest-river.png` / `forest-jade.png` / `forest-sun.png`。

最后一次脚本退出码为 0：贴图成功加载，无 JS/GLSL 报错；501 个主路中心点与每条支路 101 个中心点约束位移均为 0。五个前章位置到下一器物的测试射线全部命中实际树干、根洞或岩脊，结果在 `forest-sightlines.json`；这是固定视线测试，不等于所有自由镜头均已穷举。实测五镜头 61–167 draw calls、837,822–1,764,694 三角形（含阴影 pass）。后续整合版角色、镜头和游戏输入仍以主程序的全流程测试为准。这些数据不是 GPU 耗时或硬件帧率的替代指标。

当前生产方法是程序几何 + 授权 PBR 表面的浏览器实现。没有完成专业雕刻、手工地形雕绘、烘焙 AO、多级网格 LOD、GPU 压缩、真实体积光、屏幕空间反射或逐物种植物制作；树林仍有可辨重复，支路边界是简化路径约束。这些是与高预算 3A 制作的明确差距，不能以构建或脚本通过宣称已经达到。
