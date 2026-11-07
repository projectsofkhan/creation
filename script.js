import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   HELPERS
   ============================================================ */
const V = THREE.Vector3, PI = Math.PI, AD = THREE.AdditiveBlending;
const rnd = (a, b) => a + Math.random() * (b - a);
const cl  = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const es  = k => k * k * (3 - 2 * k);
const $   = i => document.getElementById(i);
const rd  = () => { const u = rnd(-1, 1), a = rnd(0, 2*PI), s = Math.sqrt(1-u*u); return new V(s*Math.cos(a), u, s*Math.sin(a)); };

/* ============================================================
   STAGE / RENDERER
   ============================================================ */
const stage = $('stage');
let W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
stage.insertBefore(renderer.domElement, stage.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 2, .1, 900);

let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.0, .65, .5));
  composer.addPass(new OutputPass());
} catch (e) { composer = null; }

function layout() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); }
  cam.aspect = W / H;
  cam.updateProjectionMatrix();
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 250));
layout();

/* ============================================================
   TEXTURES
   ============================================================ */
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, '#fff'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const winTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8)
    if (Math.random() < .35) { g.fillStyle = Math.random() < .5 ? '#ffd89a' : '#9ad0ff'; g.fillRect(x, y, 4, 5); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

const roadTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#15151c'; g.fillRect(0, 0, 256, 256);
  // asphalt noise
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rnd(60,90)|0},${rnd(60,90)|0},${rnd(70,100)|0},.4)`;
    g.fillRect(Math.random()*256, Math.random()*256, 2, 2);
  }
  // lane markings (double yellow center + white edges)
  g.fillStyle = '#d8b040'; g.fillRect(122, 0, 4, 256); g.fillRect(130, 0, 4, 256);
  g.fillStyle = '#e8e8e8'; g.fillRect(16, 0, 3, 256); g.fillRect(237, 0, 3, 256);
  // dashed white
  for (let y = 0; y < 256; y += 64) { g.fillStyle = '#e8e8e8'; g.fillRect(76, y, 3, 32); g.fillRect(177, y, 3, 32); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

/* ============================================================
   LIGHTING
   ============================================================ */
scene.add(new THREE.AmbientLight(0x8899cc, 1.6));
const hemi = new THREE.HemisphereLight(0xaabbff, 0x221122, 2.0);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 12, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xaa66ff, 2.0);
rimLight.position.set(-8, 6, -10);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xff5566, 1.4);
fillLight.position.set(10, 4, -6);
scene.add(fillLight);
const combatLight = new THREE.PointLight(0xffffff, 0, 90, 2);
scene.add(combatLight);
let combatLightI = 0;

/* ============================================================
   GROUND — road + asphalt with sidewalk
   ============================================================ */
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: .7, metalness: .2 });
const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(120, 48), floorMat);
floorMesh.rotation.x = -PI / 2;
scene.add(floorMesh);

// central road strip
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: .85, metalness: .1 });
roadTex.repeat.set(1, 18);
const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 180), roadMat);
road.rotation.x = -PI / 2;
road.position.y = 0.02;
scene.add(road);

// cross road
const road2 = new THREE.Mesh(new THREE.PlaneGeometry(180, 14), roadMat.clone());
road2.material.map = roadTex.clone(); road2.material.map.repeat.set(18, 1);
road2.rotation.x = -PI / 2; road2.rotation.z = PI / 2;
road2.position.y = 0.02;
scene.add(road2);

// sidewalks (raised curbs) — two long strips beside the road
const curbMat = new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: .9 });
for (const s of [-1, 1]) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(3, .25, 180), curbMat);
  c.position.set(s * 8.5, .12, 0);
  scene.add(c);
}

/* ============================================================
   CITY SKYLINE — layered, more detailed
   ============================================================ */
const cityGroup = new THREE.Group();
scene.add(cityGroup);
const buildings = [];

function makeBuilding(w, h, d) {
  const grp = new THREE.Group();
  // main box
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a2c40, roughness: .9,
    emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .55
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  box.position.y = h / 2;
  grp.add(box);

  // roof detail
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * .9, h * .05, d * .9),
    new THREE.MeshStandardMaterial({ color: 0x1a1c2a, roughness: .9 }));
  roof.position.y = h + h * .025;
  grp.add(roof);

  // antenna on tall ones
  if (h > 25 && Math.random() < .6) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, h * .2, 5),
      new THREE.MeshStandardMaterial({ color: 0x555566 }));
    ant.position.y = h + h * .1 + h * .1;
    grp.add(ant);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(.25, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    blink.position.y = h + h * .22;
    grp.add(blink);
  }

  // some side ledges for detail
  if (Math.random() < .5) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, .6, d * 1.05),
      new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: .9 }));
    ledge.position.y = h * .4;
    grp.add(ledge);
  }

  return grp;
}

// build a full ring of buildings around the arena with variation
for (let i = 0; i < 120; i++) {
  const a = rnd(0, 2 * PI), r = rnd(26, 95);
  const h = rnd(10, 55), w = rnd(4, 10), d = rnd(4, 10);
  const b = makeBuilding(w, h, d);
  b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
  b.userData = { y0: h / 2, f: -1, d: Math.random() < .5 ? 1 : -1, h };
  cityGroup.add(b);
  buildings.push(b);
}

// moon + stars
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xbbccff, blending: AD, transparent: true, depthWrite: false, fog: false
}));
moonSprite.scale.set(90, 90, 1);
moonSprite.position.set(-90, 90, -140);
scene.add(moonSprite);

const stars = new THREE.Points((() => {
  const n = 2500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const d = new V(rnd(-1,1), rnd(-1,1), rnd(-1,1)).normalize().multiplyScalar(rnd(30, 100));
    p.set([d.x, d.y, d.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return g;
})(), new THREE.PointsMaterial({ size: .6, map: glowTex, color: 0xcfe4ff, blending: AD, transparent: true, depthWrite: false }));
stars.visible = false;
scene.add(stars);

/* ============================================================
   MALEVOLENT SHRINE — authentic skull-and-rib design
   ============================================================ */
const shrine = new THREE.Group();
const boneMat   = new THREE.MeshStandardMaterial({ color: 0xefe4d0, emissive: 0x330808, emissiveIntensity: .5, roughness: .55 });
const darkBone  = new THREE.MeshStandardMaterial({ color: 0xa08e78, emissive: 0x220404, emissiveIntensity: .3, roughness: .7 });
const shrineRed = new THREE.MeshStandardMaterial({ color: 0x2a0202, emissive: 0xd00018, emissiveIntensity: 1.6, roughness: .45, metalness: .25 });
const shrineDark= new THREE.MeshStandardMaterial({ color: 0x0a0101, emissive: 0x770014, emissiveIntensity: 1.1, roughness: .5 });
const goldMat   = new THREE.MeshStandardMaterial({ color: 0xc0a030, emissive: 0x664400, emissiveIntensity: .8, roughness: .3, metalness: .85 });

// central altar / base
const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.6, 10), shrineDark);
altar.position.y = 1.3; shrine.add(altar);
const altarTop = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, .15, 10), shrineRed);
altarTop.position.y = 2.65; shrine.add(altarTop);

// ── Four massive bone pillars with skulls on top (malevolent shrine's signature) ──
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * PI * 2 + PI / 4;
  const r = 5.0;
  const px = Math.cos(a) * r, pz = Math.sin(a) * r;

  // pillar body: tapered bone column
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.4, .6, 8.5, 9), shrineRed);
  pillar.position.set(px, 4.25, pz);
  shrine.add(pillar);

  // bone rings on the pillar (vertebrae look)
  for (let j = 0; j < 6; j++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .12, 6, 14), boneMat);
    ring.rotation.x = PI / 2;
    ring.position.set(px, 1.2 + j * 1.4, pz);
    shrine.add(ring);
  }

  // pillar base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, .5, 1.4), shrineDark);
  base.position.set(px, .25, pz); shrine.add(base);

  // giant skull on top
  const sk = new THREE.Mesh(new THREE.SphereGeometry(.75, 16, 12), boneMat);
  sk.position.set(px, 9.0, pz); sk.scale.set(1, 1.15, 1); shrine.add(sk);
  const jw = new THREE.Mesh(new THREE.BoxGeometry(.9, .25, .7), darkBone);
  jw.position.set(px, 8.5, pz + .3); shrine.add(jw);
  // eye sockets
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff1030 }));
    e.position.set(px + s * .3, 9.1, pz + .5); shrine.add(e);
    // brow
    const br = new THREE.Mesh(new THREE.BoxGeometry(.35, .1, .15), darkBone);
    br.position.set(px + s * .3, 9.35, pz + .48); br.rotation.z = s * .25; shrine.add(br);
  }
  // horns on skull
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(.12, .9, 6), boneMat);
    horn.position.set(px + s * .55, 9.6, pz);
    horn.rotation.z = s * .5;
    shrine.add(horn);
  }

  // rib arc connecting pillar to center
  const arc = new THREE.Mesh(new THREE.TorusGeometry(.5, .1, 6, 14, PI), boneMat);
  arc.position.set(px * .6, 6.5, pz * .6);
  arc.lookAt(0, 7, 0);
  shrine.add(arc);
}

// ── Central giant skull above the altar (the shrine's face) ──
const giantSkull = new THREE.Mesh(new THREE.SphereGeometry(1.6, 22, 18), boneMat);
giantSkull.position.y = 7.0; giantSkull.scale.set(1, 1.2, .95); shrine.add(giantSkull);
const giantJaw = new THREE.Mesh(new THREE.BoxGeometry(1.9, .45, 1.2), darkBone);
giantJaw.position.set(0, 6.0, .6); shrine.add(giantJaw);
// teeth
for (let t = -3; t <= 3; t++) {
  const tooth = new THREE.Mesh(new THREE.ConeGeometry(.1, .3, 4), boneMat);
  tooth.position.set(t * .22, 6.28, 1.05);
  tooth.rotation.x = PI;
  shrine.add(tooth);
}
// giant eye sockets
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff0018 }));
  e.position.set(s * .6, 7.1, 1.05); shrine.add(e);
  const br = new THREE.Mesh(new THREE.BoxGeometry(.8, .18, .25), darkBone);
  br.position.set(s * .6, 7.55, .95); br.rotation.z = s * .22; shrine.add(br);
  // horns
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.22, 2.0, 7), boneMat);
  horn.position.set(s * 1.05, 8.4, .15);
  horn.rotation.z = s * .55;
  shrine.add(horn);
}
// crown
const crownRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, .08, 8, 24), goldMat);
crownRing.rotation.x = PI / 2; crownRing.position.y = 8.4; shrine.add(crownRing);

// ── Rib cage arches around the shrine ──
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * PI * 2;
  const rib = new THREE.Mesh(new THREE.TorusGeometry(3.4, .1, 6, 20, PI), boneMat);
  rib.position.set(0, 3.6, 0);
  rib.rotation.set(PI / 2, a, 0);
  shrine.add(rib);
}

// ── Ground spikes / bone teeth ring ──
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * PI * 2;
  const r = 4.0;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(.25, 1.5, 6), darkBone);
  spike.position.set(Math.cos(a) * r, .75, Math.sin(a) * r);
  shrine.add(spike);
}

// ── SUKUNA'S THRONE — the famous skull throne ──
const throne = new THREE.Group();
const throneDarkMat = new THREE.MeshStandardMaterial({ color: 0x080101, emissive: 0xbb0018, emissiveIntensity: 1.3, roughness: .4 });
const throneBoneMat = new THREE.MeshStandardMaterial({ color: 0xe8d8c0, emissive: 0x220000, emissiveIntensity: .5, roughness: .6 });

// main seat block
const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, .4, 1.6), throneDarkMat);
seat.position.y = 1.1; throne.add(seat);
// tall back
const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, .35), throneDarkMat);
back.position.set(0, 2.4, -.75); throne.add(back);
// armrests
for (const s of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.35, .4, 1.5), throneDarkMat);
  arm.position.set(s * 1.15, 1.5, 0); throne.add(arm);
  // skull on armrest
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 9), throneBoneMat);
  s2.position.set(s * 1.15, 1.85, .7); throne.add(s2);
  // armrest bones
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .4, 3, 6), throneBoneMat);
    b.position.set(s * 1.15, 1.25 + i * .15, -.4 + i * .25);
    b.rotation.z = s * .3;
    throne.add(b);
  }
  // legs of throne (bone columns)
  for (let j = 0; j < 2; j++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 1.1, 7), throneBoneMat);
    leg.position.set(s * .85, .55, -.4 + j * .8);
    throne.add(leg);
  }
}
// stepped base
for (let i = 0; i < 3; i++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.6 + i * .6, .22, 2.2 + i * .5), throneDarkMat);
  step.position.y = .11 + i * .22; step.position.z = .3 - i * .12;
  throne.add(step);
}
// giant skull crowning the throne back
const throneSkull = new THREE.Mesh(new THREE.SphereGeometry(.85, 16, 13), throneBoneMat);
throneSkull.position.set(0, 4.1, -.75); throneSkull.scale.set(1, 1.15, 1); throne.add(throneSkull);
const throneJaw = new THREE.Mesh(new THREE.BoxGeometry(1.0, .25, .7), darkBone);
throneJaw.position.set(0, 3.6, -.35); throne.add(throneJaw);
// glowing throne eyes
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
  e.position.set(s * .28, 4.15, -.3); throne.add(e);
  // horns
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.14, 1.6, 6), throneBoneMat);
  horn.position.set(s * .95, 4.8, -.7);
  horn.rotation.z = s * .45;
  throne.add(horn);
}

// Place throne behind the altar, facing forward (toward the arena)
throne.position.set(0, 0, -4.5);
throne.visible = false;
shrine.add(throne);

shrine.position.set(0, 0, 0);
shrine.visible = false;
scene.add(shrine);

/* ============================================================
   ENVIRONMENTS
   ============================================================ */
const ENV = {
  city:   { bg: 0x1a1030, fog: 0x302050, density: .008, hemi: 0x8899cc, floor: 0x2a2a38 },
  shrine: { bg: 0x1a0000, fog: 0x400810, density: .016, hemi: 0xcc4444, floor: 0x300606 },
  void:   { bg: 0x000000, fog: null,    density: 0,     hemi: 0x334488, floor: 0x000000 }
};
function setEnv(name) {
  const e = ENV[name];
  scene.background = new THREE.Color(e.bg);
  scene.fog = e.density ? new THREE.FogExp2(e.fog, e.density) : null;
  hemi.color.set(e.hemi);
  floorMat.color.set(e.floor);
  cityGroup.visible = name === 'city';
  floorMesh.visible = name !== 'void';
  road.visible = name === 'city';
  road2.visible = name === 'city';
  shrine.visible = name === 'shrine';
  stars.visible = name === 'void';
  moonSprite.visible = name === 'city';
}
setEnv('city');

/* ============================================================
   PARTICLES
   ============================================================ */
class ParticleSystem {
  constructor(max, blending) {
    this.max = max; this.n = 0;
    const A = k => new Float32Array(max * k);
    this.p = A(3); this.c = A(3); this.s = A(1); this.a = A(1);
    this.v = A(3); this.l = A(1); this.tt = A(1); this.s0 = A(1); this.gr = A(1); this.dr = A(1);
    const g = new THREE.BufferGeometry(); this.g = g;
    const at = (n, a, k) => g.setAttribute(n, new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage));
    at('position', this.p, 3); at('pc', this.c, 3); at('ps', this.s, 1); at('pa', this.a, 1);
    this.m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      uniforms: { sc: { value: 600 } },
      vertexShader: `attribute vec3 pc; attribute float ps, pa; uniform float sc; varying vec3 vC; varying float vA;
        void main(){ vC=pc; vA=pa; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=ps*sc/(-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d)*vA; if(a<.01)discard; gl_FragColor=vec4(vC,a); }`
    });
    const pts = new THREE.Points(g, this.m);
    pts.frustumCulled = false;
    scene.add(pts);
  }
  e(x, y, z, vx, vy, vz, s, t, r, g, b, gr = 0, dr = 0) {
    const i = this.n; this.n = (i + 1) % this.max;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.c.set([r, g, b], i * 3);
    this.s0[i] = this.s[i] = s; this.tt[i] = this.l[i] = t; this.gr[i] = gr; this.dr[i] = dr; this.a[i] = 1;
  }
  u(dt) {
    const v = this.v, p = this.p;
    for (let i = 0; i < this.max; i++) {
      let l = this.l[i]; if (l <= 0) continue;
      l -= dt; this.l[i] = l;
      if (l <= 0) { this.s[i] = 0; this.a[i] = 0; continue; }
      const k = l / this.tt[i], d = Math.max(0, 1 - this.dr[i] * dt);
      v[i*3] *= d; v[i*3+1] = v[i*3+1] * d - this.gr[i] * dt; v[i*3+2] *= d;
      p[i*3] += v[i*3] * dt; p[i*3+1] += v[i*3+1] * dt; p[i*3+2] += v[i*3+2] * dt;
      this.a[i] = Math.min(1, k * 1.6);
      this.s[i] = this.s0[i] * (.35 + .65 * k);
    }
    for (const n of ['position', 'pc', 'ps', 'pa']) this.g.attributes[n].needsUpdate = true;
  }
}
const glowParticles = new ParticleSystem(3000, AD);
const smokeParticles = new ParticleSystem(600, THREE.NormalBlending);

const spark = (p, n, spd, sz, t, c, g = 6) => {
  for (let i = 0; i < n; i++) {
    const v = rd().multiplyScalar(spd * rnd(.25, 1));
    glowParticles.e(p.x, p.y, p.z, v.x, v.y, v.z, sz * rnd(.5, 1.3), t * rnd(.6, 1.3), c[0], c[1], c[2], g, 1.4);
  }
};
const puff = (p, n, spd, sz, t, c = [.4, .38, .4]) => {
  for (let i = 0; i < n; i++) {
    const v = rd().multiplyScalar(spd * rnd(.2, 1)); v.y = Math.abs(v.y) * .6;
    smokeParticles.e(p.x + rnd(-.6,.6), p.y, p.z + rnd(-.6,.6), v.x, v.y, v.z, sz * rnd(.6, 1.2), t * rnd(.7, 1.2), c[0], c[1], c[2], -.4, 1.6);
  }
};

/* ============================================================
   FX helpers
   ============================================================ */
const fxList = [];
const ringGeo = new THREE.RingGeometry(.9, 1, 48);
const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
let shake = 0;
const BM = (c, ad = true) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: ad ? AD : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide });

function ringFX(p, c, max, dur, vert) {
  const m = new THREE.Mesh(ringGeo, BM(c));
  if (vert) m.rotation.y = PI / 2; else m.rotation.x = -PI / 2;
  m.position.copy(p); scene.add(m);
  let t = 0;
  fxList.push(dt => {
    t += dt; const k = Math.min(1, t / dur);
    m.scale.setScalar(.2 + max * (1 - Math.pow(1 - k, 3)));
    m.material.opacity = (1 - k) * .9;
    if (k >= 1) { scene.remove(m); return false; }
    return true;
  });
}
function sphereFX(p, c, max, dur, ad = true) {
  const m = new THREE.Mesh(sphereGeo, BM(c, ad));
  m.position.copy(p); scene.add(m);
  let t = 0;
  fxList.push(dt => {
    t += dt; const k = Math.min(1, t / dur);
    m.scale.setScalar(.2 + max * Math.sqrt(k));
    m.material.opacity = (1 - k) * .85;
    if (k >= 1) { scene.remove(m); return false; }
    return true;
  });
}
function boltFX(a, b, c) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const q = a.clone().lerp(b, i / 8);
    if (i && i < 8) q.add(rd().multiplyScalar(.5));
    pts.push(q);
  }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c, transparent: true, blending: AD }));
  scene.add(l);
  let t = 0;
  fxList.push(dt => {
    t += dt; l.material.opacity = 1 - t / .3;
    if (t > .3) { scene.remove(l); return false; }
    return true;
  });
}
function lightFlash(p, c, i) { combatLight.position.copy(p); combatLight.color.set(c); combatLightI = i; }
function impact(p, pw, c = [1.3, .7, .5]) {
  spark(p, Math.floor(26 * pw), 12 * pw, .35, .6, c, 8);
  sphereFX(p, 0xffffff, 1.1 * pw, .22);
  ringFX(p, 0xffffff, 2.5 * pw, .3, true);
  lightFlash(p, 0xffa070, 200 * pw);
  shake = Math.max(shake, .5 * pw);
  sfx('explode');
}
function flashScreen(c, o, t = .7) {
  const e = $('fl'); e.style.transition = 'none'; e.style.background = c; e.style.opacity = o;
  void e.offsetWidth; e.style.transition = 'opacity ' + t + 's'; e.style.opacity = 0;
}
function showBanner(b, s, d = 2) {
  const e = $('ban'); e.innerHTML = `<b>${b}</b><i>${s || ''}</i>`;
  e.style.setProperty('--d', d + 's');
  e.classList.remove('s'); void e.offsetWidth; e.classList.add('s');
}
let subTimer = 0;
function say(name, text, d = 2.4) {
  const e = $('sub'); e.innerHTML = `<b>${name}</b>${text}`; e.style.opacity = 1;
  clearTimeout(subTimer); subTimer = setTimeout(() => e.style.opacity = 0, d * 1000);
}

/* ============================================================
   CHARACTERS — detailed rig, no spikes on heads
   ============================================================ */
const POSE = {
  idle:   { hy: 0, tx: 0, ty: 0, hdx: 0, lsx: -.15, lsz: .15, lel: -.35, rsx: -.15, rsz: -.15, rel: -.35, lhx: 0, lkn: .1, rhx: 0, rkn: .1 },
  dash:   { tx: .55, hy: -.15, lhx: -.8, lkn: .9, rhx: .7, rkn: .9, lsx: .5, rsx: .5, lel: -.2, rel: -.2, lsz: .1, rsz: -.1 },
  fly:    { tx: -.15, hy: -.1, lhx: -.7, lkn: .6, rhx: .5, rkn: .4, lsx: -1.3, lsz: .9, lel: -.5, rsx: -1.3, rsz: -.9, rel: -.5 },
  flyFwd: { tx: .2, hy: -.1, lhx: -1, lkn: 1.3, rhx: .9, rkn: 1.3, lsx: -1.6, lsz: 1.1, lel: -.2, rsx: -1.6, rsz: -1.1, rel: -.2 },
  punchR: { tx: .3, ty: -.6, rsx: -1.55, rel: 0, lsx: -.4, lel: -.5, hy: -.1, lhx: -.6, lkn: .7, rhx: .3, rsz: -.1, lsz: .1 },
  punchL: { tx: .3, ty: .6, lsx: -1.55, lel: 0, rsx: -.4, rel: -.5, hy: -.1, lhx: .3, rhx: -.6, rkn: .7, lsz: .1, rsz: -.1 },
  kick:   { tx: -.25, rhx: -1.7, rkn: 0, lkn: .3, lsx: -.4, rsx: -.3, hy: -.05, lel: -.4, rel: -.4 },
  cast:   { lsx: -1.55, rsx: -1.55, lel: 0, rel: 0, lsz: .6, rsz: -.6, tx: -.1, hy: 0 },
  point:  { rsx: -1.55, rel: 0, lsx: .2, lel: -.3, tx: .1, hy: -.05, lhx: -.3, lkn: .4, ty: -.3, rsz: -.1 },
  raise:  { lsx: -2.8, rsx: -2.8, lsz: .5, rsz: -.5, tx: -.15, lel: -.3, rel: -.3, hy: 0 },
  slash:  { rsx: -1.2, rsz: -1.3, rel: 0, ty: .7, tx: .15, lsx: -.3, lel: -.4, hy: -.1 },
  hit:    { tx: -.5, hdx: -.35, lsx: .4, rsx: .4, lel: -.1, rel: -.1, lhx: -.2, rhx: .5, lkn: .2, hy: -.05, lsz: .2, rsz: -.2 },
  sign:   { lsx: -1.2, lel: -1.9, rsx: -1.2, rel: -1.9, lsz: -.1, rsz: .1, tx: .05, hy: 0 },
  kneel:  { hy: -.5, tx: .2, lhx: -1.3, lkn: 1.5, rhx: .2, rkn: 1.7, lsx: -.1, rsx: -.1, lel: -.2, rel: -.2 },
  open:   { lsz: 1.3, rsz: -1.3, lsx: -.2, rsx: -.2, lel: -.3, rel: -.3, hdx: -.25, tx: -.1, hy: 0 },
  sit:    { hy: -.55, tx: .2, lhx: -1.4, lkn: 1.4, rhx: -1.4, rkn: 1.4, lsx: -.3, lel: -.5, rsx: -.3, rel: -.5 },
  uppercut:{ tx: -.2, hy: -.1, rsx: -2.4, rel: -.1, rsz: -.1, lsx: -.2, lel: -.4, lhx: -.3, lkn: .4, rhx: .2, rkn: .3, hdx: -.2 },
  spinKick:{ tx: .1, ty: 1.2, hy: -.05, rhx: -1.8, rkn: 0, lhx: -.4, lkn: .8, lsx: -1.3, lsz: 1.1, lel: -.2, rsx: -1.3, rsz: -1.1, rel: -.2 }
};
const KEYS = ['hy','tx','ty','hdx','lsx','lsz','lel','rsx','rsz','rel','lhx','lkn','rhx','rkn'];

function makeCharacter(opts) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({
    color: c, roughness: o.r ?? .6, metalness: o.m ?? .15,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0
  });
  const skinM  = M(opts.skin,  { r: .7 });
  const topM   = M(opts.top,   { r: .55, m: .2 });
  const pantsM = M(opts.pants, { r: .65, m: .15 });
  const hairM  = M(opts.hair,  { r: .55, m: .1 });
  const bootM  = M(opts.boots ?? 0x0a0a0e, { r: .5, m: .3 });
  const eyeM   = new THREE.MeshBasicMaterial({ color: opts.eye ?? 0x9fe0ff });

  const grp = (p, x, y, z) => { const q = new THREE.Group(); q.position.set(x, y, z); p.add(q); return q; };

  // HIPS
  const hips = grp(g, 0, 1.0, 0);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), pantsM);
  pelvis.scale.set(1.15, .8, .9); hips.add(pelvis);

  // TORSO
  const torso = grp(hips, 0, .1, 0);
  const waist = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .18, 5, 10), topM);
  waist.position.y = .08; waist.scale.set(1.15, 1, .8); torso.add(waist);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(.23, .3, 5, 10), topM);
  chest.position.y = .38; chest.scale.set(1.25, 1, .82); torso.add(chest);
  const upperChest = new THREE.Mesh(new THREE.SphereGeometry(.27, 16, 12), topM);
  upperChest.scale.set(1.35, .65, .9); upperChest.position.y = .6; torso.add(upperChest);

  // abs
  for (let i = 0; i < 3; i++) {
    const ab = new THREE.Mesh(new THREE.BoxGeometry(.26, .04, .02), M(opts.top, { r: .4, e: 0x111122, ei: .2 }));
    ab.position.set(0, .14 + i * .075, .32); torso.add(ab);
  }

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .08, 12), topM);
  collar.position.y = .68; torso.add(collar);

  // NECK
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .14, 10), skinM);
  neck.position.y = .75; torso.add(neck);

  // HEAD
  const head = grp(torso, 0, .88, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 16), skinM);
  skull.position.y = .1; skull.scale.set(.95, 1.12, 1); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(.18, .09, .14), skinM);
  jaw.position.set(0, .02, .04); head.add(jaw);

  // ── HAIR — clean cap, NO spikes ──
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(.168, 20, 15, 0, PI * 2, 0, PI * .58),
    hairM
  );
  hairCap.position.y = .1;
  hairCap.scale.set(1.02, 1.12, 1.04);
  head.add(hairCap);

  // side hair tufts (small, not spikes)
  if (opts.hairStyle === 'gojo') {
    // Gojo: smooth white cap with a soft forward fringe
    for (let i = 0; i < 8; i++) {
      const a = -PI * .5 + (i / 7) * PI;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), hairM);
      tuft.position.set(Math.cos(a) * .13, .18, Math.sin(a) * .1 + .04);
      tuft.scale.set(.9, .8, 1.2);
      head.add(tuft);
    }
  } else {
    // Sukuna: slicked back with pointed fringe
    for (let i = 0; i < 5; i++) {
      const a = -PI * .4 + (i / 4) * PI * .8;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), hairM);
      tuft.position.set(Math.cos(a) * .12, .15, Math.sin(a) * .08 - .05);
      tuft.scale.set(1.1, .7, 1);
      head.add(tuft);
    }
  }

  // FACE
  for (const s of [1, -1]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sclera.position.set(s * .062, .13, .142); sclera.scale.set(1.6, .8, .4); head.add(sclera);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), eyeM);
    eye.position.set(s * .062, .13, .148); eye.scale.set(1.5, .8, .5); head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .01), M(opts.hair, { r: .8 }));
    brow.position.set(s * .065, .175, .15); brow.rotation.z = -s * .25; head.add(brow);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(.008, 4, 3), new THREE.MeshBasicMaterial({ color: 0x550000 }));
    nostril.position.set(s * .02, .065, .155); head.add(nostril);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.07, .01, .01), new THREE.MeshBasicMaterial({ color: 0x331111 }));
  mouth.position.set(0, .045, .152); head.add(mouth);

  // ARMS
  const arm = (s, p, y, slM, faM) => {
    const sh = grp(p, s * .34, y, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), slM));
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .24, 4, 8), slM);
    upper.position.y = -.19; sh.add(upper);
    const el = grp(sh, 0, -.35, 0);
    el.add(new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), faM));
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.062, .24, 4, 8), faM);
    fore.position.y = -.18; el.add(fore);

    const hand = grp(el, 0, -.36, 0);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .05), faM);
    palm.position.y = -.02; hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const fg = new THREE.Mesh(new THREE.CapsuleGeometry(.013, .04, 3, 5), faM);
      fg.position.set(-.036 + i * .024, -.09, 0); hand.add(fg);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(.014, .04, 3, 5), faM);
    thumb.position.set(.055, -.04, .025); thumb.rotation.z = -.7; hand.add(thumb);
    return { sh, el, hand };
  };
  const armL = arm(1, torso, .62, topM, skinM);
  const armR = arm(-1, torso, .62, topM, skinM);

  // LEGS
  const leg = s => {
    const hp = grp(hips, s * .13, 0, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .32, 4, 8), pantsM);
    thigh.position.y = -.23; hp.add(thigh);
    const kn = grp(hp, 0, -.46, 0);
    kn.add(new THREE.Mesh(new THREE.SphereGeometry(.085, 8, 6), pantsM));
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.078, .32, 4, 8), pantsM);
    shin.position.y = -.23; kn.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.12, .08, .3), bootM);
    foot.position.set(0, -.46, .07); kn.add(foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(.11, .04, .08), bootM);
    toe.position.set(0, -.48, .2); kn.add(toe);
    return { hp, kn };
  };
  const legL = leg(1);
  const legR = leg(-1);

  const c = {
    g, hips, torso, head, armL, armR, legL, legR,
    L: armL, R: armR, lL: legL, lR: legR,
    p: g.position, cur: { ...POSE.idle }, tgt: POSE.idle,
    ret: 0, yaw: 0, pv: new V(), spd: 0, hd: 0, tilt: 0
  };
  for (const k of KEYS) if (c.cur[k] === undefined) c.cur[k] = 0;
  scene.add(g);
  return c;
}

const gojo = makeCharacter({
  skin: 0xf2d3bd, top: 0x0c0c18, pants: 0x0c0c18,
  hair: 0xf0f4ff, boots: 0x0a0a0e, eye: 0x9fe0ff, hairStyle: 'gojo'
});
const sukuna = makeCharacter({
  skin: 0xe6b898, top: 0xe8e0d0, pants: 0x16121c,
  hair: 0xd04a2a, boots: 0x0a0202, eye: 0xff3030, hairStyle: 'sukuna'
});

// Gojo's blindfold
const blindfold = new THREE.Mesh(
  new THREE.TorusGeometry(.16, .03, 8, 24),
  new THREE.MeshStandardMaterial({ color: 0x050508, roughness: .9 })
);
blindfold.rotation.x = PI / 2; blindfold.position.y = .13; gojo.head.add(blindfold);

const gojoEyes = [];
gojo.head.traverse(o => {
  if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x9fe0ff) {
    gojoEyes.push(o); o.visible = false;
  }
});

// Sukuna's extra background arms
for (const s of [1, -1]) {
  const a = new THREE.Group();
  a.position.set(s * .28, .5, -.12); sukuna.torso.add(a);
  a.rotation.x = -0.9; a.rotation.z = s * 0.3;
  const u = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .2, 3, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }));
  u.position.y = -.15; a.add(u);
  const el = new THREE.Group(); el.position.y = -.3; el.rotation.x = -1.2; a.add(el);
  const f2 = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .2, 3, 6), new THREE.MeshStandardMaterial({ color: 0xe6b898 }));
  f2.position.y = -.15; el.add(f2);
  const hand2 = new THREE.Mesh(new THREE.BoxGeometry(.08, .09, .04), new THREE.MeshStandardMaterial({ color: 0xe6b898 }));
  hand2.position.y = -.3; el.add(hand2);
}

// Sukuna facial markings (thin black lines — the tattoos)
for (const s of [1, -1]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .012), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m.position.set(s * .09, .06, .14); m.rotation.z = -s * .3; sukuna.head.add(m);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(.025, .07, .01), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m2.position.set(s * .13, .12, .11); m2.rotation.z = -s * .5; sukuna.head.add(m2);
  // under-eye line
  const m3 = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .01), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m3.position.set(s * .07, .08, .152); sukuna.head.add(m3);
}

// Gojo's high black collar
const gojoCollar = new THREE.Mesh(
  new THREE.CylinderGeometry(.11, .12, .14, 12, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x050508, side: THREE.DoubleSide })
);
gojoCollar.position.y = .72; gojo.torso.add(gojoCollar);

// Sukuna collar trim
const sukunaCollar = new THREE.Mesh(
  new THREE.TorusGeometry(.1, .018, 6, 16),
  new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
);
sukunaCollar.rotation.x = PI / 2; sukunaCollar.position.y = .66; sukuna.torso.add(sukunaCollar);

/* ============================================================
   INFINITY BARRIER — layered, swirling hex pattern
   ============================================================ */
const infinityGroup = new THREE.Group();
const infinityCore = new THREE.Mesh(
  new THREE.SphereGeometry(1.75, 32, 20),
  new THREE.MeshBasicMaterial({
    color: 0x66b8ff, transparent: true, opacity: .12,
    blending: AD, depthWrite: false, side: THREE.DoubleSide
  })
);
infinityGroup.add(infinityCore);

// hex wireframe shell
const hexGeo = new THREE.IcosahedronGeometry(1.82, 2);
const hexWire = new THREE.Mesh(
  hexGeo,
  new THREE.MeshBasicMaterial({ color: 0x88d0ff, wireframe: true, transparent: true, opacity: .35, blending: AD, depthWrite: false })
);
infinityGroup.add(hexWire);

// inner swirl ring
const swirlRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.4, .02, 6, 48),
  new THREE.MeshBasicMaterial({ color: 0xaad8ff, transparent: true, opacity: .6, blending: AD, depthWrite: false })
);
infinityGroup.add(swirlRing);
const swirlRing2 = swirlRing.clone();
swirlRing2.rotation.x = PI / 2;
infinityGroup.add(swirlRing2);

// outer glow sprite
const infinityGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0x66b8ff, blending: AD, transparent: true, depthWrite: false
}));
infinityGlow.scale.set(5, 5, 1);
infinityGroup.add(infinityGlow);

infinityGroup.visible = false;
scene.add(infinityGroup);

/* ============================================================
   POSITION TRACKS
   ============================================================ */
const p3 = (t, x, z = 0, y = 0) => [t, x, z, y];

const gojoTrack = [
  p3(0, -12), p3(5, -9), p3(8.4, -7), p3(9, -1.2), p3(9.9, -1), p3(10.05, -3),
  p3(10.7, -3), p3(10.9, -1.4), p3(11.6, -1.6), p3(12.2, -2), p3(12.35, -.2),
  p3(13.2, -1.5), p3(14, -6.5), p3(23, -4), p3(24.5, -4.6), p3(28, -6),
  p3(29, -5.2), p3(35.5, -5.2), p3(36.2, -4, 1.2), p3(43.4, -4, 1.2),
  p3(43.6, -6), p3(46, -5), p3(54.5, -5), p3(55.5, -1.2)
];
const sukunaTrack = [
  p3(0, 12), p3(5, 9), p3(8.4, 7), p3(9, 1.2), p3(10, 1.2), p3(10.1, -.4),
  p3(10.7, .2), p3(10.95, .9), p3(11.3, 3), p3(11.7, 1.6), p3(12.35, 1.2),
  p3(12.9, 11, 2.5), p3(13.6, 12), p3(14.5, 8), p3(19, 8), p3(20.2, 8),
  p3(22, -2.5), p3(24, -2), p3(25.2, 22, 6), p3(26.3, 24), p3(27, 9),
  p3(36.2, 4, 1.2), p3(43.4, 4, 1.2), p3(43.6, 6), p3(47.8, 7),
  p3(48.2, 9), p3(49, 16, 3), p3(50, 16), p3(54.5, 16), p3(55.5, 1.2)
];

function track(trackArr, t) {
  if (t <= trackArr[0][0]) return trackArr[0];
  for (let i = 1; i < trackArr.length; i++) {
    if (t <= trackArr[i][0]) {
      const a = trackArr[i - 1], b = trackArr[i];
      const k = es((t - a[0]) / (b[0] - a[0]));
      return [t, lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
  }
  return trackArr[trackArr.length - 1];
}

function updateFighter(f, trackArr, other, dt, time) {
  const t = track(trackArr, time);
  f.p.set(t[1], t[3], t[2]);
  const targetYaw = Math.atan2(other.p.x - f.p.x, other.p.z - f.p.z);
  f.yaw = lerp(f.yaw, targetYaw, 1 - Math.exp(-8 * dt));
  f.g.rotation.y = f.yaw;

  const speed = f.pv.distanceTo(f.p) / Math.max(dt, .001);
  f.spd = cl(speed / 9, 0, 1.2);
  f.pv.copy(f.p);
  f.hd += dt * (6 + f.spd * 8);

  const airborne = t[3] > .3;
  const targetTilt = airborne ? cl((t[3] - .3) * .35, 0, .5) : 0;
  f.tilt = lerp(f.tilt, targetTilt, 1 - Math.exp(-6 * dt));
  f.g.rotation.x = f.tilt;

  if (f.ret > 0) { f.ret -= dt; if (f.ret <= 0) f.tgt = POSE.idle; }
  const k = Math.min(1, 18 * dt), c = f.cur;
  for (const n of KEYS) c[n] += ((f.tgt[n] || 0) - c[n]) * k;

  const sw = Math.sin(f.hd) * .7 * f.spd;
  f.hips.position.y = 1 + c.hy + Math.sin(time * 2) * .015 - f.spd * .04;
  f.torso.rotation.set(c.tx, c.ty, 0);
  f.head.rotation.x = c.hdx;
  f.L.sh.rotation.set(c.lsx, 0, c.lsz); f.L.el.rotation.x = c.lel;
  f.R.sh.rotation.set(c.rsx, 0, c.rsz); f.R.el.rotation.x = c.rel;
  f.lL.hp.rotation.x = c.lhx + sw; f.lL.kn.rotation.x = c.lkn + Math.max(0, -sw) * 1.1;
  f.lR.hp.rotation.x = c.rhx - sw; f.lR.kn.rotation.x = c.rkn + Math.max(0, sw) * 1.1;
}

/* ============================================================
   ORBS
   ============================================================ */
function makeOrb(color, glowColor) {
  const q = new THREE.Group();
  q.add(new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 14), new THREE.MeshBasicMaterial({ color })));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: glowColor, blending: AD, transparent: true, depthWrite: false }));
  s.scale.set(5, 5, 1); q.add(s);
  q.visible = false; scene.add(q);
  return q;
}
const orbBlue   = makeOrb(0x80c0ff, 0x2a80ff);
const orbRed    = makeOrb(0xff6070, 0xff1030);
const orbPurple = makeOrb(0xd8a0ff, 0x8a2cff);

/* ============================================================
   BUILDING COLLAPSE
   ============================================================ */
const dropBuilding = b => {
  if (b.userData.f < 0) {
    b.userData.f = T;
    puff(new V(b.position.x, 2, b.position.z), 5, 6, 3, 2, [.3, .28, .3]);
  }
};
const collapseBuildings = (filterFn, count) => {
  let c = 0;
  for (const b of buildings) {
    if (c < count && b.userData.f < 0 && filterFn(b.position)) {
      dropBuilding(b); c++;
    }
  }
};

/* ============================================================
   PROJECTILE
   ============================================================ */
function fireProjectile() {
  const y = rnd(.8, 2), z = rnd(-1.4, 1.4);
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, .06, .06), BM(0xffffff));
  m.position.set(sukuna.p.x - 1, y, z);
  scene.add(m);
  fxList.push(dt => {
    m.position.x -= 42 * dt;
    glowParticles.e(m.position.x + 1.5, y, z, 0, 0, 0, .35, .3, 1.4, 1.4, 1.6);
    if (m.position.x <= gojo.p.x + 1.8) {
      const p = new V(m.position.x, y, z);
      spark(p, 12, 8, .3, .5, [.6, .9, 1.6]);
      ringFX(p, 0x66b8ff, 3, .4, true);
      if (infinityGroup.visible) infinityCore.material.opacity = .7;
      sfx('explode');
      shake = Math.max(shake, .5);
      collapseBuildings(q => q.x < -24 && Math.abs(q.z) < 14, 1);
      scene.remove(m); return false;
    }
    return true;
  });
}

function blackFlash(p) {
  sfx('explode');
  sphereFX(p, 0x000000, 2.4, .55, false);
  sphereFX(p, 0xff1030, 3.2, .4);
  ringFX(p, 0xff1030, 7, .5);
  for (let i = 0; i < 8; i++) boltFX(p, p.clone().add(rd().multiplyScalar(4)), i % 2 ? 0xff2040 : 0x111118);
  spark(p, 80, 16, .4, .9, [1.4, .1, .2], 2);
  flashScreen('#300', .7, .5);
  lightFlash(p, 0xff1030, 600); shake = 4;
}

/* ============================================================
   TIMELINE — extended for cinematic hollow purple
   ============================================================ */
const EVENTS = [];
const at = (t, fn) => EVENTS.push([t, fn]);
const midPoint = () => new V((gojo.p.x + sukuna.p.x) / 2, 1.4, 0);
const hitPoint = f => new V(f.p.x, 1.4 + f.p.y, 0);

/* OPENING */
at(0, () => {
  showBanner('JUJUTSU KAISEN', 'GOJO  vs  SUKUNA', 4.4);
  flashScreen('#000', 1, 1.6);
  sfx('riser');
});
at(5.2, () => say('SUKUNA', '"Let me see what you are, sorcerer."', 1.6));
at(6.9, () => {
  blindfold.position.y = .24;
  gojoEyes.forEach(e => e.visible = true);
  spark(new V(gojo.p.x, 1.9, 0), 25, 3, .3, 1, [.5, .9, 1.6], 0);
  sfx('shing');
  say('GOJO', '"Don\'t worry. I\'m the strongest."', 2);
});
at(8.3, () => { setPose(gojo, 'dash', true); setPose(sukuna, 'dash', true); sfx('whoosh'); });

/* FLYING CLASH */
at(9, () => {
  setPose(gojo, 'flyFwd', true);
  setPose(sukuna, 'flyFwd', true);
  const m = midPoint();
  impact(m, 2.4);
  ringFX(m.clone().setY(.05), 0xffffff, 16, .8);
  flashScreen('#fff', .8, .5); shake = 2;
  puff(m.clone().setY(.3), 26, 9, 2.4, 1.8);
});

at(10.05, () => { setPose(sukuna, 'uppercut'); setPose(gojo, 'hit'); impact(hitPoint(gojo), 1.3); });
at(10.9, () => { setPose(gojo, 'spinKick'); setPose(sukuna, 'hit'); impact(hitPoint(sukuna), 1.5); });
at(11.5, () => { setPose(sukuna, 'slash'); sfx('whoosh'); });
at(11.7, () => { setPose(gojo, 'hit'); impact(hitPoint(gojo), 1); });

at(12.1, () => say('GOJO', '"Black Flash."', 1.2));
at(12.2, () => setPose(gojo, 'punchR'));
at(12.38, () => { setPose(sukuna, 'hit', true); blackFlash(hitPoint(sukuna)); });
at(13.2, () => { puff(new V(sukuna.p.x, .3, 0), 24, 10, 3, 2); shake = 1.4; sfx('boom'); });
at(13.6, () => setPose(sukuna, 'idle'));

at(14, () => { say('SUKUNA', '"Dismantle."', 1.3); sfx('riser'); setPose(gojo, 'idle'); });
[14.3, 14.75, 15.2, 15.6, 16, 16.35, 16.7, 17].forEach(t => at(t, () => {
  setPose(sukuna, 'slash'); sfx('slash'); fireProjectile(); fireProjectile();
}));

at(17.5, () => say('GOJO', '"Infinity. Nothing touches me."', 1.6));
at(18.9, () => { setPose(gojo, 'point', true); sfx('riser'); say('GOJO', '"Lapse — Blue."', 1.5); });

at(22.9, () => {
  sphereFX(orbBlue.position, 0x66b8ff, 5, .4);
  ringFX(orbBlue.position.clone().setY(.1), 0x66b8ff, 9, .6);
  spark(orbBlue.position.clone(), 50, 14, .4, .7, [.5, .9, 1.6], 0);
  setPose(sukuna, 'hit');
  shake = 2; sfx('explode');
});

at(22.95, () => { setPose(gojo, 'point', true); say('GOJO', '"Reversal — Red."', 1.4); sfx('charge'); });

at(24, () => {
  const p = hitPoint(sukuna);
  sphereFX(p, 0xff1030, 9, .7);
  sphereFX(p, 0xffffff, 4, .3);
  ringFX(p.clone().setY(.1), 0xff2040, 18, 1);
  ringFX(p, 0xff2040, 8, .6, true);
  spark(p, 120, 22, .5, 1.2, [1.6, .2, .3], 2);
  puff(p, 30, 10, 3, 2.4);
  flashScreen('#f02', .8, .6);
  shake = 4;
  lightFlash(p, 0xff1030, 900);
  sfx('explode');
  setPose(gojo, 'idle'); setPose(sukuna, 'hit', true);
  collapseBuildings(q => q.x > 20 && Math.abs(q.z) < 16, 14);
});
at(24.8, () => sfx('boom'));
at(26.4, () => { sukuna.g.visible = false; spark(new V(24, 1.2, 0), 30, 8, .3, .7, [.6, .9, 1.6], 0); });
at(26.95, () => { sukuna.g.visible = true; setPose(sukuna, 'idle'); spark(new V(9, 1.2, 0), 30, 8, .3, .7, [.6, .9, 1.6], 0); sfx('shing'); shake = 1; });

/* SHRINE — Sukuna on his throne, "Domain Expansion" then "Malevolent Shrine" 8s later */
at(27.2, () => {
  sfx('sukunaDomain');
  setPose(sukuna, 'open', true);
  say('SUKUNA', '"Domain Expansion..."', 2.5);
});
at(35.0, () => {
  sfx('malevolentShrine');
  say('SUKUNA', '"Malevolent Shrine."', 2.0);
  setEnv('shrine');
  shrine.scale.y = .01;
  shrine.visible = true;
  throne.visible = true;
  flashScreen('#f00', .9, .9);
  sfx('heavyBoom'); shake = 4;
  showBanner('MALEVOLENT SHRINE', '', 2.5);
});
// Sukuna teleports onto his throne (sitting pose facing the arena)
at(36.0, () => {
  sukuna.g.position.set(0, 2.4, -4.5);
  setPose(sukuna, 'sit', true);
  shake = 2;
});
at(39, () => setPose(gojo, 'kneel', true));

/* UNLIMITED VOID */
at(42.4, () => {
  sfx('gojoDomain');
  setPose(sukuna, 'idle');
  setPose(gojo, 'sign', true);
  say('GOJO', '"Domain Expansion — Unlimited Void."', 2.2);
  sfx('beat');
});
at(43.1, () => {
  setEnv('void');
  shrine.visible = false; throne.visible = false;
  sukuna.g.position.set(4, 0, 0);
  setPose(sukuna, 'hit', true);
  flashScreen('#fff', 1, .8);
  sfx('heavyBoom');
  showBanner('UNLIMITED VOID', '', 2.5); shake = 2;
});
at(50.3, () => { flashScreen('#fff', 1, 1); sfx('heavyBoom'); });
at(50.5, () => {
  setEnv('city');
  setPose(sukuna, 'kneel', true);
  setPose(gojo, 'idle');
  puff(new V(0, .3, 0), 30, 10, 3, 2.4);
  // Move Sukuna far away for the cinematic Hollow Purple sequence
  sukuna.g.position.set(22, 0, 6);
});

/* ── CINEMATIC HOLLOW PURPLE ── */
at(51.5, () => {
  sfx('sukunaLaugh');
  setPose(gojo, 'cast', true);
  say('GOJO', '"Blue... and Red."', 1.5);
  sfx('charge');
});
// Blue forms at Gojo's left hand
at(52.5, () => {
  orbBlue.visible = true;
  orbBlue.position.set(gojo.p.x + 1.2, 1.5, 1.2);
  orbBlue.scale.setScalar(.2);
});
// Red forms at Gojo's right hand
at(53.3, () => {
  orbRed.visible = true;
  orbRed.position.set(gojo.p.x + 1.2, 1.5, -1.2);
  orbRed.scale.setScalar(.2);
});
// Merge into purple at Gojo's hands
at(54.0, () => {
  const mid = new V(gojo.p.x + 1.5, 1.5, 0);
  orbBlue.position.copy(mid); orbRed.position.copy(mid);
  sphereFX(mid, 0xffffff, 2, .5);
  ringFX(mid, 0x9a40ff, 5, .5);
  sfx('charge');
});
// Purple orb forms — Sukuna is far away
at(54.5, () => {
  orbBlue.visible = false; orbRed.visible = false;
  orbPurple.visible = true;
  orbPurple.position.set(gojo.p.x + 1.5, 1.5, 0);
  orbPurple.scale.setScalar(.8);
  ringFX(orbPurple.position, 0x9a40ff, 10, 1);
  sphereFX(orbPurple.position, 0xb070ff, 3, .5);
  sfx('hollowPurple');
  say('GOJO', '"Hollow Purple."', 1.5);
});
// Purple charges in Gojo's hand, growing
at(55.0, () => {
  const t0 = T;
  const grow = () => {
    if (!orbPurple.visible) return;
    const k = cl((T - t0) / 1.2, 0, 1);
    orbPurple.scale.setScalar(.8 + 2.6 * es(k));
    ringFX(orbPurple.position, 0x9a40ff, 2.5 * k, .3);
    if (k < 1) requestAnimationFrame(grow);
  };
  grow();
});
// Launch
at(56.5, () => {
  setPose(gojo, 'point', true);
  sfx('purpleLaunch');
  flashScreen('#a4f', .6, .6);
  shake = 2;
});
// PURPLE FLIES toward Sukuna — the projectile travels across the arena
const purpleLaunchStart = { pos: new V() };
at(56.6, () => {
  purpleLaunchStart.pos.copy(orbPurple.position);
  const startX = orbPurple.position.x;
  const endX = sukuna.p.x;
  const startY = orbPurple.position.y;
  const endY = 1.5;
  const startZ = orbPurple.position.z;
  const endZ = sukuna.p.z;
  let pt = 0;
  const dur = 1.4; // flight time
  fxList.push(dt => {
    pt += dt;
    const k = cl(pt / dur, 0, 1);
    const ease = k * k;
    orbPurple.position.set(
      lerp(startX, endX, ease),
      lerp(startY, endY, ease) + Math.sin(k * PI) * 1.5, // arc upward
      lerp(startZ, endZ, ease)
    );
    const s = 3 + 4 * k;
    orbPurple.scale.setScalar(s);
    // trail
    for (let i = 0; i < 4; i++) {
      glowParticles.e(
        orbPurple.position.x + rnd(-1, 1),
        orbPurple.position.y + rnd(-1, 1),
        orbPurple.position.z + rnd(-1, 1),
        rnd(-2, 2), rnd(-2, 2), rnd(-2, 2),
        rnd(.4, .8), rnd(.4, .8),
        1.2, .5, 1.8, 0, 1
      );
    }
    // leave rings behind
    if (Math.random() < .3) ringFX(orbPurple.position.clone(), 0x9a40ff, 3, .5);
    if (k >= 1) {
      // IMPACT — massive
      const p = new V(endX, endY, endZ);
      orbPurple.visible = false;
      sfx('nuke');
      // Massive multi-layer explosion
      sphereFX(p, 0xffffff, 8, .6);
      sphereFX(p, 0xa040ff, 35, 1.6);
      sphereFX(p, 0xd080ff, 20, 1.2);
      ringFX(p.clone().setY(.1), 0xb070ff, 50, 1.8);
      ringFX(p, 0xb070ff, 22, 1.4, true);
      ringFX(p.clone().setY(.1), 0xffffff, 30, 1.2);
      spark(p, 500, 40, .9, 2.4, [1.3, .5, 1.9], -1);
      puff(p, 90, 20, 6, 4, [.25, .2, .3]);
      flashScreen('#fff', 1, 1.4);
      shake = 10;
      lightFlash(p, 0x9a40ff, 4000);
      setPose(sukuna, 'hit', true);
      // Maximum destruction
      collapseBuildings(q => q.x > 0, 100);
      // Secondary explosions scattered
      for (let i = 0; i < 12; i++) {
        const rp = p.clone().add(rd().multiplyScalar(rnd(8, 30)));
        sphereFX(rp, 0xff80ff, rnd(4, 8), rnd(.8, 1.4));
        ringFX(rp, 0xb070ff, rnd(10, 20), rnd(1, 1.6));
      }
      return false;
    }
    return true;
  });
});
// Gojo lowers his hand
at(58.5, () => { setPose(gojo, 'idle'); puff(new V(10, .3, 0), 30, 10, 4, 3); });
at(60, () => setPose(sukuna, 'idle'));

at(61.5, () => { setPose(gojo, 'dash', true); setPose(sukuna, 'dash', true); sfx('whoosh'); sfx('riser'); });
at(62.5, () => {
  setPose(gojo, 'punchR'); setPose(sukuna, 'punchL');
  impact(new V(0, 1.4, 0), 3);
  ringFX(new V(0, .1, 0), 0xffffff, 22, 1);
  sfx('explode');
});
at(63, () => { flashScreen('#fff', 1, .5); shake = 5; sfx('heavyBoom'); });
at(63.6, () => {
  const en = $('en');
  en.style.display = 'flex';
  requestAnimationFrame(() => en.style.opacity = 1);
});

/* ============================================================
   CAMERA — cinematic, follows Hollow Purple
   ============================================================ */
const CAMERA_SHOTS = [];
const addShot = (a, b, fn) => CAMERA_SHOTS.push([a, b, fn]);

function setCam(px, py, pz, lx, ly, lz, fov = 50) {
  cam.position.set(px, py, pz);
  cam.lookAt(lx, ly, lz);
  cam.fov = fov;
}

addShot(0, 5, k => {
  const dist = lerp(30, 12, es(k));
  const height = lerp(10, 2.4, es(k));
  setCam(0, height, dist, 0, 1.4, 0, 48);
});
addShot(5, 6.8, k => setCam(gojo.p.x + 2, 1.7, gojo.p.z - 3, gojo.p.x, 1.6, 0, 42));
addShot(6.8, 7.7, k => setCam(gojo.p.x + 1.2, 1.7, 1.8, gojo.p.x, 1.7, 0, 38));
addShot(7.7, 8.5, k => setCam(sukuna.p.x - 1.2, 1.7, -1.8, sukuna.p.x, 1.7, 0, 38));
addShot(8.5, 9, k => setCam(0, 2.4, 8, 0, 1.4, 0, 52));

addShot(9, 12.2, k => {
  const a = lerp(.15, 1.9, k);
  const mid = midPoint();
  const h = 2.8 + Math.sin(k * PI) * 1.6;
  setCam(Math.sin(a) * 7, h, Math.cos(a) * 7, mid.x, 1.4, 0, 50);
});

addShot(12.2, 13, k => setCam(sukuna.p.x + 2, 1.7, 3, sukuna.p.x, 1.5, 0, 38));
addShot(13, 16.8, k => setCam(gojo.p.x - 3, 2.0, 7, gojo.p.x + 2, 1.4, 0, 52));
addShot(16.8, 19, k => setCam(gojo.p.x + 2.5, 1.7, 2, gojo.p.x, 1.5, 0, 42));
addShot(19, 20.3, k => setCam(gojo.p.x + 2, 1.7, 2.5, gojo.p.x + 1.5, 1.6, 0, 40));
addShot(20.3, 23, k => {
  const mid = midPoint();
  setCam(0, lerp(2.6, 1.9, k), lerp(13, 8, k), mid.x, 1.4, 0, 52);
});
addShot(23, 24, k => setCam(sukuna.p.x - 2, 1.7, 2, sukuna.p.x + 2, 1.6, 0, 48));
addShot(24, 26.4, k => setCam(lerp(12, 16, k), lerp(3, 5, k), 12, sukuna.p.x * .9, 1.4, 0, 52));
addShot(26.4, 28.4, k => setCam(0, 2, 12, 0, 1.4, 0, 52));

/* shrine cinematic pan */
addShot(28.4, 29.8, k => {
  const a = lerp(-.4, .4, k);
  setCam(Math.sin(a) * 10, lerp(1.5, 4, k), Math.cos(a) * 10 + 3, shrine.position.x, lerp(1.4, 5, k), 0, 55);
});
addShot(29.8, 32.3, k => {
  const a = lerp(0, 1.4, k);
  setCam(shrine.position.x + Math.sin(a) * 8, 3.2, 8, shrine.position.x, 3.5, -3, 52);
});
/* throne close-up */
addShot(32.3, 35.4, k => {
  const a = lerp(.2, 1.0, k);
  setCam(Math.sin(a) * 5, 2.8, 4, 0, 3.5, -4, 42);
});

addShot(35.4, 36.1, k => setCam(gojo.p.x + 1.5, 1.7, 2.2, gojo.p.x, 1.7, 0, 38));
addShot(36.1, 38.6, k => setCam(0, 1.8, lerp(14, 10, k), 0, 2, 0, 55));
addShot(38.6, 41, k => {
  const a = lerp(.3, 2.6, k);
  setCam(Math.sin(a) * 8, 2, Math.cos(a) * 8, 0, 2, 0, 55);
});
addShot(41, 43.5, k => setCam(gojo.p.x - 2.5, 1.9, 1, sukuna.p.x, 1.9, 0, 42));
addShot(43.5, 44.5, k => setCam(0, 2.2, 14, 0, 2, 0, 52));

/* PURPLE CHARGE — close-up on Gojo */
addShot(44.5, 51.5, k => {
  const a = lerp(.3, 1.6, k);
  setCam(gojo.p.x + Math.sin(a) * 4, 1.9, Math.cos(a) * 4 + 1, gojo.p.x, 1.6, 0, 42);
});
/* Blue/Red form — very close */
addShot(51.5, 54.5, k => setCam(gojo.p.x + 2.8, 1.8, 3, gojo.p.x + 1.5, 1.5, 0, 40));
addShot(54.5, 56.5, k => {
  const p = gojo.p.x + 1.5;
  setCam(p + 3.5, 2.1, 3.5, p, 1.5, 0, 42);
});

/* PURPLE FLIGHT — camera follows the orb across the arena */
addShot(56.5, 58, k => {
  const op = orbPurple.position;
  // camera trails behind and above the orb
  const camX = op.x - 4;
  const camY = op.y + 2.5;
  const camZ = op.z + 6;
  setCam(camX, camY, camZ, op.x + 4, op.y - .5, op.z, 55);
});

/* IMPACT — wide explosive view */
addShot(58, 61, k => setCam(lerp(20, 26, k), 8, 30, 18, 2, 0, 58));

/* AFTERMATH — orbit */
addShot(61, 63.2, k => {
  const a = lerp(0, 1.3, k);
  setCam(gojo.p.x + Math.sin(a) * 6, lerp(1.5, 2.8, k), Math.cos(a) * 6, gojo.p.x + 3, 1.5, 0, 48);
});

/* ============================================================
   AUDIO — synthesized engine (real files via optional local /audio/*.mp3)
   ============================================================
   MyInstants blocks direct hotlinking via CORS. If you download the
   real MP3s and place them in ./audio/, they will be used instead of
   the synthesized versions. Name them exactly as shown in REAL_FILES.
*/
let AC = null, masterGain = null, noiseBuf = null, musicStep = 0;
const realAudio = {};  // key -> Audio element (only if local file loads)

const REAL_FILES = {
  gojoDomain:       'audio/gojo-domain-expansion.mp3',
  sukunaDomain:     'audio/domain-expansion-sukuna.mp3',
  malevolentShrine: 'audio/malevolent-shrine.mp3',
  hollowPurple:     'audio/hollow-purple.mp3',
  sukunaLaugh:      'audio/sukuna-laugh.mp3',
  explode:          'audio/exploded.mp3',
  nuke:             'audio/nuke-bomb.mp3'
};

function initAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = .65; masterGain.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambient drone
    [55, 55.6, 82.4].forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = i > 1 ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.value = i > 1 ? .012 : .05;
      o.connect(g); g.connect(masterGain); o.start();
    });
    // Try loading local real audio files (optional)
    for (const [k, path] of Object.entries(REAL_FILES)) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = path;
      a.addEventListener('canplaythrough', () => {
        realAudio[k] = a;
        console.log('[audio] loaded real file:', k);
      }, { once: true });
      a.addEventListener('error', () => { /* silent — use synth */ }, { once: true });
    }
  } catch (e) { AC = null; }
}

function noise(type, f0, f1, dur, vol, q = 1) {
  if (!AC) return;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
  const t = AC.currentTime;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * .15);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(masterGain);
  s.start(t); s.stop(t + dur + .05);
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  const t = AC.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + .05);
}

// Try real file, else use synth callback
function playReal(key) {
  const a = realAudio[key];
  if (!a) return false;
  try { a.currentTime = 0; a.volume = .9; a.play().catch(() => {}); return true; }
  catch (e) { return false; }
}

// Simulated "domain chant" — two bell-like tones + low rumble
function synthDomainChant(pitchOffset = 0) {
  tone('sine', 180 + pitchOffset, 120 + pitchOffset, .8, .25);
  tone('sine', 270 + pitchOffset, 180 + pitchOffset, .8, .18, .15);
  tone('sine', 400 + pitchOffset, 260 + pitchOffset, 1.0, .15, .3);
  noise('lowpass', 400, 80, 2.4, .35);
}

function synthSukunaDomain() {
  // deep rumble + rising drone
  noise('lowpass', 150, 40, 2.5, .7);
  tone('sawtooth', 55, 110, 2.4, .2);
  tone('sine', 40, 60, 2.6, .5);
}

function synthShrine() {
  noise('lowpass', 1200, 30, 2.5, .9);
  tone('sine', 90, 20, 2.2, 1.0);
  tone('triangle', 55, 22, 2.4, .7);
}

function synthHollowPurple() {
  // charging hum
  tone('sine', 80, 220, 1.2, .35);
  tone('sawtooth', 60, 180, 1.2, .15);
  noise('bandpass', 800, 3000, 1.2, .25, 2);
}

function synthPurpleLaunch() {
  // whoosh + charge
  noise('bandpass', 400, 4000, 1.4, .55, 1.5);
  tone('sawtooth', 60, 900, 1.4, .3);
}

function synthLaugh() {
  // Sukuna-style short laugh — three staccato bursts
  for (let i = 0; i < 3; i++) {
    tone('sawtooth', 280 - i * 20, 220 - i * 20, .12, .35, i * .18);
    noise('bandpass', 800 + i * 100, 1200, .1, .25, 3);
  }
  tone('sine', 100, 60, .6, .4);
}

function sfx(n) {
  if (!AC) return;
  try {
    switch (n) {
      case 'gojoDomain':
        if (playReal('gojoDomain')) return;
        synthDomainChant(0);
        tone('sine', 220, 440, 1.5, .25);
        tone('sine', 330, 660, 1.5, .18, .2);
        break;
      case 'sukunaDomain':
        if (playReal('sukunaDomain')) return;
        synthSukunaDomain();
        break;
      case 'malevolentShrine':
        if (playReal('malevolentShrine')) return;
        synthShrine();
        break;
      case 'hollowPurple':
        if (playReal('hollowPurple')) return;
        synthHollowPurple();
        break;
      case 'purpleLaunch':
        synthPurpleLaunch();
        break;
      case 'sukunaLaugh':
        if (playReal('sukunaLaugh')) return;
        synthLaugh();
        break;
      case 'explode':
        if (playReal('explode')) return;
        noise('lowpass', 2800, 200, .18, .9);
        tone('sine', 150, 40, .22, .8);
        break;
      case 'nuke':
        if (playReal('nuke')) return;
        // Massive layered explosion
        noise('lowpass', 1500, 25, 2.4, 1.0);
        noise('lowpass', 600, 40, 3.0, .8);
        tone('sine', 90, 18, 2.0, 1.2);
        tone('triangle', 55, 22, 2.4, .9);
        tone('sine', 35, 15, 2.8, 1.0);
        tone('sawtooth', 70, 25, 1.8, .4);
        break;
      case 'whoosh': noise('bandpass', 400, 2600, .28, .5, 1.2); break;
      case 'hit': noise('lowpass', 2800, 200, .18, .9); tone('sine', 150, 40, .22, .8); break;
      case 'boom': noise('lowpass', 700, 40, 1.4, 1); tone('sine', 85, 20, 1.5, 1); break;
      case 'heavyBoom':
        noise('lowpass', 1200, 30, 2.0, 1.0);
        tone('sine', 90, 18, 1.8, 1.2);
        tone('triangle', 55, 22, 2.2, .8);
        tone('sine', 35, 15, 2.5, 1.0);
        break;
      case 'crack':
        noise('highpass', 3000, 9000, .25, .8);
        tone('square', 900, 60, .3, .3);
        tone('sine', 60, 25, .8, .9);
        break;
      case 'slash':
        noise('highpass', 2500, 9000, .2, .5);
        noise('bandpass', 1500, 6000, .15, .4, 3);
        break;
      case 'shing':
        noise('highpass', 4000, 9000, .25, .35);
        tone('sine', 2600, 3400, .2, .07);
        break;
      case 'riser':
        tone('sawtooth', 60, 900, 2.2, .12);
        noise('highpass', 300, 6000, 2.2, .25);
        break;
      case 'charge':
        tone('sawtooth', 70, 520, 1, .1);
        noise('highpass', 500, 4000, 1, .15);
        break;
      case 'hum':
        tone('sine', 110, 220, 1.6, .4);
        tone('sawtooth', 55, 110, 1.6, .15);
        break;
      case 'beat':
        tone('sine', 60, 30, .25, .9);
        tone('sine', 60, 30, .25, .9, .35);
        break;
    }
  } catch (e) {}
}

const MUSIC_INTENSITY = [[0,.1],[5,.25],[8.5,.9],[14,.6],[19,.85],[26.4,.3],[28.4,.95],[35.4,.45],[43.5,.3],[44.5,.7],[48,.2],[54.4,.85],[56.2,0]];
const BASS_NOTES = [55,55,65.4,49,55,55,73.4,65.4];
const ARP_NOTES = [220,262,330,392,330,262];

function musicTick() {
  if (!AC || T < musicStep) return;
  musicStep = T + .25;
  const n = Math.round(T * 4);
  const intensity = (MUSIC_INTENSITY.filter(x => x[0] <= T).pop() || [0, 0])[1];
  if (intensity <= .05) return;
  const bass = BASS_NOTES[(n >> 1) % 8];
  tone('sawtooth', bass, bass * .98, .3, .1 * intensity);
  if (n % 2 === 0 && intensity > .5) tone('sine', 130, 40, .2, .5 * intensity);
  if (intensity > .6 && n % 2) noise('highpass', 6000, 9000, .06, .12 * intensity);
  if (intensity > .4 && (T < 35.4 || T > 44)) tone('triangle', ARP_NOTES[n % 6] * (intensity > .8 ? 2 : 1), ARP_NOTES[n % 6], .2, .04 * intensity);
  if (T > 36 && T < 43.5 && n % 8 === 0) [220, 277, 330].forEach(f => tone('sine', f, f, 2, .05));
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let T = 0, running = false, eventIdx = 0, last = performance.now();
let acc = 0, vacc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (running) T += dt;

  while (running && eventIdx < EVENTS.length && EVENTS[eventIdx][0] <= T) {
    EVENTS[eventIdx][1]();
    eventIdx++;
  }

  updateFighter(gojo, gojoTrack, sukuna, dt, T);
  updateFighter(sukuna, sukunaTrack, gojo, dt, T);
  musicTick();

  // Infinity barrier
  const showInf = (T > 14 && T < 19.6) || (T > 36.6 && T < 43.2);
  infinityGroup.visible = showInf;
  if (showInf) {
    infinityGroup.position.set(gojo.p.x, 1.2 + gojo.p.y, 0);
    const pulse = .12 + .08 * Math.sin(T * 14);
    infinityCore.material.opacity = Math.max(pulse, infinityCore.material.opacity - dt * 2);
    hexWire.material.opacity = .3 + .15 * Math.sin(T * 6);
    swirlRing.rotation.z += dt * 3;
    swirlRing.rotation.x = Math.sin(T) * .5;
    swirlRing2.rotation.y += dt * 2.5;
    swirlRing2.rotation.z = Math.cos(T) * .5;
    const s = 1 + .04 * Math.sin(T * 5);
    hexWire.scale.setScalar(s);
    infinityGlow.material.opacity = .6 + .3 * Math.sin(T * 8);
  }

  if (T >= 45 && T < 47) {
    const k = cl((T - 45) / 1, 0, 1);
    if (orbBlue.visible) orbBlue.scale.setScalar(.3 + 1.5 * k);
    if (orbRed.visible) orbRed.scale.setScalar(.3 + 1.5 * k);
    if (orbBlue.visible) {
      for (let i = 0; i < 4; i++) {
        const a = rnd(0, 2 * PI), r = rnd(2, 4);
        glowParticles.e(orbBlue.position.x + Math.cos(a) * r, orbBlue.position.y + Math.sin(a) * r * .6, rnd(-1, 1),
          -Math.cos(a) * 5, -Math.sin(a) * 5, 0, .3, .5, .3, .7, 1.6);
      }
    }
  }

  if (T >= 36.6 && T < 43.2) {
    shrine.scale.y = Math.min(1, shrine.scale.y + dt * 1.2);
    acc += dt;
    while (acc > .06) {
      acc -= .06;
      const a = new V(rnd(-7, 7), rnd(.5, 4), rnd(-4, 4));
      const b = a.clone().add(new V(rnd(-6, 6), rnd(-2, 2), rnd(-4, 4)));
      const line = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, a.distanceTo(b)), BM(Math.random() < .7 ? 0xffffff : 0xff2030));
      line.position.copy(a).add(b).multiplyScalar(.5);
      line.lookAt(b);
      scene.add(line);
      let lt = 0;
      fxList.push(dt => { lt += dt; line.material.opacity = 1 - lt / .14; if (lt > .14) { scene.remove(line); return false; } return true; });
    }
    shake = Math.max(shake, .45);
  }

  if (T >= 43.2 && T < 50.4) {
    stars.rotation.y += dt * .15;
    stars.rotation.z += dt * .05;
    vacc += dt;
    if (vacc > .5) {
      vacc = 0;
      ringFX(new V(0, 1.5, 0), Math.random() < .5 ? 0xffffff : 0x66b8ff, 30, 1.6, true);
      ringFX(new V(0, 1.5, 0), 0xaaccff, 25, 1.4);
    }
    for (let i = 0; i < 6; i++) glowParticles.e(rnd(-12, 12), rnd(-3, 8), rnd(-12, 12), 0, 0, -30, rnd(.2, .5), .5, .9, 1.1, 1.6);
  }

  for (const b of buildings) {
    const u = b.userData;
    if (u.f >= 0) {
      const k = T - u.f;
      b.position.y = Math.max(-u.h, u.y0 - k * k * 6);
      b.rotation.z = u.d * Math.min(1, k * .5) * .5;
    }
  }

  combatLightI *= Math.exp(-10 * dt);
  combatLight.intensity = combatLightI;

  for (let i = fxList.length - 1; i >= 0; i--) if (!fxList[i](dt)) fxList.splice(i, 1);

  glowParticles.u(dt);
  smokeParticles.u(dt);

  let camUpdated = false;
  for (const s of CAMERA_SHOTS) {
    if (T >= s[0] && T < s[1]) {
      s[2]((T - s[0]) / (s[1] - s[0]));
      camUpdated = true;
      break;
    }
  }
  if (!camUpdated && T >= 63.2) setCam(0, 1.6, 6, 0, 1.4, 0, 40);

  if (shake > .01) {
    cam.position.x += rnd(-1, 1) * shake * .1;
    cam.position.y += rnd(-1, 1) * shake * .1;
    cam.position.z += rnd(-1, 1) * shake * .1;
    shake *= Math.exp(-6 * dt);
  }

  cam.updateProjectionMatrix();

  const sc = renderer.domElement.height / (2 * Math.tan(cam.fov * PI / 360));
  glowParticles.m.uniforms.sc.value = sc;
  smokeParticles.m.uniforms.sc.value = sc;

  if (composer) composer.render();
  else renderer.render(scene, cam);
}

/* ============================================================
   START / REPLAY
   ============================================================ */
$('go').addEventListener('click', async () => {
  $('st').style.display = 'none';
  initAudio();

  try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}

  setTimeout(() => {
    layout();
    T = 0; eventIdx = 0; running = true;
    musicStep = 0; acc = 0; vacc = 0;
    shake = 0; combatLightI = 0;
    setEnv('city');
    shrine.scale.y = 1;
    shrine.visible = false;
    throne.visible = false;
    blindfold.position.y = .13;
    gojoEyes.forEach(e => e.visible = false);
    gojo.g.visible = true;
    sukuna.g.visible = true;
    sukuna.g.position.set(12, 0, 0);
    orbBlue.visible = orbRed.visible = orbPurple.visible = false;
    infinityGroup.visible = false;
    for (const f of [gojo, sukuna]) {
      f.cur = { ...POSE.idle };
      f.tgt = POSE.idle;
      f.ret = 0;
      f.spd = 0;
      f.tilt = 0;
      f.pv.copy(f.p);
    }
    for (const b of buildings) {
      b.userData.f = -1;
      b.position.y = b.userData.y0;
      b.rotation.z = 0;
    }
    for (let i = 0; i < glowParticles.max; i++) { glowParticles.l[i] = 0; glowParticles.s[i] = 0; }
    for (let i = 0; i < smokeParticles.max; i++) { smokeParticles.l[i] = 0; smokeParticles.s[i] = 0; }
  }, 350);
});

$('re').addEventListener('click', () => location.reload());

document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(frame);