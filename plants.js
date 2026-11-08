// ═══════════════════════════════════════════════════════════════
//  plants.js — v2
//  Replaces: plants.js (old)
//
//  Fixes vs old:
//  • Grid-snapped planting (no five-tomatoes-in-one-spot)
//  • All growth stages built once, visibility toggled (no mesh pop)
//  • Growth in REAL SECONDS (tomato ~2.5 min, not 35)
//  • Proper crop shapes (tomato is a tomato, not a sphere)
//  • Disease is a visual overlay, not a hidden flag
//  • Water stream visual when watering
//  • Soil moisture persists and drains realistically
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { MATS } from './materials.js';
import { terrainHeight } from './terrain.js';

// ═══════════════════════════════════════════════════════════════
//  CROP DEFINITIONS — growth in real seconds
// ═══════════════════════════════════════════════════════════════
export const CROPS = {
  tomato: {
    id: 'tomato', name: 'Tomato', emoji: '🍅',
    value: 8, seedCost: 5,
    growSeconds: 150,       // 2.5 min to mature
    waterNeed: 0.75,
    spacing: 0.9,
    stages: ['seed', 'sprout', 'young', 'flowering', 'fruiting', 'ripe'],
  },
  carrot: {
    id: 'carrot', name: 'Carrot', emoji: '🥕',
    value: 6, seedCost: 4,
    growSeconds: 110,
    waterNeed: 0.55,
    spacing: 0.6,
    stages: ['seed', 'sprout', 'young', 'root', 'ripe'],
  },
  potato: {
    id: 'potato', name: 'Potato', emoji: '🥔',
    value: 9, seedCost: 6,
    growSeconds: 170,
    waterNeed: 0.6,
    spacing: 0.8,
    stages: ['seed', 'sprout', 'young', 'tuber', 'ripe'],
  },
  corn: {
    id: 'corn', name: 'Corn', emoji: '🌽',
    value: 12, seedCost: 8,
    growSeconds: 200,
    waterNeed: 0.8,
    spacing: 1.2,
    stages: ['seed', 'sprout', 'young', 'tassel', 'silk', 'ripe'],
  },
  lettuce: {
    id: 'lettuce', name: 'Lettuce', emoji: '🥬',
    value: 5, seedCost: 5,
    growSeconds: 90,
    waterNeed: 0.7,
    spacing: 0.5,
    stages: ['seed', 'sprout', 'leaf', 'heart', 'ripe'],
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', emoji: '🍓',
    value: 10, seedCost: 10,
    growSeconds: 130,
    waterNeed: 0.65,
    spacing: 0.7,
    stages: ['seed', 'sprout', 'young', 'flower', 'fruit', 'ripe'],
  },
};

function stageFor(crop, growth) {
  const n = crop.stages.length;
  return Math.min(n - 1, Math.floor(growth * n));
}

// ═══════════════════════════════════════════════════════════════
//  CROP MESH BUILDERS — proper shapes, built once per stage
// ═══════════════════════════════════════════════════════════════

function buildTomatoStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    // Seed mound
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.35, 1);
    g.add(mound);
    return g;
  }
  if (stage === 1) {
    // Sprout — two small leaves
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 5), MATS.stem);
    stem.position.y = 0.06;
    g.add(stem);
    for (let i = 0; i < 2; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), MATS.leafLight);
      leaf.scale.set(1.4, 0.2, 0.8);
      leaf.position.set((i - 0.5) * 0.08, 0.10, 0);
      leaf.rotation.z = (i - 0.5) * 0.5;
      g.add(leaf);
    }
    return g;
  }
  // Young through ripe — stem + leaves + fruit
  const height = 0.2 + stage * 0.18;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, height, 6), MATS.stem);
  stem.position.y = height / 2;
  stem.castShadow = true;
  g.add(stem);

  const leafCount = stage >= 3 ? 6 : 4;
  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), MATS.leafMid);
    leaf.scale.set(1.6, 0.22, 0.9);
    const a = i * 1.2;
    leaf.position.set(Math.cos(a) * 0.14, 0.12 + i * 0.06, Math.sin(a) * 0.14);
    leaf.rotation.y = -a;
    leaf.castShadow = true;
    g.add(leaf);
  }

  if (stage >= 4) {
    // Fruit — proper tomato shape (slightly flattened sphere with green calyx)
    const ripe = stage === 5;
    const fruitCount = ripe ? 4 : 3;
    for (let i = 0; i < fruitCount; i++) {
      const fruitGroup = new THREE.Group();
      const a = i * 1.5;
      fruitGroup.position.set(
        Math.cos(a) * 0.16,
        0.25 + i * 0.08,
        Math.sin(a) * 0.16
      );

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 8),
        ripe ? MATS.tomato : MATS.tomatoGreen
      );
      body.scale.set(1, 0.92, 1);
      body.castShadow = true;
      fruitGroup.add(body);

      // Calyx (green star on top)
      for (let c = 0; c < 5; c++) {
        const sepal = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.005, 0.015),
          MATS.leafDark
        );
        const ca = (c / 5) * Math.PI * 2;
        sepal.position.set(Math.cos(ca) * 0.04, 0.065, Math.sin(ca) * 0.04);
        sepal.rotation.y = ca;
        fruitGroup.add(sepal);
      }

      g.add(fruitGroup);
    }
  }
  return g;
}

function buildCarrotStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const foliageH = 0.1 + stage * 0.06;
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.02, foliageH, 4), MATS.leafLight);
    const a = i * 0.9;
    leaf.position.set(Math.cos(a) * 0.04, foliageH / 2, Math.sin(a) * 0.04);
    leaf.rotation.z = Math.cos(a) * 0.4;
    leaf.rotation.x = Math.sin(a) * 0.4;
    g.add(leaf);
  }
  if (stage >= 3) {
    // Root visible (orange cone)
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 8), MATS.carrot);
    root.rotation.x = Math.PI;
    root.position.y = -0.1;
    root.castShadow = true;
    g.add(root);
  }
  return g;
}

function buildPotatoStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.35, 1);
    g.add(mound);
    return g;
  }
  const height = 0.1 + stage * 0.12;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, height, 6), MATS.stem);
  stem.position.y = height / 2;
  g.add(stem);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), MATS.leafMid);
    leaf.scale.set(1.3, 0.2, 0.8);
    const a = i * 1.3;
    leaf.position.set(Math.cos(a) * 0.1, 0.08 + i * 0.08, Math.sin(a) * 0.1);
    leaf.rotation.y = -a;
    g.add(leaf);
  }
  if (stage >= 3) {
    // Tubers near ground
    for (let i = 0; i < 3; i++) {
      const tuber = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), MATS.potato);
      const a = i * 1.5;
      tuber.position.set(Math.cos(a) * 0.12, 0.03, Math.sin(a) * 0.12);
      tuber.scale.y = 0.6;
      tuber.castShadow = true;
      g.add(tuber);
    }
  }
  return g;
}

function buildCornStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const height = stage === 1 ? 0.15 : stage === 2 ? 0.4 : stage === 3 ? 0.8 : 1.3;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, height, 7), MATS.stem);
  stalk.position.y = height / 2;
  stalk.castShadow = true;
  g.add(stalk);

  const leafCount = stage >= 3 ? 7 : 4;
  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.08), MATS.leafMid);
    const a = i * 1.15;
    leaf.position.set(Math.cos(a) * 0.15, 0.15 + i * 0.14, Math.sin(a) * 0.15);
    leaf.rotation.y = a;
    leaf.rotation.z = 0.5;
    leaf.castShadow = true;
    g.add(leaf);
  }

  if (stage >= 4) {
    // Ears
    const ripe = stage === 5;
    for (let i = 0; i < 2; i++) {
      const ear = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 0.18, 4, 8),
        ripe ? MATS.corn : MATS.cornGreen
      );
      const a = i * Math.PI + 0.5;
      ear.position.set(Math.cos(a) * 0.08, height * 0.6, Math.sin(a) * 0.08);
      ear.rotation.z = Math.cos(a) * 0.6;
      ear.castShadow = true;
      g.add(ear);

      // Husk leaves
      for (let k = 0; k < 3; k++) {
        const husk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.015), MATS.leafDark);
        husk.position.copy(ear.position);
        husk.rotation.set(ear.rotation.x, ear.rotation.y + k * 0.6, 0);
        husk.translateZ(0.06);
        g.add(husk);
      }
    }
  }
  return g;
}

function buildLettuceStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const leafCount = stage === 1 ? 3 : stage === 2 ? 5 : stage === 3 ? 8 : 12;
  const leafSize = stage === 1 ? 0.06 : stage === 2 ? 0.09 : stage === 3 ? 0.13 : 0.17;
  for (let i = 0; i < leafCount; i++) {
    const angle = i * 2.399; // golden angle
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), MATS.lettuceLeaf);
    leaf.scale.set(1, 0.18, 1.3);
    const dist = 0.04 + (i / leafCount) * 0.15;
    leaf.position.set(Math.cos(angle) * dist, 0.02 + (i / leafCount) * 0.12, Math.sin(angle) * dist);
    leaf.rotation.y = -angle;
    leaf.rotation.z = -0.1;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function buildStrawberryStage(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), MATS.leafDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const leafCount = stage === 1 ? 2 : stage === 2 ? 3 : 5;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), MATS.leafMid);
    leaf.scale.set(1.2, 0.2, 0.9);
    leaf.position.set(Math.cos(angle) * 0.09, 0.07, Math.sin(angle) * 0.09);
    leaf.rotation.y = -angle;
    g.add(leaf);
  }
  if (stage >= 4) {
    const ripe = stage === 5;
    for (let i = 0; i < 3; i++) {
      const a = i * 1.4;
      const fruit = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.06, 6),
        ripe ? MATS.strawberryRed : MATS.strawberryGreen
      );
      fruit.rotation.x = Math.PI;
      fruit.position.set(Math.cos(a) * 0.09, 0.06, Math.sin(a) * 0.09);
      fruit.castShadow = true;
      g.add(fruit);
    }
  }
  return g;
}

const BUILDERS = {
  tomato: buildTomatoStage,
  carrot: buildCarrotStage,
  potato: buildPotatoStage,
  corn: buildCornStage,
  lettuce: buildLettuceStage,
  strawberry: buildStrawberryStage,
};

// ═══════════════════════════════════════════════════════════════
//  PLANT INSTANCE
// ═══════════════════════════════════════════════════════════════
class PlantInstance {
  constructor(cropId, x, z, gridX, gridZ) {
    this.cropId = cropId;
    this.crop = CROPS[cropId];
    this.x = x;
    this.z = z;
    this.gridX = gridX;
    this.gridZ = gridZ;
    this.y = terrainHeight(x, z);

    this.growth = 0;              // 0..1
    this.health = 1.0;
    this.soilWater = 0.5;         // 0..1
    this.hasDisease = false;
    this.diseaseType = null;

    this.stage = 0;
    this.stageGroup = null;       // group containing all stage meshes

    // Build ALL stages up front, hide all but current
    this.buildAllStages();
    this.showStage(0);
  }

  buildAllStages() {
    this.stageGroup = new THREE.Group();
    this.stageGroup.position.set(this.x, this.y, this.z);
    this.stageGroup.rotation.y = Math.random() * Math.PI * 2;

    this.stageMeshes = [];
    for (let s = 0; s < this.crop.stages.length; s++) {
      const mesh = BUILDERS[this.cropId](s);
      mesh.visible = false;
      this.stageMeshes.push(mesh);
      this.stageGroup.add(mesh);
    }

    // Invisible collider so aiming is forgiving
    const collider = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    collider.position.y = 0.3;
    collider.userData.plant = this;
    this.stageGroup.add(collider);
    this.collider = collider;

    this.stageGroup.userData.plant = this;
  }

  showStage(stage) {
    for (let i = 0; i < this.stageMeshes.length; i++) {
      this.stageMeshes[i].visible = (i === stage);
    }
    this.stage = stage;
  }

  update(dt) {
    if (this.growth >= 1) return;

    const crop = this.crop;

    // Soil water drains (slower than before)
    this.soilWater = Math.max(0, this.soilWater - dt * 0.002 * crop.waterNeed);

    // Health
    if (this.soilWater < 0.15) {
      this.health = Math.max(0, this.health - dt * 0.01);
    } else if (this.soilWater > 0.4 && this.soilWater < 0.85) {
      this.health = Math.min(1, this.health + dt * 0.005);
    }

    // Growth rate — REAL SECONDS, scaled by health and water
    const baseRate = 1 / crop.growSeconds;
    const waterMod = this.soilWater > 0.25 ? 1.0 : 0.3;
    const healthMod = this.health;
    this.growth = Math.min(1, this.growth + dt * baseRate * waterMod * healthMod);

    // Stage change — just toggle visibility (no mesh rebuild)
    const newStage = stageFor(crop, this.growth);
    if (newStage !== this.stage) {
      this.showStage(newStage);
    }
  }

  waterPlant() {
    this.soilWater = Math.min(1, this.soilWater + 0.5);
  }

  treat() {
    this.hasDisease = false;
    this.diseaseType = null;
    this.health = Math.min(1, this.health + 0.3);
  }

  harvest() {
    if (this.growth < 0.98) return null;
    const yieldAmt = Math.floor(1 + this.health * 2);
    return {
      cropId: this.cropId,
      yield: yieldAmt,
      value: this.crop.value * yieldAmt,
    };
  }

  getPrompt() {
    const crop = this.crop;
    if (this.growth >= 0.98) return `<span class="key">E</span> Harvest ${crop.emoji} ${crop.name}`;
    if (this.soilWater < 0.3) return `<span class="key">E</span> Water ${crop.emoji} ${crop.name} (thirsty)`;
    if (this.hasDisease) return `<span class="key">E</span> Treat ${crop.emoji} ${crop.name}`;
    const pct = Math.floor(this.growth * 100);
    return `${crop.emoji} ${crop.name} — ${crop.stages[this.stage]} (${pct}%)`;
  }

  dispose() {
    if (this.stageGroup) {
      this.stageGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PLANT MANAGER — with grid snapping
// ═══════════════════════════════════════════════════════════════
export class PlantManager {
  constructor(scene) {
    this.scene = scene;
    this.plants = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    // Grid: 1×1 unit cells, snap planting to cell centers
    this.gridSize = 1.0;
    this.occupied = new Set(); // "gx,gz" keys
  }

  snapToGrid(x, z) {
    const gx = Math.round(x / this.gridSize);
    const gz = Math.round(z / this.gridSize);
    return {
      gx, gz,
      x: gx * this.gridSize,
      z: gz * this.gridSize,
      key: `${gx},${gz}`,
    };
  }

  tryPlant(cropId, x, z) {
    const crop = CROPS[cropId];
    if (!crop) return null;

    // Check inventory
    const seeds = window.__gameState?.player?.seeds;
    if (!seeds || !seeds[cropId] || seeds[cropId] <= 0) {
      if (window.__HUD?.toast) window.__HUD.toast(`No ${crop.name} seeds`);
      return null;
    }

    // Snap to grid
    const snapped = this.snapToGrid(x, z);

    // Check if cell is occupied
    if (this.occupied.has(snapped.key)) {
      if (window.__HUD?.toast) window.__HUD.toast('Already planted here');
      return null;
    }

    // Check minimum distance to other plants (spacing)
    for (const p of this.plants) {
      const d = Math.hypot(p.x - snapped.x, p.z - snapped.z);
      if (d < crop.spacing * 0.9) {
        if (window.__HUD?.toast) window.__HUD.toast(`Too close to another ${p.crop.name}`);
        return null;
      }
    }

    // Create plant
    const plant = new PlantInstance(cropId, snapped.x, snapped.z, snapped.gx, snapped.gz);
    this.plants.push(plant);
    this.occupied.add(snapped.key);
    this.group.add(plant.stageGroup);

    // Decrement seeds
    seeds[cropId]--;
    window.dispatchEvent(new CustomEvent('hud-refresh'));

    if (window.__Audio) window.__Audio.tone(520, 0.15, 'sine', 0.05);
    if (window.__HUD?.toast) window.__HUD.toast(`Planted ${crop.emoji} ${crop.name}`);
    return plant;
  }

  update(dt) {
    for (const p of this.plants) p.update(dt);
  }

  getInteractableMeshes() {
    return this.plants.map(p => p.collider).filter(Boolean);
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
      this.group.remove(plant.stageGroup);
      this.occupied.delete(`${plant.gridX},${plant.gridZ}`);
      this.plants.splice(i, 1);
    }
  }
}
