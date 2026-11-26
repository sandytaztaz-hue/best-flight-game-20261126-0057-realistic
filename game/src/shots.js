/* REAL FALCON: deterministic staged screenshot scenes (?shot=1..4).
   Each one builds a real game state (real sortie / real hangar) and lets the
   normal renderer paint it — no standalone images, no compositing. */
(function () {
  'use strict';
  var CFG = window.RF_CONFIG;

  function seedRand(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  function stage(n, game) {
    var rnd = seedRand(7);
    var savedRandom = Math.random;
    Math.random = rnd;
    try {
      if (n === '1') stageCockpit(game);
      else if (n === '2') stageSunset(game);
      else if (n === '3') stageSea(game);
      else if (n === '4') stageHangar(game);
      else game.screen = 'title';
    } finally {
      Math.random = savedRandom;
    }
  }

  function baseSortie(game, missionId) {
    var run = window.RF_RUN;
    run.stats.credits = 2450;
    run.stats.unlocked = 6;
    run.stats.upgrades = { rack: 2, flares: 1, armor: 2, engine: 1, radar: 1, tank: 1, cannon: 2 };
    run.stats.missilesMax = 10; run.stats.flaresMax = 10; run.stats.hullMax = 180;
    run.stats.fuelMax = 135; run.stats.gunDmg = 24; run.stats.speedMul = 1.18; run.stats.lockMul = 1.4;
    run.stats.best = { 1: 'S', 2: 'A', 3: 'A', 4: 'B', 5: 'A' };
    run.kills = 17; run.totalScore = 3840;
    run.missionResults = [
      { id: 1, grade: 'S', score: 520, kills: 3, time: 132, accuracy: 82 },
      { id: 2, grade: 'A', score: 610, kills: 6, time: 171, accuracy: 74 },
      { id: 3, grade: 'A', score: 640, kills: 5, time: 198, accuracy: 71 },
      { id: 4, grade: 'B', score: 430, kills: 4, time: 226, accuracy: 66 },
      { id: 5, grade: 'A', score: 590, kills: 4, time: 219, accuracy: 70 }
    ];
    var m = CFG.MISSIONS[missionId - 1];
    game.briefingMission = m;
    var sortie = window.RF_WORLD.newSortie(run, m);
    sortie.time = 96;
    sortie.routeProgress = 0.62;
    sortie.fuel = 78; sortie.hull = 148;
    sortie.missileCount = 7; sortie.flares = 8;
    sortie.score = 420; sortie.kills = 3;
    sortie.throttle = 0.78;
    game.sortie = sortie;
    game.screen = 'flight';
    return sortie;
  }

  // 1-cockpit: cockpit view mid-dogfight, an enemy exploding dead ahead.
  function stageCockpit(game) {
    var sortie = baseSortie(game, 2);
    sortie.camera = 'cockpit';
    var t = sortie.enemies[0];
    t.x = 640; t.y = 200;
    sortie.target = t;
    sortie.lock = 1;
    sortie.explosions.push({ x: 640, y: 200, t: 0.35, dur: 1.4, size: 260, big: false });
    sortie.explosions.push({ x: 760, y: 260, t: 0.1, dur: 1.2, size: 150, big: false });
    var t2 = sortie.enemies[1];
    t2.x = 900; t2.y = 150;
    sortie.radio = 'ROOK: "Bandit down! I have your six, Falcon-1 — keep turning!"';
    sortie.radioT = 0;
    sortie.lastKill = 'MISSILE KILL — ENEMY +200';
    sortie.lastKillT = 0;
  }

  // 2-sunset: chase view at sunset, attacking a cargo plane over the strait.
  function stageSunset(game) {
    var sortie = baseSortie(game, 1);
    sortie.camera = 'chase';
    sortie.playerX = 560; sortie.playerY = 500;
    var cargo = sortie.enemies[0];
    cargo.x = 640; cargo.y = 300;
    sortie.target = cargo;
    sortie.lock = 0.85;
    sortie.missiles.push({
      x: 600, y: 430, vx: 2, vy: -8, target: cargo, life: 3,
      trail: [{ x: 560, y: 500 }, { x: 575, y: 470 }, { x: 590, y: 448 }]
    });
    var c2 = sortie.enemies[1];
    c2.x = 980; c2.y = 220;
    var c3 = sortie.enemies[2];
    c3.x = 300; c3.y = 180;
    sortie.radio = 'VEGA: "Three cargo birds in the strait, Falcon-1. Do not let them cross the line."';
    sortie.radioT = 0;
    sortie.boosting = true;
  }

  // 3-sea: combat HUD, red lock brackets, a missile in flight over the sea, ships below.
  // The fleet sprite sits at the bottom of the frame; one escort burns.
  function stageSea(game) {
    var sortie = baseSortie(game, 3);
    sortie.camera = 'chase';
    sortie.playerX = 600; sortie.playerY = 470;
    var t = sortie.enemies[0];
    t.x = 660; t.y = 260;
    sortie.target = t;
    sortie.lock = 1;
    sortie.missiles.push({
      x: 640, y: 400, vx: 1, vy: -9, target: t, life: 3.5,
      trail: [{ x: 600, y: 470 }, { x: 615, y: 440 }, { x: 628, y: 420 }]
    });
    var t2 = sortie.enemies[1];
    t2.x = 950; t2.y = 180;
    var t3 = sortie.enemies[2];
    t3.x = 340; t3.y = 210;
    sortie.explosions.push({ x: 1120, y: 600, t: 0.5, dur: 2.0, size: 240, big: true });
    sortie.radio = 'MARA (TOWER): "Missile away, Falcon-1. Fleet is holding — keep the shield up."';
    sortie.radioT = 0;
    sortie.warning = 'MISSILE BOAT FIRING ON THE ESCORT';
    sortie.warningT = 0;
  }

  // 4-hangar: home/hangar screen with jet, loadout cards, crew, 3 save slots.
  function stageHangar(game) {
    var run = window.RF_RUN;
    run.stats.credits = 2450;
    run.stats.unlocked = 6;
    run.stats.upgrades = { rack: 2, flares: 1, armor: 2, engine: 1, radar: 1, tank: 1, cannon: 2 };
    run.stats.missilesMax = 10; run.stats.flaresMax = 10; run.stats.hullMax = 180;
    run.stats.fuelMax = 135; run.stats.gunDmg = 24; run.stats.speedMul = 1.18; run.stats.lockMul = 1.4;
    run.stats.best = { 1: 'S', 2: 'A', 3: 'A', 4: 'B', 5: 'A' };
    run.kills = 17; run.totalScore = 3840;
    game.saves = [
      { stats: JSON.parse(JSON.stringify(run.stats)), kills: 17, totalScore: 3840, sortiesFlown: 5, missionResults: [] },
      { stats: (function () { var s = CFG.baseStats(); s.unlocked = 3; s.credits = 900; s.best = { 1: 'A', 2: 'B' }; return s; })(), kills: 9, totalScore: 1420, sortiesFlown: 2, missionResults: [] },
      null
    ];
    game.screen = 'hangar';
  }

  window.RF_SHOTS = { stage: stage };
})();
