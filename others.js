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

// ═══════════════════════════════════════════════════════════════
//  VERDANT VALE — others.js  (PART 2 of 2)
//  World building: terrain, sky, trees, weather, day/night, FX
// ═══════════════════════════════════════════════════════════════

// ── Noise (perlin-ish, cheap) ──────────────────────────────
export function noise2D(x, z) {
  return Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.6
       + Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.21 + 3.2) * 0.3
       + Math.sin(x * 0.4 + 5.1) * Math.cos(z * 0.37 + 1.3) * 0.1;
}
export function noise3D(x, y, z) {
  return noise2D(x + y * 0.3, z + y * 0.7);
}

// ═══════════════════════════════════════════════════════════════
//  WEATHER SYSTEM
// ═══════════════════════════════════════════════════════════════
export const WEATHER_TYPES = {
  clear:   { icon: '☀️', text: 'Clear',       rain: 0,    cloud: 0.2, sun: 1.0 },
  cloudy:  { icon: '⛅', text: 'Cloudy',      rain: 0,    cloud: 0.6, sun: 0.7 },
  rain:    { icon: '🌧️', text: 'Rain',        rain: 0.8,  cloud: 0.9, sun: 0.4 },
  storm:   { icon: '⛈️', text: 'Storm',       rain: 1.0,  cloud: 1.0, sun: 0.25 },
  fog:     { icon: '🌫️', text: 'Foggy',       rain: 0.1,  cloud: 0.5, sun: 0.5 },
  snow:    { icon: '❄️', text: 'Snow',        rain: 0.3,  cloud: 0.7, sun: 0.55 },
};

export function createWeather() {
  const state = {
    current: 'clear',
    next: 'clear',
    transition: 0,      // 0 = current fully, 1 = fully next
    transitionSpeed: 0.08,
    timeUntilChange: 90 + Math.random() * 90,
    windDir: Math.random() * Math.PI * 2,
  };

  const api = {
    state,
    get() {
      const a = WEATHER_TYPES[state.current];
      const b = WEATHER_TYPES[state.next];
      const t = state.transition;
      return {
        icon: b.icon,
        text: t > 0.5 ? b.text : a.text,
        rain: a.rain * (1 - t) + b.rain * t,
        cloud: a.cloud * (1 - t) + b.cloud * t,
        sun: a.sun * (1 - t) + b.sun * t,
      };
    },
    update(dt) {
      // smooth transition
      if (state.transition < 1) {
        state.transition = Math.min(1, state.transition + dt * state.transitionSpeed);
      }
      // countdown to next weather
      state.timeUntilChange -= dt;
      if (state.timeUntilChange <= 0) {
        state.current = state.next;
        state.next = pickNextWeather(state.current);
        state.transition = 0;
        state.timeUntilChange = 90 + Math.random() * 120;
        state.windDir += (Math.random() - 0.5) * Math.PI;
      }
    },
    set(w) {
      if (WEATHER_TYPES[w] && w !== state.next) {
        state.next = w;
        state.transition = 0;
      }
    },
  };

  function pickNextWeather(from) {
    const roll = Math.random();
    if (from === 'clear') {
      if (roll < 0.55) return 'cloudy';
      if (roll < 0.85) return 'rain';
      return 'fog';
    }
    if (from === 'cloudy') {
      if (roll < 0.4) return 'clear';
      if (roll < 0.75) return 'rain';
      return 'storm';
    }
    if (from === 'rain') {
      if (roll < 0.5) return 'cloudy';
      if (roll < 0.75) return 'storm';
      return 'clear';
    }
    if (from === 'storm') {
      if (roll < 0.6) return 'rain';
      return 'cloudy';
    }
    if (from === 'fog') {
      if (roll < 0.5) return 'clear';
      return 'cloudy';
    }
    return 'clear';
  }

  return api;
}

// ═══════════════════════════════════════════════════════════════
//  SKY DOME (shader — time of day + weather tinting)
// ═══════════════════════════════════════════════════════════════
function createSky(scene) {
  const geo = new THREE.SphereGeometry(240, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x5a9bd8) },
      bottomColor: { value: new THREE.Color(0xd8e8f0) },
      sunPos:      { value: new THREE.Vector3(0, 1, 0) },
      sunColor:    { value: new THREE.Color(0xffeecc) },
      moonPos:     { value: new THREE.Vector3(0, -1, 0) },
      moonColor:   { value: new THREE.Color(0xdde8ff) },
      cloudTint:   { value: new THREE.Color(0xffffff) },
      cloudAmount: { value: 0.2 },
      time:        { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunPos;
      uniform vec3 sunColor;
      uniform vec3 moonPos;
      uniform vec3 moonColor;
      uniform vec3 cloudTint;
      uniform float cloudAmount;
      uniform float time;
      varying vec3 vWorld;
      varying vec3 vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vNormal);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.85));

        // Sun glow
        float sd = distance(dir, normalize(sunPos));
        col += sunColor * smoothstep(0.35, 0.0, sd) * 0.9;

        // Moon glow
        float md = distance(dir, normalize(moonPos));
        col += moonColor * smoothstep(0.15, 0.0, md) * 0.35;

        // Clouds (procedural, drifting)
        if (dir.y > 0.0) {
          vec2 uv = dir.xz / (dir.y + 0.15);
          vec2 drift = vec2(time * 0.008, time * 0.004);
          float c = fbm(uv * 1.4 + drift);
          c = smoothstep(0.35, 0.75, c) * cloudAmount;
          col = mix(col, cloudTint, c);
        }

        // Stars (only upper hemisphere, at night — driven by uniform darkening)
        if (dir.y > 0.1) {
          vec3 starHash = fract(sin(floor(dir * 380.0) * vec3(12.9898, 78.233, 43.1)) * 43758.5453);
          float star = step(0.9975, starHash.x);
          col += vec3(star) * (1.0 - sunColor.r * 0.5) * 0.6;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { mesh, mat };
}

// ═══════════════════════════════════════════════════════════════
//  SUN + MOON
// ═══════════════════════════════════════════════════════════════
function createCelestialBodies(scene) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  scene.add(sun);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffe8a0, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  scene.add(sunGlow);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xdde8ff })
  );
  scene.add(moon);

  return { sun, sunGlow, moon };
}

// ═══════════════════════════════════════════════════════════════
//  CLOUDS
// ═══════════════════════════════════════════════════════════════
function createClouds(scene) {
  const group = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, flatShading: true,
    transparent: true, opacity: 0.85,
  });

  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    const puffs = 4 + (Math.random() * 4 | 0);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(puffGeo, mat);
      p.position.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * 5
      );
      p.scale.setScalar(1.2 + Math.random() * 1.5);
      g.add(p);
    }
    g.position.set(
      (Math.random() - 0.5) * 180,
      45 + Math.random() * 16,
      (Math.random() - 0.5) * 180
    );
    g.scale.setScalar(2.2 + Math.random() * 2);
    g.userData = { speed: 0.25 + Math.random() * 0.5, baseY: g.position.y, sway: Math.random() * Math.PI * 2 };
    group.add(g);
    clouds.push(g);
  }
  scene.add(group);
  return { group, clouds, mat };
}

// ═══════════════════════════════════════════════════════════════
//  TERRAIN
// ═══════════════════════════════════════════════════════════════
export function createTerrain(scene, WORLD_SIZE, HALF_GRID, terrainHeight) {
  const segs = 140;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));

    const n = noise2D(x * 2.1, z * 2.1);
    const t = (n + 1) * 0.5;
    // grass → dry grass → dirt gradient
    const r = 0.20 + t * 0.22;
    const g = 0.36 + t * 0.46;
    const b = 0.12 + t * 0.14;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Add a second higher-res patch over the farm area for shadows
  return mesh;
}

// ═══════════════════════════════════════════════════════════════
//  TREES
// ═══════════════════════════════════════════════════════════════
export function createTrees(scene, HALF_GRID, HALF_WORLD, terrainHeight) {
  const group = new THREE.Group();
  scene.add(group);

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.48, 1, 8);
  const trunkMats = [
    new THREE.MeshStandardMaterial({ map: makeBarkTexture(), roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 }),
  ];

  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x6ab04a, roughness: 0.9, flatShading: true }),
  ];

  const trees = [];
  const TREE_COUNT = 110;

  for (let i = 0; i < TREE_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 6 + Math.random() * 34;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (Math.abs(x) > HALF_WORLD - 8 || Math.abs(z) > HALF_WORLD - 8) continue;

    const scale = 0.7 + Math.random() * 1.0;
    const h = (3.4 + Math.random() * 2.4) * scale;

    const g = new THREE.Group();

    const trunkMat = trunkMats[Math.floor(Math.random() * trunkMats.length)];
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(scale, h, scale);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    const leafMat = leafMats[Math.floor(Math.random() * leafMats.length)];
    const layers = 3 + (Math.random() * 3 | 0);
    for (let j = 0; j < layers; j++) {
      const r = (1.6 - j * 0.28) * scale;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.4, 7), leafMat);
      leaf.position.y = h * 0.72 + j * 0.9 * scale;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      leaf.rotation.y = Math.random() * Math.PI * 2;
      g.add(leaf);
    }

    g.position.set(x, terrainHeight(x, z), z);
    g.userData = {
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.4 + Math.random() * 0.6,
      swayAmp: 0.018 + Math.random() * 0.012,
      baseX: x, baseZ: z,
    };
    group.add(g);
    trees.push(g);
  }

  return { group, trees };
}

// ═══════════════════════════════════════════════════════════════
//  GRASS  (instanced, swaying)
// ═══════════════════════════════════════════════════════════════
export function createGrass(scene, WORLD_SIZE, HALF_GRID, terrainHeight) {
  const COUNT = 4000;
  const geo = new THREE.ConeGeometry(0.1, 0.9, 3);
  geo.translate(0, 0.45, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x5fa54a, roughness: 1, flatShading: true,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.receiveShadow = true;

  const data = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < COUNT; i++) {
    let x, z;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.94;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.94;
      attempts++;
    } while ((Math.abs(x) < HALF_GRID + 2 && Math.abs(z) < HALF_GRID + 2) && attempts < 20);

    const y = terrainHeight(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.6 + Math.random() * 1.1;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    data.push({
      x, y, z,
      baseRot: dummy.rotation.y,
      phase: Math.random() * Math.PI * 2,
      s,
    });
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return { mesh, data, dummy };
}

// ═══════════════════════════════════════════════════════════════
//  FLOWERS
// ═══════════════════════════════════════════════════════════════
export function createFlowers(scene, WORLD_SIZE, HALF_GRID, terrainHeight) {
  const COUNT = 220;
  const geo = new THREE.IcosahedronGeometry(0.15, 0);

  // per-instance color
  const colors = new Float32Array(COUNT * 3);
  const palette = [0xff88aa, 0xffdd66, 0xff9966, 0xdd88ff, 0xffffff, 0xff6688, 0xffaa44, 0x88aaff];
  for (let i = 0; i < COUNT; i++) {
    const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.7, emissive: 0x220000, emissiveIntensity: 0.15,
    vertexColors: true, flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.castShadow = false;

  const data = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < COUNT; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.88;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.88;
    } while (Math.abs(x) < HALF_GRID + 3 && Math.abs(z) < HALF_GRID + 3);

    const y = terrainHeight(x, z) + 0.42;
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3);
    dummy.scale.setScalar(0.6 + Math.random() * 0.7);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    data.push({ x, z, baseY: y, phase: Math.random() * Math.PI * 2 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return { mesh, data, dummy };
}

// ═══════════════════════════════════════════════════════════════
//  BUSHES + ROCKS (instanced)
// ═══════════════════════════════════════════════════════════════
export function createBushesAndRocks(scene, HALF_GRID, terrainHeight) {
  const bushGroup = new THREE.Group();
  const rockGroup = new THREE.Group();
  scene.add(bushGroup, rockGroup);

  const bushGeo = new THREE.IcosahedronGeometry(0.85, 1);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0x4a8b3a, roughness: 0.9, flatShading: true,
  });

  const dummy = new THREE.Object3D();

  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 2 + Math.random() * 18;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(x, terrainHeight(x, z) + 0.35, z);
    bush.rotation.y = Math.random() * Math.PI * 2;
    bush.scale.setScalar(0.6 + Math.random() * 0.7);
    bush.castShadow = true;
    bush.receiveShadow = true;
    bushGroup.add(bush);
  }

  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a80, roughness: 0.92, flatShading: true,
  });
  for (let i = 0; i < 32; i++) {
    const x = (Math.random() - 0.5) * 70;
    const z = (Math.random() - 0.5) * 70;
    if (Math.abs(x) < HALF_GRID + 3 && Math.abs(z) < HALF_GRID + 3) continue;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, terrainHeight(x, z) + 0.18, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.scale.setScalar(0.5 + Math.random() * 0.8);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rockGroup.add(rock);
  }

  return { bushGroup, rockGroup };
}

// ═══════════════════════════════════════════════════════════════
//  POND + LILIES
// ═══════════════════════════════════════════════════════════════
export function createPond(scene, x, z, terrainHeight) {
  const group = new THREE.Group();
  scene.add(group);

  const y = terrainHeight(x, z);

  const waterGeo = new THREE.CircleGeometry(5.5, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3a7a9a, roughness: 0.06, metalness: 0.75,
    transparent: true, opacity: 0.88,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(x, y + 0.1, z);
  group.add(water);

  // Bank ring
  const bankGeo = new THREE.RingGeometry(5.3, 6.2, 40);
  bankGeo.rotateX(-Math.PI / 2);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.95 });
  const bank = new THREE.Mesh(bankGeo, bankMat);
  bank.position.set(x, y + 0.08, z);
  group.add(bank);

  // Lily pads
  const lilyGeo = new THREE.CircleGeometry(0.5, 8);
  lilyGeo.rotateX(-Math.PI / 2);
  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8, side: THREE.DoubleSide });
  const lilies = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 3;
    const lily = new THREE.Mesh(lilyGeo, lilyMat);
    lily.position.set(x + Math.cos(a) * r, y + 0.12, z + Math.sin(a) * r);
    lily.rotation.y = Math.random() * Math.PI * 2;
    lily.scale.setScalar(0.5 + Math.random() * 0.6);
    group.add(lily);
    lilies.push({ mesh: lily, phase: Math.random() * Math.PI * 2 });
  }

  // Reeds around the edge
  const reedGeo = new THREE.ConeGeometry(0.06, 1.2, 4);
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5.4 + Math.random() * 0.6;
    const reed = new THREE.Mesh(reedGeo, reedMat);
    reed.position.set(x + Math.cos(a) * r, y + 0.6, z + Math.sin(a) * r);
    reed.rotation.y = Math.random() * Math.PI;
    reed.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(reed);
  }

  return { group, water, waterMat, lilies, x, z, y };
}

// ═══════════════════════════════════════════════════════════════
//  PARTICLES — dust pool, rain, fireflies, pollen
// ═══════════════════════════════════════════════════════════════
function createParticlePool(scene, MAX = 250) {
  const pool = [];
  const geo = new THREE.SphereGeometry(0.07, 5, 4);
  for (let i = 0; i < MAX; i++) {
    const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
    }));
    p.visible = false;
    p.userData = { active: false, vel: new THREE.Vector3(), life: 0, maxLife: 1, gravity: -4 };
    scene.add(p);
    pool.push(p);
  }
  let cursor = 0;
  return {
    spawn(pos, opts = {}) {
      const n = opts.count || 8;
      for (let k = 0; k < n; k++) {
        const p = pool[cursor];
        cursor = (cursor + 1) % MAX;
        p.position.copy(pos);
        p.material.color.setHex(opts.color || 0xffe27a);
        p.material.opacity = 1;
        p.visible = true;
        const d = p.userData;
        d.active = true;
        d.life = opts.life || 1.2;
        d.maxLife = d.life;
        d.gravity = opts.gravity ?? -4;
        const sp = opts.spread || 2;
        d.vel.set(
          (Math.random() - 0.5) * sp,
          Math.random() * (opts.up || 2) + 0.3,
          (Math.random() - 0.5) * sp
        );
      }
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = pool[i], d = p.userData;
        if (!d.active) continue;
        d.life -= dt;
        if (d.life <= 0) { d.active = false; p.visible = false; continue; }
        d.vel.y += d.gravity * dt;
        p.position.addScaledVector(d.vel, dt);
        p.material.opacity = d.life / d.maxLife;
      }
    },
  };
}

// ── Rain system ─────────────────────────────────────────────
function createRain(scene) {
  const COUNT = 1400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    vel[i] = 18 + Math.random() * 12;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x99ccee, size: 0.15, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  return {
    points, geo, mat, vel,
    update(dt, intensity, center) {
      mat.opacity = intensity * 0.7;
      if (intensity <= 0.01) { points.visible = false; return; }
      points.visible = true;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= vel[i] * dt;
        arr[i * 3] += 2 * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = center.x + (Math.random() - 0.5) * 50;
          arr[i * 3 + 1] = 30 + Math.random() * 10;
          arr[i * 3 + 2] = center.z + (Math.random() - 0.5) * 50;
        }
      }
      geo.attributes.position.needsUpdate = true;
      points.position.set(center.x, 0, center.z);
      points.position.x = 0; points.position.z = 0;
    },
  };
}

// ── Snow system ─────────────────────────────────────────────
function createSnow(scene) {
  const COUNT = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    phase[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.22, transparent: true, opacity: 0, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  return {
    points, geo, mat, phase,
    update(dt, intensity, t, center) {
      mat.opacity = intensity * 0.9;
      if (intensity <= 0.01) { points.visible = false; return; }
      points.visible = true;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= 1.5 * dt;
        arr[i * 3] += Math.sin(t * 0.5 + phase[i]) * 0.3 * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = (Math.random() - 0.5) * 50;
          arr[i * 3 + 1] = 30 + Math.random() * 10;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
      }
      geo.attributes.position.needsUpdate = true;
      points.position.set(center.x, 0, center.z);
      points.position.x = 0; points.position.z = 0;
    },
  };
}

// ── Fireflies ───────────────────────────────────────────────
function createFireflies(scene) {
  const COUNT = 100;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 55;
    pos[i * 3 + 1] = 0.5 + Math.random() * 3.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 55;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.4 + Math.random() * 0.8;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffff88, size: 0.36, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  return {
    points, geo, mat, phase, speed,
    update(dt, nightAmount, t) {
      mat.opacity = Math.max(0, nightAmount) * 0.9;
      if (nightAmount < 0.05) return;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3] += Math.sin(t * speed[i] + phase[i]) * 0.02;
        arr[i * 3 + 1] += Math.cos(t * speed[i] * 1.3 + phase[i]) * 0.015;
        arr[i * 3 + 2] += Math.cos(t * speed[i] * 0.8 + phase[i]) * 0.02;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ── Pollen (day) ────────────────────────────────────────────
function createPollen(scene) {
  const COUNT = 300;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = 1 + Math.random() * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    phase[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffcc, size: 0.13, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  return {
    points, geo, mat, phase,
    update(dt, dayAmount, t, windDir) {
      mat.opacity = Math.max(0, dayAmount) * 0.55;
      if (dayAmount < 0.05) return;
      const arr = geo.attributes.position.array;
      const wx = Math.cos(windDir) * 0.4;
      const wz = Math.sin(windDir) * 0.4;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3] += wx * dt + Math.sin(t * 0.7 + phase[i]) * 0.004;
        arr[i * 3 + 1] += Math.cos(t * 0.9 + phase[i]) * 0.003;
        arr[i * 3 + 2] += wz * dt + Math.cos(t * 0.6 + phase[i]) * 0.004;
        if (arr[i * 3 + 1] > 15) arr[i * 3 + 1] = 1;
        if (arr[i * 3 + 1] < 0.5) arr[i * 3 + 1] = 1;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  MASTER WORLD FACTORY
// ═══════════════════════════════════════════════════════════════
export async function createWorld(scene, renderer, camera, opts = {}) {
  const report = opts.progress || (() => {});
  const { WORLD_SIZE, HALF_GRID, HALF_WORLD, terrainHeight } = opts;

  // ── Lights ──────────────────────────────────────────────
  report(24, 'placing sun');
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.7);
  sunLight.position.set(30, 50, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 180;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.autoUpdate = false;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xa0c8e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);

  const ambient = new THREE.AmbientLight(0xfff0d0, 0.22);
  scene.add(ambient);

  // ── Sky ─────────────────────────────────────────────────
  report(30, 'painting sky');
  const sky = createSky(scene);

  // ── Celestial bodies ────────────────────────────────────
  const celestial = createCelestialBodies(scene);

  // ── Clouds ──────────────────────────────────────────────
  const clouds = createClouds(scene);

  // ── Terrain ─────────────────────────────────────────────
  report(40, 'raising hills');
  const terrain = createTerrain(scene, WORLD_SIZE, HALF_GRID, terrainHeight);

  // ── Trees ───────────────────────────────────────────────
  report(50, 'planting forest');
  const trees = createTrees(scene, HALF_GRID, HALF_WORLD, terrainHeight);

  // ── Grass ───────────────────────────────────────────────
  report(58, 'growing grass');
  const grass = createGrass(scene, WORLD_SIZE, HALF_GRID, terrainHeight);

  // ── Flowers ─────────────────────────────────────────────
  report(64, 'scattering flowers');
  const flowers = createFlowers(scene, WORLD_SIZE, HALF_GRID, terrainHeight);

  // ── Bushes + rocks ──────────────────────────────────────
  report(70, 'placing stones');
  const bushesRocks = createBushesAndRocks(scene, HALF_GRID, terrainHeight);

  // ── Pond ────────────────────────────────────────────────
  report(74, 'filling pond');
  const pond = createPond(scene, HALF_GRID + 11, -HALF_GRID - 9, terrainHeight);

  // ── Particles / FX ──────────────────────────────────────
  report(80, 'adding atmosphere');
  const particlePool = createParticlePool(scene, 250);
  const rain = createRain(scene);
  const snow = createSnow(scene);
  const fireflies = createFireflies(scene);
  const pollen = createPollen(scene);

  // Expose dust spawner globally
  window.__spawnDust = (x, z, color, count = 12, up = 1.8) => {
    const y = terrainHeight(x, z) + 0.5;
    particlePool.spawn(new THREE.Vector3(x, y, z), {
      color, count, spread: 1.6, up: up * 1.5, life: 1.0, gravity: -6,
    });
  };

  // ── Weather ─────────────────────────────────────────────
  const weather = createWeather();

  // ── Time of day state ───────────────────────────────────
  const timeState = {
    t: 0.28,              // 0 = midnight, 0.5 = noon, 1 = midnight
    dayLength: 300,       // seconds for full day
    dayCount: 1,
  };

  // ── Update: time of day + weather applied ───────────────
  let elapsedLocal = 0;
  let lastSunAngle = 0;

  function updateTime(dt, extTime) {
    elapsedLocal += dt;

    // Update weather
    weather.update(dt);
    const w = weather.get();

    // Time of day progresses (unless overridden)
    if (typeof extTime === 'number') {
      timeState.t = extTime;
    } else {
      timeState.t = (timeState.t + dt / timeState.dayLength) % 1;
    }
    if (extTime === undefined) {
      // day rolls over
      if (timeState.t < 0.01 && dt > 0) {
        // (handled elsewhere)
      }
    }

    const t = timeState.t;
    const angle = (t - 0.25) * Math.PI * 2;

    // Sun position
    const sunX = Math.cos(angle) * 100;
    const sunY = Math.sin(angle) * 70;
    const sunZ = -Math.cos(angle) * 30;
    celestial.sun.position.set(sunX, sunY, sunZ);
    celestial.sunGlow.position.copy(celestial.sun.position);
    celestial.sunGlow.scale.setScalar(1 + Math.sin(elapsedLocal * 2) * 0.05);

    // Moon — opposite side
    celestial.moon.position.set(-sunX, -sunY + 10, -sunZ);

    // Light position
    sunLight.position.set(sunX * 0.5, Math.max(6, sunY), sunZ * 0.5);
    sunLight.target.position.set(0, 0, 0);
    sunLight.target.updateMatrixWorld();

    // Sky uniforms
    sky.mat.uniforms.sunPos.value.copy(celestial.sun.position).normalize();
    sky.mat.uniforms.moonPos.value.copy(celestial.moon.position).normalize();
    sky.mat.uniforms.time.value = elapsedLocal;
    sky.mat.uniforms.cloudAmount.value = w.cloud;

    // Shadow update
    if (Math.abs(angle - lastSunAngle) > 0.035) {
      sunLight.shadow.needsUpdate = true;
      lastSunAngle = angle;
    }

    // Colors by time
    const night = new THREE.Color(0x0a1530);
    const dawn = new THREE.Color(0xffb070);
    const dusk = new THREE.Color(0xff8850);
    const noon = new THREE.Color(0x5a9bd8);
    const skyLo = new THREE.Color(0xd8e8f0);

    let skyTop, skyBot, sunCol, sunInt, hemiInt, fogCol;

    if (t < 0.2) {
      skyTop = night.clone();
      skyBot = new THREE.Color(0x1a2a50);
      sunCol = new THREE.Color(0x4a6a9a);
      sunInt = 0.18;
      hemiInt = 0.32;
      fogCol = night.clone();
    } else if (t < 0.28) {
      const k = (t - 0.2) / 0.08;
      skyTop = night.clone().lerp(dawn, k);
      skyBot = new THREE.Color(0x1a2a50).lerp(dawn, k);
      sunCol = new THREE.Color(0x4a6a9a).lerp(dawn, k);
      sunInt = 0.18 + k * 1.3;
      hemiInt = 0.32 + k * 0.75;
      fogCol = night.clone().lerp(dawn, k);
    } else if (t < 0.72) {
      const k = Math.abs(t - 0.5) / 0.22;
      skyTop = noon.clone().lerp(new THREE.Color(0x4a8bc8), k * 0.3);
      skyBot = skyLo.clone();
      sunCol = new THREE.Color(0xfff2d0);
      sunInt = 1.6 - k * 0.2;
      hemiInt = 1.08;
      fogCol = new THREE.Color(0xa8d8e8);
    } else if (t < 0.82) {
      const k = (t - 0.72) / 0.10;
      skyTop = new THREE.Color(0x5a9bd8).lerp(dusk, k);
      skyBot = new THREE.Color(0xd8e8f0).lerp(dusk, k);
      sunCol = new THREE.Color(0xfff2d0).lerp(dusk, k);
      sunInt = 1.4 - k * 0.9;
      hemiInt = 1.08 - k * 0.55;
      fogCol = new THREE.Color(0xa8d8e8).lerp(dusk, k);
    } else {
      const k = (t - 0.82) / 0.18;
      skyTop = dusk.clone().lerp(night, k);
      skyBot = dusk.clone().lerp(new THREE.Color(0x1a2a50), k);
      sunCol = dusk.clone().lerp(new THREE.Color(0x4a6a9a), k);
      sunInt = 0.45 - k * 0.3;
      hemiInt = 0.52 - k * 0.22;
      fogCol = dusk.clone().lerp(night, k);
    }

    // Apply weather tint
    const rainDarken = 1 - w.rain * 0.35;
    skyTop.multiplyScalar(rainDarken);
    skyBot.multiplyScalar(rainDarken);
    fogCol.multiplyScalar(rainDarken);
    sunInt *= (0.4 + w.sun * 0.6);
    hemiInt *= (0.5 + w.sun * 0.5);

    sky.mat.uniforms.topColor.value.copy(skyTop);
    sky.mat.uniforms.bottomColor.value.copy(skyBot);
    sky.mat.uniforms.sunColor.value.copy(sunCol);
    sky.mat.uniforms.cloudTint.value.setRGB(0.9 - w.rain * 0.5, 0.9 - w.rain * 0.5, 0.95 - w.rain * 0.4);

    sunLight.color.copy(sunCol);
    sunLight.intensity = sunInt;
    hemiLight.intensity = hemiInt;
    ambient.intensity = 0.18 + w.sun * 0.1;

    scene.fog.color.copy(fogCol);
    scene.background.copy(fogCol);

    // Sun/moon visibility
    celestial.sun.material.color.copy(
      t < 0.25 || t > 0.75 ? new THREE.Color(0xdde8ff) : new THREE.Color(0xffe8a0)
    );
    celestial.sunGlow.material.opacity = 0.18 * Math.max(0, Math.sin(angle));
    celestial.moon.visible = t < 0.25 || t > 0.75;

    // Cloud tint
    clouds.mat.color.copy(new THREE.Color(0xffffff).lerp(new THREE.Color(0x8888aa), w.cloud * 0.5));

    // Weather intensity
    const rainIntensity = w.rain;
    const snowIntensity = w.text === 'Snow' ? 0.8 : 0;
    const dayness = Math.max(0, 1 - Math.abs(t - 0.5) * 3);
    const nightAmount = 1 - dayness;

    // Rain & snow follow camera
    rain.update(dt, rainIntensity, camera.position);
    snow.update(dt, snowIntensity, elapsedLocal, camera.position);
    fireflies.update(dt, nightAmount, elapsedLocal);
    pollen.update(dt, dayness, elapsedLocal, weather.state.windDir);

    return {
      t,
      w,
      sunInt,
      hemiInt,
      dayness,
      nightAmount,
    };
  }

  // ── Update: ambient world animation ─────────────────────
  function update(dt) {
    // Tree sway
    for (const tr of trees.trees) {
      const d = tr.userData;
      const dx = d.baseX - camera.position.x;
      const dz = d.baseZ - camera.position.z;
      if (dx * dx + dz * dz < 2800) {
        const sway = Math.sin(elapsedLocal * d.swaySpeed + d.sway) * d.swayAmp;
        tr.rotation.z = sway;
        tr.rotation.x = sway * 0.55;
      }
    }

    // Grass sway (every other frame to save CPU)
    if ((elapsedLocal * 60 | 0) % 2 === 0) {
      const dummy = grass.dummy;
      const mesh = grass.mesh;
      for (let i = 0; i < grass.data.length; i++) {
        const d = grass.data[i];
        const sway = Math.sin(elapsedLocal * 1.8 + d.phase + d.x * 0.3) * 0.16;
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(sway, d.baseRot, sway * 0.7);
        dummy.scale.set(d.s, d.s, d.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Flower sway
    const fd = flowers.dummy;
    const fm = flowers.mesh;
    for (let i = 0; i < flowers.data.length; i++) {
      const d = flowers.data[i];
      const bob = Math.sin(elapsedLocal * 2 + d.phase) * 0.04;
      fd.position.set(d.x, d.baseY + bob, d.z);
      fd.rotation.set(
        Math.sin(elapsedLocal * 1.4 + d.phase) * 0.2,
        d.phase,
        Math.cos(elapsedLocal * 1.2 + d.phase) * 0.15
      );
      fd.scale.setScalar(0.7 + Math.sin(d.phase) * 0.1);
      fd.updateMatrix();
      fm.setMatrixAt(i, fd.matrix);
    }
    fm.instanceMatrix.needsUpdate = true;

    // Clouds drift
    for (const c of clouds.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 100) c.position.x = -100;
      c.position.y = c.userData.baseY + Math.sin(elapsedLocal * 0.3 + c.userData.sway) * 0.4;
    }

    // Pond shimmer
    pond.waterMat.color.setHSL(0.55, 0.4, 0.42 + Math.sin(elapsedLocal) * 0.03);
    for (const lily of pond.lilies) {
      lily.mesh.rotation.y = Math.sin(elapsedLocal * 0.6 + lily.phase) * 0.1;
    }

    // Particles
    particlePool.update(dt);
  }

  // Return everything the game needs
  return {
    scene, sunLight, hemiLight, ambient,
    sky, celestial, clouds, terrain,
    trees, grass, flowers, bushesRocks, pond,
    particlePool, rain, snow, fireflies, pollen,
    weather,
    timeState,
    updateTime,
    update,
    // Expose context for game.js
    ctx: {
      WORLD_SIZE, HALF_GRID, HALF_WORLD, terrainHeight,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  CLOCK FORMAT HELPER
// ═══════════════════════════════════════════════════════════════
export function formatClock(t) {
  // t in [0, 1], 0 = midnight
  const totalMin = t * 24 * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}