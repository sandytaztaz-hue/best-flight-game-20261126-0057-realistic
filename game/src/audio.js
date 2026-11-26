/* REAL FALCON: WebAudio sound — engine hum, lock tone, missiles, cannon,
   explosions, radio blips and a short menu theme. No audio files, all
   synthesised. Safe no-op when AudioContext is unavailable. */
(function () {
  'use strict';

  var ctx = null, master = null, engineOsc = null, engineGain = null;
  var muted = false, themeTimer = null, themeStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saw oscillators through a low-pass filter.
      engineOsc = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      osc2.type = 'sawtooth'; osc2.frequency.value = 58.5;
      engineOsc.connect(filt); osc2.connect(filt);
      filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); osc2.start();
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
      var g = ctx.createGain(); g.gain.value = vol || 0.4;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) { /* ignore */ }
  }

  var api = {
    unlock: function () { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted: function () { return muted; },
    setThrottle: function (t) {
      if (!ensure() || muted) return;
      try {
        engineGain.gain.setTargetAtTime(0.03 + t * 0.10, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(48 + t * 70, ctx.currentTime, 0.1);
      } catch (e) { /* engine hum is decoration, never fatal */ }
    },
    engineOff: function () {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    },
    lockBeep: function (level) {
      tone(620 + level * 620, 0.09, 'square', 0.10);
    },
    missile: function () { noise(0.7, 0.35, 2400); tone(900, 0.6, 'sawtooth', 0.08, 240); },
    cannon: function () { noise(0.09, 0.30, 1600); tone(160, 0.08, 'square', 0.14, 70); },
    explosion: function () { noise(1.1, 0.55, 500); tone(90, 0.9, 'sine', 0.35, 32); },
    flare: function () { noise(0.35, 0.2, 3200); },
    hit: function () { tone(220, 0.15, 'square', 0.18, 110); },
    radio: function () { tone(880, 0.07, 'sine', 0.10); tone(1174, 0.09, 'sine', 0.10); },
    click: function () { tone(660, 0.05, 'square', 0.08); },
    buy: function () { tone(523, 0.1, 'triangle', 0.16); tone(784, 0.16, 'triangle', 0.16); },
    denied: function () { tone(180, 0.2, 'square', 0.14); },
    win: function () {
      var seq = [523, 659, 784, 1046];
      for (var i = 0; i < seq.length; i++) {
        (function (f, d) { setTimeout(function () { tone(f, 0.22, 'triangle', 0.18); }, d); })(seq[i], i * 140);
      }
    },
    startTheme: function () {
      if (!ensure() || themeTimer) return;
      var notes = [220, 277, 330, 392, 330, 277, 220, 196];
      themeStep = 0;
      themeTimer = setInterval(function () {
        if (muted) return;
        tone(notes[themeStep % notes.length], 0.34, 'triangle', 0.07);
        if (themeStep % 4 === 0) tone(110, 0.5, 'sine', 0.10);
        themeStep++;
      }, 340);
    },
    stopTheme: function () {
      if (themeTimer) { clearInterval(themeTimer); themeTimer = null; }
    }
  };

  window.RF_AUDIO = api;
})();
