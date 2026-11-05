/* Pixel Gridiron - static game data: teams, names, positions, attributes, perks, gear */
(function () {
  'use strict';
  const PG = window.PG;
  const D = {};

  D.CONFS = [
    { id: 0, name: 'Liberty Conference', abbr: 'LC', divs: ['North', 'East', 'South', 'Central'] },
    { id: 1, name: 'Frontier Conference', abbr: 'FC', divs: ['North', 'Central', 'South', 'West'] },
  ];

  // [abbr, city, name, primary, secondary, conf, div, dome, climate, stadium]
  const T = [
    ['BOS', 'Boston', 'Harbormen', '#1b2a4a', '#d4a72c', 0, 0, 0, 'cold', 'Harborside Field'],
    ['BUF', 'Buffalo', 'Frostbite', '#5fb3e0', '#0d2a52', 0, 0, 0, 'cold', 'Lake Effect Stadium'],
    ['CLE', 'Cleveland', 'Hounds', '#5a3a22', '#e0752d', 0, 0, 0, 'cold', 'Kennel Park'],
    ['PIT', 'Pittsburgh', 'Forge', '#1f1f1f', '#ff7a1a', 0, 0, 0, 'cold', 'The Foundry'],
    ['NYS', 'New York', 'Skyline', '#2346b8', '#b9c0c9', 0, 1, 0, 'cold', 'Skyline Stadium'],
    ['PHI', 'Philadelphia', 'Founders', '#7a1f2b', '#e8d9b0', 0, 1, 0, 'cold', 'Liberty Bell Field'],
    ['BAL', 'Baltimore', 'Admirals', '#0f4c5c', '#e3b23c', 0, 1, 0, 'cold', 'Inner Harbor Bowl'],
    ['JER', 'Jersey', 'Thunder', '#4b2a85', '#f2d530', 0, 1, 0, 'cold', 'Thunderdome Park'],
    ['MIA', 'Miami', 'Barracudas', '#19b5b0', '#ff6f59', 0, 2, 0, 'warm', 'Biscayne Field'],
    ['TAM', 'Tampa', 'Mantas', '#12355b', '#b5e02d', 0, 2, 0, 'warm', 'Bayshore Stadium'],
    ['ATL', 'Atlanta', 'Firebirds', '#c8102e', '#2a2a2a', 0, 2, 1, 'warm', 'Phoenix Dome'],
    ['CHA', 'Charlotte', 'Monarchs', '#3e2b6b', '#2fb6a8', 0, 2, 0, 'mild', 'Crown Field'],
    ['COL', 'Columbus', 'Explorers', '#1f5132', '#c9a66b', 0, 3, 0, 'cold', 'Frontier Park'],
    ['LOU', 'Louisville', 'Thoroughbreds', '#a3162b', '#151515', 0, 3, 0, 'mild', 'Derby Downs Stadium'],
    ['NSH', 'Nashville', 'Rhythm', '#e8b02a', '#1e3d8f', 0, 3, 0, 'mild', 'Music Row Field'],
    ['MEM', 'Memphis', 'Riverboats', '#3c6e91', '#c23b2a', 0, 3, 0, 'mild', 'Paddlewheel Park'],
    ['CHI', 'Chicago', 'Blizzard', '#2c4f8a', '#9fc5e8', 1, 0, 0, 'cold', 'Windy City Field'],
    ['DET', 'Detroit', 'Mechanics', '#4a5560', '#f28c28', 1, 0, 1, 'cold', 'Assembly Line Dome'],
    ['MIL', 'Milwaukee', 'Ironmen', '#6b6f73', '#b22222', 1, 0, 0, 'cold', 'Ironworks Stadium'],
    ['MIN', 'Minnesota', 'Muskies', '#2e7d32', '#cfd8dc', 1, 0, 1, 'cold', 'Northwoods Dome'],
    ['IND', 'Indianapolis', 'Speedsters', '#222222', '#ffd400', 1, 1, 1, 'cold', 'Brickyard Dome'],
    ['KC', 'Kansas City', 'Pioneers', '#b3261e', '#e5c07b', 1, 1, 0, 'cold', 'Wagon Trail Field'],
    ['DEN', 'Denver', 'Yetis', '#4a90d9', '#102a43', 1, 1, 0, 'cold', 'Mile High Peak'],
    ['SLC', 'Salt Lake', 'Summit', '#34495e', '#e67e22', 1, 1, 0, 'cold', 'Wasatch Stadium'],
    ['HOU', 'Houston', 'Wildcatters', '#1b1b1b', '#d62828', 1, 2, 1, 'warm', 'Gusher Dome'],
    ['DAL', 'Dallas', 'Stallions', '#6d1a36', '#f2c14e', 1, 2, 1, 'warm', 'Stampede Dome'],
    ['AUS', 'Austin', 'Armadillos', '#f47a1f', '#13294b', 1, 2, 0, 'warm', 'Hill Country Field'],
    ['NOL', 'New Orleans', 'Krewe', '#5b2a86', '#2e8b57', 1, 2, 1, 'warm', 'Bayou Dome'],
    ['LA', 'Los Angeles', 'Riptide', '#0e7c86', '#ffc93c', 1, 3, 0, 'warm', 'Pacific Coast Stadium'],
    ['SF', 'San Francisco', 'Fog', '#8e9aa6', '#9e1b32', 1, 3, 0, 'wet', 'Golden Gate Field'],
    ['SEA', 'Seattle', 'Orcas', '#121212', '#e9eef2', 1, 3, 0, 'wet', 'Puget Sound Park'],
    ['LV', 'Las Vegas', 'High Rollers', '#151515', '#ff2e88', 1, 3, 1, 'warm', 'Neon Dome'],
  ];
  D.TEAMS = T.map((t, i) => ({
    id: i, abbr: t[0], city: t[1], name: t[2], c1: t[3], c2: t[4], conf: t[5], div: t[6],
    dome: !!t[7], climate: t[8], stadium: t[9],
  }));

  D.OFF_SCHEMES = [
    { id: 'airraid', name: 'Air Raid', pass: 0.64, deep: 1.2, desc: 'Spread it out and throw it all over the field.' },
    { id: 'westcoast', name: 'West Coast', pass: 0.58, deep: 0.8, desc: 'Quick, timing-based short passes.' },
    { id: 'spread', name: 'Spread Option', pass: 0.52, deep: 1.0, desc: 'Space and speed, QB involved in the run game.' },
    { id: 'power', name: 'Power Run', pass: 0.44, deep: 0.9, desc: 'Downhill running with play-action shots.' },
    { id: 'pro', name: 'Pro Style', pass: 0.54, deep: 1.0, desc: 'Balanced attack from under center.' },
  ];
  D.DEF_SCHEMES = [
    { id: '43', name: '4-3 Base', blitz: 0.22, man: 0.4 },
    { id: '34', name: '3-4 Base', blitz: 0.3, man: 0.4 },
    { id: 'tampa', name: 'Tampa 2', blitz: 0.15, man: 0.25 },
    { id: 'blitz', name: 'Blitz Heavy', blitz: 0.42, man: 0.6 },
    { id: 'quarters', name: 'Quarters', blitz: 0.2, man: 0.3 },
  ];

  D.FIRST = ('James John Robert Michael William David Richard Joseph Thomas Chris Daniel Matthew Anthony Mark Donald ' +
    'Steven Andrew Josh Kevin Brian George Tim Ronald Jason Ryan Jacob Gary Nick Eric Jonathan Justin Brandon Scott ' +
    'Ben Sam Gregory Alex Patrick Frank Ray Jack Dennis Jerry Tyler Aaron Jose Adam Nathan Henry Zach Doug Peter Kyle ' +
    'Noah Ethan Jeremy Walter Christian Keith Roger Terry Austin Sean Gerald Carl Dylan Harold Jordan Jesse Bryan ' +
    'Lawrence Arthur Gabriel Bruce Logan Billy Joe Alan Juan Elijah Willie Albert Wayne Randy Mason Vincent Liam Roy ' +
    'Bobby Caleb Bradley Russell Lucas DeShawn Jamal Tre Marcus Darius Malik Andre Terrell Demarco Jalen Isaiah Xavier ' +
    'Trevon Khalil Devonte Lamar Rashad Tyrell Dante Cedric Quincy Reggie Marquise Desmond Cameron Mekhi Zion Kendrick ' +
    'Javon Amari Treylon Bo Colt Brock Cade Tanner Hunter Wyatt Chase Brody Garrett Trent Cole Blake Grady Koa Tua Manu ' +
    'Ikaika Mateo Diego Carlos Luis Rafael Antonio Miguel Hector Emeka Chidi Obi Kofi Tariq Omar Hassan Yusuf Kai Ezra ' +
    'Silas Micah Jaxon Rhett Beau Sterling Knox Ace Brooks Deion Shedeur Travon Keenan Lavonte Rodney Clinton Mitch').split(' ');
  D.LAST = ('Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson ' +
    'Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson ' +
    'Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams Nelson Baker Hall Rivera Campbell ' +
    'Mitchell Carter Roberts Gomez Phillips Evans Turner Diaz Parker Cruz Edwards Collins Reyes Stewart Morris Morales ' +
    'Murphy Cook Rogers Gutierrez Ortiz Morgan Cooper Peterson Bailey Reed Kelly Howard Ramos Kim Cox Ward Richardson ' +
    'Watson Brooks Chavez Wood James Bennett Gray Mendoza Ruiz Hughes Price Alvarez Castillo Sanders Patel Myers Long ' +
    'Ross Foster Jimenez Powell Jenkins Perry Russell Sullivan Bell Coleman Butler Henderson Barnes Gonzales Fisher ' +
    'Vasquez Simmons Romero Jordan Patterson Alexander Hamilton Graham Reynolds Griffin Wallace Moreno West Cole ' +
    'Hayes Bryant Herrera Gibson Ellis Tran Medina Aguilar Stevens Murray Ford Castro Marshall Owens Harrison Fernandez ' +
    'McDonald Woods Washington Kennedy Wells Vargas Henry Chen Freeman Webb Tucker Guzman Burns Crawford Olson Simpson ' +
    'Porter Hunter Gordon Mendez Silva Shaw Snyder Mason Dixon Munoz Hunt Hicks Holmes Palmer Wagner Black Robertson ' +
    'Boyd Rose Stone Salazar Fox Warren Mills Meyer Rice Schmidt Garza Daniels Ferguson Nichols Stephens Soto Weaver ' +
    'Ryan Gardner Payne Grant Dunn Kelley Spencer Hawkins Arnold Pierce Vazquez Hansen Peters Santos Hart Bradley ' +
    'Knight Elliott Cunningham Duncan Armstrong Hudson Carroll Lane Riley Andrews Alvarado Ray Delgado Berry Perkins ' +
    'Hoffman Johnston Matthews Pena Richards Willis Carpenter Lawrence Sandoval Okafor Adebayo Mahomes Fuimaono ' +
    'Tagovailoa Sewell Nwosu Okoye Mbeki Afolabi Kowalski Novak Lindqvist Becker Larsen Sorensen Dubois Fontaine ' +
    'Beaumont Calloway Thibodeaux Boudreaux Lockett Mayfield Kingsbury Blackwood Stroud Prescott Winfield Bridgewater').split(' ');

  D.COLLEGES = ['Pine Ridge State', 'Great Lakes Tech', 'Desert Sun University', 'Bluegrass A&M', 'Cascade University',
    'Gulf Coast State', 'Prairie Valley', 'Ironwood College', 'Redstone University', 'Summit State', 'Riverbend University',
    'Magnolia State', 'Sierra Tech', 'Lone Star Poly', 'Appalachian Union', 'Harbor City University', 'Twin Rivers College',
    'Golden Plains', 'Canyon State', 'Evergreen University', 'Cypress Bay', 'Northern Lights U', 'Bay Area Tech',
    'Rocky Peak State', 'Heartland University', 'Southern Pines', 'Tidewater College', 'Big Sky State', 'Midland Tech',
    'Copper Valley', 'Bayou State', 'Atlantic Coast U'];

  D.HOMETOWNS = ['Houston, TX', 'Miami, FL', 'Atlanta, GA', 'Los Angeles, CA', 'Dallas, TX', 'Chicago, IL', 'Detroit, MI',
    'New Orleans, LA', 'Columbus, OH', 'Phoenix, AZ', 'Tampa, FL', 'Baton Rouge, LA', 'Birmingham, AL', 'Memphis, TN',
    'Charlotte, NC', 'Jacksonville, FL', 'San Antonio, TX', 'Oakland, CA', 'Seattle, WA', 'Denver, CO', 'Omaha, NE',
    'Pittsburgh, PA', 'Cleveland, OH', 'Honolulu, HI', 'Tulsa, OK', 'Mobile, AL', 'Savannah, GA', 'Richmond, VA',
    'Norfolk, VA', 'Fresno, CA', 'Sacramento, CA', 'Las Vegas, NV', 'Albuquerque, NM', 'Boise, ID', 'Lincoln, NE',
    'Little Rock, AR', 'Jackson, MS', 'Lafayette, LA', 'Odessa, TX', 'Valdosta, GA', 'Massillon, OH', 'Long Beach, CA'];

  // ---------- Attributes ----------
  D.ATTRS = {
    spd: ['Speed', 'Top running speed'],
    acc: ['Acceleration', 'How fast you reach top speed'],
    agi: ['Agility', 'Change of direction'],
    str: ['Strength', 'Power in blocking and breaking tackles'],
    sta: ['Stamina', 'Sprint longer before slowing'],
    awr: ['Awareness', 'Football IQ and reactions'],
    inj: ['Toughness', 'Resistance to injuries'],
    thp: ['Throw Power', 'Ball velocity and max distance'],
    tas: ['Short Accuracy', 'Accuracy on throws under 12 yds'],
    tam: ['Mid Accuracy', 'Accuracy on throws 12-25 yds'],
    tad: ['Deep Accuracy', 'Accuracy on throws over 25 yds'],
    tor: ['Throw on Run', 'Accuracy while moving'],
    qrl: ['Quick Release', 'Faster throwing motion'],
    cth: ['Catching', 'Hands on routine catches'],
    cit: ['Catch in Traffic', 'Hands when contested'],
    rte: ['Route Running', 'Separation at route breaks'],
    rel: ['Release', 'Beating press coverage'],
    jmp: ['Jumping', 'Catch radius and high-point'],
    car: ['Carrying', 'Ball security'],
    btk: ['Break Tackle', 'Shed arm tackles'],
    elu: ['Elusiveness', 'Avoid defenders in space'],
    jkm: ['Juke Move', 'Juke effectiveness'],
    stf: ['Stiff Arm', 'Stiff arm effectiveness'],
    spm: ['Spin Move', 'Spin move effectiveness'],
    pbk: ['Pass Block', 'Protecting the passer'],
    rbk: ['Run Block', 'Opening running lanes'],
    prs: ['Pass Rush', 'Beating pass blockers'],
    bsh: ['Block Shed', 'Getting off run blocks'],
    tak: ['Tackling', 'Wrapping up ball carriers'],
    pur: ['Pursuit', 'Taking good angles'],
    hit: ['Hit Power', 'Forcing fumbles on hits'],
    mcv: ['Man Coverage', 'Sticking to receivers'],
    zcv: ['Zone Coverage', 'Reading routes in zone'],
    pre: ['Press', 'Jamming at the line'],
    prc: ['Play Recognition', 'Diagnosing plays quickly'],
    kpw: ['Kick Power', 'Kicking distance'],
    kac: ['Kick Accuracy', 'Kicking accuracy'],
  };

  const PHYS = ['spd', 'acc', 'agi', 'str', 'sta', 'awr', 'inj'];
  // position: [label, attrs (beyond physical), ovr weights, means {attr: [mean, sd]}, ht range, wt range, numbers]
  D.POS = {
    QB: { name: 'Quarterback', group: 'off', attrs: ['thp', 'tas', 'tam', 'tad', 'tor', 'qrl', 'car', 'elu', 'btk', 'jkm'],
      w: { thp: .14, tas: .13, tam: .13, tad: .1, awr: .16, tor: .07, qrl: .07, spd: .05, agi: .03, elu: .02, str: .02, car: .02, acc: .02, sta: .02, inj: .02 },
      m: { spd: [66, 10], acc: [70, 8], agi: [68, 8], str: [58, 8], thp: [84, 6], tas: [79, 7], tam: [76, 7], tad: [72, 8], tor: [70, 9], qrl: [76, 7], awr: [70, 10], car: [62, 8], elu: [55, 12], btk: [45, 10], jkm: [50, 12] },
      ht: [73, 78], wt: [205, 240], nums: [1, 19] },
    RB: { name: 'Running Back', group: 'off', attrs: ['car', 'btk', 'elu', 'jkm', 'stf', 'spm', 'cth', 'rte', 'pbk'],
      w: { spd: .15, acc: .12, agi: .1, car: .1, btk: .1, elu: .1, jkm: .06, stf: .04, spm: .03, cth: .07, rte: .03, str: .04, awr: .03, pbk: .02, sta: .01 },
      m: { spd: [88, 4], acc: [88, 4], agi: [86, 5], str: [70, 8], car: [80, 7], btk: [74, 9], elu: [78, 9], jkm: [76, 9], stf: [68, 10], spm: [70, 10], cth: [64, 10], rte: [55, 10], pbk: [50, 10], awr: [65, 10] },
      ht: [68, 73], wt: [195, 235], nums: [20, 39] },
    WR: { name: 'Wide Receiver', group: 'off', attrs: ['cth', 'cit', 'rte', 'rel', 'jmp', 'car', 'elu', 'jkm', 'btk', 'rbk'],
      w: { spd: .16, acc: .08, agi: .06, cth: .16, cit: .08, rte: .16, rel: .06, jmp: .06, awr: .06, elu: .04, car: .02, jkm: .02, btk: .02, str: .02 },
      m: { spd: [89, 4], acc: [87, 4], agi: [86, 5], str: [55, 8], cth: [78, 8], cit: [70, 9], rte: [74, 9], rel: [70, 9], jmp: [78, 8], car: [65, 9], elu: [70, 10], jkm: [68, 10], btk: [52, 10], rbk: [45, 10], awr: [66, 10] },
      ht: [69, 77], wt: [175, 225], nums: [10, 19] },
    TE: { name: 'Tight End', group: 'off', attrs: ['cth', 'cit', 'rte', 'rel', 'jmp', 'car', 'btk', 'elu', 'rbk', 'pbk'],
      w: { cth: .14, cit: .08, rte: .1, rbk: .14, pbk: .08, str: .1, spd: .09, acc: .05, awr: .07, jmp: .05, btk: .05, agi: .03, car: .02 },
      m: { spd: [78, 5], acc: [78, 5], agi: [72, 6], str: [72, 7], cth: [72, 9], cit: [70, 9], rte: [64, 10], rel: [62, 10], jmp: [72, 8], car: [62, 8], btk: [66, 9], elu: [52, 10], rbk: [64, 10], pbk: [60, 10], awr: [64, 10] },
      ht: [75, 79], wt: [240, 265], nums: [80, 89] },
    OT: { name: 'Offensive Tackle', group: 'off', attrs: ['pbk', 'rbk'],
      w: { pbk: .32, rbk: .22, str: .2, awr: .1, agi: .06, acc: .04, sta: .03, inj: .03 },
      m: { spd: [55, 5], acc: [64, 6], agi: [62, 7], str: [82, 6], pbk: [74, 8], rbk: [70, 8], awr: [66, 10] },
      ht: [76, 80], wt: [300, 340], nums: [60, 79] },
    OG: { name: 'Guard', group: 'off', attrs: ['pbk', 'rbk'],
      w: { rbk: .3, pbk: .26, str: .22, awr: .1, agi: .05, acc: .04, inj: .03 },
      m: { spd: [52, 5], acc: [62, 6], agi: [58, 7], str: [85, 5], pbk: [70, 8], rbk: [74, 8], awr: [64, 10] },
      ht: [74, 78], wt: [305, 335], nums: [60, 79] },
    C: { name: 'Center', group: 'off', attrs: ['pbk', 'rbk'],
      w: { rbk: .28, pbk: .26, str: .2, awr: .16, agi: .05, acc: .05 },
      m: { spd: [52, 5], acc: [62, 6], agi: [60, 7], str: [82, 6], pbk: [70, 8], rbk: [70, 8], awr: [70, 10] },
      ht: [74, 77], wt: [295, 320], nums: [50, 79] },
    DE: { name: 'Defensive End', group: 'def', attrs: ['prs', 'bsh', 'tak', 'pur', 'prc', 'hit'],
      w: { prs: .3, bsh: .14, spd: .12, acc: .1, str: .1, tak: .1, pur: .06, prc: .05, agi: .03 },
      m: { spd: [76, 6], acc: [80, 5], agi: [70, 7], str: [78, 7], prs: [74, 9], bsh: [70, 8], tak: [70, 8], pur: [70, 8], prc: [64, 10], hit: [70, 9], awr: [62, 10] },
      ht: [75, 79], wt: [255, 285], nums: [90, 99] },
    DT: { name: 'Defensive Tackle', group: 'def', attrs: ['prs', 'bsh', 'tak', 'pur', 'prc', 'hit'],
      w: { bsh: .26, str: .22, prs: .18, tak: .12, prc: .08, pur: .06, acc: .05, spd: .03 },
      m: { spd: [62, 6], acc: [72, 6], agi: [60, 7], str: [88, 5], prs: [68, 9], bsh: [74, 8], tak: [70, 8], pur: [62, 8], prc: [62, 10], hit: [72, 9], awr: [60, 10] },
      ht: [74, 78], wt: [295, 330], nums: [90, 99] },
    LB: { name: 'Linebacker', group: 'def', attrs: ['tak', 'pur', 'prc', 'hit', 'bsh', 'mcv', 'zcv', 'prs', 'cth'],
      w: { tak: .16, pur: .12, prc: .14, zcv: .12, mcv: .06, bsh: .1, spd: .1, acc: .05, hit: .05, awr: .05, str: .03, prs: .02 },
      m: { spd: [80, 5], acc: [82, 5], agi: [76, 6], str: [72, 7], tak: [76, 8], pur: [76, 8], prc: [68, 10], hit: [74, 9], bsh: [66, 9], mcv: [58, 10], zcv: [64, 10], prs: [58, 12], cth: [52, 10], awr: [66, 10] },
      ht: [72, 76], wt: [230, 250], nums: [40, 59] },
    CB: { name: 'Cornerback', group: 'def', attrs: ['mcv', 'zcv', 'pre', 'tak', 'pur', 'prc', 'cth', 'jmp', 'hit'],
      w: { mcv: .2, zcv: .14, spd: .18, acc: .08, agi: .08, pre: .06, prc: .08, cth: .04, jmp: .05, tak: .05, awr: .04 },
      m: { spd: [90, 4], acc: [89, 4], agi: [88, 5], str: [55, 8], mcv: [74, 9], zcv: [70, 9], pre: [66, 10], tak: [60, 9], pur: [72, 8], prc: [64, 10], cth: [62, 10], jmp: [82, 7], hit: [56, 10], awr: [64, 10] },
      ht: [69, 74], wt: [180, 200], nums: [20, 39] },
    S: { name: 'Safety', group: 'def', attrs: ['mcv', 'zcv', 'pre', 'tak', 'pur', 'prc', 'cth', 'jmp', 'hit'],
      w: { zcv: .18, mcv: .1, prc: .12, spd: .14, tak: .12, hit: .06, pur: .08, acc: .06, cth: .04, jmp: .04, awr: .06 },
      m: { spd: [87, 4], acc: [86, 4], agi: [82, 5], str: [62, 8], mcv: [64, 10], zcv: [72, 9], pre: [55, 10], tak: [72, 8], pur: [76, 8], prc: [68, 10], cth: [62, 10], jmp: [80, 7], hit: [72, 9], awr: [66, 10] },
      ht: [70, 74], wt: [195, 215], nums: [20, 49] },
    K: { name: 'Kicker', group: 'st', attrs: ['kpw', 'kac'], w: { kpw: .5, kac: .5 },
      m: { spd: [50, 8], acc: [50, 8], agi: [50, 8], str: [45, 8], kpw: [84, 7], kac: [80, 8], awr: [60, 10] },
      ht: [70, 75], wt: [180, 210], nums: [1, 9] },
    P: { name: 'Punter', group: 'st', attrs: ['kpw', 'kac'], w: { kpw: .55, kac: .45 },
      m: { spd: [50, 8], acc: [50, 8], agi: [50, 8], str: [45, 8], kpw: [82, 7], kac: [76, 8], awr: [60, 10] },
      ht: [72, 76], wt: [195, 220], nums: [1, 9] },
  };
  for (const k in D.POS) {
    const p = D.POS[k];
    p.id = k;
    p.all = PHYS.concat(p.attrs);
  }
  D.PHYS = PHYS;
  D.POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
  D.ROSTER_COUNTS = { QB: 3, RB: 3, WR: 6, TE: 3, OT: 3, OG: 3, C: 2, DE: 4, DT: 3, LB: 6, CB: 5, S: 4, K: 1, P: 1 };
  // positions available for the user career
  D.CAREER_POS = ['QB', 'RB', 'WR', 'TE', 'LB', 'CB', 'S'];

  // Archetypes: modifiers to attributes at creation
  D.ARCHETYPES = {
    QB: [
      { id: 'pocket', name: 'Pocket Passer', desc: 'Elite accuracy and power from the pocket. Not much of a runner.', mod: { thp: 4, tas: 6, tam: 6, tad: 4, spd: -8, elu: -8, awr: 4 } },
      { id: 'scrambler', name: 'Scrambler', desc: 'Dangerous with his legs; extends plays and throws on the move.', mod: { spd: 10, acc: 8, elu: 12, tor: 8, jkm: 10, tad: -4, tam: -3 } },
      { id: 'general', name: 'Field General', desc: 'Reads defenses instantly, quick release, rarely makes mistakes.', mod: { awr: 12, qrl: 8, tas: 4, thp: -4, spd: -2 } },
      { id: 'gunslinger', name: 'Gunslinger', desc: 'Cannon arm that fits any window. Will take risks.', mod: { thp: 10, tad: 6, awr: -4, tas: -2 } },
    ],
    RB: [
      { id: 'power', name: 'Power Back', desc: 'Runs through contact. Brutal stiff arm.', mod: { str: 10, btk: 12, stf: 12, spd: -4, elu: -6, jkm: -6 } },
      { id: 'elusive', name: 'Elusive Back', desc: 'Makes defenders miss with jukes and spins.', mod: { elu: 12, jkm: 12, spm: 10, agi: 6, btk: -8, str: -6 } },
      { id: 'receiving', name: 'Receiving Back', desc: 'A weapon out of the backfield.', mod: { cth: 14, rte: 14, btk: -4, stf: -6 } },
      { id: 'speed', name: 'Home Run Hitter', desc: 'Top-end speed that takes it the distance.', mod: { spd: 6, acc: 6, car: -4, btk: -4, str: -4 } },
    ],
    WR: [
      { id: 'deep', name: 'Deep Threat', desc: 'Blazing speed to take the top off the defense.', mod: { spd: 6, acc: 4, jmp: 4, rte: -6, cit: -4 } },
      { id: 'route', name: 'Route Technician', desc: 'Crisp breaks and constant separation.', mod: { rte: 12, rel: 8, agi: 4, spd: -2, jmp: -4 } },
      { id: 'possession', name: 'Possession', desc: 'Reliable hands in traffic, moves the chains.', mod: { cth: 8, cit: 10, awr: 6, spd: -4 } },
      { id: 'physical', name: 'Physical', desc: 'Big body who wins contested catches.', mod: { str: 10, jmp: 8, cit: 8, btk: 8, agi: -6, spd: -2 } },
      { id: 'slot', name: 'Slot Weapon', desc: 'Shifty underneath with YAC ability.', mod: { agi: 6, elu: 10, jkm: 10, rte: 4, jmp: -8, str: -6 } },
    ],
    TE: [
      { id: 'vertical', name: 'Vertical Threat', desc: 'Stretches the seam like a big receiver.', mod: { spd: 6, rte: 8, cth: 6, rbk: -8, pbk: -8 } },
      { id: 'blocking', name: 'Blocking TE', desc: 'A sixth offensive lineman.', mod: { rbk: 14, pbk: 12, str: 8, rte: -8, spd: -4 } },
      { id: 'possession', name: 'Possession TE', desc: 'Sure-handed safety valve.', mod: { cth: 10, cit: 10, awr: 4, spd: -2 } },
    ],
    LB: [
      { id: 'runstop', name: 'Run Stopper', desc: 'Fills gaps and stacks ball carriers.', mod: { tak: 8, bsh: 10, hit: 8, str: 6, mcv: -8, zcv: -4 } },
      { id: 'coverage', name: 'Coverage LB', desc: 'Moves like a safety in coverage.', mod: { zcv: 12, mcv: 10, spd: 4, bsh: -8, str: -6 } },
      { id: 'rusher', name: 'Pass Rusher', desc: 'Lives in the backfield.', mod: { prs: 16, acc: 6, hit: 4, zcv: -8, mcv: -8 } },
    ],
    CB: [
      { id: 'man', name: 'Lockdown', desc: 'Shadows the opponent\'s best receiver.', mod: { mcv: 10, pre: 8, agi: 4, zcv: -4, tak: -4 } },
      { id: 'zone', name: 'Zone Hawk', desc: 'Reads the QB\'s eyes and jumps routes.', mod: { zcv: 10, prc: 10, cth: 8, mcv: -6, pre: -6 } },
      { id: 'slot', name: 'Slot Corner', desc: 'Quick, tough, and great tackling in space.', mod: { agi: 6, tak: 8, pur: 6, jmp: -6, spd: -2 } },
    ],
    S: [
      { id: 'center', name: 'Center Fielder', desc: 'Range for days in deep coverage.', mod: { zcv: 10, spd: 4, cth: 8, prc: 4, hit: -6, tak: -4 } },
      { id: 'box', name: 'Box Safety', desc: 'Enforcer who plays like a linebacker.', mod: { tak: 10, hit: 12, str: 8, bsh: 6, zcv: -6, spd: -3 } },
      { id: 'hybrid', name: 'Hybrid', desc: 'Covers slots and tight ends in man.', mod: { mcv: 10, agi: 4, zcv: 2, hit: -4 } },
    ],
  };

  D.DEV = [
    { id: 'normal', name: 'Normal', mult: 1.0, p: 0.7 },
    { id: 'star', name: 'Star', mult: 1.35, p: 0.2 },
    { id: 'superstar', name: 'Superstar', mult: 1.7, p: 0.08 },
    { id: 'elite', name: 'Elite', mult: 2.1, p: 0.02 },
  ];

  // ---------- Perks / abilities ----------
  // pos: list of positions, or 'all'. tier gating by level.
  D.PERKS = [
    { id: 'gunslinger', name: 'Gunslinger', pos: ['QB'], lvl: 2, cost: 4, desc: '+15% throw velocity. Fit balls into tight windows.' },
    { id: 'pinpoint', name: 'Pinpoint', pos: ['QB'], lvl: 3, cost: 5, desc: '-30% throw inaccuracy on all passes.' },
    { id: 'pocketpresence', name: 'Pocket Presence', pos: ['QB'], lvl: 4, cost: 4, desc: 'Pressure warning ring. -40% sack chance when hit.' },
    { id: 'fieldgeneral', name: 'Field General', pos: ['QB'], lvl: 5, cost: 6, desc: 'See defensive coverage and blitzers before the snap.' },
    { id: 'dimes', name: 'Dime Dropper', pos: ['QB'], lvl: 6, cost: 6, desc: 'Deep passes (25+ yds) are 45% more accurate.' },
    { id: 'escape', name: 'Escape Artist', pos: ['QB'], lvl: 5, cost: 5, desc: 'Better throws on the run and break sacks more often.' },
    { id: 'quickdraw', name: 'Quick Draw', pos: ['QB'], lvl: 3, cost: 4, desc: 'Throwing motion is 40% faster.' },
    { id: 'clutch', name: 'Clutch Gene', pos: 'all', lvl: 7, cost: 6, desc: '+Accuracy, catching and tackling in the 4th quarter.' },
    { id: 'surehands', name: 'Sure Hands', pos: ['WR', 'TE', 'RB'], lvl: 2, cost: 4, desc: 'Catch skill-check timing window is 35% larger.' },
    { id: 'deepthreat', name: 'Deep Threat', pos: ['WR', 'TE'], lvl: 4, cost: 5, desc: '+6% top speed after 10 yards downfield.' },
    { id: 'routetech', name: 'Route Technician', pos: ['WR', 'TE', 'RB'], lvl: 3, cost: 5, desc: 'Defenders lose a step at your route breaks.' },
    { id: 'leap', name: 'Leap of Faith', pos: ['WR', 'TE'], lvl: 5, cost: 5, desc: '+30% catch radius and big contested-catch bonus.' },
    { id: 'yac', name: 'YAC Monster', pos: ['WR', 'TE', 'RB'], lvl: 4, cost: 5, desc: 'Break more tackles after the catch.' },
    { id: 'jukebox', name: 'Juke Box', pos: ['RB', 'WR', 'QB'], lvl: 3, cost: 4, desc: 'Juke cooldown halved and jukes are deadlier.' },
    { id: 'bruiser', name: 'Bruiser', pos: ['RB', 'TE'], lvl: 3, cost: 4, desc: 'Stiff arms flatten defenders. +Break tackle.' },
    { id: 'secondwind', name: 'Second Wind', pos: 'all', lvl: 2, cost: 3, desc: 'Sprint stamina drains 40% slower.' },
    { id: 'balanced', name: 'Ball Security', pos: ['RB', 'WR', 'TE', 'QB'], lvl: 2, cost: 3, desc: 'Fumble chance cut by 60%.' },
    { id: 'lockdown', name: 'Lockdown', pos: ['CB', 'S', 'LB'], lvl: 3, cost: 5, desc: 'Stick tighter in man coverage.' },
    { id: 'ballhawk', name: 'Ballhawk', pos: ['CB', 'S', 'LB'], lvl: 4, cost: 5, desc: 'Interception skill-check window 35% larger, +INT chance.' },
    { id: 'enforcer', name: 'Enforcer', pos: ['LB', 'S', 'CB'], lvl: 3, cost: 4, desc: 'Big hits force more fumbles. +Tackling.' },
    { id: 'closer', name: 'Closer', pos: ['LB', 'S', 'CB'], lvl: 2, cost: 4, desc: '+5% speed when pursuing the ball carrier.' },
    { id: 'blitzer', name: 'Edge Threat', pos: ['LB', 'S'], lvl: 4, cost: 4, desc: 'Shed blocks faster when rushing the passer.' },
    { id: 'ironman', name: 'Iron Man', pos: 'all', lvl: 3, cost: 4, desc: 'Injury chance cut in half; injuries heal faster.' },
    { id: 'leader', name: 'Team Leader', pos: 'all', lvl: 6, cost: 5, desc: 'Teammates play better. Chemistry grows faster.' },
    { id: 'showtime', name: 'Showtime', pos: 'all', lvl: 2, cost: 3, desc: 'Gain 50% more fans from big plays.' },
    { id: 'filmjunkie', name: 'Film Junkie', pos: 'all', lvl: 1, cost: 3, desc: '+15% XP from all sources.' },
  ];
  D.perk = (id) => D.PERKS.find((p) => p.id === id);
  D.PERK_SLOTS = (lvl) => (lvl >= 15 ? 4 : lvl >= 8 ? 3 : lvl >= 3 ? 2 : 1);

  // ---------- Shop / Equipment ----------
  D.SHOP = [
    // performance gear: slot, attr bonuses
    { id: 'cleats1', slot: 'cleats', name: 'Velocity Cleats', price: 60000, bonus: { spd: 1, acc: 1 }, desc: '+1 SPD, +1 ACC' },
    { id: 'cleats2', slot: 'cleats', name: 'Hyperdrive Cleats', price: 250000, bonus: { spd: 2, acc: 2, agi: 1 }, desc: '+2 SPD, +2 ACC, +1 AGI' },
    { id: 'cleats3', slot: 'cleats', name: 'Lightning Spikes', price: 900000, bonus: { spd: 3, acc: 3, agi: 2 }, desc: '+3 SPD, +3 ACC, +2 AGI' },
    { id: 'gloves1', slot: 'gloves', name: 'Grip Gloves', price: 50000, bonus: { cth: 1, cit: 1 }, desc: '+1 CTH, +1 CIT' },
    { id: 'gloves2', slot: 'gloves', name: 'Sticky Gloves', price: 220000, bonus: { cth: 2, cit: 2, car: 1 }, desc: '+2 CTH, +2 CIT, +1 CAR' },
    { id: 'gloves3', slot: 'gloves', name: 'Velcro Pro Gloves', price: 800000, bonus: { cth: 3, cit: 3, car: 2 }, desc: '+3 CTH, +3 CIT, +2 CAR' },
    { id: 'wrist1', slot: 'wrist', name: 'Playcall Wristband', price: 70000, bonus: { awr: 1, tas: 1 }, desc: '+1 AWR, +1 SHORT ACC' },
    { id: 'wrist2', slot: 'wrist', name: 'Pro Wrist Coach', price: 300000, bonus: { awr: 2, tas: 1, tam: 1, zcv: 1 }, desc: '+2 AWR, +1 ACC, +1 ZONE' },
    { id: 'pads1', slot: 'pads', name: 'Lightweight Pads', price: 80000, bonus: { agi: 1, inj: 1 }, desc: '+1 AGI, +1 TGH' },
    { id: 'pads2', slot: 'pads', name: 'Carbon Shell Pads', price: 350000, bonus: { agi: 1, inj: 3, str: 1 }, desc: '+1 AGI, +3 TGH, +1 STR' },
    { id: 'helmet1', slot: 'helmet', name: 'Impact Helmet', price: 120000, bonus: { inj: 2 }, desc: '+2 TGH' },
    { id: 'helmet2', slot: 'helmet', name: 'Visionary Helmet', price: 500000, bonus: { inj: 3, awr: 2, prc: 2 }, desc: '+3 TGH, +2 AWR, +2 PRC' },
  ];
  D.LIFESTYLE = [
    { id: 'house', name: 'Housing', tiers: [
      { name: 'Studio Apartment', price: 0, fans: 0, morale: 0 },
      { name: 'Downtown Condo', price: 400000, fans: 500, morale: 4 },
      { name: 'Suburban House', price: 1500000, fans: 2000, morale: 8 },
      { name: 'Hillside Mansion', price: 6000000, fans: 8000, morale: 12 },
    ] },
    { id: 'car', name: 'Ride', tiers: [
      { name: 'Used Sedan', price: 0, fans: 0, morale: 0 },
      { name: 'Pickup Truck', price: 60000, fans: 200, morale: 2 },
      { name: 'Sports Coupe', price: 250000, fans: 1500, morale: 5 },
      { name: 'Hypercar', price: 2500000, fans: 6000, morale: 8 },
    ] },
  ];
  D.STAFF = [
    { id: 'trainer', name: 'Personal Trainer', weekly: 15000, desc: '+25% XP from training sessions.' },
    { id: 'chef', name: 'Private Chef', weekly: 8000, desc: 'Recover 50% more energy each week.' },
    { id: 'physio', name: 'Physiotherapist', weekly: 12000, desc: 'Injuries heal 1 extra week faster; -25% injury chance.' },
    { id: 'agent', name: 'Super Agent', weekly: 10000, desc: '+10% on every contract offer and endorsement.' },
    { id: 'pr', name: 'PR Manager', weekly: 6000, desc: '+30% fan growth and better media outcomes.' },
  ];

  // ---------- Appearance ----------
  D.SKIN = ['#f6d3b5', '#e8b98f', '#c98e5f', '#a86b3c', '#7b4a26', '#4f2f19'];
  D.HAIR_STYLES = ['None', 'Short', 'Flow', 'Dreads', 'Braids', 'Mullet'];
  D.HAIR_COLORS = ['#1a1a1a', '#4a2f1b', '#8b5a2b', '#d9b45a', '#c0502a', '#e8e8e8', '#3d6ed8', '#d23aa0'];
  D.FACIAL = ['None', 'Stubble', 'Beard', 'Goatee', 'Mustache'];
  D.VISORS = [
    { id: 'none', name: 'None', color: null },
    { id: 'clear', name: 'Clear', color: '#bfe6ff' },
    { id: 'smoke', name: 'Smoke', color: '#333a44' },
    { id: 'gold', name: 'Gold Iridium', color: '#e6b422' },
    { id: 'blue', name: 'Blue Iridium', color: '#2e7bff' },
    { id: 'red', name: 'Red Iridium', color: '#ff3b3b' },
    { id: 'rainbow', name: 'Rainbow', color: '#c050ff' },
  ];
  D.GEAR_COLORS = [
    { id: 'team', name: 'Team', color: null },
    { id: 'white', name: 'White', color: '#f2f2f2' },
    { id: 'black', name: 'Black', color: '#1a1a1a' },
    { id: 'red', name: 'Red', color: '#e03030' },
    { id: 'gold', name: 'Gold', color: '#e6b422' },
    { id: 'neon', name: 'Neon', color: '#7dff3a' },
    { id: 'pink', name: 'Pink', color: '#ff5fb0' },
    { id: 'blue', name: 'Blue', color: '#3a7bff' },
  ];
  D.SLEEVES = ['None', 'Left', 'Right', 'Both'];
  D.EYEBLACK = ['None', 'Stripes', 'Stickers'];
  D.CELEBRATIONS = [
    { id: 'spike', name: 'Spike', lvl: 1, price: 0 },
    { id: 'flex', name: 'Flex', lvl: 1, price: 0 },
    { id: 'shimmy', name: 'Shimmy', lvl: 3, price: 0 },
    { id: 'bow', name: 'Take a Bow', lvl: 5, price: 0 },
    { id: 'salute', name: 'Salute', lvl: 7, price: 0 },
    { id: 'jump', name: 'Leap', lvl: 1, price: 25000 },
    { id: 'spin', name: 'Spin Cycle', lvl: 1, price: 50000 },
    { id: 'robot', name: 'The Robot', lvl: 1, price: 100000 },
    { id: 'worm', name: 'The Worm', lvl: 10, price: 150000 },
  ];
  D.NICKNAMES = ['', 'The Flash', 'Air', 'Hands', 'Prime Time', 'Showtime', 'The Hammer', 'Iceman', 'Beast Mode',
    'The Gunslinger', 'Megatron Jr', 'Smooth', 'The Bus', 'Dime', 'Juice', 'Sweetness', 'Night Train', 'The Wall',
    'Lockdown', 'Ballhawk', 'Hurricane', 'Freight Train', 'Silk', 'Jet', 'Rocket', 'Mr. Clutch'];

  // ---------- Endorsements ----------
  D.BRANDS = [
    { name: 'Zoomade Sports Drink', cat: 'Drink' }, { name: 'Gridline Apparel', cat: 'Apparel' },
    { name: 'PixelPhone', cat: 'Tech' }, { name: 'Crunch Cereal', cat: 'Food' }, { name: 'Torque Trucks', cat: 'Auto' },
    { name: 'Swoosh-Free Sneakers', cat: 'Shoes' }, { name: 'Bolt Energy', cat: 'Drink' }, { name: 'Hometown Pizza', cat: 'Food' },
    { name: 'Gamerzone Consoles', cat: 'Tech' }, { name: 'Ironclad Insurance', cat: 'Finance' }, { name: 'Peak Protein', cat: 'Food' },
    { name: 'Velvet Razors', cat: 'Grooming' }, { name: 'NorthStar Bank', cat: 'Finance' }, { name: 'Turbo Tires', cat: 'Auto' },
  ];

  // ---------- Media / life events ----------
  // effects keys: fans, trust (coach), chem (teammates), morale, money, xp, energy
  D.EVENTS = [
    { title: 'Postgame Presser', text: 'A reporter asks about your performance against your next opponent\'s secondary.',
      opts: [
        { t: '"They\'re good. We respect everybody."', fx: { trust: 3, fans: 100 } },
        { t: '"They can\'t guard me. Write that down."', fx: { fans: 900, trust: -4, morale: 3 } },
        { t: '"No comment."', fx: { fans: -50 } },
      ] },
    { title: 'Teammate Cookout', text: 'The veterans invite you to a weekend cookout.',
      opts: [
        { t: 'Bring the grill and the playlist', fx: { chem: 6, energy: -5, money: -2000 } },
        { t: 'Stop by for an hour', fx: { chem: 3 } },
        { t: 'Skip it to study film', fx: { xp: 120, chem: -3 } },
      ] },
    { title: 'Charity Request', text: 'A local children\'s hospital asks you to visit and sign autographs.',
      opts: [
        { t: 'Visit and donate $25K', fx: { fans: 1500, money: -25000, morale: 5, legacy: 2 } },
        { t: 'Make a quick appearance', fx: { fans: 500, morale: 2 } },
        { t: 'Politely decline', fx: { fans: -200 } },
      ] },
    { title: 'Viral Moment', text: 'A clip of you dancing at practice is blowing up online.',
      opts: [
        { t: 'Lean in and post a sequel', fx: { fans: 2500, trust: -2 } },
        { t: 'Laugh it off', fx: { fans: 800 } },
        { t: 'Ask the team to remove it', fx: { trust: 2, fans: -100 } },
      ] },
    { title: 'Coach\'s Office', text: 'The head coach calls you in to talk about your role.',
      opts: [
        { t: '"Whatever the team needs, coach."', fx: { trust: 6 } },
        { t: '"I want the ball more."', fx: { trust: -3, morale: 3, focus: 1 } },
        { t: '"Can I stay late for extra reps?"', fx: { trust: 4, xp: 80, energy: -10 } },
      ] },
    { title: 'Rival Trash Talk', text: 'Your next opponent\'s star called you "overrated" on a podcast.',
      opts: [
        { t: 'Fire back on social media', fx: { fans: 1200, morale: 4, trust: -2 } },
        { t: '"I\'ll answer on the field."', fx: { trust: 3, morale: 2, fans: 300 } },
        { t: 'Ignore it completely', fx: {} },
      ] },
    { title: 'Late Night Out', text: 'Some friends want to hit the clubs downtown two nights before the game.',
      opts: [
        { t: 'Go out', fx: { fans: 400, energy: -25, trust: -4, morale: 4 } },
        { t: 'One drink and home', fx: { energy: -5, morale: 2 } },
        { t: 'Stay in and recover', fx: { energy: 10 } },
      ] },
    { title: 'Mentor Opportunity', text: 'A legendary retired player offers private lessons.',
      opts: [
        { t: 'Pay $40K for a week of lessons', fx: { xp: 400, money: -40000 } },
        { t: 'Ask for a free session', fx: { xp: 120 } },
        { t: 'Decline', fx: {} },
      ] },
    { title: 'Video Game Cover Vote', text: 'Fans can vote for you as the cover athlete of a new football game.',
      opts: [
        { t: 'Campaign hard online', fx: { fans: 2000, energy: -10 } },
        { t: 'Thank the fans', fx: { fans: 600 } },
      ] },
    { title: 'Locker Room Tension', text: 'Two teammates are arguing about playing time. They look to you.',
      opts: [
        { t: 'Step in and mediate', fx: { chem: 6, trust: 3, energy: -5 } },
        { t: 'Stay out of it', fx: { chem: -2 } },
        { t: 'Tell the coach', fx: { trust: 3, chem: -4 } },
      ] },
    { title: 'Sneaker Collab', text: 'A designer wants to make a limited sneaker with your number.',
      opts: [
        { t: 'Sign on ($60K + royalties)', fx: { money: 60000, fans: 1000, energy: -5 } },
        { t: 'Not right now', fx: {} },
      ] },
    { title: 'Weather Report', text: 'A nasty storm is forecast for practice. The coach makes it optional.',
      opts: [
        { t: 'Practice in the storm', fx: { xp: 150, trust: 4, energy: -10 } },
        { t: 'Indoor film session', fx: { xp: 80 } },
        { t: 'Take the day off', fx: { energy: 15, trust: -2 } },
      ] },
  ];

  D.INJURIES = [
    { name: 'Bruised Ribs', min: 1, max: 2 }, { name: 'Sprained Ankle', min: 1, max: 4 }, { name: 'Hamstring Strain', min: 2, max: 5 },
    { name: 'Concussion', min: 1, max: 3 }, { name: 'Shoulder Sprain', min: 2, max: 5 }, { name: 'High Ankle Sprain', min: 3, max: 7 },
    { name: 'Knee Sprain', min: 2, max: 6 }, { name: 'Broken Hand', min: 3, max: 6 }, { name: 'Turf Toe', min: 1, max: 4 },
    { name: 'Torn ACL', min: 12, max: 20, rare: true }, { name: 'Broken Collarbone', min: 6, max: 10, rare: true },
  ];

  D.DIFFICULTY = [
    { id: 'rookie', name: 'Rookie', ai: -10, err: 0.6, win: 1.5, tackle: 0.75, xp: 0.8 },
    { id: 'pro', name: 'Pro', ai: -3, err: 0.85, win: 1.2, tackle: 0.9, xp: 1.0 },
    { id: 'allpro', name: 'All-Pro', ai: 2, err: 1.0, win: 1.0, tackle: 1.0, xp: 1.2 },
    { id: 'legend', name: 'Legend', ai: 7, err: 1.2, win: 0.8, tackle: 1.12, xp: 1.45 },
  ];

  D.SALARY_CAP = 255e6;
  D.MIN_SALARY = 0.84e6;
  D.POS_SAL = { QB: 1.0, WR: 0.55, DE: 0.55, OT: 0.48, CB: 0.45, DT: 0.45, LB: 0.36, S: 0.34, TE: 0.34, OG: 0.32, C: 0.3, RB: 0.28, K: 0.12, P: 0.1 };

  D.ROUND_NAMES = ['Wild Card', 'Divisional', 'Conference Final', 'Championship'];
  D.CHAMP_NAME = 'Gridiron Bowl';

  PG.D = D;
})();
