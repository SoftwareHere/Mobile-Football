// Headless smoke test: create a league, simulate a full season + offseason, print sanity stats.
const load = require('./load');
const PG = load(['util.js', 'data.js', 'player.js', 'league.js', 'sim.js', 'season.js']);
const qlen = +(process.argv[2] || 5);
const lg = PG.League.create({ seasonLength: 12, quarterLen: qlen });
PG.Season.startSeason(lg);
console.log('players', Object.keys(lg.players).length, 'teams', lg.teams.length);
const json = JSON.stringify(lg);
console.log('league JSON size KB', Math.round(json.length / 1024));
let tot = { pts: 0, games: 0, plays: 0, ot: 0, ties: 0 };
for (let w = 1; w <= lg.settings.seasonLength; w++) {
  for (const g of lg.schedule[w - 1]) {
    const gs = PG.Season.simAndApply(lg, g);
    tot.pts += gs.score.home + gs.score.away; tot.games++;
    tot.plays += gs.ts.home.plays + gs.ts.away.plays;
    if (gs.q >= 5) tot.ot++;
    if (gs.score.home === gs.score.away) tot.ties++;
  }
  PG.Season.endRegularWeek(lg);
}
console.log('avg pts/game', (tot.pts / tot.games).toFixed(1), 'avg plays/game', (tot.plays / tot.games).toFixed(1), 'OT', tot.ot, 'ties', tot.ties);
const lead = (k) => PG.Season.leaders(lg, k, 3).map((p) => `${PG.Player.name(p)} ${p.pos} ${p.s[k]}`).join(' | ');
for (const k of ['pYds', 'pTD', 'pInt', 'rYds', 'rTD', 'recYds', 'rec', 'sck', 'dInt', 'tkl', 'fgM'])
  console.log(k.padEnd(7), lead(k));
// completion %
const qbs = Object.values(lg.players).filter((p) => p.pos === 'QB' && (p.s.pAtt || 0) > 50);
const cmp = qbs.reduce((s, p) => s + p.s.pCmp, 0) / qbs.reduce((s, p) => s + p.s.pAtt, 0);
console.log('league cmp%', (cmp * 100).toFixed(1));
// playoffs
let guard = 0;
while (lg.phase === 'playoffs' && guard++ < 10) { PG.Season.simPlayoffGames(lg); PG.Season.advancePlayoffRound(lg); }
console.log('champ', lg.champions[0]);
const aw = PG.Season.computeAwards(lg);
console.log('MVP', aw.mvp, 'DPOY', aw.dpoy && aw.dpoy.name);
PG.Season.offseasonProgress(lg);
PG.Season.offseasonContracts(lg);
PG.Season.runDraft(lg);
PG.Season.runFreeAgency(lg);
PG.Season.newSeason(lg);
const sizes = lg.teams.map((t) => t.roster.length);
console.log('roster sizes min/max', Math.min(...sizes), Math.max(...sizes), 'FA', lg.freeAgents.length, 'players', Object.keys(lg.players).length);
const caps = lg.teams.map((t) => PG.League.payroll(lg, t) / 1e6);
console.log('payroll M min/max', Math.min(...caps).toFixed(0), Math.max(...caps).toFixed(0));
console.log('news', lg.news.slice(0, 6).map((n) => n.text));
console.log('league JSON size KB after season', Math.round(JSON.stringify(lg).length / 1024));
