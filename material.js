// ═══════════════════════════════════════════════════════════════
//  materials.js — v1
//  One place for every shared material in the game.
//  Change shirt color here → changes everywhere.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL TEXTURES (canvas — no external assets)
// ═══════════════════════════════════════════════════════════════

let _seed = 1337;
function rand() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function makeWoodTexture(tint = 0x8b6f47) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = (tint >> 16) & 255, g = (tint >> 8) & 255, b = tint & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const v = (rand() - 0.5) * 40;
    ctx.fillStyle = `rgba(${r + v},${g + v * 0.8},${b + v * 0.6},0.7)`;
    ctx.fillRect(rand() * size, rand() * size, 8 + rand() * 40, 1);
  }
  ctx.strokeStyle = 'rgba(30,20,10,0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 42) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBarkTexture() {
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
  ctx.strokeStyle = 'rgba(20,14,8,0.55)';
  ctx.lineWidth = 1;
  for (let x = 0; x < size; x += 4) {
    ctx.beginPath(); ctx.moveTo(x, 0);
    for (let y = 0; y < size; y += 8) ctx.lineTo(x + Math.sin(y * 0.3) * 2, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSoilTexture(moisture = 0) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const base = moisture > 0.5 ? [52, 34, 18] : moisture > 0.1 ? [88, 60, 34] : [102, 74, 42];
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 18000; i++) {
    const v = (rand() - 0.5) * 55;
    ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v * 0.8},${base[2] + v * 0.5},0.85)`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  if (moisture >= 0.1) {
    ctx.strokeStyle = moisture > 0.5 ? 'rgba(18,10,5,0.8)' : 'rgba(28,18,10,0.7)';
    ctx.lineWidth = 6;
    for (let y = 22; y < size; y += 56) {
      ctx.beginPath();
      for (let x = 0; x < size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.06) * 3.5);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeLeafTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  // Simple leaf shape with alpha
  ctx.fillStyle = '#4a8a3a';
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, size * 0.35, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a4a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, size / 2); ctx.lineTo(size - 4, size / 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ═══════════════════════════════════════════════════════════════
//  SHARED MATERIALS — every file imports from here
// ═══════════════════════════════════════════════════════════════

export const MATS = {
  // ── Human ──────────────────────────────────────────────────
  skin: new THREE.MeshStandardMaterial({ color: 0xe8bfa0, roughness: 0.72 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x4a8bc8, roughness: 0.92 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.94 }),
  hat: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.82 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.82 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),

  // ── Metals ─────────────────────────────────────────────────
  iron: new THREE.MeshStandardMaterial({ color: 0x9a9aac, roughness: 0.42, metalness: 0.85 }),
  ironRust: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7, metalness: 0.4 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc88a50, roughness: 0.35, metalness: 0.8 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc850, roughness: 0.25, metalness: 0.95 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.22, metalness: 0.95 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa8a8b0, roughness: 0.4, metalness: 0.85 }),

  // ── Wood / leather ─────────────────────────────────────────
  wood: new THREE.MeshStandardMaterial({ map: makeWoodTexture(0x8b6f47), roughness: 0.92 }),
  woodDark: new THREE.MeshStandardMaterial({ map: makeWoodTexture(0x6a4a2a), roughness: 0.94 }),
  woodLight: new THREE.MeshStandardMaterial({ map: makeWoodTexture(0xa88860), roughness: 0.88 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.82, metalness: 0.05 }),
  leatherDark: new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.88 }),

  // ── Water ──────────────────────────────────────────────────
  water: new THREE.MeshPhysicalMaterial({
    color: 0x3a7a9a, roughness: 0.08, metalness: 0.2,
    transmission: 0.6, thickness: 0.5, ior: 1.33,
    transparent: true, opacity: 0.88,
  }),
  waterCan: new THREE.MeshStandardMaterial({ color: 0x5a8a9a, roughness: 0.42, metalness: 0.6 }),

  // ── Plants ─────────────────────────────────────────────────
  stem: new THREE.MeshStandardMaterial({ color: 0x5a9b3a, roughness: 0.82 }),
  leaf: new THREE.MeshStandardMaterial({ map: makeLeafTexture(), color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, transparent: true }),
  sprout: new THREE.MeshStandardMaterial({ color: 0x6aab4a, roughness: 0.78 }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.82 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6abb4a, roughness: 0.82 }),
  leafMid: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8, side: THREE.DoubleSide }),
  bush: new THREE.MeshStandardMaterial({ color: 0x4a7a38, roughness: 0.92 }),

  // ── Fruit ──────────────────────────────────────────────────
  tomato: new THREE.MeshStandardMaterial({ color: 0xe83a2a, roughness: 0.35, emissive: 0x220000, emissiveIntensity: 0.15 }),
  tomatoGreen: new THREE.MeshStandardMaterial({ color: 0x7abc4a, roughness: 0.55 }),
  carrot: new THREE.MeshStandardMaterial({ color: 0xe87820, roughness: 0.55 }),
  potato: new THREE.MeshStandardMaterial({ color: 0xa87850, roughness: 0.75 }),
  corn: new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5 }),
  cornGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.55 }),
  pumpkin: new THREE.MeshStandardMaterial({ color: 0xe87820, roughness: 0.55 }),
  pumpkinGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.6 }),
  strawberryRed: new THREE.MeshStandardMaterial({ color: 0xd82838, roughness: 0.4 }),
  strawberryGreen: new THREE.MeshStandardMaterial({ color: 0x8aba4a, roughness: 0.55 }),
  lettuceLeaf: new THREE.MeshStandardMaterial({ color: 0x7ac850, roughness: 0.7, side: THREE.DoubleSide }),
  pumpkinStem: new THREE.MeshStandardMaterial({ color: 0x6a8a3a, roughness: 0.85 }),

  // ── Flowers ────────────────────────────────────────────────
  flowerPink: new THREE.MeshStandardMaterial({ color: 0xffa8c8, roughness: 0.7 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.7 }),
  flowerWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  flowerPurple: new THREE.MeshStandardMaterial({ color: 0xc88aff, roughness: 0.7 }),

  // ── Tree ───────────────────────────────────────────────────
  bark: new THREE.MeshStandardMaterial({ map: makeBarkTexture(), roughness: 0.95 }),
  foliage1: new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.88 }),
  foliage2: new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 0.88 }),
  foliage3: new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.88 }),

  // ── Stone ──────────────────────────────────────────────────
  rock: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92 }),
  rockDark: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.94 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.94 }),

  // ── Buildings ──────────────────────────────────────────────
  wallPlaster: new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.9 }),
  roofTile: new THREE.MeshStandardMaterial({ color: 0xa8503a, roughness: 0.75 }),
  roofThatch: new THREE.MeshStandardMaterial({ color: 0xc8a850, roughness: 0.92 }),
  roofRed: new THREE.MeshStandardMaterial({ color: 0xa8483a, roughness: 0.8 }),
  roofBrown: new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.88 }),
  window: new THREE.MeshStandardMaterial({ color: 0x2a4050, roughness: 0.15, metalness: 0.5, emissive: 0x1a2a40, emissiveIntensity: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x88b0d0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.72 }),
  windowFrame: new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 }),

  // ── Animals ────────────────────────────────────────────────
  sheepWool: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.98 }),
  sheepFace: new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.85 }),
  chickenBody: new THREE.MeshStandardMaterial({ color: 0xfaf0e0, roughness: 0.9 }),
  chickenComb: new THREE.MeshStandardMaterial({ color: 0xe83a3a, roughness: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xf0a030, roughness: 0.6 }),
  cowBody: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85 }),
  cowSpot: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.85 }),

  // ── Horse ──────────────────────────────────────────────────
  horseCoat: new THREE.MeshStandardMaterial({ color: 0x8a4a28, roughness: 0.85 }),
  horseCoatDark: new THREE.MeshStandardMaterial({ color: 0x5a2a10, roughness: 0.88 }),
  horseBlack: new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.9 }),
  horseMane: new THREE.MeshStandardMaterial({ color: 0x1a0a05, roughness: 0.92 }),
  horseMuzzle: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.88 }),
  horseHoof: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7 }),
  horseEye: new THREE.MeshStandardMaterial({ color: 0x0a0505, roughness: 0.15, metalness: 0.3 }),

  // ── Misc ───────────────────────────────────────────────────
  straw: new THREE.MeshStandardMaterial({ color: 0xd4b060, roughness: 0.95 }),
  hay: new THREE.MeshStandardMaterial({ color: 0xb89040, roughness: 0.95 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xb8a880, roughness: 0.95 }),
  burlap: new THREE.MeshStandardMaterial({ color: 0xa89060, roughness: 0.96 }),
  wicker: new THREE.MeshStandardMaterial({ color: 0xb08a50, roughness: 0.95 }),
  wickerDark: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.92 }),
};

// ═══════════════════════════════════════════════════════════════
//  SOIL MATERIALS (for farm grid)
// ═══════════════════════════════════════════════════════════════
export const SOIL_MATS = {
  grass: new THREE.MeshStandardMaterial({ map: makeSoilTexture(0), roughness: 0.98 }),
  tilled: new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.15), roughness: 1.0 }),
  wet: new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.9), roughness: 0.7, metalness: 0.05 }),
  fertilized: new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.3), roughness: 0.95, emissive: 0x2a1a00, emissiveIntensity: 0.08 }),
};

// ═══════════════════════════════════════════════════════════════
//  EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════
export { makeWoodTexture, makeBarkTexture, makeSoilTexture, makeLeafTexture };
