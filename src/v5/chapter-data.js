// One placement source for rendering and collision registration. The landmarks
// occupy the shoulders, never the main path or the five mechanism clearings.
export const CHAPTER_HEROES = [
  {id:'root-stump',asset:'tree_stump_01',fraction:.037,side:-7.2,width:3.4,yaw:.8,height:1.23,radius:1.55},
  {id:'wind-wall-a',asset:'rock_face_01',fraction:.352,side:-17.5,width:11.5,yaw:.20,height:6.4,radius:4.5},
  {id:'wind-wall-b',asset:'rock_face_01',fraction:.383,side:-19,width:13.8,yaw:-.38,height:7.5,radius:5.5},
  {id:'wind-wall-c',asset:'rock_face_01',fraction:.448,side:-17.5,width:11.8,yaw:.38,height:6.5,radius:4.6},
  {id:'wind-wall-d',asset:'rock_face_01',fraction:.477,side:20,width:10.6,yaw:Math.PI+.18,height:5.8,radius:4.1},
  {id:'kiln-stump',asset:'tree_stump_01',fraction:.641,side:-8.5,width:2.8,yaw:2.2,height:1.01,radius:1.25},
  {id:'dusk-stump',asset:'tree_stump_01',fraction:.825,side:-10.5,width:3.8,yaw:-.6,height:1.37,radius:1.7},
];

export const CHAPTER_KILNS = [
  {id:'kiln-a',fraction:.614,side:-13.8,yaw:.45,scale:1.0},
  {id:'kiln-b',fraction:.634,side:-15.5,yaw:-.25,scale:.8},
];

// Short overlapping columns follow the broad scanned footprint more closely
// than one central cylinder. They are kept outside both walkable path ribbons.
export function chapterHeroFootprint(hero){
 if(hero.asset!=='rock_face_01')return [{x:0,z:0,r:hero.radius}];
 return [-.3,0,.3].flatMap(x=>[-.16,.16].map(z=>({x:x*hero.width,z:z*hero.width,r:hero.width*.205})));
}

export const CHAPTERS = [
  {id:'root-vault',name:'根穹幽谷',from:0,to:.16,sky:'#62877c',fog:'#688e82',fogNear:13,fogFar:62,sunColor:'#ffe4b8',sunIntensity:3.5,hemiSky:'#a6c9c3',hemiGround:'#213326',hemiIntensity:.88,environmentIntensity:.34,exposure:1.02,night:0},
  {id:'silver-marsh',name:'雾泽浮汀',from:.16,to:.34,sky:'#a7bec1',fog:'#a4b9b6',fogNear:21,fogFar:85,sunColor:'#fff1d4',sunIntensity:3.1,hemiSky:'#d2e2e5',hemiGround:'#424e41',hemiIntensity:1.15,environmentIntensity:.42,exposure:1.01,night:0},
  {id:'wind-scarp',name:'叠石风廊',from:.34,to:.51,sky:'#92aab5',fog:'#95a9ac',fogNear:20,fogFar:77,sunColor:'#fbe4bc',sunIntensity:3.65,hemiSky:'#c8dae4',hemiGround:'#393c3b',hemiIntensity:1.04,environmentIntensity:.38,exposure:1.0,night:.04},
  {id:'rice-fire',name:'稻火聚落',from:.51,to:.73,sky:'#829fa7',fog:'#9cae9f',fogNear:19,fogFar:80,sunColor:'#ffd29b',sunIntensity:3.6,hemiSky:'#bdcfc5',hemiGround:'#393a2a',hemiIntensity:1.02,environmentIntensity:.37,exposure:1.02,night:.2},
  {id:'dusk-bay',name:'九柱暮湾',from:.73,to:1,sky:'#344c65',fog:'#536d7a',fogNear:19,fogFar:81,sunColor:'#ffc684',sunIntensity:1.3,hemiSky:'#adc8e0',hemiGround:'#253640',hemiIntensity:.9,environmentIntensity:.34,exposure:1.1,night:1},
];
