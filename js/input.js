/* Pixel Gridiron - touch / mouse / keyboard controls.
   Left side: floating joystick. Right side: open drag plane (throw) / tap plane (catch, juke, tackle). */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U;
  const I = {
    joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
    drag: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, t0: 0 },
    events: [], keys: {}, R: 26, splitFrac: 0.45, lastTap: 0, enabled: true,
  };
  let canvas = null, view = { w: 400, h: 200 };

  I.toInternal = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * view.w, y: (cy - r.top) / r.height * view.h };
  };
  I.setView = (w, h) => { view.w = w; view.h = h; };

  const now = () => performance.now() / 1000;

  function down(e) {
    if (!I.enabled) return;
    e.preventDefault();
    const p = I.toInternal(e.clientX, e.clientY);
    if (PG.Audio) PG.Audio.unlock();
    // pause button region top-right
    if (p.x > view.w - 24 && p.y < 20) { I.events.push({ type: 'pause' }); return; }
    if (p.x < view.w * I.splitFrac) {
      if (I.joy.active) return;
      Object.assign(I.joy, { active: true, id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y });
    } else {
      if (I.drag.active) return;
      Object.assign(I.drag, { active: true, id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y, t0: now(), maxD: 0 });
      I.events.push({ type: 'press', x: p.x, y: p.y, t: now() });
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function move(e) {
    const p = I.toInternal(e.clientX, e.clientY);
    if (I.joy.active && e.pointerId === I.joy.id) {
      I.joy.x = p.x; I.joy.y = p.y;
      const dx = p.x - I.joy.ox, dy = p.y - I.joy.oy, d = Math.hypot(dx, dy);
      if (d > I.R * 1.6) { I.joy.ox = p.x - dx / d * I.R * 1.6; I.joy.oy = p.y - dy / d * I.R * 1.6; }
    } else if (I.drag.active && e.pointerId === I.drag.id) {
      I.drag.x = p.x; I.drag.y = p.y;
      I.drag.maxD = Math.max(I.drag.maxD, Math.hypot(p.x - I.drag.ox, p.y - I.drag.oy));
    }
  }
  function up(e) {
    if (I.joy.active && e.pointerId === I.joy.id) { I.joy.active = false; I.joy.id = null; }
    else if (I.drag.active && e.pointerId === I.drag.id) {
      const d = I.drag;
      const dt = now() - d.t0, dx = d.x - d.ox, dy = d.y - d.oy, dist = Math.hypot(dx, dy);
      if (d.maxD < 9 && dt < 0.35) {
        const t = now();
        const dbl = t - I.lastTap < 0.32;
        I.events.push({ type: dbl ? 'dtap' : 'tap', x: d.x, y: d.y, t });
        I.lastTap = dbl ? 0 : t;
      } else if (dt < 0.3 && dist > 16) {
        const ang = Math.atan2(dy, dx);
        I.events.push({ type: 'swipe', dx, dy, ang, t: now() });
        I.events.push({ type: 'release', dx, dy, dist, dur: dt, t: now(), quick: true });
      } else {
        I.events.push({ type: 'release', dx, dy, dist, dur: dt, t: now() });
      }
      d.active = false; d.id = null;
    }
  }

  I.attach = (cv) => {
    canvas = cv;
    cv.addEventListener('pointerdown', down, { passive: false });
    cv.addEventListener('pointermove', move, { passive: false });
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!PG.Game || !PG.Game.active) return;
      I.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'Enter') { I.events.push({ type: 'tap', t: now(), key: true }); e.preventDefault(); }
      if (e.code === 'KeyJ') I.events.push({ type: 'tap', t: now(), key: true });
      if (e.code === 'KeyK') I.events.push({ type: 'swipe', dx: 30, dy: 0, ang: 0, t: now() });
      if (e.code === 'KeyL') I.events.push({ type: 'dtap', t: now() });
      if (e.code === 'Escape' || e.code === 'KeyP') I.events.push({ type: 'pause' });
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  };

  // returns joystick vector in screen space (-1..1)
  I.stick = () => {
    let x = 0, y = 0;
    if (I.joy.active) {
      x = (I.joy.x - I.joy.ox) / I.R; y = (I.joy.y - I.joy.oy) / I.R;
      const m = Math.hypot(x, y);
      if (m < 0.18) { x = 0; y = 0; } else if (m > 1) { x /= m; y /= m; }
    }
    const k = I.keys;
    if (k.ArrowLeft || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  };
  I.take = () => { const e = I.events; I.events = []; return e; };
  I.reset = () => { I.events = []; I.joy.active = false; I.drag.active = false; I.keys = {}; };

  PG.Input = I;
})();
