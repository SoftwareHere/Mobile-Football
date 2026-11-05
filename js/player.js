/* Pixel Gridiron - player generation, ratings, value, progression */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, D = PG.D;
  const P = {};

  P.attr = (p, k) => {
    const v = p.r[k];
    let base = v == null ? 30 : v;
    if (p.bonus && p.bonus[k]) base += p.bonus[k];
    return base > 99 ? 99 : base;
  };

  P.calcOvr = (p, pos) => {
    const def = D.POS[pos || p.pos];
    let s = 0, tw = 0;
    for (const k in def.w) { s += P.attr(p, k) * def.w[k]; tw += def.w[k]; }
    let o = s / tw;
    // spread ratings out a bit like real games do
    o = 50 + (o - 50) * 1.18;
    return U.clamp(Math.round(o), 30, 99);
  };
  P.refresh = (p) => { p.ovr = P.calcOvr(p); return p.ovr; };

  P.name = (p) => (p ? p.fn.charAt(0) + '. ' + p.ln : '—');
  P.full = (p) => (p ? p.fn + ' ' + p.ln : '—');

  // Deterministic pseudo-random from id for AI looks
  const hash = (n) => {
    let x = (n * 2654435761) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13;
    return x >>> 0;
  };
  P.look = (p) => {
    if (p.look) return p.look;
    const h = hash(p.id + 17);
    const sk = [0, 1, 2, 2, 3, 3, 4, 4, 5][h % 9];
    return {
      skin: sk,
      hair: (h >> 4) % 6 === 0 ? 3 : (h >> 4) % 6 === 1 ? 2 : 1,
      hairC: sk >= 3 ? 0 : (h >> 7) % 4,
      face: (h >> 9) % 5,
      visor: (h >> 12) % 5 === 0 ? ((h >> 14) % 2 ? 'smoke' : 'clear') : 'none',
      sleeves: (h >> 16) % 4,
      sleeveC: 'team',
      gloves: (h >> 18) % 3 === 0 ? 'white' : 'team',
      cleats: (h >> 20) % 3 === 0 ? 'white' : (h >> 20) % 3 === 1 ? 'black' : 'team',
      eyeblack: (h >> 22) % 3,
      lefty: (h >> 24) % 9 === 0,
    };
  };

  const devRoll = () => {
    let r = Math.random();
    for (const d of D.DEV) { if (r < d.p) return d.id; r -= d.p; }
    return 'normal';
  };
  P.devMult = (p) => (D.DEV.find((d) => d.id === p.dev) || D.DEV[0]).mult;

  P.pickNumber = (pos, taken) => {
    const [a, b] = D.POS[pos].nums;
    for (let i = 0; i < 30; i++) {
      const n = U.rndi(a, b);
      if (!taken || !taken.has(n)) return n;
    }
    return U.rndi(a, b);
  };

  // Create a player. opts: {age, ovr (target), dev, rookie}
  P.create = (L, pos, o = {}) => {
    const def = D.POS[pos];
    const p = {
      id: L.nextPid++, fn: U.pick(D.FIRST), ln: U.pick(D.LAST), pos,
      age: o.age || U.rndi(22, 33), ht: U.rndi(def.ht[0], def.ht[1]), wt: 0, num: 0,
      college: U.pick(D.COLLEGES), r: {}, ovr: 0, pot: 0, dev: o.dev || devRoll(),
      team: -1, con: null, inj: null, s: {}, c: {}, aw: {}, yrs: 0, fat: 0,
    };
    p.wt = Math.round(U.lerp(def.wt[0], def.wt[1], U.rnd(0, 1)));
    for (const k of def.all) {
      const m = def.m[k] || [50, 10];
      p.r[k] = U.clamp(Math.round(U.norm(m[0], m[1])), 20, 99);
    }
    // body type influences
    const hT = (p.ht - def.ht[0]) / Math.max(1, def.ht[1] - def.ht[0]);
    const wT = (p.wt - def.wt[0]) / Math.max(1, def.wt[1] - def.wt[0]);
    if (p.r.jmp != null) p.r.jmp = U.clamp(p.r.jmp + Math.round((hT - 0.5) * 6), 20, 99);
    p.r.spd = U.clamp(p.r.spd - Math.round((wT - 0.5) * 4), 20, 99);
    p.r.str = U.clamp(p.r.str + Math.round((wT - 0.5) * 6), 20, 99);
    if (o.ovr != null) P.setOvr(p, o.ovr);
    P.refresh(p);
    const youth = Math.max(0, 27 - p.age);
    p.pot = U.clamp(Math.round(p.ovr + youth * U.rnd(0.6, 2.6) * P.devMult(p)), p.ovr, 99);
    p.yrs = Math.max(0, p.age - 22 + U.rndi(-1, 0));
    if (o.rookie) p.yrs = 0;
    return p;
  };

  // shift all relevant attributes so that ovr ~= target
  P.setOvr = (p, target) => {
    const def = D.POS[p.pos];
    for (let it = 0; it < 4; it++) {
      const cur = P.calcOvr(p);
      const delta = (target - cur) / 1.18;
      if (Math.abs(target - cur) < 1) break;
      for (const k of def.all) {
        const w = def.w[k] ? 1 : 0.55;
        p.r[k] = U.clamp(Math.round(p.r[k] + delta * w), 20, 99);
      }
    }
    P.refresh(p);
  };

  // ---- Contract value ----
  P.value = (p, ovrOverride) => {
    const o = ovrOverride != null ? ovrOverride : p.ovr;
    let v = D.MIN_SALARY;
    if (o > 58) v += Math.pow((o - 58) / 37, 2.3) * 62e6 * D.POS_SAL[p.pos];
    if (p.age > 29) v *= Math.max(0.35, 1 - (p.age - 29) * 0.09);
    if (p.age < 25 && p.pot > o + 5) v *= 1.08;
    return Math.max(D.MIN_SALARY, Math.round(v / 10000) * 10000);
  };
  P.rookieSalary = (pick) => Math.round((D.MIN_SALARY + (10.5e6 - D.MIN_SALARY) * Math.exp(-(pick - 1) / 20)) / 10000) * 10000;

  // ---- Yearly progression for AI-controlled players ----
  P.ageCurve = (p) => {
    const a = p.age, dm = P.devMult(p);
    if (a <= 22) return U.rnd(1, 6) * dm;
    if (a <= 24) return U.rnd(0, 5) * dm;
    if (a <= 26) return U.rnd(-0.5, 3.5) * dm;
    if (a <= 28) return U.rnd(-1, 2);
    if (a <= 30) return U.rnd(-3, 0.5);
    if (a <= 32) return U.rnd(-5, -0.5);
    return U.rnd(-8, -2);
  };
  P.progress = (p) => {
    const def = D.POS[p.pos];
    let d = P.ageCurve(p);
    if (d > 0) d = Math.min(d, Math.max(0, p.pot - p.ovr) + 1);
    const phys = { spd: 1, acc: 1, agi: 1 };
    const before = p.ovr;
    for (const k of def.all) {
      let ch;
      if (d >= 0) ch = d * U.rnd(0.3, 1.5) * (phys[k] && p.age > 25 ? 0.3 : 1);
      else ch = d * (phys[k] ? U.rnd(1.0, 1.8) : U.rnd(0.2, 0.9));
      if (k === 'awr' && p.age < 33) ch += U.rnd(0, 2);
      p.r[k] = U.clamp(Math.round(p.r[k] + ch), 20, 99);
    }
    P.refresh(p);
    if (p.ovr > p.pot) p.pot = p.ovr;
    return p.ovr - before;
  };

  // ---- Stats helpers ----
  P.addStats = (into, box) => {
    for (const k in box) {
      if (k === 'pLng' || k === 'rLng' || k === 'recLng' || k === 'fgLng') into[k] = Math.max(into[k] || 0, box[k]);
      else into[k] = (into[k] || 0) + box[k];
    }
  };
  P.passerRating = (s) => {
    const att = s.pAtt || 0;
    if (!att) return 0;
    const a = U.clamp(((s.pCmp || 0) / att - 0.3) * 5, 0, 2.375);
    const b = U.clamp(((s.pYds || 0) / att - 3) * 0.25, 0, 2.375);
    const c = U.clamp(((s.pTD || 0) / att) * 20, 0, 2.375);
    const d = U.clamp(2.375 - ((s.pInt || 0) / att) * 25, 0, 2.375);
    return ((a + b + c + d) / 6) * 100;
  };
  // one-line summary for a player's stats
  P.statLine = (pos, s) => {
    s = s || {};
    const parts = [];
    if ((s.pAtt || 0) > 0) parts.push(`${s.pCmp || 0}/${s.pAtt} ${s.pYds || 0} YDS ${s.pTD || 0} TD ${s.pInt || 0} INT`);
    if ((s.rAtt || 0) > 0 && (pos === 'RB' || (s.rYds || 0) > 15 || pos === 'QB')) parts.push(`${s.rAtt} CAR ${s.rYds || 0} YDS${s.rTD ? ' ' + s.rTD + ' TD' : ''}`);
    if ((s.rec || 0) > 0 || (s.tgt || 0) > 0) parts.push(`${s.rec || 0} REC ${s.recYds || 0} YDS${s.recTD ? ' ' + s.recTD + ' TD' : ''}`);
    if ((s.tkl || 0) > 0 || s.sck || s.dInt) {
      let t = `${s.tkl || 0} TKL`;
      if (s.sck) t += ` ${s.sck} SCK`;
      if (s.dInt) t += ` ${s.dInt} INT`;
      if (s.pd) t += ` ${s.pd} PD`;
      parts.push(t);
    }
    if ((s.fgA || 0) > 0 || (s.xpA || 0) > 0) parts.push(`FG ${s.fgM || 0}/${s.fgA || 0} XP ${s.xpM || 0}/${s.xpA || 0}`);
    return parts.join(' · ') || 'No stats';
  };

  // A rough "fantasy-like" production score used for awards & grades
  P.prodScore = (pos, s) => {
    s = s || {};
    let v = 0;
    v += (s.pYds || 0) * 0.04 + (s.pTD || 0) * 4 - (s.pInt || 0) * 3;
    v += (s.rYds || 0) * 0.1 + (s.rTD || 0) * 6 - (s.fum || 0) * 2;
    v += (s.recYds || 0) * 0.1 + (s.recTD || 0) * 6 + (s.rec || 0) * 0.5;
    v += (s.tkl || 0) * 1 + (s.sck || 0) * 4 + (s.dInt || 0) * 6 + (s.pd || 0) * 1.5 + (s.ff || 0) * 3 + (s.dTD || 0) * 6;
    if (pos === 'QB') v *= 0.85;
    if (pos === 'DE' || pos === 'DT' || pos === 'LB' || pos === 'CB' || pos === 'S') v *= 1.25;
    return v;
  };

  PG.Player = P;
})();
