import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  VERDANT VALE — others.js  (PART 1 of 2)
//  Materials, textures, tools, crops, animals, buildings
// ═══════════════════════════════════════════════════════════════

// ── Shared seeded RNG so textures look the same each reload ──
let _seed = 1337;
function rand() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

// ═══════════════════════════════════════════════════════════════
//  TEXTURE GENERATORS
// ═══════════════════════════════════════════════════════════════

// Soil texture — moisture 0 (dry/grass), 0.15 (tilled), 0.9 (wet)
export function makeSoilTexture(moisture = 0) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const base = moisture > 0.5 ? [52, 34, 18] : moisture > 0.1 ? [88, 60, 34] : [102, 74, 42];
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);

  // Base grain
  for (let i = 0; i < 22000; i++) {
    const v = (rand() - 0.5) * 55;
    ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v * 0.8},${base[2] + v * 0.5},0.85)`;
    const s = 1 + rand() * 2.5;
    ctx.fillRect(rand() * size, rand() * size, s, s);
  }

  // Bright mineral flecks
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(200,160,100,0.22)' : 'rgba(24,14,6,0.32)';
    ctx.fillRect(rand() * size, rand() * size, 1.2, 1.2);
  }

  // Furrows (only for tilled/wet)
  if (moisture >= 0.1) {
    ctx.strokeStyle = moisture > 0.5 ? 'rgba(18,10,5,0.8)' : 'rgba(28,18,10,0.7)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let y = 22; y < size; y += 56) {
      ctx.beginPath();
      for (let x = 0; x < size; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.06) * 3.5);
      }
      ctx.stroke();
    }
    // Ridge highlights
    ctx.strokeStyle = moisture > 0.5 ? 'rgba(90,64,36,0.35)' : 'rgba(140,100,58,0.55)';
    ctx.lineWidth = 3;
    for (let y = 22; y < size; y += 56) {
      ctx.beginPath();
      for (let x = 0; x < size; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.06) * 3.5 - 5);
      }
      ctx.stroke();
    }
    // Clods
    for (let i = 0; i < 400; i++) {
      const x = rand() * size, y = rand() * size;
      const r = 2 + rand() * 5;
      const light = rand() > 0.5;
      ctx.fillStyle = light ? `rgba(${base[0] + 30},${base[1] + 22},${base[2] + 12},0.5)` : `rgba(${base[0] - 20},${base[1] - 14},${base[2] - 8},0.6)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wet gleam
  if (moisture > 0.5) {
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(140,180,220,${0.05 + rand() * 0.08})`;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, 1 + rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Wood plank texture for buildings / crates
export function makeWoodTexture(tint = 0x8b6f47) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = (tint >> 16) & 255, g = (tint >> 8) & 255, b = tint & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  // Grain
  for (let i = 0; i < 4000; i++) {
    const v = (rand() - 0.5) * 40;
    ctx.fillStyle = `rgba(${r + v},${g + v * 0.8},${b + v * 0.6},0.7)`;
    const y = rand() * size;
    const w = 8 + rand() * 40;
    ctx.fillRect(rand() * size, y, w, 1);
  }
  // Planks
  ctx.strokeStyle = 'rgba(30,20,10,0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  // Knots
  for (let i = 0; i < 6; i++) {
    const x = rand() * size, y = rand() * size;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 8 + rand() * 6);
    grad.addColorStop(0, 'rgba(40,26,12,0.8)');
    grad.addColorStop(1, 'rgba(40,26,12,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Bark texture
export function makeBarkTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) {
    const v = (rand() - 0.5) * 60;
    ctx.fillStyle = `rgba(${90 + v},${61 + v * 0.7},${36 + v * 0.5},0.8)`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 6 + rand() * 20);
  }
  // Vertical striations
  ctx.strokeStyle = 'rgba(20,14,8,0.55)';
  ctx.lineWidth = 1;
  for (let x = 0; x < size; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y < size; y += 8) ctx.lineTo(x + Math.sin(y * 0.3) * 2, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ═══════════════════════════════════════════════════════════════
//  MATERIAL FACTORY  — realistic PBR materials
// ═══════════════════════════════════════════════════════════════

export const MATS = {
  // Human
  skin: new THREE.MeshStandardMaterial({ color: 0xe8bfa0, roughness: 0.72, metalness: 0.0 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x4a8bc8, roughness: 0.92, metalness: 0.0 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.94, metalness: 0.0 }),
  hat: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.82, metalness: 0.03 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.82, metalness: 0.08 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),

  // Metal
  iron: new THREE.MeshStandardMaterial({ color: 0x9a9aac, roughness: 0.42, metalness: 0.85 }),
  ironRust: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7, metalness: 0.4 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc88a50, roughness: 0.35, metalness: 0.8 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc850, roughness: 0.25, metalness: 0.95 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.22, metalness: 0.95 }),

  // Wood / leather
  wood: new THREE.MeshStandardMaterial({ map: makeWoodTexture(0x8b6f47), roughness: 0.92 }),
  woodDark: new THREE.MeshStandardMaterial({ map: makeWoodTexture(0x6a4a2a), roughness: 0.94 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.82, metalness: 0.05 }),
  leatherDark: new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.88 }),

  // Water
  water: new THREE.MeshStandardMaterial({
    color: 0x4a90b0, roughness: 0.08, metalness: 0.7,
    transparent: true, opacity: 0.85,
  }),
  waterCan: new THREE.MeshStandardMaterial({ color: 0x5a8a9a, roughness: 0.42, metalness: 0.6 }),

  // Plants
  stem: new THREE.MeshStandardMaterial({ color: 0x5a9b3a, roughness: 0.82 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x5abb4a, roughness: 0.8, side: THREE.DoubleSide }),
  sprout: new THREE.MeshStandardMaterial({ color: 0x6aab4a, roughness: 0.78 }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.82 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6abb4a, roughness: 0.82 }),

  // Fruits
  tomato: new THREE.MeshStandardMaterial({ color: 0xe83a2a, roughness: 0.32, metalness: 0.05, emissive: 0x220000, emissiveIntensity: 0.22 }),
  tomatoGreen: new THREE.MeshStandardMaterial({ color: 0x7abc4a, roughness: 0.55 }),
  corn: new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5, emissive: 0x201000, emissiveIntensity: 0.15 }),
  cornGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.55 }),
  pumpkin: new THREE.MeshStandardMaterial({ color: 0xe87820, roughness: 0.55 }),
  pumpkinGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.6 }),

  // Tree
  bark: new THREE.MeshStandardMaterial({ map: makeBarkTexture(), roughness: 0.95 }),
  foliage1: new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.88, flatShading: true }),
  foliage2: new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 0.88, flatShading: true }),
  foliage3: new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.88, flatShading: true }),

  // Rock
  rock: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92, flatShading: true }),
  rockDark: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.94, flatShading: true }),

  // Building
  wallPlaster: new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.9 }),
  roofTile: new THREE.MeshStandardMaterial({ color: 0xa8503a, roughness: 0.75 }),
  roofThatch: new THREE.MeshStandardMaterial({ color: 0xc8a850, roughness: 0.92 }),
  window: new THREE.MeshStandardMaterial({ color: 0x2a4050, roughness: 0.15, metalness: 0.5, emissive: 0x1a2a40, emissiveIntensity: 0.4 }),

  // Animal
  sheepWool: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.98, flatShading: true }),
  sheepFace: new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.85 }),
  chickenBody: new THREE.MeshStandardMaterial({ color: 0xfaf0e0, roughness: 0.9 }),
  chickenComb: new THREE.MeshStandardMaterial({ color: 0xe83a3a, roughness: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xf0a030, roughness: 0.6 }),
  cowBody: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85 }),
  cowSpot: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.85 }),

  // Misc
  straw: new THREE.MeshStandardMaterial({ color: 0xd4b060, roughness: 0.95 }),
  hay: new THREE.MeshStandardMaterial({ color: 0xb89040, roughness: 0.95 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xb0a080, roughness: 0.95 }),
  pumpkinStem: new THREE.MeshStandardMaterial({ color: 0x6a8a3a, roughness: 0.85 }),
};

// ═══════════════════════════════════════════════════════════════
//  TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const TOOL_DEFS = [
  { icon: '⛏️', label: 'Hoe',    id: 'hoe' },
  { icon: '💧', label: 'Water',  id: 'water' },
  { icon: '🌱', label: 'Seed',   id: 'seed' },
  { icon: '🧺', label: 'Pick',   id: 'pick' },
  { icon: '🐛', label: 'Pest',   id: 'pest' },
  { icon: '🏪', label: 'Shop',   id: 'shop' },
];

// ── Tool models ────────────────────────────────────────────
export function createHoe() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.042, 1.3, 10),
    MATS.wood
  );
  handle.position.y = -0.55;
  handle.rotation.x = 0.35;
  handle.castShadow = true;
  g.add(handle);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10),
    MATS.iron
  );
  collar.position.set(0, -1.13, 0.22);
  collar.rotation.x = 0.35;
  g.add(collar);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.2), MATS.iron);
  blade.position.set(0, -1.18, 0.24);
  blade.rotation.x = 0.35;
  blade.castShadow = true;
  g.add(blade);

  return g;
}

export function createWateringCan() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.28, 14),
    MATS.waterCan
  );
  body.position.y = -0.9;
  body.castShadow = true;
  g.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.014, 6, 20),
    MATS.silver
  );
  rim.position.y = -0.76;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.018, 8, 18, Math.PI),
    MATS.waterCan
  );
  handle.position.set(0, -0.78, -0.06);
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = Math.PI;
  g.add(handle);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.055, 0.38, 8),
    MATS.waterCan
  );
  spout.position.set(0.16, -0.85, 0.13);
  spout.rotation.z = -0.55;
  spout.castShadow = true;
  g.add(spout);

  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.045, 0.04, 12),
    MATS.silver
  );
  rose.position.set(0.24, -0.78, 0.20);
  rose.rotation.z = -0.55;
  g.add(rose);

  return g;
}

export function createSeedPouch() {
  const g = new THREE.Group();
  const pouch = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 10),
    MATS.fabric
  );
  pouch.position.y = -0.9;
  pouch.scale.set(1, 0.85, 1);
  pouch.castShadow = true;
  g.add(pouch);

  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.014, 6, 14),
    MATS.leatherDark
  );
  tie.position.y = -0.78;
  tie.rotation.x = Math.PI / 2;
  g.add(tie);

  // little seeds poking out
  for (let i = 0; i < 4; i++) {
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 4),
      MATS.tomato
    );
    const a = i * 1.6;
    seed.position.set(Math.cos(a) * 0.06, -0.75 + Math.sin(a) * 0.02, Math.sin(a) * 0.06);
    seed.scale.set(1, 1.4, 0.8);
    g.add(seed);
  }

  return g;
}

export function createBasket() {
  const g = new THREE.Group();
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.14, 0.25, 14, 2, true),
    MATS.wood
  );
  basket.position.y = -0.9;
  basket.castShadow = true;
  g.add(basket);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.02, 8, 22),
    MATS.woodDark
  );
  rim.position.y = -0.78;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.015, 8, 20, Math.PI),
    MATS.woodDark
  );
  handle.position.y = -0.72;
  handle.rotation.z = Math.PI;
  g.add(handle);

  return g;
}

export function createPestSpray() {
  const g = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10),
    MATS.copper
  );
  bottle.position.y = -0.88;
  bottle.castShadow = true;
  g.add(bottle);

  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.03, 0.1, 6),
    MATS.silver
  );
  nozzle.position.set(0.06, -0.72, 0.04);
  nozzle.rotation.z = -0.7;
  g.add(nozzle);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  CROPS — 3 types (tomato, corn, pumpkin)
// ═══════════════════════════════════════════════════════════════

export const CROP_TYPES = {
  tomato: {
    name: 'Tomato', emoji: '🍅', value: 12, seedPrice: 5,
    growRate: 0.006, wetMultiplier: 2.6,
    ripeColor: 0xe83a2a,
  },
  corn: {
    name: 'Corn', emoji: '🌽', value: 18, seedPrice: 8,
    growRate: 0.0045, wetMultiplier: 2.4,
    ripeColor: 0xf0c040,
  },
  pumpkin: {
    name: 'Pumpkin', emoji: '🎃', value: 32, seedPrice: 12,
    growRate: 0.003, wetMultiplier: 2.2,
    ripeColor: 0xe87820,
  },
};

// Growth stage helper
export function cropStage(growth) {
  if (growth < 0.2) return 0;  // sprout
  if (growth < 0.5) return 1;  // young
  if (growth < 0.85) return 2; // flowering
  return 3;                    // ripe
}

// ── TOMATO ────────────────────────────────────────────────
export function createTomato(growth) {
  const g = new THREE.Group();

  if (growth < 0.2) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), MATS.sprout);
    sp.position.y = 0.08;
    sp.scale.set(1.3, 0.5, 1.3);
    sp.castShadow = true;
    g.add(sp);
    for (let i = 0; i < 2; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), MATS.leafLight);
      const a = i * Math.PI;
      l.position.set(Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12);
      l.scale.set(1.5, 0.3, 0.7);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
  } else if (growth < 0.5) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.95, 6), MATS.stem);
    stem.position.y = 0.48;
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), MATS.leaf);
      l.scale.set(1.5, 0.35, 1);
      const a = i * 1.6;
      l.position.set(Math.cos(a) * 0.26, 0.42 + i * 0.13, Math.sin(a) * 0.26);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 1.3, 6), MATS.stem);
    stem.position.y = 0.65;
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), MATS.leaf);
      l.scale.set(1.6, 0.35, 1);
      const a = i * 1.05;
      l.position.set(Math.cos(a) * 0.38, 0.3 + i * 0.15, Math.sin(a) * 0.38);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
    const ripe = growth >= 0.85;
    const mat = ripe ? MATS.tomato : MATS.tomatoGreen;
    const count = ripe ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(ripe ? 0.18 : 0.1, ripe ? 10 : 6, ripe ? 8 : 5),
        mat
      );
      const a = i * 1.6;
      f.position.set(Math.cos(a) * 0.32, (ripe ? 0.75 : 0.8) + Math.sin(a * 1.3) * 0.22, Math.sin(a) * 0.32);
      f.scale.set(1, 0.9, 1);
      f.castShadow = true;
      g.add(f);
    }
  }
  return g;
}

// ── CORN ──────────────────────────────────────────────────
export function createCorn(growth) {
  const g = new THREE.Group();

  if (growth < 0.2) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5), MATS.sprout);
    sp.position.y = 0.15;
    sp.castShadow = true;
    g.add(sp);
    for (let i = 0; i < 2; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.08), MATS.leafLight);
      const a = i * Math.PI;
      l.position.set(Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12);
      l.rotation.y = a;
      l.rotation.z = 0.3;
      g.add(l);
    }
  } else if (growth < 0.5) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), MATS.stem);
    stem.position.y = 0.8;
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.16), MATS.leaf);
      l.position.y = 0.4 + i * 0.3;
      const a = i * 1.4;
      l.rotation.y = a;
      l.rotation.z = 0.5;
      l.position.x = Math.cos(a) * 0.15;
      l.position.z = Math.sin(a) * 0.15;
      l.castShadow = true;
      g.add(l);
    }
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.0, 6), MATS.stem);
    stem.position.y = 1.0;
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.025, 0.2), MATS.leaf);
      l.position.y = 0.4 + i * 0.25;
      const a = i * 1.2;
      l.rotation.y = a;
      l.rotation.z = 0.6;
      l.position.x = Math.cos(a) * 0.18;
      l.position.z = Math.sin(a) * 0.18;
      l.castShadow = true;
      g.add(l);
    }
    const ripe = growth >= 0.85;
    const mat = ripe ? MATS.corn : MATS.cornGreen;
    for (let i = 0; i < (ripe ? 2 : 1); i++) {
      const cob = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, 0.32, 4, 8),
        mat
      );
      const a = i * Math.PI + 0.5;
      cob.position.set(Math.cos(a) * 0.18, 1.0, Math.sin(a) * 0.18);
      cob.rotation.z = 0.2;
      cob.rotation.x = Math.PI / 2 + 0.3;
      cob.rotation.y = a;
      cob.castShadow = true;
      g.add(cob);
      // husk
      for (let k = 0; k < 3; k++) {
        const husk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.02), MATS.leaf);
        husk.position.copy(cob.position);
        husk.rotation.set(cob.rotation.x, cob.rotation.y + k * 0.5, 0);
        husk.translateZ(0.08);
        g.add(husk);
      }
    }
  }
  return g;
}

// ── PUMPKIN ───────────────────────────────────────────────
export function createPumpkin(growth) {
  const g = new THREE.Group();

  if (growth < 0.2) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MATS.sprout);
    sp.position.y = 0.08;
    sp.scale.set(1.4, 0.4, 1.4);
    sp.castShadow = true;
    g.add(sp);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), MATS.leafLight);
      const a = i * 2.1;
      l.position.set(Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16);
      l.scale.set(1.5, 0.35, 0.8);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
  } else if (growth < 0.5) {
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 4), MATS.leaf);
      l.scale.set(1.7, 0.3, 1.2);
      const a = i * 1.3;
      l.position.set(Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5), MATS.stem);
    vine.position.y = 0.2;
    vine.castShadow = true;
    g.add(vine);
  } else {
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 4), MATS.leaf);
      l.scale.set(1.8, 0.3, 1.3);
      const a = i * 0.95;
      l.position.set(Math.cos(a) * 0.45, 0.12, Math.sin(a) * 0.45);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
    const ripe = growth >= 0.85;
    const size = ripe ? 1 : 0.6;
    const mat = ripe ? MATS.pumpkin : MATS.pumpkinGreen;
    // Pumpkin body — 8 lobes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const lobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.22 * size, 10, 8),
        mat
      );
      lobe.position.set(Math.cos(a) * 0.18 * size, 0.3 * size + 0.02, Math.sin(a) * 0.18 * size);
      lobe.scale.set(1, 1.3, 1);
      lobe.castShadow = true;
      g.add(lobe);
    }
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.2, 5),
      MATS.pumpkinStem
    );
    stem.position.y = 0.3 * size + 0.24;
    stem.castShadow = true;
    g.add(stem);
  }
  return g;
}

// ── Dispatcher ────────────────────────────────────────────
export function createCropMesh(type, growth) {
  switch (type) {
    case 'corn':    return createCorn(growth);
    case 'pumpkin': return createPumpkin(growth);
    case 'tomato':
    default:        return createTomato(growth);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ANIMALS
// ═══════════════════════════════════════════════════════════════

export function createSheep() {
  const g = new THREE.Group();

  // Body — fluffy wool (cluster of icosahedrons)
  const woolGroup = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      MATS.sheepWool
    );
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.25;
    puff.position.set(
      Math.cos(a) * r,
      0.65 + (rand() - 0.5) * 0.15,
      (rand() - 0.5) * 0.9
    );
    puff.scale.set(1.2, 0.9, 0.9);
    puff.castShadow = true;
    woolGroup.add(puff);
  }
  g.add(woolGroup);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    MATS.sheepFace
  );
  head.position.set(0, 0.75, 0.5);
  head.castShadow = true;
  g.add(head);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.14),
      MATS.sheepFace
    );
    ear.position.set(side * 0.14, 0.78, 0.48);
    ear.rotation.z = side * 0.4;
    g.add(ear);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 })
    );
    eye.position.set(side * 0.07, 0.78, 0.63);
    g.add(eye);
  }

  // Legs
  for (const [dx, dz] of [[-0.15, -0.3], [0.15, -0.3], [-0.15, 0.3], [0.15, 0.3]]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6),
      MATS.sheepFace
    );
    leg.position.set(dx, 0.28, dz);
    leg.castShadow = true;
    g.add(leg);
  }

  return g;
}

export function createChicken() {
  const g = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    MATS.chickenBody
  );
  body.position.y = 0.35;
  body.scale.set(1, 1.1, 1.2);
  body.castShadow = true;
  g.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    MATS.chickenBody
  );
  head.position.set(0, 0.62, 0.14);
  head.castShadow = true;
  g.add(head);

  // Comb
  const comb = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.1, 0.05),
    MATS.chickenComb
  );
  comb.position.set(0, 0.72, 0.16);
  g.add(comb);

  // Beak
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.08, 5),
    MATS.beak
  );
  beak.position.set(0, 0.6, 0.26);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    eye.position.set(side * 0.06, 0.65, 0.22);
    g.add(eye);
  }

  // Tail
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.22, 5),
    MATS.chickenBody
  );
  tail.position.set(0, 0.42, -0.24);
  tail.rotation.x = -0.5;
  g.add(tail);

  // Legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5),
      MATS.beak
    );
    leg.position.set(side * 0.08, 0.14, 0);
    g.add(leg);
  }

  return g;
}

export function createCow() {
  const g = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.9, 6, 12),
    MATS.cowBody
  );
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.9;
  body.castShadow = true;
  g.add(body);

  // Spots
  for (let i = 0; i < 5; i++) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.15 + rand() * 0.1, 8, 6),
      MATS.cowSpot
    );
    spot.position.set(
      (rand() - 0.5) * 1.2,
      0.9 + (rand() - 0.5) * 0.35,
      (rand() - 0.5) * 0.5
    );
    spot.scale.set(1, 0.4, 1);
    g.add(spot);
  }

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.4),
    MATS.cowBody
  );
  head.position.set(0.65, 0.95, 0);
  head.castShadow = true;
  g.add(head);

  // Snout
  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.2),
    MATS.cowSpot
  );
  snout.position.set(0.85, 0.85, 0);
  g.add(snout);

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    eye.position.set(0.72, 1.02, side * 0.13);
    g.add(eye);
  }

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 0.14),
      MATS.cowBody
    );
    ear.position.set(0.6, 1.05, side * 0.2);
    ear.rotation.x = side * 0.4;
    g.add(ear);
  }

  // Horns
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.14, 5),
      MATS.silver
    );
    horn.position.set(0.6, 1.18, side * 0.1);
    g.add(horn);
  }

  // Legs
  for (const [dx, dz] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.65, 6),
      MATS.cowBody
    );
    leg.position.set(dx, 0.32, dz);
    leg.castShadow = true;
    g.add(leg);
    // hoof
    const hoof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.1, 6),
      MATS.leatherDark
    );
    hoof.position.set(dx, 0.05, dz);
    g.add(hoof);
  }

  // Tail
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5),
    MATS.cowBody
  );
  tail.position.set(-0.65, 0.85, 0);
  tail.rotation.z = 0.4;
  g.add(tail);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  PROPS — crates, barrels, signs, scarecrow
// ═══════════════════════════════════════════════════════════════

export function createCrate() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    MATS.wood
  );
  box.position.y = 0.35;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  // Corner frames
  for (const [x, z] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.72, 0.05),
      MATS.woodDark
    );
    post.position.set(x, 0.36, z);
    g.add(post);
  }

  return g;
}

export function createBarrel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 0.75, 14),
    MATS.wood
  );
  body.position.y = 0.38;
  body.castShadow = true;
  g.add(body);

  for (const y of [0.15, 0.6]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.025, 6, 20),
      MATS.ironRust
    );
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  return g;
}

export function createScarecrow() {
  const g = new THREE.Group();

  // Post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6),
    MATS.woodDark
  );
  post.position.y = 1.1;
  post.castShadow = true;
  g.add(post);

  // Crossbar
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.08, 0.08),
    MATS.woodDark
  );
  bar.position.y = 1.6;
  bar.castShadow = true;
  g.add(bar);

  // Head (hay sack)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    MATS.hay
  );
  head.position.y = 1.95;
  head.scale.set(1, 1.1, 0.95);
  head.castShadow = true;
  g.add(head);

  // Hat
  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.04, 12),
    MATS.hat
  );
  hatBrim.position.y = 2.12;
  g.add(hatBrim);
  const hatTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.2, 10),
    MATS.hat
  );
  hatTop.position.y = 2.24;
  g.add(hatTop);

  // Body (cloth)
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 0.85, 8),
    MATS.fabric
  );
  body.position.y = 1.15;
  body.castShadow = true;
  g.add(body);

  // Arms (straw tufts)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5),
      MATS.straw
    );
    arm.position.set(side * 0.55, 1.6, 0);
    arm.rotation.z = side * 0.3;
    g.add(arm);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  BUILDINGS — barn, house, silo
// ═══════════════════════════════════════════════════════════════

export function createBarn() {
  const g = new THREE.Group();

  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 5),
    MATS.wallPlaster
  );
  base.position.y = 1.5;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Roof (two slanted planes)
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.15, 5.4),
      MATS.roofTile
    );
    roof.position.set(side * 1.0, 3.7, 0);
    roof.rotation.z = side * 0.6;
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);
  }

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.2, 0.1),
    MATS.woodDark
  );
  door.position.set(0, 1.1, 2.51);
  g.add(door);

  // Window
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.05),
    MATS.window
  );
  win.position.set(0, 2.0, 2.52);
  g.add(win);

  return g;
}

export function createHouse() {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 2.8, 3.5),
    MATS.wallPlaster
  );
  base.position.y = 1.4;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Roof — 4 sides pyramid
  const roofGeo = new THREE.ConeGeometry(2.9, 1.8, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MATS.roofTile);
  roof.position.y = 3.7;
  roof.castShadow = true;
  g.add(roof);

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.9, 0.08),
    MATS.woodDark
  );
  door.position.set(0, 0.95, 1.76);
  g.add(door);

  // Windows
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.05),
      MATS.window
    );
    win.position.set(side * 1.0, 1.8, 1.76);
    g.add(win);
  }

  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.4, 0.5),
    MATS.rockDark
  );
  chimney.position.set(0.9, 4.0, -0.5);
  chimney.castShadow = true;
  g.add(chimney);

  return g;
}

export function createSilo() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 4.5, 16),
    MATS.wood
  );
  body.position.y = 2.25;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    MATS.iron
  );
  dome.position.y = 4.5;
  dome.castShadow = true;
  g.add(dome);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.21, 0.04, 6, 24),
      MATS.ironRust
    );
    ring.position.y = 0.8 + i * 1.1;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  TRACTOR (decorative, parked in the yard)
// ═══════════════════════════════════════════════════════════════

export function createTractor() {
  const g = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xc84a3a, roughness: 0.55, metalness: 0.3 })
  );
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);

  // Engine hood
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.6, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xc84a3a, roughness: 0.55, metalness: 0.3 })
  );
  hood.position.set(0, 1.05, 0.6);
  hood.castShadow = true;
  g.add(hood);

  // Grille
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.4, 0.06),
    MATS.iron
  );
  grille.position.set(0, 0.95, 1.15);
  g.add(grille);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.7 })
  );
  cabin.position.set(0, 1.75, -0.4);
  cabin.castShadow = true;
  g.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const hubMat = MATS.iron;
  for (const [x, z, scale] of [[-0.85, 0.7, 1], [0.85, 0.7, 1], [-0.85, -0.7, 1.4], [0.85, -0.7, 1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.scale.set(scale, scale, scale);
    wheel.position.set(x, 0.55 * scale, z);
    wheel.castShadow = true;
    g.add(wheel);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12),
      hubMat
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.55 * scale, z);
    g.add(hub);
  }

  // Exhaust
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8),
    MATS.ironRust
  );
  exhaust.position.set(0.5, 1.5, 0.9);
  g.add(exhaust);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  WATER SPRINKLER (functional decorative)
// ═══════════════════════════════════════════════════════════════

export function createSprinkler() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.15, 10),
    MATS.ironRust
  );
  base.position.y = 0.08;
  base.castShadow = true;
  g.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6),
    MATS.ironRust
  );
  pole.position.y = 0.55;
  g.add(pole);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    MATS.copper
  );
  head.position.y = 1.0;
  g.add(head);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  FENCE PIECE — reusable
// ═══════════════════════════════════════════════════════════════

export function createFencePost() {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.4, 0.18),
    MATS.wood
  );
}
export function createFenceRail(length = 2) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.12, 0.08),
    MATS.wood
  );
}

// ═══════════════════════════════════════════════════════════════
//  WELL (decorative + could be used for water)
// ═══════════════════════════════════════════════════════════════

export function createWell() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.15, 8, 22),
    MATS.rock
  );
  ring.position.y = 0.3;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // Roof posts
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.5, 0.1),
      MATS.woodDark
    );
    post.position.set(x, 1.05, z);
    g.add(post);
  }

  // Roof
  const roofGeo = new THREE.ConeGeometry(1.0, 0.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MATS.roofThatch);
  roof.position.y = 2.0;
  roof.castShadow = true;
  g.add(roof);

  // Bucket
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.12, 0.25, 10),
    MATS.wood
  );
  bucket.position.y = 1.2;
  bucket.castShadow = true;
  g.add(bucket);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  YARD LAMP — glows at night
// ═══════════════════════════════════════════════════════════════

export function createYardLamp() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8),
    MATS.ironRust
  );
  post.position.y = 1.1;
  post.castShadow = true;
  g.add(post);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.4, 0.3),
    MATS.iron
  );
  head.position.y = 2.2;
  g.add(head);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.32, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0xffe8a0, emissive: 0xffe8a0, emissiveIntensity: 0,
      transparent: true, opacity: 0.9,
    })
  );
  glass.position.y = 2.2;
  g.add(glass);

  g.userData.glass = glass;
  return g;
}

// ═══════════════════════════════════════════════════════════════
//  HAY BALE — for stacking
// ═══════════════════════════════════════════════════════════════

export function createHayBale() {
  const g = new THREE.Group();
  const bale = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1.2, 14),
    MATS.hay
  );
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 0.6;
  bale.castShadow = true;
  bale.receiveShadow = true;
  g.add(bale);

  // Twine rings
  for (const x of [-0.3, 0.3]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.61, 0.012, 4, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 0.6, 0);
    g.add(ring);
  }

  return g;
}