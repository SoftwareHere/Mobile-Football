/* Pixel Gridiron - procedural pixel-art player sprites */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D;
  const Sp = {};
  Sp.W = 12; Sp.H = 17;

  const UPPER = {
    idle: ['....HHHH....', '...HHhhHH...', '..HHHhhHHM..', '..HHHHHFFM..', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '.AJJJTTJJJA.', '.AJJJTTJJJA.', '.GJJJJJJJJG.'],
    carry: ['....HHHH....', '...HHhhHH...', '..HHHhhHHM..', '..HHHHHFFM..', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '.AJJJTTJJAA.', '.AJJJTTJBBG.', '.GJJJJJJBB..'],
    throw: ['B...HHHH....', 'GA.HHhhHH...', '.AHHHhhHHM..', '.AHHHHHFFM..', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '..JJJTTJJJA.', '..JJJTTJJJA.', '..JJJJJJJJG.'],
    release: ['....HHHH....', '...HHhhHH...', '..HHHhhHHM..', '..HHHHHFFM..', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJAA.', '..JJJJJJJJAG', '.AJJJTTJJJ..', '.AJJJTTJJJ..', '.GJJJJJJJJ..'],
    catch: ['....HHHH..G.', '...HHhhHH.AG', '..HHHhhHHMA.', '..HHHHHFFMA.', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '..JJJTTJJJ..', '..JJJTTJJJ..', '..JJJJJJJJ..'],
    block: ['....HHHH....', '...HHhhHH...', '..HHHhhHHM..', '..HHHHHFFM..', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJAG', '.AJJJTTJJJAG', '.AJJJTTJJJ..', '.GJJJJJJJJ..'],
    cheer: ['.G..HHHH..G.', '.A.HHhhHH.A.', '.AHHHhhHHMA.', '.AHHHHHFFMA.', '..HHHHHFEM..', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '..JJJTTJJJ..', '..JJJTTJJJ..', '..JJJJJJJJ..'],
    flex: ['....HHHH....', '...HHhhHH...', 'G.HHHhhHHM.G', 'A.HHHHHFFM.A', 'AAHHHHHFEMAA', '...HHHSSMM..',
      '...JJJJJJ...', '..JJJJJJJJ..', '..JJJTTJJJ..', '..JJJTTJJJ..', '..JJJJJJJJ..'],
  };
  const LOWER = {
    stand: ['...PPPPPP...', '...PPppPP...', '...PP..PP...', '...KK..KK...', '...KK..KK...', '..CCC..CCC..'],
    run1: ['...PPPPPP...', '..PPP..PPP..', '..PP....PP..', '.KK......KK.', '.KK.......K.', 'CC........CC'],
    run2: ['...PPPPPP...', '....PPPP....', '....PPPP....', '....KKKK....', '....KK.K....', '...CCC.CC...'],
    run3: ['...PPPPPP...', '...PPP.PP...', '..PP...PP...', '..KK....KK..', '.KK......K..', '.CC......CC.'],
    squat: ['..PPPPPPP...', '.PPP...PPP..', '.KK.....KK..', '.KK.....KK..', 'CCC....CCC..', '............'],
  };

  const contrast = (a, b) => Math.abs(U.luma(a) - U.luma(b));

  // Build a color palette for a player on a team
  Sp.palette = (team, home, look) => {
    look = look || {};
    const c1 = team.c1, c2 = team.c2;
    const pal = {};
    if (home) {
      pal.J = c1;
      pal.T = contrast(c1, c2) > 0.25 ? c2 : (U.luma(c1) > 0.5 ? '#222222' : '#f4f4f4');
      pal.P = U.luma(c2) > 0.55 ? c2 : '#e6e6e6';
      pal.K = c1;
    } else {
      pal.J = '#f2f2f2';
      pal.T = U.luma(c1) < 0.8 ? c1 : c2;
      pal.P = U.luma(c1) < 0.75 ? c1 : c2;
      pal.K = U.luma(c1) < 0.75 ? c1 : c2;
    }
    pal.j = U.shade(pal.J, -0.25);
    pal.H = c1;
    pal.h = contrast(c1, c2) > 0.12 ? c2 : '#f4f4f4';
    pal.M = U.luma(c1) > 0.6 ? '#555b63' : '#b8bec6';
    pal.p = pal.T;
    const skin = D.SKIN[look.skin != null ? look.skin : 2];
    pal.S = skin; pal.F = skin;
    pal.E = '#111111';
    const vis = D.VISORS.find((v) => v.id === look.visor);
    if (vis && vis.color) { pal.F = vis.color; pal.E = U.shade(vis.color, -0.35); }
    const gear = (id, fallback) => { const g = D.GEAR_COLORS.find((x) => x.id === id); return g && g.color ? g.color : fallback; };
    pal.G = gear(look.gloves, contrast(c2, '#3a8a3a') > 0.15 ? c2 : '#f4f4f4');
    pal.Asl = gear(look.sleeveC, U.luma(c1) < 0.3 ? c1 : '#1a1a1a');
    pal.C = gear(look.cleats, c1);
    pal.B = '#7a3f17';
    pal.R = D.HAIR_COLORS[look.hairC || 0];
    pal.sleeves = look.sleeves || 0;
    pal.hair = look.hair || 0;
    pal.face = look.face || 0;
    pal.eb = look.eyeblack || 0;
    return pal;
  };

  const cache = new Map();
  Sp.clear = () => cache.clear();

  Sp.get = (pal, upper, lower, flip) => {
    const key = JSON.stringify(pal) + upper + lower + (flip ? 'f' : '');
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Sp.W; c.height = Sp.H;
    const x = c.getContext('2d');
    const rows = UPPER[upper].concat(LOWER[lower]);
    const px = (col, row, color) => {
      if (!color) return;
      x.fillStyle = color;
      x.fillRect(flip ? Sp.W - 1 - col : col, row, 1, 1);
    };
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        let col = pal[ch];
        if (ch === 'A') {
          // arms: back arm is the left half of the sprite, front arm the right
          const front = i >= 6;
          const s = pal.sleeves;
          const sleeved = s === 3 || (s === 1 && !front) || (s === 2 && front);
          col = sleeved ? pal.Asl : pal.S;
        }
        if (ch === 'T' || ch === 'p') col = pal.T;
        if (ch === 'b') col = '#ffffff';
        px(i, r, col);
      }
    }
    // laces on the ball
    for (let r = 0; r < rows.length; r++) {
      const i = rows[r].indexOf('B');
      if (i >= 0) { px(i, r, '#ffffff'); break; }
    }
    // hair under the helmet
    const hr = pal.hair;
    if (hr === 2) { px(2, 5, pal.R); px(2, 6, pal.R); px(3, 6, pal.R); }
    else if (hr === 3) { px(1, 5, pal.R); px(2, 5, pal.R); px(1, 6, pal.R); px(2, 6, pal.R); px(1, 7, pal.R); px(2, 8, pal.R); }
    else if (hr === 4) { px(2, 5, pal.R); px(2, 6, pal.R); px(2, 7, pal.R); }
    else if (hr === 5) { px(2, 5, pal.R); px(3, 5, pal.R); px(2, 6, pal.R); px(3, 6, pal.R); px(2, 7, pal.R); }
    // facial hair
    if (pal.face === 2 || pal.face === 3) { px(6, 5, pal.R); px(7, 5, pal.R); }
    else if (pal.face === 1) { px(7, 5, U.shade(pal.S, -0.25)); }
    else if (pal.face === 4) { px(7, 5, pal.R); }
    if (pal.eb === 1) px(7, 4, '#111111');
    else if (pal.eb === 2) px(7, 4, '#f4f4f4');
    if (cache.size > 900) cache.clear();
    cache.set(key, c);
    return c;
  };

  // pick a frame for an entity based on state
  Sp.frame = (e, t) => {
    let upper = 'idle', lower = 'stand';
    const moving = Math.hypot(e.vx || 0, e.vy || 0) > 0.6;
    if (moving) {
      const cyc = ['run1', 'run2', 'run3', 'run2'];
      lower = cyc[Math.floor((e.anim || 0) * 2.2) % 4];
    }
    if (e.hasBall) upper = 'carry';
    if (e.pose) upper = e.pose;
    if (e.lowerPose) lower = e.lowerPose;
    if (e.st === 'engaged') { upper = 'block'; lower = moving ? lower : 'run3'; }
    if (e.st === 'pre' && e.stance) { lower = 'squat'; }
    return { upper, lower };
  };

  // draw a static preview of a player to a canvas (used by menus)
  Sp.preview = (canvas, team, look, opts) => {
    opts = opts || {};
    const pal = Sp.palette(team, opts.home !== false, look);
    const img = Sp.get(pal, opts.upper || 'idle', opts.lower || 'stand', !!opts.flip);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = Math.floor(Math.min(canvas.width / Sp.W, canvas.height / Sp.H));
    const ox = Math.floor((canvas.width - Sp.W * s) / 2), oy = Math.floor((canvas.height - Sp.H * s) / 2);
    ctx.drawImage(img, ox, oy, Sp.W * s, Sp.H * s);
  };

  Sp.generic = { c1: '#2b4a8a', c2: '#e8b02a' };

  PG.Sprites = Sp;
})();
