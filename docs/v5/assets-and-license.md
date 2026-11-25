# V5 本地美术资产与许可

下载与转换日期：2026-11-18。所有外部资源均为官方 Poly Haven CC0 资产；网页预览图、网站标识及参考站代码不在使用范围内。

| 本地资源 | 原作者与官方来源 | 当前用途 / 处理 |
|---|---|---|
| `public/assets/v5/rock_face_01/` | Dario Barresi · [Rock Face 01](https://polyhaven.com/a/rock_face_01) | 原 glTF 几何和 1K diffuse / normal GL / ORM；4 个共享纹理的实例，缩放、旋转、下缘埋入土壤；原创岩脚裙体封闭扫描面的开放边界 |
| `public/assets/v5/tree_stump_01/` | Rob Tuytel · [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | 原 glTF 几何和 1K diffuse / normal GL / ORM；3 个实例，保持树桩原有宽高关系 |
| `public/assets/v5/ground/` | Rob Tuytel · [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) | 原 1K diffuse 与 normal GL；用于现有地面外侧的连续草土混合，保持可达地形高度；距主路超过30米的边界外远景改为低缓冲积地形 |
| `public/assets/v5/fern_02/` | Rico Cilliers（建模）、Rob Tuytel（扫描）· [Fern 02](https://polyhaven.com/a/fern_02) | 四种蕨叶网格，1K diffuse / normal GL / ORM；替换原有蕨叶及大叶地被实例而非追加密度，小型变体用于数量较多的地被批次 |

[Poly Haven 官方许可](https://polyhaven.com/license) 将资产发布为 CC0，可修改并随本游戏分发；保留署名和链接用于来源透明，而非将署名误写为 CC0 的额外限制。

## 可复现记录

- 原始官方文件目录：`docs/v5/source/rock-face-files.json`、`tree-stump-files.json`、`fern-02-files.json`、`aerial-grass-rock-files.json`。
- 转换记录：`docs/v5/source/asset-conversion.json`，包含原文件 MD5、输入输出字节数与 WebP 质量。
- 原 JPEG 保存在 `docs/v5/source/original-textures/`，不进入生产静态资源目录。
- 转换脚本：`scripts/prepare-chapter-assets.cjs`。需要本机 Edge 与已启动的 5186 开发服务。glTF 的 image URI 指向本地 WebP；几何 buffer 仍为官方二进制。
- Base colour / ORM WebP 质量 .86；normal .93；最大尺寸 1024。保留 ARM 的通道布局，不把 normal 或 ORM 标记为 sRGB。
- 资源均由本地路径载入，正式游戏无需访问第三方资产服务器。

## 原创内容

`src/v5/chapter-world.js` 的根须、菌架、银穗芦苇、窑体、陶罐、晾架、云天、烟雾、水鸟、萤光均为本轮原创程序几何或着色器。五个空间是金沙文化主题的记忆景观；窑与木构采用博物馆资料提供的尺度和生活线索，不宣称是考古遗迹的精确复原。文化依据见 `world-art-research.md`。
