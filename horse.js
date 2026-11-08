import * as THREE from 'three';
import { gameState, Audio, HUD, terrainHeight, Input } from './engine.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — horse.js
   Realistic horse · mounting · riding · feeding · happiness
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
//  HORSE MATERIALS
// ═══════════════════════════════════════════════════════════════
const HORSE_MAT = {
  // Chestnut coat
  coat: new THREE.MeshStandardMaterial({ color: 0x8a4a28, roughness: 0.85 }),
  coatDark: new THREE.MeshStandardMaterial({ color: 0x5a2a10, roughness: 0.88 }),
  // Black points (mane, tail, hooves, muzzle)
  black: new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.9 }),
  mane: new THREE.MeshStandardMaterial({ color: 0x1a0a05, roughness: 0.92 }),
  // Muzzle (lighter)
  muzzle: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.88 }),
  // Hooves
  hoof: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7 }),
  // Eyes
  eye: new THREE.MeshStandardMaterial({ color: 0x0a0505, roughness: 0.15, metalness: 0.3 }),
  // Saddle
  leather: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.82 }),
  leatherDark: new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa8a8b0, roughness: 0.4, metalness: 0.85 }),
};

// ═══════════════════════════════════════════════════════════════
//  HORSE MODEL — segmented, animated
// ═══════════════════════════════════════════════════════════════
function buildHorseModel() {
  const root = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.3, 8, 16),
    HORSE_MAT.coat
  );
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.35;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Chest — front of body
  const chest = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 12),
    HORSE_MAT.coat
  );
  chest.scale.set(1, 1.05, 0.85);
  chest.position.set(0.85, 1.4, 0);
  chest.castShadow = true;
  root.add(chest);

  // Rump — back of body
  const rump = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 14, 12),
    HORSE_MAT.coat
  );
  rump.scale.set(1, 1.05, 0.9);
  rump.position.set(-0.85, 1.35, 0);
  rump.castShadow = true;
  root.add(rump);

  // ── Neck (animated) ────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(1.1, 1.6, 0);
  root.add(neck);

  const neckMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 6, 10),
    HORSE_MAT.coat
  );
  neckMesh.rotation.z = -0.6;
  neckMesh.position.set(0.25, 0.35, 0);
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  // Mane along neck
  for (let i = 0; i < 8; i++) {
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.2, 0.04),
      HORSE_MAT.mane
    );
    mane.position.set(
      0.05 + i * 0.05,
      0.75 - i * 0.08,
      0
    );
    mane.rotation.z = -0.6 + Math.sin(i) * 0.15;
    neck.add(mane);
  }

  // ── Head (attached to neck) ────────────────────────
  const head = new THREE.Group();
  head.position.set(0.65, 0.65, 0);
  neck.add(head);

  const skull = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.3),
    HORSE_MAT.coat
  );
  skull.castShadow = true;
  head.add(skull);

  // Muzzle (long, narrower)
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.35, 10),
    HORSE_MAT.muzzle
  );
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(0.28, -0.08, 0);
  muzzle.castShadow = true;
  head.add(muzzle);

  // Nostrils
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 5),
      HORSE_MAT.black
    );
    nostril.position.set(0.42, -0.05, side * 0.08);
    nostril.scale.set(1, 0.7, 1);
    head.add(nostril);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      HORSE_MAT.eye
    );
    eye.position.set(0.1, 0.08, side * 0.15);
    head.add(eye);

    // Eyelid
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      HORSE_MAT.coat
    );
    lid.position.copy(eye.position);
    lid.rotation.x = -0.4;
    head.add(lid);
  }

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.18, 6),
      HORSE_MAT.coat
    );
    ear.position.set(-0.1, 0.28, side * 0.11);
    ear.rotation.x = side * 0.15;
    ear.rotation.z = -0.3;
    ear.castShadow = true;
    head.add(ear);

    const earInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.13, 5),
      HORSE_MAT.muzzle
    );
    earInner.position.copy(ear.position);
    earInner.rotation.copy(ear.rotation);
    earInner.position.x += 0.02;
    head.add(earInner);
  }

  // Forelock (hair between ears)
  for (let i = 0; i < 3; i++) {
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.15, 0.06),
      HORSE_MAT.mane
    );
    hair.position.set(-0.05, 0.22, (i - 1) * 0.06);
    hair.rotation.x = 0.2;
    head.add(hair);
  }

  // Halter (rope around muzzle)
  const halterNose = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.015, 6, 20),
    HORSE_MAT.leatherDark
  );
  halterNose.position.set(0.32, -0.05, 0);
  halterNose.rotation.y = Math.PI / 2;
  head.add(halterNose);

  const halterCheek = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.015, 6, 20),
    HORSE_MAT.leatherDark
  );
  halterCheek.position.set(0.05, 0.05, 0);
  halterCheek.rotation.y = Math.PI / 2;
  head.add(halterCheek);

  // ── Legs (animated) ────────────────────────────────
  const legs = {};
  const legPositions = {
    frontLeft: [0.7, 0.85, 0.28],
    frontRight: [0.7, 0.85, -0.28],
    backLeft: [-0.7, 0.85, 0.28],
    backRight: [-0.7, 0.85, -0.28],
  };

  for (const [name, pos] of Object.entries(legPositions)) {
    const legGroup = new THREE.Group();
    legGroup.position.set(...pos);
    root.add(legGroup);

    // Upper leg
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.5, 4, 8),
      HORSE_MAT.coat
    );
    upper.position.y = -0.3;
    upper.castShadow = true;
    legGroup.add(upper);

    // Lower leg (cannon bone)
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.42, 4, 8),
      HORSE_MAT.coatDark
    );
    lower.position.y = -0.85;
    lower.castShadow = true;
    legGroup.add(lower);

    // Hoof
    const hoof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.14, 10),
      HORSE_MAT.hoof
    );
    hoof.position.y = -1.12;
    hoof.castShadow = true;
    legGroup.add(hoof);

    legs[name] = legGroup;
  }

  // ── Tail (animated) ────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(-1.25, 1.4, 0);
  root.add(tail);

  for (let i = 0; i < 6; i++) {
    const hair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 + i * 0.005, 0.05 + i * 0.005, 0.3, 6),
      HORSE_MAT.mane
    );
    hair.position.set(-i * 0.04, -i * 0.12, (Math.random() - 0.5) * 0.03);
    hair.rotation.z = 0.3;
    tail.add(hair);
  }

  // ── Saddle ─────────────────────────────────────────
  const saddle = new THREE.Group();
  saddle.position.set(0, 1.95, 0);

  const saddleSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.12, 0.5),
    HORSE_MAT.leather
  );
  saddleSeat.castShadow = true;
  saddle.add(saddleSeat);

  const saddlePad = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.05, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.9 })
  );
  saddlePad.position.y = -0.08;
  saddlePad.castShadow = true;
  saddle.add(saddlePad);

  const saddleRise = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.5),
    HORSE_MAT.leather
  );
  saddleRise.position.set(-0.25, 0.14, 0);
  saddle.add(saddleRise);

  // Stirrups
  for (const side of [-1, 1]) {
    const stirrupStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.5, 0.02),
      HORSE_MAT.leatherDark
    );
    stirrupStrap.position.set(0, -0.15, side * 0.32);
    saddle.add(stirrupStrap);

    const stirrup = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.012, 6, 12),
      HORSE_MAT.metal
    );
    stirrup.position.set(0, -0.42, side * 0.32);
    saddle.add(stirrup);
  }

  // Reins (thin leather lines from muzzle to saddle)
  for (const side of [-1, 1]) {
    const rein = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4),
      HORSE_MAT.leatherDark
    );
    rein.position.set(0.55, 1.65, side * 0.15);
    rein.rotation.z = 0.3;
    saddle.add(rein);
  }

  root.add(saddle);

  return {
    root, body, chest, rump, neck, head, legs, tail, saddle,
    // Animation state
    state: {
      walkCycle: 0,
      gallopCycle: 0,
      headBob: 0,
      tailSway: 0,
      idleTime: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  HORSE CLASS — logic, movement, riding
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

    // Movement (when not mounted — idle wandering)
    this.velocity = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3(x, 0, z);
    this.wanderTimer = 5 + Math.random() * 10;
    this.homeX = x;
    this.homeZ = z;

    // Riding state
    this.isMounted = false;
    this.riderYaw = 0;
    this.gallopSpeed = 0;
    this.mountProgress = 0;      // 0 = grounded, 1 = fully mounted

    // Happiness affects ride speed
    gameState.horse.happy = Math.max(0.3, gameState.horse.happy || 0.6);

    // Head-down grazing (idle behavior)
    this.isGrazing = false;
    this.grazingTimer = 0;

    // Footstep sound trigger
    this.lastFootstepPhase = 0;

    // Interactable
    this.root.userData.interact = {
      type: 'horse',
      horse: this,
      prompt: '<span class="key">E</span> Mount horse 🐴',
    };

    // Add a floating feeding interaction at the head area (smaller target)
    this.scene.add(this.root);
  }

  setPrompt() {
    const happy = gameState.horse.happy;
    let happyText = 'content';
    if (happy > 0.85) happyText = 'joyful ✨';
    else if (happy > 0.6) happyText = 'content';
    else if (happy > 0.35) happyText = 'restless';
    else happyText = 'sad ☁️';

    if (this.isMounted) {
      this.root.userData.interact.prompt = `🐴 Riding — ${happyText} · <span class="key">E</span> Dismount`;
    } else {
      this.root.userData.interact.prompt = `🐴 ${happyText} · <span class="key">E</span> Mount`;
    }
  }

  update(dt, elapsed, camera) {
    const parts = this.parts;
    const s = parts.state;

    // ── MOUNT TRANSITION ──────────────────────────
    if (this.isMounted && this.mountProgress < 1) {
      this.mountProgress = Math.min(1, this.mountProgress + dt * 2.5);
    } else if (!this.isMounted && this.mountProgress > 0) {
      this.mountProgress = Math.max(0, this.mountProgress - dt * 3);
    }

    // ── RIDING CONTROL ────────────────────────────
    if (this.isMounted) {
      this.handleRiding(dt);
    } else {
      this.handleIdleWander(dt);
    }

    // ── APPLY POSITION ────────────────────────────
    this.root.position.copy(this.position);
    this.root.position.y = terrainHeight(this.position.x, this.position.z);

    // ── BODY LEAN (turning) ───────────────────────
    const targetRotationY = this.rotation;
    this.root.rotation.y = targetRotationY;

    // ── ANIMATIONS ────────────────────────────────
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);

    if (this.isMounted && (Input.keys['KeyW'] || Input.keys['ArrowUp'] || this.gallopSpeed > 0.1)) {
      // Riding animation
      s.gallopCycle += dt * (6 + speed * 0.8);
      const gallopAmp = Math.min(1, speed / 8);
      this.animateGallop(s, gallopAmp);
    } else if (speed > 0.1) {
      // Wandering walk animation
      s.walkCycle += dt * (5 + speed);
      this.animateWalk(s, speed);
    } else if (this.isGrazing) {
      // Grazing
      this.animateGraze(s, dt);
    } else {
      // Idle
      this.animateIdle(s, dt);
    }

    // ── TAIL SWAY ─────────────────────────────────
    s.tailSway += dt * (1 + speed * 0.2);
    for (let i = 0; i < parts.tail.children.length; i++) {
      const hair = parts.tail.children[i];
      hair.rotation.z = Math.sin(s.tailSway + i * 0.3) * 0.1 + 0.3;
      hair.rotation.x = Math.cos(s.tailSway * 0.7 + i * 0.2) * 0.08;
    }

    // ── HAPPINESS DECAY ───────────────────────────
    gameState.horse.happy = Math.max(0, gameState.horse.happy - dt * 0.0003);

    // Update prompt
    this.setPrompt();
  }

  animateGallop(s, amp) {
    const parts = this.parts;
    const cycle = s.gallopCycle;

    // Legs alternate in gallop pattern (simplified canter)
    const legPhases = {
      frontLeft: 0,
      frontRight: Math.PI * 0.5,
      backLeft: Math.PI * 1.2,
      backRight: Math.PI * 1.7,
    };

    for (const [name, legGroup] of Object.entries(parts.legs)) {
      const phase = cycle + legPhases[name];
      const lift = Math.sin(phase);
      const swing = Math.cos(phase);

      legGroup.rotation.x = swing * 0.5 * amp;
      legGroup.position.y = 0.85 + Math.max(0, lift) * 0.15 * amp;
    }

    // Body bob (gallop)
    const bodyBob = Math.abs(Math.sin(cycle * 2)) * 0.08 * amp;
    parts.body.position.y = 1.35 + bodyBob;
    parts.chest.position.y = 1.4 + bodyBob * 0.8;
    parts.rump.position.y = 1.35 + bodyBob * 1.2;

    // Head nod
    parts.head.rotation.x = Math.sin(cycle) * 0.12 * amp;

    // Footstep sound (when hoof hits ground)
    const footstepPhase = Math.floor((cycle / Math.PI)) % 4;
    if (footstepPhase !== this.lastFootstepPhase) {
      this.lastFootstepPhase = footstepPhase;
      if (Math.random() < 0.7) {
        Audio.playTone(80 + Math.random() * 30, 0.12, 'triangle', 0.08);
      }
    }
  }

  animateWalk(s, speed) {
    const parts = this.parts;
    const cycle = s.walkCycle;
    const amp = Math.min(1, speed / 3);

    // Walking gait — 4-beat
    for (const [name, legGroup] of Object.entries(parts.legs)) {
      const offset = name === 'frontLeft' ? 0 : name === 'backRight' ? Math.PI : name === 'frontRight' ? Math.PI / 2 : Math.PI * 1.5;
      const phase = cycle + offset;
      legGroup.rotation.x = Math.sin(phase) * 0.35 * amp;
      legGroup.position.y = 0.85 + Math.max(0, Math.sin(phase)) * 0.06 * amp;
    }

    // Subtle head bob
    parts.head.rotation.x = Math.sin(cycle * 2) * 0.05 * amp;
  }

  animateIdle(s, dt) {
    const parts = this.parts;
    s.idleTime += dt;

    // Breathing
    const breath = Math.sin(s.idleTime * 1.4) * 0.02;
    parts.chest.scale.set(1 + breath, 1 + breath * 0.5, 1 + breath);

    // Head look around
    parts.head.rotation.x = Math.sin(s.idleTime * 0.5) * 0.05;
    parts.head.rotation.y = Math.sin(s.idleTime * 0.3) * 0.15;

    // Ear twitches
    if (Math.random() < dt * 0.5) {
      parts.head.children.forEach(child => {
        if (child.geometry?.type === 'ConeGeometry') {
          child.rotation.z += (Math.random() - 0.5) * 0.3;
        }
      });
    }

    // Legs return to rest
    for (const legGroup of Object.values(parts.legs)) {
      legGroup.rotation.x *= 0.95;
      legGroup.position.y = 0.85;
    }
  }

  animateGraze(s, dt) {
    const parts = this.parts;
    s.idleTime += dt;

    // Head down to ground
    const grazeTarget = 0.9;
    parts.head.rotation.x += (grazeTarget - parts.head.rotation.x) * dt * 2;

    // Subtle chomping
    parts.neck.rotation.z = Math.sin(s.idleTime * 8) * 0.03;
  }

  handleIdleWander(dt) {
    // Grazing behavior
    this.grazingTimer -= dt;
    if (this.grazingTimer <= 0) {
      this.isGrazing = !this.isGrazing;
      this.grazingTimer = this.isGrazing ? 3 + Math.random() * 5 : 2 + Math.random() * 4;
      if (this.isGrazing) {
        this.wanderTimer = 999;
      } else {
        this.wanderTimer = 1 + Math.random() * 3;
      }
    }

    // Wander timer
    if (!this.isGrazing) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        // Pick new target
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 6;
        this.targetPosition.set(
          this.homeX + Math.cos(angle) * dist,
          0,
          this.homeZ + Math.sin(angle) * dist
        );
        this.wanderTimer = 4 + Math.random() * 6;
      }

      // Move toward target
      const dx = this.targetPosition.x - this.position.x;
      const dz = this.targetPosition.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.4) {
        const speed = 0.9;
        this.velocity.x = (dx / dist) * speed;
        this.velocity.z = (dz / dist) * speed;
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.rotation = lerpAngle(this.rotation, Math.atan2(dx, dz), dt * 3);
      } else {
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
      }
    } else {
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
    }
  }

  handleRiding(dt) {
    // Riding controls — W/S throttle, A/D steer, Shift gallop
    let throttle = 0;
    let steer = 0;
    let gallop = false;

    if (Input.keys['KeyW'] || Input.keys['ArrowUp']) throttle += 1;
    if (Input.keys['KeyS'] || Input.keys['ArrowDown']) throttle -= 1;
    if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) steer += 1;
    if (Input.keys['KeyD'] || Input.keys['ArrowRight']) steer -= 1;
    if (Input.keys['ShiftLeft'] || Input.keys['ShiftRight']) gallop = true;

    // Joystick for touch
    if (Input.touch.joystick.active) {
      const jy = Input.touch.joystick.y;
      const jx = Input.touch.joystick.x;
      throttle = -jy; // up = forward
      steer = -jx;
      if (Math.hypot(jx, jy) > 0.85) gallop = true;
    }

    // Speed
    const happy = gameState.horse.happy;
    const maxSpeed = (gallop ? 10 : 5) * (0.7 + happy * 0.5);
    const targetSpeed = Math.max(0, throttle) * maxSpeed + (throttle < 0 ? throttle * 3 : 0);

    // Smooth speed
    this.gallopSpeed += (targetSpeed - this.gallopSpeed) * dt * 3;
    this.gallopSpeed = Math.max(-3, Math.min(maxSpeed, this.gallopSpeed));

    // Steering — faster turn at lower speed
    const turnRate = 1.8 - Math.abs(this.gallopSpeed) * 0.1;
    this.rotation += steer * turnRate * dt * Math.sign(throttle >= 0 ? 1 : -1);

    // Move forward
    const forwardX = Math.sin(this.rotation);
    const forwardZ = Math.cos(this.rotation);
    this.velocity.x = forwardX * this.gallopSpeed;
    this.velocity.z = forwardZ * this.gallopSpeed;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Update camera to follow horse
    // Player rides at saddle position
    const saddleHeight = 2.3;
    const playerPos = gameState.player.position;
    playerPos.x = this.position.x + Math.sin(this.rotation) * 0.15;
    playerPos.z = this.position.z + Math.cos(this.rotation) * 0.15;
    playerPos.y = terrainHeight(this.position.x, this.position.z) + saddleHeight;

    // Sync player yaw with horse rotation when moving
    if (Math.abs(this.gallopSpeed) > 0.3) {
      gameState.player.yaw = this.rotation;
    }

    // Wider FOV when galloping
    const fovTarget = gameState.camera.baseFOV + (gallop && this.gallopSpeed > 3 ? 8 : 0);
    gameState.camera.currentFOV += (fovTarget - gameState.camera.currentFOV) * dt * 3;

    // Footstep sounds
    const cycle = this.parts.state.gallopCycle;
    const footstepPhase = Math.floor((cycle / Math.PI)) % 4;
    if (footstepPhase !== this.lastFootstepPhase) {
      this.lastFootstepPhase = footstepPhase;
      if (Math.abs(this.gallopSpeed) > 0.5) {
        Audio.playTone(60 + Math.random() * 40, 0.15, 'triangle', 0.1);
      }
    }
  }

  mount() {
    if (this.isMounted) return;
    this.isMounted = true;
    this.mountProgress = 0;
    gameState.horse.mounted = true;
    this.gallopSpeed = 0;

    // Camera switches to horse view
    gameState.camera.baseFOV = 68;

    Audio.playTone(440, 0.2, 'triangle', 0.06);
    HUD.showToast('Mounted — use WASD to ride 🐴');

    // Player position tracks horse
    gameState.player.position.set(
      this.position.x,
      terrainHeight(this.position.x, this.position.z) + 2.3,
      this.position.z
    );
  }

  dismount() {
    if (!this.isMounted) return;
    this.isMounted = false;
    gameState.horse.mounted = false;
    this.gallopSpeed = 0;

    // Player dismounts to the side
    const sideX = Math.cos(this.rotation) * 1.5;
    const sideZ = -Math.sin(this.rotation) * 1.5;
    gameState.player.position.set(
      this.position.x + sideX,
      terrainHeight(this.position.x + sideX, this.position.z + sideZ),
      this.position.z + sideZ
    );

    gameState.camera.baseFOV = 65;

    Audio.playTone(320, 0.15, 'triangle', 0.05);
    HUD.showToast('Dismounted');
  }

  feed() {
    gameState.horse.happy = Math.min(1, gameState.horse.happy + 0.3);
    Audio.playTone(520, 0.15, 'sine', 0.05);
    setTimeout(() => Audio.playTone(660, 0.2, 'sine', 0.04), 100);
    HUD.showToast('🐴 The horse nuzzles you — happiness up!');

    // Nuzzle animation
    this.parts.head.rotation.x = -0.4;
    setTimeout(() => { this.parts.head.rotation.x = 0; }, 800);
  }

  getInteractable() {
    return this.root;
  }
}

// ═══════════════════════════════════════════════════════════════
//  UTIL
// ═══════════════════════════════════════════════════════════════
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ═══════════════════════════════════════════════════════════════
//  HORSE MANAGER — wraps horse creation and update
// ═══════════════════════════════════════════════════════════════
export class HorseManager {
  constructor(scene, x, z) {
    this.horse = new Horse(scene, x, z);
    this.scene = scene;
    // Pre-cache the horse's interactable
    this.interactable = this.horse.getInteractable();
  }

  update(dt, elapsed, camera) {
    this.horse.update(dt, elapsed, camera);
  }

  handleInteract() {
    if (this.horse.isMounted) {
      this.horse.dismount();
    } else if (gameState.player.heldItem === 'hay') {
      this.horse.feed();
      gameState.player.heldItem = 'hand';
      // Switch back to hands
      if (window.__handManager) window.__handManager.setTool('hand');
    } else {
      this.horse.mount();
    }
  }

  getInteractable() {
    return this.interactable;
  }
}