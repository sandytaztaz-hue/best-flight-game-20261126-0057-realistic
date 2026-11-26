/* REAL FALCON: main loop, screens, input, save slots, scoring.
   Classic script; runs after config/audio/world/render/shots. */
(function () {
  'use strict';
  var CFG = window.RF_CONFIG;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 1280, H = 720;

  var game = {
    screen: 'loading', // loading | title | hangar | briefing | flight | pause | results | help | over
    saves: window.RF_WORLD.loadSaves(),
    briefingMission: null,
    sortie: null,
    prevScreen: 'title',
    shotMode: null,
    time: 0
  };

  window.RF_RUN = window.RF_WORLD.freshRun();
  window.RF_GAME = game;

  var keys = {};
  var input = { left: false, right: false, up: false, down: false, boost: false };

  function saveRun(slot) {
    var saves = game.saves.slice();
    saves[slot] = JSON.parse(JSON.stringify(window.RF_RUN));
    game.saves = saves;
    window.RF_WORLD.storeSaves(saves);
  }

  function loadRun(slot) {
    var sv = game.saves[slot];
    if (!sv) return false;
    window.RF_RUN = JSON.parse(JSON.stringify(sv));
    return true;
  }

  function buyUpgrade(idx) {
    var u = CFG.UPGRADES[idx];
    if (!u) return;
    var s = window.RF_RUN.stats;
    var lvl = s.upgrades[u.id] || 0;
    if (lvl >= u.max) { window.RF_AUDIO.denied(); return; }
    if (s.credits < u.price) { window.RF_AUDIO.denied(); return; }
    s.credits -= u.price;
    s.upgrades[u.id] = lvl + 1;
    u.apply(s);
    window.RF_AUDIO.buy();
    saveRun(0);
  }

  function startMission(n) {
    var m = CFG.MISSIONS[n - 1];
    if (!m) return;
    if (n > window.RF_RUN.stats.unlocked) return;
    game.briefingMission = m;
    game.screen = 'briefing';
    window.RF_AUDIO.radio();
  }

  function launchSortie() {
    game.sortie = window.RF_WORLD.newSortie(window.RF_RUN, game.briefingMission);
    game.screen = 'flight';
    window.RF_AUDIO.stopTheme();
    window.RF_AUDIO.unlock();
  }

  function nextMission() {
    var cur = game.briefingMission ? game.briefingMission.id : 1;
    if (cur >= 6) { game.screen = 'results'; return; }
    startMission(Math.min(6, cur + 1));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    switch (game.screen) {
      case 'loading':
        ctx.fillStyle = '#0a2038'; ctx.fillRect(0, 0, W, H);
        window.RF_RENDER.text(ctx, 'REAL FALCON — loading photographic assets…', 640, 340, 24, '#eaf4ff', 'center');
        break;
      case 'title': window.RF_RENDER.titleScreen(ctx, game); break;
      case 'hangar': window.RF_RENDER.hangarScreen(ctx, game); break;
      case 'briefing': window.RF_RENDER.briefingScreen(ctx, game); break;
      case 'flight': window.RF_RENDER.flight(ctx, game.sortie); break;
      case 'pause': window.RF_RENDER.pauseScreen(ctx, game.sortie); break;
      case 'results': window.RF_RENDER.resultsScreen(ctx, game); break;
      case 'help': window.RF_RENDER.helpScreen(ctx); break;
      case 'over': window.RF_RENDER.gameOverScreen(ctx, game); break;
    }
  }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    game.time += dt;
    if (game.screen === 'flight' && game.sortie) {
      if (!game.sortie.over) {
        input.left = keys.ArrowLeft || keys.KeyA;
        input.right = keys.ArrowRight || keys.KeyD;
        input.up = keys.ArrowUp || keys.KeyW;
        input.down = keys.ArrowDown || keys.KeyS;
        input.boost = keys.ShiftLeft || keys.ShiftRight;
        window.RF_WORLD.step(game.sortie, input, dt);
        window.RF_AUDIO.setThrottle(game.sortie.throttle + (game.sortie.boosting ? 0.4 : 0));
        if (game.sortie.lock >= 1) {
          if (!game._beepT || game.time - game._beepT > 0.28) {
            game._beepT = game.time;
            window.RF_AUDIO.lockBeep(1);
          }
        } else if (game.sortie.lock > 0.2) {
          if (!game._beepT || game.time - game._beepT > 0.6) {
            game._beepT = game.time;
            window.RF_AUDIO.lockBeep(game.sortie.lock);
          }
        }
      } else if (!game.sortie.won) {
        // Let the explosion finish, then show the game-over screen.
        game._overT = (game._overT || 0) + dt;
        if (game._overT > 1.2) { game.screen = 'over'; game._overT = 0; }
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function fireMissileKey() {
    if (game.screen !== 'flight' || !game.sortie || game.sortie.over) return;
    if (window.RF_WORLD.fireMissile(game.sortie)) window.RF_AUDIO.missile();
    else window.RF_AUDIO.denied();
  }

  function onKey(e) {
    var code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(code) >= 0) e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) {
      if (code === 'KeyM') {
        window.RF_AUDIO.setMuted(!window.RF_AUDIO.isMuted());
        return;
      }
      switch (game.screen) {
        case 'title':
          if (code === 'Enter') { game.screen = 'hangar'; window.RF_AUDIO.click(); }
          else if (code === 'KeyH') { game.screen = 'hangar'; window.RF_AUDIO.click(); }
          else if (code === 'Slash') { game.prevScreen = 'title'; game.screen = 'help'; }
          else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
            var slot = Number(code.slice(-1)) - 1;
            if (game.saves[slot]) { loadRun(slot); game.screen = 'hangar'; }
            else { saveRun(slot); game.screen = 'hangar'; }
            window.RF_AUDIO.click();
          }
          break;
        case 'hangar':
          if (code === 'Enter') { startMission(Math.min(6, window.RF_RUN.stats.unlocked)); }
          else if (code === 'Escape') { game.screen = 'title'; }
          else if (code === 'KeyS') { saveRun(0); window.RF_AUDIO.buy(); }
          else if (code === 'KeyH' || code === 'Slash') { game.prevScreen = 'hangar'; game.screen = 'help'; }
          else if (/^Digit[1-7]$/.test(code)) { buyUpgrade(Number(code.slice(-1)) - 1); }
          break;
        case 'briefing':
          if (code === 'Enter') { launchSortie(); }
          else if (code === 'Escape') { game.screen = 'hangar'; }
          break;
        case 'flight':
          if (code === 'Space') {
            if (!game.sortie.over) {
              window.RF_WORLD.fireCannon(game.sortie);
              window.RF_AUDIO.cannon();
            }
          } else if (code === 'KeyF') { fireMissileKey(); }
          else if (code === 'KeyC') { window.RF_WORLD.dropFlare(game.sortie); }
          else if (code === 'KeyV') {
            game.sortie.camera = game.sortie.camera === 'cockpit' ? 'chase' : 'cockpit';
            window.RF_AUDIO.click();
          } else if (code === 'KeyP') { game.screen = 'pause'; window.RF_AUDIO.engineOff(); }
          else if (code === 'Enter' && game.sortie.over && game.sortie.won) { nextMission(); }
          else if (code === 'KeyR' && game.sortie.over) { launchSortie(); }
          else if (code === 'KeyH' && game.sortie.over) { game.screen = 'hangar'; }
          break;
        case 'pause':
          if (code === 'KeyP' || code === 'Enter') { game.screen = 'flight'; }
          else if (code === 'Escape') { game.screen = 'hangar'; }
          break;
        case 'results':
          if (code === 'Enter') { game.screen = 'hangar'; }
          else if (code === 'KeyR') { window.RF_RUN = window.RF_WORLD.freshRun(); game.screen = 'hangar'; }
          break;
        case 'help':
          if (code === 'Escape' || code === 'Enter') { game.screen = game.prevScreen || 'title'; }
          break;
        case 'over':
          if (code === 'KeyR') { window.RF_RUN = window.RF_WORLD.freshRun(); game.screen = 'hangar'; }
          else if (code === 'Enter') { game.screen = 'title'; }
          break;
      }
    }
    keys[code] = e.type === 'keydown';
  }

  canvas.addEventListener('mousedown', function (e) {
    window.RF_AUDIO.unlock();
    if (game.screen === 'flight') {
      var r = canvas.getBoundingClientRect();
      var mx = (e.clientX - r.left) * (W / r.width);
      var my = (e.clientY - r.top) * (H / r.height);
      if (game.sortie && game.sortie.target && game.sortie.target.alive) fireMissileKey();
      else if (game.sortie) { window.RF_WORLD.fireCannon(game.sortie); window.RF_AUDIO.cannon(); }
      void mx; void my;
    }
  });

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // Staged screenshots (?shot=1..4) are built by shots.js after assets load.
  function boot() {
    window.RF_RENDER.loadAll(function () {
      var q = new URLSearchParams(window.location.search);
      var shot = q.get('shot');
      if (shot && window.RF_SHOTS) {
        game.shotMode = shot;
        window.RF_SHOTS.stage(shot, game);
      } else {
        game.screen = 'title';
        window.RF_AUDIO.startTheme();
      }
      requestAnimationFrame(loop);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
