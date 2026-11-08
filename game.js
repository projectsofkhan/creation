import * as THREE from 'three';
import { CELL_SIZE, GRID_SIZE, HALF_GRID, HALF_WORLD, terrainHeight } from './script.js';
import { createCropMesh, CROP_STAGES, TOOL_DEFS, createHoe, createWateringCan, createSeedPouch, createBasket, makeSoilTexture } from './others.js';

// ── Spring (smooth damped animation driver) ──────────────────
export function makeSpring(v = 0, s = 180, d = 18) {
  return { value: v, target: v, velocity: 0, stiffness: s, damping: d };
}
export function stepSpring(sp, dt) {
  sp.velocity += (sp.target - sp.value) * sp.stiffness * dt;
  sp.velocity *= Math.max(0, 1 - sp.damping * dt);
  sp.value += sp.velocity * dt;
}

// ── Player rig ───────────────────────────────────────────────
export function createPlayer() {
  const root = new THREE.Group();

  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.85;
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

  // Materials — realistic skin, cloth, leather
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8bfa0, roughness: 0.75, metalness: 0.02 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4a8bc8, roughness: 0.9, metalness: 0.0 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.92 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.85 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.85, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 });

  // Legs
  for (const [legGrp, shinGrp, side] of [
    [leftLeg, leftShin, -1], [rightLeg, rightShin, 1],
  ]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 4, 10), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    legGrp.add(thigh);
    legGrp.position.set(side * 0.19, 0, 0);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.4, 4, 10), pantsMat);
    shin.position.y = -0.24;
    shin.castShadow = true;
    shin.receiveShadow = true;
    shinGrp.add(shin);
    shinGrp.position.y = -0.44;
    legGrp.add(shinGrp);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.4), bootMat);
    boot.position.set(0, -0.52, 0.06);
    boot.castShadow = true;
    boot.receiveShadow = true;
    shinGrp.add(boot);

    hips.add(legGrp);
  }

  // Belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16), beltMat);
  belt.position.y = 0.1;
  belt.castShadow = true;
  hips.add(belt);

  // Torso
  const torsoLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.32, 4, 12), shirtMat);
  torsoLower.position.y = 0.32;
  torsoLower.castShadow = true;
  torsoLower.receiveShadow = true;
  spine.add(torsoLower);

  const torsoUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.28, 4, 12), shirtMat);
  torsoUpper.position.y = 0.32;
  torsoUpper.castShadow = true;
  torsoUpper.receiveShadow = true;
  chest.add(torsoUpper);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), shirtMat);
    shoulder.position.set(side * 0.32, 0.28, 0);
    shoulder.castShadow = true;
    chest.add(shoulder);
  }

  // Arms
  for (const [armGrp, forearmGrp, side] of [
    [leftArm, leftForearm, -1], [rightArm, rightForearm, 1],
  ]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 4, 8), shirtMat);
    upper.position.y = -0.2;
    upper.castShadow = true;
    upper.receiveShadow = true;
    armGrp.add(upper);
    armGrp.position.set(side * 0.38, 0.25, 0);
    chest.add(armGrp);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), skinMat);
    fore.position.y = -0.2;
    fore.castShadow = true;
    fore.receiveShadow = true;
    forearmGrp.add(fore);
    forearmGrp.position.y = -0.4;
    armGrp.add(forearmGrp);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skinMat);
    hand.position.y = -0.24;
    hand.castShadow = true;
    forearmGrp.add(hand);
  }

  // Neck & head
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.15, 8), skinMat);
  neckMesh.position.y = 0.18;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), skinMat);
  headMesh.scale.set(1, 1.08, 0.98);
  headMesh.position.y = 0.32;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // Hair
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), hairMat);
    const a = (i / 6) * Math.PI * 2;
    h.position.set(Math.cos(a) * 0.2, 0.42 + Math.sin(a) * 0.07, Math.sin(a) * 0.18 - 0.05);
    h.scale.set(1.3, 0.9, 1.0);
    head.add(h);
  }
  for (const side of [-1, 1]) {
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.13), hairMat);
    sb.position.set(side * 0.24, 0.28, 0.08);
    head.add(sb);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.2 })
    );
    eye.position.set(side * 0.1, 0.34, 0.26);
    head.add(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), hairMat);
    brow.position.set(side * 0.1, 0.4, 0.27);
    brow.rotation.z = side * 0.05;
    head.add(brow);
  }

  // Hat
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.05, 20), hatMat);
  brim.position.y = 0.55;
  brim.castShadow = true;
  hat.add(brim);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.32, 16), hatMat);
  top.position.y = 0.72;
  top.castShadow = true;
  hat.add(top);

  // Tools
  const heldTool = new THREE.Group();
  rightForearm.add(heldTool);
  heldTool.position.set(0, -0.24, 0.04);

  const tools = [
    createHoe(),
    createWateringCan(),
    createSeedPouch(),
    createBasket(),
    null,
  ];
  for (let i = 0; i < 4; i++) heldTool.add(tools[i]);
  tools.forEach((t, i) => { if (t) t.visible = (i === 0); });

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

  // Velocity
  const velocity = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _fwdLook = new THREE.Vector3();

  return {
    root, body, hips, spine, chest, neck, head, hat,
    leftArm, rightArm, leftForearm, rightForearm,
    leftLeg, rightLeg, leftShin, rightShin,
    tools, heldTool,
    anim, velocity, wishDir,
    _forward, _right, _fwdLook,

    setTool(index) {
      tools.forEach((t, i) => { if (t) t.visible = (i === index); });
    },

    triggerToolSwing() {
      anim.toolSwing.target = 1.5;
      anim.toolSwing.velocity += 10;
      setTimeout(() => { anim.toolSwing.target = 0; }, 200);
    },
  };
}

// ── Player animation update ──────────────────────────────────
export function updatePlayerAnimation(rig, state, dt, terrainHeightFn) {
  const mv = state.movement;
  const speed = mv.shift ? 7.5 : 4.0;

  // Direction relative to camera yaw (handled in camRig — we use state.cameraYaw)
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

  // Clamp to world
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
  rig.hips.position.y = 0.85 + rig.anim.hipsBob.value;
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

// ── Camera rig ───────────────────────────────────────────────
export function createCameraRig(camera, playerRoot, state, terrainHeightFn) {
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  // state.cameraYaw, state.cameraPitch, state.cameraDist already in state
  state.cameraYaw = 0;
  state.cameraPitch = 0.95;  // more downward tilt for mobile
  state.cameraDist = 11;

  function computeTarget() {
    target.copy(playerRoot.position);
    target.y += 1.3;
  }

  function positionCamera(immediate) {
    computeTarget();
    camTarget.lerp(target, immediate ? 1 : 0.14);

    const x = Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;
    const y = Math.sin(state.cameraPitch) * state.cameraDist + 0.8;
    const z = Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;

    desired.set(camTarget.x + x, camTarget.y + y, camTarget.z + z);
    desired.y = Math.max(desired.y, terrainHeightFn(desired.x, desired.z) + 1.6);

    if (immediate) camera.position.copy(desired);
    else camera.position.lerp(desired, 0.14);

    camera.lookAt(camTarget);
  }

  return {
    snap() {
      computeTarget();
      camTarget.copy(target);
      positionCamera(true);
    },
    update(dt) {
      positionCamera(false);
    },
    orbit(dx, dy) {
      state.cameraYaw -= dx * 0.0032;
      state.cameraPitch = Math.max(0.3, Math.min(1.4, state.cameraPitch + dy * 0.0022));
    },
    zoom(deltaY) {
      state.cameraDist = Math.max(6, Math.min(22, state.cameraDist + deltaY * 0.008));
    },
    menuOrbit(dt, elapsed) {
      computeTarget();
      camTarget.lerp(target, 0.1);
      const yaw = elapsed * 0.06 + 0.5;
      const pitch = 0.9;
      const dist = 14;
      const x = Math.sin(yaw) * Math.cos(pitch) * dist;
      const y = Math.sin(pitch) * dist + 0.8;
      const z = Math.cos(yaw) * Math.cos(pitch) * dist;
      camera.position.set(camTarget.x + x, camTarget.y + y, camTarget.z + z);
      camera.lookAt(camTarget);
    },
  };
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ── Farm grid ────────────────────────────────────────────────
export function createFarmGrid(scene, terrainHeightFn) {
  const group = new THREE.Group();

  const matGrass = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0), roughness: 0.98, metalness: 0.0 });
  const matTilled = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.15), roughness: 1.0, metalness: 0.0 });
  const matWet = new THREE.MeshStandardMaterial({ map: makeSoilTexture(0.9), roughness: 0.72, metalness: 0.05 });

  const plotGeo = new THREE.BoxGeometry(CELL_SIZE * 0.94, 0.2, CELL_SIZE * 0.94);
  const cells = [];

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const px = (gx - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
      const pz = (gz - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
      const base = new THREE.Mesh(plotGeo, matGrass);
      base.position.set(px, 0.1, pz);
      base.receiveShadow = true;
      base.castShadow = false;
      group.add(base);
      cells.push({
        gx, gz, x: px, z: pz,
        base,
        state: 'grass',
        growTime: 0,
        waterTime: 0,
        mesh: null,
        growthStage: -1,
      });
    }
  }

  // Fence (thin posts around the grid)
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.92 });
  const postGeo = new THREE.BoxGeometry(0.22, 1.5, 0.22);
  const postList = [];
  const railList = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = (i - GRID_SIZE / 2) * CELL_SIZE;
    const edges = [
      [p, -HALF_GRID, 0], [p, HALF_GRID, 0],
      [-HALF_GRID, p, Math.PI / 2], [HALF_GRID, p, Math.PI / 2],
    ];
    for (const [x, z, rot] of edges) {
      postList.push({ x, y: 0.75, z, rot: 0 });
      if (i < GRID_SIZE) {
        const np = p + CELL_SIZE / 2;
        if (rot === 0) railList.push({ x: np, y: 0.9, z, rot: 0 });
        else railList.push({ x, y: 0.9, z: np, rot: Math.PI / 2 });
      }
    }
  }
  const dummy = new THREE.Object3D();
  const postMesh = new THREE.InstancedMesh(postGeo, woodMat, postList.length);
  postList.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  group.add(postMesh);

  const railGeo = new THREE.BoxGeometry(CELL_SIZE, 0.1, 0.1);
  const railMesh = new THREE.InstancedMesh(railGeo, woodMat, railList.length);
  railList.forEach((r, i) => {
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
    if (cell.state === 'planted' || cell.state === 'harvestable') {
      cell.mesh = createCropMesh(cell.growTime);
      cell.mesh.position.set(cell.x, 0.2, cell.z);
      group.add(cell.mesh);
    }
  }

  return {
    group,
    cells,
    cellAt,
    updateCropMesh,
    matGrass,
    matTilled,
    matWet,

    update(dt, elapsed) {
      farmTimer += dt;
      while (farmTimer >= FARM_TICK) {
        farmTimer -= FARM_TICK;
        for (const cell of cells) {
          if (cell.state === 'planted') {
            let rate = 0.006;
            if (cell.base.material === matWet) rate *= 2.6;
            cell.growTime = Math.min(1, cell.growTime + FARM_TICK * rate);
            const stage = cropStageOf(cell.growTime);
            if (stage !== cell.growthStage) {
              cell.growthStage = stage;
              updateCropMesh(cell);
            }
            if (cell.growTime >= 1) {
              cell.state = 'harvestable';
              updateCropMesh(cell);
            }
          }
          if (cell.waterTime > 0) {
            cell.waterTime -= FARM_TICK;
            if (cell.waterTime <= 0) {
              if (cell.base.material === matWet) {
                cell.base.material = (cell.state === 'grass') ? matGrass : matTilled;
              }
              if (cell.state === 'watered') cell.state = 'tilled';
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

function cropStageOf(g) {
  if (g < 0.25) return 0;
  if (g < 0.6) return 1;
  if (g < 0.9) return 2;
  return 3;
}

// ── Player action (till / water / plant / harvest) ───────────
export function attemptAction(playerRig, state, farm, hud, chromaPass) {
  const now = performance.now() / 1000;
  if (now - state.lastActionTime < 0.28) return;
  state.lastActionTime = now;
  playerRig.triggerToolSwing();

  // Facing direction on XZ plane
  playerRig.root.getWorldDirection(playerRig._fwdLook);
  playerRig._fwdLook.y = 0;
  playerRig._fwdLook.normalize();

  const cell = farm.cellAt(
    playerRig.root.position.x + playerRig._fwdLook.x * 2.2,
    playerRig.root.position.z + playerRig._fwdLook.z * 2.2
  );
  if (!cell) return;

  const t = state.currentTool;

  if (t === 0 && cell.state === 'grass') {
    cell.state = 'tilled';
    cell.base.material = farm.matTilled;
    cell.base.position.y = 0.08;
    bumpQuest(state, 'till');
    hud.update();
    hud.toast('Soil tilled');
    hud.spawnDust(cell.x, cell.z, 0x8b5a2a, 14);
  } else if (t === 1 && state.water > 0 &&
             (cell.state === 'tilled' || cell.state === 'planted' || cell.state === 'harvestable')) {
    state.water--;
    hud.update();
    cell.base.material = farm.matWet;
    cell.waterTime = 32;
    if (cell.state === 'tilled') cell.state = 'watered';
    hud.toast('Watered');
    hud.spawnDust(cell.x, cell.z, 0x88ccff, 16, 0.5);
  } else if (t === 2 && state.inventory.seed > 0 &&
             (cell.state === 'tilled' || cell.state === 'watered')) {
    state.inventory.seed--;
    cell.state = 'planted';
    cell.growTime = 0.02;
    cell.growthStage = 0;
    farm.updateCropMesh(cell);
    hud.update();
    hud.buildHotbar();
    bumpQuest(state, 'plant');
    hud.toast('Seed planted');
    hud.spawnDust(cell.x, cell.z, 0xffdd66, 10, 0.6);
  } else if (t === 3 && cell.state === 'harvestable') {
    state.cropsHarvested++;
    state.coins += 12;
    cell.state = 'tilled';
    cell.growTime = 0;
    cell.growthStage = -1;
    cell.base.material = farm.matTilled;
    farm.updateCropMesh(cell);
    hud.update();
    bumpQuest(state, 'harvest');
    bumpQuest(state, 'earn', 12);
    hud.toast('+12🪙 · 🍅 harvested');
    state.shakeTime = 1.2;
    state.hitStop = 0.05;
    if (chromaPass) chromaPass.uniforms.amount.value = 0.55;
    hud.spawnDust(cell.x, cell.z, 0xff6a3a, 20, 1.0);
  } else {
    if (t === 1 && state.water <= 0) hud.toast('No water — visit the shop');
    else if (t === 2 && state.inventory.seed <= 0) hud.toast('No seeds — visit the shop');
    else if (t === 3 && cell.state !== 'harvestable') hud.toast('Nothing to harvest here');
  }
}

// ── State ────────────────────────────────────────────────────
export function createState() {
  return {
    coins: 25,
    cropsHarvested: 0,
    water: 10,
    maxWater: 10,
    currentTool: 0,
    inventory: { seed: 3 },
    timeOfDay: 0.28,
    dayLength: 300,
    started: false,
    movement: { w: false, a: false, s: false, d: false, shift: false },
    quests: [
      { id: 'till', text: 'Plow 4 plots', target: 4, current: 0, done: false },
      { id: 'plant', text: 'Plant 3 seeds', target: 3, current: 0, done: false },
      { id: 'harvest', text: 'Harvest 2 tomatoes', target: 2, current: 0, done: false },
      { id: 'earn', text: 'Earn 60 coins', target: 60, current: 0, done: false },
    ],
    shakeTime: 0,
    hitStop: 0,
    cameraYaw: 0,
    cameraPitch: 0.95,
    cameraDist: 11,
    lastActionTime: 0,
  };
}

// ── Quest helpers ────────────────────────────────────────────
function bumpQuest(state, id, amount = 1) {
  const q = state.quests.find(q => q.id === id);
  if (q && !q.done) {
    q.current += amount;
    if (q.current >= q.target) {
      q.done = true;
      state.coins += 15;
      const hud = window.__hudRef;
      if (hud) {
        hud.toast(`✧ ${q.text} complete! +15🪙`);
        hud.update();
      }
    }
  }
}

// ── HUD ──────────────────────────────────────────────────────
export function createHUD(state) {
  const $coins = document.getElementById('coins');
  const $crops = document.getElementById('crops');
  const $water = document.getElementById('water');
  const $hotbar = document.getElementById('hotbar');
  const $toast = document.getElementById('toast');
  const $shop = document.getElementById('shop');

  const chime = (f = 880, d = 0.22, t = 'sine', v = 0.04) => {
    if (window.__audio) window.__audio.playChime(f, d, t, v);
  };

  let toastTimer = null;

  const hud = {
    update() {
      $coins.textContent = state.coins;
      $crops.textContent = state.cropsHarvested;
      $water.textContent = state.water;
      const sc = document.getElementById('seed-count');
      if (sc) sc.textContent = state.inventory.seed;
    },

    buildHotbar() {
      $hotbar.innerHTML = '';
      TOOL_DEFS.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = 'slot' + (i === state.currentTool ? ' active' : '');
        el.innerHTML = `<span>${t.icon}</span><span class="lbl">${t.label}</span>`;
        if (i === 2) {
          el.insertAdjacentHTML('beforeend', `<span class="cnt" id="seed-count">${state.inventory.seed}</span>`);
        }
        el.addEventListener('click', e => {
          e.stopPropagation();
          hud.selectTool(i);
        });
        $hotbar.appendChild(el);
      });
    },

    selectTool(i) {
      state.currentTool = i;
      const rig = window.__playerRig;
      if (rig) rig.setTool(i);
      hud.buildHotbar();
      if (i === 4) hud.toggleShop();
    },

    toggleShop(force) {
      if (force === true) $shop.classList.add('open');
      else if (force === false) $shop.classList.remove('open');
      else $shop.classList.toggle('open');
    },

    toast(msg) {
      $toast.textContent = msg;
      $toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
      chime();
    },

    spawnDust(x, z, color, count = 12, up = 1.8) {
      if (window.__spawnDust) {
        window.__spawnDust(x, z, color, count, up);
      }
    },
  };

  // Wire shop items
  document.querySelectorAll('.shop-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const buy = item.dataset.buy;
      if (buy === 'seed' && state.coins >= 5) {
        state.coins -= 5;
        state.inventory.seed++;
        hud.toast('+1 Tomato Seed');
      } else if (buy === 'water' && state.coins >= 3) {
        state.coins -= 3;
        state.water = state.maxWater;
        hud.toast('Watering can refilled');
      } else {
        hud.toast('Not enough coins');
      }
      hud.update();
      hud.buildHotbar();
    });
  });

  // Expose to game.js
  window.__hudRef = hud;

  return hud;
}