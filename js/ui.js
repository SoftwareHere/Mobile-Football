/* Pixel Gridiron - menus & career screens (DOM) */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, L = PG.League, S = PG.Season, C = PG.Career, Sp = PG.Sprites, Plays = PG.Plays, h = U.h;
  const UI = {};
  const A = () => PG.Audio;

  UI.root = () => document.getElementById('ui');
  UI.set = (el) => {
    const r = UI.root();
    r.innerHTML = ''; r.appendChild(el); r.scrollTop = 0;
    r.style.display = 'block';
  };
  UI.toast = (text, kind) => {
    const t = h('div.toast' + (kind ? '.' + kind : ''), text);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  };
  UI.modal = (content, opts) => {
    opts = opts || {};
    const m = document.getElementById('modal');
    m.innerHTML = '';
    const close = () => { m.className = ''; m.innerHTML = ''; if (opts.onClose) opts.onClose(); };
    const box = h('div.mbox' + (opts.wide ? '.wide' : ''), opts.title ? h('div.mtitle', opts.title) : null, content,
      opts.noClose ? null : h('div.row.end', h('button.btn', { onclick: close }, opts.closeText || 'CLOSE')));
    m.appendChild(box);
    m.className = 'show';
    return close;
  };
  UI.closeModal = () => { const m = document.getElementById('modal'); m.className = ''; m.innerHTML = ''; };
  UI.confirm = (text, yes, yesText) => {
    const close = UI.modal(h('div', h('p', text), h('div.row', h('button.btn.big', { onclick: () => { close(); yes(); } }, yesText || 'YES'))), { closeText: 'CANCEL' });
  };
  const click = (fn) => (e) => { if (A()) A().click(); fn(e); };

  UI.badge = (t, big) => h('div.badge' + (big ? '.big' : ''), { style: { background: t.c1, color: U.luma(t.c2) > 0.2 ? t.c2 : '#fff', borderColor: t.c2 } }, t.abbr);
  UI.bar = (v, max, col) => h('div.bar', h('i', { style: { width: U.clamp(v / max * 100, 0, 100) + '%', background: col || '' } }));
  UI.sprite = (team, look, scale, pose) => {
    const c = h('canvas.sprite', { width: Sp.W * (scale || 6), height: Sp.H * (scale || 6) });
    Sp.preview(c, team || Sp.generic, look, { upper: pose && pose[0], lower: pose && pose[1] });
    return c;
  };
  UI.ratingCol = (v) => (v >= 90 ? '#3cff7a' : v >= 80 ? '#a6f05a' : v >= 70 ? '#ffe14d' : v >= 60 ? '#ffaa4d' : '#ff6060');
  UI.ovr = (v) => h('span.ovr', { style: { color: UI.ratingCol(v) } }, String(v));
  UI.table = (heads, rows, cls) => h('table.tbl' + (cls ? '.' + cls : ''), h('thead', h('tr', heads.map((x) => h('th', x)))), h('tbody', rows));
  UI.tabs = (list, cur, onPick) => h('div.subtabs', list.map(([id, label]) => h('button.stab' + (id === cur ? '.on' : ''), { onclick: click(() => onPick(id)) }, label)));

  // ================================================================== TITLE
  UI.title = () => {
    const slots = C.slots();
    const last = C.lastSlot();
    const hasLast = last != null && slots[last];
    const cv = h('canvas#titlecv', { width: 320, height: 120 });
    const el = h('div.screen.title',
      h('div.logo', h('div.l1', 'PIXEL'), h('div.l2', 'GRIDIRON'), h('div.l3', 'CAREER MODE')),
      cv,
      h('div.menu',
        hasLast ? h('button.btn.big', { onclick: click(() => UI.loadSlot(last)) }, 'CONTINUE') : null,
        h('button.btn.big' + (hasLast ? '.alt' : ''), { onclick: click(() => UI.newCareer()) }, 'NEW CAREER'),
        slots.some(Boolean) ? h('button.btn', { onclick: click(() => UI.loadMenu()) }, 'LOAD CAREER') : null,
        h('button.btn', { onclick: click(() => UI.howTo()) }, 'HOW TO PLAY'),
        h('button.btn.dim', { onclick: click(() => UI.globalSettings()) }, 'SETTINGS')),
      h('div.foot', 'Best played in landscape · Tap anywhere to enable sound'));
    UI.set(el);
    UI.titleAnim(cv);
    if (A()) A().startMusic();
  };
  UI.titleAnim = (cv) => {
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const teams = D.TEAMS;
    const runners = [];
    for (let i = 0; i < 5; i++) runners.push({ x: -20 - i * 70, y: 70 + (i % 3) * 14, t: U.pick(teams), look: { skin: U.rndi(0, 5), hair: U.rndi(0, 5), hairC: U.rndi(0, 3) }, sp: U.rnd(40, 70), ball: i === 0 });
    let last = performance.now();
    const loop = (now) => {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.fillStyle = '#3c8a37'; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let x = -((now / 30) % 40); x < cv.width; x += 40) { ctx.fillStyle = '#43963c'; ctx.fillRect(x, 0, 20, cv.height); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x, 0, 1, cv.height); }
      ctx.fillStyle = '#23262f'; ctx.fillRect(0, 0, cv.width, 34);
      for (let i = 0; i < 120; i++) { ctx.fillStyle = ['#e33', '#fff', '#36c', '#fd0', '#8b5a2b'][(i * 7 + Math.floor(now / 400)) % 5]; ctx.fillRect((i * 37) % cv.width, 4 + ((i * 13) % 26), 2, 2); }
      runners.sort((a, b) => a.y - b.y);
      for (const r of runners) {
        r.x += r.sp * dt;
        if (r.x > cv.width + 20) { r.x = -20; r.t = U.pick(teams); }
        const pal = Sp.palette(r.t, true, r.look);
        const fr = ['run1', 'run2', 'run3', 'run2'][Math.floor(now / 110 + r.y) % 4];
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(r.x) - 4, r.y + 15, 8, 2);
        ctx.drawImage(Sp.get(pal, r.ball ? 'carry' : 'idle', fr, false), Math.round(r.x) - 6, r.y);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  UI.loadMenu = () => {
    const slots = C.slots();
    const rows = slots.map((s, i) => h('div.slot',
      s ? h('div.sinfo', h('div.badge', { style: { background: s.c1 } }, s.team), h('div', h('b', s.name), h('div.tiny', `${s.pos} · OVR ${s.ovr} · Lvl ${s.level} · ${s.year} ${s.phase === 'regular' ? 'Wk ' + s.week : s.phase}`))) : h('div.sinfo.empty', 'Empty slot'),
      s ? h('div.row', h('button.btn.sm', { onclick: click(() => { UI.closeModal(); UI.loadSlot(i); }) }, 'LOAD'), h('button.btn.sm.dim', { onclick: click(() => UI.confirm('Delete this career?', () => { C.deleteSlot(i); UI.closeModal(); UI.title(); })) }, 'DELETE')) : null));
    UI.modal(h('div', rows), { title: 'LOAD CAREER' });
  };
  UI.loadSlot = (i) => {
    const cur = C.load(i);
    if (!cur) { UI.toast('Could not load save', 'bad'); return; }
    if (cur.career.retired) { UI.retiredScreen(); return; }
    C.applyGear();
    if (PG.Audio) { PG.Audio.setOn(cur.career.settings.sfx); PG.Audio.setMusic(cur.career.settings.music); }
    UI.hub('home');
  };

  UI.howTo = () => {
    UI.modal(h('div.howto',
      h('h3', 'ON THE FIELD'),
      h('p', h('b', 'Left thumb:'), ' a floating joystick appears wherever you touch the left side of the screen. Push it fully to sprint (watch your stamina bar).'),
      h('p', h('b', 'QB:'), ' the whole right side is an open drag plane. Touch anywhere, pull back like a slingshot and release to throw. Pull further for deeper throws; the dotted arc and target ring show where the ball lands. Double-tap to throw it away. You can flip the aim to "drag toward" in settings.'),
      h('p', h('b', 'WR / TE / RB:'), ' run your route (yellow line). Tap the right side to call for the ball. When a pass comes your way a skill-check ring appears — tap when the shrinking ring meets the green circle. PERFECT = +25% catch chance, GREAT = +15%, GOOD = +7%. Move under the landing marker!'),
      h('p', h('b', 'Ball carrier:'), ' tap = juke, swipe forward = stiff arm, swipe back = spin, swipe up/down = juke that way, double-tap = dive for extra yards.'),
      h('p', h('b', 'Defense (LB / CB / S):'), ' cover your man or zone, tap to burst or dive-tackle. When the ball is thrown near you, nail the ring timing to pick it off. Mash tap to shed blocks.'),
      h('h3', 'CAREER'),
      h('p', 'Get drafted, earn playing time, and climb the depth chart. Every game, practice and media event earns XP. Level up for skill points to upgrade attributes and unlock perks. Negotiate contracts, sign endorsements, buy gear and lifestyle upgrades, chase awards, records and the Hall of Fame.'),
      h('p', 'Each week you get 3 actions: train, rest, bond with teammates, or build your brand. Watch your energy — playing tired hurts and raises injury risk.'),
      h('p.tiny', 'Keyboard: WASD/arrows move, mouse drag on the right throws, Space taps, J juke, K stiff arm, L dive, P pause.')), { title: 'HOW TO PLAY', wide: true });
  };

  UI.globalSettings = () => {
    const st = C.cur ? C.cur.career.settings : (UI._gs = UI._gs || C.defaultSettings());
    const render = () => h('div.setlist',
      UI.toggleRow('Sound effects', st.sfx, () => { st.sfx = !st.sfx; if (A()) A().setOn(st.sfx); refresh(); }),
      UI.toggleRow('Menu music', st.music, () => { st.music = !st.music; if (A()) { A().setMusic(st.music); if (st.music) A().startMusic(); } refresh(); }),
      UI.toggleRow('Throw aim: pull back (slingshot)', st.aimMode !== 'push', () => { st.aimMode = st.aimMode === 'push' ? 'pull' : 'push'; refresh(); }),
      UI.toggleRow('Auto-pilot (routes & coverage) until I steer', st.autoRoute, () => { st.autoRoute = !st.autoRoute; refresh(); }),
      UI.toggleRow('Show routes before the snap', st.showRoutes, () => { st.showRoutes = !st.showRoutes; refresh(); }),
      UI.toggleRow('Slow-motion on catch skill checks', st.slowmo, () => { st.slowmo = !st.slowmo; refresh(); }),
      UI.toggleRow('Skip kick animations', st.fastKicks, () => { st.fastKicks = !st.fastKicks; refresh(); }),
      UI.toggleRow('Vibration', st.vibrate, () => { st.vibrate = !st.vibrate; refresh(); }),
      UI.toggleRow('Fullscreen', !!document.fullscreenElement, () => { UI.fullscreen(); setTimeout(refresh, 300); }));
    const box = h('div', render());
    const refresh = () => { box.innerHTML = ''; box.appendChild(render()); };
    UI.modal(box, { title: 'SETTINGS' });
  };
  UI.toggleRow = (label, on, fn) => h('div.setrow', h('span', label), h('button.tog' + (on ? '.on' : ''), { onclick: click(fn) }, on ? 'ON' : 'OFF'));
  UI.fullscreen = () => {
    const d = document.documentElement;
    if (!document.fullscreenElement) {
      const p = d.requestFullscreen ? d.requestFullscreen() : null;
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
    } else if (document.exitFullscreen) document.exitFullscreen();
  };

  // ================================================================== CREATOR
  UI.newCareer = () => {
    const st = UI.cs = {
      step: 0, pos: 'WR', arch: null, first: U.pick(D.FIRST), last: U.pick(D.LAST), num: null, college: U.pick(D.COLLEGES), home: U.pick(D.HOMETOWNS),
      ht: null, wt: null, look: { skin: 2, hair: 1, hairC: 0, face: 0, visor: 'none', sleeves: 0, sleeveC: 'team', gloves: 'team', cleats: 'team', eyeblack: 0, lefty: false },
      previewTeam: U.pick(D.TEAMS), difficulty: 'pro', seasonLength: 12, quarterLen: 6, playingTime: 'earn', injuries: true, aimMode: 'pull', autoRoute: false,
    };
    UI.renderCreator(st);
  };
  UI.CS_STEPS = ['Position', 'Style', 'Identity', 'Look', 'League'];
  UI.renderCreator = (st) => {
    const steps = h('div.steps', UI.CS_STEPS.map((s, i) => h('span' + (i === st.step ? '.on' : i < st.step ? '.done' : ''), (i + 1) + '. ' + s)));
    let body;
    if (st.step === 0) body = UI.csPosition(st);
    else if (st.step === 1) body = UI.csArch(st);
    else if (st.step === 2) body = UI.csIdentity(st);
    else if (st.step === 3) body = UI.csLook(st);
    else body = UI.csLeague(st);
    const canNext = st.step !== 1 || st.arch;
    const nav = h('div.row.cnav',
      h('button.btn', { onclick: click(() => { if (st.step === 0) UI.title(); else { st.step--; UI.renderCreator(st); } }) }, st.step === 0 ? 'BACK' : '< BACK'),
      st.step < 4 ? h('button.btn.big' + (canNext ? '' : '.dim'), { onclick: click(() => { if (!canNext) { UI.toast('Pick a play style'); return; } st.step++; UI.renderCreator(st); }) }, 'NEXT >')
        : h('button.btn.big', { onclick: click(() => UI.createCareer(st)) }, 'START CAREER'));
    UI.set(h('div.screen.creator', h('div.ctitle', 'CREATE YOUR PLAYER'), steps, h('div.cbody', body), nav));
  };
  const POSE = { QB: ['throw', 'stand'], RB: ['carry', 'run1'], WR: ['catch', 'run3'], TE: ['block', 'stand'], LB: ['block', 'run3'], CB: ['idle', 'run1'], S: ['cheer', 'stand'] };
  UI.csPosition = (st) => h('div.cards', D.CAREER_POS.map((pos) => h('button.card' + (st.pos === pos ? '.on' : ''), { onclick: click(() => { st.pos = pos; st.arch = null; st.ht = null; st.wt = null; st.num = null; UI.renderCreator(st); }) },
    UI.sprite(st.previewTeam, st.look, 4, POSE[pos]), h('div.cn', pos), h('div.cd', D.POS[pos].name),
    h('div.tiny', { QB: 'Drag-to-throw passing. Read defenses, run the offense, call your own plays.', RB: 'Take handoffs, juke & stiff-arm defenders, catch out of the backfield.', WR: 'Run routes, call for the ball and win catch skill checks.', TE: 'Block AND catch. A matchup nightmare in the middle of the field.', LB: 'Plug run gaps, blitz the QB, cover backs and tight ends.', CB: 'Shadow receivers in man or zone and pick off passes.', S: 'Patrol deep, read the QB and deliver big hits.' }[pos]))));
  UI.csArch = (st) => h('div.cards', D.ARCHETYPES[st.pos].map((a) => h('button.card.wide' + (st.arch === a.id ? '.on' : ''), { onclick: click(() => { st.arch = a.id; UI.renderCreator(st); }) },
    h('div.cn', a.name), h('div.cd', a.desc),
    h('div.mods', Object.entries(a.mod).map(([k, v]) => h('span' + (v > 0 ? '.up' : '.dn'), `${v > 0 ? '+' : ''}${v} ${D.ATTRS[k][0]}`))))));
  UI.csIdentity = (st) => {
    const def = D.POS[st.pos];
    if (st.ht == null) st.ht = Math.round((def.ht[0] + def.ht[1]) / 2);
    if (st.wt == null) st.wt = Math.round((def.wt[0] + def.wt[1]) / 2 / 5) * 5;
    if (st.num == null) st.num = Pl.pickNumber(st.pos);
    const inp = (key, ph) => h('input.inp', { value: st[key], maxlength: 14, placeholder: ph, oninput: (e) => { st[key] = e.target.value.replace(/[^A-Za-z' .-]/g, '').slice(0, 14); } });
    const sel = (key, list) => h('select.inp', { onchange: (e) => { st[key] = e.target.value; } }, list.map((x) => h('option', { value: x, selected: x === st[key] }, x)));
    const htLbl = h('span', U.heightStr(st.ht)), wtLbl = h('span', st.wt + ' lbs'), numLbl = h('span', '#' + st.num);
    return h('div.form',
      h('div.frow', h('label', 'First name'), inp('first', 'First'), h('button.btn.sm', { onclick: click(() => { st.first = U.pick(D.FIRST); UI.renderCreator(st); }) }, 'RANDOM')),
      h('div.frow', h('label', 'Last name'), inp('last', 'Last'), h('button.btn.sm', { onclick: click(() => { st.last = U.pick(D.LAST); UI.renderCreator(st); }) }, 'RANDOM')),
      h('div.frow', h('label', 'Jersey #'), h('input.rng', { type: 'range', min: 0, max: 99, value: st.num, oninput: (e) => { st.num = +e.target.value; numLbl.textContent = '#' + st.num; } }), numLbl),
      h('div.frow', h('label', 'Height'), h('input.rng', { type: 'range', min: def.ht[0], max: def.ht[1], value: st.ht, oninput: (e) => { st.ht = +e.target.value; htLbl.textContent = U.heightStr(st.ht); } }), htLbl),
      h('div.frow', h('label', 'Weight'), h('input.rng', { type: 'range', min: def.wt[0], max: def.wt[1], step: 5, value: st.wt, oninput: (e) => { st.wt = +e.target.value; wtLbl.textContent = st.wt + ' lbs'; } }), wtLbl),
      h('div.tiny', 'Taller players have a bigger catch radius. Heavier players are stronger but a step slower.'),
      h('div.frow', h('label', 'College'), sel('college', D.COLLEGES)),
      h('div.frow', h('label', 'Hometown'), sel('home', D.HOMETOWNS)));
  };
  UI.csLook = (st) => UI.lookEditor(st.look, st.previewTeam, st.pos, () => UI.renderCreator(st), (t) => { st.previewTeam = t; UI.renderCreator(st); });
  UI.lookEditor = (look, team, pos, rerender, setTeam) => {
    const sw = (arr, key, colorOf) => h('div.swatches', arr.map((c, i) => h('button.sw' + (look[key] === (colorOf ? c.id : i) ? '.on' : ''), { style: { background: colorOf ? (c.color || team.c2) : c }, title: colorOf ? c.name : '', onclick: click(() => { look[key] = colorOf ? c.id : i; rerender(); }) })));
    const chips = (arr, key, vals) => h('div.chips', arr.map((n, i) => h('button.chip' + (look[key] === (vals ? vals[i] : i) ? '.on' : ''), { onclick: click(() => { look[key] = vals ? vals[i] : i; rerender(); }) }, n)));
    const prev = h('div.preview',
      h('div.prow', UI.sprite(team, look, 7, ['idle', 'stand']), UI.sprite(team, look, 7, ['carry', 'run1']), UI.sprite(team, look, 7, [pos === 'QB' ? 'throw' : 'catch', 'run3'])),
      h('div.tiny', 'Preview colors: ' + L.teamName(team)),
      setTeam ? h('button.btn.sm', { onclick: click(() => setTeam(U.pick(D.TEAMS))) }, 'TRY ANOTHER TEAM') : null);
    return h('div.looked', prev,
      h('div.lopts',
        h('div.lrow', h('label', 'Skin'), sw(D.SKIN, 'skin')),
        h('div.lrow', h('label', 'Hair'), chips(D.HAIR_STYLES, 'hair')),
        h('div.lrow', h('label', 'Hair color'), sw(D.HAIR_COLORS, 'hairC')),
        h('div.lrow', h('label', 'Facial hair'), chips(D.FACIAL, 'face')),
        h('div.lrow', h('label', 'Visor'), chips(D.VISORS.map((v) => v.name), 'visor', D.VISORS.map((v) => v.id))),
        h('div.lrow', h('label', 'Eye black'), chips(D.EYEBLACK, 'eyeblack')),
        h('div.lrow', h('label', 'Arm sleeves'), chips(D.SLEEVES, 'sleeves')),
        h('div.lrow', h('label', 'Sleeve color'), sw(D.GEAR_COLORS, 'sleeveC', true)),
        h('div.lrow', h('label', 'Gloves'), sw(D.GEAR_COLORS, 'gloves', true)),
        h('div.lrow', h('label', 'Cleats'), sw(D.GEAR_COLORS, 'cleats', true)),
        pos === 'QB' ? h('div.lrow', h('label', 'Throwing hand'), chips(['Right', 'Left'], 'lefty', [false, true])) : null));
  };
  UI.csLeague = (st) => {
    const opt = (key, vals, labels) => h('div.chips', vals.map((v, i) => h('button.chip' + (st[key] === v ? '.on' : ''), { onclick: click(() => { st[key] = v; UI.renderCreator(st); }) }, labels[i])));
    const dd = D.DIFFICULTY.find((d) => d.id === st.difficulty);
    return h('div.form',
      h('div.lrow', h('label', 'Difficulty'), opt('difficulty', D.DIFFICULTY.map((d) => d.id), D.DIFFICULTY.map((d) => d.name))),
      h('div.tiny', `${dd.name}: opponents ${dd.ai >= 0 ? '+' : ''}${dd.ai} ratings, catch window x${dd.win}, XP x${dd.xp}`),
      h('div.lrow', h('label', 'Season length'), opt('seasonLength', [8, 12, 17], ['8 games', '12 games', '17 games'])),
      h('div.lrow', h('label', 'Quarter length'), opt('quarterLen', [3, 6, 10, 15], ['3 min', '6 min', '10 min', '15 min'])),
      h('div.tiny', 'Only the drives you are on the field for are played; the rest are simulated play-by-play.'),
      h('div.lrow', h('label', 'Playing time'), opt('playingTime', ['earn', 'starter'], ['Earn it (depth chart)', 'Guaranteed starter'])),
      h('div.lrow', h('label', 'Injuries'), opt('injuries', [true, false], ['On', 'Off'])),
      h('div.lrow', h('label', 'Throw aim'), opt('aimMode', ['pull', 'push'], ['Pull back (slingshot)', 'Drag toward target'])),
      h('div.lrow', h('label', 'Auto-pilot'), opt('autoRoute', [false, true], ['Off: I steer everything', 'On: AI runs my route/coverage until I steer'])));
  };
  UI.createCareer = (st) => {
    if (!st.first.trim() || !st.last.trim()) { UI.toast('Enter a name'); st.step = 2; UI.renderCreator(st); return; }
    UI.set(h('div.screen.loading', h('div.big', 'GENERATING LEAGUE...'), h('div.tiny', '32 teams · 1,500 players · schedules · contracts')));
    setTimeout(() => {
      C.newCareer({ pos: st.pos, arch: st.arch, first: st.first.trim(), last: st.last.trim(), num: st.num, college: st.college, home: st.home, ht: st.ht, wt: st.wt,
        look: st.look, difficulty: st.difficulty, seasonLength: st.seasonLength, quarterLen: st.quarterLen, playingTime: st.playingTime, injuries: st.injuries,
        settings: { aimMode: st.aimMode, autoRoute: st.autoRoute } });
      C.cur.slot = C.freeSlot();
      UI.combine();
    }, 60);
  };

  // ================================================================== COMBINE & DRAFT
  UI.combine = () => {
    const { career } = C.cur, p = C.user(), cb = career.combine;
    const grade = cb.grade;
    const proj = grade >= 78 ? '1st round' : grade >= 72 ? '1st-2nd round' : grade >= 66 ? '2nd-3rd round' : '3rd round+';
    const el = h('div.screen.combine',
      h('div.ctitle', 'SCOUTING COMBINE'),
      h('div.cmb',
        h('div.cmb-card', UI.sprite(Sp.generic, p.look, 7, POSE[p.pos]), h('div.big', Pl.full(p)), h('div.sub', `${p.pos} · ${p.college} · ${U.heightStr(p.ht)} ${p.wt} lbs`), h('div', 'Overall ', UI.ovr(p.ovr))),
        h('div.cmb-res',
          UI.table(['Drill', 'Result'], [
            h('tr', h('td', '40-yard dash'), h('td', cb.forty.toFixed(2) + 's')),
            h('tr', h('td', 'Bench press (225)'), h('td', cb.bench + ' reps')),
            h('tr', h('td', 'Vertical jump'), h('td', cb.vert + '"')),
            h('tr', h('td', 'Broad jump'), h('td', Math.floor(cb.broad / 12) + "'" + (cb.broad % 12) + '"')),
            h('tr', h('td', '3-cone'), h('td', cb.cone.toFixed(2) + 's')),
            h('tr', h('td', 'Shuttle'), h('td', cb.shuttle.toFixed(2) + 's'))]),
          h('div.sub', `Scout grade: ${grade} · Projection: ${proj}`),
          h('div.tiny', 'Nail the position drill to impress scouts and climb draft boards.'),
          h('div.row',
            h('button.btn.big', { onclick: click(() => UI.combineDrill()) }, 'POSITION DRILL'),
            h('button.btn', { onclick: click(() => UI.draftDay(0)) }, 'SKIP TO DRAFT')))));
    UI.set(el);
  };
  UI.combineDrill = () => {
    const p = C.user();
    UI.runDrill(p.pos === 'QB' ? 'throw' : 'catch', Sp.generic, (score) => {
      const bonus = Math.round((score - 0.45) * 12);
      UI.toast(`Drill score ${Math.round(score * 100)} — draft stock ${bonus >= 0 ? 'up' : 'down'} ${Math.abs(bonus)}`);
      UI.draftDay(bonus);
    });
  };
  UI.runDrill = (kind, team, done) => {
    const { career, lg } = C.cur;
    const diff = D.DIFFICULTY.find((d) => d.id === lg.settings.difficulty) || D.DIFFICULTY[1];
    PG.Game.show();
    const tm = Object.assign({ c1: '#2b4a8a', c2: '#e8b02a', abbr: 'PRO', name: 'Prospects', city: 'Combine' }, team || {});
    const d = new PG.Drill({ kind, player: C.user(), team: tm, settings: career.settings, diff, perks: new Set(career.perks.equipped),
      onEnd: (score) => { PG.Game.hide(); done(score); } });
    PG.Game.setScene(d);
  };
  UI.draftDay = (bonus) => {
    const res = C.draftUser(bonus);
    const t = res.team;
    const lg = C.cur.lg;
    const ticker = h('div.ticker');
    const reveal = h('div.reveal.hidden',
      h('div.kicker', `ROUND ${res.round} · PICK ${res.pick}`),
      h('div.big', 'The ' + L.teamName(t) + ' select...'),
      UI.badge(t, true),
      h('div.big.gold', Pl.full(C.user()).toUpperCase()),
      h('div.sub', `Rookie contract: 4 years, ${U.money(C.user().con.sal)}/yr · Signing bonus ${U.money(C.user().con.bonus)}`),
      h('div.sub', `Head coach ${t.coach.name} · ${D.OFF_SCHEMES.find((s) => s.id === t.coach.off).name} offense · ${D.DEF_SCHEMES.find((s) => s.id === t.coach.def).name} defense`),
      h('button.btn.big', { onclick: click(() => { C.save(); UI.hub('home'); }) }, 'GO TO TEAM FACILITY'));
    UI.set(h('div.screen.draft', h('div.ctitle', `${lg.year} PRO FOOTBALL DRAFT`), ticker, reveal));
    let n = 1;
    const fakePos = D.POS_ORDER.filter((p) => p !== 'K' && p !== 'P');
    const iv = setInterval(() => {
      if (!document.body.contains(ticker)) { clearInterval(iv); return; }
      if (n >= res.pick || n > 40) {
        clearInterval(iv); reveal.classList.remove('hidden'); if (A()) A().td(0.7);
        return;
      }
      const tm = U.pick(lg.teams);
      ticker.prepend(h('div.tk', `#${n} ${tm.abbr} — ${U.pick(fakePos)} ${U.pick(D.FIRST)} ${U.pick(D.LAST)}`));
      if (A()) A().blip(440 + n * 6);
      n += res.pick > 30 ? Math.ceil(res.pick / 25) : 1;
    }, 110);
  };

  // ================================================================== HUB
  UI.NAV = [['home', 'HOME'], ['player', 'PLAYER'], ['train', 'TRAIN'], ['locker', 'LOCKER'], ['team', 'TEAM'], ['plays', 'PLAYBOOK'], ['league', 'LEAGUE'], ['career', 'CAREER'], ['agent', 'AGENT'], ['menu', 'MENU']];
  UI.hub = (tab, sub) => {
    if (!C.cur) { UI.title(); return; }
    if (A()) A().stopMusic();
    UI.tab = tab || UI.tab || 'home';
    const { career, lg } = C.cur, p = C.user(), t = C.userTeam();
    document.documentElement.style.setProperty('--team1', t ? t.c1 : '#2b4a8a');
    document.documentElement.style.setProperty('--team2', t ? t.c2 : '#e8b02a');
    const top = h('div.topbar',
      t ? UI.badge(t) : h('div.badge', 'FA'),
      h('div.tb-name', h('b', Pl.full(p)), h('span.tiny', `${p.pos} #${p.num}${career.nickname ? ' "' + career.nickname + '"' : ''} · Age ${p.age}`)),
      h('div.tb-ovr', 'OVR ', UI.ovr(p.ovr)),
      h('div.tb-lvl', h('span.tiny', `LVL ${career.level}` + (career.sp ? ` · ${career.sp} SP` : '')), UI.bar(career.xp, C.xpNeeded(career.level), '#7df')),
      h('div.tb-money', U.money(career.money)),
      h('div.tb-en', h('span.tiny', 'ENERGY'), UI.bar(career.energy, 100, career.energy > 50 ? '#5f5' : career.energy > 25 ? '#fd5' : '#f55')),
      h('div.tb-wk', UI.phaseLabel()));
    const nav = h('div.nav', UI.NAV.map(([id, label]) => h('button.nv' + (id === UI.tab ? '.on' : ''), { onclick: click(() => UI.hub(id)) },
      label, id === 'player' && career.sp > 0 ? h('i.dot') : null, id === 'agent' && (career.offers.length || C.contractNeeded()) ? h('i.dot') : null, id === 'train' && career.event != null ? h('i.dot') : null)));
    const content = h('div.content');
    const fn = { home: UI.tHome, player: UI.tPlayer, train: UI.tTrain, locker: UI.tLocker, team: UI.tTeam, plays: UI.tPlays, league: UI.tLeague, career: UI.tCareer, agent: UI.tAgent, menu: UI.tMenu }[UI.tab];
    content.appendChild(fn(sub));
    UI.set(h('div.screen.hub', top, h('div.hubbody', nav, content)));
  };
  UI.refresh = (sub) => UI.hub(UI.tab, sub);
  UI.phaseLabel = () => {
    const lg = C.cur.lg;
    if (lg.phase === 'regular') return `${lg.year} · WEEK ${lg.week}/${lg.settings.seasonLength}`;
    if (lg.phase === 'playoffs') return `${lg.year} · ${D.ROUND_NAMES[lg.playoffs.round].toUpperCase()}`;
    return `${lg.year} · OFFSEASON`;
  };
  UI.userGame = () => {
    const lg = C.cur.lg, ut = C.userTeamId(lg);
    if (lg.phase === 'regular') { const g = L.gameFor(lg, lg.week, ut); return g && !g.played ? { g, playoff: false } : null; }
    if (lg.phase === 'playoffs') { const g = S.currentPlayoffGames(lg).find((x) => !x.played && (x.h === ut || x.a === ut)); return g ? { g, playoff: true } : null; }
    return null;
  };

  // ---------------- HOME
  UI.tHome = () => {
    const { career, lg } = C.cur, p = C.user(), t = C.userTeam();
    const col = h('div.cols');
    const left = h('div.col'), right = h('div.col');
    col.append(left, right);
    const phase = lg.phase;
    if (phase === 'regular' || phase === 'playoffs') {
      const ug = UI.userGame();
      if (ug) left.appendChild(UI.nextGameCard(ug));
      else if (phase === 'playoffs') {
        const alive = lg.playoffs && S.currentPlayoffGames(lg).length;
        left.appendChild(h('div.card', h('div.kicker', D.ROUND_NAMES[lg.playoffs.round].toUpperCase()),
          h('div.sub', lg.playoffs.round === 0 && lg.playoffs.seeds[t.conf][0] === t.id ? 'Your team earned a first-round BYE!' : 'Your season is over. The playoffs continue without you.'),
          alive ? h('button.btn.big', { onclick: click(() => UI.simPlayoffRound()) }, 'SIM ROUND') : null));
      }
      if (lg.phase === 'playoffs' && lg.playoffs) left.appendChild(UI.bracketCard());
      // weekly actions summary
      left.appendChild(h('div.card', h('div.kicker', 'THIS WEEK'),
        h('div.sub', `Actions left: ${'●'.repeat(career.actions)}${'○'.repeat(Math.max(0, career.maxActions - career.actions))}`),
        career.event != null ? h('button.btn.alt', { onclick: click(() => UI.hub('train')) }, '! ' + D.EVENTS[career.event].title.toUpperCase()) : null,
        career.offers.length ? h('button.btn.alt', { onclick: click(() => UI.hub('agent')) }, `${career.offers.length} ENDORSEMENT OFFER${career.offers.length > 1 ? 'S' : ''}`) : null,
        h('button.btn', { onclick: click(() => UI.hub('train')) }, 'GO TRAIN'),
        career.lastWeek ? h('div.tiny', `Last week: +${U.money(career.lastWeek.income)} income, -${U.money(career.lastWeek.costs)} costs`) : null));
      right.appendChild(UI.goalsCard());
    } else left.appendChild(UI.offseasonCard());
    right.appendChild(UI.depthMini());
    right.appendChild(UI.newsCard(6));
    if (career.gameLog.length) {
      const g = career.gameLog[career.gameLog.length - 1];
      right.appendChild(h('div.card', h('div.kicker', 'LAST GAME'), h('div.sub', `${g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T'} ${g.us}-${g.them} ${g.home ? 'vs' : '@'} ${g.opp} · Grade ${g.grade}`), h('div.tiny', g.line)));
    }
    return col;
  };
  UI.nextGameCard = (ug) => {
    const lg = C.cur.lg, p = C.user();
    const g = ug.g;
    const ut = p.team;
    const opp = lg.teams[g.h === ut ? g.a : g.h];
    const home = g.h === ut;
    const ro = L.ratings(lg, opp), rm = L.ratings(lg, lg.teams[ut]);
    const injured = p.inj && p.inj.wks > 0;
    const d = L.depth(lg, lg.teams[ut]);
    const rank = d[p.pos].indexOf(p) + 1;
    const fc = PG.GameState.weatherFor(lg, lg.teams[g.h], lg.week, g.night);
    const role = rank === 1 ? 'STARTER' : rank > 0 ? `${p.pos}${rank} on the depth chart` : 'Inactive';
    return h('div.card.next',
      h('div.kicker', ug.playoff ? D.ROUND_NAMES[lg.playoffs.round].toUpperCase() : `WEEK ${lg.week}${g.night ? ' · PRIMETIME' : ''}`),
      h('div.matchup.sm',
        h('div.tm', UI.badge(home ? opp : lg.teams[ut]), h('div.tr', L.record(home ? opp : lg.teams[ut]))),
        h('div.at', '@'),
        h('div.tm', UI.badge(home ? lg.teams[ut] : opp), h('div.tr', L.record(home ? lg.teams[ut] : opp)))),
      h('div.sub', `${L.teamName(opp)} · OVR ${ro.ovr} (OFF ${ro.off} / DEF ${ro.def}) vs your ${rm.ovr}`),
      h('div.tiny', `Forecast: ${PG.Match.weatherStr(fc)} · Your role: ${role}`),
      injured ? h('div.warn', `Injured: ${p.inj.name} (${p.inj.wks} wk)`) : null,
      h('div.row',
        h('button.btn.big', { onclick: click(() => UI.playGame(ug)) }, injured ? 'WATCH GAME' : 'PLAY GAME'),
        h('button.btn', { onclick: click(() => UI.simGame(ug)) }, 'SIM GAME')));
  };
  UI.goalsCard = () => {
    const { career } = C.cur, p = C.user();
    C.checkSeasonGoals();
    return h('div.card', h('div.kicker', 'GOALS'),
      h('div.tiny', 'THIS GAME'),
      career.gameGoals.map((g) => h('div.goal' + (g.done ? '.done' : ''), `${g.done ? '✔' : '○'} ${g.text} (+${g.xp} XP)`)),
      h('div.tiny', 'THIS SEASON'),
      career.goals.map((g) => {
        const v = g.key === 'wins' ? (C.userTeam() ? C.userTeam().w : 0) : g.key === 'playoffs' ? (g.done ? 1 : 0) : (p.s[g.key] || 0);
        return h('div.goal' + (g.done ? '.done' : ''), `${g.done ? '✔' : '○'} ${g.text}`, h('span.tiny', ` ${U.num(Math.min(v, g.target))}/${U.num(g.target)}`), UI.bar(v, g.target, g.done ? '#5f5' : '#7df'));
      }));
  };
  UI.depthMini = () => {
    const lg = C.cur.lg, p = C.user(), t = C.userTeam();
    if (!t) return h('div');
    L.invalidate();
    const d = L.depth(lg, t, true)[p.pos].slice(0, 5);
    return h('div.card', h('div.kicker', `${p.pos} DEPTH CHART`),
      d.map((x, i) => h('div.dline' + (x.isUser ? '.me' : ''), h('span', `${i + 1}.`), h('span', Pl.name(x)), h('span', x.inj ? 'INJ' : ''), UI.ovr(x.ovr))),
      lg.settings.playingTime === 'earn' ? h('div.tiny', 'Raise your overall and coach trust to climb the depth chart.') : h('div.tiny', 'Guaranteed starter mode.'));
  };
  UI.newsCard = (n) => {
    const lg = C.cur.lg;
    return h('div.card', h('div.kicker', 'NEWS'), lg.news.slice(0, n).map((x) => h('div.news.' + x.type, h('span.tiny', `${x.y} W${x.w} `), x.text)));
  };
  UI.bracketCard = () => {
    const lg = C.cur.lg, po = lg.playoffs;
    const rounds = po.games.map((gs, r) => gs && gs.length ? h('div.round', h('div.tiny', D.ROUND_NAMES[r]), gs.map((g) => {
      const a = lg.teams[g.a], hm = lg.teams[g.h];
      return h('div.bg', h('span' + (g.played && S.playoffWinner(g) === g.a ? '.w' : ''), `${S.seedOf(lg, a.id)} ${a.abbr} ${g.played ? g.as : ''}`), h('span' + (g.played && S.playoffWinner(g) === g.h ? '.w' : ''), `${S.seedOf(lg, hm.id)} ${hm.abbr} ${g.played ? g.hs : ''}`));
    })) : null);
    return h('div.card', h('div.kicker', 'PLAYOFF BRACKET'), h('div.bracket', rounds));
  };

  // ---------------- game flow
  UI.playGame = (ug) => {
    UI.root().style.display = 'none';
    PG.Match.start(ug.g, { playoff: ug.playoff, onDone: (summary) => UI.postGame(summary, ug) });
  };
  UI.simGame = (ug) => {
    const lg = C.cur.lg;
    const gs = new PG.GameState(lg, ug.g, { playoff: ug.playoff, userPid: C.userPid() });
    gs.simToEnd(); gs.creditGP();
    if (ug.playoff) { S.recordPlayoffResult(lg, ug.g, gs); if (ug.g.round === 3) ug.g.mvp = S.gameMVP(lg, gs, S.playoffWinner(ug.g)); }
    else { L.applyResult(lg, ug.g, gs.score.home, gs.score.away); S.applyBox(lg, gs); }
    const summary = C.postGame(gs, {});
    summary.gs = gs; summary.simmed = true;
    UI.postGame(summary, ug);
  };
  UI.postGame = (sm, ug) => {
    const gs = sm.gs, lg = C.cur.lg, p = C.user();
    const side = gs.sideOf(p.team);
    const us = gs.teams[side], them = gs.teams[side === 'home' ? 'away' : 'home'];
    const result = sm.win ? 'VICTORY' : sm.tie ? 'TIE' : 'DEFEAT';
    if (A()) { if (sm.win) A().td(0.6); if (sm.levels && sm.levels.length) setTimeout(() => A().levelUp(), 600); }
    const boxRows = [];
    const ppl = Object.keys(gs.box).map((id) => lg.players[id]).filter((x) => x && (x.team === us.id || x.team === them.id));
    const top = ppl.sort((a, b) => Pl.prodScore(b.pos, gs.box[b.id]) - Pl.prodScore(a.pos, gs.box[a.id])).slice(0, 8);
    for (const x of top) boxRows.push(h('tr' + (x.isUser ? '.me' : ''), h('td', lg.teams[x.team].abbr), h('td', `${x.pos} ${Pl.name(x)}`), h('td', Pl.statLine(x.pos, gs.box[x.id]))));
    const qs = (s) => gs.qs[s].slice(0, gs.q >= 5 ? 5 : 4).map((v) => h('td', String(v)));
    const el = h('div.screen.post',
      h('div.ctitle' + (sm.win ? '.gold' : ''), result),
      h('div.scoreline.big', `${gs.teams.away.abbr} ${gs.score.away}  —  ${gs.teams.home.abbr} ${gs.score.home}`),
      UI.table(['', 'Q1', 'Q2', 'Q3', 'Q4'].concat(gs.q >= 5 ? ['OT'] : []).concat(['T']), [
        h('tr', h('td', gs.teams.away.abbr), qs('away'), h('td', h('b', String(gs.score.away)))),
        h('tr', h('td', gs.teams.home.abbr), qs('home'), h('td', h('b', String(gs.score.home))))], 'qtr'),
      h('div.cols',
        h('div.col', h('div.card',
          h('div.kicker', 'YOUR GAME'),
          h('div.grade', 'GRADE ', h('b', { style: { color: sm.grade.letter[0] === 'A' ? '#3cff7a' : sm.grade.letter[0] === 'B' ? '#a6f05a' : sm.grade.letter[0] === 'C' ? '#ffe14d' : '#ff6060' } }, sm.grade.letter)),
          h('div.sub', Pl.statLine(p.pos, sm.box)),
          h('div.sub', `+${sm.xp} XP` + (sm.levels.length ? ` · LEVEL UP! (${sm.levels.join(', ')})` : '') + ` · +${U.num(sm.fansGained)} fans`),
          h('div.tiny', `Coach trust ${sm.trustDelta >= 0 ? '+' : ''}${sm.trustDelta}`),
          sm.goals.length ? h('div.sub.gold', 'Goals: ' + sm.goals.map((g) => g.text).join(', ')) : null,
          sm.milestones && sm.milestones.length ? h('div.sub.gold', 'Milestone: ' + sm.milestones.join(', ')) : null,
          p.inj && p.inj.wks > 0 ? h('div.warn', `Injury: ${p.inj.name}, out ${p.inj.wks} week(s)`) : null)),
        h('div.col', h('div.card', h('div.kicker', 'TOP PERFORMERS'), UI.table(['Tm', 'Player', 'Line'], boxRows)))),
      h('div.row', h('button.btn.big', { onclick: click(() => UI.advanceAfterGame(ug)) }, 'CONTINUE')));
    UI.set(el);
    UI.root().style.display = 'block';
  };
  UI.advanceAfterGame = (ug) => {
    const lg = C.cur.lg;
    if (lg.phase === 'regular') {
      S.simOtherGames(lg);
      S.endRegularWeek(lg);
      C.checkSeasonGoals();
      if (lg.phase === 'playoffs') {
        const t = C.userTeam();
        const inPO = lg.playoffs.seeds[t.conf].includes(t.id);
        C.log(inPO ? `Clinched a playoff spot (#${S.seedOf(lg, t.id)} seed).` : 'Missed the playoffs.');
        C.checkSeasonGoals();
      }
      C.weekStart();
    } else if (lg.phase === 'playoffs') {
      S.simPlayoffGames(lg, true);
      S.advancePlayoffRound(lg);
      if (lg.phase === 'playoffs') C.weekStart();
    }
    C.save();
    UI.hub('home');
  };
  UI.simPlayoffRound = () => {
    const lg = C.cur.lg;
    S.simPlayoffGames(lg, false);
    S.advancePlayoffRound(lg);
    if (lg.phase === 'playoffs') C.weekStart();
    C.save();
    UI.hub('home');
  };

  // ---------------- OFFSEASON
  UI.offseasonCard = () => {
    const { career, lg } = C.cur, p = C.user();
    const ph = lg.phase;
    const card = h('div.card.off');
    if (ph === 'awards') {
      const champ = lg.champions[0];
      card.append(h('div.kicker', 'SEASON COMPLETE'),
        champ && champ.year === lg.year ? h('div.sub', `${champ.name} won the ${D.CHAMP_NAME} (${champ.score}).`) : null,
        h('button.btn.big', { onclick: click(() => UI.awardsScreen()) }, 'AWARDS CEREMONY'));
    } else if (ph === 'resign') {
      const need = C.contractNeeded();
      card.append(h('div.kicker', 'OFFSEASON · RE-SIGNING PERIOD'),
        h('div.sub', need ? 'Your contract has expired! Negotiate with your team or test free agency.' : `Your contract: ${p.con.yrs} more season(s) at ${U.money(p.con.sal)}/yr.`),
        need ? h('button.btn.big', { onclick: click(() => UI.contractTalks(false)) }, 'NEGOTIATE') : h('button.btn.big', { onclick: click(() => { S.offseasonContracts(lg); C.offseasonWeek(); C.save(); UI.hub('home'); }) }, 'ADVANCE TO DRAFT'),
        h('div.tiny', 'Teams are re-signing their own free agents.'));
    } else if (ph === 'draft') {
      card.append(h('div.kicker', 'OFFSEASON · DRAFT'), h('div.sub', '224 rookies are about to enter the league. Your team may draft your competition.'),
        h('button.btn.big', { onclick: click(() => { const picks = S.runDraft(lg); C.offseasonWeek(); UI.draftResults(picks); C.save(); }) }, 'RUN THE DRAFT'));
    } else if (ph === 'freeagency') {
      card.append(h('div.kicker', 'OFFSEASON · FREE AGENCY'), h('div.sub', 'Teams fill holes and clear cap space.'),
        h('button.btn.big', { onclick: click(() => { S.runFreeAgency(lg); C.offseasonWeek(); C.save(); UI.hub('home'); UI.toast('Free agency complete'); }) }, 'RUN FREE AGENCY'));
    } else if (ph === 'camp') {
      card.append(UI.campPanel());
    }
    if (ph !== 'awards' && !lg.firstCamp) card.append(h('div.row', h('button.btn.dim.sm', { onclick: click(() => UI.confirm('Retire from football? This ends your career.', () => UI.doRetire())) }, 'RETIRE')));
    return card;
  };
  UI.awardsScreen = () => {
    const { career, lg } = C.cur, p = C.user();
    let aw = lg.awards[0];
    if (!aw || aw.year !== lg.year) aw = S.computeAwards(lg);
    const line = (lab, e) => e ? h('div.award' + (e.pid === p.id ? '.me' : ''), h('span.al', lab), h('b', `${e.name} (${e.pos}, ${e.team})`), h('span.tiny', e.line || '')) : null;
    const mine = aw.allLeague.some((e) => e && e.pid === p.id), star = aw.allStars.some((e) => e && e.pid === p.id);
    const el = h('div.screen.awards', h('div.ctitle.gold', `${lg.year} AWARDS`),
      h('div.card',
        line('MVP', aw.mvp), line('Offensive Player of the Year', aw.opoy), line('Defensive Player of the Year', aw.dpoy),
        line('Offensive Rookie of the Year', aw.oroy), line('Defensive Rookie of the Year', aw.droy), aw.champMvp ? line(D.CHAMP_NAME + ' MVP', aw.champMvp) : null),
      h('div.card', h('div.kicker', 'YOU'), h('div.sub', mine ? '★ Named to the ALL-LEAGUE team!' : star ? '★ Selected to the ALL-STAR game!' : 'No individual honors this season.'), h('div.tiny', Pl.statLine(p.pos, p.s))),
      h('div.card', h('div.kicker', 'ALL-LEAGUE TEAM'), h('div.allleague', aw.allLeague.filter(Boolean).map((e) => h('span' + (e.pid === p.id ? '.me' : ''), `${e.pos} ${e.name} (${e.team})`)))),
      h('div.row', h('button.btn.big', { onclick: click(() => UI.offseasonReport()) }, 'CONTINUE')));
    UI.set(el);
  };
  UI.offseasonReport = () => {
    const { lg, career } = C.cur;
    const before = C.user().ovr;
    const r = C.offseasonUser();
    const retired = S.offseasonProgress(lg);
    const p = C.user();
    const forced = p.age >= 40;
    const el = h('div.screen.awards', h('div.ctitle', 'OFFSEASON REPORT'),
      h('div.card',
        h('div.sub', `You are now ${p.age} years old.` + (r.decline.length ? ' Father Time: ' + r.decline.join(', ') : '')),
        r.awards.length ? h('div.sub.gold', 'Season honors: ' + r.awards.join(', ')) : null,
        h('div.sub', `Overall: ${before} → ${p.ovr}`),
        h('div.tiny', `${retired} players retired around the league.`),
        h('div.sub', p.con && p.con.yrs > 0 ? `Contract: ${p.con.yrs} season(s) left at ${U.money(p.con.sal)}.` : 'Your contract has EXPIRED.')),
      forced ? h('div.warn', 'Your body says it is time. You must retire.') : null,
      h('div.row', forced ? h('button.btn.big', { onclick: click(() => UI.doRetire()) }, 'RETIRE') : h('button.btn.big', { onclick: click(() => { C.offseasonWeek(); C.save(); UI.hub('home'); }) }, 'CONTINUE')));
    UI.set(el);
  };
  UI.draftResults = (picks) => {
    const lg = C.cur.lg, t = C.userTeam();
    const mine = picks.filter((x) => x.tid === t.id);
    UI.modal(h('div',
      h('div.kicker', 'FIRST ROUND'), UI.table(['#', 'Team', 'Player', 'OVR'], picks.slice(0, 32).map((x) => h('tr' + (x.tid === t.id ? '.me' : ''), h('td', String(x.pick)), h('td', x.team), h('td', `${x.pos} ${x.name}`), h('td', String(x.ovr))))),
      h('div.kicker', `${t.abbr} DRAFT CLASS`), UI.table(['Rd', 'Pick', 'Player', 'OVR/POT'], mine.map((x) => h('tr', h('td', String(x.round)), h('td', String(x.pick)), h('td', `${x.pos} ${x.name}`), h('td', `${x.ovr}/${x.pot}`))))),
      { title: `${lg.year + 1} DRAFT`, wide: true, onClose: () => UI.hub('home') });
  };
  UI.campPanel = () => {
    const { lg, career } = C.cur, p = C.user(), t = C.userTeam();
    L.invalidate();
    const d = L.depth(lg, t, true)[p.pos];
    const rank = d.indexOf(p) + 1;
    return h('div',
      h('div.kicker', lg.firstCamp ? 'ROOKIE TRAINING CAMP' : 'TRAINING CAMP'),
      h('div.sub', `You are currently ${p.pos}${rank} on the depth chart.`),
      d.slice(0, 4).map((x, i) => h('div.dline' + (x.isUser ? '.me' : ''), h('span', `${i + 1}.`), h('span', Pl.name(x)), h('span', `${x.age}y`), UI.ovr(x.ovr))),
      h('div.tiny', 'Shine in the camp drill to impress the coaches (boosts your depth chart standing this season).'),
      h('div.row',
        !career.campDone ? h('button.btn.big', { onclick: click(() => UI.runDrill(p.pos === 'QB' ? 'throw' : 'catch', t, (sc) => { p.campBonus = Math.round(sc * 5); career.campDone = true; career.trust = U.clamp(career.trust + Math.round(sc * 6), 0, 100); UI.toast(`Camp grade: ${Math.round(sc * 100)} (+${p.campBonus} depth chart bonus)`); UI.hub('home'); })) }, 'CAMP DRILL') : null,
        h('button.btn' + (career.campDone ? '.big' : ''), { onclick: click(() => {
          career.campDone = false;
          if (lg.firstCamp) { lg.firstCamp = false; S.startSeason(lg); } else S.newSeason(lg);
          C.seasonStart(); C.log(`Season ${lg.year} begins.`); C.save(); UI.hub('home');
          const d = L.depth(lg, C.userTeam())[p.pos]; const rk = d.indexOf(p) + 1;
          UI.toast(rk === 1 ? 'You won the starting job!' : `Depth chart: ${p.pos}${rk}`);
        }) }, 'START SEASON')));
  };
  UI.doRetire = () => {
    const r = C.retire();
    C.save();
    UI.retiredScreen(r);
  };
  UI.retiredScreen = () => {
    const { career, lg } = C.cur, p = C.user();
    const tot = {}; Pl.addStats(tot, p.c); Pl.addStats(tot, p.s);
    const leg = C.legacy();
    const el = h('div.screen.awards', h('div.ctitle.gold', career.hof ? 'HALL OF FAME' : 'CAREER OVER'),
      h('div.card', UI.sprite(C.userTeam() || Sp.generic, p.look, 6, ['cheer', 'stand']), h('div.big', Pl.full(p)),
        h('div.sub', `${career.seasonsPlayed} seasons · Legacy score ${leg}` + (career.hof ? ' · INDUCTED INTO THE HALL OF FAME' : '')),
        h('div.sub', Pl.statLine(p.pos, tot)),
        h('div.tiny', `Career earnings: ${U.money(career.totalEarned)}`),
        h('div.tiny', 'Awards: ' + (Object.entries(p.aw).map(([k, v]) => `${k} x${v}`).join(', ') || 'none'))),
      h('div.row', h('button.btn.big', { onclick: click(() => UI.title()) }, 'MAIN MENU'), h('button.btn', { onclick: click(() => UI.newCareer()) }, 'NEW CAREER')));
    UI.set(el);
  };

  // ---------------- PLAYER
  UI.tPlayer = (sub) => {
    sub = sub || 'attrs';
    const { career } = C.cur, p = C.user(), t = C.userTeam();
    const arch = (D.ARCHETYPES[p.pos] || []).find((a) => a.id === p.arch);
    const head = h('div.card.pcard2',
      UI.sprite(t || Sp.generic, p.look, 6, POSE[p.pos]),
      h('div.pinfo',
        h('div.big', Pl.full(p), career.nickname ? h('span.gold', ` "${career.nickname}"`) : null),
        h('div.sub', `${D.POS[p.pos].name} · ${arch ? arch.name : ''} · #${p.num}`),
        h('div.tiny', `${U.heightStr(p.ht)} ${p.wt} lbs · Age ${p.age} · ${p.college} · ${p.home || ''}`),
        h('div.tiny', `Drafted ${p.draft ? `${p.draft.yr} R${p.draft.rd} #${p.draft.pk} by ${p.draft.team}` : '—'}`),
        h('div.tiny', `Level ${career.level} · XP ${career.xp}/${C.xpNeeded(career.level)} · Skill points: `, h('b.gold', String(career.sp)))),
      h('div.bigovr', UI.ovr(p.ovr), h('div.tiny', 'OVERALL')));
    const tabs = UI.tabs([['attrs', 'ATTRIBUTES'], ['perks', 'PERKS']], sub, (id) => UI.refresh(id));
    const body = sub === 'perks' ? UI.perksPanel() : UI.attrsPanel();
    return h('div', head, tabs, body);
  };
  UI.attrsPanel = () => {
    const { career } = C.cur, p = C.user();
    const def = D.POS[p.pos];
    const keys = def.all.slice().sort((a, b) => (def.w[b] || 0) - (def.w[a] || 0));
    const rows = keys.map((k) => {
      const v = p.r[k], b = (p.bonus && p.bonus[k]) || 0, cost = C.upgradeCost(v);
      const can = career.sp >= cost && v < 99;
      return h('div.attr',
        h('span.an', D.ATTRS[k][0], def.w[k] ? h('i.key', '★') : null),
        UI.bar(v + b, 99, UI.ratingCol(v + b)),
        h('span.av', String(v), b ? h('i.bonus', '+' + b) : null),
        h('button.btn.sm.up' + (can ? '' : '.dim'), { onclick: click(() => { if (C.upgrade(k)) { if (A()) A().blip(990); UI.refresh('attrs'); } else UI.toast('Not enough skill points'); }) }, `+1 (${cost})`));
    });
    return h('div.card', h('div.tiny', '★ = counts toward your overall. Upgrade costs rise as ratings climb. Gear bonuses shown in green.'), h('div.attrs', rows));
  };
  UI.perksPanel = () => {
    const { career } = C.cur, p = C.user();
    const slots = D.PERK_SLOTS(career.level);
    const list = C.perksFor(p.pos);
    return h('div.card', h('div.sub', `Equipped ${career.perks.equipped.length}/${slots} (more slots at levels 3, 8, 15)`),
      h('div.perks', list.map((pk) => {
        const owned = career.perks.owned.includes(pk.id), eq = career.perks.equipped.includes(pk.id);
        const locked = career.level < pk.lvl;
        return h('div.perk' + (eq ? '.eq' : owned ? '.own' : locked ? '.lock' : ''),
          h('div.pn', pk.name), h('div.tiny', pk.desc),
          locked ? h('div.tiny', `Unlocks at level ${pk.lvl}`) :
            owned ? h('button.btn.sm', { onclick: click(() => { if (!C.togglePerk(pk.id)) UI.toast('No free perk slot'); UI.refresh('perks'); }) }, eq ? 'UNEQUIP' : 'EQUIP') :
              h('button.btn.sm' + (career.sp >= pk.cost ? '' : '.dim'), { onclick: click(() => { if (C.buyPerk(pk.id)) { if (A()) A().levelUp(); UI.refresh('perks'); } else UI.toast('Need ' + pk.cost + ' SP'); }) }, `UNLOCK (${pk.cost} SP)`));
      })));
  };

  // ---------------- TRAIN
  UI.tTrain = () => {
    const { career, lg } = C.cur, p = C.user();
    const wrap = h('div');
    if (career.event != null) {
      const ev = D.EVENTS[career.event];
      wrap.appendChild(h('div.card.event', h('div.kicker', '! ' + ev.title.toUpperCase()), h('div.sub', ev.text),
        ev.opts.map((o, i) => h('button.btn.opt', { onclick: click(() => { const r = C.resolveEvent(i); UI.toast(r || 'OK'); UI.refresh(); }) }, o.t))));
    }
    const inSeason = lg.phase === 'regular' || lg.phase === 'playoffs' || lg.phase === 'camp' || true;
    wrap.appendChild(h('div.card', h('div.kicker', 'WEEKLY ACTIONS'),
      h('div.sub', `Actions left: ${career.actions}/${career.maxActions} · Energy ${Math.round(career.energy)}/100`),
      h('div.tiny', 'Actions refresh every week (and each offseason phase). Low energy lowers your speed in games and risks injury.'),
      h('div.trains', C.TRAININGS.map((t) => h('div.train',
        h('div.pn', t.name), h('div.tiny', t.desc), h('div.tiny', t.energy > 0 ? `-${t.energy} energy` : `+${-t.energy} energy`),
        h('div.row',
          h('button.btn.sm' + (career.actions > 0 ? '' : '.dim'), { onclick: click(() => UI.doTrain(t.id)) }, 'DO IT'),
          t.id === 'position' && career.actions > 0 ? h('button.btn.sm.alt', { onclick: click(() => UI.doTrainDrill()) }, 'PLAY DRILL') : null))))));
    if (!inSeason) return wrap;
    return wrap;
  };
  UI.doTrain = (id, score) => {
    const r = C.train(id, score);
    if (!r) { UI.toast('No actions left this week'); return; }
    if (r.err) { UI.toast(r.err, 'bad'); return; }
    if (r.levels && r.levels.length && A()) A().levelUp();
    UI.toast(r.msgs.join(' · ') || 'Done');
    C.save();
    UI.refresh();
  };
  UI.doTrainDrill = () => {
    const { career } = C.cur, p = C.user();
    if (career.energy < 18) { UI.toast('Not enough energy', 'bad'); return; }
    UI.runDrill(p.pos === 'QB' ? 'throw' : 'catch', C.userTeam(), (score) => { UI.root().style.display = 'block'; UI.hub('train'); UI.doTrain('position', score); });
  };

  // ---------------- LOCKER
  UI.tLocker = (sub) => {
    sub = sub || 'look';
    const tabs = UI.tabs([['look', 'LOOK'], ['gear', 'GEAR SHOP'], ['celeb', 'CELEBRATIONS'], ['life', 'LIFESTYLE'], ['staff', 'STAFF']], sub, (id) => UI.refresh(id));
    const { career, lg } = C.cur, p = C.user(), t = C.userTeam();
    let body;
    if (sub === 'look') {
      body = h('div.card', UI.lookEditor(p.look, t || Sp.generic, p.pos, () => { Sp.clear(); UI.refresh('look'); }),
        h('div.frow', h('label', 'Nickname'), h('select.inp', { onchange: (e) => { career.nickname = e.target.value; UI.refresh('look'); } }, D.NICKNAMES.map((n) => h('option', { value: n, selected: n === career.nickname }, n || '(none)')))),
        h('div.frow', h('label', 'Jersey #'), h('input.inp.num', { type: 'number', min: 0, max: 99, value: p.num, onchange: (e) => {
          const n = U.clamp(Math.round(+e.target.value), 0, 99);
          const clash = t && L.roster(lg, t).find((x) => x.id !== p.id && x.num === n);
          if (clash) { UI.toast(`#${n} belongs to ${Pl.name(clash)}`); UI.refresh('look'); return; }
          if (career.money < 25000) { UI.toast('Number change costs $25K'); return; }
          career.money -= 25000; p.num = n; UI.toast('Number changed (-$25K)'); UI.refresh('look');
        } }), h('span.tiny', '$25K to change')));
    } else if (sub === 'gear') {
      const slots = {};
      for (const it of D.SHOP) (slots[it.slot] = slots[it.slot] || []).push(it);
      body = h('div', Object.entries(slots).map(([slot, items]) => h('div.card', h('div.kicker', slot.toUpperCase()), h('div.shop', items.map((it) => {
        const own = career.gear.owned.includes(it.id), eq = career.gear.eq[slot] === it.id;
        return h('div.item' + (eq ? '.eq' : ''), h('div.pn', it.name), h('div.tiny', it.desc), h('div.tiny', U.money(it.price)),
          own ? h('button.btn.sm', { onclick: click(() => { C.equipGear(it.id); UI.refresh('gear'); }) }, eq ? 'UNEQUIP' : 'EQUIP')
            : h('button.btn.sm' + (career.money >= it.price ? '' : '.dim'), { onclick: click(() => { if (C.buyGear(it.id)) { if (A()) A().coin(); UI.refresh('gear'); } else UI.toast('Not enough money'); }) }, 'BUY'));
      })))));
    } else if (sub === 'celeb') {
      body = h('div.card', h('div.tiny', 'Your touchdown celebration plays after you score.'), h('div.shop', D.CELEBRATIONS.map((c) => {
        const own = career.celebs.owned.includes(c.id), eq = career.celebs.eq === c.id;
        const locked = career.level < c.lvl;
        return h('div.item' + (eq ? '.eq' : ''), h('div.pn', c.name), h('div.tiny', c.price ? U.money(c.price) : `Level ${c.lvl}`),
          own ? h('button.btn.sm', { onclick: click(() => { career.celebs.eq = c.id; UI.refresh('celeb'); }) }, eq ? 'EQUIPPED' : 'EQUIP')
            : locked ? h('div.tiny', 'Locked') : h('button.btn.sm' + (career.money >= c.price ? '' : '.dim'), { onclick: click(() => { if (C.buyCeleb(c.id)) UI.refresh('celeb'); else UI.toast('Cannot buy yet'); }) }, 'BUY'));
      })));
    } else if (sub === 'life') {
      body = h('div', D.LIFESTYLE.map((cat) => h('div.card', h('div.kicker', cat.name.toUpperCase()), h('div.shop', cat.tiers.map((tier, i) => {
        const own = career.life[cat.id] >= i;
        return h('div.item' + (career.life[cat.id] === i ? '.eq' : ''), h('div.pn', tier.name), h('div.tiny', tier.price ? U.money(tier.price) : 'Free'), h('div.tiny', `+${U.num(tier.fans)} fans · +${tier.morale} morale`),
          own ? h('div.tiny', career.life[cat.id] === i ? 'CURRENT' : 'Owned') : h('button.btn.sm' + (career.money >= tier.price ? '' : '.dim'), { onclick: click(() => { if (C.buyLife(cat.id, i)) { if (A()) A().coin(); UI.refresh('life'); } else UI.toast('Not enough money'); }) }, 'BUY'));
      })))));
    } else {
      body = h('div.card', h('div.tiny', 'Staff are paid weekly from your bank account.'), h('div.shop', D.STAFF.map((s) => h('div.item' + (career.staff[s.id] ? '.eq' : ''),
        h('div.pn', s.name), h('div.tiny', s.desc), h('div.tiny', U.money(s.weekly) + '/week'),
        h('button.btn.sm', { onclick: click(() => { C.toggleStaff(s.id); UI.refresh('staff'); }) }, career.staff[s.id] ? 'FIRE' : 'HIRE')))));
    }
    return h('div', tabs, body);
  };

  // ---------------- TEAM
  UI.tTeam = (sub) => {
    sub = sub || 'roster';
    const { lg } = C.cur, t = C.userTeam();
    if (!t) return h('div.card', 'You are a free agent.');
    return UI.teamView(t, sub, (id) => UI.refresh(id));
  };
  UI.teamView = (t, sub, onTab) => {
    const lg = C.cur.lg;
    const tabs = UI.tabs([['roster', 'ROSTER'], ['depth', 'DEPTH'], ['sched', 'SCHEDULE'], ['info', 'TEAM INFO']], sub, onTab);
    let body;
    if (sub === 'roster') {
      const ros = L.roster(lg, t).sort((a, b) => D.POS_ORDER.indexOf(a.pos) - D.POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr);
      body = h('div.card', UI.table(['#', 'Pos', 'Name', 'OVR', 'Age', 'Salary', 'Yrs'], ros.map((p) => h('tr' + (p.isUser ? '.me' : ''), { onclick: () => UI.playerModal(p) },
        h('td', String(p.num)), h('td', p.pos), h('td', Pl.name(p) + (p.inj ? ' ✚' : '')), h('td', UI.ovr(p.ovr)), h('td', String(p.age)), h('td', p.con ? U.money(p.con.sal) : '-'), h('td', p.con ? String(p.con.yrs) : '-')))));
    } else if (sub === 'depth') {
      L.invalidate();
      const d = L.depth(lg, t, true);
      body = h('div.card', h('div.depthgrid', D.POS_ORDER.map((pos) => h('div.dpos', h('div.kicker', pos), d[pos].slice(0, 4).map((p, i) => h('div.dline' + (p.isUser ? '.me' : ''), { onclick: () => UI.playerModal(p) }, h('span', `${i + 1}.`), h('span', Pl.name(p) + (p.inj ? ' ✚' : '')), UI.ovr(p.ovr)))))));
    } else if (sub === 'sched') {
      const rows = [];
      lg.schedule.forEach((wk, i) => {
        const g = wk.find((x) => x.h === t.id || x.a === t.id);
        if (!g) return;
        const home = g.h === t.id, opp = lg.teams[home ? g.a : g.h];
        const res = g.played ? `${(home ? g.hs > g.as : g.as > g.hs) ? 'W' : g.hs === g.as ? 'T' : 'L'} ${home ? g.hs : g.as}-${home ? g.as : g.hs}` : '';
        rows.push(h('tr' + (i + 1 === lg.week && lg.phase === 'regular' ? '.me' : ''), h('td', String(i + 1)), h('td', (home ? 'vs ' : '@ ') + opp.abbr), h('td', L.record(opp)), h('td', res)));
      });
      body = h('div.card', UI.table(['Wk', 'Opponent', 'Rec', 'Result'], rows));
    } else {
      const r = L.ratings(lg, t);
      const off = D.OFF_SCHEMES.find((s) => s.id === t.coach.off), def = D.DEF_SCHEMES.find((s) => s.id === t.coach.def);
      const rb = (lab, v) => h('div.attr', h('span.an', lab), UI.bar(v, 99, UI.ratingCol(Math.round(v))), h('span.av', String(Math.round(v))));
      body = h('div.cols', h('div.col', h('div.card', h('div.kicker', L.teamName(t)), h('div.sub', `${t.stadium} · Record ${L.record(t)} · PF ${t.pf} PA ${t.pa}`),
        h('div.sub', `Head Coach ${t.coach.name} (age ${t.coach.age})`), h('div.tiny', `${off.name} offense — ${off.desc}`), h('div.tiny', `${def.name} defense`),
        h('div.sub', `Payroll ${U.money(L.payroll(lg, t))} · Cap space ${U.money(L.capSpace(lg, t))}`),
        h('div.tiny', 'History: ' + (t.history.slice(0, 5).map((x) => `${x.year} ${x.w}-${x.l} ${x.result}`).join(' · ') || 'none')))),
        h('div.col', h('div.card', h('div.kicker', 'RATINGS'), rb('Overall', r.ovr), rb('Offense', r.off), rb('Defense', r.def), rb('QB', r.qb), rb('Receivers', r.wr), rb('Run Game', r.rb), rb('O-Line', r.ol), rb('D-Line', r.dl), rb('Linebackers', r.lb), rb('Secondary', (r.cb + r.s) / 2), rb('Special Teams', r.st))));
    }
    return h('div', tabs, body);
  };
  UI.playerModal = (p) => {
    const lg = C.cur.lg;
    const t = p.team >= 0 ? lg.teams[p.team] : null;
    const def = D.POS[p.pos];
    const keys = def.all.slice().sort((a, b) => (def.w[b] || 0) - (def.w[a] || 0)).slice(0, 10);
    const tot = {}; Pl.addStats(tot, p.c); Pl.addStats(tot, p.s);
    UI.modal(h('div.pm',
      h('div.pmh', UI.sprite(t || Sp.generic, Pl.look(p), 5, POSE[p.pos] || ['idle', 'stand']),
        h('div', h('div.big', Pl.full(p)), h('div.sub', `${p.pos} #${p.num} · ${t ? t.abbr : 'FA'} · Age ${p.age} · ${U.heightStr(p.ht)} ${p.wt}`), h('div.tiny', `${p.college} · ${p.yrs} yrs pro · Dev: ${p.dev}`),
          h('div.tiny', p.con ? `Contract: ${U.money(p.con.sal)}/yr, ${p.con.yrs} yr(s)` : 'No contract'), p.inj ? h('div.warn', `${p.inj.name} (${p.inj.wks} wk)`) : null),
        h('div.bigovr', UI.ovr(p.ovr))),
      h('div.attrs', keys.map((k) => h('div.attr', h('span.an', D.ATTRS[k][0]), UI.bar(Pl.attr(p, k), 99, UI.ratingCol(Pl.attr(p, k))), h('span.av', String(Pl.attr(p, k)))))),
      h('div.sub', 'Season: ' + Pl.statLine(p.pos, p.s)), h('div.sub', 'Career: ' + Pl.statLine(p.pos, tot)),
      Object.keys(p.aw || {}).length ? h('div.tiny', 'Awards: ' + Object.entries(p.aw).map(([k, v]) => `${k} x${v}`).join(', ')) : null), { title: 'PLAYER CARD', wide: true });
  };

  // ---------------- LEAGUE
  UI.tLeague = (sub) => {
    sub = sub || 'stand';
    const lg = C.cur.lg;
    const tabs = UI.tabs([['stand', 'STANDINGS'], ['leaders', 'LEADERS'], ['po', 'PLAYOFFS'], ['news', 'NEWS'], ['teams', 'TEAMS'], ['hist', 'HISTORY'], ['rec', 'RECORDS']], sub, (id) => UI.refresh(id));
    let body;
    const ut = C.userTeamId(lg);
    if (sub === 'stand') {
      body = h('div.cols', D.CONFS.map((cf) => h('div.col', h('div.card', h('div.kicker', cf.name.toUpperCase()), cf.divs.map((dv, di) => h('div',
        h('div.tiny', dv), UI.table(['Team', 'W-L', 'PF', 'PA', 'Strk'], L.division(lg, cf.id, di).map((t) => h('tr' + (t.id === ut ? '.me' : ''), { onclick: () => UI.teamModal(t) },
          h('td', t.abbr + ' ' + t.name), h('td', L.record(t)), h('td', String(t.pf)), h('td', String(t.pa)), h('td', t.streak > 0 ? 'W' + t.streak : t.streak < 0 ? 'L' + -t.streak : '-'))))))))));
    } else if (sub === 'leaders') {
      const cats = [['pYds', 'Passing Yds'], ['pTD', 'Passing TD'], ['rYds', 'Rushing Yds'], ['rTD', 'Rushing TD'], ['recYds', 'Receiving Yds'], ['rec', 'Receptions'], ['recTD', 'Rec TD'], ['tkl', 'Tackles'], ['sck', 'Sacks'], ['dInt', 'Interceptions'], ['fgM', 'FG Made']];
      body = h('div.leaders', cats.map(([k, lab]) => h('div.card.lc', h('div.kicker', lab.toUpperCase()), S.leaders(lg, k, 5).map((p, i) => h('div.dline' + (p.isUser ? '.me' : ''), { onclick: () => UI.playerModal(p) }, h('span', `${i + 1}.`), h('span', `${Pl.name(p)} ${p.team >= 0 ? lg.teams[p.team].abbr : ''}`), h('b', U.num(p.s[k])))))));
    } else if (sub === 'po') {
      body = lg.playoffs ? UI.bracketCard() : h('div.card', h('div.sub', 'Playoff picture (if the season ended today):'),
        h('div.cols', [0, 1].map((c) => h('div.col', h('div.kicker', D.CONFS[c].name), L.seeds(lg, c).map((t, i) => h('div.dline' + (t.id === ut ? '.me' : ''), h('span', `${i + 1}.`), h('span', t.abbr + ' ' + t.name), h('span', L.record(t))))))));
    } else if (sub === 'news') {
      body = UI.newsCard(60);
    } else if (sub === 'teams') {
      body = h('div.teamgrid', lg.teams.map((t) => h('button.tcard', { onclick: () => UI.teamModal(t) }, UI.badge(t), h('div.tiny', L.teamName(t)), h('div.tiny', `${L.record(t)} · OVR ${L.ratings(lg, t).ovr}`))));
    } else if (sub === 'hist') {
      body = h('div.cols',
        h('div.col', h('div.card', h('div.kicker', 'CHAMPIONS'), lg.champions.length ? lg.champions.map((c) => h('div.dline', h('span', String(c.year)), h('span', c.name), h('span', c.score))) : h('div.tiny', 'No champions crowned yet.'))),
        h('div.col', h('div.card', h('div.kicker', 'MVPs'), lg.awards.length ? lg.awards.map((a) => h('div.dline', h('span', String(a.year)), h('span', a.mvp ? `${a.mvp.name} (${a.mvp.pos}, ${a.mvp.team})` : '-'))) : h('div.tiny', 'No awards yet.')),
          h('div.card', h('div.kicker', 'HALL OF FAME'), lg.hof.length ? lg.hof.map((x) => h('div.dline' + (x.user ? '.me' : ''), h('span', String(x.year)), h('span', `${x.name} (${x.pos})`), h('span', String(x.score)))) : h('div.tiny', 'Nobody inducted yet.'))));
    } else {
      const rk = L.REC_KEYS;
      const tbl = (kind) => UI.table(['Record', 'Value', 'Holder'], Object.keys(rk).map((k) => { const r = lg.records[kind][k]; return h('tr' + (r && r.pid === C.userPid() ? '.me' : ''), h('td', rk[k]), h('td', r ? U.num(r.v) : '-'), h('td', r ? `${r.name} (${r.team}, ${r.year})` : '-')); }));
      body = h('div', h('div.card', h('div.kicker', 'SINGLE GAME'), tbl('game')), h('div.card', h('div.kicker', 'SINGLE SEASON'), tbl('season')), h('div.card', h('div.kicker', 'CAREER'), tbl('career')));
    }
    return h('div', tabs, body);
  };
  UI.teamModal = (t) => {
    let sub = 'roster';
    const box = h('div');
    const render = () => { box.innerHTML = ''; box.appendChild(UI.teamView(t, sub, (id) => { sub = id; render(); })); };
    render();
    UI.modal(box, { title: L.teamName(t).toUpperCase(), wide: true });
  };

  // ---------------- CAREER
  UI.tCareer = (sub) => {
    sub = sub || 'over';
    const { career, lg } = C.cur, p = C.user();
    const tabs = UI.tabs([['over', 'OVERVIEW'], ['seasons', 'SEASONS'], ['log', 'GAME LOG'], ['time', 'TIMELINE']], sub, (id) => UI.refresh(id));
    let body;
    if (sub === 'over') {
      const tot = {}; Pl.addStats(tot, p.c); Pl.addStats(tot, p.s);
      const leg = C.legacy();
      body = h('div.cols',
        h('div.col', h('div.card', h('div.kicker', 'LEGACY'), h('div.big', String(leg)), UI.bar(leg, C.HOF_LINE, leg >= C.HOF_LINE ? '#ffd700' : '#7df'), h('div.tiny', `Hall of Fame line: ${C.HOF_LINE}`),
          h('div.sub', 'Career: ' + Pl.statLine(p.pos, tot)),
          p.pc ? h('div.tiny', 'Playoffs: ' + Pl.statLine(p.pos, p.pc)) : null,
          h('div.tiny', `Seasons: ${career.seasonsPlayed} · Career earnings: ${U.money(career.totalEarned)} · Fans: ${U.num(career.fans)}`))),
        h('div.col', h('div.card', h('div.kicker', 'TROPHY CASE'),
          [['mvp', 'MVP'], ['opoy', 'Off. Player of Year'], ['dpoy', 'Def. Player of Year'], ['roy', 'Rookie of Year'], ['allLeague', 'All-League'], ['allStar', 'All-Star'], ['champ', 'Championships'], ['champMvp', D.CHAMP_NAME + ' MVP']].map(([k, lab]) => h('div.dline', h('span', lab), h('b', String(p.aw[k] || 0))))),
          h('div.card', h('div.kicker', 'RELATIONSHIPS'),
            h('div.attr', h('span.an', 'Coach trust'), UI.bar(career.trust, 100, '#7df'), h('span.av', String(Math.round(career.trust)))),
            h('div.attr', h('span.an', 'Team chemistry'), UI.bar(career.chem, 100, '#a6f05a'), h('span.av', String(Math.round(career.chem)))),
            h('div.attr', h('span.an', 'Morale'), UI.bar(career.morale, 100, '#ffe14d'), h('span.av', String(Math.round(career.morale)))))));
    } else if (sub === 'seasons') {
      const rows = career.history.map((s) => h('tr', h('td', String(s.year)), h('td', s.team), h('td', String(s.age)), h('td', String(s.ovr)), h('td', String(s.s.gp || 0)), h('td', Pl.statLine(p.pos, s.s)), h('td', s.awards.join(', '))));
      if (lg.phase === 'regular' || lg.phase === 'playoffs') rows.push(h('tr.me', h('td', String(lg.year)), h('td', C.userTeam() ? C.userTeam().abbr : 'FA'), h('td', String(p.age)), h('td', String(p.ovr)), h('td', String(p.s.gp || 0)), h('td', Pl.statLine(p.pos, p.s)), h('td', 'in progress')));
      body = h('div.card', UI.table(['Year', 'Team', 'Age', 'OVR', 'GP', 'Stats', 'Honors'], rows));
    } else if (sub === 'log') {
      body = h('div.card', UI.table(['Wk', 'Opp', 'Result', 'Line', 'Grd'], career.gameLog.slice().reverse().map((g) => h('tr', h('td', g.playoff != null ? 'PO' : String(g.w)), h('td', (g.home ? 'vs ' : '@ ') + g.opp), h('td', `${g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T'} ${g.us}-${g.them}`), h('td', g.line), h('td', g.grade)))));
    } else body = h('div.card', career.timeline.map((x) => h('div.news', h('span.tiny', `${x.y}${x.w ? ' W' + x.w : ''} `), x.text)));
    return h('div', tabs, body);
  };

  // ---------------- AGENT
  UI.tAgent = () => {
    const { career, lg } = C.cur, p = C.user(), t = C.userTeam();
    const wrap = h('div.cols');
    const left = h('div.col'), right = h('div.col');
    wrap.append(left, right);
    const yrs = p.con ? p.con.yrs : 0;
    const inSeason = lg.phase === 'regular' || lg.phase === 'playoffs';
    left.appendChild(h('div.card', h('div.kicker', 'CONTRACT'),
      p.con ? h('div.sub', `${U.money(p.con.sal)}/yr · ${yrs} season(s) remaining`) : h('div.sub', 'No contract'),
      h('div.tiny', `Market value: ${U.money(C.marketValue())}/yr`),
      inSeason && yrs <= 1 && !career.extTried ? h('button.btn', { onclick: click(() => UI.contractTalks(true)) }, 'NEGOTIATE EXTENSION') : null,
      lg.phase === 'resign' && C.contractNeeded() ? h('button.btn.big', { onclick: click(() => UI.contractTalks(false)) }, 'NEGOTIATE') : null,
      h('div.tiny', 'Your agent takes 3% of income. Hire a Super Agent in the Locker for +10% on deals.')));
    left.appendChild(h('div.card', h('div.kicker', 'FINANCES'),
      h('div.sub', `Bank: ${U.money(career.money)} · Career earnings: ${U.money(career.totalEarned)}`),
      h('div.tiny', `Weekly endorsements: ${U.money(U.sum(career.endorsements, (e) => e.weekly))}`)));
    const canTrade = (lg.phase === 'regular' && lg.week < Math.ceil(lg.settings.seasonLength * 0.6) && !career.tradeReq) || (['resign', 'draft', 'freeagency', 'camp'].includes(lg.phase) && !career.tradeReq);
    left.appendChild(h('div.card', h('div.kicker', 'TRADE REQUEST'),
      h('div.tiny', 'Unhappy? Ask the front office to move you. Costs coach trust whether or not it works.'),
      canTrade ? h('button.btn.sm', { onclick: click(() => UI.confirm('Request a trade?', () => { const nt = C.requestTrade(); UI.toast(nt ? `Traded to the ${L.teamName(nt)}!` : 'Request denied'); C.save(); UI.refresh(); })) }, 'REQUEST TRADE') : h('div.tiny', 'Not available right now.')));
    right.appendChild(h('div.card', h('div.kicker', 'ENDORSEMENTS'),
      career.endorsements.length ? career.endorsements.map((e) => h('div.dline', h('span', e.brand), h('span', U.money(e.weekly) + '/wk'), h('span.tiny', e.weeks + ' wks left'))) : h('div.tiny', 'No active deals. Grow your fan base to attract sponsors.'),
      career.offers.length ? h('div.kicker', 'OFFERS') : null,
      career.offers.map((o, i) => h('div.offer', h('b', o.brand), h('span.tiny', ` ${o.cat} · ${U.money(o.weekly)}/week for ${o.weeks} weeks`),
        h('div.row', h('button.btn.sm', { onclick: click(() => { C.acceptOffer(i); if (A()) A().coin(); UI.refresh(); }) }, 'SIGN'), h('button.btn.sm.dim', { onclick: click(() => { C.declineOffer(i); UI.refresh(); }) }, 'DECLINE')))),
      h('div.tiny', `Fans: ${U.num(career.fans)}`)));
    return wrap;
  };
  UI.contractTalks = (extension) => {
    const { career, lg } = C.cur, p = C.user();
    if (extension) career.extTried = true;
    const ct = career.contractTalk && !career.contractTalk.walked ? career.contractTalk : C.startTalks(extension);
    const render = () => {
      const o = ct.offer;
      return h('div',
        h('div.kicker', ct.walked ? 'TALKS BROKE DOWN' : `${o.teamName.toUpperCase()} OFFER`),
        h('div.big', `${U.money(o.sal)} / yr`),
        h('div.sub', `${o.yrs} years · Total ${U.money(o.sal * o.yrs)} · Signing bonus ${U.money(o.bonus)} · Role: ${o.role}`),
        h('div.tiny', `Market value ${U.money(C.marketValue())} · Coach trust ${Math.round(career.trust)}`),
        ct.walked ? h('div.warn', 'Your team walked away from the table.') : h('div.row.wrap',
          h('button.btn.big', { onclick: click(() => { C.signContract(o); C.save(); UI.closeModal(); UI.toast('Contract signed!'); if (A()) A().coin(); UI.hub(UI.tab); }) }, 'ACCEPT'),
          h('button.btn', { onclick: click(() => { const r = C.counter(1.1); UI.toast(r.ok ? 'They accepted +10%!' : r.walked ? 'They walked away!' : 'Counter rejected'); refresh(); }) }, 'COUNTER +10%'),
          h('button.btn', { onclick: click(() => { const r = C.counter(1.25); UI.toast(r.ok ? 'They accepted +25%!' : r.walked ? 'They walked away!' : 'Counter rejected'); refresh(); }) }, 'COUNTER +25%')),
        !extension ? h('button.btn.alt', { onclick: click(() => { UI.closeModal(); UI.freeAgency(); }) }, 'TEST FREE AGENCY') : null);
    };
    const box = h('div', render());
    const refresh = () => { box.innerHTML = ''; box.appendChild(render()); };
    UI.modal(box, { title: extension ? 'CONTRACT EXTENSION' : 'CONTRACT NEGOTIATION' });
  };
  UI.freeAgency = () => {
    const offers = C.cur.career.faOffers || C.freeAgentOffers();
    UI.modal(h('div', h('div.tiny', 'Teams around the league want you. Pick your next home.'),
      offers.map((o) => {
        const t = C.cur.lg.teams[o.tid];
        return h('div.offer.fa', UI.badge(t), h('div', h('b', o.teamName), h('div.tiny', `Team OVR ${o.ovr} · Prestige ${o.prestige} · Role: ${o.role}`), h('div.sub', `${U.money(o.sal)}/yr × ${o.yrs} yrs · Bonus ${U.money(o.bonus)}`)),
          h('button.btn', { onclick: click(() => { C.signContract(o); C.save(); UI.closeModal(); UI.toast(`Signed with ${o.teamName}!`); UI.hub('home'); }) }, 'SIGN'));
      })), { title: 'FREE AGENCY', wide: true, noClose: true });
  };

  // ---------------- PLAYBOOK & PLAY DESIGNER
  UI.tPlays = (sub) => {
    sub = sub || 'book';
    const { career } = C.cur, p = C.user();
    const tabs = UI.tabs([['book', 'TEAM PLAYBOOK'], ['mine', 'MY PLAYS'], ['def', 'DEFENSE']], sub, (id) => UI.refresh(id));
    let body;
    if (sub === 'book') {
      const forms = Object.keys(Plays.FORMS);
      body = h('div', forms.map((f) => h('div.card', h('div.kicker', Plays.FORMS[f].name.toUpperCase()),
        h('div.plays-grid.static', Plays.PLAYS.filter((pl) => pl.form === f).map((pl) => h('div.pcard', PG.Match.diagram(pl, null), h('div.pn', pl.name),
          h('div.pt', pl.type === 'run' ? 'RUN · ' + pl.run.toUpperCase() : (pl.pa ? 'PLAY ACTION · ' : '') + 'DROP ' + pl.drop + ' · READ 1: ' + pl.prog[0])))))));
    } else if (sub === 'mine') {
      body = h('div.card',
        h('div.sub', p.pos === 'QB' ? 'Design your own plays. They appear under MY PLAYS when you call plays in games.' : 'Design plays and suggest them to your coach in the huddle (needs 60+ trust). The coach may call them too.'),
        h('button.btn.big', { onclick: click(() => UI.playDesigner()) }, 'CREATE PLAY'),
        h('div.plays-grid.static', career.customPlays.map((pl, i) => h('div.pcard', PG.Match.diagram(pl, null), h('div.pn', pl.name), h('div.pt', Plays.FORMS[pl.form].name),
          h('div.row', h('button.btn.sm', { onclick: click(() => UI.playDesigner(pl)) }, 'EDIT'), h('button.btn.sm.dim', { onclick: click(() => { career.customPlays.splice(i, 1); C.save(); UI.refresh('mine'); }) }, 'DELETE'))))),
        !career.customPlays.length ? h('div.tiny', 'No custom plays yet.') : null);
    } else {
      body = h('div.card', h('div.tiny', 'Defensive calls your coordinator (or you, as a defender) can make.'),
        Plays.DEF_PLAYS.map((d) => h('div.dline', h('b', d.name), h('span.tiny', d.desc), d.blitz > 0 ? h('span.gold', 'BLITZ') : null)));
    }
    return h('div', tabs, body);
  };
  UI.playDesigner = (edit) => {
    const { career } = C.cur;
    const st = edit ? JSON.parse(JSON.stringify(edit)) : { id: 'cus_' + Date.now(), form: 'SG_DBL', name: 'My Play ' + (career.customPlays.length + 1), type: 'pass', drop: 5, pa: false, a: {}, prog: [], tags: ['mid'], custom: true };
    const routeIds = Object.keys(Plays.ROUTES);
    const eligible = (form) => Object.keys(Plays.FORMS[form].slots).filter((s) => /^(WR|TE|RB|FB)/.test(s));
    const box = h('div');
    const render = () => {
      const slots = eligible(st.form);
      for (const s of Object.keys(st.a)) if (!slots.includes(s)) delete st.a[s];
      for (const s of slots) if (st.a[s] == null) st.a[s] = /^(RB|FB)/.test(s) ? 'block' : 'go';
      const routed = slots.filter((s) => { const a = st.a[s]; return (Array.isArray(a) ? a[0] : a) !== 'block'; });
      if (!routed.includes(st.prog[0])) st.prog = routed.slice();
      else st.prog = [st.prog[0]].concat(routed.filter((s) => s !== st.prog[0]));
      box.innerHTML = '';
      box.appendChild(h('div.designer',
        h('div.dz-prev', PG.Match.diagram(st, st.prog[0]), h('div.tiny', 'Orange/yellow = primary read')),
        h('div.dz-opts',
          h('div.frow', h('label', 'Name'), h('input.inp', { value: st.name, maxlength: 18, oninput: (e) => { st.name = e.target.value.slice(0, 18); } })),
          h('div.lrow', h('label', 'Formation'), h('div.chips', Object.keys(Plays.FORMS).map((f) => h('button.chip' + (st.form === f ? '.on' : ''), { onclick: click(() => { st.form = f; render(); }) }, Plays.FORMS[f].name)))),
          h('div.lrow', h('label', 'QB drop'), h('div.chips', [1, 3, 5, 7].map((d) => h('button.chip' + (st.drop === d ? '.on' : ''), { onclick: click(() => { st.drop = d; render(); }) }, d === 1 ? 'Quick' : d + '-step'))),
            h('button.chip' + (st.pa ? '.on' : ''), { onclick: click(() => { st.pa = !st.pa; render(); }) }, 'Play action')),
          slots.map((s) => {
            const a = st.a[s];
            const rid = Array.isArray(a) ? a[0] : a;
            const back = /^(RB|FB)/.test(s);
            return h('div.frow', h('label', s + (st.prog[0] === s ? ' ★' : '')),
              h('select.inp', { onchange: (e) => { st.a[s] = back && e.target.value !== 'block' ? [e.target.value, Array.isArray(a) ? a[1] : 1] : e.target.value; render(); } },
                h('option', { value: 'block', selected: rid === 'block' }, 'Block'), routeIds.map((r) => h('option', { value: r, selected: rid === r }, Plays.ROUTES[r].name))),
              back && rid !== 'block' ? h('button.chip', { onclick: click(() => { st.a[s] = [rid, (Array.isArray(a) ? a[1] : 1) * -1]; render(); }) }, (Array.isArray(a) && a[1] < 0) ? 'LEFT' : 'RIGHT') : null,
              rid !== 'block' ? h('button.chip' + (st.prog[0] === s ? '.on' : ''), { onclick: click(() => { st.prog = [s]; render(); }) }, 'PRIMARY') : null);
          }),
          h('div.row',
            h('button.btn.big', { onclick: click(() => {
              if (!st.prog.length) { UI.toast('Give at least one player a route'); return; }
              const deep = Object.values(st.a).some((a) => ['go', 'post', 'corner', 'fade', 'seam', 'wheel'].includes(Array.isArray(a) ? a[0] : a));
              st.tags = [deep ? 'deep' : st.drop <= 3 ? 'short' : 'mid'].concat(st.pa ? ['pa'] : []);
              st.name = (st.name || 'Custom Play').trim() || 'Custom Play';
              const i = career.customPlays.findIndex((x) => x.id === st.id);
              if (i >= 0) career.customPlays[i] = st; else career.customPlays.push(st);
              C.save(); UI.closeModal(); UI.toast('Play saved to your playbook'); UI.hub('plays', 'mine');
            }) }, 'SAVE PLAY')))));
    };
    render();
    UI.modal(box, { title: edit ? 'EDIT PLAY' : 'PLAY DESIGNER', wide: true });
  };

  // ---------------- MENU
  UI.tMenu = () => {
    const st = C.cur.career.settings;
    return h('div.cols', h('div.col', h('div.card', h('div.kicker', 'GAME'),
      h('button.btn', { onclick: click(() => { UI.toast(C.save() ? 'Saved!' : 'Save failed (storage full?)'); }) }, 'SAVE GAME'),
      h('button.btn', { onclick: click(() => UI.globalSettings()) }, 'SETTINGS'),
      h('button.btn', { onclick: click(() => UI.howTo()) }, 'HOW TO PLAY'),
      h('button.btn.dim', { onclick: click(() => { C.save(); UI.title(); }) }, 'SAVE & QUIT TO TITLE'))),
      h('div.col', h('div.card', h('div.kicker', 'LEAGUE SETTINGS'),
        h('div.tiny', `Difficulty: ${(D.DIFFICULTY.find((d) => d.id === C.cur.lg.settings.difficulty) || {}).name} · ${C.cur.lg.settings.seasonLength} games · ${C.cur.lg.settings.quarterLen}-min quarters · Injuries ${C.cur.lg.settings.injuries ? 'on' : 'off'}`),
        h('div.lrow', h('label', 'Difficulty'), h('div.chips', D.DIFFICULTY.map((d) => h('button.chip' + (C.cur.lg.settings.difficulty === d.id ? '.on' : ''), { onclick: click(() => { C.cur.lg.settings.difficulty = d.id; UI.refresh(); }) }, d.name)))),
        h('div.lrow', h('label', 'Quarter length'), h('div.chips', [3, 6, 10, 15].map((q) => h('button.chip' + (C.cur.lg.settings.quarterLen === q ? '.on' : ''), { onclick: click(() => { C.cur.lg.settings.quarterLen = q; UI.refresh(); }) }, q + ' min')))),
        h('div.tiny', 'Season length and playing-time rules are fixed for the career.'))));
  };

  PG.UI = UI;
})();
