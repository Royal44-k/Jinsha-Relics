# 烁羽 V9 — 角色精修与成长外观

2026-11-20，当前任务角色分支。基线：V8 2026-11-19 07:43 GLB，已复制至 `docs/v9/baseline/character`；运行时基线由主代理保存于 `docs/v9/baseline/src/v2/character.js`。

## 用户问题与证据

用户实际指出：标题页眼睛以上雾蒙、水波状失真，整体精度仍不足。V8 近景无景深图片也可见平板状眉羽、局部脱离头壳的冠覆羽、圆球式眼盘和头颈交界。这些是模型问题，不能靠关闭景深掩盖。motion 分支已确认标题景深使用固定 focus=3.0，需要同构图关闭景深 A/B；我不修改 main.js。

代码核对：头壳使用带纬度修正的椭球，额头细羽却使用另一套球面方程及 clamp(.01)，冠覆羽为直线弦。两套曲面不一致，会产生嵌入、悬空和相近深度薄片。羽片法线混合到另一套未变形椭球也会产生不连续。V9 先统一贴附曲面，再讨论材质强弱。

## 艺术方向

维持同一只象牙白、青玉翅背、琥珀眼的金沙羽灵。让眼周、喙根、额冠和肩翼更像一套有组织的羽区；避免继续用成排外露鳞片堆细节。三根冠羽保留辨识度，颜色进化只占冠羽、内翼和尾羽。

标题建议：角色约画面高度 18–25%，位于斜向树枝/石阶前景，背向未知峡谷并短暂回望；环境、天空日轮和远方遗迹形成叙事。不要把目前程序模型放大为半屏特写。角色档案使用受控近景、自然中性光；标题默认关闭景深。

## 实施轮次

1. 头部拓扑与贴附：统一 skullPoint / skullNormal；重梳冠顶、眉部和额头羽区，去掉跨越头壳的直弦羽片；眼周连续外缘与自然上下眼睑；保留真实眨眼及视线骨骼。
2. 全身轮廓：检查肩胸衔接、喙根鼻孔、翼腹覆盖、脚踝及足握，避免现有接地/栖枝回归。飞行轮廓与收拢轮廓均验收。
3. 成长：消费 `state.growth.level`（0–2）；一级青玉冠纹和内翼细金色，二级长冠翎和青金尾羽。使用现有骨骼和顶点色，无全身自发光、无每帧遍历全模型。
4. 固定曝光、固定灯光 V8/V9 A/B：正面、三分之四、背面、眼部；正光、顶光、逆光、阴影、湿羽。实际首页测试由 root/motion 集成。
5. 最终导出后重新检查 GLB 骨骼、权重、法线、动作、成长等级、足握、体积、hash；不得把旧 GLB 测试列为最终证据。

## 资料与转化

- Cornell Lab [Everything You Need To Know About Feathers](https://academy.allaboutbirds.org/feathers-article/)：区分体羽、覆羽、飞羽和尾羽；重梳成连续羽区，飞羽保留不对称羽片。原理参考，不复制图片/资产。
- Pixar [Crafting Feathers for the Bird Kingdom in Hoppers, SIGGRAPH 2026](https://research.pixar.com/docs/2026.SiggraphTalks.PCB.pdf)：皮肤曲面与轮廓曲面、按身体区域组织 grooming，协调羽片与皮肤着色；本项目采用浏览器预算下的统一曲面与羽区法线，不声称复制电影离线曲线毛发管线。
- Disney [Physically-Based Shading at Disney](https://www.disneyanimation.com/publications/physically-based-shading-at-disney/)：统一环境光与材质反射，验证多灯光条件而不是专用美化灯光。
- Three.js [Materials](https://threejs.org/manual/pages/materials.html)：复杂 physical 特性存在逐像素成本；不通过叠加透明清漆和发光制造“精度”。
- Cornell Lab [American Dipper — Life History](https://www.allaboutbirds.org/guide/American_Dipper/lifehistory) 与 [Alaska Department of Fish and Game](https://www.adfg.alaska.gov/index.cfm?adfg=americandipper.main)：河乌在水下使用部分折叠的翅膀推进。03:00 实景复验暴露原潜游姿态后视仍像拖腿站立，因此在烁羽的原创幻想动作中采用水平体轴、收腿、成对翼划。它是姿态参考，不将烁羽宣称为真实河乌或金沙出土动物复原。
- [PBRT 4 相对折射率与 Fresnel](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) 和 [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)：提出水下介电羽材质使用相对介质 IOR 的候选，经过三机位实景同帧 A/B 再采用。具体过程见 `water-light/README.md`；仅为单层着色近似，不冒充真实羽毛水膜与气囊模型。

## 验收边界

保留原骨骼命名、碰撞胶囊、足底高度、wingbeat 事件与控制器接口。高模目标小于 125k 三角，低模小于 55k；模型不能靠提高高光来显得细。最终仍是作者程序拓扑与动画，不能称为已达到 3A 扫描/雕刻/动作捕捉成品。
