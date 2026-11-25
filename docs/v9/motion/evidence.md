# V9 运动、镜头与水体证据

## 已复现

- `baseline-runtime.json`：真实键盘 D 持续 1.6 秒，角色朝向从 0.115 转到 -1.106 rad；相机 yaw 始终 0.465 rad。转向没有随行，不是玩家误操作。
- `baseline-title-dof.png` / `baseline-title-clear.png`：同一冻结的三维帧，启闭景深。冠羽上缘的柔化重影在关闭景深后明显收敛。HTML 动画仍按页面时间运行，因此这对图不用于量化 DOM 差异。角色额头曲面另由角色任务修复。
- 水边测试初始版本：水深在 0.64/0.66 m 间轻微变化，5 秒内状态切换 150 次。双阈值后保持浮游；修复不通过冻结人物位置掩盖抖动。
- `water-volume-before.json`：由正式源码的路径控制点与 320 段河面几何重建，Three Raycaster 作独立参考。在 x∈[-40,45)、z∈(-310,0]、0.65 m 间距网格上，旧最近路径公式产生 23 处河面/物理水域不一致，其中 13 处有河面但无物理水，10 处相反。断岸附近也有错位。
- 原木桥原有桥面支持，却没有桥底实体约束。垂直身体扫掠可从桥下穿到桥面。新回归先失败，再加入桥底实体与向上碰撞处理；保持桥上通行和足够净空的桥下通行。

## 已执行的修复

1. 自动随行和输入解耦：方向持续按住时保存移动基准，镜头单独追随实际行进方向；改变输入方向时从当前画面重新取向。拖动后 1.9 秒宽限，暂停不消耗宽限；长帧跨越宽限结束点时按实际剩余时长积分。
2. 镜头避障候选保留与评分余量，减少左右枝杈得分接近时的来回选择；镜头继续使用插值后的角色足点。
3. 方向光覆盖中心使用插值足点，按光空间的阴影像素网格对齐。实际 Three 阴影矩阵测试证明固定世界点的 UV 变化为整数 texel，消除覆盖中心平移造成的亚像素爬动。整体帧率和场景光栅效果仍需实机评判。
4. 标题采用宽景构图并关闭默认景深；摄影仍保留景深选择。
5. 河床、桥面支持和水面独立。水域直接查询实际河面三角形的静态 XZ 索引（640 三角形、328 空间格）。相同网格的不一致从 23 降为 0，见 `water-volume-after.json`。
6. 游泳进入深度 0.72 m、退出深度 0.45 m；深度 ≥1.45 m 才能主动下潜，浅滩有明确文字提示；潜入浅水会趋向上浮，潜底保留水态。
7. 河面透明度与河床焦散由镜头实际水深连续决定，不再跟随人物脚点硬切 0/1。全画面浸没也使用相机水面滞回；取消“刚切潜行就把镜头压到水下”的位置夹紧。
8. F 入位后柔和迎向日轮，聚光规则仍由真实人物朝向、位置与持续按住条件验证。main 传 `facingYaw`，world 提供 `focusGuide`。
9. 成长接到真实飞行耗力与闪身冷却，UI、N 成长页、B 鸣光以及帮助已接入。桥上存档恢复不会因桥下有水而把角色恢复到河中。
10. 后续真实河岸轨迹揭示另一个独立根因：旧水面半宽 6.1/3.6 m，小于开挖后的低洼河床。水面边缘处床底仍低于水面约 0.58 m，角色落地后触发岩石推出，33 ms 内侧跳 0.534 m 并重新入水。每个河面截面现查询与物理一致的 `sampleGround` 三角插值，覆盖至干岸并多遮盖 0.9 m，透明渐边隐藏在干岸下面。640 个水面三角形数量不变，深沟扩宽有限制。
11. 停枝时相机注视高度原来由 0.85 直接变为 0.62 m；现在按时间缓动。五个旧停栖点实测成功帧高度变化由 0.23 降至约 0.0255 m，最大相机帧间转角由约 3.6° 降至约 1.6°。
12. 剧情和摄影按需景深采用深度感知采样，防止清晰冠羽被远背景核复制出轮廓。首页、普通游玩、全树复苏镜头保持景深关闭。
13. 追加连续离水：潜水中真实按下并持续保持空格，上浮后短暂浮稳 0.3 秒再振翼离水；松开会取消待起飞动作。E 浮出与缺氧自动救援不启动离水，暂停也清除这个输入意图。新用例先复现旧版始终停在 swimming，再以 30/60/144 Hz 验证 diving→swimming→rising→flying，55 项相关运动测试全过；第三轮浏览器真实按键验证水面停留约 306 ms 后离水。
14. 新生树实际生长仍为 18 秒，观察镜头总长调整为 22.2 秒，18–21 秒保持成熟树冠构图，最后 1.05 秒平滑返回。导演与遮挡检查共享同一总时长常量；测试逐帧核对位置、注视点、视角，并验证成熟停留与退出。主动输入仍可立即取消镜头。
15. 后处理加载预编译按真实 pass 路径记录 GTAO、景深复制、Bloom 五层、浸没、Output 和边缘处理的材质/输出目标组合，分帧调用 `compileAsync`，不在一次同步首绘中阻塞全部链接。具体限制与本地 Three 源码依据见 `postprocess-warmup.md`。

## 验证状态

- 旧 188 项 `npm test` 已通过（首次整合之后）。
- 新增专项文件：`camera-follow-v9.test.js`、`locomotion-v9.test.js`、`water-motion-v9.test.js`、`water-surface-v9.test.js`、`shadow-anchor-v9.test.js`、`river-bank-v9.test.js`，30 项全过；覆盖实际固定步物理、30/60/144 Hz、85/120 ms 长帧、暂停、桥底、河岸滞回、浅水拒潜、连续离水、相机浸没与成长实际效果。
- 初始 V8 河面形状的前后采样审计：`node scripts/audit-water-volume-v9.mjs`。扩至实际岸坡后的实景网格审计另见 `detail-audit/result.json`：15,774 个位置由 Three Raycaster 与实际 terrain 高度判定水面，再和 traversal 水域比较，0 处不一致。
- `runtime/result.json`：两轮真实键鼠回归各 8 项通过，最新包括自动跟随、手动环顾宽限、暂停与成长页、浅水拒潜、深潜浮出、河岸横穿、五个旧停枝、终章迎日完成；WebGL 错误 0、页面错误 0。独立测试夹具仅设置出发位置/谜题前置，动作与完成通过真实键鼠触发。
- `runtime-01/analysis.json` 保留追加岸坡修复前的分析，`runtime/analysis.json` 为之后。第一轮原用例允许最多 4 次水态变化，复审轨迹后发现问题并收紧为最多 2 次；没有把宽松断言的通过作为最终验收。
- `detail/result.json`（03:34 UTC 重录）：沿 f=0.225/0.4/0.72 三处真实 W 游向岸边，均只 swimming→grounded；最大 RAF 水平位移分别约 0.098/0.049/0.073 m。桥下按空格 2.4 秒脚点最高 -1.36336 m，身体未穿过桥底。潜游侧视见 `detail/diving-side.png`。早一轮原始 JSON 曾被 audit 共用路径覆盖；现已分目录并重新实跑，当前 detail 为完整 4 项原始轨迹，audit 另存。
- `focus/` 与 `focus-02/`：冻结同一近景、同光照，旧版冠羽外围光晕在 depth-aware 图中消除，背景仍有虚化。交错预热后各 64 次整 composer 同步完成计时：旧版中位 4.1 ms / P95 7.7 ms，新版 3.9 ms / P95 8.2 ms，绘制调用均 161、GL 0。此数字含 CPU 提交与 GPU 同步，不能当正常游戏 FPS，也不足以宣称新版更快；第一轮串行测得的约 +4 ms 未在交错复测中稳定出现。
- 最新短场景实测 1440×900，多数 trace 约 59–60 FPS，河岸/终章约 56–57 FPS；P95 约 19–25 ms，个别最大帧约 47 ms。因此不宣称全程稳定 60 FPS 或全部抽帧消失。全主线与长时间负载由 root 继续综合验收。
- 进一步对齐最大帧：深潜 47.3 ms 恰在浸没值首次由 0 变为 0.0724（下潜开始后约 710 ms），对应之前未启动的 immersion pass；终章 46.8 ms 恰在聚光完成、剧情开始后下一帧。已向 root 提交“加载时预热按需后处理”的建议；前者是明确时点关联，具体因果改善仍需新实测，不能只凭代码确认。
- root 接入加载预热之后，`runtime-02/result.json` / `analysis.json` 第三轮 8 项全部通过、GL 0。首入水激活帧由 47.3 降至 17.1 ms，下潜整段最大帧由 47.3 降至 28.5 ms。真实长按空格轨迹在 1438 ms 浮面、1745 ms 离水跃升、1925 ms 转振翼。终章完成后的最大帧仍 49.2 ms（先前 46.8），因此预热并未解决终章首现帧耗时；不能把那一处问题归因或宣称修复于 DOF。
- 独立模块审查：world/gameplay 任务审过水面三角索引、分层支持与河岸搜索，并提出使用 `sampleGround` 替代解析高度，已采纳；同一任务再审 `travel-camera.js`，未发现快速触发的输入反馈死角。持续 S 后镜头转向该行进方向，再按 W 会沿当前画面前方继续，这是本版相机相对移动规则的一致结果。
- 04:06 UTC 完整 `npm test` 为 258/258，通过日志 `test-full.log`。此后追加庆典预上传两项测试并纳入常规测试命令；新旧庆典 4/4 通过。预上传测试只证明状态恢复与实际可绘对象范围，不证明 GPU 帧耗时改善。
- `finale-profile/result.json` 的首次聚光完成分析：program 数始终 119；完成帧新增三个 geometry，下一帧新增一个。与源码中首次可见的四鸟合并几何、144 粒子、薄环，以及下一帧 opacity 才大于零的回响金箔相符。完成 stage 事件 8.6 ms，下一帧 render 38.4 ms。两个庆典 helper 新增 `prepareWarmup()`，在加载真实绘制中仅暂时启用这四个对象并归零 opacity、禁止深度写入，返回幂等恢复函数。world/gameplay 独立静读确认改写状态都已恢复，且没有推进庆典时钟；仅限同步 try/render/finally 用法。

## 终章固定窗口复核

root 在同类真实 F 聚光流程中分别录下原始、只改发现提示 UI、追加四几何预上传、再重复预上传四份结果。`finale-comparison.json` 保存直接从四份原始 trace 提取的对应帧，不拿全局最大值替代完成时点。

| 录制目录 | 完成帧 geometry → 下一帧结束 | 完成下一帧同步 render | 全段最大 RAF 间隔 | 最大间隔所在帧距完成 |
| --- | --- | --- | --- | --- |
| finale-profile | 203 → 207 | 38.4 ms | 133.6 ms | +909.1 ms |
| finale-ui | 203 → 207 | 65.2 ms | 150.2 ms | +903.4 ms |
| finale-warm | 207 → 207 | 17.6 ms | 116.7 ms | +897.5 ms |
| finale-warm-repeat | 207 → 207 | 14.4 ms | 133.6 ms | +892.6 ms |

两次预上传实测都消除了完成时四个几何首次提交，完成下一帧同步 render 下降；第一次预上传的全段 render 最大 19.5 ms、total 最大 25.3 ms。但这不等于消除卡顿：四次最大 RAF 间隔均在完成后约 0.90 秒，仅相差 16.5 ms，有稳定的事件时间关联。其前一 tick 同步耗时仅 10.6 / 10.6 / 14.1 / 11.3 ms，因此现有 tick 内计时不能解释峰值，也不能将其称为“独立系统尖峰”。须进一步区分 tick 外异步任务、样式/布局/合成与先前 GPU 提交。

`scripts/diagnose-finale-v9.cjs` 新增可选 `JINSHA_TRACE=1`：至少 8 秒的真实 F 观测，输出 CDP `trace.json`，同时记录 longtask 与浏览器支持时的 long-animation-frame 脚本归因；performance marks 对齐浏览器 trace 与 RAF 日志。截图在观测和 trace 均停止后。响应变体可单独改变 discovery 动画或 growth-arrival 动画；后者支持 off / 1.4 秒 / cached（保留入场、临时验证独立合成层）。每帧也记录导演权重与实际景深 aperture。

root 随后录制的 `finale-trace/` 已定位第一次延迟峰的浏览器链：完成 +745.936 ms 重绘 `v9-growth-arrival`，+750.131 ms 开始 GPU `RendererRasterWorker` 126.87 ms，其中 raster flush 124.498 ms。Long Tasks 为空，长动画帧的 blockingDuration 为 0、tick 脚本仅 13.5 ms。详见 `finale-trace/analysis.md`。这排除了本次峰值由长 JS/tick 同步工作直接造成的解释，但具体 CSS 因果仍待隔离变体验证。discovery off 的另一次 trace 全段约 30 Hz、环境不同，不用它直接比较整体帧率；生产代码尚未因猜测而改动。

后续因果对照已收敛：仅保留 arrival 子层的 cached 会把峰移到 +6.776 秒隐藏时，已否决。关闭动画的 off 仍在 +0.709 秒出现 133.7 ms 峰，亦不能作为修复。最终给持续存在的成长 HUD 建立合成边界，保留原渐变、SVG、动画及奖励/隐藏流程。相同约 30 Hz 条件下，default 最大 RAF 150.5 ms，hud-layer 两次独立 12 秒观测分别最大 34.2 / 36.9 ms，均覆盖完成后约 8.14 秒；入场、隐藏、结尾没有延迟大峰。最终 CDP 证明三处 raster flush 最大分别 2.012 / 2.460 / 2.763 ms，相关窗口 shader cache load/store 为 0，原 124.498 ms 链未复现。原始数据在 `finale-growth-hud-layer/`、`finale-growth-hud-trace/`，独立摘录为后者 `analysis.json`。

这不表示统一达到 60 FPS，也不表示所有长帧消失：最后 trace 的完成当帧仍有 53 ms longtask / 65.1 ms LAF。最终修复范围是成长 HUD 动画/隐藏引起的特定绘制重建峰。两项 CSS 合入后的构建、UI 与生产验收由 root 另行执行；正式 20 分钟世界运动 soak 是该 CSS 变更之前的记录。

## 参考与适用方式

- [Unity Cinemachine Third Person Follow](https://docs.unity.cn/Packages/com.unity.cinemachine%402.8/manual/Cinemachine3rdPersonFollow.html)：参考跟随目标与镜头阻尼的职责划分；本项目采用自己的浏览器实现。
- [Unity Third Person Cameras](https://docs.unity.cn/Packages/com.unity.cinemachine%403.1/manual/ThirdPersonCameras.html)：参考将瞄准/镜头目标与可见人物分离的设计原则，避免输入反馈环。
- [Three.js DirectionalLightShadow](https://threejs.org/docs/pages/DirectionalLightShadow.html) 与本地 Three.js 0.185 `LightShadow.js`：核对正交阴影覆盖与实际投影矩阵，用真实矩阵验证网格稳定。
- [GPU Gems 3 · Practical Post-Process Depth of Field](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field)：核对邻像素深度拒绝可限制清晰前景串入虚焦背景，以及前景虚焦轮廓需要单独处理的边界。`focus-shader.js` 只针对“清晰前景被远景核采出轮廓”，不替换全部光学散焦模型；同帧 A/B、交错计时和实际 WebGL 编译验证后接入。

## 边界

这些变化针对具体可复现的控制、几何语义与画面连续性问题，不等同于 3A 成品认证。桥梁的身体碰撞仍采用固定 1.05 m 高的近似体积；河面物理使用静态三角高度，视觉微波高度约厘米级。河岸拓宽有 3.6 m 上限，不把低洼深沟自动填满水；透明水面的景深仍受场景深度写入方式限制，非物理多层散焦。模型动画、资产精度、整体 GPU 帧预算仍由全项目最终实玩共同验收。
