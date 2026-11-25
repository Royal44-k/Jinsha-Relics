# V8 研究、取舍与来源

2026-11-19。本轮先读V5玩法、V6/V7研究和验收，以及原始视频分析记录，再处理用户实玩暴露的停栖/高光/抽帧问题。原视频作为探索框架，不冒称手工逐帧审阅了所有画面；既有分析方法见 `docs/video-analysis.md`。

## 文化与场景

[金沙遗址博物馆·遗迹馆](https://www.jinshasitemuseum.com/node/216)提供滨河祭祀区、树根遗迹与木结构祭台遗迹的官方介绍。它支持本作沿河、林根、九柱意象的资料方向，不能证明游戏中山崖、精灵和飞行机关的历史真实性。新增芦岸、竹影、暮湾停栖点属于原创空间安排；烁羽及光羽恢复机制均是幻想设计。

此前文物和生活场景的逐项来源继续保留在V5–V7资料中；本轮不以虚构对白补写未经证实的历史事件。

## 用户指定示例与资源

- [Showreel](https://showreel.design/)：本轮再次尝试，研究工具返回403。沿用既有方向，不声称本次看到了受阻页面的新作品。
- [Sael·Farewell Light](https://sael.net/demo/farewell-light/)：本轮读取未成功。此前认可的空气层次、光线引路、克制界面继续作为审美参照，没有复制其源码或受许可限制的模型。
- [MotionSites](https://motionsites.ai/)：本轮可读分类目录，提供3D/Interactive/Creative等入口；目录不能替代具体作品的逐项视觉核验。
- [Poly Haven资产许可](https://polyhaven.com/license)：再次确认资产库的CC0范围，与网站商标、预览图等内容区分。当前已用HDRI、树皮、岩石、树桩等来源见既有资产清单；本轮没有新增下载该站模型。

## 实际采用的技术资料

- [Three.js·Optimizing Lots of Objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html)、[InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)、[更新对象](https://threejs.org/manual/pages/how-to-update-things.html)：用于核对实例变换、更新时机和CPU/GPU成本不能混为一谈的实施判断。
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)：锁定0.9.18，仅用于镜头碰撞的加速查询，不全局替换Mesh.raycast。MIT许可复制至 `public/licenses/three-mesh-bvh.txt`。已覆盖变形矩阵、实例属性替换、交错属性版本、有限射线和实际场景等价性。
- [Three.js骨骼叠加动画示例](https://threejs.org/examples/webgl_animation_skinning_additive_blending.html)：作为分层动作组织的参考入口；没有下载或使用示例Mixamo角色。
- 羽毛形态和物理着色的原始参考与第三轮雕刻取舍，见 `character/design.md`。角色仍使用原创程序母版和骨骼，未伪称采用人工高模烘焙或动作捕捉。

## 声音与制作判断

新增长/短振翼转换、闪身、掠水、落枝的原创短纹理，在共享效果音总线中预热和播放；四类各四变体。没有新增第三方采样或冒用他人声音。配乐与人声沿用V5–V7已记录来源的本地素材；人声仍限定内部评审，商业发行许可尚未核定。波形/浏览器同步测试与人耳审听结论明确区分。

本轮选择先修真实几何与输入问题：枝管内向三角、切线参数错位、趾根断节、停栖按键时序、光羽抢占E、像素预算及镜头高模查询。没有以全场压暗掩盖高光，也没有用查询速度的倍率宣称全游戏帧率。具体实验、失败记录和测量边界见 `render/findings.md` 与各测试原始JSON。
