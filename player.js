// ═══════════════════════════════════════════════════════════════
//  player.js — v2
//  Proper humanoid rig with real walk cycle (no skating).
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { MATS } from './materials.js';

// ── Spring for smooth blends ────────────────────────────────
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
//  PROPORTIONS — realistic human (8 heads tall, ~1.75m)
// ═══════════════════════════════════════════════════════════════
const P = {
  headHeight: 0.22,
  torsoHeight: 0.55,
  hipHeight: 0.92,
  shoulderWidth: 0.38,
  hipWidth: 0.30,
  upperArm: 0.30,
  forearm: 0.26,
  hand: 0.18,
  thigh: 0.42,
  shin: 0.42,
};

// ═══════════════════════════════════════════════════════════════
//  HEAD
// ═══════════════════════════════════════════════════════════════
function buildHead() {
  const head = new THREE.Group();

  const skullGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const pos = skullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
    const taper = y < 0 ? 0.85 + y * 0.8 : 1.0;
    const temple = Math.abs(y) < 0.04 ? 0.94 : 1.0;
    pos.setX(i, x * taper * temple);
    pos.setZ(i, z * taper * 0.95);
    if (z < -0.05) pos.setZ(i, z * 0.92);
  }
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, MATS.skin);
  skull.position.y = 0.08;
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.09), MATS.skin);
  jaw.position.set(0, -0.01, 0.02);
  jaw.castShadow = true;
  head.add(jaw);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), MATS.skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.06, 0.115);
  nose.castShadow = true;
  head.add(nose);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeWhiteMat);
    white.position.set(side * 0.045, 0.09, 0.095);
    white.scale.set(1, 0.9, 0.6);
    head.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), irisMat);
    iris.position.set(side * 0.045, 0.09, 0.113);
    head.add(iris);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), MATS.hair);
    brow.position.set(side * 0.045, 0.115, 0.100);
    brow.rotation.z = side * 0.08;
    head.add(brow);
  }

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), MATS.skin);
    ear.scale.set(0.5, 1, 0.7);
    ear.position.set(side * 0.108, 0.07, -0.01);
    ear.castShadow = true;
    head.add(ear);
  }

  const hairGeo = new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = new THREE.Mesh(hairGeo, MATS.hair);
  hair.position.y = 0.08;
  hair.castShadow = true;
  head.add(hair);

  for (const side of [-1, 1]) {
    const burn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.03), MATS.hair);
    burn.position.set(side * 0.10, 0.04, 0.04);
    head.add(burn);
  }

  return head;
}

// ═══════════════════════════════════════════════════════════════
//  HAND
// ═══════════════════════════════════════════════════════════════
function buildHand(side) {
  const hand = new THREE.Group();

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.09), MATS.skin);
  palm.castShadow = true;
  hand.add(palm);

  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.055, 3, 6), MATS.skin);
    finger.position.set((i - 1.5) * 0.020, 0, 0.07);
    finger.rotation.x = Math.PI / 2 + 0.05 * (i - 1.5);
    finger.castShadow = true;
    hand.add(finger);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 3, 6), MATS.skin);
  thumb.position.set(side * 0.045, 0.005, 0.03);
  thumb.rotation.z = side * 0.9;
  thumb.rotation.x = 0.5;
  thumb.castShadow = true;
  hand.add(thumb);

  return hand;
}

// ═══════════════════════════════════════════════════════════════
//  ARM
// ═══════════════════════════════════════════════════════════════
function buildArm(side) {
  const shoulder = new THREE.Group();

  const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), MATS.shirt);
  deltoid.castShadow = true;
  shoulder.add(deltoid);

  const upper = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, P.upperArm - 0.09, 4, 8),
    MATS.shirt
  );
  upper.position.y = -(P.upperArm - 0.09) / 2 - 0.045;
  upper.castShadow = true;
  upper.receiveShadow = true;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -P.upperArm;
  shoulder.add(elbow);

  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.040, 8, 6), MATS.skin);
  elbowJoint.castShadow = true;
  elbow.add(elbowJoint);

  const fore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.032, P.forearm - 0.05, 10),
    MATS.skin
  );
  fore.position.y = -(P.forearm - 0.05) / 2;
  fore.castShadow = true;
  fore.receiveShadow = true;
  elbow.add(fore);

  const wrist = new THREE.Group();
  wrist.position.y = -P.forearm;
  elbow.add(wrist);

  const hand = buildHand(side);
  hand.rotation.x = -0.1;
  wrist.add(hand);

  shoulder.userData = { elbow, wrist, hand };
  return shoulder;
}

// ═══════════════════════════════════════════════════════════════
//  LEG
// ═══════════════════════════════════════════════════════════════
function buildLeg(side) {
  const hip = new THREE.Group();

  const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), MATS.pants);
  hipJoint.castShadow = true;
  hip.add(hipJoint);

  const thigh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.062, P.thigh - 0.08, 10),
    MATS.pants
  );
  thigh.position.y = -(P.thigh - 0.08) / 2 - 0.04;
  thigh.castShadow = true;
  thigh.receiveShadow = true;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -P.thigh;
  hip.add(knee);

  const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), MATS.pants);
  kneeJoint.castShadow = true;
  knee.add(kneeJoint);

  const shin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.042, P.shin - 0.08, 10),
    MATS.pants
  );
  shin.position.y = -(P.shin - 0.08) / 2;
  shin.castShadow = true;
  shin.receiveShadow = true;
  knee.add(shin);

  const ankle = new THREE.Group();
  ankle.position.y = -P.shin;
  knee.add(ankle);

  const bootGroup = new THREE.Group();
  bootGroup.position.z = 0.04;

  const bootMain = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.18), MATS.boot);
  bootMain.position.z = 0.03;
  bootMain.castShadow = true;
  bootMain.receiveShadow = true;
  bootGroup.add(bootMain);

  const bootToe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), MATS.boot);
  bootToe.scale.set(0.9, 0.7, 1.0);
  bootToe.position.z = 0.11;
  bootToe.castShadow = true;
  bootGroup.add(bootToe);

  const bootHeel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.05), MATS.boot);
  bootHeel.position.set(0, -0.04, -0.04);
  bootGroup.add(bootHeel);

  ankle.add(bootGroup);

  hip.userData = { knee, ankle, foot: bootGroup };
  return hip;
}

// ═══════════════════════════════════════════════════════════════
//  TORSO
// ═══════════════════════════════════════════════════════════════
function buildTorso() {
  const torso = new THREE.Group();

  const abdomen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.28, 12),
    MATS.shirt
  );
  abdomen.position.y = 0.14;
  abdomen.castShadow = true;
  abdomen.receiveShadow = true;
  torso.add(abdomen);

  const chestGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.28, 12);
  const chestPos = chestGeo.attributes.position;
  for (let i = 0; i < chestPos.count; i++) {
    const y = chestPos.getY(i), x = chestPos.getX(i);
    if (y > 0.05) chestPos.setX(i, x * (1 + y * 0.8));
    if (y > 0 && chestPos.getZ(i) > 0.1) chestPos.setZ(i, chestPos.getZ(i) * 1.05);
  }
  chestGeo.computeVertexNormals();
  const chest = new THREE.Mesh(chestGeo, MATS.shirt);
  chest.position.y = 0.40;
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.10, 0.015, 6, 16, Math.PI),
    MATS.shirt
  );
  collar.position.y = 0.54;
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI;
  torso.add(collar);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.05, 16),
    MATS.belt
  );
  belt.position.y = -0.02;
  belt.castShadow = true;
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), MATS.metal);
  buckle.position.set(0, -0.02, 0.16);
  torso.add(buckle);

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
//  HAT
// ═══════════════════════════════════════════════════════════════
function buildHat() {
  const hat = new THREE.Group();

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.015, 24), MATS.hat);
  brim.castShadow = true;
  hat.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.115, 0.10, 16), MATS.hat);
  crown.position.y = 0.05;
  crown.castShadow = true;
  hat.add(crown);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.118, 0.02, 16), MATS.boot);
  band.position.y = 0.02;
  hat.add(band);

  return hat;
}

// ═══════════════════════════════════════════════════════════════
//  FACTORY
// ═══════════════════════════════════════════════════════════════
export function createPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = P.hipHeight;
  body.add(hips);

  const torso = buildTorso();
  hips.add(torso);

  const head = buildHead();
  head.position.y = 0.67;
  torso.add(head);

  const hat = buildHat();
  hat.position.y = 0.16;
  head.add(hat);

  const leftArm = buildArm(-1);
  leftArm.position.set(-P.shoulderWidth / 2, 0.50, 0);
  torso.add(leftArm);

  const rightArm = buildArm(+1);
  rightArm.position.set(P.shoulderWidth / 2, 0.50, 0);
  torso.add(rightArm);

  const leftLeg = buildLeg(-1);
  leftLeg.position.set(-P.hipWidth / 2, -0.02, 0);
  hips.add(leftLeg);

  const rightLeg = buildLeg(+1);
  rightLeg.position.set(P.hipWidth / 2, -0.02, 0);
  hips.add(rightLeg);

  const anim = {
    walkPhase: 0,
    walkAmp: spring(0, 140, 14),
    runBlend: spring(0, 120, 12),
    bodyBob: spring(0, 160, 15),
    bodyTilt: spring(0, 140, 13),
    torsoTwist: spring(0, 130, 12),
    torsoLean: spring(0, 140, 13),
    headYaw: spring(0, 110, 11),
    headPitch: spring(0, 110, 11),
    leftArmPitch: spring(0, 160, 14),
    rightArmPitch: spring(0, 160, 14),
    leftElbowBend: spring(0.2, 180, 15),
    rightElbowBend: spring(0.2, 180, 15),
    leftHipPitch: spring(0, 160, 14),
    rightHipPitch: spring(0, 160, 14),
    leftKneeBend: spring(0, 180, 15),
    rightKneeBend: spring(0, 180, 15),
    leftAnklePitch: spring(0, 180, 15),
    rightAnklePitch: spring(0, 180, 15),
    toolSwing: spring(0, 220, 16),
    toolSwingActive: false,
    idleTime: 0,
    breathPhase: 0,
  };

  const toolAnchor = new THREE.Group();
  rightArm.userData.wrist.add(toolAnchor);
  toolAnchor.position.set(0, -0.02, 0.02);

  const rig = {
    root, body, hips, torso, head, hat,
    leftArm, rightArm, leftLeg, rightLeg,
    toolAnchor, anim,
    velocity: new THREE.Vector3(),

    triggerToolSwing() {
      anim.toolSwingActive = true;
      anim.toolSwing.value = 0;
      anim.toolSwing.target = 1.4;
      anim.toolSwing.velocity = 12;
    },

    setLook(_yaw, pitch) {
      anim.headYaw.target = 0;
      anim.headPitch.target = pitch * 0.4;
    },
  };

  return rig;
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATION UPDATE
// ═══════════════════════════════════════════════════════════════
export function updatePlayerAnimation(rig, state, dt, terrainHeightFn, HALF_WORLD) {
  const anim = rig.anim;
  const mv = state.movement;

  const yaw = state.cameraYaw;
  const fX = -Math.sin(yaw), fZ = -Math.cos(yaw);
  const rX = Math.cos(yaw), rZ = -Math.sin(yaw);

  let wx = 0, wz = 0;
  if (mv.w) { wx += fX; wz += fZ; }
  if (mv.s) { wx -= fX; wz -= fZ; }
  if (mv.d) { wx += rX; wz += rZ; }
  if (mv.a) { wx -= rX; wz -= rZ; }

  const wishMag = Math.hypot(wx, wz);
  if (wishMag > 0) { wx /= wishMag; wz /= wishMag; }

  const speed = mv.shift ? 5.8 : 3.2;
  const targetVX = wx * speed;
  const targetVZ = wz * speed;

  rig.velocity.x += (targetVX - rig.velocity.x) * Math.min(1, dt * 11);
  rig.velocity.z += (targetVZ - rig.velocity.z) * Math.min(1, dt * 11);

  const moveAmt = Math.hypot(rig.velocity.x, rig.velocity.z);
  const isMoving = moveAmt > 0.15;

  if (isMoving) {
    rig.root.position.x += rig.velocity.x * dt;
    rig.root.position.z += rig.velocity.z * dt;
    const targetRot = Math.atan2(rig.velocity.x, rig.velocity.z);
    rig.root.rotation.y = lerpAngle(rig.root.rotation.y, targetRot, Math.min(1, dt * 9));
  }

  rig.root.position.x = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.x));
  rig.root.position.z = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.z));
  rig.root.position.y = terrainHeightFn(rig.root.position.x, rig.root.position.z);

  const strideLength = mv.shift ? 1.6 : 1.1;
  const cyclesPerSecond = moveAmt / strideLength;
  anim.walkPhase += dt * cyclesPerSecond * Math.PI * 2;

  anim.walkAmp.target = isMoving ? Math.min(1, moveAmt / (mv.shift ? 5 : 3)) : 0;
  stepSpring(anim.walkAmp, dt);
  const amp = anim.walkAmp.value;

  anim.runBlend.target = mv.shift && moveAmt > 2 ? 1 : 0;
  stepSpring(anim.runBlend, dt);
  const runB = anim.runBlend.value;

  const phase = anim.walkPhase;
  const sinP = Math.sin(phase);

  const leftPhase = phase;
  const rightPhase = phase + Math.PI;

  const leftHipTarget = Math.sin(leftPhase) * 0.55 * amp * (1 + runB * 0.4);
  const rightHipTarget = Math.sin(rightPhase) * 0.55 * amp * (1 + runB * 0.4);
  const leftKneeTarget = Math.max(0, -Math.sin(leftPhase - 0.5)) * 0.9 * amp * (1 + runB * 0.5);
  const rightKneeTarget = Math.max(0, -Math.sin(rightPhase - 0.5)) * 0.9 * amp * (1 + runB * 0.5);
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

  const leftArmTarget = -Math.sin(leftPhase) * 0.4 * amp;
  anim.leftArmPitch.target = leftArmTarget;
  stepSpring(anim.leftArmPitch, dt);
  rig.leftArm.rotation.x = anim.leftArmPitch.value;
  anim.leftElbowBend.target = 0.15 + Math.abs(Math.sin(leftPhase)) * 0.15 * amp;
  stepSpring(anim.leftElbowBend, dt);
  rig.leftArm.userData.elbow.rotation.x = -anim.leftElbowBend.value;

  if (anim.toolSwingActive) {
    anim.toolSwing.value += anim.toolSwing.velocity * dt;
    anim.toolSwing.velocity *= 1 - 4 * dt;
    const t = Math.min(1, anim.toolSwing.value / 1.4);
    let armAngle, elbowAngle;
    if (t < 0.3) {
      const k = t / 0.3;
      armAngle = -0.8 * k;
      elbowAngle = 0.4 + k * 0.5;
    } else if (t < 0.55) {
      const k = (t - 0.3) / 0.25;
      armAngle = -0.8 + k * 2.0;
      elbowAngle = 0.9 - k * 0.7;
    } else {
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
    anim.rightArmPitch.target = -Math.sin(rightPhase) * 0.4 * amp;
    anim.rightElbowBend.target = 0.15 + Math.abs(Math.sin(rightPhase)) * 0.15 * amp;
  }

  stepSpring(anim.rightArmPitch, dt);
  stepSpring(anim.rightElbowBend, dt);
  rig.rightArm.rotation.x = anim.rightArmPitch.value;
  rig.rightArm.userData.elbow.rotation.x = -anim.rightElbowBend.value;

  const bobTarget = -Math.abs(sinP) * 0.04 * amp + (runB * Math.abs(sinP) * 0.02 * amp);
  anim.bodyBob.target = bobTarget;
  stepSpring(anim.bodyBob, dt);

  const tiltTarget = Math.cos(phase) * 0.04 * amp;
  anim.bodyTilt.target = tiltTarget;
  stepSpring(anim.bodyTilt, dt);

  const twistTarget = -Math.sin(phase) * 0.08 * amp;
  anim.torsoTwist.target = twistTarget;
  stepSpring(anim.torsoTwist, dt);

  const leanTarget = runB * 0.15 + moveAmt * 0.02;
  anim.torsoLean.target = leanTarget;
  stepSpring(anim.torsoLean, dt);

  rig.body.position.y = anim.bodyBob.value;
  rig.body.rotation.z = anim.bodyTilt.value;
  rig.torso.rotation.y = anim.torsoTwist.value;
  rig.torso.rotation.x = anim.torsoLean.value;

  anim.idleTime += dt;
  const idleFactor = 1 - Math.min(1, moveAmt);
  if (idleFactor > 0.1) {
    anim.breathPhase = anim.idleTime * 1.4;
    const breath = Math.sin(anim.breathPhase) * 0.015 * idleFactor;
    rig.torso.scale.x = 1 + breath * 0.5;
    rig.torso.scale.z = 1 + breath;
    const sway = Math.sin(anim.idleTime * 0.5) * 0.02 * idleFactor;
    rig.hips.rotation.z = sway;
  } else {
    rig.torso.scale.x = 1;
    rig.torso.scale.z = 1;
    rig.hips.rotation.z *= 0.95;
  }

  stepSpring(anim.headYaw, dt);
  stepSpring(anim.headPitch, dt);
  rig.head.rotation.y = anim.headYaw.value;
  rig.head.rotation.x = anim.headPitch.value;

  rig.hat.rotation.x = Math.sin(phase * 2) * 0.01 * amp;
}
