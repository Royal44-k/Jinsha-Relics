# V5 声音制作与来源

本轮新增16段普通话对白（烁羽11段、录忆者5段），使用已选定的公开声线：Haoran – Bright & Articulate / Shuxian – Clear & Trustworthy。原始生成文件与逐字时间标记保存在 scripts/audio-source/v5；按完整句子剪辑，不改变音高或语速。字幕与实际剪辑时长由同一构建流程生成。服务账户显示免费套餐，当前用途为内部本地评审，未核定商业发行权。

现代原创配乐采用金石模态、气息与弓弦合成音色，不声称复原古蜀音乐。新谱《五境·回响》有两个同步的48秒立体声层，随章节混合；独立拾取、归还、转动、通水、穿环与完成音带空间位置。水下滤波作用于环境与音乐，保留对白清晰度。

## CC0 实录

| 游戏层 | 作者与原始来源 | 使用方式 |
|---|---|---|
| 森林 | guidofm：[Forest Ambience](https://freesound.org/people/guidofm/sounds/509176/) | 公开高质量试听MP3，截取18秒、循环交叉淡化 |
| 溪流 | Yuval：[small stream forest](https://freesound.org/people/Yuval/sounds/197023/) | 公开试听MP3，截取40秒、循环交叉淡化 |
| 窑火 | RyanKingArt：[Campfire on the Beach](https://freesound.org/people/RyanKingArt/sounds/695769/) | 公开试听MP3，截取32秒、循环交叉淡化 |

三项原作者页面均标注[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。保留实际来源、录音地点、处理方式在 public/assets/audio/v5-field-sources.json。它们是现代外地环境录音，用于原创艺术声景，不是金沙现场录音或古代生态证据。

## 交付与检验

WebCodecs仅用于离线构建，游戏运行时只需WebAudio解码。Ogg Opus人声64kbps、立体声96kbps；保留WAV作为回退。全部34份压缩交付文件约4.25MB，对应PCM约30.69MB。精确裁掉编码前延迟和尾部填充，长配乐各时间点经波形相关性验证无分段延迟累积。

脚本：build-adventure-audio.mjs、build-field-audio-v5.cjs、compress-audio-v5.cjs、verify-audio-v5.cjs。规范依据：[RFC7845](https://www.rfc-editor.org/rfc/rfc7845.html)、[AudioEncoder](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder)。

实际检查覆盖31个运行时音频、声道、非静音波形、削波、对白去重/避让、暂停、空间声源、区域变化与编码同步，报告audio-verification.json。技术验证不等于主观听音验收；未将听感品质标记为已认证。
