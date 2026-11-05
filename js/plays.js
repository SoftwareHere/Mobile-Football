/* Pixel Gridiron - formations, route tree, offensive playbook, defensive calls, personnel */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U;
  const P = {};
  const W = 53.33;

  // Route tree: points are [downfield, outward] relative to the receiver's start.
  // "sit" routes stop at the end; others keep running along the last segment.
  P.ROUTES = {
    go: { name: 'Go', pts: [[3, 0], [14, 0.6], [45, 1.6]] },
    fade: { name: 'Fade', pts: [[4, 1.2], [18, 3], [45, 4.5]] },
    seam: { name: 'Seam', pts: [[4, 0], [45, -0.6]] },
    slant: { name: 'Slant', pts: [[2, 0], [6, -5], [24, -22]] },
    out: { name: 'Out', pts: [[6, 0], [6.4, 3], [6.8, 25]] },
    deepout: { name: 'Deep Out', pts: [[12, 0], [12, 3], [12.5, 25]] },
    in: { name: 'In', pts: [[6, 0], [6.4, -3], [6.8, -30]] },
    dig: { name: 'Dig', pts: [[12, 0], [12.4, -3], [12.8, -30]] },
    post: { name: 'Post', pts: [[11, 0], [16, -4], [40, -14]] },
    corner: { name: 'Corner', pts: [[11, 0], [16, 4], [36, 12]] },
    curl: { name: 'Curl', pts: [[11, 0], [9.5, -1.2]], sit: true },
    comeback: { name: 'Comeback', pts: [[14, 0], [12, 2.5]], sit: true },
    hitch: { name: 'Hitch', pts: [[5, 0], [4.2, -0.3]], sit: true },
    stick: { name: 'Stick', pts: [[5.5, 0], [5.5, -1.5]], sit: true },
    drag: { name: 'Drag', pts: [[1.5, 0], [3, -4], [4, -32]] },
    cross: { name: 'Deep Cross', pts: [[6, 0], [10, -6], [13, -34]] },
    flat: { name: 'Flat', pts: [[1, 2], [2.5, 6], [3.5, 22]] },
    wheel: { name: 'Wheel', pts: [[0.5, 4], [3, 8], [12, 9.5], [45, 10]] },
    swing: { name: 'Swing', pts: [[-1.5, 3], [-0.5, 7], [1, 14]] },
    angle: { name: 'Angle', pts: [[1.5, 3], [3.5, 4], [5, 0], [6, -12]] },
    screen: { name: 'Screen', pts: [[-2.5, 2], [-2.6, 4.5]], sit: true },
    bubble: { name: 'Bubble', pts: [[-1, 1.5], [-1.4, 4]], sit: true },
    sitflat: { name: 'Check Flat', pts: [[1, 2], [3, 5]], sit: true },
    out10: { name: 'Speed Out', pts: [[9, 0], [9.4, 3], [9.8, 25]] },
  };

  // Formation alignment: x = yards behind(-)/past LOS, y = offset from ball (top = negative), ya = absolute (neg = from bottom)
  const OL = { LT: [-0.9, -2.6], LG: [-0.7, -1.3], C: [-0.5, 0], RG: [-0.7, 1.3], RT: [-0.9, 2.6] };
  const withOL = (o) => Object.assign({ LT: { x: OL.LT[0], y: OL.LT[1] }, LG: { x: OL.LG[0], y: OL.LG[1] }, C: { x: OL.C[0], y: OL.C[1] }, RG: { x: OL.RG[0], y: OL.RG[1] }, RT: { x: OL.RT[0], y: OL.RT[1] } }, o);
  P.FORMS = {
    SG_DBL: { name: 'Shotgun Doubles', sg: true, slots: withOL({ QB: { x: -5, y: 0 }, RB: { x: -5, y: 1.8 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -9 }, WR3: { x: -1.3, y: -7.5 }, TE1: { x: -0.9, y: 3.9 } }) },
    SG_TRIPS: { name: 'Shotgun Trips', sg: true, slots: withOL({ QB: { x: -5, y: 0 }, RB: { x: -5, y: -1.8 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -8 }, WR3: { x: -1.3, y: 8 }, TE1: { x: -1.2, y: 4.6 } }) },
    SG_EMPTY: { name: 'Shotgun Empty', sg: true, slots: withOL({ QB: { x: -5, y: 0 }, WR1: { x: -0.5, ya: 8 }, WR2: { x: -0.5, ya: -8 }, WR3: { x: -1.3, y: -7 }, WR4: { x: -1.3, y: 7 }, TE1: { x: -1.2, y: -4.2 } }) },
    PISTOL: { name: 'Pistol', sg: true, slots: withOL({ QB: { x: -4, y: 0 }, RB: { x: -7, y: 0 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -9 }, WR3: { x: -1.3, y: 7.5 }, TE1: { x: -0.9, y: -3.9 } }) },
    SINGLEBACK: { name: 'Singleback', sg: false, slots: withOL({ QB: { x: -1.3, y: 0 }, RB: { x: -7, y: 0 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -9 }, WR3: { x: -1.3, y: -7.5 }, TE1: { x: -0.9, y: 3.9 } }) },
    ACE: { name: 'Ace Twin TE', sg: false, slots: withOL({ QB: { x: -1.3, y: 0 }, RB: { x: -7, y: 0 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -9 }, TE1: { x: -0.9, y: 3.9 }, TE2: { x: -0.9, y: -3.9 } }) },
    IFORM: { name: 'I-Formation', sg: false, slots: withOL({ QB: { x: -1.3, y: 0 }, FB: { x: -4.5, y: 0 }, RB: { x: -7.2, y: 0 }, WR1: { x: -0.5, ya: 9 }, WR2: { x: -0.5, ya: -9 }, TE1: { x: -0.9, y: 3.9 } }) },
    GOALLINE: { name: 'Goal Line', sg: false, slots: withOL({ QB: { x: -1.3, y: 0 }, FB: { x: -4, y: 0 }, RB: { x: -6.5, y: 0 }, TE1: { x: -0.9, y: 3.9 }, TE2: { x: -0.9, y: -3.9 }, TE3: { x: -1.4, y: 5.2 } }) },
  };

  // Playbook. type: pass | run | screen. a = route assignments. side for backs (+1 right/bottom, -1 left/top)
  const B = 'block';
  P.PLAYS = [
    // Shotgun Doubles
    { id: 'dbl_verts', form: 'SG_DBL', name: 'Four Verticals', type: 'pass', drop: 5, a: { WR1: 'go', WR2: 'go', WR3: 'seam', TE1: 'seam', RB: ['sitflat', -1] }, prog: ['WR3', 'TE1', 'WR1', 'WR2', 'RB'], tags: ['deep'] },
    { id: 'dbl_mesh', form: 'SG_DBL', name: 'Mesh', type: 'pass', drop: 3, a: { WR1: 'go', WR2: 'dig', WR3: 'drag', TE1: 'drag', RB: ['flat', 1] }, prog: ['WR3', 'TE1', 'WR2', 'RB', 'WR1'], tags: ['short'] },
    { id: 'dbl_slants', form: 'SG_DBL', name: 'Slant Flat', type: 'pass', drop: 3, a: { WR1: 'slant', WR2: 'slant', WR3: 'flat', TE1: 'out', RB: B }, prog: ['WR1', 'WR2', 'WR3', 'TE1'], tags: ['short', 'quick'] },
    { id: 'dbl_smash', form: 'SG_DBL', name: 'Smash', type: 'pass', drop: 5, a: { WR1: 'hitch', WR2: 'hitch', WR3: 'corner', TE1: 'corner', RB: ['swing', 1] }, prog: ['WR3', 'WR1', 'TE1', 'WR2', 'RB'], tags: ['mid'] },
    { id: 'dbl_curls', form: 'SG_DBL', name: 'Curl Flats', type: 'pass', drop: 5, a: { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE1: 'flat', RB: B }, prog: ['WR1', 'WR2', 'WR3', 'TE1'], tags: ['mid'] },
    { id: 'dbl_postdig', form: 'SG_DBL', name: 'Post Dig', type: 'pass', drop: 7, a: { WR1: 'post', WR2: 'dig', WR3: 'out10', TE1: 'seam', RB: B }, prog: ['WR1', 'WR2', 'TE1', 'WR3'], tags: ['deep'] },
    { id: 'dbl_hbscreen', form: 'SG_DBL', name: 'HB Screen', type: 'screen', drop: 3, a: { WR1: 'go', WR2: 'go', WR3: 'in', TE1: 'drag', RB: ['screen', 1] }, prog: ['RB'], tags: ['screen'] },
    { id: 'dbl_iz', form: 'SG_DBL', name: 'Inside Zone', type: 'run', carrier: 'RB', run: 'inside', dir: -1 },
    { id: 'dbl_draw', form: 'SG_DBL', name: 'HB Draw', type: 'run', carrier: 'RB', run: 'draw', dir: 1 },
    { id: 'dbl_qbdraw', form: 'SG_DBL', name: 'QB Draw', type: 'run', carrier: 'QB', run: 'qbdraw', dir: 1 },
    // Shotgun Trips
    { id: 'trp_flood', form: 'SG_TRIPS', name: 'Trips Flood', type: 'pass', drop: 5, a: { WR2: 'go', WR3: 'out10', TE1: 'flat', WR1: 'dig', RB: B }, prog: ['WR3', 'TE1', 'WR2', 'WR1'], tags: ['mid'] },
    { id: 'trp_ycross', form: 'SG_TRIPS', name: 'Y Cross', type: 'pass', drop: 7, a: { TE1: 'cross', WR1: 'post', WR2: 'go', WR3: 'out', RB: ['flat', -1] }, prog: ['TE1', 'WR1', 'WR3', 'RB', 'WR2'], tags: ['mid', 'deep'] },
    { id: 'trp_bubble', form: 'SG_TRIPS', name: 'WR Bubble', type: 'screen', drop: 1, a: { WR3: 'bubble', WR2: B, TE1: B, WR1: 'slant', RB: B }, prog: ['WR3', 'WR1'], tags: ['screen', 'quick'] },
    { id: 'trp_spacing', form: 'SG_TRIPS', name: 'Spacing', type: 'pass', drop: 3, a: { WR2: 'hitch', WR3: 'hitch', TE1: 'stick', WR1: 'slant', RB: ['flat', -1] }, prog: ['TE1', 'WR3', 'WR2', 'WR1', 'RB'], tags: ['short'] },
    { id: 'trp_fourverts', form: 'SG_TRIPS', name: 'Trips Seams', type: 'pass', drop: 5, a: { WR2: 'fade', WR3: 'seam', TE1: 'seam', WR1: 'curl', RB: B }, prog: ['WR3', 'TE1', 'WR2', 'WR1'], tags: ['deep'] },
    { id: 'trp_oz', form: 'SG_TRIPS', name: 'Outside Zone', type: 'run', carrier: 'RB', run: 'outside', dir: 1 },
    { id: 'trp_counter', form: 'SG_TRIPS', name: 'Counter', type: 'run', carrier: 'RB', run: 'counter', dir: -1 },
    // Empty
    { id: 'emp_quick', form: 'SG_EMPTY', name: 'Five Wide Quick', type: 'pass', drop: 1, a: { WR1: 'slant', WR2: 'slant', WR3: 'out', WR4: 'out', TE1: 'hitch' }, prog: ['WR1', 'WR2', 'WR3', 'WR4', 'TE1'], tags: ['quick', 'short'] },
    { id: 'emp_verts', form: 'SG_EMPTY', name: 'Empty Verts', type: 'pass', drop: 5, a: { WR1: 'go', WR2: 'go', WR3: 'seam', WR4: 'seam', TE1: 'drag' }, prog: ['WR3', 'WR4', 'WR1', 'WR2', 'TE1'], tags: ['deep'] },
    { id: 'emp_levels', form: 'SG_EMPTY', name: 'Levels', type: 'pass', drop: 5, a: { WR3: 'in', WR4: 'dig', WR1: 'go', WR2: 'curl', TE1: 'out' }, prog: ['WR4', 'WR3', 'WR2', 'TE1', 'WR1'], tags: ['mid'] },
    { id: 'emp_qbdraw', form: 'SG_EMPTY', name: 'Empty QB Draw', type: 'run', carrier: 'QB', run: 'qbdraw', dir: 1 },
    // Pistol
    { id: 'pis_pashot', form: 'PISTOL', name: 'PA Deep Shot', type: 'pass', drop: 7, pa: true, a: { WR1: 'post', WR2: 'go', WR3: 'corner', TE1: 'drag', RB: B }, prog: ['WR1', 'WR3', 'WR2', 'TE1'], tags: ['deep', 'pa'] },
    { id: 'pis_stick', form: 'PISTOL', name: 'Stick', type: 'pass', drop: 3, a: { WR3: 'stick', TE1: 'flat', WR2: 'go', WR1: 'slant', RB: ['flat', 1] }, prog: ['WR3', 'WR1', 'TE1', 'RB', 'WR2'], tags: ['short'] },
    { id: 'pis_iz', form: 'PISTOL', name: 'Pistol Zone', type: 'run', carrier: 'RB', run: 'inside', dir: 1 },
    { id: 'pis_power', form: 'PISTOL', name: 'Power', type: 'run', carrier: 'RB', run: 'power', dir: -1 },
    // Singleback
    { id: 'sb_boot', form: 'SINGLEBACK', name: 'PA Boot', type: 'pass', drop: 5, pa: true, boot: 1, a: { TE1: 'corner', WR2: 'deepout', WR3: 'drag', WR1: 'post', RB: B }, prog: ['TE1', 'WR3', 'WR2', 'WR1'], tags: ['pa', 'mid'] },
    { id: 'sb_dig', form: 'SINGLEBACK', name: 'Dig Combo', type: 'pass', drop: 5, a: { WR1: 'dig', WR2: 'go', WR3: 'seam', TE1: 'curl', RB: ['flat', 1] }, prog: ['WR1', 'TE1', 'WR3', 'RB', 'WR2'], tags: ['mid'] },
    { id: 'sb_slants', form: 'SINGLEBACK', name: 'Double Slants', type: 'pass', drop: 3, a: { WR1: 'slant', WR3: 'slant', WR2: 'comeback', TE1: 'flat', RB: B }, prog: ['WR3', 'WR1', 'TE1', 'WR2'], tags: ['quick'] },
    { id: 'sb_dive', form: 'SINGLEBACK', name: 'HB Dive', type: 'run', carrier: 'RB', run: 'dive', dir: 1 },
    { id: 'sb_toss', form: 'SINGLEBACK', name: 'HB Toss', type: 'run', carrier: 'RB', run: 'toss', dir: 1 },
    { id: 'sb_counter', form: 'SINGLEBACK', name: 'Counter Trey', type: 'run', carrier: 'RB', run: 'counter', dir: -1 },
    // Ace
    { id: 'ace_seams', form: 'ACE', name: 'TE Seams', type: 'pass', drop: 5, a: { TE1: 'seam', TE2: 'seam', WR1: 'curl', WR2: 'curl', RB: ['flat', 1] }, prog: ['TE1', 'TE2', 'WR1', 'WR2', 'RB'], tags: ['mid'] },
    { id: 'ace_pacross', form: 'ACE', name: 'PA Crossers', type: 'pass', drop: 7, pa: true, a: { WR1: 'dig', TE2: 'drag', TE1: 'corner', WR2: 'go', RB: B }, prog: ['WR1', 'TE1', 'TE2', 'WR2'], tags: ['pa', 'deep'] },
    { id: 'ace_power', form: 'ACE', name: 'Power O', type: 'run', carrier: 'RB', run: 'power', dir: 1 },
    { id: 'ace_stretch', form: 'ACE', name: 'Stretch', type: 'run', carrier: 'RB', run: 'outside', dir: -1 },
    // I-Form
    { id: 'i_papost', form: 'IFORM', name: 'PA Post', type: 'pass', drop: 7, pa: true, a: { WR1: 'post', WR2: 'comeback', TE1: 'seam', FB: ['flat', 1], RB: B }, prog: ['WR1', 'TE1', 'WR2', 'FB'], tags: ['pa', 'deep'] },
    { id: 'i_curlflat', form: 'IFORM', name: 'I Curl Flat', type: 'pass', drop: 5, a: { WR1: 'curl', WR2: 'curl', TE1: 'flat', FB: ['flat', -1], RB: B }, prog: ['WR2', 'WR1', 'TE1', 'FB'], tags: ['mid'] },
    { id: 'i_iso', form: 'IFORM', name: 'Iso', type: 'run', carrier: 'RB', run: 'iso', dir: 1 },
    { id: 'i_toss', form: 'IFORM', name: 'Toss Sweep', type: 'run', carrier: 'RB', run: 'toss', dir: -1 },
    { id: 'i_power', form: 'IFORM', name: 'I Power', type: 'run', carrier: 'RB', run: 'power', dir: 1 },
    // Goal line
    { id: 'gl_sneak', form: 'GOALLINE', name: 'QB Sneak', type: 'run', carrier: 'QB', run: 'sneak', dir: 1 },
    { id: 'gl_dive', form: 'GOALLINE', name: 'GL Dive', type: 'run', carrier: 'RB', run: 'dive', dir: -1 },
    { id: 'gl_paflat', form: 'GOALLINE', name: 'PA TE Flat', type: 'pass', drop: 3, pa: true, a: { TE1: 'flat', TE2: 'corner', TE3: 'drag', FB: B, RB: B }, prog: ['TE1', 'TE3', 'TE2'], tags: ['pa', 'short'] },
  ];
  P.byId = (id) => P.PLAYS.find((p) => p.id === id) || (P.custom && P.custom.find((p) => p.id === id));
  P.custom = [];

  // run paths relative to ball (x, y with y multiplied by play dir)
  P.RUNS = {
    inside: { path: [[-3, 1.2], [0, 2.4], [5, 3]], mesh: 0.45 },
    outside: { path: [[-4.5, 3], [-2, 7], [3, 9.5]], mesh: 0.45 },
    power: { path: [[-3.5, 0.6], [0, 2], [5, 2.6]], mesh: 0.5 },
    counter: { path: [[-5.5, -1.6], [-3.5, 1], [0, 3], [6, 3.2]], mesh: 0.65 },
    toss: { path: [[-6, 5], [-3, 10], [3, 12.5]], mesh: 0.32, toss: true },
    draw: { path: [[-4, 0], [0, 0.5], [6, 0.8]], mesh: 0.9, delay: 0.7 },
    dive: { path: [[0, 0.7], [4, 0.9]], mesh: 0.35 },
    iso: { path: [[-2, 0.6], [3, 1.2]], mesh: 0.4 },
    sneak: { path: [[1, 0], [4, 0]], mesh: 0, qb: true },
    qbdraw: { path: [[-5.5, 0], [0, 0.6], [6, 1]], mesh: 0, qb: true, delay: 0.75 },
  };

  // ------------------------------------------------------------- defense
  P.DEF_PLAYS = [
    { id: 'c2', name: 'Cover 2 Zone', cov: 'c2', blitz: 0, desc: 'Two deep safeties, corners squat the flats.' },
    { id: 'c3', name: 'Cover 3 Sky', cov: 'c3', blitz: 0, desc: 'Three deep, four underneath. Balanced.' },
    { id: 'c4', name: 'Cover 4 Quarters', cov: 'c4', blitz: 0, desc: 'Four deep. Takes away the deep ball.' },
    { id: 'c1', name: 'Cover 1 Man', cov: 'c1', blitz: 0, desc: 'Man-to-man with a deep free safety.' },
    { id: 'c2m', name: '2 Man Under', cov: 'c2m', blitz: 0, desc: 'Tight man underneath, two deep safeties.' },
    { id: 'c1b', name: 'Cover 1 LB Blitz', cov: 'c1', blitz: 1, desc: 'Send a linebacker, man behind it.' },
    { id: 'c3f', name: 'Fire Zone 3', cov: 'c3', blitz: 1, desc: 'Zone blitz: 5 rush, 3 deep 3 under.' },
    { id: 'c0', name: 'Cover 0 All-Out', cov: 'c0', blitz: 3, desc: 'Everyone comes. No safety help!' },
    { id: 't2', name: 'Tampa 2', cov: 't2', blitz: 0, desc: 'Cover 2 with the MIKE carrying the seam.' },
    { id: 'prev', name: 'Prevent', cov: 'prev', blitz: -1, desc: 'Soft and deep. Keep everything in front.' },
  ];
  P.defById = (id) => P.DEF_PLAYS.find((d) => d.id === id);

  // zone landmarks: [depth past LOS, y absolute]
  P.ZONES = {
    halfL: [15, 13], halfR: [15, 40.3], thirdL: [14, 8.5], mid: [16, 26.67], thirdR: [14, 44.8],
    q1: [13, 8], q2: [15, 20], q3: [15, 33.3], q4: [13, 45.3],
    flatL: [5, 8], flatR: [5, 45.3], curlL: [9, 15], curlR: [9, 38.3], hookL: [8, 21.5], hookM: [8, 26.67], hookR: [8, 31.8],
    deepMidLB: [12, 26.67], prevL: [22, 12], prevR: [22, 41.3], prevM: [26, 26.67],
  };
  P.isDeep = (z) => ['halfL', 'halfR', 'thirdL', 'mid', 'thirdR', 'q1', 'q2', 'q3', 'q4', 'deepMidLB', 'prevL', 'prevR', 'prevM'].includes(z);

  // defensive personnel by offensive look
  P.defFormFor = (numWR, numTE, goalLine) => {
    if (goalLine) return 'GL';
    if (numWR >= 4) return 'DIME';
    if (numWR === 3) return 'NICKEL';
    return 'BASE';
  };
  P.DEF_FORMS = {
    BASE: { DL: 4, LB: 3, CB: 2, S: 2 },
    NICKEL: { DL: 4, LB: 2, CB: 3, S: 2 },
    DIME: { DL: 4, LB: 1, CB: 4, S: 2 },
    GL: { DL: 5, LB: 3, CB: 2, S: 1 },
  };

  // choose an AI defensive call
  P.aiDefCall = (sit, scheme) => {
    const { down, toGo, ballOn, late, diff } = sit;
    const blitzRate = scheme ? scheme.blitz : 0.25;
    const manRate = scheme ? scheme.man : 0.4;
    if (late && diff > 0 && toGo > 8 && Math.random() < 0.5) return 'prev';
    if (ballOn > 94) return Math.random() < 0.5 ? 'c0' : 'c1';
    if (Math.random() < blitzRate * (down === 3 && toGo > 5 ? 1.5 : 1)) return U.pick(['c1b', 'c3f', 'c0', 'c1b']);
    if (Math.random() < manRate) return U.pick(['c1', 'c2m', 'c1']);
    if (scheme && scheme.id === 'tampa' && Math.random() < 0.5) return 't2';
    if (scheme && scheme.id === 'quarters' && Math.random() < 0.5) return 'c4';
    return U.pick(['c2', 'c3', 'c3', 'c4', 't2']);
  };

  // AI offensive call. sit: {down,toGo,ballOn,q,clock,diff}, opts: {userSlotFilter, pass: bool}
  P.aiOffCall = (sit, scheme, opts) => {
    opts = opts || {};
    let type = opts.type;
    if (!type) {
      let p = scheme ? scheme.pass : 0.55;
      if (sit.down === 3) p = sit.toGo >= 7 ? 0.88 : sit.toGo <= 2 ? 0.4 : 0.7;
      else if (sit.down === 2 && sit.toGo >= 8) p = 0.66;
      else if (sit.down === 4) p = sit.toGo <= 1 ? 0.35 : 0.85;
      if (sit.late && sit.diff < 0) p = 0.88;
      if (sit.late && sit.diff > 0) p = 0.25;
      type = Math.random() < p ? 'pass' : 'run';
    }
    let pool = P.allPlays().filter((pl) => (type === 'run' ? pl.type === 'run' : pl.type !== 'run'));
    if (sit.ballOn >= 97) pool = pool.filter((pl) => pl.form === 'GOALLINE' || (pl.type === 'pass' && (pl.tags || []).includes('short')) || pl.type === 'run');
    else pool = pool.filter((pl) => pl.form !== 'GOALLINE' || (sit.toGo <= 1 && Math.random() < 0.5));
    if (type === 'pass') {
      if (sit.toGo >= 12) { const d = pool.filter((pl) => (pl.tags || []).some((t) => t === 'deep' || t === 'mid')); if (d.length) pool = d; }
      else if (sit.toGo <= 4) { const s = pool.filter((pl) => (pl.tags || []).some((t) => t === 'short' || t === 'quick')); if (s.length) pool = s; }
    }
    if (opts.filter) { const f = pool.filter(opts.filter); if (f.length) pool = f; }
    if (opts.weight) return U.wpick(pool, opts.weight);
    return U.pick(pool);
  };
  P.allPlays = () => P.PLAYS.concat(P.custom || []);

  // ------------------------------------------------------------- personnel
  // Map formation slots to players from a depth chart. rot: {rb2: bool}
  P.SLOT_POS = { QB: ['QB', 0], RB: ['RB', 0], FB: ['RB', 1], WR1: ['WR', 0], WR2: ['WR', 1], WR3: ['WR', 2], WR4: ['WR', 3], WR5: ['WR', 4],
    TE1: ['TE', 0], TE2: ['TE', 1], TE3: ['TE', 2], LT: ['OT', 0], LG: ['OG', 0], C: ['C', 0], RG: ['OG', 1], RT: ['OT', 1] };
  P.offPersonnel = (depth, formId, rot) => {
    const f = P.FORMS[formId];
    const out = {};
    const used = new Set();
    for (const slot in f.slots) {
      let [pos, i] = P.SLOT_POS[slot];
      if (slot === 'RB' && rot && rot.rb2 && depth.RB[1]) i = 1;
      if (slot === 'FB' && rot && rot.rb2) i = 0;
      let pl = depth[pos][i];
      let k = i;
      while (pl && used.has(pl.id)) { k++; pl = depth[pos][k]; }
      if (!pl) {
        const alt = { RB: ['WR', 'TE'], WR: ['TE', 'RB', 'CB'], TE: ['OT', 'WR'], OT: ['OG', 'C', 'DT'], OG: ['OT', 'C', 'DT'], C: ['OG', 'OT'], QB: ['RB', 'WR'] }[pos] || [];
        for (const a of alt) { pl = (depth[a] || []).find((x) => !used.has(x.id)); if (pl) break; }
      }
      if (pl) { out[slot] = pl; used.add(pl.id); }
    }
    return out;
  };
  P.defPersonnel = (depth, dform) => {
    const f = P.DEF_FORMS[dform];
    const out = { DL: [], LB: [], CB: [], S: [] };
    const used = new Set();
    const take = (pos, n, into) => {
      for (const p of depth[pos]) { if (into.length >= n) break; if (!used.has(p.id)) { into.push(p); used.add(p.id); } }
    };
    // DL: alternate DE/DT
    const nDE = f.DL >= 4 ? 2 : 2, nDT = f.DL - nDE;
    const des = [], dts = [];
    take('DE', nDE, des); take('DT', nDT, dts);
    if (dts.length < nDT) take('DE', nDE + (nDT - dts.length), des);
    out.DL = [des[0], ...dts, des[1]].filter(Boolean);
    if (des.length > 2) out.DL.push(...des.slice(2));
    take('LB', f.LB, out.LB);
    take('CB', f.CB, out.CB);
    if (out.CB.length < f.CB) take('S', f.S + (f.CB - out.CB.length), out.S);
    take('S', f.S, out.S);
    if (out.LB.length < f.LB) take('S', f.S + 1, out.S);
    return out;
  };

  P.routePreview = (play) => {
    // used by the UI to draw play diagrams: returns {slots: {slot:{x,y}}, routes: {slot: [[x,y]...]}, run: path}
    const f = P.FORMS[play.form];
    const ballY = W / 2;
    const out = { slots: {}, routes: {}, run: null, carrier: play.carrier };
    for (const slot in f.slots) {
      const s = f.slots[slot];
      const y = s.ya != null ? (s.ya >= 0 ? s.ya : W + s.ya) : ballY + s.y;
      out.slots[slot] = { x: s.x, y };
    }
    if (play.type === 'run') {
      const r = P.RUNS[play.run];
      const st = out.slots[play.carrier];
      out.run = [[st.x, st.y]].concat(r.path.map(([x, y]) => [x, ballY + y * play.dir]));
    } else {
      for (const slot in play.a || {}) {
        const asg = play.a[slot];
        const rid = Array.isArray(asg) ? asg[0] : asg;
        if (rid === 'block' || !P.ROUTES[rid]) continue;
        const st = out.slots[slot];
        const sideSign = Array.isArray(asg) ? asg[1] : (st.y < ballY - 0.5 ? -1 : st.y > ballY + 0.5 ? 1 : 1);
        const pts = [[st.x, st.y]];
        let prev = [st.x, st.y];
        for (const [d, o] of P.ROUTES[rid].pts) {
          const pt = [st.x + d, U.clamp(st.y + o * sideSign, 1, W - 1)];
          if (Math.abs(d) > 20 || Math.abs(o) > 20) {
            // shorten long extension segments for diagrams
            const k = 6 / Math.max(1, Math.hypot(pt[0] - prev[0], pt[1] - prev[1]));
            pts.push([prev[0] + (pt[0] - prev[0]) * Math.min(1, k * 1.5), prev[1] + (pt[1] - prev[1]) * Math.min(1, k * 1.5)]);
          } else pts.push(pt);
          prev = pts[pts.length - 1];
        }
        out.routes[slot] = pts;
      }
    }
    return out;
  };

  PG.Plays = P;
})();
