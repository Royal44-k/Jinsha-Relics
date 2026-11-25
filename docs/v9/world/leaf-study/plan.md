# 古树薄叶 A/B

叶材质应响应背面入射的阳光，不能靠自发光把整个树冠洗亮。Epic 的 Two Sided Foliage 说明将薄叶的光透射与适用于厚表面的皮肤/蜡模型区分；Unity HDRP 的 Diffusion Profile 也为双面薄几何提供 Thin Object 传输模式。本实现借鉴这一薄表面思路，做 WebGL 的受限光源近似，**不是移植两款引擎的完整散射管线**。

资料：[Epic Shading Models](https://dev.epicgames.com/documentation/unreal-engine/shading-models?application_version=4.27)、[Unity HDRP Diffusion Profile](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Documentation~/diffusion-profile-reference.md)。

固定 A 为本轮改动前的 living-tree-baseline.js；B 只改新树叶材质、曲率和局部叶密度。曝光、环境强度、阳光位置及摄影机在每个 A/B 对中一致。场景内固定拍正常远景、逆光冠层、枝头正光、枝头逆光；B 追加 transmission=0 和 .65 的同镜头对照，判断收益来源与过量的负例。试验脚本 `scripts/review-leaf-v9.cjs` 明确使用完成根树 fixture 与固定摄影机，不将这些图称为自然游玩证据。

B 初始参数：roughness .84、normalScale .12、自发光 0、薄叶透射 .38；叶片曲率减小约六成。透射仅增加来自真实方向光及背面天空的漫反射，主叶脉降低透射强度；初轮方向光 92% 保留真实阴影结果，8% 作为多层薄叶中透过光的近似。第二轮将阴影透过比例改为 22%，第三轮仍保留该值；它始终受背面角度、叶色和视角约束。无新增纹理、光源、后期或渲染 pass。

分布：对全部九根主枝的叶点统一计算成熟树局部位置，在停栖身体周围保留 1.35×1.6 米椭球空间；3.2 米内的簇减少部分成对叶、缩小约 10%。承重枝、脚爪、停栖坐标和坡度完全不动。CPU 当前 4839 叶、153812 三角、25 绘制对象，较 A 少 7968 三角。真实脚握六姿态数值不变。

GPU 验证于 03:47–04:02 UTC 完成三轮 44 张对照图。第一轮枝头机位被旁枝阻挡，作为失败构图保留；第二轮修正到承重枝外侧，比较正常/逆光/枝头与强度变体。更强 .65 透射、.35 阴影透过未显示足够收益，不予采纳。最终 .38/.22 的改进主要来自减薄曲率、降低法线过度起伏和疏开身体周围叶层，透射只补充受光响应，不能宣称仅靠 shader 达到真实叶片体散射。

第三轮单独定位并修正承重枝树皮 UV：Three TubeGeometry 原本 U 沿枝长、V 绕周，旧代码把 V 也写成枝长，造成 UV 面积塌缩与木纹环带。现 U 绕周、V 按真实弧长平铺，与现有树皮纹理一致；几何、法线和脚握坐标完全不变。该轮 A 使用 living-tree-before-uv.js，而非第一轮原始树。正反例与证据界限见 review.md。
