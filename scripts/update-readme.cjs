const fs=require('fs');
const p='README.md';let s=fs.readFileSync(p,'utf8');s=s.replace('## 启动\n','## 启动\n\n当前电脑可直接双击 `启动游戏.cmd`，后台启动服务并打开游戏。也可按下面步骤手动运行。\n');fs.writeFileSync(p,s);
