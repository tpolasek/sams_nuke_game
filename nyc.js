/* New York City layout for Ground Zero: island polygons, parks, landmarks,
   bridges, street painters and block generators. Registered as
   window.GZ_CITIES.nyc; app.js builds the dataset through build(api). */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const deg = (d) => (d * Math.PI) / 180;
  const ANGLE = deg(18);
  const AX = { x: Math.sin(ANGLE), y: Math.cos(ANGLE) }; // along avenues, north
  const BX = { x: Math.cos(ANGLE), y: -Math.sin(ANGLE) }; // across avenues, east

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
    [1380, 12500], [1420, 11900], [1380, 11200], [1300, 10600], [1260, 9900],
    [1290, 9200], [1380, 8600], [1460, 8000], [1500, 7300], [1520, 6600],
    [1480, 5900], [1400, 5200], [1300, 4500], [1180, 3800], [1040, 3100],
    [880, 2400], [700, 1700], [520, 1000], [340, 400], [150, 60], [0, 0]
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

  const STREET_GRID = { avenue: 220, street: 80 };

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

  window.GZ_CITIES = window.GZ_CITIES || {};
  window.GZ_CITIES.nyc = {
    id: 'nyc',
    kicker: 'NEW YORK CITY',
    coords: '40.7128° N',
    gridAngle: ANGLE,
    water: { deep: 0x143c4c, shallow: 0x2a6072, sky: 0xb4cfda },
    build(api) {
      const {
        LOW_POWER, TAU: _TAU, clamp, lerp, mulberry32, pointInPoly, polygonBounds,
        localRect, localPoint, localToWorld,
        isParked, inLandmarkExclusion, footprintClear, addBuilding,
        lineWorld, addPolyLine, drawParks,
        BUILDING_TYPES, pickBuildingType, pickPaletteColor
      } = api;

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
              const rot = ANGLE + (rng() - 0.5) * 0.018;
              if (!footprintClear(center[0], center[1], w, d, rot)) continue;
              if (rng() < 0.025 && !isDowntown && !isMidtown) continue;

              let height = buildingHeight(center[0], center[1], rng, 'manhattan');
              if (w > 110) height = Math.min(height, 95 + rng() * 55);
              const type = pickBuildingType(height, rng, isMidtown || isDowntown);
              const color = pickPaletteColor(BUILDING_TYPES[type].palette, rng);
              addBuilding({
                x: center[0], z: center[1], w, d, h: height, rot, type, color,
                baseColor: color
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
                  addBuilding({
                    x: cx, z: cz, w, d, h, rot, type, color, baseColor: color
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
          const rot = ANGLE + (rng() - 0.5) * 0.08;
          const h = lerp(heightRange[0], heightRange[1], rng());
          const type = pickBuildingType(h, rng, false);
          const color = pickPaletteColor(BUILDING_TYPES[type].palette, rng);
          addBuilding({ x, z, w, d, h, rot, type, color, baseColor: color });
          made++;
        }
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
            const p1 = [AX.x * u + BX.x * v, AX.y * u + BX.y * v];
            const p2 = [AX.x * (u + 260) + BX.x * v, AX.y * (u + 260) + BX.y * v];
            lineWorld(target, p1[0], p1[1], p2[0], p2[1], px, py);
          }
          avIdx++;
        }

        for (let u = -3000; u <= 15000; u += STREET_GRID.street) {
          for (let v = -7000; v <= 7000; v += 280) {
            const p1 = [AX.x * u + BX.x * v, AX.y * u + BX.y * v];
            const p2 = [AX.x * u + BX.x * (v + 280), AX.y * u + BX.y * (v + 280)];
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

      function paintGround(ctx, px, py, scale, landPaths) {
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
      }

      return {
        landPolys: LAND_POLYS,
        parks: PARK_AREAS,
        landmarks: LANDMARK_SPECS,
        bridges: BRIDGE_SPECS,
        streetGrid: STREET_GRID,
        defaultCamera: null,
        paintGround,
        generateBuildings(rng) {
          generateManhattanBuildings(rng);
          generateOuterBoroughs(rng);
        }
      };
    }
  };
})();
