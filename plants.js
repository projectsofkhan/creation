import * as THREE from 'three';
import { gameState, Audio, HUD, terrainHeight } from './engine.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — plants.js
   6 real vegetables · biological growth · soil · disease · harvest
   ═══════════════════════════════════════════════════════════════ */

// ── Materials shared across all plants (memory efficient) ──
const PLANT_MAT = {
  stemGreen: new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.82 }),
  stemDark: new THREE.MeshStandardMaterial({ color: 0x3a6028, roughness: 0.85 }),
  leafMid: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8, side: THREE.DoubleSide }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x356a28, roughness: 0.82, side: THREE.DoubleSide }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6ab04a, roughness: 0.78, side: THREE.DoubleSide }),

  // Fruits
  tomatoRed: new THREE.MeshStandardMaterial({ color: 0xe83a2a, roughness: 0.35, metalness: 0.05, emissive: 0x2a0808, emissiveIntensity: 0.2 }),
  tomatoGreen: new THREE.MeshStandardMaterial({ color: 0x7aba4a, roughness: 0.5 }),
  carrotOrange: new THREE.MeshStandardMaterial({ color: 0xe87820, roughness: 0.55 }),
  potatoBrown: new THREE.MeshStandardMaterial({ color: 0xa87850, roughness: 0.75 }),
  cornYellow: new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5, emissive: 0x1a1000, emissiveIntensity: 0.15 }),
  cornGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.55 }),
  lettuceLeaf: new THREE.MeshStandardMaterial({ color: 0x7ac850, roughness: 0.7, side: THREE.DoubleSide }),
  strawberryRed: new THREE.MeshStandardMaterial({ color: 0xd82838, roughness: 0.4, emissive: 0x2a0008, emissiveIntensity: 0.25 }),
  strawberryGreen: new THREE.MeshStandardMaterial({ color: 0x8aba4a, roughness: 0.55 }),

  // Flowers
  flowerWhite: new THREE.MeshStandardMaterial({ color: 0xfdfaf0, roughness: 0.7 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xf0d040, roughness: 0.7 }),

  // Problems
  wilt: new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 0.95 }),
  spot: new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.9 }),
};

// ═══════════════════════════════════════════════════════════════
//  CROP DEFINITIONS — real vegetables, real biology
// ═══════════════════════════════════════════════════════════════
export const CROPS = {
  tomato: {
    id: 'tomato', name: 'Tomato', emoji: '🍅', value: 8,
    seedCost: 5, daysToHarvest: 3.5,
    waterNeed: 0.75,        // 0–1: needs frequent water
    sunNeed: 0.85,
    tempOptimal: [18, 26],
    spacing: 0.9,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'mature'],
    diseaseRisk: { blight: 0.02, mildew: 0.015 },
    build: buildTomato,
    desc: 'Warm-season, needs steady moisture. Fruit ripens red in late summer.',
  },
  carrot: {
    id: 'carrot', name: 'Carrot', emoji: '🥕', value: 6,
    seedCost: 4, daysToHarvest: 2.5,
    waterNeed: 0.55, sunNeed: 0.7,
    tempOptimal: [12, 22],
    spacing: 0.6,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'root growth', 'mature'],
    diseaseRisk: { rootFly: 0.02 },
    build: buildCarrot,
    desc: 'Cool-season root vegetable. Soil must be loose, not compacted.',
  },
  potato: {
    id: 'potato', name: 'Potato', emoji: '🥔', value: 9,
    seedCost: 6, daysToHarvest: 4.0,
    waterNeed: 0.6, sunNeed: 0.75,
    tempOptimal: [14, 22],
    spacing: 0.8,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'tuber formation', 'mature'],
    diseaseRisk: { blight: 0.03 },
    build: buildPotato,
    desc: 'Underground tuber. Deep watering at tuber-formation stage is critical.',
  },
  corn: {
    id: 'corn', name: 'Corn', emoji: '🌽', value: 12,
    seedCost: 8, daysToHarvest: 4.5,
    waterNeed: 0.8, sunNeed: 0.9,
    tempOptimal: [20, 30],
    spacing: 1.2,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'tasseling', 'silking', 'mature'],
    diseaseRisk: { rust: 0.015 },
    build: buildCorn,
    desc: 'Tall grass. Needs abundant sun and water. Pollinates via tassels.',
  },
  lettuce: {
    id: 'lettuce', name: 'Lettuce', emoji: '🥬', value: 5,
    seedCost: 5, daysToHarvest: 2.0,
    waterNeed: 0.7, sunNeed: 0.6,
    tempOptimal: [10, 20],
    spacing: 0.5,
    stages: ['seed', 'germination', 'seedling', 'leaf development', 'heart forming', 'mature'],
    diseaseRisk: { slug: 0.03, bolt: 0.05 },
    build: buildLettuce,
    desc: 'Fast cool-season crop. Bolts (flowers, turns bitter) in heat.',
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', emoji: '🍓', value: 10,
    seedCost: 10, daysToHarvest: 3.0,
    waterNeed: 0.65, sunNeed: 0.8,
    tempOptimal: [15, 25],
    spacing: 0.7,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'mature'],
    diseaseRisk: { botrytis: 0.025 },
    build: buildStrawberry,
    desc: 'Perennial. Produces runners. Fruit is sweetest when fully red.',
  },
};

// ═══════════════════════════════════════════════════════════════
//  GEOMETRY BUILDERS — one per vegetable
// ═══════════════════════════════════════════════════════════════

// ── TOMATO ─────────────────────────────────────────────────
function buildTomato(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.tomato, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    // Seed — tiny dirt mound
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.4, 1);
    g.add(mound);
    return g;
  }

  if (stage === 1) {
    // Germination — first cotyledon leaves
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.08, 5),
      PLANT_MAT.stemGreen
    );
    stem.position.y = 0.04;
    g.add(stem);
    for (const side of [-1, 1]) {
      const cot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 4),
        PLANT_MAT.leafLight
      );
      cot.scale.set(1.2, 0.3, 0.6);
      cot.position.set(side * 0.05, 0.09, 0);
      cot.rotation.z = side * 0.3;
      g.add(cot);
    }
    return g;
  }

  // Stem (stages 2+)
  const stemHeight = stage === 2 ? 0.15 : stage === 3 ? 0.4 : stage === 4 ? 0.7 : 0.95;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.03, stemHeight, 6),
    PLANT_MAT.stemGreen
  );
  stem.position.y = stemHeight / 2;
  stem.castShadow = true;
  g.add(stem);

  // Compound leaves (tomato has compound, serrated leaves)
  const leafCount = stage === 2 ? 2 : stage === 3 ? 4 : 6;
  for (let i = 0; i < leafCount; i++) {
    const leafGroup = new THREE.Group();
    const angle = i * 1.15 + 0.3;
    const y = 0.1 + i * (stemHeight * 0.14);

    // Main leaf axis
    const leafStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.15, 4),
      PLANT_MAT.stemGreen
    );
    leafStem.position.set(Math.cos(angle) * 0.08, y, Math.sin(angle) * 0.08);
    leafStem.rotation.z = Math.PI / 2 - 0.4;
    leafStem.rotation.y = -angle;
    leafGroup.add(leafStem);

    // Leaflets (5 per compound leaf)
    for (let j = 0; j < 5; j++) {
      const t = j / 4;
      const leaflet = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + t * 0.03, 5, 3),
        j % 2 === 0 ? PLANT_MAT.leafMid : PLANT_MAT.leafDark
      );
      const dist = 0.1 + t * 0.14;
      leaflet.scale.set(1.4, 0.25, 0.7);
      leaflet.position.set(
        Math.cos(angle) * (0.08 + dist),
        y + Math.sin(t * 1.2) * 0.05,
        Math.sin(angle) * (0.08 + dist)
      );
      leaflet.rotation.y = -angle;
      leaflet.rotation.x = 0.15;
      leaflet.rotation.z = -0.3 * (1 - wilt);
      if (wilt > 0) leaflet.rotation.z -= wilt * 0.4;
      leafGroup.add(leaflet);
    }
    g.add(leafGroup);
  }

  // Flowers (stage 4)
  if (stage === 4) {
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1;
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 4),
        PLANT_MAT.flowerYellow
      );
      flower.position.set(
        Math.cos(angle) * 0.15,
        stemHeight * 0.8 + i * 0.04,
        Math.sin(angle) * 0.15
      );
      flower.scale.set(1, 0.6, 1);
      g.add(flower);
    }
  }

  // Fruit (stages 5, 6)
  if (stage >= 5) {
    const ripe = stage === 6;
    const fruitMat = ripe ? PLANT_MAT.tomatoRed : PLANT_MAT.tomatoGreen;
    const fruitCount = ripe ? 5 : 4;
    for (let i = 0; i < fruitCount; i++) {
      const angle = i * 1.4 + 0.5;
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(ripe ? 0.08 : 0.05, 8, 6),
        fruitMat
      );
      fruit.scale.set(1, 0.9, 1);
      fruit.position.set(
        Math.cos(angle) * 0.18,
        stemHeight * 0.5 + i * 0.08,
        Math.sin(angle) * 0.18
      );
      fruit.castShadow = true;
      g.add(fruit);

      // Calyx (star-shaped green top)
      for (let s = 0; s < 5; s++) {
        const sepal = new THREE.Mesh(
          new THREE.ConeGeometry(0.02, 0.04, 3),
          PLANT_MAT.stemGreen
        );
        sepal.position.set(
          fruit.position.x + Math.cos(s * 1.26) * 0.04,
          fruit.position.y + 0.05,
          fruit.position.z + Math.sin(s * 1.26) * 0.04
        );
        sepal.rotation.x = Math.PI / 2;
        g.add(sepal);
      }
    }
  }

  // Disease spots
  if (health < 0.6 && Math.random() < 0.3) {
    for (let i = 0; i < 3; i++) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 4, 3),
        PLANT_MAT.spot
      );
      spot.position.set(
        (Math.random() - 0.5) * 0.2,
        Math.random() * stemHeight,
        (Math.random() - 0.5) * 0.2
      );
      spot.scale.set(1, 0.4, 1);
      g.add(spot);
    }
  }

  return g;
}

// ── CARROT ─────────────────────────────────────────────────
function buildCarrot(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.carrot, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }

  // Feathery foliage (carrots have finely divided leaves)
  const foliageHeight = stage === 1 ? 0.1 : stage === 2 ? 0.18 : stage === 3 ? 0.3 : 0.35;
  const leafCount = stage === 1 ? 2 : stage === 2 ? 4 : stage >= 3 ? 7 : 9;

  for (let i = 0; i < leafCount; i++) {
    const angle = i * 0.9;
    const leafGroup = new THREE.Group();

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.008, foliageHeight, 4),
      PLANT_MAT.stemGreen
    );
    stem.position.y = foliageHeight / 2;
    stem.rotation.z = Math.cos(angle) * 0.2;
    stem.rotation.x = Math.sin(angle) * 0.2;
    leafGroup.add(stem);

    // Feathery leaflets — many small cones arranged like fern
    for (let j = 0; j < 6; j++) {
      const t = j / 6;
      for (const side of [-1, 1]) {
        const leaflet = new THREE.Mesh(
          new THREE.ConeGeometry(0.018, 0.06, 3),
          PLANT_MAT.leafLight
        );
        leaflet.position.set(
          Math.cos(angle) * (0.02 + t * 0.05) + side * 0.03 * (1 - t * 0.5),
          foliageHeight * (0.4 + t * 0.6),
          Math.sin(angle) * (0.02 + t * 0.05)
        );
        leaflet.rotation.z = side * 0.9;
        leaflet.rotation.x = -angle + Math.PI / 2;
        leaflet.rotation.z -= wilt * 0.6;
        leafGroup.add(leaflet);
      }
    }
    g.add(leafGroup);
  }

  // Root (stages 4+)
  if (stage >= 4) {
    const rootSize = stage === 4 ? 0.12 : 0.22;
    const root = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, rootSize, 8),
      PLANT_MAT.carrotOrange
    );
    root.rotation.x = Math.PI;
    root.position.y = -rootSize / 2 + 0.02;
    root.castShadow = true;
    g.add(root);

    // Root tip
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.015, 0.08, 4),
      PLANT_MAT.carrotOrange
    );
    tip.rotation.x = Math.PI;
    tip.position.y = -rootSize - 0.04;
    g.add(tip);
  }

  return g;
}

// ── POTATO ─────────────────────────────────────────────────
function buildPotato(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.potato, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.35, 1);
    g.add(mound);
    return g;
  }

  const plantHeight = stage === 1 ? 0.1 : stage === 2 ? 0.25 : stage === 3 ? 0.5 : 0.6;

  // Main stems (potato has multiple)
  const stemCount = stage <= 2 ? 1 : stage === 3 ? 2 : 3;
  for (let s = 0; s < stemCount; s++) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, plantHeight, 6),
      PLANT_MAT.stemGreen
    );
    const angle = (s / stemCount) * Math.PI * 2;
    stem.position.set(Math.cos(angle) * 0.06, plantHeight / 2, Math.sin(angle) * 0.06);
    stem.rotation.z = Math.cos(angle) * 0.15;
    stem.rotation.x = Math.sin(angle) * 0.15;
    stem.castShadow = true;
    g.add(stem);
  }

  // Broad compound leaves (potato leaves are pinnate)
  const leafCount = stage === 1 ? 2 : stage === 2 ? 4 : stage === 3 ? 6 : 8;
  for (let i = 0; i < leafCount; i++) {
    const angle = i * 1.3;
    const y = 0.1 + (i / leafCount) * plantHeight * 0.9;
    const leafGroup = new THREE.Group();

    // Leaf rachis
    const rachis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.008, 0.14, 4),
      PLANT_MAT.stemGreen
    );
    rachis.position.set(Math.cos(angle) * 0.06, y, Math.sin(angle) * 0.06);
    rachis.rotation.z = Math.PI / 2 - 0.3;
    rachis.rotation.y = -angle;
    leafGroup.add(rachis);

    // Leaflets — 5 per rachis
    for (let j = 0; j < 5; j++) {
      const t = j / 4;
      const leaflet = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 + t * 0.03, 5, 3),
        j % 2 === 0 ? PLANT_MAT.leafMid : PLANT_MAT.leafDark
      );
      leaflet.scale.set(1.2, 0.18, 0.75);
      const dist = 0.05 + t * 0.14;
      leaflet.position.set(
        Math.cos(angle) * (0.06 + dist),
        y + Math.sin(t * 1.0) * 0.03,
        Math.sin(angle) * (0.06 + dist)
      );
      leaflet.rotation.y = -angle;
      leaflet.rotation.z = -0.2 * (1 - wilt) - wilt * 0.5;
      leafGroup.add(leaflet);
    }
    g.add(leafGroup);
  }

  // Flowers (white, star-shaped — stage 3+)
  if (stage >= 3) {
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1;
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 4),
        PLANT_MAT.flowerWhite
      );
      flower.position.set(
        Math.cos(angle) * 0.15,
        plantHeight * 0.9,
        Math.sin(angle) * 0.15
      );
      flower.scale.set(1, 0.5, 1);
      g.add(flower);
    }
  }

  // Tubers (stage 4+ — tiny visible at soil line for gameplay feedback)
  if (stage >= 4) {
    const tuberCount = stage === 4 ? 2 : 4;
    for (let i = 0; i < tuberCount; i++) {
      const angle = i * 1.5;
      const tuber = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        PLANT_MAT.potatoBrown
      );
      tuber.scale.set(1.2, 0.8, 1);
      tuber.position.set(
        Math.cos(angle) * 0.2,
        0.02,
        Math.sin(angle) * 0.2
      );
      // Half-hidden — only top visible
      tuber.scale.y = 0.5;
      g.add(tuber);
    }
  }

  return g;
}

// ── CORN ───────────────────────────────────────────────────
function buildCorn(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.corn, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }

  const plantHeight = stage === 1 ? 0.15 : stage === 2 ? 0.4 : stage === 3 ? 0.9 : stage === 4 ? 1.4 : 1.7;

  // Single thick stalk
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, plantHeight, 7),
    PLANT_MAT.stemGreen
  );
  stalk.position.y = plantHeight / 2;
  stalk.castShadow = true;
  g.add(stalk);

  // Long blade leaves (corn has long narrow leaves that arch)
  const leafCount = stage === 1 ? 2 : stage === 2 ? 4 : stage === 3 ? 6 : stage === 4 ? 8 : 10;
  for (let i = 0; i < leafCount; i++) {
    const angle = i * 1.15;
    const y = 0.15 + (i / leafCount) * plantHeight * 0.85;

    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + (plantHeight * 0.15), 0.02, 0.1),
      PLANT_MAT.leafMid
    );
    leaf.position.set(0, y, 0);
    // Rotate so it extends outward
    leaf.rotation.y = angle;
    leaf.rotation.z = 0.4 - wilt * 0.5;
    // Move leaf so inner edge is at stalk
    leaf.position.x = Math.cos(angle) * 0.22;
    leaf.position.z = Math.sin(angle) * 0.22;
    leaf.castShadow = true;
    g.add(leaf);
  }

  // Tassel (stage 4+) — male flowers at top
  if (stage >= 4) {
    for (let i = 0; i < 5; i++) {
      const tassel = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.15, 3),
        PLANT_MAT.flowerYellow
      );
      const angle = i * 1.26;
      tassel.position.set(
        Math.cos(angle) * 0.03,
        plantHeight + 0.05,
        Math.sin(angle) * 0.03
      );
      tassel.rotation.z = Math.cos(angle) * 0.4;
      tassel.rotation.x = Math.sin(angle) * 0.4;
      g.add(tassel);
    }
  }

  // Ears (stage 5+) — ears with silk
  if (stage >= 5) {
    const ripe = stage === 6;
    const earMat = ripe ? PLANT_MAT.cornYellow : PLANT_MAT.cornGreen;
    for (let i = 0; i < 2; i++) {
      const angle = i * Math.PI + 0.5;
      const earY = plantHeight * 0.55;

      const ear = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.06, ripe ? 0.22 : 0.15, 4, 8),
        earMat
      );
      ear.position.set(
        Math.cos(angle) * 0.08,
        earY,
        Math.sin(angle) * 0.08
      );
      ear.rotation.z = Math.cos(angle) * 0.6;
      ear.rotation.x = Math.sin(angle) * 0.6;
      ear.castShadow = true;
      g.add(ear);

      // Husk leaves (green, wrapping)
      for (let h = 0; h < 3; h++) {
        const husk = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.25, 0.01),
          PLANT_MAT.leafDark
        );
        husk.position.copy(ear.position);
        husk.position.y += 0.02;
        husk.rotation.copy(ear.rotation);
        husk.rotation.y += h * 0.4;
        g.add(husk);
      }

      // Silk (threads coming out of ear tip)
      if (ripe) {
        for (let s = 0; s < 6; s++) {
          const silk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.12, 3),
            new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.9 })
          );
          silk.position.copy(ear.position);
          silk.position.y += 0.15;
          silk.rotation.z = Math.cos(s * 1.05) * 0.6;
          silk.rotation.x = Math.sin(s * 1.05) * 0.6;
          g.add(silk);
        }
      }
    }
  }

  return g;
}

// ── LETTUCE ────────────────────────────────────────────────
function buildLettuce(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.lettuce, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }

  // Lettuce grows as a rosette of leaves from center
  const leafCount = stage === 1 ? 3 : stage === 2 ? 5 : stage === 3 ? 8 : stage === 4 ? 12 : 16;
  const leafSize = stage === 1 ? 0.06 : stage === 2 ? 0.1 : stage === 3 ? 0.15 : stage === 4 ? 0.2 : 0.24;

  for (let i = 0; i < leafCount; i++) {
    // Golden angle spiral for natural rosette
    const angle = i * 2.399;
    const layer = Math.floor(i / 4);
    const angleOffset = layer * 0.5;

    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(leafSize, 8, 6),
      PLANT_MAT.lettuceLeaf
    );
    leaf.scale.set(1, 0.18, 1.3);
    const dist = 0.04 + (i / leafCount) * 0.15;
    leaf.position.set(
      Math.cos(angle + angleOffset) * dist,
      0.02 + (i / leafCount) * 0.15,
      Math.sin(angle + angleOffset) * dist
    );
    leaf.rotation.y = -angle - angleOffset;
    leaf.rotation.z = -0.1 * (1 - wilt) - wilt * 0.4;
    leaf.rotation.x = (i / leafCount) * 0.3;
    leaf.castShadow = true;
    g.add(leaf);
  }

  // Central heart (stage 5+ — pale inner leaves)
  if (stage >= 5) {
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd0e8a0, roughness: 0.75 })
    );
    heart.scale.set(1, 1.4, 1);
    heart.position.y = 0.15;
    g.add(heart);
  }

  // Bolting (flowering — stage 5+ if heat-stressed)
  if (health < 0.5 && stage >= 4) {
    const boltStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.5, 4),
      PLANT_MAT.stemGreen
    );
    boltStem.position.y = 0.35;
    g.add(boltStem);
    for (let i = 0; i < 6; i++) {
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 5, 4),
        PLANT_MAT.flowerYellow
      );
      const a = i * 1.05;
      fl.position.set(
        Math.cos(a) * 0.05,
        0.55 + Math.sin(a) * 0.03,
        Math.sin(a) * 0.05
      );
      g.add(fl);
    }
  }

  return g;
}

// ── STRAWBERRY ─────────────────────────────────────────────
function buildStrawberry(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.strawberry, growth);
  const wilt = health < 0.4 ? (0.4 - health) / 0.4 : 0;

  if (stage === 0) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      PLANT_MAT.stemDark
    );
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }

  // Strawberry grows as a low rosette with trifoliate leaves
  const leafCount = stage === 1 ? 2 : stage === 2 ? 3 : stage === 3 ? 5 : stage === 4 ? 7 : 8;
  const leafScale = stage === 1 ? 0.5 : stage === 2 ? 0.75 : stage === 3 ? 1 : 1.2;

  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + i * 0.4;
    const leafGroup = new THREE.Group();

    // Petiole (stem connecting to leaf)
    const petiole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.15 * leafScale, 4),
      PLANT_MAT.stemGreen
    );
    petiole.position.set(
      Math.cos(angle) * 0.06,
      0.08 * leafScale,
      Math.sin(angle) * 0.06
    );
    petiole.rotation.z = Math.cos(angle) * 0.4;
    petiole.rotation.x = -Math.sin(angle) * 0.4;
    petiole.rotation.z -= wilt * 0.6;
    leafGroup.add(petiole);

    // 3 leaflets (trifoliate)
    for (let j = 0; j < 3; j++) {
      const leafletAngle = (j - 1) * 0.6;
      const leaflet = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 * leafScale, 6, 4),
        PLANT_MAT.leafMid
      );
      leaflet.scale.set(1.2, 0.2, 0.9);
      leaflet.position.set(
        Math.cos(angle) * 0.1 * leafScale + Math.cos(angle + leafletAngle) * 0.08,
        0.13 * leafScale,
        Math.sin(angle) * 0.1 * leafScale + Math.sin(angle + leafletAngle) * 0.08
      );
      leaflet.rotation.y = -angle - leafletAngle;
      leaflet.rotation.z = -0.2 - wilt * 0.4;
      leaflet.castShadow = true;
      leafGroup.add(leaflet);
    }
    g.add(leafGroup);
  }

  // Flowers (stage 4) — white with yellow centers
  if (stage === 4) {
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1 + 0.5;
      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(
        Math.cos(angle) * 0.12,
        0.22,
        Math.sin(angle) * 0.12
      );

      for (let p = 0; p < 5; p++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 5, 3),
          PLANT_MAT.flowerWhite
        );
        petal.scale.set(1.3, 0.2, 1);
        petal.position.set(
          Math.cos(p * 1.26) * 0.03,
          0,
          Math.sin(p * 1.26) * 0.03
        );
        flowerGroup.add(petal);
      }

      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 5, 4),
        PLANT_MAT.flowerYellow
      );
      center.position.y = 0.01;
      flowerGroup.add(center);

      g.add(flowerGroup);
    }
  }

  // Fruit (stages 5, 6)
  if (stage >= 5) {
    const ripe = stage === 6;
    const fruitMat = ripe ? PLANT_MAT.strawberryRed : PLANT_MAT.strawberryGreen;
    const fruitCount = ripe ? 5 : 3;
    for (let i = 0; i < fruitCount; i++) {
      const angle = i * 1.4 + 0.3;
      const r = 0.14 + Math.random() * 0.06;

      const fruit = new THREE.Mesh(
        new THREE.ConeGeometry(ripe ? 0.055 : 0.035, ripe ? 0.09 : 0.06, 6),
        fruitMat
      );
      fruit.rotation.x = Math.PI;
      fruit.position.set(
        Math.cos(angle) * r,
        0.08,
        Math.sin(angle) * r
      );
      fruit.castShadow = true;
      g.add(fruit);

      // Seeds (tiny dots on surface — only if ripe)
      if (ripe) {
        for (let s = 0; s < 6; s++) {
          const seed = new THREE.Mesh(
            new THREE.SphereGeometry(0.006, 3, 3),
            new THREE.MeshStandardMaterial({ color: 0xf0e0a0, roughness: 0.7 })
          );
          const sa = s * 1.05;
          seed.position.set(
            fruit.position.x + Math.cos(sa) * 0.04,
            fruit.position.y + (Math.random() - 0.5) * 0.05,
            fruit.position.z + Math.sin(sa) * 0.04
          );
          g.add(seed);
        }
      }

      // Calyx (green leaves at top of fruit)
      for (let s = 0; s < 5; s++) {
        const calyx = new THREE.Mesh(
          new THREE.ConeGeometry(0.012, 0.04, 3),
          PLANT_MAT.stemGreen
        );
        calyx.position.set(
          fruit.position.x + Math.cos(s * 1.26) * 0.03,
          fruit.position.y + 0.06,
          fruit.position.z + Math.sin(s * 1.26) * 0.03
        );
        calyx.rotation.x = Math.PI / 2;
        g.add(calyx);
      }
    }
  }

  // Runners (stolons — only on mature plant, stage 6)
  if (stage === 6) {
    for (let i = 0; i < 2; i++) {
      const angle = i * Math.PI + 0.8;
      const runner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.008, 0.35, 4),
        PLANT_MAT.stemGreen
      );
      runner.position.set(
        Math.cos(angle) * 0.18,
        0.03,
        Math.sin(angle) * 0.18
      );
      runner.rotation.z = Math.PI / 2;
      runner.rotation.y = -angle;
      g.add(runner);

      // Baby plant at runner end
      const babyLeaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 5, 3),
        PLANT_MAT.leafLight
      );
      babyLeaf.scale.set(1.2, 0.2, 1);
      babyLeaf.position.set(
        Math.cos(angle) * 0.35,
        0.03,
        Math.sin(angle) * 0.35
      );
      g.add(babyLeaf);
    }
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  STAGE HELPER
// ═══════════════════════════════════════════════════════════════
function stageFor(crop, growth) {
  const n = crop.stages.length;
  return Math.min(n - 1, Math.floor(growth * n));
}

// ═══════════════════════════════════════════════════════════════
//  PLANT INSTANCE
// ═══════════════════════════════════════════════════════════════
class Plant {
  constructor(cropId, x, z) {
    this.cropId = cropId;
    this.crop = CROPS[cropId];
    this.x = x;
    this.z = z;
    this.y = terrainHeight(x, z);

    this.growth = 0;           // 0 → 1
    this.health = 1.0;         // 0 → 1 (drops with drought, disease)
    this.water = 0.5;          // 0 → 1 (soil moisture at roots)
    this.nutrients = 0.7;      // 0 → 1
    this.sunExposure = 1.0;

    this.stage = 0;
    this.mesh = null;
    this.hasDisease = null;    // 'blight', 'rust', etc.

    this.plantedAt = Date.now();
    this.lastUpdate = Date.now();

    this.rebuildMesh();
  }

  rebuildMesh() {
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
      this.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.mesh = this.crop.build(this.growth, this.health);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = Math.random() * Math.PI * 2;
    this.mesh.userData.plant = this;
    this.mesh.userData.interact = {
      type: 'plant',
      plant: this,
      prompt: this.getPrompt(),
    };
  }

  getPrompt() {
    const crop = this.crop;
    if (this.growth >= 0.98) {
      return `<span class="key">E</span> Harvest ${crop.emoji} ${crop.name}`;
    }
    if (this.water < 0.3) {
      return `<span class="key">E</span> Water ${crop.emoji} ${crop.name} (thirsty)`;
    }
    if (this.hasDisease) {
      return `<span class="key">E</span> Treat ${crop.emoji} ${crop.name} (${this.hasDisease})`;
    }
    const stageName = crop.stages[this.stage] || 'growing';
    return `${crop.emoji} ${crop.name} — ${stageName} (${Math.floor(this.growth * 100)}%)`;
  }

  update(dt, worldTimeDays) {
    const prevStage = this.stage;
    const crop = this.crop;

    // Growth rate — one crop per `daysToHarvest` game-days
    const growthPerDay = 1 / crop.daysToHarvest;
    const growthPerSecond = growthPerDay / (gameState.world.dayLength || 600);

    // Water drains
    this.water = Math.max(0, this.water - dt * 0.0008 * crop.waterNeed);

    // Sun exposure from time of day
    const tod = gameState.world.timeOfDay;
    const dayness = Math.max(0, Math.min(1, 1 - Math.abs(tod - 0.5) * 3));
    this.sunExposure = dayness;

    // Health drops if water too low or too high
    let healthDelta = 0;
    if (this.water < 0.2) {
      healthDelta -= dt * 0.0015;
    } else if (this.water > 0.95) {
      healthDelta -= dt * 0.0003; // waterlogged
    } else if (this.water > 0.4 && this.water < 0.85) {
      healthDelta += dt * 0.0003;
    }

    // Nutrients slowly drop
    this.nutrients = Math.max(0.2, this.nutrients - dt * 0.00005);

    // Disease risk
    if (!this.hasDisease && this.growth > 0.2) {
      for (const [diseaseName, risk] of Object.entries(crop.diseaseRisk)) {
        // Higher risk if waterlogged
        const multiplier = this.water > 0.9 ? 2.5 : 1;
        if (Math.random() < risk * multiplier * dt * 0.1) {
          this.hasDisease = diseaseName;
          healthDelta -= dt * 0.001;
          break;
        }
      }
    }

    // Health clamping
    this.health = Math.max(0, Math.min(1, this.health + healthDelta));

    // Growth — only if healthy and watered
    const growthModifier = this.health * (this.water > 0.25 ? 1.0 : 0.3) * (this.sunExposure > 0.3 ? 1.0 : 0.5);
    if (this.growth < 1) {
      this.growth = Math.min(1, this.growth + dt * growthPerSecond * growthModifier);
    }

    // Stage change → rebuild mesh
    this.stage = stageFor(crop, this.growth);
    const minStageForDisease = this.hasDisease && this.health < 0.4;

    if (this.stage !== prevStage || (this.health < 0.5 && Math.random() < 0.005)) {
      this.rebuildMesh();
    }
  }

  water_() {
    this.water = Math.min(1, this.water + 0.5);
    Audio.playWaterSplash();
    HUD.showToast(`Watered ${this.crop.emoji} ${this.crop.name}`);
    this.rebuildMesh();
  }

  treat() {
    if (this.hasDisease) {
      this.hasDisease = null;
      this.health = Math.min(1, this.health + 0.3);
      HUD.showToast(`Treated ${this.crop.emoji} ${this.crop.name}`);
      Audio.playTone(620, 0.15, 'sine', 0.06);
      this.rebuildMesh();
    }
  }

  harvest() {
    if (this.growth < 0.98) return null;
    const crop = this.crop;
    const yield = Math.floor(1 + this.health * 2);  // 1–3 crops
    return {
      cropId: this.cropId,
      yield,
      value: crop.value * yield,
      quality: this.health > 0.8 ? 'perfect' : this.health > 0.5 ? 'good' : 'poor',
    };
  }

  dispose() {
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
      this.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PLANT MANAGER — manages the farm
// ═══════════════════════════════════════════════════════════════
export class PlantManager {
  constructor(scene) {
    this.scene = scene;
    this.plants = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.soilGroup = new THREE.Group();
    scene.add(this.soilGroup);
  }

  // Try to plant at position — only if not overlapping
  tryPlant(cropId, x, z) {
    const crop = CROPS[cropId];
    if (!crop) return null;
    // Check spacing
    for (const p of this.plants) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < crop.spacing * 0.8) {
        HUD.showToast(`Too close to another ${p.crop.name}`);
        return null;
      }
    }
    // Check player coins + seed count
    if (!gameState.player.seeds[cropId] || gameState.player.seeds[cropId] <= 0) {
      HUD.showToast(`No ${crop.name} seeds`);
      return null;
    }
    // Plant
    const plant = new Plant(cropId, x, z);
    this.plants.push(plant);
    this.group.add(plant.mesh);
    gameState.player.seeds[cropId]--;
    Audio.playTone(520, 0.15, 'sine', 0.05);
    HUD.showToast(`Planted ${crop.emoji} ${crop.name}`);
    window.dispatchEvent(new CustomEvent('hud-refresh'));
    return plant;
  }

  update(dt) {
    const worldDays = gameState.world.timeOfDay;
    for (const p of this.plants) {
      p.update(dt, worldDays);
    }
  }

  getInteractableMeshes() {
    return this.plants.map(p => p.mesh).filter(Boolean);
  }

  findPlantFromObject(obj) {
    let o = obj;
    while (o && !o.userData.plant) o = o.parent;
    return o?.userData.plant || null;
  }

  removePlant(plant) {
    const i = this.plants.indexOf(plant);
    if (i !== -1) {
      plant.dispose();
      this.plants.splice(i, 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT crop lookup helper
// ═══════════════════════════════════════════════════════════════
export function getCropList() {
  return Object.values(CROPS);
}