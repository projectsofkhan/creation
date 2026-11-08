import * as THREE from 'three';
import { gameState, Audio, HUD, terrainHeight } from './engine.js';
import { CROPS } from './plants.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — tools.js
   First-person hands · hoe · watering can · trowel · basket
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
//  HAND MODELS — first-person arms
// ═══════════════════════════════════════════════════════════════
function buildArm(side) {
  // side: -1 (left), 1 (right)
  const arm = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: 0xe8bfa0, roughness: 0.72 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.9 });

  // Forearm — extends from bottom of screen forward
  const forearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.32, 4, 8),
    sleeve
  );
  forearm.rotation.x = Math.PI / 2.2;
  forearm.position.set(side * 0.02, -0.1, -0.15);
  forearm.castShadow = true;
  arm.add(forearm);

  // Hand (palm)
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.04, 0.11),
    skin
  );
  palm.position.set(side * 0.02, -0.06, -0.35);
  palm.rotation.x = 0.15;
  palm.castShadow = true;
  arm.add(palm);

  // 4 fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.012, 0.055, 3, 5),
      skin
    );
    finger.rotation.x = Math.PI / 2;
    finger.position.set(
      side * 0.02 + (i - 1.5) * 0.022,
      -0.06,
      -0.42
    );
    finger.rotation.x = 1.4;
    arm.add(finger);
  }

  // Thumb
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.014, 0.05, 3, 5),
    skin
  );
  thumb.rotation.z = side * 0.9;
  thumb.rotation.x = Math.PI / 2.6;
  thumb.position.set(side * 0.08, -0.05, -0.38);
  arm.add(thumb);

  return arm;
}

// ═══════════════════════════════════════════════════════════════
//  TOOL MODELS
// ═══════════════════════════════════════════════════════════════
function buildHoe() {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9aac, roughness: 0.4, metalness: 0.8 });

  // Handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.9, 8),
    wood
  );
  handle.position.set(0, -0.15, -0.45);
  handle.rotation.x = 1.0;
  handle.castShadow = true;
  g.add(handle);

  // Metal blade
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.02, 0.14),
    metal
  );
  blade.position.set(0, 0.05, -0.75);
  blade.rotation.x = 0.35;
  blade.castShadow = true;
  g.add(blade);

  // Blade connector
  const connector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.08, 6),
    metal
  );
  connector.position.set(0, 0.02, -0.68);
  connector.rotation.x = 1.1;
  g.add(connector);

  return g;
}

function buildWateringCan() {
  const g = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({ color: 0x5a8a9a, roughness: 0.5, metalness: 0.5 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.3, metalness: 0.8 });

  // Body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.18, 14),
    metal
  );
  body.position.set(0, -0.08, -0.4);
  body.castShadow = true;
  g.add(body);

  // Spout
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.035, 0.24, 8),
    metal
  );
  spout.position.set(0.1, -0.02, -0.42);
  spout.rotation.z = -0.6;
  spout.rotation.x = -0.2;
  spout.castShadow = true;
  g.add(spout);

  // Rose (sprinkler head)
  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.03, 0.02, 12),
    silver
  );
  rose.position.set(0.17, 0.06, -0.5);
  rose.rotation.z = -0.6;
  g.add(rose);

  // Handle (top arc)
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI),
    metal
  );
  handle.position.set(0, 0.06, -0.4);
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = Math.PI;
  g.add(handle);

  return g;
}

function buildTrowel() {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9aac, roughness: 0.4, metalness: 0.8 });

  // Handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.15, 8),
    wood
  );
  handle.position.set(0, -0.12, -0.4);
  handle.rotation.x = 1.0;
  g.add(handle);

  // Metal scoop
  const scoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.005, 0.14),
    metal
  );
  scoop.position.set(0, -0.05, -0.5);
  scoop.rotation.x = 0.4;
  scoop.castShadow = true;
  g.add(scoop);

  // Scoop sides
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.03, 0.13),
      metal
    );
    wall.position.set(side * 0.03, -0.03, -0.5);
    wall.rotation.x = 0.4;
    g.add(wall);
  }

  return g;
}

function buildBasket() {
  const g = new THREE.Group();

  const wicker = new THREE.MeshStandardMaterial({ color: 0xb08a50, roughness: 0.95 });
  const wickerDark = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.92 });

  // Basket body (bowl shape)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.09, 0.16, 14, 1, true),
    wicker
  );
  body.position.set(0, -0.15, -0.4);
  body.material.side = THREE.DoubleSide;
  body.castShadow = true;
  g.add(body);

  // Rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.014, 6, 20),
    wickerDark
  );
  rim.position.set(0, -0.07, -0.4);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  // Bottom
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 14),
    wicker
  );
  bottom.position.set(0, -0.23, -0.4);
  bottom.rotation.x = -Math.PI / 2;
  g.add(bottom);

  // Handle (arc)
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI),
    wickerDark
  );
  handle.position.set(0, -0.05, -0.4);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.x = 0;
  g.add(handle);

  return g;
}

function buildSeedHand(seedId) {
  const g = new THREE.Group();
  const crop = CROPS[seedId];
  if (!crop) return g;

  // Small pile of seeds on palm
  const seedColor = {
    tomato: 0xf0e8c0, carrot: 0xd0c8a0, potato: 0xc0a880,
    corn: 0xf0e0a0, lettuce: 0x3a2a1a, strawberry: 0xd8c8a8,
  }[seedId] || 0xd0c8a0;

  const seedMat = new THREE.MeshStandardMaterial({ color: seedColor, roughness: 0.7 });

  for (let i = 0; i < 8; i++) {
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 5, 4),
      seedMat
    );
    seed.position.set(
      (Math.random() - 0.5) * 0.06,
      -0.05 + Math.random() * 0.02,
      -0.36 + (Math.random() - 0.5) * 0.05
    );
    seed.scale.set(1, 0.7, 1.3);
    g.add(seed);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  HAND MANAGER — swaps first-person hands + tools
// ═══════════════════════════════════════════════════════════════
export class HandManager {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.camera.add(this.group);

    // NOTE: camera.add() only renders if we add camera to scene. We do that in engine.

    this.leftArm = buildArm(-1);
    this.rightArm = buildArm(1);
    this.group.add(this.leftArm);
    this.group.add(this.rightArm);

    // Held item group (attached to right hand)
    this.heldGroup = new THREE.Group();
    this.rightArm.add(this.heldGroup);

    // All tool models
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
      hay: buildSeedHand('carrot'),  // placeholder — hay is just handful
      hand: null,
    };

    for (const [id, model] of Object.entries(this.tools)) {
      if (model) {
        this.heldGroup.add(model);
        model.visible = false;
      }
    }

    this.currentTool = 'hand';
    this.animTime = 0;
    this.swinging = false;
    this.swingProgress = 0;
    this.hidden = false;

    // Subtle idle sway
    this.baseGroupPos = new THREE.Vector3(0, 0, 0);
    this.swayTime = 0;

    this.setTool('hand');
  }

  setTool(id) {
    if (!this.tools[id] && id !== 'hand') {
      console.warn('No tool model for', id);
      return;
    }
    // Hide all
    for (const t of Object.values(this.tools)) {
      if (t) t.visible = false;
    }
    this.currentTool = id;
    if (this.tools[id]) this.tools[id].visible = true;
    gameState.player.heldItem = id;
  }

  playSwing() {
    this.swinging = true;
    this.swingProgress = 0;
  }

  update(dt, elapsed, moving, running) {
    // ── Idle sway (breathing) ──────────────────────────
    this.swayTime += dt;
    const idleSwayY = Math.sin(this.swayTime * 1.5) * 0.004;
    const idleSwayX = Math.cos(this.swayTime * 1.1) * 0.003;

    // ── Walk bob ───────────────────────────────────────
    let walkBobY = 0, walkBobX = 0, walkBobZ = 0;
    if (moving) {
      const speed = running ? 12 : 8;
      walkBobY = Math.sin(this.swayTime * speed) * (running ? 0.022 : 0.014);
      walkBobX = Math.cos(this.swayTime * speed * 0.5) * (running ? 0.012 : 0.008);
      walkBobZ = Math.sin(this.swayTime * speed * 0.5) * 0.008;
    }

    // ── Tool swing animation ───────────────────────────
    let swingRotX = 0, swingRotZ = 0, swingTransY = 0;
    if (this.swinging) {
      this.swingProgress += dt * 3.2;
      if (this.swingProgress >= 1) {
        this.swinging = false;
        this.swingProgress = 0;
      } else {
        const p = this.swingProgress;
        // Wind up, strike, recover
        if (p < 0.3) {
          const t = p / 0.3;
          swingRotX = t * 0.5;
          swingRotZ = -t * 0.3;
          swingTransY = -t * 0.05;
        } else if (p < 0.55) {
          const t = (p - 0.3) / 0.25;
          swingRotX = 0.5 - t * 1.4;
          swingRotZ = -0.3 + t * 0.6;
          swingTransY = -0.05 + t * 0.1;
        } else {
          const t = (p - 0.55) / 0.45;
          swingRotX = -0.9 + t * 0.9;
          swingRotZ = 0.3 - t * 0.3;
          swingTransY = 0.05 - t * 0.05;
        }
      }
    }

    // ── Apply to held group (right hand) ───────────────
    this.heldGroup.position.set(
      idleSwayX + walkBobX,
      idleSwayY + walkBobY + swingTransY,
      walkBobZ
    );
    this.heldGroup.rotation.x = swingRotX;
    this.heldGroup.rotation.z = swingRotZ;

    // ── Apply to full group (both arms) ────────────────
    this.group.position.set(walkBobX * 0.4, walkBobY * 0.4, 0);
    this.group.rotation.z = idleSwayX * 0.3;

    // ── Hide when menu open ────────────────────────────
    this.group.visible = !this.hidden && gameState.player.handsVisible;
  }

  hide() { this.hidden = true; }
  show() { this.hidden = false; }
}

// ═══════════════════════════════════════════════════════════════
//  ACTION — what to do when player presses "interact"
// ═══════════════════════════════════════════════════════════════
export function performAction(handManager, camera, plantManager, worldInteractables) {
  const player = gameState.player;
  const held = handManager.currentTool;

  // ── 1. Check plants first ─────────────────────────────
  const plant = raycastPlant(camera, plantManager);
  if (plant) {
    if (plant.growth >= 0.98 && held === 'basket') {
      // Harvest
      const result = plant.harvest();
      if (result) {
        player.harvest += result.yield;
        player.coins += result.value;
        HUD.showToast(`Harvested ${result.yield}× ${plant.crop.emoji} ${plant.crop.name} — +${result.value}🪙`);
        Audio.playTone(660, 0.2, 'sine', 0.07);
        setTimeout(() => Audio.playTone(880, 0.25, 'sine', 0.05), 100);
        plantManager.removePlant(plant);
        handManager.playSwing();
        window.dispatchEvent(new CustomEvent('hud-refresh'));
      }
      return;
    }
    if (plant.growth >= 0.98 && held !== 'basket') {
      HUD.showToast(`Equip the basket to harvest`);
      return;
    }
    if (plant.water < 0.4 && held === 'wateringcan') {
      plant.water_();
      handManager.playSwing();
      return;
    }
    if (plant.hasDisease) {
      plant.treat();
      handManager.playSwing();
      return;
    }
    // Show status
    HUD.showToast(plant.getPrompt().replace(/<[^>]*>/g, ''));
    return;
  }

  // ── 2. Check world interactables (shed, stable, house) ─
  if (worldInteractables) {
    const target = raycastInteractable(camera, worldInteractables);
    if (target) {
      handleWorldInteraction(target, handManager);
      return;
    }
  }

  // ── 3. Otherwise — act on ground (till or plant) ──────
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const targetX = camera.position.x + dir.x * 1.5;
  const targetZ = camera.position.z + dir.z * 1.5;
  const targetY = terrainHeight(targetX, targetZ);

  if (held === 'hoe') {
    // Till — just visual + message for now
    HUD.showToast('Tilled the soil 🌱');
    Audio.playTone(180, 0.15, 'triangle', 0.06);
    handManager.playSwing();
    spawnDirtPuff(targetX, targetY, targetZ);
    return;
  }

  if (held && held.startsWith('seed_')) {
    const cropId = held.replace('seed_', '');
    const plant = plantManager.tryPlant(cropId, targetX, targetZ);
    if (plant) {
      handManager.playSwing();
      spawnDirtPuff(targetX, targetY, targetZ);
    }
    return;
  }

  if (held === 'wateringcan') {
    HUD.showToast('Refill the watering can at the trough');
    return;
  }

  // Empty hand — nothing
  HUD.showToast('Nothing here — walk closer to something');
}

// ═══════════════════════════════════════════════════════════════
//  RAYCAST HELPERS
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
raycaster.far = 2.8;

function raycastPlant(camera, plantManager) {
  const plantMeshes = plantManager.getInteractableMeshes();
  if (plantMeshes.length === 0) return null;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObjects(plantMeshes, true);
  if (hits.length > 0) {
    return plantManager.findPlantFromObject(hits[0].object);
  }
  return null;
}

function raycastInteractable(camera, interactables) {
  if (!interactables || interactables.length === 0) return null;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObjects(interactables, true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !obj.userData.interact) obj = obj.parent;
    return obj;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  WORLD INTERACTION (shed jars, trough, hay, bed, etc.)
// ═══════════════════════════════════════════════════════════════
function handleWorldInteraction(target, handManager) {
  const inter = target.userData.interact;
  const player = gameState.player;

  switch (inter.type) {
    case 'take_seed': {
      const seedId = inter.seedId;
      const crop = CROPS[seedId];
      const cost = crop.seedCost;
      if (player.coins < cost) {
        HUD.showToast(`Need ${cost}🪙 for ${crop.name} seeds`);
        return;
      }
      player.coins -= cost;
      player.seeds[seedId] = (player.seeds[seedId] || 0) + 1;
      handManager.setTool('seed_' + seedId);
      Audio.playTone(720, 0.15, 'sine', 0.06);
      HUD.showToast(`Took ${crop.emoji} ${crop.name} seed (${cost}🪙)`);
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    }
    case 'feed_horse': {
      handManager.setTool('hay');
      HUD.showToast('Grabbed hay 🌾');
      Audio.playTone(400, 0.1, 'triangle', 0.05);
      break;
    }
    case 'refill_water': {
      player.water = player.waterMax;
      Audio.playWaterSplash();
      HUD.showToast('Watering can filled 💧');
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    }
    case 'rest': {
      HUD.showToast('You rest a moment…');
      Audio.playTone(440, 0.5, 'sine', 0.04);
      break;
    }
    case 'sleep': {
      gameState.world.timeOfDay = 0.28;
      gameState.world.day++;
      HUD.showToast(`🌅 Day ${gameState.world.day} — rested well`);
      Audio.playTone(523, 0.8, 'sine', 0.05);
      setTimeout(() => Audio.playTone(659, 0.8, 'sine', 0.04), 200);
      setTimeout(() => Audio.playTone(784, 1.0, 'sine', 0.03), 400);
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  DIRT PUFF — small particle effect
// ═══════════════════════════════════════════════════════════════
let dirtParticles = null;
let dirtScene = null;

export function initDirtParticles(scene) {
  dirtScene = scene;
  dirtParticles = [];
  const geo = new THREE.SphereGeometry(0.05, 5, 4);
  for (let i = 0; i < 40; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7a5a3a, transparent: true, opacity: 0,
    });
    const p = new THREE.Mesh(geo, mat);
    p.visible = false;
    p.userData = {
      active: false, life: 0, vel: new THREE.Vector3(),
    };
    scene.add(p);
    dirtParticles.push(p);
  }
}

let dirtCursor = 0;
function spawnDirtPuff(x, y, z) {
  if (!dirtParticles) return;
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
//  WATER STREAM — visual while watering
// ═══════════════════════════════════════════════════════════════
let waterStream = null;

export function initWaterStream(scene) {
  const geo = new THREE.BufferGeometry();
  const count = 60;
  const positions = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x88ddff, size: 0.06, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  waterStream = new THREE.Points(geo, mat);
  waterStream.visible = false;
  scene.add(waterStream);
  waterStream.userData = { active: false, timer: 0, origin: new THREE.Vector3(), dir: new THREE.Vector3() };
}

export function updateWaterStream(dt, camera, active) {
  if (!waterStream) return;
  const data = waterStream.userData;

  if (active) {
    data.active = true;
    data.timer = 0.3;
    data.origin.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    data.origin.addScaledVector(dir, 0.3);
    data.origin.y -= 0.2;
    data.dir.copy(dir);
  }

  if (!data.active) {
    waterStream.visible = false;
    return;
  }

  data.timer -= dt;
  if (data.timer <= 0) {
    data.active = false;
    waterStream.visible = false;
    return;
  }

  waterStream.visible = true;
  const pos = waterStream.geometry.attributes.position.array;
  for (let i = 0; i < 60; i++) {
    const t = (i / 60);
    const spread = 0.08;
    pos[i * 3] = data.origin.x + data.dir.x * (0.2 + t * 1.2) + (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = data.origin.y - t * 0.6 + Math.random() * 0.1;
    pos[i * 3 + 2] = data.origin.z + data.dir.z * (0.2 + t * 1.2) + (Math.random() - 0.5) * spread;
  }
  waterStream.geometry.attributes.position.needsUpdate = true;
}