/* Pixel Gridiron - league creation, rosters, depth charts, schedule, standings */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player;
  const L = {};

  // target overall for a depth slot
  const DEPTH_TARGET = {
    QB: [77, 64, 56], RB: [75, 67, 60], WR: [79, 75, 70, 64, 59, 55], TE: [74, 65, 57],
    OT: [77, 74, 63], OG: [75, 72, 62], C: [75, 62], DE: [78, 74, 66, 59], DT: [76, 71, 61],
    LB: [76, 73, 69, 62, 58, 54], CB: [78, 74, 69, 62, 57], S: [76, 72, 63, 57], K: [76], P: [74],
  };

  L.create = (settings) => {
    const lg = {
      version: 1, year: settings.year || 2026, week: 0, phase: 'preseason',
      settings: Object.assign({ seasonLength: 12, quarterLen: 5, difficulty: 'pro', injuries: true, playingTime: 'earn' }, settings),
      teams: [], players: {}, nextPid: 1, schedule: [], playoffs: null, news: [], records: { season: {}, career: {}, game: {} },
      champions: [], awards: [], freeAgents: [], hof: [], draftOrder: [], transactions: [],
    };
    for (const t of D.TEAMS) {
      const off = U.pick(D.OFF_SCHEMES), def = U.pick(D.DEF_SCHEMES);
      lg.teams.push({
        id: t.id, abbr: t.abbr, city: t.city, name: t.name, c1: t.c1, c2: t.c2, conf: t.conf, div: t.div,
        dome: t.dome, climate: t.climate, stadium: t.stadium,
        coach: { name: U.pick(D.FIRST) + ' ' + U.pick(D.LAST), off: off.id, def: def.id, aggr: U.rnd(0.35, 0.75), age: U.rndi(38, 66) },
        roster: [], w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, cw: 0, cl: 0, streak: 0,
        quality: U.clamp(Math.round(U.norm(0, 4)), -8, 8), prestige: 50, history: [], fans: U.rndi(40, 90),
      });
    }
    for (const team of lg.teams) L.fillRoster(lg, team);
    L.recordBaselines(lg);
    return lg;
  };

  L.fillRoster = (lg, team) => {
    for (const pos of D.POS_ORDER) {
      const n = D.ROSTER_COUNTS[pos];
      for (let i = 0; i < n; i++) {
        const tgt = (DEPTH_TARGET[pos][i] || 55) + team.quality + U.norm(0, 3.2);
        const age = i === 0 ? U.rndi(24, 32) : U.rndi(22, 30);
        const p = Pl.create(lg, pos, { ovr: Math.round(tgt), age });
        L.addPlayer(lg, p, team);
        const yrs = U.rndi(1, 4);
        p.con = { sal: Pl.value(p) * U.rnd(0.85, 1.15), yrs, exp: lg.year + yrs - 1 };
        p.con.sal = Math.round(p.con.sal / 10000) * 10000;
      }
    }
    L.assignNumbers(team, lg);
  };

  L.addPlayer = (lg, p, team) => {
    lg.players[p.id] = p;
    if (team) { p.team = team.id; team.roster.push(p.id); }
    else { p.team = -1; if (!lg.freeAgents.includes(p.id)) lg.freeAgents.push(p.id); }
  };
  L.removeFromTeam = (lg, p) => {
    if (p.team >= 0) {
      const t = lg.teams[p.team];
      t.roster = t.roster.filter((id) => id !== p.id);
    }
    lg.freeAgents = lg.freeAgents.filter((id) => id !== p.id);
    p.team = -1;
  };
  L.moveTo = (lg, p, team) => {
    L.removeFromTeam(lg, p);
    if (team) { p.team = team.id; team.roster.push(p.id); }
    else { lg.freeAgents.push(p.id); }
    L.invalidate(lg);
  };

  L.assignNumbers = (team, lg) => {
    const taken = new Set();
    for (const id of team.roster) {
      const p = lg.players[id];
      if (p.isUser && p.num != null && p.num > 0) { taken.add(p.num); continue; }
    }
    for (const id of team.roster) {
      const p = lg.players[id];
      if (p.isUser) continue;
      if (!p.num || taken.has(p.num)) p.num = Pl.pickNumber(p.pos, taken);
      taken.add(p.num);
    }
  };

  L.team = (lg, id) => lg.teams[id];
  L.roster = (lg, team) => team.roster.map((id) => lg.players[id]).filter(Boolean);
  L.teamName = (t) => t.city + ' ' + t.name;

  // ---- depth chart (cached per call batch) ----
  let depthCache = new Map();
  L.invalidate = () => { depthCache = new Map(); };
  L.depth = (lg, team, includeInjured) => {
    const key = team.id + (includeInjured ? 'i' : '');
    if (depthCache.has(key)) return depthCache.get(key);
    const d = {};
    for (const pos of D.POS_ORDER) d[pos] = [];
    for (const p of L.roster(lg, team)) {
      if (!includeInjured && p.inj && p.inj.wks > 0) continue;
      d[p.pos].push(p);
    }
    const userPT = lg.settings.playingTime === 'starter';
    for (const pos in d) {
      d[pos].sort((a, b) => {
        if (userPT && a.isUser) return -1;
        if (userPT && b.isUser) return 1;
        const ao = a.ovr + (a.isUser ? (a.campBonus || 0) : 0);
        const bo = b.ovr + (b.isUser ? (b.campBonus || 0) : 0);
        return bo - ao;
      });
    }
    // emergency fill
    const fill = (pos, from) => {
      if (d[pos].length >= 2) return;
      for (const f of from) for (const p of d[f]) if (!d[pos].includes(p) && d[pos].length < 3) d[pos].push(p);
    };
    fill('QB', ['RB', 'WR']); fill('RB', ['WR', 'TE']); fill('WR', ['TE', 'RB', 'CB']); fill('TE', ['OT', 'WR']);
    fill('OT', ['OG', 'C']); fill('OG', ['OT', 'C']); fill('C', ['OG']); fill('DE', ['DT', 'LB']); fill('DT', ['DE']);
    fill('LB', ['S', 'DE']); fill('CB', ['S']); fill('S', ['CB', 'LB']); fill('K', ['P']); fill('P', ['K']);
    depthCache.set(key, d);
    return d;
  };

  // ---- team ratings ----
  L.ratings = (lg, team) => {
    const d = L.depth(lg, team);
    const g = (pos, i) => (d[pos][i] ? d[pos][i].ovr : 45);
    const avg = (pos, n) => { let s = 0; for (let i = 0; i < n; i++) s += g(pos, i); return s / n; };
    const qb = g('QB', 0);
    const ol = (avg('OT', 2) * 2 + avg('OG', 2) * 2 + g('C', 0)) / 5;
    const wr = (g('WR', 0) * 0.4 + g('WR', 1) * 0.35 + g('WR', 2) * 0.25);
    const te = g('TE', 0), rb = g('RB', 0);
    const dl = (avg('DE', 2) * 2 + avg('DT', 2) * 2) / 4;
    const lb = avg('LB', 3), cb = avg('CB', 3), s = avg('S', 2);
    const off = qb * 0.36 + ol * 0.2 + wr * 0.22 + te * 0.08 + rb * 0.14;
    const def = dl * 0.32 + lb * 0.22 + cb * 0.28 + s * 0.18;
    const st = (g('K', 0) + g('P', 0)) / 2;
    const ovr = Math.round(off * 0.5 + def * 0.44 + st * 0.06);
    return { qb, ol, wr, te, rb, dl, lb, cb, s, off: Math.round(off), def: Math.round(def), st: Math.round(st), ovr,
      passOff: qb * 0.5 + wr * 0.3 + te * 0.08 + ol * 0.12, runOff: rb * 0.45 + ol * 0.45 + qb * 0.1,
      passDef: cb * 0.38 + s * 0.22 + lb * 0.15 + dl * 0.25, runDef: dl * 0.45 + lb * 0.4 + s * 0.15,
      passRush: dl * 0.75 + lb * 0.25, passPro: ol * 0.85 + te * 0.05 + rb * 0.1 };
  };

  L.payroll = (lg, team) => U.sum(L.roster(lg, team), (p) => (p.con ? p.con.sal : 0));
  L.capSpace = (lg, team) => D.SALARY_CAP - L.payroll(lg, team);

  // ---- schedule: random perfect matchings avoiding repeats; division games twice when possible ----
  L.makeSchedule = (lg) => {
    const N = lg.settings.seasonLength;
    const teams = lg.teams.map((t) => t.id);
    const met = {};
    const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
    const sameDiv = (a, b) => lg.teams[a].conf === lg.teams[b].conf && lg.teams[a].div === lg.teams[b].div;
    const homeCount = {}; teams.forEach((t) => (homeCount[t] = 0));
    const weeks = [];
    for (let w = 0; w < N; w++) {
      let best = null;
      const divWeek = N >= 10 && (w % Math.max(2, Math.floor(N / 6)) === 0);
      for (let attempt = 0; attempt < 300 && !best; attempt++) {
        const pool = U.shuffle(teams.slice());
        const pairs = [];
        const used = new Set();
        let ok = true;
        for (const a of pool) {
          if (used.has(a)) continue;
          let cands = pool.filter((b) => b !== a && !used.has(b));
          const allowedMeet = (b) => (met[key(a, b)] || 0) < (sameDiv(a, b) ? 2 : 1);
          cands = cands.filter(allowedMeet);
          if (divWeek && attempt < 150) {
            const dc = cands.filter((b) => sameDiv(a, b));
            if (dc.length) cands = dc;
          } else if (attempt < 200) {
            // prefer conference opponents a bit
            const cc = cands.filter((b) => lg.teams[a].conf === lg.teams[b].conf && !sameDiv(a, b));
            if (cc.length && Math.random() < 0.55) cands = cc;
          }
          if (!cands.length) { ok = false; break; }
          const b = U.pick(cands);
          used.add(a); used.add(b);
          pairs.push([a, b]);
        }
        if (ok && pairs.length === teams.length / 2) best = pairs;
      }
      if (!best) { // fallback: allow repeats
        const pool = U.shuffle(teams.slice());
        best = [];
        for (let i = 0; i < pool.length; i += 2) best.push([pool[i], pool[i + 1]]);
      }
      const games = best.map(([a, b]) => {
        met[key(a, b)] = (met[key(a, b)] || 0) + 1;
        let h = a, aw = b;
        if (homeCount[a] > homeCount[b] || (homeCount[a] === homeCount[b] && Math.random() < 0.5)) { h = b; aw = a; }
        homeCount[h]++;
        return { h, a: aw, played: false, hs: 0, as: 0, night: false };
      });
      // one primetime game per week
      U.pick(games).night = true;
      weeks.push(games);
    }
    lg.schedule = weeks;
  };

  L.gameFor = (lg, week, teamId) => {
    const wk = lg.schedule[week - 1];
    if (!wk) return null;
    return wk.find((g) => g.h === teamId || g.a === teamId) || null;
  };

  // ---- standings ----
  L.pct = (t) => { const g = t.w + t.l + t.t; return g ? (t.w + t.t * 0.5) / g : 0; };
  L.sortTeams = (teams) => teams.slice().sort((a, b) => {
    const d = L.pct(b) - L.pct(a);
    if (Math.abs(d) > 1e-9) return d;
    const dd = (b.dw - b.dl) - (a.dw - a.dl);
    if (dd) return dd;
    const cd = (b.cw - b.cl) - (a.cw - a.cl);
    if (cd) return cd;
    return (b.pf - b.pa) - (a.pf - a.pa);
  });
  L.division = (lg, conf, div) => L.sortTeams(lg.teams.filter((t) => t.conf === conf && t.div === div));
  L.conference = (lg, conf) => L.sortTeams(lg.teams.filter((t) => t.conf === conf));
  L.record = (t) => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;

  L.seeds = (lg, conf) => {
    const winners = [];
    for (let d = 0; d < 4; d++) winners.push(L.division(lg, conf, d)[0]);
    const sortedW = L.sortTeams(winners);
    const rest = L.sortTeams(lg.teams.filter((t) => t.conf === conf && !winners.includes(t)));
    return sortedW.concat(rest.slice(0, 3));
  };

  L.applyResult = (lg, g, hs, as) => {
    g.played = true; g.hs = hs; g.as = as;
    const h = lg.teams[g.h], a = lg.teams[g.a];
    h.pf += hs; h.pa += as; a.pf += as; a.pa += hs;
    const sameDiv = h.conf === a.conf && h.div === a.div, sameConf = h.conf === a.conf;
    if (hs > as) {
      h.w++; a.l++; h.streak = h.streak > 0 ? h.streak + 1 : 1; a.streak = a.streak < 0 ? a.streak - 1 : -1;
      if (sameDiv) { h.dw++; a.dl++; }
      if (sameConf) { h.cw++; a.cl++; }
    } else if (as > hs) {
      a.w++; h.l++; a.streak = a.streak > 0 ? a.streak + 1 : 1; h.streak = h.streak < 0 ? h.streak - 1 : -1;
      if (sameDiv) { a.dw++; h.dl++; }
      if (sameConf) { a.cw++; h.cl++; }
    } else { h.t++; a.t++; h.streak = 0; a.streak = 0; }
  };

  L.news = (lg, text, type) => {
    lg.news.unshift({ y: lg.year, w: lg.week, text, type: type || 'gen' });
    if (lg.news.length > 120) lg.news.length = 120;
  };

  // ---- records ----
  const REC_KEYS = { pYds: 'Passing Yards', pTD: 'Passing TDs', rYds: 'Rushing Yards', rTD: 'Rushing TDs', recYds: 'Receiving Yards',
    rec: 'Receptions', recTD: 'Receiving TDs', sck: 'Sacks', dInt: 'Interceptions', tkl: 'Tackles' };
  L.REC_KEYS = REC_KEYS;
  L.recordBaselines = (lg) => {
    // historical league records scaled to season length & quarter length
    const scale = (lg.settings.seasonLength / 17) * Math.min(1, (lg.settings.quarterLen / 15) * 1.25 + 0.05);
    const gScale = Math.min(1, (lg.settings.quarterLen / 15) * 1.25 + 0.05);
    const base = { pYds: 5400, pTD: 52, rYds: 2100, rTD: 26, recYds: 1950, rec: 145, recTD: 22, sck: 23, dInt: 13, tkl: 170 };
    const gbase = { pYds: 520, pTD: 7, rYds: 295, rTD: 5, recYds: 330, rec: 18, recTD: 4, sck: 6, dInt: 4, tkl: 22 };
    const cbase = { pYds: 80000, pTD: 590, rYds: 18000, rTD: 160, recYds: 22000, rec: 1500, recTD: 190, sck: 200, dInt: 80, tkl: 2050 };
    const legend = () => U.pick(D.FIRST) + ' ' + U.pick(D.LAST);
    for (const k in REC_KEYS) {
      lg.records.season[k] = { v: Math.round(base[k] * scale * U.rnd(0.85, 1.0)), name: legend(), year: lg.year - U.rndi(1, 40), team: U.pick(lg.teams).abbr };
      lg.records.game[k] = { v: Math.max(1, Math.round(gbase[k] * gScale * U.rnd(0.85, 1.0))), name: legend(), year: lg.year - U.rndi(1, 40), team: U.pick(lg.teams).abbr };
      lg.records.career[k] = { v: Math.round(cbase[k] * scale * U.rnd(0.8, 1.0)), name: legend(), year: lg.year - U.rndi(1, 15), team: U.pick(lg.teams).abbr };
    }
  };
  L.checkRecords = (lg, kind, p, stats) => {
    const broke = [];
    const tbl = lg.records[kind];
    for (const k in REC_KEYS) {
      const v = stats[k] || 0;
      if (v > 0 && tbl[k] && v > tbl[k].v) {
        const prevHolder = tbl[k].pid === p.id;
        tbl[k] = { v, name: Pl.full(p), pid: p.id, year: lg.year, team: p.team >= 0 ? lg.teams[p.team].abbr : 'FA' };
        if (!prevHolder) broke.push(k);
      }
    }
    return broke;
  };

  PG.League = L;
})();
