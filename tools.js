// ═══════════════════════════════════════════════════════════════
//  tools.js — v2
//  Replaces: tools.js (old)
//
//  Fixes vs old:
//  • Forgiving raycast (4.0 range, invisible colliders)
//  • Tool models attach to new player rig's toolAnchor
//  • Water stream visual on watering
//  • Tool swing triggers rig animation
//  • Floating emoji icons above pickups
//  • No more "two pairs of arms" — hands are part of rig
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { MATS } from './materials.js';
import { CROPS } from './plants.js';
import { terrainHeight } from './terrain.js';

// ═══════════════════════════════════════════════════════════════
//  TOOL MODELS (small, attached to right hand)
// ═══════════════════════════════════════════════════════════════

function buildHoe() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.75, 8),
    MATS.wood
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -0.05, 0.30);
  handle.castShadow = true;
  g.add(handle);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), MATS.iron);
  blade.position.set(0, -0.05, 0.68);
  blade.rotation.x = 0.3;
  blade.castShadow = true;
  g.add(blade);

  return g;
}

function buildWateringCan() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.15, 12),
    MATS.waterCan
  );
  body.position.set(0, -0.05, 0.15);
  body.castShadow = true;
  g.add(body);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.03, 0.20, 8),
    MATS.waterCan
  );
  spout.position.set(0.08, 0.02, 0.20);
  spout.rotation.z = -0.7;
  spout.castShadow = true;
  g.add(spout);

  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.025, 0.02, 10),
    MATS.silver
  );
  rose.position.set(0.15, 0.08, 0.24);
  rose.rotation.z = -0.7;
  g.add(rose);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.01, 6, 12, Math.PI),
    MATS.waterCan
  );
  handle.position.set(0, 0.04, 0.10);
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = Math.PI;
  g.add(handle);

  return g;
}

function buildTrowel() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.02, 0.12, 8),
    MATS.wood
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -0.02, 0.10);
  g.add(handle);

  const scoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.005, 0.10),
    MATS.iron
  );
  scoop.position.set(0, 0, 0.22);
  scoop.rotation.x = 0.2;
  scoop.castShadow = true;
  g.add(scoop);

  return g;
}

function buildBasket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.08, 0.13, 12, 1, true),
    MATS.wicker
  );
  body.position.set(0, -0.02, 0.10);
  body.material.side = THREE.DoubleSide;
  body.castShadow = true;
  g.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.012, 6, 16),
    MATS.wickerDark
  );
  rim.position.set(0, 0.045, 0.10);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  return g;
}

function buildSeedHand(cropId) {
  const g = new THREE.Group();
  const colors = {
    tomato: 0xf0e8c0, carrot: 0xd0c8a0, potato: 0xc0a880,
    corn: 0xf0e0a0, lettuce: 0x3a2a1a, strawberry: 0xd8c8a8,
  };
  const seedMat = new THREE.MeshStandardMaterial({
    color: colors[cropId] || 0xd0c8a0,
    roughness: 0.7,
  });
  for (let i = 0; i < 6; i++) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.010, 5, 4), seedMat);
    seed.position.set(
      (Math.random() - 0.5) * 0.04,
      (Math.random() - 0.5) * 0.02,
      0.08 + (Math.random() - 0.5) * 0.04
    );
    seed.scale.set(1, 0.7, 1.3);
    g.add(seed);
  }
  return g;
}

function buildHayHand() {
  const g = new THREE.Group();
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd4b060, roughness: 0.95 });
  for (let i = 0; i < 10; i++) {
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.12, 3),
      hayMat
    );
    straw.position.set(
      (Math.random() - 0.5) * 0.06,
      (Math.random() - 0.5) * 0.03,
      0.10 + (Math.random() - 0.5) * 0.04
    );
    straw.rotation.set(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    g.add(straw);
  }
  return g;
}

// ═══════════════════════════════════════════════════════════════
//  HAND MANAGER
// ═══════════════════════════════════════════════════════════════
export class HandManager {
  constructor(camera, playerRig) {
    this.camera = camera;
    this.rig = playerRig;
    this.toolAnchor = playerRig?.toolAnchor;
    this.currentTool = 'hand';

    this.tools = {
      hoe: buildHoe(),
      wateringcan: buildWateringCan(),
      trowel: buildTrowel(),
      basket: buildBasket(),
      seed_tomato: buildSeedHand('tomato'),
      seed_carrot: buildSeedHand('carrot'),
      seed_potato: buildSeedHand('potato'),
      seed_corn: buildSeedHand('corn'),
      seed_lettuce: buildSeedHand('lettuce'),
      seed_strawberry: buildSeedHand('strawberry'),
      hay: buildHayHand(),
    };

    // Attach all to the rig's tool anchor, hide all
    if (this.toolAnchor) {
      for (const [id, model] of Object.entries(this.tools)) {
        model.visible = false;
        this.toolAnchor.add(model);
      }
    }
  }

  setTool(id) {
    for (const t of Object.values(this.tools)) t.visible = false;
    this.currentTool = id;
    if (this.tools[id]) this.tools[id].visible = true;
  }

  playSwing() {
    this.rig?.triggerToolSwing?.();
  }

  update(_dt, _elapsed, _moving, _running) {
    // Animation now lives in the rig (player.js) — nothing to do here
  }

  hide() { if (this.toolAnchor) this.toolAnchor.visible = false; }
  show() { if (this.toolAnchor) this.toolAnchor.visible = true; }
}

// ═══════════════════════════════════════════════════════════════
//  ACTION — E key / touch button
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
raycaster.far = 4.0;

export function performAction(handManager, camera, plantManager, worldInteractables) {
  const player = window.__gameState?.player;
  if (!player) return;
  const held = handManager.currentTool;

  // 1. Plants
  const plant = raycastPlant(camera, plantManager);
  if (plant) {
    if (plant.growth >= 0.98) {
      if (held === 'basket') {
        const result = plant.harvest();
        if (result) {
          player.harvest += result.yield;
          player.coins += result.value;
          window.__HUD?.toast?.(`Harvested ${result.yield}× ${plant.crop.emoji} — +${result.value}🪙`);
          window.__Audio?.tone?.(660, 0.2, 'sine', 0.07);
          plantManager.removePlant(plant);
          handManager.playSwing();
          window.dispatchEvent(new CustomEvent('hud-refresh'));
        }
      } else {
        window.__HUD?.toast?.(`Equip the basket 🧺 to harvest`);
      }
      return;
    }

    if (plant.soilWater < 0.4) {
      if (held === 'wateringcan') {
        if (player.water > 0) {
          plant.waterPlant();
          player.water--;
          handManager.playSwing();
          window.dispatchEvent(new CustomEvent('hud-refresh'));
          window.__Audio?.splash?.();
        } else {
          window.__HUD?.toast?.('Watering can is empty');
        }
      } else {
        window.__HUD?.toast?.(`Switch to watering can 💧`);
      }
      return;
    }

    if (plant.hasDisease) {
      plant.treat();
      handManager.playSwing();
      return;
    }

    window.__HUD?.toast?.(plant.getPrompt().replace(/<[^>]*>/g, ''));
    return;
  }

  // 2. World interactables
  if (worldInteractables?.length) {
    const target = raycastInteractable(camera, worldInteractables);
    if (target) {
      handleWorldInteraction(target, handManager);
      return;
    }
  }

  // 3. Ground actions
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const tx = camera.position.x + dir.x * 1.8;
  const tz = camera.position.z + dir.z * 1.8;

  if (held === 'hoe') {
    window.__HUD?.toast?.('Tilled the soil 🌱');
    window.__Audio?.tone?.(180, 0.15, 'triangle', 0.06);
    handManager.playSwing();
    spawnDirtPuff(tx, tz);
    return;
  }

  if (held.startsWith('seed_')) {
    const cropId = held.replace('seed_', '');
    const plant = plantManager.tryPlant(cropId, tx, tz);
    if (plant) {
      handManager.playSwing();
      spawnDirtPuff(tx, tz);
      if (player.seeds[cropId] <= 0) handManager.setTool('hand');
    }
    return;
  }

  if (held === 'wateringcan') {
    window.__HUD?.toast?.('Aim at a plant 💧');
    return;
  }
  if (held === 'basket') {
    window.__HUD?.toast?.('Aim at a ripe plant 🍅');
    return;
  }

  window.__HUD?.toast?.('Nothing here');
}

function raycastPlant(camera, plantManager) {
  const meshes = plantManager.getInteractableMeshes();
  if (!meshes.length) return null;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObjects(meshes, true);
  return hits.length ? plantManager.findPlantFromObject(hits[0].object) : null;
}

function raycastInteractable(camera, interactables) {
  if (!interactables?.length) return null;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObjects(interactables, true);
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.interact) o = o.parent;
    return o;
  }
  return null;
}

function handleWorldInteraction(target, handManager) {
  const inter = target.userData.interact;
  const player = window.__gameState?.player;
  if (!player) return;

  switch (inter.type) {
    case 'take_seed': {
      const seedId = inter.seedId;
      const crop = CROPS[seedId];
      if (!crop) return;
      if (player.coins < crop.seedCost) {
        window.__HUD?.toast?.(`Need ${crop.seedCost}🪙`);
        return;
      }
      player.coins -= crop.seedCost;
      player.seeds[seedId] = (player.seeds[seedId] || 0) + 1;
      handManager.setTool('seed_' + seedId);
      window.__Audio?.tone?.(720, 0.15, 'sine', 0.06);
      window.__HUD?.toast?.(`Took ${crop.emoji} ${crop.name} seed`);
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    }
    case 'take_tool':
      handManager.setTool(inter.toolId);
      window.__HUD?.toast?.(`Equipped ${inter.emoji || ''} ${inter.toolName}`);
      break;
    case 'feed_horse':
      handManager.setTool('hay');
      window.__HUD?.toast?.('Grabbed hay 🌾');
      break;
    case 'refill_water':
      player.water = player.waterMax;
      window.__Audio?.splash?.();
      window.__HUD?.toast?.('Watering can filled 💧');
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    case 'rest':
      window.__HUD?.toast?.('You rest a moment…');
      break;
    case 'sleep':
      window.__gameState.world.timeOfDay = 0.28;
      window.__gameState.world.day++;
      window.__HUD?.toast?.(`🌅 Day ${window.__gameState.world.day}`);
      break;
    case 'open_seeds':
      window.__HUD?.toast?.('Seed selection — coming soon');
      break;
    case 'horse':
      window.__horseManager?.handleInteract?.();
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DIRT PARTICLES
// ═══════════════════════════════════════════════════════════════
let dirtParticles = null;
let dirtCursor = 0;

export function initDirtParticles(scene) {
  dirtParticles = [];
  const geo = new THREE.SphereGeometry(0.04, 5, 4);
  for (let i = 0; i < 40; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x7a5a3a, transparent: true, opacity: 0 });
    const p = new THREE.Mesh(geo, mat);
    p.visible = false;
    p.userData = { active: false, life: 0, vel: new THREE.Vector3() };
    scene.add(p);
    dirtParticles.push(p);
  }
}

function spawnDirtPuff(x, z) {
  if (!dirtParticles) return;
  const y = terrainHeight(x, z);
  for (let i = 0; i < 8; i++) {
    const p = dirtParticles[dirtCursor];
    dirtCursor = (dirtCursor + 1) % dirtParticles.length;
    p.position.set(x, y + 0.1, z);
    p.material.opacity = 0.9;
    p.visible = true;
    p.userData.active = true;
    p.userData.life = 0.8;
    p.userData.vel.set(
      (Math.random() - 0.5) * 2,
      Math.random() * 2 + 0.5,
      (Math.random() - 0.5) * 2
    );
  }
}

export function updateDirtParticles(dt) {
  if (!dirtParticles) return;
  for (const p of dirtParticles) {
    if (!p.userData.active) continue;
    p.userData.life -= dt;
    if (p.userData.life <= 0) {
      p.userData.active = false;
      p.visible = false;
      continue;
    }
    p.userData.vel.y -= 6 * dt;
    p.position.addScaledVector(p.userData.vel, dt);
    p.material.opacity = p.userData.life / 0.8;
  }
}

// ═══════════════════════════════════════════════════════════════
//  WATER STREAM (removed — handled by rig now; keeping stub)
// ═══════════════════════════════════════════════════════════════
export function initWaterStream(_scene) {}
export function updateWaterStream(_dt, _camera, _active) {}
