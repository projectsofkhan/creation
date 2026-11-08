import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const CARS = [
  { id: 'm5', name: 'BMW M5', mass: 1900, power: 4500, topSpeed: 72, drivetrain: 'AWD', steer: 0.5, grip: 3.5, brake: 45, color: 0x1a2338, accent: 0x4a7eb8, wheelBase: 2.9, trackWidth: 1.65, bodyLen: 4.6, bodyWid: 1.9, bodyHt: 0.55, sil: 'm5' },
  { id: 'mustang', name: 'Mustang 1969', mass: 1550, power: 3800, topSpeed: 62, drivetrain: 'RWD', steer: 0.55, grip: 2.8, brake: 40, color: 0x7a1c1c, accent: 0xd4af37, wheelBase: 2.75, trackWidth: 1.6, bodyLen: 4.7, bodyWid: 1.9, bodyHt: 0.5, sil: 'mustang' },
  { id: 'porsche', name: 'Porsche 911', mass: 1420, power: 4200, topSpeed: 76, drivetrain: 'RWD', steer: 0.52, grip: 3.4, brake: 45, color: 0x2c2c2c, accent: 0xcc0000, wheelBase: 2.45, trackWidth: 1.6, bodyLen: 4.4, bodyWid: 1.85, bodyHt: 0.52, sil: 'porsche' },
  { id: 'ferrari', name: 'LaFerrari', mass: 1350, power: 5500, topSpeed: 92, drivetrain: 'RWD', steer: 0.48, grip: 3.8, brake: 50, color: 0xb81414, accent: 0xffcc00, wheelBase: 2.65, trackWidth: 1.7, bodyLen: 4.7, bodyWid: 1.95, bodyHt: 0.48, sil: 'ferrari' }
];

const S = { carIndex: 0, running: false, speed: 0, rpm: 900, gear: 1, throttle: 0, brake: 0, steer: 0, wheelSpin: 0, accum: 0 };
const IN = { gas: false, brake: false, left: false, right: false };

const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a14);
scene.fog = new THREE.Fog(0x0a0a14, 80, 500);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  // Since CSS rotates the app in portrait, we need to flip dimensions for the renderer
  const isPortrait = h > w;
  const cw = isPortrait ? h : w;
  const ch = isPortrait ? w : h;
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
  renderer.setSize(cw, ch);
}
window.addEventListener('resize', resize);

const hemi = new THREE.HemisphereLight(0xaaccff, 0x223322, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0e0, 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 2000), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.85 }));
road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true;
scene.add(road);

{
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 3), new THREE.MeshBasicMaterial({ color: 0xf0d54a }), 300);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 300; i++) {
    m.makeRotationX(-Math.PI / 2); m.setPosition(0, 0.02, -900 + i * 6); inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

{
  const eMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
  const eGeo = new THREE.PlaneGeometry(0.2, 2000);
  const l = new THREE.Mesh(eGeo, eMat); l.rotation.x = -Math.PI / 2; l.position.set(-6.7, 0.02, 0); scene.add(l);
  const r = new THREE.Mesh(eGeo, eMat); r.rotation.x = -Math.PI / 2; r.position.set(6.7, 0.02, 0); scene.add(r);
}

{
  const N = 100;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 5), new THREE.MeshStandardMaterial({ color: 0x3a2818 }), N);
  const fols = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4, 6), new THREE.MeshStandardMaterial({ color: 0x1a4a1f }), N);
  trunks.castShadow = fols.castShadow = true;
  const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (10 + Math.random() * 25);
    const z = -600 + Math.random() * 1200;
    o.position.set(x, 1, z); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    o.position.set(x, 4, z); o.updateMatrix(); fols.setMatrixAt(i, o.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true; fols.instanceMatrix.needsUpdate = true;
  scene.add(trunks, fols);
}

const world = new CANNON.World();
world.gravity.set(0, -20, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.5;

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

const carRoot = new THREE.Group();
scene.add(carRoot);
let wheelGroups = [];

function buildCarVisual(idx) {
  while (carRoot.children.length) carRoot.remove(carRoot.children[0]);
  wheelGroups = [];
  const c = CARS[idx];

  const paint = new THREE.MeshStandardMaterial({ color: c.color, metalness: 0.85, roughness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.15 });
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 });

  // Capsule geometry for a smooth car body
  const bodyGeo = new THREE.CapsuleGeometry(c.bodyWid / 2, c.bodyLen - c.bodyWid, 4, 16);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.scale(1, c.bodyHt / c.bodyWid, 1);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.55; body.castShadow = true; body.receiveShadow = true;
  carRoot.add(body);

  const cabinGeo = new THREE.CapsuleGeometry(c.bodyWid * 0.35, c.bodyLen * 0.3, 4, 16);
  cabinGeo.rotateX(Math.PI / 2); cabinGeo.scale(1.2, 1, 1);
  const cabin = new THREE.Mesh(cabinGeo, glass);
  cabin.position.set(0, 1.0, -0.15); cabin.castShadow = true;
  carRoot.add(cabin);

  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), head); hlL.position.set(-c.bodyWid * 0.32, 0.6, c.bodyLen / 2 - 0.05); carRoot.add(hlL);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), head); hlR.position.set(c.bodyWid * 0.32, 0.6, c.bodyLen / 2 - 0.05); carRoot.add(hlR);
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), tail); tlL.position.set(-c.bodyWid * 0.32, 0.58, -c.bodyLen / 2 + 0.05); carRoot.add(tlL);
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), tail); tlR.position.set(c.bodyWid * 0.32, 0.58, -c.bodyLen / 2 + 0.05); carRoot.add(tlR);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.3 });
  const wr = 0.36;
  const defs = [
    { x: -c.trackWidth / 2, z: c.wheelBase / 2, front: true },
    { x: c.trackWidth / 2, z: c.wheelBase / 2, front: true },
    { x: -c.trackWidth / 2, z: -c.wheelBase / 2, front: false },
    { x: c.trackWidth / 2, z: -c.wheelBase / 2, front: false }
  ];

  defs.forEach(d => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.28, 16), tireMat);
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; g.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.29, 10), rimMat);
    rim.rotation.z = Math.PI / 2; g.add(rim);
    g.position.set(d.x, wr, d.z); g.userData.front = d.front;
    carRoot.add(g); wheelGroups.push(g);
  });
}

let chassis = null, vehicle = null;

function buildPhysicsCar(idx) {
  if (chassis) { world.removeBody(chassis); chassis = null; vehicle = null; }
  const c = CARS[idx];
  chassis = new CANNON.Body({ mass: c.mass });
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(c.bodyWid / 2, 0.35, c.bodyLen / 2)));
  chassis.position.set(0, 1.2, 0);
  chassis.angularDamping = 0.7; chassis.linearDamping = 0.05;
  world.addBody(chassis);

  vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 });
  const wr = 0.36;
  const opts = {
    radius: wr, directionLocal: new CANNON.Vec3(0, -1, 0), suspensionStiffness: 30,
    suspensionRestLength: 0.4, frictionSlip: c.grip, dampingRelaxation: 2.3,
    dampingCompression: 4.4, maxSuspensionForce: 100000, rollInfluence: 0.05,
    axleLocal: new CANNON.Vec3(-1, 0, 0), maxSuspensionTravel: 0.3,
    chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0)
  };
  const positions = [
    { x: -c.trackWidth / 2, z: c.wheelBase / 2 }, { x: c.trackWidth / 2, z: c.wheelBase / 2 },
    { x: -c.trackWidth / 2, z: -c.wheelBase / 2 }, { x: c.trackWidth / 2, z: -c.wheelBase / 2 }
  ];
  positions.forEach(p => {
    const o = Object.assign({}, opts);
    o.chassisConnectionPointLocal = new CANNON.Vec3(p.x, 0, p.z);
    vehicle.addWheel(o);
  });
  vehicle.addToWorld(world);
}

const SIL = {
  m5: '<svg viewBox="0 0 200 70"><path d="M25 48 Q25 30 42 28 L62 22 Q95 16 130 22 L165 28 Q178 30 178 48 Z"/><circle cx="55" cy="50" r="9"/><circle cx="145" cy="50" r="9"/></svg>',
  mustang: '<svg viewBox="0 0 200 70"><path d="M20 48 Q20 28 38 26 L58 22 Q88 18 125 22 L162 28 Q178 30 178 48 Z"/><circle cx="52" cy="50" r="9"/><circle cx="148" cy="50" r="9"/></svg>',
  porsche: '<svg viewBox="0 0 200 70"><path d="M28 48 Q28 30 46 26 L68 20 Q98 16 130 20 L162 26 Q174 28 174 48 Z"/><circle cx="56" cy="50" r="9"/><circle cx="144" cy="50" r="9"/></svg>',
  ferrari: '<svg viewBox="0 0 200 70"><path d="M22 48 Q22 28 40 25 L64 18 Q98 12 132 18 L166 25 Q178 28 178 48 Z"/><circle cx="54" cy="50" r="9"/><circle cx="146" cy="50" r="9"/></svg>'
};

function buildSelectUI() {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  CARS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'card' + (i === 0 ? ' on' : '');
    d.innerHTML = `
      <div class="sil">${SIL[c.sil]}</div>
      <div>
        <div class="nm">${c.name}</div>
        <div class="sp"><span>DRIVE</span><b>${c.drivetrain}</b></div>
        <div class="sp"><span>TOP</span><b>${Math.round(c.topSpeed * 3.6)} km/h</b></div>
      </div>
    `;
    d.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      S.carIndex = i;
      document.querySelectorAll('.card').forEach((el, j) => el.classList.toggle('on', j === i));
      buildCarVisual(i);
      buildPhysicsCar(i);
    });
    g.appendChild(d);
  });
}

function hold(el, down, up) {
  const s = e => { e.preventDefault(); down(); el.classList.add('on'); };
  const e2 = e => { e.preventDefault(); up(); el.classList.remove('on'); };
  el.addEventListener('pointerdown', s);
  el.addEventListener('pointerup', e2);
  el.addEventListener('pointercancel', e2);
  el.addEventListener('pointerleave', e2);
}

function setupInput() {
  hold(document.getElementById('sL'), () => IN.left = true, () => IN.left = false);
  hold(document.getElementById('sR'), () => IN.right = true, () => IN.right = false);
  hold(document.getElementById('gas'), () => IN.gas = true, () => IN.gas = false);
  hold(document.getElementById('brk'), () => IN.brake = true, () => IN.brake = false);

  document.getElementById('gup').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.running) { S.gear = Math.min(S.gear + 1, 6); document.getElementById('gr').textContent = S.gear; }
  });
  document.getElementById('gdown').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.running) { S.gear = Math.max(S.gear - 1, 1); document.getElementById('gr').textContent = S.gear; }
  });

  document.getElementById('bk').addEventListener('pointerdown', () => {
    S.running = false;
    document.getElementById('hud').classList.remove('on');
    document.getElementById('select').classList.remove('hide');
  });

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp' || e.key === 'w') IN.gas = true;
    if (e.key === 'ArrowDown' || e.key === 's') IN.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') IN.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') IN.right = true;
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') IN.gas = false;
    if (e.key === 'ArrowDown' || e.key === 's') IN.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') IN.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') IN.right = false;
  });
}

function stepPhysics(dt) {
  if (!vehicle) return;
  const c = CARS[S.carIndex];
  const target = (IN.left ? 1 : 0) - (IN.right ? 1 : 0);
  S.steer += (target * c.steer - S.steer) * 0.18;
  for (let i = 0; i < 4; i++) { const w = vehicle.wheelInfos[i]; if (w) w.steering = i < 2 ? S.steer : 0; }

  S.throttle = IN.gas ? 1 : 0;
  S.brake = IN.brake ? 1 : 0;

  const ratios = [3.4, 2.3, 1.7, 1.3, 1.0, 0.8];
  const ratio = ratios[Math.min(S.gear - 1, 5)];
  const force = S.throttle * (c.power * ratio * 0.18);

  if (c.drivetrain === 'AWD') for (let i = 0; i < 4; i++) vehicle.applyEngineForce(force / 4, i);
  else { vehicle.applyEngineForce(force / 2, 2); vehicle.applyEngineForce(force / 2, 3); }

  const brakeF = S.brake * c.brake * 20;
  for (let i = 0; i < 4; i++) vehicle.setBrake(brakeF, i);

  const v = chassis.velocity;
  S.speed = Math.sqrt(v.x * v.x + v.z * v.z) || 0;
  let rpm = ((S.speed / (2 * Math.PI * 0.36)) * 60) * ratio * 3.4;
  if (rpm < 900) rpm = 900 + S.throttle * 700;
  S.rpm = Math.max(900, Math.min(8000, rpm));

  if (!IN.gas && S.speed < 1) S.gear = 1;
  else {
    if (S.rpm > 6500 && S.gear < 6) { S.gear++; document.getElementById('gr').textContent = S.gear; }
    else if (S.rpm < 3000 && S.gear > 1) { S.gear--; document.getElementById('gr').textContent = S.gear; }
  }
}

function syncVisual(dt) {
  if (!chassis) return;
  carRoot.position.set(chassis.position.x, chassis.position.y - 0.85, chassis.position.z);
  carRoot.quaternion.set(chassis.quaternion.x, chassis.quaternion.y, chassis.quaternion.z, chassis.quaternion.w);

  S.wheelSpin += S.speed * 8 * dt;
  wheelGroups.forEach((g, i) => {
    g.rotation.x = S.wheelSpin;
    if (g.userData.front) g.rotation.y = S.steer;
  });
}

function updateCamera(dt) {
  if (!chassis) return;
  const q = carRoot.quaternion;
  const back = new THREE.Vector3(0, 2.4, -7).applyQuaternion(q);
  const target = new THREE.Vector3(carRoot.position.x + back.x, carRoot.position.y + back.y + 1.2, carRoot.position.z + back.z);
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));
  camera.lookAt(carRoot.position.x + q.x * 0.5, carRoot.position.y + 1, carRoot.position.z + q.z * 0.5);

  sun.position.set(carRoot.position.x + 30, 60, carRoot.position.z + 20);
  sun.target.position.copy(carRoot.position);
  sun.target.updateMatrixWorld();
}

function updateHUD() {
  const kmh = Math.round(S.speed * 3.6);
  document.getElementById('kmh').textContent = kmh;
  document.getElementById('arc').setAttribute('stroke-dasharray', `${Math.min(kmh / 300, 1) * 250} 250`);
}

const FIXED = 1 / 60;
let lastTime = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!isFinite(dt) || dt > 0.1) dt = 0.016;
  if (dt <= 0) dt = 0.016;

  if (S.running) {
    S.accum += dt;
    let guard = 0;
    while (S.accum >= FIXED && guard < 3) {
      stepPhysics(FIXED);
      world.step(FIXED);
      S.accum -= FIXED;
      guard++;
    }
    if (guard >= 3) S.accum = 0;
    syncVisual(dt);
    updateCamera(dt);
    updateHUD();
  }
  renderer.render(scene, camera);
}

function startGame() {
  // 1. Force Fullscreen
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

  // 2. UI States
  document.getElementById('select').classList.add('hide');
  document.getElementById('hud').classList.add('on');
  document.getElementById('cn').textContent = CARS[S.carIndex].name;

  // 3. Reset Physics
  S.running = true;
  S.speed = 0; S.rpm = 900; S.gear = 1; S.steer = 0; S.wheelSpin = 0; S.accum = 0;
  lastTime = performance.now();
  if (chassis) {
    chassis.position.set(0, 1.2, 0); chassis.velocity.set(0, 0, 0); chassis.angularVelocity.set(0, 0, 0);
    chassis.quaternion.set(0, 0, 0, 1); chassis.force.set(0, 0, 0); chassis.torque.set(0, 0, 0);
  }
  IN.gas = IN.brake = IN.left = IN.right = false;
  document.getElementById('gr').textContent = S.gear;
}

function boot() {
  try {
    buildSelectUI();
    buildCarVisual(0);
    buildPhysicsCar(0);
    setupInput();
    resize();

    document.getElementById('go').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startGame();
    });

    loop();

    // Hide loader and show selection instantly
    setTimeout(() => {
      document.getElementById('lf').style.width = '100%';
      document.getElementById('loader').classList.add('hide');
    }, 100);

  } catch (err) {
    console.error('BOOT ERROR:', err);
    document.body.innerHTML = `<div style="color:#fff; background:#07070b; padding:30px; font-family:monospace; font-size:14px; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <h2 style="color:#ff3355; margin-bottom:20px;">Game Crashed</h2>
      <p style="max-width:800px; text-align:center; line-height:1.5;"><b>Error:</b> ${err.message}</p>
      <pre style="background:#111; padding:20px; border-radius:8px; margin-top:20px; overflow:auto; max-width:90vw; text-align:left;">${err.stack}</pre>
    </div>`;
  }
}

boot();