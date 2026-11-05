/* Dubai layout for Ground Zero: Gulf coast, Dubai Creek, Palm Jumeirah,
   the Sheikh Zayed Road tower corridor and its supertalls. Registered as
   window.GZ_CITIES.dubai; app.js builds the dataset through build(api). */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // Mainland coast (z ≈ 0) with the Marina inlet carved at x ≈ -4900 and the
  // Dubai Creek running inland at x ≈ 3700-4500.
  const MAINLAND = [
    [-6400, 170], [-5200, 190], [-5050, 180],
    [-4980, 500], [-5020, 1000], [-4950, 1400], [-4870, 1600],
    [-4800, 1200], [-4840, 700], [-4760, 350], [-4680, 170],
    [-4400, 150], [-4000, 160], [-3400, 140], [-2600, 170], [-1800, 140],
    [-1000, 170], [-200, 140], [600, 170], [1400, 140], [2200, 170], [3000, 150],
    [3400, 170], [3620, 150],
    [3700, 700], [3950, 1400], [4150, 1900], [4350, 2250],
    [4480, 2250], [4620, 1800], [4450, 1200], [4300, 600], [4520, 150],
    [5000, 190], [5600, 160], [7000, 170],
    [7000, 15200], [-6400, 15200]
  ];

  // Palm Jumeirah: a frond circle out in the Gulf, Atlantis on its south rim.
  const PALM = (() => {
    const pts = [];
    const cx = -4060, cz = -950, r = 820;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return pts;
  })();

  const BLUEWATER = [
    [-5230, -620], [-5180, -760], [-5040, -830], [-4900, -790], [-4840, -670],
    [-4900, -560], [-5050, -520], [-5180, -550]
  ];

  // Burj Al Arab sits on its own tiny island off the beach.
  const SAIL_ISLAND = [
    [-2570, -520], [-2540, -610], [-2450, -650], [-2360, -600],
    [-2330, -510], [-2380, -430], [-2470, -400], [-2550, -440]
  ];

  const LAND_POLYS = [
    { id: 'dubai', points: MAINLAND, color: '#c3ae87' },
    { id: 'palm', points: PALM, color: '#cbba98' },
    { id: 'bluewater', points: BLUEWATER, color: '#c9b592' },
    { id: 'sailisland', points: SAIL_ISLAND, color: '#cbbb96' }
  ];

  function rect(cx, cz, halfW, halfD) {
    return [[cx - halfW, cz - halfD], [cx + halfW, cz - halfD], [cx + halfW, cz + halfD], [cx - halfW, cz + halfD]];
  }

  const LANDMARK_SPECS = [
    { id: 'burjkhalifa', name: 'Burj Khalifa', kind: 'burj', x: 1800, z: 3800, radius: 135, h: 828 },
    { id: 'emirates1', name: 'Emirates Towers', kind: 'emirates', x: 950, z: 2870, radius: 52, h: 355, w: 54, d: 54 },
    { id: 'emirates2', name: 'Emirates Office Tower', kind: 'emirates', x: 1130, z: 3010, radius: 46, h: 309, w: 46, d: 46 },
    { id: 'index', name: 'The Index', kind: 'stack', x: 1480, z: 3330, radius: 46, h: 328, w: 46, d: 40, mat: 'glassBlue' },
    { id: 'address', name: 'The Address Downtown', kind: 'stack', x: 1660, z: 3580, radius: 46, h: 302, w: 44, d: 44, mat: 'glassDeep' },
    { id: 'princess', name: 'Princess Tower', kind: 'domecrown', x: -4380, z: 1350, radius: 42, h: 414, w: 48, d: 48 },
    { id: 'marina101', name: 'Marina 101', kind: 'billionaires', x: -4240, z: 1220, radius: 42, h: 425, w: 46, d: 42, mat: 'glassDeep' },
    { id: 'cayan', name: 'Cayan Tower', kind: 'twist', x: -4100, z: 1040, radius: 40, h: 306, w: 42, d: 30, mat: 'glassBlue' },
    { id: 'marinabay', name: 'Marina Bay Tower', kind: 'stack', x: -4440, z: 1070, radius: 38, h: 262, w: 42, d: 38, mat: 'glassDeep' },
    { id: 'almufti', name: 'Al Mufti Tower', kind: 'stack', x: -4160, z: 860, radius: 36, h: 218, w: 38, d: 34, mat: 'glassBlue' },
    { id: 'burjalarab', name: 'Burj Al Arab', kind: 'sail', x: -2450, z: -520, radius: 62, h: 321 },
    { id: 'jumeirahbeach', name: 'Jumeirah Beach Hotel', kind: 'wave', x: -2160, z: 300, radius: 55, h: 93, w: 120, d: 46, mat: 'glassBlue' },
    { id: 'frame', name: 'Dubai Frame', kind: 'frame', x: -1600, z: 5000, radius: 58, h: 150, w: 60, d: 14 },
    { id: 'museumfuture', name: 'Museum of the Future', kind: 'ovoid', x: -560, z: 3480, radius: 48, h: 77, w: 58, d: 36 },
    { id: 'atlantis', name: 'Atlantis The Palm', kind: 'atlantis', x: -4060, z: -1690, radius: 95, h: 60 },
    { id: 'aindubai', name: 'Ain Dubai', kind: 'ferris', x: -5040, z: -670, radius: 135, h: 250 }
  ];

  const BRIDGE_SPECS = [
    {
      id: 'creek', name: 'Creek Crossing', from: [3400, 2350], to: [4600, 2100],
      width: 26, deckY: 34, towerH: 78, towerColor: 0x9a927f, cableColor: 0xb2ac9d,
      type: 'suspension', stays: false
    }
  ];

  const STREET_GRID = { avenue: 250, street: 96 };

  window.GZ_CITIES = window.GZ_CITIES || {};
  window.GZ_CITIES.dubai = {
    id: 'dubai',
    kicker: 'DUBAI',
    coords: '25.2048° N',
    gridAngle: 0,
    water: { deep: 0x1a5f70, shallow: 0x3d9488, sky: 0xc6dde2 },
    build(api) {
      const {
        LOW_POWER, lerp, isParked, inLandmarkExclusion, footprintClear, addBuilding,
        addBoxMesh, addCylinder, MATS, LANDMARK_MATERIALS, makeFacadeMaterial
      } = api;

      LANDMARK_MATERIALS.dubaiBronze = makeFacadeMaterial('glass', 0x8a6f55);
      LANDMARK_MATERIALS.dubaiCream = makeFacadeMaterial('stone', 0xd9cdb4);
      LANDMARK_MATERIALS.gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.32, metalness: 0.85 });
      LANDMARK_MATERIALS.silver = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.75 });
      LANDMARK_MATERIALS.sailWhite = makeFacadeMaterial('stone', 0xe8eef2);
      LANDMARK_MATERIALS.atlantisPink = makeFacadeMaterial('stone', 0xd8b4a2);

      const PARK_AREAS = [
        { id: 'zabeel', name: 'Zabeel Park', poly: rect(-1600, 5000, 330, 240), trees: 120, park: true, fill: '#5e7040', lakes: [[-1620, 4940, 90, 55]] },
        { id: 'safa', name: 'Safa Park', poly: rect(-1500, 3300, 230, 190), trees: 100, park: true, fill: '#57693d', lakes: [[-1520, 3260, 80, 50]] },
        { id: 'creekpark', name: 'Creek Park', poly: rect(4980, 1900, 280, 360), trees: 130, park: true, fill: '#5a6c3e' },
        { id: 'miracle', name: 'Miracle Garden', poly: rect(-2600, 2100, 150, 120), trees: 45, park: true, fill: '#6d7c40' },
        { id: 'kite', name: 'Kite Beach', poly: rect(-3400, 255, 900, 50), trees: 60, park: true, fill: '#d8c896' },
        { id: 'qudra', name: 'Qudra Desert', poly: rect(500, 7800, 1400, 600), trees: LOW_POWER ? 80 : 160, park: true, fill: '#c9b489' },
        { id: 'mushrif', name: 'Mushrif Park', poly: rect(4600, 7400, 480, 380), trees: LOW_POWER ? 90 : 190, park: true, fill: '#617141' },
        { id: 'desertbelt', name: 'Desert Greenbelt', poly: rect(1500, 9200, 2200, 160), trees: LOW_POWER ? 70 : 150, park: true, fill: '#c2ad84' }
      ];

      function pickDubaiType(h, rng) {
        const r = rng();
        if (h > 100) return r < 0.62 ? 'glass' : 'dark';
        if (h > 40) return r < 0.5 ? 'glass' : r < 0.78 ? 'concrete' : r < 0.92 ? 'stone' : 'dark';
        return r < 0.42 ? 'concrete' : r < 0.72 ? 'stone' : r < 0.9 ? 'glass' : 'brick';
      }

      // Grid-walk fill shared by every Dubai zone. Clusters are
      // [x, z, radius, extraHeight] and lift tower heights toward a core.
      function fillZone(rng, zone) {
        for (let gx = zone.x0; gx <= zone.x1; gx += zone.step) {
          for (let gz = zone.z0; gz <= zone.z1; gz += zone.step) {
            if (rng() > zone.density) continue;
            const bx = gx + (rng() - 0.5) * 14;
            const bz = gz + (rng() - 0.5) * 14;
            if (isParked(bx, bz, 12) || inLandmarkExclusion(bx, bz, 12)) continue;

            const rows = rng() < 0.55 ? 2 : 1;
            for (let row = 0; row < rows; row++) {
              const cols = 2 + (rng() < 0.5 ? 1 : 0);
              for (let col = 0; col < cols; col++) {
                if (rng() < 0.08) continue;
                const cx = bx + (col - (cols - 1) / 2) * zone.step * 0.32;
                const cz = bz + (row - (rows - 1) / 2) * zone.rowStep;
                if (isParked(cx, cz, 6) || inLandmarkExclusion(cx, cz, 6)) continue;

                const w = zone.step * (0.2 + rng() * 0.07);
                const d = zone.rowStep * (0.6 + rng() * 0.22);
                const rot = (rng() - 0.5) * 0.02;
                if (!footprintClear(cx, cz, w, d, rot)) continue;

                let h = lerp(zone.baseH[0], zone.baseH[1], Math.pow(rng(), zone.taper ?? 1.9));
                for (const [hx, hz, radius, amp] of zone.clusters || []) {
                  const dd = Math.hypot(cx - hx, cz - hz);
                  if (dd < radius) h += amp * Math.pow(1 - dd / radius, 2.1) * (0.55 + rng() * 0.7);
                }
                const type = pickDubaiType(h, rng);
                const color = api.pickPaletteColor(api.BUILDING_TYPES[type].palette, rng);
                addBuilding({ x: cx, z: cz, w, d, h, rot, type, color, baseColor: color });
              }
            }
          }
        }
      }

      function generateDubaiBuildings(rng) {
        fillZone(rng, {
          // Dubai Marina cluster, east of the inlet.
          x0: -4650, x1: -3900, z0: 250, z1: 1750,
          step: 115, rowStep: 62, density: 0.62, baseH: [40, 140],
          clusters: [[-4270, 1150, 700, 190]]
        });
        fillZone(rng, {
          // Jumeirah beachfront villas.
          x0: -3900, x1: -300, z0: 200, z1: 1500,
          step: 118, rowStep: 66, density: 0.42, baseH: [7, 18], clusters: []
        });
        fillZone(rng, {
          // Satwa / old trading core along the coast.
          x0: -300, x1: 1500, z0: 200, z1: 1400,
          step: 120, rowStep: 64, density: 0.55, baseH: [12, 42], clusters: []
        });
        fillZone(rng, {
          // Sheikh Zayed Road corridor: the classic wall of towers.
          x0: -2900, x1: 600, z0: 2450, z1: 3050,
          step: 128, rowStep: 66, density: 0.52, baseH: [55, 150],
          clusters: [[1800, 3800, 1600, 90]]
        });
        fillZone(rng, {
          // Downtown around the Burj Khalifa.
          x0: 600, x1: 3000, z0: 2900, z1: 5000,
          step: 130, rowStep: 72, density: 0.6, baseH: [26, 80],
          clusters: [[1800, 3800, 1150, 200]]
        });
        fillZone(rng, {
          // Business Bay east of the Burj.
          x0: 2100, x1: 3400, z0: 2500, z1: 3600,
          step: 126, rowStep: 68, density: 0.55, baseH: [45, 130],
          clusters: [[1800, 3800, 1000, 140]]
        });
        fillZone(rng, {
          // Deira, west bank of the creek.
          x0: 3050, x1: 3560, z0: 250, z1: 2100,
          step: 115, rowStep: 62, density: 0.6, baseH: [14, 48], clusters: []
        });
        fillZone(rng, {
          // Deira east of the creek.
          x0: 4700, x1: 5550, z0: 250, z1: 2200,
          step: 118, rowStep: 64, density: 0.55, baseH: [12, 42], clusters: []
        });
        fillZone(rng, {
          // Northern residential belt at the desert edge.
          x0: -2600, x1: 600, z0: 5600, z1: 7400,
          step: 150, rowStep: 90, density: 0.25, baseH: [8, 26], clusters: []
        });
        fillZone(rng, {
          // Desert outskirts.
          x0: -5200, x1: 5400, z0: 7500, z1: 9300,
          step: 175, rowStep: 130, density: 0.15, baseH: [6, 14], clusters: []
        });
      }

      // -- Landmark builders ------------------------------------------------

      function makeBurj(group, h) {
        addBoxMesh(group, 170, 18, 170, 0, 0, 0, LANDMARK_MATERIALS.glassBlue);
        addBoxMesh(group, 120, 14, 120, 0, 18, 0, LANDMARK_MATERIALS.glassDeep);
        // Three lobes spiral upward around a receding core — the Y-plan setback.
        const tiers = [
          { r: 30, lob: 16, th: 150, y: 32 },
          { r: 26, lob: 13, th: 130, y: 182 },
          { r: 22, lob: 11, th: 120, y: 312 },
          { r: 18, lob: 9, th: 110, y: 432 },
          { r: 14, lob: 7, th: 100, y: 542 },
          { r: 10, lob: 5, th: 90, y: 642 }
        ];
        let ang = 0;
        for (const t of tiers) {
          for (let k = 0; k < 3; k++) {
            const a = ang + (k * TAU) / 3;
            addCylinder(group, t.r * 0.92, t.r, t.th, Math.cos(a) * t.lob, t.y, Math.sin(a) * t.lob, LANDMARK_MATERIALS.glassBlue, 10);
          }
          addCylinder(group, t.r * 0.55, t.r * 0.62, t.th, 0, t.y, 0, LANDMARK_MATERIALS.glassDeep, 10);
          ang += deg15;
        }
        const top = 732;
        addCylinder(group, 7, 9, 40, 0, top, 0, LANDMARK_MATERIALS.glassDeep, 8);
        addCylinder(group, 1.6, 6, 34, 0, top + 40, 0, MATS.steel, 8);
        addCylinder(group, 0.25, 1.4, 22, 0, top + 74, 0, MATS.steel, 5);
      }
      const deg15 = (15 * Math.PI) / 180;

      function makeEmirates(group, spec) {
        const mat = LANDMARK_MATERIALS.dubaiBronze;
        const h = spec.h;
        const shaft = addCylinder(group, spec.w * 0.5, spec.w * 0.58, h * 0.82, 0, 0, 0, mat, 3);
        shaft.rotation.y = 0.35;
        const crown = addCylinder(group, spec.w * 0.16, spec.w * 0.42, h * 0.12, 0, h * 0.82, 0, mat, 3);
        crown.rotation.y = 0.35;
        const fin = addBoxMesh(group, 8, h * 0.3, spec.w * 0.4, spec.w * 0.28, h * 0.66, 0, mat, false);
        fin.rotation.z = 0.3;
        addBoxMesh(group, spec.w * 1.5, 10, spec.d * 1.5, 0, 0, 0, mat);
      }

      function makeDomeCrown(group, spec) {
        const h = spec.h;
        const w = spec.w;
        addBoxMesh(group, w * 1.6, 16, w * 1.6, 0, 0, 0, LANDMARK_MATERIALS.dubaiCream);
        addCylinder(group, w * 0.42, w * 0.5, h * 0.62, 0, 16, 0, LANDMARK_MATERIALS.dubaiCream, 22);
        addCylinder(group, w * 0.2, w * 0.44, h * 0.16, 0, 16 + h * 0.62, 0, LANDMARK_MATERIALS.dubaiCream, 18);
        const dome = addCylinder(group, 0.8, w * 0.22, h * 0.1, 0, 16 + h * 0.78, 0, LANDMARK_MATERIALS.dubaiCream, 16);
        dome.geometry.computeVertexNormals();
        addCylinder(group, 0.2, 0.6, h * 0.07, 0, 16 + h * 0.88, 0, LANDMARK_MATERIALS.gold, 6);
      }

      function makeTwist(group, spec) {
        const slabs = 30;
        const slabH = spec.h / slabs;
        const totalTwist = Math.PI / 2;
        for (let i = 0; i < slabs; i++) {
          const slab = addBoxMesh(group, spec.w, slabH + 1, spec.d, 0, i * slabH, 0, LANDMARK_MATERIALS.glassBlue, false);
          slab.rotation.y = (i / (slabs - 1)) * totalTwist;
        }
        addBoxMesh(group, spec.w * 0.5, 8, spec.d * 0.5, 0, spec.h, 0, MATS.darkSteel, false);
      }

      function makeSail(group, spec) {
        const h = spec.h;
        addCylinder(group, 95, 110, 10, 0, -4, 0, LANDMARK_MATERIALS.dubaiCream, 18);
        addBoxMesh(group, 130, 18, 90, 0, 10, 0, LANDMARK_MATERIALS.glassBlue);
        // The sail: a right-triangle profile with a bowed leading edge.
        const shape = new THREE.Shape();
        shape.moveTo(-46, 28);
        shape.lineTo(46, 28);
        shape.lineTo(46, h * 0.94);
        shape.quadraticCurveTo(10, h * 0.72, -30, 34);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 24, bevelEnabled: false });
        geo.translate(0, 0, -12);
        const sail = new THREE.Mesh(geo, LANDMARK_MATERIALS.sailWhite);
        sail.castShadow = !LOW_POWER;
        group.add(sail);
        addCylinder(group, 1.4, 2.2, h - 24, 46, 28, 0, LANDMARK_MATERIALS.sailWhite, 8);
        // Helipad disc at the famous cantilevered top deck.
        const pad = addCylinder(group, 16, 16, 2.5, 84, h * 0.62, 0, LANDMARK_MATERIALS.sailWhite, 16);
        pad.rotation.y = 0;
        addBoxMesh(group, 10, 2.5, 34, 58, h * 0.62, 0, LANDMARK_MATERIALS.sailWhite, false);
      }

      function makeWave(group, spec) {
        // Stepped arc of slabs rising toward the beach — the wave profile.
        const steps = 9;
        for (let i = 0; i < steps; i++) {
          const seg = addBoxMesh(group, 17, spec.h * (0.3 + (i / steps) * 0.7), spec.d, -52 + i * 13, 0, 0, LANDMARK_MATERIALS.glassBlue, false);
          seg.rotation.z = (i / steps) * 0.5;
        }
        addBoxMesh(group, spec.w * 0.7, 6, spec.d * 0.6, 0, 0, 0, MATS.darkSteel, false);
      }

      function makeFrame(group, spec) {
        const h = spec.h;
        const mat = LANDMARK_MATERIALS.gold;
        addBoxMesh(group, 16, h, 14, -22, 0, 0, mat);
        addBoxMesh(group, 16, h, 14, 22, 0, 0, mat);
        addBoxMesh(group, 60, 16, 14, 0, h - 16, 0, mat, false);
        addBoxMesh(group, 60, 2, 14, 0, 26, 0, mat, false);
        addBoxMesh(group, 60, 2, 14, 0, h * 0.62, 0, mat, false);
      }

      function makeOvoid(group, spec) {
        addBoxMesh(group, 74, 8, 42, 0, 0, 0, LANDMARK_MATERIALS.silver);
        addBoxMesh(group, 58, 4, 30, 0, 8, 0, LANDMARK_MATERIALS.gold, false);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(26, 11, 14, 28),
          LANDMARK_MATERIALS.silver
        );
        ring.scale.set(1, 1.45, 0.72);
        ring.position.y = 42;
        ring.castShadow = !LOW_POWER;
        group.add(ring);
      }

      function makeAtlantis(group, spec) {
        const mat = LANDMARK_MATERIALS.atlantisPink;
        addBoxMesh(group, 60, 44, 42, -44, 0, 0, mat);
        addBoxMesh(group, 60, 44, 42, 44, 0, 0, mat);
        addBoxMesh(group, 34, 62, 34, -44, 0, -4, mat);
        addBoxMesh(group, 34, 62, 34, 44, 0, -4, mat);
        addBoxMesh(group, 128, 18, 42, 0, 44, 0, mat, false);
        // The arch gap under the bridge.
        addBoxMesh(group, 24, 8, 30, 0, 0, 0, mat, false);
        const domeL = addCylinder(group, 0.5, 9, 10, -44, 62, -4, LANDMARK_MATERIALS.gold, 12);
        const domeR = addCylinder(group, 0.5, 9, 10, 44, 62, -4, LANDMARK_MATERIALS.gold, 12);
        domeL.geometry.computeVertexNormals();
        domeR.geometry.computeVertexNormals();
      }

      function makeFerris(group, spec) {
        const R = 118;
        const hub = 132;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(R, 2.6, 8, 44),
          LANDMARK_MATERIALS.silver
        );
        ring.position.y = hub;
        group.add(ring);
        const rim2 = new THREE.Mesh(
          new THREE.TorusGeometry(R * 0.72, 1.6, 6, 36),
          LANDMARK_MATERIALS.silver
        );
        rim2.position.y = hub;
        group.add(rim2);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const spoke = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 0.8, R * 0.72, 5),
            LANDMARK_MATERIALS.silver
          );
          spoke.position.set(Math.cos(a) * R * 0.36, hub + Math.sin(a) * R * 0.36, 0);
          spoke.rotation.z = a + Math.PI / 2;
          group.add(spoke);
        }
        // Cabins hung on the outer rim.
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          addBoxMesh(group, 7, 6, 7, Math.cos(a) * R, hub + Math.sin(a) * R - 4, 0, LANDMARK_MATERIALS.sailWhite, false);
        }
        addCylinder(group, 3.4, 3.4, 7, 0, hub - 3.5, 0, LANDMARK_MATERIALS.silver, 10);
        for (const side of [-1, 1]) {
          const leg = addBoxMesh(group, 9, 136, 9, side * 34, 0, 0, LANDMARK_MATERIALS.silver, false);
          leg.rotation.z = -side * 0.24;
        }
        addBoxMesh(group, 96, 6, 12, 0, 0, 0, LANDMARK_MATERIALS.silver, false);
      }

      const MAKERS = {
        burj: (group, spec) => makeBurj(group, spec.h),
        emirates: makeEmirates,
        domecrown: makeDomeCrown,
        twist: makeTwist,
        sail: makeSail,
        wave: makeWave,
        frame: makeFrame,
        ovoid: makeOvoid,
        atlantis: makeAtlantis,
        ferris: makeFerris
      };
      for (const spec of LANDMARK_SPECS) {
        if (MAKERS[spec.kind]) spec.make = (group) => MAKERS[spec.kind](group, spec);
      }

      function drawMajorRoad(ctx, px, py, scale, points, width, color) {
        const p = new Path2D();
        p.moveTo(px(points[0][0]), py(points[0][1]));
        for (let i = 1; i < points.length; i++) p.lineTo(px(points[i][0]), py(points[i][1]));
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.8, width * scale);
        ctx.stroke(p);
        ctx.strokeStyle = 'rgba(210, 196, 160, 0.3)';
        ctx.lineWidth = Math.max(0.6, 0.8 * scale);
        ctx.stroke(p);
      }

      function paintGround(ctx, px, py, scale, landPaths) {
        ctx.save();
        const allLand = new Path2D();
        for (const land of LAND_POLYS) allLand.addPath(landPaths[land.id]);

        // Minor street grid, angle 0, aligned with the coast.
        ctx.save();
        ctx.clip(allLand);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(96, 84, 62, 0.42)';
        ctx.lineWidth = Math.max(0.7, 1.0 * scale);
        for (let x = -5300; x <= 5500; x += 118) {
          ctx.beginPath();
          ctx.moveTo(px(x), py(140));
          ctx.lineTo(px(x), py(9350));
          ctx.stroke();
        }
        for (let z = 200; z <= 9300; z += 128) {
          ctx.beginPath();
          ctx.moveTo(px(-5350), py(z));
          ctx.lineTo(px(5550), py(z));
          ctx.stroke();
        }
        ctx.restore();

        // Highways: Sheikh Zayed Road, Al Khail and the beach road.
        ctx.save();
        ctx.clip(allLand);
        drawMajorRoad(ctx, px, py, scale, [
          [-3000, 2650], [-1500, 2680], [0, 2700], [1500, 2720], [2600, 2700], [3400, 2640]
        ], 4.6, 'rgba(60, 52, 40, 0.85)');
        drawMajorRoad(ctx, px, py, scale, [
          [-2600, 4450], [-1000, 4500], [600, 4460], [2200, 4400], [3300, 4340]
        ], 3.4, 'rgba(70, 62, 48, 0.72)');
        drawMajorRoad(ctx, px, py, scale, [
          [-4650, 240], [-3000, 220], [-1000, 230], [1500, 210], [3350, 230]
        ], 2.6, 'rgba(80, 70, 52, 0.6)');
        ctx.restore();

        api.drawParks(ctx, px, py, scale);

        // Plaza pads under the big landmarks.
        ctx.save();
        for (const [x, z, w, d] of [
          [1800, 3800, 260, 260], [1030, 2940, 170, 150], [-1600, 5000, 150, 120],
          [-560, 3480, 130, 100], [-4270, 1150, 200, 170], [3300, 1200, 150, 130],
          [-4060, -1690, 220, 120]
        ]) {
          ctx.fillStyle = 'rgba(126, 116, 96, 0.32)';
          ctx.fillRect(px(x - w / 2), py(z + d / 2), w * scale, d * scale);
        }
        ctx.restore();

        // Trim everything back inside the coastlines.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = '#fff';
        ctx.fill(allLand);
        ctx.restore();
      }

      return {
        landPolys: LAND_POLYS,
        parks: PARK_AREAS,
        landmarks: LANDMARK_SPECS,
        bridges: BRIDGE_SPECS,
        streetGrid: STREET_GRID,
        defaultCamera: {
          tx: 900,
          tz: 3000,
          ty: 140,
          distance: LOW_POWER ? 10500 : 9000,
          azimuth: 2.35,
          pitch: LOW_POWER ? 0.36 : 0.31
        },
        paintGround,
        generateBuildings: generateDubaiBuildings
      };
    }
  };
})();
