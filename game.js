import * as THREE from 'three';
import {
  MATS, TOOL_DEFS, CROP_TYPES, cropStage,
  createHoe, createWateringCan, createSeedPouch, createBasket, createPestSpray,
  createCropMesh, createSheep, createChicken, createCow,
  createCrate, createBarrel, createScarecrow, createHayBale,
  makeSoilTexture,
} from './others.js';

// ═══════════════════════════════════════════════════════════════
//  game.js — Player, Camera, Farm, Animals, HUD, Quests, Save
// ═══════════════════════════════════════════════════════════════

// ── Spring helper ─────────────────────────────────────────
export function makeSpring(v = 0, s = 180, d = 18) {
  return { value: v, target: v, velocity: 0, stiffness: s, damping: d };
}
export function stepSpring(sp, dt) {
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
//  PLAYER RIG
// ═══════════════════════════════════════════════════════════════
export function createPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  body.add(hips);

  const spine = new THREE.Group();
  spine.position.y = 0.18;
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.y = 0.5;
  spine.add(chest);

  const neck = new THREE.Group();
  neck.position.y = 0.55;
  chest.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.2;
  neck.add(head);

  const hat = new THREE.Group();
  head.add(hat);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftForearm = new THREE.Group();
  const rightForearm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftShin = new THREE.Group();
  const rightShin = new THREE.Group();

  // Legs
  for (const [legGrp, shinGrp, side] of [
    [leftLeg, leftShin, -1], [rightLeg, rightShin, 1],
  ]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.44, 4, 10), MATS.pants);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    legGrp.add(thigh);
    legGrp.position.set(side * 0.2, 0, 0);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 4, 10), MATS.pants);
    shin.position.y = -0.25;
    shin.castShadow = true;
    shin.receiveShadow = true;
    shinGrp.add(shin);
    shinGrp.position.y = -0.46;
    legGrp.add(shinGrp);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.19, 0.42), MATS.boot);
    boot.position.set(0, -0.54, 0.07);
    boot.castShadow = true;
    boot.receiveShadow = true;
    shinGrp.add(boot);

    hips.add(legGrp);
  }

  // Belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.13, 16), MATS.belt);
  belt.position.y = 0.12;
  belt.castShadow = true;
  hips.add(belt);

  // Torso
  const torsoLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.34, 4, 12), MATS.shirt);
  torsoLower.position.y = 0.33;
  torsoLower.castShadow = true;
  torsoLower.receiveShadow = true;
  spine.add(torsoLower);

  const torsoUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.3, 4, 12), MATS.shirt);
  torsoUpper.position.y = 0.33;
  torsoUpper.castShadow = true;
  torsoUpper.receiveShadow = true;
  chest.add(torsoUpper);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), MATS.shirt);
    shoulder.position.set(side * 0.33, 0.29, 0);
    shoulder.castShadow = true;
    chest.add(shoulder);
  }

  // Arms
  for (const [armGrp, forearmGrp, side] of [
    [leftArm, leftForearm, -1], [rightArm, rightForearm, 1],
  ]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.36, 4, 8), MATS.shirt);
    upper.position.y = -0.2;
    upper.castShadow = true;
    upper.receiveShadow = true;
    armGrp.add(upper);
    armGrp.position.set(side * 0.4, 0.26, 0);
    chest.add(armGrp);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.34, 4, 8), MATS.skin);
    fore.position.y = -0.2;
    fore.castShadow = true;
    fore.receiveShadow = true;
    forearmGrp.add(fore);
    forearmGrp.position.y = -0.42;
    armGrp.add(forearmGrp);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 6), MATS.skin);
    hand.position.y = -0.24;
    hand.castShadow = true;
    forearmGrp.add(hand);
  }

  // Neck + head
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.145, 0.16, 8), MATS.skin);
  neckMesh.position.y = 0.18;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), MATS.skin);
  headMesh.scale.set(1, 1.08, 0.98);
  headMesh.position.y = 0.33;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // Hair
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.135, 6, 5), MATS.hair);
    const a = (i / 6) * Math.PI * 2;
    h.position.set(Math.cos(a) * 0.21, 0.43 + Math.sin(a) * 0.07, Math.sin(a) * 0.19 - 0.05);
    h.scale.set(1.3, 0.9, 1.0);
    head.add(h);
  }

  // Eyes + brows
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
    eye.position.set(side * 0.1, 0.35, 0.27);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.026, 0.03), MATS.hair);
    brow.position.set(side * 0.1, 0.41, 0.28);
    brow.rotation.z = side * 0.05;
    head.add(brow);
  }

  // Hat
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.055, 22), MATS.hat);
  brim.position.y = 0.56;
  brim.castShadow = true;
  hat.add(brim);
  const topHat = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.37, 0.33, 16), MATS.hat);
  topHat.position.y = 0.73;
  topHat.castShadow = true;
  hat.add(topHat);

  // Tools — 5 of them
  const heldTool = new THREE.Group();
  rightForearm.add(heldTool);
  heldTool.position.set(0, -0.24, 0.04);

  const toolMeshes = [
    createHoe(),
    createWateringCan(),
    createSeedPouch(),
    createBasket(),
    createPestSpray(),
  ];
  toolMeshes.forEach(t => heldTool.add(t));
  toolMeshes.forEach((t, i) => { t.visible = (i === 0); });

  // Animation state
  const anim = {
    walkCycle: 0,
    walkAmp: makeSpring(0, 140, 14),
    hipsBob: makeSpring(0, 160, 15),
    hipsTilt: makeSpring(0, 140, 13),
    spineTwist: makeSpring(0, 130, 12),
    chestTwist: makeSpring(0, 140, 13),
    headBob: makeSpring(0, 150, 14),
    headTurn: makeSpring(0, 120, 11),
    leftArmPitch: makeSpring(0, 160, 14),
    rightArmPitch: makeSpring(0, 160, 14),
    leftForearmPitch: makeSpring(0, 180, 15),
    rightForearmPitch: makeSpring(0, 180, 15),
    leftLegPitch: makeSpring(0, 160, 14),
    rightLegPitch: makeSpring(0, 160, 14),
    leftShinPitch: makeSpring(0, 180, 15),
    rightShinPitch: makeSpring(0, 180, 15),
    toolSwing: makeSpring(0, 220, 16),
    hatBob: makeSpring(0, 170, 14),
    breath: 0,
    idleTime: 0,
  };

  const rig = {
    root, body, hips, spine, chest, neck, head, hat,
    leftArm, rightArm, leftForearm, rightForearm,
    leftLeg, rightLeg, leftShin, rightShin,
    toolMeshes, heldTool, anim,

    velocity: new THREE.Vector3(),
    wishDir: new THREE.Vector3(),
    _forward: new THREE.Vector3(),
    _right: new THREE.Vector3(),
    _fwdLook: new THREE.Vector3(),

    setTool(index) {
      toolMeshes.forEach((t, i) => { if (t) t.visible = (i === index); });
    },
    triggerToolSwing() {
      anim.toolSwing.target = 1.5;
      anim.toolSwing.velocity += 10;
      setTimeout(() => { anim.toolSwing.target = 0; }, 200);
    },
  };

  return rig;
}

// ═══════════════════════════════════════════════════════════════
//  PLAYER ANIMATION UPDATE
// ═══════════════════════════════════════════════════════════════
export function updatePlayerAnimation(rig, state, dt, terrainHeightFn, HALF_WORLD) {
  const mv = state.movement;
  const speed = mv.shift ? 8.0 : 4.2;
  const yaw = state.cameraYaw;

  rig._forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  rig._right.set(Math.cos(yaw), 0, -Math.sin(yaw));

  rig.wishDir.set(0, 0, 0);
  if (mv.w) rig.wishDir.add(rig._forward);
  if (mv.s) rig.wishDir.sub(rig._forward);
  if (mv.d) rig.wishDir.add(rig._right);
  if (mv.a) rig.wishDir.sub(rig._right);
  if (rig.wishDir.lengthSq() > 0) rig.wishDir.normalize();

  rig.velocity.lerp(rig.wishDir.multiplyScalar(speed), Math.min(1, dt * 11));
  const moveAmt = rig.velocity.length();

  if (moveAmt > 0.05) {
    rig.root.position.addScaledVector(rig.velocity, dt);
    const tr = Math.atan2(rig.velocity.x, rig.velocity.z);
    rig.root.rotation.y = lerpAngle(rig.root.rotation.y, tr, Math.min(1, dt * 9));
  }

  rig.root.position.x = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.x));
  rig.root.position.z = Math.max(-HALF_WORLD + 3, Math.min(HALF_WORLD - 3, rig.root.position.z));
  rig.root.position.y = terrainHeightFn(rig.root.position.x, rig.root.position.z);

  // Walk cycle
  const walking = moveAmt > 0.3;
  rig.anim.walkAmp.target = walking ? Math.min(1, moveAmt / 4.5) : 0;
  stepSpring(rig.anim.walkAmp, dt);
  const s = rig.anim.walkAmp.value;
  rig.anim.walkCycle += dt * (walking ? 7 + moveAmt * 0.7 : 0);
  const phase = rig.anim.walkCycle;
  const sinP = Math.sin(phase);
  const cosP = Math.cos(phase);

  // Legs
  rig.anim.leftLegPitch.target = sinP * 0.55 * s;
  rig.anim.rightLegPitch.target = -sinP * 0.55 * s;
  rig.anim.leftShinPitch.target = Math.max(0, -sinP * 0.7) * s;
  rig.anim.rightShinPitch.target = Math.max(0, sinP * 0.7) * s;
  stepSpring(rig.anim.leftLegPitch, dt);
  stepSpring(rig.anim.rightLegPitch, dt);
  stepSpring(rig.anim.leftShinPitch, dt);
  stepSpring(rig.anim.rightShinPitch, dt);
  rig.leftLeg.rotation.x = rig.anim.leftLegPitch.value;
  rig.rightLeg.rotation.x = rig.anim.rightLegPitch.value;
  rig.leftShin.rotation.x = rig.anim.leftShinPitch.value;
  rig.rightShin.rotation.x = rig.anim.rightShinPitch.value;

  // Arms
  rig.anim.leftArmPitch.target = -sinP * 0.42 * s;
  rig.anim.rightArmPitch.target = sinP * 0.42 * s - rig.anim.toolSwing.value * 0.85;
  rig.anim.leftForearmPitch.target = -0.15 - Math.abs(sinP) * 0.25 * s;
  rig.anim.rightForearmPitch.target = -0.15 - rig.anim.toolSwing.value * 0.7;
  stepSpring(rig.anim.leftArmPitch, dt);
  stepSpring(rig.anim.rightArmPitch, dt);
  stepSpring(rig.anim.leftForearmPitch, dt);
  stepSpring(rig.anim.rightForearmPitch, dt);
  rig.leftArm.rotation.x = rig.anim.leftArmPitch.value;
  rig.rightArm.rotation.x = rig.anim.rightArmPitch.value;
  rig.leftForearm.rotation.x = rig.anim.leftForearmPitch.value;
  rig.rightForearm.rotation.x = rig.anim.rightForearmPitch.value;

  // Body
  rig.anim.hipsBob.target = Math.abs(sinP) * 0.08 * s - 0.02 * s;
  rig.anim.hipsTilt.target = cosP * 0.06 * s;
  rig.anim.spineTwist.target = -sinP * 0.12 * s;
  rig.anim.chestTwist.target = -sinP * 0.1 * s;
  rig.anim.headBob.target = Math.sin(phase * 2) * 0.015 * s;
  stepSpring(rig.anim.hipsBob, dt);
  stepSpring(rig.anim.hipsTilt, dt);
  stepSpring(rig.anim.spineTwist, dt);
  stepSpring(rig.anim.chestTwist, dt);
  stepSpring(rig.anim.headBob, dt);
  rig.hips.position.y = 0.88 + rig.anim.hipsBob.value;
  rig.hips.rotation.z = rig.anim.hipsTilt.value;
  rig.spine.rotation.y = rig.anim.spineTwist.value;
  rig.chest.rotation.y = rig.anim.chestTwist.value;
  rig.head.rotation.x = rig.anim.headBob.value;

  // Tool swing
  stepSpring(rig.anim.toolSwing, dt);
  rig.rightArm.rotation.z = -rig.anim.toolSwing.value * 0.28;

  // Hat bob
  rig.anim.hatBob.target = Math.sin(phase * 2) * 0.02 * s;
  stepSpring(rig.anim.hatBob, dt);
  rig.hat.rotation.x = rig.anim.hatBob.value;

  // Breath & idle
  rig.anim.idleTime += dt;
  rig.anim.breath = Math.sin(rig.anim.idleTime * 1.9) * 0.015 * (1 - s);
  rig.chest.scale.set(1 + rig.anim.breath, 1 - rig.anim.breath * 0.5, 1 + rig.anim.breath);
  rig.anim.headTurn.target = Math.sin(rig.anim.idleTime * 0.45) * 0.1 * (1 - s);
  stepSpring(rig.anim.headTurn, dt);
  rig.head.rotation.y = rig.anim.headTurn.value;
}

// ═══════════════════════════════════════════════════════════════
//  CAMERA RIG — landscape-friendly tilt + orbit + follow
// ═══════════════════════════════════════════════════════════════
export function createCameraRig(camera, playerRoot, state, terrainHeightFn) {
  const camTarget = new THREE.Vector3();
  const targetPos = new THREE.Vector3();
  const desired = new THREE.Vector3();

  // Landscape tilt — pitch ~1.0 rad gives a nice downward angle
  state.cameraYaw = 0;
  state.cameraPitch = 1.0;
  state.cameraDist = 12;

  function computeTarget() {
    targetPos.copy(playerRoot.position);
    targetPos.y += 1.35;
  }

  function positionCamera(immediate) {
    computeTarget();
    camTarget.lerp(targetPos, immediate ? 1 : 0.14);

    const x = Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;
    const y = Math.sin(state.cameraPitch) * state.cameraDist + 0.6;
    const z = Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;

    desired.set(camTarget.x + x, camTarget.y + y, camTarget.z + z);
    desired.y = Math.max(desired.y, terrainHeightFn(desired.x, desired.z) + 1.8);

    if (immediate) camera.position.copy(desired);
    else camera.position.lerp(desired, 0.14);

    camera.lookAt(camTarget);
  }

  return {
    snap() { computeTarget(); camTarget.copy(targetPos); positionCamera(true); },
    update(dt) { positionCamera(false); },
    orbit(dx, dy) {
      state.cameraYaw -= dx * 0.0032;
      state.cameraPitch = Math.max(0.28, Math.min(1.42, state.cameraPitch + dy * 0.0022));
    },
    zoom(deltaY) {
      state.cameraDist = Math.max(6, Math.min(24, state.cameraDist + deltaY * 0.008));
    },
    menuOrbit(dt, elapsed) {
      computeTarget();
      camTarget.lerp(targetPos, 0.1);
      const yaw = elapsed * 0.05 + 0.6;
      const pitch = 0.95;
      const dist = 15;
      const x = Math.sin(yaw) * Math.cos(pitch) * dist;
      const y = Math.sin(pitch) * dist + 0.6;
      const z = Math.cos(yaw) * Math.cos(pitch) * dist;
      camera.position.set(camTarget.x + x, camTarget.y + y, camTarget.z + z);
      camera.lookAt(camTarget);
    },
    togglePreset() {
      // cycle through 3 camera presets
      if (state.cameraPitch > 0.85 && state.cameraPitch < 1.15 && state.cameraDist < 14) {
        state.cameraPitch = 0.55;
        state.cameraDist = 15;
      } else if (state.cameraPitch < 0.7) {
        state.cameraPitch = 1.3;
        state.cameraDist = 9;
      } else {
        state.cameraPitch = 1.0;
        state.cameraDist = 12;
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  FARM GRID
// ═══════════════════════════════════════════════════════════════
export function createFarmGrid(scene, terrainHeightFn, GRID_SIZE, CELL_SIZE, HALF_GRID) {
  const group = new THREE.Group();
  scene.add(group);

  const matGrass = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0), roughness: 0.98 });
  const matTilled = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.15), roughness: 1.0 });
  const matWet = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.9), roughness: 0.7, metalness: 0.05 });
  const matFertilized = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.3), roughness: 0.95, emissive: 0x2a1a00, emissiveIntensity: 0.08 });

  const plotGeo = new THREE.BoxGeometry(CELL_SIZE * 0.94, 0.2, CELL_SIZE * 0.94);
  const cells = [];

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const px = (gx - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
      const pz = (gz - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
      const base = new THREE.Mesh(plotGeo, matGrass);
      base.position.set(px, 0.1, pz);
      base.receiveShadow = true;
      group.add(base);
      cells.push({
        gx, gz, x: px, z: pz,
        base,
        state: 'grass',
        cropType: null,
        growTime: 0,
        waterTime: 0,
        mesh: null,
        growthStage: -1,
        fertilized: false,
        hasPest: false,
        pestMesh: null,
      });
    }
  }

  // Fence
  const dummy = new THREE.Object3D();
  const posts = [], rails = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = (i - GRID_SIZE / 2) * CELL_SIZE;
    const edges = [
      [p, -HALF_GRID, 0], [p, HALF_GRID, 0],
      [-HALF_GRID, p, Math.PI / 2], [HALF_GRID, p, Math.PI / 2],
    ];
    for (const [x, z, rot] of edges) {
      posts.push({ x, y: 0.75, z, rot: 0 });
      if (i < GRID_SIZE) {
        const np = p + CELL_SIZE / 2;
        if (rot === 0) rails.push({ x: np, y: 0.92, z, rot: 0 });
        else rails.push({ x, y: 0.92, z: np, rot: Math.PI / 2 });
      }
    }
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), MATS.wood, posts.length);
  posts.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  group.add(postMesh);

  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, 0.1, 0.1), MATS.wood, rails.length);
  rails.forEach((r, i) => {
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(0, r.rot, 0);
    dummy.updateMatrix();
    railMesh.setMatrixAt(i, dummy.matrix);
  });
  railMesh.instanceMatrix.needsUpdate = true;
  railMesh.castShadow = true;
  group.add(railMesh);

  const FARM_TICK = 0.35;
  let farmTimer = 0;

  function cellAt(x, z) {
    const gx = Math.floor((x + HALF_GRID) / CELL_SIZE);
    const gz = Math.floor((z + HALF_GRID) / CELL_SIZE);
    if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return null;
    return cells[gz * GRID_SIZE + gx];
  }

  function updateCropMesh(cell) {
    if (cell.mesh) {
      group.remove(cell.mesh);
      cell.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      cell.mesh = null;
    }
    if ((cell.state === 'planted' || cell.state === 'harvestable') && cell.cropType) {
      cell.mesh = createCropMesh(cell.cropType, cell.growTime);
      cell.mesh.position.set(cell.x, 0.2, cell.z);
      group.add(cell.mesh);
    }
  }

  function spawnPest(cell) {
    if (cell.hasPest || cell.state !== 'planted') return;
    cell.hasPest = true;
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const bug = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 })
      );
      bug.position.set((Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
      bug.userData = { phase: Math.random() * Math.PI * 2 };
      g.add(bug);
    }
    cell.pestMesh = g;
    group.add(g);
    g.position.set(cell.x, 0, cell.z);
  }

  function clearPest(cell) {
    if (!cell.hasPest) return false;
    cell.hasPest = false;
    if (cell.pestMesh) {
      group.remove(cell.pestMesh);
      cell.pestMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      cell.pestMesh = null;
    }
    return true;
  }

  return {
    group, cells, cellAt, updateCropMesh, spawnPest, clearPest,
    matGrass, matTilled, matWet, matFertilized,

    update(dt, elapsed) {
      farmTimer += dt;
      while (farmTimer >= FARM_TICK) {
        farmTimer -= FARM_TICK;
        for (const cell of cells) {
          if (cell.state === 'planted' && cell.cropType) {
            const info = CROP_TYPES[cell.cropType];
            let rate = info.growRate;
            if (cell.base.material === matWet) rate *= info.wetMultiplier;
            if (cell.fertilized) rate *= 1.6;
            if (cell.hasPest) rate *= 0.3;
            cell.growTime = Math.min(1, cell.growTime + FARM_TICK * rate);
            const stage = cropStage(cell.growTime);
            if (stage !== cell.growthStage) {
              cell.growthStage = stage;
              updateCropMesh(cell);
            }
            if (cell.growTime >= 1) {
              cell.state = 'harvestable';
              updateCropMesh(cell);
            }
            // Random pest
            if (!cell.hasPest && Math.random() < 0.008) {
              spawnPest(cell);
            }
          }
          if (cell.waterTime > 0) {
            cell.waterTime -= FARM_TICK;
            if (cell.waterTime <= 0) {
              if (cell.base.material === matWet) {
                cell.base.material = cell.fertilized ? matFertilized :
                  (cell.state === 'grass' ? matGrass : matTilled);
              }
              if (cell.state === 'watered') cell.state = 'tilled';
            }
          }
          // Pest anim
          if (cell.pestMesh) {
            for (const bug of cell.pestMesh.children) {
              bug.position.y = 0.35 + Math.sin(elapsed * 4 + bug.userData.phase) * 0.08;
            }
          }
        }
      }
    },

    sway(elapsed) {
      for (const cell of cells) {
        if (cell.mesh) {
          const sway = Math.sin(elapsed * 1.5 + cell.gx * 0.3 + cell.gz * 0.4) * 0.05;
          cell.mesh.rotation.z = sway;
          cell.mesh.rotation.x = sway * 0.5;
        }
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  PLAYER ACTION — till / water / plant / harvest / pest
// ═══════════════════════════════════════════════════════════════
export function attemptAction(playerRig, state, farm, hud, chromaPass) {
  const now = performance.now() / 1000;
  if (now - state.lastActionTime < 0.3) return;
  state.lastActionTime = now;
  playerRig.triggerToolSwing();

  playerRig.root.getWorldDirection(playerRig._fwdLook);
  playerRig._fwdLook.y = 0;
  playerRig._fwdLook.normalize();

  const cell = farm.cellAt(
    playerRig.root.position.x + playerRig._fwdLook.x * 2.4,
    playerRig.root.position.z + playerRig._fwdLook.z * 2.4
  );
  if (!cell) return;

  const t = state.currentTool;

  // ── HOE ────────────────────────────────────────────────
  if (t === 0) {
    if (cell.state === 'grass') {
      cell.state = 'tilled';
      cell.base.material = farm.matTilled;
      cell.base.position.y = 0.08;
      bumpQuest(state, 'till');
      hud.update();
      hud.toast('Soil tilled');
      hud.spawnDust(cell.x, cell.z, 0x8b5a2a, 14);
      hud.feed('Soil tilled');
    } else if (cell.state === 'harvestable') {
      hud.toast('Harvest first (use pickaxe)');
    } else {
      hud.toast('Already tilled');
    }
  }

  // ── WATER ──────────────────────────────────────────────
  else if (t === 1) {
    if (state.water <= 0) {
      hud.toast('No water — refill at shop');
      return;
    }
    if (cell.state === 'tilled' || cell.state === 'planted' || cell.state === 'harvestable' || cell.state === 'watered') {
      state.water--;
      hud.update();
      hud.bumpPill('pillWater');
      cell.base.material = farm.matWet;
      cell.waterTime = 34;
      if (cell.state === 'tilled') cell.state = 'watered';
      hud.toast('Watered');
      hud.spawnDust(cell.x, cell.z, 0x88ccff, 16, 0.6);
    } else {
      hud.toast('Till the soil first');
    }
  }

  // ── SEED ───────────────────────────────────────────────
  else if (t === 2) {
    if (cell.state !== 'tilled' && cell.state !== 'watered') {
      hud.toast('Till the soil first');
      return;
    }
    if (cell.cropType) {
      hud.toast('Already planted');
      return;
    }
    const crop = state.selectedCrop || 'tomato';
    if (state.inventory[crop] <= 0) {
      hud.toast(`No ${CROP_TYPES[crop].name} seeds — visit shop`);
      return;
    }
    state.inventory[crop]--;
    cell.state = 'planted';
    cell.cropType = crop;
    cell.growTime = 0.02;
    cell.growthStage = 0;
    farm.updateCropMesh(cell);
    hud.update();
    hud.buildHotbar();
    bumpQuest(state, 'plant');
    hud.toast(`${CROP_TYPES[crop].emoji} ${CROP_TYPES[crop].name} planted`);
    hud.spawnDust(cell.x, cell.z, 0xffdd66, 10, 0.6);
  }

  // ── HARVEST ────────────────────────────────────────────
  else if (t === 3) {
    if (cell.state === 'harvestable' && cell.cropType) {
      const info = CROP_TYPES[cell.cropType];
      state.cropsHarvested++;
      state.coins += info.value;
      state.inventory[cell.cropType] = (state.inventory[cell.cropType] || 0) + 1;
      cell.state = 'tilled';
      cell.cropType = null;
      cell.growTime = 0;
      cell.growthStage = -1;
      cell.fertilized = false;
      cell.base.material = farm.matTilled;
      farm.clearPest(cell);
      farm.updateCropMesh(cell);
      hud.update();
      hud.buildHotbar();
      bumpQuest(state, 'harvest');
      bumpQuest(state, 'earn', info.value);
      hud.toast(`+${info.value}🪙 · ${info.emoji} harvested`);
      hud.spawnDust(cell.x, cell.z, 0xff6a3a, 20, 1.0);
      state.shakeTime = 1.2;
      state.hitStop = 0.05;
      if (chromaPass) chromaPass.uniforms.amount.value = 0.55;
      hud.feed(`+${info.value}🪙`);
    } else {
      hud.toast('Nothing to harvest');
    }
  }

  // ── PEST SPRAY ─────────────────────────────────────────
  else if (t === 4) {
    if (farm.clearPest(cell)) {
      hud.toast('Pest removed');
      hud.spawnDust(cell.x, cell.z, 0x88ff88, 12, 0.6);
    } else if (cell.state === 'grass') {
      hud.toast('Nothing here');
    } else {
      hud.toast('No pests here');
    }
  }

  // ── SHOP ───────────────────────────────────────────────
  else if (t === 5) {
    hud.toggleShop();
  }
}

// ═══════════════════════════════════════════════════════════════
//  STATE FACTORY
// ═══════════════════════════════════════════════════════════════
export function createState() {
  return {
    coins: 50,
    cropsHarvested: 0,
    water: 15,
    maxWater: 15,
    currentTool: 0,
    selectedCrop: 'tomato',
    inventory: { tomato: 5, corn: 0, pumpkin: 0 },
    seeds: { tomato: 5, corn: 0, pumpkin: 0 },
    timeOfDay: 0.28,
    dayLength: 300,
    dayCount: 1,
    started: false,
    paused: false,
    movement: { w: false, a: false, s: false, d: false, shift: false },
    joystick: { active: false, dx: 0, dy: 0 },
    quests: [
      { id: 'till', text: 'Plow 4 plots', target: 4, current: 0, done: false },
      { id: 'plant', text: 'Plant 3 seeds', target: 3, current: 0, done: false },
      { id: 'harvest', text: 'Harvest 2 crops', target: 2, current: 0, done: false },
      { id: 'earn', text: 'Earn 100 coins', target: 100, current: 0, done: false },
      { id: 'corn', text: 'Plant & harvest corn', target: 1, current: 0, done: false },
    ],
    shakeTime: 0,
    hitStop: 0,
    cameraYaw: 0,
    cameraPitch: 1.0,
    cameraDist: 12,
    lastActionTime: 0,
  };
}

// ── Quest helper ───────────────────────────────────────────
function bumpQuest(state, id, amount = 1) {
  const q = state.quests.find(q => q.id === id);
  if (q && !q.done) {
    q.current += amount;
    if (q.current >= q.target) {
      q.done = true;
      state.coins += 25;
      const hud = window.__hudRef;
      if (hud) {
        hud.toast(`✧ ${q.text} complete! +25🪙`);
        hud.feed(`Quest complete: ${q.text}`);
        hud.update();
        hud.updateQuests();
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  ANIMALS
// ═══════════════════════════════════════════════════════════════
export function createAnimals(scene, terrainHeightFn, HALF_GRID) {
  const animals = [];
  const specs = [
    { make: createSheep, count: 4, name: 'sheep' },
    { make: createChicken, count: 6, name: 'chicken' },
    { make: createCow, count: 2, name: 'cow' },
  ];

  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const mesh = spec.make();
      const a = Math.random() * Math.PI * 2;
      const dist = HALF_GRID + 4 + Math.random() * 12;
      const x = Math.cos(a) * dist;
      const z = Math.sin(a) * dist;
      mesh.position.set(x, terrainHeightFn(x, z), z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      animals.push({
        mesh,
        type: spec.name,
        targetX: x,
        targetZ: z,
        speed: spec.name === 'chicken' ? 1.2 : spec.name === 'sheep' ? 0.7 : 0.5,
        idleTime: Math.random() * 4,
        wanderRadius: spec.name === 'chicken' ? 8 : 10,
        homeX: x,
        homeZ: z,
        bob: Math.random() * Math.PI * 2,
      });
    }
  }

  return {
    animals,
    update(dt, elapsed) {
      for (const a of animals) {
        a.idleTime -= dt;
        const dx = a.targetX - a.mesh.position.x;
        const dz = a.targetZ - a.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.4) {
          if (a.idleTime <= 0) {
            // Pick new wander target near home
            const nx = a.homeX + (Math.random() - 0.5) * a.wanderRadius * 2;
            const nz = a.homeZ + (Math.random() - 0.5) * a.wanderRadius * 2;
            a.targetX = nx;
            a.targetZ = nz;
            a.idleTime = 2 + Math.random() * 4;
          }
        } else {
          // Move toward target
          const step = a.speed * dt;
          a.mesh.position.x += (dx / dist) * step;
          a.mesh.position.z += (dz / dist) * step;
          a.mesh.rotation.y = lerpAngle(a.mesh.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 4));
          // Bobbing
          a.bob += dt * 8;
          a.mesh.position.y = terrainHeightFn(a.mesh.position.x, a.mesh.position.z) + Math.abs(Math.sin(a.bob)) * 0.08;
        }
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  DECORATIONS — barn, house, silo, crates, barrels, hay, scarecrow
// ═══════════════════════════════════════════════════════════════
export function createDecorations(scene, terrainHeightFn, HALF_GRID) {
  const decor = [];

  // Scarecrow in the middle of the farm
  const scarecrow = createScarecrow();
  scarecrow.position.set(0, terrainHeightFn(0, 0), 0);
  scene.add(scarecrow);
  decor.push(scarecrow);

  // Crates & barrels near the farm edge
  for (let i = 0; i < 3; i++) {
    const crate = createCrate();
    const x = -HALF_GRID + 2 + i * 1.2;
    const z = HALF_GRID + 3;
    crate.position.set(x, terrainHeightFn(x, z), z);
    crate.rotation.y = Math.random() * 0.4 - 0.2;
    scene.add(crate);
    decor.push(crate);
  }
  for (let i = 0; i < 3; i++) {
    const barrel = createBarrel();
    const x = HALF_GRID - 2 - i * 1.0;
    const z = HALF_GRID + 3;
    barrel.position.set(x, terrainHeightFn(x, z), z);
    scene.add(barrel);
    decor.push(barrel);
  }
  // Hay bales
  for (let i = 0; i < 4; i++) {
    const hay = createHayBale();
    const x = HALF_GRID + 5 + i * 1.3;
    const z = HALF_GRID + 2;
    hay.position.set(x, terrainHeightFn(x, z), z);
    hay.rotation.y = Math.random() * Math.PI;
    scene.add(hay);
    decor.push(hay);
  }

  return { decor };
}

// ═══════════════════════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════════════════════
export function createHUD(state) {
  const $coins = document.getElementById('coins');
  const $crops = document.getElementById('crops');
  const $water = document.getElementById('water');
  const $day = document.getElementById('day');
  const $hotbar = document.getElementById('hotbar');
  const $toast = document.getElementById('toast');
  const $shop = document.getElementById('shop');
  const $journal = document.getElementById('journal');
  const $questList = document.getElementById('quest-list');
  const $feed = document.getElementById('feed');
  const $clockTime = document.getElementById('clockTime');
  const $weatherIcon = document.getElementById('weatherIcon');
  const $weatherText = document.getElementById('weatherText');
  const $actionBtn = document.getElementById('actionBtn');

  const chime = (f = 880, d = 0.22, t = 'sine', v = 0.04) => {
    if (window.__audio) window.__audio.playChime(f, d, t, v);
  };

  let toastTimer = null;

  const hud = {
    update() {
      $coins.textContent = state.coins;
      $crops.textContent = state.cropsHarvested;
      $water.textContent = state.water;
      $day.textContent = state.dayCount;
      const sc = document.getElementById('seed-count');
      if (sc) sc.textContent = state.inventory[state.selectedCrop] || 0;
      this.updateQuests();
    },

    updateQuests() {
      $questList.innerHTML = state.quests.map(q =>
        `<div class="quest ${q.current >= q.target ? 'done' : ''}">
          <span>${q.text}</span>
          <span>${Math.min(q.current, q.target)}/${q.target}</span>
        </div>`
      ).join('');
    },

    buildHotbar() {
      $hotbar.innerHTML = '';
      TOOL_DEFS.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = 'slot' + (i === state.currentTool ? ' active' : '');
        el.innerHTML = `<span>${t.icon}</span><span class="lbl">${t.label}</span>`;
        if (t.id === 'seed') {
          const count = state.inventory[state.selectedCrop] || 0;
          el.insertAdjacentHTML('beforeend', `<span class="cnt" id="seed-count">${count}</span>`);
        }
        el.addEventListener('click', e => {
          e.stopPropagation();
          hud.selectTool(i);
        });
        $hotbar.appendChild(el);
      });
      // update action button icon
      if ($actionBtn) $actionBtn.textContent = TOOL_DEFS[state.currentTool].icon;
    },

    selectTool(i) {
      state.currentTool = i;
      const rig = window.__playerRig;
      if (rig) rig.setTool(i);
      hud.buildHotbar();
      if (i === 5) hud.toggleShop();
    },

    toggleShop(force) {
      if (force === true) $shop.classList.add('open');
      else if (force === false) $shop.classList.remove('open');
      else $shop.classList.toggle('open');
    },

    toggleJournal(force) {
      if (force === true) $journal.classList.add('open');
      else if (force === false) $journal.classList.remove('open');
      else $journal.classList.toggle('open');
    },

    toast(msg) {
      $toast.textContent = msg;
      $toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
      chime();
    },

    feed(msg) {
      const el = document.createElement('div');
      el.className = 'feed-item';
      el.textContent = msg;
      $feed.appendChild(el);
      setTimeout(() => el.classList.add('fade'), 2000);
      setTimeout(() => el.remove(), 2600);
      // keep max 4 items
      while ($feed.children.length > 4) $feed.removeChild($feed.firstChild);
    },

    bumpPill(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    },

    spawnDust(x, z, color, count = 12, up = 1.8) {
      if (window.__spawnDust) window.__spawnDust(x, z, color, count, up);
    },

    updateClock(t, weather) {
      const totalMin = t * 24 * 60;
      const h = Math.floor(totalMin / 60);
      const m = Math.floor(totalMin % 60);
      $clockTime.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      if (weather) {
        $weatherIcon.textContent = weather.icon;
        $weatherText.textContent = weather.text;
      }
    },

    updateWeatherIcon(icon, text) {
      $weatherIcon.textContent = icon;
      $weatherText.textContent = text;
    },
  };

  // Shop
  document.querySelectorAll('.shop-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const buy = item.dataset.buy;
      let bought = false;

      if (buy === 'seed') {
        if (state.coins >= 5) {
          state.coins -= 5;
          state.inventory.tomato = (state.inventory.tomato || 0) + 1;
          hud.toast('+1 🍅 Tomato Seed');
          bought = true;
        }
      } else if (buy === 'corn') {
        if (state.coins >= 8) {
          state.coins -= 8;
          state.inventory.corn = (state.inventory.corn || 0) + 1;
          hud.toast('+1 🌽 Corn Seed');
          bought = true;
        }
      } else if (buy === 'pumpkin') {
        if (state.coins >= 12) {
          state.coins -= 12;
          state.inventory.pumpkin = (state.inventory.pumpkin || 0) + 1;
          hud.toast('+1 🎃 Pumpkin Seed');
          bought = true;
        }
      } else if (buy === 'water') {
        if (state.coins >= 3) {
          state.coins -= 3;
          state.water = state.maxWater;
          hud.toast('Watering can refilled');
          hud.bumpPill('pillWater');
          bought = true;
        }
      } else if (buy === 'fertilizer') {
        if (state.coins >= 6) {
          state.coins -= 6;
          state.fertilizer = (state.fertilizer || 0) + 1;
          hud.toast('+1 💩 Fertilizer');
          bought = true;
        }
      }

      if (!bought) hud.toast('Not enough coins');
      hud.update();
      hud.buildHotbar();
    });
  });

  window.__hudRef = hud;
  return hud;
}

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD
// ═══════════════════════════════════════════════════════════════
export function saveGame(state, farm) {
  try {
    const data = {
      coins: state.coins,
      cropsHarvested: state.cropsHarvested,
      water: state.water,
      dayCount: state.dayCount,
      timeOfDay: state.timeOfDay,
      inventory: { ...state.inventory },
      selectedCrop: state.selectedCrop,
      quests: state.quests.map(q => ({ ...q })),
      cells: farm.cells.map(c => ({
        state: c.state,
        cropType: c.cropType,
        growTime: c.growTime,
        fertilized: c.fertilized,
        hasPest: c.hasPest,
      })),
    };
    localStorage.setItem('verdant-vale-save', JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame(state, farm) {
  try {
    const raw = localStorage.getItem('verdant-vale-save');
    if (!raw) return false;
    const data = JSON.parse(raw);

    state.coins = data.coins ?? state.coins;
    state.cropsHarvested = data.cropsHarvested ?? state.cropsHarvested;
    state.water = data.water ?? state.water;
    state.dayCount = data.dayCount ?? 1;
    state.timeOfDay = data.timeOfDay ?? 0.28;
    state.inventory = { ...state.inventory, ...data.inventory };
    state.selectedCrop = data.selectedCrop || 'tomato';
    if (data.quests) state.quests = data.quests;

    if (data.cells && data.cells.length === farm.cells.length) {
      data.cells.forEach((cd, i) => {
        const cell = farm.cells[i];
        cell.state = cd.state;
        cell.cropType = cd.cropType;
        cell.growTime = cd.growTime || 0;
        cell.fertilized = !!cd.fertilized;
        cell.hasPest = !!cd.hasPest;
        if (cell.state === 'tilled' || cell.state === 'watered') {
          cell.base.material = farm.matTilled;
          cell.base.position.y = 0.08;
        }
        farm.updateCropMesh(cell);
        if (cell.hasPest) farm.spawnPest(cell);
      });
    }
    return true;
  } catch (e) {
    console.warn('Load failed', e);
    return false;
  }
}