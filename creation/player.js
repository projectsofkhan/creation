import * as THREE from 'three';

// ── Spring helper ──
function makeSpring(v = 0, s = 180, d = 18) {
  return { value: v, target: v, velocity: 0, stiffness: s, damping: d };
}
function stepSpring(sp, dt) {
  sp.velocity += (sp.target - sp.value) * sp.stiffness * dt;
  sp.velocity *= Math.max(0, 1 - sp.damping * dt);
  sp.value += sp.velocity * dt;
}

// ── Build the player rig ──
export function buildPlayer(scene) {
  const player = new THREE.Group();
  scene.add(player);

  const rig = {
    root: player, body: new THREE.Group(), hips: new THREE.Group(), spine: new THREE.Group(),
    chest: new THREE.Group(), neck: new THREE.Group(), head: new THREE.Group(), hat: new THREE.Group(),
    leftArm: new THREE.Group(), rightArm: new THREE.Group(),
    leftForearm: new THREE.Group(), rightForearm: new THREE.Group(),
    leftLeg: new THREE.Group(), rightLeg: new THREE.Group(),
    leftShin: new THREE.Group(), rightShin: new THREE.Group(),
  };

  const skinMat  = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.82 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4a8bc8, roughness: 0.88 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3a5a8a, roughness: 0.92 });
  const hatMat   = new THREE.MeshStandardMaterial({ color: 0xd8a840, roughness: 0.85 });
  const bootMat  = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 });
  const hairMat  = new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 });
  const beltMat  = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.85 });

  player.add(rig.body);
  rig.body.add(rig.hips);
  rig.hips.position.y = 0.85;

  // Legs
  for (const [legGrp, shinGrp, side] of [
    [rig.leftLeg, rig.leftShin, -1],
    [rig.rightLeg, rig.rightShin, 1],
  ]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 3, 8), pantsMat);
    thigh.position.y = -0.22; thigh.castShadow = true; legGrp.add(thigh);
    legGrp.position.set(side * 0.19, 0, 0);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.4, 3, 8), pantsMat);
    shin.position.y = -0.24; shin.castShadow = true; shinGrp.add(shin);
    shinGrp.position.y = -0.44; legGrp.add(shinGrp);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.4), bootMat);
    boot.position.set(0, -0.52, 0.06); boot.castShadow = true; shinGrp.add(boot);
    rig.hips.add(legGrp);
  }

  // Belt + torso
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12), beltMat);
  belt.position.y = 0.1; belt.castShadow = true; rig.hips.add(belt);

  const torsoLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.32, 3, 10), shirtMat);
  torsoLower.position.y = 0.32; torsoLower.castShadow = true; rig.spine.add(torsoLower);
  rig.spine.position.y = 0.18; rig.hips.add(rig.spine);

  const torsoUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.28, 3, 10), shirtMat);
  torsoUpper.position.y = 0.32; torsoUpper.castShadow = true; rig.chest.add(torsoUpper);
  rig.chest.position.y = 0.5; rig.spine.add(rig.chest);

  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), shirtMat);
    s.position.set(side * 0.32, 0.28, 0); s.castShadow = true; rig.chest.add(s);
  }

  // Arms
  for (const [armGrp, forearmGrp, side] of [
    [rig.leftArm, rig.leftForearm, -1],
    [rig.rightArm, rig.rightForearm, 1],
  ]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 3, 6), shirtMat);
    upper.position.y = -0.2; upper.castShadow = true; armGrp.add(upper);
    armGrp.position.set(side * 0.38, 0.25, 0); rig.chest.add(armGrp);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 3, 6), skinMat);
    fore.position.y = -0.2; fore.castShadow = true; forearmGrp.add(fore);
    forearmGrp.position.y = -0.4; armGrp.add(forearmGrp);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), skinMat);
    hand.position.y = -0.24; hand.castShadow = true; forearmGrp.add(hand);
  }

  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.15, 6), skinMat);
  neck.position.y = 0.18; neck.castShadow = true; rig.neck.add(neck);
  rig.neck.position.y = 0.55; rig.chest.add(rig.neck);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skinMat);
  headMesh.scale.set(1, 1.08, 0.98); headMesh.position.y = 0.32; headMesh.castShadow = true;
  rig.head.add(headMesh); rig.head.position.y = 0.2; rig.neck.add(rig.head);

  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 4), hairMat);
    const a = (i / 6) * Math.PI * 2;
    h.position.set(Math.cos(a) * 0.2, 0.42 + Math.sin(a) * 0.07, Math.sin(a) * 0.18 - 0.05);
    h.scale.set(1.3, 0.9, 1.0);
    rig.head.add(h);
  }
  for (const side of [-1, 1]) {
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.13), hairMat);
    sb.position.set(side * 0.24, 0.28, 0.08); rig.head.add(sb);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.25 }));
    eye.position.set(side * 0.1, 0.34, 0.26); rig.head.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(side * 0.115, 0.36, 0.29); rig.head.add(shine);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), hairMat);
    brow.position.set(side * 0.1, 0.4, 0.27); brow.rotation.z = side * 0.05; rig.head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.02), new THREE.MeshStandardMaterial({ color: 0x8a4a4a }));
  mouth.position.set(0, 0.22, 0.28); rig.head.add(mouth);

  // Hat
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.05, 16), hatMat);
  brim.position.y = 0.55; brim.castShadow = true; rig.hat.add(brim);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.32, 12), hatMat);
  top.position.y = 0.72; top.castShadow = true; rig.hat.add(top);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 5, 14), new THREE.MeshStandardMaterial({ color: 0xa03030 }));
  band.rotation.x = Math.PI / 2; band.position.y = 0.62; rig.hat.add(band);
  rig.head.add(rig.hat);

  // Tools
  const heldTool = new THREE.Group();
  rig.rightForearm.add(heldTool);
  heldTool.position.set(0, -0.24, 0.04);

  function makeHoe() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.9 }));
    handle.position.y = -0.55; handle.rotation.x = 0.35; handle.castShadow = true; g.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.16), new THREE.MeshStandardMaterial({ color: 0x9090a0, metalness: 0.75, roughness: 0.35 }));
    blade.position.set(0, -1.14, 0.22); blade.rotation.x = 0.35; blade.castShadow = true; g.add(blade);
    return g;
  }
  function makeCan() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a8a9a, metalness: 0.5, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 8), mat);
    body.position.y = -0.9; g.add(body);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.34, 5), mat);
    spout.position.set(0.14, -0.86, 0.1); spout.rotation.z = -0.55; g.add(spout);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 5, 10, Math.PI), mat);
    handle.position.set(-0.09, -0.82, 0); handle.rotation.z = Math.PI / 2; g.add(handle);
    return g;
  }
  function makeSeedPouch() {
    const g = new THREE.Group();
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.9 }));
    pouch.position.y = -0.9; pouch.scale.set(1, 0.85, 1); g.add(pouch);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2a }));
    tie.position.y = -0.8; tie.rotation.x = Math.PI / 2; g.add(tie);
    return g;
  }
  function makeBasket() {
    const g = new THREE.Group();
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.22, 6, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb08a50, side: THREE.DoubleSide, roughness: 0.9 })
    );
    basket.position.y = -0.9; g.add(basket);
    return g;
  }
  const tools = [makeHoe(), makeCan(), makeSeedPouch(), makeBasket(), null];
  for (let i = 0; i < 4; i++) heldTool.add(tools[i]);

  function updateHeldTool(index) {
    tools.forEach((t, i) => { if (t) t.visible = (i === index); });
  }

  return { player, rig, tools, updateHeldTool };
}

// ── Animation state + update ──
export function createAnimator(rig) {
  const anim = {
    walkCycle: 0,
    walkAmp: makeSpring(0, 140, 14),
    hipsBob: makeSpring(0, 160, 15), hipsTilt: makeSpring(0, 140, 13),
    spineTwist: makeSpring(0, 130, 12), chestTwist: makeSpring(0, 140, 13),
    headBob: makeSpring(0, 150, 14), headTurn: makeSpring(0, 120, 11),
    leftArmPitch: makeSpring(0, 160, 14), rightArmPitch: makeSpring(0, 160, 14),
    leftForearmPitch: makeSpring(0, 180, 15), rightForearmPitch: makeSpring(0, 180, 15),
    leftLegPitch: makeSpring(0, 160, 14), rightLegPitch: makeSpring(0, 160, 14),
    leftShinPitch: makeSpring(0, 180, 15), rightShinPitch: makeSpring(0, 180, 15),
    toolSwing: makeSpring(0, 220, 16), hatBob: makeSpring(0, 170, 14),
    breath: 0, idleTime: 0, blinkTimer: 2, blinkDur: 0,
  };

  function triggerTool() {
    anim.toolSwing.target = 1.5;
    anim.toolSwing.velocity += 10;
    setTimeout(() => { anim.toolSwing.target = 0; }, 200);
  }

  function update(dt, moveAmt, elapsed, walking) {
    anim.walkAmp.target = walking ? Math.min(1, moveAmt / 4.5) : 0;
    stepSpring(anim.walkAmp, dt);
    const s = anim.walkAmp.value;
    anim.walkCycle += dt * (walking ? 7 + moveAmt * 0.7 : 0);
    const phase = anim.walkCycle;
    const sinP = Math.sin(phase);
    const cosP = Math.cos(phase);

    anim.leftLegPitch.target = sinP * 0.55 * s;
    anim.rightLegPitch.target = -sinP * 0.55 * s;
    anim.leftShinPitch.target = Math.max(0, -sinP * 0.7) * s;
    anim.rightShinPitch.target = Math.max(0, sinP * 0.7) * s;
    stepSpring(anim.leftLegPitch, dt); stepSpring(anim.rightLegPitch, dt);
    stepSpring(anim.leftShinPitch, dt); stepSpring(anim.rightShinPitch, dt);
    rig.leftLeg.rotation.x = anim.leftLegPitch.value;
    rig.rightLeg.rotation.x = anim.rightLegPitch.value;
    rig.leftShin.rotation.x = anim.leftShinPitch.value;
    rig.rightShin.rotation.x = anim.rightShinPitch.value;

    anim.leftArmPitch.target = -sinP * 0.42 * s;
    anim.rightArmPitch.target = sinP * 0.42 * s - anim.toolSwing.value * 0.85;
    anim.leftForearmPitch.target = -0.15 - Math.abs(sinP) * 0.25 * s;
    anim.rightForearmPitch.target = -0.15 - anim.toolSwing.value * 0.7;
    stepSpring(anim.leftArmPitch, dt); stepSpring(anim.rightArmPitch, dt);
    stepSpring(anim.leftForearmPitch, dt); stepSpring(anim.rightForearmPitch, dt);
    rig.leftArm.rotation.x = anim.leftArmPitch.value;
    rig.rightArm.rotation.x = anim.rightArmPitch.value;
    rig.leftForearm.rotation.x = anim.leftForearmPitch.value;
    rig.rightForearm.rotation.x = anim.rightForearmPitch.value;

    anim.hipsBob.target = Math.abs(sinP) * 0.08 * s - 0.02 * s;
    anim.hipsTilt.target = cosP * 0.06 * s;
    anim.spineTwist.target = -sinP * 0.12 * s;
    anim.chestTwist.target = -sinP * 0.1 * s;
    anim.headBob.target = Math.sin(phase * 2) * 0.015 * s;
    stepSpring(anim.hipsBob, dt); stepSpring(anim.hipsTilt, dt);
    stepSpring(anim.spineTwist, dt); stepSpring(anim.chestTwist, dt);
    stepSpring(anim.headBob, dt);
    rig.hips.position.y = 0.85 + anim.hipsBob.value;
    rig.hips.rotation.z = anim.hipsTilt.value;
    rig.spine.rotation.y = anim.spineTwist.value;
    rig.chest.rotation.y = anim.chestTwist.value;
    rig.head.rotation.x = anim.headBob.value;

    stepSpring(anim.toolSwing, dt);
    rig.rightArm.rotation.z = -anim.toolSwing.value * 0.28;

    anim.hatBob.target = Math.sin(phase * 2) * 0.02 * s + Math.sin(elapsed * 1.7) * 0.005 * (1 - s);
    stepSpring(anim.hatBob, dt);
    rig.hat.rotation.x = anim.hatBob.value;

    anim.idleTime += dt;
    anim.breath = Math.sin(anim.idleTime * 1.9) * 0.015 * (1 - s);
    rig.chest.scale.set(1 + anim.breath, 1 - anim.breath * 0.5, 1 + anim.breath);

    anim.headTurn.target = Math.sin(anim.idleTime * 0.45) * 0.1 * (1 - s);
    stepSpring(anim.headTurn, dt);
    rig.head.rotation.y = anim.headTurn.value;
  }

  return { anim, update, triggerTool };
}