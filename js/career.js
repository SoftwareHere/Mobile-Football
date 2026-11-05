/* Pixel Gridiron - the user's career: creation, draft, XP/levels, training, money, contracts, goals, legacy */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D, Pl = PG.Player, L = PG.League, S = PG.Season;
  const C = {};
  C.cur = null; // {career, lg}

  C.userPid = () => (C.cur ? C.cur.career.pid : null);
  C.user = () => (C.cur ? C.cur.lg.players[C.cur.career.pid] : null);
  C.userTeamId = (lg) => { const u = C.user(); return u ? u.team : -1; };
  C.userTeam = () => { const u = C.user(); return u && u.team >= 0 ? C.cur.lg.teams[u.team] : null; };
  C.hasStaff = (id) => !!(C.cur && C.cur.career.staff[id]);
  C.hasPerk = (id) => !!(C.cur && C.cur.career.perks.equipped.includes(id));
  C.settings = () => (C.cur ? C.cur.career.settings : C.defaultSettings());
  C.defaultSettings = () => ({ autoRoute: false, aimMode: 'pull', sfx: true, music: true, vibrate: true, slowmo: true, catchQB: false, showRoutes: true });

  // ------------------------------------------------------------------ creation
  C.newCareer = (opts) => {
    const lg = L.create({ seasonLength: opts.seasonLength, quarterLen: opts.quarterLen, difficulty: opts.difficulty, injuries: opts.injuries, playingTime: opts.playingTime, year: 2026 });
    const p = C.makeUserPlayer(lg, opts);
    const career = {
      pid: p.id, startYear: lg.year, xp: 0, level: 1, sp: 6, money: 50000, energy: 100, trust: 50, chem: 50, fans: 1200, morale: 70,
      legacyBonus: 0, perks: { owned: [], equipped: [] }, gear: { owned: [], eq: {} }, life: { house: 0, car: 0 }, staff: {},
      celebs: { owned: ['spike', 'flex'], eq: 'spike' }, endorsements: [], offers: [], actions: 3, maxActions: 3,
      goals: [], gameGoals: [], history: [], gameLog: [], timeline: [], event: null, settings: Object.assign(C.defaultSettings(), opts.settings || {}),
      nickname: '', contractTalk: null, tradeReq: false, retired: false, hof: false, weekDone: {}, combine: null, milestones: {},
      seasonsPlayed: 0, totalEarned: 0,
    };
    C.cur = { career, lg };
    career.combine = C.runCombine(p);
    return C.cur;
  };

  C.makeUserPlayer = (lg, o) => {
    const pos = o.pos;
    const def = D.POS[pos];
    const p = Pl.create(lg, pos, { age: 21, ovr: 60, dev: 'superstar', rookie: true });
    p.fn = o.first || p.fn; p.ln = o.last || p.ln;
    p.ht = o.ht || p.ht; p.wt = o.wt || p.wt;
    p.college = o.college || p.college; p.home = o.home || U.pick(D.HOMETOWNS);
    p.num = o.num != null ? o.num : Pl.pickNumber(pos);
    p.isUser = true;
    p.arch = o.arch;
    p.look = Object.assign({ skin: 2, hair: 1, hairC: 0, face: 0, visor: 'none', sleeves: 0, sleeveC: 'team', gloves: 'team', cleats: 'team', eyeblack: 0, lefty: false }, o.look || {});
    // base attributes from position means, then archetype
    for (const k of def.all) { const m = def.m[k] || [50, 10]; p.r[k] = Math.round(m[0] - 6 + U.rnd(-2, 2)); }
    const arch = (D.ARCHETYPES[pos] || []).find((a) => a.id === o.arch);
    if (arch) for (const k in arch.mod) if (p.r[k] != null) p.r[k] = U.clamp(p.r[k] + arch.mod[k], 25, 95);
    // body influence
    const hT = (p.ht - def.ht[0]) / Math.max(1, def.ht[1] - def.ht[0]);
    const wT = (p.wt - def.wt[0]) / Math.max(1, def.wt[1] - def.wt[0]);
    if (p.r.jmp != null) p.r.jmp = U.clamp(p.r.jmp + Math.round((hT - 0.5) * 8), 25, 95);
    p.r.spd = U.clamp(p.r.spd - Math.round((wT - 0.5) * 6), 25, 95);
    p.r.str = U.clamp(p.r.str + Math.round((wT - 0.5) * 8), 25, 95);
    if (p.r.btk != null) p.r.btk = U.clamp(p.r.btk + Math.round((wT - 0.5) * 6), 25, 95);
    Pl.refresh(p);
    // scale to a rookie-level overall
    const target = U.rndi(65, 68);
    Pl.setOvr(p, target);
    p.pot = 99;
    lg.players[p.id] = p;
    p.team = -1;
    return p;
  };

  C.runCombine = (p) => {
    const a = (k) => Pl.attr(p, k);
    const r = {
      forty: U.round1((4.25 + (99 - a('spd')) * 0.021 + (p.wt - 200) * 0.0018 + U.rnd(-0.04, 0.04)) * 100) / 100,
      bench: Math.max(4, Math.round(6 + (a('str') - 40) * 0.42 + U.rnd(-2, 2))),
      vert: U.round1(26 + ((p.r.jmp != null ? a('jmp') : a('acc')) - 50) * 0.32 + U.rnd(-1, 1)),
      broad: Math.round(100 + (a('acc') - 50) * 0.55 + U.rnd(-3, 3)),
      cone: Math.round((7.6 - (a('agi') - 50) * 0.022 + U.rnd(-0.05, 0.05)) * 100) / 100,
      shuttle: Math.round((4.7 - (a('acc') - 50) * 0.012 + U.rnd(-0.04, 0.04)) * 100) / 100,
    };
    r.forty = Math.round(r.forty * 100) / 100;
    r.grade = U.clamp(Math.round(p.ovr + U.norm(0, 3) + 6), 55, 85);
    return r;
  };

  // place the user into the league via the draft. returns draft info
  C.draftUser = (bonus) => {
    const { lg, career } = C.cur;
    const p = C.user();
    // order: weakest teams first (no prior season)
    const order = lg.teams.slice().sort((a, b) => L.ratings(lg, a).ovr - L.ratings(lg, b).ovr).map((t) => t.id);
    const val = career.combine.grade + (bonus || 0) + U.norm(0, 3);
    let pick = Math.round(U.clamp(110 - (val - 55) * 3.6, 1, 96));
    const round = Math.ceil(pick / 32);
    const slotIdx = (pick - 1) % 32;
    // nearby teams with the biggest need at the user's position
    let bestT = order[slotIdx], bestN = -1e9;
    for (let d = -3; d <= 3; d++) {
      const i = slotIdx + d; if (i < 0 || i >= 32) continue;
      const t = lg.teams[order[i]];
      const n = S.teamNeed(lg, t, p.pos) + (lg.teams[order[i]].roster.length ? 0 : 0) - Math.abs(d) * 2 + U.rnd(0, 4);
      const best = L.roster(lg, t).filter((x) => x.pos === p.pos).sort((x, y) => y.ovr - x.ovr);
      const starterGap = best[0] ? 72 - best[0].ovr : 10;
      const score = n + starterGap * 1.5;
      if (score > bestN) { bestN = score; bestT = order[i]; pick = round * 32 - 32 + i + 1; }
    }
    const team = lg.teams[bestT];
    // make room: release the lowest player at that position
    const same = L.roster(lg, team).filter((x) => x.pos === p.pos).sort((a, b) => a.ovr - b.ovr);
    if (same.length >= D.ROSTER_COUNTS[p.pos]) { const cut = same[0]; L.moveTo(lg, cut, null); cut.con = null; }
    // shape the depth chart so a rookie can compete for snaps
    const playable = { QB: 1, RB: 1, WR: 3, TE: 1, LB: 3, CB: 3, S: 2 }[p.pos] || 1;
    const ahead = L.roster(lg, team).filter((x) => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
    ahead.forEach((x, i) => {
      if (i < playable - 1) { if (x.ovr > p.ovr + 8) Pl.setOvr(x, p.ovr + U.rndi(3, 8)); }
      else if (i === playable - 1 && playable === 1) { if (x.ovr > p.ovr + 5 || x.ovr < p.ovr) Pl.setOvr(x, p.ovr + U.rndi(2, 5)); }
      else if (x.ovr >= p.ovr) Pl.setOvr(x, p.ovr - U.rndi(1, 4));
    });
    L.addPlayer(lg, p, team);
    lg.freeAgents = lg.freeAgents.filter((id) => id !== p.id);
    const sal = Pl.rookieSalary(pick);
    const yrs = 4;
    p.con = { sal, yrs, exp: lg.year + yrs - 1, bonus: Math.round(sal * 0.6) };
    p.draft = { yr: lg.year, rd: Math.ceil(pick / 32), pk: pick, team: team.abbr };
    career.money += p.con.bonus;
    career.totalEarned += p.con.bonus;
    L.assignNumbers(team, lg);
    if (team.roster.some((id) => id !== p.id && lg.players[id].num === p.num)) {
      const other = L.roster(lg, team).find((x) => x.id !== p.id && x.num === p.num);
      if (other) other.num = Pl.pickNumber(other.pos, new Set(L.roster(lg, team).map((x) => x.num)));
    }
    C.log(`Drafted by the ${L.teamName(team)} — Round ${p.draft.rd}, Pick ${pick} (#${pick} overall).`);
    L.news(lg, `DRAFT: ${team.abbr} select ${p.pos} ${Pl.full(p)} (${p.college}) at #${pick} overall.`, 'draft');
    lg.phase = 'camp'; lg.firstCamp = true;
    L.invalidate();
    return { pick, round: p.draft.rd, team };
  };

  C.log = (text) => {
    const { career, lg } = C.cur;
    career.timeline.unshift({ y: lg.year, w: lg.week, text });
    if (career.timeline.length > 150) career.timeline.length = 150;
  };

  // ------------------------------------------------------------------ XP / levels
  C.xpNeeded = (level) => 700 + level * 70;
  C.addXP = (amt, why) => {
    const { career } = C.cur;
    let mult = 1;
    if (C.hasPerk('filmjunkie')) mult += 0.15;
    const diff = D.DIFFICULTY.find((d) => d.id === C.cur.lg.settings.difficulty) || D.DIFFICULTY[1];
    mult *= diff.xp;
    amt = Math.round(amt * mult);
    career.xp += amt;
    const levels = [];
    while (career.xp >= C.xpNeeded(career.level)) {
      career.xp -= C.xpNeeded(career.level);
      career.level++;
      const gain = 5 + (career.level % 5 === 0 ? 3 : 0);
      career.sp += gain;
      levels.push(career.level);
      C.log(`Reached level ${career.level} (+${gain} skill points).`);
    }
    return { amt, levels };
  };
  C.upgradeCost = (v) => (v < 70 ? 1 : v < 80 ? 1 : v < 85 ? 2 : v < 90 ? 2 : v < 95 ? 3 : 4);
  C.upgrade = (k) => {
    const p = C.user(), { career } = C.cur;
    const v = p.r[k];
    if (v == null || v >= 99) return false;
    const cost = C.upgradeCost(v);
    if (career.sp < cost) return false;
    career.sp -= cost; p.r[k] = v + 1;
    Pl.refresh(p); L.invalidate();
    return true;
  };
  C.buyPerk = (id) => {
    const { career } = C.cur, pk = D.perk(id);
    if (!pk || career.perks.owned.includes(id) || career.level < pk.lvl || career.sp < pk.cost) return false;
    career.sp -= pk.cost; career.perks.owned.push(id);
    if (career.perks.equipped.length < D.PERK_SLOTS(career.level)) career.perks.equipped.push(id);
    return true;
  };
  C.togglePerk = (id) => {
    const { career } = C.cur;
    const eq = career.perks.equipped;
    if (eq.includes(id)) { career.perks.equipped = eq.filter((x) => x !== id); return true; }
    if (!career.perks.owned.includes(id) || eq.length >= D.PERK_SLOTS(career.level)) return false;
    eq.push(id); return true;
  };
  C.perksFor = (pos) => D.PERKS.filter((pk) => pk.pos === 'all' || pk.pos.includes(pos));

  // ------------------------------------------------------------------ gear & money
  C.applyGear = () => {
    const p = C.user(), { career } = C.cur;
    const b = {};
    for (const slot in career.gear.eq) {
      const it = D.SHOP.find((x) => x.id === career.gear.eq[slot]);
      if (it) for (const k in it.bonus) b[k] = (b[k] || 0) + it.bonus[k];
    }
    p.bonus = b;
    Pl.refresh(p);
  };
  C.buyGear = (id) => {
    const { career } = C.cur, it = D.SHOP.find((x) => x.id === id);
    if (!it || career.gear.owned.includes(id) || career.money < it.price) return false;
    career.money -= it.price; career.gear.owned.push(id); career.gear.eq[it.slot] = id;
    C.applyGear(); return true;
  };
  C.equipGear = (id) => {
    const { career } = C.cur, it = D.SHOP.find((x) => x.id === id);
    if (!it || !career.gear.owned.includes(id)) return false;
    if (career.gear.eq[it.slot] === id) delete career.gear.eq[it.slot]; else career.gear.eq[it.slot] = id;
    C.applyGear(); return true;
  };
  C.buyLife = (kind, tier) => {
    const { career } = C.cur, cat = D.LIFESTYLE.find((x) => x.id === kind);
    const t = cat.tiers[tier];
    if (!t || career.life[kind] >= tier || career.money < t.price) return false;
    career.money -= t.price; career.life[kind] = tier;
    career.fans += t.fans; career.morale = U.clamp(career.morale + t.morale, 0, 100);
    C.log(`Bought a ${t.name}.`);
    return true;
  };
  C.toggleStaff = (id) => { const { career } = C.cur; career.staff[id] = !career.staff[id]; };
  C.buyCeleb = (id) => {
    const { career } = C.cur, c = D.CELEBRATIONS.find((x) => x.id === id);
    if (!c || career.celebs.owned.includes(id)) return false;
    if (career.level < c.lvl || career.money < c.price) return false;
    career.money -= c.price; career.celebs.owned.push(id); career.celebs.eq = id; return true;
  };
  C.celebsUnlocked = () => {
    const { career } = C.cur;
    for (const c of D.CELEBRATIONS) if (c.price === 0 && career.level >= c.lvl && !career.celebs.owned.includes(c.id)) career.celebs.owned.push(c.id);
  };

  // ------------------------------------------------------------------ weekly loop
  C.weekStart = () => {
    const { career, lg } = C.cur;
    const p = C.user();
    career.actions = career.maxActions;
    career.energy = U.clamp(career.energy + (C.hasStaff('chef') ? 45 : 30), 0, 100);
    // pay
    const inSeason = lg.phase === 'regular' || lg.phase === 'playoffs';
    let income = 0, costs = 0;
    if (inSeason && p.con) income += p.con.sal / lg.settings.seasonLength * (lg.phase === 'playoffs' ? 0.15 : 1);
    for (const e of career.endorsements) { income += e.weekly; e.weeks--; }
    const expired = career.endorsements.filter((e) => e.weeks <= 0);
    career.endorsements = career.endorsements.filter((e) => e.weeks > 0);
    for (const e of expired) C.log(`Endorsement with ${e.brand} ended.`);
    for (const s of D.STAFF) if (career.staff[s.id]) costs += s.weekly;
    const agentFee = income * 0.03;
    career.money += income - costs - agentFee;
    career.totalEarned += income;
    career.lastWeek = { income: Math.round(income), costs: Math.round(costs + agentFee) };
    // morale drift
    career.morale = U.clamp(career.morale + (career.trust > 60 ? 1 : career.trust < 35 ? -2 : 0), 0, 100);
    // random event
    career.event = Math.random() < 0.45 ? U.rndi(0, D.EVENTS.length - 1) : null;
    // endorsement offers
    C.rollEndorsements();
    // weekly game goals
    C.makeGameGoals();
    C.celebsUnlocked();
  };

  C.rollEndorsements = () => {
    const { career } = C.cur;
    if (career.offers.length >= 2 || Math.random() > 0.3) return;
    const f = career.fans;
    const tier = f > 2e6 ? 5 : f > 5e5 ? 4 : f > 1.2e5 ? 3 : f > 3e4 ? 2 : f > 6000 ? 1 : 0;
    if (tier === 0 && Math.random() < 0.6) return;
    const taken = new Set(career.endorsements.map((e) => e.brand).concat(career.offers.map((o) => o.brand)));
    const brand = U.pick(D.BRANDS.filter((b) => !taken.has(b.name)));
    if (!brand) return;
    let weekly = [2500, 8000, 22000, 55000, 120000, 260000][tier] * U.rnd(0.8, 1.3);
    if (C.hasStaff('agent')) weekly *= 1.1;
    career.offers.push({ brand: brand.name, cat: brand.cat, weekly: Math.round(weekly / 100) * 100, weeks: U.rndi(8, 30), fans: Math.round(weekly / 10) });
  };
  C.acceptOffer = (i) => {
    const { career } = C.cur;
    const o = career.offers.splice(i, 1)[0];
    if (!o) return;
    career.endorsements.push(o);
    career.fans += o.fans;
    C.log(`Signed an endorsement deal with ${o.brand} (${U.money(o.weekly)}/week).`);
  };
  C.declineOffer = (i) => { C.cur.career.offers.splice(i, 1); };

  C.applyFx = (fx) => {
    const { career } = C.cur;
    const out = [];
    const pr = C.hasStaff('pr') ? 1.3 : 1;
    if (fx.fans) { const v = Math.round(fx.fans * (fx.fans > 0 ? pr : 1)); career.fans = Math.max(100, career.fans + v); out.push(`${v > 0 ? '+' : ''}${U.num(v)} fans`); }
    if (fx.trust) { career.trust = U.clamp(career.trust + fx.trust, 0, 100); out.push(`${fx.trust > 0 ? '+' : ''}${fx.trust} coach trust`); }
    if (fx.chem) { career.chem = U.clamp(career.chem + fx.chem, 0, 100); out.push(`${fx.chem > 0 ? '+' : ''}${fx.chem} chemistry`); }
    if (fx.morale) { career.morale = U.clamp(career.morale + fx.morale, 0, 100); out.push(`${fx.morale > 0 ? '+' : ''}${fx.morale} morale`); }
    if (fx.money) { career.money += fx.money; out.push(`${fx.money > 0 ? '+' : ''}${U.money(fx.money)}`); }
    if (fx.energy) { career.energy = U.clamp(career.energy + fx.energy, 0, 100); out.push(`${fx.energy > 0 ? '+' : ''}${fx.energy} energy`); }
    if (fx.legacy) { career.legacyBonus += fx.legacy * 5; out.push('+legacy'); }
    if (fx.focus) { career.focus = (career.focus || 0) + fx.focus; out.push('more targets'); }
    if (fx.xp) { const r = C.addXP(fx.xp); out.push(`+${r.amt} XP`); }
    return out.join(', ');
  };
  C.resolveEvent = (optIdx) => {
    const { career } = C.cur;
    const ev = D.EVENTS[career.event];
    if (!ev) return '';
    career.event = null;
    const o = ev.opts[optIdx];
    C.log(`${ev.title}: ${o.t}`);
    return C.applyFx(o.fx);
  };

  // Training activities. score: 0..1 from minigame (optional)
  C.TRAININGS = [
    { id: 'position', name: 'Position Drills', energy: 18, desc: 'Work your craft. Big XP, chance to boost a key skill.' },
    { id: 'speed', name: 'Speed & Agility', energy: 20, desc: 'Sprints and ladders. Chance at SPD/ACC/AGI.' },
    { id: 'strength', name: 'Weight Room', energy: 20, desc: 'Get stronger. Chance at STR and power skills.' },
    { id: 'film', name: 'Film Study', energy: 6, desc: 'Learn the playbook. XP, awareness and coach trust.' },
    { id: 'bond', name: 'Team Bonding', energy: 8, desc: 'Build chemistry with teammates and coaches.' },
    { id: 'media', name: 'Media Tour', energy: 10, desc: 'Grow your brand. Fans and sponsor interest.' },
    { id: 'rest', name: 'Recovery Day', energy: -30, desc: 'Ice bath and massage. Restore energy, heal faster.' },
  ];
  C.keyAttrs = (pos) => {
    const w = D.POS[pos].w;
    return Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 6);
  };
  C.train = (id, score) => {
    const { career } = C.cur, p = C.user();
    const t = C.TRAININGS.find((x) => x.id === id);
    if (!t || career.actions <= 0) return null;
    if (t.energy > 0 && career.energy < t.energy) return { err: 'Not enough energy. Rest up first.' };
    career.actions--;
    career.energy = U.clamp(career.energy - t.energy, 0, 100);
    const sc = score == null ? 0.5 : U.clamp(score, 0, 1);
    const trainer = C.hasStaff('trainer') ? 1.25 : 1;
    const msgs = [];
    const bump = (keys, chance) => {
      if (Math.random() < chance) {
        const k = U.pick(keys.filter((x) => p.r[x] != null && p.r[x] < 99));
        if (k) { p.r[k]++; Pl.refresh(p); msgs.push(`+1 ${D.ATTRS[k][0]}`); }
      }
    };
    let xp = 0;
    if (id === 'position') { xp = 180 + sc * 220; bump(C.keyAttrs(p.pos), 0.25 + sc * 0.35); }
    else if (id === 'speed') { xp = 130 + sc * 150; bump(['spd', 'acc', 'agi'], 0.22 + sc * 0.3); }
    else if (id === 'strength') { xp = 130 + sc * 150; bump(['str', 'btk', 'stf', 'pbk', 'rbk', 'bsh', 'tak', 'hit', 'thp'], 0.3 + sc * 0.3); }
    else if (id === 'film') { xp = 140; bump(['awr', 'prc', 'zcv', 'rte'], 0.25); career.trust = U.clamp(career.trust + 2, 0, 100); msgs.push('+2 coach trust'); }
    else if (id === 'bond') { xp = 40; career.chem = U.clamp(career.chem + 6 * (C.hasPerk('leader') ? 1.5 : 1), 0, 100); career.trust = U.clamp(career.trust + 1, 0, 100); msgs.push('+chemistry'); }
    else if (id === 'media') { xp = 30; const f = Math.round(career.fans * 0.04 + 400) * (C.hasStaff('pr') ? 1.3 : 1); career.fans += f; msgs.push(`+${U.num(f)} fans`); if (Math.random() < 0.5) { C.rollEndorsements(); } }
    else if (id === 'rest') { xp = 0; if (p.inj && Math.random() < 0.4) { p.inj.wks = Math.max(0, p.inj.wks - 1); msgs.push('Injury healing faster'); if (p.inj.wks === 0) p.inj = null; } msgs.push('Energy restored'); }
    if (id !== 'rest' && id !== 'bond' && id !== 'media') xp *= trainer;
    if (career.energy < 25 && t.energy > 0 && Math.random() < 0.06 && C.cur.lg.settings.injuries) {
      const inj = S.rollInjury(p, 0.4);
      msgs.push(`Overworked! ${inj.name} (${inj.wks} wk)`);
    }
    const r = xp > 0 ? C.addXP(xp) : { amt: 0, levels: [] };
    if (r.amt) msgs.unshift(`+${r.amt} XP`);
    L.invalidate();
    return { msgs, levels: r.levels };
  };

  // ------------------------------------------------------------------ goals
  C.expected = (pos) => {
    // expected per-game production for a starter, scaled by quarter length
    const q = C.cur.lg.settings.quarterLen;
    const f = Math.min(1.1, q / 15 * 1.12 + 0.06);
    const base = { QB: { pYds: 240, pTD: 1.6 }, RB: { rYds: 75, rTD: 0.6, rec: 2.5 }, WR: { recYds: 65, rec: 5, recTD: 0.45 },
      TE: { recYds: 40, rec: 3.5, recTD: 0.35 }, LB: { tkl: 6.5, sck: 0.3 }, CB: { tkl: 4, pd: 0.8, dInt: 0.15 }, S: { tkl: 5, pd: 0.5, dInt: 0.15 } };
    const b = base[pos] || {};
    const out = {};
    for (const k in b) out[k] = b[k] * f;
    return out;
  };
  const GOAL_NAMES = { pYds: 'passing yards', pTD: 'passing TDs', rYds: 'rushing yards', rTD: 'rushing TDs', recYds: 'receiving yards',
    rec: 'receptions', recTD: 'receiving TDs', tkl: 'tackles', sck: 'sacks', pd: 'passes defended', dInt: 'interceptions' };
  C.GOAL_NAMES = GOAL_NAMES;
  C.seasonStart = () => {
    const { career, lg } = C.cur;
    const p = C.user();
    const exp = C.expected(p.pos);
    const g = lg.settings.seasonLength;
    const lvl = U.clamp((p.ovr - 60) / 30, 0, 1);
    career.goals = [];
    const keys = Object.keys(exp).slice(0, 2);
    for (const k of keys) {
      const target = Math.max(1, Math.round(exp[k] * g * (0.65 + lvl * 0.55) / (k.endsWith('Yds') ? 10 : 1)) * (k.endsWith('Yds') ? 10 : 1));
      career.goals.push({ key: k, target, text: `${U.num(target)} ${GOAL_NAMES[k]}`, xp: 600, done: false });
    }
    career.goals.push({ key: 'wins', target: Math.ceil(g * 0.55), text: `Win ${Math.ceil(g * 0.55)} games`, xp: 500, done: false });
    career.goals.push({ key: 'playoffs', target: 1, text: 'Make the playoffs', xp: 800, done: false });
    career.gameLog = [];
    career.seasonStartOvr = p.ovr;
    C.weekStart();
  };
  C.makeGameGoals = () => {
    const { career } = C.cur;
    const p = C.user();
    const exp = C.expected(p.pos);
    const keys = U.shuffle(Object.keys(exp)).slice(0, 2);
    career.gameGoals = keys.map((k) => {
      let t = exp[k] * U.rnd(1.0, 1.4);
      t = k.endsWith('Yds') ? Math.max(10, Math.round(t / 5) * 5) : Math.max(1, Math.round(t));
      return { key: k, target: t, text: `${t} ${GOAL_NAMES[k]}`, xp: 150, done: false };
    });
    career.gameGoals.push({ key: 'win', target: 1, text: 'Win the game', xp: 150, done: false });
  };
  C.checkSeasonGoals = () => {
    const { career, lg } = C.cur;
    const p = C.user(), t = C.userTeam();
    const out = [];
    for (const g of career.goals) {
      if (g.done) continue;
      let v = 0;
      if (g.key === 'wins') v = t ? t.w : 0;
      else if (g.key === 'playoffs') v = lg.phase === 'playoffs' && lg.playoffs && t && lg.playoffs.seeds[t.conf].includes(t.id) ? 1 : 0;
      else v = p.s[g.key] || 0;
      g.cur = v;
      if (v >= g.target) { g.done = true; C.addXP(g.xp); out.push(g); C.log(`Season goal complete: ${g.text}`); }
    }
    return out;
  };

  // ------------------------------------------------------------------ post-game processing
  C.gradeGame = (box, extra) => {
    const p = C.user();
    const exp = C.expected(p.pos);
    let score = 0, n = 0;
    for (const k in exp) { score += U.clamp((box[k] || 0) / Math.max(0.3, exp[k]), 0, 3); n++; }
    score = n ? score / n : 1;
    if (box.pInt) score -= box.pInt * 0.3;
    if (box.fum) score -= box.fum * 0.4;
    if (box.drops) score -= box.drops * 0.15;
    if (extra && extra.perfects) score += extra.perfects * 0.05;
    if (extra && extra.win) score += 0.15;
    const letters = [[1.9, 'A+'], [1.5, 'A'], [1.25, 'A-'], [1.05, 'B+'], [0.9, 'B'], [0.75, 'B-'], [0.6, 'C+'], [0.48, 'C'], [0.36, 'C-'], [0.25, 'D'], [-99, 'F']];
    for (const [v, l] of letters) if (score >= v) return { letter: l, score };
    return { letter: 'F', score };
  };

  C.postGame = (gs, extra) => {
    const { career, lg } = C.cur;
    const p = C.user();
    const box = gs.box[p.id] || {};
    const side = gs.sideOf(p.team);
    const win = gs.score[side] > gs.score[side === 'home' ? 'away' : 'home'];
    const tie = gs.score.home === gs.score.away;
    const grade = C.gradeGame(box, Object.assign({ win }, extra || {}));
    let xp = 120 + Pl.prodScore(p.pos, box) * 9 + (win ? 120 : 0) + grade.score * 120;
    if (gs.playoff) xp *= 1.5;
    const res = { box, grade, win, tie, goals: [], fansGained: 0 };
    // game goals
    for (const g of career.gameGoals) {
      const v = g.key === 'win' ? (win ? 1 : 0) : box[g.key] || 0;
      if (v >= g.target) { g.done = true; xp += g.xp; res.goals.push(g); }
    }
    const xr = C.addXP(xp);
    res.xp = xr.amt; res.levels = xr.levels;
    // relationships
    const tdelta = Math.round((grade.score - 0.8) * 4) + (win ? 1 : -1);
    career.trust = U.clamp(career.trust + tdelta, 0, 100);
    career.chem = U.clamp(career.chem + (win ? 2 : 0) + (C.hasPerk('leader') ? 1 : 0), 0, 100);
    career.morale = U.clamp(career.morale + (win ? 4 : -3), 0, 100);
    let fans = Math.round((Pl.prodScore(p.pos, box) * 60 + (win ? 400 : 0) + (extra && extra.bigPlays ? extra.bigPlays * 500 : 0)) * (C.hasPerk('showtime') ? 1.5 : 1) * (gs.playoff ? 2 : 1) * (1 + career.fans / 400000));
    fans = Math.max(0, fans);
    career.fans += fans; res.fansGained = fans;
    career.energy = U.clamp(career.energy - 20, 0, 100);
    const opp = gs.teams[side === 'home' ? 'away' : 'home'];
    career.gameLog.push({ y: lg.year, w: lg.week, playoff: gs.playoff ? lg.playoffs.round : null, opp: opp.abbr, home: side === 'home',
      us: gs.score[side], them: gs.score[side === 'home' ? 'away' : 'home'], line: Pl.statLine(p.pos, box), grade: grade.letter });
    res.trustDelta = tdelta;
    // milestones
    res.milestones = C.checkMilestones();
    return res;
  };

  C.checkMilestones = () => {
    const { career } = C.cur, p = C.user();
    const tot = {}; Pl.addStats(tot, p.c); Pl.addStats(tot, p.s);
    const marks = { pYds: [5000, 10000, 20000, 30000, 40000, 50000, 60000], pTD: [50, 100, 200, 300, 400, 500], rYds: [1000, 2500, 5000, 7500, 10000, 15000],
      recYds: [1000, 2500, 5000, 7500, 10000, 15000], rec: [100, 250, 500, 750, 1000], recTD: [10, 25, 50, 75, 100], rTD: [10, 25, 50, 75, 100], tkl: [100, 250, 500, 1000], sck: [10, 25, 50, 100], dInt: [5, 10, 25, 50] };
    const out = [];
    for (const k in marks) for (const m of marks[k]) {
      const id = k + m;
      if ((tot[k] || 0) >= m && !career.milestones[id]) {
        career.milestones[id] = true; out.push(`${U.num(m)} career ${GOAL_NAMES[k] || k}`);
        C.log(`Milestone: ${U.num(m)} career ${GOAL_NAMES[k] || k}!`);
        career.legacyBonus += 5;
      }
    }
    return out;
  };

  // ------------------------------------------------------------------ contracts
  C.marketValue = () => {
    const p = C.user(), { career } = C.cur;
    let v = Pl.value(p);
    v *= 1 + (career.fans / 2e6) * 0.15;
    if (C.hasStaff('agent')) v *= 1.1;
    return Math.round(v / 10000) * 10000;
  };
  C.makeOffer = (team, mult) => {
    const { lg, career } = C.cur, p = C.user();
    const base = C.marketValue();
    const trustF = team.id === p.team ? 0.92 + career.trust * 0.0016 : U.rnd(0.9, 1.12);
    const sal = Math.round(base * trustF * (mult || 1) / 10000) * 10000;
    const yrs = p.age >= 31 ? U.rndi(1, 2) : U.rndi(2, 5);
    const depth = L.roster(lg, team).filter((x) => x.pos === p.pos && x.id !== p.id).sort((a, b) => b.ovr - a.ovr);
    const role = !depth[0] || p.ovr >= depth[0].ovr - 2 ? 'Starter' : p.ovr >= (depth[1] ? depth[1].ovr : 0) ? 'Rotation' : 'Backup';
    return { tid: team.id, team: team.abbr, teamName: L.teamName(team), sal: Math.max(D.MIN_SALARY, sal), yrs, bonus: Math.round(sal * yrs * U.rnd(0.12, 0.3) / 10000) * 10000, role, ovr: L.ratings(lg, team).ovr, prestige: team.prestige };
  };
  C.contractNeeded = () => {
    const p = C.user();
    return p.con && p.con.yrs <= 0;
  };
  C.startTalks = (extension) => {
    const { career, lg } = C.cur, p = C.user();
    const t = lg.teams[p.team];
    if (!t) return null;
    career.contractTalk = { offer: C.makeOffer(t), counters: 0, extension: !!extension, walked: false };
    return career.contractTalk;
  };
  C.counter = (mult) => {
    const { career } = C.cur;
    const ct = career.contractTalk;
    if (!ct || ct.walked) return null;
    ct.counters++;
    const accept = U.clamp(1 - (mult - 1) * 2.6 + (career.trust - 50) * 0.012 - (ct.counters - 1) * 0.15, 0.03, 0.97);
    if (Math.random() < accept) {
      ct.offer.sal = Math.round(ct.offer.sal * mult / 10000) * 10000;
      ct.offer.bonus = Math.round(ct.offer.bonus * mult / 10000) * 10000;
      return { ok: true };
    }
    if (ct.counters >= 3 || Math.random() < 0.25 + (mult - 1)) { ct.walked = true; career.trust = U.clamp(career.trust - 5, 0, 100); return { ok: false, walked: true }; }
    ct.offer.sal = Math.round(ct.offer.sal * U.rnd(1.0, 1.04) / 10000) * 10000;
    return { ok: false };
  };
  C.signContract = (offer) => {
    const { career, lg } = C.cur, p = C.user();
    const t = lg.teams[offer.tid];
    if (p.team !== t.id) {
      // make room on the new team
      const same = L.roster(lg, t).filter((x) => x.pos === p.pos).sort((a, b) => a.ovr - b.ovr);
      if (same.length >= D.ROSTER_COUNTS[p.pos] + 1) { const cut = same[0]; L.moveTo(lg, cut, null); cut.con = null; }
      L.moveTo(lg, p, t);
      L.assignNumbers(t, lg);
      const clash = L.roster(lg, t).find((x) => x.id !== p.id && x.num === p.num);
      if (clash) clash.num = Pl.pickNumber(clash.pos, new Set(L.roster(lg, t).map((x) => x.num)));
      career.trust = 50; career.chem = 45;
      L.news(lg, `${t.abbr} sign ${p.pos} ${Pl.full(p)} to a ${offer.yrs}-year, ${U.money(offer.sal * offer.yrs)} deal.`, 'fa');
    } else {
      L.news(lg, `${t.abbr} lock up ${p.pos} ${Pl.full(p)}: ${offer.yrs} years, ${U.money(offer.sal * offer.yrs)}.`, 'fa');
    }
    const extending = career.contractTalk && career.contractTalk.extension && p.con && p.con.yrs > 0;
    const startYrs = extending ? p.con.yrs + offer.yrs : offer.yrs;
    p.con = { sal: offer.sal, yrs: startYrs, exp: lg.year + startYrs - (lg.phase === 'regular' || lg.phase === 'preseason' ? 1 : 0), bonus: offer.bonus };
    career.money += offer.bonus; career.totalEarned += offer.bonus;
    career.contractTalk = null; career.faOffers = null;
    C.log(`Signed with ${L.teamName(t)}: ${offer.yrs} yrs, ${U.money(offer.sal)}/yr, ${U.money(offer.bonus)} bonus.`);
    L.invalidate();
  };
  C.freeAgentOffers = () => {
    const { career, lg } = C.cur, p = C.user();
    const teams = U.shuffle(lg.teams.filter((t) => t.id !== p.team || !career.contractTalk || !career.contractTalk.walked));
    const offers = [];
    for (const t of teams) {
      const need = S.teamNeed(lg, t, p.pos);
      if (offers.length >= 5) break;
      if (need + U.rnd(0, 12) > 6 || offers.length < 2) offers.push(C.makeOffer(t, U.rnd(0.9, 1.2)));
    }
    career.faOffers = offers.sort((a, b) => b.sal - a.sal);
    return career.faOffers;
  };
  C.requestTrade = () => {
    const { career, lg } = C.cur, p = C.user();
    career.tradeReq = true;
    career.trust = U.clamp(career.trust - 10, 0, 100);
    const ok = Math.random() < 0.35 + (p.ovr - 70) * 0.015 + (career.trust < 30 ? 0.2 : 0);
    if (!ok) { C.log('Trade request denied. The front office wants you to stay.'); return null; }
    const cands = lg.teams.filter((t) => t.id !== p.team).sort((a, b) => S.teamNeed(lg, b, p.pos) - S.teamNeed(lg, a, p.pos));
    const t = U.pick(cands.slice(0, 6));
    const old = lg.teams[p.team];
    // swap with a similar player
    const back = L.roster(lg, t).filter((x) => x.pos === p.pos).sort((a, b) => Math.abs(a.ovr - p.ovr) - Math.abs(b.ovr - p.ovr))[0];
    L.moveTo(lg, p, t);
    if (back) L.moveTo(lg, back, old);
    L.assignNumbers(t, lg);
    career.trust = 55; career.chem = 45; career.tradeReq = false;
    L.news(lg, `TRADE: ${old.abbr} deal ${p.pos} ${Pl.full(p)} to ${t.abbr}${back ? ' for ' + Pl.full(back) : ''}.`, 'trade');
    C.log(`Traded from ${L.teamName(old)} to ${L.teamName(t)}.`);
    return t;
  };

  // ------------------------------------------------------------------ offseason for the user
  C.offseasonUser = () => {
    const { career, lg } = C.cur, p = C.user();
    // archive the season
    const t = p.team >= 0 ? lg.teams[p.team] : null;
    const aw = lg.awards[0] && lg.awards[0].year === lg.year ? lg.awards[0] : null;
    const myAwards = [];
    if (aw) {
      const chk = (k, label) => { if (aw[k] && aw[k].pid === p.id) myAwards.push(label); };
      chk('mvp', 'MVP'); chk('opoy', 'Off. Player of the Year'); chk('dpoy', 'Def. Player of the Year'); chk('oroy', 'Off. Rookie of the Year'); chk('droy', 'Def. Rookie of the Year');
      if (aw.allLeague.some((e) => e && e.pid === p.id)) myAwards.push('All-League');
      if (aw.allStars.some((e) => e && e.pid === p.id)) myAwards.push('All-Star');
      if (aw.champMvp && aw.champMvp.pid === p.id) myAwards.push(D.CHAMP_NAME + ' MVP');
    }
    if (lg.champions[0] && lg.champions[0].year === lg.year && t && lg.champions[0].team === t.id) myAwards.push(D.CHAMP_NAME + ' Champion');
    career.history.push({ year: lg.year, age: p.age, team: t ? t.abbr : 'FA', ovr: p.ovr, s: Object.assign({}, p.s), ps: p.ps ? Object.assign({}, p.ps) : null,
      rec: t ? L.record(t) : '', awards: myAwards });
    for (const a of myAwards) C.log(`Award: ${a} (${lg.year})`);
    career.seasonsPlayed++;
    // aging for the user
    p.age++; p.yrs++;
    const decline = [];
    if (p.age >= 30) {
      const amt = p.age >= 34 ? 4 : p.age >= 32 ? 3 : 2;
      for (const k of ['spd', 'acc', 'agi']) { const d = U.rndi(1, amt); p.r[k] = Math.max(30, p.r[k] - d); decline.push(`-${d} ${k.toUpperCase()}`); }
      if (p.age >= 33) for (const k of ['str', 'sta', 'jmp', 'thp']) if (p.r[k] != null) p.r[k] = Math.max(30, p.r[k] - U.rndi(0, 2));
    }
    // awareness grows with experience
    if (p.r.awr < 99) p.r.awr = Math.min(99, p.r.awr + U.rndi(1, 3));
    Pl.refresh(p);
    // contract year tick
    if (p.con) p.con.yrs--;
    career.event = null;
    return { awards: myAwards, decline };
  };

  C.legacy = () => {
    const { career } = C.cur, p = C.user();
    const tot = {}; Pl.addStats(tot, p.c); Pl.addStats(tot, p.s);
    const a = p.aw || {};
    let v = (a.mvp || 0) * 100 + (a.opoy || 0) * 50 + (a.dpoy || 0) * 50 + (a.allLeague || 0) * 30 + (a.allStar || 0) * 12 + (a.champ || 0) * 40 + (a.champMvp || 0) * 40 + (a.roy || 0) * 15;
    v += Pl.prodScore(p.pos, tot) * 0.035 * (15 / Math.max(3, C.cur.lg.settings.quarterLen)) * (17 / C.cur.lg.settings.seasonLength);
    v += career.legacyBonus;
    return Math.round(v);
  };
  C.HOF_LINE = 400;
  C.retire = () => {
    const { career, lg } = C.cur, p = C.user();
    career.retired = true;
    const leg = C.legacy();
    career.hof = leg >= C.HOF_LINE;
    if (career.hof) {
      lg.hof.unshift({ name: Pl.full(p), pos: p.pos, year: lg.year + 5, score: leg, team: p.team >= 0 ? lg.teams[p.team].abbr : 'FA', user: true });
      L.news(lg, `${Pl.full(p)} retires as a first-ballot Hall of Famer!`, 'retire');
    } else L.news(lg, `${Pl.full(p)} announces his retirement.`, 'retire');
    C.log(career.hof ? 'Retired. Inducted into the Hall of Fame!' : 'Retired from professional football.');
    return { legacy: leg, hof: career.hof };
  };

  // ------------------------------------------------------------------ save / load
  const KEY = 'pixelgridiron_save_';
  C.slots = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      try {
        const meta = localStorage.getItem(KEY + i + '_meta');
        out.push(meta ? JSON.parse(meta) : null);
      } catch (e) { out.push(null); }
    }
    return out;
  };
  C.save = (slot) => {
    if (!C.cur) return false;
    slot = slot != null ? slot : (C.cur.slot != null ? C.cur.slot : 0);
    C.cur.slot = slot;
    const p = C.user(), t = C.userTeam();
    const meta = { name: Pl.full(p), pos: p.pos, ovr: p.ovr, team: t ? t.abbr : 'FA', year: C.cur.lg.year, week: C.cur.lg.week, phase: C.cur.lg.phase, saved: Date.now(), level: C.cur.career.level, c1: t ? t.c1 : '#555' };
    try {
      localStorage.setItem(KEY + slot, JSON.stringify({ v: 1, career: C.cur.career, lg: C.cur.lg }));
      localStorage.setItem(KEY + slot + '_meta', JSON.stringify(meta));
      localStorage.setItem(KEY + 'last', String(slot));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  };
  C.load = (slot) => {
    try {
      const raw = localStorage.getItem(KEY + slot);
      if (!raw) return null;
      const data = JSON.parse(raw);
      C.cur = { career: data.career, lg: data.lg, slot };
      C.cur.career.settings = Object.assign(C.defaultSettings(), C.cur.career.settings || {});
      L.invalidate();
      return C.cur;
    } catch (e) { console.warn('load failed', e); return null; }
  };
  C.lastSlot = () => { try { const v = localStorage.getItem(KEY + 'last'); return v == null ? null : +v; } catch (e) { return null; } };
  C.deleteSlot = (slot) => { try { localStorage.removeItem(KEY + slot); localStorage.removeItem(KEY + slot + '_meta'); } catch (e) { /* ignore */ } };
  C.freeSlot = () => { const s = C.slots(); const i = s.findIndex((x) => !x); return i >= 0 ? i : 0; };

  PG.Career = C;
})();
