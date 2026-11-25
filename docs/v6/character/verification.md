# 烁羽 V6 · 角色交付与验证

2026-11-18。本轮为实时浏览器角色的形体、羽区和表演精修，不是高模雕刻烘焙或动作捕捉。

## 已落实

- 体羽与长飞羽分材质：细密错落的软体羽、连续羽区法线、金缘弧形冠羽、玉青肩背渐变、细毛边与适度各向异性反射。
- 修正旧颈部曲面绕向导致的外表面剔除；将头颈底层重新塑成接入胸口的曲面，肩部裸露椭圆由覆羽连接。
- 胸前微光沿真实胸面附着，修正旧悬浮发光片造成的离体黑影。
- 从16骨增加到21骨：双跗关节 HockL/HockR、双眼微注视 EyeL/EyeR、下喙 Mandible。保留原骨名和13个剪辑名。
- 两段腿逆运动约束、双脚独立趾爪形变、脚掌随坡面俯仰/侧倾；站立相位脚底逐帧校正，坡向以约13Hz采样减少成本。
- 停驻后短暂理羽、离水振羽、短促有停留的注视。speaking + speechLevel 接口以实际音幅平滑控制下喙；旁白不张喙。
- 颜色用规范化Uint8、UV用规范化Uint16、蒙皮权重用规范化Uint8；位置保留Float32，无额外解码器。

## 当前资产

| 项目 | LOD0 | LOD1 |
|---|---:|---:|
| 文件字节 | 5,208,592 | 3,288,320 |
| 三角形 | 102,766 | 44,704 |
| 骨骼 / 剪辑 | 21 / 13 | 21 / 13 |

LOD0 1808根程序化羽片、12个材质网格。文件比旧V5约5.78MB更小；实际三角形增幅约11%。

## 验证证据

- node scripts/build-shuoyu-v6.mjs：重新导出两档GLB，加载后检查归一化蒙皮权重、眨眼峰值1、矩阵有限与真实渲染；0页面错误。
- node scripts/verify-character-v6.mjs：8种运动模式无非有限矩阵，平地2.8m/s支撑相位骨骼落足误差接近数值精度；5.6m/s为2.49mm，交叉斜坡为1.72mm。验证的是脚部骨架目标，不冒称所有趾尖与碰撞网格完全贴合。
- 理羽峰值1、离水振羽峰值0.98；0.8输入声幅下喙达到0.8，停止发声后回到近零。
- 原始JSON：character-asset-verification.json、character-motion-verification.json。
- 同机位对照：[comparison.html](comparison.html)。单图为 baseline-three-quarter.png 与 character-asset-three-quarter.png；back和face另有近景。
- in-world-walk-flight.webm 为本轮中间构建约10秒真实W/空格/C输入录制（Canvas MediaRecorder，非预渲染影片；无HUD）。记录0页面错误，结束仍在滑翔，不作为落地通过证据。

## 研究与边界

[康奈尔鸟类实验室：羽毛类型与结构](https://academy.allaboutbirds.org/feathers-article/)用于区分绒羽、轮廓羽与飞羽的不同视觉结构；[Three.js MeshPhysicalMaterial](https://threejs.org/docs/#MeshPhysicalMaterial)与本地GLTFExporter源码用于确认各向异性和规范化顶点数据。

全部角色几何/纹理均为本项目原创参数化生成，没有新增第三方角色资产。造型是金沙铜鸟意象启发的幻想羽灵，不是物种或考古复原。仍有可辨识的程序化羽片、简单表演调度和脚掌近似；独立肩、腕、腿、眼、下喙已具备运行时可控层次，但未达到电影角色全套面部绑定/肌肉模拟。
