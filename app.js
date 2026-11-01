/* Ground Zero — procedural NYC blast simulator.
   Static HTML/CSS/JS. Three.js r160 is loaded locally. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const deg = THREE.MathUtils.degToRad;
  const TAU = Math.PI * 2;
  const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
  const IS_SMALL = window.innerWidth < 760;
  const LOW_POWER = IS_TOUCH || IS_SMALL;
  const FONT_MONO = '"SFMono-Regular", "Cascadia Mono", "Roboto Mono", Menlo, monospace';

  // ---------------------------------------------------------------------------
  // Weapon data. Yields are in kilotons; the blast model scales from the
  // 15 kt Little Boy reference radii using cube-root blast scaling.
  // ---------------------------------------------------------------------------
  const NUKES = [
    { id: 'davy', name: 'Davy Crockett', yieldKt: 0.02, label: '0.02 kt', year: 1961 },
    { id: 'w54', name: 'W54 SADM', yieldKt: 1, label: '1 kt', year: 1964 },
    { id: 'w33', name: 'W33 Howitzer', yieldKt: 5, label: '5 kt', year: 1957 },
    { id: 'littleboy', name: 'Little Boy', yieldKt: 15, label: '15 kt', year: 1945 },
    { id: 'fatman', name: 'Fat Man', yieldKt: 21, label: '21 kt', year: 1945 },
    { id: 'w76', name: 'W76', yieldKt: 100, label: '100 kt', year: 1978 },
    { id: 'ivyking', name: 'Ivy King', yieldKt: 500, label: '500 kt', year: 1952 },
    { id: 'b83', name: 'B83', yieldKt: 1200, label: '1.2 Mt', year: 1983 },
    { id: 'ivymike', name: 'Ivy Mike', yieldKt: 10400, label: '10.4 Mt', year: 1952 },
    { id: 'castlebravo', name: 'Castle Bravo', yieldKt: 15000, label: '15 Mt', year: 1954 },
    { id: 'tsar', name: 'Tsar Bomba', yieldKt: 50000, label: '50 Mt', year: 1961 },
    { id: 'samboy', name: 'Sam Boy', yieldKt: 1000000, label: '1 Gt' }
  ];

  // Meteorite yields are kinetic-energy equivalents, so they share the blast
  // model with warheads but land as ground bursts and leave a crater.
  const METEORS = [
    { id: 'pallas', name: 'Pallas Pebble', yieldKt: 1, label: '1 kt', kind: 'meteor', core: 'stone' },
    { id: 'eros', name: 'Eros Shard', yieldKt: 5, label: '5 kt', kind: 'meteor', core: 'iron' },
    { id: 'apophis', name: 'Apophis Splinter', yieldKt: 25, label: '25 kt', kind: 'meteor', core: 'stone' },
    { id: 'tunguska', name: 'Tunguska Heir', yieldKt: 1000, label: '1 Mt', kind: 'meteor', core: 'ice' },
    { id: 'vredefort', name: 'Vredefort Strike', yieldKt: 10000, label: '10 Mt', kind: 'meteor', core: 'iron' },
    { id: 'chicxulub', name: 'Chicxulub Echo', yieldKt: 100000, label: '100 Mt', kind: 'meteor', core: 'stone' }
  ];

  const isMeteor = (weapon) => weapon.kind === 'meteor';

  function effectsFor(kt) {
    const scale = Math.cbrt(kt / 15);
    return {
      r20: 695 * scale,           // heavy blast damage, metres
      r5: 1716 * scale,           // medium blast damage, metres
      r1: 5349 * scale,           // light damage, metres
      thermal: 610 * Math.pow(kt, 0.438), // 3rd-degree thermal radius, metres
      fireball: 67.1 * Math.pow(kt, 0.4),
      hob: 707 * scale            // approximate optimum airburst height
    };
  }

  function effectsForImpact(kt) {
    const base = effectsFor(kt);
    const boost = 1.12; // a contact burst couples more energy into the ground
    return {
      ...base,
      hob: 0,
      r20: base.r20 * boost,
      r5: base.r5 * boost,
      r1: base.r1 * boost,
      thermal: base.thermal * 0.62,
      crater: clamp(base.r20 * 0.42, 30, 6000)
    };
  }

  function effectsForWeapon(weapon) {
    return isMeteor(weapon) ? effectsForImpact(weapon.yieldKt) : effectsFor(weapon.yieldKt);
  }

  let mode = 'nuke';
  const modeWeapons = {
    nuke: NUKES.find((n) => n.id === 'littleboy'),
    meteor: METEORS.find((m) => m.id === 'apophis')
  };
  let selectedWeapon = modeWeapons[mode];
  let selectedEffects = effectsForWeapon(selectedWeapon);

  function fmtYield(kt) {
    if (kt >= 1000000) {
      const gt = kt / 1000000;
      return `${Number.isInteger(gt) ? gt.toFixed(0) : gt.toFixed(1)} Gt`;
    }
    if (kt >= 1000) {
      const mt = kt / 1000;
      return `${Number.isInteger(mt) ? mt.toFixed(0) : mt.toFixed(1)} Mt`;
    }
    return `${Number.isInteger(kt) ? kt : Number(kt.toFixed(2))} kt`;
  }

  function fmtKm(m) {
    return m >= 10000 ? `${(m / 1000).toFixed(0)} km` : `${(m / 1000).toFixed(2)} km`;
  }

  function fmtMeters(m) {
    return `${Math.round(m).toLocaleString('en-US')} m`;
  }

  function fmtCrater(radius) {
    const d = radius * 2;
    return d >= 10000 ? `${(d / 1000).toFixed(0)} KM` : `${Math.round(d).toLocaleString('en-US')} M`;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // World layout, in metres. x = east, z = north.
  // ---------------------------------------------------------------------------
  const WORLD = { x0: -6400, x1: 7000, z0: -2800, z1: 15200 };
  const GRID_ANGLE = deg(18);
  const A = new THREE.Vector2(Math.sin(GRID_ANGLE), Math.cos(GRID_ANGLE)); // along avenues, north
  const B = new THREE.Vector2(Math.cos(GRID_ANGLE), -Math.sin(GRID_ANGLE)); // across avenues, east

  const MANHATTAN = [
    [-70, 0], [-160, 60], [-300, 150], [-450, 300], [-600, 500], [-720, 750],
    [-820, 1050], [-880, 1350], [-930, 1700], [-980, 2050], [-1050, 2450],
    [-1120, 2850], [-1200, 3300], [-1280, 3800], [-1380, 4400], [-1480, 5100],
    [-1580, 5800], [-1680, 6500], [-1760, 7200], [-1820, 7800], [-1870, 8500],
    [-1900, 9200], [-1920, 9900], [-1940, 10600], [-1950, 11300], [-1940, 12000],
    [-1920, 12700], [-1880, 13300], [-1830, 13800], [-1740, 14100], [-1600, 14250],
    [-1400, 14300], [-1200, 14250], [-1000, 14100], [-820, 13900], [-660, 13600],
    [-520, 13200], [-400, 12700], [-300, 12100], [-220, 11400], [-160, 10700],
    [-120, 10000], [-100, 9300], [-110, 8600], [-80, 8000], [0, 7800], [100, 7700],
    [200, 7800], [270, 8050], [300, 8400], [330, 8900], [380, 9400], [450, 9900],
    [500, 10400], [540, 10900], [560, 11400], [600, 11900], [680, 12350],
    [780, 12700], [900, 12950], [1040, 13050], [1170, 13000], [1270, 12800],
    [1320, 12500], [1330, 12100], [1320, 11600], [1320, 11000], [1340, 10400],
    [1370, 9800], [1390, 9200], [1400, 8600], [1400, 8000], [1380, 7400],
    [1350, 6800], [1320, 6200], [1290, 5600], [1250, 5000], [1200, 4400],
    [1150, 3800], [1100, 3200], [1050, 2600], [1000, 2100], [940, 1700],
    [850, 1300], [740, 1000], [620, 750], [500, 520], [380, 330], [250, 170],
    [140, 70], [60, 20], [0, -20]
  ];

  const BROOKLYN_QUEENS = [
    [1180, -2800], [1240, -1900], [1260, -900], [1350, -200], [1410, 500], [1490, 1200],
    [1600, 2000], [1730, 2800], [1880, 3700], [2010, 4600], [2140, 5500],
    [2260, 6500], [2400, 7500], [2560, 8500], [2750, 9500], [2980, 10500],
    [3250, 11400], [3540, 12200], [3900, 12900], [4300, 13500], [4700, 14000],
    [5200, 14350], [5900, 14520], [6600, 14500], [7000, 14400], [7000, -2800]
  ];

  const JERSEY = [
    [-2380, -2800], [-2440, -1900], [-2460, -700], [-2520, 100], [-2580, 900], [-2640, 1700],
    [-2710, 2500], [-2760, 3300], [-2810, 4200], [-2870, 5100], [-2920, 6000],
    [-2970, 6900], [-3020, 7800], [-3070, 8700], [-3130, 9600], [-3200, 10500],
    [-3280, 11400], [-3380, 12300], [-3500, 13200], [-4200, 14300], [-5000, 14900],
    [-5800, 15100], [-6400, 15000], [-6400, -2800]
  ];

  const BRONX = [
    [-800, 14400], [-600, 14900], [-200, 15150], [400, 15200], [1200, 15150],
    [2000, 15000], [2800, 14800], [3100, 14400], [2900, 14000], [2400, 13850],
    [1700, 13850], [1100, 14050], [500, 14200], [0, 14250], [-500, 14300]
  ];

  const STATEN_ISLAND = [
    [-2100, -1500], [-2000, -1950], [-1650, -2350], [-1150, -2650], [-600, -2700],
    [-150, -2450], [-20, -2050], [-180, -1650], [-700, -1400], [-1400, -1370]
  ];

  const ROOSEVELT = [
    [1660, 6100], [1760, 6000], [1930, 6100], [2020, 7400], [2000, 8600],
    [1890, 8850], [1770, 8580], [1690, 7400]
  ];

  const GOVERNORS = [
    [400, -980], [580, -1080], [810, -1020], [940, -850], [880, -620],
    [660, -520], [440, -650], [330, -830]
  ];

  const LIBERTY = [
    [-1740, -1250], [-1620, -1330], [-1480, -1270], [-1430, -1120],
    [-1510, -980], [-1680, -960], [-1800, -1090]
  ];

  const ELLIS = [
    [-1200, -980], [-1080, -1060], [-960, -1010], [-930, -860],
    [-1050, -770], [-1190, -820]
  ];

  const LAND_POLYS = [
    { id: 'manhattan', points: MANHATTAN, color: '#60615c' },
    { id: 'brooklyn', points: BROOKLYN_QUEENS, color: '#5a5c57' },
    { id: 'jersey', points: JERSEY, color: '#5c5e58' },
    { id: 'bronx', points: BRONX, color: '#5b5d57' },
    { id: 'staten', points: STATEN_ISLAND, color: '#5d6156' },
    { id: 'roosevelt', points: ROOSEVELT, color: '#5d5f58' },
    { id: 'governors', points: GOVERNORS, color: '#586152' },
    { id: 'liberty', points: LIBERTY, color: '#5a6157' },
    { id: 'ellis', points: ELLIS, color: '#5f5f58' }
  ];

  function pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1];
      const xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function inAnyLand(x, z) {
    return LAND_POLYS.some((p) => pointInPoly(x, z, p.points));
  }

  function localRect(cx, cz, halfAcross, halfAlong) {
    const p = [];
    const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sv, su] of signs) {
      p.push([
        cx + A.x * halfAlong * su + B.x * halfAcross * sv,
        cz + A.y * halfAlong * su + B.y * halfAcross * sv
      ]);
    }
    return p;
  }

  function localPoint(cx, cz, across, along) {
    return [cx + B.x * across + A.x * along, cz + B.y * across + A.y * along];
  }

  const PARK_AREAS = [
    { id: 'central', name: 'Central Park', poly: localRect(0, 9500, 390, 1980), trees: LOW_POWER ? 300 : 620, park: true, lakes: [[110, 9440, 165, 95], [-140, 10020, 105, 70]] },
    { id: 'battery', name: 'Battery Park', poly: localRect(-20, 310, 130, 160), trees: 52, park: true },
    { id: 'cityhall', name: 'City Hall Park', poly: localRect(-250, 1820, 120, 150), trees: 28, park: true },
    { id: 'washington', name: 'Washington Square', poly: localRect(-170, 3970, 120, 130), trees: 22, park: true },
    { id: 'union', name: 'Union Square', poly: localRect(-260, 4660, 95, 120), trees: 18, park: true },
    { id: 'madison', name: 'Madison Square', poly: localRect(-270, 5330, 95, 110), trees: 16, park: true },
    { id: 'bryant', name: 'Bryant Park', poly: localRect(-440, 6180, 120, 80), trees: 18, park: true },
    { id: 'tompkins', name: 'Tompkins Square', poly: localRect(570, 4760, 115, 140), trees: 20, park: true },
    { id: 'riverside', name: 'Riverside Park', poly: [
      [-1585, 5700], [-1680, 6500], [-1770, 7300], [-1830, 8000], [-1880, 8700],
      [-1910, 9400], [-1930, 10100], [-1955, 10800], [-1960, 11400], [-1820, 11420],
      [-1800, 10800], [-1780, 10100], [-1758, 9400], [-1725, 8700], [-1660, 8000],
      [-1595, 7300], [-1495, 6500], [-1400, 5700]
    ], trees: 125, park: true },
    { id: 'highline', name: 'The High Line', poly: localRect(-1360, 6000, 31, 490), trees: 16, park: true },
    { id: 'prospect', name: 'Prospect Park', poly: localRect(3850, 4050, 580, 950), trees: 175, park: true, lakes: [[3870, 4020, 175, 100]] },
    { id: 'bbp', name: 'Brooklyn Bridge Park', poly: localRect(1900, 2020, 118, 410), trees: 45, park: true },
    { id: 'fortgreene', name: 'Fort Greene Park', poly: localRect(2690, 3350, 170, 190), trees: 34, park: true },
    { id: 'mccarren', name: 'McCarren Park', poly: localRect(3100, 5500, 210, 150), trees: 32, park: true },
    { id: 'libertystate', name: 'Liberty State Park', poly: localRect(-3350, 1000, 500, 520), trees: 92, park: true },
    { id: 'hoboken', name: 'Pier A Park', poly: localRect(-2890, 4200, 100, 235), trees: 26, park: true },
    // Woodland ringing the city, on the land added beyond the old shoreline.
    { id: 'jamaica', name: 'Jamaica Bay Greenbelt', poly: localRect(4300, -1150, 950, 620), trees: LOW_POWER ? 120 : 240, park: true },
    { id: 'kissena', name: 'Kissena Woods', poly: localRect(5850, 9600, 560, 820), trees: LOW_POWER ? 95 : 185, park: true },
    { id: 'cunningham', name: 'Cunningham Park', poly: localRect(5250, 13300, 720, 380), trees: LOW_POWER ? 80 : 155, park: true },
    { id: 'vancortlandt', name: 'Van Cortlandt Park', poly: localRect(1450, 14650, 1050, 330), trees: LOW_POWER ? 110 : 215, park: true },
    { id: 'palisades', name: 'The Palisades', poly: localRect(-5150, 10800, 480, 1250), trees: LOW_POWER ? 115 : 225, park: true },
    { id: 'greenbelt', name: 'Staten Island Greenbelt', poly: localRect(-1150, -2050, 620, 420), trees: LOW_POWER ? 105 : 205, park: true }
  ];

  const STREET_GRID = { avenue: 220, street: 80 };

  // ---------------------------------------------------------------------------
  // UI / state references
  // ---------------------------------------------------------------------------
  const state = {
    phase: 'idle', // idle | alert | falling | blast | aftermath
    target: null,
    targetOnLand: false,
    blastStart: 0,
    reportStart: 0,
    weapon: selectedWeapon,
    effects: selectedEffects,
    destroyed: 0,
    landmarksDestroyed: 0,
    bridgesDamaged: 0,
    totalStructures: 0,
    pending: [],
    pendingIndex: 0,
    collapsers: [],
    landCollapsers: [],
    fallingBridges: [],
    activeTimers: [],
    audioEnabled: true,
    resetting: false
  };

  const dom = {
    canvas: $('#scene'),
    loading: $('#loading'),
    unsupported: $('#unsupported'),
    flash: $('#flash'),
    select: $('#nukeSelect'),
    meteorSelect: $('#meteorSelect'),
    weaponLabel: $('#weaponLabel'),
    yieldBadge: $('#yieldBadge'),
    weaponMeta: $('#weaponMeta'),
    modeNuke: $('#modeNuke'),
    modeMeteor: $('#modeMeteor'),
    status: $('#status'),
    statusLabel: $('#statusLabel'),
    statusDetail: $('#statusDetail'),
    report: $('#report'),
    reportTime: $('#reportTime'),
    reportNuke: $('#reportNuke'),
    reportYield: $('#reportYield'),
    reportHob: $('#reportHob'),
    reportDestroyed: $('#reportDestroyed'),
    legend20: $('#legend20'),
    legend5: $('#legend5'),
    legendThermal: $('#legendThermal'),
    legend1: $('#legend1'),
    hint: $('#hint'),
    hintText: $('#hintText'),
    altimeter: $('#altimeter'),
    altitude: $('#altitude'),
    altLabel: $('#altLabel'),
    resetBtn: $('#resetBtn'),
    soundBtn: $('#soundBtn')
  };

  // ---------------------------------------------------------------------------
  // Renderer, scene, lights, camera
  // ---------------------------------------------------------------------------
  let renderer, scene, camera, sunLight, hemisphere, water, waterUniforms;
  let skyMesh = null;
  let terrainMesh;
  let cityRoot = null;
  let effectsRoot = null;
  let targetRoot = null;
  let bombRoot = null;

  let mapTexture = null;
  let mapCanvas = null;

  const clock = new THREE.Clock();
  let elapsed = 0;
  let frameDt = 0;
  let timeScale = 1;
  let rafId = 0;
  let resizeQueued = false;

  const cameraRig = {
    target: new THREE.Vector3(150, 0, 3900),
    targetY: 120,
    distance: IS_SMALL ? 9800 : 8400,
    azimuth: 2.40,
    pitch: IS_SMALL ? 0.36 : 0.31,
    minDistance: 300,
    maxDistance: 120000,
    tween: null,
    shake: 0,
    shakeSeed: 0
  };

  const DEFAULT_CAMERA = {
    tx: 150,
    tz: 3900,
    ty: 120,
    distance: IS_SMALL ? 9800 : 8400,
    azimuth: 2.40,
    pitch: IS_SMALL ? 0.36 : 0.31
  };

  function initThree() {
    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: !LOW_POWER,
      powerPreference: 'high-performance',
      alpha: false,
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !LOW_POWER;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x93aebf, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb8ced9, 0.000040);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 8, 200000);

    skyMesh = makeSky();
    scene.add(skyMesh);

    hemisphere = new THREE.HemisphereLight(0xbfd8e8, 0x5a5445, LOW_POWER ? 1.55 : 1.75);
    scene.add(hemisphere);

    sunLight = new THREE.DirectionalLight(0xfff1d3, LOW_POWER ? 2.4 : 2.9);
    sunLight.position.set(-7200, 11000, 4200);
    sunLight.target.position.set(0, 0, 6200);
    if (!LOW_POWER) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.left = -8200;
      sunLight.shadow.camera.right = 8200;
      sunLight.shadow.camera.top = 8400;
      sunLight.shadow.camera.bottom = -8400;
      sunLight.shadow.camera.near = 1000;
      sunLight.shadow.camera.far = 26000;
      sunLight.shadow.bias = -0.0004;
      sunLight.shadow.normalBias = 0.8;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);

    const fill = new THREE.DirectionalLight(0x8cb5ca, 0.32);
    fill.position.set(6500, 3200, -4200);
    scene.add(fill);

    waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x143c4c) },
      uShallow: { value: new THREE.Color(0x2a6072) },
      uSky: { value: new THREE.Color(0xb4cfda) },
      uSun: { value: new THREE.Color(0xffe5ac) }
    };
    water = makeWater();
    scene.add(water);

    createClouds();

    effectsRoot = new THREE.Group();
    effectsRoot.name = 'effects';
    scene.add(effectsRoot);
    targetRoot = new THREE.Group();
    targetRoot.name = 'target';
    scene.add(targetRoot);
    bombRoot = new THREE.Group();
    bombRoot.name = 'bomb';
    scene.add(bombRoot);

    applyCamera();
    renderer.render(scene, camera);

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
  }

  function makeSky() {
    const geo = new THREE.SphereGeometry(150000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x3d77b0) },
        uMid: { value: new THREE.Color(0x91b9d4) },
        uHorizon: { value: new THREE.Color(0xd8e4e8) },
        uSunDir: { value: new THREE.Vector3(-0.44, 0.55, 0.28).normalize() }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        void main() {
          float h = clamp(vDir.y * 0.84 + 0.18, 0.0, 1.0);
          vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.46, h));
          color = mix(color, uTop, smoothstep(0.36, 0.92, h));
          float sun = max(dot(vDir, uSunDir), 0.0);
          color += vec3(1.0, 0.82, 0.55) * pow(sun, 520.0) * 1.2;
          color += vec3(1.0, 0.88, 0.68) * pow(sun, 12.0) * 0.045;
          float horizonHaze = exp(-abs(vDir.y) * 10.0) * 0.08;
          color += vec3(0.85, 0.82, 0.72) * horizonHaze;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    return new THREE.Mesh(geo, mat);
  }

  function makeWater() {
    const geo = new THREE.PlaneGeometry(170000, 170000, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: false,
      depthWrite: true,
      uniforms: waterUniforms,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        varying vec3 vWorld;
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSky;
        uniform vec3 uSun;
        void main() {
          vec3 view = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 2.3);
          float waveA = sin(vWorld.x * 0.0062 + vWorld.z * 0.0041 + uTime * 0.25);
          float waveB = sin(vWorld.x * -0.0037 + vWorld.z * 0.0092 - uTime * 0.18);
          float wave = (waveA + waveB) * 0.5;
          vec3 color = mix(uDeep, uShallow, 0.34 + wave * 0.055);
          color = mix(color, uSky, fres * 0.63);
          float glint = pow(max(0.0, wave * 0.5 + 0.5), 22.0) * pow(fres, 1.1);
          color += uSun * glint * 0.2;
          float distanceToCam = length(cameraPosition - vWorld);
          float haze = 1.0 - exp(-pow(distanceToCam * 0.000012, 1.8));
          color = mix(color, vec3(0.55, 0.67, 0.74), haze * 0.72);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(200, -7, 6400);
    mesh.receiveShadow = false;
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // Sparse cloud layer, sitting at typical cumulus altitude
  // ---------------------------------------------------------------------------
  let cloudGroup = null;
  const cloudPuffs = [];

  function makeCloudTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const rng = mulberry32(3311);
    if (ctx.filter !== undefined) ctx.filter = `blur(${Math.round(size * 0.055)}px)`;
    // Few, wide, overlapping lobes so the puff reads as one soft mass at any
    // distance rather than a scatter of separate dots.
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU;
      const d = Math.pow(rng(), 0.55) * size * 0.19;
      const x = size / 2 + Math.cos(a) * d;
      const y = size / 2 + Math.sin(a) * d * 0.55;
      const r = size * (0.24 + rng() * 0.16);
      const alpha = 0.2 + rng() * 0.16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(250,253,255,${(alpha * 0.72).toFixed(3)})`);
      g.addColorStop(0.78, `rgba(240,246,251,${(alpha * 0.3).toFixed(3)})`);
      g.addColorStop(1, 'rgba(238,245,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.filter = 'none';
    // Fade the rim so individual sprites never show their square bounds.
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.52, 'rgba(0,0,0,0.88)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createClouds() {
    const rng = mulberry32(60613);
    const tex = makeCloudTexture();
    cloudGroup = new THREE.Group();
    cloudGroup.name = 'clouds';
    scene.add(cloudGroup);

    const tints = [0xffffff, 0xf4f8fd, 0xe4ecf5, 0xfff2df, 0xeff3f2];
    const clusters = LOW_POWER ? 12 : 22;
    for (let i = 0; i < clusters; i++) {
      // Far out and high, so the layer reads as horizon cloud rather than
      // something floating over (and speckling) the city below.
      const ang = rng() * TAU;
      const dist = 10500 + Math.pow(rng(), 0.8) * 9500;
      const cx = 200 + Math.cos(ang) * dist;
      const cz = 6200 + Math.sin(ang) * dist;
      const cy = 1750 + rng() * 1150;
      const tint = tints[Math.floor(rng() * tints.length)];
      const base = 0.42 + rng() * 0.22;
      const drift = 5 + rng() * 9;
      const puffs = 6 + Math.floor(rng() * 5);
      const spread = 900 + rng() * 1600;
      for (let p = 0; p < puffs; p++) {
        const mat = new THREE.SpriteMaterial({
          map: tex, color: tint, transparent: true,
          opacity: base * (0.55 + rng() * 0.7),
          depthWrite: false, fog: true
        });
        const sprite = new THREE.Sprite(mat);
        const w = 2100 + rng() * 2600;
        sprite.scale.set(w, w * (0.42 + rng() * 0.22), 1);
        sprite.position.set(
          cx + (rng() - 0.5) * spread * 1.4,
          cy + (rng() - 0.5) * 320,
          cz + (rng() - 0.5) * spread
        );
        cloudGroup.add(sprite);
        cloudPuffs.push({ sprite, drift });
      }
    }
  }

  function updateClouds(dt) {
    if (!cloudPuffs.length) return;
    for (const c of cloudPuffs) {
      const s = c.sprite;
      s.position.x += c.drift * dt;
      if (s.position.x > 13500) s.position.x -= 27000;
    }
  }

  function applyCamera() {
    const cp = Math.cos(cameraRig.pitch);
    const sp = Math.sin(cameraRig.pitch);
    const t = cameraRig.target;
    camera.position.set(
      t.x + Math.sin(cameraRig.azimuth) * cp * cameraRig.distance,
      cameraRig.targetY + sp * cameraRig.distance,
      t.z + Math.cos(cameraRig.azimuth) * cp * cameraRig.distance
    );
    camera.lookAt(t.x, cameraRig.targetY, t.z);
    if (skyMesh) skyMesh.position.copy(camera.position);
    if (scene.fog) {
      scene.fog.density = 0.00004 * clamp(9000 / Math.max(2000, cameraRig.distance), 0.08, 1);
    }
    if (cameraRig.shake > 0.001) {
      const s = cameraRig.shake * cameraRig.distance * 0.0018;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s * 0.7;
      camera.position.z += (Math.random() - 0.5) * s;
      camera.rotation.z += (Math.random() - 0.5) * cameraRig.shake * 0.008;
    }
  }

  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      updateParticleScale();
    });
  }

  // ---------------------------------------------------------------------------
  // Ground map: coasts, streets, parks, piers and plazas drawn to one texture.
  // ---------------------------------------------------------------------------
  function makeGroundTexture() {
    const spanX = WORLD.x1 - WORLD.x0;
    const spanZ = WORLD.z1 - WORLD.z0;
    const pxPerM = LOW_POWER ? 0.13 : 0.215;
    const W = Math.round(spanX * pxPerM);
    const H = Math.round(spanZ * pxPerM);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const sx = W / spanX;
    const sz = H / spanZ;
    const px = (x) => (x - WORLD.x0) * sx;
    const py = (z) => (WORLD.z1 - z) * sz;
    const scale = Math.min(sx, sz);

    const pathFor = (points) => {
      const p = new Path2D();
      p.moveTo(px(points[0][0]), py(points[0][1]));
      for (let i = 1; i < points.length; i++) p.lineTo(px(points[i][0]), py(points[i][1]));
      p.closePath();
      return p;
    };

    ctx.clearRect(0, 0, W, H);
    const landPaths = {};
    for (const land of LAND_POLYS) {
      landPaths[land.id] = pathFor(land.points);
      ctx.fillStyle = land.color;
      ctx.fill(landPaths[land.id]);
      ctx.strokeStyle = 'rgba(215, 206, 183, 0.62)';
      ctx.lineWidth = Math.max(1.1, 2.6 * scale);
      ctx.stroke(landPaths[land.id]);
    }

    // Waterfront edge treatment.
    ctx.save();
    for (const land of LAND_POLYS) {
      ctx.clip(landPaths[land.id]);
      ctx.strokeStyle = 'rgba(47, 47, 43, 0.2)';
      ctx.lineWidth = 14 * scale;
      ctx.stroke(landPaths[land.id]);
      ctx.restore();
      ctx.save();
    }
    ctx.restore();

    // Subtle block-to-block tonal variation so the boroughs don't read as flat slabs.
    const blockRng = mulberry32(7741);
    ctx.save();
    for (const land of LAND_POLYS) {
      const b = polygonBounds(land.points);
      for (let x = b.x0; x < b.x1; x += 78) {
        for (let z = b.z0; z < b.z1; z += 52) {
          if (blockRng() > 0.42) continue;
          if (!pointInPoly(x + 39, z + 26, land.points)) continue;
          const shade = blockRng();
          ctx.fillStyle = shade > 0.5
            ? `rgba(232, 228, 212, ${0.015 + blockRng() * 0.035})`
            : `rgba(16, 19, 19, ${0.02 + blockRng() * 0.05})`;
          ctx.fillRect(px(x), py(z + 52), 78 * scale, 52 * scale);
        }
      }
    }
    ctx.restore();

    drawManhattanStreets(ctx, px, py, scale, landPaths.manhattan);
    drawBrooklynStreets(ctx, px, py, scale, landPaths.brooklyn);
    drawJerseyStreets(ctx, px, py, scale, landPaths.jersey);
    drawBoroughStreets(ctx, px, py, scale, landPaths.bronx, {
      x0: -900, x1: 3100, z0: 13800, z1: 15300,
      stepX: 175, stepZ: 150, skewX: 260, skewZ: 130,
      road: [[-600, 14000], [400, 14300], [1500, 14700], [2700, 15000]]
    });
    drawBoroughStreets(ctx, px, py, scale, landPaths.staten, {
      x0: -2200, x1: 100, z0: -2800, z1: -1300,
      stepX: 190, stepZ: 155, skewX: -180, skewZ: 150,
      road: [[-2000, -1600], [-1200, -2000], [-300, -2400]]
    });
    drawRooseveltStreets(ctx, px, py, scale, landPaths.roosevelt);
    drawParks(ctx, px, py, scale);
    drawLandmarkPlazas(ctx, px, py, scale);
    drawShoreHighways(ctx, px, py, scale, landPaths.manhattan);

    // Keep all street/park paint inside the coastlines, then add piers over water.
    const allLand = new Path2D();
    for (const land of LAND_POLYS) allLand.addPath(landPaths[land.id]);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#fff';
    ctx.fill(allLand);
    ctx.restore();
    drawPiers(ctx, px, py, scale);

    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    mapCanvas = canvas;
    return tex;
  }

  function lineWorld(ctx, x1, z1, x2, z2, px, py) {
    ctx.moveTo(px(x1), py(z1));
    ctx.lineTo(px(x2), py(z2));
  }

  function addPolyLine(ctx, path, px, py, points) {
    if (!points.length) return;
    path.moveTo(px(points[0][0]), py(points[0][1]));
    for (let i = 1; i < points.length; i++) path.lineTo(px(points[i][0]), py(points[i][1]));
  }

  function drawManhattanStreets(ctx, px, py, scale, clipPath) {
    const minor = new Path2D();
    const avenues = new Path2D();
    const majors = new Path2D();

    const long = 18000;
    let avIdx = 0;
    for (let v = -6800; v <= 6800; v += STREET_GRID.avenue) {
      const target = avIdx % 4 === 0 ? majors : avenues;
      for (let u = -4000; u <= long; u += 260) {
        const p1 = [A.x * u + B.x * v, A.y * u + B.y * v];
        const p2 = [A.x * (u + 260) + B.x * v, A.y * (u + 260) + B.y * v];
        lineWorld(target, p1[0], p1[1], p2[0], p2[1], px, py);
      }
      avIdx++;
    }

    for (let u = -3000; u <= 15000; u += STREET_GRID.street) {
      for (let v = -7000; v <= 7000; v += 280) {
        const p1 = [A.x * u + B.x * v, A.y * u + B.y * v];
        const p2 = [A.x * u + B.x * (v + 280), A.y * u + B.y * (v + 280)];
        lineWorld(minor, p1[0], p1[1], p2[0], p2[1], px, py);
      }
    }

    ctx.save();
    ctx.clip(clipPath);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(25, 31, 32, 0.72)';
    ctx.lineWidth = Math.max(1.05, 1.45 * scale);
    ctx.stroke(minor);
    ctx.strokeStyle = 'rgba(34, 39, 40, 0.93)';
    ctx.lineWidth = Math.max(1.55, 2.2 * scale);
    ctx.stroke(avenues);
    ctx.strokeStyle = 'rgba(45, 49, 48, 0.98)';
    ctx.lineWidth = Math.max(2.1, 3.2 * scale);
    ctx.stroke(majors);

    // Broadway cuts across the Commissioner grid.
    const broadway = [
      [30, -10], [-40, 260], [-135, 600], [-220, 980], [-245, 1350],
      [-210, 1750], [-110, 2300], [15, 2920], [120, 3450], [90, 3880],
      [-110, 4380], [-240, 4860], [-360, 5340], [-540, 5890], [-760, 6380],
      [-850, 6880], [-900, 7500], [-960, 8040]
    ];
    const bw = new Path2D();
    addPolyLine(ctx, bw, px, py, broadway);
    ctx.strokeStyle = 'rgba(39, 44, 44, 0.92)';
    ctx.lineWidth = Math.max(2.5, 5.0 * scale);
    ctx.stroke(bw);
    ctx.strokeStyle = 'rgba(92, 90, 78, 0.34)';
    ctx.lineWidth = Math.max(0.6, 0.9 * scale);
    ctx.stroke(bw);

    // A little irregular old-town grain at the bottom of the island.
    ctx.strokeStyle = 'rgba(33, 38, 39, 0.63)';
    ctx.lineWidth = Math.max(0.7, 1.05 * scale);
    for (let i = 0; i < 28; i++) {
      const z1 = 60 + i * 70;
      const x1 = -500 + Math.sin(i * 2.31) * 240;
      const x2 = 760 + Math.cos(i * 1.77) * 150;
      const z2 = z1 + 110 + (i % 3) * 30;
      ctx.beginPath();
      lineWorld(ctx, x1, z1, x2, z2, px, py);
      ctx.stroke();
    }
    ctx.restore();

    // Major bridge approach roads.
    ctx.save();
    ctx.clip(clipPath);
    const approaches = [
      [[620, 1940], [710, 2020], [760, 2090]],
      [[620, 2450], [700, 2520], [730, 2580]],
      [[860, 4380], [900, 4440], [920, 4490]],
      [[1050, 7740], [1110, 7790], [1120, 7830]]
    ];
    ctx.strokeStyle = 'rgba(48, 52, 51, 0.9)';
    ctx.lineWidth = Math.max(2, 3.6 * scale);
    for (const seg of approaches) {
      const path = new Path2D();
      addPolyLine(ctx, path, px, py, seg);
      ctx.stroke(path);
    }
    ctx.restore();
  }

  function drawBrooklynStreets(ctx, px, py, scale, clipPath) {
    ctx.save();
    ctx.clip(clipPath);
    ctx.lineCap = 'butt';

    ctx.strokeStyle = 'rgba(37, 42, 42, 0.54)';
    ctx.lineWidth = Math.max(0.75, 1.1 * scale);
    for (let x = 1400; x < 6900; x += 170) {
      ctx.beginPath();
      lineWorld(ctx, x, -2600, x + 500, 14400, px, py);
      ctx.stroke();
    }
    for (let z = -2600; z < 14400; z += 150) {
      ctx.beginPath();
      lineWorld(ctx, 1200, z, 6900, z - 160, px, py);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(48, 51, 48, 0.8)';
    ctx.lineWidth = Math.max(1.5, 2.7 * scale);
    const roads = [
      [[1700, 1750], [1600, 3000], [1750, 4400], [1950, 6100], [2200, 8300], [2550, 10400]],
      [[1500, 3200], [2400, 3300], [3150, 3250], [3900, 3200]],
      [[2100, 1800], [2800, 2200], [3600, 2700], [4400, 3100]],
      [[2350, 8000], [3200, 7600], [4100, 7300], [5000, 7100]]
    ];
    for (const road of roads) {
      const path = new Path2D();
      addPolyLine(ctx, path, px, py, road);
      ctx.stroke(path);
    }

    // BQE.
    const bqe = [
      [1950, 900], [2050, 1900], [2200, 2800], [2250, 3600], [2400, 4300],
      [2700, 5200], [3000, 6200], [3450, 7200], [3900, 8100], [4300, 9000]
    ];
    const bqePath = new Path2D();
    addPolyLine(ctx, bqePath, px, py, bqe);
    ctx.strokeStyle = 'rgba(66, 67, 61, 0.9)';
    ctx.lineWidth = Math.max(2.2, 4.2 * scale);
    ctx.stroke(bqePath);
    ctx.strokeStyle = 'rgba(85, 85, 76, 0.6)';
    ctx.lineWidth = Math.max(0.8, 1.2 * scale);
    ctx.stroke(bqePath);
    ctx.restore();
  }

  function drawJerseyStreets(ctx, px, py, scale, clipPath) {
    ctx.save();
    ctx.clip(clipPath);
    ctx.strokeStyle = 'rgba(38, 42, 42, 0.52)';
    ctx.lineWidth = Math.max(0.7, 1.05 * scale);
    for (let x = -6300; x < -2300; x += 180) {
      ctx.beginPath();
      lineWorld(ctx, x, -2700, x - 240, 14900, px, py);
      ctx.stroke();
    }
    for (let z = -2700; z < 14900; z += 145) {
      ctx.beginPath();
      lineWorld(ctx, -6400, z, -2300, z + 120, px, py);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60, 61, 55, 0.8)';
    ctx.lineWidth = Math.max(1.6, 2.8 * scale);
    const turnpike = [[-5060, -500], [-4600, 1800], [-4100, 4100], [-3650, 6500], [-3450, 9200], [-3380, 12800]];
    const p = new Path2D();
    addPolyLine(ctx, p, px, py, turnpike);
    ctx.stroke(p);
    ctx.restore();
  }

  function drawBoroughStreets(ctx, px, py, scale, clipPath, grid) {
    ctx.save();
    ctx.clip(clipPath);
    ctx.strokeStyle = 'rgba(40, 44, 43, 0.5)';
    ctx.lineWidth = Math.max(0.7, 1.05 * scale);
    for (let x = grid.x0; x <= grid.x1; x += grid.stepX) {
      ctx.beginPath();
      lineWorld(ctx, x, grid.z0, x + grid.skewX, grid.z1, px, py);
      ctx.stroke();
    }
    for (let z = grid.z0; z <= grid.z1; z += grid.stepZ) {
      ctx.beginPath();
      lineWorld(ctx, grid.x0, z, grid.x1, z + grid.skewZ, px, py);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(54, 56, 51, 0.78)';
    ctx.lineWidth = Math.max(1.5, 2.6 * scale);
    const p = new Path2D();
    addPolyLine(ctx, p, px, py, grid.road);
    ctx.stroke(p);
    ctx.restore();
  }

  function drawRooseveltStreets(ctx, px, py, scale, clipPath) {
    ctx.save();
    ctx.clip(clipPath);
    ctx.strokeStyle = 'rgba(43, 47, 46, 0.6)';
    ctx.lineWidth = Math.max(1.2, 2.2 * scale);
    ctx.beginPath();
    lineWorld(ctx, 1810, 6200, 1920, 8600, px, py);
    ctx.stroke();
    ctx.restore();
  }

  function drawPiers(ctx, px, py, scale) {
    const piers = [
      // Manhattan, east river
      [1020, 480, 180, 34], [1040, 760, 210, 40], [1060, 1200, 250, 48],
      [1060, 1500, 230, 42], [1000, 1780, 180, 36], [960, 2250, 225, 42],
      [1040, 3020, 170, 36], [1120, 5480, 185, 38], [1260, 6620, 190, 34],
      [1390, 8750, 150, 28],
      // Manhattan, Hudson
      [-800, 1020, -170, 34], [-920, 1520, -190, 38], [-1080, 2520, -180, 36],
      [-1280, 3900, -210, 44], [-1480, 5450, -185, 38], [-1660, 7070, -130, 32],
      // Brooklyn
      [1720, 1750, 170, 34], [1810, 1980, 220, 45], [1920, 2180, 190, 38],
      [2100, 6900, 150, 30], [2310, 7800, 140, 26]
    ];
    for (const [x, z, len, width] of piers) {
      ctx.save();
      ctx.translate(px(x), py(z));
      ctx.fillStyle = '#4c4f4b';
      ctx.strokeStyle = 'rgba(28, 32, 32, 0.7)';
      ctx.lineWidth = Math.max(0.7, 1.2 * scale);
      const w = Math.abs(len) * scale;
      const h = Math.max(3, width * scale);
      if (len < 0) {
        ctx.fillRect(-w, -h / 2, w, h);
        ctx.strokeRect(-w, -h / 2, w, h);
      } else {
        ctx.fillRect(0, -h / 2, w, h);
        ctx.strokeRect(0, -h / 2, w, h);
      }
      ctx.restore();
    }
  }

  function drawParks(ctx, px, py, scale) {
    for (const park of PARK_AREAS) {
      const path = new Path2D();
      addPolyLine(ctx, path, px, py, park.poly);
      path.closePath();
      ctx.fillStyle = park.id === 'central' ? '#43573c' : '#475c40';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(31, 45, 31, 0.38)';
      ctx.lineWidth = Math.max(0.8, 1.4 * scale);
      ctx.stroke(path);

      ctx.save();
      ctx.clip(path);
      // Park paths.
      ctx.strokeStyle = 'rgba(192, 184, 157, 0.34)';
      ctx.lineWidth = Math.max(0.7, 1.1 * scale);
      const bounds = polygonBounds(park.poly);
      for (let i = 0; i < 9; i++) {
        const z = lerp(bounds.z0, bounds.z1, (i + 1) / 10);
        ctx.beginPath();
        ctx.moveTo(px(bounds.x0), py(z + Math.sin(i * 1.7) * 45));
        ctx.bezierCurveTo(
          px(lerp(bounds.x0, bounds.x1, 0.3)), py(z + Math.cos(i) * 95),
          px(lerp(bounds.x0, bounds.x1, 0.72)), py(z - 70),
          px(bounds.x1), py(z + Math.sin(i * 2.3) * 45)
        );
        ctx.stroke();
      }
      if (park.lakes) {
        for (const [lx, lz, lw, lh] of park.lakes) {
          ctx.beginPath();
          ctx.ellipse(px(lx), py(lz), lw * scale, lh * scale, -GRID_ANGLE, 0, TAU);
          ctx.fillStyle = '#2d5260';
          ctx.fill();
          ctx.strokeStyle = 'rgba(180, 202, 192, 0.22)';
          ctx.lineWidth = Math.max(0.6, 1.1 * scale);
          ctx.stroke();
        }
      }
      // Stippled tree canopy in the parks.
      const rng = mulberry32(park.id.length * 913 + 44);
      const treeDots = LOW_POWER ? 90 : 170;
      for (let i = 0; i < treeDots; i++) {
        const x = lerp(bounds.x0, bounds.x1, rng());
        const z = lerp(bounds.z0, bounds.z1, rng());
        if (!pointInPoly(x, z, park.poly)) continue;
        ctx.fillStyle = i % 4 === 0 ? 'rgba(24, 42, 26, 0.72)' : 'rgba(30, 52, 31, 0.55)';
        const r = (3 + rng() * 5) * scale;
        ctx.beginPath();
        ctx.arc(px(x), py(z), r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawLandmarkPlazas(ctx, px, py, scale) {
    const plazas = [
      [-500, 1120, 230, 240], [-250, 1850, 150, 170], [-500, 6180, 150, 120],
      [360, 6250, 150, 130], [-300, 6360, 170, 130], [-800, 7780, 300, 120],
      [-1450, 6960, 260, 190], [2500, 2700, 200, 180]
    ];
    ctx.save();
    for (const [x, z, w, d] of plazas) {
      ctx.fillStyle = 'rgba(126, 123, 113, 0.3)';
      ctx.fillRect(px(x - w / 2), py(z + d / 2), w * scale, d * scale);
    }
    ctx.restore();
  }

  function drawShoreHighways(ctx, px, py, scale, clipPath) {
    ctx.save();
    ctx.clip(clipPath);
    const fdr = [
      [800, 180], [780, 500], [720, 900], [850, 1300], [900, 1700],
      [880, 2200], [970, 3000], [1080, 3800], [1160, 4600], [1210, 5500],
      [1290, 6500], [1340, 7600], [1360, 8600], [1340, 9700], [1310, 11000]
    ];
    const westSide = [
      [-470, 380], [-620, 800], [-760, 1300], [-850, 1800], [-930, 2500],
      [-1070, 3300], [-1190, 4100], [-1300, 5000], [-1450, 5900], [-1620, 6800],
      [-1730, 7800], [-1800, 8900], [-1870, 10200], [-1880, 11600]
    ];
    for (const [road, width] of [[fdr, 3.5], [westSide, 3.3]]) {
      const p = new Path2D();
      addPolyLine(ctx, p, px, py, road);
      ctx.strokeStyle = 'rgba(78, 78, 70, 0.9)';
      ctx.lineWidth = Math.max(2.2, width * scale);
      ctx.stroke(p);
      ctx.strokeStyle = 'rgba(110, 108, 94, 0.45)';
      ctx.lineWidth = Math.max(0.7, 0.9 * scale);
      ctx.stroke(p);
    }
    ctx.restore();
  }

  function polygonBounds(poly) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    return { x0, x1, z0, z1 };
  }

  function makeTerrain() {
    const geo = new THREE.PlaneGeometry(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0);
    mapTexture = makeGroundTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: mapTexture,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.91,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    terrainMesh = mesh;
    scene.add(mesh);
  }


  // ---------------------------------------------------------------------------
  // Materials and instanced tower system
  // ---------------------------------------------------------------------------
  const MATS = {};
  const SHARED_MATERIALS = new Set();
  const BUILDING_TYPES = {
    glass: {
      rough: 0.28, metal: 0.38, winW: 2.8, floorH: 4.2,
      winX: 0.045, winY: 0.11, glass: 0x6f97a8, strength: 0.98,
      palette: [0x8fa6b3, 0x7b96a5, 0x9db1ba, 0x6f8794, 0xaab8bc, 0x587181, 0x93a8b0]
    },
    stone: {
      rough: 0.8, metal: 0.04, winW: 2.5, floorH: 3.7,
      winX: 0.26, winY: 0.31, glass: 0x3f5664, strength: 0.78,
      palette: [0xb9ad97, 0xa79a86, 0xc4b8a2, 0x9b8f7d, 0xb0a58f, 0x8d8375]
    },
    brick: {
      rough: 0.93, metal: 0.01, winW: 2.25, floorH: 3.25,
      winX: 0.32, winY: 0.35, glass: 0x354754, strength: 0.83,
      palette: [0x925e4a, 0x7f4f3e, 0xa06c55, 0x724536, 0x8a5745, 0xb07b61]
    },
    concrete: {
      rough: 0.9, metal: 0.02, winW: 2.65, floorH: 3.5,
      winX: 0.22, winY: 0.3, glass: 0x3b4b53, strength: 0.74,
      palette: [0xa8a59a, 0xb5b1a6, 0x96948b, 0xc3beb2, 0x8b8b83]
    },
    dark: {
      rough: 0.46, metal: 0.27, winW: 3.1, floorH: 4.0,
      winX: 0.1, winY: 0.17, glass: 0x324c5d, strength: 0.93,
      palette: [0x59646a, 0x454f55, 0x667277, 0x39444a, 0x778084]
    }
  };

  const LANDMARK_MATERIALS = {};

  function initMaterials() {
    MATS.roof = new THREE.MeshStandardMaterial({ color: 0x87847a, roughness: 0.96, metalness: 0.02 });
    MATS.roofDark = new THREE.MeshStandardMaterial({ color: 0x5c605e, roughness: 0.9, metalness: 0.06 });
    MATS.steel = new THREE.MeshStandardMaterial({ color: 0x8d9495, roughness: 0.43, metalness: 0.68 });
    MATS.darkSteel = new THREE.MeshStandardMaterial({ color: 0x5f6667, roughness: 0.52, metalness: 0.5 });
    MATS.cable = new THREE.MeshStandardMaterial({ color: 0x90928c, roughness: 0.55, metalness: 0.35 });
    MATS.copper = new THREE.MeshStandardMaterial({ color: 0x5b8e77, roughness: 0.67, metalness: 0.22 });
    MATS.limestone = makeFacadeMaterial('stone', 0xffffff);
    MATS.limestoneTint = makeFacadeMaterial('stone', 0xc2b59f);
    MATS.glass = makeFacadeMaterial('glass', 0xffffff);
    MATS.glassTint = makeFacadeMaterial('glass', 0x8fb1c1);
    MATS.glassDark = makeFacadeMaterial('glass', 0x536f7e);
    MATS.brick = makeFacadeMaterial('brick', 0x94614d);
    MATS.concrete = makeFacadeMaterial('concrete', 0xffffff);
    MATS.whiteStone = makeFacadeMaterial('stone', 0xd8d1bf);
    MATS.greenCopper = new THREE.MeshStandardMaterial({ color: 0x6e9c85, roughness: 0.72, metalness: 0.15 });
    MATS.torch = new THREE.MeshBasicMaterial({ color: 0xffcf74 });
    MATS.waterDark = new THREE.MeshBasicMaterial({ color: 0x173943 });
    MATS.billboard = new THREE.MeshBasicMaterial({ color: 0xff745b });

    MATS.instanced = {};
    for (const type of Object.keys(BUILDING_TYPES)) {
      MATS.instanced[type] = makeFacadeMaterial(type, 0xffffff);
    }

    LANDMARK_MATERIALS.glassBlue = makeFacadeMaterial('glass', 0x88a9b7);
    LANDMARK_MATERIALS.glassDeep = makeFacadeMaterial('glass', 0x526f7f);
    LANDMARK_MATERIALS.limestone = makeFacadeMaterial('stone', 0xc8bba4);
    LANDMARK_MATERIALS.limestoneDark = makeFacadeMaterial('stone', 0xa99d88);
    LANDMARK_MATERIALS.brick = makeFacadeMaterial('brick', 0x98624d);
    LANDMARK_MATERIALS.concrete = makeFacadeMaterial('concrete', 0xb2aea1);
    LANDMARK_MATERIALS.dark = makeFacadeMaterial('glass', 0x505e66);
    LANDMARK_MATERIALS.chrysler = makeFacadeMaterial('glass', 0x9ba5a4);
    LANDMARK_MATERIALS.whiteStone = makeFacadeMaterial('stone', 0xd8d1bf);

    for (const m of Object.values(MATS)) {
      if (m && m.isMaterial) SHARED_MATERIALS.add(m);
    }
    for (const m of Object.values(MATS.instanced)) {
      if (m && m.isMaterial) SHARED_MATERIALS.add(m);
    }
    for (const m of Object.values(LANDMARK_MATERIALS)) {
      if (m && m.isMaterial) SHARED_MATERIALS.add(m);
    }
  }

  function makeFacadeMaterial(style, baseColor) {
    const cfg = BUILDING_TYPES[style] || BUILDING_TYPES.stone;
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: cfg.rough,
      metalness: cfg.metal
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWinW = { value: cfg.winW };
      shader.uniforms.uFloorH = { value: cfg.floorH };
      shader.uniforms.uWinX = { value: cfg.winX };
      shader.uniforms.uWinY = { value: cfg.winY };
      shader.uniforms.uGlassColor = { value: new THREE.Color(cfg.glass) };
      shader.uniforms.uWindowStrength = { value: cfg.strength };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vGzWorld;
          varying vec3 vGzNormal;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vec3 gzObjNormal = objectNormal;
          #ifdef USE_INSTANCING
            gzObjNormal = mat3(instanceMatrix) * gzObjNormal;
          #endif
          vGzNormal = normalize(mat3(modelMatrix) * gzObjNormal);`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 gzWorldPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            gzWorldPosition = instanceMatrix * gzWorldPosition;
          #endif
          vGzWorld = (modelMatrix * gzWorldPosition).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vGzWorld;
          varying vec3 vGzNormal;
          uniform float uWinW;
          uniform float uFloorH;
          uniform float uWinX;
          uniform float uWinY;
          uniform vec3 uGlassColor;
          uniform float uWindowStrength;`
        )
        .replace(
          '#include <map_fragment>',
          `vec3 gzSurface = diffuseColor.rgb;
          float gzFaceAxis = step(0.45, abs(vGzNormal.x));
          float gzHorizontal = mix(vGzWorld.x, vGzWorld.z, gzFaceAxis);
          vec2 gzGrid = vec2(gzHorizontal / uWinW, vGzWorld.y / uFloorH);
          vec2 gzCell = fract(gzGrid);
          vec2 gzDerivative = fwidth(gzGrid);
          float gzDetail = 1.0 - smoothstep(0.13, 0.70, max(gzDerivative.x, gzDerivative.y));
          float gzX = smoothstep(uWinX, uWinX + 0.035, gzCell.x)
                    * (1.0 - smoothstep(1.0 - uWinX - 0.035, 1.0 - uWinX, gzCell.x));
          float gzY = smoothstep(uWinY, uWinY + 0.035, gzCell.y)
                    * (1.0 - smoothstep(1.0 - uWinY - 0.035, 1.0 - uWinY, gzCell.y));
          float gzWin = gzX * gzY * smoothstep(4.0, 8.0, vGzWorld.y);
          float gzAverage = (1.0 - 2.0 * uWinX) * (1.0 - 2.0 * uWinY);
          gzWin = mix(gzAverage, gzWin, gzDetail);
          float gzSeed = fract(sin(dot(floor(gzGrid), vec2(12.9898, 78.233))) * 43758.5453);
          vec3 gzGlass = uGlassColor * (0.68 + gzSeed * 0.62);
          float gzFloorLine = smoothstep(0.0, 0.045, gzCell.y)
                            * (1.0 - smoothstep(0.045, 0.11, gzCell.y));
          gzSurface *= 1.0 - gzFloorLine * 0.06;
          gzSurface = mix(gzSurface, gzGlass, gzWin * uWindowStrength);
          float gzLobby = (1.0 - smoothstep(3.0, 8.0, vGzWorld.y)) * 0.52;
          gzSurface = mix(gzSurface, gzSurface * vec3(0.54, 0.52, 0.48), gzLobby);
          float gzGrime = fract(sin(dot(floor(vec2(gzHorizontal * 0.11, vGzWorld.y * 0.032)), vec2(31.17, 97.31))) * 24634.6345);
          gzSurface *= mix(0.94, 1.045, gzGrime);
          diffuseColor.rgb = gzSurface;`
        );
    };
    material.customProgramCacheKey = () => `gzfacade-${style}`;
    return material;
  }

  function makeTowerGeometry() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    geo.clearGroups();
    geo.addGroup(0, 12, 0);
    geo.addGroup(12, 12, 1);
    geo.addGroup(24, 12, 0);
    geo.computeBoundingSphere();
    return geo;
  }

  const LANDMARK_SPECS = [
    { id: 'wtc1', name: 'One World Trade Center', kind: 'wtc1', x: -520, z: 1120, radius: 90, h: 541 },
    { id: 'wtc3', name: '3 World Trade Center', kind: 'stack', x: -320, z: 1010, radius: 64, h: 329, w: 56, d: 52, mat: 'glassDeep' },
    { id: 'wtc4', name: '4 World Trade Center', kind: 'stack', x: -740, z: 930, radius: 64, h: 298, w: 66, d: 50, mat: 'glassBlue' },
    { id: 'wtc7', name: '7 World Trade Center', kind: 'stack', x: -780, z: 1330, radius: 60, h: 226, w: 58, d: 48, mat: 'glassDeep' },
    { id: 'onepark', name: '30 Park Place', kind: 'artdeco', x: -240, z: 1460, radius: 46, h: 282, w: 42, d: 38, mat: 'limestone' },
    { id: 'woolworth', name: 'Woolworth Building', kind: 'artdeco', x: -105, z: 1910, radius: 44, h: 241, w: 45, d: 42, mat: 'limestoneDark' },
    { id: 'spruce', name: '8 Spruce Street', kind: 'stack', x: -30, z: 1710, radius: 38, h: 265, w: 38, d: 38, mat: 'glassBlue' },
    { id: 'wall40', name: '40 Wall Street', kind: 'artdeco', x: -365, z: 760, radius: 44, h: 283, w: 44, d: 40, mat: 'limestoneDark' },
    { id: 'pine70', name: '70 Pine Street', kind: 'artdeco', x: -625, z: 630, radius: 45, h: 290, w: 45, d: 42, mat: 'limestone' },
    { id: 'chase', name: 'One Chase Manhattan Plaza', kind: 'stack', x: -305, z: 475, radius: 58, h: 248, w: 74, d: 48, mat: 'dark' },
    { id: 'libertyplaza', name: 'One Liberty Plaza', kind: 'stack', x: -460, z: 880, radius: 55, h: 226, w: 65, d: 45, mat: 'dark' },
    { id: 'empire', name: 'Empire State Building', kind: 'empire', x: -245, z: 6080, radius: 110, h: 443 },
    { id: 'chrysler', name: 'Chrysler Building', kind: 'chrysler', x: 340, z: 6240, radius: 50, h: 319 },
    { id: 'vanderbilt', name: 'One Vanderbilt', kind: 'vanderbilt', x: 590, z: 6410, radius: 60, h: 427 },
    { id: 'bofa', name: 'Bank of America Tower', kind: 'vanderbilt', x: -125, z: 6330, radius: 52, h: 366 },
    { id: 'rock30', name: '30 Rockefeller Plaza', kind: 'artdeco', x: -360, z: 6570, radius: 63, h: 259, w: 88, d: 46, mat: 'limestone' },
    { id: 'citicorp', name: 'Citigroup Center', kind: 'stack', x: 160, z: 6720, radius: 52, h: 279, w: 48, d: 48, mat: 'whiteStone' },
    { id: 'metlife', name: 'MetLife Building', kind: 'stack', x: 350, z: 6820, radius: 78, h: 246, w: 92, d: 50, mat: 'concrete' },
    { id: 'grandcentral', name: 'Grand Central Terminal', kind: 'grandcentral', x: 525, z: 6370, radius: 82, h: 48 },
    { id: 'nypl', name: 'New York Public Library', kind: 'publiclibrary', x: -435, z: 6190, radius: 68, h: 34 },
    { id: 'un', name: 'United Nations Headquarters', kind: 'un', x: 1210, z: 6900, radius: 72, h: 155 },
    { id: 'park432', name: '432 Park Avenue', kind: 'thin', x: -680, z: 7760, radius: 28, h: 426, w: 29, d: 29, mat: 'whiteStone' },
    { id: 'cpt', name: 'Central Park Tower', kind: 'billionaires', x: -905, z: 7870, radius: 48, h: 472, w: 58, d: 48, mat: 'glassDeep' },
    { id: 'w57', name: '111 West 57th Street', kind: 'billionaires', x: -770, z: 7960, radius: 33, h: 435, w: 28, d: 48, mat: 'limestone' },
    { id: 'one57', name: 'One57', kind: 'stack', x: -845, z: 7700, radius: 39, h: 306, w: 46, d: 44, mat: 'glassBlue' },
    { id: 'hudson30', name: '30 Hudson Yards', kind: 'hudson', x: -1470, z: 6960, radius: 72, h: 387, w: 62, d: 62, mat: 'glassDeep' },
    { id: 'hudson35', name: '35 Hudson Yards', kind: 'stack', x: -1570, z: 6870, radius: 56, h: 308, w: 42, d: 42, mat: 'limestoneDark' },
    { id: 'hudson10', name: '10 Hudson Yards', kind: 'stack', x: -1380, z: 6810, radius: 54, h: 268, w: 48, d: 45, mat: 'glassBlue' },
    { id: 'flatiron', name: 'Flatiron Building', kind: 'flatiron', x: -365, z: 4720, radius: 33, h: 87 },
    { id: 'washingtonarch', name: 'Washington Square Arch', kind: 'arch', x: -165, z: 4015, radius: 25, h: 30 },
    { id: 'onets', name: 'One Times Square', kind: 'billboard', x: -870, z: 6420, radius: 28, h: 120 },
    { id: 'stpat', name: "St. Patrick's Cathedral", kind: 'cathedral', x: 85, z: 6530, radius: 52, h: 100 },
    { id: 'brooklyntower', name: 'The Brooklyn Tower', kind: 'brooklyn', x: 2360, z: 2640, radius: 48, h: 325, w: 45, d: 45, mat: 'dark' },
    { id: 'dekalb', name: '9 DeKalb Avenue', kind: 'artdeco', x: 2470, z: 2810, radius: 42, h: 325, w: 38, d: 38, mat: 'dark' },
    { id: 'willoughby', name: 'One Willoughby Square', kind: 'stack', x: 2270, z: 2380, radius: 52, h: 250, w: 44, d: 48, mat: 'glassBlue' },
    { id: 'hoyt11', name: '11 Hoyt', kind: 'stack', x: 2690, z: 3010, radius: 48, h: 240, w: 44, d: 42, mat: 'glassDeep' },
    { id: 'jersey99', name: '99 Hudson', kind: 'stack', x: -3030, z: 3030, radius: 48, h: 274, w: 42, d: 42, mat: 'limestone' },
    { id: 'goldman', name: 'Goldman Sachs Tower', kind: 'stack', x: -3140, z: 2560, radius: 55, h: 238, w: 48, d: 48, mat: 'glassDeep' },
    { id: 'url', name: 'URL Harborside', kind: 'stack', x: -2990, z: 3520, radius: 42, h: 220, w: 38, d: 38, mat: 'glassBlue' },
    { id: 'statue', name: 'Statue of Liberty', kind: 'statue', x: -1595, z: -1110, radius: 36, h: 93 }
  ];

  const LANDMARK_EXCLUSIONS = LANDMARK_SPECS.map((l) => ({ x: l.x, z: l.z, r: l.radius }));

  let buildingRecords = [];
  let landmarks = [];
  let bridgeRecords = [];
  let treeRecords = [];
  let rubbleSystem = null;
  let treeSystems = null;
  let debrisSystem = null;
  let fireSpawnPoints = [];

  // ---------------------------------------------------------------------------
  // Building generation
  // ---------------------------------------------------------------------------
  function generateBuildings() {
    const rng = mulberry32(987654);
    buildingRecords = [];
    generateManhattanBuildings(rng);
    generateOuterBoroughs(rng);
    return buildingRecords;
  }

  function isParked(x, z, pad = 0) {
    for (const park of PARK_AREAS) {
      if (pointInPoly(x, z, park.poly)) return true;
      if (pad > 0) {
        const b = polygonBounds(park.poly);
        if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) {
          let near = false;
          for (let i = 0; i < park.poly.length; i++) {
            const a = park.poly[i];
            const c = park.poly[(i + 1) % park.poly.length];
            if (distToSegmentSq(x, z, a[0], a[1], c[0], c[1]) < pad * pad) { near = true; break; }
          }
          if (near) return true;
        }
      }
    }
    return false;
  }

  function inLandmarkExclusion(x, z, pad = 0) {
    for (const e of LANDMARK_EXCLUSIONS) {
      const dx = x - e.x;
      const dz = z - e.z;
      if (dx * dx + dz * dz < (e.r + pad) * (e.r + pad)) return true;
    }
    return false;
  }

  function distToSegmentSq(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    if (l2 === 0) return (px - ax) ** 2 + (pz - az) ** 2;
    let t = ((px - ax) * dx + (pz - az) * dz) / l2;
    t = clamp(t, 0, 1);
    const qx = ax + t * dx;
    const qz = az + t * dz;
    return (px - qx) ** 2 + (pz - qz) ** 2;
  }

  function localToWorld(u, v) {
    return [A.x * u + B.x * v, A.y * u + B.y * v];
  }

  function cellClear(cx, cz, halfAcross, halfAlong) {
    const corners = [
      localPoint(cx, cz, halfAcross, halfAlong),
      localPoint(cx, cz, -halfAcross, halfAlong),
      localPoint(cx, cz, halfAcross, -halfAlong),
      localPoint(cx, cz, -halfAcross, -halfAlong)
    ];
    for (const [x, z] of corners) {
      if (!pointInPoly(x, z, MANHATTAN)) return false;
      if (isParked(x, z, 6)) return false;
      if (inLandmarkExclusion(x, z, 6)) return false;
    }
    if (isParked(cx, cz, 4) || inLandmarkExclusion(cx, cz, 4)) return false;
    return true;
  }

  function footprintClear(x, z, w, d, rot) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = sx * w * 0.5;
      const lz = sz * d * 0.5;
      const wx = x + c * lx + s * lz;
      const wz = z - s * lx + c * lz;
      if (!inAnyLand(wx, wz)) return false;
      if (isParked(wx, wz, 4)) return false;
      if (inLandmarkExclusion(wx, wz, 3)) return false;
    }
    return true;
  }

  function generateManhattanBuildings(rng) {
    for (let u = -1100; u <= 14900; u += STREET_GRID.street) {
      for (let v = -6800; v <= 6800; v += STREET_GRID.avenue) {
        if (rng() < 0.045) continue;
        const blockCenter = localToWorld(u, v);
        if (!cellClear(blockCenter[0], blockCenter[1], 102, 34)) continue;
        if (isParked(blockCenter[0], blockCenter[1], 1)) continue;

        const countRoll = rng();
        const count = countRoll < 0.34 ? 1 : countRoll < 0.82 ? 2 : 3;
        const widthSegment = 200 / count;
        const z = blockCenter[1];
        const isDowntown = z < 2800;
        const isMidtown = z > 5200 && z < 7900;

        for (let i = 0; i < count; i++) {
          if (rng() < 0.04) continue;
          const across = -100 + widthSegment * (i + 0.5) + (rng() - 0.5) * 10;
          const along = (rng() - 0.5) * 12;
          const w = widthSegment * (0.68 + rng() * 0.27);
          const d = 68 * (0.7 + rng() * 0.26);
          const center = localToWorld(u + along, v + across);
          const rot = GRID_ANGLE + (rng() - 0.5) * 0.018;
          if (!footprintClear(center[0], center[1], w, d, rot)) continue;
          if (rng() < 0.025 && !isDowntown && !isMidtown) continue;

          let height = buildingHeight(center[0], center[1], rng, 'manhattan');
          if (w > 110) height = Math.min(height, 95 + rng() * 55);
          const type = pickBuildingType(height, rng, isMidtown || isDowntown);
          const color = pickPaletteColor(BUILDING_TYPES[type].palette, rng);
          buildingRecords.push({
            x: center[0], z: center[1], w, d, h: height, rot, type, color,
            baseColor: color, status: 'intact', mesh: null, index: -1,
            accessory: [], collapse: null, damageLevel: 0, destroyed: false,
            opacity: 1, isLandmark: false
          });
        }
      }
    }
  }

  function generateOuterBoroughs(rng) {
    const zones = [
      {
        name: 'brooklyn', poly: BROOKLYN_QUEENS, x0: 1250, x1: 6750, z0: -2500, z1: 9050,
        step: 150, rowStep: 74, density: 0.78, rot: -0.085, baseH: [11, 38],
        clusters: [[2340, 2620, 700, 122], [2670, 3330, 520, 42], [1860, 2080, 400, 20],
          [3900, -1200, 900, 26], [4900, -600, 700, 22]]
      },
      {
        name: 'queens', poly: BROOKLYN_QUEENS, x0: 2300, x1: 6750, z0: 8800, z1: 14300,
        step: 158, rowStep: 82, density: 0.6, rot: 0.02, baseH: [9, 24],
        clusters: [[3300, 10300, 900, 34], [5600, 13000, 800, 28]]
      },
      {
        name: 'jersey', poly: JERSEY, x0: -6300, x1: -2550, z0: -2500, z1: 15000,
        step: 152, rowStep: 78, density: 0.62, rot: 0.055, baseH: [12, 34],
        clusters: [[-3000, 2850, 800, 128], [-2860, 4450, 540, 40], [-4600, 11500, 900, 30]]
      },
      {
        name: 'bronx', poly: BRONX, x0: -700, x1: 3000, z0: 13850, z1: 15150,
        step: 150, rowStep: 76, density: 0.55, rot: 0.04, baseH: [12, 34],
        clusters: [[900, 14500, 800, 52]]
      },
      {
        name: 'staten', poly: STATEN_ISLAND, x0: -2000, x1: -100, z0: -2600, z1: -1450,
        step: 150, rowStep: 76, density: 0.5, rot: 0.03, baseH: [10, 26],
        clusters: [[-1100, -2100, 600, 22]]
      }
    ];

    for (const zone of zones) {
      const cosR = Math.cos(zone.rot);
      const sinR = Math.sin(zone.rot);
      for (let gx = zone.x0; gx <= zone.x1; gx += zone.step) {
        for (let gz = zone.z0; gz <= zone.z1; gz += zone.step) {
          if (rng() > zone.density) continue;
          const bx = gx + (rng() - 0.5) * 12;
          const bz = gz + (rng() - 0.5) * 12;
          if (!pointInPoly(bx, bz, zone.poly)) continue;
          if (isParked(bx, bz, 12) || inLandmarkExclusion(bx, bz, 12)) continue;

          const rows = rng() < 0.55 ? 2 : 1;
          for (let row = 0; row < rows; row++) {
            const cols = 2 + (rng() < 0.5 ? 1 : 0);
            for (let col = 0; col < cols; col++) {
              if (rng() < 0.08) continue;
              const lx = (col - (cols - 1) / 2) * zone.step * 0.32;
              const lz = (row - (rows - 1) / 2) * zone.rowStep;
              const cx = bx + cosR * lx - sinR * lz;
              const cz = bz + sinR * lx + cosR * lz;
              if (!pointInPoly(cx, cz, zone.poly)) continue;
              if (isParked(cx, cz, 6) || inLandmarkExclusion(cx, cz, 6)) continue;

              const w = zone.step * (0.19 + rng() * 0.065);
              const d = zone.rowStep * (0.62 + rng() * 0.2);
              const rot = zone.rot + (rng() - 0.5) * 0.024;
              if (!footprintClear(cx, cz, w, d, rot)) continue;

              let h = lerp(zone.baseH[0], zone.baseH[1], Math.pow(rng(), 1.9));
              for (const [hx, hz, radius, amp] of zone.clusters) {
                const dx = cx - hx;
                const dz = cz - hz;
                const dd = Math.sqrt(dx * dx + dz * dz);
                if (dd < radius) h += amp * Math.pow(1 - dd / radius, 2.1) * (0.5 + rng() * 0.7);
              }
              if (zone.name === 'brooklyn' && cz < 1880 && cx < 2210) h = Math.min(h, 23);
              const type = h > 85 ? (rng() < 0.5 ? 'glass' : 'dark') : pickBuildingType(h, rng, false, zone.name);
              const color = pickPaletteColor(BUILDING_TYPES[type].palette, rng);
              buildingRecords.push({
                x: cx, z: cz, w, d, h, rot, type, color, baseColor: color,
                status: 'intact', mesh: null, index: -1, accessory: [],
                collapse: null, damageLevel: 0, destroyed: false, opacity: 1,
                isLandmark: false
              });
            }
          }
        }
      }
    }

    infillIsland(rng, ROOSEVELT, 42, 7, [13, 42], 0.7);
    infillIsland(rng, GOVERNORS, 26, 5, [9, 22], 0.45);
  }

  function infillIsland(rng, poly, count, radius, heightRange, chance) {
    const b = polygonBounds(poly);
    let made = 0;
    for (let i = 0; i < count * 8 && made < count; i++) {
      if (rng() > chance) continue;
      const x = lerp(b.x0, b.x1, rng());
      const z = lerp(b.z0, b.z1, rng());
      if (!pointInPoly(x, z, poly)) continue;
      if (isParked(x, z, 3)) continue;
      const w = 20 + rng() * 35;
      const d = 22 + rng() * 42;
      const rot = GRID_ANGLE + (rng() - 0.5) * 0.08;
      const h = lerp(heightRange[0], heightRange[1], rng());
      const type = pickBuildingType(h, rng, false);
      const color = pickPaletteColor(BUILDING_TYPES[type].palette, rng);
      buildingRecords.push({
        x, z, w, d, h, rot, type, color, baseColor: color, status: 'intact',
        mesh: null, index: -1, accessory: [], collapse: null,
        damageLevel: 0, destroyed: false, opacity: 1, isLandmark: false
      });
      made++;
    }
  }

  function buildingHeight(x, z, rng, zone) {
    let h = 12 + rng() * 25;
    if (z < 2600) h = 26 + rng() * 82;
    else if (z < 4200) h = 20 + rng() * 45;
    else if (z < 5400) h = 24 + rng() * 58;
    else if (z < 7900) h = 30 + rng() * 92;
    else if (z < 11500) h = 22 + rng() * 58;
    else h = 15 + rng() * 39;

    const clusters = [
      [-500, 1000, 1000, 130, 1.1], [-200, 700, 620, 80, 1.9],
      [-245, 6080, 1100, 95, 1.6], [500, 6650, 800, 70, 1.9],
      [-820, 7800, 720, 120, 1.15], [-1480, 6900, 500, 90, 1.4],
      [-3000, 2900, 900, 54, 2.2]
    ];
    for (const [hx, hz, radius, amp, power] of clusters) {
      const dx = x - hx;
      const dz = z - hz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < radius) {
        h += amp * Math.pow(1 - d / radius, power) * (0.6 + rng() * 0.55);
      }
    }
    if (rng() < 0.028) h *= 1.65 + rng() * 0.8;
    return clamp(h, 8, 245);
  }

  function pickBuildingType(height, rng, prime, borough) {
    const r = rng();
    if (height > 145) {
      if (r < 0.52) return rng() < 0.32 ? 'dark' : 'glass';
      if (r < 0.82) return 'stone';
      if (r < 0.94) return 'concrete';
      return 'brick';
    }
    if (height > 70) {
      if (r < 0.28) return 'glass';
      if (r < 0.55) return 'stone';
      if (r < 0.77) return 'concrete';
      if (r < 0.92) return 'brick';
      return 'dark';
    }
    if (borough && borough !== 'manhattan') {
      if (r < 0.43) return 'brick';
      if (r < 0.7) return 'stone';
      if (r < 0.9) return 'concrete';
      return 'glass';
    }
    if (r < 0.39) return 'brick';
    if (r < 0.64) return 'stone';
    if (r < 0.85) return 'concrete';
    if (r < 0.95) return 'glass';
    return 'dark';
  }

  function pickPaletteColor(palette, rng) {
    return palette[Math.floor(rng() * palette.length) % palette.length];
  }

  function createInstancedBuildings() {
    const byType = {};
    for (const type of Object.keys(BUILDING_TYPES)) byType[type] = [];
    for (const rec of buildingRecords) byType[rec.type].push(rec);

    const geo = makeTowerGeometry();
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (const [type, records] of Object.entries(byType)) {
      if (!records.length) continue;
      const mesh = new THREE.InstancedMesh(
        geo,
        [MATS.instanced[type], MATS.roof],
        records.length
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = !LOW_POWER;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `buildings-${type}`;

      records.forEach((rec, i) => {
        rec.mesh = mesh;
        rec.index = i;
        dummy.position.set(rec.x, 0.2, rec.z);
        dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot);
        dummy.scale.set(rec.w, rec.h, rec.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        rec.baseMatrix = dummy.matrix.clone();
        color.setHex(rec.color);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      cityRoot.add(mesh);
    }

    createAccessories();
    createRubbleSystem();
    state.totalStructures = buildingRecords.length + LANDMARK_SPECS.length;
  }

  function createAccessories() {
    const accessories = [
      { kind: 'antenna', records: [], geometry: null, material: MATS.darkSteel },
      { kind: 'hvac', records: [], geometry: null, material: new THREE.MeshStandardMaterial({ color: 0x777b78, roughness: 0.9 }) },
      { kind: 'tank', records: [], geometry: null, material: new THREE.MeshStandardMaterial({ color: 0x6c5848, roughness: 0.94 }) }
    ];
    const rng = mulberry32(4481);
    const antennaGeo = new THREE.CylinderGeometry(0.24, 0.42, 1, 5).translate(0, 0.5, 0);
    const hvacGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 9).translate(0, 0.5, 0);
    accessories[0].geometry = antennaGeo;
    accessories[1].geometry = hvacGeo;
    accessories[2].geometry = tankGeo;

    for (const rec of buildingRecords) {
      if (rec.h > 115 && rng() < 0.6) accessories[0].records.push(rec);
      if (rec.h > 18 && rec.w > 24 && rng() < (rec.h > 100 ? 0.55 : 0.24)) accessories[1].records.push(rec);
      if (rec.h < 120 && rec.w > 28 && rng() < 0.22) accessories[2].records.push(rec);
    }

    const dummy = new THREE.Object3D();
    for (const acc of accessories) {
      if (!acc.records.length) continue;
      const mesh = new THREE.InstancedMesh(acc.geometry, acc.material, acc.records.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = !LOW_POWER;
      mesh.frustumCulled = false;
      acc.records.forEach((rec, i) => {
        const r = mulberry32((rec.x * 31 + rec.z * 17) | 0)();
        if (acc.kind === 'antenna') {
          dummy.position.set(rec.x, 0.2 + rec.h, rec.z);
          dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot);
          dummy.scale.set(1.2, 16 + r * 28, 1.2);
        } else if (acc.kind === 'hvac') {
          dummy.position.set(rec.x + Math.cos(rec.rot) * rec.w * 0.13, 0.2 + rec.h, rec.z - Math.sin(rec.rot) * rec.w * 0.13);
          dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot);
          dummy.scale.set(rec.w * (0.14 + r * 0.1), 2.5 + r * 3.5, rec.d * (0.12 + r * 0.1));
        } else {
          dummy.position.set(rec.x - Math.cos(rec.rot) * rec.w * 0.15, 0.2 + rec.h, rec.z + Math.sin(rec.rot) * rec.w * 0.15);
          dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot);
          dummy.scale.set(4.1, 7.5, 4.1);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        rec.accessory.push({ mesh, index: i });
      });
      mesh.instanceMatrix.needsUpdate = true;
      cityRoot.add(mesh);
    }
  }

  function hideAccessory(rec) {
    if (!rec.accessory.length) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const a of rec.accessory) {
      a.mesh.setMatrixAt(a.index, zero);
      a.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function createRubbleSystem() {
    const capacity = LOW_POWER ? 900 : 2200;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f5b51, roughness: 1, metalness: 0.02 });
    rubbleSystem = {
      mesh: new THREE.InstancedMesh(geo, mat, capacity),
      capacity,
      cursor: 0,
      dummy: new THREE.Object3D(),
      color: new THREE.Color()
    };
    rubbleSystem.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rubbleSystem.mesh.frustumCulled = false;
    rubbleSystem.mesh.receiveShadow = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) rubbleSystem.mesh.setMatrixAt(i, zero);
    rubbleSystem.mesh.instanceMatrix.needsUpdate = true;
    cityRoot.add(rubbleSystem.mesh);
  }

  function addRubble(rec, scaleFactor = 1) {
    if (!rubbleSystem) return;
    const i = rubbleSystem.cursor++ % rubbleSystem.capacity;
    const r = mulberry32((rec.x * 13 + rec.z * 7) | 0)();
    const dummy = rubbleSystem.dummy;
    dummy.position.set(rec.x, 1.2, rec.z);
    dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot + r);
    dummy.scale.set(rec.w * (0.48 + r * 0.25) * scaleFactor, Math.max(1.5, rec.h * 0.035 + r * 4), rec.d * (0.42 + r * 0.3) * scaleFactor);
    dummy.updateMatrix();
    rubbleSystem.mesh.setMatrixAt(i, dummy.matrix);
    rubbleSystem.mesh.setColorAt(i, rubbleSystem.color.setHex(r > 0.5 ? 0x625f55 : 0x4c4a43));
    rubbleSystem.mesh.instanceMatrix.needsUpdate = true;
    if (rubbleSystem.mesh.instanceColor) rubbleSystem.mesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Custom landmarks
  // ---------------------------------------------------------------------------
  function addBoxMesh(group, w, h, d, x, y, z, material, roof = true, rotY = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    let mat = material;
    if (roof) {
      geo.clearGroups();
      geo.addGroup(0, 12, 0);
      geo.addGroup(12, 12, 1);
      geo.addGroup(24, 12, 0);
      mat = [material, MATS.roof];
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = !LOW_POWER;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addCylinder(group, radiusTop, radiusBottom, h, x, y, z, material, segments = 12) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = !LOW_POWER;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function landmarkMaterial(name) {
    return LANDMARK_MATERIALS[name] || LANDMARK_MATERIALS.limestone;
  }

  function createLandmarks() {
    landmarks = [];
    for (const spec of LANDMARK_SPECS) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      group.rotation.y = GRID_ANGLE;
      group.name = `landmark-${spec.id}`;
      buildLandmarkGeometry(group, spec);
      cityRoot.add(group);
      const lm = {
        ...spec,
        group,
        destroyed: false,
        status: 'intact',
        collapse: null,
        originalQuaternion: group.quaternion.clone(),
        baseY: group.position.y
      };
      group.userData.landmark = lm;
      landmarks.push(lm);
    }
    state.totalStructures = buildingRecords.length + landmarks.length;
  }

  function buildLandmarkGeometry(group, spec) {
    const matName = spec.mat || 'limestone';
    const mat = landmarkMaterial(matName);
    const w = spec.w || 46;
    const d = spec.d || 46;
    const h = spec.h;

    switch (spec.kind) {
      case 'wtc1': {
        addBoxMesh(group, 96, 14, 90, 0, 0, 0, LANDMARK_MATERIALS.glassDeep);
        addBoxMesh(group, 82, 48, 78, 0, 14, 0, LANDMARK_MATERIALS.glassBlue);
        const towerGeo = new THREE.CylinderGeometry(18.5, 37.5, 389, 4);
        towerGeo.rotateY(Math.PI / 4);
        const tower = new THREE.Mesh(towerGeo, LANDMARK_MATERIALS.glassBlue);
        tower.position.y = 62 + 389 / 2;
        tower.castShadow = !LOW_POWER;
        tower.receiveShadow = true;
        group.add(tower);
        addBoxMesh(group, 37, 8, 37, 0, 451, 0, MATS.darkSteel, false, Math.PI / 4);
        addCylinder(group, 1.2, 2.2, 82, 0, 459, 0, MATS.steel, 6);
        addCylinder(group, 0.3, 0.7, 25, 0, 541, 0, MATS.steel, 5);
        addBoxMesh(group, 108, 2.5, 104, 0, 8, 0, MATS.darkSteel, false);
        break;
      }
      case 'empire': {
        addBoxMesh(group, 126, 26, 62, 0, 0, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 96, 28, 55, 0, 26, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 82, 214, 49, 0, 54, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 65, 76, 41, 0, 268, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 48, 34, 32, 0, 344, 0, LANDMARK_MATERIALS.limestoneDark);
        addBoxMesh(group, 32, 18, 23, 0, 378, 0, LANDMARK_MATERIALS.limestone);
        addCylinder(group, 1.5, 3.6, 45, 0, 398, 0, MATS.steel, 8);
        addCylinder(group, 0.3, 0.8, 23, 0, 438, 0, MATS.steel, 5);
        addBoxMesh(group, 18, 26, 15, -53, 26, 0, LANDMARK_MATERIALS.limestoneDark);
        addBoxMesh(group, 18, 26, 15, 53, 26, 0, LANDMARK_MATERIALS.limestoneDark);
        break;
      }
      case 'chrysler': {
        addBoxMesh(group, 58, 54, 58, 0, 0, 0, LANDMARK_MATERIALS.chrysler);
        addBoxMesh(group, 42, 188, 42, 0, 54, 0, LANDMARK_MATERIALS.chrysler);
        addBoxMesh(group, 35, 12, 35, 0, 242, 0, LANDMARK_MATERIALS.chrysler);
        addBoxMesh(group, 29, 12, 29, 0, 254, 0, LANDMARK_MATERIALS.chrysler);
        addBoxMesh(group, 23, 13, 23, 0, 266, 0, LANDMARK_MATERIALS.chrysler);
        addBoxMesh(group, 17, 14, 17, 0, 279, 0, LANDMARK_MATERIALS.chrysler);
        addCylinder(group, 0.2, 9, 26, 0, 293, 0, LANDMARK_MATERIALS.chrysler, 4);
        addCylinder(group, 0.1, 0.35, 17, 0, 319, 0, MATS.steel, 5);
        break;
      }
      case 'vanderbilt': {
        addBoxMesh(group, 76, 30, 65, 0, 0, 0, LANDMARK_MATERIALS.glassBlue);
        addBoxMesh(group, 64, 242, 57, 0, 30, 0, LANDMARK_MATERIALS.glassBlue);
        addBoxMesh(group, 45, 105, 43, 0, 272, 0, LANDMARK_MATERIALS.glassBlue);
        addBoxMesh(group, 31, 40, 31, 0, 377, 0, LANDMARK_MATERIALS.glassDeep);
        addCylinder(group, 0.3, 0.8, 10, 0, 417, 0, MATS.steel, 5);
        break;
      }
      case 'artdeco': {
        addBoxMesh(group, w * 1.15, Math.min(36, h * 0.15), d * 1.15, 0, 0, 0, mat);
        addBoxMesh(group, w, h * 0.62, d, 0, Math.min(36, h * 0.15), 0, mat);
        const shaftTop = Math.min(36, h * 0.15) + h * 0.62;
        addBoxMesh(group, w * 0.75, h * 0.16, d * 0.78, 0, shaftTop, 0, mat);
        const shoulder = shaftTop + h * 0.16;
        addBoxMesh(group, w * 0.55, h * 0.1, d * 0.58, 0, shoulder, 0, mat);
        addCylinder(group, 0.35, Math.max(1, w * 0.09), h * 0.17, 0, shoulder + h * 0.1, 0, mat, 4);
        addCylinder(group, 0.2, 0.4, 13, 0, shoulder + h * 0.27, 0, MATS.steel, 5);
        break;
      }
      case 'thin': {
        addBoxMesh(group, w * 1.4, 26, d * 1.4, 0, 0, 0, mat);
        addBoxMesh(group, w, h - 32, d, 0, 26, 0, mat);
        addBoxMesh(group, w * 0.9, 6, d * 0.9, 0, h - 6, 0, MATS.darkSteel, false);
        break;
      }
      case 'billionaires': {
        addBoxMesh(group, w * 1.3, 22, d * 1.2, 0, 0, 0, mat);
        addBoxMesh(group, w, h * 0.58, d, 0, 22, 0, mat);
        addBoxMesh(group, w * 0.8, h * 0.23, d * 0.78, 0, 22 + h * 0.58, 0, mat);
        addBoxMesh(group, w * 0.62, h * 0.15, d * 0.6, 0, 22 + h * 0.81, 0, mat);
        addCylinder(group, 0.2, 0.4, 10, 0, h - 4, 0, MATS.steel, 5);
        break;
      }
      case 'hudson': {
        addBoxMesh(group, w, 48, d, 0, 0, 0, mat);
        addBoxMesh(group, w * 1.08, 210, d * 1.03, 0, 48, 0, mat);
        addBoxMesh(group, w * 0.82, h - 258, d * 0.82, 0, 258, 0, mat);
        addBoxMesh(group, w * 0.4, 12, d * 0.4, 0, h - 12, 0, MATS.darkSteel, false);
        break;
      }
      case 'flatiron': {
        const geo = new THREE.CylinderGeometry(42, 44, 78, 3, 1);
        geo.rotateY(Math.PI / 2);
        const mesh = new THREE.Mesh(geo, LANDMARK_MATERIALS.limestone);
        mesh.position.y = 39;
        mesh.castShadow = !LOW_POWER;
        group.add(mesh);
        addBoxMesh(group, 16, 9, 22, 0, 78, 0, LANDMARK_MATERIALS.limestoneDark);
        break;
      }
      case 'grandcentral': {
        addBoxMesh(group, 118, 22, 58, 0, 0, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 80, 16, 44, 0, 22, 0, LANDMARK_MATERIALS.limestoneDark);
        addBoxMesh(group, 22, 22, 24, 0, 3, 34, LANDMARK_MATERIALS.limestone);
        addCylinder(group, 8, 8, 33, 0, 1, 32, LANDMARK_MATERIALS.limestoneDark, 12);
        break;
      }
      case 'publiclibrary': {
        addBoxMesh(group, 88, 21, 52, 0, 0, 0, LANDMARK_MATERIALS.whiteStone);
        addBoxMesh(group, 76, 8, 42, 0, 21, 0, LANDMARK_MATERIALS.limestoneDark);
        addBoxMesh(group, 12, 14, 6, 0, 0, 30, LANDMARK_MATERIALS.whiteStone);
        break;
      }
      case 'un': {
        addBoxMesh(group, 38, 150, 96, 0, 0, 0, LANDMARK_MATERIALS.glassBlue);
        addBoxMesh(group, 78, 18, 54, 48, 0, 0, LANDMARK_MATERIALS.limestone);
        addCylinder(group, 18, 20, 18, 48, 18, 0, LANDMARK_MATERIALS.limestoneDark, 18);
        break;
      }
      case 'statue': {
        addBoxMesh(group, 46, 15, 46, 0, 0, 0, LANDMARK_MATERIALS.limestone);
        addBoxMesh(group, 30, 28, 30, 0, 15, 0, LANDMARK_MATERIALS.limestoneDark);
        addCylinder(group, 7, 13, 30, 0, 43, 0, MATS.copper, 9);
        addCylinder(group, 3.2, 4.2, 8, 0, 72, 0, MATS.copper, 8);
        addCylinder(group, 0.8, 0.9, 8, 0, 80, 0, MATS.copper, 6);
        addCylinder(group, 2.5, 2.5, 1.2, 4.5, 82, 0, MATS.torch, 8);
        addCylinder(group, 0.6, 0.9, 14, -3.8, 72, 0, MATS.copper, 5);
        break;
      }
      case 'arch': {
        addBoxMesh(group, 9, 25, 9, -11, 0, 0, LANDMARK_MATERIALS.whiteStone);
        addBoxMesh(group, 9, 25, 9, 11, 0, 0, LANDMARK_MATERIALS.whiteStone);
        addBoxMesh(group, 32, 5, 9, 0, 25, 0, LANDMARK_MATERIALS.whiteStone);
        break;
      }
      case 'billboard': {
        addBoxMesh(group, 28, 95, 24, 0, 0, 0, LANDMARK_MATERIALS.dark);
        addBoxMesh(group, 24, 18, 1, 0, 56, 13, MATS.billboard, false);
        addBoxMesh(group, 24, 13, 1, 0, 76, 13, MATS.billboard, false);
        break;
      }
      case 'cathedral': {
        addBoxMesh(group, 66, 22, 78, 0, 0, 0, LANDMARK_MATERIALS.limestoneDark);
        addBoxMesh(group, 34, 35, 52, 0, 22, 0, LANDMARK_MATERIALS.limestone);
        addCylinder(group, 0.2, 7, 34, -20, 54, -16, LANDMARK_MATERIALS.limestone, 5);
        addCylinder(group, 0.2, 7, 34, 20, 54, -16, LANDMARK_MATERIALS.limestone, 5);
        addCylinder(group, 0.2, 4, 18, 0, 62, 22, LANDMARK_MATERIALS.limestone, 5);
        break;
      }
      case 'brooklyn': {
        addBoxMesh(group, w * 1.2, 20, d * 1.2, 0, 0, 0, mat);
        addBoxMesh(group, w, h * 0.72, d, 0, 20, 0, mat);
        addBoxMesh(group, w * 0.72, h * 0.18, d * 0.72, 0, 20 + h * 0.72, 0, mat);
        addBoxMesh(group, w * 0.3, h * 0.1, d * 0.3, 0, 20 + h * 0.9, 0, MATS.darkSteel, false);
        break;
      }
      case 'stack':
      default: {
        addBoxMesh(group, w * 1.2, Math.min(24, h * 0.16), d * 1.2, 0, 0, 0, mat);
        addBoxMesh(group, w, h * 0.82, d, 0, Math.min(24, h * 0.16), 0, mat);
        addBoxMesh(group, w * 0.7, h * 0.12, d * 0.7, 0, h * 0.88, 0, mat);
        if (h > 160) addCylinder(group, 0.3, 0.7, 18, 0, h, 0, MATS.steel, 5);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Bridges
  // ---------------------------------------------------------------------------
  const BRIDGE_SPECS = [
    {
      id: 'brooklyn', name: 'Brooklyn Bridge', from: [590, 2070], to: [1920, 1850],
      width: 24, deckY: 38, towerH: 88, towerColor: 0xa9a08d, cableColor: 0xbab5a8,
      type: 'suspension', stays: true
    },
    {
      id: 'manhattan', name: 'Manhattan Bridge', from: [680, 2500], to: [2080, 2270],
      width: 28, deckY: 42, towerH: 104, towerColor: 0x647d86, cableColor: 0x7f9498,
      type: 'suspension', stays: false
    },
    {
      id: 'williamsburg', name: 'Williamsburg Bridge', from: [890, 4470], to: [2140, 4380],
      width: 29, deckY: 40, towerH: 99, towerColor: 0x73797b, cableColor: 0x858b87,
      type: 'suspension', stays: false
    },
    {
      id: 'queensboro', name: 'Queensboro Bridge', from: [1120, 7850], to: [2390, 7950],
      width: 28, deckY: 42, towerH: 108, towerColor: 0x777b77, cableColor: 0x83857d,
      type: 'cantilever', stays: false
    },
    {
      id: 'verrazzano', name: 'Verrazzano-Narrows Bridge', from: [1450, -1100], to: [4700, -1260],
      width: 31, deckY: 68, towerH: 205, towerColor: 0x8e5748, cableColor: 0x9e7968,
      type: 'suspension', stays: false
    }
  ];

  function createBridges() {
    bridgeRecords = [];
    for (const spec of BRIDGE_SPECS) {
      bridgeRecords.push(createBridge(spec));
    }
  }

  function createBridge(spec) {
    const from = new THREE.Vector2(spec.from[0], spec.from[1]);
    const to = new THREE.Vector2(spec.to[0], spec.to[1]);
    const dir = to.clone().sub(from);
    const length = dir.length();
    const yaw = Math.atan2(-dir.y, dir.x);
    const group = new THREE.Group();
    group.position.set(from.x, 0, from.y);
    group.rotation.y = yaw;
    group.name = `bridge-${spec.id}`;

    const deckSegments = [];
    const towerGroups = [];
    const cableObjects = [];
    const segmentCount = spec.id === 'verrazzano' ? 10 : 8;
    const segmentLen = length / segmentCount;
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x464a49, roughness: 0.82, metalness: 0.2 });
    const trussMat = new THREE.MeshStandardMaterial({ color: spec.type === 'suspension' ? 0x6e746f : spec.towerColor, roughness: 0.58, metalness: 0.5 });

    for (let i = 0; i < segmentCount; i++) {
      const cx = (i + 0.5) * segmentLen - length / 2;
      const seg = addBridgeBox(group, segmentLen - 5, 2.4, spec.width, cx, spec.deckY, 0, deckMat, false);
      const trussA = addBridgeBox(group, segmentLen - 5, 3.2, 2.2, cx, spec.deckY + 2.4, spec.width / 2 - 1, trussMat, false);
      const trussB = addBridgeBox(group, segmentLen - 5, 3.2, 2.2, cx, spec.deckY + 2.4, -spec.width / 2 + 1, trussMat, false);
      seg.userData.bridgeSeg = true;
      trussA.userData.bridgeSeg = true;
      trussB.userData.bridgeSeg = true;
      const wc = new THREE.Vector3(
        from.x + (dir.x / length) * (cx + length / 2),
        spec.deckY,
        from.y + (dir.y / length) * (cx + length / 2)
      );
      for (const m of [seg, trussA, trussB]) m.userData.bridgeCenter = wc;
      deckSegments.push(seg, trussA, trussB);
    }

    const towerPositions = spec.type === 'cantilever' ? [0.29, 0.71] : [0.25, 0.75];
    for (const frac of towerPositions) {
      const tx = (frac - 0.5) * length;
      const tower = new THREE.Group();
      tower.position.x = tx;
      const legOffset = spec.width / 2 + 4;
      const legW = spec.type === 'suspension' ? 5.2 : 4.4;
      const legMat = new THREE.MeshStandardMaterial({ color: spec.towerColor, roughness: 0.8, metalness: 0.08 });
      const legA = addBridgeBox(tower, legW, spec.towerH, legW, 0, spec.towerH / 2, legOffset, legMat, false);
      const legB = addBridgeBox(tower, legW, spec.towerH, legW, 0, spec.towerH / 2, -legOffset, legMat, false);
      addBridgeBox(tower, legW * 1.5, 7, spec.width + 10, 0, spec.deckY + 2, 0, legMat, false);
      addBridgeBox(tower, legW * 1.2, 4.5, spec.width + 7, 0, spec.towerH - 9, 0, legMat, false);
      addBridgeBox(tower, legW * 0.6, 5, spec.width + 2, 0, spec.towerH - 2, 0, legMat, false);
      legA.userData.bridgeTower = true;
      legB.userData.bridgeTower = true;
      tower.userData.bridgeTowerGroup = true;
      group.add(tower);
      towerGroups.push(tower);
    }

    if (spec.type === 'suspension') {
      const t1 = (towerPositions[0] - 0.5) * length;
      const t2 = (towerPositions[1] - 0.5) * length;
      for (const side of [-1, 1]) {
        const z = side * (spec.width / 2 + 1.2);
        const cablePoints = [];
        cablePoints.push(new THREE.Vector3(-length / 2, spec.deckY + 3, z));
        cablePoints.push(new THREE.Vector3(t1, spec.towerH - 3, z));
        const samples = 30;
        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const x = lerp(t1, t2, t);
          const y = spec.deckY + 6 + (spec.towerH - spec.deckY - 7) * Math.pow(2 * t - 1, 2);
          cablePoints.push(new THREE.Vector3(x, y, z));
        }
        cablePoints.push(new THREE.Vector3(t2, spec.towerH - 3, z));
        cablePoints.push(new THREE.Vector3(length / 2, spec.deckY + 3, z));
        const curve = new THREE.CatmullRomCurve3(cablePoints);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 50, 1.05, 4, false),
          new THREE.MeshStandardMaterial({ color: spec.cableColor, roughness: 0.48, metalness: 0.52 })
        );
        tube.castShadow = false;
        group.add(tube);
        cableObjects.push(tube);

        const susPositions = [];
        const n = 34;
        for (let i = 1; i < n; i++) {
          const x = lerp(t1, t2, i / n);
          const y = spec.deckY + 6 + (spec.towerH - spec.deckY - 7) * Math.pow(2 * (i / n) - 1, 2);
          susPositions.push(x, y, z, x, spec.deckY + 3, z);
        }
        const susGeo = new THREE.BufferGeometry();
        susGeo.setAttribute('position', new THREE.Float32BufferAttribute(susPositions, 3));
        const suspenders = new THREE.LineSegments(
          susGeo,
          new THREE.LineBasicMaterial({ color: spec.cableColor, transparent: true, opacity: 0.72 })
        );
        group.add(suspenders);
        cableObjects.push(suspenders);
      }

      if (spec.stays) {
        for (const side of [-1, 1]) {
          const pos = [];
          const z = side * (spec.width / 2 + 1.5);
          for (const tx of [t1, t2]) {
            for (const frac of [-1, 1]) {
              for (let j = 0; j < 7; j++) {
                const x = tx + frac * (34 + j * 21);
                pos.push(tx, spec.towerH - 10 - j * 5, z, clamp(x, -length / 2, length / 2), spec.deckY + 3, z);
              }
            }
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          const stays = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: spec.cableColor, transparent: true, opacity: 0.56 }));
          group.add(stays);
          cableObjects.push(stays);
        }
      }
    } else {
      const trussMat2 = new THREE.MeshStandardMaterial({ color: spec.towerColor, roughness: 0.62, metalness: 0.45 });
      for (const side of [-1, 1]) {
        addBridgeBox(group, length - 16, 1.2, 2.0, 0, spec.deckY + 10, side * (spec.width / 2 - 2), trussMat2, false);
        for (let i = 0; i < 12; i++) {
          const x = -length / 2 + 40 + i * ((length - 80) / 11);
          addBridgeBox(group, 2.4, 8, 1.8, x, spec.deckY + 5, side * (spec.width / 2 - 2), trussMat2, false, 0, Math.PI / 4);
        }
      }
    }

    const railMat = new THREE.MeshStandardMaterial({ color: 0x747a76, roughness: 0.64, metalness: 0.4 });
    addBridgeBox(group, length, 1.8, 1.5, 0, spec.deckY + 4, spec.width / 2 + 1.2, railMat, false);
    addBridgeBox(group, length, 1.8, 1.5, 0, spec.deckY + 4, -spec.width / 2 - 1.2, railMat, false);

    cityRoot.add(group);
    return {
      ...spec,
      group,
      length,
      yaw,
      deckY: spec.deckY,
      deckSegments,
      towerGroups,
      cableObjects,
      damaged: false,
      damagedCount: 0,
      detached: []
    };
  }

  function addBridgeBox(group, w, h, d, x, y, z, material, roof = false, rotZ = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (roof) {
      geo.clearGroups();
      geo.addGroup(0, 12, 0);
      geo.addGroup(12, 12, 1);
      geo.addGroup(24, 12, 0);
    }
    const mesh = new THREE.Mesh(geo, roof ? [material, MATS.roof] : material);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.z = rotZ;
    mesh.castShadow = !LOW_POWER;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // Trees
  // ---------------------------------------------------------------------------
  function createTrees() {
    treeRecords = [];
    treeSystems = { trunk: null, canopy: null };
    const treeData = [];
    const rng = mulberry32(73019);
    for (const park of PARK_AREAS) {
      const b = polygonBounds(park.poly);
      const target = Math.round((park.trees || 20) * (LOW_POWER ? 0.55 : 1));
      let made = 0;
      for (let attempt = 0; attempt < target * 9 && made < target; attempt++) {
        const x = lerp(b.x0, b.x1, rng());
        const z = lerp(b.z0, b.z1, rng());
        if (!pointInPoly(x, z, park.poly)) continue;
        if (!inAnyLand(x, z)) continue;
        if (park.lakes) {
          let inLake = false;
          for (const [lx, lz, lw, lh] of park.lakes) {
            if (((x - lx) / lw) ** 2 + ((z - lz) / lh) ** 2 < 0.8) { inLake = true; break; }
          }
          if (inLake) continue;
        }
        if (inLandmarkExclusion(x, z, 4)) continue;
        treeData.push({ x, z, scale: 0.7 + rng() * 0.8, colorSeed: rng() });
        made++;
      }
    }

    if (!treeData.length) return;

    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.1, 1, 5).translate(0, 0.5, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x55453a, roughness: 1 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeData.length);
    const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, treeData.length);
    trunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    canopyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trunkMesh.castShadow = false;
    canopyMesh.castShadow = !LOW_POWER;
    trunkMesh.frustumCulled = false;
    canopyMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    treeData.forEach((t, i) => {
      const h = 6 + t.scale * 8;
      dummy.position.set(t.x, 0.3, t.z);
      dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.colorSeed * TAU);
      dummy.scale.set(1.1 * t.scale, h, 1.1 * t.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, 0.3 + h * 0.78, t.z);
      dummy.scale.set((3.4 + t.scale * 2.6), (4.2 + t.scale * 3.2), (3.4 + t.scale * 2.6));
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i, dummy.matrix);
      color.setHex(t.colorSeed > 0.6 ? 0x456642 : t.colorSeed > 0.26 ? 0x36583a : 0x587549);
      canopyMesh.setColorAt(i, color);
      treeRecords.push({
        x: t.x, z: t.z, scale: t.scale, trunkIndex: i, canopyIndex: i,
        trunkMesh, canopyMesh, destroyed: false, burned: false
      });
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
    cityRoot.add(trunkMesh);
    cityRoot.add(canopyMesh);
    treeSystems.trunk = trunkMesh;
    treeSystems.canopy = canopyMesh;
  }

  // ---------------------------------------------------------------------------
  // City lifecycle
  // ---------------------------------------------------------------------------
  function buildCity() {
    if (cityRoot) {
      scene.remove(cityRoot);
      disposeGroup(cityRoot);
    }
    cityRoot = new THREE.Group();
    cityRoot.name = 'city';
    scene.add(cityRoot);

    buildingRecords = [];
    landmarks = [];
    bridgeRecords = [];
    treeRecords = [];
    fireSpawnPoints = [];
    generateBuildings();
    createInstancedBuildings();
    createLandmarks();
    createBridges();
    createTrees();
    state.totalStructures = buildingRecords.length + landmarks.length;
  }

  function disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!SHARED_MATERIALS.has(m)) m.dispose();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Particle and debris effects
  // ---------------------------------------------------------------------------
  let smokeTexture = null;
  let glowTexture = null;
  let dustTexture = null;
  let activeParticleSystems = [];
  let sharedEffectTextures = [];

  function makeRadialTexture(size, softness, noise) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const rng = mulberry32(8811 + size);
    if (noise) {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 22; i++) {
        const x = size * (0.5 + (rng() - 0.5) * 0.46);
        const y = size * (0.5 + (rng() - 0.5) * 0.46);
        const r = size * (0.08 + rng() * (noise ? 0.28 : 0.18));
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(255,255,255,${0.16 + rng() * 0.2})`);
        grad.addColorStop(0.55, `rgba(255,255,255,${0.08 + rng() * 0.12})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(Math.min(0.92, softness), 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.46)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function initEffectTextures() {
    smokeTexture = makeRadialTexture(128, 0.62, 1);
    glowTexture = makeRadialTexture(128, 0.24, 0.7);
    dustTexture = makeRadialTexture(96, 0.56, 0.8);
    sharedEffectTextures = [smokeTexture, glowTexture, dustTexture];
  }

  function updateParticleScale() {
    if (!renderer || !camera) return;
    const scale = renderer.domElement.height / (2 * Math.tan(deg(camera.fov) / 2));
    for (const sys of activeParticleSystems) {
      if (sys.material.uniforms.uPixelScale) sys.material.uniforms.uPixelScale.value = scale;
    }
  }

  function createParticleSystem(count, texture, blending = THREE.NormalBlending, renderOrder = 4) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, count);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uPixelScale: { value: renderer.domElement.height / (2 * Math.tan(deg(camera.fov) / 2)) }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixelScale / max(1.0, -mv.z), 1.0, 900.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor;
          vAlpha = aAlpha;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.008) discard;
          gl_FragColor = vec4(vColor, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending,
      vertexColors: false
    });

    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    points.renderOrder = renderOrder;
    effectsRoot.add(points);

    const pool = new Array(count);
    for (let i = 0; i < count; i++) {
      pool[i] = {
        alive: false, age: 0, delay: 0, life: 1,
        px: 0, py: -9999, pz: 0, vx: 0, vy: 0, vz: 0,
        size0: 1, size1: 1, alpha: 1, drag: 0, buoyancy: 0,
        gravity: 0, color: new THREE.Color(1, 1, 1),
        colorEnd: null, colorStart: new THREE.Color(1, 1, 1), colorMix: 0
      };
      positions[i * 3 + 1] = -9999;
    }

    const sys = {
      count,
      cursor: 0,
      pool,
      geo,
      material,
      points,
      positions,
      sizes,
      colors,
      alphas,
      spawn(opts) {
        const p = this.pool[this.cursor];
        this.cursor = (this.cursor + 1) % this.count;
        p.alive = true;
        p.age = 0;
        p.delay = opts.delay || 0;
        p.life = opts.life || 1;
        p.px = opts.x || 0;
        p.py = opts.y || 0;
        p.pz = opts.z || 0;
        p.vx = opts.vx || 0;
        p.vy = opts.vy || 0;
        p.vz = opts.vz || 0;
        p.size0 = opts.size0 ?? 10;
        p.size1 = opts.size1 ?? 20;
        p.alpha = opts.alpha ?? 1;
        p.drag = opts.drag ?? 0.2;
        p.buoyancy = opts.buoyancy || 0;
        p.gravity = opts.gravity || 0;
        if (opts.color !== undefined) p.color.set(opts.color);
        else p.color.setRGB(1, 1, 1);
        p.colorStart.copy(p.color);
        if (opts.colorEnd !== undefined) {
          if (!p.colorEnd) p.colorEnd = new THREE.Color();
          p.colorEnd.set(opts.colorEnd);
        } else {
          p.colorEnd = null;
        }
        return p;
      },
      update(dt) {
        let dirty = false;
        for (let i = 0; i < this.count; i++) {
          const p = this.pool[i];
          if (!p.alive) {
            if (this.alphas[i] !== 0) {
              this.alphas[i] = 0;
              this.sizes[i] = 0;
              this.positions[i * 3 + 1] = -9999;
              dirty = true;
            }
            continue;
          }
          p.age += dt;
          const local = p.age - p.delay;
          if (local < 0) {
            this.alphas[i] = 0;
            this.sizes[i] = 0;
            dirty = true;
            continue;
          }
          if (local >= p.life) {
            p.alive = false;
            this.alphas[i] = 0;
            this.sizes[i] = 0;
            this.positions[i * 3 + 1] = -9999;
            dirty = true;
            continue;
          }
          p.vy += (p.buoyancy + p.gravity) * dt;
          const drag = Math.max(0, 1 - p.drag * dt);
          p.vx *= drag;
          p.vy *= drag;
          p.vz *= drag;
          p.px += p.vx * dt;
          p.py += p.vy * dt;
          p.pz += p.vz * dt;
          if (p.py < 2) {
            p.py = 2;
            p.vy *= -0.12;
            p.vx *= 0.8;
            p.vz *= 0.8;
          }
          const t = local / p.life;
          const ease = 1 - Math.pow(1 - Math.min(1, t * 2.7), 2.2);
          const size = lerp(p.size0, p.size1, ease);
          const fadeIn = Math.min(1, t / 0.06);
          const fadeOut = 1 - Math.max(0, (t - 0.7) / 0.3);
          this.alphas[i] = p.alpha * fadeIn * Math.max(0, fadeOut);
          this.sizes[i] = size;
          this.positions[i * 3] = p.px;
          this.positions[i * 3 + 1] = p.py;
          this.positions[i * 3 + 2] = p.pz;
          if (p.colorEnd) {
            const mix = Math.min(1, Math.pow(t, 0.7) * 1.25);
            p.color.copy(p.colorStart).lerp(p.colorEnd, mix);
          }
          this.colors[i * 3] = p.color.r;
          this.colors[i * 3 + 1] = p.color.g;
          this.colors[i * 3 + 2] = p.color.b;
          dirty = true;
        }
        if (dirty) {
          this.geo.attributes.position.needsUpdate = true;
          this.geo.attributes.aSize.needsUpdate = true;
          this.geo.attributes.aColor.needsUpdate = true;
          this.geo.attributes.aAlpha.needsUpdate = true;
        }
      },
      reset() {
        for (let i = 0; i < this.count; i++) {
          this.pool[i].alive = false;
          this.alphas[i] = 0;
          this.sizes[i] = 0;
          this.positions[i * 3 + 1] = -9999;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;
      }
    };
    activeParticleSystems.push(sys);
    return sys;
  }

  function makeDebrisSystem(capacity) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.02 });
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = !LOW_POWER;
    mesh.receiveShadow = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, zero);
      mesh.setColorAt(i, new THREE.Color(0x77736a));
    }
    effectsRoot.add(mesh);
    return {
      mesh,
      capacity,
      cursor: 0,
      dummy: new THREE.Object3D(),
      tempColor: new THREE.Color(),
      particles: [],
      spawn(opts) {
        const slot = this.cursor;
        this.cursor = (this.cursor + 1) % this.capacity;
        let p = this.particles[slot];
        if (!p) {
          p = { quat: new THREE.Quaternion(), axis: new THREE.Vector3(0, 1, 0), angle: 0, alive: false };
          this.particles[slot] = p;
        }
        p.alive = true;
        p.x = opts.x; p.y = opts.y; p.z = opts.z;
        p.vx = opts.vx; p.vy = opts.vy; p.vz = opts.vz;
        p.sx = opts.sx; p.sy = opts.sy; p.sz = opts.sz;
        p.gravity = opts.gravity ?? 20;
        p.life = opts.life ?? 7;
        p.age = 0;
        p.quat.setFromEuler(new THREE.Euler(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU));
        p.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        p.angle = (Math.random() * 3 - 1.5) * 2.4;
        p.settled = false;
        this.mesh.setColorAt(slot, this.tempColor.setHex(opts.color ?? 0x77736a));
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      },
      update(dt) {
        let dirty = false;
        const dummy = this.dummy;
        for (let i = 0; i < this.capacity; i++) {
          const p = this.particles[i];
          if (!p || !p.alive) continue;
          p.age += dt;
          if (p.age > p.life) {
            p.alive = false;
            dummy.position.set(0, -9999, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
            dirty = true;
            continue;
          }
          if (!p.settled) {
            p.vy -= p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.angle += (p.vx + p.vz) * dt * 0.01;
            if (p.y < p.sy * 0.5 + 1) {
              p.y = p.sy * 0.5 + 1;
              p.vy = Math.abs(p.vy) * 0.16;
              p.vx *= 0.64;
              p.vz *= 0.64;
              if (Math.abs(p.vy) < 1.2) {
                p.settled = true;
                p.vx = p.vz = p.vy = 0;
              }
            }
          }
          const fade = p.age > p.life - 1.6 ? Math.max(0, (p.life - p.age) / 1.6) : 1;
          dummy.position.set(p.x, p.y, p.z);
          dummy.quaternion.copy(p.quat);
          dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(p.axis, p.angle));
          dummy.scale.set(p.sx * fade, p.sy * fade, p.sz * fade);
          dummy.updateMatrix();
          this.mesh.setMatrixAt(i, dummy.matrix);
          dirty = true;
        }
        if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
      },
      reset() {
        this.particles = [];
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, zero);
        this.mesh.instanceMatrix.needsUpdate = true;
      }
    };
  }

  function spawnDebrisBurst(rec, blast, strength = 1) {
    if (!debrisSystem) return;
    const count = LOW_POWER ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const speed = (35 + Math.random() * 150) * strength;
      debrisSystem.spawn({
        x: rec.x + (Math.random() - 0.5) * rec.w * 0.5,
        y: 3 + Math.random() * Math.min(rec.h, 90),
        z: rec.z + (Math.random() - 0.5) * rec.d * 0.5,
        vx: Math.cos(a) * speed + (rec.x - blast.x) * 0.12,
        vy: 15 + Math.random() * 70 * strength,
        vz: Math.sin(a) * speed + (rec.z - blast.z) * 0.12,
        sx: 2.5 + Math.random() * Math.min(16, rec.w * 0.24),
        sy: 2 + Math.random() * Math.min(14, rec.h * 0.1),
        sz: 2.5 + Math.random() * Math.min(16, rec.d * 0.24),
        color: Math.random() > 0.4 ? 0x6b675d : 0x8b8476,
        life: 5 + Math.random() * 3,
        gravity: 19
      });
    }
  }

  function spawnDustCloud(x, z, radius, amount = 20, height = 30) {
    if (!state.smoke) return;
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * radius;
      const s = 30 + Math.random() * 70;
      state.smoke.spawn({
        x: x + Math.cos(a) * r,
        y: 5 + Math.random() * height,
        z: z + Math.sin(a) * r,
        vx: Math.cos(a) * s,
        vy: 8 + Math.random() * 25,
        vz: Math.sin(a) * s,
        size0: 30 + Math.random() * 70,
        size1: 140 + Math.random() * 260,
        life: 2.8 + Math.random() * 4,
        alpha: 0.32 + Math.random() * 0.22,
        drag: 1.2,
        buoyancy: 1.5,
        color: Math.random() > 0.45 ? 0x827b6e : 0x5c5750
      });
    }
  }

  function addBuildingFire(x, z, y, intensity = 1) {
    if (fireSpawnPoints.length < (LOW_POWER ? 28 : 48)) {
      fireSpawnPoints.push({ x, z, y, intensity });
    }
    if (state.smoke) {
      state.smoke.spawn({
        x, y: y + 5, z,
        vx: (Math.random() - 0.5) * 8,
        vy: 18 + Math.random() * 25,
        vz: (Math.random() - 0.5) * 8,
        size0: 8 + Math.random() * 18,
        size1: 70 + Math.random() * 90 * intensity,
        life: 3 + Math.random() * 4,
        alpha: 0.28,
        drag: 0.4,
        buoyancy: 7,
        color: 0x4e4a43
      });
    }
    if (state.glow) {
      state.glow.spawn({
        x, y: y + 4, z,
        vx: (Math.random() - 0.5) * 5,
        vy: 8 + Math.random() * 14,
        vz: (Math.random() - 0.5) * 5,
        size0: 10 + Math.random() * 20,
        size1: 25 + Math.random() * 45,
        life: 0.8 + Math.random() * 1.5,
        alpha: 0.8,
        drag: 0.7,
        buoyancy: 2,
        color: Math.random() > 0.5 ? 0xff7a24 : 0xffc44f
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Target marker and falling weapon
  // ---------------------------------------------------------------------------
  let targetRings = null;
  let bombObject = null;
  let bombFall = null;
  let bombLight = null;

  function makeCircleGeometry(segments = 128) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * TAU;
      pts.push(Math.cos(a), 0, Math.sin(a));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }

  function clearTargetMarker() {
    if (!targetRoot) return;
    disposeGroup(targetRoot);
    targetRoot.clear();
    targetRings = null;
  }

  function makeRingLabel(text, color, radius) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = `700 46px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8, 11, 12, 0.72)';
    const w = ctx.measureText(text).width + 38;
    ctx.beginPath();
    ctx.roundRect(256 - w / 2, 22, w, 84, 10);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false
    }));
    const width = clamp(radius * 0.16, 150, 3000);
    sprite.scale.set(width, width * 0.25, 1);
    sprite.renderOrder = 8;
    return sprite;
  }

  function showTargetMarker(x, z, fx) {
    clearTargetMarker();
    const accent = 0xffc25c;

    const crossMat = new THREE.LineBasicMaterial({
      color: accent, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false
    });
    const cs = 55;
    const crossPts = [-cs, 0, 0, cs, 0, 0, 0, 0, -cs, 0, 0, cs];
    const crossGeo = new THREE.BufferGeometry();
    crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossPts, 3));
    const cross = new THREE.LineSegments(crossGeo, crossMat);
    cross.position.set(x, 5, z);
    cross.renderOrder = 7;
    targetRoot.add(cross);

    const dot = new THREE.Mesh(
      new THREE.RingGeometry(20, 34, 32),
      new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.95,
        side: THREE.DoubleSide, depthWrite: false, depthTest: false
      })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 4, z);
    dot.renderOrder = 7;
    targetRoot.add(dot);

    const ringDefs = [
      { radius: fx.r20, color: '#ff4a3d', label: '20 PSI', opacity: 0.8, alpha: 0.1 },
      { radius: fx.r5, color: '#ff9d3d', label: '5 PSI', opacity: 0.72, alpha: 0.07 },
      { radius: fx.thermal, color: '#ffe37a', label: 'THERMAL', opacity: 0.6, alpha: 0.045 },
      { radius: fx.r1, color: '#9fb9c2', label: '1 PSI', opacity: 0.5, alpha: 0.03 }
    ];
    if (fx.crater) {
      ringDefs.unshift({ radius: fx.crater, color: '#e3d2ae', label: 'CRATER', opacity: 0.95, alpha: 0.16 });
    }
    const rings = [];
    const fills = [];
    for (const def of ringDefs) {
      const band = new THREE.Mesh(
        new THREE.RingGeometry(0.975, 1, 160),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(def.color), transparent: true, opacity: def.opacity,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      band.rotation.x = -Math.PI / 2;
      band.scale.setScalar(def.radius);
      band.position.set(x, 3.2, z);
      band.renderOrder = 5;
      targetRoot.add(band);
      rings.push(band);

      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(1, 96),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(def.color), transparent: true, opacity: def.alpha,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      fill.rotation.x = -Math.PI / 2;
      fill.scale.setScalar(def.radius);
      fill.position.set(x, 3, z);
      fill.renderOrder = 4;
      targetRoot.add(fill);
      fills.push(fill);

      const label = makeRingLabel(def.label, def.color, def.radius);
      label.position.set(x + def.radius * 0.72, 12, z - def.radius * 0.72);
      targetRoot.add(label);
    }

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffae4a, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, Math.max(200, fx.hob), 6, 1, true),
      beamMat
    );
    beam.position.set(x, Math.max(200, fx.hob) / 2, z);
    targetRoot.add(beam);

    const high = Math.max(1500, fx.hob * 4);
    const trajGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 2, z),
      new THREE.Vector3(x, high, z)
    ]);
    const traj = new THREE.Line(
      trajGeo,
      new THREE.LineDashedMaterial({
        color: 0xffc25c, transparent: true, opacity: 0.32,
        dashSize: 42, gapSize: 30, depthWrite: false
      })
    );
    traj.computeLineDistances();
    targetRoot.add(traj);

    targetRings = { x, z, fx, rings, fills, group: targetRoot, helpers: [beam, traj] };
  }

  function buildMeteorObject(group, size) {
    group.scale.setScalar(size);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    const rng = mulberry32(4242);
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(0.68 + rng() * 0.62);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x3b3530, roughness: 0.95, metalness: 0.12,
      emissive: 0xff5a12, emissiveIntensity: 1.5
    }));
    group.add(rock);

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffe0a8, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    core.scale.set(6, 6, 1);
    group.add(core);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xff7a22, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.set(14, 14, 1);
    group.add(halo);

    const flame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 2.7, 7.5, 9, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff9a44, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    flame.position.y = 5.4;
    group.add(flame);

    const smoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 4.2, 34, 9, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8d8579, transparent: true, opacity: 0.16,
        depthWrite: false, side: THREE.DoubleSide
      })
    );
    smoke.position.y = 22;
    group.add(smoke);
  }

  function createBombObject(x, y, z, opts = {}) {
    bombRoot.clear();
    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (opts.meteor) {
      buildMeteorObject(group, opts.size || 12);
      bombRoot.add(group);
      bombObject = group;
      bombFall = bombFall || {};
      bombLight = new THREE.PointLight(0xff8a3a, 14, 9000, 1.5);
      bombLight.position.copy(group.position);
      bombRoot.add(bombLight);
      return group;
    }

    group.scale.setScalar(3.4);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb9bbb3, roughness: 0.32, metalness: 0.85 });
    const finMat = new THREE.MeshStandardMaterial({ color: 0x3f4547, roughness: 0.61, metalness: 0.48 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 16, 12), bodyMat);
    group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 12), bodyMat);
    nose.rotation.x = Math.PI;
    nose.position.y = -11;
    group.add(nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 4.4), finMat);
      const a = (i / 4) * TAU;
      fin.position.set(Math.cos(a) * 2.6, 7, Math.sin(a) * 2.6);
      fin.rotation.y = -a;
      group.add(fin);
    }

    const beaconMat = new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffb45e, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const beacon = new THREE.Sprite(beaconMat);
    beacon.scale.set(34, 34, 1);
    group.add(beacon);

    const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xff7f2e, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    beaconHalo.scale.set(88, 88, 1);
    group.add(beaconHalo);

    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xffb15d, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.3, 120, 8, 1, true), trailMat);
    trail.position.y = 68;
    group.add(trail);

    const smokeTrailMat = new THREE.MeshBasicMaterial({
      color: 0xd8d3c4, transparent: true, opacity: 0.12, depthWrite: false
    });
    const smokeTrail = new THREE.Mesh(new THREE.CylinderGeometry(5, 1.4, 420, 8, 1, true), smokeTrailMat);
    smokeTrail.position.y = 218;
    group.add(smokeTrail);

    bombRoot.add(group);
    bombObject = group;
    bombFall = bombFall || {};
    bombFall.beacon = beacon;

    bombLight = new THREE.PointLight(0xffaa55, 9, 2200, 1.8);
    bombLight.position.copy(group.position);
    bombRoot.add(bombLight);
    return group;
  }

  function clearBomb() {
    if (bombRoot) {
      disposeGroup(bombRoot);
      bombRoot.clear();
    }
    bombObject = null;
    bombLight = null;
    bombFall = null;
    dom.altimeter.hidden = true;
  }

  function beginCameraTween(to, duration = 1.2) {
    if (!to) return;
    cameraRig.tween = {
      start: elapsed,
      duration,
      from: {
        tx: cameraRig.target.x,
        tz: cameraRig.target.z,
        ty: cameraRig.targetY,
        distance: cameraRig.distance,
        azimuth: cameraRig.azimuth,
        pitch: cameraRig.pitch
      },
      to: {
        tx: to.tx ?? cameraRig.target.x,
        tz: to.tz ?? cameraRig.target.z,
        ty: to.ty ?? cameraRig.targetY,
        distance: to.distance ?? cameraRig.distance,
        azimuth: to.azimuth ?? cameraRig.azimuth,
        pitch: to.pitch ?? cameraRig.pitch
      }
    };
  }

  function updateCameraTween() {
    const t = cameraRig.tween;
    if (!t) return;
    const u = clamp((elapsed - t.start) / t.duration, 0, 1);
    const e = easeInOutCubic(u);
    cameraRig.target.x = lerp(t.from.tx, t.to.tx, e);
    cameraRig.target.z = lerp(t.from.tz, t.to.tz, e);
    cameraRig.targetY = lerp(t.from.ty, t.to.ty, e);
    cameraRig.distance = lerp(t.from.distance, t.to.distance, e);
    cameraRig.azimuth = lerpAngle(t.from.azimuth, t.to.azimuth, e);
    cameraRig.pitch = lerp(t.from.pitch, t.to.pitch, e);
    if (u >= 1) cameraRig.tween = null;
  }

  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  }

  // Clicking the map sounds the air-raid siren for five seconds, then the
  // weapon is released.
  const ALERT_MS = 5000;
  let alertPending = null;
  let alertEnd = 0;
  let alertTimer = 0;

  function armStrike(x, z, onLand) {
    if (state.phase === 'falling' || state.phase === 'blast' || state.phase === 'alert') return;
    alertPending = { x, z, onLand, from: state.phase };
    alertEnd = performance.now() + ALERT_MS;
    alertTimer = setTimeout(releaseAlert, ALERT_MS);
    state.phase = 'alert';
    document.body.dataset.phase = 'alert';
    setInputEnabled(false);
    setStatus('AIR RAID ALERT', 'DETONATION IN 5.0s', 'falling');
    dom.hintText.textContent = isMeteor(selectedWeapon)
      ? 'Impact imminent — brace for impact'
      : 'Airburst imminent — brace for shockwave';
    playSiren();
  }

  function cancelAlert() {
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = 0;
    alertPending = null;
    stopSiren();
  }

  function releaseAlert() {
    if (!alertPending) return;
    const pending = alertPending;
    cancelAlert();
    state.phase = pending.from;
    launchAt(pending.x, pending.z, pending.onLand);
  }

  function updateAlert() {
    if (!alertPending) return;
    const remain = Math.max(0, (alertEnd - performance.now()) / 1000);
    dom.statusDetail.textContent = `DETONATION IN ${remain.toFixed(1)}s`;
  }

  function launchAt(x, z, onLand) {
    if (state.phase === 'falling' || state.phase === 'blast') return;
    if (state.phase === 'aftermath') {
      // Start a fresh strike on the already-damaged city.
      clearCombatEffects();
      clearTargetMarker();
    }
    ensureAudio();
    const weapon = selectedWeapon;
    const meteor = isMeteor(weapon);
    const fx = effectsForWeapon(weapon);
    state.phase = 'falling';
    state.weapon = weapon;
    state.effects = fx;
    state.target = new THREE.Vector2(x, z);
    state.targetOnLand = onLand;
    state.destroyed = 0;
    state.landmarksDestroyed = 0;
    state.bridgesDamaged = 0;
    state.pending = [];
    state.pendingIndex = 0;
    state.collapsers = [];
    state.landCollapsers = [];
    state.fallingBridges = [];
    state.activeTimers = [];
    state.blastStart = 0;
    state.reportStart = 0;

    dom.report.hidden = true;
    setInputEnabled(false);
    document.body.dataset.phase = 'falling';
    dom.status.dataset.state = 'falling';
    dom.statusLabel.textContent = meteor ? 'IMPACTOR INBOUND' : 'WEAPON RELEASED';
    const startY = meteor
      ? clamp(Math.max(2600, fx.r5 * 0.55, 2400), 2400, 32000)
      : fx.hob + Math.max(1300, fx.hob * 0.5);
    const entry = meteor
      ? clamp(fx.r5 * 0.55, 900, 18000)
      : 0;
    showTargetMarker(x, z, fx);
    createBombObject(x, startY, z, { meteor, size: meteor ? clamp(Math.pow(weapon.yieldKt, 0.28) * 2.2, 6, 160) : 0 });
    bombFall = {
      start: elapsed,
      duration: meteor ? 2.1 : weapon.yieldKt > 1000 ? 3.1 : 2.7,
      startY,
      endY: fx.hob,
      startX: x - entry * 0.62,
      startZ: z - entry * 0.78,
      x,
      z
    };
    dom.altimeter.hidden = false;
    dom.altLabel.textContent = meteor ? 'IMPACTOR ALTITUDE' : 'WEAPON ALTITUDE';
    dom.altitude.textContent = `${Math.round(startY).toLocaleString('en-US')} M`;
    dom.hintText.textContent = meteor
      ? 'Impactor inbound — brace for impact'
      : 'Airburst inbound — brace for shockwave';
    playFallWhoosh(bombFall.duration, weapon.yieldKt, meteor);

    const distanceGoal = clamp(Math.max(fx.r5 * 4.0, 4200), 4200, 45000);
    beginCameraTween({
      tx: x,
      tz: z,
      ty: meteor ? startY * 0.32 : fx.hob * 0.75,
      distance: distanceGoal,
      azimuth: cameraRig.azimuth,
      pitch: IS_SMALL ? 0.42 : 0.36
    }, 1.7);
  }

  function updateBombFall() {
    if (!bombFall || !bombObject) return;
    const meteor = isMeteor(state.weapon);
    const u = clamp((elapsed - bombFall.start) / bombFall.duration, 0, 1);
    const fallEase = u * u;
    const y = lerp(bombFall.startY, bombFall.endY, fallEase);
    const px = lerp(bombFall.startX ?? bombFall.x, bombFall.x, fallEase);
    const pz = lerp(bombFall.startZ ?? bombFall.z, bombFall.z, fallEase);
    bombObject.position.set(px, y, pz);
    if (meteor) {
      bombObject.rotation.x += frameDt * 2.1;
      bombObject.rotation.z += frameDt * 1.5;
    } else {
      bombObject.rotation.y += frameDt * 0.7;
      bombObject.rotation.z = Math.sin(u * 19) * 0.06;
    }
    if (bombLight) {
      bombLight.position.set(px, y, pz);
      bombLight.intensity = meteor
        ? 9 + Math.sin(elapsed * 22) * 3
        : 4 + Math.sin(elapsed * 18) * 1.5;
    }
    dom.altitude.textContent = `${Math.round(y).toLocaleString('en-US')} M`;
    const remain = Math.max(0, bombFall.duration * (1 - u));
    dom.statusDetail.textContent = `${meteor ? 'IMPACT' : 'AIRBURST'} IN ${remain.toFixed(1)}s · ${Math.round(y).toLocaleString('en-US')} M`;
    if (u >= 1) {
      const x = bombFall.x;
      const z = bombFall.z;
      clearBomb();
      detonate(x, z);
    }
  }

  // ---------------------------------------------------------------------------
  // Detonation, blast damage and fallout
  // ---------------------------------------------------------------------------
  const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
  const _dummy = new THREE.Object3D();
  const _yawQuat = new THREE.Quaternion();
  const _tiltQuat = new THREE.Quaternion();
  const _axis = new THREE.Vector3();
  const _tempColor = new THREE.Color();
  const _up = new THREE.Vector3(0, 1, 0);

  function clearCombatEffects() {
    activeParticleSystems = [];
    debrisSystem = null;
    state.smoke = null;
    state.plume = null;
    state.glow = null;
    state.debris = null;
    state.explosionVisuals = null;
    fireSpawnPoints = [];
    state.fireTimer = 0;
    if (effectsRoot) {
      disposeGroup(effectsRoot);
      effectsRoot.clear();
    }
    if (bombRoot) {
      disposeGroup(bombRoot);
      bombRoot.clear();
    }
    bombObject = null;
    bombLight = null;
    bombFall = null;
    dom.altimeter.hidden = true;
  }

  function makeScorchTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(14,12,10,0.88)');
    g.addColorStop(0.38, 'rgba(23,20,17,0.72)');
    g.addColorStop(0.72, 'rgba(35,31,25,0.27)');
    g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const rng = mulberry32(6812);
    for (let i = 0; i < 90; i++) {
      const a = rng() * TAU;
      const rr = rng() * 114;
      const x = 128 + Math.cos(a) * rr;
      const y = 128 + Math.sin(a) * rr;
      const s = 2 + rng() * 11;
      ctx.fillStyle = `rgba(10,9,8,${0.04 + rng() * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const NOISE_GLSL = `
    float gzHash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float gzNoise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = gzHash(i + vec3(0.0, 0.0, 0.0));
      float n100 = gzHash(i + vec3(1.0, 0.0, 0.0));
      float n010 = gzHash(i + vec3(0.0, 1.0, 0.0));
      float n110 = gzHash(i + vec3(1.0, 1.0, 0.0));
      float n001 = gzHash(i + vec3(0.0, 0.0, 1.0));
      float n101 = gzHash(i + vec3(1.0, 0.0, 1.0));
      float n011 = gzHash(i + vec3(0.0, 1.0, 1.0));
      float n111 = gzHash(i + vec3(1.0, 1.0, 1.0));
      return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
      );
    }
    float gzFbm(vec3 p) {
      float total = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        total += gzNoise(p) * amp;
        p *= 2.03;
        amp *= 0.5;
      }
      return total;
    }
  `;

  function createFireballMesh(radiusScale, colorHot, colorMid, colorOuter, opacity) {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uHot: { value: new THREE.Color(colorHot) },
        uMid: { value: new THREE.Color(colorMid) },
        uOuter: { value: new THREE.Color(colorOuter) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying float vNoise;
        ${NOISE_GLSL}
        void main() {
          vec3 n = normalize(position);
          float n1 = gzFbm(n * 3.4 + vec3(0.0, uTime * 0.32, 0.0));
          float n2 = gzFbm(n * 8.5 - vec3(uTime * 0.22, 0.0, 0.0));
          vNoise = n1 * 0.68 + n2 * 0.32;
          vec3 displaced = position * (1.0 + (vNoise - 0.5) * 0.4);
          vec4 world = modelMatrix * vec4(displaced, 1.0);
          vPosW = world.xyz;
          vNormalW = normalize(mat3(modelMatrix) * n);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uHot;
        uniform vec3 uMid;
        uniform vec3 uOuter;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying float vNoise;
        void main() {
          vec3 view = normalize(cameraPosition - vPosW);
          float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), view)), 2.0);
          float core = smoothstep(0.28, 0.92, vNoise);
          vec3 color = mix(uMid, uHot, core);
          color = mix(color, uOuter, fresnel * 0.72);
          color += uHot * pow(core, 2.5) * 0.7;
          gl_FragColor = vec4(color, uOpacity * (0.94 - fresnel * 0.2));
        }
      `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radiusScale, 40, 24), material);
    mesh.frustumCulled = false;
    return mesh;
  }

  function createShockwaveDust(x, z, radius, color, count, opts = {}) {
    const geo = new THREE.BufferGeometry();
    const angles = new Float32Array(count);
    const jitter = new Float32Array(count);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const heights = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      angles[i] = a;
      jitter[i] = Math.random();
      sizes[i] = (opts.sizeMin ?? 90) + Math.random() * (opts.sizeMax ?? 260);
      alphas[i] = (opts.alphaMin ?? 0.28) + Math.random() * (opts.alphaMax ?? 0.34);
      heights[i] = 10 + Math.random() * (opts.height ?? 100);
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = heights[i];
      positions[i * 3 + 2] = Math.sin(a) * radius;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geo.setAttribute('aJitter', new THREE.BufferAttribute(jitter, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uMap: { value: dustTexture },
        uPixelScale: { value: renderer.domElement.height / (2 * Math.tan(deg(camera.fov) / 2)) },
        uRadius: { value: radius * 0.15 },
        uFade: { value: 1 },
        uColor: { value: new THREE.Color(color) },
        uTimescale: { value: opts.timescale ?? 1 }
      },
      vertexShader: `
        attribute float aAngle;
        attribute float aJitter;
        attribute float aSize;
        attribute float aAlpha;
        attribute float aHeight;
        uniform float uRadius;
        uniform float uPixelScale;
        varying float vAlpha;
        varying float vJitter;
        void main() {
          float r = uRadius * (0.92 + aJitter * 0.15);
          vec3 p = vec3(cos(aAngle) * r, aHeight * (0.4 + aJitter * 0.75), sin(aAngle) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(aSize * uPixelScale / max(1.0, -mv.z), 1.0, 700.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = aAlpha;
          vJitter = aJitter;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uFade;
        uniform vec3 uColor;
        varying float vAlpha;
        varying float vJitter;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.01) discard;
          gl_FragColor = vec4(uColor * (0.85 + vJitter * 0.3), tex.a * vAlpha * uFade);
        }
      `
    });
    const points = new THREE.Points(geo, material);
    points.position.set(x, 0, z);
    points.frustumCulled = false;
    points.renderOrder = 4;
    return {
      points,
      material,
      radius: radius,
      update(t, duration) {
        const p = clamp(t / duration, 0, 1);
        material.uniforms.uRadius.value = radius * (0.15 + 0.85 * easeOutCubic(p));
        material.uniforms.uFade.value = Math.pow(1 - p, 1.5);
        points.visible = p < 1;
      }
    };
  }

  function makeCraterTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const cx = 256;
    const cy = 256;
    const rimR = 118;
    const rng = mulberry32(90210);

    // Ejecta blanket streaking outward past the rim.
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 220; i++) {
      const a = rng() * TAU;
      const len = rimR + 8 + rng() * 128;
      const color = `rgba(${Math.round(120 + rng() * 40)}, ${Math.round(108 + rng() * 34)}, ${Math.round(88 + rng() * 30)}, ${(0.05 + rng() * 0.22).toFixed(3)})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 + rng() * 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rimR - 6), Math.sin(a) * (rimR - 6));
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();

    // Sunken bowl.
    const bowl = ctx.createRadialGradient(cx, cy, 0, cx, cy, rimR);
    bowl.addColorStop(0, 'rgba(16, 14, 12, 0.97)');
    bowl.addColorStop(0.35, 'rgba(28, 24, 20, 0.95)');
    bowl.addColorStop(0.72, 'rgba(58, 50, 41, 0.92)');
    bowl.addColorStop(0.9, 'rgba(96, 84, 68, 0.9)');
    bowl.addColorStop(1, 'rgba(74, 65, 54, 0.28)');
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.arc(cx, cy, rimR, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(158, 142, 116, 0.75)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, rimR - 3, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU;
      const r0 = rng() * rimR * 0.45;
      const r1 = rimR * (0.55 + rng() * 0.4);
      const drift = (rng() - 0.5) * 0.3;
      ctx.strokeStyle = `rgba(9, 8, 7, ${(0.2 + rng() * 0.35).toFixed(3)})`;
      ctx.lineWidth = 1 + rng() * 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + drift) * r1, cy + Math.sin(a + drift) * r1);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(cx, cy, rimR * 0.55, cx, cy, 252);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.68, 'rgba(0,0,0,0.92)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function createCrater(x, z, radius) {
    const group = new THREE.Group();
    group.position.set(x, 0.9, z);
    group.scale.setScalar(0.001);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 2.15, 72),
      new THREE.MeshBasicMaterial({
        map: makeCraterTexture(), transparent: true, depthWrite: false
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.renderOrder = 3;
    group.add(disc);

    // Raised rim gives the crater real relief from an oblique camera.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.98, radius * 0.055, 8, 72),
      new THREE.MeshStandardMaterial({ color: 0x6a6051, roughness: 0.98, metalness: 0.02 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = radius * 0.018;
    rim.scale.z = 0.4;
    group.add(rim);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.86, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff6a20, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 1.6;
    glow.renderOrder = 4;
    group.add(glow);

    effectsRoot.add(group);
    return { group, disc, rim, glow, radius };
  }

  function createExplosionVisuals(x, z, fx, groundImpact = false) {
    const group = new THREE.Group();
    group.position.set(x, groundImpact ? Math.max(12, fx.fireball * 0.45) : fx.hob, z);
    effectsRoot.add(group);

    const shell = createFireballMesh(1, 0xfffdf2, 0xffd76d, 0xff6a24, 1);
    shell.scale.setScalar(Math.max(1, fx.fireball * (groundImpact ? 0.16 : 0.2)));
    // Draw the fireball over the smoke so the white core is never buried.
    shell.renderOrder = 9;
    group.add(shell);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.94, 26, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfffdf0, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    core.renderOrder = 9;
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 26, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff9440, transparent: true, opacity: 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide
      })
    );
    halo.renderOrder = 9;
    group.add(halo);

    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffc06a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glow = new THREE.Sprite(glowMat);
    glow.renderOrder = 9;
    group.add(glow);

    const light = new THREE.PointLight(0xffb15a, 0, 0, 0);
    light.position.set(x, Math.max(fx.hob, 30), z);
    effectsRoot.add(light);

    const ringGeoThick = new THREE.RingGeometry(0.955, 1, 160);
    const makeRing = (color, opacity) => {
      const material = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeoThick, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 3.4, z);
      ring.visible = false;
      effectsRoot.add(ring);
      return ring;
    };
    const shock20 = makeRing(0xff6a44, 0);
    const shock5 = makeRing(0xffb35c, 0);
    const shockThermal = makeRing(0xffe7a0, 0);

    const dust5 = createShockwaveDust(x, z, fx.r5, 0xb1a48c, LOW_POWER ? 90 : 230, {
      sizeMin: 120, sizeMax: 420, alphaMin: 0.18, alphaMax: 0.36, height: 90
    });
    effectsRoot.add(dust5.points);
    const dust20 = createShockwaveDust(x, z, fx.r20, 0x8f8472, LOW_POWER ? 55 : 130, {
      sizeMin: 90, sizeMax: 300, alphaMin: 0.22, alphaMax: 0.42, height: 60
    });
    effectsRoot.add(dust20.points);

    let condensation = null;
    if (!groundImpact) {
      condensation = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 96),
        new THREE.MeshBasicMaterial({
          color: 0xdfe8e5, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
        })
      );
      condensation.rotation.x = -Math.PI / 2;
      condensation.position.set(x, fx.hob, z);
      effectsRoot.add(condensation);
    }

    // A ground impact excavates a permanent crater instead of a scorch mark.
    const crater = groundImpact && state.targetOnLand ? createCrater(x, z, fx.crater) : null;

    let ripple = null;
    if (!state.targetOnLand) {
      ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.94, 1, 128),
        new THREE.MeshBasicMaterial({
          color: 0xd7e9e8, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
        })
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(x, 1.5, z);
      effectsRoot.add(ripple);
    }

    let scorch = null;
    if (state.targetOnLand && !groundImpact) {
      const tex = makeScorchTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false
      });
      scorch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(x, 1.1, z);
      scorch.scale.setScalar(fx.r20 * 2.1);
      scorch.renderOrder = 2;
      effectsRoot.add(scorch);
    }

    return {
      start: elapsed,
      group,
      shell,
      core,
      halo,
      glow,
      glowMat,
      light,
      shock20,
      shock5,
      shockThermal,
      dust5,
      dust20,
      condensation,
      ripple,
      scorch,
      crater,
      groundImpact,
      fireballRadius: Math.max(10, fx.fireball),
      fx,
      x,
      z
    };
  }

  function detonate(x, z) {
    const fx = state.effects;
    const weapon = state.weapon;
    const meteor = isMeteor(weapon);
    if (targetRings) {
      // The zone fills are a targeting aid; left on after the strike they haze
      // over the ground detail (crater, scorch), so drop them once it lands.
      if (targetRings.helpers) targetRings.helpers.forEach((h) => { h.visible = false; });
      if (targetRings.fills) targetRings.fills.forEach((f) => { f.visible = false; });
    }
    state.phase = 'blast';
    state.blastStart = elapsed;
    state.reportStart = elapsed;
    state.fireTimer = 0;
    dom.altimeter.hidden = true;
    document.body.dataset.phase = 'blast';
    dom.status.dataset.state = 'blast';
    dom.statusLabel.textContent = meteor ? 'IMPACT' : 'AIRBURST';
    dom.statusDetail.textContent = meteor
      ? `${weapon.name} · ${fmtYield(weapon.yieldKt)} · ${state.targetOnLand ? `CRATER Ø ${fmtCrater(fx.crater)}` : 'WATER IMPACT'}`
      : `${weapon.name} · ${fmtYield(weapon.yieldKt)} · ${fmtMeters(fx.hob)}`;

    // Bright screen flash, re-triggered for repeat strikes.
    dom.flash.classList.remove('fire');
    void dom.flash.offsetWidth;
    dom.flash.classList.add('fire');

    const smokeCount = LOW_POWER ? 1200 : 3200;
    const glowCount = LOW_POWER ? 320 : 800;
    state.smoke = createParticleSystem(smokeCount, smokeTexture, THREE.NormalBlending, 5);
    state.plume = createParticleSystem(LOW_POWER ? 480 : 1100, smokeTexture, THREE.NormalBlending, 4);
    state.glow = createParticleSystem(glowCount, glowTexture, THREE.AdditiveBlending, 6);
    debrisSystem = makeDebrisSystem(LOW_POWER ? 420 : 760);
    state.explosionVisuals = createExplosionVisuals(x, z, fx, meteor);

    if (meteor) spawnImpactParticles(x, z, fx, state.targetOnLand);
    else spawnExplosionParticles(x, z, fx, state.targetOnLand);
    planDamage(x, z, fx);
    applyTreeDamage(x, z, fx);
    damageBridges(x, z, fx);

    cameraRig.shake = clamp(0.55 + Math.log10(weapon.yieldKt + 1) * 0.26, 0.65, 1.6);

    const cloudRise = meteor
      ? clamp(fx.r5 * 0.5, 500, 14000)
      : clamp(fx.hob * 1.9 + fx.fireball * 2.6, 700, 16000);
    const blastDistance = clamp(
      Math.max(fx.r5 * 1.5, fx.fireball * 5.5, cloudRise * 2.2, fx.crater ? fx.crater * 6.5 : 0, 5200),
      5200,
      60000
    );
    beginCameraTween({
      tx: x,
      tz: z,
      ty: meteor ? clamp(cloudRise * 0.4, 120, 9000) : clamp((fx.hob + cloudRise) * 0.5, 200, 30000),
      distance: blastDistance,
      azimuth: cameraRig.azimuth - 0.1,
      pitch: IS_SMALL ? 0.28 : 0.24
    }, 10.0);

    playExplosion(weapon.yieldKt, meteor);
    showReport();
    state.statsDirty = true;
  }

  function spawnExplosionParticles(x, z, fx, onLand) {
    const smoke = state.smoke;
    const glow = state.glow;
    const plume = state.plume || smoke;
    if (!smoke || !glow) return;
    const fireSize = Math.max(8, fx.fireball);
    const isMassive = fx.r5 > 6000;
    const capSize = clamp(fireSize * 3.5, 55, 7000);
    const alphaScale = clamp(450 / capSize, 0.14, 1);
    const riseScale = clamp(Math.sqrt(fx.hob / 707), 0.75, 3.0);
    const darkCloud = fx.r5 > 4000;
    const capPalette = darkCloud
      ? [0x9a8f7e, 0x7b7266, 0x5f574e]
      : [0xe2d9c8, 0xbdb3a2, 0x968c7f];
    const stemPalette = darkCloud ? [0x8b8172, 0xa79d8c] : [0xb0a695, 0xd0c6b3];

    const capCount = LOW_POWER ? 150 : isMassive ? 900 : 270;
    for (let i = 0; i < capCount; i++) {
      const a = Math.random() * TAU;
      const spread = fireSize * (isMassive ? 0.15 + Math.random() * 0.85 : 0.25 + Math.random() * 2.5);
      // Held back briefly so the fireball is unobstructed while it grows.
      const delay = 0.75 + Math.random() * 2.2;
      plume.spawn({
        x: x + Math.cos(a) * spread * 0.42,
        y: fx.hob + (Math.random() - 0.15) * fireSize * 0.9,
        z: z + Math.sin(a) * spread * 0.42,
        vx: Math.cos(a) * (45 + Math.random() * 190),
        vy: (30 + Math.random() * 140) * riseScale,
        vz: Math.sin(a) * (45 + Math.random() * 190),
        size0: 45 + Math.random() * Math.min(fireSize * 0.7, 900),
        size1: capSize * (0.35 + Math.random() * 0.95),
        life: (isMassive ? 18 : 10) + Math.random() * 9,
        alpha: (0.12 + Math.random() * 0.13) * alphaScale,
        drag: 0.24,
        buoyancy: (34 + Math.random() * 42) * riseScale,
        color: Math.random() > 0.68 ? capPalette[0] : Math.random() > 0.38 ? capPalette[1] : capPalette[2]
      });
    }

    const stemCount = LOW_POWER ? 70 : isMassive ? 400 : 130;
    for (let i = 0; i < stemCount; i++) {
      const y = Math.random() * fx.hob;
      const a = Math.random() * TAU;
      const spread = Math.max(12, fx.r20 * 0.2 * (1 - y / Math.max(1, fx.hob)));
      plume.spawn({
        x: x + Math.cos(a) * spread * Math.random(),
        y: 5 + y,
        z: z + Math.sin(a) * spread * Math.random(),
        vx: (Math.random() - 0.5) * 55,
        vy: (28 + Math.random() * 95) * riseScale,
        vz: (Math.random() - 0.5) * 55,
        size0: 25 + Math.random() * 60,
        size1: 90 + Math.random() * Math.max(140, capSize * 0.7),
        life: (isMassive ? 14 : 9) + Math.random() * 9,
        delay: 0.6 + Math.random() * 3.2,
        alpha: (0.1 + Math.random() * 0.12) * alphaScale,
        drag: 0.22,
        buoyancy: (42 + Math.random() * 38) * riseScale,
        color: Math.random() > 0.5 ? stemPalette[0] : stemPalette[1]
      });
    }

    const groundCount = LOW_POWER ? 55 : 110;
    for (let i = 0; i < groundCount; i++) {
      const a = Math.random() * TAU;
      const speed = 60 + Math.random() * 260;
      smoke.spawn({
        x: x + Math.cos(a) * Math.random() * fx.r20 * 0.16,
        y: 2 + Math.random() * 18,
        z: z + Math.sin(a) * Math.random() * fx.r20 * 0.16,
        vx: Math.cos(a) * speed,
        vy: 6 + Math.random() * 30,
        vz: Math.sin(a) * speed,
        size0: 25 + Math.random() * 75,
        size1: 160 + Math.random() * Math.max(200, fx.r5 * 0.28),
        life: 3 + Math.random() * 4,
        delay: Math.random() * 0.35,
        alpha: 0.25 + Math.random() * 0.2,
        drag: 0.55,
        buoyancy: 2.2,
        color: onLand ? (Math.random() > 0.45 ? 0x8a806d : 0x6c655b) : 0xb9cdd0
      });
    }

    if (!onLand) {
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * TAU;
        const speed = 50 + Math.random() * 250;
        smoke.spawn({
          x: x + Math.cos(a) * Math.random() * 30,
          y: 3,
          z: z + Math.sin(a) * Math.random() * 30,
          vx: Math.cos(a) * speed,
          vy: 100 + Math.random() * 320,
          vz: Math.sin(a) * speed,
          size0: 35 + Math.random() * 80,
          size1: 200 + Math.random() * 350,
          life: 4 + Math.random() * 5,
          alpha: 0.3,
          drag: 0.5,
          buoyancy: -2,
          color: 0xb9d4d7
        });
      }
    }

    const sparkCount = LOW_POWER ? 120 : 260;
    for (let i = 0; i < sparkCount; i++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 80 + Math.random() * 760;
      glow.spawn({
        x: x + Math.cos(theta) * Math.sin(phi) * fireSize * 0.2,
        y: fx.hob + Math.sin(phi) * fireSize * 0.35,
        z: z + Math.sin(theta) * Math.sin(phi) * fireSize * 0.2,
        vx: Math.cos(theta) * Math.sin(phi) * speed,
        vy: Math.cos(phi) * speed + 80,
        vz: Math.sin(theta) * Math.sin(phi) * speed,
        size0: 10 + Math.random() * fireSize * 0.25,
        size1: 4 + Math.random() * 25,
        life: 0.55 + Math.random() * 1.7,
        delay: Math.random() * 0.2,
        alpha: 0.65 + Math.random() * 0.3,
        drag: 0.7,
        gravity: -55,
        color: Math.random() > 0.48 ? 0xffd37a : Math.random() > 0.5 ? 0xff8c34 : 0xfff0c3
      });
    }

    if (onLand) {
      for (let i = 0; i < (LOW_POWER ? 35 : 70); i++) {
        const a = Math.random() * TAU;
        smoke.spawn({
          x: x + Math.cos(a) * Math.random() * fx.r20 * 0.4,
          y: 5 + Math.random() * 15,
          z: z + Math.sin(a) * Math.random() * fx.r20 * 0.4,
          vx: Math.cos(a) * (20 + Math.random() * 70),
          vy: 150 + Math.random() * 160,
          vz: Math.sin(a) * (20 + Math.random() * 70),
          size0: 30 + Math.random() * 70,
          size1: 120 + Math.random() * 300,
          life: 5 + Math.random() * 4,
          delay: 0.1 + Math.random() * 1.0,
          alpha: 0.32,
          drag: 0.5,
          buoyancy: 3,
          color: 0x5e584e
        });
      }
    }
  }

  function spawnImpactParticles(x, z, fx, onLand) {
    const smoke = state.smoke;
    const glow = state.glow;
    const plume = state.plume || smoke;
    if (!smoke || !glow) return;

    const crater = Math.max(30, fx.crater || 60);
    const isMassive = fx.r5 > 4000;
    const palette = onLand
      ? [0x8a7d68, 0x6f6455, 0xa2957f]
      : [0xc8dade, 0xa9c6cd, 0xe4eef0];
    const pick = () => palette[Math.floor(Math.random() * palette.length)];

    // Ejecta curtain thrown out of the crater on ballistic arcs.
    const curtain = LOW_POWER ? 380 : isMassive ? 1400 : 850;
    for (let i = 0; i < curtain; i++) {
      const a = Math.random() * TAU;
      const r = crater * (0.65 + Math.random() * 0.55);
      const speed = crater * (1.5 + Math.random() * 3.2);
      smoke.spawn({
        x: x + Math.cos(a) * r,
        y: 4 + Math.random() * crater * 0.12,
        z: z + Math.sin(a) * r,
        vx: Math.cos(a) * speed * (0.5 + Math.random() * 0.6),
        vy: crater * (1.3 + Math.random() * 2.3),
        vz: Math.sin(a) * speed * (0.5 + Math.random() * 0.6),
        size0: crater * (0.06 + Math.random() * 0.12),
        size1: crater * (0.24 + Math.random() * 0.46),
        life: 2.4 + Math.random() * 3.4,
        alpha: 0.2 + Math.random() * 0.2,
        drag: 0.14,
        gravity: -170,
        color: pick()
      });
    }

    // Rising column of dust directly above the crater.
    const columnCount = LOW_POWER ? 160 : isMassive ? 620 : 340;
    for (let i = 0; i < columnCount; i++) {
      const a = Math.random() * TAU;
      const r = crater * (0.15 + Math.random() * 0.75);
      const rise = crater * (0.35 + Math.random() * 1.4);
      plume.spawn({
        x: x + Math.cos(a) * r,
        y: 6 + Math.random() * crater * 0.25,
        z: z + Math.sin(a) * r,
        vx: Math.cos(a) * crater * 0.22,
        vy: rise,
        vz: Math.sin(a) * crater * 0.22,
        size0: crater * (0.12 + Math.random() * 0.2),
        size1: crater * (0.55 + Math.random() * 0.85),
        life: (isMassive ? 13 : 8) + Math.random() * 7,
        delay: Math.random() * 1.2,
        alpha: (0.16 + Math.random() * 0.16) * (isMassive ? 0.6 : 1),
        drag: 0.2,
        buoyancy: crater * 0.02 + 4,
        color: pick()
      });
    }

    // Molten debris and sparks.
    const sparkCount = LOW_POWER ? 140 : isMassive ? 620 : 340;
    for (let i = 0; i < sparkCount; i++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(0.35 + Math.random() * 0.65);
      const speed = crater * (1.1 + Math.random() * 2.6);
      glow.spawn({
        x: x + Math.cos(theta) * crater * 0.3,
        y: 6 + Math.random() * crater * 0.2,
        z: z + Math.sin(theta) * crater * 0.3,
        vx: Math.cos(theta) * Math.sin(phi) * speed,
        vy: Math.cos(phi) * speed * 1.15 + crater * 0.5,
        vz: Math.sin(theta) * Math.sin(phi) * speed,
        size0: crater * (0.03 + Math.random() * 0.07),
        size1: crater * (0.01 + Math.random() * 0.03),
        life: 0.9 + Math.random() * 2.1,
        delay: Math.random() * 0.25,
        alpha: 0.7 + Math.random() * 0.3,
        drag: 0.25,
        gravity: -320,
        color: Math.random() > 0.5 ? 0xffc463 : Math.random() > 0.4 ? 0xff7a24 : 0xfff0c8
      });
    }

    // Low surge of dust rolling out along the ground.
    const surge = LOW_POWER ? 90 : isMassive ? 380 : 220;
    for (let i = 0; i < surge; i++) {
      const a = Math.random() * TAU;
      const speed = crater * (0.9 + Math.random() * 1.8);
      smoke.spawn({
        x: x + Math.cos(a) * crater * 0.55,
        y: 8 + Math.random() * crater * 0.2,
        z: z + Math.sin(a) * crater * 0.55,
        vx: Math.cos(a) * speed,
        vy: crater * (0.05 + Math.random() * 0.18),
        vz: Math.sin(a) * speed,
        size0: crater * (0.12 + Math.random() * 0.18),
        size1: crater * (0.5 + Math.random() * 0.8),
        life: 3 + Math.random() * 4,
        delay: Math.random() * 0.4,
        alpha: 0.18 + Math.random() * 0.16,
        drag: 0.55,
        buoyancy: 3,
        color: onLand ? 0x9a8d76 : 0xd5e6e9
      });
    }
  }

  function planDamage(x, z, fx) {
    const events = [];
    const maxR = Math.max(fx.r5, fx.thermal, 1);

    for (const rec of buildingRecords) {
      if (rec.destroyed) continue;
      const dx = rec.x - x;
      const dz = rec.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const edge = Math.max(0, d - Math.hypot(rec.w, rec.d) * 0.3);
      let type = null;
      if (fx.crater && edge <= fx.crater * 1.1) type = 'vaporize';
      else if (edge <= fx.r20) type = edge < fx.r20 * 0.52 ? 'vaporize' : 'destroy';
      else if (edge <= fx.r5) type = 'collapse';
      else if (edge <= fx.thermal) type = 'fire';
      if (!type) continue;

      const radial = clamp(edge / maxR, 0, 1);
      let delay;
      if (type === 'vaporize' || type === 'destroy') delay = 0.02 + radial * 0.28;
      else if (type === 'collapse') delay = 0.08 + radial * 0.92;
      else delay = 0.12 + radial * 0.8;
      delay += Math.random() * 0.08;
      events.push({ delay, type, kind: 'building', rec, distance: edge });
    }

    for (const lm of landmarks) {
      if (lm.destroyed) continue;
      const dx = lm.x - x;
      const dz = lm.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const edge = Math.max(0, d - lm.radius * 0.55);
      let type = null;
      if (fx.crater && edge <= fx.crater * 1.1) type = 'vaporize';
      else if (edge <= fx.r20) type = edge < fx.r20 * 0.46 ? 'vaporize' : 'destroy';
      else if (edge <= fx.r5) type = 'collapse';
      else if (edge <= fx.thermal) type = 'fire';
      if (!type) continue;
      const radial = clamp(edge / maxR, 0, 1);
      let delay = type === 'collapse' ? 0.12 + radial * 0.92 : 0.04 + radial * 0.35;
      delay += Math.random() * 0.08;
      events.push({ delay, type, kind: 'landmark', rec: lm, distance: edge });
    }

    events.sort((a, b) => a.delay - b.delay);
    state.pending = events;
    state.pendingIndex = 0;
  }

  function applyDamageEvent(event) {
    if (event.kind === 'building') applyBuildingDamage(event);
    else if (event.kind === 'landmark') applyLandmarkDamage(event);
  }

  function applyBuildingDamage(event) {
    const rec = event.rec;
    if (rec.destroyed) return;
    const blast = state.target;
    const fx = state.effects;
    const rng = Math.random();

    if (event.type === 'vaporize' || event.type === 'destroy') {
      rec.destroyed = true;
      rec.status = 'destroyed';
      state.destroyed++;
      hideBuildingInstant(rec);
      hideAccessory(rec);
      _tempColor.setHex(0x272622);
      rec.mesh.setColorAt(rec.index, _tempColor);
      if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
      if (event.type === 'destroy' || rng < 0.36) {
        spawnDebrisBurst(rec, blast, event.type === 'vaporize' ? 0.72 : 1.12);
        // Nothing survives as rubble on the crater floor.
        if (!fx.crater || event.distance > fx.crater * 1.1) addRubble(rec, 0.72 + Math.random() * 0.55);
      }
      if (rng < 0.3) spawnDustCloud(rec.x, rec.z, Math.max(20, rec.w * 0.55), LOW_POWER ? 2 : 4, rec.h * 0.35);
      if (rng < 0.45) addBuildingFire(rec.x, rec.z, Math.min(rec.h * 0.65, 140), 1.1);
      state.statsDirty = true;
      return;
    }

    if (event.type === 'collapse') {
      rec.destroyed = true;
      rec.status = 'collapsing';
      state.destroyed++;
      hideAccessory(rec);
      beginBuildingCollapse(rec, blast, fx);
      spawnDebrisBurst(rec, blast, 0.75);
      if (rng < 0.52) addBuildingFire(rec.x, rec.z, Math.min(rec.h * 0.5, 100), 0.9);
      state.statsDirty = true;
      return;
    }

    if (event.type === 'fire') {
      rec.damageLevel = Math.max(rec.damageLevel, 1);
      _tempColor.setHex(rec.baseColor).multiplyScalar(0.58);
      rec.mesh.setColorAt(rec.index, _tempColor);
      if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
      if (rng < 0.32) addBuildingFire(rec.x, rec.z, Math.min(rec.h * 0.6, 80), 0.7);
    }
  }

  function beginBuildingCollapse(rec, blast, fx) {
    const dx = rec.x - blast.x;
    const dz = rec.z - blast.z;
    let ax = dz;
    let az = -dx;
    if (Math.abs(ax) + Math.abs(az) < 0.001) {
      const a = Math.random() * TAU;
      ax = Math.cos(a);
      az = Math.sin(a);
    }
    const axis = new THREE.Vector3(ax, 0, az).normalize();
    const tall = rec.h > 55;
    const mode = tall && Math.random() < 0.62 ? 'topple' : 'crumple';
    const angle = mode === 'topple' ? (Math.PI * 0.5) * (0.72 + Math.random() * 0.2) : 0.06 + Math.random() * 0.05;
    const duration = mode === 'topple'
      ? 2.1 + Math.min(2.2, rec.h / 160) + Math.random() * 0.7
      : 1.5 + Math.random() * 1.2;
    rec.collapse = {
      start: elapsed,
      duration,
      mode,
      axis,
      angle,
      yawQuat: new THREE.Quaternion().setFromAxisAngle(_up, rec.rot),
      dusted: false
    };
    _tempColor.setHex(rec.baseColor).multiplyScalar(0.48);
    rec.mesh.setColorAt(rec.index, _tempColor);
    if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
    state.collapsers.push(rec);
    spawnDustCloud(rec.x, rec.z, Math.max(rec.w * 0.8, 20), LOW_POWER ? 2 : 4, rec.h * 0.18);
  }

  function hideBuildingInstant(rec) {
    rec.mesh.setMatrixAt(rec.index, ZERO_MATRIX);
    rec.mesh.instanceMatrix.needsUpdate = true;
  }

  function applyLandmarkDamage(event) {
    const lm = event.rec;
    if (lm.destroyed) return;
    const blast = state.target;
    const rng = Math.random();

    if (event.type === 'vaporize' || event.type === 'destroy') {
      lm.destroyed = true;
      lm.status = 'destroyed';
      state.destroyed++;
      state.landmarksDestroyed++;
      lm.group.visible = false;
      const fake = { x: lm.x, z: lm.z, w: lm.radius * 1.4, d: lm.radius * 1.4, h: lm.h, rot: GRID_ANGLE };
      spawnDebrisBurst(fake, blast, 1.6);
      addRubble(fake, 1.1);
      spawnDustCloud(lm.x, lm.z, lm.radius, LOW_POWER ? 3 : 6, lm.h * 0.35);
      addBuildingFire(lm.x, lm.z, Math.min(lm.h * 0.5, 160), 1.25);
      state.statsDirty = true;
      return;
    }

    if (event.type === 'collapse') {
      lm.destroyed = true;
      lm.status = 'collapsing';
      state.destroyed++;
      state.landmarksDestroyed++;
      const dx = lm.x - blast.x;
      const dz = lm.z - blast.z;
      const len = Math.hypot(dx, dz) || 1;
      lm.collapse = {
        start: elapsed,
        duration: 2.5 + Math.min(2.5, lm.h / 150) + Math.random(),
        axis: new THREE.Vector3(dz / len, 0, -dx / len),
        angle: Math.PI * 0.47 * (0.8 + Math.random() * 0.16),
        startQuat: lm.group.quaternion.clone(),
        dusted: false
      };
      state.landCollapsers.push(lm);
      spawnDustCloud(lm.x, lm.z, lm.radius * 1.2, LOW_POWER ? 3 : 6, lm.h * 0.25);
      addBuildingFire(lm.x, lm.z, lm.h * 0.45, 1.15);
      state.statsDirty = true;
      return;
    }

    if (event.type === 'fire') {
      if (rng < 0.48) addBuildingFire(lm.x, lm.z, lm.h * 0.55, 0.9);
    }
  }

  function updateCollapsers() {
    const dirtyMeshes = new Set();
    for (let i = state.collapsers.length - 1; i >= 0; i--) {
      const rec = state.collapsers[i];
      const c = rec.collapse;
      if (!c) { state.collapsers.splice(i, 1); continue; }
      const t = clamp((elapsed - c.start) / c.duration, 0, 1);
      if (t <= 0) continue;

      if (c.mode === 'topple') {
        const angle = easeInCubic(t) * c.angle;
        _tiltQuat.setFromAxisAngle(c.axis, angle);
        _dummy.quaternion.copy(_tiltQuat).multiply(c.yawQuat).normalize();
        _dummy.position.set(rec.x, 0.2, rec.z);
        _dummy.scale.set(rec.w, rec.h, rec.d);
        if (!c.dusted && t > 0.26) {
          c.dusted = true;
          spawnDustCloud(rec.x, rec.z, rec.w, LOW_POWER ? 2 : 3, rec.h * 0.2);
        }
      } else {
        const p = easeInOutCubic(t);
        const sy = Math.max(0.055, 1 - p * 0.94);
        const expand = 1 + p * 0.13;
        _tiltQuat.setFromAxisAngle(c.axis, c.angle * Math.sin(p * Math.PI));
        _dummy.quaternion.copy(_tiltQuat).multiply(c.yawQuat).normalize();
        _dummy.position.set(rec.x, 0.2, rec.z);
        _dummy.scale.set(rec.w * expand, rec.h * sy, rec.d * expand);
      }
      _dummy.updateMatrix();
      rec.mesh.setMatrixAt(rec.index, _dummy.matrix);
      dirtyMeshes.add(rec.mesh);

      if (t >= 1) {
        addRubble(rec, 0.8 + Math.random() * 0.4);
        rec.collapse = null;
        rec.status = 'destroyed';
        state.collapsers.splice(i, 1);
      }
    }
    for (const mesh of dirtyMeshes) mesh.instanceMatrix.needsUpdate = true;

    for (let i = state.landCollapsers.length - 1; i >= 0; i--) {
      const lm = state.landCollapsers[i];
      const c = lm.collapse;
      if (!c) { state.landCollapsers.splice(i, 1); continue; }
      const t = clamp((elapsed - c.start) / c.duration, 0, 1);
      const angle = easeInCubic(t) * c.angle;
      _tiltQuat.setFromAxisAngle(c.axis, angle);
      lm.group.quaternion.copy(_tiltQuat).multiply(c.startQuat).normalize();
      if (!c.dusted && t > 0.24) {
        c.dusted = true;
        spawnDustCloud(lm.x, lm.z, lm.radius * 1.4, LOW_POWER ? 3 : 6, lm.h * 0.22);
      }
      if (t >= 1) {
        addRubble({ x: lm.x, z: lm.z, w: lm.radius * 1.3, d: lm.radius * 1.3, h: lm.h * 0.15, rot: GRID_ANGLE }, 1);
        lm.collapse = null;
        lm.status = 'destroyed';
        state.landCollapsers.splice(i, 1);
      }
    }
  }

  function applyTreeDamage(x, z, fx) {
    if (!treeRecords.length) return;
    const trunkDirty = new Set();
    const canopyColorDirty = new Set();
    for (const tree of treeRecords) {
      if (tree.destroyed) continue;
      const dx = tree.x - x;
      const dz = tree.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= fx.r20 * 0.9) {
        tree.destroyed = true;
        tree.trunkMesh.setMatrixAt(tree.trunkIndex, ZERO_MATRIX);
        tree.canopyMesh.setMatrixAt(tree.canopyIndex, ZERO_MATRIX);
        trunkDirty.add(tree.trunkMesh);
        trunkDirty.add(tree.canopyMesh);
      } else if (d <= fx.thermal) {
        tree.burned = true;
        _tempColor.setHex(0x2d2a23);
        tree.canopyMesh.setColorAt(tree.canopyIndex, _tempColor);
        canopyColorDirty.add(tree.canopyMesh);
      }
    }
    for (const mesh of trunkDirty) mesh.instanceMatrix.needsUpdate = true;
    for (const mesh of canopyColorDirty) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function damageBridges(x, z, fx) {
    for (const bridge of bridgeRecords) {
      if (bridge.damaged) continue;
      bridge.group.updateMatrixWorld(true);
      let damaged = false;
      const blast = new THREE.Vector2(x, z);

      for (const seg of bridge.deckSegments) {
        if (!seg.visible) continue;
        const wc = seg.userData.bridgeCenter;
        const d = Math.hypot(wc.x - x, wc.z - z);
        if (d > fx.r5) continue;
        damaged = true;
        if (d < fx.r20 * 0.68) {
          seg.visible = false;
          const fake = { x: wc.x, z: wc.z, w: 38, d: 24, h: 30, rot: bridge.yaw };
          spawnDebrisBurst(fake, { x, z }, 0.7);
        } else {
          detachBridgeObject(seg, blast, false);
        }
      }

      for (const tower of bridge.towerGroups) {
        if (!tower.visible) continue;
        const p = tower.getWorldPosition(new THREE.Vector3());
        const d = Math.hypot(p.x - x, p.z - z);
        if (d <= fx.r5) {
          damaged = true;
          if (d < fx.r20 * 0.8) {
            tower.visible = false;
          } else {
            detachBridgeObject(tower, blast, true);
          }
        }
      }

      if (damaged) {
        bridge.damaged = true;
        state.bridgesDamaged++;
        for (const cable of bridge.cableObjects) cable.visible = false;
        spawnDustCloud(x, z, 80, LOW_POWER ? 3 : 5, 30);
        state.statsDirty = true;
      }
    }
  }

  function detachBridgeObject(obj, blast, tower) {
    obj.updateMatrixWorld(true);
    effectsRoot.attach(obj);
    const p = obj.position;
    const dx = p.x - blast.x;
    const dz = p.z - blast.z;
    const len = Math.hypot(dx, dz) || 1;
    const speed = tower ? 18 : 38 + Math.random() * 55;
    const item = {
      obj,
      vx: (dx / len) * speed + (Math.random() - 0.5) * 22,
      vy: tower ? -5 : 2 + Math.random() * 15,
      vz: (dz / len) * speed + (Math.random() - 0.5) * 22,
      ax: (Math.random() - 0.5) * (tower ? 0.62 : 1.3),
      ay: (Math.random() - 0.5) * 0.24,
      az: (Math.random() - 0.5) * (tower ? 0.62 : 1.3),
      age: 0,
      life: 18
    };
    state.fallingBridges.push(item);
  }

  function updateFallingBridges(dt) {
    for (let i = state.fallingBridges.length - 1; i >= 0; i--) {
      const b = state.fallingBridges[i];
      b.age += dt;
      b.vy -= 23 * dt;
      b.obj.position.x += b.vx * dt;
      b.obj.position.y += b.vy * dt;
      b.obj.position.z += b.vz * dt;
      b.obj.rotation.x += b.ax * dt;
      b.obj.rotation.y += b.ay * dt;
      b.obj.rotation.z += b.az * dt;
      if (b.obj.position.y < -12 || b.age > b.life) {
        b.obj.visible = false;
        state.fallingBridges.splice(i, 1);
      }
    }
  }

  function updateExplosionVisuals() {
    const v = state.explosionVisuals;
    if (!v) return;
    const t = elapsed - v.start;
    const fx = v.fx;
    const fireR = v.fireballRadius;

    // Fireball: grows more slowly so the white core reads as a fireball
    // instead of a one-frame flash, then holds before it cools off.
    const grow = 1 - Math.exp(-t * 4.2);
    const fireScale = Math.max(0.5, fireR * (0.22 + 0.96 * grow));
    v.shell.scale.setScalar(fireScale);
    v.shell.material.uniforms.uTime.value = t;
    const shellFade = clamp(1 - (t - 1.15) / 2.2, 0, 1);
    v.shell.material.uniforms.uOpacity.value = 0.98 * shellFade;
    v.shell.visible = shellFade > 0.01;

    const coreGrow = 1 - Math.exp(-t * 5.4);
    v.core.scale.setScalar(Math.max(0.5, fireR * 0.94 * coreGrow));
    const coreFade = clamp(1 - (t - 0.85) / 1.5, 0, 1);
    v.core.material.opacity = 0.9 * coreFade;
    v.core.visible = coreFade > 0.01;

    v.halo.scale.setScalar(Math.max(0.5, fireR * (0.3 + 1.14 * grow)));
    const haloFade = clamp(1 - (t - 1.2) / 2.5, 0, 1);
    v.halo.material.opacity = 0.4 * haloFade;
    v.halo.visible = haloFade > 0.01;

    v.glow.scale.setScalar(Math.max(1, fireR * (1.6 + 1.9 * grow)));
    const glowFade = clamp(1 - (t - 0.9) / 3.2, 0, 1);
    v.glowMat.opacity = 0.68 * glowFade;
    v.glow.visible = glowFade > 0.01;

    v.light.intensity = 30 * Math.exp(-t * 2.6);
    v.light.distance = Math.max(1500, fx.r5 * 1.4);
    v.light.visible = v.light.intensity > 0.05;

    const updateRing = (ring, target, duration, peak, delay = 0) => {
      const p = clamp((t - delay) / duration, 0, 1);
      const radius = fireR * 0.55 + target * easeOutCubic(p);
      ring.scale.setScalar(Math.max(0.5, radius));
      ring.material.opacity = peak * (1 - p) * (1 - p);
      ring.visible = p < 1;
    };
    updateRing(v.shock20, fx.r20, 1.5, 0.55);
    updateRing(v.shock5, fx.r5, 2.0, 0.4);
    updateRing(v.shockThermal, fx.thermal * 0.82, 2.8, 0.2, 0.15);

    v.dust20.update(t, 1.4);
    v.dust5.update(t, 2.2);

    if (v.condensation) {
      const p = clamp(t / 3.2, 0, 1);
      v.condensation.scale.setScalar(Math.max(0.5, fireR * (1.0 + 1.5 * easeOutCubic(p))));
      v.condensation.material.opacity = 0.16 * Math.sin(Math.PI * Math.min(1, p * 1.1)) * (1 - p * 0.5);
      v.condensation.visible = p < 1;
    }

    if (v.ripple) {
      const p = clamp(t / 4.2, 0, 1);
      v.ripple.scale.setScalar(Math.max(0.5, fireR * 0.8 + fx.r5 * easeOutCubic(p)));
      v.ripple.material.opacity = 0.32 * (1 - p) * (1 - p);
      v.ripple.visible = p < 1;
    }

    if (v.scorch) {
      v.scorch.material.opacity = 0.5 * clamp(t / 0.35, 0, 1);
    }

    if (v.crater) {
      const p = clamp(t / 0.4, 0, 1);
      v.crater.group.scale.setScalar(Math.max(0.001, easeOutCubic(p)));
      const heat = Math.max(0, 1 - t / 4.5);
      v.crater.glow.material.opacity = 0.6 * heat;
      v.crater.glow.visible = heat > 0.01;
    }
  }

  function updateFireEmitters(dt) {
    if (!fireSpawnPoints.length || !state.smoke || !state.glow) return;
    state.fireTimer = (state.fireTimer || 0) + dt;
    if (state.fireTimer < 0.46) return;
    state.fireTimer = 0;
    const n = LOW_POWER ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const p = fireSpawnPoints[Math.floor(Math.random() * fireSpawnPoints.length)];
      state.glow.spawn({
        x: p.x + (Math.random() - 0.5) * 18,
        y: p.y + 2 + Math.random() * 8,
        z: p.z + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.5) * 7,
        vy: 12 + Math.random() * 22,
        vz: (Math.random() - 0.5) * 7,
        size0: 8 + Math.random() * 18,
        size1: 18 + Math.random() * 38,
        life: 0.7 + Math.random() * 1.3,
        alpha: 0.6,
        drag: 0.5,
        buoyancy: 4,
        color: Math.random() > 0.5 ? 0xff7a24 : 0xffc75e
      });
      state.smoke.spawn({
        x: p.x + (Math.random() - 0.5) * 12,
        y: p.y + 8 + Math.random() * 15,
        z: p.z + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 10,
        vy: 18 + Math.random() * 22,
        vz: (Math.random() - 0.5) * 10,
        size0: 20 + Math.random() * 30,
        size1: 70 + Math.random() * 100,
        life: 4 + Math.random() * 4,
        alpha: 0.16,
        drag: 0.2,
        buoyancy: 6,
        color: 0x4f4a42
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let masterGain = null;
  let fallAudio = null;
  let sirenAudio = null;

  function ensureAudio() {
    if (!state.audioEnabled) return;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.58;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function setAudioEnabled(enabled) {
    state.audioEnabled = enabled;
    dom.soundBtn.setAttribute('aria-pressed', String(enabled));
    const label = dom.soundBtn.querySelector('.btn-label');
    if (label) label.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    dom.soundBtn.querySelector('.sound-icon').textContent = enabled ? '◖' : '×';
    if (!enabled) {
      if (masterGain) masterGain.gain.value = 0;
      if (fallAudio) {
        try { fallAudio.stop(); } catch (e) {}
        fallAudio = null;
      }
      stopSiren();
    } else {
      ensureAudio();
      if (masterGain) masterGain.gain.value = 0.58;
    }
  }

  function preloadSiren() {
    if (sirenAudio) return;
    sirenAudio = new Audio('nuclear-alarm-siren.mp3');
    sirenAudio.preload = 'auto';
    sirenAudio.volume = 0.55;
  }

  function playSiren() {
    if (!state.audioEnabled) return;
    ensureAudio();
    preloadSiren();
    try { sirenAudio.currentTime = 0; } catch (e) {}
    const started = sirenAudio.play();
    if (started && started.catch) started.catch(() => {});
  }

  function stopSiren() {
    if (!sirenAudio) return;
    try {
      sirenAudio.pause();
      sirenAudio.currentTime = 0;
    } catch (e) {}
  }

  function playFallWhoosh(duration, kt, meteor = false) {
    if (!state.audioEnabled) return;
    ensureAudio();
    if (!audioCtx || !masterGain) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(meteor ? 1500 + Math.log10(kt + 2) * 220 : 820 + Math.log10(kt + 2) * 120, now);
    osc.frequency.exponentialRampToValueAtTime(meteor ? 70 : 120, now + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(meteor ? 2200 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(meteor ? 220 : 260, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    fallAudio = osc;
  }

  function playExplosion(kt, meteor = false) {
    if (!state.audioEnabled) return;
    ensureAudio();
    if (!audioCtx || !masterGain) return;
    const now = audioCtx.currentTime;
    const duration = meteor ? 5.4 : 3.8;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.97 * last + 0.03 * white;
      const t = i / bufferSize;
      const env = Math.pow(1 - t, 2.1) * (0.35 + 0.65 * Math.exp(-t * 6));
      data[i] = (white * 0.55 + last * 2.5) * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(meteor ? 900 : 1400, now);
    lp.frequency.exponentialRampToValueAtTime(meteor ? 90 : 180, now + (meteor ? 3.6 : 2.6));
    const gain = audioCtx.createGain();
    const level = clamp(0.28 + Math.log10(kt + 1) * 0.04, 0.3, 0.48);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(masterGain);
    src.start(now);

    const sub = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(meteor ? 44 : 58, now);
    sub.frequency.exponentialRampToValueAtTime(meteor ? 24 : 31, now + 2.2);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + (meteor ? 4.6 : 3.2));
    sub.connect(subGain);
    subGain.connect(masterGain);
    sub.start(now);
    sub.stop(now + (meteor ? 4.7 : 3.3));

    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(160, now);
    click.frequency.exponentialRampToValueAtTime(35, now + 0.2);
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    click.connect(clickGain);
    clickGain.connect(masterGain);
    click.start(now);
    click.stop(now + 0.24);
  }

  // ---------------------------------------------------------------------------
  // Camera input and targeting
  // ---------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerState = new Map();
  let gesture = null;
  let pointerId = 0;

  function screenToGround(clientX, clientY) {
    const rect = dom.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    // Allow open-water strikes well outside the modelled city rectangle.
    const dx = hit.x - 200;
    const dz = hit.z - 6400;
    if (dx * dx + dz * dz > 45000 * 45000) return null;
    return hit;
  }

  function clampTarget() {
    const dx = cameraRig.target.x - 200;
    const dz = cameraRig.target.z - 6400;
    const d = Math.hypot(dx, dz);
    if (d > 44000) {
      const k = 44000 / d;
      cameraRig.target.x = 200 + dx * k;
      cameraRig.target.z = 6400 + dz * k;
    }
  }

  function panCameraBy(dx, dy) {
    const unitsPerPx = (2 * cameraRig.distance * Math.tan(deg(camera.fov) / 2) / window.innerHeight) / Math.max(0.38, Math.sin(cameraRig.pitch));
    const right = new THREE.Vector3(Math.cos(cameraRig.azimuth), 0, -Math.sin(cameraRig.azimuth));
    const forward = new THREE.Vector3(-Math.sin(cameraRig.azimuth), 0, -Math.cos(cameraRig.azimuth));
    cameraRig.target.addScaledVector(right, -dx * unitsPerPx);
    cameraRig.target.addScaledVector(forward, dy * unitsPerPx);
    clampTarget();
  }

  function initControls() {
    const canvas = dom.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cameraRig.tween = null;
      const scale = Math.exp(e.deltaY * 0.00115);
      cameraRig.distance = clamp(cameraRig.distance * scale, cameraRig.minDistance, cameraRig.maxDistance);
    }, { passive: false });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1) e.preventDefault();
      ensureAudio();
      cameraRig.tween = null;
      pointerState.set(e.pointerId, {
        x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
        button: e.button, startTime: performance.now()
      });
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (pointerState.size === 1) {
        gesture = {
          mode: e.button === 2 || e.shiftKey ? 'pan' : 'pending',
          moved: 0,
          lastX: e.clientX,
          lastY: e.clientY,
          pointerCount: 1
        };
      } else if (pointerState.size === 2) {
        const pts = [...pointerState.values()];
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        gesture = {
          mode: 'pinch',
          lastMid: mid,
          lastDist: dist,
          moved: 30
        };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = pointerState.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (pointerState.size === 1 && gesture) {
        const dx = e.clientX - gesture.lastX;
        const dy = e.clientY - gesture.lastY;
        gesture.moved += Math.abs(dx) + Math.abs(dy);
        if (gesture.mode === 'pending' && gesture.moved > 5) gesture.mode = 'rotate';
        if (gesture.mode === 'rotate') {
          cameraRig.azimuth -= dx * 0.0055;
          cameraRig.pitch = clamp(cameraRig.pitch + dy * 0.0045, 0.18, 1.42);
          gesture.lastX = e.clientX;
          gesture.lastY = e.clientY;
        } else if (gesture.mode === 'pan') {
          panCameraBy(dx, dy);
          gesture.lastX = e.clientX;
          gesture.lastY = e.clientY;
        }
      } else if (pointerState.size >= 2 && gesture && gesture.mode === 'pinch') {
        const pts = [...pointerState.values()];
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (gesture.lastMid) {
          panCameraBy(mid.x - gesture.lastMid.x, mid.y - gesture.lastMid.y);
        }
        if (gesture.lastDist > 0 && dist > 0) {
          const ratio = gesture.lastDist / dist;
          cameraRig.distance = clamp(cameraRig.distance * ratio, cameraRig.minDistance, cameraRig.maxDistance);
        }
        gesture.lastMid = mid;
        gesture.lastDist = dist;
      }
    });

    function releasePointer(e) {
      const p = pointerState.get(e.pointerId);
      if (!p) return;
      pointerState.delete(e.pointerId);
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

      if (gesture && gesture.mode === 'pending' && p && pointerState.size === 0) {
        const elapsedMs = performance.now() - p.startTime;
        const moved = gesture.moved;
        if (moved < 8 && elapsedMs < 720 && p.button !== 2) {
          const hit = screenToGround(e.clientX, e.clientY);
          if (hit && (state.phase === 'idle' || state.phase === 'aftermath')) {
            armStrike(hit.x, hit.z, inAnyLand(hit.x, hit.z));
          }
        }
      }
      if (pointerState.size === 0) {
        gesture = null;
      } else if (pointerState.size === 1) {
        const rem = [...pointerState.values()][0];
        gesture = {
          mode: 'rotate',
          moved: 20,
          lastX: rem.x,
          lastY: rem.y
        };
      }
    }

    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', (e) => {
      pointerState.delete(e.pointerId);
      if (pointerState.size === 0) gesture = null;
    });
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && pointerState.size === 0) dom.canvas.style.cursor = 'crosshair';
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cameraRig.tween = null;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (!e.ctrlKey && !e.metaKey) resetGame();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  function populateWeaponSelects() {
    const fill = (el, list, activeId) => {
      el.innerHTML = '';
      for (const weapon of list) {
        const option = document.createElement('option');
        option.value = weapon.id;
        option.textContent = `${weapon.name} — ${weapon.label}`;
        el.appendChild(option);
      }
      el.value = activeId;
    };
    fill(dom.select, NUKES, modeWeapons.nuke.id);
    fill(dom.meteorSelect, METEORS, modeWeapons.meteor.id);
  }

  function updateWeaponUI() {
    selectedEffects = effectsForWeapon(selectedWeapon);
    dom.yieldBadge.textContent = fmtYield(selectedWeapon.yieldKt);
    if (isMeteor(selectedWeapon)) {
      dom.weaponMeta.textContent = `GROUND IMPACT · CRATER Ø ${fmtCrater(selectedEffects.crater)}`;
      dom.weaponLabel.textContent = 'IMPACTOR';
    } else {
      dom.weaponMeta.textContent = `OPTIMAL AIRBURST · ${Math.round(selectedEffects.hob).toLocaleString('en-US')} M`;
      dom.weaponLabel.textContent = 'WARHEAD';
    }
    const meteorMode = mode === 'meteor';
    dom.select.hidden = meteorMode;
    dom.meteorSelect.hidden = !meteorMode;
    dom.select.value = modeWeapons.nuke.id;
    dom.meteorSelect.value = modeWeapons.meteor.id;
    dom.modeNuke.setAttribute('aria-pressed', String(!meteorMode));
    dom.modeMeteor.setAttribute('aria-pressed', String(meteorMode));
  }

  function setMode(next) {
    if (next === mode) return;
    if (state.phase === 'falling' || state.phase === 'blast' || state.phase === 'alert') return;
    mode = next;
    selectedWeapon = modeWeapons[mode];
    updateWeaponUI();
    if (state.phase === 'idle' || state.phase === 'aftermath') {
      setStatus(
        'READY TO STRIKE',
        isMeteor(selectedWeapon) ? 'Pick an impact point' : 'Choose a spot on the city',
        'ready'
      );
    }
  }

  function setStatus(label, detail, phase) {
    dom.statusLabel.textContent = label;
    dom.statusDetail.textContent = detail;
    dom.status.dataset.state = phase;
  }

  function reportLocationLine(weapon, fx) {
    const bridges = state.bridgesDamaged
      ? ` · ${state.bridgesDamaged} BRIDGE${state.bridgesDamaged > 1 ? 'S' : ''}`
      : '';
    if (isMeteor(weapon)) {
      const crater = state.targetOnLand ? `GROUND IMPACT · CRATER Ø ${fmtCrater(fx.crater)}` : 'WATER IMPACT · NO CRATER';
      return crater + bridges;
    }
    return `AIRBURST AT ${Math.round(fx.hob).toLocaleString('en-US')} M${bridges}`;
  }

  function showReport() {
    const n = state.weapon;
    const fx = state.effects;
    dom.reportNuke.textContent = n.name;
    dom.reportYield.textContent = fmtYield(n.yieldKt);
    dom.reportHob.textContent = reportLocationLine(n, fx);
    dom.legend20.textContent = fmtKm(fx.r20).toUpperCase();
    dom.legend5.textContent = fmtKm(fx.r5).toUpperCase();
    dom.legendThermal.textContent = fmtKm(fx.thermal).toUpperCase();
    dom.legend1.textContent = fmtKm(fx.r1).toUpperCase();
    dom.reportDestroyed.textContent = '0';
    dom.reportTime.textContent = 'T+00:00';
    dom.report.hidden = false;
  }

  function updateReportUI() {
    if (dom.report.hidden) return;
    if (state.reportStart) {
      const seconds = Math.max(0, Math.floor(elapsed - state.reportStart));
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      dom.reportTime.textContent = `T+${mm}:${ss}`;
    }
    if (state.statsDirty) {
      state.statsDirty = false;
      dom.reportDestroyed.textContent = state.destroyed.toLocaleString('en-US');
      if (state.phase === 'aftermath') {
        dom.statusDetail.textContent = aftermathSummary();
      }
      dom.reportHob.textContent = reportLocationLine(state.weapon, state.effects);
    }
  }

  function hideReport() {
    dom.report.hidden = true;
    dom.reportDestroyed.textContent = '0';
  }

  function setInputEnabled(enabled) {
    dom.select.disabled = !enabled;
    dom.meteorSelect.disabled = !enabled;
    dom.modeNuke.disabled = !enabled;
    dom.modeMeteor.disabled = !enabled;
  }

  function resetInterface(initial = false) {
    cancelAlert();
    state.phase = 'idle';
    state.target = null;
    state.destroyed = 0;
    state.landmarksDestroyed = 0;
    state.bridgesDamaged = 0;
    state.pending = [];
    state.pendingIndex = 0;
    state.collapsers = [];
    state.landCollapsers = [];
    state.fallingBridges = [];
    state.statsDirty = false;
    state.blastStart = 0;
    state.reportStart = 0;
    cameraRig.shake = 0;
    document.body.dataset.phase = 'idle';
    setInputEnabled(true);
    dom.report.hidden = true;
    dom.altimeter.hidden = true;
    dom.flash.classList.remove('fire');
    dom.hintText.textContent = 'Drag to orbit · Scroll to zoom · Click the city to strike · R to rebuild';
    setStatus('READY TO STRIKE', isMeteor(selectedWeapon) ? 'Pick an impact point' : 'Choose a spot on the city', 'ready');
    updateWeaponUI();
    if (!initial) {
      state.statsDirty = true;
    }
  }

  function bindUI() {
    dom.select.addEventListener('change', () => {
      const found = NUKES.find((n) => n.id === dom.select.value);
      if (!found) return;
      modeWeapons.nuke = found;
      if (mode !== 'nuke') return;
      selectedWeapon = found;
      updateWeaponUI();
      if (state.phase === 'idle') {
        setStatus('READY TO STRIKE', 'Choose a spot on the city', 'ready');
      }
    });

    dom.meteorSelect.addEventListener('change', () => {
      const found = METEORS.find((m) => m.id === dom.meteorSelect.value);
      if (!found) return;
      modeWeapons.meteor = found;
      if (mode !== 'meteor') return;
      selectedWeapon = found;
      updateWeaponUI();
      if (state.phase === 'idle') {
        setStatus('READY TO STRIKE', 'Pick an impact point', 'ready');
      }
    });

    dom.modeNuke.addEventListener('click', () => setMode('nuke'));
    dom.modeMeteor.addEventListener('click', () => setMode('meteor'));

    dom.soundBtn.addEventListener('click', () => {
      setAudioEnabled(!state.audioEnabled);
    });

    dom.resetBtn.addEventListener('click', () => {
      resetGame();
    });
  }

  function resetGame() {
    if (state.resetting) return;
    state.resetting = true;
    clearCombatEffects();
    clearTargetMarker();
    clearBomb();
    dom.report.hidden = true;
    resetInterface(false);
    buildCity();
    cameraRig.targetY = 0;
    beginCameraTween(DEFAULT_CAMERA, 1.15);
    state.resetting = false;
  }

  function aftermathSummary() {
    const bridges = state.bridgesDamaged ? ` · ${state.bridgesDamaged} BRIDGE${state.bridgesDamaged > 1 ? 'S' : ''}` : '';
    if (IS_SMALL) return `${state.destroyed.toLocaleString('en-US')} DOWN${bridges}`;
    return `${state.destroyed.toLocaleString('en-US')} STRUCTURES DOWN${bridges}`;
  }

  function updateAftermathStatus() {
    if (state.phase === 'blast' && elapsed - state.blastStart > 2.7) {
      state.phase = 'aftermath';
      document.body.dataset.phase = 'aftermath';
      setInputEnabled(true);
      dom.hintText.textContent = 'Drag to orbit · Scroll to zoom · Click again for another strike · R to rebuild';
      setStatus(isMeteor(state.weapon) ? 'IMPACT COMPLETE' : 'BLAST COMPLETE', aftermathSummary(), 'aftermath');
    }
    if (state.phase === 'aftermath') {
      dom.statusDetail.textContent = aftermathSummary();
    }
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  function processPendingDamage() {
    const since = elapsed - state.blastStart;
    let budget = LOW_POWER ? 130 : 240;
    while (
      state.pendingIndex < state.pending.length &&
      state.pending[state.pendingIndex].delay <= since &&
      budget-- > 0
    ) {
      const event = state.pending[state.pendingIndex++];
      applyDamageEvent(event);
    }
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05) * timeScale;
    elapsed += dt;
    frameDt = dt;

    if (waterUniforms) waterUniforms.uTime.value = elapsed;
    updateClouds(dt);
    cameraRig.shake *= Math.exp(-dt * 2.55);
    if (cameraRig.shake < 0.002) cameraRig.shake = 0;
    updateCameraTween();
    applyCamera();

    if (state.phase === 'alert') {
      updateAlert();
    }

    if (state.phase === 'falling') {
      updateBombFall();
    }

    if (state.phase === 'blast' || state.phase === 'aftermath') {
      processPendingDamage();
      updateCollapsers();
      updateExplosionVisuals();
      updateFallingBridges(dt);
      updateFireEmitters(dt);
      updateAftermathStatus();
      updateReportUI();
    }

    for (const sys of activeParticleSystems) sys.update(dt);
    if (debrisSystem) debrisSystem.update(dt);

    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;
    try {
      if (!window.THREE) throw new Error('Three.js failed to load');
      if (!window.WebGLRenderingContext) throw new Error('WebGL is not available');

      initThree();
      initMaterials();
      populateWeaponSelects();
      initEffectTextures();
      preloadSiren();
      makeTerrain();
      buildCity();
      bindUI();
      initControls();
      resetInterface(true);
      updateParticleScale();

      applyCamera();
      renderer.render(scene, camera);
      clock.start();
      dom.loading.classList.add('done');
      animate();
      setTimeout(() => {
        if (dom.loading && dom.loading.classList.contains('done')) {
          dom.loading.style.display = 'none';
        }
      }, 900);
    } catch (err) {
      console.error(err);
      dom.loading.classList.add('done');
      dom.unsupported.hidden = false;
    }
  }

  window.__gz = {
    get state() { return state; },
    get time() { return elapsed; },
    cameraRig,
    launchAt,
    armStrike,
    resetGame,
    effectsFor,
    effectsForImpact,
    makeCraterTexture,
    makeCloudTexture,
    get mode() { return mode; },
    setMode,
    NUKES,
    METEORS,
    get selectedWeapon() { return selectedWeapon; },
    selectNuke(id) {
      const nuke = NUKES.find((n) => n.id === id);
      if (!nuke) return;
      modeWeapons.nuke = nuke;
      if (mode !== 'nuke') return;
      selectedWeapon = nuke;
      dom.select.value = id;
      updateWeaponUI();
    },
    selectMeteor(id) {
      const meteor = METEORS.find((m) => m.id === id);
      if (!meteor) return;
      modeWeapons.meteor = meteor;
      if (mode !== 'meteor') return;
      selectedWeapon = meteor;
      dom.meteorSelect.value = id;
      updateWeaponUI();
    },
    get mapCanvas() { return mapCanvas; },
    get trees() { return treeRecords; },
    get clouds() { return cloudPuffs; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    inAnyLand,
    toggleShadows(on) { renderer.shadowMap.enabled = !!on; scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } }); },
    setTimeScale(value) { timeScale = clamp(value, 0.1, 20); },
    setCamera({ tx, ty, tz, distance, azimuth, pitch }) {
      if (tx !== undefined) cameraRig.target.x = tx;
      if (ty !== undefined) cameraRig.targetY = ty;
      if (tz !== undefined) cameraRig.target.z = tz;
      if (distance !== undefined) cameraRig.distance = distance;
      if (azimuth !== undefined) cameraRig.azimuth = azimuth;
      if (pitch !== undefined) cameraRig.pitch = pitch;
      cameraRig.tween = null;
      applyCamera();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 30));
  } else {
    setTimeout(boot, 30);
  }
})();
