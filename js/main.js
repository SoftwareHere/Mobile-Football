/* Pixel Gridiron - bootstrap, canvas sizing, main loop */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U;
  const G = (PG.Game = { active: false, scene: null, paused: false, vw: 400, vh: 200 });

  G.init = () => {
    G.wrap = document.getElementById('game');
    G.canvas = document.getElementById('cv');
    G.ctx = G.canvas.getContext('2d');
    PG.Input.attach(G.canvas);
    window.addEventListener('resize', G.resize);
    window.addEventListener('orientationchange', () => setTimeout(G.resize, 200));
    document.addEventListener('visibilitychange', () => { G.hidden = document.hidden; G.last = performance.now(); });
    G.resize();
    G.last = performance.now();
    requestAnimationFrame(G.loop);
  };

  G.resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    let scale = h / 205;
    if (scale >= 2) scale = Math.floor(scale);
    scale = Math.max(1, scale);
    const vw = Math.max(240, Math.round(w / scale)), vh = Math.max(150, Math.round(h / scale));
    G.canvas.width = vw; G.canvas.height = vh;
    G.canvas.style.width = w + 'px'; G.canvas.style.height = h + 'px';
    G.vw = vw; G.vh = vh;
    PG.Input.setView(vw, vh);
    if (G.scene && G.scene.setView) G.scene.setView(vw, vh);
    G.portrait = h > w * 1.05;
    G.wrap.classList.toggle('portrait', G.portrait);
  };

  G.show = () => {
    G.active = true; G.paused = false;
    G.wrap.classList.add('on');
    document.getElementById('ui').style.display = 'none';
    G.resize();
  };
  G.hide = () => {
    G.active = false; G.scene = null; G.paused = false;
    G.wrap.classList.remove('on');
    document.getElementById('ui').style.display = 'block';
  };
  G.setScene = (s) => {
    G.scene = s;
    if (s.setView) s.setView(G.vw, G.vh);
    PG.Input.reset();
  };

  G.loop = (now) => {
    const dt = Math.min(0.05, (now - G.last) / 1000);
    G.last = now;
    if (G.active && G.scene && !G.hidden) {
      try {
        if (!G.paused && !G.portrait) for (let i = 0; i < (G.speed || 1) && G.scene; i++) G.scene.update(dt);
        if (G.scene) G.scene.render(G.ctx);
      } catch (e) {
        console.error(e);
        if (!G.errShown) { G.errShown = true; if (PG.UI) PG.UI.toast('Game error: ' + e.message, 'bad'); }
      }
    }
    requestAnimationFrame(G.loop);
  };

  const boot = () => {
    G.init();
    window.addEventListener('error', (e) => { console.error(e.error || e.message); if (PG.UI && !G.errShown) { G.errShown = true; PG.UI.toast('Error: ' + e.message, 'bad'); setTimeout(() => { G.errShown = false; }, 4000); } });
    document.addEventListener('pointerdown', () => { if (PG.Audio) { PG.Audio.unlock(); if (!G.active && document.querySelector('.screen.title')) PG.Audio.startMusic(); } }, { passive: true });
    const start = () => PG.UI.title();
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('12px "Press Start 2P"'), document.fonts.load('20px VT323')]).then(start, start);
    } else start();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
