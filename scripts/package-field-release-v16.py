"""Build only the expedition entry in a fresh temporary directory and zip the static release."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
LABEL = "金沙古蜀秘境-网页试玩包"
OUT = ROOT / "docs/v16"
ALLOWED_BEDS = {"v5-field-forest.ogg", "v5-field-fire.ogg", "v5-field-water.ogg", "v5-field-sources.json"}

INSTRUCTIONS = """金沙：古蜀秘境  |  网页试玩 V16

Windows 本机试玩
先将压缩包完整解压到同一目录，双击「启动试玩.cmd」。启动器可使用 Node.js（18 或更高版）或 Python 3，任一即可。保留服务窗口，浏览器打开 http://127.0.0.1:5197/ 。在窗口按 Ctrl+C 可结束服务。如只使用浏览器，请打开分发者提供的托管游戏网址。

其他电脑
在解压目录打开终端，执行 python3 -m http.server 5197 --bind 127.0.0.1 --directory site ，再打开同一网址。

朝向、取景和归档
点「开始探索」进入古河岸。W/S 前行与后退，A/D 转身，R 切换持续飞行。在河岸按 J 找到「证据推理台」，根据已归档的遗存解开各卷。按 P 打开河岸摄影，可调整画幅、镜头倍率和保存照片。首页「声音设置」可先试听旁白与烁羽。进度保存在当前浏览器；继续游玩请保持相同浏览器和网址端口。

分享给玩家
将 site 文件夹里的全部内容发布到静态网站的根目录，入口为 /index.html。资源使用根路径 /assets/、/fonts/ 和 /licenses/ 。本地解压文件也需要经 HTTP 服务打开。支持 WebGL 2 的新版 Edge、Chrome、Firefox 或 Safari。

考古依据与素材署名
游戏首页「考古依据」及 /credits-v10.html 提供材料来源、艺术复原说明和授权。/references.html 收录设计与技术参考。软件和字体许可随包位于 site/licenses 及 site/fonts。
"""

STARTER = r"""@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if not errorlevel 1 goto node
where py.exe >nul 2>nul
if not errorlevel 1 goto pythonlauncher
where python.exe >nul 2>nul
if not errorlevel 1 goto python
echo This local preview requires Node.js 18+ or Python 3.
echo For browser-only play, use the publisher's hosted URL.
pause
exit /b 1
:node
node.exe local-server.cjs
goto done
:pythonlauncher
py.exe -3 -c "import sys;assert sys.version_info.major==3" >nul 2>nul
if errorlevel 1 goto python
set "python_command=py.exe -3"
goto serve_python
:python
python.exe -c "import sys;assert sys.version_info.major==3" >nul 2>nul
if errorlevel 1 goto done
set "python_command=python.exe"
:serve_python
%python_command% -c "from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler;from functools import partial;import webbrowser;s=ThreadingHTTPServer(('127.0.0.1',5197),partial(SimpleHTTPRequestHandler,directory='site'));print('http://127.0.0.1:5197/',flush=True);webbrowser.open('http://127.0.0.1:5197/');s.serve_forever()"
:done
if errorlevel 1 pause
"""

def build_at(stage):
    site = stage / "site"
    vite = """import {build} from 'vite';
import path from 'node:path';
await build({configFile:false,build:{outDir:process.argv[1],copyPublicDir:false,sourcemap:false,reportCompressedSize:false,
rollupOptions:{input:{expedition:path.resolve('index.html')}}}});"""
    subprocess.run(["node", "--input-type=module", "-e", vite, str(site)], cwd=ROOT, check=True)
    for item in PUBLIC.rglob("*"):
        if not item.is_file():
            continue
        rel = item.relative_to(PUBLIC)
        if rel.parts[:2] == ("assets","audio") and item.name not in ALLOWED_BEDS:
            continue
        if rel.parts[:3] == ("assets","v12","voices"):
            continue
        target = site / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
    # Reuse the project's static MIME and byte-range handling in the portable server.
    helper = (ROOT/"scripts/serve.cjs").read_text("utf8")
    helper = helper.replace("'../dist'", "'site'")
    helper = helper.replace("if(url.includes('\\0'))", "if(url.includes('\\0') || url.includes('\\\\') || url.split('/').includes('..'))")
    old = ".listen(5188,'127.0.0.1',()=>console.log('金沙：古蜀秘境 http://127.0.0.1:5188'));"
    assert old in helper
    helper = helper.replace(old, """.on('error', error=>{console.error(error.message);process.exitCode=1;})
  .listen(Number(process.env.JINSHA_PORT||5197),'127.0.0.1',function(){
    const url='http://127.0.0.1:'+this.address().port+'/';console.log(url);
    if(process.platform==='win32' && !process.argv.includes('--no-open')){
      require('node:child_process').execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],error=>{if(error)console.log('Open the URL above in a browser.');});
    }
  });""")
    (stage/"local-server.cjs").write_text(helper,"utf8")
    (stage/"启动试玩.cmd").write_text(STARTER, encoding="ascii", newline="\r\n")
    (stage/"使用说明.txt").write_text(INSTRUCTIONS, encoding="utf-8-sig")

def check_local_references(site):
    paths=set()
    class Links(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for attr,value in attrs:
                if attr not in {'href','src'} or not value:
                    continue
                url=urlsplit(value)
                if not url.scheme and not url.netloc and url.path:
                    paths.add(url.path.strip('/') or 'index.html')
    for page in site.glob('*.html'):
        Links().feed(page.read_text('utf8'))
    literal=r"""["'\x60](/?assets/[\w./-]+\.(?:png|webp|jpg|hdr|wav|ogg|glb|gltf|svg|json|webm|js|css))["'\x60]"""
    for chunk in (site/'assets').glob('*.js'):
        paths.update(p.lstrip('/') for p in re.findall(literal,chunk.read_text('utf8')))
    for asset in (site/'assets').rglob('*.gltf'):
        doc=json.loads(asset.read_text('utf8'))
        for group in ('buffers','images'):
            for data in doc.get(group,[]):
                uri=data.get('uri','')
                if uri and not uri.startswith('data:'):
                    paths.add((asset.parent/uri).relative_to(site).as_posix())
    missing=sorted(p for p in paths if not (site/p).is_file())
    assert not missing, missing
    return len(paths)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--draft", action="store_true", help="Keep this validation build in the temp directory")
    args = parser.parse_args()
    work = Path(tempfile.mkdtemp(prefix="jinsha-release-v16-"))
    stage = work / "publish"
    stage.mkdir()
    build_at(stage)
    archive = work / (LABEL+".zip")
    with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
        for item in sorted(stage.rglob("*")):
            if item.is_file():
                bundle.write(item,item.relative_to(stage).as_posix())
    unpacked = work / "unpacked"
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        paths = bundle.namelist()
        assert all(not any(part in {"src","docs","scripts","tests","node_modules","spring-letter"} for part in p.split("/")) for p in paths)
        assert all(not p.endswith((".map",".test.js",".mjs")) for p in paths)
        assert {"site/index.html","site/credits-v10.html","site/references.html","site/licenses/three.txt","site/fonts/OFL.txt",
                "site/assets/v15/voices/intro-n.wav","启动试玩.cmd"}.issubset(paths)
        bundle.extractall(unpacked)
    # Validate what an end user actually unpacks before publishing the copy.
    cert = work / "check.json"
    subprocess.run(["node","scripts/check-field-release-v16.mjs",str(unpacked),str(cert)],cwd=ROOT,check=True)
    proof = json.loads(cert.read_text("utf8"))
    proof.update({"archive":archive.name,"bytes":archive.stat().st_size,"crc":"all entries passed","files":len(paths),
                  "localHtmlAndJsReferences":check_local_references(unpacked/"site"),
                  "sha256":hashlib.sha256(archive.read_bytes()).hexdigest()})
    if not args.draft:
        shutil.copy2(archive,OUT/archive.name)
        (OUT/"网页试玩包验收.json").write_text(json.dumps(proof,indent=2,ensure_ascii=False)+"\n","utf8")
    print(json.dumps(proof,ensure_ascii=False),flush=True)

if __name__ == "__main__":
    main()
