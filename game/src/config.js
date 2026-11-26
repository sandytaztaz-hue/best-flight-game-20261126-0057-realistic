/* REAL FALCON - Ace Combat Run: game data.
   Missions, people, upgrades, weather and scoring. Pure data + tiny helpers;
   no DOM, no canvas, no network. */
(function () {
  'use strict';

  var PEOPLE = {
    vega: {
      name: 'Cmdr. Vega', role: 'Squadron Leader', callsign: 'Falcon Actual',
      color: '#ffd166',
      bio: 'Twenty years on carriers. Stern, exact, never wastes a word on the radio.'
    },
    rook: {
      name: 'Lt. Rook', role: 'Wingman', callsign: 'Falcon-2',
      color: '#7fd4ff',
      bio: 'Young, loud, fearless. Calls out every bandit before the radar does.'
    },
    mara: {
      name: 'Off. Mara', role: 'Carrier Control', callsign: 'Tower',
      color: '#9dffb0',
      bio: 'Calm voice on the Kestrel tower. Vectors, fuel calls and landing clearance.'
    },
    gus: {
      name: 'Chief Gus', role: 'Hangar Chief', callsign: 'Deck',
      color: '#ff9d7a',
      bio: 'Gruff mechanic who keeps Falcon-1 flying. Sells upgrades, never smiles for free.'
    },
    ghost: {
      name: 'GHOST', role: 'Enemy Ace', callsign: '???',
      color: '#ff5d5d',
      bio: 'A black jet with no markings. Nobody has seen his face. Everybody has heard his laugh on the radio.'
    }
  };

  var UPGRADES = [
    { id: 'rack',   name: 'Missile Rack',   desc: '+2 AIM-9 missiles per sortie', price: 300,  max: 3,
      apply: function (s) { s.missilesMax += 2; } },
    { id: 'flares', name: 'Flare Pack',     desc: '+4 defensive flares',          price: 200,  max: 3,
      apply: function (s) { s.flaresMax += 4; } },
    { id: 'armor',  name: 'Armor Plating',  desc: '+40 hull integrity',           price: 450,  max: 3,
      apply: function (s) { s.hullMax += 40; } },
    { id: 'engine', name: 'Afterburner Engine', desc: '+18% top speed, faster lock', price: 600, max: 3,
      apply: function (s) { s.speedMul += 0.18; s.lockMul += 0.15; } },
    { id: 'radar',  name: 'Long-Range Radar', desc: 'Lock builds 25% faster, wider scope', price: 500, max: 2,
      apply: function (s) { s.lockMul += 0.25; s.radarMul += 0.5; } },
    { id: 'tank',   name: 'Drop Tank',      desc: '+35 fuel per sortie',           price: 350,  max: 3,
      apply: function (s) { s.fuelMax += 35; } },
    { id: 'cannon', name: 'Cannon Upgrade', desc: '+6 gun damage per hit',         price: 400,  max: 3,
      apply: function (s) { s.gunDmg += 6; } }
  ];

  var WEATHER = {
    sunset: { label: 'SUNSET', sky: 'Orange dusk, low sun over the strait', wind: '12 kt W' },
    clear:  { label: 'CLEAR',  sky: 'Blue sky, scattered cloud over the islands', wind: '8 kt NE' },
    sea:    { label: 'SEA STATE 3', sky: 'Open ocean, whitecaps, fleet below', wind: '15 kt E' },
    night:  { label: 'NIGHT',  sky: 'Dark coast, runway lights, searchlights sweeping', wind: '5 kt N' },
    storm:  { label: 'THUNDERSTORM', sky: 'Rain, lightning, low cloud in the canyon', wind: '28 kt SW' },
    fog:    { label: 'DAWN FOG', sky: 'Fog banks over a grey sea at first light', wind: '4 kt S' }
  };

  var MISSIONS = [
    {
      id: 1, name: 'SUNSET INTERCEPT', bg: 'sunset-strait.jpg', weather: 'sunset',
      briefing: 'Three Crimson Wake cargo planes are running the strait at sunset. ' +
        'Shoot them all down before they cross the line. Vega is not asking twice.',
      speaker: 'vega', goal: 'Destroy 3 cargo planes',
      enemies: [ { kind: 'cargo', n: 3, hp: 60 } ],
      route: ['KESTREL', 'STRAIT GATE', 'VOLCANO PASS', 'INTERCEPT LINE'],
      reward: 500, par: 150
    },
    {
      id: 2, name: 'ISLAND DOGFIGHT', bg: 'day-sea.jpg', weather: 'clear',
      briefing: 'Six Wake fighters are hunting over the green islands. Get in close, ' +
        'build a lock, and send them into the sea. Rook has your six.',
      speaker: 'rook', goal: 'Destroy 6 enemy fighters',
      enemies: [ { kind: 'enemy', n: 6, hp: 45 } ],
      route: ['KESTREL', 'REEF CHAIN', 'GREEN ISLES', 'DOGFIGHT ZONE'],
      reward: 700, par: 180
    },
    {
      id: 3, name: 'FLEET SHIELD', bg: 'day-sea.jpg', weather: 'sea',
      briefing: 'The Wake is coming for the Kestrel herself. Hold the shield: no enemy ' +
        'jet gets past you, and no missile boat touches our ships.',
      speaker: 'mara', goal: 'Defend the fleet — sink or shoot all attackers',
      enemies: [ { kind: 'enemy', n: 5, hp: 45 }, { kind: 'boat', n: 2, hp: 80 } ],
      route: ['KESTREL', 'SCREEN LINE', 'ESCORT RING', 'CARRIER'],
      reward: 900, par: 210
    },
    {
      id: 4, name: 'NIGHT STRIKE', bg: 'night-sea.jpg', weather: 'night',
      briefing: 'Night raid on the coastal base. Runway lights below, searchlights ' +
        'sweeping for you. Hit the fuel depot and the radar mast, then get home ' +
        'before your tanks run dry.',
      speaker: 'vega', goal: 'Destroy the depot + radar mast, survive the night',
      enemies: [ { kind: 'enemy', n: 4, hp: 45 }, { kind: 'depot', n: 2, hp: 90 } ],
      route: ['KESTREL', 'DARK COAST', 'RUNWAY', 'FUEL DEPOT'],
      reward: 1000, par: 240
    },
    {
      id: 5, name: 'STORM CANYON', bg: 'storm-canyon.jpg', weather: 'storm',
      briefing: 'Thunderstorm in the canyon. Rain on the canopy, lightning all around, ' +
        'walls of rock on both sides. Fly the route, kill the patrol, do not clip a wall.',
      speaker: 'mara', goal: 'Fly the canyon route, destroy 4 patrol fighters',
      enemies: [ { kind: 'enemy', n: 4, hp: 50 } ],
      route: ['KESTREL', 'CANYON MOUTH', 'LIGHTNING BEND', 'CANYON EXIT'],
      reward: 1100, par: 240
    },
    {
      id: 6, name: 'GHOST ACE', bg: 'dawn-fog.jpg', weather: 'fog',
      briefing: 'Dawn over a foggy sea. GHOST is waiting — a black jet with no markings, ' +
        'the ace who has shot down eleven of ours. Beat him and the war is over.',
      speaker: 'ghost', goal: 'Defeat GHOST in a duel above the fog',
      enemies: [ { kind: 'ghost', n: 1, hp: 220 } ],
      route: ['KESTREL', 'FOG BANK', 'DUEL ARENA', 'DAWN LINE'],
      reward: 2000, par: 300
    }
  ];

  var DIALOGUE = {
    m1: [
      { who: 'vega', text: 'Falcon-1, this is Vega. Cargo flight, three birds, sunset strait. Do not let them cross the line.' },
      { who: 'rook', text: 'Falcon-2 here — I see them, big slow targets. This is going to be fun.' },
      { who: 'mara', text: 'Tower: wind 12 knots west, sun in your eyes on the run-in. Guns hot, Falcon-1.' }
    ],
    m2: [
      { who: 'rook', text: 'Six bandits over the islands, Falcon-1! They are turning in — this is a real dogfight!' },
      { who: 'vega', text: 'Stay on their tails. Lock first, shoot second. Do not waste missiles on a bad tone.' },
      { who: 'mara', text: 'Tower: radar shows all six in the zone. Kestrel is holding station behind you.' }
    ],
    m3: [
      { who: 'mara', text: 'Tower: contacts inbound on the fleet — five jets, two missile boats. The Kestrel is counting on you.' },
      { who: 'gus', text: 'Deck here. I bolted extra flares on your rails myself. Bring my jet home, kid.' },
      { who: 'vega', text: 'Shield the carrier at all costs, Falcon-1. Nothing touches our ships while you fly.' }
    ],
    m4: [
      { who: 'vega', text: 'Night strike. Runway lights ahead, searchlights sweeping. Hit the depot and the mast, then come home.' },
      { who: 'mara', text: 'Tower: fuel is your enemy tonight, not just theirs. Watch the gauge — no heroics on empty tanks.' },
      { who: 'rook', text: 'Falcon-2 on station above the coast. I will call the searchlights before they find you.' }
    ],
    m5: [
      { who: 'mara', text: 'Tower: thunderstorm sitting right on the canyon route. Lightning, rain, rock walls. Fly it clean.' },
      { who: 'vega', text: 'Four patrol fighters in the canyon. They know the rocks better than you — so fly smarter, not faster.' },
      { who: 'rook', text: 'Stay low, stay centred, Falcon-1. Clip a wall out here and nobody finds the wreck.' }
    ],
    m6: [
      { who: 'ghost', text: 'So the little Falcon finally came to the fog. Eleven of your friends tried. Eleven fell. Come, then.' },
      { who: 'vega', text: 'That is GHOST. No markings, no fear, no mercy. Beat him and this war ends today, Falcon-1.' },
      { who: 'rook', text: 'Falcon-2 covering your six. You can do this — the whole squadron is watching your back.' }
    ]
  };

  function gradeFor(score, par, hullLeft) {
    if (score >= par * 1.15 && hullLeft >= 70) return 'S';
    if (score >= par) return 'A';
    if (score >= par * 0.7) return 'B';
    return 'C';
  }

  function baseStats() {
    return {
      credits: 600, missilesMax: 6, flaresMax: 6, hullMax: 100,
      fuelMax: 100, speedMul: 1, lockMul: 1, radarMul: 1, gunDmg: 12,
      upgrades: {}, unlocked: 1, best: {}, pilot: 'FALCON-1'
    };
  }

  window.RF_CONFIG = {
    PEOPLE: PEOPLE, UPGRADES: UPGRADES, WEATHER: WEATHER,
    MISSIONS: MISSIONS, DIALOGUE: DIALOGUE,
    gradeFor: gradeFor, baseStats: baseStats,
    W: 1280, H: 720
  };
})();
