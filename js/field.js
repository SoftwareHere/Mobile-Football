/* Pixel Gridiron - pre-rendered stadium & field */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, F = PG.Font;
  const W = 53.33;
  const Fd = { X0: -6, X1: 126, Y0: -16, Y1: W + 16 };
  let cache = null, cacheKey = '';

  Fd.build = (ppy, ys, info) => {
    const key = [ppy, ys, info.left.abbr, info.right.abbr, info.home.abbr, info.weather].join('|');
    if (cache && key === cacheKey) return cache;
    const wpx = Math.ceil((Fd.X1 - Fd.X0) * ppy), hpx = Math.ceil((Fd.Y1 - Fd.Y0) * ppy * ys);
    const c = document.createElement('canvas');
    c.width = wpx; c.height = hpx;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const X = (x) => Math.round((x - Fd.X0) * ppy);
    const Y = (y) => Math.round((y - Fd.Y0) * ppy * ys);
    const snow = info.weather === 'snow', rain = info.weather === 'rain';
    // stands
    g.fillStyle = '#23262f'; g.fillRect(0, 0, wpx, hpx);
    const crowdCols = [info.home.c1, info.home.c2, info.home.c1, '#f2f2f2', '#d9a066', '#8b5a2b', '#555', info.away.c1, '#c33', '#36c'];
    const drawCrowd = (y0, y1) => {
      for (let py = Y(y0); py < Y(y1); py += 3) {
        for (let px = 0; px < wpx; px += 2) {
          if (Math.random() < 0.82) {
            g.fillStyle = crowdCols[(Math.random() * crowdCols.length) | 0];
            g.fillRect(px, py, 2, 2);
          }
        }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, py + 2, wpx, 1);
      }
    };
    drawCrowd(-16, -4.5);
    drawCrowd(W + 6.5, W + 16);
    // ad boards / walls
    g.fillStyle = info.home.c1; g.fillRect(0, Y(-4.5), wpx, Y(-3) - Y(-4.5));
    g.fillStyle = '#111'; g.fillRect(0, Y(-3), wpx, 1);
    const ads = ['PIXEL GRIDIRON', 'ZOOMADE', 'GRIDLINE', 'BOLT ENERGY', 'TORQUE TRUCKS', info.home.city.toUpperCase(), 'PIXELPHONE', 'PEAK PROTEIN'];
    let ax = 4, ai = 0;
    while (ax < wpx) {
      const txt = ads[ai++ % ads.length];
      F.draw(g, txt, ax, Y(-4.5) + 1, { color: U.luma(info.home.c1) > 0.6 ? '#111' : '#fff', shadow: false });
      ax += F.width(txt) + 24;
    }
    g.fillStyle = info.home.c1; g.fillRect(0, Y(W + 4.8), wpx, Y(W + 6.3) - Y(W + 4.8));
    // sideline turf
    const turf = snow ? '#c9d6cf' : '#2f6f31';
    g.fillStyle = turf; g.fillRect(0, Y(-3), wpx, Y(0) - Y(-3));
    g.fillRect(0, Y(W), wpx, Y(W + 4.8) - Y(W));
    // benches & sideline players
    const benchX = [35, 85];
    for (const bx of benchX) {
      const team = bx < 60 ? info.home : info.away;
      g.fillStyle = '#666'; g.fillRect(X(bx - 12), Y(W + 3.4), X(bx + 12) - X(bx - 12), 3);
      for (let i = 0; i < 24; i++) {
        const px = X(bx - 12 + i + Math.random() * 0.5);
        g.fillStyle = team.c1; g.fillRect(px, Y(W + 2.2), 3, 4);
        g.fillStyle = '#ddd'; g.fillRect(px, Y(W + 2.2) - 2, 3, 2);
      }
    }
    // field stripes
    for (let x = 10; x < 110; x += 5) {
      const dark = ((x - 10) / 5) % 2 === 0;
      let col = dark ? '#3c8a37' : '#43963c';
      if (rain) col = dark ? '#357c31' : '#3b8636';
      if (snow) col = dark ? '#b9cbbd' : '#c6d6c9';
      g.fillStyle = col;
      g.fillRect(X(x), Y(0), X(x + 5) - X(x), Y(W) - Y(0));
    }
    // end zones
    const ez = (x0, team) => {
      g.fillStyle = snow ? U.shade(team.c1, 0.45) : U.shade(team.c1, -0.1);
      g.fillRect(X(x0), Y(0), X(x0 + 10) - X(x0), Y(W) - Y(0));
      const name = team.name.toUpperCase();
      const letters = name.replace(/ /g, '').split('');
      const total = letters.length * 9;
      const scale = Y(W) - Y(0) > total * 2 + 20 ? 2 : 1;
      let yy = Math.round((Y(0) + Y(W)) / 2 - (letters.length * 8 * scale) / 2);
      for (const ch of letters) {
        F.draw(g, ch, (X(x0) + X(x0 + 10)) / 2, yy, { color: U.luma(team.c2) > 0.25 ? team.c2 : '#ffffff', scale, align: 'center', shadow: '#00000088' });
        yy += 8 * scale;
      }
    };
    ez(0, info.left); ez(110, info.right);
    // lines
    g.fillStyle = '#f4f4f4';
    const vline = (x, w) => g.fillRect(X(x) - (w > 1 ? 1 : 0), Y(0), w || 1, Y(W) - Y(0));
    for (let x = 10; x <= 110; x += 5) vline(x, x === 10 || x === 110 ? 2 : 1);
    vline(0, 2); vline(120, 2);
    g.fillRect(X(0), Y(0), X(120) - X(0), 2);
    g.fillRect(X(0), Y(W) - 1, X(120) - X(0), 2);
    // hashes
    for (let x = 11; x < 110; x++) {
      if (x % 5 === 0) continue;
      for (const hy of [0.8, 23.58, 29.75, W - 0.8]) g.fillRect(X(x), Y(hy) - 1, 1, 2);
    }
    // numbers
    for (let x = 20; x <= 100; x += 10) {
      const n = x <= 60 ? x - 10 : 110 - x;
      const s = String(n);
      F.draw(g, s, X(x), Y(10.5), { align: 'center', scale: 2, color: '#f4f4f4', shadow: false });
      F.draw(g, s, X(x), Y(W - 10.5) - 12, { align: 'center', scale: 2, color: '#f4f4f4', shadow: false });
    }
    // midfield logo
    const ab = info.home.abbr;
    F.draw(g, ab, X(60), Y(W / 2) - 10, { align: 'center', scale: 3, color: U.luma(info.home.c2) > 0.25 ? info.home.c2 : '#fff', shadow: info.home.c1 });
    if (snow) {
      for (let i = 0; i < wpx * hpx / 60; i++) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect((Math.random() * wpx) | 0, (Math.random() * hpx) | 0, 1, 1); }
    }
    cache = c; cacheKey = key;
    return c;
  };

  Fd.draw = (ctx, ppy, ys, cam, info) => {
    const c = Fd.build(ppy, ys, info);
    const sx = Math.round((Fd.X0 - cam.x) * ppy), sy = Math.round((Fd.Y0 - cam.y) * ppy * ys);
    ctx.drawImage(c, sx, sy);
  };

  // goal posts with an oblique height projection
  Fd.drawPosts = (ctx, ppy, ys, zs, cam, x) => {
    const P = (wx, wy, z) => [Math.round((wx - cam.x) * ppy + z * 0.45 * ppy), Math.round((wy - cam.y) * ppy * ys - z * zs * ppy)];
    const line = (a, b, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w || 1;
      ctx.beginPath(); ctx.moveTo(a[0] + 0.5, a[1] + 0.5); ctx.lineTo(b[0] + 0.5, b[1] + 0.5); ctx.stroke();
    };
    const cy = W / 2;
    const yel = '#f5d000';
    line(P(x, cy, 0), P(x, cy, 3.33), yel, 2);
    line(P(x, cy - 3.08, 3.33), P(x, cy + 3.08, 3.33), yel, 2);
    line(P(x, cy - 3.08, 3.33), P(x, cy - 3.08, 11), yel, 1);
    line(P(x, cy + 3.08, 3.33), P(x, cy + 3.08, 11), yel, 1);
  };

  PG.Field = Fd;
})();
