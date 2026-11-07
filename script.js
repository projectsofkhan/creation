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
renderer.toneMappingExposure = 1.5;
stage.insertBefore(renderer.domElement, stage.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 2, .1, 900);

let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.2, .7, .4));
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

/* ============================================================
   LIGHTING
   ============================================================ */
scene.add(new THREE.AmbientLight(0x8899cc, 1.5));
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
   GROUND (No Roads, just clean arena floor)
   ============================================================ */
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: .7, metalness: .2 });
const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(150, 64), floorMat);
floorMesh.rotation.x = -PI / 2;
floorMesh.position.y = -0.05;
scene.add(floorMesh);

/* ============================================================
   CITY SKYLINE
   ============================================================ */
const cityGroup = new THREE.Group();
scene.add(cityGroup);
const buildings = [];

function makeBuilding(w, h, d) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2c40, roughness: .9, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .55 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  box.position.y = h / 2;
  grp.add(box);
  
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * .9, h * .05, d * .9), new THREE.MeshStandardMaterial({ color: 0x1a1c2a, roughness: .9 }));
  roof.position.y = h + h * .025;
  grp.add(roof);

  if (h > 25 && Math.random() < .6) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, h * .2, 5), new THREE.MeshStandardMaterial({ color: 0x555566 }));
    ant.position.y = h + h * .1 + h * .1;
    grp.add(ant);
  }
  return grp;
}

for (let i = 0; i < 140; i++) {
  const a = rnd(0, 2 * PI), r = rnd(26, 95);
  const h = rnd(10, 60), w = rnd(5, 12), d = rnd(5, 12);
  const b = makeBuilding(w, h, d);
  b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  b.userData = { y0: 0, f: -1, d: Math.random() < .5 ? 1 : -1, h };
  cityGroup.add(b);
  buildings.push(b);
}

const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xbbccff, blending: AD, transparent: true, depthWrite: false, fog: false }));
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
   MALEVOLENT SHRINE (Chinese Temple Style)
   ============================================================ */
const shrine = new THREE.Group();
const boneMat   = new THREE.MeshStandardMaterial({ color: 0xefe4d0, emissive: 0x330808, emissiveIntensity: .5, roughness: .55 });
const darkBone  = new THREE.MeshStandardMaterial({ color: 0xa08e78, emissive: 0x220404, emissiveIntensity: .3, roughness: .7 });
const shrineRed = new THREE.MeshStandardMaterial({ color: 0x2a0202, emissive: 0xd00018, emissiveIntensity: 1.6, roughness: .45, metalness: .25 });
const shrineDark= new THREE.MeshStandardMaterial({ color: 0x0a0101, emissive: 0x770014, emissiveIntensity: 1.1, roughness: .5 });
const goldMat   = new THREE.MeshStandardMaterial({ color: 0xc0a030, emissive: 0x664400, emissiveIntensity: .8, roughness: .3, metalness: .85 });

// Foundation Steps
for (let i = 0; i < 4; i++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(14 - i * 2, .5, 10 - i * 1.5), shrineDark);
  step.position.y = .25 + i * .5;
  step.position.z = -2 + i * .5;
  shrine.add(step);
}

// Temple Pillars (Red with Gold caps)
for (let i = 0; i < 4; i++) {
  const x = i < 2 ? -5 : 5;
  const z = i % 2 === 0 ? -4 : 2;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.6, .7, 10, 8), shrineRed);
  pillar.position.set(x, 5 + 2, z);
  shrine.add(pillar);
  
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, .4, 1.6), goldMat);
  cap.position.set(x, 10 + 2, z);
  shrine.add(cap);
}

// Traditional Curved Roof (Chinese Temple Style)
const roofGroup = new THREE.Group();
roofGroup.position.y = 12.5;
roofGroup.position.z = -1;
const roofBase = new THREE.Mesh(new THREE.BoxGeometry(13, .5, 11), shrineDark);
roofGroup.add(roofBase);
for (let i = 0; i < 2; i++) {
  const slope = new THREE.Mesh(new THREE.BoxGeometry(13, .5, 8), shrineDark);
  slope.position.z = i === 0 ? -3.5 : 3.5;
  slope.rotation.x = i === 0 ? PI * 0.15 : -PI * 0.15;
  slope.position.y = 1.5;
  roofGroup.add(slope);
}
// Gold trim
const trim = new THREE.Mesh(new THREE.BoxGeometry(14, .2, 12), goldMat);
trim.position.y = 0.2;
roofGroup.add(trim);
shrine.add(roofGroup);

// Giant Skull on the roof
const giantSkull = new THREE.Mesh(new THREE.SphereGeometry(2.0, 22, 18), boneMat);
giantSkull.position.y = 15.5; giantSkull.scale.set(1, 1.2, .95); shrine.add(giantSkull);
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff0018 }));
  e.position.set(s * .7, 15.8, 1.5); shrine.add(e);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.3, 3.0, 7), boneMat);
  horn.position.set(s * 1.2, 17.5, .5); horn.rotation.z = s * .55; shrine.add(horn);
}

// Sukuna's Throne (At the top of the steps)
const throne = new THREE.Group();
const throneDarkMat = new THREE.MeshStandardMaterial({ color: 0x080101, emissive: 0xbb0018, emissiveIntensity: 1.3, roughness: .4 });
const throneBoneMat = new THREE.MeshStandardMaterial({ color: 0xe8d8c0, emissive: 0x220000, emissiveIntensity: .5, roughness: .6 });

const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, .5, 2.0), throneDarkMat);
seat.position.y = 3.0; throne.add(seat);
const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.0, .4), throneDarkMat);
back.position.set(0, 5.0, -.8); throne.add(back);
// Throne Skull Top
const tSkull = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), throneBoneMat);
tSkull.position.set(0, 7.2, -.8); throne.add(tSkull);
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
  e.position.set(s * .3, 7.2, -.1); throne.add(e);
}
throne.position.set(0, 1.5, -3);
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
  shrine.visible = name === 'shrine';
  stars.visible = name === 'void';
  moonSprite.visible = name === 'city';
}
setEnv('city');

/* ============================================================
   PARTICLES & FX HELPERS
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
const glowParticles = new ParticleSystem(3500, AD);
const smokeParticles = new ParticleSystem(800, THREE.NormalBlending);

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

const fxList = [];
const ringGeo = new THREE.RingGeometry(.9, 1, 48);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
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
function lightFlash(p, c, i) { combatLight.position.copy(p); combatLight.color.set(c); combatLightI = i; }
function impact(p, pw, c = [1.3, .7, .5]) {
  spark(p, Math.floor(30 * pw), 14 * pw, .4, .6, c, 8);
  sphereFX(p, 0xffffff, 1.5 * pw, .25);
  ringFX(p, 0xffffff, 3.5 * pw, .3, true);
  lightFlash(p, 0xffa070, 300 * pw);
  shake = Math.max(shake, .6 * pw);
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
   CHARACTERS
   ============================================================ */
const POSE = {
  idle:     { hy: 0, tx: 0, ty: 0, hdx: 0, lsx: -.15, lsz: .15, lel: -.35, rsx: -.15, rsz: -.15, rel: -.35, lhx: 0, lkn: .1, rhx: 0, rkn: .1 },
  dash:     { tx: .55, hy: -.15, lhx: -.8, lkn: .9, rhx: .7, rkn: .9, lsx: .5, rsx: .5, lel: -.2, rel: -.2, lsz: .1, rsz: -.1 },
  flyFwd:   { tx: .2, hy: -.1, lhx: -1, lkn: 1.3, rhx: .9, rkn: 1.3, lsx: -1.6, lsz: 1.1, lel: -.2, rsx: -1.6, rsz: -1.1, rel: -.2 },
  punchR:   { tx: .3, ty: -.6, rsx: -1.55, rel: 0, lsx: -.4, lel: -.5, hy: -.1, lhx: -.6, lkn: .7, rhx: .3, rsz: -.1, lsz: .1 },
  crossSlash:{ tx: .2, ty: -.5, rsx: -1.5, rsz: -1.1, rel: 0, lsx: -1.5, lsz: 1.1, lel: 0, hy: -.1 },
  kick:     { tx: -.25, rhx: -1.7, rkn: 0, lkn: .3, lsx: -.4, rsx: -.3, hy: -.05, lel: -.4, rel: -.4 },
  cast:     { lsx: -1.55, rsx: -1.55, lel: 0, rel: 0, lsz: .6, rsz: -.6, tx: -.1, hy: 0 },
  point:    { rsx: -1.55, rel: 0, lsx: .2, lel: -.3, tx: .1, hy: -.05, lhx: -.3, lkn: .4, ty: -.3, rsz: -.1 },
  raise:    { lsx: -2.8, rsx: -2.8, lsz: .5, rsz: -.5, tx: -.15, lel: -.3, rel: -.3, hy: 0 },
  hit:      { tx: -.5, hdx: -.35, lsx: .4, rsx: .4, lel: -.1, rel: -.1, lhx: -.2, rhx: .5, lkn: .2, hy: -.05, lsz: .2, rsz: -.2 },
  sign:     { lsx: -1.2, lel: -1.9, rsx: -1.2, rel: -1.9, lsz: -.1, rsz: .1, tx: .05, hy: 0 },
  kneel:    { hy: -.5, tx: .2, lhx: -1.3, lkn: 1.5, rhx: .2, rkn: 1.7, lsx: -.1, rsx: -.1, lel: -.2, rel: -.2 },
  open:     { lsz: 1.3, rsz: -1.3, lsx: -.2, rsx: -.2, lel: -.3, rel: -.3, hdx: -.25, tx: -.1, hy: 0 },
  sit:      { hy: -.55, tx: .2, lhx: -1.4, lkn: 1.4, rhx: -1.4, rkn: 1.4, lsx: -.3, lel: -.5, rsx: -.3, rel: -.5 }
};
const KEYS = ['hy','tx','ty','hdx','lsx','lsz','lel','rsx','rsz','rel','lhx','lkn','rhx','rkn'];

function makeCharacter(opts) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? .6, metalness: o.m ?? .15, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0 });
  const skinM = M(opts.skin, {r:.7}), topM = M(opts.top, {r:.55}), pantsM = M(opts.pants, {r:.65}), hairM = M(opts.hair, {r:.5}), bootM = M(opts.boots, {r:.5});
  const eyeM = new THREE.MeshBasicMaterial({ color: opts.eye });
  const grp = (p, x, y, z) => { const q = new THREE.Group(); q.position.set(x, y, z); p.add(q); return q; };

  const hips = grp(g, 0, 1.0, 0);
  const torso = grp(hips, 0, .1, 0);
  torso.add(new THREE.Mesh(new THREE.CapsuleGeometry(.23, .3, 5, 10), topM)).position.y = .38;
  
  const head = grp(torso, 0, .88, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 16), skinM);
  skull.position.y = .1; head.add(skull);
  
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.168, 20, 15, 0, PI*2, 0, PI*.58), hairM);
  hairCap.position.y = .1; head.add(hairCap);

  if (opts.hairStyle === 'gojo') {
    for (let i = 0; i < 8; i++) {
      const a = -PI * .5 + (i / 7) * PI;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), hairM);
      tuft.position.set(Math.cos(a) * .13, .18, Math.sin(a) * .1 + .04); head.add(tuft);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = -PI * .4 + (i / 4) * PI * .8;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), hairM);
      tuft.position.set(Math.cos(a) * .12, .15, Math.sin(a) * .08 - .05); head.add(tuft);
    }
  }

  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), eyeM);
    eye.position.set(s * .062, .13, .148); head.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.07, .01, .01), new THREE.MeshBasicMaterial({ color: 0x331111 }));
  mouth.position.set(0, .045, .152); head.add(mouth);

  const arm = (s) => {
    const sh = grp(torso, s * .34, .62, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), topM));
    const el = grp(sh, 0, -.35, 0);
    el.add(new THREE.Mesh(new THREE.CapsuleGeometry(.062, .24, 4, 8), skinM)).position.y = -.18;
    const hand = grp(el, 0, -.36, 0);
    hand.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .05), skinM)).position.y = -.02;
    return { sh, el, hand };
  };
  const armL = arm(1), armR = arm(-1);

  const leg = s => {
    const hp = grp(hips, s * .13, 0, 0);
    const kn = grp(hp, 0, -.46, 0);
    kn.add(new THREE.Mesh(new THREE.CapsuleGeometry(.078, .32, 4, 8), pantsM)).position.y = -.23;
    kn.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .08, .3), bootM)).position.set(0, -.46, .07);
    return { hp, kn };
  };
  const legL = leg(1), legR = leg(-1);

  const c = { g, hips, torso, head, armL, armR, legL, legR, L: armL, R: armR, lL: legL, lR: legR, p: g.position, cur: { ...POSE.idle }, tgt: POSE.idle, ret: 0, yaw: 0, pv: new V(), spd: 0, hd: 0, tilt: 0 };
  for (const k of KEYS) if (c.cur[k] === undefined) c.cur[k] = 0;
  scene.add(g);
  return c;
}

function setPose(c, name, hold = false) { c.tgt = POSE[name]; c.ret = hold ? 0 : .25; }

const gojo = makeCharacter({ skin: 0xf2d3bd, top: 0x0c0c18, pants: 0x0c0c18, hair: 0xf0f4ff, boots: 0x0a0a0e, eye: 0x9fe0ff, hairStyle: 'gojo' });
const sukuna = makeCharacter({ skin: 0xe6b898, top: 0xe8e0d0, pants: 0x16121c, hair: 0xd04a2a, boots: 0x0a0202, eye: 0xff3030, hairStyle: 'sukuna' });

// Gojo Blindfold
const blindfold = new THREE.Mesh(new THREE.TorusGeometry(.16, .03, 8, 24), new THREE.MeshStandardMaterial({ color: 0x050508 }));
blindfold.rotation.x = PI / 2; blindfold.position.y = .13; gojo.head.add(blindfold);

const gojoEyes = [];
gojo.head.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x9fe0ff) { gojoEyes.push(o); o.visible = false; } });

// Sukuna Markings
for (const s of [1, -1]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .012), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m.position.set(s * .09, .06, .14); m.rotation.z = -s * .3; sukuna.head.add(m);
}

/* ============================================================
   INFINITY BARRIER
   ============================================================ */
const infinityGroup = new THREE.Group();
infinityGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.75, 32, 20), new THREE.MeshBasicMaterial({ color: 0x66b8ff, transparent: true, opacity: .12, blending: AD, depthWrite: false, side: THREE.DoubleSide })));
const hexWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.82, 2), new THREE.MeshBasicMaterial({ color: 0x88d0ff, wireframe: true, transparent: true, opacity: .35, blending: AD, depthWrite: false }));
infinityGroup.add(hexWire);
const swirlRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, .02, 6, 48), new THREE.MeshBasicMaterial({ color: 0xaad8ff, transparent: true, opacity: .6, blending: AD, depthWrite: false }));
infinityGroup.add(swirlRing);
infinityGroup.visible = false;
scene.add(infinityGroup);

/* ============================================================
   POSITION TRACKS
   ============================================================ */
const p3 = (t, x, z = 0, y = 0) => [t, x, z, y];
const gojoTrack = [ p3(0,-12), p3(5,-9), p3(8.4,-7), p3(9,-1.2), p3(10,-3), p3(12,-1.4), p3(14,-6.5), p3(23,-4), p3(28,-6), p3(29,-5.2), p3(35.5,-5.2), p3(36.2,-4,1.2), p3(43.4,-4,1.2), p3(43.6,-6), p3(46,-5), p3(54.5,-5), p3(55.5,-1.2) ];
const sukunaTrack = [ p3(0,12), p3(5,9), p3(8.4,7), p3(9,1.2), p3(10,3), p3(12,1.6), p3(14.5,8), p3(19,8), p3(22,-2.5), p3(25.2,22,6), p3(27,9), p3(36.2,4,1.2), p3(43.4,4,1.2), p3(43.6,6), p3(47.8,7), p3(48.2,9), p3(49,16,3), p3(54.5,16), p3(55.5,1.2) ];

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
  f.tilt = lerp(f.tilt, airborne ? cl((t[3] - .3) * .35, 0, .5) : 0, 1 - Math.exp(-6 * dt));
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
  s.scale.set(5, 5, 1); q.add(s); q.visible = false; scene.add(q);
  return q;
}
const orbBlue   = makeOrb(0x80c0ff, 0x2a80ff);
const orbRed    = makeOrb(0xff6070, 0xff1030);
const orbPurple = makeOrb(0xd8a0ff, 0x8a2cff);

const dropBuilding = b => {
  if (b.userData.f < 0) {
    b.userData.f = T;
    puff(new V(b.position.x, 2, b.position.z), 5, 6, 3, 2, [.3, .28, .3]);
  }
};
const collapseBuildings = (filterFn, count) => {
  let c = 0;
  for (const b of buildings) {
    if (c < count && b.userData.f < 0 && filterFn(b.position)) { dropBuilding(b); c++; }
  }
};

function blackFlash(p) {
  sfx('explode');
  sphereFX(p, 0x000000, 2.4, .55, false);
  sphereFX(p, 0xff1030, 3.2, .4);
  ringFX(p, 0xff1030, 7, .5);
  spark(p, 80, 16, .4, .9, [1.4, .1, .2], 2);
  flashScreen('#300', .7, .5);
  lightFlash(p, 0xff1030, 600); shake = 4;
}

/* ============================================================
   TIMELINE
   ============================================================ */
const EVENTS = [];
const at = (t, fn) => EVENTS.push([t, fn]);
const midPoint = () => new V((gojo.p.x + sukuna.p.x) / 2, 1.4, 0);
const hitPoint = f => new V(f.p.x, 1.4 + f.p.y, 0);

at(0, () => { showBanner('JUJUTSU KAISEN', 'GOJO  vs  SUKUNA', 4.4); flashScreen('#000', 1, 1.6); sfx('riser'); });
at(5.2, () => say('SUKUNA', '"Let me see what you are, sorcerer."', 1.6));
at(6.9, () => { blindfold.position.y = .24; gojoEyes.forEach(e => e.visible = true); sfx('shing'); say('GOJO', '"Don\'t worry. I\'m the strongest."', 2); });
at(8.3, () => { setPose(gojo, 'dash', true); setPose(sukuna, 'dash', true); sfx('whoosh'); });

// Fast flying clash
at(9, () => {
  setPose(gojo, 'flyFwd', true); setPose(sukuna, 'flyFwd', true);
  const m = midPoint(); impact(m, 2.6);
  ringFX(m.clone().setY(.05), 0xffffff, 18, .8);
  flashScreen('#fff', .8, .5); shake = 3;
});

at(10.05, () => { setPose(sukuna, 'crossSlash'); setPose(gojo, 'hit'); impact(hitPoint(gojo), 1.5); });
at(10.9, () => { setPose(gojo, 'kick'); setPose(sukuna, 'hit'); impact(hitPoint(sukuna), 1.6); });
at(11.7, () => { setPose(gojo, 'hit'); impact(hitPoint(gojo), 1.2); });

at(12.1, () => say('GOJO', '"Black Flash."', 1.2));
at(12.2, () => setPose(gojo, 'punchR'));
at(12.38, () => { setPose(sukuna, 'hit', true); blackFlash(hitPoint(sukuna)); });
at(13.2, () => { puff(new V(sukuna.p.x, .3, 0), 30, 10, 3, 2); shake = 2; sfx('boom'); });

// Domains
at(27.2, () => { sfx('sukunaDomain'); setPose(sukuna, 'open', true); say('SUKUNA', '"Domain Expansion..."', 2.5); });
at(35.0, () => {
  sfx('malevolentShrine'); say('SUKUNA', '"Malevolent Shrine."', 2.0);
  setEnv('shrine'); shrine.scale.y = .01; shrine.visible = true; throne.visible = true;
  flashScreen('#f00', .9, .9); sfx('heavyBoom'); shake = 5; showBanner('MALEVOLENT SHRINE', '', 2.5);
});
at(36.0, () => { sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true); shake = 3; });
at(39, () => setPose(gojo, 'kneel', true));

at(42.4, () => { sfx('gojoDomain'); setPose(sukuna, 'idle'); setPose(gojo, 'sign', true); say('GOJO', '"Domain Expansion — Unlimited Void."', 2.2); sfx('beat'); });
at(43.1, () => {
  setEnv('void'); shrine.visible = false; throne.visible = false;
  sukuna.g.position.set(4, 0, 0); setPose(sukuna, 'hit', true);
  flashScreen('#fff', 1, .8); sfx('heavyBoom'); showBanner('UNLIMITED VOID', '', 2.5); shake = 3;
});
at(50.3, () => { flashScreen('#fff', 1, 1); sfx('heavyBoom'); });
at(50.5, () => { setEnv('city'); setPose(sukuna, 'kneel', true); setPose(gojo, 'idle'); sukuna.g.position.set(25, 0, 8); });

// Cinematic Hollow Purple
at(51.5, () => { sfx('sukunaLaugh'); setPose(gojo, 'cast', true); say('GOJO', '"Blue... and Red."', 1.5); sfx('charge'); });
at(52.5, () => { orbBlue.visible = true; orbBlue.position.set(gojo.p.x + 1.2, 1.5, 1.2); orbBlue.scale.setScalar(.2); });
at(53.3, () => { orbRed.visible = true; orbRed.position.set(gojo.p.x + 1.2, 1.5, -1.2); orbRed.scale.setScalar(.2); });
at(54.0, () => {
  const mid = new V(gojo.p.x + 1.5, 1.5, 0);
  orbBlue.position.copy(mid); orbRed.position.copy(mid);
  sphereFX(mid, 0xffffff, 3, .5); ringFX(mid, 0x9a40ff, 6, .5); sfx('charge');
});
at(54.5, () => {
  orbBlue.visible = false; orbRed.visible = false;
  orbPurple.visible = true; orbPurple.position.set(gojo.p.x + 1.5, 1.5, 0); orbPurple.scale.setScalar(.8);
  ringFX(orbPurple.position, 0x9a40ff, 12, 1); sphereFX(orbPurple.position, 0xb070ff, 4, .5);
  sfx('hollowPurple'); say('GOJO', '"Hollow Purple."', 1.5);
});
at(55.0, () => {
  const t0 = T;
  const grow = () => {
    if (!orbPurple.visible) return;
    const k = cl((T - t0) / 1.2, 0, 1);
    orbPurple.scale.setScalar(.8 + 3.5 * es(k));
    ringFX(orbPurple.position, 0x9a40ff, 3 * k, .3);
    if (k < 1) requestAnimationFrame(grow);
  };
  grow();
});
at(56.5, () => { setPose(gojo, 'point', true); sfx('purpleLaunch'); flashScreen('#a4f', .6, .6); shake = 3; });
at(56.6, () => {
  const startX = orbPurple.position.x, endX = sukuna.p.x;
  const startY = orbPurple.position.y, endY = 1.5;
  const startZ = orbPurple.position.z, endZ = sukuna.p.z;
  let pt = 0;
  const dur = 1.4;
  fxList.push(dt => {
    pt += dt; const k = cl(pt / dur, 0, 1); const ease = k * k;
    orbPurple.position.set(lerp(startX, endX, ease), lerp(startY, endY, ease) + Math.sin(k * PI) * 2, lerp(startZ, endZ, ease));
    orbPurple.scale.setScalar(3 + 6 * k);
    for (let i = 0; i < 6; i++) glowParticles.e(orbPurple.position.x + rnd(-1.5,1.5), orbPurple.position.y + rnd(-1.5,1.5), orbPurple.position.z + rnd(-1.5,1.5), rnd(-3,3), rnd(-3,3), rnd(-3,3), rnd(.4,1), rnd(.4,1), 1.2, .5, 1.8, 0, 1);
    if (Math.random() < .5) ringFX(orbPurple.position.clone(), 0x9a40ff, 4, .5);
    if (k >= 1) {
      const p = new V(endX, endY, endZ);
      orbPurple.visible = false; sfx('nuke');
      sphereFX(p, 0xffffff, 10, .6); sphereFX(p, 0xa040ff, 45, 1.6);
      ringFX(p.clone().setY(.1), 0xb070ff, 60, 1.8); ringFX(p, 0xb070ff, 25, 1.4, true);
      spark(p, 600, 50, 1.0, 2.5, [1.3, .5, 1.9], -1); puff(p, 120, 25, 6, 4, [.25, .2, .3]);
      flashScreen('#fff', 1, 1.4); shake = 15; lightFlash(p, 0x9a40ff, 5000);
      setPose(sukuna, 'hit', true);
      collapseBuildings(q => q.x > 0, 120);
      for (let i = 0; i < 20; i++) { const rp = p.clone().add(rd().multiplyScalar(rnd(10, 35))); sphereFX(rp, 0xff80ff, rnd(5, 10), rnd(1, 1.6)); ringFX(rp, 0xb070ff, rnd(15, 25), rnd(1, 1.6)); }
      return false;
    }
    return true;
  });
});
at(58.5, () => { setPose(gojo, 'idle'); puff(new V(10, .3, 0), 40, 10, 4, 3); });

at(61.5, () => { setPose(gojo, 'dash', true); setPose(sukuna, 'dash', true); sfx('whoosh'); sfx('riser'); });
at(62.5, () => { setPose(gojo, 'punchR'); setPose(sukuna, 'punchR'); impact(new V(0, 1.4, 0), 4); ringFX(new V(0, .1, 0), 0xffffff, 30, 1); sfx('explode'); });
at(63, () => { flashScreen('#fff', 1, .5); shake = 6; sfx('heavyBoom'); });
at(63.6, () => { const en = $('en'); en.style.display = 'flex'; requestAnimationFrame(() => en.style.opacity = 1); });

/* ============================================================
   CAMERA (Cinematic tracking)
   ============================================================ */
const CAMERA_SHOTS = [];
const addShot = (a, b, fn) => CAMERA_SHOTS.push([a, b, fn]);
function setCam(px, py, pz, lx, ly, lz, fov = 50) { cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz); cam.fov = fov; }

addShot(0, 5, k => setCam(0, lerp(10, 2.4, es(k)), lerp(30, 12, es(k)), 0, 1.4, 0, 48));
addShot(5, 8.5, k => setCam(gojo.p.x + 2, 1.7, gojo.p.z - 3, gojo.p.x, 1.6, 0, 42));
addShot(8.5, 9, k => setCam(0, 2.4, 8, 0, 1.4, 0, 52));

// Fast spinning clash
addShot(9, 12.2, k => {
  const a = lerp(.15, 2.5, k);
  const mid = midPoint(); const h = 2.8 + Math.sin(k * PI) * 1.6;
  setCam(Math.sin(a) * 8, h, Math.cos(a) * 8, mid.x, 1.4, 0, 55);
});
addShot(12.2, 13, k => setCam(sukuna.p.x + 2, 1.7, 3, sukuna.p.x, 1.5, 0, 38));

// Domain Shrine angles
addShot(28.4, 32.3, k => {
  const a = lerp(-.4, .4, k);
  setCam(Math.sin(a) * 14, lerp(2, 6, k), Math.cos(a) * 14 + 4, shrine.position.x, lerp(2, 6, k), 0, 55);
});
addShot(32.3, 35.4, k => setCam(0, 4.5, 6, 0, 4.5, -3, 45));

// Void angles
addShot(36.1, 43.5, k => {
  const a = lerp(.3, 2.6, k);
  setCam(Math.sin(a) * 10, 2.5, Math.cos(a) * 10, 0, 2, 0, 55);
});

// Hollow Purple Sequence
addShot(51.5, 54.5, k => setCam(gojo.p.x + 3, 1.8, 3, gojo.p.x + 1.5, 1.5, 0, 40));
addShot(54.5, 56.5, k => setCam(gojo.p.x + 4, 2.1, 4, gojo.p.x + 1.5, 1.5, 0, 42));

// Camera follows projectile
addShot(56.5, 58, k => {
  const op = orbPurple.position;
  setCam(op.x - 5, op.y + 3, op.z + 7, op.x + 5, op.y - 1, op.z, 60);
});

// Massive Impact aftermath
addShot(58, 61, k => setCam(lerp(25, 30, k), 10, 35, 20, 2, 0, 58));
addShot(61, 63.2, k => setCam(lerp(0, 1.3, k), lerp(1.5, 2.8, k), 6, 0, 1.5, 0, 48));

/* ============================================================
   AUDIO SYNTHESIS (Web Audio API - Always Works)
   ============================================================ */
let AC = null, masterGain = null, noiseBuf = null;
function initAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = .6; masterGain.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(type, f0, f1, dur, vol, q = 1) {
  if (!AC) return;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
  const t = AC.currentTime;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .15); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(masterGain); s.start(t); s.stop(t + dur + .05);
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  const t = AC.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + .05);
}
function sfx(n) {
  if (!AC) return;
  try {
    switch (n) {
      case 'gojoDomain':
        tone('sine', 180, 120, .8, .25); tone('sine', 270, 180, .8, .18, .15); tone('sine', 400, 260, 1.0, .15, .3); noise('lowpass', 400, 80, 2.4, .35);
        break;
      case 'sukunaDomain':
        noise('lowpass', 150, 40, 2.5, .7); tone('sawtooth', 55, 110, 2.4, .2); tone('sine', 40, 60, 2.6, .5);
        break;
      case 'malevolentShrine':
        noise('lowpass', 1200, 30, 2.5, .9); tone('sine', 90, 20, 2.2, 1.0); tone('triangle', 55, 22, 2.4, .7);
        break;
      case 'hollowPurple':
        tone('sine', 80, 220, 1.2, .35); tone('sawtooth', 60, 180, 1.2, .15); noise('bandpass', 800, 3000, 1.2, .25, 2);
        break;
      case 'purpleLaunch':
        noise('bandpass', 400, 4000, 1.4, .55, 1.5); tone('sawtooth', 60, 900, 1.4, .3);
        break;
      case 'sukunaLaugh':
        for (let i = 0; i < 3; i++) { tone('sawtooth', 280 - i * 20, 220 - i * 20, .12, .35, i * .18); noise('bandpass', 800 + i * 100, 1200, .1, .25, 3); }
        tone('sine', 100, 60, .6, .4);
        break;
      case 'explode':
        noise('lowpass', 2800, 200, .18, .9); tone('sine', 150, 40, .22, .8);
        break;
      case 'nuke':
        noise('lowpass', 1500, 25, 2.4, 1.0); noise('lowpass', 600, 40, 3.0, .8);
        tone('sine', 90, 18, 2.0, 1.2); tone('triangle', 55, 22, 2.4, .9); tone('sine', 35, 15, 2.8, 1.0);
        break;
      case 'whoosh': noise('bandpass', 400, 2600, .28, .5, 1.2); break;
      case 'boom': noise('lowpass', 700, 40, 1.4, 1); tone('sine', 85, 20, 1.5, 1); break;
      case 'heavyBoom': noise('lowpass', 1200, 30, 2.0, 1.0); tone('sine', 90, 18, 1.8, 1.2); break;
      case 'shing': noise('highpass', 4000, 9000, .25, .35); tone('sine', 2600, 3400, .2, .07); break;
      case 'riser': tone('sawtooth', 60, 900, 2.2, .12); noise('highpass', 300, 6000, 2.2, .25); break;
      case 'charge': tone('sawtooth', 70, 520, 1, .1); noise('highpass', 500, 4000, 1, .15); break;
      case 'beat': tone('sine', 60, 30, .25, .9); tone('sine', 60, 30, .25, .9, .35); break;
    }
  } catch (e) {}
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

  const showInf = (T > 14 && T < 19.6) || (T > 36.6 && T < 43.2);
  infinityGroup.visible = showInf;
  if (showInf) {
    infinityGroup.position.set(gojo.p.x, 1.2 + gojo.p.y, 0);
    const pulse = .12 + .08 * Math.sin(T * 14);
    hexWire.material.opacity = .3 + .15 * Math.sin(T * 6);
    swirlRing.rotation.z += dt * 3;
  }

  if (T >= 45 && T < 47) {
    const k = cl((T - 45) / 1, 0, 1);
    if (orbBlue.visible) orbBlue.scale.setScalar(.3 + 1.5 * k);
    if (orbRed.visible) orbRed.scale.setScalar(.3 + 1.5 * k);
  }

  if (T >= 36.6 && T < 43.2) {
    shrine.scale.y = Math.min(1, shrine.scale.y + dt * 1.2);
    acc += dt;
    while (acc > .06) {
      acc -= .06;
      const a = new V(rnd(-10, 10), rnd(.5, 6), rnd(-6, 6));
      const b = a.clone().add(new V(rnd(-8, 8), rnd(-3, 3), rnd(-5, 5)));
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
    vacc += dt;
    if (vacc > .5) {
      vacc = 0;
      ringFX(new V(0, 1.5, 0), Math.random() < .5 ? 0xffffff : 0x66b8ff, 30, 1.6, true);
    }
  }

  for (const b of buildings) {
    const u = b.userData;
    if (u.f >= 0) {
      const k = T - u.f;
      b.position.y = Math.max(-u.h, 0 - k * k * 8);
      b.rotation.z = u.d * Math.min(1, k * .5) * .8;
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
    cam.position.x += rnd(-1, 1) * shake * .15;
    cam.position.y += rnd(-1, 1) * shake * .15;
    cam.position.z += rnd(-1, 1) * shake * .15;
    shake *= Math.exp(-8 * dt);
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
    acc = 0; vacc = 0; shake = 0; combatLightI = 0;
    setEnv('city');
    shrine.scale.y = 1; shrine.visible = false; throne.visible = false;
    blindfold.position.y = .13;
    gojoEyes.forEach(e => e.visible = false);
    gojo.g.visible = true; sukuna.g.visible = true; sukuna.g.position.set(12, 0, 0);
    orbBlue.visible = orbRed.visible = orbPurple.visible = false;
    infinityGroup.visible = false;
    for (const f of [gojo, sukuna]) { f.cur = { ...POSE.idle }; f.tgt = POSE.idle; f.ret = 0; f.spd = 0; f.tilt = 0; f.pv.copy(f.p); }
    for (const b of buildings) { b.userData.f = -1; b.position.y = 0; b.rotation.z = 0; }
    for (let i = 0; i < glowParticles.max; i++) { glowParticles.l[i] = 0; glowParticles.s[i] = 0; }
    for (let i = 0; i < smokeParticles.max; i++) { smokeParticles.l[i] = 0; smokeParticles.s[i] = 0; }
  }, 350);
});

$('re').addEventListener('click', () => location.reload());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(frame);