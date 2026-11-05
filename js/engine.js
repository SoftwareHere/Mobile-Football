/* Pixel Gridiron - on-field play engine: physics, AI, throwing, catching skill check, tackling, rendering */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, Sp = PG.Sprites, F = PG.Font, Plays = PG.Plays, I = PG.Input, Fd = PG.Field;
  const W = 53.33;
  const KEYS = ['spd', 'acc', 'agi', 'str', 'awr', 'thp', 'tas', 'tam', 'tad', 'tor', 'qrl', 'cth', 'cit', 'rte', 'rel', 'jmp', 'car', 'btk', 'elu', 'jkm', 'stf', 'spm', 'pbk', 'rbk', 'prs', 'bsh', 'tak', 'pur', 'hit', 'mcv', 'zcv', 'pre', 'prc', 'sta'];
  const E = { YS: 0.6, ZS: 0.75 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ELIG = { WR: 1, TE: 1, RB: 1 };

  class Scene {
    // o: {offTeam, defTeam, offHome, offPers, defPers, dform, play, defPlay, ballOn, toGo, ballY, flip, userPid, userSide,
    //     diff, weather, settings, perks:Set, chem, hud, onEnd, ctrlRunner, q, twoPt}
    constructor(o) {
      this.o = o;
      this.t = 0; this.state = 'pre'; this.deadT = 0; this.preT = 0; this.phase = 'pre';
      this.los = 10 + o.ballOn; this.ltg = Math.min(110, 10 + o.ballOn + o.toGo); this.ballY = o.ballY || W / 2;
      this.ents = []; this.off = []; this.def = []; this.slotEnt = {};
      this.ev = []; this.msgs = []; this.parts = []; this.pops = [];
      this.play = o.play; this.defPlay = o.defPlay;
      this.diff = o.diff || D.DIFFICULTY[1];
      this.perks = o.perks || new Set();
      this.settings = o.settings || {};
      this.timeScale = 1;
      this.userEnt = null; this.ctrl = null;
      this.sc = null; // skill check
      this.result = null;
      this.stats = { perfects: 0, bigPlay: 0, catches: 0 };
      this.flipS = o.flip ? -1 : 1;
      // light home jerseys: the road team wears its dark colors instead of white
      const homeT = o.offHome ? o.offTeam : o.defTeam, awayT = o.offHome ? o.defTeam : o.offTeam;
      this.awayAlt = U.luma(homeT.c1) > 0.5 && U.luma(awayT.c1) < 0.45;
      this.ball = { state: 'held', holder: null, x: 0, y: 0, z: 1, spin: 0 };
      this.build();
      this.cam = { x: this.los - 18, y: this.ballY - 14 };
      this.snapCam = true;
      this.qbs = { idx: 0, readT: 0, decided: false };
    }

    // ------------------------------------------------------------ setup
    mkEnt(p, side, role, slot, x, y) {
      const o = this.o;
      const isUser = p.id === o.userPid;
      const opp = o.userSide && side !== o.userSide;
      const adj = isUser ? 0 : opp ? this.diff.ai : (o.userSide ? 1 : 0);
      const fat = isUser && o.fatigue ? -o.fatigue : 0;
      const e = { p, id: p.id, side, role, slot, x, y, sx: x, sy: y, vx: 0, vy: 0, face: side === 'off' ? 1 : -1, r: {},
        st: 'pre', anim: Math.random() * 4, hasBall: false, asg: null, eng: null, engT: 0, stunT: 0, tCD: 0, isUser,
        stamina: 1, hist: [], pose: null, lowerPose: null, jukeT: 0, stiffT: 0, spinT: 0, moveCD: 0, diveT: 0, slowT: 0, cutLag: 0, spdMul: 1, chase: null, recogT: 0 };
      for (const k of KEYS) {
        let v = Pl.attr(p, k) + adj;
        if (fat && (k === 'spd' || k === 'acc' || k === 'agi')) v += fat;
        e.r[k] = U.clamp(v, 20, 99);
      }
      e.maxSpd = 5.6 + e.r.spd * 0.038;
      e.accel = 4.5 + e.r.acc * 0.085;
      if (role === 'OL' || role === 'DL') e.maxSpd *= 0.96;
      const team = side === 'off' ? o.offTeam : o.defTeam;
      const home = side === 'off' ? o.offHome : !o.offHome;
      e.pal = Sp.palette(team, home, Pl.look(p), !home && this.awayAlt);
      e.num = p.num;
      e.lefty = !!Pl.look(p).lefty;
      this.ents.push(e);
      (side === 'off' ? this.off : this.def).push(e);
      if (isUser) { this.userEnt = e; this.ctrl = e; }
      return e;
    }

    build() {
      const o = this.o, pl = this.play, f = Plays.FORMS[pl.form], by = this.ballY, fs = this.flipS;
      for (const slot in f.slots) {
        const p = o.offPers[slot];
        if (!p) continue;
        const s = f.slots[slot];
        let y;
        if (s.ya != null) { y = s.ya >= 0 ? s.ya : W + s.ya; if (fs < 0) y = W - y; }
        else y = by + s.y * fs;
        y = U.clamp(y, 1, W - 1);
        const role = slot === 'QB' ? 'QB' : slot === 'RB' || slot === 'FB' ? 'RB' : slot.startsWith('WR') ? 'WR' : slot.startsWith('TE') ? 'TE' : 'OL';
        const e = this.mkEnt(p, 'off', role, slot, this.los + s.x, y);
        this.slotEnt[slot] = e;
        if (role === 'OL') e.stance = true;
      }
      this.qb = this.slotEnt.QB;
      // offensive assignments
      const isRun = pl.type === 'run';
      this.runDef = isRun ? Plays.RUNS[pl.run] : null;
      for (const e of this.off) {
        if (e.role === 'OL') { e.asg = { type: isRun ? 'runblock' : 'passpro' }; continue; }
        if (e.role === 'QB') { e.asg = { type: 'qb' }; continue; }
        if (isRun) {
          if (e.slot === pl.carrier) e.asg = { type: 'carry', path: this.runPath(e), idx: 0 };
          else if (e.slot === 'FB') e.asg = { type: 'lead' };
          else e.asg = { type: 'runblock' };
          continue;
        }
        const a = pl.a ? pl.a[e.slot] : null;
        const rid = Array.isArray(a) ? a[0] : a;
        if (!rid || rid === 'block' || !Plays.ROUTES[rid]) { e.asg = { type: 'passpro' }; continue; }
        const side = Array.isArray(a) ? a[1] * fs : (e.y < by - 0.5 ? -1 : e.y > by + 0.5 ? 1 : fs);
        const R = Plays.ROUTES[rid];
        const pts = R.pts.map(([d, w]) => ({ x: e.x + d, y: U.clamp(e.y + w * side, 0.8, W - 0.8) }));
        e.asg = { type: 'route', id: rid, name: R.name, pts, idx: 0, sit: !!R.sit, done: false };
      }
      if (isRun && this.runDef.qb) this.qb.asg = { type: 'carry', path: this.runPath(this.qb), idx: 0 };
      this.buildDefense();
      // initial ball
      const c = this.slotEnt.C;
      this.ball.x = this.los; this.ball.y = by; this.ball.z = 0.3;
      this.ball.holder = null;
      this.center = c;
      // snap timing values
      const qbr = this.qb ? this.qb.r : { qrl: 70, awr: 70 };
      this.relTime = (0.24 - qbr.qrl * 0.0012) * (this.hasPerkFor(this.qb, 'quickdraw') ? 0.6 : 1);
    }

    runPath(e) {
      const r = this.runDef, dir = this.play.dir * this.flipS;
      return r.path.map(([x, y]) => ({ x: this.los + x, y: U.clamp(this.ballY + y * dir, 1, W - 1) }));
    }

    hasPerkFor(e, id) { return !!(e && e.isUser && this.perks.has(id)); }

    buildDefense() {
      const o = this.o, dp = this.defPlay, by = this.ballY, los = this.los;
      const pers = o.defPers;
      const mk = (p, role) => this.mkEnt(p, 'def', role, role, los + 3, by);
      const DL = pers.DL.map((p) => mk(p, 'DL'));
      const LB = pers.LB.map((p) => mk(p, 'LB'));
      const CB = pers.CB.map((p) => mk(p, 'CB'));
      const S = pers.S.map((p) => mk(p, 'S'));
      // DL alignment
      const dly = { 3: [-2.8, 0, 2.8], 4: [-3.8, -1.3, 1.3, 3.8], 5: [-4.6, -2.3, 0, 2.3, 4.6], 6: [-5, -3, -1, 1, 3, 5] }[DL.length] || [-3.8, -1.3, 1.3, 3.8];
      DL.forEach((e, i) => { e.x = los + 1.0; e.y = by + dly[i]; e.asg = { type: 'rush' }; e.stance = true; });
      const lby = { 1: [0], 2: [-2.2, 2.2], 3: [-3.6, 0, 3.6], 4: [-5.5, -1.8, 1.8, 5.5] }[LB.length] || [0];
      LB.forEach((e, i) => { e.x = los + 4.5; e.y = by + lby[i]; });
      const rcv = this.off.filter((e) => ELIG[e.role]);
      const wide = rcv.filter((e) => e.role === 'WR' || Math.abs(e.y - by) > 4.5).sort((a, b) => a.y - b.y);
      const cov = dp.cov;
      const man = cov === 'c0' || cov === 'c1' || cov === 'c2m';
      const assigned = new Map();
      // corners on the outside receivers
      const outL = wide[0], outR = wide.length > 1 ? wide[wide.length - 1] : null;
      const cbSorted = CB.slice();
      const cbTargets = [];
      if (outL) cbTargets.push(outL);
      if (outR) cbTargets.push(outR);
      const inner = wide.filter((w) => w !== outL && w !== outR).sort((a, b) => Math.abs(b.y - by) - Math.abs(a.y - by));
      cbTargets.push(...inner);
      cbSorted.forEach((cb, i) => {
        const tgt = cbTargets[i];
        if (tgt) {
          const out = tgt.y < by ? -1 : 1;
          const press = man && cb.r.pre > 60 && Math.random() < 0.45;
          cb.x = los + (press ? 1.3 : i < 2 ? 6 : 5); cb.y = tgt.y + out * 0.8;
          cb.press = press;
          cb.cover = tgt;
        } else { cb.x = los + 7; cb.y = i % 2 ? W - 10 : 10; }
      });
      // safeties
      const twoHigh = cov === 'c2' || cov === 'c2m' || cov === 't2' || cov === 'c4' || cov === 'prev';
      S.forEach((s, i) => {
        if (twoHigh || i > 0) { s.x = los + (cov === 'prev' ? 18 : 13); s.y = U.clamp(by + (i === 0 ? -9 : 9), 6, W - 6); }
        else { s.x = los + 15; s.y = by; }
        if (!twoHigh && i === 1) { s.x = los + 8; s.y = by + 5; }
      });
      const rushers = new Set(DL);
      const blitzN = Math.max(0, dp.blitz);
      if (man) {
        const deep = [];
        if (cov === 'c1' && S[0]) { S[0].asg = { type: 'zone', zone: 'mid' }; deep.push(S[0]); }
        if (cov === 'c2m') { if (S[0]) { S[0].asg = { type: 'zone', zone: 'halfL' }; deep.push(S[0]); } if (S[1]) { S[1].asg = { type: 'zone', zone: 'halfR' }; deep.push(S[1]); } }
        const blitzers = LB.slice().reverse().slice(0, Math.min(blitzN, LB.length));
        if (cov === 'c0' && blitzN >= 3 && S.length > 1) blitzers.push(S[S.length - 1]);
        blitzers.forEach((b) => { b.asg = { type: 'rush', blitz: true }; rushers.add(b); });
        const pool = [...CB, ...S, ...LB].filter((d) => !deep.includes(d) && !rushers.has(d));
        const left = rcv.slice();
        // CBs first
        for (const cb of CB) {
          if (rushers.has(cb)) continue;
          if (cb.cover && left.includes(cb.cover)) { cb.asg = { type: 'man', target: cb.cover }; left.splice(left.indexOf(cb.cover), 1); assigned.set(cb, cb.cover); }
        }
        const rest = pool.filter((d) => !assigned.has(d));
        for (const r of left.sort((a, b) => (a.role === 'RB') - (b.role === 'RB'))) {
          let best = null, bd = 1e9;
          for (const d of rest) { if (assigned.has(d)) continue; const dd = Math.abs(d.y - r.y) + Math.abs(d.x - r.x) * 0.3; if (dd < bd) { bd = dd; best = d; } }
          if (best) { best.asg = { type: 'man', target: r }; assigned.set(best, r); if (best.role === 'S') { best.x = this.los + 6; best.y = r.y + 1; } }
        }
        for (const d of rest) if (!assigned.has(d)) d.asg = cov === 'c0' ? { type: 'rush', blitz: true } : { type: 'zone', zone: 'hookM' };
      } else {
        let deepZ, under;
        if (cov === 'c2') { deepZ = [[S[0], 'halfL'], [S[1], 'halfR']]; under = ['flatL', 'hookL', 'hookM', 'hookR', 'flatR']; }
        else if (cov === 't2') { deepZ = [[S[0], 'halfL'], [S[1], 'halfR'], [LB[Math.floor(LB.length / 2)], 'deepMidLB']]; under = ['flatL', 'hookL', 'hookR', 'flatR']; }
        else if (cov === 'c3') {
          const cbs = CB.slice().sort((a, b) => a.y - b.y);
          deepZ = [[cbs[0], 'thirdL'], [cbs[cbs.length - 1], 'thirdR'], [S[0], 'mid']];
          under = ['flatL', 'hookL', 'hookM', 'hookR', 'flatR'];
        } else if (cov === 'prev') {
          const cbs = CB.slice().sort((a, b) => a.y - b.y);
          deepZ = [[cbs[0], 'prevL'], [cbs[cbs.length - 1], 'prevR'], [S[0], 'prevM'], [S[1], 'q2']];
          under = ['curlL', 'hookM', 'curlR'];
          const dropDL = DL[DL.length - 1];
          if (dropDL) { rushers.delete(dropDL); dropDL.asg = { type: 'zone', zone: 'hookM' }; }
        } else { // c4
          const cbs = CB.slice().sort((a, b) => a.y - b.y);
          deepZ = [[cbs[0], 'q1'], [S[0], 'q2'], [S[1], 'q3'], [cbs[cbs.length - 1], 'q4']];
          under = ['flatL', 'hookM', 'flatR'];
        }
        const deepSet = new Set();
        for (const [d, z] of deepZ) if (d && !deepSet.has(d)) { d.asg = { type: 'zone', zone: z }; deepSet.add(d); }
        let others = [...CB, ...S, ...LB].filter((d) => !deepSet.has(d) && !rushers.has(d));
        // blitzers come from linebackers
        const bl = others.filter((d) => d.role === 'LB').slice(0, blitzN);
        bl.forEach((b) => { b.asg = { type: 'rush', blitz: true }; rushers.add(b); });
        others = others.filter((d) => !rushers.has(d)).sort((a, b) => a.y - b.y);
        let zones = under.slice();
        while (zones.length > others.length) zones.splice(Math.floor(zones.length / 2), 1);
        others.forEach((d, i) => {
          const z = zones[Math.min(zones.length - 1, Math.round(i * (zones.length - 1) / Math.max(1, others.length - 1)))] || 'hookM';
          d.asg = { type: 'zone', zone: z };
        });
      }
      for (const d of this.def) {
        if (!d.asg) d.asg = { type: 'zone', zone: 'hookM' };
        if (d.asg.type === 'zone') {
          const Z = Plays.ZONES[d.asg.zone];
          d.asg.lx = this.los + Z[0];
          d.asg.ly = U.clamp(Z[1] + (by - W / 2) * 0.4, 3, W - 3);
          d.asg.deep = Plays.isDeep(d.asg.zone);
          d.asg.rad = d.asg.deep ? 9 : 6;
        }
        d.recogT = 0.22 + (100 - d.r.prc) * 0.006 + (this.play.pa ? 0.35 : 0);
        d.sx = d.x; d.sy = d.y;
      }
      this.coverName = (Plays.defById(dp.id) || dp).name;
      // pass-pro assignments: each rusher gets the nearest blocker by y
      const blockers = this.off.filter((e) => e.asg.type === 'passpro');
      const rs = this.def.filter((d) => d.asg.type === 'rush').sort((a, b) => a.y - b.y);
      const free = blockers.slice().sort((a, b) => a.y - b.y);
      for (const r of rs) {
        let best = null, bd = 1e9;
        for (const b of free) { const d = Math.abs(b.y - r.y) + (b.role === 'OL' ? 0 : 1.5); if (d < bd) { bd = d; best = b; } }
        if (best) { best.asg.target = r; free.splice(free.indexOf(best), 1); }
      }
    }

    // ------------------------------------------------------------ helpers
    posAt(e, lag) {
      const h = e.hist;
      if (!h.length || lag <= 0) return { x: e.x, y: e.y };
      const i = Math.min(h.length - 1, Math.round(lag / 0.05));
      return h[h.length - 1 - i];
    }
    steer(e, tx, ty, frac, dt, noArrive) {
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      let sp = e.maxSpd * (frac == null ? 1 : frac) * e.spdMul;
      if (!noArrive && d < 1.0) sp *= d;
      if (d < 0.02) { this.accelTo(e, 0, 0, dt); return; }
      this.accelTo(e, dx / d * sp, dy / d * sp, dt);
    }
    accelTo(e, dvx, dvy, dt) {
      let ax = dvx - e.vx, ay = dvy - e.vy;
      const m = Math.hypot(ax, ay);
      // agility helps change of direction
      const turnBoost = 1 + (e.r.agi - 60) * 0.006;
      const lim = e.accel * dt * (e === this.ctrl ? 1.45 : 1) * turnBoost;
      if (m > lim) { ax = ax / m * lim; ay = ay / m * lim; }
      e.vx += ax; e.vy += ay;
    }
    speed(e) { return Math.hypot(e.vx, e.vy); }
    carrier() { return this.ball.state === 'held' ? this.ball.holder : null; }
    defendersOf(side) { return side === 'off' ? this.def : this.off; }
    pop(text, x, y, color) { this.pops.push({ text, x, y, t: 0, color: color || '#fff' }); }
    msg(text, color, dur) { this.msgs.push({ text, color: color || '#fff', t: 0, dur: dur || 1.4 }); }
    ballSpeed(passer) { return (15 + passer.r.thp * 0.12) * (this.hasPerkFor(passer, 'gunslinger') ? 1.15 : 1); }
    maxThrow(passer) { return 32 + passer.r.thp * 0.33; }
    pressure(qb) {
      let m = 99;
      for (const d of this.def) {
        if (d.st === 'engaged' || d.st === 'down' || d.stunT > 0) continue;
        const dd = dist(d, qb);
        if (dd < m && d.x < qb.x + 6) m = dd;
      }
      return m;
    }
    openness(r, from) {
      from = from || this.qb;
      const T = dist(from, r) / this.ballSpeed(from) + this.relTime;
      const px = r.x + r.vx * T * 0.85, py = r.y + r.vy * T * 0.85;
      if (py < 0.5 || py > W - 0.5 || px > 119) return 0;
      if (Math.hypot(px - from.x, py - from.y) > this.maxThrow(from)) return 0;
      let m = 99;
      for (const d of this.def) {
        if (d.st === 'down') continue;
        const dd = Math.hypot(d.x + d.vx * T * 0.6 - px, d.y + d.vy * T * 0.6 - py);
        if (dd < m) m = dd;
      }
      return m;
    }
    stat(e, k, v) { if (e) this.ev.push([e.id, k, v]); }

    // ------------------------------------------------------------ main update
    update(dt) {
      dt = Math.min(dt, 1 / 30);
      const sdt = dt * this.timeScale;
      const evs = I.take();
      for (const ev of evs) if (ev.type === 'pause' && this.o.onPause) this.o.onPause();
      this.updateFx(dt);
      if (this.state === 'pre') { this.updatePre(dt, evs); this.updateCam(dt); return; }
      if (this.state === 'dead') { this.updateDead(dt, evs); this.updateCam(dt); return; }
      this.t += sdt;
      this.handleInput(sdt, evs);
      this.updateSkillCheck(sdt);
      this.updatePendingThrow();
      for (const e of this.ents) this.think(e, sdt);
      this.integrate(sdt);
      this.updateBall(sdt);
      if (this.state === 'live') this.checkTackles(sdt);
      if (this.state === 'live') this.checkBounds();
      if (this.state === 'live' && this.t > 16) this.endCarrierPlay('stall');
      this.updateCam(dt);
    }

    updatePre(dt, evs) {
      this.preT += dt;
      for (const e of this.ents) { e.st = 'pre'; e.anim += dt * 0.5; }
      for (const ev of evs) {
        if ((ev.type === 'tap' || ev.type === 'release') && this.preT > 0.35) { this.snap(); return; }
      }
      if (this.o.autoSnap && this.preT > this.o.autoSnap) this.snap();
    }

    snap() {
      if (this.state !== 'pre') return;
      this.state = 'live'; this.phase = 'dev'; this.t = 0;
      for (const e of this.ents) { e.st = 'ok'; e.stance = false; }
      const qb = this.qb;
      if (PG.Audio) PG.Audio.hike();
      const sg = Plays.FORMS[this.play.form].sg;
      if (sg && qb && qb.x < this.los - 2) {
        this.ball.state = 'snap'; this.ball.sx = this.los; this.ball.sy = this.ballY; this.ball.t = 0; this.ball.T = 0.22;
      } else this.give(qb);
      // press at the line
      for (const d of this.def) {
        if (d.asg.type === 'man' && d.press) {
          const r = d.asg.target;
          const win = 0.5 + (d.r.pre - r.r.rel) * 0.015;
          if (Math.random() < win) { r.slowT = U.rnd(0.35, 0.7); r.slowMul = 0.35; this.pop('JAM', r.x, r.y, '#f88'); }
          else { d.slowT = U.rnd(0.25, 0.45); d.slowMul = 0.3; }
        }
      }
      // drops for qb
      const pl = this.play;
      if (pl.type !== 'run' && qb) {
        const back = { 1: 1, 3: sg ? 1.5 : 3.5, 5: sg ? 2.5 : 6, 7: sg ? 3.5 : 7.5 }[pl.drop || 5] || 3;
        const startX = qb.x;
        this.dropPt = { x: (sg ? startX : this.los) - back, y: this.ballY };
        if (pl.boot) this.dropPt = { x: this.los - 6, y: U.clamp(this.ballY + 8 * pl.boot * this.flipS, 3, W - 3) };
        this.dropT = (pl.drop === 1 ? 0.3 : pl.drop === 3 ? 0.65 : pl.drop === 7 ? 1.25 : 0.95) + (pl.pa ? 0.45 : 0) + (pl.boot ? 0.5 : 0);
        if (pl.type === 'screen') this.dropT += 0.35;
      } else if (pl.type === 'run') {
        const r = this.runDef;
        const car = this.slotEnt[pl.carrier];
        if (!r.qb && car) {
          const p0 = car.asg.path[0];
          this.meshPt = { x: U.lerp(qb.x, p0.x, 0.5), y: U.lerp(qb.y, p0.y, 0.6) };
          if (Plays.FORMS[pl.form].sg) this.meshPt = { x: qb.x - 0.3, y: U.lerp(qb.y, car.y, 0.6) };
          this.meshT = r.mesh + (r.delay || 0);
        } else if (r.qb) this.phase = 'run';
      }
      this.snapClock = this.o.hud ? this.o.hud.clock : 0;
    }

    give(e) {
      for (const x of this.ents) x.hasBall = false;
      this.ball.state = 'held'; this.ball.holder = e;
      if (e) { e.hasBall = true; this.ball.x = e.x; this.ball.y = e.y; this.ball.z = 1.2; }
    }

    // ------------------------------------------------------------ input
    controlMode() {
      const c = this.ctrl;
      if (!c) return 'none';
      if (c.st === 'down') return 'none';
      if (this.carrier() === c) {
        if (c.role === 'QB' && this.phase === 'dev' && c.x <= this.los + 0.2 && this.play.type !== 'run') return 'qb';
        if (c.role === 'QB' && this.phase === 'dev' && this.play.type === 'run' && !this.runDef.qb && !this.handed) return 'qbrun';
        return 'carrier';
      }
      if (c.side === 'off') {
        if (c.role === 'QB' && c === this.qb && this.ball.holder !== c) return 'spectate';
        if (this.ball.state === 'air' && this.sc && this.sc.type === 'catch') return 'catch';
        if (this.phase === 'dev' && c.asg && c.asg.type === 'route') return 'route';
        return 'block';
      }
      return 'defend';
    }

    handleInput(dt, evs) {
      const c = this.ctrl;
      if (!c || c.st === 'down') return;
      const mode = this.controlMode();
      this.mode = mode;
      const st = I.stick();
      c.userMoved = c.userMoved || st.m > 0.2;
      c.manual = c.userMoved;
      // taps for skill check first
      for (const ev of evs) {
        if (this.sc && !this.sc.tapped && (ev.type === 'press' || (ev.type === 'tap' && ev.key))) { this.tapSkill(); this.ignoreTapT = this.t + 0.5; continue; }
        if ((ev.type === 'tap' || ev.type === 'dtap') && this.ignoreTapT && this.t < this.ignoreTapT) continue;
        if (mode === 'carrier') this.carrierMove(c, ev);
        else if (mode === 'route' && ev.type === 'tap') { this.userCall = this.t; c.pose = 'catch'; c.poseT = 0.5; this.pop('OPEN!', c.x, c.y, '#ff0'); }
        else if (mode === 'defend' && ev.type === 'tap') this.defBurst(c);
        else if (mode === 'qb' && ev.type === 'dtap') this.throwAway(c);
        else if (mode === 'qb' && ev.type === 'release') this.userThrow(c, ev);
        if (c.st === 'engaged' && c.side === 'def' && ev.type === 'tap') { c.engT -= 0.22; }
      }
    }

    aimTarget(c) {
      const d = I.drag;
      if (!d.active) return null;
      let dx = d.x - d.ox, dy = d.y - d.oy;
      if (Math.hypot(dx, dy) < 8) return null;
      if (this.settings.aimMode !== 'push') { dx = -dx; dy = -dy; }
      const K = 2.5;
      let tx = c.x + dx / this.ppy * K, ty = c.y + dy / (this.ppy * E.YS) * K;
      const m = this.maxThrow(c), dd = Math.hypot(tx - c.x, ty - c.y);
      if (dd > m) { tx = c.x + (tx - c.x) / dd * m; ty = c.y + (ty - c.y) / dd * m; }
      return { x: tx, y: U.clamp(ty, -2, W + 2) };
    }
    userThrow(c, ev) {
      let dx = ev.dx, dy = ev.dy;
      if (Math.hypot(dx, dy) < 8) return;
      if (this.settings.aimMode !== 'push') { dx = -dx; dy = -dy; }
      const K = 2.5;
      let tx = c.x + dx / this.ppy * K, ty = c.y + dy / (this.ppy * E.YS) * K;
      const m = this.maxThrow(c), dd = Math.hypot(tx - c.x, ty - c.y);
      if (dd > m) { tx = c.x + (tx - c.x) / dd * m; ty = c.y + (ty - c.y) / dd * m; }
      // aim assist toward a receiver's projected position
      const assist = { rookie: 0.8, pro: 0.55, allpro: 0.3, legend: 0.1 }[this.diff.id] || 0.5;
      let best = null, bd = 3.2;
      for (const r of this.off) {
        if (!ELIG[r.role] || r === c) continue;
        const T = Math.hypot(tx - c.x, ty - c.y) / this.ballSpeed(c);
        const px = r.x + r.vx * T, py = r.y + r.vy * T;
        const d = Math.hypot(px - tx, py - ty);
        if (d < bd) { bd = d; best = { x: px, y: py, r }; }
      }
      if (best) { tx = U.lerp(tx, best.x, assist); ty = U.lerp(ty, best.y, assist); }
      this.queueThrow(c, tx, ty, best ? best.r : null);
    }
    throwAway(c) {
      const ty = c.y < W / 2 ? -4 : W + 4;
      this.queueThrow(c, c.x + 6, ty, null, true);
    }
    carrierMove(c, ev) {
      const dirX = c.side === 'off' ? 1 : -1;
      if (ev.type === 'dtap') { this.dive(c); return; }
      if (ev.type === 'tap') { this.juke(c, null); return; }
      if (ev.type === 'swipe') {
        const ax = Math.abs(ev.dx), ay = Math.abs(ev.dy);
        if (ax > ay && Math.sign(ev.dx) === dirX) this.stiff(c);
        else if (ax > ay) this.spin(c);
        else this.juke(c, Math.sign(ev.dy));
      }
    }
    juke(c, dirY) {
      if (c.moveCD > 0) return;
      if (dirY == null) {
        const st = I.stick();
        if (Math.abs(st.y) > 0.3) dirY = Math.sign(st.y);
        else {
          let near = null, nd = 99;
          for (const d of this.defendersOf(c.side)) { const dd = dist(d, c); if (dd < nd && d.st !== 'down') { nd = dd; near = d; } }
          dirY = near ? (near.y > c.y ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
        }
      }
      const pow = 3.6 + c.r.jkm * 0.025;
      c.vy += dirY * pow; c.vx *= 0.8;
      c.jukeT = 0.38; c.moveCD = this.hasPerkFor(c, 'jukebox') ? 0.55 : 1.1;
      c.pose = 'block'; c.poseT = 0.2;
      this.pop('JUKE', c.x, c.y, '#7df');
      if (PG.Audio) PG.Audio.whoosh();
    }
    stiff(c) {
      if (c.moveCD > 0) return;
      c.stiffT = 0.55; c.moveCD = 1.3; c.pose = 'block'; c.poseT = 0.5;
      this.pop('STIFF ARM', c.x, c.y, '#fd7');
    }
    spin(c) {
      if (c.moveCD > 0) return;
      c.spinT = 0.45; c.moveCD = 1.5; c.slowT = 0.3; c.slowMul = 0.75; c.spinAnim = 0.45;
      this.pop('SPIN', c.x, c.y, '#df7');
      if (PG.Audio) PG.Audio.whoosh();
    }
    dive(c) {
      if (c.diveT > 0) return;
      const dirX = c.side === 'off' ? 1 : -1;
      c.diveT = 0.3; c.vx = dirX * (c.maxSpd * 0.9 + 2); c.vy *= 0.5;
      c.diving = true;
      this.pop('DIVE!', c.x, c.y, '#fff');
    }
    defBurst(c) {
      if (c.moveCD > 0) return;
      const car = this.carrier();
      if (car && car.side !== c.side && dist(car, c) < 3) {
        const dx = car.x + car.vx * 0.15 - c.x, dy = car.y + car.vy * 0.15 - c.y, d = Math.hypot(dx, dy) || 1;
        c.vx = dx / d * (c.maxSpd + 2.5); c.vy = dy / d * (c.maxSpd + 2.5);
        c.diveT = 0.35; c.lunge = true; c.moveCD = 1.2;
        this.pop('DIVE!', c.x, c.y, '#fff');
      } else {
        c.burstT = 0.6; c.moveCD = 1.6;
        this.pop('BURST', c.x, c.y, '#7df');
      }
    }

    // ------------------------------------------------------------ AI
    think(e, dt) {
      // timers
      e.tCD = Math.max(0, e.tCD - dt); e.moveCD = Math.max(0, e.moveCD - dt);
      e.jukeT = Math.max(0, e.jukeT - dt); e.stiffT = Math.max(0, e.stiffT - dt); e.spinT = Math.max(0, e.spinT - dt);
      e.cutLag = Math.max(0, e.cutLag - dt * 0.6);
      if (e.poseT != null) { e.poseT -= dt; if (e.poseT <= 0) { e.pose = null; e.poseT = null; } }
      if (e.burstT) e.burstT = Math.max(0, e.burstT - dt);
      e.spdMul = 1;
      if (e.slowT > 0) { e.slowT -= dt; e.spdMul *= e.slowMul || 0.6; }
      if (e.burstT > 0) e.spdMul *= 1.12;
      if (e.hasBall && e.role !== 'QB') e.spdMul *= 0.97;
      if (e.st === 'down') { e.vx *= 0.8; e.vy *= 0.8; return; }
      if (e.stunT > 0) { e.stunT -= dt; e.spdMul *= 0.25; this.accelTo(e, 0, 0, dt); if (e.stunT <= 0 && e.st === 'stun') e.st = 'ok'; return; }
      if (e.diveT > 0) {
        e.diveT -= dt;
        if (e.diveT <= 0) {
          if (e.diving) { e.diving = false; if (this.carrier() === e && this.state === 'live') { e.st = 'down'; e.lowerPose = null; this.endCarrierPlay('dive'); } }
          if (e.lunge) { e.lunge = false; e.stunT = 0.6; e.st = 'stun'; }
        }
        return;
      }
      if (e.st === 'engaged') { this.engagedThink(e, dt); return; }
      // user control
      if (e === this.ctrl && this.state === 'live') {
        const mode = this.mode;
        const st = I.stick();
        const auto = ((mode === 'route' || mode === 'catch' || mode === 'defend' || mode === 'block' || mode === 'spectate') && this.settings.autoRoute && !e.manual) || (mode === 'qb' && !e.userMoved && this.t < (this.dropT || 0)) || (mode === 'qbrun' && !e.userMoved);
        e._auto = auto;
        if (!auto && mode !== 'none') {
          let sp = e.maxSpd * e.spdMul;
          // stamina / sprint
          const drain = this.hasPerkFor(e, 'secondwind') ? 0.11 : 0.17;
          if (st.m > 0.85) e.stamina = Math.max(0, e.stamina - drain * dt * (1.2 - e.r.sta / 200));
          else e.stamina = Math.min(1, e.stamina + 0.25 * dt);
          if (e.stamina < 0.35) sp *= 0.86 + e.stamina * 0.4;
          if (this.hasPerkFor(e, 'deepthreat') && e.x > this.los + 10) sp *= 1.06;
          if (this.hasPerkFor(e, 'closer') && this.carrier() && this.carrier().side !== e.side) sp *= 1.05;
          // screen → world: screen y is compressed, so scale back up to keep diagonal feel
          this.accelTo(e, st.x * sp, st.y * sp, dt);
          if (mode === 'route') this.trackRoute(e, dt);
          if (mode === 'block') this.autoEngage(e);
          if (mode === 'qbrun') this.checkHandoff(e);
          return;
        }
      }
      if (this.carrier() === e && (this.phase === 'run' || e.asg.type === 'carry' || (e.role !== 'QB'))) {
        if (e.role === 'QB' && this.phase === 'dev' && this.play.type !== 'run') { this.qbAI(e, dt); return; }
        this.carrierAI(e, dt); return;
      }
      if (e.side === 'off') this.offAI(e, dt); else this.defAI(e, dt);
    }

    trackRoute(e, dt) {
      // measure how well the user follows the route (affects AI QB trust)
      const a = e.asg;
      if (!a || a.type !== 'route') return;
      const p = a.pts[Math.min(a.idx, a.pts.length - 1)];
      if (Math.hypot(p.x - e.x, p.y - e.y) < 1.4 && a.idx < a.pts.length - 1) { a.idx++; this.onCut(e); }
      const dev = this.devFromRoute(e);
      e.routeDev = (e.routeDev || 0) * 0.97 + dev * 0.03;
    }
    devFromRoute(e) {
      const a = e.asg;
      let best = 99;
      let prev = { x: e.sx, y: e.sy };
      for (const p of a.pts) {
        const vx = p.x - prev.x, vy = p.y - prev.y, L2 = vx * vx + vy * vy || 1;
        const t = U.clamp(((e.x - prev.x) * vx + (e.y - prev.y) * vy) / L2, 0, 1);
        best = Math.min(best, Math.hypot(prev.x + vx * t - e.x, prev.y + vy * t - e.y));
        prev = p;
      }
      return best;
    }
    onCut(e) {
      e.cutLag = 0.08 + Math.max(0, (e.r.rte - 65) * 0.006) + (this.hasPerkFor(e, 'routetech') ? 0.1 : 0);
      e.slowT = 0.12; e.slowMul = 0.72 + e.r.agi * 0.0025;
    }

    offAI(e, dt) {
      const a = e.asg;
      if (this.ball.state === 'air' && this.ball.target === e && (e !== this.ctrl || e._auto)) {
        // run to the landing spot
        const b = this.ball, rem = Math.max(0.05, b.T - b.t);
        const need = Math.hypot(b.ex - e.x, b.ey - e.y) / rem;
        const frac = U.clamp(need / e.maxSpd, 0.3, 1);
        this.steer(e, b.ex, b.ey, frac, dt);
        e.pose = rem < 0.35 ? 'catch' : null;
        return;
      }
      if (e.role === 'QB') { this.qbAI(e, dt); return; }
      const car = this.carrier();
      if (this.phase === 'run' && car && car !== e) {
        if (car.side === 'off') { this.blockFor(e, car, dt); return; }
        // defense has the ball: chase
        this.pursue(e, car, dt); return;
      }
      if (this.ball.state === 'loose') { this.steer(e, this.ball.x, this.ball.y, 1, dt, true); return; }
      if (this.phase === 'air' && a.type === 'route' && !a.sit) { this.routeAI(e, dt); return; }
      switch (a.type) {
        case 'route': this.routeAI(e, dt); break;
        case 'passpro': this.passPro(e, dt); break;
        case 'runblock': this.runBlock(e, dt); break;
        case 'lead': this.leadBlock(e, dt); break;
        case 'carry': this.preHandoff(e, dt); break;
        default: this.accelTo(e, 0, 0, dt);
      }
    }

    routeAI(e, dt) {
      const a = e.asg;
      if (this.play.type === 'screen' && a.sit && a.idx >= a.pts.length) {
        // wait for the ball, facing the QB
        this.accelTo(e, 0, 0, dt); return;
      }
      if (a.idx < a.pts.length) {
        const p = a.pts[a.idx];
        this.steer(e, p.x, p.y, 1, dt, true);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 1.0) {
          a.idx++;
          if (a.idx < a.pts.length) this.onCut(e);
        }
        return;
      }
      if (a.sit) {
        // settle and find a hole
        let near = null, nd = 99;
        for (const d of this.def) { const dd = dist(d, e); if (dd < nd) { nd = dd; near = d; } }
        if (near && nd < 2.2) this.steer(e, e.x - 0.3, e.y + (e.y > near.y ? 1.5 : -1.5), 0.45, dt);
        else this.accelTo(e, 0, 0, dt);
        return;
      }
      // keep running; near the sideline, turn upfield
      let dx = e.vx, dy = e.vy;
      const m = Math.hypot(dx, dy) || 1;
      dx /= m; dy /= m;
      if (e.y < 3 || e.y > W - 3) { dy = 0; dx = 1; }
      if (e.x > 116) dx = 0;
      this.accelTo(e, dx * e.maxSpd * e.spdMul, dy * e.maxSpd * e.spdMul, dt);
    }

    passPro(e, dt) {
      const qb = this.qb;
      if (!qb) return;
      let tgt = e.asg.target;
      if (!tgt || tgt.st === 'engaged' || tgt.st === 'down' || tgt.asg.type !== 'rush') {
        tgt = null; let bd = 5;
        for (const d of this.def) {
          if (d.st === 'engaged' || d.st === 'down' || d.asg.type !== 'rush') continue;
          const dd = dist(d, e);
          if (dd < bd && d.x > qb.x - 1) { bd = dd; tgt = d; }
        }
        e.asg.target = tgt;
      }
      if (tgt) {
        const gx = qb.x - tgt.x, gy = qb.y - tgt.y, g = Math.hypot(gx, gy) || 1;
        this.steer(e, tgt.x + gx / g * 0.9, tgt.y + gy / g * 0.9, 1, dt, true);
        if (dist(e, tgt) < 1.05 && !tgt.eng) this.engage(e, tgt, 'pass');
      } else {
        const sx = (e.role === 'OL' ? this.los - 1.6 : qb.x + 1.5);
        this.steer(e, sx, e.role === 'OL' ? e.sy : U.lerp(e.y, qb.y, 0.5), 0.5, dt);
      }
    }

    runBlock(e, dt) {
      const car = this.slotEnt[this.play.carrier] || this.qb;
      let tgt = e.asg.target;
      if (!tgt || tgt.st === 'engaged' || tgt.st === 'down') {
        tgt = null; let bd = e.role === 'OL' ? 4.5 : 9;
        for (const d of this.def) {
          if (d.st === 'engaged' || d.st === 'down') continue;
          if (d.x < e.x - 1.5) continue;
          let dd = dist(d, e) + (d.role === 'DL' ? -1 : 0);
          if (e.role === 'WR') dd = dist(d, e) + (d.role === 'CB' ? -3 : 0);
          if (dd < bd) { bd = dd; tgt = d; }
        }
        e.asg.target = tgt;
      }
      if (tgt) {
        const tx = tgt.x - 0.7, ty = tgt.y + (car && car.y > tgt.y ? -0.3 : 0.3);
        this.steer(e, tx, ty, 1, dt, true);
        if (dist(e, tgt) < 1.05 && !tgt.eng) this.engage(e, tgt, 'run');
      } else this.steer(e, e.x + 3, e.y, 0.6, dt);
    }
    leadBlock(e, dt) {
      const car = this.slotEnt[this.play.carrier];
      const p = car && car.asg.path ? car.asg.path[Math.min(1, car.asg.path.length - 1)] : { x: this.los + 2, y: this.ballY };
      if (this.t < 0.6) { this.steer(e, p.x, p.y, 1, dt, true); return; }
      e.asg.type = 'runblock';
      this.runBlock(e, dt);
    }
    blockFor(e, car, dt) {
      if (e.role === 'QB') { this.steer(e, car.x - 4, car.y, 0.4, dt); return; }
      let tgt = null, bd = 9;
      for (const d of this.def) {
        if (d.st === 'engaged' || d.st === 'down' || d.stunT > 0) continue;
        const dc = dist(d, car);
        if (dc > 10) continue;
        const dd = dist(d, e) * 0.7 + dc * 0.5;
        if (dd < bd && dist(e, car) < dc + 3) { bd = dd; tgt = d; }
      }
      if (tgt) {
        const tx = U.lerp(tgt.x, car.x, 0.25), ty = U.lerp(tgt.y, car.y, 0.25);
        this.steer(e, tx, ty, 1, dt, true);
        if (dist(e, tgt) < 1.0 && !tgt.eng) this.engage(e, tgt, 'run');
      } else this.steer(e, car.x + 3, car.y + (e.y > car.y ? 3 : -3), 0.8, dt);
    }
    autoEngage(e) {
      for (const d of this.def) {
        if (d.st === 'engaged' || d.st === 'down') continue;
        if (dist(e, d) < 1.0 && this.speed(e) > 0.5) { this.engage(e, d, 'run'); break; }
      }
    }

    preHandoff(e, dt) {
      const a = e.asg;
      const r = this.runDef;
      if (r.delay && this.t < r.delay) { this.accelTo(e, 0, 0, dt); return; }
      const p = a.path[Math.min(a.idx, a.path.length - 1)];
      this.steer(e, p.x, p.y, 0.8, dt, true);
      if (Math.hypot(p.x - e.x, p.y - e.y) < 1.1 && a.idx < a.path.length - 1) a.idx++;
    }

    qbAI(e, dt) {
      const pl = this.play;
      if (this.ball.holder !== e || this.ball.state !== 'held') {
        this.steer(e, e.x - 0.6, e.y, 0.25, dt); return;
      }
      if (pl.type === 'run' && !this.runDef.qb) {
        if (this.handed) { this.steer(e, e.x - 1, e.y - this.play.dir * this.flipS * 2, 0.4, dt); return; }
        if (this.runDef.toss && this.t > this.runDef.mesh) { this.pitch(e); return; }
        const car = this.slotEnt[this.play.carrier];
        if (car && this.t > this.meshT) this.steer(e, car.x, car.y, 0.9, dt, true);
        else if (this.meshPt) this.steer(e, this.meshPt.x, this.meshPt.y, 0.75, dt);
        this.checkHandoff(e);
        return;
      }
      if (this.pendingThrow) { this.accelTo(e, 0, 0, dt); return; }
      // drop back
      if (this.t < this.dropT) {
        let tx = this.dropPt.x, ty = this.dropPt.y;
        if (pl.pa && this.t < 0.5) {
          const rb = this.slotEnt.RB;
          if (rb) { tx = U.lerp(e.x, rb.x, 0.3); ty = U.lerp(e.y, rb.y, 0.5); }
        }
        this.steer(e, tx, ty, 0.95, dt);
        return;
      }
      if (e === this.ctrl) return; // user QB: no AI reads
      const press = this.pressure(e);
      const tEl = this.t - this.dropT;
      const prog = (pl.prog || []).map((s) => this.slotEnt[s]).filter((r) => r && r.asg && r.asg.type === 'route');
      if (!prog.length) { if (tEl > 1.0) this.throwAway(e); return; }
      const readDur = 0.5 + (100 - e.r.awr) * 0.006;
      const thresh = U.lerp(2.9, 1.5, U.clamp(tEl / 3.2, 0, 1)) - (e.r.awr - 70) * 0.012;
      // user receiver calling for the ball
      const u = this.userEnt;
      const uIn = u && u.side === 'off' && u.asg && u.asg.type === 'route' && u !== e;
      if (uIn) {
        const o = this.openness(u, e);
        const trust = (this.o.trust || 50) / 100;
        const called = this.userCall != null && this.t - this.userCall < 1.4;
        const freelance = (u.routeDev || 0) > 4;
        if (called && o > (freelance ? 3.4 : 1.4) && this.t > 0.6) { this.aiThrow(e, u); return; }
        if (!called && o > thresh * (1.15 - trust * 0.35) && this.t > 0.9 && Math.random() < dt * (1 + trust * 2) && !freelance) { this.aiThrow(e, u); return; }
      }
      const cur = prog[this.qbs.idx % prog.length];
      if (cur && this.t > 0.55 && this.openness(cur, e) > thresh && (cur.asg.idx >= 1 || this.t > 1.4)) { this.aiThrow(e, cur); return; }
      let best = null, bo = 0;
      for (const r of prog) { const o = this.openness(r, e); if (o > bo) { bo = o; best = r; } }
      if (press < 2.3) {
        if (best && bo > 1.5) { this.aiThrow(e, best); return; }
        if (e.r.spd >= 72 && Math.random() < dt * 2.2) { this.scramble(e); return; }
        if (tEl > 1.0 && Math.random() < dt * 1.6) { this.throwAway(e); return; }
        // slide away from pressure
        let nx = 0, ny = 0;
        for (const d of this.def) { const dd = dist(d, e); if (dd < 4 && d.st !== 'engaged') { nx += (e.x - d.x) / dd; ny += (e.y - d.y) / dd; } }
        this.steer(e, e.x + nx * 1.5, e.y + ny * 1.5, 0.6, dt);
      } else this.accelTo(e, 0, 0, dt);
      this.qbs.readT += dt;
      if (this.qbs.readT > readDur) { this.qbs.idx++; this.qbs.readT = 0; }
      if (tEl > 4.2) { if (best && bo > 1.0) this.aiThrow(e, best); else this.throwAway(e); }
    }
    scramble(e) {
      e.asg = { type: 'carry', path: [{ x: this.los + 3, y: e.y }], idx: 0 };
      this.phase = 'run';
      this.scrambled = true;
    }
    checkHandoff(e) {
      const car = this.slotEnt[this.play.carrier];
      if (!car || this.handed) return;
      if (this.t > this.meshT && dist(e, car) < 1.3) {
        this.handed = true;
        this.give(car);
        this.phase = 'run';
        if (this.ctrl === this.qb && this.o.ctrlRunner) this.ctrl = car;
      } else if (this.t > this.meshT + 1.6) {
        this.handed = true; this.give(car); this.phase = 'run';
        if (this.ctrl === this.qb && this.o.ctrlRunner) this.ctrl = car;
      }
    }
    pitch(e) {
      const car = this.slotEnt[this.play.carrier];
      if (!car || this.handed) return;
      this.handed = true;
      this.ball.state = 'pitch'; this.ball.holder = null; e.hasBall = false;
      this.ball.sx = e.x; this.ball.sy = e.y; this.ball.t = 0; this.ball.T = 0.35; this.ball.to = car;
    }

    aiThrow(e, r) {
      let T = dist(e, r) / this.ballSpeed(e) + this.relTime;
      let tx = r.x, ty = r.y;
      for (let i = 0; i < 3; i++) {
        tx = r.x + r.vx * T; ty = r.y + r.vy * T;
        T = Math.hypot(tx - e.x, ty - e.y) / this.ballSpeed(e) + this.relTime;
      }
      if (r.asg && r.asg.sit && this.speed(r) < 1) tx -= 0.4;
      ty = U.clamp(ty, 1, W - 1); tx = Math.min(tx, 118);
      this.queueThrow(e, tx, ty, r);
    }
    queueThrow(e, tx, ty, target, away) {
      if (this.pendingThrow || this.ball.holder !== e) return;
      this.pendingThrow = { e, tx, ty, target, away, at: this.t + this.relTime };
      e.pose = 'throw'; e.poseT = this.relTime + 0.05;
    }
    updatePendingThrow() {
      const pt = this.pendingThrow;
      if (!pt) return;
      if (this.ball.holder !== pt.e || pt.e.st === 'down') { this.pendingThrow = null; return; }
      if (this.t >= pt.at) { this.pendingThrow = null; this.launch(pt.e, pt.tx, pt.ty, pt.target, pt.away); pt.e.pose = 'release'; pt.e.poseT = 0.3; }
    }

    launch(e, tx, ty, target, away) {
      const r = e.r;
      let d = Math.hypot(tx - e.x, ty - e.y);
      const isUserTeam = this.o.userSide === 'off';
      let ex = tx, ey = ty;
      if (!away) {
        const acc = d < 12 ? r.tas : d < 25 ? r.tam : r.tad;
        let sigma = d * (0.026 + (100 - acc) * 0.0011);
        const pr = this.pressure(e);
        if (pr < 2) sigma += 0.9 * (2 - pr);
        const sp = this.speed(e);
        if (sp > 2) sigma += (sp / 8) * (1.6 - r.tor / 100) * 1.2 * (this.hasPerkFor(e, 'escape') ? 0.6 : 1);
        if (this.o.weather.type === 'rain') sigma += 0.25;
        if (this.o.weather.type === 'snow') sigma += 0.35;
        if (this.hasPerkFor(e, 'pinpoint')) sigma *= 0.7;
        if (this.hasPerkFor(e, 'dimes') && d > 25) sigma *= 0.55;
        if (this.hasPerkFor(e, 'clutch') && this.o.q >= 4) sigma *= 0.85;
        if (e.isUser || (isUserTeam && this.ctrl === e)) sigma *= this.diff.err;
        else if (this.o.userSide === 'def') sigma *= 1.0;
        if (isUserTeam) sigma *= 1.1 - (this.o.chem || 50) * 0.002;
        ex += U.gauss() * sigma; ey += U.gauss() * sigma * 0.8;
        const wind = this.o.weather.wind || 0;
        if (wind > 6) ey += (this.o.weather.windDir || 1) * (wind - 6) * 0.012 * d * 0.3;
      }
      d = Math.hypot(ex - e.x, ey - e.y);
      const spd = this.ballSpeed(e);
      const apex = d < 8 ? 0.6 : d < 18 ? 1.4 + (d - 8) * 0.1 : 2.4 + (d - 18) * 0.17;
      const T = Math.max(0.18, d / spd * (1 + apex * 0.05));
      for (const x of this.ents) x.hasBall = false;
      Object.assign(this.ball, { state: 'air', holder: null, sx: e.x, sy: e.y, sz: 2.0, ex, ey, ez: 1.15, t: 0, T, apex, passer: e, dist: d, away: !!away, spd });
      // intended receiver: nearest eligible to landing at arrival
      let tgt = target;
      if (!tgt && !away) {
        let bd = 5;
        for (const o of this.off) {
          if (!ELIG[o.role] || o === e) continue;
          const px = o.x + o.vx * T * 0.7, py = o.y + o.vy * T * 0.7;
          const dd = Math.hypot(px - ex, py - ey);
          if (dd < bd) { bd = dd; tgt = o; }
        }
      }
      this.ball.target = tgt;
      this.phase = 'air';
      this.passer = e;
      this.stat(e, 'pAtt', 1);
      if (tgt) this.stat(tgt, 'tgt', 1);
      if (PG.Audio) PG.Audio.throw();
      // defenders react to the throw
      for (const dfd of this.def) {
        if (dfd.st === 'engaged' || dfd.st === 'down') continue;
        const dd = Math.hypot(dfd.x - ex, dfd.y - ey);
        const reach = 4.5 + dfd.r.prc * 0.045 + (dfd.asg.deep ? 3 : 0);
        if (dd < reach) dfd.chase = { at: this.t + 0.12 + (100 - dfd.r.awr) * 0.0045 - (this.hasPerkFor(dfd, 'ballhawk') ? 0.1 : 0) };
      }
      // skill check for the user
      const u = this.ctrl;
      if (u && !away) {
        if (u.side === 'off' && u !== e && (tgt === u || Math.hypot(u.x - ex, u.y - ey) < 3) && (u !== this.qb)) {
          this.ball.target = u;
          this.startSkill('catch', T);
        } else if (u.side === 'def' && Math.hypot(u.x - ex, u.y - ey) < 7.5) this.startSkill('int', T);
      }
    }

    // ------------------------------------------------------------ skill check
    startSkill(type, T) {
      if (T < 0.32) return;
      const ring = Math.min(1.35, Math.max(0.55, T - 0.05));
      let win = this.diff.win;
      if (type === 'catch' && this.perks.has('surehands')) win *= 1.35;
      if (type === 'int' && this.perks.has('ballhawk')) win *= 1.35;
      this.sc = { type, start: this.t + (T - ring), end: this.t + T, ring, win, tapped: false, grade: null, bonus: 0, base: 0 };
    }
    tapSkill() {
      const sc = this.sc;
      if (!sc || sc.tapped || this.t < sc.start - 0.05) return;
      sc.tapped = true;
      const dtm = Math.abs(this.t - sc.end);
      const w = sc.win;
      if (dtm <= 0.06 * w) { sc.grade = 'PERFECT'; sc.bonus = 0.25; this.stats.perfects++; }
      else if (dtm <= 0.13 * w) { sc.grade = 'GREAT'; sc.bonus = 0.15; }
      else if (dtm <= 0.22 * w) { sc.grade = 'GOOD'; sc.bonus = 0.07; }
      else { sc.grade = this.t < sc.end ? 'EARLY' : 'LATE'; sc.bonus = -0.05; }
      sc.tapT = this.t;
      if (PG.Audio) PG.Audio.blip(sc.bonus > 0.1 ? 880 : sc.bonus > 0 ? 660 : 220);
      if (this.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(sc.bonus > 0.1 ? 30 : 12); } catch (e) { /* ignore */ } }
    }
    updateSkillCheck() {
      const sc = this.sc;
      if (!sc) return;
      // slow motion as the ball arrives
      if (this.settings.slowmo && !sc.tapped && this.ball.state === 'air' && sc.end - this.t < 0.45) this.timeScale = 0.55;
      else this.timeScale = 1;
      // live base percentage
      const u = this.ctrl;
      if (u && this.ball.state === 'air') {
        const L = { x: this.ball.ex, y: this.ball.ey };
        if (sc.type === 'catch') sc.base = this.catchChance(u, L).p;
        else sc.base = this.intChance(u, L);
      }
      if (this.t > sc.end + 0.8) { this.sc = null; this.timeScale = 1; }
    }

    catchChance(rcv, L) {
      const r = rcv.r;
      let p = 0.6 + (r.cth - 60) * 0.0085;
      const b = this.ball;
      if (b.spd > 22 && b.dist < 8) p -= 0.05;
      const dd = Math.hypot(rcv.x - L.x, rcv.y - L.y);
      const reach = this.reach(rcv);
      if (dd > reach) return { p: 0, contest: 0, dd };
      if (dd > 0.6) p -= (dd - 0.6) * 0.18;
      let contest = 0;
      for (const d of this.def) {
        if (d.st === 'down') continue;
        const x = Math.hypot(d.x - L.x, d.y - L.y);
        if (x < 1.9) contest += (1.9 - x) / 1.9 * (0.55 + ((d.r.mcv + d.r.zcv) / 2 - 60) * 0.006 + (d.r.jmp - 70) * 0.003);
      }
      contest = Math.min(contest, 0.85);
      p -= contest * (0.52 - (r.cit - 60) * 0.006) * (this.hasPerkFor(rcv, 'leap') ? 0.6 : 1);
      if (this.o.weather.type === 'rain' || this.o.weather.type === 'snow') p -= 0.06;
      if (this.o.userSide === 'off') p += ((this.o.chem || 50) - 50) * 0.0015;
      if (this.hasPerkFor(rcv, 'clutch') && this.o.q >= 4) p += 0.04;
      if (rcv.side === 'off' && this.o.userSide === 'def') p += this.diff.ai * 0.004;
      return { p: U.clamp(p, 0.03, 0.97), contest, dd };
    }
    intChance(d, L) {
      const dd = Math.hypot(d.x - L.x, d.y - L.y);
      const reach = this.reach(d);
      if (dd > reach) return 0;
      let p = 0.14 + (d.r.cth - 50) * 0.005 + (this.hasPerkFor(d, 'ballhawk') ? 0.08 : 0);
      p *= 1 - dd / (reach + 0.4);
      return U.clamp(p, 0.01, 0.6);
    }
    reach(e) { return 1.0 + e.r.jmp * 0.007 + (this.hasPerkFor(e, 'leap') ? 0.3 : 0) + (e.p.ht > 75 ? 0.1 : 0); }

    // ------------------------------------------------------------ ball
    updateBall(dt) {
      const b = this.ball;
      b.spin += dt * 20;
      if (b.state === 'held') {
        const h = b.holder;
        if (h) { b.x = h.x + h.face * 0.25; b.y = h.y; b.z = 1.1; }
        if (this.phase === 'dev' && h && h.role === 'QB' && this.play.type !== 'run' && h.x > this.los + 0.4) {
          // QB crossed the line: now a runner
          this.phase = 'run'; this.scrambled = true;
          if (!h.isUser) h.asg = { type: 'carry', path: [], idx: 0 };
        }
        return;
      }
      if (b.state === 'snap') {
        b.t += dt;
        const f = Math.min(1, b.t / b.T), q = this.qb;
        b.x = U.lerp(b.sx, q.x, f); b.y = U.lerp(b.sy, q.y, f); b.z = 0.4 + f * 0.8 + Math.sin(f * Math.PI) * 0.4;
        if (f >= 1) this.give(q);
        return;
      }
      if (b.state === 'pitch') {
        b.t += dt;
        const f = Math.min(1, b.t / b.T), to = b.to;
        b.x = U.lerp(b.sx, to.x, f); b.y = U.lerp(b.sy, to.y, f); b.z = 1 + Math.sin(f * Math.PI) * 0.7;
        if (f >= 1) { this.give(to); this.phase = 'run'; if (this.ctrl === this.qb && this.o.ctrlRunner) this.ctrl = to; }
        return;
      }
      if (b.state === 'air') {
        b.t += dt;
        const f = Math.min(1, b.t / b.T);
        b.x = U.lerp(b.sx, b.ex, f); b.y = U.lerp(b.sy, b.ey, f);
        b.z = U.lerp(b.sz, b.ez, f) + 4 * b.apex * f * (1 - f);
        if (f >= 1) this.resolveCatch();
        return;
      }
      if (b.state === 'ground' || b.state === 'loose') {
        b.vz = (b.vz || 0) - 22 * dt;
        b.z += b.vz * dt;
        b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt;
        if (b.z <= 0.1) { b.z = 0.1; b.vz = Math.abs(b.vz) * 0.45; b.vx *= 0.6; b.vy *= 0.6; }
        if (b.state === 'loose' && this.state === 'live') this.checkRecover();
      }
    }

    resolveCatch() {
      const b = this.ball;
      const L = { x: b.ex, y: b.ey };
      const sc = this.sc;
      if (b.away || L.y < 0 || L.y > W || L.x > 120) { this.incomplete(b.away ? 'Thrown away' : 'Out of bounds'); return; }
      // candidates
      let rcv = null, rd = 99;
      for (const o of this.off) {
        if (!ELIG[o.role] || o === b.passer || o.st === 'down' || o.st === 'engaged') continue;
        const dd = Math.hypot(o.x - L.x, o.y - L.y);
        if (dd <= this.reach(o) && dd < rd) { rd = dd; rcv = o; }
      }
      let dfd = null, ddist = 99;
      for (const d of this.def) {
        if (d.st === 'down' || d.st === 'engaged') continue;
        const dd = Math.hypot(d.x - L.x, d.y - L.y);
        if (dd <= this.reach(d) && dd < ddist) { ddist = dd; dfd = d; }
      }
      const userBonusFor = (e) => (sc && sc.tapped && e === this.ctrl ? sc.bonus : 0);
      if (!rcv && !dfd) { this.incomplete('Incomplete'); return; }
      let pi = dfd ? this.intChance(dfd, L) + userBonusFor(dfd) * (dfd === this.ctrl ? 1.2 : 1) : 0;
      if (dfd && this.o.userSide === 'off' && dfd !== this.ctrl) pi *= 0.85;
      if (rcv) {
        const cc = this.catchChance(rcv, L);
        let p = cc.p + userBonusFor(rcv);
        if (dfd && dfd === this.ctrl && sc && sc.tapped && sc.bonus > 0) p -= sc.bonus * 0.8;
        if (dfd && ddist < rd) {
          if (Math.random() < pi) { this.intercept(dfd); return; }
          if (Math.random() < 0.3 + (dfd.r.mcv - 60) * 0.004 + (dfd === this.ctrl ? 0.15 : 0)) { this.stat(dfd, 'pd', 1); this.incomplete('Broken up by ' + Pl.name(dfd.p), dfd); return; }
        }
        p = U.clamp(p, 0.02, 0.985);
        if (Math.random() < p) { this.caught(rcv); return; }
        if (dfd && Math.random() < pi * 0.5) { this.intercept(dfd); return; }
        if (dfd && Math.random() < 0.6) this.stat(dfd, 'pd', 1);
        else if (cc.contest < 0.15 && p > 0.65) { this.stat(rcv, 'drops', 1); this.pop('DROPPED', rcv.x, rcv.y, '#f66'); }
        // pass interference chance on tight contested incompletions
        if (dfd && ddist < 0.8 && cc.contest > 0.4 && Math.random() < 0.1) {
          this.incomplete('Incomplete', dfd);
          this.flag = { on: 'def', name: 'Pass Interference', yds: Math.max(1, Math.round(L.x - this.los)), auto: true, spot: true };
          return;
        }
        this.incomplete('Incomplete', dfd);
        return;
      }
      if (Math.random() < pi * 1.3) this.intercept(dfd);
      else { this.stat(dfd, 'pd', 1); this.incomplete('Knocked away', dfd); }
    }
    caught(r) {
      this.give(r);
      this.phase = 'run';
      this.catcher = r; this.catchX = r.x;
      this.stat(this.passer, 'pCmp', 1); this.stat(r, 'rec', 1);
      r.pose = 'catch'; r.poseT = 0.25;
      this.stats.catches++;
      const sc = this.sc;
      this.pop(sc && sc.tapped && sc.grade === 'PERFECT' ? 'PERFECT CATCH!' : 'CATCH', r.x, r.y, '#7f7');
      if (PG.Audio) PG.Audio.catch();
      if (this.ctrl === this.qb && this.o.ctrlRunner) this.ctrl = r;
      for (const d of this.def) d.chase = null;
    }
    intercept(d) {
      this.give(d);
      this.phase = 'run';
      this.turnover = 'int'; this.turnX = d.x;
      this.stat(this.passer, 'pInt', 1); this.stat(d, 'dInt', 1); this.stat(d, 'pd', 1);
      this.msg('INTERCEPTED!', '#ff5050', 1.6);
      if (PG.Audio) PG.Audio.boo(this.o.userSide === 'def' ? 'cheer' : 'boo');
      if (this.o.userSide === 'def' && d === this.ctrl) this.stats.bigPlay++;
    }
    incomplete(text, by) {
      const b = this.ball;
      b.state = 'ground'; b.vx = (b.ex - b.sx) / b.T * 0.25; b.vy = (b.ey - b.sy) / b.T * 0.25; b.vz = 3;
      if (by) { b.vx = -b.vx; b.vz = 5; }
      this.msg(text.toUpperCase(), '#ddd', 1.2);
      if (PG.Audio) PG.Audio.thud();
      this.finish({ kind: 'pass', incomplete: true, yards: 0, desc: `${Pl.name(this.passer.p)} pass ${text === 'Incomplete' ? 'incomplete' : '— ' + text.toLowerCase()}${this.ball.target ? ' (intended for ' + Pl.name(this.ball.target.p) + ')' : ''}.` });
    }
    checkRecover() {
      const b = this.ball;
      if (b.z > 1) return;
      let best = null, bd = 0.8;
      for (const e of this.ents) { if (e.st === 'down') continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
      if (best && Math.random() < 0.25) {
        const fum = this.fumbler;
        this.give(best);
        best.st = 'down';
        if (best.side !== fum.side) { this.stat(fum, 'fum', 1); this.msg('FUMBLE RECOVERED!', '#ff5050'); this.turnover = 'fumble'; this.turnX = best.x; }
        else this.msg('OFFENSE RECOVERS', '#fff');
        this.endCarrierPlay('recover', best);
      }
      if (this.t - this.fumbleT > 2.5) {
        // nobody got it: offense retains at spot
        this.give(this.fumbler); this.fumbler.st = 'down'; this.endCarrierPlay('recover', this.fumbler);
      }
    }

    carrierAI(e, dt) {
      const a = e.asg;
      const dirX = e.side === 'off' ? 1 : -1;
      if (a && a.type === 'carry' && a.path && a.idx < a.path.length && e.side === 'off' && !this.scrambled) {
        const p = a.path[a.idx];
        this.steer(e, p.x, p.y, 1, dt, true);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 1.2) a.idx++;
        return;
      }
      let gx = dirX * 1.3, gy = 0;
      for (const d of this.defendersOf(e.side)) {
        if (d.st === 'down' || d.st === 'engaged' || d.stunT > 0) continue;
        const rx = e.x - d.x, ry = e.y - d.y, dd = Math.hypot(rx, ry);
        if (dd > 8) continue;
        const ahead = (d.x - e.x) * dirX > -1.5;
        const w = (ahead ? 2.4 : 0.8) / Math.max(0.6, dd);
        gx += rx / dd * w * 0.6; gy += ry / dd * w;
      }
      if (e.y < 3) gy += (3 - e.y) * 0.6;
      if (e.y > W - 3) gy -= (e.y - (W - 3)) * 0.6;
      // late in games, the runner heads for the sideline to stop the clock
      if (this.o.oobMode && e.side === 'off') gy += (e.y < W / 2 ? -1.2 : 1.2);
      const m = Math.hypot(gx, gy) || 1;
      this.accelTo(e, gx / m * e.maxSpd * e.spdMul, gy / m * e.maxSpd * e.spdMul, dt);
      // AI moves
      if (!e.isUser && e.moveCD <= 0) {
        for (const d of this.defendersOf(e.side)) {
          if (d.st !== 'ok' && d.st !== 'pre') continue;
          const dd = dist(d, e);
          if (dd < 1.9 && (d.x - e.x) * dirX > 0) {
            const roll = Math.random();
            if (roll < dt * 4 * (e.r.jkm / 100)) this.juke(e, d.y > e.y ? -1 : 1);
            else if (roll < dt * 6 * (e.r.stf / 100) && e.r.stf > 60) this.stiff(e);
            break;
          }
        }
      }
    }

    defAI(e, dt) {
      const car = this.carrier();
      const qb = this.qb;
      if (this.ball.state === 'loose') { this.steer(e, this.ball.x, this.ball.y, 1, dt, true); return; }
      if (car && car.side === 'def' && car !== e) { this.blockForDef(e, car, dt); return; }
      if (car && car !== e && (this.phase === 'run' || (this.play.type === 'run' && this.t > e.recogT && car !== qb))) { this.pursue(e, car, dt); return; }
      if (this.ball.state === 'air') {
        if (e.chase && this.t >= e.chase.at) {
          const b = this.ball, rem = Math.max(0.05, b.T - b.t);
          this.steer(e, b.ex, b.ey, 1, dt, true);
          if (rem < 0.3) e.pose = 'catch';
          return;
        }
      }
      if (this.play.type === 'run' && this.t > e.recogT && car) { this.pursue(e, car, dt); return; }
      const a = e.asg;
      if (car === qb && qb && qb.x > this.los + 0.5) { this.pursue(e, qb, dt); return; }
      switch (a.type) {
        case 'rush': {
          if (!qb) return;
          const tgt = car || qb;
          let tx = tgt.x, ty = tgt.y;
          if (e.role === 'DL' && Math.abs(e.y - this.ballY) > 3 && dist(e, tgt) > 3) ty += (e.y > tgt.y ? 1.5 : -1.5);
          this.steer(e, tx, ty, 1, dt, true);
          break;
        }
        case 'man': {
          const r = a.target;
          if (!r) break;
          const lag = Math.max(0.06, 0.32 - e.r.mcv * 0.0024 - (this.hasPerkFor(e, 'lockdown') ? 0.05 : 0)) + r.cutLag;
          const hp = this.posAt(r, lag);
          const deep = r.x - this.los;
          const cushion = e.press ? 0.4 : U.clamp(3.2 - this.t * 1.4, 0.5, 3.2);
          const tx = hp.x + cushion + (deep > 12 ? 0.6 : 0), ty = hp.y + (hp.y > this.ballY ? -0.5 : 0.5);
          this.steer(e, tx, ty, 1, dt, true);
          break;
        }
        case 'zone': {
          const L = { x: a.lx, y: a.ly };
          let tgt = null, best = -1e9;
          for (const r of this.off) {
            if (!ELIG[r.role] || !r.asg || r.asg.type !== 'route') continue;
            const d = Math.hypot(r.x - L.x, r.y - L.y);
            if (d > a.rad * 1.35) continue;
            if (a.deep && r.x < L.x - 7) continue;
            const s = a.deep ? r.x : -d;
            if (s > best) { best = s; tgt = r; }
          }
          let tx = L.x, ty = L.y;
          if (tgt) {
            const lag = 0.36 - e.r.zcv * 0.0025;
            const hp = this.posAt(tgt, lag);
            if (a.deep) { tx = Math.max(L.x - 2, hp.x + 2.5); ty = U.lerp(L.y, hp.y, 0.7); }
            else { tx = hp.x + 0.6; ty = U.lerp(hp.y, qb ? qb.y : this.ballY, 0.12); }
            const dx = tx - L.x, dy = ty - L.y, dd = Math.hypot(dx, dy), lim = a.rad * 1.5;
            if (dd > lim) { tx = L.x + dx / dd * lim; ty = L.y + dy / dd * lim; }
          } else if (qb) ty = U.lerp(L.y, qb.y, 0.15);
          // play-action makes underneath defenders bite
          if (this.play.pa && this.t < 0.6 && !a.deep) { tx = e.sx - 1.2; ty = e.sy; }
          this.steer(e, tx, ty, a.deep ? 1 : 0.92, dt);
          break;
        }
        default: this.accelTo(e, 0, 0, dt);
      }
    }
    blockForDef(e, car, dt) {
      // after a turnover, defenders escort the returner
      let tgt = null, bd = 8;
      for (const o of this.off) {
        if (o.st === 'engaged' || o.st === 'down') continue;
        const dd = dist(o, car); if (dd < bd) { bd = dd; tgt = o; }
      }
      if (tgt) { this.steer(e, U.lerp(tgt.x, car.x, 0.3), U.lerp(tgt.y, car.y, 0.3), 1, dt, true); if (dist(e, tgt) < 1 && !tgt.eng && tgt !== this.ctrl) this.engage(e, tgt, 'run'); }
      else this.steer(e, car.x - 3, car.y, 0.8, dt);
    }
    pursue(e, car, dt) {
      const d = dist(e, car);
      const lead = U.clamp(d / (e.maxSpd * 1.4), 0, 1.0) * (0.5 + e.r.pur * 0.006);
      let tx = car.x + car.vx * lead, ty = car.y + car.vy * lead;
      this.steer(e, tx, ty, 1, dt, true);
    }

    // ------------------------------------------------------------ blocking
    engage(b, d, kind) {
      if (b.eng || d.eng || d.st === 'down' || b.st === 'down') return;
      if (d === this.carrier()) return;
      b.eng = d; d.eng = b; b.st = 'engaged'; d.st = 'engaged';
      const bp = (kind === 'pass' ? b.r.pbk : b.r.rbk) + b.r.str * 0.35;
      const dp = (kind === 'pass' ? d.r.prs : d.r.bsh) + d.r.str * 0.35;
      const ratio = bp / Math.max(30, dp);
      let T = kind === 'pass' ? U.clamp(3.0 * Math.pow(ratio, 3) * U.rnd(0.6, 1.4), 0.45, 8) : U.clamp(1.5 * Math.pow(ratio, 3) * U.rnd(0.6, 1.5), 0.3, 5);
      if (b.role === 'WR' || b.role === 'RB') T *= 0.6;
      if (this.hasPerkFor(d, 'blitzer')) T *= 0.6;
      d.engT = T; b.engT = T; b.engKind = kind; d.engKind = kind;
      d.engPow = dp - bp;
    }
    release(d, beaten) {
      const b = d.eng;
      if (b) { b.eng = null; b.st = 'ok'; if (beaten) { b.stunT = 0.45; b.st = 'stun'; } }
      d.eng = null; d.st = 'ok';
    }
    engagedThink(e, dt) {
      const partner = e.eng;
      if (!partner || partner.eng !== e) { e.eng = null; e.st = 'ok'; return; }
      if (e.side === 'off') { return; } // blocker moves with the defender (handled by defender)
      const d = e, b = partner;
      const car = this.carrier();
      const goal = car && car.side === 'off' ? car : this.qb;
      if (!goal) { this.release(d); return; }
      const gx = goal.x - d.x, gy = goal.y - d.y, g = Math.hypot(gx, gy) || 1;
      let push;
      if (d.engKind === 'pass') push = U.clamp(0.5 + d.engPow * 0.03, 0.1, 1.6);
      else push = U.clamp(0.3 + d.engPow * 0.03, -1.2, 1.0);
      d.vx = gx / g * push; d.vy = gy / g * push;
      if (d.engKind === 'run' && push < 0) { d.vx = Math.abs(push); d.vy = 0; }
      b.vx = d.vx; b.vy = d.vy;
      b.x = U.lerp(b.x, d.x - gx / g * 0.85, 0.3); b.y = U.lerp(b.y, d.y - gy / g * 0.85, 0.3);
      d.engT -= dt;
      const passBy = car && car.side === 'off' && car !== this.qb && dist(car, d) < 1.3;
      if (passBy && Math.random() < dt * 3) { this.release(d, false); return; }
      if (d.engT <= 0) { this.release(d, true); if (d.isUser) this.pop('SHED!', d.x, d.y, '#7df'); }
    }

    // ------------------------------------------------------------ physics
    integrate(dt) {
      for (const e of this.ents) {
        if (e.st === 'down') { e.vx = 0; e.vy = 0; continue; }
        e.x += e.vx * dt; e.y += e.vy * dt;
        const sp = Math.hypot(e.vx, e.vy);
        e.anim += sp * dt * 0.55;
        if (e.vx > 0.4) e.face = 1; else if (e.vx < -0.4) e.face = -1;
        e.histT = (e.histT || 0) + dt;
        if (e.histT >= 0.05) { e.histT = 0; e.hist.push({ x: e.x, y: e.y }); if (e.hist.length > 24) e.hist.shift(); }
      }
      // separation
      const n = this.ents.length;
      for (let i = 0; i < n; i++) {
        const a = this.ents[i];
        if (a.st === 'down') continue;
        for (let j = i + 1; j < n; j++) {
          const b = this.ents[j];
          if (b.st === 'down' || a.eng === b) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 < 0.49 && d2 > 1e-6) {
            const d = Math.sqrt(d2), push = (0.7 - d) / 2;
            const nx = dx / d, ny = dy / d;
            a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          }
        }
      }
    }

    checkTackles(dt) {
      const c = this.carrier();
      if (!c || c.st === 'down') return;
      if (c.role === 'QB' && this.phase === 'dev' && this.pendingThrow && this.t < this.pendingThrow.at - 0.03 && false) return;
      for (const d of this.defendersOf(c.side)) {
        if (d.st === 'down' || d.stunT > 0 || d.tCD > 0) continue;
        const engaged = d.st === 'engaged';
        const reach = d.lunge ? 1.45 : 0.85;
        const dd = dist(d, c);
        if (dd > reach) continue;
        if (engaged && Math.random() > 0.2) continue;
        d.tCD = 0.9;
        // tackle probability
        let p = 0.6 + (d.r.tak - 60) * 0.008;
        const elusive = c.r.btk * (this.catcher === c && this.hasPerkFor(c, 'yac') ? 1.12 : 1) * (this.hasPerkFor(c, 'bruiser') ? 1.08 : 1);
        p -= (elusive - 60) * 0.0055;
        if (c.jukeT > 0 && Math.abs(d.y - c.y) < 1.5) p *= 0.22 + (100 - c.r.jkm) * 0.0045 * (this.hasPerkFor(c, 'jukebox') ? 0.6 : 1);
        if (c.stiffT > 0 && (d.x - c.x) * (c.side === 'off' ? 1 : -1) > -0.2) p *= 0.3 + (100 - c.r.stf) * 0.005 * (this.hasPerkFor(c, 'bruiser') ? 0.6 : 1);
        if (c.spinT > 0) p *= 0.35 + (100 - c.r.spm) * 0.005;
        if (engaged) p *= 0.5;
        if (d.lunge) p += 0.12;
        if (this.hasPerkFor(d, 'enforcer')) p += 0.06;
        if (this.hasPerkFor(d, 'clutch') && this.o.q >= 4) p += 0.04;
        // gang tackling
        let helpers = 0;
        for (const h of this.defendersOf(c.side)) if (h !== d && h.st !== 'down' && h.st !== 'engaged' && dist(h, c) < 1.3) helpers++;
        p += helpers * 0.2;
        if (c === this.ctrl && c.side === this.o.userSide) p *= this.diff.tackle;
        if (d === this.ctrl) p *= 1 / Math.max(0.75, this.diff.tackle) * 1.0;
        if (c.role === 'QB' && this.phase === 'dev') p = Math.min(0.97, p + 0.12 - (this.hasPerkFor(c, 'escape') || this.hasPerkFor(c, 'pocketpresence') ? 0.3 : 0));
        p = U.clamp(p, 0.05, 0.97);
        if (Math.random() < p) { this.tackle(c, d); return; }
        d.stunT = U.rnd(0.6, 1.0); d.st = 'stun';
        c.slowT = 0.22; c.slowMul = 0.72;
        if (d.lunge) { d.lunge = false; d.diveT = 0; d.stunT = 1.0; }
        this.pop(c.jukeT > 0 ? 'ANKLES!' : c.stiffT > 0 ? 'STIFFED!' : 'MISSED TACKLE', c.x, c.y, '#ff0');
        if (c.isUser || c === this.ctrl) this.stats.brokenTackles = (this.stats.brokenTackles || 0) + 1;
        if (PG.Audio) PG.Audio.hit(0.5);
      }
    }

    tackle(c, d) {
      // fumble?
      const hit = d.r.hit * (this.hasPerkFor(d, 'enforcer') ? 1.25 : 1);
      let pf = 0.011 * (1 + (70 - c.r.car) / 35) * (hit / 72);
      if (this.hasPerkFor(c, 'balanced')) pf *= 0.4;
      if (this.o.weather.type === 'rain' || this.o.weather.type === 'snow') pf *= 1.4;
      if (c.role === 'QB' && this.phase === 'dev') pf *= 1.5;
      if (Math.random() < pf && !(c.side === 'off' && c.x >= 110)) {
        this.stat(d, 'ff', 1);
        this.fumbler = c; this.fumbleT = this.t;
        c.hasBall = false; c.st = 'down'; c.downT = 0;
        const b = this.ball;
        b.state = 'loose'; b.holder = null; b.x = c.x; b.y = c.y; b.z = 1; b.vz = 4; b.vx = U.rnd(-3, 3); b.vy = U.rnd(-3, 3);
        this.msg('FUMBLE!', '#ffcc00');
        this.tackler = d;
        if (PG.Audio) PG.Audio.hit(1);
        return;
      }
      c.st = 'down'; c.downT = 0;
      // forward progress
      const dirX = c.side === 'off' ? 1 : -1;
      if (c.r.str > d.r.tak - 5) c.x += dirX * U.rnd(0.2, 0.9);
      this.tackler = d;
      if (PG.Audio) PG.Audio.hit(0.8 + Math.min(1, this.speed(c) / 9) * 0.6);
      this.burst(c.x, c.y, 6, '#6b4');
      this.maybeInjure(c, d);
      this.endCarrierPlay('tackle', c, d);
    }
    maybeInjure(c, d) {
      if (!this.o.injuries) return;
      for (const e of [c, d]) {
        if (!e || !e.isUser) continue;
        let p = 0.0055 * (1.6 - e.r.inj / 100 * 0.9);
        if (this.perks.has('ironman')) p *= 0.5;
        if (this.o.physio) p *= 0.75;
        if (Math.random() < p) { this.injured = e.id; this.msg('INJURY!', '#ff5050', 2); }
      }
    }

    checkBounds() {
      const c = this.carrier();
      if (!c || c.st === 'down') return;
      if (c.y < 0 || c.y > W) { c.y = U.clamp(c.y, 0, W); this.endCarrierPlay('oob', c); return; }
      if (c.side === 'off' && c.x >= 110 && (this.phase === 'run' || c.role !== 'QB')) { this.endCarrierPlay('td', c); return; }
      if (c.side === 'def' && c.x <= 10) { this.endCarrierPlay('td', c); return; }
      if (c.x < 0.3 || c.x > 119.7) { c.x = U.clamp(c.x, 0, 120); this.endCarrierPlay('oob', c); }
    }

    // ------------------------------------------------------------ results
    endCarrierPlay(how, c, tackler) {
      if (this.state !== 'live') return;
      c = c || this.carrier();
      if (!c) { this.finish({ kind: 'run', yards: 0, desc: 'Play blown dead.' }); return; }
      const dirX = c.side === 'off' ? 1 : -1;
      const tk = tackler || this.tackler;
      const res = { events: [] };
      const spot = c.x;
      if (c.side === 'def') {
        // turnover return
        const tX = this.turnX != null ? this.turnX : spot;
        res.kind = this.turnover === 'fumble' && this.passer == null ? 'run' : 'pass';
        res.turnover = this.turnover || 'fumble';
        res.yards = Math.round(Math.min(tX, 110) - this.los);
        res.retYards = Math.max(0, Math.round(tX - Math.max(spot, 0)));
        if (res.turnover === 'fumble' && this.fumbler && this.fumbler.side === 'off') this.creditGain(this.fumbler, Math.round(Math.min(tX, 110) - this.los));
        if (how === 'td' || spot <= 10) { res.defTD = true; this.stat(c, 'dTD', 1); this.msg('PICK SIX!', '#ff5050', 2.2); this.celebrate(c); }
        else if (tk && how === 'tackle') this.stat(tk, 'tkl', 1);
        if (res.turnover === 'int' && tX >= 110 && spot >= 110) { res.retYards = 0; }
        res.desc = `${res.turnover === 'int' ? 'INTERCEPTED' : 'FUMBLE recovered'} by ${Pl.name(c.p)}` + (res.defTD ? ', returned for a TOUCHDOWN!' : `, returned ${res.retYards} yards.`);
        this.finish(res);
        return;
      }
      let yards = Math.round(spot - this.los);
      if (how === 'td') yards = 110 - this.los;
      yards = Math.min(yards, 110 - this.los);
      res.yards = yards;
      const isSack = c.role === 'QB' && !this.scrambled && this.phase === 'dev' && this.play.type !== 'run';
      if (this.turnover === 'fumble' && how === 'recover') {
        res.turnover = 'fumble'; res.retYards = 0; res.yards = Math.round(this.turnX - this.los);
        res.kind = this.catcher ? 'pass' : 'run';
        res.desc = `${Pl.name(this.fumbler.p)} FUMBLES! Recovered by the defense.`;
        this.creditGain(this.fumbler, Math.round(this.turnX - this.los));
        this.finish(res);
        return;
      }
      if (isSack) {
        res.kind = 'sack'; res.sack = true;
        this.stat(c, 'sacked', 1);
        if (tk) { this.stat(tk, 'sck', 1); this.stat(tk, 'tkl', 1); }
        res.desc = `${Pl.name(c.p)} SACKED${tk ? ' by ' + Pl.name(tk.p) : ''} for ${-yards} yard${yards === -1 ? '' : 's'}.`;
        this.msg('SACKED!', '#ff8080');
        if (how === 'oob') res.oob = true;
        if (spot <= 10) res.safety = true;
        this.finish(res);
        return;
      }
      res.kind = this.catcher ? 'pass' : this.scrambled ? 'scramble' : 'run';
      if (this.catcher) res.complete = true;
      this.creditGain(c, yards);
      if (how === 'td') {
        res.td = true;
        this.msg('TOUCHDOWN!', '#ffd700', 2.4);
        this.celebrate(c);
        if (PG.Audio) PG.Audio.td();
        if (c.isUser || this.ctrl === c) this.stats.bigPlay++;
      } else {
        if (tk && how === 'tackle') this.stat(tk, 'tkl', 1);
        if (how === 'oob') { res.oob = true; this.msg('OUT OF BOUNDS', '#ddd', 1); }
        if (spot <= 10 && how !== 'oob') res.safety = true;
        if (yards >= 20 && (c.isUser || this.ctrl === c)) this.stats.bigPlay++;
        if (spot >= this.ltg && !res.safety) this.msg('FIRST DOWN', '#ffe066', 1.3);
      }
      const who = this.catcher ? `${Pl.name(this.passer.p)} pass to ${Pl.name(c.p)}` : `${Pl.name(c.p)} ${this.scrambled ? 'scrambles' : 'runs'}`;
      res.desc = `${who} for ${yards} yard${Math.abs(yards) === 1 ? '' : 's'}` + (res.td ? '. TOUCHDOWN!' : how === 'oob' ? ', out of bounds.' : tk ? `, tackled by ${Pl.name(tk.p)}.` : '.');
      // holding flags on long runs occasionally
      if (!res.td && this.play.type === 'run' && yards > 8 && Math.random() < 0.035) {
        this.flag = { on: 'off', name: 'Holding', yds: 10 };
      }
      this.finish(res);
    }
    creditGain(c, yards) {
      if (this.catcher) {
        this.stat(this.passer, 'pYds', yards); this.stat(this.passer, 'pLng', yards);
        this.stat(c, 'recYds', yards); this.stat(c, 'recLng', yards);
        if (c.x >= 110) { this.stat(this.passer, 'pTD', 1); this.stat(c, 'recTD', 1); }
      } else {
        this.stat(c, 'rAtt', 1); this.stat(c, 'rYds', yards); this.stat(c, 'rLng', yards);
        if (c.x >= 110) this.stat(c, 'rTD', 1);
      }
    }
    celebrate(c) {
      this.celeb = { e: c, t: 0, id: c.isUser ? (this.o.celebration || 'spike') : U.pick(['spike', 'flex', 'cheer', 'jump']) };
      for (let i = 0; i < 40; i++) this.parts.push({ x: c.x + U.rnd(-3, 3), y: c.y + U.rnd(-3, 3), z: U.rnd(3, 8), vx: U.rnd(-2, 2), vy: U.rnd(-2, 2), vz: U.rnd(0, 3), t: 0, life: U.rnd(1.2, 2.2), col: U.pick(['#ffd700', '#ff4d4d', '#4dd2ff', '#fff', this.o.offTeam.c1, this.o.offTeam.c2]), confetti: true });
    }
    finish(res) {
      if (this.state !== 'live') return;
      this.state = 'dead'; this.deadT = 0;
      res.events = this.ev;
      res.time = U.clamp(Math.round(this.t), 2, 15);
      if (this.flag) {
        res.penalty = this.flag;
        res.desc = `FLAG: ${this.flag.name} on the ${this.flag.on === 'off' ? 'offense' : 'defense'}. ` + (res.desc || '');
        this.msg('FLAG!', '#ffd700', 1.6);
        if (this.flag.on === 'off' || this.flag.spot) res.events = [];
      }
      res.injured = this.injured || null;
      res.stats = this.stats;
      res.userTouched = this.userTouched;
      this.result = res;
      for (const e of this.ents) if (e.st === 'engaged') { e.st = 'ok'; e.eng = null; }
      if (PG.Audio) PG.Audio.whistle();
    }

    updateDead(dt, evs) {
      this.deadT += dt;
      this.timeScale = 1;
      // everyone slows down; teammates celebrate
      for (const e of this.ents) {
        if (e.st === 'down') { e.downT = (e.downT || 0) + dt; continue; }
        e.vx *= 0.9; e.vy *= 0.9;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.anim += Math.hypot(e.vx, e.vy) * dt * 0.5;
      }
      this.updateBall(dt);
      if (this.celeb) this.updateCeleb(dt);
      const minT = this.celeb ? 2.4 : 1.5;
      let skip = false;
      for (const ev of evs) if ((ev.type === 'tap' || ev.type === 'release') && this.deadT > 0.6) skip = true;
      if ((this.deadT > minT || skip) && !this.ended) {
        this.ended = true;
        if (this.o.onEnd) this.o.onEnd(this.result);
      }
    }
    updateCeleb(dt) {
      const c = this.celeb, e = c.e;
      c.t += dt;
      e.st = 'ok';
      const ph = Math.floor(c.t * 6) % 2;
      switch (c.id) {
        case 'spike': e.pose = c.t < 0.35 ? 'throw' : 'cheer'; if (c.t > 0.35 && !c.spiked) { c.spiked = true; this.ball.state = 'ground'; this.ball.holder = null; e.hasBall = false; this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 6; this.ball.z = 1; } break;
        case 'flex': e.pose = 'flex'; break;
        case 'shimmy': e.pose = ph ? 'cheer' : 'idle'; e.x += (ph ? 1 : -1) * dt * 2; break;
        case 'bow': e.pose = 'release'; e.lowerPose = c.t > 0.4 ? 'squat' : null; break;
        case 'salute': e.pose = 'release'; break;
        case 'jump': e.pose = 'cheer'; e.jumpZ = Math.abs(Math.sin(c.t * 7)) * 1.2; break;
        case 'spin': e.face = ph ? 1 : -1; e.pose = 'cheer'; break;
        case 'robot': e.pose = ph ? 'block' : 'idle'; break;
        case 'worm': e.st = ph ? 'down' : 'ok'; e.downT = 1; break;
        default: e.pose = 'cheer';
      }
      // teammates come over
      for (const o of (e.side === 'off' ? this.off : this.def)) {
        if (o === e || o.st === 'down' || dist(o, e) > 14) continue;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
        if (d > 1.6) { o.vx = dx / d * 4; o.vy = dy / d * 4; }
        else if (Math.random() < dt * 2) o.pose = 'cheer';
      }
    }

    // ------------------------------------------------------------ effects
    burst(x, y, n, col) {
      for (let i = 0; i < n; i++) this.parts.push({ x, y, z: 0.3, vx: U.rnd(-3, 3), vy: U.rnd(-3, 3), vz: U.rnd(2, 5), t: 0, life: 0.5, col: col || '#6b4' });
    }
    updateFx(dt) {
      for (const p of this.parts) {
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.confetti) { p.vz = -1.2; p.z = Math.max(0, p.z + p.vz * dt); p.vx += Math.sin(p.t * 6) * dt * 3; }
        else { p.vz -= 18 * dt; p.z = Math.max(0, p.z + p.vz * dt); }
      }
      this.parts = this.parts.filter((p) => p.t < p.life);
      for (const m of this.msgs) m.t += dt;
      this.msgs = this.msgs.filter((m) => m.t < m.dur);
      for (const p of this.pops) p.t += dt;
      this.pops = this.pops.filter((p) => p.t < 0.9);
      // weather particles
      const w = this.o.weather;
      if (w && (w.type === 'rain' || w.type === 'snow') && !w.dome) {
        this.wx = this.wx || [];
        const want = w.type === 'rain' ? 90 : 70;
        while (this.wx.length < want) this.wx.push({ x: Math.random(), y: Math.random(), s: U.rnd(0.6, 1.4) });
        for (const p of this.wx) {
          p.y += dt * (w.type === 'rain' ? 1.6 : 0.25) * p.s;
          p.x += dt * ((w.windDir || 1) * (w.wind || 0) * 0.004 + (w.type === 'snow' ? Math.sin(p.y * 10) * 0.02 : 0.05));
          if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
          if (p.x > 1) p.x -= 1; if (p.x < 0) p.x += 1;
        }
      }
    }

    updateCam(dt) {
      const vw = this.vw / this.ppy, vh = this.vh / (this.ppy * E.YS);
      let fx, fy;
      const b = this.ball;
      const c = this.carrier();
      if (this.state === 'pre') { fx = this.los + 10; fy = this.ballY; }
      else if (b.state === 'air') { fx = U.lerp(b.x, b.ex, 0.5) + 4; fy = U.lerp(b.y, b.ey, 0.4); }
      else if (c && (this.phase === 'run' || c.role !== 'QB')) { fx = c.x + c.vx * 0.5 + (c.side === 'off' ? 6 : -6); fy = c.y; }
      else if (this.qb) { fx = this.qb.x + 13; fy = U.lerp(this.qb.y, this.ballY, 0.5); }
      else { fx = this.los; fy = this.ballY; }
      if (this.ctrl && this.ctrl.side === 'def' && this.state === 'live' && b.state !== 'air' && !c) { fx = (this.ctrl.x + this.los) / 2 + 4; }
      if (this.ctrl && this.ctrl.side === 'off' && this.ctrl !== this.qb && this.phase === 'dev' && this.ctrl.asg && this.ctrl.asg.type === 'route') {
        fx = Math.max(fx, this.ctrl.x - vw * 0.25); fy = U.lerp(fy, this.ctrl.y, 0.6);
      }
      let tx = fx - vw * 0.45, ty = fy - vh * 0.5;
      tx = U.clamp(tx, -5, 125 - vw);
      ty = U.clamp(ty, -9, W + 9 - vh);
      if (this.snapCam) { this.cam.x = tx; this.cam.y = ty; this.snapCam = false; }
      const k = 1 - Math.pow(0.02, dt);
      this.cam.x = U.lerp(this.cam.x, tx, k); this.cam.y = U.lerp(this.cam.y, ty, k);
    }

    // ------------------------------------------------------------ rendering
    setView(w, h) {
      this.vw = w; this.vh = h;
      this.ppy = U.clamp(w / 55, 6, 8.6);
    }
    S(x, y, z) { return [Math.round((x - this.cam.x) * this.ppy), Math.round((y - this.cam.y) * this.ppy * E.YS - (z || 0) * E.ZS * this.ppy)]; }

    render(ctx) {
      const o = this.o;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#1a1c22'; ctx.fillRect(0, 0, this.vw, this.vh);
      const left = o.offTeam, right = o.defTeam;
      const home = o.offHome ? o.offTeam : o.defTeam, away = o.offHome ? o.defTeam : o.offTeam;
      Fd.draw(ctx, this.ppy, E.YS, this.cam, { left, right, home, away, weather: o.weather && !o.weather.dome ? o.weather.type : 'clear' });
      // line of scrimmage & line to gain
      const [lx] = this.S(this.los, 0), [, y0] = this.S(0, 0), [, y1] = this.S(0, W);
      ctx.fillStyle = '#3b7dff'; ctx.fillRect(lx, y0, 1, y1 - y0);
      if (this.ltg < 110 && !o.twoPt) { const [gx] = this.S(this.ltg, 0); ctx.fillStyle = '#ffe14d'; ctx.fillRect(gx, y0, 1, y1 - y0); }
      if (this.state === 'pre' || (this.state === 'live' && this.phase === 'dev' && this.t < 0.9)) this.drawRoutes(ctx);
      // goal posts behind players at far end
      // shadows
      for (const e of this.ents) {
        const [sx, sy] = this.S(e.x, e.y);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(sx - 4, sy - 1, 8, 2);
      }
      // ball shadow
      const b = this.ball;
      if (b.state !== 'held') { const [bx, by] = this.S(b.x, b.y); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx - 1, by - 1, 3, 1); }
      // landing reticle
      if (b.state === 'air' && (this.ctrl && (this.ctrl.side === 'def' || b.target === this.ctrl || this.ctrl === this.qb))) {
        const [rx, ry] = this.S(b.ex, b.ey);
        const pulse = Math.floor(this.t * 8) % 2;
        ctx.strokeStyle = pulse ? '#ffffff' : '#ffe14d'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(rx + 0.5, ry + 0.5, 5, 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // pressure ring (pocket presence)
      if (this.ctrl === this.qb && this.qb && this.perks.has('pocketpresence') && this.phase === 'dev' && this.pressure(this.qb) < 3) {
        const [qx, qy] = this.S(this.qb.x, this.qb.y);
        ctx.strokeStyle = '#ff4040'; ctx.beginPath(); ctx.ellipse(qx + 0.5, qy - 6, 9, 9, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // entities sorted by depth
      const list = this.ents.slice().sort((a, b2) => a.y - b2.y);
      for (const e of list) this.drawEnt(ctx, e);
      // goal posts
      for (const gx of [0, 120]) { const [px] = this.S(gx, 0); if (px > -40 && px < this.vw + 40) Fd.drawPosts(ctx, this.ppy, E.YS, E.ZS, this.cam, gx); }
      // ball in flight
      if (b.state !== 'held') this.drawBall(ctx, b.x, b.y, b.z);
      // particles
      for (const p of this.parts) {
        const [px, py] = this.S(p.x, p.y, p.z);
        ctx.fillStyle = p.col; ctx.fillRect(px, py, p.confetti ? 2 : 1, p.confetti ? 1 : 1);
      }
      // aim preview for user QB
      if (this.mode === 'qb' && this.ctrl && this.state === 'live') this.drawAim(ctx);
      this.drawWeather(ctx);
      if (o.weather && o.weather.night) { ctx.fillStyle = 'rgba(10,15,45,0.22)'; ctx.fillRect(0, 0, this.vw, this.vh); }
      // pops
      for (const p of this.pops) {
        const [px, py] = this.S(p.x, p.y, 2.6 + p.t * 2);
        F.draw(ctx, p.text, px, py - 6, { align: 'center', color: p.color });
      }
      this.drawHUD(ctx);
    }

    drawRoutes(ctx) {
      const show = this.settings.showRoutes !== false;
      const u = this.ctrl;
      const isQB = u && u === this.qb;
      for (const e of this.off) {
        if (!e.asg) continue;
        const mine = e === u;
        if (!mine && !(isQB && show)) continue;
        let pts = null;
        if (e.asg.type === 'route') pts = e.asg.pts;
        else if (e.asg.type === 'carry' && e.asg.path) pts = e.asg.path;
        if (!pts) continue;
        const primary = this.play.prog && this.play.prog[0] === e.slot;
        ctx.fillStyle = mine ? '#ffe14d' : primary ? '#ffb347' : 'rgba(255,255,255,0.75)';
        let prev = { x: e.x, y: e.y };
        let cnt = 0;
        for (const p of pts) {
          let tx = p.x, ty = p.y;
          const segLen = Math.hypot(tx - prev.x, ty - prev.y);
          const cap = Math.min(segLen, 14);
          tx = prev.x + (tx - prev.x) / (segLen || 1) * cap; ty = prev.y + (ty - prev.y) / (segLen || 1) * cap;
          const steps = Math.ceil(cap * 2);
          for (let i = 0; i < steps; i++) {
            const f = i / steps;
            if ((cnt++) % 2) continue;
            const [sx, sy] = this.S(U.lerp(prev.x, tx, f), U.lerp(prev.y, ty, f));
            ctx.fillRect(sx, sy, 1, 1);
          }
          prev = { x: tx, y: ty };
        }
        const [ax, ay] = this.S(prev.x, prev.y);
        ctx.fillRect(ax - 1, ay - 1, 3, 3);
        if (mine && e.asg.name) F.draw(ctx, e.asg.name, ax + 4, ay - 3, { color: '#ffe14d' });
      }
      // field general: show coverage & blitzers
      if (isQB && this.perks.has('fieldgeneral') && this.state === 'pre') {
        for (const d of this.def) if (d.asg.type === 'rush' && d.role !== 'DL') { const [sx, sy] = this.S(d.x, d.y, 3); F.draw(ctx, '!', sx, sy - 6, { color: '#ff4040', align: 'center' }); }
      }
    }

    drawEnt(ctx, e) {
      const [sx, sy] = this.S(e.x, e.y, e.jumpZ || 0);
      const fr = Sp.frame(e, this.t);
      let flip = e.face < 0;
      if (e.spinAnim && e.spinT > 0) flip = Math.floor(e.spinT * 16) % 2 === 0;
      const img = Sp.get(e.pal, fr.upper, fr.lower, flip);
      if (e.st === 'down') {
        ctx.save();
        ctx.translate(sx, sy - 3);
        ctx.rotate((e.face > 0 ? -1 : 1) * Math.PI / 2);
        ctx.drawImage(img, -Sp.W / 2, -Sp.H / 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx - Sp.W / 2, sy - Sp.H + 1);
      }
      if (e.stunT > 0 && e.st !== 'down') {
        const k = Math.floor(this.t * 10) % 3;
        ctx.fillStyle = '#ffe14d'; ctx.fillRect(sx - 3 + k * 2, sy - Sp.H - 2, 1, 1);
      }
      if (e === this.ctrl || e === this.userEnt) {
        const bob = Math.floor((this.t + this.preT) * 4) % 2;
        const col = e === this.ctrl ? '#ffe14d' : '#9fe0ff';
        ctx.fillStyle = col;
        const ty = sy - Sp.H - 5 - bob;
        ctx.fillRect(sx - 2, ty, 5, 1); ctx.fillRect(sx - 1, ty + 1, 3, 1); ctx.fillRect(sx, ty + 2, 1, 1);
        if (e === this.ctrl && e.stamina < 0.98 && this.state === 'live') {
          ctx.fillStyle = '#000'; ctx.fillRect(sx - 6, sy + 2, 12, 2);
          ctx.fillStyle = e.stamina > 0.35 ? '#5f5' : '#f55'; ctx.fillRect(sx - 6, sy + 2, Math.round(12 * e.stamina), 2);
        }
      }
    }

    drawBall(ctx, x, y, z) {
      const [bx, by] = this.S(x, y, z);
      ctx.fillStyle = '#7a3f17'; ctx.fillRect(bx - 1, by - 1, 3, 2);
      ctx.fillStyle = '#5a2d0f'; ctx.fillRect(bx + (Math.floor(this.ball.spin) % 2 ? 1 : -1), by, 1, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, by - 1, 1, 1);
    }

    drawAim(ctx) {
      const c = this.ctrl;
      const tgt = this.aimTarget(c);
      if (!tgt) return;
      const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
      const apex = d < 8 ? 0.6 : d < 18 ? 1.4 + (d - 8) * 0.1 : 2.4 + (d - 18) * 0.17;
      ctx.fillStyle = '#ffffff';
      for (let i = 1; i < 16; i++) {
        const f = i / 16;
        const x = U.lerp(c.x, tgt.x, f), y = U.lerp(c.y, tgt.y, f), z = U.lerp(2, 1.15, f) + 4 * apex * f * (1 - f);
        const [sx, sy] = this.S(x, y, z);
        ctx.fillRect(sx, sy, 1, 1);
      }
      const [rx, ry] = this.S(tgt.x, tgt.y);
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(rx + 0.5, ry + 0.5, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(rx, ry, 1, 1);
      F.draw(ctx, Math.round(tgt.x - this.los) + ' YD', rx + 8, ry - 4, { color: '#fff' });
    }

    drawWeather(ctx) {
      const w = this.o.weather;
      if (!w || !this.wx || w.dome) return;
      ctx.fillStyle = w.type === 'rain' ? 'rgba(170,200,255,0.55)' : 'rgba(255,255,255,0.9)';
      for (const p of this.wx) {
        const x = Math.floor(p.x * this.vw), y = Math.floor(p.y * this.vh);
        if (w.type === 'rain') ctx.fillRect(x, y, 1, 3); else ctx.fillRect(x, y, p.s > 1.1 ? 2 : 1, p.s > 1.1 ? 2 : 1);
      }
    }

    drawHUD(ctx) {
      const o = this.o, h = o.hud || {};
      const W2 = this.vw, H2 = this.vh;
      // scoreboard
      const bw = 168, bx = Math.round(W2 / 2 - bw / 2);
      ctx.fillStyle = 'rgba(10,12,20,0.85)'; ctx.fillRect(bx, 2, bw, 11);
      ctx.fillStyle = h.awayC1 || '#444'; ctx.fillRect(bx, 2, 3, 11);
      ctx.fillStyle = h.homeC1 || '#444'; ctx.fillRect(bx + bw - 3, 2, 3, 11);
      F.draw(ctx, `${h.away || 'AWY'} ${h.as != null ? h.as : 0}`, bx + 6, 4, { color: h.possHome === false ? '#ffe14d' : '#fff' });
      F.draw(ctx, `${h.home || 'HOM'} ${h.hs != null ? h.hs : 0}`, bx + bw - 6, 4, { color: h.possHome ? '#ffe14d' : '#fff', align: 'right' });
      const clock = Math.max(0, (h.clock || 0) - (this.state === 'live' || this.state === 'dead' ? this.t : 0));
      F.draw(ctx, `${h.qStr || 'Q1'} ${U.clockStr(clock)}`, W2 / 2, 4, { align: 'center', color: '#9fe0ff' });
      const sit = o.twoPt ? '2-PT TRY' : `${h.sit || ''} · ${h.spot || ''}`;
      ctx.fillStyle = 'rgba(10,12,20,0.7)';
      const sw = F.width(sit) + 8;
      ctx.fillRect(Math.round(W2 / 2 - sw / 2), 14, sw, 9);
      F.draw(ctx, sit, W2 / 2, 15, { align: 'center', color: '#ffe14d' });
      // pause button
      ctx.fillStyle = 'rgba(10,12,20,0.75)'; ctx.fillRect(W2 - 20, 2, 18, 13);
      ctx.fillStyle = '#fff'; ctx.fillRect(W2 - 14, 5, 2, 7); ctx.fillRect(W2 - 9, 5, 2, 7);
      // play name
      if (this.state === 'pre') {
        const nm = this.play.name.toUpperCase();
        F.draw(ctx, nm, 4, 4, { color: '#fff' });
        if (this.ctrl && this.ctrl.side === 'off' && this.ctrl.asg && this.ctrl.asg.name && this.ctrl !== this.qb) F.draw(ctx, 'ROUTE: ' + this.ctrl.asg.name.toUpperCase(), 4, 13, { color: '#ffe14d' });
        if (this.ctrl && this.ctrl.side === 'def') {
          const a = this.ctrl.asg;
          const job = a.type === 'man' ? 'MAN: ' + (a.target ? '#' + a.target.num : '') : a.type === 'rush' ? 'BLITZ!' : 'ZONE: ' + (a.zone || '').toUpperCase();
          F.draw(ctx, this.coverName.toUpperCase(), 4, 13, { color: '#9fe0ff' });
          F.draw(ctx, job, 4, 22, { color: '#ffe14d' });
        }
        if (this.ctrl === this.qb && this.perks.has('fieldgeneral')) F.draw(ctx, 'D: ' + this.coverName.toUpperCase(), 4, 13, { color: '#9fe0ff' });
        if (Math.floor(this.preT * 2) % 2 === 0) F.draw(ctx, 'TAP RIGHT SIDE TO SNAP', W2 * 0.73, H2 - 22, { align: 'center', color: '#fff' });
      }
      // controls
      this.drawControls(ctx);
      // skill check ring
      if (this.sc) this.drawSkill(ctx);
      // big messages
      let my = Math.round(H2 * 0.36);
      for (const m of this.msgs) {
        const s = m.text.length > 12 ? 2 : 3;
        const a = m.t < 0.15 ? m.t / 0.15 : 1;
        if (a < 1 && Math.floor(m.t * 30) % 2) continue;
        F.draw(ctx, m.text, W2 / 2, my, { align: 'center', scale: s, color: m.color, shadow: '#000' });
        my += 8 * s + 2;
      }
    }

    drawControls(ctx) {
      const H2 = this.vh, W2 = this.vw;
      const j = I.joy;
      const R = I.R;
      const cx = j.active ? j.ox : 36, cy = j.active ? j.oy : H2 - 36;
      ctx.globalAlpha = j.active ? 0.55 : 0.22;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx + 0.5, cy + 0.5, R, 0, Math.PI * 2); ctx.stroke();
      const st = I.stick();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + st.x * R * 0.8, cy + st.y * R * 0.8, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (!j.active && this.state !== 'dead') F.draw(ctx, 'MOVE', cx, cy + R + 3, { align: 'center', color: 'rgba(255,255,255,0.5)', shadow: false });
      // right plane hints
      const mode = this.state === 'pre' ? 'pre' : this.mode;
      const hints = { qb: 'DRAG BACK & RELEASE TO THROW', carrier: 'TAP JUKE  SWIPE> STIFF  2xTAP DIVE', route: 'TAP: CALL FOR THE BALL', catch: 'TAP WHEN RINGS MEET!', defend: 'TAP: BURST / DIVE TACKLE', block: 'RUN INTO DEFENDERS TO BLOCK', qbrun: 'HAND OFF...' };
      if (this.state === 'live' && hints[mode] && !this.sc) F.draw(ctx, hints[mode], W2 * 0.73, H2 - 10, { align: 'center', color: 'rgba(255,255,255,0.55)', shadow: false });
      if (mode === 'qb' && this.settings.aimMode === 'push' && this.state === 'live' && !I.drag.active) F.draw(ctx, 'DRAG TOWARD TARGET', W2 * 0.73, H2 - 19, { align: 'center', color: 'rgba(255,255,255,0.4)', shadow: false });
      // drag line
      const d = I.drag;
      if (d.active && mode === 'qb') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.moveTo(d.ox, d.oy); ctx.lineTo(d.x, d.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(d.ox, d.oy, 3, 0, Math.PI * 2); ctx.fill();
        const pw = U.clamp(Math.hypot(d.x - d.ox, d.y - d.oy) / 120, 0, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(d.ox - 12, d.oy + 8, 24, 3);
        ctx.fillStyle = pw > 0.85 ? '#ff6040' : '#ffe14d'; ctx.fillRect(d.ox - 12, d.oy + 8, Math.round(24 * pw), 3);
      }
    }

    drawSkill(ctx) {
      const sc = this.sc;
      const W2 = this.vw, H2 = this.vh;
      const cx = Math.round(W2 * 0.76), cy = Math.round(H2 * 0.58);
      const target = 16;
      const tt = this.t;
      if (tt < sc.start - 0.05 && !sc.tapped) {
        F.draw(ctx, sc.type === 'catch' ? 'GET READY...' : 'BALL IN THE AIR!', cx, cy - 4, { align: 'center', color: '#fff' });
        return;
      }
      const f = U.clamp((sc.end - tt) / sc.ring, 0, 1);
      const r = target + f * 34;
      // target zone
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, target + 36, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      const perfectBand = 0.06 * sc.win * 34 / sc.ring;
      ctx.strokeStyle = '#3cff7a'; ctx.lineWidth = Math.max(2, Math.round(perfectBand * 2));
      ctx.beginPath(); ctx.arc(cx, cy, target, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, target - 3, 0, Math.PI * 2); ctx.stroke();
      if (!sc.tapped) {
        const close = Math.abs(sc.end - tt) < 0.06 * sc.win;
        ctx.strokeStyle = close ? '#3cff7a' : '#ffe14d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      const lbl = sc.type === 'catch' ? 'CATCH' : 'PICK';
      const base = Math.round((sc.base || 0) * 100);
      F.draw(ctx, `${lbl} ${base}%`, cx, cy - 4, { align: 'center', color: '#fff' });
      if (sc.tapped) {
        const col = sc.bonus >= 0.2 ? '#3cff7a' : sc.bonus > 0 ? '#ffe14d' : '#ff6060';
        F.draw(ctx, sc.grade, cx, cy + 6, { align: 'center', color: col });
        F.draw(ctx, (sc.bonus >= 0 ? '+' : '') + Math.round(sc.bonus * 100) + '%', cx, cy + target + 6, { align: 'center', color: col });
      } else F.draw(ctx, 'TAP!', cx, cy + 5, { align: 'center', color: '#ffe14d' });
    }
  }

  // ------------------------------------------------------------ kick visual scene
  class KickScene {
    // o: {kind:'fg'|'xp'|'punt'|'kickoff', fromX, toX, toY, good, offTeam, defTeam, offHome, weather, hud, onEnd, text}
    constructor(o) {
      this.o = o; this.t = 0; this.done = false;
      this.cam = { x: o.fromX - 20, y: W / 2 - 15 };
      this.T = o.kind === 'fg' || o.kind === 'xp' ? 1.5 : 2.4;
      this.ball = { x: o.fromX, y: W / 2, z: 0.4 };
      this.apex = o.kind === 'punt' ? 14 : o.kind === 'kickoff' ? 15 : 8;
      this.endY = o.toY != null ? o.toY : W / 2;
      this.msgT = 0;
    }
    setView(w, h) { this.vw = w; this.vh = h; this.ppy = U.clamp(w / 55, 6, 8.6); }
    update(dt) {
      const evs = I.take();
      this.t += dt;
      const f = Math.min(1, this.t / this.T);
      const o = this.o;
      this.ball.x = U.lerp(o.fromX, o.toX, f);
      this.ball.y = U.lerp(W / 2, this.endY, f);
      this.ball.z = 0.4 + 4 * this.apex * f * (1 - f) * (o.kind === 'fg' || o.kind === 'xp' ? 1 : 1) + (o.kind === 'fg' || o.kind === 'xp' ? f * 5 : 0);
      const fx = o.kind === 'fg' || o.kind === 'xp' ? U.lerp(o.fromX, 120, Math.min(1, f * 1.4)) : this.ball.x;
      const vw = this.vw / this.ppy, vh = this.vh / (this.ppy * E.YS);
      const tx = U.clamp(fx - vw * 0.5, -5, 125 - vw), ty = U.clamp(W / 2 - vh / 2, -9, W + 9 - vh);
      const k = 1 - Math.pow(0.03, dt);
      this.cam.x = U.lerp(this.cam.x, tx, k); this.cam.y = U.lerp(this.cam.y, ty, k);
      if (f >= 1 && !this.resolved) { this.resolved = true; if (PG.Audio) { if (o.good === true) PG.Audio.td(0.5); else if (o.good === false) PG.Audio.boo('boo'); else PG.Audio.thud(); } }
      let skip = false;
      for (const e of evs) if (e.type === 'tap' || e.type === 'release') skip = true;
      if ((this.t > this.T + 1.1 || (skip && this.t > 0.3)) && !this.done) { this.done = true; if (o.onEnd) o.onEnd(); }
    }
    render(ctx) {
      const o = this.o;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#1a1c22'; ctx.fillRect(0, 0, this.vw, this.vh);
      const home = o.offHome ? o.offTeam : o.defTeam, away = o.offHome ? o.defTeam : o.offTeam;
      Fd.draw(ctx, this.ppy, E.YS, this.cam, { left: o.offTeam, right: o.defTeam, home, away, weather: o.weather && !o.weather.dome ? o.weather.type : 'clear' });
      const S = (x, y, z) => [Math.round((x - this.cam.x) * this.ppy), Math.round((y - this.cam.y) * this.ppy * E.YS - (z || 0) * E.ZS * this.ppy)];
      // simple line of players
      const palO = Sp.palette(o.offTeam, o.offHome, {}), palD = Sp.palette(o.defTeam, !o.offHome, {});
      const run = ['run1', 'run2', 'run3', 'run2'][Math.floor(this.t * 9) % 4];
      if (o.kind === 'kickoff') {
        // coverage team sprints downfield, return team sets up its wall
        for (let i = 0; i < 10; i++) {
          const y = 4 + i * 5.05;
          const [ax, ay] = S(o.fromX + Math.min(this.t, 3) * 8.5, y);
          ctx.drawImage(Sp.get(palO, 'idle', run, false), ax - 6, ay - 16);
        }
        const deep = [[12, 10], [12, 20], [12, 33], [12, 43], [22, 16], [22, 37], [30, 26]];
        for (const [dx, y] of deep) {
          const [bx, by] = S(Math.min(118, o.fromX + 30 + dx), y);
          ctx.drawImage(Sp.get(palD, 'block', 'stand', true), bx - 6, by - 16);
        }
      } else {
        const lineX = o.fromX + (o.kind === 'punt' ? 13 : 7);
        for (let i = -5; i <= 5; i++) {
          const y = W / 2 + i * 1.6;
          const [ax, ay] = S(lineX - 0.6, y), [bx, by] = S(lineX + 0.8, y);
          ctx.drawImage(Sp.get(palO, 'block', 'run3', false), ax - 6, ay - 16);
          ctx.drawImage(Sp.get(palD, 'block', 'run3', true), bx - 6, by - 16);
        }
      }
      const [kx, ky] = S(o.fromX - 1.2, W / 2);
      ctx.drawImage(Sp.get(palO, this.t < 0.2 ? 'idle' : 'release', this.t < 0.25 ? 'run1' : 'stand', false), kx - 6, ky - 16);
      for (const gx of [0, 120]) Fd.drawPosts(ctx, this.ppy, E.YS, E.ZS, this.cam, gx);
      const [sx, sy] = S(this.ball.x, this.ball.y, 0); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx - 1, sy - 1, 3, 1);
      const [bx2, by2] = S(this.ball.x, this.ball.y, this.ball.z);
      ctx.fillStyle = '#7a3f17'; ctx.fillRect(bx2 - 1, by2 - 1, 3, 2); ctx.fillStyle = '#fff'; ctx.fillRect(bx2, by2 - 1, 1, 1);
      // HUD text
      const W2 = this.vw;
      ctx.fillStyle = 'rgba(10,12,20,0.8)'; ctx.fillRect(Math.round(W2 / 2 - 90), 3, 180, 11);
      F.draw(ctx, o.title || '', W2 / 2, 5, { align: 'center', color: '#ffe14d' });
      if (this.resolved && o.text) {
        F.draw(ctx, o.text, W2 / 2, Math.round(this.vh * 0.4), { align: 'center', scale: o.text.length > 14 ? 2 : 3, color: o.good === false ? '#ff6060' : '#ffe14d' });
      }
    }
  }

  E.Scene = Scene;
  E.KickScene = KickScene;
  PG.Engine = E;
})();
