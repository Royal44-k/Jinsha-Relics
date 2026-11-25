# 终章延迟峰：第一份浏览器 trace

原始证据：本目录 `result.json` 与 `trace.json`，由 root 实际按 F 完成终章。观测约 8 秒，截图在停止采样之后。观测代码不修改游戏源码；fixture 只满足前四境，终章必须真实聚光完成。

## 时钟对齐

`jinsha-finale-profile-start` 的 CDP `ts = 18292107319 µs`，对应页面 `performance.now() = 19159.7 ms`，二者差 `18272947.619 ms`。完成事件所在 tick 从页面 `23080.2 ms` 开始。下表统一相对此 tick 起点。

| 事件 | 开始时刻 | 持续 |
| --- | --- | --- |
| Paint：`DIV id='v9-growth-arrival'`，nodeId 44 | +745.936 ms | 0.048 ms |
| 第一条 RasterTask，layerId 48 | +746.844 ms | 0.163 ms |
| CrGpuMain：RendererRasterWorker | +750.131 ms | 126.870 ms |
| RasterDecoderImpl::DoEndRasterCHROMIUM::Flush | +751.303 ms | 124.498 ms |
| DXGISwapChainImageBacking::Present | +877.543 ms | 17.654 ms |
| 下一次观测到的 tick | +895.900 ms | 13.400 ms |

该 RAF 间隔为 116.8 ms。上一 tick 同步耗时 9.3 ms、render 7.5 ms；Long Tasks 为空。浏览器报告一条 Long Animation Frame，duration 134.4 ms、blockingDuration 0，里面只列出 tick 脚本 13.5 ms、forcedStyleAndLayoutDuration 0。因此现有证据将这次停顿定位到浏览器 GPU 光栅提交链，不能归为主线程长脚本、同步布局或 GC。

`growth-arrival` 的重绘紧接在长 GPU raster 之前，比单独的时间吻合提供更多线索。成长提示原入场动画为 .7 秒，HUD 每约 .08 秒刷新，和 +745.9 ms 的重绘接近。fixture 中四任务为 8 生息、青翎，终章增至 10 生息时触发曜羽；实际提前完成遭遇的玩家可能更早触发这个提示，所以这不是只属于终章的潜在问题。

进一步抽取同一 Flush 内部事件，出现四对 `GrShaderCache::load` / `store`。每对 load 到 store 间隔约 34.68 / 43.89 / 6.65 / 35.78 ms，共约 121.0 ms，接近总 Flush 的 124.5 ms。该证据与 Skia 后端 shader 准备相符；trace 没有显式的 Compile / Program 编译节点，因此不能把这四个区间直接表述为精确驱动编译耗时。完整摘录在 `raster-window.json`。也不能保证 layer 48 的每项绘制都属于单一 DOM 元素。

Chromium 官方源码说明 `load` 查询内存缓存、`store` 保存新生成或再生成的 shader；trace 中这些 cache 函数本身仅约 4–37 微秒，长耗时发生在它们之间。源码用于解释事件语义，并非当前 Edge 二进制的逐行构建证明。[Chromium GrShaderCache](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/service/gr_shader_cache.cc)

## 对照限制

关闭 discovery 动画的另一份 trace 全段约 30 Hz，render 最大 38.6 ms，与本次环境的约 60 Hz 不同，不能直接用两者比较整体帧率。后续先用无 CDP trace、保留 Long Animation Frame 记录的相同流程做固定窗口比较，再用一份 trace 确认 GPU raster 链。

`JINSHA_GROWTH_ANIMATION=off` / `1.4` / `cached` 只改变响应中的成长提示 CSS；cached 保留 .7 秒入场，给这个元素追加 `will-change:transform,opacity`。它们均保留成长奖励、角色外观、场景、剧情与所有其它动画。生产代码在这一步未改变。

## cached 反例：必须覆盖隐藏阶段

在无 CDP、保留 PerformanceObserver 的同约 30 Hz 条件中：

- `finale-growth-default` 观测完成后 8.128 秒，+924.8 ms 仍发生 150.5 ms RAF 间隔。对应 LAF 从 +787.3 ms 开始，持续 166.5 ms，blockingDuration 0。
- `finale-growth-cached` 只观测完成后 4.139 秒，看似已消除原延迟峰；终章之后 RAF 最大 33.9 ms。全段仍有三条约 50–55 ms LAF（完成前及完成帧附近），不能声称全段无 LAF。
- 延长到完成后 8.144 秒的 `finale-growth-cached-12` 显示：原 +0.9 秒峰没有出现，却在 +6776 ms 出现 133.4 ms RAF 间隔；LAF 从 +6660.4 ms 开始，持续 143.3 ms、blockingDuration 0。它位于提示的 6500 ms 隐藏流程附近。

因此 cached 只把开销延后，已被否决为最终修复。继续准备只改背景的 flat、只限制提示绘制边界的 contained、给持续存在的 HUD 建立合成边界的 hud-layer 响应变体；每种都必须观察提示出现、入场结束、6500 ms 隐藏和终章退出，不能以短测峰值消失代替完成验证。

关闭成长入场动画的 `finale-growth-off` 仍出现 133.7 ms RAF 峰，改在完成后 +709.1 ms；LAF 从 +584.8 ms 起持续 149.2 ms。这个时间也接近成长小条 .5 秒 transition 结束，说明不能把问题草率归为只有 arrival 入场动画。flat 与 contained 仅准备诊断开关，没有用于最终结论，也没有作为产品降级方案。

## 最终采用：稳定的成长 HUD 合成边界

`hud-layer` 仅在持续存在的 `#v9-growth-hud` 上增加 `will-change:transform; transform:translateZ(0)`，保持原入场动画、渐变、SVG、成长奖励与 6500 ms 隐藏流程。它改变绘制边界，避免子元素动画结束/隐藏时重新并入大范围外部 HUD raster。

| 对照 / 复测 | 完成后覆盖 | 全段最大 RAF | 入场末尾 +0.5–1.2s 最大 RAF | 隐藏 +6.2–7.2s 最大 RAF |
| --- | --- | --- | --- | --- |
| 原始 default，LAF 观测 | 8.128 s | 150.5 ms | 150.5 ms | 没有同类峰 |
| hud-layer，LAF 观测 | 8.145 s | 34.2 ms | 33.6 ms | 33.9 ms |
| hud-layer，另加 CDP trace | 8.144 s | 36.9 ms | 33.6 ms | 33.7 ms |

这三份同阶段录制的中位 RAF 均约 33.4 ms，不能说把游戏从 30 FPS 提升到 60 FPS。结论是：目标事件的 100 多毫秒延迟峰在保留视觉的独立复测中消失。

最终 CDP 原始数据在 `../finale-growth-hud-trace/`，时钟对齐和关键事件摘录见该目录 `analysis.json`。原本 124.498 ms 的 raster flush 所在入场末尾窗口，现最大 2.012 ms、shader cache load/store 都为 0；隐藏窗口最大 flush 2.460 ms、load/store 为 0；终章退出窗口最大 flush 2.763 ms、load/store 为 0。提示仍重绘、仍按时隐藏，未把大峰延后到退出。WebGL 错误和页面错误均为 0。

适用限制：这些是当前 Windows/Edge/GPU 下的因果对照，不代表所有设备的统一帧率。最终 trace 的完成当帧仍记录一次 53 ms longtask 和 65.1 ms LAF，tick 脚本约 31.2 ms、blockingDuration 1.5 ms；不能声称全程无长任务或全部抽帧已消除。root 据两轮对照把上述两项 CSS 属性并入产品，再独立进行构建/UI/生产回归。此前的正式 20 分钟世界运动 soak 发生在这项 CSS 修正前，不能改称包含修正后的 soak。
