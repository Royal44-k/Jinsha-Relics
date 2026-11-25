# 潜游羽毛反光诊断与修正

2026-11-20 03:35–03:45 UTC，单个 Edge 浏览器串行运行；使用真实游戏关卡、实际 C 下潜、空格上浮、W 游到河岸。只有起始位置使用开发夹具。每组冻结实际 RAF，恢复所有材质、环境和 Bloom 后再单独改变一个变量；曝光、灯光、相机和动画时间不变。没有调暗整个场景。

## 三轮证据

- `round-1`：初次单变量诊断。潜游组完成，浮面组最后的时间断言失败：脚本在两个分开的 RPC 中先取状态、后冻结，之间正常推进了 16.8 ms。已保留原始失败报告，不列为完整三状态验收。后续改为同一个 RPC 先冻结再取状态。
- `round-2`：旧运行时的 3 个状态 × 9 个选项，共 27 图，时间不变断言通过，GL/页面错误为 0。`no-gold` 几乎不改变白斑；`no-environment` 主要压暗阴影侧而保留直射白斑；仅提高 roughness 稍有改善；潜水羽毛相对 IOR 明显收敛白闪片。组合保留受光羽片与曲面起伏。
- `final`：真实新运行时潜游、浮面、真正走上干岸，6 图；时间/机位断言与错误检查通过。
- `final-angles`：新运行时 3 个潜游机位、浮面、干岸，共 10 图；`*-baseline.png` 是实际新代码无覆盖渲染，`*-legacy.png` 是同一冻结帧只恢复旧羽材质参数的对照。侧/前机位是冻结后绕相机目标旋转，并非玩家运动录像。5 组时间/相机保持、GL0、页面/console error0。

## 实际代码

`src/v2/character.js` 当前 34,102 B，SHA-256 `490f90876fc5361a7400dedee94462f152428357e172def8edc5e3d4ac27a83c`。此前运行时保存在 `character-before.js`；GLB 不变。

1. 主飞羽湿态 roughness 目标由 .48 提高到 .65，保留原有湿度渐变。干态仍 .78。其他羽区粗糙度、金边、眼睛不改。
2. 仅潜游时物理羽材质的 IOR 随既有 `dive` 姿态权重从 1.5 过渡到 1.5 / 1.333；浮面与湿岸上回到空气界面。与真正水的折射率比值有关，但这是单层材质近似，不能宣称模拟真实羽毛气囊、水膜和多次散射。
3. 未关闭高光、未取消环境反射、未降低全局曝光或关闭 Bloom。

## 读图与数值

`pixel-analysis.json` 只读取原始 PNG，不做图像编辑。固定 `(520,270,400,390)` 矩形包含角色与同帧不变的背景；指标是显示图像亮度，不能当作 HDR 辐照度或精确角色分割。潜游后视亮度大于 .8 的像素为 607 → 0，近白像素 44 → 0；侧视 1,272 → 391；前视 2,712 → 588。侧/前视仍保留亮羽，说明本轮没有以消除所有高亮为目标。后视矩形平均亮度 .325 → .317，主要收敛峰值而非整体大幅变暗。

`material-cpu.json` 使用真实高/低 GLB、实际角色运行时，30/60/120 Hz 共 6 组：潜水 → 暂停 → 浮面 → 湿岸 → 30 秒干燥。暂停时材质完全保持；眼材质不变；干后 roughness 最大残差 3.14e-10；IOR 复原；材质 version 增量 0，没有由本次状态变化请求 shader 重编译。30 Hz 最大单帧 IOR 变化 .1062，小于完整变化的一半。该 CPU 检查不代替 GPU 帧率测量。

## 原理来源

- [PBRT 4 — Specular Reflection and Transmission](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission)：介质界面相对折射率与 Fresnel 响应。
- [Three.js — MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)：非金属 IOR 与 specular 参数的含义。
- [Filament — Physically Based Rendering](https://google.github.io/filament/Filament.html)：介电材质 F0 与折射率的关系。

以这些一般光学原理提出候选后，才用实际同帧 A/B 选取。没有把资料中的一般公式当成精确生物羽毛测量值。
