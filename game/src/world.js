/* REAL FALCON: world state — sorties, enemies, missiles, explosions, saves.
   No drawing here; render.js paints what this module tracks. */
(function () {
  'use strict';
  var CFG = window.RF_CONFIG;

  var SAVE_KEY = 'real-falcon-saves-v1';

  function loadSaves() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return [null, null, null];
      var arr = JSON.parse(raw);
      while (arr.length < 3) arr.push(null);
      return arr.slice(0, 3);
    } catch (e) { return [null, null, null]; }
  }

  function storeSaves(saves) {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch (e) { /* saves are a bonus */ }
  }

  function freshRun() {
    return {
      stats: CFG.baseStats(),
      kills: 0, shotsFired: 0, shotsHit: 0,
      missionResults: [], // {id, grade, score, kills, time, accuracy}
      totalScore: 0, sortiesFlown: 0
    };
  }

  function newSortie(run, mission) {
    var s = run.stats;
    var sortie = {
      mission: mission,
      time: 0, kills: 0, shots: 0, hits: 0,
      fuel: s.fuelMax, hull: s.hullMax,
      missileCount: s.missilesMax, flares: s.flaresMax,
      lock: 0, target: null, over: false, won: false,
      enemies: [], missiles: [], explosions: [], tracers: [],
      playerX: 640, playerY: 470, playerVX: 0, playerVY: 0,
      throttle: 0.62, boosting: false, camera: 'chase',
      rain: [], lightning: 0, flashT: 0, flaresLit: [],
      radioLine: 0, radioT: 0, warning: '',
      routeProgress: 0, score: 0
    };
    // Spawn the mission's enemies in a loose formation ahead.
    var idx = 0;
    mission.enemies.forEach(function (group) {
      for (var i = 0; i < group.n; i++) {
        idx++;
        sortie.enemies.push(makeEnemy(group.kind, idx, mission));
      }
    });
    // Fleet screen for mission 3: friendly ships that must survive.
    if (mission.id === 3) {
      sortie.fleet = [
        { name: 'KESTREL (CARRIER)', hp: 300, max: 300, x: 640, y: 640, alive: true },
        { name: 'DDG-71 ESCORT', hp: 160, max: 160, x: 380, y: 660, alive: true },
        { name: 'DDG-72 ESCORT', hp: 160, max: 160, x: 900, y: 660, alive: true }
      ];
    }
    // Rain drops for the storm mission.
    if (mission.weather === 'storm') {
      for (var r = 0; r < 90; r++) {
        sortie.rain.push({ x: Math.random() * 1280, y: Math.random() * 720, sp: 9 + Math.random() * 8 });
      }
    }
    return sortie;
  }

  function makeEnemy(kind, idx, mission) {
    var base = {
      id: idx, kind: kind, hp: 60, max: 60,
      x: 220 + ((idx * 173) % 840), y: 120 + ((idx * 97) % 190),
      vx: 0, vy: 0, t: Math.random() * 6.28, alive: true,
      flareCd: 4 + Math.random() * 4, shootCd: 2 + Math.random() * 3,
      dodging: 0, taunt: ''
    };
    if (kind === 'cargo') { base.hp = base.max = 60; base.speed = 0.55; base.score = 150; base.size = 150; }
    if (kind === 'enemy') { base.hp = base.max = 45; base.speed = 1.5; base.score = 200; base.size = 120; }
    if (kind === 'boat')  { base.hp = base.max = 80; base.speed = 0.25; base.score = 250; base.size = 170; base.y = 600; }
    if (kind === 'depot') { base.hp = base.max = 90; base.speed = 0; base.score = 300; base.size = 150; base.y = 590; }
    if (kind === 'ghost') {
      base.hp = base.max = 220; base.speed = 2.3; base.score = 1500; base.size = 130;
      base.x = 640; base.y = 150; base.taunts = [
        'GHOST: "Eleven fell. You are twelve."',
        'GHOST: "Your lock is slow, little Falcon."',
        'GHOST: "The fog hides me. It hides nothing from me."',
        'GHOST: "Is that the best the Kestrel can send?"'
      ];
    }
    return base;
  }

  function nearestEnemy(sortie, x, y) {
    var best = null, bd = 1e9;
    sortie.enemies.forEach(function (e) {
      if (!e.alive) return;
      var d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }

  function fireMissile(sortie) {
    if (sortie.missileCount <= 0 || !sortie.target || !sortie.target.alive) return false;
    sortie.missileCount--;
    sortie.missilesFired = (sortie.missilesFired || 0) + 1;
    sortie.missiles.push({
      x: sortie.playerX, y: sortie.playerY - 30,
      vx: 0, vy: -7, target: sortie.target, life: 4.5, trail: []
    });
    return true;
  }

  function fireCannon(sortie) {
    sortie.shots++;
    var t = sortie.target;
    if (t && t.alive) {
      var d = Math.hypot(t.x - sortie.playerX, t.y - sortie.playerY);
      if (d < 340) {
        t.hp -= window.RF_RUN.stats.gunDmg;
        sortie.hits++;
        if (t.hp <= 0) killEnemy(sortie, t, 'GUN KILL');
      }
    }
    sortie.tracers.push({ x: sortie.playerX, y: sortie.playerY - 40, life: 0.18 });
  }

  function killEnemy(sortie, e, how) {
    if (!e.alive) return;
    e.alive = false;
    sortie.kills++;
    sortie.score += e.score;
    sortie.explosions.push({
      x: e.x, y: e.y, t: 0, dur: 1.4, size: e.size * 1.6, big: e.kind === 'ghost' || e.kind === 'depot'
    });
    sortie.lastKill = how + ' — ' + (e.kind === 'ghost' ? 'GHOST DOWN' : e.kind.toUpperCase()) + ' +' + e.score;
    sortie.lastKillT = 0;
    if (window.RF_AUDIO) window.RF_AUDIO.explosion();
  }

  function dropFlare(sortie) {
    if (sortie.flares <= 0) return false;
    sortie.flares--;
    sortie.flaresLit.push({ x: sortie.playerX, y: sortie.playerY, t: 0 });
    // Flares decoy every missile currently chasing the player.
    sortie.missiles.forEach(function (m) { if (m.chasingPlayer) m.decoyed = true; });
    if (window.RF_AUDIO) window.RF_AUDIO.flare();
    return true;
  }

  // One fixed step of the sortie simulation (dt in seconds).
  function step(sortie, input, dt) {
    if (sortie.over) return;
    sortie.time += dt;
    var run = window.RF_RUN;
    var s = run.stats;

    // --- player movement (steer + throttle + afterburner) ---
    var ax = 0, ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;
    sortie.boosting = !!input.boost && sortie.fuel > 0;
    var speed = (0.9 + sortie.throttle) * 3.4 * s.speedMul * (sortie.boosting ? 1.7 : 1);
    sortie.playerVX += ax * 0.55;
    sortie.playerVY += ay * 0.55;
    sortie.playerVX *= 0.90; sortie.playerVY *= 0.90;
    sortie.playerX += sortie.playerVX + speed * 0.12 * Math.sin(sortie.time * 0.4);
    sortie.playerY += sortie.playerVY;
    sortie.playerX = Math.max(70, Math.min(1210, sortie.playerX));
    sortie.playerY = Math.max(90, Math.min(640, sortie.playerY));

    // --- fuel burn: afterburner drinks the tanks ---
    sortie.fuel -= dt * (sortie.boosting ? 2.6 : 0.55);
    if (sortie.fuel <= 0) { sortie.fuel = 0; endSortie(sortie, false, 'FUEL EXHAUSTED'); return; }

    // --- route progress crawls forward with speed and throttle ---
    sortie.routeProgress = Math.min(1, sortie.routeProgress + dt * 0.012 * (sortie.boosting ? 1.6 : 1));

    // --- pick the nearest live target and build lock when it is centred ---
    var t = nearestEnemy(sortie, sortie.playerX, sortie.playerY);
    sortie.target = t;
    if (t) {
      var centred = Math.abs(t.x - sortie.playerX) < 190 && Math.abs(t.y - (sortie.playerY - 120)) < 170;
      if (centred) {
        sortie.lock = Math.min(1, sortie.lock + dt * 0.55 * s.lockMul);
        if (sortie.lock >= 1 && !sortie.lockToneT) sortie.lockToneT = 0;
      } else {
        sortie.lock = Math.max(0, sortie.lock - dt * 0.8);
      }
    } else { sortie.lock = 0; }

    // --- enemies drift, weave, and shoot back ---
    sortie.enemies.forEach(function (e) {
      if (!e.alive) return;
      e.t += dt;
      if (e.kind === 'ghost') {
        // Ghost dodges hard, dives through the fog, taunts on the radio.
        e.x += Math.sin(e.t * 1.7) * 3.4;
        e.y += Math.cos(e.t * 1.1) * 1.6;
        if (Math.random() < dt * 0.25 && e.taunts) {
          sortie.radio = e.taunts[Math.floor(Math.random() * e.taunts.length)];
          sortie.radioT = 0;
        }
        e.flareCd -= dt;
        if (e.flareCd <= 0) { e.flareCd = 3 + Math.random() * 3; e.dodging = 0.7; sortie.lock = Math.max(0, sortie.lock - 0.6); }
      } else if (e.kind === 'boat' || e.kind === 'depot') {
        e.x += Math.sin(e.t * 0.3) * 0.2; // slow drift on the water / fixed site
      } else {
        e.x += Math.sin(e.t * 0.9 + e.id) * 1.6 * e.speed;
        e.y += Math.cos(e.t * 0.6 + e.id * 2) * 0.9;
        e.x = Math.max(60, Math.min(1220, e.x));
        e.y = Math.max(60, Math.min(560, e.y));
      }
      if (e.dodging > 0) e.dodging -= dt;
      // Enemy fire: a hit costs hull.
      e.shootCd -= dt;
      if (e.shootCd <= 0 && e.kind !== 'boat' && e.kind !== 'depot') {
        e.shootCd = 2.5 + Math.random() * 3;
        var d = Math.hypot(e.x - sortie.playerX, e.y - sortie.playerY);
        if (d < 520 && Math.random() < 0.45) {
          sortie.hull -= e.kind === 'ghost' ? 14 : 7;
          sortie.warning = 'HIT — HULL ' + Math.max(0, Math.round(sortie.hull));
          sortie.warningT = 0;
          if (window.RF_AUDIO) window.RF_AUDIO.hit();
          if (sortie.hull <= 0) { sortie.hull = 0; endSortie(sortie, false, 'SHOT DOWN'); return; }
        }
      }
      // Boats shell the fleet in mission 3.
      if (e.kind === 'boat' && sortie.fleet) {
        e.shootCd -= dt * 0.5;
        if (e.shootCd <= 0) {
          e.shootCd = 5;
          var ship = sortie.fleet[Math.floor(Math.random() * sortie.fleet.length)];
          if (ship && ship.alive) {
            ship.hp -= 22;
            if (ship.hp <= 0) {
              ship.alive = false; ship.hp = 0;
              sortie.explosions.push({ x: ship.x, y: ship.y, t: 0, dur: 2.0, size: 260, big: true });
              sortie.warning = ship.name + ' SUNK';
              sortie.warningT = 0;
            }
          }
        }
      }
    });

    // --- missiles chase their target (or get decoyed by flares) ---
    sortie.missiles.forEach(function (m) {
      m.life -= dt;
      if (m.target && m.target.alive && !m.decoyed) {
        var dx = m.target.x - m.x, dy = m.target.y - m.y;
        var dist = Math.hypot(dx, dy) || 1;
        m.vx += (dx / dist) * 0.9; m.vy += (dy / dist) * 0.9;
        var sp = Math.hypot(m.vx, m.vy);
        if (sp > 11) { m.vx *= 11 / sp; m.vy *= 11 / sp; }
        if (dist < 34) {
          m.life = 0;
          m.target.hp -= 55;
          sortie.hits++;
          if (m.target.hp <= 0) killEnemy(sortie, m.target, 'MISSILE KILL');
          else if (m.target.kind === 'ghost' || m.target.kind === 'enemy') {
            // Survivors sometimes pop flares and break the lock.
            if (Math.random() < 0.4) { m.target.dodging = 0.6; sortie.lock = 0; }
          }
        }
      } else {
        m.vy -= 0.15; // decoyed / lost target: arcs away
      }
      m.x += m.vx; m.y += m.vy;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 22) m.trail.shift();
    });
    sortie.missiles = sortie.missiles.filter(function (m) { return m.life > 0; });

    // --- explosions, tracers, flares, radio timers ---
    sortie.explosions.forEach(function (ex) { ex.t += dt; });
    sortie.explosions = sortie.explosions.filter(function (ex) { return ex.t < ex.dur; });
    sortie.tracers.forEach(function (tr) { tr.life -= dt; });
    sortie.tracers = sortie.tracers.filter(function (tr) { return tr.life > 0; });
    sortie.flaresLit.forEach(function (f) { f.t += dt; });
    sortie.flaresLit = sortie.flaresLit.filter(function (f) { return f.t < 1.2; });
    if (sortie.lastKillT !== undefined) sortie.lastKillT += dt;
    if (sortie.warningT !== undefined) sortie.warningT += dt;
    if (sortie.radioT !== undefined) sortie.radioT += dt;
    if (sortie.mission.weather === 'storm') {
      sortie.rain.forEach(function (r) { r.y += r.sp; r.x -= 2; if (r.y > 720) { r.y = -10; r.x = Math.random() * 1400; } });
      sortie.lightning -= dt;
      if (sortie.lightning <= 0) {
        sortie.lightning = 3 + Math.random() * 5;
        sortie.flashT = 0.22;
      }
      if (sortie.flashT > 0) sortie.flashT -= dt;
    }

    // --- win check: every enemy down (and the fleet alive in mission 3) ---
    var alive = sortie.enemies.filter(function (e) { return e.alive; }).length;
    var fleetOk = true;
    if (sortie.fleet) fleetOk = sortie.fleet.some(function (sh) { return sh.alive; });
    if (alive === 0 && fleetOk) { endSortie(sortie, true, ''); }
    else if (alive === 0 && !fleetOk) { endSortie(sortie, false, 'THE FLEET WAS LOST'); }
  }

  function endSortie(sortie, won, reason) {
    if (sortie.over) return;
    sortie.over = true; sortie.won = won; sortie.failReason = reason;
    var run = window.RF_RUN;
    var acc = sortie.shots > 0 ? Math.round(100 * sortie.hits / sortie.shots) : 100;
    var timeBonus = Math.max(0, Math.round((sortie.mission.par - sortie.time) * 2));
    var hullBonus = Math.round(sortie.hull * 0.5);
    var score = sortie.score + timeBonus + hullBonus;
    var grade = CFG.gradeFor(score, sortie.mission.par, sortie.hull);
    sortie.result = {
      id: sortie.mission.id, grade: grade, score: score,
      kills: sortie.kills, time: Math.round(sortie.time), accuracy: acc,
      hull: Math.round(sortie.hull)
    };
    if (won) {
      run.kills += sortie.kills;
      run.shotsFired += sortie.shots; run.shotsHit += sortie.hits;
      run.totalScore += score;
      run.sortiesFlown++;
      run.missionResults.push(sortie.result);
      var reward = sortie.mission.reward + sortie.kills * 50;
      run.stats.credits += reward;
      sortie.reward = reward;
      if (sortie.mission.id >= run.stats.unlocked && run.stats.unlocked < 6) run.stats.unlocked++;
      run.stats.best[sortie.mission.id] = grade;
    }
    if (window.RF_AUDIO) { if (won) window.RF_AUDIO.win(); window.RF_AUDIO.engineOff(); }
  }

  window.RF_WORLD = {
    loadSaves: loadSaves, storeSaves: storeSaves, freshRun: freshRun,
    newSortie: newSortie, nearestEnemy: nearestEnemy,
    fireMissile: fireMissile, fireCannon: fireCannon, dropFlare: dropFlare,
    step: step, endSortie: endSortie, killEnemy: killEnemy
  };
})();
