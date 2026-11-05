// Headless on-field engine balance test: AI vs AI for many plays, reports outcome rates.
const load = require('./load');
const PG = load(['util.js', 'data.js', 'player.js', 'league.js', 'sim.js', 'season.js', 'career.js', 'plays.js', 'input.js', 'sprites.js', 'engine.js']);
const N = +(process.argv[2] || 300);
const lg = PG.League.create({ seasonLength: 8, quarterLen: 6 });
const D = PG.D, P = PG.Plays, L = PG.League;
const W = 53.33;
const agg = { run: [], pass: [], kinds: {}, comp: 0, att: 0, int: 0, sack: 0, td: 0, fum: 0, time: [] };
const diff = D.DIFFICULTY[2];
for (let i = 0; i < N; i++) {
  const ta = lg.teams[i % 32], tb = lg.teams[(i * 7 + 3) % 32];
  if (ta === tb) continue;
  const od = L.depth(lg, ta), dd = L.depth(lg, tb);
  const play = P.aiOffCall({ down: 1, toGo: 10, ballOn: 35, late: false, diff: 0 }, null);
  const offPers = P.offPersonnel(od, play.form, {});
  const f = P.FORMS[play.form];
  let nWR = 0, nTE = 0; for (const s in f.slots) { if (s.startsWith('WR')) nWR++; if (s.startsWith('TE')) nTE++; }
  const dform = P.defFormFor(nWR, nTE, false);
  const defPers = P.defPersonnel(dd, dform);
  const defPlay = P.defById(P.aiDefCall({ down: 1, toGo: 10, ballOn: 35 }, null));
  let res = null;
  const sc = new PG.Engine.Scene({ offTeam: ta, defTeam: tb, offHome: true, offPers, defPers, dform, play, defPlay, ballOn: 35, toGo: 10, ballY: W / 2, flip: Math.random() < 0.5,
    userPid: null, userSide: null, diff, weather: { type: 'clear', wind: 0 }, settings: {}, perks: new Set(), hud: {}, q: 1, onEnd: (r) => { res = r; } });
  sc.setView(420, 200);
  sc.snap();
  let t = 0;
  while (!res && t < 30) { sc.update(1 / 60); t += 1 / 60; }
  if (!res) { agg.kinds.timeout = (agg.kinds.timeout || 0) + 1; continue; }
  const k = res.kind + (res.incomplete ? '-inc' : '') + (res.turnover ? '-' + res.turnover : '') + (res.td ? '-td' : '');
  agg.kinds[k] = (agg.kinds[k] || 0) + 1;
  agg.time.push(res.time);
  if (play.type === 'run') { if (!res.turnover) agg.run.push(res.yards); }
  else {
    if (res.kind === 'sack') agg.sack++;
    else { agg.att++; if (res.complete) { agg.comp++; agg.pass.push(res.yards); } if (res.turnover === 'int') agg.int++; }
  }
  if (res.td) agg.td++;
  if (res.turnover === 'fumble') agg.fum++;
}
const avg = (a) => (a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)).toFixed(2);
console.log('runs', agg.run.length, 'avg yds', avg(agg.run), 'median', agg.run.slice().sort((a, b) => a - b)[Math.floor(agg.run.length / 2)]);
console.log('pass att', agg.att, 'cmp%', (agg.comp / Math.max(1, agg.att) * 100).toFixed(1), 'yds/cmp', avg(agg.pass), 'int%', (agg.int / Math.max(1, agg.att) * 100).toFixed(1), 'sacks', agg.sack);
console.log('TDs', agg.td, 'fumbles', agg.fum, 'avg play time', avg(agg.time));
console.log(agg.kinds);
