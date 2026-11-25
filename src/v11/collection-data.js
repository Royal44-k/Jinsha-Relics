const museum = 'https://www.jinshasitemuseum.com';
const site = museum + '/info/706';
const copper = 'https://mooc1.chaoxing.com/mooc-ans/ztnodedetailcontroller/visitnodedetail?_from_=&courseId=84740038&knowledgeId=84740048&rtag=';

// The images are small original interpretive plates, not photographs of the finds.
export const relics = [
  {
    id: 'river-trench', image: 'layer', title: '陶片与砂层', kind: '地层标本', place: '滨河探方',
    observation: '一层细泥之下，砂粒突然变粗。筛出陶片以后，再沿口沿追一圈，可以辨出人工成形留下的弧度。',
    fact: '金沙古河道的发掘记录把河床堆积和岸上活动联系在一起。剖面上泥、砂、砾的层序，是判断沉积先后的线索。',
    fiction: '画面中土层的厚度、模拟土样中的陶口沿与其发现位置，是为练习层位记录而设计的现场。',
    source: site, sourceTitle: '金沙遗址博物馆 · 遗址与古河道',
    question: '两块质地不同的土样装入袋前，哪条记录最难在事后补回？',
    choices: ['各自的重量', '各自所在土层与上下位置', '干燥后的颜色'], answer: 1,
    why: '重量和颜色还可复测。取出以后，原来的层位关系只能靠现场记录找回。'
  }, {
    id: 'paleochannel', image: 'channel', title: '古河岸线', kind: '地貌记录', place: '芦湾故道',
    observation: '河道绕过内弯，一道浅色卵石滩在芦苇根下露了出来。',
    fact: '金沙祭祀区位于古河流南岸。发掘者在古河道中清理出埋藏木，岸边也保留了密集的人类活动痕迹。',
    fiction: '河湾、竹排和浮标是可航行的场景复原。眼下的水位与所见航线属于这次探险。',
    source: site, sourceTitle: '金沙遗址博物馆 · 祭祀区与河岸',
    question: '要在今天的旱地上寻找曾经的河床，哪组证据更有说服力？',
    choices: ['地表的树影朝向', '水鸟在林中的数量', '河流沉积与其中埋藏的古木'], answer: 2,
    why: '古木的埋藏环境和河流沉积可以一起核对，保留着古河道经过此地的线索。'
  }, {
    id: 'root-survey', image: 'root', title: '秋枫古根盘', kind: '植物遗存', place: '古木鉴定台',
    observation: '树根像手掌伸入泥中。把根部切片与参照标本并列，木材里的细孔也成了认树的线索。',
    fact: '金沙遗迹馆保护着一处秋枫树根遗迹，面积约一百平方米。古河道中还发现了乌木。原位生长的根与顺水搬运的木段，提供了不同的环境线索。',
    fiction: '显微切片与参照图是教学绘制。你看到的树冠、嫩芽和繁茂林景，来自对地下遗存的生态想象。',
    source: museum + '/info/4060', sourceTitle: '金沙遗址博物馆 · 遗迹馆秋枫树根',
    secondSource: site, secondTitle: '馆方发掘介绍 · 乌木与大型树根',
    question: '给古根盘配说明时，哪项能直接根据现场遗存记录？',
    choices: ['根系向外延伸的方向与跨度', '树梢最后停过哪种鸟', '枝叶一年中哪天转绿'], answer: 0,
    why: '根盘的形状、方向和尺寸可以测绘。树冠与叶色需要其他材料才能复原。'
  }, {
    id: 'jade-cut', image: 'jade', title: '十节青玉琮', kind: '玉器对照', place: '琢玉工棚',
    observation: '顺外角逐节向下数，再迎着光望进孔里。孔口展开，腹中收窄。',
    fact: '金沙出土的这件良渚文化青玉琮高 22.2 厘米。外壁分十节，圆孔贯通。两端孔径较大，中段收窄，留下从两端加工的证据。',
    fiction: '本关的玉料与磨具是练习件，工棚用来演示加工原理。这件玉琮进入金沙之前的具体旅程仍待追索。',
    source: museum + '/seardetail/679', sourceTitle: '金沙遗址博物馆 · 良渚文化十节青玉琮',
    question: '内孔两端宽、中间窄，最能提示哪道工序？',
    choices: ['用火烧出一条直孔', '分别从两端钻入', '先雕羽纹再切去四角'], answer: 1,
    why: '两头大、中段小的孔壁形态，是馆方辨识双面钻孔的依据。'
  }, {
    id: 'clay-fit', image: 'pottery', title: '尖底陶杯', kind: '陶器对照', place: '陶坯院',
    observation: '轮廓从敞口收束到小小的尖底。几片不起眼的陶片，留下了整件器物的转折。',
    fact: '金沙生活与祭祀遗存中包含许多陶器。馆方介绍指出，金沙早期常见小平底罐，到中晚期，尖底器逐渐占据重要位置。',
    fiction: '游戏碎片的接缝和这只杯子的破损情况由美术设计。练习的目的是从口沿、弧度与足部辨器。',
    source: museum + '/info/2200', sourceTitle: '金沙遗址博物馆 · 从陶器看古蜀传承',
    secondSource: site, secondTitle: '馆方发掘介绍 · 金沙出土的陶器类型',
    question: '一箱碎陶片要先按器形整理，哪两类片段最值得单独保留？',
    choices: ['最大和最重的片段', '颜色最鲜艳的片段', '带口沿和器底的片段'], answer: 2,
    why: '口沿和底足保存了区别器形的关键部位，常常比普通腹片更有辨识度。'
  }, {
    id: 'bronze-shadow', image: 'bronze', title: '青铜鸟形器', kind: '铜器对照', place: '铜鸟支护台',
    observation: '陶托刚一受力，尾部就微微偏转。换个支点，翼缘与腹下突起才完整显露。',
    fact: '金沙出土过小型铜鸟，尖喙、突眼，翅部带羽纹。腹下的柱状结构，使研究者想到它可能曾连接在另一件器物上。',
    fiction: '本关的铜鸟是支护练习用的复原件。陶托、模拟重心和烁羽的羽灵身份属于游戏创作。',
    source: copper, sourceTitle: '古蜀展品教学图录 · 金沙出土铜鸟',
    secondSource: museum + '/seardetail/2382', secondTitle: '金沙遗址博物馆 · 铜鸟',
    question: '怎样表述腹部短柱的用途，更符合现有证据？',
    choices: ['它可能是连接其他器物的构件', '它必定是古人校时的指针', '它已经证明铜鸟曾发声'], answer: 0,
    why: '短柱的形态支持连接构件的推测。要确定安装位置，还需要和原来相连的器物相互印证。'
  }, {
    id: 'ivory-record', image: 'ivory', title: '象牙埋藏记录', kind: '现场记录', place: '象牙保护棚',
    observation: '一枚象牙的弯端穿过方格的边界。把旁边的木屑和另一枚牙一起画进来，记录才完整。',
    fact: '金沙祭祀区发现大量象牙。象牙的走向、叠压关系以及同层遗物，能帮助研究者认识这里曾经发生的活动。',
    fiction: '画面中的摆位和方格编号是记录练习。你带走的是带方位的观察图，象牙留在原来的土层中。',
    source: site, sourceTitle: '金沙遗址博物馆 · 祭祀区象牙遗存',
    question: '为一组象牙拍完特写，哪张照片最值得补拍？',
    choices: ['只拍最光滑的表面', '带比例尺、方向标和周围堆积的全景', '把所有象牙摆成一列'], answer: 1,
    why: '全景留下象牙和周围遗存的位置关系。比例尺与方向标让后来者能读回真实空间。'
  }, {
    id: 'sunfoil', image: 'sun', title: '太阳神鸟金饰', kind: '金器对照', place: '金箔透光台',
    observation: '让视线沿外圈追鸟，再移向内圈的日芒。两股旋转在薄薄一层金上相遇。',
    fact: '商周太阳神鸟金饰外径 12.53 厘米，厚约 0.2 毫米。外圈四鸟逆时针飞行，内圈十二道齿状光芒顺时针展开。',
    fiction: '借光分层读纹是本作设计的观察方法。馆藏实物由同一件镂空金饰构成，图鉴中的金色光场是创作演绎。',
    source: museum + '/seardetail/681', sourceTitle: '金沙遗址博物馆 · 商周太阳神鸟金饰',
    question: '跟着外圈四鸟向前，再看内圈十二道芒纹，会发现什么？',
    choices: ['每只鸟对应一道芒纹', '两圈都静止地指向北方', '内外两圈的旋转方向相反'], answer: 2,
    why: '四鸟和十二芒各自连成一圈，旋向相反，共同形成器物的动态感。'
  }, {
    id: 'nine-posts', image: 'posts', title: '九柱遗迹平面', kind: '建筑遗迹', place: '九柱台地',
    observation: '从地面走过，只见一个个洞口。升到空中，散开的印迹忽然排成了一座建筑的轮廓。',
    fact: '金沙祭祀区九柱遗迹的柱洞呈圆角方形。馆方记载，基址轴线实测为东偏南 27.17°，与成都平原冬至日出方向接近。对于上部建筑形制，研究者提出过多种方案。',
    fiction: '结局的木构、光线与音乐属于游戏复原。馆方记录还提到，原址有两个柱洞曾受机械施工破坏。',
    source: museum + '/seardetail/3793', sourceTitle: '金沙遗址博物馆 · 九柱遗迹的不同复原方案',
    question: '复原图里的屋顶可以随研究进展而改变，哪一项是复原的起点？',
    choices: ['已经记录的柱洞形状和排列', '游戏结局的鼓点', '画家选择的屋瓦颜色'], answer: 0,
    why: '地下遗迹可以实测，上部构造仍需根据证据推测。把两者分开，才容得下新的发现。'
  }
];

export const fieldFinds = [
  {id:'spindle',title:'陶纺轮',place:'西岸织棚',type:'纺织',fact:'馆方在金沙居址与墓地的生产工具中列有纺轮。纺轮在转动时帮助捻合纤维，让散开的纤维逐步成线。',fiction:'织棚位置、捻线动作和这件纺轮的外观为互动复原。'},
  {id:'stoneblank',title:'石璧坯料',place:'东台石场',type:'琢石',fact:'馆方记载，金沙梅苑一处约三百平方米的区域内，石璧、石璋半成品倾斜摆放，层层叠压。布局也是需要保存的考古线索。',fiction:'东台石场与这件坯料是游戏复原。飞起俯察扇状排列，让人在较高视点读出整组器物的位置关系。'},
  {id:'netsinker',title:'陶网坠',place:'北汊渔地',type:'渔作',fact:'金沙博物馆在生产工具中列有网坠。系在网缘的重物能让渔网下沉，使网在水中保持展开。',fiction:'潜水寻到的这件陶坠、绑扎位置与水下地形为游戏创作。'}
].map(item => ({...item, source:site, sourceTitle:'金沙遗址博物馆 · 居址与生产工具'})).concat({
  id:'carbon-rice',title:'炭化稻粒图记',place:'西台烟火里',type:'植物考古',
  fact:'金沙“黄忠小学”地点的考古人员对居址土样进行浮选，分离出炭化植物种子。对多份样品的鉴定显示，这处聚落的农作物以稻为主，也有粟、黍。',
  fiction:'小院方位、土样组合和放大模型为教学创作。图记呈现一份样品；聚落的饮食结构需要结合多处采样记录判断。',
  source:museum+'/info/4877',sourceTitle:'金沙遗址博物馆 · 黄忠小学地点的植物考古'
});

export const forms = [
  {id:'reed', title:'芦影', habitat:'河滩疾行', note:'褐金羽缘融进芦苇，足趾踏过湿泥时更为轻快。', color:'#b59870', bodyTint:'#786346', wingTint:'#bd9057', threshold:0, stat:'groundSpeed', values:[1.08,1.15,1.22], unit:'地面速度'},
  {id:'jade', title:'碧泠', habitat:'长空巡游', note:'肩羽呈青玉色，长翼沿河谷舒展开来，消耗更少体力。', color:'#7ab6a5', bodyTint:'#315e5b', wingTint:'#68aa9a', threshold:60, stat:'airEfficiency', values:[.88,.79,.70], unit:'飞行耗力'},
  {id:'sun', title:'曜翎', habitat:'短距闪身', note:'深铜肩羽收住光，金色飞羽一抖，便能再次闪身。', color:'#d4a454', bodyTint:'#835335', wingTint:'#c9a244', threshold:120, stat:'dashRecovery', values:[.88,.78,.68], unit:'闪身冷却'}
];

