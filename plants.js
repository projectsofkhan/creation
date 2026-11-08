import * as THREE from 'three';
import { gameState, Audio, HUD, terrainHeight } from './engine.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — plants.js  (FIXED SYNTAX)
   ═══════════════════════════════════════════════════════════════ */

const PLANT_MAT = {
  stemGreen: new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.82 }),
  stemDark: new THREE.MeshStandardMaterial({ color: 0x3a6028, roughness: 0.85 }),
  leafMid: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8, side: THREE.DoubleSide }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x356a28, roughness: 0.82, side: THREE.DoubleSide }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6ab04a, roughness: 0.78, side: THREE.DoubleSide }),
  tomatoRed: new THREE.MeshStandardMaterial({ color: 0xe83a2a, roughness: 0.35, metalness: 0.05, emissive: 0x2a0808, emissiveIntensity: 0.2 }),
  tomatoGreen: new THREE.MeshStandardMaterial({ color: 0x7aba4a, roughness: 0.5 }),
  carrotOrange: new THREE.MeshStandardMaterial({ color: 0xe87820, roughness: 0.55 }),
  potatoBrown: new THREE.MeshStandardMaterial({ color: 0xa87850, roughness: 0.75 }),
  cornYellow: new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5, emissive: 0x1a1000, emissiveIntensity: 0.15 }),
  cornGreen: new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.55 }),
  lettuceLeaf: new THREE.MeshStandardMaterial({ color: 0x7ac850, roughness: 0.7, side: THREE.DoubleSide }),
  strawberryRed: new THREE.MeshStandardMaterial({ color: 0xd82838, roughness: 0.4, emissive: 0x2a0008, emissiveIntensity: 0.25 }),
  strawberryGreen: new THREE.MeshStandardMaterial({ color: 0x8aba4a, roughness: 0.55 }),
  flowerWhite: new THREE.MeshStandardMaterial({ color: 0xfdfaf0, roughness: 0.7 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xf0d040, roughness: 0.7 }),
  wilt: new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 0.95 }),
  spot: new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.9 }),
};

export const CROPS = {
  tomato: {
    id: 'tomato', name: 'Tomato', emoji: '🍅', value: 8, seedCost: 5, daysToHarvest: 3.5,
    waterNeed: 0.75, spacing: 0.9,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'mature'],
    diseaseRisk: { blight: 0.02 },
    build: buildTomato,
  },
  carrot: {
    id: 'carrot', name: 'Carrot', emoji: '🥕', value: 6, seedCost: 4, daysToHarvest: 2.5,
    waterNeed: 0.55, spacing: 0.6,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'root growth', 'mature'],
    diseaseRisk: { rootFly: 0.02 },
    build: buildCarrot,
  },
  potato: {
    id: 'potato', name: 'Potato', emoji: '🥔', value: 9, seedCost: 6, daysToHarvest: 4.0,
    waterNeed: 0.6, spacing: 0.8,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'tuber formation', 'mature'],
    diseaseRisk: { blight: 0.03 },
    build: buildPotato,
  },
  corn: {
    id: 'corn', name: 'Corn', emoji: '🌽', value: 12, seedCost: 8, daysToHarvest: 4.5,
    waterNeed: 0.8, spacing: 1.2,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'tasseling', 'silking', 'mature'],
    diseaseRisk: { rust: 0.015 },
    build: buildCorn,
  },
  lettuce: {
    id: 'lettuce', name: 'Lettuce', emoji: '🥬', value: 5, seedCost: 5, daysToHarvest: 2.0,
    waterNeed: 0.7, spacing: 0.5,
    stages: ['seed', 'germination', 'seedling', 'leaf development', 'heart forming', 'mature'],
    diseaseRisk: { slug: 0.03, bolt: 0.05 },
    build: buildLettuce,
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', emoji: '🍓', value: 10, seedCost: 10, daysToHarvest: 3.0,
    waterNeed: 0.65, spacing: 0.7,
    stages: ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'mature'],
    diseaseRisk: { botrytis: 0.025 },
    build: buildStrawberry,
  },
};

function stageFor(crop, growth) {
  const n = crop.stages.length;
  return Math.min(n - 1, Math.floor(growth * n));
}

function buildTomato(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.tomato, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.4, 1);
    g.add(mound);
    return g;
  }
  const stemHeight = stage === 2 ? 0.15 : stage === 3 ? 0.4 : stage === 4 ? 0.7 : 0.95;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, stemHeight, 6), PLANT_MAT.stemGreen);
  stem.position.y = stemHeight / 2;
  g.add(stem);
  for (let i = 0; i < (stage >= 5 ? 6 : 4); i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 3), PLANT_MAT.leafMid);
    leaf.scale.set(1.4, 0.25, 0.7);
    const a = i * 1.2;
    leaf.position.set(Math.cos(a) * 0.15, 0.15 + i * 0.1, Math.sin(a) * 0.15);
    leaf.rotation.y = -a;
    g.add(leaf);
  }
  if (stage >= 5) {
    const ripe = stage === 6;
    for (let i = 0; i < 4; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), ripe ? PLANT_MAT.tomatoRed : PLANT_MAT.tomatoGreen);
      const a = i * 1.5;
      fruit.position.set(Math.cos(a) * 0.18, 0.5 + i * 0.1, Math.sin(a) * 0.18);
      g.add(fruit);
    }
  }
  return g;
}

function buildCarrot(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.carrot, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const foliageHeight = stage === 1 ? 0.1 : stage === 2 ? 0.18 : 0.35;
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 3), PLANT_MAT.leafLight);
    const a = i * 0.9;
    leaf.position.set(Math.cos(a) * 0.05, foliageHeight * 0.5, Math.sin(a) * 0.05);
    leaf.rotation.z = Math.cos(a) * 0.5;
    g.add(leaf);
  }
  if (stage >= 4) {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), PLANT_MAT.carrotOrange);
    root.rotation.x = Math.PI;
    root.position.y = -0.1;
    g.add(root);
  }
  return g;
}

function buildPotato(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.potato, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.35, 1);
    g.add(mound);
    return g;
  }
  const plantHeight = stage === 1 ? 0.1 : stage === 2 ? 0.25 : 0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, plantHeight, 6), PLANT_MAT.stemGreen);
  stem.position.y = plantHeight / 2;
  g.add(stem);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 3), PLANT_MAT.leafMid);
    leaf.scale.set(1.2, 0.2, 0.7);
    const a = i * 1.3;
    leaf.position.set(Math.cos(a) * 0.1, 0.1 + i * 0.08, Math.sin(a) * 0.1);
    leaf.rotation.y = -a;
    g.add(leaf);
  }
  if (stage >= 4) {
    for (let i = 0; i < 3; i++) {
      const tuber = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), PLANT_MAT.potatoBrown);
      const a = i * 1.5;
      tuber.position.set(Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.15);
      tuber.scale.y = 0.5;
      g.add(tuber);
    }
  }
  return g;
}

function buildCorn(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.corn, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const plantHeight = stage === 1 ? 0.15 : stage === 2 ? 0.4 : stage === 3 ? 0.9 : 1.4;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, plantHeight, 7), PLANT_MAT.stemGreen);
  stalk.position.y = plantHeight / 2;
  g.add(stalk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.1), PLANT_MAT.leafMid);
    const a = i * 1.15;
    leaf.position.set(Math.cos(a) * 0.2, 0.15 + i * 0.15, Math.sin(a) * 0.2);
    leaf.rotation.y = a;
    leaf.rotation.z = 0.4;
    g.add(leaf);
  }
  if (stage >= 5) {
    const ripe = stage === 6;
    for (let i = 0; i < 2; i++) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), ripe ? PLANT_MAT.cornYellow : PLANT_MAT.cornGreen);
      const a = i * Math.PI + 0.5;
      ear.position.set(Math.cos(a) * 0.08, plantHeight * 0.6, Math.sin(a) * 0.08);
      ear.rotation.z = Math.cos(a) * 0.6;
      g.add(ear);
    }
  }
  return g;
}

function buildLettuce(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.lettuce, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const leafCount = stage === 1 ? 3 : stage === 2 ? 5 : stage === 3 ? 8 : 12;
  const leafSize = stage === 1 ? 0.06 : stage === 2 ? 0.1 : stage === 3 ? 0.15 : 0.2;
  for (let i = 0; i < leafCount; i++) {
    const angle = i * 2.399;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), PLANT_MAT.lettuceLeaf);
    leaf.scale.set(1, 0.18, 1.3);
    const dist = 0.04 + (i / leafCount) * 0.15;
    leaf.position.set(Math.cos(angle) * dist, 0.02 + (i / leafCount) * 0.15, Math.sin(angle) * dist);
    leaf.rotation.y = -angle;
    leaf.rotation.z = -0.1;
    g.add(leaf);
  }
  return g;
}

function buildStrawberry(growth, health) {
  const g = new THREE.Group();
  const stage = stageFor(CROPS.strawberry, growth);
  if (stage === 0) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), PLANT_MAT.stemDark);
    mound.scale.set(1, 0.3, 1);
    g.add(mound);
    return g;
  }
  const leafCount = stage === 1 ? 2 : stage === 2 ? 3 : 5;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), PLANT_MAT.leafMid);
    leaf.scale.set(1.2, 0.2, 0.9);
    leaf.position.set(Math.cos(angle) * 0.1, 0.08, Math.sin(angle) * 0.1);
    leaf.rotation.y = -angle;
    g.add(leaf);
  }
  if (stage >= 5) {
    const ripe = stage === 6;
    for (let i = 0; i < 3; i++) {
      const a = i * 1.4;
      const fruit = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 6), ripe ? PLANT_MAT.strawberryRed : PLANT_MAT.strawberryGreen);
      fruit.rotation.x = Math.PI;
      fruit.position.set(Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1);
      g.add(fruit);
    }
  }
  return g;
}

class PlantInstance {
  constructor(cropId, x, z) {
    this.cropId = cropId;
    this.crop = CROPS[cropId];
    this.x = x;
    this.z = z;
    this.y = terrainHeight(x, z);

    this.growth = 0;
    this.health = 1.0;
    this.soilWater = 0.5; // renamed from 'water' to avoid conflicts
    this.nutrients = 0.7;
    
    this.stage = 0;
    this.mesh = null;
    this.hasDisease = null;

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
    if (this.growth >= 0.98) return `<span class="key">E</span> Harvest ${crop.emoji} ${crop.name}`;
    if (this.soilWater < 0.3) return `<span class="key">E</span> Water ${crop.emoji} ${crop.name} (thirsty)`;
    if (this.hasDisease) return `<span class="key">E</span> Treat ${crop.emoji} ${crop.name}`;
    return `${crop.emoji} ${crop.name} — ${crop.stages[this.stage]} (${Math.floor(this.growth * 100)}%)`;
  }

  update(dt) {
    const prevStage = this.stage;
    const crop = this.crop;
    
    const growthPerSecond = (1 / crop.daysToHarvest) / (gameState.world.dayLength || 600);
    
    this.soilWater = Math.max(0, this.soilWater - dt * 0.0008 * crop.waterNeed);
    
    const tod = gameState.world.timeOfDay;
    const dayness = Math.max(0, Math.min(1, 1 - Math.abs(tod - 0.5) * 3));

    let healthDelta = 0;
    if (this.soilWater < 0.2) healthDelta -= dt * 0.0015;
    else if (this.soilWater > 0.4 && this.soilWater < 0.85) healthDelta += dt * 0.0003;

    this.health = Math.max(0, Math.min(1, this.health + healthDelta));

    const growthModifier = this.health * (this.soilWater > 0.25 ? 1.0 : 0.3) * (dayness > 0.3 ? 1.0 : 0.5);
    if (this.growth < 1) {
      this.growth = Math.min(1, this.growth + dt * growthPerSecond * growthModifier);
    }

    this.stage = stageFor(crop, this.growth);
    if (this.stage !== prevStage) this.rebuildMesh();
  }

  waterPlant() {
    this.soilWater = Math.min(1, this.soilWater + 0.5);
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
    const yieldAmt = Math.floor(1 + this.health * 2);
    return { cropId: this.cropId, yield: yieldAmt, value: crop.value * yieldAmt };
  }

  dispose() {
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
      this.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  }
}

export class PlantManager {
  constructor(scene) {
    this.scene = scene;
    this.plants = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  tryPlant(cropId, x, z) {
    const crop = CROPS[cropId];
    if (!crop) return null;
    
    for (const p of this.plants) {
      if (Math.hypot(p.x - x, p.z - z) < crop.spacing * 0.8) {
        HUD.showToast(`Too close to another ${p.crop.name}`);
        return null;
      }
    }
    
    if (!gameState.player.seeds[cropId] || gameState.player.seeds[cropId] <= 0) {
      HUD.showToast(`No ${crop.name} seeds`);
      return null;
    }
    
    const plant = new PlantInstance(cropId, x, z);
    this.plants.push(plant);
    this.group.add(plant.mesh);
    gameState.player.seeds[cropId]--;
    
    Audio.playTone(520, 0.15, 'sine', 0.05);
    HUD.showToast(`Planted ${crop.emoji} ${crop.name}`);
    window.dispatchEvent(new CustomEvent('hud-refresh'));
    return plant;
  }

  update(dt) {
    for (const p of this.plants) p.update(dt);
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

export function getCropList() {
  return Object.values(CROPS);
}