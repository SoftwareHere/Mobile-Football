# Pixel Gridiron: Career Mode

A retro, pixel-art American football **career** game built for phones. You create one player, get drafted, fight for snaps on the depth chart, and try to play your way into the Hall of Fame. It's an original game in the chunky 8-bit style of arcade football titles. It doesn't use any real league, team or player names.

It runs entirely in the browser (HTML5 canvas + vanilla JS, no build step, no dependencies) and installs to the home screen as a full-screen, landscape PWA that works offline.

## Play it

```bash
# any static web server works
python3 -m http.server 8000
# then open http://localhost:8000 on your phone (same Wi-Fi) or desktop
```

On a phone, use **Add to Home Screen** to get the full-screen landscape app. Desktop works too: WASD/arrows move, mouse-drag on the right half throws, Space taps, J/K/L = juke/stiff-arm/dive, P pauses.

## Controls

| Situation | Left thumb | Right side of the screen |
|---|---|---|
| **QB** | Floating joystick: drop back, slide in the pocket, scramble | **Open drag plane**: touch anywhere, pull back like a slingshot and release. Drag length is distance. A dotted arc and landing ring preview the throw. Double-tap throws it away. You can switch to "drag toward target" in Settings. |
| **WR / TE / RB route** | Run your route (shown in yellow before the snap) | **Tap plane**: tap to call for the ball. Running a clean route earns the AI QB's trust. |
| **Ball in the air to you** | Get under the landing marker | **Catch skill check**: a ring shrinks onto a green circle. Tap when they meet: PERFECT +25%, GREAT +15%, GOOD +7% catch chance; mistimed taps cost 5%. Your base catch % is shown live. |
| **Ball carrier** | Run (full tilt = sprint, watch stamina) | Tap = juke, swipe forward = stiff arm, swipe back = spin, swipe up/down = directional juke, double-tap = dive |
| **Defense (LB/CB/S)** | Cover your man/zone, pursue | Tap = burst / dive tackle. Passes thrown near you trigger an **interception skill check**. Mash tap to shed blocks. |

Optional **auto-pilot** runs your route or coverage until you touch the joystick. Slow-motion catches, route previews and kick animations can each be turned on or off.

## Career mode features

- **Player creation**: 7 positions (QB, RB, WR, TE, LB, CB, S) with 3–5 archetypes each. Set height and weight (they change your ratings), college, hometown and jersey number. Appearance options: skin, hair style and color, facial hair, visor tint, eye black, arm sleeves, gloves, cleats, and throwing hand. The live pixel preview updates as you go.
- **Combine and draft**: 40-yard dash, bench, vertical, cones, plus a playable position drill that moves your draft stock. Draft-night ticker and rookie-scale contract.
- **Depth chart battles**: "Earn it" mode puts you in a camp battle. Win the job with the camp drill, your overall and coach trust. You can also choose guaranteed-starter mode.
- **Progression**: XP from games, goals, training and events. Levels give skill points to spend on 37 attributes, with costs that rise as ratings climb. There are 26 unlockable perks (Gunslinger, Pinpoint, Sure Hands, Juke Box, Ballhawk, Lockdown, Iron Man…) and more perk slots as you level. Physical decline sets in after 30.
- **Weekly life**: 3 actions per week (position drills or a playable drill minigame, speed, weight room, film study, team bonding, media tour, recovery). Energy and fatigue, random media and locker-room events with choices, coach trust, team chemistry, morale and fans.
- **Money**: weekly salary, signing bonuses, agent fee, and endorsement offers that scale with your fame. Spend it on performance gear (stat boosts), houses and cars, staff (personal trainer, chef, physio, super agent, PR), celebrations and jersey numbers.
- **Contracts**: market value, extension talks, counter-offers that can make teams walk away, free agency with competing offers (role, team strength, money), and trade requests.
- **Full league**: 32 fictional teams in 2 conferences and 8 divisions, about 1,500 rated players with contracts and a salary cap. Head coaches have offensive and defensive schemes. Schedules, standings and tiebreakers, a 14-team playoff and the Gridiron Bowl.
- **Simulation**: every other game is simulated play-by-play with full box scores, so league leaders, records, injuries and news are all real.
- **Awards and legacy**: MVP, OPOY/DPOY, Rookies of the Year, All-League, All-Star, championship MVP, single-game, single-season and career records, milestones, a legacy score and Hall of Fame induction.
- **Offseason**: awards ceremony, aging and progression, retirements, AI re-signings, a 7-round draft, free agency, cap cuts and training camp, then the next season.

## Gameplay engine

- Top-down 3/4 view: a low-resolution canvas scaled up with crisp nearest-neighbor pixels, with procedural sprites in team colors and your customization.
- **43 offensive plays** across 8 formations (Shotgun Doubles/Trips/Empty, Pistol, Singleback, Ace, I-Form, Goal Line). There are 24 route types, run plays (inside/outside zone, power, counter, toss, draw, iso, sneak, QB draw), play action, bootlegs and screens.
- **10 defensive calls** (Cover 0/1/2/3/4, 2-Man, Tampa 2, fire-zone and LB blitzes, prevent) with base/nickel/dime/goal-line personnel.
- AI includes QB progression reads, man coverage with reaction lag and route-break separation, zone drops, press at the line, OL/DL block engagement and sheds, pursuit angles, gang tackles, broken tackles, fumbles, interceptions and pass interference.
- Game management covers downs, game clock with runoff and hurry-up/milk-clock tempo, timeouts, kneel and spike, two-minute warning, 4th-down decisions, field goals, PAT or 2-point tries, punts, kickoffs, safeties and overtime.
- Weather and stadiums: domes, rain, snow, wind (affects throws and kicks) and primetime night games.
- Synthesized retro sound (whistles, hits, crowd, touchdown fanfare) and a chiptune menu theme.

## Project layout

```
index.html            entry point (loads the scripts below in order)
css/style.css         retro UI styles
js/util.js            helpers, DOM builder
js/data.js            teams, names, positions, attributes, archetypes, perks, shop, events
js/player.js          player generation, overall ratings, value, progression
js/league.js          league creation, rosters, depth charts, schedule, standings, records
js/sim.js             GameState (downs/clock/scoring) + play-by-play simulator
js/season.js          weeks, injuries, playoffs, awards, offseason, draft, free agency
js/career.js          the user's career: XP, training, money, contracts, goals, saves
js/plays.js           formations, route tree, playbook, defensive calls, personnel
js/engine.js          on-field engine: physics, AI, throwing, catching skill check, tackling, rendering
js/match.js           match controller: play calling, drive sims, kicks, pause menu
js/drills.js          practice minigames (target practice, catch gauntlet)
js/ui.js              menus, creator, hub and every career screen
js/font.js            5x7 bitmap font for the canvas
js/sprites.js         procedural pixel sprites
js/field.js           pre-rendered stadium/field
js/input.js           touch / mouse / keyboard controls
js/audio.js           WebAudio sound effects and music
tests/                headless Node tests for the league/sim/career layers
```

## Tests

```bash
node tests/sim-test.js 15     # simulate a full 32-team season + offseason at 15-minute quarters
node tests/career-test.js     # create careers at every position and run the draft
```

## Credits

Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) and [VT323](https://fonts.google.com/specimen/VT323), both under the SIL Open Font License (see `assets/fonts/`).
