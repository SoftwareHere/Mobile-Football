/* Pixel Gridiron - match controller: game flow, play calling, drive sims, kicks, pause menu */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, L = PG.League, S = PG.Season, C = PG.Career, Plays = PG.Plays, h = U.h;
  const W = 53.33;
  const M = {};
  const other = (s) => (s === 'home' ? 'away' : 'home');
  const OFF_POS = { QB: 1, RB: 1, WR: 1, TE: 1 };

  M.start = (game, opts) => {
    opts = opts || {};
    const { lg, career } = C.cur;
    const user = C.user();
    const gs = new PG.GameState(lg, game, { playoff: !!opts.playoff, userPid: user.id });
    M.gs = gs; M.g = game; M.opts = opts;
    M.side = gs.sideOf(user.team);
    gs.opts.userSide = M.side;
    M.unit = OFF_POS[user.pos] ? 'off' : 'def';
    M.userOut = !!(user.inj && user.inj.wks > 0);
    M.extras = { perfects: 0, bigPlays: 0, snaps: 0 };
    M.lastDesc = '';
    M.done = false;
    M.isQB = user.pos === 'QB';
    PG.Game.show();
    M.idleScene();
    M.intro();
  };

  // overlay helpers
  M.ov = () => document.getElementById('ov');
  M.show = (el, cls) => {
    const ov = M.ov();
    ov.innerHTML = '';
    ov.className = 'overlay show ' + (cls || '');
    ov.appendChild(el);
    PG.Input.enabled = false;
  };
  M.hide = () => { const ov = M.ov(); ov.className = 'overlay'; ov.innerHTML = ''; PG.Input.enabled = true; PG.Input.reset(); };

  M.hudInfo = () => {
    const gs = M.gs;
    const qStr = gs.q >= 5 ? 'OT' : 'Q' + gs.q;
    return { home: gs.teams.home.abbr, away: gs.teams.away.abbr, hs: gs.score.home, as: gs.score.away, homeC1: gs.teams.home.c1, awayC1: gs.teams.away.c1,
      clock: Math.max(0, gs.clock - (gs.pendingRunoff || 0)), qStr, possHome: gs.poss === 'home', sit: gs.situationStr(), spot: gs.spotStr() };
  };

  M.idleScene = () => {
    const gs = M.gs;
    const sc = new PG.Engine.KickScene({ kind: 'kickoff', fromX: 45, toX: 45, offTeam: gs.teams.away, defTeam: gs.teams.home, offHome: false, weather: gs.weather, title: '' });
    sc.T = 9999; sc.update = function (dt) { PG.Input.take(); this.t += dt; const vw = this.vw / this.ppy; this.cam.x = 60 - vw / 2 + Math.sin(this.t * 0.2) * 4; this.cam.y = 8; };
    PG.Game.setScene(sc);
  };

  M.weatherStr = (w) => {
    if (w.dome) return 'Indoors · 72°F';
    const t = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow' }[w.type] || 'Clear';
    return `${t} · ${w.temp}°F · Wind ${w.wind} mph${w.night ? ' · Night' : ''}`;
  };

  M.intro = () => {
    const gs = M.gs, lg = C.cur.lg;
    const a = gs.teams.away, hm = gs.teams.home;
    const ra = L.ratings(lg, a), rh = L.ratings(lg, hm);
    const title = M.opts.playoff ? D.ROUND_NAMES[lg.playoffs.round] : `Week ${lg.week}`;
    const el = h('div.panel.intro',
      h('div.kicker', title + (gs.weather.night ? ' · PRIMETIME' : '')),
      h('div.matchup',
        h('div.tm', h('div.badge', { style: { background: a.c1, color: a.c2 } }, a.abbr), h('div.tn', L.teamName(a)), h('div.tr', L.record(a) + ' · OVR ' + ra.ovr)),
        h('div.at', '@'),
        h('div.tm', h('div.badge', { style: { background: hm.c1, color: hm.c2 } }, hm.abbr), h('div.tn', L.teamName(hm)), h('div.tr', L.record(hm) + ' · OVR ' + rh.ovr))),
      h('div.sub', hm.stadium + ' · ' + M.weatherStr(gs.weather)),
      M.userOut ? h('div.warn', `You are injured (${C.user().inj.name}). You'll watch from the sideline.`) : h('div.sub', M.unit === 'off' ? 'You play every offensive snap you are on the field for.' : 'You play every defensive snap you are on the field for.'),
      h('div.row',
        h('button.btn.big', { onclick: () => { M.hide(); M.next(); } }, M.userOut ? 'WATCH' : 'KICKOFF'),
        h('button.btn', { onclick: () => M.simRest() }, 'SIM GAME')));
    M.show(el, 'center');
    if (PG.Audio) PG.Audio.crowd(true);
  };

  M.userInvolved = () => {
    if (M.userOut) return false;
    const onO = M.gs.poss === M.side;
    return (M.unit === 'off' && onO) || (M.unit === 'def' && !onO);
  };

  M.next = () => {
    if (M.done) return;
    const gs = M.gs;
    const a = gs.prepare();
    if (a === 'over') { M.end(); return; }
    if (gs.halftime) { gs.halftime = false; M.halftime(); return; }
    if (a === 'kickoff') { M.kickoff(); return; }
    if (a === 'pat') { M.pat(); return; }
    if (!M.userInvolved()) { M.simDrive(); return; }
    M.userTurn();
  };

  // ------------------------------------------------------------ kicks
  M.kickVisual = (o, then) => {
    const gs = M.gs;
    if (C.settings().fastKicks) { then(); return; }
    const sc = new PG.Engine.KickScene(Object.assign({ weather: gs.weather, onEnd: then }, o));
    PG.Game.setScene(sc);
  };
  M.kickoff = () => {
    const gs = M.gs;
    const kt = gs.kickTeam;
    const offTeam = gs.teams[kt], defTeam = gs.teams[other(kt)], offHome = kt === 'home';
    const free = gs.freeKick;
    const r = gs.doKickoff();
    const tb = r.ballOn === 30 && !free;
    M.lastDesc = r.td ? 'Kickoff returned for a TOUCHDOWN!' : r.text || '';
    M.kickVisual({ kind: 'kickoff', fromX: free ? 30 : 45, toX: tb ? 113 : 104, toY: W / 2 + U.rnd(-6, 6), offTeam, defTeam, offHome, title: free ? 'FREE KICK' : 'KICKOFF',
      text: r.td ? 'RETURN TD!' : tb ? 'TOUCHBACK' : 'RETURNED TO ' + gs.spotStr(r.ballOn, other(kt)), good: r.td ? false : null }, () => M.next());
  };
  M.fieldGoal = (after) => {
    const gs = M.gs, side = gs.poss;
    const offTeam = gs.teams[side], defTeam = gs.teams[other(side)], offHome = side === 'home';
    const fromX = 10 + gs.ballOn - 7, dist = gs.fgDist();
    const r = gs.doFG();
    M.lastDesc = `${dist}-yard field goal ${r.good ? 'is GOOD' : 'is NO GOOD'}.`;
    M.kickVisual({ kind: 'fg', fromX, toX: 122, toY: W / 2 + (r.good ? U.rnd(-1.5, 1.5) : U.pick([-1, 1]) * U.rnd(4, 7)), offTeam, defTeam, offHome, title: dist + ' YARD FIELD GOAL', text: r.good ? "IT'S GOOD!" : 'NO GOOD!', good: r.good }, after || (() => M.next()));
  };
  M.punt = () => {
    const gs = M.gs, side = gs.poss;
    const offTeam = gs.teams[side], defTeam = gs.teams[other(side)], offHome = side === 'home';
    const fromX = 10 + gs.ballOn - 12;
    const r = gs.doPunt();
    M.lastDesc = r.text;
    M.kickVisual({ kind: 'punt', fromX, toX: Math.min(118, fromX + 12 + r.dist), toY: W / 2 + U.rnd(-10, 10), offTeam, defTeam, offHome, title: 'PUNT', text: r.dist + ' YARD PUNT', good: null }, () => M.next());
  };
  M.pat = () => {
    const gs = M.gs, side = gs.patTeam;
    const mine = side === M.side;
    const k = gs.kicker(side);
    const xpP = Math.min(0.99, gs.fgProb(33, side) + 0.06);
    const doXP = () => {
      const good = Math.random() < xpP;
      const offTeam = gs.teams[side], defTeam = gs.teams[other(side)];
      M.kickVisual({ kind: 'xp', fromX: 10 + 98 - 7 - 15, toX: 122, toY: W / 2 + (good ? U.rnd(-1.2, 1.2) : U.pick([-1, 1]) * 5), offTeam, defTeam, offHome: side === 'home', title: 'EXTRA POINT', text: good ? 'GOOD!' : 'NO GOOD!', good }, () => { gs.doPAT('xp', good); M.next(); });
    };
    const do2 = () => {
      const involved = !M.userOut && ((mine && M.unit === 'off') || (!mine && M.unit === 'def'));
      if (involved) { M.twoPoint = true; M.userTurn(true); }
      else { gs.doPAT('2pt'); M.lastDesc = gs.log[gs.log.length - 1].text; M.next(); }
    };
    if (mine && M.isQB && !M.userOut) {
      const el = h('div.panel.decide', h('div.kicker', 'TOUCHDOWN! CONVERSION'),
        h('div.sub', `Score: ${gs.teams.away.abbr} ${gs.score.away} - ${gs.teams.home.abbr} ${gs.score.home}`),
        h('div.row',
          h('button.btn.big', { onclick: () => { M.hide(); doXP(); } }, `KICK XP (${Math.round(xpP * 100)}%)`),
          h('button.btn.big.alt', { onclick: () => { M.hide(); do2(); } }, 'GO FOR 2')));
      M.show(el, 'center');
      return;
    }
    const choice = gs.decidePAT(side);
    if (choice === '2pt') do2(); else doXP();
  };

  // ------------------------------------------------------------ sim'd drives
  M.simDrive = () => {
    const gs = M.gs;
    const team = gs.teams[gs.poss];
    const startScore = { home: gs.score.home, away: gs.score.away };
    const entries = gs.simDrive(40);
    const drive = gs.drives[gs.drives.length - 1];
    const isUsTeam = team.id === gs.teams[M.side].id;
    const scored = gs.score.home !== startScore.home || gs.score.away !== startScore.away;
    const lines = entries.filter((e) => !e.sys || e.score).slice(-9).map((e) => h('div.pl' + (e.score ? '.score' : ''), `${U.clockStr(e.clock)} Q${Math.min(e.q, 4)}  ${e.text}`));
    const title = (isUsTeam ? 'YOUR OFFENSE' : `${team.abbr} OFFENSE`) + (M.userOut ? '' : M.unit === 'off' && !isUsTeam ? ' (you are on the sideline)' : M.unit === 'def' && isUsTeam ? ' (you are on the sideline)' : '');
    const res = drive ? (drive.result || '') : '';
    const el = h('div.panel.drive',
      h('div.kicker', title),
      h('div.scoreline', `${gs.teams.away.abbr} ${gs.score.away}  —  ${gs.teams.home.abbr} ${gs.score.home}` + (scored ? '  ★' : '')),
      h('div.plays', lines.length ? lines : h('div.pl', 'No plays.')),
      h('div.sub', drive ? `Drive: ${drive.plays.length} plays, ${drive.yards} yds, ${U.clockStr(drive.time)} · ${res}` : ''),
      h('div.row',
        h('button.btn.big', { onclick: () => { M.hide(); M.next(); } }, 'CONTINUE'),
        h('button.btn', { onclick: () => M.simRest() }, 'SIM TO END')));
    M.show(el, 'center');
  };

  M.halftime = () => {
    const gs = M.gs;
    const ts = gs.ts;
    const u = C.user();
    const b = gs.box[u.id] || {};
    const row = (k, lab) => h('tr', h('td', String(ts.away[k])), h('th', lab), h('td', String(ts.home[k])));
    const el = h('div.panel.half',
      h('div.kicker', 'HALFTIME'),
      h('div.scoreline', `${gs.teams.away.abbr} ${gs.score.away}  —  ${gs.teams.home.abbr} ${gs.score.home}`),
      h('table.tstats', h('tr', h('td', gs.teams.away.abbr), h('th', ''), h('td', gs.teams.home.abbr)), row('yds', 'Total Yards'), row('pYds', 'Passing'), row('rYds', 'Rushing'), row('fd', 'First Downs'), row('tov', 'Turnovers')),
      h('div.sub', 'You: ' + Pl.statLine(u.pos, b)),
      h('div.row', h('button.btn.big', { onclick: () => { M.hide(); M.next(); } }, 'SECOND HALF')));
    M.show(el, 'center');
  };

  // ------------------------------------------------------------ user turns
  M.userSlot = (pers) => {
    const uid = C.userPid();
    for (const k in pers) {
      const v = pers[k];
      if (Array.isArray(v)) { if (v.some((p) => p && p.id === uid)) return k; }
      else if (v && v.id === uid) return k;
    }
    return null;
  };
  M.depthOf = (side) => { L.invalidate(); return L.depth(C.cur.lg, M.gs.teams[side]); };
  M.sitInfo = () => {
    const gs = M.gs;
    return { down: gs.down, toGo: gs.toGo, ballOn: gs.ballOn, q: gs.q, clock: gs.clock, diff: gs.diff(gs.poss), late: (gs.q >= 4 && gs.clock < 300) || (gs.q === 2 && gs.clock < 120) };
  };

  M.userTurn = (twoPt) => {
    const gs = M.gs;
    M.twoPoint = !!twoPt;
    const onO = gs.poss === M.side;
    if (!twoPt && gs.down === 4) {
      if (onO && M.isQB) { M.fourthDown(); return; }
      const dec = gs.decide4th();
      if (dec === 'punt') { M.punt(); return; }
      if (dec === 'fg') { M.fieldGoal(); return; }
    }
    if (!twoPt) gs.beginPlay(onO ? gs.tempo[M.side] : null);
    if (onO) {
      if (M.isQB) M.playbook(); else M.coachCall();
    } else M.defenseCall();
  };

  M.fourthDown = () => {
    const gs = M.gs;
    const dist = gs.fgDist(), p = gs.fgProb(dist);
    const el = h('div.panel.decide', h('div.kicker', `4TH & ${gs.toGo} · ${gs.spotStr()}`),
      h('div.sub', `${U.clockStr(gs.clock)} left in ${gs.q >= 5 ? 'OT' : 'Q' + gs.q} · ${gs.teams.away.abbr} ${gs.score.away} - ${gs.teams.home.abbr} ${gs.score.home}`),
      h('div.sub', `Coach suggests: ${({ go: 'GO FOR IT', punt: 'PUNT', fg: 'FIELD GOAL' })[gs.decide4th()]}`),
      h('div.row',
        h('button.btn.big', { onclick: () => { M.hide(); gs.beginPlay(gs.tempo[M.side]); M.playbook(); } }, 'GO FOR IT'),
        h('button.btn.big', { onclick: () => { M.hide(); M.punt(); } }, 'PUNT'),
        h('button.btn.big' + (p < 0.3 ? '.dim' : ''), { onclick: () => { M.hide(); M.fieldGoal(); } }, `FG ${dist} YD (${Math.round(p * 100)}%)`)));
    M.show(el, 'center');
  };

  // SVG play diagram
  M.diagram = (play, hiSlot) => {
    const pv = Plays.routePreview(play);
    const X = (x) => ((x + 9) / 36) * 120, Y = (y) => (y / W) * 76;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 76'); svg.setAttribute('class', 'diag');
    const el = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); svg.appendChild(e); return e; };
    el('rect', { x: 0, y: 0, width: 120, height: 76, fill: '#2f7a2f' });
    for (let x = -5; x <= 25; x += 5) el('line', { x1: X(x), y1: 0, x2: X(x), y2: 76, stroke: '#ffffff22', 'stroke-width': 0.5 });
    el('line', { x1: X(0), y1: 0, x2: X(0), y2: 76, stroke: '#4d8dff', 'stroke-width': 0.8 });
    const prim = play.prog ? play.prog[0] : null;
    const drawPath = (pts, col, w) => {
      el('polyline', { points: pts.map(([x, y]) => `${X(Math.min(x, 26))},${Y(y)}`).join(' '), fill: 'none', stroke: col, 'stroke-width': w || 1.1, 'stroke-linejoin': 'round' });
      const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2] || pts[0];
      const a = Math.atan2(Y(y2) - Y(y1), X(Math.min(x2, 26)) - X(Math.min(x1, 26)));
      const tx = X(Math.min(x2, 26)), ty = Y(y2);
      el('polygon', { points: `${tx},${ty} ${tx - 3 * Math.cos(a - 0.5)},${ty - 3 * Math.sin(a - 0.5)} ${tx - 3 * Math.cos(a + 0.5)},${ty - 3 * Math.sin(a + 0.5)}`, fill: col });
    };
    for (const slot in pv.routes) drawPath(pv.routes[slot], slot === hiSlot ? '#ffe14d' : slot === prim ? '#ffb347' : '#ffffff', slot === hiSlot ? 1.6 : 1.1);
    if (pv.run) drawPath(pv.run, pv.carrier === hiSlot ? '#ffe14d' : '#ff8c42', 1.6);
    for (const slot in pv.slots) {
      const s = pv.slots[slot];
      const ol = ['LT', 'LG', 'C', 'RG', 'RT'].includes(slot);
      el('circle', { cx: X(s.x), cy: Y(s.y), r: ol ? 1.6 : 2.1, fill: slot === hiSlot ? '#ffe14d' : ol ? '#c8c8c8' : '#ffffff', stroke: '#000', 'stroke-width': 0.4 });
    }
    return svg;
  };

  M.sitBar = () => {
    const gs = M.gs;
    const hi = M.hudInfo();
    return h('div.sitbar',
      h('span.sc', `${hi.away} ${hi.as} - ${hi.home} ${hi.hs}`),
      h('span', `${hi.qStr} ${U.clockStr(hi.clock)}` + (gs.pendingRunoff > 0 ? ' ⏱' : '')),
      h('span.dd', M.twoPoint ? '2-PT CONVERSION' : `${gs.situationStr()} · ${gs.spotStr()}`),
      h('span', `TO: ${gs.to[M.side]}`));
  };

  M.playbook = (preselect) => {
    const gs = M.gs;
    const all = Plays.allPlays();
    const forms = [];
    for (const p of all) if (!forms.includes(p.form)) forms.push(p.form);
    const sit = M.sitInfo();
    const coachTeam = gs.teams[M.side];
    const scheme = D.OFF_SCHEMES.find((s) => s.id === coachTeam.coach.off);
    const sugg = Plays.aiOffCall(sit, scheme);
    let cur = M.lastForm && forms.includes(M.lastForm) ? M.lastForm : sugg.form;
    if (M.twoPoint || gs.ballOn >= 96) cur = sugg.form;
    const grid = h('div.plays-grid');
    const tabs = h('div.tabs');
    const renderTab = () => {
      tabs.innerHTML = ''; grid.innerHTML = '';
      tabs.appendChild(h('button.tab' + (cur === 'FILTER_RUN' ? '.on' : ''), { onclick: () => { cur = 'FILTER_RUN'; renderTab(); } }, 'RUNS'));
      tabs.appendChild(h('button.tab' + (cur === 'FILTER_PASS' ? '.on' : ''), { onclick: () => { cur = 'FILTER_PASS'; renderTab(); } }, 'PASSES'));
      for (const f of forms) tabs.appendChild(h('button.tab' + (f === cur ? '.on' : ''), { onclick: () => { cur = f; renderTab(); } }, Plays.FORMS[f].name));
      const list = cur === 'FILTER_RUN' ? all.filter((p) => p.type === 'run') : cur === 'FILTER_PASS' ? all.filter((p) => p.type !== 'run') : all.filter((p) => p.form === cur);
      for (const p of list) {
        const card = h('button.pcard' + (p.id === sugg.id ? '.sugg' : ''), { onclick: () => { M.lastForm = p.form; M.hide(); M.runPlay(p); } },
          M.diagram(p, null), h('div.pn', p.name), h('div.pt', (p.type === 'run' ? 'RUN' : p.pa ? 'PLAY ACTION' : p.type === 'screen' ? 'SCREEN' : 'PASS') + ' · ' + Plays.FORMS[p.form].name));
        grid.appendChild(card);
      }
    };
    renderTab();
    const tempo = gs.tempo[M.side];
    const extra = h('div.side',
      h('button.btn.sm' + (tempo === 'hurry' ? '.on' : ''), { onclick: () => { gs.tempo[M.side] = tempo === 'hurry' ? 'normal' : 'hurry'; gs.pendingRunoff = gs.computeRunoff(gs.tempo[M.side]); M.playbook(); } }, tempo === 'hurry' ? 'HURRY-UP: ON' : 'HURRY-UP'),
      h('button.btn.sm' + (tempo === 'milk' ? '.on' : ''), { onclick: () => { gs.tempo[M.side] = tempo === 'milk' ? 'normal' : 'milk'; gs.pendingRunoff = gs.computeRunoff(gs.tempo[M.side]); M.playbook(); } }, tempo === 'milk' ? 'MILK CLOCK: ON' : 'MILK CLOCK'),
      gs.to[M.side] > 0 && gs.pendingRunoff > 0 ? h('button.btn.sm', { onclick: () => { gs.useTO(M.side); M.playbook(); } }, `TIMEOUT (${gs.to[M.side]})`) : null,
      !M.twoPoint ? h('button.btn.sm', { onclick: () => { M.hide(); M.special('kneel'); } }, 'KNEEL') : null,
      !M.twoPoint && gs.pendingRunoff > 0 ? h('button.btn.sm', { onclick: () => { M.hide(); M.special('spike'); } }, 'SPIKE') : null,
      h('button.btn.sm.alt', { onclick: () => { M.lastForm = sugg.form; M.hide(); M.runPlay(sugg); } }, 'COACH: ' + sugg.name.toUpperCase()),
      h('button.btn.sm.dim', { onclick: () => M.pause() }, 'MENU'));
    const el = h('div.panel.playbook', M.sitBar(), M.lastDesc ? h('div.last', M.lastDesc) : null, tabs, h('div.pb-body', grid, extra));
    M.show(el, 'full');
  };

  M.special = (kind) => {
    const gs = M.gs;
    if (!gs.snap()) { M.next(); return; }
    const res = gs.simPlay(kind);
    gs.apply(res);
    M.lastDesc = res.desc;
    M.next();
  };

  M.coachCall = (forced) => {
    const gs = M.gs, career = C.cur.career;
    const sit = M.sitInfo();
    const scheme = D.OFF_SCHEMES.find((s) => s.id === gs.teams[M.side].coach.off);
    const depth = M.depthOf(M.side);
    const trust = career.trust;
    const weight = (pl) => {
      const pers = Plays.offPersonnel(depth, pl.form, {});
      const slot = M.userSlot(pers);
      if (!slot) return 0.12;
      let w = 1;
      if (pl.type === 'run') w += pl.carrier === slot ? 1.6 : 0;
      else if (pl.prog) {
        const i = pl.prog.indexOf(slot);
        if (i === 0) w += trust / 22 + (career.focus || 0) * 0.5;
        else if (i > 0) w += 0.4;
      }
      return w;
    };
    const play = forced || Plays.aiOffCall(sit, scheme, { weight, filter: M.twoPoint ? (p) => p.type !== 'run' || p.form === 'GOALLINE' : null });
    const pers = Plays.offPersonnel(depth, play.form, {});
    const slot = M.userSlot(pers);
    let job = 'Not in this formation';
    if (slot) {
      if (play.type === 'run') job = play.carrier === slot ? 'BALL CARRIER' : 'RUN BLOCK';
      else { const a = play.a[slot]; const rid = Array.isArray(a) ? a[0] : a; job = rid && rid !== 'block' ? Plays.ROUTES[rid].name.toUpperCase() + ' ROUTE' + (play.prog[0] === slot ? ' (PRIMARY)' : '') : 'PASS BLOCK'; }
    }
    const canSuggest = trust >= 60 && !forced;
    const el = h('div.panel.coach', M.sitBar(), M.lastDesc ? h('div.last', M.lastDesc) : null,
      h('div.cc-body',
        h('div.cc-diag', M.diagram(play, slot)),
        h('div.cc-info',
          h('div.kicker', "COACH'S CALL"),
          h('div.big', play.name),
          h('div.sub', Plays.FORMS[play.form].name),
          h('div.job', 'YOUR JOB: ' + job),
          h('div.row',
            h('button.btn.big', { onclick: () => { M.hide(); M.runPlay(play); } }, 'BREAK HUDDLE'),
            canSuggest ? h('button.btn', { onclick: () => M.suggestPlay() }, 'SUGGEST PLAY') : null,
            gs.to[M.side] > 0 && gs.pendingRunoff > 0 && C.user().pos !== 'QB' && trust >= 70 ? h('button.btn.sm', { onclick: () => { gs.useTO(M.side); M.coachCall(play); } }, 'CALL TIMEOUT') : null,
            h('button.btn.sm.dim', { onclick: () => M.pause() }, 'MENU')),
          !canSuggest && !forced ? h('div.tiny', 'Earn 60+ coach trust to suggest plays.') : null)));
    M.show(el, 'full');
  };
  M.suggestPlay = () => {
    // show the playbook; coach accepts based on trust
    const gs = M.gs, trust = C.cur.career.trust;
    const all = Plays.allPlays();
    const grid = h('div.plays-grid');
    for (const p of all) grid.appendChild(h('button.pcard', { onclick: () => {
      const ok = Math.random() < trust / 100 + 0.1;
      if (ok) { M.lastDesc = 'Coach liked your idea: ' + p.name; M.hide(); M.runPlay(p); }
      else { C.cur.career.trust = Math.max(0, trust - 1); M.lastDesc = 'Coach overruled you.'; M.coachCall(); }
    } }, M.diagram(p, null), h('div.pn', p.name), h('div.pt', Plays.FORMS[p.form].name)));
    M.show(h('div.panel.playbook', M.sitBar(), h('div.last', 'Pick a play to suggest to the coach.'), h('div.pb-body', grid, h('div.side', h('button.btn.sm', { onclick: () => M.coachCall() }, 'BACK')))), 'full');
  };

  M.defenseCall = () => {
    const gs = M.gs;
    const sit = M.sitInfo();
    const oppScheme = D.OFF_SCHEMES.find((s) => s.id === gs.teams[gs.poss].coach.off);
    const myScheme = D.DEF_SCHEMES.find((s) => s.id === gs.teams[M.side].coach.def);
    const offPlay = M.twoPoint ? Plays.aiOffCall({ down: 3, toGo: 2, ballOn: 98, late: false, diff: 0 }, oppScheme) : Plays.aiOffCall(sit, oppScheme);
    const coachPick = Plays.defById(Plays.aiDefCall(Object.assign({}, sit, { diff: -sit.diff }), myScheme));
    const grid = h('div.def-grid');
    for (const d of Plays.DEF_PLAYS) grid.appendChild(h('button.dcard' + (d.id === coachPick.id ? '.sugg' : ''), { onclick: () => { M.hide(); M.runPlay(offPlay, d); } },
      h('div.pn', d.name), h('div.pt', d.desc), d.blitz > 0 ? h('div.tag', 'BLITZ') : null));
    const el = h('div.panel.playbook', M.sitBar(), M.lastDesc ? h('div.last', M.lastDesc) : null,
      h('div.kicker', 'DEFENSIVE CALL — pick a coverage or take the coach\'s call'),
      h('div.pb-body', grid, h('div.side',
        h('button.btn.sm.alt', { onclick: () => { M.hide(); M.runPlay(offPlay, coachPick); } }, 'COACH: ' + coachPick.name.toUpperCase()),
        gs.to[M.side] > 0 && gs.pendingRunoff > 0 ? h('button.btn.sm', { onclick: () => { gs.useTO(M.side); M.defenseCall(); } }, `TIMEOUT (${gs.to[M.side]})`) : null,
        h('button.btn.sm.dim', { onclick: () => M.pause() }, 'MENU'))));
    M.show(el, 'full');
  };

  // ------------------------------------------------------------ run a play
  M.runPlay = (play, defCall) => {
    const gs = M.gs, lg = C.cur.lg, career = C.cur.career;
    if (M.twoPoint) {
      M.savedSpot = { ballOn: gs.ballOn, down: gs.down, toGo: gs.toGo };
      gs.ballOn = 98; gs.down = 1; gs.toGo = 2;
    } else if (!gs.snap()) { M.next(); return; }
    const offSide = gs.poss, defSide = other(offSide);
    const offTeam = gs.teams[offSide], defTeam = gs.teams[defSide];
    const od = M.depthOf(offSide), dd = M.depthOf(defSide);
    const uid = C.userPid();
    const userIsRB2 = od.RB[1] && od.RB[1].id === uid;
    const offPers = Plays.offPersonnel(od, play.form, { rb2: Math.random() < (userIsRB2 ? 0.45 : 0.22) });
    const f = Plays.FORMS[play.form];
    let nWR = 0, nTE = 0;
    for (const s in f.slots) { if (s.startsWith('WR')) nWR++; if (s.startsWith('TE')) nTE++; }
    const dform = Plays.defFormFor(nWR, nTE, play.form === 'GOALLINE' || gs.ballOn >= 97);
    const defPers = Plays.defPersonnel(dd, dform);
    if (!defCall) {
      const scheme = D.DEF_SCHEMES.find((s) => s.id === defTeam.coach.def);
      defCall = Plays.defById(Plays.aiDefCall({ down: gs.down, toGo: gs.toGo, ballOn: gs.ballOn, late: gs.q >= 4 && gs.clock < 300, diff: gs.diff(defSide) }, scheme));
    }
    const onField = !!(M.userSlot(offPers) || M.userSlot(defPers));
    if (!onField) {
      // sit this one out — simulate it
      const res = gs.simPlay(play.type === 'run' ? 'run' : 'pass');
      M.afterPlay(res, true);
      return;
    }
    M.extras.snaps++;
    const diff = D.DIFFICULTY.find((d) => d.id === lg.settings.difficulty) || D.DIFFICULTY[1];
    const st = C.settings();
    const hud = M.hudInfo();
    const scene = new PG.Engine.Scene({
      offTeam, defTeam, offHome: offSide === 'home', offPers, defPers, dform, play, defPlay: defCall,
      ballOn: gs.ballOn, toGo: gs.toGo, ballY: M.nextBallY || W / 2, flip: Math.random() < 0.5,
      userPid: uid, userSide: offSide === M.side ? 'off' : 'def', diff, weather: gs.weather, settings: st,
      perks: new Set(career.perks.equipped), chem: career.chem, trust: career.trust, hud, q: gs.q, twoPt: M.twoPoint,
      ctrlRunner: true, injuries: lg.settings.injuries, physio: C.hasStaff('physio'), celebration: career.celebs.eq,
      fatigue: career.energy < 30 ? Math.round((30 - career.energy) / 6) : 0,
      oobMode: offSide === M.side && gs.q >= 4 && gs.clock < 150 && gs.diff(offSide) <= 0,
      onEnd: (res) => M.afterPlay(res, false),
      onPause: () => M.pause(),
    });
    PG.Game.setScene(scene);
    M.scene = scene;
  };

  M.afterPlay = (res, simmed) => {
    const gs = M.gs;
    if (M.twoPoint) {
      M.twoPoint = false;
      const sp = M.savedSpot;
      if (sp) { gs.ballOn = sp.ballOn; gs.down = sp.down; gs.toGo = sp.toGo; }
      const good = !!res.td && !res.turnover;
      // count stats from the attempt but not yards
      gs.events((res.events || []).filter((e) => ['pTD', 'recTD', 'rTD'].indexOf(e[1]) < 0 && ['pYds', 'recYds', 'rYds', 'pLng', 'recLng', 'rLng', 'pAtt', 'pCmp', 'rec', 'rAtt', 'tgt'].indexOf(e[1]) < 0));
      gs.doPAT('2pt', good);
      M.lastDesc = good ? 'Two-point conversion is GOOD!' : 'Two-point attempt fails.';
      M.next();
      return;
    }
    if (res.stats) { M.extras.perfects += res.stats.perfects || 0; M.extras.bigPlays += res.stats.bigPlay || 0; }
    if (res.injured) {
      const u = C.user();
      const mult = (C.hasPerk('ironman') ? 0.5 : 1) * (C.hasStaff('physio') ? 0.8 : 1);
      const inj = S.rollInjury(u, mult);
      M.userOut = true;
      C.log(`Injured: ${inj.name} (${inj.wks} week${inj.wks > 1 ? 's' : ''}).`);
      L.invalidate();
      gs.depth[M.side] = L.depth(C.cur.lg, gs.teams[M.side]);
      res.desc = (res.desc || '') + ` ${Pl.full(u)} is hurt (${inj.name}).`;
    }
    // remember where the ball ended (hash marks)
    if (M.scene && M.scene.carrier && M.scene.carrier()) M.nextBallY = U.clamp(M.scene.carrier().y, 23.6, 29.7);
    else M.nextBallY = W / 2;
    const out = gs.apply(res);
    M.lastDesc = (simmed ? '(Sideline) ' : '') + (res.desc || '');
    if (out.type === 'turnover' || out.type === 'downs' || out.type === 'td' || out.type === 'defTD' || out.type === 'safety') M.nextBallY = W / 2;
    M.next();
  };

  // ------------------------------------------------------------ pause / sim / end
  M.pause = () => {
    const st = C.settings();
    const tog = (k, label) => h('button.btn.sm' + (st[k] ? '.on' : ''), { onclick: () => { st[k] = !st[k]; if (k === 'sfx' && PG.Audio) PG.Audio.setOn(st.sfx); M.pause(); } }, label + (st[k] ? ': ON' : ': OFF'));
    const resume = () => { M.hide(); if (M.resumeTo) { const f = M.resumeTo; M.resumeTo = null; f(); } };
    const ov = M.ov();
    const wasOpen = ov.classList.contains('show') ? ov.firstChild : null;
    if (wasOpen && !wasOpen.classList.contains('pause')) M.resumeTo = ((node) => () => M.show(node, node.classList.contains('playbook') || node.classList.contains('coach') ? 'full' : 'center'))(wasOpen);
    const el = h('div.panel.pause', h('div.kicker', 'PAUSED'),
      h('div.scoreline', `${M.gs.teams.away.abbr} ${M.gs.score.away} — ${M.gs.teams.home.abbr} ${M.gs.score.home}`),
      h('div.row.wrap', tog('sfx', 'SOUND'), tog('autoRoute', 'AUTO ROUTE'), tog('showRoutes', 'SHOW ROUTES'), tog('slowmo', 'SLOW-MO CATCH'), tog('fastKicks', 'SKIP KICKS'),
        h('button.btn.sm', { onclick: () => { st.aimMode = st.aimMode === 'push' ? 'pull' : 'push'; M.pause(); } }, 'AIM: ' + (st.aimMode === 'push' ? 'DRAG TOWARD' : 'PULL BACK'))),
      h('div.row',
        h('button.btn.big', { onclick: resume }, 'RESUME'),
        h('button.btn', { onclick: () => M.simRest() }, 'SIM REST OF GAME')));
    M.show(el, 'center');
  };

  M.simRest = () => {
    M.hide();
    M.userOutSim = true;
    const gs = M.gs;
    if (gs.phase === 'pat' && M.twoPoint) M.twoPoint = false;
    gs.pendingRunoff = gs.pendingRunoff || 0;
    gs.simToEnd();
    M.end();
  };

  M.end = () => {
    if (M.done) return;
    M.done = true;
    const gs = M.gs, lg = C.cur.lg, g = M.g;
    if (!gs.over) gs.finish();
    gs.creditGP();
    if (PG.Audio) PG.Audio.crowd(false);
    if (M.opts.playoff) {
      S.recordPlayoffResult(lg, g, gs);
      if (g.round === 3) g.mvp = S.gameMVP(lg, gs, S.playoffWinner(g));
    } else {
      L.applyResult(lg, g, gs.score.home, gs.score.away);
      S.applyBox(lg, gs);
    }
    const summary = C.postGame(gs, { perfects: M.extras.perfects, bigPlays: M.extras.bigPlays });
    summary.gs = gs;
    PG.Game.hide();
    M.hide();
    if (M.opts.onDone) M.opts.onDone(summary);
  };

  PG.Match = M;
})();
