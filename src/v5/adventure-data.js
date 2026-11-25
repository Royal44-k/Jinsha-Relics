/** Original memory-landscape mechanics, not archaeological reconstructions. */
export const ADVENTURE_STAGES = [
 {id:'root',relicId:'bird',title:'携光归根',subtitle:'聆听林息，携回三枚离枝的光芽',fraction:.182,lateral:-2.4,total:3,discovery:'散落的光并未熄灭。聆听，让它们回应；将光芽带回根间的空巢。',hint:'按 Q 聆听；靠近光芽按 E 携起，再走到空巢按 E 放回。'},
 {id:'light',relicId:'jade',title:'玉轮引光',subtitle:'转动三轮，让一束光穿过方圆',fraction:.415,lateral:-2.8,total:3,discovery:'方中有圆，圆中留隙。沿着光看过去，哪一道轮孔还没有相逢？',hint:'在每道玉轮旁按 E 转动；偏心圆孔对齐时，光会继续向前。'},
 {id:'water',relicId:'mask',title:'归水稻田',subtitle:'接续断开的水路，让干田重新呼吸',fraction:.567,lateral:-2.7,total:3,discovery:'水停在了田边。转动沟渠的方向，沿着水声找出断开的那一段。',hint:'靠近渠轮按 E，连接每段水渠的两个开口；蓝色水流只经过相接的沟槽。'},
 {id:'flight',relicId:'tiger',title:'乘风越夜',subtitle:'沿着逐次亮起的风环，穿过长夜',fraction:.695,lateral:-1.4,total:6,discovery:'长夜并不催促你。踏进风纹，展翼穿过六道依次醒来的光环。',hint:'在起点按 E；按住空格升空，穿过明亮的下一道风环。错过后可转身重飞，或开启轻松飞行。'},
 {id:'sun',relicId:'sun',title:'九柱归日',subtitle:'带着四境回响，在观景位迎向日轮',fraction:.935,lateral:0,total:1,discovery:'九柱保留着古人的未知。站在光纹中心，面向远方日轮，让四境回响相遇。',hint:'集齐四境回响，站到观景光纹内；转动视角面向日轮，按住 F 聚光。'}
];

export const FEATHER_DEFINITIONS = [
 {id:'feather-0',fraction:.078,lateral:-7.2,height:.72,label:'根隙微光',kind:'ground'},
 {id:'feather-1',fraction:.105,perch:0,height:.65,label:'第一枝风',kind:'perch'},
 {id:'feather-2',fraction:.232,lateral:11.6,height:.65,label:'水底星息',kind:'water'},
 {id:'feather-3',fraction:.278,lateral:-7.5,height:.7,label:'芦岸回望',kind:'ground'},
 {id:'feather-4',fraction:.315,lateral:1.5,height:4.5,label:'断岸上升流',kind:'air'},
 {id:'feather-5',fraction:.365,perch:1,height:.65,label:'高枝来信',kind:'perch'},
 {id:'feather-6',fraction:.392,lateral:-9.5,height:.7,label:'石径岔路',kind:'ground'},
 {id:'feather-7',fraction:.526,lateral:10.3,height:.6,label:'河泥里的光',kind:'water'},
 {id:'feather-8',fraction:.603,lateral:-7.4,height:.7,label:'稻火余温',kind:'ground'},
 {id:'feather-9',fraction:.662,lateral:-6.5,height:3.8,label:'暮色悬羽',kind:'air'},
 {id:'feather-10',fraction:.843,lateral:3.2,height:.7,label:'柱影间隙',kind:'ground'},
 {id:'feather-11',fraction:.967,lateral:-6.7,height:.7,label:'河湾最后一封信',kind:'ground'}
];

// The first bud sits just beyond the root arch, so the opening teaches carrying
// before asking the player to locate a more distant nest clearing.
export const ROOT_BUDS = [{fraction:.126,lateral:-1.6},{fraction:.181,lateral:-5.4},{fraction:.196,lateral:1.7}];
export const FLIGHT_RING_DEFINITIONS = [
 {fraction:.706,lateral:0,height:2.5}, {fraction:.736,lateral:-3.5,height:4.3},
 {fraction:.771,lateral:3.6,height:6.2}, {fraction:.810,lateral:-4.2,height:5.2},
 {fraction:.844,lateral:2.8,height:7.0}, {fraction:.876,lateral:-.8,height:3.2}
];
