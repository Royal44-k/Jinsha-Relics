export const relics = [
 {id:'figure',name:'铜立人',english:'THE SUN-CROWNED FIGURE',era:'商周 · 铜器',role:'万物有灵',detail:'太阳形冠饰下，铜人双手环握于胸前。仅19.6厘米高的身躯，保存着古蜀人物造像鲜明的仪式感。',fact:'十三道弧形齿饰组成太阳帽。双手中曾握何物，至今仍是一个开放的考古问题。',clue:'冠上的光芒，回应着远方的太阳。',source:'https://artsandculture.google.com/asset/bronze-standing-figure/HAGgFD7-L5VZAA?hl=zh-cn',position:[-8,4,4]},
 {id:'jade',name:'十节玉琮',english:'A BRIDGE BETWEEN WORLDS',era:'金沙出土 · 良渚文化风格',role:'方圆之间',detail:'方形器身中贯穿圆孔，十节纹饰层层相接。这件金沙出土的玉琮带有鲜明的良渚文化风格，见证长江上下游文明的交流。',fact:'制作年代与出土时代并不相同。上海博物馆展签将它列为良渚文化，2001年出土于金沙祭祀区。',clue:'方中藏圆，微光穿过千年的玉。',source:'https://www.shanghaimuseum.net/mu/frontend/pg/article/id/CI00159740',position:[26,7,-21]},
 {id:'mask',name:'大金面具',english:'THE FACE OF A LOST KINGDOM',era:'商周 · 金器',role:'金面无言',detail:'捶揲的黄金塑出立体面容，双眼与嘴部镂空。威严而含蓄的神情，留下古蜀金工精湛的手艺。',fact:'金沙的大金面具有宽脸、高鼻与外展的耳部。它与三星堆纵目青铜面具不同。',clue:'金面静默，却把光留在了眼中。',source:'https://www.jinshasitemuseum.com/node/197',position:[-26,7,-22]},
 {id:'tiger',name:'石虎',english:'THE SILENT WATCHER',era:'商周 · 石器',role:'长夜守望',detail:'虎伏卧而昂首，天然石纹恰似斑纹。静止的身姿中藏着力量，让我们看见古蜀工匠对动物神态的凝练。',fact:'灰黑石材中的天然灰白纹带，与雕刻共同塑造了虎的形象。“守望者”是本游戏的叙事意象。',clue:'循着守望者的目光，回到日轮之下。',source:'https://artsandculture.google.com/asset/stone-tiger/ygHjq8_EHD6vcA?hl=zh-cn',position:[0,8,-46]},
 {id:'sun',name:'太阳神鸟金饰',english:'FOUR BIRDS · ONE ETERNAL SUN',era:'商周 · 金器',role:'日轮复苏',detail:'四鸟环日，光芒回旋。薄薄的金箔，将古蜀先民对太阳的想象凝成永恒图案。2005年，太阳神鸟图案成为中国文化遗产标志。',fact:'外径12.5厘米。外圈四只飞鸟与内圈十二道齿状光芒旋向相反；它们的象征意义仍有不同解读。',clue:'四段记忆已归来，让日轮再次流转。',source:'https://www.jinshasitemuseum.com/seardetail/714',position:[2,8,-5]}
];
export const icons = {
sun:'<circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="12"/><path d="M40 10Q70 12 54 36Q60 14 40 10M70 40Q68 70 44 54Q66 60 70 40M40 70Q10 68 26 44Q20 66 40 70M10 40Q12 10 36 26Q14 20 10 40M40 20v6m20 14h-6M40 60v-6M20 40h6"/>',
mask:'<path d="M15 20Q40 13 65 20L62 59Q40 72 18 59ZM16 31 7 27v23l11 5m46-24 9-4v23l-11 5M24 32l11 4-12 6Zm32 0-11 4 12 6ZM40 28l-6 21h12ZM29 56h22"/>',
jade:'<path d="M21 15 43 8l21 9v49l-22 8-21-9ZM21 15l22 9 21-7M43 24v50M22 27l20 8 21-7M22 39l20 8 21-7M22 51l20 8 21-7M34 16q8-7 17 0-8 7-17 0"/>',
figure:'<path d="M25 21a15 15 0 0 1 30 0M24 20 20 14m9 3-3-9m10 7L35 5m8 10 2-10m6 13 6-9M33 22h14v14H33ZM34 36l-7 7v13h10V44h6v12h10V43l-7-7M35 56v15m10-15v15M28 73h25"/>',
tiger:'<path d="M13 54Q11 38 24 39h24L44 25l6-13 6 8 9-3 4 11-5 13-7 6v13H17ZM19 58l-6 8h15l7-10m15 3 3 7h13l-9-7M50 31l12 3M25 40l6 11m6-12 5 10M14 45Q3 46 8 28"/>'
};
export const relicIcon = id => `<svg viewBox="0 0 80 80" aria-hidden="true">${icons[id]}</svg>`;
