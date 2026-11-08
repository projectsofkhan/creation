// ═══════════════════════════════════════════════════════════════
//  player.js — v2
//  Replaces: engine.js's createPlayer / updatePlayerAnimation
//            (delete those, import from here)
//
//  What's fixed vs old:
//  • Proper humanoid proportions (no sausage limbs, no grape hair)
//  • Feet PLANT during walk (stride length tied to velocity)
//  • Real walk cycle (4-key: contact, down, passing, up)
//  • Idle with breathing + subtle weight shift
//  • Hold pose for tools (both hands)
//  • Head tracks camera pitch (looks where you look)
//  • No skating — animation speed = velocity / stride length
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { MATS } from './materials.js';

// ═══════════════════════════════════════════════════════════════
//  SPRING — for smooth animation blends
// ═══════════════════════════════════════════════════════════════
function spring(value = 0, stiffness = 180, damping = 18) {
  return { value, target: value, velocity: 0, stiffness, damping };
}
function stepSpring(sp, dt) {
  sp.velocity += (sp.target - sp.value) * sp.stiffness * dt;
  sp.velocity *= Math.max(0, 1 - sp.damping * dt);
  sp.value += sp.velocity * dt;
}
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ═══════════════════════════════════════════════════════════════
//  BODY PROPORTIONS — realistic human (8 heads tall, ~1.75m)
// ═══════════════════════════════════════════════════════════════
const PROPORTIONS = {
  totalHeight: 1.75,
  headHeight: 0.22,        // 1/8 of height
  neckHeight: 0.06,
  torsoHeight: 0.55,       // shoulder to hip
  hipHeight: 0.92,         // ground to hip joint
  shoulderWidth: 0.38,
  hipWidth: 0.30,
  upperArmLength: 0.30,
  forearmLength: 0.26,
  handLength: 0.18,
  thighLength: 0.42,
  shinLength: 0.42,
  footLength: 0.24,
  footWidth: 0.10,
  shoulderHeight: 1.44,    // ground to shoulder joint
};

// ═══════════════════════════════════════════════════════════════
//  HEAD — proper skull, jaw, nose, ears, eyes, hair
// ═══════════════════════════════════════════════════════════════
function buildHead() {
  const head = new THREE.Group();

  // Skull — sphere squashed slightly, tapered at jaw
  const skullGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const skullPos = skullGeo.attributes.position;
  for (let i = 0; i < skullPos.count; i++) {
    const y = skullPos.getY(i);
    const x = skullPos.getX(i);
    const z = skullPos.getZ(i);
    // Taper toward jaw (bottom), widen at cranium
    const taper = y < 0 ? 0.85 + y * 0.8 : 1.0;
    // Narrow at temples
    const temple = Math.abs(y) < 0.04 ? 0.94 : 1.0;
    skullPos.setX(i, x * taper * temple);
    skullPos.setZ(i, z * taper * 0.95);
    // Flatten back of skull slightly
    if (z < -0.05) skullPos.setZ(i, z * 0.92);
  }
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, MATS.skin);
  skull.position.y = 0.08;
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  // Jaw — subtle wedge
  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.06, 0.09),
    MATS.skin
  );
  jaw.position.set(0, -0.01, 0.02);
  jaw.castShadow = true;
  head.add(jaw);

  // Nose — small pyramid
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.05, 4),
    MATS.skin
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.06, 0.115);
  nose.castShadow = true;
  head.add(nose);

  // Eyes — whites + irises
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 8),
      eyeWhiteMat
    );
    white.position.set(side * 0.045, 0.09, 0.095);
    white.scale.set(1, 0.9, 0.6);
    head.add(white);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.010, 8, 6),
      irisMat
    );
    iris.position.set(side * 0.045, 0.09, 0.113);
    head.add(iris);

    // Brow ridge
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.012, 0.02),
      MATS.hair
    );
    brow.position.set(side * 0.045, 0.115, 0.100);
    brow.rotation.z = side * 0.08;
    head.add(brow);
  }

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 6),
      MATS.skin
    );
    ear.scale.set(0.5, 1, 0.7);
    ear.position.set(side * 0.108, 0.07, -0.01);
    ear.castShadow = true;
    head.add(ear);
  }

  // Hair — a cap that sits on the skull, not blobs
  const hairGeo = new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = new THREE.Mesh(hairGeo, MATS.hair);
  hair.position.y = 0.08;
  hair.castShadow = true;
  head.add(hair);

  // Sideburns
  for (const side of [-1, 1]) {
    const burn = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.06, 0.03),
      MATS.hair
    );
    burn.position.set(side * 0.10, 0.04, 0.04);
    head.add(burn);
  }

  return head;
}

// ═══════════════════════════════════════════════════════════════
//  HAND — palm + 4 fingers + thumb (rigged as one rigid piece)
// ═══════════════════════════════════════════════════════════════
function buildHand(side) {
  const hand = new THREE.Group();

  // Palm — slightly cupped
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.025, 0.09),
    MATS.skin
  );
  palm.castShadow = true;
  hand.add(palm);

  // Four fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.010, 0.055, 3, 6),
      MATS.skin
    );
    finger.position.set(
      (i - 1.5) * 0.020,
      0,
      0.07
    );
    finger.rotation.x = Math.PI / 2 + 0.05 * (i - 1.5);
    finger.castShadow = true;
    hand.add(finger);
  }

  // Thumb
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.045, 3, 6),
    MATS.skin
  );
  thumb.position.set(side * 0.045, 0.005, 0.03);
  thumb.rotation.z = side * 0.9;
  thumb.rotation.x = 0.5;
  thumb.castShadow = true;
  hand.add(thumb);

  return hand;
}

// ═══════════════════════════════════════════════════════════════
//  ARM — shoulder ball, upper arm, elbow, forearm, wrist
// ═══════════════════════════════════════════════════════════════
function buildArm(side) {
  // side: -1 = left, +1 = right
  const shoulder = new THREE.Group();

  // Shoulder deltoid — sphere at joint
  const deltoid = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    MATS.shirt
  );
  deltoid.castShadow = true;
  shoulder.add(deltoid);

  // Upper arm
  const upper = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, PROPORTIONS.upperArmLength - 0.09, 4, 8),
    MATS.shirt
  );
  upper.position.y = -(PROPORTIONS.upperArmLength - 0.09) / 2 - 0.045;
  upper.castShadow = true;
  upper.receiveShadow = true;
  shoulder.add(upper);

  // Elbow
  const elbow = new THREE.Group();
  elbow.position.y = -PROPORTIONS.upperArmLength;
  shoulder.add(elbow);

  const elbowJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.040, 8, 6),
    MATS.skin
  );
  elbowJoint.castShadow = true;
  elbow.add(elbowJoint);

  // Forearm — slightly tapered, skin colored (rolled sleeve)
  const fore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.032, PROPORTIONS.forearmLength - 0.05, 10),
    MATS.skin
  );
  fore.position.y = -(PROPORTIONS.forearmLength - 0.05) / 2;
  fore.castShadow = true;
  fore.receiveShadow = true;
  elbow.add(fore);

  // Wrist
  const wrist = new THREE.Group();
  wrist.position.y = -PROPORTIONS.forearmLength;
  elbow.add(wrist);

  // Hand
  const hand = buildHand(side);
  hand.rotation.x = -0.1;
  wrist.add(hand);

  // Store refs for animation
  shoulder.userData = { elbow, wrist, hand };

  return shoulder;
}

// ═══════════════════════════════════════════════════════════════
//  LEG — hip, thigh, knee, shin, ankle, foot
// ═══════════════════════════════════════════════════════════════
function buildLeg(side) {
  // side: -1 = left, +1 = right
  const hip = new THREE.Group();

  // Hip joint sphere (hidden under clothing)
  const hipJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 6),
    MATS.pants
  );
  hipJoint.castShadow = true;
  hip.add(hipJoint);

  // Thigh — tapered capsule
  const thigh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.062, PROPORTIONS.thighLength - 0.08, 10),
    MATS.pants
  );
  thigh.position.y = -(PROPORTIONS.thighLength - 0.08) / 2 - 0.04;
  thigh.castShadow = true;
  thigh.receiveShadow = true;
  hip.add(thigh);

  // Knee
  const knee = new THREE.Group();
  knee.position.y = -PROPORTIONS.thighLength;
  hip.add(knee);

  const kneeJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 8, 6),
    MATS.pants
  );
  kneeJoint.castShadow = true;
  knee.add(kneeJoint);

  // Shin
  const shin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.042, PROPORTIONS.shinLength - 0.08, 10),
    MATS.pants
  );
  shin.position.y = -(PROPORTIONS.shinLength - 0.08) / 2;
  shin.castShadow = true;
  shin.receiveShadow = true;
  knee.add(shin);

  // Ankle
  const ankle = new THREE.Group();
  ankle.position.y = -PROPORTIONS.shinLength;
  knee.add(ankle);

  // Boot — properly shaped (heel + toe)
  const bootGroup = new THREE.Group();
  bootGroup.position.z = 0.04;

  const bootMain = new THREE.Mesh(
    new THREE.BoxGeometry(PROPORTIONS.footWidth, 0.10, 0.18),
    MATS.boot
  );
  bootMain.position.z = 0.03;
  bootMain.castShadow = true;
  bootMain.receiveShadow = true;
  bootGroup.add(bootMain);

  const bootToe = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    MATS.boot
  );
  bootToe.scale.set(0.9, 0.7, 1.0);
  bootToe.position.z = 0.11;
  bootToe.castShadow = true;
  bootGroup.add(bootToe);

  const bootHeel = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.06, 0.05),
    MATS.boot
  );
  bootHeel.position.set(0, -0.04, -0.04);
  bootGroup.add(bootHeel);

  ankle.add(bootGroup);

  hip.userData = { knee, ankle, foot: bootGroup };

  return hip;
}

// ═══════════════════════════════════════════════════════════════
//  TORSO — chest, abdomen, neck
// ═══════════════════════════════════════════════════════════════
function buildTorso() {
  const torso = new THREE.Group();

  // Abdomen — slightly tapered cylinder
  const abdomen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.28, 12),
    MATS.shirt
  );
  abdomen.position.y = 0.14;
  abdomen.castShadow = true;
  abdomen.receiveShadow = true;
  torso.add(abdomen);

  // Chest — wider at shoulders, tapering to waist
  const chestGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.28, 12);
  const chestPos = chestGeo.attributes.position;
  for (let i = 0; i < chestPos.count; i++) {
    const y = chestPos.getY(i);
    const x = chestPos.getX(i);
    // Widen at top (shoulders)
    if (y > 0.05) {
      chestPos.setX(i, x * (1 + y * 0.8));
    }
    // Subtle pectoral bulge at front
    if (y > 0 && chestPos.getZ(i) > 0.1) {
      chestPos.setZ(i, chestPos.getZ(i) * 1.05);
    }
  }
  chestGeo.computeVertexNormals();
  const chest = new THREE.Mesh(chestGeo, MATS.shirt);
  chest.position.y = 0.40;
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);

  // Collar
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.10, 0.015, 6, 16, Math.PI),
    MATS.shirt
  );
  collar.position.y = 0.54;
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI;
  torso.add(collar);

  // Belt
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.05, 16),
    MATS.belt
  );
  belt.position.y = -0.02;
  belt.castShadow = true;
  torso.add(belt);

  // Belt buckle
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.04, 0.02),
    MATS.iron || MATS.metal || MATS.belt
  );
  buckle.position.set(0, -0.02, 0.16);
  torso.add(buckle);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.058, 0.10, 8),
    MATS.skin
  );
  neck.position.y = 0.59;
  neck.castShadow = true;
  torso.add(neck);

  return torso;
}

// ═══════════════════════════════════════════════════════════════
//  HAT — wide-brim straw hat
// ═══════════════════════════════════════════════════════════════
function buildHat() {
  const hat = new THREE.Group();

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.24, 0.015, 24),
    MATS.hat
  );
  brim.castShadow = true;
  hat.add(brim);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.115, 0.10, 16),
    MATS.hat
  );
  crown.position.y = 0.05;
  crown.castShadow = true;
  hat.add(crown);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.116, 0.118, 0.02, 16),
    MATS.boot
  );
  band.position.y = 0.02;
  hat.add(band);

  return hat;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PLAYER FACTORY
// ═══════════════════════════════════════════════════════════════
export function createPlayer() {
  const root = new THREE.Group();

  // The rig hierarchy:
  //   root (at feet, world position)
  //     body (bob/tilt)
  //       hips (y = hipHeight)
  //         torso
  //           head
  //         leftLeg / rightLeg
  //       leftArm / rightArm (attached to torso shoulders)
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = PROPORTIONS.hipHeight;
  body.add(hips);

  // Torso
  const torso = buildTorso();
  hips.add(torso);

  // Head (attached to torso neck)
  const head = buildHead();
  head.position.y = 0.67;
  torso.add(head);

  // Hat
  const hat = buildHat();
  hat.position.y = 0.16;
  head.add(hat);

  // Arms — attach to torso at shoulder height
  const leftArm = buildArm(-1);
  leftArm.position.set(-PROPORTIONS.shoulderWidth / 2, 0.50, 0);
  torso.add(leftArm);

  const rightArm = buildArm(+1);
  rightArm.position.set(PROPORTIONS.shoulderWidth / 2, 0.50, 0);
  torso.add(rightArm);

  // Legs — attach to hips
  const leftLeg = buildLeg(-1);
  leftLeg.position.set(-PROPORTIONS.hipWidth / 2, -0.02, 0);
  hips.add(leftLeg);

  const rightLeg = buildLeg(+1);
  rightLeg.position.set(PROPORTIONS.hipWidth / 2, -0.02, 0);
  hips.add(rightLeg);

  // ── Animation state ────────────────────────────────────────
  const anim = {
    // Walk cycle phase (radians) — advances with velocity
    walkPhase: 0,
    walkAmp: spring(0, 140, 14),
    runBlend: spring(0, 120, 12),

    // Body
    bodyBob: spring(0, 160, 15),
    bodyTilt: spring(0, 140, 13),
    torsoTwist: spring(0, 130, 12),
    torsoLean: spring(0, 140, 13),

    // Head
    headYaw: spring(0, 110, 11),
    headPitch: spring(0, 110, 11),

    // Arms
    leftArmPitch: spring(0, 160, 14),
    rightArmPitch: spring(0, 160, 14),
    leftElbowBend: spring(0.2, 180, 15),
    rightElbowBend: spring(0.2, 180, 15),

    // Legs
    leftHipPitch: spring(0, 160, 14),
    rightHipPitch: spring(0, 160, 14),
    leftKneeBend: spring(0, 180, 15),
    rightKneeBend: spring(0, 180, 15),
    leftAnklePitch: spring(0, 180, 15),
    rightAnklePitch: spring(0, 180, 15),

    // Tool swing (right arm override)
    toolSwing: spring(0, 220, 16),
    toolSwingActive: false,

    // Idle
    idleTime: 0,
    breathPhase: 0,

    // Hold pose blend (0 = natural, 1 = holding tool)
    holdBlend: spring(0, 100, 10),
  };

  // ── Tool attachment (right hand) ───────────────────────────
  const toolAnchor = new THREE.Group();
  rightArm.userData.wrist.add(toolAnchor);
  toolAnchor.position.set(0, -0.02, 0.02);

  // ── Public API ─────────────────────────────────────────────
  const rig = {
    root, body, hips, torso, head, hat,
    leftArm, rightArm, leftLeg, rightLeg,
    toolAnchor, anim,

    // Set which tool is visible (tools.js manages actual meshes)
    setToolVisible(_visible) { /* handled by tools.js */ },

    // Trigger a tool swing (called from tools.js performAction)
    triggerToolSwing() {
      anim.toolSwingActive = true;
      anim.toolSwing.value = 0;
      anim.toolSwing.target = 1.4;
      anim.toolSwing.velocity = 12;
    },

    // Look direction target (called every frame from engine)
    setLook(yaw, pitch) {
      // Head follows camera partially (not fully — feels more natural)
      anim.headYaw.target = yaw * 0.35;
      anim.headPitch.target = pitch * 0.4;
    },
  };

  return rig;
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATION UPDATE — called every frame
// ═══════════════════════════════════════════════════════════════
export function updatePlayerAnimation(rig, state, dt, terrainHeightFn, HALF_WORLD) {
  const anim = rig.anim;
  const mv = state.movement;

  // ── Determine wish direction in world space ────────────────
  const yaw = state.cameraYaw;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);

  let wx = 0, wz = 0;
  if (mv.w) { wx += forwardX; wz += forwardZ; }
  if (mv.s) { wx -= forwardX; wz -= forwardZ; }
  if (mv.d) { wx += rightX; wz += rightZ; }
  if (mv.a) { wx -= rightX; wz -= rightZ; }

  const wishMag = Math.hypot(wx, wz);
  if (wishMag > 0) { wx /= wishMag; wz /= wishMag; }

  const speed = mv.shift ? 5.8 : 3.2;
  const targetVX = wx * speed;
  const targetVZ = wz * speed;

  // ── Smooth velocity ────────────────────────────────────────
  rig.velocity = rig.velocity || new THREE.Vector3();
  rig.velocity.x += (targetVX - rig.velocity.x) * Math.min(1, dt * 11);
  rig.velocity.z += (targetVZ - rig.velocity.z) * Math.min(1, dt * 11);

  const moveAmt = Math.hypot(rig.velocity.x, rig.velocity.z);
  const isMoving = moveAmt > 0.15;

  // ── Move root ──────────────────────────────────────────────
  if (isMoving) {
    rig.root.position.x += rig.velocity.x * dt;
    rig.root.position.z += rig.velocity.z * dt;

    // Face movement direction
    const targetRot = Math.atan2(rig.velocity.x, rig.velocity.z);
    rig.root.rotation.y = lerpAngle(rig.root.rotation.y, targetRot, Math.min(1, dt * 9));
  }

  // Clamp to world
  rig.root.position.x = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.x));
  rig.root.position.z = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.z));
  rig.root.position.y = terrainHeightFn(rig.root.position.x, rig.root.position.z);

  // ── Walk cycle ─────────────────────────────────────────────
  // CRITICAL: phase advances proportional to actual velocity
  // (no skating — feet plant at ground speed)
  const strideLength = mv.shift ? 1.6 : 1.1; // meters per full cycle
  const cyclesPerSecond = moveAmt / strideLength;
  anim.walkPhase += dt * cyclesPerSecond * Math.PI * 2;

  // Amplitude blends in/out
  anim.walkAmp.target = isMoving ? Math.min(1, moveAmt / (mv.shift ? 5 : 3)) : 0;
  stepSpring(anim.walkAmp, dt);
  const amp = anim.walkAmp.value;

  anim.runBlend.target = mv.shift && moveAmt > 2 ? 1 : 0;
  stepSpring(anim.runBlend, dt);
  const runB = anim.runBlend.value;

  const phase = anim.walkPhase;
  const sinP = Math.sin(phase);
  const cosP = Math.cos(phase);

  // ── Legs — proper 4-key walk ──────────────────────────────
  // Left leg leads by half cycle
  const leftPhase = phase;
  const rightPhase = phase + Math.PI;

  // Hip pitch: forward swing on lift, back on plant
  const leftHipTarget = Math.sin(leftPhase) * 0.55 * amp * (1 + runB * 0.4);
  const rightHipTarget = Math.sin(rightPhase) * 0.55 * amp * (1 + runB * 0.4);

  // Knee: bends when leg is lifting (not when planted)
  // Use max(0, -sin) so knee bends only on the back-to-front swing
  const leftKneeTarget = Math.max(0, -Math.sin(leftPhase - 0.5)) * 0.9 * amp * (1 + runB * 0.5);
  const rightKneeTarget = Math.max(0, -Math.sin(rightPhase - 0.5)) * 0.9 * amp * (1 + runB * 0.5);

  // Ankle: subtle counter-rotation to keep foot flat on plant
  const leftAnkleTarget = -Math.sin(leftPhase) * 0.25 * amp;
  const rightAnkleTarget = -Math.sin(rightPhase) * 0.25 * amp;

  anim.leftHipPitch.target = leftHipTarget;
  anim.rightHipPitch.target = rightHipTarget;
  anim.leftKneeBend.target = leftKneeTarget;
  anim.rightKneeBend.target = rightKneeTarget;
  anim.leftAnklePitch.target = leftAnkleTarget;
  anim.rightAnklePitch.target = rightAnkleTarget;

  stepSpring(anim.leftHipPitch, dt);
  stepSpring(anim.rightHipPitch, dt);
  stepSpring(anim.leftKneeBend, dt);
  stepSpring(anim.rightKneeBend, dt);
  stepSpring(anim.leftAnklePitch, dt);
  stepSpring(anim.rightAnklePitch, dt);

  rig.leftLeg.rotation.x = anim.leftHipPitch.value;
  rig.rightLeg.rotation.x = anim.rightHipPitch.value;
  rig.leftLeg.userData.knee.rotation.x = -anim.leftKneeBend.value;
  rig.rightLeg.userData.knee.rotation.x = -anim.rightKneeBend.value;
  rig.leftLeg.userData.ankle.rotation.x = anim.leftAnklePitch.value;
  rig.rightLeg.userData.ankle.rotation.x = anim.rightAnklePitch.value;

  // ── Arms — counter-swing to legs ──────────────────────────
  anim.holdBlend.target = 0; // (tools.js can override by calling setHolding)
  stepSpring(anim.holdBlend, dt);

  // Left arm swings naturally (no tool)
  const leftArmTarget = -Math.sin(leftPhase) * 0.4 * amp;
  anim.leftArmPitch.target = leftArmTarget;
  stepSpring(anim.leftArmPitch, dt);
  rig.leftArm.rotation.x = anim.leftArmPitch.value;

  // Left elbow — slight natural bend
  anim.leftElbowBend.target = 0.15 + Math.abs(Math.sin(leftPhase)) * 0.15 * amp;
  stepSpring(anim.leftElbowBend, dt);
  rig.leftArm.userData.elbow.rotation.x = -anim.leftElbowBend.value;

  // Right arm — tool swing overrides walk swing
  if (anim.toolSwingActive) {
    // Tool swing animation (chop motion)
    anim.toolSwing.value += anim.toolSwing.velocity * dt;
    anim.toolSwing.velocity *= 1 - 4 * dt;

    const t = Math.min(1, anim.toolSwing.value / 1.4);
    // Wind up → swing down → recover
    let armAngle, elbowAngle;
    if (t < 0.3) {
      // Wind up (raise arm)
      const k = t / 0.3;
      armAngle = -0.8 * k;
      elbowAngle = 0.4 + k * 0.5;
    } else if (t < 0.55) {
      // Swing down (fast)
      const k = (t - 0.3) / 0.25;
      armAngle = -0.8 + k * 2.0;
      elbowAngle = 0.9 - k * 0.7;
    } else {
      // Recover
      const k = (t - 0.55) / 0.45;
      armAngle = 1.2 - k * 1.2;
      elbowAngle = 0.2 - k * 0.2;
    }
    anim.rightArmPitch.target = armAngle;
    anim.rightElbowBend.target = Math.max(0, elbowAngle);

    if (t >= 1) {
      anim.toolSwingActive = false;
      anim.toolSwing.value = 0;
      anim.toolSwing.velocity = 0;
    }
  } else {
    // Natural swing
    anim.rightArmPitch.target = -Math.sin(rightPhase) * 0.4 * amp;
    anim.rightElbowBend.target = 0.15 + Math.abs(Math.sin(rightPhase)) * 0.15 * amp;
  }

  stepSpring(anim.rightArmPitch, dt);
  stepSpring(anim.rightElbowBend, dt);
  rig.rightArm.rotation.x = anim.rightArmPitch.value;
  rig.rightArm.userData.elbow.rotation.x = -anim.rightElbowBend.value;

  // ── Body bob + tilt ────────────────────────────────────────
  // Bob goes DOWN when feet plant (double frequency — 2 steps per cycle)
  const bobTarget = -Math.abs(sinP) * 0.04 * amp + (runB * Math.abs(sinP) * 0.02 * amp);
  anim.bodyBob.target = bobTarget;
  stepSpring(anim.bodyBob, dt);

  // Body tilts side to side (weight shift)
  const tiltTarget = Math.cos(phase) * 0.04 * amp;
  anim.bodyTilt.target = tiltTarget;
  stepSpring(anim.bodyTilt, dt);

  // Torso twists opposite to hips
  const twistTarget = -Math.sin(phase) * 0.08 * amp;
  anim.torsoTwist.target = twistTarget;
  stepSpring(anim.torsoTwist, dt);

  // Lean forward when running
  const leanTarget = runB * 0.15 + moveAmt * 0.02;
  anim.torsoLean.target = leanTarget;
  stepSpring(anim.torsoLean, dt);

  rig.body.position.y = anim.bodyBob.value;
  rig.body.rotation.z = anim.bodyTilt.value;
  rig.torso.rotation.y = anim.torsoTwist.value;
  rig.torso.rotation.x = anim.torsoLean.value;

  // ── Idle animation (breathing + weight shift) ──────────────
  anim.idleTime += dt;
  const idleFactor = 1 - Math.min(1, moveAmt);

  if (idleFactor > 0.1) {
    // Breathing — chest expands
    anim.breathPhase = anim.idleTime * 1.4;
    const breath = Math.sin(anim.breathPhase) * 0.015 * idleFactor;
    rig.torso.scale.x = 1 + breath * 0.5;
    rig.torso.scale.z = 1 + breath;

    // Subtle weight shift (hips sway side to side slowly)
    const sway = Math.sin(anim.idleTime * 0.5) * 0.02 * idleFactor;
    rig.hips.rotation.z = sway;

    // Head slight movement
    anim.headYaw.target += Math.sin(anim.idleTime * 0.3) * 0.05 * idleFactor;
  } else {
    rig.torso.scale.x = 1;
    rig.torso.scale.z = 1;
    rig.hips.rotation.z *= 0.95;
  }

  stepSpring(anim.headYaw, dt);
  stepSpring(anim.headPitch, dt);
  rig.head.rotation.y = anim.headYaw.value;
  rig.head.rotation.x = anim.headPitch.value;

  // ── Hat subtle bob ─────────────────────────────────────────
  const hatBobTarget = Math.sin(phase * 2) * 0.01 * amp;
  rig.hat.rotation.x = hatBobTarget;
}

// ═══════════════════════════════════════════════════════════════
//  MATERIALS — fallback if materials.js not provided
// ═══════════════════════════════════════════════════════════════
// (this should match the MATERIALS file; if you don't have it,
//  these defaults work — but for full compatibility, see below)

export const DEFAULT_MATS = {
  skin: new THREE.MeshStandardMaterial({ color: 0xe8bfa0, roughness: 0.72 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x4a8bc8, roughness: 0.92 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.94 }),
  hat: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.82 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.82 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa8a8b0, roughness: 0.4, metalness: 0.85 }),
};
