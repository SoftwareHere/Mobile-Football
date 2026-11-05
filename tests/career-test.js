const load = require('./load');
const PG = load(['util.js', 'data.js', 'player.js', 'league.js', 'sim.js', 'season.js', 'career.js']);
const C = PG.Career;
for (const pos of ['QB', 'WR', 'RB', 'TE', 'LB', 'CB', 'S']) {
  const arch = PG.D.ARCHETYPES[pos][0].id;
  C.newCareer({ pos, arch, first: 'Test', last: 'Player', seasonLength: 12, quarterLen: 6, difficulty: 'pro', injuries: true, playingTime: 'earn' });
  const d = C.draftUser(0);
  C.cur.lg.firstCamp = false; PG.Season.startSeason(C.cur.lg); C.seasonStart();
  const p = C.user();
  const depth = PG.League.depth(C.cur.lg, d.team)[pos].map((x) => x.ovr + (x.isUser ? '*' : ''));
  console.log(pos, 'ovr', p.ovr, 'pick', d.pick, d.team.abbr, 'sal', PG.U.money(p.con.sal), 'depth', depth.join(','), 'goals', C.cur.career.goals.map((g) => g.text).join('; '));
}
// train & xp
const r = C.train('position', 0.8); console.log('train', r);
console.log('level', C.cur.career.level, 'sp', C.cur.career.sp, 'xp', C.cur.career.xp);
// offers
const t = C.userTeam();
console.log('offer', C.makeOffer(t));
console.log('fa', C.freeAgentOffers().map((o) => o.team + ' ' + PG.U.money(o.sal) + ' ' + o.role));
