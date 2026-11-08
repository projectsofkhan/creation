import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'cannon-es';

// ============================================================
// CAR DATA
// ============================================================
const CARS = [
  {
    id: 'm5', name: 'BMW M5', short: 'M5',
    mass: 1900, power: 4600, topSpeed: 250, drivetrain: 'AWD',
    steer: 0.48, brake: 45, grip: 2.8, downforce: 0.35,
    color: 0x16213e, accent: 0x4a7eb8, gearRatios: [3.3, 2.1, 1.5, 1.15, 0.9, 0.72],
    wheelBase: 2.9, trackWidth: 1.7, bodyLen: 2.9, bodyWid: 1.15,
    silhouette: 'm5'
  },
  {
    id: 'mustang', name: 'Mustang 1969', short: 'MUSTANG',
    mass: 1550, power: 4200, topSpeed: 220, drivetrain: 'RWD',
    steer: 0.52, brake: 40, grip: 2.4, downforce: 0.18,
    color: 0x7a1c1c, accent: 0xd4af37, gearRatios: [2.9, 1.9, 1.35, 1.0, 0.78, 0.62],
    wheelBase: 2.75, trackWidth: 1.65, bodyLen: 3.0, bodyWid: 1.15,
    silhouette: 'mustang'
  },
  {
    id: 'porsche', name: 'Porsche 911', short: '911',
    mass: 1420, power: 4500, topSpeed: 280, drivetrain: 'RWD',
    steer: 0.5, brake: 42, grip: 2.9, downforce: 0.45,
    color: 0x2c2c2c, accent: 0xcc0000, gearRatios: [3.1, 2.0, 1.45, 1.05, 0.82, 0.66],
    wheelBase: 2.45, trackWidth: 1.55, bodyLen: 2.7, bodyWid: 1.1,
    silhouette: 'porsche'
  },
  {
    id: 'ferrari', name: 'LaFerrari', short: 'LAFERRARI',
    mass: 1350, power: 6200, topSpeed: 340, drivetrain: 'RWD',
    steer: 0.46, brake: 50, grip: 3.2, downforce: 0.7,
    color: 0xb81414, accent: 0xffcc00, gearRatios: [3.6, 2.3, 1.65, 1.25, 0.95, 0.7],
    wheelBase: 2.65, trackWidth: 1.65, bodyLen: 2.85, bodyWid: 1.15,
    silhouette: 'ferrari'
  }
];

// ============================================================
// STATE
// ============================================================
const state = {
  selectedCar: 0,
  running: false,
  speed: 0,
  gear: '1',
  rpm: 900,
  throttle: 0,
  brake: 0,
  steerInput: 0,
  manual: false,
  manualGear: 0,
  autoGear: 1,
  shiftCooldown: 0,
  lastTime: performance.now(),
  accumulator: 0,
  wheelSpin: 0
};

const input = { gas: false, brake: false, left: false, right: false };

// ============================================================
// AUDIO ENGINE
// ============================================================
class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
  }
  start() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 600;
      this.filter.Q.value = 4;
      this.filter.connect(this.master);

      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.value = 50;
      this.g1 = this.ctx.createGain();
      this.g1.gain.value = 0.5;
      this.osc1.connect(this.g1).connect(this.filter);

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc2.frequency.value = 100;
      this.g2 = this.ctx.createGain();
      this.g2.gain.value = 0.25;
      this.osc2.connect(this.g2).connect(this.filter);

      this.osc3 = this.ctx.createOscillator();
      this.osc3.type = 'sawtooth';
      this.osc3.frequency.value = 25;
      this.g3 = this.ctx.createGain();
      this.g3.gain.value = 0.4;
      this.osc3.connect(this.g3).connect(this.filter);

      this.osc1.start(); this.osc2.start(); this.osc3.start();
      this.started = true;
    } catch(e) { console.warn('audio', e); }
  }
  update(rpm, throttle, speed) {
    if (!this.started) return;
    try {
      const r = Math.max(0, Math.min(9000, isFinite(rpm) ? rpm : 900));
      const th = Math.max(0, Math.min(1, isFinite(throttle) ? throttle : 0));
      const sp = Math.max(0, Math.min(150, isFinite(speed) ? speed : 0));

      const baseFreq = 35 + (r / 9000) * 160;
      const now = this.ctx.currentTime;
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
      this.osc2.frequency.setTargetAtTime(baseFreq * 2.02, now, 0.06);
      this.osc3.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);

      const filterF = 300 + th * 1800 + (r / 9000) * 900;
      this.filter.frequency.setTargetAtTime(Math.min(5000, filterF), now, 0.08);

      const vol = 0.06 + th * 0.14 + Math.min(sp / 300, 0.05);
      this.master.gain.setTargetAtTime(Math.min(0.3, vol), now, 0.1);
    } catch(e) {}
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
const audio = new EngineAudio();

// ============================================================
// THREE SETUP
// ============================================================
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.0022);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 7, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.85);
composer.addPass(bloom);

// ============================================================
// LIGHTS
// ============================================================
const sun = new THREE.DirectionalLight(0xffe4c4, 2.6);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

scene.add(new THREE.HemisphereLight(0x88aaff, 0x223322, 0.55));
scene.add(new THREE.AmbientLight(0x445566, 0.35));

// ============================================================
// SKY
// ============================================================
const skyGeo = new THREE.SphereGeometry(2000, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color(0x0a1530) },
    bottom: { value: new THREE.Color(0xff8855) },
    offset: { value: 200 },
    exponent: { value: 0.7 }
  },
  vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float offset; uniform float exponent; varying vec3 vP;
    void main(){ float h = normalize(vP + vec3(0.0,offset,0.0)).y; float t = max(pow(max(h,0.0),exponent),0.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }`,
  side: THREE.BackSide, depthWrite: false
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ============================================================
// GROUND + ROAD
// ============================================================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 3000),
  new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 2048;
  const x = c.getContext('2d');
  // asphalt base
  x.fillStyle = '#26262a'; x.fillRect(0, 0, 512, 2048);
  // subtle grain
  const img = x.getImageData(0, 0, 512, 2048);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n;
  }
  x.putImageData(img, 0, 0);
  // edge lines
  x.fillStyle = '#e8e8e8';
  x.fillRect(30, 0, 8, 2048);
  x.fillRect(512 - 38, 0, 8, 2048);
  // center dashes
  x.fillStyle = '#f0d54a';
  for (let y = 0; y < 2048; y += 140) {
    x.fillRect(252, y, 8, 80);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 40);
  tex.anisotropy = 8;
  return tex;
}

const roadTex = makeRoadTexture();
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 2000),
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.15 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
road.receiveShadow = true;
scene.add(road);

// ============================================================
// SCENERY (INSTANCED)
// ============================================================
function buildScenery() {
  const treeCount = 160;
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3.5, 6);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 });
  const foliageG = new THREE.SphereGeometry(2, 8, 6);
  const foliageM = new THREE.MeshStandardMaterial({ color: 0x1a4a1f, roughness: 0.9 });

  const trunks = new THREE.InstancedMesh(trunkG, trunkM, treeCount);
  const foliage = new THREE.InstancedMesh(foliageG, foliageM, treeCount);
  trunks.castShadow = true; foliage.castShadow = true;
  trunks.receiveShadow = true; foliage.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (10 + Math.random() * 45);
    const z = (Math.random() - 0.5) * 800;
    const s = 0.7 + Math.random() * 0.9;

    dummy.position.set(x, 1.75 * s, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 3.5 * s + 1, z);
    dummy.scale.set(s * 1.4, s * 1.3, s * 1.4);
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;
  scene.add(trunks, foliage);

  // Buildings on sides
  const bCount = 40;
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const bMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.7, metalness: 0.4 });
  const buildings = new THREE.InstancedMesh(bGeo, bMat, bCount);
  buildings.castShadow = true; buildings.receiveShadow = true;

  for (let i = 0; i < bCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (40 + Math.random() * 80);
    const z = (Math.random() - 0.5) * 900;
    const w = 6 + Math.random() * 10;
    const h = 8 + Math.random() * 30;
    const d = 6 + Math.random() * 10;
    dummy.position.set(x, h / 2, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;
  scene.add(buildings);
}
buildScenery();

// ============================================================
// HDR ENVIRONMENT
// ============================================================
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
new RGBELoader().setDataType(THREE.HalfFloatType)
  .load('https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr',
    (tex) => {
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment = env;
      tex.dispose();
      pmrem.dispose();
      bumpLoad(40);
    },
    undefined,
    () => { bumpLoad(40); }
  );

// ============================================================
// PHYSICS WORLD
// ============================================================
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.05;

// Ground plane
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ============================================================
// CAR VISUAL BUILDER
// ============================================================
let carGroup = new THREE.Group();
scene.add(carGroup);
let wheelMeshes = []; // { mesh, isFront }

function buildCarVisual(carIndex) {
  // clear
  while (carGroup.children.length) carGroup.remove(carGroup.children[0]);
  wheelMeshes = [];

  const spec = CARS[carIndex];

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.4
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a14,
    metalness: 0.5,
    roughness: 0.1,
    transmission: 0.3,
    transparent: true,
    opacity: 0.9
  });
  const accent = new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.7, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.4, roughness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xfff2cc, emissiveIntensity: 3.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 3.5 });

  // Main body — smooth lathe-based hull
  const L = spec.bodyLen;
  const W = spec.bodyWid;

  // Lower hull — rounded capsule-like
  const lowerPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // x represents cross-section radius profile along length
    const lenT = (t - 0.5) * L;
    const radius = W * Math.sqrt(Math.max(0.001, 1 - Math.pow((t - 0.5) * 1.9, 2)));
    lowerPts.push(new THREE.Vector2(Math.max(0.05, radius), lenT));
  }

  // Build using lathe on Y-axis then rotate to align Z
  const hullGeo = new THREE.LatheGeometry(lowerPts.map(p => new THREE.Vector2(p.x, p.x)), 20);
  // Instead — use a custom extruded shape for cleaner look
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-W, -L/2 + 0.3);
  bodyShape.quadraticCurveTo(-W * 1.05, -L/2 + 0.1, -W * 0.85, -L/2);
  bodyShape.quadraticCurveTo(0, -L/2 - 0.1, W * 0.85, -L/2);
  bodyShape.quadraticCurveTo(W * 1.05, -L/2 + 0.1, W, -L/2 + 0.3);
  bodyShape.lineTo(W, L/2 - 0.5);
  bodyShape.quadraticCurveTo(W * 0.9, L/2, 0, L/2);
  bodyShape.quadraticCurveTo(-W * 0.9, L/2, -W, L/2 - 0.5);
  bodyShape.closePath();

  const extrudeSettings = {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 4, curveSegments: 12
  };
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.translate(0, 0.15, 0);

  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.35;
  body.castShadow = true; body.receiveShadow = true;
  carGroup.add(body);

  // Cabin / greenhouse
  const cabinShape = new THREE.Shape();
  const cW = W * 0.75;
  const cL = L * 0.42;
  cabinShape.moveTo(-cW, -cL/2);
  cabinShape.quadraticCurveTo(-cW, cL/2, 0, cL/2 + 0.1);
  cabinShape.quadraticCurveTo(cW, cL/2, cW, -cL/2);
  cabinShape.quadraticCurveTo(0, -cL/2 - 0.05, -cW, -cL/2);
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 0.55, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 3, curveSegments: 10
  });
  cabinGeo.rotateX(-Math.PI / 2);
  cabinGeo.translate(0, 0.1, -0.2);
  const cabin = new THREE.Mesh(cabinGeo, glass);
  cabin.position.y = 0.9;
  cabin.castShadow = true;
  carGroup.add(cabin);

  // Hood accent stripe
  const stripeGeo = new THREE.BoxGeometry(0.12, 0.02, L * 0.7);
  const stripeL = new THREE.Mesh(stripeGeo, accent);
  stripeL.position.set(-0.25, 0.82, 0);
  carGroup.add(stripeL);
  const stripeR = new THREE.Mesh(stripeGeo, accent);
  stripeR.position.set(0.25, 0.82, 0);
  carGroup.add(stripeR);

  // Headlights
  const hlGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const hlL = new THREE.Mesh(hlGeo, headMat);
  hlL.position.set(-0.7, 0.65, L/2 - 0.15);
  hlL.scale.set(1.6, 1, 0.6);
  carGroup.add(hlL);
  const hlR = new THREE.Mesh(hlGeo, headMat);
  hlR.position.set(0.7, 0.65, L/2 - 0.15);
  hlR.scale.set(1.6, 1, 0.6);
  carGroup.add(hlR);

  // Taillights
  const tlGeo = new THREE.SphereGeometry(0.08, 10, 8);
  const tlL = new THREE.Mesh(tlGeo, tailMat);
  tlL.position.set(-0.7, 0.62, -L/2 + 0.1);
  tlL.scale.set(1.8, 1, 0.5);
  carGroup.add(tlL);
  const tlR = new THREE.Mesh(tlGeo, tailMat);
  tlR.position.set(0.7, 0.62, -L/2 + 0.1);
  tlR.scale.set(1.8, 1, 0.5);
  carGroup.add(tlR);

  // Wheels
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.95 });

  const wb = spec.wheelBase / 2;
  const tw = spec.trackWidth / 2;
  const wheelR = 0.42;
  const wheelW = 0.3;

  const wheelDefs = [
    { x: -tw, z: wb, front: true },
    { x: tw, z: wb, front: true },
    { x: -tw, z: -wb, front: false },
    { x: tw, z: -wb, front: false }
  ];

  wheelDefs.forEach((wd) => {
    const g = new THREE.Group();

    const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    g.add(tire);

    const rimGeo = new THREE.CylinderGeometry(wheelR * 0.62, wheelR * 0.62, wheelW * 1.02, 12);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);

    // spoke detail
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelW * 1.03, wheelR * 1.1, 0.06),
        rimMat
      );
      spoke.rotation.x = (s / 5) * Math.PI;
      g.add(spoke);
    }

    g.position.set(wd.x, wheelR, wd.z);
    g.userData.front = wd.front;
    g.userData.x = wd.x;
    carGroup.add(g);
    wheelMeshes.push(g);
  });

  carGroup.position.set(0, 0, 0);
  carGroup.rotation.set(0, 0, 0);
}

// ============================================================
// PHYSICS CAR — REAL RaycastVehicle
// ============================================================
let vehicleBody = null;
let raycastVehicle = null;

function buildPhysicsCar(carIndex) {
  if (vehicleBody) {
    world.removeBody(vehicleBody);
    vehicleBody = null;
    raycastVehicle = null;
  }

  const spec = CARS[carIndex];

  // Chassis shape
  const halfExtents = new CANNON.Vec3(spec.bodyWid * 0.9, 0.4, spec.bodyLen * 0.42);
  const chassisShape = new CANNON.Box(halfExtents);

  const chassisBody = new CANNON.Body({
    mass: spec.mass,
    material: new CANNON.Material({ friction: 0.4, restitution: 0.05 })
  });
  chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0, 0));
  chassisBody.position.set(0, 1.2, 0);
  chassisBody.angularDamping = 0.6;
  chassisBody.linearDamping = 0.02;
  world.addBody(chassisBody);

  vehicleBody = chassisBody;

  // Raycast vehicle
  raycastVehicle = new CANNON.RaycastVehicle({
    chassisBody: chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });

  const wb = spec.wheelBase / 2;
  const tw = spec.trackWidth / 2;
  const wheelR = 0.42;

  const wheelOpts = {
    radius: wheelR,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 32,
    suspensionRestLength: 0.35,
    frictionSlip: spec.grip,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.05,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    maxSuspensionTravel: 0.25,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
    chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0)
  };

  const offsets = [
    { x: -tw, z: wb }, { x: tw, z: wb },
    { x: -tw, z: -wb }, { x: tw, z: -wb }
  ];

  offsets.forEach((o, i) => {
    const opts = Object.assign({}, wheelOpts);
    opts.chassisConnectionPointLocal = new CANNON.Vec3(o.x, 0, o.z);
    opts.isFrontWheel = i < 2;
    raycastVehicle.addWheel(opts);
  });

  raycastVehicle.addToWorld(world);

  // Reset visual
  carGroup.position.set(0, 0, 0);
  carGroup.quaternion.set(0, 0, 0, 1);
}

// ============================================================
// INPUT HANDLERS
// ============================================================
function bindHold(el, onDown, onUp) {
  const start = (e) => { e.preventDefault(); onDown(); el.classList.add('on'); audio.resume(); };
  const end = (e) => { e.preventDefault(); onUp(); el.classList.remove('on'); };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', end, { passive: false });
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

function setupInputs() {
  bindHold(document.getElementById('steerL'), () => input.left = true, () => input.left = false);
  bindHold(document.getElementById('steerR'), () => input.right = true, () => input.right = false);
  bindHold(document.getElementById('gasBtn'), () => input.gas = true, () => input.gas = false);
  bindHold(document.getElementById('brakeBtn'), () => input.brake = true, () => input.brake = false);

  const shiftUp = (e) => {
    e.preventDefault();
    if (!state.running) return;
    state.manual = true;
    state.manualGear = Math.min(state.manualGear + 1, 5);
    document.getElementById('hudTrans').textContent = 'MANUAL';
  };
  const shiftDown = (e) => {
    e.preventDefault();
    if (!state.running) return;
    state.manual = true;
    state.manualGear = Math.max(state.manualGear - 1, 0);
    document.getElementById('hudTrans').textContent = 'MANUAL';
  };
  document.getElementById('padUp').addEventListener('touchstart', shiftUp, { passive: false });
  document.getElementById('padUp').addEventListener('mousedown', shiftUp);
  document.getElementById('padDown').addEventListener('touchstart', shiftDown, { passive: false });
  document.getElementById('padDown').addEventListener('mousedown', shiftDown);

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': input.gas = true; break;
      case 'ArrowDown': case 's': input.brake = true; break;
      case 'ArrowLeft': case 'a': input.left = true; break;
      case 'ArrowRight': case 'd': input.right = true; break;
      case 'Shift': shiftUp(e); break;
      case 'Control': shiftDown(e); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': input.gas = false; break;
      case 'ArrowDown': case 's': input.brake = false; break;
      case 'ArrowLeft': case 'a': input.left = false; break;
      case 'ArrowRight': case 'd': input.right = false; break;
    }
  });

  // Back button -> return to select
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('carSelect').classList.remove('hide');
    document.getElementById('hud').classList.remove('on');
    state.running = false;
    state.speed = 0;
    input.gas = input.brake = input.left = input.right = false;
  });
}

// ============================================================
// UI: CAR SELECT
// ============================================================
const SILHOUETTES = {
  m5: '<svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet"><path d="M20 50 Q20 30 40 28 L60 20 Q90 15 120 20 L160 28 Q180 30 180 50 Z"/><circle cx="50" cy="52" r="10"/><circle cx="150" cy="52" r="10"/><path d="M40 28 L70 24 L100 22 L130 24 L160 28" stroke-opacity=".4"/></svg>',
  mustang: '<svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet"><path d="M15 50 Q15 28 35 26 L55 22 Q80 18 115 20 L155 26 Q180 28 180 50 Z"/><circle cx="48" cy="52" r="10"/><circle cx="152" cy="52" r="10"/><path d="M35 26 L60 20 L100 18 L140 20 L165 26" stroke-opacity=".4"/></svg>',
  porsche: '<svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet"><path d="M25 50 Q25 28 45 26 L70 18 Q100 14 125 18 L155 26 Q175 28 175 50 Z"/><circle cx="52" cy="52" r="10"/><circle cx="148" cy="52" r="10"/><path d="M45 26 L75 20 L100 18 L125 20 L155 26" stroke-opacity=".4"/></svg>',
  ferrari: '<svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet"><path d="M20 50 Q20 28 40 25 L65 15 Q100 10 130 15 L165 25 Q180 28 180 50 Z"/><circle cx="50" cy="52" r="10"/><circle cx="150" cy="52" r="10"/><path d="M40 25 L70 17 L100 15 L130 17 L160 25" stroke-opacity=".4"/></svg>'
};

function buildCarSelectUI() {
  const grid = document.getElementById('carGrid');
  grid.innerHTML = '';
  CARS.forEach((car, i) => {
    const div = document.createElement('div');
    div.className = 'carCard' + (i === 0 ? ' active' : '');
    div.dataset.index = i;
    div.innerHTML = `
      <div class="silhouette">${SILHOUETTES[car.silhouette]}</div>
      <div>
        <div class="name">${car.name}</div>
        <div class="specs">
          <div class="spec"><span>POWER</span><span>${Math.round(car.power / 10)} hp</span></div>
          <div class="spec"><span>DRIVE</span><span>${car.drivetrain}</span></div>
          <div class="spec"><span>TOP</span><span>${car.topSpeed} km/h</span></div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => selectCar(i));
    div.addEventListener('touchstart', (e) => { e.preventDefault(); selectCar(i); }, { passive: false });
    grid.appendChild(div);
  });
}

function selectCar(i) {
  state.selectedCar = i;
  document.querySelectorAll('.carCard').forEach((c, idx) => {
    c.classList.toggle('active', idx === i);
  });
  buildCarVisual(i);
  buildPhysicsCar(i);
}

// ============================================================
// LOADER
// ============================================================
let loadPct = 0;
function bumpLoad(p) { loadPct = Math.max(loadPct, p); document.getElementById('loadFill').style.width = loadPct + '%'; }
bumpLoad(10);

// ============================================================
// GAME LOOP
// ============================================================
const FIXED_DT = 1 / 60;
const MAX_SUB_STEPS = 3;

function updateVehicle() {
  if (!raycastVehicle || !vehicleBody) return;

  const spec = CARS[state.selectedCar];

  // Steering — smooth interpolation
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  state.steerInput += (steerTarget * spec.steer - state.steerInput) * 0.15;

  // Apply steering to front wheels only
  for (let i = 0; i < 4; i++) {
    const w = raycastVehicle.wheelInfos[i];
    if (!w) continue;
    if (i < 2) {
      w.steering = state.steerInput;
    } else {
      w.steering = 0;
    }
  }

  // Throttle / Brake
  const throttleInput = input.gas ? 1 : 0;
  const brakeInput = input.brake ? 1 : 0;

  // Compute engine force based on gear & rpm
  const maxRpm = 7500;
  const rpmRatio = Math.min(state.rpm / maxRpm, 1);
  const torqueFactor = Math.max(0.3, Math.sin(rpmRatio * Math.PI * 0.9));
  let engineForce = 0;
  if (throttleInput) {
    engineForce = spec.power * torqueFactor;
  }

  // Apply to wheels based on drivetrain
  if (spec.drivetrain === 'AWD') {
    for (let i = 0; i < 4; i++) raycastVehicle.applyEngineForce(engineForce * 0.25, i);
  } else {
    raycastVehicle.applyEngineForce(engineForce * 0.5, 2);
    raycastVehicle.applyEngineForce(engineForce * 0.5, 3);
  }

  // Braking
  const brakeForce = brakeInput * spec.brake;
  for (let i = 0; i < 4; i++) {
    raycastVehicle.setBrake(brakeInput ? spec.brake : 0, i);
  }

  // Downforce (simple)
  const vel = vehicleBody.velocity;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carGroup.quaternion);
  const speedAlong = vel.x * fwd.x + vel.z * fwd.z;
  if (speedAlong > 0) {
    vehicleBody.applyForce(
      new CANNON.Vec3(0, -spec.downforce * speedAlong * 10, 0),
      new CANNON.Vec3(0, 0, 0)
    );
  }

  // Calculate speed
  const sp = Math.hypot(vel.x, vel.z);
  state.speed = isFinite(sp) ? sp : 0;
  state.throttle = throttleInput;
  state.brake = brakeInput;

  // Gear logic
  if (!state.manual) {
    // Automatic shifting
    const ratios = spec.gearRatios;
    const topSpd = spec.topSpeed / 3.6;
    const gearCount = ratios.filter(r => r > 0).length;
    const norm = state.speed / topSpd;
    let targetGear = 0;
    for (let g = gearCount - 1; g >= 0; g--) {
      const threshold = (g / gearCount) * 0.9;
      if (norm >= threshold) { targetGear = g; break; }
    }
    state.autoGear = targetGear;
    state.gear = String(targetGear + 1);

    // RPM from speed
    const gearRatio = ratios[Math.min(targetGear, ratios.length - 1)] || 1;
    const finalDrive = 3.4;
    const wheelCirc = Math.PI * 0.84;
    const wheelRpm = (state.speed / wheelCirc) * 60;
    let rpm = wheelRpm * finalDrive * gearRatio;
    if (rpm < 900) rpm = 900 + throttleInput * 800;
    state.rpm = Math.max(900, Math.min(8200, rpm));
  } else {
    // Manual
    state.autoGear = state.manualGear;
    state.gear = String(state.manualGear + 1);
    const gearRatio = spec.gearRatios[state.manualGear] || 1;
    const finalDrive = 3.4;
    const wheelCirc = Math.PI * 0.84;
    const wheelRpm = (state.speed / wheelCirc) * 60;
    let rpm = wheelRpm * finalDrive * gearRatio;
    if (rpm < 900) rpm = 900 + throttleInput * 800;
    state.rpm = Math.max(900, Math.min(8200, rpm));
  }

  if (!isFinite(state.rpm)) state.rpm = 900;
  if (!isFinite(state.speed)) state.speed = 0;
}

function syncVisualCar(dt) {
  if (!vehicleBody) return;

  // Position & rotation
  carGroup.position.set(
    vehicleBody.position.x,
    vehicleBody.position.y - 0.85,
    vehicleBody.position.z
  );
  carGroup.quaternion.set(
    vehicleBody.quaternion.x,
    vehicleBody.quaternion.y,
    vehicleBody.quaternion.z,
    vehicleBody.quaternion.w
  );

  // Wheel spinning & steering
  const spinSpeed = state.speed * 8;
  state.wheelSpin += spinSpeed * dt;

  wheelMeshes.forEach((wm, i) => {
    // Spin
    wm.children.forEach(c => {
      if (c.geometry && c.geometry.type === 'CylinderGeometry') {
        // rotate around X axis (since we rotated cylinder z by PI/2, its local rotation axis is now X in world)
      }
    });
    // Simpler: rotate whole wheel group around its local X axis based on spin
    wm.rotation.x = state.wheelSpin;

    // Steering for front wheels
    if (wm.userData.front && raycastVehicle) {
      const wi = raycastVehicle.wheelInfos[i];
      if (wi) {
        wm.rotation.y = wi.steering;
      }
    }
  });
}

function updateCamera(dt) {
  if (!vehicleBody) return;

  const carPos = carGroup.position;
  const carQuat = carGroup.quaternion;

  // Local offset behind and above
  const back = new THREE.Vector3(0, 2.2, -6.5).applyQuaternion(carQuat);
  const target = new THREE.Vector3(
    carPos.x + back.x,
    carPos.y + back.y + 1.5,
    carPos.z + back.z
  );

  camera.position.lerp(target, 1 - Math.pow(0.001, dt));

  const lookAt = new THREE.Vector3(
    carPos.x + carQuat.x * 0.5,
    carPos.y + 1.1,
    carPos.z + carQuat.z * 0.5
  );
  camera.lookAt(lookAt);

  // Sun follows
  sun.position.set(carPos.x + 60, 100, carPos.z + 40);
  sun.target.position.copy(carPos);
  sun.target.updateMatrixWorld();
}

function updateHUD() {
  const kmh = Math.round(state.speed * 3.6);
  const safeKmh = isFinite(kmh) ? Math.max(0, kmh) : 0;
  document.getElementById('kmh').textContent = safeKmh;
  document.getElementById('gearBox').textContent = state.gear;

  const maxDisplay = 300;
  const ratio = Math.min(safeKmh / maxDisplay, 1);
  const arcLen = 260;
  document.getElementById('arc').setAttribute('stroke-dasharray', `${ratio * arcLen} ${arcLen}`);
}

function loop() {
  requestAnimationFrame(loop);

  const now = performance.now();
  let dt = (now - state.lastTime) / 1000;
  state.lastTime = now;
  if (!isFinite(dt) || dt > 0.1) dt = 0.016;
  if (dt < 0) dt = 0.016;

  if (state.running) {
    // Fixed-step physics with accumulator
    state.accumulator += dt;
    let steps = 0;
    while (state.accumulator >= FIXED_DT && steps < MAX_SUB_STEPS) {
      updateVehicle();
      world.step(FIXED_DT);
      state.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUB_STEPS) state.accumulator = 0;

    syncVisualCar(dt);
    updateCamera(dt);
    updateHUD();
    audio.update(state.rpm, state.throttle, state.speed);
  }

  composer.render();
}

// ============================================================
// START FLOW
// ============================================================
function startGame() {
  audio.start();
  document.getElementById('carSelect').classList.add('hide');
  document.getElementById('hud').classList.add('on');
  const car = CARS[state.selectedCar];
  document.getElementById('hudCarName').textContent = car.name;

  state.running = true;
  state.manual = false;
  state.manualGear = 0;
  state.autoGear = 1;
  state.gear = '1';
  state.rpm = 900;
  state.speed = 0;
  state.lastTime = performance.now();
  state.accumulator = 0;
  document.getElementById('hudTrans').textContent = 'AUTOMATIC';

  // Reset car position
  if (vehicleBody) {
    vehicleBody.position.set(0, 1.5, 0);
    vehicleBody.velocity.set(0, 0, 0);
    vehicleBody.angularVelocity.set(0, 0, 0);
    vehicleBody.quaternion.set(0, 0, 0, 1);
    vehicleBody.force.set(0, 0, 0);
    vehicleBody.torque.set(0, 0, 0);
  }

  // Reset input
  input.gas = input.brake = input.left = input.right = false;
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

function boot() {
  buildCarSelectUI();
  selectCar(0);
  setupInputs();

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('startBtn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); }, { passive: false });

  bumpLoad(80);

  setTimeout(() => {
    bumpLoad(100);
    document.getElementById('loader').classList.add('hide');
  }, 800);

  loop();
}

boot();