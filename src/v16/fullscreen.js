import './fullscreen.css';

// A chapter review runs inside the main game's same-origin iframe. Toggle
// its host document so closing the chapter keeps the player's display mode.
export function bindFullscreen(host) {
  const buttons = [...document.querySelectorAll('.game-fullscreen')];
  const notice = document.getElementById('fullscreen-notice');
  const root = host.documentElement;
  let busy = false, timer;
  const active = () => Boolean(host.fullscreenElement || host.webkitFullscreenElement);

  function synchronize() {
    const on = active();
    const label = on ? '退出全屏' : '全屏体验';
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', label);
      button.title = label;
      button.firstElementChild.textContent = label;
    }
    notice.hidden = true;
  }

  async function toggle() {
    if (busy) return;
    busy = true;
    try {
      if (active()) {
        await (host.exitFullscreen || host.webkitExitFullscreen).call(host);
      } else {
        await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      }
      synchronize();
    } catch {
      notice.textContent = '当前窗口无法切换全屏。可在独立浏览器中打开游戏，或使用浏览器的全屏菜单。';
      notice.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { notice.hidden = true; }, 6500);
    } finally {
      busy = false;
    }
  }

  for (const button of buttons) button.addEventListener('click', toggle);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active()) return;
    // If the browser delivers Esc to the page, keep that same key from also
    // abandoning a workbench or leaving a chapter review.
    event.preventDefault();
    event.stopImmediatePropagation();
    void toggle();
  }, {capture: true});
  const events = ['fullscreenchange', 'webkitfullscreenchange'];
  for (const event of events) host.addEventListener(event, synchronize);
  synchronize();
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    clearTimeout(timer);
    for (const type of events) host.removeEventListener(type, synchronize);
  });
}
