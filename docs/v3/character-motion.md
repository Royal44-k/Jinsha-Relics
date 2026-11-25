# 烁羽：动作与材质迭代

2026-11-18。本次交付改进真实 GLB 的运行时骨骼动画，保留原始可编辑源 `scripts/build-shuoyu.source.js` 与两份 GLB；没有重新生成或替换模型。模型仍为原有 16 根骨骼、13 段库存动作、LOD0 50,146 三角面。本次没有把它称为 AAA、美术师雕刻或高模烘焙资产。

## 原因与实现

旧运行时同时播放 IdleBreath、Walk、Run、Listen 等片段，多个动作竞争相同骨骼；Walk 的脚掌旋转也没有抵消腿部旋转。独立 GLB 基线实际采样显示支撑脚最低穿过平面 0.0251 米。新增 mode 参数在旧实现中完全没有泳潜或栖枝动作效果。基线证据保存在 `character-baseline.json` 和 `character-baseline.png`。

新运行时只让 AnimationMixer 播放胸部呼吸缩放和眼睑 Blink 两个不重叠通道。其后按实际移动状态生成单一骨骼姿态层：

- 步行以实际水平移动距离推进周期。左右脚相差半周期，61% 周期为支撑期，39% 为摆动期；支撑脚相对身体的后移速率匹配输入的世界移动速度，摆动脚抬起并平滑前送。骨盆有低幅左右承重转移及上下起伏，胸、头、尾有反相补偿。
- 脚踝目标由现有 Leg → Foot 骨骼链对齐，脚掌反向旋转保持水平。源模型没有膝关节，使用有限的单段腿长度调整（0.64—1.25 倍）完成约束；这不是完整的膝盖/踝关节双骨 IK。正常走路与疾跑时把落脚平均位置移到髋部下方，避免前伸过长造成滑步。
- 起飞状态有短暂胸部前倾、展翼、双脚收拢；空中按输入拍翼强度决定肩部弧度与拍频，腕/外翼相位滞后。前飞按速度前倾机体，悬停保留直立姿态；转动以胸下方为中心，避免身体绕脚原点偏离物理位置。滑翔保持展翼，加入低幅腕部变化、尾端和胸部呼吸。bank 控制身体侧倾、双翼不对称角度及头部补偿。
- 落地由上一帧垂直速度控制骨盆压缩，羽翼随后收回；足部在 grounded 帧立即恢复接触，避免空中腿姿态淡出时穿过地面。
- 栖枝缩小两脚间距，身体轻微平衡、头部反向补偿；在现有脚部网格增加 PerchGrip 位置和法线形变，前后趾向下收拢。它是一个连续形变，不是每根脚趾独立关节，也不会探测每根树枝的曲面。
- 游泳有胸颈前倾、左右脚交替划水、脚掌回收、尾部转向；潜水进一步俯身、收翼、双腿后收，保持较小的脚和尾划动。泳姿与水位、真实浮力、穿越障碍由物理模块决定。
- 视线、冠羽、呼吸和眨眼只用小幅度次级动作；不让“倾听”等片段同时抢占步行骨骼。

羽片仍为原模型双面曲面。运行时新增 128×256 羽枝方向粗糙度纹理，降低羽毛金属度和法线强度，减轻硬塑料般高光。wetness 平滑改变羽毛、绒毛和脚部的粗糙度及少量颜色；浸水更快、干燥更慢。这些是原创程序化材质细节，没有声称使用照片扫描、实体羽绒、高模 AO 或毛发系统。

## 接口

```js
const bird = await createCharacter({ lod: 0 });
bird.update(dt, elapsed, {
  speed, gliding, listening,
  mode, verticalSpeed, bank, pitch, wingbeat, stamina, wetness,
  grounded, perchId, sampleGround,
});
bird.trigger('Resonance');
bird.dispose();
```

`mode` 支持 grounded / rising / flying / gliding / falling / swimming / diving / perched。未传 mode 时保留旧 gliding 布尔接口。speed 是世界单位/秒的真实水平速度，bank、pitch 是弧度；pitch 沿用物理模块“负值爬升”的意图约定，机体局部 X 旋转据此取负。wingbeat、stamina、wetness 是 0—1。grounded 字段保留兼容入口，实际姿态以 mode 为准。perchId 记录到 `group.userData.motion`，物理代码决定选中哪根树枝。

外层 group 的位置和转向完全由主控负责；本模块只修改其内部骨骼。脚底是 group 的 y≈0.005，整体高度约 1.26。地面和树枝的 group.y 应是接触平面；游泳时主控将脚原点放到水面以下约 0.42 米。胶囊元数据仍为半径 .22、高 1.06、中心 .53。推荐地面 1.9、疾跑 3.3 单位/秒，匹配本轮验证范围。

`trigger` 支持 Resonance、Listen、StartleRecover、Land、Start、Brake；它驱动有限的姿态包络，不再并发播放整套库存动作。GLB 中原始 13 个动作仍保留，供编辑器继续修改。dispose 可重复调用，释放新粗糙度纹理、网格、材质、骨骼与混合器。

可选 `sampleGround(worldVector3)` 返回该世界坐标 XZ 位置的地面数值高度。仅 grounded 时按每只脚的实际目标位置查询，经过 local/world 坐标转换；与角色原点相差超过 ±.25 米的高度进行限制。主程序集成可传 `p => traversal.sample(p).groundHeight`。栖枝时不会把树枝当成地面查询；脚掌仍采用水平姿态，尚未按地形法线旋转每根脚趾。

## 实际验证

运行 `node scripts/preview-character-v3.mjs`。脚本建立隔离的本地 Vite 5193 端口，导入实际 GLB 和当前运行时，逐帧读取真实蒙皮足部顶点，并生成 1600×960 八姿态图。浏览器、服务和资源在结束后释放。该脚本不是帧率测试，也没有把循环次数当成实时 FPS。

最终报告：`character-verification.json`；图像：`character-contact-sheet.png`。已查看图像，八种姿态完整入镜，栖枝图展示简易树枝，潜水视角单独居中；它们是资产预览，不能替代主场景的水面/障碍/交互验收。

| 实测项目 | 结果 |
|---|---|
| 0.6 / 1.9 / 3.3 速度，各 180 帧支撑脚最低/最高高度 | 均约 +0.005199 米 |
| 支撑期脚踝相对速度匹配误差 | 最大约 3.33×10⁻⁹ 米/帧（恒速平面） |
| 平移并旋转后的斜坡左右踝高度误差 | 约 1.1×10⁻¹⁶ / 1.8×10⁻¹¹ 米 |
| 栖枝跳过地面采样 | 通过 |
| 眼睑形变峰值 | 1 |
| 所有采样骨骼矩阵 | 有限值，包括 NaN/Infinity 输入防护 |
| 充分浸湿时羽毛粗糙度 / 5 秒干燥后 | 约 .3913 / .8943 |
| 旧 gliding 接口 | 正确进入 gliding |
| PerchGrip 形变 | 存在且连接到蒙皮网格 |
| 双次 dispose | 无异常，角色从场景移除 |
| 页面脚本错误 | 0 |
| 本地渲染器报告 | ANGLE / AMD Radeon(TM) Graphics / D3D11 |

另执行 `node --check src/v2/character.js` 与 `node --check scripts/preview-character-v3.mjs`，均退出码 0。

## 边界

脚步可按每足位置采样坡面高度；脚掌未按地形法线倾斜，急转、非匀速、陡坡及复杂地形仍可能有短暂脚滑或脚趾局部穿过坡面。没有膝关节和独立脚趾骨骼，腿部折叠与抓枝还不具备真实鸟类解剖。羽片偏规则，展开的原始翼羽从部分正面角度仍显薄；本轮通过姿态与材质改善，未制作新翼面拓扑。潜水姿态是风格化定向动作，未加入流体动力学、羽毛浸湿结束或逐羽柔体求解。

本轮独立验证覆盖姿态、恒速平面接触、兼容输入和资源清理；主场景的起跳越障、树枝高度、入水衔接、摄像机与整体性能需以集成验收结果为准。

使用的官方接口依据：[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)、[SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)、[MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)。
