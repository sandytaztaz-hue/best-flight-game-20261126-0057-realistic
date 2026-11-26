/* REAL FALCON: renderer — every scene is a photographic asset drawn with
   drawImage; HUD panels and text stay clean UI. NEVER flat vector scenery:
   sky, sea, jets, ships and explosions are all real imagery. */
(function () {
  'use strict';
  var CFG = window.RF_CONFIG;
  var W = 1280, H = 720;

  var IMG = {};
  var IMAGES = [
    'cockpit-bg.jpg', 'sunset-strait.jpg', 'day-sea.jpg', 'night-sea.jpg',
    'storm-canyon.jpg', 'dawn-fog.jpg', 'hangar-bg.jpg',
    'jet-player.png', 'jet-enemy.png', 'jet-cargo.png', 'fleet.png', 'explosion.png'
  ];

  function loadAll(done) {
    var left = IMAGES.length;
    IMAGES.forEach(function (name) {
      var im = new Image();
      im.onload = function () { IMG[name] = im; if (--left === 0) done(); };
      im.onerror = function () { IMG[name] = null; if (--left === 0) done(); };
      im.src = 'assets/' + name;
    });
  }

  function bg(ctx, name) {
    var im = IMG[name];
    if (im) { ctx.drawImage(im, 0, 0, W, H); return; }
    ctx.fillStyle = '#0a2038'; ctx.fillRect(0, 0, W, H);
  }

  function drawSprite(ctx, name, x, y, w, h, flip) {
    var im = IMG[name];
    if (!im) return;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function panel(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(6,14,24,' + (alpha === undefined ? 0.78 : alpha) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(140,200,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function text(ctx, s, x, y, size, color, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = color || '#eaf4ff';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(s, x, y);
  }

  function bar(ctx, x, y, w, h, frac, fill, bgc) {
    ctx.fillStyle = bgc || 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function compass(ctx, heading, x, y, w) {
    panel(ctx, x, y, w, 34, 0.72);
    text(ctx, 'HDG', x + 10, y + 9, 13, '#9fd0ff');
    var marks = ['N', '045', 'E', '135', 'S', '225', 'W', '315'];
    for (var i = 0; i < 8; i++) {
      var deg = i * 45;
      var dx = ((deg - heading + 540) % 360) - 180;
      var px = x + w / 2 + dx * 1.1;
      if (px > x + 52 && px < x + w - 20) text(ctx, marks[i], px, y + 9, 13, '#eaf4ff', 'center');
    }
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x + w / 2 - 1, y + 2, 2, 8);
    text(ctx, String(Math.round(heading)).padStart(3, '0') + '°', x + w - 58, y + 9, 13, '#ffd166');
  }

  function radar(ctx, sortie, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.clip();
    ctx.fillStyle = 'rgba(4,26,12,0.85)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(80,255,140,0.5)';
    for (var i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, r * i / 3, 0, 6.29); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    var sweep = (Date.now() / 900) % 6.29;
    ctx.strokeStyle = 'rgba(120,255,170,0.9)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r); ctx.stroke();
    var range = 900 * (window.RF_RUN ? window.RF_RUN.stats.radarMul : 1);
    sortie.enemies.forEach(function (e) {
      if (!e.alive) return;
      var dx = (e.x - sortie.playerX) / range * r, dy = (e.y - sortie.playerY) / range * r;
      if (Math.hypot(dx, dy) > r - 4) return;
      ctx.fillStyle = e.kind === 'ghost' ? '#ff4040' : (e.kind === 'cargo' ? '#ffd166' : '#ff7a5c');
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, e.kind === 'ghost' ? 5 : 3.5, 0, 6.29); ctx.fill();
    });
    if (sortie.fleet) sortie.fleet.forEach(function (sh) {
      if (!sh.alive) return;
      ctx.fillStyle = '#7fd4ff';
      ctx.fillRect(cx + (sh.x - sortie.playerX) / range * r - 3, cy + (sh.y - sortie.playerY) / range * r - 2, 6, 4);
    });
    ctx.fillStyle = '#9dffb0';
    ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#5cff8f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.stroke();
    text(ctx, 'RADAR', cx - r + 4, cy - r - 16, 12, '#7dff9e');
  }

  function hud(ctx, sortie) {
    var run = window.RF_RUN, s = run.stats, m = sortie.mission;
    var wx = CFG.WEATHER[m.weather];
    // Top strip: compass + mission + timer + weather.
    compass(ctx, (sortie.time * 9 + 320) % 360, 300, 10, 680);
    panel(ctx, 10, 10, 280, 34, 0.72);
    text(ctx, 'M' + m.id + ' · ' + m.name, 20, 19, 14, '#ffd166');
    panel(ctx, 990, 10, 280, 34, 0.72);
    text(ctx, 'T+' + fmtTime(sortie.time) + '   ' + wx.label + '   ' + wx.wind, 1000, 19, 13, '#eaf4ff');
    // Left: radar scope + route progress.
    radar(ctx, sortie, 92, 150, 62);
    panel(ctx, 20, 228, 150, 96, 0.72);
    text(ctx, 'ROUTE ' + Math.round(sortie.routeProgress * 100) + '%', 30, 236, 12, '#9fd0ff');
    m.route.forEach(function (stop, i) {
      var done = sortie.routeProgress * m.route.length > i;
      text(ctx, (done ? '● ' : '○ ') + stop, 30, 256 + i * 17, 12, done ? '#9dffb0' : '#cfe6ff');
    });
    // Right: gauges — airspeed, altitude, throttle, fuel, hull.
    panel(ctx, 1080, 56, 190, 220, 0.78);
    text(ctx, 'AIRSPEED', 1092, 66, 12, '#9fd0ff');
    text(ctx, Math.round(380 + sortie.throttle * 260 + (sortie.boosting ? 240 : 0)) + ' KT', 1092, 84, 22, '#ffffff');
    text(ctx, 'ALTITUDE', 1092, 116, 12, '#9fd0ff');
    text(ctx, Math.round(12400 - (sortie.playerY - 90) * 14) + ' FT', 1092, 134, 22, '#ffffff');
    text(ctx, 'THROTTLE', 1092, 166, 12, '#9fd0ff');
    bar(ctx, 1092, 184, 166, 12, sortie.throttle, sortie.boosting ? '#ff9d3c' : '#4fc3ff');
    text(ctx, sortie.boosting ? 'AFTERBURNER' : 'MIL POWER', 1092, 200, 11, sortie.boosting ? '#ff9d3c' : '#9fd0ff');
    text(ctx, 'FUEL', 1092, 222, 12, '#9fd0ff');
    bar(ctx, 1092, 240, 166, 12, sortie.fuel / s.fuelMax, sortie.fuel < 25 ? '#ff5d5d' : '#ffd166');
    // Bottom-left: hull + weapons.
    panel(ctx, 20, 596, 330, 104, 0.78);
    text(ctx, 'HULL', 30, 604, 12, '#9fd0ff');
    bar(ctx, 30, 622, 300, 13, sortie.hull / s.hullMax, sortie.hull < 35 ? '#ff5d5d' : '#5cff8f');
    text(ctx, Math.round(sortie.hull) + ' / ' + s.hullMax, 30, 640, 13, '#ffffff');
    text(ctx, 'AIM-9 × ' + sortie.missileCount + '    FLARES × ' + sortie.flares +
      '    GUN ' + s.gunDmg + ' DMG', 30, 664, 13, '#eaf4ff');
    text(ctx, 'SPACE gun · F missile · C flare · SHIFT burner', 30, 684, 11, '#9fb8cc');
    // Bottom-right: score, kills, target.
    panel(ctx, 930, 596, 330, 104, 0.78);
    text(ctx, 'SCORE ' + sortie.score + '   KILLS ' + sortie.kills + ' / ' +
      sortie.enemies.length, 942, 604, 13, '#ffd166');
    if (sortie.target && sortie.target.alive) {
      var t = sortie.target;
      text(ctx, 'TARGET: ' + t.kind.toUpperCase() + '  ' +
        Math.round(Math.hypot(t.x - sortie.playerX, t.y - sortie.playerY) * 3) + ' M  HP ' +
        Math.max(0, Math.round(t.hp)), 942, 626, 13, '#ff9d7a');
      text(ctx, sortie.lock >= 1 ? 'LOCK — FIRE!' : 'LOCK ' + Math.round(sortie.lock * 100) + '% — hold centre',
        942, 648, 13, sortie.lock >= 1 ? '#5cff8f' : '#eaf4ff');
    } else {
      text(ctx, 'NO TARGET — sweep the sky', 942, 626, 13, '#9fb8cc');
    }
    text(ctx, 'CREDITS ' + s.credits + '   SORTIE ' + m.id + '/6', 942, 684, 11, '#9fb8cc');
    // Radio line + warnings + kill feed (never overlapping: stacked bands).
    if (sortie.radio && sortie.radioT < 4) {
      panel(ctx, 360, 52, 560, 30, 0.72);
      text(ctx, sortie.radio, 372, 60, 14, '#ff9d9d');
    }
    if (sortie.warning && sortie.warningT < 3) {
      panel(ctx, 360, 88, 560, 28, 0.8);
      text(ctx, '⚠ ' + sortie.warning, 372, 95, 14, '#ff6b6b');
    }
    if (sortie.lastKill && sortie.lastKillT < 3) {
      panel(ctx, 360, 660, 560, 28, 0.72);
      text(ctx, '✈ ' + sortie.lastKill, 372, 667, 14, '#9dffb0');
    }
  }

  function lockBracket(ctx, sortie) {
    var t = sortie.target;
    if (!t || !t.alive) return;
    var L = 26 + (1 - sortie.lock) * 26;
    var locked = sortie.lock >= 1;
    ctx.strokeStyle = locked ? '#5cff8f' : '#ff5d5d';
    ctx.lineWidth = locked ? 3 : 2;
    var x = t.x, y = t.y, w = t.size * 0.7, h = t.size * 0.5;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(x + c[0] * w / 2, y + c[1] * h / 2 - c[1] * L);
      ctx.lineTo(x + c[0] * w / 2, y + c[1] * h / 2);
      ctx.lineTo(x + c[0] * w / 2 - c[0] * L, y + c[1] * h / 2);
      ctx.stroke();
    });
    text(ctx, locked ? 'LOCK' : 'TRACK', x, y - h / 2 - 22, 13, locked ? '#5cff8f' : '#ff9d9d', 'center');
    // Centre pipper.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(640, 330, 14, 0, 6.29); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(640 - 22, 330); ctx.lineTo(640 - 8, 330); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(640 + 8, 330); ctx.lineTo(640 + 22, 330); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(640, 330 - 22); ctx.lineTo(640, 330 - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(640, 330 + 8); ctx.lineTo(640, 330 + 22); ctx.stroke();
  }

  // A ship slice of the fleet photo: the right destroyer for missile boats,
  // the left destroyer for coastal depots. Boats and depots are ships and
  // shore targets — never fighter jets sitting on the water.
  function drawShipSlice(ctx, which, x, y, w, h) {
    var im = IMG['fleet.png'];
    if (!im) return;
    var src = which === 'boat'
      ? { x: 712, y: 20, w: 300, h: 100 }
      : { x: 6, y: 20, w: 192, h: 100 };
    ctx.drawImage(im, src.x, src.y, src.w, src.h, x - w / 2, y - h / 2, w, h);
  }

  function drawEnemies(ctx, sortie) {
    sortie.enemies.forEach(function (e) {
      if (!e.alive) return;
      if (e.kind === 'boat') { drawShipSlice(ctx, 'boat', e.x, e.y, e.size, e.size / 3); }
      else if (e.kind === 'depot') { drawShipSlice(ctx, 'depot', e.x, e.y, e.size, e.size / 1.9); }
      else {
        var img = e.kind === 'cargo' ? 'jet-cargo.png' : 'jet-enemy.png';
        var w = e.size, h = e.size * (e.kind === 'cargo' ? 0.34 : 0.66);
        if (e.kind === 'ghost') {
          ctx.save();
          ctx.filter = 'brightness(0.35) contrast(1.2)';
          drawSprite(ctx, img, e.x, e.y, w, h, e.x < sortie.playerX);
          ctx.restore();
          text(ctx, 'GHOST', e.x, e.y - h / 2 - 34, 13, '#ff5d5d', 'center');
        } else {
          drawSprite(ctx, img, e.x, e.y, w, h, e.x < sortie.playerX);
        }
      }
      if (e.kind === 'boat' || e.kind === 'depot') {
        text(ctx, (e.kind === 'boat' ? 'MISSILE BOAT' : 'FUEL DEPOT') + '  HP ' + Math.max(0, Math.round(e.hp)),
          e.x, e.y - 60, 12, '#ffd166', 'center');
      }
    });
    // Missile smoke trails + missile dots.
    sortie.missiles.forEach(function (m) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      m.trail.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 6.29); ctx.fill();
    });
    // Cannon tracers.
    sortie.tracers.forEach(function (tr) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x, tr.y - 60); ctx.stroke();
    });
    // Flares.
    sortie.flaresLit.forEach(function (f) {
      ctx.fillStyle = 'rgba(255,220,120,' + Math.max(0, 1 - f.t) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y + f.t * 60, 10, 0, 6.29); ctx.fill();
    });
    // Explosions: additive fireball sprite over the photographic scene.
    sortie.explosions.forEach(function (ex) {
      var p = ex.t / ex.dur;
      var size = ex.size * (0.7 + p * 0.8);
      var im = IMG['explosion.png'];
      if (im) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        ctx.drawImage(im, ex.x - size / 2, ex.y - size / 2, size, size);
        ctx.restore();
      }
    });
  }

  function drawFleet(ctx, sortie) {
    if (!sortie.fleet) return;
    drawSprite(ctx, 'fleet.png', 640, 640, 560, 78, false);
    sortie.fleet.forEach(function (sh) {
      // Labels sit just above the ships with a dark backing, clear of the
      // bottom HUD panels (which start at y=596) and of the ships themselves.
      ctx.fillStyle = 'rgba(6,14,24,0.65)';
      ctx.fillRect(sh.x - 100, sh.y - 80, 200, 18);
      text(ctx, sh.name + '  ' + (sh.alive ? 'HP ' + Math.round(sh.hp) : 'SUNK'),
        sh.x, sh.y - 78, 12, sh.alive ? '#7fd4ff' : '#ff6b6b', 'center');
    });
  }

  function flight(ctx, sortie) {
    var m = sortie.mission;
    if (sortie.camera === 'cockpit') {
      bg(ctx, 'cockpit-bg.jpg');
      // The world ahead, seen through the canopy window, scaled into it.
      ctx.save();
      ctx.beginPath(); ctx.rect(300, 60, 680, 300); ctx.clip();
      ctx.translate(300, 60);
      ctx.scale(680 / 1280, 300 / 720);
      var im = IMG[m.bg];
      if (im) ctx.drawImage(im, 0, 0, 1280, 720);
      drawEnemies(ctx, sortie);
      lockBracket(ctx, sortie);
      ctx.restore();
      // Canopy frame + glowing panel strip at the bottom of the cockpit photo.
      ctx.strokeStyle = 'rgba(20,30,40,0.9)'; ctx.lineWidth = 26;
      ctx.strokeRect(0, 0, W, H);
      panel(ctx, 0, 660, W, 60, 0.6);
      text(ctx, 'COCKPIT VIEW — V toggles chase view · canopy frame live', 24, 682, 13, '#9fd0ff');
    } else {
      bg(ctx, m.bg);
      drawFleet(ctx, sortie);
      drawSprite(ctx, 'jet-player.png', sortie.playerX, sortie.playerY, 210, 112, false);
      drawEnemies(ctx, sortie);
      // Storm weather: rain streaks + lightning flash wash.
      if (m.weather === 'storm') {
        ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1;
        sortie.rain.forEach(function (r) {
          ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 6, r.y + 16); ctx.stroke();
        });
        if (sortie.flashT > 0) {
          ctx.fillStyle = 'rgba(255,255,230,' + (sortie.flashT * 1.6) + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }
      if (m.weather === 'night') {
        ctx.fillStyle = 'rgba(4,8,28,0.28)';
        ctx.fillRect(0, 0, W, H);
      }
      if (m.weather === 'fog') {
        ctx.fillStyle = 'rgba(220,225,230,0.13)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (sortie.camera !== 'cockpit') lockBracket(ctx, sortie);
    hud(ctx, sortie);
    // Mission banner.
    if (sortie.over) {
      ctx.fillStyle = 'rgba(4,10,18,0.72)'; ctx.fillRect(0, 0, W, H);
      panel(ctx, 340, 220, 600, 280, 0.92);
      if (sortie.won) {
        text(ctx, 'MISSION COMPLETE', 640, 248, 34, '#5cff8f', 'center');
        text(ctx, sortie.mission.name + '  ·  GRADE ' + sortie.result.grade, 640, 296, 20, '#ffd166', 'center');
        text(ctx, 'Score ' + sortie.result.score + '   Kills ' + sortie.result.kills +
          '   Time ' + fmtTime(sortie.result.time) + '   Accuracy ' + sortie.result.accuracy + '%',
          640, 330, 16, '#eaf4ff', 'center');
        text(ctx, 'Reward +' + sortie.reward + ' credits   ·   Hull left ' + sortie.result.hull + '%',
          640, 360, 16, '#9dffb0', 'center');
        text(ctx, 'ENTER — next mission      H — hangar      R — fly it again', 640, 420, 15, '#9fd0ff', 'center');
      } else {
        text(ctx, 'SORTIE FAILED', 640, 248, 34, '#ff6b6b', 'center');
        text(ctx, sortie.failReason || 'MISSION FAILED', 640, 296, 20, '#ffd166', 'center');
        text(ctx, 'Falcon-1 is down. The Kestrel is waiting for the next launch.',
          640, 336, 16, '#eaf4ff', 'center');
        text(ctx, 'R — retry the sortie      H — back to hangar', 640, 420, 15, '#9fd0ff', 'center');
      }
    }
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function titleScreen(ctx, game) {
    bg(ctx, 'dawn-fog.jpg');
    drawSprite(ctx, 'jet-player.png', 640, 430, 460, 246, false);
    panel(ctx, 240, 60, 800, 150, 0.82);
    text(ctx, 'REAL FALCON', 640, 78, 64, '#ffffff', 'center');
    text(ctx, '— ACE COMBAT RUN —', 640, 152, 22, '#ffd166', 'center');
    text(ctx, 'Six sorties. One sea war. Bring the squadron home.', 640, 186, 15, '#cfe6ff', 'center');
    panel(ctx, 300, 240, 680, 120, 0.8);
    text(ctx, 'CMDR. VEGA: "Falcon-1, the Crimson Wake is moving on the strait.', 320, 252, 14, '#ffd166');
    text(ctx, 'Six sorties stand between us and the end of this war. Fly them all."', 320, 274, 14, '#eaf4ff');
    text(ctx, 'LT. ROOK: "I have your six, boss. Let us go hunting."', 320, 300, 14, '#7fd4ff');
    text(ctx, 'OFF. MARA (TOWER): "Kestrel tower is with you, Falcon-1. Good hunting."', 320, 324, 14, '#9dffb0');
    panel(ctx, 300, 380, 680, 64, 0.8);
    text(ctx, 'ENTER — launch   ·   1-3 — load save slot   ·   H — hangar & shop   ·   ? — help',
      640, 398, 15, '#ffffff', 'center');
    text(ctx, 'WASD / arrows steer · SPACE cannon · F missile · C flare · SHIFT afterburner · V camera · M mute',
      640, 422, 13, '#9fb8cc', 'center');
    // Save slots on the title screen.
    var saves = game.saves;
    for (var i = 0; i < 3; i++) {
      var sv = saves[i];
      panel(ctx, 300 + i * 232, 470, 216, 110, 0.8);
      text(ctx, 'SAVE SLOT ' + (i + 1), 320 + i * 232, 482, 14, '#ffd166');
      if (sv) {
        text(ctx, sv.stats.pilot, 320 + i * 232, 506, 14, '#ffffff');
        text(ctx, 'Missions ' + sv.stats.unlocked + '/6 · ' + sv.stats.credits + ' cr', 320 + i * 232, 528, 12, '#eaf4ff');
        text(ctx, 'Score ' + sv.totalScore + ' · Kills ' + sv.kills, 320 + i * 232, 548, 12, '#9dffb0');
      } else {
        text(ctx, '— EMPTY —', 320 + i * 232, 506, 14, '#9fb8cc');
        text(ctx, 'Press ' + (i + 1) + ' to start a new', 320 + i * 232, 528, 12, '#9fb8cc');
        text(ctx, 'campaign in this slot', 320 + i * 232, 548, 12, '#9fb8cc');
      }
    }
    panel(ctx, 300, 600, 680, 52, 0.8);
    text(ctx, 'A photorealistic jet-combat campaign — real skies, real seas, real jets.',
      640, 612, 14, '#eaf4ff', 'center');
    text(ctx, 'Static files only · plays offline · WebAudio sound · 1280×720', 640, 634, 12, '#9fb8cc', 'center');
  }

  function hangarScreen(ctx, game) {
    var run = window.RF_RUN, s = run.stats;
    bg(ctx, 'hangar-bg.jpg');
    drawSprite(ctx, 'jet-player.png', 330, 300, 420, 224, false);
    panel(ctx, 20, 20, 620, 60, 0.82);
    text(ctx, 'HANGAR — KESTREL DECK', 36, 32, 26, '#ffffff');
    text(ctx, 'CHIEF GUS: "She is fuelled and ready, kid. Spend wisely — my prices are fair."', 36, 62, 13, '#ff9d7a');
    panel(ctx, 660, 20, 600, 330, 0.84);
    text(ctx, 'UPGRADES — click or press 1-7 to buy', 680, 32, 16, '#ffd166');
    CFG.UPGRADES.forEach(function (u, i) {
      var lvl = s.upgrades[u.id] || 0;
      var y = 60 + i * 38;
      var owned = lvl >= u.max;
      ctx.fillStyle = owned ? 'rgba(90,255,140,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(676, y, 568, 34);
      text(ctx, (i + 1) + '. ' + u.name + '  ' + '★'.repeat(lvl) + '☆'.repeat(u.max - lvl), 686, y + 8, 14, '#ffffff');
      text(ctx, u.desc, 686, y + 22, 11, '#9fb8cc');
      text(ctx, owned ? 'MAXED' : u.price + ' cr', 1170, y + 9, 14, owned ? '#5cff8f' : '#ffd166', 'right');
    });
    panel(ctx, 660, 360, 600, 110, 0.84);
    text(ctx, 'LOADOUT', 680, 372, 15, '#ffd166');
    text(ctx, 'AIM-9 × ' + s.missilesMax + '   FLARES × ' + s.flaresMax + '   HULL ' + s.hullMax +
      '   FUEL ' + s.fuelMax + '   GUN ' + s.gunDmg, 680, 396, 14, '#ffffff');
    text(ctx, 'Top speed ×' + s.speedMul.toFixed(2) + '   Lock ×' + s.lockMul.toFixed(2) +
      '   Radar ×' + s.radarMul.toFixed(2), 680, 420, 13, '#9fd0ff');
    text(ctx, 'CREDITS: ' + s.credits, 680, 444, 15, '#ffd166');
    panel(ctx, 20, 360, 620, 110, 0.84);
    text(ctx, 'MISSION MAP — press 1-6 to fly (unlocked: ' + s.unlocked + '/6)', 36, 372, 15, '#ffd166');
    CFG.MISSIONS.forEach(function (m, i) {
      var unlocked = i < s.unlocked;
      var grade = s.best[m.id];
      text(ctx, (i + 1) + '. ' + m.name + (grade ? '  [' + grade + ']' : '') + (unlocked ? '' : '  🔒'),
        36, 396 + i * 13, 12, unlocked ? '#eaf4ff' : '#8aa0b4');
    });
    panel(ctx, 20, 490, 620, 110, 0.84);
    text(ctx, 'SAVE SLOTS — S saves the campaign here', 36, 502, 15, '#ffd166');
    for (var i = 0; i < 3; i++) {
      var sv = game.saves[i];
      text(ctx, 'Slot ' + (i + 1) + ': ' + (sv ? sv.stats.pilot + ' · M' + sv.stats.unlocked + ' · ' +
        sv.stats.credits + ' cr · ' + sv.totalScore + ' pts' : 'empty'),
        36, 526 + i * 20, 13, sv ? '#9dffb0' : '#9fb8cc');
    }
    panel(ctx, 660, 490, 600, 110, 0.84);
    text(ctx, 'SQUADRON', 680, 502, 15, '#ffd166');
    text(ctx, 'VEGA — leader · ROOK — wingman · MARA — tower · GUS — hangar', 680, 526, 13, '#eaf4ff');
    text(ctx, 'Enemy ace GHOST waits in mission 6, above the dawn fog.', 680, 548, 13, '#ff9d9d');
    text(ctx, 'ENTER — fly next mission · ESC — title · M — mute', 680, 574, 13, '#9fd0ff');
  }

  function briefingScreen(ctx, game) {
    var m = game.briefingMission;
    var p = CFG.PEOPLE[m.speaker];
    bg(ctx, m.bg);
    panel(ctx, 60, 40, 1160, 120, 0.85);
    text(ctx, 'MISSION ' + m.id + ' — ' + m.name, 84, 56, 30, '#ffffff');
    text(ctx, 'OBJECTIVE: ' + m.goal + '   ·   REWARD ' + m.reward + ' cr   ·   PAR ' + m.par + ' pts',
      84, 100, 15, '#ffd166');
    text(ctx, CFG.WEATHER[m.weather].label + ' — ' + CFG.WEATHER[m.weather].sky +
      ' · wind ' + CFG.WEATHER[m.weather].wind, 84, 126, 13, '#9fd0ff');
    panel(ctx, 60, 180, 1160, 190, 0.85);
    text(ctx, p.name.toUpperCase() + ' — ' + p.role.toUpperCase() + ' (' + p.callsign + ')', 84, 196, 16, p.color);
    text(ctx, m.briefing, 84, 226, 16, '#ffffff');
    var lines = CFG.DIALOGUE['m' + m.id];
    lines.forEach(function (ln, i) {
      var who = CFG.PEOPLE[ln.who];
      text(ctx, who.name.toUpperCase() + ': "' + ln.text + '"', 84, 258 + i * 30, 13, who.color);
    });
    panel(ctx, 60, 390, 1160, 120, 0.85);
    text(ctx, 'ROUTE', 84, 402, 14, '#9fd0ff');
    m.route.forEach(function (stop, i) {
      var x = 84 + i * 280;
      text(ctx, '● ' + stop, x, 430, 14, '#eaf4ff');
      if (i < m.route.length - 1) text(ctx, '——————▶', x + 150, 430, 14, '#ffd166');
    });
    text(ctx, 'ENEMIES: ' + m.enemies.map(function (g) { return g.n + '× ' + g.kind; }).join('  ·  '),
      84, 466, 14, '#ff9d7a');
    panel(ctx, 60, 530, 1160, 90, 0.85);
    text(ctx, 'ENTER — take off   ·   ESC — back to hangar', 640, 556, 18, '#ffffff', 'center');
    text(ctx, 'Steer WASD / arrows · SPACE cannon · F missile (needs lock) · C flare · SHIFT afterburner · V camera',
      640, 588, 13, '#9fb8cc', 'center');
  }

  function resultsScreen(ctx, game) {
    var run = window.RF_RUN;
    bg(ctx, 'dawn-fog.jpg');
    panel(ctx, 60, 30, 1160, 130, 0.86);
    text(ctx, 'CAMPAIGN RESULTS — ' + run.stats.pilot, 84, 46, 30, '#ffffff');
    text(ctx, 'Six sorties over the Crimson Wake sea war. Total score ' + run.totalScore +
      ' · Kills ' + run.kills + ' · Sorties ' + run.sortiesFlown, 84, 92, 15, '#ffd166');
    var acc = run.shotsFired > 0 ? Math.round(100 * run.shotsHit / run.shotsFired) : 100;
    text(ctx, 'Overall accuracy ' + acc + '% · Credits banked ' + run.stats.credits, 84, 118, 14, '#9fd0ff');
    panel(ctx, 60, 180, 1160, 380, 0.86);
    text(ctx, 'SCORE PER MISSION', 84, 196, 16, '#ffd166');
    var maxScore = 600;
    run.missionResults.forEach(function (r, i) {
      var y = 228 + i * 48;
      var m = CFG.MISSIONS[r.id - 1];
      text(ctx, 'M' + r.id + ' ' + m.name, 84, y, 14, '#ffffff');
      bar(ctx, 420, y, 560, 20, r.score / maxScore, r.grade === 'S' ? '#ffd166' : '#4fc3ff');
      text(ctx, r.score + ' pts', 990, y + 2, 14, '#ffffff');
      text(ctx, 'GRADE ' + r.grade + '   KILLS ' + r.kills + '   ' + fmtTime(r.time) + '   ACC ' + r.accuracy + '%',
        1080, y + 2, 12, '#9dffb0');
    });
    text(ctx, 'ENTER — back to hangar      R — fly the campaign again', 640, 596, 16, '#ffffff', 'center');
    text(ctx, 'Grades: S needs a fast, clean sortie with 70%+ hull. Every kill pays 50 credits on top of the mission reward.',
      640, 626, 12, '#9fb8cc', 'center');
  }

  function helpScreen(ctx) {
    bg(ctx, 'hangar-bg.jpg');
    panel(ctx, 240, 40, 800, 640, 0.88);
    text(ctx, 'HOW TO FLY', 640, 60, 32, '#ffffff', 'center');
    var rows = [
      ['WASD / ARROW KEYS', 'Steer Falcon-1'],
      ['SPACE', 'Fire cannon (close range, no lock needed)'],
      ['F or MOUSE CLICK', 'Fire AIM-9 missile (needs a target)'],
      ['C', 'Drop flares — decoy enemy missiles'],
      ['SHIFT', 'Afterburner — fast, but drinks fuel'],
      ['V', 'Toggle cockpit view / chase view'],
      ['P', 'Pause'], ['M', 'Mute / unmute sound'],
      ['ENTER', 'Confirm / take off / next screen'],
      ['1–6', 'Pick a mission on the hangar map'],
      ['1–7', 'Buy an upgrade in the hangar'],
      ['S', 'Save campaign to slot 1'],
      ['ESC', 'Back to title / hangar'],
      ['R', 'Retry a failed sortie / restart campaign']
    ];
    rows.forEach(function (r, i) {
      text(ctx, r[0], 300, 120 + i * 34, 15, '#ffd166');
      text(ctx, r[1], 560, 120 + i * 34, 14, '#eaf4ff');
    });
    text(ctx, 'LOCK-ON: hold the target inside the centre bracket until the tone', 640, 600, 13, '#9fd0ff', 'center');
    text(ctx, 'turns solid green — then fire. Enemies pop flares to break it.', 640, 622, 13, '#9fd0ff', 'center');
    text(ctx, 'ESC — back', 640, 652, 14, '#ffffff', 'center');
  }

  function pauseScreen(ctx, sortie) {
    flight(ctx, sortie);
    ctx.fillStyle = 'rgba(4,10,18,0.6)'; ctx.fillRect(0, 0, W, H);
    panel(ctx, 440, 280, 400, 160, 0.92);
    text(ctx, 'PAUSED', 640, 300, 32, '#ffffff', 'center');
    text(ctx, 'P — resume      ESC — abandon to hangar', 640, 352, 15, '#9fd0ff', 'center');
    text(ctx, 'M — mute', 640, 380, 14, '#9fb8cc', 'center');
  }

  function gameOverScreen(ctx, game) {
    bg(ctx, 'night-sea.jpg');
    panel(ctx, 240, 180, 800, 340, 0.88);
    text(ctx, 'GAME OVER', 640, 210, 44, '#ff6b6b', 'center');
    text(ctx, 'Falcon-1 is down. The squadron keeps the watch without you.', 640, 272, 16, '#eaf4ff', 'center');
    text(ctx, 'Final score ' + window.RF_RUN.totalScore + ' · Kills ' + window.RF_RUN.kills, 640, 310, 16, '#ffd166', 'center');
    text(ctx, 'R — start a new campaign      ENTER — title screen', 640, 380, 16, '#ffffff', 'center');
    text(ctx, 'CMDR. VEGA: "We will fly the next one for you, Falcon-1."', 640, 440, 14, '#ffd166', 'center');
  }

  window.RF_RENDER = {
    loadAll: loadAll, images: IMG,
    flight: flight, titleScreen: titleScreen, hangarScreen: hangarScreen,
    briefingScreen: briefingScreen, resultsScreen: resultsScreen,
    helpScreen: helpScreen, pauseScreen: pauseScreen, gameOverScreen: gameOverScreen,
    panel: panel, text: text, bar: bar, bg: bg, drawSprite: drawSprite, fmtTime: fmtTime
  };
})();
