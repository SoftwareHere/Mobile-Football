/* Pixel Gridiron - game state machine (downs, clock, scoring) and play-level simulation */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, L = PG.League;
  const other = (s) => (s === 'home' ? 'away' : 'home');

  class GameState {
    constructor(lg, g, opts = {}) {
      this.lg = lg; this.g = g; this.opts = opts;
      this.teams = { home: lg.teams[g.h], away: lg.teams[g.a] };
      this.qLen = (opts.quarterLen || lg.settings.quarterLen) * 60;
      this.q = 1; this.clock = this.qLen;
      this.score = { home: 0, away: 0 };
      this.qs = { home: [0, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] };
      this.to = { home: 3, away: 3 };
      this.down = 1; this.toGo = 10; this.ballOn = 25;
      this.box = {}; this.ts = { home: GameState.blankTS(), away: GameState.blankTS() };
      this.log = []; this.drives = []; this.drive = null;
      this.playoff = !!opts.playoff;
      this.over = false; this.clockRunning = false; this.pendingQEnd = false; this.pendingRunoff = 0;
      this.userPid = opts.userPid || null;
      this.weather = opts.weather || GameState.weatherFor(lg, this.teams.home, lg.week, g.night);
      this.tempo = { home: 'normal', away: 'normal' };
      L.invalidate();
      this.depth = { home: L.depth(lg, this.teams.home), away: L.depth(lg, this.teams.away) };
      this.rat = { home: L.ratings(lg, this.teams.home), away: L.ratings(lg, this.teams.away) };
      // home field advantage
      this.rat.home.passOff += 1; this.rat.home.runOff += 1; this.rat.home.passDef += 1; this.rat.home.runDef += 1;
      const recv = U.chance(0.5) ? 'home' : 'away';
      this.firstRecv = recv;
      this.kickTeam = other(recv);
      this.poss = recv;
      this.phase = 'kickoff';
      this.freeKick = false;
      this.otPoss = { home: 0, away: 0 };
      this.injuries = [];
      this.lastPlay = null;
    }
    static blankTS() { return { fd: 0, yds: 0, pYds: 0, rYds: 0, tov: 0, top: 0, plays: 0, sacks: 0, pen: 0, penYds: 0, thirdA: 0, thirdM: 0 }; }

    static weatherFor(lg, home, week, night) {
      const w = { type: 'clear', wind: 0, temp: 70, night: !!night, dome: !!home.dome };
      if (home.dome) { w.temp = 72; w.wind = 0; return w; }
      const late = U.clamp((week || 1) / Math.max(1, lg.settings.seasonLength), 0, 1.3);
      const c = home.climate;
      let rain = 0.12, snow = 0;
      if (c === 'cold') { rain = 0.14; snow = late > 0.55 ? 0.28 * late : 0; w.temp = Math.round(68 - late * 45 + U.rnd(-6, 6)); }
      else if (c === 'wet') { rain = 0.34; w.temp = Math.round(62 - late * 18 + U.rnd(-5, 5)); }
      else if (c === 'mild') { rain = 0.18; snow = late > 0.8 ? 0.06 : 0; w.temp = Math.round(74 - late * 28 + U.rnd(-6, 6)); }
      else { rain = 0.12; w.temp = Math.round(85 - late * 15 + U.rnd(-5, 5)); }
      const r = Math.random();
      if (r < snow && w.temp < 36) w.type = 'snow';
      else if (r < snow + rain) w.type = 'rain';
      else if (r < snow + rain + 0.12) w.type = 'cloudy';
      w.wind = Math.round(Math.max(0, U.norm(c === 'cold' ? 9 : 6, 6)));
      w.windDir = U.pick([-1, 1]);
      return w;
    }

    get off() { return this.poss; }
    get def() { return other(this.poss); }
    team(side) { return this.teams[side]; }
    sideOf(teamId) { return this.teams.home.id === teamId ? 'home' : 'away'; }
    pl(side, pos, i) { const a = this.depth[side][pos]; return a ? a[Math.min(i, a.length - 1)] || null : null; }
    lineToGain() { return Math.min(100, this.ballOn + this.toGo); }
    diff(side) { return this.score[side] - this.score[other(side)]; }

    stat(pid, k, v) {
      if (!pid) return;
      const b = this.box[pid] || (this.box[pid] = {});
      if (k === 'pLng' || k === 'rLng' || k === 'recLng' || k === 'fgLng') b[k] = Math.max(b[k] || 0, v);
      else b[k] = (b[k] || 0) + v;
    }
    events(evs) { if (evs) for (const e of evs) this.stat(e[0], e[1], e[2]); }

    addLog(text, extra) {
      const e = Object.assign({ q: this.q, clock: this.clock, poss: this.poss, text, hs: this.score.home, as: this.score.away }, extra || {});
      this.log.push(e);
      if (this.drive) this.drive.plays.push(e);
      return e;
    }
    situationStr() {
      const dn = ['1st', '2nd', '3rd', '4th'][this.down - 1] || '4th';
      const tg = this.ballOn + this.toGo >= 100 ? 'Goal' : this.toGo;
      return `${dn} & ${tg}`;
    }
    spotStr(ballOn, side) {
      ballOn = ballOn == null ? this.ballOn : ballOn;
      side = side || this.poss;
      if (ballOn === 50) return '50';
      if (ballOn < 50) return this.teams[side].abbr + ' ' + Math.round(ballOn);
      return this.teams[other(side)].abbr + ' ' + Math.round(100 - ballOn);
    }

    startDrive() {
      this.drive = { team: this.poss, start: this.ballOn, q: this.q, clock: this.clock, plays: [], yards: 0, time: 0, result: '' };
      this.drives.push(this.drive);
      if (this.q >= 5) this.otPoss[this.poss]++;
    }
    endDrive(result) {
      if (this.drive && !this.drive.result) this.drive.result = result;
    }

    changePoss(newBallOn, reason) {
      this.endDrive(reason || 'Turnover');
      this.poss = other(this.poss);
      this.ballOn = U.clamp(Math.round(newBallOn), 1, 99);
      this.down = 1; this.toGo = Math.min(10, 100 - this.ballOn);
      this.clockRunning = false;
      this.phase = 'scrimmage';
      this.checkOTEnd();
      if (!this.over) this.startDrive();
    }

    addScore(side, pts) {
      this.score[side] += pts;
      this.qs[side][Math.min(this.q, 5) - 1] += pts;
    }

    useTime(sec) {
      if (sec <= 0) return;
      this.ts[this.poss].top += sec;
      if (this.drive) this.drive.time += sec;
      this.clock -= sec;
      if (this.clock <= 0) {
        if (this.q === 1 || this.q === 3) {
          // roll over seamlessly between quarters 1-2 and 3-4
          const over = -this.clock;
          this.q++; this.clock = Math.max(1, this.qLen - over);
          this.addLog(`End of quarter ${this.q - 1}.`, { sys: true });
        } else { this.clock = 0; this.pendingQEnd = true; }
      }
    }

    endQuarter() {
      this.pendingQEnd = false;
      this.clockRunning = false;
      if (this.q === 2) {
        this.addLog('Halftime.', { sys: true });
        this.q = 3; this.clock = this.qLen;
        this.to = { home: 3, away: 3 };
        this.endDrive('End of Half');
        this.kickTeam = other(this.firstRecv);
        this.phase = 'kickoff'; this.freeKick = false;
        this.halftime = true;
      } else if (this.q === 4 || this.q >= 5) {
        this.endDrive(this.q >= 5 ? 'End of OT' : 'End of Game');
        if (this.score.home !== this.score.away) { this.finish(); return; }
        if (this.q >= 5 && !this.playoff) { this.finish(); return; }
        if (this.q === 4 && !this.playoff && this.opts.noOT) { this.finish(); return; }
        // overtime
        this.q = this.q === 4 ? 5 : this.q + 1;
        this.clock = Math.min(this.qLen, 600);
        this.to = { home: 2, away: 2 };
        this.otPoss = { home: 0, away: 0 };
        const recv = U.chance(0.5) ? 'home' : 'away';
        this.kickTeam = other(recv);
        this.phase = 'kickoff'; this.freeKick = false;
        this.addLog('Overtime! ' + this.teams[recv].abbr + ' will receive.', { sys: true });
      }
    }

    checkOTEnd() {
      if (this.q < 5 || this.over) return;
      if (this.otPoss.home >= 1 && this.otPoss.away >= 1 && this.score.home !== this.score.away) this.finish();
    }

    finish() {
      this.over = true; this.phase = 'over';
      this.endDrive(this.drive && this.drive.result ? this.drive.result : 'End of Game');
      this.addLog('Final: ' + this.teams.away.abbr + ' ' + this.score.away + ', ' + this.teams.home.abbr + ' ' + this.score.home, { sys: true });
    }

    // ------------- flow -------------
    // returns the next decision point: 'kickoff' | 'pat' | 'play' | 'over'
    prepare() {
      if (this.over) return 'over';
      if (this.pendingQEnd && this.phase !== 'pat') {
        this.endQuarter();
        if (this.over) return 'over';
      }
      if (this.phase === 'kickoff') return 'kickoff';
      if (this.phase === 'pat') return 'pat';
      return 'play';
    }

    computeRunoff(tempo) {
      if (!this.clockRunning) return 0;
      tempo = tempo || this.tempo[this.poss];
      let t = tempo === 'hurry' ? U.rnd(11, 17) : tempo === 'milk' ? U.rnd(38, 42) : U.rnd(29, 37);
      t = Math.round(t);
      if ((this.q === 2 || this.q === 4) && this.clock > 120 && this.clock - t < 120) {
        t = this.clock - 120;
        this.twoMinNext = true;
      }
      const offLeading = this.diff(this.poss) > 0;
      if (t >= this.clock && (this.q === 2 || (this.q === 4 && !offLeading) || this.q >= 5)) t = Math.max(0, this.clock - 1);
      return t;
    }

    // AI timeout logic before snap. returns true if a TO was used.
    aiTimeouts() {
      if (!this.clockRunning || this.pendingRunoff <= 0) return false;
      const late = (this.q === 2 && this.clock < 120) || (this.q === 4 && this.clock < 180) || this.q >= 5;
      if (!late) return false;
      const d = this.def, o = this.off;
      if (this.q === 4 && this.diff(d) < 0 && this.to[d] > 0 && this.isAI(d)) { this.useTO(d); return true; }
      if (this.diff(o) <= 0 && this.to[o] > 0 && this.clock < 60 && this.isAI(o)) { this.useTO(o); return true; }
      return false;
    }
    isAI(side) { return !this.opts.userSide || this.opts.userSide !== side; }
    useTO(side) {
      if (this.to[side] <= 0) return false;
      this.to[side]--;
      this.pendingRunoff = 0;
      this.clockRunning = false;
      this.addLog(`Timeout ${this.teams[side].abbr} (${this.to[side]} left)`, { sys: true });
      return true;
    }

    beginPlay(tempo) {
      this.pendingRunoff = this.computeRunoff(tempo);
      this.aiTimeouts();
    }
    // apply pending runoff before the snap. returns false if the half/game ended.
    snap() {
      const r = this.pendingRunoff; this.pendingRunoff = 0;
      if (r > 0) this.useTime(r);
      if (this.twoMinNext) { this.twoMinNext = false; if (this.clock <= 120 && this.clock > 0) this.addLog('Two-minute warning.', { sys: true }); }
      this.clockRunning = false;
      if (this.pendingQEnd) return false;
      return true;
    }

    // ------------- kicks -------------
    kicker(side) { return this.pl(side, 'K', 0); }
    punter(side) { return this.pl(side, 'P', 0); }
    fgDist() { return 100 - this.ballOn + 17; }
    fgProb(dist, side) {
      const k = this.kicker(side || this.poss);
      const kpw = k ? Pl.attr(k, 'kpw') : 70, kac = k ? Pl.attr(k, 'kac') : 70;
      const maxR = 47 + (kpw - 60) * 0.32;
      let p = 1.06 - 0.00029 * dist * dist * (1.32 - kac / 100);
      if (dist > maxR) p *= Math.max(0, 1 - (dist - maxR) / 6);
      const w = this.weather;
      if (w.type === 'snow') p -= 0.07;
      if (w.type === 'rain') p -= 0.03;
      p -= Math.max(0, w.wind - 10) * 0.005;
      return U.clamp(p, 0, 0.995);
    }

    doKickoff() {
      const kt = this.kickTeam, rt = other(kt);
      this.poss = rt;
      let nb, text;
      const k = this.kicker(kt);
      if (this.freeKick) {
        nb = U.clamp(Math.round(U.norm(38, 7)), 20, 60);
        text = `${this.teams[kt].abbr} free kick. Returned to the ${this.spotStr(nb, rt)}.`;
        this.freeKick = false;
      } else if (U.chance(0.58 + (k ? (Pl.attr(k, 'kpw') - 80) * 0.01 : 0))) {
        nb = 30; text = `${Pl.name(k)} kickoff into the end zone. Touchback.`;
      } else {
        const kr = this.pl(rt, 'WR', 3) || this.pl(rt, 'RB', 1);
        const r = Math.random();
        if (r < 0.012) {
          // return TD
          this.ballOn = 100; this.poss = rt;
          this.addScore(rt, 6);
          if (kr) { this.stat(kr.id, 'krTD', 1); }
          this.drive = null; this.startDrive(); this.endDrive('Kick Return TD');
          this.addLog(`${Pl.name(kr)} takes the kickoff all the way! TOUCHDOWN ${this.teams[rt].abbr}!`, { score: true });
          this.phase = 'pat'; this.patTeam = rt; this.lastKick = { type: 'kickoff', td: true };
          return { type: 'kickoff', td: true };
        }
        nb = U.clamp(Math.round(U.norm(26, 7) + (r > 0.96 ? U.rnd(15, 40) : 0)), 3, 80);
        text = `Kickoff returned by ${Pl.name(kr)} to the ${this.spotStr(nb, rt)}.`;
      }
      this.ballOn = nb; this.down = 1; this.toGo = 10;
      this.phase = 'scrimmage'; this.clockRunning = false;
      this.startDrive();
      this.addLog(text);
      if (nb !== 30) this.useTime(U.rndi(4, 7));
      this.lastKick = { type: 'kickoff', ballOn: nb };
      return { type: 'kickoff', ballOn: nb, text };
    }

    decidePAT(side) {
      side = side || this.patTeam;
      const d = this.diff(side);
      if (this.q >= 4 && this.clock < 600) {
        if ([-2, -5, -9, -10, -12, -13, 1, 5, -16].includes(d)) return '2pt';
      }
      return 'xp';
    }
    doPAT(choice, forcedResult) {
      const side = this.patTeam;
      let good;
      if (choice === '2pt') {
        const r = this.rat[side], o = this.rat[other(side)];
        const p = U.clamp(0.47 + (r.off - o.def) * 0.008, 0.25, 0.7);
        good = forcedResult != null ? forcedResult : U.chance(p);
        if (good) this.addScore(side, 2);
        this.addLog(`Two-point attempt ${good ? 'is GOOD' : 'fails'}.`, { score: good });
      } else {
        const k = this.kicker(side);
        const p = Math.min(0.99, this.fgProb(33, side) + 0.06);
        good = forcedResult != null ? forcedResult : U.chance(p);
        if (k) { this.stat(k.id, 'xpA', 1); if (good) this.stat(k.id, 'xpM', 1); }
        if (good) this.addScore(side, 1);
        this.addLog(`${Pl.name(k)} extra point is ${good ? 'GOOD' : 'NO GOOD'}.`, { score: good });
      }
      this.kickTeam = side; this.phase = 'kickoff'; this.freeKick = false;
      // overtime: a touchdown wins it
      if (this.q >= 5 && !this.over && this.diff(side) > 0) this.finish();
      return good;
    }

    decide4th() {
      const side = this.poss, d = this.diff(side), late = this.q >= 4 && this.clock < 300;
      const dist = this.fgDist(), fgp = this.fgProb(dist);
      const tg = this.toGo, bo = this.ballOn;
      const coach = this.teams[side].coach;
      const aggr = coach ? coach.aggr : 0.5;
      if (late && d < 0 && (d < -3 || dist > 50)) return 'go';
      if (late && d < 0 && d >= -3 && fgp > 0.5) return 'fg';
      if (this.q >= 4 && this.clock < 30 && d >= -3 && d <= 0 && fgp > 0.2) return 'fg';
      if (this.q === 2 && this.clock < 20 && fgp > 0.3) return 'fg';
      if (tg <= 1 && bo >= 45 && Math.random() < 0.35 + aggr * 0.5) return 'go';
      if (tg <= 3 && bo >= 60 && bo < 75 && fgp < 0.6 && Math.random() < aggr) return 'go';
      if (fgp >= 0.55 && bo >= 55) return 'fg';
      if (tg <= 2 && bo >= 38 && bo < 55 && Math.random() < aggr * 0.5) return 'go';
      return 'punt';
    }

    doFG(forcedResult) {
      const side = this.poss, k = this.kicker(side), dist = this.fgDist();
      const p = this.fgProb(dist);
      const good = forcedResult != null ? forcedResult : U.chance(p);
      if (k) { this.stat(k.id, 'fgA', 1); if (good) { this.stat(k.id, 'fgM', 1); this.stat(k.id, 'fgLng', dist); } }
      this.useTime(5);
      if (good) {
        this.addScore(side, 3);
        this.addLog(`${Pl.name(k)} ${dist}-yard field goal is GOOD!`, { score: true });
        this.endDrive('Field Goal');
        this.kickTeam = side; this.phase = 'kickoff'; this.freeKick = false;
        this.checkOTEnd();
        if (this.q >= 5 && !this.over && this.otPoss[other(side)] >= 1 && this.diff(side) > 0) this.finish();
      } else {
        this.addLog(`${Pl.name(k)} ${dist}-yard field goal is NO GOOD.`);
        this.changePoss(Math.max(20, 100 - (this.ballOn - 7)), 'Missed FG');
      }
      return { good, dist, p };
    }

    doPunt() {
      const side = this.poss, pn = this.punter(side);
      const kpw = pn ? Pl.attr(pn, 'kpw') : 70;
      let dist = Math.round(U.norm(44 + (kpw - 75) * 0.35, 5.5));
      if (this.weather.wind > 12) dist += Math.round(U.rnd(-6, 6));
      if (pn) { this.stat(pn.id, 'pnt', 1); this.stat(pn.id, 'pntYds', dist); }
      const land = this.ballOn + dist;
      this.useTime(U.rndi(6, 9));
      let nb, txt;
      if (land >= 100) {
        nb = 20; txt = `${Pl.name(pn)} punts ${dist} yards into the end zone. Touchback.`;
      } else {
        let ret = 0;
        const fair = land > 85 || Math.random() < 0.38;
        if (!fair) ret = Math.max(0, Math.round(U.norm(8, 6) + (Math.random() < 0.03 ? U.rnd(20, 60) : 0)));
        const spot = Math.max(1, land - ret);
        nb = 100 - spot;
        txt = `${Pl.name(pn)} punts ${dist} yards. ${fair ? 'Fair catch' : 'Returned ' + ret + ' yards'} at the ${this.spotStr(nb, other(side))}.`;
        if (nb >= 100) nb = 99;
      }
      this.addLog(txt);
      this.changePoss(nb, 'Punt');
      return { dist, nb, text: txt };
    }

    // ------------- scrimmage -------------
    choosePlayType() {
      const side = this.poss, d = this.diff(side), coach = this.teams[side].coach;
      const scheme = D.OFF_SCHEMES.find((s) => s.id === coach.off) || D.OFF_SCHEMES[4];
      if (this.q === 4 && d > 0 && this.clock < (5 - this.down) * 40 && this.to[other(side)] <= 1) return 'kneel';
      if (this.q === 2 && d >= 0 && this.clock < 30 && this.ballOn < 50) return 'kneel';
      let p = scheme.pass;
      if (this.down === 3) p = this.toGo >= 7 ? 0.86 : this.toGo <= 2 ? 0.42 : 0.68;
      else if (this.down === 2 && this.toGo >= 8) p = Math.max(p, 0.64);
      else if (this.down === 4) p = this.toGo <= 1 ? 0.35 : 0.8;
      if (this.ballOn >= 97) p = Math.min(p, 0.42);
      if (this.q >= 3 && d < -8) p += 0.15;
      if ((this.q === 4 || this.q === 2) && this.clock < 130 && d <= 0) p = 0.88;
      if (this.q === 4 && d > 8) p -= 0.25;
      if (this.q === 4 && d > 0 && this.clock < 300) p -= 0.2;
      return Math.random() < U.clamp(p, 0.1, 0.95) ? 'pass' : 'run';
    }

    defPick(side, kind) {
      // choose a defender to credit with a tackle
      const d = this.depth[side];
      const c = [];
      const add = (pos, n, w) => { for (let i = 0; i < n; i++) if (d[pos][i]) c.push([d[pos][i], w * (d[pos][i].ovr / 75)]); };
      if (kind === 'run') { add('DE', 2, 0.6); add('DT', 2, 0.6); add('LB', 3, 1.4); add('S', 2, 0.7); add('CB', 2, 0.35); }
      else if (kind === 'sack') { add('DE', 2, 1.6); add('DT', 2, 0.9); add('LB', 3, 0.5); add('S', 1, 0.1); add('CB', 1, 0.05); }
      else if (kind === 'cover') { add('CB', 3, 1.4); add('S', 2, 1.0); add('LB', 3, 0.5); }
      else { add('CB', 3, 1.0); add('S', 2, 0.9); add('LB', 3, 1.0); add('DE', 2, 0.15); }
      const pick = U.wpick(c, (x) => x[1]);
      return pick ? pick[0] : null;
    }
    targetPick(side) {
      const d = this.depth[side];
      const c = [];
      const add = (pos, i, w) => { const p = d[pos][i]; if (p) c.push([p, w * Math.pow(p.ovr / 75, 2.2)]); };
      add('WR', 0, 0.27); add('WR', 1, 0.21); add('WR', 2, 0.14); add('TE', 0, 0.15); add('RB', 0, 0.1);
      add('TE', 1, 0.04); add('WR', 3, 0.04); add('RB', 1, 0.04);
      return U.wpick(c, (x) => x[1])[0];
    }
    maybeInjure(p) {
      if (!p || !this.lg.settings.injuries || p.id === this.userPid) return;
      const tough = Pl.attr(p, 'inj');
      if (Math.random() < 0.0016 * (1.6 - tough / 100)) {
        const inj = PG.Season.rollInjury(p);
        this.injuries.push(p.id);
        this.addLog(`Injury: ${Pl.name(p)} (${inj.name}) is out.`, { sys: true });
        L.invalidate();
        const side = this.teams.home.id === p.team ? 'home' : 'away';
        this.depth[side] = L.depth(this.lg, this.teams[side]);
      }
    }

    // Simulate one scrimmage play. returns a result object (does not apply it)
    simPlay(forceType) {
      const o = this.poss, dsd = other(o);
      const ro = this.rat[o], rd = this.rat[dsd];
      const type = forceType || this.choosePlayType();
      const qb = this.pl(o, 'QB', 0);
      const res = { kind: type, yards: 0, time: U.rndi(5, 7), events: [], desc: '' };
      const ev = (p, k, v) => { if (p) res.events.push([p.id, k, v]); };
      const toGoal = 100 - this.ballOn;
      const w = this.weather;

      if (type === 'kneel') {
        res.yards = -1; res.time = 2; res.kneel = true; res.desc = `${Pl.name(qb)} kneels.`;
        ev(qb, 'rAtt', 1); ev(qb, 'rYds', -1);
        return res;
      }
      if (type === 'spike') {
        res.incomplete = true; res.time = 1; res.desc = `${Pl.name(qb)} spikes the ball.`;
        ev(qb, 'pAtt', 1);
        return res;
      }
      // penalties
      const pr = Math.random();
      if (pr < 0.05) {
        let pen;
        if (pr < 0.012) pen = { on: 'off', name: 'False Start', yds: 5, pre: true };
        else if (pr < 0.024) pen = { on: 'def', name: 'Offside', yds: 5, pre: true };
        else if (pr < 0.042) pen = { on: 'off', name: 'Holding', yds: 10 };
        else pen = { on: 'def', name: type === 'pass' ? 'Pass Interference' : 'Defensive Holding', yds: type === 'pass' ? U.rndi(8, 25) : 5, auto: true };
        res.penalty = pen; res.time = pen.pre ? 0 : U.rndi(4, 6);
        res.desc = `PENALTY: ${pen.name}, ${pen.on === 'off' ? this.teams[o].abbr : this.teams[dsd].abbr}, ${pen.yds} yards.`;
        return res;
      }

      if (type === 'pass') {
        const sackP = U.clamp(0.066 - (ro.passPro - rd.passRush) * 0.0032, 0.022, 0.15);
        const qbSpd = qb ? Pl.attr(qb, 'spd') : 60;
        if (Math.random() < sackP) {
          const s = this.defPick(dsd, 'sack');
          res.kind = 'sack'; res.yards = -U.rndi(3, 9); res.sack = true;
          ev(qb, 'sacked', 1); ev(s, 'sck', 1); ev(s, 'tkl', 1);
          res.desc = `${Pl.name(qb)} sacked by ${Pl.name(s)} for a loss of ${-res.yards}.`;
          if (Math.random() < 0.08) {
            // strip sack
            ev(s, 'ff', 1);
            if (Math.random() < 0.5) { res.turnover = 'fumble'; res.retYards = 0; ev(qb, 'fum', 1); res.desc += ' FUMBLE recovered by the defense!'; }
            else res.desc += ' Fumble, recovered by the offense.';
          }
          this.maybeInjure(qb);
          return res;
        }
        if (Math.random() < 0.025 + Math.max(0, qbSpd - 65) * 0.0016) {
          res.kind = 'scramble';
          let y = Math.round(U.norm(4 + (qbSpd - 70) * 0.06, 4.5));
          if (Math.random() < 0.05) y += U.rndi(8, 30);
          y = U.clamp(y, -3, toGoal);
          res.yards = y; res.oob = Math.random() < 0.3;
          ev(qb, 'rAtt', 1); ev(qb, 'rYds', y); ev(qb, 'rLng', y);
          if (y >= toGoal) { res.td = true; ev(qb, 'rTD', 1); }
          else ev(this.defPick(dsd, 'run'), 'tkl', 1);
          res.desc = `${Pl.name(qb)} scrambles for ${y} yards.` + (res.td ? ' TOUCHDOWN!' : '');
          return res;
        }
        const tgt = this.targetPick(o);
        const scheme = D.OFF_SCHEMES.find((s) => s.id === this.teams[o].coach.off) || D.OFF_SCHEMES[4];
        const r = Math.random();
        let depth, air;
        if (r < 0.07) { depth = 'screen'; air = U.rndi(-3, 1); }
        else if (r < 0.07 + 0.13 * scheme.deep) { depth = 'deep'; air = U.rndi(20, 48); }
        else if (r < 0.5) { depth = 'mid'; air = U.rndi(10, 19); }
        else { depth = 'short'; air = U.rndi(1, 9); }
        air = Math.min(air, toGoal);
        const qacc = qb ? (depth === 'deep' ? Pl.attr(qb, 'tad') : depth === 'mid' ? Pl.attr(qb, 'tam') : Pl.attr(qb, 'tas')) : 60;
        const qawr = qb ? Pl.attr(qb, 'awr') : 60;
        const tc = tgt ? (Pl.attr(tgt, 'cth') + Pl.attr(tgt, 'rte')) / 2 : 60;
        let cp = 0.64 + (qacc - 76) * 0.0058 + (tc - 72) * 0.003 - (rd.passDef - 74) * 0.0058 + (ro.passPro - rd.passRush) * 0.002;
        cp += depth === 'screen' ? 0.17 : depth === 'short' ? 0.1 : depth === 'mid' ? -0.06 : -0.27;
        if (w.type === 'rain') cp -= 0.04; if (w.type === 'snow') cp -= 0.05; cp -= Math.max(0, w.wind - 12) * 0.004;
        cp = U.clamp(cp, 0.12, 0.92);
        let ip = 0.017 + (70 - qawr) * 0.0006 + (rd.passDef - 74) * 0.0009 + (depth === 'deep' ? 0.022 : depth === 'mid' ? 0.006 : 0);
        ip = U.clamp(ip, 0.006, 0.08);
        ev(qb, 'pAtt', 1); ev(tgt, 'tgt', 1);
        const rr = Math.random();
        if (rr < ip) {
          const dfd = this.defPick(dsd, 'cover');
          res.turnover = 'int'; res.incomplete = false;
          res.yards = air;
          let ret = Math.max(0, Math.round(U.norm(9, 9)));
          const spotOld = this.ballOn + air;
          if (Math.random() < 0.05) ret = spotOld + 5;
          res.retYards = ret;
          if (spotOld - ret <= 0) res.defTD = true;
          ev(qb, 'pInt', 1); ev(dfd, 'dInt', 1); ev(dfd, 'pd', 1);
          if (res.defTD) ev(dfd, 'dTD', 1);
          res.desc = `${Pl.name(qb)} pass intended for ${Pl.name(tgt)} INTERCEPTED by ${Pl.name(dfd)}!` + (res.defTD ? ' Pick six!' : ` Returned ${ret} yards.`);
          return res;
        }
        if (rr < ip + cp) {
          const spd = tgt ? Pl.attr(tgt, 'spd') : 75, elu = tgt ? (Pl.attr(tgt, 'elu') + Pl.attr(tgt, 'btk')) / 2 : 60;
          let yac = Math.round(-Math.log(Math.random()) * (2.4 + (spd - 80) * 0.08 + (elu - 60) * 0.03 + (depth === 'screen' ? 3.5 : 0)));
          if (Math.random() < 0.025 + (spd - 85) * 0.002) yac += U.rndi(10, 55);
          let y = air + yac;
          y = Math.min(y, toGoal);
          res.yards = y; res.complete = true; res.oob = Math.random() < 0.18;
          ev(qb, 'pCmp', 1); ev(qb, 'pYds', y); ev(qb, 'pLng', y);
          ev(tgt, 'rec', 1); ev(tgt, 'recYds', y); ev(tgt, 'recLng', y);
          if (y >= toGoal) { res.td = true; ev(qb, 'pTD', 1); ev(tgt, 'recTD', 1); }
          else ev(this.defPick(dsd, 'pass'), 'tkl', 1);
          // fumble after catch
          if (!res.td && Math.random() < 0.006) {
            const dfd = this.defPick(dsd, 'pass'); ev(dfd, 'ff', 1); ev(tgt, 'fum', 1);
            res.turnover = 'fumble'; res.retYards = 0;
            res.desc = `${Pl.name(qb)} to ${Pl.name(tgt)} for ${y}, but he FUMBLES! Recovered by ${Pl.name(dfd)}.`;
            return res;
          }
          res.time = U.rndi(5, 8);
          const dir = U.pick(['left', 'middle', 'right']);
          res.desc = `${Pl.name(qb)} pass ${depth === 'deep' ? 'deep' : 'short'} ${dir} to ${Pl.name(tgt)} for ${y} yard${y === 1 ? '' : 's'}.` + (res.td ? ' TOUCHDOWN!' : '');
          this.maybeInjure(tgt);
          return res;
        }
        res.incomplete = true; res.yards = 0; res.time = U.rndi(4, 6);
        if (Math.random() < 0.38) ev(this.defPick(dsd, 'cover'), 'pd', 1);
        if (Math.random() < 0.07) ev(tgt, 'drops', 1);
        res.desc = `${Pl.name(qb)} pass incomplete${tgt ? ' intended for ' + Pl.name(tgt) : ''}.`;
        return res;
      }

      // run
      const rbs = [this.pl(o, 'RB', 0), this.pl(o, 'RB', 1)];
      let car = Math.random() < 0.74 ? rbs[0] : rbs[1];
      const qbRun = qb && Math.random() < 0.04 + Math.max(0, Pl.attr(qb, 'spd') - 75) * 0.006;
      if (qbRun) car = qb;
      if (!car) car = qb;
      const adv = ro.runOff - rd.runDef;
      const cs = Pl.attr(car, 'spd'), cb = (Pl.attr(car, 'btk') + Pl.attr(car, 'elu')) / 2;
      let y = Math.round(U.norm(3.5 + adv * 0.12 + (cb - 72) * 0.03, 3.2));
      if (Math.random() < 0.036 + adv * 0.0015 + (cs - 85) * 0.0015) y += U.rndi(6, 45);
      if (this.toGo <= 1 && this.ballOn >= 97 && Math.random() < 0.55) y = Math.max(y, 1);
      if (w.type === 'snow') y -= 1;
      y = U.clamp(y, -5, toGoal);
      res.yards = y; res.oob = Math.random() < 0.08; res.kind = 'run';
      ev(car, 'rAtt', 1); ev(car, 'rYds', y); ev(car, 'rLng', y);
      const fp = 0.008 * (1 + (70 - Pl.attr(car, 'car')) / 40) * (w.type === 'rain' || w.type === 'snow' ? 1.5 : 1);
      if (y >= toGoal) { res.td = true; ev(car, 'rTD', 1); }
      else {
        const t = this.defPick(dsd, 'run'); ev(t, 'tkl', 1);
        if (Math.random() < fp) {
          ev(t, 'ff', 1);
          if (Math.random() < 0.55) { res.turnover = 'fumble'; res.retYards = 0; ev(car, 'fum', 1);
            res.desc = `${Pl.name(car)} runs for ${y} but FUMBLES! Recovered by the defense.`; return res; }
        }
      }
      const dir = U.pick(['up the middle', 'off left tackle', 'off right tackle', 'around left end', 'around right end']);
      res.desc = `${Pl.name(car)} runs ${dir} for ${y} yard${Math.abs(y) === 1 ? '' : 's'}.` + (res.td ? ' TOUCHDOWN!' : '');
      this.maybeInjure(car);
      return res;
    }

    // Apply a scrimmage play result (from sim or on-field engine)
    apply(res) {
      const o = this.poss, dsd = other(o);
      const ts = this.ts[o];
      this.lastPlay = res;
      this.events(res.events);
      if (res.penalty) {
        const pen = res.penalty;
        this.ts[pen.on === 'off' ? o : dsd].pen++;
        this.ts[pen.on === 'off' ? o : dsd].penYds += pen.yds;
        if (pen.on === 'off') {
          const y = Math.min(pen.yds, Math.floor((this.ballOn - 1) / 2) || 1);
          this.ballOn = Math.max(1, this.ballOn - y); this.toGo += y;
        } else {
          const room = 100 - this.ballOn;
          const y = pen.spot ? Math.min(pen.yds, room - 1) : Math.min(pen.yds, Math.max(1, Math.floor(room / 2)));
          this.ballOn += y; this.toGo -= y;
          if (pen.auto || this.toGo <= 0) { this.down = 1; this.toGo = Math.min(10, 100 - this.ballOn); }
        }
        this.addLog(res.desc, { pen: true });
        this.useTime(res.time || 0);
        this.clockRunning = false;
        return { type: 'penalty' };
      }
      ts.plays++;
      if (this.drive) this.drive.yards += res.turnover ? 0 : res.yards;
      if (this.down === 3) ts.thirdA++;
      const ltg = this.lineToGain();
      if (!res.turnover && !res.sack) {
        ts.yds += res.yards;
        if (res.kind === 'pass' && res.complete) ts.pYds += res.yards;
        else if (res.kind === 'run' || res.kind === 'scramble' || res.kind === 'kneel') ts.rYds += res.yards;
      }
      if (res.sack) { ts.yds += res.yards; this.ts[dsd].sacks++; }
      const entry = this.addLog(res.desc || '', { res });
      let outcome = { type: 'play' };

      if (res.turnover) {
        ts.tov++;
        const tSpot = U.clamp(this.ballOn + res.yards, -5, 110);
        const final = tSpot - (res.retYards || 0);
        this.useTime(res.time || 5);
        if (res.defTD || final <= 0) {
          this.endDrive(res.turnover === 'int' ? 'Interception' : 'Fumble');
          this.poss = dsd; this.addScore(dsd, 6);
          this.startDrive(); this.endDrive('Defensive TD');
          entry.score = true;
          this.phase = 'pat'; this.patTeam = dsd; this.clockRunning = false;
          return { type: 'defTD' };
        }
        let nb = 100 - final;
        if (res.turnover === 'int' && tSpot >= 100 && !(res.retYards > 0)) nb = 20;
        this.changePoss(U.clamp(nb, 1, 99), res.turnover === 'int' ? 'Interception' : 'Fumble');
        return { type: 'turnover', kind: res.turnover };
      }

      const nb = this.ballOn + res.yards;
      if (res.td || nb >= 100) {
        this.addScore(o, 6); entry.score = true;
        this.endDrive('Touchdown');
        this.phase = 'pat'; this.patTeam = o; this.clockRunning = false;
        this.useTime(res.time || 5);
        this.ballOn = 100;
        return { type: 'td' };
      }
      if (nb <= 0) {
        this.addScore(dsd, 2); entry.score = true;
        this.addLog(`SAFETY! ${this.teams[dsd].abbr} scores 2.`, { score: true });
        this.endDrive('Safety');
        this.kickTeam = o; this.freeKick = true; this.phase = 'kickoff'; this.clockRunning = false;
        this.useTime(res.time || 5);
        return { type: 'safety' };
      }
      this.ballOn = nb;
      if (nb >= ltg) {
        ts.fd++;
        if (this.down === 3) ts.thirdM++;
        this.down = 1; this.toGo = Math.min(10, 100 - nb);
        outcome = { type: 'first' };
      } else {
        this.down++;
        this.toGo = ltg - nb;
        if (this.down > 4) {
          this.useTime(res.time || 5);
          this.addLog(`Turnover on downs.`);
          this.changePoss(100 - nb, 'Downs');
          return { type: 'downs' };
        }
      }
      this.clockRunning = !(res.incomplete || res.oob);
      this.useTime(res.time || 5);
      return outcome;
    }

    // Run one full AI step. Used for full simulation and for sim'd drives.
    step() {
      const a = this.prepare();
      if (a === 'over') return a;
      if (a === 'kickoff') { this.doKickoff(); return a; }
      if (a === 'pat') { this.doPAT(this.decidePAT()); return a; }
      this.beginPlay();
      if (!this.snap()) return 'clock';
      if (this.down === 4) {
        const dec = this.decide4th();
        if (dec === 'punt') { this.doPunt(); return 'punt'; }
        if (dec === 'fg') { this.doFG(); return 'fg'; }
      }
      const res = this.simPlay();
      this.apply(res);
      return 'play';
    }

    simToEnd() {
      let guard = 0;
      while (!this.over && guard++ < 2000) this.step();
      if (!this.over) this.finish();
    }

    // Simulate until possession changes (or a score/quarter break). Returns list of log entries.
    simDrive(maxSteps) {
      const startPoss = this.poss, startLen = this.log.length;
      let guard = 0;
      while (!this.over && guard++ < (maxSteps || 60)) {
        const a = this.prepare();
        if (a === 'over') break;
        if (this.poss !== startPoss && a !== 'pat') break;
        if (a === 'kickoff' && guard > 1) break;
        this.step();
        if (this.halftime) break;
        if (this.poss !== startPoss && this.phase !== 'pat') break;
      }
      return this.log.slice(startLen);
    }

    // Give games-played credit to the guys who suited up
    creditGP() {
      for (const side of ['home', 'away']) {
        const d = this.depth[side];
        const n = { QB: 1, RB: 2, WR: 4, TE: 2, OT: 2, OG: 2, C: 1, DE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1, P: 1 };
        const seen = new Set();
        for (const pos in n) for (let i = 0; i < n[pos]; i++) {
          const p = d[pos][i]; if (!p || seen.has(p.id)) continue;
          seen.add(p.id);
          this.stat(p.id, 'gp', 1);
          if (i === 0 || (pos === 'WR' && i < 3) || (pos === 'OT' || pos === 'OG' || pos === 'DE' || pos === 'DT' || pos === 'CB' || pos === 'S') && i < 2 || (pos === 'LB' && i < 3)) this.stat(p.id, 'gs', 1);
        }
      }
    }
  }

  PG.GameState = GameState;
  PG.Sim = {
    simGame(lg, g, opts) {
      const gs = new GameState(lg, g, opts || {});
      gs.simToEnd();
      gs.creditGP();
      return gs;
    },
  };
})();
