// ═══════════════════════════════════════════════════════════════
//  horse.js — v2
//  Replaces: horse.js (old)
//
//  Fixes vs old:
//  • Real horse proportions (chest, withers, barrel, croup)
//  • Hooves track the ground (no floating)
//  • Gait phase tied to speed (no skating)
//  • Proper head/neck/mane/tail
//  • Uses shared MATS from materials.js
//  • Mounted camera positioned at saddle correctly
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { MATS } from './materials.js';
import { terrainHeight } from './terrain.js';
import { Input } from './engine.js';

// ═══════════════════════════════════════════════════════════════
//  HORSE MODEL — proper anatomy
// ═══════════════════════════════════════════════════════════════
function buildHorseModel() {
  const root = new THREE.Group();

  // ── Body — segmented (chest, barrel, rump) ────────────
  const body = new THREE.Group();
  body.position.y = 1.35;
  root.add(body);

  // Barrel (mid-body) — elongated
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16),
    MATS.horseCoat
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  body.add(barrel);

  // Chest — front, wider
  const chest = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 14, 10),
    MATS.horseCoat
  );
  chest.scale.set(0.9, 1.05, 0.85);
  chest.position.set(0.75, 0.05, 0);
  chest.castShadow = true;
  body.add(chest);

  // Withers — shoulder hump
  const withers = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    MATS.horseCoat
  );
  withers.scale.set(1.2, 0.7, 0.9);
  withers.position.set(0.55, 0.38, 0);
  withers.castShadow = true;
  body.add(withers);

  // Rump — back, rounded
  const rump = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 10),
    MATS.horseCoat
  );
  rump.scale.set(0.95, 1.0, 0.9);
  rump.position.set(-0.7, 0.02, 0);
  rump.castShadow = true;
  body.add(rump);

  // ── Neck (animated) ───────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(1.0, 0.15, 0);
  body.add(neck);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 0.8, 12),
    MATS.horseCoat
  );
  neckMesh.rotation.z = -0.7;
  neckMesh.position.set(0.25, 0.3, 0);
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  // Mane — flowing down the neck
  const maneGroup = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.18, 0.04),
      MATS.horseMane
    );
    mane.position.set(
      0.05 + i * 0.06,
      0.55 - i * 0.07,
      0
    );
    mane.rotation.z = -0.7 + Math.sin(i) * 0.15;
    maneGroup.add(mane);
  }
  neck.add(maneGroup);

  // ── Head ─────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0.65, 0.55, 0);
  neck.add(head);

  // Skull
  const skull = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.32, 0.28),
    MATS.horseCoat
  );
  skull.castShadow = true;
  head.add(skull);

  // Muzzle — tapered
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.13, 0.28, 10),
    MATS.horseMuzzle
  );
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(0.22, -0.08, 0);
  muzzle.castShadow = true;
  head.add(muzzle);

  // Nostrils
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 5),
      MATS.horseBlack
    );
    nostril.position.set(0.34, -0.06, side * 0.06);
    nostril.scale.set(1, 0.7, 1);
    head.add(nostril);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      MATS.horseEye
    );
    eye.position.set(0.06, 0.07, side * 0.13);
    head.add(eye);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      MATS.horseCoat
    );
    lid.position.copy(eye.position);
    lid.rotation.x = -0.4;
    head.add(lid);
  }

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 6),
      MATS.horseCoat
    );
    ear.position.set(-0.08, 0.25, side * 0.09);
    ear.rotation.x = side * 0.15;
    ear.rotation.z = -0.3;
    ear.castShadow = true;
    head.add(ear);
  }

  // Forelock
  for (let i = 0; i < 4; i++) {
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.13, 0.05),
      MATS.horseMane
    );
    hair.position.set(-0.03, 0.19, (i - 1.5) * 0.05);
    hair.rotation.x = 0.15;
    head.add(hair);
  }

  // ── Legs (4, animated) ───────────────────────────────
  const legs = {};
  const legData = {
    frontLeft:  { x: 0.55, z: 0.22, isFront: true },
    frontRight: { x: 0.55, z: -0.22, isFront: true },
    backLeft:   { x: -0.6, z: 0.22, isFront: false },
    backRight:  { x: -0.6, z: -0.22, isFront: false },
  };

  for (const [name, data] of Object.entries(legData)) {
    const legGroup = new THREE.Group();
    legGroup.position.set(data.x, 1.2, data.z);
    root.add(legGroup);

    // Upper leg (thigh)
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.35, 4, 8),
      MATS.horseCoat
    );
    upper.position.y = -0.2;
    upper.castShadow = true;
    legGroup.add(upper);

    // Knee/hock joint
    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      MATS.horseCoat
    );
    knee.position.y = -0.45;
    legGroup.add(knee);

    // Lower leg (cannon) — darker
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, 0.35, 4, 8),
      MATS.horseCoatDark
    );
    lower.position.y = -0.7;
    lower.castShadow = true;
    legGroup.add(lower);

    // Fetlock
    const fetlock = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      MATS.horseCoatDark
    );
    fetlock.position.y = -0.9;
    legGroup.add(fetlock);

    // Hoof
    const hoof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10),
      MATS.horseHoof
    );
    hoof.position.y = -1.0;
    hoof.castShadow = true;
    legGroup.add(hoof);

    legs[name] = {
      group: legGroup,
      upper, knee, lower, fetlock, hoof,
      isFront: data.isFront,
      baseX: data.x,
      baseZ: data.z,
    };
  }

  // ── Tail ─────────────────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(-1.1, 1.45, 0);
  root.add(tail);

  for (let i = 0; i < 8; i++) {
    const hair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 + i * 0.004, 0.04 + i * 0.004, 0.25, 6),
      MATS.horseMane
    );
    hair.position.set(-i * 0.03, -i * 0.10, (Math.random() - 0.5) * 0.03);
    hair.rotation.z = 0.3;
    tail.add(hair);
  }

  // ── Saddle ───────────────────────────────────────────
  const saddle = new THREE.Group();
  saddle.position.set(0, 0.42, 0);
  body.add(saddle);

  const saddleSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.10, 0.42),
    MATS.leather
  );
  saddleSeat.castShadow = true;
  saddle.add(saddleSeat);

  const saddlePad = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.04, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.9 })
  );
  saddlePad.position.y = -0.06;
  saddlePad.castShadow = true;
  saddle.add(saddlePad);

  // Stirrups
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.45, 0.015),
      MATS.leatherDark
    );
    strap.position.set(0, -0.2, side * 0.26);
    saddle.add(strap);

    const stirrup = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.01, 6, 10),
      MATS.iron
    );
    stirrup.position.set(0, -0.44, side * 0.26);
    saddle.add(stirrup);
  }

  // Reins
  for (const side of [-1, 1]) {
    const rein = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4),
      MATS.leatherDark
    );
    rein.position.set(0.5, 0.35, side * 0.12);
    rein.rotation.z = 0.4;
    saddle.add(rein);
  }

  // ── Animation state ──────────────────────────────────
  const state = {
    walkPhase: 0,
    gallopPhase: 0,
    headBob: 0,
    tailSway: 0,
    idleTime: 0,
    isGrazing: false,
    grazingTimer: 0,
    lastFootstepPhase: 0,
  };

  return {
    root, body, chest, barrel, rump, neck, head, legs, tail, saddle,
    state,
  };
}

// ═══════════════════════════════════════════════════════════════
//  HORSE CLASS
// ═══════════════════════════════════════════════════════════════
export class Horse {
  constructor(scene, x, z) {
    this.scene = scene;
    this.parts = buildHorseModel();
    this.root = this.parts.root;

    this.position = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.root.position.copy(this.position);
    this.rotation = Math.random() * Math.PI * 2;
    this.root.rotation.y = this.rotation;

    this.velocity = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3(x, 0, z);
    this.wanderTimer = 5 + Math.random() * 10;
    this.homeX = x;
    this.homeZ = z;

    this.isMounted = false;
    this.speed = 0;
    this.maxSpeed = 8;

    this.root.userData.interact = {
      type: 'horse',
      horse: this,
      prompt: '<span class="key">E</span> Mount horse 🐴',
    };

    scene.add(this.root);
  }

  update(dt, elapsed, _camera) {
    const parts = this.parts;
    const s = parts.state;

    if (this.isMounted) {
      this.handleRiding(dt);
    } else {
      this.handleIdleWander(dt, s);
    }

    // Apply position + terrain follow
    this.root.position.set(
      this.position.x,
      terrainHeight(this.position.x, this.position.z),
      this.position.z
    );
    this.root.rotation.y = this.rotation;

    // Animate
    const speedAbs = Math.abs(this.speed);
    if (speedAbs > 0.1) {
      this.animateGait(s, speedAbs, dt);
    } else if (s.isGrazing) {
      this.animateGraze(s, dt);
    } else {
      this.animateIdle(s, dt);
    }

    // Tail sway
    s.tailSway += dt * (1 + speedAbs * 0.2);
    for (let i = 0; i < parts.tail.children.length; i++) {
      const hair = parts.tail.children[i];
      hair.rotation.z = Math.sin(s.tailSway + i * 0.3) * 0.1 + 0.3;
      hair.rotation.x = Math.cos(s.tailSway * 0.7 + i * 0.2) * 0.08;
    }

    // Update prompt
    const happy = window.__gameState?.horse?.happy ?? 0.65;
    const happyText = happy > 0.85 ? 'joyful ✨' : happy > 0.6 ? 'content' : happy > 0.35 ? 'restless' : 'sad ☁️';
    this.root.userData.interact.prompt = this.isMounted
      ? `🐴 Riding — ${happyText} · <span class="key">E</span> Dismount`
      : `🐴 ${happyText} · <span class="key">E</span> Mount`;
  }

  animateGait(s, speed, dt) {
    const parts = this.parts;
    const isGallop = speed > 3.5;
    const cycleLen = isGallop ? 1.6 : 1.0;

    s.walkPhase += dt * (speed / cycleLen) * Math.PI * 2;
    const phase = s.walkPhase;
    const amp = Math.min(1, speed / this.maxSpeed);

    // Leg phases: walk = 4-beat, gallop = rotary
    const phases = isGallop
      ? { frontLeft: 0, frontRight: 0.3, backLeft: 0.6, backRight: 0.9 }
      : { frontLeft: 0, backRight: 0.25, frontRight: 0.5, backLeft: 0.75 };

    for (const [name, leg] of Object.entries(parts.legs)) {
      const p = (phase + phases[name] * Math.PI * 2);
      const lift = Math.sin(p);
      const swing = Math.cos(p);

      leg.group.rotation.x = swing * 0.5 * amp;
      leg.group.position.y = 1.2 + Math.max(0, lift) * 0.12 * amp;
    }

    // Body bob (2x frequency)
    const bodyBob = Math.abs(Math.sin(phase * 2)) * 0.05 * amp;
    parts.body.position.y = 1.35 + bodyBob;

    // Head nod
    parts.head.rotation.x = Math.sin(phase) * 0.1 * amp;

    // Footstep sound
    const phaseStep = Math.floor(phase / Math.PI) % 4;
    if (phaseStep !== s.lastFootstepPhase) {
      s.lastFootstepPhase = phaseStep;
      if (Math.random() < 0.6) {
        window.__Audio?.tone?.(80 + Math.random() * 30, 0.12, 'triangle', 0.08);
      }
    }
  }

  animateIdle(s, dt) {
    const parts = this.parts;
    s.idleTime += dt;

    // Breathing
    const breath = Math.sin(s.idleTime * 1.4) * 0.015;
    parts.chest.scale.set(1 + breath, 1 + breath * 0.5, 1 + breath);

    // Head look
    parts.head.rotation.y = Math.sin(s.idleTime * 0.3) * 0.12;
    parts.head.rotation.x = Math.sin(s.idleTime * 0.5) * 0.04;

    // Legs return to rest
    for (const leg of Object.values(parts.legs)) {
      leg.group.rotation.x *= 0.95;
      leg.group.position.y = 1.2;
    }
    parts.body.position.y = 1.35;
  }

  animateGraze(s, dt) {
    const parts = this.parts;
    s.idleTime += dt;
    parts.head.rotation.x += (1.0 - parts.head.rotation.x) * dt * 2;
    parts.neck.rotation.z = Math.sin(s.idleTime * 8) * 0.02;
  }

  handleIdleWander(dt, s) {
    s.grazingTimer -= dt;
    if (s.grazingTimer <= 0) {
      s.isGrazing = !s.isGrazing;
      s.grazingTimer = s.isGrazing ? 3 + Math.random() * 5 : 2 + Math.random() * 4;
      if (s.isGrazing) this.wanderTimer = 999;
      else this.wanderTimer = 1 + Math.random() * 3;
    }

    if (!s.isGrazing) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        const d = 2 + Math.random() * 4;
        this.targetPosition.set(this.homeX + Math.cos(a) * d, 0, this.homeZ + Math.sin(a) * d);
        this.wanderTimer = 3 + Math.random() * 5;
      }

      const dx = this.targetPosition.x - this.position.x;
      const dz = this.targetPosition.z - this.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.4) {
        const spd = 0.6;
        this.velocity.x = (dx / dist) * spd;
        this.velocity.z = (dz / dist) * spd;
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.rotation = lerpAngle(this.rotation, Math.atan2(dx, dz), dt * 2);
        this.speed = 0.6;
      } else {
        this.speed = 0;
      }
    } else {
      this.speed = 0;
    }
  }

  handleRiding(dt) {
    let throttle = 0, steer = 0, gallop = false;

    if (Input.keys['KeyW'] || Input.keys['ArrowUp']) throttle += 1;
    if (Input.keys['KeyS'] || Input.keys['ArrowDown']) throttle -= 1;
    if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) steer += 1;
    if (Input.keys['KeyD'] || Input.keys['ArrowRight']) steer -= 1;
    if (Input.keys['ShiftLeft'] || Input.keys['ShiftRight']) gallop = true;

    if (Input.touch.joystick.active) {
      throttle = -Input.touch.joystick.y;
      steer = -Input.touch.joystick.x;
      if (Math.hypot(Input.touch.joystick.x, Input.touch.joystick.y) > 0.85) gallop = true;
    }

    const happy = window.__gameState?.horse?.happy ?? 0.65;
    const targetMax = (gallop ? 8 : 4) * (0.7 + happy * 0.5);
    const targetSpeed = Math.max(0, throttle) * targetMax;

    this.speed += (targetSpeed - this.speed) * dt * 3;
    this.speed = Math.max(-2, Math.min(targetMax, this.speed));

    this.rotation += steer * (1.6 - Math.abs(this.speed) * 0.08) * dt;

    const forwardX = Math.sin(this.rotation);
    const forwardZ = Math.cos(this.rotation);
    this.velocity.x = forwardX * this.speed;
    this.velocity.z = forwardZ * this.speed;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Sync player position (rider)
    const gs = window.__gameState;
    if (gs) {
      gs.player.position.set(
        this.position.x + Math.sin(this.rotation) * 0.15,
        terrainHeight(this.position.x, this.position.z) + 2.3,
        this.position.z + Math.cos(this.rotation) * 0.15
      );
      if (Math.abs(this.speed) > 0.3) gs.player.yaw = this.rotation;
    }
  }

  mount() {
    if (this.isMounted) return;
    this.isMounted = true;
    this.speed = 0;
    if (window.__gameState) window.__gameState.horse.mounted = true;
    window.__Audio?.tone?.(440, 0.2, 'triangle', 0.06);
    window.__HUD?.toast?.('Mounted — WASD to ride 🐴');
  }

  dismount() {
    if (!this.isMounted) return;
    this.isMounted = false;
    this.speed = 0;
    if (window.__gameState) window.__gameState.horse.mounted = false;

    const sideX = Math.cos(this.rotation) * 1.5;
    const sideZ = -Math.sin(this.rotation) * 1.5;
    if (window.__gameState) {
      window.__gameState.player.position.set(
        this.position.x + sideX,
        terrainHeight(this.position.x + sideX, this.position.z + sideZ),
        this.position.z + sideZ
      );
    }
    window.__Audio?.tone?.(320, 0.15, 'triangle', 0.05);
    window.__HUD?.toast?.('Dismounted');
  }

  feed() {
    if (window.__gameState) {
      window.__gameState.horse.happy = Math.min(1, window.__gameState.horse.happy + 0.3);
    }
    window.__Audio?.tone?.(520, 0.15, 'sine', 0.05);
    setTimeout(() => window.__Audio?.tone?.(660, 0.2, 'sine', 0.04), 100);
    window.__HUD?.toast?.('🐴 The horse nuzzles you — happiness up!');
    this.parts.head.rotation.x = -0.4;
    setTimeout(() => { this.parts.head.rotation.x = 0; }, 800);
  }

  getInteractable() { return this.root; }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ═══════════════════════════════════════════════════════════════
//  HORSE MANAGER
// ═══════════════════════════════════════════════════════════════
export class HorseManager {
  constructor(scene, x, z) {
    this.horse = new Horse(scene, x, z);
    this.scene = scene;
    this.interactable = this.horse.getInteractable();
  }
  update(dt, elapsed, camera) { this.horse.update(dt, elapsed, camera); }
  handleInteract() {
    if (this.horse.isMounted) {
      this.horse.dismount();
    } else if (window.__gameState?.player?.heldItem === 'hay') {
      this.horse.feed();
      if (window.__gameState) window.__gameState.player.heldItem = 'hand';
    } else {
      this.horse.mount();
    }
  }
  getInteractable() { return this.interactable; }
}
