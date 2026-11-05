/* Pixel Gridiron - season flow: weeks, injuries, playoffs, awards, offseason, draft, free agency */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, L = PG.League;
  const S = {};

  S.rollInjury = (p, mult) => {
    const pool = D.INJURIES.filter((i) => !i.rare || Math.random() < 0.12);
    const inj = U.pick(pool);
    let wks = U.rndi(inj.min, inj.max);
    wks = Math.max(1, Math.round(wks * (mult || 1)));
    p.inj = { name: inj.name, wks };
    return p.inj;
  };

  S.startSeason = (lg) => {
    lg.phase = 'regular'; lg.week = 1; lg.playoffs = null;
    for (const t of lg.teams) { Object.assign(t, { w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, cw: 0, cl: 0, streak: 0 }); }
    for (const id in lg.players) lg.players[id].s = {};
    L.makeSchedule(lg);
    L.invalidate(lg);
    lg.tradeDeadlineDone = false;
  };

  S.isUserGame = (lg, g) => {
    const ut = PG.Career && PG.Career.userTeamId ? PG.Career.userTeamId(lg) : -1;
    return g.h === ut || g.a === ut;
  };

  // apply a finished game's box score to season stats & check records
  S.applyBox = (lg, gs) => {
    const notable = [];
    for (const pid in gs.box) {
      const p = lg.players[pid];
      if (!p) continue;
      const b = gs.box[pid];
      Pl.addStats(p.s, b);
      const broke = L.checkRecords(lg, 'game', p, b);
      for (const k of broke) notable.push(`${Pl.full(p)} sets a single-game record with ${b[k]} ${L.REC_KEYS[k].toLowerCase()}!`);
      if ((b.pYds || 0) >= 330 * (lg.settings.quarterLen / 15 * 1.2 + 0.1)) notable.push(`${Pl.full(p)} throws for ${b.pYds} yards.`);
      if ((b.rYds || 0) >= 160 * (lg.settings.quarterLen / 15 * 1.2 + 0.1)) notable.push(`${Pl.full(p)} rumbles for ${b.rYds} yards.`);
      if ((b.recYds || 0) >= 150 * (lg.settings.quarterLen / 15 * 1.2 + 0.1)) notable.push(`${Pl.full(p)} racks up ${b.recYds} receiving yards.`);
      if ((b.sck || 0) >= 3) notable.push(`${Pl.full(p)} records ${b.sck} sacks.`);
    }
    for (const n of notable.slice(0, 2)) L.news(lg, n, 'perf');
  };

  S.simOtherGames = (lg) => {
    const wk = lg.schedule[lg.week - 1] || [];
    for (const g of wk) {
      if (g.played || S.isUserGame(lg, g)) continue;
      S.simAndApply(lg, g);
    }
  };
  S.simAndApply = (lg, g, opts) => {
    const gs = PG.Sim.simGame(lg, g, opts || {});
    L.applyResult(lg, g, gs.score.home, gs.score.away);
    S.applyBox(lg, gs);
    return gs;
  };

  S.weeklyUpkeep = (lg) => {
    for (const id in lg.players) {
      const p = lg.players[id];
      if (p.inj) {
        p.inj.wks--;
        if (p.isUser && PG.Career && PG.Career.hasStaff && PG.Career.hasStaff('physio') && p.inj.wks > 0) p.inj.wks--;
        if (p.inj.wks <= 0) p.inj = null;
      }
    }
    L.invalidate(lg);
  };

  // AI trades at the deadline
  S.tradeDeadline = (lg) => {
    if (lg.tradeDeadlineDone) return;
    lg.tradeDeadlineDone = true;
    const n = U.rndi(2, 5);
    for (let i = 0; i < n; i++) {
      const a = U.pick(lg.teams), b = U.pick(lg.teams);
      if (a === b) continue;
      const pos = U.pick(['WR', 'RB', 'LB', 'CB', 'DE', 'S', 'TE', 'DT']);
      const pa = L.roster(lg, a).filter((p) => p.pos === pos && !p.isUser && p.ovr > 66).sort((x, y) => y.ovr - x.ovr)[1];
      const pb = L.roster(lg, b).filter((p) => p.pos === pos && !p.isUser && p.ovr > 66).sort((x, y) => y.ovr - x.ovr)[1];
      if (!pa || !pb || Math.abs(pa.ovr - pb.ovr) > 4) continue;
      L.moveTo(lg, pa, b); L.moveTo(lg, pb, a);
      L.news(lg, `TRADE: ${a.abbr} send ${pos} ${Pl.full(pa)} to ${b.abbr} for ${pos} ${Pl.full(pb)}.`, 'trade');
      lg.transactions.unshift({ y: lg.year, text: `${a.abbr} ⇄ ${b.abbr}: ${Pl.name(pa)} for ${Pl.name(pb)}` });
    }
  };

  S.endRegularWeek = (lg) => {
    S.weeklyUpkeep(lg);
    if (lg.week === Math.ceil(lg.settings.seasonLength * 0.6)) S.tradeDeadline(lg);
    lg.week++;
    if (lg.week > lg.settings.seasonLength) S.startPlayoffs(lg);
  };

  // ---------------- Playoffs ----------------
  S.startPlayoffs = (lg) => {
    lg.phase = 'playoffs';
    const seeds = { 0: L.seeds(lg, 0).map((t) => t.id), 1: L.seeds(lg, 1).map((t) => t.id) };
    lg.playoffs = { round: 0, seeds, games: [[], [], [], []], champ: null };
    for (const c of [0, 1]) {
      const s = seeds[c];
      lg.playoffs.games[0].push({ h: s[1], a: s[6], conf: c, round: 0 }, { h: s[2], a: s[5], conf: c, round: 0 }, { h: s[3], a: s[4], conf: c, round: 0 });
    }
    L.news(lg, `Playoff field set! Top seeds: ${lg.teams[seeds[0][0]].name} and ${lg.teams[seeds[1][0]].name}.`, 'playoff');
  };
  S.seedOf = (lg, tid) => {
    for (const c of [0, 1]) { const i = lg.playoffs.seeds[c].indexOf(tid); if (i >= 0) return i + 1; }
    return 99;
  };
  S.currentPlayoffGames = (lg) => (lg.playoffs ? lg.playoffs.games[lg.playoffs.round] : []);
  S.playoffWinner = (g) => (g.hs > g.as ? g.h : g.a);
  S.advancePlayoffRound = (lg) => {
    const po = lg.playoffs, r = po.round;
    const games = po.games[r];
    if (games.some((g) => !g.played)) return false;
    if (r === 3) {
      const g = games[0];
      po.champ = S.playoffWinner(g);
      const ct = lg.teams[po.champ];
      lg.champions.unshift({ year: lg.year, team: ct.id, abbr: ct.abbr, name: L.teamName(ct), score: `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}`, mvp: g.mvp || null });
      L.news(lg, `${L.teamName(ct)} win the ${lg.year} ${D.CHAMP_NAME}!`, 'champ');
      lg.phase = 'awards';
      return true;
    }
    const next = [];
    for (const c of [0, 1]) {
      const winners = games.filter((g) => g.conf === c).map(S.playoffWinner);
      if (r === 0) {
        const all = winners.concat([po.seeds[c][0]]).sort((a, b) => S.seedOf(lg, a) - S.seedOf(lg, b));
        next.push({ h: all[0], a: all[3], conf: c, round: 1 }, { h: all[1], a: all[2], conf: c, round: 1 });
      } else if (r === 1) {
        const all = winners.sort((a, b) => S.seedOf(lg, a) - S.seedOf(lg, b));
        next.push({ h: all[0], a: all[1], conf: c, round: 2 });
      }
    }
    if (r === 2) {
      const w0 = games.find((g) => g.conf === 0), w1 = games.find((g) => g.conf === 1);
      const a = S.playoffWinner(w0), b = S.playoffWinner(w1);
      const ta = lg.teams[a], tb = lg.teams[b];
      const h = L.pct(ta) >= L.pct(tb) ? a : b;
      next.push({ h, a: h === a ? b : a, conf: -1, round: 3, neutral: true });
    }
    po.round++;
    po.games[po.round] = next;
    return true;
  };
  S.simPlayoffGames = (lg, skipUser) => {
    for (const g of S.currentPlayoffGames(lg)) {
      if (g.played || (skipUser && S.isUserGame(lg, g))) continue;
      const gs = S.simAndApplyPlayoff(lg, g);
      if (g.round === 3) g.mvp = S.gameMVP(lg, gs, S.playoffWinner(g));
    }
  };
  S.simAndApplyPlayoff = (lg, g) => {
    const gs = PG.Sim.simGame(lg, g, { playoff: true });
    S.recordPlayoffResult(lg, g, gs);
    return gs;
  };
  S.recordPlayoffResult = (lg, g, gs) => {
    g.played = true; g.hs = gs.score.home; g.as = gs.score.away;
    // playoff stats count toward playoff totals only
    for (const pid in gs.box) {
      const p = lg.players[pid]; if (!p) continue;
      p.ps = p.ps || {}; Pl.addStats(p.ps, gs.box[pid]);
    }
    const w = lg.teams[S.playoffWinner(g)], l = lg.teams[S.playoffWinner(g) === g.h ? g.a : g.h];
    L.news(lg, `${D.ROUND_NAMES[g.round]}: ${w.abbr} ${Math.max(g.hs, g.as)}, ${l.abbr} ${Math.min(g.hs, g.as)}`, 'playoff');
  };
  S.gameMVP = (lg, gs, teamId) => {
    let best = null, bv = -1;
    for (const pid in gs.box) {
      const p = lg.players[pid]; if (!p || p.team !== teamId) continue;
      const v = Pl.prodScore(p.pos, gs.box[pid]);
      if (v > bv) { bv = v; best = p; }
    }
    return best ? { pid: best.id, name: Pl.full(best), pos: best.pos } : null;
  };

  // ---------------- Awards ----------------
  S.computeAwards = (lg) => {
    const minGP = Math.ceil(lg.settings.seasonLength * 0.5);
    const all = Object.values(lg.players).filter((p) => p.team >= 0 && (p.s.gp || 0) >= minGP);
    const offPos = ['QB', 'RB', 'WR', 'TE'], defPos = ['DE', 'DT', 'LB', 'CB', 'S'];
    const teamPct = (p) => L.pct(lg.teams[p.team]);
    const score = (p) => Pl.prodScore(p.pos, p.s) + p.ovr * 0.3;
    const best = (list, f) => list.slice().sort((a, b) => f(b) - f(a))[0] || null;
    const mvpScore = (p) => Pl.prodScore(p.pos, p.s) * (p.pos === 'QB' ? 1.35 : 1) + teamPct(p) * 60;
    const entry = (p) => (p ? { pid: p.id, name: Pl.full(p), pos: p.pos, team: lg.teams[p.team].abbr, line: Pl.statLine(p.pos, p.s) } : null);
    const aw = { year: lg.year };
    const mvp = best(all.filter((p) => offPos.includes(p.pos) || defPos.includes(p.pos)), mvpScore);
    aw.mvp = entry(mvp);
    aw.opoy = entry(best(all.filter((p) => offPos.includes(p.pos) && p !== mvp), score));
    aw.dpoy = entry(best(all.filter((p) => defPos.includes(p.pos)), score));
    aw.oroy = entry(best(all.filter((p) => offPos.includes(p.pos) && p.yrs === 0), score));
    aw.droy = entry(best(all.filter((p) => defPos.includes(p.pos) && p.yrs === 0), score));
    const slots = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, OG: 2, C: 1, DE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1, P: 1 };
    const rankScore = (p) => {
      if (['OT', 'OG', 'C'].includes(p.pos)) return p.ovr * 2 + lg.teams[p.team].pf / Math.max(1, lg.settings.seasonLength) * 0.5;
      if (p.pos === 'K') return (p.s.fgM || 0) * 2 + ((p.s.fgM || 0) / Math.max(1, p.s.fgA || 1)) * 30 + p.ovr * 0.2;
      if (p.pos === 'P') return p.ovr + (p.s.pntYds || 0) / Math.max(1, p.s.pnt || 1);
      return score(p);
    };
    aw.allLeague = [];
    aw.allStars = [];
    for (const pos in slots) {
      const ranked = all.filter((p) => p.pos === pos).sort((a, b) => rankScore(b) - rankScore(a));
      ranked.slice(0, slots[pos]).forEach((p) => { aw.allLeague.push(entry(p)); p.aw.allLeague = (p.aw.allLeague || 0) + 1; });
      for (const c of [0, 1]) {
        ranked.filter((p) => lg.teams[p.team].conf === c).slice(0, slots[pos] + 1).forEach((p) => {
          aw.allStars.push(entry(p)); p.aw.allStar = (p.aw.allStar || 0) + 1;
        });
      }
    }
    const inc = (e, k) => { if (e) { const p = lg.players[e.pid]; p.aw[k] = (p.aw[k] || 0) + 1; } };
    inc(aw.mvp, 'mvp'); inc(aw.opoy, 'opoy'); inc(aw.dpoy, 'dpoy'); inc(aw.oroy, 'roy'); inc(aw.droy, 'roy');
    if (lg.champions[0] && lg.champions[0].year === lg.year) {
      const ct = lg.champions[0].team;
      for (const id of lg.teams[ct].roster) { const p = lg.players[id]; if (p) p.aw.champ = (p.aw.champ || 0) + 1; }
      if (lg.champions[0].mvp) { const p = lg.players[lg.champions[0].mvp.pid]; if (p) p.aw.champMvp = (p.aw.champMvp || 0) + 1; aw.champMvp = lg.champions[0].mvp; }
    }
    // league leaders / season records
    for (const p of Object.values(lg.players)) {
      if (p.team < 0) continue;
      const broke = L.checkRecords(lg, 'season', p, p.s);
      for (const k of broke) L.news(lg, `RECORD: ${Pl.full(p)} sets the single-season ${L.REC_KEYS[k].toLowerCase()} record (${p.s[k]}).`, 'record');
    }
    lg.awards.unshift(aw);
    if (aw.mvp) L.news(lg, `${aw.mvp.name} (${aw.mvp.team}) named league MVP!`, 'award');
    return aw;
  };

  S.leaders = (lg, key, n, filter) => {
    return Object.values(lg.players).filter((p) => (p.s[key] || 0) > 0 && (!filter || filter(p)))
      .sort((a, b) => (b.s[key] || 0) - (a.s[key] || 0)).slice(0, n || 10);
  };

  // ---------------- Offseason ----------------
  S.legacyScore = (p) => {
    const a = p.aw || {}, c = p.c || {};
    return (a.mvp || 0) * 100 + (a.opoy || 0) * 50 + (a.dpoy || 0) * 50 + (a.allLeague || 0) * 30 + (a.allStar || 0) * 10 +
      (a.champ || 0) * 25 + (a.champMvp || 0) * 40 + (a.roy || 0) * 15 + Pl.prodScore(p.pos, c) * 0.02;
  };

  // Phase 1: archive season, progression & retirements
  S.offseasonProgress = (lg) => {
    const userId = PG.Career && PG.Career.userPid ? PG.Career.userPid() : null;
    // team history
    for (const t of lg.teams) {
      let result = 'Missed playoffs';
      if (lg.playoffs) {
        const inPO = lg.playoffs.seeds[t.conf].includes(t.id);
        if (inPO) {
          result = 'Lost ' + D.ROUND_NAMES[0];
          for (let r = 0; r < 4; r++) {
            const g = (lg.playoffs.games[r] || []).find((x) => x.h === t.id || x.a === t.id);
            if (g && g.played) result = S.playoffWinner(g) === t.id ? (r === 3 ? 'CHAMPIONS' : 'Won ' + D.ROUND_NAMES[r]) : 'Lost ' + D.ROUND_NAMES[r];
          }
        }
      }
      t.history.unshift({ year: lg.year, w: t.w, l: t.l, t: t.t, pf: t.pf, pa: t.pa, result });
      if (t.history.length > 30) t.history.length = 30;
      t.prestige = U.clamp(Math.round(t.prestige * 0.7 + L.pct(t) * 100 * 0.3 + (result === 'CHAMPIONS' ? 10 : 0)), 10, 99);
    }
    const retired = [];
    for (const id of Object.keys(lg.players)) {
      const p = lg.players[id];
      Pl.addStats(p.c, p.s);
      if (p.ps) { p.pc = p.pc || {}; Pl.addStats(p.pc, p.ps); p.ps = null; }
      if (p.team >= 0 || lg.freeAgents.includes(p.id)) L.checkRecords(lg, 'career', p, p.c);
      if (p.id === userId) continue;
      p.age++;
      p.yrs++;
      // retirement
      let rp = 0;
      if (p.age >= 37) rp = 0.85; else if (p.age >= 35) rp = 0.45; else if (p.age >= 33) rp = 0.18;
      if (p.ovr < 55 && p.age > 28) rp += 0.35;
      if (p.team < 0 && p.age > 29) rp += 0.4;
      if (p.pos === 'K' || p.pos === 'P') rp *= 0.5;
      if (Math.random() < rp) { retired.push(p); continue; }
      Pl.progress(p);
    }
    for (const p of retired) {
      const score = S.legacyScore(p);
      if (score >= 260) {
        lg.hof.unshift({ name: Pl.full(p), pos: p.pos, year: lg.year + 1, score: Math.round(score), team: p.team >= 0 ? lg.teams[p.team].abbr : 'FA' });
        L.news(lg, `${Pl.full(p)} retires — a future Hall of Famer.`, 'retire');
      } else if (p.ovr >= 80) L.news(lg, `${p.pos} ${Pl.full(p)} announces his retirement after ${p.yrs} seasons.`, 'retire');
      L.removeFromTeam(lg, p);
      delete lg.players[p.id];
    }
    L.invalidate(lg);
    lg.phase = 'resign';
    return retired.length;
  };

  // Phase 2: contracts expire, AI re-signs
  S.offseasonContracts = (lg) => {
    const userId = PG.Career && PG.Career.userPid ? PG.Career.userPid() : null;
    for (const t of lg.teams) {
      for (const p of L.roster(lg, t)) {
        if (p.id === userId || !p.con) continue;
        p.con.yrs--;
        if (p.con.yrs <= 0) {
          const keep = p.ovr >= 68 && p.age <= 32 && Math.random() < 0.62 + (p.ovr - 70) * 0.02;
          if (keep && L.capSpace(lg, t) > Pl.value(p) * 0.5) {
            const yrs = U.rndi(1, p.age > 30 ? 2 : 5);
            p.con = { sal: Math.round(Pl.value(p) * U.rnd(0.95, 1.15) / 10000) * 10000, yrs, exp: lg.year + yrs };
          } else {
            L.moveTo(lg, p, null);
            p.con = null;
          }
        }
      }
    }
    lg.phase = 'draft';
  };

  // Phase 3: draft
  S.draftOrder = (lg) => {
    const order = lg.teams.slice().sort((a, b) => {
      const ra = S.elimRound(lg, a), rb = S.elimRound(lg, b);
      if (ra !== rb) return ra - rb;
      return L.pct(a) - L.pct(b) || (a.pf - a.pa) - (b.pf - b.pa);
    });
    return order.map((t) => t.id);
  };
  S.elimRound = (lg, t) => {
    if (!lg.playoffs) return -1;
    if (!lg.playoffs.seeds[t.conf].includes(t.id)) return -1;
    let r = 0;
    for (let i = 0; i < 4; i++) {
      const g = (lg.playoffs.games[i] || []).find((x) => x.h === t.id || x.a === t.id);
      if (g && g.played) r = i + (S.playoffWinner(g) === t.id ? 1 : 0);
    }
    return r;
  };
  S.makeDraftClass = (lg, n) => {
    const cls = [];
    const weights = D.ROSTER_COUNTS;
    const posList = [];
    for (const pos in weights) for (let i = 0; i < weights[pos]; i++) posList.push(pos);
    for (let i = 0; i < n; i++) {
      const pos = U.pick(posList);
      const tier = i < 32 ? 67 : i < 96 ? 61 : i < 160 ? 56 : 52;
      const p = Pl.create(lg, pos, { age: U.rndi(21, 23), ovr: Math.round(U.norm(tier, 4)), rookie: true });
      p.pot = U.clamp(Math.round(p.ovr + U.rnd(4, 22) * Pl.devMult(p) * 0.8), p.ovr, 99);
      p.draftGrade = p.ovr * 0.6 + p.pot * 0.4 + U.norm(0, 3);
      cls.push(p);
    }
    return cls.sort((a, b) => b.draftGrade - a.draftGrade);
  };
  S.teamNeed = (lg, t, pos) => {
    const r = L.roster(lg, t).filter((p) => p.pos === pos);
    const need = D.ROSTER_COUNTS[pos] - r.length;
    const best = r.length ? Math.max(...r.map((p) => p.ovr)) : 40;
    return need * 6 + Math.max(0, 75 - best) * 0.6;
  };
  S.runDraft = (lg) => {
    const order = S.draftOrder(lg);
    const rounds = 7;
    const cls = S.makeDraftClass(lg, order.length * rounds + 20);
    const picks = [];
    let pickNo = 0;
    for (let r = 0; r < rounds; r++) {
      for (const tid of order) {
        pickNo++;
        const t = lg.teams[tid];
        let bestI = 0, bestV = -1e9;
        for (let i = 0; i < Math.min(cls.length, 12); i++) {
          const v = cls[i].draftGrade + S.teamNeed(lg, t, cls[i].pos) * 0.5 - i * 0.6 + (cls[i].pos === 'K' || cls[i].pos === 'P' ? -10 : 0);
          if (v > bestV) { bestV = v; bestI = i; }
        }
        const p = cls.splice(bestI, 1)[0];
        p.draft = { yr: lg.year + 1, rd: r + 1, pk: pickNo, team: t.abbr };
        p.con = { sal: Pl.rookieSalary(pickNo), yrs: 4, exp: lg.year + 4 };
        L.addPlayer(lg, p, t);
        picks.push({ pick: pickNo, round: r + 1, team: t.abbr, tid: t.id, pid: p.id, name: Pl.full(p), pos: p.pos, ovr: p.ovr, pot: p.pot });
      }
    }
    // undrafted to FA pool
    for (const p of cls.slice(0, 40)) { p.con = null; L.addPlayer(lg, p, null); }
    lg.lastDraft = picks;
    L.news(lg, `Draft: ${picks[0].team} select ${picks[0].pos} ${picks[0].name} first overall.`, 'draft');
    lg.phase = 'freeagency';
    return picks;
  };

  // Phase 4: free agency + roster balancing
  S.runFreeAgency = (lg) => {
    const userId = PG.Career && PG.Career.userPid ? PG.Career.userPid() : null;
    const fas = () => lg.freeAgents.map((id) => lg.players[id]).filter((p) => p && p.id !== userId).sort((a, b) => b.ovr - a.ovr);
    // teams sign by need
    for (let pass = 0; pass < 4; pass++) {
      for (const t of U.shuffle(lg.teams.slice())) {
        for (const pos of D.POS_ORDER) {
          const have = L.roster(lg, t).filter((p) => p.pos === pos).length;
          if (have >= D.ROSTER_COUNTS[pos]) continue;
          const cand = fas().find((p) => p.pos === pos && Pl.value(p) <= L.capSpace(lg, t) - 2e6);
          if (cand) {
            const yrs = U.rndi(1, cand.age > 30 ? 2 : 4);
            cand.con = { sal: Math.round(Pl.value(cand) * U.rnd(0.9, 1.2) / 10000) * 10000, yrs, exp: lg.year + yrs };
            L.moveTo(lg, cand, t);
            if (cand.ovr >= 78) L.news(lg, `FREE AGENCY: ${t.abbr} sign ${cand.pos} ${Pl.full(cand)} (${U.money(cand.con.sal)}/yr).`, 'fa');
          }
        }
      }
    }
    // fill any remaining holes with generated min-salary players
    for (const t of lg.teams) {
      for (const pos of D.POS_ORDER) {
        let have = L.roster(lg, t).filter((p) => p.pos === pos).length;
        while (have < D.ROSTER_COUNTS[pos]) {
          const p = Pl.create(lg, pos, { ovr: U.rndi(50, 60), age: U.rndi(22, 28) });
          p.con = { sal: D.MIN_SALARY, yrs: 1, exp: lg.year + 1 };
          L.addPlayer(lg, p, t);
          have++;
        }
      }
      // trim excess: cut lowest overall beyond counts + 1
      for (const pos of D.POS_ORDER) {
        const list = L.roster(lg, t).filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
        const max = D.ROSTER_COUNTS[pos] + 1;
        for (const p of list.slice(max)) { if (p.id !== userId) { L.moveTo(lg, p, null); p.con = null; } }
      }
      // cap compliance
      let guard = 0;
      while (L.capSpace(lg, t) < 0 && guard++ < 20) {
        const cut = L.roster(lg, t).filter((p) => p.id !== userId && p.con).sort((a, b) => (b.con.sal / Pl.value(b)) - (a.con.sal / Pl.value(a)))[0];
        if (!cut) break;
        L.moveTo(lg, cut, null); cut.con = null;
        L.news(lg, `${t.abbr} release ${cut.pos} ${Pl.full(cut)} to clear cap space.`, 'fa');
      }
      L.assignNumbers(t, lg);
    }
    // FA pool cleanup (keep it small)
    const pool = fas();
    for (const p of pool.slice(80)) { L.removeFromTeam(lg, p); delete lg.players[p.id]; }
    lg.phase = 'camp';
  };

  S.newSeason = (lg) => {
    lg.year++;
    for (const id in lg.players) {
      const p = lg.players[id];
      p.inj = null;
      if (p.con && p.con.yrs <= 0) p.con.yrs = 1;
    }
    S.startSeason(lg);
  };

  PG.Season = S;
})();
