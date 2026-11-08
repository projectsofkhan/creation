import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   HELPERS
   ============================================================ */
const V = THREE.Vector3, PI = Math.PI, AD = THREE.AdditiveBlending;
const rnd = (a, b) => a + Math.random() * (b - a);
const cl  = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const es  = k => k * k * (3 - 2 * k);
const eIn = k => k * k * k;
const eOut = k => 1 - Math.pow(1 - k, 3);
const $   = i => document.getElementById(i);
const rd  = () => { const u = rnd(-1, 1), a = rnd(0, 2*PI), s = Math.sqrt(1-u*u); return new V(s*Math.cos(a), u, s*Math.sin(a)); };
const alerp = (a, b, t) => {
  let d = ((b - a + PI) % (2*PI)) - PI;
  if (d < -PI) d += 2*PI;
  return a + d * t;
};

/* ============================================================
   AUDIO — MP3s + synthesized layered SFX
   ============================================================ */
const AUDIO_URLS = {
  explode:      './audio/explode.mp3',
  hollowPurple: './audio/purple.mp3',
  nuke:         './audio/nuke.mp3',
  gojoDomain:   './audio/gojo-domain.mp3',
  sukunaDomain: './audio/sukuna-domain.mp3',
  sukunaLaugh:  './audio/sukuna-laugh.mp3',
  blackslash:   './audio/blackslash.mp3',
  youcan:       './audio/youcan.mp3'
};

const AUDIO = {};
const AUDIO_OK = {};
let audioLoaded = 0, audioTotal = Object.keys(AUDIO_URLS).length;

function preloadAudio() {
  return new Promise(resolve => {
    const ld = $('ld');
    let resolved = false;
    const finish = () => { if (!resolved) { resolved = true; resolve(); } };

    for (const [key, url] of Object.entries(AUDIO_URLS)) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      a.volume = key === 'sukunaLaugh' ? .7 : 1.0;
      AUDIO[key] = a;
      AUDIO_OK[key] = false;

      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        AUDIO_OK[key] = ok;
        audioLoaded++;
        if (ld) ld.textContent = `Loading audio… ${audioLoaded}/${audioTotal}`;
        console.log(`[audio] ${key}: ${ok ? 'OK' : 'FAILED'} — ${url}`);
        if (audioLoaded === audioTotal) finish();
      };
      a.addEventListener('canplaythrough', () => done(true), { once: true });
      a.addEventListener('error', () => done(false), { once: true });
      setTimeout(() => { if (!settled) done(false); }, 8000);
    }
    setTimeout(finish, 9000);
  });
}

function playSound(name, volScale = 1) {
  const a = AUDIO[name];
  if (!a || !AUDIO_OK[name]) return;
  try {
    const clone = a.cloneNode();
    clone.volume = Math.min(1, (name === 'sukunaLaugh' ? .7 : 1.0) * volScale);
    const p = clone.play();
    if (p && p.catch) p.catch(() => {});
    clone.addEventListener('ended', () => { try { clone.src = ''; } catch(e){} }, { once: true });
  } catch (e) {}
}

/* Synthesized layered SFX */
let AC = null, masterGain = null, noiseBuf = null;
async function initSynthAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') await AC.resume();
    masterGain = AC.createGain(); masterGain.gain.value = .35; masterGain.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(type, f0, f1, dur, vol, q = 1) {
  if (!AC || AC.state !== 'running') return;
  try {
    const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
    const t = AC.currentTime;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = AC.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * .15);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(masterGain);
    s.start(t); s.stop(t + dur + .05);
  } catch (e) {}
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!AC || AC.state !== 'running') return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    const t = AC.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur + .05);
  } catch (e) {}
}
function synthWhoosh() { noise('bandpass', 400, 2600, .28, .35, 1.2); }
function synthRiser()  { tone('sawtooth', 60, 900, 2.2, .1); noise('highpass', 300, 6000, 2.2, .18); }
function synthBoom()   { noise('lowpass', 800, 40, 1.4, .7); tone('sine', 85, 20, 1.5, .7); }
function synthImpact() { tone('sine', 90, 30, .3, .3); noise('bandpass', 1500, 400, .08, .25, 2); tone('triangle', 2400, 1200, .15, .08); }
function synthChant()  { tone('sine', 220, 180, 1.4, .18); tone('sine', 330, 270, 1.4, .12, .1); noise('lowpass', 400, 120, 1.4, .12); }

/* ============================================================
   STAGE / RENDERER / POST
   ============================================================ */
const stage = $('stage');
let W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
stage.insertBefore(renderer.domElement, stage.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 2, .1, 900);

let composer = null, caPass = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.2, .75, .35));
  const CAShader = {
    uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float amount, time; varying vec2 vUv;
      void main(){
        vec2 d = vUv - .5;
        float r = texture2D(tDiffuse, vUv - d*amount).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv + d*amount).b;
        vec3 col = vec3(r,g,b);
        float vig = smoothstep(.9,.25,length(d));
        col *= mix(.6,1.,vig);
        col += .015 * sin(vUv.y*800. + time*30.) * amount * 6.;
        gl_FragColor = vec4(col,1.);
      }`
  };
  caPass = new ShaderPass(CAShader);
  composer.addPass(caPass);
  composer.addPass(new OutputPass());
} catch (e) { composer = null; caPass = null; }

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
scene.add(new THREE.AmbientLight(0x8899cc, 1.3));
const hemi = new THREE.HemisphereLight(0xaabbff, 0x221122, 1.7);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 12, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xaa66ff, 1.8);
rimLight.position.set(-8, 6, -10);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xff5566, 1.2);
fillLight.position.set(10, 4, -6);
scene.add(fillLight);
const combatLight = new THREE.PointLight(0xffffff, 0, 90, 2);
scene.add(combatLight);
let combatLightI = 0;

/* ============================================================
   GROUND
   ============================================================ */
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: .7, metalness: .2 });
const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(150, 64), floorMat);
floorMesh.rotation.x = -PI / 2;
floorMesh.position.y = -0.05;
scene.add(floorMesh);

/* ============================================================
   CITY + BUILDINGS
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
   SHRINE — the full Malevolent Shrine
   ============================================================ */
const shrine = new THREE.Group();
const boneMat   = new THREE.MeshStandardMaterial({ color: 0xefe4d0, emissive: 0x330808, emissiveIntensity: .5, roughness: .55 });
const shrineRed = new THREE.MeshStandardMaterial({ color: 0x2a0202, emissive: 0xd00018, emissiveIntensity: 1.6, roughness: .45, metalness: .25 });
const shrineDark= new THREE.MeshStandardMaterial({ color: 0x0a0101, emissive: 0x770014, emissiveIntensity: 1.1, roughness: .5 });
const goldMat   = new THREE.MeshStandardMaterial({ color: 0xc0a030, emissive: 0x664400, emissiveIntensity: .8, roughness: .3, metalness: .85 });

for (let i = 0; i < 6; i++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(20 - i * 2.5, .6, 14 - i * 2), shrineDark);
  step.position.y = .3 + i * .6;
  step.position.z = -2 + i * .3;
  shrine.add(step);
}
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * PI * 2;
  const x = Math.cos(a) * 6;
  const z = Math.sin(a) * 4 - 1;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, 18, 10), shrineRed);
  pillar.position.set(x, 11, z);
  shrine.add(pillar);
  for (let r = 0; r < 4; r++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.75, .04, 6, 16), goldMat);
    ring.position.set(x, 3 + r * 4, z);
    ring.rotation.x = PI / 2;
    shrine.add(ring);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2, .5, 2), goldMat);
  cap.position.set(x, 20, z);
  shrine.add(cap);
}
const roofGroup = new THREE.Group();
roofGroup.position.y = 20.5;
roofGroup.position.z = -1;
roofGroup.add(new THREE.Mesh(new THREE.BoxGeometry(18, .6, 14), shrineDark));
for (let i = 0; i < 2; i++) {
  const slope = new THREE.Mesh(new THREE.BoxGeometry(18, .6, 10), shrineDark);
  slope.position.z = i === 0 ? -4.5 : 4.5;
  slope.rotation.x = i === 0 ? PI * 0.18 : -PI * 0.18;
  slope.position.y = 2;
  roofGroup.add(slope);
}
const trim = new THREE.Mesh(new THREE.BoxGeometry(19, .25, 15), goldMat);
trim.position.y = .35;
roofGroup.add(trim);
shrine.add(roofGroup);

const giantSkull = new THREE.Mesh(new THREE.SphereGeometry(2.6, 26, 20), boneMat);
giantSkull.position.y = 24.5; giantSkull.scale.set(1, 1.2, .95); shrine.add(giantSkull);
for (const s of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.65, 14, 12), new THREE.MeshBasicMaterial({ color: 0xff0018 }));
  eye.position.set(s * .9, 24.8, 2.1); shrine.add(eye);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.4, 4.0, 7), boneMat);
  horn.position.set(s * 1.5, 27.5, .8); horn.rotation.z = s * .6; shrine.add(horn);
}
for (let i = 0; i < 6; i++) {
  for (const s of [-1, 1]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(3, .15, 6, 12, PI * .6), boneMat);
    rib.position.set(s * 8, 6 + i * 3, -1);
    rib.rotation.z = s * PI * .3;
    shrine.add(rib);
  }
}
const throne = new THREE.Group();
const throneDarkMat = new THREE.MeshStandardMaterial({ color: 0x080101, emissive: 0xbb0018, emissiveIntensity: 1.3, roughness: .4 });
const throneBoneMat = new THREE.MeshStandardMaterial({ color: 0xe8d8c0, emissive: 0x220000, emissiveIntensity: .5, roughness: .6 });
throne.add(new THREE.Mesh(new THREE.BoxGeometry(3, .6, 2.4), throneDarkMat)).position.y = 3.0;
const back = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, .5), throneDarkMat);
back.position.set(0, 5.5, -.9); throne.add(back);
const tSkull = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 14), throneBoneMat);
tSkull.position.set(0, 8.2, -.9); throne.add(tSkull);
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
  e.position.set(s * .35, 8.2, -.1); throne.add(e);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.2, .4), throneDarkMat);
  arm.position.set(s * 1.6, 3.5, .4); throne.add(arm);
}
throne.position.set(0, 1.5, -3.5);
throne.visible = false;
shrine.add(throne);
shrine.visible = false;
scene.add(shrine);

const domainWalls = new THREE.Group();
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * PI * 2;
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1.3, 60, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a0202, emissive: 0xcc0018, emissiveIntensity: 1.4, roughness: .5 })
  );
  pillar.position.set(Math.cos(a) * 30, 30, Math.sin(a) * 30);
  domainWalls.add(pillar);
}
domainWalls.visible = false;
scene.add(domainWalls);

/* ============================================================
   MAHORAGA
   ============================================================ */
const mahoraga = new THREE.Group();
const mahoBoneMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: .4, metalness: .1, emissive: 0x334455, emissiveIntensity: .3 });
const mahoDark = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: .7 });

const mahoBody = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.4, 3.2, 8), mahoBoneMat);
mahoBody.position.y = 3.2; mahoraga.add(mahoBody);
const mahoHead = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 0), mahoBoneMat);
mahoHead.position.y = 5.4; mahoraga.add(mahoHead);
for (const s of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
  eye.position.set(s * .35, 5.4, .8); mahoraga.add(eye);
}
const mahoBlade = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.6, .5), mahoDark);
mahoBlade.position.set(-1.4, 3.4, 0); mahoraga.add(mahoBlade);
const mahoBladeGlow = new THREE.Mesh(new THREE.BoxGeometry(.05, 2.6, .55), new THREE.MeshBasicMaterial({ color: 0xffd000, transparent: true, opacity: .8, blending: AD, depthWrite: false }));
mahoBladeGlow.position.set(-1.4, 3.4, .02); mahoraga.add(mahoBladeGlow);
const mahoArm = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, 2.2, 6), mahoBoneMat);
mahoArm.position.set(1.3, 3.4, 0); mahoArm.rotation.z = .3; mahoraga.add(mahoArm);
for (const s of [-1, 1]) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.3, .4, 2.4, 6), mahoBoneMat);
  leg.position.set(s * .6, 1.2, 0); mahoraga.add(leg);
}
const mahoWheel = new THREE.Group();
mahoWheel.position.y = 6.8;
const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(.9, .1, 6, 32), new THREE.MeshStandardMaterial({ color: 0x806030, metalness: .8, roughness: .3, emissive: 0x201000 }));
mahoWheel.add(wheelRing);
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * PI * 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.7, .08), mahoDark);
  spoke.rotation.z = a;
  mahoWheel.add(spoke);
}
mahoraga.add(mahoWheel);
mahoraga.visible = false;
mahoraga.scale.setScalar(.7);
scene.add(mahoraga);

/* ============================================================
   AGITO
   ============================================================ */
const agito = new THREE.Group();
const agitoBody = new THREE.Mesh(new THREE.CapsuleGeometry(.9, 1.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: .5, emissive: 0x6a2aa0, emissiveIntensity: .5 }));
agitoBody.position.y = 2.2; agito.add(agitoBody);
const agitoHead = new THREE.Mesh(new THREE.SphereGeometry(.7, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4a2a6a, roughness: .4, emissive: 0x8a3ab0, emissiveIntensity: .7 }));
agitoHead.position.y = 4; agito.add(agitoHead);
for (const s of [-1, 1]) {
  const wing = new THREE.Mesh(new THREE.ConeGeometry(.4, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0xaa40ff, emissiveIntensity: .6 }));
  wing.position.set(s * 1.2, 2.6, -.3); wing.rotation.z = s * .6; agito.add(wing);
}
agito.visible = false;
agito.scale.setScalar(.7);
scene.add(agito);

/* ============================================================
   ALLY CHARACTERS (Utahime, Ijichi, Gakuganji, Yaga)
   ============================================================ */
function makeSimpleCharacter(color, height = 1.7) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, height * .55, 8), bodyMat);
  body.position.y = height * .4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf2d3bd, roughness: .7 }));
  head.position.y = height * .78; g.add(head);
  return g;
}

const utahime = makeSimpleCharacter(0x9a2a2a, 1.65);
utahime.position.set(-30, 0, -22);
scene.add(utahime);
utahime.visible = false;

const ijichi = makeSimpleCharacter(0x2a2a4a, 1.70);
ijichi.position.set(-34, 0, -22);
scene.add(ijichi);
ijichi.visible = false;

const gakuganji = makeSimpleCharacter(0x4a3a1a, 1.60);
gakuganji.position.set(-38, 0, -22);
scene.add(gakuganji);
gakuganji.visible = false;

/* Utahime's dance circle — for the amp scene */
const utahimeCircle = new THREE.Mesh(
  new THREE.RingGeometry(1.5, 1.6, 32),
  new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: .8, side: THREE.DoubleSide, blending: AD, depthWrite: false })
);
utahimeCircle.rotation.x = -PI / 2;
utahimeCircle.position.set(-30, .02, -22);
utahimeCircle.visible = false;
scene.add(utahimeCircle);

/* ============================================================
   UNLIMITED VOID
   ============================================================ */
const voidGroup = new THREE.Group();
voidGroup.visible = false;
scene.add(voidGroup);

const voidRings = [];
for (let i = 0; i < 24; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4 + i * .15, .05, 6, 64),
    new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0x88ddff, transparent: true, opacity: .55, blending: AD, depthWrite: false })
  );
  ring.userData = { z: -i * 5, base: 4 + i * .15 };
  voidGroup.add(ring);
  voidRings.push(ring);
}
const voidShards = [];
for (let i = 0; i < 60; i++) {
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(rnd(.15, .55), 0),
    new THREE.MeshBasicMaterial({ color: Math.random() < .6 ? 0x9fd8ff : 0xffffff, transparent: true, opacity: .85, blending: AD, depthWrite: false })
  );
  shard.userData = {
    a: rnd(0, PI * 2), r: rnd(3, 26), y: rnd(-8, 14),
    sp: rnd(.2, 1.6), rot: rd().multiplyScalar(rnd(.5, 2.5))
  };
  voidGroup.add(shard);
  voidShards.push(shard);
}
const voidCore = new THREE.PointLight(0xaaddff, 0, 250, 2);
voidCore.position.set(0, 3, 0);
voidGroup.add(voidCore);
const voidFloor = new THREE.Mesh(
  new THREE.CircleGeometry(80, 64),
  new THREE.MeshBasicMaterial({ color: 0x1a3a60, transparent: true, opacity: .9, side: THREE.DoubleSide })
);
voidFloor.rotation.x = -PI / 2;
voidFloor.position.y = -.02;
voidGroup.add(voidFloor);

/* ============================================================
   ENVIRONMENTS
   ============================================================ */
const ENV = {
  city:    { bg: 0x1a1030, fog: 0x302050, density: .008, hemi: 0x8899cc, floor: 0x2a2a38 },
  shrine:  { bg: 0x1a0000, fog: 0x400810, density: .07, hemi: 0xcc4444, floor: 0x300606 },
  void:    { bg: 0x020510, fog: 0x0a2040, density: .05, hemi: 0x88bbff, floor: 0x0a1830 },
  airport: { bg: 0xdde4ec, fog: 0xe8eef4, density: .01, hemi: 0xffffff, floor: 0x8899aa }
};
function setEnv(name) {
  const e = ENV[name];
  scene.background = new THREE.Color(e.bg);
  scene.fog = e.density ? new THREE.FogExp2(e.fog, e.density) : null;
  hemi.color.set(e.hemi);
  floorMat.color.set(e.floor);
  cityGroup.visible = (name === 'city' || name === 'shrine');
  floorMesh.visible = name !== 'void';
  shrine.visible = name === 'shrine';
  domainWalls.visible = name === 'shrine';
  voidGroup.visible = name === 'void';
  voidCore.intensity = name === 'void' ? 500 : 0;
  stars.visible = name === 'void';
  moonSprite.visible = name === 'city';
  $('voidUI').style.opacity = name === 'void' ? .95 : 0;
}

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
        void main(){ vC=pc; vA=pa; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=ps*sc/max(1.,-mv.z); gl_Position=projectionMatrix*mv; }`,
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
const glowParticles = new ParticleSystem(4000, AD);
const smokeParticles = new ParticleSystem(900, THREE.NormalBlending);

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
   FX / SHAKE / HIT-STOP
   ============================================================ */
const fxList = [];
const ringGeo = new THREE.RingGeometry(.9, 1, 48);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
let shake = 0;
let hitStop = 0;
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
    if (k >= 1) { scene.remove(m); m.material.dispose(); return false; }
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
    if (k >= 1) { scene.remove(m); m.material.dispose(); return false; }
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
  if (caPass) caPass.uniforms.amount.value = Math.max(caPass.uniforms.amount.value, .008 + pw * .003);
  synthImpact();
  playSound('explode', .5 * pw);
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
function freeze(t) { hitStop = Math.max(hitStop, t); }

/* ============================================================
   POSE SYSTEM
   ============================================================ */
const POSE = {
  idle:      { hy:0,   tx:0,   ty:0,   hdx:0,   lsx:-.15, lsz:.15, lel:-.35, rsx:-.15, rsz:-.15, rel:-.35, lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  dash:      { hy:-.15,tx:.55, ty:0,   hdx:0,   lsx:.5,   lsz:.1,  lel:-.2,  rsx:.5,   rsz:-.1,  rel:-.2,  lhx:-.8, lkn:.9,  rhx:.7,  rkn:.9  },
  flyFwd:    { hy:-.1, tx:.2,  ty:0,   hdx:0,   lsx:-1.6, lsz:1.1, lel:-.2,  rsx:-1.6, rsz:-1.1, rel:-.2,  lhx:-1,  lkn:1.3, rhx:.9,  rkn:1.3 },
  punchR:    { hy:-.1, tx:.3,  ty:-.6, hdx:0,   lsx:-.4,  lsz:.1,  lel:-.5,  rsx:-1.55,rsz:-.1,  rel:0,    lhx:-.6, lkn:.7,  rhx:.3,  rkn:.1  },
  crossSlash:{ hy:-.1, tx:.2,  ty:-.5, hdx:0,   lsx:-1.5, lsz:1.1, lel:0,    rsx:-1.5, rsz:-1.1, rel:0,    lhx:0,   lkn:.3,  rhx:0,   rkn:.3  },
  kick:      { hy:-.05,tx:-.25,ty:0,   hdx:0,   lsx:-.4,  lsz:.1,  lel:-.4,  rsx:-.3,  rsz:-.1,  rel:-.4,  lhx:0,   lkn:.3,  rhx:-1.7,rkn:0   },
  cast:      { hy:0,   tx:-.1, ty:0,   hdx:0,   lsx:-1.55,lsz:.6,  lel:0,    rsx:-1.55,rsz:-.6,  rel:0,    lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  point:     { hy:-.05,tx:.1,  ty:-.3, hdx:0,   lsx:.2,   lsz:.1,  lel:-.3,  rsx:-1.55,rsz:-.1,  rel:0,    lhx:-.3, lkn:.4,  rhx:0,   rkn:.1  },
  raise:     { hy:0,   tx:-.15,ty:0,   hdx:0,   lsx:-2.8, lsz:.5,  lel:-.3,  rsx:-2.8, rsz:-.5,  rel:-.3,  lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  hit:       { hy:-.05,tx:-.5, ty:0,   hdx:-.35,lsx:.4,   lsz:.2,  lel:-.1,  rsx:.4,   rsz:-.2,  rel:-.1,  lhx:-.2, lkn:.2,  rhx:.5,  rkn:.2  },
  sign:      { hy:0,   tx:.05, ty:0,   hdx:0,   lsx:-1.2, lsz:-.1, lel:-1.9, rsx:-1.2, rsz:.1,   rel:-1.9, lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  kneel:     { hy:-.55,tx:.2,  ty:0,   hdx:0,   lsx:-.1,  lsz:.1,  lel:-.2,  rsx:-.1,  rsz:-.1,  rel:-.2,  lhx:-1.3,lkn:1.5, rhx:.2,  rkn:1.7 },
  open:      { hy:0,   tx:-.1, ty:0,   hdx:-.25,lsx:-.2,  lsz:1.3, lel:-.3,  rsx:-.2,  rsz:-1.3, rel:-.3,  lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  sit:       { hy:-.55,tx:.2,  ty:0,   hdx:0,   lsx:-.3,  lsz:.1,  lel:-.5,  rsx:-.3,  rsz:-.1,  rel:-.5,  lhx:-1.4,lkn:1.4, rhx:-1.4,rkn:1.4 },
  dance:     { hy:-.1, tx:.15, ty:.3,  hdx:.1,  lsx:-2.2, lsz:1.1, lel:-.4,  rsx:-2.2, rsz:-1.1, rel:-.4,  lhx:0,   lkn:.4,  rhx:0,   rkn:.4 }
};
const KEYS = ['hy','tx','ty','hdx','lsx','lsz','lel','rsx','rsz','rel','lhx','lkn','rhx','rkn'];

function makeCharacter(opts) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({
    color: c, roughness: o.r ?? .6, metalness: o.m ?? .15,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0,
    side: o.side ?? THREE.FrontSide
  });
  const skinM = M(opts.skin, {r:.55}), topM = M(opts.top, {r:.5}),
        pantsM = M(opts.pants, {r:.7}), hairM = M(opts.hair, {r:.35}),
        bootM = M(opts.boots, {r:.4});
  const eyeM = new THREE.MeshBasicMaterial({color: opts.eye});
  const grp = (p,x,y,z)=>{const q=new THREE.Group();q.position.set(x,y,z);p.add(q);return q;};

  const hips = grp(g, 0, 1.0, 0);
  const torso = grp(hips, 0, .1, 0);

  const lowerTorso = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .28, 10), topM);
  lowerTorso.position.y = .14; torso.add(lowerTorso);
  const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(.28, .22, .30, 10), topM);
  upperTorso.position.y = .42; torso.add(upperTorso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.32, .08, .04), topM);
  chest.position.set(0, .48, .18); torso.add(chest);

  const clothMat = M(opts.top, {r:.5, side: THREE.DoubleSide});
  if (opts.hairStyle === 'gojo') {
    for (const s of [1, -1]) {
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(.30, .60, 1, 3), clothMat);
      tail.position.set(s * .14, -.30, .02); tail.rotation.x = .25; torso.add(tail);
    }
  } else {
    const hakama = new THREE.Mesh(new THREE.CylinderGeometry(.30, .46, .65, 10, 1, true), clothMat);
    hakama.position.y = -.20; hips.add(hakama);
    for (const s of [1, -1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8, 0, PI*2, 0, PI*.7), topM);
      pad.position.set(s * .34, .62, 0); pad.scale.y = .6; torso.add(pad);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.20, .04, 6, 20, PI * 1.3), M(0x0a0202, {r:.4}));
    collar.position.set(0, .60, 0); collar.rotation.x = PI / 2; collar.rotation.z = PI * .15; torso.add(collar);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .12, 8), skinM);
  neck.position.y = .65; torso.add(neck);

  const head = grp(torso, 0, .88, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 16), skinM);
  skull.position.y = .10; skull.scale.set(.95, 1.05, .95); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10, 0, PI*2, PI*.55, PI*.45), skinM);
  jaw.position.y = .04; head.add(jaw);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(.03, .04, .03), skinM);
  nose.position.set(0, .11, .16); head.add(nose);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 15, 0, PI*2, 0, PI*.58), hairM);
  hairCap.position.y = .10; head.add(hairCap);

  if (opts.hairStyle === 'gojo') {
    for (let i = 0; i < 11; i++) {
      const a = -PI*.6 + (i/10)*PI*1.2;
      const len = .16 + Math.random()*.10;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.045, len, 5), hairM);
      cone.position.set(Math.cos(a)*.12, .22, Math.sin(a)*.10 + .02);
      cone.rotation.z = -Math.cos(a)*.5; cone.rotation.x = Math.sin(a)*.4;
      head.add(cone);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const a = -PI*.5 + (i/8)*PI*1.0;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.055, .18, 5), hairM);
      cone.position.set(Math.cos(a)*.11, .17, Math.sin(a)*.08 - .04);
      cone.rotation.z = -Math.cos(a)*.4; cone.rotation.x = -.2;
      head.add(cone);
    }
  }

  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), eyeM);
    eye.position.set(s*.062, .13, .148); head.add(eye);
    eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .01), hairM);
    brow.position.set(s*.062, .165, .152); brow.rotation.z = -s*.15; head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.07, .012, .01), new THREE.MeshBasicMaterial({color: 0x331111}));
  mouth.position.set(0, .045, .152); head.add(mouth);

  const arm = s => {
    const sh = grp(torso, s*.34, .62, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), topM));
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .22, 4, 8), topM);
    upper.position.y = -.18; sh.add(upper);
    const el = grp(sh, 0, -.35, 0);
    el.add(new THREE.Mesh(new THREE.CapsuleGeometry(.06, .24, 4, 8), skinM)).position.y = -.18;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.10, .08, .16, 8), topM);
    cuff.position.y = -.08; el.add(cuff);
    const hand = grp(el, 0, -.36, 0);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), skinM);
    fist.position.y = -.02; fist.scale.set(1, .85, 1.15); hand.add(fist);
    return { sh, el, hand };
  };
  const armL = arm(1), armR = arm(-1);

  const leg = s => {
    const hp = grp(hips, s*.13, 0, 0);
    hp.add(new THREE.Mesh(new THREE.CapsuleGeometry(.09, .34, 4, 8), pantsM)).position.y = -.23;
    const kn = grp(hp, 0, -.46, 0);
    kn.add(new THREE.Mesh(new THREE.CapsuleGeometry(.075, .32, 4, 8), pantsM)).position.y = -.22;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.15, .22, .34), bootM);
    boot.position.set(0, -.42, .06); kn.add(boot);
    return { hp, kn };
  };
  const legL = leg(1), legR = leg(-1);

  const c = {
    g, hips, torso, head, armL, armR, legL, legR,
    L: armL, R: armR, lL: legL, lR: legR, p: g.position,
    cur: { ...POSE.idle }, vel: {}, tgt: POSE.idle,
    ret: 0, yaw: 0, yawTgt: 0, pv: new V(), spd: 0,
    hd: 0, tilt: 0, tiltTgt: 0, eyes,
    breathe: Math.random() * PI * 2
  };
  for (const k of KEYS) { if (c.cur[k] === undefined) c.cur[k] = 0; c.vel[k] = 0; }
  scene.add(g);
  return c;
}

function setPose(c, name, hold = false) {
  c.tgt = POSE[name];
  c.ret = hold ? 0 : .3;
}

function updateFighter(f, trackArr, other, dt, time) {
  const t = track(trackArr, time);
  const prevY = f.p.y;
  f.p.set(t[1], t[3], t[2]);

  const landing = prevY > .3 && f.p.y < .1 && f.spd > .3;
  if (landing) {
    f.cur.hy -= .15;
    f.vel.hy = Math.max(0, -2);
    freeze(.04);
    puff(new V(f.p.x, .1, f.p.z), 8, 3, 2, .6, [.35, .33, .32]);
  }

  f.yawTgt = Math.atan2(other.p.x - f.p.x, other.p.z - f.p.z);
  f.yaw = alerp(f.yaw, f.yawTgt, 1 - Math.exp(-9 * dt));
  f.g.rotation.y = f.yaw;

  const speed = f.pv.distanceTo(f.p) / Math.max(dt, .001);
  f.spd = cl(speed / 9, 0, 1.2);
  f.pv.copy(f.p);
  f.hd += dt * (6 + f.spd * 8);

  const airborne = t[3] > .3;
  f.tiltTgt = airborne ? cl((t[3] - .3) * .35, 0, .5) : 0;
  f.tilt = lerp(f.tilt, f.tiltTgt, 1 - Math.exp(-6 * dt));
  f.g.rotation.x = f.tilt;

  if (f.ret > 0) { f.ret -= dt; if (f.ret <= 0) f.tgt = POSE.idle; }

  const c = f.cur, v = f.vel;
  const stiffness = 200, damping = 24;
  for (const k of KEYS) {
    const target = f.tgt[k] || 0;
    const acc = (target - c[k]) * stiffness - v[k] * damping;
    v[k] += acc * dt;
    c[k] += v[k] * dt;
  }

  c.lkn = cl(c.lkn, 0, 2.4);
  c.rkn = cl(c.rkn, 0, 2.4);
  c.lel = cl(c.lel, -2.4, 0);
  c.rel = cl(c.rel, -2.4, 0);
  c.lsx = cl(c.lsx, -3, 1.2);
  c.rsx = cl(c.rsx, -3, 1.2);
  c.tx  = cl(c.tx, -1, 1);
  c.hdx = cl(c.hdx, -.6, .6);

  f.breathe += dt * 1.5;
  const breath = Math.sin(f.breathe) * .01 * (1 - f.spd);

  const sw = Math.sin(f.hd) * .7 * f.spd;
  f.hips.position.y = 1 + c.hy + breath + Math.sin(time * 2) * .01 - f.spd * .04;
  f.torso.rotation.set(c.tx, c.ty, 0);
  f.head.rotation.x = c.hdx;
  f.L.sh.rotation.set(c.lsx, 0, c.lsz); f.L.el.rotation.x = c.lel;
  f.R.sh.rotation.set(c.rsx, 0, c.rsz); f.R.el.rotation.x = c.rel;
  f.lL.hp.rotation.x = c.lhx + sw; f.lL.kn.rotation.x = c.lkn + Math.max(0, -sw) * 1.1;
  f.lR.hp.rotation.x = c.rhx - sw; f.lR.kn.rotation.x = c.rkn + Math.max(0, sw) * 1.1;
}

function worldOf(fighter, part) {
  const map = { head: fighter.head, chest: fighter.torso, hip: fighter.hips, fistR: fighter.R.hand, fistL: fighter.L.hand, footR: fighter.lR.kn };
  const tgt = map[part];
  if (!tgt) return fighter.p.clone();
  tgt.updateWorldMatrix(true, false);
  return new V().setFromMatrixPosition(tgt.matrixWorld);
}

function strike(attacker, target, part, power, opts = {}) {
  const contact = worldOf(target, part);
  freeze(opts.freeze ?? .05);
  setPose(target, 'hit', true);
  target.ret = opts.recover ?? .35;

  const dir = contact.clone().sub(attacker.p).normalize();
  if (caPass) caPass.uniforms.amount.value = Math.max(caPass.uniforms.amount.value, .01 + power * .003);

  impact(contact, power, opts.color ?? [1.3, .7, .5]);
  const n = Math.floor(20 * power);
  for (let i = 0; i < n; i++) {
    const vv = dir.clone().multiplyScalar(rnd(4, 12)).add(rd().multiplyScalar(4));
    glowParticles.e(contact.x, contact.y, contact.z, vv.x, vv.y, vv.z, rnd(.2, .5), rnd(.25, .5),
      opts.color?.[0] ?? 1.4, opts.color?.[1] ?? .7, opts.color?.[2] ?? .5, 4, 1.2);
  }
  shake = Math.max(shake, .4 * power);
}

/* ============================================================
   CHARACTERS
   ============================================================ */
const gojo   = makeCharacter({ skin: 0xf2d3bd, top: 0x0a0a14, pants: 0x0a0a14, hair: 0xf0f4ff, boots: 0x08080c, eye: 0x9fe0ff, hairStyle: 'gojo' });
const sukuna = makeCharacter({ skin: 0xe6b898, top: 0xe8e0d0, pants: 0x16121c, hair: 0xd04a2a, boots: 0x0a0202, eye: 0xff3030, hairStyle: 'sukuna' });

const blindfold = new THREE.Mesh(new THREE.TorusGeometry(.16, .03, 8, 24), new THREE.MeshStandardMaterial({ color: 0x050508 }));
blindfold.rotation.x = PI / 2; blindfold.position.y = .13; gojo.head.add(blindfold);
gojo.eyes.forEach(e => e.visible = false);

for (const s of [1, -1]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .012), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m.position.set(s * .09, .06, .14); m.rotation.z = -s * .3; sukuna.head.add(m);
  const armMark = new THREE.Mesh(new THREE.BoxGeometry(.03, .08, .012), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  armMark.position.set(s * .08, -.15, .05); armMark.rotation.z = -s * .2;
  sukuna.armL.sh.add(armMark);
}

/* ============================================================
   INFINITY
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
   TRACKS
   ============================================================ */
const p3 = (t, x, z = 0, y = 0) => [t, x, z, y];

const gojoTrack = [
  p3(0,-16), p3(8,-16), p3(14,-6), p3(18,-2),
  p3(20,-3), p3(24,-2), p3(28,-3), p3(32,-4),
  p3(34,-4), p3(50,-4), p3(52,-3), p3(68,-4),
  p3(70,-4), p3(86,-4), p3(88,-3), p3(102,-4),
  p3(104,-4), p3(118,-5), p3(140,-5), p3(158,-5),
  p3(160,-5), p3(168,-5), p3(176,-4), p3(180,-4)
];
const sukunaTrack = [
  p3(0,14), p3(8,14), p3(14,6), p3(18,2),
  p3(20,3), p3(24,2), p3(28,3), p3(32,4),
  p3(34,4), p3(50,4), p3(52,3), p3(68,4),
  p3(70,4), p3(86,4), p3(88,3), p3(102,4),
  p3(104,4), p3(118,5), p3(140,5), p3(158,5),
  p3(160,5), p3(168,5), p3(176,4), p3(180,4)
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
  playSound('blackslash');
  synthImpact();
  freeze(.14);
  sphereFX(p, 0x000000, 2.4, .55, false);
  sphereFX(p, 0xff1030, 3.2, .4);
  ringFX(p, 0xff1030, 7, .5);
  spark(p, 80, 16, .4, .9, [1.4, .1, .2], 2);
  flashScreen('#300', .7, .5);
  lightFlash(p, 0xff1030, 600); shake = 4;
  if (caPass) caPass.uniforms.amount.value = .04;
}

/* ============================================================
   TIMELINE — 180s FULL MANGA FIGHT
   ============================================================ */
const EVENTS = [];
const at = (t, fn) => EVENTS.push([t, fn]);
const midPoint = () => new V((gojo.p.x + sukuna.p.x) / 2, 1.4, 0);

/* ============================================================
   0-18s — COORDINATION + 200% HOLLOW PURPLE
   ============================================================ */
at(0, () => {
  showBanner('THE STRONGEST DUEL', 'CHAPTERS 223–236', 4.4);
  flashScreen('#000', 1, 1.6);
  synthRiser();
});

at(1.5, () => {
  utahime.visible = true; ijichi.visible = true; gakuganji.visible = true;
  utahimeCircle.visible = true;
  say('NARRATOR', 'Before the fight — Utahime, Ijichi, and Gakuganji coordinate.', 2.5);
});

at(3.5, () => {
  setPose(utahime, 'dance', true);
  setPose(gakuganji, 'raise', true);
  say('UTAHIME', '"Boost!"', 1.2);
  synthChant();
});

at(5.5, () => {
  say('IJICHI', '"Barrier set. Firing when ready, Gojo."', 2);
  // barrier shimmer
  const p = gojo.p.clone();
  for (let i = 0; i < 8; i++) {
    ringFX(p.clone().setY(i * .8), 0x88aaff, 4, .6, true);
  }
});

at(7.0, () => {
  say('GOJO', '"From 3.5 kilometers. 200% output."', 2);
  setPose(gojo, 'cast', true);
  playSound('hollowPurple');
  orbPurple.visible = true;
  orbPurple.position.set(gojo.p.x, 1.5, gojo.p.z);
  orbPurple.scale.setScalar(.4);
});

at(9.0, () => {
  say('NARRATOR', 'Hollow Purple — 200% amplified.', 1.5);
  const p = orbPurple.position.clone();
  const aim = new V(sukuna.p.x - p.x, 1.5 - p.y, sukuna.p.z - p.z);
  const len = aim.length();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.9, .9, 1, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xd080ff, transparent: true, opacity: .95, blending: AD, depthWrite: false })
  );
  beam.position.copy(p).add(aim.clone().multiplyScalar(.5));
  beam.quaternion.setFromUnitVectors(new V(0, 1, 0), aim.clone().normalize());
  beam.scale.set(2.5, len, 2.5);
  scene.add(beam);
  let t = 0;
  fxList.push(dt => { t += dt; beam.material.opacity = Math.max(0, .95 - t * 1.2); if (t > 1) { scene.remove(beam); beam.material.dispose(); return false; } return true; });
  flashScreen('#a4f', .7, 1);
});

at(9.6, () => {
  const p = worldOf(sukuna, 'chest');
  impact(p, 4.5, [1.4, .5, 1.8]);
  setPose(sukuna, 'hit', true); sukuna.ret = 1.2;
  shake = 10; freeze(.15);
  say('SUKUNA', '"...hn."', 1.2);
});

at(11.5, () => { orbPurple.visible = false; utahime.visible = false; ijichi.visible = false; gakuganji.visible = false; utahimeCircle.visible = false; });
at(12.0, () => say('NARRATOR', 'Sukuna survives. The real fight begins.', 2));

/* ============================================================
   18-32s — ROUND 1: HAND-TO-HAND
   ============================================================ */
at(14.5, () => say('NARRATOR', 'Sukuna activates Domain Amplification — neutralizing Infinity on contact.', 2.5));
at(17.0, () => { setPose(gojo, 'dash', true); setPose(sukuna, 'dash', true); synthWhoosh(); });
at(18.0, () => { setPose(gojo, 'punchR'); setTimeout(() => strike(gojo, sukuna, 'chest', 1.5, { recover: .3 }), 100); });
at(19.5, () => { setPose(sukuna, 'crossSlash'); setTimeout(() => strike(sukuna, gojo, 'chest', 1.6, { recover: .3 }), 100); });
at(21.0, () => { setPose(gojo, 'kick'); setTimeout(() => strike(gojo, sukuna, 'chest', 1.4, { recover: .3 }), 100); });
at(22.5, () => { setPose(sukuna, 'punchR'); setTimeout(() => strike(sukuna, gojo, 'chest', 1.5, { recover: .3 }), 100); });
at(24.0, () => { setPose(gojo, 'crossSlash'); setTimeout(() => strike(gojo, sukuna, 'chest', 1.7, { recover: .3 }), 100); });
at(25.5, () => { setPose(sukuna, 'kick'); setTimeout(() => strike(sukuna, gojo, 'chest', 1.4, { recover: .3 }), 100); });
at(27.0, () => {
  setPose(gojo, 'crossSlash'); setPose(sukuna, 'crossSlash');
  setTimeout(() => {
    const m = midPoint(); impact(m, 2.8);
    flashScreen('#fff', .7, .4); shake = 5; freeze(.1);
  }, 200);
});

/* ============================================================
   32-50s — 1st DOMAIN CLASH
   ============================================================ */
at(29.0, () => say('NARRATOR', 'Both fighters — Domain Expansion.', 1.8));
at(30.0, () => { playSound('gojoDomain'); setPose(gojo, 'sign', true); say('GOJO', '"Domain Expansion — Unlimited Void."', 2.2); });
at(31.5, () => { playSound('sukunaDomain'); setPose(sukuna, 'open', true); say('SUKUNA', '"Domain Expansion — Malevolent Shrine."', 2.2); });
at(33.0, () => {
  setEnv('void'); shrine.scale.y = .01; shrine.visible = true; throne.visible = true;
  flashScreen('#fff', .7, .8); showBanner('DOMAIN CLASH · 1', 'UNLIMITED VOID vs MALEVOLENT SHRINE', 3);
  shake = 6;
});
at(35.0, () => { sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true); });
at(37.0, () => say('NARRATOR', 'Open-barrier vs closed. Sukuna attacks the shell from outside.', 2.5));
at(40.0, () => {
  // barrier starts cracking
  for (let i = 0; i < 6; i++) {
    const p = new V(rnd(-6, 6), rnd(2, 6), rnd(-4, 4));
    ringFX(p, 0xff2040, 5, .5, true);
  }
  shake = 4;
});
at(43.0, () => {
  setEnv('city'); shrine.visible = false; throne.visible = false; setPose(sukuna, 'idle');
  setPose(gojo, 'hit'); gojo.ret = 1;
  say('GOJO', '"...tch. The barrier broke."', 2);
  flashScreen('#f00', .5, .5); shake = 5;
});

/* ============================================================
   50-68s — 2nd DOMAIN CLASH
   ============================================================ */
at(50.0, () => say('NARRATOR', 'Gojo hardens the shell — trades interior strength for exterior.', 2.5));
at(52.0, () => { playSound('gojoDomain'); setPose(gojo, 'sign', true); });
at(53.5, () => { playSound('sukunaDomain'); setPose(sukuna, 'open', true); });
at(55.0, () => {
  setEnv('shrine'); shrine.scale.y = 1; shrine.visible = true; throne.visible = true;
  sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true);
  flashScreen('#f00', .7, .6); showBanner('DOMAIN CLASH · 2', '', 2.5);
  shake = 6;
});
at(58.0, () => say('NARRATOR', 'For the first time — Malevolent Shrine is destroyed.', 2));
at(59.5, () => {
  puff(new V(0, 8, -3), 80, 25, 6, 3.5, [.3, .2, .2]);
  shrine.visible = false; throne.visible = false;
  setEnv('city'); setPose(sukuna, 'hit', true); sukuna.ret = 1.2;
  impact(worldOf(sukuna, 'chest'), 3);
  flashScreen('#f00', .8, .8);
  shake = 8;
});
at(62.0, () => say('SUKUNA', '"...Impressive, Gojo Satoru."', 2));
at(65.0, () => say('NARRATOR', 'But Sukuna has a plan. Mahoraga\'s adaptation has begun.', 2.5));

/* ============================================================
   68-86s — 3rd DOMAIN CLASH + BRAIN RCT
   ============================================================ */
at(68.0, () => say('NARRATOR', 'Gojo damages and RCTs parts of his brain to reset his burnt-out technique.', 2.5));
at(70.0, () => { setPose(gojo, 'kneel', true); say('GOJO', '"Reverse Cursed Technique… on my own brain."', 2.2); });
at(73.0, () => {
  const p = worldOf(gojo, 'head');
  ringFX(p, 0x66ddff, 12, .9);
  sphereFX(p, 0x88aaff, 5, .6);
  lightFlash(p, 0x66aaff, 500);
  shake = 3;
});
at(75.0, () => {
  setPose(gojo, 'sign', true); playSound('gojoDomain');
  say('GOJO', '"Unlimited Void."', 1.5);
});
at(76.5, () => { setPose(sukuna, 'open', true); playSound('sukunaDomain'); });
at(78.0, () => {
  setEnv('shrine'); shrine.scale.y = 1; shrine.visible = true; throne.visible = true;
  sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true);
  flashScreen('#fff', .7, .6); showBanner('DOMAIN CLASH · 3', '', 2.2);
  shake = 6;
});
at(82.0, () => { setEnv('city'); shrine.visible = false; throne.visible = false; setPose(sukuna, 'idle'); });

/* ============================================================
   86-102s — 4th & 5th DOMAIN CLASHES (wheel turns)
   ============================================================ */
at(86.0, () => {
  say('NARRATOR', 'The wheel above Megumi\'s soul — Mahoraga\'s adaptation turns.', 2.5);
  // wheel visible — small spinning above Sukuna
  const w = new THREE.Mesh(
    new THREE.TorusGeometry(.5, .06, 6, 24),
    new THREE.MeshStandardMaterial({ color: 0x806030, metalness: .8, roughness: .3, emissive: 0x402000 })
  );
  w.position.set(sukuna.p.x, 4.5, sukuna.p.z);
  scene.add(w);
  let t = 0;
  fxList.push(dt => { t += dt; w.rotation.y += dt * 4; w.position.y = 4.5 + Math.sin(t * 2) * .2; if (t > 14) { scene.remove(w); w.geometry.dispose(); w.material.dispose(); return false; } return true; });
});
at(89.0, () => { setPose(gojo, 'sign', true); playSound('gojoDomain'); showBanner('DOMAIN CLASH · 4', '', 1.8); });
at(90.5, () => { setPose(sukuna, 'open', true); playSound('sukunaDomain'); setEnv('shrine'); shrine.scale.y = 1; shrine.visible = true; throne.visible = true; sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true); });
at(95.0, () => { setEnv('city'); shrine.visible = false; throne.visible = false; setPose(sukuna, 'idle'); });
at(96.5, () => { playSound('gojoDomain'); setPose(gojo, 'sign', true); showBanner('DOMAIN CLASH · 5', '', 1.8); });
at(98.0, () => { setPose(sukuna, 'open', true); playSound('sukunaDomain'); setEnv('shrine'); shrine.scale.y = 1; shrine.visible = true; throne.visible = true; sukuna.g.position.set(0, 4.5, -3); setPose(sukuna, 'sit', true); });

/* ============================================================
   102-118s — MAHORAGA APPEARS, BREAKS VOID, AGITO SUMMONED
   ============================================================ */
at(102.0, () => {
  say('NARRATOR', 'Unlimited Void finally catches Sukuna.', 2);
  setPose(sukuna, 'hit', true); sukuna.ret = 1.5;
  shrine.visible = false; throne.visible = false;
  setEnv('void');
  flashScreen('#fff', .9, .8); shake = 8;
});
at(104.0, () => {
  say('NARRATOR', 'But — Mahoraga has adapted. The wheel completes.', 2.5);
  voidGroup.visible = false;
  mahoraga.visible = true;
  mahoraga.position.set(0, 0, -6);
  mahoraga.scale.setScalar(.01);
  flashScreen('#f88', .8, .6); shake = 10;
  playSound('sukunaDomain');
});
at(104.8, () => {
  const t0 = T;
  const grow = () => {
    if (!mahoraga.visible) return;
    const k = cl((T - t0) / 1, 0, 1);
    mahoraga.scale.setScalar(.7 * es(k));
    if (k < 1) requestAnimationFrame(grow);
  };
  grow();
});
at(107.0, () => { setEnv('city'); setPose(gojo, 'idle'); setPose(sukuna, 'idle'); sukuna.g.position.set(5, 0, 4); });
at(110.0, () => {
  say('NARRATOR', 'Sukuna summons Agito — a fusion of Ten Shadows shikigami.', 2);
  agito.visible = true;
  agito.position.set(8, 0, -4);
  agito.scale.setScalar(.7);
});

/* ============================================================
   118-140s — GOJO VS 3v1
   ============================================================ */
at(115.0, () => say('GOJO', '"Three on one? Fine."', 1.8));
at(118.0, () => {
  setPose(gojo, 'crossSlash');
  setTimeout(() => {
    const p = agito.position.clone().add(new V(0, 2, 0));
    sphereFX(p, 0xaa40ff, 10, .8);
    ringFX(p, 0xaa40ff, 18, .7);
    spark(p, 150, 25, .9, 1.4, [1.4, .5, 2], 4);
    impact(p, 3.5);
    agito.visible = false;
    playSound('explode');
    shake = 6;
  }, 250);
});
at(121.0, () => say('NARRATOR', 'Agito destroyed. Only Mahoraga remains.', 2));
at(123.0, () => {
  const p = mahoraga.position.clone().add(new V(0, 3, 0));
  orbBlue.visible = true; orbBlue.position.copy(p); orbBlue.scale.setScalar(4);
  ringFX(p, 0x4aa0ff, 15, .9);
  say('GOJO', '"Blue."', 1.2);
});
at(125.0, () => {
  const p = mahoraga.position.clone().add(new V(0, 3, 0));
  orbRed.visible = true; orbRed.position.copy(p); orbRed.scale.setScalar(3);
  ringFX(p, 0xff4060, 18, .9);
  impact(p, 3);
  say('GOJO', '"Red."', 1.2);
});
at(127.0, () => {
  orbBlue.visible = false; orbRed.visible = false;
  mahoraga.rotation.z = .4;
  shake = 5;
});
at(129.0, () => { setPose(sukuna, 'dash', true); setTimeout(() => strike(sukuna, gojo, 'chest', 2, { recover: .5 }), 100); });

/* ============================================================
   140-158s — SUKUNA VS MAHORAGA FLASHBACK + "YOU CAN"
   ============================================================ */
at(140.0, () => {
  say('NARRATOR', 'Earlier — Sukuna vs Mahoraga, the moment he learned adaptation.', 2.5);
  // flashback tint
  flashScreen('#a06030', .35, 1.5);
  // hide Gojo briefly
  gojo.g.visible = false;
  sukuna.g.position.set(-3, 0, 0);
  mahoraga.position.set(3, 0, 0);
  mahoraga.scale.setScalar(.9);
  setPose(sukuna, 'idle');
  setEnv('shrine');
  shrine.scale.y = 1; shrine.visible = true; throne.visible = true;
});
at(142.5, () => {
  setPose(sukuna, 'crossSlash');
  setTimeout(() => {
    const p = mahoraga.position.clone().add(new V(0, 3, 0));
    impact(p, 2);
    mahoraga.rotation.z = -.3;
    mahoraga.position.x -= 1;
    shake = 4;
  }, 150);
});
at(145.0, () => {
  setPose(sukuna, 'kick');
  setTimeout(() => {
    const p = mahoraga.position.clone().add(new V(0, 2, 0));
    impact(p, 1.8);
    mahoraga.rotation.z = .3;
    mahoraga.position.x += 1;
  }, 150);
});
at(148.0, () => {
  playSound('youcan');
  say('SUKUNA', '"You can do it — Mahoraga. Adapt."', 3.5);
  setPose(sukuna, 'point', true);
  flashScreen('#f00', .4, 1);
});
at(152.0, () => {
  // Mahoraga adapts — wheel spins fast, glows gold
  const wheel = mahoWheel;
  let t = 0;
  fxList.push(dt => {
    t += dt;
    wheel.rotation.y += dt * 15;
    if (t > 4) return false;
    return true;
  });
  sphereFX(mahoraga.position.clone().add(new V(0, 6, 0)), 0xffd000, 8, 1.5);
  shake = 6;
});
at(155.0, () => {
  // return to present
  flashScreen('#a06030', .4, 1);
  gojo.g.visible = true;
  mahoraga.position.set(-4, 0, -4);
  mahoraga.scale.setScalar(.7);
  sukuna.g.position.set(5, 0, 4);
  setEnv('city');
  shrine.visible = false; throne.visible = false;
});

/* ============================================================
   158-168s — GOJO'S BLACK FLASH VOLLEY → DESTROYS MAHORAGA
   ============================================================ */
at(158.0, () => {
  say('NARRATOR', 'Gojo enters heightened cursed energy control. Black Flash.', 2.5);
  setPose(gojo, 'idle');
});
for (let i = 0; i < 4; i++) {
  at(160.0 + i * 1.2, () => {
    const p = mahoraga.position.clone().add(new V(rnd(-1, 1), 2 + rnd(-1, 1), rnd(-1, 1)));
    blackFlash(p);
    mahoraga.rotation.z = (Math.random() - .5) * .6;
    mahoraga.position.x += (Math.random() - .5) * 1.5;
    shake = 6;
  });
}
at(165.0, () => {
  const p = mahoraga.position.clone().add(new V(0, 3, 0));
  blackFlash(p);
  sphereFX(p, 0x000000, 6, .9, false);
  ringFX(p, 0xff2040, 30, 1.2);
  spark(p, 350, 35, 1.2, 2.5, [1.4, .3, .5], 3);
  mahoraga.visible = false;
  flashScreen('#fff', 1, .8);
  playSound('nuke');
  shake = 14;
  say('NARRATOR', 'Mahoraga — destroyed.', 2);
});

/* ============================================================
   168-176s — FINAL HOLLOW PURPLE
   ============================================================ */
at(168.0, () => { setPose(gojo, 'cast', true); say('GOJO', '"Blue. Red. Hollow Purple."', 2.5); playSound('hollowPurple'); });
at(168.5, () => { orbBlue.visible = true; orbBlue.position.set(gojo.p.x + 1.2, 1.5, 1.2); orbBlue.scale.setScalar(.4); });
at(169.0, () => { orbRed.visible = true; orbRed.position.set(gojo.p.x + 1.2, 1.5, -1.2); orbRed.scale.setScalar(.4); });
at(169.6, () => {
  const mid = new V(gojo.p.x + 1.5, 1.5, 0);
  orbBlue.position.copy(mid); orbRed.position.copy(mid);
  sphereFX(mid, 0xffffff, 5, .5); ringFX(mid, 0x9a40ff, 10, .7);
});
at(170.0, () => {
  orbBlue.visible = false; orbRed.visible = false;
  orbPurple.visible = true; orbPurple.position.set(gojo.p.x + 1.5, 1.5, 0); orbPurple.scale.setScalar(1);
  ringFX(orbPurple.position, 0x9a40ff, 18, 1.2); sphereFX(orbPurple.position, 0xb070ff, 6, .6);
});
at(171.0, () => {
  const startX = orbPurple.position.x, endX = sukuna.p.x;
  const startZ = orbPurple.position.z, endZ = sukuna.p.z;
  const startY = orbPurple.position.y, endY = 1.5;
  let pt = 0; const dur = 1.2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.6, .6, 1, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xd080ff, transparent: true, opacity: .8, blending: AD, depthWrite: false })
  );
  scene.add(beam);
  fxList.push(dt => {
    pt += dt; const k = cl(pt / dur, 0, 1); const ease = k * k;
    const cx = lerp(startX, endX, ease), cy = lerp(startY, endY, ease), cz = lerp(startZ, endZ, ease);
    orbPurple.position.set(cx, cy, cz);
    orbPurple.scale.setScalar(5 + 8 * k);
    const aim = new V(endX - cx, endY - cy, endZ - cz);
    const len = Math.max(.001, aim.length());
    beam.position.set(cx + aim.x / 2, cy + aim.y / 2, cz + aim.z / 2);
    beam.quaternion.setFromUnitVectors(new V(0, 1, 0), aim.clone().normalize());
    beam.scale.set(3 + k * 4, len, 3 + k * 4);
    if (k >= 1) {
      const p = new V(endX, endY, endZ);
      orbPurple.visible = false; scene.remove(beam); beam.material.dispose();
      playSound('nuke');
      if (caPass) caPass.uniforms.amount.value = .07;
      freeze(.3);
      sphereFX(p, 0xffffff, 18, .9);
      sphereFX(p, 0xa040ff, 90, 2.5);
      ringFX(p.clone().setY(.1), 0xb070ff, 140, 3);
      ringFX(p, 0xb070ff, 50, 2, true);
      spark(p, 1400, 90, 1.8, 4, [1.4, .5, 2], -1);
      puff(p, 280, 45, 12, 6, [.22, .16, .28]);
      flashScreen('#fff', 1, 2.2);
      shake = 28; lightFlash(p, 0x9a40ff, 14000);
      setPose(sukuna, 'hit', true); sukuna.ret = 2;
      collapseBuildings(q => q.x > -20, 140);
      for (let i = 0; i < 45; i++) {
        const rp = p.clone().add(rd().multiplyScalar(rnd(15, 70)));
        sphereFX(rp, 0xff80ff, rnd(8, 20), rnd(1, 2.8));
        ringFX(rp, 0xb070ff, rnd(22, 45), rnd(1, 2.8));
      }
      return false;
    }
    return true;
  });
});

/* ============================================================
   176-180s — WORLD-CUTTING SLASH + AIRPORT
   ============================================================ */
at(174.5, () => {
  say('NARRATOR', 'But Sukuna has already learned from Mahoraga. The World-Cutting Slash.', 2.5);
  setPose(sukuna, 'idle'); sukuna.ret = 0;
  sukuna.g.position.set(5, 0, 4);
  setPose(gojo, 'idle');
  setEnv('shrine');
  flashScreen('#300', .7, 1);
  playSound('sukunaDomain');
});
at(176.0, () => {
  say('SUKUNA', '"Cleave."', 1.5);
  const p = worldOf(gojo, 'chest');
  const slash = new THREE.Mesh(
    new THREE.BoxGeometry(.2, 50, .2),
    new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 1, blending: AD, depthWrite: false })
  );
  slash.position.copy(p);
  slash.rotation.z = PI * .15;
  scene.add(slash);
  let t = 0;
  fxList.push(dt => { t += dt; slash.material.opacity = Math.max(0, 1 - t * .7); if (t > 1.5) { scene.remove(slash); slash.material.dispose(); return false; } return true; });
  ringFX(p, 0xff2040, 50, 1.8);
  spark(p, 250, 35, 1.2, 2.5, [1.4, .2, .4], 1);
  shake = 22;
  flashScreen('#fff', 1, 1.5);
  playSound('blackslash');
  freeze(.4);
});
at(177.5, () => {
  setPose(gojo, 'kneel', true);
  say('GOJO', '"...ah."', 2);
});
at(178.0, () => {
  let t = 0;
  fxList.push(dt => {
    t += dt;
    gojo.g.traverse(o => { if (o.isMesh && o.material && o.material.transparent !== undefined) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - t); } });
    if (t > 1.5) { gojo.g.visible = false; return false; }
    return true;
  });
});
at(178.5, () => {
  setEnv('airport');
  shrine.visible = false; throne.visible = false; domainWalls.visible = false;
  sukuna.g.visible = false;
  say('NARRATOR', 'The battle is over.', 2);
});
at(179.5, () => {
  const en = $('en'); en.style.display = 'flex'; requestAnimationFrame(() => en.style.opacity = 1);
  playSound('sukunaLaugh');
});

/* ============================================================
   CAMERA
   ============================================================ */
const CAMERA_SHOTS = [];
const addShot = (a, b, fn) => CAMERA_SHOTS.push([a, b, fn]);
function setCam(px, py, pz, lx, ly, lz, fov = 50) {
  cam.position.set(px, py, pz);
  cam.up.set(0, 1, 0);
  cam.lookAt(lx, ly, lz);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
}

addShot(0, 8, k => setCam(lerp(-25, -10, es(k)), lerp(3, 4, es(k)), lerp(5, 12, k), -30, 1.5, -22, 42));
addShot(8, 12, k => setCam(gojo.p.x + 4, 2, gojo.p.z + 4, sukuna.p.x, 1.5, sukuna.p.z, 40));
addShot(12, 18, k => {
  const a = lerp(.2, 2.6, k);
  const mid = midPoint();
  setCam(Math.sin(a) * 9, 2.6 + Math.sin(k * PI) * 1.2, Math.cos(a) * 9, mid.x, 1.4, 0, 55);
});
addShot(18, 28, k => {
  const a = lerp(.3, 2.7, k);
  const mid = midPoint();
  setCam(Math.sin(a) * 7, 2.5 + Math.sin(k * PI * 2) * 1, Math.cos(a) * 7, mid.x, 1.4, 0, 55);
});
addShot(28, 33, k => setCam(gojo.p.x + 3, 1.8, gojo.p.z + 3, gojo.p.x, 1.4, 0, 40));
addShot(33, 50, k => {
  const a = lerp(-.4, .4, k);
  setCam(Math.sin(a) * 16, lerp(3, 8, k), Math.cos(a) * 16 + 5, 0, lerp(4, 8, k), 0, 55);
});
addShot(50, 68, k => {
  const a = lerp(.3, 2.2, k);
  setCam(Math.sin(a) * 14, 5, Math.cos(a) * 14, 0, 5, 0, 55);
});
addShot(68, 86, k => setCam(gojo.p.x + 3, 1.8, gojo.p.z + 3, gojo.p.x, 1.4, 0, 40));
addShot(86, 102, k => {
  const a = lerp(.3, 2.2, k);
  setCam(Math.sin(a) * 15, 5, Math.cos(a) * 15, 0, 5, 0, 55);
});
addShot(102, 110, k => {
  const r = lerp(22, 12, es(k));
  setCam(Math.sin(k * PI * 2) * r, 4 + k * 8, Math.cos(k * PI * 2) * r, 0, 4, -4, 55);
});
addShot(110, 118, k => {
  const a = lerp(.3, 2.5, k);
  setCam(Math.sin(a) * 12, 4, Math.cos(a) * 12, 0, 3, 0, 55);
});
addShot(118, 140, k => {
  const a = lerp(.3, 2.5, k);
  setCam(mahoraga.position.x * .3 + Math.sin(a) * 8, 3, Math.cos(a) * 8, mahoraga.position.x * .3, 3, 0, 45);
});
addShot(140, 158, k => {
  const a = lerp(.3, 2.5, k);
  setCam(Math.sin(a) * 10, 3 + Math.sin(k * PI) * 2, Math.cos(a) * 10, 0, 3, 0, 50);
});
addShot(158, 168, k => {
  const a = lerp(.3, 2.5, k);
  setCam(mahoraga.position.x + Math.sin(a) * 7, 2.5, Math.cos(a) * 7, mahoraga.position.x, 3, 0, 45);
});
addShot(168, 171, k => setCam(gojo.p.x + 3, 2, gojo.p.z + 4, gojo.p.x + 1.5, 1.5, 0, 42));
addShot(171, 174, k => {
  const op = orbPurple.position;
  setCam(op.x - 7, op.y + 5, op.z + 10, op.x + 5, op.y - 1, op.z, 60);
});
addShot(174, 176, k => setCam(lerp(30, 35, k), 14, 45, 20, 2, 0, 58));
addShot(176, 178.5, k => setCam(gojo.p.x + 7, 2.5, gojo.p.z + 7, gojo.p.x, 1.4, 0, 40));
addShot(178.5, 999, k => setCam(0, 4, 12, 0, 2, 0, 45));

/* ============================================================
   MAIN LOOP
   ============================================================ */
let T = 0, running = false, eventIdx = 0, last = performance.now();
let acc = 0, vacc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(.05, (now - last) / 1000);
  last = now;

  let dt = rawDt;
  if (hitStop > 0) {
    hitStop -= rawDt;
    dt = 0;
  }

  if (running && dt > 0) T += dt;

  while (running && eventIdx < EVENTS.length && EVENTS[eventIdx][0] <= T) {
    EVENTS[eventIdx][1]();
    eventIdx++;
  }

  if (dt > 0) {
    if (gojo.g.visible) updateFighter(gojo, gojoTrack, sukuna, dt, T);
    if (sukuna.g.visible) updateFighter(sukuna, sukunaTrack, gojo, dt, T);
  }

  const showInf = (T > 18 && T < 32) || (T > 50 && T < 68) || (T > 70 && T < 86);
  infinityGroup.visible = showInf;
  if (showInf) {
    infinityGroup.position.set(gojo.p.x, 1.2 + gojo.p.y, 0);
    hexWire.material.opacity = .3 + .15 * Math.sin(T * 6);
    swirlRing.rotation.z += rawDt * 3;
  }

  if (voidGroup.visible) {
    for (let i = 0; i < voidRings.length; i++) {
      const r = voidRings[i];
      r.userData.z += rawDt * 10;
      if (r.userData.z > 20) r.userData.z = -90;
      r.position.set(0, 2.5, r.userData.z);
      const sc = 1 + Math.max(0, (r.userData.z + 90) / 110);
      r.scale.setScalar(sc);
      r.material.opacity = .55 * (1 - Math.abs(r.userData.z + 30) / 65);
    }
    for (const s of voidShards) {
      s.userData.a += rawDt * s.userData.sp;
      s.position.set(Math.cos(s.userData.a) * s.userData.r, s.userData.y + Math.sin(T * .5 + s.userData.r) * .5, Math.sin(s.userData.a) * s.userData.r);
      s.rotation.x += s.userData.rot.x * rawDt;
      s.rotation.y += s.userData.rot.y * rawDt;
      s.rotation.z += s.userData.rot.z * rawDt;
    }
  }

  if (mahoraga.visible) mahoWheel.rotation.y += rawDt * 2;
  if (agito.visible) agito.rotation.y += rawDt * .6;

  if (utahime.visible) {
    utahimeCircle.rotation.z += rawDt * 2;
    utahime.position.y = Math.sin(T * 3) * .05;
  }

  if (dt > 0) {
    if (T >= 33 && T < 50) shrine.scale.y = Math.min(1, shrine.scale.y + dt * 1.2);
    if (T >= 55 && T < 60) shrine.scale.y = Math.max(0, shrine.scale.y - dt * 3);

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
    if (!camUpdated) setCam(0, 1.6, 6, 0, 1.4, 0, 40);

    if (shake > .01) {
      const q = cam.quaternion.clone();
      cam.position.x += rnd(-1, 1) * shake * .15;
      cam.position.y += rnd(-1, 1) * shake * .15;
      cam.position.z += rnd(-1, 1) * shake * .15;
      cam.quaternion.copy(q);
      shake *= Math.exp(-8 * dt);
    }
    cam.updateProjectionMatrix();

    if (caPass) {
      caPass.uniforms.amount.value *= Math.exp(-6 * dt);
      caPass.uniforms.time.value += dt;
    }
  }

  const sc = renderer.domElement.height / (2 * Math.tan(cam.fov * PI / 360));
  glowParticles.m.uniforms.sc.value = sc;
  smokeParticles.m.uniforms.sc.value = sc;

  if (composer) composer.render();
  else renderer.render(scene, cam);
}

/* ============================================================
   START / REPLAY
   ============================================================ */
setEnv('city');

$('go').addEventListener('click', async () => {
  const btn = $('go');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  await preloadAudio();
  await initSynthAudio();

  const ok = Object.values(AUDIO_OK).filter(Boolean).length;
  console.log(`[audio] ${ok}/${audioTotal} MP3s loaded`);

  $('st').style.display = 'none';

  try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}

  setTimeout(() => {
    layout();
    T = 0; eventIdx = 0; running = true;
    acc = 0; vacc = 0; shake = 0; combatLightI = 0; hitStop = 0;
    setEnv('city');
    shrine.scale.y = 1; shrine.visible = false; throne.visible = false;
    blindfold.position.y = .13;
    gojo.eyes.forEach(e => e.visible = false);
    gojo.g.visible = true; sukuna.g.visible = true; sukuna.g.position.set(12, 0, 0);
    orbBlue.visible = orbRed.visible = orbPurple.visible = false;
    infinityGroup.visible = false;
    mahoraga.visible = false; agito.visible = false;
    utahime.visible = false; ijichi.visible = false; gakuganji.visible = false; utahimeCircle.visible = false;
    for (const f of [gojo, sukuna]) {
      f.cur = { ...POSE.idle };
      f.tgt = POSE.idle;
      f.vel = {};
      for (const k of KEYS) f.vel[k] = 0;
      f.ret = 0; f.spd = 0; f.tilt = 0; f.pv.copy(f.p);
      f.g.traverse(o => { if (o.isMesh && o.material) { o.material.opacity = 1; o.material.transparent = false; } });
    }
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